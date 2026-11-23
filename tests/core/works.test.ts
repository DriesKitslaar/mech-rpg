import { chooseAutoPlayerAction } from '../../src/core/ai';
import {
  HEAT_AFTER_OVERHEAT, HEAT_LIMIT, STAGGER_ENERGY, activeUnit, applyAction, createBattle, heatLimitOf, bufferOf, turnEnergyOf, weaponNow,
  type Action, type BattleEvent, type BattleState, type UnitState,
} from '../../src/core/battle';
import type { Build, Catalog, EnemyDef, FramePart, Module, Weapon, WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

/**
 * The two things a core can do that no other does, apart from the cores that are sold with them:
 * a heat limit of its own, and energy kept from one turn for the next.
 */
const hit = () => 0;
const END: Action = { type: 'endTurn' };
const stock = CATALOG[DEMO_BUILD.core!] as FramePart;
const HOT: FramePart = { ...stock, id: 'core-t-hot', name: 'core-t-hot', heatLimit: 130 };
const DEEP: FramePart = { ...stock, id: 'core-t-deep', name: 'core-t-deep', buffer: 50 };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const made = (id: string, change: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, ammo: null, costPerShot: 0, ...change });
const WARM = made('wpn-t-warm', { damage: 20, energy: 40, heat: 30 });
const WARM_LEFT = made('wpn-t-warm-left', { damage: 20, energy: 40, heat: 30 });
const WARM_BACK = made('wpn-t-warm-back', { damage: 20, energy: 40, heat: 30, mount: 'shoulder' });
const ONE = made('wpn-t-one', { damage: 20, energy: 40, heat: 1 });
const REDLINE = made('wpn-t-redline', { trait: 'redline', traitPower: 6, damage: 50, energy: 40, heat: 10 });
const DRAIN = made('wpn-t-drain', { trait: 'drain', traitPower: 70, damage: 5, energy: 10, heat: 1 });
const WORKS: Catalog = {
  ...CATALOG, [HOT.id]: HOT, [DEEP.id]: DEEP,
  ...Object.fromEntries([WARM, WARM_LEFT, WARM_BACK, ONE, REDLINE, DRAIN].map((w) => [w.id, w])),
};

const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const player = (s: BattleState): UnitState => unit(s, 'player');
function toPlayer(s: BattleState, catalog: Catalog = WORKS): BattleState {
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
/** A battle in the stock frame with this core and these weapons and nothing else carried, at the pilot's turn. */
function field(core: string, carried: Partial<Build> = {}, enemies: (string | EnemyDef)[] = ['heavy-mech'], catalog: Catalog = WORKS): BattleState {
  const build: Build = { ...DEMO_BUILD, core, rightHand: undefined, leftHand: undefined, shoulder: undefined, ...carried };
  for (const key of Object.keys(build) as (keyof Build)[]) if (build[key] === undefined) delete build[key];
  return toPlayer(createBattle(build, enemies.map((e) => (typeof e === 'string' ? ENEMIES[e] : e)), catalog, 1), catalog);
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
const fire = (weapon: WeaponSlot, target = 'enemy-0'): Action => ({ type: 'fire', weapon, target, part: 'core' });
const at = (s: BattleState, heat: number): BattleState => edit(s, (d) => { player(d).heat = heat; });
const events = (before: BattleState, after: BattleState): BattleEvent[] => after.events.slice(before.events.length);
const nextTurn = (s: BattleState, catalog: Catalog = WORKS): BattleState => toPlayer(applyAction(s, END, catalog), catalog);

describe('a core with a heat limit of its own', () => {
  const hot = field(HOT.id, { rightHand: ONE.id, leftHand: REDLINE.id });
  const plain = field(stock.id, { rightHand: ONE.id, leftHand: REDLINE.id });

  test('gives its machine that limit, and no other machine: the usual one is a hundred', () => {
    expect(HEAT_LIMIT).toBe(100);
    expect(player(hot).heatLimit).toBe(130);
    expect(player(plain).heatLimit).toBe(HEAT_LIMIT);
    expect(unit(hot, 'enemy-0').heatLimit).toBe(HEAT_LIMIT);
    expect(heatLimitOf(player(hot).build, WORKS)).toBe(130);
    expect(heatLimitOf(player(plain).build, WORKS)).toBe(HEAT_LIMIT);
  });

  test('a shot that takes any other machine past a hundred overheats it; this one not until it is past its own limit', () => {
    const over = (s: BattleState, heat: number): boolean => {
      const after = applyAction(at(s, heat), fire('rightHand'), WORKS, hit);
      expect(player(after).heat).toBe(heat + ONE.heat);
      return events(s, after).some((e) => e.type === 'overheat') && player(after).overheated;
    };
    expect(over(plain, 99)).toBe(false);
    expect(over(plain, 100)).toBe(true);
    expect(over(hot, 100)).toBe(false);
    expect(over(hot, 129)).toBe(false);
    expect(over(hot, 130)).toBe(true);
  });

  test('past its limit it loses its next turn and comes down to fifty, as any machine does', () => {
    const fired = applyAction(at(hot, 130), fire('rightHand'), WORKS, hit);
    const after = applyAction(fired, END, WORKS);
    const skipped = toPlayer(after);
    expect(skipped.events.slice(fired.events.length).filter((e) => e.type === 'turnSkipped' && e.unit === 'player')).toHaveLength(1);
    expect(player(skipped).heat).toBeLessThanOrEqual(HEAT_AFTER_OVERHEAT);
    expect(player(skipped).overheated).toBe(false);
  });

  test('a redline\'s heat counts up to the limit of the machine that fires it: a hundred and thirty here, a hundred anywhere else', () => {
    const lift = (s: BattleState, heat: number): number => weaponNow(at(s, heat), 'player', 'leftHand', WORKS).lift;
    expect(lift(plain, 100)).toBe(160);
    expect(lift(plain, 130)).toBe(160);
    expect(lift(hot, 100)).toBe(160);
    expect(lift(hot, 120)).toBe(172);
    expect(lift(hot, 130)).toBe(178);
    expect(lift(hot, 200)).toBe(178);
    // And what the shot then does is what was said of it.
    const state = at(hot, 120);
    const after = applyAction(state, fire('leftHand'), WORKS, hit);
    expect(events(state, after).find((e) => e.type === 'shot')).toMatchObject({ lift: 172 });
  });

  test('the game\'s own pilot fires where there is room under the machine\'s own limit, and vents where there is not', () => {
    const three = { rightHand: WARM.id, leftHand: WARM_LEFT.id, shoulder: WARM_BACK.id };
    const did = (s: BattleState): string[] => {
      const list: string[] = [];
      for (let guard = 0; guard < 8 && activeUnit(s).id === 'player' && s.outcome === 'ongoing'; guard++) {
        const action = chooseAutoPlayerAction(s, WORKS);
        if (action.type === 'endTurn') break;
        list.push(action.type === 'fire' ? action.weapon : action.type);
        s = applyAction(s, action, WORKS, hit);
      }
      return list;
    };
    const energy = (s: BattleState, amount: number): BattleState => edit(s, (d) => { player(d).energy = amount; });
    // At seventy-five a weapon of thirty takes any other machine past its limit: it vents first. This one has room for one.
    expect(did(energy(at(field(stock.id, three), 75), 400))[0]).toBe('cool');
    const here = did(energy(at(field(HOT.id, three), 75), 400));
    expect(here.slice(0, 2)).toEqual(['rightHand', 'cool']);
    // From forty it fires all three, with energy for those and no more, and vents nothing: a hundred and thirty is not past its limit.
    expect(did(energy(at(field(HOT.id, three), 40), 120))).toEqual(['rightHand', 'leftHand', 'shoulder']);
    // Any other machine fires two from there, and the third not before it has vented.
    const there = did(energy(at(field(stock.id, three), 40), 400));
    expect(there.slice(0, 3)).toEqual(['rightHand', 'leftHand', 'cool']);
  });

  test('a coolant flush is kept back beside a redline until a weapon would pass the machine\'s own limit', () => {
    const flush = Object.values(CATALOG).find((part): part is Module => part.kind === 'module' && part.effect === 'coolant')!;
    const carried = { rightHand: WARM.id, leftHand: REDLINE.id, module: flush.id };
    const first = (s: BattleState): Action => chooseAutoPlayerAction(edit(s, (d) => { player(d).energy = 200; }), WORKS);
    expect(first(at(field(stock.id, carried), 75))).toMatchObject({ type: 'module' });
    expect(first(at(field(HOT.id, carried), 75))).toMatchObject({ type: 'fire' });
    expect(first(at(field(HOT.id, carried), 105))).toMatchObject({ type: 'module' });
  });

  test('goes with the core: a machine of the other side that is built on one has it too', () => {
    const spar: EnemyDef = { id: 'spar-t', name: 'Spar', ai: 'gunner', sprite: 'enemy-rival', composed: true, build: { ...DEMO_BUILD, core: HOT.id } };
    const state = field(stock.id, { rightHand: ONE.id }, [spar]);
    expect(unit(state, 'enemy-0').heatLimit).toBe(130);
    expect(player(state).heatLimit).toBe(HEAT_LIMIT);
  });
});

describe('a core with a buffer', () => {
  const deep = field(DEEP.id, { rightHand: ONE.id });
  const plain = field(stock.id, { rightHand: ONE.id });
  const turn = turnEnergyOf(player(deep), WORKS);
  const cap = Math.floor(turn / 2);

  test('is a share of what a turn gives: half of it, of this one; nothing, of any other core', () => {
    expect(turn).toBeGreaterThan(100);
    expect(player(deep).buffer).toBe(50);
    expect(player(plain).buffer).toBe(0);
    expect(bufferOf(player(deep).build, WORKS)).toBe(50);
    expect(bufferOf(player(plain).build, WORKS)).toBe(0);
    expect(player(deep).energy).toBe(turn);
    expect(player(deep).kept).toBe(0);
  });

  test('what is left when the turn ends is there on top of the next turn\'s energy', () => {
    const spent = edit(deep, (d) => { player(d).energy = 30; });
    const next = nextTurn(spent);
    expect(player(next).energy).toBe(turn + 30);
    // And the turn says so as it opens.
    const opened = events(spent, next).filter((e) => e.type === 'turnStart' && e.unit === 'player');
    expect(opened).toEqual([{ type: 'turnStart', unit: 'player', kept: 30 }]);
  });

  test('never more than the buffer holds: a turn in which nothing was spent keeps half a turn, and so does every one after it', () => {
    const next = nextTurn(deep);
    expect(player(next).energy).toBe(turn + cap);
    const again = nextTurn(next);
    expect(player(again).energy).toBe(turn + cap);
    const third = nextTurn(edit(again, (d) => { player(d).energy = cap + 1; }));
    expect(player(third).energy).toBe(turn + cap);
    const just = nextTurn(edit(again, (d) => { player(d).energy = cap - 1; }));
    expect(player(just).energy).toBe(turn + cap - 1);
  });

  test('a machine without one keeps nothing, and its turn says nothing of it', () => {
    const next = nextTurn(edit(plain, (d) => { player(d).energy = 30; }));
    expect(player(next).energy).toBe(turnEnergyOf(player(plain), WORKS));
    expect(events(plain, next).filter((e) => e.type === 'turnStart' && e.unit === 'player')).toEqual([{ type: 'turnStart', unit: 'player' }]);
  });

  test('a turn with nothing left keeps nothing, and says nothing', () => {
    const empty = edit(deep, (d) => { player(d).energy = 0; });
    const next = nextTurn(empty);
    expect(player(next).energy).toBe(turn);
    expect(events(empty, next).filter((e) => e.type === 'turnStart' && e.unit === 'player')).toEqual([{ type: 'turnStart', unit: 'player' }]);
  });

  test('a turn lost to heat loses nothing that was kept: it is there in the turn after', () => {
    const hot = edit(deep, (d) => { player(d).energy = 40; player(d).overheated = true; });
    const lost = applyAction(hot, END, WORKS);
    // The pilot's turn is skipped: the next one the pilot has is a round on.
    const back = toPlayer(lost);
    expect(back.events.slice(hot.events.length).filter((e) => e.type === 'turnSkipped' && e.unit === 'player')).toHaveLength(1);
    expect(back.round).toBe(hot.round + 2);
    expect(player(back).energy).toBe(turn + 40);
  });

  test('a stagger halves the turn\'s own energy and not what was kept', () => {
    const reeling = edit(deep, (d) => { player(d).energy = 40; player(d).staggered = 2; });
    const next = nextTurn(reeling);
    expect(player(next).staggered).toBe(1);
    expect(player(next).energy).toBe(Math.floor(turn * STAGGER_ENERGY) + 40);
  });

  test('a drain comes off the turn\'s own energy and not what was kept', () => {
    const owed = edit(deep, (d) => { player(d).energy = 40; player(d).energyDebt = 70; });
    expect(player(nextTurn(owed)).energy).toBe(turn - 70 + 40);
    const ruined = edit(deep, (d) => { player(d).energy = 40; player(d).energyDebt = turn + 500; });
    expect(player(nextTurn(ruined)).energy).toBe(40);
  });

  test('what a turn opened with is what a Second Wind gives back: the kept energy with it', () => {
    const second = edit(deep, (d) => { player(d).energy = 60; player(d).overdrive = 'second-wind'; });
    const next = nextTurn(second);
    expect(player(next).energy).toBe(turn + 60);
    expect(player(next).turnEnergy).toBe(turn + 60);
  });

  test('goes with the core: a machine of the other side that is built on one keeps its energy too', () => {
    const spar: EnemyDef = { id: 'spar-t', name: 'Spar', ai: 'gunner', sprite: 'enemy-rival', composed: true, build: { ...DEMO_BUILD, core: DEEP.id, rightHand: undefined } };
    delete spar.build.rightHand;
    let state = field(stock.id, { rightHand: ONE.id }, [spar]);
    expect(unit(state, 'enemy-0').buffer).toBe(50);
    // It has nothing to fire: a round on, all it can keep is kept.
    const own = turnEnergyOf(unit(state, 'enemy-0'), WORKS);
    state = nextTurn(state);
    state = applyAction(state, END, WORKS);
    expect(activeUnit(state).id).toBe('enemy-0');
    expect(unit(state, 'enemy-0').energy).toBe(own + Math.floor(own / 2));
  });
});
