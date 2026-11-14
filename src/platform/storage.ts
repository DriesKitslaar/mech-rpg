import { isValidState, type GameState } from '../core/game';
import type { Catalog } from '../core/types';

export const SAVE_KEY = 'ironwage-save';

/** The part of `localStorage` the game needs; injected so saving can be tested without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** One save slot. Anything unreadable or invalid counts as no save; nothing here ever throws. */
export class SaveFile {
  constructor(private store: KeyValueStore, private catalog: Catalog) {}

  load(): GameState | null {
    try {
      const raw = this.store.getItem(SAVE_KEY);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      return isValidState(value, this.catalog) ? value : null;
    } catch {
      return null;
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
