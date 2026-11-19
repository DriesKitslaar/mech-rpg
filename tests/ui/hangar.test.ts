import { ARCHETYPES, archetypeOf, type Archetype } from '../../src/core/archetype';
import { LOADOUT_SLOTS, saveLoadout, sell, type GameState } from '../../src/core/game';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS, LINE } from '../../src/ui/widgets';
import { done, ids, inHub, makeApp, press, savedGame, select, skipScenes, snap } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * Seven places for a saved build, as the player meets them: the garage's list, the build row at the
 * briefing, the range's sparring partners, and a game kept when there were three.
 */

afterEach(() => setLanguage('en'));

const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const late = (kind: Archetype): Build => ARCHETYPE_BUILDS[kind].late;
/** A pilot at the war with a build of every class saved, in the order of the classes, and the last of them on the floor. */
function hangar(extra: Partial<GameState> = {}): GameState {
  let game: GameState = { ...done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen'), credits: 9_999_999 };
  ARCHETYPES.forEach((kind, slot) => { game = saveLoadout(wearing(game, late(kind)), slot); });
  return { ...game, credits: 5000, codex: WORLD.map((entry) => entry.id), scenes: ['act-1', 'act-2'], arenaRank: 3, lessons: ['momentum', 'rout'], met: ['tank', 'gun-turret'], ...extra };
}
/** The garage's panel on the right: where its list stands. */
const PANEL = { left: 162, top: 20, bottom: 194 };
function inGarage(saved: GameState): ReturnType<typeof inHub> {
  const made = inHub(saved);
  select(made.app, 'garage');
  expect(snap(made.app).screen).toBe('garage');
  press(made.app, 'right');
  return made;
}

describe('the garage', () => {
  test('lists seven places; with a build of every class saved, each row says its class and its frame, inside the panel', () => {
    const { app } = inGarage(hangar());
    expect(LOADOUT_SLOTS).toBe(7);
    const rows = snap(app).menu.items;
    expect(rows.map((row) => row.label)).toEqual(['1  Duellist', '2  Sharpshooter', '3  Artillery', '4  Lancer', '5  Bastion', '6  Skirmisher', '7  All-rounder']);
    expect(rows.map((row) => row.note)).toEqual(['Wraith', 'Ronin', 'Colossus', 'Ronin', 'Colossus', 'Wraith', 'Ronin']);
    const shown = drawn(app);
    rows.forEach((row, i) => {
      const label = written(shown, row.label);
      expect(label.y, row.label).toBe(40 + i * LINE);
      const note = shown.texts.filter((t) => t.text === row.note && t.y >= label.y && t.y <= label.y + 1);
      expect(note, row.label).toHaveLength(1);
      // The frame stands clear of the class before it, and inside the panel.
      expect(note[0].left, row.label).toBeGreaterThanOrEqual(label.right + 4);
      expect(note[0].right, row.label).toBeLessThanOrEqual(LOGICAL_W - 6);
      expect(label.left).toBeGreaterThanOrEqual(PANEL.left + 6);
    });
    const last = written(shown, '7  All-rounder');
    expect(last.y + LINE).toBeLessThanOrEqual(PANEL.bottom);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 2);
  });

  test('the mech shown is the build under the cursor, the seventh as the first', () => {
    const { app } = inGarage(hangar());
    for (const [slot, kind] of ARCHETYPES.entries()) {
      expect(snap(app).menu.cursor).toBe(slot);
      // The header says what kind of machine is being looked at.
      expect(drawn(app).texts.some((t) => t.y === 1 && t.text.startsWith(STRINGS.classes.names[kind].toUpperCase())), kind).toBe(true);
      press(app, 'down');
    }
    expect(snap(app).menu.cursor).toBe(0);
  });

  test('the menu of a saved build stands under the seventh row, and what is missing is said under the menu, all inside the panel', () => {
    // The sharpshooter's rail has been sold since it was saved.
    const base = hangar();
    const sold = { ...base, inventory: { ...base.inventory, 'wpn-longbow': 0 } };
    const { app } = inGarage(sold);
    press(app, 'down', 'confirm');
    expect(ids(app)).toEqual(['load', 'save', 'clear', 'back']);
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'load', enabled: false, note: 'Missing: Longbow Rail' });
    const shown = drawn(app);
    const seventh = written(shown, '7  All-rounder');
    const menu = ['Load', 'Save current build', 'Clear', 'Back'].map((label) => written(shown, label));
    expect(menu[0].y).toBeGreaterThanOrEqual(seventh.y + LINE + 4);
    for (let i = 1; i < menu.length; i++) expect(menu[i].y).toBe(menu[i - 1].y + 13);
    const missing = written(shown, 'Missing: Longbow Rail');
    expect(missing.y).toBeGreaterThanOrEqual(menu[3].y + 11);
    expect(missing.y + 10).toBeLessThanOrEqual(PANEL.bottom);
    expect(missing.color).toBe(COLORS.danger);
    expect(missing.right).toBeLessThanOrEqual(LOGICAL_W - 4);
    const panel = shown.texts.filter((t) => t.left >= PANEL.left && t.y >= PANEL.top && t.y < PANEL.bottom);
    for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    // The rule under the list is under its last row.
    expect(shown.rects.some((r) => r.h === 1 && r.x === PANEL.left + 6 && r.y > seventh.y + LINE - 2 && r.y < menu[0].y)).toBe(true);
  });

  test('in Dutch, seven saved: the rows fit, and the menu with what is missing does too', () => {
    const base = hangar();
    const { app } = inGarage({ ...base, inventory: { ...base.inventory, 'wpn-longbow': 0 }, settings: { ...base.settings, language: 'nl' } });
    const rows = snap(app).menu.items;
    expect(rows.map((row) => row.label)).toEqual(['1  Duellist', '2  Scherpschutter', '3  Artillerie', '4  Lansier', '5  Bastion', '6  Jager', '7  Allrounder']);
    let shown = drawn(app);
    for (const row of rows) {
      const label = written(shown, row.label);
      const note = shown.texts.filter((t) => t.text === row.note && t.y >= label.y && t.y <= label.y + 1)[0];
      expect(note.left, row.label).toBeGreaterThanOrEqual(label.right + 4);
      expect(note.right, row.label).toBeLessThanOrEqual(LOGICAL_W - 6);
    }
    press(app, 'down', 'confirm');
    shown = drawn(app);
    const missing = shown.texts.find((t) => t.text.startsWith('Ontbreekt') || t.text.includes('Longbow Rail'))!;
    expect(missing.y + 10).toBeLessThanOrEqual(PANEL.bottom);
    expect(missing.right).toBeLessThanOrEqual(LOGICAL_W - 4);
    const panel = shown.texts.filter((t) => t.left >= PANEL.left && t.y >= PANEL.top && t.y < PANEL.bottom);
    for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    expect(STRINGS_NL.garage.emptyLoadout).toBe('Leeg');
  });
});

describe('the widest row there can be', () => {
  // The longest class there is, on the frames with the longest names a pilot can own: a sharpshooter on each.
  const cores = Object.values(CATALOG).filter((part) => part.kind === 'core' && !!part.vendor).sort((a, b) => b.name.split(' ')[0].length - a.name.split(' ')[0].length);
  const widest = (language: 'en' | 'nl'): GameState => {
    const base = hangar();
    return { ...base, loadouts: cores.slice(0, LOADOUT_SLOTS).map((core) => ({ ...late('marksman'), core: core.id })), settings: { ...base.settings, language } };
  };

  test.each([['en', 'Sharpshooter'], ['nl', 'Scherpschutter']] as const)('in %s: every frame stands clear of the class before it, inside the panel', (language, name) => {
    expect(cores.length).toBeGreaterThanOrEqual(LOADOUT_SLOTS);
    expect(cores[0].name.split(' ')[0].length).toBeGreaterThanOrEqual(8);
    const { app } = inGarage(widest(language));
    const names = language === 'nl' ? STRINGS_NL.classes.names : STRINGS.classes.names;
    // No class has a longer name, in either language.
    expect(names.marksman).toBe(name);
    expect(Math.max(...ARCHETYPES.map((kind) => names[kind].length))).toBe(name.length);
    const rows = snap(app).menu.items;
    expect(rows.map((row) => row.label)).toEqual(cores.slice(0, LOADOUT_SLOTS).map((_, i) => `${i + 1}  ${name}`));
    expect(rows.map((row) => row.note)).toEqual(cores.slice(0, LOADOUT_SLOTS).map((core) => core.name.split(' ')[0]));
    const shown = drawn(app);
    rows.forEach((row) => {
      const label = written(shown, row.label);
      const note = shown.texts.filter((t) => t.text === row.note && t.y >= label.y && t.y <= label.y + 1);
      expect(note, row.label).toHaveLength(1);
      expect(note[0].left, `${row.label} ${row.note}`).toBeGreaterThanOrEqual(label.right + 4);
      expect(note[0].right, row.label).toBeLessThanOrEqual(LOGICAL_W - 6);
    });
    // The notes are one column: all of a size.
    expect(new Set(rows.map((row) => shown.texts.find((t) => t.text === row.note && t.align === 'right')!.size)).size).toBe(1);
  });
});

describe('the seventh place', () => {
  test('at the briefing: the build row turns through all seven and the one on the floor, and the seventh is flown from like the first', () => {
    // The all-rounder is on the floor and saved seventh: a build is not listed twice, so there are seven to turn through.
    const { app, store } = inHub(hangar());
    select(app, 'contracts');
    select(app, 'patrol');
    type Chosen = { slot: number | null; kind: Archetype; choices: number };
    const chosen = (): Chosen => (snap(app).briefing as unknown as { build: Chosen }).build;
    expect(chosen()).toEqual({ slot: null, kind: 'allrounder', choices: 7 });
    for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'build'; i++) press(app, 'down');
    const turned: (number | null)[] = [];
    for (let i = 0; i < 7; i++) { press(app, 'right'); turned.push(chosen().slot); }
    expect(turned).toEqual([0, 1, 2, 3, 4, 5, null]);
    // The sixth place, by its number, in the corner of the header.
    press(app, 'left');
    expect(chosen()).toMatchObject({ slot: 5, kind: 'skirmisher' });
    expect(drawn(app).texts.filter((t) => t.text === 'SAVED BUILD 6' && t.y === 9).map((t) => t.right)).toEqual([LOGICAL_W - 12]);
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect(savedGame(store).build).toEqual(late('skirmisher'));
  });

  test('at the briefing with another build on the floor: the seventh is turned to as BUILD 7 and flown from', () => {
    const base = hangar();
    const { app, store } = inHub(wearing(base, late('lancer')));
    select(app, 'contracts');
    select(app, 'patrol');
    for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'build'; i++) press(app, 'down');
    press(app, 'left');
    expect((snap(app).briefing as unknown as { build: { slot: number; kind: string } }).build).toMatchObject({ slot: 6, kind: 'allrounder' });
    expect(drawn(app).texts.filter((t) => t.text === 'SAVED BUILD 7' && t.y === 9).map((t) => t.right)).toEqual([LOGICAL_W - 12]);
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect(savedGame(store).build).toEqual(late('allrounder'));
    expect(savedGame(store).loadouts).toHaveLength(7);
  });

  test('on the range: every saved build heads the list by its number and class, and the seventh is sparred with', () => {
    const base = hangar();
    const { app } = inHub(wearing(base, late('lancer')));
    select(app, 'training');
    press(app, 'next');
    const rows = snap(app).menu.items.filter((item) => item.id.startsWith('spar-'));
    expect(rows.map((row) => [row.id, row.label, row.note])).toEqual(ARCHETYPES.map((kind, slot) => [`spar-${slot}`, `Saved Build ${slot + 1}`, STRINGS.classes.names[kind]]));
    for (let i = 0; i < 6; i++) press(app, 'down');
    expect(snap(app).menu.items[snap(app).menu.cursor]).toMatchObject({ id: 'spar-6', label: 'Saved Build 7', note: 'All-rounder' });
    expect(written(drawn(app), 'SAVED BUILD 7').y).toBe(189);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'range-spar-6', reward: 0 } });
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ mission: 'range-spar-6', enemies: ['spar-6'] });
    expect(app.enemies()['spar-6'].build).toEqual(late('allrounder'));
    expect(archetypeOf(app.enemies()['spar-6'].build, CATALOG)).toBe('allrounder');
  });
});

describe('a game kept when there were three places', () => {
  /** As an older version wrote it: a list of three, the second filled. */
  function kept(): GameState {
    const base = hangar();
    return { ...wearing(base, late('lancer')), loadouts: [null, late('bastion'), null] };
  }

  test('loads as it was: seven rows, the saved build where it was, the rest empty', () => {
    expect(kept().loadouts).toHaveLength(3);
    const { app } = inGarage(kept());
    expect(app.game!.loadouts).toEqual([null, late('bastion'), null, null, null, null, null]);
    expect(snap(app).menu.items.map((row) => row.label)).toEqual(['1  Empty', '2  Bastion', '3  Empty', '4  Empty', '5  Empty', '6  Empty', '7  Empty']);
    expect(app.game!.build).toEqual(late('lancer'));
    // An empty place is a row like any other: it can be chosen, and is written as one that can.
    expect(snap(app).menu.items.every((row) => row.enabled)).toBe(true);
    const shown = drawn(app);
    expect(written(shown, '1  Empty').color).toBe(COLORS.accent);
    for (const label of ['2  Bastion', '3  Empty', '7  Empty']) expect(written(shown, label).color, label).toBe(COLORS.text);
  });

  test('can be saved into the seventh place, and the game kept after that holds seven', () => {
    const { app, store } = inGarage(kept());
    press(app, 'up', 'confirm');
    select(app, 'save');
    expect(savedGame(store).loadouts).toEqual([null, late('bastion'), null, null, null, null, late('lancer')]);
    expect(snap(app).menu.items[6]).toMatchObject({ label: '7  Lancer', note: 'Ronin' });
  });

  test('its saved build is still flown from at a briefing and sparred with on the range', () => {
    const { app } = inHub(kept());
    expect(app.sorties().map((sortie) => sortie.slot)).toEqual([null, 1]);
    expect(app.rangeList().filter((entry) => entry.spar !== undefined).map((entry) => entry.spar)).toEqual([1]);
    app.startMission('range-spar-1');
    expect(snap(app).battle).toMatchObject({ mission: 'range-spar-1' });
    // A place the old list did not name is nothing to spar with, and nothing to fly from.
    const other = inHub(kept()).app;
    other.startMission('range-spar-5');
    expect(snap(other).screen).toBe('hub');
    other.startMission('patrol', false, null, false, 5);
    expect(snap(other).screen).toBe('hub');
  });

  test('a part of a saved build that was sold is still named, in any place', () => {
    const base = hangar();
    const game = sell(wearing(base, late('lancer')), 'wpn-void-rifle', CATALOG);
    const made = makeApp(game);
    press(made.app, 'confirm');
    skipScenes(made.app);
    select(made.app, 'garage');
    press(made.app, 'right');
    // The skirmisher is saved sixth, and carries the rifle.
    for (let i = 0; i < 5; i++) press(made.app, 'down');
    press(made.app, 'confirm');
    expect(snap(made.app).menu.items[0]).toMatchObject({ id: 'load', enabled: false, note: 'Missing: Void Rifle' });
  });
});
