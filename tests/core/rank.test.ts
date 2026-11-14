import { createBattle, REPAIRS_PER_MISSION, type BattleState } from '../../src/core/battle';
import type { Battle } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { newGame } from '../../src/core/game';
import {
  RANKS, RANK_BONUS, betterRank, missionPar, parOf, performanceOf, rankFor, rankSettlement, recordRank, scoreOf,
} from '../../src/core/rank';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

const b = (enemies: number, extra: Partial<Battle> = {}): Battle => ({ enemies: Array(enemies).fill('recon-drone'), background: 'bg', ...extra });
const won = (extra: Partial<Settlement> = {}): Settlement => ({ won: true, reward: 1000, ammoCost: 100, repairCost: 200, net: 700, lines: [], ...extra });

describe('par', () => {
  test('is three rounds plus two for each enemy, unless the battle says otherwise', () => {
    expect(parOf(b(1))).toBe(5);
    expect(parOf(b(3))).toBe(9);
    expect(parOf(b(3, { par: 12 }))).toBe(12);
  });

  test('of a battle that has to be outlasted is the time it lasts', () => {
    expect(parOf(b(2, { objective: { type: 'survive', rounds: 6 } }))).toBe(6);
    expect(parOf(b(2, { objective: { type: 'survive', rounds: 6 }, par: 4 }))).toBe(4);
  });

  test('of a contract is the sum over its battles', () => {
    expect(missionPar({ battles: [b(1), b(2), b(3, { par: 4 })] })).toBe(5 + 7 + 4);
  });
});

describe('the score', () => {
  test('is 100 for a contract done in time, unscratched and without field repairs', () => {
    expect(scoreOf({ rounds: 5, par: 5, armourLost: 0, repairs: 0 })).toBe(100);
    expect(scoreOf({ rounds: 2, par: 5, armourLost: 0, repairs: 0 })).toBe(100);
  });

  test('loses 5 a round over par, 70 for all the armour and 4 a field repair', () => {
    expect(scoreOf({ rounds: 8, par: 5, armourLost: 0, repairs: 0 })).toBe(85);
    expect(scoreOf({ rounds: 5, par: 5, armourLost: 0.5, repairs: 0 })).toBe(65);
    expect(scoreOf({ rounds: 5, par: 5, armourLost: 0, repairs: 2 })).toBe(92);
    expect(scoreOf({ rounds: 9, par: 5, armourLost: 0.25, repairs: 1 })).toBe(100 - 20 - 17.5 - 4);
  });

  test('never falls below zero', () => {
    expect(scoreOf({ rounds: 60, par: 5, armourLost: 1, repairs: 3 })).toBe(0);
  });

  test('gives S from 88, A from 72, B from 55, C from 35 and D below', () => {
    expect([100, 88, 87.9, 72, 71, 55, 54, 35, 34, 0].map(rankFor)).toEqual(['S', 'S', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
  });
});

describe('ranks', () => {
  test('are ordered from S down, and the better of two is kept', () => {
    expect(RANKS).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(betterRank('B', 'A')).toBe('A');
    expect(betterRank('S', 'D')).toBe('S');
    expect(betterRank(undefined, 'C')).toBe('C');
  });

  test('a better rank replaces the saved one; a worse one does not', () => {
    const g = newGame(CATALOG, STARTER_BUILD);
    const first = recordRank(g, 'intro-1', 'B');
    expect(first.ranks).toEqual({ 'intro-1': 'B' });
    expect(recordRank(first, 'intro-1', 'C')).toBe(first);
    expect(recordRank(first, 'intro-1', 'S').ranks).toEqual({ 'intro-1': 'S' });
    expect(g.ranks).toEqual({});
  });
});

describe('the pay', () => {
  const flawless = { rounds: 5, par: 5, armourLost: 0, repairs: 0 };

  test('S pays a quarter more and A a tenth; the rest pay the fee', () => {
    expect(RANK_BONUS).toEqual({ S: 0.25, A: 0.1, B: 0, C: 0, D: 0 });
    expect(rankSettlement(won(), flawless)).toMatchObject({ rank: 'S', score: 100, bonus: 250, net: 950, reward: 1000 });
    expect(rankSettlement(won(), { ...flawless, armourLost: 0.3 })).toMatchObject({ rank: 'A', bonus: 100, net: 800 });
    expect(rankSettlement(won(), { ...flawless, armourLost: 0.6 })).toMatchObject({ rank: 'B', bonus: 0, net: 700 });
  });

  test('a lost contract has no rank and no bonus', () => {
    const lost = won({ won: false, reward: 0, net: -300 });
    expect(rankSettlement(lost, flawless)).toBe(lost);
  });
});

describe('what a contract is judged on', () => {
  const battle = (): BattleState => createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 1, { mods: { repairs: 1 } });

  test('the rounds fought, the armour missing at the end and the field repairs used', () => {
    const s = structuredClone(battle());
    const player = s.units[0];
    expect(performanceOf(s, 7, 9)).toEqual({ rounds: 7, par: 9, armourLost: 0, repairs: 0 });
    const total = Object.values(player.parts).reduce((sum, part) => sum + part!.maxAp, 0);
    player.parts.core!.ap -= 54;
    player.parts.legs!.ap = 0;
    player.repairsLeft = REPAIRS_PER_MISSION + 1 - 2;
    const p = performanceOf(s, 7, 9);
    expect(p.armourLost).toBeCloseTo((54 + 150) / total);
    expect(p.repairs).toBe(2);
  });
});
