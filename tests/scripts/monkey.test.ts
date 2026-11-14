import { completeMission } from '../../src/core/campaign';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import { xpForLevel } from '../../src/core/pilot';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import type { InputAction } from '../../src/platform/input';
import { SAVE_KEY, SaveFile, slotKey, type KeyValueStore } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';

/**
 * Someone with their eyes shut and a thumb on every button. Nothing they press, in any order, on
 * any screen, may throw, trap them, or leave a stored game that differs from the one being played.
 */
const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const ACTIONS: InputAction[] = ['up', 'down', 'left', 'right', 'confirm', 'confirm', 'confirm', 'cancel', 'prev', 'next'];

/** A small seeded generator: the same seed presses the same buttons. */
function dice(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A store that keeps what it is given, except that now and then it refuses, as a full device would. */
function flakyStore(initial: Record<string, string>, refuse: () => boolean): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { if (refuse()) throw new Error('storage is full'); data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

type Snap = {
  screen: string; saveFailed: boolean; slot: number; credits: number | null;
  menu: { items: { id: string; enabled: boolean }[]; cursor: number }; battle?: { phase: string };
};

/** Gets to the hub from wherever the game is, the way a person who has had enough would: back out, give up the fight, press through. */
function walkToHub(app: App): number {
  const snap = () => app.snapshot() as Snap;
  const push = (want: InputAction): void => app.onInput(want);
  for (let presses = 0; presses < 4000; presses++) {
    const s = snap();
    if (s.screen === 'hub') {
      // The hub may have a list open; back out of it.
      push('cancel');
      push('cancel');
      return presses;
    }
    if (s.screen === 'battle') {
      const phase = s.battle!.phase;
      if (phase === 'animating') app.update(16);
      else if (phase === 'action') {
        const at = s.menu.items[s.menu.cursor]?.id;
        push(at === 'retreat' ? 'confirm' : 'down');
      } else if (phase === 'confirmRetreat') {
        const at = s.menu.items[s.menu.cursor]?.id;
        push(at === 'yes' ? 'confirm' : 'down');
      } else if (phase === 'talk' || phase === 'result') push('confirm');
      else push('cancel');
    } else if (['settlement', 'scene', 'ending', 'credits', 'callsign', 'title'].includes(s.screen)) push('confirm');
    else push('cancel');
  }
  return -1;
}

/** `enter` goes to that entry of the hub's menu before the pressing starts, so every screen gets its share. */
function monkey(seed: number, steps: number, saved: GameState | undefined, refuseShare: number, enter?: string): { screens: Set<string>; refused: number } {
  const roll = dice(seed);
  let refused = 0;
  let flaky = false;
  const store = flakyStore(saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {}, () => {
    const no = flaky && roll() < refuseShare;
    if (no) refused += 1;
    return no;
  });
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed });
  const screens = new Set<string>();
  if (enter) {
    expect(walkToHub(app)).toBeGreaterThanOrEqual(0);
    const items = (app.snapshot() as Snap).menu.items;
    const index = items.findIndex((item) => item.id === enter && item.enabled);
    if (index >= 0) {
      for (let i = 0; i < index; i++) app.onInput('down');
      app.onInput('confirm');
    }
  }
  flaky = true;
  for (let step = 0; step < steps; step++) {
    const before = app.snapshot() as Snap;
    screens.add(before.screen);
    // In a battle that is playing itself out, time has to pass.
    if (before.screen === 'battle' && before.battle?.phase === 'animating') app.update(16);
    else app.onInput(ACTIONS[Math.floor(roll() * ACTIONS.length)]);
    if (roll() < 0.02) app.update(Math.floor(roll() * 3000));
    const after = app.snapshot() as Snap;
    expect(() => JSON.stringify(after)).not.toThrow();
    const game = app.game;
    if (!game) continue;
    expect(Number.isSafeInteger(game.credits), `credits at step ${step}`).toBe(true);
    expect(isValidState(game, CATALOG), `the game in memory at step ${step} on ${after.screen}`).toBe(true);
    // What is stored in the slot being played is always a whole, valid game: the one in memory, or an
    // earlier one when a write was refused.
    const stored = store.data[slotKey(after.slot)];
    if (stored !== undefined) {
      const parsed: unknown = JSON.parse(stored);
      expect(new SaveFile(store, CATALOG).forSlot(after.slot).load(), `the stored game at step ${step}`).not.toBeNull();
      if (!after.saveFailed && refuseShare === 0) expect(parsed, `step ${step} on ${after.screen}`).toEqual(JSON.parse(JSON.stringify(game)));
    }
  }
  // However deep they wandered, there is a way back.
  expect(walkToHub(app), `no way back to the hub from ${(app.snapshot() as Snap).screen}`).toBeGreaterThanOrEqual(0);
  expect((app.snapshot() as Snap).screen).toBe('hub');
  return { screens, refused };
}

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const done = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

const SAVES: [string, () => GameState | undefined][] = [
  ['no game at all', () => undefined],
  ['a new game', () => fresh()],
  ['a pilot past the introductions, with money', () => ({ ...done('intro-1', 'intro-2'), credits: 9000, xp: xpForLevel(4) })],
  ['a pilot who has chosen a side', () => ({ ...done(...ACT_ONE, 'choice-undertow', 'undertow-3'), credits: 20000, arenaRank: 4, xp: xpForLevel(9) })],
  ['a champion at the verdict', () => ({
    ...done(...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3'),
    credits: 60000, arenaRank: 10, xp: xpForLevel(15),
  })],
  ['a pilot in debt in a later cycle', () => ({ ...fresh(), credits: -2000, cycle: 2, arenaRank: 15, xp: xpForLevel(20), endingSeen: false })],
];

describe.each(SAVES)('random buttons from %s', (_name, save) => {
  test.each([1, 2, 3])('seed %i: nothing throws, the stored game is the game played, and the hub can be reached', (seed) => {
    const { screens } = monkey(seed * 7919, 6000, save(), 0);
    expect(screens.size).toBeGreaterThanOrEqual(3);
  });

  test('with storage refusing one write in three, the game goes on and what is stored still loads', () => {
    const { refused } = monkey(4242, 6000, save(), 0.33);
    expect(refused).toBeGreaterThanOrEqual(0);
  });
});

describe('random buttons starting on each screen of the hub', () => {
  const veteran = (): GameState => ({ ...done(...ACT_ONE, 'choice-hadron'), credits: 30000, arenaRank: 10, xp: xpForLevel(12), endingSeen: true });
  const seen = new Set<string>();

  test.each(['contracts', 'arena', 'training', 'garage', 'shop', 'pilot', 'messages', 'database', 'options'])('%s', (entry) => {
    for (const seed of [21, 22]) for (const screen of monkey(seed, 3000, veteran(), 0, entry).screens) seen.add(screen);
    expect(seen.size).toBeGreaterThan(0);
  });

  test('between them these runs have been on every screen there is', () => {
    for (const screen of ['hub', 'garage', 'shop', 'messages', 'briefing', 'battle', 'settlement', 'arena', 'pilot', 'options', 'database', 'training', 'credits']) {
      expect([...seen], screen).toContain(screen);
    }
  });
});
