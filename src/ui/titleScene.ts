import { LIGHT_ALPHA, drawHaze, drawVignette, lightLevel } from './ambience';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawCone, drawGlow, type Glow } from './light';

/**
 * What makes the title's picture a place: Varn at night, in the rain. The lamps of the mine
 * breathe, the windows of the city and of the houses on the water glow, the beacons on the stack
 * come and go, two searchlights lean about over the towers, mist drifts over the water, and the
 * machine that stands looking at all of it has its eye open. Where the lights are was found in
 * the picture itself: its brightest spots. Everything follows from the clock.
 */

/** How a light of the picture behaves: a lamp breathes, a window holds, a beacon comes and goes, the eye looks. */
export type TitleKind = 'lamp' | 'steady' | 'beacon' | 'eye';
export interface TitleLight { x: number; y: number; r: number; color: string; kind: TitleKind }

export const TITLE_LIGHTS: TitleLight[] = [
  // The mine: the floodlit floor, the machines on its terraces, the lamps along its rim.
  { x: 54, y: 149, r: 34, color: '#e5c33e', kind: 'lamp' },
  { x: 42, y: 102, r: 22, color: '#e4c43e', kind: 'lamp' },
  { x: 36, y: 118, r: 18, color: '#e3c03e', kind: 'lamp' },
  { x: 55, y: 73, r: 13, color: '#dac44d', kind: 'lamp' },
  { x: 8, y: 80, r: 11, color: '#ddc62e', kind: 'lamp' },
  { x: 92, y: 80, r: 10, color: '#cdba33', kind: 'lamp' },
  { x: 10, y: 147, r: 13, color: '#d3a934', kind: 'lamp' },
  // The houses on the water.
  { x: 276, y: 195, r: 16, color: '#de6a27', kind: 'lamp' },
  { x: 90, y: 239, r: 12, color: '#e6932a', kind: 'lamp' },
  { x: 30, y: 200, r: 10, color: '#e1ac3a', kind: 'lamp' },
  // The city.
  { x: 265, y: 85, r: 22, color: '#52ced7', kind: 'steady' },
  { x: 201, y: 103, r: 12, color: '#aae6eb', kind: 'steady' },
  { x: 187, y: 42, r: 16, color: '#cfe6ff', kind: 'steady' },
  // The stack's beacons.
  { x: 294, y: 72, r: 9, color: '#ff5a30', kind: 'beacon' },
  { x: 300, y: 66, r: 8, color: '#ff4a28', kind: 'beacon' },
  { x: 297, y: 126, r: 9, color: '#ff4a20', kind: 'beacon' },
  // The machine on the roof.
  { x: 229, y: 167, r: 8, color: '#6fe0e0', kind: 'eye' },
];

/** How bright each kind is at its brightest. */
export const TITLE_ALPHA: Record<TitleKind, number> = { lamp: LIGHT_ALPHA.lamp, steady: LIGHT_ALPHA.steady, beacon: 0.7, eye: 0.55 };

/**
 * How bright a light of the picture is right now, from 0 to 1. A beacon swells and dies in a
 * second and is dark for the next; the eye holds, and every few seconds narrows for a moment. A
 * calm picture has its beacons and the eye holding steady.
 */
export function titleLevel(kind: TitleKind, clockMs: number, i: number, calm = false): number {
  const t = clockMs / 1000;
  switch (kind) {
    case 'lamp':
    case 'steady':
      return lightLevel(kind, clockMs, i, calm);
    case 'beacon': {
      if (calm) return 0.6;
      const turn = (t * 0.5 + i * 0.31) % 1;
      return turn < 0.5 ? Math.sin((turn / 0.5) * Math.PI) ** 2 : 0;
    }
    case 'eye': {
      if (calm) return 0.8;
      const blink = (t % 6.5) - 5.2;
      return blink >= 0 && blink < 0.16 ? 0.25 : 0.8 + 0.2 * Math.sin(t * 1.7);
    }
  }
}

/** The lights of the picture as they are at this moment. */
export function titleLights(clockMs: number, calm = false): Glow[] {
  return TITLE_LIGHTS.map((light, i) => ({ x: light.x, y: light.y, r: light.r, color: light.color, alpha: TITLE_ALPHA[light.kind] * titleLevel(light.kind, clockMs, i, calm) }));
}

/** A searchlight on a tower: where it stands, which way it leans from straight up, how far it swings and how fast. */
export interface Searchlight { x: number; y: number; lean: number; swing: number; pace: number; color: string }
export const SEARCHLIGHTS: Searchlight[] = [
  { x: 201, y: 82, lean: -0.6, swing: 0.34, pace: 0.11, color: '#cfe6ff' },
  { x: 263, y: 80, lean: -0.08, swing: 0.4, pace: 0.083, color: '#8fe8f0' },
];
/** How far a searchlight reaches, how wide it is at its end, and how bright at its foot. */
export const BEAM_REACH = 170;
export const BEAM_WIDTH = 34;
export const BEAM_ALPHA = 0.22;

/** Where a searchlight points at this moment: the far end of its beam. */
export function beamEnd(light: Searchlight, clockMs: number, i: number): { x: number; y: number } {
  const angle = light.lean + light.swing * Math.sin((clockMs / 1000) * light.pace * Math.PI * 2 + i * 2.1);
  return { x: light.x + Math.sin(angle) * BEAM_REACH, y: light.y - Math.cos(angle) * BEAM_REACH };
}

/** The mist over the water between the mine and the city. */
export const TITLE_HAZE = { color: '#5a8494', y: 128, alpha: 0.13 };

/**
 * Draws what the picture is given: darker edges, its lights and the mist. Soft light only; a calm
 * picture has it at half strength.
 */
export function drawTitleScene(ctx: CanvasRenderingContext2D, clockMs: number, calm = false): void {
  drawVignette(ctx, 0, 0, LOGICAL_W, LOGICAL_H);
  for (const glow of titleLights(clockMs, calm)) drawGlow(ctx, glow, calm ? 0.5 : 1);
  drawHaze(ctx, TITLE_HAZE, clockMs, LOGICAL_W, 1);
}

/** The searchlights. They stand on roofs under the sign and lean about over the city, so they cross the sign: they are drawn over it. */
export function drawSearchlights(ctx: CanvasRenderingContext2D, clockMs: number, calm = false): void {
  SEARCHLIGHTS.forEach((light, i) => drawCone(ctx, light, beamEnd(light, clockMs, i), BEAM_WIDTH, light.color, calm ? BEAM_ALPHA / 2 : BEAM_ALPHA));
}
