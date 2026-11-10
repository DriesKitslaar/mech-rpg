export type SpriteSlot = 'legs' | 'core' | 'head' | 'arm' | 'rightHand' | 'leftHand' | 'shoulder';
export type SpriteSize = { w: number; h: number };
export type DrawCmd = { slot: SpriteSlot; x: number; y: number; dim: boolean };

export const MECH_BOX = 150;
const GROUND = { x: 60, y: 146 };

/**
 * Places part sprites of a humanoid mech inside a 150x150 box, side view facing right.
 * Returns top-left corners in draw order (back to front). Absent slots are omitted.
 */
export function layoutMech(sizes: Partial<Record<SpriteSlot, SpriteSize>>): DrawCmd[] {
  const placed = new Map<string, DrawCmd>();
  const put = (key: string, slot: SpriteSlot, x: number, y: number, dim = false) =>
    placed.set(key, { slot, x: Math.round(x), y: Math.round(y), dim });

  const { legs, core, head, arm, rightHand, leftHand, shoulder } = sizes;
  let hip = GROUND;
  if (legs) {
    put('legs', 'legs', GROUND.x - legs.w / 2, GROUND.y - legs.h);
    hip = { x: GROUND.x, y: GROUND.y - legs.h + 6 };
  }
  if (core) {
    put('core', 'core', hip.x - core.w / 2, hip.y - core.h);
    const c = placed.get('core')!;
    if (head) put('head', 'head', c.x + 0.5 * core.w - head.w / 2, c.y + 4 - head.h);
    // The shoulder weapon is slung over the back shoulder and drawn behind the body, so the head stays visible.
    if (shoulder) put('shoulder', 'shoulder', c.x + 0.45 * core.w - shoulder.w, c.y + 0.25 * core.h - shoulder.h);
    if (arm) {
      const joint = { x: c.x + 0.5 * core.w, y: c.y + 0.12 * core.h };
      put('arm', 'arm', joint.x - 0.5 * arm.w, joint.y - 0.1 * arm.h);
      const front = placed.get('arm')!;
      put('armBack', 'arm', front.x - 6, front.y - 2, true);
      const back = placed.get('armBack')!;
      const hand = (a: DrawCmd) => ({ x: a.x + 0.5 * arm.w, y: a.y + 0.9 * arm.h });
      if (rightHand) {
        const h = hand(front);
        put('rightHand', 'rightHand', h.x - 0.2 * rightHand.w, h.y - 0.5 * rightHand.h);
      }
      if (leftHand) {
        const h = hand(back);
        put('leftHand', 'leftHand', h.x - 0.2 * leftHand.w, h.y - 0.5 * leftHand.h, true);
      }
    }
  }
  const order = ['shoulder', 'leftHand', 'armBack', 'legs', 'core', 'head', 'arm', 'rightHand'];
  return order.flatMap((k) => (placed.has(k) ? [placed.get(k)!] : []));
}
