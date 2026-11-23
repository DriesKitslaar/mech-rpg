import {
  HARDENED, activeUnit, applyAction, createBattle, hardenedAgainst, previewShot,
  type Action, type BattleEvent, type BattleState, type UnitState,
} from '../../src/core/battle';
import { FRAME_SLOTS, type Build, type Catalog, type EnemyDef, type Weapon, type WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

/**
 * A machine can be hardened against weapons, by their ids: each of those does half to it, where the
 * shot is previewed and where it lands, and all of what it does to anything else.
 *
 * Half is held here against a catalogue in which the weapon is listed at half its damage: whatever a
 * shot is made of (its kind, the heat or energy behind it, what the part resists, where it is
 * rounded), a machine hardened against a weapon takes from it exactly what any machine takes from
 * that weapon at half its listing.
 */
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
// (A push of their own, so that halving the listing changes the damage and nothing else.)
const made = (id: string, change: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, ammo: null, costPerShot: 0, accuracy: 200, energy: 40, heat: 5, damage: 31, impact: 20, ...change });
const RIFLE = made('wpn-t-rifle', {});
const OTHER = made('wpn-t-other', { damage: 27 });
const BLADE = made('wpn-t-blade', { melee: true, damage: 47 });
const BOW = made('wpn-t-bow', { charge: true, damage: 53 });
const PODS = made('wpn-t-pods', { trait: 'salvo', mount: 'shoulder', damage: 23 });
const SURGE = made('wpn-t-surge', { trait: 'surge', damage: 15, energy: 100 });
const FORK = made('wpn-t-fork', { trait: 'fork', traitPower: 60, damage: 37 });
const REDLINE = made('wpn-t-redline', { trait: 'redline', traitPower: 20, damage: 29, heat: 30 });
const TEST: Catalog = { ...CATALOG, ...Object.fromEntries([RIFLE, OTHER, BLADE, BOW, PODS, SURGE, FORK, REDLINE].map((w) => [w.id, w])) };
const halved = (id: string): Catalog => ({ ...TEST, [id]: { ...(TEST[id] as Weapon), damage: (TEST[id] as Weapon).damage / 2 } });

const END: Action = { type: 'endTurn' };
const HEAVY = ENEMIES['heavy-mech'];
const LIGHT = ENEMIES['light-mech'];
const against = (...ids: string[]): EnemyDef => ({ ...HEAVY, hardened: ids });
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;

/** A battle in the demo frame with these weapons, against these, at the pilot's turn. */
function battle(weapons: Partial<Record<WeaponSlot, string>>, enemies: EnemyDef[], catalog: Catalog, seed = 1): BattleState {
  const build: Build = { ...DEMO_BUILD };
  delete build.rightHand; delete build.leftHand; delete build.shoulder;
  let s = createBattle({ ...build, ...weapons }, enemies, catalog, seed);
  for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, catalog);
  expect(activeUnit(s).id).toBe('player');
  return s;
}
const preview = (s: BattleState, slot: WeaponSlot, target: string, catalog: Catalog) =>
  FRAME_SLOTS.map((part) => {
    const { hitChance, damage, kills, shots, salvo } = previewShot(s, 'player', slot, target, part, catalog);
    return { part, hitChance, damage, kills, shots, salvo };
  });
/** What the pilot's shots did, as the battle wrote them down. */
const shots = (s: BattleState, from = 0) => s.events.slice(from).flatMap((e: BattleEvent) =>
  (e.type === 'shot' && e.unit === 'player' ? [{ target: e.target, hit: e.hit, damage: e.damage, leapt: e.via !== undefined }] : []));
/** The first seed, of the first forty, on which the pilot's opening shot lands in both battles. */
function fired(make: (seed: number) => [BattleState, Catalog], twin: (seed: number) => [BattleState, Catalog], action: Action, first: Action[] = []) {
  for (let seed = 1; seed <= 40; seed++) {
    const run = ([s, catalog]: [BattleState, Catalog]) => {
      let next = s;
      for (const step of first) next = applyAction(next, step, catalog);
      const at = next.events.length;
      return shots(applyAction(next, action, catalog), at);
    };
    const a = run(make(seed));
    const b = run(twin(seed));
    if (a.length > 0 && a.every((shot) => shot.hit) && b.every((shot) => shot.hit)) return { a, b };
  }
  throw new Error('no seed on which every shot lands');
}

describe('a machine hardened against a weapon', () => {
  test('half is half: the figure is one half, and it is asked of the machine and the weapon', () => {
    expect(HARDENED).toBe(0.5);
    const s = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], TEST);
    expect(hardenedAgainst(unit(s, 'enemy-0'), RIFLE)).toBe(true);
    expect(hardenedAgainst(unit(s, 'enemy-0'), OTHER)).toBe(false);
    expect(hardenedAgainst(unit(s, 'enemy-1'), RIFLE)).toBe(false);
    expect(hardenedAgainst(unit(s, 'player'), RIFLE)).toBe(false);
  });

  test('takes from it what any machine takes from that weapon at half its listing: at every part, as it is previewed', () => {
    const hard = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], TEST);
    const plain = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [HEAVY, LIGHT], TEST);
    const half = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [HEAVY, LIGHT], halved(RIFLE.id));
    expect(preview(hard, 'rightHand', 'enemy-0', TEST)).toEqual(preview(half, 'rightHand', 'enemy-0', halved(RIFLE.id)));
    // And that is less than the weapon does to a machine that is not hardened: about half, as the rounding leaves it.
    const full = preview(plain, 'rightHand', 'enemy-0', TEST).map((p) => p.damage);
    const got = preview(hard, 'rightHand', 'enemy-0', TEST).map((p) => p.damage);
    got.forEach((damage, i) => {
      expect(damage).toBeLessThan(full[i]);
      expect(Math.abs(damage - full[i] / 2)).toBeLessThanOrEqual(1);
    });
  });

  test('and as it lands: what the battle writes down of the shot is what was previewed', () => {
    const make = (catalog: Catalog, enemy: EnemyDef) => (seed: number): [BattleState, Catalog] => [battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [enemy, LIGHT], catalog, seed), catalog];
    const action: Action = { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'legs' };
    const { a, b } = fired(make(TEST, against(RIFLE.id)), make(halved(RIFLE.id), HEAVY), action);
    expect(a).toEqual(b);
    const hard = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], TEST);
    expect(a[0].damage).toBe(previewShot(hard, 'player', 'rightHand', 'enemy-0', 'legs', TEST).damage);
  });

  test('takes all of what another weapon of the same machine does', () => {
    const hard = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], TEST);
    const plain = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [HEAVY, LIGHT], TEST);
    expect(preview(hard, 'leftHand', 'enemy-0', TEST)).toEqual(preview(plain, 'leftHand', 'enemy-0', TEST));
  });

  test('and the machine beside it takes all of what that weapon does', () => {
    const hard = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], TEST);
    const plain = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [HEAVY, LIGHT], TEST);
    expect(preview(hard, 'rightHand', 'enemy-1', TEST)).toEqual(preview(plain, 'rightHand', 'enemy-1', TEST));
  });

  test('against several: each of them does half, and nothing else does', () => {
    const hard = battle({ rightHand: RIFLE.id, leftHand: OTHER.id, shoulder: PODS.id }, [against(RIFLE.id, PODS.id), LIGHT], TEST);
    const both: Catalog = { ...halved(RIFLE.id), [PODS.id]: halved(PODS.id)[PODS.id] };
    const half = battle({ rightHand: RIFLE.id, leftHand: OTHER.id, shoulder: PODS.id }, [HEAVY, LIGHT], both);
    for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) expect(preview(hard, slot, 'enemy-0', TEST), slot).toEqual(preview(half, slot, 'enemy-0', both));
  });

  test('a push is a push: the blow knocks it as far off balance as it knocks any machine', () => {
    const make = (enemy: EnemyDef) => (seed: number): [BattleState, Catalog] => [battle({ rightHand: RIFLE.id }, [enemy, LIGHT], TEST, seed), TEST];
    const action: Action = { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' };
    for (let seed = 1; seed <= 40; seed++) {
      const [hard] = make(against(RIFLE.id))(seed);
      const [plain] = make(HEAVY)(seed);
      const a = applyAction(hard, action, TEST);
      const b = applyAction(plain, action, TEST);
      if (!shots(a, hard.events.length)[0].hit || !shots(b, plain.events.length)[0].hit) continue;
      expect(unit(a, 'enemy-0').stagger).toBeGreaterThan(0);
      expect(unit(a, 'enemy-0').stagger).toBe(unit(b, 'enemy-0').stagger);
      return;
    }
    throw new Error('no seed on which the shot lands');
  });
});

describe('every kind of weapon does half to a machine hardened against it', () => {
  const twins = (weapons: Partial<Record<WeaponSlot, string>>, id: string, others: EnemyDef[] = [LIGHT]) => ({
    hard: (seed: number): [BattleState, Catalog] => [battle(weapons, [against(id), ...others], TEST, seed), TEST],
    half: (seed: number): [BattleState, Catalog] => [battle(weapons, [HEAVY, ...others], halved(id), seed), halved(id)],
  });

  test('a blade, once the machine has boosted', () => {
    const { hard, half } = twins({ rightHand: BLADE.id }, BLADE.id);
    const { a, b } = fired(hard, half, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, [{ type: 'boost' }]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  test('a charged shot', () => {
    const { hard, half } = twins({ rightHand: BOW.id }, BOW.id);
    const charged = ([s, catalog]: [BattleState, Catalog]): [BattleState, Catalog] => {
      let next = applyAction(s, { type: 'charge', weapon: 'rightHand' }, catalog);
      next = applyAction(next, END, catalog);
      for (let guard = 0; activeUnit(next).id !== 'player' && next.outcome === 'ongoing' && guard < 20; guard++) next = applyAction(next, END, catalog);
      return [next, catalog];
    };
    const { a, b } = fired((seed) => charged(hard(seed)), (seed) => charged(half(seed)), { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  test('a salvo: half to the one that is hardened, all of it to the one beside it', () => {
    const { hard, half } = twins({ shoulder: PODS.id }, PODS.id);
    const { a } = fired(hard, half, { type: 'fire', weapon: 'shoulder', target: 'enemy-0', part: 'core' });
    expect(a.map((shot) => shot.target).sort()).toEqual(['enemy-0', 'enemy-1']);
    const [s] = hard(1);
    const [plain] = [battle({ shoulder: PODS.id }, [HEAVY, LIGHT], TEST, 1)];
    expect(a.find((shot) => shot.target === 'enemy-0')!.damage).toBe(previewShot(s, 'player', 'shoulder', 'enemy-0', 'core', TEST).damage);
    expect(previewShot(s, 'player', 'shoulder', 'enemy-0', 'core', TEST).damage).toBeLessThan(previewShot(plain, 'player', 'shoulder', 'enemy-0', 'core', TEST).damage);
    expect(a.find((shot) => shot.target === 'enemy-1')!.damage).toBe(previewShot(plain, 'player', 'shoulder', 'enemy-1', 'core', TEST).damage);
  });

  test('a surge, with all the energy it takes behind it', () => {
    const { hard, half } = twins({ rightHand: SURGE.id }, SURGE.id);
    const { a, b } = fired(hard, half, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
    expect(a).toEqual(b);
  });

  test('a redline, with the heat of its machine behind it', () => {
    const { hard, half } = twins({ rightHand: REDLINE.id, leftHand: OTHER.id }, REDLINE.id);
    // Fired twice: the second with the heat of the first.
    const first: Action = { type: 'fire', weapon: 'leftHand', target: 'enemy-1', part: 'core' };
    const { a, b } = fired(hard, half, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, [first]);
    expect(a).toEqual(b);
  });

  test('a fork\'s bolt that leaps on to it from the machine beside it', () => {
    // The hardened machine stands second: the bolt is aimed at the first and leaps on.
    const hard = (seed: number): [BattleState, Catalog] => [battle({ rightHand: FORK.id }, [LIGHT, against(FORK.id)], TEST, seed), TEST];
    const plain = (seed: number): [BattleState, Catalog] => [battle({ rightHand: FORK.id }, [LIGHT, HEAVY], TEST, seed), TEST];
    const { a, b } = fired(hard, plain, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' });
    const leap = (list: typeof a) => list.find((shot) => shot.leapt)!;
    expect(leap(a).target).toBe('enemy-1');
    // What was aimed at the machine that is not hardened landed whole.
    expect(a.find((shot) => !shot.leapt)).toEqual(b.find((shot) => !shot.leapt));
    expect(leap(a).damage).toBeLessThan(leap(b).damage);
    expect(Math.abs(leap(a).damage - leap(b).damage / 2)).toBeLessThanOrEqual(1);
  });
});

describe('who is hardened', () => {
  test('a machine made from a definition that lists weapons, against those; any other machine, and the pilot\'s own, against nothing', () => {
    const s = createBattle({ ...DEMO_BUILD }, [against(RIFLE.id, OTHER.id), LIGHT], TEST, 1);
    expect(unit(s, 'enemy-0').hardened).toEqual([RIFLE.id, OTHER.id]);
    expect(unit(s, 'enemy-1').hardened).toBeUndefined();
    expect(unit(s, 'player').hardened).toBeUndefined();
    // The list is the unit's own: the definition is not written to.
    const def = against(RIFLE.id);
    const made = createBattle({ ...DEMO_BUILD }, [def, LIGHT], TEST, 1);
    unit(made, 'enemy-0').hardened!.push('wpn-t-other');
    expect(def.hardened).toEqual([RIFLE.id]);
  });

  test('a definition with an empty list makes a machine that is hardened against nothing', () => {
    const s = createBattle({ ...DEMO_BUILD }, [{ ...HEAVY, hardened: [] }, LIGHT], TEST, 1);
    expect(unit(s, 'enemy-0').hardened).toBeUndefined();
  });
});
