import { ORDERS, activeUnit, applyAction, checkAction, coverShare, createBattle, previewShot, type BattleState, type Order, type Support } from '../../src/core/battle';
import { startMissionBattle } from '../../src/core/mission';
import { withWingman } from '../../src/core/wingman';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { WINGMEN } from '../../src/content/wingmen';

const hired: Support = { name: 'Marrow', damage: 28, orders: true };
const start = (support: Support = hired): BattleState => {
  let s = createBattle(DEMO_BUILD, [ENEMIES.tank, ENEMIES['recon-drone']], CATALOG, 4, { support });
  // To the pilot's turn.
  for (let i = 0; i < 6 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
};
const order = (s: BattleState, o: Order) => applyAction(s, { type: 'order', order: o }, CATALOG);
/** Plays on, the pilot doing nothing, until the wingman has fired or a few turns have gone by. */
function nextSupport(s: BattleState): { target: string } | null {
  const from = s.events.length;
  for (let i = 0; i < 8 && s.outcome === 'ongoing'; i++) {
    s = applyAction(s, { type: 'endTurn' }, CATALOG);
    const shot = s.events.slice(from).find((e) => e.type === 'support');
    if (shot && shot.type === 'support') return { target: shot.target };
  }
  return null;
}

describe('orders for a wingman', () => {
  test('a hired wingman takes them; an ally of the story does not', () => {
    const flown = withWingman(MISSIONS.find((m) => m.id === 'patrol')!, WINGMEN[0]);
    expect(flown.battles[0].support).toEqual({ name: 'Kite', damage: 18, orders: true });
    const story = start({ name: 'Ashfall', damage: 30 });
    expect(checkAction(story, { type: 'order', order: 'cover' }, CATALOG)).toBe('noWingman');
    expect(checkAction(createBattle(DEMO_BUILD, [ENEMIES.tank], CATALOG, 4), { type: 'order', order: 'cover' }, CATALOG)).toBe('noWingman');
    expect(checkAction(start(), { type: 'order', order: 'cover' }, CATALOG)).toBeNull();
    expect(ORDERS).toEqual(['strongest', 'target', 'cover']);
  });

  test('giving one costs nothing and does not end the turn; the order they already have is not given again', () => {
    const s = start();
    const me = activeUnit(s);
    const told = order(s, 'target');
    expect(told.support!.order).toBe('target');
    expect(activeUnit(told).id).toBe(me.id);
    expect(activeUnit(told).energy).toBe(me.energy);
    expect(told.events.at(-1)).toEqual({ type: 'order', name: 'Marrow', order: 'target' });
    expect(checkAction(told, { type: 'order', order: 'target' }, CATALOG)).toBe('alreadyUsed');
    expect(checkAction(s, { type: 'order', order: 'strongest' }, CATALOG)).toBe('alreadyUsed');
  });

  test('left alone they fire on the strongest; told to follow, on whatever the pilot fired at last', () => {
    const s = start();
    const strongest = s.units.filter((u) => u.side === 'enemy').reduce((a, b) => (b.parts.core!.ap > a.parts.core!.ap ? b : a));
    const other = s.units.find((u) => u.side === 'enemy' && u.id !== strongest.id)!;
    expect(nextSupport(s)).toEqual({ target: strongest.id });
    const fired = applyAction(order(s, 'target'), { type: 'fire', weapon: 'leftHand', target: other.id, part: 'legs' }, CATALOG, () => 0.99);
    expect(fired.focus).toBe(other.id);
    expect(nextSupport(fired)).toEqual({ target: other.id });
    // With nothing fired at yet, or the target gone, they fall back on the strongest.
    expect(nextSupport(order(s, 'target'))).toEqual({ target: strongest.id });
    const gone = structuredClone(fired);
    gone.units.find((u) => u.id === other.id)!.destroyed = true;
    expect(nextSupport(gone)).toEqual({ target: strongest.id });
  });

  test('on cover they hold their fire, and every shot at the pilot does less by their share', () => {
    const s = start();
    const covered = order(s, 'cover');
    expect(nextSupport(covered)).toBeNull();
    const foe = s.units.find((u) => u.side === 'enemy')!;
    const plain = previewShot(s, foe.id, 'shoulder', 'player', 'core', CATALOG);
    const less = previewShot(covered, foe.id, 'shoulder', 'player', 'core', CATALOG);
    expect(less.damage).toBe(Math.max(1, Math.round(plain.damage * (1 - coverShare(hired)))));
    expect(less.hitChance).toBe(plain.hitChance);
    // What the pilot does to the enemy is not changed by it.
    expect(previewShot(covered, 'player', 'rightHand', foe.id, 'core', CATALOG)).toEqual(previewShot(s, 'player', 'rightHand', foe.id, 'core', CATALOG));
  });

  test('the dearer the wingman, the more they take on themselves, up to three shots in ten', () => {
    expect(WINGMEN.map((w) => Math.round(coverShare({ name: w.name, damage: w.damage }) * 100))).toEqual([12, 19, 27]);
    expect(coverShare({ name: 'x', damage: 500 })).toBe(0.3);
  });

  test('each order has a row for the menu and a line for when it is given, short enough for both', () => {
    for (const o of ORDERS) {
      expect(STRINGS.orders.item(o).length).toBeLessThanOrEqual(16);
      expect(STRINGS.orders.told('Old Sixty', o).length).toBeLessThanOrEqual(60);
    }
  });

  test('an order is the pilot\'s to give on the pilot\'s turn only', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES.tank, ENEMIES['recon-drone']], CATALOG, 4, { support: hired });
    for (let i = 0; i < 12 && activeUnit(s).side === 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
    expect(activeUnit(s).side).toBe('enemy');
    expect(checkAction(s, { type: 'order', order: 'cover' }, CATALOG)).toBe('noWingman');
  });

  test('told to follow the pilot, they still spare the machine the client wants in one piece', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES['light-mech'], ENEMIES['recon-drone']], CATALOG, 4, { support: hired, objective: { type: 'disable', target: 0 } });
    for (let i = 0; i < 6 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
    s = applyAction(order(s, 'target'), { type: 'fire', weapon: 'leftHand', target: 'enemy-0', part: 'legs' }, CATALOG, () => 0.99);
    expect(s.focus).toBe('enemy-0');
    expect(nextSupport(s)).toEqual({ target: 'enemy-1' });
  });

  test('the order holds through the battles of one contract', () => {
    const flown = withWingman(MISSIONS.find((m) => m.id === 'undertow-1')!, WINGMEN[0]);
    let first = startMissionBattle(DEMO_BUILD, flown, 0, ALL_ENEMIES, CATALOG, 3);
    for (let i = 0; i < 6 && activeUnit(first).side !== 'player'; i++) first = applyAction(first, { type: 'endTurn' }, CATALOG);
    first = order(first, 'cover');
    const won = { ...first, outcome: 'victory' as const };
    expect(startMissionBattle(DEMO_BUILD, flown, 1, ALL_ENEMIES, CATALOG, 3, won).support).toMatchObject({ name: 'Kite', order: 'cover', orders: true });
    // An ally of the story takes no orders, so none is carried for them.
    const allied = MISSIONS.find((m) => m.battles.length > 1 && m.battles.every((b) => b.support))!;
    const before = startMissionBattle(DEMO_BUILD, allied, 0, ALL_ENEMIES, CATALOG, 3);
    expect(startMissionBattle(DEMO_BUILD, allied, 1, ALL_ENEMIES, CATALOG, 3, { ...before, outcome: 'victory' as const }).support?.order).toBeUndefined();
  });
});
