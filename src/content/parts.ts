import type { Build, Catalog, DamageType, FramePart, FrameSlot, Generator, Part, Resist, Vendor, Weapon } from '../core/types';

const r = (kinetic: number, energy: number, explosive: number): Resist => ({ kinetic, energy, explosive });

type FrameExtra = Pick<FramePart, 'aim' | 'capacity' | 'mobility'>;
const frame = (
  id: string, name: string, kind: FrameSlot, ap: number, resist: Resist, weight: number, drain: number,
  price: number, vendor: Vendor | undefined, extra: FrameExtra = {},
): FramePart => ({ id, name, kind, ap, resist, weight, drain, price, ...(vendor ? { vendor } : {}), ...extra });

const generator = (
  id: string, name: string, output: number, cooling: number, weight: number, price: number, vendor?: Vendor,
): Generator => ({ id, name, kind: 'generator', output, cooling, weight, price, ...(vendor ? { vendor } : {}) });

const weapon = (
  id: string, name: string, mount: Weapon['mount'], damageType: DamageType, damage: number, accuracy: number,
  energy: number, heat: number, ammo: number | null, costPerShot: number, weight: number, price: number, vendor?: Vendor,
): Weapon => ({
  id, name, kind: 'weapon', mount, damageType, damage, accuracy, energy, heat, ammo, costPerShot, weight, price,
  ...(vendor ? { vendor } : {}),
});

/** Everything the player can own, in shop order. Values are fixed by the garage-and-shop plan. */
export const SHOP_PARTS: Part[] = [
  // Salvage: the patched-together starter frame.
  frame('head-scout-mk1', 'Scout Mk1', 'head', 60, r(0.1, 0.1, 0.1), 40, 20, 300, 'undertow', { aim: 10 }),
  frame('core-hauler', 'Hauler Core', 'core', 220, r(0.2, 0.1, 0.15), 260, 60, 300, 'undertow'),
  frame('arms-rigger', 'Rigger Arms', 'arms', 110, r(0.15, 0.1, 0.1), 120, 40, 300, 'undertow', { aim: 5 }),
  frame('legs-strider', 'Strider Legs', 'legs', 150, r(0.15, 0.1, 0.1), 200, 50, 300, 'undertow', { capacity: 1000, mobility: 30 }),
  // Halo: light, quick, shrugs off energy weapons.
  frame('head-halo', 'Halo Visor', 'head', 45, r(0.05, 0.25, 0.05), 25, 25, 900, 'lumen', { aim: 18 }),
  frame('core-halo', 'Halo Core', 'core', 170, r(0.1, 0.3, 0.1), 180, 50, 1400, 'lumen'),
  frame('arms-halo', 'Halo Arms', 'arms', 80, r(0.1, 0.25, 0.05), 80, 35, 1000, 'lumen', { aim: 12 }),
  frame('legs-halo', 'Halo Legs', 'legs', 110, r(0.1, 0.25, 0.05), 140, 55, 1300, 'lumen', { capacity: 850, mobility: 48 }),
  // Bulwark: slow industrial armour that carries anything.
  frame('head-bulwark', 'Bulwark Cab', 'head', 90, r(0.3, 0.05, 0.15), 70, 15, 800, 'hadron', { aim: 4 }),
  frame('core-bulwark', 'Bulwark Core', 'core', 320, r(0.35, 0.05, 0.2), 420, 70, 1500, 'hadron'),
  frame('arms-bulwark', 'Bulwark Arms', 'arms', 160, r(0.3, 0.05, 0.15), 200, 45, 1000, 'hadron', { aim: 2 }),
  frame('legs-bulwark', 'Bulwark Legs', 'legs', 230, r(0.3, 0.05, 0.2), 330, 60, 1400, 'hadron', { capacity: 1500, mobility: 14 }),
  // Ronin: the balanced heavy frame of a seasoned mercenary.
  frame('head-ronin', 'Ronin Helm', 'head', 75, r(0.2, 0.15, 0.25), 50, 25, 1200, 'freelance', { aim: 12 }),
  frame('core-ronin', 'Ronin Core', 'core', 270, r(0.25, 0.15, 0.3), 320, 75, 1900, 'freelance'),
  frame('arms-ronin', 'Ronin Arms', 'arms', 140, r(0.2, 0.15, 0.25), 150, 50, 1400, 'freelance', { aim: 8 }),
  frame('legs-ronin', 'Ronin Legs', 'legs', 190, r(0.2, 0.15, 0.25), 260, 65, 1700, 'freelance', { capacity: 1250, mobility: 26 }),

  generator('gen-kd1', 'KD-1 Cell', 400, 25, 100, 500, 'undertow'),
  generator('gen-prism', 'Prism Reactor', 520, 22, 90, 1600, 'lumen'),
  generator('gen-furnace', 'Furnace Block', 460, 38, 170, 1300, 'hadron'),

  weapon('wpn-rivet-rifle', 'Rivet Rifle', 'hand', 'kinetic', 38, 75, 60, 12, 30, 15, 80, 300, 'undertow'),
  weapon('wpn-arc-pistol', 'Arc Pistol', 'hand', 'energy', 30, 80, 90, 22, null, 0, 50, 600, 'lumen'),
  weapon('wpn-scatter-gun', 'Scatter Gun', 'hand', 'kinetic', 62, 55, 70, 18, 14, 30, 110, 900, 'hadron'),
  weapon('wpn-rail-lance', 'Rail Lance', 'hand', 'kinetic', 85, 82, 130, 30, 10, 70, 150, 1800, 'hadron'),
  weapon('wpn-pulse-carbine', 'Pulse Carbine', 'hand', 'energy', 44, 78, 110, 26, null, 0, 70, 1300, 'lumen'),
  weapon('wpn-lance-emitter', 'Lance Emitter', 'hand', 'energy', 72, 70, 170, 40, null, 0, 95, 2000, 'lumen'),
  weapon('wpn-frag-launcher', 'Frag Launcher', 'hand', 'explosive', 55, 65, 65, 20, 12, 45, 100, 800, 'undertow'),
  weapon('wpn-mortar-pod', 'Mortar Pod', 'shoulder', 'explosive', 70, 60, 80, 30, 8, 60, 140, 700, 'undertow'),
  weapon('wpn-siege-cannon', 'Siege Cannon', 'shoulder', 'kinetic', 110, 58, 120, 38, 6, 110, 240, 2000, 'hadron'),
  weapon('wpn-halo-array', 'Halo Array', 'shoulder', 'energy', 60, 85, 150, 34, null, 0, 120, 1900, 'lumen'),
  weapon('wpn-swarm-rack', 'Swarm Rack', 'shoulder', 'explosive', 95, 68, 110, 36, 6, 120, 180, 1700, 'undertow'),
];

/** Parts only enemies use. No vendor, so they never appear in the shop. */
const ENEMY_PARTS: Part[] = [
  frame('core-drone', 'Drone Shell', 'core', 50, r(0, 0, 0), 60, 0, 0, undefined),
  frame('legs-rotor', 'Rotor Assembly', 'legs', 30, r(0, 0, 0), 40, 0, 0, undefined, { capacity: 300, mobility: 45 }),
  frame('core-turret', 'Turret Housing', 'core', 260, r(0.4, 0.2, 0.1), 400, 0, 0, undefined),
  generator('gen-drone', 'Drone Cell', 70, 20, 30, 0),
  generator('gen-turret', 'Turret Feed', 200, 15, 50, 0),
  weapon('wpn-drone-stinger', 'Stinger', 'shoulder', 'kinetic', 12, 70, 50, 10, null, 0, 30, 0),
  weapon('wpn-turret-cannon', 'Bastion Cannon', 'shoulder', 'kinetic', 48, 75, 120, 35, null, 0, 200, 0),
  // Tank: shrugs off bullets, has no answer to explosives.
  frame('core-tank', 'Tank Hull', 'core', 200, r(0.5, 0.2, 0), 500, 0, 0, undefined),
  frame('legs-tracks', 'Tank Treads', 'legs', 120, r(0.5, 0.2, 0), 300, 0, 0, undefined, { capacity: 2000, mobility: 12 }),
  generator('gen-tank', 'Tank Engine', 220, 20, 150, 0),
  weapon('wpn-tank-gun', 'Howitzer', 'shoulder', 'explosive', 38, 66, 110, 30, null, 0, 200, 0),
  // Weapons of enemy mechs: weaker than what the shop sells, so a duel is a fight and not an execution.
  weapon('wpn-enemy-carbine', 'Security Carbine', 'hand', 'energy', 24, 74, 100, 24, null, 0, 70, 0),
  weapon('wpn-enemy-shotgun', 'Breaching Gun', 'hand', 'kinetic', 36, 60, 80, 20, null, 0, 110, 0),
  weapon('wpn-enemy-lance', 'Duelist Lance', 'hand', 'kinetic', 46, 80, 120, 28, null, 0, 150, 0),
  weapon('wpn-enemy-rack', 'Duelist Rack', 'shoulder', 'explosive', 50, 66, 110, 34, null, 0, 180, 0),
];

/** The contract (or 'choice' for any exclusive contract) that puts a part in the shop. Unlisted parts are always in stock. */
export const SHOP_UNLOCKS: Record<string, string> = {
  'head-halo': 'lumen-1', 'core-halo': 'lumen-1', 'arms-halo': 'lumen-1', 'legs-halo': 'lumen-1',
  'gen-prism': 'lumen-1', 'wpn-pulse-carbine': 'lumen-1', 'wpn-halo-array': 'lumen-1',
  'head-bulwark': 'hadron-1', 'core-bulwark': 'hadron-1', 'arms-bulwark': 'hadron-1', 'legs-bulwark': 'hadron-1',
  'gen-furnace': 'hadron-1', 'wpn-rail-lance': 'hadron-1', 'wpn-siege-cannon': 'hadron-1',
  'wpn-swarm-rack': 'undertow-1',
  'head-ronin': 'choice', 'core-ronin': 'choice', 'arms-ronin': 'choice', 'legs-ronin': 'choice', 'wpn-lance-emitter': 'choice',
};

export const CATALOG: Catalog = Object.fromEntries([...SHOP_PARTS, ...ENEMY_PARTS].map((part) => [part.id, part]));

/** What a new game starts with. */
export const STARTER_BUILD: Build = {
  head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider',
  generator: 'gen-kd1', rightHand: 'wpn-rivet-rifle',
};

/** Fully armed build used by the simulations and tests. */
export const DEMO_BUILD: Build = { ...STARTER_BUILD, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
