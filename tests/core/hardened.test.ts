import {
  HARDENED, activeUnit, applyAction, createBattle, hardenedAgainst, previewShot,
  type Action, type BattleEvent, type BattleState, type UnitState,
} from '../../src/core/battle';
import { FRAME_SLOTS, type Build, type Catalog, type EnemyDef, type Weapon, type WeaponSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

/**
 * A machine can be hardened against weapons, by their ids: each of those does half to it, where the
 * shot is previewed and where it lands, and all of what it does to anything else. A hardening may
 * wear: it takes what those weapons do to the machine until it has taken so much, and is gone.
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

describe('a hardening that wears', () => {
  /** The heavy machine hardened against the rifle, with a hardening of this share of its core's armour. */
  const wearing = (share: number): EnemyDef => ({ ...HEAVY, hardened: [RIFLE.id], hardening: share });
  const WILD = made('wpn-t-wild', { accuracy: -500 });
  const WEAR: Catalog = { ...TEST, [WILD.id]: WILD };
  const fire = (weapon: WeaponSlot, target: string, part: 'core' | 'legs' = 'legs'): Action => ({ type: 'fire', weapon, target, part });
  /** The battle after this action, on the first seed on which every shot of it lands (or, asked so, none does). */
  function after(make: (seed: number) => BattleState, action: Action, landing = true): { before: BattleState; next: BattleState } {
    for (let seed = 1; seed <= 60; seed++) {
      const before = make(seed);
      const next = applyAction(before, action, WEAR);
      const fired = shots(next, before.events.length);
      if (fired.length > 0 && fired.every((shot) => shot.hit === landing)) return { before, next };
    }
    throw new Error('no seed on which the shots do that');
  }

  test('is as much as that share of the armour its core stands in; one that is given no share does not wear, and nothing wears on a machine that is hardened against nothing', () => {
    const s = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [wearing(0.5), LIGHT], WEAR);
    const core = unit(s, 'enemy-0').parts.core!;
    expect(unit(s, 'enemy-0').hardening).toBe(Math.round(0.5 * core.maxAp));
    expect(unit(s, 'enemy-0').hardening).toBeGreaterThan(20);
    expect(unit(s, 'enemy-1').hardening).toBeUndefined();
    expect(unit(s, 'player').hardening).toBeUndefined();
    expect(unit(battle({ rightHand: RIFLE.id }, [against(RIFLE.id), LIGHT], WEAR), 'enemy-0').hardening).toBeUndefined();
    const none = battle({ rightHand: RIFLE.id }, [{ ...HEAVY, hardening: 0.5 }, LIGHT], WEAR);
    expect(unit(none, 'enemy-0').hardened).toBeUndefined();
    expect(unit(none, 'enemy-0').hardening).toBeUndefined();
    // A thicker machine has more of it: the share is of the armour it stands in, plating and all.
    const plated = battle({ rightHand: RIFLE.id }, [{ ...wearing(0.5), plating: 0.5 }, LIGHT], WEAR);
    expect(unit(plated, 'enemy-0').hardening).toBe(Math.round(0.5 * unit(plated, 'enemy-0').parts.core!.maxAp));
    expect(unit(plated, 'enemy-0').hardening).toBeGreaterThan(unit(s, 'enemy-0').hardening!);
    // And the smallest there is is one point: a hardening is never made already gone.
    expect(unit(battle({ rightHand: RIFLE.id }, [wearing(0.0001), LIGHT], WEAR), 'enemy-0').hardening).toBe(1);
  });

  test('a hit of the weapon it is hardened against takes off it what the hit did, and the hit is still halved', () => {
    const make = (seed: number): BattleState => battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [wearing(0.9), LIGHT], WEAR, seed);
    const { before, next } = after(make, fire('rightHand', 'enemy-0'));
    const [shot] = shots(next, before.events.length);
    expect(shot.damage).toBe(previewShot(before, 'player', 'rightHand', 'enemy-0', 'legs', WEAR).damage);
    expect(shot.damage).toBeGreaterThan(5);
    expect(unit(next, 'enemy-0').hardening).toBe(unit(before, 'enemy-0').hardening! - shot.damage);
    expect(unit(next, 'enemy-0').hardened).toEqual([RIFLE.id]);
    expect(next.events.some((event) => event.type === 'hardeningGone')).toBe(false);
  });

  test('a miss takes nothing off it; nor does another weapon, or that weapon landing on the machine beside it', () => {
    const make = (weapons: Partial<Record<WeaponSlot, string>>) => (seed: number): BattleState => battle(weapons, [{ ...wearing(0.9), hardened: [RIFLE.id, WILD.id] }, LIGHT], WEAR, seed);
    const whole = unit(make({ rightHand: RIFLE.id })(1), 'enemy-0').hardening;
    const missed = after(make({ rightHand: WILD.id }), fire('rightHand', 'enemy-0'), false);
    expect(unit(missed.next, 'enemy-0').hardening).toBe(whole);
    const other = after(make({ rightHand: RIFLE.id, leftHand: OTHER.id }), fire('leftHand', 'enemy-0'));
    expect(unit(other.next, 'enemy-0').hardening).toBe(whole);
    const beside = after(make({ rightHand: RIFLE.id }), fire('rightHand', 'enemy-1'));
    expect(unit(beside.next, 'enemy-0').hardening).toBe(whole);
    expect(shots(beside.next, beside.before.events.length)[0].damage).toBeGreaterThan(0);
  });

  test('worn to nothing it is gone, and is said to be, once: the shot that wore it out was halved, and the next does all the weapon does', () => {
    // Small enough for one hit to wear out.
    const make = (seed: number): BattleState => battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [wearing(0.02), LIGHT], WEAR, seed);
    const { before, next } = after(make, fire('rightHand', 'enemy-0'));
    const [shot] = shots(next, before.events.length);
    expect(unit(before, 'enemy-0').hardening).toBeLessThanOrEqual(shot.damage);
    expect(shot.damage).toBe(previewShot(before, 'player', 'rightHand', 'enemy-0', 'legs', WEAR).damage);
    expect(unit(next, 'enemy-0').hardened).toBeUndefined();
    expect(unit(next, 'enemy-0').hardening).toBeUndefined();
    expect(hardenedAgainst(unit(next, 'enemy-0'), RIFLE)).toBe(false);
    expect(next.events.filter((event) => event.type === 'hardeningGone')).toEqual([{ type: 'hardeningGone', unit: 'enemy-0' }]);
    // What the rifle does to it now is what it does to the same machine never hardened, part for part it has not been hit on.
    const plain = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [HEAVY, LIGHT], WEAR);
    for (const part of ['core', 'arms', 'head'] as const) {
      expect(previewShot(next, 'player', 'leftHand', 'enemy-0', part, WEAR).damage, part).toBe(previewShot(plain, 'player', 'leftHand', 'enemy-0', part, WEAR).damage);
    }
    const rifleNow = (state: BattleState): number => {
      // (The rifle has been fired this turn: it is asked of the pilot's next.)
      let later = applyAction(state, END, WEAR);
      for (let guard = 0; activeUnit(later).id !== 'player' && later.outcome === 'ongoing' && guard < 20; guard++) later = applyAction(later, END, WEAR);
      return previewShot(later, 'player', 'rightHand', 'enemy-0', 'core', WEAR).damage;
    };
    expect(rifleNow(next)).toBe(rifleNow(plain));
    expect(rifleNow(next)).toBeGreaterThan(rifleNow(make(1)));
    // And it is not said again.
    let later = applyAction(next, END, WEAR);
    for (let guard = 0; activeUnit(later).id !== 'player' && later.outcome === 'ongoing' && guard < 20; guard++) later = applyAction(later, END, WEAR);
    later = applyAction(later, fire('rightHand', 'enemy-0', 'core'), WEAR);
    expect(later.events.filter((event) => event.type === 'hardeningGone')).toHaveLength(1);
  });

  test('with exactly nothing left it is gone: it does not hold for one hit more', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = structuredClone(battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [wearing(0.9), LIGHT], WEAR, seed));
      // As much left as the next hit is worth, to the point.
      unit(s, 'enemy-0').hardening = previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', WEAR).damage;
      const next = applyAction(s, fire('rightHand', 'enemy-0'), WEAR);
      if (!shots(next, s.events.length)[0].hit) continue;
      expect(unit(next, 'enemy-0').hardened).toBeUndefined();
      expect(unit(next, 'enemy-0').hardening).toBeUndefined();
      expect(next.events.filter((event) => event.type === 'hardeningGone')).toHaveLength(1);
      return;
    }
    throw new Error('no seed on which the shot lands');
  });

  test('what a barrier took of the hit was kept off the machine by the hardening all the same: it wears by all the hit was worth', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = structuredClone(battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [wearing(0.9), LIGHT], WEAR, seed));
      unit(s, 'enemy-0').barrier = 7;
      const before = unit(s, 'enemy-0').hardening!;
      const worth = previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', WEAR).damage;
      const next = applyAction(s, fire('rightHand', 'enemy-0'), WEAR);
      const [shot] = next.events.slice(s.events.length).flatMap((e: BattleEvent) => (e.type === 'shot' && e.unit === 'player' ? [e] : []));
      if (!shot.hit) continue;
      expect(shot.absorbed).toBe(7);
      expect(shot.damage).toBe(worth - 7);
      expect(unit(next, 'enemy-0').hardening).toBe(before - worth);
      return;
    }
    throw new Error('no seed on which the shot lands');
  });

  test('one that is given no share holds for the whole battle: hit after hit is halved, and it is never said to be gone', () => {
    let s = battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [against(RIFLE.id), LIGHT], WEAR, 3);
    const halved = previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', WEAR).damage;
    let landed = 0;
    for (let turn = 0; turn < 12 && s.outcome === 'ongoing' && landed < 4; turn++) {
      const at = s.events.length;
      s = applyAction(s, fire('rightHand', 'enemy-0', 'core'), WEAR);
      const [shot] = shots(s, at);
      if (shot.hit) {
        landed += 1;
        expect(shot.damage, `hit ${landed}`).toBe(halved);
      }
      expect(unit(s, 'enemy-0').hardened).toEqual([RIFLE.id]);
      expect(unit(s, 'enemy-0').hardening).toBeUndefined();
      s = applyAction(s, END, WEAR);
      for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, WEAR);
    }
    expect(landed).toBeGreaterThanOrEqual(3);
    expect(s.events.some((event) => event.type === 'hardeningGone')).toBe(false);
  });

  test('against two weapons it is one hardening: either wears it, and when it goes it goes for both', () => {
    const both = (seed: number): BattleState => battle({ rightHand: RIFLE.id, leftHand: OTHER.id }, [{ ...wearing(0.02), hardened: [RIFLE.id, OTHER.id] }, LIGHT], WEAR, seed);
    const { next } = after(both, fire('leftHand', 'enemy-0'));
    expect(unit(next, 'enemy-0').hardened).toBeUndefined();
    expect(hardenedAgainst(unit(next, 'enemy-0'), RIFLE)).toBe(false);
  });

  test('a machine brought down by the shot that would have worn it out is not said to have lost its hardening', () => {
    const glass: EnemyDef = { ...wearing(0.02), plating: -0.99 };
    const make = (seed: number): BattleState => battle({ rightHand: RIFLE.id }, [glass, LIGHT], WEAR, seed);
    const { next } = after(make, fire('rightHand', 'enemy-0', 'core'));
    expect(unit(next, 'enemy-0').destroyed).toBe(true);
    expect(next.events.some((event) => event.type === 'hardeningGone')).toBe(false);
  });

  test('a fork\'s bolt that leaps on to it wears it as a shot aimed at it does', () => {
    const make = (seed: number): BattleState => battle({ rightHand: FORK.id }, [LIGHT, { ...HEAVY, hardened: [FORK.id], hardening: 0.9 }], WEAR, seed);
    const { before, next } = after(make, fire('rightHand', 'enemy-0', 'core'));
    const leapt = shots(next, before.events.length).find((shot) => shot.leapt)!;
    expect(leapt.target).toBe('enemy-1');
    expect(unit(next, 'enemy-1').hardening).toBe(unit(before, 'enemy-1').hardening! - leapt.damage);
  });
});

describe('what a shot took off', () => {
  const took = (s: BattleState, from: number) => s.events.slice(from).flatMap((e: BattleEvent) => (e.type === 'shot' && e.unit === 'player' ? [{ damage: e.damage, took: e.took }] : []));

  test('a shot worth more than the armour left where it lands says how much it took off; one that is not says nothing more', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = battle({ rightHand: RIFLE.id }, [HEAVY, LIGHT], TEST, seed);
      const legs = unit(s, 'enemy-0').parts.legs!;
      const worth = previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', TEST).damage;
      expect(legs.ap).toBeGreaterThan(worth);
      const first = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'legs' }, TEST);
      const [plain] = took(first, s.events.length);
      if (plain.damage === 0) continue;
      expect(plain).toEqual({ damage: worth, took: undefined });
      // The same shot at legs with three points left on them.
      const thin = structuredClone(s);
      unit(thin, 'enemy-0').parts.legs!.ap = 3;
      const second = applyAction(thin, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'legs' }, TEST);
      expect(took(second, thin.events.length)).toEqual([{ damage: worth, took: 3 }]);
      expect(unit(second, 'enemy-0').parts.legs!.ap).toBe(0);
      return;
    }
    throw new Error('no seed on which the shot lands');
  });

  test('it is the armour that came off: the core of a machine a contract wants driven off keeps a point, and the hit took one less', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const build: Build = { ...DEMO_BUILD };
      delete build.leftHand; delete build.shoulder;
      let s = createBattle({ ...build, rightHand: RIFLE.id }, [HEAVY, LIGHT], TEST, seed, { objective: { type: 'driveOff', target: 0, share: 0.01 } });
      for (let guard = 0; activeUnit(s).id !== 'player' && s.outcome === 'ongoing' && guard < 20; guard++) s = applyAction(s, END, TEST);
      s = structuredClone(s);
      unit(s, 'enemy-0').parts.core!.ap = 3;
      const worth = previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', TEST).damage;
      const next = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, TEST);
      const [shot] = took(next, s.events.length);
      if (shot.damage === 0) continue;
      expect(worth).toBeGreaterThan(3);
      expect(unit(next, 'enemy-0').parts.core!.ap).toBe(1);
      expect(shot.took).toBe(2);
      return;
    }
    throw new Error('no seed on which the shot lands');
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
