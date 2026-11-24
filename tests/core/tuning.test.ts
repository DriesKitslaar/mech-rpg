import { activeUnit, applyAction, createBattle, previewShot, turnEnergyOf, type BattleState } from '../../src/core/battle';
import { computeBuildStats, impactOf } from '../../src/core/build';
import { startNewCycle } from '../../src/core/campaign';
import { buy, isValidState, newGame, sell, type GameState } from '../../src/core/game';
import { awardMedals } from '../../src/core/medals';
import {
  LICENCE_PRICES, TUNE_MAX, TUNE_STEP, benchCap, buyLicence, checkLicence, checkTune, licencePrice, stepOf, tunable, tune, tuneCap, tuneCost, tuneFactor,
  tunedCatalog, tunedPart,
} from '../../src/core/tuning';
import type { FramePart, Generator, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { MEDALS } from '../../src/content/medals';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

const fresh = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits: 100_000, ...extra });
const core = CATALOG['core-hauler'] as FramePart;
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const generator = CATALOG['gen-kd1'] as Generator;

describe('what the bench works on', () => {
  test('frame parts, weapons and generators; not what only steers, boosts or shields', () => {
    const kinds = (ok: boolean): string[] => [...new Set(Object.values(CATALOG).filter((part) => tunable(part) === ok).map((part) => part.kind))].sort();
    expect(kinds(true)).toEqual(['arms', 'core', 'generator', 'head', 'legs', 'weapon']);
    expect(kinds(false)).toEqual(['booster', 'fcs', 'module', 'shield']);
  });

  test('a step adds a twentieth, and there are never more than five', () => {
    expect(TUNE_STEP).toBe(0.05);
    expect(TUNE_MAX).toBe(5);
    expect(tuneFactor(undefined, 'core-hauler')).toBe(1);
    expect(tuneFactor({}, 'core-hauler')).toBe(1);
    expect(tuneFactor({ 'core-hauler': 3 }, 'core-hauler')).toBeCloseTo(1.15, 10);
    expect(tuneFactor({ 'core-hauler': 3 }, 'wpn-rivet-rifle')).toBe(1);
  });

  test('the step a part stands at is a whole number from none to five, whatever the record says', () => {
    expect(stepOf(undefined, 'core-hauler')).toBe(0);
    expect(stepOf({ 'core-hauler': 2 }, 'core-hauler')).toBe(2);
    expect(stepOf({ 'core-hauler': 9 }, 'core-hauler')).toBe(5);
    expect(stepOf({ 'core-hauler': -1 }, 'core-hauler')).toBe(0);
    expect(stepOf({ 'core-hauler': 2.7 }, 'core-hauler')).toBe(2);
    expect(stepOf({ 'core-hauler': Number.NaN }, 'core-hauler')).toBe(0);
    // A name every object has is not a part that was worked on.
    expect(stepOf({}, 'constructor')).toBe(0);
    expect(stepOf({}, 'toString')).toBe(0);
  });

  test('goes two steps in the first telling and one further with each telling after it, to five', () => {
    expect([0, 1, 2, 3, 4, 9].map((cycle) => tuneCap(cycle))).toEqual([2, 3, 4, 5, 5, 5]);
  });

  test('asks the number of the step times the price of the part', () => {
    expect(core.price).toBeGreaterThan(0);
    expect([1, 2, 3, 4, 5].map((step) => tuneCost(core, step))).toEqual([1, 2, 3, 4, 5].map((n) => n * core.price));
  });
});

describe('a step at the bench', () => {
  test('is paid for and written down against the part', () => {
    const before = fresh();
    expect(checkTune(before, 'core-hauler', CATALOG)).toBeNull();
    const once = tune(before, 'core-hauler', CATALOG);
    expect(once.credits).toBe(before.credits - core.price);
    expect(once.tuning).toEqual({ 'core-hauler': 1 });
    const twice = tune(once, 'core-hauler', CATALOG);
    expect(twice.credits).toBe(before.credits - core.price - 2 * core.price);
    expect(twice.tuning).toEqual({ 'core-hauler': 2 });
    // The game it was given is as it was.
    expect(before.tuning).toBeUndefined();
    expect(once.tuning).toEqual({ 'core-hauler': 1 });
  });

  test('is refused for a part there is not, one that is not owned, one the bench does not take, at the limit, and without the money', () => {
    expect(checkTune(fresh(), 'no-such-part', CATALOG)).toBe('unknown');
    expect(checkTune(fresh(), 'constructor', CATALOG)).toBe('unknown');
    expect(checkTune(fresh(), 'bst-stock', CATALOG)).toBe('notTunable');
    expect(checkTune(fresh(), 'core-bulwark', CATALOG)).toBe('notOwned');
    expect(checkTune(fresh({ tuning: { 'core-hauler': 2 } }), 'core-hauler', CATALOG)).toBe('limit');
    expect(checkTune(fresh({ credits: core.price - 1 }), 'core-hauler', CATALOG)).toBe('credits');
    expect(checkTune(fresh({ credits: core.price }), 'core-hauler', CATALOG)).toBeNull();
    // The second step costs twice the price: what paid for the first does not pay for it.
    expect(checkTune(fresh({ credits: 2 * core.price - 1, tuning: { 'core-hauler': 1 } }), 'core-hauler', CATALOG)).toBe('credits');
    for (const refused of ['no-such-part', 'bst-stock', 'core-bulwark']) expect(() => tune(fresh(), refused, CATALOG), refused).toThrow(/bench/);
    expect(() => tune(fresh({ credits: 0 }), 'core-hauler', CATALOG)).toThrow(/credits/);
  });

  test('goes one step further when the story starts over, and nothing done is lost', () => {
    const second = { ...fresh({ tuning: { 'core-hauler': 2 } }), cycle: 1 };
    expect(checkTune(second, 'core-hauler', CATALOG)).toBeNull();
    expect(checkTune({ ...second, tuning: { 'core-hauler': 3 } }, 'core-hauler', CATALOG)).toBe('limit');
    expect(checkTune({ ...second, cycle: 7, tuning: { 'core-hauler': 5 } }, 'core-hauler', CATALOG)).toBe('limit');
    // Starting over keeps the work.
    const done = { ...fresh({ tuning: { 'core-hauler': 2, 'wpn-rivet-rifle': 1 } }), completed: MISSIONS.filter((m) => m.phase === 'verdict').slice(0, 1).map((m) => m.id) };
    expect(startNewCycle(done, MISSIONS).tuning).toEqual({ 'core-hauler': 2, 'wpn-rivet-rifle': 1 });
  });

  test('is on the model, not the copy: it is still there when the part is sold and bought again, and nothing is paid twice', () => {
    const spare = buy(fresh(), 'core-bulwark', CATALOG);
    const tuned = tune(spare, 'core-bulwark', CATALOG);
    const sold = sell(tuned, 'core-bulwark', CATALOG);
    expect(sold.tuning).toEqual({ 'core-bulwark': 1 });
    // Not owned, so the bench will not take it; owned again, it stands where it stood.
    expect(checkTune(sold, 'core-bulwark', CATALOG)).toBe('notOwned');
    const back = buy(sold, 'core-bulwark', CATALOG);
    expect(back.credits).toBe(tuned.credits);
    expect(stepOf(back.tuning, 'core-bulwark')).toBe(1);
    expect(tune(back, 'core-bulwark', CATALOG).tuning).toEqual({ 'core-bulwark': 2 });
  });
});

describe('a part as the bench left it', () => {
  test('a frame part has more armour, a weapon more damage, a generator more output: a twentieth a step', () => {
    expect(tunedPart(core, 2).ap).toBe(Math.round(core.ap * 1.1));
    expect(tunedPart(rifle, 3).damage).toBeCloseTo(Math.round(rifle.damage * 1.15 * 10) / 10, 10);
    expect(tunedPart(generator, 4).output).toBe(generator.output + Math.round(generator.output * 0.2));
    // And nothing else about it changes.
    expect({ ...tunedPart(core, 2), ap: core.ap }).toEqual(core);
    // A weapon's push is worked out from its damage where it is not given: it is written down as it was, so that it does not grow with it.
    expect(rifle.impact).toBeUndefined();
    expect({ ...tunedPart(rifle, 3), damage: rifle.damage }).toEqual({ ...rifle, impact: impactOf(rifle) });
    expect(impactOf(tunedPart(rifle, 5))).toBe(impactOf(rifle));
    expect({ ...tunedPart(generator, 4), output: generator.output }).toEqual(generator);
  });

  test('untouched, or of a kind the bench does not take, it is the part itself', () => {
    expect(tunedPart(core, 0)).toBe(core);
    expect(tunedPart(CATALOG['bst-stock'], 3)).toBe(CATALOG['bst-stock']);
  });

  test('the catalogue as a pilot\'s garage reads it: the same ids, the parts worked on as they now are, every other part itself', () => {
    const view = tunedCatalog(CATALOG, { 'core-hauler': 2, 'gen-kd1': 1, 'no-such-part': 3 });
    expect(Object.keys(view)).toEqual(Object.keys(CATALOG));
    expect((view['core-hauler'] as FramePart).ap).toBe(Math.round(core.ap * 1.1));
    expect(view['wpn-rivet-rifle']).toBe(CATALOG['wpn-rivet-rifle']);
    expect(tunedCatalog(CATALOG, undefined)).toBe(CATALOG);
    expect(tunedCatalog(CATALOG, {})).toBe(CATALOG);
    // The catalogue it was given is as it was.
    expect((CATALOG['core-hauler'] as FramePart).ap).toBe(core.ap);
    // A tuned generator gives the build that much more energy a turn.
    expect(computeBuildStats(STARTER_BUILD, view).turnEnergy).toBe(computeBuildStats(STARTER_BUILD, CATALOG).turnEnergy + Math.round(generator.output * 0.05));
  });
});

describe('in a battle', () => {
  const turret = ENEMIES['gun-turret'];
  const battle = (tuneOf?: Record<string, number>): BattleState => createBattle(DEMO_BUILD, [turret], CATALOG, 7, tuneOf ? { mods: { tune: tuneOf } } : {});

  test('a tuned frame part goes in with a twentieth more armour a step, and the others as they were', () => {
    const plain = battle().units[0];
    const tuned = battle({ 'core-hauler': 2, 'legs-strider': 5 }).units[0];
    expect(tuned.parts.core).toEqual({ ap: Math.round(core.ap * 1.1), maxAp: Math.round(core.ap * 1.1) });
    expect(tuned.parts.legs!.maxAp).toBe(Math.round((CATALOG['legs-strider'] as FramePart).ap * 1.25));
    expect(tuned.parts.head).toEqual(plain.parts.head);
    expect(tuned.parts.arms).toEqual(plain.parts.arms);
  });

  test('it counts on top of what a pilot\'s perks add to armour', () => {
    const state = createBattle(DEMO_BUILD, [turret], CATALOG, 7, { mods: { armour: 0.18, tune: { 'core-hauler': 2 } } });
    expect(state.units[0].parts.core!.maxAp).toBe(Math.round(core.ap * 1.1 * 1.18));
  });

  test('a tuned generator gives a turn a twentieth more of its output a step', () => {
    const plain = battle();
    const tuned = battle({ 'gen-kd1': 3 });
    expect(turnEnergyOf(tuned.units[0], CATALOG)).toBe(turnEnergyOf(plain.units[0], CATALOG) + Math.round(generator.output * 0.15));
  });

  test('a tuned weapon hits a twentieth harder a step, and says so before it fires', () => {
    /** The armour a hit of the rifle takes off the turret's core, and what the preview of that shot promised. */
    const shot = (tuneOf?: Record<string, number>): { lost: number; promised: number } => {
      let state = battle(tuneOf);
      for (let guard = 0; activeUnit(state).id !== 'player' && guard < 20; guard++) state = applyAction(state, { type: 'endTurn' }, CATALOG);
      const enemy = state.units[1];
      const before = enemy.parts.core!.ap;
      const promised = previewShot(state, 'player', 'rightHand', enemy.id, 'core', CATALOG).damage;
      state = applyAction(state, { type: 'fire', weapon: 'rightHand', target: enemy.id, part: 'core' }, CATALOG, () => 0);
      return { lost: before - state.units[1].parts.core!.ap, promised };
    };
    const [plain, tuned] = [shot(), shot({ 'wpn-rivet-rifle': 4 })];
    expect(plain.lost).toBeGreaterThan(0);
    expect(tuned.lost).toBeGreaterThan(plain.lost);
    expect(Math.abs(tuned.lost - plain.lost * 1.2)).toBeLessThanOrEqual(1);
    expect(plain.promised).toBe(plain.lost);
    expect(tuned.promised).toBe(tuned.lost);
    // Work on another weapon is not work on this one.
    expect(shot({ 'wpn-arc-pistol': 5 }).lost).toBe(plain.lost);
  });

  test('an enemy that carries the same parts is as the factory made it', () => {
    const twin = { ...turret, id: 'twin', build: { ...DEMO_BUILD } };
    const state = createBattle(DEMO_BUILD, [twin], CATALOG, 7, { mods: { tune: { 'core-hauler': 5, 'gen-kd1': 5 } } });
    expect(state.units[1].parts.core!.maxAp).toBe(core.ap);
    expect(state.units[0].parts.core!.maxAp).toBe(Math.round(core.ap * 1.25));
    expect(turnEnergyOf(state.units[1], CATALOG)).toBe(computeBuildStats(DEMO_BUILD, CATALOG).turnEnergy);
  });

  test('unless it is given the work as well: the copy a mirror match fields, in its armour, its weapons and its energy', () => {
    const copy = (tuneOf?: Record<string, number>) => ({ ...turret, id: 'copy', build: { ...DEMO_BUILD }, ...(tuneOf ? { tune: tuneOf } : {}) });
    const plain = createBattle(DEMO_BUILD, [copy()], CATALOG, 7);
    const tuned = createBattle(DEMO_BUILD, [copy({ 'core-hauler': 5, 'wpn-rivet-rifle': 4, 'gen-kd1': 3 })], CATALOG, 7);
    expect(tuned.units[1].parts.core!.maxAp).toBe(Math.round(core.ap * 1.25));
    expect(turnEnergyOf(tuned.units[1], CATALOG)).toBe(turnEnergyOf(plain.units[1], CATALOG) + Math.round(generator.output * 0.15));
    /** What a hit of the copy's rifle on the pilot's core would take off it. */
    const hit = (state: BattleState): number => previewShot(state, state.units[1].id, 'rightHand', 'player', 'core', CATALOG).damage;
    expect(hit(plain)).toBeGreaterThan(0);
    expect(hit(tuned)).toBeGreaterThan(hit(plain));
    expect(Math.abs(hit(tuned) - hit(plain) * 1.2)).toBeLessThanOrEqual(1);
    // The pilot who faces it is not tuned by it.
    expect(tuned.units[0].parts.core!.maxAp).toBe(core.ap);
    expect(turnEnergyOf(tuned.units[0], CATALOG)).toBe(turnEnergyOf(plain.units[0], CATALOG));
  });
});

describe('a saved game', () => {
  const saved = (tuning: unknown): unknown => JSON.parse(JSON.stringify({ ...fresh(), tuning }));

  test('from before there was a bench is as good as it was', () => {
    const old = JSON.parse(JSON.stringify(fresh())) as Record<string, unknown>;
    expect('tuning' in old).toBe(false);
    expect(isValidState(old, CATALOG)).toBe(true);
  });

  test('holds bench work as whole steps against plain ids, as far as the bench goes in the telling it is in', () => {
    expect(isValidState(saved({}), CATALOG)).toBe(true);
    expect(isValidState(saved({ 'core-hauler': 1, 'wpn-rivet-rifle': 2 }), CATALOG)).toBe(true);
    // A step nobody could have taken yet is no step: the bench goes two in a first telling and one further in each after it.
    const inCycle = (cycle: number, tuning: unknown): unknown => JSON.parse(JSON.stringify({ ...fresh(), cycle, tuning }));
    for (let cycle = 0; cycle <= 5; cycle++) {
      for (let step = 1; step <= 5; step++) {
        expect(isValidState(inCycle(cycle, { 'core-hauler': step }), CATALOG), `step ${step} in cycle ${cycle}`).toBe(step <= Math.min(5, 2 + cycle));
      }
    }
    // A part this version does not know is no reason to refuse the whole game: it is simply never fitted.
    expect(isValidState(saved({ 'core-of-a-later-version': 2 }), CATALOG)).toBe(true);
  });

  test.each([
    ['a step past the last', { 'core-hauler': 6 }], ['no step at all', { 'core-hauler': 0 }], ['half a step', { 'core-hauler': 1.5 }],
    ['a word for a step', { 'core-hauler': 'two' }], ['a list', ['core-hauler']], ['a number', 3], ['nothing where a record should be', null],
    ['an id that is no id', { 'Core Hauler!': 1 }], ['an id as long as a page', { ['x'.repeat(65)]: 1 }],
  ])('is refused with %s', (_, tuning) => {
    expect(isValidState(saved(tuning), CATALOG)).toBe(false);
  });

  test('is refused with more parts worked on than there could be', () => {
    const many = Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`part-${i}`, 1]));
    expect(isValidState(saved(many), CATALOG)).toBe(false);
    expect(isValidState(saved(Object.fromEntries(Object.entries(many).slice(0, 256))), CATALOG)).toBe(true);
  });
});

describe('the bench\'s licence', () => {
  /** A game whose story is told to its end: one that may begin again. */
  const told = (extra: Partial<GameState>): GameState => ({ ...fresh(extra), completed: MISSIONS.filter((m) => m.phase === 'verdict').slice(0, 1).map((m) => m.id) });

  test('how far the bench goes: the telling and the licences together, never past five', () => {
    expect([tuneCap(0), tuneCap(0, 1), tuneCap(1, 1), tuneCap(2, 3), tuneCap(0, 3), tuneCap(3, 0), tuneCap(0, 2)]).toEqual([2, 3, 4, 5, 5, 5, 4]);
    expect([benchCap({ cycle: 0 }), benchCap({ cycle: 0, bench: 2 }), benchCap({ cycle: 1, bench: 1 }), benchCap({ cycle: 9, bench: 3 })]).toEqual([2, 4, 4, 5]);
    // What a kept game says of it is read with care: anything but one, two or three reads as none.
    for (const odd of [0, 4, -1, 1.5, '2', null, Number.NaN, [1]]) expect(benchCap({ cycle: 0, bench: odd as unknown as number }), JSON.stringify(odd)).toBe(2);
  });

  test('a licence costs by the step it opens: the third, the fourth, the fifth', () => {
    expect(LICENCE_PRICES).toEqual([50_000, 100_000, 150_000]);
    expect([undefined, 1, 2, 3].map((bench) => licencePrice({ cycle: 0, bench }))).toEqual([50_000, 100_000, 150_000, null]);
    // In a second telling the bench goes three by itself: the first licence bought there opens the fourth step, and costs what that costs.
    expect(licencePrice({ cycle: 1 })).toBe(100_000);
    expect(licencePrice({ cycle: 1, bench: 1 })).toBe(150_000);
    expect(licencePrice({ cycle: 2 })).toBe(150_000);
    // Where the bench goes five there is nothing to license.
    expect([licencePrice({ cycle: 3 }), licencePrice({ cycle: 2, bench: 1 }), licencePrice({ cycle: 1, bench: 2 }), licencePrice({ cycle: 8, bench: 3 })]).toEqual([null, null, null, null]);
  });

  test('it is bought with credits, and opens the next step for every part at the step\'s own price', () => {
    expect(checkLicence({ cycle: 0, credits: 49_999 })).toBe('credits');
    expect(checkLicence({ cycle: 0, credits: 50_000 })).toBeNull();
    expect(checkLicence({ cycle: 0, bench: 1, credits: 99_999 })).toBe('credits');
    expect(checkLicence({ cycle: 3, credits: 10_000_000 })).toBe('end');
    expect(checkLicence({ cycle: 0, bench: 3, credits: 10_000_000 })).toBe('end');
    const before = fresh({ credits: 60_000, tuning: { 'core-hauler': 2, 'wpn-rivet-rifle': 2 } });
    expect(checkTune(before, 'core-hauler', CATALOG)).toBe('limit');
    const after = buyLicence(before);
    expect(after).toEqual({ ...before, credits: 10_000, bench: 1 });
    // The game it was given is as it was.
    expect(before.bench).toBeUndefined();
    // The step past the old limit can now be taken, by any part, at what a third step costs.
    expect(checkTune(after, 'core-hauler', CATALOG)).toBeNull();
    expect(checkTune(after, 'wpn-rivet-rifle', CATALOG)).toBeNull();
    const tuned = tune(after, 'core-hauler', CATALOG);
    expect(tuned.tuning).toEqual({ 'core-hauler': 3, 'wpn-rivet-rifle': 2 });
    expect(tuned.credits).toBe(10_000 - 3 * core.price);
    // And no further: the step after it asks for the next licence.
    expect(checkTune(tuned, 'core-hauler', CATALOG)).toBe('limit');
    expect(() => buyLicence(tuned)).toThrow(/credits/);
    expect(() => buyLicence({ ...before, cycle: 3 })).toThrow(/end/);
    // Three of them are all there are.
    const all = buyLicence(buyLicence(buyLicence(fresh({ credits: 300_000 }))));
    expect([all.bench, all.credits, benchCap(all)]).toEqual([3, 0, 5]);
    expect(checkLicence({ ...all, credits: 10_000_000 })).toBe('end');
  });

  test('a new telling keeps it, and brings its own step on top', () => {
    const next = startNewCycle(told({ bench: 1, tuning: { 'core-hauler': 3 } }), MISSIONS);
    expect([next.cycle, next.bench, benchCap(next)]).toEqual([1, 1, 4]);
    expect(checkTune(next, 'core-hauler', CATALOG)).toBeNull();
    // Nobody pays for a step and is then handed that step: what is next to license there is the fifth.
    expect(licencePrice(next)).toBe(150_000);
    // With all three bought the bench is at its end, in this telling and every other.
    const most = startNewCycle(told({ bench: 3, tuning: { 'core-hauler': 5 } }), MISSIONS);
    expect([most.bench, benchCap(most), licencePrice(most)]).toEqual([3, 5, null]);
  });

  test('a kept game is read with care', () => {
    const kept = (extra: Record<string, unknown>): unknown => JSON.parse(JSON.stringify({ ...fresh(), ...extra }));
    // Two licences in a first telling: the bench goes four, and a part may stand there.
    expect(isValidState(kept({ bench: 2, tuning: { 'core-hauler': 4 } }), CATALOG)).toBe(true);
    expect(isValidState(kept({ bench: 3, tuning: { 'core-hauler': 5 } }), CATALOG)).toBe(true);
    expect(isValidState(kept({ bench: 1 }), CATALOG)).toBe(true);
    // But no further than they open: a fifth step asks for the third.
    expect(isValidState(kept({ bench: 2, tuning: { 'core-hauler': 5 } }), CATALOG)).toBe(false);
    // Without one, a step past the telling's own is no step: as it always was.
    expect(isValidState(kept({ tuning: { 'core-hauler': 4 } }), CATALOG)).toBe(false);
    for (const bench of [0, 4, -1, 1.5, '2', null, [1], {}]) expect(isValidState(kept({ bench }), CATALOG), `bench ${JSON.stringify(bench)}`).toBe(false);
    // What the rules write is what the reader takes.
    let bought = buyLicence(buyLicence(fresh({ credits: 150_000 + 10 * core.price })));
    for (let step = 1; step <= 4; step++) bought = tune(bought, 'core-hauler', CATALOG);
    expect([bought.bench, bought.tuning, bought.credits]).toEqual([2, { 'core-hauler': 4 }, 0]);
    expect(isValidState(JSON.parse(JSON.stringify(bought)), CATALOG)).toBe(true);
  });
});

describe('medals for the bench', () => {
  const earned = (game: GameState): string[] => awardMedals(game, MEDALS).earned.map((medal) => medal.id).filter((id) => id.startsWith('bench-'));

  test('one for the first step taken, one for a part taken to the last', () => {
    expect(earned(fresh())).toEqual([]);
    expect(earned(fresh({ tuning: {} }))).toEqual([]);
    expect(earned(fresh({ tuning: { 'core-hauler': 1 } }))).toEqual(['bench-1']);
    expect(earned(fresh({ tuning: { 'core-hauler': 4, 'wpn-rivet-rifle': 4 } }))).toEqual(['bench-1']);
    expect(earned(fresh({ tuning: { 'core-hauler': 2, 'wpn-rivet-rifle': 5 } }))).toEqual(['bench-1', 'bench-5']);
  });

  test('count the work on parts there are and that the bench takes: a name that is no part earns nothing', () => {
    expect(earned(fresh({ tuning: { 'no-such-part': 5 } }))).toEqual([]);
    expect(earned(fresh({ tuning: { 'bst-stock': 5 } }))).toEqual([]);
    expect(earned(fresh({ tuning: { 'no-such-part': 5, 'core-hauler': 1 } }))).toEqual(['bench-1']);
    const medal = (id: string) => MEDALS.find((m) => m.id === id)!;
    expect(medal('bench-5').progress(fresh({ tuning: { 'no-such-part': 5, 'core-hauler': 2 } }))).toEqual({ have: 2, need: 5 });
  });

  test('show how far along a pilot is', () => {
    const medal = (id: string) => MEDALS.find((m) => m.id === id)!;
    expect(medal('bench-5').progress(fresh({ tuning: { 'core-hauler': 3, 'gen-kd1': 1 } }))).toEqual({ have: 3, need: 5 });
    expect(medal('bench-1').progress(fresh())).toEqual({ have: 0, need: 1 });
  });
});
