import type { Build } from '../core/types';
import { BACK_JOINTS, MECH_BOX, VIEWS, dropOf, layoutMech, type MechView, type SpriteSize, type SpriteSlot } from './mechLayout';
import type { Pose } from './pose';
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

/** The colours of a joint seen between two layers: dark steel, and the light along one side of it. */
export const JOINT_DARK = '#1b1a24';
export const JOINT_LIT = '#3a3948';

const FRAME_LAYERS: SpriteSlot[] = ['armFar', 'legs', 'core', 'head', 'armNear'];

/** The placeholder of a layer in a view: where it sits from the front, in that view's smaller box. */
function fallbackFor(slot: SpriteSlot, view: MechView): SpriteSize {
  const k = VIEWS[view].box / MECH_BOX;
  const { w, h, ox, oy } = FALLBACK[slot];
  const at = (n: number | undefined): number | undefined => (n === undefined ? undefined : Math.round(n * k));
  return { w: Math.round(w * k), h: Math.round(h * k), ...(ox !== undefined ? { ox: at(ox), oy: at(oy) } : {}) };
}

/**
 * The sprites that make up a build's mech in a view of it, with placeholders for any that are
 * missing. With a paint scheme the frame layers come in that scheme; weapons keep their own colours.
 */
export function mechSprites(store: SpriteStore, build: Build, paint?: string, view: MechView = 'front'): MechSprites {
  const parts: MechSprites = {};
  for (const slot of Object.keys(SPRITE_ID) as SpriteSlot[]) {
    const part = SPRITE_ID[slot](build);
    if (!part) continue;
    const id = `${part}${VIEWS[view].suffix}`;
    const fallback = { ...fallbackFor(slot, view), label: id };
    parts[slot] = paint && store.painted && FRAME_LAYERS.includes(slot) ? store.painted(id, paint, fallback) : store.get(id, fallback);
  }
  return parts;
}

/**
 * Draws a mech with its pose box at (x, y). `shift` moves the whole mech; `sway` moves everything
 * but the legs, which stay planted; `pose` moves each layer by itself (see `pose.ts`). `view` is the
 * view the sprites were asked for: it says where the weapons go and what is drawn over what.
 */
export function drawMech(
  ctx: CanvasRenderingContext2D, parts: MechSprites, x: number, y: number,
  shift: { dx: number; dy: number } = { dx: 0, dy: 0 }, sway = 0, pose: Pose = {}, view: MechView = 'front',
): void {
  if (view === 'back' && parts.core) {
    // The joints go where the body goes, and lie under everything.
    const body = pose.core ?? { dx: 0, dy: 0 };
    const bx = x + shift.dx + body.dx;
    const by = y + shift.dy + sway + body.dy + dropOf(parts);
    for (const joint of [BACK_JOINTS.neck, BACK_JOINTS.shoulders, BACK_JOINTS.waist]) {
      ctx.fillStyle = JOINT_DARK;
      ctx.fillRect(bx + joint.x, by + joint.y, joint.w, joint.h);
      // A line of light along its length: down the side of one that stands, along the top of one that lies.
      ctx.fillStyle = JOINT_LIT;
      if (joint.h > joint.w) ctx.fillRect(bx + joint.x + 1, by + joint.y, 2, joint.h);
      else ctx.fillRect(bx + joint.x, by + joint.y + 1, joint.w, 2);
    }
  }
  for (const cmd of layoutMech(parts, view)) {
    const sprite = parts[cmd.slot]!;
    const lift = cmd.slot === 'legs' ? 0 : sway;
    const moved = pose[cmd.slot] ?? { dx: 0, dy: 0 };
    ctx.drawImage(sprite.image, x + cmd.x + shift.dx + moved.dx, y + cmd.y + shift.dy + lift + moved.dy, sprite.w, sprite.h);
  }
}
