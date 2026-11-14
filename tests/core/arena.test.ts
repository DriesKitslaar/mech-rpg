import { arenaPurse, checkChallenge, recordArenaWin } from '../../src/core/arena';
import { validatePlayerBuild, weaponIn } from '../../src/core/build';
import { createBattle, turnEnergyOf } from '../../src/core/battle';
import { newGame, type GameState } from '../../src/core/game';
import { ARENA, ARENA_ENEMIES } from '../../src/content/arena';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { paintById } from '../../src/ui/paint';

const at = (arenaRank: number): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), arenaRank });

describe('the ladder', () => {
  test('ten opponents, ranked one to ten, with the purses from the plan', () => {
    expect(ARENA.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ARENA.map((o) => o.purse)).toEqual([800, 1200, 1600, 2000, 2600, 3200, 3800, 4600, 5400, 7000]);
    expect(new Set(ARENA.map((o) => o.name)).size).toBe(10);
  });

  test.each(ARENA.map((o) => [o.name, o] as const))('%s pilots a valid mech whose every part can be drawn', (_name, opponent) => {
    const def = ARENA_ENEMIES[opponent.enemy];
    expect(def).toBeDefined();
    expect(def.composed).toBe(true);
    expect(validatePlayerBuild(def.build, CATALOG)).toEqual([]);
    const { head, core, arms, legs, rightHand, leftHand, shoulder } = def.build;
    for (const id of [head, core, legs, `${arms}.near`, `${arms}.far`, rightHand, leftHand, shoulder].filter(Boolean) as string[]) {
      expect(id in SPRITES, id).toBe(true);
    }
    expect(opponent.scale).toBeGreaterThan(0.4);
    expect(opponent.scale).toBeLessThanOrEqual(1.6);
    expect(opponent.taunt.length).toBeGreaterThan(0);
    if (def.paint) expect(paintById(def.paint), def.paint).toBeDefined();
  });

  test('most of the ladder wears its own paint, and no two the same', () => {
    const paints = Object.values(ARENA_ENEMIES).flatMap((def) => def.paint ?? []);
    expect(paints.length).toBeGreaterThanOrEqual(8);
    expect(new Set(paints).size).toBe(paints.length);
  });
});

describe('challenging', () => {
  test('only the next opponent and those already beaten can be fought', () => {
    expect(checkChallenge(at(0), 1)).toBeNull();
    expect(checkChallenge(at(0), 2)).toBe('locked');
    expect(checkChallenge(at(4), 5)).toBeNull();
    expect(checkChallenge(at(4), 2)).toBeNull();
    expect(checkChallenge(at(4), 6)).toBe('locked');
    expect(checkChallenge(at(10), 11)).toBe('unknown');
    expect(checkChallenge(at(0), 0)).toBe('unknown');
  });

  test('the next opponent pays the full purse, a beaten one a quarter', () => {
    expect(arenaPurse(at(2), ARENA[2])).toBe(1600);
    expect(arenaPurse(at(3), ARENA[2])).toBe(400);
  });

  test('beating the next opponent raises the rank; a rematch or a skipped rank does not', () => {
    expect(recordArenaWin(at(2), 3).arenaRank).toBe(3);
    expect(recordArenaWin(at(5), 3).arenaRank).toBe(5);
    expect(recordArenaWin(at(2), 7).arenaRank).toBe(2);
    const g = at(2);
    recordArenaWin(g, 3);
    expect(g.arenaRank).toBe(2);
  });
});

test('enemies never run out of ammunition, whatever they carry', () => {
  const s = createBattle(DEMO_BUILD, [ARENA_ENEMIES[ARENA[0].enemy]], CATALOG, 1);
  expect(Object.values(s.units[1].ammo).every((a) => a === null)).toBe(true);
  expect(s.units[0].ammo.rightHand).toBe(30);
});

test.each(ARENA.map((o) => [o.name, o] as const))('%s can fire every weapon they carry in one turn', (_name, opponent) => {
  const s = createBattle(DEMO_BUILD, [ARENA_ENEMIES[opponent.enemy]], CATALOG, 1);
  const unit = s.units[1];
  // A shield in the left hand is not fired and costs nothing.
  const cost = (['rightHand', 'leftHand', 'shoulder'] as const)
    .reduce((sum, slot) => sum + (weaponIn(unit.build, slot, CATALOG)?.energy ?? 0), 0);
  expect(turnEnergyOf(unit, CATALOG)).toBeGreaterThanOrEqual(cost);
});
