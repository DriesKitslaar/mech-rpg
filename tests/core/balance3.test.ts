import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { cycleStrength, forCycle, type Mission } from '../../src/core/campaign';
import { playMission } from '../../src/core/mission';
import { tuneCap } from '../../src/core/tuning';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * The cycles after the first, played by the automatic player in the best frame the shop sells, with
 * every perk that counts in a fight. It uses no wingman and no Overdrive, so a pilot at the controls
 * has more than this. What is asked: that a pilot who has stopped growing is not met by enemies who
 * have not. Before the strength of a cycle had a ceiling, the same player won the last contract of
 * the fourth telling 35 times in a hundred without the bench and 88 with it, and of the fifth 3 and 72.
 */
const SEEDS = 40;
const DIFFICULTY = { standard: 1, veteran: 1.2 } as const;
/** What a pilot at the level cap can have bought: every rank of the perks a battle reads. */
const perks = Object.fromEntries(['aim', 'evasion', 'energy', 'cooling', 'repairs', 'armour'].map((effect) =>
  [effect, PERKS.reduce((sum, perk) => sum + (perk.perRank[effect as keyof typeof perk.perRank] ?? 0) * perk.maxRank, 0)]));
const build = REFERENCE_BUILDS.tier6;
const played = new Map<string, number>();

/**
 * How often a contract of the given cycle is won; with the bench, every part of the frame is as far along as that cycle
 * allows. `change` is for asking what if: the contract the cycle offers, made otherwise.
 */
function rate(id: string, cycle: number, difficulty: keyof typeof DIFFICULTY, bench: boolean, change?: { name: string; to: (offered: Mission, first: Mission) => Mission }): number {
  const key = `${id}|${cycle}|${difficulty}|${bench}|${change?.name ?? ''}`;
  const known = played.get(key);
  if (known !== undefined) return known;
  const first = MISSIONS.find((m) => m.id === id)!;
  const mission = change ? change.to(forCycle(first, cycle), first) : forCycle(first, cycle);
  const tune = bench ? Object.fromEntries(Object.values(build).map((part) => [part, tuneCap(cycle)])) : {};
  let wins = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    const end = playMission(build, mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { enemyScale: (mission.scale ?? 1) * DIFFICULTY[difficulty], mods: { ...perks, tune } });
    if (end.outcome === 'victory') wins++;
  }
  played.set(key, wins / SEEDS);
  return wins / SEEDS;
}
const VERDICTS = ['verdict-enforce', 'verdict-default', 'verdict-quorum'];

test('the perks counted here are the ones a pilot can buy', () => {
  expect(perks).toEqual({ aim: 12, evasion: 12, energy: 60, cooling: 15, repairs: 2, armour: 0.18 });
});

test('on Standard every verdict is won more often than not in every cycle, with the bench used as far as it goes', () => {
  for (const cycle of [2, 3, 6]) {
    for (const id of VERDICTS) expect(rate(id, cycle, 'standard', true), `${id} in cycle ${cycle}`).toBeGreaterThanOrEqual(0.6);
  }
});

test('on Standard no pilot is shut out for not using the bench: the verdicts of the peak are still won more often than not', () => {
  for (const id of VERDICTS) expect(rate(id, 2, 'standard', false), id).toBeGreaterThanOrEqual(0.6);
  // Past the peak nothing changes for them: the same contract, the same pilot.
  expect(cycleStrength(6)).toBe(cycleStrength(2));
});

test('the two contracts with something to protect are won four times in five at the peak, with the bench or without', () => {
  for (const id of ['lumen-5', 'audit-2']) {
    expect(MISSIONS.find((m) => m.id === id)!.battles.some((battle) => battle.objective?.type === 'protect'), id).toBe(true);
    for (const cycle of [2, 6]) {
      expect(rate(id, cycle, 'standard', true), `${id} in cycle ${cycle}`).toBeGreaterThanOrEqual(0.8);
      expect(rate(id, cycle, 'standard', false), `${id} in cycle ${cycle}, no bench`).toBeGreaterThanOrEqual(0.8);
    }
  }
});

test('that is because what is protected grows sturdier as the enemies grow tougher: left as in the first telling it is lost far more often', () => {
  // The contract as the third telling offers it, but for the thing to be kept alive: that as the first telling had it.
  const frail = { name: 'frail', to: (offered: Mission, first: Mission): Mission => ({ ...offered, battles: first.battles }) };
  for (const id of ['lumen-5', 'audit-2']) {
    expect(rate(id, 2, 'standard', true, frail), id).toBeLessThanOrEqual(rate(id, 2, 'standard', true) - 0.1);
  }
});

test('on Veteran the bench is what gets a pilot through: its last step turns the hardest contract from mostly lost to mostly won', () => {
  // The third telling is the peak, and the bench is one step short of its last.
  expect(rate('verdict-quorum', 2, 'veteran', true)).toBeLessThanOrEqual(0.6);
  expect(rate('verdict-quorum', 2, 'veteran', false)).toBeLessThanOrEqual(0.3);
  // From the fourth telling the last step is there, against the same enemies.
  expect(rate('verdict-quorum', 3, 'veteran', true)).toBeGreaterThanOrEqual(0.6);
  expect(rate('verdict-quorum', 3, 'veteran', true)).toBeGreaterThan(rate('verdict-quorum', 2, 'veteran', true));
  for (const id of ['verdict-enforce', 'verdict-default']) expect(rate(id, 6, 'veteran', true), id).toBeGreaterThanOrEqual(0.6);
});
