import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { createBattle } from '../../src/core/battle';
import { validatePlayerBuild } from '../../src/core/build';
import {
  BOONS, BOON_IDS, GAUNTLET_PATCH, WARDENS, descend, draft, draftSize, floorBudget, floorMission, floorScale, floorsCleared, isGauntlet, isValidRun,
  isWardenFloor, payout, relicOffers, runMods, startRun, take, takeRelic, wear, type Offer, type Run,
} from '../../src/core/gauntlet';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';

const names = Object.fromEntries(Object.values(ALL_ENEMIES).map((e) => [e.id, e.name]));
const fresh = (seed = 5): Run => startRun(seed, STARTER_BUILD);
const mission = (run: Run) => floorMission(run, GAUNTLET_TEXT, names);
const fight = (run: Run) => {
  const m = mission(run);
  return runBattle(startMissionBattle(run.build, m, 0, ALL_ENEMIES, CATALOG, run.seed + run.floor, undefined,
    { enemyScale: m.scale, mods: runMods(run), carry: run.carry ?? undefined }), CATALOG, chooseAutoPlayerAction);
};
/** A plain way of choosing: a service when one is on offer, else the dearest part, else whatever is first. */
const choose = (offers: Offer[]): Offer => offers.find((o) => o.kind === 'service')
  ?? offers.filter((o): o is Extract<Offer, { kind: 'part' }> => o.kind === 'part').sort((a, b) => CATALOG[b.part].price - CATALOG[a.part].price)[0] ?? offers[0];
function play(seed: number, limit = 40): Run {
  let run = fresh(seed);
  while (run.floor <= limit) {
    const end = fight(run);
    if (end.outcome !== 'victory') break;
    run = descend(run, end);
    // What a warden left is taken first: the first of the two.
    if (run.relicOwed) run = takeRelic(run, relicOffers(run)[0]);
    run = take(run, choose(draft(run, CATALOG)), CATALOG);
  }
  return run;
}

describe('a run of the Gauntlet', () => {
  test('starts on the first floor in the stock frame, whole, with nothing taken', () => {
    expect(fresh()).toEqual({ seed: 5, floor: 1, build: STARTER_BUILD, carry: null, boons: {}, drafting: false, fighting: false, bestBefore: 0 });
    expect(wear(fresh(), CATALOG)).toBe(0);
    expect(runMods(fresh())).toEqual({});
  });

  test('every floor is a single battle in a real place against real machines, harder than the one before', () => {
    let run = fresh();
    for (let floor = 1; floor <= 40; floor++) {
      run = { ...run, floor };
      const m = mission(run);
      expect(isGauntlet(m)).toBe(true);
      expect(m.id).toBe(`gauntlet-${floor}`);
      expect(m.battles).toHaveLength(1);
      expect(m.battles[0].background in SPRITES).toBe(true);
      expect(m.battles[0].enemies.length).toBeGreaterThan(0);
      for (const id of m.battles[0].enemies) expect(ALL_ENEMIES[id], id).toBeDefined();
      expect(m.loaner).toEqual(run.build);
      expect(m.reward).toBe(0);
      // It can be set up as a battle: the objective and the enemies agree.
      expect(() => createBattle(run.build, m.battles[0].enemies.map((id) => ALL_ENEMIES[id]), CATALOG, 1)).not.toThrow();
      if (floor > 1) {
        expect(floorBudget(floor)).toBeGreaterThanOrEqual(floorBudget(floor - 1));
        expect(floorScale(floor)).toBeGreaterThan(floorScale(floor - 1));
      }
    }
  });

  test('every fifth floor has a warden, each in turn, and they come round again harder', () => {
    const at = (floor: number) => mission({ ...fresh(), floor });
    expect([5, 10, 15, 20].map((f) => at(f).battles[0].enemies)).toEqual([['scrap-king'], ['night-train'], ['rival'], ['sable']]);
    expect(at(5).briefing.join(' ')).toContain('Scrap King');
    expect(isWardenFloor(4)).toBe(false);
    const again = 5 * (WARDENS.length + 1);
    expect(at(again).battles[0].enemies).toEqual(['scrap-king']);
    expect(at(again).scale!).toBeGreaterThan(at(5).scale!);
    // The open floors never field a warden or anything else that belongs to the story.
    for (let floor = 1; floor <= 60; floor++) {
      if (isWardenFloor(floor)) continue;
      expect(at(floor).battles[0].enemies.filter((id) => WARDENS.includes(id))).toEqual([]);
    }
  });

  test('the same seed is the same run; another seed is another', () => {
    const floors = (seed: number) => [1, 2, 3, 4, 6, 7].map((floor) => mission({ ...fresh(seed), floor }).battles[0].enemies.join('+'));
    expect(floors(9)).toEqual(floors(9));
    expect(floors(9)).not.toEqual(floors(10));
    expect(play(11)).toEqual(play(11));
  });
});

describe('after a floor', () => {
  const won = (): Run => { const run = fresh(); return descend(run, fight(run)); };

  test('the run is one floor deeper, cooled, patched by a share of what was missing, and owed a draft', () => {
    const run = fresh();
    const end = fight(run);
    expect(end.outcome).toBe('victory');
    const next = descend(run, end);
    expect(next).toMatchObject({ floor: 2, drafting: true });
    expect(next.carry!.heat).toBe(0);
    for (const [slot, part] of Object.entries(end.units[0].parts)) {
      const ap = next.carry!.ap[slot as 'core'];
      expect(ap).toBe(Math.min(part!.maxAp, part!.ap + Math.round((part!.maxAp - part!.ap) * GAUNTLET_PATCH)));
    }
    expect(() => descend(run, { ...end, outcome: 'defeat' })).toThrow();
  });

  test('three different things are on offer, the same three every time they are looked at', () => {
    const run = won();
    const offers = draft(run, CATALOG);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(3);
    expect(draft(run, CATALOG)).toEqual(offers);
    for (const offer of offers) {
      if (offer.kind !== 'part') continue;
      expect(CATALOG[offer.part].vendor).toBeDefined();
      expect(validatePlayerBuild({ ...run.build, [offer.slot]: offer.part }, CATALOG)).toEqual([]);
      expect(Object.values(run.build)).not.toContain(offer.part);
    }
    const parts = offers.filter((o) => o.kind === 'part') as Extract<Offer, { kind: 'part' }>[];
    expect(new Set(parts.map((p) => p.slot)).size).toBe(parts.length);
  });

  test('a worn mech is offered a full service, and taking it makes the mech whole', () => {
    const run = { ...won() };
    run.carry = { ...run.carry!, ap: { core: 10, legs: 10, arms: 10, head: 10 } };
    expect(wear(run, CATALOG)).toBeGreaterThan(0.25);
    const offers = draft(run, CATALOG);
    expect(offers).toContainEqual({ kind: 'service' });
    const served = take(run, { kind: 'service' }, CATALOG);
    expect(served).toMatchObject({ carry: null, drafting: false });
    expect(wear(served, CATALOG)).toBe(0);
    // A whole mech is not offered one.
    expect(draft({ ...run, carry: null }, CATALOG)).not.toContainEqual({ kind: 'service' });
  });

  test('a part is fitted at once and is whole; a boon adds up over the run', () => {
    const run = won();
    const part = draft(run, CATALOG).find((o) => o.kind === 'part') as Extract<Offer, { kind: 'part' }>;
    const fitted = take(run, part, CATALOG);
    expect(fitted.build[part.slot]).toBe(part.part);
    expect(fitted.drafting).toBe(false);
    if (['head', 'core', 'arms', 'legs'].includes(part.slot)) expect(fitted.carry!.ap[part.slot as 'core']).toBeUndefined();
    const boon = (r: Run, id: 'capacitor') => ({ ...r, boons: { ...r.boons, [id]: (r.boons[id] ?? 0) + 1 } });
    expect(runMods(boon(boon(fresh(), 'capacitor'), 'capacitor'))).toEqual({ energy: 30 });
    expect(Object.keys(BOONS)).toEqual(BOON_IDS);
    for (const id of BOON_IDS) expect(STRINGS.gauntlet.boons[id].name.length).toBeGreaterThan(0);
  });

  test('only what is on offer can be taken, and only once', () => {
    const run = won();
    expect(() => take(run, { kind: 'part', slot: 'core', part: 'core-colossus' }, CATALOG)).toThrow('not on offer');
    const taken = take(run, draft(run, CATALOG)[0], CATALOG);
    expect(() => take(taken, draft(run, CATALOG)[1], CATALOG)).toThrow('nothing is on offer');
  });

  test('beating a warden earns a service on the house', () => {
    const run: Run = { ...fresh(), floor: 5 };
    const end = fight({ ...run, boons: { plating: 20, capacitor: 20, optics: 20 } });
    expect(end.outcome).toBe('victory');
    expect(descend(run, end)).toMatchObject({ floor: 6, carry: null, drafting: true, relicOwed: true });
  });
});

describe('what the review of the Gauntlet found', () => {
  const start = (run: Run) => {
    const m = mission(run);
    return startMissionBattle(run.build, m, 0, ALL_ENEMIES, CATALOG, 1, undefined, { enemyScale: m.scale, mods: runMods(run), carry: run.carry ?? undefined });
  };

  test('field repairs are restocked on every floor, and a patch kit adds one from the next floor on', () => {
    const run = fresh();
    const end = fight(run);
    end.units[0].repairsLeft = 0;
    const next = descend(run, end);
    expect(next.carry!.repairsLeft).toBeUndefined();
    const plain = start({ ...next, drafting: false }).units[0].repairsLeft;
    expect(plain).toBeGreaterThan(0);
    expect(start({ ...next, drafting: false, boons: { patchkit: 2 } }).units[0].repairsLeft).toBe(plain + 2);
  });

  test('parts are still on offer deep into a run', () => {
    for (const floor of [15, 16, 25, 40, 80]) {
      const run: Run = { ...fresh(), floor, drafting: true };
      expect(draft(run, CATALOG).filter((o) => o.kind === 'part').length, `floor ${floor}`).toBeGreaterThanOrEqual(1);
    }
  });

  test('a weapon for the hand goes to the empty hand, and with both full to the hand holding the cheaper thing', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const run: Run = { ...fresh(seed), floor: 2 + (seed % 10), drafting: true };
      for (const offer of draft(run, CATALOG)) {
        if (offer.kind !== 'part' || CATALOG[offer.part].kind !== 'weapon' || (CATALOG[offer.part] as { mount: string }).mount !== 'hand') continue;
        seen.add(offer.slot);
        expect(offer.slot).toBe('leftHand');
      }
    }
    expect([...seen]).toEqual(['leftHand']);
    const both: Run = { ...fresh(), build: { ...STARTER_BUILD, leftHand: 'wpn-void-rifle' }, floor: 4, drafting: true };
    const hands = Array.from({ length: 200 }, (_, i) => draft({ ...both, seed: i }, CATALOG)).flat()
      .filter((o): o is Extract<Offer, { kind: 'part' }> => o.kind === 'part' && (o.slot === 'leftHand' || o.slot === 'rightHand') && CATALOG[o.part].kind === 'weapon');
    expect(hands.length).toBeGreaterThan(0);
    for (const offer of hands) expect(offer.slot).toBe('rightHand');
  });

  test('wear is measured against plated armour, so a plated mech that is worn is offered a service', () => {
    const base: Run = { ...fresh(), floor: 3, drafting: true, boons: { plating: 5 } };
    const plated = (ap: number) => Math.round(ap * 1.4);
    const parts = (['core', 'legs', 'arms', 'head'] as const).map((slot) => [slot, (CATALOG[STARTER_BUILD[slot]!] as { ap: number }).ap] as const);
    const worn: Run = { ...base, carry: { ap: Object.fromEntries(parts.map(([slot, ap]) => [slot, Math.round(plated(ap) * 0.6)])), heat: 0, ammo: {}, restocked: {}, destroyed: false } };
    expect(wear(worn, CATALOG)).toBeCloseTo(0.4, 1);
    expect(draft(worn, CATALOG)).toContainEqual({ kind: 'service' });
    const whole: Run = { ...base, carry: { ...worn.carry!, ap: Object.fromEntries(parts.map(([slot, ap]) => [slot, plated(ap)])) } };
    expect(wear(whole, CATALOG)).toBe(0);
  });

  test('a run stays sound to floor sixty whatever is taken: different things on offer, as many as are due, a build that can deploy, a run the save accepts', () => {
    const policies: ((offers: Offer[], i: number) => Offer)[] = [
      (o) => o[0], (o) => o[2], (o, i) => o[i % 3], (o) => o.find((x) => x.kind === 'boon') ?? o[0], (o) => o.find((x) => x.kind === 'part') ?? o[1],
    ];
    for (const [p, policy] of policies.entries()) {
      let run: Run = { ...fresh(100 + p) };
      for (let floor = 1; floor < 60; floor++) {
        // The first floors are fought, with a cheated frame, so that what is carried is real; the rest are walked: what is checked is the run itself.
        const end = floor < 8 ? fight({ ...run, boons: { plating: 60, capacitor: 20, optics: 30, heatsinks: 10 } }) : null;
        if (end?.outcome === 'victory') run = descend(run, end);
        else run = { ...run, floor: run.floor + 1, drafting: true };
        if (run.relicOwed) run = takeRelic(run, relicOffers(run)[p % 2]);
        const offers = draft(run, CATALOG);
        expect(offers).toHaveLength(draftSize(run));
        expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(offers.length);
        run = take(run, policy(offers, floor), CATALOG);
        expect(validatePlayerBuild(run.build, CATALOG)).toEqual([]);
        expect(isValidRun(JSON.parse(JSON.stringify(run)), CATALOG), `policy ${p} floor ${floor}`).toBe(true);
      }
    }
  });

  test('a save cannot hand in a run with no core, an absurd floor or a mountain of boons', () => {
    const run = play(3, 3);
    expect(isValidRun({ ...run, floor: 1000 }, CATALOG)).toBe(false);
    expect(isValidRun({ ...run, boons: { plating: 100 } }, CATALOG)).toBe(false);
    expect(isValidRun({ ...run, carry: { ...run.carry, ap: { ...run.carry!.ap, core: 0 } } }, CATALOG)).toBe(false);
    expect(isValidRun({ ...run, fighting: 'yes' }, CATALOG)).toBe(false);
    expect(isValidRun({ ...run, fighting: true, bestBefore: 4 }, CATALOG)).toBe(true);
  });
});

describe('what a run pays and how far it gets', () => {
  test('more for every floor cleared, and more the deeper the floor', () => {
    expect([0, 1, 2, 5, 10].map(payout)).toEqual([0, 140, 320, 1100, 3200]);
    expect(floorsCleared({ ...fresh(), floor: 7 })).toBe(6);
  });

  test('a pilot who only presses Auto Turn gets a few floors down, and nobody gets down for ever', () => {
    const depths = Array.from({ length: 12 }, (_, i) => floorsCleared(play((i + 1) * 977))).sort((a, b) => a - b);
    expect(depths[0]).toBeGreaterThanOrEqual(1);
    expect(depths[6]).toBeGreaterThanOrEqual(4);
    expect(depths[11]).toBeLessThan(30);
  });

  test('how far that is, pinned: a little further than before a kill readied the weapon, and no more than that', () => {
    // More than half the floors of a run are fights against ordinary machines, where a kill readies the weapon and a
    // heavy hit goes through a light machine. Over these forty runs, with no second life, the run before those rules
    // cleared 7.35 floors on average and eleven reached the tenth; with them it clears 7.9 and fourteen do. (A player
    // who takes the second life gets about a floor further than before: 9.6 for 8.6.) The floors with a warden or an
    // elite on them are the fights they were.
    const depths = Array.from({ length: 40 }, (_, i) => floorsCleared(play((i + 1) * 7919 + 1, 60)));
    const mean = depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
    expect(mean).toBeGreaterThan(7.4);
    expect(mean).toBeLessThan(8.5);
    // The deep floors stay rare: ten is reached by fewer than half, twenty by nobody here.
    const tenth = depths.filter((depth) => depth >= 10).length;
    expect(tenth).toBeGreaterThanOrEqual(11);
    expect(tenth).toBeLessThanOrEqual(17);
    expect(depths.filter((depth) => depth >= 20).length).toBe(0);
  });
});

describe('a run kept in a save', () => {
  test('is flown on if it is sound and refused if anything about it is not', () => {
    const run = play(3, 3);
    expect(isValidRun(run, CATALOG)).toBe(true);
    expect(isValidRun(JSON.parse(JSON.stringify(run)), CATALOG)).toBe(true);
    expect(isValidRun(fresh(), CATALOG)).toBe(true);
    const bad: unknown[] = [
      null, 5, { ...run, floor: 0 }, { ...run, floor: 1.5 }, { ...run, seed: 'x' }, { ...run, drafting: 1 },
      { ...run, build: { ...run.build, core: 'core-adjuster' } }, { ...run, build: { ...run.build, core: undefined } },
      { ...run, boons: { nonsense: 1 } }, { ...run, boons: { plating: -1 } },
      { ...run, carry: { ...run.carry, destroyed: true } }, { ...run, carry: { ...run.carry, ap: { core: -4 } } }, { ...run, carry: 7 },
    ];
    for (const value of bad) expect(isValidRun(value, CATALOG), JSON.stringify(value)?.slice(0, 80)).toBe(false);
  });
});
