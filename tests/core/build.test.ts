import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import type { Catalog, Generator, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

test('starter build statistics', () => {
  expect(computeBuildStats(STARTER_BUILD, CATALOG)).toEqual({
    weight: 800, capacity: 1000, load: 0.8, mobility: 18, turnEnergy: 230,
  });
});

test('demo build is heavier and slower with the same energy', () => {
  expect(computeBuildStats(DEMO_BUILD, CATALOG)).toMatchObject({ weight: 990, mobility: 15, turnEnergy: 230 });
});

test('recon drone statistics', () => {
  expect(computeBuildStats(ENEMIES['recon-drone'].build, CATALOG)).toMatchObject({
    weight: 160, mobility: 33, turnEnergy: 70,
  });
});

test('a unit without legs has no mobility and no weight limit', () => {
  expect(computeBuildStats(ENEMIES['gun-turret'].build, CATALOG)).toMatchObject({
    mobility: 0, capacity: Infinity, load: 0, turnEnergy: 200,
  });
});

test('the starter and demo builds are valid', () => {
  expect(validatePlayerBuild(STARTER_BUILD, CATALOG)).toEqual([]);
  expect(validatePlayerBuild(DEMO_BUILD, CATALOG)).toEqual([]);
});

test('a player build needs head, arms and legs', () => {
  const { head: _head, ...noHead } = STARTER_BUILD;
  expect(validatePlayerBuild(noHead, CATALOG)).toEqual(['missingSlot']);
});

test('a build heavier than the legs can carry is refused', () => {
  const anvil: Weapon = {
    id: 'wpn-test-anvil', name: 'Anvil', kind: 'weapon', mount: 'hand', damageType: 'kinetic', damage: 1,
    accuracy: 50, energy: 10, heat: 1, ammo: null, costPerShot: 0, weight: 300, price: 0,
  };
  const catalog: Catalog = { ...CATALOG, [anvil.id]: anvil };
  expect(validatePlayerBuild({ ...DEMO_BUILD, leftHand: anvil.id }, catalog)).toEqual(['overweight']);
});

test('a build that cannot power its cheapest weapon is refused', () => {
  const weak: Generator = { id: 'gen-test-weak', name: 'Weak', kind: 'generator', output: 200, cooling: 10, weight: 100, price: 0 };
  const catalog: Catalog = { ...CATALOG, [weak.id]: weak };
  expect(validatePlayerBuild({ ...STARTER_BUILD, generator: weak.id }, catalog)).toEqual(['insufficientEnergy']);
});

test('a hand weapon cannot go on the shoulder', () => {
  expect(validatePlayerBuild({ ...STARTER_BUILD, shoulder: 'wpn-rivet-rifle' }, CATALOG)).toEqual(['wrongMount']);
});

test('an unknown part id is reported', () => {
  expect(validatePlayerBuild({ ...STARTER_BUILD, core: 'nope' }, CATALOG)).toEqual(['unknownPart']);
});

test('a part of the wrong kind for its slot is reported as unknown', () => {
  expect(validatePlayerBuild({ ...STARTER_BUILD, head: 'core-hauler' }, CATALOG)).toEqual(['unknownPart']);
});
