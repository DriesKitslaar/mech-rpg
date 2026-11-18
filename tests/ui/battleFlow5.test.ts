import { createBattle, type BattleState } from '../../src/core/battle';
import type { TalkLine } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow, type FlowOptions } from '../../src/ui/battleFlow';
import { ALL } from '../helpers/testParts';

const turret = ENEMIES['gun-turret'];
const battle = (enemies: EnemyDef[]): BattleState => createBattle(DEMO_BUILD, enemies, ALL, 1);
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };
const line = (at: TalkLine['at'], text: string, cycle?: number): TalkLine => ({ at, who: 'Dispatch', text, ...(cycle === undefined ? {} : { cycle }) });

function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
/** Everything that is said before the pilot can act, in the order it is said. */
function heard(flow: BattleFlow): string[] {
  const lines: string[] = [];
  for (let guard = 0; guard < 40; guard++) {
    settle(flow);
    if (flow.phase !== 'talk') break;
    lines.push(flow.spoken!.text);
    flow.onInput('confirm');
  }
  return lines;
}
function pick(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
  flow.onInput('confirm');
}
/** What is said from the battle's opening to the pilot's first turn, and what at the turn after it. */
function twoTurns(state: BattleState, opts: FlowOptions): [string[], string[]] {
  const flow = new BattleFlow(state, ALL, opts);
  const first = heard(flow);
  expect(flow.phase).toBe('action');
  pick(flow, 'endTurn');
  const second = heard(flow);
  expect(flow.phase).toBe('action');
  return [first, second];
}
/** Two turrets of which the second is already down. */
const oneLeft = (): BattleState => edit(battle([turret, turret]), (d) => { d.units[2].destroyed = true; });
/** One turret, and the pilot's core with this much of its armour left, as a share. */
const coreAt = (share: (maxAp: number) => number, enemies: EnemyDef[] = [turret]): BattleState =>
  edit(battle(enemies), (d) => { const core = d.units[0].parts.core!; core.ap = share(core.maxAp); });

describe('a line for when one enemy is left', () => {
  const talk = [line('last', 'One left.')];

  test('is said at the pilot\'s turn once only one of several stands, and once only', () => {
    expect(twoTurns(oneLeft(), { talk })).toEqual([['One left.'], []]);
  });

  test('is not said while several stand', () => {
    expect(twoTurns(battle([turret, turret]), { talk })).toEqual([[], []]);
  });

  test('is not said in a battle that began with one enemy: there was never more than the last', () => {
    expect(twoTurns(battle([turret]), { talk })).toEqual([[], []]);
  });

  test('is kept until it is true: said at the turn after the second to last has fallen', () => {
    const flow = new BattleFlow(battle([turret, turret]), ALL, { talk });
    expect(heard(flow)).toEqual([]);
    flow.state = edit(flow.state, (d) => { d.units[2].destroyed = true; });
    pick(flow, 'endTurn');
    expect(heard(flow)).toEqual(['One left.']);
  });
});

describe('a moment is said as soon as the pilot can act again', () => {
  test('in the middle of a turn, when what left one enemy standing did not end the turn', () => {
    const flow = new BattleFlow(battle([turret, turret]), ALL, { talk: [line('last', 'One left.')] });
    expect(heard(flow)).toEqual([]);
    const round = flow.state.round;
    flow.state = edit(flow.state, (d) => { d.units[2].destroyed = true; });
    // Guarding leaves the turn going: the menu comes back, and the line comes with it rather than a round later.
    pick(flow, 'guard');
    expect(heard(flow)).toEqual(['One left.']);
    expect(flow.phase).toBe('action');
    expect(flow.state.round).toBe(round);
    // Said once: the end of the turn and the next one say nothing more.
    pick(flow, 'endTurn');
    expect(heard(flow)).toEqual([]);
  });
});

describe('once the battle is over', () => {
  const talk = [line('last', 'One left.'), line('hurt', 'You are leaking.'), line('win', 'Done.')];
  /** Two turrets of which one is down, and the pilot's core nearly gone: both moments have come, and neither has been said. */
  const both = (): BattleState => edit(coreAt(() => 1, [turret, turret]), (d) => { d.units[2].destroyed = true; });

  test('(both moments would have their say at the pilot\'s turn)', () => {
    expect(heard(new BattleFlow(both(), ALL, { talk }))).toEqual(['One left.', 'You are leaking.']);
  });

  test('a battle won with an enemy still standing says what is said of a win, and nothing of a last enemy or of a hurt pilot', () => {
    // As when the name on a notice is brought down and the rest go home, or a door has been held for its rounds.
    const flow = new BattleFlow(edit(both(), (d) => { d.outcome = 'victory'; }), ALL, { talk });
    expect(heard(flow)).toEqual(['Done.']);
    expect(flow.phase).toBe('result');
  });

  test('a battle that is lost says nothing at all: nobody says "you are leaking" over a core with no armour left', () => {
    const lost = edit(both(), (d) => { d.units[0].parts.core!.ap = 0; d.units[0].destroyed = true; d.outcome = 'defeat'; });
    const flow = new BattleFlow(lost, ALL, { talk });
    expect(heard(flow)).toEqual([]);
    expect(flow.phase).toBe('result');
  });
});

describe('a line for when the pilot is hurt', () => {
  const talk = [line('hurt', 'You are leaking.')];

  test('is said once the core is below half its armour, and once only', () => {
    expect(twoTurns(coreAt((max) => Math.ceil(max / 2) - 1), { talk })).toEqual([['You are leaking.'], []]);
  });

  test('is not said at half, or over it', () => {
    expect(twoTurns(coreAt((max) => Math.ceil(max / 2)), { talk })[0]).toEqual([]);
    expect(twoTurns(battle([turret]), { talk })[0]).toEqual([]);
  });
});

describe('what is said when', () => {
  test('the lines of the round come first, then the last enemy\'s, then the pilot\'s own', () => {
    const state = edit(oneLeft(), (d) => { d.units[0].parts.core!.ap = 1; });
    const talk = [line('hurt', 'hurt'), line('last', 'last'), line(1, 'round one'), line('start', 'start')];
    const flow = new BattleFlow(state, ALL, { talk });
    expect(heard(flow)).toEqual(['start', 'round one', 'last', 'hurt']);
  });

  test('a battle played without talk says none of it', () => {
    const state = edit(oneLeft(), (d) => { d.units[0].parts.core!.ap = 1; });
    const talk = [line('hurt', 'hurt'), line('last', 'last'), line(1, 'round one'), line('start', 'start')];
    expect(twoTurns(state, { talk, quiet: true })).toEqual([[], []]);
  });
});

describe('a line kept for a later cycle', () => {
  const talk = [line('start', 'again', 1), line('start', 'always'), line(1, 'round, again', 1), line('last', 'last, again', 2)];

  test('is not said in the first cycle, nor when no cycle is given', () => {
    expect(heard(new BattleFlow(oneLeft(), ALL, { talk }))).toEqual(['always']);
    expect(heard(new BattleFlow(oneLeft(), ALL, { talk, cycle: 0 }))).toEqual(['always']);
  });

  test('is said from its cycle on, in its place among the others', () => {
    expect(heard(new BattleFlow(oneLeft(), ALL, { talk, cycle: 1 }))).toEqual(['again', 'always', 'round, again']);
    expect(heard(new BattleFlow(oneLeft(), ALL, { talk, cycle: 2 }))).toEqual(['again', 'always', 'round, again', 'last, again']);
    expect(heard(new BattleFlow(oneLeft(), ALL, { talk, cycle: 5 }))).toEqual(['again', 'always', 'round, again', 'last, again']);
  });
});
