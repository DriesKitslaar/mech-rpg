import {
  ARENA_RANKS, CHAMPION_RANK, MIRROR_ID, MIRROR_OPENS, MIRROR_PURSE, arenaPurse, checkChallenge, mirrorEnemy, mirrorMission, mirrorOpen,
  mirrorPurse, recordArenaWin, recordMirrorWin, shownRanks,
} from '../../src/core/arena';
import { validatePlayerBuild, weaponIn } from '../../src/core/build';
import { createBattle, turnEnergyOf } from '../../src/core/battle';
import { newGame, type GameState } from '../../src/core/game';
import { ARENA, ARENA_ENEMIES } from '../../src/content/arena';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { paintById } from '../../src/ui/paint';

const at = (arenaRank: number): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), arenaRank });

describe('the ladder', () => {
  test('fifteen opponents: ten on the ladder and five in the back room, each purse larger than the last', () => {
    expect(ARENA.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(ARENA.map((o) => o.purse)).toEqual([800, 1200, 1600, 2000, 2600, 3200, 3800, 4600, 5400, 7000, 9000, 11000, 13000, 16000, 22000]);
    expect(new Set(ARENA.map((o) => o.name)).size).toBe(15);
    expect([CHAMPION_RANK, ARENA_RANKS]).toEqual([10, 15]);
  });

  test('the back room is shown to the champion and to nobody else', () => {
    expect(shownRanks(at(0))).toBe(10);
    expect(shownRanks(at(9))).toBe(10);
    expect(shownRanks(at(10))).toBe(15);
    expect(shownRanks(at(15))).toBe(15);
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
    expect(paints.length).toBeGreaterThanOrEqual(11);
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
    expect(checkChallenge(at(9), 11)).toBe('locked');
    expect(checkChallenge(at(10), 11)).toBeNull();
    expect(checkChallenge(at(15), 16)).toBe('unknown');
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
    expect(recordArenaWin(at(10), 11).arenaRank).toBe(11);
    expect(recordArenaWin(at(15), 16).arenaRank).toBe(15);
    const g = at(2);
    recordArenaWin(g, 3);
    expect(g.arenaRank).toBe(2);
  });
});

describe('the mirror match', () => {
  const text = { client: 'Arena Office', win: 'Done.', title: 'Mirror Match', name: 'Echo', style: 'Your own build.', taunt: 'After you.' };

  test('opens at the third rank', () => {
    expect(MIRROR_OPENS).toBe(3);
    expect(mirrorOpen(at(2))).toBe(false);
    expect(mirrorOpen(at(3))).toBe(true);
  });

  test('pays its purse the first time it is won and a quarter after', () => {
    expect(MIRROR_PURSE).toBe(2400);
    expect(mirrorPurse(at(3))).toBe(2400);
    const won = recordMirrorWin(at(3));
    expect(won.stats.mirrors).toBe(1);
    expect(mirrorPurse(won)).toBe(600);
    expect(recordMirrorWin(won).stats.mirrors).toBe(2);
    expect(at(3).stats.mirrors).toBe(0);
  });

  test('is a contract of one duel in the arena against an opponent called after what the office calls it', () => {
    const mission = mirrorMission(at(3), text);
    // The house tunes its copy a tenth hotter than the original.
    expect(mission).toMatchObject({ id: MIRROR_ID, title: 'Mirror Match', client: 'Arena Office', reward: 2400, scale: 1.1, phase: 'patrol' });
    expect(mission.battles).toEqual([{ enemies: ['mirror'], background: 'bg-arena' }]);
    expect(mission.arenaRank).toBeUndefined();
    expect(mission.briefing).toEqual(['Your own build.', '"After you."']);
  });

  test('the opponent flies the pilot\'s own build, part for part, in another paint', () => {
    const g = { ...at(3), build: { ...DEMO_BUILD }, paint: 'cobalt' };
    const echo = mirrorEnemy(g, 'Echo');
    expect(echo).toMatchObject({ id: 'mirror', name: 'Echo', composed: true, ai: 'gunner', build: DEMO_BUILD });
    expect(echo.build).not.toBe(g.build);
    expect(echo.paint).toBe('obsidian');
    // A pilot who flies in obsidian meets an Echo in bone, so the two can be told apart.
    expect(mirrorEnemy({ ...g, paint: 'obsidian' }, 'Echo').paint).toBe('bone');
    // It fights: a battle against it can be created and it has the same armour.
    const s = createBattle(g.build, [echo], CATALOG, 1);
    expect(s.units[1].parts.core!.maxAp).toBe(s.units[0].parts.core!.maxAp);
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
