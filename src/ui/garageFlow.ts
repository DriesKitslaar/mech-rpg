import { archetypeOf } from '../core/archetype';
import { boostProfile, computeBuildStats, framePart, generatorOf, validatePlayerBuild, weaponIn } from '../core/build';
import {
  BUILD_SLOTS, FACTORY_PAINT, LOADOUT_SLOTS, OPTIONAL_SLOTS, checkEquip, checkLoadout, clearLoadout, equip, fits, loadLoadout,
  saveLoadout, setPaint, spareCount,
  type BuildSlot, type GameState,
} from '../core/game';
import { MIX_KEYS, parseMix, setMix, stepMix, type Mix, type MixKey } from '../core/mix';
import { TUNE_MAX, checkTune, stepOf, tunable, tune, tuneCap, tuneCost, tunedCatalog, tunedPart, type TuneRefusal } from '../core/tuning';
import { FRAME_SLOTS, WEAPON_SLOTS, type Build, type BuildError, type BuildStats, type Catalog, type Part } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { MenuList, type ListItem } from './menuList';
import { paintById, paintsFor } from './paint';

const G = STRINGS.garage;
const M = G.mixer;
const NONE = '(none)';
/** Factory colours first, then every scheme: the order L1 and R1 step through. */

/** What the bench has to say about the part on it: where it stands, what the next step would make of it, and what that costs. */
export interface BenchInfo {
  id: string;
  name: string;
  step: number;
  /** How far the bench goes in this cycle. */
  cap: number;
  /** What a step works on, and that figure as it is and as the next step would leave it. */
  figure: 'armour' | 'damage' | 'output';
  now: number;
  next: number;
  /** The price of the next step. */
  cost: number;
  refusal: TuneRefusal | null;
}

/** The figure the bench works on, for a part it takes. */
function figureOf(part: Part): { figure: BenchInfo['figure']; value: number } {
  if (part.kind === 'weapon') return { figure: 'damage', value: part.damage };
  if (part.kind === 'generator') return { figure: 'output', value: part.output };
  return { figure: 'armour', value: 'ap' in part ? part.ap : 0 };
}

/**
 * The garage without any drawing: pick a slot, pick a part for it, and see what the change
 * would do before confirming; step through paint schemes; keep and recall saved builds; put a
 * part on the bench. The game it is given is never changed; `game` holds the result.
 */
export class GarageFlow {
  game: GameState;
  mode: 'slots' | 'parts' | 'loadouts' | 'loadoutMenu' | 'bench' | 'paint' = 'slots';
  slots: MenuList;
  parts = new MenuList();
  loadouts = new MenuList();
  loadoutMenu = new MenuList();
  bench = new MenuList();
  /** The rows of the paint page: the paint that is worn, and the five things a mix sets. */
  paintRows: MenuList;
  /** The part on the bench. */
  private benchId: string | null = null;
  /** The catalogue as the pilot reads it: the same parts, with the bench's work counted into their figures. */
  private catalog: Catalog;

  constructor(game: GameState, private factory: Catalog) {
    this.game = game;
    this.catalog = tunedCatalog(factory, game.tuning);
    this.slots = new MenuList(this.slotItems());
    this.loadouts = new MenuList(this.loadoutItems());
    this.paintRows = new MenuList(this.paintItems());
  }

  /** The mix the machine wears, when what it wears is one of the pilot's own mixes. */
  get mix(): Mix | null {
    return parseMix(this.game.paint);
  }

  /** The paint page's rows as they stand: the first says what is worn; the five of a mix are dim while what is worn is none. */
  private paintItems(): ListItem[] {
    const mixed = this.mix !== null;
    return [{ id: 'paint', label: M.rows.paint, enabled: true, note: this.paintName }, ...MIX_KEYS.map((key) => ({ id: key, label: M.rows[key], enabled: mixed }))];
  }

  /** A part's name, with the step the bench has taken it to. */
  private nameOf(id: string): string {
    const step = stepOf(this.game.tuning, id);
    return `${this.catalog[id]?.name ?? id}${step > 0 ? ` +${step}` : ''}`;
  }

  /** A part as the pilot's garage reads it: with the bench's work counted in. */
  partOf(id: string): Part | undefined {
    return Object.hasOwn(this.catalog, id) ? this.catalog[id] : undefined;
  }

  /**
   * Takes the game back as it was booked: with whatever the booking added (a medal and its pay, time
   * played). The lists stay as they are but for the bench's: what a medal pays can put the next step
   * within reach, and the row for it has to say so at once.
   */
  adopt(game: GameState): void {
    this.game = game;
    if (this.mode === 'bench' && this.benchId !== null) this.bench = this.benchList();
  }

  /** The bench's two rows as they stand now: the cursor on the next step while there is one to take, else on the way back. */
  private benchList(): MenuList {
    const items = this.benchItems();
    return new MenuList(items, items.findIndex((item) => item.enabled));
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
        // The step the bench has taken it to stands beside it, before how many are spare.
        const step = stepOf(this.game.tuning, part.id);
        const marks = [...(step > 0 ? [`+${step}`] : []), ...(spare > 0 ? [`x${spare}`] : [])].join(' ');
        return {
          id: part.id, label: here ? `${part.name} ${G.fitted}` : part.name, enabled: usable,
          note: !usable ? G.inUse : marks || undefined,
        };
      });
    return [...(OPTIONAL_SLOTS.includes(slot) ? [{ id: NONE, label: G.none, enabled: true }] : []), ...owned];
  }

  /**
   * One row per place a build can be kept in. A build kept there goes by what kind of machine it is, with
   * the frame its core is from beside it: seven rows of cores would say little. A place the kept list
   * does not name (a game from when there were fewer) is empty.
   */
  private loadoutItems(): ListItem[] {
    return Array.from({ length: LOADOUT_SLOTS }, (_, i) => {
      const build = this.game.loadouts[i];
      if (!build) return { id: String(i), label: `${i + 1}  ${G.emptyLoadout}`, enabled: true };
      return { id: String(i), label: `${i + 1}  ${STRINGS.classes.names[archetypeOf(build, this.factory)]}`, enabled: true, note: this.nameOf(build.core).split(' ')[0] };
    });
  }

  private loadoutMenuItems(index: number): ListItem[] {
    const saved = !!this.game.loadouts[index];
    const refused = checkLoadout(this.game, index, this.catalog);
    return [
      { id: 'load', label: G.load, enabled: refused === null, note: refused?.part ? G.missing(this.catalog[refused.part]?.name ?? refused.part) : undefined },
      { id: 'save', label: G.save, enabled: true },
      { id: 'clear', label: G.clear, enabled: saved },
      { id: 'back', label: G.backItem, enabled: true },
    ];
  }

  /** The slot under the cursor. */
  get slot(): BuildSlot {
    return this.slots.selected!.id as BuildSlot;
  }

  /** Whether the part under the cursor is one the bench takes: the foot of the panel says so. */
  get benchable(): boolean {
    const item = this.parts.selected;
    return this.mode === 'parts' && !!item && item.id !== NONE && Object.hasOwn(this.factory, item.id) && tunable(this.factory[item.id]);
  }

  /** What the bench says about the part on it; null when nothing is. */
  get benchInfo(): BenchInfo | null {
    const id = this.benchId;
    if (this.mode !== 'bench' || id === null || !Object.hasOwn(this.factory, id)) return null;
    const part = this.factory[id];
    const step = stepOf(this.game.tuning, id);
    const { figure, value: now } = figureOf(tunedPart(part, step));
    return {
      id, name: this.nameOf(id), step, cap: tuneCap(this.game.cycle), figure, now,
      next: figureOf(tunedPart(part, step + 1)).value, cost: tuneCost(part, step + 1), refusal: checkTune(this.game, id, this.factory),
    };
  }

  private benchItems(): ListItem[] {
    const id = this.benchId!;
    const step = stepOf(this.game.tuning, id);
    const refusal = checkTune(this.game, id, this.factory);
    return [
      // At the limit the row says so: the last step of all, or the last this cycle allows.
      refusal === 'limit'
        ? { id: 'tune', label: step >= TUNE_MAX ? G.benchAtEnd : G.benchAtLimit, enabled: false }
        : { id: 'tune', label: G.tune(step + 1), enabled: refusal === null, note: G.benchCost(tuneCost(this.factory[id], step + 1)) },
      { id: 'back', label: G.backItem, enabled: true },
    ];
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
  /** The errors of the build whose numbers the panel shows: the fitted one while browsing slots, else the one previewed. */
  get shownErrors(): BuildError[] { return this.mode === 'slots' ? this.errors : this.previewErrors; }

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

  /**
   * On to the next paint the pilot may wear, or back to the one before. A paint that is not among them (one
   * this version does not know, or a master's whose crown the pilot does not hold) is stepped away from as
   * factory colours are, and is not come back to.
   */
  private stepPaint(step: number): void {
    const order = paintsFor(this.game);
    const at = Math.max(0, order.indexOf(this.game.paint));
    this.game = setPaint(this.game, order[(at + step + order.length) % order.length]);
    this.paintRows.setItems(this.paintItems());
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
    const list = { slots: this.slots, parts: this.parts, loadouts: this.loadouts, loadoutMenu: this.loadoutMenu, bench: this.bench, paint: this.paintRows }[this.mode];
    if (action === 'up') { list.move(-1); return 'stay'; }
    if (action === 'down') { list.move(1); return 'stay'; }
    switch (this.mode) {
      case 'slots':
        if (action === 'cancel') return 'exit';
        if (action === 'prev' || action === 'next') { this.stepPaint(action === 'next' ? 1 : -1); return 'changed'; }
        // The parts are the panel's middle page: the paint shop is to their left, the saved builds to their right.
        if (action === 'left') { this.mode = 'paint'; return 'stay'; }
        if (action === 'right') { this.mode = 'loadouts'; return 'stay'; }
        if (action === 'confirm') {
          const items = this.partItems(this.slot);
          const fitted = items.findIndex((item) => item.id === (this.game.build[this.slot] ?? NONE));
          this.parts = new MenuList(items, Math.max(0, fitted));
          this.mode = 'parts';
        }
        return 'stay';
      case 'parts': {
        if (action === 'cancel') { this.mode = 'slots'; return 'stay'; }
        // R1 puts the part under the cursor on the bench, fitted or not, if it is one the bench takes.
        if (action === 'next' && this.benchable) {
          this.benchId = this.parts.selected!.id;
          this.bench = this.benchList();
          this.mode = 'bench';
          return 'stay';
        }
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
      case 'bench': {
        if (action === 'cancel') { this.mode = 'parts'; return 'stay'; }
        const item = this.bench.selected;
        if (action !== 'confirm' || !item?.enabled) return 'stay';
        if (item.id === 'back') { this.mode = 'parts'; return 'stay'; }
        this.game = tune(this.game, this.benchId!, this.factory);
        // Every figure and every name that showed the part now shows it as the bench left it.
        this.catalog = tunedCatalog(this.factory, this.game.tuning);
        this.slots.setItems(this.slotItems());
        this.parts.setItems(this.partItems(this.slot));
        this.bench = this.benchList();
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
      case 'paint': {
        if (action === 'cancel') { this.mode = 'slots'; return 'stay'; }
        // A row is changed with left and right, which go on while they are held; L1 and R1 do the same, as they
        // change the paint on the parts, and A is a step on, as it is in the options.
        const step = action === 'right' || action === 'next' || action === 'confirm' ? 1 : action === 'left' || action === 'prev' ? -1 : 0;
        if (step === 0) return 'stay';
        const row = this.paintRows.selected!.id;
        if (row === 'paint') {
          this.stepPaint(step);
          return 'changed';
        }
        // One of the five things a mix sets: a step on or back, for the mix that is worn. With none worn the row is dim.
        const mix = this.mix;
        if (!mix) return 'stay';
        // (The rows stand as they stood: it is the same mix in the same place, a step on.)
        this.game = setMix(this.game, stepMix(mix, row as MixKey, step));
        return 'changed';
      }
      case 'loadoutMenu': {
        if (action === 'cancel') { this.mode = 'loadouts'; return 'stay'; }
        const item = this.loadoutMenu.selected;
        if (action !== 'confirm' || !item?.enabled) return 'stay';
        return this.loadoutAction(item.id);
      }
    }
  }
}
