import { MAX_ENEMIES } from './battle';
import { MECH_ENEMIES, STORY_ENEMIES } from './board';
import type { Mission } from './campaign';
import type { Settlement } from './economy';
import type { GameState } from './game';

/**
 * The range: a page of the simulator where the pilot's own build is flown against any machine met,
 * for nothing. A fight on it is a contract made on the spot, so that it is briefed and fought like
 * any other; what sets it apart is that nothing of it is billed, paid or counted.
 */

/** As many of one machine as the field holds. */
export const RANGE_MAX = MAX_ENEMIES;
/** Where it is fought: the simulator's hall, as every drill is. */
export const RANGE_HALL = 'bg-simulator';

const PREFIX = 'range-';
/** A fight on the range is known by its id. It is not a drill: no mech is lent for it. */
export const isRange = (mission: Pick<Mission, 'id'>): boolean => mission.id.startsWith(PREFIX);

/** How many of a kind can be fielded at once: one of a mech or of anything that belongs to the story, as many as the field holds of the rest. */
export const rangeLimit = (kind: string): number => (MECH_ENEMIES.includes(kind) || STORY_ENEMIES.includes(kind) ? 1 : RANGE_MAX);

/** The kinds of machine that can be fought: those of `order` (the database's list) that the pilot has met. */
export const rangeKinds = (game: Pick<GameState, 'met'>, order: string[]): string[] => order.filter((kind) => game.met.includes(kind));

/** The id of a fight against so many of a kind. */
export const rangeId = (kind: string, count: number): string => `${PREFIX}${count}-${kind}`;
/** What a range fight's id says: how many of what. Null for anything that is not such an id. */
export function parseRange(id: string): { kind: string; count: number } | null {
  const found = /^range-([1-9])-(.+)$/.exec(id);
  const count = found ? Number(found[1]) : 0;
  return found && count <= RANGE_MAX ? { kind: found[2], count } : null;
}

/** The words a fight on the range is written with. */
export interface RangeText {
  title: string;
  client: string;
  /** What is fielded: the machine's name and how many. */
  briefing: (name: string, count: number) => string;
  /** That nothing is billed, paid or counted. */
  free: string;
  debrief: string;
}

/** The fight as a contract: one battle in the hall against so many of the machine, never more than may be fielded, as the book has it and for no pay. */
export function rangeMission(kind: string, count: number, name: string, text: RangeText): Mission {
  const fielded = Math.max(1, Math.min(rangeLimit(kind), Math.floor(count)));
  return {
    id: rangeId(kind, fielded), phase: 'patrol', title: text.title, client: text.client,
    briefing: [text.briefing(name, fielded), text.free], debrief: text.debrief, reward: 0, scale: 1,
    battles: [{ enemies: Array.from({ length: fielded }, () => kind), background: RANGE_HALL }],
  };
}

/** The bill of a range fight: what a real flight would have cost, marked as a bill that is shown and not booked. */
export const rangeSettlement = (bill: Settlement): Settlement => ({ ...bill, simulated: true });
