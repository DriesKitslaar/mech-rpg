import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { SAVE_VERSION, buy, newGame } from '../../src/core/game';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}
const game = () => buy(newGame(CATALOG, STARTER_BUILD), 'wpn-arc-pistol', CATALOG);
/** The game as versions before 5 stored it: no booster or fire control, and settings without a difficulty. */
function old(): Record<string, any> {
  const g = game();
  const { booster: _b, fcs: _f, ...build } = g.build;
  const { 'bst-stock': _bs, 'fcs-stock': _fs, ...inventory } = g.inventory;
  const { difficulty: _d, ...settings } = g.settings;
  return { ...g, build, inventory, settings };
}

test('a saved game loads back identically', () => {
  const store = memoryStore();
  const file = new SaveFile(store, CATALOG);
  expect(file.save(game())).toBe(true);
  expect(new SaveFile(store, CATALOG).load()).toEqual(game());
});

test('no save loads as nothing', () => {
  expect(new SaveFile(memoryStore(), CATALOG).load()).toBeNull();
});

test.each([
  ['truncated JSON', '{'],
  ['the word null', 'null'],
  ['a list', '[]'],
  ['an empty string', ''],
  ['a wrong version', JSON.stringify({ ...game(), version: 0 })],
  ['an unknown part', JSON.stringify({ ...game(), inventory: { ...game().inventory, 'wpn-from-the-future': 1 } })],
])('%s loads as nothing', (_name, raw) => {
  expect(new SaveFile(memoryStore({ [SAVE_KEY]: raw }), CATALOG).load()).toBeNull();
});

test('storage that cannot be read loads as nothing', () => {
  const store: KeyValueStore = { getItem: () => { throw new Error('blocked'); }, setItem() {}, removeItem() {} };
  expect(new SaveFile(store, CATALOG).load()).toBeNull();
});

test('storage that cannot be written reports failure without throwing', () => {
  const store: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
  expect(new SaveFile(store, CATALOG).save(game())).toBe(false);
});

test('clear removes the save, and survives storage that refuses', () => {
  const store = memoryStore();
  const file = new SaveFile(store, CATALOG);
  file.save(game());
  file.clear();
  expect(store.data[SAVE_KEY]).toBeUndefined();
  const broken: KeyValueStore = { getItem: () => null, setItem() {}, removeItem: () => { throw new Error('blocked'); } };
  expect(() => new SaveFile(broken, CATALOG).clear()).not.toThrow();
});

test('a save from the first version is upgraded instead of thrown away', () => {
  const { completed: _c, read: _r, endingSeen: _e, xp: _x, perks: _p, arenaRank: _a, cycle: _y, settings: _s, ...rest } = old();
  const first = { ...rest, version: 1 };
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify(first) }), CATALOG).load();
  expect(loaded).toEqual({ ...game(), completed: [], read: [], endingSeen: false });
});

test('unusable save data is reported as such, a missing save is not', () => {
  expect(new SaveFile(memoryStore({ [SAVE_KEY]: '{' }), CATALOG).hasUnusableData()).toBe(true);
  expect(new SaveFile(memoryStore(), CATALOG).hasUnusableData()).toBe(false);
  const good = memoryStore();
  new SaveFile(good, CATALOG).save(game());
  expect(new SaveFile(good, CATALOG).hasUnusableData()).toBe(false);
});

test('a save from the second version is upgraded too, keeping its campaign progress', () => {
  const { endingSeen: _e, xp: _x, perks: _p, arenaRank: _a, cycle: _y, settings: _s, ...rest } = { ...old(), completed: ['intro-1'], read: ['welcome'] } as Record<string, any>;
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...rest, version: 2 }) }), CATALOG).load();
  expect(loaded).toMatchObject({ completed: ['intro-1'], read: ['welcome'], endingSeen: false });
  expect(loaded?.version).toBe(SAVE_VERSION);
});

test('a save from the third version gains a pilot and settings and keeps everything else', () => {
  const { xp: _x, perks: _p, arenaRank: _a, cycle: _y, settings: _s, ...rest } = { ...old(), completed: ['intro-1'], endingSeen: true, battlesWon: 7 } as Record<string, any>;
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...rest, version: 3 }) }), CATALOG).load();
  expect(loaded).toMatchObject({
    version: SAVE_VERSION, completed: ['intro-1'], battlesWon: 7, credits: game().credits,
    xp: 0, perks: {}, arenaRank: 0, cycle: 0, settings: { sfx: true, music: true, fastBattles: false, difficulty: 'standard' },
  });
});

describe('a save from the fourth version', () => {
  const fourth = (extra: Record<string, unknown> = {}) => ({ ...old(), version: 4, xp: 700, arenaRank: 3, cycle: 1, ...extra });
  const load = (save: unknown) => new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify(save) }), CATALOG).load();

  test('is issued the stock booster and fire control, fitted, and keeps everything else', () => {
    const loaded = load(fourth({ settings: { sfx: false, music: true, fastBattles: true } }));
    expect(loaded).toMatchObject({
      version: SAVE_VERSION, xp: 700, arenaRank: 3, cycle: 1, credits: game().credits,
      settings: { sfx: false, music: true, fastBattles: true, difficulty: 'standard' },
    });
    expect(loaded!.build).toEqual(game().build);
    expect(loaded!.inventory).toEqual(game().inventory);
  });

  test('stays inside its weight and energy limits: the issued parts weigh and drain nothing', () => {
    const loaded = load(fourth())!;
    expect(validatePlayerBuild(loaded.build, CATALOG)).toEqual([]);
    expect(computeBuildStats(loaded.build, CATALOG)).toMatchObject({ weight: 800, turnEnergy: 230 });
  });

  test('with unusable contents is still refused', () => {
    expect(load(fourth({ build: 'none' }))).toBeNull();
    expect(load(fourth({ inventory: null }))).toBeNull();
    expect(load(fourth({ settings: 7 }))).toBeNull();
  });
});

test('a save from the fifth version gains factory paint and three empty build slots', () => {
  const { paint: _p, loadouts: _l, ...rest } = { ...game(), xp: 300, arenaRank: 2 };
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...rest, version: 5 }) }), CATALOG).load();
  expect(loaded).toEqual({ ...game(), xp: 300, arenaRank: 2 });
  expect(loaded).toMatchObject({ version: SAVE_VERSION, paint: 'factory', loadouts: [null, null, null] });
});

describe('a save from the sixth version', () => {
  const sixth = (extra: Record<string, unknown> = {}) => {
    const { ranks: _r, scenes: _s, ...rest } = { ...game(), xp: 300, arenaRank: 2, ...extra } as Record<string, any>;
    return new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...rest, version: 6 }) }), CATALOG).load();
  };

  test('gains an empty list of ranks and of scenes and keeps everything else', () => {
    expect(sixth()).toEqual({ ...game(), xp: 300, arenaRank: 2 });
    expect(sixth()).toMatchObject({ version: SAVE_VERSION, ranks: {}, scenes: [] });
  });

  test('that had seen the old ending has not seen the new one: the story goes on past it', () => {
    const done = ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen', 'finale-lumen'];
    expect(sixth({ completed: done, endingSeen: true })).toMatchObject({ completed: done, endingSeen: false });
  });
});

test('ranks and scenes that are not what the game writes are refused', () => {
  const load = (extra: Record<string, unknown>) =>
    new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...game(), ...extra }) }), CATALOG).load();
  expect(load({ ranks: { 'intro-1': 'S' }, scenes: ['act-1'] })).toMatchObject({ ranks: { 'intro-1': 'S' }, scenes: ['act-1'] });
  expect(load({ ranks: { 'intro-1': 'Z' } })).toBeNull();
  expect(load({ ranks: ['S'] })).toBeNull();
  expect(load({ scenes: [1] })).toBeNull();
  expect(load({ scenes: 'act-1' })).toBeNull();
});

describe('settings', () => {
  const mem = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; }, removeItem: (k: string) => { delete data[k]; } };
  };

  test('are stored apart from the game and read back', () => {
    const store = mem();
    const file = new SaveFile(store, CATALOG);
    expect(file.loadSettings()).toBeNull();
    expect(file.saveSettings({ sfx: false, music: true, fastBattles: true, difficulty: 'veteran' })).toBe(true);
    expect(new SaveFile(store, CATALOG).loadSettings()).toEqual({ sfx: false, music: true, fastBattles: true, difficulty: 'veteran', rumble: true });
    file.saveSettings({ sfx: false, music: true, fastBattles: true, difficulty: 'veteran', rumble: false });
    expect(new SaveFile(store, CATALOG).loadSettings()?.rumble).toBe(false);
  });

  test('stored before there was a difficulty, or with one that does not exist, get the standard one', () => {
    const before = mem({ 'ironwage-settings': '{"sfx":false,"music":false,"fastBattles":true}' });
    // Rumble came later still: settings stored without it have it on.
    expect(new SaveFile(before, CATALOG).loadSettings()).toEqual({ sfx: false, music: false, fastBattles: true, difficulty: 'standard', rumble: true });
    const oddRumble = mem({ 'ironwage-settings': '{"sfx":true,"music":true,"fastBattles":false,"rumble":"hard"}' });
    expect(new SaveFile(oddRumble, CATALOG).loadSettings()?.rumble).toBe(true);
    const odd = mem({ 'ironwage-settings': '{"sfx":true,"music":true,"fastBattles":false,"difficulty":"nightmare"}' });
    expect(new SaveFile(odd, CATALOG).loadSettings()?.difficulty).toBe('standard');
  });

  test.each(['{oops', '[]', '{"sfx":"yes","music":true,"fastBattles":false}', '{"sfx":true}'])('unusable settings %s count as none', (raw) => {
    expect(new SaveFile(mem({ 'ironwage-settings': raw }), CATALOG).loadSettings()).toBeNull();
  });

  test('a device that refuses to store them is reported', () => {
    const store = { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(new SaveFile(store, CATALOG).saveSettings({ sfx: true, music: true, fastBattles: false, difficulty: 'standard' })).toBe(false);
  });
});
