import { createBattle, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { FIELD_LIGHT, MAX_LIGHTS } from '../../src/ui/light';
import { MAX_PARTICLES, PARTICLE_LIGHTS, Particles } from '../../src/ui/particles';
import type { SpriteStore } from '../../src/ui/sprites';
import { record, type Drawn, type Glowed } from '../helpers/canvas';

/** The look of the field in battle: what stands on it, what lights it, and when it is left alone. */

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const isShadow = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1].startsWith('rgba(0, 0, 8,');
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
/** How bright a light is at its middle. */
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);

function battle(seed = 7, wound = false): BattleState {
  // Two machines that stand on the ground: what flies burns underneath, and that is a light of its own.
  const state = createBattle(DEMO_BUILD, [ENEMIES.tank, ENEMIES['gun-turret']], CATALOG, seed);
  // A machine with one point of armour left goes up at the first thing that lands.
  if (wound) for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 1;
  return state;
}
function screenOf(opts: { fast?: boolean; calm?: boolean; state?: BattleState } = {}) {
  const flow = new BattleFlow(opts.state ?? battle(), CATALOG, { quiet: true });
  // On ground that has no lamps or signs of its own, so that every light seen is the battle's.
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: 'bg-nowhere', ...(opts.calm ? { calm: true } : {}) });
  // Past the banner that opens the battle, to the pilot's own menu.
  for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
  expect(flow.phase).toBe('action');
  const fire = (): void => { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); };
  const page = (): Drawn => record((ctx) => screen.draw(ctx));
  return { flow, screen, fire, page };
}

describe('shadows', () => {
  test('every unit stands on one: the pilot and each machine, flat on the ground under them', () => {
    const { page } = screenOf({ fast: true });
    const shadows = page().glows.filter(isShadow);
    expect(shadows).toHaveLength(3);
    for (const shadow of shadows) {
      expect(shadow.ry).toBeLessThan(shadow.r / 3);
      expect(shadow.y).toBeGreaterThan(90);
      expect(shadow.y).toBeLessThanOrEqual(175);
    }
    // The pilot's is the widest and furthest left.
    const widest = shadows.reduce((a, b) => (b.r > a.r ? b : a));
    expect(widest.x).toBe(Math.min(...shadows.map((s) => s.x)));
  });

  test('a machine that is gone leaves none', () => {
    const { flow, screen, fire, page } = screenOf({ fast: true, state: battle(7, true) });
    for (let i = 0; i < 12 && !flow.state.units[1].destroyed && flow.phase === 'action'; i++) { fire(); screen.update(16); }
    expect(flow.state.units[1].destroyed).toBe(true);
    screen.update(16);
    expect(page().glows.filter(isShadow)).toHaveLength(2);
  });
});

describe('light on the field', () => {
  test('a hurried screen adds none, whatever is fired', () => {
    const { screen, fire, page } = screenOf({ fast: true });
    fire();
    screen.update(16);
    expect(page().glows.filter(isLight)).toEqual([]);
  });

  test('a gun going off lights the field around its barrel, and the light is gone when the volley is over', () => {
    const { screen, fire, page } = screenOf();
    expect(page().glows.filter(isLight)).toEqual([]);
    fire();
    screen.update(32);
    const lights = page().glows.filter(isLight);
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.length).toBeLessThanOrEqual(MAX_LIGHTS);
    // The barrel's own: at the end of the pilot's gun, short of the machines it is aimed at, in the gun's colour.
    const barrel = lights.find((g) => g.r === 46)!;
    expect(barrel.x).toBeGreaterThan(120);
    expect(barrel.x).toBeLessThan(200);
    expect(barrel.stops[0][1]).toMatch(/^rgba\(255, 233, 168, /);
    for (let i = 0; i < 200; i++) screen.update(16);
    expect(page().glows.filter(isLight)).toEqual([]);
  });

  test('the one that fires is lit by its own gun for a moment; a calm picture leaves that out', () => {
    const lit = (calm: boolean): string[] => {
      const { screen, fire, page } = screenOf({ calm });
      fire();
      screen.update(32);
      return [...new Set(page().images.map((i) => i.filter))];
    };
    expect(lit(false)).toContain('brightness(1.35)');
    expect(lit(true)).toEqual(['none']);
  });

  test('a calm picture has the same lights at half strength, and none that covers the field', () => {
    const at = (calm: boolean): Glowed[] => {
      const { screen, fire, page } = screenOf({ calm });
      fire();
      screen.update(32);
      return page().glows.filter(isLight);
    };
    const plain = at(false);
    const calm = at(true);
    const barrel = (lights: Glowed[]) => lights.find((g) => g.r === 46)!;
    expect(strength(barrel(calm))).toBeCloseTo(strength(barrel(plain)) / 2, 2);
    for (const light of calm) expect(light.r).toBeLessThanOrEqual(FIELD_LIGHT);
  });

  test('a machine that went up keeps smoking and smouldering where it stood, for as long as the battle lasts', () => {
    const { flow, screen, fire, page } = screenOf({ state: battle(7, true) });
    for (let i = 0; i < 12 && !flow.state.units[1].destroyed; i++) {
      if (flow.phase === 'action') fire();
      for (let j = 0; j < 120; j++) screen.update(16);
    }
    expect(flow.state.units[1].destroyed).toBe(true);
    expect(flow.state.outcome).toBe('ongoing');
    for (let i = 0; i < 400; i++) screen.update(16);
    const later = page();
    const ember = later.glows.filter(isLight).filter((g) => g.stops[0][1].startsWith('rgba(255, 122, 48,'));
    expect(ember).toHaveLength(1);
    expect(ember[0].r).toBe(26);
    expect(later.rects.some((r) => r.color === '#3a3644' || r.color === '#4a4654')).toBe(true);
    // A hurried screen draws neither.
    const hurried = screenOf({ fast: true, state: battle(7, true) });
    for (let i = 0; i < 12 && !hurried.flow.state.units[1].destroyed && hurried.flow.phase === 'action'; i++) { hurried.fire(); hurried.screen.update(16); }
    hurried.screen.update(16);
    const still = hurried.page();
    expect(still.glows.filter(isLight)).toEqual([]);
    expect(still.rects.some((r) => r.color === '#3a3644' || r.color === '#4a4654')).toBe(false);
  });
});

describe('what is in the air', () => {
  const at = { x: 100, y: 100 };

  test('there may be more of it than before, and still no more than there is room for', () => {
    expect(MAX_PARTICLES).toBe(320);
    const p = new Particles(3);
    for (let i = 0; i < 80; i++) p.emit('debris', at, 1);
    p.update(16);
    expect(p.count).toBe(MAX_PARTICLES);
  });

  test('flames rise, shrink and burn out through fire\'s colours', () => {
    const p = new Particles(5);
    p.emit('fire', at, 1);
    p.update(16);
    expect(p.count).toBe(7);
    const young = p.all().map((f) => ({ y: f.y, size: f.size }));
    const colour = (): string[] => [...new Set(record((ctx) => p.draw(ctx)).rects.map((r) => r.color))];
    const first = colour();
    p.update(200);
    expect(p.all().every((f, i) => f.y < young[i].y)).toBe(true);
    expect(p.all().every((f, i) => f.size < young[i].size)).toBe(true);
    expect(colour()).not.toEqual(first);
    p.update(700);
    expect(p.count).toBe(0);
  });

  test('smoke is round once there is enough of it; a spark is one pixel', () => {
    const smoke = new Particles(5);
    smoke.emit('smoke', at, 1);
    smoke.update(600);
    const puffs = record((ctx) => smoke.draw(ctx)).rects;
    expect(puffs.length).toBeGreaterThan(smoke.count * 3);
    // Rows of different widths: a disc, not a square.
    expect(new Set(puffs.map((r) => r.w)).size).toBeGreaterThan(2);
    const sparks = new Particles(5);
    sparks.emit('sparks', at, 1);
    sparks.update(30);
    expect(record((ctx) => sparks.draw(ctx)).rects).toHaveLength(sparks.count);
  });

  test('what glows throws a little light: sparks, embers and flames, a few lights for all of them, and smoke none', () => {
    expect(PARTICLE_LIGHTS).toBe(8);
    const p = new Particles(5);
    expect(p.lights()).toEqual([]);
    p.emit('smoke', at, 1);
    p.emit('debris', at, 1);
    p.update(16);
    expect(p.lights()).toEqual([]);
    for (let i = 0; i < 6; i++) { p.emit('sparks', at, 1); p.emit('embers', at, 1); p.emit('fire', at, 1); }
    p.update(16);
    const lights = p.lights();
    expect(lights.length).toBeGreaterThan(4);
    expect(lights.length).toBeLessThanOrEqual(8);
    for (const light of lights) {
      expect(light.alpha).toBeGreaterThan(0);
      expect(light.alpha).toBeLessThanOrEqual(0.5);
      expect(light.r).toBeLessThan(16);
    }
    // They die with what throws them.
    p.update(2000);
    expect(p.lights()).toEqual([]);
  });
});

describe('a unit that lunges', () => {
  test('leaves two after-images behind it, the further the fainter, and none when the screen is hurried', () => {
    const boost = (fast: boolean) => {
      const made = screenOf({ fast });
      // Boost is the second row of the pilot's menu.
      made.screen.onInput('down');
      made.screen.onInput('confirm');
      for (let i = 0; i < 6; i++) made.screen.update(16);
      return made;
    };
    const watched = boost(false);
    expect(watched.flow.state.units[0].boosted).toBe(true);
    const faint = watched.page().images.filter((image) => image.alpha < 1 && image.alpha > 0.05);
    expect([...new Set(faint.map((image) => image.alpha))].sort()).toEqual([0.14, 0.3]);
    // The same mech three times over: twice faint, once whole.
    const id = (image: { image: unknown }): string => (image.image as { id: string }).id;
    const whole = watched.page().images.filter((image) => image.alpha === 1 && faint.some((f) => id(f) === id(image)));
    expect(whole.length).toBeGreaterThan(0);
    // Each after-image stands behind the mech: to its left, since the pilot faces right.
    const layer = id(faint[0]);
    const xs = (alpha: number) => watched.page().images.filter((image) => id(image) === layer && image.alpha === alpha).map((image) => image.x);
    expect(xs(0.3)[0]).toBeLessThan(xs(1)[0]);
    expect(xs(0.14)[0]).toBeLessThan(xs(0.3)[0]);
    const hurried = boost(true);
    expect(hurried.page().images.filter((image) => image.alpha < 1 && image.alpha > 0.05)).toEqual([]);
  });
});
