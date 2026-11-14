import type { Build } from '../core/types';
import { layoutMech, type SpriteSize, type SpriteSlot } from './mechLayout';
import type { Sprite, SpriteStore } from './sprites';

/** Placeholder boxes, roughly where each layer sits in the pose, for when a sprite is missing. */
const FALLBACK: Record<SpriteSlot, SpriteSize> = {
  armFar: { w: 30, h: 42, ox: 18, oy: 38 }, legs: { w: 96, h: 84, ox: 14, oy: 72 }, core: { w: 42, h: 52, ox: 54, oy: 28 },
  head: { w: 24, h: 24, ox: 66, oy: 6 }, armNear: { w: 54, h: 30, ox: 88, oy: 34 },
  rightHand: { w: 58, h: 22 }, leftHand: { w: 40, h: 20 }, shoulder: { w: 44, h: 26 },
};

/** Which sprite a slot shows for a build: the arms part supplies two layers. */
const SPRITE_ID: Record<SpriteSlot, (build: Build) => string | undefined> = {
  armFar: (b) => b.arms && `${b.arms}.far`,
  legs: (b) => b.legs,
  core: (b) => b.core,
  head: (b) => b.head,
  armNear: (b) => b.arms && `${b.arms}.near`,
  rightHand: (b) => b.rightHand,
  leftHand: (b) => b.leftHand,
  shoulder: (b) => b.shoulder,
};

export type MechSprites = Partial<Record<SpriteSlot, Sprite>>;

const FRAME_LAYERS: SpriteSlot[] = ['armFar', 'legs', 'core', 'head', 'armNear'];

/**
 * The sprites that make up a build's mech, with placeholders for any that are missing.
 * With a paint scheme the frame layers come in that scheme; weapons keep their own colours.
 */
export function mechSprites(store: SpriteStore, build: Build, paint?: string): MechSprites {
  const parts: MechSprites = {};
  for (const slot of Object.keys(SPRITE_ID) as SpriteSlot[]) {
    const id = SPRITE_ID[slot](build);
    if (!id) continue;
    const fallback = { ...FALLBACK[slot], label: id };
    parts[slot] = paint && store.painted && FRAME_LAYERS.includes(slot) ? store.painted(id, paint, fallback) : store.get(id, fallback);
  }
  return parts;
}

/**
 * Draws a mech with its pose box at (x, y). `shift` moves the whole mech; `sway` moves everything
 * but the legs, which stay planted.
 */
export function drawMech(
  ctx: CanvasRenderingContext2D, parts: MechSprites, x: number, y: number,
  shift: { dx: number; dy: number } = { dx: 0, dy: 0 }, sway = 0,
): void {
  for (const cmd of layoutMech(parts)) {
    const sprite = parts[cmd.slot]!;
    const lift = cmd.slot === 'legs' ? 0 : sway;
    ctx.drawImage(sprite.image, x + cmd.x + shift.dx, y + cmd.y + shift.dy + lift, sprite.w, sprite.h);
  }
}
