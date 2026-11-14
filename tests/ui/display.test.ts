import { computeScale, fitCanvas } from '../../src/ui/display';

test.each([
  [1240, 1080, 4],
  [1920, 1080, 4],
  [800, 600, 2],
  [310, 270, 1],
  [300, 200, 1],
])('computeScale(%i, %i) = %i', (w, h, s) => expect(computeScale(w, h)).toBe(s));

test.each([
  [1240, 1080, 1, 4],
  [1240, 1080, 2, 8],
  [827, 720, 1.5, 4],
  [412, 915, 2.625, 3],
])('fitCanvas at %ix%i with pixel ratio %f uses whole device pixels (scale %i)', (w, h, dpr, expected) => {
  const canvas = { width: 0, height: 0, style: { width: '', height: '' } } as unknown as HTMLCanvasElement;
  const scale = fitCanvas(canvas, w, h, dpr);
  expect(scale).toBe(expected);
  expect(canvas.width).toBe(310 * scale);
  expect(canvas.height).toBe(270 * scale);
  // The canvas must fit the viewport, and one backing pixel must be one device pixel.
  expect(parseFloat(canvas.style.width)).toBeLessThanOrEqual(w);
  expect(parseFloat(canvas.style.height)).toBeLessThanOrEqual(h);
  expect(parseFloat(canvas.style.width) * dpr).toBeCloseTo(canvas.width, 6);
});
