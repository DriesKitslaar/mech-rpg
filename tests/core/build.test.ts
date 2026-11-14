import {
  DEFAULT_BOOST, LEG_TYPES, boostProfile, computeBuildStats, fcsOf, moduleOf, shieldOf, stabilityFor, validatePlayerBuild,
} from '../../src/core/build';
import type { Catalog, FramePart, Generator, Shield, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

test('starter build statistics', () => {
  expect(computeBuildStats(STARTER_BUILD, CATALOG)).toEqual({
    weight: 800, capacity: 1000, load: 0.8, mobility: 18, turnEnergy: 230, stability: 116,
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

test('a player build needs at least one weapon', () => {
  const { rightHand: _weapon, ...unarmed } = STARTER_BUILD;
  expect(validatePlayerBuild(unarmed, CATALOG)).toEqual(['noWeapon']);
});

describe('boosters, fire control, modules and shields', () => {
  const shield: Shield = { id: 'shd-test', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 90, price: 0 };
  const catalog: Catalog = { ...CATALOG, [shield.id]: shield };

  test('the stock booster and fire control weigh and drain nothing', () => {
    const { booster: _b, fcs: _f, ...bare } = STARTER_BUILD;
    expect(computeBuildStats(bare, CATALOG)).toEqual(computeBuildStats(STARTER_BUILD, CATALOG));
  });

  test('every fitted part counts towards weight, and all but shields towards drain', () => {
    const build = { ...STARTER_BUILD, booster: 'bst-vector', fcs: 'fcs-lattice', module: 'mod-barrier', leftHand: shield.id };
    const base = computeBuildStats(STARTER_BUILD, catalog);
    const stats = computeBuildStats(build, catalog);
    expect(stats.weight).toBe(base.weight + 50 + 15 + 40 + 90);
    expect(stats.turnEnergy).toBe(base.turnEnergy - 15 - 20 - 10);
  });

  test('a player build needs a booster and fire control; a module is optional', () => {
    const { booster: _b, ...noBooster } = STARTER_BUILD;
    const { fcs: _f, ...noFcs } = STARTER_BUILD;
    expect(validatePlayerBuild(noBooster, CATALOG)).toEqual(['missingSlot']);
    expect(validatePlayerBuild(noFcs, CATALOG)).toEqual(['missingSlot']);
    expect(validatePlayerBuild({ ...STARTER_BUILD, module: 'mod-coolant' }, CATALOG)).toEqual([]);
  });

  test('each of the three slots takes only its own kind of part', () => {
    expect(validatePlayerBuild({ ...STARTER_BUILD, booster: 'fcs-stock' }, CATALOG)).toEqual(['unknownPart']);
    expect(validatePlayerBuild({ ...STARTER_BUILD, fcs: 'bst-stock' }, CATALOG)).toEqual(['unknownPart']);
    expect(validatePlayerBuild({ ...STARTER_BUILD, module: 'gen-kd1' }, CATALOG)).toEqual(['unknownPart']);
  });

  test('a shield goes in the left hand only, and is not a weapon', () => {
    expect(validatePlayerBuild({ ...STARTER_BUILD, leftHand: shield.id }, catalog)).toEqual([]);
    expect(validatePlayerBuild({ ...DEMO_BUILD, rightHand: shield.id }, catalog)).toEqual(['wrongMount']);
    expect(validatePlayerBuild({ ...STARTER_BUILD, shoulder: shield.id }, catalog)).toEqual(['wrongMount']);
    const { rightHand: _r, ...onlyShield } = { ...STARTER_BUILD, leftHand: shield.id };
    expect(validatePlayerBuild(onlyShield, catalog)).toEqual(['noWeapon']);
    expect(shieldOf({ ...STARTER_BUILD, leftHand: shield.id }, catalog)).toBe(shield);
    expect(shieldOf(DEMO_BUILD, catalog)).toBeUndefined();
  });

  test('the parts are found by slot, and missing ones are simply absent', () => {
    expect(fcsOf(STARTER_BUILD, CATALOG)?.id).toBe('fcs-stock');
    expect(moduleOf(STARTER_BUILD, CATALOG)).toBeUndefined();
    expect(moduleOf({ ...STARTER_BUILD, module: 'mod-coolant' }, CATALOG)?.effect).toBe('coolant');
    expect(fcsOf(ENEMIES['recon-drone'].build, CATALOG)).toBeUndefined();
  });
});

describe('boosting', () => {
  const legs = (legType: FramePart['legType']): Catalog => ({
    ...CATALOG, 'legs-test': { ...(CATALOG['legs-strider'] as FramePart), id: 'legs-test', legType },
  });
  const on = (legType: FramePart['legType'], booster = 'bst-stock') =>
    boostProfile({ ...STARTER_BUILD, legs: 'legs-test', booster }, legs(legType));

  test('without a booster a unit uses the stock values', () => {
    expect(DEFAULT_BOOST).toEqual({ thrust: 30, cost: 0.3 });
    expect(boostProfile(ENEMIES['recon-drone'].build, CATALOG)).toEqual({ thrust: 30, cost: 0.3, able: true });
    expect(boostProfile(STARTER_BUILD, CATALOG)).toEqual({ thrust: 30, cost: 0.3, able: true });
  });

  test('a booster sets thrust and cost', () => {
    expect(boostProfile({ ...STARTER_BUILD, booster: 'bst-vector' }, CATALOG)).toEqual({ thrust: 38, cost: 0.3, able: true });
    expect(boostProfile({ ...STARTER_BUILD, booster: 'bst-sprint' }, CATALOG)).toEqual({ thrust: 30, cost: 0.2, able: true });
  });

  test('the kind of legs changes it: reverse joints jump further, hover is cheap, tracks cannot boost', () => {
    expect(on('reverse')).toEqual({ thrust: 38, cost: 0.3, able: true });
    expect(on('hover')).toMatchObject({ thrust: 30, able: true });
    expect(on('hover').cost).toBeCloseTo(0.18);
    expect(on('tank').able).toBe(false);
    expect(on('quad')).toEqual({ thrust: 30, cost: 0.3, able: true });
    expect(on(undefined)).toEqual(on('biped'));
  });

  test('a unit without legs cannot boost', () => {
    expect(boostProfile(ENEMIES['gun-turret'].build, CATALOG).able).toBe(false);
  });
});

describe('stability', () => {
  test('grows with weight', () => {
    expect(stabilityFor(0, undefined)).toBe(60);
    expect(stabilityFor(1000, undefined)).toBe(130);
    expect(computeBuildStats(DEMO_BUILD, CATALOG).stability).toBe(Math.round(60 + 0.07 * 990));
  });

  test('four legs and tracks stand firmer, hover less firm; reverse joints stand like any biped', () => {
    expect(stabilityFor(1000, 'quad')).toBe(163);
    expect(stabilityFor(1000, 'tank')).toBe(182);
    expect(stabilityFor(1000, 'hover')).toBe(104);
    expect(stabilityFor(1000, 'reverse')).toBe(130);
    expect(stabilityFor(1000, 'biped')).toBe(130);
    expect(Object.keys(LEG_TYPES).sort()).toEqual(['biped', 'hover', 'quad', 'reverse', 'tank']);
  });
});

describe('a blade needs the energy for the boost that carries it in', () => {
  const blade: Weapon = {
    id: 'wpn-test-blade', name: 'Blade', kind: 'weapon', mount: 'hand', damageType: 'energy', damage: 95, accuracy: 92,
    energy: 110, heat: 14, ammo: null, costPerShot: 0, weight: 60, price: 0, melee: true,
  };
  const weak: Generator = { id: 'gen-test-155', name: 'Weak', kind: 'generator', output: 325, cooling: 10, weight: 100, price: 0 };
  const tracks: FramePart = { ...(CATALOG['legs-strider'] as FramePart), id: 'legs-test-tracks', legType: 'tank' };
  const catalog: Catalog = { ...CATALOG, [blade.id]: blade, [weak.id]: weak, [tracks.id]: tracks };
  const { rightHand: _r, ...unarmed } = STARTER_BUILD;

  test('a mech whose only weapon is a blade it can never afford to swing is refused', () => {
    // 155 energy a turn: the boost takes 47, which leaves 108 for a blade that needs 110.
    const build = { ...unarmed, generator: weak.id, rightHand: blade.id };
    expect(computeBuildStats(build, catalog).turnEnergy).toBe(155);
    expect(validatePlayerBuild(build, catalog)).toEqual(['insufficientEnergy']);
    expect(validatePlayerBuild({ ...unarmed, rightHand: blade.id }, catalog)).toEqual([]);
  });

  test('a gun it can afford makes the build fit to deploy again', () => {
    const build = { ...unarmed, generator: weak.id, rightHand: blade.id, leftHand: 'wpn-rivet-rifle' };
    expect(validatePlayerBuild(build, catalog)).toEqual([]);
  });

  test('on legs that cannot boost a blade is no weapon at all', () => {
    expect(validatePlayerBuild({ ...unarmed, legs: tracks.id, rightHand: blade.id }, catalog)).toEqual(['noWeapon']);
    expect(validatePlayerBuild({ ...unarmed, legs: tracks.id, rightHand: blade.id, leftHand: 'wpn-rivet-rifle' }, catalog)).toEqual([]);
  });
});
