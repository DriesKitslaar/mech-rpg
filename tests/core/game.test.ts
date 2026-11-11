import {
  SAVE_VERSION, STARTING_CREDITS, buy, checkBuy, checkEquip, checkSell, ensureArmed, equip, equippedCount, fits, isValidState,
  newGame, sell, spareCount, type GameState,
} from '../../src/core/game';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const withCredits = (credits: number): GameState => ({ ...fresh(), credits });

describe('a new game', () => {
  test('owns exactly the starter build and has the starting credits', () => {
    const g = fresh();
    expect(g.credits).toBe(STARTING_CREDITS);
    expect(g.credits).toBe(1200);
    expect(g.build).toEqual(STARTER_BUILD);
    expect(g.inventory).toEqual({
      'head-scout-mk1': 1, 'core-hauler': 1, 'arms-rigger': 1, 'legs-strider': 1, 'gen-kd1': 1, 'wpn-rivet-rifle': 1,
    });
    expect(g.battlesWon).toBe(0);
    expect(g.completed).toEqual([]);
    expect(g.read).toEqual([]);
    expect(g.version).toBe(SAVE_VERSION);
    expect(isValidState(g, CATALOG)).toBe(true);
  });
});

describe('buying', () => {
  test('deducts the price and adds one copy', () => {
    const g = buy(fresh(), 'wpn-arc-pistol', CATALOG);
    expect(g.credits).toBe(600);
    expect(g.inventory['wpn-arc-pistol']).toBe(1);
  });

  test('a second copy stacks', () => {
    const g = buy(buy(withCredits(5000), 'wpn-rivet-rifle', CATALOG), 'wpn-rivet-rifle', CATALOG);
    expect(g.inventory['wpn-rivet-rifle']).toBe(3);
  });

  test('needs the full price', () => {
    expect(checkBuy(withCredits(899), 'head-halo', CATALOG)).toBe('cannotAfford');
    expect(checkBuy(withCredits(900), 'head-halo', CATALOG)).toBeNull();
    expect(checkBuy(withCredits(-50), 'wpn-rivet-rifle', CATALOG)).toBe('cannotAfford');
  });

  test('enemy parts and unknown ids are not for sale', () => {
    expect(checkBuy(withCredits(9999), 'core-drone', CATALOG)).toBe('notForSale');
    expect(checkBuy(withCredits(9999), 'nope', CATALOG)).toBe('notForSale');
  });

  test('a refused purchase throws', () => {
    expect(() => buy(withCredits(0), 'head-halo', CATALOG)).toThrow('illegal trade: cannotAfford');
  });
});

describe('selling', () => {
  test('a spare copy returns the full price', () => {
    const g = sell(buy(fresh(), 'wpn-arc-pistol', CATALOG), 'wpn-arc-pistol', CATALOG);
    expect(g.credits).toBe(1200);
    expect(g.inventory['wpn-arc-pistol']).toBeUndefined();
  });

  test('a fitted part cannot be sold', () => {
    expect(checkSell(fresh(), 'wpn-rivet-rifle', CATALOG)).toBe('equipped');
    expect(() => sell(fresh(), 'core-hauler', CATALOG)).toThrow('illegal trade: equipped');
  });

  test('something not owned cannot be sold', () => {
    expect(checkSell(fresh(), 'head-halo', CATALOG)).toBe('notOwned');
    expect(checkSell(fresh(), 'nope', CATALOG)).toBe('notOwned');
  });

  test('selling works in debt', () => {
    const g = sell({ ...buy(fresh(), 'wpn-arc-pistol', CATALOG), credits: -50 }, 'wpn-arc-pistol', CATALOG);
    expect(g.credits).toBe(550);
  });
});

describe('equipping', () => {
  test('counts fitted and spare copies', () => {
    const g = buy(fresh(), 'wpn-rivet-rifle', CATALOG);
    expect(equippedCount(g, 'wpn-rivet-rifle')).toBe(1);
    expect(spareCount(g, 'wpn-rivet-rifle')).toBe(1);
    expect(spareCount(g, 'head-halo')).toBe(0);
  });

  test('a second rifle goes in the left hand, and then neither can be sold', () => {
    const g = equip(buy(fresh(), 'wpn-rivet-rifle', CATALOG), 'leftHand', 'wpn-rivet-rifle', CATALOG);
    expect(g.build.leftHand).toBe('wpn-rivet-rifle');
    expect(checkSell(g, 'wpn-rivet-rifle', CATALOG)).toBe('equipped');
  });

  test('one rifle cannot be in both hands', () => {
    expect(checkEquip(fresh(), 'leftHand', 'wpn-rivet-rifle', CATALOG)).toBe('noSpare');
  });

  test('parts must fit the slot', () => {
    const g = buy(buy(withCredits(9000), 'wpn-mortar-pod', CATALOG), 'head-halo', CATALOG);
    expect(checkEquip(g, 'rightHand', 'wpn-mortar-pod', CATALOG)).toBe('wrongSlot');
    expect(checkEquip(g, 'shoulder', 'wpn-rivet-rifle', CATALOG)).toBe('wrongSlot');
    expect(checkEquip(g, 'core', 'head-halo', CATALOG)).toBe('wrongSlot');
    expect(checkEquip(g, 'shoulder', 'wpn-mortar-pod', CATALOG)).toBeNull();
    expect(fits(CATALOG['gen-kd1'], 'generator')).toBe(true);
    expect(fits(CATALOG['gen-kd1'], 'core')).toBe(false);
  });

  test('an unowned part cannot be fitted', () => {
    expect(checkEquip(fresh(), 'head', 'head-halo', CATALOG)).toBe('notOwned');
    expect(() => equip(fresh(), 'head', 'head-halo', CATALOG)).toThrow('illegal equip: notOwned');
  });

  test('frame slots and the generator cannot be emptied, weapon slots can', () => {
    for (const slot of ['head', 'core', 'arms', 'legs', 'generator'] as const) {
      expect(checkEquip(fresh(), slot, null, CATALOG)).toBe('required');
    }
    const g = equip(fresh(), 'rightHand', null, CATALOG);
    expect(g.build.rightHand).toBeUndefined();
    expect('rightHand' in g.build).toBe(false);
  });

  test('swapping a part frees the old one', () => {
    const g = equip(buy(fresh(), 'head-halo', CATALOG), 'head', 'head-halo', CATALOG);
    expect(g.build.head).toBe('head-halo');
    expect(spareCount(g, 'head-scout-mk1')).toBe(1);
  });

  test('re-fitting the fitted part changes nothing', () => {
    expect(checkEquip(fresh(), 'head', 'head-scout-mk1', CATALOG)).toBeNull();
    expect(equip(fresh(), 'head', 'head-scout-mk1', CATALOG)).toEqual(fresh());
  });
});

test('no rule function changes the state it is given', () => {
  const g = buy(withCredits(5000), 'head-halo', CATALOG);
  const before = structuredClone(g);
  buy(g, 'wpn-arc-pistol', CATALOG);
  sell(g, 'head-halo', CATALOG);
  equip(g, 'head', 'head-halo', CATALOG);
  equip(g, 'rightHand', null, CATALOG);
  expect(g).toEqual(before);
});

describe('validating loaded data', () => {
  const broken: [string, (g: any) => unknown][] = [
    ['null', () => null],
    ['a string', () => 'save'],
    ['a wrong version', (g) => ({ ...g, version: 99 })],
    ['credits that are not a number', (g) => ({ ...g, credits: NaN })],
    ['credits as text', (g) => ({ ...g, credits: '1200' })],
    ['an unknown part in the inventory', (g) => ({ ...g, inventory: { ...g.inventory, nope: 1 } })],
    ['an enemy part in the inventory', (g) => ({ ...g, inventory: { ...g.inventory, 'core-drone': 1 } })],
    ['a negative count', (g) => ({ ...g, inventory: { ...g.inventory, 'head-halo': -1 } })],
    ['a fractional count', (g) => ({ ...g, inventory: { ...g.inventory, 'head-halo': 0.5 } })],
    ['a fitted part that is not owned', (g) => ({ ...g, inventory: { ...g.inventory, 'core-hauler': 0 } })],
    ['a missing required slot', (g) => { const { legs: _legs, ...build } = g.build; return { ...g, build }; }],
    ['a part in the wrong slot', (g) => ({ ...g, build: { ...g.build, core: 'head-scout-mk1' } })],
    ['one weapon in both hands', (g) => ({ ...g, build: { ...g.build, leftHand: 'wpn-rivet-rifle' } })],
    ['a slot that does not exist', (g) => ({ ...g, build: { ...g.build, tail: 'wpn-rivet-rifle' } })],
    ['no build', (g) => ({ ...g, build: undefined })],
    ['an inventory that is a list', (g) => ({ ...g, inventory: [] })],
    ['negative battles won', (g) => ({ ...g, battlesWon: -1 })],
    ['completed contracts that are not a list', (g) => ({ ...g, completed: 'intro-1' })],
    ['a completed entry that is not text', (g) => ({ ...g, completed: [1] })],
    ['read messages missing', (g) => { const { read: _read, ...rest } = g; return rest; }],
    ['fractional credits', (g) => ({ ...g, credits: 10.5 })],
    ['absurdly many copies', (g) => ({ ...g, inventory: { ...g.inventory, 'head-halo': 1e308 } })],
  ];
  test.each(broken)('rejects %s', (_name, make) => {
    expect(isValidState(make(fresh()), CATALOG)).toBe(false);
  });

  test('accepts a build that is too heavy: that is the garage\'s business', () => {
    let g = withCredits(20000);
    for (const id of ['head-bulwark', 'core-bulwark', 'arms-bulwark']) g = buy(g, id, CATALOG);
    g = equip(equip(equip(g, 'head', 'head-bulwark', CATALOG), 'core', 'core-bulwark', CATALOG), 'arms', 'arms-bulwark', CATALOG);
    expect(isValidState(g, CATALOG)).toBe(true);
  });

  test('accepts negative credits', () => {
    expect(isValidState(withCredits(-300), CATALOG)).toBe(true);
  });
});

test('ids that only exist on every object are not parts', () => {
  for (const id of ['constructor', '__proto__', 'toString']) {
    expect(checkSell(fresh(), id, CATALOG)).toBe('notOwned');
    expect(checkBuy(withCredits(99999), id, CATALOG)).toBe('notForSale');
    expect(checkEquip(fresh(), 'head', id, CATALOG)).toBe('notOwned');
  }
});

describe('never without a weapon', () => {
  test('the last weapon a pilot owns cannot be sold, fitted or not', () => {
    expect(checkSell(equip(fresh(), 'rightHand', null, CATALOG), 'wpn-rivet-rifle', CATALOG)).toBe('lastWeapon');
    expect(checkSell(fresh(), 'wpn-rivet-rifle', CATALOG)).toBe('equipped');
  });

  test('with two weapons a spare one can be sold', () => {
    const g = buy(fresh(), 'wpn-arc-pistol', CATALOG);
    expect(checkSell(g, 'wpn-arc-pistol', CATALOG)).toBeNull();
  });

  test('a pilot who somehow owns no weapon is issued the starter rifle', () => {
    const { 'wpn-rivet-rifle': _gone, ...inventory } = fresh().inventory;
    const { rightHand: _slot, ...build } = fresh().build;
    const unarmed = { ...fresh(), inventory, build };
    const armed = ensureArmed(unarmed, CATALOG, 'wpn-rivet-rifle');
    expect(armed.inventory['wpn-rivet-rifle']).toBe(1);
    expect(armed.credits).toBe(unarmed.credits);
    const already = fresh();
    expect(ensureArmed(already, CATALOG, 'wpn-rivet-rifle')).toBe(already);
  });
});

test('a new game has not seen an ending, and the flag must be a boolean', () => {
  expect(fresh().endingSeen).toBe(false);
  expect(isValidState({ ...fresh(), endingSeen: 'no' }, CATALOG)).toBe(false);
  const { endingSeen: _flag, ...without } = fresh();
  expect(isValidState(without, CATALOG)).toBe(false);
});
