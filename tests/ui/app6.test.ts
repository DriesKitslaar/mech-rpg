import { buy, equip } from '../../src/core/game';
import { xpForLevel } from '../../src/core/pilot';
import { NO_STATS } from '../../src/core/stats';
import { WORLD } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { CATALOG } from '../../src/content/parts';
import { autoBattle, done, fresh, ids, inHub, medalPay, press, retreat, savedGame, select, snap, strong } from '../helpers/app';

/** A pilot for whom nothing is waiting to be announced, so that credits only move for the reason under test. */
const quiet = (base = fresh()) => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const openDrill = (app: Parameters<typeof select>[0], id: string) => {
  select(app, 'training');
  select(app, id);
  expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: id } });
};

describe('training', () => {
  test('is on the hub menu and lists the ten drills: three open from the start, the rest once the introductions are done', () => {
    const { app } = inHub(quiet());
    expect(ids(app)).toEqual(['contracts', 'arena', 'training', 'garage', 'shop', 'pilot', 'messages', 'database', 'options']);
    select(app, 'training');
    expect(snap(app)).toMatchObject({ screen: 'training', count: 'PASSED 0/10' });
    const items = snap(app).menu.items;
    expect(items.map((i) => i.id)).toEqual(DRILLS.map((d) => d.id));
    expect(items.slice(0, 3).every((i) => i.enabled && i.note === '150')).toBe(true);
    expect(items.slice(3).every((i) => !i.enabled && i.note === 'LOCKED')).toBe(true);
    expect(snap(app).detail).toMatchObject({ title: 'TAKE IT APART', lesson: 'Aim at parts' });
    // A locked drill cannot be opened.
    press(app, 'down', 'down', 'down', 'confirm');
    expect(snap(app).screen).toBe('training');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');

    const later = inHub(quiet(done('intro-1', 'intro-2'))).app;
    select(later, 'training');
    expect(snap(later).menu.items.every((i) => i.enabled)).toBe(true);
  });

  test('a drill is briefed and fought in the lent mech, even when the pilot\'s own may not deploy', () => {
    // Three Bulwark parts on the starter's legs: far too heavy to take a contract.
    let g = { ...fresh(), credits: 20000 };
    for (const id of ['head-bulwark', 'core-bulwark', 'arms-bulwark']) g = buy(g, id, CATALOG);
    g = equip(equip(equip(g, 'head', 'head-bulwark', CATALOG), 'core', 'core-bulwark', CATALOG), 'arms', 'arms-bulwark', CATALOG);
    const { app } = inHub(quiet(g));
    expect(snap(app).menu.items.find((i) => i.id === 'contracts')).toMatchObject({ enabled: false });
    expect(snap(app).menu.items.find((i) => i.id === 'training')).toMatchObject({ enabled: true });
    openDrill(app, 'drill-aim');
    expect(snap(app).briefing).toMatchObject({ reward: 150, objectives: ['Disable, do not destroy: Halo Guard'] });
    select(app, 'accept');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { mission: 'drill-aim', enemies: ['light-mech'], enemyScale: 0.8 } });
    // The mech on the field is the simulator's: its armour is that of the lent frame.
    expect(snap(app).player).toMatchObject({ maxAp: 45 + 220 + 80 + 150 });
  });

  test('a drill ignores the difficulty the player chose and the perks the pilot holds', () => {
    const veteran = { ...quiet(), xp: xpForLevel(6), perks: { plating: 3 }, settings: { ...fresh().settings, difficulty: 'veteran' as const } };
    const { app } = inHub(veteran);
    openDrill(app, 'drill-aim');
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ enemyScale: 0.8 });
    expect(snap(app).player).toMatchObject({ maxAp: 45 + 220 + 80 + 150 });
  });

  test('passing a drill pays once, costs nothing, is remembered, and leaves the record and the story alone', () => {
    const { app, store } = inHub(quiet());
    openDrill(app, 'drill-aim');
    select(app, 'accept');
    autoBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory' });
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'settlement', settlement: { won: true, reward: 150, net: 150, rank: null, bonus: 0, ammoCost: 0, repairCost: 0 } });
    const saved = savedGame(store);
    expect(saved).toMatchObject({ credits: 1200 + 150 + medalPay(saved.medals), drills: ['drill-aim'], battlesWon: 0, completed: [], xp: 0, met: [] });
    expect(saved.stats).toEqual(NO_STATS);
    // Back to the list, where it is marked; passing it again pays nothing more.
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'training', count: 'PASSED 1/10' });
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'drill-aim', note: 'PASSED' });
    expect(snap(app).menu.cursor).toBe(0);
    press(app, 'confirm');
    expect(snap(app).briefing).toMatchObject({ reward: 0 });
    select(app, 'accept');
    autoBattle(app);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 0, net: 0 });
    expect(savedGame(store).credits).toBe(saved.credits);
  });

  test('leaving a drill costs nothing and returns to the list', () => {
    const { app, store } = inHub(quiet());
    openDrill(app, 'drill-boost');
    select(app, 'accept');
    retreat(app);
    expect(snap(app).settlement).toMatchObject({ won: false, reward: 0, net: 0, ammoCost: 0, repairCost: 0 });
    expect(savedGame(store)).toMatchObject({ credits: 1200, drills: [], medals: [] });
    expect(savedGame(store).stats).toEqual(NO_STATS);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('training');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('drill-boost');
  });

  test('backing out of a drill\'s briefing returns to the list with the cursor where it was', () => {
    const { app } = inHub(quiet());
    openDrill(app, 'drill-heat');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('training');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('drill-heat');
  });

  test('passing every drill earns a medal', () => {
    const all = DRILLS.map((d) => d.id);
    const { app, store } = inHub(quiet({ ...done('intro-1', 'intro-2'), drills: all.slice(1) }));
    expect(savedGame(store).medals).not.toContain('drills');
    openDrill(app, 'drill-aim');
    select(app, 'accept');
    autoBattle(app);
    press(app, 'confirm');
    expect(savedGame(store).medals).toContain('drills');
  });
});

describe('the arena, past the ladder', () => {
  const pit = (extra: Partial<ReturnType<typeof fresh>> = {}) => inHub(quiet({ ...strong(done('intro-1', 'intro-2')), ...extra }), 3);

  test('says how far up the pilot is: out of ten on the ladder, out of fifteen once champion', () => {
    const climbing = pit({ arenaRank: 4 }).app;
    select(climbing, 'arena');
    expect(snap(climbing).arena).toMatchObject({ rank: 4, of: 10 });
    const champion = pit({ arenaRank: 10 }).app;
    select(champion, 'arena');
    expect(snap(champion).arena).toMatchObject({ rank: 10, of: 15 });
  });

  test('the back room is listed for the champion only, and its first pilot can then be challenged', () => {
    const climbing = pit({ arenaRank: 9 }).app;
    select(climbing, 'arena');
    expect(ids(climbing)).toHaveLength(11);
    expect(ids(climbing)).not.toContain('rank-11');

    const { app } = pit({ arenaRank: 10 });
    select(app, 'arena');
    expect(ids(app)).toEqual([...Array.from({ length: 15 }, (_, i) => `rank-${i + 1}`), 'mirror']);
    expect(snap(app).menu.cursor).toBe(10);
    expect(snap(app).menu.items[10]).toMatchObject({ id: 'rank-11', label: '11. Longshot', enabled: true, note: '9000' });
    expect(snap(app).menu.items[11]).toMatchObject({ id: 'rank-12', enabled: false });
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'arena-11', reward: 9000 } });
    select(app, 'accept');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { mission: 'arena-11', enemies: ['arena-11'] } });
  });

  test('the mirror match is locked below the third rank', () => {
    const { app } = pit({ arenaRank: 2 });
    select(app, 'arena');
    const mirror = snap(app).menu.items.find((i) => i.id === 'mirror')!;
    expect(mirror).toMatchObject({ label: 'Mirror Match', enabled: false, note: 'LOCKED' });
  });

  test('the mirror match is a duel against the pilot\'s own build, and winning it is counted and pays less after', () => {
    const { app, store } = pit({ arenaRank: 3 });
    select(app, 'arena');
    expect(snap(app).menu.items.find((i) => i.id === 'mirror')).toMatchObject({ enabled: true, note: '2400' });
    select(app, 'mirror');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'arena-mirror', reward: 2400 } });
    press(app, 'cancel');
    expect(snap(app).screen).toBe('arena');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('mirror');
    press(app, 'confirm');
    select(app, 'accept');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { mission: 'arena-mirror', enemies: ['mirror'] } });
    // The other mech has what this one has, tuned a tenth hotter.
    expect(snap(app).battle!.enemyArmour).toBeGreaterThan(snap(app).player!.maxAp);
    expect(snap(app).battle!.enemyArmour).toBeLessThanOrEqual(Math.ceil(snap(app).player!.maxAp * 1.1) + 4);
    retreat(app);
    expect(savedGame(store).stats.mirrors).toBe(0);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');

    // Won, it is counted, earns its medal, and the next one pays a quarter.
    app.bookSettlement({ won: true, reward: 2400, ammoCost: 0, repairCost: 0, net: 2400, lines: [] },
      { id: 'arena-mirror', phase: 'patrol', title: 'Mirror Match', client: 'Arena Office', briefing: [], debrief: '', reward: 2400, battles: [] });
    expect(savedGame(store)).toMatchObject({ arenaRank: 3, stats: { mirrors: 1 } });
    expect(savedGame(store).medals).toContain('mirror');
    select(app, 'arena');
    expect(snap(app).menu.items.find((i) => i.id === 'mirror')).toMatchObject({ note: '600' });
  });

  test('beating the last pilot of the back room earns the last arena medal', () => {
    const { app, store } = pit({ arenaRank: 14 });
    app.bookSettlement({ won: true, reward: 22000, ammoCost: 0, repairCost: 0, net: 22000, lines: [] },
      { id: 'arena-15', phase: 'patrol', title: 'The Founder', client: 'Arena Office', briefing: [], debrief: '', reward: 22000, battles: [], arenaRank: 15 });
    expect(savedGame(store).arenaRank).toBe(15);
    expect(savedGame(store).medals).toEqual(expect.arrayContaining(['apex']));
  });
});
