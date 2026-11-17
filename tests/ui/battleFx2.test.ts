import type { BattleEvent } from '../../src/core/battle';
import type { DamageType } from '../../src/core/types';
import { BattleFx, DEATH_MS, HARDEST_JOLT, HIT_MS, MELEE_MS, PROJECTILE_MS, SHELL_MS, type Fx, type Scene } from '../../src/ui/battleFx';
import { TYPE_COLOR, lightsOf, paintFx } from '../../src/ui/fxPaint';
import { FIELD_LIGHT } from '../../src/ui/light';
import { record } from '../helpers/canvas';

/** What battles look like since the round of the look: what each event shows, when, and what light it throws. */

const sceneOf = (dtype: DamageType, melee = false): Scene => ({
  muzzle: (unit) => (unit === 'player' ? { x: 100, y: 50 } : { x: 220, y: 60 }),
  hitPoint: (unit) => (unit === 'player' ? { x: 80, y: 70 } : { x: 240, y: 60 }),
  centre: (unit) => (unit === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
  facing: (unit) => (unit === 'player' ? 1 : -1),
  damageType: () => dtype,
  isMelee: () => melee,
});
const shot = (hit = true, damage = 38): BattleEvent => ({
  type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit, damage: hit ? damage : 0,
});
const fxOf = (dtype: DamageType = 'kinetic', melee = false): BattleFx => new BattleFx(sceneOf(dtype, melee));
/** The kind of canvas most tests draw on: it takes any call and answers nothing. */
function standIn(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('what a shot shows, and when', () => {
  test('the timings that sounds and armour bars hang on are what they were', () => {
    expect([PROJECTILE_MS, SHELL_MS, HIT_MS, DEATH_MS, MELEE_MS]).toEqual([160, 260, 220, 550, 150]);
  });

  test.each([['kinetic', PROJECTILE_MS], ['energy', PROJECTILE_MS], ['explosive', SHELL_MS]] as [DamageType, number][])(
    'a %s weapon: the barrel flashes at once, something flies for %i ms, and it lands when the flight is over', (dtype, flight) => {
      const fx = fxOf(dtype);
      fx.onEvent(shot());
      fx.update(1);
      expect(fx.kinds()).toEqual(expect.arrayContaining(['muzzle', 'recoil', 'projectile']));
      expect(fx.kinds()).not.toContain('burst');
      fx.update(flight - 2);
      expect(fx.kinds()).toContain('projectile');
      expect(fx.kinds()).not.toContain('burst');
      fx.update(2);
      expect(fx.kinds()).toEqual(expect.arrayContaining(['burst', 'hit', 'text']));
      expect(fx.kinds()).not.toContain('projectile');
    });

  test('a shell goes up where it lands; a bullet or a beam strikes', () => {
    const lands = (dtype: DamageType, flight: number) => {
      const fx = fxOf(dtype);
      fx.onEvent(shot());
      fx.update(flight + 1);
      return fx.bursts();
    };
    expect(lands('explosive', SHELL_MS)).toEqual([{ style: 'fire', size: 14 }]);
    expect(lands('kinetic', PROJECTILE_MS)).toEqual([{ style: 'impact', size: 8 }]);
    expect(lands('energy', PROJECTILE_MS)).toEqual([{ style: 'impact', size: 8 }]);
  });

  test('a miss lands nowhere: no burst, only the word', () => {
    const fx = fxOf('explosive');
    fx.onEvent(shot(false));
    fx.update(SHELL_MS + 1);
    expect(fx.bursts()).toEqual([]);
    expect(fx.texts()).toEqual(['MISS']);
  });

  test('a blade is carried to its target: no flash from a barrel, a lunge and then the arc', () => {
    const fx = fxOf('kinetic', true);
    fx.onEvent(shot());
    fx.update(1);
    expect(fx.kinds()).toEqual(['lunge']);
    fx.update(MELEE_MS);
    expect(fx.kinds()).toEqual(expect.arrayContaining(['slash', 'burst', 'hit']));
  });

  test('a module pulses, a part that is shot off burns, and a machine that changes its ways sends out three rings', () => {
    const at = (event: BattleEvent, ms: number) => { const fx = fxOf(); fx.onEvent(event); fx.update(ms); return fx.bursts(); };
    expect(at({ type: 'module', unit: 'player', effect: 'barrier', amount: 90 }, 1)).toEqual([{ style: 'ring', size: 22 }]);
    expect(at({ type: 'partDestroyed', unit: 'enemy-0', part: 'arms' }, 1)).toEqual([{ style: 'fire', size: 9 }]);
    expect(at({ type: 'phase', unit: 'enemy-0', phase: 1 }, 300)).toEqual([{ style: 'ring', size: 18 }, { style: 'ring', size: 30 }, { style: 'ring', size: 44 }]);
    expect(at({ type: 'launch', unit: 'enemy-0', spawned: 'enemy-1' }, 1)).toEqual([{ style: 'ring', size: 12 }]);
  });
});

describe('how hard a blow throws the field', () => {
  const jolts = (fx: BattleFx): number[] => (fx as unknown as { jolts: { amount: number }[] }).jolts.map((jolt) => jolt.amount);

  test('a bomb going off is the hardest blow there is: nothing else throws the field as far, and nothing can throw it further', () => {
    expect(HARDEST_JOLT).toBe(5);
    const events: BattleEvent[] = [
      { ...shot(true, 80) },
      { type: 'partDestroyed', unit: 'enemy-0', part: 'arms' } as BattleEvent,
      { type: 'unitDestroyed', unit: 'enemy-0' },
      { type: 'stagger', unit: 'enemy-0' } as BattleEvent,
      { type: 'phase', unit: 'enemy-0', phase: 1 } as BattleEvent,
      { type: 'overdrive', unit: 'player', kind: 'iron-skin' } as BattleEvent,
    ];
    let most = 0;
    for (const event of events) {
      const fx = fxOf();
      fx.onEvent(event);
      for (const amount of jolts(fx)) {
        expect(amount, event.type).toBeLessThan(HARDEST_JOLT);
        most = Math.max(most, amount);
      }
    }
    expect(most).toBeGreaterThanOrEqual(3);
    const bomb = fxOf();
    bomb.onEvent({ type: 'blast', unit: 'enemy-0', target: 'player', damage: 80 } as BattleEvent);
    expect(jolts(bomb)).toEqual([HARDEST_JOLT]);
    // Asked for harder than that, a jolt is as hard as that: the field is never thrown further, at any moment of it.
    const over = fxOf();
    (over as unknown as { jolt(delay: number, amount: number, dur: number): void }).jolt(0, 40, 450);
    expect(jolts(over)).toEqual([HARDEST_JOLT]);
    let furthest = 0;
    for (let ms = 0; ms < 460; ms += 4) {
      over.update(4);
      const { dx, dy } = over.shake();
      furthest = Math.max(furthest, Math.abs(dx), Math.abs(dy));
    }
    expect(furthest).toBeLessThanOrEqual(HARDEST_JOLT);
    expect(furthest).toBeGreaterThanOrEqual(HARDEST_JOLT - 1);
    expect(over.shake()).toEqual({ dx: 0, dy: 0 });
  });
});

describe('what is written over the field', () => {
  test('what a convoy loses is no part of the stage: it is drawn only when what is over the field is asked for, and nothing else is then', () => {
    const fx = fxOf();
    fx.onEvent(shot());
    fx.onEvent({ type: 'asset', hp: 5, lost: 7 });
    fx.update(PROJECTILE_MS + 1);
    expect(fx.texts().sort()).toEqual(['-38', '-7']);
    const stage = record((ctx) => fx.draw(ctx));
    expect(new Set(stage.texts.map((t) => t.text))).toEqual(new Set(['-38']));
    expect(stage.rects.length).toBeGreaterThan(0);
    expect(record((ctx) => fx.draw(ctx, false, 'stage'))).toEqual(stage);
    const over = record((ctx) => fx.draw(ctx, false, 'over'));
    expect(new Set(over.texts.map((t) => t.text))).toEqual(new Set(['-7']));
    // Nothing but the figure: no flame, no burst, no tracer.
    expect([over.rects, over.glows, over.shapes, over.strokes]).toEqual([[], [], [], []]);
    // It starts under the strip in the top left corner, in the colour of something lost.
    const figure = over.texts.at(-1)!;
    expect(figure.x).toBe(30);
    expect(figure.y).toBeLessThanOrEqual(34);
    expect(figure.y).toBeGreaterThan(26);
    expect(figure.color).toBe('#e04a2c');
    // With nothing lost there is nothing to write.
    const none = fxOf();
    none.onEvent({ type: 'asset', hp: 12, lost: 0 });
    none.update(1);
    expect(none.texts()).toEqual([]);
  });
});

describe('a machine going up', () => {
  const gone: BattleEvent = { type: 'unitDestroyed', unit: 'enemy-0' };

  test('goes in pieces first and then all at once: three small blasts, and one large that outlasts the wreck', () => {
    const fx = fxOf();
    fx.onEvent(gone);
    fx.update(1);
    expect(fx.bursts()).toEqual([{ style: 'fire', size: 11 }]);
    fx.update(230);
    expect(fx.bursts().map((b) => b.size)).toEqual([11, 12, 13]);
    fx.update(80);
    // The last and largest: more than twice the size of any before it.
    expect(fx.bursts().map((b) => b.size)).toContain(26);
    fx.update(DEATH_MS - 311);
    expect(fx.isGone('enemy-0')).toBe(true);
    // The wreck is gone and its last blast is still burning out.
    expect(fx.bursts()).toEqual([{ style: 'fire', size: 26 }]);
    expect(fx.busy).toBe(true);
    fx.update(400);
    expect(fx.busy).toBe(false);
  });

  test('shakes the field twice: as it starts to go, and harder when it goes', () => {
    const fx = fxOf();
    fx.onEvent(gone);
    const reach = (from: number, to: number): number => {
      let most = 0;
      for (let t = from; t < to; t += 10) { fx.update(10); const { dx, dy } = fx.shake(); most = Math.max(most, Math.abs(dx), Math.abs(dy)); }
      return most;
    };
    expect(reach(0, 280)).toBeGreaterThan(0);
    expect(reach(280, 600)).toBeGreaterThan(0);
    expect(reach(600, 1200)).toBe(0);
  });
});

describe('the light of an effect', () => {
  const at = { x: 100, y: 80 };
  const each: Fx[] = [
    { kind: 'muzzle', at, dtype: 'kinetic', aim: { x: 1, y: 0 }, size: 1, start: 0, dur: 90 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'kinetic', grow: [1, 1], start: 0, dur: 160 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'energy', grow: [1, 1], start: 0, dur: 160 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'explosive', grow: [1, 1], start: 0, dur: 260 },
    { kind: 'burst', at, size: 8, color: '#ffe9a8', style: 'impact', start: 0, dur: 220 },
    { kind: 'burst', at, size: 14, color: '#ffb46b', style: 'fire', start: 0, dur: 340 },
    { kind: 'burst', at, size: 22, color: '#4aa8ff', style: 'ring', start: 0, dur: 320 },
    { kind: 'sparks', at, color: '#ffd27f', start: 0, dur: 380 },
    { kind: 'steam', at, start: 0, dur: 520 },
    { kind: 'lunge', unit: 'player', from: at, aim: { x: 1, y: 0 }, start: 0, dur: 320 },
    { kind: 'slash', at, dir: 1, color: '#7fe9ff', start: 0, dur: 200 },
    { kind: 'shield', at, aim: { x: 1, y: 0 }, start: 0, dur: 420 },
    { kind: 'gather', at, color: '#7fe9ff', start: 0, dur: 480 },
    { kind: 'text', at, text: '-38', color: '#ffffff', start: 0, dur: 650 },
    // The same as they are over the shoulder: larger than life where they leave and smaller where they land (or the other way), and aimed across the floor.
    { kind: 'muzzle', at, dtype: 'kinetic', aim: { x: 0.8, y: -0.6 }, size: 1.2, start: 0, dur: 90 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'kinetic', grow: [1.2, 0.7], start: 0, dur: 160 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'energy', grow: [1.2, 0.7], start: 0, dur: 160 },
    { kind: 'projectile', from: at, to: { x: 240, y: 60 }, dtype: 'explosive', grow: [0.7, 1.2], start: 0, dur: 260 },
    { kind: 'lunge', unit: 'player', from: at, aim: { x: 0.8, y: -0.6 }, start: 0, dur: 320 },
    { kind: 'shield', at, aim: { x: -0.8, y: 0.6 }, start: 0, dur: 420 },
  ];
  const moments = [0, 0.1, 0.25, 0.5, 0.75, 0.99];

  test('is never darker than nothing or brighter than everything, and always has a size', () => {
    for (const fx of each) {
      for (const p of moments) {
        for (const glow of lightsOf(fx, p)) {
          expect(glow.alpha, `${fx.kind} at ${p}`).toBeGreaterThanOrEqual(0);
          expect(glow.alpha, `${fx.kind} at ${p}`).toBeLessThanOrEqual(1);
          expect(glow.r, `${fx.kind} at ${p}`).toBeGreaterThan(0);
          expect(Number.isFinite(glow.x) && Number.isFinite(glow.y)).toBe(true);
        }
      }
    }
  });

  test('a barrel, a beam, a blast, sparks, a blade, a guard, a charge and a jet all throw light; steam and figures throw none', () => {
    const lit = (kind: Fx['kind']) => each.filter((fx) => fx.kind === kind).every((fx) => lightsOf(fx, 0.2).length > 0);
    for (const kind of ['muzzle', 'projectile', 'burst', 'sparks', 'slash', 'shield', 'gather', 'lunge'] as const) expect(lit(kind), kind).toBe(true);
    for (const kind of ['steam', 'text'] as const) expect(each.filter((fx) => fx.kind === kind).every((fx) => lightsOf(fx, 0.2).length === 0), kind).toBe(true);
  });

  test('a jet burns behind the unit that lunges: brightest half way, out at both ends', () => {
    const lunge = each[9];
    expect(lightsOf(lunge, 0.5)[0]).toMatchObject({ x: 70, y: 86, r: 40 });
    expect(lightsOf(lunge, 0.5)[0].alpha).toBeCloseTo(0.75, 6);
    expect(lightsOf(lunge, 0)[0].alpha).toBeCloseTo(0, 6);
    expect(lightsOf(lunge, 1)[0].alpha).toBeCloseTo(0, 6);
  });

  test('a barrel\'s light is its weapon\'s colour and dies with the flash', () => {
    const [flash] = each;
    expect(lightsOf(flash, 0)[0]).toMatchObject({ color: TYPE_COLOR.kinetic, r: 46 });
    expect(lightsOf(flash, 0)[0].alpha).toBeCloseTo(0.9, 6);
    expect(lightsOf(flash, 0.5)[0].alpha).toBeCloseTo(0.45, 6);
    expect(lightsOf(flash, 1)[0].alpha).toBe(0);
  });

  test('a fire lights the whole field for its first moments only, and that light is the one a calm picture leaves out', () => {
    const fire = each[5];
    const early = lightsOf(fire, 0.1);
    expect(early).toHaveLength(2);
    expect(early.map((g) => g.r > FIELD_LIGHT)).toEqual([false, true]);
    // What is left once the first flash is over is small enough for a calm picture to keep.
    const later = lightsOf(fire, 0.4);
    expect(later).toHaveLength(1);
    expect(later[0].r).toBeLessThanOrEqual(FIELD_LIGHT);
    // A machine's last blast is wide enough that a calm picture leaves its light out altogether: the fire is still drawn.
    const wreck: Fx = { kind: 'burst', at, size: 26, color: '#ff8a3c', style: 'fire', start: 0, dur: 480 };
    for (const p of [0.1, 0.4, 0.8]) for (const glow of lightsOf(wreck, p)) expect(glow.r).toBeGreaterThan(FIELD_LIGHT);
    expect(record((ctx) => paintFx(ctx, wreck, 0.4)).rects.length).toBeGreaterThan(50);
  });

  test('a beam is lit at both ends, and its far end travels with it', () => {
    const beam = each[2];
    const start = lightsOf(beam, 0.1);
    expect(start).toHaveLength(2);
    expect(start[0]).toMatchObject({ x: 100, y: 80 });
    expect(start[1].x).toBeGreaterThan(100);
    expect(start[1].x).toBeLessThan(240);
    expect(lightsOf(beam, 0.5)[1]).toMatchObject({ x: 240, y: 60 });
    // It dies away at the end instead of going out all at once.
    expect(lightsOf(beam, 0.9)[1].alpha).toBeLessThan(lightsOf(beam, 0.5)[1].alpha);
  });

  test('an effects list with nothing playing throws no light', () => {
    const fx = fxOf();
    expect(fx.lights()).toEqual([]);
    fx.onEvent(shot());
    expect(fx.lights().length).toBeGreaterThan(0);
    fx.update(5000);
    expect(fx.lights()).toEqual([]);
  });

  describe('as it is painted', () => {
    test('everything solid is on the pixel grid: whole pixels, never a fraction', () => {
      for (const fx of each) {
        for (const p of moments) {
          const page = record((ctx) => paintFx(ctx, fx, p));
          for (const r of page.rects) for (const n of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(n), `${fx.kind} at ${p}: ${n}`).toBe(true);
        }
      }
    });

    test('every kind paints something somewhere in its life, and leaves the canvas opaque when it is done', () => {
      for (const fx of each) {
        if (fx.kind === 'text') continue;
        const painted = moments.reduce((sum, p) => sum + record((ctx) => paintFx(ctx, fx, p)).rects.length, 0);
        expect(painted, fx.kind).toBeGreaterThan(0);
      }
      for (const fx of each) {
        for (const p of moments) {
          record((ctx) => { paintFx(ctx, fx, p); expect(ctx.globalAlpha, `${fx.kind} at ${p}`).toBe(1); expect(ctx.globalCompositeOperation, fx.kind).toBe('source-over'); });
        }
      }
    });

    test('a canvas that can do nothing is painted on without error', () => {
      const ctx = standIn();
      expect(() => { for (const fx of each) for (const p of moments) paintFx(ctx, fx, p); }).not.toThrow();
    });

    test('a fireball swells, and what is left of it at the end is smoke, not fire', () => {
      const fire = each[5];
      const reach = (p: number): number => {
        const rects = record((ctx) => paintFx(ctx, fire, p)).rects;
        return Math.max(...rects.map((r) => r.x + r.w)) - Math.min(...rects.map((r) => r.x));
      };
      expect(reach(0.3)).toBeGreaterThan(reach(0.02));
      const colours = (p: number) => new Set(record((ctx) => paintFx(ctx, fire, p)).rects.map((r) => r.color));
      expect(colours(0.05).has('#ffffff')).toBe(true);
      expect([...colours(0.95)].sort()).toEqual(['#3d3642', '#4c4654']);
    });

    test('a figure lands large and settles to its size', () => {
      const figure = each[13];
      const size = (p: number) => record((ctx) => paintFx(ctx, figure, p)).texts.at(-1)!.size;
      expect(size(0)).toBe(24);
      expect(size(0.1)).toBeGreaterThan(16);
      expect(size(0.2)).toBe(16);
      expect(size(0.9)).toBe(16);
    });
  });
});
