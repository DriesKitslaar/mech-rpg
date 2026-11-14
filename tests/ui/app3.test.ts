import { completeMission } from '../../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { RANKS } from '../../src/core/rank';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
import type { InputAction } from '../../src/platform/input';
import { App } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';
import { medalPay } from '../helpers/app';

const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}
type Snap = {
  screen: string; credits: number; completed: string[]; ranks: Record<string, string>; scenes: string[]; list?: string;
  menu: { items: { id: string; label: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: { phase: string; outcome: string; mission: string; replay: boolean; objective: string | null; spoken: string | null };
  settlement?: { net: number; won: boolean; reward: number; ammoCost: number; repairCost: number; rank: string | null; bonus: number };
  briefing?: { mission: string; replay: boolean; reward: number; objectives: string[] };
};
function inHub(saved?: GameState, seed = 5) {
  const store = memoryStore(saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {});
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed });
  app.onInput('confirm');
  // Past whatever page of story is due.
  for (let i = 0; i < 8 && ['callsign', 'scene', 'ending'].includes((app.snapshot() as Snap).screen); i++) app.onInput('confirm');
  return { app, store };
}
const snap = (app: App) => app.snapshot() as Snap;
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
const ids = (app: App) => snap(app).menu.items.map((i) => i.id);
const select = (app: App, id: string) => {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
};
const saved = (store: { data: Record<string, string> }) => JSON.parse(store.data[SAVE_KEY]) as GameState;
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const done = (...missionIds: string[]): GameState => missionIds.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
/** The heaviest frame with weapons that never run dry: these tests are about what happens after a win, not about winning. */
const JUGGERNAUT = {
  head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-singularity',
  booster: 'bst-stock', fcs: 'fcs-omni', rightHand: 'wpn-lance-emitter', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array',
};
function strong(base: GameState): GameState {
  let g = { ...base, credits: 999999 };
  for (const [slot, id] of Object.entries(JUGGERNAUT)) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof typeof g.build, id, CATALOG);
  }
  return { ...g, credits: base.credits };
}
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
function finishMission(app: App): void {
  for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) {
    finishBattle(app);
    press(app, 'confirm');
  }
  expect(snap(app).screen).toBe('settlement');
}
function accept(app: App, missionId: string): void {
  select(app, missionId);
  expect(snap(app).screen).toBe('briefing');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
}

describe('ranks', () => {
  test('a won story contract shows its rank, pays what the rank adds, and the rank is saved', () => {
    const { app, store } = inHub(strong(fresh()));
    select(app, 'contracts');
    accept(app, 'intro-1');
    finishMission(app);
    const { won, rank, bonus, net, reward, ammoCost, repairCost } = snap(app).settlement!;
    expect(won).toBe(true);
    expect(RANKS).toContain(rank);
    expect(bonus).toBe(rank === 'S' ? Math.round(reward * 0.25) : rank === 'A' ? Math.round(reward * 0.1) : 0);
    expect(net).toBe(reward + bonus - ammoCost - repairCost);
    expect(saved(store).ranks).toEqual({ 'intro-1': rank });
    expect(saved(store).credits).toBe(1200 + net + medalPay(saved(store).medals));
  });

  test('the patrol is ranked like any contract, but no rank is kept for it', () => {
    const { app, store } = inHub(strong(fresh()));
    select(app, 'contracts');
    accept(app, 'patrol');
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true });
    expect(RANKS).toContain(snap(app).settlement!.rank);
    expect(saved(store).ranks).toEqual({});
  });

  test('a lost contract has no rank and no bonus', () => {
    const { app, store } = inHub(fresh());
    select(app, 'contracts');
    accept(app, 'intro-1');
    for (let i = 0; i < 400 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    select(app, 'retreat');
    select(app, 'yes');
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: false, rank: null, bonus: 0, reward: 0 });
    expect(saved(store).ranks).toEqual({});
  });
});

describe('the archive', () => {
  test('a new pilot has none', () => {
    const { app } = inHub(fresh());
    select(app, 'contracts');
    expect(ids(app)).not.toContain('archive');
  });

  test('lists the contracts done with the best rank on each, under the contracts on offer', () => {
    const { app } = inHub({ ...done('intro-1', 'intro-2'), ranks: { 'intro-1': 'B' } });
    select(app, 'contracts');
    const items = snap(app).menu.items;
    expect(items[items.length - 1]).toMatchObject({ id: 'archive', label: 'Archive', note: '2' });
    select(app, 'archive');
    expect(snap(app).list).toBe('archive');
    expect(snap(app).menu.items.map(({ id, note }) => [id, note])).toEqual([['intro-1', 'B'], ['intro-2', '-']]);
    press(app, 'cancel');
    expect(snap(app).list).toBe('contracts');
    press(app, 'cancel');
    expect(snap(app).list).toBe('main');
  });

  test('backing out of a briefing leaves the cursor on the contract it was about, in the archive and on the list', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2', 'hadron-1')));
    const under = () => snap(app).menu.items[snap(app).menu.cursor].id;
    select(app, 'contracts');
    select(app, 'archive');
    select(app, 'hadron-1');
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'hub', list: 'archive' });
    expect(under()).toBe('hadron-1');
    // One step back is the contract list, and from there a briefing returns to its own entry too.
    press(app, 'cancel');
    select(app, 'lumen-1');
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'hub', list: 'contracts' });
    expect(under()).toBe('lumen-1');
  });

  test('a contract played again pays a share, changes nothing in the story, and returns to the archive', () => {
    const base = strong(done('intro-1', 'intro-2'));
    const { app, store } = inHub(base);
    select(app, 'contracts');
    select(app, 'archive');
    select(app, 'intro-1');
    expect(snap(app).briefing).toMatchObject({ mission: 'intro-1', replay: true, reward: 180 });
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'hub', list: 'archive' });
    accept(app, 'intro-1');
    expect(snap(app).battle).toMatchObject({ mission: 'intro-1', replay: true });
    finishMission(app);
    const s = snap(app).settlement!;
    expect(s).toMatchObject({ won: true, reward: 180 });
    expect(saved(store).completed).toEqual(['intro-1', 'intro-2']);
    expect(saved(store).credits).toBe(base.credits + s.net + medalPay(saved(store).medals));
    expect(saved(store).ranks).toEqual({ 'intro-1': s.rank });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a replay can better the rank on record and never worsens it', () => {
    const play = (ranks: GameState['ranks']) => {
      const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), ranks });
      select(app, 'contracts');
      select(app, 'archive');
      accept(app, 'intro-1');
      finishMission(app);
      return { earned: snap(app).settlement!.rank!, kept: saved(store).ranks['intro-1'] };
    };
    const worse = play({ 'intro-1': 'D' });
    expect(worse.kept).toBe(worse.earned);
    expect(play({ 'intro-1': 'S' }).kept).toBe('S');
  });

  test('a contract that is not in the archive cannot be started as a replay', () => {
    const { app } = inHub(done('intro-1'));
    app.startMission('intro-2', true);
    expect(snap(app).screen).toBe('hub');
    app.openBriefing('hadron-1', true);
    expect(snap(app).screen).toBe('hub');
  });
});

describe('talk and objectives in a contract', () => {
  test('tests play without talk: a battle never waits for a line to be read', () => {
    const { app } = inHub(fresh());
    select(app, 'contracts');
    accept(app, 'intro-1');
    for (let i = 0; i < 400 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    expect(snap(app).battle).toMatchObject({ phase: 'action', spoken: null, objective: null });
  });
});
