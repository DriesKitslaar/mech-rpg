import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { ALL } from '../helpers/testParts';

const turret = ENEMIES['gun-turret'];
const tower = ENEMIES['lance-tower'];
const mech = (extra: Partial<EnemyDef> = {}): EnemyDef => ({ id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD, ...extra });
const battle = (enemies: EnemyDef[], opts: BattleOptions = {}): BattleState => createBattle(DEMO_BUILD, enemies, ALL, 1, opts);
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const flowOf = (state: BattleState) => settle(new BattleFlow(state, ALL, {}));
function pick(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
  flow.onInput('confirm');
}
/** Opens the list of what a weapon can be aimed at. */
function aim(flow: BattleFlow, weapon: 'rightHand' | 'leftHand' | 'shoulder'): void {
  pick(flow, 'fire');
  pick(flow, weapon);
  expect(flow.phase).toBe('target');
}
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };

describe('where a weapon is aimed when its list opens', () => {
  test('with nothing else to go by, at the first enemy standing', () => {
    const flow = flowOf(battle([turret, tower, turret]));
    aim(flow, 'rightHand');
    expect(flow.targetId).toBe('enemy-0');
    expect(flow.targetChoice).toEqual({ at: 1, of: 3 });
  });

  test('at the enemy the contract names, wherever it stands in the line', () => {
    const flow = flowOf(battle([turret, tower, turret], { objective: { type: 'leader', target: 1 } }));
    aim(flow, 'rightHand');
    expect(flow.targetId).toBe('enemy-1');
    expect(flow.targetChoice).toEqual({ at: 2, of: 3 });
  });

  test('at the enemy fired at last: a second weapon follows the first', () => {
    const flow = flowOf(battle([turret, tower, turret]));
    aim(flow, 'rightHand');
    flow.onInput('next');
    flow.onInput('next');
    expect(flow.targetId).toBe('enemy-2');
    flow.onInput('confirm');
    settle(flow);
    aim(flow, 'leftHand');
    expect(flow.targetId).toBe('enemy-2');
  });

  test('the pilot\'s own choice outranks the contract\'s, and holds over the turns that follow', () => {
    const flow = flowOf(battle([turret, tower, turret], { objective: { type: 'leader', target: 1 } }));
    aim(flow, 'rightHand');
    flow.onInput('prev');
    expect(flow.targetId).toBe('enemy-0');
    flow.onInput('confirm');
    settle(flow);
    aim(flow, 'leftHand');
    expect(flow.targetId).toBe('enemy-0');
    flow.onInput('confirm');
    settle(flow);
    pick(flow, 'endTurn');
    settle(flow);
    aim(flow, 'rightHand');
    expect(flow.targetId).toBe('enemy-0');
  });

  test('once that enemy is gone: the one the contract names, else the first still standing', () => {
    const named = battle([turret, tower, turret], { objective: { type: 'leader', target: 2 } });
    const flow = flowOf(named);
    aim(flow, 'rightHand');
    flow.onInput('prev');
    flow.onInput('prev');
    expect(flow.targetId).toBe('enemy-0');
    flow.onInput('confirm');
    settle(flow);
    // The turret fired at is destroyed by something else before the next shot.
    flow.state = edit(flow.state, (d) => { d.units[1].destroyed = true; d.units[1].parts.core!.ap = 0; });
    aim(flow, 'leftHand');
    expect(flow.targetId).toBe('enemy-2');
    expect(flow.targetChoice).toEqual({ at: 2, of: 2 });
  });

  test('a single enemy is the only choice there is', () => {
    const flow = flowOf(battle([turret]));
    aim(flow, 'rightHand');
    expect(flow.targetChoice).toEqual({ at: 1, of: 1 });
  });
});

describe('which part a weapon is aimed at when its list opens', () => {
  test('the core, as a rule: the easiest to hit and the one that finishes it', () => {
    const flow = flowOf(battle([mech()]));
    aim(flow, 'rightHand');
    expect(flow.targetPart).toBe('core');
  });

  test('a machine the client wants in one piece is aimed at by its legs, then by its arms, and not by its core', () => {
    const wanted = battle([mech(), turret], { objective: { type: 'disable', target: 0 } });
    const flow = flowOf(wanted);
    aim(flow, 'rightHand');
    expect(flow.targetId).toBe('enemy-0');
    expect(flow.targetPart).toBe('legs');
    // The enemy beside it is not wanted in one piece.
    flow.onInput('next');
    expect(flow.targetId).toBe('enemy-1');
    expect(flow.targetPart).toBe('core');
    flow.onInput('cancel');
    flow.onInput('cancel');
    flow.state = edit(flow.state, (d) => { d.units[1].parts.legs!.ap = 0; });
    aim(flow, 'rightHand');
    expect(flow.targetPart).toBe('arms');
  });
});
