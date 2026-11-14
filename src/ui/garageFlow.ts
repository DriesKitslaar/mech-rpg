import { boostProfile, computeBuildStats, framePart, generatorOf, validatePlayerBuild, weaponIn } from '../core/build';
import {
  BUILD_SLOTS, FACTORY_PAINT, LOADOUT_SLOTS, OPTIONAL_SLOTS, checkEquip, checkLoadout, clearLoadout, equip, fits, loadLoadout,
  saveLoadout, setPaint, spareCount,
  type BuildSlot, type GameState,
} from '../core/game';
import { FRAME_SLOTS, WEAPON_SLOTS, type Build, type BuildError, type BuildStats, type Catalog } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { MenuList, type ListItem } from './menuList';
import { PAINTS, paintById } from './paint';

const G = STRINGS.garage;
const NONE = '(none)';
/** Factory colours first, then every scheme: the order L1 and R1 step through. */
const PAINT_ORDER = [FACTORY_PAINT, ...PAINTS.map((p) => p.id)];

/**
 * The garage without any drawing: pick a slot, pick a part for it, and see what the change
 * would do before confirming; step through paint schemes; keep and recall saved builds.
 * The game it is given is never changed; `game` holds the result.
 */
export class GarageFlow {
  game: GameState;
  mode: 'slots' | 'parts' | 'loadouts' | 'loadoutMenu' = 'slots';
  slots: MenuList;
  parts = new MenuList();
  loadouts = new MenuList();
  loadoutMenu = new MenuList();

  constructor(game: GameState, private catalog: Catalog) {
    this.game = game;
    this.slots = new MenuList(this.slotItems());
    this.loadouts = new MenuList(this.loadoutItems());
  }

  private nameOf(id: string): string {
    return this.catalog[id]?.name ?? id;
  }

  private slotItems(): ListItem[] {
    return BUILD_SLOTS.map((slot) => {
      const id = this.game.build[slot];
      return { id: slot, label: STRINGS.slots[slot], enabled: true, note: id ? this.nameOf(id) : G.empty };
    });
  }

  private partItems(slot: BuildSlot): ListItem[] {
    const fitted = this.game.build[slot];
    const owned = Object.values(this.catalog)
      .filter((part) => (this.game.inventory[part.id] ?? 0) > 0 && fits(part, slot))
      .map((part): ListItem => {
        const here = part.id === fitted;
        const spare = spareCount(this.game, part.id);
        // A part whose every copy is fitted elsewhere cannot be moved here without freeing it first.
        const usable = here || spare > 0;
        return {
          id: part.id, label: here ? `${part.name} ${G.fitted}` : part.name, enabled: usable,
          note: !usable ? G.inUse : spare > 0 ? `x${spare}` : undefined,
        };
      });
    return [...(OPTIONAL_SLOTS.includes(slot) ? [{ id: NONE, label: G.none, enabled: true }] : []), ...owned];
  }

  /** One row per saved build, named after its core. */
  private loadoutItems(): ListItem[] {
    return Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
      const build = this.game.loadouts[i];
      return { id: String(i), label: `${i + 1}  ${build ? this.nameOf(build.core) : G.emptyLoadout}`, enabled: true };
    });
  }

  private loadoutMenuItems(index: number): ListItem[] {
    const saved = this.game.loadouts[index] !== null;
    const refused = checkLoadout(this.game, index, this.catalog);
    return [
      { id: 'load', label: G.load, enabled: refused === null, note: refused?.part ? G.missing(this.nameOf(refused.part)) : undefined },
      { id: 'save', label: G.save, enabled: true },
      { id: 'clear', label: G.clear, enabled: saved },
      { id: 'back', label: G.backItem, enabled: true },
    ];
  }

  /** The slot under the cursor. */
  get slot(): BuildSlot {
    return this.slots.selected!.id as BuildSlot;
  }

  /** The saved build under the cursor, while saved builds are showing. */
  private get loadoutIndex(): number {
    return Number(this.loadouts.selected!.id);
  }

  /** The part highlighted for fitting, or null when browsing slots or when it cannot be fitted. */
  get candidate(): string | null {
    const item = this.parts.selected;
    return this.mode === 'parts' && item?.enabled && item.id !== NONE ? item.id : null;
  }

  /** The build as it would be with the highlighted choice confirmed: a part, or a whole saved build. */
  get previewBuild(): Build {
    if (this.mode === 'loadouts' || this.mode === 'loadoutMenu') return this.game.loadouts[this.loadoutIndex] ?? this.game.build;
    const item = this.parts.selected;
    if (this.mode !== 'parts' || !item?.enabled) return this.game.build;
    const build = { ...this.game.build };
    if (item.id === NONE) delete build[this.slot];
    else build[this.slot] = item.id;
    return build;
  }

  /** The name of the paint the mech wears; a scheme this version does not know counts as factory colours. */
  get paintName(): string {
    return paintById(this.game.paint)?.name ?? G.factoryPaint;
  }

  get stats(): BuildStats { return computeBuildStats(this.game.build, this.catalog); }
  get preview(): BuildStats { return computeBuildStats(this.previewBuild, this.catalog); }
  get errors(): BuildError[] { return validatePlayerBuild(this.game.build, this.catalog); }
  get previewErrors(): BuildError[] { return validatePlayerBuild(this.previewBuild, this.catalog); }

  statsOf(build: Build): BuildStats {
    return computeBuildStats(build, this.catalog);
  }

  /** Numbers the build panel shows beyond the basic statistics. */
  details(build: Build): { cooling: number; evasion: number; volley: number } {
    const boost = boostProfile(build, this.catalog);
    return {
      cooling: generatorOf(build, this.catalog).cooling,
      // How hard the mech is to hit in a turn it boosts; tracks cannot boost and have only their mobility.
      evasion: this.statsOf(build).mobility + (boost.able ? boost.thrust : 0),
      // The energy it takes to fire every weapon once.
      volley: WEAPON_SLOTS.reduce((sum, slot) => sum + (weaponIn(build, slot, this.catalog)?.energy ?? 0), 0),
    };
  }

  /** Total armour of a build's frame parts. */
  armour(build: Build): number {
    return FRAME_SLOTS.reduce((sum, slot) => sum + (framePart(build, slot, this.catalog)?.ap ?? 0), 0);
  }

  private stepPaint(step: number): void {
    const n = PAINT_ORDER.length;
    const at = Math.max(0, PAINT_ORDER.indexOf(this.game.paint));
    this.game = setPaint(this.game, PAINT_ORDER[(at + step + n) % n]);
  }

  /** Runs the chosen entry of a saved build's menu. */
  private loadoutAction(id: string): 'stay' | 'changed' {
    const index = this.loadoutIndex;
    if (id === 'load') {
      this.game = loadLoadout(this.game, index, this.catalog);
      this.slots.setItems(this.slotItems());
      this.mode = 'slots';
      return 'changed';
    }
    if (id === 'save') this.game = saveLoadout(this.game, index);
    else if (id === 'clear') this.game = clearLoadout(this.game, index);
    this.loadouts.setItems(this.loadoutItems());
    this.mode = 'loadouts';
    return id === 'back' ? 'stay' : 'changed';
  }

  onInput(action: InputAction): 'stay' | 'changed' | 'exit' {
    const list = { slots: this.slots, parts: this.parts, loadouts: this.loadouts, loadoutMenu: this.loadoutMenu }[this.mode];
    if (action === 'up') { list.move(-1); return 'stay'; }
    if (action === 'down') { list.move(1); return 'stay'; }
    switch (this.mode) {
      case 'slots':
        if (action === 'cancel') return 'exit';
        if (action === 'prev' || action === 'next') { this.stepPaint(action === 'next' ? 1 : -1); return 'changed'; }
        if (action === 'left' || action === 'right') { this.mode = 'loadouts'; return 'stay'; }
        if (action === 'confirm') {
          const items = this.partItems(this.slot);
          const fitted = items.findIndex((item) => item.id === (this.game.build[this.slot] ?? NONE));
          this.parts = new MenuList(items, Math.max(0, fitted));
          this.mode = 'parts';
        }
        return 'stay';
      case 'parts': {
        if (action === 'cancel') { this.mode = 'slots'; return 'stay'; }
        if (action !== 'confirm') return 'stay';
        const item = this.parts.selected;
        if (!item?.enabled) return 'stay';
        const partId = item.id === NONE ? null : item.id;
        if (checkEquip(this.game, this.slot, partId, this.catalog) !== null) return 'stay';
        this.game = equip(this.game, this.slot, partId, this.catalog);
        this.slots.setItems(this.slotItems());
        this.mode = 'slots';
        return 'changed';
      }
      case 'loadouts':
        if (action === 'cancel' || action === 'left' || action === 'right') { this.mode = 'slots'; return 'stay'; }
        if (action === 'confirm') {
          const items = this.loadoutMenuItems(this.loadoutIndex);
          this.loadoutMenu = new MenuList(items, items.findIndex((item) => item.enabled));
          this.mode = 'loadoutMenu';
        }
        return 'stay';
      case 'loadoutMenu': {
        if (action === 'cancel') { this.mode = 'loadouts'; return 'stay'; }
        const item = this.loadoutMenu.selected;
        if (action !== 'confirm' || !item?.enabled) return 'stay';
        return this.loadoutAction(item.id);
      }
    }
  }
}
