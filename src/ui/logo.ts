import { lightRoom, type Glow } from './light';
import { FULL_TALL, LINE, buildWord, depthTones, metalColor, tonesOf, type Run, type Tones, type Word } from './signType';

/**
 * The game's name as a sign over the city, in the letters of `signType`: IRON in steel, WAGE in
 * the game's own colour. It is the one word that is of two metals. The sign comes on the way a
 * tube does, with a flicker, and now and then a gleam crosses it.
 */

/** How tall the letters are: the height the sign's alphabet was drawn for. */
const TALL = FULL_TALL;
/** The room between two letters at that height. */
const GAP = 6;

/** The name the sign spells, and where its first word ends: the letters before that are steel. */
export const LOGO_WORD = 'IRONWAGE';
const STEEL_LETTERS = 4;

export type { Run };
/** The sign: the word worked out, and where its first word ends. */
export interface Logo extends Word {
  /** Faces left of this are steel; the rest are in the game's colour. */
  split: number;
}

/** Works a word out into the sign over the title. Every letter of it must be one the sign knows how to write. */
export function buildLogo(word: string): Logo {
  const built = buildWord(word, TALL);
  return { ...built, split: built.letters[Math.min(STEEL_LETTERS, built.letters.length - 1)].x - Math.ceil(GAP / 2) };
}

export const LOGO = buildLogo(LOGO_WORD);

/** The colour of the face on a row of the sign, left or right of the split, lit or not. */
export function faceColor(row: number, steel: boolean, lit: boolean): string {
  return metalColor(steel ? 'steel' : 'neon', (row - 1) / (TALL - 1), lit);
}

/** The colours of the sign, row by row, for each of its two metals; and its depth. */
interface Palette { steel: Tones; neon: Tones; depth: string[] }
function palette(lit: boolean): Palette {
  return { steel: tonesOf('steel', TALL, LOGO.h, lit), neon: tonesOf('neon', TALL, LOGO.h, lit), depth: depthTones(lit) };
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

/** The moments at which the sign strikes as it comes on: it goes from dark to lit, and is heard to. */
export const SIGN_STRIKES = [300, 520];

/**
 * How lit the sign is, from 0 to 1, this long after it was switched on: dark, a first strike, dark
 * again, a second that falters, and then on; after that it holds, but for a moment's dip every so
 * often. A calm picture has it simply on.
 */
export function logoLevel(clockMs: number, calm = false): number {
  if (calm) return 1;
  if (clockMs < SIGN_STRIKES[0]) return 0;
  if (clockMs < SIGN_STRIKES[0] + 60) return 1;
  if (clockMs < SIGN_STRIKES[1]) return 0;
  if (clockMs < SIGN_STRIKES[1] + 120) return 0.7;
  if (clockMs < 700) return 0.1;
  if (clockMs < SIGN_ON_MS) return 0.6 + 0.4 * ((clockMs - 700) / (SIGN_ON_MS - 700));
  // Every eleven seconds or so, a twelfth of a second's dip.
  const slot = Math.floor(clockMs / 11000);
  const at = clockMs - slot * 11000 - 2000 - scatter(slot, 5) * 8000;
  return at >= 0 && at < 80 ? 0.45 : 1;
}

/** How many times the sign struck between two moments: after the first, up to and including the second. None in a calm picture, where it is simply on. */
export function signStrikes(beforeMs: number, nowMs: number, calm = false): number {
  return calm ? 0 : SIGN_STRIKES.filter((at) => at > beforeMs && at <= nowMs).length;
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
  // Six along the sign; three where there is to be less light, as evenly along it.
  const count = lightRoom(6);
  return Array.from({ length: count }, (_, i) => {
    const gx = x + ((i + 0.5) / count) * LOGO.w;
    return { x: Math.round(gx), y: y + Math.round(LOGO.h / 2), r: 46, color: gx - x < LOGO.split ? '#7fa8ff' : '#ff5db1', alpha: 0.2 * level };
  });
}
