import { buy, newGame, type GameState } from '../../src/core/game';
import { CATALOG, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';
import type { InputAction } from '../../src/platform/input';
import { partLines } from '../../src/ui/partInfo';
import { SHOP_TABS, ShopFlow } from '../../src/ui/shopFlow';

const fresh = (credits = 1200): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits });
const shop = (game: GameState = fresh()) => new ShopFlow(game, CATALOG, SHOP_PARTS);
const press = (flow: ShopFlow, ...actions: InputAction[]) => actions.map((a) => flow.onInput(a));
const toTab = (flow: ShopFlow, tab: string) => { for (let i = 0; i < 8 && flow.tab !== tab; i++) flow.onInput('next'); expect(flow.tab).toBe(tab); };
const pick = (flow: ShopFlow, id: string) => { for (let i = 0; i < 20 && flow.list.selected?.id !== id; i++) flow.onInput('down'); expect(flow.list.selected?.id).toBe(id); };

test('there are seven tabs and they wrap in both directions', () => {
  expect(SHOP_TABS).toEqual(['head', 'core', 'arms', 'legs', 'generator', 'hand', 'shoulder']);
  const flow = shop();
  expect(flow.tab).toBe('head');
  press(flow, 'prev');
  expect(flow.tab).toBe('shoulder');
  press(flow, 'next');
  expect(flow.tab).toBe('head');
});

test('each tab lists its stock with the price', () => {
  const flow = shop();
  expect(flow.list.items.map((i) => i.id)).toEqual(['head-scout-mk1', 'head-halo', 'head-bulwark', 'head-ronin']);
  expect(flow.list.items[1]).toMatchObject({ label: 'Halo Visor', note: '900', enabled: true });
  toTab(flow, 'hand');
  expect(flow.list.items).toHaveLength(7);
  toTab(flow, 'shoulder');
  expect(flow.list.items).toHaveLength(4);
  toTab(flow, 'generator');
  expect(flow.list.items).toHaveLength(3);
});

test('buying deducts the price and reports it', () => {
  const flow = shop();
  pick(flow, 'head-halo');
  expect(flow.selected?.id).toBe('head-halo');
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.credits).toBe(300);
  expect(flow.game.inventory['head-halo']).toBe(1);
  expect(flow.message).toBe('Bought Halo Visor');
  expect(flow.list.selected?.id).toBe('head-halo');
});

test('what cannot be afforded is marked and cannot be bought', () => {
  const flow = shop(fresh(300));
  const helm = flow.list.items.find((i) => i.id === 'head-ronin')!;
  expect(helm).toMatchObject({ enabled: false, note: '1200' });
  pick(flow, 'head-ronin');
  expect(flow.onInput('confirm')).toBe('stay');
  expect(flow.game.credits).toBe(300);
  expect(flow.message).toBe('Not enough credits');
});

test('owned copies are shown next to the name', () => {
  const flow = shop(buy(fresh(), 'head-halo', CATALOG));
  expect(flow.list.items.find((i) => i.id === 'head-halo')?.label).toBe('Halo Visor (1)');
  expect(flow.list.items.find((i) => i.id === 'head-ronin')?.label).toBe('Ronin Helm');
});

test('sell mode lists owned parts and protects fitted ones', () => {
  const flow = shop(buy(fresh(), 'head-halo', CATALOG));
  press(flow, 'right');
  expect(flow.mode).toBe('sell');
  expect(flow.list.items.map((i) => [i.id, i.enabled, i.note])).toEqual([
    ['head-scout-mk1', false, 'In use'], ['head-halo', true, '+900'],
  ]);
  pick(flow, 'head-scout-mk1');
  expect(flow.onInput('confirm')).toBe('stay');
  expect(flow.message).toBe('In use');
  pick(flow, 'head-halo');
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.credits).toBe(1200);
  expect(flow.message).toBe('Sold Halo Visor +900');
  expect(flow.list.items.map((i) => i.id)).toEqual(['head-scout-mk1']);
});

test('left and right switch between buying and selling, and the tab is kept', () => {
  const flow = shop();
  toTab(flow, 'legs');
  press(flow, 'right');
  expect([flow.mode, flow.tab]).toEqual(['sell', 'legs']);
  press(flow, 'left');
  expect(flow.mode).toBe('buy');
  press(flow, 'left');
  expect(flow.mode).toBe('sell');
});

test('a tab with nothing to sell says so', () => {
  const flow = shop();
  toTab(flow, 'shoulder');
  press(flow, 'right');
  expect(flow.list.items).toEqual([{ id: '(empty)', label: 'Nothing to sell here', enabled: false }]);
  expect(flow.selected).toBeUndefined();
  expect(flow.onInput('confirm')).toBe('stay');
});

test('in debt nothing can be bought but selling still works', () => {
  const flow = shop({ ...buy(fresh(), 'wpn-arc-pistol', CATALOG), credits: -50 });
  toTab(flow, 'hand');
  expect(flow.list.items.every((i) => !i.enabled)).toBe(true);
  press(flow, 'right');
  pick(flow, 'wpn-arc-pistol');
  expect(flow.onInput('confirm')).toBe('changed');
  expect(flow.game.credits).toBe(550);
});

test('cancel leaves the shop and the message clears when moving on', () => {
  const flow = shop();
  pick(flow, 'head-halo');
  press(flow, 'confirm');
  press(flow, 'down');
  expect(flow.message).toBe('');
  expect(flow.onInput('cancel')).toBe('exit');
});

test('the shop never changes the game it was given', () => {
  const game = fresh();
  const before = structuredClone(game);
  const flow = shop(game);
  pick(flow, 'head-halo');
  press(flow, 'confirm');
  expect(game).toEqual(before);
});

test('part descriptions cover every kind of part', () => {
  expect(partLines(CATALOG['wpn-rivet-rifle'])).toEqual(['Kinetic  DMG 38  ACC 75', 'EN 60  HEAT 12  WT 80', 'AMMO 30  15 per shot']);
  expect(partLines(CATALOG['wpn-arc-pistol'])[2]).toBe('AMMO unlimited');
  expect(partLines(CATALOG['gen-prism'])).toEqual(['OUTPUT 520', 'COOLING 22  WT 90']);
  expect(partLines(CATALOG['legs-halo'])).toEqual(['AP 110  WT 140  DRAIN 55', 'RES K/E/X 10/25/5', 'LOAD 850  MOB 48']);
  expect(partLines(CATALOG['core-hauler'])).toHaveLength(2);
});
