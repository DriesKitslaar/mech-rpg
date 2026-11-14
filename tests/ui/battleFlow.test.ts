import { createBattle, previewShot, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';

const intro = (seed = 1): BattleState => createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, seed);

/** Plays out queued messages and enemy turns until the player may act (or the battle is over). */
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 500) flow.advance();
  return flow;
}
const ready = (state: BattleState = intro()) => settle(new BattleFlow(state, CATALOG));
/** Moves the cursor to a menu item, giving up after one lap so a missing item fails instead of hanging. */
function toItem(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
}
const press = (flow: BattleFlow, ...actions: Parameters<BattleFlow['onInput']>[0][]) => actions.forEach((a) => flow.onInput(a));

test('duplicate enemies get distinguishing names', () => {
  expect(intro().units.map((u) => u.name)).toEqual(['You', 'Recon Drone A', 'Recon Drone B']);
});

test('the player turn opens on the action menu', () => {
  const flow = ready();
  expect(flow.phase).toBe('action');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['fire', 'boost', 'cool', 'repair', 'endTurn', 'retreat']);
  expect(flow.menu.items.map((i) => i.label)).toEqual(['Fire', 'Boost', 'Cool', 'Field Repair', 'End Turn', 'Retreat']);
  expect(flow.menu.cursor).toBe(0);
});

test('field repair is disabled while nothing is damaged', () => {
  const menu = ready(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)).menu;
  expect(menu.items.find((i) => i.id === 'repair')!.enabled).toBe(false);
  expect(menu.items.find((i) => i.id === 'fire')!.enabled).toBe(true);
});

test('fire leads through weapon choice to targeting with a preview', () => {
  const flow = ready();
  press(flow, 'confirm');
  expect(flow.phase).toBe('weapon');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['rightHand', 'leftHand', 'shoulder']);
  expect(flow.menu.items[0].label).toContain('Rivet Rifle');
  press(flow, 'confirm');
  expect(flow.phase).toBe('target');
  expect(flow.targetId).toBe('enemy-0');
  expect(flow.targetPart).toBe('core');
  expect(flow.preview).toEqual(previewShot(flow.state, 'player', 'rightHand', 'enemy-0', 'core', CATALOG));
});

test('targeting cycles enemies and parts, and cancel steps back', () => {
  const flow = ready();
  press(flow, 'confirm', 'confirm', 'next');
  expect(flow.targetId).toBe('enemy-1');
  press(flow, 'down');
  expect(flow.targetPart).toBe('legs');
  expect(flow.preview).toEqual(previewShot(flow.state, 'player', 'rightHand', 'enemy-1', 'legs', CATALOG));
  press(flow, 'prev');
  expect(flow.targetId).toBe('enemy-0');
  expect(flow.targetPart).toBe('core');
  press(flow, 'cancel');
  expect(flow.phase).toBe('weapon');
  press(flow, 'cancel');
  expect(flow.phase).toBe('action');
});

test('menus wrap around', () => {
  const flow = ready();
  press(flow, 'up');
  expect(flow.menu.items[flow.menu.cursor].id).toBe('retreat');
  press(flow, 'down');
  expect(flow.menu.items[flow.menu.cursor].id).toBe('fire');
});

test('confirming a shot applies it and reports the result', () => {
  const flow = ready();
  press(flow, 'confirm', 'confirm', 'confirm');
  expect(flow.state.units[0].ammo.rightHand).toBe(29);
  expect(flow.message).toMatch(/Rivet Rifle (hits|misses)/);
  settle(flow);
  expect(flow.phase).toBe('action');
  press(flow, 'confirm');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['leftHand', 'shoulder']);
});

test('a disabled menu item does nothing and ending the turn passes play', () => {
  const state = ready().state;
  const drained = structuredClone(state);
  drained.units[0].energy = 0;
  drained.units[0].repairsLeft = 0;
  const flow = ready(drained);
  expect(flow.menu.items.find((i) => i.id === 'fire')!.enabled).toBe(false);
  expect(flow.menu.items[flow.menu.cursor].id).toBe('endTurn');
  while (flow.menu.items[flow.menu.cursor].id !== 'fire') press(flow, 'down');
  press(flow, 'confirm');
  expect(flow.phase).toBe('action');
  while (flow.menu.items[flow.menu.cursor].id !== 'endTurn') press(flow, 'down');
  const round = flow.state.round;
  press(flow, 'confirm');
  settle(flow);
  expect(flow.state.round).toBe(round + 1);
});

test('field repair lists damaged parts and repairs the chosen one', () => {
  const state = structuredClone(ready(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)).state);
  state.units[0].parts.legs!.ap = 50;
  const flow = ready(state);
  while (flow.menu.items[flow.menu.cursor].id !== 'repair') press(flow, 'down');
  press(flow, 'confirm');
  expect(flow.phase).toBe('repairPart');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['legs']);
  press(flow, 'confirm');
  expect(flow.state.units[0].parts.legs!.ap).toBe(110);
  expect(flow.message).toContain('repair');
});

test('a battle played through the menus reaches a result that matches the outcome', () => {
  const flow = new BattleFlow(intro(3), CATALOG);
  let steps = 0;
  while (flow.phase !== 'result' && steps++ < 5000) {
    if (flow.phase === 'animating') { flow.advance(); continue; }
    if (flow.menu.items[0].enabled) { press(flow, 'confirm', 'confirm', 'confirm'); continue; }
    while (flow.menu.items[flow.menu.cursor].id !== 'endTurn') press(flow, 'down');
    press(flow, 'confirm');
  }
  expect(flow.phase).toBe('result');
  expect(flow.state.outcome).not.toBe('ongoing');
  expect(flow.message).toBe(flow.state.outcome === 'victory' ? 'VICTORY' : 'DEFEAT');
});

test('input during enemy turns is ignored', () => {
  const flow = new BattleFlow(intro(), CATALOG);
  expect(flow.phase).toBe('animating');
  const before = structuredClone(flow.state);
  press(flow, 'confirm', 'down', 'cancel');
  expect(flow.state).toEqual(before);
});

test('weapon labels show the heat each shot adds', () => {
  const flow = ready();
  press(flow, 'confirm');
  expect(flow.menu.items[0].label).toContain('HEAT 12');
});

test('targeting warns when the shot would overheat the mech', () => {
  const cool = ready();
  press(cool, 'confirm', 'confirm');
  expect(cool.overheatWarning).toBe(false);

  const hotState = structuredClone(ready().state);
  hotState.units[0].heat = 95;
  const hot = ready(hotState);
  press(hot, 'confirm', 'confirm');
  expect(hot.phase).toBe('target');
  expect(hot.overheatWarning).toBe(true);
  expect(hot.message).toBe('Warning: this shot will overheat');
  press(hot, 'cancel');
  expect(hot.overheatWarning).toBe(false);
});

test('a hit on a destroyed part is reported as core damage', () => {
  const state = structuredClone(ready().state);
  state.units[1].parts.legs!.ap = 0;
  const flow = ready(state);
  press(flow, 'confirm', 'confirm', 'down');
  expect(flow.targetPart).toBe('legs');
  expect(flow.preview!.damage).toBe(19);
});

test('retreat asks first, with no selected, and then ends the battle in defeat', () => {
  const flow = ready();
  toItem(flow, 'retreat');
  press(flow, 'confirm');
  expect(flow.phase).toBe('confirmRetreat');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['no', 'yes']);
  expect(flow.menu.cursor).toBe(0);
  press(flow, 'confirm');
  expect(flow.phase).toBe('action');
  expect(flow.state.outcome).toBe('ongoing');

  toItem(flow, 'retreat');
  press(flow, 'confirm', 'down', 'confirm');
  settle(flow);
  expect(flow.state.outcome).toBe('defeat');
  expect(flow.phase).toBe('result');
  expect(flow.message).toBe('DEFEAT');
});

test('cancel backs out of the retreat question', () => {
  const flow = ready();
  toItem(flow, 'retreat');
  press(flow, 'confirm', 'cancel');
  expect(flow.phase).toBe('action');
});
