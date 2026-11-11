import {
  activeUnit, applyAction, carryFrom, checkAction, createBattle, evasion, previewShot,
  type Action, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Build, Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const hit = () => 0;
const miss = () => 0.999;
const END: Action = { type: 'endTurn' };

function demo(enemyIds: string[], seed = 1, build: Build = DEMO_BUILD, catalog: Catalog = CATALOG): BattleState {
  return createBattle(build, enemyIds.map((id) => ENEMIES[id]), catalog, seed);
}
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState) => unit(s, 'player');
/** Ends enemy turns until the player is the active unit. */
function toPlayer(s: BattleState): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard++ < 20) s = applyAction(s, END, CATALOG);
  return s;
}
/** Returns a modified copy; the active unit keeps its turn. */
function edit(s: BattleState, fn: (draft: BattleState) => void): BattleState {
  const copy = structuredClone(s);
  fn(copy);
  return copy;
}
const fire = (weapon: 'rightHand' | 'leftHand' | 'shoulder', target: string, part: 'core' | 'legs' | 'arms' | 'head' = 'core'): Action =>
  ({ type: 'fire', weapon, target, part });
const alphaStrike = (s: BattleState, target: string, roll: () => number): BattleState =>
  (['rightHand', 'leftHand', 'shoulder'] as const).reduce((acc, w) => applyAction(acc, fire(w, target), CATALOG, roll), s);

describe('setup', () => {
  test('units act in order of mobility, fastest first', () => {
    expect(demo(['gun-turret', 'recon-drone']).order).toEqual(['enemy-1', 'player', 'enemy-0']);
  });

  test('equal mobility is resolved by enemy index', () => {
    expect(demo(['recon-drone', 'recon-drone']).order).toEqual(['enemy-0', 'enemy-1', 'player']);
  });

  test('a unit only has the parts its build has', () => {
    const s = demo(['gun-turret']);
    expect(Object.keys(unit(s, 'enemy-0').parts)).toEqual(['core']);
    expect(Object.keys(player(s).parts).sort()).toEqual(['arms', 'core', 'head', 'legs']);
  });

  test('the first unit starts with its turn energy', () => {
    const s = demo(['gun-turret']);
    expect(activeUnit(s).id).toBe('player');
    expect(player(s).energy).toBe(230);
    expect(s.events[0]).toEqual({ type: 'turnStart', unit: 'player' });
  });
});

describe('shot preview', () => {
  const s = demo(['gun-turret', 'recon-drone']);
  const p = (attacker: string, weapon: any, target: string, part: any) => previewShot(s, attacker, weapon, target, part, CATALOG);

  test('rifle against the drone', () => {
    expect(p('player', 'rightHand', 'enemy-1', 'core')).toEqual({ hitChance: 57, damage: 38 });
    expect(p('player', 'rightHand', 'enemy-1', 'legs').hitChance).toBe(52);
  });

  test('weapons against the turret use its resistances', () => {
    expect(p('player', 'rightHand', 'enemy-0', 'core')).toEqual({ hitChance: 90, damage: 23 });
    expect(p('player', 'shoulder', 'enemy-0', 'core')).toEqual({ hitChance: 70, damage: 63 });
    expect(p('player', 'leftHand', 'enemy-0', 'core').damage).toBe(24);
  });

  test('enemy weapons against the player', () => {
    expect(p('enemy-1', 'shoulder', 'player', 'core')).toEqual({ hitChance: 55, damage: 11 });
    expect(p('enemy-0', 'shoulder', 'player', 'core')).toEqual({ hitChance: 60, damage: 48 });
  });

  test('hit chance is clamped between 10 and 95', () => {
    const base = CATALOG['wpn-rivet-rifle'] as Weapon;
    const catalog: Catalog = {
      ...CATALOG,
      'wpn-test-wild': { ...base, id: 'wpn-test-wild', accuracy: 5 },
      'wpn-test-sure': { ...base, id: 'wpn-test-sure', accuracy: 200 },
    };
    const b = demo(['recon-drone'], 1, { ...DEMO_BUILD, rightHand: 'wpn-test-wild', leftHand: 'wpn-test-sure' }, catalog);
    expect(previewShot(b, 'player', 'rightHand', 'enemy-0', 'core', catalog).hitChance).toBe(10);
    expect(previewShot(b, 'player', 'leftHand', 'enemy-0', 'core', catalog).hitChance).toBe(95);
  });
});

describe('firing', () => {
  test('a hit lowers armour and spends ammo, energy and heat', () => {
    const s = applyAction(toPlayer(demo(['recon-drone'])), fire('rightHand', 'enemy-0'), CATALOG, hit);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(12);
    expect(player(s).ammo.rightHand).toBe(29);
    expect(player(s).energy).toBe(170);
    expect(player(s).heat).toBe(12);
    expect(s.events.at(-1)).toEqual({
      type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 38,
    });
  });

  test('a miss leaves armour alone but still spends ammo, energy and heat', () => {
    const s = applyAction(toPlayer(demo(['recon-drone'])), fire('rightHand', 'enemy-0'), CATALOG, miss);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(50);
    expect(player(s)).toMatchObject({ energy: 170, heat: 12 });
    expect(player(s).ammo.rightHand).toBe(29);
  });

  test('a weapon without ammo tracking keeps null ammo', () => {
    const s = applyAction(toPlayer(demo(['recon-drone'])), fire('leftHand', 'enemy-0'), CATALOG, miss);
    expect(player(s).ammo.leftHand).toBeNull();
  });

  test('each weapon fires once per turn', () => {
    const s = applyAction(toPlayer(demo(['recon-drone'])), fire('rightHand', 'enemy-0'), CATALOG, miss);
    expect(checkAction(s, fire('rightHand', 'enemy-0'), CATALOG)).toBe('alreadyFired');
  });

  test('refusals for firing', () => {
    const s = toPlayer(demo(['gun-turret']));
    const noLeft = toPlayer(createBattle({ ...DEMO_BUILD, leftHand: undefined }, [ENEMIES['gun-turret']], CATALOG, 1));
    expect(checkAction(noLeft, fire('leftHand', 'enemy-0'), CATALOG)).toBe('noWeapon');
    expect(checkAction(edit(s, (d) => { d.units[0].ammo.rightHand = 0; }), fire('rightHand', 'enemy-0'), CATALOG)).toBe('noAmmo');
    expect(checkAction(edit(s, (d) => { d.units[0].energy = 59; }), fire('rightHand', 'enemy-0'), CATALOG)).toBe('noEnergy');
    expect(checkAction(s, fire('rightHand', 'nobody'), CATALOG)).toBe('invalidTarget');
    expect(checkAction(s, fire('rightHand', 'player'), CATALOG)).toBe('invalidTarget');
    expect(checkAction(s, fire('rightHand', 'enemy-0', 'head'), CATALOG)).toBe('invalidTarget');
  });

  test('applying a refused action throws', () => {
    const s = toPlayer(demo(['gun-turret']));
    expect(() => applyAction(s, fire('rightHand', 'nobody'), CATALOG)).toThrow('illegal action: invalidTarget');
  });

  test('without a forced roll the seed decides, identically every time', () => {
    const run = (seed: number) => applyAction(toPlayer(demo(['recon-drone'], seed)), fire('rightHand', 'enemy-0'), CATALOG);
    expect(run(5).events).toEqual(run(5).events);
    expect(run(5).rng).not.toBe(toPlayer(demo(['recon-drone'], 5)).rng);
  });
});

describe('part destruction', () => {
  function legsShotTwice(): BattleState {
    let s = toPlayer(demo(['recon-drone']));
    s = applyAction(s, fire('rightHand', 'enemy-0', 'legs'), CATALOG, hit);
    s = toPlayer(applyAction(s, END, CATALOG));
    return applyAction(s, fire('rightHand', 'enemy-0', 'legs'), CATALOG, hit);
  }

  test('overflow is lost and later hits on a destroyed part pass half to the core', () => {
    const s = legsShotTwice();
    expect(unit(s, 'enemy-0').parts.legs!.ap).toBe(0);
    expect(unit(s, 'enemy-0').parts.core!.ap).toBe(31);
    expect(s.events.filter((e) => e.type === 'partDestroyed')).toEqual([{ type: 'partDestroyed', unit: 'enemy-0', part: 'legs' }]);
  });

  test('a shot at a destroyed part previews and reports the halved damage on the core', () => {
    let s = toPlayer(demo(['recon-drone']));
    s = applyAction(s, fire('rightHand', 'enemy-0', 'legs'), CATALOG, hit);
    s = toPlayer(applyAction(s, END, CATALOG));
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', CATALOG).damage).toBe(19);
    s = applyAction(s, fire('rightHand', 'enemy-0', 'legs'), CATALOG, hit);
    expect(s.events.at(-1)).toEqual({
      type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'legs', appliedTo: 'core', hit: true, damage: 19,
    });
  });

  test('destroyed legs mean no evasion and no boost', () => {
    const s = toPlayer(legsShotTwice());
    const drone = unit(s, 'enemy-0');
    expect(evasion(drone, CATALOG)).toBe(0);
    const droneTurn = applyAction(s, END, CATALOG);
    expect(activeUnit(droneTurn).id).toBe('enemy-0');
    expect(checkAction(droneTurn, { type: 'boost' }, CATALOG)).toBe('legsDisabled');
  });

  test('a unit that lost its legs acts after faster units', () => {
    const s = applyAction(toPlayer(legsShotTwice()), END, CATALOG);
    expect(s.order).toEqual(['player', 'enemy-0']);
  });

  test('destroyed arms disable hand weapons but not the shoulder weapon', () => {
    const s = edit(toPlayer(demo(['gun-turret'])), (d) => { d.units[0].parts.arms!.ap = 0; });
    expect(checkAction(s, fire('rightHand', 'enemy-0'), CATALOG)).toBe('weaponDisabled');
    expect(checkAction(s, fire('shoulder', 'enemy-0'), CATALOG)).toBeNull();
  });

  test('a destroyed head costs its aim bonus and 30 more', () => {
    const s = edit(demo(['recon-drone']), (d) => { d.units[0].parts.head!.ap = 0; });
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', CATALOG).hitChance).toBe(17);
  });

  test('destroying the last enemy core is a victory and ends the battle', () => {
    let s = edit(toPlayer(demo(['recon-drone'])), (d) => { d.units[1].parts.core!.ap = 1; });
    s = applyAction(s, fire('rightHand', 'enemy-0'), CATALOG, hit);
    expect(s.outcome).toBe('victory');
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(s.events.slice(-2)).toEqual([
      { type: 'unitDestroyed', unit: 'enemy-0' }, { type: 'outcome', outcome: 'victory' },
    ]);
    expect(checkAction(s, END, CATALOG)).toBe('battleOver');
  });

  test('a destroyed enemy is skipped in the turn order', () => {
    let s = edit(toPlayer(demo(['recon-drone', 'recon-drone'])), (d) => { d.units[1].parts.core!.ap = 1; });
    s = applyAction(s, fire('rightHand', 'enemy-0'), CATALOG, hit);
    s = applyAction(s, END, CATALOG);
    expect(s.outcome).toBe('ongoing');
    expect(activeUnit(s).id).toBe('enemy-1');
  });

  test('losing the player core is a defeat', () => {
    let s = edit(demo(['gun-turret']), (d) => { d.units[0].parts.core!.ap = 1; });
    s = applyAction(s, END, CATALOG);
    s = applyAction(s, fire('shoulder', 'player'), CATALOG, hit);
    expect(s.outcome).toBe('defeat');
    expect(s.events.at(-1)).toEqual({ type: 'outcome', outcome: 'defeat' });
  });
});

describe('heat', () => {
  test('firing everything twice overheats and costs the following turn', () => {
    let s = alphaStrike(toPlayer(demo(['recon-drone'])), 'enemy-0', miss);
    expect(player(s)).toMatchObject({ heat: 64, energy: 0, overheated: false });
    s = toPlayer(applyAction(s, END, CATALOG));
    expect(player(s).heat).toBe(39);

    s = alphaStrike(s, 'enemy-0', miss);
    expect(player(s)).toMatchObject({ heat: 103, overheated: true });
    expect(s.events.filter((e) => e.type === 'overheat')).toEqual([{ type: 'overheat', unit: 'player' }]);
    s = applyAction(s, END, CATALOG);
    expect(player(s).heat).toBe(78);

    // The drone ends its turn; the player's turn is then skipped and play returns to the drone.
    s = applyAction(s, END, CATALOG);
    expect(s.events).toContainEqual({ type: 'turnSkipped', unit: 'player' });
    expect(player(s)).toMatchObject({ heat: 50, overheated: false });
    expect(activeUnit(s).id).toBe('enemy-0');
  });

  test('cooling removes the generator cooling for a fifth of the turn energy', () => {
    let s = edit(toPlayer(demo(['recon-drone'])), (d) => { d.units[0].heat = 64; });
    s = applyAction(s, { type: 'cool' }, CATALOG);
    expect(player(s)).toMatchObject({ heat: 39, energy: 184 });
    expect(checkAction(s, { type: 'cool' }, CATALOG)).toBe('alreadyUsed');
  });

  test('the overheat penalty never raises heat', () => {
    let s = edit(toPlayer(demo(['recon-drone'])), (d) => { d.units[0].overheated = true; d.units[0].heat = 20; });
    s = toPlayer(applyAction(s, END, CATALOG));
    expect(s.events).toContainEqual({ type: 'turnSkipped', unit: 'player' });
    expect(player(s).heat).toBeLessThanOrEqual(20);
  });

  test('heat never drops below zero', () => {
    const s = applyAction(toPlayer(demo(['recon-drone'])), { type: 'cool' }, CATALOG);
    expect(player(s).heat).toBe(0);
  });
});

describe('boost', () => {
  test('boosting adds 30 evasion until the next own turn', () => {
    let s = applyAction(toPlayer(demo(['gun-turret'])), { type: 'boost' }, CATALOG);
    expect(player(s).energy).toBe(161);
    expect(previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', CATALOG).hitChance).toBe(30);
    expect(checkAction(s, { type: 'boost' }, CATALOG)).toBe('alreadyUsed');
    s = toPlayer(applyAction(s, END, CATALOG));
    expect(player(s).boosted).toBe(false);
    expect(previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', CATALOG).hitChance).toBe(60);
  });

  test('boosting needs energy', () => {
    const s = edit(toPlayer(demo(['gun-turret'])), (d) => { d.units[0].energy = 68; });
    expect(checkAction(s, { type: 'boost' }, CATALOG)).toBe('noEnergy');
  });
});

describe('field repair', () => {
  const damaged = (ap: number) => edit(toPlayer(demo(['gun-turret'])), (d) => { d.units[0].parts.core!.ap = ap; });

  test('restores 40% of the part and ends the turn', () => {
    const s = applyAction(damaged(100), { type: 'repair', part: 'core' }, CATALOG);
    expect(player(s).parts.core!.ap).toBe(188);
    expect(player(s).repairsLeft).toBe(1);
    expect(activeUnit(s).id).toBe('enemy-0');
  });

  test('never exceeds the maximum', () => {
    const s = applyAction(damaged(200), { type: 'repair', part: 'core' }, CATALOG);
    expect(player(s).parts.core!.ap).toBe(220);
  });

  test('refusals for repair', () => {
    expect(checkAction(edit(damaged(100), (d) => { d.units[0].repairsLeft = 0; }), { type: 'repair', part: 'core' }, CATALOG)).toBe('noRepairs');
    expect(checkAction(edit(damaged(100), (d) => { d.units[0].parts.arms!.ap = 0; }), { type: 'repair', part: 'arms' }, CATALOG)).toBe('partDestroyed');
    expect(checkAction(damaged(100), { type: 'repair', part: 'head' }, CATALOG)).toBe('partFull');
    const turretTurn = applyAction(damaged(100), END, CATALOG);
    expect(checkAction(turretTurn, { type: 'repair', part: 'legs' }, CATALOG)).toBe('invalidTarget');
  });
});

describe('battles always progress', () => {
  test('ending the turn is possible with nothing else left to do', () => {
    const s = edit(toPlayer(demo(['gun-turret'])), (d) => {
      d.units[0].parts.arms!.ap = 0;
      d.units[0].ammo.shoulder = 0;
      d.units[0].energy = 0;
    });
    expect(checkAction(s, fire('shoulder', 'enemy-0'), CATALOG)).toBe('noAmmo');
    expect(checkAction(s, END, CATALOG)).toBeNull();
  });

  test('a battle nobody fights ends in defeat after round 60', () => {
    let s = demo(['gun-turret', 'recon-drone']);
    let calls = 0;
    while (s.outcome === 'ongoing' && calls < 1000) { s = applyAction(s, END, CATALOG); calls++; }
    expect(s.outcome).toBe('defeat');
    expect(s.round).toBe(60);
    expect(calls).toBe(180);
  });
});

describe('state handling', () => {
  test('applyAction does not change the state it is given', () => {
    const s = toPlayer(demo(['recon-drone']));
    const before = structuredClone(s);
    applyAction(s, fire('rightHand', 'enemy-0'), CATALOG, hit);
    applyAction(s, END, CATALOG);
    expect(s).toEqual(before);
  });

  function script(seed: number): BattleState {
    let s = demo(['recon-drone', 'recon-drone'], seed);
    for (let i = 0; i < 40 && s.outcome === 'ongoing'; i++) {
      const me = activeUnit(s);
      const target = me.side === 'player' ? s.units.find((u) => u.side === 'enemy' && !u.destroyed)!.id : 'player';
      const shot = (['rightHand', 'leftHand', 'shoulder'] as const)
        .map((w) => fire(w, target))
        .find((a) => checkAction(s, a, CATALOG) === null);
      s = applyAction(s, shot ?? END, CATALOG);
    }
    return s;
  }

  test('the same seed and actions give the same events', () => {
    expect(script(3).events).toEqual(script(3).events);
  });

  test('a different seed gives different events', () => {
    expect(script(3).events).not.toEqual(script(4).events);
  });
});

describe('carrying a mech from one battle into the next', () => {
  function worn(): BattleState {
    return edit(toPlayer(demo(['recon-drone'])), (d) => {
      const p = d.units[0];
      p.parts.core!.ap = 140; p.parts.arms!.ap = 0; p.heat = 40; p.ammo.rightHand = 22; p.ammo.shoulder = 0; p.repairsLeft = 1;
    });
  }

  test('damage, heat, ammunition and repairs carry over', () => {
    const next = createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 2, carryFrom(worn()));
    const p = player(next);
    expect(p.parts.core).toEqual({ ap: 140, maxAp: 220 });
    expect(p.parts.arms).toEqual({ ap: 0, maxAp: 110 });
    expect(p.parts.legs).toEqual({ ap: 150, maxAp: 150 });
    expect(p).toMatchObject({ heat: 40, repairsLeft: 1 });
    expect(p.ammo).toEqual({ rightHand: 22, leftHand: null, shoulder: 0 });
  });

  test('a part destroyed earlier is still disabled', () => {
    const next = toPlayer(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 2, carryFrom(worn())));
    expect(checkAction(next, fire('rightHand', 'enemy-0'), CATALOG)).toBe('weaponDisabled');
    expect(checkAction(next, fire('shoulder', 'enemy-0'), CATALOG)).toBe('noAmmo');
  });

  test('enemies always start fresh, and a battle without a carry starts fresh too', () => {
    const next = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 2, carryFrom(worn()));
    expect(unit(next, 'enemy-0').parts.core!.ap).toBe(50);
    expect(player(createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 2))).toMatchObject({ heat: 0, repairsLeft: 2 });
  });

  test('a destroyed mech cannot be carried into another battle', () => {
    const dead = edit(worn(), (d) => { d.units[0].parts.core!.ap = 0; d.units[0].destroyed = true; });
    expect(() => createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 2, carryFrom(dead))).toThrow('a destroyed mech cannot enter a battle');
  });
});
