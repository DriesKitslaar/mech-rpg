import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import type { BattleState } from '../../src/core/battle';
import { forCycle, otherOffer, type Mission } from '../../src/core/campaign';
import { newGame } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * The three contracts the other side makes an offer for, from the second telling on, played by the
 * automatic player: no wingman, no Overdrive, no bench. A pilot who is offered them has been through
 * the story once, so the frames here are a mid-career one and one of the first act's, with every
 * perk that counts in a fight; "bare" is the same frame without the perks, which is how the fights
 * were weighed against the first offers. Measured over a hundred seeds when they were written: with
 * perks on Standard every one was won at least 85 times in a hundred, on Veteran at least 68; bare,
 * the two that pay less were won 28 to 92 times where the first offer was won 73 to 100. The thirty
 * seeds here give 83 and 60 for the first two, so the lines drawn below have a few seeds of room.
 */
const SEEDS = 30;
const DIFFICULTY = { standard: 1, veteran: 1.2 } as const;
const perks = Object.fromEntries(['aim', 'evasion', 'energy', 'cooling', 'repairs', 'armour'].map((effect) =>
  [effect, PERKS.reduce((sum, perk) => sum + (perk.perRank[effect as keyof typeof perk.perRank] ?? 0) * perk.maxRank, 0)]));
type Frame = 'tier2' | 'tier5';
const OFFERED = ['hadron-1', 'hadron-2', 'undertow-1'];
const played = new Map<string, BattleState[]>();

/** The contract in the given cycle, as it was first offered or as the other side offers it. */
function contract(id: string, cycle: number, other: boolean): Mission {
  const first = forCycle(MISSIONS.find((m) => m.id === id)!, cycle);
  return other ? otherOffer({ ...newGame(CATALOG, STARTER_BUILD), cycle }, first, MISSIONS)! : first;
}

/** The last battle of every seed's flight of a contract. */
function flights(id: string, cycle: number, other: boolean, frame: Frame, difficulty: keyof typeof DIFFICULTY, grown: boolean): BattleState[] {
  const key = [id, cycle, other, frame, difficulty, grown].join('|');
  const known = played.get(key);
  if (known) return known;
  const mission = contract(id, cycle, other);
  const ends: BattleState[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    ends.push(playMission(REFERENCE_BUILDS[frame], mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { enemyScale: (mission.scale ?? 1) * DIFFICULTY[difficulty], mods: grown ? perks : {} }));
  }
  played.set(key, ends);
  return ends;
}
const rate = (...args: Parameters<typeof flights>): number => flights(...args).filter((end) => end.outcome === 'victory').length / SEEDS;

test('the three contracts have an offer from the other side, and no others do', () => {
  expect(MISSIONS.filter((m) => m.other).map((m) => m.id)).toEqual(OFFERED);
});

test('on Standard a pilot who has been through the story once wins each of them three times in four, in the second telling and at the peak', () => {
  for (const id of OFFERED) {
    for (const cycle of [1, 2]) {
      for (const frame of ['tier2', 'tier5'] as const) expect(rate(id, cycle, true, frame, 'standard', true), `${id} in cycle ${cycle}, ${frame}`).toBeGreaterThanOrEqual(0.75);
    }
  }
});

test('on Veteran at the peak they are still won as often as not', () => {
  for (const id of OFFERED) {
    for (const frame of ['tier2', 'tier5'] as const) expect(rate(id, 2, true, frame, 'veteran', true), `${id}, ${frame}`).toBeGreaterThanOrEqual(0.5);
  }
});

test('the two that pay less are no gift: bare, they are lost more often than what was first offered', () => {
  for (const id of ['hadron-1', 'hadron-2']) {
    for (const cycle of [1, 2]) {
      expect(rate(id, cycle, true, 'tier5', 'standard', false), `${id} in cycle ${cycle}`).toBeLessThan(rate(id, cycle, false, 'tier5', 'standard', false));
    }
    // And they are fights, not walls: bare, at the peak, a first-act frame still wins one in five.
    expect(rate(id, 2, true, 'tier2', 'standard', false), id).toBeGreaterThanOrEqual(0.2);
  }
});

test('the one that pays three times as much is no harder than what was first offered: what it costs is not in the fight', () => {
  for (const cycle of [1, 2]) {
    expect(rate('undertow-1', cycle, true, 'tier2', 'standard', false), `cycle ${cycle}`).toBeGreaterThanOrEqual(rate('undertow-1', cycle, false, 'tier2', 'standard', false));
  }
});

test('the weighbridge is held and not cleared: every win there is the fifth round ending with its guard still standing', () => {
  const won = flights('hadron-2', 1, true, 'tier5', 'standard', true).filter((end) => end.outcome === 'victory');
  expect(won.length).toBeGreaterThan(0);
  for (const end of won) {
    expect(end.round).toBe(5);
    expect(end.units.some((unit) => unit.side === 'enemy' && !unit.destroyed)).toBe(true);
  }
  // The guard is two and a half times what the yard admits to in the second telling, and three times at the peak.
  expect(contract('hadron-2', 1, true).scale).toBe(2.5);
  expect(contract('hadron-2', 2, true).scale).toBe(3);
  expect(contract('hadron-2', 5, true).scale).toBe(3);
});
