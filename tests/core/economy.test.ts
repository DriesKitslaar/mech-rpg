import { createBattle, type BattleState } from '../../src/core/battle';
import { DEBT_LIMIT, REPAIR_COST_PER_AP, applySettlement, debtRelief, settle } from '../../src/core/economy';
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
  // The Arc Pistol has no ammunition count; give the rifle a full magazine so only the pistol could matter.
  const battle = finished('victory');
  expect(battle.units[0].ammo.leftHand).toBeNull();
  expect(settle(battle, 600, CATALOG).ammoCost).toBe(0);
  // The same battle with rifle shots fired does cost, so the zero above is not an accident.
  expect(settle(finished('victory', (b) => { b.units[0].ammo.rightHand = 29; }), 600, CATALOG).ammoCost).toBe(15);
});

test('repairs cost a flat rate per point of armour lost', () => {
  expect(REPAIR_COST_PER_AP).toBe(0.8);
  const s = settle(finished('victory', (b) => { b.units[0].parts.core!.ap = 110; }), 600, CATALOG);
  expect(s.repairCost).toBe(88);
  expect(s.lines).toEqual([{ partId: 'core-hauler', lost: 110, cost: 88 }]);
});

test('an expensive part costs no more to repair per point than a cheap one', () => {
  const heavy = structuredClone(createBattle({ ...DEMO_BUILD, core: 'core-bulwark', legs: 'legs-bulwark' }, [ENEMIES['recon-drone']], CATALOG, 1));
  heavy.outcome = 'victory';
  heavy.units[0].parts.core!.ap -= 110;
  expect(settle(heavy, 600, CATALOG).lines).toEqual([{ partId: 'core-bulwark', lost: 110, cost: 88 }]);
});

test('a destroyed part is billed for all its armour', () => {
  const s = settle(finished('victory', (b) => { b.units[0].parts.arms!.ap = 0; }), 600, CATALOG);
  expect(s.lines).toEqual([{ partId: 'arms-rigger', lost: 110, cost: 88 }]);
});

test('several damaged parts each get a line, in slot order', () => {
  const s = settle(finished('victory', (b) => { b.units[0].parts.head!.ap = 30; b.units[0].parts.legs!.ap = 75; }), 600, CATALOG);
  expect(s.lines.map((l) => l.partId)).toEqual(['legs-strider', 'head-scout-mk1']);
  expect(s.repairCost).toBe(24 + 60);
});

test('a defeat pays nothing but still charges ammunition and repairs', () => {
  const s = settle(finished('defeat', (b) => { b.units[0].ammo.rightHand = 20; b.units[0].parts.core!.ap = 0; }), 600, CATALOG);
  expect(s).toMatchObject({ won: false, reward: 0, ammoCost: 150, repairCost: 176, net: -326 });
});

test('a battle that is still going cannot be settled', () => {
  expect(() => settle(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 1), 600, CATALOG)).toThrow('battle is not over');
});

test('applying a settlement changes credits and counts wins', () => {
  const game = newGame(CATALOG, STARTER_BUILD);
  const won = applySettlement(game, settle(finished('victory'), 600, CATALOG));
  expect(won).toMatchObject({ credits: 1800, battlesWon: 1 });
  const lost = applySettlement({ ...game, credits: 100 }, settle(finished('defeat', (b) => { b.units[0].parts.core!.ap = 0; b.units[0].parts.legs!.ap = 0; }), 600, CATALOG));
  expect(lost).toMatchObject({ credits: -196, battlesWon: 0 });
  expect(game.credits).toBe(1200);
});

describe('the debt limit', () => {
  const bill = (net: number) => ({ won: false, reward: 0, ammoCost: 0, repairCost: -net, net, lines: [] });
  const paid = (net: number) => ({ won: true, reward: net, ammoCost: 0, repairCost: 0, net, lines: [] });
  const at = (credits: number) => ({ ...newGame(CATALOG, STARTER_BUILD), credits });

  test('is two thousand credits: a pilot can owe that much and no more', () => {
    expect(DEBT_LIMIT).toBe(-2000);
  });

  test('a bill is paid in full while it leaves the pilot above the limit', () => {
    expect(applySettlement(at(500), bill(-800)).credits).toBe(-300);
    expect(debtRelief(at(500), bill(-800))).toBe(0);
    expect(applySettlement(at(-1200), bill(-800)).credits).toBe(-2000);
    expect(debtRelief(at(-1200), bill(-800))).toBe(0);
  });

  test('the part of a bill that would take the pilot past the limit is written off', () => {
    expect(applySettlement(at(-1500), bill(-800)).credits).toBe(-2000);
    expect(debtRelief(at(-1500), bill(-800))).toBe(300);
    expect(applySettlement(at(-2000), bill(-800)).credits).toBe(-2000);
    expect(debtRelief(at(-2000), bill(-800))).toBe(800);
  });

  test('a pilot who is already past the limit, from before there was one, is charged nothing more', () => {
    expect(applySettlement(at(-9000), bill(-800)).credits).toBe(-9000);
    expect(debtRelief(at(-9000), bill(-800))).toBe(800);
  });

  test('pay always counts in full, whatever is owed', () => {
    expect(applySettlement(at(-9000), paid(700)).credits).toBe(-8300);
    expect(applySettlement(at(-2000), paid(700)).credits).toBe(-1300);
    expect(debtRelief(at(-2000), paid(700))).toBe(0);
  });

  test('a lost battle past the limit still counts as lost', () => {
    expect(applySettlement(at(-2000), bill(-800)).battlesWon).toBe(0);
  });
});

describe('pilot modifiers on the settlement', () => {
  test('a pay bonus raises the reward', () => {
    expect(settle(finished('victory'), 600, CATALOG, { payBonus: 0.24, costDiscount: 0 })).toMatchObject({ reward: 744, net: 744 });
  });

  test('a cost discount lowers ammunition and repairs', () => {
    const battle = finished('victory', (b) => { b.units[0].ammo.rightHand = 20; b.units[0].parts.core!.ap = 110; });
    const s = settle(battle, 600, CATALOG, { payBonus: 0, costDiscount: 0.45 });
    expect(s.ammoCost).toBe(83);          // 150 less 45%, rounded
    expect(s.lines).toEqual([{ partId: 'core-hauler', lost: 110, cost: 48 }]);
    expect(s.net).toBe(600 - 83 - 48);
  });

  test('a bonus does not turn a defeat into pay', () => {
    expect(settle(finished('defeat'), 600, CATALOG, { payBonus: 0.24, costDiscount: 0 }).reward).toBe(0);
  });
});
