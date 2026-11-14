import { newGame, type GameState } from '../../src/core/game';
import { NO_STATS } from '../../src/core/stats';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { RECORD_ROWS, playTime, rankTally, recordLines } from '../../src/ui/record';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const value = (game: GameState, label: string): string => recordLines(game, 42).find((line) => line.label === label)!.value;

test('time played reads as hours and minutes', () => {
  expect([0, 59, 60, 3599, 3600 + 125, 36000].map(playTime)).toEqual(['0:00', '0:00', '0:01', '0:59', '1:02', '10:00']);
});

test('the record has two columns of lines, each with a label that fits its column', () => {
  const lines = recordLines(fresh(), 42);
  expect(lines).toHaveLength(RECORD_ROWS * 2);
  expect(new Set(lines.map((line) => line.label)).size).toBe(lines.length);
  for (const line of lines) expect(line.label.length + line.value.length, line.label).toBeLessThanOrEqual(27);
});

test('a pilot who has done nothing has a record of noughts, and no accuracy to speak of', () => {
  const g = fresh();
  expect(value(g, 'CONTRACTS WON')).toBe('0');
  expect(value(g, 'ACCURACY')).toBe('-');
  expect(value(g, 'ARENA RANK')).toBe('-');
  expect(value(g, 'MEDALS')).toBe('0/42');
  expect(value(g, 'CYCLE')).toBe('1');
  expect(value(g, 'TIME PLAYED')).toBe('0:00');
});

test('the record shows what was counted', () => {
  const g: GameState = {
    ...fresh(), arenaRank: 4, cycle: 2, medals: ['a', 'b', 'c'], ranks: { x: 'S', y: 'S', z: 'B' },
    stats: {
      ...NO_STATS, contracts: 31, lost: 4, retreats: 2, flawless: 5, shots: 800, hits: 612, damage: 40210, taken: 9120, kills: 77,
      parts: 90, staggers: 21, overheats: 3, bombs: 6, bosses: 2, rounds: 410, earned: 123456, seconds: 7 * 3600 + 5 * 60,
    },
  };
  const read = Object.fromEntries(recordLines(g, 42).map((line) => [line.label, line.value]));
  expect(read).toMatchObject({
    'CONTRACTS WON': '31', 'CONTRACTS LOST': '4', 'WALKED AWAY': '2', 'WITHOUT A SCRATCH': '5', 'ENEMIES DESTROYED': '77',
    'PARTS SHOT OFF': '90', 'STAGGERS': '21', 'BOMBS DEFUSED': '6', 'BOSSES BEATEN': '2', 'S RANKS': '2', 'ARENA RANK': '4',
    'SHOTS FIRED': '800', 'SHOTS LANDED': '612', 'ACCURACY': '77%', 'ARMOUR SHOT OFF': '40210', 'ARMOUR LOST': '9120',
    'TURNS LOST TO HEAT': '3', 'ROUNDS FOUGHT': '410', 'CREDITS EARNED': '123456', 'MEDALS': '3/42', 'CYCLE': '3', 'TIME PLAYED': '7:05',
  });
});

test('the ranks held are counted per rank, best first', () => {
  expect(rankTally({ ...fresh(), ranks: { a: 'S', b: 'B', c: 'S', d: 'D' } })).toEqual([['S', 2], ['A', 0], ['B', 1], ['C', 0], ['D', 1]]);
});
