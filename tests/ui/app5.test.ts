import { xpForLevel } from '../../src/core/pilot';
import { NO_STATS } from '../../src/core/stats';
import { MANUAL, UNITS, WORLD } from '../../src/content/codex';
import { MEDALS } from '../../src/content/medals';
import { TOAST_MS } from '../../src/ui/app';
import {
  accept, done, finishMission, fresh, ids, inHub, makeApp, medalPay, press, retreat, savedGame, select, skipScenes, snap, strong, toHub,
} from '../helpers/app';

describe('the record', () => {
  test('a won contract is counted: the contract, what it paid, the shots, the kills and the kinds of enemy met', () => {
    const { app, store } = inHub(strong(fresh()));
    accept(app, 'intro-1');
    finishMission(app);
    const { reward, bonus } = snap(app).settlement!;
    const { stats, met } = savedGame(store);
    expect(stats).toMatchObject({ contracts: 1, lost: 0, retreats: 0, earned: reward + bonus });
    expect(stats.kills).toBeGreaterThanOrEqual(1);
    expect(stats.shots).toBeGreaterThanOrEqual(stats.hits);
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.damage).toBeGreaterThan(0);
    expect(stats.rounds).toBeGreaterThanOrEqual(1);
    expect(met).toEqual(['recon-drone']);
  });

  test('every battle of a contract is counted, and a kind of enemy is listed once', () => {
    const { app, store } = inHub(strong(fresh()));
    accept(app, 'patrol');
    finishMission(app);
    toHub(app);
    accept(app, 'patrol');
    finishMission(app);
    const { stats, met } = savedGame(store);
    expect(stats.contracts).toBe(2);
    expect(stats.kills).toBeGreaterThanOrEqual(2);
    expect(new Set(met).size).toBe(met.length);
  });

  test('walking away is a retreat, not a loss, and the enemy was met all the same', () => {
    const { app, store } = inHub(fresh());
    accept(app, 'intro-1');
    retreat(app);
    expect(savedGame(store).stats).toMatchObject({ contracts: 0, lost: 0, retreats: 1, earned: 0 });
    expect(savedGame(store).met).toEqual(['recon-drone']);
  });

  test('time played is counted while a game is on and kept with it', () => {
    const { app, store } = inHub(fresh());
    app.update(61_500);
    app.commit(app.game!);
    expect(savedGame(store).stats.seconds).toBe(61);
    // The half second left over is not lost.
    app.update(600);
    app.commit(app.game!);
    expect(savedGame(store).stats.seconds).toBe(62);
  });

  test('the clock does not run before a game is on, and starts from nothing for the game that is', () => {
    const { app, store } = makeApp(fresh());
    app.update(9000);
    press(app, 'confirm');
    skipScenes(app);
    expect(snap(app).screen).toBe('hub');
    app.commit(app.game!);
    expect(savedGame(store).stats.seconds).toBe(0);
  });
});

describe('medals', () => {
  /** A pilot for whom the database has nothing new, so that what is announced is about medals. */
  const read = () => ({ ...fresh(), codex: WORLD.map((entry) => entry.id) });

  test('the first contract won earns the first medal: it is saved, paid for and announced after the battle', () => {
    const { app, store } = inHub(strong(read()));
    accept(app, 'intro-1');
    finishMission(app);
    const game = savedGame(store);
    expect(game.medals).toContain('first-contract');
    expect(game.credits).toBe(1200 + snap(app).settlement!.net + medalPay(game.medals));
    // Nothing is announced over a battle; on the settlement the first one comes up.
    expect(snap(app).toast).toBeNull();
    app.update(16);
    expect(snap(app).toast).toBe(game.medals[0]);
    app.update(TOAST_MS);
    app.update(16);
    expect(snap(app).toast).toBe(game.medals[1] ?? null);
  });

  test('an announcement that is up when a battle begins steps aside and comes back after it', () => {
    const { app } = inHub(strong({ ...read(), arenaRank: 1, scenes: ['act-1'] }));
    app.update(16);
    expect(snap(app).toast).toBe('first-arena');
    accept(app, 'patrol');
    app.update(16);
    expect(snap(app)).toMatchObject({ screen: 'battle', toast: null });
    expect(snap(app).toasts).toContain('first-arena');
    finishMission(app);
    app.update(16);
    // Back on a screen that can carry it, it is the first thing announced.
    expect(snap(app)).toMatchObject({ screen: 'settlement', toast: 'first-arena' });
  });

  test('a medal is announced once: loading the game again announces nothing', () => {
    const { app } = inHub({ ...read(), medals: ['first-contract'], stats: { ...NO_STATS, contracts: 1 } });
    app.commit(app.game!);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: null, toasts: [] });
  });

  test('what an older game had already done is recognised as soon as it is loaded', () => {
    const { app, store } = inHub({ ...read(), xp: xpForLevel(5), arenaRank: 1, scenes: ['act-1'] });
    expect(savedGame(store).medals).toEqual(['first-arena', 'level-5']);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: 'first-arena', toasts: ['level-5'] });
  });
});

describe('the pilot screen', () => {
  const veteran = () => ({
    ...fresh(), callsign: 'VANTA', xp: xpForLevel(4), medals: ['first-contract', 'audit'],
    stats: { ...NO_STATS, contracts: 7, kills: 12, shots: 40, hits: 30 },
  });

  test('opens on the perks and says who the pilot is', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    expect(snap(app)).toMatchObject({ screen: 'pilot', page: 'perks', callsign: 'VANTA', pilot: { level: 4, points: 3 } });
    expect(ids(app)).toContain('marksman');
  });

  test('the shoulder buttons turn the page: perks, medals, record, and round again both ways', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    const pages = () => snap(app).page;
    press(app, 'next');
    expect(pages()).toBe('medals');
    press(app, 'next');
    expect(pages()).toBe('record');
    press(app, 'next');
    expect(pages()).toBe('perks');
    press(app, 'prev');
    expect(pages()).toBe('record');
    // Left and right do the same, for a thumb that is already on the pad.
    press(app, 'left');
    expect(pages()).toBe('medals');
    press(app, 'right', 'right');
    expect(pages()).toBe('perks');
  });

  test('the medals page lists every medal: earned ones marked, counted ones with how far along', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    press(app, 'next');
    const items = snap(app).menu.items;
    expect(items.map((i) => i.id)).toEqual(MEDALS.map((m) => m.id));
    expect(items.find((i) => i.id === 'first-contract')).toMatchObject({ label: 'First Invoice', enabled: true, note: 'EARNED' });
    expect(items.find((i) => i.id === 'contracts-25')).toMatchObject({ label: 'Steady Work', enabled: false, note: '7/25' });
    expect(items.find((i) => i.id === 'painted')).toMatchObject({ enabled: false, note: undefined });
    expect(snap(app).medalCount).toEqual({ earned: 2, of: MEDALS.length });
    // What the one under the cursor takes, and what it pays.
    expect(snap(app).detail).toEqual({ title: 'First Invoice', lines: ['Complete a contract.'], status: 'EARNED' });
    press(app, 'down');
    expect(snap(app).detail).toEqual({ title: 'Steady Work', lines: ['Complete 25 contracts.'], status: 'Pays 400 c' });
  });

  test('a medal that would give the story away keeps its name to itself until it is earned', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    press(app, 'next');
    const items = snap(app).menu.items;
    expect(items.find((i) => i.id === 'audit')).toMatchObject({ label: 'Audited', enabled: true });
    expect(items.find((i) => i.id === 'verdict-enforce')).toMatchObject({ label: '? ? ?', enabled: false });
    for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor].id !== 'verdict-enforce'; i++) press(app, 'down');
    expect(snap(app).detail).toEqual({ title: '? ? ?', lines: ['A turn of the story.'], status: 'Pays 1200 c' });
  });

  test('the record page shows what has been counted', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    press(app, 'prev');
    expect(snap(app).page).toBe('record');
    const read = Object.fromEntries(snap(app).record!.map((line) => [line.label, line.value]));
    expect(read).toMatchObject({ 'CONTRACTS WON': '7', 'ENEMIES DESTROYED': '12', ACCURACY: '75%', MEDALS: `2/${MEDALS.length}` });
  });

  test('a perk is bought on the perks page only', () => {
    const { app } = inHub(veteran());
    select(app, 'pilot');
    press(app, 'next', 'confirm', 'next', 'confirm');
    expect(snap(app).pilot).toMatchObject({ points: 3 });
    press(app, 'next', 'confirm');
    expect(snap(app)).toMatchObject({ page: 'perks', pilot: { points: 2 } });
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('the hub', () => {
  test('shows the pilot by callsign', () => {
    const { app } = inHub({ ...fresh(), callsign: 'VANTA' });
    expect(snap(app)).toMatchObject({ screen: 'hub', callsign: 'VANTA' });
  });
});

describe('the database', () => {
  const scout = () => ({ ...fresh(), met: ['recon-drone', 'gun-turret', 'shield-drone'] });

  test('is reached from the hub and opens on the units: every kind is listed, the ones not met without a name', () => {
    const { app } = inHub(scout());
    select(app, 'database');
    expect(snap(app)).toMatchObject({ screen: 'database', page: 'units', count: 'MET 3/30' });
    const items = snap(app).menu.items;
    expect(items).toHaveLength(UNITS.length);
    expect(items[0]).toMatchObject({ id: 'recon-drone', label: 'Recon Drone', enabled: true });
    expect(items.find((i) => i.id === 'gunship')).toMatchObject({ label: '? ? ?', enabled: false });
    expect(items.filter((i) => i.enabled).map((i) => i.id)).toEqual(['recon-drone', 'shield-drone', 'gun-turret']);
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('a unit that has been met shows what it is and how to fight it; one that has not shows nothing', () => {
    const { app } = inHub(scout());
    select(app, 'database');
    for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor].id !== 'gun-turret'; i++) press(app, 'down');
    expect(snap(app).detail).toEqual({
      title: 'GUN TURRET', sprite: 'enemy-gun-turret',
      stats: [{ label: 'ARMOUR', value: '260' }, { label: 'WEAK TO', value: 'Explosive' }, { label: 'TOUGH VS', value: 'Kinetic' }],
      lines: ['Bastion Cannon (Kinetic)', '', 'Bolted down, so it never dodges. Its', 'plating stops bullets well and blasts', 'badly.'],
    });
    for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor].id !== 'gunship'; i++) press(app, 'down');
    expect(snap(app).detail).toEqual({ title: '? ? ?', lines: ['Not met yet.'] });
  });

  test('the shoulder buttons turn the page: units, world, manual and round again', () => {
    const { app } = inHub(scout());
    select(app, 'database');
    press(app, 'next');
    expect(snap(app)).toMatchObject({ page: 'world', count: `ENTRIES 6/${WORLD.length}` });
    press(app, 'next');
    expect(snap(app)).toMatchObject({ page: 'manual', count: `${MANUAL.length} TOPICS` });
    press(app, 'next');
    expect(snap(app).page).toBe('units');
    press(app, 'prev');
    expect(snap(app).page).toBe('manual');
    press(app, 'left', 'left');
    expect(snap(app).page).toBe('units');
  });

  test('the world page lists what has come to light so far and nothing of what has not', () => {
    const { app } = inHub(scout());
    select(app, 'database');
    press(app, 'next');
    expect(ids(app)).toEqual(['varn', 'licence', 'dispatch', 'hadron', 'lumen', 'undertow']);
    expect(snap(app).detail).toMatchObject({ title: 'VARN' });
    expect((snap(app).detail as { lines: string[] }).lines.join(' ')).toContain('Three powers hold it between them');
    for (const line of (snap(app).detail as { lines: string[] }).lines) expect(line.length).toBeLessThanOrEqual(37);
  });

  test('the manual lists every topic, and each reads as it was written', () => {
    const { app } = inHub(scout());
    select(app, 'database');
    press(app, 'prev');
    expect(ids(app)).toEqual(MANUAL.map((topic) => topic.id));
    press(app, 'down', 'down');
    expect(snap(app).detail).toMatchObject({ title: 'AIMING' });
    expect((snap(app).detail as { lines: string[] }).lines.join(' ')).toBe(MANUAL[2].text);
  });

  test('a new game is told once that the database has entries; an entry that opens later is announced by its title', () => {
    const { app, store } = inHub();
    expect(savedGame(store).codex).toEqual(['varn', 'licence', 'dispatch', 'hadron', 'lumen', 'undertow']);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: 'entries:6', toasts: [] });
    app.update(TOAST_MS);
    app.update(16);
    expect(snap(app).toast).toBeNull();
    // The first meeting with Ashfall opens their entry, once the page of story that follows it has been read.
    app.commit({ ...app.game!, completed: ['intro-1', 'intro-2', 'rival-1'] });
    expect(savedGame(store).codex).not.toContain('ashfall');
    app.commit({ ...app.game!, scenes: [...app.game!.scenes, 'act-2'] });
    expect(savedGame(store).codex).toEqual(expect.arrayContaining(['ashfall', 'arena', 'freelance']));
    app.update(16);
    expect(snap(app).toast).toBe('entries:3');
    app.update(TOAST_MS);
    app.update(16);
    // Taking a side earns a medal and opens an entry: the medal is announced first.
    app.commit({ ...app.game!, completed: [...app.game!.completed, 'hadron-1', 'choice-hadron'] });
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: 'side', toasts: ['entry:war'] });
  });

  test('a game loaded from before there was a database has its entries at once', () => {
    const { app, store } = inHub({ ...done('intro-1', 'intro-2', 'rival-1'), scenes: ['act-1'] });
    expect(savedGame(store).codex).toEqual(['varn', 'licence', 'dispatch', 'hadron', 'lumen', 'undertow', 'freelance', 'arena', 'ashfall']);
    select(app, 'database');
    press(app, 'next');
    expect(ids(app)).toHaveLength(9);
  });

  test('entries opened in an earlier cycle stay open, and nothing is announced for them again', () => {
    const { app } = inHub({ ...fresh(), cycle: 1, medals: ['cycle'], codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
    app.update(16);
    expect(snap(app).toast).toBeNull();
    select(app, 'database');
    press(app, 'next');
    expect(ids(app)).toEqual(WORLD.map((entry) => entry.id));
  });

  test('many medals at once are announced together, not one by one', () => {
    const { app } = inHub({ ...fresh(), scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) });
    app.commit({ ...app.game!, arenaRank: 10, xp: xpForLevel(10), stats: { ...NO_STATS, contracts: 30, kills: 60 } });
    expect(app.game!.medals.length).toBeGreaterThan(3);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: `medals:${app.game!.medals.length}`, toasts: [] });
  });
});
