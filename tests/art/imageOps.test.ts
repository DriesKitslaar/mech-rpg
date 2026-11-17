import { bounds, chromaKey, chromaKeyGreen, hitSpot, quantize, trim, type RawImage } from '../../scripts/art/imageOps';

type RGBA = [number, number, number, number];
function image(w: number, h: number, fill: RGBA, set: [number, number, RGBA][] = []): RawImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  for (const [x, y, c] of set) data.set(c, (y * w + x) * 4);
  return { width: w, height: h, data };
}
const px = (img: RawImage, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const MAGENTA: RGBA = [255, 0, 255, 255];
const OLIVE: RGBA = [90, 100, 50, 255];

test('chromaKey makes the key colour transparent and keeps other pixels', () => {
  const out = chromaKey(image(4, 4, MAGENTA, [[1, 2, OLIVE]]), [255, 0, 255], 40);
  expect(px(out, 1, 2)).toEqual(OLIVE);
  expect(px(out, 0, 0)[3]).toBe(0);
  expect(px(out, 3, 3)[3]).toBe(0);
});

test('chromaKey tolerance decides whether a near-key pixel is removed', () => {
  const near: RGBA = [250, 10, 245, 255];
  expect(px(chromaKey(image(2, 1, OLIVE, [[0, 0, near]]), [255, 0, 255], 40), 0, 0)[3]).toBe(0);
  expect(px(chromaKey(image(2, 1, OLIVE, [[0, 0, near]]), [255, 0, 255], 5), 0, 0)[3]).toBe(255);
});

test('trim crops to the bounding box of opaque pixels', () => {
  const set: [number, number, RGBA][] = [[2, 3, OLIVE], [5, 7, OLIVE]];
  const out = trim(image(10, 10, [0, 0, 0, 0], set));
  expect([out.width, out.height]).toEqual([4, 5]);
  expect(px(out, 0, 0)).toEqual(OLIVE);
  expect(px(out, 3, 4)).toEqual(OLIVE);
});

test('trim rejects an image with nothing left', () => {
  expect(() => trim(image(3, 3, [0, 0, 0, 0]))).toThrow('image is empty after background removal');
});

test('quantize maps opaque pixels to the nearest palette colour', () => {
  const palette: [number, number, number][] = [[0, 0, 0], [100, 100, 50], [255, 255, 255]];
  const out = quantize(image(2, 1, OLIVE, [[1, 0, [240, 250, 245, 255]]]), palette);
  expect(px(out, 0, 0)).toEqual([100, 100, 50, 255]);
  expect(px(out, 1, 0)).toEqual([255, 255, 255, 255]);
});

test('quantize makes alpha fully on or fully off at 128', () => {
  const palette: [number, number, number][] = [[90, 100, 50]];
  const out = quantize(image(2, 1, [90, 100, 50, 127], [[1, 0, [90, 100, 50, 128]]]), palette);
  expect(px(out, 0, 0)[3]).toBe(0);
  expect(px(out, 1, 0)[3]).toBe(255);
});

test('chromaKeyGreen removes green-dominant pixels of any shade and keeps everything else', () => {
  const img = image(5, 1, [0, 255, 0, 255], [
    [1, 0, [20, 230, 30, 255]],   // slightly off green backdrop
    [2, 0, [240, 240, 245, 255]], // white armour
    [3, 0, [0, 200, 255, 255]],   // cyan light
    [4, 0, [150, 20, 30, 255]],   // red armour
  ]);
  const out = chromaKeyGreen(img);
  expect([0, 1, 2, 3, 4].map((x) => px(out, x, 0)[3])).toEqual([0, 0, 255, 255, 255]);
});

test('bounds reports where the opaque pixels are', () => {
  const set: [number, number, RGBA][] = [[2, 3, OLIVE], [5, 7, OLIVE]];
  expect(bounds(image(10, 10, [0, 0, 0, 0], set))).toEqual({ x: 2, y: 3, w: 4, h: 5 });
  expect(bounds(image(3, 3, [0, 0, 0, 0]))).toBeNull();
});

describe('where a hit lands on a picture', () => {
  const CLEAR: RGBA = [0, 0, 0, 0];
  /** A picture drawn in letters: `#` is solid, anything else is not. */
  const drawn = (...rows: string[]): RawImage =>
    image(rows[0].length, rows.length, CLEAR, rows.flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [[x, y, OLIVE] as [number, number, RGBA]] : []))));
  // Two legs seven wide with a gap of five between them, under a hip block.
  const LEGS = drawn(
    '###################',
    '###################',
    '###################',
    '###################',
    '###################',
    '#######.....#######',
    '#######.....#######',
    '#######.....#######',
    '#######.....#######',
    '#######.....#######',
    '#######.....#######',
    '#######.....#######',
  );

  test('aimed between a pair of legs it lands on a leg: the solid pixel nearest to the aim that has two solid pixels round it every way', () => {
    // Nearer the left leg: two pixels into it from the gap.
    expect(hitSpot(LEGS, { x: 8, y: 9 })).toEqual({ x: 4, y: 9 });
    // Nearer the right one.
    expect(hitSpot(LEGS, { x: 11, y: 9 })).toEqual({ x: 14, y: 9 });
    // Low down, where there are not two pixels of leg under the aim, it goes up to where there are.
    expect(hitSpot(LEGS, { x: 8, y: 11 })).toEqual({ x: 4, y: 9 });
  });

  test('aimed at a spot that is deep in the picture already, it lands there', () => {
    expect(hitSpot(LEGS, { x: 9, y: 2 })).toEqual({ x: 9, y: 2 });
    expect(hitSpot(LEGS, { x: 3, y: 8 })).toEqual({ x: 3, y: 8 });
  });

  test('of spots equally near, the higher one, and of those the one further left', () => {
    // Dead centre of the gap: both legs are as near. Left it is.
    expect(hitSpot(LEGS, { x: 9, y: 8 })).toEqual({ x: 4, y: 8 });
    // Half way between two rows of one leg: the upper row.
    expect(hitSpot(LEGS, { x: 3, y: 7.5 })).toEqual({ x: 3, y: 7 });
  });

  test('aimed from outside the picture it lands on the nearest deep spot inside', () => {
    expect(hitSpot(LEGS, { x: -30, y: -30 })).toEqual({ x: 2, y: 2 });
    expect(hitSpot(LEGS, { x: 100, y: 3 })).toEqual({ x: 16, y: 3 });
  });

  test('a picture too thin to have a deep spot is hit on its solid pixel nearest to the aim; an empty one nowhere', () => {
    const thin = drawn(
      '..#..',
      '..#..',
      '..#..',
      '#####',
    );
    expect(hitSpot(thin, { x: 0, y: 0 })).toEqual({ x: 2, y: 0 });
    expect(hitSpot(thin, { x: 4, y: 2 })).toEqual({ x: 4, y: 3 });
    expect(hitSpot(drawn('...', '...'), { x: 1, y: 1 })).toBeNull();
    // A pixel that is only half there is not solid.
    const faint = image(3, 1, CLEAR, [[0, 0, [9, 9, 9, 127]], [2, 0, [9, 9, 9, 128]]]);
    expect(hitSpot(faint, { x: 0, y: 0 })).toEqual({ x: 2, y: 0 });
  });

  test('how deep is deep can be said: one pixel round it, or none', () => {
    expect(hitSpot(LEGS, { x: 8, y: 9 }, 1)).toEqual({ x: 5, y: 9 });
    expect(hitSpot(LEGS, { x: 8, y: 9 }, 0)).toEqual({ x: 6, y: 9 });
  });
});
