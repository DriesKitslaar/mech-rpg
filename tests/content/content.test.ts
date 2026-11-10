import type { Build, FramePart } from '../../src/core/types';
import { ENCOUNTERS, ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

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
