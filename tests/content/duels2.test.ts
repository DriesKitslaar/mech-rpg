import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, heatLimitOf, bufferOf, type BattleState, type UnitState } from '../../src/core/battle';
import { STORY_ENEMIES, MECH_ENEMIES, ENEMY_COST } from '../../src/core/board';
import { computeBuildStats, validatePlayerBuild, weaponIn } from '../../src/core/build';
import { completeMission, sideMissions, startNewCycle, stockFor, type Mission } from '../../src/core/campaign';
import { type GameState } from '../../src/core/game';
import { groundFor } from '../../src/core/ground';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { recordRank } from '../../src/core/rank';
import type { Build, FramePart, Part, Weapon } from '../../src/core/types';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { PEOPLE, UNITS } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { MEDALS, WORKS_DUELS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { DUELS } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { done } from '../helpers/app';

/**
 * The third and fourth duels: the two works pilots of the yard that builds the Circuit's machines, each in a
 * frame the yard has never sold. What each is, when it is offered, what winning it opens, how its pilot
 * fights, and how hard it is.
 */

const SIROCCO = ['head-sirocco', 'core-sirocco', 'arms-sirocco', 'legs-sirocco'];
const SOLSTICE = ['head-solstice', 'core-solstice', 'arms-solstice', 'legs-solstice'];
const STORY = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
const ended = (): GameState => done(...STORY, 'verdict-enforce');
const won = (g: GameState, id: string): GameState => recordRank(completeMission(g, id, MISSIONS), id, 'B');
const duels = (g: GameState): string[] => sideMissions(g, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('duel-'));
const shelf = (g: GameState): string[] => stockFor(g, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((part: Part) => part.id);
const works = (g: GameState): string[] => shelf(g).filter((id) => /-(sirocco|solstice)$/.test(id));
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const duel = (n: 3 | 4): Mission => DUELS[n - 1];

/** What a pilot who has finished the story has learnt: six ranks of the usual perks. */
const VETERAN = (() => {
  const { aim, evasion, energy, cooling, repairs, armour } = perkEffects({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour };
})();
/** How often the game's own automatic pilot wins a duel in a build: twenty battles, two families of seeds. */
function rate(build: Build, mission: Mission, mods: object = VETERAN, seeds = 20): number {
  expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    const end = playMission(build, mission, ALL_ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') wins += 1;
  }
  return wins / seeds;
}
const LONG = 60_000;

describe('the duels with the yard\'s works pilots', () => {
  test('are the third and the fourth of the series, each one battle against one works pilot, on ground that has a rule', () => {
    expect([duel(3).id, duel(4).id]).toEqual(['duel-3', 'duel-4']);
    expect([duel(3).title, duel(4).title]).toEqual(['Hot Work', 'The Longest Day']);
    for (const mission of [duel(3), duel(4)]) {
      expect(mission).toMatchObject({ phase: 'side', series: 'duel', when: 'verdict', client: 'Dispatch', portrait: 'portrait-dispatch' });
      expect(mission.battles).toHaveLength(1);
      expect(mission.briefing).toHaveLength(3);
    }
    expect([duel(3), duel(4)].map((m) => m.battles[0].enemies)).toEqual([['kiln'], ['vesper']]);
    // The foundry keeps everybody's heat in, which suits the machine with the higher limit; the plaza's air is clear.
    expect([duel(3), duel(4)].map((m) => groundFor(m.battles[0].background)?.id)).toEqual(['furnace', 'clear']);
    // Each pays more than the first sword did, and the last pays most of anything beside the story.
    expect(duel(3).reward).toBeGreaterThan(DUELS[1].reward);
    expect(duel(4).reward).toBeGreaterThan(duel(3).reward);
  });

  test('each works pilot has a word as the duel opens, another in the third round and a last one on losing; Dispatch speaks up when the pilot is hurt', () => {
    for (const [mission, who, portrait] of [[duel(3), 'Kiln', 'portrait-kiln'], [duel(4), 'Vesper', 'portrait-vesper']] as const) {
      const talk = mission.battles[0].talk ?? [];
      expect(talk.map((line) => [line.at, line.who]), mission.id).toEqual([['start', who], [3, who], ['hurt', 'Dispatch'], ['win', who]]);
      for (const line of talk) {
        expect(line.portrait, `${mission.id} ${line.at}`).toBe(line.who === 'Dispatch' ? 'portrait-dispatch' : portrait);
        expect(line.text.length, `${mission.id} ${line.at}`).toBeGreaterThan(20);
      }
    }
  });

  test('what the briefings say of the machines is what the rules give them', () => {
    // A limit of 130 where any other machine's is 100.
    expect(duel(3).briefing[1]).toContain('its limit is 130 where any other machine\'s is 100');
    expect(heatLimitOf(ENEMIES.kiln.build, CATALOG)).toBe(130);
    expect(Object.values(ENEMIES).filter((e) => heatLimitOf(e.build, CATALOG) !== 100).map((e) => e.id)).toEqual(['kiln']);
    // Both its weapons hit harder the hotter it gets.
    expect(duel(3).briefing[1]).toContain('both its weapons hit harder the hotter it gets');
    const carried = (id: string): Weapon[] => (['rightHand', 'leftHand', 'shoulder'] as const).flatMap((slot) => weaponIn(ENEMIES[id].build, slot, CATALOG) ?? []);
    expect(carried('kiln').map((w) => w.trait)).toEqual(['redline', 'redline']);
    // A turn and a half: what a turn gives, and the half of it the core keeps.
    expect(duel(4).briefing[1]).toContain('its one weapon has a turn and a half behind it');
    expect(bufferOf(ENEMIES.vesper.build, CATALOG)).toBe(50);
    expect(carried('vesper').map((w) => w.trait)).toEqual(['surge']);
  });

  test('the two works pilots are met in their duels and nowhere else: not in the story, not on the board, not in the arena', () => {
    const elsewhere = MISSIONS.filter((m) => m.series !== 'duel').flatMap((m) => m.battles.flatMap((b) => [...b.enemies, ...(b.reserve ?? [])]));
    for (const id of ['kiln', 'vesper']) {
      expect(elsewhere, id).not.toContain(id);
      expect(STORY_ENEMIES, id).toContain(id);
      expect(MECH_ENEMIES, id).toContain(id);
      // Dearer than the first sword: nothing the board can afford.
      expect(ENEMY_COST[id], id).toBeGreaterThan(ENEMY_COST.argent);
      expect(ARENA.map((o) => ALL_ENEMIES[o.enemy].name), id).not.toContain(ENEMIES[id].name);
    }
  });

  test('are offered one at a time once the first sword has fallen, and are there again in a later telling', () => {
    const two = completeMission(completeMission(ended(), 'duel-1', MISSIONS), 'duel-2', MISSIONS);
    expect(duels(two)).toEqual(['duel-3']);
    const three = completeMission(two, 'duel-3', MISSIONS);
    expect(duels(three)).toEqual(['duel-4']);
    const all = completeMission(three, 'duel-4', MISSIONS);
    expect(duels(all)).toEqual([]);
    let later = startNewCycle(all, MISSIONS);
    expect(duels(later)).toEqual([]);
    for (const id of [...STORY, 'verdict-enforce', 'duel-1', 'duel-2']) later = completeMission(later, id, MISSIONS);
    expect(duels(later)).toEqual(['duel-3']);
  });

  test('each of the two has a page among the units and a page among the people, which opens when they have been met', () => {
    for (const id of ['kiln', 'vesper']) {
      expect(UNITS.filter((page) => page.id === id), id).toHaveLength(1);
      const person = PEOPLE.find((p) => p.id === id)!;
      expect(person).toMatchObject({ name: ENEMIES[id].name, portrait: ENEMIES[id].portrait, role: 'Coast yard', when: { met: id } });
      expect(person.portrait in SPRITES, person.portrait).toBe(true);
    }
    // The pages come after the two swords', in the order the duels are fought.
    const order = PEOPLE.map((p) => p.id);
    expect(order.slice(order.indexOf('argent'), order.indexOf('argent') + 3)).toEqual(['argent', 'kiln', 'vesper']);
  });
});

describe('what a works duel won opens', () => {
  test('the Sirocco is sold to a pilot who has won the third duel and the Solstice to one who has won the fourth: before that neither is on the shelf', () => {
    expect(Object.fromEntries([...SIROCCO, ...SOLSTICE].map((id) => [id, SHOP_UNLOCKS[id]]))).toEqual({
      ...Object.fromEntries(SIROCCO.map((id) => [id, 'won:duel-3'])), ...Object.fromEntries(SOLSTICE.map((id) => [id, 'won:duel-4'])),
    });
    const two = won(won(ended(), 'duel-1'), 'duel-2');
    expect(works(two)).toEqual([]);
    const three = won(two, 'duel-3');
    expect(works(three)).toEqual(SIROCCO);
    const four = won(three, 'duel-4');
    expect(works(four)).toEqual([...SIROCCO, ...SOLSTICE]);
    // Won for good: the frames stay on the shelf when the story starts over.
    expect(works(startNewCycle(four, MISSIONS))).toEqual([...SIROCCO, ...SOLSTICE]);
    // Flown and lost, a duel opens nothing: only a rank does.
    expect(works(completeMission(two, 'duel-3', MISSIONS))).toEqual([]);
  });

  test('the purse of the duel that opens a frame does not pay for it: a win is the right to buy, not the frame', () => {
    const price = (ids: string[]): number => ids.reduce((sum, id) => sum + CATALOG[id].price, 0);
    expect(duel(3).reward).toBeLessThan(price(SIROCCO));
    expect(duel(4).reward).toBeLessThan(price(SOLSTICE));
    // Each costs more than the Sterling the first sword flew.
    const sterling = price(['head-sterling', 'core-sterling', 'arms-sterling', 'legs-sterling']);
    expect(price(SIROCCO)).toBeGreaterThan(sterling);
    expect(price(SOLSTICE)).toBeGreaterThan(sterling);
  });

  test('the medal is for both: a duel won is one that has left a rank', () => {
    const medal = MEDALS.find((m) => m.id === 'works')!;
    expect(medal).toMatchObject({ name: 'Works Order', tier: 3 });
    expect(WORKS_DUELS).toEqual(['duel-3', 'duel-4']);
    const two = won(won(ended(), 'duel-1'), 'duel-2');
    expect(medal.progress(two)).toEqual({ have: 0, need: 2 });
    expect(medal.progress(completeMission(two, 'duel-3', MISSIONS))).toEqual({ have: 0, need: 2 });
    const three = won(two, 'duel-3');
    expect(medal.progress(three)).toEqual({ have: 1, need: 2 });
    expect(medal.progress(won(three, 'duel-4'))).toEqual({ have: 2, need: 2 });
    // The two swords of the Circuit do not count towards it.
    expect(medal.progress(two).have).toBe(0);
  });
});

describe('the two works pilots', () => {
  const pilots = [['kiln', SIROCCO], ['vesper', SOLSTICE]] as const;

  test.each(pilots)('%s flies the whole frame it is beaten for, within what its legs carry and its generator feeds, in the frame\'s own colours', (id, parts) => {
    const def = ENEMIES[id];
    expect(def).toMatchObject({ composed: true, portrait: `portrait-${id}`, plating: 1, ai: 'gunner' });
    expect([def.build.head, def.build.core, def.build.arms, def.build.legs]).toEqual(parts);
    const stats = computeBuildStats(def.build, CATALOG);
    expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
    expect(stats.turnEnergy).toBeGreaterThan(0);
    expect(def.paint).toBeUndefined();
    // Nothing that cools, nothing that mends: what the frame does is all there is.
    expect(def.build.module).toBeUndefined();
  });

  test('are plated to last a duel: twice the armour of the frame as it is sold, times what the duel scales them by', () => {
    for (const [n, id, parts] of [[3, 'kiln', SIROCCO], [4, 'vesper', SOLSTICE]] as const) {
      const scale = duel(n).scale!;
      const foe = unit(createBattle(REFERENCE_BUILDS.tier5, [ENEMIES[id]], CATALOG, 1, { enemyScale: scale }), 'enemy-0');
      for (const id2 of parts) {
        const part = CATALOG[id2] as FramePart;
        expect(foe.parts[part.kind as 'core']!.maxAp, id2).toBe(Math.round(part.ap * 2 * scale));
      }
      expect(foe.staggerMax, id).toBe(Math.round(computeBuildStats(ENEMIES[id].build, CATALOG).stability * scale));
      expect(foe.mods.damage, id).toBe(scale);
    }
    expect([duel(3).scale, duel(4).scale]).toEqual([1.15, 1.3]);
  });

  test('Kiln is hotter every round it is left alone and hits harder for it, and never cooks itself', () => {
    let s = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.kiln], CATALOG, 3, { enemyScale: 1.15, ground: groundFor('bg-foundry') });
    const lifts: number[][] = [];
    const heats: number[] = [];
    for (let round = 1; round <= 6; round++) {
      for (let guard = 0; guard < 6 && activeUnit(s).id !== 'enemy-0'; guard++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
      const before = s.events.length;
      for (let guard = 0; guard < 12 && activeUnit(s).id === 'enemy-0' && s.outcome === 'ongoing'; guard++) s = applyAction(s, chooseEnemyAction(s, CATALOG), CATALOG, () => 0);
      lifts.push(s.events.slice(before).flatMap((e) => (e.type === 'shot' && e.unit === 'enemy-0' ? [e.lift ?? 100] : [])));
      heats.push(unit(s, 'enemy-0').heat);
      expect(s.events.slice(before).some((e) => e.type === 'overheat' && e.unit === 'enemy-0'), `round ${round}`).toBe(false);
    }
    // The first shot of the duel is fired cold, at what the weapon is listed at; by the third round every shot is at three times that or more.
    expect(lifts[0][0]).toBe(100);
    expect(Math.min(...lifts[2])).toBeGreaterThanOrEqual(300);
    expect(Math.max(...lifts.flat())).toBeGreaterThan(400);
    // It ends its rounds hotter than any other machine could: past a hundred, and never past its own limit.
    expect(Math.max(...heats)).toBeGreaterThan(100);
    expect(Math.max(...heats)).toBeLessThanOrEqual(130);
    // Its heaviest hit is worth more than three of its first.
    const shots = (CATALOG['wpn-enemy-brand'] as Weapon).traitPower!;
    expect(shots).toBe(36);
  });

  test('heated past even its own limit it loses a turn, as the briefing says', () => {
    let s = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.kiln], CATALOG, 3, { enemyScale: 1.15 });
    for (let guard = 0; guard < 6 && activeUnit(s).id !== 'player'; guard++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
    const cooked = structuredClone(s);
    unit(cooked, 'enemy-0').heat = 131;
    unit(cooked, 'enemy-0').overheated = true;
    const before = cooked.events.length;
    const next = applyAction(cooked, { type: 'endTurn' }, CATALOG);
    expect(next.events.slice(before)).toContainEqual({ type: 'turnSkipped', unit: 'enemy-0' });
    expect(next.events.slice(before).some((e) => e.type === 'shot' && e.unit === 'enemy-0')).toBe(false);
    expect(unit(next, 'enemy-0').heat).toBeLessThanOrEqual(50);
  });
});

describe('how hard the works duels are', () => {
  const HAMMER: Build = {
    head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-singularity', booster: 'bst-stock',
    fcs: 'fcs-omni', module: 'mod-aegis', rightHand: 'wpn-gavel', shoulder: 'wpn-howler',
  };
  const THERMAL: Build = {
    head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-hawkeye',
    module: 'mod-coolant', rightHand: 'wpn-plasma', leftHand: 'wpn-thermal-lance',
  };

  test('the third: what staggers it nearly always wins and what heats it mostly does; a Wraith with a blade has a real chance, and the build the story ends in less of one', () => {
    expect(rate(HAMMER, duel(3))).toBeGreaterThanOrEqual(0.9);
    expect(rate(THERMAL, duel(3))).toBeGreaterThanOrEqual(0.55);
    const wraith = rate(REFERENCE_BUILDS.tier5, duel(3));
    expect(wraith).toBeGreaterThanOrEqual(0.25);
    expect(wraith).toBeLessThanOrEqual(0.8);
    expect(rate(REFERENCE_BUILDS.tier4, duel(3))).toBeLessThanOrEqual(0.6);
  }, LONG);

  test('the fourth: the game\'s own pilot braces for what was kept, and wins it more often than not in a Wraith, a Colossus or the build the story ends in; never as a matter of course', () => {
    for (const build of [REFERENCE_BUILDS.tier5, REFERENCE_BUILDS.tier6, REFERENCE_BUILDS.tier4]) {
      const got = rate(build, duel(4));
      expect(got).toBeGreaterThanOrEqual(0.4);
      expect(got).toBeLessThanOrEqual(0.95);
    }
    expect(rate(HAMMER, duel(4))).toBeGreaterThanOrEqual(0.9);
  }, LONG);

  test('neither is for a pilot who has learnt nothing: without a perk to its name a Wraith loses both far more often than it wins, and a Colossus the fourth nearly always', () => {
    expect(rate(REFERENCE_BUILDS.tier5, duel(3), {})).toBeLessThan(0.4);
    expect(rate(REFERENCE_BUILDS.tier5, duel(4), {})).toBeLessThan(0.3);
    expect(rate(REFERENCE_BUILDS.tier6, duel(4), {})).toBeLessThan(0.3);
    // The Colossus outlasts the third about half the time, and no more than that.
    expect(rate(REFERENCE_BUILDS.tier6, duel(3), {})).toBeLessThanOrEqual(0.75);
  }, LONG);
});
