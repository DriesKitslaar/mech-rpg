import { CLASS_AI, archetypeOf } from './archetype';
import { MIRROR_SCALE } from './arena';
import { MAX_ENEMIES } from './battle';
import { MECH_ENEMIES, STORY_ENEMIES } from './board';
import { validatePlayerBuild } from './build';
import type { Mission } from './campaign';
import type { Settlement } from './economy';
import { LOADOUT_SLOTS, checkLoadout, type GameState } from './game';
import { tunedCatalog } from './tuning';
import type { Catalog, EnemyDef } from './types';

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

/**
 * Sparring: one of the pilot's own saved builds as the opponent. A spar is a fight on the range like
 * the others, against a machine made of that build's parts and flown by the game.
 */

/** The id of the opponent made from the saved build in a slot, as a battle fields it. */
export const SPAR_ENEMY = (slot: number): string => `spar-${slot}`;
/** The id of a spar with the saved build in a slot. */
export const sparId = (slot: number): string => `${PREFIX}spar-${slot}`;
/** The slot a spar's id names: one of the places a build can be kept in. Null for anything that is not such an id. */
export function parseSpar(id: string): number | null {
  const found = /^range-spar-(\d)$/.exec(id);
  return found && Number(found[1]) < LOADOUT_SLOTS ? Number(found[1]) : null;
}

/**
 * The saved builds that can be sparred with, by slot: those that are there, whose parts are all still
 * owned, and that may deploy as the garage reads them, with the bench's work counted. The build the
 * pilot is flying is one of them when it is saved: sparring with it is a mirror match.
 */
export function sparSlots(game: GameState, catalog: Catalog): number[] {
  const tuned = tunedCatalog(catalog, game.tuning);
  return game.loadouts.flatMap((build, slot) => (build && checkLoadout(game, slot, tuned) === null && validatePlayerBuild(build, tuned).length === 0 ? [slot] : []));
}

/** The saved build in a slot as an opponent: that build part for part, with the bench's work on it, in colours that are not the pilot's, flown as its class is. */
export function sparEnemy(game: GameState, slot: number, name: string, catalog: Catalog): EnemyDef {
  const build = { ...game.loadouts[slot]! };
  return {
    id: SPAR_ENEMY(slot), name, ai: CLASS_AI[archetypeOf(build, catalog)], sprite: 'enemy-rival', composed: true, build,
    paint: game.paint === 'obsidian' ? 'bone' : 'obsidian',
    ...(game.tuning && Object.keys(game.tuning).length > 0 ? { tune: { ...game.tuning } } : {}),
  };
}

/** The words a spar is written with. */
export interface SparText {
  title: string;
  client: string;
  /** Which saved build is flown against the pilot, by the number the garage gives it. */
  briefing: (slot: number) => string;
  free: string;
  debrief: string;
}

/** A spar as a contract: one fight in the hall against the saved build of that slot, scaled as a mirror match is, for no pay. */
export function sparMission(slot: number, text: SparText): Mission {
  return {
    id: sparId(slot), phase: 'patrol', title: text.title, client: text.client,
    briefing: [text.briefing(slot + 1), text.free], debrief: text.debrief, reward: 0, scale: MIRROR_SCALE,
    battles: [{ enemies: [SPAR_ENEMY(slot)], background: RANGE_HALL }],
  };
}
