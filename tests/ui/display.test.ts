import { computeScale, fitCanvas } from '../../src/ui/display';

const blank = () => ({ width: 0, height: 0, style: { width: '', height: '', left: '', top: '' } } as unknown as HTMLCanvasElement);

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
  const canvas = blank();
  const scale = fitCanvas(canvas, w, h, dpr);
  expect(scale).toBe(expected);
  expect(canvas.width).toBe(310 * scale);
  expect(canvas.height).toBe(270 * scale);
  // The canvas must fit the viewport, and one backing pixel must be one device pixel.
  expect(parseFloat(canvas.style.width)).toBeLessThanOrEqual(w);
  expect(parseFloat(canvas.style.height)).toBeLessThanOrEqual(h);
  expect(parseFloat(canvas.style.width) * dpr).toBeCloseTo(canvas.width, 6);
});

/**
 * The handheld's screen is 1240 by 1080: four times the game exactly. A browser reports its size in
 * whole CSS pixels, though, and at a pixel ratio that is not a whole number that report can come out
 * a little short of the real screen. One CSS pixel of that is forgiven, or the game would be drawn
 * at three times with a black border round it.
 */
test.each([
  // ratio, what a browser that rounds down reports for 1240 by 1080
  [3, 413, 360],
  [2.75, 450, 392],
  [2.625, 472, 411],
  [2.5, 496, 432],
  [3.5, 354, 308],
  [2, 620, 540],
])('at pixel ratio %f a viewport reported as %ix%i still gets the 1240x1080 screen its four times', (dpr, w, h) => {
  const canvas = blank();
  expect(fitCanvas(canvas, w, h, dpr)).toBe(4);
  expect(canvas.width).toBe(1240);
  expect(canvas.height).toBe(1080);
  // It starts at the corner: the real screen has the room the report left out.
  expect(parseFloat(canvas.style.left)).toBe(0);
  expect(parseFloat(canvas.style.top)).toBe(0);
});

test('more than one CSS pixel short is not forgiven: with a bar across the screen the game is drawn smaller, in the middle', () => {
  const canvas = blank();
  // 1240 by 1080 with a bar 48 pixels high left on screen, at ratio 3.
  expect(fitCanvas(canvas, 413, 344, 3)).toBe(3);
  expect(canvas.width).toBe(930);
  // Centred on whole device pixels.
  const left = parseFloat(canvas.style.left) * 3;
  const top = parseFloat(canvas.style.top) * 3;
  expect(left).toBeCloseTo(Math.round((413 * 3 - 930) / 2), 6);
  expect(top).toBeCloseTo(Math.round((344 * 3 - 810) / 2), 6);
});

test('a screen larger than the game centres it on whole device pixels', () => {
  const canvas = blank();
  expect(fitCanvas(canvas, 1920, 1080, 1)).toBe(4);
  expect(canvas.style.left).toBe('340px');
  expect(canvas.style.top).toBe('0px');
});
