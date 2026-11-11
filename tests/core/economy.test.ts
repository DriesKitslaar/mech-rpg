import { createBattle, type BattleState } from '../../src/core/battle';
import { applySettlement, settle } from '../../src/core/economy';
import { newGame } from '../../src/core/game';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

/** A finished battle with the player's state adjusted by `change`. */
function finished(outcome: 'victory' | 'defeat', change: (b: BattleState) => void = () => {}): BattleState {
  const battle = structuredClone(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 1));
  battle.outcome = outcome;
  change(battle);
  return battle;
}

test('an untouched victory nets the full reward', () => {
  expect(settle(finished('victory'), 600, CATALOG)).toEqual({
    won: true, reward: 600, ammoCost: 0, repairCost: 0, net: 600, lines: [],
  });
});

test('ammunition is charged per shot fired', () => {
  const s = settle(finished('victory', (b) => { b.units[0].ammo.rightHand = 26; b.units[0].ammo.shoulder = 7; }), 600, CATALOG);
  expect(s.ammoCost).toBe(4 * 15 + 1 * 60);
  expect(s.net).toBe(600 - 120);
});

test('weapons without ammunition cost nothing to fire', () => {
  const s = settle(finished('victory', (b) => { b.units[0].fired = ['leftHand']; }), 600, CATALOG);
  expect(s.ammoCost).toBe(0);
});

test('repairs cost half the part price in proportion to the armour lost', () => {
  const s = settle(finished('victory', (b) => { b.units[0].parts.core!.ap = 110; }), 600, CATALOG);
  expect(s.repairCost).toBe(75);
  expect(s.lines).toEqual([{ partId: 'core-hauler', lost: 110, cost: 75 }]);
});

test('a destroyed part costs half its price', () => {
  const s = settle(finished('victory', (b) => { b.units[0].parts.arms!.ap = 0; }), 600, CATALOG);
  expect(s.lines).toEqual([{ partId: 'arms-rigger', lost: 110, cost: 150 }]);
});

test('several damaged parts each get a line, in slot order', () => {
  const s = settle(finished('victory', (b) => { b.units[0].parts.head!.ap = 30; b.units[0].parts.legs!.ap = 75; }), 600, CATALOG);
  expect(s.lines.map((l) => l.partId)).toEqual(['legs-strider', 'head-scout-mk1']);
  expect(s.repairCost).toBe(75 + 75);
});

test('a defeat pays nothing but still charges ammunition and repairs', () => {
  const s = settle(finished('defeat', (b) => { b.units[0].ammo.rightHand = 20; b.units[0].parts.core!.ap = 0; }), 600, CATALOG);
  expect(s).toMatchObject({ won: false, reward: 0, ammoCost: 150, repairCost: 150, net: -300 });
});

test('a battle that is still going cannot be settled', () => {
  expect(() => settle(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 1), 600, CATALOG)).toThrow('battle is not over');
});

test('applying a settlement changes credits and counts wins', () => {
  const game = newGame(CATALOG, STARTER_BUILD);
  const won = applySettlement(game, settle(finished('victory'), 600, CATALOG));
  expect(won).toMatchObject({ credits: 1800, battlesWon: 1 });
  const lost = applySettlement({ ...game, credits: 100 }, settle(finished('defeat', (b) => { b.units[0].parts.core!.ap = 0; b.units[0].parts.legs!.ap = 0; }), 600, CATALOG));
  expect(lost).toMatchObject({ credits: -200, battlesWon: 0 });
  expect(game.credits).toBe(1200);
});
