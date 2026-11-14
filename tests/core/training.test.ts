import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { checkAction, createBattle, type Action, type BattleState } from '../../src/core/battle';
import { validatePlayerBuild } from '../../src/core/build';
import { completeMission } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { DRILL_PAY, drillMission, drillOpen, drillPassed, drillSettlement, isDrill, recordDrill } from '../../src/core/training';
import { WEAPON_SLOTS, type Catalog } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import SPRITES from '../../src/content/sprites.json';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, objectiveLines } from '../../src/ui/briefingScreen';
import { charsFor, wrap } from '../../src/ui/widgets';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const AIM = DRILLS[0];

describe('a drill', () => {
  test('is a contract of one battle in a lent mech, which pays once', () => {
    const mission = drillMission(fresh(), AIM, 'Training Simulator');
    expect(mission).toMatchObject({ id: 'drill-aim', title: AIM.title, client: 'Training Simulator', reward: DRILL_PAY, scale: 0.8, phase: 'patrol' });
    expect(mission.battles).toEqual([AIM.battle]);
    expect(mission.loaner).toEqual(AIM.build);
    expect(isDrill(mission)).toBe(true);
    expect(isDrill(MISSIONS[0])).toBe(false);
    expect(drillMission({ ...fresh(), drills: ['drill-aim'] }, AIM, 'x').reward).toBe(0);
  });

  test('is settled without a bill: the simulator pays what the drill still pays, or nothing', () => {
    const mission = drillMission(fresh(), AIM, 'x');
    expect(drillSettlement(true, mission)).toEqual({ won: true, reward: 150, ammoCost: 0, repairCost: 0, net: 150, lines: [] });
    expect(drillSettlement(false, mission)).toEqual({ won: false, reward: 0, ammoCost: 0, repairCost: 0, net: 0, lines: [] });
  });

  test('passed for the first time pays and is remembered; again, or failed, changes nothing', () => {
    const g = fresh();
    const mission = drillMission(g, AIM, 'x');
    const passed = recordDrill(g, drillSettlement(true, mission), mission);
    expect(passed).toMatchObject({ credits: g.credits + 150, drills: ['drill-aim'] });
    expect(drillPassed(passed, 'drill-aim')).toBe(true);
    expect(g.drills).toEqual([]);
    const again = drillMission(passed, AIM, 'x');
    expect(recordDrill(passed, drillSettlement(true, again), again)).toBe(passed);
    expect(recordDrill(g, drillSettlement(false, mission), mission)).toBe(g);
  });

  test('opens when the story has got as far as it asks', () => {
    const later = DRILLS.find((drill) => drill.after === 'intro-2')!;
    expect(drillOpen(fresh(), AIM, MISSIONS)).toBe(true);
    expect(drillOpen(fresh(), later, MISSIONS)).toBe(false);
    expect(drillOpen(completeMission(fresh(), 'intro-2', MISSIONS), later, MISSIONS)).toBe(true);
  });
});

describe('the drills', () => {
  test('are ten, each with an id of its own, and three are open from the start', () => {
    expect(DRILLS).toHaveLength(10);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(10);
    for (const drill of DRILLS) expect(drill.id).toMatch(/^drill-[a-z]+$/);
    expect(DRILLS.filter((d) => d.after === 'start').map((d) => d.id)).toEqual(['drill-aim', 'drill-heat', 'drill-boost']);
    const known = new Set(['start', 'choice', 'finale', 'verdict', ...MISSIONS.map((m) => m.id)]);
    for (const drill of DRILLS) expect(known.has(drill.after), drill.id).toBe(true);
  });

  test.each(DRILLS.map((d) => [d.id, d] as const))('%s lends a mech that may deploy, against enemies that exist, with words that fit', (_id, drill) => {
    expect(validatePlayerBuild(drill.build, CATALOG)).toEqual([]);
    for (const part of Object.values(drill.build)) expect(CATALOG[part].vendor, part).toBeDefined();
    for (const id of drill.battle.enemies) expect(Object.hasOwn(ALL_ENEMIES, id), id).toBe(true);
    // The simulator has a hall of its own, and there is a picture of it.
    expect(drill.battle.background).toBe('bg-simulator');
    expect(drill.battle.background in SPRITES).toBe(true);
    expect(drill.title.length).toBeLessThanOrEqual(19);
    expect(drill.lesson.length).toBeLessThanOrEqual(30);
    const mission = drillMission(fresh(), drill, 'Training Simulator');
    let y = 0;
    for (const paragraph of mission.briefing) {
      for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
        expect(y, `briefing of ${drill.id} is too long`).toBeLessThanOrEqual((briefingRows(mission) - 1) * 11);
        y += 11;
      }
      y += 4;
    }
    for (const line of objectiveLines(mission)) expect(line.length, line).toBeLessThanOrEqual(BRIEFING_CHARS);
    expect(wrap(drill.debrief, charsFor(210)).length, drill.debrief).toBeLessThanOrEqual(3);
    for (const line of drill.battle.talk ?? []) expect(wrap(line.text, TALK_CHARS).length, line.text).toBeLessThanOrEqual(TALK_LINES);
  });
});

describe('what the drills teach', () => {
  /** Fires every weapon at the first enemy standing, at its core, and ends the turn. Never boosts, guards, vents or uses a module. */
  function naive(s: BattleState, catalog: Catalog): Action {
    const target = s.units.find((u) => u.side === 'enemy' && !u.destroyed)!;
    for (const slot of WEAPON_SLOTS) {
      const action: Action = { type: 'fire', weapon: slot, target: target.id, part: 'core' };
      if (checkAction(s, action, catalog) === null) return action;
    }
    return { type: 'endTurn' };
  }
  const SEEDS = 40;
  const rate = (drillId: string, policy: (s: BattleState, c: Catalog) => Action): number => {
    const drill = DRILLS.find((d) => d.id === drillId)!;
    let wins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const start = createBattle(drill.build, drill.battle.enemies.map((id) => ALL_ENEMIES[id]), CATALOG, seed * 7919,
        { enemyScale: drill.scale ?? 1, ...(drill.battle.objective ? { objective: drill.battle.objective } : {}) });
      if (runBattle(start, CATALOG, policy).outcome === 'victory') wins++;
    }
    return wins / SEEDS;
  };

  test.each(DRILLS.map((d) => d.id))('%s is passed four times in five by a player who does what it teaches', (id) => {
    expect(rate(id, chooseAutoPlayerAction)).toBeGreaterThanOrEqual(0.8);
  });

  // The others teach something that helps without being the only way through.
  test.each(['drill-aim', 'drill-heat', 'drill-boost', 'drill-guard', 'drill-helpers', 'drill-blade'])(
    '%s is failed more often than not by a player who only ever fires at the first thing in front of them', (id) => {
      expect(rate(id, naive)).toBeLessThanOrEqual(0.5);
    },
  );
});
