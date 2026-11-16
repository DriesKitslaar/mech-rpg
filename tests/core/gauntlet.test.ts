import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { createBattle } from '../../src/core/battle';
import { validatePlayerBuild } from '../../src/core/build';
import {
  BOONS, BOON_IDS, GAUNTLET_PATCH, WARDENS, descend, draft, floorBudget, floorMission, floorScale, floorsCleared, isGauntlet, isValidRun,
  isWardenFloor, payout, runMods, startRun, take, wear, type Offer, type Run,
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
    run = take(run, choose(draft(run, CATALOG)), CATALOG);
  }
  return run;
}

describe('a run of the Gauntlet', () => {
  test('starts on the first floor in the stock frame, whole, with nothing taken', () => {
    expect(fresh()).toEqual({ seed: 5, floor: 1, build: STARTER_BUILD, carry: null, boons: {}, drafting: false });
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
    expect([5, 10, 15, 20].map((f) => at(f).battles[0].enemies)).toEqual([['rival'], ['scrap-king'], ['sable'], ['night-train']]);
    expect(at(5).briefing.join(' ')).toContain('Ashfall');
    expect(isWardenFloor(4)).toBe(false);
    const again = 5 * (WARDENS.length + 1);
    expect(at(again).battles[0].enemies).toEqual(['rival']);
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
    expect(descend(run, end)).toMatchObject({ floor: 6, carry: null, drafting: true });
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
