import { HEAT_LIMIT, createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import type { Build, DamageType } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleFx, FAR_SIZE, LUNGE_PX, MELEE_MS, NEAR_SIZE, RECOIL_PX, WRECK_AT, WRECK_SIZE, sizeAt, type Fx, type Scene } from '../../src/ui/battleFx';
import { BattleScreen, GENERATOR, PUSH } from '../../src/ui/battleScreen';
import { HOME } from '../../src/ui/camera';
import { lightsOf, paintFx } from '../../src/ui/fxPaint';
import { drawTaper, setDetail, type Pt } from '../../src/ui/light';
import type { Sprite, SpriteStore } from '../../src/ui/sprites';
import { ENEMY_LEFT, ENEMY_RIGHT, FAR_LINE, HERO, NEAR_LINE } from '../../src/ui/stage';
import { onStage, record, type Drawn, type Filled, type Pictured } from '../helpers/canvas';
import { eyesIn, generatorIn } from '../helpers/eyes';

/**
 * Depth in what happens on the field. The pilot's mech is near the camera and what it fights is
 * far off: what is fired from the one at the other is drawn smaller as it goes, a blast far off is
 * smaller than one near, a lunge and a gun's kick go along the line between the two, and the
 * pilot's mech, whose eye cannot be seen, has a light on its back.
 */

const paint = (fx: Record<string, unknown>, p: number): Drawn => record((ctx) => paintFx(ctx, { start: 0, dur: 100, ...fx } as Fx, p));
const FROM = { x: 100, y: 120 };
const TO = { x: 240, y: 80 };
const length = (v: Pt): number => Math.hypot(v.x, v.y);
const HOME_X = HOME.x;

describe('how large something is for how far off it is', () => {
  test('a fifth larger than life as near as the pilot\'s mech, seven tenths on the farthest line, and in between in between', () => {
    expect(sizeAt(0)).toBe(NEAR_SIZE);
    expect(sizeAt(1)).toBe(FAR_SIZE);
    expect([NEAR_SIZE, FAR_SIZE]).toEqual([1.2, 0.7]);
    expect(sizeAt(0.5)).toBeCloseTo(0.95, 6);
    for (let tenth = 0; tenth < 10; tenth++) expect(sizeAt(tenth / 10)).toBeGreaterThan(sizeAt((tenth + 1) / 10));
    // Nearer than near and further than far there is nothing.
    expect(sizeAt(-3)).toBe(NEAR_SIZE);
    expect(sizeAt(7)).toBe(FAR_SIZE);
  });
});

describe('what the effects are told about a scene with depth', () => {
  /** A scene laid out over the shoulder: the pilot near and lower left, two enemies further off and higher. */
  const places: Record<string, { muzzle: Pt; hit: Pt; centre: Pt; foot: Pt; depth: number; heading: Pt }> = {
    player: { muzzle: { x: 150, y: 80 }, hit: { x: 60, y: 100 }, centre: { x: 62, y: 115 }, foot: { x: 62, y: 177 }, depth: 0, heading: { x: 0.9, y: -0.436 } },
    'enemy-0': { muzzle: { x: 200, y: 96 }, hit: { x: 230, y: 90 }, centre: { x: 230, y: 96 }, foot: { x: 230, y: 118 }, depth: 1, heading: { x: -0.99, y: 0.14 } },
    'enemy-1': { muzzle: { x: 240, y: 140 }, hit: { x: 270, y: 136 }, centre: { x: 270, y: 140 }, foot: { x: 270, y: 160 }, depth: 0.3, heading: { x: -0.98, y: -0.2 } },
  };
  const scene = (dtype: DamageType, melee = false): Scene => ({
    muzzle: (id) => places[id].muzzle, hitPoint: (id) => places[id].hit, centre: (id) => places[id].centre,
    facing: (id) => (id === 'player' ? 1 : -1), depth: (id) => places[id].depth, heading: (id) => places[id].heading, foot: (id) => places[id].foot,
    damageType: () => dtype, isMelee: () => melee,
  });
  const flat = (dtype: DamageType, melee = false): Scene => {
    const { depth: _depth, heading: _heading, foot: _foot, ...rest } = scene(dtype, melee);
    return rest;
  };
  const shot = (unit: string, target: string, hit = true): BattleEvent =>
    ({ type: 'shot', unit, weapon: 'rightHand', target, part: 'core', appliedTo: 'core', hit, damage: 30 });
  /** The effects an event starts, whenever each is due. */
  function started(of: Scene, event: BattleEvent): Fx[] {
    const fx = new BattleFx(of);
    fx.onEvent(event);
    return (fx as unknown as { effects: Fx[] }).effects;
  }
  const one = <K extends Fx['kind']>(list: Fx[], kind: K): Extract<Fx, { kind: K }> => list.find((fx) => fx.kind === kind) as Extract<Fx, { kind: K }>;

  test('a shot from the pilot: its fire points along the line to what it is aimed at and is larger than life, and what flies shrinks as it goes', () => {
    const fx = started(scene('kinetic'), shot('player', 'enemy-0'));
    const muzzle = one(fx, 'muzzle');
    const line = { x: 230 - 150, y: 90 - 80 };
    expect(muzzle.aim.x).toBeCloseTo(line.x / length(line), 9);
    expect(muzzle.aim.y).toBeCloseTo(line.y / length(line), 9);
    expect(length(muzzle.aim)).toBeCloseTo(1, 9);
    expect(muzzle.size).toBe(NEAR_SIZE);
    const bullet = one(fx, 'projectile');
    expect(bullet.grow).toEqual([NEAR_SIZE, FAR_SIZE]);
    expect([bullet.from, bullet.to]).toEqual([places.player.muzzle, places['enemy-0'].hit]);
    // What strikes far off strikes small.
    expect(one(fx, 'burst').size).toBeCloseTo(8 * FAR_SIZE, 9);
    expect(one(fx, 'recoil').aim).toEqual(muzzle.aim);
  });

  test('a shot at the pilot grows as it comes, and strikes larger than life', () => {
    const fx = started(scene('explosive'), shot('enemy-1', 'player'));
    expect(one(fx, 'projectile').grow).toEqual([sizeAt(0.3), NEAR_SIZE]);
    expect(one(fx, 'muzzle').size).toBe(sizeAt(0.3));
    expect(one(fx, 'burst')).toMatchObject({ style: 'fire' });
    expect(one(fx, 'burst').size).toBeCloseTo(14 * NEAR_SIZE, 9);
    // Its fire points at the pilot: to the left.
    expect(one(fx, 'muzzle').aim.x).toBeLessThan(-0.9);
  });

  test('a shot that misses flies on past its target along its line, and wide of it on the side that is up the screen', () => {
    for (const [unit, target] of [['player', 'enemy-0'], ['enemy-0', 'player'], ['enemy-1', 'player']]) {
      const fx = started(scene('kinetic'), shot(unit, target, false));
      const { from, to, grow } = one(fx, 'projectile');
      const aimed = places[target].hit;
      const aim = one(fx, 'muzzle').aim;
      // Past it: further along the line than the target is.
      const along = (p: Pt): number => (p.x - from.x) * aim.x + (p.y - from.y) * aim.y;
      expect(along(to), unit).toBeGreaterThan(along(aimed) + 25);
      // Wide of it, by a few pixels, and never under it: it is seen to go over or past, not through.
      const off = Math.abs((to.x - from.x) * aim.y - (to.y - from.y) * aim.x);
      expect(off, unit).toBeGreaterThan(8);
      expect(off, unit).toBeLessThan(20);
      expect(to.y, unit).toBeLessThan(aimed.y + aim.y * 34 + 0.001);
      expect(grow, unit).toEqual([sizeAt(places[unit].depth), sizeAt(places[target].depth)]);
      // Nothing strikes.
      expect(fx.some((effect) => effect.kind === 'burst')).toBe(false);
    }
  });

  test('a blade is carried to its target over the floor, from where the one stands towards where the other does; a boost and a guard go the way the unit looks at the other side', () => {
    const blade = started(scene('energy', true), shot('player', 'enemy-0'));
    const lunge = one(blade, 'lunge');
    // From the pilot's feet to the enemy's: up the floor, more steeply than from body to body.
    const line = { x: 230 - 62, y: 118 - 177 };
    expect(lunge.aim.x).toBeCloseTo(line.x / length(line), 9);
    expect(lunge.aim.y).toBeCloseTo(line.y / length(line), 9);
    expect(lunge.aim.y).toBeLessThan(-0.3);
    expect(lunge.from).toEqual(places.player.centre);
    // In a scene that does not say where anybody stands, it goes from its middle to what it strikes.
    const level = one(started(flat('energy', true), shot('player', 'enemy-0')), 'lunge');
    expect(level.aim.x).toBeCloseTo(168 / Math.hypot(168, 25), 9);
    expect(level.aim.y).toBeCloseTo(-25 / Math.hypot(168, 25), 9);
    // No barrel fires and nothing flies.
    expect(blade.some((fx) => fx.kind === 'muzzle' || fx.kind === 'projectile')).toBe(false);
    expect(one(started(scene('kinetic'), { type: 'boost', unit: 'enemy-1' } as BattleEvent), 'lunge').aim).toEqual(places['enemy-1'].heading);
    expect(one(started(scene('kinetic'), { type: 'guard', unit: 'player' } as BattleEvent), 'shield').aim).toEqual(places.player.heading);
  });

  test('a machine that goes up far off goes up small, and one that goes up near goes up large: every blast of it and how far apart they are', () => {
    const far = started(scene('kinetic'), { type: 'unitDestroyed', unit: 'enemy-0' }).filter((fx) => fx.kind === 'burst') as Extract<Fx, { kind: 'burst' }>[];
    const near = started(scene('kinetic'), { type: 'unitDestroyed', unit: 'player' }).filter((fx) => fx.kind === 'burst') as Extract<Fx, { kind: 'burst' }>[];
    expect(far.map((b) => b.size)).toEqual([11, 12, 13, WRECK_SIZE].map((size) => size * FAR_SIZE));
    expect(near.map((b) => b.size)).toEqual([11, 12, 13, WRECK_SIZE].map((size) => size * NEAR_SIZE));
    expect(far.at(-1)!.start).toBe(WRECK_AT);
    // The second blast is ten to the left of the first at life size: seven far off, twelve near.
    expect(far[1].at.x - far[0].at.x).toBeCloseTo(-10 * FAR_SIZE, 9);
    expect(near[1].at.x - near[0].at.x).toBeCloseTo(-10 * NEAR_SIZE, 9);
    // A part that breaks off and a bomb that goes off are as large as where they are.
    const part = started(scene('kinetic'), { type: 'partDestroyed', unit: 'enemy-1', part: 'arms' } as BattleEvent);
    expect(one(part, 'burst').size).toBeCloseTo(9 * sizeAt(0.3), 9);
    const bomb = started(scene('kinetic'), { type: 'blast', unit: 'enemy-0', target: 'player', damage: 80 } as BattleEvent);
    expect((bomb.filter((fx) => fx.kind === 'burst') as Extract<Fx, { kind: 'burst' }>[]).map((b) => b.size)).toEqual([26, 18, 18, 18].map((size) => size * NEAR_SIZE));
    // It throws itself down the floor at the pilot's mech: to the left and towards the camera.
    expect(one(bomb, 'lunge').aim.x).toBeLessThan(-0.9);
    expect(one(bomb, 'lunge').aim.y).toBeGreaterThan(0.3);
    expect(bomb.find((fx) => fx.kind === 'burst')!.start).toBe(MELEE_MS);
  });

  test('fire from an ally who is not on the field comes from as near as the pilot\'s own mech, and lands as small as its target is far', () => {
    const support = { type: 'support', target: 'enemy-0', damage: 40 } as BattleEvent;
    const fx = started(scene('energy'), support);
    expect(one(fx, 'projectile').grow).toEqual([NEAR_SIZE, FAR_SIZE]);
    expect(one(fx, 'projectile').to).toEqual(places['enemy-0'].hit);
    // In a flat scene it is one size all the way.
    expect(one(started(flat('energy'), support), 'projectile').grow).toEqual([1, 1]);
  });

  test('a lunge that goes steeply up the floor: the machine and its after-images keep to its line, however steep', () => {
    // An enemy that stands almost straight up the screen from the pilot: three across for every four up.
    const steep: Scene = { ...scene('energy', true), foot: (id) => (id === 'player' ? { x: 0, y: 0 } : { x: 60, y: -80 }) };
    const fx = new BattleFx(steep);
    fx.onEvent(shot('player', 'enemy-0'));
    fx.update(160);
    // Half way through, at its furthest: nine along the line, its after-images seven behind each other along it.
    expect(fx.transform('player')).toMatchObject({ dx: 5, lift: -7, trail: 4, trailY: -6, dy: 0 });
  });

  test('a scene that says nothing of depth is flat: everything at life size, aimed along the line between two points', () => {
    const fx = started(flat('kinetic'), shot('player', 'enemy-0'));
    expect(one(fx, 'muzzle').size).toBe(1);
    expect(one(fx, 'projectile').grow).toEqual([1, 1]);
    expect(one(fx, 'burst').size).toBe(8);
    expect(length(one(fx, 'muzzle').aim)).toBeCloseTo(1, 9);
    expect(started(flat('kinetic'), { type: 'unitDestroyed', unit: 'enemy-0' }).filter((effect) => effect.kind === 'burst').map((b) => (b as { size: number }).size)).toEqual([11, 12, 13, 26]);
    // Nobody says which way anybody looks: straight left or right, the way it faces.
    expect(one(started(flat('kinetic'), { type: 'guard', unit: 'player' } as BattleEvent), 'shield').aim).toEqual({ x: 1, y: 0 });
    expect(one(started(flat('kinetic'), { type: 'boost', unit: 'enemy-0' } as BattleEvent), 'lunge').aim).toEqual({ x: -1, y: 0 });
    // Two points that are one point: straight ahead.
    const same: Scene = { ...flat('kinetic'), muzzle: () => ({ x: 5, y: 5 }), hitPoint: () => ({ x: 5, y: 5 }) };
    expect(one(started(same, shot('enemy-0', 'player')), 'muzzle').aim).toEqual({ x: -1, y: 0 });
  });

  test('a gun kicks its mech back along its barrel and a lunge carries it along its line and back: the whole of it, legs and all', () => {
    const fx = new BattleFx(scene('kinetic'));
    fx.onEvent(shot('player', 'enemy-0'));
    fx.update(1);
    const kick = fx.transform('player');
    const aim = one((fx as unknown as { effects: Fx[] }).effects, 'muzzle').aim;
    // Back along the barrel: to the left and, the barrel pointing down a little here, up.
    expect(kick.dx).toBe(Math.round(-aim.x * RECOIL_PX * (1 - 1 / 140)) || 0);
    expect(kick.dx).toBeLessThan(0);
    expect(kick.dy).toBe(0);
    expect(kick.trail).toBe(0);
    expect(kick.glare).toBe(true);
    for (let i = 0; i < 40; i++) fx.update(16);
    expect(fx.transform('player')).toMatchObject({ dx: 0, dy: 0, lift: 0, trail: 0, trailY: 0 });
    // An enemy that fires up the screen at the pilot is kicked back down it: to the right and down, all of it.
    const theirs = new BattleFx({ ...scene('kinetic'), muzzle: () => ({ x: 240, y: 150 }), hitPoint: () => ({ x: 150, y: 30 }) });
    theirs.onEvent(shot('enemy-1', 'player'));
    theirs.update(1);
    expect(theirs.transform('enemy-1')).toMatchObject({ dx: 2, lift: 2, dy: 0 });

    const blade = new BattleFx(scene('energy', true));
    blade.onEvent(shot('player', 'enemy-0'));
    const line = { x: 230 - 62, y: 118 - 177 };
    const way = { x: line.x / length(line), y: line.y / length(line) };
    let furthest = { dx: 0, lift: 0, trail: 0, trailY: 0 };
    for (let ms = 0; ms < 320; ms += 8) {
      blade.update(8);
      const t = blade.transform('player');
      // Always on its line: across and up in the proportion of the line, give or take a pixel's rounding.
      expect(Math.abs(t.dx * way.y - t.lift * way.x)).toBeLessThanOrEqual(1);
      expect(t.dy).toBe(0);
      if (Math.hypot(t.dx, t.lift) > Math.hypot(furthest.dx, furthest.lift)) furthest = t;
    }
    // Furthest half way: nine pixels along the line, which here is up and to the right; its after-images stand behind it on the same line.
    expect(furthest.dx).toBe(Math.round(way.x * LUNGE_PX));
    expect(furthest.lift).toBe(Math.round(way.y * LUNGE_PX));
    expect(furthest.lift).toBeLessThan(0);
    expect(furthest.trail).toBeGreaterThan(0);
    expect(furthest.trailY).toBeLessThan(0);
    expect(Math.abs(furthest.trail * way.y - furthest.trailY * way.x)).toBeLessThanOrEqual(1);
    blade.update(400);
    expect(blade.transform('player')).toMatchObject({ dx: 0, lift: 0, trail: 0, trailY: 0 });
  });
});

describe('how what is fired is painted', () => {
  const lines = (page: Drawn, color: string): Filled[] => page.rects.filter((r) => r.color === color);

  test('a tracer is two pixels thick and has a head of three near the camera, and is one thick with a head of one far off', () => {
    const tracer = (grow: [number, number], p: number): Drawn => paint({ kind: 'projectile', from: FROM, to: TO, dtype: 'kinetic', grow }, p);
    // Fired by the pilot, early: all of it is still near.
    const early = tracer([NEAR_SIZE, FAR_SIZE], 0.12);
    expect(lines(early, '#ffe9a8').every((r) => r.w === 2 && r.h === 2)).toBe(true);
    expect(lines(early, '#ffffff').every((r) => r.w === 3 && r.h === 3)).toBe(true);
    expect(lines(early, '#ffffff').length).toBeGreaterThan(0);
    // The same shot as it arrives: its first tracer is far off now.
    const late = tracer([NEAR_SIZE, FAR_SIZE], 0.86);
    const heads = lines(late, '#ffffff');
    expect(heads.some((r) => r.w === 1 && r.h === 1)).toBe(true);
    expect(lines(late, '#ffe9a8').some((r) => r.w === 1 && r.h === 1)).toBe(true);
    // Whatever its size, a head lies on the end of its own line: a head of one pixel is a pixel of the line, not the one beside it.
    for (const p of [0.12, 0.3, 0.5, 0.7, 0.86, 0.95]) {
      for (const grow of [[NEAR_SIZE, FAR_SIZE], [FAR_SIZE, NEAR_SIZE], [1, 1], [FAR_SIZE, FAR_SIZE]] as [number, number][]) {
        const page = tracer(grow, p);
        const body = lines(page, '#ffe9a8');
        const tips = lines(page, '#ffffff');
        expect(tips.length, `${grow} at ${p}`).toBeGreaterThan(0);
        for (const tip of tips) {
          const on = body.filter((r) => r.x < tip.x + tip.w && tip.x < r.x + r.w && r.y < tip.y + tip.h && tip.y < r.y + r.h);
          expect(on.length, `${grow} at ${p}: a head ${tip.w} wide at ${tip.x},${tip.y}`).toBeGreaterThan(0);
        }
      }
    }
    // At life size all the way, as it was: one thick, heads of two.
    for (const p of [0.12, 0.5, 0.86]) {
      const plain = tracer([1, 1], p);
      expect(lines(plain, '#ffe9a8').every((r) => r.w === 1 && r.h === 1), `at ${p}`).toBe(true);
      expect(lines(plain, '#ffffff').every((r) => r.w === 2 && r.h === 2), `at ${p}`).toBe(true);
    }
    // One that comes at the pilot starts thin and ends thick.
    expect(lines(tracer([FAR_SIZE, NEAR_SIZE], 0.12), '#ffe9a8').every((r) => r.w === 1)).toBe(true);
    expect(lines(tracer([FAR_SIZE, NEAR_SIZE], 0.86), '#ffe9a8').some((r) => r.w === 2)).toBe(true);
  });

  test('a shell and the smoke behind it are as large as they are far off', () => {
    const shell = (grow: [number, number], p: number): Drawn => paint({ kind: 'projectile', from: FROM, to: TO, dtype: 'explosive', grow }, p);
    /** The widest row of the shell's own disc. */
    const head = (page: Drawn): number => Math.max(...page.rects.filter((r) => r.color === '#ffb46b' && r.h === 1).map((r) => r.w));
    // A circle is drawn at a whole radius: two and a bit near, one and a bit far off.
    expect(head(shell([NEAR_SIZE, FAR_SIZE], 0.02))).toBeGreaterThan(head(shell([NEAR_SIZE, FAR_SIZE], 0.98)));
    expect(head(shell([FAR_SIZE, NEAR_SIZE], 0.02))).toBeLessThan(head(shell([FAR_SIZE, NEAR_SIZE], 0.98)));
    expect(head(shell([1, 1], 0.1))).toBe(head(shell([1, 1], 0.95)));
    const smoke = (page: Drawn): number => Math.max(...page.rects.filter((r) => ['#8a8494', '#6c6678'].includes(r.color) && r.h === 1).map((r) => r.w));
    expect(smoke(shell([NEAR_SIZE, NEAR_SIZE], 0.5))).toBeGreaterThan(smoke(shell([FAR_SIZE, FAR_SIZE], 0.5)));
  });

  test('a beam narrows as it goes away from the camera and widens as it comes; in a flat scene it is one width, stroked as before', () => {
    const beam = (grow: [number, number]): Drawn => paint({ kind: 'projectile', from: FROM, to: TO, dtype: 'energy', grow }, 0.5);
    const across = (points: Pt[], a: number, b: number): number => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
    const away = beam([NEAR_SIZE, FAR_SIZE]).shapes.filter((s) => s.blend === 'lighter');
    expect(away).toHaveLength(4);
    for (const band of away) expect(across(band.points, 0, 3)).toBeGreaterThanOrEqual(across(band.points, 1, 2));
    // Its widest band is 3.2 times the beam's own width: 2.2 at life size.
    expect(across(away[0].points, 0, 3)).toBeCloseTo(2.2 * 3.2 * NEAR_SIZE, 6);
    expect(across(away[0].points, 1, 2)).toBeCloseTo(2.2 * 3.2 * FAR_SIZE, 6);
    // From where it leaves to where it burns.
    const mid = (points: Pt[], a: number, b: number): Pt => ({ x: (points[a].x + points[b].x) / 2, y: (points[a].y + points[b].y) / 2 });
    expect(mid(away[0].points, 0, 3).x).toBeCloseTo(FROM.x, 6);
    expect(mid(away[0].points, 1, 2).x).toBeCloseTo(TO.x, 6);
    expect(beam([NEAR_SIZE, FAR_SIZE]).strokes.filter((s) => s.blend === 'lighter')).toEqual([]);
    // While it is still reaching out, its far end is as wide as how far it has got: half way there, half way between the two.
    const reaching = paint({ kind: 'projectile', from: FROM, to: TO, dtype: 'energy', grow: [NEAR_SIZE, FAR_SIZE] }, 0.2).shapes.filter((s) => s.blend === 'lighter');
    expect(mid(reaching[0].points, 1, 2).x).toBeCloseTo((FROM.x + TO.x) / 2, 6);
    expect(across(reaching[0].points, 1, 2)).toBeCloseTo(2.2 * 3.2 * (NEAR_SIZE + FAR_SIZE) / 2, 6);
    const coming = beam([FAR_SIZE, NEAR_SIZE]).shapes.filter((s) => s.blend === 'lighter');
    for (const band of coming.slice(0, 3)) expect(across(band.points, 0, 3)).toBeLessThan(across(band.points, 1, 2));
    // Flat: four strokes of one width each, and no shape.
    const level = beam([1, 1]);
    expect(level.strokes.filter((s) => s.blend === 'lighter').map((s) => s.width)).toEqual([2.2 * 3.2, 2.2 * 1.9, 2.2, 1].map((w) => expect.closeTo(w, 6)));
    expect(level.shapes).toEqual([]);
  });

  test('fire from a barrel points the way the barrel points, and is as large as the barrel is near', () => {
    const fire = (aim: Pt, size: number): Drawn => paint({ kind: 'muzzle', at: FROM, dtype: 'kinetic', dir: 1, aim, size }, 0.2);
    /** The middle of everything drawn in the flame's colour, from the barrel's mouth. */
    const lean = (page: Drawn): Pt => {
      const flame = page.rects.filter((r) => r.color === '#ffe9a8' && r.h === 1 && r.w >= 2);
      const cx = flame.reduce((sum, r) => sum + (r.x + r.w / 2) * r.w, 0) / flame.reduce((sum, r) => sum + r.w, 0);
      const cy = flame.reduce((sum, r) => sum + r.y * r.w, 0) / flame.reduce((sum, r) => sum + r.w, 0);
      return { x: cx - FROM.x, y: cy - FROM.y };
    };
    expect(lean(fire({ x: 1, y: 0 }, 1)).x).toBeGreaterThan(2);
    expect(Math.abs(lean(fire({ x: 1, y: 0 }, 1)).y)).toBeLessThan(1);
    // Up and to the right: the flame is up and to the right of the mouth.
    const up = lean(fire({ x: 0.8, y: -0.6 }, 1));
    expect(up.x).toBeGreaterThan(1.5);
    expect(up.y).toBeLessThan(-1);
    // Down and to the left, as an enemy fires at the pilot.
    const down = lean(fire({ x: -0.8, y: 0.6 }, 1));
    expect(down.x).toBeLessThan(-1.5);
    expect(down.y).toBeGreaterThan(1);
    // Larger near, smaller far off: the flame and its light.
    const widest = (page: Drawn): number => Math.max(...page.rects.filter((r) => r.h === 1).map((r) => r.w));
    expect(widest(fire({ x: 1, y: 0 }, NEAR_SIZE))).toBeGreaterThan(widest(fire({ x: 1, y: 0 }, FAR_SIZE)));
    const light = (size: number) => lightsOf({ start: 0, dur: 90, kind: 'muzzle', at: FROM, dtype: 'kinetic', dir: 1, aim: { x: 0.8, y: -0.6 }, size }, 0)[0];
    expect(light(NEAR_SIZE).r).toBeCloseTo(46 * NEAR_SIZE, 9);
    expect(light(FAR_SIZE).r).toBeCloseTo(46 * FAR_SIZE, 9);
    expect([light(1).x, light(1).y]).toEqual([FROM.x + 0.8 * 4, FROM.y - 0.6 * 4]);
  });

  test('the light of what flies is as large as it is far off', () => {
    const light = (dtype: DamageType, grow: [number, number], p: number) => lightsOf({ start: 0, dur: 160, kind: 'projectile', from: FROM, to: TO, dtype, grow }, p);
    expect(light('kinetic', [NEAR_SIZE, FAR_SIZE], 0)[0].r).toBeCloseTo(12 * NEAR_SIZE, 9);
    expect(light('kinetic', [NEAR_SIZE, FAR_SIZE], 0.99)[0].r).toBeCloseTo(12 * FAR_SIZE, 9);
    expect(light('explosive', [FAR_SIZE, NEAR_SIZE], 0.5)[0].r).toBeCloseTo(12 * (FAR_SIZE + NEAR_SIZE) / 2, 9);
    const beam = light('energy', [NEAR_SIZE, FAR_SIZE], 0.5);
    expect(beam.map((g) => g.r)).toEqual([expect.closeTo(22 * NEAR_SIZE, 9), expect.closeTo(30 * FAR_SIZE, 9)]);
    expect(light('kinetic', [1, 1], 0.5)[0].r).toBe(12);
  });

  test('a guard stands across the way its unit looks, between it and the other side; a lunge burns its jet behind it on its line', () => {
    const aim = { x: 0.8, y: -0.6 };
    const wall = paint({ kind: 'shield', at: FROM, dir: 1, aim }, 0.4).rects.filter((r) => r.w === 2 && r.h === 2);
    expect(wall.length).toBeGreaterThan(15);
    for (const dot of wall) {
      // Each piece of it is ahead of the unit along its aim: between two and four dozen pixels out.
      const out = (dot.x - FROM.x) * aim.x + (dot.y - FROM.y) * aim.y;
      expect(out).toBeGreaterThan(20);
      expect(out).toBeLessThan(40);
    }
    // It is long across the aim and thin along it.
    const acrossOf = (r: Filled): number => (r.x - FROM.x) * -aim.y + (r.y - FROM.y) * aim.x;
    expect(Math.max(...wall.map(acrossOf)) - Math.min(...wall.map(acrossOf))).toBeGreaterThan(50);
    expect(lightsOf({ start: 0, dur: 420, kind: 'shield', at: FROM, dir: 1, aim }, 0.4)[0]).toMatchObject({ x: FROM.x + 0.8 * 26, y: FROM.y - 0.6 * 26 });

    const jet = paint({ kind: 'lunge', unit: 'player', dir: 1, from: FROM, aim }, 0.5).rects.filter((r) => r.color === '#bfe8ff');
    expect(jet.length).toBeGreaterThan(3);
    for (const row of jet) {
      // Behind it: back along its line, which is down and to the left of where it is going.
      const back = (row.x + row.w / 2 - FROM.x) * -aim.x + (row.y - FROM.y - 6) * -aim.y;
      expect(back).toBeGreaterThan(12);
      // It goes up the screen: its jet is under it, further down than its nozzle would be if it went level.
      expect(row.y).toBeGreaterThanOrEqual(FROM.y + 14);
      expect(row.x + row.w / 2).toBeLessThan(FROM.x - 12);
    }
    // And it burns on down that line: its far end is a good way further down the screen than its nozzle.
    expect(Math.max(...jet.map((row) => row.y))).toBeGreaterThanOrEqual(FROM.y + 30);
    expect(Math.min(...jet.map((row) => row.x))).toBeLessThan(FROM.x - 30);
    const light = lightsOf({ start: 0, dur: 320, kind: 'lunge', unit: 'player', dir: 1, from: FROM, aim }, 0.5)[0];
    expect([light.x, light.y]).toEqual([FROM.x - 0.8 * 30, FROM.y + 0.6 * 30 + 6]);
  });
});

describe('a beam that is wider at one end', () => {
  test('is four bands laid one on another as light, widest first, each a four-cornered shape from one end to the other', () => {
    const page = record((ctx) => {
      drawTaper(ctx, { x: 10, y: 50 }, { x: 110, y: 50 }, 4, 2, '#7fe9ff', 0.8);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });
    expect(page.shapes).toHaveLength(4);
    expect(page.shapes.every((s) => s.blend === 'lighter' && s.points.length === 4)).toBe(true);
    const ends = page.shapes.map((s) => [Math.abs(s.points[0].y - s.points[3].y), Math.abs(s.points[1].y - s.points[2].y)]);
    expect(ends[0]).toEqual([expect.closeTo(4 * 3.2, 9), expect.closeTo(2 * 3.2, 9)]);
    expect(ends[1]).toEqual([expect.closeTo(4 * 1.9, 9), expect.closeTo(2 * 1.9, 9)]);
    expect(ends[2]).toEqual([expect.closeTo(4, 9), expect.closeTo(2, 9)]);
    // The white core is never thinner than a pixel.
    expect(ends[3]).toEqual([expect.closeTo(1.6, 9), expect.closeTo(1, 9)]);
    expect(page.shapes.map((s) => s.color)).toEqual(['rgba(127, 233, 255, 0.128)', 'rgba(127, 233, 255, 0.320)', 'rgba(127, 233, 255, 0.720)', 'rgba(255, 255, 255, 0.800)']);
    for (const shape of page.shapes) {
      expect(shape.points[0].x).toBeCloseTo(10, 9);
      expect(shape.points[1].x).toBeCloseTo(110, 9);
    }
  });

  test('nothing is drawn of one that is too faint, has no width, has no length, or where no soft light is drawn at all', () => {
    const drawn = (run: (ctx: CanvasRenderingContext2D) => void) => record(run).shapes.length;
    expect(drawn((ctx) => drawTaper(ctx, { x: 0, y: 0 }, { x: 50, y: 0 }, 3, 2, '#ffffff', 0.005))).toBe(0);
    expect(drawn((ctx) => drawTaper(ctx, { x: 0, y: 0 }, { x: 50, y: 0 }, 0, 0, '#ffffff', 1))).toBe(0);
    expect(drawn((ctx) => drawTaper(ctx, { x: 7, y: 7 }, { x: 7, y: 7 }, 3, 2, '#ffffff', 1))).toBe(0);
    // One that narrows to nothing is still a beam.
    expect(drawn((ctx) => drawTaper(ctx, { x: 0, y: 0 }, { x: 50, y: 0 }, 3, 0, '#ffffff', 1))).toBe(4);
    setDetail(0);
    try {
      expect(drawn((ctx) => drawTaper(ctx, { x: 0, y: 0 }, { x: 50, y: 0 }, 3, 2, '#ffffff', 1))).toBe(0);
    } finally {
      setDetail(2);
    }
  });
});

describe('depth on the battle screen', () => {
  type Entry = Omit<Sprite, 'image'>;
  const MANIFEST = SPRITES as unknown as Record<string, Entry>;
  const sprites: SpriteStore = { get: (id, fallback) => ({ ...(MANIFEST[id] ?? fallback), image: { id } as unknown as CanvasImageSource }) };
  const idOf = (image: Pictured): string => (image.image as { id: string }).id;
  function screenOf(enemies: string[], opts: { build?: Build; fast?: boolean; calm?: boolean; prepare?: (state: BattleState) => void } = {}) {
    const state = createBattle(opts.build ?? DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 7);
    opts.prepare?.(state);
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: 'bg-neon-district', ...(opts.calm ? { calm: true } : {}) });
    for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    const page = (): Drawn => onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
    const fire = (): void => { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); };
    return { state, flow, screen, page, fire };
  }

  test('the pilot\'s mech is as near as anything is and looks up the floor to the right; an enemy is as far off as its line and looks back down it', () => {
    const { screen } = screenOf(['recon-drone', 'tank', 'gun-turret']);
    const at = screen.motion.at;
    expect(at.depth('player')).toBe(0);
    // The first two listed stand at the back, the third in front: further off, further up the screen.
    expect(at.depth('enemy-0')).toBe(1);
    expect(at.depth('enemy-1')).toBeLessThan(at.depth('enemy-0'));
    expect(at.depth('enemy-2')).toBeLessThan(at.depth('enemy-1'));
    expect(at.depth('enemy-2')).toBeGreaterThan(0.2);
    const own = at.heading('player');
    expect(Math.hypot(own.x, own.y)).toBeCloseTo(1, 9);
    expect(own.x).toBeGreaterThan(0.8);
    // Up the floor: away from the camera.
    expect(own.y).toBeLessThan(-0.15);
    expect(at.foot('player')).toEqual({ x: HERO.x + 58, y: screen.motion.at.floor('player') + 2 });
    // It looks at the middle of the floor the enemies stand on, whoever stands there: the same with one enemy as with three.
    const across = { x: (ENEMY_LEFT + ENEMY_RIGHT) / 2 - at.foot('player').x, y: (FAR_LINE + NEAR_LINE) / 2 - at.foot('player').y };
    expect(own.x).toBeCloseTo(across.x / Math.hypot(across.x, across.y), 9);
    expect(own.y).toBeCloseTo(across.y / Math.hypot(across.x, across.y), 9);
    expect(screenOf(['gun-turret']).screen.motion.at.heading('player')).toEqual(own);
    expect(screenOf(['tank', 'recon-drone']).screen.motion.at.heading('player')).toEqual(own);
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) {
      const their = at.heading(id);
      expect(Math.hypot(their.x, their.y), id).toBeCloseTo(1, 9);
      expect(their.x, id).toBeLessThan(-0.8);
      // It looks down the floor at the pilot's mech: along the line from where it stands to where that mech does.
      const line = { x: at.foot('player').x - at.foot(id).x, y: at.foot('player').y - at.foot(id).y };
      expect(their.x * line.y - their.y * line.x, id).toBeCloseTo(0, 6);
      expect(their.y, id).toBeGreaterThan(0);
      // It stands on the line of the floor under it.
      expect(at.foot(id).y, id).toBe(at.floor(id) + 1);
    }
  });

  test('a blade carries the pilot\'s mech up the floor towards what it strikes: every layer of it, legs and all, and back to where it stood', () => {
    const { flow, screen, page } = screenOf(['gun-turret'], { build: { ...DEMO_BUILD, rightHand: 'wpn-arc-blade' } });
    // The legs themselves: a mech that lunges leaves two faint after-images behind it, drawn before it.
    const legsAt = (drawn: Drawn) => drawn.images.filter((image) => idOf(image) === 'legs-strider.back').at(-1)!;
    const rest = legsAt(page());
    const choose = (id: string): void => {
      const at = flow.menu.items.findIndex((item) => item.id === id);
      expect(flow.menu.items[at]?.enabled, id).toBe(true);
      for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
      for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
      screen.onInput('confirm');
    };
    /** How far the legs get from where they stand, from now until the pilot can act again. */
    /** Where the generator's light is from the corner of the body's picture: it never changes, wherever the mech goes. */
    const lightOnBody = new Set<string>();
    const reach = (): { x: number; y: number } => {
      let furthest = { x: 0, y: 0 };
      for (let i = 0; i < 400 && (i < 4 || flow.phase !== 'action'); i++) {
        screen.update(16);
        const drawn = page();
        const legs = legsAt(drawn);
        const moved = { x: legs.x - rest.x, y: legs.y - rest.y };
        if (Math.hypot(moved.x, moved.y) > Math.hypot(furthest.x, furthest.y)) furthest = moved;
        const body = drawn.images.filter((image) => idOf(image) === 'core-hauler.back').at(-1)!;
        const light = generatorIn(drawn)!;
        lightOnBody.add(`${light.x - body.x},${light.y - body.y}`);
      }
      return furthest;
    };
    // A blade needs the mech close: it boosts first, which is itself a dash the way it looks at the other side.
    choose('boost');
    const dash = reach();
    expect(dash.x).toBeGreaterThanOrEqual(6);
    expect(dash.y).toBeLessThan(0);
    expect([legsAt(page()).x, legsAt(page()).y]).toEqual([rest.x, rest.y]);
    choose('fire');
    choose('rightHand');
    screen.onInput('confirm');
    expect(flow.message).toMatch(/Arc Blade/);
    // Half way through the lunge the mech has two after-images behind it on the line it came along: down the floor, fainter the further.
    let images: Pictured[] = [];
    for (let i = 0; i < 9; i++) { screen.update(16); images = page().images.filter((image) => idOf(image) === 'legs-strider.back'); }
    expect(images).toHaveLength(3);
    const [furthestBack, nearer, itself] = images;
    expect([furthestBack.alpha, nearer.alpha, itself.alpha]).toEqual([0.14, 0.3, 1]);
    expect(furthestBack.x).toBeLessThan(nearer.x);
    expect(nearer.x).toBeLessThan(itself.x);
    expect(furthestBack.y).toBeGreaterThan(nearer.y);
    expect(nearer.y).toBeGreaterThan(itself.y);
    const lunge = reach();
    // Up and to the right, along the line to the turret: the legs go with it.
    expect(lunge.x).toBeGreaterThanOrEqual(6);
    expect(lunge.y).toBeLessThan(0);
    expect(Math.hypot(lunge.x, lunge.y)).toBeLessThanOrEqual(LUNGE_PX + 3);
    for (let i = 0; i < 60; i++) screen.update(16);
    expect([legsAt(page()).x, legsAt(page()).y]).toEqual([rest.x, rest.y]);
    // Through the dash and the lunge, up the floor and back, the generator's light stayed on the body.
    expect(lightOnBody.size).toBe(1);
  });

  test('a mech that is fought alone is kicked back by its own gun away from the pilot: to the right, though it is drawn turned round', () => {
    const { flow, screen, page } = screenOf(['rival']);
    const legsOf = (drawn: Drawn) => drawn.images.filter((image) => idOf(image).startsWith('legs-') && idOf(image).endsWith('.small')).at(-1)!;
    const rest = legsOf(page());
    const fx = (screen as unknown as { fx: { transform(id: string): { dx: number; lift: number }; kinds(): string[] } }).fx;
    let kicked = 0;
    for (let i = 0; i < 1500 && kicked < 3 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') { const at = flow.menu.items.findIndex((item) => item.id === 'endTurn'); for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down'); screen.onInput('confirm'); }
      screen.update(16);
      const t = fx.transform('enemy-0');
      // While its own gun kicks it and nothing else moves it.
      if (!fx.kinds().includes('recoil') || fx.kinds().includes('hit') || t.dx === 0) continue;
      kicked++;
      // Away from the pilot is to the right on the screen: that is where its picture goes, by as much as it is kicked.
      expect(t.dx).toBeGreaterThan(0);
      const legs = legsOf(page());
      expect(legs.x - rest.x).toBe(t.dx);
      expect(legs.y - rest.y).toBe(t.lift);
    }
    expect(kicked).toBe(3);
  });

  test('a bomb that throws itself at the pilot comes down the floor to the left, towards the camera, as one picture', () => {
    const { flow, screen, page } = screenOf(['bomb-crawler'], { prepare: (state) => { state.units[1].fuse = 1; } });
    // The bomb itself: the last of its pictures drawn, over the after-images it leaves behind it.
    const bomb = (drawn: Drawn) => drawn.images.filter((image) => idOf(image) === 'enemy-bomb-crawler').at(-1);
    const rest = bomb(page())!;
    // The pilot waits; the bomb's fuse runs out and it goes off.
    let furthest = { x: 0, y: 0 };
    // The rules are ahead of the screen: the bomb is gone by them the moment the turn is ended, and is seen to go later.
    let said = false;
    let closest = 1;
    let leftmost = HOME_X;
    for (let i = 0; i < 1500 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') { const at = flow.menu.items.findIndex((item) => item.id === 'endTurn'); for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down'); screen.onInput('confirm'); }
      screen.update(16);
      said ||= /DETONATES/.test(flow.message);
      // While the bomb's going off is what is being shown, the camera pushes in on the pilot's mech, which it went off on.
      if (/DETONATES/.test(flow.message) && !screen.motion.finish) {
        closest = Math.max(closest, screen.motion.view.zoom);
        leftmost = Math.min(leftmost, screen.motion.view.x);
      }
      const drawn = page();
      const now = bomb(drawn);
      // While it is whole its eye is on it, wherever it has thrown itself to.
      if (now && now.w === rest.w && now.h === rest.h && screen.motion.breaking('enemy-0') === null) expect(eyesIn(drawn), `frame ${i}`).toHaveLength(1);
      // While it is still one picture, whole: before it is seen to come apart.
      if (now && now.w === rest.w && now.h === rest.h && Math.hypot(now.x - rest.x, now.y - rest.y) > Math.hypot(furthest.x, furthest.y)) furthest = { x: now.x - rest.x, y: now.y - rest.y };
    }
    expect(said).toBe(true);
    expect(flow.state.units[1].destroyed).toBe(true);
    // To the left and down the screen: along the floor from where it stands to where the pilot's mech does.
    expect(furthest.x).toBeLessThanOrEqual(-6);
    expect(furthest.y).toBeGreaterThan(0);
    // The camera went in as hard as for a machine going up, and turned left, to where the pilot's mech stands.
    expect(closest).toBeCloseTo(1 + PUSH.wreck, 2);
    expect(leftmost).toBeLessThan(HOME_X - 10);
  });

  test('the generator on the back of the pilot\'s mech: a small warm light that breathes, on its body, where a hurried game has none', () => {
    const { screen, page } = screenOf(['gun-turret']);
    const glow = generatorIn(page())!;
    expect(glow).toBeDefined();
    expect(Math.abs(glow.x - (HERO.x + GENERATOR.x))).toBeLessThanOrEqual(3);
    expect(Math.abs(glow.y - (HERO.y + GENERATOR.y))).toBeLessThanOrEqual(4);
    expect(glow.r).toBe(GENERATOR.r);
    expect(glow.stops[0][1]).toMatch(/^rgba\(255, 176, 96, /);
    // It lies on the body's own picture, over it.
    const drawn = page();
    const core = drawn.images.find((image) => idOf(image) === 'core-hauler.back')!;
    const mine = generatorIn(drawn)!;
    expect(mine.x > core.x && mine.x < core.x + core.w && mine.y > core.y && mine.y < core.y + core.h).toBe(true);
    const order = (kind: string, thing: unknown, list: unknown[]): number => drawn.order.findIndex((step) => step.kind === kind && list[step.at] === thing);
    expect(order('glow', mine, drawn.glows)).toBeGreaterThan(order('image', core, drawn.images));
    // It breathes: over a few seconds it is seen at several strengths, never out and never glaring.
    const strength = (g: { stops: [number, string][] }): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
    const levels = new Set<number>();
    for (let i = 0; i < 100; i++) { screen.update(48); levels.add(strength(generatorIn(page())!)); }
    expect(levels.size).toBeGreaterThan(10);
    expect(Math.min(...levels)).toBeGreaterThan(0.1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(GENERATOR.alpha + 0.001);
    // A hurried game draws no light that is only there to be looked at.
    expect(generatorIn(screenOf(['gun-turret'], { fast: true }).page())).toBeUndefined();
  });

  test('it goes where the body goes when the mech flinches, and goes out in the frame the mech is seen to come apart, not sooner', () => {
    // A pilot whose every part has a point of armour left, against two machines that fire first.
    const { flow, screen, page } = screenOf(['tank', 'gun-turret'], { prepare: (state) => { for (const part of Object.values(state.units[0].parts)) if (part) part.ap = 1; } });
    const offsets = new Set<string>();
    let moved = 0;
    let after = 0;
    let rest: Pictured | undefined;
    for (let i = 0; i < 1200 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') { const at = flow.menu.items.findIndex((item) => item.id === 'endTurn'); for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down'); screen.onInput('confirm'); }
      screen.update(16);
      const drawn = page();
      const core = drawn.images.filter((image) => idOf(image) === 'core-hauler.back').at(-1);
      const light = generatorIn(drawn);
      if (screen.motion.breaking('player') !== null) {
        // Coming apart: its light is out, from the first frame of it.
        expect(light, `frame ${i}`).toBeUndefined();
        after++;
        continue;
      }
      // Whole, whatever the rules have decided by now: its light is on, on its body.
      expect(light, `frame ${i}`).toBeDefined();
      rest ??= core;
      if (core!.x !== rest!.x || core!.y !== rest!.y) moved++;
      offsets.add(`${light!.x - core!.x},${light!.y - core!.y}`);
    }
    expect(flow.state.units[0].destroyed).toBe(true);
    // The body was thrown about by what hit it, and the light never left its place on it.
    expect(moved).toBeGreaterThan(5);
    expect(offsets.size).toBe(1);
    expect(after).toBeGreaterThan(5);
  });

  test('it grows and brightens as the mech runs hotter, is half as strong in a calm picture, sinks low while the mech is dazed, and goes down with it on tracks', () => {
    const strength = (g: { stops: [number, string][] }): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
    const cool = generatorIn(screenOf(['gun-turret']).page())!;
    const warm = generatorIn(screenOf(['gun-turret'], { prepare: (state) => { state.units[0].heat = HEAT_LIMIT * 0.6; } }).page())!;
    expect(warm.r).toBeCloseTo(GENERATOR.r + 6 * 0.6, 6);
    expect(strength(warm)).toBeGreaterThan(strength(cool) * 1.3);
    const calm = generatorIn(screenOf(['gun-turret'], { calm: true }).page())!;
    expect(strength(calm)).toBeCloseTo(strength(cool) / 2, 1);
    // Overheated, the mech is dazed: what is left of the light is a glimmer.
    const dazed = screenOf(['gun-turret'], { prepare: (state) => { state.units[0].overheated = true; } });
    dazed.screen.update(16);
    expect(strength(generatorIn(dazed.page())!)).toBeCloseTo(GENERATOR.dazed, 2);
    // On tracks the body sits lower, and its light with it.
    const tracked = generatorIn(screenOf(['gun-turret'], { build: { ...DEMO_BUILD, legs: 'legs-crawler' } }).page())!;
    expect(tracked.y - cool.y).toBeGreaterThanOrEqual(MANIFEST['legs-crawler.back'].drop! - 3);
    expect(tracked.y - cool.y).toBeLessThanOrEqual(MANIFEST['legs-crawler.back'].drop! + 3);
  });
});
