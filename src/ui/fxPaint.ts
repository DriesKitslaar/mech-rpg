import type { DamageType } from '../core/types';
import type { Fx } from './battleFx';
import { disc, drawBeam, fireColor, pixelLine, ringOf, type Glow, type Pt } from './light';
import { COLORS, drawText } from './widgets';

/**
 * How each effect of a battle looks. `paintFx` draws what is solid, on the pixel grid: tongues of
 * flame, tracers, fireballs, rings, sparks, smoke. `lightsOf` says what light the same moment
 * throws, for the screen to add over the field. Neither keeps anything: a moment is drawn from
 * what the effect is and how far through it is, so any moment can be drawn on its own.
 */

export const TYPE_COLOR: Record<DamageType, string> = { kinetic: '#ffe9a8', energy: '#7fe9ff', explosive: '#ffb46b' };
/** The colour a fire throws on what is around it. */
const FIRELIGHT = '#ffb060';
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Rounds without ever producing negative zero. */
const px = (n: number): number => Math.round(n) || 0;
/** Fast at first, slowing to a stop. */
const ease = (p: number): number => 1 - (1 - p) * (1 - p);
const clamp = (p: number): number => Math.max(0, Math.min(1, p));
/** A number from 0 to 1 that depends only on a place and a salt: the same every frame. */
const scatter = (at: Pt, salt: number): number => {
  const x = Math.sin(at.x * 12.9898 + at.y * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
};
const along = (from: Pt, to: Pt, t: number): Pt => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) });
/** A shell's path: the straight line, lifted into a shallow arc. */
const lobbed = (from: Pt, to: Pt, t: number): Pt => ({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) - Math.sin(Math.PI * clamp(t)) * 14 });
/** How far a beam has reached, and how much of it is left as it dies away. */
const beamReach = (p: number): number => Math.min(1, p * 2.5);
const beamFade = (p: number): number => (p < 0.65 ? 1 : (1 - p) / 0.35);
/** Where the first of a burst of tracers is. */
const tracerHead = (p: number): number => Math.min(1, p * 1.15);

/** Fire from a barrel: a white heart at the mouth, a flame that tapers ahead of it, and a short flare up and down. It thins as it goes. */
function muzzle(ctx: CanvasRenderingContext2D, at: Pt, dir: number, color: string, p: number): void {
  const reach = 5 + 10 * (1 - p);
  ctx.globalAlpha = 1 - p * p;
  for (let k = 4; k >= 0; k--) {
    const t = k / 4;
    disc(ctx, at.x + dir * reach * t, at.y, (2.8 - 2.2 * t) * (1 - p * 0.5), k === 0 ? '#ffffff' : color);
  }
  pixelLine(ctx, at, { x: at.x + dir * reach * 1.4, y: at.y }, '#ffffff');
  pixelLine(ctx, { x: at.x, y: at.y - 2 }, { x: at.x, y: at.y - reach * 0.6 }, color);
  pixelLine(ctx, { x: at.x, y: at.y + 2 }, { x: at.x, y: at.y + reach * 0.6 }, color);
  ctx.globalAlpha = 1;
}

function projectile(ctx: CanvasRenderingContext2D, fx: Extract<Fx, { kind: 'projectile' }>, p: number, calm: boolean): void {
  const color = TYPE_COLOR[fx.dtype];
  if (fx.dtype === 'energy') {
    // A beam: it reaches the target at once, burns there, flickers and dies away. Its halo is soft
    // light: a calm picture has it at half strength and holding steady.
    const end = along(fx.from, fx.to, beamReach(p));
    const fade = beamFade(p);
    const flicker = calm || Math.floor(p * 14) % 2 ? 1 : 0.75;
    drawBeam(ctx, fx.from, end, 2.2, color, fade * flicker * (calm ? 0.5 : 1));
    ctx.globalAlpha = fade;
    pixelLine(ctx, fx.from, end, '#ffffff');
    // Where it burns, it spits.
    if (beamReach(p) >= 1) {
      for (let i = 0; i < 4; i++) {
        const a = scatter(fx.to, i + Math.floor(p * 9)) * Math.PI * 2;
        const d = 3 + 6 * scatter(fx.to, i + 20 + Math.floor(p * 9));
        pixelLine(ctx, end, { x: end.x + Math.cos(a) * d, y: end.y + Math.sin(a) * d }, i % 2 ? color : '#ffffff');
      }
    }
    ctx.globalAlpha = 1;
  } else if (fx.dtype === 'explosive') {
    // A shell on a shallow arc, and the smoke it leaves, older and wider the further back.
    for (let k = 7; k >= 1; k--) {
      const t = p - k * 0.045;
      if (t <= 0) continue;
      const at = lobbed(fx.from, fx.to, t);
      ctx.globalAlpha = 0.55 * (1 - k / 8);
      disc(ctx, at.x, at.y + k * 0.3, 1 + k * 0.4, k % 2 ? '#8a8494' : '#6c6678');
    }
    ctx.globalAlpha = 1;
    const head = lobbed(fx.from, fx.to, p);
    disc(ctx, head.x, head.y, 2, color);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px(head.x), px(head.y) - 1, 2, 2);
  } else {
    // Three tracers in quick succession: a dim tail, a bright body, a white head.
    for (let i = 0; i < 3; i++) {
      const t = tracerHead(p) - i * 0.16;
      if (t <= 0) continue;
      const head = along(fx.from, fx.to, Math.min(1, t));
      const mid = along(fx.from, fx.to, Math.max(0, Math.min(1, t) - 0.1));
      const tail = along(fx.from, fx.to, Math.max(0, Math.min(1, t) - 0.26));
      const dy = i - 1;
      ctx.globalAlpha = 0.45;
      pixelLine(ctx, { x: tail.x, y: tail.y + dy }, { x: mid.x, y: mid.y + dy }, color);
      ctx.globalAlpha = 1;
      pixelLine(ctx, { x: mid.x, y: mid.y + dy }, { x: head.x, y: head.y + dy }, color);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px(head.x) - 1, px(head.y + dy) - 1, 2, 2);
    }
  }
}

/** Something struck: a white flash, a ring that opens, and streaks thrown outward. */
function impact(ctx: CanvasRenderingContext2D, at: Pt, size: number, color: string, p: number): void {
  if (p < 0.3) disc(ctx, at.x, at.y, size * (0.45 + p), '#ffffff');
  ctx.globalAlpha = 1 - p;
  ringOf(ctx, at.x, at.y, size * (0.7 + 1.5 * ease(p)), color, p < 0.5 ? 2 : 1);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + scatter(at, i) * 0.8;
    const near = size * (0.6 + 1.7 * ease(p));
    const far = near + (4 + 5 * scatter(at, i + 9)) * (1 - p);
    pixelLine(ctx, { x: at.x + Math.cos(a) * near, y: at.y + Math.sin(a) * near }, { x: at.x + Math.cos(a) * far, y: at.y + Math.sin(a) * far }, i % 2 ? '#ffffff' : color);
  }
  ctx.globalAlpha = 1;
}

/** Something went up: a fireball that billows, burns out through its colours and lifts, a ring ahead of it, and the smoke it turns into. */
function fireball(ctx: CanvasRenderingContext2D, at: Pt, size: number, p: number): void {
  const radius = size * (0.5 + 0.9 * ease(Math.min(1, p * 1.6)));
  // Fire rises as it burns.
  const y = at.y - p * 5;
  // The smoke comes up behind the fire as it cools, and lifts as it thins.
  if (p > 0.3) {
    const lift = (p - 0.3) * 14;
    ctx.globalAlpha = Math.min(0.7, (p - 0.3) * 2.4) * (1 - Math.max(0, (p - 0.7) / 0.3));
    for (let j = 0; j < 4; j++) {
      const ox = (scatter(at, j + 30) - 0.5) * radius * 1.2;
      const oy = (scatter(at, j + 40) - 0.5) * radius * 0.8;
      disc(ctx, at.x + ox, y + oy - lift, radius * (0.55 + 0.12 * j), j % 2 ? '#3d3642' : '#4c4654');
    }
    ctx.globalAlpha = 1;
  }
  if (p < 0.8) {
    const heat = (p / 0.8) * 0.75;
    // A ring of lobes around the middle, so that it billows instead of being a ball: the coolest outside,
    // a hotter layer inside them, and the hottest at the heart.
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + scatter(at, j) * 1.2;
      const d = radius * (0.4 + 0.18 * scatter(at, j + 11));
      disc(ctx, at.x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, radius * (0.5 + 0.14 * scatter(at, j + 21)), fireColor(Math.min(0.99, heat + 0.3)));
    }
    // Small swellings on its edge break the circles up.
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + scatter(at, j + 70) * 0.7;
      disc(ctx, at.x + Math.cos(a) * radius * 0.92, y + Math.sin(a) * radius * 0.8, radius * (0.16 + 0.1 * scatter(at, j + 80)), fireColor(Math.min(0.99, heat + 0.3)));
    }
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + scatter(at, j + 50) * 1.5;
      disc(ctx, at.x + Math.cos(a) * radius * 0.24, y + Math.sin(a) * radius * 0.2, radius * 0.46, fireColor(Math.min(0.99, heat + 0.15)));
    }
    disc(ctx, at.x, y, radius * 0.42, fireColor(heat));
    if (p < 0.22) disc(ctx, at.x, y, radius * 0.6 * (1 - p * 2.5), '#ffffff');
  }
  if (p < 0.55) {
    ctx.globalAlpha = 1 - p / 0.55;
    ringOf(ctx, at.x, at.y, size * (0.8 + 2.6 * (p / 0.55)), '#fff3b8');
    ctx.globalAlpha = 1;
  }
}

/** Something pulsed: a ring of its colour that opens and fades, a paler one behind it. */
function pulse(ctx: CanvasRenderingContext2D, at: Pt, size: number, color: string, p: number): void {
  ctx.globalAlpha = 1 - p;
  ringOf(ctx, at.x, at.y, 2 + size * ease(p), color, 2);
  if (p > 0.15) ringOf(ctx, at.x, at.y, 2 + size * 0.7 * ease(p - 0.15), '#ffffff');
  ctx.globalAlpha = 1;
  if (p < 0.35) disc(ctx, at.x, at.y, size * 0.22 * (1 - p / 0.35), '#ffffff');
}

/** Sparks thrown from a point: each flies out, falls, and draws a short tail behind it. */
function sparks(ctx: CanvasRenderingContext2D, at: Pt, color: string, p: number): void {
  ctx.globalAlpha = 1 - p * p;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + scatter(at, i) * 0.6;
    const d = (14 + 22 * scatter(at, i + 3)) * ease(p);
    const x = at.x + Math.cos(a) * d;
    const y = at.y + Math.sin(a) * d + 14 * p * p;
    const tail = 4 * (1 - p);
    pixelLine(ctx, { x: x - Math.cos(a) * tail, y: y - Math.sin(a) * tail }, { x, y }, i % 3 === 0 ? '#ffffff' : color);
  }
  ctx.globalAlpha = 1;
}

/** Steam let off: two jets from the shoulders that shoot up, billow, drift and thin. */
function steam(ctx: CanvasRenderingContext2D, at: Pt, p: number): void {
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    // Each puff starts a little after the one before it, so the jet has a length.
    const age = clamp(p * 1.2 - (i >> 1) * 0.05);
    if (age <= 0) continue;
    const x = at.x + side * (10 + 14 * age) + Math.sin(age * 5 + i) * 3;
    const y = at.y - 20 - 42 * ease(age) + (i >> 1) * 2;
    ctx.globalAlpha = 0.85 * (1 - age * age);
    disc(ctx, x, y, 2.5 + 7 * age, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#dfe6f5' : '#aab4cc');
  }
  // The first hiss: two short white lines straight up.
  if (p < 0.2) {
    ctx.globalAlpha = 1 - p / 0.2;
    for (const side of [-1, 1]) pixelLine(ctx, { x: at.x + side * 10, y: at.y - 18 }, { x: at.x + side * 11, y: at.y - 34 }, '#ffffff');
  }
  ctx.globalAlpha = 1;
}

/** A blade's arc: a crescent swept across the point of impact, thickest in its middle, with a white edge. */
function slash(ctx: CanvasRenderingContext2D, at: Pt, dir: number, color: string, p: number): void {
  const swept = Math.min(1, p * 2.4);
  ctx.globalAlpha = 1 - p * p;
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    if (t > swept) break;
    const a = -1 + 2 * t;
    const x = at.x - dir * 14 + dir * Math.cos(a) * 26;
    const y = at.y + Math.sin(a) * 30;
    disc(ctx, x, y, 0.6 + 2.2 * Math.sin(Math.PI * t), color);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px(x + dir), px(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

/** A guard: a curved wall between the unit and whoever it faces, bright at its edge. */
function shield(ctx: CanvasRenderingContext2D, at: Pt, dir: number, p: number): void {
  const up = Math.sin(Math.PI * Math.min(1, p * 1.2));
  for (let k = 0; k <= 18; k++) {
    const a = (k / 18 - 0.5) * 1.7;
    const x = at.x + dir * (24 + Math.cos(a) * 12);
    const y = at.y + Math.sin(a) * 38;
    ctx.globalAlpha = up * 0.9;
    ctx.fillStyle = k % 2 ? COLORS.armor : '#ffffff';
    ctx.fillRect(px(x), px(y), 2, 2);
    ctx.globalAlpha = up * 0.3;
    ctx.fillStyle = COLORS.armor;
    ctx.fillRect(px(x - dir * 4), px(y), 3, 2);
  }
  ctx.globalAlpha = 1;
}

/** A charge: motes drawn in towards the weapon, and a white heart that grows where they meet. */
function gather(ctx: CanvasRenderingContext2D, at: Pt, color: string, p: number): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + p * 3;
    const d = (24 + 6 * scatter(at, i)) * (1 - p);
    const x = at.x + Math.cos(a) * d;
    const y = at.y + Math.sin(a) * d;
    pixelLine(ctx, { x, y }, { x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3 }, i % 2 ? color : '#ffffff');
  }
  if (p > 0.3) disc(ctx, at.x, at.y, 1 + 3 * (p - 0.3), '#ffffff');
}

/** A unit that lunges: a jet from its back, and lines of speed streaming off it. */
function streaks(ctx: CanvasRenderingContext2D, from: Pt, dir: number, p: number): void {
  const burn = Math.sin(Math.PI * p);
  // The jet: widest at the nozzle, tapering away behind.
  const nozzle = { x: from.x - dir * 24, y: from.y + 6 };
  const length = 30 * burn;
  ctx.globalAlpha = Math.min(1, burn * 1.4);
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    disc(ctx, nozzle.x - dir * length * t, nozzle.y, (3.2 - 2.6 * t) * burn, k < 2 ? '#ffffff' : k < 4 ? '#bfe8ff' : COLORS.energy);
  }
  ctx.globalAlpha = 0.85 * (1 - p);
  for (let i = 0; i < 9; i++) {
    const len = 14 + ((i * 11) % 22);
    const x = from.x - dir * (20 + len * p * 1.8);
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : COLORS.energy;
    ctx.fillRect(px(dir > 0 ? x - len : x), px(from.y - 36 + i * 9), len, i % 4 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

/** Draws one effect as it is `p` of the way through (0 at its start, 1 at its end). */
export function paintFx(ctx: CanvasRenderingContext2D, fx: Fx, p: number, calm = false): void {
  switch (fx.kind) {
    case 'muzzle': muzzle(ctx, fx.at, fx.dir, TYPE_COLOR[fx.dtype], p); break;
    case 'projectile': projectile(ctx, fx, p, calm); break;
    case 'burst':
      if (fx.style === 'fire') fireball(ctx, fx.at, fx.size, p);
      else if (fx.style === 'ring') pulse(ctx, fx.at, fx.size, fx.color, p);
      else impact(ctx, fx.at, fx.size, fx.color, p);
      break;
    case 'sparks': sparks(ctx, fx.at, fx.color, p); break;
    case 'steam': steam(ctx, fx.at, p); break;
    case 'lunge': streaks(ctx, fx.from, fx.dir, p); break;
    case 'slash': slash(ctx, fx.at, fx.dir, fx.color, p); break;
    case 'shield': shield(ctx, fx.at, fx.dir, p); break;
    case 'gather': gather(ctx, fx.at, fx.color, p); break;
    case 'text': {
      // A figure lands large and settles to its size as it rises.
      const size = p < 0.18 ? 16 + Math.round(8 * (1 - p / 0.18)) : 16;
      ctx.globalAlpha = 1 - p * p;
      // A dark edge all round, so that it can be read over fire as well as over the dark.
      const x = px(fx.at.x);
      const y = px(fx.at.y - 16 * p);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) drawText(ctx, fx.text, x + ox, y + oy, { size, align: 'center', color: '#0a0812' });
      drawText(ctx, fx.text, x, y, { size, align: 'center', color: fx.color });
      ctx.globalAlpha = 1;
      break;
    }
    default: break; // what happens to a unit is applied through its transform
  }
}

/** The light an effect throws as it is `p` of the way through. */
export function lightsOf(fx: Fx, p: number): Glow[] {
  switch (fx.kind) {
    case 'muzzle': return [{ x: fx.at.x + fx.dir * 4, y: fx.at.y, r: 46, color: TYPE_COLOR[fx.dtype], alpha: 0.9 * (1 - p) }];
    case 'projectile': {
      const color = TYPE_COLOR[fx.dtype];
      if (fx.dtype === 'energy') {
        const end = along(fx.from, fx.to, beamReach(p));
        const fade = beamFade(p);
        return [{ x: fx.from.x, y: fx.from.y, r: 22, color, alpha: 0.7 * fade }, { x: end.x, y: end.y, r: 30, color, alpha: 0.9 * fade }];
      }
      const head = fx.dtype === 'explosive' ? lobbed(fx.from, fx.to, p) : along(fx.from, fx.to, tracerHead(p));
      return [{ x: head.x, y: head.y, r: 12, color, alpha: 0.55 }];
    }
    case 'burst':
      if (fx.style === 'fire') {
        const lit: Glow[] = [{ x: fx.at.x, y: fx.at.y, r: fx.size * 4.2, color: FIRELIGHT, alpha: (1 - p) ** 1.5 }];
        // For a moment the whole field is lit by it.
        if (p < 0.3) lit.push({ x: fx.at.x, y: fx.at.y, r: fx.size * 9, color: '#ffd9a0', alpha: 0.35 * (1 - p / 0.3) });
        return lit;
      }
      if (fx.style === 'ring') return [{ x: fx.at.x, y: fx.at.y, r: fx.size * 2.4, color: fx.color, alpha: 0.55 * (1 - p) }];
      return [{ x: fx.at.x, y: fx.at.y, r: 16 + fx.size * 2.2, color: fx.color, alpha: 0.95 * (1 - p) }];
    case 'sparks': return [{ x: fx.at.x, y: fx.at.y, r: 24, color: fx.color, alpha: 0.6 * (1 - p) }];
    case 'slash': return [{ x: fx.at.x, y: fx.at.y, r: 34, color: fx.color, alpha: 0.8 * (1 - p) }];
    case 'shield': return [{ x: fx.at.x + fx.dir * 26, y: fx.at.y, r: 46, color: COLORS.armor, alpha: 0.4 * Math.sin(Math.PI * Math.min(1, p * 1.2)) }];
    case 'gather': return [{ x: fx.at.x, y: fx.at.y, r: 10 + 18 * p, color: fx.color, alpha: 0.25 + 0.55 * p }];
    // The jet behind a unit that lunges.
    case 'lunge': return [{ x: fx.from.x - fx.dir * 30, y: fx.from.y + 6, r: 40, color: COLORS.energy, alpha: 0.75 * Math.sin(Math.PI * p) }];
    default: return [];
  }
}
