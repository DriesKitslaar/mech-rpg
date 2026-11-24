import { completeMission } from '../../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { MEDAL_PAY } from '../../src/core/medals';
import { MEDALS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
import type { InputAction } from '../../src/platform/input';
import { App, SHUTTER_MS, type AppDeps } from '../../src/ui/app';
import { BRIEFING_HOLD_MS } from '../../src/ui/briefingScreen';
import type { SpriteStore } from '../../src/ui/sprites';

/** What the app tests share: an app over a store in memory, and ways to press through it. */
export const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };

export type Store = KeyValueStore & { data: Record<string, string> };
export function memoryStore(initial: Record<string, string> = {}): Store {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

export interface Item { id: string; label: string; enabled: boolean; note?: string }
/** The snapshot as tests read it: every screen adds its own part, so most of it is optional. */
export interface Snap {
  screen: string; credits: number; completed: string[]; callsign: string | null; slot: number; message?: string;
  menu: { items: Item[]; cursor: number };
  battle?: { phase: string; outcome: string; mission: string; index: number; of: number; enemies: string[]; enemyScale: number; enemyArmour: number };
  player?: { maxAp: number; repairsLeft: number };
  arena?: { rank: number; of: number };
  settlement?: { net: number; won: boolean; reward: number; rank: string | null; bonus: number; tip: string | null };
  briefing?: { mission: string; replay: boolean; reward: number; objectives: string[]; lent: boolean };
  medals: string[]; toast: string | null; toasts: string[];
  page?: string;
  record?: { label: string; value: string }[];
  detail?: { title: string; lines: string[] };
  [key: string]: unknown;
}

export function makeApp(saved?: GameState, seed = 5, deps: Partial<AppDeps> = {}) {
  const store = memoryStore(saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {});
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed, ...deps });
  return { app, store };
}
export const snap = (app: App) => app.snapshot() as Snap;
export const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
export const ids = (app: App) => snap(app).menu.items.map((i) => i.id);
/**
 * Walks the cursor down to an entry and confirms it. A briefing that has just opened, in a game that is not
 * hurried, does not take A for a moment: that moment is let pass first, as a player's own hand lets it.
 */
export const select = (app: App, id: string) => {
  if (snap(app).screen === 'briefing' && snap(app).busy === true) app.update(BRIEFING_HOLD_MS);
  for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
};
/** Accepts the callsign on offer and reads past the pages of story that come up between contracts. */
export function skipScenes(app: App): void {
  // A conversation takes a press for each thing said, and the first answer on offer is the one given.
  // The frame to start in is the one under the cursor: the Hauler every pilot used to start in.
  for (let i = 0; i < 120 && ['callsign', 'starter', 'scene', 'ending', 'credits'].includes(snap(app).screen); i++) press(app, 'confirm');
}
/** Sits through whatever conversations and pages about the pilot's decisions are due, giving the first answer on offer. */
export function skipTalks(app: App): void {
  const talking = () => snap(app).screen === 'scene' && /^(talk|left)-/.test(String(snap(app).scene));
  for (let i = 0; i < 200 && talking(); i++) press(app, 'confirm');
}
/** Past the title and whatever page of story is due, into the hub. */
export function inHub(saved?: GameState, seed?: number, deps: Partial<AppDeps> = {}) {
  const made = makeApp(saved, seed, deps);
  press(made.app, 'confirm');
  skipScenes(made.app);
  expect(snap(made.app).screen).toBe('hub');
  return made;
}
export const savedGame = (store: Store, key = SAVE_KEY) => JSON.parse(store.data[key]) as GameState;

/**
 * Cuts short the launch a contract opens with in a game that is not hurried, where there is one: the
 * doors it opens behind are let open first (nothing is pressed while they hide it), and a press then
 * ends it. The battle is at its own first moment after that, with its banner still to run.
 */
export function pastLaunch(app: App): void {
  const launching = (): boolean => !!(app.snapshot() as { launch?: unknown }).launch;
  if (!launching()) return;
  app.update(SHUTTER_MS);
  app.onInput('confirm');
  if (launching()) throw new Error('the launch was not cut');
}
/** What the given medals have paid between them. */
export const medalPay = (medalIds: string[]): number => medalIds.reduce((sum, id) => sum + MEDAL_PAY[MEDALS.find((m) => m.id === id)!.tier], 0);
export const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
export const done = (...missionIds: string[]): GameState => missionIds.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());

/** The heaviest frame with weapons that never run dry: for tests about what happens after a win, not about winning. */
export const JUGGERNAUT = {
  head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-singularity',
  booster: 'bst-stock', fcs: 'fcs-omni', rightHand: 'wpn-lance-emitter', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array',
};
/** The same pilot, owning and wearing the juggernaut, with the money they had. */
export function strong(base: GameState): GameState {
  let g = { ...base, credits: 999999 };
  for (const [slot, id] of Object.entries(JUGGERNAUT)) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof typeof g.build, id, CATALOG);
  }
  return { ...g, credits: base.credits };
}

/** From the hub into a contract's first battle: past the launch it opens with, in a game that is not hurried. */
export function accept(app: App, missionId: string): void {
  select(app, 'contracts');
  select(app, missionId);
  expect(snap(app).screen).toBe('briefing');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
  pastLaunch(app);
}
/** Plays the current battle to its result: fires the first weapon while it can, ends the turn when it cannot. */
export function finishBattle(app: App): void {
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
export function finishMission(app: App): void {
  for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) {
    finishBattle(app);
    press(app, 'confirm');
  }
  expect(snap(app).screen).toBe('settlement');
}
/** From a settlement back to the hub, past whatever page of story the contract opened. */
export function toHub(app: App): void {
  press(app, 'confirm');
  skipScenes(app);
  expect(snap(app).screen).toBe('hub');
}
/** Walks away from the battle on screen. */
export function retreat(app: App): void {
  for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
    if (snap(app).battle!.phase === 'animating') app.update(16);
    else press(app, 'confirm');
  }
  select(app, 'retreat');
  select(app, 'yes');
  for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'result'; i++) app.update(16);
  press(app, 'confirm');
  expect(snap(app).screen).toBe('settlement');
}
/** Plays the battle on screen to its result with Auto Turn, reading past whatever is said. */
export function autoBattle(app: App): void {
  for (let i = 0; i < 60000 && snap(app).battle?.phase !== 'result'; i++) {
    const phase = snap(app).battle!.phase;
    if (phase === 'animating') app.update(16);
    else if (phase === 'action') select(app, 'auto');
    else press(app, 'confirm');
  }
  expect(snap(app).battle?.phase).toBe('result');
}
