import SPRITES from '../../src/content/sprites.json';
import { loadSprites, spriteOf, type SpriteManifest } from '../../src/ui/sprites';

/**
 * The store of pictures the game runs on: what it hands out for an id is the picture that was
 * loaded together with what the manifest says of it. A battle lays a mech out by those numbers
 * (where a layer sits, where a turned weapon is held and fires from, where a hit lands), so every
 * one of them has to come through.
 */

const image = { id: 'a picture' } as unknown as CanvasImageSource;
const MANIFEST = SPRITES as unknown as SpriteManifest;

describe('a picture and what the manifest says of it', () => {
  test('keeps its size and its place in the pose box, and says how far it lowers what stands on it only when it does', () => {
    expect(spriteOf(image, { file: 'f', w: 10, h: 12, ox: 3, oy: 4 })).toEqual({ image, w: 10, h: 12, ox: 3, oy: 4 });
    expect(spriteOf(image, { file: 'f', w: 10, h: 12 })).toEqual({ image, w: 10, h: 12, ox: undefined, oy: undefined });
    expect(spriteOf(image, { file: 'f', w: 10, h: 12, ox: 3, oy: 4, drop: 22 })).toEqual({ image, w: 10, h: 12, ox: 3, oy: 4, drop: 22 });
    expect('drop' in spriteOf(image, { file: 'f', w: 10, h: 12, drop: 0 })).toBe(false);
    // Neither the file's name nor its paint is the game's to lay anything out by.
    expect(Object.keys(spriteOf(image, { file: 'f', w: 1, h: 1, paint: { accent: [], lo: 0, mid: 0.5, hi: 1 } })).sort()).toEqual(['h', 'image', 'ox', 'oy', 'w']);
  });

  test('a weapon that was turned says where it is held and where it fires from: all four numbers, or none of them', () => {
    const turned = { file: 'f', w: 30, h: 20, gx: 6, gy: 15, mx: 28, my: 3 };
    expect(spriteOf(image, turned)).toMatchObject({ gx: 6, gy: 15, mx: 28, my: 3 });
    // Where it is held at the picture's very corner is still said.
    expect(spriteOf(image, { ...turned, gx: 0, my: 0 })).toMatchObject({ gx: 0, gy: 15, mx: 28, my: 0 });
    for (const missing of ['gx', 'gy', 'mx', 'my'] as const) {
      const { [missing]: _gone, ...rest } = turned;
      const sprite = spriteOf(image, rest);
      expect(['gx', 'gy', 'mx', 'my'].filter((key) => key in sprite), missing).toEqual([]);
    }
  });

  test('a layer that can be hit says where: both numbers, or neither', () => {
    expect(spriteOf(image, { file: 'f', w: 80, h: 60, ox: 12, oy: 51, hx: 59, hy: 38 })).toMatchObject({ hx: 59, hy: 38 });
    expect(spriteOf(image, { file: 'f', w: 80, h: 60, hx: 0, hy: 0 })).toMatchObject({ hx: 0, hy: 0 });
    expect('hx' in spriteOf(image, { file: 'f', w: 80, h: 60, hx: 59 })).toBe(false);
    expect('hy' in spriteOf(image, { file: 'f', w: 80, h: 60, hy: 38 })).toBe(false);
  });

  test('an arm that names its own fist says where: both numbers, or neither', () => {
    expect(spriteOf(image, { file: 'f', w: 43, h: 34, ox: 67, oy: 23, fx: 36, fy: 23 })).toMatchObject({ fx: 36, fy: 23 });
    expect(spriteOf(image, { file: 'f', w: 43, h: 34, fx: 0, fy: 0 })).toMatchObject({ fx: 0, fy: 0 });
    expect('fx' in spriteOf(image, { file: 'f', w: 43, h: 34, fx: 36 })).toBe(false);
    expect('fy' in spriteOf(image, { file: 'f', w: 43, h: 34, fy: 23 })).toBe(false);
    // And an arm that names none has none: its fist is where its view has it.
    expect(Object.keys(spriteOf(image, { file: 'f', w: 43, h: 34, ox: 67, oy: 23, hx: 20, hy: 10 })).sort()).toEqual(['h', 'hx', 'hy', 'image', 'ox', 'oy', 'w']);
  });

  test('everything the shipped manifest says to lay a mech out by comes through, for every picture there is', () => {
    const counts = { drop: 0, held: 0, hit: 0, fist: 0 };
    for (const [id, entry] of Object.entries(MANIFEST)) {
      const sprite = spriteOf(image, entry);
      expect([sprite.w, sprite.h, sprite.ox, sprite.oy], id).toEqual([entry.w, entry.h, entry.ox, entry.oy]);
      for (const key of ['drop', 'gx', 'gy', 'mx', 'my', 'hx', 'hy', 'fx', 'fy'] as const) expect(sprite[key], `${id} ${key}`).toBe(entry[key]);
      if (entry.drop) counts.drop++;
      if (entry.gx !== undefined) counts.held++;
      if (entry.hx !== undefined) counts.hit++;
      if (entry.fx !== undefined) counts.fist++;
    }
    // Three lower bodies that lower what stands on them, in three views; every weapon a pilot can carry, from behind; every layer that can be hit.
    expect(counts.drop).toBeGreaterThanOrEqual(5);
    expect(counts.held).toBeGreaterThanOrEqual(24);
    // Thirteen frames of four parts each that can be hit (of the arms, the one stretched forward), and the three lower bodies
    // that are not legs: from behind, and far off.
    expect(counts.hit).toBe(110);
    // The two arms of one frame, from behind, whose fists were drawn away from where the pose has them.
    expect(counts.fist).toBe(2);
  });
});

describe('loading the pictures', () => {
  /** A browser's picture: one whose file name says so fails to load. */
  class Picture {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    url = '';
    set src(url: string) {
      this.url = url;
      queueMicrotask(() => (url.includes('missing') ? this.onerror?.() : this.onload?.()));
    }
  }
  /** A canvas that takes any drawing and keeps none of it: a placeholder is drawn on one. */
  const blank = (): unknown => {
    const ctx = new Proxy({} as Record<string, unknown>, { get: (t, name: string) => (name in t ? t[name] : () => undefined), set: (t, name: string, value) => { t[name] = value; return true; } });
    return { width: 0, height: 0, getContext: () => ctx };
  };
  beforeEach(() => {
    vi.stubGlobal('Image', Picture);
    vi.stubGlobal('document', { createElement: blank });
  });
  afterEach(() => vi.unstubAllGlobals());

  const manifest: SpriteManifest = {
    'wpn-rifle.back': { file: 'sprites/wpn-rifle.back.png', w: 30, h: 20, gx: 6, gy: 15, mx: 28, my: 3 },
    'legs-tracks.back': { file: 'sprites/legs-tracks.back.png', w: 80, h: 40, ox: 8, oy: 71, drop: 22, hx: 50, hy: 23 },
    'core-lost': { file: 'sprites/missing.png', w: 40, h: 44, ox: 38, oy: 20 },
  };

  test('a picture that loads is handed out with what the manifest says of it, and is the picture that was loaded', async () => {
    const store = await loadSprites(manifest);
    const rifle = store.get('wpn-rifle.back', { w: 1, h: 1, label: 'x' });
    expect(rifle).toMatchObject({ w: 30, h: 20, gx: 6, gy: 15, mx: 28, my: 3 });
    expect(rifle.image).toBeInstanceOf(Picture);
    expect((rifle.image as unknown as Picture).url).toBe('sprites/wpn-rifle.back.png');
    expect(store.get('legs-tracks.back', { w: 1, h: 1, label: 'x' })).toMatchObject({ w: 80, h: 40, ox: 8, oy: 71, drop: 22, hx: 50, hy: 23 });
    // Asked again, it is the same one.
    expect(store.get('wpn-rifle.back', { w: 1, h: 1, label: 'x' })).toBe(rifle);
  });

  test('one that does not load, or that the manifest does not know, is a placeholder of the size and place asked for: the same one each time', async () => {
    const store = await loadSprites(manifest);
    for (const id of ['core-lost', 'never-heard-of']) {
      const stand = store.get(id, { w: 42, h: 52, ox: 54, oy: 28, label: id });
      expect([stand.w, stand.h, stand.ox, stand.oy], id).toEqual([42, 52, 54, 28]);
      expect(stand.image, id).toBeDefined();
      expect(stand.image, id).not.toBeInstanceOf(Picture);
      expect(store.get(id, { w: 42, h: 52, ox: 54, oy: 28, label: id }), id).toBe(stand);
    }
  });

  test('a picture in a paint scheme it cannot take, or in none, comes back as it is', async () => {
    const store = await loadSprites(manifest);
    const plain = store.get('wpn-rifle.back', { w: 1, h: 1, label: 'x' });
    // A weapon has no paint of its own to change.
    expect(store.painted!('wpn-rifle.back', 'crimson', { w: 1, h: 1, label: 'x' })).toBe(plain);
    expect(store.painted!('legs-tracks.back', 'no-such-scheme', { w: 1, h: 1, label: 'x' })).toBe(store.get('legs-tracks.back', { w: 1, h: 1, label: 'x' }));
  });
});
