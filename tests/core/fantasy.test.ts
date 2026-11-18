import { chooseAutoPlayerAction, chooseEnemyAction } from '../../src/core/ai';
import { activeUnit, applyAction, type BattleState } from '../../src/core/battle';
import { forCycle } from '../../src/core/campaign';
import { startMissionBattle } from '../../src/core/mission';
import { tuneCap } from '../../src/core/tuning';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * What a battle is like for a pilot who has outgrown the field: the automatic player in the best
 * frame the shop sells, with every perk a battle reads and the bench as far as the cycle allows,
 * over the patrol and every contract of the story, twelve seeds each. It uses no wingman and no
 * Overdrive.
 *
 * Before Momentum and Shatter the same pilot, at the end of a first telling, took 4.1 rounds over
 * an open battle, destroyed two machines in 2.6 of a hundred turns and never three, and fired 3.1
 * volleys for each machine destroyed; the patrol's two drones took 2.7 rounds. At the peak: 5.5
 * rounds, 1.2 turns in a hundred, 4.1 volleys. The fights that are not open (a boss, a named
 * pilot, an elite, a Bailiff, an objective's target, one machine) are counted apart: they are what
 * they were.
 */
const SEEDS = 12;
const perks = Object.fromEntries(['aim', 'evasion', 'energy', 'cooling', 'repairs', 'armour'].map((effect) =>
  [effect, PERKS.reduce((sum, perk) => sum + (perk.perRank[effect as keyof typeof perk.perRank] ?? 0) * perk.maxRank, 0)]));
const build = REFERENCE_BUILDS.tier6;
const STORY = MISSIONS.filter((m) => ['patrol', 'intro', 'faction', 'rival', 'choice', 'path', 'finale', 'audit', 'verdict'].includes(m.phase));

interface Tally { battles: number; rounds: number; kills: number; turns: number; withKill: number; withTwo: number; withThree: number; best: number; volleys: number }
const blank = (): Tally => ({ battles: 0, rounds: 0, kills: 0, turns: 0, withKill: 0, withTwo: 0, withThree: 0, best: 0, volleys: 0 });
const measured = new Map<number, Record<'open' | 'other' | 'patrol', Tally>>();

/** Every battle of the story as the given cycle offers it, played out; what happened in the pilot's turns, by kind of battle. */
function measure(cycle: number): Record<'open' | 'other' | 'patrol', Tally> {
  const known = measured.get(cycle);
  if (known) return known;
  const sums = { open: blank(), other: blank(), patrol: blank() };
  const tune = Object.fromEntries(Object.values(build).map((part) => [part, tuneCap(cycle)]));
  for (const first of STORY) {
    const mission = forCycle(first, cycle);
    for (let seed = 1; seed <= SEEDS; seed++) {
      let state: BattleState | undefined;
      for (let i = 0; i < mission.battles.length && (!state || state.outcome === 'victory'); i++) {
        state = startMissionBattle(build, mission, i, ENEMIES, CATALOG, seed * 7919, state, { enemyScale: mission.scale ?? 1, mods: { ...perks, tune } });
        const into = [state.open ? sums.open : sums.other, ...(first.phase === 'patrol' ? [sums.patrol] : [])];
        for (const t of into) t.battles++;
        let seen = state.events.length;
        let inTurn = 0;
        let mine = false;
        const close = (): void => {
          if (mine) for (const t of into) { t.turns++; if (inTurn > 0) t.withKill++; if (inTurn > 1) t.withTwo++; if (inTurn > 2) t.withThree++; t.best = Math.max(t.best, inTurn); }
          inTurn = 0;
        };
        while (state.outcome === 'ongoing') {
          const player = activeUnit(state).side === 'player';
          if (player !== mine) { close(); mine = player; }
          state = applyAction(state, (player ? chooseAutoPlayerAction : chooseEnemyAction)(state, CATALOG), CATALOG);
          const fresh = state.events.slice(seen);
          seen = state.events.length;
          if (!player) continue;
          for (const event of fresh) {
            if (event.type === 'shot' && event.unit === 'player') for (const t of into) t.volleys++;
            if (event.type === 'unitDestroyed' && event.unit !== 'player') { for (const t of into) t.kills++; inTurn++; }
          }
        }
        close();
        for (const t of into) t.rounds += state.round;
      }
    }
  }
  measured.set(cycle, sums);
  return sums;
}
const rounds = (t: Tally): number => t.rounds / t.battles;
const share = (n: number, t: Tally): number => n / t.turns;
const volleysPerKill = (t: Tally): number => t.volleys / t.kills;

test('the perks counted here are the ones a pilot can buy, and the story is the patrol and thirty contracts', () => {
  expect(perks).toEqual({ aim: 12, evasion: 12, energy: 60, cooling: 15, repairs: 2, armour: 0.18 });
  expect(STORY).toHaveLength(31);
});

describe('at the end of a first telling', () => {
  test('an open battle is over a round sooner, and a turn in eight destroys two machines or more', () => {
    const { open } = measure(0);
    expect(open.battles).toBeGreaterThan(400);
    expect(rounds(open)).toBeLessThanOrEqual(3.4);
    expect(share(open.withKill, open)).toBeGreaterThanOrEqual(0.55);
    expect(share(open.withTwo, open)).toBeGreaterThanOrEqual(0.1);
    // Three in a turn clears a field: it never happened before, and now it does.
    expect(open.best).toBe(3);
    expect(open.withThree).toBeGreaterThanOrEqual(10);
    expect(volleysPerKill(open)).toBeLessThanOrEqual(2.9);
  });

  test('the patrol is two rounds\' work, and one turn in three takes both drones', () => {
    const { patrol } = measure(0);
    expect(patrol.battles).toBe(SEEDS);
    expect(rounds(patrol)).toBeLessThanOrEqual(2.2);
    expect(share(patrol.withTwo, patrol)).toBeGreaterThanOrEqual(0.3);
  });

  test('a fight that is not open takes what it took: no more kills in a turn, no fewer volleys for each', () => {
    const { other } = measure(0);
    expect(other.battles).toBeGreaterThan(300);
    // It was 4.15 rounds, 1.0 turns in a hundred with two kills and 5.2 volleys for each machine.
    expect(rounds(other)).toBeGreaterThanOrEqual(3.9);
    expect(share(other.withTwo, other)).toBeLessThanOrEqual(0.015);
    expect(other.best).toBeLessThanOrEqual(2);
    expect(volleysPerKill(other)).toBeGreaterThanOrEqual(5);
  });
});

describe('at the peak, against enemies half again as tough', () => {
  test('an open battle is most of a round shorter, and two machines in a turn is four times as common as it was', () => {
    const { open } = measure(2);
    expect(rounds(open)).toBeLessThanOrEqual(5);
    expect(share(open.withTwo, open)).toBeGreaterThanOrEqual(0.04);
    expect(volleysPerKill(open)).toBeLessThanOrEqual(3.9);
  });

  test('a fight that is not open is as long as it was', () => {
    const { other } = measure(2);
    // It was 6.5 rounds and 7.0 volleys for each machine destroyed.
    expect(rounds(other)).toBeGreaterThanOrEqual(6.3);
    expect(volleysPerKill(other)).toBeGreaterThanOrEqual(6.8);
    expect(share(other.withTwo, other)).toBeLessThanOrEqual(0.005);
  });
});
