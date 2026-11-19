import SPRITES from '../../src/content/sprites.json';
import { LOGICAL_H, LOGICAL_W } from '../../src/ui/display';
import { LAUNCH_BODY, LAUNCH_EXIT, LAUNCH_FEET, LAUNCH_LAMPS, LAUNCH_PICTURE } from '../../src/ui/launch';
import { BACK_BOX } from '../../src/ui/mechLayout';
import { readPng } from '../helpers/png';

/**
 * The launch tunnel as it was really drawn, held against where the scene takes its opening and its
 * rail to be: the machine is laid on that rail and goes to that opening, and the light comes out
 * of it. Were the picture made again and came out otherwise, this says so.
 */

const MANIFEST = SPRITES as Record<string, { file: string; w: number; h: number }>;
const picture = readPng(`public/${MANIFEST[LAUNCH_PICTURE].file}`);
const light = (x: number, y: number): number => { const [r, g, b] = picture.at(x, y); return (r * 299 + g * 587 + b * 114) / 1000; };
/** Near white: bright, and no colour to speak of. */
const white = (x: number, y: number): boolean => { const [r, g, b] = picture.at(x, y); return Math.min(r, g, b) > 95 && Math.max(r, g, b) - Math.min(r, g, b) < 40; };

describe('the launch tunnel, as drawn', () => {
  test('it fills the screen', () => {
    expect([MANIFEST[LAUNCH_PICTURE].w, MANIFEST[LAUNCH_PICTURE].h]).toEqual([LOGICAL_W, LOGICAL_H]);
    expect([picture.w, picture.h]).toEqual([LOGICAL_W, LOGICAL_H]);
  });

  test('its opening is where the scene takes it to be: a white box at the far end, its middle within two pixels of that place', () => {
    const found: { x: number; y: number }[] = [];
    for (let y = LAUNCH_EXIT.y - 30; y <= LAUNCH_EXIT.y + 30; y++) for (let x = LAUNCH_EXIT.x - 30; x <= LAUNCH_EXIT.x + 30; x++) if (white(x, y)) found.push({ x, y });
    expect(found.length).toBeGreaterThan(60);
    const middle = { x: found.reduce((sum, p) => sum + p.x, 0) / found.length, y: found.reduce((sum, p) => sum + p.y, 0) / found.length };
    expect(Math.abs(middle.x - LAUNCH_EXIT.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(middle.y - LAUNCH_EXIT.y)).toBeLessThanOrEqual(2);
    expect(LAUNCH_EXIT).toEqual({ x: 155, y: 108 });
    // It is a small box, as an opening far off is: nothing like it for some way round.
    const xs = found.map((p) => p.x);
    const ys = found.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(20);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(20);
  });

  test('the rail runs up the middle of the floor to the opening: darker than the hazard stripes either side of it, all the way down', () => {
    for (const y of [150, 180, 210, 240, 262]) {
      // How far the lane reaches either side grows towards the watcher.
      const half = Math.round(6 + (y - LAUNCH_EXIT.y) * 0.16);
      const lane = Array.from({ length: 2 * half + 1 }, (_, i) => light(LAUNCH_EXIT.x - half + i, y));
      const mean = lane.reduce((sum, v) => sum + v, 0) / lane.length;
      // (The stripes are the brightest thing on the floor: somewhere either side of the lane there is one.)
      const beside = (from: number, to: number): number => Math.max(...Array.from({ length: to - from + 1 }, (_, i) => light(from + i, y)));
      const reach = Math.round((y - LAUNCH_EXIT.y) * 0.75);
      expect(beside(LAUNCH_EXIT.x - reach, LAUNCH_EXIT.x - half), `left of the rail at ${y}`).toBeGreaterThan(mean + 15);
      expect(beside(LAUNCH_EXIT.x + half, LAUNCH_EXIT.x + reach), `right of the rail at ${y}`).toBeGreaterThan(mean + 15);
    }
  });

  test('the machine stands on that rail at the bottom of the picture, whole, with its head under the opening and the lamps over it', () => {
    expect(LAUNCH_FEET).toEqual({ x: LAUNCH_EXIT.x, y: 258 });
    // Its box, laid so that the middle of its body is over the rail and its feet are on it.
    const box = { x: LAUNCH_FEET.x - LAUNCH_BODY.x, y: LAUNCH_FEET.y - LAUNCH_BODY.y };
    expect(box.y + BACK_BOX).toBeLessThanOrEqual(LOGICAL_H);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + BACK_BOX).toBeLessThanOrEqual(LOGICAL_W);
    // The opening is clear of the top of its box by a good way, and the lamps are clear of the opening.
    expect(box.y - LAUNCH_EXIT.y).toBeGreaterThanOrEqual(20);
    expect(LAUNCH_EXIT.y - LAUNCH_LAMPS.y).toBeGreaterThanOrEqual(60);
    expect(LAUNCH_FEET.y).toBeGreaterThan(LOGICAL_H - 20);
  });
});
