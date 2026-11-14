import { xpForLevel } from '../../src/core/pilot';
import { NO_STATS } from '../../src/core/stats';
import { TOAST_MS } from '../../src/ui/app';
import { accept, finishMission, fresh, inHub, makeApp, medalPay, press, retreat, savedGame, skipScenes, snap, strong, toHub } from '../helpers/app';

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
  test('the first contract won earns the first medal: it is saved, paid for and announced after the battle', () => {
    const { app, store } = inHub(strong(fresh()));
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

  test('a medal is announced once: loading the game again announces nothing', () => {
    const { app } = inHub({ ...fresh(), medals: ['first-contract'], stats: { ...NO_STATS, contracts: 1 } });
    app.commit(app.game!);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: null, toasts: [] });
  });

  test('what an older game had already done is recognised the first time it is saved', () => {
    const { app, store } = inHub({ ...fresh(), xp: xpForLevel(5), arenaRank: 1 });
    app.commit(app.game!);
    expect(savedGame(store).medals).toEqual(['first-arena', 'level-5']);
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: 'first-arena', toasts: ['level-5'] });
  });
});
