import { reached, type Condition, type Mission } from './campaign';
import type { GameState } from './game';

/**
 * A second pilot for hire. They do not stand on the field: at the start of every round they fire
 * once at the strongest enemy, the way an ally in the story does. They are paid a share of the fee,
 * win or lose nothing: a contract that is lost pays nobody.
 */
export interface Wingman {
  id: string;
  name: string;
  /** A line about them, for the briefing. */
  text: string;
  /** Armour their shot takes off, before the target's guard and cover. */
  damage: number;
  /** The share of the contract's fee they take, from 0 to 1. */
  share: number;
  /** What has to have happened before they take calls. */
  after: Condition;
}

/** Whether this wingman is for hire yet. Once the story has started over, everyone is. */
export const wingmanOpen = (game: GameState, wingman: Wingman, missions: Mission[]): boolean =>
  game.cycle > 0 || reached(game, wingman.after, missions);

/**
 * Whether a second pilot can be brought along at all: not into the arena, where fights are one
 * against one, and not into the simulator.
 */
export const takesWingman = (mission: Mission): boolean =>
  mission.arenaRank === undefined && mission.loaner === undefined && !mission.id.startsWith('arena-') && !mission.id.startsWith('drill-');

/** What the pilot is left with of a fee after the wingman's share. */
export const feeAfter = (reward: number, wingman: Wingman): number => reward - Math.round(reward * wingman.share);

/**
 * The contract as it is flown with a wingman: the fee less their share, and their fire in every
 * battle that has no ally of its own already.
 */
export function withWingman(mission: Mission, wingman: Wingman): Mission {
  if (!takesWingman(mission)) return mission;
  return {
    ...mission,
    reward: feeAfter(mission.reward, wingman),
    battles: mission.battles.map((battle) => (battle.support ? battle : { ...battle, support: { name: wingman.name, damage: wingman.damage } })),
  };
}
