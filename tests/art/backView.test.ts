import { SHOP_PARTS } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { hitSpot } from '../../scripts/art/imageOps';
import { hitPartOf } from '../../scripts/art/process';
import { BACK_BOX, BACK_JOINTS, HIT_LAYER, VIEWS, type HitPart, type MechView } from '../../src/ui/mechLayout';
import { readPng } from '../helpers/png';

/**
 * The mech from behind, as it was really drawn. Its layers were cut from eight drawings, one a
 * family, and a player wears whatever mix of them is best: these tests take the pictures that are
 * shipped and see that every mix makes one figure, and that what is carried is held.
 */

interface Entry { file: string; w: number; h: number; ox?: number; oy?: number; drop?: number; gx?: number; gy?: number; mx?: number; my?: number; hx?: number; hy?: number }
const MANIFEST = SPRITES as Record<string, Entry>;

/** Room round the pose box for what reaches out of it (an arm, a crest), and under it for legs that lower the body. */
const MARGIN = 24;
const W = BACK_BOX + 2 * MARGIN;
const H = BACK_BOX + 2 * MARGIN;

/** Where a layer is solid, laid in the pose box as the game lays it. */
function mask(id: string): Uint8Array {
  const entry = MANIFEST[id];
  const picture = readPng(`public/${entry.file}`);
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < picture.h; y++) {
    for (let x = 0; x < picture.w; x++) if (picture.at(x, y)[3] > 0) solid[(y + entry.oy! + MARGIN) * W + x + entry.ox! + MARGIN] = 1;
  }
  return solid;
}
/** The joints the game draws under the layers. */
function joints(): Uint8Array {
  const solid = new Uint8Array(W * H);
  for (const joint of Object.values(BACK_JOINTS)) {
    for (let y = 0; y < joint.h; y++) for (let x = 0; x < joint.w; x++) solid[(joint.y + y + MARGIN) * W + joint.x + x + MARGIN] = 1;
  }
  return solid;
}
/** One layer moved down: what stands on legs that sit low. */
function lowered(solid: Uint8Array, by: number): Uint8Array {
  const moved = new Uint8Array(W * H);
  moved.set(solid.subarray(0, W * (H - by)), W * by);
  return moved;
}
const union = (...masks: Uint8Array[]): Uint8Array => masks[0].map((_, i) => (masks.some((m) => m[i]) ? 1 : 0));
/** How many pieces a shape is in: pixels that touch, corners included, are one piece. */
function pieces(solid: Uint8Array): number {
  const seen = new Uint8Array(solid.length);
  let count = 0;
  for (let start = 0; start < solid.length; start++) {
    if (!solid[start] || seen[start]) continue;
    count++;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % W;
      const y = (at - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const next = ny * W + nx;
          if (solid[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
        }
      }
    }
  }
  return count;
}

const named = (prefix: string): string[] => Object.keys(MANIFEST).filter((id) => id.startsWith(prefix) && id.endsWith('.back')).sort();
const HEADS = named('head-');
const CORES = named('core-');
const LEGS = named('legs-');
const ARMS = named('arms-');

describe('the mech from behind, from the pictures that are shipped', () => {
  const JOINTS = joints();
  const solid = new Map([...HEADS, ...CORES, ...LEGS, ...ARMS].map((id) => [id, mask(id)]));

  test('there are eight heads, eight bodies, eleven pairs of legs and eight pairs of arms, and each layer is one piece that lies in reach of the pose box', () => {
    expect([HEADS.length, CORES.length, LEGS.length, ARMS.length]).toEqual([8, 8, 11, 16]);
    for (const [id, layer] of solid) {
      const entry = MANIFEST[id];
      expect(entry.ox! >= -MARGIN && entry.oy! >= -MARGIN && entry.ox! + entry.w <= BACK_BOX + MARGIN && entry.oy! + entry.h <= BACK_BOX + MARGIN - (entry.drop ?? 0), id).toBe(true);
      // A stray pixel or two off the layer is nothing; a second piece of any size is a piece of another layer.
      expect(pieces(layer), id).toBeLessThanOrEqual(3);
    }
  });

  test('every head sits on every body: with the neck between them, they are one piece', () => {
    const loose: string[] = [];
    for (const core of CORES) {
      for (const head of HEADS) if (pieces(union(solid.get(core)!, solid.get(head)!, JOINTS)) !== pieces(union(solid.get(core)!, JOINTS))) loose.push(`${head} on ${core}`);
    }
    expect(loose).toEqual([]);
  });

  test('every body stands on every pair of legs, tracks, four legs and a hover unit among them: with the waist between them, they are one piece', () => {
    const loose: string[] = [];
    for (const legs of LEGS) {
      const drop = MANIFEST[legs].drop ?? 0;
      for (const core of CORES) {
        const body = lowered(union(solid.get(core)!, JOINTS), drop);
        if (pieces(union(solid.get(legs)!, body)) !== 1) loose.push(`${core} on ${legs}`);
      }
    }
    expect(loose).toEqual([]);
    // The three lower bodies that are no pair of legs lower what stands on them.
    expect(LEGS.filter((id) => (MANIFEST[id].drop ?? 0) > 0)).toEqual(['legs-crawler.back', 'legs-glide.back', 'legs-spider.back']);
  });

  test('every arm hangs on every body: it touches the body or the bar across the shoulders', () => {
    const loose: string[] = [];
    for (const core of CORES) {
      const body = union(solid.get(core)!, JOINTS);
      const alone = pieces(body);
      for (const arm of ARMS) if (pieces(union(body, solid.get(arm)!)) !== alone) loose.push(`${arm} on ${core}`);
    }
    expect(loose).toEqual([]);
  });

  test('a body covers the bar across the shoulders of its own family', () => {
    // Where arms and body are of one family nothing of the bar is seen but what lies behind an arm or the head.
    for (const family of ['halo', 'bulwark', 'ronin', 'wraith', 'colossus', 'mantis', 'auditor']) {
      const own = union(solid.get(`core-${family}.back`)!, solid.get(`arms-${family}.near.back`)!, solid.get(`arms-${family}.far.back`)!, solid.get(`head-${family}.back`)!);
      const { x, y, w, h } = BACK_JOINTS.shoulders;
      let bare = 0;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!own[(y + dy + MARGIN) * W + x + dx + MARGIN]) bare++;
      expect(bare / (w * h), family).toBeLessThan(0.15);
    }
  });
});

describe('what a mech carries, from behind', () => {
  // What is for sale is what a pilot can come to carry: the starter's own weapons are on the shelf too.
  const carried = SHOP_PARTS.filter((part) => part.kind === 'weapon' || part.kind === 'shield').map((part) => `${part.id}.back`);

  /** True where a picture is solid within `reach` of a point. */
  function solidNear(id: string, px: number, py: number, reach: number): boolean {
    const picture = readPng(`public/${MANIFEST[id].file}`);
    for (let y = Math.max(0, Math.floor(py - reach)); y <= Math.min(picture.h - 1, Math.ceil(py + reach)); y++) {
      for (let x = Math.max(0, Math.floor(px - reach)); x <= Math.min(picture.w - 1, Math.ceil(px + reach)); x++) if (picture.at(x, y)[3] > 0) return true;
    }
    return false;
  }

  test('everything a pilot can carry has a drawing from behind, with where it is gripped and where it fires from', () => {
    expect(carried.length).toBeGreaterThan(30);
    for (const id of carried) {
      const entry = MANIFEST[id];
      expect(entry, id).toBeDefined();
      for (const key of ['gx', 'gy', 'mx', 'my'] as const) expect(entry[key], `${id} ${key}`).toBeTypeOf('number');
      // The grip is on the thing itself, and so is the end it fires from.
      expect(entry.gx! >= 0 && entry.gx! <= entry.w && entry.gy! >= 0 && entry.gy! <= entry.h, id).toBe(true);
      expect(solidNear(id, entry.gx!, entry.gy!, 4), `${id} grip`).toBe(true);
    }
  });

  test('a weapon from behind points away from the camera: up and to the right, its far end beyond and above its grip', () => {
    for (const id of carried.filter((name) => name.startsWith('wpn-'))) {
      const entry = MANIFEST[id];
      expect(entry.mx!, id).toBeGreaterThan(entry.gx!);
      expect(entry.my!, id).toBeLessThanOrEqual(entry.gy!);
      expect(solidNear(id, entry.mx!, entry.my!, 6), `${id} muzzle`).toBe(true);
    }
  });

  test('held in the near fist a weapon stays on the field side of the mech; nothing carried is larger than the mech', () => {
    for (const id of carried) {
      const entry = MANIFEST[id];
      expect(entry.w, id).toBeLessThanOrEqual(BACK_BOX);
      expect(entry.h, id).toBeLessThanOrEqual(BACK_BOX / 2);
      // In the near fist its far end is beyond the fist: it reaches towards the enemy, not back over the mech.
      if (id.startsWith('wpn-')) expect(VIEWS.back.nearFist.x - entry.gx! + entry.mx!, id).toBeGreaterThan(VIEWS.back.nearFist.x);
    }
  });
});

describe('where a hit lands on each part of a mech that is fought', () => {
  const pixels = (id: string): { width: number; height: number; data: Uint8ClampedArray } => {
    const picture = readPng(`public/${MANIFEST[id].file}`);
    const data = new Uint8ClampedArray(picture.w * picture.h * 4);
    for (let y = 0; y < picture.h; y++) for (let x = 0; x < picture.w; x++) data.set(picture.at(x, y), (y * picture.w + x) * 4);
    return { width: picture.w, height: picture.h, data };
  };
  /** Every frame layer that is drawn in a view that is fought in, with the part it is hit as. */
  const layers = Object.keys(MANIFEST).flatMap((id) => {
    const hit = /^(legs|core|head|arms)-/.test(id) ? hitPartOf(id) : null;
    return hit && hit.view !== 'front' ? [{ id, ...hit }] : [];
  });

  test('the name of a layer says which view it is drawn for and which part of the frame it is hit as', () => {
    expect(hitPartOf('legs-crawler.back')).toEqual({ view: 'back', part: 'legs' });
    expect(hitPartOf('core-halo.small')).toEqual({ view: 'small', part: 'core' });
    expect(hitPartOf('head-scout-mk1')).toEqual({ view: 'front', part: 'head' });
    expect(hitPartOf('arms-rigger.near.back')).toEqual({ view: 'back', part: 'arms' });
    // The arm that hangs back is not what a hit on the arms is seen on.
    expect(hitPartOf('arms-rigger.far.back')).toBeNull();
    expect(hitPartOf('arms-rigger.far')).toBeNull();
  });

  test('every layer that can be hit says where: eleven pairs of legs and eight each of bodies, heads and near arms, from behind and small', () => {
    const count = (view: MechView, part: HitPart): number => layers.filter((layer) => layer.view === view && layer.part === part).length;
    for (const view of ['back', 'small'] as MechView[]) expect([count(view, 'legs'), count(view, 'core'), count(view, 'head'), count(view, 'arms')], view).toEqual([11, 8, 8, 8]);
    for (const { id } of layers) expect([typeof MANIFEST[id].hx, typeof MANIFEST[id].hy], id).toEqual(['number', 'number']);
    // No other picture says so: nothing from the front (nothing is fought from the front), no far arm, nothing carried, no machine.
    const said = Object.keys(MANIFEST).filter((id) => MANIFEST[id].hx !== undefined || MANIFEST[id].hy !== undefined);
    expect(said.sort()).toEqual(layers.map((layer) => layer.id).sort());
  });

  test('it is the spot of the layer\'s own picture nearest to where the view has that part: solid, with solid pixels all round it', () => {
    let moved = 0;
    for (const { id, view, part } of layers) {
      const entry = MANIFEST[id];
      const picture = pixels(id);
      const aim = { x: VIEWS[view].hit![part].x - entry.ox!, y: VIEWS[view].hit![part].y - entry.oy! };
      // What shipped is what the rule gives for the picture that shipped.
      expect({ x: entry.hx, y: entry.hy }, id).toEqual(hitSpot(picture, aim));
      // On the thing: the pixel is solid, and so are the two beside it every way.
      const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < picture.width && y < picture.height && picture.data[(y * picture.width + x) * 4 + 3] >= 128;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) expect(solid(entry.hx! + dx, entry.hy! + dy), `${id} at ${dx},${dy}`).toBe(true);
      // And near where the view has the part: a body is hit where it always was, a head within a pixel or two of it, an
      // arm within a few, a pair of legs on the leg nearest the middle between them.
      const off = Math.hypot(entry.hx! - aim.x, entry.hy! - aim.y);
      expect(off, id).toBeLessThanOrEqual({ core: 0, head: 2, arms: 7, legs: 20 }[part]);
      if (off > 0) moved++;
    }
    // Most pairs of legs have nothing between them, and some slim arms miss the view's spot: these are what it is for.
    expect(moved).toBeGreaterThanOrEqual(16);
    expect(HIT_LAYER).toEqual({ head: 'head', core: 'core', arms: 'armNear', legs: 'legs' });
  });
});
