import { MARKS } from '../../src/core/battle';
import { startMissionBattle } from '../../src/core/mission';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { BRIEFING_CHARS, briefingRows } from '../../src/ui/briefingScreen';
import { wrap } from '../../src/ui/widgets';
import {
  ELITE_PAY, ELITE_TIER, ENEMY_COST, MECH_ENEMIES, PAY_PER_BATTLE, PAY_PER_POINT, boardTier, budgetFor, contractTier, generateBoard as generate, scaleFor,
} from '../../src/core/board';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import SPRITES from '../../src/content/sprites.json';

const generateBoard = (wins: number, cycle: number) => generate(wins, cycle, BOARD_TEXT);
const cost = (ids: string[]) => ids.reduce((sum, id) => sum + ENEMY_COST[id], 0);

test('the board is the same every time for the same progress, and changes with it', () => {
  expect(generateBoard(7, 0)).toEqual(generateBoard(7, 0));
  expect(generateBoard(7, 0)).not.toEqual(generateBoard(8, 0));
  expect(generateBoard(7, 0)).not.toEqual(generateBoard(7, 1));
});

test('the tier follows wins and cycles, up to eight', () => {
  expect([0, 4, 5, 19].map((w) => boardTier(w, 0))).toEqual([0, 0, 1, 3]);
  expect(boardTier(5, 2)).toBe(5);
  expect(boardTier(300, 5)).toBe(8);
});

test('the three contracts climb from two tiers below the board to the board tier', () => {
  expect([0, 1, 2].map((i) => contractTier(30, 0, i))).toEqual([4, 5, 6]);
  expect([0, 1, 2].map((i) => contractTier(5, 0, i))).toEqual([0, 0, 1]);
  expect([budgetFor(0), budgetFor(4), budgetFor(8)]).toEqual([2, 6, 8]);
  expect([scaleFor(3), scaleFor(4), scaleFor(8)]).toEqual([1, 1, 1.16]);
});

test('every enemy that exists has a cost, and only existing enemies do', () => {
  expect(Object.keys(ENEMY_COST).sort()).toEqual(Object.keys(ENEMIES).sort());
  for (const id of MECH_ENEMIES) expect(ENEMIES[id].composed).toBe(true);
});

test.each([[0, 0], [4, 0], [12, 0], [30, 0], [9, 1], [40, 3], [500, 9]])('a board after %i wins in cycle %i is well formed', (wins, cycle) => {
  const board = generateBoard(wins, cycle);
  expect(board).toHaveLength(3);
  expect(new Set(board.map((m) => m.id)).size).toBe(3);
  for (const [index, mission] of board.entries()) {
    const tier = contractTier(wins, cycle, index);
    const budget = budgetFor(tier);
    expect(mission.phase).toBe('patrol');
    expect(mission.title.length).toBeGreaterThan(0);
    expect(mission.briefing.length).toBeGreaterThan(0);
    expect(mission.battles.length).toBeGreaterThanOrEqual(1);
    expect(mission.battles.length).toBeLessThanOrEqual(3);
    for (const battle of mission.battles) {
      expect(battle.enemies.length).toBeGreaterThanOrEqual(1);
      expect(battle.enemies.length).toBeLessThanOrEqual(3);
      expect(cost(battle.enemies)).toBeLessThanOrEqual(budget);
      expect(battle.enemies.filter((id) => MECH_ENEMIES.includes(id)).length).toBeLessThanOrEqual(1);
      for (const id of battle.enemies) expect(ENEMIES[id], id).toBeDefined();
      expect(battle.background in SPRITES).toBe(true);
    }
    const spent = mission.battles.reduce((sum, b) => sum + cost(b.enemies), 0);
    // An elite in the contract is paid for on top.
    expect(mission.reward).toBe(PAY_PER_POINT * spent + PAY_PER_BATTLE * mission.battles.length + (mission.elite ? ELITE_PAY : 0));
    expect(mission.scale).toBeCloseTo(scaleFor(tier));
    if (mission.portrait) expect(mission.portrait in SPRITES).toBe(true);
  }
});

test('a low tier never fields a mech, a high tier usually does', () => {
  const mechs = (wins: number) => {
    let n = 0;
    for (let w = wins; w < wins + 30; w++) for (const m of generateBoard(w, 0)) for (const b of m.battles) n += b.enemies.filter((id) => MECH_ENEMIES.includes(id)).length;
    return n;
  };
  for (let w = 0; w < 5; w++) for (const m of generateBoard(w, 0)) for (const b of m.battles) expect(b.enemies.some((id) => MECH_ENEMIES.includes(id))).toBe(false);
  expect(mechs(40)).toBeGreaterThan(20);
});

test('boards offer variety', () => {
  const titles = new Set<string>();
  for (let w = 0; w < 40; w++) for (const m of generateBoard(w, 0)) titles.add(m.title);
  expect(titles.size).toBeGreaterThan(40);
});

describe('an elite on the board', () => {
  const boards = (cycle = 0) => Array.from({ length: 120 }, (_, wins) => ({ wins, board: generateBoard(wins, cycle) }));

  test('only the heaviest contract can be one, and only once the board has reached tier three', () => {
    expect(ELITE_TIER).toBe(3);
    for (const { wins, board } of boards()) {
      expect(board[0].elite).toBeUndefined();
      expect(board[1].elite).toBeUndefined();
      if (boardTier(wins, 0) < ELITE_TIER) expect(board[2].elite, `after ${wins} wins`).toBeUndefined();
    }
  });

  test('about one board in two has one, and every mark turns up', () => {
    const late = boards().filter(({ wins }) => boardTier(wins, 0) >= ELITE_TIER);
    const elite = late.filter(({ board }) => board[2].elite);
    expect(elite.length / late.length).toBeGreaterThan(0.35);
    expect(elite.length / late.length).toBeLessThan(0.65);
    expect([...new Set(elite.map(({ board }) => board[2].elite))].sort()).toEqual([...MARKS].sort());
  });

  test('the mark is on the dearest machine of the last battle, the briefing says what it is, and the pay allows for it', () => {
    let seen = 0;
    for (const { board } of [...boards(), ...boards(2)]) {
      const mission = board[2];
      const marked = mission.battles.flatMap((b, i) => Object.entries(b.marks ?? {}).map(([at, mark]) => ({ battle: i, at: Number(at), mark })));
      if (!mission.elite) {
        expect(marked).toEqual([]);
        expect(mission.briefing).toHaveLength(3);
        continue;
      }
      seen += 1;
      const last = mission.battles.length - 1;
      expect(marked).toHaveLength(1);
      expect(marked[0]).toMatchObject({ battle: last, mark: mission.elite });
      const costs = mission.battles[last].enemies.map((id) => ENEMY_COST[id]);
      expect(costs[marked[0].at]).toBe(Math.max(...costs));
      expect(costs.indexOf(Math.max(...costs))).toBe(marked[0].at);
      expect(mission.briefing).toHaveLength(4);
      expect(mission.briefing[3]).toBe(BOARD_TEXT.elite[mission.elite]);
      const spent = mission.battles.reduce((sum, b) => sum + cost(b.enemies), 0);
      expect(mission.reward).toBe(PAY_PER_POINT * spent + PAY_PER_BATTLE * mission.battles.length + ELITE_PAY);
    }
    expect(seen).toBeGreaterThan(40);
  });

  test('the battle fields the elite with its mark, and nobody else marked', () => {
    const { board } = boards().find(({ board: b }) => b[2].elite)!;
    const mission = board[2];
    const last = mission.battles.length - 1;
    const state = startMissionBattle(DEMO_BUILD, mission, last, ENEMIES, CATALOG, 3);
    const at = Number(Object.keys(mission.battles[last].marks!)[0]);
    expect(state.units.filter((u) => u.mark).map((u) => [u.id, u.mark])).toEqual([[`enemy-${at}`, mission.elite]]);
    for (let i = 0; i < last; i++) expect(startMissionBattle(DEMO_BUILD, mission, i, ENEMIES, CATALOG, 3).units.some((u) => u.mark)).toBe(false);
  });

  test('every briefing still fits its panel, the elite ones too', () => {
    for (const { board } of [...boards(), ...boards(1), ...boards(3)]) {
      for (const mission of board) {
        let y = 0;
        for (const paragraph of mission.briefing) {
          for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
            expect(y, `briefing of ${mission.id} is too long`).toBeLessThanOrEqual((briefingRows(mission) - 1) * 11);
            y += 11;
          }
          y += 4;
        }
      }
    }
  });
});
