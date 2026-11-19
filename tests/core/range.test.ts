import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { MAX_ENEMIES } from '../../src/core/battle';
import { MECH_ENEMIES, STORY_ENEMIES } from '../../src/core/board';
import { settle } from '../../src/core/economy';
import { startMissionBattle } from '../../src/core/mission';
import { RANGE_HALL, RANGE_MAX, isRange, parseRange, rangeId, rangeKinds, rangeLimit, rangeMission, rangeSettlement, type RangeText } from '../../src/core/range';
import { isDrill } from '../../src/core/training';
import { takesWingman } from '../../src/core/wingman';
import { ALL_ENEMIES } from '../../src/content/arena';
import { UNITS } from '../../src/content/codex';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

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
