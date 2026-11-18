import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { MAX_ENEMIES } from '../../src/core/battle';
import {
  ENEMY_COST, PAY_PER_HEAD, STORY_ENEMIES, SWARM_KINDS, SWARM_MAX, SWARM_MIN, boardTier, generateBoard, isSwarm, scaleFor, swarmContract,
} from '../../src/core/board';
import { settle } from '../../src/core/economy';
import { playMission, startMissionBattle } from '../../src/core/mission';
import { missionPar, parOf } from '../../src/core/rank';
import type { FramePart } from '../../src/core/types';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import SPRITES from '../../src/content/sprites.json';
import { BRIEFING_CHARS, briefingRows, hostiles, objectiveLines } from '../../src/ui/briefingScreen';
import { wrap } from '../../src/ui/widgets';

/** The swarm that is on offer beside the board: light machines, more than a field holds, paid by the head. */

afterEach(() => setLanguage('en'));

const swarm = (wins: number, cycle = 0) => swarmContract(wins, cycle, BOARD_TEXT);
const all = (wins: number, cycle = 0): string[] => { const [battle] = swarm(wins, cycle).battles; return [...battle.enemies, ...(battle.reserve ?? [])]; };
/** Every stage of the board, from a pilot's first open contract to the top tier of a later telling. */
const PROGRESS: [number, number][] = [[0, 0], [3, 0], [5, 0], [8, 0], [10, 0], [13, 0], [15, 0], [20, 0], [25, 0], [30, 0], [35, 0], [40, 0], [9, 1], [40, 3], [500, 9]];

test('the swarm is the same every time for the same progress, and changes with it', () => {
  expect(swarm(7)).toEqual(swarm(7));
  expect(swarm(7)).not.toEqual(swarm(8));
  expect(swarm(7).id).not.toBe(swarm(7, 1).id);
  // It is dealt on dice of its own: the board beside it is the board it always was.
  expect(generateBoard(7, 0, BOARD_TEXT).map((m) => m.id)).toEqual(['open-0-7-0', 'open-0-7-1', 'open-0-7-2']);
  expect(generateBoard(7, 0, BOARD_TEXT).map((m) => m.id)).not.toContain(swarm(7).id);
});

test.each(PROGRESS)('the swarm after %i wins in cycle %i is well formed', (wins, cycle) => {
  const mission = swarm(wins, cycle);
  const tier = boardTier(wins, cycle);
  expect(mission.id).toBe(`open-${cycle}-${wins}-swarm`);
  expect(isSwarm(mission)).toBe(true);
  for (const other of generateBoard(wins, cycle, BOARD_TEXT)) expect(isSwarm(other), other.id).toBe(false);
  expect(mission.phase).toBe('patrol');
  expect(BOARD_TEXT.swarmTitles).toContain(mission.title);
  expect(BOARD_TEXT.clients).toContain(mission.client);
  expect(mission.battles).toHaveLength(1);
  const [battle] = mission.battles;
  // Three on the field, the rest behind them: six to nine in all.
  expect(battle.enemies).toHaveLength(MAX_ENEMIES);
  const machines = all(wins, cycle);
  expect(machines.length).toBeGreaterThanOrEqual(SWARM_MIN);
  expect(machines.length).toBeLessThanOrEqual(SWARM_MAX);
  expect(battle.reserve).toHaveLength(machines.length - MAX_ENEMIES);
  // Of the kinds that tier fields, and of no others.
  const kinds = [...SWARM_KINDS].reverse().find((entry) => tier >= entry.from)!.kinds;
  for (const id of machines) expect(kinds, id).toContain(id);
  // Paid by the head, as tough as the board is at that tier, on a place there is a picture of.
  expect(mission.reward).toBe(PAY_PER_HEAD * machines.length);
  expect(mission.scale).toBeCloseTo(scaleFor(tier));
  expect(battle.background in SPRITES).toBe(true);
  expect(battle.objective).toBeUndefined();
  expect(battle.marks).toBeUndefined();
});

test('what a swarm is made of is light: nothing that leads, nothing of the story, nothing heavier than a gunship', () => {
  expect(SWARM_KINDS.map((entry) => entry.from)).toEqual([0, 3, 6]);
  const kinds = [...new Set(SWARM_KINDS.flatMap((entry) => entry.kinds))];
  expect(kinds.sort()).toEqual(['bomb-crawler', 'gunship', 'recon-drone']);
  for (const id of kinds) {
    const def = ENEMIES[id];
    expect(def, id).toBeDefined();
    expect(def.phases, id).toBeUndefined();
    expect(def.portrait, id).toBeUndefined();
    expect(def.leader, id).toBeUndefined();
    expect(STORY_ENEMIES, id).not.toContain(id);
    expect(ENEMY_COST[id], id).toBeLessThanOrEqual(2);
    expect((CATALOG[def.build.core!] as FramePart).ap, id).toBeLessThanOrEqual(110);
  }
  // The first swarms a pilot meets are recon drones and nothing else.
  for (const wins of [0, 3, 5, 8, 10, 13]) expect(new Set(all(wins))).toEqual(new Set(['recon-drone']));
});

test('every size and every kind turns up over a career', () => {
  const sizes = new Set<number>();
  const kinds = new Set<string>();
  const titles = new Set<string>();
  for (let wins = 0; wins < 120; wins++) {
    sizes.add(all(wins).length);
    for (const id of all(wins)) kinds.add(id);
    titles.add(swarm(wins).title);
  }
  expect([...sizes].sort()).toEqual([6, 7, 8, 9]);
  expect([...kinds].sort()).toEqual(['bomb-crawler', 'gunship', 'recon-drone']);
  expect(titles.size).toBe(BOARD_TEXT.swarmTitles.length);
});

test('the battle begins with three on the field and the rest to come, and it is an open battle', () => {
  for (const [wins, cycle] of PROGRESS) {
    const mission = swarm(wins, cycle);
    const state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 1, undefined, { enemyScale: mission.scale ?? 1 });
    expect(state.units.filter((u) => u.side === 'enemy')).toHaveLength(MAX_ENEMIES);
    expect(state.reserve.map((def) => def.id)).toEqual(mission.battles[0].reserve);
    expect(state.open).toBe(true);
  }
});

test('a good pilot is given a round for each machine that comes on later, beside what the field asks', () => {
  expect(parOf({ enemies: ['recon-drone', 'recon-drone', 'recon-drone'], background: 'bg-mine' })).toBe(9);
  expect(parOf({ enemies: ['recon-drone', 'recon-drone', 'recon-drone'], reserve: ['recon-drone', 'recon-drone', 'recon-drone', 'recon-drone'], background: 'bg-mine' })).toBe(13);
  // What a battle says for itself still holds, and so does a time to be outlasted.
  expect(parOf({ enemies: ['recon-drone'], reserve: ['recon-drone'], background: 'bg-mine', par: 4 })).toBe(4);
  expect(parOf({ enemies: ['recon-drone'], reserve: ['recon-drone'], background: 'bg-mine', objective: { type: 'survive', rounds: 6 } })).toBe(6);
  for (const [wins, cycle] of PROGRESS) expect(missionPar(swarm(wins, cycle))).toBe(9 + all(wins, cycle).length - 3);
});

describe('the briefing of a swarm', () => {
  test('counts every machine of it, says how many come on later, and fits its panel', () => {
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      for (const [wins, cycle] of PROGRESS) {
        const mission = swarm(wins, cycle);
        const total = all(wins, cycle).length;
        const counted = hostiles(mission).map((line) => Number(/ x(\d+)$/.exec(line)?.[1] ?? 1)).reduce((a, b) => a + b, 0);
        expect(counted, `${language} ${wins}`).toBe(total);
        const more = language === 'en' ? `${total - 3} more come on as they fall` : `Nog ${total - 3} volgen als er vallen`;
        expect(objectiveLines(mission)).toEqual([more]);
        const lines = mission.briefing.flatMap((paragraph) => wrap(paragraph, BRIEFING_CHARS));
        // Paragraphs stand a little apart: each gap is counted as the screen lays it out, in fifths of a row.
        expect(lines.length + (mission.briefing.length - 1) * 0.4, `${language} ${wins}`).toBeLessThanOrEqual(briefingRows(mission));
      }
    }
  });

  test('is numbered with the battle where a contract has more than one', () => {
    const two = { ...swarm(7), battles: [{ enemies: ['tank'], background: 'bg-mine' }, swarm(7).battles[0]] };
    expect(objectiveLines(two)).toEqual([`2: ${all(7).length - 3} more come on as they fall`]);
  });
});

describe('who wins a swarm', () => {
  /** The frames a pilot has by each stage of the board. */
  const STAGES: [number, string[]][] = [[0, ['starter', 'tier2']], [8, ['starter', 'tier2']], [15, ['tier2', 'tier3']], [25, ['tier3', 'tier4']], [35, ['tier5', 'tier6']], [40, ['tier5', 'tier6']]];

  test.each(STAGES)('after %i wins: the frames of that stage win it nearly every time, and it pays them', (wins, frames) => {
    const mission = swarm(wins);
    for (const frame of frames) {
      let won = 0;
      let net = 0;
      let rounds = 0;
      const SEEDS = 20;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const end = playMission(REFERENCE_BUILDS[frame], mission, ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: mission.scale ?? 1 });
        if (end.outcome === 'victory') won++;
        net += settle(end, mission.reward, CATALOG).net;
        rounds += end.round;
      }
      expect(won / SEEDS, frame).toBeGreaterThanOrEqual(0.95);
      expect(net / SEEDS, frame).toBeGreaterThan(400);
      // A fight, not a slog: the slowest frame at it takes a dozen rounds at most.
      expect(rounds / SEEDS, frame).toBeLessThanOrEqual(12);
    }
  });
});
