import { validatePlayerBuild } from '../../src/core/build';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_UNLOCKS } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { ids, play } from '../helpers/balance';

/** The first act and the choice: the contracts a pilot plays on the way from the starter frame to mid-game gear. */
const first = ids('faction').filter((id) => id.endsWith('-1'));
const second = ids('faction').filter((id) => id.endsWith('-2'));

test('every reference build is a valid build', () => {
  for (const [name, build] of Object.entries(REFERENCE_BUILDS)) expect(validatePlayerBuild(build, CATALOG), name).toEqual([]);
});

test('each reference build only uses parts in stock at its stage', () => {
  const needs = (build: string) => new Set(Object.values(REFERENCE_BUILDS[build]).map((id) => SHOP_UNLOCKS[id]).filter(Boolean));
  expect([...needs('starter')]).toEqual([]);
  expect([...needs('tier1')]).toEqual([]);
  expect([...needs('tier2')].every((c) => c.endsWith('-1'))).toBe(true);
  expect([...needs('tier3')].every((c) => c.endsWith('-1') || c === 'choice')).toBe(true);
  // The story can be finished with what the story itself puts on the shelf: no arena prize is needed for tier 4.
  expect([...needs('tier4')].every((c) => c.endsWith('-1') || c === 'choice')).toBe(true);
});

test('the patrol is safe money for a starting pilot', () => {
  const { winRate, meanNet } = play('patrol', 'starter');
  expect(winRate).toBeGreaterThanOrEqual(0.98);
  expect(meanNet).toBeGreaterThan(100);
});

test.each(ids('intro'))('introduction %s is nearly always won with the starter build', (id) => {
  expect(play(id, 'starter').winRate).toBeGreaterThanOrEqual(0.95);
});

test.each(first)('a client\'s first contract %s is winnable with two more weapons, and pays', (id) => {
  const { winRate, meanNet } = play(id, 'tier1');
  expect(winRate).toBeGreaterThanOrEqual(0.8);
  expect(meanNet).toBeGreaterThan(0);
});

test.each(second)('a client\'s second contract %s can be won with the same gear, pays, and is comfortable with mid-game gear', (id) => {
  const { winRate, meanNet } = play(id, 'tier1');
  expect(winRate).toBeGreaterThanOrEqual(0.55);
  expect(meanNet).toBeGreaterThan(0);
  expect(play(id, 'tier2').winRate).toBeGreaterThanOrEqual(0.7);
});

test.each(ids('rival'))('the first meeting with the rival %s is won with mid-game gear and is a real fight for the starter frame', (id) => {
  expect(play(id, 'tier2').winRate).toBeGreaterThanOrEqual(0.75);
  expect(play(id, 'starter').winRate).toBeLessThanOrEqual(0.75);
});

test.each(ids('choice'))('exclusive contract %s is winnable with mid-game gear', (id) => {
  expect(play(id, 'tier2').winRate).toBeGreaterThanOrEqual(0.6);
});

test.each(ids('finale'))('finale %s is hard but winnable with the gear of the choice, and comfortable with a full Ronin', (id) => {
  const { winRate } = play(id, 'tier3');
  expect(winRate).toBeGreaterThanOrEqual(0.35);
  expect(winRate).toBeLessThanOrEqual(0.95);
  expect(play(id, 'tier4').winRate).toBeGreaterThanOrEqual(0.6);
});

test.each(ids('finale'))('finale %s is not a walkover for early gear', (id) => {
  expect(play(id, 'tier1').winRate).toBeLessThanOrEqual(0.6);
});

test.each(ids('finale'))('late-game gear is not a step back from mid-game gear in finale %s', (id) => {
  expect(play(id, 'tier3').winRate).toBeGreaterThanOrEqual(play(id, 'tier2').winRate - 0.1);
});

const early = MISSIONS.filter((m) => ['intro', 'faction', 'rival', 'choice'].includes(m.phase)).map((m) => m.id);
test.each(early)('winning %s with heavy gear does not usually lose money', (id) => {
  expect(play(id, 'tier3').meanNet).toBeGreaterThan(-200);
});
