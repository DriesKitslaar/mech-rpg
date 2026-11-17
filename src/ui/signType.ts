/**
 * The letters of the game's sign, for any word. No font and no picture: each letter is the path a
 * broad pen with cut corners is drawn along, and what comes of that is given depth, a dark line
 * round it, and a face like polished metal. The sign over the title is the first word written this
 * way; the big words of the game (a battle won or lost, a warning, the title of a page of story)
 * are written the same, at whatever height fits where they stand. A word is worked out once, as
 * rows of runs of pixels, and it is on the pixel grid like everything solid.
 */

import type { Glow } from './light';

type At = readonly [number, number];
export interface Glyph { w: number; strokes: At[][] }
export interface Run { x: number; w: number }

/** The height the letters were drawn for: their widths are for this height, and scale with it. */
export const FULL_TALL = 40;
/** The smallest and the largest a word can be written. Smaller, and a pen is too broad for its letters. */
export const MIN_TALL = 14;
export const MAX_TALL = 40;

/**
 * Where the middle of the pen goes for each letter: points from 0 to 1 across and down the room
 * the pen has, joined in the order given. A stroke from a point to itself is a dot. `w` is how
 * wide the letter comes out at full height.
 */
const O: At[] = [[0.27, 0], [0.73, 0], [1, 0.18], [1, 0.82], [0.73, 1], [0.27, 1], [0, 0.82], [0, 0.18], [0.27, 0]];
const DOT: At[] = [[0.5, 1], [0.5, 1]];
export const GLYPHS: Record<string, Glyph> = {
  A: { w: 28, strokes: [[[0, 1], [0, 0.27], [0.3, 0], [0.7, 0], [1, 0.27], [1, 1]], [[0, 0.62], [1, 0.62]]] },
  B: { w: 28, strokes: [[[0, 1], [0, 0], [0.7, 0], [1, 0.14], [1, 0.36], [0.72, 0.5], [0, 0.5]], [[0.72, 0.5], [1, 0.64], [1, 0.86], [0.7, 1], [0, 1]]] },
  C: { w: 27, strokes: [[[1, 0.18], [0.73, 0], [0.27, 0], [0, 0.18], [0, 0.82], [0.27, 1], [0.73, 1], [1, 0.82]]] },
  D: { w: 28, strokes: [[[0, 0], [0.68, 0], [1, 0.2], [1, 0.8], [0.68, 1], [0, 1], [0, 0]]] },
  E: { w: 26, strokes: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.72, 0.5]]] },
  F: { w: 25, strokes: [[[1, 0], [0, 0], [0, 1]], [[0, 0.5], [0.72, 0.5]]] },
  G: { w: 28, strokes: [[[1, 0.18], [0.73, 0], [0.27, 0], [0, 0.18], [0, 0.82], [0.27, 1], [0.73, 1], [1, 0.82], [1, 0.56], [0.52, 0.56]]] },
  H: { w: 28, strokes: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]] },
  I: { w: 17, strokes: [[[0.5, 0], [0.5, 1]], [[0, 0], [1, 0]], [[0, 1], [1, 1]]] },
  J: { w: 25, strokes: [[[0.3, 0], [1, 0], [1, 0.82], [0.73, 1], [0.27, 1], [0, 0.82], [0, 0.66]]] },
  K: { w: 28, strokes: [[[0, 0], [0, 1]], [[1, 0], [0, 0.56]], [[0.34, 0.38], [1, 1]]] },
  L: { w: 24, strokes: [[[0, 0], [0, 1], [1, 1]]] },
  M: { w: 36, strokes: [[[0, 1], [0, 0], [0.5, 0.58], [1, 0], [1, 1]]] },
  N: { w: 28, strokes: [[[0, 1], [0, 0], [1, 1], [1, 0]]] },
  O: { w: 28, strokes: [O] },
  P: { w: 27, strokes: [[[0, 1], [0, 0], [0.7, 0], [1, 0.15], [1, 0.38], [0.7, 0.53], [0, 0.53]]] },
  Q: { w: 28, strokes: [O, [[0.7, 0.76], [1, 1]]] },
  R: { w: 28, strokes: [[[0, 1], [0, 0], [0.7, 0], [1, 0.15], [1, 0.36], [0.7, 0.5], [0, 0.5]], [[0.5, 0.5], [1, 1]]] },
  S: { w: 27, strokes: [[[1, 0.1], [0.75, 0], [0.27, 0], [0, 0.16], [0, 0.36], [0.25, 0.5], [0.75, 0.5], [1, 0.64], [1, 0.84], [0.73, 1], [0.25, 1], [0, 0.9]]] },
  T: { w: 26, strokes: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]] },
  U: { w: 28, strokes: [[[0, 0], [0, 0.82], [0.27, 1], [0.73, 1], [1, 0.82], [1, 0]]] },
  V: { w: 28, strokes: [[[0, 0], [0.5, 1], [1, 0]]] },
  W: { w: 37, strokes: [[[0, 0], [0, 1], [0.5, 0.42], [1, 1], [1, 0]]] },
  X: { w: 28, strokes: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]] },
  Y: { w: 28, strokes: [[[0, 0], [0.5, 0.5], [1, 0]], [[0.5, 0.5], [0.5, 1]]] },
  Z: { w: 26, strokes: [[[0, 0], [1, 0], [0, 1], [1, 1]]] },
  0: { w: 24, strokes: [O] },
  1: { w: 18, strokes: [[[0, 0.24], [0.55, 0], [0.55, 1]], [[0, 1], [1, 1]]] },
  2: { w: 26, strokes: [[[0, 0.18], [0.27, 0], [0.73, 0], [1, 0.18], [1, 0.42], [0, 1], [1, 1]]] },
  3: { w: 26, strokes: [[[0, 0.1], [0.27, 0], [0.73, 0], [1, 0.16], [1, 0.36], [0.72, 0.5], [0.46, 0.5]], [[0.72, 0.5], [1, 0.64], [1, 0.84], [0.73, 1], [0.27, 1], [0, 0.9]]] },
  4: { w: 28, strokes: [[[0.8, 1], [0.8, 0], [0, 0.72], [1, 0.72]]] },
  5: { w: 26, strokes: [[[1, 0], [0, 0], [0, 0.45], [0.7, 0.45], [1, 0.6], [1, 0.84], [0.73, 1], [0.27, 1], [0, 0.84]]] },
  6: { w: 26, strokes: [[[1, 0.1], [0.73, 0], [0.27, 0], [0, 0.18], [0, 0.82], [0.27, 1], [0.73, 1], [1, 0.82], [1, 0.62], [0.73, 0.46], [0, 0.46]]] },
  7: { w: 25, strokes: [[[0, 0], [1, 0], [0.38, 1]]] },
  8: { w: 26, strokes: [[[0.27, 0], [0.73, 0], [1, 0.14], [1, 0.36], [0.73, 0.5], [0.27, 0.5], [0, 0.36], [0, 0.14], [0.27, 0]], [[0.27, 0.5], [0, 0.64], [0, 0.86], [0.27, 1], [0.73, 1], [1, 0.86], [1, 0.64], [0.73, 0.5]]] },
  9: { w: 26, strokes: [[[0, 0.9], [0.27, 1], [0.73, 1], [1, 0.82], [1, 0.18], [0.73, 0], [0.27, 0], [0, 0.18], [0, 0.38], [0.27, 0.54], [1, 0.54]]] },
  ' ': { w: 14, strokes: [] },
  '-': { w: 18, strokes: [[[0, 0.5], [1, 0.5]]] },
  '.': { w: 9, strokes: [DOT] },
  ':': { w: 9, strokes: [[[0.5, 0.3], [0.5, 0.3]], DOT] },
  '!': { w: 9, strokes: [[[0.5, 0], [0.5, 0.6]], DOT] },
  '?': { w: 25, strokes: [[[0, 0.18], [0.27, 0], [0.73, 0], [1, 0.18], [1, 0.36], [0.5, 0.56], [0.5, 0.66]], DOT] },
  "'": { w: 9, strokes: [[[0.5, 0], [0.5, 0.2]]] },
};

/** Whether every character of a text is one the sign has a shape for. It writes capitals only. */
export const canWrite = (text: string): boolean => text.length > 0 && [...text].every((c) => Object.hasOwn(GLYPHS, c));

/** How far the pen reaches from its middle at a height: a stroke is seven pixels thick at forty tall, five from twenty-three, three below. */
export const penFor = (tall: number): number => (tall >= 36 ? 3 : tall >= 23 ? 2 : 1);
/** The room between two letters, for each pen. */
const GAPS = [0, 3, 4, 6];
/** How many pixels of depth the letters have, down and to the right: as many as the pen reaches. */
const depthFor = (tall: number): number => penFor(tall);
const whole = (tall: number): number => Math.max(MIN_TALL, Math.min(MAX_TALL, Math.round(tall)));
/** How wide a letter comes out at a height. The narrowest of them is still as wide as the pen at every height there is. */
const widthAt = (glyph: Glyph, tall: number): number => Math.round((glyph.w * tall) / FULL_TALL);

/** How wide a word is at a height, with its depth and the line round it; and how high. */
export function wordWidth(text: string, tall: number): number {
  const t = whole(tall);
  const glyphs = [...text].map((c) => GLYPHS[c]).filter(Boolean);
  return glyphs.reduce((sum, glyph) => sum + widthAt(glyph, t), 0) + GAPS[penFor(t)] * Math.max(0, glyphs.length - 1) + depthFor(t) + 2;
}
export const wordHeight = (tall: number): number => whole(tall) + depthFor(whole(tall)) + 2;

/**
 * The tallest a word can be written, from `maxTall` down to `minTall`, and still be no wider than
 * `maxWidth`. Null when it does not fit even at its smallest, or the sign cannot write it: the
 * word is then for the font.
 */
export function fitTall(text: string, maxWidth: number, maxTall: number, minTall = MIN_TALL): number | null {
  if (!canWrite(text)) return null;
  for (let tall = whole(maxTall); tall >= whole(minTall); tall--) if (wordWidth(text, tall) <= maxWidth) return tall;
  return null;
}

/** A word worked out: rows of runs of pixels for its faces, their edges, its depth and the line round it. */
export interface Word {
  /** The size of the whole of it: the letters, their depth and the line round them. */
  w: number;
  h: number;
  /** How tall its letters are. */
  tall: number;
  /** Row by row: the letters' faces. */
  face: Run[][];
  /** The pixels of the face that have nothing of it above them, and those with nothing of it below. */
  top: Run[][];
  bottom: Run[][];
  /** The depth, one layer for each pixel of it, nearest first. */
  depth: Run[][][];
  /** The dark line round all of it. */
  edge: Run[][];
  /** Where each letter's face starts and how wide it is. */
  letters: Run[];
}

/** One letter, as a grid of its own: 1 where the pen went. */
function penned(glyph: Glyph, w: number, tall: number, pen: number): Uint8Array {
  const mask = new Uint8Array(w * tall);
  const across = w - 1 - pen * 2;
  const down = tall - 1 - pen * 2;
  const stamp = (cx: number, cy: number): void => {
    for (let dy = -pen; dy <= pen; dy++) {
      for (let dx = -pen; dx <= pen; dx++) {
        // The pen is square with its corners cut.
        if (Math.abs(dx) + Math.abs(dy) > pen + 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < w && y >= 0 && y < tall) mask[y * w + x] = 1;
      }
    }
  };
  for (const stroke of glyph.strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const ax = pen + stroke[i - 1][0] * across;
      const ay = pen + stroke[i - 1][1] * down;
      const bx = pen + stroke[i][0] * across;
      const by = pen + stroke[i][1] * down;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2));
      for (let s = 0; s <= steps; s++) stamp(Math.round(ax + ((bx - ax) * s) / steps), Math.round(ay + ((by - ay) * s) / steps));
    }
  }
  return mask;
}

/** The runs of a row of a grid where `is` holds. */
function runsOf(grid: Uint8Array, w: number, y: number, is: (code: number, x: number) => boolean): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && is(grid[y * w + x], x);
    if (on && start < 0) start = x;
    if (!on && start >= 0) { runs.push({ x: start, w: x - start }); start = -1; }
  }
  return runs;
}

const FACE = 1;
const EDGE = 9;

/** Works a word out at a height. Every character of it must be one the sign knows how to write. */
export function buildWord(text: string, tall: number): Word {
  const t = whole(tall);
  const pen = penFor(t);
  const depth = depthFor(t);
  const glyphs = [...text].map((c) => {
    if (!Object.hasOwn(GLYPHS, c)) throw new Error(`The sign has no letter ${c}`);
    return GLYPHS[c];
  });
  const widths = glyphs.map((glyph) => widthAt(glyph, t));
  const lettersW = widths.reduce((sum, width) => sum + width, 0) + GAPS[pen] * Math.max(0, glyphs.length - 1);
  // One pixel of line all round, and the depth to the right and below.
  const w = lettersW + depth + 2;
  const h = t + depth + 2;
  const grid = new Uint8Array(w * h);
  const letters: Run[] = [];
  let at = 1;
  glyphs.forEach((glyph, i) => {
    const mask = penned(glyph, widths[i], t, pen);
    for (let y = 0; y < t; y++) for (let x = 0; x < widths[i]; x++) if (mask[y * widths[i] + x]) grid[(y + 1) * w + at + x] = FACE;
    letters.push({ x: at, w: widths[i] });
    at += widths[i] + GAPS[pen];
  });
  // Depth: the face again, a pixel further down and right each time, wherever nothing is yet.
  for (let k = 1; k <= depth; k++) {
    for (let y = h - 1; y >= k; y--) {
      for (let x = w - 1; x >= k; x--) {
        if (grid[y * w + x] === 0 && grid[(y - k) * w + (x - k)] === FACE) grid[y * w + x] = FACE + k;
      }
    }
  }
  // The line: every empty pixel that touches something.
  const solid = grid.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x] !== 0) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1 && !touches; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && solid[ny * w + nx] !== 0) touches = true;
        }
      }
      if (touches) grid[y * w + x] = EDGE;
    }
  }
  const rows = <T>(make: (y: number) => T): T[] => Array.from({ length: h }, (_, y) => make(y));
  const faceAt = (x: number, y: number): boolean => y >= 0 && y < h && grid[y * w + x] === FACE;
  return {
    w, h, tall: t, letters,
    face: rows((y) => runsOf(grid, w, y, (code) => code === FACE)),
    top: rows((y) => runsOf(grid, w, y, (code, x) => code === FACE && !faceAt(x, y - 1))),
    bottom: rows((y) => runsOf(grid, w, y, (code, x) => code === FACE && !faceAt(x, y + 1))),
    depth: Array.from({ length: depth }, (_, k) => rows((y) => runsOf(grid, w, y, (code) => code === FACE + k + 1))),
    edge: rows((y) => runsOf(grid, w, y, (code) => code === EDGE)),
  };
}

/** How many words are kept worked out, and painted: the oldest goes when there are more. */
export const KEPT_WORDS = 24;
const built = new Map<string, Word>();
/** A word at a height, worked out once and kept for the next time it is asked for. */
export function wordOf(text: string, tall: number): Word {
  const key = `${whole(tall)}|${text}`;
  let word = built.get(key);
  if (!word) {
    word = buildWord(text, tall);
    built.set(key, word);
    if (built.size > KEPT_WORDS) built.delete(built.keys().next().value as string);
  }
  return word;
}

/** A colour between two others. */
export function mix(a: string, b: string, t: number): string {
  const part = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(part(a, i) + (part(b, i) - part(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

export type Metal = 'steel' | 'neon' | 'amber' | 'red';
type Ramp = readonly (readonly [number, string])[];
/**
 * Polished metal, from the top of a letter to its foot: the sky in it, bright at the top and deep
 * towards the horizon, a dark line where the horizon is, and the ground in it, lighter towards the
 * foot. Steel, the game's own colour, the amber of a warning, and the red of one that was not heeded.
 */
export const METALS: Record<Metal, Ramp> = {
  steel: [[0, '#f6f9ff'], [0.2, '#bccbe8'], [0.45, '#6c82b4'], [0.5, '#202946'], [0.56, '#3b4876'], [0.8, '#8da2cf'], [1, '#e2eafc']],
  neon: [[0, '#fff2f9'], [0.2, '#ffb4de'], [0.45, '#ff5db1'], [0.5, '#6a1146'], [0.56, '#a51e6e'], [0.8, '#f24ca8'], [1, '#ffc6e7']],
  amber: [[0, '#fffbe6'], [0.2, '#ffe28c'], [0.45, '#f2a332'], [0.5, '#5c3406'], [0.56, '#8e5612'], [0.8, '#eaa030'], [1, '#ffe6a8']],
  red: [[0, '#fff1ee'], [0.2, '#ffb3a6'], [0.45, '#f2543e'], [0.5, '#5c0d0d'], [0.56, '#8f1c17'], [0.8, '#e24836'], [1, '#ffc4b8']],
};
export const DEPTHS = ['#3d2c6c', '#2b1e52', '#1c1338'];
export const LINE = '#07061a';
/** What a tube that is not lit looks like: nearly the dark behind it. */
export const UNLIT = '#151330';

function ramp(stops: Ramp, p: number): string {
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

/** The colour of a metal's face so far down a letter, from 0 at its top to 1 at its foot, lit or not. */
export function metalColor(metal: Metal, p: number, lit: boolean): string {
  const color = ramp(METALS[metal], Math.max(0, Math.min(1, p)));
  return lit ? color : mix(color, UNLIT, 0.78);
}

/** The colours of a word, row by row: its faces, the light on their upper edges, the shade on their lower ones, and its depth. */
export interface Tones { face: string[]; top: string[]; bottom: string[] }
export function tonesOf(metal: Metal, tall: number, rows: number, lit: boolean): Tones {
  const face = Array.from({ length: rows }, (_, row) => metalColor(metal, (row - 1) / (tall - 1), lit));
  return {
    face,
    // Light catches every upper edge, and every lower edge is in shade.
    top: face.map((color) => mix(color, lit ? '#ffffff' : '#5a5890', lit ? 0.6 : 0.3)),
    bottom: face.map((color) => mix(color, '#0a0820', 0.4)),
  };
}
export const depthTones = (lit: boolean): string[] => DEPTHS.map((color) => (lit ? color : mix(color, UNLIT, 0.6)));

const palettes = new Map<string, { tones: Tones; depth: string[] }>();
function paletteOf(metal: Metal, word: Word, lit: boolean): { tones: Tones; depth: string[] } {
  const key = `${metal}|${word.tall}|${lit ? 1 : 0}`;
  let colors = palettes.get(key);
  if (!colors) {
    colors = { tones: tonesOf(metal, word.tall, word.h, lit), depth: depthTones(lit) };
    palettes.set(key, colors);
  }
  return colors;
}

/** Paints a word with its top left corner at `x`, `y`: the line, the depth, the faces and the light on their edges. */
function paint(ctx: CanvasRenderingContext2D, word: Word, x: number, y: number, metal: Metal, lit: boolean): void {
  const { tones, depth } = paletteOf(metal, word, lit);
  const fill = (rows: Run[][], color: (row: number) => string): void => {
    rows.forEach((runs, row) => {
      if (runs.length === 0) return;
      ctx.fillStyle = color(row);
      for (const run of runs) ctx.fillRect(x + run.x, y + row, run.w, 1);
    });
  };
  fill(word.edge, () => LINE);
  word.depth.forEach((layer, k) => fill(layer, () => depth[k]));
  fill(word.face, (row) => tones.face[row]);
  fill(word.top, (row) => tones.top[row]);
  fill(word.bottom, (row) => tones.bottom[row]);
}

/**
 * Words painted once, where the platform has a canvas to keep them on. A platform that has none,
 * or whose canvas gives nothing to paint on, has them painted afresh each time.
 */
const kept = new Map<string, CanvasImageSource | null>();
function keptWord(word: Word, text: string, metal: Metal, lit: boolean): CanvasImageSource | null {
  const key = `${metal}|${word.tall}|${lit ? 1 : 0}|${text}`;
  const had = kept.get(key);
  if (had !== undefined) return had;
  const doc = (globalThis as { document?: Document }).document;
  const canvas = doc?.createElement?.('canvas');
  const own = canvas?.getContext?.('2d');
  let made: CanvasImageSource | null = null;
  if (canvas && own) {
    canvas.width = word.w;
    canvas.height = word.h;
    paint(own, word, 0, 0, metal, lit);
    made = canvas;
  }
  kept.set(key, made);
  if (kept.size > KEPT_WORDS * 2) kept.delete(kept.keys().next().value as string);
  return made;
}

/** Forgets every word kept, worked out or painted. For tests. */
export function forgetWords(): void {
  built.clear();
  kept.clear();
  palettes.clear();
}

/** Where the top of a word is whose letters have their middle at `cy`: the line round it is a pixel above them. */
export const wordTop = (cy: number, tall: number): number => Math.round(cy - whole(tall) / 2) - 1;

/** How long a word takes to come on. */
export const WORD_ON_MS = 320;
/**
 * How lit a word is this long after it was switched on: dark, a strike, nearly dark again, and on.
 * The sign over the title takes a second over it; a word in the middle of things takes a third.
 * A calm picture has it simply on.
 */
export function wordLevel(ms: number, calm = false): number {
  if (calm || ms >= WORD_ON_MS) return 1;
  if (ms < 60) return 0;
  if (ms < 120) return 1;
  if (ms < 200) return 0.15;
  return 0.6 + 0.4 * ((ms - 200) / (WORD_ON_MS - 200));
}

/** The colour of the light each metal throws when it is lit. */
export const GLOWS: Record<Metal, string> = { steel: '#7fa8ff', neon: '#ff5db1', amber: '#ffb44a', red: '#ff5a40' };
/** How strong that light is when the word is fully lit. */
export const WORD_GLOW = 0.18;

/**
 * The light a lit word throws: a few small lights along it, in its metal's colour, round the
 * middle of its letters at `cx`, `cy`. None from a word that is dark or that the sign cannot write.
 */
export function wordLights(text: string, cx: number, cy: number, tall: number, metal: Metal, level = 1): Glow[] {
  if (!(level > 0) || !canWrite(text)) return [];
  const w = wordWidth(text, tall);
  const n = Math.max(1, Math.round(w / 60));
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(cx - w / 2 + ((i + 0.5) / n) * w), y: Math.round(cy), r: Math.round(whole(tall) * 1.5), color: GLOWS[metal], alpha: WORD_GLOW * Math.min(1, level),
  }));
}

export interface WordLook {
  /** How tall the letters are. */
  tall: number;
  /** What its faces are made of. Steel when nothing is said. */
  metal?: Metal;
  /** How lit it is, from 0 to 1. Fully, when nothing is said. */
  level?: number;
  /** Where `x` is: the middle of the word (when nothing is said), its left or its right. */
  align?: 'left' | 'center' | 'right';
}

/** Where the left edge of a word is that is drawn at `x` with this look. */
export function wordLeft(text: string, x: number, look: WordLook): number {
  const w = wordWidth(text, look.tall);
  return Math.round(look.align === 'left' ? x : look.align === 'right' ? x - w : x - w / 2);
}

/**
 * Writes a word in the sign's letters with its top at `y`. A text the sign cannot write is not
 * drawn at all: whoever asks checks first with `canWrite` or `fitTall`, and falls back on the font.
 */
export function drawWord(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, look: WordLook): void {
  if (!canWrite(text)) return;
  const word = wordOf(text, look.tall);
  const metal = look.metal ?? 'steel';
  const left = wordLeft(text, x, look);
  const top = Math.round(y);
  const level = Math.max(0, Math.min(1, look.level ?? 1));
  const layer = (lit: boolean): void => {
    const image = keptWord(word, text, metal, lit);
    if (image) ctx.drawImage(image, left, top);
    else paint(ctx, word, left, top, metal, lit);
  };
  if (level < 1) layer(false);
  if (level > 0) {
    // As lit as it is, on top of however faint whoever draws it has made everything.
    const before = ctx.globalAlpha;
    ctx.globalAlpha = (typeof before === 'number' ? before : 1) * level;
    layer(true);
    ctx.globalAlpha = before;
  }
}
