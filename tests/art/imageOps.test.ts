import { chromaKey, quantize, trim, type RawImage } from '../../scripts/art/imageOps';

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
