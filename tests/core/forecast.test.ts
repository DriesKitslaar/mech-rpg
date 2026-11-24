import { chooseAutoPlayerAction, runBattle, stepBattle } from '../../src/core/ai';
import type { Mission } from '../../src/core/campaign';
import { FORECAST_PLAYS, FORECAST_STEPS, NEAR_SCALE, ODDS_GOOD, advance, counted, forecastSeed, neared, nearness, nearnessOf, newCount, type Count } from '../../src/core/forecast';
import { playMission, startFight, type Fight } from '../../src/core/mission';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/**
 * The odds of a contract: the game's automatic pilot flies it twenty times, a few actions at a
 * time, and the wins are counted. What is counted is what playing the contract through would give.
 */

const mission = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;
const DEEP_WATER = mission('hadron-4');
const LANCER: Fight = { build: ARCHETYPE_BUILDS.lancer.war, enemies: ENEMIES, opts: { enemyScale: 1 } };
const SHARP: Fight = { build: ARCHETYPE_BUILDS.marksman.war, enemies: ENEMIES, opts: { enemyScale: 1 } };

/** Counts to the end, so many steps at a time, and says how many goes it took. */
function countAll(fight: Fight, contract: Mission, steps?: number): { count: Count; goes: number } {
  let count = newCount();
  let goes = 0;
  while (!counted(count)) {
    count = steps === undefined ? advance(count, fight, contract, CATALOG) : advance(count, fight, contract, CATALOG, steps);
    goes += 1;
    if (goes > 200_000) throw new Error('the count never ends');
  }
  return { count, goes };
}
/** The same twenty flights, each played through in one go. */
function played(fight: Fight, contract: Mission): number {
  let won = 0;
  for (let flight = 0; flight < FORECAST_PLAYS; flight++) {
    const end = playMission(fight.build, contract, fight.enemies, CATALOG, forecastSeed(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), fight.opts);
    if (end.outcome === 'victory') won += 1;
  }
  return won;
}

test('twenty flights, a handful of actions at a time', () => {
  expect(FORECAST_PLAYS).toBe(20);
  expect(FORECAST_STEPS).toBe(8);
});

test('the flights are always the same flights: each has its own seed, and no two share one', () => {
  expect([0, 1, 2, 3].map(forecastSeed)).toEqual([7919, 2 * 104729 + 13, 3 * 7919, 4 * 104729 + 13]);
  expect(new Set(Array.from({ length: FORECAST_PLAYS }, (_, flight) => forecastSeed(flight))).size).toBe(FORECAST_PLAYS);
});

test('a new count has counted nothing and has nothing in the air', () => {
  expect(newCount()).toEqual({ tally: { played: 0, won: 0 }, index: 0, state: null, lost: [], again: { flown: 0, turned: 0 } });
  expect(counted(newCount())).toBe(false);
});

test('what is counted is what playing the contract through twenty times gives: a win is a contract won to its last battle', () => {
  const { count } = countAll(LANCER, DEEP_WATER);
  expect(count.tally).toEqual({ played: 20, won: 9 });
  expect(count.tally.won).toBe(played(LANCER, DEEP_WATER));
  // As the last of the twenty is counted nothing is in the air. (A step at a time: with odds like these the count
  // goes on to fly the lost flights again, and a go of several steps may have begun the first of them.)
  expect(countAll(LANCER, DEEP_WATER, 1).count.state).toBeNull();
  // Another build on the same contract is another count.
  expect(countAll(SHARP, DEEP_WATER).count.tally).toEqual({ played: 20, won: 20 });
});

test('the count comes out the same however little is worked out at a time, and a little at a time takes many goes', () => {
  const whole = countAll(LANCER, DEEP_WATER, 100_000);
  const usual = countAll(LANCER, DEEP_WATER);
  const single = countAll(LANCER, DEEP_WATER, 1);
  expect(whole.goes).toBe(1);
  expect(usual.count.tally).toEqual(whole.count.tally);
  expect(single.count.tally).toEqual(whole.count.tally);
  // One step is one thing done: a battle begun, an action taken, or a flight counted.
  expect(usual.goes).toBe(Math.ceil(single.goes / FORECAST_STEPS));
  expect(usual.goes).toBeGreaterThan(100);
});

test('one go does no more than the steps it was given: the first begins a flight, the next ones fly it', () => {
  const begun = advance(newCount(), LANCER, DEEP_WATER, CATALOG, 1);
  expect(begun.tally).toEqual({ played: 0, won: 0 });
  expect(begun.index).toBe(0);
  expect(begun.state).toEqual(startFight(LANCER, DEEP_WATER, 0, CATALOG, forecastSeed(0)));
  const flown = advance(begun, LANCER, DEEP_WATER, CATALOG, 3);
  let state = begun.state!;
  for (let i = 0; i < 3; i++) state = stepBattle(state, CATALOG, chooseAutoPlayerAction);
  expect(flown.state).toEqual(state);
  expect(flown.tally.played).toBe(0);
});

test('a go leaves the count it was given as it was', () => {
  const before = advance(newCount(), LANCER, DEEP_WATER, CATALOG, 40);
  const kept = structuredClone(before);
  const after = advance(before, LANCER, DEEP_WATER, CATALOG, 40);
  expect(before).toEqual(kept);
  expect(after).not.toEqual(before);
});

test('a count that is done stays as it is', () => {
  const { count } = countAll(SHARP, DEEP_WATER, 100_000);
  expect(counted(count)).toBe(true);
  expect(advance(count, SHARP, DEEP_WATER, CATALOG)).toEqual(count);
  expect(counted({ ...count, tally: { played: FORECAST_PLAYS - 1, won: 3 } })).toBe(false);
});

test('a flight lost in its first battle never begins the second, and counts as lost', () => {
  // More than the starter can take to begin with, and a drone it will never get to.
  const fight: Fight = { build: STARTER_BUILD, enemies: ENEMIES, opts: { enemyScale: 1 } };
  const contract: Mission = {
    id: 't', title: 't', phase: 'faction', client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
    battles: [{ enemies: ['leviathan', 'juggernaut', 'juggernaut'], background: 'bg' }, { enemies: ['recon-drone'], background: 'bg' }],
  };
  let count = newCount();
  let furthest = 0;
  while (!counted(count)) {
    count = advance(count, fight, contract, CATALOG, 1);
    furthest = Math.max(furthest, count.index);
  }
  expect(count.tally).toEqual({ played: 20, won: 0 });
  expect(furthest).toBe(0);
});

test('a flight that wins its first battle and loses its last counts as lost: the next battle begins where the last one left the mech', () => {
  // A drone to begin with, then more than the starter can take.
  const contract: Mission = {
    id: 't', title: 't', phase: 'faction', client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
    battles: [{ enemies: ['recon-drone'], background: 'bg' }, { enemies: ['leviathan', 'juggernaut', 'juggernaut'], background: 'bg' }],
  };
  const fight: Fight = { build: STARTER_BUILD, enemies: ENEMIES, opts: { enemyScale: 1 } };
  let count = newCount();
  let seen: Count | null = null;
  while (count.tally.played < 1) {
    const next = advance(count, fight, contract, CATALOG, 1);
    // The step that begins the second battle: it starts from the first as it ended.
    if (next.index === 1 && count.index === 0) {
      expect(count.state!.outcome).toBe('victory');
      expect(next.state).toEqual(startFight(fight, contract, 1, CATALOG, forecastSeed(0), count.state!));
      seen = next;
    }
    count = next;
  }
  expect(seen).not.toBeNull();
  expect(count).toEqual({ tally: { played: 1, won: 0 }, index: 0, state: null, lost: [0], again: { flown: 0, turned: 0 } });
});

test('the count is of the fight it is given: the scale of the enemy, what the pilot brings and the Overdrive all tell', () => {
  const contract = mission('intro-2');
  const plain: Fight = { build: STARTER_BUILD, enemies: ENEMIES, opts: { enemyScale: 1 } };
  expect(countAll(plain, contract, 100_000).count.tally.won).toBe(20);
  // Twice the enemy: the starter seldom comes through.
  const doubled = countAll({ ...plain, opts: { enemyScale: 2 } }, contract, 100_000).count.tally.won;
  expect(doubled).toBe(4);
  expect(doubled).toBe(played({ ...plain, opts: { enemyScale: 2 } }, contract));
  // The same with what a seasoned pilot brings, and with an Overdrive to spend.
  const seasoned: Fight = { ...plain, opts: { enemyScale: 2, mods: { aim: 20, armour: 0.4 } } };
  const driven: Fight = { ...plain, opts: { enemyScale: 2, overdrive: 'iron-skin' } };
  expect(countAll(seasoned, contract, 100_000).count.tally.won).toBe(played(seasoned, contract));
  expect(countAll(seasoned, contract, 100_000).count.tally.won).toBeGreaterThan(doubled);
  expect(countAll(driven, contract, 100_000).count.tally.won).toBe(played(driven, contract));
  expect(countAll(driven, contract, 100_000).count.tally.won).not.toBe(doubled);
});

test('a contract that fills the Overdrive hands it over full as its first battle opens, and only then', () => {
  const contract: Mission = {
    id: 't', title: 't', phase: 'faction', client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
    battles: [{ enemies: ['recon-drone'], background: 'bg' }, { enemies: ['recon-drone'], background: 'bg' }],
  };
  const fight: Fight = { build: STARTER_BUILD, enemies: ENEMIES, opts: { enemyScale: 1, overdrive: 'second-wind' }, drive: 100 };
  const first = startFight(fight, contract, 0, CATALOG, 5);
  expect(first.units[0].overdrive).toBe('second-wind');
  expect(first.units[0].drive).toBe(100);
  // The second battle opens with what the first left on the meter, not with the hand-out again.
  const won = { ...structuredClone(first), outcome: 'victory' as const };
  won.units[0].drive = 37;
  expect(startFight(fight, contract, 1, CATALOG, 5, won).units[0].drive).toBe(37);
  // One that was spent in the first battle is not handed over again in the second.
  const spent = { ...structuredClone(first), outcome: 'victory' as const };
  spent.units[0].drive = 0;
  expect(startFight(fight, contract, 1, CATALOG, 5, spent).units[0].drive).toBe(0);
  // Without a hand-out the meter starts empty.
  expect(startFight({ ...fight, drive: undefined }, contract, 0, CATALOG, 5).units[0].drive).toBe(0);
});

describe('how near the lost flights were', () => {
  /** Counts on until every lost flight has been flown again, so many steps at a time. */
  function nearAll(fight: Fight, contract: Mission, steps = 100_000): Count {
    let count = newCount();
    for (let goes = 0; !neared(count); goes++) {
      count = advance(count, fight, contract, CATALOG, steps);
      if (goes > 400_000) throw new Error('the count never ends');
    }
    return count;
  }
  /** Whether a flight is won, played through in one go, with the opposition at a share of what it is. */
  const wins = (fight: Fight, contract: Mission, flight: number, share = 1): boolean =>
    playMission(fight.build, contract, fight.enemies, CATALOG, forecastSeed(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { ...fight.opts, enemyScale: (fight.opts.enemyScale ?? 1) * share }).outcome === 'victory';

  test('by the share of them that a tenth less opposition turns: two thirds narrowly, a third clearly, fewer outmatched', () => {
    expect(NEAR_SCALE).toBe(0.9);
    expect(ODDS_GOOD).toBe(0.75);
    expect(nearnessOf(15, 14)).toBe('narrow');
    expect(nearnessOf(16, 1)).toBe('outmatched');
    expect(nearnessOf(14, 8)).toBe('clear');
    // On the lines themselves: two of three is narrowly, one of three is clearly.
    expect([nearnessOf(6, 4), nearnessOf(6, 3), nearnessOf(6, 2), nearnessOf(6, 1), nearnessOf(6, 0)]).toEqual(['narrow', 'clear', 'clear', 'outmatched', 'outmatched']);
    expect(nearnessOf(20, 20)).toBe('narrow');
    // With no flight lost there is nothing to say.
    expect(nearnessOf(0, 0)).toBeNull();
  });

  test('a count with good odds is done when it is counted: nothing is flown again, and nothing is said', () => {
    const { count } = countAll(SHARP, DEEP_WATER, 100_000);
    expect(count.tally).toEqual({ played: 20, won: 20 });
    expect(neared(count)).toBe(true);
    expect(nearness(count)).toBeNull();
    expect(count.lost).toEqual([]);
    expect(count.again).toEqual({ flown: 0, turned: 0 });
    // Fifteen of twenty is good, fourteen is not: one flight is the line.
    const lost = (n: number): Count => ({ ...count, tally: { played: 20, won: 20 - n }, lost: Array.from({ length: n }, (_, i) => i) });
    expect([neared(lost(5)), neared(lost(6))]).toEqual([true, false]);
    expect(nearness({ ...lost(5), again: { flown: 5, turned: 5 } })).toBeNull();
    expect(nearness({ ...lost(6), again: { flown: 6, turned: 6 } })).toBe('narrow');
  });

  test('where the odds are not good, the lost flights are flown again against a tenth less, each from its own seed', () => {
    // (A step at a time, so that the count is looked at as its last flight is counted and not a step later.)
    const { count: odds } = countAll(LANCER, DEEP_WATER, 1);
    expect(odds.tally).toEqual({ played: 20, won: 9 });
    // The count knows which flights were lost: the ones that playing each through loses.
    const lost = Array.from({ length: FORECAST_PLAYS }, (_, flight) => flight).filter((flight) => !wins(LANCER, DEEP_WATER, flight));
    expect(odds.lost).toEqual(lost);
    expect(lost).toHaveLength(11);
    // Counted, and not yet done: there are flights to fly again, and until they are nothing is said.
    expect([counted(odds), neared(odds), nearness(odds)]).toEqual([true, false, null]);
    const count = nearAll(LANCER, DEEP_WATER);
    const turned = lost.filter((flight) => wins(LANCER, DEEP_WATER, flight, NEAR_SCALE)).length;
    expect(count.again).toEqual({ flown: lost.length, turned });
    expect(nearness(count)).toBe(nearnessOf(lost.length, turned));
    expect(nearness(count)).not.toBeNull();
    // The odds are the odds: flying the lost flights again moved nothing of them.
    expect(count.tally).toEqual(odds.tally);
    expect(count.lost).toEqual(odds.lost);
    expect(count.state).toBeNull();
    // And then it is done: another go changes nothing.
    expect(advance(count, LANCER, DEEP_WATER, CATALOG)).toEqual(count);
  });

  test('it comes out the same however little is worked out at a time', () => {
    const whole = nearAll(LANCER, DEEP_WATER);
    for (const steps of [1, FORECAST_STEPS, 64]) expect(nearAll(LANCER, DEEP_WATER, steps), String(steps)).toEqual(whole);
  });

  test('a go leaves the count it was given as it was, in the second flying as in the first', () => {
    const { count: odds } = countAll(LANCER, DEEP_WATER, 1);
    const before = advance(odds, LANCER, DEEP_WATER, CATALOG, 40);
    const kept = structuredClone(before);
    const after = advance(before, LANCER, DEEP_WATER, CATALOG, 40);
    expect(before).toEqual(kept);
    expect(after).not.toEqual(before);
    // The first step of it begins the first lost flight, from that flight's seed, against a tenth less.
    const begun = advance(odds, LANCER, DEEP_WATER, CATALOG, 1);
    const weaker: Fight = { ...LANCER, opts: { ...LANCER.opts, enemyScale: 0.9 } };
    expect(begun.state).toEqual(startFight(weaker, DEEP_WATER, 0, CATALOG, forecastSeed(odds.lost[0])));
  });

  test('a contract of two battles is flown again whole: a flight lost in the second is one that wins the first again', () => {
    const contract: Mission = {
      id: 't', title: 't', phase: 'faction', client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
      battles: [{ enemies: ['recon-drone'], background: 'bg' }, { enemies: ['leviathan', 'juggernaut', 'juggernaut'], background: 'bg' }],
    };
    const fight: Fight = { build: STARTER_BUILD, enemies: ENEMIES, opts: { enemyScale: 1 } };
    let count = newCount();
    let second = 0;
    for (let goes = 0; !neared(count) && goes < 400_000; goes++) {
      const next = advance(count, fight, contract, CATALOG, 1);
      if (counted(count) && next.index === 1 && count.index === 0) second += 1;
      count = next;
    }
    expect(count.tally).toEqual({ played: 20, won: 0 });
    expect(count.again).toEqual({ flown: 20, turned: 0 });
    // Every one of the twenty reached the second battle again before it was lost there.
    expect(second).toBe(20);
    expect(nearness(count)).toBe('outmatched');
  });
});
