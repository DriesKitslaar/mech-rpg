import { validatePlayerBuild } from './build';
import { checkLoadout, loadLoadout, sameBuild, type GameState } from './game';
import type { Build, Catalog } from './types';

/** A build a contract can be taken in: the one on the floor (`slot` null), or a saved one, by the slot it is kept in. */
export interface Sortie {
  slot: number | null;
  build: Build;
}

/**
 * What a pilot can take a contract in, the build on the floor first: then every saved build that
 * can be fitted now (each part of it still owned) and may deploy (not too heavy, not short of
 * energy, armed), in the order of their slots. A saved build that is the build on the floor is
 * not listed twice. The catalogue is the one the garage reads: with the bench's work counted in.
 */
export function sortieBuilds(game: GameState, catalog: Catalog): Sortie[] {
  const saved = game.loadouts.flatMap((build, slot): Sortie[] =>
    (build && checkLoadout(game, slot, catalog) === null && validatePlayerBuild(build, catalog).length === 0 && !sameBuild(build, game.build) ? [{ slot, build }] : []));
  return [{ slot: null, build: game.build }, ...saved];
}

/** A saved build that no contract can be taken in now: the slot it is kept in, and the part of it that is no longer owned, where that is why. */
export interface Grounded {
  slot: number;
  /** Id of the first part of it that is missing. Absent where every part is owned and the build may not deploy as it is. */
  part?: string;
}

/**
 * The saved builds that `sortieBuilds` leaves out because they cannot be flown now: a part of one was
 * sold, or it may not deploy. Whoever chooses a build is told of them, so that one that was saved is
 * not simply gone. The build on the floor, saved, is not one of them: it is listed as itself.
 */
export function groundedBuilds(game: GameState, catalog: Catalog): Grounded[] {
  return game.loadouts.flatMap((build, slot): Grounded[] => {
    if (!build || sameBuild(build, game.build)) return [];
    const refused = checkLoadout(game, slot, catalog);
    if (refused) return [{ slot, ...(refused.part !== undefined ? { part: refused.part } : {}) }];
    return validatePlayerBuild(build, catalog).length > 0 ? [{ slot }] : [];
  });
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
