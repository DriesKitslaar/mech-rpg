import type { Catalog, FramePart, Module, ModuleEffect, Shield, Weapon } from '../../src/core/types';
import { CATALOG } from '../../src/content/parts';

const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const weapon = (id: string, extra: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, vendor: undefined, ...extra });
const moduleOf = (effect: ModuleEffect, power: number, uses = 2): Module =>
  ({ id: `mod-t-${effect}`, name: effect, kind: 'module', effect, power, uses, weight: 0, drain: 0, price: 0 });
const legsOf = (legType: FramePart['legType']): FramePart =>
  ({ ...(CATALOG['legs-strider'] as FramePart), id: `legs-t-${legType}`, name: `legs ${legType}`, legType });

/** Test parts: one of each new kind of weapon, a shield, every module effect and every kind of legs. */
export const EXTRA: Catalog = Object.fromEntries([
  weapon('wpn-t-charge', { damage: 150, accuracy: 90, energy: 150, heat: 34, ammo: 8, charge: true }),
  weapon('wpn-t-blade', { damageType: 'energy', damage: 95, accuracy: 92, energy: 110, heat: 14, ammo: null, melee: true, impact: 110 }),
  weapon('wpn-t-burst', { damage: 20, accuracy: 70, energy: 90, heat: 22, ammo: 20, trait: 'burst', traitPower: 3 }),
  weapon('wpn-t-salvo', { mount: 'shoulder', damageType: 'explosive', damage: 44, accuracy: 72, energy: 130, heat: 34, ammo: 8, trait: 'salvo' }),
  { id: 'shd-t', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 0, price: 0 } satisfies Shield,
  moduleOf('coolant', 60), moduleOf('barrier', 90, 1), moduleOf('overclock', 150, 1), moduleOf('painter', 20),
  moduleOf('nanites', 20, 1), moduleOf('shock', 70, 1), moduleOf('chaff', 25), moduleOf('limiter', 30, 1),
  legsOf('reverse'), legsOf('quad'), legsOf('tank'), legsOf('hover'),
].map((part) => [part.id, part]));

/** The real catalogue plus the test parts. */
export const ALL: Catalog = { ...CATALOG, ...EXTRA };
