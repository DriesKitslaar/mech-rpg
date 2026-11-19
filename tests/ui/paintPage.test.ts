import { newGame, type GameState } from '../../src/core/game';
import { DEFAULT_MIXES, MIX_KEYS, MIX_STEPS, mixId, mixesOf, parseMix, setMix, stepMix, type Mix, type MixKey } from '../../src/core/mix';
import { WORLD } from '../../src/content/codex';
import { MEDALS } from '../../src/content/medals';
import { setLanguage, type Language } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { GarageFlow } from '../../src/ui/garageFlow';
import { MIX_PAGE } from '../../src/ui/garageScreen';
import { CROWN_PAINTS, PAINTS, SEAT_PAINT, mixSwatches } from '../../src/ui/paint';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { done, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { record, type Drawn, type Filled, type Written } from '../helpers/canvas';

/**
 * The garage's page of paint: the third of its panel's pages, on which a pilot's own mix is set a
 * step at a time while the machine beside it changes.
 */

afterEach(() => setLanguage('en'));

const M = STRINGS.garage.mixer;
const G = STRINGS.garage;
const LANGUAGES: Language[] = ['en', 'nl'];
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const ROWS = ['paint', ...MIX_KEYS];
/** A flow on the paint page, with the cursor on a row. */
function onPaint(game: GameState, row = 'paint'): GarageFlow {
  const flow = new GarageFlow(game, CATALOG);
  expect(flow.onInput('left')).toBe('stay');
  expect(flow.mode).toBe('paint');
  for (let i = 0; i < ROWS.length && flow.paintRows.selected?.id !== row; i++) flow.onInput('down');
  expect(flow.paintRows.selected?.id).toBe(row);
  return flow;
}
const worn = (flow: GarageFlow): Mix => parseMix(flow.game.paint)!;

describe('the pages of the garage stand in a ring', () => {
  test('paint, parts, builds: left and right go round it, and B on the paint or the builds is back to the parts', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    const turn = (action: 'left' | 'right' | 'cancel'): string => { expect(flow.onInput(action)).toBe('stay'); return flow.mode; };
    expect(flow.mode).toBe('slots');
    expect([turn('right'), turn('right'), turn('right')]).toEqual(['loadouts', 'paint', 'slots']);
    expect([turn('left'), turn('left'), turn('left')]).toEqual(['paint', 'loadouts', 'slots']);
    expect([turn('left'), turn('cancel')]).toEqual(['paint', 'slots']);
    expect([turn('right'), turn('cancel')]).toEqual(['loadouts', 'slots']);
    // Going round changes nothing of the game.
    expect(flow.game).toEqual(fresh());
    // And from the parts B still leaves the garage.
    expect(flow.onInput('cancel')).toBe('exit');
  });

  test('the page a part is chosen on, the bench and a build\'s own menu are no part of the ring', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    flow.onInput('confirm');
    expect(flow.mode).toBe('parts');
    flow.onInput('left');
    flow.onInput('right');
    expect(flow.mode).toBe('parts');
    flow.onInput('cancel');
    flow.onInput('right');
    flow.onInput('confirm');
    expect(flow.mode).toBe('loadoutMenu');
    flow.onInput('left');
    flow.onInput('right');
    expect(flow.mode).toBe('loadoutMenu');
  });
});

describe('the rows of the paint page', () => {
  test('the paint that is worn, and the five things a mix sets: up and down go through them and round', () => {
    const flow = onPaint(fresh());
    expect(flow.paintRows.items.map((item) => item.id)).toEqual(ROWS);
    expect(flow.paintRows.items.map((item) => item.label)).toEqual([M.rows.paint, M.rows.hue, M.rows.finish, M.rows.shade, M.rows.trim, M.rows.glow]);
    const seen: string[] = [];
    for (let i = 0; i < ROWS.length; i++) { expect(flow.onInput('down')).toBe('stay'); seen.push(flow.paintRows.selected!.id); }
    expect(seen).toEqual([...MIX_KEYS, 'paint']);
    flow.onInput('up');
    expect(flow.paintRows.selected!.id).toBe('glow');
  });

  test('the first row says what is worn; the others are a mix\'s, and are dim while what is worn is none', () => {
    const plain = onPaint(fresh());
    expect(plain.mix).toBeNull();
    expect(plain.paintRows.items[0]).toMatchObject({ enabled: true, note: G.factoryPaint });
    expect(plain.paintRows.items.slice(1).map((item) => item.enabled)).toEqual([false, false, false, false, false]);
    const ready = onPaint({ ...fresh(), paint: PAINTS[2].id });
    expect(ready.paintRows.items[0].note).toBe(PAINTS[2].name);
    expect(ready.paintRows.items.slice(1).some((item) => item.enabled)).toBe(false);
    const mixed = onPaint(setMix(fresh(), DEFAULT_MIXES[1]));
    expect(mixed.mix).toEqual(DEFAULT_MIXES[1]);
    expect(mixed.paintRows.items[0].note).toBe('Mix 2');
    expect(mixed.paintRows.items.map((item) => item.enabled)).toEqual([true, true, true, true, true, true]);
    // A name of the shape of a mix that is none is worn as factory colours are, and its rows are dim.
    const odd = onPaint({ ...fresh(), paint: 'mix1-99-9-9-99-9' });
    expect(odd.mix).toBeNull();
    expect(odd.paintRows.items[0].note).toBe(G.factoryPaint);
    expect(odd.paintRows.items.slice(1).some((item) => item.enabled)).toBe(false);
  });
});

describe('L1 and R1 change the row under the cursor', () => {
  test('on the first row they go through the paints, as on the parts: and the rows wake when a mix is come to', () => {
    const flow = onPaint(fresh());
    expect(flow.onInput('next')).toBe('changed');
    expect(flow.game.paint).toBe(PAINTS[0].id);
    expect(flow.paintRows.items[0].note).toBe(PAINTS[0].name);
    expect(flow.onInput('prev')).toBe('changed');
    expect(flow.game.paint).toBe('factory');
    expect(flow.onInput('prev')).toBe('changed');
    expect(flow.game.paint).toBe(mixId(DEFAULT_MIXES[2]));
    expect(flow.paintRows.items.map((item) => item.enabled)).toEqual([true, true, true, true, true, true]);
    expect(flow.paintRows.items[0].note).toBe('Mix 3');
    expect(flow.onInput('next')).toBe('changed');
    expect(flow.paintRows.items.slice(1).some((item) => item.enabled)).toBe(false);
    // Which is worn is all that going through them keeps.
    expect(flow.game.mixes).toBeUndefined();
    expect(flow.paintRows.selected!.id).toBe('paint');
  });

  test.each(MIX_KEYS)('on the row of %s they take that one thing a step on or back, round and round, and the mix is kept in its place and worn', (key) => {
    const start = DEFAULT_MIXES[1];
    const flow = onPaint(setMix(fresh(), start), key);
    expect(flow.onInput('next')).toBe('changed');
    expect(worn(flow)).toEqual(stepMix(start, key, 1));
    expect(flow.mix).toEqual(stepMix(start, key, 1));
    expect(flow.game.mixes).toEqual([mixId(DEFAULT_MIXES[0]), mixId(stepMix(start, key, 1)), mixId(DEFAULT_MIXES[2])]);
    expect(flow.onInput('prev')).toBe('changed');
    expect(flow.onInput('prev')).toBe('changed');
    expect(worn(flow)).toEqual(stepMix(start, key, -1));
    // All the way round is where it began.
    for (let i = 0; i < MIX_STEPS[key] + 1; i++) expect(flow.onInput('next')).toBe('changed');
    expect(worn(flow)).toEqual(start);
    // The cursor has not moved, and the first row still calls the mix by its place.
    expect(flow.paintRows.selected!.id).toBe(key);
    expect(flow.paintRows.items[0].note).toBe('Mix 2');
  });

  test('on a row that is dim they do nothing, and nothing is kept', () => {
    for (const key of MIX_KEYS) {
      const flow = onPaint({ ...fresh(), paint: PAINTS[0].id }, key);
      const before = flow.game;
      expect(flow.onInput('next')).toBe('stay');
      expect(flow.onInput('prev')).toBe('stay');
      expect(flow.game).toBe(before);
    }
  });

  test('A does nothing on the page', () => {
    for (const row of ROWS) {
      const flow = onPaint(setMix(fresh(), DEFAULT_MIXES[0]), row);
      const before = flow.game;
      expect(flow.onInput('confirm')).toBe('stay');
      expect(flow.game).toBe(before);
      expect(flow.mode).toBe('paint');
    }
  });

  test('a mix is as it was left: another paint put on and the mix come back to, it is the mix that was made', () => {
    const flow = onPaint(setMix(fresh(), DEFAULT_MIXES[0]), 'hue');
    for (let i = 0; i < 5; i++) flow.onInput('next');
    const made = worn(flow);
    expect(made.hue).toBe(DEFAULT_MIXES[0].hue + 5);
    flow.onInput('up');
    expect(flow.paintRows.selected!.id).toBe('paint');
    flow.onInput('next');
    expect(flow.game.paint).toBe(mixId(DEFAULT_MIXES[1]));
    flow.onInput('prev');
    expect(worn(flow)).toEqual(made);
    expect(mixesOf(flow.game)).toEqual([made, DEFAULT_MIXES[1], DEFAULT_MIXES[2]]);
  });

  test('a mix that is worn but is not the one kept in its place is kept there as soon as it is changed', () => {
    const stray = stepMix(DEFAULT_MIXES[2], 'trim', 9);
    const flow = onPaint({ ...fresh(), paint: mixId(stray) }, 'glow');
    expect(flow.mix).toEqual(stray);
    flow.onInput('next');
    expect(flow.game.mixes![2]).toBe(mixId(stepMix(stray, 'glow', 1)));
  });
});

/** Through the game: what the screen says of itself, what it draws, and that every press is kept. */

const pilot = (extra: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), codex: WORLD.map((entry) => entry.id), ...extra });
interface Page { mode: string; paint: string; mix: Mix | null }
const page = (app: App): Page => snap(app).garage as Page;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
/** From the hangar to the garage's page of paint, in the language given, with the cursor on a row. */
function inGarage(saved: GameState, language: Language = 'en', row = 'paint', deps: Parameters<typeof inHub>[2] = {}) {
  const made = inHub(saved, undefined, deps);
  setLanguage(language);
  select(made.app, 'garage');
  press(made.app, 'left');
  expect(page(made.app).mode).toBe('paint');
  for (let i = 0; i < ROWS.length && snap(made.app).menu.items[snap(made.app).menu.cursor].id !== row; i++) press(made.app, 'down');
  return made;
}
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
/** The cells of the strip on a row: side by side from the strip's left edge, each as wide as its row's cells are. */
const cells = (shown: Drawn, key: MixKey): Filled[] => {
  const y = MIX_PAGE.rowY(ROWS.indexOf(key)) + MIX_PAGE.stripDy;
  const w = MIX_PAGE.cellW(key);
  return shown.rects.filter((r) => r.y === y && r.h === MIX_PAGE.stripH && r.w === w && r.x >= MIX_PAGE.stripX && r.x < MIX_PAGE.stripX + w * MIX_STEPS[key]).sort((a, b) => a.x - b.x);
};

describe('the page as the screen has it', () => {
  test('it says it is the paint page, which paint is worn and the mix that is: and its rows are the menu', () => {
    const { app } = inGarage(pilot());
    expect(page(app)).toEqual(expect.objectContaining({ mode: 'paint', paint: 'factory', mix: null }));
    expect(snap(app).menu.items.map((item) => item.id)).toEqual(ROWS);
    press(app, 'prev');
    expect(page(app)).toEqual(expect.objectContaining({ paint: mixId(DEFAULT_MIXES[2]), mix: DEFAULT_MIXES[2] }));
  });

  test('every press is kept at once', () => {
    const { app, store } = inGarage(setMix(pilot(), DEFAULT_MIXES[0]), 'en', 'shade');
    press(app, 'next');
    const kept = savedGame(store);
    expect(kept.paint).toBe(mixId(stepMix(DEFAULT_MIXES[0], 'shade', 1)));
    expect(kept.mixes![0]).toBe(kept.paint);
    press(app, 'next', 'next');
    expect(parseMix(savedGame(store).paint)!.shade).toBe(3);
    // And the page is still the page: the game that was kept is the one it goes on from.
    expect(page(app)).toEqual(expect.objectContaining({ mode: 'paint', mix: stepMix(DEFAULT_MIXES[0], 'shade', 3) }));
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('shade');
  });

  test('the machine beside it is drawn in the mix as it stands after each press', () => {
    const asked: string[] = [];
    const picture = (fallback: { w: number; h: number }) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h });
    const store: SpriteStore = { get: (_id, fallback) => picture(fallback), painted: (_id, paint, fallback) => { asked.push(paint); return picture(fallback); } };
    const { app } = inGarage(setMix(pilot(), DEFAULT_MIXES[0]), 'en', 'hue', { sprites: store });
    for (let i = 1; i <= 3; i++) {
      press(app, 'next');
      asked.length = 0;
      drawn(app);
      expect(new Set(asked)).toEqual(new Set([mixId({ ...DEFAULT_MIXES[0], hue: DEFAULT_MIXES[0].hue + i })]));
    }
  });
});

describe('the medal for a mix', () => {
  const medal = MEDALS.find((entry) => entry.id === 'mixed')!;

  test('wearing one of the pilot\'s own mixes earns it: a ready paint does not, nor a name that is no mix', () => {
    expect(medal).toMatchObject({ name: 'Own Colours', tier: 1 });
    expect(medal.progress(setMix(fresh(), DEFAULT_MIXES[0]))).toEqual({ have: 1, need: 1 });
    expect(medal.progress(setMix(fresh(), stepMix(DEFAULT_MIXES[2], 'trim', 5)))).toEqual({ have: 1, need: 1 });
    for (const paint of ['factory', PAINTS[0].id, 'mercury', 'mix1-99-9-9-99-9', 'mix']) expect(medal.progress({ ...fresh(), paint }), paint).toEqual({ have: 0, need: 1 });
  });

  test('in the garage it comes with the first mix that is put on, and is not among the medals before', () => {
    const { app, store } = inGarage(pilot());
    expect(savedGame(store).medals).not.toContain('mixed');
    press(app, 'next');
    expect(savedGame(store).medals).not.toContain('mixed');
    press(app, 'prev', 'prev');
    expect(parseMix(savedGame(store).paint)).toEqual(DEFAULT_MIXES[2]);
    expect(savedGame(store).medals).toContain('mixed');
    // The page goes on from the game as it was kept, with the medal in it.
    press(app, 'down', 'next');
    expect(savedGame(store).medals.filter((id) => id === 'mixed')).toHaveLength(1);
    expect(parseMix(savedGame(store).paint)).toEqual(stepMix(DEFAULT_MIXES[2], 'hue', 1));
  });
});

describe('what the page draws', () => {
  test.each(LANGUAGES)('its heading, its rows by name, the paint that is worn and what the shoulder buttons do (%s)', (language) => {
    const { app } = inGarage(setMix(pilot(), DEFAULT_MIXES[1]), language);
    const shown = drawn(app);
    expect(written(shown, M.heading)).toMatchObject({ y: MIX_PAGE.headY, color: COLORS.dim });
    // The page is not called what its first row is called.
    expect(M.heading).not.toBe(M.rows.paint);
    expect(written(shown, M.change)).toMatchObject({ align: 'right', size: 10, color: COLORS.dim });
    ROWS.forEach((row, i) => {
      const label = shown.texts.filter((t) => t.text === M.rows[row as keyof typeof M.rows] && t.y === MIX_PAGE.rowY(i) + 1);
      expect(label, row).toHaveLength(1);
      expect(label[0]).toMatchObject({ size: 10, color: COLORS.dim });
    });
    // The cursor's row has the mark and its value lit.
    expect(shown.texts.filter((t) => t.text === '>' && t.y === MIX_PAGE.rowY(0))).toHaveLength(1);
    expect(written(shown, 'Mix 2')).toMatchObject({ x: MIX_PAGE.stripX, y: MIX_PAGE.rowY(0), color: COLORS.accent });
    press(app, 'down');
    const moved = drawn(app);
    expect(moved.texts.filter((t) => t.text === '>' && t.y === MIX_PAGE.rowY(1))).toHaveLength(1);
    expect(written(moved, 'Mix 2').color).toBe(COLORS.text);
  });

  test('each of the five rows has a strip of its steps in the colours they would give, with the one chosen marked', () => {
    const mix = stepMix(stepMix(DEFAULT_MIXES[2], 'hue', 3), 'glow', -1);
    const { app } = inGarage(setMix(pilot(), mix));
    const shown = drawn(app);
    for (const key of MIX_KEYS) {
      const strip = cells(shown, key);
      expect(strip.map((cell) => cell.color), key).toEqual(mixSwatches(mix, key));
      expect(strip.map((cell) => cell.x), key).toEqual(Array.from({ length: MIX_STEPS[key] }, (_, i) => MIX_PAGE.stripX + i * MIX_PAGE.cellW(key)));
      // The mark: a bar over and a bar under the chosen cell, and over and under no other.
      const y = MIX_PAGE.rowY(ROWS.indexOf(key)) + MIX_PAGE.stripDy;
      const marks = shown.rects.filter((r) => r.color === COLORS.text && r.h === 1 && r.w === MIX_PAGE.cellW(key) && (r.y === y - 2 || r.y === y + MIX_PAGE.stripH + 1));
      expect(marks.map((r) => r.x), key).toEqual([strip[mix[key]].x, strip[mix[key]].x]);
      expect(marks.map((r) => r.y).sort((a, b) => a - b), key).toEqual([y - 2, y + MIX_PAGE.stripH + 1]);
    }
    // The whole of a strip stands inside the panel.
    for (const key of MIX_KEYS) expect(MIX_PAGE.stripX + MIX_STEPS[key] * MIX_PAGE.cellW(key), key).toBeLessThanOrEqual(LOGICAL_W - 6);
  });

  test('the mark follows the step as it is changed', () => {
    const { app } = inGarage(setMix(pilot(), DEFAULT_MIXES[0]), 'en', 'trim');
    const at = (): number => {
      const shown = drawn(app);
      const y = MIX_PAGE.rowY(ROWS.indexOf('trim')) + MIX_PAGE.stripDy;
      const marks = shown.rects.filter((r) => r.color === COLORS.text && r.h === 1 && r.w === MIX_PAGE.cellW('trim') && r.y === y - 2);
      expect(marks).toHaveLength(1);
      return (marks[0].x - MIX_PAGE.stripX) / MIX_PAGE.cellW('trim');
    };
    expect(at()).toBe(DEFAULT_MIXES[0].trim);
    press(app, 'next');
    expect(at()).toBe(DEFAULT_MIXES[0].trim + 1);
    for (let i = 0; i < 12; i++) press(app, 'next');
    expect(at()).toBe((DEFAULT_MIXES[0].trim + 13) % 24);
  });

  test.each(LANGUAGES)('the three rows whose steps have names say the name of the one chosen, beside the strip (%s)', (language) => {
    const mix: Mix = { slot: 1, hue: 3, finish: 3, shade: 4, trim: 20, glow: 0 };
    const { app } = inGarage(setMix(pilot(), mix), language);
    const shown = drawn(app);
    for (const key of ['finish', 'shade', 'glow'] as const) {
      const word = M[key][mix[key]];
      const text = shown.texts.filter((t) => t.text === word && t.y === MIX_PAGE.rowY(ROWS.indexOf(key)));
      expect(text, `${key} ${word}`).toHaveLength(1);
      expect(text[0].left).toBeGreaterThanOrEqual(MIX_PAGE.stripX + MIX_STEPS[key] * MIX_PAGE.cellW(key) + 4);
      expect(text[0].right).toBeLessThanOrEqual(LOGICAL_W - 6);
    }
    // Every name there is fits there, whichever is chosen.
    for (const key of ['finish', 'shade', 'glow'] as const) {
      expect(M[key]).toHaveLength(MIX_STEPS[key]);
      for (const word of M[key]) expect(MIX_PAGE.stripX + MIX_STEPS[key] * MIX_PAGE.cellW(key) + 6 + word.length * 4.8, `${language} ${word}`).toBeLessThanOrEqual(LOGICAL_W - 6);
    }
  });

  test.each(LANGUAGES)('under the rows a line says whose the paint is: a mix is the pilot\'s to mix, and any other says to choose one (%s)', (language) => {
    const mixed = drawn(inGarage(setMix(pilot(), DEFAULT_MIXES[0]), language).app);
    setLanguage(language);
    const said = (shown: Drawn): string => shown.texts.filter((t) => t.y >= MIX_PAGE.noteY && t.y < 194 && t.left >= 162).map((t) => t.text).join(' ');
    expect(said(mixed)).toBe(M.yours);
    setLanguage('en');
    const plain = drawn(inGarage(pilot({ paint: PAINTS[4].id }), language).app);
    setLanguage(language);
    expect(said(plain)).toBe(M.ready);
    // With no mix worn the five rows have no strip: a dash stands where each would be.
    expect(MIX_KEYS.flatMap((key) => cells(plain, key))).toEqual([]);
    expect(plain.texts.filter((t) => t.text === '-' && t.x === MIX_PAGE.stripX)).toHaveLength(MIX_KEYS.length);
    expect(mixed.texts.filter((t) => t.text === '-' && t.x === MIX_PAGE.stripX)).toHaveLength(0);
  });

  test.each(LANGUAGES)('nothing on the page runs out of its panel or over anything else (%s)', (language) => {
    for (const game of [setMix(pilot(), { slot: 3, hue: 23, finish: 3, shade: 4, trim: 23, glow: 2 }), setMix(pilot(), DEFAULT_MIXES[0]), pilot(), pilot({ paint: PAINTS[1].id })]) {
      const { app } = inGarage(game, language);
      for (let row = 0; row < ROWS.length; row++) {
        const shown = drawn(app);
        const inPanel = shown.texts.filter((t) => t.text !== '' && t.left >= 162 && t.y >= 20 && t.y < 194);
        for (const text of inPanel) {
          expect(text.right, `${language}: ${text.text}`).toBeLessThanOrEqual(LOGICAL_W - 4);
          expect(text.y + 10, `${language}: ${text.text}`).toBeLessThanOrEqual(194);
        }
        for (const a of inPanel) for (const b of inPanel) {
          if (a !== b && Math.abs(a.y - b.y) < 9) expect(a.right <= b.left || b.right <= a.left, `${language}: "${a.text}" and "${b.text}"`).toBe(true);
        }
        press(app, 'down');
      }
      setLanguage('en');
    }
  });

  test.each(LANGUAGES)('the foot of the screen says which way the other pages are, on the paint page and on the parts (%s)', (language) => {
    const { app } = inGarage(setMix(pilot(), DEFAULT_MIXES[0]), language);
    const onPage = drawn(app);
    expect(written(onPage, G.pages.paint)).toMatchObject({ align: 'right', size: 10, color: COLORS.dim });
    press(app, 'right');
    expect(page(app).mode).toBe('slots');
    const onParts = drawn(app);
    const hint = written(onParts, G.pages.slots);
    const paint = written(onParts, G.paint('Mix 1'));
    expect(hint).toMatchObject({ align: 'right', size: 10, color: COLORS.dim, y: paint.y });
    expect(paint.right).toBeLessThan(hint.left - 8);
    expect(hint.right).toBeLessThanOrEqual(LOGICAL_W - 4);
    // And with the paint of the longest name there is worn, the two are still apart: a letter of this size is four wide.
    const longest = Math.max(G.factoryPaint.length, ...[...PAINTS, ...CROWN_PAINTS, SEAT_PAINT].map((scheme) => scheme.name.length), 'Mix 3'.length);
    expect(paint.x + G.paint('x'.repeat(longest)).length * 4, language).toBeLessThan(LOGICAL_W - 8 - G.pages.slots.length * 4 - 8);
    // The two feet say different things, each of the page it is on.
    expect(G.pages.paint).not.toBe(G.pages.slots);
  });

  test('the rows stand far enough apart for each to have its strip and its mark to itself, and the last of them clear of the line under them', () => {
    const tall = MIX_PAGE.stripDy + MIX_PAGE.stripH + 2;
    for (let row = 0; row < ROWS.length - 1; row++) expect(MIX_PAGE.rowY(row + 1) - MIX_PAGE.rowY(row), `${row}`).toBeGreaterThanOrEqual(tall + 4);
    expect(MIX_PAGE.rowY(ROWS.length - 1) + tall).toBeLessThan(MIX_PAGE.noteY - 4);
    // The heading has its own line over the first row.
    expect(MIX_PAGE.rowY(0) - MIX_PAGE.headY).toBeGreaterThanOrEqual(14);
  });
});
