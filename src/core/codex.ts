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

/**
 * The kinds of enemy a pilot must have met, going by the record: everything in the battles of every
 * contract they have finished (in this cycle or an earlier one, where a rank is what is left of it),
 * and every arena opponent they have beaten. What the game already lists comes first. A game kept
 * before enemies met were listed is brought up to date with this.
 */
export function metByRecord(game: GameState, missions: Mission[], ladder: { rank: number; enemy: string }[]): string[] {
  const finished = new Set([...game.completed, ...Object.keys(game.ranks)]);
  const fought = missions.filter((mission) => finished.has(mission.id)).flatMap((mission) => mission.battles.flatMap((battle) => battle.enemies));
  const beaten = ladder.filter((opponent) => opponent.rank <= game.arenaRank).map((opponent) => opponent.enemy);
  return [...new Set([...game.met, ...fought, ...beaten])];
}

/** What can be read off an enemy's parts. */
export interface UnitSheet {
  /** The armour of all its parts together. */
  armour: number;
  /**
   * The one kind of damage its core resists least, and the one it resists most; null when no single
   * kind stands out by enough to choose a weapon by.
   */
  weak: DamageType | null;
  strong: DamageType | null;
  weapons: { name: string; type: DamageType }[];
}

const TYPES: DamageType[] = ['kinetic', 'energy', 'explosive'];
/** How far a core's resistance to one kind must be from its resistance to the next for that to be worth a line: a tenth of the damage. */
export const TELLING_GAP = 0.1;

export function unitSheet(def: EnemyDef, catalog: Catalog): UnitSheet {
  const frames = FRAME_SLOTS.flatMap((slot) => framePart(def.build, slot, catalog) ?? []);
  const resist = framePart(def.build, 'core', catalog)?.resist;
  // The type at one end of the scale, when it is clear of the one next to it; a tie or a near thing means there is no such type.
  const only = (end: 'low' | 'high'): DamageType | null => {
    if (!resist) return null;
    const ordered = [...TYPES].sort((a, b) => (end === 'low' ? resist[a] - resist[b] : resist[b] - resist[a]));
    // Resistances are tenths and twentieths; the margin keeps a rounding error from deciding it.
    return Math.abs(resist[ordered[0]] - resist[ordered[1]]) >= TELLING_GAP - 1e-9 ? ordered[0] : null;
  };
  return {
    armour: frames.reduce((sum, part) => sum + part.ap, 0),
    weak: only('low'),
    strong: only('high'),
    weapons: WEAPON_SLOTS.flatMap((slot) => weaponIn(def.build, slot, catalog) ?? []).map((w) => ({ name: w.name, type: w.damageType })),
  };
}
