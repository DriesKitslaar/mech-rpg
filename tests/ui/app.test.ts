import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
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
function makeApp(saved?: GameState) {
  const store = memoryStore(saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {});
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 5 });
  return { app, store };
}
type Snap = {
  screen: string; credits: number | null; battlesWon: number | null; message?: string;
  menu: { items: { id: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: { phase: string; outcome: string; encounter: string };
  settlement?: { net: number; won: boolean };
};
const snap = (app: App) => app.snapshot() as Snap;
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
const ids = (app: App) => snap(app).menu.items.map((i) => i.id);
const select = (app: App, id: string) => {
  for (let i = 0; i < 20 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
};
/** Plays the current battle to its result screen by always firing the first weapon. */
function finishBattle(app: App): void {
  for (let i = 0; i < 20000 && snap(app).battle?.phase !== 'result'; i++) {
    const s = snap(app);
    if (s.battle!.phase === 'animating') app.update(16);
    else if (s.battle!.phase === 'action') {
      if (s.menu.items[0].enabled) press(app, 'confirm');
      else select(app, 'endTurn');
    } else press(app, 'confirm');
  }
  expect(snap(app).battle?.phase).toBe('result');
}

describe('title', () => {
  test('without a save only a new game is offered', () => {
    const { app } = makeApp();
    expect(snap(app).screen).toBe('title');
    expect(ids(app)).toEqual(['new']);
  });

  test('a new game opens the hub with the starting credits and is saved at once', () => {
    const { app, store } = makeApp();
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200, battlesWon: 0 });
    expect(JSON.parse(store.data[SAVE_KEY]).credits).toBe(1200);
  });

  test('a valid save offers continue first and loads it', () => {
    const saved = buy(newGame(CATALOG, STARTER_BUILD), 'wpn-arc-pistol', CATALOG);
    const { app } = makeApp(saved);
    expect(ids(app)).toEqual(['continue', 'new']);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 600 });
  });

  test('a corrupt save is treated as no save', () => {
    const store = memoryStore({ [SAVE_KEY]: '{not json' });
    const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: 1 });
    expect(ids(app)).toEqual(['new']);
  });

  test('starting over an existing save asks first, with no selected', () => {
    const saved = { ...newGame(CATALOG, STARTER_BUILD), credits: 4321 };
    const { app, store } = makeApp(saved);
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
    const { app } = makeApp(newGame(CATALOG, STARTER_BUILD));
    select(app, 'new');
    press(app, 'cancel');
    expect(ids(app)).toEqual(['continue', 'new']);
  });
});

describe('hub', () => {
  const inHub = (saved?: GameState) => { const made = makeApp(saved); press(made.app, 'confirm'); return made; };

  test('offers sortie, garage and shop', () => {
    const { app } = inHub();
    expect(ids(app)).toEqual(['sortie', 'garage', 'shop']);
    expect(snap(app).menu.items[0].enabled).toBe(true);
  });

  test('cancel does nothing', () => {
    const { app } = inHub();
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('a build that breaks a limit cannot deploy, and the hub says why', () => {
    let g = { ...newGame(CATALOG, STARTER_BUILD), credits: 20000 };
    for (const id of ['head-bulwark', 'core-bulwark', 'arms-bulwark']) g = buy(g, id, CATALOG);
    g = equip(equip(equip(g, 'head', 'head-bulwark', CATALOG), 'core', 'core-bulwark', CATALOG), 'arms', 'arms-bulwark', CATALOG);
    const { app } = inHub(g);
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'sortie', enabled: false, note: 'Overweight' });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a heavy frame within its limits may deploy', () => {
    let g = { ...newGame(CATALOG, STARTER_BUILD), credits: 20000 };
    for (const id of ['head-ronin', 'core-ronin', 'arms-ronin', 'legs-ronin', 'wpn-lance-emitter']) g = buy(g, id, CATALOG);
    for (const [slot, id] of [['head', 'head-ronin'], ['core', 'core-ronin'], ['arms', 'arms-ronin'], ['legs', 'legs-ronin'], ['rightHand', 'wpn-lance-emitter']] as const) {
      g = equip(g, slot, id, CATALOG);
    }
    // KD-1 gives 400, the Ronin frame drains 215: 185 left, and the Lance Emitter needs 170 - still fine.
    expect((makeApp(g).app.snapshot() as Snap).screen).toBe('title');
    const { app } = inHub(g);
    expect(snap(app).menu.items[0].enabled).toBe(true);
  });
});

describe('battle and settlement', () => {
  test('a sortie leads through the battle and the settlement back to the hub, saved', () => {
    const { app, store } = makeApp();
    press(app, 'confirm');
    select(app, 'sortie');
    expect(snap(app)).toMatchObject({ screen: 'battle', battle: { encounter: 'intro' } });
    finishBattle(app);
    const won = snap(app).battle!.outcome === 'victory';
    press(app, 'confirm');
    expect(snap(app).screen).toBe('settlement');
    const { net } = snap(app).settlement!;
    expect(snap(app).settlement!.won).toBe(won);
    expect(snap(app).credits).toBe(1200);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits: 1200 + net, battlesWon: won ? 1 : 0 });
    expect(JSON.parse(store.data[SAVE_KEY])).toMatchObject({ credits: 1200 + net, battlesWon: won ? 1 : 0 });
  });

  test('the encounter alternates with the number of battles won', () => {
    const { app } = makeApp({ ...newGame(CATALOG, STARTER_BUILD), battlesWon: 1 });
    press(app, 'confirm');
    select(app, 'sortie');
    expect(snap(app).battle!.encounter).toBe('outpost');
  });

  test('other keys on the result screen do not skip the settlement', () => {
    const { app } = makeApp();
    press(app, 'confirm');
    select(app, 'sortie');
    finishBattle(app);
    press(app, 'cancel', 'down', 'next');
    expect(snap(app).screen).toBe('battle');
  });
});
