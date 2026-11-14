import { completeMission } from '../../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { SAVE_KEY, SETTINGS_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
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
  settlement?: { net: number; won: boolean; reward: number };
  ending?: string;
  xp: number | null; level: number | null; arenaRank: number | null; cycle: number | null;
  settings: { sfx: boolean; music: boolean; fastBattles: boolean; difficulty: string };
  player?: { maxAp: number; repairsLeft: number };
  pilot?: { level: number; points: number };
};
const snap = (app: App) => app.snapshot() as Snap;
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
const ids = (app: App) => snap(app).menu.items.map((i) => i.id);
/** The contracts on the list that are not generated ones. */
const story = (app: App) => ids(app).filter((id) => !id.startsWith('open-'));
const open = (app: App) => ids(app).filter((id) => id.startsWith('open-'));
const select = (app: App, id: string) => {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
};
const HUB = ['contracts', 'arena', 'garage', 'shop', 'pilot', 'messages', 'options'];
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
    expect(ids(app)).toEqual(['new', 'options']);
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
    expect(ids(app)).toEqual(['continue', 'new', 'options']);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 600 });
  });

  test('a save that cannot be used is treated as no save, and the player is told', () => {
    const store = memoryStore({ [SAVE_KEY]: '{not json' });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    expect(ids(app)).toEqual(['new', 'options']);
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
    expect(ids(app)).toEqual(['continue', 'new', 'options']);
    expect(JSON.parse(store.data[SAVE_KEY]).credits).toBe(4321);
    select(app, 'new');
    select(app, 'yes');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200 });
  });

  test('cancel backs out of the question', () => {
    const { app } = makeApp(fresh());
    select(app, 'new');
    press(app, 'cancel');
    expect(ids(app)).toEqual(['continue', 'new', 'options']);
  });
});

describe('hub', () => {
  test('offers contracts, garage, shop and messages, and counts unread messages', () => {
    const { app } = inHub();
    expect(ids(app)).toEqual(['contracts', 'arena', 'garage', 'shop', 'pilot', 'messages', 'options']);
    expect(snap(app).menu.items[5].note).toBe('1 new');
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
    expect(ids(app)).toEqual(HUB);
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
    expect(ids(app)).toEqual(HUB);
  });

  test('a contract opens its briefing, and declining returns to the contract list', () => {
    const { app } = inHub();
    select(app, 'contracts');
    select(app, 'intro-1');
    expect(snap(app).screen).toBe('briefing');
    expect(ids(app)).toEqual(['accept', 'back']);
    select(app, 'back');
    expect(snap(app).screen).toBe('hub');
    expect(ids(app)).toEqual(['patrol', 'intro-1']);
    select(app, 'intro-1');
    press(app, 'cancel');
    expect(ids(app)).toEqual(['patrol', 'intro-1']);
    press(app, 'cancel');
    expect(ids(app)).toEqual(HUB);
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
    expect(story(app)).toEqual(['patrol', 'hadron-1', 'lumen-1', 'undertow-1']);
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
    expect(story(app)).toEqual(['patrol']);
    // Seen once: returning to the hub later does not replay it.
    press(app, 'cancel');
    select(app, 'garage');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('taking one exclusive contract withdraws the other two', () => {
    const { app } = inHub(allButFinale('lumen'));
    select(app, 'contracts');
    expect(story(app)).toEqual(['patrol', 'finale-lumen']);
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
    expect(snap(app).menu.items.find((i) => i.id === 'messages')!.note).toBeUndefined();
  });

  test('new messages arrive as contracts are completed, newest first', () => {
    const { app } = inHub(done('intro-1', 'intro-2'));
    expect(snap(app).menu.items.find((i) => i.id === 'messages')!.note).toBe('3 new');
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
    press(app, 'next', 'next', 'next', 'next', 'next', 'next', 'next', 'next');
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
    press(app, 'next', 'next', 'next', 'next', 'next', 'next', 'next', 'next');
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

describe('closing the game at an awkward moment', () => {
  test('the outcome is booked as soon as the last battle is decided, before any button is pressed', () => {
    const { app, store } = inHub();
    accept(app, 'patrol');
    finishBattle(app);
    expect(snap(app).screen).toBe('battle');
    const saved = JSON.parse(store.data[SAVE_KEY]);
    expect(saved.battlesWon).toBe(1);
    expect(saved.credits).toBeGreaterThan(1200);
    // Reopening instead of pressing on finds the reward kept.
    const reopened = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    press(reopened, 'confirm');
    expect(snap(reopened).credits).toBe(saved.credits);
    // Pressing on shows the same settlement without booking it again.
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'settlement', credits: saved.credits });
  });

  test('a retreat is billed even if the game is closed on the defeat panel', () => {
    const { app, store } = inHub(undefined, 5);
    accept(app, 'patrol');
    for (let i = 0; i < 200 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    press(app, 'confirm', 'confirm', 'confirm'); // fire once so there is a bill
    for (let i = 0; i < 400 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    select(app, 'retreat');
    select(app, 'yes');
    expect(JSON.parse(store.data[SAVE_KEY]).credits).toBeLessThan(1200);
  });

  test('an ending that was never seen is shown the next time the hub opens', () => {
    const finished = { ...done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-undertow', 'finale-undertow') };
    const { app, store } = makeApp(finished);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'ending', ending: 'undertow' });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    expect(JSON.parse(store.data[SAVE_KEY]).endingSeen).toBe(true);
    // And only once.
    const again = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    press(again, 'confirm');
    expect(snap(again).screen).toBe('hub');
  });

  test('the ending can be read again as a message afterwards', () => {
    const finished = { ...done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen', 'finale-lumen'), endingSeen: true };
    const { app } = inHub(finished);
    select(app, 'messages');
    expect(ids(app)[0]).toBe('ending-lumen');
  });

  test('a pilot who owns no weapon at all is issued a rifle on reaching the hub', () => {
    const { 'wpn-rivet-rifle': _gone, ...inventory } = fresh().inventory;
    const { rightHand: _slot, ...build } = fresh().build;
    const { app } = inHub({ ...fresh(), credits: 50, inventory, build });
    expect((app.snapshot() as { inventory: Record<string, number> }).inventory['wpn-rivet-rifle']).toBe(1);
    select(app, 'garage');
    select(app, 'rightHand');
    select(app, 'wpn-rivet-rifle');
    press(app, 'cancel');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'contracts', enabled: true });
  });
});

describe('pilot levels and perks', () => {
  test('a won contract teaches a tenth of its pay', () => {
    const { app } = inHub();
    accept(app, 'patrol');
    finishMission(app);
    expect(snap(app).settlement!.won).toBe(true);
    expect(snap(app)).toMatchObject({ xp: 40, level: 1 });
  });

  test('perks change the mech in battle, in every battle of a contract', () => {
    const plain = inHub(geared(done('intro-1', 'intro-2'), 'tier1')).app;
    accept(plain, 'hadron-1');
    const base = snap(plain).player!;
    expect(base.repairsLeft).toBe(2);

    const { app } = inHub({ ...geared(done('intro-1', 'intro-2'), 'tier1'), xp: 5400, perks: { plating: 3, fieldTech: 2 } });
    accept(app, 'hadron-1');
    expect(snap(app).player!.repairsLeft).toBe(4);
    expect(snap(app).player!.maxAp).toBeGreaterThan(base.maxAp * 1.17);
    expect(snap(app).player!.maxAp).toBeLessThan(base.maxAp * 1.19);
    finishBattle(app);
    if (snap(app).battle!.outcome === 'victory') {
      press(app, 'confirm');
      expect(snap(app).battle!.index).toBe(1);
      expect(snap(app).player!.maxAp).toBeGreaterThan(base.maxAp * 1.17);
      expect(snap(app).player!.maxAp).toBeLessThan(base.maxAp * 1.19);
    }
  });

  test('the haggler perk raises the pay', () => {
    const { app } = inHub({ ...fresh(), xp: 5400, perks: { haggler: 3 } });
    accept(app, 'patrol');
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 496 });
  });

  test('a perk point is spent on the pilot screen, once, and saved', () => {
    const { app, store } = inHub({ ...fresh(), xp: 200 });
    select(app, 'pilot');
    expect(snap(app)).toMatchObject({ screen: 'pilot', pilot: { level: 2, points: 1 } });
    select(app, 'marksman');
    expect(snap(app).pilot).toMatchObject({ points: 0 });
    expect(snap(app).menu.items.find((i) => i.id === 'marksman')!.note).toBe('1/3');
    press(app, 'confirm');
    expect(JSON.parse(store.data[SAVE_KEY]).perks).toEqual({ marksman: 1 });
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('the arena', () => {
  const ready = (extra: Partial<GameState> = {}) => inHub({ ...geared(done('intro-1', 'intro-2'), 'tier3'), ...extra }, 3);

  test('is locked until the introductions are done', () => {
    const { app } = inHub();
    const item = snap(app).menu.items.find((i) => i.id === 'arena')!;
    expect(item.enabled).toBe(false);
  });

  test('lists the ladder; only the next opponent and beaten ones can be picked', () => {
    const { app } = ready({ arenaRank: 2 });
    select(app, 'arena');
    expect(snap(app).screen).toBe('arena');
    const items = snap(app).menu.items;
    expect(items.map((i) => i.id)).toEqual(['rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5', 'rank-6', 'rank-7', 'rank-8', 'rank-9', 'rank-10']);
    expect(items.map((i) => i.enabled)).toEqual([true, true, true, false, false, false, false, false, false, false]);
    expect(items.slice(0, 3).map((i) => i.note)).toEqual(['200', '300', '1600']);
    expect(snap(app).menu.cursor).toBe(2);
    press(app, 'down', 'confirm');
    expect(snap(app).screen).toBe('arena');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('a fight is briefed, fought and paid like a contract, and raises the rank once', () => {
    const { app } = ready();
    const before = snap(app).credits!;
    select(app, 'arena');
    select(app, 'rank-1');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'arena-1' } });
    press(app, 'cancel');
    expect(snap(app).screen).toBe('arena');
    select(app, 'rank-1');
    select(app, 'accept');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { mission: 'arena-1' } });
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 800 });
    expect(snap(app)).toMatchObject({ arenaRank: 1, completed: ['intro-1', 'intro-2'] });
    expect(snap(app).credits).toBe(before + snap(app).settlement!.net);

    // A rematch pays a quarter and leaves the rank alone.
    press(app, 'confirm');
    select(app, 'arena');
    select(app, 'rank-1');
    select(app, 'accept');
    finishMission(app);
    if (snap(app).settlement!.won) expect(snap(app).settlement!.reward).toBe(200);
    expect(snap(app).arenaRank).toBe(1);
  });
});

describe('open contracts', () => {
  test('three appear once the introductions are done, and not before', () => {
    const early = inHub().app;
    select(early, 'contracts');
    expect(open(early)).toEqual([]);
    const { app } = inHub(done('intro-1', 'intro-2'));
    select(app, 'contracts');
    expect(open(app)).toHaveLength(3);
  });

  test('winning one is never recorded and brings a new board', () => {
    const { app } = inHub(geared(done('intro-1', 'intro-2'), 'tier3'), 3);
    select(app, 'contracts');
    const board = open(app);
    press(app, 'cancel');
    accept(app, board[0]);
    finishMission(app);
    expect(snap(app).settlement!.won).toBe(true);
    expect(snap(app).completed).toEqual(['intro-1', 'intro-2']);
    press(app, 'confirm');
    select(app, 'contracts');
    expect(open(app)).toHaveLength(3);
    expect(open(app)).not.toEqual(board);
  });
});

describe('a new cycle', () => {
  const finished = (): GameState => ({
    ...done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen', 'finale-lumen'),
    endingSeen: true, credits: 5000, xp: 700, arenaRank: 2,
  });

  test('is not offered before the campaign is over', () => {
    const { app } = inHub(done('intro-1', 'intro-2'));
    expect(ids(app)).not.toContain('cycle');
  });

  test('asks first, then restarts the story with everything kept, tougher and better paid', () => {
    const { app, store } = inHub(finished());
    expect(ids(app)).toContain('cycle');
    select(app, 'cycle');
    expect(ids(app)).toEqual(['no', 'yes']);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', cycle: 0 });
    select(app, 'cycle');
    select(app, 'yes');
    expect(snap(app)).toMatchObject({ screen: 'hub', cycle: 1, completed: [], credits: 5000, xp: 700, arenaRank: 2 });
    expect(JSON.parse(store.data[SAVE_KEY]).cycle).toBe(1);
    expect(ids(app)).not.toContain('cycle');
    select(app, 'contracts');
    expect(story(app)).toEqual(['patrol', 'intro-1']);
    expect(open(app)).toHaveLength(3);
    expect(snap(app).menu.items.find((i) => i.id === 'intro-1')!.note).toBe('900');
    expect(snap(app).menu.items.find((i) => i.id === 'patrol')!.note).toBe('400');
  });
});

describe('options', () => {
  test('can be changed before a game exists, and the choice is remembered', () => {
    const { app, store } = makeApp();
    expect(ids(app)).toEqual(['new', 'options']);
    select(app, 'options');
    expect(snap(app).screen).toBe('options');
    expect(snap(app).menu.items.map((i) => [i.id, i.note])).toEqual([['sfx', 'On'], ['music', 'On'], ['fastBattles', 'Off'], ['difficulty', 'Standard']]);
    press(app, 'confirm');
    expect(snap(app).menu.items[0].note).toBe('Off');
    expect(JSON.parse(store.data[SETTINGS_KEY]).sfx).toBe(false);
    press(app, 'cancel');
    expect(snap(app).screen).toBe('title');
    select(app, 'new');
    expect(snap(app).settings).toEqual({ sfx: false, music: true, fastBattles: false, difficulty: 'standard' });

    const again = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    expect(snap(again).settings.sfx).toBe(false);
  });

  test('opened from the hub they return to the hub, and are saved with the game', () => {
    const { app, store } = inHub();
    select(app, 'options');
    select(app, 'fastBattles');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    expect(JSON.parse(store.data[SAVE_KEY]).settings.fastBattles).toBe(true);
  });

  test('sound and music follow the settings and the screen', () => {
    const store = memoryStore();
    const tracks: (string | null)[] = [];
    const music = { enabled: true, play: (t: string | null) => { tracks.push(t); } };
    const sfx = { muted: false, play: () => {}, unlock: () => {} };
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 5, music, sfx: sfx as never });
    expect(tracks.at(-1)).toBe('menu');
    press(app, 'confirm');
    accept(app, 'patrol');
    expect(tracks.at(-1)).toBe('battle');
    finishMission(app);
    expect(tracks.at(-1)).toBe('menu');
    press(app, 'confirm');
    select(app, 'options');
    select(app, 'music');
    expect(music.enabled).toBe(false);
    select(app, 'sfx');
    expect(sfx.muted).toBe(true);
  });
});
