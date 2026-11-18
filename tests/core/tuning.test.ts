import { activeUnit, applyAction, createBattle, previewShot, turnEnergyOf, type BattleState } from '../../src/core/battle';
import { computeBuildStats } from '../../src/core/build';
import { startNewCycle } from '../../src/core/campaign';
import { buy, isValidState, newGame, sell, type GameState } from '../../src/core/game';
import { awardMedals } from '../../src/core/medals';
import {
  TUNE_MAX, TUNE_STEP, checkTune, stepOf, tunable, tune, tuneCap, tuneCost, tuneFactor, tunedCatalog, tunedPart,
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
    expect([0, 1, 2, 3, 4, 9].map(tuneCap)).toEqual([2, 3, 4, 5, 5, 5]);
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
    expect({ ...tunedPart(rifle, 3), damage: rifle.damage }).toEqual(rifle);
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

  test('unless it is given the work as well: the copy a mirror match fields', () => {
    const copy = { ...turret, id: 'copy', build: { ...DEMO_BUILD }, tune: { 'core-hauler': 5 } };
    expect(createBattle(DEMO_BUILD, [copy], CATALOG, 7).units[1].parts.core!.maxAp).toBe(Math.round(core.ap * 1.25));
  });
});

describe('a saved game', () => {
  const saved = (tuning: unknown): unknown => JSON.parse(JSON.stringify({ ...fresh(), tuning }));

  test('from before there was a bench is as good as it was', () => {
    const old = JSON.parse(JSON.stringify(fresh())) as Record<string, unknown>;
    expect('tuning' in old).toBe(false);
    expect(isValidState(old, CATALOG)).toBe(true);
  });

  test('holds bench work as whole steps from one to five against plain ids', () => {
    expect(isValidState(saved({}), CATALOG)).toBe(true);
    expect(isValidState(saved({ 'core-hauler': 1, 'wpn-rivet-rifle': 5 }), CATALOG)).toBe(true);
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

describe('medals for the bench', () => {
  const earned = (game: GameState): string[] => awardMedals(game, MEDALS).earned.map((medal) => medal.id).filter((id) => id.startsWith('bench-'));

  test('one for the first step taken, one for a part taken to the last', () => {
    expect(earned(fresh())).toEqual([]);
    expect(earned(fresh({ tuning: {} }))).toEqual([]);
    expect(earned(fresh({ tuning: { 'core-hauler': 1 } }))).toEqual(['bench-1']);
    expect(earned(fresh({ tuning: { 'core-hauler': 4, 'wpn-rivet-rifle': 4 } }))).toEqual(['bench-1']);
    expect(earned(fresh({ tuning: { 'core-hauler': 2, 'wpn-rivet-rifle': 5 } }))).toEqual(['bench-1', 'bench-5']);
  });

  test('show how far along a pilot is', () => {
    const medal = (id: string) => MEDALS.find((m) => m.id === id)!;
    expect(medal('bench-5').progress(fresh({ tuning: { 'core-hauler': 3, 'gen-kd1': 1 } }))).toEqual({ have: 3, need: 5 });
    expect(medal('bench-1').progress(fresh())).toEqual({ have: 0, need: 1 });
  });
});
