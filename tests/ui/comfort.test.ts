import { applyAction, activeUnit, createBattle } from '../../src/core/battle';
import { DEFAULT_SETTINGS, TEXT_FACTOR, TEXT_SPEEDS, isValidState, type Settings } from '../../src/core/game';
import { JUKEBOX } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SONGS } from '../../src/content/songs';
import { STRINGS } from '../../src/content/strings';
import { SAVE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { PAGE_CHARS } from '../../src/ui/databaseScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { TYPING_SPEED } from '../../src/ui/typewriter';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, ids, inHub, makeApp, memoryStore, press, savedGame, select, skipScenes, snap, sprites, strong } from '../helpers/app';

type AppOf = ReturnType<typeof inHub>['app'];
const note = (app: AppOf, id: string) => snap(app).menu.items.find((i) => i.id === id)?.note;
/** Walks the cursor to an entry without confirming it. */
function point(app: AppOf, id: string): void {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
}

describe('the speed of written text', () => {
  test('is an option with four settings, kept in the settings only when it is not the ordinary one', () => {
    const { app, store } = inHub(fresh());
    select(app, 'options');
    expect(ids(app)).toEqual(['sfx', 'music', 'rumble', 'fastBattles', 'textSpeed', 'calm', 'detail', 'difficulty', 'swapAB', 'language', 'title']);
    expect(note(app, 'textSpeed')).toBe('Normal');
    point(app, 'textSpeed');
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) { press(app, 'right'); seen.push(note(app, 'textSpeed')); }
    expect(seen).toEqual(['Fast', 'Instant', 'Slow', 'Normal']);
    expect(TEXT_SPEEDS).toEqual(['slow', 'normal', 'fast', 'instant']);
    expect(app.settings.textSpeed).toBeUndefined();
    expect(JSON.parse(store.data[SETTINGS_KEY]).textSpeed).toBeUndefined();
    press(app, 'left');
    expect(app.settings.textSpeed).toBe('slow');
    expect(JSON.parse(store.data[SETTINGS_KEY]).textSpeed).toBe('slow');
    expect(savedGame(store).settings.textSpeed).toBe('slow');
    // A press of A steps it on like any other option.
    press(app, 'confirm');
    expect(app.settings.textSpeed).toBeUndefined();
  });

  test('writes slower, faster or all at once, in every screen that writes', () => {
    expect(TEXT_FACTOR.slow).toBeLessThan(1);
    expect(TEXT_FACTOR.normal).toBe(1);
    expect(TEXT_FACTOR.fast).toBeGreaterThan(1);
    /** How long a briefing takes to write itself out, in milliseconds, in a game that is not hurried. */
    const briefing = (settings: Partial<Settings>): number => {
      const store = memoryStore({ [SAVE_KEY]: JSON.stringify(done('intro-1', 'intro-2')), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }) });
      const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 5 });
      for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { press(app, 'confirm'); app.update(600); }
      expect(snap(app).screen).toBe('hub');
      select(app, 'contracts');
      app.update(600);
      select(app, 'hadron-1');
      expect(snap(app)).toMatchObject({ screen: 'briefing' });
      let ms = 0;
      for (; ms < 60000 && (snap(app) as unknown as { typing: boolean }).typing; ms += 20) app.update(20);
      return ms;
    };
    const normal = briefing({});
    expect(normal).toBeGreaterThan(400);
    expect(briefing({ textSpeed: 'instant' })).toBe(0);
    const fast = briefing({ textSpeed: 'fast' });
    const slow = briefing({ textSpeed: 'slow' });
    expect(fast).toBeLessThan(normal * 0.6);
    expect(slow).toBeGreaterThan(normal * 1.4);
  });

  test('what is said in a battle follows it too', () => {
    const flowOf = () => new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { talk: [{ at: 'start', who: 'Dispatch', text: 'A line long enough to take a moment to write itself out.' }] });
    /** How long the line takes to write itself out once it has come up, in milliseconds. */
    const spoken = (typing?: { factor: number; instant: boolean }): number => {
      const flow = flowOf();
      const screen = new BattleScreen(flow, sprites as SpriteStore, CATALOG, { fast: false, ...(typing ? { typing } : {}) });
      // The banner that opens the battle comes first; the line starts writing when it has gone.
      for (let i = 0; i < 2000 && (flow.phase !== 'talk' || screen.banner); i++) screen.update(20);
      expect(flow.phase).toBe('talk');
      let ms = 0;
      for (; ms < 20000 && screen.typing; ms += 10) screen.update(10);
      return ms;
    };
    const plain = spoken();
    expect(plain).toBeGreaterThan(300);
    expect(spoken({ factor: 2.5, instant: false })).toBeLessThan(plain * 0.6);
    expect(spoken({ factor: 1, instant: true })).toBe(0);
    expect(TYPING_SPEED).toBe(90);
  });

  test('a save or stored settings with a speed nobody offers are not taken at their word', () => {
    const game = fresh();
    expect(isValidState({ ...game, settings: { ...game.settings, textSpeed: 'fast' } }, CATALOG)).toBe(true);
    expect(isValidState({ ...game, settings: { ...game.settings, textSpeed: 'ludicrous' } }, CATALOG)).toBe(false);
    expect(isValidState({ ...game, settings: { ...game.settings, calm: 'yes' } }, CATALOG)).toBe(false);
    const store = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, textSpeed: 'ludicrous', calm: 'yes' }) });
    const loaded = new SaveFile(store, CATALOG).loadSettings()!;
    expect(loaded.textSpeed).toBeUndefined();
    expect(loaded.calm).toBeUndefined();
    const kept = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, textSpeed: 'instant', calm: true }) });
    expect(new SaveFile(kept, CATALOG).loadSettings()).toMatchObject({ textSpeed: 'instant', calm: true });
  });
});

describe('a calm picture', () => {
  test('is an option, off unless it is turned on, with a line that says what it does', () => {
    const { app, store } = inHub(fresh());
    select(app, 'options');
    expect(note(app, 'calm')).toBe('Full');
    point(app, 'calm');
    press(app, 'confirm');
    expect(note(app, 'calm')).toBe('Calm');
    expect(app.settings.calm).toBe(true);
    expect(JSON.parse(store.data[SETTINGS_KEY]).calm).toBe(true);
    press(app, 'left');
    expect(app.settings.calm).toBeUndefined();
    expect(JSON.parse(store.data[SETTINGS_KEY]).calm).toBeUndefined();
    expect(STRINGS.options.calmHelp).toMatch(/shaking/);
    // And since the battle is looked at through a camera that moves: that it stands still.
    expect(STRINGS.options.calmHelp).toMatch(/camera/);
  });

  /**
   * A battle in which an Overdrive goes off and the shot after it destroys a machine, and what the
   * screen does to the picture meanwhile: how far it moves the field as a whole, whether it washes
   * the field white, and how brightly it lights the unit that is hit.
   */
  function struck(calm: boolean) {
    let s = createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['heavy-mech']], CATALOG, 4, { overdrive: 'deadeye', drive: 100 });
    for (let i = 0; i < 6 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
    // One hit finishes the drone, and under Deadeye the shot cannot miss.
    s.units[1].parts.core!.ap = 1;
    const flow = new BattleFlow(s, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites as SpriteStore, CATALOG, { fast: false, calm });
    // Past the banner that opens the battle: while it is up a press only dismisses it.
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    const moves: { dx: number; dy: number }[] = [];
    const whites: string[] = [];
    const filters: string[] = [];
    const target: Record<string, unknown> = {};
    // The field as a whole is moved by the first translation of a frame; everything after it places a single thing.
    let first = true;
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => {
          if (name === 'translate' && first) { first = false; if (Number(args[0]) !== 0 || Number(args[1]) !== 0) moves.push({ dx: Number(args[0]), dy: Number(args[1]) }); }
          if (name === 'fillRect' && /^rgba\(255, 255, 255/.test(String(t.fillStyle)) && Number(args[2]) >= 300) whites.push(String(t.fillStyle));
        }),
      set: (t, name: string, value) => { t[name] = value; if (name === 'filter' && value !== 'none') filters.push(String(value)); return true; },
    }) as unknown as CanvasRenderingContext2D;
    const frames = (n: number): void => { for (let i = 0; i < n; i++) { screen.update(16); first = true; screen.draw(ctx); } };
    screen.onInput('next');
    frames(60);
    expect(flow.phase).toBe('action');
    // Fire, the first weapon, at the drone's core.
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.targetId).toBe('enemy-0');
    screen.onInput('confirm');
    frames(120);
    expect(flow.state.units[1].destroyed).toBe(true);
    return { moves, whites, filters };
  }

  test('with the picture as it comes, a hard blow shakes the field and an Overdrive flashes across it', () => {
    const full = struck(false);
    expect(full.whites.length).toBeGreaterThan(0);
    expect(full.moves.length).toBeGreaterThan(0);
    expect(full.filters).toContain('brightness(2.6)');
  });

  test('calm, the field stays where it is and nothing flashes across it; a unit that is hit only lights up a little', () => {
    const calm = struck(true);
    expect(calm.whites).toEqual([]);
    expect(calm.moves).toEqual([]);
    expect(calm.filters).not.toContain('brightness(2.6)');
    expect(calm.filters).toContain('brightness(1.4)');
  });
});

describe('the jukebox', () => {
  interface Db { page: string; count: string; detail: { title: string; lines: string[] } | null; playing: string | null }
  const db = (app: AppOf): Db => snap(app) as unknown as Db;
  function withMusic(saved = strong(done('intro-1', 'intro-2'))) {
    const tracks: (string | null)[] = [];
    const music = { enabled: true, tense: false, play: (t: string | null) => { tracks.push(t); } };
    const made = inHub(saved, 5, { music });
    return { ...made, tracks };
  }
  /** Opens the database on its page of songs. */
  function jukebox(app: AppOf): void {
    select(app, 'database');
    press(app, 'prev');
    expect(db(app).page).toBe('music');
  }

  test('every song of the game is in it, each with a name of its own that fits the list and a line that fits the page', () => {
    expect(JUKEBOX.map((s) => s.id).sort()).toEqual(Object.keys(SONGS).sort());
    expect(new Set(JUKEBOX.map((s) => s.title)).size).toBe(JUKEBOX.length);
    for (const song of JUKEBOX) {
      expect(song.title.length, song.title).toBeLessThanOrEqual(18);
      expect(song.title).toBe(song.title.toUpperCase());
      expect(wrap(song.text, PAGE_CHARS).length, song.text).toBeLessThanOrEqual(3);
    }
  });

  test('is the database\'s last page: the songs heard so far by name, the others kept back', () => {
    const { app, tracks } = withMusic();
    jukebox(app);
    expect(snap(app).menu.items).toHaveLength(JUKEBOX.length);
    const heard = snap(app).menu.items.filter((i) => i.enabled).map((i) => i.id);
    // The title's song, the hub's and the story's have been heard on the way in; no battle has been fought.
    expect(heard).toEqual(expect.arrayContaining(['title', 'hub']));
    expect(heard).not.toContain('boss');
    expect(heard).not.toContain('battle');
    expect(db(app).count).toBe(`HEARD ${heard.length}/${JUKEBOX.length}`);
    const kept = snap(app).menu.items.find((i) => i.id === 'boss')!;
    expect(kept).toMatchObject({ label: '? ? ?', enabled: false });
    point(app, 'boss');
    expect(db(app).detail).toEqual({ title: '? ? ?', lines: ['Not heard so far.'] });
    // One that was not heard cannot be played: the hub's song, which the page opened with, goes on.
    press(app, 'confirm');
    expect(db(app).playing).toBe('hub');
    expect(tracks.at(-1)).toBe('hub');
  });

  test('a song heard can be played and stopped, and leaving brings the hub\'s own song back', () => {
    const { app, tracks } = withMusic();
    jukebox(app);
    point(app, 'title');
    expect(db(app).detail!.title).toBe('IRONWAGE');
    expect(db(app).detail!.lines.join(' ')).toContain('The title. Where every contract begins.');
    expect(db(app).detail!.lines).toContain('A: play');
    expect(db(app).detail!.lines.some((line) => /^LENGTH \d+:\d\d$/.test(line))).toBe(true);
    expect(db(app).detail!.lines).toContain(`TEMPO ${SONGS.title.bpm}`);
    press(app, 'confirm');
    expect(tracks.at(-1)).toBe('title');
    expect(db(app).playing).toBe('title');
    expect(db(app).detail!.lines).toEqual(expect.arrayContaining(['NOW PLAYING', 'A: stop']));
    // The song goes on while other pages are read.
    press(app, 'next', 'prev');
    expect(tracks.at(-1)).toBe('title');
    press(app, 'confirm');
    expect(tracks.at(-1)).toBeNull();
    expect(db(app).playing).toBeNull();
    press(app, 'confirm');
    expect(tracks.at(-1)).toBe('title');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    expect(tracks.at(-1)).toBe('hub');
  });

  test('what has been heard is kept with the game, and a battle fought adds its song', () => {
    const { app, store } = withMusic();
    select(app, 'contracts');
    select(app, 'patrol');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) {
      for (let j = 0; j < 40000 && snap(app).battle?.phase !== 'result'; j++) {
        const s = snap(app);
        if (s.battle!.phase === 'animating') app.update(16);
        else if (s.battle!.phase === 'action') { if (s.menu.items[0].enabled) press(app, 'confirm'); else select(app, 'endTurn'); } else press(app, 'confirm');
      }
      press(app, 'confirm');
    }
    press(app, 'confirm');
    skipScenes(app);
    expect(app.heard()).toEqual(expect.arrayContaining(['title', 'hub', 'briefing', 'battle', 'victory']));
    // The fanfare came after the contract was booked: it is written down with the next thing that is, or on the way out.
    expect(savedGame(store).heard).toEqual(expect.arrayContaining(['title', 'hub', 'briefing', 'battle']));
    expect(app.saveNow()).toBe(true);
    expect(savedGame(store).heard).toEqual(expect.arrayContaining(['title', 'hub', 'briefing', 'battle', 'victory']));
    // Opened again another day, they are all still there.
    const again = withMusic(savedGame(store));
    jukebox(again.app);
    const heard = snap(again.app).menu.items.filter((i) => i.enabled).map((i) => i.id);
    expect(heard).toEqual(expect.arrayContaining(['battle', 'victory', 'briefing']));
  });

  test('another game does not inherit what this one heard', () => {
    const { app, store } = withMusic();
    select(app, 'contracts');
    select(app, 'patrol');
    expect(app.heard()).toContain('briefing');
    press(app, 'cancel', 'cancel');
    select(app, 'options');
    select(app, 'title');
    expect(snap(app).screen).toBe('title');
    expect(app.heard()).toEqual(['title']);
    expect(savedGame(store).heard).toContain('briefing');
  });

  test('with the music off nothing counts as heard, and the page says why a song stays silent', () => {
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ ...strong(done('intro-1', 'intro-2')), heard: ['title'] }), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, music: false }) });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 5 });
    press(app, 'confirm');
    skipScenes(app);
    expect(app.heard()).toEqual(['title']);
    jukebox(app);
    point(app, 'title');
    expect(db(app).detail!.lines.join(' ')).toContain('Music is off.');
    // There is nothing to play, so nothing claims to be playing.
    expect(db(app).detail!.lines).not.toContain('A: play');
    press(app, 'confirm');
    expect(db(app).playing).toBeNull();
    expect(db(app).detail!.lines).not.toContain('NOW PLAYING');
  });

  test('a save cannot hand in a list of songs that is not a list', () => {
    const game = fresh();
    expect(isValidState({ ...game, heard: ['title', 'hub'] }, CATALOG)).toBe(true);
    expect(isValidState({ ...game, heard: 'title' }, CATALOG)).toBe(false);
    expect(isValidState({ ...game, heard: [1, 2] }, CATALOG)).toBe(false);
    expect(isValidState({ ...game, heard: Array.from({ length: 65 }, (_, i) => `s${i}`) }, CATALOG)).toBe(false);
  });
});

describe('the options screen with everything on it', () => {
  test('all twelve rows, the line of help and the hint are on the screen', () => {
    const { app } = makeApp({ ...strong(done('intro-1')), endingSeen: true });
    press(app, 'confirm');
    skipScenes(app);
    select(app, 'options');
    expect(ids(app)).toHaveLength(12);
    const rows: { text: string; y: number }[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillText') rows.push({ text: String(args[0]), y: Number(args[2]) }); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    point(app, 'calm');
    app.draw(ctx);
    for (const label of ['Sound Effects', 'Text Speed', 'Screen Effects', 'Light Effects', 'Quit to Title', STRINGS.options.calmHelp, STRINGS.options.hint]) {
      const row = rows.find((r) => r.text === label);
      expect(row, label).toBeDefined();
      expect(row!.y, label).toBeLessThanOrEqual(258);
      expect(row!.y, label).toBeGreaterThanOrEqual(30);
    }
    // The way out is written above the strip along the bottom where a medal or an entry is announced.
    expect(rows.find((r) => r.text === STRINGS.options.hint)!.y + 12).toBeLessThanOrEqual(240);
  });
});
