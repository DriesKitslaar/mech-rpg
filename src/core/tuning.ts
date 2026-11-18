import type { GameState } from './game';
import type { Catalog, FramePart, Generator, Part, Weapon } from './types';

/**
 * The bench: credits turned into better parts, a step at a time. A step adds a twentieth of what
 * the part is for (armour to a frame part, damage to a weapon, output to a generator) and costs
 * its number times the part's price. The work is on the model, not the copy: it is written down
 * against the part's id, so it is still there when the part is sold and bought again, and when the
 * story starts over. How far the bench goes grows with the telling.
 */
export const TUNE_STEP = 0.05;
/** The furthest the bench ever goes. */
export const TUNE_MAX = 5;
/** How far the bench goes in a cycle: two steps in the first, one further with every cycle after it. */
export const tuneCap = (cycle: number): number => Math.min(TUNE_MAX, 2 + Math.max(0, cycle));

/** Bench work: the step each part stands at, by part id. A part that is not named has had none. */
export type Tuning = Record<string, number>;
/** The most parts a record of bench work may name: more than any catalogue has parts to tune. */
export const MAX_TUNED = 256;

const FRAME_KINDS: Part['kind'][] = ['head', 'core', 'arms', 'legs'];
/** The bench takes what carries armour, what does damage and what makes power; not what only steers, boosts, shields or has a button. */
export const tunable = (part: Part): part is FramePart | Weapon | Generator =>
  FRAME_KINDS.includes(part.kind) || part.kind === 'weapon' || part.kind === 'generator';

/** The step a part stands at: a whole number from none to five, whatever the record holds. */
export function stepOf(tuning: Tuning | undefined, id: string): number {
  if (!tuning || !Object.hasOwn(tuning, id)) return 0;
  const step = Math.floor(tuning[id]);
  return Number.isFinite(step) ? Math.min(TUNE_MAX, Math.max(0, step)) : 0;
}

/** What the bench's work multiplies a part's armour or damage by. */
export const tuneFactor = (tuning: Tuning | undefined, id: string): number => 1 + TUNE_STEP * stepOf(tuning, id);
/** What a tuned generator adds to its output. */
export const tunedOutput = (generator: Generator, step: number): number => Math.round(generator.output * TUNE_STEP * step);
/** What the bench asks to take a part to this step from the one before. */
export const tuneCost = (part: Part, step: number): number => part.price * step;

export type TuneRefusal = 'unknown' | 'notTunable' | 'notOwned' | 'limit' | 'credits';

/** Why the bench will not take a part one step further now; null when it will. */
export function checkTune(state: GameState, id: string, catalog: Catalog): TuneRefusal | null {
  const part = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
  if (!part) return 'unknown';
  if (!tunable(part)) return 'notTunable';
  if (!Object.hasOwn(state.inventory, id) || state.inventory[id] <= 0) return 'notOwned';
  const next = stepOf(state.tuning, id) + 1;
  if (next > tuneCap(state.cycle)) return 'limit';
  return state.credits < tuneCost(part, next) ? 'credits' : null;
}

/** Takes a part one step further and pays for it. */
export function tune(state: GameState, id: string, catalog: Catalog): GameState {
  const refusal = checkTune(state, id, catalog);
  if (refusal) throw new Error(`the bench refuses: ${refusal}`);
  const next = stepOf(state.tuning, id) + 1;
  return { ...state, credits: state.credits - tuneCost(catalog[id], next), tuning: { ...(state.tuning ?? {}), [id]: next } };
}

/**
 * A part as the bench left it, for a list or a panel to show: the armour of a frame part, the
 * damage of a weapon (to a tenth) or the output of a generator, with the steps counted in. A
 * battle does not read these: it works from the part as made and the steps (see battle.ts), so
 * that an enemy carrying the same part is not tuned with it.
 */
export function tunedPart<P extends Part>(part: P, step: number): P {
  if (step <= 0 || !tunable(part)) return part;
  const factor = 1 + TUNE_STEP * step;
  if (part.kind === 'weapon') return { ...part, damage: Math.round(part.damage * factor * 10) / 10 };
  if (part.kind === 'generator') return { ...part, output: part.output + tunedOutput(part, step) };
  return { ...part, ap: Math.round(part.ap * factor) };
}

/** The catalogue as a pilot's garage reads it: the same ids, the parts worked on as they now are. */
export function tunedCatalog(catalog: Catalog, tuning: Tuning | undefined): Catalog {
  const worked = Object.keys(tuning ?? {}).filter((id) => Object.hasOwn(catalog, id) && stepOf(tuning, id) > 0);
  if (worked.length === 0) return catalog;
  return { ...catalog, ...Object.fromEntries(worked.map((id) => [id, tunedPart(catalog[id], stepOf(tuning, id))])) };
}
