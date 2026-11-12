import { completeMission } from '../../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
import type { InputAction } from '../../src/platform/input';
import { App } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';

/** A canvas context that accepts anything and remembers what was called. */
function recorder() {
  const calls: { name: string; args: unknown[] }[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 }) : (...args: unknown[]) => { calls.push({ name, args }); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function store(saved?: GameState): KeyValueStore {
  const data: Record<string, string> = saved ? { [SAVE_KEY]: JSON.stringify(saved) } : {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}
const snap = (app: App) => app.snapshot() as { screen: string; menu: { items: { id: string }[]; cursor: number }; battle?: { phase: string } };
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
function select(app: App, id: string): void {
  for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
  press(app, 'confirm');
}
const done = (...ids: string[]) => ids.reduce((g, id) => completeMission(g, id, MISSIONS), newGame(CATALOG, STARTER_BUILD));
function geared(base: GameState, name: string): GameState {
  let g = { ...base, credits: 99999 };
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS[name])) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof typeof g.build, id, CATALOG);
  }
  return g;
}
const start = (saved?: GameState, fast = true) => {
  const app = new App({ catalog: CATALOG, save: new SaveFile(store(saved), CATALOG), sprites, fast, seed: 3 });
  press(app, 'confirm');
  return app;
};

test('every screen draws without throwing', () => {
  const { ctx } = recorder();
  const app = start(geared(done('intro-1', 'intro-2'), 'tier1'));
  const visit = () => { app.update(16); app.draw(ctx); };
  visit();
  for (const screen of ['garage', 'shop', 'messages'] as const) { select(app, screen); visit(); press(app, 'confirm'); visit(); press(app, 'cancel', 'cancel'); visit(); }
  select(app, 'contracts'); visit();
  select(app, 'hadron-1'); visit();
  select(app, 'accept'); visit();
  for (let i = 0; i < 400 && snap(app).battle?.phase !== 'action'; i++) visit();
  press(app, 'confirm'); visit();
  press(app, 'confirm'); visit();
  press(app, 'confirm'); visit();
  expect(snap(app).screen).toBe('battle');
});

test('an enemy mech that fights alone is drawn mirrored from its parts, with its weapons', () => {
  const { ctx, calls } = recorder();
  // The first battle of the Undertow finale is one Bulwark Enforcer.
  const app = start(geared(done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-undertow'), 'tier3'), false);
  select(app, 'contracts');
  select(app, 'finale-undertow');
  select(app, 'accept');
  app.update(16);
  app.draw(ctx);
  expect(calls.some((c) => c.name === 'scale' && c.args[0] === -1 && c.args[1] === 1)).toBe(true);
  const drawn = calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id);
  for (const id of ['legs-bulwark', 'core-bulwark', 'head-bulwark', 'arms-bulwark.near', 'arms-bulwark.far', 'wpn-enemy-shotgun']) {
    expect(drawn, id).toContain(id);
  }
  expect(drawn).not.toContain('enemy-heavy-mech');
});

test('the same kind of enemy among others is drawn as its single sprite', () => {
  const { ctx, calls } = recorder();
  // The second battle of that finale is a Halo Guard with a drone; reach it by drawing the first one only.
  const app = start(geared(done('intro-1', 'intro-2', 'hadron-1', 'lumen-1'), 'tier2'), false);
  select(app, 'contracts');
  select(app, 'undertow-1');
  select(app, 'accept');
  app.update(16);
  app.draw(ctx);
  const drawn = calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id);
  expect(drawn.filter((id) => id === 'enemy-recon-drone')).toHaveLength(3);
  expect(calls.some((c) => c.name === 'scale' && c.args[0] === -1)).toBe(false);
});
