import { STRINGS } from '../../src/content/strings';
import {
  GLEAM_EVERY_MS, GLEAM_MS, LOGO, LOGO_WORD, SIGN_ON_MS, buildLogo, drawLogo, faceColor, logoGleam, logoLevel, logoLights, type Run,
} from '../../src/ui/logo';
import { rgb } from '../../src/ui/light';
import { record } from '../helpers/canvas';

/** The game's name as a sign: letters a broad pen has drawn, with depth and a line round them, that come on like a tube. */

/** What each pixel of the sign is: nothing, face, a layer of depth, or the line. Also how often each was claimed. */
function grid(): { kind: string[][]; claims: number[][] } {
  const kind = Array.from({ length: LOGO.h }, () => Array<string>(LOGO.w).fill(''));
  const claims = Array.from({ length: LOGO.h }, () => Array<number>(LOGO.w).fill(0));
  const lay = (rows: Run[][], name: string): void => rows.forEach((runs, y) => {
    for (const run of runs) for (let x = run.x; x < run.x + run.w; x++) { kind[y][x] = name; claims[y][x]++; }
  });
  lay(LOGO.face, 'face');
  LOGO.depth.forEach((layer, k) => lay(layer, `depth${k + 1}`));
  lay(LOGO.edge, 'edge');
  return { kind, claims };
}
const lum = (hex: string): number => { const [r, g, b] = rgb(hex); return 0.3 * r + 0.59 * g + 0.11 * b; };
const count = (rows: Run[][]): number => rows.reduce((sum, runs) => sum + runs.length, 0);
const GLEAM = 'rgba(255, 255, 255, 0.7)';

describe('the sign, as it is worked out', () => {
  test('it spells the game\'s name, and will not write a letter it has no shape for', () => {
    expect(LOGO_WORD).toBe(STRINGS.title);
    expect(LOGO.letters).toHaveLength(STRINGS.title.length);
    expect(() => buildLogo('IRON')).not.toThrow();
    expect(() => buildLogo('IRONZ')).toThrow(/no letter Z/);
  });

  test('it fits the screen with room either side, its letters stand in a row with the same gap between them', () => {
    expect(LOGO.h).toBe(45);
    expect(LOGO.w).toBeLessThanOrEqual(290);
    expect(LOGO.w).toBeGreaterThan(220);
    LOGO.letters.forEach((letter, i) => {
      if (i === 0) return expect(letter.x).toBe(1);
      const before = LOGO.letters[i - 1];
      expect(letter.x - (before.x + before.w)).toBe(6);
    });
    const last = LOGO.letters.at(-1)!;
    // After the last letter: its depth and the line.
    expect(LOGO.w - (last.x + last.w)).toBe(4);
    // The first word ends in the gap after its fourth letter.
    expect(LOGO.split).toBeGreaterThan(LOGO.letters[3].x + LOGO.letters[3].w);
    expect(LOGO.split).toBeLessThanOrEqual(LOGO.letters[4].x);
  });

  test('every letter\'s face is forty rows tall and stays in its own room', () => {
    expect(LOGO.face[0]).toEqual([]);
    for (let y = 41; y < LOGO.h; y++) expect(LOGO.face[y]).toEqual([]);
    for (const letter of LOGO.letters) {
      for (let y = 1; y <= 40; y++) {
        const own = LOGO.face[y].filter((run) => run.x >= letter.x && run.x < letter.x + letter.w);
        expect(own.length, `row ${y}`).toBeGreaterThan(0);
        for (const run of own) expect(run.x + run.w).toBeLessThanOrEqual(letter.x + letter.w);
      }
    }
    // Nothing of a face stands in a gap.
    for (const runs of LOGO.face) {
      for (const run of runs) expect(LOGO.letters.some((l) => run.x >= l.x && run.x + run.w <= l.x + l.w)).toBe(true);
    }
  });

  test('a stroke is seven pixels thick, and its ends are cut at the corners', () => {
    const I = LOGO.letters[0];
    const own = (y: number): Run[] => LOGO.face[y].filter((run) => run.x >= I.x && run.x < I.x + I.w);
    // Half way down the I there is only its stem, in the middle of the letter.
    expect(own(20)).toEqual([{ x: I.x + 5, w: 7 }]);
    // Its bar at the top: narrower on its first row than on its third, and seven rows deep.
    expect(own(1)[0].w).toBe(own(3)[0].w - 4);
    expect(own(3)).toEqual([{ x: I.x, w: I.w }]);
    expect(own(7)[0].w).toBe(own(1)[0].w);
    expect(own(8)).toEqual([{ x: I.x + 5, w: 7 }]);
    // The W is the widest letter and the I the narrowest.
    const widths = LOGO.letters.map((l) => l.w);
    expect(Math.max(...widths)).toBe(LOGO.letters[4].w);
    expect(Math.min(...widths)).toBe(I.w);
  });

  test('no pixel is claimed twice, and every row of runs is in order and inside the sign', () => {
    const { claims } = grid();
    for (const row of claims) for (const n of row) expect(n).toBeLessThanOrEqual(1);
    for (const rows of [LOGO.face, LOGO.edge, LOGO.top, LOGO.bottom, ...LOGO.depth]) {
      expect(rows).toHaveLength(LOGO.h);
      for (const runs of rows) {
        let end = 0;
        for (const run of runs) {
          expect(run.w).toBeGreaterThan(0);
          expect(run.x).toBeGreaterThanOrEqual(end);
          end = run.x + run.w;
        }
        expect(end).toBeLessThanOrEqual(LOGO.w);
      }
    }
  });

  test('the depth lies down and to the right of the faces, three pixels of it', () => {
    const { kind } = grid();
    expect(LOGO.depth).toHaveLength(3);
    for (let y = 0; y < LOGO.h; y++) {
      for (let x = 0; x < LOGO.w; x++) {
        const k = /^depth(\d)$/.exec(kind[y][x]);
        if (!k) continue;
        const far = Number(k[1]);
        expect(kind[y - far][x - far], `${x},${y}`).toBe('face');
        // And nothing nearer would have reached it.
        for (let near = 1; near < far; near++) expect(kind[y - near]?.[x - near]).not.toBe('face');
      }
    }
    // There is depth, and the nearest layer has the most of it showing.
    expect(count(LOGO.depth[0])).toBeGreaterThan(20);
    expect(count(LOGO.depth[2])).toBeGreaterThan(20);
  });

  test('the line goes all the way round: nothing solid touches the open air, and no line stands alone', () => {
    const { kind } = grid();
    const solid = (x: number, y: number): boolean => kind[y]?.[x] === 'face' || /^depth/.test(kind[y]?.[x] ?? '');
    for (let y = 0; y < LOGO.h; y++) {
      for (let x = 0; x < LOGO.w; x++) {
        const around: [number, number][] = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) around.push([x + dx, y + dy]);
        if (solid(x, y)) {
          for (const [nx, ny] of around) {
            // Solid things do not reach the rim of the sign's box, so every neighbour is in it.
            expect(kind[ny]?.[nx], `${x},${y} beside ${nx},${ny}`).toBeTruthy();
          }
        }
        if (kind[y][x] === 'edge') expect(around.some(([nx, ny]) => solid(nx, ny)), `${x},${y}`).toBe(true);
      }
    }
  });

  test('the upper and the lower edges of the faces are what has no face above it, or below', () => {
    const { kind } = grid();
    const mark = (rows: Run[][]): Set<string> => new Set(rows.flatMap((runs, y) => runs.flatMap((run) => Array.from({ length: run.w }, (_, i) => `${run.x + i},${y}`))));
    const top = mark(LOGO.top);
    const bottom = mark(LOGO.bottom);
    for (let y = 0; y < LOGO.h; y++) {
      for (let x = 0; x < LOGO.w; x++) {
        const face = kind[y][x] === 'face';
        expect(top.has(`${x},${y}`), `top ${x},${y}`).toBe(face && kind[y - 1]?.[x] !== 'face');
        expect(bottom.has(`${x},${y}`), `bottom ${x},${y}`).toBe(face && kind[y + 1]?.[x] !== 'face');
      }
    }
  });
});

describe('the sign\'s metal', () => {
  test('a face is bright at the top, darkest along a line half way down, and lighter again at its foot', () => {
    for (const steel of [true, false]) {
      const rows = Array.from({ length: 40 }, (_, i) => lum(faceColor(i + 1, steel, true)));
      const darkest = rows.indexOf(Math.min(...rows));
      expect(darkest).toBeGreaterThanOrEqual(18);
      expect(darkest).toBeLessThanOrEqual(22);
      expect(rows[0]).toBeGreaterThan(rows[10]);
      expect(rows[10]).toBeGreaterThan(rows[darkest]);
      expect(rows[39]).toBeGreaterThan(rows[25]);
      expect(rows[39]).toBeGreaterThan(rows[darkest] * 2);
    }
    expect(faceColor(1, true, true)).toBe('#f6f9ff');
    expect(faceColor(40, true, true)).toBe('#e2eafc');
    expect(faceColor(1, false, true)).toBe('#fff2f9');
    expect(faceColor(40, false, true)).toBe('#ffc6e7');
  });

  test('the first word is steel and the second is in the game\'s colour', () => {
    const [sr, , sb] = rgb(faceColor(14, true, true));
    const [nr, , nb] = rgb(faceColor(14, false, true));
    expect(sb).toBeGreaterThan(sr);
    expect(nr).toBeGreaterThan(nb);
    // Rows above and below the sign's letters take the colour of the nearest row.
    expect(faceColor(-5, true, true)).toBe(faceColor(1, true, true));
    expect(faceColor(99, false, true)).toBe(faceColor(40, false, true));
  });

  test('unlit, every row of it is darker than lit, and nearly the dark behind it', () => {
    for (const steel of [true, false]) {
      for (let row = 1; row <= 40; row++) {
        // The one row that is as dark lit as unlit is the line half way down.
        expect(lum(faceColor(row, steel, false))).toBeLessThanOrEqual(lum(faceColor(row, steel, true)) + 6);
        expect(lum(faceColor(row, steel, false))).toBeLessThan(90);
      }
      expect(lum(faceColor(1, steel, false))).toBeLessThan(lum(faceColor(1, steel, true)) / 2);
    }
  });
});

describe('the sign coming on', () => {
  test('dark, a first strike, dark again, a second that falters, and then on', () => {
    expect(logoLevel(0)).toBe(0);
    expect(logoLevel(299)).toBe(0);
    expect(logoLevel(300)).toBe(1);
    expect(logoLevel(359)).toBe(1);
    expect(logoLevel(360)).toBe(0);
    expect(logoLevel(519)).toBe(0);
    expect(logoLevel(520)).toBe(0.7);
    expect(logoLevel(640)).toBe(0.1);
    expect(logoLevel(700)).toBeCloseTo(0.6, 5);
    // From there it only brightens.
    let before = 0;
    for (let t = 700; t <= SIGN_ON_MS; t += 10) {
      expect(logoLevel(t)).toBeGreaterThanOrEqual(before);
      before = logoLevel(t);
    }
    expect(SIGN_ON_MS).toBe(1100);
    expect(logoLevel(SIGN_ON_MS)).toBe(1);
  });

  test('once on it holds, but for a moment\'s dip every eleven seconds or so', () => {
    const minute = Array.from({ length: 6000 }, (_, i) => logoLevel(SIGN_ON_MS + i * 10));
    const dips = minute.filter((level) => level < 1);
    expect(new Set(dips)).toEqual(new Set([0.45]));
    // Five or six dips of eighty milliseconds in a minute.
    expect(dips.length).toBeGreaterThanOrEqual(5 * 8 - 8);
    expect(dips.length).toBeLessThanOrEqual(6 * 8 + 8);
    // And no dip is right at the start, while the eye is still on the sign coming on.
    expect(Array.from({ length: 90 }, (_, i) => logoLevel(SIGN_ON_MS + i * 10)).every((level) => level === 1)).toBe(true);
  });

  test('a calm picture has it simply on, from the first moment and for good', () => {
    for (let t = 0; t < 60000; t += 10) expect(logoLevel(t, true)).toBe(1);
  });

  test('a gleam crosses it every few seconds, and not while it is still coming on', () => {
    expect(GLEAM_EVERY_MS).toBe(4200);
    expect(GLEAM_MS).toBe(900);
    const first = SIGN_ON_MS + 400;
    for (let t = 0; t < first; t += 20) expect(logoGleam(t)).toBeNull();
    expect(logoGleam(first)).toBe(0);
    expect(logoGleam(first + 450)).toBeCloseTo(0.5, 5);
    expect(logoGleam(first + 899)).toBeLessThan(1);
    expect(logoGleam(first + 900)).toBeNull();
    expect(logoGleam(first + GLEAM_EVERY_MS - 1)).toBeNull();
    expect(logoGleam(first + GLEAM_EVERY_MS)).toBe(0);
    // It only ever moves to the right.
    let before = -1;
    for (let t = first; t < first + GLEAM_MS; t += 16) {
      expect(logoGleam(t)!).toBeGreaterThan(before);
      before = logoGleam(t)!;
    }
  });
});

describe('the sign, as it is drawn', () => {
  const total = count(LOGO.edge) + LOGO.depth.reduce((sum, layer) => sum + count(layer), 0) + count(LOGO.face) + count(LOGO.top) + count(LOGO.bottom);
  const BOX = { x: 22, y: 16 };
  const inside = (r: { x: number; y: number; w: number; h: number }): boolean => r.x >= BOX.x && r.y >= BOX.y && r.x + r.w <= BOX.x + LOGO.w && r.y + r.h <= BOX.y + LOGO.h;

  test('lit: every run of it once, a pixel high, inside its box, the faces in their metal', () => {
    const page = record((ctx) => drawLogo(ctx, BOX.x, BOX.y));
    expect(page.rects).toHaveLength(total);
    for (const r of page.rects) {
      expect(r.h).toBe(1);
      expect(inside(r)).toBe(true);
      expect(r.alpha).toBe(1);
    }
    expect(page.glows).toEqual([]);
    expect(page.images).toEqual([]);
    // A row in the middle of the first letter's stem and of the last letter's spine.
    const at = (x: number, y: number) => page.rects.filter((r) => r.y === BOX.y + y && r.x <= BOX.x + x && BOX.x + x < r.x + r.w).at(-1)!.color;
    expect(at(LOGO.letters[0].x + 8, 20)).toBe(faceColor(20, true, true));
    expect(at(LOGO.letters[7].x + 3, 20)).toBe(faceColor(20, false, true));
    // The line is drawn first and the faces after the depth: what is laid last shows.
    expect(page.rects[0].color).toBe('#07061a');
  });

  test('unlit: the same shapes, and nothing in them as bright as the lit sign\'s darkest letter top', () => {
    const page = record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 0, gleam: null }));
    expect(page.rects).toHaveLength(total);
    for (const r of page.rects) {
      expect(inside(r)).toBe(true);
      expect(lum(r.color)).toBeLessThan(110);
    }
    const lit = record((ctx) => drawLogo(ctx, BOX.x, BOX.y)).rects;
    expect(Math.max(...lit.map((r) => lum(r.color)))).toBeGreaterThan(240);
  });

  test('half lit: the unlit sign with the lit one laid over it as strongly as it is lit, and the canvas left as it was', () => {
    const page = record((ctx) => {
      drawLogo(ctx, BOX.x, BOX.y, { level: 0.5, gleam: 0.5 });
      expect(ctx.globalAlpha).toBe(1);
    });
    expect(page.rects).toHaveLength(total * 2);
    expect(page.rects.slice(0, total).every((r) => r.alpha === 1)).toBe(true);
    expect(page.rects.slice(total).every((r) => r.alpha === 0.5)).toBe(true);
    // No gleam crosses a sign that is not fully on.
    expect(page.rects.filter((r) => r.color === GLEAM)).toEqual([]);
    // A level outside what there is counts as the nearest end.
    expect(record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 7, gleam: null })).rects).toHaveLength(total);
    expect(record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: -1, gleam: null })).rects.every((r) => lum(r.color) < 110)).toBe(true);
  });

  test('a gleam is a narrow leaning band of light that lies on the faces and nowhere else', () => {
    const page = record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 1, gleam: 0.5 }));
    const band = page.rects.filter((r) => r.color === GLEAM);
    expect(band.length).toBeGreaterThan(20);
    expect(page.rects).toHaveLength(total + band.length);
    for (const r of band) {
      expect(r.w).toBeLessThanOrEqual(14);
      const row = r.y - BOX.y;
      expect(LOGO.face[row].some((run) => r.x - BOX.x >= run.x && r.x - BOX.x + r.w <= run.x + run.w), `row ${row}`).toBe(true);
    }
    // It leans: further left the lower it is, by half a pixel a row, so it is twenty pixels further left at the foot than at the top.
    const rows = [...new Set(band.map((r) => r.y - BOX.y))].sort((a, b) => a - b);
    expect(rows.at(-1)! - rows[0]).toBeGreaterThan(30);
    const reach = (from: number, to: number): { left: number; right: number } => {
      const part = band.filter((r) => r.y - BOX.y >= from && r.y - BOX.y <= to);
      return { left: Math.min(...part.map((r) => r.x)), right: Math.max(...part.map((r) => r.x + r.w)) };
    };
    const high = reach(1, 4);
    const low = reach(37, 40);
    expect(high.right).toBeGreaterThan(low.right);
    expect(high.right - low.left).toBeLessThanOrEqual(14 + 20);
    expect(high.right - low.left).toBeGreaterThan(20);
    // As it starts and as it ends it is off the sign, or nearly.
    expect(record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 1, gleam: 0 })).rects.filter((r) => r.color === GLEAM)).toEqual([]);
    const late = record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 1, gleam: 0.999 })).rects.filter((r) => r.color === GLEAM);
    for (const r of late) expect(r.x).toBeGreaterThan(BOX.x + LOGO.letters[7].x);
    // And it moves to the right.
    const middle = (gleam: number): number => {
      const xs = record((ctx) => drawLogo(ctx, BOX.x, BOX.y, { level: 1, gleam })).rects.filter((r) => r.color === GLEAM).map((r) => r.x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(middle(0.3)).toBeLessThan(middle(0.5));
    expect(middle(0.5)).toBeLessThan(middle(0.7));
  });

  test('the light it throws: none unlit, six along it when lit, cold over the steel and the game\'s colour over the rest', () => {
    expect(logoLights(BOX.x, BOX.y, 0)).toEqual([]);
    expect(logoLights(BOX.x, BOX.y, -1)).toEqual([]);
    const lights = logoLights(BOX.x, BOX.y, 1);
    expect(lights).toHaveLength(6);
    for (const light of lights) {
      expect(light.y).toBe(BOX.y + Math.round(LOGO.h / 2));
      expect(light.x).toBeGreaterThan(BOX.x);
      expect(light.x).toBeLessThan(BOX.x + LOGO.w);
      expect(light.alpha).toBeCloseTo(0.2, 5);
      expect(light.r).toBeLessThanOrEqual(80);
    }
    expect(lights.map((l) => l.color)).toEqual(['#7fa8ff', '#7fa8ff', '#7fa8ff', '#ff5db1', '#ff5db1', '#ff5db1']);
    expect(lights.map((l) => l.x)).toEqual([...lights.map((l) => l.x)].sort((a, b) => a - b));
    expect(logoLights(BOX.x, BOX.y, 0.5)[0].alpha).toBeCloseTo(0.1, 5);
  });
});
