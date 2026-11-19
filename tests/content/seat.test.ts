import { chooseAutoPlayerAction, runBattle, stepBattle } from '../../src/core/ai';
import { CLASS_AI, archetypeOf, type Archetype } from '../../src/core/archetype';
import { createBattle, type BattleState } from '../../src/core/battle';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { newGame } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { SEAT_ID, keeperEnemy, seatMission } from '../../src/core/seat';
import type { Build, FramePart } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { MASTERS } from '../../src/content/masters';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { KEEPER, SEAT_ENEMIES } from '../../src/content/seat';
import { TALK_CHARS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS } from '../../src/ui/briefingScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { CROWN_PAINTS, PAINTS, SEAT_PAINT, paintById, rampOf } from '../../src/ui/paint';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * Touchstone, who keeps the eighth seat: the machine, the three ways it fights, what its pilot says,
 * and how hard the duel is.
 */

const game = newGame(CATALOG, STARTER_BUILD);
/** The machine as it is in each of its three ways of fighting: as the duel begins, and after each change. */
const SHAPES: Build[] = [KEEPER.build, ...KEEPER.phases.map((_, i) => KEEPER.phases.slice(0, i + 1).reduce<Build>((build, phase) => ({ ...build, ...phase.refit }), KEEPER.build))];

describe('the keeper', () => {
  test('is Touchstone, in the Sovereign from head to foot, and is the enemy the duel fields', () => {
    expect(KEEPER.name).toBe('Touchstone');
    for (const build of SHAPES) {
      expect([build.head, build.core, build.arms, build.legs]).toEqual(['head-sovereign', 'core-sovereign', 'arms-sovereign', 'legs-sovereign']);
    }
    expect(SEAT_ENEMIES).toEqual({ [SEAT_ID]: keeperEnemy(KEEPER) });
    expect(ALL_ENEMIES[SEAT_ID]).toEqual(keeperEnemy(KEEPER));
    expect(seatMission(game, KEEPER, { client: '', win: '' }).battles).toEqual([{ enemies: [SEAT_ID], background: 'bg-arena' }]);
    // No master is called so, and none flies that frame: it was built for the seat's keeper.
    expect(MASTERS.some((master) => master.name === KEEPER.name)).toBe(false);
    expect(MASTERS.some((master) => Object.values(master.build).some((id) => id!.endsWith('-sovereign')))).toBe(false);
  });

  test('the machine fights three ways, each a machine a pilot could put together: a marksman\'s, a lancer\'s and a duellist\'s', () => {
    expect(SHAPES).toHaveLength(3);
    expect(SHAPES.map((build) => archetypeOf(build, CATALOG))).toEqual(['marksman', 'lancer', 'duellist']);
    for (const build of SHAPES) {
      expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
      const stats = computeBuildStats(build, CATALOG);
      expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
      expect(stats.turnEnergy).toBeGreaterThanOrEqual(300);
    }
    // At range: a rail that charges, and a howler for whoever is charging their own. Then light, one beam of which drains. Then two blades.
    expect([SHAPES[0].rightHand, SHAPES[0].leftHand, SHAPES[0].shoulder]).toEqual(['wpn-longbow', undefined, 'wpn-howler']);
    expect([SHAPES[1].rightHand, SHAPES[1].leftHand, SHAPES[1].shoulder]).toEqual(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam']);
    expect([SHAPES[2].rightHand, SHAPES[2].leftHand, SHAPES[2].shoulder]).toEqual(['wpn-gavel', 'wpn-arc-blade', 'wpn-howler']);
    const weapon = (id: string) => CATALOG[id] as { charge?: boolean; melee?: boolean; trait?: string; damageType: string; impact?: number };
    expect(weapon('wpn-longbow').charge).toBe(true);
    expect(weapon('wpn-howler').impact).toBeGreaterThan(100);
    expect(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam'].map((id) => weapon(id).damageType)).toEqual(['energy', 'energy', 'energy']);
    expect(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam'].filter((id) => weapon(id).trait === 'drain')).toEqual(['wpn-null-beam']);
    expect([weapon('wpn-gavel').melee, weapon('wpn-arc-blade').melee]).toEqual([true, true]);
  });

  test('it changes twice, as a boss does: at two thirds of its core and at one third, each time flown another way and with a line of its pilot\'s', () => {
    expect(KEEPER.phases.map((phase) => phase.at)).toEqual([0.66, 0.33]);
    expect(KEEPER.phases.map((phase) => phase.ai)).toEqual(['skirmisher', 'bruiser']);
    expect(keeperEnemy(KEEPER).ai).toBe(CLASS_AI.marksman);
    // It moves more when it turns to light, and hits a little harder at the end; nothing else about it is changed.
    expect(KEEPER.phases.map(({ evasion, damage, aim, energy }) => ({ evasion, damage, aim, energy }))).toEqual([
      { evasion: 6, damage: undefined, aim: undefined, energy: undefined }, { evasion: undefined, damage: 1.1, aim: undefined, energy: undefined },
    ]);
    for (const phase of KEEPER.phases) {
      expect(phase.line!.length).toBeGreaterThan(20);
      // A line of talk on the field holds two rows.
      expect(wrap(phase.line!, TALK_CHARS).length).toBeLessThanOrEqual(2);
      // Every weapon changes with it, and the module: nothing of the last way is left in the hands.
      expect(Object.keys(phase.refit!).sort()).toEqual(['leftHand', 'module', 'rightHand', 'shoulder']);
    }
  });

  test('what is said of it and by it fits where a master\'s words stand', () => {
    expect(wrap(KEEPER.style, charsFor(LOGICAL_W - 28)).length).toBeLessThanOrEqual(3);
    expect(KEEPER.style.length).toBeGreaterThan(60);
    // It says what the three ways are, in the order they come.
    const at = ['charging rail', 'howler', 'light that drains', 'two blades'].map((word) => KEEPER.style.indexOf(word));
    expect(at.every((index) => index > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(wrap(`"${KEEPER.taunt}"`, BRIEFING_CHARS).length).toBeLessThanOrEqual(2);
    expect(wrap(`"${KEEPER.concede}"`, charsFor(210)).length).toBeLessThanOrEqual(3);
    expect(KEEPER.taunt).toContain('Seven crowns');
  });

  test('its paint is the keeper\'s own: no scheme anyone may wear and no crown\'s, black with gold in it', () => {
    expect(KEEPER.paint).toBe('touchstone');
    expect(SEAT_PAINT).toMatchObject({ id: 'touchstone', name: 'Touchstone' });
    expect(paintById('touchstone')).toBe(SEAT_PAINT);
    expect([...PAINTS, ...CROWN_PAINTS].some((paint) => paint.id === SEAT_PAINT.id || paint.name === SEAT_PAINT.name)).toBe(false);
    // Black: its armour is darker, stop for stop, than any other scheme's, and next to grey.
    const luma = ([r, g, b]: number[]): number => 0.299 * r + 0.587 * g + 0.114 * b;
    const mine = rampOf(SEAT_PAINT).map(luma);
    for (const other of [...PAINTS, ...CROWN_PAINTS]) {
      const theirs = rampOf(other).map(luma);
      expect(mine.reduce((sum, value) => sum + value, 0), other.id).toBeLessThan(theirs.reduce((sum, value) => sum + value, 0));
    }
    expect(SEAT_PAINT.sat).toBeLessThanOrEqual(0.1);
    // With gold in it: its trim is a full yellow-gold.
    expect(SEAT_PAINT.accentHue).toBeGreaterThanOrEqual(40);
    expect(SEAT_PAINT.accentHue).toBeLessThanOrEqual(52);
    expect(SEAT_PAINT.accentSat).toBeGreaterThanOrEqual(0.85);
  });
});

describe('on the field', () => {
  /** A battle against the keeper with its core brought down to a share of what it had. */
  const hurt = (share: number): BattleState => {
    const state = createBattle(DEMO_BUILD, [keeperEnemy(KEEPER)], CATALOG, 11, { enemyScale: KEEPER.scale });
    const core = state.units[1].parts.core!;
    core.ap = Math.ceil(core.maxAp * share);
    return state;
  };
  const weapons = (state: BattleState): (string | undefined)[] => [state.units[1].build.rightHand, state.units[1].build.leftHand, state.units[1].build.shoulder];
  /** Fights on as the game's own automatic pilot would, a step at a time, until something has come about or the battle is over. */
  const until = (state: BattleState, done: (s: BattleState) => boolean): BattleState => {
    let s = state;
    for (let i = 0; i < 400 && s.outcome === 'ongoing' && !done(s); i++) s = stepBattle(s, CATALOG, chooseAutoPlayerAction);
    return s;
  };

  test('it stands with a field up and the first loadout, at the strength the duel sets', () => {
    const state = hurt(1);
    const keeper = state.units[1];
    expect(keeper).toMatchObject({ name: 'Touchstone', kind: SEAT_ID, phase: 0, ai: CLASS_AI.marksman, composed: true });
    expect(weapons(state)).toEqual(['wpn-longbow', undefined, 'wpn-howler']);
    const core = CATALOG['core-sovereign'] as FramePart;
    expect(keeper.parts.core!.maxAp).toBe(Math.round(core.ap * KEEPER.scale));
    expect(KEEPER.scale).toBe(0.8);
    expect(KEEPER.plating ?? 0).toBe(0);
  });

  test('hurt to two thirds it turns to light and is flown as a skirmisher; hurt to a third it draws its blades and comes in', () => {
    // Just above each line nothing has changed; a blow that takes it to the line or under changes it.
    const first = until(hurt(0.7), (s) => s.units[1].phase >= 1);
    expect(first.units[1].phase).toBeGreaterThanOrEqual(1);
    const changed = first.events.filter((event) => event.type === 'phase');
    expect(changed[0]).toMatchObject({ type: 'phase', unit: 'enemy-0', phase: 1 });
    if (first.units[1].phase === 1) {
      expect(weapons(first)).toEqual(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam']);
      expect(first.units[1].ai).toBe('skirmisher');
      expect(first.units[1].build.module).toBe('mod-cryo');
    }
    const second = until(hurt(0.36), (s) => s.units[1].phase >= 2);
    expect(second.units[1].phase).toBe(2);
    expect(weapons(second)).toEqual(['wpn-gavel', 'wpn-arc-blade', 'wpn-howler']);
    expect(second.units[1].ai).toBe('bruiser');
    expect(second.units[1].build.module).toBe('mod-overclock');
    // The frame is the frame throughout.
    expect(second.units[1].build.core).toBe('core-sovereign');
  });
});

describe('how hard the duel is', () => {
  const perks = (ranks: Record<string, number>): object => {
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
    return { aim, evasion, energy, cooling, repairs, armour };
  };
  /** A pilot who has finished the story (six ranks of the usual perks), one who has learnt nothing, and one who has learnt everything that helps in a fight. */
  const VETERAN = perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 });
  const NOVICE = {};
  const MASTERED = perks({ marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 });
  const FLIGHTS = 30;
  /** How the game's own automatic pilot does against the keeper in the late build of a class: wins in a hundred, and the rounds a win takes. */
  function flown(challenger: Archetype, mods: object): { won: number; rounds: number } {
    const mission = seatMission(game, KEEPER, { client: '', win: '' });
    let wins = 0;
    let rounds = 0;
    for (let flight = 1; flight <= FLIGHTS; flight++) {
      const seed = flight % 2 ? flight * 7919 : flight * 104729 + 13;
      const end = playMission(ARCHETYPE_BUILDS[challenger].late, mission, ALL_ENEMIES, CATALOG, seed, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') { wins += 1; rounds += end.round; }
    }
    return { won: Math.round((wins / FLIGHTS) * 100), rounds: wins ? rounds / wins : 0 };
  }
  const LONG = 120_000;

  test('a veteran in a build that suits the fight takes the seat between a fifth of the time and most of it, and a win is won in good time', () => {
    // The builds that shoot from afar or stand up to a blow: what was measured was 71, 44, 38 and 31 in a hundred (scripts/masters.ts).
    const suited: [Archetype, number, number][] = [['marksman', 50, 90], ['allrounder', 22, 68], ['artillery', 18, 60], ['bastion', 12, 52]];
    const all: number[] = [];
    for (const [kind, least, most] of suited) {
      const result = flown(kind, VETERAN);
      expect(result.won, kind).toBeGreaterThanOrEqual(least);
      expect(result.won, kind).toBeLessThanOrEqual(most);
      // Three ways of fighting are not got through in three rounds, and nobody takes the seat by outlasting a wall.
      expect(result.rounds, kind).toBeGreaterThanOrEqual(4);
      expect(result.rounds, kind).toBeLessThanOrEqual(22);
      all.push(result.won);
    }
    // Between them, about half the time.
    const mean = all.reduce((sum, won) => sum + won, 0) / all.length;
    expect(mean).toBeGreaterThanOrEqual(33);
    expect(mean).toBeLessThanOrEqual(62);
  }, LONG);

  test('a pilot with no perks seldom does, in the build that does best or any other; one with every perk usually does', () => {
    for (const kind of ['marksman', 'allrounder'] as Archetype[]) expect(flown(kind, NOVICE).won, kind).toBeLessThanOrEqual(34);
    for (const kind of ['allrounder', 'bastion'] as Archetype[]) expect(flown(kind, MASTERED).won, kind).toBeGreaterThanOrEqual(62);
  }, LONG);

  test('it is set no harder than a master is ever set, and its purse is the largest the arena pays', () => {
    expect(KEEPER.scale).toBeGreaterThanOrEqual(0.7);
    expect(KEEPER.scale).toBeLessThanOrEqual(Math.max(...MASTERS.map((master) => master.scale)));
    expect(seatMission(game, KEEPER, { client: '', win: '' }).reward).toBe(15000);
    expect(seatMission(game, KEEPER, { client: '', win: '' }).scale).toBe(KEEPER.scale);
  });
});
