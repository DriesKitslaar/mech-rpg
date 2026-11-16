import { payout } from '../../src/core/gauntlet';
import { STARTER_BUILD } from '../../src/content/parts';
import { SAVE_KEY } from '../../src/platform/storage';
import { done, finishBattle, ids, inHub, press, savedGame, select, snap, strong } from '../helpers/app';

interface View {
  best: number; floor: number | null; drafting: boolean; asking: boolean; offers: { kind: string }[]; boons: Record<string, number>;
  build: Record<string, string> | null; enemies: string[]; wear: number; last: { cleared: number; paid: number; record: boolean } | null;
}
type AppOf = ReturnType<typeof inHub>['app'];
const g = (app: AppOf): View => snap(app).gauntlet as View;
const ready = () => inHub(strong(done('intro-1', 'intro-2')));
/** Wins the floor the run is on and comes back to the Gauntlet's room. */
function clear(app: AppOf): void {
  select(app, 'descend');
  expect(snap(app).screen).toBe('battle');
  finishBattle(app);
  expect(snap(app).battle?.outcome).toBe('victory');
  press(app, 'confirm');
  expect(snap(app).screen).toBe('gauntlet');
}

describe('the Gauntlet', () => {
  test('opens with the arena, once the introductions are done', () => {
    const early = inHub().app;
    expect(snap(early).menu.items.find((i) => i.id === 'gauntlet')).toMatchObject({ enabled: false });
    early.go('gauntlet');
    expect(snap(early).screen).toBe('hub');
    const { app } = ready();
    select(app, 'gauntlet');
    expect(snap(app).screen).toBe('gauntlet');
    expect(ids(app)).toEqual(['start', 'back']);
    expect(g(app)).toMatchObject({ best: 0, floor: null, last: null });
  });

  test('a run starts in the stock frame whatever the pilot flies, and is kept in the save', () => {
    const { app, store } = ready();
    select(app, 'gauntlet');
    select(app, 'start');
    expect(g(app)).toMatchObject({ floor: 1, drafting: false, build: STARTER_BUILD, wear: 0 });
    expect(g(app).enemies.length).toBeGreaterThan(0);
    expect(ids(app)).toEqual(['descend', 'abandon', 'back']);
    expect(savedGame(store).gauntlet).toMatchObject({ floor: 1 });
    // The pilot's own mech and money are untouched.
    expect(savedGame(store).build).not.toEqual(STARTER_BUILD);
  });

  test('a floor won leads to three things on offer; one is taken and the way down opens again', () => {
    const { app, store } = ready();
    const credits = snap(app).credits;
    select(app, 'gauntlet');
    select(app, 'start');
    clear(app);
    expect(g(app)).toMatchObject({ floor: 2, drafting: true });
    expect(g(app).offers).toHaveLength(3);
    expect(ids(app)).toEqual(['offer-0', 'offer-1', 'offer-2']);
    // The draft is owed: leaving for the hub and coming back finds the same three.
    const offers = g(app).offers;
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    select(app, 'gauntlet');
    expect(g(app).offers).toEqual(offers);
    press(app, 'down', 'confirm');
    expect(g(app)).toMatchObject({ floor: 2, drafting: false });
    expect(ids(app)).toEqual(['descend', 'abandon', 'back']);
    expect(savedGame(store).gauntlet).toMatchObject({ floor: 2, drafting: false });
    // No floor pays or bills anything by itself, and none of it is in the pilot's record.
    expect(snap(app).credits).toBe(credits);
    expect(savedGame(store).battlesWon).toBe(strong(done('intro-1', 'intro-2')).battlesWon);
  });

  test('falling ends the run: it pays for the floors cleared and the best is kept', () => {
    const { app, store } = ready();
    const credits = snap(app).credits;
    select(app, 'gauntlet');
    select(app, 'start');
    clear(app);
    press(app, 'confirm');
    select(app, 'descend');
    // Walking away from a floor is falling on it.
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
      if (snap(app).battle?.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    select(app, 'retreat');
    select(app, 'yes');
    for (let i = 0; i < 2000 && snap(app).battle?.phase !== 'result'; i++) {
      if (snap(app).battle?.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    press(app, 'confirm');
    expect(snap(app).screen).toBe('gauntlet');
    expect(g(app)).toMatchObject({ floor: null, best: 1, last: { cleared: 1, paid: payout(1), record: true } });
    expect(snap(app).credits).toBe(credits + payout(1));
    expect(savedGame(store)).toMatchObject({ gauntlet: null, gauntletBest: 1 });
    expect(ids(app)).toEqual(['start', 'back']);
  });

  test('a run can be ended on purpose, after being asked', () => {
    const { app } = ready();
    select(app, 'gauntlet');
    select(app, 'start');
    select(app, 'abandon');
    expect(g(app).asking).toBe(true);
    expect(ids(app)).toEqual(['no', 'yes']);
    press(app, 'confirm');
    expect(g(app)).toMatchObject({ floor: 1, asking: false });
    select(app, 'abandon');
    select(app, 'yes');
    expect(g(app)).toMatchObject({ floor: null, last: { cleared: 0, paid: 0, record: false } });
  });

  test('a run waits through closing the game, and a run that makes no sense is dropped without losing the game', () => {
    const { app, store } = ready();
    select(app, 'gauntlet');
    select(app, 'start');
    clear(app);
    const kept = savedGame(store);
    const reopened = inHub(kept).app;
    select(reopened, 'gauntlet');
    expect(g(reopened)).toMatchObject({ floor: 2, drafting: true });
    const broken = inHub({ ...kept, gauntlet: { ...kept.gauntlet!, build: { ...kept.gauntlet!.build, core: 'core-adjuster' } } });
    expect(snap(broken.app).screen).toBe('hub');
    select(broken.app, 'gauntlet');
    expect(g(broken.app).floor).toBeNull();
    expect(JSON.parse(broken.store.data[SAVE_KEY]).credits).toBe(kept.credits);
  });

  test('it is drawn at every stage without a word outside the screen', () => {
    const { app } = ready();
    const widths: { text: string; x: number }[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillText') widths.push({ text: String(args[0]), x: Number(args[1]) }); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const look = () => { app.update(16); app.draw(ctx); };
    select(app, 'gauntlet');
    look();
    select(app, 'start');
    look();
    clear(app);
    look();
    press(app, 'down');
    look();
    press(app, 'confirm');
    select(app, 'abandon');
    look();
    select(app, 'yes');
    look();
    expect(widths.map((w) => w.text)).toEqual(expect.arrayContaining(['THE GAUNTLET', 'FLOOR 1', 'FLOOR 2', 'TAKE ONE', 'RUN OVER', 'Descend']));
    // Everything in the right-hand panel starts inside it and ends before the screen does.
    for (const w of widths.filter((w) => w.x >= 150 && w.x < 300)) expect(w.x + w.text.length * 4.8, w.text).toBeLessThanOrEqual(310);
  });
});
