import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { MAX_ENEMIES, ROUND_LIMIT } from '../../src/core/battle';
import {
  ENEMY_COST, PAY_PER_HEAD, STORY_ENEMIES, SWARM_GUNSHIPS, SWARM_KINDS, SWARM_MAX, SWARM_MIN, boardTier, generateBoard, isSwarm, scaleFor, swarmContract,
} from '../../src/core/board';
import { settle } from '../../src/core/economy';
import { DIFFICULTY_SCALE } from '../../src/core/game';
import { playMission, startMissionBattle } from '../../src/core/mission';
import { missionPar, parOf } from '../../src/core/rank';
import { tuneCap } from '../../src/core/tuning';
import type { FramePart } from '../../src/core/types';
import { BOARD_TEXT } from '../../src/content/board';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { dictionaryOf, setLanguage } from '../../src/content/language';
import { MISSIONS } from '../../src/content/missions';
import '../../src/content/nl';
import { SIDE_WORK } from '../../src/content/sidework';
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

test('a swarm is called something nothing else is called, and something Dutch in Dutch', () => {
  const nl = dictionaryOf('nl');
  const others = [...MISSIONS, ...SIDE_WORK, ...DRILLS].map((m) => m.title);
  expect(BOARD_TEXT.swarmTitles).toHaveLength(8);
  expect(new Set(BOARD_TEXT.swarmTitles).size).toBe(8);
  for (const title of BOARD_TEXT.swarmTitles) {
    // Not a contract of the story, the side work or the simulator: a pilot on Lumen's path once had two rows called Scrap Tide.
    expect(others, title).not.toContain(title);
    // Not what the open board can deal either: its titles are one of its adjectives and one of its nouns.
    const [first, ...rest] = title.split(' ');
    expect(BOARD_TEXT.adjectives.includes(first) && BOARD_TEXT.nouns.includes(rest.join(' ')), title).toBe(false);
    // And it has a Dutch name of its own, which is no other contract's Dutch name.
    expect(Object.hasOwn(nl, title), title).toBe(true);
    expect(nl[title], title).not.toBe(title);
    expect(nl[title].length, title).toBeLessThanOrEqual(18);
    expect(others.map((other) => nl[other] ?? other), title).not.toContain(nl[title]);
  }
  const dutch = new Set(BOARD_TEXT.swarmTitles.map((title) => nl[title]));
  expect(dutch.size).toBe(8);
  // As the list of contracts shows it, in Dutch: the titles themselves are read in the language that is set.
  expect(swarm(15).title).toBe('Rust Tide');
  setLanguage('nl');
  expect(swarm(15).title).toBe('Roesttij');
  expect(new Set(Array.from({ length: 120 }, (_, wins) => swarm(wins).title))).toEqual(dutch);
});

test('no swarm has more than two gunships, at any stage of any telling: the rest of it is drones', () => {
  expect(SWARM_GUNSHIPS).toBe(2);
  let most = 0;
  let withTwo = 0;
  for (const cycle of [0, 1, 2, 5]) {
    for (let wins = 0; wins < 80; wins++) {
      const machines = all(wins, cycle);
      const gunships = machines.filter((id) => id === 'gunship').length;
      expect(gunships, `after ${wins} wins in cycle ${cycle}`).toBeLessThanOrEqual(SWARM_GUNSHIPS);
      most = Math.max(most, gunships);
      if (gunships === SWARM_GUNSHIPS) withTwo++;
      // What would have been a third is a drone: the swarm is as many machines as it was dealt.
      if (gunships > 0) expect(machines.filter((id) => id !== 'gunship').every((id) => id === 'recon-drone')).toBe(true);
    }
  }
  expect(most).toBe(SWARM_GUNSHIPS);
  expect(withTwo).toBeGreaterThan(100);
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
        const more = language === 'en' ? `${total - 3} more come on as they fall` : `Nog ${total - 3} volgen als er een valt`;
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

describe('the swarms with gunships in them (thirty to thirty-nine wins of a first telling), on both difficulties', () => {
  const PERKS = { aim: 12, evasion: 12, energy: 60, cooling: 15, repairs: 2, armour: 0.18 };
  /** Every swarm of that stretch, six seeds each: how many were won, the mean rounds, the slowest swarm's mean, and how many met the round limit. */
  const flown = (frame: string, difficulty: number, grown: boolean) => {
    const tally = { battles: 0, won: 0, rounds: 0, slowest: 0, limit: 0, gunships: 0 };
    for (let wins = 30; wins < 40; wins++) {
      const mission = swarm(wins);
      tally.gunships += all(wins).filter((id) => id === 'gunship').length;
      let rounds = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const build = REFERENCE_BUILDS[frame];
        const mods = grown ? { ...PERKS, tune: Object.fromEntries(Object.values(build).map((part) => [part, tuneCap(0)])) } : undefined;
        const end = playMission(build, mission, ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: (mission.scale ?? 1) * difficulty, ...(mods ? { mods } : {}) });
        tally.battles++;
        if (end.outcome === 'victory') tally.won++;
        if (end.round >= ROUND_LIMIT) tally.limit++;
        rounds += end.round;
      }
      tally.rounds += rounds;
      tally.slowest = Math.max(tally.slowest, rounds / 6);
    }
    return { ...tally, rounds: tally.rounds / tally.battles };
  };

  test('there are gunships in them', () => {
    expect(flown('tier5', 1, false).gunships).toBeGreaterThanOrEqual(15);
  });

  test.each([['standard', DIFFICULTY_SCALE.standard], ['veteran', DIFFICULTY_SCALE.veteran]] as [string, number][])('on %s: every frame of that stage wins them, and none ever meets the clock', (_name, difficulty) => {
    for (const [frame, grown] of [['tier5', false], ['tier6', false], ['tier6', true]] as [string, boolean][]) {
      const seen = flown(frame, difficulty, grown);
      expect(seen.won / seen.battles, `${frame}${grown ? ' grown' : ''}`).toBeGreaterThanOrEqual(0.97);
      expect(seen.limit, `${frame}${grown ? ' grown' : ''}`).toBe(0);
    }
  });

  test('a grown pilot runs through them on Veteran as on Standard: under ten rounds, the slowest swarm under twelve', () => {
    for (const difficulty of [DIFFICULTY_SCALE.standard, DIFFICULTY_SCALE.veteran]) {
      const grown = flown('tier6', difficulty, true);
      expect(grown.rounds, `x${difficulty}`).toBeLessThan(10);
      expect(grown.slowest, `x${difficulty}`).toBeLessThan(12);
      const quick = flown('tier5', difficulty, false);
      expect(quick.rounds, `x${difficulty}`).toBeLessThan(5);
    }
  });

  test('the heaviest frame as it is sold is slow at them and says why: it is hot and it misses what flies, gunships or no', () => {
    // On Standard ten rounds; on Veteran, where a gunship no longer falls to one hit of its lance, under twenty.
    expect(flown('tier6', DIFFICULTY_SCALE.standard, false).rounds).toBeLessThan(12);
    const veteran = flown('tier6', DIFFICULTY_SCALE.veteran, false);
    expect(veteran.rounds).toBeLessThan(18);
    expect(veteran.slowest).toBeLessThan(24);
  });
});
