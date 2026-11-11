import { completeMission } from '../../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
import type { InputAction } from '../../src/platform/input';
import { App } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';

const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; },
  };
}
function makeApp(saved?: GameState, seed = 5) {
  const store = memoryStore(saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {});
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed });
  return { app, store };
}
type Snap = {
  screen: string; credits: number | null; battlesWon: number | null; completed: string[] | null; message?: string;
  saveFailed: boolean; build: Record<string, string> | null;
  menu: { items: { id: string; label: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: { phase: string; outcome: string; mission: string; index: number; of: number };
  settlement?: { net: number; won: boolean };
  ending?: string;
};
const snap = (app: App) => app.snapshot() as Snap;
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
const ids = (app: App) => snap(app).menu.items.map((i) => i.id);
const select = (app: App, id: string) => {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
};
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const done = (...missionIds: string[]): GameState => missionIds.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
/** A save that owns and wears one of the reference builds. */
function geared(base: GameState, buildName: string): GameState {
  let g = { ...base, credits: 99999 };
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS[buildName])) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof typeof g.build, id, CATALOG);
  }
  return { ...g, credits: base.credits };
}
const inHub = (saved?: GameState, seed?: number) => { const made = makeApp(saved, seed); press(made.app, 'confirm'); return made; };
/** From the hub into a contract's first battle. */
function accept(app: App, missionId: string): void {
  select(app, 'contracts');
  select(app, missionId);
  expect(snap(app).screen).toBe('briefing');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
}
/**
 * Plays the current battle to its result screen. `strong` fires every weapon each turn at the weakest
 * enemy, which wins most battles; otherwise only the first weapon is fired.
 */
function finishBattle(app: App): void {
  for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
    const s = snap(app);
    if (s.battle!.phase === 'animating') app.update(16);
    else if (s.battle!.phase === 'action') {
      if (s.menu.items[0].enabled) press(app, 'confirm');
      else select(app, 'endTurn');
    } else press(app, 'confirm');
  }
  expect(snap(app).battle?.phase).toBe('result');
}
/** Plays a whole contract through all its battles until the settlement appears. */
function finishMission(app: App): void {
  for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) {
    finishBattle(app);
    press(app, 'confirm');
  }
  expect(snap(app).screen).toBe('settlement');
}

describe('title', () => {
  test('without a save only a new game is offered', () => {
    const { app } = makeApp();
    expect(snap(app).screen).toBe('title');
    expect(ids(app)).toEqual(['new']);
    expect(snap(app).message).toBe('');
  });

  test('a new game opens the hub with the starting credits and is saved at once', () => {
    const { app, store } = makeApp();
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200, battlesWon: 0, completed: [] });
    expect(JSON.parse(store.data[SAVE_KEY]).credits).toBe(1200);
  });

  test('a valid save offers continue first and loads it', () => {
    const { app } = makeApp(buy(fresh(), 'wpn-arc-pistol', CATALOG));
    expect(ids(app)).toEqual(['continue', 'new']);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 600 });
  });

  test('a save that cannot be used is treated as no save, and the player is told', () => {
    const store = memoryStore({ [SAVE_KEY]: '{not json' });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    expect(ids(app)).toEqual(['new']);
    expect(snap(app).message).toBe('Your saved game could not be read.');
  });

  test('starting over an existing save asks first, with no selected', () => {
    const { app, store } = makeApp({ ...fresh(), credits: 4321 });
    select(app, 'new');
    expect(snap(app).screen).toBe('title');
    expect(ids(app)).toEqual(['no', 'yes']);
    expect(snap(app).menu.cursor).toBe(0);
    expect(snap(app).message).toBe('Start over? This erases your save.');
    press(app, 'confirm');
    expect(ids(app)).toEqual(['continue', 'new']);
    expect(JSON.parse(store.data[SAVE_KEY]).credits).toBe(4321);
    select(app, 'new');
    select(app, 'yes');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200 });
  });

  test('cancel backs out of the question', () => {
    const { app } = makeApp(fresh());
    select(app, 'new');
    press(app, 'cancel');
    expect(ids(app)).toEqual(['continue', 'new']);
  });
});

describe('hub', () => {
  test('offers contracts, garage, shop and messages, and counts unread messages', () => {
    const { app } = inHub();
    expect(ids(app)).toEqual(['contracts', 'garage', 'shop', 'messages']);
    expect(snap(app).menu.items[3].note).toBe('1 new');
  });

  test('cancel does nothing', () => {
    const { app } = inHub();
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('a build that breaks a limit cannot take contracts, and the hub says why', () => {
    let g = { ...fresh(), credits: 20000 };
    for (const id of ['head-bulwark', 'core-bulwark', 'arms-bulwark']) g = buy(g, id, CATALOG);
    g = equip(equip(equip(g, 'head', 'head-bulwark', CATALOG), 'core', 'core-bulwark', CATALOG), 'arms', 'arms-bulwark', CATALOG);
    const { app } = inHub(g);
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'contracts', enabled: false, note: 'Overweight' });
    // The cursor starts on the garage, where the problem can be fixed.
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('garage');
    select(app, 'contracts');
    expect(snap(app).screen).toBe('hub');
    expect(ids(app)).toEqual(['contracts', 'garage', 'shop', 'messages']);
  });

  test('a mech without any weapon cannot take contracts', () => {
    const { app } = inHub(equip(fresh(), 'rightHand', null, CATALOG));
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'contracts', enabled: false, note: 'No weapon' });
  });
});

describe('contracts and briefings', () => {
  test('a new pilot is offered the patrol and the first introduction, with their pay', () => {
    const { app } = inHub();
    select(app, 'contracts');
    expect(snap(app).menu.items).toMatchObject([
      { id: 'patrol', label: 'Perimeter Sweep', note: '400' }, { id: 'intro-1', label: 'Shakedown Run', note: '600' },
    ]);
  });

  test('cancel returns from the contract list to the hub menu', () => {
    const { app } = inHub();
    select(app, 'contracts');
    press(app, 'cancel');
    expect(ids(app)).toEqual(['contracts', 'garage', 'shop', 'messages']);
  });

  test('a contract opens its briefing, which can be accepted or declined', () => {
    const { app } = inHub();
    select(app, 'contracts');
    select(app, 'intro-1');
    expect(snap(app).screen).toBe('briefing');
    expect(ids(app)).toEqual(['accept', 'back']);
    select(app, 'back');
    expect(snap(app).screen).toBe('hub');
    select(app, 'contracts');
    select(app, 'intro-1');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('accepting starts the first battle of the contract', () => {
    const { app } = inHub();
    accept(app, 'intro-1');
    expect(snap(app).battle).toMatchObject({ mission: 'intro-1', index: 0, of: 1 });
  });

  test('a pilot in debt can still take a contract', () => {
    const { app } = inHub({ ...fresh(), credits: -500 });
    accept(app, 'patrol');
  });

  test('the three clients appear after the introductions', () => {
    const { app } = inHub(done('intro-1', 'intro-2'));
    select(app, 'contracts');
    expect(ids(app)).toEqual(['patrol', 'hadron-1', 'lumen-1', 'undertow-1']);
  });
});

describe('battle and settlement', () => {
  test('a won contract is booked, recorded and saved the moment the settlement appears', () => {
    const { app, store } = inHub();
    accept(app, 'intro-1');
    finishMission(app);
    const { net, won } = snap(app).settlement!;
    // The starter build wins the first introduction with this seed; revisit if content changes that.
    expect(won).toBe(true);
    expect(net).toBeGreaterThan(0);
    expect(snap(app)).toMatchObject({ credits: 1200 + net, battlesWon: 1, completed: ['intro-1'] });
    expect(JSON.parse(store.data[SAVE_KEY])).toMatchObject({ credits: 1200 + net, battlesWon: 1, completed: ['intro-1'] });

    // Closing the game on the settlement screen must not lose the reward.
    const reopened = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    press(reopened, 'confirm');
    expect(snap(reopened)).toMatchObject({ screen: 'hub', credits: 1200 + net, completed: ['intro-1'] });

    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200 + net });
    select(app, 'contracts');
    expect(ids(app)).toEqual(['patrol', 'intro-2']);
  });

  test('a lost contract charges its costs, pays nothing and stays on offer', () => {
    // The starter build alone does not survive the Hadron exclusive contract.
    const { app } = inHub(done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1'));
    accept(app, 'choice-hadron');
    finishMission(app);
    const { net, won } = snap(app).settlement!;
    expect(won).toBe(false);
    expect(net).toBeLessThan(0);
    expect(snap(app)).toMatchObject({ credits: 1200 + net, battlesWon: 0 });
    expect(snap(app).completed).not.toContain('choice-hadron');
    press(app, 'confirm');
    select(app, 'contracts');
    expect(ids(app)).toContain('choice-hadron');
  });

  test('a contract with several battles carries damage from one to the next', () => {
    const { app } = inHub(geared(done('intro-1', 'intro-2'), 'tier1'));
    accept(app, 'hadron-1');
    expect(snap(app).battle).toMatchObject({ index: 0, of: 2 });
    finishBattle(app);
    expect(snap(app).battle!.outcome).toBe('victory');
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { mission: 'hadron-1', index: 1, of: 2, outcome: 'ongoing' } });
  });

  test('pressing confirm again and again books the settlement only once', () => {
    const { app } = inHub();
    accept(app, 'patrol');
    finishMission(app);
    const { net } = snap(app).settlement!;
    press(app, 'confirm', 'confirm', 'cancel');
    expect(snap(app).credits).toBe(1200 + net);
  });

  test('other keys on the result screen do not skip ahead', () => {
    const { app } = inHub();
    accept(app, 'patrol');
    finishBattle(app);
    press(app, 'cancel', 'down', 'next');
    expect(snap(app).screen).toBe('battle');
  });

  test('the patrol can be taken again and again and is never recorded', () => {
    const { app } = inHub();
    for (let i = 0; i < 2; i++) {
      accept(app, 'patrol');
      finishMission(app);
      press(app, 'confirm');
      expect(snap(app).screen).toBe('hub');
    }
    expect(snap(app).completed).toEqual([]);
    expect(snap(app).battlesWon).toBe(2);
  });

  test('a device that refuses to save is reported, and play goes on', () => {
    const store: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    press(app, 'confirm');
    expect(app.snapshot()).toMatchObject({ screen: 'hub', saveFailed: true, message: 'Could not save: storage is full or blocked' });
    accept(app, 'patrol');
  });
});

describe('the campaign', () => {
  const allButFinale = (choice: string) => done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', `choice-${choice}`);

  test.each(['hadron', 'lumen', 'undertow'])('the %s finale leads to its ending and back to a hub with only the patrol', (faction) => {
    // Late-game gear, and as many attempts as it takes: the point is that the ending is reachable.
    const { app } = inHub(geared(allButFinale(faction), 'tier3'), 11);
    let won = false;
    for (let attempt = 0; attempt < 12 && !won; attempt++) {
      accept(app, `finale-${faction}`);
      finishMission(app);
      won = snap(app).settlement!.won;
      press(app, 'confirm');
      if (!won) expect(snap(app).screen).toBe('hub');
    }
    expect(won).toBe(true);
    expect(snap(app)).toMatchObject({ screen: 'ending', ending: faction });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    select(app, 'contracts');
    expect(ids(app)).toEqual(['patrol']);
  });

  test('taking one exclusive contract withdraws the other two', () => {
    const { app } = inHub(allButFinale('lumen'));
    select(app, 'contracts');
    expect(ids(app)).toEqual(['patrol', 'finale-lumen']);
  });
});

describe('messages', () => {
  test('messages can be opened and read, which clears the counter', () => {
    const { app, store } = inHub();
    select(app, 'messages');
    expect(snap(app).screen).toBe('messages');
    expect(snap(app).menu.items).toMatchObject([{ id: 'welcome', label: 'Your licence is active', note: 'NEW' }]);
    select(app, 'welcome');
    expect(JSON.parse(store.data[SAVE_KEY]).read).toEqual(['welcome']);
    press(app, 'cancel');
    expect(snap(app).menu.items[0].note).toBeUndefined();
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    expect(snap(app).menu.items[3].note).toBeUndefined();
  });

  test('new messages arrive as contracts are completed, newest first', () => {
    const { app } = inHub(done('intro-1', 'intro-2'));
    expect(snap(app).menu.items[3].note).toBe('3 new');
    select(app, 'messages');
    expect(ids(app)).toEqual(['clients', 'after-intro-1', 'welcome']);
  });
});

describe('garage', () => {
  test('opens from the hub, saves every change, and returns with cancel', () => {
    const { app, store } = inHub(buy(fresh(), 'wpn-arc-pistol', CATALOG));
    select(app, 'garage');
    expect(snap(app).screen).toBe('garage');
    select(app, 'leftHand');
    select(app, 'wpn-arc-pistol');
    expect(JSON.parse(store.data[SAVE_KEY]).build.leftHand).toBe('wpn-arc-pistol');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('shop', () => {
  test('opens from the hub, saves every trade, and returns with cancel', () => {
    const { app, store } = inHub();
    select(app, 'shop');
    expect(snap(app).screen).toBe('shop');
    press(app, 'next', 'next', 'next', 'next', 'next');
    select(app, 'wpn-arc-pistol');
    expect(snap(app).credits).toBe(600);
    expect(JSON.parse(store.data[SAVE_KEY]).inventory['wpn-arc-pistol']).toBe(1);
    expect(snap(app).message).toBe('Bought Arc Pistol');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('a client\'s gear is only in stock after working for them', () => {
    const before = inHub().app;
    select(before, 'shop');
    expect(ids(before)).toEqual(['head-scout-mk1']);

    const after = inHub(done('intro-1', 'intro-2', 'lumen-1')).app;
    select(after, 'shop');
    expect(ids(after)).toEqual(['head-scout-mk1', 'head-halo']);
  });

  test('a part bought in the shop can be fitted in the garage and taken into battle', () => {
    const { app } = inHub();
    select(app, 'shop');
    press(app, 'next', 'next', 'next', 'next', 'next');
    select(app, 'wpn-arc-pistol');
    press(app, 'cancel');
    select(app, 'garage');
    select(app, 'leftHand');
    select(app, 'wpn-arc-pistol');
    press(app, 'cancel');
    accept(app, 'patrol');
    expect(snap(app).build!.leftHand).toBe('wpn-arc-pistol');
  });
});
