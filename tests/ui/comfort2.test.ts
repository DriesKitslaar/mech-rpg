import { createBattle } from '../../src/core/battle';
import { DEFAULT_SETTINGS, TEXT_FACTOR, type GameState, type Settings } from '../../src/core/game';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { SAVE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { SCENE_CHARS, SCENE_HOLD_MS, SceneScreen } from '../../src/ui/sceneScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { TalkScreen } from '../../src/ui/talkScreen';
import { COLORS, wrap } from '../../src/ui/widgets';
import { SONGS } from '../../src/content/songs';
import { songSeconds } from '../../src/platform/music';
import { done, inHub, memoryStore, press, savedGame, select, skipScenes, snap, sprites, strong } from '../helpers/app';
import { record } from '../helpers/canvas';

const scene = (id: string) => SCENES.find((s) => s.id === id)!;
const ACT = scene('act-1');
const KITE = scene('talk-kite');
/** How long the picture of a page of story is left alone. */
const PICTURE_MS = 900;

/** A game that is not hurried, in the hub, with these options. */
function slowApp(saved: GameState, settings: Partial<Settings> = {}): App {
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify(saved), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }) });
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 5 });
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { press(app, 'confirm'); app.update(600); }
  expect(snap(app).screen).toBe('hub');
  return app;
}
const typing = (view: unknown): boolean => (view as { typing: boolean }).typing;

describe('the speed of written text, where it was not timed before', () => {
  test('the four speeds are what they say: slow a little over half, fast two and a half times', () => {
    expect(TEXT_FACTOR).toEqual({ slow: 0.6, normal: 1, fast: 2.5, instant: 1 });
  });

  test('a page of story is written at the speed asked for, once its picture has had a moment alone', () => {
    const page = (settings: Partial<Settings>): number => {
      const screen = new SceneScreen(slowApp(done('intro-1', 'intro-2'), settings), ACT);
      let ms = 0;
      for (; ms < 60000 && typing(screen.view()); ms += 20) screen.update(20);
      return ms - PICTURE_MS;
    };
    const normal = page({});
    expect(normal).toBeGreaterThan(2000);
    expect(page({ textSpeed: 'fast' })).toBeLessThan(normal * 0.6);
    expect(page({ textSpeed: 'slow' })).toBeGreaterThan(normal * 1.4);
    expect(page({ textSpeed: 'instant' })).toBe(0);
  });

  test('what is said in a conversation likewise', () => {
    const line = (settings: Partial<Settings>): number => {
      const screen = new TalkScreen(slowApp(done('intro-1', 'intro-2'), settings), KITE);
      let ms = 0;
      for (; ms < 60000 && typing(screen.view()); ms += 10) screen.update(10);
      return ms;
    };
    const normal = line({});
    expect(normal).toBeGreaterThan(300);
    expect(line({ textSpeed: 'fast' })).toBeLessThan(normal * 0.6);
    expect(line({ textSpeed: 'slow' })).toBeGreaterThan(normal * 1.4);
    expect(line({ textSpeed: 'instant' })).toBe(0);
  });

  test('and a message that is opened', () => {
    const message = (settings: Partial<Settings>): number => {
      const app = slowApp(done('intro-1', 'intro-2'), settings);
      select(app, 'messages');
      app.update(600);
      press(app, 'confirm');
      expect((snap(app) as unknown as { reading: string | null }).reading).not.toBeNull();
      let ms = 0;
      for (; ms < 60000 && typing(snap(app)); ms += 10) app.update(10);
      return ms;
    };
    const normal = message({});
    expect(normal).toBeGreaterThan(300);
    expect(message({ textSpeed: 'fast' })).toBeLessThan(normal * 0.6);
    expect(message({ textSpeed: 'slow' })).toBeGreaterThan(normal * 1.4);
    expect(message({ textSpeed: 'instant' })).toBe(0);
  });
});

describe('text that is all there at once', () => {
  test('a conversation still gives every line a moment: a button held down skips nothing unread', () => {
    const lines = (settings: Partial<Settings>): number[] => {
      const screen = new TalkScreen(slowApp(done('intro-1', 'intro-2'), settings), KITE);
      const came: number[] = [];
      let at = -1;
      for (let ms = 0; ms < 20000 && came.length < 4; ms += 16) {
        const now = (screen.view() as unknown as { talk: { at: number } }).talk.at;
        if (now !== at) { at = now; came.push(ms); }
        screen.onInput('confirm');
        screen.update(16);
      }
      return came;
    };
    const instant = lines({ textSpeed: 'instant' });
    expect(instant).toHaveLength(4);
    // The first line is held as long as a page that has just come up; every one after it for half of that.
    expect(instant[1] - instant[0]).toBeGreaterThanOrEqual(SCENE_HOLD_MS);
    for (let i = 2; i < instant.length; i++) expect(instant[i] - instant[i - 1], `line ${i + 1}`).toBeGreaterThanOrEqual(SCENE_HOLD_MS / 2);
    // Still quicker than writing them out, which is what was asked for.
    const written = lines({});
    expect(instant[3]).toBeLessThan(written[3]);
  });

  test('a page of story keeps its picture clear for a moment: no word is written on it before the shade is up', () => {
    const app = slowApp(done('intro-1', 'intro-2'), { textSpeed: 'instant' });
    const first = wrap(ACT.lines[0], SCENE_CHARS)[0];
    const words = (screen: SceneScreen): string[] => record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
    const alone = new SceneScreen(app, ACT);
    alone.update(PICTURE_MS - 20);
    expect(words(alone)).toContain(ACT.title);
    expect(words(alone)).not.toContain(first);
    expect(words(alone)).not.toContain(STRINGS.scene.continue);
    expect(typing(alone.view())).toBe(true);
    // When the picture has had its moment the page is all there at once.
    alone.update(20);
    expect(words(alone)).toContain(first);
    expect(words(alone)).toContain(wrap(ACT.lines[2], SCENE_CHARS).at(-1));
    expect(words(alone)).toContain(STRINGS.scene.continue);
    expect(typing(alone.view())).toBe(false);
  });

  test('a press while the picture is still alone brings the words up; it takes another to leave the page', () => {
    const app = slowApp(done('intro-1', 'intro-2'), { textSpeed: 'instant' });
    let left = 0;
    app.finishScene = () => { left += 1; };
    const first = wrap(ACT.lines[0], SCENE_CHARS)[0];
    const screen = new SceneScreen(app, ACT);
    const words = (): string[] => record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
    // Held off at first, like any page.
    screen.update(SCENE_HOLD_MS - 20);
    screen.onInput('confirm');
    expect(words()).not.toContain(first);
    screen.update(40);
    screen.onInput('confirm');
    expect(words()).toContain(first);
    expect(left).toBe(0);
    // The press that brought them up is not the press that leaves: that is held off again.
    screen.onInput('confirm');
    expect(left).toBe(0);
    screen.update(SCENE_HOLD_MS);
    screen.onInput('confirm');
    expect(left).toBe(1);
  });
});

describe('the options a battle is fought with', () => {
  const battle = (app: App) => snap(app).battle as unknown as { calm: boolean; pace: { factor: number; instant: boolean } };
  const fight = (settings: Partial<Settings>) => {
    const app = slowApp(strong(done('intro-1', 'intro-2')), settings);
    select(app, 'contracts');
    app.update(600);
    select(app, 'hadron-1');
    app.update(600);
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    return battle(app);
  };

  test('are the ones the player set: a calm picture and the speed of text reach the field', () => {
    expect(fight({})).toMatchObject({ calm: false, pace: { factor: 1, instant: false } });
    expect(fight({ calm: true, textSpeed: 'fast' })).toMatchObject({ calm: true, pace: { factor: 2.5, instant: false } });
    expect(fight({ textSpeed: 'instant' })).toMatchObject({ calm: false, pace: { factor: 1, instant: true } });
  });

  test('a boss\'s warning blinks as it comes, and stands still in a calm picture', () => {
    const colours = (calm: boolean): string[] => {
      const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { quiet: true });
      const screen = new BattleScreen(flow, sprites as SpriteStore, CATALOG, { fast: false, boss: 'Krell', calm });
      const seen: string[] = [];
      for (let i = 0; i < 4; i++) {
        screen.update(90);
        seen.push(record((ctx) => screen.draw(ctx)).texts.find((t) => t.text === STRINGS.battleIntro.warning)!.color);
      }
      return seen;
    };
    expect(colours(false)).toEqual([COLORS.danger, COLORS.heat, COLORS.heat, COLORS.danger]);
    expect(colours(true)).toEqual([COLORS.danger, COLORS.danger, COLORS.danger, COLORS.danger]);
  });
});

describe('the jukebox, where the page and the ear had parted ways', () => {
  interface Db { page: string; detail: { title: string; lines: string[] } | null; playing: string | null }
  type AppOf = ReturnType<typeof inHub>['app'];
  const db = (app: AppOf): Db => snap(app) as unknown as Db;
  function withMusic(saved: GameState = strong(done('intro-1', 'intro-2'))) {
    const tracks: (string | null)[] = [];
    const music = { enabled: true, tense: false, play: (t: string | null) => { tracks.push(t); } };
    return { ...inHub(saved, 5, { music }), tracks };
  }
  function jukebox(app: AppOf): void {
    select(app, 'database');
    press(app, 'prev');
    expect(db(app).page).toBe('music');
  }
  function point(app: AppOf, id: string): void {
    for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
    expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  }

  test('the hub\'s song is playing when the page is opened, and its row says so', () => {
    const { app, tracks } = withMusic();
    jukebox(app);
    expect(db(app).playing).toBe('hub');
    point(app, 'hub');
    expect(db(app).detail!.lines).toEqual(expect.arrayContaining(['NOW PLAYING', 'A: stop']));
    expect(db(app).detail!.lines).not.toContain('A: play');
    // Any other row offers to play.
    point(app, 'title');
    expect(db(app).detail!.lines).toContain('A: play');
    // Stopped, it is quiet; played again, it is the hub's song again.
    point(app, 'hub');
    press(app, 'confirm');
    expect(tracks.at(-1)).toBeNull();
    expect(db(app).playing).toBeNull();
    press(app, 'confirm');
    expect(tracks.at(-1)).toBe('hub');
    expect(db(app).playing).toBe('hub');
    // Left to itself it goes round for as long as the page is open.
    app.update(20 * 60 * 1000);
    expect(db(app).playing).toBe('hub');
  });

  test('with the music off nothing is playing when the page is opened', () => {
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ ...strong(done('intro-1', 'intro-2')), heard: ['title', 'hub'] }), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, music: false }) });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 5 });
    press(app, 'confirm');
    skipScenes(app);
    jukebox(app);
    expect(db(app).playing).toBeNull();
    point(app, 'hub');
    expect(db(app).detail!.lines).not.toContain('NOW PLAYING');
  });

  test.each(['victory', 'defeat'] as const)('a song that plays once is over when it is over: the page stops saying it plays, and A plays it again (%s)', (id) => {
    expect(SONGS[id].loop).toBe(false);
    const { app, tracks } = withMusic({ ...strong(done('intro-1', 'intro-2')), heard: ['title', 'victory', 'defeat'] });
    jukebox(app);
    point(app, id);
    press(app, 'confirm');
    expect(tracks.at(-1)).toBe(id);
    expect(db(app).playing).toBe(id);
    const ms = songSeconds(SONGS[id]) * 1000;
    expect(ms).toBeLessThan(10000);
    app.update(ms - 100);
    expect(db(app).playing).toBe(id);
    expect(tracks.at(-1)).toBe(id);
    app.update(200);
    expect(db(app).playing).toBeNull();
    expect(db(app).detail!.lines).toContain('A: play');
    expect(db(app).detail!.lines).not.toContain('NOW PLAYING');
    // The player was told to be quiet, so the same song starts afresh when it is asked for again.
    expect(tracks.at(-1)).toBeNull();
    press(app, 'confirm');
    expect(tracks.at(-1)).toBe(id);
    expect(db(app).playing).toBe(id);
    // And it ends again by itself: the count started over.
    app.update(ms + 100);
    expect(db(app).playing).toBeNull();
  });

  test('a song that goes round is not cut off by the one that played once before it', () => {
    const { app } = withMusic({ ...strong(done('intro-1', 'intro-2')), heard: ['title', 'victory'] });
    jukebox(app);
    point(app, 'victory');
    press(app, 'confirm');
    app.update(1000);
    point(app, 'title');
    press(app, 'confirm');
    expect(SONGS.title.loop).toBe(true);
    app.update(60 * 1000);
    expect(db(app).playing).toBe('title');
  });
});

describe('the list of songs heard, in a save', () => {
  test('names that are no songs are dropped when the list is next written down: it cannot outgrow what a save may hold', () => {
    const junk = Array.from({ length: 62 }, (_, i) => `song-${i}`);
    const music = { enabled: true, tense: false, play: () => {} };
    const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), heard: [...junk, 'title', 'title'] }, 5, { music });
    // The briefing's song is heard on the way to a contract, and written down when the contract is taken.
    select(app, 'contracts');
    select(app, 'hadron-1');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    app.saveNow();
    const heard = savedGame(store).heard!;
    expect(heard.every((name) => Object.hasOwn(SONGS, name))).toBe(true);
    expect(new Set(heard).size).toBe(heard.length);
    expect(heard).toEqual(expect.arrayContaining(['title', 'hub', 'briefing']));
    // What was written can be read back: the game is still there.
    expect(new SaveFile(store, CATALOG).load()).not.toBeNull();
    expect(new SaveFile(store, CATALOG).hasUnusableData()).toBe(false);
  });

  test('a list that is sound is left as it is', () => {
    const music = { enabled: true, tense: false, play: () => {} };
    const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), heard: ['briefing', 'title', 'hub', 'battle'] }, 5, { music });
    app.saveNow();
    expect(savedGame(store).heard).toEqual(['briefing', 'title', 'hub', 'battle']);
  });
});
