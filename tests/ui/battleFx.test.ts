import type { BattleEvent } from '../../src/core/battle';
import { BattleFx, DEATH_MS, PROJECTILE_MS, type Scene } from '../../src/ui/battleFx';

const scene: Scene = {
  muzzle: (unit) => (unit === 'player' ? { x: 100, y: 50 } : { x: 220, y: 60 }),
  hitPoint: (unit) => (unit === 'player' ? { x: 80, y: 70 } : { x: 240, y: 60 }),
  centre: (unit) => (unit === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
  facing: (unit) => (unit === 'player' ? 1 : -1),
  damageType: () => 'kinetic',
  isMelee: () => false,
};
const shot = (hit: boolean): BattleEvent => ({
  type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit, damage: hit ? 38 : 0,
});
const NEUTRAL = { dx: 0, dy: 0, flash: false, alpha: 1 };

test('a unit with nothing happening to it is drawn as it is', () => {
  const fx = new BattleFx(scene);
  expect(fx.transform('player')).toEqual(NEUTRAL);
  expect(fx.busy).toBe(false);
});

test('a shot recoils the shooter at once and only shakes the target when the projectile lands', () => {
  const fx = new BattleFx(scene);
  fx.onEvent(shot(true));
  fx.update(20);
  expect(fx.transform('player').dx).toBeLessThan(0);
  expect(fx.transform('enemy-0')).toEqual(NEUTRAL);
  expect(fx.kinds()).toContain('projectile');

  fx.update(PROJECTILE_MS);
  expect(fx.transform('enemy-0').flash).toBe(true);
  expect(fx.texts()).toEqual(['-38']);
});

test('enemies recoil the other way because they face left', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ ...shot(true), unit: 'enemy-0', target: 'player' } as BattleEvent);
  fx.update(20);
  expect(fx.transform('enemy-0').dx).toBeGreaterThan(0);
});

test('a miss shows MISS and leaves the target untouched', () => {
  const fx = new BattleFx(scene);
  fx.onEvent(shot(false));
  fx.update(PROJECTILE_MS + 20);
  expect(fx.transform('enemy-0')).toEqual(NEUTRAL);
  expect(fx.texts()).toEqual(['MISS']);
});

test('a destroyed unit fades out, then counts as gone', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ type: 'unitDestroyed', unit: 'enemy-0' });
  expect(fx.isGone('enemy-0')).toBe(false);
  fx.update(DEATH_MS / 2);
  const mid = fx.transform('enemy-0');
  expect(mid.alpha).toBeGreaterThan(0);
  expect(mid.alpha).toBeLessThan(1);
  expect(mid.dy).toBeGreaterThan(0);
  fx.update(DEATH_MS);
  expect(fx.isGone('enemy-0')).toBe(true);
});

test('a boost lunges forward and returns', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ type: 'boost', unit: 'player' });
  fx.update(100);
  expect(fx.transform('player').dx).toBeGreaterThan(0);
  fx.update(2000);
  expect(fx.transform('player')).toEqual(NEUTRAL);
});

test('repairs and cooling show their amount', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ type: 'repair', unit: 'player', part: 'core', amount: 88 });
  fx.update(10);
  expect(fx.texts()).toEqual(['+88']);
});

test('overheating is announced over the unit', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ type: 'overheat', unit: 'player' });
  fx.update(10);
  expect(fx.texts()).toEqual(['OVERHEAT']);
});

test('every effect ends', () => {
  const fx = new BattleFx(scene);
  const events: BattleEvent[] = [
    shot(true), shot(false), { type: 'partDestroyed', unit: 'enemy-0', part: 'legs' }, { type: 'boost', unit: 'player' },
    { type: 'cool', unit: 'player', amount: 25 }, { type: 'overheat', unit: 'player' }, { type: 'turnSkipped', unit: 'player' },
    { type: 'repair', unit: 'player', part: 'core', amount: 10 }, { type: 'turnStart', unit: 'player' },
    { type: 'outcome', outcome: 'victory' },
  ];
  for (const e of events) fx.onEvent(e);
  expect(fx.busy).toBe(true);
  fx.update(5000);
  expect(fx.busy).toBe(false);
  expect(fx.transform('player')).toEqual(NEUTRAL);
  expect(fx.transform('enemy-0')).toEqual(NEUTRAL);
});

test('events that are only bookkeeping start no effect', () => {
  const fx = new BattleFx(scene);
  fx.onEvent({ type: 'turnStart', unit: 'player' });
  fx.onEvent({ type: 'outcome', outcome: 'defeat' });
  expect(fx.busy).toBe(false);
});
