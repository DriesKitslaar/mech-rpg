import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import { activeUnit, applyAction, checkAction, createBattle, type Action, type BattleState, type UnitState } from '../../src/core/battle';
import { nextRandom } from '../../src/core/rng';
import type { AiProfile, Build, EnemyDef, ModuleEffect } from '../../src/core/types';
import { ARENA_ENEMIES } from '../../src/content/arena';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { ALL } from '../helpers/testParts';

const END: Action = { type: 'endTurn' };
const hit = () => 0;
const mech = (build: Partial<Build>, ai: AiProfile = 'gunner'): EnemyDef =>
  ({ id: 'test-mech', name: 'Test Mech', ai, sprite: 'none', build: { ...STARTER_BUILD, ...build } });
const start = (enemy: EnemyDef, player: Build = DEMO_BUILD) => createBattle(player, [enemy], ALL, 1);
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
function to(s: BattleState, id: string): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== id && s.outcome === 'ongoing' && guard++ < 10) s = applyAction(s, END, ALL);
  return s;
}
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };
const enemyMove = (s: BattleState) => chooseEnemyAction(s, ALL);
const autoMove = (s: BattleState) => chooseAutoPlayerAction(s, ALL);
const apply = (s: BattleState, a: Action) => applyAction(s, a, ALL, hit);

describe('enemies', () => {
  test('charge a charge weapon, and fire it first thing the turn after', () => {
    let s = to(start(mech({ rightHand: 'wpn-t-charge' })), 'enemy-0');
    expect(enemyMove(s)).toEqual({ type: 'charge', weapon: 'rightHand' });
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toEqual(END);
    s = to(apply(s, END), 'enemy-0');
    expect(enemyMove(s)).toMatchObject({ type: 'fire', weapon: 'rightHand', target: 'player' });
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toEqual(END);
  });

  test('charge first and fire their other weapons with what energy is left', () => {
    let s = to(start(mech({ rightHand: 'wpn-t-charge', leftHand: 'wpn-rivet-rifle' })), 'enemy-0');
    expect(enemyMove(s)).toEqual({ type: 'charge', weapon: 'rightHand' });
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toMatchObject({ type: 'fire', weapon: 'leftHand' });
  });

  test('with a blade, boost in and strike when the energy covers both', () => {
    let s = to(start(mech({ rightHand: 'wpn-t-blade' })), 'enemy-0');
    expect(enemyMove(s)).toEqual({ type: 'boost' });
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toMatchObject({ type: 'fire', weapon: 'rightHand' });
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toEqual(END);
  });

  test('with a blade but not the energy for boost and strike, do not waste the boost', () => {
    const s = edit(to(start(mech({ rightHand: 'wpn-t-blade' })), 'enemy-0'), (d) => { unit(d, 'enemy-0').energy = 150; });
    expect(enemyMove(s)).toEqual(END);
  });

  test('guard with leftover energy once their balance is half gone, but never after a boost', () => {
    let s = to(start(ENEMIES['gun-turret']), 'enemy-0');
    s = apply(s, enemyMove(s));
    expect(enemyMove(s)).toEqual(END);
    const shaken = edit(s, (d) => { const t = unit(d, 'enemy-0'); t.stagger = Math.ceil(t.staggerMax / 2); });
    expect(enemyMove(shaken)).toEqual({ type: 'guard' });
    const boosted = edit(shaken, (d) => { unit(d, 'enemy-0').usedBoost = true; });
    expect(enemyMove(boosted)).toEqual(END);
  });

  describe('use their module', () => {
    const withModule = (effect: ModuleEffect, tweak: (enemy: UnitState, player: UnitState) => void = () => {}) =>
      edit(to(start(mech({ module: `mod-t-${effect}` })), 'enemy-0'), (d) => tweak(unit(d, 'enemy-0'), unit(d, 'player')));
    const uses = (s: BattleState) => enemyMove(s).type === 'module';

    test('coolant when they run hot', () => {
      expect(uses(withModule('coolant'))).toBe(false);
      expect(uses(withModule('coolant', (e) => { e.heat = 60; }))).toBe(true);
    });
    test('barrier and chaff when the core is hurt', () => {
      expect(uses(withModule('barrier'))).toBe(false);
      expect(uses(withModule('barrier', (e) => { e.parts.core!.ap = 100; }))).toBe(true);
      expect(uses(withModule('chaff'))).toBe(false);
      expect(uses(withModule('chaff', (e) => { e.parts.core!.ap = 140; }))).toBe(true);
    });
    test('nanites when enough armour is gone to make them worth it', () => {
      expect(uses(withModule('nanites'))).toBe(false);
      expect(uses(withModule('nanites', (e) => { for (const p of Object.values(e.parts)) p!.ap = Math.floor(p!.maxAp / 2); }))).toBe(true);
    });
    test('the painter on a player who is not painted yet', () => {
      expect(enemyMove(withModule('painter'))).toEqual({ type: 'module', target: 'player' });
      expect(uses(withModule('painter', (_e, p) => { p.painted = 2; }))).toBe(false);
    });
    test('shock and overclock at once, the limiter only when cool enough to afford it', () => {
      expect(uses(withModule('shock'))).toBe(true);
      expect(uses(withModule('overclock'))).toBe(true);
      expect(uses(withModule('limiter'))).toBe(true);
      expect(uses(withModule('limiter', (e) => { e.heat = 50; }))).toBe(false);
    });
    test('never twice in a turn, and never without uses left', () => {
      const used = apply(withModule('shock'), { type: 'module' });
      expect(uses(used)).toBe(false);
      expect(uses(withModule('shock', (e) => { e.moduleUses = 0; }))).toBe(false);
    });
  });
});

describe('the automatic player', () => {
  /** Fires everything the policy wants to fire and returns the state at its next kind of decision. */
  const afterFiring = (s: BattleState): BattleState => {
    while (autoMove(s).type === 'fire') s = apply(s, autoMove(s));
    return s;
  };

  test('boosts with leftover energy against a gun it can dodge', () => {
    const s = afterFiring(to(start(ENEMIES['gun-turret'], STARTER_BUILD), 'player'));
    expect(autoMove(s)).toEqual({ type: 'boost' });
  });

  test('guards instead once its balance is half gone, or when it is already staggered', () => {
    const s = afterFiring(to(start(ENEMIES['gun-turret'], STARTER_BUILD), 'player'));
    expect(autoMove(edit(s, (d) => { unit(d, 'player').stagger = 70; }))).toEqual({ type: 'guard' });
    expect(autoMove(edit(s, (d) => { unit(d, 'player').staggered = 1; }))).toEqual({ type: 'guard' });
  });

  test('guards when that saves more than dodging would: a shield against a gun that rarely misses', () => {
    const s = afterFiring(to(start(ENEMIES['lance-tower'], { ...DEMO_BUILD, leftHand: 'shd-t' }), 'player'));
    expect(autoMove(s)).toEqual({ type: 'guard' });
    const plain = afterFiring(to(start(ENEMIES['lance-tower'], STARTER_BUILD), 'player'));
    expect(autoMove(plain)).toEqual({ type: 'boost' });
  });

  test('goes for a staggered enemy first', () => {
    let s = to(createBattle(DEMO_BUILD, [ENEMIES['gun-turret'], ENEMIES['tank']], ALL, 1), 'player');
    expect(autoMove(s)).toMatchObject({ type: 'fire', target: 'enemy-1' });
    s = edit(s, (d) => { unit(d, 'enemy-0').staggered = 2; });
    expect(autoMove(s)).toMatchObject({ type: 'fire', target: 'enemy-0' });
  });

  test('with a blade, boosts in before striking', () => {
    let s = to(start(ENEMIES['gun-turret'], { ...DEMO_BUILD, rightHand: 'wpn-t-blade', leftHand: undefined, shoulder: undefined }), 'player');
    expect(autoMove(s)).toEqual({ type: 'boost' });
    s = apply(s, autoMove(s));
    expect(autoMove(s)).toMatchObject({ type: 'fire', weapon: 'rightHand' });
  });

  test('charges a charge weapon and fires it the turn after', () => {
    let s = to(start(ENEMIES['gun-turret'], { ...DEMO_BUILD, rightHand: 'wpn-t-charge' }), 'player');
    expect(autoMove(s)).toEqual({ type: 'charge', weapon: 'rightHand' });
    s = apply(s, autoMove(s));
    while (activeUnit(s).id === 'player') s = apply(s, autoMove(s));
    s = to(s, 'player');
    expect(autoMove(s)).toMatchObject({ type: 'fire', weapon: 'rightHand' });
  });

  test('uses its module: coolant when hot, a barrier when hurt', () => {
    const hot = edit(to(start(ENEMIES['gun-turret'], { ...DEMO_BUILD, module: 'mod-t-coolant' }), 'player'), (d) => { unit(d, 'player').heat = 70; });
    expect(autoMove(hot)).toEqual({ type: 'module' });
    const hurt = edit(to(start(ENEMIES['gun-turret'], { ...DEMO_BUILD, module: 'mod-t-barrier' }), 'player'), (d) => { unit(d, 'player').parts.core!.ap = 90; });
    expect(autoMove(hurt)).toEqual({ type: 'module' });
    const painter = to(start(ENEMIES['light-mech'], { ...DEMO_BUILD, module: 'mod-t-painter' }), 'player');
    expect(autoMove(painter)).toEqual({ type: 'module', target: 'enemy-0' });
  });
});

describe('no policy ever chooses an action the rules refuse', () => {
  const POOL: Build[] = [
    DEMO_BUILD,
    { ...DEMO_BUILD, rightHand: 'wpn-t-charge', module: 'mod-t-coolant' },
    { ...DEMO_BUILD, rightHand: 'wpn-t-blade', booster: 'bst-vector', module: 'mod-t-barrier' },
    { ...DEMO_BUILD, rightHand: 'wpn-t-burst', shoulder: 'wpn-t-salvo', module: 'mod-t-shock', fcs: 'fcs-lattice' },
    { ...DEMO_BUILD, leftHand: 'shd-t', legs: 'legs-t-tank', module: 'mod-t-nanites' },
    { ...DEMO_BUILD, legs: 'legs-t-hover', module: 'mod-t-overclock' },
    { ...DEMO_BUILD, legs: 'legs-t-quad', module: 'mod-t-limiter' },
    { ...DEMO_BUILD, legs: 'legs-t-reverse', module: 'mod-t-chaff' },
    { ...DEMO_BUILD, module: 'mod-t-painter' },
  ];
  const FOES: EnemyDef[] = [
    ...Object.values(ENEMIES), ...Object.values(ARENA_ENEMIES),
    ...POOL.map((build, i): EnemyDef => ({ id: `pool-${i}`, name: `Pool ${i}`, ai: (['gunner', 'skirmisher', 'bruiser', 'sprayer'] as const)[i % 4], sprite: 'none', build })),
  ];

  test('in four hundred battles with every new kind of part on both sides', () => {
    let rng = 12345;
    const pick = <T>(items: T[]): T => { const r = nextRandom(rng); rng = r.state; return items[Math.floor(r.value * items.length)]; };
    const outcomes = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const enemies = Array.from({ length: 1 + (i % 3) }, () => pick(FOES));
      const scale = 0.7 + (i % 5) * 0.2;
      let s = createBattle(pick(POOL), enemies, ALL, i + 1, { enemyScale: scale });
      let steps = 0;
      while (s.outcome === 'ongoing') {
        const policy = activeUnit(s).side === 'player' ? chooseAutoPlayerAction : chooseEnemyAction;
        const action = policy(s, ALL);
        expect(checkAction(s, action, ALL), `battle ${i}, step ${steps}: ${JSON.stringify(action)}`).toBeNull();
        s = applyAction(s, action, ALL);
        expect(++steps).toBeLessThan(5000);
      }
      for (const u of s.units) {
        expect(u.energy).toBeGreaterThanOrEqual(0);
        expect(u.stagger).toBeLessThanOrEqual(u.staggerMax);
        expect(u.barrier).toBeGreaterThanOrEqual(0);
        expect(u.moduleUses).toBeGreaterThanOrEqual(0);
        for (const ammo of Object.values(u.ammo)) if (typeof ammo === 'number') expect(ammo).toBeGreaterThanOrEqual(0);
      }
      outcomes.add(s.outcome);
    }
    expect(outcomes).toEqual(new Set(['victory', 'defeat']));
  });

  test('runBattle plays any of them to an end', () => {
    const end = runBattle(createBattle(POOL[3], [ENEMIES['heavy-mech'], ENEMIES['recon-drone']], ALL, 9), ALL, chooseAutoPlayerAction);
    expect(end.outcome).not.toBe('ongoing');
  });
});
