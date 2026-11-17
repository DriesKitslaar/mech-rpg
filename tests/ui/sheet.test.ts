import { loadSprites } from '../../src/ui/sprites';

/**
 * The sheet a store of pictures lends to draw on: one canvas that is not the screen, made when it
 * is first asked for, that only ever grows. A mech drawn from its parts is put on it whole, to be
 * laid over itself as light.
 */

/** A browser to make canvases in: one that gives a canvas to draw on, one that gives a canvas but nothing to draw on it with, or one that fails. */
function browser(kind: 'gives' | 'refuses' | 'throws' = 'gives') {
  const made: { width: number; height: number }[] = [];
  /** How often a canvas was made another size: that throws away what it holds. */
  const sized: number[] = [];
  const ctx = { imageSmoothingEnabled: true };
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      expect(tag).toBe('canvas');
      const size = { w: 300, h: 150 };
      const canvas = {
        get width() { return size.w; }, set width(n: number) { size.w = n; sized.push(n); },
        get height() { return size.h; }, set height(n: number) { size.h = n; sized.push(n); },
        getContext: (what: string) => (what === '2d' && kind === 'gives' ? ctx : null),
      };
      made.push(canvas);
      if (kind === 'throws') throw new Error('no canvas to be had');
      return canvas;
    },
  });
  return { made, sized, ctx };
}
afterEach(() => vi.unstubAllGlobals());

describe('the sheet a store lends', () => {
  test('there is one, made at the first ask and lent again at every one after', async () => {
    const { made } = browser();
    const store = await loadSprites({});
    expect(made).toHaveLength(0);
    const first = store.sheet!(100, 80)!;
    const second = store.sheet!(120, 90)!;
    expect(made).toHaveLength(1);
    expect(first.image).toBe(made[0]);
    expect([second.image, second.ctx]).toEqual([first.image, first.ctx]);
  });

  test('it grows to hold what is asked for, each way by itself, and never gets smaller', async () => {
    const { made, sized } = browser();
    const store = await loadSprites({});
    const size = (): number[] => [made[0].width, made[0].height];
    // A canvas comes 300 by 150: large enough for a small mech as it is, and then it is left alone.
    store.sheet!(100, 80);
    expect(size()).toEqual([300, 150]);
    expect(sized).toEqual([]);
    store.sheet!(100, 400);
    expect(size()).toEqual([300, 400]);
    store.sheet!(500, 10);
    expect(size()).toEqual([500, 400]);
    const before = sized.length;
    store.sheet!(10, 10);
    store.sheet!(500, 400);
    expect(size()).toEqual([500, 400]);
    expect(sized).toHaveLength(before);
    // Part of a pixel more is a whole pixel more: a canvas has no parts of pixels.
    store.sheet!(500.2, 400.5);
    expect(size()).toEqual([501, 401]);
  });

  test('nothing drawn on it is smoothed, at any loan: making a canvas another size sets it back to smoothing', async () => {
    const { ctx } = browser();
    const store = await loadSprites({});
    expect(store.sheet!(10, 10)!.ctx).toBe(ctx);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    ctx.imageSmoothingEnabled = true;
    store.sheet!(10, 10);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  test('a browser that gives nothing to draw with, or fails, lends nothing and is asked once', async () => {
    for (const kind of ['refuses', 'throws'] as const) {
      const { made } = browser(kind);
      const store = await loadSprites({});
      expect([store.sheet!(10, 10), store.sheet!(10, 10), store.sheet!(900, 900)], kind).toEqual([null, null, null]);
      expect(made, kind).toHaveLength(1);
      vi.unstubAllGlobals();
    }
  });

  test('where there is nothing to make a canvas with at all, it lends nothing', async () => {
    const store = await loadSprites({});
    expect(store.sheet!(10, 10)).toBeNull();
  });
});
