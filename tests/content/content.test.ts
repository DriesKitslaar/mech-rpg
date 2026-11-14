import { validatePlayerBuild } from '../../src/core/build';
import type { Build, FramePart, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { ENDINGS, MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';

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

});

describe('sprites', () => {
  test('every part the player can see has a sprite', () => {
    const missing: string[] = [];
    for (const part of SHOP_PARTS) {
      if (part.kind === 'generator') continue; // generators sit inside the mech and are never drawn
      const ids = part.kind === 'arms' ? [`${part.id}.near`, `${part.id}.far`] : [part.id];
      for (const id of ids) if (!(id in SPRITES)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  test('frame layers record where they sit in the pose and free-standing sprites do not', () => {
    const sprites = SPRITES as Record<string, { ox?: number; oy?: number }>;
    expect(sprites['legs-bulwark'].ox).toBeTypeOf('number');
    expect(sprites['arms-rigger.near'].oy).toBeTypeOf('number');
    expect(sprites['wpn-rail-lance'].ox).toBeUndefined();
  });

  test('both backgrounds and both enemies have sprites', () => {
    for (const id of ['bg-neon-district', 'bg-garage', 'enemy-recon-drone', 'enemy-gun-turret']) expect(id in SPRITES, id).toBe(true);
  });
});

describe('campaign content', () => {
  test('there are eleven story contracts and one patrol, with unique ids', () => {
    expect(MISSIONS.filter((m) => m.phase !== 'patrol')).toHaveLength(11);
    expect(MISSIONS.filter((m) => m.phase === 'patrol')).toHaveLength(1);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });

  test('two introductions, and one contract per client in each later phase', () => {
    expect(MISSIONS.filter((m) => m.phase === 'intro')).toHaveLength(2);
    for (const phase of ['faction', 'choice', 'finale'] as const) {
      expect(MISSIONS.filter((m) => m.phase === phase).map((m) => m.faction).sort()).toEqual(['hadron', 'lumen', 'undertow']);
    }
  });

  test.each(MISSIONS.map((m) => [m.id, m] as const))('contract %s is complete and fights known enemies', (_id, mission) => {
    expect(mission.title.length).toBeGreaterThan(0);
    expect(mission.briefing.length).toBeGreaterThan(0);
    expect(mission.debrief.length).toBeGreaterThan(0);
    expect(mission.reward).toBeGreaterThan(0);
    expect(mission.battles.length).toBeGreaterThanOrEqual(1);
    expect(mission.battles.length).toBeLessThanOrEqual(3);
    for (const battle of mission.battles) {
      expect(battle.enemies.length).toBeGreaterThanOrEqual(1);
      expect(battle.enemies.length).toBeLessThanOrEqual(3);
      for (const id of battle.enemies) expect(ENEMIES[id], id).toBeDefined();
      expect(battle.background in SPRITES, battle.background).toBe(true);
    }
    if (mission.portrait) expect(mission.portrait in SPRITES, mission.portrait).toBe(true);
  });

  test('every enemy has a sprite and a build made of known parts', () => {
    for (const enemy of Object.values(ENEMIES)) {
      expect(enemy.sprite in SPRITES, enemy.sprite).toBe(true);
      for (const id of Object.values(enemy.build)) expect(CATALOG[id], `${enemy.id}: ${id}`).toBeDefined();
    }
    expect(Object.keys(ENEMIES)).toHaveLength(6);
  });

  test('every client has an ending', () => {
    expect(Object.keys(ENDINGS).sort()).toEqual(['hadron', 'lumen', 'undertow']);
  });

  test('messages have unique ids and wait for events that exist', () => {
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
    for (const message of MESSAGES) {
      const known = message.after === 'start' || message.after === 'choice' || MISSIONS.some((m) => m.id === message.after);
      expect(known, message.id).toBe(true);
      if (message.portrait) expect(message.portrait in SPRITES, message.portrait).toBe(true);
    }
  });

  test('shop unlocks name real parts and real contracts, and the starter kit is never locked', () => {
    for (const [partId, condition] of Object.entries(SHOP_UNLOCKS)) {
      expect(SHOP_PARTS.some((p) => p.id === partId), partId).toBe(true);
      expect(condition === 'choice' || MISSIONS.some((m) => m.id === condition), condition).toBe(true);
    }
    for (const id of Object.values(STARTER_BUILD)) expect(id in SHOP_UNLOCKS, id).toBe(false);
  });

  test('a second and third weapon can be bought before any client has been worked for', () => {
    const open = SHOP_PARTS.filter((p) => !(p.id in SHOP_UNLOCKS) && p.kind === 'weapon');
    expect(open.filter((p) => p.kind === 'weapon' && p.mount === 'hand').length).toBeGreaterThanOrEqual(2);
    expect(open.filter((p) => p.kind === 'weapon' && p.mount === 'shoulder').length).toBeGreaterThanOrEqual(1);
  });
});
