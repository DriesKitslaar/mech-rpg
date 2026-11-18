import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import {
  OVERKILL, activeUnit, applyAction, createBattle, previewShot,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import { swarmContract } from '../../src/core/board';
import { playMission } from '../../src/core/mission';
import type { Catalog, Weapon } from '../../src/core/types';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/** Overkill: a machine destroyed by a blow that carried at least one and a half times its whole core. The battle says so; nothing else changes. */

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const doing = (damage: number): Catalog => ({ ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage } });
const fire = (target: string, part: 'core' | 'legs' = 'core'): Action => ({ type: 'fire', weapon: 'rightHand', target, part });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
function field(enemyIds: string[], catalog: Catalog, opts: BattleOptions = {}): BattleState {
  let s = createBattle(DEMO_BUILD, enemyIds.map((id) => ENEMIES[id]), catalog, 1, opts);
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => { const copy = structuredClone(s); change(copy); return copy; };
const fell = (s: BattleState): Extract<BattleEvent, { type: 'unitDestroyed' }>[] =>
  s.events.filter((e): e is Extract<BattleEvent, { type: 'unitDestroyed' }> => e.type === 'unitDestroyed');

describe('a machine destroyed by one and a half times its whole core', () => {
  test('is an overkill: a drone\'s shell is fifty, and seventy-five in one hit is half as much again', () => {
    expect(OVERKILL).toBe(1.5);
    const over = field(['recon-drone', 'gun-turret'], doing(75));
    expect(previewShot(over, 'player', 'rightHand', 'enemy-0', 'core', doing(75)).damage).toBe(75);
    expect(fell(applyAction(over, fire('enemy-0'), doing(75), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    // One less goes through the drone all the same (it is more than half of it), and is not called that.
    const less = field(['recon-drone', 'gun-turret'], doing(74));
    expect(fell(applyAction(less, fire('enemy-0'), doing(74), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });

  test('is not what a shattering is: a hit that shatters takes all that is left of the core and no more', () => {
    const s = field(['recon-drone', 'gun-turret'], doing(40));
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', doing(40))).toMatchObject({ shatter: true, damage: 50 });
    expect(fell(applyAction(s, fire('enemy-0'), doing(40), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
    // Behind a barrier it takes the barrier with it, and that is not counted either: 60 through a barrier of 30 arrives as 30.
    const shielded = edit(field(['recon-drone', 'gun-turret'], doing(60)), (draft) => { unit(draft, 'enemy-0').barrier = 30; });
    expect(previewShot(shielded, 'player', 'rightHand', 'enemy-0', 'core', doing(60))).toMatchObject({ shatter: true, damage: 80 });
    expect(fell(applyAction(shielded, fire('enemy-0'), doing(60), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });

  test('is measured against the machine as it was made: finishing one that has been worn down is no overkill', () => {
    // A turret's housing is 260 and turns four tenths aside: fifty arrive as thirty.
    const catalog = doing(50);
    const worn = (ap: number, with_: Catalog = catalog): BattleState => edit(field(['gun-turret', 'recon-drone'], with_), (draft) => { unit(draft, 'enemy-0').parts.core!.ap = ap; });
    for (const left of [1, 15, 30]) {
      expect(fell(applyAction(worn(left), fire('enemy-0'), catalog, hit)), `${left} left`).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
    }
    // One and a half times the housing in one hit is, whatever was left of it: 650 arrive as 390.
    const huge = doing(650);
    expect(previewShot(worn(15, huge), 'player', 'rightHand', 'enemy-0', 'core', huge).damage).toBe(390);
    expect(fell(applyAction(worn(15, huge), fire('enemy-0'), huge, hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(previewShot(worn(15, doing(649)), 'player', 'rightHand', 'enemy-0', 'core', doing(649)).damage).toBe(389);
    expect(fell(applyAction(worn(15, doing(649)), fire('enemy-0'), doing(649), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
    // And of one that has not been touched it is the same blow that is one: what is left does not come into it.
    expect(fell(applyAction(worn(260, huge), fire('enemy-0'), huge, hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(fell(applyAction(worn(260, doing(649)), fire('enemy-0'), doing(649), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });

  test('is measured on what gets past a barrier', () => {
    const shielded = (catalog: Catalog): BattleState => edit(field(['recon-drone', 'gun-turret'], catalog), (draft) => { unit(draft, 'enemy-0').barrier = 30; });
    // A hundred and five less thirty is seventy-five: half as much again as the shell. One less is not.
    expect(fell(applyAction(shielded(doing(105)), fire('enemy-0'), doing(105), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(fell(applyAction(shielded(doing(104)), fire('enemy-0'), doing(104), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });

  test('through a limb that is gone is half the blow, and it is the half that is measured', () => {
    const s = edit(field(['light-mech', 'recon-drone'], doing(1)), (draft) => { unit(draft, 'enemy-0').parts.legs!.ap = 0; });
    const whole = unit(s, 'enemy-0').parts.core!.maxAp;
    expect(whole).toBe(170);
    // The least the rifle has to do for half of what arrives to be one and a half times the core: 255.
    const least = [...Array(6000).keys()].find((damage) => previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', doing(damage)).damage >= 255)!;
    // Aimed at the core itself the same rifle carries twice that, give or take the rounding.
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', doing(least)).damage).toBeGreaterThanOrEqual(2 * 255 - 2);
    expect(previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', doing(least - 1)).damage).toBe(254);
    expect(fell(applyAction(s, fire('enemy-0', 'legs'), doing(least), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(fell(applyAction(s, fire('enemy-0', 'legs'), doing(least - 1), hit))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });
});

describe('where it is said', () => {
  test('in every fight, open or not: it changes nothing but what is said', () => {
    const duel = edit(field(['gun-turret'], doing(900)), (draft) => { unit(draft, 'enemy-0').parts.core!.ap = 10; });
    expect(duel.open).toBe(false);
    const after = applyAction(duel, fire('enemy-0'), doing(900), hit);
    expect(fell(after)).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(after.outcome).toBe('victory');
    // Nothing is readied and nothing is counted: it is still a fight that is not open.
    expect(unit(after, 'player').chain).toBe(0);
    expect(after.events.some((e) => e.type === 'momentum')).toBe(false);
  });

  test('never of the pilot: it is a thing the pilot does, and their own end is not called one however hard the blow', () => {
    const turret = CATALOG[ENEMIES['gun-turret'].build.rightHand ?? ENEMIES['gun-turret'].build.shoulder!] as Weapon;
    const cruel: Catalog = { ...CATALOG, [turret.id]: { ...turret, damage: 5000 } };
    let s = createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], cruel, 1);
    for (let guard = 0; s.outcome === 'ongoing' && guard < 200; guard++) {
      s = applyAction(s, activeUnit(s).side === 'player' ? END : { type: 'fire', weapon: ENEMIES['gun-turret'].build.rightHand ? 'rightHand' : 'shoulder', target: 'player', part: 'core' }, cruel, hit);
    }
    expect(s.outcome).toBe('defeat');
    // Five thousand in one hit is many times the pilot's whole core.
    const shots = s.events.filter((e) => e.type === 'shot' && e.target === 'player' && e.hit);
    expect(shots.length).toBeGreaterThan(0);
    expect(fell(s)).toEqual([{ type: 'unitDestroyed', unit: 'player' }]);
  });

  test('not of a machine that an ally destroyed: only a volley of the pilot\'s is a blow', () => {
    let s = field(['recon-drone', 'recon-drone'], doing(1), { support: { name: 'Ashfall', damage: 999 } });
    s = applyAction(s, END, doing(1));
    for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, doing(1));
    // Nine hundred and ninety-nine on a drone's fifty is twenty drones.
    expect(s.events.some((e) => e.type === 'support' && e.damage >= OVERKILL * 50)).toBe(true);
    expect(fell(s).length).toBeGreaterThan(0);
    expect(fell(s).some((e) => e.overkill)).toBe(false);
  });

  test('not of a bomb that goes off, which destroys itself, nor of a machine a module destroyed', () => {
    // A crawler counts down and goes up against the pilot: it is gone, and nothing calls that an overkill.
    let s = field(['bomb-crawler', 'gun-turret'], doing(1));
    for (let guard = 0; s.outcome === 'ongoing' && !s.events.some((e) => e.type === 'blast') && guard < 60; guard++) s = applyAction(s, END, doing(1));
    expect(s.events.some((e) => e.type === 'blast' && e.unit === 'enemy-0')).toBe(true);
    expect(unit(s, 'enemy-0').destroyed).toBe(true);
    expect(fell(s).filter((e) => e.unit === 'enemy-0')).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
    // A Shock Pulse on a machine with a point of core left does fifteen times what it had, and is no volley.
    const pulse = edit(createBattle({ ...DEMO_BUILD, module: 'mod-shock' }, [ENEMIES['recon-drone'], ENEMIES['gun-turret']], CATALOG, 1), (draft) => {
      unit(draft, 'enemy-0').parts.core!.ap = 1;
    });
    let t = pulse;
    for (let guard = 0; activeUnit(t).id !== 'player' && guard < 20; guard++) t = applyAction(t, END, CATALOG);
    t = applyAction(t, { type: 'module' }, CATALOG);
    expect(fell(t)).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
  });

  test('played out over many battles: a heavy gun overkills light machines again and again, a light one hardly ever, and nothing else is marked', () => {
    const played = (catalog: Catalog, build = DEMO_BUILD): { kills: number; overkills: number } => {
      const t = { kills: 0, overkills: 0 };
      for (let seed = 1; seed <= 20; seed++) {
        const end = runBattle(createBattle(build, ['recon-drone', 'recon-drone', 'gunship'].map((id) => ENEMIES[id]), catalog, seed * 7919), catalog, chooseAutoPlayerAction);
        for (const event of end.events) {
          if (event.type !== 'unitDestroyed') { expect('overkill' in event, event.type).toBe(false); continue; }
          if (event.unit === 'player') continue;
          t.kills++;
          if (event.overkill) t.overkills++;
        }
      }
      return t;
    };
    // A rifle that does two hundred: four times a drone's shell.
    const heavy = played(doing(200));
    expect(heavy.kills).toBeGreaterThan(40);
    expect(heavy.overkills).toBeGreaterThan(heavy.kills / 2);
    // The frame a pilot starts in carries nothing that is a drone and a half: it goes through them, and that is all.
    const light = played(CATALOG, REFERENCE_BUILDS.starter);
    expect(light.kills).toBeGreaterThan(20);
    expect(light.overkills).toBe(0);
  });
});

describe('how often it is seen, with the frames the shop sells, in the swarms a pilot is offered at each stage', () => {
  /** Of the machines a frame destroys in the swarms on offer after each of these numbers of wins: the share that went up as an overkill. */
  const share = (frame: string, wins: number[]): { kills: number; share: number } => {
    let kills = 0;
    let overkills = 0;
    for (const won of wins) {
      const mission = swarmContract(won, 0, BOARD_TEXT);
      for (let seed = 1; seed <= 6; seed++) {
        const end = playMission(REFERENCE_BUILDS[frame], mission, ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: mission.scale ?? 1 });
        for (const event of end.events) {
          if (event.type !== 'unitDestroyed' || event.unit === 'player') continue;
          kills++;
          if (event.overkill) overkills++;
        }
      }
    }
    return { kills, share: overkills / kills };
  };

  test.each([['starter', [0, 3]], ['tier2', [5, 8]], ['tier3', [13, 15]]] as [string, number[]][])('never by the %s frame as the automatic player flies it: nothing it carries is a machine and a half as it comes', (frame, wins) => {
    const seen = share(frame, wins);
    expect(seen.kills).toBeGreaterThan(40);
    expect(seen.share).toBe(0);
  });

  test('a pilot who spends an Overdrive on it sees one sooner: the mortar of the introductions, under Deadeye, on a drone', () => {
    // The automatic player fires no Overdrive, so the shares above have none in them. Deadeye makes a shot half as
    // hard again, and the mortar pod a pilot can carry from the second contract is then a drone and a half and more.
    const mortar = CATALOG['wpn-mortar-pod'] as Weapon;
    expect(DEMO_BUILD.shoulder).toBe('wpn-mortar-pod');
    const plain = field(['recon-drone', 'gun-turret'], CATALOG);
    const as_it_comes = previewShot(plain, 'player', 'shoulder', 'enemy-0', 'core', CATALOG).damage;
    expect(as_it_comes).toBeLessThan(OVERKILL * 50);
    const driven = applyAction(field(['recon-drone', 'gun-turret'], CATALOG, { overdrive: 'deadeye', drive: 100 }), { type: 'overdrive' }, CATALOG);
    const under = previewShot(driven, 'player', 'shoulder', 'enemy-0', 'core', CATALOG).damage;
    expect(under).toBeGreaterThanOrEqual(OVERKILL * 50);
    expect(under).toBeGreaterThan(as_it_comes);
    const after = applyAction(driven, { type: 'fire', weapon: 'shoulder', target: 'enemy-0', part: 'core' }, CATALOG, hit);
    expect(fell(after)).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    expect(mortar.damage).toBeLessThan(OVERKILL * 50);
  });

  test.each([['tier4', [20, 25], 0.3, 0.6], ['tier5', [30, 35], 0.5, 0.8], ['tier6', [40, 45], 0.03, 0.2]] as [string, number[], number, number][])(
    'by the %s frame it is: often enough to be seen, and not so often as to be every kill', (frame, wins, least, most) => {
      const seen = share(frame, wins);
      expect(seen.kills).toBeGreaterThan(40);
      expect(seen.share).toBeGreaterThanOrEqual(least);
      expect(seen.share).toBeLessThanOrEqual(most);
    });
});
