import type { Glow } from './light';

/**
 * Machines that look back. Every machine the pilot meets has something on its picture that it sees
 * with: a lens, a visor, a lamp. Here each is told where that is (found on the picture itself,
 * looked at close up), so that a small light can sit on it: steady while the machine is itself,
 * narrowing for a moment every few seconds, sputtering while the machine is staggered or cooked.
 * Everything follows from the clock.
 */

/** Where a machine's eye is on its picture, how far its light reaches, and what colour it is. */
export interface Eye { x: number; y: number; r: number; color: string }

export const EYES: Record<string, Eye> = {
  // Frames built like the pilot's: a visor in a helmet.
  'enemy-rival': { x: 57, y: 25, r: 7, color: '#eb22be' },
  'enemy-bailiff': { x: 45, y: 15, r: 6, color: '#ffcf5a' },
  'enemy-light-mech': { x: 39, y: 13, r: 7, color: '#13edfb' },
  'enemy-heavy-mech': { x: 38, y: 10, r: 7, color: '#fff0c0' },
  'enemy-stalker': { x: 45, y: 13, r: 6, color: '#ff9a3c' },
  'enemy-juggernaut': { x: 43, y: 16, r: 6, color: '#cfe6ff' },
  'enemy-ripper': { x: 41, y: 16, r: 6, color: '#f9db77' },
  // What rolls, walks or stands: a lamp, a lens, a light on a mast.
  'enemy-mortar-nest': { x: 47, y: 20, r: 6, color: '#ffe6a0' },
  'enemy-flak-walker': { x: 14, y: 24, r: 6, color: '#f2bf1e' },
  'enemy-breacher': { x: 24, y: 8, r: 6, color: '#ffe6a0' },
  'enemy-arc-pylon': { x: 12, y: 9, r: 8, color: '#13edfb' },
  'enemy-gun-turret': { x: 28, y: 8, r: 5, color: '#eb22be' },
  'enemy-tank': { x: 34, y: 10, r: 5, color: '#f0a020' },
  'enemy-lance-tower': { x: 44, y: 11, r: 6, color: '#eb22be' },
  'enemy-jammer': { x: 13, y: 19, r: 5, color: '#eb22be' },
  'enemy-bomb-crawler': { x: 26, y: 3, r: 6, color: '#ff3030' },
  'enemy-carrier': { x: 7, y: 13, r: 5, color: '#eb22be' },
  // What flies.
  'enemy-hunter-drone': { x: 9, y: 22, r: 5, color: '#f5d547' },
  'enemy-longshot': { x: 29, y: 4, r: 5, color: '#cfe6ff' },
  'enemy-recon-drone': { x: 13, y: 24, r: 6, color: '#eb22be' },
  'enemy-gunship': { x: 20, y: 16, r: 6, color: '#eb22be' },
  'enemy-shield-drone': { x: 51, y: 31, r: 7, color: '#26c9ff' },
  'enemy-repair-drone': { x: 47, y: 20, r: 6, color: '#f5d547' },
  'enemy-lien-drone': { x: 10, y: 24, r: 5, color: '#fbfbf9' },
  // The great machines.
  'boss-scrap-king': { x: 52, y: 42, r: 10, color: '#f2bf1e' },
  'boss-night-train': { x: 33, y: 54, r: 9, color: '#eb22be' },
  'boss-strip-miner': { x: 102, y: 49, r: 9, color: '#fff0c0' },
  'boss-overseer': { x: 70, y: 58, r: 14, color: '#26c9ff' },
  'boss-leviathan': { x: 53, y: 67, r: 9, color: '#f2bf1e' },
  'boss-adjuster': { x: 57, y: 29, r: 8, color: '#ffcf5a' },
};

/** The eye of the machine with this picture, or null where none is known. */
export const eyeOf = (sprite: string): Eye | null => (Object.hasOwn(EYES, sprite) ? EYES[sprite] : null);

/** A machine is itself, or it is staggered or cooked and its eye sputters. */
export type EyeState = 'awake' | 'dazed';
/** How bright an eye is at its brightest. */
export const EYE_ALPHA = 0.5;
/** How often an eye narrows, and for how long. */
export const BLINK_EVERY_MS = 4600;
export const BLINK_MS = 130;

const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * How open a machine's eye is right now, from 0 to 1. `i` tells one machine from another, so that
 * they do not blink together. Awake, it glows and swells a little, and every few seconds narrows
 * for a moment; dazed, it is low and sputters. A calm picture has no blink and no sputter: the eye
 * holds, low when the machine is dazed.
 */
export function eyeLevel(clockMs: number, i: number, state: EyeState, calm = false): number {
  if (state === 'dazed') return calm ? 0.35 : 0.25 + 0.2 * Math.abs(Math.sin(clockMs / 70 + i * 1.3));
  const glow = 0.85 + 0.15 * Math.sin(clockMs / 590 + i * 2.1);
  if (calm) return glow;
  // Once in every stretch of time, at a moment in it that differs from machine to machine and from stretch to stretch.
  const slot = Math.floor(clockMs / BLINK_EVERY_MS);
  const at = clockMs - slot * BLINK_EVERY_MS - scatter(slot, i + 3) * (BLINK_EVERY_MS - BLINK_MS);
  return at >= 0 && at < BLINK_MS ? glow * 0.2 : glow;
}

/** The light of a machine's eye, with the corner of the machine's picture at `x`, `y`; null for a machine without one. */
export function eyeLight(sprite: string, x: number, y: number, clockMs: number, i: number, state: EyeState, calm = false): Glow | null {
  const eye = eyeOf(sprite);
  if (!eye) return null;
  return { x: x + eye.x, y: y + eye.y, r: eye.r, color: eye.color, alpha: EYE_ALPHA * eyeLevel(clockMs, i, state, calm) };
}
