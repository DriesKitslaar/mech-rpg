import { SAVE_VERSION, isValidState, type GameState } from '../core/game';
import type { Catalog } from '../core/types';

export const SAVE_KEY = 'ironwage-save';

/** The part of `localStorage` the game needs; injected so saving can be tested without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Brings a save written by an older version up to date, so an update never costs the player their game. */
function upgrade(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const save = value as Record<string, unknown>;
  // Version 1 had no campaign: no contracts completed, no messages read.
  if (save.version === 1) return { ...save, version: SAVE_VERSION, completed: [], read: [] };
  return value;
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

  clear(): void {
    try {
      this.store.removeItem(SAVE_KEY);
    } catch {
      // Nothing to do: a save that cannot be removed is simply overwritten later.
    }
  }
}
