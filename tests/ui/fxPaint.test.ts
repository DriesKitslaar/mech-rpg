import type { BattleEvent } from '../../src/core/battle';
import type { DamageType } from '../../src/core/types';
import { drawAmbience } from '../../src/ui/ambience';
import { BattleFx, type Fx, type Scene } from '../../src/ui/battleFx';
import { lightsOf, paintFx } from '../../src/ui/fxPaint';
import { FIRE } from '../../src/ui/light';
import { Particles } from '../../src/ui/particles';
import { PARTICLES, drawWeather } from '../../src/ui/weather';
import { COLORS } from '../../src/ui/widgets';
import { record, type Drawn, type Filled } from '../helpers/canvas';

/**
 * How each effect is painted: which way it goes, how long it lasts, and when it is over. These are
 * the things nobody sees in a test run and everybody sees in the game.
 */

const AT = { x: 200, y: 90 };
const paint = (fx: Record<string, unknown>, p: number): Drawn => record((ctx) => paintFx(ctx, { start: 0, dur: 100, ...fx } as Fx, p));
/** The rows of a filled circle among what was drawn in this colour: a pixel high and more than a few wide. */
const rows = (page: Drawn, color: string, least = 4): Filled[] => page.rects.filter((r) => r.color === color && r.h === 1 && r.w >= least);
const middle = (rects: Filled[]): number => (Math.min(...rects.map((r) => r.y)) + Math.max(...rects.map((r) => r.y))) / 2;

describe('something struck', () => {
  const impact = (p: number): Drawn => paint({ kind: 'burst', style: 'impact', at: AT, size: 8, color: '#ffe9a8' }, p);

  test('the white flash is there for the first third of it and then gone', () => {
    expect(rows(impact(0.05), '#ffffff').length).toBeGreaterThan(4);
    expect(rows(impact(0.25), '#ffffff').length).toBeGreaterThan(4);
    for (const p of [0.3, 0.5, 0.8, 0.99]) expect(rows(impact(p), '#ffffff'), `at ${p}`).toEqual([]);
    // While it is there it grows.
    const wide = (p: number): number => Math.max(...rows(impact(p), '#ffffff').map((r) => r.w));
    expect(wide(0.25)).toBeGreaterThan(wide(0.05));
    // And the ring round it opens and fades to the end.
    const ring = (p: number): Filled[] => impact(p).rects.filter((r) => r.color === '#ffe9a8');
    expect(ring(0.9).length).toBeGreaterThan(0);
    expect(ring(0.9)[0].alpha).toBeLessThan(ring(0.1)[0].alpha);
  });
});

describe('fire', () => {
  const fire = (p: number): Drawn => paint({ kind: 'burst', style: 'fire', at: AT, size: 12, color: '#ff8a3c' }, p);

  test('rises as it burns: its heart is above where it began', () => {
    // At seven tenths of its life the heart is the only thing of its heat.
    const late = rows(fire(0.7), FIRE[4]);
    expect(late.length).toBeGreaterThan(4);
    expect(middle(late)).toBeLessThan(AT.y - 2);
    expect(middle(late)).toBeGreaterThan(AT.y - 6);
    // Its white core, while there is one, is where the fire is: on the spot at first, a pixel up a moment later.
    expect(middle(rows(fire(0.01), '#ffffff'))).toBe(AT.y);
    expect(middle(rows(fire(0.2), '#ffffff', 1))).toBe(AT.y - 1);
    expect(rows(fire(0.3), '#ffffff', 1)).toEqual([]);
  });

  test('smoke comes up behind it as it cools, higher than the fire, and the fire is out before the smoke is', () => {
    const SMOKE = ['#3d3642', '#4c4654'];
    const smoke = (p: number): Filled[] => fire(p).rects.filter((r) => SMOKE.includes(r.color));
    expect(smoke(0.2)).toEqual([]);
    expect(smoke(0.6).length).toBeGreaterThan(8);
    expect(Math.min(...smoke(0.9).map((r) => r.y))).toBeLessThan(Math.min(...smoke(0.4).map((r) => r.y)));
    // In its last fifth there is no fire left, only smoke.
    const burning = (p: number): Filled[] => fire(p).rects.filter((r) => FIRE.includes(r.color));
    expect(burning(0.7).length).toBeGreaterThan(0);
    expect(burning(0.85)).toEqual([]);
    expect(smoke(0.85).length).toBeGreaterThan(0);
  });
});

describe('a figure of damage', () => {
  const figure = (p: number): Drawn => paint({ kind: 'text', at: AT, text: '38', color: '#ffffff' }, p);

  test('rises over what it is about, sixteen pixels in all, and fades', () => {
    const y = (p: number): number => figure(p).texts.at(-1)!.y;
    expect(y(0)).toBe(AT.y);
    expect(y(0.5)).toBe(AT.y - 8);
    expect(y(1)).toBe(AT.y - 16);
    for (let p = 0.05; p <= 1; p += 0.05) expect(y(p)).toBeLessThanOrEqual(y(p - 0.05));
    // It lands large and settles to its size, with a dark edge round it.
    expect(figure(0).texts.at(-1)!.size).toBe(24);
    expect(figure(0.5).texts.at(-1)!.size).toBe(16);
    expect(figure(0.5).texts).toHaveLength(6);
    expect(figure(0.5).texts.slice(0, 5).every((t) => t.color === '#0a0812')).toBe(true);
  });
});

describe('a unit that lunges', () => {
  const lunge = (dir: number, p: number): Drawn => paint({ kind: 'lunge', unit: 'player', dir, from: AT, aim: { x: dir, y: 0 } }, p);
  const JET = ['#ffffff', '#bfe8ff', COLORS.energy];

  test('burns a jet behind it, never in front', () => {
    for (const dir of [1, -1]) {
      const jet = lunge(dir, 0.5).rects.filter((r) => JET.includes(r.color) && r.h === 1 && r.w >= 2);
      expect(jet.length).toBeGreaterThan(6);
      for (const row of jet) {
        // Behind: on the side it is coming from, and clear of its middle.
        const far = (row.x + row.w / 2 - AT.x) * -dir;
        expect(far, `dir ${dir}`).toBeGreaterThan(12);
      }
    }
    // The jet is at its longest half way through the lunge and gone at both ends of it.
    const reach = (p: number): number => {
      // The middle of the jet has a colour nothing else about a lunge has.
      const jet = lunge(1, p).rects.filter((r) => r.color === '#bfe8ff');
      return jet.length === 0 ? 0 : AT.x - Math.min(...jet.map((r) => r.x));
    };
    expect(reach(0.5)).toBeGreaterThan(reach(0.15));
    expect(reach(0.5)).toBeGreaterThan(reach(0.9));
    expect(reach(0.5)).toBeGreaterThan(40);
    // And its light is behind the unit too, strongest half way.
    const light = (p: number) => lightsOf({ start: 0, dur: 100, kind: 'lunge', unit: 'player', from: AT, aim: { x: 1, y: 0 } } as Fx, p)[0];
    expect(light(0.5).x).toBeLessThan(AT.x - 20);
    expect(light(0.5).alpha).toBeGreaterThan(light(0.1).alpha);
    expect(light(0.5).alpha).toBeGreaterThan(light(0.9).alpha);
  });
});

describe('effects in time', () => {
  const scene = (dtype: DamageType): Scene => ({
    muzzle: () => ({ x: 100, y: 50 }), hitPoint: () => ({ x: 240, y: 60 }), centre: (unit) => (unit === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
    facing: (unit) => (unit === 'player' ? 1 : -1), damageType: () => dtype, isMelee: () => false,
  });
  const shot: BattleEvent = { type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 30 };

  test('a barrel\'s flash is over in under a tenth of a second, and so is its light', () => {
    const fx = new BattleFx(scene('kinetic'));
    fx.onEvent(shot);
    fx.update(1);
    expect(fx.kinds()).toContain('muzzle');
    // The flash's light is the wide one; what flies has a small light of its own.
    const flash = (): number => Math.max(0, ...fx.lights().filter((g) => g.r > 30).map((g) => g.alpha));
    const early = flash();
    expect(early).toBeGreaterThan(0.6);
    fx.update(59);
    expect(fx.kinds()).toContain('muzzle');
    // It only ever fades: bright as the gun fires, dim as the flash ends.
    expect(flash()).toBeLessThan(early * 0.6);
    expect(flash()).toBeGreaterThan(0);
    fx.update(35);
    expect(fx.kinds()).not.toContain('muzzle');
    expect(flash()).toBe(0);
  });

  test('every light an effect throws is strongest when the effect begins', () => {
    const at = (kind: Record<string, unknown>, p: number): number => Math.max(0, ...lightsOf({ start: 0, dur: 100, ...kind } as Fx, p).map((g) => g.alpha));
    const fading = [
      { kind: 'muzzle', at: AT, dtype: 'kinetic', aim: { x: 1, y: 0 }, size: 1 },
      { kind: 'burst', style: 'fire', at: AT, size: 12, color: '#ff8a3c' },
      { kind: 'burst', style: 'impact', at: AT, size: 8, color: '#ffe9a8' },
      { kind: 'sparks', at: AT, color: '#ffe9a8' },
    ];
    for (const kind of fading) {
      expect(at(kind, 0.05), String(kind.kind)).toBeGreaterThan(at(kind, 0.6));
      expect(at(kind, 0.6), String(kind.kind)).toBeGreaterThanOrEqual(at(kind, 0.95));
      expect(at(kind, 0.05), String(kind.kind)).toBeGreaterThan(0.3);
    }
  });

  test('a machine going up shakes the field by a few pixels and no more', () => {
    const fx = new BattleFx(scene('kinetic'));
    fx.onEvent({ type: 'unitDestroyed', unit: 'enemy-0' });
    let most = 0;
    let shaken = 0;
    for (let t = 0; t < 900; t += 8) {
      fx.update(8);
      const { dx, dy } = fx.shake();
      most = Math.max(most, Math.abs(dx), Math.abs(dy));
      if (dx !== 0 || dy !== 0) shaken++;
    }
    expect(shaken).toBeGreaterThan(5);
    expect(most).toBeGreaterThanOrEqual(2);
    expect(most).toBeLessThanOrEqual(5);
  });
});

describe('what is thrown up', () => {
  test('what glows in the air throws less light the older it gets', () => {
    const particles = new Particles(3);
    particles.emit('fire', AT, 1);
    particles.update(16);
    const young = particles.lights();
    expect(young.length).toBeGreaterThan(0);
    const early = Math.max(...young.map((g) => g.alpha));
    particles.update(200);
    const old = particles.lights();
    expect(old.length).toBeGreaterThan(0);
    expect(Math.max(...old.map((g) => g.alpha))).toBeLessThan(early);
    expect(early).toBeLessThanOrEqual(0.5);
    expect(early).toBeGreaterThan(0.3);
  });

  test('smoke and flame are drawn as wide as they are and no wider', () => {
    const particles = new Particles(3);
    particles.emit('smoke', AT, 1);
    particles.emit('fire', AT, 1);
    let widest = 0;
    let round = 0;
    for (let t = 0; t < 1200; t += 48) {
      particles.update(48);
      const page = record((ctx) => particles.draw(ctx));
      // The rows of what is round: a pixel high, wider than a spark.
      const discs = page.rects.filter((r) => r.h === 1 && r.w >= 3);
      round += discs.length;
      widest = Math.max(widest, ...discs.map((r) => r.w), 0);
    }
    expect(round).toBeGreaterThan(20);
    // A puff of smoke at its largest is a dozen pixels across.
    expect(widest).toBeLessThanOrEqual(14);
    expect(widest).toBeGreaterThanOrEqual(5);
  });
});

describe('the edges of a place, and its rain', () => {
  test('the edges are darker than the middle by half, never black', () => {
    const page = record((ctx) => drawAmbience(ctx, 'bg-mine', 0, 'behind', { top: 14, height: 164, width: 310 }));
    const vignette = page.glows.find((g) => g.blend === 'source-over' && g.stops[0][1] === 'rgba(4, 4, 14, 0)')!;
    expect(vignette.stops).toEqual([[0, 'rgba(4, 4, 14, 0)'], [1, 'rgba(4, 4, 14, 0.5)']]);
    // Round the middle of the field, reaching its corners.
    expect(vignette).toMatchObject({ x: 155, y: 96 });
    expect(vignette.r).toBeCloseTo(Math.hypot(310, 164) / 2, 5);
  });

  test('rain falls: down, and a little to the left', () => {
    const drops = (ms: number): Filled[] => record((ctx) => drawWeather(ctx, 'rain', ms, 310, 164)).rects;
    const now = drops(5000);
    const next = drops(5016);
    expect(now).toHaveLength(PARTICLES.rain);
    let fell = 0;
    let left = 0;
    now.forEach((drop, i) => {
      // A drop that has reached the bottom starts again at the top: that one is much higher, not a little.
      if (next[i].y >= drop.y) fell++;
      else expect(drop.y - next[i].y).toBeGreaterThan(100);
      if (next[i].x <= drop.x) left++;
      expect(next[i].y - drop.y).toBeLessThan(8);
    });
    expect(fell).toBeGreaterThanOrEqual(PARTICLES.rain - 4);
    expect(left).toBeGreaterThanOrEqual(PARTICLES.rain - 4);
    // Over a quarter of a second every drop has moved, the near ones further than the far ones.
    const later = drops(5250);
    const moved = now.map((drop, i) => ({ long: drop.h === 5, by: later[i].y - drop.y })).filter((d) => d.by > 0);
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(moved.filter((d) => d.long).map((d) => d.by))).toBeGreaterThan(mean(moved.filter((d) => !d.long).map((d) => d.by)));
  });
});
