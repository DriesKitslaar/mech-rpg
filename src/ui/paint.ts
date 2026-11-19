/**
 * Paint: recolouring a mech's frame layers at load time, so one set of drawings serves every
 * colour scheme. Pure pixel arithmetic; the sprite store applies it and the art pipeline uses
 * `analyse` to record, per family, what is armour and what is trim.
 */
import type { Archetype } from '../core/archetype';
import type { GameState } from '../core/game';
import { crownHeld } from '../core/masters';
import { MIX_STEPS, mixId, mixesOf, parseMix, type Mix, type MixKey } from '../core/mix';
import { seatHeld } from '../core/seat';

export type RGB = [number, number, number];

/** What the recolouring needs to know about the family a layer was cut from. */
export interface PaintInfo {
  /** Hue buckets (of twelve) that are lights and trim rather than armour. */
  accent: number[];
  /** Brightness of the armour, 0..1: near its darkest, its middle and near its lightest. */
  lo: number;
  mid: number;
  hi: number;
}

export interface PaintScheme {
  id: string;
  name: string;
  /** Hue (degrees) and saturation (0..1) of the armour. */
  hue: number;
  sat: number;
  /** Hue and saturation of lights and trim. */
  accentHue: number;
  accentSat: number;
  /** Shifts the whole ramp darker (positive) or lighter (negative). */
  shade?: number;
}

/** The id that means "as drawn": no recolouring. */
export const FACTORY = 'factory';

export const PAINTS: PaintScheme[] = [
  { id: 'crimson', name: 'Crimson', hue: 355, sat: 0.72, accentHue: 45, accentSat: 0.95 },
  { id: 'cobalt', name: 'Cobalt', hue: 218, sat: 0.7, accentHue: 185, accentSat: 0.9 },
  { id: 'viridian', name: 'Viridian', hue: 150, sat: 0.55, accentHue: 38, accentSat: 0.95 },
  { id: 'bone', name: 'Bone', hue: 42, sat: 0.22, accentHue: 5, accentSat: 0.85, shade: -0.12 },
  { id: 'obsidian', name: 'Obsidian', hue: 260, sat: 0.18, accentHue: 320, accentSat: 0.95, shade: 0.1 },
  { id: 'sunburst', name: 'Sunburst', hue: 32, sat: 0.9, accentHue: 200, accentSat: 0.85 },
  { id: 'royal', name: 'Royal', hue: 275, sat: 0.6, accentHue: 48, accentSat: 0.95 },
  { id: 'desert', name: 'Desert', hue: 36, sat: 0.38, accentHue: 172, accentSat: 0.7 },
  { id: 'steel', name: 'Steel', hue: 215, sat: 0.12, accentHue: 22, accentSat: 0.95, shade: -0.04 },
  { id: 'rose', name: 'Rose', hue: 335, sat: 0.6, accentHue: 190, accentSat: 0.6 },
  { id: 'toxic', name: 'Toxic', hue: 88, sat: 0.75, accentHue: 285, accentSat: 0.8 },
  { id: 'midnight', name: 'Midnight', hue: 232, sat: 0.55, accentHue: 40, accentSat: 0.95, shade: 0.08 },
];

/**
 * The paints of the arena's masters, one a class: each is worn by the master of that class, and after
 * them only by the pilot who holds that class's crown. They are no part of `PAINTS`, which anyone may wear.
 */
export const CROWN_PAINTS: (PaintScheme & { crown: Archetype })[] = [
  { id: 'mercury', name: 'Mercury', crown: 'duellist', hue: 205, sat: 0.1, accentHue: 275, accentSat: 0.85, shade: -0.16 },
  { id: 'abyss', name: 'Abyss', crown: 'marksman', hue: 245, sat: 0.5, accentHue: 150, accentSat: 0.85, shade: 0.1 },
  { id: 'brass', name: 'Brass', crown: 'artillery', hue: 46, sat: 0.6, accentHue: 172, accentSat: 0.8, shade: 0.02 },
  { id: 'ultraviolet', name: 'Ultraviolet', crown: 'lancer', hue: 302, sat: 0.72, accentHue: 182, accentSat: 0.95 },
  { id: 'basalt', name: 'Basalt', crown: 'bastion', hue: 18, sat: 0.2, accentHue: 40, accentSat: 0.95, shade: 0.1 },
  { id: 'kingfisher', name: 'Kingfisher', crown: 'skirmisher', hue: 194, sat: 0.62, accentHue: 28, accentSat: 0.95, shade: -0.08 },
  { id: 'patina', name: 'Patina', crown: 'allrounder', hue: 176, sat: 0.42, accentHue: 22, accentSat: 0.85, shade: 0.03 },
];

/**
 * The paint of the keeper of the eighth seat: black as the stone they are named for, with the streak gold
 * leaves on it. Worn by the keeper, and after them only by the pilot who has taken the seat.
 */
export const SEAT_PAINT: PaintScheme = { id: 'touchstone', name: 'Touchstone', hue: 240, sat: 0.05, accentHue: 46, accentSat: 0.9, shade: 0.22 };

/**
 * What the steps of a mix of the pilot's own are (see core/mix.ts): how strong the armour's colour is,
 * from steel that has hardly any to vivid; how light or dark it is, from pale to deep; and how hard the
 * lights and trim burn. None goes further than a ready paint already does, so a mixed machine reads in
 * a fight as the ready ones do. The colours themselves go round the wheel in equal steps.
 */
export const MIX_FINISH = [0.08, 0.3, 0.55, 0.8];
export const MIX_SHADE = [-0.16, -0.08, 0, 0.1, 0.2];
export const MIX_GLOW = [0.6, 0.8, 0.95];
const HUE_STEP = 360 / MIX_STEPS.hue;

/** A mix as a scheme: it goes by its own name as a paint, and is called by the place it is kept in. */
export function schemeOfMix(mix: Mix): PaintScheme {
  return {
    id: mixId(mix), name: `Mix ${mix.slot}`, hue: mix.hue * HUE_STEP, sat: MIX_FINISH[mix.finish],
    accentHue: mix.trim * HUE_STEP, accentSat: MIX_GLOW[mix.glow], shade: MIX_SHADE[mix.shade],
  };
}

/**
 * The paints a pilot may wear, in the order the garage steps through them: factory colours, the
 * schemes anyone may wear, after them the paint of each crown the pilot holds, the keeper's for the
 * pilot who has taken the eighth seat, and last the pilot's own three mixes.
 */
export const paintsFor = (state: Pick<GameState, 'crowns' | 'seat' | 'mixes'>): string[] => [
  FACTORY, ...PAINTS.map((paint) => paint.id), ...CROWN_PAINTS.filter((paint) => crownHeld(state, paint.crown)).map((paint) => paint.id),
  ...(seatHeld(state) ? [SEAT_PAINT.id] : []), ...mixesOf(state).map(mixId),
];

/** A paint by its name: a ready one, or a mix, whose name says what it is. */
export function paintById(id: string): PaintScheme | undefined {
  const ready = PAINTS.find((p) => p.id === id) ?? CROWN_PAINTS.find((p) => p.id === id) ?? (id === SEAT_PAINT.id ? SEAT_PAINT : undefined);
  if (ready) return ready;
  const mix = parseMix(id);
  return mix ? schemeOfMix(mix) : undefined;
}

/** Hue in degrees, saturation and lightness in 0..1. */
export function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const BUCKETS = 12;
export const hueBucket = (hue: number): number => Math.floor((((hue % 360) + 360) % 360) / (360 / BUCKETS)) % BUCKETS;
const luma = (r: number, g: number, b: number): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Below this saturation a pixel is grey, whatever hue the arithmetic gives it. */
const GREY = 0.2;
/** A hue covering less than this share of a family is trim; more, and it is the armour's own colour. */
const TRIM_SHARE = 0.14;
/** A pixel that has a colour of its own: not grey, not nearly black, not nearly white. */
const coloured = (s: number, l: number): boolean => s >= GREY && l > 0.1 && l < 0.92;

/** Decides, from all the layers of one family together, which hues are trim and how bright its armour runs. */
export function analyse(images: { data: Uint8ClampedArray }[]): PaintInfo {
  const perBucket = new Array<number>(BUCKETS).fill(0);
  let total = 0;
  for (const { data } of images) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      total++;
      const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
      if (coloured(s, l)) perBucket[hueBucket(h)]++;
    }
  }
  if (total === 0) return { accent: [], lo: 0, mid: 0.5, hi: 1 };
  const accent = perBucket.flatMap((n, bucket) => (n > 0 && n / total < TRIM_SHARE ? [bucket] : []));

  const brightness: number[] = [];
  for (const { data } of images) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
      if (!(coloured(s, l) && accent.includes(hueBucket(h)))) brightness.push(luma(data[i], data[i + 1], data[i + 2]));
    }
  }
  if (brightness.length === 0) return { accent, lo: 0, mid: 0.5, hi: 1 };
  brightness.sort((a, b) => a - b);
  const at = (share: number): number => brightness[Math.min(brightness.length - 1, Math.floor(brightness.length * share))];
  const round = (n: number): number => Math.round(n * 1000) / 1000;
  return { accent, lo: round(at(0.04)), mid: round(at(0.55)), hi: round(at(0.97)) };
}

// Seven stops from shadow to highlight. Shadows lean a little towards the cool side of the hue and
// highlights towards the warm side, the way hand-made pixel art ramps do; both ends lose saturation.
const LIGHTNESS = [0.07, 0.15, 0.26, 0.38, 0.5, 0.63, 0.78];
const SATURATION = [0.6, 0.8, 0.95, 1, 0.95, 0.8, 0.55];
const HUE_SHIFT = [-16, -12, -6, 0, 4, 10, 16];

/** The seven armour colours of a scheme, darkest first. */
export function rampOf(scheme: PaintScheme): RGB[] {
  return LIGHTNESS.map((l, i) => fromHsl(
    scheme.hue + HUE_SHIFT[i], scheme.sat * SATURATION[i], Math.min(0.94, Math.max(0.04, l - (scheme.shade ?? 0))),
  ));
}

/**
 * Returns a recoloured copy of RGBA pixels. Armour is placed on the scheme's ramp by its brightness,
 * measured against the family's own range: the family's median lands in the middle of the ramp, so a
 * white frame and a black frame come out the same colour. Trim takes the accent hue and keeps its
 * own brightness. Transparent pixels and opacity are untouched.
 */
export function recolour(data: Uint8ClampedArray, scheme: PaintScheme, info: PaintInfo): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const ramp = rampOf(scheme);
  const lower = Math.max(0.01, info.mid - info.lo);
  const upper = Math.max(0.01, info.hi - info.mid);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [h, s, l] = toHsl(out[i], out[i + 1], out[i + 2]);
    let colour: RGB;
    if (coloured(s, l) && info.accent.includes(hueBucket(h))) {
      colour = fromHsl(scheme.accentHue, scheme.accentSat, Math.min(0.92, 0.25 + 0.7 * l));
    } else {
      const y = luma(out[i], out[i + 1], out[i + 2]);
      const t = y <= info.mid ? 0.5 * (y - info.lo) / lower : 0.5 + 0.5 * (y - info.mid) / upper;
      colour = ramp[Math.round(Math.max(0, Math.min(1, t)) * (ramp.length - 1))];
    }
    out[i] = colour[0];
    out[i + 1] = colour[1];
    out[i + 2] = colour[2];
  }
  return out;
}

/** A colour as a canvas takes one: a hash and two figures for each of red, green and blue. */
export const hex = (rgb: RGB): string => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
/** The colour on a scheme's ramp that a strip shows it by: the lighter of its middle two. */
const SHOWN = 4;

/**
 * The colours of the steps of one of the five things a mix sets, as a strip on the paint page shows
 * them. The two wheels are the same whatever the mix is: a chart to pick a colour from. The other
 * three are in the colours the mix itself would have at each step: the armour at each finish and at
 * each shade, and the trim at each glow.
 */
export function mixSwatches(mix: Mix, key: MixKey): string[] {
  const steps = Array.from({ length: MIX_STEPS[key] }, (_, step) => step);
  switch (key) {
    case 'hue': return steps.map((step) => hex(fromHsl(step * HUE_STEP, 0.7, 0.5)));
    case 'trim': return steps.map((step) => hex(fromHsl(step * HUE_STEP, 0.9, 0.55)));
    case 'glow': return steps.map((step) => hex(fromHsl(mix.trim * HUE_STEP, MIX_GLOW[step], 0.55)));
    default: return steps.map((step) => hex(rampOf(schemeOfMix({ ...mix, [key]: step }))[SHOWN]));
  }
}
