import { ARCHETYPES, archetypeOf, wonAs, type Archetype } from '../../src/core/archetype';
import type { GameState } from '../../src/core/game';
import { MEDAL_PAY } from '../../src/core/medals';
import { levelFor, perkPoints, xpForLevel } from '../../src/core/pilot';
import { ALL_STRIPES, MAX_STRIPES, STRIPES_AT, nextPointAt, stripePoints, stripesHeld, stripesOf } from '../../src/core/stripes';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage, type Language } from '../../src/content/language';
import { MEDALS } from '../../src/content/medals';
import '../../src/content/nl';
import { CATALOG } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { STRINGS } from '../../src/content/strings';
import { TOAST_MS, type App } from '../../src/ui/app';
import { LOGICAL_H, LOGICAL_W } from '../../src/ui/display';
import { CLASS_STRIPE_Y, PERKS_STRIPES_Y, STRIPES_X } from '../../src/ui/pilotScreen';
import { COLORS, CROWN_COLOR, LINE, STRIPES_H, STRIPES_W, STRIPE_COLOR } from '../../src/ui/widgets';
import { accept, done, finishMission, inHub, press, retreat, savedGame, select, snap, strong } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { record, type Drawn, type Filled, type Written } from '../helpers/canvas';

afterEach(() => setLanguage('en'));

/** Stripes, as the game has them: the points they bring are the pilot's to spend, and a contract won as a class is what earns one. */

/** A record with so many stripes: the first of each class in the classes' order, then the second of each, then the third. */
function holding(stripes: number): GameState['wonAs'] {
  const counts: Partial<{ [kind in Archetype]: number }> = {};
  for (let i = 0; i < stripes; i++) counts[ARCHETYPES[i % ARCHETYPES.length]] = STRIPES_AT[Math.floor(i / ARCHETYPES.length)];
  return counts as GameState['wonAs'];
}
const pilot = (extra: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), xp: 0, perks: {}, ...extra });
const points = (app: App): number => (snap(app) as unknown as { pilot: { level: number; points: number } }).pilot.points;
const pilotRow = (app: App) => snap(app).menu.items.find((item) => item.id === 'pilot')!;

describe('the points stripes bring', () => {
  test('a pilot with five stripes and no level to speak of has a point: the hangar says so, and the perks page has it to spend', () => {
    const { app, store } = inHub(pilot({ wonAs: holding(5) }));
    expect(pilotRow(app).note).toBe(STRINGS.hub.points(1));
    select(app, 'pilot');
    expect(snap(app).page).toBe('perks');
    expect(points(app)).toBe(1);
    // Spent on the perk under the cursor, like any point: and then there is none.
    press(app, 'confirm');
    expect(points(app)).toBe(0);
    expect(savedGame(store).perks).toEqual({ [PERKS[0].id]: 1 });
    press(app, 'confirm');
    expect(savedGame(store).perks).toEqual({ [PERKS[0].id]: 1 });
    press(app, 'cancel');
    expect(pilotRow(app).note).toBeUndefined();
  });

  test('a game kept with a perk bought on a stripe\'s point opens as it was left: the perk held, and no point to spend twice', () => {
    const { app, store } = inHub(pilot({ wonAs: holding(5) }));
    select(app, 'pilot');
    press(app, 'confirm');
    const kept = savedGame(store);
    expect(kept.perks).toEqual({ [PERKS[0].id]: 1 });
    // More ranks than its levels alone would pay for: the stripes pay for the one.
    expect(levelFor(kept.xp) - 1).toBe(0);
    expect(perkPoints(kept, PERKS)).toBe(0);
    const again = inHub(kept);
    expect(pilotRow(again.app).note).toBeUndefined();
    select(again.app, 'pilot');
    expect(points(again.app)).toBe(0);
    press(again.app, 'confirm');
    expect(savedGame(again.store).perks).toEqual({ [PERKS[0].id]: 1 });
  });

  test('four stripes are no point, and ten are two', () => {
    const none = inHub(pilot({ wonAs: holding(4) })).app;
    expect(pilotRow(none).note).toBeUndefined();
    const two = inHub(pilot({ wonAs: holding(10) })).app;
    expect(pilotRow(two).note).toBe(STRINGS.hub.points(2));
  });

  test('a contract won as a class is what earns one: the third as a bastion is its first stripe, and the fifth stripe held is a point', () => {
    // Four stripes held, none of them the bastions', and two contracts won as one.
    const record = { ...holding(4), bastion: 2 } as GameState['wonAs'];
    expect(stripesHeld({ wonAs: record })).toBe(4);
    const saved = wearing(pilot({ wonAs: record }), ARCHETYPE_BUILDS.bastion.late);
    expect(archetypeOf(saved.build, CATALOG)).toBe('bastion');
    expect(perkPoints(saved, PERKS)).toBe(0);
    const { app, store } = inHub(saved, 7);
    accept(app, 'patrol');
    finishMission(app);
    const kept = savedGame(store);
    expect(wonAs(kept, 'bastion')).toBe(3);
    expect(stripesHeld(kept)).toBe(5);
    expect(stripePoints(kept)).toBe(1);
    // The point is beside whatever the contract's experience brought in levels.
    expect(perkPoints(kept, PERKS)).toBe(levelFor(kept.xp) - 1 + 1);
  });

  test('a contract lost earns nothing, and neither does one flown in another class', () => {
    const record = { ...holding(4), bastion: 2 } as GameState['wonAs'];
    // Flown and won as something else: the bastions' count stands.
    const other = wearing(pilot({ wonAs: record }), ARCHETYPE_BUILDS.skirmisher.late);
    const { app, store } = inHub(other, 7);
    accept(app, 'patrol');
    finishMission(app);
    expect(wonAs(savedGame(store), 'bastion')).toBe(2);
    expect(stripePoints(savedGame(store))).toBe(0);
    // Flown as a bastion and walked away from: nothing was won.
    const left = inHub(wearing(pilot({ wonAs: record }), ARCHETYPE_BUILDS.bastion.late), 7);
    accept(left.app, 'patrol');
    retreat(left.app);
    expect(wonAs(savedGame(left.store), 'bastion')).toBe(2);
    expect(stripesHeld(savedGame(left.store))).toBe(4);
  });
});

/** What the pilot's pages show of stripes: the marks on each class's row, the count, the next of each, and the points on the perks page. */

const T = STRINGS.stripes;
const LANGUAGES: Language[] = ['en', 'nl'];
/** A record of every kind: nothing, a first stripe, a second, all three, and counts just short of the next. */
const RECORD = { duellist: 2, marksman: 3, artillery: 9, lancer: 15, bastion: 7, skirmisher: 0, allrounder: 22 } as GameState['wonAs'];
/** A game with nothing waiting to be read or said. */
const quiet = (extra: Partial<GameState> = {}): GameState => pilot({ codex: WORLD.map((entry) => entry.id), ...extra });
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
/** From the hub to a page of the pilot's screen, in the language given: set as the options set it, once the game is up. */
function onPage(name: string, saved: GameState, language: Language = 'en'): App {
  const { app } = inHub(saved);
  setLanguage(language);
  select(app, 'pilot');
  for (let i = 0; i < 6 && snap(app).page !== name; i++) press(app, 'next');
  expect(snap(app).page).toBe(name);
  return app;
}
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
/** The bars of the stripes drawn with their left edge here: each two wide, as tall as a stripe, three pixels apart. */
const bars = (shown: Drawn, x: number, y: number): Filled[] =>
  shown.rects.filter((r) => r.y === y && r.w === 2 && r.h === STRIPES_H && r.x >= x && r.x < x + STRIPES_W).sort((a, b) => a.x - b.x);
/** Whatever else is written beside a text: on its row or near enough to touch it, and not clear of it sideways. */
const touching = (shown: Drawn, text: Written): Written[] =>
  shown.texts.filter((other) => other !== text && other.text !== '' && Math.abs(other.y - text.y) < 9 && other.left < text.right && text.left < other.right);

describe('stripes on the classes page', () => {
  test('each class has its three marks on its row: as many lit as it has given, the rest dark', () => {
    const shown = drawn(onPage('classes', quiet({ wonAs: RECORD })));
    expect(ARCHETYPES.map((kind) => stripesOf({ wonAs: RECORD }, kind))).toEqual([0, 1, 2, 3, 1, 0, 3]);
    ARCHETYPES.forEach((kind, i) => {
      const row = bars(shown, STRIPES_X, 34 + i * LINE + 2);
      expect(row.map((bar) => bar.x), kind).toEqual([STRIPES_X, STRIPES_X + 3, STRIPES_X + 6]);
      const held = stripesOf({ wonAs: RECORD }, kind);
      expect(row.map((bar) => bar.color), kind).toEqual([0, 1, 2].map((n) => (n < held ? STRIPE_COLOR : COLORS.empty)));
    });
    // Three a class and no more, and the last of them ends where the marks are said to end.
    expect(MAX_STRIPES).toBe(3);
    expect(STRIPES_X + 6 + 2).toBe(STRIPES_X + STRIPES_W);
  });

  test.each(LANGUAGES)('the marks stand clear of the rule before them, the crown beside them and a count of three figures after them (%s)', (language) => {
    const record = Object.fromEntries(ARCHETYPES.map((kind) => [kind, 999])) as GameState['wonAs'];
    const app = onPage('classes', quiet({ wonAs: record, crowns: [...ARCHETYPES] }), language);
    const shown = drawn(app);
    ARCHETYPES.forEach((kind, i) => {
      const y = 34 + i * LINE;
      const row = bars(shown, STRIPES_X, y + 2);
      expect(row, kind).toHaveLength(3);
      // The rule, the crown, the marks, the count: in that order and none into the next.
      const rule = written(shown, STRINGS.classes.rules[kind]);
      const crown = shown.rects.filter((r) => r.color === CROWN_COLOR && r.y >= y && r.y < y + LINE && r.h <= STRIPES_H);
      expect(crown.length, kind).toBeGreaterThan(0);
      const count = shown.texts.filter((t) => t.text === '999' && t.y === y);
      expect(count, kind).toHaveLength(1);
      expect(rule.right, kind).toBeLessThanOrEqual(Math.min(...crown.map((r) => r.x)));
      // As tall as the crown and on its line.
      expect([row[0].y, row[0].y + row[0].h], kind).toEqual([Math.min(...crown.map((r) => r.y)), Math.max(...crown.map((r) => r.y + r.h))]);
      expect(Math.max(...crown.map((r) => r.x + r.w)), kind).toBeLessThan(STRIPES_X);
      expect(count[0].left, kind).toBeGreaterThanOrEqual(STRIPES_X + STRIPES_W);
      expect(count[0].right, kind).toBeLessThanOrEqual(LOGICAL_W - 12);
    });
  });

  test('a stripe that is held is told from one still to earn, from the crown beside it and from plain words', () => {
    for (const other of [COLORS.empty, CROWN_COLOR, COLORS.dim, COLORS.text, COLORS.accent, COLORS.armor]) expect(STRIPE_COLOR).not.toBe(other);
    expect(STRIPES_H).toBe(7);
  });

  test.each(LANGUAGES)('beside the hint: how many stripes are held of those there are, and how many the next point asks for (%s)', (language) => {
    const cases: [GameState['wonAs'], number, number | null][] = [
      [{} as GameState['wonAs'], 0, 5], [holding(4), 4, 5], [holding(5), 5, 10], [RECORD, 10, 15], [holding(19), 19, 20], [holding(20), 20, null], [holding(21), 21, null],
    ];
    for (const [wonAsNow, held, next] of cases) {
      const shown = drawn(onPage('classes', quiet({ wonAs: wonAsNow }), language));
      expect([stripesHeld({ wonAs: wonAsNow }), nextPointAt({ wonAs: wonAsNow })]).toEqual([held, next]);
      const count = written(shown, T.held(held, ALL_STRIPES));
      expect(count).toMatchObject({ x: 12, y: 256, size: 10, color: held > 0 ? STRIPE_COLOR : COLORS.dim });
      const point = written(shown, next === null ? T.allPoints : T.nextPoint(next));
      expect(point).toMatchObject({ x: LOGICAL_W - 12, y: 256, size: 10, align: 'right', color: COLORS.dim });
      // Either side of the hint, with air between: and nothing else on the row.
      const hint = written(shown, STRINGS.pilot.pageHint);
      expect(count.left).toBeGreaterThanOrEqual(12);
      expect(count.right, `${language} ${held}`).toBeLessThan(hint.left - 8);
      expect(point.left, `${language} ${held}`).toBeGreaterThan(hint.right + 8);
      expect(point.right).toBeLessThanOrEqual(LOGICAL_W - 12);
      expect(touching(shown, count)).toEqual([]);
      expect(touching(shown, point)).toEqual([]);
      setLanguage('en');
    }
  });

  test.each(LANGUAGES)('in the corner of the class under the cursor: the contracts won at which it gives its next stripe, or that it has given all three (%s)', (language) => {
    const app = onPage('classes', quiet({ wonAs: RECORD }), language);
    const expected: (number | null)[] = [3, 8, 15, null, 8, 3, null];
    ARCHETYPES.forEach((kind, i) => {
      expect((snap(app).classes as { kind: Archetype }).kind).toBe(kind);
      const shown = drawn(app);
      const next = expected[i];
      const text = written(shown, next === null ? T.allThree : T.nextStripe(next));
      expect(text, kind).toMatchObject({ x: LOGICAL_W - 12, y: CLASS_STRIPE_Y, size: 10, align: 'right', color: next === null ? STRIPE_COLOR : COLORS.dim });
      // Inside its panel, which ends at 252, and into nothing of the build beside it.
      expect(text.y + 10).toBeLessThanOrEqual(252);
      expect(text.left).toBeGreaterThan(12 + 150);
      expect(touching(shown, text), kind).toEqual([]);
      press(app, 'down');
    });
  });

  test('in Dutch the page says the same counts in its own words', () => {
    const app = onPage('classes', quiet({ wonAs: RECORD }), 'nl');
    const shown = drawn(app);
    expect(written(shown, 'STREPEN 10/21').y).toBe(256);
    expect(written(shown, 'PUNT BIJ 15').y).toBe(256);
    // The duellist under the cursor has won two of the three a first stripe asks.
    expect(written(shown, 'STREEP BIJ 3 WINST').y).toBe(CLASS_STRIPE_Y);
    for (let i = 0; i < 3; i++) press(app, 'down');
    expect(written(drawn(app), 'ALLE DRIE STREPEN').color).toBe(STRIPE_COLOR);
    setLanguage('en');
    const all = drawn(onPage('classes', quiet({ wonAs: holding(21) }), 'nl'));
    expect(written(all, 'STREPEN 21/21').color).toBe(STRIPE_COLOR);
    expect(written(all, 'ELK PUNT BINNEN').y).toBe(256);
  });

  test('the longest name a booster has, on the row the corner shares, ends well before the longest thing the corner says', () => {
    // The corner's row is the last of the build's left column: the booster's. Its name starts at 46.
    const longest = Math.max(...Object.values(CATALOG).filter((part) => part.kind === 'booster').map((part) => part.name.length));
    for (const language of LANGUAGES) {
      setLanguage(language);
      const widest = Math.max(T.allThree.length, ...STRIPES_AT.map((at) => T.nextStripe(at).length));
      expect(46 + longest * 4.8, language).toBeLessThan(LOGICAL_W - 12 - widest * 4 - 8);
    }
  });

  test('no other page of the pilot\'s has the count, and the perks page has the hint of its own', () => {
    for (const name of ['perks', 'medals', 'record', 'drive']) {
      const shown = drawn(onPage(name, quiet({ wonAs: RECORD })));
      expect(shown.texts.filter((t) => t.text === T.held(10, ALL_STRIPES)), name).toEqual([]);
      expect(shown.texts.filter((t) => t.text === T.nextPoint(15)), name).toEqual([]);
      expect(bars(shown, STRIPES_X, 34 + 2), name).toEqual([]);
    }
  });
});

describe('stripes on the perks page', () => {
  test('a line says how many are held, what they have brought and when the next comes: lit once they have brought a point', () => {
    const cases: [GameState['wonAs'], string, string][] = [
      [{} as GameState['wonAs'], 'Stripes 0/21: 0 points so far, the next at 5.', COLORS.dim],
      [holding(4), 'Stripes 4/21: 0 points so far, the next at 5.', COLORS.dim],
      [holding(5), 'Stripes 5/21: 1 point so far, the next at 10.', STRIPE_COLOR],
      [RECORD, 'Stripes 10/21: 2 points so far, the next at 15.', STRIPE_COLOR],
      [holding(20), 'Stripes 20/21: 4 points so far.', STRIPE_COLOR],
      [holding(21), 'Stripes 21/21: 4 points so far.', STRIPE_COLOR],
    ];
    for (const [wonAsNow, words, color] of cases) {
      const shown = drawn(onPage('perks', quiet({ wonAs: wonAsNow })));
      expect(written(shown, words)).toMatchObject({ x: 12, y: PERKS_STRIPES_Y, color });
    }
  });

  test('in Dutch it counts one point as one and several as several', () => {
    const cases: [GameState['wonAs'], string][] = [
      [holding(4), 'Strepen 4/21: 0 punten tot nu, volgend bij 5.'],
      [holding(5), 'Strepen 5/21: 1 punt tot nu, volgend bij 10.'],
      [holding(10), 'Strepen 10/21: 2 punten tot nu, volgend bij 15.'],
      [holding(21), 'Strepen 21/21: 4 punten tot nu.'],
    ];
    for (const [wonAsNow, words] of cases) {
      const shown = drawn(onPage('perks', quiet({ wonAs: wonAsNow }), 'nl'));
      expect(written(shown, words).y).toBe(PERKS_STRIPES_Y);
      setLanguage('en');
    }
  });

  test.each(LANGUAGES)('it has its row to itself whatever perk is under the cursor and whatever stands in the way of buying it (%s)', (language) => {
    const full = Object.fromEntries(PERKS.map((perk) => [perk.id, perk.maxRank]));
    const games: [string, GameState][] = [
      ['points to spend', quiet({ wonAs: holding(19), xp: xpForLevel(6) })],
      ['none to spend', quiet({ wonAs: holding(4) })],
      ['every rank had', quiet({ wonAs: holding(21), xp: xpForLevel(20), perks: full })],
    ];
    for (const [what, game] of games) {
      const app = onPage('perks', game, language);
      const line = T.points(stripesHeld(game), ALL_STRIPES, stripePoints(game), nextPointAt(game));
      PERKS.forEach((perk) => {
        expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe(perk.id);
        const shown = drawn(app);
        const text = written(shown, line);
        expect(text.y).toBe(PERKS_STRIPES_Y);
        // Under what the perk does and over what stands in the way: inside the panel, and nothing into it.
        expect(text.right, `${language} ${what} ${perk.id}`).toBeLessThanOrEqual(LOGICAL_W - 12);
        expect(shown.texts.filter((t) => t !== text && t.text !== '' && t.y === PERKS_STRIPES_Y), `${language} ${what} ${perk.id}`).toEqual([]);
        expect(touching(shown, text), `${language} ${what} ${perk.id}`).toEqual([]);
        press(app, 'down');
      });
      setLanguage('en');
    }
  });

  test('what stands in the way is said under it, as before', () => {
    const none = drawn(onPage('perks', quiet({ wonAs: holding(4) })));
    expect(written(none, STRINGS.pilot.noPoints).y).toBeGreaterThan(PERKS_STRIPES_Y + 9);
    const full = Object.fromEntries(PERKS.map((perk) => [perk.id, perk.maxRank]));
    const all = drawn(onPage('perks', quiet({ wonAs: holding(21), xp: xpForLevel(20), perks: full })));
    expect(written(all, STRINGS.pilot.maxed).y).toBeGreaterThan(PERKS_STRIPES_Y + 9);
  });
});

/** Everything waiting to be said, and what is being said. */
const said = (app: App): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => id !== null);
/** Lets the notices before it have their time until this one is up. */
function until(app: App, id: string): void {
  for (let i = 0; i < 60 && snap(app).toast !== id; i++) app.update(snap(app).toast === null ? 16 : TOAST_MS + 1);
  expect(snap(app).toast).toBe(id);
}
/** Flies the first contract of the board in this build and wins it. */
function win(saved: GameState, deps: Parameters<typeof inHub>[2] = {}): ReturnType<typeof inHub> {
  const made = inHub(saved, 7, deps);
  accept(made.app, 'patrol');
  finishMission(made.app);
  return made;
}
/** Where the notice stands in a hurried game: a strip 176 wide and 28 tall, two pixels off the foot of the screen. */
const TOAST = { x: Math.round((LOGICAL_W - 176) / 2), y: LOGICAL_H - 30, w: 176 };

describe('a stripe is announced as it is earned', () => {
  test('the class and the stripe\'s number, with its marks: and that it brought a point, when it was the fifth held', () => {
    const record = { ...holding(4), bastion: 2 } as GameState['wonAs'];
    const played: string[] = [];
    const { app } = win(wearing(quiet({ wonAs: record }), ARCHETYPE_BUILDS.bastion.late), { sfx: { play: (name: string) => { played.push(name); } } as never });
    expect(said(app).filter((id) => id.startsWith('stripe:'))).toEqual(['stripe:bastion:1']);
    until(app, 'stripe:bastion:1');
    // It comes up with the sound a medal comes up with.
    expect(played.at(-1)).toBe('medal');
    const shown = drawn(app);
    expect(written(shown, T.earned)).toMatchObject({ x: TOAST.x + 20, y: TOAST.y + 2, size: 10, color: COLORS.dim });
    const title = written(shown, 'Bastion I');
    expect(title).toMatchObject({ x: TOAST.x + 20, y: TOAST.y + 12, color: COLORS.accent });
    const note = written(shown, T.point);
    expect(T.point).toBe('+1 POINT');
    expect(note).toMatchObject({ x: TOAST.x + TOAST.w - 6, y: TOAST.y + 12, align: 'right', color: COLORS.armor });
    // Its marks where a medal's picture would be: one lit of three.
    const marks = bars(shown, TOAST.x + 7, TOAST.y + 10);
    expect(marks.map((bar) => bar.x)).toEqual([TOAST.x + 7, TOAST.x + 10, TOAST.x + 13]);
    expect(marks.map((bar) => bar.color)).toEqual([STRIPE_COLOR, COLORS.empty, COLORS.empty]);
    expect(Math.max(...marks.map((bar) => bar.x + bar.w))).toBeLessThan(title.left);
    // Said once: when its time is up it is gone, and not said again.
    app.update(TOAST_MS + 1);
    expect(said(app).filter((id) => id.startsWith('stripe:'))).toEqual([]);
  });

  test('a stripe that is no fifth says nothing of a point; a second stripe has two marks lit', () => {
    const first = win(wearing(quiet({ wonAs: { bastion: 2 } as GameState['wonAs'] }), ARCHETYPE_BUILDS.bastion.late)).app;
    until(first, 'stripe:bastion:1');
    const one = drawn(first);
    expect(written(one, 'Bastion I').y).toBe(TOAST.y + 12);
    expect(one.texts.filter((t) => t.text === T.point)).toEqual([]);
    const second = win(wearing(quiet({ wonAs: { bastion: 7 } as GameState['wonAs'] }), ARCHETYPE_BUILDS.bastion.late)).app;
    expect(said(second).filter((id) => id.startsWith('stripe:'))).toEqual(['stripe:bastion:2']);
    until(second, 'stripe:bastion:2');
    const two = drawn(second);
    expect(written(two, 'Bastion II').y).toBe(TOAST.y + 12);
    expect(two.texts.filter((t) => t.text === T.point)).toEqual([]);
    expect(bars(two, TOAST.x + 7, TOAST.y + 10).map((bar) => bar.color)).toEqual([STRIPE_COLOR, STRIPE_COLOR, COLORS.empty]);
  });

  test('a win that crosses no line announces none, and neither does a game that is opened with stripes it has', () => {
    const { app, store } = win(wearing(quiet({ wonAs: { bastion: 3 } as GameState['wonAs'] }), ARCHETYPE_BUILDS.bastion.late));
    expect(savedGame(store).wonAs).toMatchObject({ bastion: 4 });
    expect(said(app).filter((id) => id.startsWith('stripe:'))).toEqual([]);
    for (const stripes of [1, 5, 10, 21]) {
      const opened = inHub(quiet({ wonAs: holding(stripes) })).app;
      expect(said(opened).filter((id) => id.startsWith('stripe:')), `${stripes}`).toEqual([]);
      // Nor when something else is kept: a perk bought with the point they brought.
      select(opened, 'pilot');
      press(opened, 'confirm', 'cancel');
      expect(said(opened).filter((id) => id.startsWith('stripe:')), `${stripes}`).toEqual([]);
    }
  });

  test.each(LANGUAGES)('the longest of them fits its strip: the third stripe of the class with the longest name, and a point with it (%s)', (language) => {
    // Two stripes as a sharpshooter and two as a duellist; the fifteenth contract won as a sharpshooter is a third stripe and the fifth held.
    const saved = wearing(quiet({ wonAs: { marksman: 14, duellist: 8 } as GameState['wonAs'] }), ARCHETYPE_BUILDS.marksman.late);
    expect(archetypeOf(saved.build, CATALOG)).toBe('marksman');
    const made = inHub(saved, 7);
    setLanguage(language);
    accept(made.app, 'patrol');
    finishMission(made.app);
    until(made.app, 'stripe:marksman:3');
    const names = STRINGS.classes.names;
    expect(Math.max(...ARCHETYPES.map((kind) => names[kind].length))).toBe(names.marksman.length);
    const shown = drawn(made.app);
    const title = written(shown, `${names.marksman} III`);
    const note = written(shown, T.point);
    expect(title.right, language).toBeLessThan(note.left - 8);
    expect(note.right).toBeLessThanOrEqual(TOAST.x + TOAST.w - 6);
    expect(written(shown, T.earned).right).toBeLessThan(TOAST.x + TOAST.w - 6);
    expect(bars(shown, TOAST.x + 7, TOAST.y + 10).map((bar) => bar.color)).toEqual([STRIPE_COLOR, STRIPE_COLOR, STRIPE_COLOR]);
  });
});

describe('the medals for stripes', () => {
  const medal = (id: string) => MEDALS.find((m) => m.id === id)!;

  test('one for a first stripe and one for all twenty-one: each counts the stripes held', () => {
    expect(medal('stripe-1')).toMatchObject({ tier: 1 });
    expect(medal('stripe-all')).toMatchObject({ tier: 3 });
    for (const n of [0, 1, 5, 20, 21]) {
      const game = quiet({ wonAs: holding(n) });
      expect(medal('stripe-1').progress(game)).toEqual({ have: n, need: 1 });
      expect(medal('stripe-all').progress(game)).toEqual({ have: n, need: ALL_STRIPES });
    }
  });

  test('the first stripe brings its medal and what a medal of its tier pays: announced after the stripe itself', () => {
    const before = wearing(quiet({ wonAs: { bastion: 2 } as GameState['wonAs'] }), ARCHETYPE_BUILDS.bastion.late);
    const opened = inHub(before, 7);
    const had = savedGame(opened.store).medals;
    expect(had).not.toContain('stripe-1');
    accept(opened.app, 'patrol');
    finishMission(opened.app);
    const kept = savedGame(opened.store);
    expect(kept.medals).toContain('stripe-1');
    expect(kept.medals).not.toContain('stripe-all');
    const heard = said(opened.app);
    expect(heard).toContain('stripe-1');
    expect(heard.indexOf('stripe:bastion:1')).toBeLessThan(heard.indexOf('stripe-1'));
    expect(MEDAL_PAY[medal('stripe-1').tier]).toBeGreaterThan(0);
  });

  test('a game from before the round is handed the medal its record has earned when it is opened, and the last one only for every stripe', () => {
    const some = inHub(quiet({ wonAs: holding(20) }));
    expect(savedGame(some.store).medals).toContain('stripe-1');
    expect(savedGame(some.store).medals).not.toContain('stripe-all');
    const all = inHub(quiet({ wonAs: holding(21) }));
    expect(savedGame(all.store).medals).toEqual(expect.arrayContaining(['stripe-1', 'stripe-all']));
    const none = inHub(quiet());
    expect(savedGame(none.store).medals).not.toContain('stripe-1');
  });
});

/** Where a build is chosen for a contract: the page of the build on the briefing says how near its class is to its next stripe. */

interface Near { kind: Archetype; held: number; won: number; next: number | null }
const near = (app: App): Near | null => (snap(app).briefing as unknown as { stripe: Near | null }).stripe;
const onRow = (app: App): string => snap(app).menu.items[snap(app).menu.cursor].id;
/** From the hub to a contract's briefing, with the cursor on the row of the build it will be flown in. */
function onBuild(saved: GameState, language: Language = 'en', contract = 'patrol'): App {
  const { app } = inHub(saved, 7);
  setLanguage(language);
  select(app, 'contracts');
  select(app, contract);
  expect(snap(app).screen).toBe('briefing');
  for (let i = 0; i < 6 && onRow(app) !== 'build'; i++) press(app, 'down');
  expect(onRow(app)).toBe('build');
  return app;
}
/** A pilot in the bastion's build, with this much won as each class. */
const bastion = (record: Partial<{ [kind in Archetype]: number }>, extra: Partial<GameState> = {}): GameState =>
  wearing(quiet({ wonAs: record as GameState['wonAs'], ...extra }), ARCHETYPE_BUILDS.bastion.late);
/** The row the page of the build begins on, where its heading stands. */
const BUILD_ROW = 78;
/** The heading of the build's page: which build it is. (The corner of the briefing says so as well, in small.) */
const headingOf = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text && t.y === BUILD_ROW);
  expect(found, text).toHaveLength(1);
  return found[0];
};

describe('the briefing says how near the next stripe is', () => {
  test('on the page of the build: its class\'s marks, and the contracts won as it of those the next stripe asks', () => {
    const app = onBuild(bastion({ bastion: 5 }));
    expect(near(app)).toEqual({ kind: 'bastion', held: 1, won: 5, next: 8 });
    const shown = drawn(app);
    const words = written(shown, 'NEXT STRIPE 5/8');
    expect(T.towards(5, 8)).toBe('NEXT STRIPE 5/8');
    expect(words).toMatchObject({ x: LOGICAL_W - 12, y: BUILD_ROW + 1, size: 10, align: 'right', color: COLORS.dim });
    // The marks before the words, on their line: one lit of three.
    const marks = bars(shown, words.left - 4 - STRIPES_W, BUILD_ROW + 2);
    expect(marks.map((bar) => bar.color)).toEqual([STRIPE_COLOR, COLORS.empty, COLORS.empty]);
    expect(marks[2].x + marks[2].w).toBe(words.left - 4);
    // Clear of the heading the row begins with.
    const heading = headingOf(shown, STRINGS.briefing.buildOnFloor);
    expect(heading.color).toBe(COLORS.accent);
    expect(heading.right).toBeLessThan(marks[0].x - 8);
    expect(touching(shown, words)).toEqual([]);
  });

  test('one win short of it, the page says so, lit; with all three, that there are no more', () => {
    const short = onBuild(bastion({ bastion: 7 }));
    expect(near(short)).toEqual({ kind: 'bastion', held: 1, won: 7, next: 8 });
    const one = drawn(short);
    const lit = written(one, T.thisWin);
    expect(T.thisWin).toBe('WIN THIS FOR A STRIPE');
    expect(lit).toMatchObject({ x: LOGICAL_W - 12, y: BUILD_ROW + 1, size: 10, color: STRIPE_COLOR });
    expect(bars(one, lit.left - 4 - STRIPES_W, BUILD_ROW + 2).map((bar) => bar.color)).toEqual([STRIPE_COLOR, COLORS.empty, COLORS.empty]);
    // Two won of three is one short as well; one won of three is not.
    expect(written(drawn(onBuild(bastion({ bastion: 2 }))), T.thisWin).color).toBe(STRIPE_COLOR);
    const far = drawn(onBuild(bastion({ bastion: 1 })));
    expect(written(far, T.towards(1, 3)).color).toBe(COLORS.dim);
    expect(far.texts.filter((t) => t.text === T.thisWin)).toEqual([]);
    const all = onBuild(bastion({ bastion: 15 }));
    expect(near(all)).toEqual({ kind: 'bastion', held: 3, won: 15, next: null });
    const full = drawn(all);
    const done3 = written(full, T.allThree);
    expect(done3).toMatchObject({ y: BUILD_ROW + 1, color: STRIPE_COLOR });
    expect(bars(full, done3.left - 4 - STRIPES_W, BUILD_ROW + 2).map((bar) => bar.color)).toEqual([STRIPE_COLOR, STRIPE_COLOR, STRIPE_COLOR]);
  });

  test('what it promises is kept: the contract won, the stripe is announced', () => {
    const app = onBuild(bastion({ bastion: 2 }));
    expect(written(drawn(app), T.thisWin).color).toBe(STRIPE_COLOR);
    select(app, 'accept');
    finishMission(app);
    expect(said(app)).toContain('stripe:bastion:1');
  });

  test('it follows the build that is turned to, and is not on the client\'s page', () => {
    const light = ARCHETYPE_BUILDS.skirmisher.late;
    const owner = wearing(wearing(quiet({ wonAs: { bastion: 5, skirmisher: 9 } as GameState['wonAs'] }), light), ARCHETYPE_BUILDS.bastion.late);
    const app = onBuild({ ...owner, loadouts: owner.loadouts.map((_, i) => (i === 0 ? light : null)) });
    expect(near(app)).toEqual({ kind: 'bastion', held: 1, won: 5, next: 8 });
    press(app, 'right');
    expect(near(app)).toEqual({ kind: 'skirmisher', held: 2, won: 9, next: 15 });
    const turned = drawn(app);
    const words = written(turned, T.towards(9, 15));
    expect(bars(turned, words.left - 4 - STRIPES_W, BUILD_ROW + 2).map((bar) => bar.color)).toEqual([STRIPE_COLOR, STRIPE_COLOR, COLORS.empty]);
    expect(headingOf(turned, STRINGS.briefing.buildSaved(1)).right).toBeLessThan(words.left - 4 - STRIPES_W - 8);
    // Off the build's row the client has the page: the count is still told to whoever asks the screen, and nothing of it is drawn.
    for (let i = 0; i < 6 && onRow(app) !== 'accept'; i++) press(app, 'up');
    expect(onRow(app)).toBe('accept');
    const client = drawn(app);
    expect(client.texts.filter((t) => t.text === T.towards(9, 15))).toEqual([]);
    expect(client.rects.filter((r) => r.w === 2 && r.h === STRIPES_H && r.y === BUILD_ROW + 2)).toEqual([]);
  });

  test('a fight on the range counts for no class, and its briefing promises nothing', () => {
    const saved = bastion({ bastion: 2 }, { met: ['heavy-mech'] });
    const { app } = inHub(saved, 7);
    app.openBriefing('range-1-heavy-mech');
    expect(snap(app).briefing).toMatchObject({ mission: 'range-1-heavy-mech', lent: false });
    for (let i = 0; i < 6 && onRow(app) !== 'build'; i++) press(app, 'down');
    expect(onRow(app)).toBe('build');
    expect(near(app)).toBeNull();
    const shown = drawn(app);
    expect(shown.texts.filter((t) => [T.thisWin, T.towards(2, 3), T.allThree].includes(t.text))).toEqual([]);
    expect(shown.rects.filter((r) => r.w === 2 && r.h === STRIPES_H && r.y === BUILD_ROW + 2)).toEqual([]);
    // And the same contract's page on the board does promise it.
    expect(near(onBuild(saved))).toEqual({ kind: 'bastion', held: 0, won: 2, next: 3 });
  });

  test('in Dutch it says the same in its own words', () => {
    expect(written(drawn(onBuild(bastion({ bastion: 5 }), 'nl')), 'NAAR STREEP 5/8').color).toBe(COLORS.dim);
    setLanguage('en');
    expect(written(drawn(onBuild(bastion({ bastion: 7 }), 'nl')), 'WIN DIT VOOR EEN STREEP').color).toBe(STRIPE_COLOR);
  });

  test.each(LANGUAGES)('the longest it says fits beside the longest heading of the row (%s)', (language) => {
    const app = onBuild(bastion({ bastion: 7 }), language);
    const shown = drawn(app);
    const words = written(shown, T.thisWin);
    expect(words.right).toBeLessThanOrEqual(LOGICAL_W - 12);
    expect(touching(shown, words)).toEqual([]);
    // Whatever build is turned to and whatever is said of it: the widest heading ends well before the marks of the widest words.
    const widest = Math.max(T.thisWin.length, T.allThree.length, T.towards(14, 15).length);
    const heading = Math.max(STRINGS.briefing.buildOnFloor.length, STRINGS.briefing.buildSaved(7).length);
    expect(12 + heading * 4.8, language).toBeLessThan(LOGICAL_W - 12 - widest * 4 - 4 - STRIPES_W - 8);
  });
});
