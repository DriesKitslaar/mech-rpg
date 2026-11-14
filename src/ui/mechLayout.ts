/**
 * A mech is drawn from layers that were all cut from full drawings in one shared pose.
 * Frame layers therefore carry their own position; only weapons are placed by anchor points.
 */
export type SpriteSlot = 'armFar' | 'legs' | 'core' | 'head' | 'armNear' | 'rightHand' | 'leftHand' | 'shoulder';
/** `ox`/`oy` is where a frame layer sits inside the pose box. Weapons have none. */
export type SpriteSize = { w: number; h: number; ox?: number; oy?: number };
export type DrawCmd = { slot: SpriteSlot; x: number; y: number };

/** Side of the square pose box, in logical pixels. */
export const MECH_BOX = 160;
/** Centre of the fist of the arm stretched towards the enemy. */
export const NEAR_FIST = { x: 135, y: 52 };
/** Centre of the fist of the arm held back behind the body. */
export const FAR_FIST = { x: 31, y: 80 };
/** Where a shoulder weapon rests, behind the far shoulder. */
export const BACK_MOUNT = { x: 46, y: 27 };

const FRAME: SpriteSlot[] = ['armFar', 'legs', 'core', 'head', 'armNear'];
const ORDER: SpriteSlot[] = ['shoulder', 'armFar', 'leftHand', 'legs', 'core', 'head', 'armNear', 'rightHand'];

/** Returns top-left corners inside the pose box, in draw order (back to front). */
export function layoutMech(sizes: Partial<Record<SpriteSlot, SpriteSize>>): DrawCmd[] {
  const placed = new Map<SpriteSlot, DrawCmd>();
  const put = (slot: SpriteSlot, x: number, y: number) => placed.set(slot, { slot, x: Math.round(x), y: Math.round(y) });

  for (const slot of FRAME) {
    const s = sizes[slot];
    if (s) put(slot, s.ox ?? 0, s.oy ?? 0);
  }
  const { rightHand, leftHand, shoulder } = sizes;
  // Hand weapons are gripped a fifth of the way along; without the arm there is nothing to hold them.
  if (rightHand && sizes.armNear) put('rightHand', NEAR_FIST.x - 0.2 * rightHand.w, NEAR_FIST.y - 0.5 * rightHand.h);
  if (leftHand && sizes.armFar) {
    // A shield stands upright on the forearm; anything else in that hand is a weapon held by its grip.
    if (leftHand.h > leftHand.w) put('leftHand', FAR_FIST.x - 0.5 * leftHand.w, FAR_FIST.y - 0.6 * leftHand.h);
    else put('leftHand', FAR_FIST.x - 0.2 * leftHand.w, FAR_FIST.y - 0.5 * leftHand.h);
  }
  if (shoulder) put('shoulder', BACK_MOUNT.x - 0.6 * shoulder.w, BACK_MOUNT.y - 0.5 * shoulder.h);

  return ORDER.flatMap((slot) => placed.get(slot) ?? []);
}
