import type { GameState } from './game';

/**
 * A name from deeds. Nothing new is kept: the record a game already holds (machines destroyed,
 * bosses beaten, the arena, the tellings) is read as renown, and renown as one of five names. All
 * of it only ever goes up, so a name once earned is never lost.
 */

/** What each thing on the record counts for. */
export const RENOWN = { kill: 1, boss: 8, arena: 4, cycle: 40 } as const;

/** The renown at which each name is earned, the first name first. */
export const NAME_AT = [20, 60, 150, 320, 600] as const;

type Record = Pick<GameState, 'stats' | 'arenaRank' | 'cycle'>;

export function renownOf(game: Record): number {
  return RENOWN.kill * game.stats.kills + RENOWN.boss * game.stats.bosses + RENOWN.arena * game.arenaRank + RENOWN.cycle * game.cycle;
}

/** The name the record has earned: 0 for none yet, then 1 to 5 up the ladder. */
export function nameRank(game: Record): number {
  const renown = renownOf(game);
  return NAME_AT.filter((at) => renown >= at).length;
}

/** The renown the next name asks for, or null for a pilot who has the last. */
export function nextNameAt(game: Record): number | null {
  return NAME_AT[nameRank(game)] ?? null;
}
