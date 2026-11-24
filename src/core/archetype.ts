import { framePart, shieldOf, weaponIn } from './build';
import { BUILD_SLOTS, buy, checkBuy, fits, ownedCount, partOf, sameBuild, saveLoadout, savedBuilds, type BuildSlot, type GameState } from './game';
import { WEAPON_SLOTS, type AiProfile, type Build, type Catalog } from './types';

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

/**
 * How the game flies a machine of each class when one is its to fly (a saved build sparred with, a
 * master of the arena): what it aims at, and whether it darts in and out.
 */
export const CLASS_AI: { [kind in Archetype]: AiProfile } = {
  duellist: 'bruiser', marksman: 'gunner', artillery: 'sprayer', lancer: 'gunner', bastion: 'bruiser', skirmisher: 'skirmisher', allrounder: 'gunner',
};

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
  return [...sold].reverse().find((advice) => paidFor(game, advice)) ?? nearest;
}

/** Whether the credits in hand pay for what a build still takes: one owned in full takes none, and a pilot in debt has that many. */
const paidFor = (game: Pick<GameState, 'credits'>, advice: BuildAdvice): boolean => advice.toBuy.length === 0 || advice.cost <= game.credits;

/** The place among the saved builds that holds this build, from 0; -1 when none does. */
export const keptAt = (game: Pick<GameState, 'loadouts'>, build: Build): number =>
  savedBuilds(game).findIndex((saved) => saved !== null && sameBuild(saved, build));

/**
 * Whether a build to try can be followed today: everything of it is owned or on the shelf, the
 * credits in hand pay for what is not owned, and it is not the build the pilot flies already.
 */
export const canFollow = (game: GameState, advice: BuildAdvice): boolean =>
  advice.unsold.length === 0 && paidFor(game, advice) && !sameBuild(game.build, advice.build);

/**
 * Follows a build to try: buys what of it is still to be bought and fits it, in place of what the
 * pilot flew, whose parts go back on the shelf. It is kept among the saved builds too, where it was
 * not kept already and a place is free: no saved build is written over. Null where it cannot be
 * followed (see `canFollow`), or where a part of it is not for sale or goes in no such slot.
 */
export function followAdvice(game: GameState, advice: BuildAdvice, catalog: Catalog): GameState | null {
  if (!canFollow(game, advice)) return null;
  let next = game;
  for (const slot of advice.toBuy) {
    const id = advice.build[slot];
    if (id === undefined || checkBuy(next, id, catalog) !== null) return null;
    next = buy(next, id, catalog);
  }
  // Fitting it frees every part of the build flown: what matters is that enough of each of its own are owned now.
  const needed: { [id: string]: number } = {};
  for (const slot of BUILD_SLOTS) {
    const id = advice.build[slot];
    if (id === undefined) continue;
    needed[id] = (Object.hasOwn(needed, id) ? needed[id] : 0) + 1;
    const part = partOf(catalog, id);
    if (!part || !fits(part, slot) || needed[id] > ownedCount(next, id)) return null;
  }
  next = { ...next, build: { ...advice.build } };
  if (keptAt(next, advice.build) >= 0) return next;
  const free = savedBuilds(next).indexOf(null);
  return free >= 0 ? saveLoadout(next, free) : next;
}
