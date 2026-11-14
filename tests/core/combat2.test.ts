import {
  GUARD_DAMAGE, STAGGER_DAMAGE, activeUnit, applyAction, boostCost, carryFrom, checkAction, createBattle, evasion, guardCost,
  previewShot,
  type Action, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Build, ModuleEffect } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { ALL } from '../helpers/testParts';

const hit = () => 0;
const miss = () => 0.999;
const END: Action = { type: 'endTurn' };

function battle(enemyIds: string[], build: Build = DEMO_BUILD, seed = 1): BattleState {
  return createBattle(build, enemyIds.map((id) => ENEMIES[id]), ALL, seed);
}
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState) => unit(s, 'player');
const act = (s: BattleState, action: Action, roll: () => number = hit): BattleState => applyAction(s, action, ALL, roll);
const can = (s: BattleState, action: Action) => checkAction(s, action, ALL);
/** Ends turns until the player is the active unit again (or the battle ends). */
function toPlayer(s: BattleState): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard++ < 20) s = act(s, END);
  return s;
}
/** Ends the player's turn and every enemy turn after it. */
const nextRound = (s: BattleState): BattleState => toPlayer(act(s, END));
function edit(s: BattleState, fn: (draft: BattleState) => void): BattleState {
  const copy = structuredClone(s);
  fn(copy);
  return copy;
}
const fire = (slot: 'rightHand' | 'leftHand' | 'shoulder', target = 'enemy-0', part: 'core' | 'legs' | 'arms' | 'head' = 'core'): Action =>
  ({ type: 'fire', weapon: slot, target, part });
const events = (s: BattleState, type: string) => s.events.filter((e) => e.type === type);

describe('stability', () => {
  test('every unit starts steady, with a limit set by its weight', () => {
    const s = battle(['gun-turret', 'recon-drone']);
    expect(player(s)).toMatchObject({ stagger: 0, staggerMax: 129, staggered: 0 });
    expect(unit(s, 'enemy-0').staggerMax).toBe(106);
    expect(unit(s, 'enemy-1').staggerMax).toBe(71);
  });

  test('scaled enemies are steadier in proportion', () => {
    const s = createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], ALL, 1, { enemyScale: 1.5 });
    expect(unit(s, 'enemy-0').staggerMax).toBe(159);
    expect(player(s).staggerMax).toBe(129);
  });

  test('a hit pushes by the weapon\'s impact: slugs fully, blasts harder, beams half; a miss does not push', () => {
    let s = toPlayer(battle(['gun-turret']));
    s = act(s, fire('rightHand'));
    expect(unit(s, 'enemy-0').stagger).toBe(38);
    s = act(s, fire('leftHand'));
    expect(unit(s, 'enemy-0').stagger).toBe(38 + 15);
    const missed = act(toPlayer(battle(['gun-turret'])), fire('shoulder'), miss);
    expect(unit(missed, 'enemy-0').stagger).toBe(0);
  });

  test('a full bar staggers: an event, the bar stays full, and further hits no longer push', () => {
    let s = toPlayer(battle(['gun-turret']));
    s = act(act(s, fire('rightHand')), fire('leftHand'));
    expect(unit(s, 'enemy-0').staggered).toBe(0);
    s = act(s, fire('shoulder'));
    expect(unit(s, 'enemy-0')).toMatchObject({ staggered: 2, stagger: 106 });
    expect(events(s, 'stagger')).toEqual([{ type: 'stagger', unit: 'enemy-0' }]);
  });

  test('a staggered unit cannot evade, takes 30% more damage and cannot boost', () => {
    const base = toPlayer(battle(['recon-drone']));
    expect(evasion(unit(base, 'enemy-0'), ALL)).toBeGreaterThan(0);
    const s = edit(base, (d) => { unit(d, 'enemy-0').staggered = 2; });
    expect(evasion(unit(s, 'enemy-0'), ALL)).toBe(0);
    const before = previewShot(base, 'player', 'rightHand', 'enemy-0', 'core', ALL);
    const after = previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL);
    expect(STAGGER_DAMAGE).toBe(1.3);
    expect(after.damage).toBe(Math.round(before.damage * 1.3));
    expect(after.hitChance).toBeGreaterThan(before.hitChance);

    const me = edit(base, (d) => { player(d).staggered = 1; });
    expect(can(me, { type: 'boost' })).toBe('staggered');
    expect(can(me, { type: 'guard' })).toBeNull();
  });

  test('a stagger lasts through one whole turn of the attacker: a weak turn, a turn to punish, then recovery', () => {
    let s = toPlayer(battle(['gun-turret']));
    for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) s = act(s, fire(slot));
    expect(unit(s, 'enemy-0').staggered).toBe(2);

    s = act(s, END); // the turret's weak turn
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(unit(s, 'enemy-0')).toMatchObject({ staggered: 1, energy: 120, stagger: 106 });

    s = act(s, END); // the player's turn to punish
    expect(activeUnit(s).id).toBe('player');
    expect(unit(s, 'enemy-0').staggered).toBe(1);
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).damage).toBe(Math.round(38 * 0.6 * 1.3));

    s = act(s, END); // the turret recovers
    expect(unit(s, 'enemy-0')).toMatchObject({ staggered: 0, stagger: 0, energy: 200 });
    expect(events(s, 'recover')).toEqual([{ type: 'recover', unit: 'enemy-0' }]);
  });

  test('a unit that is not staggered steadies itself a little at the start of each of its turns', () => {
    let s = toPlayer(battle(['gun-turret']));
    s = act(s, fire('rightHand'));
    s = act(s, END);
    expect(unit(s, 'enemy-0').stagger).toBe(38 - 37);
    s = act(s, END);
    expect(unit(s, 'enemy-0').stagger).toBe(1);
    s = act(s, END);
    expect(unit(s, 'enemy-0').stagger).toBe(0);
  });

  test('a turn lost to overheating still counts towards recovery', () => {
    let s = toPlayer(battle(['gun-turret']));
    s = edit(s, (d) => { const t = unit(d, 'enemy-0'); t.staggered = 2; t.stagger = t.staggerMax; t.overheated = true; t.heat = 120; });
    s = act(s, END);
    expect(activeUnit(s).id).toBe('player');
    expect(unit(s, 'enemy-0').staggered).toBe(1);
  });

  test('nothing of it is carried into the next battle of a contract', () => {
    let s = toPlayer(battle(['gun-turret']));
    s = edit(s, (d) => { const p = player(d); p.stagger = 90; p.staggered = 1; p.guarding = true; p.barrier = 50; p.painted = 2; p.charged = ['rightHand']; });
    const next = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], ALL, 2, { carry: carryFrom(s) });
    expect(player(next)).toMatchObject({ stagger: 0, staggered: 0, guarding: false, barrier: 0, painted: 0, charged: [] });
  });
});

describe('guard', () => {
  test('costs a fifth of a turn\'s energy, once a turn, and lasts until the unit\'s next turn', () => {
    let s = toPlayer(battle(['gun-turret']));
    expect(guardCost(player(s), ALL)).toBe(46);
    s = act(s, { type: 'guard' });
    expect(player(s)).toMatchObject({ guarding: true, energy: 230 - 46 });
    expect(s.events.at(-1)).toEqual({ type: 'guard', unit: 'player' });
    expect(can(s, { type: 'guard' })).toBe('alreadyUsed');
    s = act(s, END);
    expect(player(s).guarding).toBe(true);
    s = toPlayer(s);
    expect(player(s).guarding).toBe(false);
  });

  test('guard and boost do not go together in one turn', () => {
    const s = toPlayer(battle(['gun-turret']));
    expect(can(act(s, { type: 'guard' }), { type: 'boost' })).toBe('alreadyUsed');
    expect(can(act(s, { type: 'boost' }), { type: 'guard' })).toBe('alreadyUsed');
  });

  test('needs the energy', () => {
    const s = edit(toPlayer(battle(['gun-turret'])), (d) => { player(d).energy = 45; });
    expect(can(s, { type: 'guard' })).toBe('noEnergy');
  });

  test('a guarding unit takes 40% less damage and half the push', () => {
    let s = act(toPlayer(battle(['gun-turret'])), { type: 'guard' });
    s = act(s, END);
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(GUARD_DAMAGE).toBe(0.6);
    expect(previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', ALL).damage).toBe(Math.round(48 * 0.8 * 0.6));
    s = act(s, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
    expect(player(s).parts.core!.ap).toBe(220 - 23);
    expect(player(s).stagger).toBe(24);
  });

  test('tracks and shields guard better; the best of them counts', () => {
    const turret = (build: Build) => {
      const s = act(act(toPlayer(battle(['gun-turret'], build)), { type: 'guard' }), END);
      return previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', ALL).damage;
    };
    expect(turret({ ...DEMO_BUILD, legs: 'legs-t-tank' })).toBe(Math.round(48 * 0.8 * 0.5));
    expect(turret({ ...DEMO_BUILD, leftHand: 'shd-t' })).toBe(Math.round(48 * 0.8 * 0.4));
    expect(turret({ ...DEMO_BUILD, legs: 'legs-t-tank', leftHand: 'shd-t' })).toBe(Math.round(48 * 0.8 * 0.4));
  });

  test('a shield does nothing for a unit that is not guarding', () => {
    const s = act(toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, leftHand: 'shd-t' })), END);
    expect(previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', ALL).damage).toBe(38);
  });
});

describe('charge weapons', () => {
  const build: Build = { ...DEMO_BUILD, rightHand: 'wpn-t-charge' };
  const start = () => toPlayer(battle(['gun-turret'], build));

  test('cannot be fired before they are charged', () => {
    expect(can(start(), fire('rightHand'))).toBe('notCharged');
  });

  test('charging pays the energy now and takes the weapon\'s turn', () => {
    const s = act(start(), { type: 'charge', weapon: 'rightHand' });
    expect(player(s)).toMatchObject({ energy: 80, charged: ['rightHand'], heat: 0 });
    expect(player(s).ammo.rightHand).toBe(8);
    expect(s.events.at(-1)).toEqual({ type: 'charge', unit: 'player', weapon: 'rightHand' });
    expect(can(s, fire('rightHand'))).toBe('alreadyFired');
    expect(can(s, { type: 'charge', weapon: 'rightHand' })).toBe('alreadyUsed');
  });

  test('a turn later it fires for free; heat and ammunition are paid then', () => {
    let s = nextRound(act(start(), { type: 'charge', weapon: 'rightHand' }));
    expect(can(s, fire('rightHand'))).toBeNull();
    const energy = player(s).energy;
    s = act(s, fire('rightHand'));
    expect(player(s)).toMatchObject({ energy, charged: [], heat: 34 });
    expect(player(s).ammo.rightHand).toBe(7);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(260 - 90);
    expect(can(s, { type: 'charge', weapon: 'rightHand' })).toBe('alreadyFired');
  });

  test('a charge keeps until it is used', () => {
    let s = act(start(), { type: 'charge', weapon: 'rightHand' });
    s = nextRound(nextRound(s));
    expect(player(s).charged).toEqual(['rightHand']);
    expect(can(s, fire('rightHand'))).toBeNull();
  });

  test('a stagger loses every charge', () => {
    let s = act(start(), { type: 'charge', weapon: 'rightHand' });
    s = edit(s, (d) => { player(d).stagger = 128; });
    s = act(s, END);
    s = act(s, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
    expect(player(s)).toMatchObject({ staggered: 2, charged: [] });
  });

  test('charging needs the energy, the ammunition, working arms and a weapon that charges', () => {
    expect(can(edit(start(), (d) => { player(d).energy = 149; }), { type: 'charge', weapon: 'rightHand' })).toBe('noEnergy');
    expect(can(edit(start(), (d) => { player(d).ammo.rightHand = 0; }), { type: 'charge', weapon: 'rightHand' })).toBe('noAmmo');
    expect(can(edit(start(), (d) => { player(d).parts.arms!.ap = 0; }), { type: 'charge', weapon: 'rightHand' })).toBe('weaponDisabled');
    expect(can(start(), { type: 'charge', weapon: 'leftHand' })).toBe('noWeapon');
    expect(can(start(), { type: 'charge', weapon: 'shoulder' })).toBe('noWeapon');
  });

  test('a charged hand weapon is no use once the arms are gone', () => {
    let s = nextRound(act(start(), { type: 'charge', weapon: 'rightHand' }));
    s = edit(s, (d) => { player(d).parts.arms!.ap = 0; });
    expect(can(s, fire('rightHand'))).toBe('weaponDisabled');
  });
});

describe('melee weapons', () => {
  const build: Build = { ...DEMO_BUILD, rightHand: 'wpn-t-blade' };
  const start = () => toPlayer(battle(['gun-turret'], build));

  test('need a boost in the same turn', () => {
    const s = start();
    expect(can(s, fire('rightHand'))).toBe('needsBoost');
    const boosted = act(s, { type: 'boost' });
    expect(can(boosted, fire('rightHand'))).toBeNull();
    const after = act(boosted, fire('rightHand'));
    expect(player(after).energy).toBe(230 - 69 - 110);
    expect(unit(after, 'enemy-0').parts.core!.ap).toBe(260 - Math.round(95 * 0.8));
    expect(unit(after, 'enemy-0')).toMatchObject({ staggered: 2 });
  });

  test('are no use without legs, and the boost does not carry over to the next turn', () => {
    const legless = edit(start(), (d) => { player(d).parts.legs!.ap = 0; });
    expect(can(legless, { type: 'boost' })).toBe('legsDisabled');
    expect(can(legless, fire('rightHand'))).toBe('needsBoost');
    const later = nextRound(act(start(), { type: 'boost' }));
    expect(can(later, fire('rightHand'))).toBe('needsBoost');
  });
});

describe('burst and salvo', () => {
  test('a burst fires its shots one by one for one round of ammunition, energy and heat', () => {
    const s = act(toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, rightHand: 'wpn-t-burst' })), fire('rightHand'));
    const shots = events(s, 'shot');
    expect(shots).toHaveLength(3);
    expect(player(s)).toMatchObject({ energy: 230 - 90, heat: 22 });
    expect(player(s).ammo.rightHand).toBe(19);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(260 - 3 * 12);
    expect(unit(s, 'enemy-0').stagger).toBe(60);
    expect(previewShot(toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, rightHand: 'wpn-t-burst' })), 'player', 'rightHand', 'enemy-0', 'core', ALL))
      .toMatchObject({ shots: 3, salvo: false });
  });

  test('a burst stops when its target is destroyed', () => {
    let s = toPlayer(battle(['recon-drone', 'gun-turret'], { ...DEMO_BUILD, rightHand: 'wpn-t-burst' }));
    s = edit(s, (d) => { unit(d, 'enemy-0').parts.core!.ap = 30; });
    s = act(s, fire('rightHand'));
    // 20 damage a shot against 30 points of armour: the second shot finishes it and the third is never fired.
    expect(events(s, 'shot')).toHaveLength(2);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
  });

  test('a salvo fires once at every living enemy: the aimed part on the target, the core on the rest', () => {
    const build: Build = { ...DEMO_BUILD, shoulder: 'wpn-t-salvo' };
    let s = toPlayer(battle(['gun-turret', 'recon-drone', 'tank'], build));
    s = edit(s, (d) => { unit(d, 'enemy-1').destroyed = true; });
    expect(previewShot(s, 'player', 'shoulder', 'enemy-2', 'legs', ALL)).toMatchObject({ shots: 1, salvo: true });
    s = act(s, fire('shoulder', 'enemy-2', 'legs'));
    expect(events(s, 'shot').map((e: any) => [e.target, e.part])).toEqual([['enemy-2', 'legs'], ['enemy-0', 'core']]);
    expect(player(s)).toMatchObject({ energy: 230 - 130, heat: 34 });
    expect(player(s).ammo.shoulder).toBe(7);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBeLessThan(260);
    expect(unit(s, 'enemy-2').parts.legs!.ap).toBeLessThan(120);
  });

  test('each shot of a salvo is rolled on its own', () => {
    const build: Build = { ...DEMO_BUILD, shoulder: 'wpn-t-salvo' };
    const rolls = [0, 0.999];
    const s = applyAction(toPlayer(battle(['gun-turret', 'tank'], build)), fire('shoulder'), ALL, () => rolls.shift()!);
    expect(events(s, 'shot').map((e: any) => e.hit)).toEqual([true, false]);
  });

  test('winning with the last shot of a salvo ends the battle', () => {
    const build: Build = { ...DEMO_BUILD, shoulder: 'wpn-t-salvo' };
    let s = toPlayer(battle(['recon-drone', 'recon-drone'], build));
    s = edit(s, (d) => { for (const id of ['enemy-0', 'enemy-1']) unit(d, id).parts.core!.ap = 5; });
    s = act(s, fire('shoulder'));
    expect(s.outcome).toBe('victory');
  });
});

describe('boosters and legs', () => {
  const boosted = (build: Build) => act(toPlayer(battle(['gun-turret'], build)), { type: 'boost' });

  test('the booster sets what a boost gives and costs', () => {
    const stock = boosted(DEMO_BUILD);
    expect(evasion(player(stock), ALL)).toBe(15 + 30);
    expect(player(stock).energy).toBe(230 - 69);
    const vector = boosted({ ...DEMO_BUILD, booster: 'bst-vector' });
    expect(evasion(player(vector), ALL)).toBe(14 + 38);
    const sprint = toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, booster: 'bst-sprint' }));
    expect(boostCost(player(sprint), ALL)).toBe(Math.ceil(0.2 * 220));
  });

  test('reverse joints add thrust, hover makes it cheap, tracks cannot boost at all', () => {
    expect(evasion(player(boosted({ ...DEMO_BUILD, legs: 'legs-t-reverse' })), ALL)).toBe(15 + 38);
    const hover = toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, legs: 'legs-t-hover' }));
    expect(boostCost(player(hover), ALL)).toBe(Math.ceil(0.18 * 230));
    expect(can(toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, legs: 'legs-t-tank' })), { type: 'boost' })).toBe('cannotBoost');
  });

  test('four legs stand firmer and steady the shoulder weapon', () => {
    const quad = toPlayer(battle(['gun-turret'], { ...DEMO_BUILD, legs: 'legs-t-quad' }));
    const biped = toPlayer(battle(['gun-turret']));
    expect(player(quad).staggerMax).toBe(Math.round(129.3 * 1.25));
    const aim = (s: BattleState, slot: 'shoulder' | 'rightHand') => previewShot(s, 'player', slot, 'enemy-0', 'core', ALL).hitChance;
    expect(aim(quad, 'shoulder')).toBe(aim(biped, 'shoulder') + 6);
    expect(aim(quad, 'rightHand')).toBe(aim(biped, 'rightHand'));
    const legless = edit(quad, (d) => { player(d).parts.legs!.ap = 0; });
    expect(aim(legless, 'shoulder')).toBe(aim(biped, 'shoulder'));
  });
});

describe('fire control', () => {
  const aim = (build: Build, slot: 'rightHand' | 'leftHand' | 'shoulder', part: 'core' | 'head' | 'legs' = 'core') =>
    previewShot(toPlayer(battle(['light-mech'], build)), 'player', slot, 'enemy-0', part, ALL).hitChance;

  test('adds aim by the kind of weapon', () => {
    const tracer = { ...DEMO_BUILD, fcs: 'fcs-tracer' };
    expect(aim(tracer, 'rightHand')).toBe(aim(DEMO_BUILD, 'rightHand') + 6);
    expect(aim(tracer, 'leftHand')).toBe(aim(DEMO_BUILD, 'leftHand'));
    const lattice = { ...DEMO_BUILD, fcs: 'fcs-lattice' };
    expect(aim(lattice, 'leftHand')).toBe(aim(DEMO_BUILD, 'leftHand') + 8);
  });

  test('focus takes a share off the penalty for aiming at a limb', () => {
    const lattice = { ...DEMO_BUILD, fcs: 'fcs-lattice' };
    expect(aim(DEMO_BUILD, 'rightHand', 'head')).toBe(aim(DEMO_BUILD, 'rightHand') - 20);
    expect(aim(lattice, 'rightHand', 'head')).toBe(aim(lattice, 'rightHand') - 15);
    expect(aim(lattice, 'rightHand', 'legs')).toBe(aim(lattice, 'rightHand') - 4);
  });
});

describe('modules', () => {
  const withModule = (effect: ModuleEffect, enemies = ['gun-turret']) =>
    toPlayer(battle(enemies, { ...DEMO_BUILD, module: `mod-t-${effect}` }));
  const use = (s: BattleState, target?: string) => act(s, { type: 'module', ...(target ? { target } : {}) });

  test('a mech without one has nothing to activate', () => {
    expect(can(toPlayer(battle(['gun-turret'])), { type: 'module' })).toBe('noModule');
  });

  test('a module is used once a turn, a set number of times a battle, and costs no energy', () => {
    let s = edit(withModule('coolant'), (d) => { player(d).heat = 90; });
    expect(player(s).moduleUses).toBe(2);
    s = use(s);
    expect(player(s)).toMatchObject({ heat: 30, energy: 230, moduleUses: 1 });
    expect(s.events.at(-1)).toEqual({ type: 'module', unit: 'player', effect: 'coolant', amount: 60 });
    expect(can(s, { type: 'module' })).toBe('alreadyUsed');
    s = use(nextRound(s));
    expect(player(s)).toMatchObject({ heat: 0, moduleUses: 0 });
    expect(can(nextRound(s), { type: 'module' })).toBe('noUses');
  });

  test('uses are per battle: the next battle of a contract starts with a full set', () => {
    const s = use(withModule('coolant'));
    const next = createBattle({ ...DEMO_BUILD, module: 'mod-t-coolant' }, [ENEMIES['recon-drone']], ALL, 2, { carry: carryFrom(s) });
    expect(player(next).moduleUses).toBe(2);
  });

  test('barrier: absorbs damage before armour and is gone by the unit\'s next turn', () => {
    let s = use(withModule('barrier'));
    expect(player(s).barrier).toBe(90);
    s = act(s, END);
    s = act(s, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
    expect(player(s).parts.core!.ap).toBe(220);
    expect(player(s).barrier).toBe(90 - 38);
    expect(events(s, 'shot').at(-1)).toMatchObject({ hit: true, damage: 0, absorbed: 38 });
    expect(player(toPlayer(s)).barrier).toBe(0);
  });

  test('barrier: what it cannot absorb reaches the armour', () => {
    let s = edit(use(withModule('barrier')), (d) => { player(d).barrier = 10; });
    s = act(act(s, END), { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
    expect(player(s).parts.core!.ap).toBe(220 - 28);
    expect(events(s, 'shot').at(-1)).toMatchObject({ damage: 28, absorbed: 10 });
  });

  test('overclock: energy now, heat with it', () => {
    const s = use(withModule('overclock'));
    expect(player(s)).toMatchObject({ energy: 380, heat: 25 });
  });

  test('painter: needs a target, and makes it easier to hit for three of its turns', () => {
    let s = withModule('painter', ['light-mech']);
    expect(can(s, { type: 'module' })).toBe('invalidTarget');
    expect(can(s, { type: 'module', target: 'player' })).toBe('invalidTarget');
    const before = previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).hitChance;
    s = use(s, 'enemy-0');
    expect(unit(s, 'enemy-0')).toMatchObject({ painted: 3, paintBonus: 20 });
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).hitChance).toBe(before + 20);
    s = nextRound(nextRound(s));
    expect(unit(s, 'enemy-0').painted).toBe(1);
    s = nextRound(s);
    expect(unit(s, 'enemy-0').painted).toBe(0);
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).hitChance).toBe(before);
  });

  test('nanites: every working part gets a share of its armour back; destroyed parts stay destroyed', () => {
    let s = edit(withModule('nanites'), (d) => {
      const p = player(d).parts;
      p.core!.ap = 100; p.legs!.ap = 140; p.arms!.ap = 0;
    });
    s = use(s);
    const parts = player(s).parts;
    expect(parts.core!.ap).toBe(100 + 44);
    expect(parts.legs!.ap).toBe(150);
    expect(parts.arms!.ap).toBe(0);
    expect(parts.head!.ap).toBe(60);
    expect(s.events.at(-1)).toMatchObject({ type: 'module', effect: 'nanites', amount: 54 });
  });

  test('shock: pushes and scratches every living enemy, and can finish one', () => {
    let s = withModule('shock', ['gun-turret', 'recon-drone']);
    s = edit(s, (d) => { unit(d, 'enemy-1').parts.core!.ap = 10; });
    s = use(s);
    expect(unit(s, 'enemy-0')).toMatchObject({ stagger: 70 });
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(260 - 15);
    expect(unit(s, 'enemy-1').destroyed).toBe(true);
    const last = edit(withModule('shock', ['recon-drone']), (d) => { unit(d, 'enemy-0').parts.core!.ap = 10; });
    expect(use(last).outcome).toBe('victory');
  });

  test('chaff: harder to hit until the unit\'s next turn', () => {
    let s = withModule('chaff');
    const before = previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', ALL).hitChance;
    s = act(use(s), END);
    expect(previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', ALL).hitChance).toBe(before - 25);
    s = toPlayer(s);
    expect(player(s).chaff).toBe(0);
  });

  test('limiter: more damage for the rest of the turn, at a price in heat', () => {
    let s = withModule('limiter');
    const before = previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).damage;
    s = use(s);
    expect(player(s).heat).toBe(30);
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).damage).toBe(Math.round(38 * 0.6 * 1.3));
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).damage).toBeGreaterThan(before);
    s = nextRound(s);
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', ALL).damage).toBe(before);
  });
});

test('what the preview promises is what a hit delivers, whatever the state of both units', () => {
  let s = toPlayer(battle(['heavy-mech'], { ...DEMO_BUILD, module: 'mod-t-limiter', fcs: 'fcs-lattice' }));
  s = act(s, { type: 'module' });
  s = edit(s, (d) => {
    const e = unit(d, 'enemy-0');
    e.staggered = 2; e.guarding = true; e.painted = 2; e.paintBonus = 20;
    player(d).energy = 999;
  });
  for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) {
    const before = unit(s, 'enemy-0').parts.core!.ap;
    const promised = previewShot(s, 'player', slot, 'enemy-0', 'core', ALL).damage;
    s = act(s, fire(slot));
    expect(before - unit(s, 'enemy-0').parts.core!.ap).toBe(promised);
  }
});
