/**
 * A mech is drawn from layers that were all cut from full drawings in one shared pose.
 * Frame layers therefore carry their own position; only weapons are placed by anchor points.
 *
 * There are three views of it. From the front, in the garage and everywhere else outside a battle.
 * From behind, smaller, for the pilot's own mech in a battle: it stands nearest the camera with its
 * back to it. And from the front again but smaller still, for a mech built from parts that stands
 * far off: the other one in a duel. Each view has drawings of its own, cut the same way.
 */
export type SpriteSlot = 'armFar' | 'legs' | 'core' | 'head' | 'armNear' | 'rightHand' | 'leftHand' | 'shoulder';
/**
 * `ox`/`oy` is where a frame layer sits inside the pose box. Weapons have none.
 * `drop`, on legs only, is how far everything above them sits lower than usual: tracks are not as tall as legs.
 * `gx`/`gy` and `mx`/`my`, on a weapon that was turned for its view, are where in its picture it is
 * held and where it fires from: turned, those are no longer where its corners would put them.
 * `hx`/`hy`, on a frame layer that can be hit in its view, is where in its own picture a hit on it lands (see `hitOn`).
 */
export type SpriteSize = {
  w: number; h: number; ox?: number; oy?: number; drop?: number; gx?: number; gy?: number; mx?: number; my?: number; hx?: number; hy?: number;
};
export type DrawCmd = { slot: SpriteSlot; x: number; y: number };
export type MechView = 'front' | 'back' | 'small';

/** Side of the square pose box, in logical pixels. */
export const MECH_BOX = 160;
/** Centre of the fist of the arm stretched towards the enemy. */
export const NEAR_FIST = { x: 135, y: 52 };
/** Centre of the fist of the arm held back behind the body. */
export const FAR_FIST = { x: 31, y: 80 };
/** Where a shoulder weapon rests, behind the far shoulder. */
export const BACK_MOUNT = { x: 46, y: 27 };
/** Side of the pose box of the mech seen from behind, and of the small mech from the front. */
export const BACK_BOX = 128;
export const SMALL_BOX = 104;

type Pt = { x: number; y: number };
/** What a view of the mech is laid out by. */
export interface ViewLayout {
  /** Side of its square pose box. */
  box: number;
  /** What comes after a part's id to name its drawing for this view. */
  suffix: '' | '.back' | '.small';
  /** The fist that holds the right-hand weapon, the fist that holds the left-hand one, and where a shoulder weapon rests. */
  nearFist: Pt;
  farFist: Pt;
  mount: Pt;
  /** The order the layers are drawn in, back to front. */
  order: SpriteSlot[];
  /** Where each part of the frame is in the pose box, for a hit on it to be aimed at. Only a view that is fought in has it. */
  hit?: Record<HitPart, Pt>;
}

/** The parts of a mech's frame a hit can land on, and the layer each is seen on: the arms by the one stretched towards the enemy. */
export type HitPart = 'head' | 'core' | 'arms' | 'legs';
export const HIT_LAYER: Record<HitPart, SpriteSlot> = { head: 'head', core: 'core', arms: 'armNear', legs: 'legs' };

const FRONT_ORDER: SpriteSlot[] = ['shoulder', 'armFar', 'leftHand', 'legs', 'core', 'head', 'armNear', 'rightHand'];
const small = (p: Pt): Pt => ({ x: Math.round((p.x * SMALL_BOX) / MECH_BOX), y: Math.round((p.y * SMALL_BOX) / MECH_BOX) });

export const VIEWS: Record<MechView, ViewLayout> = {
  front: { box: MECH_BOX, suffix: '', nearFist: NEAR_FIST, farFist: FAR_FIST, mount: BACK_MOUNT, order: FRONT_ORDER },
  // From behind the arm that points at the enemy is on the right and nearest the camera. The head is
  // beyond the body: a high back or a collar hides the nape of it. The weapon on the shoulder is on
  // the back, in front of the body and the head, behind that arm only.
  back: {
    box: BACK_BOX, suffix: '.back', nearFist: { x: 103, y: 33 }, farFist: { x: 27, y: 63 }, mount: { x: 36, y: 20 },
    order: ['armFar', 'leftHand', 'legs', 'head', 'core', 'shoulder', 'armNear', 'rightHand'],
    hit: { head: { x: 60, y: 14 }, core: { x: 58, y: 40 }, arms: { x: 88, y: 33 }, legs: { x: 58, y: 94 } },
  },
  small: {
    box: SMALL_BOX, suffix: '.small', nearFist: small(NEAR_FIST), farFist: small(FAR_FIST), mount: small(BACK_MOUNT), order: FRONT_ORDER,
    hit: { head: { x: 49, y: 14 }, core: { x: 50, y: 32 }, arms: { x: 74, y: 27 }, legs: { x: 50, y: 72 } },
  },
};

/**
 * From behind, a neck, a bar across the shoulders and a waist: three narrow dark joints, in the
 * pose box of that view, that lie under every layer. A head and a body from two families, cut from
 * two drawings, do not always reach each other (nor a body and a pair of legs, nor a slim body and
 * a pair of heavy arms): where they do not, this is what is seen between them, and where they do,
 * nothing of it is seen at all. With these, every mix of parts there is makes one figure.
 */
export const BACK_JOINTS = {
  neck: { x: 57, y: 16, w: 7, h: 12 },
  shoulders: { x: 36, y: 24, w: 46, h: 6 },
  waist: { x: 55, y: 44, w: 8, h: 14 },
};

const FRAME: SpriteSlot[] = ['armFar', 'legs', 'core', 'head', 'armNear'];

/** How far the upper body of this mech sits below its usual place in the pose box. */
export const dropOf = (sizes: Partial<Record<SpriteSlot, SpriteSize>>): number => sizes.legs?.drop ?? 0;

/**
 * Where in its own picture a weapon is held, for the slot it is carried in. A weapon that was
 * turned says so itself. One that was not: a hand weapon is gripped a fifth of the way along, a
 * shield (taller than it is wide) stands upright on the forearm, a shoulder weapon sits a little
 * behind its middle.
 */
function heldAt(slot: SpriteSlot, size: SpriteSize): Pt {
  if (size.gx !== undefined && size.gy !== undefined) return { x: size.gx, y: size.gy };
  if (slot === 'shoulder') return { x: 0.6 * size.w, y: 0.5 * size.h };
  if (slot === 'leftHand' && size.h > size.w) return { x: 0.5 * size.w, y: 0.6 * size.h };
  return { x: 0.2 * size.w, y: 0.5 * size.h };
}

/** Returns top-left corners inside the pose box of a view, in draw order (back to front). */
export function layoutMech(sizes: Partial<Record<SpriteSlot, SpriteSize>>, view: MechView = 'front'): DrawCmd[] {
  const layout = VIEWS[view];
  const placed = new Map<SpriteSlot, DrawCmd>();
  const drop = dropOf(sizes);
  const put = (slot: SpriteSlot, x: number, y: number) =>
    placed.set(slot, { slot, x: Math.round(x), y: Math.round(y) + (slot === 'legs' ? 0 : drop) });

  for (const slot of FRAME) {
    const s = sizes[slot];
    if (s) put(slot, s.ox ?? 0, s.oy ?? 0);
  }
  const hold = (slot: SpriteSlot, at: Pt): void => {
    const size = sizes[slot]!;
    const grip = heldAt(slot, size);
    put(slot, at.x - grip.x, at.y - grip.y);
  };
  // Without the arm there is nothing to hold a hand weapon.
  if (sizes.rightHand && sizes.armNear) hold('rightHand', layout.nearFist);
  if (sizes.leftHand && sizes.armFar) hold('leftHand', layout.farFist);
  if (sizes.shoulder) hold('shoulder', layout.mount);

  return layout.order.flatMap((slot) => placed.get(slot) ?? []);
}

/**
 * Where a hit on a part of the frame lands, inside the pose box of a view. The view says where
 * that part is; between a pair of legs that is thin air, and beside a slim arm it can be too. So a
 * layer says where in its own picture it is hit (`hx`/`hy`): the spot on it nearest to where the
 * view has the part, found from its pixels when the picture was made. A layer that does not say (a
 * placeholder, a view nothing is fought in) is hit where the view has the part, or in the middle of
 * the box. What the legs lower is in the point already.
 */
export function hitOn(sizes: Partial<Record<SpriteSlot, SpriteSize>>, part: HitPart, view: MechView = 'front'): Pt {
  const layout = VIEWS[view];
  const lowered = part === 'legs' ? 0 : dropOf(sizes);
  const layer = sizes[HIT_LAYER[part]];
  if (layer && layer.hx !== undefined && layer.hy !== undefined) return { x: (layer.ox ?? 0) + layer.hx, y: (layer.oy ?? 0) + layer.hy + lowered };
  const aim = layout.hit?.[part] ?? { x: layout.box / 2, y: layout.box / 2 };
  return { x: aim.x, y: aim.y + lowered };
}

/**
 * Where a weapon fires from, inside the pose box of a view; null when the mech does not carry
 * one there (or has no arm to carry it with). A weapon that was turned says where its far end is.
 * One that was not fires from four fifths of its length past the fist, a little above it; a
 * shoulder weapon from two fifths of its length past its mount.
 */
export function muzzleOf(sizes: Partial<Record<SpriteSlot, SpriteSize>>, slot: 'rightHand' | 'leftHand' | 'shoulder', view: MechView = 'front'): Pt | null {
  const size = sizes[slot];
  const cmd = layoutMech(sizes, view).find((c) => c.slot === slot);
  if (!size || !cmd) return null;
  if (size.mx !== undefined && size.my !== undefined) return { x: cmd.x + size.mx, y: cmd.y + size.my };
  const grip = heldAt(slot, size);
  if (slot === 'shoulder') return { x: Math.round(cmd.x + grip.x + 0.4 * size.w), y: Math.round(cmd.y + grip.y) };
  return { x: Math.round(cmd.x + grip.x + 0.8 * size.w), y: Math.round(cmd.y + grip.y - 2) };
}
