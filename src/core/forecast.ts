import { chooseAutoPlayerAction, stepBattle } from './ai';
import type { BattleState } from './battle';
import type { Mission } from './campaign';
import { startFight, type Fight } from './mission';
import type { Catalog } from './types';

/**
 * The odds of a contract: the game's own automatic pilot flies it a number of times in the build
 * that would be taken, and the wins are counted. The flights are always the same flights, so the
 * same build on the same contract always gets the same odds.
 *
 * A flight is too much to work out between two frames on a handheld, so a count is kept as it
 * stands and moved on a few actions at a time.
 */

/** How many times the contract is flown. */
export const FORECAST_PLAYS = 20;
/** How much is worked out in one go: few enough steps that a frame has room for them beside its own work. */
export const FORECAST_STEPS = 8;

/** What has been counted so far. */
export interface Forecast { played: number; won: number }
/** A count as it stands: what has been counted, and the flight in the air (which battle of the contract it is in, and how that stands). */
export interface Count { tally: Forecast; index: number; state: BattleState | null }

export const newCount = (): Count => ({ tally: { played: 0, won: 0 }, index: 0, state: null });
/** True once every flight has been flown. */
export const counted = (count: Count): boolean => count.tally.played >= FORECAST_PLAYS;

/** The seed of a flight, the first being flight 0: two families of seeds, so that neighbours are not alike. */
export function forecastSeed(flight: number): number {
  const n = flight + 1;
  return n % 2 ? n * 7919 : n * 104729 + 13;
}

/**
 * Moves a count on by at most `steps` steps and returns it as it then stands. One step is one thing
 * done: a battle begun, an action taken in it, or a flight that is over counted. A flight is won
 * when its last battle is; one that loses a battle goes no further.
 */
export function advance(count: Count, fight: Fight, mission: Mission, catalog: Catalog, steps = FORECAST_STEPS): Count {
  let { tally, index, state } = count;
  for (let step = 0; step < steps && tally.played < FORECAST_PLAYS; step++) {
    if (!state) {
      state = startFight(fight, mission, 0, catalog, forecastSeed(tally.played));
    } else if (state.outcome === 'ongoing') {
      state = stepBattle(state, catalog, chooseAutoPlayerAction);
    } else if (state.outcome === 'victory' && index + 1 < mission.battles.length) {
      index += 1;
      state = startFight(fight, mission, index, catalog, forecastSeed(tally.played), state);
    } else {
      tally = { played: tally.played + 1, won: tally.won + (state.outcome === 'victory' ? 1 : 0) };
      index = 0;
      state = null;
    }
  }
  return { tally, index, state };
}
