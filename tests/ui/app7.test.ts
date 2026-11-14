import { completeMission, startNewCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { WORLD } from '../../src/content/codex';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { SAVE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import {
  accept, done, finishMission, fresh, inHub, makeApp, medalPay, memoryStore, press, retreat, savedGame, select, skipScenes, snap, sprites, strong,
} from '../helpers/app';

/** A pilot the database and the story have nothing to announce to, so that only medals are announced. */
const quiet = (base: GameState = fresh()): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
/** Every announcement there is, the one on screen included. */
const announced = (app: App): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => id !== null);
/** Walks the shop's cursor to a part. */
const shopCursor = (app: App, id: string): void => {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
/** From the shop's first tab to the one for what is held in a hand. */
const toHands = (app: App): void => press(app, ...Array.from({ length: 8 }, () => 'next' as const));

describe('what is earned in the garage and the shop is kept', () => {
  test('a medal earned by repainting stays earned and paid for through every change after it, and is announced once', () => {
    const { app, store } = inHub(quiet());
    const before = snap(app).credits;
    select(app, 'garage');
    press(app, 'next');
    expect(snap(app).medals).toEqual(['painted']);
    expect(snap(app).credits).toBe(before + medalPay(['painted']));
    // On through the schemes and back to the colours the mech came in.
    press(app, 'next', 'next', 'prev', 'prev', 'prev');
    expect((snap(app).garage as { paint: string }).paint).toBe('factory');
    expect(snap(app).medals).toEqual(['painted']);
    expect(snap(app).credits).toBe(before + medalPay(['painted']));
    expect(savedGame(store)).toMatchObject({ medals: ['painted'], credits: before + medalPay(['painted']), paint: 'factory' });
    expect(announced(app)).toEqual(['painted']);
  });

  test('a medal earned by a sale stays earned and paid for when the part is bought back', () => {
    // An arc pistol to spare, and a sale short of thirty thousand.
    const { app, store } = inHub({ ...quiet(), credits: 29_500, inventory: { ...fresh().inventory, 'wpn-arc-pistol': 1 } });
    expect(snap(app).medals).toEqual([]);
    select(app, 'shop');
    toHands(app);
    press(app, 'right');
    shopCursor(app, 'wpn-arc-pistol');
    press(app, 'confirm');
    expect(snap(app).medals).toEqual(['rich']);
    expect(snap(app).credits).toBe(29_500 + 600 + medalPay(['rich']));
    press(app, 'left');
    shopCursor(app, 'wpn-arc-pistol');
    press(app, 'confirm');
    expect(snap(app).medals).toEqual(['rich']);
    expect(snap(app).credits).toBe(29_500 + medalPay(['rich']));
    expect(savedGame(store)).toMatchObject({ medals: ['rich'], credits: 29_500 + medalPay(['rich']) });
    expect(announced(app)).toEqual(['rich']);
  });

  test('what a medal pays can be spent at once: the shop\'s list knows about it', () => {
    // Thirty-nine kinds of part owned; the fortieth earns Stockpile, and its pay makes the ram fist affordable.
    const others = Object.keys(CATALOG).filter((id) => !(id in fresh().inventory) && id !== 'wpn-arc-pistol' && id !== 'wpn-ram-fist').slice(0, 31);
    const inventory = { ...fresh().inventory, ...Object.fromEntries(others.map((id) => [id, 1])) };
    expect(Object.keys(inventory)).toHaveLength(39);
    const { app } = inHub({ ...quiet(), credits: 1000, inventory });
    expect(snap(app).medals).toEqual([]);
    select(app, 'shop');
    toHands(app);
    shopCursor(app, 'wpn-arc-pistol');
    press(app, 'confirm');
    expect(snap(app).medals).toEqual(['parts-40']);
    expect(snap(app).credits).toBe(1000 - 600 + medalPay(['parts-40']));
    expect(snap(app).menu.items.find((i) => i.id === 'wpn-ram-fist')).toMatchObject({ enabled: true });
    shopCursor(app, 'wpn-ram-fist');
    press(app, 'confirm');
    expect(snap(app).credits).toBe(1000 - 600 + medalPay(['parts-40']) - 700);
    expect(snap(app).medals).toEqual(['parts-40']);
  });

  test('time spent in the garage is counted across every change made there', () => {
    const { app, store } = inHub(quiet());
    select(app, 'garage');
    for (let i = 0; i < 6; i++) {
      app.update(5000);
      press(app, i % 2 === 0 ? 'next' : 'prev');
    }
    expect(savedGame(store).stats.seconds).toBe(30);
  });

  test('time spent in the shop is counted across every trade made there', () => {
    const { app, store } = inHub({ ...quiet(), credits: 5000 });
    select(app, 'shop');
    toHands(app);
    shopCursor(app, 'wpn-arc-pistol');
    for (let i = 0; i < 4; i++) {
      app.update(5000);
      press(app, 'confirm');
    }
    expect(savedGame(store).stats.seconds).toBe(20);
    expect(savedGame(store).inventory['wpn-arc-pistol']).toBe(4);
  });
});

describe('announcements and the story', () => {
  test('an announcement that is up when a page of story begins steps aside and comes back after it', () => {
    // The rival beaten, with the second act's page still to come; a medal is announced on the settlement.
    const base = strong(quiet(done('intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2')));
    const { app } = inHub({ ...base, medals: base.medals });
    accept(app, 'rival-1');
    finishMission(app);
    app.update(16);
    const up = snap(app).toast;
    expect(up).not.toBeNull();
    press(app, 'confirm');
    expect(snap(app).screen).toBe('scene');
    app.update(16);
    expect(snap(app).toast).toBeNull();
    expect(snap(app).toasts[0]).toBe(up);
    skipScenes(app);
    app.update(16);
    expect(snap(app)).toMatchObject({ screen: 'hub', toast: up });
  });

  test('the database does not run ahead of the story: what a page of story is about to reveal opens after that page', () => {
    const war = ['choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5'];
    const act1 = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
    const base = done(...act1, ...war);
    // Everything that could be open at this point is, so the only entry left to open is the one the finale leads to.
    const { app, store } = inHub(strong({ ...base, scenes: ['act-1', 'act-2'] }));
    expect(savedGame(store).codex).not.toContain('meridian');
    accept(app, 'finale-hadron');
    finishMission(app);
    // On the settlement the war is won, and nothing has been said about who comes next.
    expect(savedGame(store).completed).toContain('finale-hadron');
    expect(savedGame(store).codex).not.toContain('meridian');
    expect(announced(app)).not.toContain('entry:meridian');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('scene');
    skipScenes(app);
    expect(snap(app).screen).toBe('hub');
    expect(savedGame(store).codex).toContain('meridian');
    expect(announced(app)).toContain('entry:meridian');
  });

  test('a game kept from past the end of the story, with no page left to show, has its entries at once', () => {
    const all = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const { store } = inHub({ ...done(...all), endingSeen: true, scenes: [] });
    expect(savedGame(store).codex).toEqual(expect.arrayContaining(['meridian', 'auditors', 'actuary', 'collections']));
  });
});

describe('a game kept before enemies met were listed', () => {
  test('is credited on loading with every kind its finished contracts put in front of it', () => {
    const act1 = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
    const road = [...act1, 'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron'];
    const { met: _met, ...old } = { ...done(...road), scenes: ['act-1', 'act-2', 'war-won-hadron', 'act-3'], arenaRank: 2 };
    const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ ...old, version: 7, callsign: undefined, stats: undefined, medals: undefined, drills: undefined, codex: undefined }) });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 3 });
    press(app, 'confirm');
    skipScenes(app);
    expect(snap(app).screen).toBe('hub');
    const { met } = savedGame(store);
    // The first contract's drone, the rival, and the champion Hadron's road ends against.
    expect(met).toEqual(expect.arrayContaining(['recon-drone', 'rival', 'sable']));
    // What was on the roads not taken stays unmet.
    expect(met).not.toContain('krell');
    expect(new Set(met).size).toBe(met.length);
  });

  test('a game that lists them already is left as it is', () => {
    const { store } = inHub({ ...quiet(done('intro-1')), met: ['recon-drone'] });
    expect(savedGame(store).met).toEqual(['recon-drone']);
  });
});

describe('the training list in a later cycle', () => {
  test('every drill stays open when the story starts again, passed or not', () => {
    const all = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const again = startNewCycle({ ...done(...all), endingSeen: true, drills: ['drill-aim', 'drill-guard'] }, MISSIONS);
    const { app } = inHub(quiet(again));
    select(app, 'training');
    expect(snap(app).menu.items.every((item) => item.enabled)).toBe(true);
    expect(snap(app).menu.items).toHaveLength(10);
  });
});

describe('the arena', () => {
  test('backing out of an opponent\'s briefing returns to that opponent, not to the top of the ladder', () => {
    const { app } = inHub(quiet({ ...done('intro-1', 'intro-2'), arenaRank: 4 }));
    select(app, 'arena');
    // The cursor starts on the next opponent; go back up to one already beaten.
    press(app, 'up', 'up');
    const at = snap(app).menu.items[snap(app).menu.cursor].id;
    expect(at).toBe('rank-3');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('arena');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('rank-3');
  });
});

describe('options that could not be stored', () => {
  test('are stored with the next thing that can be, so they are not lost at the next launch', () => {
    let refuse = false;
    const inner = memoryStore({ [SAVE_KEY]: JSON.stringify(quiet()) });
    const store = { ...inner, setItem: (k: string, v: string) => { if (refuse) throw new Error('full'); inner.setItem(k, v); } };
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    select(app, 'options');
    refuse = true;
    press(app, 'confirm'); // sound effects off, while nothing can be written
    expect((snap(app).settings as { sfx: boolean }).sfx).toBe(false);
    refuse = false;
    press(app, 'cancel');
    // The next thing that is saved takes the options with it.
    select(app, 'garage');
    press(app, 'next');
    expect(JSON.parse(inner.data[SETTINGS_KEY]).sfx).toBe(false);
    const again = new App({ catalog: CATALOG, save: new SaveFile(inner, CATALOG), sprites, fast: true, seed: 1 });
    expect((snap(again).settings as { sfx: boolean }).sfx).toBe(false);
  });
});

describe('the pilot\'s medals', () => {
  test('a medal that keeps its name to itself keeps its count to itself too', () => {
    const { app } = inHub(quiet({ ...done('intro-1', 'intro-2'), arenaRank: 3 }));
    select(app, 'pilot');
    press(app, 'next');
    const items = snap(app).menu.items;
    expect(items.find((i) => i.id === 'apex')).toMatchObject({ label: '? ? ?', enabled: false });
    expect(items.find((i) => i.id === 'apex')!.note).toBeUndefined();
    // One that is named still counts.
    expect(items.find((i) => i.id === 'champion')!.note).toBe('3/10');
  });
});

describe('the title', () => {
  test('Continue says whose game it goes on with', () => {
    const { app } = makeApp({ ...quiet(), callsign: 'VANTA' });
    expect(snap(app).menu.items.find((i) => i.id === 'continue')).toMatchObject({ label: 'Continue', note: 'VANTA' });
  });
});

describe('the end roll', () => {
  const ended = () => ({ ...quiet(completeMission(fresh(), 'intro-1', MISSIONS)), endingSeen: true, cycle: 1 });

  test('the back button skips it and leaves it, the same as the other', () => {
    const { app } = inHub(ended(), 1, { fast: false });
    select(app, 'options');
    select(app, 'credits');
    expect(snap(app).screen).toBe('credits');
    app.update(1000);
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'credits', credits: { done: true } });
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('the list of contracts', () => {
  test('opens with the cursor on the next contract of the story, not on the patrol above it', () => {
    const { app } = inHub(quiet());
    select(app, 'contracts');
    const { items, cursor } = snap(app).menu;
    expect(items[0].id).toBe('patrol');
    expect(items[cursor].id).toBe('intro-1');
    // Pressing the same button again and again leads into the story.
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'intro-1' } });
  });

  test('with no story contract on offer, on the patrol', () => {
    const story = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const { app } = inHub(quiet({ ...done(...story), endingSeen: true }));
    select(app, 'contracts');
    const { items, cursor } = snap(app).menu;
    expect(items[cursor].id).toBe('patrol');
  });

  test('coming back from a briefing still leaves the cursor on that contract', () => {
    const { app } = inHub(quiet());
    select(app, 'contracts');
    press(app, 'up');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('patrol');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    press(app, 'cancel');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('patrol');
  });
});

describe('after a defeat', () => {
  /** Ends every turn without doing anything until the battle is lost. */
  function standStill(app: App): void {
    for (let i = 0; i < 60000 && snap(app).battle?.phase !== 'result'; i++) {
      if (snap(app).battle!.phase === 'action') select(app, 'endTurn');
      else if (snap(app).battle!.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    expect(snap(app).battle).toMatchObject({ phase: 'result', outcome: 'defeat' });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('settlement');
  }

  test('the settlement carries a word about what went wrong: here, a pilot who never boosted or guarded', () => {
    const { app } = inHub(quiet());
    accept(app, 'intro-1');
    standStill(app);
    expect(snap(app).settlement).toMatchObject({ won: false, tip: 'stance' });
  });

  test('a contract that was won, or walked away from, carries none', () => {
    const won = inHub(strong(quiet())).app;
    accept(won, 'intro-1');
    finishMission(won);
    expect(snap(won).settlement).toMatchObject({ won: true, tip: null });
    const left = inHub(quiet()).app;
    accept(left, 'intro-1');
    retreat(left);
    expect(snap(left).settlement).toMatchObject({ won: false, tip: null });
  });

  test('a drill that was failed carries one too', () => {
    const { app } = inHub(quiet());
    select(app, 'training');
    select(app, 'drill-heat');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    standStill(app);
    expect(snap(app).settlement).toMatchObject({ won: false });
    expect(snap(app).settlement!.tip).not.toBeNull();
  });
});
