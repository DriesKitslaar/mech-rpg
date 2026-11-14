import { chooseAutoPlayerAction, chooseEnemyAction } from '../../src/core/ai';
import {
  activeUnit, applyAction, checkAction, createBattle, previewShot,
  type Action, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Abilities, BossPhase, Build, EnemyDef, WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { ALL } from '../helpers/testParts';

const END: Action = { type: 'endTurn' };
const hit = () => 0;
const turret = ENEMIES['gun-turret'];
const drone = (abilities: Abilities = {}): EnemyDef => ({ ...ENEMIES['recon-drone'], abilities });
const mech = (extra: Partial<EnemyDef> = {}): EnemyDef => ({ id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD, ...extra });
const battle = (enemies: EnemyDef[], opts: BattleOptions = {}, build: Build = DEMO_BUILD): BattleState =>
  createBattle(build, enemies, ALL, 1, opts);
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const act = (s: BattleState, action: Action) => applyAction(s, action, ALL, hit);
const can = (s: BattleState, action: Action) => checkAction(s, action, ALL);
function to(s: BattleState, id: string): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== id && s.outcome === 'ongoing' && guard++ < 20) s = act(s, END);
  return s;
}
/** The start of the unit's next turn after the one that is running or coming up. */
const again = (s: BattleState, id: string): BattleState => to(act(to(s, id), END), id);
function passRound(s: BattleState): BattleState {
  const round = s.round;
  let guard = 0;
  while (s.round === round && s.outcome === 'ongoing' && guard++ < 20) s = act(s, END);
  return s;
}
const edit = (s: BattleState, fn: (d: BattleState) => void): BattleState => { const c = structuredClone(s); fn(c); return c; };
const fire = (weapon: WeaponSlot, target = 'enemy-0', part: 'core' | 'legs' | 'arms' | 'head' = 'core'): Action => ({ type: 'fire', weapon, target, part });
const kill = (s: BattleState, id: string): BattleState => {
  const ready = edit(to(s, 'player'), (d) => { const u = unit(d, id); u.parts.core!.ap = 1; if (u.parts.legs) u.parts.legs.ap = 0; d.units[0].energy = 999; d.units[0].fired = []; });
  return act(ready, fire('rightHand', id));
};
const damage = (s: BattleState, target: string, slot: WeaponSlot = 'rightHand', from = 'player') => previewShot(s, from, slot, target, 'core', ALL).damage;
const odds = (s: BattleState, target: string, slot: WeaponSlot = 'rightHand', from = 'player') => previewShot(s, from, slot, target, 'core', ALL).hitChance;
const events = (s: BattleState, type: string) => s.events.filter((e) => e.type === type);

test('a plain enemy has no abilities, no phases and a place on the field', () => {
  const s = battle([ENEMIES['recon-drone'], turret]);
  expect(unit(s, 'enemy-0')).toMatchObject({ kind: 'recon-drone', slot: 0, abilities: {}, phases: [], phase: 0 });
  expect(unit(s, 'enemy-1')).toMatchObject({ kind: 'gun-turret', slot: 1 });
});

describe('aegis', () => {
  test('other enemies take a share of the damage while the shield unit lives; it does not shield itself', () => {
    const plain = to(battle([drone(), turret]), 'player');
    const shielded = to(battle([drone({ aegis: 0.6 }), turret]), 'player');
    expect(damage(plain, 'enemy-1')).toBe(23);
    expect(damage(shielded, 'enemy-1')).toBe(14);
    expect(damage(shielded, 'enemy-0')).toBe(damage(plain, 'enemy-0'));
  });

  test('ends when the shield unit is destroyed', () => {
    const s = kill(battle([drone({ aegis: 0.6 }), turret]), 'enemy-0');
    expect(damage(s, 'enemy-1')).toBe(23);
  });

  test('two shields do not add up: the stronger one counts, and they cover each other', () => {
    const s = to(battle([drone({ aegis: 0.6 }), drone({ aegis: 0.5 }), turret]), 'player');
    expect(damage(s, 'enemy-2')).toBe(11);
    expect(damage(s, 'enemy-0')).toBe(19);
    expect(damage(s, 'enemy-1')).toBe(23);
  });

  test('a shock pulse is weakened too', () => {
    const build = { ...DEMO_BUILD, module: 'mod-t-shock' };
    const plain = act(to(battle([drone(), turret], {}, build), 'player'), { type: 'module' });
    const shielded = act(to(battle([drone({ aegis: 0.6 }), turret], {}, build), 'player'), { type: 'module' });
    expect(unit(plain, 'enemy-1').parts.core!.ap).toBe(260 - 15);
    expect(unit(shielded, 'enemy-1').parts.core!.ap).toBe(260 - 9);
  });

  test('the player gets nothing from it', () => {
    const s = to(battle([drone({ aegis: 0.6 }), turret]), 'enemy-1');
    const plain = to(battle([drone(), turret]), 'enemy-1');
    expect(damage(s, 'player', 'shoulder', 'enemy-1')).toBe(damage(plain, 'player', 'shoulder', 'enemy-1'));
  });
});

describe('jam', () => {
  test('the player aims worse while the jammer lives; enemies aim as they did', () => {
    const plain = to(battle([drone(), turret]), 'player');
    const jammed = to(battle([drone({ jam: 20 }), turret]), 'player');
    expect(odds(plain, 'enemy-1')).toBe(90);
    expect(odds(jammed, 'enemy-1')).toBe(70);
    expect(odds(jammed, 'player', 'shoulder', 'enemy-1')).toBe(odds(plain, 'player', 'shoulder', 'enemy-1'));
  });

  test('two jammers do not add up, and it ends with the jammer', () => {
    const s = to(battle([drone({ jam: 20 }), drone({ jam: 15 }), turret]), 'player');
    expect(odds(s, 'enemy-2')).toBe(70);
    const one = kill(s, 'enemy-0');
    expect(odds(one, 'enemy-2')).toBe(75);
    expect(odds(kill(one, 'enemy-1'), 'enemy-2')).toBe(90);
  });
});

describe('mend', () => {
  const start = () => to(battle([drone({ mend: 0.25 }), mech(), mech()]), 'enemy-0');
  const hurt = (s: BattleState, fn: (m: UnitState) => void) => edit(s, (d) => fn(unit(d, 'enemy-1')));

  test('restores a share of the most damaged living part of an ally, and takes the turn', () => {
    let s = hurt(start(), (m) => { m.parts.core!.ap = 100; m.parts.arms!.ap = 20; m.parts.legs!.ap = 0; });
    s = act(s, { type: 'mend', target: 'enemy-1' });
    expect(unit(s, 'enemy-1').parts).toMatchObject({ core: { ap: 100 }, arms: { ap: 48 }, legs: { ap: 0 } });
    expect(events(s, 'mend')).toEqual([{ type: 'mend', unit: 'enemy-0', target: 'enemy-1', part: 'arms', amount: 28 }]);
    expect(activeUnit(s).id).not.toBe('enemy-0');
  });

  test('never fills a part beyond its armour', () => {
    const s = act(hurt(start(), (m) => { m.parts.arms!.ap = 100; }), { type: 'mend', target: 'enemy-1' });
    expect(unit(s, 'enemy-1').parts.arms!.ap).toBe(110);
    expect(events(s, 'mend')).toMatchObject([{ amount: 10 }]);
  });

  test('is refused for itself, the player, the dead, the undamaged, and units that cannot mend', () => {
    const s = hurt(start(), (m) => { m.parts.core!.ap = 100; });
    expect(can(s, { type: 'mend', target: 'enemy-1' })).toBeNull();
    expect(can(s, { type: 'mend', target: 'enemy-0' })).toBe('invalidTarget');
    expect(can(s, { type: 'mend', target: 'player' })).toBe('invalidTarget');
    expect(can(s, { type: 'mend', target: 'nobody' })).toBe('invalidTarget');
    expect(can(s, { type: 'mend', target: 'enemy-2' })).toBe('partFull');
    const dead = edit(s, (d) => { const m = unit(d, 'enemy-1'); m.parts.core!.ap = 0; m.destroyed = true; });
    expect(can(dead, { type: 'mend', target: 'enemy-1' })).toBe('invalidTarget');
    // A part that is gone stays gone: with nothing else to patch there is nothing to do.
    const armless = hurt(start(), (m) => { m.parts.arms!.ap = 0; });
    expect(can(armless, { type: 'mend', target: 'enemy-1' })).toBe('partFull');
    expect(can(to(act(s, END), 'player'), { type: 'mend', target: 'enemy-1' })).toBe('noAbility');
  });

  test('the enemy mends the ally that needs it most, and fires when nobody does', () => {
    const s = start();
    expect(chooseEnemyAction(s, ALL)).toMatchObject({ type: 'fire', target: 'player' });
    const wounded = edit(s, (d) => { unit(d, 'enemy-1').parts.core!.ap = 200; unit(d, 'enemy-2').parts.head!.ap = 10; });
    expect(chooseEnemyAction(wounded, ALL)).toEqual({ type: 'mend', target: 'enemy-2' });
  });
});

describe('bomb', () => {
  const crawler = (fuse = 2) => drone({ bomb: { fuse, damage: 80 } });

  test('the fuse burns down at the start of each of its turns, and then it blows up on the player', () => {
    let s = battle([crawler()]);
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(unit(s, 'enemy-0').fuse).toBe(1);
    expect(events(s, 'fuse')).toEqual([{ type: 'fuse', unit: 'enemy-0', left: 1 }]);
    const before = unit(s, 'player').parts.core!.ap;
    s = passRound(s);
    expect(events(s, 'blast')).toEqual([{ type: 'blast', unit: 'enemy-0', target: 'player', damage: 80 }]);
    expect(unit(s, 'player').parts.core!.ap).toBe(before - 80);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(s.events.some((e) => e.type === 'unitDestroyed' && e.unit === 'enemy-0')).toBe(true);
    expect(s.outcome).toBe('victory');
  });

  test('a guard takes the edge off the blast, which otherwise knocks a mech off its feet', () => {
    const heavy = () => to(battle([drone({ bomb: { fuse: 2, damage: 130 } }), turret]), 'player');
    const before = unit(heavy(), 'player').parts.core!.ap;
    // The player ends the turn, then the turret; the new round opens with the bomb.
    const braced = act(act(act(heavy(), { type: 'guard' }), END), END);
    expect(events(braced, 'blast')).toMatchObject([{ damage: 78 }]);
    expect(unit(braced, 'player').parts.core!.ap).toBe(before - 78);
    expect(events(braced, 'stagger')).toEqual([]);
    const open = act(act(heavy(), END), END);
    expect(events(open, 'blast')).toMatchObject([{ damage: 130 }]);
    expect(events(open, 'stagger')).toEqual([{ type: 'stagger', unit: 'player' }]);
  });

  test('a barrier takes the blast before the armour does', () => {
    const build = { ...DEMO_BUILD, module: 'mod-t-barrier' };
    let s = to(battle([crawler(), turret], {}, build), 'player');
    const before = unit(s, 'player').parts.core!.ap;
    s = act(act(act(s, { type: 'module' }), END), END);
    expect(events(s, 'blast')).toMatchObject([{ damage: 0 }]);
    expect(unit(s, 'player').parts.core!.ap).toBe(before);
  });

  test('a destroyed bomb never goes off', () => {
    let s = kill(battle([crawler(3), turret]), 'enemy-0');
    const ticks = events(s, 'fuse').length;
    for (let i = 0; i < 4; i++) s = passRound(s);
    expect(events(s, 'blast')).toEqual([]);
    expect(events(s, 'fuse')).toHaveLength(ticks);
  });

  test('goes off once, and the blast can lose the battle as well as win it', () => {
    let s = edit(battle([crawler()]), (d) => { d.units[0].parts.core!.ap = 10; });
    s = passRound(s);
    expect(events(s, 'blast')).toHaveLength(1);
    expect(s.outcome).toBe('defeat');
  });

  test('is as strong as the contract makes its enemies', () => {
    const s = passRound(battle([crawler(), turret], { enemyScale: 1.5 }));
    expect(events(s, 'blast')).toMatchObject([{ damage: 120 }]);
  });
});

describe('carrier', () => {
  const carrier = (every = 2): EnemyDef => ({ ...turret, id: 'test-carrier', name: 'Carrier', abilities: { carrier: { unit: ENEMIES['recon-drone'], every } } });

  test('launches a unit every few of its own turns', () => {
    let s = to(battle([carrier()]), 'enemy-0');
    expect(s.units).toHaveLength(2);
    s = again(s, 'enemy-0');
    expect(s.units).toHaveLength(3);
    expect(events(s, 'launch')).toEqual([{ type: 'launch', unit: 'enemy-0', spawned: 'enemy-1' }]);
    expect(unit(s, 'enemy-1')).toMatchObject({ name: 'Recon Drone A', side: 'enemy', kind: 'recon-drone', slot: 1, destroyed: false });
    s = again(again(s, 'enemy-0'), 'enemy-0');
    expect(s.units).toHaveLength(4);
    expect(unit(s, 'enemy-2')).toMatchObject({ name: 'Recon Drone B', slot: 2 });
  });

  test('the new unit acts from the next round on', () => {
    let s = again(to(battle([carrier()]), 'enemy-0'), 'enemy-0');
    expect(s.order).not.toContain('enemy-1');
    s = passRound(s);
    expect(s.order).toContain('enemy-1');
  });

  test('never has more than three enemies standing, and fills the place of one that fell', () => {
    let s = battle([carrier(1), turret]);
    for (let i = 0; i < 4; i++) s = passRound(s);
    expect(s.units.filter((u) => u.side === 'enemy' && !u.destroyed)).toHaveLength(3);
    expect(events(s, 'launch')).toHaveLength(1);
    expect(unit(s, 'enemy-2').slot).toBe(2);
    s = again(kill(s, 'enemy-1'), 'enemy-0');
    expect(events(s, 'launch')).toHaveLength(2);
    expect(unit(s, 'enemy-3')).toMatchObject({ slot: 1, name: 'Recon Drone B' });
  });

  test('what it launches is as strong as the contract makes its enemies', () => {
    const s = to(battle([carrier(1)], { enemyScale: 1.5 }), 'enemy-0');
    expect(unit(s, 'enemy-1').parts.core!.maxAp).toBe(75);
    expect(unit(s, 'enemy-1').mods.damage).toBe(1.5);
  });

  test('an objective keeps pointing at the unit it named', () => {
    let s = battle([carrier(1), turret], { objective: { type: 'leader', target: 1 } });
    s = passRound(passRound(s));
    expect(s.units.length).toBeGreaterThan(3);
    expect(kill(s, 'enemy-2').outcome).toBe('ongoing');
    expect(kill(s, 'enemy-1').outcome).toBe('victory');
  });

  test('a destroyed carrier launches nothing more', () => {
    let s = kill(battle([carrier(1), turret]), 'enemy-0');
    const launched = events(s, 'launch').length;
    for (let i = 0; i < 3; i++) s = passRound(s);
    expect(events(s, 'launch')).toHaveLength(launched);
  });
});

describe('phases', () => {
  const boss = (phases: BossPhase[]) => mech({ phases, build: { ...STARTER_BUILD, module: 'mod-t-coolant' } });
  const wound = (s: BattleState, ap: number) => edit(to(s, 'player'), (d) => { unit(d, 'enemy-0').parts.core!.ap = ap; d.units[0].energy = 999; d.units[0].fired = []; });

  test('a boss changes when its core falls to the share: its ways, its damage, its balance, its module', () => {
    let s = edit(wound(battle([boss([{ at: 0.5, ai: 'bruiser', damage: 1.5, evasion: 10 }])]), 120), (d) => {
      const b = unit(d, 'enemy-0'); b.stagger = 50; b.moduleUses = 0;
    });
    s = act(s, fire('rightHand'));
    const b = unit(s, 'enemy-0');
    expect(b.parts.core!.ap).toBe(90);
    expect(b).toMatchObject({ phase: 1, ai: 'bruiser', stagger: 0, staggered: 0, moduleUses: 2 });
    expect(b.mods).toMatchObject({ damage: 1.5, evasion: 10 });
    expect(events(s, 'phase')).toEqual([{ type: 'phase', unit: 'enemy-0', phase: 1 }]);
  });

  test('nothing changes while the core is above the share', () => {
    const s = act(wound(battle([boss([{ at: 0.5, damage: 1.5 }])]), 200), fire('rightHand'));
    expect(unit(s, 'enemy-0')).toMatchObject({ phase: 0, ai: 'gunner' });
    expect(events(s, 'phase')).toEqual([]);
  });

  test('each phase begins once and in order, even when one hit crosses two, and never again after repairs', () => {
    let s = act(wound(battle([boss([{ at: 0.66, damage: 1.2 }, { at: 0.33, damage: 1.5, ai: 'sprayer' }])]), 80), fire('rightHand'));
    expect(events(s, 'phase')).toEqual([{ type: 'phase', unit: 'enemy-0', phase: 1 }, { type: 'phase', unit: 'enemy-0', phase: 2 }]);
    expect(unit(s, 'enemy-0')).toMatchObject({ phase: 2, ai: 'sprayer' });
    expect(unit(s, 'enemy-0').mods.damage).toBeCloseTo(1.8);
    s = act(wound(s, 220), fire('leftHand'));
    s = act(wound(s, 60), fire('rightHand'));
    expect(events(s, 'phase')).toHaveLength(2);
  });

  test('a destroyed boss does not change', () => {
    const s = act(wound(battle([boss([{ at: 0.5, damage: 1.5 }])]), 5), fire('rightHand'));
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(events(s, 'phase')).toEqual([]);
    expect(unit(s, 'enemy-0').phase).toBe(0);
  });

  test('a phase can bring out other weapons and another module', () => {
    let s = edit(wound(battle([boss([{ at: 0.5, refit: { rightHand: 'wpn-t-charge', shoulder: 'wpn-mortar-pod', module: 'mod-t-barrier' } }])]), 120), (d) => {
      unit(d, 'enemy-0').charged = ['rightHand'];
    });
    s = act(s, fire('rightHand'));
    const b = unit(s, 'enemy-0');
    expect(b.build).toMatchObject({ rightHand: 'wpn-t-charge', shoulder: 'wpn-mortar-pod', module: 'mod-t-barrier', core: STARTER_BUILD.core });
    expect(b.ammo).toEqual({ rightHand: null, shoulder: null });
    expect(b.charged).toEqual([]);
    expect(b.moduleUses).toBe(1);
  });

  test('a shock pulse can start one too', () => {
    const build = { ...DEMO_BUILD, module: 'mod-t-shock' };
    const s = act(wound(battle([boss([{ at: 0.5, damage: 1.5 }])], {}, build), 115), { type: 'module' });
    expect(events(s, 'phase')).toHaveLength(1);
  });
});

describe('support', () => {
  const backed = (enemies: EnemyDef[], opts: BattleOptions = {}) => battle(enemies, { support: { name: 'Ashfall', damage: 40 }, ...opts });

  test('an ally off the field hits the strongest enemy at the start of every round after the first', () => {
    let s = backed([drone(), turret]);
    expect(s.support).toEqual({ name: 'Ashfall', damage: 40 });
    expect(events(s, 'support')).toEqual([]);
    s = passRound(s);
    expect(events(s, 'support')).toEqual([{ type: 'support', name: 'Ashfall', target: 'enemy-1', damage: 40 }]);
    expect(unit(s, 'enemy-1').parts.core!.ap).toBe(260 - 40);
    s = passRound(s);
    expect(unit(s, 'enemy-1').parts.core!.ap).toBe(260 - 80);
  });

  test('pushes its target off balance, and can win the battle', () => {
    let s = passRound(backed([turret]));
    expect(unit(s, 'enemy-0').stagger).toBeGreaterThan(0);
    s = passRound(edit(s, (d) => { unit(d, 'enemy-0').parts.core!.ap = 20; }));
    expect(s.outcome).toBe('victory');
  });

  test('leaves alone the machine the client wants in one piece', () => {
    let s = backed([mech(), drone()], { objective: { type: 'disable', target: 0 } });
    s = passRound(s);
    expect(events(s, 'support')).toMatchObject([{ target: 'enemy-1' }]);
    s = passRound(kill(s, 'enemy-1'));
    expect(events(s, 'support')).toHaveLength(1);
    expect(s.outcome).toBe('ongoing');
  });
});

describe('the automatic player', () => {
  const first = (s: BattleState) => chooseAutoPlayerAction(to(s, 'player'), ALL);

  test('shoots the units that help the others before the weakest', () => {
    expect(first(battle([mech(), turret]))).toMatchObject({ type: 'fire', target: 'enemy-0' });
    for (const abilities of [{ aegis: 0.6 }, { mend: 0.2 }, { jam: 20 }] as Abilities[]) {
      expect(first(battle([mech(), { ...turret, abilities }]))).toMatchObject({ type: 'fire', target: 'enemy-1' });
    }
  });

  test('braces before a bomb goes off, then shoots it', () => {
    const s = to(battle([mech(), drone({ bomb: { fuse: 2, damage: 80 } })]), 'player');
    expect(unit(s, 'enemy-1').fuse).toBe(1);
    expect(chooseAutoPlayerAction(s, ALL)).toEqual({ type: 'guard' });
    expect(chooseAutoPlayerAction(act(s, { type: 'guard' }), ALL)).toMatchObject({ type: 'fire', target: 'enemy-1' });
  });

  test('uses a shock pulse freely, but not near a machine it has to take in one piece', () => {
    const build = { ...DEMO_BUILD, module: 'mod-t-shock' };
    expect(first(battle([mech()], {}, build))).toEqual({ type: 'module' });
    const careful = first(battle([mech()], { objective: { type: 'disable', target: 0 } }, build));
    expect(careful).toMatchObject({ type: 'fire', part: 'legs' });
  });

  test('takes its stance before it shoots when all it has to do is last', () => {
    const action = first(battle([turret, turret], { objective: { type: 'survive', rounds: 4 } }));
    expect(['guard', 'boost']).toContain(action.type);
  });
});
