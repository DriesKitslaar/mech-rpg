import { setLanguage, type Language } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STARTERS } from '../../src/content/starters';
import { STRINGS } from '../../src/content/strings';
import { newGame } from '../../src/core/game';
import { SAVE_KEY, slotKey } from '../../src/platform/storage';
import { LOGICAL_H, LOGICAL_W } from '../../src/ui/display';
import type { SpriteStore } from '../../src/ui/sprites';
import { LINE } from '../../src/ui/widgets';
import { ids, makeApp, press, savedGame, select, skipScenes, snap, type Store } from '../helpers/app';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The lot: the three frames a new pilot chooses between, after the callsign and before the story.
 * What is offered, what taking one starts the game with, the way back, and that all of it can be read.
 */

afterEach(() => setLanguage('en'));
/** What each frame is, in English: the content holds the language that is set, and this file is read in English. */
const ENGLISH = STARTERS.map((starter) => ({ role: starter.role, text: starter.text, name: starter.name }));

type AppOf = ReturnType<typeof makeApp>['app'];
interface Lot { id: string; callsign: string; slot: number; credits: number; figures: [string, string][] }
const lot = (app: AppOf): Lot => snap(app).starter as Lot;
const T = STRINGS.starter;
const G = STRINGS.garage;

/** A store of pictures that says which picture each is, with the sizes and places the game's own have. */
const MANIFEST = SPRITES as unknown as Record<string, { w: number; h: number; ox?: number; oy?: number }>;
const named: SpriteStore = { get: (id, fallback) => ({ ...(MANIFEST[id] ?? fallback), image: { id } as unknown as CanvasImageSource }) };
const drawnIds = (page: Drawn): string[] => page.images.map((image) => (image.image as { id?: string }).id ?? '');

/**
 * A new pilot on the lot: past the title and the callsign, which is PILOT with two letters erased. The language is
 * set once the game is up and before the lot is come to, as the options do it: a screen lays its list out as it is built.
 */
function onLot(deps: Parameters<typeof makeApp>[2] = {}, language: Language = 'en') {
  const made = makeApp(undefined, 5, deps);
  setLanguage(language);
  press(made.app, 'confirm');
  expect(snap(made.app).screen).toBe('callsign');
  press(made.app, 'cancel', 'cancel', 'confirm');
  expect(snap(made.app).screen).toBe('starter');
  return made;
}
const kept = (store: Store): string[] => Object.keys(store.data).filter((key) => key.startsWith(SAVE_KEY));
/** The figure written beside a label on a page: what stands right of it on its row. */
function beside(page: Drawn, label: string): string {
  const at = page.texts.find((t) => t.text === label)!;
  expect(at, label).toBeDefined();
  const right = page.texts.filter((t) => t.y === at.y && t.left >= at.right).sort((a, b) => a.left - b.left);
  return right[0]?.text ?? '';
}

describe('the lot', () => {
  test('comes after the callsign: the three frames by name and by what each is, the one every pilot used to start in under the cursor', () => {
    const { app, store } = onLot();
    expect(ids(app)).toEqual(['hauler', 'courier', 'dozer']);
    expect(snap(app).menu.items.map((item) => [item.label, item.note, item.enabled])).toEqual(STARTERS.map((s) => [s.name, s.role, true]));
    expect(snap(app).menu.cursor).toBe(0);
    expect(lot(app)).toMatchObject({ id: 'hauler', callsign: 'PIL', slot: 0, credits: 1200 });
    // There is no game yet: nothing is kept, and there are no credits to show.
    expect(snap(app).credits).toBeNull();
    expect(kept(store)).toEqual([]);
  });

  test('the cursor goes through the three and round again, either way', () => {
    const { app } = onLot();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { seen.push(lot(app).id); press(app, 'down'); }
    expect(seen).toEqual(['hauler', 'courier', 'dozer', 'hauler']);
    press(app, 'up', 'up');
    expect(lot(app).id).toBe('dozer');
    // Left, right and the shoulder buttons do nothing here.
    press(app, 'left', 'right', 'prev', 'next', 'menu');
    expect(snap(app)).toMatchObject({ screen: 'starter' });
    expect(lot(app).id).toBe('dozer');
  });

  test.each(STARTERS.map((s, i) => [s.id, s, i] as const))('taking the %s starts the game in it: its build, each of its parts once, its credits, and the story begins', (_id, starter, down) => {
    const { app, store } = onLot();
    for (let i = 0; i < down; i++) press(app, 'down');
    expect(lot(app)).toMatchObject({ id: starter.id, credits: starter.credits });
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'scene', scene: 'act-1', credits: starter.credits, callsign: 'PIL' });
    const game = savedGame(store);
    expect(game.build).toEqual(starter.build);
    expect(game.inventory).toEqual(Object.fromEntries(Object.values(starter.build).map((part) => [part, 1])));
    expect(game.credits).toBe(starter.credits);
    expect(game.callsign).toBe('PIL');
    // In every other way it is the game a new pilot always got (what it has heard by now is the title's music, and
    // the one letter that has come is the one every new pilot gets).
    const { build: _build, inventory: _inventory, credits: _credits, settings: _settings, heard: _heard, mail, ...rest } = game;
    const { build: _b, inventory: _i, credits: _c, settings: _s, ...usual } = newGame(CATALOG, STARTER_BUILD, 'PIL');
    expect(rest).toEqual(usual);
    expect(mail).toEqual(['welcome']);
    skipScenes(app);
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: starter.credits });
    expect(snap(app).build).toEqual(starter.build);
  });

  test('a pilot who presses A through everything gets the frame and the credits every pilot used to get', () => {
    const { app, store } = makeApp();
    press(app, 'confirm', 'confirm', 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'scene', credits: 1200, callsign: 'PILOT' });
    const { heard: _heard, mail, ...game } = savedGame(store);
    expect(game).toEqual({ ...newGame(CATALOG, STARTER_BUILD), settings: game.settings });
    expect(mail).toEqual(['welcome']);
  });

  test('B goes back to the name as it was typed, with the cursor on OK; nothing has been kept, and the lot opens on the first frame again', () => {
    const { app, store } = onLot();
    press(app, 'down', 'down');
    expect(lot(app).id).toBe('dozer');
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'callsign', entry: { name: 'PIL', at: 'ok', slot: 0 } });
    expect(kept(store)).toEqual([]);
    // The name can still be changed there: a letter fewer, and on.
    press(app, 'cancel', 'confirm');
    expect(snap(app).screen).toBe('starter');
    expect(lot(app)).toMatchObject({ id: 'hauler', callsign: 'PI', slot: 0 });
    press(app, 'down', 'confirm');
    expect(savedGame(store)).toMatchObject({ callsign: 'PI', build: STARTERS[1].build });
  });

  test('a second pilot chooses for their own slot: the first pilot\'s game is as it was', () => {
    const first = { ...newGame(CATALOG, STARTER_BUILD, 'VANTA'), credits: 4321 };
    const { app, store } = makeApp(first);
    select(app, 'new');
    // The slots: the first is taken, the cursor is on the first free one.
    const free = snap(app).menu.items[snap(app).menu.cursor].id;
    press(app, 'confirm');
    expect(snap(app).screen).toBe('callsign');
    const slot = (snap(app).entry as { slot: number }).slot;
    expect(slot).toBeGreaterThan(0);
    press(app, 'confirm', 'down', 'down');
    expect(lot(app)).toMatchObject({ id: 'dozer', slot, callsign: 'PILOT' });
    press(app, 'confirm');
    expect(kept(store).sort()).toEqual([SAVE_KEY, slotKey(slot)].sort());
    expect(savedGame(store, slotKey(slot))).toMatchObject({ build: STARTERS[2].build, credits: 900, callsign: 'PILOT' });
    expect(savedGame(store)).toMatchObject({ callsign: 'VANTA', credits: 4321, build: STARTER_BUILD });
    expect(free).toBeDefined();
  });

  test('time spent looking at the frames is not time played', () => {
    const { app, store } = onLot();
    app.update(95_000);
    press(app, 'down');
    app.update(40_000);
    press(app, 'confirm');
    expect(savedGame(store).stats.seconds).toBe(0);
    // Once there is a game its time is counted as ever.
    app.update(3_000);
    skipScenes(app);
    expect(savedGame(store).stats.seconds).toBe(3);
  });
});

describe('what the lot says of a frame', () => {
  test('its armour, how it moves and what it weighs, by the names the garage has for them, and the credits that come with it', () => {
    const { app } = onLot();
    expect(lot(app).figures).toEqual([[G.armour, '540'], [G.mobility, '18'], [G.evasion, '48'], [G.weight, '800/1000'], [T.credits, '1200']]);
    press(app, 'down');
    expect(lot(app).figures.map(([label]) => label)).toEqual([G.armour, G.mobility, G.evasion, G.weight, T.credits]);
    expect(lot(app).figures[0][1]).toBe('375');
    expect(lot(app).figures[4][1]).toBe('900');
    press(app, 'down');
    expect(lot(app).figures[0][1]).toBe('680');
    expect(lot(app).figures[4][1]).toBe('900');
  });

  test.each(STARTERS.map((s, i) => [s.id, i] as const))('is what the garage says of the %s once it is the pilot\'s', (_id, down) => {
    const { app } = onLot();
    for (let i = 0; i < down; i++) press(app, 'down');
    const said = Object.fromEntries(lot(app).figures);
    press(app, 'confirm');
    skipScenes(app);
    select(app, 'garage');
    expect(snap(app).screen).toBe('garage');
    const garage = record((ctx) => app.draw(ctx));
    for (const label of [G.armour, G.mobility, G.evasion, G.weight]) expect(beside(garage, label), label).toBe(said[label]);
  });

  test('the three differ where they are meant to: the Courier thinnest and quickest, the Dozer thickest and slowest and able to carry the most', () => {
    const { app } = onLot();
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < 3; i++) { rows.push(Object.fromEntries(lot(app).figures)); press(app, 'down'); }
    const [hauler, courier, dozer] = rows;
    const n = (row: Record<string, string>, label: string): number => Number(row[label].split('/')[0]);
    const carries = (row: Record<string, string>): number => Number(row[G.weight].split('/')[1]);
    expect(n(courier, G.armour)).toBeLessThan(n(hauler, G.armour));
    expect(n(hauler, G.armour)).toBeLessThan(n(dozer, G.armour));
    expect(n(courier, G.evasion)).toBeGreaterThan(n(hauler, G.evasion));
    expect(n(hauler, G.evasion)).toBeGreaterThan(n(dozer, G.evasion));
    expect([carries(courier), carries(hauler), carries(dozer)]).toEqual([800, 1000, 1400]);
    // None starts with more on it than it can carry.
    for (const row of rows) expect(n(row, G.weight)).toBeLessThanOrEqual(carries(row));
  });
});

describe('the lot as it is drawn', () => {
  const page = (app: AppOf): Drawn => record((ctx) => app.draw(ctx));
  /** Every piece of a frame's kit there is a picture of, as the garage draws it. */
  const pictures = (starter: (typeof STARTERS)[number]): string[] => {
    const { build } = starter;
    return [build.head!, build.core!, build.legs!, `${build.arms}.near`, `${build.arms}.far`, build.rightHand!, ...(build.leftHand ? [build.leftHand] : [])];
  };

  test.each(STARTERS.map((s, i) => [s.id, s, i] as const))('shows the %s under the cursor, whole, with what it carries, and neither of the others', (_id, starter, down) => {
    const { app } = onLot({ sprites: named });
    for (let i = 0; i < down; i++) press(app, 'down');
    const shown = drawnIds(page(app));
    for (const id of pictures(starter)) expect(shown, id).toContain(id);
    for (const other of STARTERS.filter((s) => s !== starter)) {
      for (const slot of ['head', 'core', 'legs'] as const) expect(shown, other.build[slot]).not.toContain(other.build[slot]);
    }
    // Drawn from the front, as in the garage: no layer of the view from behind or of the small one.
    expect(shown.filter((id) => /\.(back|small)$/.test(id))).toEqual([]);
    // And the way round it was drawn, where a mech stands in the garage: what is painted on it reads as it was painted.
    const layers = page(app).images.filter((image) => /^(head|core|legs|arms)-/.test((image.image as { id?: string }).id ?? ''));
    expect(layers.length).toBe(5);
    for (const layer of layers) {
      expect(layer.w, String((layer.image as { id: string }).id)).toBeGreaterThan(0);
      expect(layer.x + layer.w, String((layer.image as { id: string }).id)).toBeLessThanOrEqual(LOGICAL_W - 154 + 12);
      expect(layer.y + layer.h, String((layer.image as { id: string }).id)).toBeLessThanOrEqual(182);
    }
  });

  test('where the game is hurried the frame stands still, so a picture of the lot is the same picture twice; otherwise it breathes as in the garage', () => {
    const layersOf = (app: AppOf): string => JSON.stringify(page(app).images.filter((image) => /^(head|core|legs|arms)-/.test((image.image as { id?: string }).id ?? '')).map((image) => [image.x, image.y]));
    const hurried = onLot({ sprites: named }).app;
    const first = layersOf(hurried);
    for (const ms of [130, 400, 700, 1100, 2300]) { hurried.update(ms); expect(layersOf(hurried), String(ms)).toBe(first); }
    const slow = onLot({ sprites: named, fast: false }).app;
    const seen = new Set<string>([layersOf(slow)]);
    for (let i = 0; i < 12; i++) { slow.update(130); seen.add(layersOf(slow)); }
    expect(seen.size).toBeGreaterThan(1);
    // Its feet stay where they are: it is the body that moves.
    const legs = (app: AppOf) => page(app).images.find((image) => /^legs-/.test((image.image as { id?: string }).id ?? ''))!;
    const stood = legs(slow);
    slow.update(390);
    expect([legs(slow).x, legs(slow).y]).toEqual([stood.x, stood.y]);
  });

  test.each(['en', 'nl'] as const)('in %s: the heading, the pilot\'s name, the three frames, the figures, and what the one under the cursor is, in three lines at most', (language) => {
    const { app } = onLot({}, language);
    const S = language === 'nl' ? STRINGS_NL.starter : T;
    for (const [i, starter] of STARTERS.entries()) {
      const drawn = page(app);
      const said = drawn.texts.map((t) => t.text);
      expect(said[0]).toBe(S.heading);
      expect(said[1]).toBe('PIL');
      // The names are names: the same in both languages. What each is, is in the language that is set.
      for (const [n, each] of STARTERS.entries()) {
        expect(each.name).toBe(ENGLISH[n].name);
        expect(said, each.name).toContain(each.name);
        expect(said, each.role).toContain(each.role);
        expect(each.role === ENGLISH[n].role, each.id).toBe(language === 'en');
        expect(each.text === ENGLISH[n].text, each.id).toBe(language === 'en');
      }
      expect(said).toContain(starter.name.toUpperCase());
      expect(said[said.length - 1]).toBe(S.hint);
      // The one under the cursor is said twice: on its row of the list, and over what it is.
      expect(said.filter((text) => text === starter.role), starter.id).toHaveLength(2);
      // What it is: between its role and the hint, three lines at most, which together are its text.
      const role = drawn.texts.filter((t) => t.text === starter.role).pop()!;
      const hint = drawn.texts[drawn.texts.length - 1];
      const lines = drawn.texts.filter((t) => t.y > role.y && t.y < hint.y);
      expect(lines.length, starter.id).toBeGreaterThanOrEqual(1);
      expect(lines.length, starter.id).toBeLessThanOrEqual(3);
      expect(lines.map((t) => t.text).join(' ')).toBe(starter.text);
      expect(lines[lines.length - 1].y + LINE).toBeLessThanOrEqual(hint.y);
      expect(i).toBe(snap(app).menu.cursor);
      press(app, 'down');
    }
  });

  test.each(['en', 'nl'] as const)('in %s nothing written runs off the screen or into what is written beside it, whichever frame is under the cursor', (language) => {
    const { app } = onLot({}, language);
    for (const starter of STARTERS) {
      const drawn = page(app);
      const texts: Written[] = drawn.texts;
      for (const text of texts) {
        expect(text.left, `${starter.id} ${text.text}`).toBeGreaterThanOrEqual(4);
        expect(text.right, `${starter.id} ${text.text}`).toBeLessThanOrEqual(LOGICAL_W - 4);
        expect(text.y, `${starter.id} ${text.text}`).toBeGreaterThanOrEqual(0);
        expect(text.y + text.size, `${starter.id} ${text.text}`).toBeLessThanOrEqual(LOGICAL_H);
      }
      for (const [i, a] of texts.entries()) for (const b of texts.slice(i + 1)) expect(overlap(a, b), `${starter.id}: "${a.text}" and "${b.text}"`).toBe(false);
      // The list and the figures stay in their panel on the right, where the garage has its own: the frame stands left of it.
      const listed = texts.filter((t) => t.y >= 20 && t.y < 180);
      expect(listed.length).toBeGreaterThanOrEqual(3 + 3 + 10);
      for (const text of listed) expect(text.left, `${starter.id} ${text.text}`).toBeGreaterThanOrEqual(LOGICAL_W - 154 + 6);
      press(app, 'down');
    }
  });

  test('the words on the lot are Dutch in Dutch, and no longer than their room', () => {
    const english = { heading: T.heading, hint: T.hint };
    setLanguage('nl');
    expect(STRINGS.starter.heading).toBe(STRINGS_NL.starter.heading);
    expect(STRINGS.starter.heading).not.toBe(english.heading);
    expect(STRINGS.starter.hint).not.toBe(english.hint);
    for (const [i, starter] of STARTERS.entries()) {
      expect(starter.role, starter.id).not.toBe(ENGLISH[i].role);
      expect(starter.role.length, starter.id).toBeLessThanOrEqual(24);
      expect(starter.text, starter.id).not.toBe(ENGLISH[i].text);
    }
    setLanguage('en');
    expect(STARTERS.map((starter) => starter.role)).toEqual(ENGLISH.map((each) => each.role));
  });
});
