import { drawGlow, type Glow } from './light';

/**
 * What makes a place more than a picture. Every background has lamps, signs or fire in it; here
 * they are told where they are, so that they can glow and never quite hold still. A low haze
 * drifts across the ground, and the edges of the field are a little darker than its middle. All of
 * it follows from the clock alone, so nothing has to be remembered between frames, and all of it is
 * soft light: a canvas that cannot make a gradient is left as it is.
 */

/** How a place's lights behave: signs that hum and now and then drop out, lamps that breathe, fire that flickers, or light that only swells a little. */
export type LightKind = 'neon' | 'lamp' | 'fire' | 'steady';
export interface PlaceLight { x: number; y: number; r: number; color: string }
export interface Ambience {
  kind: LightKind;
  lights: PlaceLight[];
  /** A haze over the ground: its colour, the height it lies at, and how thick it is. */
  haze?: { color: string; y: number; alpha: number };
}

/** How bright each kind of light is at its brightest. */
export const LIGHT_ALPHA: Record<LightKind, number> = { neon: 0.34, lamp: 0.3, fire: 0.38, steady: 0.26 };

/** The lights and the haze of each background. The lights sit on what is drawn there: a sign, a lamp, a ladle of iron. */
export const AMBIENCE: Record<string, Ambience> = {
  'bg-arena': {
    kind: 'neon', haze: { color: '#3a4a6a', y: 168, alpha: 0.08 },
    lights: [{ x: 234, y: 60, r: 42, color: '#26c0ff' }, { x: 74, y: 59, r: 42, color: '#ff2791' }, { x: 18, y: 20, r: 30, color: '#cfe6ff' }, { x: 158, y: 46, r: 26, color: '#cfe6ff' }, { x: 293, y: 20, r: 30, color: '#cfe6ff' }],
  },
  'bg-clearing': {
    kind: 'lamp', haze: { color: '#806a30', y: 168, alpha: 0.08 },
    lights: [{ x: 249, y: 41, r: 30, color: '#ffca26' }, { x: 58, y: 41, r: 28, color: '#ffc826' }, { x: 303, y: 72, r: 36, color: '#ffc827' }, { x: 4, y: 72, r: 35, color: '#ffd126' }, { x: 207, y: 94, r: 23, color: '#ffce29' }, { x: 101, y: 95, r: 22, color: '#ffc726' }],
  },
  'bg-foundry': {
    kind: 'fire', haze: { color: '#a04a20', y: 165, alpha: 0.16 },
    lights: [{ x: 245, y: 149, r: 34, color: '#ff3b26' }, { x: 178, y: 141, r: 33, color: '#ff5926' }, { x: 146, y: 163, r: 35, color: '#ff4526' }, { x: 69, y: 98, r: 35, color: '#ff2726' }, { x: 19, y: 138, r: 17, color: '#ff4c26' }, { x: 93, y: 165, r: 25, color: '#ff4126' }],
  },
  'bg-garage': {
    kind: 'neon',
    lights: [{ x: 107, y: 109, r: 21, color: '#26c6ff' }, { x: 205, y: 109, r: 22, color: '#26c7ff' }, { x: 10, y: 112, r: 22, color: '#ff57d2' }, { x: 290, y: 103, r: 23, color: '#ff57d2' }, { x: 34, y: 18, r: 17, color: '#ff3bc9' }, { x: 275, y: 18, r: 17, color: '#ff53c9' }],
  },
  'bg-mine': {
    kind: 'lamp', haze: { color: '#8a7440', y: 160, alpha: 0.14 },
    lights: [{ x: 288, y: 145, r: 20, color: '#ffc926' }, { x: 20, y: 146, r: 20, color: '#ffcb26' }, { x: 31, y: 24, r: 22, color: '#ffbb26' }, { x: 212, y: 148, r: 18, color: '#ffd83f' }, { x: 241, y: 19, r: 16, color: '#ffb826' }, { x: 277, y: 107, r: 16, color: '#ffd32f' }],
  },
  'bg-neon-district': {
    kind: 'neon', haze: { color: '#3a6aa0', y: 160, alpha: 0.16 },
    lights: [{ x: 66, y: 107, r: 26, color: '#29bfff' }, { x: 139, y: 97, r: 35, color: '#ba45ff' }, { x: 284, y: 21, r: 19, color: '#26d8ff' }, { x: 212, y: 88, r: 25, color: '#26d7ff' }, { x: 235, y: 164, r: 20, color: '#a74aff' }],
  },
  'bg-plaza': {
    kind: 'neon', haze: { color: '#5aa0b0', y: 168, alpha: 0.08 },
    lights: [{ x: 29, y: 98, r: 24, color: '#26f2ff' }, { x: 256, y: 95, r: 28, color: '#26f0ff' }, { x: 254, y: 52, r: 42, color: '#26eeff' }, { x: 298, y: 97, r: 35, color: '#26f2ff' }, { x: 257, y: 138, r: 33, color: '#26edff' }, { x: 79, y: 149, r: 16, color: '#26f4ff' }],
  },
  'bg-rooftop': {
    kind: 'lamp', haze: { color: '#a05a40', y: 150, alpha: 0.1 },
    lights: [{ x: 46, y: 76, r: 24, color: '#ff8945' }, { x: 83, y: 79, r: 23, color: '#ff983f' }, { x: 239, y: 78, r: 23, color: '#ff9242' }, { x: 298, y: 63, r: 21, color: '#ff794c' }, { x: 10, y: 80, r: 20, color: '#ff8346' }],
  },
  'bg-simulator': {
    kind: 'steady',
    lights: [{ x: 154, y: 155, r: 42, color: '#26b5ff' }, { x: 61, y: 157, r: 19, color: '#26b4ff' }, { x: 88, y: 168, r: 20, color: '#26c9ff' }, { x: 7, y: 156, r: 17, color: '#26b7ff' }, { x: 261, y: 157, r: 16, color: '#26adff' }],
  },
  'bg-sluice': {
    kind: 'lamp', haze: { color: '#4a80a0', y: 165, alpha: 0.16 },
    lights: [{ x: 155, y: 145, r: 35, color: '#48caff' }, { x: 70, y: 33, r: 16, color: '#ffa526' }, { x: 182, y: 73, r: 25, color: '#ff7d26' }, { x: 243, y: 32, r: 15, color: '#ffa726' }, { x: 128, y: 73, r: 26, color: '#ff7d28' }, { x: 245, y: 69, r: 14, color: '#26ffe9' }],
  },
  'bg-undercity': {
    kind: 'lamp', haze: { color: '#5a7a80', y: 162, alpha: 0.14 },
    lights: [{ x: 269, y: 126, r: 29, color: '#ff8838' }, { x: 72, y: 162, r: 21, color: '#ff8c3e' }, { x: 194, y: 162, r: 17, color: '#ff8a3b' }, { x: 77, y: 108, r: 16, color: '#65ffe9' }, { x: 254, y: 91, r: 14, color: '#ff7d2f' }, { x: 203, y: 103, r: 14, color: '#ff7a2f' }],
  },
  'bg-vault': {
    kind: 'steady', haze: { color: '#7ab0c8', y: 168, alpha: 0.12 },
    lights: [{ x: 16, y: 104, r: 42, color: '#26c9ff' }, { x: 293, y: 96, r: 42, color: '#26ceff' }, { x: 247, y: 116, r: 42, color: '#26d8ff' }, { x: 62, y: 95, r: 42, color: '#26d8ff' }, { x: 114, y: 144, r: 33, color: '#73e8ff' }, { x: 265, y: 170, r: 18, color: '#26d5ff' }],
  },
};

export const ambienceFor = (background: string): Ambience | null => (Object.hasOwn(AMBIENCE, background) ? AMBIENCE[background] : null);

/** A number from 0 to 1 that depends only on the two it is given: the same every frame. */
const scatter = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * How bright a light of this kind is right now, from 0 to 1. `i` tells one light of a place from
 * another, so that they do not move together. A calm picture has no sign dropping out: its lights
 * only swell and fade.
 */
export function lightLevel(kind: LightKind, clockMs: number, i: number, calm = false): number {
  const t = clockMs / 1000;
  switch (kind) {
    case 'neon': {
      const hum = 0.86 + 0.14 * Math.sin(t * 2.1 + i * 1.7);
      // Now and then a sign drops out for a twelfth of a second.
      const out = !calm && scatter(Math.floor(t * 12), i + 1) < 0.03;
      return out ? hum * 0.3 : hum;
    }
    case 'lamp': return 0.8 + 0.2 * Math.sin(t * 0.9 + i * 2.3);
    case 'fire': return calm ? 0.8 + 0.1 * Math.sin(t * 1.3 + i) : 0.7 + 0.2 * Math.sin(t * 5.3 + i) + 0.1 * Math.sin(t * 11.7 + i * 3);
    case 'steady': return 0.86 + 0.14 * Math.sin(t * 1.4 + i);
  }
}

/** The lights of a place as they are at this moment. */
export function placeLights(background: string, clockMs: number, calm = false): Glow[] {
  const place = ambienceFor(background);
  if (!place) return [];
  return place.lights.map((light, i) => ({ ...light, alpha: LIGHT_ALPHA[place.kind] * lightLevel(place.kind, clockMs, i, calm) }));
}

/** How many banks of haze drift over a field at once. */
const BANKS = 3;

/** A low haze: wide, flat banks of the place's colour that drift across the ground and come round again. */
export function drawHaze(ctx: CanvasRenderingContext2D, haze: NonNullable<Ambience['haze']>, clockMs: number, w: number, share: number): void {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(haze.color.slice(at, at + 2), 16));
  const t = clockMs / 1000;
  for (let i = 0; i < BANKS; i++) {
    const rx = 90 + 30 * scatter(i, 7);
    const span = w + rx * 2;
    const x = ((scatter(i, 3) * span + t * (5 + 4 * i)) % span) - rx;
    const y = haze.y + (i - 1) * 5 + Math.sin(t * 0.3 + i * 2) * 2;
    const gradient = ctx.createRadialGradient?.(0, 0, 0, 0, 0, rx) as CanvasGradient | undefined;
    if (!gradient || typeof gradient.addColorStop !== 'function') return;
    const alpha = haze.alpha * share * (0.8 + 0.2 * Math.sin(t * 0.5 + i));
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.18);
    ctx.fillStyle = gradient;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
}

/** The edges of the field are darker than its middle: the eye is kept where the machines are. */
export function drawVignette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const reach = Math.hypot(w, h) / 2;
  const gradient = ctx.createRadialGradient?.(x + w / 2, y + h / 2, reach * 0.55, x + w / 2, y + h / 2, reach) as CanvasGradient | undefined;
  if (!gradient || typeof gradient.addColorStop !== 'function') return;
  gradient.addColorStop(0, 'rgba(4, 4, 14, 0)');
  gradient.addColorStop(1, 'rgba(4, 4, 14, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draws what a place adds to its picture. `behind` goes over the background and under everything
 * that stands on it: the darker edges, the lights of the place, and most of the haze. `front` goes
 * over the units: the last thin layer of haze, at their feet. The field is the part of the screen
 * from `top` down for `height`.
 */
export function drawAmbience(
  ctx: CanvasRenderingContext2D, background: string, clockMs: number, layer: 'behind' | 'front', field: { top: number; height: number; width: number }, calm = false,
): void {
  const place = ambienceFor(background);
  if (layer === 'behind') {
    drawVignette(ctx, 0, field.top, field.width, field.height);
    for (const light of placeLights(background, clockMs, calm)) drawGlow(ctx, light, calm ? 0.5 : 1);
    if (place?.haze) drawHaze(ctx, place.haze, clockMs, field.width, 0.7);
    return;
  }
  if (place?.haze) drawHaze(ctx, { ...place.haze, y: place.haze.y + 6 }, clockMs + 40000, field.width, 0.45);
}
