import { chose, reached, type Condition, type Mission } from './campaign';
import type { GameState } from './game';

/** The moments a wingman has a word to say on the radio: the battle opening, their own kill, the pilot's, the pilot's core getting thin, the battle won. */
export type RadioCue = 'start' | 'kill' | 'cheer' | 'warn' | 'win';
export const RADIO_CUES: RadioCue[] = ['start', 'kill', 'cheer', 'warn', 'win'];

/**
 * A second pilot for hire. They do not stand on the field: at the start of every round they fire
 * once at the strongest enemy, the way an ally in the story does. They are paid a share of the fee,
 * win or lose nothing: a contract that is lost pays nobody.
 */
export interface Wingman {
  id: string;
  name: string;
  /** What they say over the radio during a battle, a short line for each moment. */
  radio: Record<RadioCue, string>;
  /** A line about them, for the briefing. */
  text: string;
  /** Armour their shot takes off, before the target's guard and cover. */
  damage: number;
  /** The share of the contract's fee they take, from 0 to 1. */
  share: number;
  /** What has to have happened before they take calls. */
  after: Condition;
  /** A question of the story that decides how they stand with the pilot. */
  bond?: { choice: string; ally: string; enemy?: string };
}

/** What a friend takes off their share. */
export const ALLY_DISCOUNT = 0.05;
export type Standing = 'ally' | 'enemy' | 'neutral';

/** How a wingman stands with the pilot, from what the pilot decided about them. */
export function standing(game: GameState, wingman: Wingman): Standing {
  const answer = wingman.bond ? chose(game, wingman.bond.choice) : undefined;
  if (answer === undefined || !wingman.bond) return 'neutral';
  return answer === wingman.bond.ally ? 'ally' : answer === wingman.bond.enemy ? 'enemy' : 'neutral';
}

/**
 * The wingman as this pilot can hire them: a friend flies for less, and someone the pilot crossed
 * does not take the call at all. Bonds are made in the story and last as long as that telling of it does.
 */
export function wingmanFor(game: GameState, wingman: Wingman, missions: Mission[]): Wingman | null {
  if (!wingmanOpen(game, wingman, missions)) return null;
  const how = standing(game, wingman);
  if (how === 'enemy') return null;
  return how === 'ally' ? { ...wingman, share: Math.round((wingman.share - ALLY_DISCOUNT) * 100) / 100 } : wingman;
}

/**
 * Whether this wingman is for hire yet. When the story starts over they come back into it as it
 * goes, the way everyone else in it does.
 */
export const wingmanOpen = (game: GameState, wingman: Wingman, missions: Mission[]): boolean => reached(game, wingman.after, missions);

/**
 * Whether a second pilot can be brought along at all: not into the arena or to a duel, where fights
 * are one against one, not into the simulator or in a lent mech, and not on a contract whose every
 * battle already has an ally of the story: there would be nothing for them to do but be paid.
 */
export const takesWingman = (mission: Mission): boolean =>
  mission.arenaRank === undefined && mission.loaner === undefined && !mission.id.startsWith('arena-') && !mission.id.startsWith('cup-') && !mission.id.startsWith('drill-')
  && mission.series !== 'duel'
  && mission.battles.some((battle) => !battle.support);

/** What the pilot is left with of a fee after the wingman's share. Shares are whole percents, so this is exact. */
export const feeAfter = (reward: number, wingman: Wingman): number => reward - Math.round((reward * Math.round(wingman.share * 100)) / 100);

/**
 * The contract as it is flown with a wingman: the fee less their share, and their fire in every
 * battle that has no ally of its own already.
 */
export function withWingman(mission: Mission, wingman: Wingman): Mission {
  if (!takesWingman(mission)) return mission;
  return {
    ...mission,
    reward: feeAfter(mission.reward, wingman),
    battles: mission.battles.map((battle) => (battle.support ? battle : { ...battle, support: { name: wingman.name, damage: wingman.damage, orders: true } })),
  };
}
