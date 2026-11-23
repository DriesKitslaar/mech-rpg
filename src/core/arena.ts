import type { Mission } from './campaign';
import { likenessPaint } from './mix';
import type { GameState } from './game';
import type { EnemyDef } from './types';

/** The ladder ends with the champion at rank ten. Behind it is a back room with five more, shown only to the champion. */
export const CHAMPION_RANK = 10;
export const ARENA_RANKS = 15;

/** How many ranks the arena shows this pilot. */
export const shownRanks = (state: GameState): number => (state.arenaRank >= CHAMPION_RANK ? ARENA_RANKS : CHAMPION_RANK);

export interface ArenaOpponent {
  /** 1 is the bottom of the ladder. */
  rank: number;
  name: string;
  /** Id of the opponent's mech among the arena enemies. */
  enemy: string;
  purse: number;
  /** Multiplies the opponent's armour and damage. */
  scale: number;
  /** What they say before the fight. */
  taunt: string;
  /** One line about how they fight. */
  style: string;
}

export type ChallengeError = 'unknown' | 'locked';

/** Opponents are fought in order; anyone already beaten can be fought again. */
export function checkChallenge(state: GameState, rank: number): ChallengeError | null {
  if (!Number.isInteger(rank) || rank < 1 || rank > ARENA_RANKS) return 'unknown';
  return rank > state.arenaRank + 1 ? 'locked' : null;
}

/**
 * A rematch: a bout that has been won before, fought again. The house pays a quarter of the purse for
 * the first, and half as much again for each one after: the crowd has seen it. What it pays is all it
 * is worth: a rematch is no contract (see `Mission.rematch`).
 */
type Rematched = Pick<GameState, 'rematches'>;
/** How often a bout has been won again after it had been won. */
export const rematchesWon = (state: Rematched, id: string): number => {
  const count = state.rematches && Object.hasOwn(state.rematches, id) ? state.rematches[id] : 0;
  return Number.isInteger(count) && count > 0 ? count : 0;
};
/** What a bout pays that has been won before, of a purse that was this much in full. */
export const rematchPurse = (state: Rematched, id: string, purse: number): number => Math.round(purse / 4 / 2 ** Math.min(40, rematchesWon(state, id)));
/** Writes a rematch won down: its next purse is half of this one's. */
export function recordRematch<T extends Rematched>(state: T, id: string): T {
  return { ...state, rematches: { ...state.rematches, [id]: rematchesWon(state, id) + 1 } };
}
/** The mark of a rematch on a bout in the shape of a contract. */
export const asRematch = (again: boolean): { rematch?: true } => (again ? { rematch: true } : {});

/** The id of the fight with an opponent of the ladder. */
export const arenaId = (rank: number): string => `arena-${rank}`;

/** The full purse for the next opponent, a rematch's for one beaten before. */
export function arenaPurse(state: GameState, opponent: ArenaOpponent): number {
  return opponent.rank <= state.arenaRank ? rematchPurse(state, arenaId(opponent.rank), opponent.purse) : opponent.purse;
}

/** Beating the next opponent in line raises the rank; nothing else does. */
export function recordArenaWin(state: GameState, rank: number): GameState {
  return rank === state.arenaRank + 1 && rank <= ARENA_RANKS ? { ...state, arenaRank: rank } : state;
}

/** An arena fight in the shape of a contract, so it is briefed, fought and settled like one. */
export function arenaMission(state: GameState, opponent: ArenaOpponent, text: { client: string; win: string }): Mission {
  return {
    id: arenaId(opponent.rank), phase: 'patrol', title: opponent.name, client: text.client,
    briefing: [opponent.style, `"${opponent.taunt}"`], debrief: text.win, reward: arenaPurse(state, opponent),
    battles: [{ enemies: [opponent.enemy], background: 'bg-arena' }], scale: opponent.scale, arenaRank: opponent.rank,
    ...asRematch(opponent.rank <= state.arenaRank),
  };
}

/** The mirror match: a duel against the pilot's own build. It opens at this rank, and pays its purse once and a rematch's after. */
export const MIRROR_ID = 'arena-mirror';
export const MIRROR_OPENS = 3;
export const MIRROR_PURSE = 2400;
/** The house tunes its copy a little hotter than the original, so an even fight is not a formality. */
export const MIRROR_SCALE = 1.1;

export const mirrorOpen = (state: GameState): boolean => state.arenaRank >= MIRROR_OPENS;
export const mirrorPurse = (state: GameState): number => (state.stats.mirrors > 0 ? rematchPurse(state, MIRROR_ID, MIRROR_PURSE) : MIRROR_PURSE);

/**
 * The opponent of a mirror match: the pilot's build as it is now, part for part, flown by the house
 * pilot, who shoots for the core. It wears another paint so the two can be told apart.
 */
export function mirrorEnemy(state: GameState, name: string): EnemyDef {
  return {
    id: 'mirror', name, ai: 'gunner', sprite: 'enemy-rival', composed: true, build: { ...state.build },
    paint: likenessPaint(state.paint),
    // The copy is the pilot's mech as it flies: with the bench's work on it.
    ...(state.tuning && Object.keys(state.tuning).length > 0 ? { tune: { ...state.tuning } } : {}),
  };
}

/** The mirror match in the shape of a contract. */
export function mirrorMission(state: GameState, text: { client: string; win: string; title: string; style: string; taunt: string }): Mission {
  return {
    id: MIRROR_ID, phase: 'patrol', title: text.title, client: text.client,
    briefing: [text.style, `"${text.taunt}"`], debrief: text.win, reward: mirrorPurse(state),
    battles: [{ enemies: ['mirror'], background: 'bg-arena' }], scale: MIRROR_SCALE, ...asRematch(state.stats.mirrors > 0),
  };
}

export function recordMirrorWin(state: GameState): GameState {
  return { ...state, stats: { ...state.stats, mirrors: state.stats.mirrors + 1 } };
}

/**
 * A cup: three opponents of the ladder back to back, with only field service between them. It opens
 * to a pilot who has beaten all three, pays its purse once and a rematch's after, and is kept on record.
 */
export interface Cup {
  /** Begins with `cup-`. */
  id: string;
  /** The ranks of the three opponents, in the order they are fought. */
  ranks: [number, number, number];
  purse: number;
  /**
   * Multiplies the mean strength of its three on the ladder. Measured, not reasoned: three in a row
   * with only field service between is much harder than three apart, and the more so the higher up.
   */
  tune: number;
}
export const CUPS: Cup[] = [
  { id: 'cup-bronze', ranks: [1, 2, 3], purse: 2500, tune: 0.95 },
  { id: 'cup-silver', ranks: [5, 6, 7], purse: 6000, tune: 0.85 },
  { id: 'cup-gold', ranks: [8, 9, 10], purse: 12000, tune: 0.6 },
];

export const isCup = (mission: Mission): boolean => mission.id.startsWith('cup-');
export const cupOpen = (state: GameState, cup: Cup): boolean => state.arenaRank >= cup.ranks[2];
export const cupWon = (state: GameState, cup: Cup): boolean => (state.cups ?? []).includes(cup.id);
export const cupPurse = (state: GameState, cup: Cup): number => (cupWon(state, cup) ? rematchPurse(state, cup.id, cup.purse) : cup.purse);

/** A cup in the shape of a contract of three battles. */
export function cupMission(state: GameState, cup: Cup, ladder: ArenaOpponent[], text: { client: string; win: string; title: string; briefing: (names: string[]) => string[] }): Mission {
  const opponents = cup.ranks.map((rank) => ladder[rank - 1]);
  const scale = Math.round((opponents.reduce((sum, o) => sum + o.scale, 0) / opponents.length) * cup.tune * 100) / 100;
  return {
    id: cup.id, phase: 'patrol', title: text.title, client: text.client, briefing: text.briefing(opponents.map((o) => o.name)), debrief: text.win,
    reward: cupPurse(state, cup), battles: opponents.map((o) => ({ enemies: [o.enemy], background: 'bg-arena' })), scale, ...asRematch(cupWon(state, cup)),
  };
}

export function recordCupWin(state: GameState, cupId: string): GameState {
  return (state.cups ?? []).includes(cupId) ? state : { ...state, cups: [...(state.cups ?? []), cupId] };
}
