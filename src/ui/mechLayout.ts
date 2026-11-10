export type SpriteSlot = 'legs' | 'core' | 'head' | 'arm' | 'rightHand' | 'leftHand' | 'shoulder';
export type SpriteSize = { w: number; h: number };
export type DrawCmd = { slot: SpriteSlot; x: number; y: number; dim: boolean };

export const MECH_BOX = 112;
const GROUND = { x: 52, y: 108 };

/**
 * Places part sprites inside a 112x112 box, side view facing right.
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
    hip = { x: GROUND.x, y: GROUND.y - legs.h + 4 };
  }
  if (core) {
    put('core', 'core', hip.x - core.w / 2, hip.y - core.h);
    const c = placed.get('core')!;
    if (head) put('head', 'head', c.x + 0.62 * core.w - head.w / 2, c.y + 3 - head.h);
    if (shoulder) put('shoulder', 'shoulder', c.x + 0.3 * core.w - 0.4 * shoulder.w, c.y + 2 - shoulder.h);
    if (arm) {
      const joint = { x: c.x + 0.5 * core.w, y: c.y + 0.3 * core.h };
      put('arm', 'arm', joint.x - 0.5 * arm.w, joint.y - 0.15 * arm.h);
      const front = placed.get('arm')!;
      put('armBack', 'arm', front.x - 6, front.y - 2, true);
      const back = placed.get('armBack')!;
      const hand = (a: DrawCmd) => ({ x: a.x + 0.5 * arm.w, y: a.y + 0.92 * arm.h });
      if (rightHand) {
        const h = hand(front);
        put('rightHand', 'rightHand', h.x - 0.25 * rightHand.w, h.y - 0.5 * rightHand.h);
      }
      if (leftHand) {
        const h = hand(back);
        put('leftHand', 'leftHand', h.x - 0.25 * leftHand.w, h.y - 0.5 * leftHand.h, true);
      }
    }
  }
  const order = ['leftHand', 'armBack', 'legs', 'core', 'head', 'shoulder', 'arm', 'rightHand'];
  return order.flatMap((k) => (placed.has(k) ? [placed.get(k)!] : []));
}
