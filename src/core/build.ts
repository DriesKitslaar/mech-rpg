import {
  FRAME_SLOTS, WEAPON_SLOTS,
  type Booster, type Build, type BuildError, type BuildStats, type Catalog, type DamageType, type Fcs, type FramePart,
  type FrameSlot, type Generator, type LegType, type Module, type Part, type Shield, type Weapon, type WeaponSlot,
} from './types';

/** How hard each kind of damage pushes: slugs and blasts shove, beams barely do. */
export const IMPACT_FACTOR: Record<DamageType, number> = { kinetic: 1, explosive: 1.4, energy: 0.5 };

/** The push one hit of a weapon gives its target's stability. */
export function impactOf(weapon: Weapon): number {
  return weapon.impact ?? Math.round(weapon.damage * IMPACT_FACTOR[weapon.damageType]);
}

/** Looks a part up by id. Names every object has, such as `constructor`, are not parts. */
function lookup(catalog: Catalog, id: string | undefined): Part | undefined {
  return id !== undefined && Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}

export function framePart(build: Build, slot: FrameSlot, catalog: Catalog): FramePart | undefined {
  const part = lookup(catalog, build[slot]);
  return part && part.kind === slot ? part : undefined;
}

export function generatorOf(build: Build, catalog: Catalog): Generator {
  const part = lookup(catalog, build.generator);
  if (!part || part.kind !== 'generator') throw new Error(`unknown generator: ${build.generator}`);
  return part;
}

export function weaponIn(build: Build, slot: WeaponSlot, catalog: Catalog): Weapon | undefined {
  const part = lookup(catalog, build[slot]);
  return part && part.kind === 'weapon' ? part : undefined;
}

export function boosterOf(build: Build, catalog: Catalog): Booster | undefined {
  const part = lookup(catalog, build.booster);
  return part && part.kind === 'booster' ? part : undefined;
}

export function fcsOf(build: Build, catalog: Catalog): Fcs | undefined {
  const part = lookup(catalog, build.fcs);
  return part && part.kind === 'fcs' ? part : undefined;
}

export function moduleOf(build: Build, catalog: Catalog): Module | undefined {
  const part = lookup(catalog, build.module);
  return part && part.kind === 'module' ? part : undefined;
}

/** The shield in the left hand, if that is what the left hand holds. */
export function shieldOf(build: Build, catalog: Catalog): Shield | undefined {
  const part = lookup(catalog, build.leftHand);
  return part && part.kind === 'shield' ? part : undefined;
}

/** What each kind of legs changes. Plain bipeds change nothing. */
export const LEG_TYPES: Record<LegType, {
  /** Multiplies stability. */
  stability: number;
  /** Added to the booster's thrust. */
  thrust: number;
  /** Multiplies the booster's cost. */
  boostCost: number;
  canBoost: boolean;
  /** Damage that gets through while guarding, when it differs from the usual share. */
  guard?: number;
  /** Hit-chance bonus for shoulder weapons. */
  shoulderAim: number;
}> = {
  biped: { stability: 1, thrust: 0, boostCost: 1, canBoost: true, shoulderAim: 0 },
  reverse: { stability: 0.9, thrust: 8, boostCost: 1, canBoost: true, shoulderAim: 0 },
  quad: { stability: 1.25, thrust: 0, boostCost: 1, canBoost: true, shoulderAim: 6 },
  tank: { stability: 1.4, thrust: 0, boostCost: 1, canBoost: false, guard: 0.5, shoulderAim: 0 },
  hover: { stability: 0.8, thrust: 0, boostCost: 0.6, canBoost: true, shoulderAim: 0 },
};

export const legTypeOf = (legs: FramePart | undefined): LegType => legs?.legType ?? 'biped';

export function mobilityFor(legs: FramePart | undefined, load: number): number {
  return legs ? Math.round((legs.mobility ?? 0) * (1 - 0.5 * load)) : 0;
}

export const STABILITY_BASE = 60;
export const STABILITY_PER_WEIGHT = 0.07;

/** How much impact a mech of this weight on these legs takes before it staggers. */
export function stabilityFor(weight: number, legType: LegType | undefined): number {
  return Math.round((STABILITY_BASE + STABILITY_PER_WEIGHT * weight) * LEG_TYPES[legType ?? 'biped'].stability);
}

/** The thrusters a unit has when it fits no booster: what every mech had before boosters were parts. */
export const DEFAULT_BOOST = { thrust: 30, cost: 0.3 };

/** How well and how cheaply a build boosts, and whether it can at all. */
export function boostProfile(build: Build, catalog: Catalog): { thrust: number; cost: number; able: boolean } {
  const legs = framePart(build, 'legs', catalog);
  const type = LEG_TYPES[legTypeOf(legs)];
  const booster = boosterOf(build, catalog) ?? DEFAULT_BOOST;
  return { thrust: booster.thrust + type.thrust, cost: booster.cost * type.boostCost, able: !!legs && type.canBoost };
}

export function computeBuildStats(build: Build, catalog: Catalog): BuildStats {
  const frames = FRAME_SLOTS.flatMap((slot) => framePart(build, slot, catalog) ?? []);
  const weapons = WEAPON_SLOTS.flatMap((slot) => weaponIn(build, slot, catalog) ?? []);
  const generator = generatorOf(build, catalog);
  const legs = framePart(build, 'legs', catalog);
  const internals = [boosterOf(build, catalog), fcsOf(build, catalog), moduleOf(build, catalog)].flatMap((p) => p ?? []);
  const shield = shieldOf(build, catalog);

  const weight = [...frames, ...weapons, generator, ...internals, ...(shield ? [shield] : [])].reduce((sum, p) => sum + p.weight, 0);
  const capacity = legs ? legs.capacity ?? 0 : Infinity;
  const load = legs ? weight / capacity : 0;
  return {
    weight,
    capacity,
    load,
    mobility: mobilityFor(legs, load),
    turnEnergy: generator.output - [...frames, ...internals].reduce((sum, p) => sum + p.drain, 0),
    stability: stabilityFor(weight, legs?.legType),
  };
}

/** Checks the rules a player build must satisfy before it may leave the garage. */
export function validatePlayerBuild(build: Build, catalog: Catalog): BuildError[] {
  const errors = new Set<BuildError>();
  for (const slot of FRAME_SLOTS) {
    if (!build[slot]) errors.add('missingSlot');
    else if (!framePart(build, slot, catalog)) errors.add('unknownPart');
  }
  if (lookup(catalog, build.generator)?.kind !== 'generator') errors.add('unknownPart');
  if (!build.booster) errors.add('missingSlot');
  else if (!boosterOf(build, catalog)) errors.add('unknownPart');
  if (!build.fcs) errors.add('missingSlot');
  else if (!fcsOf(build, catalog)) errors.add('unknownPart');
  if (build.module && !moduleOf(build, catalog)) errors.add('unknownPart');

  for (const slot of WEAPON_SLOTS) {
    if (!build[slot]) continue;
    const part = lookup(catalog, build[slot]);
    if (part?.kind === 'shield') {
      if (slot !== 'leftHand') errors.add('wrongMount');
    } else if (part?.kind !== 'weapon') errors.add('unknownPart');
    else if (part.mount !== (slot === 'shoulder' ? 'shoulder' : 'hand')) errors.add('wrongMount');
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
