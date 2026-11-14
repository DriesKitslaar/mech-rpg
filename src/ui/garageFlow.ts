import { computeBuildStats, framePart, validatePlayerBuild } from '../core/build';
import { BUILD_SLOTS, OPTIONAL_SLOTS, checkEquip, equip, fits, spareCount, type BuildSlot, type GameState } from '../core/game';
import { FRAME_SLOTS, type Build, type BuildError, type BuildStats, type Catalog } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { MenuList, type ListItem } from './menuList';

const G = STRINGS.garage;
const NONE = '(none)';

/**
 * The garage without any drawing: pick a slot, pick a part for it, and see what the change
 * would do before confirming. The game it is given is never changed; `game` holds the result.
 */
export class GarageFlow {
  game: GameState;
  mode: 'slots' | 'parts' = 'slots';
  slots: MenuList;
  parts = new MenuList();

  constructor(game: GameState, private catalog: Catalog) {
    this.game = game;
    this.slots = new MenuList(this.slotItems());
  }

  private slotItems(): ListItem[] {
    return BUILD_SLOTS.map((slot) => {
      const id = this.game.build[slot];
      return { id: slot, label: STRINGS.slots[slot], enabled: true, note: id ? this.catalog[id]?.name ?? id : G.empty };
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

  /** The slot under the cursor. */
  get slot(): BuildSlot {
    return this.slots.selected!.id as BuildSlot;
  }

  /** The part highlighted for fitting, or null when browsing slots or when it cannot be fitted. */
  get candidate(): string | null {
    const item = this.parts.selected;
    return this.mode === 'parts' && item?.enabled && item.id !== NONE ? item.id : null;
  }

  /** The build as it would be with the highlighted choice confirmed. */
  get previewBuild(): Build {
    const item = this.parts.selected;
    if (this.mode !== 'parts' || !item?.enabled) return this.game.build;
    const build = { ...this.game.build };
    if (item.id === NONE) delete build[this.slot];
    else build[this.slot] = item.id;
    return build;
  }

  get stats(): BuildStats { return computeBuildStats(this.game.build, this.catalog); }
  get preview(): BuildStats { return computeBuildStats(this.previewBuild, this.catalog); }
  get errors(): BuildError[] { return validatePlayerBuild(this.game.build, this.catalog); }
  get previewErrors(): BuildError[] { return validatePlayerBuild(this.previewBuild, this.catalog); }

  /** Total armour of a build's frame parts. */
  armour(build: Build): number {
    return FRAME_SLOTS.reduce((sum, slot) => sum + (framePart(build, slot, this.catalog)?.ap ?? 0), 0);
  }

  onInput(action: InputAction): 'stay' | 'changed' | 'exit' {
    const list = this.mode === 'slots' ? this.slots : this.parts;
    if (action === 'up') list.move(-1);
    else if (action === 'down') list.move(1);
    else if (this.mode === 'slots') {
      if (action === 'cancel') return 'exit';
      if (action === 'confirm') {
        const items = this.partItems(this.slot);
        const fitted = items.findIndex((item) => item.id === (this.game.build[this.slot] ?? NONE));
        this.parts = new MenuList(items, Math.max(0, fitted));
        this.mode = 'parts';
      }
    } else if (action === 'cancel') {
      this.mode = 'slots';
    } else if (action === 'confirm') {
      const item = this.parts.selected;
      if (!item?.enabled) return 'stay';
      const partId = item.id === NONE ? null : item.id;
      if (checkEquip(this.game, this.slot, partId, this.catalog) !== null) return 'stay';
      this.game = equip(this.game, this.slot, partId, this.catalog);
      this.slots.setItems(this.slotItems());
      this.mode = 'slots';
      return 'changed';
    }
    return 'stay';
  }
}
