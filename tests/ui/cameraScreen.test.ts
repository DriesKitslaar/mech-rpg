import { createBattle, type BattleEvent, type BattleOptions, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { AMBIENCE } from '../../src/ui/ambience';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, EDGE, INTRO_MS, PUSH, WARNING_MS } from '../../src/ui/battleScreen';
import { HOME, MAX_PUSH, PUSH_MS, TRAVEL_SHARE, atHome, openingView, seenBy } from '../../src/ui/camera';
import { FINISH_ZOOM } from '../../src/ui/cinema';
import type { SpriteStore } from '../../src/ui/sprites';
import { FIELD_Y, PANEL_Y, pictureTop, placeFor } from '../../src/ui/stage';
import { LIGHTNING_MS, lightning } from '../../src/ui/weather';
import { COLORS } from '../../src/ui/widgets';
import { onStage, record, type Drawn, type Glowed, type Pictured } from '../helpers/canvas';

/**
 * The camera, where it meets a whole battle: it comes down the place's picture while the banner
 * is up, pushes in on a blow as it lands and is home again after, gives way to the close look at
 * the last machine, and stands at home always in a calm picture and a hurried game.
 */

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const idOf = (image: Pictured): string => (image.image as { id: string }).id;
const NEON = 'bg-neon-district';
const isVignette = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1] === 'rgba(4, 4, 14, 0)';
const isLight = (g: Glowed): boolean => g.blend === 'lighter';

function fight(enemies: string[], frail: number[] = [], opts: BattleOptions = {}, seed = 7): BattleState {
  const state = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, seed, opts);
  for (const i of frail) for (const part of Object.values(state.units[i + 1].parts)) if (part) part.ap = 1;
  return state;
}
function screenOf(state: BattleState, opts: { fast?: boolean; calm?: boolean; background?: string; boss?: string } = {}) {
  const flow = new BattleFlow(state, CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, {
    fast: opts.fast ?? false, background: opts.background ?? NEON, ...(opts.calm ? { calm: true } : {}), ...(opts.boss ? { boss: opts.boss } : {}),
  });
  const page = (): Drawn => record((ctx) => screen.draw(ctx));
  const picture = (drawn = page()): Pictured => drawn.images.find((image) => idOf(image).startsWith('bg-'))!;
  /** Lets the battle run until the pilot can act. */
  const ready = (): void => { for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16); expect(flow.phase).toBe('action'); };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Fires the weapon in the near fist at whatever is aimed at first. */
  const fire = (): void => { choose('fire'); choose('rightHand'); screen.onInput('confirm'); };
  return { flow, screen, page, picture, ready, choose, fire };
}

describe('as a battle opens', () => {
  test('the camera comes down the place\'s picture while the banner is up: from its top row to the band with the floor', () => {
    const { screen, picture } = screenOf(fight(['recon-drone']));
    const place = placeFor(NEON);
    expect(screen.banner).toBe(true);
    // Before anything has moved: the top of the picture is at the top of the field.
    expect(screen.motion.view).toEqual(openingView(0, place));
    expect(picture()).toMatchObject({ x: 0, y: FIELD_Y, w: 310, h: 270 });
    const tops: number[] = [];
    for (let ms = 0; ms < INTRO_MS * TRAVEL_SHARE; ms += 16) {
      screen.update(16);
      const drawn = picture();
      // Pixel for pixel all the way: the picture at its own size, on whole pixels.
      expect([drawn.x, drawn.w, drawn.h]).toEqual([0, 310, 270]);
      expect(Number.isInteger(drawn.y)).toBe(true);
      tops.push(drawn.y);
    }
    // It only ever comes down (the picture goes up the screen), through many heights, and ends where the field looks at home.
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThanOrEqual(tops[i - 1]);
    expect(new Set(tops).size).toBeGreaterThan(20);
    expect(tops.at(-1)).toBe(pictureTop(place));
    expect(screen.banner).toBe(true);
    expect(screen.motion.view).toEqual(HOME);
    // And stays there for the rest of the banner and after it.
    for (let ms = 0; ms < INTRO_MS; ms += 16) { screen.update(16); expect(picture().y).toBe(pictureTop(place)); }
    expect(screen.banner).toBe(false);
  });

  test('what stands on the field comes into view with the floor: it moves with the picture, and the drawing is kept inside the field', () => {
    const { screen, page } = screenOf(fight(['tank']));
    const first = page();
    const home = (() => { const s = screenOf(fight(['tank']), { fast: true }); s.screen.update(16); return s.page(); })();
    const shift = first.images[0].y - home.images[0].y;
    expect(shift).toBe(placeFor(NEON).row);
    // Every picture on the field is as far down as the place's picture is, and none is drawn outside the field.
    const machines = (drawn: Drawn) => drawn.images.filter((image) => !idOf(image).startsWith('bg-'));
    expect(machines(first).length).toBe(machines(home).length);
    machines(first).forEach((image, i) => {
      expect([image.x, image.w, image.h], idOf(image)).toEqual([machines(home)[i].x, machines(home)[i].w, machines(home)[i].h]);
      // The tank stands still; the pilot's mech breathes, so its layers are within a pixel or two of where a hurried game has them.
      expect(Math.abs(image.y - shift - machines(home)[i].y), idOf(image)).toBeLessThanOrEqual(idOf(image) === 'enemy-tank' ? 0 : 2);
      expect(image.clip).toEqual({ x: 0, y: FIELD_Y, w: 310, h: PANEL_Y - FIELD_Y });
    });
    // At home nothing keeps the drawing in: there is nothing to keep out.
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    expect(page().images.every((image) => image.clip === null)).toBe(true);
  });

  test('a boss\'s warning is up for longer, and the camera takes that much longer to come down', () => {
    const boss = screenOf(fight(['scrap-king']), { boss: ENEMIES['scrap-king'].name });
    const plain = screenOf(fight(['tank']));
    boss.screen.update(INTRO_MS * TRAVEL_SHARE);
    plain.screen.update(INTRO_MS * TRAVEL_SHARE);
    expect(atHome(plain.screen.motion.view)).toBe(true);
    expect(atHome(boss.screen.motion.view)).toBe(false);
    boss.screen.update((WARNING_MS - INTRO_MS) * TRAVEL_SHARE);
    expect(atHome(boss.screen.motion.view)).toBe(true);
    expect(boss.screen.banner).toBe(true);
  });

  test('a press while it comes down is not lost: the banner goes, and the field is at home in that very frame', () => {
    const { flow, screen, picture } = screenOf(fight(['recon-drone']));
    screen.update(160);
    expect(atHome(screen.motion.view)).toBe(false);
    screen.onInput('confirm');
    expect(screen.banner).toBe(false);
    expect(screen.motion.view).toBe(HOME);
    expect(picture().y).toBe(pictureTop(placeFor(NEON)));
    // The battle goes on from there as it would have.
    for (let i = 0; i < 4000 && flow.phase !== 'action'; i++) screen.update(16);
    expect(flow.phase).toBe('action');
  });

  test('the darker edges are the edges of the field wherever the camera is, and the lights high in the picture are seen while it is up there', () => {
    const { screen, page } = screenOf(fight(['recon-drone']));
    const first = page();
    const vignette = first.glows.filter(isVignette);
    expect(vignette).toHaveLength(1);
    expect(vignette[0]).toMatchObject({ x: 155, y: FIELD_Y + (PANEL_Y - FIELD_Y) / 2 });
    // The sign at the top right of the picture (284, 21) is off the field at home and in it now.
    const sign = AMBIENCE[NEON].lights.find((light) => light.x === 284 && light.y === 21)!;
    const seen = (drawn: Drawn) => drawn.glows.filter(isLight).some((g) => g.x === sign.x && g.r === sign.r);
    expect(seen(first)).toBe(true);
    expect(first.glows.filter(isLight).find((g) => g.x === sign.x && g.r === sign.r)!.y).toBe(FIELD_Y + sign.y);
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    expect(seen(page())).toBe(false);
    expect(page().glows.filter(isVignette)[0]).toMatchObject({ x: 155, y: FIELD_Y + (PANEL_Y - FIELD_Y) / 2 });
  });

  test('rain falls through all that is in view while the camera is up the picture, and lightning lights all of it', () => {
    const { screen, page } = screenOf(fight(['recon-drone']));
    const streaks = (drawn: Drawn) => drawn.rects.filter((r) => r.w === 1 && (r.h === 2 || r.h === 5) && r.color.startsWith('rgba(150, 190, 255,'));
    const first = streaks(page());
    // Streaks in the upper half of the field and in the lower: what is seen is not the stage's own field, and it rains in all of it.
    expect(first.some((r) => r.y < FIELD_Y + 60 && r.y >= FIELD_Y - 5)).toBe(true);
    expect(first.some((r) => r.y > FIELD_Y + 100 && r.y < PANEL_Y)).toBe(true);
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    const home = streaks(page());
    expect(first.length).toBe(home.length * 2);
    for (const r of home) expect(r.y >= FIELD_Y && r.y < PANEL_Y).toBe(true);
    // A stroke of lightning while the camera is on its way: the whole of the field is lit, not the part of it the stage's field is in.
    const stroke = Array.from({ length: LIGHTNING_MS / 4 }, (_, i) => i * 4).find((ms) => lightning(ms) === 1)!;
    const struck = new BattleScreen(new BattleFlow(fight(['recon-drone']), CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, background: NEON, title: 'x'.repeat(4), boss: 'Nobody' });
    // The warning lasts 1700 ms, the stroke comes later than that: the clock is taken there by a screen that is still opening.
    expect(stroke).toBeGreaterThan(0);
    const lit = (drawn: Drawn) => drawn.rects.filter((r) => r.blend === 'overlay');
    let found: Drawn | null = null;
    for (let ms = 0; ms < WARNING_MS * TRAVEL_SHARE - 16 && !found; ms += 4) {
      struck.update(4);
      const drawn = record((ctx) => struck.draw(ctx));
      if (lit(drawn).length > 0) found = drawn;
    }
    // Whether a stroke falls in the opening depends on the clock: where it does, it lights the field exactly.
    if (found) expect(lit(found)[0]).toMatchObject({ x: 0, y: FIELD_Y, w: 310, h: PANEL_Y - FIELD_Y });
    expect(stroke > WARNING_MS * TRAVEL_SHARE || found !== null).toBe(true);
  });

  test('a calm picture and a hurried game open at home: the camera does not travel', () => {
    for (const opts of [{ calm: true }, { fast: true }]) {
      const { screen, picture, page } = screenOf(fight(['recon-drone']), opts);
      expect(screen.motion.view).toBe(HOME);
      expect(picture().y).toBe(pictureTop(placeFor(NEON)));
      expect(page().images.every((image) => image.clip === null)).toBe(true);
      screen.update(100);
      expect(screen.motion.view).toBe(HOME);
    }
  });
});

describe('when a blow lands', () => {
  /** How close the camera gets, and where it looks, from now until it is home again. */
  function watch(screen: BattleScreen, frames = 80): { closest: number; x: number[]; y: number[]; home: boolean } {
    let closest = 1;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < frames; i++) {
      screen.update(16);
      const view = screen.motion.view;
      closest = Math.max(closest, view.zoom);
      if (view.zoom > 1) { x.push(view.x); y.push(view.y); }
    }
    return { closest, x, y, home: atHome(screen.motion.view) };
  }

  test('the camera pushes in towards the enemy that was hit, as the shot lands, and is home again, exactly, soon after', () => {
    const { flow, screen, page, ready, fire } = screenOf(fight(['recon-drone', 'tank', 'gun-turret']));
    ready();
    expect(screen.motion.view).toBe(HOME);
    const before = page();
    fire();
    expect(flow.message).toMatch(/hits Recon Drone/);
    // Nothing yet: the bullet is still on its way.
    screen.update(16);
    expect(screen.motion.view).toBe(HOME);
    const seen = watch(screen, 44);
    expect(seen.closest).toBeCloseTo(1 + PUSH.shot, 2);
    // Towards the drone: to the right of the middle and above it.
    expect(Math.max(...seen.x)).toBeGreaterThan(HOME.x + 5);
    expect(Math.min(...seen.y)).toBeLessThan(HOME.y);
    expect(seen.home).toBe(true);
    // Home again, the field is drawn as it was: every picture where it was, at its own size, nothing kept inside anything.
    const after = page();
    expect(after.images.every((image) => image.clip === null)).toBe(true);
    const place = (drawn: Drawn) => drawn.images.filter((image) => !idOf(image).includes('recon')).map((image) => [idOf(image), image.w, image.h]);
    expect(place(after)).toEqual(place(before));
    for (const image of after.images) expect(Number.isInteger(image.w) && Number.isInteger(image.h), idOf(image)).toBe(true);
  });

  test('a shot that misses moves nothing', () => {
    // Seeds for which the first shot of the battle misses: the camera stays where it is while it flies and after.
    let tried = 0;
    for (let seed = 1; seed < 60 && tried < 2; seed++) {
      const { flow, screen, ready, fire } = screenOf(fight(['recon-drone'], [], {}, seed));
      ready();
      fire();
      if (!/miss/i.test(flow.message)) continue;
      tried++;
      for (let i = 0; i < 30; i++) { screen.update(16); if (flow.phase !== 'animating' || !/miss/i.test(flow.message)) break; expect(screen.motion.view).toBe(HOME); }
    }
    expect(tried).toBe(2);
  });

  test('a blow on the pilot\'s mech turns it the other way: towards the lower left, where that mech stands', () => {
    const { flow, screen } = screenOf(fight(['recon-drone', 'tank', 'gun-turret']));
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    // The enemies move first in this battle: the first thing that lands, lands on the pilot.
    const xs: number[] = [];
    for (let i = 0; i < 400 && flow.phase !== 'action'; i++) {
      screen.update(16);
      if (/hits you/.test(flow.message) && screen.motion.view.zoom > 1) xs.push(screen.motion.view.x);
    }
    expect(xs.length).toBeGreaterThan(3);
    expect(Math.min(...xs)).toBeLessThan(HOME.x - 5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(HOME.x);
  });

  test('a machine going up is pushed in on harder than a shot that lands, and never closer than the closest there is', () => {
    const { screen, ready, fire } = screenOf(fight(['recon-drone', 'tank'], [0]));
    ready();
    fire();
    const seen = watch(screen, 60);
    expect(seen.closest).toBeGreaterThan(1 + PUSH.shot + 0.02);
    expect(seen.closest).toBeLessThanOrEqual(1 + MAX_PUSH + 1e-9);
    expect(Math.max(PUSH.shot, PUSH.shell, PUSH.blade, PUSH.wreck, PUSH.surge)).toBeLessThanOrEqual(MAX_PUSH);
    expect(PUSH.shot).toBeLessThan(PUSH.shell);
    expect(PUSH.shell).toBeLessThan(PUSH.blade);
  });

  test('a shell that lands is pushed in on harder than a bullet, and a blade hardest', () => {
    /** The closest the camera gets over a volley with this weapon, for the first battle it lands in. */
    const closest = (weapon: 'rightHand' | 'shoulder', build = DEMO_BUILD, boost = false): number => {
      for (let seed = 1; seed < 40; seed++) {
        const flow = new BattleFlow(createBattle(build, [ENEMIES['gun-turret']], CATALOG, seed), CATALOG, { quiet: true });
        const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, background: NEON });
        const settle = (): void => { for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16); };
        const choose = (id: string): boolean => {
          const at = flow.menu.items.findIndex((item) => item.id === id);
          if (at < 0 || !flow.menu.items[at].enabled) return false;
          for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
          for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
          screen.onInput('confirm');
          return true;
        };
        settle();
        if (boost) { if (!choose('boost')) continue; settle(); }
        if (!choose('fire') || !choose(weapon)) continue;
        screen.onInput('confirm');
        if (!/hits Gun Turret/.test(flow.message) || flow.state.units[1].destroyed) continue;
        let most = 1;
        for (let i = 0; i < 70; i++) { screen.update(16); most = Math.max(most, screen.motion.view.zoom); }
        return most;
      }
      throw new Error('no volley landed');
    };
    expect(closest('rightHand')).toBeCloseTo(1 + PUSH.shot, 2);
    expect(closest('shoulder')).toBeCloseTo(1 + PUSH.shell, 2);
    expect(closest('rightHand', { ...DEMO_BUILD, rightHand: 'wpn-arc-blade' }, true)).toBeCloseTo(1 + PUSH.blade, 2);
  });

  test('while it is pushed in, the darker edges, the white of a held blow and a stroke of lightning cover what is seen: the field, exactly', () => {
    const whole = (r: { x: number; y: number; w: number; h: number }): void => {
      expect(r.x).toBeCloseTo(0, 6);
      expect(r.y).toBeCloseTo(FIELD_Y, 6);
      expect(r.w).toBeCloseTo(310, 6);
      expect(r.h).toBeCloseTo(PANEL_Y - FIELD_Y, 6);
    };
    // The darker edges, as a shot lands.
    const plain = screenOf(fight(['recon-drone', 'tank', 'gun-turret']));
    plain.ready();
    plain.fire();
    let pushed: Drawn | null = null;
    for (let i = 0; i < 60 && !pushed; i++) { plain.screen.update(16); if (plain.screen.motion.view.zoom > 1.04) pushed = plain.page(); }
    const edges = pushed!.glows.filter(isVignette);
    expect(edges).toHaveLength(1);
    expect(edges[0].x).toBeCloseTo(155, 6);
    expect(edges[0].y).toBeCloseTo(FIELD_Y + (PANEL_Y - FIELD_Y) / 2, 6);
    // The white of a held blow. A blow that is held holds the camera too, so the two meet only when the field is held
    // while a push is still going: with battles played faster, one blow lands on the heels of another. Here the two are
    // brought together by hand: the camera is half way into a push when the field is struck.
    const held = screenOf(fight(['recon-drone', 'tank']));
    held.ready();
    const inner = held.screen as unknown as { camera: { push(at: { x: number; y: number }, amount: number): void }; hitStop: { strike(ms: number): void } };
    inner.camera.push({ x: 240, y: 60 }, 0.12);
    held.screen.update(64);
    inner.hitStop.strike(140);
    held.screen.update(16);
    expect(held.screen.motion.flash).toBeGreaterThan(0);
    expect(held.screen.motion.view.zoom).toBeGreaterThan(1.05);
    // It has turned up and to the right as far as there is field, and what it has in view is a part of the field.
    const view = seenBy(held.screen.motion.view);
    expect(view.top).toBeCloseTo(FIELD_Y, 6);
    expect(view.left + view.width).toBeCloseTo(310, 6);
    const flash = held.page();
    const at = flash.rects.findIndex((r) => /^rgba\(255, 255, 255, 0\.\d+\)$/.test(r.color) && r.w > 200);
    const white = flash.rects[at];
    expect(flash.rects.filter((r) => /^rgba\(255, 255, 255, 0\.\d+\)$/.test(r.color) && r.w > 200)).toHaveLength(1);
    // The white is the stage's whole field, drawn as the camera has it: larger than the screen's field, kept inside it, and so all of it.
    expect(flash.kept.rects[at]).toEqual({ x: 0, y: FIELD_Y, w: 310, h: PANEL_Y - FIELD_Y });
    expect(white.x).toBeLessThanOrEqual(1e-6);
    expect(white.y).toBeLessThanOrEqual(FIELD_Y + 1e-6);
    expect(white.x + white.w).toBeGreaterThanOrEqual(310 - 1e-6);
    expect(white.y + white.h).toBeGreaterThanOrEqual(PANEL_Y - 1e-6);
    whole(onStage(flash, held.screen.motion.view).rects[at]);
    // A stroke of lightning that falls while a shot lands.
    const storm = screenOf(fight(['recon-drone', 'tank', 'gun-turret']));
    storm.ready();
    const clock = (): number => (storm.screen as unknown as { clock: number }).clock;
    // The first stroke that is still far enough off for the shot to be fired into it.
    const from = Math.ceil(clock() / 2) * 2 + 500;
    const stroke = Array.from({ length: LIGHTNING_MS }, (_, i) => from + i * 2).find((ms) => lightning(ms) === 1 && lightning(ms - 2) === 0)!;
    expect(stroke).toBeGreaterThan(clock() + 400);
    while (clock() < stroke - 190) storm.screen.update(2);
    storm.fire();
    expect(storm.flow.message).toMatch(/hits/);
    while (clock() < stroke + 40) storm.screen.update(2);
    expect(storm.screen.motion.view.zoom).toBeGreaterThan(1.01);
    const lit = storm.page().rects.filter((r) => r.blend === 'overlay');
    expect(lit).toHaveLength(1);
    whole(lit[0]);
  });

  test('while it is pushed in everything on the field is drawn inside the field, and what is written over the field stays where it is', () => {
    const { screen, page, ready, fire } = screenOf(fight(['recon-drone', 'tank', 'gun-turret']));
    ready();
    const still = page();
    fire();
    let pushed: Drawn | null = null;
    for (let i = 0; i < 60 && !pushed; i++) { screen.update(16); if (screen.motion.view.zoom > 1.04) pushed = page(); }
    expect(pushed).not.toBeNull();
    for (const image of pushed!.images) expect(image.clip, idOf(image)).toEqual({ x: 0, y: FIELD_Y, w: 310, h: PANEL_Y - FIELD_Y });
    // The picture of the place is larger than its own size by as much as the camera is closer, and still covers the field.
    const picture = pushed!.images[0];
    expect(picture.w).toBeCloseTo(310 * screen.motion.view.zoom, 6);
    expect(picture.x).toBeLessThanOrEqual(0);
    expect(picture.x + picture.w).toBeGreaterThanOrEqual(310 - 1e-6);
    expect(picture.y).toBeLessThanOrEqual(FIELD_Y);
    expect(picture.y + picture.h).toBeGreaterThanOrEqual(PANEL_Y);
    // The message bar, the panel and what they say are no part of the field: they are where they were, as large as they were.
    const fixed = (drawn: Drawn) => drawn.texts.filter((t) => t.y < FIELD_Y || t.y >= PANEL_Y).map((t) => [t.x, t.y, t.size]);
    expect(fixed(pushed!).length).toBeGreaterThan(5);
    expect(fixed(pushed!).every(([, , size]) => [10, 12, 16].includes(size as number))).toBe(true);
    for (const [x, y] of fixed(pushed!)) expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    expect(fixed(still).length).toBeGreaterThan(5);
    // Put back on the stage, the field is what it is at home: the same pictures, where and as large as they stand.
    const back = onStage(pushed!, screen.motion.view);
    const tank = (drawn: Drawn) => drawn.images.find((image) => idOf(image) === 'enemy-tank')!;
    expect([tank(back).x, tank(back).y, tank(back).w, tank(back).h]).toEqual([tank(still).x, tank(still).y, tank(still).w, tank(still).h]);
  });

  test('the push is on the field\'s own clock: with battles played faster it is over sooner', () => {
    const run = (speed: number): number => {
      const flow = new BattleFlow(fight(['recon-drone', 'tank', 'gun-turret']), CATALOG, { quiet: true });
      const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, background: NEON, speed });
      for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
      screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm');
      let frames = 0;
      for (let i = 0; i < 200; i++) { screen.update(16); if (screen.motion.view.zoom > 1) frames++; }
      return frames * 16;
    };
    const plain = run(1);
    const quick = run(3);
    expect(plain).toBeGreaterThan(PUSH_MS * 0.7);
    expect(plain).toBeLessThanOrEqual(PUSH_MS + 32);
    expect(quick).toBeLessThan(plain / 2);
    expect(quick).toBeGreaterThan(0);
  });

  test('a calm picture and a hurried game do not move: the camera is at home through the whole of a volley', () => {
    for (const opts of [{ calm: true }, { fast: true }]) {
      const { flow, screen, page, ready, fire } = screenOf(fight(['recon-drone', 'tank', 'gun-turret']), opts);
      ready();
      fire();
      for (let i = 0; i < 80; i++) {
        screen.update(16);
        expect(screen.motion.view).toBe(HOME);
        if (i % 9 === 0) expect(page().images.every((image) => image.clip === null)).toBe(true);
      }
      expect(['animating', 'action', 'result']).toContain(flow.phase);
    }
  });
});

describe('a field that is shaken', () => {
  test('takes its picture with it as it is, so the floor stays under the feet on it; the picture\'s edges are drawn out so that none shows', () => {
    for (const background of [NEON, 'bg-sluice', 'bg-simulator']) {
      const { flow, screen, page, ready, fire } = screenOf(fight(['recon-drone', 'tank'], [0]), { background });
      ready();
      const place = placeFor(background);
      const legsOf = (drawn: Drawn): Pictured => drawn.images.filter((image) => idOf(image).startsWith('legs-')).at(-1)!;
      const tankOf = (drawn: Drawn): Pictured => drawn.images.filter((image) => idOf(image) === 'enemy-tank').at(-1)!;
      const rest = onStage(page(), screen.motion.view);
      expect(rest.images.filter((image) => idOf(image) === background)).toHaveLength(1);
      fire();
      let shaken = 0;
      const thrown = new Set<string>();
      for (let i = 0; i < 200 && flow.phase !== 'action'; i++) {
        screen.update(16);
        // The field as it stands on the stage: the camera pushes in on the same blow.
        const drawn = onStage(page(), screen.motion.view);
        const [picture, ...edges] = drawn.images.filter((image) => idOf(image) === background);
        // The picture itself: all of it, at its own size, whatever happens.
        expect([picture.w, picture.h, picture.from], background).toEqual([310, 270, undefined]);
        const by = { x: picture.x, y: picture.y - pictureTop(place) };
        if (by.x === 0 && by.y === 0) { expect(edges, background).toEqual([]); continue; }
        shaken++;
        thrown.add(`${Math.sign(by.x)},${Math.sign(by.y)}`);
        // Thrown by the few whole pixels the blow throws the field.
        expect([Number.isInteger(by.x), Number.isInteger(by.y)], background).toEqual([true, true]);
        expect(Math.max(Math.abs(by.x), Math.abs(by.y)), background).toBeLessThan(EDGE);
        // What stands on the floor is thrown exactly as far as the floor is: nothing slides. (A machine that is hit is
        // shaken by itself as well, two pixels either way: the tank is not hit here.)
        expect([legsOf(drawn).x - legsOf(rest).x, legsOf(drawn).y - legsOf(rest).y], background).toEqual([by.x, by.y]);
        expect([tankOf(drawn).x - tankOf(rest).x, tankOf(drawn).y - tankOf(rest).y], background).toEqual([by.x, by.y]);
        // Round it: its first and last columns and rows, each drawn out EDGE pixels beyond it, corners included.
        const top = pictureTop(place) + by.y;
        expect(edges.map((edge) => [edge.from, edge.x, edge.y, edge.w, edge.h]), background).toEqual([
          [{ x: 0, y: 0, w: 1, h: 270 }, by.x - EDGE, top, EDGE, 270],
          [{ x: 309, y: 0, w: 1, h: 270 }, by.x + 310, top, EDGE, 270],
          [{ x: 0, y: 0, w: 310, h: 1 }, by.x - EDGE, top - EDGE, 310 + 2 * EDGE, EDGE],
          [{ x: 0, y: 269, w: 310, h: 1 }, by.x - EDGE, top + 270, 310 + 2 * EDGE, EDGE],
        ]);
        // So nothing of the field is left bare, on any side.
        expect(by.x - EDGE, background).toBeLessThanOrEqual(0);
        expect(by.x + 310 + EDGE, background).toBeGreaterThanOrEqual(310);
        expect(top - EDGE, background).toBeLessThanOrEqual(FIELD_Y);
        expect(top + 270 + EDGE, background).toBeGreaterThanOrEqual(PANEL_Y);
      }
      // A machine going up shakes the field for a good few frames, every which way.
      expect(shaken, background).toBeGreaterThan(8);
      expect(thrown.size, background).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('a battle that is over', () => {
  test('is not pushed in on: from the very frame its result is up the camera is at home, and no push comes after', () => {
    const { flow, screen, page, picture, ready, fire } = screenOf(fight(['gun-turret'], [0]));
    ready();
    fire();
    // Pressed on to the result at once: the push of the shot that ended it has not begun, or is on its way in.
    for (let i = 0; i < 30 && flow.phase !== 'result'; i++) screen.onInput('confirm');
    expect(flow.phase).toBe('result');
    const camera = (screen as unknown as { camera: { busy: boolean; push(at: { x: number; y: number }, amount: number, delay?: number): void } }).camera;
    // What is asked of the camera from here on: the shot's push and the wreck's are asked for as the screen catches up.
    const asked: number[] = [];
    const push = camera.push.bind(camera);
    camera.push = (at, amount, delay) => { asked.push(amount); push(at, amount, delay); };
    for (let i = 0; i < 80; i++) {
      // Drawn before the screen has been told that time has passed, and in every frame after.
      expect(screen.motion.view, `frame ${i}`).toBe(HOME);
      // The picture at its own size and kept inside nothing: the stage is the screen. (The machine still goes up, and
      // that throws the field a few pixels: a blow is not the camera.)
      const drawn = picture(page());
      expect(drawn, `frame ${i}`).toMatchObject({ w: 310, h: 270, clip: null });
      expect(Math.max(Math.abs(drawn.x), Math.abs(drawn.y - pictureTop(placeFor(NEON)))), `frame ${i}`).toBeLessThan(EDGE);
      screen.update(16);
    }
    expect(asked.length).toBeGreaterThan(0);
    expect(Math.max(...asked)).toBe(PUSH.wreck);
    // And none of them is left waiting.
    expect(camera.busy).toBe(false);
  });
});

describe('what a convoy loses', () => {
  const guarded = () => {
    const made = screenOf(fight(['recon-drone'], [], { objective: { type: 'protect', name: 'Ore Train', hp: 12 } }));
    made.ready();
    const inner = made.screen as unknown as {
      fx: { onEvent(event: BattleEvent): void; jolt(delay: number, amount: number, dur: number): void; shake(): { dx: number; dy: number } };
      camera: { push(at: { x: number; y: number }, amount: number): void };
    };
    /** The figure itself, in its own colour (it has a dark edge drawn round it first), and what it was kept inside. */
    const figure = (drawn: Drawn) => {
      const at = drawn.texts.findIndex((t) => t.text === '-7' && t.color === COLORS.danger);
      return at < 0 ? null : { x: drawn.texts[at].x, y: drawn.texts[at].y, size: drawn.texts[at].size, kept: drawn.kept.texts[at], after: drawn.order.findIndex((step) => step.kind === 'text' && step.at === at) };
    };
    return { ...made, inner, figure };
  };

  test('is written by the strip that names it, on the screen: over the strip, under nothing of the field', () => {
    const { screen, page, inner, figure } = guarded();
    expect(figure(page())).toBeNull();
    inner.fx.onEvent({ type: 'asset', hp: 5, lost: 7 });
    screen.update(16);
    const drawn = page();
    const shown = figure(drawn)!;
    // Under the strip in the top left corner, rising into it; kept inside nothing.
    expect(shown.x).toBe(30);
    expect(shown.y).toBeGreaterThan(FIELD_Y + 12);
    expect(shown.y).toBeLessThanOrEqual(34);
    expect(shown.kept).toBeNull();
    // The strip that says what is guarded is drawn before it: the figure lies over the strip when it rises into it.
    const strip = drawn.order.findIndex((step) => step.kind === 'text' && drawn.texts[step.at].text.startsWith('ORE TRAIN'));
    expect(strip).toBeGreaterThanOrEqual(0);
    expect(shown.after).toBeGreaterThan(strip);
  });

  test('stays where it is while the camera is pushed in and a blow throws the field', () => {
    const still = guarded();
    still.inner.fx.onEvent({ type: 'asset', hp: 5, lost: 7 });
    still.screen.update(64);
    const moved = guarded();
    moved.inner.fx.onEvent({ type: 'asset', hp: 5, lost: 7 });
    moved.inner.camera.push({ x: 300, y: 20 }, 0.12);
    moved.inner.fx.jolt(0, 5, 400);
    moved.screen.update(64);
    expect(moved.screen.motion.view.zoom).toBeGreaterThan(1.05);
    expect(moved.screen.motion.view.x).toBeGreaterThan(HOME.x + 5);
    const thrown = moved.inner.fx.shake();
    expect(Math.abs(thrown.dx) + Math.abs(thrown.dy)).toBeGreaterThan(0);
    const [a, b] = [still.figure(still.page())!, moved.figure(moved.page())!];
    expect([b.x, b.y, b.size, b.kept]).toEqual([a.x, a.y, a.size, null]);
    // What is hit on the field is another matter: its figure is on the stage, and goes where the camera has the stage.
    const hit = guarded();
    hit.inner.camera.push({ x: 300, y: 20 }, 0.12);
    hit.fire();
    let inField = 0;
    for (let i = 0; i < 60; i++) {
      hit.screen.update(16);
      const drawn = hit.page();
      drawn.texts.forEach((text, at) => { if (/^(-\d+|MISS)$/.test(text.text) && drawn.kept.texts[at]) inField++; });
    }
    expect(inField).toBeGreaterThan(0);
  });
});

describe('the last machine of a battle', () => {
  test('is looked at from twice as close, and that look has the picture to itself: no push is left under it or after it', () => {
    const { flow, screen, ready, fire } = screenOf(fight(['gun-turret'], [0]));
    ready();
    fire();
    for (let i = 0; i < 200 && !screen.motion.finish; i++) screen.update(16);
    expect(flow.state.outcome).toBe('victory');
    const focus = screen.motion.finish!;
    expect(screen.motion.view).toEqual({ x: focus.x, y: focus.y, zoom: FINISH_ZOOM });
    // While it lasts the view is that look and nothing else.
    for (let i = 0; i < 400 && screen.motion.finish; i++) {
      expect(screen.motion.view.zoom).toBe(FINISH_ZOOM);
      screen.update(16);
    }
    // And when it is over the camera is at home at once: the blow that ended it left no push behind.
    expect(screen.motion.finish).toBeNull();
    expect(screen.motion.view).toBe(HOME);
    for (let i = 0; i < 60; i++) { screen.update(16); expect(screen.motion.view).toBe(HOME); }
  });

  test('in a calm picture it is looked at from where the field always is', () => {
    const { screen, ready, fire } = screenOf(fight(['gun-turret'], [0]), { calm: true });
    ready();
    fire();
    for (let i = 0; i < 200 && !screen.motion.finish; i++) screen.update(16);
    expect(screen.motion.finish).not.toBeNull();
    expect(screen.motion.view).toBe(HOME);
  });
});
