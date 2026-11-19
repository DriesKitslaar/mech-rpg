import { MIRROR_ID } from '../../src/core/arena';
import { generateBoard } from '../../src/core/board';
import { computeBuildStats } from '../../src/core/build';
import { LAUNCH_RUMBLE, LAUNCH_WEIGHT, launchRumble, launches } from '../../src/core/launch';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../../src/content/board';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { STARTERS } from '../../src/content/starters';

/** Which contracts open with a launch, and how heavily a machine goes. */

describe('which contracts open with a launch', () => {
  test('every contract of the story, and every one the board offers: they are flown from the hangar in the pilot\'s own machine', () => {
    for (const mission of MISSIONS) expect(launches(mission), mission.id).toBe(mission.loaner === undefined);
    // (The story lends a machine for nothing but its drills, which are not among its contracts.)
    expect(MISSIONS.filter((mission) => !launches(mission)).map((mission) => mission.id)).toEqual([]);
    for (const won of [0, 12, 40, 90]) for (const mission of generateBoard(won, 1, BOARD_TEXT)) expect(launches(mission), mission.id).toBe(true);
  });

  test('none of the arena\'s fights: the ladder, the mirror, a cup, a master, the eighth seat', () => {
    for (const id of ['arena-1', 'arena-15', MIRROR_ID, 'cup-bronze', 'cup-gold', 'arena-master-duellist', 'arena-seat']) expect(launches({ id }), id).toBe(false);
    // A fight of the ladder is known by its rank too, whatever it is called.
    expect(launches({ id: 'anything', arenaRank: 3 })).toBe(false);
  });

  test('nothing of the simulator\'s, no floor of the Gauntlet, and nothing flown in a lent machine', () => {
    for (const drill of DRILLS) expect(launches({ id: drill.id }), drill.id).toBe(false);
    expect(DRILLS.length).toBeGreaterThan(0);
    for (const id of ['drill-basics', 'range-unit-recon-drone', 'range-spar-2', 'gauntlet-1', 'gauntlet-25']) expect(launches({ id }), id).toBe(false);
    expect(launches({ id: 'hadron-1', loaner: ARCHETYPE_BUILDS.bastion.late })).toBe(false);
    // What only looks like one of those is a contract like any other.
    for (const id of ['arena', 'cupboard', 'ranger-1', 'drills', 'a-gauntlet-1', 'patrol', 'hadron-1-job', 'hadron-1-swarm']) expect(launches({ id }), id).toBe(true);
  });
});

describe('how heavily a machine goes', () => {
  test('the rumble is longer for a heavier machine, between the shortest and the longest there is', () => {
    expect([LAUNCH_WEIGHT, LAUNCH_RUMBLE]).toEqual([{ light: 700, heavy: 1700 }, { light: 60, heavy: 160 }]);
    expect(launchRumble(700)).toBe(60);
    expect(launchRumble(1200)).toBe(110);
    // To the nearest millisecond.
    expect([launchRumble(704), launchRumble(705), launchRumble(1195)]).toEqual([60, 61, 110]);
    expect(launchRumble(1700)).toBe(160);
    // Outside those weights it is the shortest or the longest, and no more.
    expect([launchRumble(0), launchRumble(300), launchRumble(1701), launchRumble(9000)]).toEqual([60, 60, 160, 160]);
    for (let weight = 600; weight < 1800; weight += 50) expect(launchRumble(weight + 50)).toBeGreaterThanOrEqual(launchRumble(weight));
  });

  test('the machines a pilot flies are told apart by it: a starter is lighter on the catapult than a late bastion', () => {
    const weight = (build: Parameters<typeof computeBuildStats>[0]): number => computeBuildStats(build, CATALOG).weight;
    const starters = STARTERS.map((starter) => launchRumble(weight(starter.build)));
    const bastion = launchRumble(weight(ARCHETYPE_BUILDS.bastion.late));
    const skirmisher = launchRumble(weight(ARCHETYPE_BUILDS.skirmisher.late));
    for (const ms of starters) expect(ms).toBeLessThan(bastion);
    expect(skirmisher).toBeLessThan(bastion);
    expect(bastion).toBeGreaterThanOrEqual(120);
  });
});
