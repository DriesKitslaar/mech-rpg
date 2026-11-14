import type { Faction, Verdict } from '../../src/core/campaign';
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
    // Never ruined: a pilot in debt cannot buy, and one deep in debt never gets out.
    expect(report.lowestCredits, careerLine(report)).toBeGreaterThan(0);
    // Hard is allowed. A wall is not: no contract takes more than a few evenings.
    expect(report.worst.streak, careerLine(report)).toBeLessThanOrEqual(difficulty === 'veteran' ? 40 : 12);
    expect(report.grind, careerLine(report)).toBeLessThanOrEqual(difficulty === 'veteran' ? 20 : 6);
  });
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
