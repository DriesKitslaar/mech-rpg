import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { createBattle, evasion, guardFactor } from '../../src/core/battle';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { STARTING_CREDITS } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import type { Build, FramePart, Part } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import { STARTERS, starterOf } from '../../src/content/starters';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * The three frames a new pilot chooses between: what each is made of, that each can be flown as it
 * comes, and that each gets through the first act with what the introductions pay for.
 */

const SEEDS = 80;
/** These tests fight some thousands of battles between them: each is given the time for its share. */
const LONG = 90_000;
const rates = new Map<string, number>();
/** How often the game's own automatic pilot wins a contract in a build: 80 battles, two families of seeds. */
function rate(build: Build, missionId: string): number {
  const key = `${JSON.stringify(build)}|${missionId}`;
  if (!rates.has(key)) {
    const mission = MISSIONS.find((m) => m.id === missionId)!;
    let wins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
      const end = playMission(build, mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') wins += 1;
    }
    rates.set(key, wins / SEEDS);
  }
  return rates.get(key)!;
}
const [hauler, courier, dozer] = STARTERS;
const frame = (build: Build): FramePart[] => (['head', 'core', 'arms', 'legs'] as const).map((slot) => CATALOG[build[slot]!] as FramePart);
const armour = (build: Build): number => frame(build).reduce((sum, part) => sum + part.ap, 0);
const worth = (ids: (string | undefined)[]): number => ids.reduce((sum, id) => sum + (id ? CATALOG[id].price : 0), 0);
const FIRST = ['hadron-1', 'lumen-1', 'undertow-1'];

describe('the three frames on the lot', () => {
  test('are the Hauler every pilot used to start in, a Courier and a Dozer, in that order', () => {
    expect(STARTERS.map((s) => s.id)).toEqual(['hauler', 'courier', 'dozer']);
    expect(hauler.build).toEqual(STARTER_BUILD);
    expect(hauler.credits).toBe(STARTING_CREDITS);
    expect(starterOf('dozer')).toBe(dozer);
    // A name there is no starter of is the first of them: a pilot is never left without a frame.
    expect(starterOf('nothing')).toBe(hauler);
    expect(starterOf(undefined)).toBe(hauler);
  });

  test.each(STARTERS.map((s) => [s.id, s] as const))('%s may deploy as it comes: nothing missing, not overweight, not short of energy', (_id, starter) => {
    expect(validatePlayerBuild(starter.build, CATALOG)).toEqual([]);
    const stats = computeBuildStats(starter.build, CATALOG);
    expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
    // It has a hand free or a shoulder free: there is room for what the first contracts pay for.
    expect(!starter.build.leftHand || !starter.build.shoulder).toBe(true);
  });

  test('each is a full set of its own four parts, on the stock generator, thrusters and fire control', () => {
    for (const starter of [courier, dozer]) {
      for (const slot of ['head', 'core', 'arms', 'legs'] as const) expect(starter.build[slot]).toBe(`${slot}-${starter.id}`);
    }
    for (const starter of STARTERS) expect(starter.build).toMatchObject({ generator: 'gen-kd1', booster: 'bst-stock', fcs: 'fcs-stock' });
  });

  test('what a frame comes with and the credits beside it are worth the same for each', () => {
    for (const starter of STARTERS) {
      const guns = worth([starter.build.rightHand, starter.build.leftHand, starter.build.shoulder]);
      expect(guns + starter.credits, starter.id).toBe(1500);
    }
    // And the frames themselves cost the same: four parts of salvage at 300 each.
    for (const starter of STARTERS) expect(worth(frame(starter.build).map((part) => part.id)), starter.id).toBe(1200);
  });

  test('every part of the two that are not taken is in the shop from the first visit', () => {
    const salvage = [...frame(courier.build), ...frame(dozer.build), CATALOG['shd-plate']];
    for (const part of salvage) {
      expect(SHOP_PARTS.some((sold: Part) => sold.id === part.id), part.id).toBe(true);
      expect(Object.hasOwn(SHOP_UNLOCKS, part.id), part.id).toBe(false);
      expect(part.price).toBe(300);
    }
  });

  test('the salvage is what was measured, to the figure: armour, what it shrugs off, weight, drain and what its legs and its eyes add', () => {
    // What the rates below were measured with. A part that is changed is measured again, and then this table with it.
    const measured: Record<string, object> = {
      'head-courier': { name: 'Courier Visor', kind: 'head', ap: 40, resist: { kinetic: 0.05, energy: 0.12, explosive: 0.05 }, weight: 30, drain: 20, aim: 10 },
      'core-courier': { name: 'Courier Core', kind: 'core', ap: 155, resist: { kinetic: 0.1, energy: 0.12, explosive: 0.1 }, weight: 190, drain: 55 },
      'arms-courier': { name: 'Courier Arms', kind: 'arms', ap: 75, resist: { kinetic: 0.05, energy: 0.12, explosive: 0.05 }, weight: 90, drain: 35, aim: 6 },
      'legs-courier': { name: 'Courier Legs', kind: 'legs', ap: 105, resist: { kinetic: 0.05, energy: 0.12, explosive: 0.05 }, weight: 150, drain: 50, capacity: 800, mobility: 40 },
      'head-dozer': { name: 'Dozer Cab', kind: 'head', ap: 75, resist: { kinetic: 0.2, energy: 0.12, explosive: 0.15 }, weight: 60, drain: 15, aim: 8 },
      'core-dozer': { name: 'Dozer Core', kind: 'core', ap: 275, resist: { kinetic: 0.25, energy: 0.12, explosive: 0.15 }, weight: 380, drain: 60 },
      'arms-dozer': { name: 'Dozer Arms', kind: 'arms', ap: 135, resist: { kinetic: 0.2, energy: 0.12, explosive: 0.15 }, weight: 180, drain: 40, aim: 5 },
      'legs-dozer': { name: 'Dozer Legs', kind: 'legs', ap: 195, resist: { kinetic: 0.2, energy: 0.12, explosive: 0.15 }, weight: 300, drain: 50, capacity: 1400, mobility: 18 },
      'shd-plate': { name: 'Scrap Plate', kind: 'shield', guard: 0.5, weight: 80 },
    };
    for (const [id, figures] of Object.entries(measured)) {
      const vendor = id.endsWith('-courier') ? 'lumen' : 'hadron';
      expect(CATALOG[id], id).toEqual({ id, ...figures, price: 300, vendor });
    }
    // And those nine are all the salvage there is to start in, beside the frame every pilot used to start in.
    const salvage = SHOP_PARTS.filter((part: Part) => /-(courier|dozer)$/.test(part.id) || part.id === 'shd-plate').map((part: Part) => part.id);
    expect(salvage.sort()).toEqual(Object.keys(measured).sort());
  });

  test('all three stand on two feet: what the story says of the frame is true of each', () => {
    for (const starter of STARTERS) expect((CATALOG[starter.build.legs!] as FramePart).legType ?? 'biped', starter.id).toBe('biped');
  });

  test('what each is fits the three lines it is read in, and its role the row it stands on', () => {
    for (const starter of STARTERS) {
      expect(wrap(starter.text, charsFor(310 - 28)).length, starter.id).toBeLessThanOrEqual(3);
      expect(starter.role.length, starter.id).toBeLessThanOrEqual(24);
      expect(starter.name.length, starter.id).toBeLessThanOrEqual(10);
    }
  });
});

describe('what sets them apart', () => {
  test('the Courier is the thinnest and the quickest, the Dozer the thickest and the slowest, the Hauler between', () => {
    expect(armour(courier.build)).toBeLessThan(armour(hauler.build));
    expect(armour(hauler.build)).toBeLessThan(armour(dozer.build));
    const mobility = (build: Build): number => computeBuildStats(build, CATALOG).mobility;
    expect(mobility(courier.build)).toBeGreaterThan(mobility(hauler.build));
    expect(mobility(hauler.build)).toBeGreaterThan(mobility(dozer.build));
    // On the field: a boosted Courier is harder to hit than a boosted Hauler, and that harder than a Dozer.
    const dodging = (build: Build): number => {
      const state = createBattle(build, [ENEMIES['recon-drone']], CATALOG, 1);
      return evasion({ ...state.units[0], boosted: true }, CATALOG);
    };
    expect(dodging(courier.build)).toBeGreaterThan(dodging(hauler.build));
    expect(dodging(hauler.build)).toBeGreaterThan(dodging(dozer.build));
  });

  test('the Dozer carries the most and the Courier the least: only the Courier cannot take a mortar beside two guns', () => {
    const carries = (build: Build): number => computeBuildStats(build, CATALOG).capacity;
    expect([carries(courier.build), carries(hauler.build), carries(dozer.build)]).toEqual([800, 1000, 1400]);
    const loaded = (build: Build): Build => ({ ...build, rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' });
    expect(validatePlayerBuild(loaded(hauler.build), CATALOG)).toEqual([]);
    expect(validatePlayerBuild(loaded(dozer.build), CATALOG)).toEqual([]);
    expect(validatePlayerBuild(loaded(courier.build), CATALOG)).toContain('overweight');
  });

  test('the Dozer guards behind its plate: less of a hit gets through than through a guard with nothing, more than through a riot shield', () => {
    const guarding = (build: Build): number => guardFactor(createBattle(build, [ENEMIES['recon-drone']], CATALOG, 1).units[0], CATALOG);
    expect(guarding(dozer.build)).toBe(0.5);
    expect(guarding(hauler.build)).toBe(0.6);
    expect(guarding({ ...dozer.build, leftHand: 'shd-riot' })).toBe(0.4);
  });

  test('each starts with a weapon of its own kind: the rifle is kinetic, the Courier\'s pistol energy and never empty', () => {
    const gun = (build: Build) => CATALOG[build.rightHand!] as { damageType: string; ammo: number | null };
    expect(gun(hauler.build)).toMatchObject({ damageType: 'kinetic' });
    expect(gun(courier.build)).toMatchObject({ damageType: 'energy', ammo: null });
    expect(CATALOG[dozer.build.leftHand!].kind).toBe('shield');
  });

  test('salvage is salvage: every part of the two new frames is thinner than the same part of the frame its maker sells', () => {
    const pairs: [string, string][] = [['courier', 'halo'], ['dozer', 'bulwark']];
    for (const [starter, sold] of pairs) {
      for (const slot of ['head', 'core', 'arms', 'legs']) {
        const [mine, theirs] = [CATALOG[`${slot}-${starter}`] as FramePart, CATALOG[`${slot}-${sold}`] as FramePart];
        expect(mine.ap, mine.id).toBeLessThan(theirs.ap);
        expect(mine.price, mine.id).toBeLessThan(theirs.price);
        expect(mine.vendor, mine.id).toBe(theirs.vendor);
      }
    }
    // The Courier is slower than a Halo, and the Dozer carries less than a Bulwark.
    expect((CATALOG['legs-courier'] as FramePart).mobility!).toBeLessThan((CATALOG['legs-halo'] as FramePart).mobility!);
    expect((CATALOG['legs-dozer'] as FramePart).capacity!).toBeLessThan((CATALOG['legs-bulwark'] as FramePart).capacity!);
  });
});

describe('each can be flown', () => {
  test.each(STARTERS.map((s) => [s.id, s] as const))('%s as it comes wins the patrol and both introductions nearly always', (_id, starter) => {
    for (const id of ['patrol', 'intro-1', 'intro-2']) expect(rate(starter.build, id), id).toBeGreaterThanOrEqual(0.95);
  }, LONG);

  test('as it comes none of them is shut out of a client\'s first contract, and none walks through all three', () => {
    for (const starter of STARTERS) {
      const won = FIRST.map((id) => rate(starter.build, id));
      for (const [i, r] of won.entries()) expect(r, `${starter.id} ${FIRST[i]}`).toBeGreaterThanOrEqual(0.25);
      expect(Math.min(...won), starter.id).toBeLessThanOrEqual(0.6);
    }
  }, LONG);

  test('the Courier shrugs at Lumen\'s own guards: it is well ahead of the Hauler there', () => {
    expect(rate(courier.build, 'lumen-1')).toBeGreaterThanOrEqual(rate(hauler.build, 'lumen-1') + 0.2);
  }, LONG);

  // What the introductions pay for: 1400 credits and the credits in hand buy each of these.
  const grown: [string, Build][] = [
    ['hauler', { ...hauler.build, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' }],
    ['courier', { ...courier.build, leftHand: 'wpn-rivet-rifle' }],
    ['dozer', { ...dozer.build, leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' }],
  ];
  test.each(grown)('%s with its first purchases wins the first contract of each of the three clients', (id, build) => {
    expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
    const starter = starterOf(id);
    const bought = Object.values(build).filter((part) => !Object.values(starter.build).includes(part));
    // Affordable from the credits in hand and what the two introductions pay (600 and 800), selling nothing.
    expect(worth(bought)).toBeLessThanOrEqual(starter.credits + 1400);
    for (const mission of FIRST) expect(rate(build, mission), mission).toBeGreaterThanOrEqual(0.85);
  }, LONG);
});
