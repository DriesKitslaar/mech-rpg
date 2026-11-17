import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, WARNING_MS } from '../../src/ui/battleScreen';
import {
  ENTRANCE_H, ENTRANCE_NAME_TALL, ENTRANCE_SCALE, ENTRANCE_WARNING_TALL, ENTRANCE_WINDOW_X, ENTRANCE_WORDS_W, EYE_OPENS_AT, EYE_OPENS_FOR, MECH_HEAD,
  drawEntrance, entranceEye, entranceShift, type Entrant,
} from '../../src/ui/cinema';
import { EYES } from '../../src/ui/eyes';
import { setDetail } from '../../src/ui/light';
import { MECH_BOX } from '../../src/ui/mechLayout';
import { fitTall, forgetWords } from '../../src/ui/signType';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { record, signCount, signIn, type Drawn, type Filled, type Glowed } from '../helpers/canvas';

/**
 * A boss comes in on a band of its own: from its side of the field, with the warning and its name
 * in the sign's letters at the left, and at the right a window on the boss itself at twice its
 * size, looked at where its eye is; and the eye opens.
 */

afterEach(() => { setLanguage('en'); setDetail(2); forgetWords(); });

const FIELD = { top: 14, height: 164, width: 310 };
const PLATE = 'rgba(8, 8, 20, 0.92)';
const TOP = 58;
const MIDDLE = 92;
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
const plate = (page: Drawn): Filled => page.rects.find((r) => r.color === PLATE)!;
/** A boss that is one picture, 136 by 115, with an eye. */
const picture = { id: 'the boss' };
const KING: Entrant = {
  draw: (ctx) => ctx.drawImage(picture as unknown as CanvasImageSource, 0, 0, 136, 115),
  focus: { x: 52, y: 42 }, eye: { r: 10, color: '#f2bf1e' },
};
const WORDS = { warning: 'WARNING', name: 'SCRAP KING', alarm: true };
const band = (share: number, boss: Entrant | null = KING, calm = false, clock = 1000, words = WORDS): Drawn => record((ctx) => drawEntrance(ctx, share, clock, FIELD, words, boss, calm));

describe('the band a boss comes in on', () => {
  test('it comes in from the right, holds, and leaves to the left: the other way from a contract\'s banner', () => {
    expect(entranceShift(0, 310)).toBe(310);
    expect(entranceShift(0.08, 310)).toBe(155);
    expect(entranceShift(0.16, 310)).toBe(0);
    for (let share = 0.16; share <= 0.88; share += 0.04) expect(entranceShift(share, 310)).toBe(0);
    expect(entranceShift(0.94, 310)).toBe(-155);
    expect(entranceShift(1, 310)).toBe(-310);
    // Never back the way it came.
    for (let share = 0.01; share <= 1; share += 0.01) expect(entranceShift(share, 310)).toBeLessThanOrEqual(entranceShift(share - 0.01, 310));
  });

  test('a dark plate across the middle of the field, as tall as the Overdrive\'s band, with hazard stripes running along both edges', () => {
    expect([ENTRANCE_H, ENTRANCE_WINDOW_X, ENTRANCE_SCALE]).toEqual([68, 164, 2]);
    const page = band(0.5);
    expect(plate(page)).toMatchObject({ x: 0, y: TOP, w: 310, h: ENTRANCE_H });
    expect(TOP + ENTRANCE_H / 2).toBe(MIDDLE);
    const stripes = page.rects.filter((r) => r.color === COLORS.danger && r.w === 8 && r.h === 3);
    const top = stripes.filter((r) => r.y === TOP);
    const bottom = stripes.filter((r) => r.y === TOP + ENTRANCE_H - 3);
    expect(top.length + bottom.length).toBe(stripes.length);
    expect(top.length).toBeGreaterThanOrEqual(20);
    expect(bottom.length).toBe(top.length);
    // Sixteen pixels from one to the next, and they cover the band from end to end.
    const xs = top.map((r) => r.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBe(16);
    expect(xs[0]).toBeLessThanOrEqual(0);
    expect(xs.at(-1)! + 8).toBeGreaterThanOrEqual(310);
    // Along the top they run one way, along the bottom the other.
    const at = (clock: number, y: number): number => Math.min(...band(0.5, KING, false, clock).rects.filter((r) => r.color === COLORS.danger && r.w === 8 && r.y === y).map((r) => r.x));
    expect(at(1040, TOP) - at(1000, TOP)).toBe(1);
    expect(at(1040, TOP + ENTRANCE_H - 3) - at(1000, TOP + ENTRANCE_H - 3)).toBe(-1);
    // Everything of the band is inside it.
    for (const r of page.rects) {
      expect(r.y).toBeGreaterThanOrEqual(TOP);
      expect(r.y + r.h).toBeLessThanOrEqual(TOP + ENTRANCE_H);
    }
  });

  test('the whole of it moves together: the plate, the stripes, the words and the window', () => {
    for (const share of [0.04, 0.1, 0.95]) {
      const page = band(share);
      const shift = entranceShift(share, 310);
      expect(shift).not.toBe(0);
      expect(plate(page).x).toBe(shift);
      const warning = signIn(page, 'WARNING', 'red')!;
      expect(Math.abs(warning.x + warning.w / 2 - (shift + ENTRANCE_WINDOW_X / 2))).toBeLessThanOrEqual(0.5);
      const boss = page.images.find((image) => image.image === picture)!;
      expect(boss.clip).toMatchObject({ x: shift + ENTRANCE_WINDOW_X, y: TOP, w: 310 - ENTRANCE_WINDOW_X, h: ENTRANCE_H });
      const edge = page.rects.find((r) => r.color === COLORS.danger && r.w === 1 && r.h === ENTRANCE_H)!;
      expect(edge.x).toBe(shift + ENTRANCE_WINDOW_X);
    }
  });
});

describe('the window on the boss', () => {
  test('the boss at twice its size, nothing of it outside the window, and what it is looked at by in the window\'s middle', () => {
    const page = band(0.5);
    const boss = page.images.find((image) => image.image === picture)!;
    expect(boss).toMatchObject({ w: 136 * ENTRANCE_SCALE, h: 115 * ENTRANCE_SCALE });
    expect(boss.clip).toEqual({ x: ENTRANCE_WINDOW_X, y: TOP, w: 146, h: ENTRANCE_H });
    // Its eye, at 52, 42 on its picture, is brought to the middle of the window's height, and to within a few pixels of the middle of its width.
    expect(boss.y + 42 * ENTRANCE_SCALE).toBe(MIDDLE);
    const eyeX = boss.x + 52 * ENTRANCE_SCALE;
    expect(Math.abs(eyeX - (ENTRANCE_WINDOW_X + 73))).toBeLessThanOrEqual(6);
    // The window has a ground of its own, dark red, under the boss, and a red edge at its left.
    const ground = page.rects.find((r) => r.color === 'rgba(40, 8, 14, 0.9)')!;
    expect(ground).toMatchObject({ x: ENTRANCE_WINDOW_X, y: TOP, w: 146, h: ENTRANCE_H });
    expect(page.order.findIndex((s) => s.kind === 'rect' && page.rects[s.at] === ground)).toBeLessThan(page.order.findIndex((s) => s.kind === 'image' && page.images[s.at] === boss));
    expect(page.rects.find((r) => r.color === COLORS.danger && r.w === 1 && r.h === ENTRANCE_H)).toMatchObject({ x: ENTRANCE_WINDOW_X, y: TOP });
    // The stripes run over the boss, not under it.
    const lastStripe = page.order.map((s, i) => (s.kind === 'rect' && page.rects[s.at].w === 8 && page.rects[s.at].h === 3 ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    expect(lastStripe).toBeGreaterThan(page.order.findIndex((s) => s.kind === 'image'));
  });

  test('it comes in a little behind the band and then drifts on slowly, never back', () => {
    const xOf = (share: number): number => band(share).images.find((image) => image.image === picture)!.x - entranceShift(share, 310);
    // Behind at first, by as much as thirty-six pixels; caught up by three tenths of the way through.
    expect(xOf(0)).toBe(xOf(0.3) + 36 + 2);
    expect(xOf(0.15)).toBeGreaterThan(xOf(0.3));
    for (let share = 0.02; share <= 1; share += 0.02) expect(xOf(share)).toBeLessThanOrEqual(xOf(share - 0.02));
    // After that six pixels in all, to the left.
    expect(xOf(0.3) - xOf(1)).toBe(4);
    expect(xOf(0) - xOf(1)).toBe(42);
  });

  test('its eye opens: shut at first, open in a blink a fifth of the way through, and then holding with a slow swell', () => {
    expect([EYE_OPENS_AT, EYE_OPENS_FOR]).toEqual([0.2, 0.1]);
    expect(entranceEye(0, 0)).toBe(0);
    expect(entranceEye(0.19, 500)).toBe(0);
    expect(entranceEye(0.25, 0)).toBeCloseTo(0.4, 9);
    expect(entranceEye(0.3, 0)).toBeCloseTo(0.8, 9);
    for (let clock = 0; clock < 3000; clock += 30) {
      expect(entranceEye(0.6, clock)).toBeGreaterThanOrEqual(0.6);
      expect(entranceEye(0.6, clock)).toBeLessThanOrEqual(1);
    }
    expect(entranceEye(0.6, 100)).not.toBe(entranceEye(0.6, 400));
    // A calm picture has it simply open, from the start.
    expect([entranceEye(0, 0, true), entranceEye(0.25, 123, true), entranceEye(0.9, 999, true)]).toEqual([1, 1, 1]);
  });

  test('the light of its eye sits on the eye, in the eye\'s colour, and is as strong as the eye is open', () => {
    expect(band(0.1).glows).toEqual([]);
    const page = band(0.5);
    const boss = page.images.find((image) => image.image === picture)!;
    expect(page.glows.filter(isLight)).toHaveLength(1);
    const eye = page.glows[0];
    expect(eye).toMatchObject({ x: boss.x + 52 * ENTRANCE_SCALE, y: MIDDLE, r: 10 * ENTRANCE_SCALE + 10 });
    expect(eye.stops[0][1]).toMatch(/^rgba\(242, 191, 30, /);
    expect(strength(eye)).toBeCloseTo(0.6 * entranceEye(0.5, 1000), 2);
    // Over the boss, under the stripes and the words.
    expect(page.order.findIndex((s) => s.kind === 'glow')).toBeGreaterThan(page.order.findIndex((s) => s.kind === 'image'));
    // A calm picture has it steady and at half strength, from the first moment the eye is in the window.
    const calm = band(0.5, KING, true);
    expect(strength(calm.glows[0])).toBeCloseTo(0.3, 3);
    expect(strength(band(0.5, KING, true, 1300).glows[0])).toBeCloseTo(0.3, 3);
    // Where no soft light is drawn there is none, and the window is as it was.
    setDetail(0);
    const bare = band(0.5);
    expect(bare.glows).toEqual([]);
    expect(bare.images).toHaveLength(1);
    expect(bare.rects).toEqual(page.rects);
  });

  test('a boss whose eye is not known is looked at where its head is, and no light is put there', () => {
    const frame: Entrant = { draw: (ctx) => ctx.drawImage(picture as unknown as CanvasImageSource, 0, 0, 160, 160), focus: { x: 77, y: 27 }, eye: null };
    const page = band(0.5, frame);
    const boss = page.images.find((image) => image.image === picture)!;
    expect(boss.y + 27 * ENTRANCE_SCALE).toBe(MIDDLE);
    expect(Math.abs(boss.x + 77 * ENTRANCE_SCALE - (ENTRANCE_WINDOW_X + 73))).toBeLessThanOrEqual(6);
    expect(page.glows).toEqual([]);
  });

  test('what was changed to draw the boss is put back: what comes after is drawn where it is asked for', () => {
    const page = record((ctx) => { drawEntrance(ctx, 0.5, 1000, FIELD, WORDS, KING); ctx.fillRect(3, 4, 5, 6); });
    expect(page.rects.at(-1)).toMatchObject({ x: 3, y: 4, w: 5, h: 6 });
  });
});

describe('the words on the band', () => {
  const bosses = [...new Set(Object.values(ENEMIES).filter((enemy) => (enemy.phases?.length ?? 0) > 0).map((enemy) => enemy.name.toUpperCase()))];

  test('the warning, red and amber by turns, and under it the boss\'s name in steel: both at the left, clear of the stripes and of each other', () => {
    expect([ENTRANCE_WARNING_TALL, ENTRANCE_NAME_TALL, ENTRANCE_WORDS_W]).toEqual([23, 18, 148]);
    const page = band(0.5);
    const warning = signIn(page, 'WARNING', 'red')!;
    expect(warning).toMatchObject({ tall: 23, level: 1, y: TOP + 8 });
    expect(Math.abs(warning.x + warning.w / 2 - ENTRANCE_WINDOW_X / 2)).toBeLessThanOrEqual(0.5);
    const name = signIn(page, 'SCRAP KING', 'steel')!;
    expect(name).toMatchObject({ tall: fitTall('SCRAP KING', ENTRANCE_WORDS_W, ENTRANCE_NAME_TALL), level: 1, middle: TOP + 50 });
    expect(Math.abs(name.x + name.w / 2 - ENTRANCE_WINDOW_X / 2)).toBeLessThanOrEqual(0.5);
    // Under the stripes along the top, over the ones along the bottom, the one over the other, and left of the window.
    expect(warning.y).toBeGreaterThanOrEqual(TOP + 4);
    expect(warning.y + warning.h).toBeLessThanOrEqual(name.y);
    expect(name.y + name.h).toBeLessThanOrEqual(TOP + ENTRANCE_H - 4);
    for (const word of [warning, name]) {
      expect(word.x).toBeGreaterThanOrEqual(8);
      expect(word.x + word.w).toBeLessThanOrEqual(ENTRANCE_WINDOW_X - 8);
    }
    expect(signCount(page)).toBe(2);
    // The other of its two colours.
    const other = band(0.5, KING, false, 1000, { ...WORDS, alarm: false });
    expect(signIn(other, 'WARNING', 'amber')).toMatchObject({ y: TOP + 8, tall: 23 });
    expect(signIn(other, 'WARNING', 'red')).toBeNull();
  });

  test('every boss there is has a name the sign writes beside its window, and the warning fits there in both languages', () => {
    expect(bosses.length).toBeGreaterThanOrEqual(10);
    for (const name of bosses) {
      const tall = fitTall(name, ENTRANCE_WORDS_W, ENTRANCE_NAME_TALL);
      expect(tall, name).not.toBeNull();
      const page = band(0.5, KING, false, 1000, { ...WORDS, name });
      const found = signIn(page, name, 'steel')!;
      expect(found, name).not.toBeNull();
      expect(found.x, name).toBeGreaterThanOrEqual(8);
      expect(found.x + found.w, name).toBeLessThanOrEqual(ENTRANCE_WINDOW_X - 8);
    }
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      expect(fitTall(STRINGS.battleIntro.warning, ENTRANCE_WORDS_W, ENTRANCE_WARNING_TALL), language).toBe(ENTRANCE_WARNING_TALL);
    }
  });

  test('where there is no boss to show the words have the whole band', () => {
    const page = band(0.5, null);
    expect(page.images).toEqual([]);
    expect(page.rects.some((r) => r.color === 'rgba(40, 8, 14, 0.9)')).toBe(false);
    for (const [text, metal] of [['WARNING', 'red'], ['SCRAP KING', 'steel']] as const) {
      const word = signIn(page, text, metal)!;
      expect(Math.abs(word.x + word.w / 2 - 155)).toBeLessThanOrEqual(0.5);
    }
    // And a name too long for the room beside a window is written in the sign's letters all the same.
    const long = 'COLOSSUS JUGGERNAUT';
    expect(fitTall(long, ENTRANCE_WORDS_W, ENTRANCE_NAME_TALL)).toBeNull();
    expect(signIn(band(0.5, null, false, 1000, { ...WORDS, name: long }), long, 'steel')).not.toBeNull();
  });

  test('words the sign cannot write, or that do not fit beside the window, are written in the font', () => {
    const odd = band(0.5, KING, false, 1000, { warning: 'Warning', name: 'Scrap King', alarm: true });
    expect(signCount(odd)).toBe(0);
    expect(odd.texts.find((t) => t.text === 'Warning')).toMatchObject({ x: ENTRANCE_WINDOW_X / 2, y: TOP + 6, size: 32, align: 'center', color: COLORS.danger });
    expect(odd.texts.find((t) => t.text === 'Scrap King')).toMatchObject({ x: ENTRANCE_WINDOW_X / 2, y: TOP + 44, size: 12, align: 'center' });
    expect(band(0.5, KING, false, 1000, { warning: 'Warning', name: 'X', alarm: false }).texts.find((t) => t.text === 'Warning')!.color).toBe(COLORS.heat);
    const long = band(0.5, KING, false, 1000, { ...WORDS, name: 'COLOSSUS JUGGERNAUT' });
    expect(signIn(long, 'COLOSSUS JUGGERNAUT', 'steel')).toBeNull();
    expect(long.texts.find((t) => t.text === 'COLOSSUS JUGGERNAUT')).toMatchObject({ x: ENTRANCE_WINDOW_X / 2, y: TOP + 44 });
    // The warning is still the sign's.
    expect(signIn(long, 'WARNING', 'red')).not.toBeNull();
  });
});

describe('a battle against a boss', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  function against(id: string, opts: { fast?: boolean; calm?: boolean; boss?: string } = {}) {
    const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES[id]], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, boss: opts.boss ?? ENEMIES[id].name, ...(opts.calm ? { calm: true } : {}) });
    return { flow, screen, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
  }

  test('a great machine comes in on its band: its picture in the window at twice its size, its eye where its eye is', () => {
    const { screen, page } = against('scrap-king');
    screen.update(WARNING_MS / 2);
    const drawn = page();
    expect(plate(drawn)).toMatchObject({ x: 0, y: TOP, w: 310, h: ENTRANCE_H });
    // The picture is on the field, at its own size, and once more in the window at twice that.
    const pictures = drawn.images.filter((image) => (image.image as { id: string }).id === 'boss-scrap-king');
    expect(pictures).toHaveLength(2);
    const [small, large] = pictures;
    expect([large.w, large.h]).toEqual([small.w * 2, small.h * 2]);
    expect(large.clip).toEqual({ x: ENTRANCE_WINDOW_X, y: TOP, w: 146, h: ENTRANCE_H });
    const eye = EYES['boss-scrap-king'];
    expect(large.y + eye.y * ENTRANCE_SCALE).toBe(MIDDLE);
    // Its eye's light, in the window, over the large picture.
    const lit = drawn.glows.filter((g) => isLight(g) && g.r === eye.r * ENTRANCE_SCALE + 10);
    expect(lit).toHaveLength(1);
    expect(lit[0]).toMatchObject({ x: large.x + eye.x * ENTRANCE_SCALE, y: MIDDLE });
    // The words.
    expect(signIn(drawn, 'WARNING', 'red') ?? signIn(drawn, 'WARNING', 'amber')).not.toBeNull();
    expect(signIn(drawn, 'SCRAP KING', 'steel')).not.toBeNull();
  });

  test('a boss that is a frame built from parts, like the pilot\'s own, is shown turned to face left and looked at where its head is', () => {
    const { flow, screen, page } = against('rival-2');
    expect(flow.state.units[1].composed).toBe(true);
    screen.update(WARNING_MS / 2);
    const drawn = page();
    // Its parts are drawn in the window, each at twice its size and turned round.
    const inWindow = drawn.images.filter((image) => image.clip && image.clip.x === ENTRANCE_WINDOW_X && image.clip.y === TOP);
    expect(inWindow.length).toBeGreaterThanOrEqual(4);
    // No light: where such a frame's eye is, is not known.
    expect(drawn.glows.filter((g) => isLight(g) && g.y === MIDDLE && g.x > ENTRANCE_WINDOW_X && g.r >= 20)).toEqual([]);
    expect(signIn(drawn, ENEMIES['rival-2'].name.toUpperCase(), 'steel')).not.toBeNull();
    // Its head, at 83, 27 of a frame's box and turned round in it, is in the middle of the window's height.
    expect([MECH_HEAD, MECH_BOX]).toEqual([{ x: 83, y: 27 }, 160]);
  });

  test('a boss whose name is no machine on the field has the words and no window', () => {
    const { screen, page } = against('recon-drone', { boss: 'Nobody' });
    screen.update(WARNING_MS / 2);
    const drawn = page();
    expect(drawn.images.filter((image) => image.clip !== null)).toEqual([]);
    const name = signIn(drawn, 'NOBODY', 'steel')!;
    expect(Math.abs(name.x + name.w / 2 - 155)).toBeLessThanOrEqual(0.5);
  });

  test('the warning blinks between its two colours; a calm picture has it standing in red', () => {
    const colours = (calm: boolean): string[] => {
      const { screen, page } = against('scrap-king', { calm });
      const seen: string[] = [];
      for (let i = 0; i < 4; i++) {
        screen.update(90);
        seen.push(signIn(page(), 'WARNING', 'red') ? 'red' : signIn(page(), 'WARNING', 'amber') ? 'amber' : 'not there');
      }
      return seen;
    };
    expect(colours(false)).toEqual(['red', 'amber', 'amber', 'red']);
    expect(colours(true)).toEqual(['red', 'red', 'red', 'red']);
  });

  test('the band is up for as long as the warning is, a press sends it away, and a hurried game never shows it', () => {
    const { screen, page } = against('scrap-king');
    screen.update(WARNING_MS - 20);
    expect(plate(page())).toBeDefined();
    screen.update(40);
    expect(page().rects.some((r) => r.color === PLATE)).toBe(false);
    const pressed = against('scrap-king');
    pressed.screen.update(300);
    pressed.screen.onInput('confirm');
    expect(pressed.page().rects.some((r) => r.color === PLATE)).toBe(false);
    const fast = against('scrap-king', { fast: true });
    expect(fast.page().rects.some((r) => r.color === PLATE)).toBe(false);
    expect(signCount(fast.page())).toBe(0);
  });

  test('a contract without a boss opens with its banner as before: from the left, and with no window', () => {
    const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, title: 'PATROL' });
    screen.update(60);
    const drawn = record((ctx) => screen.draw(ctx));
    const banner = plate(drawn);
    expect(banner).toMatchObject({ y: 62, w: 310, h: 46 });
    expect(banner.x).toBeLessThan(0);
    expect(drawn.images.filter((image) => image.clip !== null)).toEqual([]);
    expect(signCount(drawn)).toBe(0);
  });
});
