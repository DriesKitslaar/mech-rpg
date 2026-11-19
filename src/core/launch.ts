import type { Mission } from './campaign';

/**
 * A contract flown from the hangar opens with a launch: the pilot's own machine leaving the
 * catapult. These are the rules of it, which the screen that shows it asks.
 */

/** What a contract's id begins with where it is no flight from the hangar: the arena's fights, the simulator's, a floor of the Gauntlet. */
const ELSEWHERE = ['arena-', 'cup-', 'drill-', 'range-', 'gauntlet-'];

/**
 * Whether a contract opens with a launch: one flown in the pilot's own machine, from the hangar. Not
 * a fight in the arena (the pilot stands in the pit already), nothing of the simulator's (a drill,
 * the range), no floor of the Gauntlet, and nothing flown in a lent machine.
 */
export const launches = (mission: Pick<Mission, 'id' | 'arenaRank' | 'loaner'>): boolean =>
  mission.loaner === undefined && mission.arenaRank === undefined && !ELSEWHERE.some((prefix) => mission.id.startsWith(prefix));

/** The weights between which a machine's launch grows heavier, and how long the handheld rumbles at each end, in milliseconds. */
export const LAUNCH_WEIGHT = { light: 700, heavy: 1700 } as const;
export const LAUNCH_RUMBLE = { light: 60, heavy: 160 } as const;

/** How long the handheld rumbles as a machine of this weight leaves the catapult: longer for a heavier one. */
export function launchRumble(weight: number): number {
  const share = Math.max(0, Math.min(1, (weight - LAUNCH_WEIGHT.light) / (LAUNCH_WEIGHT.heavy - LAUNCH_WEIGHT.light)));
  return Math.round(LAUNCH_RUMBLE.light + share * (LAUNCH_RUMBLE.heavy - LAUNCH_RUMBLE.light));
}
