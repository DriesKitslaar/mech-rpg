import { framePart, weaponIn } from './build';
import { reached, type Condition, type Mission } from './campaign';
import type { GameState } from './game';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog, type DamageType, type EnemyDef } from './types';

/** A few lines about the world, which open at some point in the story and stay open. */
export interface Entry {
  id: string;
  title: string;
  text: string;
  /** What has to have happened: a contract done, `choice`, `finale`, `verdict`, `arena:N`, or `start`. */
  after: Condition;
}

/**
 * Opens every entry whose time has come and that is not open yet, in list order. An open entry
 * stays open through later cycles. The state is returned unchanged when nothing opens.
 */
export function openEntries(game: GameState, entries: Entry[], missions: Mission[]): { game: GameState; opened: Entry[] } {
  const opened = entries.filter((entry) => !game.codex.includes(entry.id) && reached(game, entry.after, missions));
  if (opened.length === 0) return { game, opened };
  return { game: { ...game, codex: [...game.codex, ...opened.map((entry) => entry.id)] }, opened };
}

/** What can be read off an enemy's parts. */
export interface UnitSheet {
  /** The armour of all its parts together. */
  armour: number;
  /** The one kind of damage its core resists least, and the one it resists most; null when no single kind stands out. */
  weak: DamageType | null;
  strong: DamageType | null;
  weapons: { name: string; type: DamageType }[];
}

const TYPES: DamageType[] = ['kinetic', 'energy', 'explosive'];

export function unitSheet(def: EnemyDef, catalog: Catalog): UnitSheet {
  const frames = FRAME_SLOTS.flatMap((slot) => framePart(def.build, slot, catalog) ?? []);
  const resist = framePart(def.build, 'core', catalog)?.resist;
  // The single type at one end of the scale; a tie there means there is no such type.
  const only = (pick: (...values: number[]) => number): DamageType | null => {
    if (!resist) return null;
    const edge = pick(...TYPES.map((type) => resist[type]));
    const at = TYPES.filter((type) => resist[type] === edge);
    return at.length === 1 ? at[0] : null;
  };
  return {
    armour: frames.reduce((sum, part) => sum + part.ap, 0),
    weak: only(Math.min),
    strong: only(Math.max),
    weapons: WEAPON_SLOTS.flatMap((slot) => weaponIn(def.build, slot, catalog) ?? []).map((w) => ({ name: w.name, type: w.damageType })),
  };
}
