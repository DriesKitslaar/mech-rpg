import { NAME_AT, RENOWN, nameRank, nextNameAt, renownOf } from '../../src/core/renown';
import { newGame, type GameState } from '../../src/core/game';
import { NO_STATS, type Stats } from '../../src/core/stats';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/** A name from deeds: the record a game keeps, read as renown, and renown as one of five names. */

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const pilot = (stats: Partial<Stats> = {}, rest: Partial<GameState> = {}): GameState => ({ ...fresh(), stats: { ...NO_STATS, ...stats }, ...rest });

describe('renown', () => {
  test('is what the record says: every machine destroyed, every boss beaten, every rank of the arena, every telling', () => {
    expect(RENOWN).toEqual({ kill: 1, boss: 8, arena: 4, cycle: 40 });
    expect(renownOf(fresh())).toBe(0);
    expect(renownOf(pilot({ kills: 17 }))).toBe(17);
    expect(renownOf(pilot({ bosses: 2 }))).toBe(16);
    expect(renownOf(pilot({}, { arenaRank: 5 }))).toBe(20);
    expect(renownOf(pilot({}, { cycle: 2 }))).toBe(80);
    expect(renownOf(pilot({ kills: 85, bosses: 5 }, { arenaRank: 15, cycle: 0 }))).toBe(185);
  });

  test('counts nothing else: money, time, shots and contracts walked away from earn no name', () => {
    const busy = pilot({ contracts: 90, lost: 30, retreats: 9, shots: 5000, hits: 4000, damage: 90000, earned: 500000, seconds: 360000, rounds: 900, parts: 300, staggers: 80 }, { credits: 999999, xp: 99999 });
    expect(renownOf(busy)).toBe(0);
    expect(nameRank(busy)).toBe(0);
  });
});

describe('the ladder of names', () => {
  test('has five steps, each further than the last', () => {
    expect(NAME_AT).toEqual([20, 60, 150, 320, 600]);
    for (let i = 1; i < NAME_AT.length; i++) expect(NAME_AT[i]).toBeGreaterThan(NAME_AT[i - 1]);
  });

  test('a new pilot has no name; each is earned at its mark and not one short of it', () => {
    expect(nameRank(fresh())).toBe(0);
    NAME_AT.forEach((at, i) => {
      expect(nameRank(pilot({ kills: at - 1 })), `one short of ${at}`).toBe(i);
      expect(nameRank(pilot({ kills: at })), `at ${at}`).toBe(i + 1);
    });
    expect(nameRank(pilot({ kills: 100000 }))).toBe(5);
  });

  test('says what the next name asks for, and nothing at the top', () => {
    expect(nextNameAt(fresh())).toBe(20);
    expect(nextNameAt(pilot({ kills: 20 }))).toBe(60);
    expect(nextNameAt(pilot({ kills: 599 }))).toBe(600);
    expect(nextNameAt(pilot({ kills: 600 }))).toBeNull();
  });

  test('is reached as a career goes: a first name in the first hour, the third by the end of a first telling, the fourth in the second', () => {
    // What the record of a pilot who flies only the story and the arena comes to, as the career bot plays it.
    expect(nameRank(pilot({ kills: 17 }, { arenaRank: 4 }))).toBe(1);
    expect(nameRank(pilot({ kills: 28 }, { arenaRank: 9 }))).toBe(2);
    expect(nameRank(pilot({ kills: 85, bosses: 5 }, { arenaRank: 15 }))).toBe(3);
    expect(nameRank(pilot({ kills: 154, bosses: 10 }, { arenaRank: 15, cycle: 1 }))).toBe(4);
    // Three tellings of the story alone do not reach the last: that takes work beside it.
    expect(nameRank(pilot({ kills: 222, bosses: 15 }, { arenaRank: 15, cycle: 2 }))).toBe(4);
    expect(nameRank(pilot({ kills: 340, bosses: 15 }, { arenaRank: 15, cycle: 2 }))).toBe(5);
  });

  test('never goes down: nothing on the record does, and a new telling keeps it all', () => {
    const before = pilot({ kills: 154, bosses: 10 }, { arenaRank: 15, cycle: 1 });
    const after = { ...before, cycle: 2, completed: [] };
    expect(nameRank(after)).toBeGreaterThanOrEqual(nameRank(before));
    expect(renownOf(after)).toBe(renownOf(before) + 40);
  });
});
