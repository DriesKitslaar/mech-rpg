import { buy, equip, newGame, saveLoadout, sell, type GameState } from '../../src/core/game';
import type { Shield } from '../../src/core/types';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import type { InputAction } from '../../src/platform/input';
import { GarageFlow } from '../../src/ui/garageFlow';
import { PAINTS } from '../../src/ui/paint';

const fresh = (credits = 1200): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits });
const rich = (...ids: string[]): GameState => ids.reduce((g, id) => buy(g, id, CATALOG), fresh(50000));
const press = (flow: GarageFlow, ...actions: InputAction[]) => actions.map((a) => flow.onInput(a));
/** Moves the slot cursor to a slot and opens its part list. */
function openSlot(flow: GarageFlow, slot: string): void {
  for (let i = 0; i < 12 && flow.slots.selected?.id !== slot; i++) flow.onInput('down');
  expect(flow.slots.selected?.id).toBe(slot);
  flow.onInput('confirm');
  expect(flow.mode).toBe('parts');
}
function pick(flow: GarageFlow, id: string) {
  for (let i = 0; i < 20 && flow.parts.selected?.id !== id; i++) flow.onInput('down');
  expect(flow.parts.selected?.id).toBe(id);
}

test('the slot list names what is fitted in each of the eleven slots', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  expect(flow.mode).toBe('slots');
  expect(flow.slots.items.map((i) => [i.id, i.note])).toEqual([
    ['head', 'Scout Mk1'], ['core', 'Hauler Core'], ['arms', 'Rigger Arms'], ['legs', 'Strider Legs'],
    ['generator', 'KD-1 Cell'], ['booster', 'Stock Thrusters'], ['fcs', 'Stock FCS'], ['module', 'Empty'],
    ['rightHand', 'Rivet Rifle'], ['leftHand', 'Empty'], ['shoulder', 'Empty'],
  ]);
  expect(flow.slots.items.map((i) => i.label)).toEqual([
    'Head', 'Core', 'Arms', 'Legs', 'Generator', 'Booster', 'FCS', 'Module', 'Right Hand', 'Left Hand', 'Shoulder',
  ]);
});

test('the module slot can be left empty; the booster and fire control slots cannot', () => {
  const flow = new GarageFlow(rich('mod-coolant', 'bst-sprint'), CATALOG);
  openSlot(flow, 'module');
  expect(flow.parts.items.map((i) => i.id)).toEqual(['(none)', 'mod-coolant']);
  pick(flow, 'mod-coolant');
  expect(flow.preview.weight).toBe(flow.stats.weight + 30);
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.build.module).toBe('mod-coolant');
  press(flow, 'cancel');
  const again = new GarageFlow(flow.game, CATALOG);
  openSlot(again, 'booster');
  expect(again.parts.items.map((i) => i.id)).toEqual(['bst-stock', 'bst-sprint']);
});

test('the left hand also lists shields; the right hand does not', () => {
  const shield: Shield = { id: 'shd-test', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 90, price: 500, vendor: 'hadron' };
  const catalog = { ...CATALOG, [shield.id]: shield };
  const game = buy(fresh(5000), shield.id, catalog);
  const left = new GarageFlow(game, catalog);
  openSlot(left, 'leftHand');
  // The rifle is listed too, but its only copy is in the other hand.
  expect(left.parts.items.map((i) => [i.id, i.enabled])).toEqual([['(none)', true], ['wpn-rivet-rifle', false], ['shd-test', true]]);
  const right = new GarageFlow(game, catalog);
  openSlot(right, 'rightHand');
  expect(right.parts.items.map((i) => i.id)).toEqual(['(none)', 'wpn-rivet-rifle']);
});

test('a weapon slot lists (none) and the owned weapons, starting on the fitted one', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  openSlot(flow, 'rightHand');
  expect(flow.parts.items.map((i) => i.id)).toEqual(['(none)', 'wpn-rivet-rifle']);
  expect(flow.parts.selected?.id).toBe('wpn-rivet-rifle');
  expect(flow.parts.items[1].label).toBe('Rivet Rifle *');
});

test('choosing (none) empties a weapon slot', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  openSlot(flow, 'rightHand');
  pick(flow, '(none)');
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.build.rightHand).toBeUndefined();
  expect(flow.mode).toBe('slots');
  expect(flow.slots.items.find((i) => i.id === 'rightHand')?.note).toBe('Empty');
});

test('a frame slot cannot be emptied', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  openSlot(flow, 'head');
  expect(flow.parts.items.map((i) => i.id)).toEqual(['head-scout-mk1']);
});

test('highlighting a part previews it without changing the game until confirmed', () => {
  const flow = new GarageFlow(rich('head-halo'), CATALOG);
  openSlot(flow, 'head');
  pick(flow, 'head-halo');
  expect(flow.candidate).toBe('head-halo');
  expect(flow.previewBuild.head).toBe('head-halo');
  expect(flow.preview.weight - flow.stats.weight).toBe(-15);
  expect(flow.game.build.head).toBe('head-scout-mk1');
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.build.head).toBe('head-halo');
  expect(flow.stats.weight).toBe(785);
});

test('cancel leaves the part list without changing anything, then leaves the garage', () => {
  const flow = new GarageFlow(rich('head-halo'), CATALOG);
  openSlot(flow, 'head');
  pick(flow, 'head-halo');
  expect(flow.onInput('cancel')).toBe('stay');
  expect(flow.mode).toBe('slots');
  expect(flow.game.build.head).toBe('head-scout-mk1');
  expect(flow.candidate).toBeNull();
  expect(flow.onInput('cancel')).toBe('exit');
});

test('a single weapon fitted in one hand is shown as in use for the other', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  openSlot(flow, 'leftHand');
  const rifle = flow.parts.items.find((i) => i.id === 'wpn-rivet-rifle')!;
  expect(rifle).toMatchObject({ enabled: false, note: 'In use' });
  pick(flow, 'wpn-rivet-rifle');
  expect(flow.onInput('confirm')).toBe('stay');
  expect(flow.game.build.leftHand).toBeUndefined();
  // An in-use part is not previewed either: it could not be fitted.
  expect(flow.previewBuild.leftHand).toBeUndefined();
});

test('a second copy can go in the other hand', () => {
  const flow = new GarageFlow(rich('wpn-rivet-rifle'), CATALOG);
  openSlot(flow, 'leftHand');
  expect(flow.parts.items.find((i) => i.id === 'wpn-rivet-rifle')).toMatchObject({ enabled: true, note: 'x1' });
  pick(flow, 'wpn-rivet-rifle');
  press(flow, 'confirm');
  expect(flow.game.build.leftHand).toBe('wpn-rivet-rifle');
});

test('a shoulder slot only lists shoulder weapons', () => {
  const flow = new GarageFlow(rich('wpn-mortar-pod', 'wpn-arc-pistol'), CATALOG);
  openSlot(flow, 'shoulder');
  expect(flow.parts.items.map((i) => i.id)).toEqual(['(none)', 'wpn-mortar-pod']);
});

test('a build that breaks a limit is accepted and reported', () => {
  const flow = new GarageFlow(rich('head-bulwark', 'core-bulwark', 'arms-bulwark'), CATALOG);
  for (const [slot, id] of [['head', 'head-bulwark'], ['core', 'core-bulwark'], ['arms', 'arms-bulwark']]) {
    openSlot(flow, slot);
    pick(flow, id);
    if (id === 'arms-bulwark') expect(flow.previewErrors).toContain('overweight');
    expect(flow.onInput('confirm')).toBe('changed');
  }
  expect(flow.errors).toEqual(['overweight']);
  expect(flow.stats.weight).toBeGreaterThan(flow.stats.capacity);
});

test('the preview equals the current statistics while browsing slots', () => {
  const flow = new GarageFlow(fresh(), CATALOG);
  expect(flow.preview).toEqual(flow.stats);
  expect(flow.previewBuild).toEqual(flow.game.build);
  expect(flow.errors).toEqual([]);
});

test('the slot cursor stays on the slot that was edited', () => {
  const flow = new GarageFlow(rich('wpn-mortar-pod'), CATALOG);
  openSlot(flow, 'shoulder');
  pick(flow, 'wpn-mortar-pod');
  press(flow, 'confirm');
  expect(flow.slots.selected?.id).toBe('shoulder');
  expect(flow.slot).toBe('shoulder');
});

test('the flow never changes the game it was given', () => {
  const game = rich('head-halo');
  const before = structuredClone(game);
  const flow = new GarageFlow(game, CATALOG);
  openSlot(flow, 'head');
  pick(flow, 'head-halo');
  press(flow, 'confirm');
  expect(game).toEqual(before);
});

test('armour totals the frame parts', () => {
  expect(new GarageFlow(fresh(), CATALOG).armour(STARTER_BUILD)).toBe(60 + 220 + 110 + 150);
});

test('the build panel also knows cooling, boosted evasion and what a full volley costs', () => {
  const flow = new GarageFlow(rich('wpn-arc-pistol', 'wpn-mortar-pod', 'bst-vector'), CATALOG);
  expect(flow.details(flow.game.build)).toEqual({ cooling: 25, evasion: 18 + 30, volley: 60 });
  const armed = { ...flow.game.build, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod', booster: 'bst-vector' };
  expect(flow.details(armed)).toEqual({ cooling: 25, evasion: 14 + 38, volley: 60 + 90 + 80 });
});

test('a mech that cannot boost has only its mobility to evade with', () => {
  const flow = new GarageFlow(rich('legs-crawler'), CATALOG);
  const tracked = { ...flow.game.build, legs: 'legs-crawler' };
  expect(flow.details(tracked).evasion).toBe(flow.statsOf(tracked).mobility);
});

describe('paint', () => {
  test('L1 and R1 on the slot list step through factory colours and every scheme, and wrap', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    expect(flow.game.paint).toBe('factory');
    expect(flow.paintName).toBe('Factory');
    expect(flow.onInput('next')).toBe('changed');
    expect(flow.game.paint).toBe(PAINTS[0].id);
    expect(flow.paintName).toBe(PAINTS[0].name);
    expect(flow.onInput('prev')).toBe('changed');
    expect(flow.onInput('prev')).toBe('changed');
    expect(flow.game.paint).toBe(PAINTS.at(-1)!.id);
    for (let i = 0; i < PAINTS.length; i++) flow.onInput('prev');
    expect(flow.game.paint).toBe('factory');
  });

  test('a scheme this version does not know is shown as factory and steps on from there', () => {
    const flow = new GarageFlow({ ...fresh(), paint: 'plaid' }, CATALOG);
    expect(flow.paintName).toBe('Factory');
    flow.onInput('next');
    expect(flow.game.paint).toBe(PAINTS[0].id);
  });

  test('paint is not changed while choosing a part', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    openSlot(flow, 'head');
    expect(flow.onInput('next')).toBe('stay');
    expect(flow.game.paint).toBe('factory');
  });
});

describe('saved builds', () => {
  const toLoadouts = (flow: GarageFlow) => { flow.onInput('right'); expect(flow.mode).toBe('loadouts'); };
  const choose = (flow: GarageFlow, id: string) => {
    const list = flow.mode === 'loadouts' ? flow.loadouts : flow.loadoutMenu;
    for (let i = 0; i < 6 && list.selected?.id !== id; i++) flow.onInput('down');
    expect(list.selected?.id).toBe(id);
    return flow.onInput('confirm');
  };

  test('left or right from the slot list opens three slots, empty at first', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    toLoadouts(flow);
    expect(flow.loadouts.items.map((i) => [i.id, i.label])).toEqual([['0', '1  (empty)'], ['1', '2  (empty)'], ['2', '3  (empty)']]);
    flow.onInput('cancel');
    expect(flow.mode).toBe('slots');
    flow.onInput('left');
    expect(flow.mode).toBe('loadouts');
    flow.onInput('left');
    expect(flow.mode).toBe('slots');
  });

  test('a slot offers load, save and clear; an empty one only save', () => {
    const flow = new GarageFlow(fresh(), CATALOG);
    toLoadouts(flow);
    flow.onInput('confirm');
    expect(flow.mode).toBe('loadoutMenu');
    expect(flow.loadoutMenu.items.map((i) => [i.id, i.enabled])).toEqual([['load', false], ['save', true], ['clear', false], ['back', true]]);
    expect(flow.loadoutMenu.selected?.id).toBe('save');
  });

  test('saving names the slot after its core; loading brings the build back', () => {
    const flow = new GarageFlow(rich('core-bulwark', 'wpn-arc-pistol'), CATALOG);
    toLoadouts(flow);
    flow.onInput('confirm');
    expect(choose(flow, 'save')).toBe('changed');
    expect(flow.mode).toBe('loadouts');
    expect(flow.loadouts.items[0].label).toBe('1  Hauler Core');
    flow.onInput('cancel');

    // Change the mech, then load the saved one.
    openSlot(flow, 'core');
    pick(flow, 'core-bulwark');
    flow.onInput('confirm');
    expect(flow.game.build.core).toBe('core-bulwark');
    toLoadouts(flow);
    flow.onInput('confirm');
    expect(flow.loadoutMenu.selected?.id).toBe('load');
    expect(choose(flow, 'load')).toBe('changed');
    expect(flow.game.build.core).toBe('core-hauler');
    expect(flow.mode).toBe('slots');
    expect(flow.slots.items.find((i) => i.id === 'core')?.note).toBe('Hauler Core');
  });

  test('while a saved build is highlighted the mech and the numbers show it', () => {
    let game = rich('core-bulwark');
    game = saveLoadout(equip(game, 'core', 'core-bulwark', CATALOG), 1);
    game = equip(game, 'core', 'core-hauler', CATALOG);
    const flow = new GarageFlow(game, CATALOG);
    toLoadouts(flow);
    expect(flow.previewBuild).toBe(flow.game.build);
    flow.onInput('down');
    expect(flow.previewBuild.core).toBe('core-bulwark');
    expect(flow.preview.weight).toBeGreaterThan(flow.stats.weight);
  });

  test('a build whose part was sold cannot be loaded, and the menu names the part', () => {
    let game = rich('head-halo');
    game = saveLoadout(equip(game, 'head', 'head-halo', CATALOG), 0);
    game = sell(equip(game, 'head', 'head-scout-mk1', CATALOG), 'head-halo', CATALOG);
    const flow = new GarageFlow(game, CATALOG);
    toLoadouts(flow);
    flow.onInput('confirm');
    expect(flow.loadoutMenu.items[0]).toMatchObject({ id: 'load', enabled: false, note: 'Missing: Halo Visor' });
    expect(choose(flow, 'load')).toBe('stay');
    expect(flow.game.build.head).toBe('head-scout-mk1');
  });

  test('clearing empties the slot', () => {
    const flow = new GarageFlow(saveLoadout(fresh(), 2), CATALOG);
    toLoadouts(flow);
    flow.onInput('up');
    flow.onInput('confirm');
    expect(choose(flow, 'clear')).toBe('changed');
    expect(flow.game.loadouts).toEqual([null, null, null]);
    expect(flow.loadouts.items[2].label).toBe('3  (empty)');
  });

  test('back and cancel leave the menu without changing anything', () => {
    const flow = new GarageFlow(saveLoadout(fresh(), 0), CATALOG);
    toLoadouts(flow);
    flow.onInput('confirm');
    expect(choose(flow, 'back')).toBe('stay');
    expect(flow.mode).toBe('loadouts');
    flow.onInput('confirm');
    flow.onInput('cancel');
    expect(flow.mode).toBe('loadouts');
  });
});
