import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { ARCHETYPES, CLASS_AI, archetypeOf, type Archetype } from '../../src/core/archetype';
import { createBattle } from '../../src/core/battle';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { unreadMessages } from '../../src/core/campaign';
import { newGame } from '../../src/core/game';
import { masterEnemy, masterId, masterMission } from '../../src/core/masters';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { rangeKinds } from '../../src/core/range';
import type { FramePart, Part } from '../../src/core/types';
import { ALL_ENEMIES, ARENA, ARENA_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { PEOPLE, UNITS } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { MASTERS, MASTER_ENEMIES, masterOf } from '../../src/content/masters';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { WINGMEN } from '../../src/content/wingmen';
import { LOGICAL_W } from '../../src/ui/display';
import { done } from '../helpers/app';
import { CROWN_PAINTS, PAINTS, paintById, rampOf } from '../../src/ui/paint';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * The seven masters of the arena as the game has them: who they are, what they fly, what they wear,
 * what they say, and how hard each is to take the crown from.
 */

const game = newGame(CATALOG, STARTER_BUILD);
const partsOf = (kind: Archetype): Part[] => Object.values(masterOf(kind).build).filter((id): id is string => id !== undefined).map((id) => CATALOG[id]);

describe('the seven masters', () => {
  test('are one of each class, in the order the rules ask about the classes', () => {
    expect(MASTERS.map((master) => master.kind)).toEqual([...ARCHETYPES]);
    for (const kind of ARCHETYPES) expect(masterOf(kind).kind).toBe(kind);
  });

  test.each(ARCHETYPES.map((kind) => [kind]))('the master of the %ss flies a machine of that class, by the rule that names the pilot\'s own', (kind) => {
    expect(archetypeOf(masterOf(kind as Archetype).build, CATALOG)).toBe(kind);
  });

  test.each(ARCHETYPES.map((kind) => [kind]))('the machine of the %ss\' master could be a pilot\'s: parts a pilot can own, within what its legs carry and its generator makes', (kind) => {
    const master = masterOf(kind as Archetype);
    expect(validatePlayerBuild(master.build, CATALOG)).toEqual([]);
    const stats = computeBuildStats(master.build, CATALOG);
    expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
    for (const part of partsOf(kind as Archetype)) expect(part.vendor, part.id).toBeDefined();
  });

  test('every part a master flies has its picture, so the machine is drawn from its own parts', () => {
    const pictured = Object.keys(SPRITES);
    for (const master of MASTERS) {
      // What is drawn of a machine: its frame, and what it carries. What is inside it has no picture.
      for (const slot of ['head', 'core', 'arms', 'legs', 'rightHand', 'leftHand', 'shoulder'] as const) {
        const id = master.build[slot];
        if (id !== undefined) expect(pictured.some((key) => key === id || key.startsWith(`${id}.`)), `${master.name}: ${id}`).toBe(true);
      }
      expect(MASTER_ENEMIES[masterId(master.kind)].composed).toBe(true);
    }
  });

  test('no two fly the same frame on the same legs, and none flies a build the game suggests to the pilot', () => {
    const frames = MASTERS.map((master) => [master.build.head, master.build.core, master.build.arms, master.build.legs].join('/'));
    expect(new Set(frames).size).toBe(7);
    const weapons = MASTERS.map((master) => [master.build.rightHand, master.build.leftHand, master.build.shoulder].join('/'));
    expect(new Set(weapons).size).toBe(7);
    const suggested = ARCHETYPES.flatMap((kind) => Object.values(ARCHETYPE_BUILDS[kind]));
    for (const master of MASTERS) expect(suggested, master.name).not.toContainEqual(master.build);
  });

  test('have names of their own: no two alike, and none that anyone else in the game goes by', () => {
    const names = MASTERS.map((master) => master.name);
    expect(names).toEqual(['Quillon', 'Plumb', 'Cadence', 'Filament', 'Keystone', 'Mayfly', 'Journeyman']);
    expect(new Set(names).size).toBe(7);
    const taken = [
      ...ARENA.map((opponent) => opponent.name), ...Object.values(ENEMIES).map((enemy) => enemy.name), ...WINGMEN.map((wingman) => wingman.name),
      ...PEOPLE.map((person) => person.name), STRINGS.arena.mirror.name, ...Object.values(STRINGS.classes.names),
    ].map((name) => name.toLowerCase());
    for (const name of names) expect(taken, name).not.toContain(name.toLowerCase());
  });

  test('each wears the paint of their class\'s crown: seven paints that are nobody else\'s', () => {
    expect(CROWN_PAINTS.map((paint) => paint.crown)).toEqual([...ARCHETYPES]);
    for (const master of MASTERS) {
      const paint = paintById(master.paint);
      expect(paint, master.name).toBeDefined();
      expect(CROWN_PAINTS.find((scheme) => scheme.id === master.paint)?.crown, master.name).toBe(master.kind);
    }
    const ids = CROWN_PAINTS.map((paint) => paint.id);
    expect(new Set(ids).size).toBe(7);
    expect(new Set(CROWN_PAINTS.map((paint) => paint.name)).size).toBe(7);
    // None is a paint anyone may wear, by its id or by its name; nobody on the ladder wears one.
    for (const paint of CROWN_PAINTS) {
      expect(PAINTS.some((free) => free.id === paint.id || free.name === paint.name), paint.id).toBe(false);
      expect(Object.values(ARENA_ENEMIES).some((def) => def.paint === paint.id), paint.id).toBe(false);
      expect(paint.id).toMatch(/^[a-z]{1,24}$/);
    }
  });

  test('the seven paints can be told from each other and from the twelve anyone may wear: in hue, in how strong the colour is, or in how dark', () => {
    const all = [...PAINTS, ...CROWN_PAINTS];
    const turn = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    for (const paint of CROWN_PAINTS) {
      for (const other of all) {
        if (other === paint) continue;
        // A grey has no hue to speak of: two greys differ by how dark they are, or by their trim.
        const hue = Math.min(paint.sat, other.sat) >= 0.25 ? turn(paint.hue, other.hue) : 0;
        const apart = hue >= 20 || Math.abs(paint.sat - other.sat) >= 0.2 || Math.abs((paint.shade ?? 0) - (other.shade ?? 0)) >= 0.1 || turn(paint.accentHue, other.accentHue) >= 60;
        expect(apart, `${paint.id} and ${other.id}`).toBe(true);
      }
    }
  });

  test.each(CROWN_PAINTS.map((paint) => [paint.name, paint] as const))('%s has a ramp that runs from dark to light', (_name, scheme) => {
    const ramp = rampOf(scheme);
    const luma = ([r, g, b]: number[]): number => 0.299 * r + 0.587 * g + 0.114 * b;
    for (let i = 1; i < ramp.length; i++) expect(luma(ramp[i])).toBeGreaterThan(luma(ramp[i - 1]));
  });

  test('each has a line about how they fight that fits the arena\'s page, something to say before the duel, and a word for whoever takes the crown', () => {
    for (const master of MASTERS) {
      expect(wrap(master.style, charsFor(LOGICAL_W - 28)).length, master.name).toBeLessThanOrEqual(3);
      expect(master.style.length, master.name).toBeGreaterThan(60);
      expect(master.taunt.length, master.name).toBeGreaterThan(10);
      expect(master.concede.length, master.name).toBeGreaterThan(10);
      // What they give up is said in the settlement, where three lines of the bill's width are free.
      expect(wrap(master.concede, charsFor(210)).length, master.name).toBeLessThanOrEqual(3);
    }
    expect(new Set(MASTERS.flatMap((master) => [master.style, master.taunt, master.concede])).size).toBe(21);
  });

  test('the line about how each fights names what they carry: every weapon and shield of theirs, or what it is', () => {
    const said: Record<string, string> = {
      'wpn-gavel': 'Gavel', 'wpn-arc-blade': 'arc blade', 'wpn-longbow': 'Longbow', 'wpn-decree': 'Decree', 'wpn-writ': 'Writ rifle', 'wpn-frag-launcher': 'frag launcher',
      'wpn-hornet-salvo': 'Hornet salvo', 'wpn-lance-emitter': 'lance emitter', 'wpn-disruptor': 'disruptor', 'wpn-null-beam': 'null beam', 'wpn-void-rifle': 'void rifle',
      'shd-tower': 'tower shield', 'wpn-breaker-cannon': 'breaker cannon', 'wpn-needler': 'needler', 'wpn-pulse-carbine': 'pulse carbine', 'wpn-howler': 'howler',
    };
    for (const master of MASTERS) {
      for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) {
        const id = master.build[slot];
        if (id === undefined) continue;
        expect(said[id], id).toBeDefined();
        expect(master.style, `${master.name}: ${id}`).toContain(said[id]);
        // What it is called there is what the part is called, give or take a capital.
        expect(CATALOG[id].name.toLowerCase(), id).toContain(said[id].toLowerCase().split(' ')[0]);
      }
    }
  });
});

describe('the masters on the field', () => {
  test('every battle knows them, as the opponents their rules make of them', () => {
    for (const master of MASTERS) {
      expect(ALL_ENEMIES[masterId(master.kind)]).toEqual(masterEnemy(master));
      expect(ALL_ENEMIES[masterId(master.kind)]).toMatchObject({ name: master.name, ai: CLASS_AI[master.kind], paint: master.paint, build: master.build });
    }
    expect(Object.keys(MASTER_ENEMIES)).toEqual(ARCHETYPES.map(masterId));
    // They are no enemies of the story and no rungs of the ladder.
    for (const id of Object.keys(MASTER_ENEMIES)) {
      expect(Object.hasOwn(ENEMIES, id), id).toBe(false);
      expect(Object.hasOwn(ARENA_ENEMIES, id), id).toBe(false);
    }
  });

  test.each(MASTERS.map((master) => [master.name, master] as const))('%s is plated and scaled as written: armour by both, damage by the scale alone', (_name, master) => {
    const mission = masterMission(game, master, { client: '', win: '' });
    const battle = createBattle(STARTER_BUILD, [ALL_ENEMIES[mission.battles[0].enemies[0]]], CATALOG, 1, { enemyScale: mission.scale });
    const foe = battle.units.find((unit) => unit.id === 'enemy-0')!;
    for (const slot of ['head', 'core', 'arms', 'legs'] as const) {
      const part = CATALOG[master.build[slot]!] as FramePart;
      expect(foe.parts[slot]!.maxAp, slot).toBe(Math.round(part.ap * (1 + (master.plating ?? 0)) * master.scale));
    }
    expect(foe.mods.damage).toBe(master.scale);
    expect(foe.name).toBe(master.name);
  });

  test('the database has no page for them, so the range does not field them: a master is met in the arena', () => {
    const order = UNITS.map((unit) => unit.id);
    for (const master of MASTERS) expect(order).not.toContain(masterId(master.kind));
    expect(rangeKinds({ met: ARCHETYPES.map(masterId) }, order)).toEqual([]);
  });
});

describe('the arena office tells a champion', () => {
  test('a message arrives when the pilot becomes champion, and not before: who the masters are, what takes a crown, and where they are found', () => {
    const message = MESSAGES.find((m) => m.id === 'masters')!;
    expect(message).toMatchObject({ from: 'Arena Office', after: 'arena:10' });
    const arrived = (arenaRank: number): string[] => unreadMessages({ ...done('intro-1', 'intro-2'), arenaRank }, MESSAGES, MISSIONS).map((m) => m.id);
    expect(arrived(9)).not.toContain('masters');
    expect(arrived(10)).toContain('masters');
    expect(arrived(15)).toContain('masters');
    // It comes with the word about the back room, and after it.
    const ids = MESSAGES.map((m) => m.id);
    expect(ids.indexOf('masters')).toBe(ids.indexOf('back-room') + 1);
    expect(ids.filter((id) => id === 'masters')).toHaveLength(1);
    // What it says is what the rules are.
    const text = message.body.join(' ');
    expect(text).toContain('Seven pilots');
    expect(MASTERS).toHaveLength(7);
    expect(text).toContain('Any machine may challenge one, for a purse.');
    expect(text).toContain('Beat a master in a machine of their own class and their title is yours');
    expect(text).toMatch(/on the page beside the ladder\.$/);
    expect(STRINGS.arena.pages).toEqual({ ladder: 'LADDER', masters: 'MASTERS' });
  });
});

describe('how hard the masters are', () => {
  const perks = (ranks: Record<string, number>): object => {
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
    return { aim, evasion, energy, cooling, repairs, armour };
  };
  /** A pilot who has finished the story (six ranks of the usual perks), one who has learnt nothing, and one who has learnt everything that helps in a fight. */
  const VETERAN = perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 });
  const NOVICE = {};
  const MASTERED = perks({ marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 });
  const FLIGHTS = 40;
  /** How the game's own automatic pilot does against a master in the late build of a class: wins in a hundred, and the rounds a win takes. */
  function flown(master: (typeof MASTERS)[number], challenger: Archetype, mods: object): { won: number; rounds: number } {
    const mission = masterMission(game, master, { client: '', win: '' });
    let wins = 0;
    let rounds = 0;
    for (let flight = 1; flight <= FLIGHTS; flight++) {
      const seed = flight % 2 ? flight * 7919 : flight * 104729 + 13;
      const end = playMission(ARCHETYPE_BUILDS[challenger].late, mission, ALL_ENEMIES, CATALOG, seed, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') { wins += 1; rounds += end.round; }
    }
    return { won: Math.round((wins / FLIGHTS) * 100), rounds: wins ? rounds / wins : 0 };
  }
  const LONG = 60_000;

  test.each(MASTERS.map((master) => [master.name, master] as const))('%s, in the late build of their own class: a veteran takes the crown about half the time, a pilot with no perks seldom, one with every perk nearly always', (_name, master) => {
    const veteran = flown(master, master.kind, VETERAN);
    const novice = flown(master, master.kind, NOVICE);
    const mastered = flown(master, master.kind, MASTERED);
    expect(veteran.won).toBeGreaterThanOrEqual(30);
    expect(veteran.won).toBeLessThanOrEqual(80);
    expect(novice.won).toBeLessThanOrEqual(40);
    expect(novice.won).toBeLessThan(veteran.won);
    expect(mastered.won).toBeGreaterThanOrEqual(70);
    expect(mastered.won).toBeGreaterThan(veteran.won);
    // A duel won is won in good time: nobody takes a crown by outlasting a wall.
    expect(veteran.rounds).toBeGreaterThanOrEqual(3);
    expect(veteran.rounds).toBeLessThanOrEqual(12);
  }, LONG);

  test('none is set harder than a ladder fight is ever set, and the purse is one figure for all seven', () => {
    for (const master of MASTERS) {
      expect(master.scale, master.name).toBeGreaterThanOrEqual(0.8);
      expect(master.scale, master.name).toBeLessThanOrEqual(1.6);
      expect(master.plating ?? 0, master.name).toBeGreaterThanOrEqual(0);
      expect(master.plating ?? 0, master.name).toBeLessThanOrEqual(3);
      expect(masterMission(game, master, { client: '', win: '' }).reward).toBe(9000);
    }
  });
});
