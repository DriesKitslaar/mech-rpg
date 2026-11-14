import {
  DEFAULT_SETTINGS, DIFFICULTIES, FACTORY_PAINT, LOADOUT_SLOTS, SAVE_VERSION, isValidState,
  type Difficulty, type GameState, type Settings,
} from '../core/game';
import type { Catalog } from '../core/types';

export const SAVE_KEY = 'ironwage-save';
/** Options are kept apart from the game, so they exist before a game does and survive starting over. */
export const SETTINGS_KEY = 'ironwage-settings';

/** The part of `localStorage` the game needs; injected so saving can be tested without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Brings a save written by an older version up to date, so an update never costs the player their game. */
function upgrade(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  let save = value as Record<string, unknown>;
  // Version 1 had no campaign: no contracts completed, no messages read.
  if (save.version === 1) save = { ...save, version: 2, completed: [], read: [] };
  // Version 2 did not remember whether the ending had been shown; show it (again) rather than never.
  if (save.version === 2) save = { ...save, version: 3, endingSeen: false };
  // Version 3 had no pilot levels, arena, cycles or settings.
  if (save.version === 3) {
    save = { ...save, version: 4, xp: 0, perks: {}, arenaRank: 0, cycle: 0, settings: { ...DEFAULT_SETTINGS } };
  }
  // Version 4 had no boosters or fire control: every mech had what are now the stock parts built in.
  // Issuing those, fitted, changes nothing about how the mech performs.
  if (save.version === 4) save = { ...save, ...withStockParts(save), version: 5 };
  // Version 5 had no paint and no saved builds.
  if (save.version === 5) save = { ...save, version: 6, paint: FACTORY_PAINT, loadouts: Array.from({ length: LOADOUT_SLOTS }, () => null) };
  // Version 6 had no ranks and no scenes, and its story ended where the third act now begins: whoever
  // saw that ending has not seen the real one, so it is shown when it is earned.
  if (save.version === 6) save = { ...save, version: SAVE_VERSION, ranks: {}, scenes: [], endingSeen: false };
  return save;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' } as const;

/** The build, inventory and settings of a version 4 save with the stock booster, fire control and difficulty added. */
function withStockParts(save: Record<string, unknown>): Record<string, unknown> {
  const { build, inventory, settings } = save;
  // Anything malformed is left as it is; the validity check refuses it afterwards.
  if (!isRecord(build) || !isRecord(inventory) || !isRecord(settings)) return {};
  const nextBuild = { ...build };
  const nextInventory = { ...inventory };
  for (const [slot, id] of Object.entries(STOCK)) {
    if (typeof nextBuild[slot] === 'string') continue;
    nextBuild[slot] = id;
    nextInventory[id] = (typeof nextInventory[id] === 'number' ? (nextInventory[id] as number) : 0) + 1;
  }
  return { build: nextBuild, inventory: nextInventory, settings: { difficulty: DEFAULT_SETTINGS.difficulty, ...settings } };
}

/** One save slot. Anything unreadable or invalid counts as no save; nothing here ever throws. */
export class SaveFile {
  constructor(private store: KeyValueStore, private catalog: Catalog) {}

  load(): GameState | null {
    try {
      const raw = this.store.getItem(SAVE_KEY);
      if (!raw) return null;
      const value = upgrade(JSON.parse(raw));
      return isValidState(value, this.catalog) ? value : null;
    } catch {
      return null;
    }
  }

  /** True when something is stored that the game cannot use, so the player can be told why there is no Continue. */
  hasUnusableData(): boolean {
    try {
      return !!this.store.getItem(SAVE_KEY) && this.load() === null;
    } catch {
      return false;
    }
  }

  /** Returns false when the device refuses to store the game (full or blocked storage). */
  save(state: GameState): boolean {
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  /** The stored options, or null when there are none that can be used. */
  loadSettings(): Settings | null {
    try {
      const raw = this.store.getItem(SETTINGS_KEY);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
      const { sfx, music, fastBattles, difficulty, rumble } = value as Record<string, unknown>;
      if (typeof sfx !== 'boolean' || typeof music !== 'boolean' || typeof fastBattles !== 'boolean') return null;
      // Options added later than the first three fall back to their default when absent or unknown.
      const known = DIFFICULTIES.includes(difficulty as Difficulty);
      return {
        sfx, music, fastBattles, difficulty: known ? (difficulty as Difficulty) : DEFAULT_SETTINGS.difficulty,
        rumble: typeof rumble === 'boolean' ? rumble : true,
      };
    } catch {
      return null;
    }
  }

  saveSettings(settings: Settings): boolean {
    try {
      this.store.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.store.removeItem(SAVE_KEY);
    } catch {
      // Nothing to do: a save that cannot be removed is simply overwritten later.
    }
  }
}
