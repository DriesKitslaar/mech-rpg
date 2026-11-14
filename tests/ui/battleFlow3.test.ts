import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import type { TalkLine } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { BattleFlow, type FlowOptions } from '../../src/ui/battleFlow';
import { ALL } from '../helpers/testParts';

const turret = ENEMIES['gun-turret'];
const mech = (extra: Partial<EnemyDef> = {}): EnemyDef => ({ id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD, ...extra });
const battle = (enemies: EnemyDef[] = [turret], opts: BattleOptions = {}): BattleState => createBattle(DEMO_BUILD, enemies, ALL, 1, opts);
/** Plays out queued messages and enemy turns until something waits for the player (or the battle is over). */
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const flowOf = (state: BattleState, opts: FlowOptions = {}) => settle(new BattleFlow(state, ALL, opts));
function pick(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
  flow.onInput('confirm');
}
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };
/** Fires the right-hand weapon at the core of the enemy it is aimed at when its list opens. */
function shoot(flow: BattleFlow): void {
  pick(flow, 'fire');
  pick(flow, 'rightHand');
  // The list opens on the core, except for a machine wanted in one piece.
  pick(flow, 'core');
}
const line = (at: TalkLine['at'], text: string, who = 'Dispatch'): TalkLine => ({ at, who, text });

describe('talk', () => {
  test('a battle opens with what is said at its start, one line a press, before anything else happens', () => {
    const flow = new BattleFlow(battle(), ALL, { talk: [line('start', 'One.'), { ...line('start', 'Two.', 'Ashfall'), portrait: 'portrait-rival' }, line('win', 'Done.')] });
    expect(flow.phase).toBe('talk');
    expect(flow.spoken).toEqual({ who: 'Dispatch', text: 'One.' });
    flow.onInput('cancel');
    flow.onInput('down');
    expect(flow.spoken).toEqual({ who: 'Dispatch', text: 'One.' });
    flow.onInput('confirm');
    expect(flow.spoken).toEqual({ who: 'Ashfall', portrait: 'portrait-rival', text: 'Two.' });
    flow.onInput('confirm');
    expect(flow.spoken).toBeNull();
    expect(flow.phase).toBe('animating');
    expect(settle(flow).phase).toBe('action');
  });

  test('what belongs to a round is said when the player\'s turn in that round begins, and only once', () => {
    const flow = flowOf(battle(), { talk: [line(2, 'Second round.')] });
    expect(flow.phase).toBe('action');
    pick(flow, 'guard');
    settle(flow);
    expect(flow.phase).toBe('action');
    pick(flow, 'endTurn');
    settle(flow);
    expect(flow.state.round).toBe(2);
    expect(flow.phase).toBe('talk');
    expect(flow.spoken?.text).toBe('Second round.');
    flow.onInput('confirm');
    expect(flow.phase).toBe('action');
    pick(flow, 'guard');
    settle(flow);
    expect(flow.phase).toBe('action');
  });

  test('a line for a round the pilot sat out is said on the next turn they get, before that round\'s own', () => {
    const flow = flowOf(battle(), { talk: [line(2, 'Second round.'), line(3, 'Third round.'), line(4, 'Fourth round.')] });
    expect(flow.state.round).toBe(1);
    // Overheated in the first round: the second passes without a turn for the pilot.
    flow.state = edit(flow.state, (d) => { d.units[0].overheated = true; });
    pick(flow, 'endTurn');
    settle(flow);
    expect(flow.state.round).toBe(3);
    expect(flow.phase).toBe('talk');
    expect(flow.spoken?.text).toBe('Second round.');
    flow.onInput('confirm');
    expect(flow.spoken?.text).toBe('Third round.');
    flow.onInput('confirm');
    expect(flow.phase).toBe('action');
    pick(flow, 'endTurn');
    settle(flow);
    expect(flow.spoken?.text).toBe('Fourth round.');
    flow.onInput('confirm');
    expect(flow.phase).toBe('action');
  });

  test('a boss says its line as its phase begins, and the battle waits for it', () => {
    const boss = mech({ name: 'Sable', portrait: 'portrait-sable', phases: [{ at: 0.5, damage: 1.2, line: 'Now I am awake.' }] });
    const flow = flowOf(edit(battle([boss]), (d) => { d.units[1].parts.core!.ap = 115; }));
    shoot(flow);
    settle(flow);
    expect(flow.phase).toBe('talk');
    expect(flow.spoken).toEqual({ who: 'Sable', portrait: 'portrait-sable', text: 'Now I am awake.' });
    expect(flow.message).toBe('Sable changes tactics');
    flow.onInput('confirm');
    expect(settle(flow).phase).toBe('action');
  });

  test('what is said after a win comes before the result, and nothing is said after a defeat', () => {
    const won = flowOf(edit(battle(), (d) => { d.units[1].parts.core!.ap = 1; }), { talk: [line('win', 'Paid in full.')] });
    shoot(won);
    settle(won);
    expect(won.state.outcome).toBe('victory');
    expect(won.phase).toBe('talk');
    won.onInput('confirm');
    expect(won.phase).toBe('result');
    const lost = flowOf(battle(), { talk: [line('win', 'Paid in full.')] });
    pick(lost, 'retreat');
    pick(lost, 'yes');
    expect(settle(lost).phase).toBe('result');
  });

  test('a quiet battle says nothing at all', () => {
    const boss = mech({ phases: [{ at: 0.5, line: 'Now I am awake.' }] });
    const flow = flowOf(edit(battle([boss]), (d) => { d.units[1].parts.core!.ap = 115; }), { quiet: true, talk: [line('start', 'One.'), line(1, 'Two.')] });
    expect(flow.phase).toBe('action');
    shoot(flow);
    expect(settle(flow).phase).toBe('action');
    expect(flow.spoken).toBeNull();
  });
});

describe('the objective on screen', () => {
  test('a plain fight shows none', () => {
    expect(flowOf(battle()).objective).toBeNull();
  });

  test('holding out shows the round against the rounds to last', () => {
    expect(flowOf(battle([turret], { objective: { type: 'survive', rounds: 6 } })).objective)
      .toEqual({ text: 'HOLD OUT 1/6', meter: { value: 1, max: 6 } });
  });

  test('protecting shows what is left of the asset', () => {
    const flow = flowOf(battle([turret, turret], { objective: { type: 'protect', name: 'Convoy', hp: 7 } }));
    expect(flow.objective).toEqual({ text: 'CONVOY 7/7', meter: { value: 7, max: 7 } });
    pick(flow, 'endTurn');
    expect(settle(flow).objective).toEqual({ text: 'CONVOY 5/7', meter: { value: 5, max: 7 } });
  });

  test('a named enemy is named, and marked', () => {
    expect(flowOf(battle([turret, mech()], { objective: { type: 'leader', target: 1 } })).objective).toEqual({ text: 'TARGET: TEST MECH', target: 'enemy-1' });
    expect(flowOf(battle([mech()], { objective: { type: 'disable', target: 0 } })).objective).toEqual({ text: 'DISABLE: TEST MECH', target: 'enemy-0' });
  });

  test('driving off shows how much armour stands between the enemy and leaving', () => {
    const flow = flowOf(battle([mech()], { objective: { type: 'driveOff', target: 0, share: 0.5 } }));
    expect(flow.objective).toEqual({ text: 'DRIVE OFF: TEST MECH', target: 'enemy-0', meter: { value: 110, max: 110 } });
    shoot(flow);
    expect(settle(flow).objective!.meter).toEqual({ value: 80, max: 110 });
  });
});

describe('why a battle ended', () => {
  /** Shoots turn after turn (a shot can miss) until the battle is over. */
  function fight(state: BattleState): BattleFlow {
    const flow = flowOf(state);
    for (let turn = 0; turn < 40 && flow.phase !== 'result'; turn++) {
      if (flow.menu.items.find((i) => i.id === 'fire')?.enabled) shoot(flow);
      else pick(flow, 'endTurn');
      settle(flow);
    }
    return flow;
  }
  const then = (state: BattleState, act: (flow: BattleFlow) => void): BattleFlow => {
    const flow = flowOf(state);
    act(flow);
    return settle(flow);
  };
  const core = (state: BattleState, ap: number) => edit(state, (d) => { d.units[1].parts.core!.ap = ap; });

  test('is said when the objective decided it', () => {
    expect(fight(core(battle([mech()], { objective: { type: 'disable', target: 0 } }), 1))).toMatchObject({ phase: 'result', resultNote: 'The target was destroyed.' });
    expect(fight(core(battle([turret, turret], { objective: { type: 'leader', target: 0 } }), 1)).resultNote).toBe('Their leader is down.');
    expect(fight(core(battle([mech()], { objective: { type: 'driveOff', target: 0, share: 0.5 } }), 111)).resultNote).toBe('Test Mech breaks off.');
    const sturdy = edit(battle([turret, turret], { objective: { type: 'protect', name: 'Convoy', hp: 2 } }), (d) => {
      d.units[0].parts.core!.ap = 9999;
      d.units[0].parts.core!.maxAp = 9999;
    });
    expect(then(sturdy, (flow) => pick(flow, 'endTurn')).resultNote).toBe('Convoy: lost.');
    expect(then(battle([turret], { objective: { type: 'survive', rounds: 1 } }), (flow) => pick(flow, 'endTurn')).resultNote).toBe('You held the line.');
  });

  test('is left unsaid when it is plain: everything destroyed, or the mech given up', () => {
    expect(fight(core(battle(), 1)).resultNote).toBe('');
    expect(then(battle(), (flow) => { pick(flow, 'retreat'); pick(flow, 'yes'); }).resultNote).toBe('');
  });
});

describe('parts by another name', () => {
  const machine = mech({ name: 'Strip-Miner', partNames: { core: 'Hull', legs: 'Tread', arms: 'Drill' } });

  test('the target menu and the messages use the names the enemy gives its parts', () => {
    const flow = flowOf(battle([machine]));
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    expect(flow.menu.items.map((i) => i.label)).toEqual(['Hull', 'Tread', 'Drill', 'Head']);
    flow.onInput('down');
    flow.onInput('confirm');
    expect(flow.message).toMatch(/^Rivet Rifle (hits Strip-Miner - Tread -\d+|misses Strip-Miner)$/);
  });
});
