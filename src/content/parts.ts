import type { Build, Catalog, FramePart, Generator, Part, Resist, Weapon } from '../core/types';

const r = (kinetic: number, energy: number, explosive: number): Resist => ({ kinetic, energy, explosive });

const FRAMES: FramePart[] = [
  { id: 'head-scout-mk1', name: 'Scout Mk1', kind: 'head', ap: 60, resist: r(0.1, 0.1, 0.1), weight: 40, drain: 20, price: 400, aim: 10 },
  { id: 'core-hauler', name: 'Hauler Core', kind: 'core', ap: 220, resist: r(0.2, 0.1, 0.15), weight: 260, drain: 60, price: 400 },
  { id: 'arms-rigger', name: 'Rigger Arms', kind: 'arms', ap: 110, resist: r(0.15, 0.1, 0.1), weight: 120, drain: 40, price: 400, aim: 5 },
  { id: 'legs-strider', name: 'Strider Legs', kind: 'legs', ap: 150, resist: r(0.15, 0.1, 0.1), weight: 200, drain: 50, price: 400, capacity: 1000, mobility: 30 },
  // Enemy-only parts.
  { id: 'core-drone', name: 'Drone Shell', kind: 'core', ap: 50, resist: r(0, 0, 0), weight: 60, drain: 0, price: 0 },
  { id: 'legs-rotor', name: 'Rotor Assembly', kind: 'legs', ap: 30, resist: r(0, 0, 0), weight: 40, drain: 0, price: 0, capacity: 300, mobility: 45 },
  { id: 'core-turret', name: 'Turret Housing', kind: 'core', ap: 260, resist: r(0.4, 0.2, 0.1), weight: 400, drain: 0, price: 0 },
];

const GENERATORS: Generator[] = [
  { id: 'gen-kd1', name: 'KD-1 Cell', kind: 'generator', output: 400, cooling: 25, weight: 100, price: 500 },
  { id: 'gen-drone', name: 'Drone Cell', kind: 'generator', output: 70, cooling: 20, weight: 30, price: 0 },
  { id: 'gen-turret', name: 'Turret Feed', kind: 'generator', output: 200, cooling: 15, weight: 50, price: 0 },
];

const WEAPONS: Weapon[] = [
  { id: 'wpn-rivet-rifle', name: 'Rivet Rifle', kind: 'weapon', mount: 'hand', damageType: 'kinetic', damage: 38, accuracy: 75, energy: 60, heat: 12, ammo: 30, costPerShot: 15, weight: 80, price: 300 },
  { id: 'wpn-arc-pistol', name: 'Arc Pistol', kind: 'weapon', mount: 'hand', damageType: 'energy', damage: 30, accuracy: 80, energy: 90, heat: 22, ammo: null, costPerShot: 0, weight: 50, price: 300 },
  { id: 'wpn-mortar-pod', name: 'Mortar Pod', kind: 'weapon', mount: 'shoulder', damageType: 'explosive', damage: 70, accuracy: 60, energy: 80, heat: 30, ammo: 8, costPerShot: 60, weight: 140, price: 300 },
  // Enemy-only weapons.
  { id: 'wpn-drone-stinger', name: 'Stinger', kind: 'weapon', mount: 'shoulder', damageType: 'kinetic', damage: 14, accuracy: 70, energy: 50, heat: 10, ammo: null, costPerShot: 0, weight: 30, price: 0 },
  { id: 'wpn-turret-cannon', name: 'Bastion Cannon', kind: 'weapon', mount: 'shoulder', damageType: 'kinetic', damage: 60, accuracy: 75, energy: 120, heat: 35, ammo: null, costPerShot: 0, weight: 200, price: 0 },
];

export const CATALOG: Catalog = Object.fromEntries(
  ([...FRAMES, ...GENERATORS, ...WEAPONS] as Part[]).map((part) => [part.id, part]),
);

/** What a new game starts with. */
export const STARTER_BUILD: Build = {
  head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider',
  generator: 'gen-kd1', rightHand: 'wpn-rivet-rifle',
};

/** Fully armed build used by the battle demo and the simulations. */
export const DEMO_BUILD: Build = { ...STARTER_BUILD, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
