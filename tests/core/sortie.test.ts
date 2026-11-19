import { validatePlayerBuild } from '../../src/core/build';
import { BUILD_SLOTS, buy, equip, newGame, saveLoadout, sell, type GameState } from '../../src/core/game';
import { fitSortie, sortieBuilds } from '../../src/core/sortie';
import { tunedCatalog } from '../../src/core/tuning';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * What a contract can be taken in: the build on the floor, and the saved builds that can be fitted
 * now and may deploy. And the game with one of them fitted.
 */

/** A pilot who owns every part of the builds given (as many copies as any one of them takes), in the Hauler, with money over. */
function owning(...builds: Build[]): GameState {
  let game: GameState = { ...newGame(CATALOG, STARTER_BUILD), credits: 9_999_999 };
  for (const build of builds) {
    const ids = Object.values(build).filter((id): id is string => id !== undefined);
    for (const id of new Set(ids)) {
      const needed = ids.filter((other) => other === id).length;
      while ((game.inventory[id] ?? 0) < needed) game = buy(game, id, CATALOG);
    }
  }
  return game;
}
/** Fits a build the pilot owns, slot by slot, and comes back with it on the floor. */
function wearing(game: GameState, build: Build): GameState {
  let next = game;
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      try {
        if (id === undefined && next.build[slot] !== undefined) next = equip(next, slot, null, CATALOG);
        else if (id !== undefined && next.build[slot] !== id) next = equip(next, slot, id, CATALOG);
      } catch { /* the next pass */ }
    }
  }
  expect(next.build).toEqual(build);
  return next;
}
/** Saves a build the pilot owns in a slot, and leaves the pilot in the Hauler it started in. */
function saved(game: GameState, slot: number, build: Build): GameState {
  const kept = saveLoadout(wearing(game, build), slot);
  return wearing(kept, game.build);
}
const TIER2 = REFERENCE_BUILDS.tier2;
const DUELLIST = ARCHETYPE_BUILDS.duellist.early;
const BASTION = ARCHETYPE_BUILDS.bastion.early;
/** A hungry frame on the starter's generator with one weapon, a sunlance: a turn's energy is twenty short of firing it. */
const HUNGRY: Build = { ...STARTER_BUILD, head: 'head-auditor', core: 'core-sterling', arms: 'arms-shrike', fcs: 'fcs-omni', rightHand: undefined, shoulder: 'wpn-sunlance' };
const slots = (game: GameState): (number | null)[] => sortieBuilds(game, CATALOG).map((sortie) => sortie.slot);

describe('what a contract can be taken in', () => {
  test('with nothing saved it is the build on the floor and no other', () => {
    const game = newGame(CATALOG, STARTER_BUILD);
    expect(sortieBuilds(game, CATALOG)).toEqual([{ slot: null, build: STARTER_BUILD }]);
    expect(sortieBuilds(game, CATALOG)[0].build).toBe(game.build);
  });

  test('the build on the floor comes first, then the saved builds in the order of their slots, each with the slot it is kept in', () => {
    let game = owning(DUELLIST, BASTION, TIER2);
    game = saved(saved(saved(game, 0, DUELLIST), 1, BASTION), 2, TIER2);
    expect(sortieBuilds(game, CATALOG)).toEqual([
      { slot: null, build: STARTER_BUILD }, { slot: 0, build: DUELLIST }, { slot: 1, build: BASTION }, { slot: 2, build: TIER2 },
    ]);
    // A slot with nothing in it is passed over, and the ones after it keep their numbers.
    const gap = saved(saved(owning(DUELLIST, TIER2), 0, DUELLIST), 2, TIER2);
    expect(gap.loadouts[1]).toBeNull();
    expect(slots(gap)).toEqual([null, 0, 2]);
  });

  test('a saved build that is the build on the floor is not listed twice', () => {
    const game = saved(owning(DUELLIST), 1, DUELLIST);
    expect(slots(game)).toEqual([null, 1]);
    const flown = wearing(game, DUELLIST);
    expect(slots(flown)).toEqual([null]);
    // One slot different is another build.
    const other = saved(owning(DUELLIST), 1, { ...DUELLIST, leftHand: undefined });
    expect(slots(wearing(other, DUELLIST))).toEqual([null, 1]);
  });

  test('a saved build with a part that was sold since is not offered; bought back, it is again', () => {
    const game = saved(owning(DUELLIST), 0, DUELLIST);
    expect(slots(game)).toEqual([null, 0]);
    const sold = sell(game, 'wpn-arc-blade', CATALOG);
    expect(slots(sold)).toEqual([null]);
    expect(slots(buy(sold, 'wpn-arc-blade', CATALOG))).toEqual([null, 0]);
  });

  test('a saved build that takes a part twice is offered only to a pilot who owns it twice', () => {
    const twin: Build = { ...STARTER_BUILD, rightHand: 'wpn-arc-pistol', leftHand: 'wpn-arc-pistol' };
    const game = saved(owning(twin), 0, twin);
    expect(game.inventory['wpn-arc-pistol']).toBe(2);
    expect(slots(game)).toEqual([null, 0]);
    expect(slots(sell(game, 'wpn-arc-pistol', CATALOG))).toEqual([null]);
  });

  test.each([
    ['too heavy for its legs', { ...DEMO_BUILD, core: 'core-colossus', shoulder: 'wpn-siege-cannon' }, 'overweight'],
    ['short of the energy to fire anything it carries', HUNGRY, 'insufficientEnergy'],
    ['without a weapon', { ...STARTER_BUILD, rightHand: undefined }, 'noWeapon'],
  ] as [string, Build, string][])('a saved build that is %s may not deploy, and is not offered', (_why, build, error) => {
    expect(validatePlayerBuild(build, CATALOG)).toEqual([error]);
    // Saved as it is: the garage keeps a build it would not let out of the door.
    const game = { ...owning(build), loadouts: [build, null, null] };
    expect(slots(game)).toEqual([null]);
  });

  test('the catalogue is the one the garage reads: a build the bench has made deployable is offered, and is not without the bench', () => {
    // Twenty of energy short as the parts are sold; one step at the bench gives the generator those twenty.
    const game: GameState = { ...owning(HUNGRY), loadouts: [HUNGRY, null, null] };
    expect(validatePlayerBuild(HUNGRY, CATALOG)).toEqual(['insufficientEnergy']);
    const tuned = { ...game, tuning: { 'gen-kd1': 1 } };
    const bench = tunedCatalog(CATALOG, tuned.tuning);
    expect(validatePlayerBuild(HUNGRY, bench)).toEqual([]);
    expect(sortieBuilds(tuned, bench).map((sortie) => sortie.slot)).toEqual([null, 0]);
    expect(sortieBuilds(tuned, CATALOG).map((sortie) => sortie.slot)).toEqual([null]);
  });

  test('the build on the floor is listed as it is, whatever is wrong with it: it is the garage and the hub that hold a pilot back, not this', () => {
    const bare = { ...newGame(CATALOG, STARTER_BUILD), build: { ...STARTER_BUILD, rightHand: undefined } };
    expect(slots(bare)).toEqual([null]);
  });
});

describe('fitting what was chosen', () => {
  const game = saved(saved(owning(DUELLIST, BASTION), 0, DUELLIST), 2, BASTION);

  test('the build on the floor is the game as it is', () => {
    expect(fitSortie(game, null, CATALOG)).toBe(game);
  });

  test('a saved build is fitted as the garage loads it: the build changes, and nothing else does', () => {
    const fitted = fitSortie(game, 2, CATALOG)!;
    expect(fitted.build).toEqual(BASTION);
    expect(fitted.build).not.toBe(game.loadouts[2]);
    expect({ ...fitted, build: game.build }).toEqual(game);
    expect(game.build).toEqual(STARTER_BUILD);
    // What was on the floor is not saved anywhere by this: the three slots are as they were.
    expect(fitted.loadouts).toEqual(game.loadouts);
  });

  test('a slot that cannot be flown from is refused, and the game is left alone', () => {
    // Nothing saved there; no such slot; a part of it sold since.
    for (const slot of [1, 3, -1, 0.5, Number.NaN]) expect(fitSortie(game, slot, CATALOG), String(slot)).toBeNull();
    const sold = sell(game, 'wpn-arc-blade', CATALOG);
    expect(fitSortie(sold, 0, CATALOG)).toBeNull();
    expect(fitSortie(sold, 2, CATALOG)!.build).toEqual(BASTION);
    // The build that is already on the floor is not a saved build to fit: the floor is asked for by null.
    const flown = fitSortie(game, 0, CATALOG)!;
    expect(fitSortie(flown, 0, CATALOG)).toBeNull();
    expect(fitSortie(flown, null, CATALOG)).toBe(flown);
  });
});
