import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import {
  HEAT_LIMIT, activeUnit, applyAction, checkAction, createBattle,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Build, Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

const hit = () => 0;
const miss = () => 0.999;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits: the pilot who outguns the field. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };

const fire = (weapon: 'rightHand' | 'leftHand' | 'shoulder', target: string): Action => ({ type: 'fire', weapon, target, part: 'core' });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
/** Ends enemy turns until the pilot is the active unit. */
function toPlayer(s: BattleState, catalog: Catalog): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
function field(enemyIds: string[], catalog: Catalog = HEAVY, opts: BattleOptions = {}, build: Build = DEMO_BUILD): BattleState {
  return toPlayer(createBattle(build, enemyIds.map((id) => ENEMIES[id]), catalog, 1, opts), catalog);
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
const momentum = (s: BattleState): Extract<BattleEvent, { type: 'momentum' }>[] =>
  s.events.filter((e): e is Extract<BattleEvent, { type: 'momentum' }> => e.type === 'momentum');

describe('a volley that destroys a machine', () => {
  test('readies the weapon again and gives back the energy it took; the heat and the round stay spent', () => {
    // Nobody has a chain before anybody has had a turn.
    expect(createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['gun-turret']], HEAVY, 1).units.map((u) => u.chain)).toEqual([0, 0, 0]);
    const before = field(['recon-drone', 'recon-drone', 'gun-turret']);
    const had = player(before);
    expect(had.chain).toBe(0);
    const s = applyAction(before, fire('rightHand', 'enemy-0'), HEAVY, hit);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    const me = player(s);
    expect(me.fired).not.toContain('rightHand');
    expect(me.energy).toBe(had.energy);
    expect(me.heat).toBe(had.heat + rifle.heat);
    expect(me.ammo.rightHand).toBe(rifle.ammo! - 1);
    expect(me.chain).toBe(1);
    expect(momentum(s)).toEqual([{ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 1 }]);
    // It is offered again, in the same turn, at another machine.
    expect(checkAction(s, fire('rightHand', 'enemy-1'), HEAVY)).toBeNull();
    expect(activeUnit(s).id).toBe('player');
  });

  test('and so one weapon goes through a field in a turn, for a pilot who outguns it', () => {
    let s = field(['recon-drone', 'recon-drone', 'gun-turret']);
    const had = player(s).energy;
    for (const target of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire('rightHand', target), HEAVY, hit);
    expect(s.outcome).toBe('victory');
    expect(s.round).toBe(1);
    expect(player(s).chain).toBe(3);
    // The third ended the battle: there was nothing left to be ready for, and nothing is said of it.
    expect(momentum(s).map((e) => e.chain)).toEqual([1, 2]);
    expect(s.events.slice(-2).map((e) => e.type)).toEqual(['unitDestroyed', 'outcome']);
    expect(player(s).energy).toBe(had);
    expect(player(s).heat).toBe(3 * rifle.heat);
    expect(player(s).ammo.rightHand).toBe(rifle.ammo! - 3);
  });

  test('that only wounds it, or misses it, readies nothing: the weapon has fired for this turn', () => {
    // The rifle as it is made takes a bite out of a turret's housing and no more.
    const plain = field(['gun-turret', 'gun-turret'], CATALOG);
    const wounded = applyAction(plain, fire('rightHand', 'enemy-0'), CATALOG, hit);
    expect(unit(wounded, 'enemy-0').destroyed).toBe(false);
    expect(unit(wounded, 'enemy-0').parts.core!.ap).toBeLessThan(unit(plain, 'enemy-0').parts.core!.ap);
    const missed = applyAction(field(['gun-turret', 'gun-turret']), fire('rightHand', 'enemy-0'), HEAVY, miss);
    for (const [s, catalog] of [[wounded, CATALOG], [missed, HEAVY]] as const) {
      expect(player(s).fired).toContain('rightHand');
      expect(player(s).energy).toBe(player(plain).energy - rifle.energy);
      expect(player(s).chain).toBe(0);
      expect(momentum(s)).toEqual([]);
      expect(checkAction(s, fire('rightHand', 'enemy-1'), catalog)).toBe('alreadyFired');
    }
  });

  test('counts towards the chain of that turn only: the next turn starts from nothing', () => {
    let s = field(['recon-drone', 'recon-drone', 'gun-turret']);
    s = applyAction(s, fire('rightHand', 'enemy-0'), HEAVY, hit);
    expect(player(s).chain).toBe(1);
    s = toPlayer(applyAction(s, END, HEAVY), HEAVY);
    expect(s.round).toBe(2);
    expect(player(s).chain).toBe(0);
    // One more, a turn later, is the first of a new chain.
    s = applyAction(s, fire('rightHand', 'enemy-1'), HEAVY, hit);
    expect(player(s).chain).toBe(1);
    expect(momentum(s).map((e) => e.chain)).toEqual([1, 1]);
    // An enemy's turn does not touch it either: it is the pilot's own turn beginning that does.
    expect(s.units.filter((u) => u.side === 'enemy').every((u) => u.chain === 0)).toBe(true);
  });

  test('with the other weapons still to fire: a kill takes nothing away from what the turn had', () => {
    let s = field(['recon-drone', 'gun-turret']);
    s = applyAction(s, fire('rightHand', 'enemy-0'), HEAVY, hit);
    expect(checkAction(s, fire('leftHand', 'enemy-1'), HEAVY)).toBeNull();
    s = applyAction(s, fire('leftHand', 'enemy-1'), HEAVY, hit);
    // The pistol wounded the turret: it has fired. The rifle is still ready.
    expect(player(s).fired).toEqual(['leftHand']);
    expect(checkAction(s, fire('rightHand', 'enemy-1'), HEAVY)).toBeNull();
  });

  test('readies the weapon that did it and no other: one that fired before it has fired', () => {
    let s = field(['recon-drone', 'gun-turret']);
    s = applyAction(s, fire('leftHand', 'enemy-1'), HEAVY, hit);
    s = applyAction(s, fire('shoulder', 'enemy-1'), HEAVY, hit);
    expect(player(s).fired).toEqual(['leftHand', 'shoulder']);
    s = applyAction(s, fire('rightHand', 'enemy-0'), HEAVY, hit);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(player(s).fired).toEqual(['leftHand', 'shoulder']);
    expect(checkAction(s, fire('leftHand', 'enemy-1'), HEAVY)).toBe('alreadyFired');
  });
});

describe('what a run is held to', () => {
  test('the heat: a volley that takes the mech past its limit costs the next turn, ready or not', () => {
    const hot: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900, heat: 110 } };
    let s = field(['recon-drone', 'recon-drone', 'gun-turret'], hot);
    s = applyAction(s, fire('rightHand', 'enemy-0'), hot, hit);
    expect(player(s).heat).toBe(110);
    expect(player(s).heat).toBeGreaterThan(HEAT_LIMIT);
    expect(player(s).overheated).toBe(true);
    // The weapon is ready all the same, and this turn is the pilot's still; the one after is not.
    expect(checkAction(s, fire('rightHand', 'enemy-1'), hot)).toBeNull();
    s = applyAction(s, END, hot);
    // The two that are left take their turns, and take them again before the pilot is heard from.
    const skipped = (): boolean => s.events.some((e) => e.type === 'turnSkipped' && e.unit === 'player');
    for (let guard = 0; !skipped() && activeUnit(s).id !== 'player' && guard < 10; guard++) s = applyAction(s, END, hot);
    expect(s.outcome).toBe('ongoing');
    expect(skipped()).toBe(true);
    expect(s.round).toBe(2);
  });

  test('a run of two that ends in an overheat is paid for only if there is a next turn: what was left has gone by then', () => {
    const hot: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900, heat: 60 } };
    let s = field(['recon-drone', 'recon-drone', 'gun-turret'], hot);
    s = applyAction(s, fire('rightHand', 'enemy-0'), hot, hit);
    expect(player(s).overheated).toBe(false);
    s = applyAction(s, fire('rightHand', 'enemy-1'), hot, hit);
    expect(player(s).heat).toBe(120);
    expect(player(s).overheated).toBe(true);
    // The turret saw both drones go: it leaves at its turn, and the battle is over before the lost turn comes.
    s = applyAction(s, END, hot);
    expect(s.outcome).toBe('victory');
    expect(s.events.some((e) => e.type === 'turnSkipped')).toBe(false);
  });

  test('the magazine: the last round of it is the last volley', () => {
    let s = edit(field(['recon-drone', 'recon-drone']), (draft) => { player(draft).ammo.rightHand = 1; });
    s = applyAction(s, fire('rightHand', 'enemy-0'), HEAVY, hit);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(player(s).ammo.rightHand).toBe(0);
    expect(checkAction(s, fire('rightHand', 'enemy-1'), HEAVY)).toBe('noAmmo');
  });

  test('a weapon that has to be charged has to be charged again', () => {
    const coil = CATALOG['wpn-coil-pistol'] as Weapon;
    const catalog: Catalog = { ...CATALOG, 'wpn-coil-pistol': { ...coil, damage: 900 } };
    const build: Build = { ...DEMO_BUILD, rightHand: 'wpn-coil-pistol' };
    let s = field(['recon-drone', 'recon-drone'], catalog, {}, build);
    s = applyAction(s, { type: 'charge', weapon: 'rightHand' }, catalog);
    s = toPlayer(applyAction(s, END, catalog), catalog);
    const had = player(s).energy;
    s = applyAction(s, fire('rightHand', 'enemy-0'), catalog, hit);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(player(s).chain).toBe(1);
    // Firing what was charged took no energy, so there is none to give back.
    expect(player(s).energy).toBe(had);
    expect(checkAction(s, fire('rightHand', 'enemy-1'), catalog)).toBe('notCharged');
    expect(checkAction(s, { type: 'charge', weapon: 'rightHand' }, catalog)).toBeNull();
  });

  test('a salvo that destroys one machine of three is ready again, like any volley that destroys one', () => {
    const salvo = CATALOG['wpn-micro-salvo'] as Weapon;
    // Enough for a drone's shell, far too little for a turret's housing.
    const catalog: Catalog = { ...CATALOG, 'wpn-micro-salvo': { ...salvo, damage: 60 } };
    const build: Build = { ...DEMO_BUILD, shoulder: 'wpn-micro-salvo' };
    let s = field(['recon-drone', 'gun-turret', 'gun-turret'], catalog, {}, build);
    const had = player(s).energy;
    s = applyAction(s, fire('shoulder', 'enemy-1'), catalog, hit);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([true, false, false]);
    expect(player(s).fired).toEqual([]);
    expect(player(s).energy).toBe(had);
    expect(player(s).chain).toBe(1);
    expect(checkAction(s, fire('shoulder', 'enemy-1'), catalog)).toBeNull();
  });
});

describe('a salvo that destroys two machines at once', () => {
  test('is paid back once, counts two, and says so twice', () => {
    const salvo = CATALOG['wpn-micro-salvo'] as Weapon;
    const catalog: Catalog = { ...CATALOG, 'wpn-micro-salvo': { ...salvo, damage: 60 } };
    const build: Build = { ...DEMO_BUILD, shoulder: 'wpn-micro-salvo' };
    let s = field(['recon-drone', 'gun-turret', 'recon-drone'], catalog, {}, build);
    const had = player(s).energy;
    s = applyAction(s, fire('shoulder', 'enemy-1'), catalog, hit);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([true, false, true]);
    // The energy of one volley, not of two.
    expect(player(s).energy).toBe(had);
    expect(player(s).chain).toBe(2);
    expect(momentum(s).map((e) => [e.weapon, e.chain])).toEqual([['shoulder', 1], ['shoulder', 2]]);
    expect(checkAction(s, fire('shoulder', 'enemy-1'), catalog)).toBeNull();
  });
});

describe('what does not make a run', () => {
  test('a machine destroyed by the ally off the field: the pilot\'s weapons are as they were', () => {
    // The ally fires as a round begins, from the second on, at the strongest machine standing.
    let s = field(['recon-drone', 'recon-drone'], HEAVY, { support: { name: 'Ashfall', damage: 999 } });
    s = toPlayer(applyAction(s, END, HEAVY), HEAVY);
    expect(s.round).toBe(2);
    expect(s.events.some((e) => e.type === 'support')).toBe(true);
    expect(s.units.filter((u) => u.side === 'enemy' && u.destroyed)).toHaveLength(1);
    expect(player(s).chain).toBe(0);
    expect(momentum(s)).toEqual([]);
  });

  test('every run written down follows a volley of the same unit that destroyed something', () => {
    let s = field(['recon-drone', 'recon-drone', 'gun-turret'], HEAVY, { support: { name: 'Ashfall', damage: 40 } });
    for (let guard = 0; s.outcome === 'ongoing' && guard < 400; guard++) {
      s = applyAction(s, activeUnit(s).side === 'player' ? chooseAutoPlayerAction(s, HEAVY) : END, HEAVY);
    }
    expect(s.outcome).toBe('victory');
    expect(momentum(s).length).toBeGreaterThan(0);
    s.events.forEach((event, at) => {
      if (event.type !== 'momentum') return;
      // Back to the volley's first shot: everything between is that volley's doing.
      const volley = s.events.slice(0, at).reverse();
      const since = volley.findIndex((e) => e.type !== 'shot' && e.type !== 'unitDestroyed' && e.type !== 'partDestroyed' && e.type !== 'stagger' && e.type !== 'phase');
      const own = volley.slice(0, since < 0 ? volley.length : since);
      expect(own.some((e) => e.type === 'shot' && e.unit === event.unit && e.weapon === event.weapon)).toBe(true);
      expect(own.some((e) => e.type === 'unitDestroyed')).toBe(true);
    });
  });
});

describe('the Overdrive beside a run', () => {
  test('a turn started over keeps the chain it had, and gives the other weapons back as it always did', () => {
    let s = field(['recon-drone', 'gun-turret', 'gun-turret'], HEAVY, { overdrive: 'second-wind', drive: 100 });
    s = applyAction(s, fire('rightHand', 'enemy-0'), HEAVY, hit);
    s = applyAction(s, fire('leftHand', 'enemy-1'), HEAVY, hit);
    expect(player(s).fired).toEqual(['leftHand']);
    s = applyAction(s, { type: 'overdrive' }, HEAVY);
    expect(player(s).fired).toEqual([]);
    expect(player(s).chain).toBe(1);
    s = applyAction(s, fire('rightHand', 'enemy-1'), HEAVY, hit);
    expect(player(s).chain).toBe(2);
  });

  test('under Deadeye every volley hits, so a run is only as long as the heat and the magazine allow', () => {
    let s = field(['recon-drone', 'recon-drone', 'recon-drone'], HEAVY, { overdrive: 'deadeye', drive: 100 });
    s = applyAction(s, { type: 'overdrive' }, HEAVY);
    // The dice would miss every time; Deadeye does not ask them.
    for (const target of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire('rightHand', target), HEAVY, miss);
    expect(s.outcome).toBe('victory');
    expect(player(s).chain).toBe(3);
  });
});

describe('the automatic player', () => {
  test('goes on with a weapon that is ready again: two machines it can destroy in a volley each fall in one turn', () => {
    let s = field(['recon-drone', 'recon-drone']);
    const round = s.round;
    for (let guard = 0; activeUnit(s).id === 'player' && s.outcome === 'ongoing' && guard < 12; guard++) {
      s = applyAction(s, chooseAutoPlayerAction(s, HEAVY), HEAVY, hit);
    }
    expect(s.outcome).toBe('victory');
    expect(s.round).toBe(round);
    expect(player(s).chain).toBe(2);
  });
});

describe('a fight that is not open', () => {
  test('a kill readies nothing where somebody leads: the weapon has fired, and nothing is counted', () => {
    const before = field(['magpie', 'recon-drone']);
    expect(before.open).toBe(false);
    const s = applyAction(before, fire('rightHand', 'enemy-1'), HEAVY, hit);
    expect(unit(s, 'enemy-1').destroyed).toBe(true);
    expect(player(s).fired).toEqual(['rightHand']);
    expect(player(s).energy).toBe(player(before).energy - rifle.energy);
    expect(player(s).chain).toBe(0);
    expect(momentum(s)).toEqual([]);
    expect(checkAction(s, fire('rightHand', 'enemy-0'), HEAVY)).toBe('alreadyFired');
  });

  test('nor against one machine, whatever it sends out', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES.carrier], HEAVY, 1);
    for (let guard = 0; !s.events.some((e) => e.type === 'launch') && guard < 60; guard++) s = applyAction(s, END, HEAVY);
    s = toPlayer(s, HEAVY);
    const drone = s.units.at(-1)!;
    expect(drone.kind).toBe('recon-drone');
    expect(s.open).toBe(false);
    s = applyAction(s, fire('rightHand', drone.id), HEAVY, hit);
    expect(unit(s, drone.id).destroyed).toBe(true);
    expect(player(s).fired).toEqual(['rightHand']);
    expect(player(s).chain).toBe(0);
    expect(momentum(s)).toEqual([]);
  });

  /**
   * Fights against one machine and fights somebody leads, played to the end by the automatic player
   * in the best frame: how each ended, in how many rounds and events, what was left of the pilot's
   * core, where the dice stood, and how many machines fell. Recorded on the game as it was before
   * these rules: such a fight is that fight still, shot for shot.
   */
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

  test.each(AS_IT_WAS)('%j from seed %i is the fight it always was', (enemies, seed, opts, was) => {
    const start = createBattle(REFERENCE_BUILDS.tier6, enemies.map((id) => ENEMIES[id]), CATALOG, seed, opts);
    expect(start.open).toBe(false);
    const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
    const fell = end.events.filter((e) => e.type === 'unitDestroyed' && e.unit !== 'player').length;
    expect([end.outcome, end.round, end.events.length, end.units[0].parts.core!.ap, end.rng, fell]).toEqual(was);
    expect(momentum(end)).toEqual([]);
    expect(end.events.some((e) => e.type === 'shot' && e.shatter)).toBe(false);
    expect(end.units.every((u) => u.chain === 0)).toBe(true);
  });

  test('the same machines without the one who leads are an open battle, and it goes otherwise', () => {
    // The armoured turret of the last fight above, unmarked: the best frame goes through the drones beside it.
    const start = createBattle(REFERENCE_BUILDS.tier6, ['gun-turret', 'recon-drone', 'recon-drone'].map((id) => ENEMIES[id]), CATALOG, 8);
    expect(start.open).toBe(true);
    const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
    expect(end.outcome).toBe('victory');
    expect(momentum(end).length).toBeGreaterThan(0);
    expect(end.events.some((e) => e.type === 'shot' && e.shatter)).toBe(true);
  });
});
