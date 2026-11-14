import {
  BUILD_SLOTS, DIFFICULTIES, LOADOUT_SLOTS, OPTIONAL_SLOTS, SAVE_VERSION, STARTING_CREDITS, buy, checkLoadout, clearLoadout,
  loadLoadout, saveLoadout, setPaint, checkBuy, checkEquip, checkSell, ensureArmed, equip, equippedCount, fits, isValidState,
  newGame, sell, spareCount, type GameState,
} from '../../src/core/game';
import type { Catalog, Shield } from '../../src/core/types';
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
      'bst-stock': 1, 'fcs-stock': 1,
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

  test('frame slots, generator, booster and fire control cannot be emptied; weapon slots and the module can', () => {
    for (const slot of ['head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs'] as const) {
      expect(checkEquip(fresh(), slot, null, CATALOG)).toBe('required');
    }
    const g = equip(fresh(), 'rightHand', null, CATALOG);
    expect(g.build.rightHand).toBeUndefined();
    expect('rightHand' in g.build).toBe(false);
    const withModule = equip(buy(fresh(), 'mod-coolant', CATALOG), 'module', 'mod-coolant', CATALOG);
    expect(withModule.build.module).toBe('mod-coolant');
    expect('module' in equip(withModule, 'module', null, CATALOG).build).toBe(false);
    expect(OPTIONAL_SLOTS).toEqual(['module', 'rightHand', 'leftHand', 'shoulder']);
  });

  test('boosters, fire control, modules and shields each fit their own slot only', () => {
    const shield: Shield = { id: 'shd-test', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 90, price: 500, vendor: 'hadron' };
    expect(fits(CATALOG['bst-vector'], 'booster')).toBe(true);
    expect(fits(CATALOG['bst-vector'], 'fcs')).toBe(false);
    expect(fits(CATALOG['fcs-tracer'], 'fcs')).toBe(true);
    expect(fits(CATALOG['mod-coolant'], 'module')).toBe(true);
    expect(fits(CATALOG['mod-coolant'], 'shoulder')).toBe(false);
    expect(fits(shield, 'leftHand')).toBe(true);
    expect(fits(shield, 'rightHand')).toBe(false);
    expect(fits(shield, 'shoulder')).toBe(false);
    expect(BUILD_SLOTS).toEqual(['head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs', 'module', 'rightHand', 'leftHand', 'shoulder']);
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
    ['no booster', (g) => { const { booster: _b, ...build } = g.build; return { ...g, build }; }],
    ['no fire control', (g) => { const { fcs: _f, ...build } = g.build; return { ...g, build }; }],
    ['a booster in the module slot', (g) => ({ ...g, inventory: { ...g.inventory, 'bst-stock': 2 }, build: { ...g.build, module: 'bst-stock' } })],
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

  test('a blade does not count: it is no weapon on legs that cannot boost, so the last gun stays', () => {
    const g = equip(buy({ ...fresh(), credits: 9999 }, 'wpn-ram-fist', CATALOG), 'rightHand', null, CATALOG);
    expect(checkSell(g, 'wpn-rivet-rifle', CATALOG)).toBe('lastWeapon');
    // The blade itself can go, and so can a second gun.
    expect(checkSell(g, 'wpn-ram-fist', CATALOG)).toBeNull();
    expect(checkSell(buy(g, 'wpn-arc-pistol', CATALOG), 'wpn-rivet-rifle', CATALOG)).toBeNull();
  });

  test('a pilot who owns nothing but blades is issued the starter rifle too', () => {
    const { 'wpn-rivet-rifle': _gone, ...inventory } = fresh().inventory;
    const bladesOnly = { ...fresh(), inventory: { ...inventory, 'wpn-ram-fist': 1 }, build: { ...fresh().build, rightHand: 'wpn-ram-fist' } };
    expect(ensureArmed(bladesOnly, CATALOG, 'wpn-rivet-rifle').inventory['wpn-rivet-rifle']).toBe(1);
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

describe('the pilot and settings in a new game', () => {
  test('start at zero with sound and music on', () => {
    expect(fresh()).toMatchObject({
      xp: 0, perks: {}, arenaRank: 0, cycle: 0, settings: { sfx: true, music: true, fastBattles: false, difficulty: 'standard' },
    });
    expect(DIFFICULTIES).toEqual(['story', 'standard', 'veteran']);
    for (const difficulty of DIFFICULTIES) {
      expect(isValidState({ ...fresh(), settings: { ...fresh().settings, difficulty } }, CATALOG)).toBe(true);
    }
  });

  const bad: [string, (g: any) => unknown][] = [
    ['negative experience', (g) => ({ ...g, xp: -1 })],
    ['a perk rank that is not a whole number', (g) => ({ ...g, perks: { marksman: 1.5 } })],
    ['a huge perk rank', (g) => ({ ...g, perks: { marksman: 50 } })],
    ['perks as a list', (g) => ({ ...g, perks: [] })],
    ['a negative arena rank', (g) => ({ ...g, arenaRank: -1 })],
    ['a cycle that is not a number', (g) => ({ ...g, cycle: 'two' })],
    ['settings missing', (g) => { const { settings: _s, ...rest } = g; return rest; }],
    ['a setting that is not a boolean', (g) => ({ ...g, settings: { ...g.settings, music: 1 } })],
    ['a difficulty that does not exist', (g) => ({ ...g, settings: { ...g.settings, difficulty: 'nightmare' } })],
    ['no difficulty', (g) => { const { difficulty: _d, ...settings } = g.settings; return { ...g, settings }; }],
  ];
  test.each(bad)('rejects %s', (_name, make) => {
    expect(isValidState(make(fresh()), CATALOG)).toBe(false);
  });
});

describe('shields', () => {
  const shield: Shield = { id: 'shd-test', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 90, price: 500, vendor: 'hadron' };
  const catalog: Catalog = { ...CATALOG, [shield.id]: shield };

  test('are bought, fitted to the left hand and saved like any part', () => {
    const g = equip(buy(fresh(), shield.id, catalog), 'leftHand', shield.id, catalog);
    expect(g.build.leftHand).toBe(shield.id);
    expect(isValidState(g, catalog)).toBe(true);
    expect(checkEquip(buy(fresh(), shield.id, catalog), 'rightHand', shield.id, catalog)).toBe('wrongSlot');
  });

  test('do not count as a weapon: the last real weapon still cannot be sold, and a rifle is still issued', () => {
    const owner = buy(fresh(), shield.id, catalog);
    expect(checkSell(equip(owner, 'rightHand', null, catalog), 'wpn-rivet-rifle', catalog)).toBe('lastWeapon');
    expect(checkSell(owner, shield.id, catalog)).toBeNull();
    const { 'wpn-rivet-rifle': _gone, ...inventory } = owner.inventory;
    const { rightHand: _slot, ...build } = owner.build;
    expect(ensureArmed({ ...owner, inventory, build }, catalog, 'wpn-rivet-rifle').inventory['wpn-rivet-rifle']).toBe(1);
  });
});

describe('paint', () => {
  test('a new game is in factory colours; any scheme id can be set', () => {
    expect(fresh().paint).toBe('factory');
    const painted = setPaint(fresh(), 'crimson');
    expect(painted.paint).toBe('crimson');
    expect(isValidState(painted, CATALOG)).toBe(true);
    expect(fresh().paint).toBe('factory');
  });

  test.each([['missing', undefined], ['a number', 7], ['empty', ''], ['far too long', 'x'.repeat(60)], ['not a plain word', 'red;drop']])(
    'a save whose paint is %s is refused', (_name, paint) => {
      expect(isValidState({ ...fresh(), paint }, CATALOG)).toBe(false);
    });
});

describe('saved builds', () => {
  const rich = (...ids: string[]): GameState => ids.reduce((g, id) => buy(g, id, CATALOG), withCredits(50000));
  const fit = (g: GameState, slots: Record<string, string>): GameState =>
    Object.entries(slots).reduce((acc, [slot, id]) => equip(acc, slot as keyof GameState['build'], id, CATALOG), g);

  test('a new game has three empty slots', () => {
    expect(fresh().loadouts).toEqual([null, null, null]);
    expect(LOADOUT_SLOTS).toBe(3);
  });

  test('saving copies the current build; later changes to the build do not touch the copy', () => {
    const start = rich('wpn-arc-pistol');
    const saved = saveLoadout(start, 1);
    expect(saved.loadouts).toEqual([null, start.build, null]);
    const changed = equip(saved, 'leftHand', 'wpn-arc-pistol', CATALOG);
    expect(changed.loadouts[1]).toEqual(start.build);
    expect(changed.loadouts[1]).not.toBe(changed.build);
    expect(start.loadouts).toEqual([null, null, null]);
  });

  test('loading swaps the whole build, and every part it frees is owned as before', () => {
    let g = rich('head-halo', 'wpn-arc-pistol', 'mod-coolant');
    g = saveLoadout(g, 0);
    g = fit(g, { head: 'head-halo', leftHand: 'wpn-arc-pistol', module: 'mod-coolant' });
    g = saveLoadout(g, 2);
    const back = loadLoadout(g, 0, CATALOG);
    expect(back.build).toEqual(g.loadouts[0]);
    expect(back.build.module).toBeUndefined();
    expect(back.inventory).toEqual(g.inventory);
    expect(loadLoadout(back, 2, CATALOG).build).toEqual(g.loadouts[2]);
    expect(isValidState(back, CATALOG)).toBe(true);
  });

  test('an empty slot, or a slot that does not exist, cannot be loaded', () => {
    expect(checkLoadout(fresh(), 0, CATALOG)).toEqual({ refusal: 'empty' });
    expect(checkLoadout(fresh(), 3, CATALOG)).toEqual({ refusal: 'unknown' });
    expect(checkLoadout(fresh(), -1, CATALOG)).toEqual({ refusal: 'unknown' });
    expect(() => loadLoadout(fresh(), 0, CATALOG)).toThrow('illegal loadout: empty');
    expect(() => saveLoadout(fresh(), 5)).toThrow('illegal loadout: unknown');
  });

  test('a build with a part that has been sold cannot be loaded, and the refusal names the part', () => {
    let g = rich('head-halo');
    g = saveLoadout(equip(g, 'head', 'head-halo', CATALOG), 0);
    g = sell(equip(g, 'head', 'head-scout-mk1', CATALOG), 'head-halo', CATALOG);
    expect(checkLoadout(g, 0, CATALOG)).toEqual({ refusal: 'missingPart', part: 'head-halo' });
  });

  test('a build that needs two copies of a weapon needs both to be owned', () => {
    let g = rich('wpn-rivet-rifle');
    g = saveLoadout(equip(g, 'leftHand', 'wpn-rivet-rifle', CATALOG), 0);
    g = sell(equip(g, 'leftHand', null, CATALOG), 'wpn-rivet-rifle', CATALOG);
    expect(checkLoadout(g, 0, CATALOG)).toEqual({ refusal: 'missingPart', part: 'wpn-rivet-rifle' });
  });

  test('a slot can be cleared', () => {
    const g = clearLoadout(saveLoadout(fresh(), 0), 0);
    expect(g.loadouts).toEqual([null, null, null]);
  });

  const bad: [string, (g: any) => unknown][] = [
    ['no loadouts', (g) => { const { loadouts: _l, ...rest } = g; return rest; }],
    ['two slots', (g) => ({ ...g, loadouts: [null, null] })],
    ['a slot that is not a build', (g) => ({ ...g, loadouts: [null, 'mine', null] })],
    ['a saved build with an unknown part', (g) => ({ ...g, loadouts: [{ ...g.build, core: 'nope' }, null, null] })],
    ['a saved build with a part in the wrong slot', (g) => ({ ...g, loadouts: [{ ...g.build, head: 'core-hauler' }, null, null] })],
    ['a saved build with a slot that does not exist', (g) => ({ ...g, loadouts: [{ ...g.build, tail: 'wpn-rivet-rifle' }, null, null] })],
    ['a saved build with an enemy part', (g) => ({ ...g, loadouts: [{ ...g.build, core: 'core-drone' }, null, null] })],
    ['an empty saved build', (g) => ({ ...g, loadouts: [{}, null, null] })],
    ['a saved build without a generator', (g) => { const { generator: _g, ...build } = g.build; return { ...g, loadouts: [build, null, null] }; }],
    ['a saved build without legs', (g) => { const { legs: _l, ...build } = g.build; return { ...g, loadouts: [null, null, build] }; }],
  ];
  test.each(bad)('a save with %s is refused', (_name, make) => {
    expect(isValidState(make(fresh()), CATALOG)).toBe(false);
  });

  test('a saved build may name parts that are no longer owned: loading it is what is refused', () => {
    const g = { ...fresh(), loadouts: [{ ...fresh().build, head: 'head-halo' }, null, null] };
    expect(isValidState(g, CATALOG)).toBe(true);
  });
});
