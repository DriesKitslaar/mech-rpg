import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import {
  activeUnit, applyAction, checkAction, createBattle,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import { intentOf } from '../../src/core/intent';
import { tallyBattle } from '../../src/core/stats';
import type { Build, Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * They break: a pilot who destroys two machines in one turn of an open battle is seen doing it.
 * Whatever still stands loses its nerve, and breaks off when its own turn comes.
 */

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };
const fire = (target: string, weapon: 'rightHand' | 'leftHand' | 'shoulder' = 'rightHand'): Action => ({ type: 'fire', weapon, target, part: 'core' });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
function toPlayer(s: BattleState, catalog: Catalog): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
function field(enemyIds: string[], opts: BattleOptions = {}, catalog: Catalog = HEAVY, build: Build = DEMO_BUILD): BattleState {
  return toPlayer(createBattle(build, enemyIds.map((id) => ENEMIES[id]), catalog, 1, opts), catalog);
}
const of = <T extends BattleEvent['type']>(s: BattleState, type: T): Extract<BattleEvent, { type: T }>[] =>
  s.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
/** Two drones down in one turn, the turret behind them still standing. */
const broken = (opts: BattleOptions = {}): BattleState => {
  let s = field(['recon-drone', 'recon-drone', 'gun-turret'], opts);
  s = applyAction(s, fire('enemy-0'), HEAVY, hit);
  return applyAction(s, fire('enemy-1'), HEAVY, hit);
};

describe('two machines destroyed in one turn of an open battle', () => {
  test('shake what still stands, at the second and not at the first', () => {
    let s = field(['recon-drone', 'recon-drone', 'gun-turret']);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    expect(player(s).chain).toBe(1);
    expect(unit(s, 'enemy-2').shaken).toBeUndefined();
    expect(of(s, 'shaken')).toEqual([]);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    expect(player(s).chain).toBe(2);
    expect(unit(s, 'enemy-2').shaken).toBe(true);
    expect(of(s, 'shaken')).toEqual([{ type: 'shaken', unit: 'enemy-2' }]);
    // It is said after the machine has gone and the weapon is back: that is the order it happened in.
    expect(s.events.slice(-3).map((e) => e.type)).toEqual(['unitDestroyed', 'momentum', 'shaken']);
    // Nothing has left yet, and it is still the pilot's turn.
    expect(unit(s, 'enemy-2').destroyed).toBe(false);
    expect(activeUnit(s).id).toBe('player');
  });

  test('do not when they fall in two turns', () => {
    let s = field(['recon-drone', 'recon-drone', 'gun-turret']);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = toPlayer(applyAction(s, END, HEAVY), HEAVY);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    expect(s.units.filter((u) => u.destroyed).map((u) => u.id)).toEqual(['enemy-0', 'enemy-1']);
    expect(player(s).chain).toBe(1);
    expect(unit(s, 'enemy-2').shaken).toBeUndefined();
    expect(of(s, 'shaken')).toEqual([]);
  });

  test('by one salvo count the same', () => {
    const salvo = CATALOG['wpn-micro-salvo'] as Weapon;
    const catalog: Catalog = { ...CATALOG, 'wpn-micro-salvo': { ...salvo, damage: 60 } };
    let s = field(['recon-drone', 'gun-turret', 'recon-drone'], {}, catalog, { ...DEMO_BUILD, shoulder: 'wpn-micro-salvo' });
    s = applyAction(s, fire('enemy-1', 'shoulder'), catalog, hit);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([true, false, true]);
    expect(unit(s, 'enemy-1').shaken).toBe(true);
    expect(of(s, 'shaken')).toEqual([{ type: 'shaken', unit: 'enemy-1' }]);
  });

  test('shake it once: a third kill of the turn, or a second turn like it, says nothing more', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES.carrier, ENEMIES['recon-drone'], ENEMIES['recon-drone']], HEAVY, 1);
    s = toPlayer(s, HEAVY);
    // The carrier is too much for one hit of anything a drone falls to: a rifle that goes through drones only.
    const light: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 60 } };
    s = applyAction(s, fire('enemy-1'), light, hit);
    s = applyAction(s, fire('enemy-2'), light, hit);
    expect(unit(s, 'enemy-0').shaken).toBe(true);
    expect(of(s, 'shaken')).toHaveLength(1);
    // Shaken as it is, it can still be shot at, and a hit is a hit.
    expect(checkAction(s, fire('enemy-0'), light)).toBeNull();
    const before = unit(s, 'enemy-0').parts.core!.ap;
    s = applyAction(s, fire('enemy-0'), light, hit);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBeLessThan(before);
    expect(of(s, 'shaken')).toHaveLength(1);
  });
});

describe('a machine that is shaken already', () => {
  test('is not shaken again by another turn like the first: nothing more is said of it', () => {
    // A turret that lost its nerve and has not had its turn yet, as one that joined late in a round has not.
    const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => { const copy = structuredClone(s); change(copy); return copy; };
    let s = edit(field(['recon-drone', 'recon-drone', 'gun-turret']), (draft) => { unit(draft, 'enemy-2').shaken = true; });
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    expect(player(s).chain).toBe(2);
    expect(of(s, 'shaken')).toEqual([]);
    expect(unit(s, 'enemy-2').shaken).toBe(true);
  });

  test('nor is a wreck: what has been destroyed has no nerve to lose', () => {
    const s = broken();
    expect(of(s, 'shaken').map((e) => e.unit)).toEqual(['enemy-2']);
    expect(unit(s, 'enemy-0').shaken).toBeUndefined();
    expect(unit(s, 'enemy-1').shaken).toBeUndefined();
    expect(player(s).shaken).toBeUndefined();
  });
});

describe('a shaken machine', () => {
  test('breaks off when its own turn comes, instead of taking it: it is gone, and nobody destroyed it', () => {
    const s = broken();
    const left = applyAction(s, END, HEAVY);
    const turret = unit(left, 'enemy-2');
    expect(turret.fled).toBe(true);
    expect(turret.destroyed).toBe(true);
    // Its armour is what it was: it left, it was not taken apart.
    expect(turret.parts.core!.ap).toBe(unit(s, 'enemy-2').parts.core!.ap);
    expect(of(left, 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2' }]);
    expect(of(left, 'unitDestroyed').map((e) => e.unit)).toEqual(['enemy-0', 'enemy-1']);
    // It fired nothing on the way out.
    expect(left.events.slice(s.events.length).some((e) => e.type === 'shot')).toBe(false);
    expect(left.events.slice(s.events.length).some((e) => e.type === 'turnStart' && e.unit === 'enemy-2')).toBe(false);
  });

  test('that was the last one standing ends the battle as a win', () => {
    const left = applyAction(broken(), END, HEAVY);
    expect(left.outcome).toBe('victory');
    expect(left.events.slice(-2)).toEqual([{ type: 'rout', unit: 'enemy-2' }, { type: 'outcome', outcome: 'victory' }]);
    expect(checkAction(left, END, HEAVY)).toBe('battleOver');
  });

  test('ends a battle that only had to be outlasted, and one with something to protect, the same way', () => {
    for (const objective of [{ type: 'survive', rounds: 6 }, { type: 'protect', name: 'Ore Train', hp: 12 }] as const) {
      const left = applyAction(broken({ objective }), END, HEAVY);
      expect(left.outcome, objective.type).toBe('victory');
      expect(left.round, objective.type).toBe(1);
      if (objective.type === 'protect') expect(left.asset!.hp).toBe(12);
    }
  });

  test('can be destroyed before its turn comes, and is then a machine destroyed like any other', () => {
    let s = broken();
    s = applyAction(s, fire('enemy-2'), HEAVY, hit);
    expect(s.outcome).toBe('victory');
    expect(unit(s, 'enemy-2').fled).toBeUndefined();
    expect(of(s, 'rout')).toEqual([]);
    expect(of(s, 'unitDestroyed').map((e) => e.unit)).toEqual(['enemy-0', 'enemy-1', 'enemy-2']);
    expect(player(s).chain).toBe(3);
  });

  test('is not a kill: the record counts the two that were destroyed and not the one that left', () => {
    const left = applyAction(broken(), END, HEAVY);
    expect(tallyBattle(left).kills).toBe(2);
    const all = applyAction(broken(), fire('enemy-2'), HEAVY, hit);
    expect(tallyBattle(all).kills).toBe(3);
  });

  test('shows no intent: it is not lining up on anything', () => {
    const s = broken();
    expect(intentOf(s, unit(s, 'enemy-2'), HEAVY)).toBeNull();
    // The same turret, unshaken, is aiming at something.
    const calm = field(['recon-drone', 'recon-drone', 'gun-turret']);
    expect(intentOf(calm, unit(calm, 'enemy-2'), HEAVY)).not.toBeNull();
  });

  test('that carries a bomb takes it away unexploded; one that launches drones launches no more', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES['bomb-crawler'], ENEMIES['recon-drone'], ENEMIES['recon-drone']], HEAVY, 1);
    s = toPlayer(s, HEAVY);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    s = applyAction(s, fire('enemy-2'), HEAVY, hit);
    expect(unit(s, 'enemy-0').shaken).toBe(true);
    const armour = player(s).parts.core!.ap;
    s = applyAction(s, END, HEAVY);
    expect(s.outcome).toBe('victory');
    expect(of(s, 'blast')).toEqual([]);
    expect(player(s).parts.core!.ap).toBe(armour);
    let carried = createBattle(DEMO_BUILD, [ENEMIES.carrier, ENEMIES['recon-drone'], ENEMIES['recon-drone']], HEAVY, 1);
    carried = toPlayer(carried, HEAVY);
    const light: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 60 } };
    carried = applyAction(carried, fire('enemy-1'), light, hit);
    carried = applyAction(carried, fire('enemy-2'), light, hit);
    carried = applyAction(carried, END, light);
    expect(carried.outcome).toBe('victory');
    expect(of(carried, 'launch')).toEqual([]);
  });
});

describe('a fight that is not open', () => {
  test('shakes nobody, however many fall in a turn', () => {
    // A named pilot with two drones. No weapon is ready again here, so the two drones take two weapons: the rifle and the pistol.
    const pistol = CATALOG['wpn-arc-pistol'] as Weapon;
    const both: Catalog = { ...HEAVY, 'wpn-arc-pistol': { ...pistol, damage: 900 } };
    let s = field(['magpie', 'recon-drone', 'recon-drone'], {}, both);
    expect(s.open).toBe(false);
    s = applyAction(s, fire('enemy-1', 'rightHand'), both, hit);
    s = applyAction(s, fire('enemy-2', 'leftHand'), both, hit);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([false, true, true]);
    expect(activeUnit(s).id).toBe('player');
    expect(player(s).chain).toBe(0);
    expect(unit(s, 'enemy-0').shaken).toBeUndefined();
    expect(of(s, 'shaken')).toEqual([]);
    // And the pilot who is left takes their turn.
    s = applyAction(s, END, both);
    expect(of(s, 'rout')).toEqual([]);
    expect(unit(s, 'enemy-0').destroyed).toBe(false);
  });

  /** The nine fights of the part before this one, by what they came to before any of these rules: they come to it still. */
  const AS_IT_WAS: [string[], number, BattleOptions, [string, number, number, number, number, number]][] = [
    [['gun-turret'], 11, {}, ['victory', 2, 13, 381, -1263671329, 1]],
    [['leviathan'], 3, {}, ['victory', 8, 71, 198, -823659258, 2]],
    [['proxy'], 9, { enemyScale: 0.8 }, ['defeat', 26, 287, 0, -1782777207, 4]],
    [['carrier'], 4, {}, ['victory', 11, 107, 348, -951541651, 5]],
    [['bailiff', 'lien-drone', 'lien-drone'], 5, {}, ['victory', 12, 117, 131, -1647318517, 3]],
    [['overseer', 'shield-drone'], 7, {}, ['victory', 24, 211, 200, 1632165929, 2]],
    [['magpie', 'recon-drone', 'recon-drone'], 2, { objective: { type: 'leader', target: 0 } }, ['victory', 13, 162, 206, -1903083308, 1]],
    [['ripper', 'repair-drone'], 6, { objective: { type: 'disable', target: 0 } }, ['victory', 12, 104, 278, 816082967, 1]],
    [['gun-turret', 'recon-drone', 'recon-drone'], 8, { marks: { 0: 'armoured' } }, ['victory', 6, 51, 350, 1071847757, 3]],
  ];

  test.each(AS_IT_WAS)('%j from seed %i: nobody is shaken and nobody leaves', (enemies, seed, opts, was) => {
    const end = runBattle(createBattle(REFERENCE_BUILDS.tier6, enemies.map((id) => ENEMIES[id]), CATALOG, seed, opts), CATALOG, chooseAutoPlayerAction);
    const fell = end.events.filter((e) => e.type === 'unitDestroyed' && e.unit !== 'player').length;
    expect([end.outcome, end.round, end.events.length, end.units[0].parts.core!.ap, end.rng, fell]).toEqual(was);
    expect(end.events.some((e) => e.type === 'shaken' || e.type === 'rout')).toBe(false);
    expect(end.units.some((u) => u.shaken || u.fled)).toBe(false);
  });
});

describe('played out', () => {
  test('the best frame against three light machines: where two fall in a turn the third leaves, and it is said every time', () => {
    let routs = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = createBattle(REFERENCE_BUILDS.tier6, ['recon-drone', 'recon-drone', 'gunship'].map((id) => ENEMIES[id]), CATALOG, seed * 7919);
      while (s.outcome === 'ongoing') s = applyAction(s, (activeUnit(s).side === 'player' ? chooseAutoPlayerAction : chooseEnemyAction)(s, CATALOG), CATALOG);
      expect(s.outcome).toBe('victory');
      const shaken = of(s, 'shaken').map((e) => e.unit);
      const left = of(s, 'rout').map((e) => e.unit);
      const fell = of(s, 'unitDestroyed').map((e) => e.unit);
      // Whoever left was shaken first, and whoever was shaken either left or was destroyed before it could.
      for (const id of left) expect(shaken).toContain(id);
      for (const id of shaken) expect(left.includes(id) !== fell.includes(id)).toBe(true);
      // Nobody is both, and all three are accounted for.
      expect([...left, ...fell].sort()).toEqual(['enemy-0', 'enemy-1', 'enemy-2']);
      routs += left.length;
    }
    expect(routs).toBeGreaterThan(3);
  });
});
