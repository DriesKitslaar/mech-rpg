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

/** The share of its flights a build has to win for its odds to be good. */
export const ODDS_GOOD = 0.75;
/**
 * What the opposition is multiplied by when a lost flight is flown again, to find how near it was: a
 * tenth less. That is about what the first two steps of the bench are worth to a machine.
 */
export const NEAR_SCALE = 0.9;

/** What has been counted so far. */
export interface Forecast { played: number; won: number }
/**
 * A count as it stands: what has been counted, and the flight in the air (which battle of the contract
 * it is in, and how that stands). And, for saying how near the lost flights were: which flights were
 * lost, by their number, and how many of them have been flown again against a little less, with how
 * many of those were then won.
 */
export interface Count { tally: Forecast; index: number; state: BattleState | null; lost: number[]; again: { flown: number; turned: number } }

export const newCount = (): Count => ({ tally: { played: 0, won: 0 }, index: 0, state: null, lost: [], again: { flown: 0, turned: 0 } });
/** True once every flight has been flown. */
export const counted = (count: Count): boolean => count.tally.played >= FORECAST_PLAYS;
const good = (tally: Forecast): boolean => tally.won >= tally.played * ODDS_GOOD;
/**
 * True once there is nothing more to work out: the odds are counted, and either they are good (nothing
 * is said then of the few flights lost) or every lost flight has been flown again.
 */
export const neared = (count: Count): boolean => counted(count) && (good(count.tally) || count.again.flown >= count.lost.length);

/** How the lost flights of a count were lost. */
export type Nearness = 'narrow' | 'clear' | 'outmatched';
/**
 * How near, by how many of the lost flights a little less opposition turned: two thirds of them or
 * more, narrowly; a third or more, clearly; fewer, outmatched. Nothing where no flight was lost.
 */
export function nearnessOf(lost: number, turned: number): Nearness | null {
  if (lost <= 0) return null;
  return turned * 3 >= lost * 2 ? 'narrow' : turned * 3 >= lost ? 'clear' : 'outmatched';
}
/** How near the lost flights of a count were: nothing until that is worked out, and nothing where the odds are good. */
export const nearness = (count: Count): Nearness | null =>
  (neared(count) && !good(count.tally) ? nearnessOf(count.lost.length, count.again.turned) : null);

/** The seed of a flight, the first being flight 0: two families of seeds, so that neighbours are not alike. */
export function forecastSeed(flight: number): number {
  const n = flight + 1;
  return n % 2 ? n * 7919 : n * 104729 + 13;
}

/**
 * Moves a count on by at most `steps` steps and returns it as it then stands. One step is one thing
 * done: a battle begun, an action taken in it, or a flight that is over counted. A flight is won
 * when its last battle is; one that loses a battle goes no further.
 *
 * Once every flight is counted, and where the odds are not good, it goes on to fly each lost flight
 * again, whole and from its own seed, against a little less opposition (`NEAR_SCALE`): how many of
 * them that turns is how near they were. The odds themselves do not move by it.
 */
export function advance(count: Count, fight: Fight, mission: Mission, catalog: Catalog, steps = FORECAST_STEPS): Count {
  let { tally, index, state, lost, again } = count;
  const weaker: Fight = { ...fight, opts: { ...fight.opts, enemyScale: (fight.opts.enemyScale ?? 1) * NEAR_SCALE } };
  for (let step = 0; step < steps; step++) {
    const first = tally.played < FORECAST_PLAYS;
    if (!first && (good(tally) || again.flown >= lost.length)) break;
    // The flight in the air, and what it is flown against: one of the twenty as it is, or a lost one again.
    const flight = first ? tally.played : lost[again.flown];
    const flown = first ? fight : weaker;
    if (!state) {
      state = startFight(flown, mission, 0, catalog, forecastSeed(flight));
    } else if (state.outcome === 'ongoing') {
      state = stepBattle(state, catalog, chooseAutoPlayerAction);
    } else if (state.outcome === 'victory' && index + 1 < mission.battles.length) {
      index += 1;
      state = startFight(flown, mission, index, catalog, forecastSeed(flight), state);
    } else {
      const won = state.outcome === 'victory';
      if (first) {
        if (!won) lost = [...lost, flight];
        tally = { played: tally.played + 1, won: tally.won + (won ? 1 : 0) };
      } else again = { flown: again.flown + 1, turned: again.turned + (won ? 1 : 0) };
      index = 0;
      state = null;
    }
  }
  return { tally, index, state, lost, again };
}
