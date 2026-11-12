import { ENEMY_COST, MECH_ENEMIES, boardTier, generateBoard as generate } from '../../src/core/board';
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
  expect([0, 2, 3, 11].map((w) => boardTier(w, 0))).toEqual([0, 0, 1, 3]);
  expect(boardTier(3, 2)).toBe(5);
  expect(boardTier(300, 5)).toBe(8);
});

test('every enemy that exists has a cost, and only existing enemies do', () => {
  expect(Object.keys(ENEMY_COST).sort()).toEqual(Object.keys(ENEMIES).sort());
  for (const id of MECH_ENEMIES) expect(ENEMIES[id].composed).toBe(true);
});

test.each([[0, 0], [4, 0], [12, 0], [30, 0], [9, 1], [40, 3], [500, 9]])('a board after %i wins in cycle %i is well formed', (wins, cycle) => {
  const tier = boardTier(wins, cycle);
  const budget = Math.min(9, 2 + tier);
  const board = generateBoard(wins, cycle);
  expect(board).toHaveLength(3);
  expect(new Set(board.map((m) => m.id)).size).toBe(3);
  for (const mission of board) {
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
    expect(mission.reward).toBe(220 * spent + 150 * mission.battles.length);
    expect(mission.scale).toBeCloseTo(1 + 0.08 * Math.max(0, tier - 4));
    if (mission.portrait) expect(mission.portrait in SPRITES).toBe(true);
  }
});

test('a low tier never fields a mech, a high tier usually does', () => {
  const mechs = (wins: number) => {
    let n = 0;
    for (let w = wins; w < wins + 30; w++) for (const m of generateBoard(w, 0)) for (const b of m.battles) n += b.enemies.filter((id) => MECH_ENEMIES.includes(id)).length;
    return n;
  };
  for (let w = 0; w < 3; w++) for (const m of generateBoard(w, 0)) for (const b of m.battles) expect(b.enemies.some((id) => MECH_ENEMIES.includes(id))).toBe(false);
  expect(mechs(30)).toBeGreaterThan(20);
});

test('boards offer variety', () => {
  const titles = new Set<string>();
  for (let w = 0; w < 40; w++) for (const m of generateBoard(w, 0)) titles.add(m.title);
  expect(titles.size).toBeGreaterThan(40);
});
