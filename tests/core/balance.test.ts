import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { settle } from '../../src/core/economy';
import { playMission } from '../../src/core/mission';
import { validatePlayerBuild } from '../../src/core/build';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_UNLOCKS } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

const SEEDS = 120;
/** Win rate and mean net pay of a contract played by the automatic player with a reference build. */
function play(missionId: string, buildName: string): { winRate: number; meanNet: number } {
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  let wins = 0;
  let net = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    // Two unrelated seed families, alternated, so a threshold is not met by one lucky sequence.
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    const end = playMission(REFERENCE_BUILDS[buildName], mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') wins++;
    net += settle(end, mission.reward, CATALOG).net;
  }
  return { winRate: wins / SEEDS, meanNet: net / SEEDS };
}
const ids = (phase: string) => MISSIONS.filter((m) => m.phase === phase).map((m) => m.id);

test('every reference build is a valid build', () => {
  for (const [name, build] of Object.entries(REFERENCE_BUILDS)) expect(validatePlayerBuild(build, CATALOG), name).toEqual([]);
});

test('each reference build only uses parts in stock at its stage', () => {
  const needs = (build: string) => new Set(Object.values(REFERENCE_BUILDS[build]).map((id) => SHOP_UNLOCKS[id]).filter(Boolean));
  expect([...needs('starter')]).toEqual([]);
  expect([...needs('tier1')]).toEqual([]);
  expect([...needs('tier2')].every((c) => c.endsWith('-1'))).toBe(true);
  expect([...needs('tier3')].every((c) => c.endsWith('-1') || c === 'choice')).toBe(true);
});

test('the patrol is safe money for a starting pilot', () => {
  const { winRate, meanNet } = play('patrol', 'starter');
  expect(winRate).toBeGreaterThanOrEqual(0.98);
  expect(meanNet).toBeGreaterThan(100);
});

test.each(ids('intro'))('introduction %s is nearly always won with the starter build', (id) => {
  expect(play(id, 'starter').winRate).toBeGreaterThanOrEqual(0.95);
});

test.each(ids('faction'))('client contract %s is winnable with two more weapons, and pays', (id) => {
  const { winRate, meanNet } = play(id, 'tier1');
  expect(winRate).toBeGreaterThanOrEqual(0.8);
  expect(meanNet).toBeGreaterThan(0);
});

test.each(ids('choice'))('exclusive contract %s is winnable with mid-game gear', (id) => {
  expect(play(id, 'tier2').winRate).toBeGreaterThanOrEqual(0.6);
});

test.each(ids('finale'))('finale %s is hard but winnable with late-game gear', (id) => {
  const { winRate } = play(id, 'tier3');
  expect(winRate).toBeGreaterThanOrEqual(0.45);
  expect(winRate).toBeLessThanOrEqual(0.95);
});

test.each(ids('finale'))('finale %s is not a walkover for early gear', (id) => {
  expect(play(id, 'tier1').winRate).toBeLessThanOrEqual(0.6);
});

test.each(ids('finale'))('late-game gear is not a step back from mid-game gear in finale %s', (id) => {
  expect(play(id, 'tier3').winRate).toBeGreaterThanOrEqual(play(id, 'tier2').winRate - 0.1);
});

test.each(MISSIONS.filter((m) => m.phase !== 'patrol').map((m) => m.id))('winning %s with heavy gear does not usually lose money', (id) => {
  expect(play(id, 'tier3').meanNet).toBeGreaterThan(-200);
});
