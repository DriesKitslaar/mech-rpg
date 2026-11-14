import { REPAIRS_PER_MISSION, type BattleState } from './battle';
import type { Battle, Mission } from './campaign';
import type { Settlement } from './economy';
import { RANKS, type GameState, type Rank } from './game';

export { RANKS, type Rank } from './game';

/** Share of the fee a rank adds to it. */
export const RANK_BONUS: Record<Rank, number> = { S: 0.25, A: 0.1, B: 0, C: 0, D: 0 };
/** The lowest score that earns each rank; anything lower is a D. */
const FLOOR: [Rank, number][] = [['S', 88], ['A', 72], ['B', 55], ['C', 35]];
export const OVER_PAR_PENALTY = 5;
export const ARMOUR_PENALTY = 70;
export const REPAIR_PENALTY = 4;

/** What a contract is judged on. */
export interface Performance {
  /** Rounds fought, over all its battles. */
  rounds: number;
  par: number;
  /** Share of the mech's armour missing at the end, 0 to 1. */
  armourLost: number;
  /** Field repairs used. */
  repairs: number;
}

/** Rounds a good pilot needs for a battle: what it says, else the time it has to be outlasted, else 3 plus 2 an enemy. */
export function parOf(battle: Battle): number {
  if (battle.par !== undefined) return battle.par;
  return battle.objective?.type === 'survive' ? battle.objective.rounds : 3 + 2 * battle.enemies.length;
}

export function missionPar(mission: Pick<Mission, 'battles'>): number {
  return mission.battles.reduce((sum, battle) => sum + parOf(battle), 0);
}

/** 100 for a contract done in time, unscratched, without field repairs; less for each of those it was not. */
export function scoreOf(p: Performance): number {
  const score = 100 - OVER_PAR_PENALTY * Math.max(0, p.rounds - p.par) - ARMOUR_PENALTY * p.armourLost - REPAIR_PENALTY * p.repairs;
  return Math.max(0, score);
}

export function rankFor(score: number): Rank {
  return FLOOR.find(([, floor]) => score >= floor)?.[0] ?? 'D';
}

export function betterRank(a: Rank | undefined, b: Rank): Rank {
  return a !== undefined && RANKS.indexOf(a) <= RANKS.indexOf(b) ? a : b;
}

/**
 * How the player did, read off the last battle of a contract. `rounds` is the total fought over
 * all its battles and `par` the contract's par.
 */
export function performanceOf(last: BattleState, rounds: number, par: number): Performance {
  const player = last.units[0];
  const parts = Object.values(player.parts);
  const left = parts.reduce((sum, part) => sum + part!.ap, 0);
  const full = parts.reduce((sum, part) => sum + part!.maxAp, 0);
  return {
    rounds, par,
    armourLost: full > 0 ? 1 - left / full : 0,
    repairs: Math.max(0, REPAIRS_PER_MISSION + player.mods.repairs - player.repairsLeft),
  };
}

/** Adds the rank and what it pays to the settlement of a won contract. A lost one is returned as it is. */
export function rankSettlement(settlement: Settlement, performance: Performance): Settlement {
  if (!settlement.won) return settlement;
  const score = scoreOf(performance);
  const rank = rankFor(score);
  const bonus = Math.round(settlement.reward * RANK_BONUS[rank]);
  return { ...settlement, rank, score, bonus, net: settlement.net + bonus };
}

/** Keeps the rank if it beats the one saved for the contract. */
export function recordRank(state: GameState, missionId: string, rank: Rank): GameState {
  const saved = Object.hasOwn(state.ranks, missionId) ? state.ranks[missionId] : undefined;
  const best = betterRank(saved, rank);
  return best === saved ? state : { ...state, ranks: { ...state.ranks, [missionId]: best } };
}
