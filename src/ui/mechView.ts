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

/** One thing a mech is drawn from: a bar in a joint's colour or a layer's picture, measured from the pose box's corner. */
type Piece = { x: number; y: number; w: number; h: number } & ({ color: string } | { image: CanvasImageSource });

/**
 * What a mech is drawn from, in the order it is drawn in. `sway` moves everything but the legs,
 * which stay planted; `pose` moves each layer by itself (see `pose.ts`). `view` is the view the
 * sprites were asked for: it says where the weapons go and what is drawn over what.
 */
function piecesOf(parts: MechSprites, sway: number, pose: Pose, view: MechView): Piece[] {
  const pieces: Piece[] = [];
  if (view === 'back' && parts.core) {
    // The joints go where the body goes, and lie under everything.
    const body = pose.core ?? { dx: 0, dy: 0 };
    const bx = body.dx;
    const by = sway + body.dy + dropOf(parts);
    for (const joint of [BACK_JOINTS.neck, BACK_JOINTS.shoulders, BACK_JOINTS.waist]) {
      pieces.push({ x: bx + joint.x, y: by + joint.y, w: joint.w, h: joint.h, color: JOINT_DARK });
      // A line of light along its length: down the side of one that stands, along the top of one that lies.
      if (joint.h > joint.w) pieces.push({ x: bx + joint.x + 1, y: by + joint.y, w: 2, h: joint.h, color: JOINT_LIT });
      else pieces.push({ x: bx + joint.x, y: by + joint.y + 1, w: joint.w, h: 2, color: JOINT_LIT });
    }
  }
  for (const cmd of layoutMech(parts, view)) {
    const sprite = parts[cmd.slot]!;
    const lift = cmd.slot === 'legs' ? 0 : sway;
    const moved = pose[cmd.slot] ?? { dx: 0, dy: 0 };
    pieces.push({ x: cmd.x + moved.dx, y: cmd.y + lift + moved.dy, w: sprite.w, h: sprite.h, image: sprite.image });
  }
  return pieces;
}

/** Puts a mech's pieces on a canvas, one over the other, with the pose box's corner at (x, y). */
function put(ctx: CanvasRenderingContext2D, pieces: Piece[], x: number, y: number): void {
  for (const piece of pieces) {
    if ('image' in piece) ctx.drawImage(piece.image, x + piece.x, y + piece.y, piece.w, piece.h);
    else {
      ctx.fillStyle = piece.color;
      ctx.fillRect(x + piece.x, y + piece.y, piece.w, piece.h);
    }
  }
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
  put(ctx, piecesOf(parts, sway, pose, view), x + shift.dx, y + shift.dy);
}

/**
 * Lays a mech on the canvas as one picture, where `drawMech` would draw it: the whole of it is
 * drawn on a sheet of its own first, and the sheet is laid on. That is for laying a mech over
 * itself as light. Laid on layer by layer, a layer that lies under another would add its light
 * through the one over it: the body would shine through an arm. Whole, only what is seen of the
 * mech is added to it. The store lends the sheet; where it has none to lend, the layers are laid
 * on one by one after all.
 */
export function layMech(
  ctx: CanvasRenderingContext2D, store: SpriteStore, parts: MechSprites, x: number, y: number,
  shift: { dx: number; dy: number } = { dx: 0, dy: 0 }, sway = 0, pose: Pose = {}, view: MechView = 'front',
): void {
  const pieces = piecesOf(parts, sway, pose, view);
  if (pieces.length === 0) return;
  // The box that holds all of it, on whole pixels.
  const left = Math.floor(Math.min(...pieces.map((piece) => piece.x)));
  const top = Math.floor(Math.min(...pieces.map((piece) => piece.y)));
  const w = Math.ceil(Math.max(...pieces.map((piece) => piece.x + piece.w))) - left;
  const h = Math.ceil(Math.max(...pieces.map((piece) => piece.y + piece.h))) - top;
  const sheet = store.sheet?.(w, h) ?? null;
  if (!sheet) return put(ctx, pieces, x + shift.dx, y + shift.dy);
  sheet.ctx.clearRect(0, 0, w, h);
  put(sheet.ctx, pieces, -left, -top);
  ctx.drawImage(sheet.image, 0, 0, w, h, x + shift.dx + left, y + shift.dy + top, w, h);
}
