import { computeScale } from '../../src/ui/display';

test.each([
  [1240, 1080, 4],
  [1920, 1080, 4],
  [800, 600, 2],
  [310, 270, 1],
  [300, 200, 1],
])('computeScale(%i, %i) = %i', (w, h, s) => expect(computeScale(w, h)).toBe(s));
