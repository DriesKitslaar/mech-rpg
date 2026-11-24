import type { Battle, Mission } from './campaign';
import type { Settlement } from './economy';
import type { GameState } from './game';
import { MAX_COUNT } from './kept';

/**
 * The terms an open contract can be taken on. A pilot may raise them: the opposition grows by a
 * factor, the fee is paid as many times over, and what there is to gain by it is staked as a bond,
 * lost with the contract. Standard is the contract as it was offered. Only the pilot raises them:
 * nothing in the game ever does.
 *
 * (The screen calls them terms. Here they are stakes: `Terms` is what the pilot's perks do to a bill.)
 */

/** What each level multiplies the opposition and the fee by: Standard, Hazard, Severe, Ruinous. */
export const STAKES: readonly number[] = [1, 1.5, 2, 3];
/** The highest level there is. */
export const TOP_STAKE = STAKES.length - 1;

/** True of a level above Standard that there is. */
const raised = (level: number): boolean => Number.isInteger(level) && level >= 1 && level <= TOP_STAKE;

/**
 * Whether a contract takes terms: one of the open board's own (its three, its job and its swarm). An
 * account's notice stands on the board and has terms of its own; in a lent mech nothing is the pilot's to stake.
 */
export const takesStake = (mission: Pick<Mission, 'id' | 'grudge' | 'loaner'>): boolean =>
  mission.id.startsWith('open-') && mission.grudge === undefined && mission.loaner === undefined;

/** The bond of a level on a fee: what the terms add to the fee, which is what there is to gain. Nothing at Standard. */
export const bondFor = (fee: number, level: number): number => (raised(level) ? Math.round(fee * (STAKES[level] - 1)) : 0);

export type StakeRefusal = 'none' | 'bond';

/** Why a contract cannot be taken on these terms by this pilot; null when it can. Standard is always open. */
export function checkStake(game: Pick<GameState, 'credits'>, mission: Mission, level: number): StakeRefusal | null {
  if (level === 0) return null;
  if (!raised(level) || !takesStake(mission)) return 'none';
  return game.credits >= bondFor(mission.reward, level) ? null : 'bond';
}

/**
 * A contract as it is flown on these terms: the same contract against more. Its scale is multiplied,
 * armour and damage both; what it asks to be protected grows sturdier by as much, as it does in a
 * later telling and for the reason given there (freight loses armour by the head of enemy standing,
 * and tougher enemies stand longer); and it carries what is staked. The fee stays the fee: what the
 * terms pay is paid beside it. Standard, a level there is none of, and a contract that takes no terms
 * are the contract handed in.
 */
export function staked(mission: Mission, level: number): Mission {
  if (!raised(level) || !takesStake(mission)) return mission;
  const factor = STAKES[level];
  const grown = (battle: Battle): Battle => (battle.objective?.type === 'protect'
    ? { ...battle, objective: { ...battle.objective, hp: Math.ceil(battle.objective.hp * factor) } } : battle);
  return {
    ...mission,
    scale: Math.round((mission.scale ?? 1) * factor * 100) / 100,
    battles: mission.battles.map(grown),
    stake: { level, amount: bondFor(mission.reward, level) },
  };
}

/** The bill of a contract flown on raised terms: won, the hazard pay beside the fee; lost, the bond. Any other bill is the bill handed in. */
export function stakeSettlement(settlement: Settlement, mission: Pick<Mission, 'stake'>): Settlement {
  const stake = mission.stake;
  if (!stake) return settlement;
  return settlement.won
    ? { ...settlement, hazard: { level: stake.level, pay: stake.amount }, net: settlement.net + stake.amount }
    : { ...settlement, bond: { level: stake.level, lost: stake.amount }, net: settlement.net - stake.amount };
}

type Kept = Pick<GameState, 'raised'>;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
/** The wins on raised terms as a kept game has them: three whole counts, or none at all. */
const counts = (game: Kept): number[] => (Array.isArray(game.raised) && game.raised.length === TOP_STAKE && game.raised.every(isCount) ? game.raised : [0, 0, 0]);

/** How many contracts the pilot has won on the terms of a level. */
export const raisedAt = (game: Kept, level: number): number => (raised(level) ? counts(game)[level - 1] : 0);
/** How many contracts the pilot has won on raised terms of any level. */
export const raisedWon = (game: Kept): number => counts(game).reduce((sum, count) => sum + count, 0);

/** Writes down a contract won on raised terms. Standard is not one. */
export function recordRaised<T extends Kept>(game: T, level: number): T {
  if (!raised(level)) return game;
  return { ...game, raised: counts(game).map((count, i) => (i === level - 1 ? Math.min(MAX_COUNT, count + 1) : count)) };
}

/**
 * Takes the bond of a contract that was left in the air: a game kept with one staked was closed
 * before the contract was booked, and a contract walked away from is lost. Nothing is taken, and the
 * game is the game handed in, where nothing is staked; what is staked is read with care.
 */
export function forfeit<T extends Pick<GameState, 'credits' | 'atStake'>>(game: T): { game: T; lost: number } {
  if (!Object.hasOwn(game, 'atStake')) return { game, lost: 0 };
  const { atStake, ...rest } = game;
  const lost = isCount(atStake) && atStake > 0 ? atStake : 0;
  return { game: { ...rest, credits: game.credits - lost } as T, lost };
}
