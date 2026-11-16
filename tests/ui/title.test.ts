import { CATALOG } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import type { GameState } from '../../src/core/game';
import { SAVE_KEY, SaveFile } from '../../src/platform/storage';
import { LIGHT_ALPHA, lightLevel } from '../../src/ui/ambience';
import { App } from '../../src/ui/app';
import { LOGO, faceColor } from '../../src/ui/logo';
import {
  BEAM_ALPHA, BEAM_REACH, BEAM_WIDTH, SEARCHLIGHTS, TITLE_ALPHA, TITLE_HAZE, TITLE_LIGHTS, beamEnd, drawSearchlights, drawTitleScene, titleLevel, titleLights,
} from '../../src/ui/titleScene';
import { MENU_BOTTOM, MENU_X, SIGN } from '../../src/ui/titleScreen';
import { LIGHTNING_MS } from '../../src/ui/weather';
import { done, memoryStore, press, snap } from '../helpers/app';
import { record, type Drawn, type Glowed } from '../helpers/canvas';

/** The title: Varn at night in the rain, alive, with the game's name over it as a sign and the menu out of the picture's way. */

const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const isVignette = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1] === 'rgba(4, 4, 14, 0)';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
function standIn(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('the lights of the title\'s picture', () => {
  test('each is on the screen, a size and a colour, and there are lamps, windows, three beacons and one eye', () => {
    expect(TITLE_LIGHTS.length).toBeLessThanOrEqual(17);
    for (const light of TITLE_LIGHTS) {
      expect(light.x).toBeGreaterThanOrEqual(0);
      expect(light.x).toBeLessThan(310);
      expect(light.y).toBeGreaterThanOrEqual(0);
      expect(light.y).toBeLessThan(270);
      expect(light.r).toBeGreaterThanOrEqual(8);
      expect(light.r).toBeLessThanOrEqual(44);
      expect(light.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    const kinds = TITLE_LIGHTS.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'beacon')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'eye')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'lamp').length).toBeGreaterThanOrEqual(8);
    expect(kinds.filter((k) => k === 'steady').length).toBeGreaterThanOrEqual(3);
    // The eye is where the machine on the roof has its head, to the right of where the menu ends.
    const eye = TITLE_LIGHTS.find((l) => l.kind === 'eye')!;
    expect(eye).toMatchObject({ x: 229, y: 167 });
  });

  test('lamps and windows behave as they do in any place', () => {
    for (const t of [0, 900, 4321]) {
      expect(titleLevel('lamp', t, 3)).toBe(lightLevel('lamp', t, 3));
      expect(titleLevel('steady', t, 1)).toBe(lightLevel('steady', t, 1));
    }
    expect(TITLE_ALPHA.lamp).toBe(LIGHT_ALPHA.lamp);
    expect(TITLE_ALPHA.steady).toBe(LIGHT_ALPHA.steady);
  });

  test('a beacon swells and dies in a second and is dark for the next, and two beacons are out of step', () => {
    const levels = Array.from({ length: 400 }, (_, i) => titleLevel('beacon', i * 10, 0));
    expect(Math.max(...levels)).toBeGreaterThan(0.99);
    expect(Math.min(...levels)).toBe(0);
    const dark = levels.filter((level) => level === 0).length;
    expect(dark).toBeGreaterThan(180);
    expect(dark).toBeLessThan(220);
    // It never jumps.
    for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i] - levels[i - 1])).toBeLessThan(0.05);
    const other = Array.from({ length: 400 }, (_, i) => titleLevel('beacon', i * 10, 1));
    expect(other.indexOf(Math.max(...other))).not.toBe(levels.indexOf(Math.max(...levels)));
    // A calm picture has it simply on, and not at its brightest.
    expect(new Set(Array.from({ length: 400 }, (_, i) => titleLevel('beacon', i * 10, 0, true)))).toEqual(new Set([0.6]));
  });

  test('the eye holds, and every six seconds and a half it narrows for a moment', () => {
    const levels = Array.from({ length: 1300 }, (_, i) => titleLevel('eye', i * 10, 0));
    const narrow = levels.filter((level) => level < 0.5);
    expect(new Set(narrow)).toEqual(new Set([0.25]));
    // Twice in thirteen seconds, a sixth of a second each.
    expect(narrow.length).toBeGreaterThanOrEqual(30);
    expect(narrow.length).toBeLessThanOrEqual(34);
    expect(Math.min(...levels.filter((level) => level >= 0.5))).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
    expect(new Set(Array.from({ length: 1300 }, (_, i) => titleLevel('eye', i * 10, 0, true)))).toEqual(new Set([0.8]));
  });

  test('none is ever brighter than its kind allows', () => {
    for (let t = 0; t < 20000; t += 170) {
      titleLights(t).forEach((glow, i) => {
        expect(glow.alpha).toBeLessThanOrEqual(TITLE_ALPHA[TITLE_LIGHTS[i].kind] + 1e-9);
        expect(glow.alpha).toBeGreaterThanOrEqual(0);
        expect([glow.x, glow.y, glow.r, glow.color]).toEqual([TITLE_LIGHTS[i].x, TITLE_LIGHTS[i].y, TITLE_LIGHTS[i].r, TITLE_LIGHTS[i].color]);
      });
    }
  });
});

describe('the searchlights over the city', () => {
  test('each stands under the sign, reaches up past it, and leans about', () => {
    expect(SEARCHLIGHTS).toHaveLength(2);
    SEARCHLIGHTS.forEach((light, i) => {
      // Below the sign's foot, so that its own foot is seen.
      expect(light.y).toBeGreaterThan(SIGN.y + LOGO.h);
      const xs: number[] = [];
      for (let t = 0; t < 30000; t += 200) {
        const end = beamEnd(light, t, i);
        expect(Math.hypot(end.x - light.x, end.y - light.y)).toBeCloseTo(BEAM_REACH, 5);
        // Always upwards, to above the sign.
        expect(end.y).toBeLessThan(SIGN.y);
        xs.push(end.x);
      }
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(70);
    });
    // They do not swing together.
    const gap = (t: number) => beamEnd(SEARCHLIGHTS[0], t, 0).x - beamEnd(SEARCHLIGHTS[1], t, 1).x;
    expect(Math.abs(gap(0) - gap(4000))).toBeGreaterThan(5);
  });

  test('each is a cone of light in two layers: from a point at the lamp, wide at its end, fading to nothing, added to the picture', () => {
    const page = record((ctx) => {
      ctx.globalCompositeOperation = 'source-over';
      drawSearchlights(ctx, 2000);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });
    expect(page.shapes).toHaveLength(4);
    expect(page.rects).toEqual([]);
    page.shapes.forEach((shape, n) => {
      const light = SEARCHLIGHTS[Math.floor(n / 2)];
      const end = beamEnd(light, 2000, Math.floor(n / 2));
      expect(shape.blend).toBe('lighter');
      expect(shape.points).toHaveLength(4);
      // Two corners at the lamp, less than a pixel apart; two at the far end, as far apart as the cone is wide there.
      const [a, b, c, d] = shape.points;
      expect(Math.hypot(a.x - light.x, a.y - light.y)).toBeLessThan(1);
      expect(Math.hypot(d.x - light.x, d.y - light.y)).toBeLessThan(1);
      const wide = Math.hypot(b.x - c.x, b.y - c.y);
      expect(wide).toBeCloseTo(n % 2 === 0 ? BEAM_WIDTH : BEAM_WIDTH * 0.45, 4);
      expect(Math.hypot((b.x + c.x) / 2 - end.x, (b.y + c.y) / 2 - end.y)).toBeLessThan(0.001);
      expect(shape.stops).toHaveLength(2);
      expect(shape.stops[0][1]).toMatch(new RegExp(`, ${BEAM_ALPHA.toFixed(3)}\\)$`));
      expect(shape.stops[1][1]).toMatch(/, 0\)$/);
    });
    // A calm picture has them at half strength; a canvas that makes no gradients has none.
    const calm = record((ctx) => drawSearchlights(ctx, 2000, true));
    expect(calm.shapes[0].stops[0][1]).toMatch(new RegExp(`, ${(BEAM_ALPHA / 2).toFixed(3)}\\)$`));
    expect(() => drawSearchlights(standIn(), 2000)).not.toThrow();
  });
});

describe('the title\'s picture, as it is lit', () => {
  test('darker edges, each light that is on, and mist over the water: soft light and nothing solid', () => {
    const page = record((ctx) => drawTitleScene(ctx, 500));
    expect(page.glows.filter(isVignette)).toHaveLength(1);
    const lights = page.glows.filter(isLight);
    const on = titleLights(500).filter((glow) => glow.alpha >= 0.01);
    expect(lights).toHaveLength(on.length);
    expect(lights.map((g) => [g.x, g.y, g.r])).toEqual(on.map((g) => [g.x, g.y, g.r]));
    const mist = page.glows.filter((g) => !isLight(g) && !isVignette(g));
    expect(mist).toHaveLength(3);
    for (const bank of mist) {
      expect(Math.abs(bank.y - TITLE_HAZE.y)).toBeLessThan(10);
      expect(bank.ry).toBeLessThan(bank.r / 4);
    }
    expect(page.rects).toEqual([]);
    expect(page.shapes).toEqual([]);
    expect(() => drawTitleScene(standIn(), 500)).not.toThrow();
  });

  test('a calm picture has every light at half strength', () => {
    const plain = record((ctx) => drawTitleScene(ctx, 0)).glows.filter(isLight);
    const calm = record((ctx) => drawTitleScene(ctx, 0, true)).glows.filter(isLight);
    // At any moment some beacon is dark; in a calm picture all of them are on.
    expect(calm.length).toBe(TITLE_LIGHTS.length);
    expect(plain.length).toBe(titleLights(0).filter((glow) => glow.alpha >= 0.01).length);
    expect(plain.length).toBeLessThan(calm.length);
    const lamp = (glows: Glowed[]) => strength(glows.find((g) => g.x === 54 && g.y === 149)!);
    expect(lamp(calm)).toBeCloseTo(lamp(plain) / 2, 2);
  });
});

describe('the title screen', () => {
  const named = { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  const settled = (over: Partial<GameState> = {}): GameState => ({ ...done('intro-1'), scenes: SCENES.map((s) => s.id), ...over });
  function title(saves: (GameState | null)[] = [], fast = false): App {
    const data: Record<string, string> = {};
    saves.forEach((game, slot) => { if (game) data[slot === 0 ? SAVE_KEY : `${SAVE_KEY}-${slot + 1}`] = JSON.stringify(game); });
    return new App({ catalog: CATALOG, save: new SaveFile(memoryStore(data), CATALOG), sprites: named, fast, seed: 3 });
  }
  const picture = (app: App): Drawn => record((ctx) => app.draw(ctx));
  const RAIN = /^rgba\(150, 190, 255, /;
  const GLEAM = 'rgba(255, 255, 255, 0.7)';
  const plate = (page: Drawn) => page.washes.filter((w) => w.stops[0]?.[1] === 'rgba(27, 25, 52, 0.95)');
  /** The box the menu's plate fills. */
  const menuBox = (page: Drawn) => {
    const pieces = plate(page);
    const x = Math.min(...pieces.map((p) => p.x));
    const y = Math.min(...pieces.map((p) => p.y));
    return { x, y, right: Math.max(...pieces.map((p) => p.x + p.w)), bottom: Math.max(...pieces.map((p) => p.y + p.h)) };
  };
  const signRects = (page: Drawn) => page.rects.filter((r) => r.h === 1 && r.y >= SIGN.y && r.y < SIGN.y + LOGO.h && r.x >= SIGN.x && r.x + r.w <= SIGN.x + LOGO.w && !RAIN.test(r.color));

  test('the sign hangs in the middle of the sky, and the game\'s name is not also written under it', () => {
    expect(SIGN.x).toBe(Math.round((310 - LOGO.w) / 2));
    expect(SIGN.y).toBeGreaterThanOrEqual(8);
    const app = title([], true);
    const page = picture(app);
    expect(page.texts.map((t) => t.text)).not.toContain(STRINGS.title);
    const sign = signRects(page);
    expect(sign.length).toBeGreaterThan(500);
    expect(Math.min(...sign.map((r) => r.x))).toBe(SIGN.x);
    expect(Math.max(...sign.map((r) => r.x + r.w))).toBe(SIGN.x + LOGO.w);
    expect(Math.min(...sign.map((r) => r.y))).toBe(SIGN.y);
    expect(Math.max(...sign.map((r) => r.y))).toBe(SIGN.y + LOGO.h - 1);
  });

  test('the line under it is written with a dark edge all round, clear of the sign and of the menu', () => {
    const page = picture(title([], true));
    const lines = page.texts.filter((t) => t.text === STRINGS.titleScreen.tagline);
    expect(lines).toHaveLength(9);
    const word = lines.at(-1)!;
    expect(word).toMatchObject({ x: 155, align: 'center' });
    expect(word.y).toBeGreaterThanOrEqual(SIGN.y + LOGO.h);
    expect(lines.slice(0, 8).every((t) => t.color === '#07061a')).toBe(true);
    expect(new Set(lines.slice(0, 8).map((t) => `${t.x - word.x},${t.y - word.y}`)).size).toBe(8);
    for (const t of lines.slice(0, 8)) expect(Math.max(Math.abs(t.x - word.x), Math.abs(t.y - word.y))).toBe(1);
    expect(word.y + 12).toBeLessThan(menuBox(page).y);
    expect(word.left).toBeGreaterThan(0);
    expect(word.right).toBeLessThan(310);
  });

  test('the menu stands at the lower left, clear of the machine on the roof, and ends at the same height whatever it holds', () => {
    // No game kept; one kept; three kept (Load Game appears); a kept game that cannot be read (a notice appears).
    const cases: App[] = [title([], true), title([settled()], true), title([settled(), settled({ callsign: 'ABCDEFGH' })], true)];
    const broken = new App({ catalog: CATALOG, save: new SaveFile(memoryStore({ [SAVE_KEY]: '{not a game' }), CATALOG), sprites: named, fast: true, seed: 3 });
    expect(snap(broken).message).toBe(STRINGS.titleScreen.unusable);
    for (const app of [...cases, broken]) {
      const page = picture(app);
      const box = menuBox(page);
      expect(box.x).toBe(MENU_X);
      expect(box.bottom).toBe(MENU_BOTTOM);
      // The machine in the picture stands from 205 to 247 across.
      expect(box.right).toBeLessThanOrEqual(203);
      // Everything the menu says is inside its box.
      const labels = (snap(app).menu.items as { label: string }[]).map((i) => i.label);
      for (const label of labels) {
        const t = page.texts.find((x) => x.text === label)!;
        expect(t, label).toBeDefined();
        expect(t.left).toBeGreaterThan(box.x);
        expect(t.right).toBeLessThan(box.right);
        expect(t.y).toBeGreaterThan(box.y);
        expect(t.y + 12).toBeLessThanOrEqual(box.bottom);
      }
    }
    // The notice is written in the middle of the box, and in it.
    const page = picture(broken);
    const box = menuBox(page);
    const notice = page.texts.find((t) => t.text === STRINGS.titleScreen.unusable)!;
    expect(notice.x).toBe((box.x + box.right) / 2);
    expect(notice.left).toBeGreaterThan(box.x);
    expect(notice.right).toBeLessThan(box.right);
    expect(notice.y).toBeGreaterThan(box.y);
  });

  test('picking a slot, and the question before a game is started over, are in the same corner', () => {
    const app = title([settled(), settled({ callsign: 'ABCDEFGH' })], true);
    press(app, 'down', 'confirm');
    expect(snap(app).mode).toBe('new');
    for (const step of ['new', 'ask']) {
      if (step === 'ask') { press(app, 'up', 'up', 'confirm'); expect(snap(app).mode).toBe('ask'); }
      const page = picture(app);
      const box = menuBox(page);
      expect(box.x).toBe(MENU_X);
      expect(box.bottom).toBe(MENU_BOTTOM);
      expect(box.right).toBeLessThan(310);
      const said = [snap(app).message as string, ...(snap(app).menu.items as { label: string; note?: string }[]).flatMap((i) => [i.label, i.note ?? ''])].filter(Boolean);
      for (const text of said) {
        const t = page.texts.find((x) => x.text === text)!;
        expect(t, text).toBeDefined();
        expect(t.left, text).toBeGreaterThan(box.x);
        expect(t.right, text).toBeLessThan(box.right);
        expect(t.y, text).toBeGreaterThan(box.y);
      }
    }
  });

  test('a hurried title stands still: the sign on, no rain, no gleam, and the picture not veiled', () => {
    const app = title([], true);
    const first = picture(app);
    app.update(5000);
    const later = picture(app);
    expect(later.rects).toEqual(first.rects);
    expect(later.glows).toEqual(first.glows);
    expect(later.shapes).toEqual(first.shapes);
    expect(first.rects.filter((r) => RAIN.test(r.color))).toEqual([]);
    expect(first.rects.filter((r) => r.color === GLEAM)).toEqual([]);
    // The sign is lit: the top of its first letter is the bright steel.
    expect(signRects(first).some((r) => r.color === faceColor(20, true, true))).toBe(true);
    // The picture is drawn once, pixel for pixel, and nothing dark is laid over the whole of it.
    expect(first.images.filter((i) => (i.image as { id?: string }).id === 'still-varn').map((i) => [i.x, i.y, i.w, i.h])).toEqual([[0, 0, 310, 270]]);
    expect(first.rects.filter((r) => r.w === 310 && r.h === 270).map((r) => r.color)).toEqual(['#0c0c18']);
    expect(first.shapes).toHaveLength(4);
  });

  test('the sign comes on: unlit at first, lit after a second, and it throws light only once it is', () => {
    const app = title();
    app.update(100);
    const early = picture(app);
    expect(signRects(early).some((r) => r.color === faceColor(20, true, false))).toBe(true);
    expect(signRects(early).some((r) => r.color === faceColor(20, true, true))).toBe(false);
    const signLight = (page: Drawn) => page.glows.filter((g) => isLight(g) && g.y === SIGN.y + Math.round(LOGO.h / 2) && g.r === 46);
    expect(signLight(early)).toEqual([]);
    app.update(1900);
    const lit = picture(app);
    expect(signRects(lit).some((r) => r.color === faceColor(20, true, true))).toBe(true);
    expect(signLight(lit)).toHaveLength(6);
    // And it rains.
    expect(lit.rects.filter((r) => RAIN.test(r.color)).length).toBeGreaterThan(20);
  });

  test('lightning strikes over the city, the gleam crosses the sign, and neither happens in a calm picture or to the sign coming on', () => {
    const watch = (calm: boolean) => {
      const app = title([settled({ settings: { ...settled().settings, calm } })]);
      let strokes = 0;
      let gleams = 0;
      let unlit = 0;
      for (let t = 0; t < LIGHTNING_MS * 2; t += 50) {
        app.update(50);
        const page = picture(app);
        if (page.rects.some((r) => r.blend === 'overlay')) strokes++;
        if (page.rects.some((r) => r.color === GLEAM)) gleams++;
        if (signRects(page).some((r) => r.color === faceColor(20, true, false))) unlit++;
      }
      return { strokes, gleams, unlit };
    };
    const plain = watch(false);
    expect(plain.strokes).toBeGreaterThan(0);
    expect(plain.gleams).toBeGreaterThan(20);
    expect(plain.unlit).toBeGreaterThan(5);
    const calm = watch(true);
    expect(calm.strokes).toBe(0);
    // The gleam is no flash: a calm picture keeps it. The sign is on from the first frame.
    expect(calm.gleams).toBeGreaterThan(20);
    expect(calm.unlit).toBe(0);
  });

  test('the picture\'s lights and the searchlights drift with the picture', () => {
    const app = title();
    // A quarter of the way round the drift's slow circle: the picture is three pixels down.
    app.update(Math.round((2600 * Math.PI) / 2));
    const page = picture(app);
    expect(page.images.filter((i) => (i.image as { id?: string }).id === 'still-varn').map((i) => i.y)).toEqual([0, 3]);
    const eye = TITLE_LIGHTS.find((l) => l.kind === 'eye')!;
    expect(page.glows.filter((g) => isLight(g) && g.x === eye.x && g.r === eye.r).map((g) => g.y)).toEqual([eye.y + 3]);
    for (const [n, light] of SEARCHLIGHTS.entries()) {
      const foot = page.shapes[n * 2].points[0];
      expect(Math.hypot(foot.x - light.x, foot.y - (light.y + 3))).toBeLessThan(1);
    }
    // The sign and the menu do not move.
    expect(Math.min(...signRects(page).map((r) => r.y))).toBe(SIGN.y);
    expect(menuBox(page).bottom).toBe(MENU_BOTTOM);
  });

  test('the searchlights cross in front of the sign and behind what is written', () => {
    const app = title();
    app.update(2000);
    const order: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, name: string) => {
        if (name === 'fill') return () => { order.push('beam'); };
        if (name === 'fillText') return (text: string) => { if (text === STRINGS.titleScreen.tagline) order.push('line'); };
        if (name === 'fillRect') return (_x: number, y: number, _w: number, h: number) => { if (h === 1 && y === SIGN.y + 20 && order.at(-1) !== 'sign') order.push('sign'); };
        if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
        if (name === 'measureText') return (text: string) => ({ width: text.length * 4.8 });
        return name in t ? t[name] : () => undefined;
      },
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    app.draw(ctx);
    expect(order.indexOf('sign')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('beam')).toBeGreaterThan(order.lastIndexOf('sign'));
    expect(order.indexOf('line')).toBeGreaterThan(order.lastIndexOf('beam'));
  });
});
