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
 * that only presses Auto Turn until patrols have paid for more. Since the conversations between
 * contracts (the pilot here gives the first answer on offer, which moves the money and so the dice)
 * the worst of these three seeds on that road is 70 patrols, so Veteran's limit has that and a little.
 */
const LIMITS: Record<Difficulty, { streak: number; grind: number }> = {
  story: { streak: 3, grind: 5 }, standard: { streak: 6, grind: 12 }, veteran: { streak: 20, grind: 75 },
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

test('a second cycle with the logs kept flies the three contracts nobody posted; the first cycle is not offered them', () => {
  const report = playCareer({
    faction: 'lumen', verdict: 'default', later: [{ faction: 'undertow', verdict: 'default' }], difficulty: 'standard', seed: 2, cycles: 2,
    answers: { 'talk-logs': 'keep' }, side: ['quest-1', 'quest-2', 'quest-3'],
  });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.endings).toEqual(['finale-lumen', 'verdict-default', 'finale-undertow', 'verdict-default']);
  expect(report.side).toEqual(['quest-1', 'quest-2', 'quest-3']);
  // Sold, the second is never offered, and so neither is the third.
  const sold = playCareer({
    faction: 'lumen', verdict: 'default', difficulty: 'standard', seed: 2, cycles: 2, answers: { 'talk-logs': 'sell' }, side: ['quest-1', 'quest-2', 'quest-3'],
  });
  expect(sold.finished, careerLine(sold)).toBe(true);
  expect(sold.side).toEqual(['quest-1']);
});

test('a second cycle that keeps faith and brings the box home is offered the third verdict, and reaches its ending', () => {
  // The first answer to every question but one: the logs are kept. Beside the story: the three contracts nobody posted,
  // the favours that come of what was answered, the first notice and the Guild's first three jobs. Between two cycles
  // by two clients' roads that is more than nine checks.
  const side = [
    'quest-1', 'quest-2', 'quest-3', 'favour-kite', 'favour-undertow', 'favour-ashfall', 'favour-marrow', 'favour-sixty', 'favour-dispatch',
    'bounty-1', 'guild-1', 'guild-2', 'guild-3',
  ];
  const report = playCareer({
    faction: 'lumen', verdict: 'default', later: [{ faction: 'undertow', verdict: 'quorum' }], difficulty: 'standard', seed: 2, cycles: 2,
    answers: { 'talk-logs': 'keep' }, side,
  });
  expect(report.finished, careerLine(report)).toBe(true);
  expect(report.endings).toEqual(['finale-lumen', 'verdict-default', 'finale-undertow', 'verdict-quorum']);
  expect(report.side).toEqual(expect.arrayContaining(['quest-1', 'quest-2', 'quest-3']));
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

describe('the long game', () => {
  test('a career of eight cycles finishes on Standard: no contract is a wall, and what was left over went to the bench', () => {
    const report = playCareer({ faction: 'lumen', verdict: 'default', difficulty: 'standard', seed: 2, cycles: 8 });
    expect(report.finished, report.stopped).toBe(true);
    expect(report.cycle).toBe(7);
    // Seven parts of the best frame are of a kind the bench takes; each is at its last step.
    expect(report.benchSteps).toBe(35);
    expect(report.worst.streak).toBeLessThanOrEqual(2);
    expect(report.grind).toBe(0);
  });

  test('on Standard the bench is help and not a toll: the same pilot gets through six cycles without it', () => {
    const report = playCareer({ faction: 'lumen', verdict: 'default', difficulty: 'standard', seed: 2, cycles: 6, bench: false });
    expect(report.finished, report.stopped).toBe(true);
    expect(report.benchSteps).toBe(0);
  });

  test('on Veteran five cycles finish, by another road and to the other verdict', () => {
    const report = playCareer({ faction: 'hadron', verdict: 'enforce', difficulty: 'veteran', seed: 3, cycles: 5 });
    expect(report.finished, report.stopped).toBe(true);
    expect(report.benchSteps).toBe(35);
  });

  test('a pilot in a first cycle who has not reached the best frame keeps their money for the frame', () => {
    const report = playCareer({ faction: 'hadron', verdict: 'default', difficulty: 'standard', seed: 1, maxContracts: 12 });
    expect(report.tier).not.toBe('tier6');
    expect(report.benchSteps).toBe(0);
  });
});
