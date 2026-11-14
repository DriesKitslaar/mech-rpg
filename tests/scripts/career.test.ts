import type { Faction, Verdict } from '../../src/core/campaign';
import { DEBT_LIMIT } from '../../src/core/economy';
import type { Difficulty } from '../../src/core/game';
import { careerLine, playCareer } from '../../scripts/careerBot';

/**
 * Whole careers, played by a pilot that presses the buttons itself. What is being checked is that
 * the game can be played to an ending by every road and on every difficulty with what the shop
 * sells along the way: no contract that cannot be won, no pilot left unable to go on, no screen
 * without a way out, and a stored game that always matches the one in memory.
 */
const ROADS: [Faction, Verdict][] = [
  ['hadron', 'enforce'], ['hadron', 'default'], ['lumen', 'enforce'], ['lumen', 'default'], ['undertow', 'enforce'], ['undertow', 'default'],
];

describe.each(['story', 'standard', 'veteran'] as Difficulty[])('a career on %s', (difficulty) => {
  test.each(ROADS)('for %s, giving the verdict "%s", reaches its ending', (faction, verdict) => {
    const report = playCareer({ faction, verdict, difficulty, seed: 1 });
    expect(report.finished, careerLine(report)).toBe(true);
    // Never ruined: a pilot in debt cannot buy, and without a limit one deep in debt never gets out.
    expect(report.lowestCredits, careerLine(report)).toBeGreaterThanOrEqual(DEBT_LIMIT);
    // Hard is allowed. A wall is not: no contract is lost a dozen times running, and the patrols
    // flown for money stay a small part of a career, even on the hardest setting.
    expect(report.worst.streak, careerLine(report)).toBeLessThanOrEqual(12);
    expect(report.grind, careerLine(report)).toBeLessThanOrEqual(difficulty === 'veteran' ? 60 : 20);
  });
});

test('a run of bad luck on the hardest setting does not end a career: debt stops at its limit and the pilot climbs back', () => {
  // With this seed the pilot loses early, and before there was a debt limit never recovered:
  // 180 losses on one contract and 95,000 credits in debt, in the mech it started with.
  const report = playCareer({ faction: 'lumen', verdict: 'enforce', difficulty: 'veteran', seed: 6 });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.worst.streak, careerLine(report)).toBeLessThanOrEqual(12);
  expect(report.lowestCredits).toBeGreaterThanOrEqual(DEBT_LIMIT);
  expect(report.lowestCredits).toBeLessThan(0);
});

test('a second cycle can be played to its ending too, by another road than the first', () => {
  const report = playCareer({ faction: 'lumen', verdict: 'default', difficulty: 'standard', seed: 2, cycles: 2 });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.cycle).toBe(1);
});

test('the same career played twice goes the same way', () => {
  const a = playCareer({ faction: 'undertow', verdict: 'enforce', difficulty: 'standard', seed: 7 });
  const b = playCareer({ faction: 'undertow', verdict: 'enforce', difficulty: 'standard', seed: 7 });
  expect(careerLine(a)).toBe(careerLine(b));
});
