import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { checkAction, createBattle, previewShot, type Action, type BattleState } from '../../src/core/battle';
import { validatePlayerBuild, weaponIn } from '../../src/core/build';
import { completeMission, lentPatrol } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { startMissionBattle } from '../../src/core/mission';
import { DRILL_PAY, drillMission, drillOpen, drillPassed, drillSettlement, isDrill, recordDrill } from '../../src/core/training';
import { WEAPON_SLOTS, type Catalog, type WeaponSlot } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import SPRITES from '../../src/content/sprites.json';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, objectiveLines } from '../../src/ui/briefingScreen';
import { charsFor, wrap } from '../../src/ui/widgets';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const AIM = DRILLS[0];

describe('a drill', () => {
  test('is a contract of one battle in a lent mech, which pays once', () => {
    const mission = drillMission(fresh(), AIM, 'Training Simulator');
    expect(mission).toMatchObject({ id: 'drill-aim', title: AIM.title, client: 'Training Simulator', reward: DRILL_PAY, scale: 0.8, phase: 'patrol' });
    // Its battle is the drill's, marked as one that is never open: see below.
    expect(mission.battles).toEqual([{ ...AIM.battle, closed: true }]);
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

  test('stays open when the story starts again, and one that was passed is never locked', () => {
    const later = DRILLS.find((drill) => drill.after === 'intro-2')!;
    expect(drillOpen({ ...fresh(), cycle: 1 }, later, MISSIONS)).toBe(true);
    expect(drillOpen({ ...fresh(), drills: [later.id] }, later, MISSIONS)).toBe(true);
  });
});

describe('the drills', () => {
  test('are eleven, each with an id of its own, and three are open from the start', () => {
    expect(DRILLS).toHaveLength(11);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(11);
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
  /** The drill as the simulator sets it up: its own scale, its own objective, and the Overdrive it lends, if it lends one. */
  const begin = (drillId: string, seed: number, lend = true): BattleState => {
    const drill = DRILLS.find((d) => d.id === drillId)!;
    return createBattle(drill.build, drill.battle.enemies.map((id) => ALL_ENEMIES[id]), CATALOG, seed * 7919, {
      enemyScale: drill.scale ?? 1, ...(drill.battle.objective ? { objective: drill.battle.objective } : {}),
      ...(lend && drill.overdrive ? { overdrive: drill.overdrive.kind, drive: drill.overdrive.drive } : {}),
    });
  };
  const rate = (drillId: string, policy: (s: BattleState, c: Catalog) => Action): number => {
    let wins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) if (runBattle(begin(drillId, seed), CATALOG, policy).outcome === 'victory') wins++;
    return wins / SEEDS;
  };

  test.each(DRILLS.map((d) => d.id))('%s is passed four times in five by a player who does what it teaches', (id) => {
    expect(rate(id, chooseAutoPlayerAction)).toBeGreaterThanOrEqual(0.8);
  });

  test('the damage types drill shows what it says: the blast does most to the tank, the beam most to the enforcer, bullets least to both', () => {
    const drill = DRILLS.find((d) => d.id === 'drill-types')!;
    expect(drill.battle.enemies).toEqual(['tank', 'heavy-mech']);
    const s = createBattle(drill.build, drill.battle.enemies.map((id) => ALL_ENEMIES[id]), CATALOG, 1, { enemyScale: drill.scale ?? 1 });
    const typeOf = (slot: WeaponSlot) => weaponIn(drill.build, slot, CATALOG)!.damageType;
    // One weapon of each kind.
    expect(WEAPON_SLOTS.map(typeOf).sort()).toEqual(['energy', 'explosive', 'kinetic']);
    const against = (kind: string): Record<string, number> => {
      const target = s.units.find((u) => u.kind === kind)!;
      return Object.fromEntries(WEAPON_SLOTS.map((slot) => [typeOf(slot), previewShot(s, 'player', slot, target.id, 'core', CATALOG).damage]));
    };
    const tank = against('tank');
    const enforcer = against('heavy-mech');
    // The differences are plain to see in the numbers the player is told to compare.
    expect(tank.explosive).toBeGreaterThan(tank.energy * 1.15);
    expect(tank.energy).toBeGreaterThan(tank.kinetic);
    expect(enforcer.energy).toBeGreaterThan(enforcer.explosive * 1.15);
    expect(enforcer.explosive).toBeGreaterThan(enforcer.kinetic);
  });

  test('the Overdrive drill lends Second Wind with the meter full, and is over sooner for a pilot who spends it', () => {
    const drill = DRILLS.find((d) => d.id === 'drill-overdrive')!;
    expect(drill.overdrive).toEqual({ kind: 'second-wind', drive: 100 });
    expect(drillMission(fresh(), drill, 'x').overdrive).toEqual(drill.overdrive);
    // No other drill lends one: the pilot's own stays outside the simulator.
    expect(DRILLS.filter((d) => d.overdrive).map((d) => d.id)).toEqual(['drill-overdrive']);
    const rounds = (lend: boolean): number => {
      let sum = 0;
      for (let seed = 1; seed <= SEEDS; seed++) sum += runBattle(begin('drill-overdrive', seed, lend), CATALOG, chooseAutoPlayerAction).round;
      return sum / SEEDS;
    };
    expect(rounds(true)).toBeLessThan(rounds(false) - 1);
  });

  // The others teach something that helps without being the only way through.
  test.each(['drill-aim', 'drill-heat', 'drill-boost', 'drill-guard', 'drill-helpers', 'drill-blade'])(
    '%s is failed more often than not by a player who only ever fires at the first thing in front of them', (id) => {
      expect(rate(id, naive)).toBeLessThanOrEqual(0.5);
    },
  );
});

describe('the patrol in a lent mech', () => {
  const patrol = MISSIONS.find((m) => m.id === 'patrol')!;
  const lent = lentPatrol(patrol, STARTER_BUILD, STRINGS.briefing.lentNote);

  test('is the patrol itself, same pay and same enemies, with a mech that comes with it', () => {
    expect(lent).toMatchObject({ id: 'patrol', phase: 'patrol', reward: patrol.reward, battles: patrol.battles, loaner: STARTER_BUILD });
    expect(validatePlayerBuild(lent.loaner!, CATALOG)).toEqual([]);
    // It is no drill: it is billed and counted like any contract.
    expect(isDrill(lent)).toBe(false);
    expect(isDrill(patrol)).toBe(false);
  });

  test('says why the mech is lent, and its briefing fits the panel', () => {
    expect(lent.briefing[0]).toBe(STRINGS.briefing.lentNote);
    expect(lent.briefing[0]).toMatch(/Garage/);
    let y = 0;
    for (const paragraph of lent.briefing) {
      for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
        expect(y, 'the briefing of the lent patrol is too long').toBeLessThanOrEqual((briefingRows(lent) - 1) * 11);
        y += 11;
      }
      y += 4;
    }
    // The line under the client's name has two rows.
    expect(wrap(STRINGS.briefing.lent, charsFor(310 - 84)).length).toBeLessThanOrEqual(2);
  });

  test('the lent mech wins the patrol nearly every time, even for a pilot who only fires', () => {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const start = createBattle(STARTER_BUILD, patrol.battles[0].enemies.map((id) => ALL_ENEMIES[id]), CATALOG, seed * 7919);
      if (runBattle(start, CATALOG, (s, c) => {
        const target = s.units.find((u) => u.side === 'enemy' && !u.destroyed)!;
        const fire: Action = { type: 'fire', weapon: 'rightHand', target: target.id, part: 'core' };
        return checkAction(s, fire, c) === null ? fire : { type: 'endTurn' };
      }).outcome === 'victory') wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(57);
  });
});

/**
 * Every drill from three seeds, flown by the automatic player on the version before there were open
 * battles: how it ended, in which round, after how many events, with how much of the lent core, and
 * where the dice were left.
 */
const AS_IT_WAS: [string, number, string, number, number, number, number][] = [
  ['drill-aim', 1, 'victory', 3, 19, 220, 1767624617],
  ['drill-aim', 2, 'victory', 3, 18, 220, -63941195],
  ['drill-aim', 3, 'victory', 3, 18, 220, -63941194],
  ['drill-heat', 1, 'victory', 8, 56, 150, -191823590],
  ['drill-heat', 2, 'victory', 8, 58, 115, -823659259],
  ['drill-heat', 3, 'victory', 8, 56, 92, -191823588],
  ['drill-boost', 1, 'victory', 5, 48, 190, -2023389403],
  ['drill-boost', 2, 'victory', 5, 47, 108, -2023389402],
  ['drill-boost', 3, 'victory', 5, 50, 125, -2023389401],
  ['drill-guard', 1, 'victory', 7, 61, 162, 1703683420],
  ['drill-guard', 2, 'victory', 11, 80, 136, -823659259],
  ['drill-guard', 3, 'victory', 6, 54, 226, 503953279],
  ['drill-types', 1, 'victory', 7, 56, 151, -823659260],
  ['drill-types', 2, 'victory', 7, 56, 197, -823659259],
  ['drill-types', 3, 'victory', 29, 190, 220, -1967024504],
  ['drill-stagger', 1, 'victory', 7, 58, 228, 1639742223],
  ['drill-stagger', 2, 'victory', 8, 63, 207, -1455494929],
  ['drill-stagger', 3, 'victory', 9, 71, 151, 1575801028],
  ['drill-helpers', 1, 'victory', 7, 60, 276, -2087330600],
  ['drill-helpers', 2, 'victory', 7, 57, 313, 1007906554],
  ['drill-helpers', 3, 'victory', 6, 51, 297, -191823588],
  ['drill-blade', 1, 'victory', 9, 82, 118, -887600457],
  ['drill-blade', 2, 'victory', 7, 59, 159, -2023389402],
  ['drill-blade', 3, 'victory', 11, 90, 75, 943965358],
  ['drill-module', 1, 'victory', 5, 41, 320, -1391553733],
  ['drill-module', 2, 'victory', 2, 17, 320, -63941195],
  ['drill-module', 3, 'victory', 2, 17, 320, -63941194],
  ['drill-protect', 1, 'victory', 4, 49, 184, 1639742223],
  ['drill-protect', 2, 'defeat', 7, 71, 184, 943965357],
  ['drill-protect', 3, 'victory', 4, 46, 210, -191823588],
  ['drill-overdrive', 1, 'victory', 7, 52, 150, 1639742223],
  ['drill-overdrive', 2, 'victory', 7, 55, 150, -823659259],
  ['drill-overdrive', 3, 'victory', 6, 50, 150, -2023389401],
];

describe('a drill is never an open battle', () => {
  const started = (id: string, seed: number): BattleState => {
    const mission = drillMission(fresh(), DRILLS.find((drill) => drill.id === id)!, 'Training Simulator');
    return startMissionBattle(mission.loaner!, mission, 0, ALL_ENEMIES, CATALOG, seed, undefined, {
      enemyScale: mission.scale ?? 1, ...(mission.overdrive ? { overdrive: mission.overdrive.kind, drive: mission.overdrive.drive } : {}),
    });
  };

  test('every drill there is has its three lines above', () => {
    expect([...new Set(AS_IT_WAS.map(([id]) => id))]).toEqual(DRILLS.map((drill) => drill.id));
  });

  test.each(AS_IT_WAS)('%s from seed %i plays to its last event as it did before', (id, seed, outcome, round, events, core, rng) => {
    const start = started(id, seed);
    expect(start.open).toBe(false);
    const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
    expect([end.outcome, end.round, end.events.length, end.units[0].parts.core!.ap, end.rng]).toEqual([outcome, round, events, core, rng]);
    // Nothing of what a pilot who outguns the field does happens in it.
    expect(end.events.some((e) => (e.type === 'shot' && e.shatter) || ['momentum', 'shaken', 'rout', 'arrive'].includes(e.type))).toBe(false);
  });

  test('it is the simulator that makes it so: the same machines met on a contract are an open battle', () => {
    // The drill on bracing: two bomb crawlers and a marksman, none of which leads anybody.
    const guard = DRILLS.find((drill) => drill.id === 'drill-guard')!;
    expect(guard.battle.enemies.length).toBeGreaterThan(1);
    const outside = createBattle(guard.build, guard.battle.enemies.map((id) => ALL_ENEMIES[id]), CATALOG, 1, { enemyScale: guard.scale ?? 1 });
    expect(outside.open).toBe(true);
    expect(started('drill-guard', 1).open).toBe(false);
    // What is lent there would go through a crawler on a contract. In the drill it does not: the lesson is to brace.
    const shot = (state: BattleState) => {
      const slot = WEAPON_SLOTS.map((s) => s).sort((a, b) => (weaponIn(guard.build, b, CATALOG)?.damage ?? 0) - (weaponIn(guard.build, a, CATALOG)?.damage ?? 0))[0];
      const crawler = state.units.find((u) => u.fuse !== undefined)!;
      return previewShot(state, 'player', slot, crawler.id, 'core', CATALOG);
    };
    expect(shot(outside)).toMatchObject({ shatter: true, kills: true });
    expect(shot(started('drill-guard', 1))).toMatchObject({ shatter: false, kills: false });
  });
});
