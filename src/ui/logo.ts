import type { Glow } from './light';

/**
 * The game's name as a sign over the city. No font and no picture: each letter is the path a broad
 * pen with cut corners is drawn along, and what comes of that is given depth, a dark line round it,
 * and a face like polished metal: IRON in steel, WAGE in the game's own colour. It is worked out
 * once, as rows of runs of pixels, and it is on the pixel grid like everything solid. The sign
 * comes on the way a tube does, with a flicker, and now and then a gleam crosses it.
 */

type At = readonly [number, number];
interface Letter { w: number; strokes: At[][] }

/** How tall the letters are, and how far the pen reaches from its middle: a stroke is seven pixels thick. */
const TALL = 40;
const PEN = 3;
/** The room between two letters. */
const GAP = 6;
/** How many pixels of depth the letters have, down and to the right. */
const DEPTH = 3;

/**
 * Where the middle of the pen goes for each letter: points from 0 to 1 across and down the room
 * the pen has, joined in the order given. `w` is how wide the letter comes out.
 */
const LETTERS: Record<string, Letter> = {
  I: { w: 17, strokes: [[[0.5, 0], [0.5, 1]], [[0, 0], [1, 0]], [[0, 1], [1, 1]]] },
  R: { w: 28, strokes: [[[0, 1], [0, 0], [0.7, 0], [1, 0.15], [1, 0.36], [0.7, 0.5], [0, 0.5]], [[0.5, 0.5], [1, 1]]] },
  O: { w: 28, strokes: [[[0.27, 0], [0.73, 0], [1, 0.18], [1, 0.82], [0.73, 1], [0.27, 1], [0, 0.82], [0, 0.18], [0.27, 0]]] },
  N: { w: 28, strokes: [[[0, 1], [0, 0], [1, 1], [1, 0]]] },
  W: { w: 37, strokes: [[[0, 0], [0, 1], [0.5, 0.42], [1, 1], [1, 0]]] },
  A: { w: 28, strokes: [[[0, 1], [0, 0.27], [0.3, 0], [0.7, 0], [1, 0.27], [1, 1]], [[0, 0.62], [1, 0.62]]] },
  G: { w: 28, strokes: [[[1, 0.18], [0.73, 0], [0.27, 0], [0, 0.18], [0, 0.82], [0.27, 1], [0.73, 1], [1, 0.82], [1, 0.56], [0.52, 0.56]]] },
  E: { w: 26, strokes: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.72, 0.5]]] },
};

/** The name the sign spells, and where its first word ends: the letters before that are steel. */
export const LOGO_WORD = 'IRONWAGE';
const STEEL_LETTERS = 4;

export interface Run { x: number; w: number }
export interface Logo {
  /** The size of the whole sign: the letters, their depth and the line round them. */
  w: number;
  h: number;
  /** Row by row: the letters' faces. */
  face: Run[][];
  /** Faces left of this are steel; the rest are in the game's colour. */
  split: number;
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
function penned(letter: Letter): Uint8Array {
  const mask = new Uint8Array(letter.w * TALL);
  const across = letter.w - 1 - PEN * 2;
  const down = TALL - 1 - PEN * 2;
  const stamp = (cx: number, cy: number): void => {
    for (let dy = -PEN; dy <= PEN; dy++) {
      for (let dx = -PEN; dx <= PEN; dx++) {
        // The pen is square with its corners cut.
        if (Math.abs(dx) + Math.abs(dy) > PEN + 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < letter.w && y >= 0 && y < TALL) mask[y * letter.w + x] = 1;
      }
    }
  };
  for (const stroke of letter.strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const ax = PEN + stroke[i - 1][0] * across;
      const ay = PEN + stroke[i - 1][1] * down;
      const bx = PEN + stroke[i][0] * across;
      const by = PEN + stroke[i][1] * down;
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

/** Works a word out into a sign. Every letter of it must be one the sign knows how to write. */
export function buildLogo(word: string): Logo {
  const glyphs = [...word].map((c) => {
    if (!Object.hasOwn(LETTERS, c)) throw new Error(`The sign has no letter ${c}`);
    return LETTERS[c];
  });
  const lettersW = glyphs.reduce((sum, g) => sum + g.w, 0) + GAP * (glyphs.length - 1);
  // One pixel of line all round, and the depth to the right and below.
  const w = lettersW + DEPTH + 2;
  const h = TALL + DEPTH + 2;
  const grid = new Uint8Array(w * h);
  const letters: Run[] = [];
  let at = 1;
  for (const glyph of glyphs) {
    const mask = penned(glyph);
    for (let y = 0; y < TALL; y++) for (let x = 0; x < glyph.w; x++) if (mask[y * glyph.w + x]) grid[(y + 1) * w + at + x] = FACE;
    letters.push({ x: at, w: glyph.w });
    at += glyph.w + GAP;
  }
  // Depth: the face again, a pixel further down and right each time, wherever nothing is yet.
  for (let k = 1; k <= DEPTH; k++) {
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
    w, h, letters,
    split: letters[Math.min(STEEL_LETTERS, letters.length - 1)].x - Math.ceil(GAP / 2),
    face: rows((y) => runsOf(grid, w, y, (code) => code === FACE)),
    top: rows((y) => runsOf(grid, w, y, (code, x) => code === FACE && !faceAt(x, y - 1))),
    bottom: rows((y) => runsOf(grid, w, y, (code, x) => code === FACE && !faceAt(x, y + 1))),
    depth: Array.from({ length: DEPTH }, (_, k) => rows((y) => runsOf(grid, w, y, (code) => code === FACE + k + 1))),
    edge: rows((y) => runsOf(grid, w, y, (code) => code === EDGE)),
  };
}

export const LOGO = buildLogo(LOGO_WORD);

/** A colour between two others. */
function mix(a: string, b: string, t: number): string {
  const part = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(part(a, i) + (part(b, i) - part(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

type Ramp = readonly (readonly [number, string])[];
/**
 * Polished metal, from the top of a letter to its foot: the sky in it, bright at the top and deep
 * towards the horizon, a dark line where the horizon is, and the ground in it, lighter towards the foot.
 */
const STEEL: Ramp = [[0, '#f6f9ff'], [0.2, '#bccbe8'], [0.45, '#6c82b4'], [0.5, '#202946'], [0.56, '#3b4876'], [0.8, '#8da2cf'], [1, '#e2eafc']];
const NEON: Ramp = [[0, '#fff2f9'], [0.2, '#ffb4de'], [0.45, '#ff5db1'], [0.5, '#6a1146'], [0.56, '#a51e6e'], [0.8, '#f24ca8'], [1, '#ffc6e7']];
const DEPTHS = ['#3d2c6c', '#2b1e52', '#1c1338'];
const LINE = '#07061a';
/** What a tube that is not lit looks like: nearly the dark behind it. */
const UNLIT = '#151330';

function ramp(stops: Ramp, p: number): string {
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

/** The colour of the face on a row of the sign, left or right of the split, lit or not. */
export function faceColor(row: number, steel: boolean, lit: boolean): string {
  const p = Math.max(0, Math.min(1, (row - 1) / (TALL - 1)));
  const color = ramp(steel ? STEEL : NEON, p);
  return lit ? color : mix(color, UNLIT, 0.78);
}

/** The colours of the sign, row by row: its faces, the light on their upper edges, the shade on their lower ones, and its depth. */
interface Tones { face: string[]; top: string[]; bottom: string[] }
interface Palette { steel: Tones; neon: Tones; depth: string[] }
function palette(lit: boolean): Palette {
  const tones = (steel: boolean): Tones => {
    const face = Array.from({ length: LOGO.h }, (_, row) => faceColor(row, steel, lit));
    return {
      face,
      // Light catches every upper edge, and every lower edge is in shade.
      top: face.map((color) => mix(color, lit ? '#ffffff' : '#5a5890', lit ? 0.6 : 0.3)),
      bottom: face.map((color) => mix(color, '#0a0820', 0.4)),
    };
  };
  return { steel: tones(true), neon: tones(false), depth: DEPTHS.map((color) => (lit ? color : mix(color, UNLIT, 0.6))) };
}
/** Worked out once, unlit and lit: painting the sign is then nothing but filling its runs. */
const PALETTES: [Palette, Palette] = [palette(false), palette(true)];

/** Paints the sign with its top left corner at `x`, `y`: the line, the depth, the faces and the light on their edges. */
function paint(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
  const colors = PALETTES[lit ? 1 : 0];
  const fill = (rows: Run[][], color: (row: number, run: Run) => string): void => {
    rows.forEach((runs, row) => {
      for (const run of runs) {
        ctx.fillStyle = color(row, run);
        ctx.fillRect(x + run.x, y + row, run.w, 1);
      }
    });
  };
  const side = (run: Run): Tones => (run.x < LOGO.split ? colors.steel : colors.neon);
  fill(LOGO.edge, () => LINE);
  LOGO.depth.forEach((layer, k) => fill(layer, () => colors.depth[k]));
  fill(LOGO.face, (row, run) => side(run).face[row]);
  fill(LOGO.top, (row, run) => side(run).top[row]);
  fill(LOGO.bottom, (row, run) => side(run).bottom[row]);
}

/** How often a canvas to keep the sign on is asked for before the sign is painted afresh every frame for good. */
export const KEEP_TRIES = 3;
/** The sign painted once, lit and unlit, where the platform has a canvas to keep it on; and how often that was tried in vain. */
const kept: (CanvasImageSource | null)[] = [null, null];
const tried = [0, 0];
function keptSign(lit: boolean): CanvasImageSource | null {
  const i = lit ? 1 : 0;
  if (kept[i] || tried[i] >= KEEP_TRIES) return kept[i];
  tried[i]++;
  const doc = (globalThis as { document?: Document }).document;
  const canvas = doc?.createElement?.('canvas');
  if (!canvas) return null;
  canvas.width = LOGO.w;
  canvas.height = LOGO.h;
  // A canvas that gives no context this time may give one the next: it is asked for again, a few times.
  const own = canvas.getContext?.('2d');
  if (!own) return null;
  paint(own, 0, 0, lit);
  kept[i] = canvas;
  return canvas;
}

/** Forgets the kept sign, so that the next drawing asks for a canvas again. For tests. */
export function forgetSign(): void {
  kept[0] = kept[1] = null;
  tried[0] = tried[1] = 0;
}

/** How long the sign takes to come on, and how often and for how long a gleam crosses it once it is. */
export const SIGN_ON_MS = 1100;
export const GLEAM_EVERY_MS = 4200;
export const GLEAM_MS = 900;
const GLEAM_W = 14;

const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * How lit the sign is, from 0 to 1, this long after it was switched on: dark, a first strike, dark
 * again, a second that falters, and then on; after that it holds, but for a moment's dip every so
 * often. A calm picture has it simply on.
 */
export function logoLevel(clockMs: number, calm = false): number {
  if (calm) return 1;
  if (clockMs < 300) return 0;
  if (clockMs < 360) return 1;
  if (clockMs < 520) return 0;
  if (clockMs < 640) return 0.7;
  if (clockMs < 700) return 0.1;
  if (clockMs < SIGN_ON_MS) return 0.6 + 0.4 * ((clockMs - 700) / (SIGN_ON_MS - 700));
  // Every eleven seconds or so, a twelfth of a second's dip.
  const slot = Math.floor(clockMs / 11000);
  const at = clockMs - slot * 11000 - 2000 - scatter(slot, 5) * 8000;
  return at >= 0 && at < 80 ? 0.45 : 1;
}

/** How far across the sign the gleam is, from 0 to 1, or null while there is none. */
export function logoGleam(clockMs: number): number | null {
  const since = clockMs - SIGN_ON_MS - 400;
  if (since < 0) return null;
  const at = since % GLEAM_EVERY_MS;
  return at < GLEAM_MS ? at / GLEAM_MS : null;
}

export interface LogoLook {
  /** How lit the sign is, from 0 to 1. */
  level: number;
  /** How far across the gleam is, or null for none. */
  gleam: number | null;
}

/** Draws the sign with its top left corner at `x`, `y`. */
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, look: LogoLook = { level: 1, gleam: null }): void {
  const level = Math.max(0, Math.min(1, look.level));
  const layer = (lit: boolean): void => {
    const sign = keptSign(lit);
    if (sign) ctx.drawImage(sign, x, y);
    else paint(ctx, x, y, lit);
  };
  if (level < 1) layer(false);
  if (level > 0) {
    const before = ctx.globalAlpha;
    ctx.globalAlpha = level;
    layer(true);
    ctx.globalAlpha = before;
  }
  if (look.gleam === null || level < 1) return;
  // A narrow band of light, leaning, that crosses the faces and nothing else.
  const from = -GLEAM_W - TALL / 2 + look.gleam * (LOGO.w + GLEAM_W + TALL);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  LOGO.face.forEach((runs, row) => {
    const left = Math.round(from - row * 0.5);
    for (const run of runs) {
      const a = Math.max(run.x, left);
      const b = Math.min(run.x + run.w, left + GLEAM_W);
      if (b > a) ctx.fillRect(x + a, y + row, b - a, 1);
    }
  });
}

/** The light the sign throws while it is lit: cold over the steel, the game's colour over the rest. */
export function logoLights(x: number, y: number, level: number): Glow[] {
  if (level <= 0) return [];
  const count = 6;
  return Array.from({ length: count }, (_, i) => {
    const gx = x + ((i + 0.5) / count) * LOGO.w;
    return { x: Math.round(gx), y: y + Math.round(LOGO.h / 2), r: 46, color: gx - x < LOGO.split ? '#7fa8ff' : '#ff5db1', alpha: 0.2 * level };
  });
}
