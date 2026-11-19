import {
  activeUnit, applyAction, carryFrom, checkAction, createBattle, evasion, fieldOf,
  type Action, type BattleState, type UnitState,
} from '../../src/core/battle';
import { chooseEnemyAction } from '../../src/core/ai';
import type { Build, Catalog, EnemyDef, FramePart } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { ALL } from '../helpers/testParts';

/**
 * Two things a part of a frame can do that no other part does: a core that raises a field at every
 * turn of its own, and arms that strike with a blade without giving up the boost that carried them in.
 */

const FIELD_CORE: FramePart = { ...(CATALOG['core-hauler'] as FramePart), id: 'core-t-field', name: 'Field Core', field: 50 };
const POISED_ARMS: FramePart = { ...(CATALOG['arms-rigger'] as FramePart), id: 'arms-t-poise', name: 'Poised Arms', poise: true };
const PARTS: Catalog = { ...ALL, [FIELD_CORE.id]: FIELD_CORE, [POISED_ARMS.id]: POISED_ARMS };

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState) => unit(s, 'player');
const act = (s: BattleState, action: Action, roll: () => number = hit): BattleState => applyAction(s, action, PARTS, roll);
const can = (s: BattleState, action: Action) => checkAction(s, action, PARTS);
function battle(enemies: (string | EnemyDef)[], build: Build, options: Parameters<typeof createBattle>[4] = {}): BattleState {
  return createBattle(build, enemies.map((e) => (typeof e === 'string' ? ENEMIES[e] : e)), PARTS, 1, options);
}
/** Ends turns until the pilot is the active unit again (or the battle ends). */
function toPlayer(s: BattleState): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = act(s, END);
  return s;
}
function edit(s: BattleState, fn: (draft: BattleState) => void): BattleState {
  const copy = structuredClone(s);
  fn(copy);
  return copy;
}
const fire = (slot: 'rightHand' | 'leftHand' | 'shoulder', target = 'enemy-0'): Action => ({ type: 'fire', weapon: slot, target, part: 'core' });
/** The enemy whose turn it is fires its first weapon at the pilot's core. */
const shootPlayer = (s: BattleState): BattleState => act(s, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
const shots = (s: BattleState) => s.events.flatMap((e) => (e.type === 'shot' ? [e] : []));

describe('a core that raises a field', () => {
  const build: Build = { ...DEMO_BUILD, core: 'core-t-field' };
  const said = (s: BattleState, type: 'fieldDown' | 'fieldUp') => s.events.filter((e) => e.type === type);
  /** The round goes by with nobody firing: every enemy has overheated. */
  const quietRound = (s: BattleState): BattleState =>
    toPlayer(act(edit(s, (d) => { for (const u of d.units) if (u.side === 'enemy') u.overheated = true; }), END));

  test('says how much: a core that says nothing raises none', () => {
    const fielded = player(battle(['gun-turret'], build));
    expect(fieldOf(fielded, PARTS)).toBe(50);
    expect(fieldOf(player(battle(['gun-turret'], DEMO_BUILD)), PARTS)).toBe(0);
    expect(player(battle(['gun-turret'], DEMO_BUILD)).barrier).toBe(0);
  });

  test('stands when the battle opens, before anybody has had a turn', () => {
    const s = battle(['gun-turret'], build);
    expect(player(s).barrier).toBe(50);
    expect(player(s).fieldDown).toBeUndefined();
    expect(unit(s, 'enemy-0').barrier).toBe(0);
  });

  test('takes a hit before the armour does, and what it cannot take reaches the armour', () => {
    let s = toPlayer(battle(['gun-turret'], build));
    const armour = player(s).parts.core!.ap;
    s = act(s, END);
    expect(activeUnit(s).id).toBe('enemy-0');
    s = shootPlayer(s);
    const [shot] = shots(s).slice(-1);
    expect(shot).toMatchObject({ target: 'player', hit: true });
    const dealt = shot.damage + (shot.absorbed ?? 0);
    expect(dealt).toBeGreaterThan(0);
    // All of a hit smaller than the field is the field's; of a larger one, the first fifty.
    expect(shot.absorbed).toBe(Math.min(50, dealt));
    expect(player(s).barrier).toBe(50 - Math.min(50, dealt));
    expect(player(s).parts.core!.ap).toBe(armour - Math.max(0, dealt - 50));
  });

  test('what is left of it meets the next hit: a second hit in a round gets only what the first left, and breaks it', () => {
    let s = edit(toPlayer(battle(['gun-turret'], build)), (d) => { player(d).barrier = 12; });
    const armour = player(s).parts.core!.ap;
    s = shootPlayer(act(s, END));
    const [shot] = shots(s).slice(-1);
    expect(shot.absorbed).toBe(12);
    expect(player(s).barrier).toBe(0);
    expect(player(s).parts.core!.ap).toBe(armour - shot.damage);
    expect(shot.damage).toBeGreaterThan(0);
    // The field is down, and that is said once, after the shot that did it.
    expect(said(s, 'fieldDown')).toEqual([{ type: 'fieldDown', unit: 'player' }]);
    expect(s.events.findIndex((e) => e.type === 'fieldDown')).toBeGreaterThan(s.events.lastIndexOf(shot));
  });

  test('while any of it stands at a turn of its own it is whole again: small fire only ever feeds it', () => {
    let s = edit(toPlayer(battle(['gun-turret'], build)), (d) => { player(d).barrier = 7; });
    s = quietRound(s);
    expect(player(s).barrier).toBe(50);
    expect(player(s).fieldDown).toBeUndefined();
    // A round in which nothing touched it leaves it whole: it does not pile up.
    s = quietRound(s);
    expect(player(s).barrier).toBe(50);
    expect(said(s, 'fieldDown')).toEqual([]);
    expect(said(s, 'fieldUp')).toEqual([]);
  });

  test('broken, it stays down for the round after, and is whole at the turn after that', () => {
    let s = edit(toPlayer(battle(['gun-turret'], build)), (d) => { player(d).barrier = 0; });
    // The turn after it broke: nothing stands, and it is down for this round.
    s = quietRound(s);
    expect(player(s)).toMatchObject({ barrier: 0, fieldDown: true });
    expect(said(s, 'fieldUp')).toEqual([]);
    // A hit in that round lands on the armour whole.
    const armour = player(s).parts.core!.ap;
    const hurt = shootPlayer(act(s, END));
    expect(shots(hurt).slice(-1)[0]).toMatchObject({ target: 'player', hit: true });
    expect(shots(hurt).slice(-1)[0].absorbed).toBeUndefined();
    expect(player(hurt).parts.core!.ap).toBe(armour - shots(hurt).slice(-1)[0].damage);
    // The turn after: whole again, and that is said.
    s = quietRound(s);
    expect(player(s).barrier).toBe(50);
    expect(player(s).fieldDown).toBeUndefined();
    expect(said(s, 'fieldUp')).toEqual([{ type: 'fieldUp', unit: 'player' }]);
    // And it goes on from there as it began: whole at the next turn too.
    expect(player(quietRound(s)).barrier).toBe(50);
  });

  test('is raised at a turn the unit then loses: overheated, its field is whole all the same', () => {
    let s = edit(toPlayer(battle(['gun-turret'], build)), (d) => { const p = player(d); p.barrier = 9; p.overheated = true; });
    s = act(s, END);
    for (let guard = 0; guard < 20 && s.round < 3; guard++) s = act(s, END);
    expect(player(s).barrier).toBe(50);
  });

  test('a pulse barrier larger than the field stands in its place for the round, and a smaller one changes nothing', () => {
    const withModule = (module: string): BattleState => toPlayer(battle(['gun-turret'], { ...build, module }));
    let s = act(withModule('mod-t-barrier'), { type: 'module' });
    expect(player(s).barrier).toBe(90);
    s = quietRound(s);
    expect(player(s).barrier).toBe(50);
    const small = { ...PARTS, 'mod-t-small': { ...PARTS['mod-t-barrier'], id: 'mod-t-small', power: 30 } } as Catalog;
    let t = toPlayer(createBattle({ ...build, module: 'mod-t-small' }, [ENEMIES['gun-turret']], small, 1));
    t = applyAction(t, { type: 'module' }, small, hit);
    expect(player(t).barrier).toBe(30 > 50 ? 30 : 50);
  });

  test('a pulse raised in the round the field is down covers that round, and the field is back the turn after as it would have been', () => {
    let s = edit(toPlayer(battle(['gun-turret'], { ...build, module: 'mod-t-barrier' })), (d) => { player(d).barrier = 0; });
    s = quietRound(s);
    expect(player(s)).toMatchObject({ barrier: 0, fieldDown: true });
    s = act(s, { type: 'module' });
    expect(player(s).barrier).toBe(90);
    s = quietRound(s);
    expect(player(s).barrier).toBe(50);
    expect(player(s).fieldDown).toBeUndefined();
  });

  test('on an enemy it is as much stronger as the enemy is, breaks and comes back as the pilot\'s does, and a shielded elite stands behind the larger of its two', () => {
    const fielded: EnemyDef = { ...ENEMIES['heavy-mech'], id: 'fielded', build: { ...ENEMIES['heavy-mech'].build, core: 'core-t-field' } };
    expect(unit(battle([fielded], DEMO_BUILD), 'enemy-0').barrier).toBe(50);
    expect(unit(battle([fielded], DEMO_BUILD, { enemyScale: 1.5 }), 'enemy-0').barrier).toBe(75);
    // Some of it standing at its own turn: whole again.
    let s = edit(battle([fielded], DEMO_BUILD, { enemyScale: 1.5 }), (d) => { unit(d, 'enemy-0').barrier = 3; });
    s = toPlayer(act(toPlayer(s), END));
    expect(unit(s, 'enemy-0').barrier).toBe(75);
    // The pilot breaks it with a shot: it is said, it is down through the enemy's next turn, and back the one after.
    s = edit(toPlayer(s), (d) => { unit(d, 'enemy-0').barrier = 1; });
    s = act(s, fire('rightHand'));
    expect(shots(s).slice(-1)[0]).toMatchObject({ target: 'enemy-0', hit: true, absorbed: 1 });
    expect(s.events.filter((e) => e.type === 'fieldDown')).toEqual([{ type: 'fieldDown', unit: 'enemy-0' }]);
    s = toPlayer(act(s, END));
    expect(unit(s, 'enemy-0')).toMatchObject({ barrier: 0, fieldDown: true });
    s = toPlayer(act(s, END));
    expect(unit(s, 'enemy-0').barrier).toBe(75);
    expect(s.events.filter((e) => e.type === 'fieldUp')).toEqual([{ type: 'fieldUp', unit: 'enemy-0' }]);
    // A shielded elite: a share of all its armour is more than fifty here, and that is what stands.
    const elite = battle([fielded], DEMO_BUILD, { marks: { 0: 'shielded' } });
    expect(unit(elite, 'enemy-0').barrier).toBeGreaterThan(50);
  });

  test('a barrier that is no field says nothing when it goes: only a core\'s field is called down', () => {
    let s = act(toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, module: 'mod-t-barrier' })), { type: 'module' });
    s = edit(s, (d) => { player(d).barrier = 1; });
    s = shootPlayer(act(s, END));
    expect(shots(s).slice(-1)[0]).toMatchObject({ target: 'player', absorbed: 1 });
    expect(s.events.filter((e) => e.type === 'fieldDown')).toEqual([]);
  });

  test('is whole again at the next battle of a contract, even one that was down: what was taken off it is not carried', () => {
    let s = edit(toPlayer(battle(['gun-turret'], build)), (d) => { player(d).barrier = 0; player(d).parts.core!.ap -= 40; });
    s = quietRound(s);
    expect(player(s).fieldDown).toBe(true);
    const next = createBattle(build, [ENEMIES['gun-turret']], PARTS, 2, { carry: carryFrom(s) });
    expect(player(next).barrier).toBe(50);
    expect(player(next).fieldDown).toBeUndefined();
    expect(player(next).parts.core!.ap).toBe(player(s).parts.core!.ap);
  });
});

describe('an enemy plated to last', () => {
  const plain: EnemyDef = { ...ENEMIES['heavy-mech'], id: 'plain' };
  const plated: EnemyDef = { ...plain, id: 'plated', plating: 1 };
  const foe = (def: EnemyDef, options: Parameters<typeof createBattle>[4] = {}) => unit(battle([def], DEMO_BUILD, options), 'enemy-0');

  test('has that share more armour on every part, and is no steadier and hits no harder for it', () => {
    const [a, b] = [foe(plain), foe(plated)];
    for (const slot of ['core', 'legs', 'arms', 'head'] as const) expect(b.parts[slot]!.maxAp, slot).toBe(a.parts[slot]!.maxAp * 2);
    for (const slot of ['core', 'legs', 'arms', 'head'] as const) expect(b.parts[slot]!.ap, slot).toBe(b.parts[slot]!.maxAp);
    expect(b.staggerMax).toBe(a.staggerMax);
    expect(b.mods.damage).toBe(a.mods.damage);
    expect(b.mods.toughness).toBe(1);
    expect(foe({ ...plain, plating: 0.5 }).parts.core!.maxAp).toBe(a.parts.core!.maxAp * 1.5);
  });

  test('on top of what the contract scales it by, and of an elite\'s own plate', () => {
    const base = foe(plain).parts.core!.maxAp;
    expect(foe(plated, { enemyScale: 1.5 }).parts.core!.maxAp).toBe(Math.round(base * 2 * 1.5));
    // A scale makes it steadier and hit harder, as it always did; the plating adds to neither.
    expect(foe(plated, { enemyScale: 1.5 }).staggerMax).toBe(foe(plain, { enemyScale: 1.5 }).staggerMax);
    expect(foe(plated, { enemyScale: 1.5 }).mods.damage).toBe(1.5);
    const armoured = foe(plain, { marks: { 0: 'armoured' } }).parts.core!.maxAp;
    expect(armoured).toBeGreaterThan(base);
    // The two are shares of the same armour, and add up: an armoured elite that is plated has both.
    expect(foe(plated, { marks: { 0: 'armoured' } }).parts.core!.maxAp).toBe(Math.round(base + (armoured - base) + base));
  });
});

describe('an enemy tuned to raise a field', () => {
  const tuned: EnemyDef = { ...ENEMIES['heavy-mech'], id: 'tuned', abilities: { field: 70 } };

  test('raises it whatever core it flies: one that is sold with none, or one that is sold with less', () => {
    expect(unit(battle([tuned], DEMO_BUILD), 'enemy-0').barrier).toBe(70);
    const onFieldCore: EnemyDef = { ...tuned, id: 'both', build: { ...tuned.build, core: 'core-t-field' } };
    const foe = unit(battle([onFieldCore], DEMO_BUILD), 'enemy-0');
    expect(fieldOf(foe, PARTS)).toBe(70);
    expect(foe.barrier).toBe(70);
    // As much stronger as the enemy is, like a core's own.
    expect(unit(battle([tuned], DEMO_BUILD, { enemyScale: 1.2 }), 'enemy-0').barrier).toBe(84);
  });

  test('it breaks and comes back by the rule a core\'s own field goes by', () => {
    let s = edit(toPlayer(battle([tuned], DEMO_BUILD)), (d) => { unit(d, 'enemy-0').barrier = 1; });
    s = act(s, fire('rightHand'));
    expect(shots(s).slice(-1)[0]).toMatchObject({ target: 'enemy-0', hit: true, absorbed: 1 });
    expect(s.events.filter((e) => e.type === 'fieldDown')).toEqual([{ type: 'fieldDown', unit: 'enemy-0' }]);
    s = toPlayer(act(s, END));
    expect(unit(s, 'enemy-0')).toMatchObject({ barrier: 0, fieldDown: true });
    s = toPlayer(act(s, END));
    expect(unit(s, 'enemy-0').barrier).toBe(70);
  });
});

describe('arms that strike without giving up the boost', () => {
  const build: Build = { ...DEMO_BUILD, arms: 'arms-t-poise', rightHand: 'wpn-t-blade' };
  const start = (b: Build = build) => toPlayer(battle(['gun-turret'], b));

  test('a blade still needs the boost that carries it in', () => {
    const s = start();
    expect(can(s, fire('rightHand'))).toBe('needsBoost');
    expect(can(act(s, { type: 'boost' }), fire('rightHand'))).toBeNull();
  });

  test('after the strike the mech is still boosting: as hard to hit as before it, until its next turn', () => {
    const boosted = act(start(), { type: 'boost' });
    const before = evasion(player(boosted), PARTS);
    const struck = act(boosted, fire('rightHand'));
    expect(shots(struck).slice(-1)[0]).toMatchObject({ unit: 'player', hit: true });
    expect(player(struck).boosted).toBe(true);
    expect(evasion(player(struck), PARTS)).toBe(before);
    // Other arms give the boost up for the same strike.
    const plain = act(act(start({ ...build, arms: DEMO_BUILD.arms }), { type: 'boost' }), fire('rightHand'));
    expect(player(plain).boosted).toBe(false);
    expect(evasion(player(plain), PARTS)).toBe(before - 30);
    // It lasts as long as any boost: at the pilot's next turn it is over.
    expect(player(toPlayer(act(struck, END))).boosted).toBe(false);
  });

  test('the boost is still the one stance of the turn: no second boost, and no guard beside it', () => {
    const struck = act(act(start(), { type: 'boost' }), fire('rightHand'));
    expect(can(struck, { type: 'boost' })).toBe('alreadyUsed');
    expect(can(struck, { type: 'guard' })).toBe('alreadyUsed');
  });

  test('once a turn: a second blade after the first gives the boost up, as any blade does from other arms', () => {
    const two: Build = { ...DEMO_BUILD, arms: 'arms-t-poise', rightHand: 'wpn-t-blade', leftHand: 'wpn-t-blade' };
    // Energy for both strikes: this is about the boost, not about what a turn can pay for.
    const rich = edit(act(start(two), { type: 'boost' }), (d) => { player(d).energy = 999; });
    const first = act(rich, fire('rightHand'));
    expect(player(first).boosted).toBe(true);
    const second = act(first, fire('leftHand'));
    expect(shots(second).slice(-1)[0]).toMatchObject({ unit: 'player', weapon: 'leftHand', hit: true });
    expect(player(second).boosted).toBe(false);
    // Whichever hand strikes first, it is the second strike that costs it.
    const other = act(act(rich, fire('leftHand')), fire('rightHand'));
    expect(player(act(rich, fire('leftHand'))).boosted).toBe(true);
    expect(player(other).boosted).toBe(false);
    // A gun fired between or after the blade is no blade: one blade and a gun leave the mech boosting.
    const armed = edit(act(start({ ...two, leftHand: DEMO_BUILD.rightHand }), { type: 'boost' }), (d) => { player(d).energy = 999; });
    const mixed = act(act(armed, fire('rightHand')), fire('leftHand'));
    expect(shots(mixed).filter((shot) => shot.unit === 'player').map((shot) => shot.weapon)).toEqual(['rightHand', 'leftHand']);
    expect(player(mixed).boosted).toBe(true);
  });

  test('a blade that a kill readied again is not spent: in an open battle the mech that cuts its way on is still boosting', () => {
    const two: Build = { ...DEMO_BUILD, arms: 'arms-t-poise', rightHand: 'wpn-t-blade', leftHand: 'wpn-t-blade' };
    let s = edit(act(toPlayer(battle(['recon-drone', 'recon-drone', 'gun-turret'], two)), { type: 'boost' }), (d) => {
      player(d).energy = 999;
      unit(d, 'enemy-0').parts.core!.ap = 1;
    });
    expect(s.open).toBe(true);
    // The first strike destroys a drone: the blade is ready again, and no blade is spent.
    s = act(s, fire('rightHand', 'enemy-0'));
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(player(s).fired).toEqual([]);
    expect(player(s).boosted).toBe(true);
    // It strikes again and does not kill: one blade spent, still boosting. The other blade after it: two, and the boost is gone.
    s = act(s, fire('rightHand', 'enemy-2'));
    expect(player(s).fired).toEqual(['rightHand']);
    expect(player(s).boosted).toBe(true);
    s = act(s, fire('leftHand', 'enemy-2'));
    expect(player(s).boosted).toBe(false);
  });

  test('it is the arms that do it: the same blade in the other hand keeps the boost too, and a gun never spent it', () => {
    const left = act(act(start({ ...DEMO_BUILD, arms: 'arms-t-poise', leftHand: 'wpn-t-blade' }), { type: 'boost' }), fire('leftHand'));
    expect(player(left).boosted).toBe(true);
    const gun = act(act(start({ ...DEMO_BUILD, arms: 'arms-t-poise' }), { type: 'boost' }), fire('rightHand'));
    expect(player(gun).boosted).toBe(true);
  });

  test('an enemy with such arms that boosts in and strikes is still boosting when the pilot shoots back', () => {
    const duellist: EnemyDef = {
      id: 'duellist', name: 'Duellist', ai: 'bruiser', sprite: 'enemy-rival', composed: true,
      build: { ...ENEMIES.rival.build, arms: 'arms-t-poise', rightHand: 'wpn-t-blade', shoulder: undefined },
    };
    const plain: EnemyDef = { ...duellist, id: 'plain', build: { ...duellist.build, arms: ENEMIES.rival.build.arms } };
    const after = (def: EnemyDef): UnitState => {
      let s = battle([def], DEMO_BUILD);
      // The pilot passes; the duellist takes its turn as it chooses to.
      s = toPlayer(s);
      s = act(s, END);
      for (let guard = 0; guard < 12 && activeUnit(s).id === 'enemy-0' && s.outcome === 'ongoing'; guard++) {
        s = act(s, chooseEnemyAction(s, PARTS));
      }
      expect(shots(s).some((shot) => shot.unit === 'enemy-0' && shot.weapon === 'rightHand')).toBe(true);
      return unit(s, 'enemy-0');
    };
    expect(after(duellist).boosted).toBe(true);
    expect(after(plain).boosted).toBe(false);
  });
});
