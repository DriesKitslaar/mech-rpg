import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, fieldOf, type BattleState, type UnitState } from '../../src/core/battle';
import { arenaMission } from '../../src/core/arena';
import { STORY_ENEMIES } from '../../src/core/board';
import { computeBuildStats, validatePlayerBuild, weaponIn } from '../../src/core/build';
import { completeMission, forCycle, reached, sideMissions, startNewCycle, stockFor, type Mission } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { recordRank } from '../../src/core/rank';
import type { Build, FramePart, Part } from '../../src/core/types';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { PEOPLE, UNITS } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { DUELS, SIDE_WORK } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { done } from '../helpers/app';

/**
 * The two duels a pilot is offered once the audit is over, the two pilots who come for them, and the
 * two frames they fly: what each is, when it is offered, what winning it opens, and how hard it is.
 */

const SHRIKE = ['head-shrike', 'core-shrike', 'arms-shrike', 'legs-shrike'];
const STERLING = ['head-sterling', 'core-sterling', 'arms-sterling', 'legs-sterling'];
/** The story with Lumen, to the verdict that enforces: every contract of it but the verdicts, and then with the verdict. */
const STORY = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
const audited = (): GameState => done(...STORY);
const ended = (): GameState => done(...STORY, 'verdict-enforce');
const duels = (g: GameState): string[] => sideMissions(g, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('duel-'));
const shelf = (g: GameState): string[] => stockFor(g, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((part: Part) => part.id);
const frame = (ids: string[]): FramePart[] => ids.map((id) => CATALOG[id] as FramePart);
const armour = (ids: string[]): number => frame(ids).reduce((sum, part) => sum + part.ap, 0);
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;

/** What a pilot who has finished the story has learnt: six ranks of the usual perks. */
const VETERAN = (() => {
  const { aim, evasion, energy, cooling, repairs, armour: plates } = perkEffects({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour: plates };
})();
/** How often the game's own automatic pilot wins a fight in a build: twenty battles, two families of seeds. */
function rate(build: Build, mission: Mission, mods: object = VETERAN, seeds = 20): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    const end = playMission(build, mission, ALL_ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') wins += 1;
  }
  return wins / seeds;
}
const duel = (n: 1 | 2): Mission => DUELS[n - 1];
const LONG = 60_000;

describe('the duels with the Coast Circuit', () => {
  test('are two, each one battle against one named pilot in a frame of the Circuit, and the second pays more', () => {
    expect(DUELS.map((m) => m.id)).toEqual(['duel-1', 'duel-2']);
    expect(SIDE_WORK.filter((m) => m.series === 'duel')).toEqual(DUELS);
    for (const mission of DUELS) {
      expect(mission).toMatchObject({ phase: 'side', series: 'duel', when: 'verdict', client: 'Dispatch', portrait: 'portrait-dispatch' });
      expect(mission.battles).toHaveLength(1);
      expect(mission.battles[0].enemies).toHaveLength(1);
      expect(mission.briefing).toHaveLength(3);
    }
    expect(DUELS.map((m) => m.battles[0].enemies[0])).toEqual(['larder', 'argent']);
    expect(duel(2).reward).toBeGreaterThan(duel(1).reward);
    // The best-paid work there is beside the story: more than the last notice on the board.
    const others = SIDE_WORK.filter((m) => m.series !== 'duel').map((m) => m.reward);
    expect(duel(1).reward).toBeGreaterThan(Math.max(...others));
  });

  test('the two pilots are met in their duels and nowhere else: not in the story, not on the board, not in the arena', () => {
    const elsewhere = MISSIONS.filter((m) => m.series !== 'duel').flatMap((m) => m.battles.flatMap((b) => [...b.enemies, ...(b.reserve ?? [])]));
    for (const id of ['larder', 'argent']) {
      expect(elsewhere, id).not.toContain(id);
      expect(STORY_ENEMIES, id).toContain(id);
      expect(ARENA.map((o) => ALL_ENEMIES[o.enemy].name), id).not.toContain(ENEMIES[id].name);
    }
  });

  test('are offered once the audit is over and not before, one at a time, in order', () => {
    expect(duels(newGame(CATALOG, STARTER_BUILD))).toEqual([]);
    expect(duels(audited())).toEqual([]);
    const g = ended();
    expect(duels(g)).toEqual(['duel-1']);
    const one = completeMission(g, 'duel-1', MISSIONS);
    expect(duels(one)).toEqual(['duel-2']);
    expect(duels(completeMission(one, 'duel-2', MISSIONS))).toEqual([]);
  });

  test('are there to be fought again in a later telling, once that telling has had its verdict', () => {
    const both = completeMission(completeMission(ended(), 'duel-1', MISSIONS), 'duel-2', MISSIONS);
    const again = startNewCycle(both, MISSIONS);
    expect(duels(again)).toEqual([]);
    let later = again;
    for (const id of [...STORY, 'verdict-enforce']) later = completeMission(later, id, MISSIONS);
    expect(duels(later)).toEqual(['duel-1']);
  });

  test('each of the two has a page among the units and a page among the people, which opens when they have been met', () => {
    for (const id of ['larder', 'argent']) {
      expect(UNITS.filter((page) => page.id === id), id).toHaveLength(1);
      const person = PEOPLE.find((p) => p.id === id)!;
      expect(person).toMatchObject({ name: ENEMIES[id].name, portrait: ENEMIES[id].portrait, role: 'Coast Circuit', when: { met: id } });
      expect(person.portrait in SPRITES, person.portrait).toBe(true);
    }
  });
});

describe('what a duel won opens', () => {
  test('`won:` is a contract that has left a rank, in this telling or an earlier one: flown and lost, or only posted, it is not won', () => {
    const g = ended();
    expect(reached(g, 'won:duel-1', MISSIONS)).toBe(false);
    const won = recordRank(completeMission(g, 'duel-1', MISSIONS), 'duel-1', 'C');
    expect(reached(won, 'won:duel-1', MISSIONS)).toBe(true);
    expect(reached(won, 'won:duel-2', MISSIONS)).toBe(false);
    expect(reached(won, 'won:duel', MISSIONS)).toBe(false);
    // The rank is what stays: the story starts over, and the duel is still one that was won.
    expect(reached(startNewCycle(won, MISSIONS), 'won:duel-1', MISSIONS)).toBe(true);
    // It joins the other conditions as any does.
    expect(reached(won, 'won:duel-1&verdict', MISSIONS)).toBe(true);
    expect(reached(won, '!won:duel-1', MISSIONS)).toBe(false);
  });

  test('the Shrike is sold to a pilot who has won the first duel and the Sterling to one who has won the second: before that neither is on the shelf', () => {
    expect(Object.fromEntries([...SHRIKE, ...STERLING].map((id) => [id, SHOP_UNLOCKS[id]]))).toEqual({
      ...Object.fromEntries(SHRIKE.map((id) => [id, 'won:duel-1'])), ...Object.fromEntries(STERLING.map((id) => [id, 'won:duel-2'])),
    });
    const g = ended();
    const circuit = (state: GameState): string[] => shelf(state).filter((id) => /-(shrike|sterling)$/.test(id));
    expect(circuit(g)).toEqual([]);
    // Meridian's own frame is: the audit is over.
    expect(shelf(g)).toContain('core-auditor');
    const one = recordRank(completeMission(g, 'duel-1', MISSIONS), 'duel-1', 'B');
    expect(circuit(one)).toEqual(SHRIKE);
    const two = recordRank(completeMission(one, 'duel-2', MISSIONS), 'duel-2', 'B');
    expect(circuit(two)).toEqual([...SHRIKE, ...STERLING]);
  });

  test('a duel won is won for good, and one never fought is never given: the frames stay when the story starts over, and are not handed to a later telling', () => {
    const circuit = (state: GameState): string[] => shelf(state).filter((id) => /-(shrike|sterling)$/.test(id));
    const won = recordRank(completeMission(ended(), 'duel-1', MISSIONS), 'duel-1', 'S');
    expect(circuit(startNewCycle(won, MISSIONS))).toEqual(SHRIKE);
    // A pilot in a second telling who never took the booking: everything a client's contract opened is kept for them,
    // and Meridian's stock with it (the verdict was given, and left its rank). The Circuit's frames are not.
    const never = startNewCycle(recordRank(ended(), 'verdict-enforce', 'B'), MISSIONS);
    expect(never.cycle).toBe(1);
    expect(shelf(never)).toContain('core-halo');
    expect(shelf(never)).toContain('core-auditor');
    expect(circuit(never)).toEqual([]);
  });
});

describe('the two swords', () => {
  const pilots = [['larder', SHRIKE], ['argent', STERLING]] as const;

  test.each(pilots)('%s flies the whole frame it is beaten for, within what its legs carry, with a blade and a rifle', (id, parts) => {
    const def = ENEMIES[id];
    expect(def).toMatchObject({ composed: true, portrait: `portrait-${id}`, plating: 1 });
    expect([def.build.head, def.build.core, def.build.arms, def.build.legs]).toEqual(parts);
    const stats = computeBuildStats(def.build, CATALOG);
    expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
    const carried = (['rightHand', 'leftHand'] as const).map((slot) => weaponIn(def.build, slot, CATALOG)!);
    expect(carried.filter((weapon) => weapon.melee)).toHaveLength(1);
    expect(carried.filter((weapon) => !weapon.melee)).toHaveLength(1);
    expect(def.build.shoulder).toBeUndefined();
    // It is drawn in its own colours: the frame is the sight.
    expect(def.paint).toBeUndefined();
  });

  test('are plated to last a duel: twice the armour of the frame as it is sold, times what the duel scales them by, and no steadier or harder-hitting for it', () => {
    for (const [n, id, parts] of [[1, 'larder', SHRIKE], [2, 'argent', STERLING]] as const) {
      const scale = duel(n).scale ?? 1;
      const foe = unit(createBattle(REFERENCE_BUILDS.tier5, [ENEMIES[id]], CATALOG, 1, { enemyScale: scale }), 'enemy-0');
      for (const part of frame([...parts])) expect(foe.parts[part.kind as 'core']!.maxAp, part.id).toBe(Math.round(part.ap * 2 * scale));
      expect(foe.staggerMax, id).toBe(Math.round(computeBuildStats(ENEMIES[id].build, CATALOG).stability * scale));
      expect(foe.mods.damage, id).toBe(scale);
    }
    expect([duel(1).scale, duel(2).scale]).toEqual([1.1, undefined]);
  });

  test('Larder goes for whatever is already hurt, boosts in, strikes, and is still boosting when the pilot shoots back', () => {
    expect(ENEMIES.larder.ai).toBe('bruiser');
    expect((CATALOG['arms-shrike'] as FramePart).poise).toBe(true);
    let s = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.larder], CATALOG, 3, { enemyScale: 1.1 });
    // Whoever goes first, the Shrike's own turn is taken as it chooses to take it.
    for (let guard = 0; guard < 6 && activeUnit(s).id !== 'enemy-0'; guard++) s = applyAction(s, { type: 'endTurn' }, CATALOG, () => 0);
    for (let guard = 0; guard < 12 && activeUnit(s).id === 'enemy-0' && s.outcome === 'ongoing'; guard++) s = applyAction(s, chooseEnemyAction(s, CATALOG), CATALOG, () => 0);
    const struck = s.events.filter((e) => e.type === 'shot' && e.unit === 'enemy-0');
    expect(struck.map((e) => (e.type === 'shot' ? weaponIn(ENEMIES.larder.build, e.weapon, CATALOG)!.melee === true : false))).toContain(true);
    expect(s.events.some((e) => e.type === 'boost' && e.unit === 'enemy-0')).toBe(true);
    expect(unit(s, 'enemy-0').boosted).toBe(true);
  });

  test('Argent aims for the core, behind a field of seventy: far past the twenty-five its core is sold with', () => {
    expect(ENEMIES.argent.ai).toBe('gunner');
    expect((CATALOG['core-sterling'] as FramePart).field).toBe(25);
    expect(ENEMIES.argent.abilities).toEqual({ field: 70 });
    const s = createBattle(REFERENCE_BUILDS.tier5, [ENEMIES.argent], CATALOG, 1);
    expect(unit(s, 'enemy-0').barrier).toBe(70);
    expect(fieldOf(unit(s, 'enemy-0'), CATALOG)).toBe(70);
    // The same core on the pilot's own mech raises what it is sold with.
    const own = createBattle({ ...REFERENCE_BUILDS.tier5, core: 'core-sterling' }, [ENEMIES['gun-turret']], CATALOG, 1);
    expect(unit(own, 'player').barrier).toBe(25);
    // Arms of a Sterling have no poise: the first sword's own strike costs it the boost, and that is the pilot's opening.
    expect((CATALOG['arms-sterling'] as FramePart).poise).toBeUndefined();
  });
});

describe('how hard the duels are', () => {
  const LONGBOW: Build = {
    head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-hawkeye',
    module: 'mod-oracle', rightHand: 'wpn-longbow', leftHand: 'wpn-pulse-carbine',
  };

  test('the first, for a pilot who has finished the story: a quick mech with a blade nearly always wins it, a Colossus has a real chance and no more', () => {
    expect(rate(REFERENCE_BUILDS.tier5, duel(1))).toBeGreaterThanOrEqual(0.8);
    const heavy = rate(REFERENCE_BUILDS.tier6, duel(1));
    expect(heavy).toBeGreaterThanOrEqual(0.25);
    expect(heavy).toBeLessThanOrEqual(0.8);
  }, LONG);

  test('the second asks for one great blow a round: a rail that breaks the field nearly always wins, a beam that only feeds it seldom does', () => {
    expect(validatePlayerBuild(LONGBOW, CATALOG)).toEqual([]);
    expect(rate(LONGBOW, duel(2))).toBeGreaterThanOrEqual(0.9);
    expect(rate(REFERENCE_BUILDS.tier5, duel(2))).toBeGreaterThanOrEqual(0.7);
    const beam = rate(REFERENCE_BUILDS.tier6, duel(2));
    expect(beam).toBeLessThanOrEqual(0.5);
    // And the second is the harder of the two for the mech that has no answer to it.
    expect(beam).toBeLessThanOrEqual(rate(REFERENCE_BUILDS.tier6, duel(1)));
  }, LONG);

  test('neither is for a pilot who has learnt nothing: without a perk to its name the Colossus loses both more often than it wins', () => {
    expect(rate(REFERENCE_BUILDS.tier6, duel(1), {})).toBeLessThan(0.5);
    expect(rate(REFERENCE_BUILDS.tier6, duel(2), {})).toBeLessThan(0.5);
  }, LONG);
});

describe('the two frames', () => {
  test('are what was measured, to the figure: armour, what each shrugs off, weight, drain, and what only they have', () => {
    const freelance = (figures: object) => ({ ...figures, vendor: 'freelance' });
    const measured: Record<string, object> = {
      'head-shrike': freelance({ name: 'Shrike Mask', kind: 'head', ap: 50, resist: { kinetic: 0.15, energy: 0.15, explosive: 0.1 }, weight: 20, drain: 30, price: 2600, aim: 20 }),
      'core-shrike': freelance({ name: 'Shrike Core', kind: 'core', ap: 180, resist: { kinetic: 0.15, energy: 0.15, explosive: 0.15 }, weight: 150, drain: 55, price: 3000 }),
      'arms-shrike': freelance({ name: 'Shrike Talons', kind: 'arms', ap: 100, resist: { kinetic: 0.15, energy: 0.15, explosive: 0.1 }, weight: 75, drain: 45, price: 3400, aim: 18, poise: true }),
      'legs-shrike': freelance({ name: 'Shrike Legs', kind: 'legs', ap: 135, resist: { kinetic: 0.15, energy: 0.15, explosive: 0.1 }, weight: 125, drain: 60, price: 3000, capacity: 850, mobility: 56 }),
      'head-sterling': freelance({ name: 'Sterling Helm', kind: 'head', ap: 55, resist: { kinetic: 0.15, energy: 0.2, explosive: 0.15 }, weight: 30, drain: 30, price: 3200, aim: 20 }),
      'core-sterling': freelance({ name: 'Sterling Core', kind: 'core', ap: 205, resist: { kinetic: 0.2, energy: 0.25, explosive: 0.2 }, weight: 190, drain: 70, price: 4400, field: 25 }),
      'arms-sterling': freelance({ name: 'Sterling Arms', kind: 'arms', ap: 100, resist: { kinetic: 0.15, energy: 0.2, explosive: 0.15 }, weight: 90, drain: 45, price: 3000, aim: 14 }),
      'legs-sterling': freelance({ name: 'Sterling Greaves', kind: 'legs', ap: 140, resist: { kinetic: 0.15, energy: 0.2, explosive: 0.15 }, weight: 150, drain: 65, price: 3600, capacity: 950, mobility: 52 }),
    };
    for (const [id, figures] of Object.entries(measured)) expect(CATALOG[id], id).toEqual({ id, ...figures });
    // Nothing else in the catalogue raises a field or keeps its boost through a strike.
    const all = Object.values(CATALOG) as FramePart[];
    expect(all.filter((part) => part.field !== undefined).map((part) => part.id)).toEqual(['core-sterling']);
    expect(all.filter((part) => part.poise !== undefined).map((part) => part.id)).toEqual(['arms-shrike']);
  });

  test('the Sterling is nearly as quick as a Wraith and better plated; the Shrike is the lighter of the two, with the best arms there are for a hand weapon', () => {
    const WRAITH = ['head-wraith', 'core-wraith', 'arms-wraith', 'legs-wraith'];
    const mobility = (legs: string): number => (CATALOG[legs] as FramePart).mobility!;
    expect(mobility('legs-sterling')).toBeLessThan(mobility('legs-wraith'));
    expect(mobility('legs-sterling')).toBeGreaterThan(mobility('legs-halo'));
    expect(armour(STERLING)).toBeGreaterThan(armour(WRAITH));
    expect(armour(STERLING)).toBeLessThan(armour(['head-ronin', 'core-ronin', 'arms-ronin', 'legs-ronin']));
    expect(armour(SHRIKE)).toBeLessThan(armour(STERLING));
    expect(mobility('legs-shrike')).toBeGreaterThan(mobility('legs-sterling'));
    expect(mobility('legs-shrike')).toBeLessThan(mobility('legs-wraith'));
    const arms = SHOP_PARTS.filter((part: Part): part is FramePart => part.kind === 'arms');
    expect(Math.max(...arms.map((part) => part.aim ?? 0))).toBe((CATALOG['arms-shrike'] as FramePart).aim);
    expect(arms.filter((part) => part.aim === 18).map((part) => part.id)).toEqual(['arms-shrike']);
  });

  test('cost what the end of the game costs: each more than a Wraith, and the Sterling more than anything Meridian sold', () => {
    const price = (ids: string[]): number => ids.reduce((sum, id) => sum + CATALOG[id].price, 0);
    expect([price(SHRIKE), price(STERLING)]).toEqual([12000, 14200]);
    expect(price(SHRIKE)).toBeGreaterThan(price(['head-wraith', 'core-wraith', 'arms-wraith', 'legs-wraith']));
    expect(price(STERLING)).toBeGreaterThan(price(['head-auditor', 'core-auditor', 'arms-auditor', 'legs-auditor']));
    // The purse of the duel that opens a frame does not pay for it: a win is the right to buy, not the frame.
    expect(duel(1).reward).toBeLessThan(price(SHRIKE));
    expect(duel(2).reward).toBeLessThan(price(STERLING));
  });

  test.each([['Shrike', SHRIKE], ['Sterling', STERLING]] as const)('a %s can be flown with a rifle, a blade and the best that goes inside: not too heavy, not short of energy', (_name, parts) => {
    const [head, core, arms, legs] = parts;
    const build: Build = { head, core, arms, legs, generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade' };
    expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
  });
});

describe('what the frames do to the hard fights', () => {
  const inside = { generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle' };
  const worn = (parts: readonly string[], weapons: object): Build => ({ head: parts[0], core: parts[1], arms: parts[2], legs: parts[3], ...inside, ...weapons });
  const arena = (rank: number): Mission => arenaMission(newGame(CATALOG, STARTER_BUILD), ARENA[rank - 1], { client: '', win: '' });
  const verdict = (id: string): Mission => forCycle(MISSIONS.find((m) => m.id === id)!, 1);

  test('a Shrike with two blades does not open the back room: the Founder still sends it home', () => {
    expect(rate(worn(SHRIKE, { rightHand: 'wpn-arc-blade', leftHand: 'wpn-breach-pick' }), arena(15), {})).toBeLessThanOrEqual(0.4);
    expect(rate(worn(SHRIKE, { rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade' }), arena(15), {})).toBeLessThanOrEqual(0.3);
  }, LONG);

  test('a Sterling does not either, and its field does not make a later telling\'s verdict a formality', () => {
    const guns = worn(STERLING, { rightHand: 'wpn-void-rifle', leftHand: 'wpn-pulse-carbine' });
    expect(validatePlayerBuild(guns, CATALOG)).toEqual([]);
    expect(rate(guns, arena(15), {})).toBeLessThanOrEqual(0.3);
    expect(rate(guns, arena(11), {})).toBeLessThanOrEqual(0.5);
    expect(rate(guns, verdict('verdict-default'), {})).toBeLessThanOrEqual(0.9);
    expect(rate(guns, verdict('verdict-enforce'), {})).toBeLessThanOrEqual(0.95);
  }, LONG);

  test('the Sterling\'s core on a Colossus is no better than the Colossus: what it gives in field it takes in plate', () => {
    const mixed: Build = { ...REFERENCE_BUILDS.tier6, core: 'core-sterling' };
    expect(validatePlayerBuild(mixed, CATALOG)).toEqual([]);
    expect(rate(mixed, arena(15), {})).toBeLessThanOrEqual(rate(REFERENCE_BUILDS.tier6, arena(15), {}) + 0.1);
    expect(rate(mixed, arena(13), {})).toBeLessThanOrEqual(rate(REFERENCE_BUILDS.tier6, arena(13), {}) + 0.1);
  }, LONG);
});
