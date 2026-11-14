import { completeMission } from '../../src/core/campaign';
import { metByRecord, openEntries, unitSheet, type Entry } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { MANUAL, UNITS, WORLD } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const did = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
const entry = (id: string, after: string): Entry => ({ id, title: id.toUpperCase(), text: 'Words.', after });

describe('entries about the world', () => {
  const entries = [entry('city', 'start'), entry('rival', 'rival-1'), entry('war', 'choice'), entry('pit', 'arena:2')];

  test('open when their time has come, in list order, and are kept on the game', () => {
    const { game, opened } = openEntries(fresh(), entries, MISSIONS);
    expect(opened.map((e) => e.id)).toEqual(['city']);
    expect(game.codex).toEqual(['city']);
    const later = openEntries({ ...did('rival-1', 'choice-lumen'), codex: ['city'], arenaRank: 2 }, entries, MISSIONS);
    expect(later.opened.map((e) => e.id)).toEqual(['rival', 'war', 'pit']);
    expect(later.game.codex).toEqual(['city', 'rival', 'war', 'pit']);
  });

  test('an entry once open stays open, and is not opened twice', () => {
    const g = { ...fresh(), codex: ['city', 'war'] };
    const { game, opened } = openEntries(g, entries, MISSIONS);
    expect(opened).toEqual([]);
    expect(game).toBe(g);
  });
});

describe('what the database knows of a unit', () => {
  test('its armour all told, its weapons, and what its core is weak to and tough against', () => {
    expect(unitSheet(ENEMIES['gun-turret'], CATALOG)).toEqual({
      armour: 260, weak: 'explosive', strong: 'kinetic', weapons: [{ name: 'Bastion Cannon', type: 'kinetic' }],
    });
    expect(unitSheet(ENEMIES.overseer, CATALOG)).toMatchObject({ armour: 590, weak: null, strong: 'energy' });
    expect(unitSheet(ENEMIES.leviathan, CATALOG)).toMatchObject({ weak: 'energy', strong: 'explosive' });
  });

  test('a core that takes everything alike has no weakness and no strength; two types that tie for softest name none', () => {
    expect(unitSheet(ENEMIES['recon-drone'], CATALOG)).toMatchObject({ armour: 80, weak: null, strong: null });
    // The Overseer's core is as soft to kinetic as to explosive: neither is "the" weakness.
    expect(unitSheet(ENEMIES.overseer, CATALOG).weak).toBeNull();
    expect(unitSheet(ENEMIES['shield-drone'], CATALOG)).toMatchObject({ weak: null, strong: 'energy' });
  });

  test('a difference too small to choose a weapon by is not called a weakness or a strength', () => {
    // The Stalker's core: kinetic 0.15, energy 0.2, explosive 0.1. Five points either way is not worth a line.
    expect(unitSheet(ENEMIES.stalker, CATALOG)).toMatchObject({ weak: null, strong: null });
    // A Bailiff is armoured alike all round, as its page says.
    expect(unitSheet(ENEMIES.bailiff, CATALOG)).toMatchObject({ weak: null, strong: null });
    // Ten points is.
    expect(unitSheet(ENEMIES.jammer, CATALOG).weak).toBe('explosive');
    expect(unitSheet(ENEMIES['lance-tower'], CATALOG).strong).toBe('kinetic');
    expect(unitSheet(ENEMIES.rival, CATALOG)).toMatchObject({ weak: 'energy', strong: null });
  });

  test('a shield in the hand is no weapon, and a unit without guns has none', () => {
    expect(unitSheet(ENEMIES.bulldozer, CATALOG).weapons.map((w) => w.name)).toEqual(['Breaching Gun', 'Siege Mortar']);
    expect(unitSheet(ENEMIES.jammer, CATALOG).weapons).toEqual([]);
  });
});

describe('the kinds a pilot must have met', () => {
  const ladder = [{ rank: 1, enemy: 'arena-a' }, { rank: 2, enemy: 'arena-b' }, { rank: 3, enemy: 'arena-c' }];

  test('are those of every battle of every contract they have finished, in this cycle or an earlier one', () => {
    const g = { ...did('intro-1'), ranks: { 'rival-1': 'B' as const } };
    const met = metByRecord(g, MISSIONS, ladder);
    const expected = ['intro-1', 'rival-1'].flatMap((id) => MISSIONS.find((m) => m.id === id)!.battles.flatMap((b) => b.enemies));
    expect([...met].sort()).toEqual([...new Set(expected)].sort());
    expect(met).toContain('rival');
  });

  test('and the arena opponents they have beaten', () => {
    expect(metByRecord({ ...fresh(), arenaRank: 2 }, MISSIONS, ladder)).toEqual(['arena-a', 'arena-b']);
  });

  test('what the game already lists comes first and is listed once; a pilot who has done nothing has met nobody', () => {
    expect(metByRecord(fresh(), MISSIONS, ladder)).toEqual([]);
    const g = { ...did('intro-1'), met: ['gunship', 'recon-drone'] };
    const met = metByRecord(g, MISSIONS, ladder);
    expect(met.slice(0, 2)).toEqual(['gunship', 'recon-drone']);
    expect(new Set(met).size).toBe(met.length);
  });
});

describe('the database', () => {
  test('has a page for every kind of enemy, each once, with a note that fits', () => {
    expect(UNITS.map((u) => u.id).sort()).toEqual(Object.keys(ENEMIES).sort());
    for (const unit of UNITS) {
      expect(unit.note.length, unit.id).toBeGreaterThan(20);
      expect(unit.note.length, unit.id).toBeLessThanOrEqual(150);
      expect((unit.title ?? ENEMIES[unit.id].name).length, unit.id).toBeLessThanOrEqual(19);
    }
    // The three machines Ashfall flies read as three different pages.
    const titles = UNITS.map((u) => u.title ?? ENEMIES[u.id].name);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('its world entries have ids of their own, open at something that exists, and fit their panel', () => {
    expect(WORLD.length).toBeGreaterThanOrEqual(16);
    expect(new Set(WORLD.map((e) => e.id)).size).toBe(WORLD.length);
    const known = new Set(['start', 'choice', 'finale', 'verdict', ...MISSIONS.map((m) => m.id)]);
    for (const e of WORLD) {
      expect(known.has(e.after) || /^arena:\d+$/.test(e.after), `${e.id} after ${e.after}`).toBe(true);
      expect(e.title.length, e.id).toBeLessThanOrEqual(19);
      expect(e.text.length, e.id).toBeLessThanOrEqual(330);
    }
  });

  test('a new pilot can read about the city and the three powers, and nothing about what comes later', () => {
    const open = openEntries(fresh(), WORLD, MISSIONS).opened.map((e) => e.id);
    expect(open).toEqual(expect.arrayContaining(['varn', 'licence', 'dispatch', 'hadron', 'lumen', 'undertow']));
    expect(open).not.toContain('meridian');
    expect(open).not.toContain('ashfall');
  });

  test('the end of the war opens the insurer, and every entry opens for someone', () => {
    const warWon = did('intro-1', 'intro-2', 'rival-1', 'choice-hadron', 'finale-hadron');
    expect(openEntries(warWon, WORLD, MISSIONS).opened.map((e) => e.id)).toContain('meridian');
    // Play everything there is: all three clients and both verdicts.
    const everything = { ...did(...MISSIONS.map((m) => m.id)), arenaRank: 10 };
    expect(openEntries(everything, WORLD, MISSIONS).game.codex.sort()).toEqual(WORLD.map((e) => e.id).sort());
  });

  test('its manual has topics with ids of their own that fit their panel', () => {
    expect(MANUAL.length).toBeGreaterThanOrEqual(14);
    expect(new Set(MANUAL.map((t) => t.id)).size).toBe(MANUAL.length);
    for (const topic of MANUAL) {
      expect(topic.title.length, topic.id).toBeLessThanOrEqual(19);
      expect(topic.text.length, topic.id).toBeLessThanOrEqual(330);
    }
  });
});
