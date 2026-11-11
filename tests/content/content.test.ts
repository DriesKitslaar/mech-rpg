import { validatePlayerBuild } from '../../src/core/build';
import type { Build, FramePart, Weapon } from '../../src/core/types';
import { ENCOUNTERS, ENCOUNTER_REWARD, ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';

const SLOT_KIND: Record<keyof Build, string> = {
  head: 'head', core: 'core', arms: 'arms', legs: 'legs', generator: 'generator',
  rightHand: 'weapon', leftHand: 'weapon', shoulder: 'weapon',
};
const builds: [string, Build][] = [
  ['starter', STARTER_BUILD], ['demo', DEMO_BUILD],
  ...Object.values(ENEMIES).map((e): [string, Build] => [e.id, e.build]),
];

test.each(builds)('build %s references existing parts of the right kind', (_name, build) => {
  for (const [slot, id] of Object.entries(build)) {
    expect(CATALOG[id], `${slot}: ${id}`).toBeDefined();
    expect(CATALOG[id].kind).toBe(SLOT_KIND[slot as keyof Build]);
  }
});

test('catalogue keys match part ids', () => {
  for (const [key, part] of Object.entries(CATALOG)) expect(part.id).toBe(key);
});

test('enemy keys match enemy ids', () => {
  for (const [key, enemy] of Object.entries(ENEMIES)) expect(enemy.id).toBe(key);
});

test('encounters reference existing enemies and have one to three of them', () => {
  for (const [name, ids] of Object.entries(ENCOUNTERS)) {
    expect(ids.length, name).toBeGreaterThanOrEqual(1);
    expect(ids.length, name).toBeLessThanOrEqual(3);
    for (const id of ids) expect(ENEMIES[id], `${name}: ${id}`).toBeDefined();
  }
});

test('resist values stay between 0 and 0.6', () => {
  const frames = Object.values(CATALOG).filter((p): p is FramePart => 'resist' in p);
  expect(frames.length).toBeGreaterThan(0);
  for (const part of frames) {
    for (const value of Object.values(part.resist)) {
      expect(value, part.id).toBeGreaterThanOrEqual(0);
      expect(value, part.id).toBeLessThanOrEqual(0.6);
    }
  }
});

test('part names are unique', () => {
  const names = Object.values(CATALOG).map((p) => p.name);
  expect(new Set(names).size).toBe(names.length);
});

describe('shop catalogue', () => {
  const frames = SHOP_PARTS.filter((p): p is FramePart => 'resist' in p);
  const weapons = SHOP_PARTS.filter((p): p is Weapon => p.kind === 'weapon');

  test('thirty parts: sixteen frame parts, three generators, eleven weapons', () => {
    expect(SHOP_PARTS).toHaveLength(30);
    expect(frames).toHaveLength(16);
    expect(SHOP_PARTS.filter((p) => p.kind === 'generator')).toHaveLength(3);
    expect(weapons.filter((w) => w.mount === 'hand')).toHaveLength(7);
    expect(weapons.filter((w) => w.mount === 'shoulder')).toHaveLength(4);
  });

  test('every shop part has a price and a vendor and is in the catalogue', () => {
    for (const part of SHOP_PARTS) {
      expect(part.price, part.id).toBeGreaterThan(0);
      expect(part.vendor, part.id).toBeDefined();
      expect(CATALOG[part.id]).toBe(part);
    }
  });

  test('enemy-only parts are not for sale', () => {
    expect(SHOP_PARTS.find((p) => p.id === 'core-drone')).toBeUndefined();
    expect(CATALOG['core-drone'].vendor).toBeUndefined();
  });

  test.each(['head', 'core', 'arms', 'legs'] as const)('there are four %s parts', (kind) => {
    expect(frames.filter((p) => p.kind === kind)).toHaveLength(4);
  });

  test.each(['scout-mk1|hauler|rigger|strider', 'halo|halo|halo|halo', 'bulwark|bulwark|bulwark|bulwark', 'ronin|ronin|ronin|ronin'])(
    'family %s makes a valid build with every generator', (family) => {
      const [head, core, arms, legs] = family.split('|');
      for (const generator of ['gen-kd1', 'gen-prism', 'gen-furnace']) {
        const build: Build = {
          head: `head-${head}`, core: `core-${core}`, arms: `arms-${arms}`, legs: `legs-${legs}`, generator, rightHand: 'wpn-rivet-rifle',
        };
        expect(validatePlayerBuild(build, CATALOG), `${family} + ${generator}`).toEqual([]);
      }
    });

  test('spot checks against the plan', () => {
    expect(CATALOG['legs-bulwark']).toMatchObject({ capacity: 1500, mobility: 14, price: 1400, vendor: 'hadron' });
    expect(CATALOG['wpn-rail-lance']).toMatchObject({ damage: 85, accuracy: 82, ammo: 10, mount: 'hand' });
    expect(CATALOG['gen-prism']).toMatchObject({ output: 520, cooling: 22 });
    expect(CATALOG['head-scout-mk1'].price).toBe(300);
    expect(CATALOG['wpn-halo-array']).toMatchObject({ ammo: null, mount: 'shoulder', damageType: 'energy' });
  });

  test('every encounter pays a reward', () => {
    for (const name of Object.keys(ENCOUNTERS)) expect(ENCOUNTER_REWARD[name], name).toBeGreaterThan(0);
    expect(ENCOUNTER_REWARD).toMatchObject({ intro: 600, outpost: 1100 });
  });
});
