import type { GameState } from './game';

/**
 * A paint of the pilot's own mixing: five things set in a few steps each, and which of the three
 * kept places it is in. Its name as a paint carries all of it (`mix1-14-3-2-13-2`), so whatever is
 * handed a paint can colour a machine with a mix without being told anything else, and a kept game
 * holds a mix as it holds any paint: as a short piece of text.
 *
 * What colours the steps are is the screen's business (ui/paint.ts). Here a mix is only numbers.
 */

/** How many mixes a pilot keeps. */
export const MIX_SLOTS = 3;

/** What a mix sets, and in how many steps: the armour's colour, how strong and how dark it is, the trim's colour and how hard it burns. */
export const MIX_STEPS = { hue: 24, finish: 4, shade: 5, trim: 24, glow: 3 } as const;
export type MixKey = keyof typeof MIX_STEPS;
/** In the order a mix's name has them, and the paint page its rows. */
export const MIX_KEYS: MixKey[] = ['hue', 'finish', 'shade', 'trim', 'glow'];

export interface Mix { slot: number; hue: number; finish: number; shade: number; trim: number; glow: number }

/** A mix's name as a paint: the place it is kept in, then its five steps. */
export const mixId = (mix: Mix): string => `mix${mix.slot}-${MIX_KEYS.map((key) => mix[key]).join('-')}`;

/**
 * The shape of such a name, whatever its numbers. A kept game may hold a name of this shape where
 * it holds a paint: one that turns out to be no mix (a step a later version might add) is worn as
 * factory colours are, and the game is not refused for it.
 */
export const MIX_SHAPE = /^mix\d(-\d{1,2}){5}$/;

/** The mix a name stands for: null for a name that is none, with a step out of its range, a place there is not, or not written as `mixId` writes it. */
export function parseMix(name: unknown): Mix | null {
  if (typeof name !== 'string' || !MIX_SHAPE.test(name)) return null;
  const [slot, hue, finish, shade, trim, glow] = name.slice(3).split('-').map(Number);
  const mix: Mix = { slot, hue, finish, shade, trim, glow };
  const there = slot >= 1 && slot <= MIX_SLOTS && MIX_KEYS.every((key) => mix[key] < MIX_STEPS[key]);
  return there && mixId(mix) === name ? mix : null;
}

export const isMix = (paint: unknown): boolean => parseMix(paint) !== null;

/** The three as they come, until the pilot changes them: a white machine with cyan lights, a black one with red, and navy with gold. */
export const DEFAULT_MIXES: Mix[] = [
  { slot: 1, hue: 14, finish: 0, shade: 0, trim: 13, glow: 2 },
  { slot: 2, hue: 16, finish: 0, shade: 4, trim: 0, glow: 2 },
  { slot: 3, hue: 14, finish: 2, shade: 3, trim: 3, glow: 2 },
];

/** The pilot's three mixes: what the game keeps for each place where that is a mix of that place, and the mix as it comes where it is not. */
export function mixesOf(state: Pick<GameState, 'mixes'>): Mix[] {
  const kept: unknown[] = Array.isArray(state.mixes) ? state.mixes : [];
  return DEFAULT_MIXES.map((standard, i) => {
    const mix = parseMix(kept[i]);
    return mix && mix.slot === standard.slot ? mix : standard;
  });
}

/** The mix with one of its five things a step on, or back: past the last step is the first again. */
export function stepMix(mix: Mix, key: MixKey, step: number): Mix {
  const steps = MIX_STEPS[key];
  return { ...mix, [key]: (((mix[key] + step) % steps) + steps) % steps };
}

/** Keeps a mix in its place and puts it on the machine. The other two are kept as they are. */
export function setMix(state: GameState, mix: Mix): GameState {
  if (!isMix(mixId(mix))) throw new Error('not a mix');
  return { ...state, mixes: mixesOf(state).map((kept) => mixId(kept.slot === mix.slot ? mix : kept)), paint: mixId(mix) };
}

/**
 * The paint a copy of the pilot's own machine wears when the two meet (the arena's mirror, a spar
 * with a saved build), so that they can be told apart: obsidian, and bone where the pilot's own is
 * obsidian or a mix of one of the two darkest shades.
 */
export function likenessPaint(paint: string): string {
  const mix = parseMix(paint);
  return paint === 'obsidian' || (mix !== null && mix.shade >= MIX_STEPS.shade - 2) ? 'bone' : 'obsidian';
}
