import type { Mission } from './campaign';
import type { GameState } from './game';

export const ARENA_RANKS = 10;

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
