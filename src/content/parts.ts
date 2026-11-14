import type {
  Booster, Build, Catalog, DamageType, Fcs, FramePart, FrameSlot, Generator, Module, ModuleEffect, Part, Resist, Shield, Vendor,
  Weapon,
} from '../core/types';

const r = (kinetic: number, energy: number, explosive: number): Resist => ({ kinetic, energy, explosive });

type FrameExtra = Pick<FramePart, 'aim' | 'capacity' | 'mobility' | 'legType'>;
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
  trait?: Weapon['trait'], traitPower?: number, extra: Pick<Weapon, 'impact' | 'charge' | 'melee'> = {},
): Weapon => ({
  id, name, kind: 'weapon', mount, damageType, damage, accuracy, energy, heat, ammo, costPerShot, weight, price,
  ...(vendor ? { vendor } : {}), ...(trait ? { trait } : {}), ...(traitPower !== undefined ? { traitPower } : {}), ...extra,
});

const shield = (id: string, name: string, guard: number, weight: number, price: number, vendor: Vendor): Shield =>
  ({ id, name, kind: 'shield', guard, weight, price, vendor });

const booster = (
  id: string, name: string, thrust: number, cost: number, weight: number, drain: number, price: number, vendor: Vendor,
): Booster => ({ id, name, kind: 'booster', thrust, cost, weight, drain, price, vendor });

const fcs = (
  id: string, name: string, kinetic: number, energy: number, explosive: number, focus: number, weight: number, drain: number,
  price: number, vendor: Vendor,
): Fcs => ({ id, name, kind: 'fcs', aim: { kinetic, energy, explosive }, focus, weight, drain, price, vendor });

const module = (
  id: string, name: string, effect: ModuleEffect, power: number, uses: number, weight: number, drain: number, price: number,
  vendor: Vendor,
): Module => ({ id, name, kind: 'module', effect, power, uses, weight, drain, price, vendor });

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

  // Wraith: the fastest frame there is, and the sharpest eye. Arena prize.
  frame('head-wraith', 'Wraith Mask', 'head', 50, r(0.1, 0.15, 0.1), 20, 30, 2200, 'freelance', { aim: 24 }),
  frame('core-wraith', 'Wraith Core', 'core', 190, r(0.15, 0.2, 0.1), 150, 55, 2600, 'freelance'),
  frame('arms-wraith', 'Wraith Arms', 'arms', 90, r(0.15, 0.2, 0.1), 70, 40, 2200, 'freelance', { aim: 16 }),
  frame('legs-wraith', 'Wraith Legs', 'legs', 130, r(0.15, 0.2, 0.1), 120, 60, 2600, 'freelance', { capacity: 800, mobility: 60 }),
  // Colossus: a walking fortress that carries anything. Arena prize.
  frame('head-colossus', 'Colossus Crown', 'head', 110, r(0.3, 0.2, 0.3), 80, 30, 2400, 'freelance', { aim: 8 }),
  frame('core-colossus', 'Colossus Core', 'core', 400, r(0.35, 0.25, 0.35), 480, 85, 3400, 'freelance'),
  frame('arms-colossus', 'Colossus Arms', 'arms', 200, r(0.3, 0.2, 0.3), 230, 55, 2600, 'freelance', { aim: 6 }),
  frame('legs-colossus', 'Colossus Legs', 'legs', 280, r(0.3, 0.2, 0.3), 380, 75, 3000, 'freelance', { capacity: 1900, mobility: 16 }),

  // Mantis: the Undertow's own frame. Reverse-jointed legs that leap, plating that shrugs off blasts.
  frame('head-mantis', 'Mantis Eye', 'head', 55, r(0.1, 0.1, 0.3), 30, 25, 1000, 'undertow', { aim: 14 }),
  frame('core-mantis', 'Mantis Thorax', 'core', 200, r(0.15, 0.1, 0.35), 200, 55, 1500, 'undertow'),
  frame('arms-mantis', 'Mantis Claws', 'arms', 100, r(0.1, 0.1, 0.3), 95, 40, 1100, 'undertow', { aim: 10 }),
  frame('legs-mantis', 'Mantis Hoppers', 'legs', 140, r(0.15, 0.1, 0.3), 160, 55, 1500, 'undertow', { capacity: 950, mobility: 44, legType: 'reverse' }),
  // Legs that are not legs. Each changes a rule of its own; see LEG_TYPES.
  frame('legs-crawler', 'Crawler Treads', 'legs', 300, r(0.35, 0.1, 0.25), 420, 50, 2200, 'hadron', { capacity: 2200, mobility: 8, legType: 'tank' }),
  frame('legs-spider', 'Spider Quad', 'legs', 220, r(0.2, 0.2, 0.2), 300, 70, 2800, 'freelance', { capacity: 1500, mobility: 22, legType: 'quad' }),
  frame('legs-glide', 'Glide Skirt', 'legs', 100, r(0.05, 0.3, 0.05), 110, 70, 2400, 'lumen', { capacity: 750, mobility: 56, legType: 'hover' }),

  generator('gen-kd1', 'KD-1 Cell', 400, 25, 100, 500, 'undertow'),
  generator('gen-dynamo', 'Dynamo Twin', 440, 32, 120, 1000, 'undertow'),
  generator('gen-prism', 'Prism Reactor', 520, 22, 90, 1600, 'lumen'),
  generator('gen-furnace', 'Furnace Block', 460, 38, 170, 1300, 'hadron'),
  generator('gen-ember', 'Ember Stack', 480, 50, 200, 2600, 'freelance'),
  generator('gen-tidal', 'Tidal Core', 600, 30, 140, 3200, 'freelance'),
  generator('gen-cryo', 'Cryo Core', 430, 70, 160, 2200, 'lumen'),
  generator('gen-singularity', 'Singularity Cell', 720, 24, 230, 4200, 'freelance'),

  weapon('wpn-rivet-rifle', 'Rivet Rifle', 'hand', 'kinetic', 38, 75, 60, 12, 30, 15, 80, 300, 'undertow'),
  weapon('wpn-arc-pistol', 'Arc Pistol', 'hand', 'energy', 30, 80, 90, 22, null, 0, 50, 600, 'lumen'),
  weapon('wpn-scatter-gun', 'Scatter Gun', 'hand', 'kinetic', 62, 55, 70, 18, 14, 30, 110, 900, 'hadron'),
  weapon('wpn-rail-lance', 'Rail Lance', 'hand', 'kinetic', 85, 82, 130, 30, 10, 70, 150, 1800, 'hadron'),
  weapon('wpn-pulse-carbine', 'Pulse Carbine', 'hand', 'energy', 44, 78, 110, 26, null, 0, 70, 1300, 'lumen'),
  weapon('wpn-lance-emitter', 'Lance Emitter', 'hand', 'energy', 72, 70, 170, 40, null, 0, 95, 2000, 'lumen'),
  weapon('wpn-frag-launcher', 'Frag Launcher', 'hand', 'explosive', 55, 65, 65, 20, 12, 45, 100, 800, 'undertow'),
  weapon('wpn-needler', 'Needler', 'hand', 'kinetic', 26, 72, 85, 20, 16, 25, 70, 1500, 'undertow', 'twin'),
  weapon('wpn-thermal-lance', 'Thermal Lance', 'hand', 'energy', 40, 76, 120, 24, null, 0, 90, 2200, 'lumen', 'thermal', 18),
  weapon('wpn-arc-caster', 'Arc Caster', 'hand', 'energy', 34, 82, 100, 22, null, 0, 60, 1900, 'freelance', 'drain', 60),
  weapon('wpn-void-rifle', 'Void Rifle', 'hand', 'kinetic', 64, 84, 140, 30, 12, 60, 120, 3000, 'freelance', 'pierce'),
  // Blades: no ammunition and a heavy push, but only in a turn that started with a boost.
  weapon('wpn-arc-blade', 'Arc Blade', 'hand', 'energy', 95, 92, 110, 14, null, 0, 60, 1700, 'lumen', undefined, undefined, { melee: true, impact: 110 }),
  weapon('wpn-breach-pick', 'Breach Pick', 'hand', 'kinetic', 80, 88, 90, 10, null, 0, 110, 1500, 'hadron', 'pierce', undefined, { melee: true, impact: 140 }),
  weapon('wpn-chain-gun', 'Chain Gun', 'hand', 'kinetic', 20, 70, 90, 22, 20, 30, 120, 1400, 'hadron', 'burst', 3),
  // Charge weapons: a turn to charge, then the hardest single hits there are.
  weapon('wpn-longbow', 'Longbow Rail', 'hand', 'kinetic', 150, 90, 150, 34, 8, 90, 140, 2800, 'freelance', 'pierce', undefined, { charge: true }),
  weapon('wpn-ram-fist', 'Ram Fist', 'hand', 'kinetic', 55, 86, 70, 8, null, 0, 80, 700, 'undertow', undefined, undefined, { melee: true, impact: 120 }),
  weapon('wpn-thermal-cutter', 'Thermal Cutter', 'hand', 'energy', 70, 90, 100, 16, null, 0, 70, 1900, 'undertow', 'thermal', 28, { melee: true, impact: 60 }),
  weapon('wpn-marksman', 'Marksman Rifle', 'hand', 'kinetic', 52, 96, 100, 20, 14, 40, 110, 1600, 'lumen', undefined, undefined, { impact: 30 }),
  weapon('wpn-flak', 'Flak Repeater', 'hand', 'explosive', 30, 66, 85, 24, 14, 45, 115, 1500, 'undertow', 'burst', 2),
  weapon('wpn-disruptor', 'Disruptor', 'hand', 'energy', 36, 84, 110, 24, null, 0, 75, 2300, 'lumen', 'drain', 80),
  weapon('wpn-plasma', 'Plasma Thrower', 'hand', 'energy', 50, 86, 120, 28, null, 0, 100, 2100, 'hadron', 'thermal', 22),
  weapon('wpn-coil-pistol', 'Coil Pistol', 'hand', 'kinetic', 100, 88, 100, 22, 10, 50, 90, 1300, 'hadron', undefined, undefined, { charge: true }),
  shield('shd-riot', 'Riot Shield', 0.4, 90, 1100, 'hadron'),
  shield('shd-barrier', 'Barrier Emitter', 0.32, 50, 2200, 'lumen'),
  shield('shd-tower', 'Tower Shield', 0.25, 190, 2600, 'hadron'),
  weapon('wpn-mortar-pod', 'Mortar Pod', 'shoulder', 'explosive', 70, 60, 80, 30, 8, 60, 140, 700, 'undertow'),
  weapon('wpn-siege-cannon', 'Siege Cannon', 'shoulder', 'kinetic', 110, 58, 120, 38, 6, 110, 240, 2000, 'hadron'),
  weapon('wpn-halo-array', 'Halo Array', 'shoulder', 'energy', 60, 85, 150, 34, null, 0, 120, 1900, 'lumen'),
  weapon('wpn-swarm-rack', 'Swarm Rack', 'shoulder', 'explosive', 95, 68, 110, 36, 6, 120, 180, 1700, 'undertow'),
  weapon('wpn-hailstorm', 'Hailstorm', 'shoulder', 'kinetic', 40, 62, 130, 36, 10, 70, 200, 2600, 'hadron', 'twin'),
  weapon('wpn-inferno-pod', 'Inferno Pod', 'shoulder', 'explosive', 60, 64, 110, 32, 8, 80, 170, 2400, 'undertow', 'thermal', 30),
  weapon('wpn-null-beam', 'Null Beam', 'shoulder', 'energy', 50, 80, 160, 38, null, 0, 130, 3200, 'freelance', 'drain', 100),
  weapon('wpn-breaker-cannon', 'Breaker Cannon', 'shoulder', 'explosive', 120, 56, 150, 44, 5, 150, 260, 3600, 'freelance', 'pierce'),
  weapon('wpn-hornet-salvo', 'Hornet Salvo', 'shoulder', 'explosive', 44, 72, 130, 34, 8, 110, 190, 2400, 'undertow', 'salvo'),
  weapon('wpn-sunlance', 'Sunlance', 'shoulder', 'energy', 170, 84, 190, 46, null, 0, 160, 3000, 'lumen', undefined, undefined, { charge: true }),
  weapon('wpn-micro-salvo', 'Micro Salvo', 'shoulder', 'explosive', 28, 70, 100, 26, 10, 60, 130, 1200, 'undertow', 'salvo'),
  weapon('wpn-flare-mortar', 'Flare Mortar', 'shoulder', 'explosive', 55, 62, 95, 28, 9, 70, 150, 1800, 'hadron', 'thermal', 26),
  weapon('wpn-howler', 'Howler', 'shoulder', 'explosive', 46, 70, 100, 30, 8, 70, 170, 2000, 'undertow', undefined, undefined, { impact: 170 }),
  weapon('wpn-buzzsaw', 'Buzzsaw Battery', 'shoulder', 'kinetic', 22, 66, 140, 38, 12, 80, 210, 2500, 'hadron', 'burst', 4),
  weapon('wpn-storm-array', 'Storm Array', 'shoulder', 'energy', 38, 82, 170, 40, null, 0, 150, 3000, 'lumen', 'salvo'),
  weapon('wpn-gauss', 'Gauss Driver', 'shoulder', 'kinetic', 210, 86, 200, 50, 6, 160, 280, 4200, 'freelance', 'pierce', undefined, { charge: true }),

  // Boosters: thrust is the evasion a boost gives, cost the share of a turn's energy it takes.
  // The stock parts weigh and drain nothing: they are what every mech had built in.
  booster('bst-stock', 'Stock Thrusters', 30, 0.3, 0, 0, 100, 'undertow'),
  booster('bst-sprint', 'Sprint Pack', 30, 0.2, 40, 10, 900, 'undertow'),
  booster('bst-vector', 'Vector Jets', 38, 0.3, 50, 15, 1200, 'lumen'),
  booster('bst-ram', 'Ram Booster', 46, 0.4, 90, 20, 1600, 'hadron'),
  booster('bst-glide', 'Glide Unit', 24, 0.12, 30, 10, 1100, 'lumen'),
  booster('bst-after', 'Afterburner', 56, 0.5, 110, 25, 2400, 'hadron'),
  booster('bst-phase', 'Phase Jets', 44, 0.26, 60, 30, 3600, 'freelance'),

  // Fire control: aim per kind of weapon, and focus, the share of the limb penalty it removes.
  fcs('fcs-stock', 'Stock FCS', 0, 0, 0, 0, 0, 0, 100, 'undertow'),
  fcs('fcs-tracer', 'Tracer FCS', 6, 0, 0, 0, 20, 10, 800, 'hadron'),
  fcs('fcs-lattice', 'Lattice FCS', 0, 8, 0, 0.25, 15, 20, 1400, 'lumen'),
  fcs('fcs-hawkeye', 'Hawkeye FCS', 3, 3, 3, 0.6, 25, 25, 2000, 'freelance'),
  fcs('fcs-ballista', 'Ballista FCS', 0, 0, 10, 0, 30, 10, 900, 'undertow'),
  fcs('fcs-surgeon', 'Surgeon FCS', 0, 0, 0, 1, 20, 30, 2600, 'lumen'),
  fcs('fcs-omni', 'Omni FCS', 6, 6, 6, 0.3, 30, 35, 3800, 'freelance'),

  // Modules: one button each, a few uses a battle.
  module('mod-coolant', 'Coolant Flush', 'coolant', 60, 2, 30, 0, 700, 'undertow'),
  module('mod-painter', 'Target Painter', 'painter', 20, 2, 20, 10, 1000, 'lumen'),
  module('mod-overclock', 'Overclock', 'overclock', 150, 1, 30, 0, 1200, 'hadron'),
  module('mod-barrier', 'Pulse Barrier', 'barrier', 90, 1, 40, 10, 1500, 'lumen'),
  module('mod-nanites', 'Repair Nanites', 'nanites', 20, 1, 50, 0, 1800, 'freelance'),
  module('mod-shock', 'Shock Pulse', 'shock', 70, 1, 60, 15, 2200, 'freelance'),
  module('mod-chaff', 'Chaff Pod', 'chaff', 25, 2, 30, 0, 800, 'undertow'),
  module('mod-limiter', 'Limiter Release', 'limiter', 30, 1, 20, 10, 2000, 'hadron'),
  module('mod-cryo', 'Cryo Flush', 'coolant', 100, 3, 50, 5, 1900, 'lumen'),
  module('mod-oracle', 'Oracle Painter', 'painter', 30, 3, 30, 15, 2400, 'freelance'),
  module('mod-aegis', 'Aegis Barrier', 'barrier', 170, 1, 60, 20, 3000, 'freelance'),
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
  weapon('wpn-enemy-needle', 'Stalker Needles', 'hand', 'kinetic', 16, 78, 90, 20, null, 0, 70, 0, undefined, 'twin'),
  weapon('wpn-enemy-maul', 'Siege Maul', 'hand', 'kinetic', 48, 66, 110, 26, null, 0, 150, 0),
  weapon('wpn-enemy-mortar', 'Siege Mortar', 'shoulder', 'explosive', 44, 62, 100, 30, null, 0, 180, 0),
  // Gunship: quick, fragile, rains explosives over the whole mech.
  frame('core-gunship', 'Gunship Hull', 'core', 110, r(0.1, 0.1, 0.1), 120, 0, 0, undefined),
  frame('legs-thrusters', 'Lift Thrusters', 'legs', 60, r(0.1, 0.1, 0.1), 60, 0, 0, undefined, { capacity: 600, mobility: 40 }),
  generator('gen-gunship', 'Gunship Turbine', 150, 22, 40, 0),
  weapon('wpn-gunship-pods', 'Rocket Pods', 'shoulder', 'explosive', 30, 68, 90, 22, null, 0, 60, 0),
  // Lance tower: cannot move, rarely misses, and always goes for the head.
  frame('core-tower', 'Tower Column', 'core', 160, r(0.3, 0.2, 0.2), 300, 0, 0, undefined),
  generator('gen-tower', 'Tower Capacitor', 180, 20, 60, 0),
  weapon('wpn-tower-lance', 'Sentry Lance', 'shoulder', 'kinetic', 44, 88, 130, 40, null, 0, 200, 0),
];

/** The contract (or 'choice' for any exclusive contract) that puts a part in the shop. Unlisted parts are always in stock. */
export const SHOP_UNLOCKS: Record<string, string> = {
  'head-halo': 'lumen-1', 'core-halo': 'lumen-1', 'arms-halo': 'lumen-1', 'legs-halo': 'lumen-1',
  'gen-prism': 'lumen-1', 'wpn-pulse-carbine': 'lumen-1', 'wpn-halo-array': 'lumen-1',
  'head-bulwark': 'hadron-1', 'core-bulwark': 'hadron-1', 'arms-bulwark': 'hadron-1', 'legs-bulwark': 'hadron-1',
  'gen-furnace': 'hadron-1', 'wpn-rail-lance': 'hadron-1', 'wpn-siege-cannon': 'hadron-1',
  'wpn-swarm-rack': 'undertow-1',
  'head-ronin': 'choice', 'core-ronin': 'choice', 'arms-ronin': 'choice', 'legs-ronin': 'choice', 'wpn-lance-emitter': 'choice',
  'wpn-needler': 'undertow-1', 'wpn-thermal-lance': 'choice', 'wpn-hailstorm': 'choice', 'wpn-inferno-pod': 'choice',
  // Arena prizes: each rank won opens something no client sells.
  'wpn-arc-caster': 'arena:2', 'gen-ember': 'arena:3',
  'head-wraith': 'arena:4', 'core-wraith': 'arena:4', 'arms-wraith': 'arena:4', 'legs-wraith': 'arena:4',
  'wpn-void-rifle': 'arena:5', 'gen-tidal': 'arena:6', 'wpn-null-beam': 'arena:7',
  'head-colossus': 'arena:8', 'core-colossus': 'arena:8', 'arms-colossus': 'arena:8', 'legs-colossus': 'arena:8',
  'wpn-breaker-cannon': 'arena:9',
  // Boosters, fire control and modules. The stock parts, the Sprint Pack and the Coolant Flush are always on the shelf.
  'bst-vector': 'lumen-1', 'bst-ram': 'hadron-1',
  'fcs-tracer': 'hadron-1', 'fcs-lattice': 'lumen-1', 'fcs-hawkeye': 'choice',
  'mod-painter': 'lumen-1', 'mod-barrier': 'lumen-1', 'mod-overclock': 'hadron-1', 'mod-nanites': 'arena:2', 'mod-shock': 'arena:4',
  // Blades, charge weapons, bursts, salvos and the shield.
  'wpn-arc-blade': 'lumen-1', 'wpn-breach-pick': 'hadron-1', 'wpn-chain-gun': 'hadron-1', 'shd-riot': 'hadron-1',
  'wpn-longbow': 'choice', 'wpn-sunlance': 'choice', 'wpn-hornet-salvo': 'choice',
  // The Mantis frame and the rest of the Undertow's shelf. The Ram Fist is there from the start.
  'head-mantis': 'undertow-1', 'core-mantis': 'undertow-1', 'arms-mantis': 'undertow-1', 'legs-mantis': 'undertow-1',
  'gen-dynamo': 'undertow-1', 'fcs-ballista': 'undertow-1', 'mod-chaff': 'undertow-1', 'wpn-flak': 'undertow-1',
  'wpn-micro-salvo': 'undertow-1', 'wpn-thermal-cutter': 'choice', 'wpn-howler': 'choice',
  // Lumen.
  'bst-glide': 'lumen-1', 'wpn-marksman': 'lumen-1',
  'legs-glide': 'choice', 'gen-cryo': 'choice', 'fcs-surgeon': 'choice', 'mod-cryo': 'choice', 'wpn-disruptor': 'choice',
  'shd-barrier': 'choice', 'wpn-storm-array': 'choice',
  // Hadron.
  'wpn-coil-pistol': 'hadron-1', 'wpn-flare-mortar': 'hadron-1',
  'legs-crawler': 'choice', 'bst-after': 'choice', 'mod-limiter': 'choice', 'wpn-plasma': 'choice', 'shd-tower': 'choice',
  'wpn-buzzsaw': 'choice',
  // More arena prizes.
  'mod-oracle': 'arena:3', 'bst-phase': 'arena:5', 'legs-spider': 'arena:6', 'mod-aegis': 'arena:6', 'fcs-omni': 'arena:7',
  'wpn-gauss': 'arena:8', 'gen-singularity': 'arena:10',
};

export const CATALOG: Catalog = Object.fromEntries([...SHOP_PARTS, ...ENEMY_PARTS].map((part) => [part.id, part]));

/** What a new game starts with. */
export const STARTER_BUILD: Build = {
  head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider',
  generator: 'gen-kd1', booster: 'bst-stock', fcs: 'fcs-stock', rightHand: 'wpn-rivet-rifle',
};

/** Fully armed build used by the simulations and tests. */
export const DEMO_BUILD: Build = { ...STARTER_BUILD, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
