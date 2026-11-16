import type { Mission } from './campaign';
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

/** The full purse for the next opponent, a quarter for a rematch. */
export function arenaPurse(state: GameState, opponent: ArenaOpponent): number {
  return opponent.rank <= state.arenaRank ? Math.round(opponent.purse / 4) : opponent.purse;
}

/** Beating the next opponent in line raises the rank; nothing else does. */
export function recordArenaWin(state: GameState, rank: number): GameState {
  return rank === state.arenaRank + 1 && rank <= ARENA_RANKS ? { ...state, arenaRank: rank } : state;
}

/** An arena fight in the shape of a contract, so it is briefed, fought and settled like one. */
export function arenaMission(state: GameState, opponent: ArenaOpponent, text: { client: string; win: string }): Mission {
  return {
    id: `arena-${opponent.rank}`, phase: 'patrol', title: opponent.name, client: text.client,
    briefing: [opponent.style, `"${opponent.taunt}"`], debrief: text.win, reward: arenaPurse(state, opponent),
    battles: [{ enemies: [opponent.enemy], background: 'bg-arena' }], scale: opponent.scale, arenaRank: opponent.rank,
  };
}

/** The mirror match: a duel against the pilot's own build. It opens at this rank, and pays its purse once and a quarter after. */
export const MIRROR_ID = 'arena-mirror';
export const MIRROR_OPENS = 3;
export const MIRROR_PURSE = 2400;
/** The house tunes its copy a little hotter than the original, so an even fight is not a formality. */
export const MIRROR_SCALE = 1.1;

export const mirrorOpen = (state: GameState): boolean => state.arenaRank >= MIRROR_OPENS;
export const mirrorPurse = (state: GameState): number => (state.stats.mirrors > 0 ? Math.round(MIRROR_PURSE / 4) : MIRROR_PURSE);

/**
 * The opponent of a mirror match: the pilot's build as it is now, part for part, flown by the house
 * pilot, who shoots for the core. It wears another paint so the two can be told apart.
 */
export function mirrorEnemy(state: GameState, name: string): EnemyDef {
  return {
    id: 'mirror', name, ai: 'gunner', sprite: 'enemy-rival', composed: true, build: { ...state.build },
    paint: state.paint === 'obsidian' ? 'bone' : 'obsidian',
  };
}

/** The mirror match in the shape of a contract. */
export function mirrorMission(state: GameState, text: { client: string; win: string; title: string; style: string; taunt: string }): Mission {
  return {
    id: MIRROR_ID, phase: 'patrol', title: text.title, client: text.client,
    briefing: [text.style, `"${text.taunt}"`], debrief: text.win, reward: mirrorPurse(state),
    battles: [{ enemies: ['mirror'], background: 'bg-arena' }], scale: MIRROR_SCALE,
  };
}

export function recordMirrorWin(state: GameState): GameState {
  return { ...state, stats: { ...state.stats, mirrors: state.stats.mirrors + 1 } };
}

/**
 * A cup: three opponents of the ladder back to back, with only field service between them. It opens
 * to a pilot who has beaten all three, pays its purse once and a quarter after, and is kept on record.
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
export const cupPurse = (state: GameState, cup: Cup): number => (cupWon(state, cup) ? Math.round(cup.purse / 4) : cup.purse);

/** A cup in the shape of a contract of three battles. */
export function cupMission(state: GameState, cup: Cup, ladder: ArenaOpponent[], text: { client: string; win: string; title: string; briefing: (names: string[]) => string[] }): Mission {
  const opponents = cup.ranks.map((rank) => ladder[rank - 1]);
  const scale = Math.round((opponents.reduce((sum, o) => sum + o.scale, 0) / opponents.length) * cup.tune * 100) / 100;
  return {
    id: cup.id, phase: 'patrol', title: text.title, client: text.client, briefing: text.briefing(opponents.map((o) => o.name)), debrief: text.win,
    reward: cupPurse(state, cup), battles: opponents.map((o) => ({ enemies: [o.enemy], background: 'bg-arena' })), scale,
  };
}

export function recordCupWin(state: GameState, cupId: string): GameState {
  return (state.cups ?? []).includes(cupId) ? state : { ...state, cups: [...(state.cups ?? []), cupId] };
}
