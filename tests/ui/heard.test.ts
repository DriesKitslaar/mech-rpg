import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { HUSH } from '../../src/platform/music';
import { SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { setDetail } from '../../src/ui/light';
import { SIGN_STRIKES, logoLevel, signStrikes } from '../../src/ui/logo';
import type { SpriteStore } from '../../src/ui/sprites';
import { LIGHTNING_MS, THUNDER_AFTER_MS, lightning, strokeBegan } from '../../src/ui/weather';
import { done, ids, inHub, memoryStore, press, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';

/**
 * What the last round made to be seen and left silent now has something to be heard by: thunder
 * with lightning, the sign striking as it comes on, and a slam, with the music turned down, as the
 * last machine of a battle is hit.
 */

afterEach(() => setDetail(2));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const HOUR = 3_600_000;
/** How many strokes of lightning begin in so much time, in frames of this length. */
const strokes = (ms: number, frame: number, calm = false): number => {
  let n = 0;
  for (let now = frame; now <= ms; now += frame) if (strokeBegan(now - frame, now, calm)) n++;
  return n;
};
interface Heard { name: string; delay: number; ambient: boolean; at: number }

describe('when a stroke of lightning begins', () => {
  test('once in every stretch of time, in the frame it is first seen, however long the frames are', () => {
    for (const frame of [16, 33.4, 100]) {
      let began = 0;
      for (let now = frame; now <= HOUR; now += frame) {
        if (!strokeBegan(now - frame, now)) continue;
        began++;
        // Nothing was seen in the frame before, and it is seen in this one.
        expect(lightning(now - frame), `${frame} ms frames, at ${now}`).toBe(0);
        expect(lightning(now), `${frame} ms frames, at ${now}`).toBeGreaterThan(0);
        if (frame < 70) expect(lightning(now)).toBe(1);
      }
      expect(began, `${frame} ms frames`).toBe(Math.ceil(HOUR / LIGHTNING_MS));
    }
  });

  test('time that passes in one go has the strokes that fell in it', () => {
    expect(strokeBegan(0, LIGHTNING_MS)).toBe(true);
    expect(strokeBegan(0, LIGHTNING_MS * 3)).toBe(true);
    expect(strokeBegan(LIGHTNING_MS * 4, LIGHTNING_MS * 5)).toBe(true);
    // The first second and a half of every stretch has none.
    for (let stretch = 0; stretch < 50; stretch++) expect(strokeBegan(stretch * LIGHTNING_MS, stretch * LIGHTNING_MS + 1499)).toBe(false);
  });

  test('never in a calm picture, never where no soft light is drawn, and never for a clock that does not go forward', () => {
    expect(strokes(HOUR / 6, 16, true)).toBe(0);
    setDetail(0);
    expect(strokes(HOUR / 6, 16)).toBe(0);
    // With less light there is still lightning, and so thunder.
    setDetail(1);
    expect(strokes(HOUR / 6, 16)).toBe(Math.ceil(HOUR / 6 / LIGHTNING_MS));
    setDetail(2);
    for (let now = 0; now < LIGHTNING_MS * 3; now += 10) {
      expect(strokeBegan(now, now)).toBe(false);
      expect(strokeBegan(now + 300, now)).toBe(false);
    }
    expect(strokeBegan(Number.NaN, 5000)).toBe(false);
    expect(strokeBegan(0, Number.NaN)).toBe(false);
  });
});

describe('when the sign strikes', () => {
  test('twice as it comes on: each time it goes from dark to lit', () => {
    expect(SIGN_STRIKES).toEqual([300, 520]);
    for (const at of SIGN_STRIKES) {
      expect(logoLevel(at - 1)).toBe(0);
      expect(logoLevel(at)).toBeGreaterThan(0.5);
    }
    expect(signStrikes(0, 2000)).toBe(2);
    expect(signStrikes(0, 299)).toBe(0);
    expect(signStrikes(299, 300)).toBe(1);
    expect(signStrikes(300, 301)).toBe(0);
    expect(signStrikes(300, 520)).toBe(1);
    expect(signStrikes(520, 60_000)).toBe(0);
    expect(signStrikes(500, 500)).toBe(0);
    expect(signStrikes(600, 200)).toBe(0);
  });

  test('a calm picture has the sign simply on: nothing strikes', () => {
    expect(signStrikes(0, 2000, true)).toBe(0);
  });
});

describe('the title', () => {
  function title(opts: { fast?: boolean; calm?: boolean } = {}) {
    const heard: Heard[] = [];
    let clock = 0;
    const sfx = { muted: false, unlock() {}, play: (name: string, delay = 0, ambient = false) => { heard.push({ name, delay, ambient, at: clock }); } };
    const kept: Record<string, string> = opts.calm ? { [SETTINGS_KEY]: JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', calm: true }) } : {};
    const app = new App({ catalog: CATALOG, save: new SaveFile(memoryStore(kept), CATALOG), sprites, fast: opts.fast ?? false, seed: 3, sfx: sfx as never });
    const run = (ms: number, frame = 16): void => { for (let t = 0; t < ms; t += frame) { clock += frame; app.update(frame); } };
    return { app, heard, run, named: (name: string) => heard.filter((h) => h.name === name) };
  }

  test('the sign is heard to strike twice as it comes on, in the frames it is seen to, and is silent after', () => {
    const { heard, run, named } = title();
    run(2000);
    expect(heard).toEqual([{ name: 'sign', delay: 0, ambient: true, at: 304 }, { name: 'sign', delay: 0, ambient: true, at: 528 }]);
    run(120_000);
    expect(named('sign')).toHaveLength(2);
  });

  test('thunder follows every stroke of lightning over the city, a moment after it', () => {
    expect(THUNDER_AFTER_MS).toBeGreaterThanOrEqual(200);
    expect(THUNDER_AFTER_MS).toBeLessThanOrEqual(800);
    const { run, named } = title();
    run(120_000);
    const thunder = named('thunder');
    expect(thunder).toHaveLength(strokes(120_000, 16));
    expect(thunder.length).toBeGreaterThanOrEqual(12);
    for (const clap of thunder) {
      expect(clap).toMatchObject({ delay: THUNDER_AFTER_MS, ambient: true });
      // Asked for in the frame the stroke is first seen.
      expect(lightning(clap.at)).toBe(1);
      expect(lightning(clap.at - 16)).toBe(0);
    }
    // Never two at once: there is more time between two than one lasts.
    for (let i = 1; i < thunder.length; i++) expect(thunder[i].at - thunder[i - 1].at).toBeGreaterThan(3000);
  });

  test('back on the title from the options: the sign is on already and says nothing, and the weather goes on from where it was', () => {
    const { app, heard, run, named } = title();
    run(1000);
    expect(named('sign')).toHaveLength(2);
    select(app, 'options');
    run(5000);
    expect(heard).toHaveLength(2);
    press(app, 'cancel');
    expect(snap(app).screen).toBe('title');
    // The sign does not come on a second time.
    run(1000);
    expect(named('sign')).toHaveLength(2);
    expect(named('thunder')).toEqual([]);
    // The title has been looked at for two seconds in all: its first stroke falls when that is two and two thirds,
    // which is less than a second from now, and not two and two thirds after coming back.
    run(1000);
    expect(named('thunder')).toHaveLength(1);
    expect(named('thunder')[0].at).toBeLessThan(1000 + 5000 + 2000);
  });

  test('the stroke a clap belongs to is on the screen: the sky is lit in the frame the thunder is asked for, and was not in the frame before', () => {
    const { app, heard, run } = title();
    const lit = (): boolean => record((ctx) => app.draw(ctx)).rects.some((r) => r.blend === 'overlay');
    let was = false;
    let claps = 0;
    for (let i = 0; i < 45_000 / 16; i++) {
      const had = heard.length;
      run(16);
      const now = lit();
      if (heard.slice(had).some((h) => h.name === 'thunder')) {
        claps++;
        expect([was, now], `clap ${claps}`).toEqual([false, true]);
      }
      was = now;
    }
    expect(claps).toBeGreaterThanOrEqual(4);
  });

  test('a calm picture hears neither, and a hurried game neither', () => {
    for (const opts of [{ calm: true }, { fast: true }]) {
      const { heard, run } = title(opts);
      run(60_000);
      expect(heard, JSON.stringify(opts)).toEqual([]);
    }
  });

  test('where no soft light is drawn the sign still strikes, but there is no lightning to hear', () => {
    const { heard, run } = title();
    setDetail(0);
    run(60_000);
    expect(heard.map((h) => h.name)).toEqual(['sign', 'sign']);
  });

  test('a title that is not on screen is not heard', () => {
    const { app, heard, run } = title();
    run(1000);
    select(app, 'options');
    const before = heard.length;
    run(60_000);
    expect(heard.slice(before).filter((h) => h.name === 'thunder' || h.name === 'sign')).toEqual([]);
    // Back on the title, the weather goes on.
    press(app, 'cancel');
    expect(snap(app).screen).toBe('title');
    run(60_000);
    expect(heard.slice(before).filter((h) => h.name === 'thunder').length).toBeGreaterThan(3);
  });
});

describe('a battle in the rain', () => {
  function battle(background: string, opts: { fast?: boolean; calm?: boolean; speed?: number } = {}) {
    const heard: Heard[] = [];
    let clock = 0;
    const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, {
      fast: opts.fast ?? false, background, ...(opts.calm ? { calm: true } : {}), ...(opts.speed ? { speed: opts.speed } : {}),
      sfx: { play: (name: string, delay = 0, ambient = false) => { heard.push({ name, delay, ambient, at: clock }); } } as never,
    });
    const run = (ms: number): void => { for (let t = 0; t < ms; t += 16) { clock += 16; screen.update(16); } };
    return { run, screen, heard, thunder: () => heard.filter((h) => h.name === 'thunder') };
  }

  test('the stroke a clap belongs to is on the field: lit in the frame the thunder is asked for, and not in the frame before', () => {
    const { run, screen, heard } = battle('bg-neon-district');
    const lit = (): boolean => record((ctx) => screen.draw(ctx)).rects.some((r) => r.blend === 'overlay');
    let was = false;
    let claps = 0;
    for (let i = 0; i < 45_000 / 16; i++) {
      const had = heard.length;
      run(16);
      const now = lit();
      if (heard.slice(had).some((h) => h.name === 'thunder')) {
        claps++;
        expect([was, now], `clap ${claps}`).toEqual([false, true]);
      }
      was = now;
    }
    expect(claps).toBeGreaterThanOrEqual(4);
  });

  test('thunder follows the lightning that is seen there, from the banner on', () => {
    const { run, thunder } = battle('bg-neon-district');
    run(90_000);
    expect(thunder()).toHaveLength(strokes(90_000, 16));
    expect(thunder().length).toBeGreaterThanOrEqual(9);
    for (const clap of thunder()) {
      expect(clap).toMatchObject({ delay: THUNDER_AFTER_MS, ambient: true });
      expect(lightning(clap.at)).toBe(1);
    }
    // The first stretch's stroke can fall while the banner is still up: it is seen then, and heard.
    expect(thunder()[0].at).toBeLessThan(LIGHTNING_MS);
  });

  test('with battles played faster the weather keeps its own time, and so does its thunder', () => {
    const { run, thunder } = battle('bg-neon-district', { speed: 2.5 });
    run(90_000);
    expect(thunder()).toHaveLength(strokes(90_000, 16));
  });

  test('no thunder where it does not rain, in a calm picture, in a hurried game, or where no soft light is drawn', () => {
    for (const ground of ['bg-foundry', 'bg-mine', 'bg-arena', 'bg-vault', 'bg-nowhere']) {
      const { run, thunder } = battle(ground);
      run(60_000);
      expect(thunder(), ground).toEqual([]);
    }
    for (const opts of [{ calm: true }, { fast: true }]) {
      const { run, thunder } = battle('bg-neon-district', opts);
      run(60_000);
      expect(thunder(), JSON.stringify(opts)).toEqual([]);
    }
    const bare = battle('bg-neon-district');
    setDetail(0);
    bare.run(60_000);
    expect(bare.thunder()).toEqual([]);
  });
});

describe('the music while the last machine is looked at', () => {
  test('it is turned down for as long as the close look lasts, and is back for what comes after', () => {
    expect(HUSH).toBeGreaterThanOrEqual(0.25);
    expect(HUSH).toBeLessThanOrEqual(0.5);
    const music = { enabled: true, tense: false, hush: 1, play: () => undefined };
    // Every page of story is behind this pilot: nothing stands between the title and the hub.
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), scenes: SCENES.map((scene) => scene.id) }, 5, { fast: false, music: music as never, sprites });
    expect(music.hush).toBe(1);
    select(app, 'contracts');
    select(app, ids(app).find((id) => id !== 'back')!);
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    // The battle is played a frame at a time; how loud the music is to be is written down after each.
    const levels: number[] = [];
    for (let i = 0; i < 60_000 && snap(app).battle?.phase !== 'result'; i++) {
      const s = snap(app);
      if (s.battle!.phase === 'animating') { app.update(16); levels.push(music.hush); }
      else if (s.battle!.phase === 'action') press(app, s.menu.items[0].enabled ? 'confirm' : 'cancel');
      else press(app, 'confirm');
    }
    expect(snap(app).battle?.phase).toBe('result');
    const down = levels.filter((level) => level !== 1);
    expect(new Set(down)).toEqual(new Set([HUSH]));
    // One stretch of it, at the end: from the blow to the end of the look, near enough a second.
    const from = levels.indexOf(HUSH);
    expect(levels.slice(from, from + down.length).every((level) => level === HUSH)).toBe(true);
    expect(down.length).toBeGreaterThanOrEqual(40);
    expect(down.length).toBeLessThanOrEqual(110);
    // With the result up the music is itself again, and stays so.
    for (let i = 0; i < 30; i++) { app.update(16); expect(music.hush).toBe(1); }
    press(app, 'confirm');
    app.update(16);
    expect(music.hush).toBe(1);
  });

  test('a hurried game stages nothing, and its music is never turned down', () => {
    const music = { enabled: true, tense: false, hush: 1, play: () => undefined };
    const { app } = inHub(strong(done('intro-1', 'intro-2')), 5, { fast: true, music: music as never, sprites });
    select(app, 'contracts');
    select(app, ids(app).find((id) => id !== 'back')!);
    select(app, 'accept');
    for (let i = 0; i < 60_000 && snap(app).battle?.phase !== 'result'; i++) {
      const s = snap(app);
      if (s.battle!.phase === 'animating') app.update(16);
      else if (s.battle!.phase === 'action') press(app, s.menu.items[0].enabled ? 'confirm' : 'cancel');
      else press(app, 'confirm');
      expect(music.hush).toBe(1);
    }
    expect(snap(app).battle?.phase).toBe('result');
  });
});
