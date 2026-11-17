import { DEMO_BUILD } from '../../src/content/parts';
import { BACK_JOINTS, VIEWS, layoutMech, type MechView } from '../../src/ui/mechLayout';
import { JOINT_DARK, JOINT_LIT, drawMech, mechSprites } from '../../src/ui/mechView';
import type { SpriteStore } from '../../src/ui/sprites';
import { record } from '../helpers/canvas';

/**
 * The same build can be asked for in three views: from the front, from behind and small. Each view
 * has drawings of its own, named after the part with the view after it.
 */

/** A store that has every sprite, at the size and place the game falls back on, and says which it was asked for. */
function store(): { store: SpriteStore; asked: string[]; painted: string[] } {
  const asked: string[] = [];
  const painted: string[] = [];
  return {
    asked, painted,
    store: {
      get: (id, fallback) => { asked.push(id); return { image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h, ox: fallback.ox, oy: fallback.oy }; },
      painted: (id, paint, fallback) => {
        painted.push(id);
        return { image: { id: `${id}|${paint}` } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h, ox: fallback.ox, oy: fallback.oy };
      },
    },
  };
}
const idOf = (image: unknown): string => (image as { id: string }).id;

describe('the sprites of a build in a view', () => {
  test('from the front they are named after the parts; from behind and small, the view comes after the name', () => {
    expect(DEMO_BUILD).toMatchObject({ head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider' });
    for (const [view, suffix] of [['front', ''], ['back', '.back'], ['small', '.small']] as [MechView, string][]) {
      const { store: s, asked } = store();
      const parts = mechSprites(s, DEMO_BUILD, undefined, view);
      expect(idOf(parts.head!.image), view).toBe(`head-scout-mk1${suffix}`);
      expect(idOf(parts.core!.image), view).toBe(`core-hauler${suffix}`);
      expect(idOf(parts.legs!.image), view).toBe(`legs-strider${suffix}`);
      // The arms part gives two layers: the view comes after the layer's name.
      expect(idOf(parts.armNear!.image), view).toBe(`arms-rigger.near${suffix}`);
      expect(idOf(parts.armFar!.image), view).toBe(`arms-rigger.far${suffix}`);
      expect(idOf(parts.rightHand!.image), view).toBe(`${DEMO_BUILD.rightHand}${suffix}`);
      expect(asked.every((id) => id.endsWith(suffix)), view).toBe(true);
    }
    // Nothing is said: from the front.
    const plain = store();
    expect(idOf(mechSprites(plain.store, DEMO_BUILD).head!.image)).toBe('head-scout-mk1');
  });

  test('a paint scheme is taken by the frame layers of every view, and by no weapon', () => {
    for (const view of ['front', 'back', 'small'] as MechView[]) {
      const { store: s, painted } = store();
      const parts = mechSprites(s, DEMO_BUILD, 'crimson', view);
      const suffix = VIEWS[view].suffix;
      expect(painted.sort(), view).toEqual([`arms-rigger.far${suffix}`, `arms-rigger.near${suffix}`, `core-hauler${suffix}`, `head-scout-mk1${suffix}`, `legs-strider${suffix}`].sort());
      expect(idOf(parts.core!.image)).toBe(`core-hauler${suffix}|crimson`);
      expect(idOf(parts.rightHand!.image)).toBe(`${DEMO_BUILD.rightHand}${suffix}`);
    }
  });

  test('a sprite that is missing has a placeholder as large as its view makes it', () => {
    const { store: s } = store();
    const front = mechSprites(s, DEMO_BUILD).legs!;
    const back = mechSprites(s, DEMO_BUILD, undefined, 'back').legs!;
    const small = mechSprites(s, DEMO_BUILD, undefined, 'small').legs!;
    expect([back.w, back.h, back.ox, back.oy]).toEqual([front.w, front.h, front.ox!, front.oy!].map((n) => Math.round(n * 0.8)));
    expect([small.w, small.h, small.ox, small.oy]).toEqual([front.w, front.h, front.ox!, front.oy!].map((n) => Math.round(n * 0.65)));
  });
});

describe('drawing a mech in a view', () => {
  test('its layers are drawn in the order of the view, each where the view lays it out, from the corner of the pose box', () => {
    for (const view of ['front', 'back', 'small'] as MechView[]) {
      const { store: s } = store();
      const parts = mechSprites(s, DEMO_BUILD, undefined, view);
      const page = record((ctx) => drawMech(ctx, parts, 20, 30, { dx: 0, dy: 0 }, 0, {}, view));
      const laid = layoutMech(parts, view);
      expect(page.images.map((image) => idOf(image.image)), view).toEqual(laid.map((cmd) => idOf(parts[cmd.slot]!.image)));
      page.images.forEach((image, i) => expect([image.x, image.y], `${view} ${laid[i].slot}`).toEqual([20 + laid[i].x, 30 + laid[i].y]));
    }
  });

  test('from behind the shoulder weapon is drawn after the head and before the near arm; from the front it is drawn first', () => {
    const { store: s } = store();
    const build = { ...DEMO_BUILD, shoulder: 'wpn-mortar-pod' };
    const order = (view: MechView): string[] => record((ctx) => drawMech(ctx, mechSprites(s, build, undefined, view), 0, 0, { dx: 0, dy: 0 }, 0, {}, view))
      .images.map((image) => idOf(image.image).replace(/\.(back|small)$/, ''));
    const front = order('front');
    const back = order('back');
    expect(front[0]).toBe('wpn-mortar-pod');
    expect(back.indexOf('wpn-mortar-pod')).toBeGreaterThan(back.indexOf('head-scout-mk1'));
    expect(back.indexOf('wpn-mortar-pod')).toBeLessThan(back.indexOf('arms-rigger.near'));
    expect(back.at(-1)).toBe(DEMO_BUILD.rightHand);
  });

  test('from behind a neck, a bar across the shoulders and a waist lie under every layer; from the front and small there are none', () => {
    const { store: s } = store();
    const drawn = (view: MechView) => record((ctx) => drawMech(ctx, mechSprites(s, DEMO_BUILD, undefined, view), 20, 30, { dx: 0, dy: 0 }, 0, {}, view));
    expect(drawn('front').rects).toEqual([]);
    expect(drawn('small').rects).toEqual([]);
    const back = drawn('back');
    const dark = back.rects.filter((r) => r.color === JOINT_DARK);
    expect(dark.map((r) => [r.x - 20, r.y - 30, r.w, r.h])).toEqual(
      [BACK_JOINTS.neck, BACK_JOINTS.shoulders, BACK_JOINTS.waist].map((j) => [j.x, j.y, j.w, j.h]));
    // Each has a line of light along its length, inside it.
    const lit = back.rects.filter((r) => r.color === JOINT_LIT);
    expect(lit).toHaveLength(3);
    lit.forEach((line, i) => {
      const joint = dark[i];
      expect(line.x >= joint.x && line.y >= joint.y && line.x + line.w <= joint.x + joint.w && line.y + line.h <= joint.y + joint.h, `${i}`).toBe(true);
      expect(Math.max(line.w, line.h), `${i}`).toBe(Math.max(joint.w, joint.h));
      expect(Math.min(line.w, line.h), `${i}`).toBe(2);
    });
    // Under everything: all of them are drawn before the first layer is.
    const first = back.order.findIndex((step) => step.kind === 'image');
    expect(back.order.slice(0, first).every((step) => step.kind === 'rect')).toBe(true);
    expect(back.order.slice(first).every((step) => step.kind === 'image')).toBe(true);
    expect(first).toBe(6);
  });

  test('the joints go where the body goes: with a shift, a sway, the body in a pose, and legs that lower it; a mech without a body has none', () => {
    const { store: s } = store();
    const parts = mechSprites(s, DEMO_BUILD, undefined, 'back');
    const joints = (draw: (ctx: CanvasRenderingContext2D) => void) => record(draw).rects.filter((r) => r.color === JOINT_DARK).map((r) => [r.x, r.y]);
    const still = joints((ctx) => drawMech(ctx, parts, 0, 0, { dx: 0, dy: 0 }, 0, {}, 'back'));
    const moved = joints((ctx) => drawMech(ctx, parts, 0, 0, { dx: 3, dy: 1 }, 2, { core: { dx: -1, dy: 5 }, head: { dx: 9, dy: 9 } }, 'back'));
    expect(moved).toEqual(still.map(([x, y]) => [x + 3 - 1, y + 1 + 2 + 5]));
    // Legs that sit lower than a pair of feet lower everything that stands on them.
    const lowered = joints((ctx) => drawMech(ctx, { ...parts, legs: { ...parts.legs!, drop: 12 } }, 0, 0, { dx: 0, dy: 0 }, 0, {}, 'back'));
    expect(lowered).toEqual(still.map(([x, y]) => [x, y + 12]));
    const { core: _core, ...bodiless } = parts;
    expect(record((ctx) => drawMech(ctx, bodiless, 0, 0, { dx: 0, dy: 0 }, 0, {}, 'back')).rects).toEqual([]);
  });

  test('a shift moves all of it, a sway all but the legs, and a pose each layer by itself, in every view', () => {
    for (const view of ['front', 'back'] as MechView[]) {
      const { store: s } = store();
      const parts = mechSprites(s, DEMO_BUILD, undefined, view);
      const still = record((ctx) => drawMech(ctx, parts, 0, 0, { dx: 0, dy: 0 }, 0, {}, view)).images;
      const moved = record((ctx) => drawMech(ctx, parts, 0, 0, { dx: 3, dy: 1 }, 2, { head: { dx: 0, dy: -4 } }, view)).images;
      still.forEach((image, i) => {
        const id = idOf(image.image);
        const legs = id.startsWith('legs-');
        const head = id.startsWith('head-');
        expect([moved[i].x - image.x, moved[i].y - image.y], id).toEqual([3, 1 + (legs ? 0 : 2) + (head ? -4 : 0)]);
      });
    }
  });
});
