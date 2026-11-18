import { LIGHT_ALPHA, ambienceFor, drawHaze, lightLevel, placeLights, type Ambience, type LightKind } from './ambience';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawCone, drawLights, type Glow, type Pt } from './light';
import { drawSearchlights, drawTitleScene, titleLights } from './titleScene';
import { drawWeather, drawWeatherExtras, weatherFor, type Weather } from './weather';

/**
 * What makes a picture of the story a place. The title's picture was brought to life in the round
 * of the look; the pages of story and the places conversations are held in were left as they were:
 * a still picture under a shade. Here each of them is told where its lights are (found in the
 * picture itself: its brightest spots), what haze lies in it, what falls or rises through it, and
 * where its sun is if it has one. Everything follows from the clock.
 */

export interface StillLight { x: number; y: number; r: number; color: string; kind: LightKind }
/** A shaft of light from a picture's sun: where it ends, and how wide it is there. */
export interface Ray { to: Pt; width: number }
/** What falls or rises through a picture: weather, or the notices that fall over Meridian's tower. */
export type StillWeather = Weather | 'paper';
export interface Still {
  lights: StillLight[];
  haze?: NonNullable<Ambience['haze']>;
  weather: StillWeather;
  /** Where its sun stands, the colour of its light, and the shafts that come from it. */
  sun?: { x: number; y: number; color: string; rays: Ray[] };
}

export const STILLS: Record<string, Still> = {
  // Two frames squaring up in a burning street: its signs hum, its fires flicker, and sparks rise from them.
  'still-war': {
    weather: 'embers', haze: { color: '#a04a20', y: 232, alpha: 0.12 },
    lights: [
      { x: 18, y: 32, r: 28, color: '#f56f3e', kind: 'neon' },
      { x: 296, y: 76, r: 26, color: '#e31d98', kind: 'neon' },
      { x: 117, y: 185, r: 16, color: '#f440ad', kind: 'neon' },
      { x: 287, y: 201, r: 36, color: '#f78025', kind: 'fire' },
      { x: 63, y: 212, r: 18, color: '#fb8f34', kind: 'fire' },
      { x: 164, y: 235, r: 16, color: '#f8863b', kind: 'fire' },
      { x: 258, y: 226, r: 16, color: '#f77622', kind: 'fire' },
      { x: 118, y: 158, r: 14, color: '#f7742b', kind: 'fire' },
    ],
  },
  // Meridian's tower, and its notices coming down over the city like snow.
  'still-notice': {
    weather: 'paper', haze: { color: '#8a6a30', y: 238, alpha: 0.1 },
    lights: [
      { x: 154, y: 205, r: 40, color: '#b98b3d', kind: 'steady' },
      { x: 154, y: 126, r: 16, color: '#976e2d', kind: 'steady' },
      { x: 154, y: 14, r: 14, color: '#c79844', kind: 'lamp' },
      { x: 296, y: 257, r: 14, color: '#c69443', kind: 'lamp' },
      { x: 21, y: 242, r: 14, color: '#ca9947', kind: 'lamp' },
    ],
  },
  // The city in order: a pale sun behind cloud, a mist down the avenue, the lamps along it.
  'still-ledger': {
    weather: 'dust', haze: { color: '#8a8a80', y: 205, alpha: 0.14 },
    lights: [
      { x: 208, y: 102, r: 48, color: '#faf2c0', kind: 'lamp' },
      { x: 138, y: 244, r: 22, color: '#f0c864', kind: 'lamp' },
      { x: 154, y: 219, r: 12, color: '#e9c467', kind: 'lamp' },
      { x: 258, y: 234, r: 14, color: '#e9c266', kind: 'lamp' },
      { x: 95, y: 102, r: 14, color: '#d7b25f', kind: 'steady' },
    ],
  },
  // The meeting: lanterns down both walls and one on the table, and the morning coming in at the door past the frame that stands in it.
  'still-meeting': {
    weather: 'motes', haze: { color: '#5a6a70', y: 205, alpha: 0.1 },
    sun: { x: 224, y: 58, color: '#ffe2a8', rays: [{ to: { x: 196, y: 250 }, width: 26 }, { to: { x: 224, y: 256 }, width: 32 }, { to: { x: 256, y: 250 }, width: 30 }] },
    lights: [
      { x: 224, y: 58, r: 40, color: '#f8cf85', kind: 'lamp' },
      { x: 40, y: 16, r: 18, color: '#f8c76f', kind: 'lamp' },
      { x: 15, y: 35, r: 15, color: '#f5bf64', kind: 'lamp' },
      { x: 57, y: 46, r: 16, color: '#f9c265', kind: 'lamp' },
      { x: 98, y: 50, r: 14, color: '#fad77b', kind: 'lamp' },
      { x: 302, y: 11, r: 18, color: '#f7c874', kind: 'lamp' },
      { x: 284, y: 30, r: 14, color: '#f8c86c', kind: 'lamp' },
      { x: 197, y: 118, r: 16, color: '#fcd983', kind: 'lamp' },
    ],
  },
  // The gates open at daybreak: the sun between them, its light coming down the road in shafts.
  'still-dawn': {
    weather: 'motes', haze: { color: '#c08040', y: 185, alpha: 0.1 },
    sun: { x: 155, y: 56, color: '#ffd070', rays: [{ to: { x: 86, y: 236 }, width: 34 }, { to: { x: 155, y: 244 }, width: 40 }, { to: { x: 224, y: 236 }, width: 34 }] },
    lights: [
      { x: 155, y: 56, r: 62, color: '#f5ad30', kind: 'lamp' },
      { x: 141, y: 75, r: 18, color: '#f1a524', kind: 'steady' },
      { x: 176, y: 68, r: 18, color: '#f09e1e', kind: 'steady' },
    ],
  },
};

/** The picture the title is drawn on: as a page of story it is alive in the same way. */
const TITLE_PICTURE = 'still-varn';

/** What falls or rises through a picture: its own, a place's weather, or nothing. */
export function stillWeather(picture: string): StillWeather {
  if (picture === TITLE_PICTURE) return 'rain';
  return Object.hasOwn(STILLS, picture) ? STILLS[picture].weather : weatherFor(picture);
}

/** The lights of a picture of the story as they are at this moment; a place's own lights for a place. */
export function stillLights(picture: string, clockMs: number, calm = false): Glow[] {
  if (picture === TITLE_PICTURE) return titleLights(clockMs, calm);
  if (!Object.hasOwn(STILLS, picture)) return placeLights(picture, clockMs, calm);
  return STILLS[picture].lights.map((light, i) => ({ x: light.x, y: light.y, r: light.r, color: light.color, alpha: LIGHT_ALPHA[light.kind] * lightLevel(light.kind, clockMs, i, calm) }));
}

/** How many notices are falling, and their two colours: lit, and in shade. */
export const PAPERS = 18;
const PAPER_COLORS = ['#f0cf7a', '#c79844'];
const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const wrapTo = (value: number, size: number): number => ((value % size) + size) % size;

/** How far a notice sways to either side of the line it falls along. */
const PAPER_SWAY = 7;

/**
 * Where one of the falling notices is, and how it lies: flat or on its edge. They drift down
 * slowly, swaying, and turn over as they go. The line each falls along is far enough from either
 * side for its sway to stay on the page: none goes off one side and comes back on the other.
 */
export function paperAt(i: number, clockMs: number, w: number, h: number): { x: number; y: number; flat: boolean; lit: boolean } {
  const t = clockMs / 1000;
  const turn = t * (0.5 + 0.4 * scatter(i, 4)) + scatter(i, 5) * 6;
  return {
    x: Math.floor(PAPER_SWAY + scatter(i, 1) * (w - 3 - PAPER_SWAY * 2) + Math.sin(t * 0.6 + i * 1.9) * PAPER_SWAY),
    y: Math.floor(wrapTo(scatter(i, 2) * h + t * (9 + 8 * scatter(i, 3)), h - 3)),
    flat: Math.floor(turn) % 2 === 0,
    lit: Math.floor(turn * 2) % 2 === 0,
  };
}

/** How strong the shafts of a sun are, and how far they sway from side to side. */
export const RAY_ALPHA = 0.1;
export const RAY_SWAY = 6;

/**
 * Draws over a picture what makes it a place: its lights, the shafts of its sun, its haze, and
 * what falls through it. `still` is for a hurried game: the lights stand as they are at the
 * start, and nothing falls. A calm picture has its lights and shafts at half strength and no
 * lightning in its rain. A picture nothing is known about is left as it is.
 */
export function drawStill(ctx: CanvasRenderingContext2D, picture: string, clockMs: number, calm = false, still = false): void {
  const clock = still ? 0 : clockMs;
  const strength = calm ? 0.5 : 1;
  if (picture === TITLE_PICTURE) {
    drawTitleScene(ctx, clock, calm);
    drawSearchlights(ctx, clock, calm);
  } else {
    drawLights(ctx, stillLights(picture, clock, calm), strength);
    const own = Object.hasOwn(STILLS, picture) ? STILLS[picture] : null;
    if (own?.sun) {
      const { sun } = own;
      sun.rays.forEach((ray, i) => {
        const sway = still ? 0 : Math.sin(clock / 2300 + i * 2.1) * RAY_SWAY;
        drawCone(ctx, sun, { x: ray.to.x + sway, y: ray.to.y }, ray.width, sun.color, RAY_ALPHA * strength);
      });
    }
    const haze = own ? own.haze : ambienceFor(picture)?.haze;
    if (haze) drawHaze(ctx, haze, clock, LOGICAL_W, 1);
  }
  if (still) return;
  const weather = stillWeather(picture);
  if (weather === 'paper') {
    for (let i = 0; i < PAPERS; i++) {
      const paper = paperAt(i, clockMs, LOGICAL_W, LOGICAL_H);
      ctx.fillStyle = PAPER_COLORS[paper.lit ? 0 : 1];
      ctx.fillRect(paper.x, paper.y, paper.flat ? 3 : 2, paper.flat ? 2 : 3);
    }
    return;
  }
  drawWeather(ctx, weather, clockMs, LOGICAL_W, LOGICAL_H);
  drawWeatherExtras(ctx, weather, clockMs, LOGICAL_W, LOGICAL_H, calm);
}
