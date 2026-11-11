import { buy, newGame } from '../../src/core/game';
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
  const { completed: _c, read: _r, endingSeen: _e, ...rest } = game();
  const old = { ...rest, version: 1 };
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify(old) }), CATALOG).load();
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
  const { endingSeen: _e, ...rest } = { ...game(), completed: ['intro-1'], read: ['welcome'] };
  const loaded = new SaveFile(memoryStore({ [SAVE_KEY]: JSON.stringify({ ...rest, version: 2 }) }), CATALOG).load();
  expect(loaded).toMatchObject({ completed: ['intro-1'], read: ['welcome'], endingSeen: false });
  expect(loaded?.version).toBe(3);
});
