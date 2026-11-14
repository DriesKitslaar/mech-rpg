import { buy, newGame, type GameState } from '../../src/core/game';
import type { FramePart, Shield, Weapon } from '../../src/core/types';
import { CATALOG, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';
import type { InputAction } from '../../src/platform/input';
import { partLines } from '../../src/ui/partInfo';
import { SHOP_TABS, ShopFlow } from '../../src/ui/shopFlow';

const fresh = (credits = 1200): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits });
const shop = (game: GameState = fresh()) => new ShopFlow(game, CATALOG, SHOP_PARTS);
const press = (flow: ShopFlow, ...actions: InputAction[]) => actions.map((a) => flow.onInput(a));
const toTab = (flow: ShopFlow, tab: string) => { for (let i = 0; i < 12 && flow.tab !== tab; i++) flow.onInput('next'); expect(flow.tab).toBe(tab); };
const pick = (flow: ShopFlow, id: string) => { for (let i = 0; i < 20 && flow.list.selected?.id !== id; i++) flow.onInput('down'); expect(flow.list.selected?.id).toBe(id); };

test('there are ten tabs and they wrap in both directions', () => {
  expect(SHOP_TABS).toEqual(['head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs', 'module', 'hand', 'shoulder']);
  const flow = shop();
  expect(flow.tab).toBe('head');
  press(flow, 'prev');
  expect(flow.tab).toBe('shoulder');
  press(flow, 'next');
  expect(flow.tab).toBe('head');
});

test('each tab lists its stock with the price', () => {
  const flow = shop();
  expect(flow.list.items.map((i) => i.id)).toEqual([
    'head-scout-mk1', 'head-halo', 'head-bulwark', 'head-ronin', 'head-wraith', 'head-colossus', 'head-mantis',
  ]);
  expect(flow.list.items[1]).toMatchObject({ label: 'Halo Visor', note: '900', enabled: true });
  toTab(flow, 'hand');
  expect(flow.list.items).toHaveLength(25);
  expect(flow.list.items.slice(-3).map((i) => i.id)).toEqual(['shd-riot', 'shd-barrier', 'shd-tower']);
  toTab(flow, 'shoulder');
  expect(flow.list.items).toHaveLength(16);
  toTab(flow, 'generator');
  expect(flow.list.items).toHaveLength(8);
  toTab(flow, 'booster');
  expect(flow.list.items.map((i) => i.id)).toEqual(['bst-stock', 'bst-sprint', 'bst-vector', 'bst-ram', 'bst-glide', 'bst-after', 'bst-phase']);
  toTab(flow, 'fcs');
  expect(flow.list.items[0]).toMatchObject({ id: 'fcs-stock', label: 'Stock FCS (1)', note: '100' });
  toTab(flow, 'module');
  expect(flow.list.items).toHaveLength(11);
});

test('a shield is sold on the hand tab', () => {
  const shield: Shield = { id: 'shd-test', name: 'Test Shield', kind: 'shield', guard: 0.4, weight: 90, price: 500, vendor: 'hadron' };
  const flow = new ShopFlow(fresh(), { ...CATALOG, [shield.id]: shield }, [...SHOP_PARTS, shield]);
  toTab(flow, 'hand');
  expect(flow.list.items.at(-1)).toMatchObject({ id: 'shd-test', note: '500' });
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
  expect(partLines(CATALOG['wpn-rivet-rifle'])).toEqual(['Kinetic  DMG 38  ACC 75', 'EN 60  HEAT 12  IMP 38', 'WT 80  AMMO 30  15/shot']);
  expect(partLines(CATALOG['wpn-arc-pistol'])).toEqual(['Energy  DMG 30  ACC 80', 'EN 90  HEAT 22  IMP 15', 'WT 50  AMMO unlimited']);
  expect(partLines(CATALOG['bst-vector'])).toEqual(['THRUST 38  BOOST COST 30%', 'WT 50  DRAIN 15']);
  expect(partLines(CATALOG['fcs-lattice'])).toEqual(['AIM K/E/X +0/+8/+0', 'FOCUS 25%  WT 15  DRAIN 20']);
  expect(partLines(CATALOG['mod-coolant'])).toEqual(['Vents 60 heat at once.', 'USES 2  WT 30  DRAIN 0']);
  expect(partLines(CATALOG['mod-barrier'])).toEqual(['Absorbs the next 90 damage', 'until your next turn.', 'USES 1  WT 40  DRAIN 10']);
  expect(partLines({ id: 's', name: 'S', kind: 'shield', guard: 0.4, weight: 90, price: 1 })).toEqual(['GUARD: blocks 60%', 'WT 90']);
  for (const part of SHOP_PARTS) for (const line of partLines(part)) expect(line.length, `${part.id}: ${line}`).toBeLessThanOrEqual(28);
  expect(partLines(CATALOG['gen-prism'])).toEqual(['OUTPUT 520', 'COOLING 22  WT 90']);
  expect(partLines(CATALOG['legs-halo'])).toEqual(['AP 110  WT 140  DRAIN 55', 'RES K/E/X 10/25/5', 'LOAD 850  MOB 48']);
  expect(partLines(CATALOG['core-hauler'])).toHaveLength(2);
});

test('the last weapon cannot be sold, and the shop says why', () => {
  const unarmed = { ...fresh(), build: (({ rightHand: _r, ...rest }) => rest)(fresh().build) };
  const flow = shop(unarmed);
  toTab(flow, 'hand');
  press(flow, 'right');
  expect(flow.list.items).toMatchObject([{ id: 'wpn-rivet-rifle', enabled: false, note: 'Last weapon' }]);
  expect(flow.onInput('confirm')).toBe('stay');
  expect(flow.message).toBe('You need at least one weapon');
});

test('a part that is owned but not in stock can still be sold', () => {
  const owner = buy(fresh(5000), 'head-halo', CATALOG);
  const flow = new ShopFlow(owner, CATALOG, SHOP_PARTS.filter((p) => p.id !== 'head-halo'), SHOP_PARTS);
  expect(flow.list.items.map((i) => i.id)).not.toContain('head-halo');
  press(flow, 'right');
  expect(flow.list.items.map((i) => i.id)).toContain('head-halo');
});

test('the kind of legs and the way a weapon is used are described', () => {
  const quad = { ...(CATALOG['legs-strider'] as FramePart), legType: 'quad' as const };
  expect(partLines(quad).at(-1)).toBe('QUAD: steady, shoulder +6');
  expect(partLines({ ...(CATALOG['legs-strider'] as FramePart), legType: 'tank' }).at(-1)).toBe('TRACKS: no boost, guard 50%');
  const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
  expect(partLines({ ...rifle, charge: true }).at(-1)).toBe('CHARGE: fires a turn later');
  expect(partLines({ ...rifle, melee: true }).at(-1)).toBe('MELEE: needs Boost');
  expect(partLines({ ...rifle, trait: 'burst', traitPower: 3 }).at(-1)).toBe('BURST: fires 3 times');
  expect(partLines({ ...rifle, trait: 'salvo' }).at(-1)).toBe('SALVO: hits every enemy');
  expect(partLines({ ...rifle, impact: 140 })[1]).toBe('EN 60  HEAT 12  IMP 140');
});

test('a weapon\'s special effect is described', () => {
  expect(partLines(CATALOG['wpn-needler']).at(-1)).toBe('TWIN: fires twice');
  expect(partLines(CATALOG['wpn-void-rifle']).at(-1)).toBe('PIERCE: halves resistance');
  expect(partLines(CATALOG['wpn-thermal-lance']).at(-1)).toBe('THERMAL: +18 heat on target');
  expect(partLines(CATALOG['wpn-arc-caster']).at(-1)).toBe('DRAIN: -60 energy on target');
});
