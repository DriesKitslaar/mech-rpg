import { activeUnit, applyAction, checkAction, type Action, type BattleState } from '../../src/core/battle';
import {
  ENEMY_COST, MECH_ENEMIES, PAY_PER_BATTLE, PAY_PER_POINT, POOL, STORY_ENEMIES, SUPPORT_ENEMIES, SWARM_KINDS, boardTier, budgetFor, generateBoard, isSwarm,
  scaleFor, swarmContract,
} from '../../src/core/board';
import { startNewCycle } from '../../src/core/campaign';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import {
  HIT_MARK, JOB, JOB_KINDS, JOB_NUMBERS, JOB_TIER, MENDERS, isJob, jobContract, jobKind, jobsWon, kindsOfJob, makeJob, recordJob, type JobKind,
} from '../../src/core/jobs';
import { startMissionBattle } from '../../src/core/mission';
import { WEAPON_SLOTS } from '../../src/core/types';
import { missionPar } from '../../src/core/rank';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { BRIEFING_CHARS, briefingRows } from '../../src/ui/briefingScreen';
import { wrap } from '../../src/ui/widgets';
import { done } from '../helpers/app';

/**
 * The job on offer beside the board: one more open contract, which asks for something other than
 * everything on the field destroyed. Four kinds, turning in order.
 */

const job = (wins: number, cycle = 0) => jobContract(wins, cycle, BOARD_TEXT);
const cost = (ids: string[]): number => ids.reduce((sum, id) => sum + ENEMY_COST[id], 0);
const rounded = (fee: number): number => Math.round(fee / 50) * 50;
/** Every progress a pilot can have, near enough: battles won in four tellings. */
const everywhere = (): { wins: number; cycle: number }[] =>
  [0, 1, 2, 3].flatMap((cycle) => Array.from({ length: 401 }, (_, wins) => ({ wins, cycle })));
/** Every job there is for those. */
const jobs = () => everywhere().flatMap(({ wins, cycle }) => { const made = job(wins, cycle); return made ? [{ wins, cycle, mission: made }] : []; });
const of = (kind: JobKind) => jobs().filter(({ mission }) => mission.job === kind);

describe('which job is on offer', () => {
  test('there are four kinds, and they turn in order: one step for every battle won, and a later telling begins one step on', () => {
    expect(JOB_KINDS).toEqual(['hit', 'repo', 'escort', 'hold']);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((wins) => jobKind(wins, 0))).toEqual(['hit', 'repo', 'escort', 'hold', 'hit', 'repo', 'escort', 'hold', 'hit']);
    expect([0, 1, 2, 3].map((cycle) => jobKind(0, cycle))).toEqual(['hit', 'repo', 'escort', 'hold']);
    expect(jobKind(7, 2)).toBe('repo');
    // Four battles won, one after another, have shown all four.
    for (let wins = 5; wins < 60; wins++) expect(new Set([0, 1, 2, 3].map((more) => job(wins + more)!.job)).size).toBe(4);
  });

  test('there is none until the board has reached its first tier', () => {
    expect(JOB_TIER).toBe(1);
    expect([0, 1, 2, 3, 4].map((wins) => job(wins))).toEqual([null, null, null, null, null]);
    expect(boardTier(4, 0)).toBe(0);
    expect(boardTier(5, 0)).toBe(1);
    expect(job(5)).not.toBeNull();
    // A later telling starts with a board that has grown already.
    expect(job(0, 1)).not.toBeNull();
    for (const { wins, cycle } of everywhere()) expect(job(wins, cycle) !== null, `${wins}/${cycle}`).toBe(boardTier(wins, cycle) >= JOB_TIER);
  });

  test('the job is the same every time for the same progress, and changes with it', () => {
    expect(job(7)).toEqual(job(7));
    expect(job(27)).toEqual(job(27));
    // The same kind four battles on, and another job.
    expect(job(11)!.job).toBe(job(7)!.job);
    expect(job(11)!.battles).not.toEqual(job(7)!.battles);
    expect(job(7, 1)).not.toEqual(job(7, 0));
    // The words it is written with are left as they were.
    const before = JSON.stringify(BOARD_TEXT);
    jobs();
    expect(JSON.stringify(BOARD_TEXT)).toBe(before);
  });

  test('it is an open contract of one battle, known by its id, and the board and the swarm beside it are what they were', () => {
    for (const { wins, cycle, mission } of jobs()) {
      expect(mission.id).toBe(`open-${cycle}-${wins}-${JOB}`);
      expect(isJob(mission)).toBe(true);
      expect(isSwarm(mission)).toBe(false);
      expect(mission.phase).toBe('patrol');
      expect(mission.battles).toHaveLength(1);
      expect(mission.asks).toBeUndefined();
      expect(BOARD_TEXT.clients).toContain(mission.client);
      expect(BOARD_TEXT.debriefs).toContain(mission.debrief);
      expect(mission.battles[0].background in SPRITES).toBe(true);
      expect(BOARD_TEXT.jobs[mission.job!].titles).toContain(mission.title);
    }
    expect(JOB).toBe('job');
    for (const id of ['open-0-5-swarm', 'open-0-5-0', 'open-0-5-2', 'job', 'bounty-1-job', 'open-0-5-jobs', 'open-0-5-oddjob', '']) expect(isJob({ id }), id).toBe(false);
    for (const mission of [...generateBoard(30, 0, BOARD_TEXT), swarmContract(30, 0, BOARD_TEXT)]) {
      expect(isJob(mission)).toBe(false);
      expect(mission.job).toBeUndefined();
    }
    // A client with a face is briefed under it, as on the board.
    const faced = jobs().filter(({ mission }) => mission.client === 'Dispatch');
    expect(faced.length).toBeGreaterThan(10);
    for (const { mission } of faced) expect(mission.portrait).toBe('portrait-dispatch');
    for (const { mission } of jobs().filter((made) => made.mission.client !== 'Dispatch')) expect(mission.portrait).toBeUndefined();
  });

  test('every title, every client and every place comes up, for each kind', () => {
    for (const kind of JOB_KINDS) {
      const made = of(kind).map(({ mission }) => mission);
      expect(new Set(made.map((mission) => mission.title)).size, kind).toBe(BOARD_TEXT.jobs[kind].titles.length);
      expect(new Set(made.map((mission) => mission.client)).size, kind).toBe(BOARD_TEXT.clients.length);
      expect(new Set(made.map((mission) => mission.battles[0].background)).size, kind).toBe(BOARD_TEXT.backgrounds.length);
    }
  });

  test('the rules take every one of them, and its briefing fits its panel', () => {
    for (const { mission } of jobs()) {
      const [battle] = mission.battles;
      expect(battle.enemies.length).toBeGreaterThanOrEqual(1);
      expect(battle.enemies.length).toBeLessThanOrEqual(3);
      for (const id of [...battle.enemies, ...(battle.reserve ?? [])]) {
        expect(ENEMIES[id], id).toBeDefined();
        expect(STORY_ENEMIES).not.toContain(id);
      }
      expect(battle.enemies.filter((id) => MECH_ENEMIES.includes(id)).length).toBeLessThanOrEqual(1);
      expect(battle.enemies.filter((id) => SUPPORT_ENEMIES.includes(id)).length).toBeLessThanOrEqual(1);
      // Started, as the game would start it: a battle the rules refuse throws here.
      const state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3, undefined, { enemyScale: mission.scale });
      expect(state.outcome).toBe('ongoing');
      expect(state.objective.type).not.toBe('destroy');
      let y = 0;
      for (const paragraph of mission.briefing) {
        for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
          expect(y, `briefing of ${mission.id} is too long`).toBeLessThanOrEqual((briefingRows(mission) - 1) * 11);
          y += 11;
        }
        y += 4;
      }
    }
  });
});

describe('a hit', () => {
  const hits = () => of('hit');

  test('names the dearest machine that fights, of two or more, and is over when that one falls', () => {
    for (const { wins, cycle, mission } of hits()) {
      const [battle] = mission.battles;
      const budget = budgetFor(boardTier(wins, cycle));
      expect(battle.enemies.length, mission.id).toBeGreaterThanOrEqual(2);
      // Rolled on the board's budget; a lone machine is given a drone for company, which is one point more at most.
      expect(cost(battle.enemies)).toBeLessThanOrEqual(budget + 1);
      if (cost(battle.enemies) > budget) expect(battle.enemies).toEqual([battle.enemies[0], 'recon-drone']);
      // Nothing in it mends: what is taken off the named machine stays off.
      expect(MENDERS).toEqual(['repair-drone']);
      for (const id of battle.enemies) expect(MENDERS).not.toContain(id);
      expect(battle.objective?.type).toBe('leader');
      const target = (battle.objective as { target: number }).target;
      const named = battle.enemies[target];
      expect(SUPPORT_ENEMIES).not.toContain(named);
      const fighters = battle.enemies.filter((id) => !SUPPORT_ENEMIES.includes(id));
      expect(ENEMY_COST[named]).toBe(Math.max(...fighters.map((id) => ENEMY_COST[id])));
      // The first of them, where two cost the same.
      expect(battle.enemies.findIndex((id) => !SUPPORT_ENEMIES.includes(id) && ENEMY_COST[id] === ENEMY_COST[named])).toBe(target);
    }
    // Early on a helper can cost more than what it helps: it is still not the one named.
    const early = Array.from({ length: 400 }, (_, seed) => makeJob('hit', 1, seed + 1, BOARD_TEXT).battles[0]);
    const outbid = early.filter((battle) => battle.enemies.some((id) => SUPPORT_ENEMIES.includes(id) && ENEMY_COST[id] > ENEMY_COST[battle.enemies[(battle.objective as { target: number }).target]]));
    expect(outbid.length).toBeGreaterThan(0);
    for (const battle of early) {
      expect(battle.enemies.length).toBeGreaterThanOrEqual(2);
      expect(SUPPORT_ENEMIES).not.toContain(battle.enemies[(battle.objective as { target: number }).target]);
    }
    // And a lone machine, which a small budget sometimes buys, has a drone beside it.
    expect(early.some((battle) => cost(battle.enemies) > budgetFor(1))).toBe(true);
    // The other helpers of the board still fly with a named machine; and where the board's roll had a mender in it, what is left is the hit.
    const late = Array.from({ length: 600 }, (_, seed) => makeJob('hit', 8, seed + 1, BOARD_TEXT).battles[0]);
    for (const helper of SUPPORT_ENEMIES.filter((id) => !MENDERS.includes(id))) expect(late.some((battle) => battle.enemies.includes(helper)), helper).toBe(true);
    expect(late.every((battle) => !battle.enemies.includes('repair-drone'))).toBe(true);
    expect(late.every((battle) => battle.enemies.length >= 2 && battle.enemies.length <= 3)).toBe(true);
  });

  test('its machine is overclocked and nothing else is marked; the job is harder than the board by its own scale', () => {
    expect(HIT_MARK).toBe('overclocked');
    expect(JOB_NUMBERS.hitScale).toBe(1.1);
    for (const { wins, cycle, mission } of hits()) {
      const [battle] = mission.battles;
      const target = (battle.objective as { target: number }).target;
      expect(battle.marks).toEqual({ [target]: 'overclocked' });
      expect(mission.elite).toBe('overclocked');
      expect(mission.scale).toBeCloseTo(scaleFor(boardTier(wins, cycle)) * 1.1, 10);
      const state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
      expect(state.units.filter((unit) => unit.mark).map((unit) => [unit.id, unit.mark])).toEqual([[`enemy-${target}`, 'overclocked']]);
      // A fight about one machine is not an open battle.
      expect(state.open).toBe(false);
    }
  });

  test('pays for the machine it names and for nothing else, to the nearest fifty, and is to be done in six rounds', () => {
    expect(JOB_NUMBERS).toMatchObject({ hitPay: 500, hitPar: 6 });
    for (const { mission } of hits()) {
      const [battle] = mission.battles;
      const named = battle.enemies[(battle.objective as { target: number }).target];
      expect(mission.reward).toBe(500 * ENEMY_COST[named] + PAY_PER_BATTLE);
      expect(mission.reward % 50).toBe(0);
      expect(missionPar(mission)).toBe(6);
      expect(mission.briefing).toHaveLength(2);
      expect(mission.briefing[1]).toBe(BOARD_TEXT.jobs.hit.brief);
      expect(BOARD_TEXT.places).toContain(mission.briefing[0]);
    }
  });

  test('is won the moment its machine is destroyed, whatever else stands', () => {
    const mission = hits().map((made) => made.mission).find((made) => made.battles[0].enemies.length === 3)!;
    const target = (mission.battles[0].objective as { target: number }).target;
    const state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
    const named = state.units.find((unit) => unit.id === `enemy-${target}`)!;
    for (const part of Object.values(named.parts)) if (part) part.ap = 1;
    const won = finish(state, named.id);
    expect(won.outcome).toBe('victory');
    expect(won.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed).length).toBe(2);
  });
});

/**
 * Plays the pilot's turns as shots at one part of one machine with everything that will fire, and everybody
 * else's as nothing at all, until the battle ends or that part is gone (or, for the core, sixty turns have passed).
 */
function finish(start: BattleState, targetId: string, part: 'core' | 'legs' | 'arms' = 'core'): BattleState {
  let state = start;
  const gone = (s: BattleState): boolean => { const hit = s.units.find((unit) => unit.id === targetId)!.parts[part]; return !hit || hit.ap <= 0; };
  for (let turn = 0; turn < 60 && state.outcome === 'ongoing' && !gone(state); turn++) {
    const unit = activeUnit(state);
    if (unit.side === 'player') {
      for (const weapon of WEAPON_SLOTS) {
        const shot: Action = { type: 'fire', weapon, target: targetId, part };
        if (state.outcome === 'ongoing' && !gone(state) && activeUnit(state).id === unit.id && checkAction(state, shot, CATALOG) === null) state = applyAction(state, shot, CATALOG);
      }
    }
    if (state.outcome === 'ongoing' && activeUnit(state).id === unit.id) state = applyAction(state, { type: 'endTurn' }, CATALOG);
  }
  return state;
}

describe('a repossession', () => {
  const repos = () => of('repo');

  test('names a mech of the board, first on the field, with what the budget leaves in machines that are not', () => {
    const mechs = new Set<string>();
    for (const { wins, cycle, mission } of repos()) {
      const [battle] = mission.battles;
      const budget = budgetFor(boardTier(wins, cycle));
      const [mech, ...rest] = battle.enemies;
      mechs.add(mech);
      expect(MECH_ENEMIES).toContain(mech);
      expect(POOL).toContain(mech);
      expect(battle.objective).toEqual({ type: 'disable', target: 0 });
      // It has something to lose that is not its core.
      expect(!!ENEMIES[mech].build.legs || !!ENEMIES[mech].build.arms).toBe(true);
      expect(rest.length).toBeLessThanOrEqual(2);
      for (const id of rest) expect(MECH_ENEMIES).not.toContain(id);
      expect(cost(battle.enemies)).toBeLessThanOrEqual(budget);
      // What is left of the budget would not have bought another, unless two stand with it already.
      const left = budget - cost(battle.enemies);
      const helped = rest.some((id) => SUPPORT_ENEMIES.includes(id));
      const could = POOL.filter((id) => !MECH_ENEMIES.includes(id) && ENEMY_COST[id] <= left && !(helped && SUPPORT_ENEMIES.includes(id)));
      if (rest.length < 2) expect(could, mission.id).toEqual([]);
      expect(battle.marks).toBeUndefined();
      expect(mission.elite).toBeUndefined();
      expect(mission.scale).toBe(scaleFor(boardTier(wins, cycle)));
    }
    // Every mech the board fields is wanted back sooner or later.
    expect([...mechs].sort()).toEqual(POOL.filter((id) => MECH_ENEMIES.includes(id)).sort());
  });

  test('pays what the board would for the same machines and a third as much again on top, less a little: thirty-five in the hundred', () => {
    expect(JOB_NUMBERS.repoPay).toBe(0.35);
    for (const { mission } of repos()) {
      const [battle] = mission.battles;
      expect(mission.reward).toBe(rounded((PAY_PER_POINT * cost(battle.enemies) + PAY_PER_BATTLE) * 1.35));
      expect(mission.briefing).toEqual([expect.any(String), BOARD_TEXT.jobs.repo.brief, BOARD_TEXT.threats[battle.enemies[0]]]);
      expect(BOARD_TEXT.places).toContain(mission.briefing[0]);
      // Rounds a good pilot needs: as for any battle of so many.
      expect(missionPar(mission)).toBe(3 + 2 * battle.enemies.length);
    }
  });

  test('is won with its arms and legs gone and its core whole, and lost if it is destroyed', () => {
    const mission = repos().map((made) => made.mission).find((made) => made.battles[0].enemies.length > 1)!;
    const start = (): BattleState => startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
    const weak = (state: BattleState): BattleState => {
      for (const part of Object.values(state.units.find((unit) => unit.id === 'enemy-0')!.parts)) if (part) part.ap = 1;
      return state;
    };
    const lost = finish(weak(start()), 'enemy-0', 'core');
    expect(lost.outcome).toBe('defeat');
    expect(lost.units.find((unit) => unit.id === 'enemy-0')!.destroyed).toBe(true);
    let state = finish(weak(start()), 'enemy-0', 'legs');
    expect(state.outcome).toBe('ongoing');
    state = finish(state, 'enemy-0', 'arms');
    expect(state.outcome).toBe('victory');
    const wanted = state.units.find((unit) => unit.id === 'enemy-0')!;
    expect(wanted.destroyed).toBe(false);
    expect(state.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed).length).toBeGreaterThan(1);
  });
});

describe('an escort', () => {
  const escorts = () => of('escort');

  test('is the board\'s kind of battle with freight in it: named for the place, taking what the machines against it cost', () => {
    expect(JOB_NUMBERS).toMatchObject({ escortPoint: 1.5, escortFlat: 2 });
    expect(BOARD_TEXT.assets).toHaveLength(BOARD_TEXT.backgrounds.length);
    for (const { wins, cycle, mission } of escorts()) {
      const [battle] = mission.battles;
      expect(cost(battle.enemies)).toBeLessThanOrEqual(budgetFor(boardTier(wins, cycle)));
      const place = BOARD_TEXT.backgrounds.indexOf(battle.background);
      expect(battle.objective).toEqual({ type: 'protect', name: BOARD_TEXT.assets[place], hp: Math.ceil(1.5 * cost(battle.enemies)) + 2 });
      expect(mission.briefing[0]).toBe(BOARD_TEXT.places[place]);
      expect(mission.scale).toBe(scaleFor(boardTier(wins, cycle)));
      expect(battle.marks).toBeUndefined();
      expect(battle.reserve).toBeUndefined();
    }
    // What it can take: five for a pair of drones, fourteen for the heaviest field.
    const taken = escorts().map(({ mission }) => (mission.battles[0].objective as { hp: number }).hp);
    expect(Math.min(...taken)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...taken)).toBe(14);
  });

  test('pays what the board would for the same machines and two fifths on top', () => {
    expect(JOB_NUMBERS.escortPay).toBe(0.4);
    for (const { mission } of escorts()) {
      const [battle] = mission.battles;
      expect(mission.reward).toBe(rounded((PAY_PER_POINT * cost(battle.enemies) + PAY_PER_BATTLE) * 1.4));
      const dearest = battle.enemies.reduce((a, b) => (ENEMY_COST[b] > ENEMY_COST[a] ? b : a));
      expect(mission.briefing).toEqual([expect.any(String), BOARD_TEXT.jobs.escort.brief, BOARD_TEXT.threats[dearest]]);
    }
  });

  test('the freight loses one for every machine standing as a round begins: lost when it is gone, won when they are', () => {
    const mission = escorts().map((made) => made.mission).find((made) => made.battles[0].enemies.length === 3)!;
    const hp = (mission.battles[0].objective as { hp: number }).hp;
    let state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
    expect(state.asset).toEqual({ name: (mission.battles[0].objective as { name: string }).name, hp, maxHp: hp });
    // Nobody shoots: three a round from the second round on.
    const idle = (s: BattleState): BattleState => { let next = s; const round = next.round; while (next.outcome === 'ongoing' && next.round === round) next = applyAction(next, { type: 'endTurn' }, CATALOG); return next; };
    for (const unit of state.units) if (unit.side === 'enemy') for (const slot of Object.keys(unit.ammo)) unit.ammo[slot as keyof typeof unit.ammo] = 0;
    state = idle(state);
    expect(state.asset!.hp).toBe(hp - 3);
    while (state.outcome === 'ongoing') state = idle(state);
    expect(state.outcome).toBe('defeat');
    expect(state.asset!.hp).toBe(0);
    expect(state.round).toBe(1 + Math.ceil(hp / 3));
  });
});

describe('a holding action', () => {
  const holds = () => of('hold');

  test('is rolled on a budget two over the board\'s, with four light machines behind it, at half as much again of the board\'s scale', () => {
    expect(JOB_NUMBERS).toMatchObject({ holdRounds: 6, holdBudget: 2, holdReserve: 4, holdScale: 1.5 });
    let over = 0;
    for (const { wins, cycle, mission } of holds()) {
      const tier = boardTier(wins, cycle);
      const [battle] = mission.battles;
      expect(cost(battle.enemies)).toBeLessThanOrEqual(budgetFor(tier) + 2);
      if (cost(battle.enemies) > budgetFor(tier)) over += 1;
      expect(battle.objective).toEqual({ type: 'survive', rounds: 6 });
      expect(battle.reserve).toHaveLength(4);
      const light = [...SWARM_KINDS].reverse().find((entry) => tier >= entry.from)!.kinds;
      for (const id of battle.reserve!) expect(light).toContain(id);
      expect(mission.scale).toBeCloseTo(scaleFor(tier) * 1.5, 10);
      expect(battle.marks).toBeUndefined();
      // The rounds it lasts are the rounds a good pilot needs.
      expect(missionPar(mission)).toBe(6);
      // A briefing lists five kinds of machine and no more: a holding action never brings a sixth.
      expect(new Set([...battle.enemies, ...battle.reserve!]).size).toBeLessThanOrEqual(5);
    }
    // Most of them field more than the board could.
    expect(over).toBeGreaterThan(holds().length / 2);
    // Late on, gunships are among those behind.
    expect(holds().some(({ mission }) => mission.battles[0].reserve!.includes('gunship'))).toBe(true);
    expect(holds().filter(({ wins, cycle }) => boardTier(wins, cycle) < 3).every(({ mission }) => mission.battles[0].reserve!.every((id) => id === 'recon-drone'))).toBe(true);
  });

  test('pays for the rounds and not the machines: the board\'s fee for a battle on the board\'s own budget, and a quarter on top', () => {
    expect(JOB_NUMBERS.holdPay).toBe(0.25);
    for (const { wins, cycle, mission } of holds()) {
      expect(mission.reward).toBe(rounded((PAY_PER_POINT * budgetFor(boardTier(wins, cycle)) + PAY_PER_BATTLE) * 1.25));
      const [battle] = mission.battles;
      const dearest = battle.enemies.reduce((a, b) => (ENEMY_COST[b] > ENEMY_COST[a] ? b : a));
      expect(mission.briefing).toEqual([expect.any(String), BOARD_TEXT.jobs.hold.brief, BOARD_TEXT.threats[dearest]]);
    }
    expect(holds().find(({ wins, cycle }) => boardTier(wins, cycle) === 8)!.mission.reward).toBe(2750);
    expect(holds().find(({ wins, cycle }) => boardTier(wins, cycle) === 1)!.mission.reward).toBe(1200);
  });

  test('is won when the sixth round is over, with machines still on the field and still to come; and the first of those behind come on as room is made', () => {
    // A field of three that stays three when left alone: nothing on it that goes off by itself or launches more.
    const quiet = (ids: string[]): boolean => ids.length === 3 && !ids.some((id) => ['bomb-crawler', 'carrier'].includes(id));
    const mission = holds().map((made) => made.mission).find((made) => quiet(made.battles[0].enemies))!;
    let state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
    expect(state.reserve).toHaveLength(4);
    for (const unit of state.units) if (unit.side === 'enemy') for (const slot of Object.keys(unit.ammo)) unit.ammo[slot as keyof typeof unit.ammo] = 0;
    const rounds: number[] = [];
    while (state.outcome === 'ongoing') { rounds.push(state.round); state = applyAction(state, { type: 'endTurn' }, CATALOG); }
    expect(state.outcome).toBe('victory');
    expect(Math.max(...rounds)).toBe(6);
    expect(state.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed).length).toBe(3);
    expect(state.reserve).toHaveLength(4);
    // One brought down: the first of the reserve stands in its place when the next round begins.
    state = startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 3);
    for (const part of Object.values(state.units.find((unit) => unit.id === 'enemy-0')!.parts)) if (part) part.ap = 1;
    state = finish(state, 'enemy-0');
    expect(state.units.find((unit) => unit.id === 'enemy-0')!.destroyed).toBe(true);
    // By the time the round after it has begun, whoever's turn the round ended on.
    const fallen = state.round;
    while (state.outcome === 'ongoing' && state.round <= fallen) state = applyAction(state, { type: 'endTurn' }, CATALOG);
    expect(state.reserve).toHaveLength(3);
    expect(state.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed).map((unit) => unit.kind)).toContain(mission.battles[0].reserve![0]);
    expect(state.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed)).toHaveLength(3);
  });
});

describe('other numbers', () => {
  test('a job is made from the numbers it is given', () => {
    const numbers = { ...JOB_NUMBERS, hitScale: 2, hitPay: 100, hitPar: 9, repoPay: 1, escortPoint: 1, escortFlat: 0, escortPay: 0, holdRounds: 4, holdBudget: 0, holdReserve: 2, holdScale: 3, holdPay: 0 };
    const hit = makeJob('hit', 4, 11, BOARD_TEXT, numbers);
    expect(hit.scale).toBe(2);
    expect(hit.battles[0].par).toBe(9);
    expect(hit.reward).toBe(100 * ENEMY_COST[hit.battles[0].enemies[(hit.battles[0].objective as { target: number }).target]] + PAY_PER_BATTLE);
    const repo = makeJob('repo', 4, 11, BOARD_TEXT, numbers);
    expect(repo.reward).toBe(rounded((PAY_PER_POINT * cost(repo.battles[0].enemies) + PAY_PER_BATTLE) * 2));
    const escort = makeJob('escort', 4, 11, BOARD_TEXT, numbers);
    expect((escort.battles[0].objective as { hp: number }).hp).toBe(cost(escort.battles[0].enemies));
    expect(escort.reward).toBe(rounded(PAY_PER_POINT * cost(escort.battles[0].enemies) + PAY_PER_BATTLE));
    const hold = makeJob('hold', 4, 11, BOARD_TEXT, numbers);
    expect(hold.battles[0]).toMatchObject({ objective: { type: 'survive', rounds: 4 } });
    expect(hold.battles[0].reserve).toHaveLength(2);
    expect(cost(hold.battles[0].enemies)).toBeLessThanOrEqual(budgetFor(4));
    expect(hold.scale).toBe(3);
    expect(hold.reward).toBe(PAY_PER_POINT * budgetFor(4) + PAY_PER_BATTLE);
    // The same seed and the same numbers: the same job; the job on offer is one of these with an id.
    expect(makeJob('hold', 4, 11, BOARD_TEXT, numbers)).toEqual(hold);
    const { id, ...offered } = job(21)!;
    expect(id).toBe('open-0-21-job');
    expect(offered).toEqual(makeJob(jobKind(21, 0), boardTier(21, 0), 22 * 86028121 + 41, BOARD_TEXT));
    // Other numbers reach the job on offer as they reach one made by hand.
    const { id: _same, ...slow } = jobContract(23, 0, BOARD_TEXT, numbers)!;
    expect(jobKind(23, 0)).toBe('hold');
    expect(slow).toEqual(makeJob('hold', boardTier(23, 0), 24 * 86028121 + 41, BOARD_TEXT, numbers));
    expect(slow.battles[0].objective).toEqual({ type: 'survive', rounds: 4 });
    // In a later telling the dice are other dice.
    const { id: later, ...second } = job(21, 1)!;
    expect(later).toBe('open-1-21-job');
    expect(second).toEqual(makeJob(jobKind(21, 1), boardTier(21, 1), 22 * 86028121 + 49979693 + 41, BOARD_TEXT));
    expect(second).not.toEqual(makeJob(jobKind(21, 1), boardTier(21, 1), 22 * 86028121 + 41, BOARD_TEXT));
  });
});

describe('jobs won', () => {
  const game = () => newGame(CATALOG, STARTER_BUILD);

  test('are counted by their kind', () => {
    let state = game();
    expect(state.jobs).toBeUndefined();
    expect(jobsWon(state)).toBe(0);
    expect(kindsOfJob(state)).toBe(0);
    state = recordJob(state, 'hit');
    state = recordJob(state, 'hit');
    state = recordJob(state, 'hold');
    expect(state.jobs).toEqual({ hit: 2, hold: 1 });
    expect([jobsWon(state, 'hit'), jobsWon(state, 'repo'), jobsWon(state, 'escort'), jobsWon(state, 'hold')]).toEqual([2, 0, 0, 1]);
    expect(jobsWon(state)).toBe(3);
    expect(kindsOfJob(state)).toBe(2);
    for (const kind of JOB_KINDS) state = recordJob(state, kind);
    expect(kindsOfJob(state)).toBe(4);
    expect(jobsWon(state)).toBe(7);
  });

  test('recording one changes nothing else and leaves the game it was given as it was', () => {
    const before = game();
    const after = recordJob(before, 'escort');
    expect(before.jobs).toBeUndefined();
    expect({ ...after, jobs: undefined }).toEqual({ ...before, jobs: undefined });
    const again = recordJob(after, 'escort');
    expect(after.jobs).toEqual({ escort: 1 });
    expect(again.jobs).toEqual({ escort: 2 });
  });

  test('they are saved with the game, kept when the story starts over, and a game from before the board had jobs loads as it was', () => {
    const kept = recordJob(recordJob(game(), 'repo'), 'hold');
    expect(isValidState(JSON.parse(JSON.stringify(kept)), CATALOG)).toBe(true);
    expect(JSON.parse(JSON.stringify(kept)).jobs).toEqual({ repo: 1, hold: 1 });
    const before = JSON.parse(JSON.stringify(game()));
    expect('jobs' in before).toBe(false);
    expect(isValidState(before, CATALOG)).toBe(true);
    const story = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.id !== 'verdict-default' && m.id !== 'verdict-quorum').map((m) => m.id);
    const again = startNewCycle({ ...done(...story), jobs: { repo: 1, hold: 1 } }, MISSIONS);
    expect(again.cycle).toBe(1);
    expect(again.jobs).toEqual({ repo: 1, hold: 1 });
  });

  test('what is read from storage is checked: counts are whole and not negative, names are plain, and a kind a later version might add is kept and not counted', () => {
    const stored = (value: unknown) => isValidState({ ...JSON.parse(JSON.stringify(game())), jobs: value }, CATALOG);
    expect(stored({ hit: 3, hold: 0 })).toBe(true);
    expect(stored({})).toBe(true);
    for (const bad of [{ hit: -1 }, { hit: 1.5 }, { hit: '3' }, { hit: null }, { hit: 1_000_001 }, { 'Hit!': 1 }, { '': 1 }, [1, 2], 'hit', 7, null]) {
      expect(stored(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(stored({ hit: 1_000_000 })).toBe(true);
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`kind${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`, 1]));
    expect([stored(many(32)), stored(many(33))]).toEqual([true, false]);
    const later = { ...game(), jobs: { hit: 2, heist: 9 } } as unknown as GameState;
    expect(isValidState(JSON.parse(JSON.stringify(later)), CATALOG)).toBe(true);
    expect([jobsWon(later, 'hit'), jobsWon(later), kindsOfJob(later)]).toEqual([2, 2, 1]);
    // The count of machines flown is checked as it was: one bad list does not hide behind a good one.
    const both = (wonAs: unknown, jobs: unknown) => isValidState({ ...JSON.parse(JSON.stringify(game())), wonAs, jobs }, CATALOG);
    expect([both({ duellist: 1 }, { hit: 1 }), both({ duellist: -1 }, { hit: 1 }), both({ duellist: 1 }, { hit: -1 })]).toEqual([true, false, false]);
  });

  test('a count that is no count reads as none, and a kind nobody knows is not counted', () => {
    const odd = { jobs: { hit: -2, repo: 1.5, escort: 'many', hold: 3, heist: 9 } } as unknown as Parameters<typeof jobsWon>[0];
    expect(JOB_KINDS.map((kind) => jobsWon(odd, kind))).toEqual([0, 0, 0, 3]);
    expect(jobsWon(odd)).toBe(3);
    expect(kindsOfJob(odd)).toBe(1);
    // Nothing inherited counts as a job.
    expect(jobsWon({ jobs: Object.create({ hit: 5 }) as never }, 'hit')).toBe(0);
    expect(recordJob(odd, 'hit').jobs).toMatchObject({ hit: 1, hold: 3 });
  });
});
