import { chooseAutoPlayerAction, chooseEnemyAction } from '../../src/core/ai';
import {
  HEAT_LIMIT, activeUnit, applyAction, boostCost, createBattle, guardCost,
  type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Build, Catalog, EnemyDef, Module, Weapon, WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const hit = () => 0;
const END: Action = { type: 'endTurn' };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const made = (id: string, change: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, ammo: null, costPerShot: 0, ...change });

/** One weapon of each kind that asks something of its machine, and plain ones to fire beside them. None pushes hard unless it says so. */
const REDLINE = made('wpn-t-redline', { trait: 'redline', traitPower: 6, damage: 30, energy: 60, heat: 10, impact: 5 });
const SURGE = made('wpn-t-surge', { trait: 'surge', damageType: 'energy', damage: 20, energy: 80, heat: 10, impact: 5 });
const SURGE_BACK = made('wpn-t-surge-back', { ...SURGE, id: 'wpn-t-surge-back', mount: 'shoulder' });
const PUNISH = made('wpn-t-punish', { trait: 'punish', traitPower: 50, damage: 30, energy: 60, heat: 10, impact: 5 });
const PUNISH_BLADE = made('wpn-t-punish-blade', { trait: 'punish', traitPower: 50, damage: 30, energy: 90, heat: 10, impact: 5, melee: true });
const FORK = made('wpn-t-fork', { trait: 'fork', traitPower: 50, damageType: 'energy', damage: 30, energy: 60, heat: 10, impact: 5 });
const SPOOL = made('wpn-t-spool', { trait: 'spool', traitPower: 3, damage: 5, energy: 60, heat: 10, impact: 1 });
const SPOOL_BACK = made('wpn-t-spool-back', { trait: 'spool', traitPower: 3, damage: 5, energy: 70, heat: 10, impact: 1, mount: 'shoulder' });
const BLADE = made('wpn-t-blade', { damage: 30, energy: 90, heat: 10, impact: 5, melee: true });
const PLAIN = made('wpn-t-plain', { damage: 30, energy: 60, heat: 30, impact: 5 });
const PLAIN_BACK = made('wpn-t-plain-back', { damage: 30, energy: 70, heat: 30, impact: 5, mount: 'shoulder' });
const SHOVE = made('wpn-t-shove', { damage: 10, energy: 60, heat: 10, impact: 9999 });
const SHOVE_BACK = made('wpn-t-shove-back', { damage: 10, energy: 70, heat: 10, impact: 9999, mount: 'shoulder' });
const KINDS: Catalog = {
  ...CATALOG,
  ...Object.fromEntries([REDLINE, SURGE, SURGE_BACK, PUNISH, PUNISH_BLADE, FORK, SPOOL, SPOOL_BACK, BLADE, PLAIN, PLAIN_BACK, SHOVE, SHOVE_BACK].map((w) => [w.id, w])),
};

const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
function toPlayer(s: BattleState, catalog: Catalog = KINDS): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
/** A battle in the stock frame with these weapons and nothing else carried, at the pilot's turn. */
function field(carried: Partial<Build>, enemies: (string | EnemyDef)[] = ['heavy-mech'], opts: BattleOptions = {}, catalog: Catalog = KINDS): BattleState {
  const build: Build = { ...DEMO_BUILD, rightHand: undefined, leftHand: undefined, shoulder: undefined, ...carried };
  for (const key of Object.keys(build) as (keyof Build)[]) if (build[key] === undefined) delete build[key];
  return toPlayer(createBattle(build, enemies.map((e) => (typeof e === 'string' ? ENEMIES[e] : e)), catalog, 1, opts), catalog);
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
type Shot = Extract<BattleEvent, { type: 'shot' }>;
/**
 * What the game's own pilot does with a turn, as the weapons it fires in the order it fires them: every shot lands.
 * Whatever else it does (a stance, a vent, its module) is named in its place.
 */
function turn(s: BattleState, catalog: Catalog = KINDS, choose = chooseAutoPlayerAction): { did: string[]; end: BattleState } {
  const did: string[] = [];
  const whose = activeUnit(s).id;
  for (let guard = 0; guard < 12 && s.outcome === 'ongoing' && activeUnit(s).id === whose; guard++) {
    const action = choose(s, catalog);
    if (action.type === 'endTurn') break;
    did.push(action.type === 'fire' ? action.weapon : action.type);
    s = applyAction(s, action, catalog, hit);
  }
  return { did, end: s };
}
const lifts = (before: BattleState, after: BattleState): (number | undefined)[] =>
  after.events.slice(before.events.length).filter((e): e is Shot => e.type === 'shot').map((shot) => shot.lift);
/** With this much energy and no more: nothing is left over for a stance once the weapons are paid for. */
const withEnergy = (s: BattleState, energy: number): BattleState => edit(s, (d) => { player(d).energy = energy; });

describe('the order the game\'s own pilot fires in', () => {
  test('weapons of no kind are fired as they always were: right hand, left hand, shoulder', () => {
    const plain = field({ rightHand: PLAIN.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id });
    expect(turn(withEnergy(plain, 190)).did).toEqual(['rightHand', 'leftHand', 'shoulder']);
    // And what the energy does not run to stays where it is, without the rest being held back for it.
    expect(turn(withEnergy(plain, 130)).did).toEqual(['rightHand', 'leftHand']);
  });

  test('a redline is fired after whatever else heats its machine, and is the better for it', () => {
    const start = withEnergy(field({ rightHand: REDLINE.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id }), 190);
    const { did, end } = turn(start);
    expect(did).toEqual(['leftHand', 'shoulder', 'rightHand']);
    // Two plain weapons of thirty heat each: the redline is fired at sixty.
    expect(lifts(start, end)).toEqual([undefined, undefined, 136]);
  });

  test('a redline is not left without the energy to fire: what the turn runs to is settled first, in the old order', () => {
    const carried = field({ rightHand: REDLINE.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id });
    // Enough for the two hands and not the shoulder: the shoulder weapon is the one that stays in its rack.
    expect(turn(withEnergy(carried, 120)).did).toEqual(['leftHand', 'rightHand']);
    // Enough for one weapon and a little: the redline, which is the first in the old order, and it alone.
    expect(turn(withEnergy(carried, 100)).did).toEqual(['rightHand']);
  });

  test('nor is it crowded out from under the heat limit: what the heat runs to is settled the same way', () => {
    const carried = field({ rightHand: REDLINE.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id });
    const warm = (heat: number, energy: number): BattleState => edit(withEnergy(carried, energy), (d) => { player(d).heat = heat; });
    // At forty-five there is room for the redline's ten and one weapon of thirty, not two: the shoulder waits.
    const start = warm(45, 120);
    const { did, end } = turn(start);
    expect(did).toEqual(['leftHand', 'rightHand']);
    expect(lifts(start, end)).toEqual([undefined, 145]);
    // With energy to spare it is still the redline that is fired second, before anything is vented for the third.
    const more = turn(warm(45, 400)).did;
    expect(more.slice(0, 2)).toEqual(['leftHand', 'rightHand']);
    // At sixty-five only the redline and nothing before it: it is fired at once.
    expect(turn(warm(65, 60)).did).toEqual(['rightHand']);
  });

  test('when nothing fits under the limit the old order stands: the machine vents first, as it always did', () => {
    const carried = field({ rightHand: REDLINE.id, leftHand: PLAIN.id });
    const hot = edit(withEnergy(carried, 400), (d) => { player(d).heat = HEAT_LIMIT - 5; });
    expect(chooseAutoPlayerAction(hot, KINDS)).toEqual({ type: 'cool' });
  });

  test('a spool that has wound up is fired before everything, and paid for before everything: a turn it misses sets it back to two shots', () => {
    const cold = field({ rightHand: PLAIN.id, leftHand: PLAIN.id, shoulder: SPOOL_BACK.id });
    const carried = edit(cold, (d) => { player(d).spool = { shoulder: 1 }; });
    expect(turn(withEnergy(carried, 190)).did).toEqual(['shoulder', 'rightHand', 'leftHand']);
    // Energy for two of the three: in the old order the shoulder would be the one left out.
    expect(turn(withEnergy(carried, 130)).did).toEqual(['shoulder', 'rightHand']);
    // And heat room for one weapon of ten, none of thirty: the spool.
    const warm = edit(withEnergy(carried, 70), (d) => { player(d).heat = HEAT_LIMIT - 10; });
    expect(turn(warm).did).toEqual(['shoulder']);
    // With nothing beside it that asks anything, it still goes first.
    const hands = edit(field({ rightHand: PLAIN.id, leftHand: SPOOL.id }), (d) => { player(d).spool = { leftHand: 2 }; });
    expect(turn(withEnergy(hands, 120)).did).toEqual(['leftHand', 'rightHand']);
  });

  test('a spool that has not wound up is the least of what the machine carries: it waits its turn like any weapon', () => {
    const cold = field({ rightHand: PLAIN.id, leftHand: PLAIN.id, shoulder: SPOOL_BACK.id });
    expect(turn(withEnergy(cold, 190)).did).toEqual(['rightHand', 'leftHand', 'shoulder']);
    expect(turn(withEnergy(cold, 130)).did).toEqual(['rightHand', 'leftHand']);
    // Wound by another weapon's turns, it is no more wound than it was.
    const other = edit(cold, (d) => { player(d).spool = { rightHand: 3 }; });
    expect(turn(withEnergy(other, 130)).did).toEqual(['rightHand', 'leftHand']);
    // Beside a kind that waits, an unwound spool is fired in its place and the kind after it.
    const kinds = withEnergy(field({ rightHand: REDLINE.id, leftHand: SPOOL.id }), 120);
    expect(turn(kinds).did).toEqual(['leftHand', 'rightHand']);
  });

  test('a blade is still paid for before a spool: the boost that carried the machine in was for the blade', () => {
    const carried = edit(field({ rightHand: BLADE.id, shoulder: SPOOL_BACK.id }), (d) => { player(d).spool = { shoulder: 1 }; });
    const boost = boostCost(player(carried), KINDS);
    expect(turn(withEnergy(carried, boost + BLADE.energy + SPOOL_BACK.energy - 1)).did).toEqual(['boost', 'rightHand']);
    // With energy for both the spool is fired first, as it is before anything.
    expect(turn(withEnergy(carried, boost + BLADE.energy + SPOOL_BACK.energy)).did).toEqual(['boost', 'shoulder', 'rightHand']);
  });

  test('a surge is fired last of all, with what the others leave', () => {
    // (With no more left than the stance would cost on top of the surge's least: the next test is about the stance.)
    const start = withEnergy(field({ rightHand: SURGE.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id }), 250);
    const { did, end } = turn(start);
    expect(did).toEqual(['leftHand', 'shoulder', 'rightHand']);
    expect(lifts(start, end)).toEqual([undefined, undefined, 250 - PLAIN.energy - PLAIN_BACK.energy]);
    expect(player(end).energy).toBe(0);
  });

  test('a stance is taken before the surge, which would leave nothing for one: where the surge still gets the least it asks', () => {
    const carried = field({ rightHand: SURGE.id, leftHand: PLAIN.id });
    const boost = boostCost(player(carried), KINDS);
    const guard = guardCost(player(carried), KINDS);
    expect([boost, guard]).toEqual([69, 46]);
    // Against one machine that hits as this one does, the stance this pilot takes with energy to spare is a boost.
    const rich = withEnergy(carried, PLAIN.energy + boost + SURGE.energy);
    const { did, end } = turn(rich);
    expect(did).toEqual(['leftHand', 'boost', 'rightHand']);
    expect(lifts(rich, end)).toEqual([undefined, SURGE.energy]);
    // A point short of that, the boost would leave the surge less than it asks: a guard, which is cheaper, is taken instead.
    const less = turn(withEnergy(carried, PLAIN.energy + boost + SURGE.energy - 1));
    expect(less.did).toEqual(['leftHand', 'guard', 'rightHand']);
    expect(player(less.end)).toMatchObject({ guarding: true, energy: 0 });
    // And with too little for either, the surge is fired as it is.
    expect(turn(withEnergy(carried, PLAIN.energy + guard + SURGE.energy - 1)).did).toEqual(['leftHand', 'rightHand']);
    // A machine that has taken its stance already takes no second one.
    const braced = edit(withEnergy(carried, 400), (d) => { player(d).usedGuard = true; player(d).guarding = true; });
    expect(turn(braced).did).toEqual(['leftHand', 'rightHand']);
    // And a machine that carries no surge still takes its stance last, with what is left over.
    expect(turn(withEnergy(field({ rightHand: PLAIN.id, leftHand: PLAIN.id }), 400)).did).toEqual(['rightHand', 'leftHand', 'boost']);
  });

  test('a surge is given the least it asks before anything behind it in the old order is paid for', () => {
    const carried = field({ rightHand: SURGE.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id });
    // The left hand as well, and then nothing for the shoulder.
    expect(turn(withEnergy(carried, 145)).did).toEqual(['leftHand', 'rightHand']);
    // Not enough for the surge's least and the left hand: the surge takes it all.
    const short = withEnergy(carried, 120);
    const { did, end } = turn(short);
    expect(did).toEqual(['rightHand']);
    expect(lifts(short, end)).toEqual([120]);
    // And a surge behind the others in the old order is fired if they leave it its least: here they do not.
    const behind = field({ rightHand: PLAIN.id, leftHand: PLAIN.id, shoulder: SURGE_BACK.id });
    const left = turn(withEnergy(behind, 199)).did;
    expect(left.slice(0, 2)).toEqual(['rightHand', 'leftHand']);
    expect(left).not.toContain('shoulder');
    expect(turn(withEnergy(behind, 200)).did).toEqual(['rightHand', 'leftHand', 'shoulder']);
  });

  test('a punish waits for whatever else there is to fire at a steady machine', () => {
    const start = withEnergy(field({ rightHand: PUNISH.id, leftHand: SHOVE.id }), 120);
    expect(unit(start, 'enemy-0').staggered).toBe(0);
    const { did, end } = turn(start);
    expect(did).toEqual(['leftHand', 'rightHand']);
    // The left hand knocked it off balance, and the punish landed on a machine that reeled.
    expect(lifts(start, end)).toEqual([undefined, 150]);
    // Even when nothing it carries could knock the machine off balance this turn: there is nothing to lose by waiting.
    expect(turn(withEnergy(field({ rightHand: PUNISH.id, leftHand: PLAIN.id }), 120)).did).toEqual(['leftHand', 'rightHand']);
  });

  test('at a machine that is already off balance a punish is fired in its turn like any other', () => {
    const reeling = edit(withEnergy(field({ rightHand: PUNISH.id, leftHand: PLAIN.id }), 120), (d) => { unit(d, 'enemy-0').staggered = 2; });
    expect(turn(reeling).did).toEqual(['rightHand', 'leftHand']);
  });

  test('a redline after a punish, and a surge after both', () => {
    const all = withEnergy(field({ rightHand: SURGE.id, leftHand: REDLINE.id, shoulder: PLAIN_BACK.id }), 250);
    expect(turn(all).did).toEqual(['shoulder', 'leftHand', 'rightHand']);
    const two = withEnergy(field({ rightHand: REDLINE.id, leftHand: PUNISH.id, shoulder: PLAIN_BACK.id }), 190);
    expect(turn(two).did).toEqual(['shoulder', 'leftHand', 'rightHand']);
  });

  test('a blade that punishes strikes after a gun has knocked the machine off balance, when there is energy for both', () => {
    const carried = field({ rightHand: PUNISH_BLADE.id, shoulder: SHOVE_BACK.id });
    const boost = Math.ceil(0.3 * player(carried).turnEnergy);
    // It closes in first, as a blade asks; then the gun, then the blade.
    const both = withEnergy(carried, boost + SHOVE_BACK.energy + PUNISH_BLADE.energy);
    const { did, end } = turn(both);
    expect(did).toEqual(['boost', 'shoulder', 'rightHand']);
    expect(lifts(both, end)).toEqual([undefined, 150]);
    // With energy for the blade alone the gun does not take it: the blade is what the boost was for.
    expect(turn(withEnergy(carried, boost + PUNISH_BLADE.energy + SHOVE_BACK.energy - 1)).did).toEqual(['boost', 'rightHand']);
  });
});

describe('heat that a redline is about to use', () => {
  const flush: Module = { ...(CATALOG['mod-coolant'] as Module) };
  const hot = (carried: Partial<Build>, heat: number): BattleState =>
    edit(withEnergy(field({ ...carried, module: flush.id }), 60), (d) => { player(d).heat = heat; });

  test('a machine with a coolant flush and no redline vents from fifty, as it always did', () => {
    expect(chooseAutoPlayerAction(hot({ rightHand: PLAIN.id }, 49), KINDS)).toEqual({ type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
    expect(chooseAutoPlayerAction(hot({ rightHand: PLAIN.id }, 50), KINDS)).toEqual({ type: 'module' });
  });

  test('one that carries a redline keeps its heat until a weapon of its own would take it past the limit', () => {
    // The redline makes ten of heat and the plain weapon thirty: at seventy the plain one still fits.
    expect(chooseAutoPlayerAction(hot({ rightHand: REDLINE.id, leftHand: PLAIN.id }, HEAT_LIMIT - PLAIN.heat), KINDS).type).toBe('fire');
    expect(chooseAutoPlayerAction(hot({ rightHand: REDLINE.id, leftHand: PLAIN.id }, HEAT_LIMIT - PLAIN.heat + 1), KINDS)).toEqual({ type: 'module' });
    // With the redline alone it is the redline's own heat that counts.
    expect(chooseAutoPlayerAction(hot({ rightHand: REDLINE.id }, HEAT_LIMIT - REDLINE.heat), KINDS).type).toBe('fire');
    expect(chooseAutoPlayerAction(hot({ rightHand: REDLINE.id }, HEAT_LIMIT - REDLINE.heat + 1), KINDS)).toEqual({ type: 'module' });
  });
});

describe('a fork beside a machine the client wants in one piece', () => {
  // A drone that mends is shot before the machine it mends; the machine wanted is the next along the line.
  const wanted: BattleOptions = { objective: { type: 'disable', target: 1 } };
  const beside = (catalog: Catalog): BattleState => withEnergy(field({ rightHand: FORK.id, leftHand: PLAIN.id }, ['repair-drone', 'heavy-mech'], wanted, catalog), 120);

  test('is fired when what leaps on cannot finish that machine', () => {
    const state = beside(KINDS);
    expect(chooseAutoPlayerAction(state, KINDS)).toEqual({ type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
  });

  test('stays in the hand when it could, and something else is fired', () => {
    const strong: Catalog = { ...KINDS, [FORK.id]: { ...FORK, damage: 5000 } };
    const state = beside(strong);
    expect(chooseAutoPlayerAction(state, strong)).toEqual({ type: 'fire', weapon: 'leftHand', target: 'enemy-0', part: 'core' });
    // It is the share that leaps on that counts, not the whole of the hit: half of this is short of the core, all of it is not.
    const core = unit(state, 'enemy-1').parts.core!.ap;
    const whole = (damage: number): Catalog => ({ ...KINDS, [FORK.id]: { ...FORK, damage } });
    const just = Math.ceil(core / 0.95) + 2;
    expect(chooseAutoPlayerAction(beside(whole(just)), whole(just))).toMatchObject({ type: 'fire', weapon: 'rightHand' });
    expect(chooseAutoPlayerAction(beside(whole(just * 2 + 40)), whole(just * 2 + 40))).toMatchObject({ type: 'fire', weapon: 'leftHand' });
  });

  test('is fired at the wanted machine\'s own limbs like anything else: what leaps on from there lands elsewhere', () => {
    const strong: Catalog = { ...KINDS, [FORK.id]: { ...FORK, damage: 5000 } };
    const alone = withEnergy(field({ rightHand: FORK.id }, ['heavy-mech', 'heavy-mech'], { objective: { type: 'disable', target: 0 } }, strong), 60);
    expect(chooseAutoPlayerAction(alone, strong)).toEqual({ type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'legs' });
  });
});

describe('a machine the game flies against the pilot', () => {
  const flown = (build: Partial<Build>): EnemyDef => ({
    id: 'flown', name: 'Flown', ai: 'gunner', sprite: 'enemy-heavy-mech',
    build: { ...DEMO_BUILD, rightHand: undefined, leftHand: undefined, shoulder: undefined, ...build },
  });
  /** The pilot's turn ended, the other machine's begun. */
  const theirs = (def: EnemyDef, energy: number): BattleState => {
    for (const key of Object.keys(def.build) as (keyof Build)[]) if (def.build[key] === undefined) delete def.build[key];
    let s = createBattle({ ...DEMO_BUILD }, [def], KINDS, 1);
    for (let guard = 0; activeUnit(s).id !== 'enemy-0' && guard < 4; guard++) s = applyAction(s, END, KINDS);
    return edit(s, (d) => { unit(d, 'enemy-0').energy = energy; });
  };
  const slots = (s: BattleState): WeaponSlot[] => turn(s, KINDS, chooseEnemyAction).did as WeaponSlot[];

  test('fires its shoulder first and then its hands, as it always did', () => {
    expect(slots(theirs(flown({ rightHand: PLAIN.id, leftHand: PLAIN.id, shoulder: PLAIN_BACK.id }), 190))).toEqual(['shoulder', 'rightHand', 'leftHand']);
  });

  test('fires a wound spool first, and keeps a surge for last, a redline for after the rest, and a punish for after what staggers', () => {
    const wound = edit(theirs(flown({ rightHand: PLAIN.id, leftHand: SPOOL.id }), 120), (d) => { unit(d, 'enemy-0').spool = { leftHand: 1 }; });
    expect(slots(wound)).toEqual(['leftHand', 'rightHand']);
    expect(slots(theirs(flown({ rightHand: PLAIN.id, leftHand: SPOOL.id }), 120))).toEqual(['rightHand', 'leftHand']);
    // It takes no stance for a surge: a machine flown against the pilot never has taken one with energy to spare.
    expect(slots(theirs(flown({ rightHand: PLAIN.id, shoulder: SURGE_BACK.id }), 300))).toEqual(['rightHand', 'shoulder']);
    expect(slots(theirs(flown({ rightHand: REDLINE.id, leftHand: PLAIN.id }), 120))).toEqual(['leftHand', 'rightHand']);
    expect(slots(theirs(flown({ rightHand: PUNISH.id, leftHand: SHOVE.id }), 120))).toEqual(['leftHand', 'rightHand']);
  });
});
