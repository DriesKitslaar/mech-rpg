import { ids, play } from '../helpers/balance';

/** The second act's wars and the third act: the contracts a pilot plays with a full Ronin or better. */

test.each(ids('path'))('war contract %s is a fight, not a wall, for a full Ronin, and it pays', (id) => {
  const { winRate, meanNet } = play(id, 'tier4');
  expect(winRate).toBeGreaterThanOrEqual(0.5);
  expect(winRate).toBeLessThanOrEqual(0.98);
  expect(meanNet).toBeGreaterThan(0);
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

test.each(ids('verdict'))('verdict %s can be won with what the story sells, is no gift, and is beyond mid-game gear', (id) => {
  const { winRate } = play(id, 'tier4');
  expect(winRate).toBeGreaterThanOrEqual(0.25);
  expect(winRate).toBeLessThanOrEqual(0.9);
  expect(play(id, 'tier2').winRate).toBeLessThanOrEqual(0.45);
});

test('the best gear there is wins both verdicts more often than not', () => {
  for (const id of ids('verdict')) expect(play(id, 'tier6').winRate, id).toBeGreaterThanOrEqual(0.6);
});
