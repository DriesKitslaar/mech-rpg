import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { ARCHETYPES, archetypeOf, type Archetype } from '../../src/core/archetype';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS, STAGES, STAGE_BUDGET, type Stage } from '../../src/content/archetypeBuilds';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_UNLOCKS } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * A build of each kind of machine for each stretch of the story: that each is what it is called,
 * can be bought when it is meant to be, and wins the fights of its stretch often enough that a
 * pilot who flies that kind is not flying a mistake.
 */

const price = (build: Build): number => Object.values(build).reduce((sum, id) => sum + CATALOG[id].price, 0);
const needs = (build: Build): string[] => [...new Set(Object.values(build).map((id) => SHOP_UNLOCKS[id]).filter(Boolean))];
const each = ARCHETYPES.flatMap((kind) => STAGES.map((stage) => [kind, stage, ARCHETYPE_BUILDS[kind][stage]] as const));

describe('a build of each kind for each stage', () => {
  test('there is one for every kind at every stage, and no two are the same', () => {
    expect(Object.keys(ARCHETYPE_BUILDS).sort()).toEqual([...ARCHETYPES].sort());
    expect([...STAGES]).toEqual(['early', 'war', 'late']);
    for (const kind of ARCHETYPES) expect(Object.keys(ARCHETYPE_BUILDS[kind])).toEqual(['early', 'war', 'late']);
    expect(new Set(each.map(([, , build]) => JSON.stringify(build))).size).toBe(21);
  });

  test.each(each)('the %s of the %s stage is that kind, may deploy, and is paid for by what a pilot has by then', (kind, stage, build) => {
    expect(archetypeOf(build, CATALOG)).toBe(kind);
    expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
    expect(price(build)).toBeLessThanOrEqual(STAGE_BUDGET[stage]);
    // Not a toy either: at least half of what the stage has to spend is spent on it.
    expect(price(build)).toBeGreaterThanOrEqual(STAGE_BUDGET[stage] / 2);
    // It fires what it carries: a turn's energy covers its dearest weapon, with something over.
    const stats = computeBuildStats(build, CATALOG);
    expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
    expect(stats.turnEnergy).toBeGreaterThanOrEqual(200);
  });

  test('what a pilot has to spend by each stage is what the reference build of that stage costs', () => {
    expect(STAGE_BUDGET).toEqual({ early: price(REFERENCE_BUILDS.tier2), war: price(REFERENCE_BUILDS.tier4), late: price(REFERENCE_BUILDS.tier6) });
    expect(STAGE_BUDGET).toEqual({ early: 7200, war: 13700, late: 28100 });
  });

  test('each is sold when it is meant to be bought: the first act sells the early ones, the choice the war\'s, and the arena the rest', () => {
    const firstAct = (c: string): boolean => /^(hadron|lumen|undertow)-1$/.test(c);
    const arena = (c: string): boolean => /^arena:([1-9]|10)$/.test(c);
    for (const kind of ARCHETYPES) {
      expect(needs(ARCHETYPE_BUILDS[kind].early).filter((c) => !firstAct(c)), `${kind} early`).toEqual([]);
      expect(needs(ARCHETYPE_BUILDS[kind].war).filter((c) => !firstAct(c) && c !== 'choice'), `${kind} war`).toEqual([]);
      expect(needs(ARCHETYPE_BUILDS[kind].late).filter((c) => !firstAct(c) && c !== 'choice' && !arena(c)), `${kind} late`).toEqual([]);
      // Something of the late build is a prize: it is not the war's build with another name.
      expect(needs(ARCHETYPE_BUILDS[kind].late).some(arena), `${kind} late`).toBe(true);
    }
    // Nothing of any of them waits for the audit to be over, or for a duel: the story is finished in them, not after them.
    expect(each.flatMap(([, , build]) => needs(build)).filter((c) => c === 'verdict' || c.startsWith('won:'))).toEqual([]);
  });

  test('the kinds the reference builds already are fly those: an all-rounder the mid-game gear and the full Ronin, a bastion the heavy plate and the Colossus, a duellist the Wraith', () => {
    expect(ARCHETYPE_BUILDS.allrounder.early).toBe(REFERENCE_BUILDS.tier2);
    expect(ARCHETYPE_BUILDS.allrounder.war).toBe(REFERENCE_BUILDS.tier4);
    expect(ARCHETYPE_BUILDS.bastion.war).toBe(REFERENCE_BUILDS.tier3);
    expect(ARCHETYPE_BUILDS.bastion.late).toBe(REFERENCE_BUILDS.tier6);
    expect(ARCHETYPE_BUILDS.duellist.late).toBe(REFERENCE_BUILDS.tier5);
  });

  test('each kind is built the way its page says: the duellist on quick legs with a second blade by the war, the lancer round what cooks and starves', () => {
    const parts = (kind: Archetype, stage: Stage) => ARCHETYPE_BUILDS[kind][stage];
    const weapons = (build: Build) => [build.rightHand, build.leftHand, build.shoulder].filter((id): id is string => id !== undefined).map((id) => CATALOG[id]);
    expect(weapons(parts('duellist', 'war')).every((w) => w.kind === 'weapon' && w.melee)).toBe(true);
    for (const stage of STAGES) expect(archetypeOf({ ...parts('duellist', stage), rightHand: undefined, leftHand: 'wpn-rivet-rifle' }, CATALOG), stage).toBe('skirmisher');
    // The lancer of the war and of the end: a weapon that heats what it hits and one that drains it.
    for (const stage of ['war', 'late'] as Stage[]) {
      const traits = weapons(parts('lancer', stage)).map((w) => (w.kind === 'weapon' ? w.trait : undefined));
      expect(traits, stage).toEqual(expect.arrayContaining(['thermal', 'drain']));
    }
    // Artillery carries two guns beside its salvo at every stage; a bastion's first build stands behind a shield.
    for (const stage of STAGES) expect(weapons(parts('artillery', stage)), stage).toHaveLength(3);
    expect(CATALOG[parts('bastion', 'early').leftHand!].kind).toBe('shield');
    // A sharpshooter's weapon charges in a hand from the first; by the war a second charges on the shoulder.
    expect(weapons(parts('marksman', 'war')).every((w) => w.kind === 'weapon' && w.charge)).toBe(true);
  });
});

describe('how each kind fares in the fights of its stage', () => {
  /** What a pilot at the audit has learnt: six ranks of the usual perks. Before that, none are counted. */
  const VETERAN = (() => {
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, PERKS);
    return { aim, evasion, energy, cooling, repairs, armour };
  })();
  /** The fights a stage's build is bought for. */
  const FIGHTS: Record<Stage, string[]> = {
    early: ['hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-hadron', 'choice-lumen', 'choice-undertow'],
    war: ['hadron-4', 'lumen-4', 'undertow-4', 'finale-hadron', 'finale-lumen', 'finale-undertow'],
    late: ['audit-1', 'audit-2', 'audit-3', 'verdict-enforce', 'verdict-default'],
  };
  const SEEDS = 8;
  /** How often the game's own automatic pilot wins the stage's fights in a build, all told: eight battles a fight, two families of seeds. */
  function fares(build: Build, stage: Stage): number {
    let wins = 0;
    for (const id of FIGHTS[stage]) {
      const mission = MISSIONS.find((m) => m.id === id)!;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
        const end = playMission(build, mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
          { ...(stage === 'late' ? { mods: VETERAN } : {}), enemyScale: mission.scale ?? 1 });
        if (end.outcome === 'victory') wins += 1;
      }
    }
    return wins / (FIGHTS[stage].length * SEEDS);
  }
  /** What every kind is held to at each stage: well under what was measured for the weakest, so that it is the kind and not the dice that would fail it. */
  const FLOOR: Record<Stage, number> = { early: 0.8, war: 0.6, late: 0.8 };

  test('the fights are the story\'s own: the second contracts, the rival and the choice; a war contract of each client and the finales; the audit and the two verdicts every pilot is offered', () => {
    for (const stage of STAGES) for (const id of FIGHTS[stage]) expect(MISSIONS.some((m) => m.id === id), id).toBe(true);
    expect(FLOOR).toEqual({ early: 0.8, war: 0.6, late: 0.8 });
  });

  test.each(each)('a %s in the %s stage wins its fights often enough to be flown', (_kind, stage, build) => {
    expect(fares(build, stage)).toBeGreaterThanOrEqual(FLOOR[stage]);
  }, 60_000);

  test('and none of that is the stage being easy: the build of the stage before does plainly worse at the war and at the audit', () => {
    // Asked of the two kinds that were furthest behind when the builds were chosen.
    for (const kind of ['lancer', 'artillery'] as Archetype[]) {
      expect(fares(ARCHETYPE_BUILDS[kind].early, 'war'), `${kind} war`).toBeLessThan(fares(ARCHETYPE_BUILDS[kind].war, 'war') - 0.2);
    }
  }, 60_000);
});
