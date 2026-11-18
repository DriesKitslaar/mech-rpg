import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import {
  MAX_ENEMIES, activeUnit, applyAction, createBattle, ordinary,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import { swarmContract } from '../../src/core/board';
import { tallyBattle } from '../../src/core/stats';
import type { Catalog, EnemyDef, FramePart, Weapon } from '../../src/core/types';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * Swarms: a battle can have more machines than the field holds. Those that are not on it yet come
 * on at the start of a round, as room has been made, and the battle is not over while any are
 * still to come.
 */

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };
const drone = ENEMIES['recon-drone'];
const defs = (...ids: string[]): EnemyDef[] => ids.map((id) => ENEMIES[id]);
const fire = (target: string): Action => ({ type: 'fire', weapon: 'rightHand', target, part: 'core' });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
const standing = (s: BattleState): UnitState[] => s.units.filter((u) => u.side === 'enemy' && !u.destroyed);
const of = <T extends BattleEvent['type']>(s: BattleState, type: T): Extract<BattleEvent, { type: T }>[] =>
  s.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
function toPlayer(s: BattleState, catalog: Catalog = HEAVY): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
/** Three drones on the field and so many more to come. */
function swarm(more: number, opts: BattleOptions = {}, on: EnemyDef[] = [drone, drone, drone]): BattleState {
  return toPlayer(createBattle(DEMO_BUILD, on, HEAVY, 1, { reserve: Array.from({ length: more }, () => drone), ...opts }));
}
/** Ends the pilot's turn and lets the others take theirs, into the pilot's next turn (or the battle's end). */
const nextTurn = (s: BattleState): BattleState => toPlayer(applyAction(s, END, HEAVY));

describe('a battle with machines still to come', () => {
  test('begins with what the field holds, and says how many are behind them', () => {
    const s = swarm(4);
    expect(standing(s)).toHaveLength(3);
    expect(s.reserve.map((def) => def.id)).toEqual(['recon-drone', 'recon-drone', 'recon-drone', 'recon-drone']);
    expect(of(s, 'arrive')).toEqual([]);
    // A battle without any has an empty reserve, not a missing one.
    expect(createBattle(DEMO_BUILD, [drone, drone], HEAVY, 1).reserve).toEqual([]);
  });

  test('is topped up as a round begins, and not before: one down, one comes on', () => {
    let s = swarm(4);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    expect(standing(s)).toHaveLength(2);
    expect(of(s, 'arrive')).toEqual([]);
    expect(s.round).toBe(1);
    s = nextTurn(s);
    expect(s.round).toBe(2);
    expect(standing(s)).toHaveLength(3);
    expect(of(s, 'arrive')).toEqual([{ type: 'arrive', unit: 'enemy-3', left: 3 }]);
    expect(s.reserve).toHaveLength(3);
  });

  test('is never topped up past what the field holds', () => {
    expect(MAX_ENEMIES).toBe(3);
    let s = swarm(6);
    for (let round = 0; round < 12 && s.outcome === 'ongoing'; round++) {
      expect(standing(s).length).toBeLessThanOrEqual(MAX_ENEMIES);
      // One a turn, with a rifle that has fired: no second volley.
      s = applyAction(s, fire(standing(s)[0].id), { ...HEAVY, 'wpn-rivet-rifle': { ...rifle, damage: 900, ammo: 99 } }, hit);
      if (s.outcome === 'ongoing') s = nextTurn(s);
    }
    expect(s.outcome).toBe('victory');
    expect(of(s, 'arrive')).toHaveLength(6);
    expect(of(s, 'arrive').map((e) => e.left)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  test('takes as many as there is room for at once: a field cleared in a turn is a field refilled', () => {
    let s = swarm(5);
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire(id), HEAVY, hit);
    // Three in a turn, and the battle goes on: there is nothing on the field, and five behind it.
    expect(standing(s)).toHaveLength(0);
    expect(s.outcome).toBe('ongoing');
    expect(player(s).chain).toBe(3);
    expect(of(s, 'momentum').map((e) => e.chain)).toEqual([1, 2, 3]);
    s = nextTurn(s);
    expect(s.round).toBe(2);
    expect(standing(s).map((u) => u.id)).toEqual(['enemy-3', 'enemy-4', 'enemy-5']);
    expect(of(s, 'arrive').map((e) => e.left)).toEqual([4, 3, 2]);
    expect(s.reserve).toHaveLength(2);
  });

  test('is won when nothing stands and nothing is left to come', () => {
    let s = swarm(1);
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire(id), HEAVY, hit);
    expect(s.outcome).toBe('ongoing');
    s = nextTurn(s);
    expect(standing(s).map((u) => u.id)).toEqual(['enemy-3']);
    expect(s.reserve).toEqual([]);
    s = applyAction(s, fire('enemy-3'), HEAVY, hit);
    expect(s.outcome).toBe('victory');
    expect(tallyBattle(s).kills).toBe(4);
  });
});

describe('the reserve', () => {
  test('comes on in the order it was given: the first named is the first on the field', () => {
    let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone, drone], HEAVY, 1, { reserve: defs('gunship', 'bomb-crawler', 'recon-drone') }));
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = nextTurn(s);
    expect(unit(s, 'enemy-3').kind).toBe('gunship');
    expect(s.reserve.map((def) => def.id)).toEqual(['bomb-crawler', 'recon-drone']);
    s = applyAction(s, fire('enemy-3'), HEAVY, hit);
    s = nextTurn(s);
    expect(unit(s, 'enemy-4').kind).toBe('bomb-crawler');
  });

  test('is the battle\'s own: the list it was given is the list it was given, afterwards too', () => {
    const given = defs('gunship', 'recon-drone');
    let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone, drone], HEAVY, 1, { reserve: given }));
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire(id), HEAVY, hit);
    s = nextTurn(s);
    expect(s.reserve).toEqual([]);
    expect(given.map((def) => def.id)).toEqual(['gunship', 'recon-drone']);
  });
});

describe('a machine that comes on', () => {
  test('has a name, a number and a place of its own: the next letter, the next number, the place that was left', () => {
    let s = swarm(2);
    expect(s.units.map((u) => u.name)).toEqual(['You', 'Recon Drone A', 'Recon Drone B', 'Recon Drone C']);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    s = nextTurn(s);
    const came = unit(s, 'enemy-3');
    expect(came.name).toBe('Recon Drone D');
    expect(came.kind).toBe('recon-drone');
    // The middle place was the one left empty.
    expect(came.slot).toBe(unit(s, 'enemy-1').slot);
    expect(new Set(standing(s).map((u) => u.slot)).size).toBe(3);
  });

  test('and what it joins has a letter from the start where another of its kind is still to come: none stands unlettered beside a "B"', () => {
    // One crawler on the field, another behind it: the first is A before the second is ever seen.
    let s = swarm(0, { reserve: defs('bomb-crawler', 'recon-drone') }, defs('recon-drone', 'bomb-crawler', 'recon-drone'));
    expect(standing(s).map((u) => u.name)).toEqual(['Recon Drone A', 'Bomb Crawler A', 'Recon Drone B']);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = applyAction(s, fire('enemy-2'), HEAVY, hit);
    s = nextTurn(s);
    expect(s.units.filter((u) => u.side === 'enemy').map((u) => u.name)).toEqual(['Recon Drone A', 'Bomb Crawler A', 'Recon Drone B', 'Bomb Crawler B', 'Recon Drone C']);
    // A kind there is only one of, in all of it, has no letter; and with nothing to come the field is named as it always was.
    const lone = swarm(0, { reserve: defs('recon-drone') }, defs('recon-drone', 'gun-turret', 'recon-drone'));
    expect(standing(lone).map((u) => u.name)).toEqual(['Recon Drone A', 'Gun Turret', 'Recon Drone B']);
    expect(standing(swarm(0, {}, defs('recon-drone', 'bomb-crawler', 'gun-turret'))).map((u) => u.name)).toEqual(['Recon Drone', 'Bomb Crawler', 'Gun Turret']);
    // Every swarm the board deals: every machine of a kind there are two of has a letter, and no two machines share a name.
    for (let wins = 0; wins < 60; wins++) {
      const [battle] = swarmContract(wins, 0, BOARD_TEXT).battles;
      let all = createBattle(DEMO_BUILD, defs(...battle.enemies), HEAVY, 1, { reserve: defs(...battle.reserve!) });
      for (let guard = 0; all.reserve.length > 0 && guard < 40; guard++) {
        for (const enemy of standing(all)) all.units.find((u) => u.id === enemy.id)!.destroyed = true;
        all = applyAction(toPlayer(all), END, HEAVY);
      }
      const names = all.units.filter((u) => u.side === 'enemy').map((u) => u.name);
      expect(new Set(names).size, `after ${wins} wins`).toBe(names.length);
      const kinds = [...battle.enemies, ...battle.reserve!];
      for (const name of names) {
        const kind = kinds.find((id) => name.startsWith(ENEMIES[id].name))!;
        const several = kinds.filter((id) => id === kind).length > 1;
        expect(/ [A-Z]$/.test(name), `${name} after ${wins} wins`).toBe(several);
      }
    }
  });

  test('is as tough as the battle makes its machines', () => {
    const shell = (CATALOG['core-drone'] as FramePart).ap;
    let s = swarm(1, { enemyScale: 1.5 });
    expect(unit(s, 'enemy-0').parts.core!.maxAp).toBe(Math.round(shell * 1.5));
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = nextTurn(s);
    expect(unit(s, 'enemy-3').parts.core!.maxAp).toBe(Math.round(shell * 1.5));
  });

  test('takes its turn in the round it comes on in', () => {
    let s = swarm(1);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = applyAction(s, END, HEAVY);
    // Into the second round, to whoever is first in it.
    for (let guard = 0; s.round === 1 && guard < 10; guard++) s = applyAction(s, END, HEAVY);
    expect(s.round).toBe(2);
    expect(s.order).toContain('enemy-3');
    expect(s.order).toHaveLength(4);
  });

  test('is one of many like the rest: the battle is open, and what is true of them is true of it', () => {
    let s = swarm(1);
    expect(s.open).toBe(true);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = nextTurn(s);
    expect(ordinary(s, unit(s, 'enemy-3'))).toBe(true);
    expect(unit(s, 'enemy-3').shaken).toBeUndefined();
  });
});

describe('whether a battle with a reserve is open', () => {
  test('is asked of everything in it: one machine on the field with more behind it is no duel', () => {
    const s = createBattle(DEMO_BUILD, [drone], HEAVY, 1, { reserve: [drone, drone] });
    expect(s.open).toBe(true);
  });

  test('a machine the objective names leads though it stands alone with others to come; one the objective does not name does not', () => {
    const turret = ENEMIES['gun-turret'];
    // The turret is the target: the fight is about it, and the drones that come on after it are not ordinary.
    expect(createBattle(DEMO_BUILD, [turret], HEAVY, 1, { reserve: [drone, drone], objective: { type: 'leader', target: 0 } }).open).toBe(false);
    // The same field where the contract only wants it outlasted is an open battle.
    expect(createBattle(DEMO_BUILD, [turret], HEAVY, 1, { reserve: [drone, drone], objective: { type: 'survive', rounds: 6 } }).open).toBe(true);
    // Of two on the field it is the one named that leads, whichever place it has: the battle is not open either way.
    for (const target of [0, 1]) expect(createBattle(DEMO_BUILD, [turret, drone], HEAVY, 1, { objective: { type: 'leader', target } }).open).toBe(false);
  });

  test('a leader among those still to come makes it a fight that is not open, from the first shot', () => {
    for (const id of ['magpie', 'strip-miner', 'bailiff']) {
      const s = createBattle(DEMO_BUILD, [drone, drone], HEAVY, 1, { reserve: defs('recon-drone', id) });
      expect(s.open, id).toBe(false);
    }
  });
});

describe('beside the other rules', () => {
  test('machines that break off make room like any other, and what comes on after them has seen nothing', () => {
    let s = swarm(3);
    s = applyAction(s, fire('enemy-0'), HEAVY, hit);
    s = applyAction(s, fire('enemy-1'), HEAVY, hit);
    expect(unit(s, 'enemy-2').shaken).toBe(true);
    s = nextTurn(s);
    expect(unit(s, 'enemy-2').destroyed).toBe(true);
    // A drone flies: it left, it did not shut down where it stood.
    expect(s.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2' }]);
    expect(s.outcome).toBe('ongoing');
    // It held its place until its turn came: two came on round it, and the third comes on where it stood.
    expect(standing(s).map((u) => u.id)).toEqual(['enemy-3', 'enemy-4']);
    expect(standing(s).some((u) => u.shaken)).toBe(false);
    expect(of(s, 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2' }]);
    s = nextTurn(s);
    expect(standing(s).map((u) => u.id)).toEqual(['enemy-3', 'enemy-4', 'enemy-5']);
    expect(unit(s, 'enemy-5').slot).toBe(unit(s, 'enemy-2').slot);
    expect(standing(s).some((u) => u.shaken)).toBe(false);
  });

  test('a carrier and the reserve share the places: there are never more than the field holds', () => {
    let s = toPlayer(createBattle(DEMO_BUILD, defs('carrier', 'recon-drone', 'recon-drone'), CATALOG, 3, { reserve: [drone, drone, drone] }), CATALOG);
    let most = 0;
    for (let guard = 0; guard < 400 && s.outcome === 'ongoing' && s.round < 12; guard++) {
      most = Math.max(most, standing(s).length);
      s = applyAction(s, activeUnit(s).side === 'player' ? chooseAutoPlayerAction(s, CATALOG) : END, CATALOG);
    }
    expect(most).toBe(MAX_ENEMIES);
    expect(s.units.filter((u) => u.side === 'enemy').length).toBeGreaterThan(3);
    const slots = standing(s).map((u) => u.slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  test('what has to be protected is worn down by what stood as the round began, before the new ones are counted', () => {
    let s = swarm(3, { objective: { type: 'protect', name: 'Ore Train', hp: 12 } });
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = applyAction(s, fire(id), HEAVY, hit);
    const before = s.asset!.hp;
    s = nextTurn(s);
    // Nothing stood, so nothing was lost; three came on after the count.
    expect(s.asset!.hp).toBe(before);
    expect(standing(s)).toHaveLength(3);
    s = nextTurn(s);
    expect(s.asset!.hp).toBe(before - 3);
  });

  test('a battle that only has to be outlasted is won at its time, whoever is still to come', () => {
    let s = swarm(9, { objective: { type: 'survive', rounds: 2 } });
    for (let guard = 0; guard < 40 && s.outcome === 'ongoing'; guard++) s = applyAction(s, END, HEAVY);
    expect(s.outcome).toBe('victory');
    expect(s.reserve.length).toBeGreaterThan(0);
  });
});

describe('played out', () => {
  test('the best frame against nine drones, three at a time: every one of them is destroyed or leaves, and none is counted twice', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const start = createBattle(REFERENCE_BUILDS.tier6, [drone, drone, drone], CATALOG, seed * 7919, { reserve: Array.from({ length: 6 }, () => drone) });
      const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
      expect(end.outcome, `seed ${seed}`).toBe('victory');
      expect(end.reserve).toEqual([]);
      const foes = end.units.filter((u) => u.side === 'enemy');
      expect(foes).toHaveLength(9);
      expect(foes.every((u) => u.destroyed)).toBe(true);
      const fell = of(end, 'unitDestroyed').length;
      const left = of(end, 'rout').length;
      expect(fell + left).toBe(9);
      expect(tallyBattle(end).kills).toBe(fell);
      expect(new Set(foes.map((u) => u.id)).size).toBe(9);
      expect(new Set(foes.map((u) => u.name)).size).toBe(9);
    }
  });
});
