import {
  HEAT_LIMIT, SPOOL_BASE, STAGGER_DAMAGE, SURGE_UNIT, activeUnit, applyAction, checkAction, createBattle, forkTarget, guardFactor, previewShot,
  shotsNow, shotsOf, weaponNow,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import { impactOf } from '../../src/core/build';
import type { Build, Catalog, DamageType, FramePart, FrameSlot, Weapon, WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const hit = () => 0;
const miss = () => 0.999;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const made = (id: string, change: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, ammo: null, costPerShot: 0, ...change });

/** One weapon of each kind, with round numbers: what the rules do is tested apart from what the shop sells. */
const REDLINE = made('wpn-t-redline', { trait: 'redline', traitPower: 6, damage: 50, heat: 12 });
const SURGE = made('wpn-t-surge', { trait: 'surge', damageType: 'energy', damage: 30, energy: 80, heat: 20, impact: 10 });
const PUNISH = made('wpn-t-punish', { trait: 'punish', traitPower: 50, damage: 40 });
const FORK = made('wpn-t-fork', { trait: 'fork', traitPower: 50, damageType: 'energy', damage: 40, impact: 20 });
const SPOOL = made('wpn-t-spool', { trait: 'spool', traitPower: 3, damage: 10, energy: 40, heat: 5 });
const PLAIN = made('wpn-t-plain', { damage: 50 });
const KINDS: Catalog = { ...CATALOG, ...Object.fromEntries([REDLINE, SURGE, PUNISH, FORK, SPOOL, PLAIN].map((w) => [w.id, w])) };

const fire = (weapon: WeaponSlot, target: string, part: FrameSlot = 'core'): Action => ({ type: 'fire', weapon, target, part });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
/** Ends enemy turns until the pilot is the active unit. */
function toPlayer(s: BattleState, catalog: Catalog = KINDS): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
/** A battle with `weapon` in the right hand, at the pilot's turn. */
function field(weapon: Weapon, enemyIds: string[], opts: BattleOptions = {}, catalog: Catalog = KINDS, rest: Partial<Build> = {}): BattleState {
  return toPlayer(createBattle({ ...DEMO_BUILD, rightHand: weapon.id, ...rest }, enemyIds.map((id) => ENEMIES[id]), catalog, 1, opts), catalog);
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
/** The pilot's next turn: this one ended, and the enemies' ended for them. */
const nextTurn = (s: BattleState, catalog: Catalog = KINDS): BattleState => toPlayer(applyAction(s, END, catalog), catalog);
type Shot = Extract<BattleEvent, { type: 'shot' }>;
const shots = (s: BattleState, from = 0): Shot[] => s.events.slice(from).filter((e): e is Shot => e.type === 'shot');
const resist = (s: BattleState, id: string, type: DamageType, part: FrameSlot = 'core'): number =>
  (KINDS[unit(s, id).build[part]!] as FramePart).resist[type];
/** What one hit of a weapon is worth against a part: what it is listed at, times what its kind makes of it, less what the part resists, times whatever comes after. */
const worth = (s: BattleState, weapon: Weapon, id: string, lift = 1, after = 1, part: FrameSlot = 'core'): number =>
  Math.max(1, Math.round(weapon.damage * lift * (1 - resist(s, id, weapon.damageType, part)) * after));
const preview = (s: BattleState, target = 'enemy-0', part: FrameSlot = 'core', slot: WeaponSlot = 'rightHand') =>
  previewShot(s, 'player', slot, target, part, KINDS);

describe('a redline weapon', () => {
  const cold = field(REDLINE, ['heavy-mech']);
  const at = (heat: number): BattleState => edit(cold, (d) => { player(d).heat = heat; });

  test('fired cold does what it is listed at', () => {
    expect(player(cold).heat).toBe(0);
    expect(preview(cold).damage).toBe(worth(cold, REDLINE, 'enemy-0'));
    const after = applyAction(cold, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(shots(after, cold.events.length)).toEqual([expect.objectContaining({ hit: true, damage: worth(cold, REDLINE, 'enemy-0') })]);
    expect(shots(after, cold.events.length)[0]).not.toHaveProperty('lift');
  });

  test('does six in a hundred more for every ten of its own machine\'s heat', () => {
    expect(preview(at(10)).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.06));
    expect(preview(at(50)).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.3));
    expect(preview(at(100)).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.6));
    // And as the power it is sold with says: not always six.
    const hotter: Catalog = { ...KINDS, [REDLINE.id]: { ...REDLINE, traitPower: 10 } };
    expect(previewShot(at(50), 'player', 'rightHand', 'enemy-0', 'core', hotter).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.5));
  });

  test('is worth the limit and no more to a machine that is past it', () => {
    expect(HEAT_LIMIT).toBe(100);
    expect(preview(at(HEAT_LIMIT + 1)).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.6));
    expect(preview(at(180)).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.6));
  });

  test('counts the heat as it stands when the shot is fired: its own comes after', () => {
    const warm = at(50);
    const after = applyAction(warm, fire('rightHand', 'enemy-0'), KINDS, hit);
    const [shot] = shots(after, warm.events.length);
    expect(shot.damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.3));
    expect(shot.lift).toBe(130);
    expect(player(after).heat).toBe(50 + REDLINE.heat);
    // What is said of it is to the nearest whole number: 101.8 is 102, and 114.99999999999999 is 115.
    expect(shots(applyAction(at(3), fire('rightHand', 'enemy-0'), KINDS, hit), cold.events.length)[0].lift).toBe(102);
    expect(shots(applyAction(at(25), fire('rightHand', 'enemy-0'), KINDS, hit), cold.events.length)[0].lift).toBe(115);
  });

  test('pushes as it is sold to push, whatever the heat', () => {
    expect(unit(cold, 'enemy-0').staggerMax).toBeGreaterThan(2 * impactOf(REDLINE));
    for (const heat of [0, 50, 100]) {
      expect(unit(applyAction(at(heat), fire('rightHand', 'enemy-0'), KINDS, hit), 'enemy-0').stagger, `heat ${heat}`).toBe(impactOf(REDLINE));
    }
  });

  test('a miss says nothing of what the heat would have made of it', () => {
    const after = applyAction(at(50), fire('rightHand', 'enemy-0'), KINDS, miss);
    expect(shots(after, cold.events.length)).toEqual([expect.objectContaining({ hit: false, damage: 0 })]);
    expect(shots(after, cold.events.length)[0]).not.toHaveProperty('lift');
  });

  test('a weapon of no kind is none the better for the heat', () => {
    const plain = edit(field(PLAIN, ['heavy-mech']), (d) => { player(d).heat = 90; });
    expect(preview(plain).damage).toBe(worth(plain, PLAIN, 'enemy-0'));
    expect(shots(applyAction(plain, fire('rightHand', 'enemy-0'), KINDS, hit), plain.events.length)[0]).not.toHaveProperty('lift');
  });

  test('what the heat adds is taken down by a guard like the rest', () => {
    const guarded = edit(at(50), (d) => { unit(d, 'enemy-0').guarding = true; });
    const factor = guardFactor(unit(guarded, 'enemy-0'), KINDS);
    expect(factor).toBeLessThan(1);
    expect(preview(guarded).damage).toBe(worth(cold, REDLINE, 'enemy-0', 1.3, factor));
  });
});

describe('a punish weapon', () => {
  const steady = field(PUNISH, ['heavy-mech']);
  const reeling = edit(steady, (d) => { unit(d, 'enemy-0').staggered = 2; });

  test('does what it is listed at to a machine that stands steady', () => {
    expect(preview(steady).damage).toBe(worth(steady, PUNISH, 'enemy-0'));
    expect(shots(applyAction(steady, fire('rightHand', 'enemy-0'), KINDS, hit), steady.events.length)[0]).not.toHaveProperty('lift');
  });

  test('does half as much again to one that is off balance, on top of what every weapon does to it', () => {
    expect(STAGGER_DAMAGE).toBe(1.3);
    expect(preview(reeling).damage).toBe(worth(steady, PUNISH, 'enemy-0', 1.5, STAGGER_DAMAGE));
    const after = applyAction(reeling, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(shots(after, reeling.events.length)[0]).toMatchObject({ damage: worth(steady, PUNISH, 'enemy-0', 1.5, STAGGER_DAMAGE), lift: 150 });
    // As much more as it is sold to do.
    const harder: Catalog = { ...KINDS, [PUNISH.id]: { ...PUNISH, traitPower: 80 } };
    expect(previewShot(reeling, 'player', 'rightHand', 'enemy-0', 'core', harder).damage).toBe(worth(steady, PUNISH, 'enemy-0', 1.8, STAGGER_DAMAGE));
  });

  test('a weapon of no kind does only what every weapon does to it', () => {
    const plain = edit(field(PLAIN, ['heavy-mech']), (d) => { unit(d, 'enemy-0').staggered = 2; });
    expect(preview(plain).damage).toBe(worth(plain, PLAIN, 'enemy-0', 1, STAGGER_DAMAGE));
  });

  test('its own machine being off balance is nothing to it', () => {
    const mine = edit(steady, (d) => { player(d).staggered = 1; });
    expect(preview(mine).damage).toBe(worth(steady, PUNISH, 'enemy-0'));
  });

  test('a barrier in the way takes its share of the larger blow', () => {
    const behind = edit(reeling, (d) => { unit(d, 'enemy-0').barrier = 10; });
    const all = worth(steady, PUNISH, 'enemy-0', 1.5, STAGGER_DAMAGE);
    const after = applyAction(behind, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(shots(after, behind.events.length)[0]).toMatchObject({ damage: all - 10, absorbed: 10, lift: 150 });
  });
});

describe('a surge weapon', () => {
  const full = field(SURGE, ['heavy-mech']);
  const had = player(full).energy;
  const withEnergy = (energy: number): BattleState => edit(full, (d) => { player(d).energy = energy; });

  test('asks a least amount of energy to be fired at all', () => {
    expect(SURGE_UNIT).toBe(100);
    expect(had).toBeGreaterThan(SURGE.energy);
    expect(checkAction(withEnergy(SURGE.energy - 1), fire('rightHand', 'enemy-0'), KINDS)).toBe('noEnergy');
    expect(checkAction(withEnergy(SURGE.energy), fire('rightHand', 'enemy-0'), KINDS)).toBeNull();
  });

  test('takes all the energy there is, and does what it is listed at for every hundred it took', () => {
    const after = applyAction(full, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(player(after).energy).toBe(0);
    const [shot] = shots(after, full.events.length);
    expect(shot.damage).toBe(worth(full, SURGE, 'enemy-0', had / 100));
    expect(shot.lift).toBe(had);
    // Half the energy, half the blow.
    const half = withEnergy(had / 2);
    expect(shots(applyAction(half, fire('rightHand', 'enemy-0'), KINDS, hit), half.events.length)[0].damage).toBe(worth(full, SURGE, 'enemy-0', had / 200));
  });

  test('what is said of the energy it took is that energy, to the point', () => {
    // 113 in a hundred is 1.13, and 1.13 times a hundred is not quite 113 to a machine that counts in halves.
    expect((113 / 100) * 100).not.toBe(113);
    const odd = withEnergy(113);
    expect(shots(applyAction(odd, fire('rightHand', 'enemy-0'), KINDS, hit), odd.events.length)[0].lift).toBe(113);
    expect(weaponNow(odd, 'player', 'rightHand', KINDS)).toEqual({ energy: 113, shots: 1, lift: 113 });
  });

  test('with exactly a hundred it does what it is listed at, and nothing is said of it', () => {
    const one = withEnergy(100);
    const [shot] = shots(applyAction(one, fire('rightHand', 'enemy-0'), KINDS, hit), one.events.length);
    expect(shot.damage).toBe(worth(full, SURGE, 'enemy-0'));
    expect(shot).not.toHaveProperty('lift');
  });

  test('the aiming line says beforehand what the shot then does', () => {
    for (const state of [full, withEnergy(137), withEnergy(SURGE.energy)]) {
      const said = preview(state).damage;
      expect(shots(applyAction(state, fire('rightHand', 'enemy-0'), KINDS, hit), state.events.length)[0].damage).toBe(said);
    }
  });

  test('what another weapon took first it does not have', () => {
    const fired = applyAction(full, fire('leftHand', 'enemy-0'), KINDS, hit);
    const left = player(fired).energy;
    expect(left).toBe(had - (KINDS[DEMO_BUILD.leftHand!] as Weapon).energy);
    const after = applyAction(fired, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(shots(after, fired.events.length)[0]).toMatchObject({ damage: worth(full, SURGE, 'enemy-0', left / 100), lift: left });
    expect(player(after).energy).toBe(0);
  });

  test('pushes as much harder as it hits, and heats its machine the same whatever it took', () => {
    expect(impactOf(SURGE)).toBe(10);
    const after = applyAction(full, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(unit(after, 'enemy-0').stagger).toBe(Math.round(10 * had / 100));
    expect(player(after).heat).toBe(SURGE.heat);
    const little = applyAction(withEnergy(SURGE.energy), fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(unit(little, 'enemy-0').stagger).toBe(Math.round(10 * SURGE.energy / 100));
    expect(player(little).heat).toBe(SURGE.heat);
  });

  test('a volley that destroys something gives back the least it asks, not all it took', () => {
    const strong: Catalog = { ...KINDS, [SURGE.id]: { ...SURGE, damage: 900 } };
    const open = field(SURGE, ['recon-drone', 'recon-drone', 'gun-turret'], {}, strong);
    expect(open.open).toBe(true);
    const first = applyAction(open, fire('rightHand', 'enemy-0'), strong, hit);
    expect(unit(first, 'enemy-0').destroyed).toBe(true);
    expect(player(first).energy).toBe(SURGE.energy);
    expect(player(first).fired).toEqual([]);
    // The second of the turn is fired with that much and no more.
    const second = applyAction(first, fire('rightHand', 'enemy-2'), KINDS, hit);
    expect(shots(second, first.events.length)[0]).toMatchObject({ damage: worth(first, SURGE, 'enemy-2', SURGE.energy / 100), lift: SURGE.energy });
    expect(player(second).energy).toBe(0);
  });

  test('Second Wind gives the turn\'s energy back, and it can all be taken again', () => {
    const drive = field(SURGE, ['heavy-mech'], { overdrive: 'second-wind', drive: 100 });
    const fired = applyAction(drive, fire('rightHand', 'enemy-0'), KINDS, hit);
    const again = applyAction(fired, { type: 'overdrive' }, KINDS);
    expect(player(again).energy).toBe(had);
    const after = applyAction(again, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(shots(after, again.events.length)[0].lift).toBe(had);
    expect(player(after).energy).toBe(0);
  });

  test('energy owed to a drain or lost to a stagger is energy it does not have', () => {
    const drained = toPlayer(applyAction(edit(full, (d) => { player(d).energyDebt = 70; }), END, KINDS));
    expect(player(drained).energy).toBe(had - 70);
    expect(preview(drained).damage).toBe(worth(full, SURGE, 'enemy-0', (had - 70) / 100));
  });

  test('a weapon of no kind takes what it asks and leaves the rest', () => {
    const plain = field(PLAIN, ['heavy-mech']);
    expect(player(applyAction(plain, fire('rightHand', 'enemy-0'), KINDS, hit)).energy).toBe(had - PLAIN.energy);
  });
});

describe('a fork weapon', () => {
  const three = field(FORK, ['gun-turret', 'gun-turret', 'gun-turret']);
  const half = worth(three, FORK, 'enemy-1', 0.5);

  test('a hit goes on to the next machine along the line, at its core, for half, and is not rolled for', () => {
    let rolls = 0;
    const after = applyAction(three, fire('rightHand', 'enemy-0'), KINDS, () => { rolls += 1; return 0; });
    expect(rolls).toBe(1);
    expect(shots(after, three.events.length)).toEqual([
      expect.objectContaining({ target: 'enemy-0', hit: true, damage: worth(three, FORK, 'enemy-0') }),
      expect.objectContaining({ target: 'enemy-1', part: 'core', appliedTo: 'core', hit: true, damage: half, via: 'enemy-0' }),
    ]);
    expect(shots(after, three.events.length)[0]).not.toHaveProperty('via');
    const core = unit(three, 'enemy-1').parts.core!.ap;
    expect(unit(after, 'enemy-1').parts.core!.ap).toBe(core - half);
    // As large a share as it is sold to send on.
    const more: Catalog = { ...KINDS, [FORK.id]: { ...FORK, traitPower: 80 } };
    expect(shots(applyAction(three, fire('rightHand', 'enemy-0'), more, hit), three.events.length)[1].damage).toBe(worth(three, FORK, 'enemy-1', 0.8));
  });

  test('a miss leaps nowhere', () => {
    const after = applyAction(three, fire('rightHand', 'enemy-0'), KINDS, miss);
    expect(shots(after, three.events.length)).toEqual([expect.objectContaining({ target: 'enemy-0', hit: false })]);
    expect(unit(after, 'enemy-1').parts.core!.ap).toBe(unit(three, 'enemy-1').parts.core!.ap);
  });

  test('the next along the line is the next that still stands, round to the first again', () => {
    expect(forkTarget(three, 'player', 'enemy-0')?.id).toBe('enemy-1');
    expect(forkTarget(three, 'player', 'enemy-1')?.id).toBe('enemy-2');
    expect(forkTarget(three, 'player', 'enemy-2')?.id).toBe('enemy-0');
    const gone = edit(three, (d) => { unit(d, 'enemy-1').destroyed = true; });
    expect(forkTarget(gone, 'player', 'enemy-0')?.id).toBe('enemy-2');
    expect(forkTarget(gone, 'player', 'enemy-2')?.id).toBe('enemy-0');
    // Never back to the machine it came from, never to its own side, and nowhere from a machine that is not there.
    const alone = edit(gone, (d) => { unit(d, 'enemy-2').destroyed = true; });
    expect(forkTarget(alone, 'player', 'enemy-0')).toBeUndefined();
    expect(forkTarget(three, 'player', 'player')).toBeUndefined();
    expect(forkTarget(three, 'nobody', 'enemy-0')).toBeUndefined();
    // From the other side the line is the pilot alone: there is nobody to go on to.
    expect(forkTarget(three, 'enemy-0', 'player')).toBeUndefined();
  });

  test('with nothing else standing there is one shot and no more', () => {
    const one = field(FORK, ['heavy-mech']);
    expect(shots(applyAction(one, fire('rightHand', 'enemy-0'), KINDS, hit), one.events.length)).toHaveLength(1);
  });

  test('the aiming line names where a hit would go on to', () => {
    expect(preview(three, 'enemy-0').fork).toBe('enemy-1');
    expect(preview(three, 'enemy-2').fork).toBe('enemy-0');
    expect(preview(field(FORK, ['heavy-mech']))).not.toHaveProperty('fork');
    expect(preview(field(PLAIN, ['gun-turret', 'gun-turret']))).not.toHaveProperty('fork');
  });

  test('aimed at a limb, what leaps on still strikes a core', () => {
    const mechs = field(FORK, ['heavy-mech', 'heavy-mech']);
    const after = applyAction(mechs, fire('rightHand', 'enemy-0', 'legs'), KINDS, hit);
    expect(shots(after, mechs.events.length)).toEqual([
      expect.objectContaining({ target: 'enemy-0', part: 'legs', damage: worth(mechs, FORK, 'enemy-0', 1, 1, 'legs') }),
      expect.objectContaining({ target: 'enemy-1', part: 'core', appliedTo: 'core', damage: worth(mechs, FORK, 'enemy-1', 0.5), via: 'enemy-0' }),
    ]);
  });

  test('what leaps on pushes half as hard, and is what the second machine is: on guard, behind a barrier, off balance', () => {
    const after = applyAction(three, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(unit(after, 'enemy-0').stagger).toBe(20);
    expect(unit(after, 'enemy-1').stagger).toBe(10);
    const behind = edit(three, (d) => { unit(d, 'enemy-1').barrier = 5; });
    expect(half).toBeGreaterThan(5);
    expect(shots(applyAction(behind, fire('rightHand', 'enemy-0'), KINDS, hit), behind.events.length)[1]).toMatchObject({ damage: half - 5, absorbed: 5 });
    const reeling = edit(three, (d) => { unit(d, 'enemy-1').staggered = 2; });
    expect(shots(applyAction(reeling, fire('rightHand', 'enemy-0'), KINDS, hit), reeling.events.length)[1].damage)
      .toBe(worth(three, FORK, 'enemy-1', 0.5, STAGGER_DAMAGE));
  });

  test('a machine destroyed by what leapt on is a kill like any other: the weapon is ready again', () => {
    expect(three.open).toBe(true);
    const frail = edit(three, (d) => { unit(d, 'enemy-1').parts.core!.ap = 1; });
    const before = player(frail).energy;
    const after = applyAction(frail, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(false);
    expect(unit(after, 'enemy-1').destroyed).toBe(true);
    expect(after.events.slice(frail.events.length)).toContainEqual({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 1 });
    expect(player(after).fired).toEqual([]);
    expect(player(after).energy).toBe(before);
  });

  test('the first hit destroying its own target, the bolt still goes on from where it stood', () => {
    const frail = edit(three, (d) => { unit(d, 'enemy-0').parts.core!.ap = 1; });
    const after = applyAction(frail, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(unit(after, 'enemy-0').destroyed).toBe(true);
    expect(shots(after, frail.events.length)[1]).toMatchObject({ target: 'enemy-1', via: 'enemy-0', damage: half });
  });

  test('a hit that ends the battle leaps nowhere', () => {
    const led = field(FORK, ['gun-turret', 'gun-turret'], { objective: { type: 'leader', target: 0 } });
    const frail = edit(led, (d) => { unit(d, 'enemy-0').parts.core!.ap = 1; });
    const after = applyAction(frail, fire('rightHand', 'enemy-0'), KINDS, hit);
    expect(after.outcome).toBe('victory');
    expect(shots(after, frail.events.length)).toHaveLength(1);
    expect(unit(after, 'enemy-1').parts.core!.ap).toBe(unit(led, 'enemy-1').parts.core!.ap);
  });

  test('the pilot a contract wants driven off is not finished by what leaps on, any more than by a hit', () => {
    const strong: Catalog = { ...KINDS, [FORK.id]: { ...FORK, damage: 5000 } };
    const chase = field(FORK, ['gun-turret', 'heavy-mech'], { objective: { type: 'driveOff', target: 1, share: 0.3 } }, strong);
    const sturdy = edit(chase, (d) => { unit(d, 'enemy-0').parts.core!.ap = 99_999; });
    const after = applyAction(sturdy, fire('rightHand', 'enemy-0'), strong, hit);
    expect(unit(after, 'enemy-1')).toMatchObject({ destroyed: false, parts: { core: { ap: 1 } } });
    expect(after.outcome).toBe('victory');
  });

  test('a weapon that fires at everything is not a fork: each of its shots is rolled, and none leaps', () => {
    const salvo: Catalog = { ...KINDS, [FORK.id]: { ...FORK, trait: 'salvo' } };
    let rolls = 0;
    const after = applyAction(three, fire('rightHand', 'enemy-0'), salvo, () => { rolls += 1; return 0; });
    expect(rolls).toBe(3);
    expect(shots(after, three.events.length).every((shot) => !('via' in shot))).toBe(true);
  });
});

describe('a spool weapon', () => {
  const start = field(SPOOL, ['heavy-mech']);
  const pull = (s: BattleState, roll = hit, catalog: Catalog = KINDS): BattleState => applyAction(s, fire('rightHand', 'enemy-0'), catalog, roll);
  const fired = (before: BattleState, after: BattleState): number => shots(after, before.events.length).length;
  /** Fires it this turn and comes to the next. */
  const turn = (s: BattleState): BattleState => nextTurn(pull(s));

  test('fires two shots, as it is sold: and each is rolled for', () => {
    expect(SPOOL_BASE).toBe(2);
    expect(shotsOf(SPOOL)).toBe(2);
    expect(shotsNow(player(start), 'rightHand', SPOOL)).toBe(2);
    let rolls = 0;
    const after = pull(start, () => { rolls += 1; return 0; });
    expect(fired(start, after)).toBe(2);
    expect(rolls).toBe(2);
  });

  test('fires one more for every turn in a row it has been fired, as far as it winds and no further', () => {
    let state = start;
    const counts: number[] = [];
    for (let i = 0; i < 6; i++) {
      counts.push(preview(state).shots);
      const after = pull(state);
      expect(fired(state, after)).toBe(counts[i]);
      state = nextTurn(after);
    }
    expect(counts).toEqual([2, 3, 4, 5, 5, 5]);
    // As far as the one in the shop winds: not always three.
    const short: Catalog = { ...KINDS, [SPOOL.id]: { ...SPOOL, traitPower: 1 } };
    expect(previewShot(state, 'player', 'rightHand', 'enemy-0', 'core', short).shots).toBe(3);
    expect(shotsNow(player(state), 'rightHand', { ...SPOOL, traitPower: 0 })).toBe(2);
  });

  test('a turn in which it is not fired brings it back to two', () => {
    const wound = turn(turn(start));
    expect(preview(wound).shots).toBe(4);
    expect(preview(nextTurn(wound)).shots).toBe(2);
    // And from there it winds up as from the first.
    expect(preview(turn(nextTurn(wound))).shots).toBe(3);
  });

  test('a turn lost to heat is a turn in which it was not fired', () => {
    const wound = turn(start);
    expect(preview(wound).shots).toBe(3);
    const hot = pull(edit(wound, (d) => { player(d).heat = HEAT_LIMIT; }));
    expect(player(hot).overheated).toBe(true);
    const back = nextTurn(hot);
    expect(back.events.slice(hot.events.length)).toContainEqual({ type: 'turnSkipped', unit: 'player' });
    expect(preview(back).shots).toBe(2);
  });

  test('firing something else does not keep it wound, and does not wind what was not fired', () => {
    const wound = turn(start);
    const other = nextTurn(applyAction(wound, fire('leftHand', 'enemy-0'), KINDS, hit));
    expect(preview(other).shots).toBe(2);
    // Two of them, each in a hand: each winds by its own turns.
    const two = field(SPOOL, ['heavy-mech'], {}, KINDS, { leftHand: SPOOL.id });
    const one = nextTurn(pull(two));
    expect(preview(one, 'enemy-0', 'core', 'rightHand').shots).toBe(3);
    expect(preview(one, 'enemy-0', 'core', 'leftHand').shots).toBe(2);
  });

  test('fired twice in a turn it winds up once: a kill that readied it, or Second Wind', () => {
    const strong: Catalog = { ...KINDS, [SPOOL.id]: { ...SPOOL, damage: 900 } };
    const open = field(SPOOL, ['recon-drone', 'recon-drone', 'gun-turret'], {}, strong);
    const first = applyAction(open, fire('rightHand', 'enemy-0'), strong, hit);
    // The first of the two destroyed it: the second stays in the barrel, and the weapon is ready again.
    expect(fired(open, first)).toBe(1);
    expect(player(first).fired).toEqual([]);
    const second = applyAction(first, fire('rightHand', 'enemy-2'), KINDS, hit);
    expect(fired(first, second)).toBe(2);
    expect(preview(nextTurn(second), 'enemy-2').shots).toBe(3);

    const drive = field(SPOOL, ['heavy-mech'], { overdrive: 'second-wind', drive: 100 });
    const again = pull(applyAction(pull(drive), { type: 'overdrive' }, KINDS));
    expect(fired(drive, again)).toBe(4);
    expect(preview(nextTurn(again)).shots).toBe(3);
  });

  test('the next battle of a contract begins with it at two again', () => {
    const wound = turn(turn(start));
    expect(preview(wound).shots).toBe(4);
    const next = field(SPOOL, ['heavy-mech'], { carry: { ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false } });
    expect(preview(next).shots).toBe(2);
  });

  test('a weapon of no kind fires what it is sold to fire, however long it has been fired', () => {
    let state = field(PLAIN, ['heavy-mech']);
    for (let i = 0; i < 3; i++) state = nextTurn(applyAction(state, fire('rightHand', 'enemy-0'), KINDS, hit));
    expect(preview(state).shots).toBe(1);
    const chain = CATALOG['wpn-chain-gun'] as Weapon;
    expect(shotsNow({ ...player(state), spool: { rightHand: 4 } }, 'rightHand', chain)).toBe(shotsOf(chain));
  });
});

describe('what a weapon would do now', () => {
  test('a weapon of no kind: what it asks, one shot, and nothing made of it', () => {
    const plain = field(PLAIN, ['heavy-mech']);
    expect(weaponNow(plain, 'player', 'rightHand', KINDS)).toEqual({ energy: PLAIN.energy, shots: 1, lift: 100 });
    expect(weaponNow(plain, 'player', 'leftHand', KINDS)).toEqual({ energy: (KINDS[DEMO_BUILD.leftHand!] as Weapon).energy, shots: 1, lift: 100 });
  });

  test('a surge: all the energy there is, and that much in a hundred', () => {
    const full = field(SURGE, ['heavy-mech']);
    const had = player(full).energy;
    expect(weaponNow(full, 'player', 'rightHand', KINDS)).toEqual({ energy: had, shots: 1, lift: had });
    const less = edit(full, (d) => { player(d).energy = 150; });
    expect(weaponNow(less, 'player', 'rightHand', KINDS)).toEqual({ energy: 150, shots: 1, lift: 150 });
    // With less than it asks it cannot be fired: what is said is what it would take to fire it.
    const short = edit(full, (d) => { player(d).energy = 30; });
    expect(weaponNow(short, 'player', 'rightHand', KINDS)).toEqual({ energy: SURGE.energy, shots: 1, lift: SURGE.energy });
  });

  test('a redline: what its machine\'s heat adds, up to the limit', () => {
    const cold = field(REDLINE, ['heavy-mech']);
    expect(weaponNow(cold, 'player', 'rightHand', KINDS)).toEqual({ energy: REDLINE.energy, shots: 1, lift: 100 });
    expect(weaponNow(edit(cold, (d) => { player(d).heat = 45; }), 'player', 'rightHand', KINDS).lift).toBe(127);
    expect(weaponNow(edit(cold, (d) => { player(d).heat = 3; }), 'player', 'rightHand', KINDS).lift).toBe(102);
    expect(weaponNow(edit(cold, (d) => { player(d).heat = 25; }), 'player', 'rightHand', KINDS).lift).toBe(115);
    expect(weaponNow(edit(cold, (d) => { player(d).heat = 130; }), 'player', 'rightHand', KINDS).lift).toBe(160);
  });

  test('a spool: the shots it has wound up to', () => {
    const start = field(SPOOL, ['heavy-mech']);
    expect(weaponNow(start, 'player', 'rightHand', KINDS)).toEqual({ energy: SPOOL.energy, shots: 2, lift: 100 });
    const wound = nextTurn(applyAction(start, fire('rightHand', 'enemy-0'), KINDS, hit));
    expect(weaponNow(wound, 'player', 'rightHand', KINDS).shots).toBe(3);
  });

  test('a punish says nothing of itself: what it does depends on who it is fired at', () => {
    const reeling = edit(field(PUNISH, ['heavy-mech']), (d) => { unit(d, 'enemy-0').staggered = 2; });
    expect(weaponNow(reeling, 'player', 'rightHand', KINDS).lift).toBe(100);
  });

  test('is asked of a weapon that is there', () => {
    const plain = field(PLAIN, ['heavy-mech'], {}, KINDS, { shoulder: undefined });
    expect(() => weaponNow(plain, 'player', 'shoulder', KINDS)).toThrow();
    expect(() => weaponNow(plain, 'nobody', 'rightHand', KINDS)).toThrow();
  });
});
