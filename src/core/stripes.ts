import { ARCHETYPES, wonAs, type Archetype } from './archetype';
import type { Mission } from './campaign';
import type { GameState } from './game';

/**
 * Stripes: what a pilot has won as each class, read as something earned. A class gives a stripe at
 * so many contracts won flying it, up to three, and every fifth stripe a pilot holds, of whatever
 * classes, is a perk point. Nothing is kept for it: the record of what was won as each class is
 * there already, and the stripes are read off it. So a stripe once earned is never lost (the record
 * only grows), and a game from before there were stripes has the ones it has earned.
 *
 * A stripe gives nothing in a fight by itself. That was tried first (each class adding to one of the
 * pilot's skills in every machine) and measured: a veteran with every stripe beat the masters of
 * artillery and of the lancers every time, who are set to be beaten half the time. A perk point
 * keeps a pilot inside what the game is measured for: the most there is to have is every perk.
 */

/** The contracts won as a class at which it gives its first stripe, its second and its third. */
export const STRIPES_AT = [3, 8, 15] as const;
export const MAX_STRIPES = STRIPES_AT.length;
/** The most stripes there are to hold. */
export const ALL_STRIPES = ARCHETYPES.length * MAX_STRIPES;
/** How many stripes make a perk point. */
export const STRIPES_A_POINT = 5;
/** The most perk points stripes can bring. */
export const MAX_STRIPE_POINTS = Math.floor(ALL_STRIPES / STRIPES_A_POINT);

type Record = Pick<GameState, 'wonAs'>;

/** How many stripes a class has given the pilot. */
export const stripesOf = (game: Record, kind: Archetype): number => STRIPES_AT.filter((at) => wonAs(game, kind) >= at).length;

/** The contracts won as a class at which it gives its next stripe: null for a class that has given all three. */
export const nextStripeAt = (game: Record, kind: Archetype): number | null => STRIPES_AT[stripesOf(game, kind)] ?? null;

/** Every stripe the pilot holds, of every class. */
export const stripesHeld = (game: Record): number => ARCHETYPES.reduce((sum, kind) => sum + stripesOf(game, kind), 0);

/** The perk points the pilot's stripes have brought: one for every five held. */
export const stripePoints = (game: Record): number => Math.floor(stripesHeld(game) / STRIPES_A_POINT);

/** How many stripes the pilot must hold for the next perk point: null once stripes have brought all the points they can. */
export function nextPointAt(game: Record): number | null {
  const points = stripePoints(game);
  return points >= MAX_STRIPE_POINTS ? null : (points + 1) * STRIPES_A_POINT;
}

/** Where a win is no contract won: the simulator's drills and its range, and a floor of the Gauntlet. */
const UNCOUNTED = ['drill-', 'range-', 'gauntlet-'];

/**
 * Whether winning this counts for the class of the build it is flown in, and so towards that
 * class's stripes: anything flown in a build of the pilot's own, but the simulator's fights and a
 * floor of the Gauntlet. A machine that was lent is nobody's class.
 */
export const countsForClass = (mission: Pick<Mission, 'id' | 'loaner'>): boolean =>
  mission.loaner === undefined && !UNCOUNTED.some((prefix) => mission.id.startsWith(prefix));

/**
 * Whether winning this is a win for the class of the build it is flown in, towards that class's
 * stripes: a contract flown in the pilot's own build, and a bout of the arena the first time it is
 * won. A rematch is flown as a class (a crown can be taken in one) and is no win for it.
 */
export const earnsStripes = (mission: Pick<Mission, 'id' | 'loaner' | 'rematch'>): boolean => countsForClass(mission) && mission.rematch !== true;

/** A stripe that was earned: whose it is, which of the class's three, and whether it was the one that brought a perk point. */
export interface Earned { kind: Archetype; stripe: number; point: boolean }

/**
 * The stripes held after that were not held before: in the order of the classes, a class's lower
 * stripe first. They are counted onto what was held before in that order, and the one that makes
 * the count a multiple of five is the one that brings the point. (There is no fifth point to bring:
 * the count cannot pass twenty-one.)
 */
export function stripesEarned(before: Record, after: Record): Earned[] {
  let held = stripesHeld(before);
  return ARCHETYPES.flatMap((kind) => {
    const [had, has] = [stripesOf(before, kind), stripesOf(after, kind)];
    return Array.from({ length: Math.max(0, has - had) }, (_, i) => {
      held += 1;
      return { kind, stripe: had + i + 1, point: held % STRIPES_A_POINT === 0 };
    });
  });
}
