import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import type { Faction, Verdict } from '../../src/core/campaign';
import { DEBT_LIMIT } from '../../src/core/economy';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS, STAGES } from '../../src/content/archetypeBuilds';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { careerLine, playCareer, type CareerOptions } from '../../scripts/careerBot';

/**
 * A whole career for each kind of machine: the bot of `scripts/careerBot.ts` buys that kind's
 * builds as the shop and the purse allow, from the first act to a verdict, and flies nothing else
 * once it has the first of them. What is being checked is that every kind gets through the whole
 * story, by each client's road, with what is sold along the way; and that the game's own count of
 * what was won as each kind says so too.
 */

/** The two guns every pilot buys with what the introductions pay, then the kind's own three builds. */
const ladder = (kind: Archetype): Build[] => [REFERENCE_BUILDS.tier1, ...STAGES.map((stage) => ARCHETYPE_BUILDS[kind][stage])];
/** One road for each client, with both of the verdicts every pilot is offered among them. */
const ROADS: [Faction, Verdict, number][] = [['hadron', 'enforce', 1], ['lumen', 'default', 2], ['undertow', 'enforce', 3]];

describe.each([...ARCHETYPES])('a career flown as a %s', (kind) => {
  test.each(ROADS)('on Standard, for %s to the verdict "%s", reaches its ending without a patrol flown for money', (faction, verdict, seed) => {
    const report = playCareer({ faction, verdict, difficulty: 'standard', seed, ladder: ladder(kind) });
    const line = `${kind}: ${careerLine(report)}`;
    expect(report.finished, line).toBe(true);
    expect(report.endings, line).toEqual([`finale-${faction}`, `verdict-${verdict}`]);
    // It ended in the last of its builds: the arena paid out what that one is made of.
    expect(report.tier, line).toBe('rung4');
    // No wall on the way: measured, no kind lost more than one story contract on any of these roads, and none flew a patrol.
    expect(report.grind, line).toBe(0);
    expect(Object.values(report.losses).reduce((sum, n) => sum + n, 0), line).toBeLessThanOrEqual(2);
    expect(report.worst.streak, line).toBeLessThanOrEqual(2);
    expect(report.lowestCredits, line).toBeGreaterThanOrEqual(DEBT_LIMIT);
    // And the game kept count: every contract won was won as something, and more as this kind than as
    // anything else. The rest is the first act, flown in the Hauler and its two guns (an all-rounder)
    // before the first build of the kind could be paid for.
    const won = Object.values(report.wonAs).reduce((sum, n) => sum + n, 0);
    expect(won, line).toBe(report.won);
    if (kind === 'allrounder') expect(report.wonAs, line).toEqual({ allrounder: won });
    else {
      expect(Object.keys(report.wonAs).sort(), line).toEqual(['allrounder', kind].sort());
      expect(report.wonAs[kind], line).toBeGreaterThan(report.wonAs.allrounder);
      expect(report.wonAs[kind], line).toBeGreaterThanOrEqual(15);
    }
  });

  test('on Veteran it still gets there: more losses, some patrols, no wall', () => {
    const report = playCareer({ faction: 'lumen', verdict: 'default', difficulty: 'veteran', seed: 2, ladder: ladder(kind) });
    const line = `${kind}: ${careerLine(report)}`;
    expect(report.finished, line).toBe(true);
    expect(report.endings, line).toEqual(['finale-lumen', 'verdict-default']);
    // Measured on this road: the duellist flew thirty patrols and lost one contract eight times; no other kind flew more than ten.
    expect(report.grind, line).toBeLessThanOrEqual(40);
    expect(report.worst.streak, line).toBeLessThanOrEqual(12);
  });
});

test('a ladder is flown from its first rung up, and a career without one is flown in the reference builds as it always was', () => {
  const plain = playCareer({ faction: 'hadron', verdict: 'enforce', difficulty: 'standard', seed: 1 });
  expect(plain.tier).toBe('tier6');
  expect(plain.finished).toBe(true);
  // A ladder of two rungs: the pilot buys the second when the shop has it, never anything after it, and
  // from then on wins as that kind and no other.
  const only: CareerOptions = { faction: 'hadron', verdict: 'enforce', difficulty: 'standard', seed: 1, ladder: [REFERENCE_BUILDS.tier1, ARCHETYPE_BUILDS.marksman.early], maxContracts: 30 };
  const one = playCareer(only);
  expect(one.tier).toBe('rung2');
  expect(Object.keys(one.wonAs).sort()).toEqual(['allrounder', 'marksman']);
  expect(one.wonAs.marksman).toBeGreaterThan(0);
  // The same career twice is the same career.
  expect(playCareer(only)).toEqual(one);
});
