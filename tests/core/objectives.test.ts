import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import {
  ROUND_LIMIT, activeUnit, applyAction, checkAction, createBattle, previewShot,
  type Action, type BattleState, type Objective, type UnitState,
} from '../../src/core/battle';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

const END: Action = { type: 'endTurn' };
const hit = () => 0;
const battle = (enemies: (string | EnemyDef)[], objective?: Objective, seed = 1): BattleState =>
  createBattle(DEMO_BUILD, enemies.map((e) => (typeof e === 'string' ? ENEMIES[e] : e)), CATALOG, seed, objective ? { objective } : {});
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const act = (s: BattleState, action: Action) => applyAction(s, action, CATALOG, hit);
function to(s: BattleState, id: string): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== id && s.outcome === 'ongoing' && guard++ < 20) s = act(s, END);
  return s;
}
/** Everybody ends their turn until the round number changes (or the battle ends). */
function passRound(s: BattleState): BattleState {
  const round = s.round;
  let guard = 0;
  while (s.round === round && s.outcome === 'ongoing' && guard++ < 20) s = act(s, END);
  return s;
}
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };
const kill = (s: BattleState, id: string): BattleState => {
  const ready = edit(to(s, 'player'), (d) => { const u = unit(d, id); u.parts.core!.ap = 1; if (u.parts.legs) u.parts.legs.ap = 0; d.units[0].energy = 999; d.units[0].fired = []; });
  return act(ready, { type: 'fire', weapon: 'rightHand', target: id, part: 'core' });
};
const mech = (extra: Partial<EnemyDef> = {}): EnemyDef => ({ id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD, ...extra });

test('without an objective a battle is won by destroying everything, as it always was', () => {
  const s = battle(['recon-drone']);
  expect(s.objective).toEqual({ type: 'destroy' });
  expect(kill(s, 'enemy-0').outcome).toBe('victory');
});

describe('survive', () => {
  const start = () => battle(['gun-turret', 'gun-turret'], { type: 'survive', rounds: 3 });

  test('is won when the last of the rounds is over, not before', () => {
    let s = passRound(passRound(start()));
    expect([s.round, s.outcome]).toEqual([3, 'ongoing']);
    s = passRound(s);
    expect(s.outcome).toBe('victory');
    expect(s.round).toBe(3);
  });

  test('is also won by destroying everything early', () => {
    expect(kill(kill(start(), 'enemy-0'), 'enemy-1').outcome).toBe('victory');
  });

  test('is lost like any battle when the mech is destroyed', () => {
    let s = edit(to(start(), 'enemy-0'), (d) => { d.units[0].parts.core!.ap = 1; });
    s = act(s, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
    expect(s.outcome).toBe('defeat');
  });
});

describe('protect', () => {
  const start = () => battle(['recon-drone', 'recon-drone', 'gun-turret'], { type: 'protect', name: 'Convoy', hp: 7 });

  test('the asset starts whole and loses one for each living enemy when a new round begins', () => {
    let s = start();
    expect(s.asset).toEqual({ name: 'Convoy', hp: 7, maxHp: 7 });
    s = passRound(s);
    expect(s.asset!.hp).toBe(4);
    expect(s.events.filter((e) => e.type === 'asset')).toEqual([{ type: 'asset', hp: 4, lost: 3 }]);
    s = passRound(kill(s, 'enemy-0'));
    expect(s.asset!.hp).toBe(2);
  });

  test('is lost when the asset is gone', () => {
    let s = start();
    for (let i = 0; i < 3 && s.outcome === 'ongoing'; i++) s = passRound(s);
    expect(s.asset!.hp).toBe(0);
    expect(s.outcome).toBe('defeat');
  });

  test('is won by destroying every enemy while the asset still stands', () => {
    let s = start();
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = kill(s, id);
    expect(s.outcome).toBe('victory');
    expect(s.asset!.hp).toBeGreaterThan(0);
  });
});

describe('leader', () => {
  const start = () => battle(['recon-drone', 'gun-turret'], { type: 'leader', target: 1 });

  test('destroying the marked enemy wins, whoever else is left', () => {
    const s = kill(start(), 'enemy-1');
    expect(s.outcome).toBe('victory');
    expect(unit(s, 'enemy-0').destroyed).toBe(false);
  });

  test('destroying the others does not', () => {
    expect(kill(start(), 'enemy-0').outcome).toBe('ongoing');
  });
});

describe('disable', () => {
  const start = () => battle([mech()], { type: 'disable', target: 0 });
  const cripple = (s: BattleState, parts: ('legs' | 'arms')[]) => {
    let next = to(s, 'player');
    for (const part of parts) {
      next = edit(next, (d) => { unit(d, 'enemy-0').parts[part]!.ap = 1; d.units[0].energy = 999; d.units[0].fired = []; });
      next = act(next, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part });
    }
    return next;
  };

  test('is won when the target has lost its legs and its arms and its core still holds', () => {
    expect(cripple(start(), ['legs']).outcome).toBe('ongoing');
    const s = cripple(start(), ['legs', 'arms']);
    expect(s.outcome).toBe('victory');
    expect(unit(s, 'enemy-0').destroyed).toBe(false);
  });

  test('is lost when the target is destroyed: the client wanted it in one piece', () => {
    expect(kill(start(), 'enemy-0').outcome).toBe('defeat');
  });

  test('a target without arms or legs only has to lose the limbs it has', () => {
    const s = cripple(battle(['tank'], { type: 'disable', target: 0 }), ['legs']);
    expect(s.outcome).toBe('victory');
  });
});

describe('drive off', () => {
  test('is won when the target\'s core is down to the given share', () => {
    let s = to(battle([mech()], { type: 'driveOff', target: 0, share: 0.5 }), 'player');
    s = edit(s, (d) => { unit(d, 'enemy-0').parts.core!.ap = 125; d.units[0].energy = 999; });
    s = act(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
    expect(unit(s, 'enemy-0').parts.core!.ap).toBeLessThanOrEqual(110);
    expect(s.outcome).toBe('victory');
    expect(unit(s, 'enemy-0').destroyed).toBe(false);
  });
});

test('every objective still ends in defeat at the round limit', () => {
  for (const objective of [{ type: 'leader', target: 0 }, { type: 'disable', target: 0 }, { type: 'driveOff', target: 0, share: 0.5 }] as Objective[]) {
    let s = edit(battle([mech()], objective), (d) => { d.round = ROUND_LIMIT; });
    s = passRound(s);
    expect(s.outcome, objective.type).toBe('defeat');
  }
});

test('an objective that names an enemy the battle does not have is refused at the start', () => {
  expect(() => battle(['recon-drone'], { type: 'leader', target: 2 })).toThrow('objective names enemy 2');
});

describe('the automatic player plays to the objective', () => {
  const firstShot = (s: BattleState) => {
    const next = to(s, 'player');
    return chooseAutoPlayerAction(next, CATALOG);
  };

  test('goes for the leader, not the weakest', () => {
    expect(firstShot(battle(['recon-drone', 'gun-turret'], { type: 'leader', target: 1 }))).toMatchObject({ type: 'fire', target: 'enemy-1' });
    expect(firstShot(battle(['recon-drone', 'gun-turret']))).toMatchObject({ type: 'fire', target: 'enemy-0' });
  });

  test('shoots the limbs of a target it has to disable, and never its core or a limb that is already gone', () => {
    const s = battle([mech()], { type: 'disable', target: 0 });
    expect(firstShot(s)).toMatchObject({ type: 'fire', target: 'enemy-0', part: 'legs' });
    const legless = edit(s, (d) => { unit(d, 'enemy-0').parts.legs!.ap = 0; });
    expect(firstShot(legless)).toMatchObject({ type: 'fire', target: 'enemy-0', part: 'arms' });
  });

  test.each([
    ['survive', { type: 'survive', rounds: 4 }, ['recon-drone', 'recon-drone']],
    ['protect', { type: 'protect', name: 'Convoy', hp: 9 }, ['recon-drone', 'recon-drone']],
    ['leader', { type: 'leader', target: 1 }, ['recon-drone', 'gun-turret']],
    ['disable', { type: 'disable', target: 0 }, [mech()]],
    ['driveOff', { type: 'driveOff', target: 0, share: 0.5 }, [mech()]],
  ] as [string, Objective, (string | EnemyDef)[]][])('and can win a %s battle with legal actions only', (_name, objective, enemies) => {
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s = battle(enemies, objective, seed);
      let steps = 0;
      while (s.outcome === 'ongoing') {
        const action = (activeUnit(s).side === 'player' ? chooseAutoPlayerAction : chooseEnemyAction)(s, CATALOG);
        expect(checkAction(s, action, CATALOG)).toBeNull();
        s = applyAction(s, action, CATALOG);
        expect(++steps).toBeLessThan(4000);
      }
      if (s.outcome === 'victory') wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});

test('previews are unaffected by the objective', () => {
  const plain = to(battle(['gun-turret']), 'player');
  const led = to(battle(['gun-turret'], { type: 'leader', target: 0 }), 'player');
  expect(previewShot(led, 'player', 'rightHand', 'enemy-0', 'core', CATALOG)).toEqual(previewShot(plain, 'player', 'rightHand', 'enemy-0', 'core', CATALOG));
  expect(runBattle(led, CATALOG, chooseAutoPlayerAction).outcome).not.toBe('ongoing');
});
