import { ELITE_PAY, ELITE_TIER, PAY_PER_BATTLE, PAY_PER_POINT, ENEMY_COST, boardTier, contractTier, generateBoard } from '../../src/core/board';
import { BOARD_TEXT } from '../../src/content/board';

/** What the last review found unpinned about the board of open contracts. */

const board = (wins: number, cycle = 0) => generateBoard(wins, cycle, BOARD_TEXT);
const brief = (wins: number, cycle = 0) => board(wins, cycle).map((m) => ({
  title: m.title, client: m.client, reward: m.reward, elite: m.elite ?? null,
  battles: m.battles.map((b) => ({ enemies: b.enemies, background: b.background, ...(b.marks ? { marks: b.marks } : {}) })),
}));

describe('a board, as it has always been dealt', () => {
  test('after seven battles won: three contracts, by name, client, machines and pay', () => {
    expect(brief(7)).toEqual([
      { title: 'Burning Invoice', client: 'Night Market Guild', reward: 700, elite: null, battles: [{ enemies: ['gun-turret'], background: 'bg-plaza' }] },
      { title: 'Silent Invoice', client: 'District Council', reward: 700, elite: null, battles: [{ enemies: ['tank'], background: 'bg-undercity' }] },
      {
        title: 'Rusted Dividend', client: 'District Council', reward: 1900, elite: null,
        battles: [{ enemies: ['mortar-nest'], background: 'bg-undercity' }, { enemies: ['longshot'], background: 'bg-undercity' }],
      },
    ]);
  });

  test('after twenty: the heaviest has an elite, and the mark on a mortar nest is one that counts', () => {
    expect(brief(20)).toEqual([
      { title: 'Silent Curfew', client: 'Anonymous Client', reward: 1200, elite: null, battles: [{ enemies: ['light-mech', 'recon-drone'], background: 'bg-mine' }] },
      {
        title: 'Quiet Freight', client: 'District Council', reward: 2900, elite: null,
        battles: [{ enemies: ['carrier', 'recon-drone'], background: 'bg-mine' }, { enemies: ['longshot', 'gun-turret'], background: 'bg-mine' }],
      },
      {
        title: 'Silent Tithe', client: 'Varn Freight Union', reward: 2100, elite: 'overclocked',
        battles: [{ enemies: ['mortar-nest', 'mortar-nest'], background: 'bg-undercity', marks: { 0: 'overclocked' } }],
      },
    ]);
  });
});

describe('an elite on the board', () => {
  test('pays four hundred on top of what its machines and battles pay', () => {
    expect(ELITE_PAY).toBe(400);
    const elite = board(20)[2];
    const points = elite.battles.flatMap((b) => b.enemies).reduce((sum, id) => sum + ENEMY_COST[id], 0);
    expect(elite.reward).toBe(PAY_PER_POINT * points + PAY_PER_BATTLE * elite.battles.length + 400);
  });

  test('is met from the third tier on: at the third itself, and never at the second', () => {
    expect(ELITE_TIER).toBe(3);
    const at = (tier: number): { boards: number; elites: number } => {
      let boards = 0;
      let elites = 0;
      for (let cycle = 0; cycle < 2; cycle++) {
        for (let wins = 0; wins < 60; wins++) {
          if (boardTier(wins, cycle) !== tier) continue;
          expect(contractTier(wins, cycle, 2)).toBe(tier);
          boards += 1;
          if (board(wins, cycle)[2].elite) elites += 1;
        }
      }
      return { boards, elites };
    };
    expect(at(2)).toEqual({ boards: 10, elites: 0 });
    expect(at(3)).toEqual({ boards: 10, elites: 6 });
    expect(at(4).elites).toBeGreaterThan(0);
  });
});
