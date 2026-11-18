import type { FramePart } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { ids, play } from '../helpers/balance';

/** The second act's wars and the third act: the contracts a pilot plays with a full Ronin or better. */

/**
 * The war contract a full Ronin outguns. Both of its battles are open and fought against light
 * machines that come for something to protect; a rail lance goes through a bomb crawler in one
 * hit and is ready for the next, so what used to be a race (won 92 times in a hundred) is one the
 * Ronin wins. It is still a fight for the frame before it.
 */
const OUTGUNNED = 'lumen-5';

test.each(ids('path'))('war contract %s is a fight, not a wall, for a full Ronin, and it pays', (id) => {
  const { winRate, meanNet } = play(id, 'tier4');
  expect(winRate).toBeGreaterThanOrEqual(0.5);
  if (id !== OUTGUNNED) expect(winRate).toBeLessThanOrEqual(0.98);
  expect(meanNet).toBeGreaterThan(0);
});

test('the war contract a full Ronin outguns is made of light machines only, and is a fight for the frame before it', () => {
  const mission = MISSIONS.find((m) => m.id === OUTGUNNED)!;
  expect(mission.phase).toBe('path');
  // Nobody in it leads, and nothing in it is heavier than a tank: every battle of it is open.
  const cores = mission.battles.flatMap((battle) => battle.enemies.map((id) => (CATALOG[ENEMIES[id].build.core!] as FramePart).ap));
  expect(Math.max(...cores)).toBeLessThanOrEqual(200);
  expect(mission.battles.every((battle) => battle.objective?.type === 'protect')).toBe(true);
  expect(mission.battles.flatMap((battle) => battle.enemies).some((id) => ENEMIES[id].leader || ENEMIES[id].portrait || ENEMIES[id].phases)).toBe(false);
  expect(play(OUTGUNNED, 'tier4').winRate).toBeGreaterThan(0.98);
  const before = play(OUTGUNNED, 'tier3').winRate;
  expect(before).toBeGreaterThanOrEqual(0.5);
  expect(before).toBeLessThanOrEqual(0.9);
});

test.each(ids('path'))('war contract %s is not for the gear a pilot leaves the introductions with', (id) => {
  expect(play(id, 'tier1').winRate).toBeLessThanOrEqual(0.45);
});

test.each(ids('finale'))('finale %s pays a full Ronin', (id) => {
  expect(play(id, 'tier4').meanNet).toBeGreaterThan(0);
});

test.each(ids('audit'))('audit contract %s is winnable with a full Ronin, pays it, and is out of reach of early gear', (id) => {
  const { winRate, meanNet } = play(id, 'tier4');
  expect(winRate).toBeGreaterThanOrEqual(0.45);
  expect(meanNet).toBeGreaterThan(0);
  expect(play(id, 'tier1').winRate).toBeLessThanOrEqual(0.3);
});

/** The two verdicts every telling of the story offers. The third is only offered in a later one: see below. */
const offeredToAll = ids('verdict').filter((id) => MISSIONS.find((m) => m.id === id)!.when === undefined);

test.each(offeredToAll)('verdict %s can be won with what the story sells, is no gift, and is beyond mid-game gear', (id) => {
  const { winRate } = play(id, 'tier4');
  expect(winRate).toBeGreaterThanOrEqual(0.25);
  expect(winRate).toBeLessThanOrEqual(0.9);
  expect(play(id, 'tier2').winRate).toBeLessThanOrEqual(0.45);
});

test('the best gear there is wins every verdict more often than not', () => {
  expect(ids('verdict')).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
  for (const id of ids('verdict')) expect(play(id, 'tier6').winRate, id).toBeGreaterThanOrEqual(0.6);
});

// What these play is the contract as it is written, with no perks: gear against gear. The third verdict
// is only ever offered from the second telling on, where a contract is a quarter tougher on Standard
// (and as written on Story), and where a pilot has a telling's worth of perks. That a whole career
// reaches it and wins it, on every difficulty, is what tests/scripts/career.test.ts plays.
test('the third verdict is the hardest contract of the story: it is not for the gear the story sells, and no verdict is tougher', () => {
  expect(offeredToAll).toEqual(['verdict-enforce', 'verdict-default']);
  // A full Ronin, which wins the other two about as often as not, does not win this one.
  expect(play('verdict-quorum', 'tier4').winRate).toBeLessThanOrEqual(0.15);
  for (const id of offeredToAll) expect(play('verdict-quorum', 'tier4').winRate, id).toBeLessThan(play(id, 'tier4').winRate);
  const scale = (id: string): number => MISSIONS.find((m) => m.id === id)!.scale ?? 1;
  for (const id of offeredToAll) expect(scale('verdict-quorum'), id).toBeGreaterThan(scale(id));
});
