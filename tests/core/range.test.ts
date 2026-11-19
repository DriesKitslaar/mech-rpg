import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { MAX_ENEMIES } from '../../src/core/battle';
import { MECH_ENEMIES, STORY_ENEMIES } from '../../src/core/board';
import { settle } from '../../src/core/economy';
import { startMissionBattle } from '../../src/core/mission';
import { CLASS_AI, archetypeOf } from '../../src/core/archetype';
import { MIRROR_SCALE } from '../../src/core/arena';
import { buy, newGame, type GameState } from '../../src/core/game';
import {
  RANGE_HALL, RANGE_MAX, SPAR_ENEMY, isRange, parseRange, parseSpar, rangeId, rangeKinds, rangeLimit, rangeMission, rangeSettlement, sparEnemy, sparId,
  sparMission, sparSlots, type RangeText, type SparText,
} from '../../src/core/range';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { isDrill } from '../../src/core/training';
import { takesWingman } from '../../src/core/wingman';
import { ALL_ENEMIES } from '../../src/content/arena';
import { UNITS } from '../../src/content/codex';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

/**
 * The range: the pilot's own build against any machine met, in the simulator, for nothing. A fight
 * on it is a contract made on the spot, so that it is briefed and fought like any other.
 */

const TEXT: RangeText = {
  title: 'Test Range', client: 'Training Simulator', debrief: 'Reset.',
  briefing: (name, count) => `${count} of ${name}.`, free: 'Nothing is billed.',
};
const ORDER = UNITS.map((unit) => unit.id);

test('up to three of a machine an open contract fields in numbers; one of a mech, and one of anything of the story\'s', () => {
  expect(RANGE_MAX).toBe(3);
  expect(RANGE_MAX).toBe(MAX_ENEMIES);
  expect(['recon-drone', 'gun-turret', 'tank', 'gunship', 'jammer'].map(rangeLimit)).toEqual([3, 3, 3, 3, 3]);
  expect(['light-mech', 'heavy-mech', 'juggernaut', 'marksman'].map(rangeLimit)).toEqual([1, 1, 1, 1]);
  expect(['leviathan', 'strip-miner', 'rival', 'scrap-king', 'larder', 'lien-drone'].map(rangeLimit)).toEqual([1, 1, 1, 1, 1, 1]);
  for (const kind of MECH_ENEMIES) expect(rangeLimit(kind), kind).toBe(1);
  for (const kind of STORY_ENEMIES) expect(rangeLimit(kind), kind).toBe(1);
});

test('what can be fought is what has been met, in the order the database lists it', () => {
  expect(rangeKinds({ met: [] }, ORDER)).toEqual([]);
  // Met in any order, and with things the database has no page for among them.
  const met = ['tank', 'arena-3', 'recon-drone', 'mirror', 'leviathan', 'gun-turret'];
  expect(rangeKinds({ met }, ORDER)).toEqual(ORDER.filter((id) => met.includes(id)));
  expect(rangeKinds({ met }, ORDER)).toEqual(['recon-drone', 'gun-turret', 'tank', 'leviathan']);
  expect(rangeKinds({ met: [...ORDER] }, ORDER)).toEqual(ORDER);
});

test('a fight on the range is known by its id, which says how many of what', () => {
  expect(rangeId('recon-drone', 2)).toBe('range-2-recon-drone');
  expect(parseRange('range-2-recon-drone')).toEqual({ kind: 'recon-drone', count: 2 });
  expect(parseRange(rangeId('ashfall-unbound', 1))).toEqual({ kind: 'ashfall-unbound', count: 1 });
  for (const id of ['range-0-tank', 'range-4-tank', 'range-2-', 'range-tank', 'range--tank', 'drill-aim', 'open-0-20-1', 'range-2x-tank', 'arrange-1-tank', '']) expect(parseRange(id), id).toBeNull();
  expect(isRange({ id: 'range-1-tank' })).toBe(true);
  expect(['drill-aim', 'patrol', 'open-0-20-1', 'arrange-1-tank'].map((id) => isRange({ id }))).toEqual([false, false, false, false]);
});

test('the contract: one fight in the simulator\'s hall against so many of the machine, as the book has it, for no pay', () => {
  const mission = rangeMission('gun-turret', 3, 'Gun Turret', TEXT);
  expect(mission).toEqual({
    id: 'range-3-gun-turret', phase: 'patrol', title: 'Test Range', client: 'Training Simulator',
    briefing: ['3 of Gun Turret.', 'Nothing is billed.'], debrief: 'Reset.', reward: 0, scale: 1,
    battles: [{ enemies: ['gun-turret', 'gun-turret', 'gun-turret'], background: RANGE_HALL }],
  });
  expect(RANGE_HALL).toBe('bg-simulator');
  // It is a fight on the range and not a drill: no mech is lent for it.
  expect(isRange(mission)).toBe(true);
  expect(isDrill(mission)).toBe(false);
  expect(mission.loaner).toBeUndefined();
  // Nobody is hired into the simulator.
  expect(takesWingman(mission)).toBe(false);
});

test('more than may be fielded is as many as may be, and less than one is one', () => {
  expect(rangeMission('heavy-mech', 3, 'Bulwark Enforcer', TEXT)).toMatchObject({ id: 'range-1-heavy-mech', battles: [{ enemies: ['heavy-mech'] }], briefing: ['1 of Bulwark Enforcer.', 'Nothing is billed.'] });
  expect(rangeMission('tank', 9, 'Salvage Tank', TEXT).battles[0].enemies).toEqual(['tank', 'tank', 'tank']);
  expect(rangeMission('tank', 0, 'Salvage Tank', TEXT).battles[0].enemies).toEqual(['tank']);
  expect(rangeMission('tank', 2.7, 'Salvage Tank', TEXT).id).toBe('range-2-tank');
});

test('the bill is the bill a real flight would have had, marked as one that is not billed', () => {
  const fought = runBattle(startMissionBattle(DEMO_BUILD, rangeMission('gun-turret', 2, 'Gun Turret', TEXT), 0, ALL_ENEMIES, CATALOG, 11), CATALOG, chooseAutoPlayerAction);
  const bill = settle(fought, 0, CATALOG);
  expect(bill.ammoCost + bill.repairCost).toBeGreaterThan(0);
  const shown = rangeSettlement(bill);
  expect(shown).toEqual({ ...bill, simulated: true });
  expect(shown.reward).toBe(0);
  expect(shown.net).toBe(-(bill.ammoCost + bill.repairCost));
  // The bill it was given is as it was.
  expect(bill.simulated).toBeUndefined();
});

test('every machine the database has a page for can be fielded, as many as may be, and the fight comes to an end', () => {
  expect(ORDER.length).toBeGreaterThanOrEqual(47);
  for (const kind of ORDER) {
    const mission = rangeMission(kind, RANGE_MAX, ALL_ENEMIES[kind].name, TEXT);
    const start = startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 5);
    expect(start.units.slice(1).map((unit) => unit.kind), kind).toEqual(Array(rangeLimit(kind)).fill(kind));
    expect(['victory', 'defeat'], kind).toContain(runBattle(start, CATALOG, chooseAutoPlayerAction).outcome);
  }
});

describe('sparring: a saved build of the pilot\'s own as the opponent', () => {
  const HALO: Build = { ...STARTER_BUILD, head: 'head-halo' };
  /** A pilot with a duellist saved first, nothing second, and a bastion saved third. */
  const pilot = (): GameState => {
    let game: GameState = { ...newGame(CATALOG, STARTER_BUILD), credits: 9_999_999 };
    for (const build of [ARCHETYPE_BUILDS.duellist.war, ARCHETYPE_BUILDS.bastion.war]) {
      for (const id of new Set(Object.values(build).filter((part): part is string => part !== undefined))) {
        while ((game.inventory[id] ?? 0) < Object.values(build).filter((part) => part === id).length) game = buy(game, id, CATALOG);
      }
    }
    return { ...game, loadouts: [ARCHETYPE_BUILDS.duellist.war, null, ARCHETYPE_BUILDS.bastion.war] };
  };
  const SPAR: SparText = { title: 'Sparring', client: 'Training Simulator', debrief: 'Reset.', briefing: (slot) => `Build ${slot}.`, free: 'Nothing is billed.' };

  test('a spar is a fight on the range with an id of its own, which no fight against a machine can have', () => {
    expect(sparId(2)).toBe('range-spar-2');
    expect([0, 1, 2].map((slot) => parseSpar(sparId(slot)))).toEqual([0, 1, 2]);
    for (const id of ['range-spar-3', 'range-spar-', 'range-spar-x', 'range-spar-01', 'range-1-tank', 'spar-1', 'arrange-spar-1', '']) expect(parseSpar(id), id).toBeNull();
    expect(isRange({ id: sparId(0) })).toBe(true);
    expect(parseRange(sparId(0))).toBeNull();
    expect(SPAR_ENEMY(1)).toBe('spar-1');
  });

  test('the saved builds that can be sparred with: those that are there, still owned and fit to fly, the one on the floor among them', () => {
    const game = pilot();
    expect(sparSlots(game, CATALOG)).toEqual([0, 2]);
    // Sold since: not an opponent.
    expect(sparSlots({ ...game, inventory: { ...game.inventory, [ARCHETYPE_BUILDS.bastion.war.core]: 0 } }, CATALOG)).toEqual([0]);
    // Unarmed: not fit to fly, so not an opponent either.
    expect(sparSlots({ ...game, loadouts: [{ ...STARTER_BUILD, rightHand: undefined }, null, null] }, CATALOG)).toEqual([]);
    // The very build the pilot is flying can be sparred with: it is a mirror.
    expect(sparSlots({ ...game, loadouts: [game.build, null, null] }, CATALOG)).toEqual([0]);
    expect(sparSlots({ ...game, loadouts: [null, null, null] }, CATALOG)).toEqual([]);
    // Fit to fly is judged with the bench's work counted: a generator the bench has worked on carries what it could not as sold.
    const hungry: Build = { ...STARTER_BUILD, head: 'head-auditor', core: 'core-sterling', arms: 'arms-shrike', fcs: 'fcs-omni', rightHand: undefined, shoulder: 'wpn-sunlance' };
    let owner: GameState = { ...newGame(CATALOG, STARTER_BUILD), credits: 9_999_999 };
    for (const id of new Set(Object.values(hungry).filter((part): part is string => part !== undefined))) if (!owner.inventory[id]) owner = buy(owner, id, CATALOG);
    owner = { ...owner, loadouts: [hungry, null, null] };
    expect(sparSlots(owner, CATALOG)).toEqual([]);
    expect(sparSlots({ ...owner, tuning: { 'gen-kd1': 1 } }, CATALOG)).toEqual([0]);
  });

  test('the opponent is that build, part for part, with the bench\'s work on it, in other colours, and flown as its class is flown', () => {
    const game = pilot();
    const duellist = sparEnemy(game, 0, 'Saved Build 1', CATALOG);
    expect(duellist).toEqual({ id: 'spar-0', name: 'Saved Build 1', ai: 'bruiser', sprite: 'enemy-rival', composed: true, build: ARCHETYPE_BUILDS.duellist.war, paint: 'obsidian' });
    // A copy: what is done to the opponent is not done to the saved build.
    expect(duellist.build).not.toBe(game.loadouts[0]);
    const tuned = sparEnemy({ ...game, tuning: { 'gen-kd1': 2 }, paint: 'obsidian' }, 2, 'Saved Build 3', CATALOG);
    expect(tuned).toMatchObject({ id: 'spar-2', ai: 'bruiser', build: ARCHETYPE_BUILDS.bastion.war, tune: { 'gen-kd1': 2 }, paint: 'bone' });
    // Each class has its way of flying.
    expect(CLASS_AI).toEqual({ duellist: 'bruiser', marksman: 'gunner', artillery: 'sprayer', lancer: 'gunner', bastion: 'bruiser', skirmisher: 'skirmisher', allrounder: 'gunner' });
    expect(sparEnemy({ ...game, loadouts: [HALO, null, null] }, 0, 'x', CATALOG).ai).toBe(CLASS_AI[archetypeOf(HALO, CATALOG)]);
  });

  test('the contract: one fight in the hall against that build, as a mirror match is scaled, for no pay', () => {
    const mission = sparMission(2, SPAR);
    expect(mission).toEqual({
      id: 'range-spar-2', phase: 'patrol', title: 'Sparring', client: 'Training Simulator', briefing: ['Build 3.', 'Nothing is billed.'], debrief: 'Reset.',
      reward: 0, scale: MIRROR_SCALE, battles: [{ enemies: ['spar-2'], background: RANGE_HALL }],
    });
    expect(isDrill(mission)).toBe(false);
    expect(takesWingman(mission)).toBe(false);
  });

  test('it is a fight that can be fought to an end, by either side', () => {
    const game = pilot();
    const enemies = { ...ALL_ENEMIES, 'spar-0': sparEnemy(game, 0, 'Saved Build 1', CATALOG), 'spar-2': sparEnemy(game, 2, 'Saved Build 3', CATALOG) };
    for (const slot of [0, 2]) {
      const start = startMissionBattle(ARCHETYPE_BUILDS.marksman.war, sparMission(slot, SPAR), 0, enemies, CATALOG, 9, undefined, { enemyScale: MIRROR_SCALE });
      expect(start.units[1]).toMatchObject({ kind: `spar-${slot}`, composed: true, build: game.loadouts[slot] });
      expect(['victory', 'defeat']).toContain(runBattle(start, CATALOG, chooseAutoPlayerAction).outcome);
    }
  });
});
