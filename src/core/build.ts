import {
  FRAME_SLOTS, WEAPON_SLOTS,
  type Build, type BuildError, type BuildStats, type Catalog, type FramePart, type FrameSlot, type Generator,
  type Weapon, type WeaponSlot,
} from './types';

export function framePart(build: Build, slot: FrameSlot, catalog: Catalog): FramePart | undefined {
  const id = build[slot];
  const part = id ? catalog[id] : undefined;
  return part && part.kind === slot ? part : undefined;
}

export function generatorOf(build: Build, catalog: Catalog): Generator {
  const part = catalog[build.generator];
  if (!part || part.kind !== 'generator') throw new Error(`unknown generator: ${build.generator}`);
  return part;
}

export function weaponIn(build: Build, slot: WeaponSlot, catalog: Catalog): Weapon | undefined {
  const id = build[slot];
  const part = id ? catalog[id] : undefined;
  return part && part.kind === 'weapon' ? part : undefined;
}

export function mobilityFor(legs: FramePart | undefined, load: number): number {
  return legs ? Math.round((legs.mobility ?? 0) * (1 - 0.5 * load)) : 0;
}

export function computeBuildStats(build: Build, catalog: Catalog): BuildStats {
  const frames = FRAME_SLOTS.flatMap((slot) => framePart(build, slot, catalog) ?? []);
  const weapons = WEAPON_SLOTS.flatMap((slot) => weaponIn(build, slot, catalog) ?? []);
  const generator = generatorOf(build, catalog);
  const legs = framePart(build, 'legs', catalog);

  const weight = [...frames, ...weapons, generator].reduce((sum, p) => sum + p.weight, 0);
  const capacity = legs ? legs.capacity ?? 0 : Infinity;
  const load = legs ? weight / capacity : 0;
  return {
    weight,
    capacity,
    load,
    mobility: mobilityFor(legs, load),
    turnEnergy: generator.output - frames.reduce((sum, p) => sum + p.drain, 0),
  };
}

const EXPECTED_MOUNT: Record<WeaponSlot, Weapon['mount']> = { rightHand: 'hand', leftHand: 'hand', shoulder: 'shoulder' };

/** Checks the rules a player build must satisfy before it may leave the garage. */
export function validatePlayerBuild(build: Build, catalog: Catalog): BuildError[] {
  const errors = new Set<BuildError>();
  for (const slot of FRAME_SLOTS) {
    if (!build[slot]) errors.add('missingSlot');
    else if (!framePart(build, slot, catalog)) errors.add('unknownPart');
  }
  if (catalog[build.generator]?.kind !== 'generator') errors.add('unknownPart');
  for (const slot of WEAPON_SLOTS) {
    if (!build[slot]) continue;
    const weapon = weaponIn(build, slot, catalog);
    if (!weapon) errors.add('unknownPart');
    else if (weapon.mount !== EXPECTED_MOUNT[slot]) errors.add('wrongMount');
  }
  // Statistics are only meaningful once every part resolves.
  if (errors.has('unknownPart') || errors.has('missingSlot')) return [...errors];

  const stats = computeBuildStats(build, catalog);
  if (stats.weight > stats.capacity) errors.add('overweight');
  const costs = WEAPON_SLOTS.flatMap((slot) => weaponIn(build, slot, catalog)?.energy ?? []);
  // An unarmed mech can only lose: it may not leave the garage.
  if (costs.length === 0) errors.add('noWeapon');
  if (costs.length > 0 && stats.turnEnergy < Math.min(...costs)) errors.add('insufficientEnergy');
  return [...errors];
}
