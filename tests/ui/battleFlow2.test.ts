import { createBattle, type BattleState } from '../../src/core/battle';
import type { Build } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { ALL } from '../helpers/testParts';

const battle = (build: Build = DEMO_BUILD, enemies = ['gun-turret']): BattleState =>
  createBattle(build, enemies.map((id) => ENEMIES[id]), ALL, 1);

/** Plays out queued messages and enemy turns until the player may act (or the battle is over). */
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const ready = (state: BattleState) => settle(new BattleFlow(state, ALL));
function toItem(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
}
const pick = (flow: BattleFlow, id: string) => { toItem(flow, id); flow.onInput('confirm'); };
const item = (flow: BattleFlow, id: string) => flow.menu.items.find((i) => i.id === id)!;
const player = (flow: BattleFlow) => flow.state.units[0];

describe('the action menu', () => {
  test('lists guard and auto turn, and the module only when one is fitted', () => {
    expect(ready(battle()).menu.items.map((i) => i.id)).toEqual(['fire', 'boost', 'guard', 'cool', 'repair', 'endTurn', 'auto', 'retreat']);
    const flow = ready(battle({ ...DEMO_BUILD, module: 'mod-t-coolant' }));
    expect(flow.menu.items.map((i) => i.id)).toEqual(['fire', 'boost', 'guard', 'cool', 'module', 'repair', 'endTurn', 'auto', 'retreat']);
    expect(item(flow, 'module')).toMatchObject({ label: 'coolant x2', enabled: true });
  });

  test('guard braces and leaves the turn open; boost is then off the table', () => {
    const flow = ready(battle());
    pick(flow, 'guard');
    settle(flow);
    expect(player(flow).guarding).toBe(true);
    expect(flow.phase).toBe('action');
    expect(item(flow, 'boost').enabled).toBe(false);
    expect(item(flow, 'guard').enabled).toBe(false);
  });

  test('a used-up module is shown but cannot be chosen', () => {
    const flow = ready(battle({ ...DEMO_BUILD, module: 'mod-t-barrier' }));
    pick(flow, 'module');
    settle(flow);
    expect(player(flow).barrier).toBe(90);
    expect(item(flow, 'module')).toMatchObject({ label: 'barrier x0', enabled: false });
  });

  test('the painter asks which enemy to mark', () => {
    const flow = ready(battle({ ...DEMO_BUILD, module: 'mod-t-painter' }, ['gun-turret', 'tank']));
    pick(flow, 'module');
    expect(flow.phase).toBe('moduleTarget');
    expect(flow.menu.items.map((i) => [i.id, i.label])).toEqual([['enemy-0', 'Gun Turret'], ['enemy-1', 'Salvage Tank']]);
    flow.onInput('cancel');
    expect(flow.phase).toBe('action');
    pick(flow, 'module');
    pick(flow, 'enemy-1');
    settle(flow);
    expect(flow.state.units[2].painted).toBe(3);
  });
});

describe('the weapon menu', () => {
  test('lists every fitted weapon, and says why one cannot be fired', () => {
    const flow = ready(battle());
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    flow.onInput('confirm');
    settle(flow);
    pick(flow, 'fire');
    expect(flow.menu.items.map((i) => [i.id, i.enabled])).toEqual([['rightHand', false], ['leftHand', true], ['shoulder', true]]);
    expect(item(flow, 'rightHand').label).toBe('Rivet Rifle - fired');
    expect(flow.menu.cursor).toBe(1);
  });

  test('names the other reasons too', () => {
    const state = battle();
    state.units[0].ammo.rightHand = 0;
    state.units[0].energy = 85;
    const flow = ready(state);
    pick(flow, 'fire');
    expect(item(flow, 'rightHand').label).toBe('Rivet Rifle - no ammo');
    expect(item(flow, 'leftHand').label).toBe('Arc Pistol - no energy');
    expect(item(flow, 'shoulder').enabled).toBe(true);
    const armless = battle();
    armless.units[0].parts.arms!.ap = 0;
    const second = ready(armless);
    pick(second, 'fire');
    expect(item(second, 'rightHand').label).toBe('Rivet Rifle - arms destroyed');
  });

  test('a disabled weapon cannot be chosen', () => {
    const state = battle();
    state.units[0].ammo.rightHand = 0;
    const flow = ready(state);
    pick(flow, 'fire');
    flow.onInput('up');
    expect(flow.menu.items[flow.menu.cursor].id).toBe('rightHand');
    flow.onInput('confirm');
    expect(flow.phase).toBe('weapon');
  });

  test('a charge weapon is charged from the menu, and fired from it a turn later', () => {
    const flow = ready(battle({ ...DEMO_BUILD, rightHand: 'wpn-t-charge' }));
    pick(flow, 'fire');
    expect(item(flow, 'rightHand').label).toBe('wpn-t-charge x8 CHARGE EN 150');
    pick(flow, 'rightHand');
    settle(flow);
    expect(player(flow).charged).toEqual(['rightHand']);
    expect(flow.phase).toBe('action');
    pick(flow, 'endTurn');
    settle(flow);
    pick(flow, 'fire');
    expect(item(flow, 'rightHand').label).toBe('wpn-t-charge x8 READY HEAT 34');
    pick(flow, 'rightHand');
    expect(flow.phase).toBe('target');
    flow.onInput('confirm');
    settle(flow);
    expect(player(flow).ammo.rightHand).toBe(7);
  });

  test('a blade says it needs a boost, and works after one', () => {
    const flow = ready(battle({ ...DEMO_BUILD, rightHand: 'wpn-t-blade' }));
    pick(flow, 'fire');
    expect(item(flow, 'rightHand')).toMatchObject({ label: 'wpn-t-blade - needs Boost', enabled: false });
    flow.onInput('cancel');
    pick(flow, 'boost');
    settle(flow);
    pick(flow, 'fire');
    expect(item(flow, 'rightHand').enabled).toBe(true);
  });

  test('fire stays available while a weapon can still be charged', () => {
    const state = battle({ ...DEMO_BUILD, rightHand: 'wpn-t-charge', leftHand: undefined, shoulder: undefined });
    const flow = ready(state);
    expect(item(flow, 'fire').enabled).toBe(true);
  });
});

describe('auto turn', () => {
  test('plays the rest of the turn and hands the next one back', () => {
    const flow = ready(battle());
    const round = flow.state.round;
    pick(flow, 'auto');
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(flow.state.round).toBe(round + 1);
    expect(player(flow).fired).toEqual([]);
    expect(flow.state.events.filter((e) => e.type === 'shot' && e.unit === 'player').length).toBeGreaterThanOrEqual(3);
  });

  test('can finish a battle', () => {
    const state = battle(DEMO_BUILD, ['recon-drone']);
    state.units[1].parts.core!.ap = 1;
    state.units[1].parts.legs!.ap = 0;
    const flow = ready(state);
    pick(flow, 'auto');
    settle(flow);
    expect(flow.phase).toBe('result');
    expect(flow.state.outcome).toBe('victory');
  });
});

test('every new event has a message', () => {
  const flow = ready(battle({ ...DEMO_BUILD, module: 'mod-t-shock' }));
  const seen: string[] = [];
  pick(flow, 'module');
  for (let i = 0; i < 50 && flow.phase === 'animating'; i++) { seen.push(flow.message); flow.advance(); }
  expect(seen).toContain('You fire a shock pulse');
  pick(flow, 'guard');
  expect(flow.message).toBe('You brace');
});
