import { framePart, shieldOf, weaponIn } from './build';
import { BUILD_SLOTS, ownedCount, type BuildSlot, type GameState } from './game';
import { WEAPON_SLOTS, type Build, type Catalog } from './types';

/**
 * What kind of machine a build is, by what it carries and how its legs move: a handful of kinds,
 * asked about in this order, and a build is the first that fits. Only the weapons, a shield and the
 * legs are asked about: a head, a core, a pair of arms or anything that goes inside can be changed
 * without the machine being called something else.
 */
export const ARCHETYPES = ['duellist', 'marksman', 'artillery', 'lancer', 'bastion', 'skirmisher', 'allrounder'] as const;
export type Archetype = typeof ARCHETYPES[number];

/**
 * Legs this quick make a skirmisher, and legs this slow a bastion: as the legs are sold, not as the
 * load leaves them. A heavier gun slows a mech down; it does not make it another kind of machine.
 */
export const QUICK_LEGS = 40;
export const SLOW_LEGS = 18;
/** How many weapons, every one of them an energy weapon, make a lancer: one alone is only a sidearm. */
export const LANCER_WEAPONS = 2;

export function archetypeOf(build: Build, catalog: Catalog): Archetype {
  const weapons = WEAPON_SLOTS.flatMap((slot) => weaponIn(build, slot, catalog) ?? []);
  if (weapons.some((weapon) => weapon.melee)) return 'duellist';
  if (weapons.some((weapon) => weapon.charge)) return 'marksman';
  if (weapons.some((weapon) => weapon.trait === 'salvo')) return 'artillery';
  if (weapons.length >= LANCER_WEAPONS && weapons.every((weapon) => weapon.damageType === 'energy')) return 'lancer';
  const mobility = framePart(build, 'legs', catalog)?.mobility;
  if (shieldOf(build, catalog) || (mobility !== undefined && mobility <= SLOW_LEGS)) return 'bastion';
  if (mobility !== undefined && mobility >= QUICK_LEGS) return 'skirmisher';
  return 'allrounder';
}

type Record = Pick<GameState, 'wonAs'>;

/** How many contracts the pilot has won flying a machine of this kind. */
export function wonAs(game: Record, kind: Archetype): number {
  const count = game.wonAs && Object.hasOwn(game.wonAs, kind) ? game.wonAs[kind] : 0;
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? count : 0;
}

/** How many kinds of machine the pilot has won at least so many contracts as. */
export function kindsWon(game: Record, times = 1): number {
  return ARCHETYPES.filter((kind) => wonAs(game, kind) >= times).length;
}

/** The most contracts won as any one kind. */
export function mostWonAs(game: Record): number {
  return Math.max(0, ...ARCHETYPES.map((kind) => wonAs(game, kind)));
}

/** Writes a won contract down against the kind of machine it was won in. */
export function recordWinAs<T extends Record>(game: T, kind: Archetype): T {
  return { ...game, wonAs: { ...(game.wonAs ?? {}), [kind]: wonAs(game, kind) + 1 } };
}

/** A build to try, and what of it the pilot would still have to buy. */
export interface BuildAdvice {
  build: Build;
  /** The slots of it that hold a part the pilot does not own, or not as many of as the build takes. */
  toBuy: BuildSlot[];
  /** What the parts in those slots cost together. */
  cost: number;
  /** The slots among those whose part is not on the shelf yet: nothing the pilot can do about them today. */
  unsold: BuildSlot[];
}

/**
 * Of the builds a kind is given, the humblest first, the one a pilot could put together now: the
 * best of those whose every part is owned or on the shelf and whose missing parts the credits in
 * hand will pay for. When the credits pay for none, it is the one that takes least to complete:
 * something to save for. When no shop sells all of any, it is the humblest, with the parts that are
 * not sold yet named. A part the build takes twice has to be owned twice to count as owned twice.
 */
export function adviceFor(game: GameState, builds: Build[], inStock: (partId: string) => boolean, catalog: Catalog): BuildAdvice {
  const weigh = (build: Build): BuildAdvice => {
    const spare: { [id: string]: number } = {};
    const toBuy: BuildSlot[] = [];
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      if (id === undefined) continue;
      spare[id] = (Object.hasOwn(spare, id) ? spare[id] : ownedCount(game, id)) - 1;
      if (spare[id] < 0) toBuy.push(slot);
    }
    const priced = (slot: BuildSlot): number => (Object.hasOwn(catalog, build[slot]!) ? catalog[build[slot]!].price : 0);
    return { build, toBuy, cost: toBuy.reduce((sum, slot) => sum + priced(slot), 0), unsold: toBuy.filter((slot) => !inStock(build[slot]!)) };
  };
  const weighed = builds.map(weigh);
  const sold = weighed.filter((advice) => advice.unsold.length === 0);
  if (sold.length === 0) return weighed[0];
  const nearest = sold.reduce((least, advice) => (advice.cost < least.cost ? advice : least));
  return [...sold].reverse().find((advice) => advice.cost <= game.credits) ?? nearest;
}
