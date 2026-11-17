import { setDetail } from '../../src/ui/light';
import { LOGO } from '../../src/ui/logo';
import {
  FULL_TALL, GLYPHS, KEPT_WORDS, LINE, MAX_TALL, METALS, MIN_TALL, buildWord, canWrite, drawWord, fitTall, forgetWords, metalColor, penFor, tonesOf, wordHeight,
  wordLeft, wordOf, wordWidth, type Metal, type Run, type Word,
} from '../../src/ui/signType';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { record } from '../helpers/canvas';

/**
 * The letters of the game's sign, for any word: capitals, digits and a little punctuation, each the
 * path of a broad pen, with depth, a dark line round them and a face like polished metal.
 */

const CAPITALS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const MARKS = " -.:!?'";
/** The heights the game writes at, and the ones on either side of where the pen changes. */
const TALLS = [14, 15, 16, 18, 20, 22, 23, 24, 26, 28, 35, 36, 40];
const count = (rows: Run[][]): number => rows.reduce((sum, runs) => sum + runs.length, 0);
/** The face of a word as a picture of characters: one row of the word a line. */
function picture(word: Word): string {
  return word.face.map((runs) => {
    const row = Array<string>(word.w).fill('.');
    for (const run of runs) for (let x = run.x; x < run.x + run.w; x++) row[x] = '#';
    return row.join('');
  }).join('\n');
}
/** What each pixel of a word is: nothing, face, depth or the line; and how often it was claimed. */
function grid(word: Word): { kind: string[][]; claims: number[][] } {
  const kind = Array.from({ length: word.h }, () => Array<string>(word.w).fill(''));
  const claims = Array.from({ length: word.h }, () => Array<number>(word.w).fill(0));
  const lay = (rows: Run[][], name: string): void => rows.forEach((runs, y) => {
    for (const run of runs) for (let x = run.x; x < run.x + run.w; x++) { kind[y][x] = name; claims[y][x]++; }
  });
  lay(word.edge, 'edge');
  word.depth.forEach((layer) => lay(layer, 'depth'));
  lay(word.face, 'face');
  return { kind, claims };
}

afterEach(() => { forgetWords(); setDetail(2); });

describe('the alphabet', () => {
  test('every capital, every digit and a little punctuation has a shape; nothing else has', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...CAPITALS, ...DIGITS, ...MARKS].sort());
    for (const [c, glyph] of Object.entries(GLYPHS)) {
      expect(glyph.w, c).toBeGreaterThanOrEqual(9);
      expect(glyph.w, c).toBeLessThanOrEqual(37);
      // A space is room and nothing else; everything else is at least one stroke of at least two points, inside the pen's room.
      if (c === ' ') { expect(glyph.strokes).toEqual([]); continue; }
      expect(glyph.strokes.length, c).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) {
        expect(stroke.length, c).toBeGreaterThanOrEqual(2);
        for (const [x, y] of stroke) {
          expect(x, c).toBeGreaterThanOrEqual(0);
          expect(x, c).toBeLessThanOrEqual(1);
          expect(y, c).toBeGreaterThanOrEqual(0);
          expect(y, c).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('it writes capitals only, and says so before it is asked to write', () => {
    expect(canWrite('VICTORY')).toBe(true);
    expect(canWrite('THE SCRAP KING')).toBe(true);
    expect(canWrite("DON'T: 60-1!?")).toBe(true);
    expect(canWrite('Victory')).toBe(false);
    expect(canWrite('SÉANCE')).toBe(false);
    expect(canWrite('A_B')).toBe(false);
    expect(canWrite('')).toBe(false);
    // What only looks like a letter because every object has it is not one.
    expect(canWrite('constructor')).toBe(false);
    expect(() => buildWord('toString', 20)).toThrow(/no letter t/);
    expect(() => buildWord('A~', 20)).toThrow(/no letter ~/);
  });

  test('the eight letters of the game\'s name are the ones the sign over the title is made of', () => {
    const name = buildWord('IRONWAGE', FULL_TALL);
    expect([name.w, name.h, name.tall]).toEqual([LOGO.w, LOGO.h, 40]);
    expect(name.face).toEqual(LOGO.face);
    expect(name.edge).toEqual(LOGO.edge);
    expect(name.depth).toEqual(LOGO.depth);
    expect(name.letters).toEqual(LOGO.letters);
  });

  test('a stroke is seven pixels thick at forty tall, five from twenty-three, three below', () => {
    expect([14, 22, 23, 35, 36, 40].map(penFor)).toEqual([1, 1, 2, 2, 3, 3]);
    for (const tall of TALLS) {
      const thick = penFor(tall) * 2 + 1;
      // The stem of an L, half way down: one run, as thick as the pen is broad.
      const stem = buildWord('L', tall).face[1 + Math.floor(tall / 2)];
      expect(stem, `${tall} tall`).toEqual([{ x: 1, w: thick }]);
      // And its foot is as thick, from the bottom up.
      const letter = buildWord('L', tall);
      const footRows = letter.face.filter((runs) => runs.length === 1 && runs[0].w > thick).length;
      expect(footRows, `${tall} tall`).toBe(thick);
    }
  });

  test('every letter and digit stands as tall as the word, in its own room, and is as wide as its height makes it', () => {
    for (const tall of TALLS) {
      for (const c of [...CAPITALS, ...DIGITS]) {
        const word = buildWord(c, tall);
        const width = Math.round((GLYPHS[c].w * tall) / FULL_TALL);
        expect(word.letters, `${c} at ${tall}`).toEqual([{ x: 1, w: width }]);
        const rows = word.face.map((runs, y) => (runs.length ? y : -1)).filter((y) => y >= 0);
        expect([rows[0], rows.at(-1)], `${c} at ${tall}`).toEqual([1, tall]);
        const xs = word.face.flat();
        expect(Math.min(...xs.map((run) => run.x)), `${c} at ${tall}`).toBe(1);
        expect(Math.max(...xs.map((run) => run.x + run.w)), `${c} at ${tall}`).toBe(1 + width);
      }
    }
  });

  test('no character is ever narrower than the pen that draws it, at any height there is', () => {
    for (let tall = MIN_TALL; tall <= MAX_TALL; tall++) {
      for (const [c, glyph] of Object.entries(GLYPHS)) {
        expect(Math.round((glyph.w * tall) / FULL_TALL), `${JSON.stringify(c)} at ${tall}`).toBeGreaterThanOrEqual(penFor(tall) * 2 + 1);
        // And what is drawn of it stays inside the room it was given.
        if (c === ' ') continue;
        const word = buildWord(c, tall);
        for (const run of word.face.flat()) {
          expect(run.x).toBeGreaterThanOrEqual(word.letters[0].x);
          expect(run.x + run.w).toBeLessThanOrEqual(word.letters[0].x + word.letters[0].w);
        }
      }
    }
  });

  test('no two characters look the same at any height the game writes at', () => {
    for (const tall of TALLS) {
      const seen = new Map<string, string>();
      for (const c of Object.keys(GLYPHS)) {
        if (c === ' ') continue;
        const look = picture(buildWord(c, tall));
        expect(seen.get(look), `${c} at ${tall} looks like ${seen.get(look)}`).toBeUndefined();
        seen.set(look, c);
      }
    }
  });

  test('a letter with a hole in it keeps its hole down to the smallest height', () => {
    /** How many closed rooms of nothing there are inside a letter's face. */
    const holes = (c: string, tall: number): number => {
      const word = buildWord(c, tall);
      const open = grid(word).kind.map((row) => row.map((kind) => kind !== 'face'));
      const flood = (sx: number, sy: number): void => {
        const todo = [[sx, sy]];
        while (todo.length) {
          const [x, y] = todo.pop()!;
          if (x < 0 || y < 0 || x >= word.w || y >= word.h || !open[y][x]) continue;
          open[y][x] = false;
          todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      };
      // Everything that can be reached from outside is not a hole.
      flood(0, 0);
      let found = 0;
      for (let y = 0; y < word.h; y++) for (let x = 0; x < word.w; x++) if (open[y][x]) { found++; flood(x, y); }
      return found;
    };
    // At every height there is, not only the ones the game writes at: a shape that closes up or opens somewhere in between is a shape that is wrong.
    for (let tall = MIN_TALL; tall <= MAX_TALL; tall++) {
      for (const c of 'ADOPQR0469') expect(holes(c, tall), `${c} at ${tall}`).toBe(1);
      for (const c of 'B8') expect(holes(c, tall), `${c} at ${tall}`).toBe(2);
      for (const c of 'CEFGHIJKLMNSTUVWXYZ12357') expect(holes(c, tall), `${c} at ${tall}`).toBe(0);
    }
  });
});

describe('a word, worked out', () => {
  const WORDS = ['VICTORY', 'GEWONNEN', 'THE SCRAP KING', 'SIXTY AND ONE', 'A', "DON'T: 60-1!?", 'IJZERHUID'];

  test('it is as wide and as high as it is said to be before it is worked out', () => {
    for (const tall of TALLS) {
      for (const text of WORDS) {
        const word = buildWord(text, tall);
        expect([word.w, word.h], `${text} at ${tall}`).toEqual([wordWidth(text, tall), wordHeight(tall)]);
        expect(word.h).toBe(tall + penFor(tall) + 2);
        expect(word.letters).toHaveLength(text.length);
      }
    }
    expect([14, 23, 40].map(wordHeight)).toEqual([17, 27, 45]);
  });

  test('its letters stand in a row with the same gap between them: three pixels, four, or six, as the pen is', () => {
    for (const [tall, gap] of [[16, 3], [22, 3], [23, 4], [28, 4], [36, 6], [40, 6]] as [number, number][]) {
      const { letters } = buildWord('WARNING', tall);
      expect(letters[0].x).toBe(1);
      for (let i = 1; i < letters.length; i++) expect(letters[i].x - (letters[i - 1].x + letters[i - 1].w), `${tall} tall`).toBe(gap);
    }
    // A space is a letter's room with nothing in it.
    const two = buildWord('A B', 20);
    expect(two.letters[1].w).toBe(Math.round((GLYPHS[' '].w * 20) / FULL_TALL));
    expect(two.face.flat().some((run) => run.x < two.letters[2].x && run.x + run.w > two.letters[1].x)).toBe(false);
  });

  test('no pixel is claimed twice, and every row of runs is in order and inside the word', () => {
    for (const tall of [14, 23, 40]) {
      for (const text of WORDS) {
        const word = buildWord(text, tall);
        const { claims } = grid(word);
        expect(Math.max(...claims.flat()), `${text} at ${tall}`).toBe(1);
        for (const rows of [word.face, word.edge, ...word.depth, word.top, word.bottom]) {
          expect(rows).toHaveLength(word.h);
          for (const runs of rows) {
            let end = -1;
            for (const run of runs) {
              expect(run.w).toBeGreaterThan(0);
              expect(run.x).toBeGreaterThan(end);
              end = run.x + run.w;
            }
            expect(end).toBeLessThanOrEqual(word.w);
          }
        }
      }
    }
  });

  test('the depth lies down and to the right of the faces, as many pixels of it as the pen reaches', () => {
    for (const tall of [14, 23, 40]) {
      const word = buildWord('VICTORY', tall);
      expect(word.depth).toHaveLength(penFor(tall));
      const { kind } = grid(word);
      word.depth.forEach((layer, k) => {
        expect(count(layer)).toBeGreaterThan(0);
        layer.forEach((runs, y) => {
          for (const run of runs) for (let x = run.x; x < run.x + run.w; x++) expect(kind[y - k - 1][x - k - 1]).toBe('face');
        });
      });
    }
  });

  test('the line goes all the way round: nothing solid touches the open air, and no line stands alone', () => {
    for (const tall of [14, 23, 40]) {
      const word = buildWord("DON'T: 60-1!?", tall);
      const { kind } = grid(word);
      const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= word.w || y >= word.h ? 'out' : kind[y][x]);
      for (let y = 0; y < word.h; y++) {
        for (let x = 0; x < word.w; x++) {
          const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => at(x + dx, y + dy)));
          if (kind[y][x] === 'face' || kind[y][x] === 'depth') expect(around.every((k) => k !== '' && k !== 'out'), `${x},${y}`).toBe(true);
          if (kind[y][x] === 'edge') expect(around.some((k) => k === 'face' || k === 'depth'), `${x},${y}`).toBe(true);
        }
      }
    }
  });

  test('the upper and the lower edges of the faces are what has no face above it, or below', () => {
    const word = buildWord('ALARM', 23);
    const { kind } = grid(word);
    const is = (x: number, y: number): boolean => y >= 0 && y < word.h && kind[y][x] === 'face';
    const want = (dy: number): Run[][] => kind.map((row, y) => {
      const runs: Run[] = [];
      for (let x = 0; x < word.w; x++) {
        if (!(row[x] === 'face' && !is(x, y + dy))) continue;
        const last = runs.at(-1);
        if (last && last.x + last.w === x) last.w++;
        else runs.push({ x, w: 1 });
      }
      return runs;
    });
    expect(word.top).toEqual(want(-1));
    expect(word.bottom).toEqual(want(1));
  });

  test('a height it is not written at is brought to the nearest it is: whole, and from fourteen to forty', () => {
    expect([MIN_TALL, MAX_TALL, FULL_TALL]).toEqual([14, 40, 40]);
    expect(buildWord('A', 5).tall).toBe(14);
    expect(buildWord('A', 99).tall).toBe(40);
    expect(buildWord('A', 23.4).tall).toBe(23);
    expect(buildWord('A', 23.5).tall).toBe(24);
    expect(wordWidth('ALARM', 3)).toBe(wordWidth('ALARM', 14));
    expect(wordHeight(1000)).toBe(wordHeight(40));
  });

  test('a word is worked out once and kept; of the kept ones the oldest goes first', () => {
    const first = wordOf('VICTORY', 26);
    expect(wordOf('VICTORY', 26)).toBe(first);
    expect(wordOf('VICTORY', 26.2)).toBe(first);
    expect(wordOf('VICTORY', 24)).not.toBe(first);
    expect(wordOf('DEFEAT', 26)).not.toBe(first);
    expect(first).toEqual(buildWord('VICTORY', 26));
    // As many more as are kept, and the first is worked out again when it is next asked for.
    expect(KEPT_WORDS).toBe(24);
    for (let i = 0; i < KEPT_WORDS; i++) wordOf(`WORD ${i}`, 20);
    expect(wordOf('WORD 5', 20)).toBe(wordOf('WORD 5', 20));
    expect(wordOf('VICTORY', 26)).not.toBe(first);
    forgetWords();
    expect(wordOf('VICTORY', 26)).not.toBe(first);
  });
});

describe('fitting a word where it stands', () => {
  test('it is written as tall as it can be and still fit, between the tallest and the smallest asked for', () => {
    for (const [text, width, most, least] of [['VICTORY', 174, 26, 20], ['GEWONNEN', 174, 26, 20], ['RESERVESLEUTEL', 294, 28, 18], ['SECOND WIND', 150, 18, 14]] as [string, number, number, number][]) {
      const tall = fitTall(text, width, most, least)!;
      expect(tall, text).not.toBeNull();
      expect(tall).toBeLessThanOrEqual(most);
      expect(tall).toBeGreaterThanOrEqual(least);
      expect(wordWidth(text, tall), text).toBeLessThanOrEqual(width);
      // A pixel taller and it would be too wide, unless it is as tall as was asked for.
      if (tall < most) expect(wordWidth(text, tall + 1), text).toBeGreaterThan(width);
    }
    expect(fitTall('VICTORY', 174, 26, 20)).toBe(26);
    expect(fitTall('GEWONNEN', 174, 26, 20)).toBe(24);
  });

  test('more room never makes a word smaller', () => {
    let last = 0;
    for (let width = 60; width <= 320; width += 4) {
      const tall = fitTall('RESERVESLEUTEL', width, 40) ?? 0;
      expect(tall).toBeGreaterThanOrEqual(last);
      last = tall;
    }
    expect(last).toBeGreaterThan(20);
  });

  test('a word that does not fit at its smallest, or that the sign cannot write, is for the font', () => {
    expect(fitTall('COLOSSUS JUGGERNAUT', 120, 18, 14)).toBeNull();
    expect(fitTall('Victory', 300, 26)).toBeNull();
    expect(fitTall('', 300, 26)).toBeNull();
    // The smallest asked for is never gone below, however little room there is.
    expect(fitTall('VICTORY', 100, 26, 22)).toBeNull();
    expect(fitTall('VICTORY', 100, 26, 14)).not.toBeNull();
    // Asked for from smaller than it can be written, it is written at its smallest or not at all.
    expect(fitTall('A', 300, 8, 4)).toBe(14);
  });
});

describe('the metals', () => {
  const brightness = (hex: string): number => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0);

  test('steel, the game\'s colour, amber and red: each bright at the top, darkest along a line half way down, lighter again at the foot', () => {
    expect(Object.keys(METALS).sort()).toEqual(['amber', 'neon', 'red', 'steel']);
    for (const metal of Object.keys(METALS) as Metal[]) {
      const at = (p: number): number => brightness(metalColor(metal, p, true));
      const levels = Array.from({ length: 41 }, (_, i) => at(i / 40));
      expect(levels.indexOf(Math.min(...levels)), metal).toBe(20);
      expect(at(0), metal).toBeGreaterThan(at(0.3));
      expect(at(0.3), metal).toBeGreaterThan(at(0.5));
      expect(at(1), metal).toBeGreaterThan(at(0.7));
      expect(at(0.7), metal).toBeGreaterThan(at(0.5));
      // Outside a letter the colour is that of its top or its foot.
      expect(metalColor(metal, -2, true)).toBe(metalColor(metal, 0, true));
      expect(metalColor(metal, 5, true)).toBe(metalColor(metal, 1, true));
    }
  });

  test('each is its own colour where it is most itself, and unlit every one is nearly the dark behind it', () => {
    const channels = (hex: string): number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const [steel, neon, amber, red] = (['steel', 'neon', 'amber', 'red'] as Metal[]).map((metal) => channels(metalColor(metal, 0.45, true)));
    expect(steel[2]).toBeGreaterThan(steel[0]);
    expect(neon[0]).toBeGreaterThan(neon[1] * 2);
    expect(neon[2]).toBeGreaterThan(neon[1]);
    expect(amber[0]).toBeGreaterThan(amber[2] * 3);
    expect(amber[1]).toBeGreaterThan(amber[2] * 2);
    expect(red[0]).toBeGreaterThan(red[1] * 2);
    expect(red[0]).toBeGreaterThan(red[2] * 2);
    for (const metal of Object.keys(METALS) as Metal[]) {
      for (let i = 0; i <= 20; i++) {
        expect(brightness(metalColor(metal, i / 20, false)), `${metal} at ${i / 20}`).toBeLessThan(brightness(metalColor(metal, i / 20, true)));
        expect(brightness(metalColor(metal, i / 20, false))).toBeLessThan(240);
      }
    }
  });

  test('the colours of a word, row by row: light on every upper edge, shade on every lower one', () => {
    const tones = tonesOf('amber', 23, wordHeight(23), true);
    expect(tones.face).toHaveLength(27);
    // Row 1 is the top of the letters and row 23 their foot.
    expect(tones.face[1]).toBe(metalColor('amber', 0, true));
    expect(tones.face[23]).toBe(metalColor('amber', 1, true));
    expect(tones.face[12]).toBe(metalColor('amber', 0.5, true));
    for (let row = 1; row <= 23; row++) {
      expect(brightness(tones.top[row]), `row ${row}`).toBeGreaterThan(brightness(tones.face[row]));
      expect(brightness(tones.bottom[row]), `row ${row}`).toBeLessThan(brightness(tones.face[row]));
    }
  });
});

describe('a word, as it is drawn', () => {
  const total = (word: Word): number => count(word.edge) + word.depth.reduce((sum, layer) => sum + count(layer), 0) + count(word.face) + count(word.top) + count(word.bottom);

  test('lit: every run of it once, a pixel high, inside its box, round the middle it was given', () => {
    const word = buildWord('VICTORY', 26);
    const page = record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon' }));
    expect(page.rects).toHaveLength(total(word));
    const left = Math.round(155 - word.w / 2);
    expect(wordLeft('VICTORY', 155, { tall: 26 })).toBe(left);
    for (const rect of page.rects) {
      expect(rect.h).toBe(1);
      expect(rect.x).toBeGreaterThanOrEqual(left);
      expect(rect.x + rect.w).toBeLessThanOrEqual(left + word.w);
      expect(rect.y).toBeGreaterThanOrEqual(39);
      expect(rect.y).toBeLessThan(39 + word.h);
      expect(rect.alpha).toBe(1);
    }
    // The line first, under everything; the faces in their metal; nothing else, and nothing soft.
    expect(page.rects[0].color).toBe(LINE);
    const tones = tonesOf('neon', 26, word.h, true);
    const faces = page.rects.filter((rect) => tones.face.includes(rect.color));
    expect(faces.length).toBeGreaterThanOrEqual(count(word.face));
    for (const rect of faces.slice(0, 40)) expect(rect.color).toBe(tones.face[rect.y - 39]);
    expect([page.texts, page.glows, page.washes, page.images]).toEqual([[], [], [], []]);
  });

  test('from its left, from its right, or round its middle; and steel when no metal is named', () => {
    const w = wordWidth('ALARM', 23);
    const span = (align: 'left' | 'center' | 'right' | undefined): [number, number] => {
      const page = record((ctx) => drawWord(ctx, 'ALARM', 100, 10, { tall: 23, ...(align ? { align } : {}) }));
      return [Math.min(...page.rects.map((r) => r.x)), Math.max(...page.rects.map((r) => r.x + r.w))];
    };
    expect(span('left')).toEqual([100, 100 + w]);
    expect(span('right')).toEqual([100 - w, 100]);
    expect(span('center')).toEqual([Math.round(100 - w / 2), Math.round(100 - w / 2) + w]);
    expect(span(undefined)).toEqual(span('center'));
    const plain = record((ctx) => drawWord(ctx, 'ALARM', 100, 10, { tall: 23 }));
    expect(plain.rects.some((rect) => rect.color === metalColor('steel', 0, true))).toBe(true);
    // A place between two pixels is brought to a whole one: the word stays on the grid.
    const off = record((ctx) => drawWord(ctx, 'ALARM', 100.4, 10.6, { tall: 23, align: 'left' }));
    expect(off.rects.every((rect) => Number.isInteger(rect.x) && Number.isInteger(rect.y))).toBe(true);
    expect(Math.min(...off.rects.map((r) => r.y))).toBe(11);
  });

  test('unlit: the same shapes, and nothing in them as bright as the lit word', () => {
    const lit = record((ctx) => drawWord(ctx, 'DEFEAT', 155, 20, { tall: 26, metal: 'red' }));
    const dark = record((ctx) => drawWord(ctx, 'DEFEAT', 155, 20, { tall: 26, metal: 'red', level: 0 }));
    expect(dark.rects.map(({ x, y, w, h }) => [x, y, w, h])).toEqual(lit.rects.map(({ x, y, w, h }) => [x, y, w, h]));
    const brightest = (page: typeof lit): number => Math.max(...page.rects.map((rect) => [1, 3, 5].reduce((sum, at) => sum + parseInt(rect.color.slice(at, at + 2), 16), 0)));
    expect(brightest(dark)).toBeLessThan(brightest(lit) / 2);
  });

  test('half lit: the unlit word with the lit one laid over it as strongly as it is lit, and the canvas left as it was', () => {
    const word = buildWord('ALARM', 23);
    let after = -1;
    const page = record((ctx) => {
      ctx.globalAlpha = 0.8;
      drawWord(ctx, 'ALARM', 155, 20, { tall: 23, metal: 'amber', level: 0.25 });
      after = ctx.globalAlpha;
    });
    expect(after).toBe(0.8);
    expect(page.rects).toHaveLength(total(word) * 2);
    expect(page.rects.slice(0, total(word)).every((rect) => rect.alpha === 0.8)).toBe(true);
    // As lit as it is, on top of however faint everything was already being drawn.
    expect(page.rects.slice(total(word)).every((rect) => Math.abs(rect.alpha - 0.2) < 1e-9)).toBe(true);
    // More than fully lit is fully lit, and less than unlit is unlit: once, and as strongly as anything is drawn.
    const over = record((ctx) => drawWord(ctx, 'ALARM', 155, 20, { tall: 23, level: 7 }));
    expect(over.rects).toHaveLength(total(word));
    expect(over.rects.every((rect) => rect.alpha === 1)).toBe(true);
    expect(over.rects).toEqual(record((ctx) => drawWord(ctx, 'ALARM', 155, 20, { tall: 23 })).rects);
    const under = record((ctx) => drawWord(ctx, 'ALARM', 155, 20, { tall: 23, level: -1 }));
    expect(under.rects).toEqual(record((ctx) => drawWord(ctx, 'ALARM', 155, 20, { tall: 23, level: 0 })).rects);
  });

  test('a text it cannot write is not drawn at all, and nothing fails', () => {
    expect(record((ctx) => drawWord(ctx, 'Victory', 155, 20, { tall: 26 })).rects).toEqual([]);
    expect(record((ctx) => drawWord(ctx, '', 155, 20, { tall: 26 })).rects).toEqual([]);
    expect(record((ctx) => drawWord(ctx, 'A~B', 155, 20, { tall: 26 })).rects).toEqual([]);
  });

  test('it is solid: with less light, or none, it is drawn exactly as with all of it', () => {
    const full = record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon', level: 0.6 }));
    for (const level of [1, 0] as const) {
      setDetail(level);
      expect(record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon', level: 0.6 }))).toEqual(full);
    }
  });
});

describe('the shape of every letter', () => {
  const GOLDEN = 'tests/ui/glyphs.golden.txt';
  /** The face of a word at this height, a `#` for every pixel of it. */
  const picture = (text: string, tall: number): string => buildWord(text, tall).face.map((runs) => {
    const row: string[] = [];
    for (const run of runs) for (let x = run.x; x < run.x + run.w; x++) row[x] = '#';
    return Array.from(row, (mark) => mark ?? '.').join('');
  }).join('\n').replace(/\n+$/, '');
  const sheet = (): string => Object.keys(GLYPHS).sort().map((c) => `== ${c === ' ' ? 'space' : c} ==\n${picture(c, MIN_TALL)}`).join('\n\n') + '\n';

  test('each of them is, pixel for pixel, the picture that was looked at and kept', () => {
    // The pictures are kept in a file a person can read. After a letter is changed on purpose: look at
    // what it has become, and write the file anew with UPDATE_GLYPHS=1. It is never written unasked:
    // a file that has gone missing is a failure, not a reason to keep whatever the letters are now.
    if (process.env.UPDATE_GLYPHS) writeFileSync(GOLDEN, sheet());
    expect(existsSync(GOLDEN), `${GOLDEN} is kept with the tests`).toBe(true);
    const kept = readFileSync(GOLDEN, 'utf8');
    expect(sheet()).toBe(kept);
    // Every character the sign writes is in it, and a letter is a picture of something.
    for (const c of Object.keys(GLYPHS)) expect(kept, c).toContain(`== ${c === ' ' ? 'space' : c} ==`);
    expect(kept.split('#').length).toBeGreaterThan(1500);
  });

  test('a V comes to a point at the bottom, an A at the top, and a T has its bar over its stem', () => {
    const rows = (c: string): number[] => picture(c, MIN_TALL).split('\n').map((row) => row.split('#').length - 1).filter((n) => n > 0);
    const spread = (c: string): number[] => picture(c, MIN_TALL).split('\n').filter((row) => row.includes('#')).map((row) => row.lastIndexOf('#') - row.indexOf('#'));
    const v = spread('V');
    expect(v[0]).toBeGreaterThan(v.at(-1)! + 3);
    const a = spread('A');
    expect(a.at(-1)!).toBeGreaterThan(a[0] + 3);
    const t = rows('T');
    expect(t[0]).toBeGreaterThan(t.at(-1)! + 3);
  });
});

describe('a word, kept', () => {
  /** A platform with canvases: how many were asked for, what was painted on each, and whether they give a context to paint on. */
  function platform(gives: () => boolean) {
    const made: { width: number; height: number; fills: number; painted: [string, number, number, number, number][] }[] = [];
    (globalThis as { document?: unknown }).document = {
      createElement: () => {
        let color = '';
        const canvas = {
          width: 0, height: 0, fills: 0, painted: [] as [string, number, number, number, number][],
          getContext: () => (gives() ? {
            set fillStyle(next: string) { color = next; },
            fillRect: (x: number, y: number, w: number, h: number) => { canvas.fills++; canvas.painted.push([color, x, y, w, h]); },
          } : null),
        };
        made.push(canvas);
        return canvas;
      },
    };
    return made;
  }
  afterEach(() => { delete (globalThis as { document?: unknown }).document; });
  const total = (word: Word): number => count(word.edge) + word.depth.reduce((sum, layer) => sum + count(layer), 0) + count(word.face) + count(word.top) + count(word.bottom);

  test('where the platform has a canvas a word is painted on it once, and from then on drawn from there in one go', () => {
    const made = platform(() => true);
    const word = buildWord('VICTORY', 26);
    const first = record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon' }));
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ width: word.w, height: word.h, fills: total(word) });
    expect(first.rects).toEqual([]);
    expect(first.images).toHaveLength(1);
    expect(first.images[0]).toMatchObject({ x: Math.round(155 - word.w / 2), y: 39, alpha: 1 });
    expect(first.images[0].image).toBe(made[0]);
    for (let i = 0; i < 20; i++) record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon' }));
    expect(made).toHaveLength(1);
    // Another metal, another height, another word, or unlit: each is a picture of its own.
    record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'red' }));
    record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 24, metal: 'neon' }));
    record((ctx) => drawWord(ctx, 'DEFEAT', 155, 39, { tall: 26, metal: 'neon' }));
    expect(made).toHaveLength(4);
    const half = record((ctx) => drawWord(ctx, 'VICTORY', 155, 39, { tall: 26, metal: 'neon', level: 0.5 }));
    expect(made).toHaveLength(5);
    expect(half.images.map((image) => image.alpha)).toEqual([1, 0.5]);
    expect(half.images[0].image).toBe(made[4]);
    expect(half.images[1].image).toBe(made[0]);
  });

  test('what is kept is the word as it is painted where nothing can be kept: lit where it is lit, dark where it is dark', () => {
    const fills = (level: number): [string, number, number, number, number][] => record((ctx) => drawWord(ctx, 'VICTORY', 0, 0, { tall: 26, metal: 'neon', level, align: 'left' }))
      .rects.map((r) => [r.color, r.x, r.y, r.w, r.h]);
    // Painted afresh, as on a platform without canvases: once lit, once dark.
    const lit = fills(1);
    const dark = fills(0);
    expect(lit.length).toBeGreaterThan(100);
    expect(lit.map((f) => f[0])).not.toEqual(dark.map((f) => f[0]));
    // On a platform with canvases the same is painted on the canvas that is kept, to the pixel and the colour.
    forgetWords();
    const made = platform(() => true);
    record((ctx) => drawWord(ctx, 'VICTORY', 0, 0, { tall: 26, metal: 'neon', level: 1, align: 'left' }));
    record((ctx) => drawWord(ctx, 'VICTORY', 0, 0, { tall: 26, metal: 'neon', level: 0, align: 'left' }));
    expect(made).toHaveLength(2);
    expect(made[0].painted).toEqual(lit);
    expect(made[1].painted).toEqual(dark);
  });

  test('a platform whose canvas gives nothing to paint on has the word painted afresh, and is not asked again for that word', () => {
    const made = platform(() => false);
    const word = buildWord('ALARM', 23);
    for (let i = 0; i < 5; i++) {
      const page = record((ctx) => drawWord(ctx, 'ALARM', 155, 20, { tall: 23, metal: 'amber' }));
      expect(page.images).toEqual([]);
      expect(page.rects).toHaveLength(total(word));
    }
    expect(made).toHaveLength(1);
  });

  test('no more pictures are kept than twice the words that are: the oldest goes', () => {
    const made = platform(() => true);
    for (let i = 0; i < KEPT_WORDS * 2 + 6; i++) record((ctx) => drawWord(ctx, `WORD ${i}`, 155, 20, { tall: 20 }));
    expect(made).toHaveLength(KEPT_WORDS * 2 + 6);
    // The newest are still there; the first has gone and is painted again.
    record((ctx) => drawWord(ctx, `WORD ${KEPT_WORDS * 2 + 5}`, 155, 20, { tall: 20 }));
    expect(made).toHaveLength(KEPT_WORDS * 2 + 6);
    record((ctx) => drawWord(ctx, 'WORD 0', 155, 20, { tall: 20 }));
    expect(made).toHaveLength(KEPT_WORDS * 2 + 7);
  });
});
