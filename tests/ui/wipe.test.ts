import { COLORS } from '../../src/ui/widgets';
import { BLIND_SLANT, BLIND_STEP, drawBlind, drawDoors } from '../../src/ui/wipe';
import { record, type Filled } from '../helpers/canvas';

/** The way from one screen to the next: a blind drawn off to the right, and for a battle two doors that open. */

const DARK = '#04040c';
const dark = (rects: Filled[]): Filled[] => rects.filter((r) => r.color === DARK);
const lit = (rects: Filled[]): Filled[] => rects.filter((r) => r.color === COLORS.accent);
const area = (rects: Filled[]): number => rects.reduce((sum, r) => sum + r.w * r.h, 0);

describe('the blind over a new screen', () => {
  const blind = (left: number): Filled[] => record((ctx) => drawBlind(ctx, left)).rects;

  test('with all the way to go it covers the whole screen, in strips, and none of its edge shows yet', () => {
    const rects = blind(1);
    expect(BLIND_STEP).toBe(6);
    expect(rects).toHaveLength(270 / BLIND_STEP);
    expect(dark(rects)).toHaveLength(rects.length);
    rects.forEach((r, i) => expect(r).toMatchObject({ x: 0, y: i * BLIND_STEP, w: 310, h: BLIND_STEP }));
    expect(area(rects)).toBe(310 * 270);
  });

  test('with none of the way to go there is nothing of it left', () => {
    expect(blind(0)).toEqual([]);
    expect(blind(-3)).toEqual([]);
    // More than all the way is all the way.
    expect(area(dark(blind(9)))).toBe(310 * 270);
  });

  test('half way, what is left of it is to the right of a lit edge that leans', () => {
    const rects = blind(0.5);
    const strips = dark(rects);
    const edges = lit(rects);
    expect(strips).toHaveLength(45);
    expect(edges).toHaveLength(45);
    strips.forEach((strip, i) => {
      // Each strip runs from its edge to the right of the screen, and the edge is lit two pixels wide where the strip starts.
      expect(strip.x + strip.w).toBe(310);
      expect(edges[i]).toMatchObject({ x: strip.x, y: strip.y, w: 2, h: BLIND_STEP });
    });
    // The edge is further right at the top than at the bottom, by the lean and no more.
    expect(strips[0].x).toBeGreaterThan(strips[44].x);
    expect(strips[0].x - strips[44].x).toBeLessThanOrEqual(BLIND_SLANT);
    expect(strips[0].x - strips[44].x).toBeGreaterThan(BLIND_SLANT - 8);
    for (let i = 1; i < strips.length; i++) expect(strips[i].x).toBeLessThanOrEqual(strips[i - 1].x);
    // The lit edge is drawn after its strip, so it shows.
    expect(rects.indexOf(edges[0])).toBeGreaterThan(rects.indexOf(strips[0]));
    // About half of the screen is uncovered.
    expect(area(strips)).toBeGreaterThan(310 * 270 * 0.35);
    expect(area(strips)).toBeLessThan(310 * 270 * 0.65);
  });

  test('it only ever uncovers more, and nothing of it is ever outside the screen', () => {
    let before = 310 * 270 + 1;
    for (let left = 1; left >= 0; left -= 0.02) {
      const rects = blind(left);
      const covered = area(dark(rects));
      expect(covered).toBeLessThanOrEqual(before);
      before = covered;
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(310);
        expect(r.w).toBeGreaterThan(0);
        expect(r.y + r.h).toBeLessThanOrEqual(270);
      }
    }
    expect(before).toBeLessThan(310 * 270 * 0.05);
  });

  test('near its end the edge leaves by the right, top first', () => {
    const rects = blind(0.1);
    const strips = dark(rects);
    expect(strips.length).toBeGreaterThan(0);
    expect(strips.length).toBeLessThan(45);
    // What is left is at the bottom.
    expect(Math.min(...strips.map((s) => s.y))).toBeGreaterThan(0);
    expect(Math.max(...strips.map((s) => s.y))).toBe(270 - BLIND_STEP);
    // An edge on the last pixel of the screen is one pixel wide, not two.
    for (const edge of lit(rects)) expect(edge.x + edge.w).toBeLessThanOrEqual(310);
  });
});

describe('the doors over a battle', () => {
  const doors = (left: number): Filled[] => record((ctx) => drawDoors(ctx, left)).rects;

  test('shut, they meet in the middle and cover everything', () => {
    const rects = doors(1);
    expect(dark(rects).map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([{ x: 0, y: 0, w: 310, h: 135 }, { x: 0, y: 135, w: 310, h: 135 }]);
    expect(doors(5).slice(0, 2)).toEqual(rects.slice(0, 2));
  });

  test('open, there is nothing of them', () => {
    expect(doors(0)).toEqual([]);
    expect(doors(-1)).toEqual([]);
  });

  test('half open: one draws back to the top and one to the bottom, each with a lit edge and a seam a little way in', () => {
    const rects = doors(0.5);
    const [top, bottom] = dark(rects);
    expect(top).toMatchObject({ x: 0, y: 0, w: 310, h: 68 });
    expect(bottom).toMatchObject({ x: 0, y: 202, w: 310, h: 68 });
    expect(lit(rects).map(({ y, h, w }) => ({ y, h, w }))).toEqual([{ y: 67, h: 1, w: 310 }, { y: 202, h: 1, w: 310 }]);
    const seams = rects.filter((r) => r.color === COLORS.border);
    expect(seams.map(({ y, h, w }) => ({ y, h, w }))).toEqual([{ y: 63, h: 1, w: 310 }, { y: 206, h: 1, w: 310 }]);
    // Edges and seams are on the doors, not on the battle between them.
    for (const line of [...lit(rects), ...seams]) expect(line.y < 68 || line.y >= 202).toBe(true);
  });

  test('a door that is nearly gone is too thin for an edge', () => {
    const rects = doors(0.02);
    expect(dark(rects)[0].h).toBeLessThan(5);
    expect(rects).toHaveLength(2);
    // The doors only ever open.
    let before = 136;
    for (let left = 1; left >= 0; left -= 0.05) {
      const h = dark(doors(left))[0]?.h ?? 0;
      expect(h).toBeLessThanOrEqual(before);
      before = h;
    }
  });
});
