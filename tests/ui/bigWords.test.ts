import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { DEFAULT_SETTINGS, type GameState, type Settings } from '../../src/core/game';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { SAVE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, RESULT_SMALL, RESULT_TALL, RESULT_W, RESULT_WORD_Y } from '../../src/ui/battleScreen';
import { setDetail } from '../../src/ui/light';
import { SceneScreen, TITLE_SMALL, TITLE_TALL, TITLE_W, TITLE_Y } from '../../src/ui/sceneScreen';
import { GLOWS, WORD_GLOW, WORD_ON_MS, fitTall, forgetWords, wordHeight, wordLevel, wordLights, wordTop, wordWidth, type Metal } from '../../src/ui/signType';
import type { SpriteStore } from '../../src/ui/sprites';
import { TALK_TITLE_TALL, TALK_TITLE_W, TALK_TITLE_Y, TalkScreen } from '../../src/ui/talkScreen';
import { COLORS } from '../../src/ui/widgets';
import { done, memoryStore, press, snap } from '../helpers/app';
import { record, signCount, signIn, type Drawn, type Glowed } from '../helpers/canvas';

/**
 * The big words of the game are written in the letters of its sign: a battle won or lost, what a
 * page of story or a conversation is called. Each stands where the font's word stood, is never
 * wider than the room it has in either language, and is handed back to the font where the sign
 * cannot write it. (The warning over a boss is one of them too: see the tests of its entrance.)
 */

afterEach(() => { setLanguage('en'); setDetail(2); forgetWords(); });

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const scene = (id: string) => SCENES.find((s) => s.id === id)!;
const lights = (page: Drawn, metal: Metal): Glowed[] => page.glows.filter((g) => g.blend === 'lighter' && g.stops[0][1].startsWith(`rgba(${[1, 3, 5].map((at) => parseInt(GLOWS[metal].slice(at, at + 2), 16)).join(', ')},`));
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
/** A game in the hub, hurried or not, with these options. */
function appWith(settings: Partial<Settings> = {}, fast = false, saved: GameState = done('intro-1', 'intro-2')): App {
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify(saved), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }) });
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast, seed: 5 });
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { press(app, 'confirm'); app.update(600); }
  expect(snap(app).screen).toBe('hub');
  return app;
}

describe('a word coming on, and the light it throws', () => {
  test('dark, a strike, nearly dark again, and on, in a third of a second; a calm picture has it simply on', () => {
    expect(WORD_ON_MS).toBe(320);
    expect([0, 59].map((ms) => wordLevel(ms))).toEqual([0, 0]);
    expect([60, 119].map((ms) => wordLevel(ms))).toEqual([1, 1]);
    expect([120, 199].map((ms) => wordLevel(ms))).toEqual([0.15, 0.15]);
    expect(wordLevel(200)).toBeCloseTo(0.6, 9);
    expect(wordLevel(260)).toBeCloseTo(0.8, 9);
    for (let ms = 201; ms < 320; ms++) expect(wordLevel(ms)).toBeGreaterThan(wordLevel(ms - 1));
    expect([320, 321, 5000, Infinity].map((ms) => wordLevel(ms))).toEqual([1, 1, 1, 1]);
    for (let ms = 0; ms < 400; ms += 7) expect(wordLevel(ms, true)).toBe(1);
  });

  test('a lit word throws a few small lights along itself, in its metal\'s colour; a dark one throws none', () => {
    expect(GLOWS).toEqual({ steel: '#7fa8ff', neon: '#ff5db1', amber: '#ffb44a', red: '#ff5a40' });
    expect(WORD_GLOW).toBe(0.18);
    const w = wordWidth('VICTORY', 26);
    const thrown = wordLights('VICTORY', 155, 55, 26, 'neon');
    expect(thrown).toHaveLength(Math.round(w / 60));
    for (const light of thrown) {
      expect(light).toMatchObject({ y: 55, r: 39, color: '#ff5db1', alpha: 0.18 });
      expect(light.x).toBeGreaterThan(155 - w / 2);
      expect(light.x).toBeLessThan(155 + w / 2);
      // Small: nothing a calm picture would leave out.
      expect(light.r).toBeLessThanOrEqual(80);
    }
    // Evenly along it, round its middle.
    expect(Math.abs(thrown.reduce((sum, light) => sum + light.x, 0) / thrown.length - 155)).toBeLessThanOrEqual(1);
    for (let i = 1; i < thrown.length; i++) expect(Math.abs(thrown[i].x - thrown[i - 1].x - w / thrown.length)).toBeLessThanOrEqual(1);
    expect(wordLights('A', 100, 20, 20, 'red')).toHaveLength(1);
    expect(wordLights('RESERVESLEUTEL', 155, 47, 25, 'neon').length).toBeGreaterThanOrEqual(4);
    // As lit as the word is; none when it is dark, and none for what the sign cannot write.
    expect(wordLights('VICTORY', 155, 55, 26, 'neon', 0.5)[0].alpha).toBeCloseTo(0.09, 9);
    expect(wordLights('VICTORY', 155, 55, 26, 'neon', 3)[0].alpha).toBeCloseTo(0.18, 9);
    expect(wordLights('VICTORY', 155, 55, 26, 'neon', 0)).toEqual([]);
    expect(wordLights('VICTORY', 155, 55, 26, 'neon', Number.NaN)).toEqual([]);
    expect(wordLights('Victory', 155, 55, 26, 'neon')).toEqual([]);
  });

  test('a word is placed by the middle of its letters: the line round it is a pixel above them', () => {
    expect(wordTop(55, 26)).toBe(41);
    expect(wordTop(47, 28)).toBe(32);
    expect(wordTop(47, 25)).toBe(34);
    // Asked for at a height it is not written at, it is placed for the height it is written at.
    expect(wordTop(47, 99)).toBe(wordTop(47, 40));
  });
});

describe('the word a battle ends with', () => {
  function fight(enemies: string[], frail: number[], opts: BattleOptions = {}): BattleState {
    const state = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 7, opts);
    for (const i of frail) for (const part of Object.values(state.units[i + 1].parts)) if (part) part.ap = 1;
    return state;
  }
  /** A battle played to its result: won by shooting a turret that falls to anything, or lost by walking away. */
  function ended(won: boolean, opts: { fast?: boolean; calm?: boolean } = {}) {
    const flow = new BattleFlow(fight(['gun-turret'], won ? [0] : []), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: 'bg-nowhere', ...(opts.calm ? { calm: true } : {}) });
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    if (!won) {
      const menu = flow.menu.items.map((item) => item.id);
      for (let i = 0; i < menu.indexOf('retreat'); i++) screen.onInput('down');
      screen.onInput('confirm');
      screen.onInput('down');
      screen.onInput('confirm');
    }
    for (let i = 0; i < 6000 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
      screen.update(16);
    }
    expect(flow.phase).toBe('result');
    expect(flow.state.outcome).toBe(won ? 'victory' : 'defeat');
    return { flow, screen, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
  }
  const BOX = { x: (310 - RESULT_W) / 2, y: 30 };

  test('in both languages: in the sign\'s letters, the game\'s colour for one won and red for one lost, both as tall, inside the box', () => {
    expect([RESULT_W, RESULT_TALL, RESULT_SMALL, RESULT_WORD_Y]).toEqual([190, 26, 20, 25]);
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const talls: number[] = [];
      for (const won of [true, false]) {
        const { screen, page } = ended(won);
        screen.update(1000);
        const word = signIn(page(), won ? STRINGS.victory : STRINGS.defeat, won ? 'neon' : 'red')!;
        expect(word, `${language} ${won}`).not.toBeNull();
        talls.push(word.tall);
        expect(word.level).toBe(1);
        // Its middle where the font's word had its middle, and in the middle of the box.
        expect(word.middle).toBe(BOX.y + RESULT_WORD_Y);
        expect(Math.abs(word.x + word.w / 2 - 155)).toBeLessThanOrEqual(0.5);
        expect(word.x).toBeGreaterThanOrEqual(BOX.x + 8);
        expect(word.x + word.w).toBeLessThanOrEqual(BOX.x + RESULT_W - 8);
        expect(word.y).toBeGreaterThanOrEqual(BOX.y + 4);
        // Clear of the way on, which is written under it.
        const hint = page().texts.find((t) => t.text === STRINGS.hints.result)!;
        expect(hint).toBeDefined();
        expect(word.y + word.h).toBeLessThanOrEqual(hint.y + 2);
        expect(signCount(page())).toBe(1);
        expect(page().texts.some((t) => t.size === 32)).toBe(false);
      }
      // Both words of a language at one height: the one the longer of them fits at.
      expect(talls[0]).toBe(talls[1]);
      expect(talls[0]).toBe(Math.min(fitTall(STRINGS.victory, RESULT_W - 16, RESULT_TALL, RESULT_SMALL)!, fitTall(STRINGS.defeat, RESULT_W - 16, RESULT_TALL, RESULT_SMALL)!));
      expect(talls[0]).toBeGreaterThanOrEqual(RESULT_SMALL);
    }
    setLanguage('nl');
    // The Dutch for a battle won is the longer word: it is why the box is as wide as it is.
    expect(fitTall(STRINGS.victory, RESULT_W - 16, RESULT_TALL, RESULT_SMALL)).toBe(24);
    expect(fitTall(STRINGS.victory, 170 - 16, RESULT_TALL, RESULT_SMALL)).toBeLessThan(24);
  });

  test('it comes on like a tube as the result comes up, and lit it throws its colour on the box', () => {
    const { screen, page } = ended(true);
    const level = (): number => signIn(page(), 'VICTORY', 'neon')!.level;
    // How long the result has been up is counted from the frame it came up in.
    const seen: number[] = [];
    for (let ms = 0; ms < 400; ms += 16) { seen.push(level()); screen.update(16); }
    expect(seen[0]).toBe(0);
    expect(seen).toContain(1);
    expect(seen.filter((l) => l > 0 && l < 0.2).length).toBeGreaterThanOrEqual(3);
    expect(seen.slice(-3)).toEqual([1, 1, 1]);
    // Dark, it throws nothing; lit, a few lights in its own colour over the box, as strong as it is lit.
    const dark = ended(true);
    expect(lights(dark.page(), 'neon')).toEqual([]);
    dark.screen.update(1000);
    const thrown = lights(dark.page(), 'neon');
    expect(thrown).toHaveLength(wordLights('VICTORY', 155, 55, 26, 'neon').length);
    expect(thrown.length).toBeGreaterThanOrEqual(2);
    for (const light of thrown) {
      expect(light).toMatchObject({ y: BOX.y + RESULT_WORD_Y, r: 39 });
      expect(strength(light)).toBeCloseTo(WORD_GLOW, 3);
    }
    // The light is under the word, not over it.
    const page1 = dark.page();
    const own = lights(page1, 'neon');
    const firstRun = page1.order.findIndex((step) => step.kind === 'rect' && page1.rects[step.at].color === '#07061a' && page1.rects[step.at].h === 1);
    const lastLight = page1.order.map((step, i) => (step.kind === 'glow' && own.includes(page1.glows[step.at]) ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    expect(lastLight).toBeGreaterThan(-1);
    expect(lastLight).toBeLessThan(firstRun);
    // A battle lost throws red.
    const lost = ended(false);
    lost.screen.update(1000);
    expect(lights(lost.page(), 'red').length).toBeGreaterThanOrEqual(2);
    expect(lights(lost.page(), 'neon')).toEqual([]);
  });

  test('a calm picture has it on from the first frame, its light at half strength; a hurried game has it on at once', () => {
    const calm = ended(true, { calm: true });
    expect(signIn(calm.page(), 'VICTORY', 'neon')!.level).toBe(1);
    for (const light of lights(calm.page(), 'neon')) expect(strength(light)).toBeCloseTo(WORD_GLOW / 2, 3);
    expect(lights(calm.page(), 'neon').length).toBeGreaterThanOrEqual(2);
    const fast = ended(true, { fast: true });
    expect(signIn(fast.page(), 'VICTORY', 'neon')!.level).toBe(1);
  });

  test('with less light the word is the same and half its lights are thrown; with none, the word alone', () => {
    const { screen, page } = ended(true);
    screen.update(1000);
    const full = lights(page(), 'neon').length;
    setDetail(1);
    expect(signIn(page(), 'VICTORY', 'neon')).toMatchObject({ tall: 26, level: 1 });
    expect(lights(page(), 'neon')).toHaveLength(Math.ceil(full / 2));
    setDetail(0);
    expect(signIn(page(), 'VICTORY', 'neon')).toMatchObject({ tall: 26, level: 1 });
    expect(page().glows).toEqual([]);
  });

  test('a word the sign cannot write, or one too long for the box at the smallest a result is written, is written in the font where it always was', () => {
    // The second would fit if it were written smaller than a result ever is: it is not.
    const long = 'GEWONNEN DUS';
    expect(fitTall(long, RESULT_W - 16, RESULT_TALL, RESULT_SMALL)).toBeNull();
    expect(fitTall(long, RESULT_W - 16, RESULT_TALL)).not.toBeNull();
    for (const message of ['Victory', long]) {
      const { flow, page } = ended(true);
      (flow as unknown as { message: string }).message = message;
      const drawn = page();
      expect(signCount(drawn), message).toBe(0);
      expect(drawn.texts.find((t) => t.text === message), message).toMatchObject({ x: 155, y: 38, size: 32, align: 'center', color: COLORS.accent });
      expect(lights(drawn, 'neon'), message).toEqual([]);
    }
  });
});

describe('what a page of story is called', () => {
  const pages = SCENES.filter((s) => !s.talk);

  test('every page\'s title, in both languages, is one the sign writes, as tall as fits across the page', () => {
    expect([TITLE_Y, TITLE_TALL, TITLE_SMALL, TITLE_W]).toEqual([47, 28, 18, 294]);
    expect(pages.length).toBeGreaterThanOrEqual(8);
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      for (const page of pages) {
        const tall = fitTall(page.title, TITLE_W, TITLE_TALL, TITLE_SMALL);
        expect(tall, `${language}: ${page.title}`).not.toBeNull();
        expect(wordWidth(page.title, tall!), page.title).toBeLessThanOrEqual(TITLE_W);
      }
    }
    // A title longer than any there is now would be written smaller, down to the smallest a title is.
    expect(fitTall('RESERVESLEUTELS', TITLE_W, TITLE_TALL, TITLE_SMALL)).toBeLessThan(TITLE_TALL);
    expect(fitTall('RESERVESLEUTELS', TITLE_W, TITLE_TALL, TITLE_SMALL)).toBeGreaterThanOrEqual(TITLE_SMALL);
  });

  test('it is drawn in the game\'s colour round the middle of the page, between the heading and the words', () => {
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const app = appWith({ textSpeed: 'instant' });
      for (const page of pages) {
        const screen = new SceneScreen(app, page);
        screen.update(2000);
        const drawn = record((ctx) => screen.draw(ctx));
        const title = signIn(drawn, page.title, 'neon')!;
        expect(title, `${language}: ${page.title}`).not.toBeNull();
        expect(title).toMatchObject({ level: 1, middle: TITLE_Y, tall: fitTall(page.title, TITLE_W, TITLE_TALL, TITLE_SMALL) });
        expect(Math.abs(title.x + title.w / 2 - 155)).toBeLessThanOrEqual(0.5);
        expect(title.x).toBeGreaterThanOrEqual(8);
        expect(title.x + title.w).toBeLessThanOrEqual(302);
        // Under the heading's letters and over the first line of the page.
        const heading = drawn.texts.find((t) => t.text === page.heading);
        if (heading) expect(heading.y + 11).toBeLessThanOrEqual(title.y + 1);
        // (A page whose words all depend on what the pilot decided has none for a pilot who decided nothing.)
        const first = drawn.texts.filter((t) => t.y >= 60).sort((a, b) => a.y - b.y)[0];
        if (first) expect(first.y).toBeGreaterThanOrEqual(title.y + title.h + 10);
        expect(signCount(drawn)).toBe(1);
        expect(drawn.texts.some((t) => t.size === 32)).toBe(false);
      }
    }
  });

  test('it comes on like a tube as the page opens, with its light; a calm picture and a hurried game have it on at once', () => {
    const act = scene('act-1');
    const screen = new SceneScreen(appWith(), act);
    const at = (): { level: number; lights: number } => {
      const drawn = record((ctx) => screen.draw(ctx));
      return { level: signIn(drawn, act.title, 'neon')!.level, lights: lights(drawn, 'neon').length };
    };
    expect(at()).toEqual({ level: 0, lights: 0 });
    screen.update(90);
    expect(at().level).toBe(1);
    expect(at().lights).toBeGreaterThanOrEqual(2);
    screen.update(60);
    expect(at().level).toBeCloseTo(0.15, 9);
    screen.update(400);
    expect(at()).toEqual({ level: 1, lights: wordLights(act.title, 155, TITLE_Y, 28, 'neon').length });
    const calm = record((ctx) => new SceneScreen(appWith({ calm: true }), act).draw(ctx));
    expect(signIn(calm, act.title, 'neon')!.level).toBe(1);
    for (const light of lights(calm, 'neon')) expect(strength(light)).toBeCloseTo(WORD_GLOW / 2, 3);
    const fast = record((ctx) => new SceneScreen(appWith({}, true), act).draw(ctx));
    expect(signIn(fast, act.title, 'neon')!.level).toBe(1);
  });

  test('a title the sign cannot write, or one too long for the page at the smallest a title is written, is written in the font where it always was', () => {
    const app = appWith({ textSpeed: 'instant' });
    // The last would fit across the page if it were written smaller than a title ever is: it is not.
    const tight = 'THE LONGEST OF TITLES YET';
    expect(fitTall(tight, TITLE_W, TITLE_TALL, TITLE_SMALL)).toBeNull();
    expect(fitTall(tight, TITLE_W, TITLE_TALL)).not.toBeNull();
    for (const title of ['The Wage', 'A VERY LONG TITLE THAT GOES ON AND ON', tight]) {
      const screen = new SceneScreen(app, { ...scene('act-1'), title });
      screen.update(2000);
      const drawn = record((ctx) => screen.draw(ctx));
      expect(signCount(drawn), title).toBe(0);
      const written = drawn.texts.filter((t) => t.text === title);
      expect(written.map((t) => [t.x, t.y, t.size, t.color]), title).toEqual([[156, 31, 32, '#3b1d5a'], [155, 30, 32, COLORS.accent]]);
      expect(lights(drawn, 'neon')).toEqual([]);
    }
    expect(fitTall('A VERY LONG TITLE THAT GOES ON AND ON', TITLE_W, TITLE_TALL, TITLE_SMALL)).toBeNull();
  });
});

describe('what a conversation is called', () => {
  const talks = SCENES.filter((s) => s.talk);

  test('every conversation\'s title, in both languages, is one the sign writes, and it is written under the heading', () => {
    expect([TALK_TITLE_Y, TALK_TITLE_TALL, TALK_TITLE_W]).toEqual([31, 16, 290]);
    expect(talks.length).toBeGreaterThanOrEqual(5);
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const app = appWith();
      for (const talk of talks) {
        const drawn = record((ctx) => new TalkScreen(app, talk).draw(ctx));
        const title = signIn(drawn, talk.title, 'neon')!;
        expect(title, `${language}: ${talk.title}`).not.toBeNull();
        expect(title).toMatchObject({ level: 1, middle: TALK_TITLE_Y, tall: fitTall(talk.title, TALK_TITLE_W, TALK_TITLE_TALL) });
        expect(title.tall).toBeGreaterThanOrEqual(14);
        expect(Math.abs(title.x + title.w / 2 - 155)).toBeLessThanOrEqual(0.5);
        expect(title.x).toBeGreaterThanOrEqual(8);
        expect(title.x + title.w).toBeLessThanOrEqual(302);
        const heading = drawn.texts.find((t) => t.text === talk.heading);
        if (heading) expect(heading.y + 11).toBeLessThanOrEqual(title.y + 1);
        // Well clear of the box what is said is written in.
        expect(title.y + title.h).toBeLessThan(60);
        expect(signCount(drawn)).toBe(1);
        expect(drawn.texts.some((t) => t.size === 16)).toBe(false);
      }
    }
    expect(wordHeight(TALK_TITLE_TALL)).toBe(19);
  });

  test('a title the sign cannot write, or one wider than the screen has room for, is written in the font where it always was', () => {
    const long = 'A CONVERSATION WITH A VERY LONG NAME INDEED';
    expect(fitTall(long, TALK_TITLE_W, TALK_TITLE_TALL)).toBeNull();
    expect(fitTall(long, 9999, TALK_TITLE_TALL)).toBe(TALK_TITLE_TALL);
    for (const title of ['New licence', long]) {
      const drawn = record((ctx) => new TalkScreen(appWith(), { ...talks[0], title }).draw(ctx));
      expect(signCount(drawn), title).toBe(0);
      expect(drawn.texts.find((t) => t.text === title), title).toMatchObject({ x: 155, y: 22, size: 16, align: 'center', color: COLORS.accent });
    }
  });
});
