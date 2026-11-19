import { validatePlayerBuild } from './build';
import { BUILD_SLOTS, checkLoadout, loadLoadout, type GameState } from './game';
import type { Build, Catalog } from './types';

/** A build a contract can be taken in: the one on the floor (`slot` null), or a saved one, by the slot it is kept in. */
export interface Sortie {
  slot: number | null;
  build: Build;
}

const same = (a: Build, b: Build): boolean => BUILD_SLOTS.every((slot) => a[slot] === b[slot]);

/**
 * What a pilot can take a contract in, the build on the floor first: then every saved build that
 * can be fitted now (each part of it still owned) and may deploy (not too heavy, not short of
 * energy, armed), in the order of their slots. A saved build that is the build on the floor is
 * not listed twice. The catalogue is the one the garage reads: with the bench's work counted in.
 */
export function sortieBuilds(game: GameState, catalog: Catalog): Sortie[] {
  const saved = game.loadouts.flatMap((build, slot): Sortie[] =>
    (build && checkLoadout(game, slot, catalog) === null && validatePlayerBuild(build, catalog).length === 0 && !same(build, game.build) ? [{ slot, build }] : []));
  return [{ slot: null, build: game.build }, ...saved];
}

/**
 * The game with the build of that sortie fitted: as it is for the build on the floor, and for a
 * saved build as the garage loads it. A slot that cannot be flown from now (nothing saved in it, a
 * part of it sold, too heavy as the catalogue reads it) leaves the game as it is: null says so.
 */
export function fitSortie(game: GameState, slot: number | null, catalog: Catalog): GameState | null {
  if (slot === null) return game;
  return sortieBuilds(game, catalog).some((sortie) => sortie.slot === slot) ? loadLoadout(game, slot, catalog) : null;
}
