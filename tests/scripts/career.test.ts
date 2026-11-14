import type { Faction, Verdict } from '../../src/core/campaign';
import { DEBT_LIMIT } from '../../src/core/economy';
import type { Difficulty } from '../../src/core/game';
import { careerLine, playCareer } from '../../scripts/careerBot';

/**
 * Whole careers, played by the bot in `scripts/careerBot.ts`: it presses its way to and through
 * every contract, fights with Auto Turn only, and buys and fits parts through the rules rather than
 * through the shop and garage screens (its header says exactly what it does and does not do). What
 * is being checked is that the game can be played to an ending by every road and on every
 * difficulty with what the shop sells along the way: no contract that cannot be won, no pilot left
 * unable to go on, no screen on the way without a way out, and a stored game that always matches the
 * one in memory.
 */
const ROADS: [Faction, Verdict][] = [
  ['hadron', 'enforce'], ['hadron', 'default'], ['lumen', 'enforce'], ['lumen', 'default'], ['undertow', 'enforce'], ['undertow', 'default'],
];
/** Three seeds a road: one career proves little, since a career is a few hundred dice. `npm run career -- --all` plays more. */
const SEEDS = [1, 2, 3];
/**
 * What a career may cost at most: the longest run of losses on one contract, and the patrols flown
 * only for money. Measured over nine seeds a road the worst were 0 and 0 on Story, 3 and 5 on
 * Standard, and 16 and 50 on Veteran, where the last fight of the default road is a wall for a pilot
 * that only presses Auto Turn until patrols have paid for more.
 */
const LIMITS: Record<Difficulty, { streak: number; grind: number }> = {
  story: { streak: 3, grind: 5 }, standard: { streak: 6, grind: 12 }, veteran: { streak: 20, grind: 60 },
};

describe.each(['story', 'standard', 'veteran'] as Difficulty[])('careers on %s', (difficulty) => {
  test.each(ROADS)('for %s, giving the verdict "%s", reach their ending with each of three seeds', (faction, verdict) => {
    for (const seed of SEEDS) {
      const report = playCareer({ faction, verdict, difficulty, seed });
      expect(report.finished, careerLine(report)).toBe(true);
      expect(report.endings, careerLine(report)).toEqual([`finale-${faction}`, `verdict-${verdict}`]);
      // Never ruined: a pilot in debt cannot buy, and without the limit one deep in debt never got out.
      // (This holds because the limit exists; it is here so that taking the limit away is noticed.)
      expect(report.lowestCredits, careerLine(report)).toBeGreaterThanOrEqual(DEBT_LIMIT);
      // Hard is allowed. A wall is not.
      expect(report.worst.streak, careerLine(report)).toBeLessThanOrEqual(LIMITS[difficulty].streak);
      expect(report.grind, careerLine(report)).toBeLessThanOrEqual(LIMITS[difficulty].grind);
    }
  });
});

test('a second cycle is played to its ending by another road than the first', () => {
  const report = playCareer({
    faction: 'lumen', verdict: 'default', later: [{ faction: 'hadron', verdict: 'enforce' }], difficulty: 'standard', seed: 2, cycles: 2,
  });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.cycle).toBe(1);
  expect(report.endings).toEqual(['finale-lumen', 'verdict-default', 'finale-hadron', 'verdict-enforce']);
});

test('a third cycle by the third road finishes too, with every client served once', () => {
  const report = playCareer({
    faction: 'undertow', verdict: 'enforce', difficulty: 'standard', seed: 5, cycles: 3,
    later: [{ faction: 'lumen', verdict: 'default' }, { faction: 'hadron', verdict: 'default' }],
  });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.endings.filter((id) => id.startsWith('finale-')).sort()).toEqual(['finale-hadron', 'finale-lumen', 'finale-undertow']);
});

test('the same career played twice goes the same way', () => {
  const a = playCareer({ faction: 'undertow', verdict: 'enforce', difficulty: 'standard', seed: 7 });
  const b = playCareer({ faction: 'undertow', verdict: 'enforce', difficulty: 'standard', seed: 7 });
  expect(careerLine(a)).toBe(careerLine(b));
});

test('arena fights that were lost are counted, apart from contracts', () => {
  const report = playCareer({ faction: 'hadron', verdict: 'enforce', difficulty: 'veteran', seed: 1 });
  expect(report.arenaLosses).toBeGreaterThan(0);
  expect(careerLine(report)).toContain(`arena fights lost ${report.arenaLosses}`);
  expect(Object.keys(report.losses).some((id) => id.startsWith('arena'))).toBe(false);
});
