import {
  SHATTER, activeUnit, applyAction, createBattle, leads, ordinary, previewShot,
  type Action, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Catalog, FramePart, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const shell = CATALOG['core-drone'] as FramePart;
const housing = CATALOG['core-turret'] as FramePart;
/** The catalogue with the rifle doing this much: the blow under test. */
const doing = (damage: number): Catalog => ({ ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage } });
const fire = (target: string, part: 'core' | 'legs' = 'core'): Action => ({ type: 'fire', weapon: 'rightHand', target, part });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
function field(enemyIds: string[], catalog: Catalog, opts: BattleOptions = {}): BattleState {
  let s = createBattle(DEMO_BUILD, enemyIds.map((id) => ENEMIES[id]), catalog, 1, opts);
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
const shot = (s: BattleState, catalog: Catalog, target: string, part: 'core' | 'legs' = 'core') => previewShot(s, 'player', 'rightHand', target, part, catalog);

describe('one blow that takes half of an ordinary machine\'s core', () => {
  test('finishes it: a drone\'s shell is fifty, and twenty-five in one hit goes through it', () => {
    expect(SHATTER).toBe(0.5);
    expect(shell.ap).toBe(50);
    const enough = doing(25);
    const s = field(['recon-drone', 'gun-turret'], enough);
    expect(shot(s, enough, 'enemy-0')).toMatchObject({ damage: 50, shatter: true, kills: true });
    const after = applyAction(s, fire('enemy-0'), enough, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(true);
    expect(after.events.find((e) => e.type === 'shot')).toMatchObject({ hit: true, damage: 50, shatter: true });
    // One less is a hit like any other: it takes what it takes.
    const short = doing(24);
    const t = field(['recon-drone', 'gun-turret'], short);
    expect(shot(t, short, 'enemy-0')).toMatchObject({ damage: 24, shatter: false, kills: false });
    const wounded = applyAction(t, fire('enemy-0'), short, hit);
    expect(unit(wounded, 'enemy-0').parts.core!.ap).toBe(26);
    expect('shatter' in wounded.events.find((e) => e.type === 'shot')!).toBe(false);
  });

  test('is a blow that lands: a miss at the same machine is a miss, and says nothing of shattering', () => {
    const enough = doing(25);
    const s = field(['recon-drone', 'gun-turret'], enough);
    const missed = applyAction(s, fire('enemy-0'), enough, () => 0.999);
    expect(unit(missed, 'enemy-0').parts.core!.ap).toBe(50);
    expect(missed.events.find((e) => e.type === 'shot')).toEqual({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: false, damage: 0 });
  });

  test('never makes a blow smaller: one that is more than the machine has left is that blow', () => {
    const huge = doing(900);
    const s = field(['recon-drone', 'gun-turret'], huge);
    expect(shot(s, huge, 'enemy-0')).toMatchObject({ damage: 900, shatter: true, kills: true });
  });

  test('is measured after what the armour turns aside: a turret\'s housing sheds four tenths of a slug', () => {
    expect(housing.resist.kinetic).toBe(0.4);
    // The least the rifle has to do for six tenths of it to be half of 260.
    const least = [...Array(400).keys()].find((damage) => Math.round(damage * 0.6) >= 130)!;
    const s = field(['gun-turret', 'recon-drone'], doing(least));
    expect(shot(s, doing(least), 'enemy-0')).toMatchObject({ damage: 260, shatter: true, kills: true });
    expect(shot(s, doing(least - 1), 'enemy-0')).toMatchObject({ damage: Math.round((least - 1) * 0.6), shatter: false, kills: false });
  });

  test('is half of the core as it stood at full strength: a machine worn down is not shattered by less, only finished by enough', () => {
    const catalog = doing(100);
    const full = field(['gun-turret', 'recon-drone'], catalog);
    expect(shot(full, catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: false });
    // Down to a hundred: sixty is more than half of what is left, and less than half of what it was.
    const worn = edit(full, (draft) => { unit(draft, 'enemy-0').parts.core!.ap = 100; });
    expect(shot(worn, catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: false });
    // Down to sixty: the hit is enough, and that is all it is.
    const last = edit(full, (draft) => { unit(draft, 'enemy-0').parts.core!.ap = 60; });
    expect(shot(last, catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: true });
  });

  test('takes all that is left of the core, however much the blow itself was', () => {
    const catalog = doing(300);
    const s = field(['gun-turret', 'recon-drone'], catalog);
    // Six tenths of three hundred is a hundred and eighty: more than half, less than the housing.
    expect(Math.round(300 * 0.6)).toBeLessThan(housing.ap);
    expect(shot(s, catalog, 'enemy-0')).toMatchObject({ damage: 260, shatter: true });
    const after = applyAction(s, fire('enemy-0'), catalog, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(true);
    expect(after.events.filter((e) => e.type === 'unitDestroyed').map((e) => e.unit)).toEqual(['enemy-0']);
  });

  test('counts what the target is doing: braced it may hold, off balance it may not', () => {
    const catalog = doing(200);
    const s = field(['gun-turret', 'recon-drone'], catalog);
    // A hundred and twenty: short of half the housing.
    expect(shot(s, catalog, 'enemy-0')).toMatchObject({ damage: 120, shatter: false });
    const reeling = edit(s, (draft) => { unit(draft, 'enemy-0').staggered = 2; });
    expect(shot(reeling, catalog, 'enemy-0')).toMatchObject({ shatter: true, damage: 260 });
    const heavy = doing(230);
    expect(shot(s, heavy, 'enemy-0').shatter).toBe(true);
    const braced = edit(s, (draft) => { unit(draft, 'enemy-0').guarding = true; });
    expect(shot(braced, heavy, 'enemy-0').shatter).toBe(false);
  });
});

describe('behind a barrier', () => {
  const shielded = (catalog: Catalog, barrier: number): BattleState =>
    edit(field(['recon-drone', 'gun-turret'], catalog), (draft) => { unit(draft, 'enemy-0').barrier = barrier; });

  test('it is what gets past the barrier that has to be half the core', () => {
    // Twenty-five at a barrier of ten: fifteen arrive, and a drone's shell is fifty.
    const short = doing(25);
    const s = shielded(short, 10);
    expect(shot(s, short, 'enemy-0')).toMatchObject({ damage: 25, shatter: false, kills: false });
    const after = applyAction(s, fire('enemy-0'), short, hit);
    expect(unit(after, 'enemy-0').parts.core!.ap).toBe(35);
    expect(unit(after, 'enemy-0').barrier).toBe(0);
    expect(after.events.find((e) => e.type === 'shot')).toMatchObject({ damage: 15, absorbed: 10 });
    expect('shatter' in after.events.find((e) => e.type === 'shot')!).toBe(false);
  });

  test('a blow that still arrives as half the core takes the barrier and the machine with it', () => {
    const enough = doing(35);
    const s = shielded(enough, 10);
    // Thirty-five less ten is twenty-five: half the shell. The hit is all of the shell, and the barrier before it.
    expect(shot(s, enough, 'enemy-0')).toMatchObject({ damage: 60, shatter: true, kills: true });
    expect(shot(shielded(doing(34), 10), doing(34), 'enemy-0')).toMatchObject({ damage: 34, shatter: false, kills: false });
    const after = applyAction(s, fire('enemy-0'), enough, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(true);
    expect(after.events.find((e) => e.type === 'shot')).toMatchObject({ damage: 50, absorbed: 10, shatter: true });
  });

  test('a hit that is simply enough has to be enough for the barrier too', () => {
    const catalog = doing(100);
    // A turret worn down to fifty: sixty arrive at a bare housing, and forty behind a barrier of twenty.
    const worn = (barrier: number): BattleState => edit(field(['gun-turret', 'recon-drone'], catalog), (draft) => {
      unit(draft, 'enemy-0').parts.core!.ap = 50;
      unit(draft, 'enemy-0').barrier = barrier;
    });
    expect(shot(worn(0), catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: true });
    expect(shot(worn(10), catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: true });
    expect(shot(worn(20), catalog, 'enemy-0')).toMatchObject({ damage: 60, shatter: false, kills: false });
  });
});

describe('a blow at a limb', () => {
  const walker = (catalog: Catalog): BattleState => field(['light-mech', 'recon-drone'], catalog);

  test('that still stands is a blow to the limb: the core is not in it', () => {
    const catalog = doing(900);
    const s = walker(catalog);
    expect(shot(s, catalog, 'enemy-0', 'legs')).toMatchObject({ shatter: false, kills: false });
    const after = applyAction(s, fire('enemy-0', 'legs'), catalog, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(false);
    expect(unit(after, 'enemy-0').parts.legs!.ap).toBe(0);
  });

  test('that is gone passes half on to the core, and that half is the blow that arrives', () => {
    const catalog = doing(900);
    const s = edit(walker(catalog), (draft) => { unit(draft, 'enemy-0').parts.legs!.ap = 0; });
    const core = unit(s, 'enemy-0').parts.core!;
    const passed = shot(s, catalog, 'enemy-0', 'legs');
    expect(passed).toMatchObject({ shatter: true, kills: true });
    expect(passed.damage).toBeGreaterThanOrEqual(core.ap);
    // A small one through the same gap is halved, and is nothing like half the core.
    const small = doing(40);
    expect(shot(s, small, 'enemy-0', 'legs')).toMatchObject({ shatter: false, kills: false });
  });
});

describe('who is not ordinary', () => {
  const heavy = doing(5000);

  test('a machine fought alone: a duel is fought to the last plate, as it always was', () => {
    const s = field(['gun-turret'], heavy);
    expect(s.open).toBe(false);
    expect(ordinary(s, unit(s, 'enemy-0'))).toBe(false);
    // The blow is what it is: enormous, and enough; it is not called a shattering.
    expect(shot(s, heavy, 'enemy-0')).toMatchObject({ shatter: false, kills: true, damage: 3000 });
    // Half the housing and no more leaves the other half standing.
    const half = doing(217);
    expect(shot(s, half, 'enemy-0')).toMatchObject({ shatter: false, kills: false, damage: 130 });
    const two = field(['gun-turret', 'recon-drone'], half);
    expect(two.open).toBe(true);
    expect(shot(two, half, 'enemy-0').shatter).toBe(true);
  });

  /** Each kind of machine a fight is about, with a drone beside it: what makes it one, and the battle. */
  const LED: [string, BattleState][] = [
    ['a pilot with a name and a face', field(['magpie', 'recon-drone'], heavy)],
    ['a machine that changes as it is worn down', field(['strip-miner', 'recon-drone'], heavy)],
    ['an elite', field(['gun-turret', 'recon-drone'], heavy, { marks: { 0: 'armoured' } })],
    ['a machine that commands the others', field(['bailiff', 'recon-drone'], heavy)],
    ['the one a contract wants destroyed', field(['gun-turret', 'recon-drone'], heavy, { objective: { type: 'leader', target: 0 } })],
    ['the one a contract wants disabled', field(['light-mech', 'recon-drone'], heavy, { objective: { type: 'disable', target: 0 } })],
    ['the one a contract wants driven off', field(['gun-turret', 'recon-drone'], heavy, { objective: { type: 'driveOff', target: 0, share: 0.4 } })],
  ];

  test('what makes a leader: a name and a face, phases, the mark of an elite, command, an objective that names it', () => {
    const [named, boss, elite, bailiff] = LED.map(([, s]) => unit(s, 'enemy-0'));
    expect(named.portrait).toBeDefined();
    expect(boss.phases.length).toBeGreaterThan(0);
    expect(elite.mark).toBe('armoured');
    expect(bailiff.leader).toBe(true);
    // The Bailiff is the one machine that commands without being a boss or having a name.
    expect(Object.values(ENEMIES).filter((def) => def.leader).map((def) => def.id)).toEqual(['bailiff']);
    for (const [what, s] of LED) {
      expect(leads(unit(s, 'enemy-0'), s.objective), what).toBe(true);
      expect(leads(unit(s, 'enemy-1'), s.objective), what).toBe(false);
    }
    // A plain field has nobody who does.
    const plain = field(['gun-turret', 'recon-drone'], heavy);
    expect(plain.units.filter((u) => u.side === 'enemy').some((u) => leads(u, plain.objective))).toBe(false);
    expect(plain.open).toBe(true);
    // An objective that names nobody makes nobody a leader: something to protect, a time to last.
    for (const objective of [{ type: 'protect', name: 'Ore Train', hp: 12 }, { type: 'survive', rounds: 6 }] as const) {
      expect(field(['gun-turret', 'recon-drone'], heavy, { objective }).open, objective.type).toBe(true);
    }
  });

  test.each(LED)('%s, and every machine in that fight, to its end', (_what, s) => {
    expect(s.open).toBe(false);
    expect(ordinary(s, unit(s, 'enemy-0'))).toBe(false);
    expect(ordinary(s, unit(s, 'enemy-1'))).toBe(false);
    // Half of a drone's shell in one hit: in this fight it is a hit, and the drone is still there.
    const enough = doing(25);
    expect(shot(s, enough, 'enemy-1')).toMatchObject({ damage: 25, shatter: false, kills: false });
    expect(unit(applyAction(s, fire('enemy-1'), enough, hit), 'enemy-1').parts.core!.ap).toBe(25);
    // The leader is not shattered by half of its own core either.
    const core = unit(s, 'enemy-0').parts.core!;
    const half = doing(core.maxAp * 4);
    expect(shot(s, half, 'enemy-0').damage).toBeGreaterThanOrEqual(core.maxAp / 2);
    expect(shot(s, half, 'enemy-0').shatter).toBe(false);
    // With the leader gone it is still the fight it began as.
    const leaderless = edit(s, (draft) => { unit(draft, 'enemy-0').destroyed = true; });
    expect(ordinary(leaderless, unit(leaderless, 'enemy-1'))).toBe(false);
    expect(shot(leaderless, enough, 'enemy-1')).toMatchObject({ damage: 25, shatter: false });
  });

  test('a machine that joins an open battle is one of many; one that joins a fight against one machine is not', () => {
    const enough = doing(25);
    const launched = (enemies: string[]): BattleState => {
      let s = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), enough, 1);
      for (let guard = 0; !s.events.some((e) => e.type === 'launch') && s.outcome === 'ongoing' && guard < 60; guard++) s = applyAction(s, END, enough);
      for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, enough);
      return s;
    };
    const open = launched(['carrier', 'gun-turret']);
    const joined = open.units.at(-1)!;
    expect(joined.kind).toBe('recon-drone');
    expect(open.open).toBe(true);
    expect(ordinary(open, joined)).toBe(true);
    expect(shot(open, enough, joined.id)).toMatchObject({ shatter: true, kills: true });
    const alone = launched(['carrier']);
    expect(alone.units.at(-1)!.kind).toBe('recon-drone');
    expect(alone.open).toBe(false);
    expect(shot(alone, enough, alone.units.at(-1)!.id)).toMatchObject({ damage: 25, shatter: false });
  });

  test('the pilot: nothing an enemy fires goes through the pilot\'s own mech in one blow', () => {
    const turret = CATALOG[ENEMIES['gun-turret'].build.rightHand ?? ENEMIES['gun-turret'].build.shoulder!] as Weapon;
    // More than half of the pilot's core in one hit, and less than all of it.
    const cruel: Catalog = { ...CATALOG, [turret.id]: { ...turret, damage: 190 } };
    const s = createBattle(DEMO_BUILD, [ENEMIES['gun-turret'], ENEMIES['recon-drone']], cruel, 1);
    expect(s.open).toBe(true);
    const me = unit(s, 'player');
    const slot = ENEMIES['gun-turret'].build.rightHand ? 'rightHand' : 'shoulder';
    const incoming = previewShot(s, 'enemy-0', slot, 'player', 'core', cruel);
    expect(incoming.damage).toBeGreaterThanOrEqual(me.parts.core!.maxAp / 2);
    expect(incoming.damage).toBeLessThan(me.parts.core!.ap);
    expect(incoming).toMatchObject({ shatter: false, kills: false });
    expect(ordinary(s, me)).toBe(false);
  });
});

describe('what follows', () => {
  test('a machine that was shattered was destroyed: the weapon is ready again', () => {
    const catalog = doing(25);
    let s = field(['recon-drone', 'recon-drone', 'gun-turret'], catalog);
    s = applyAction(s, fire('enemy-0'), catalog, hit);
    s = applyAction(s, fire('enemy-1'), catalog, hit);
    expect(s.units.filter((u) => u.destroyed).map((u) => u.id)).toEqual(['enemy-0', 'enemy-1']);
    expect(unit(s, 'player').chain).toBe(2);
    // Twenty-five is nothing to a turret: there the run ends.
    s = applyAction(s, fire('enemy-2'), catalog, hit);
    expect(unit(s, 'enemy-2').destroyed).toBe(false);
    expect(unit(s, 'player').fired).toContain('rightHand');
  });
});
