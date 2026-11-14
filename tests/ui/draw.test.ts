import { createBattle, type BattleOptions } from '../../src/core/battle';
import { completeMission } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { BattleFlow, BattleScreen, INTRO_MS, WARNING_MS } from '../../src/ui/battleScreen';
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
  const before = [
    'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
    'choice-undertow', 'undertow-3', 'undertow-4', 'undertow-5',
  ];
  const app = start({ ...geared(done(...before), 'tier3'), scenes: ['act-2'] }, false);
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

describe('the screens the three-act story added', () => {
  const texts = (calls: { name: string; args: unknown[] }[]) => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));

  test('a page of story draws its heading, title and picture, and waits a moment before it can be closed', () => {
    const { ctx, calls } = recorder();
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(), CATALOG), sprites, fast: false, seed: 3 });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('scene');
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['ACT I', 'THE WAGE']));
    expect(calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'still-varn')).toBe(true);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('scene');
    app.update(900);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a contract with an objective shows it in the briefing, opens with its talk, and shows the objective in battle', () => {
    const { ctx, calls } = recorder();
    const app = start({ ...geared(done('intro-1', 'intro-2', 'hadron-1'), 'tier1'), scenes: [] }, false);
    select(app, 'contracts');
    select(app, 'hadron-2');
    // The briefing writes itself out; what the contract asks for is shown once the client has finished.
    app.draw(ctx);
    expect(texts(calls)).not.toContain('1: Protect: Ore Train');
    app.update(6000);
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['1: Protect: Ore Train', '2: Protect: Ore Train']));
    select(app, 'accept');
    // The battle opens with a banner: the contract and what it asks for. Nothing else is up yet.
    calls.length = 0;
    app.update(16);
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['OVERBURDEN', 'ORE TRAIN 12/12']));
    expect(texts(calls)).not.toContain('DISPATCH');
    press(app, 'down');
    app.update(INTRO_MS + 50);
    calls.length = 0;
    app.update(16);
    app.draw(ctx);
    expect(snap(app).battle?.phase).toBe('talk');
    expect(texts(calls)).toEqual(expect.arrayContaining(['DISPATCH', 'ORE TRAIN 12/12', 'FUSE 3']));
    expect(texts(calls)).not.toContain('OVERBURDEN');
    expect(calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'portrait-dispatch')).toBe(true);
    // The line is still being written: the first press finishes it, the second goes on.
    const line = 'Count the hostiles. That is what the train loses';
    expect(texts(calls)).not.toContain(line);
    press(app, 'confirm');
    expect(snap(app).battle?.phase).toBe('talk');
    calls.length = 0;
    app.draw(ctx);
    expect(texts(calls)).toContain(line);
    press(app, 'confirm');
    expect(snap(app).battle?.phase).not.toBe('talk');
    for (let i = 0; i < 400 && snap(app).battle?.phase !== 'action'; i++) { app.update(16); app.draw(ctx); }
    expect(snap(app).battle?.phase).toBe('action');
  });

  test('the archive draws its list with the ranks', () => {
    const { ctx, calls } = recorder();
    const app = start({ ...done('intro-1', 'intro-2'), ranks: { 'intro-1': 'A' } });
    select(app, 'contracts');
    select(app, 'archive');
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['Shakedown Run', 'A', 'Hot Barrel', '-']));
  });

  /** Plays a battle on screen with the automatic player, drawing every frame, and returns everything that was drawn. */
  function watch(enemies: EnemyDef[], opts: BattleOptions = {}, frames = 2500) {
    const { ctx, calls } = recorder();
    const state = createBattle(REFERENCE_BUILDS.tier6, enemies, CATALOG, 7, opts);
    const flow = new BattleFlow(state, CATALOG);
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, speed: 6 });
    for (let i = 0; i < frames && flow.phase !== 'result'; i++) {
      screen.update(16);
      screen.draw(ctx);
      if (flow.phase === 'talk') screen.onInput('confirm');
      else if (flow.phase === 'action') {
        // Auto Turn: the automatic player takes the whole turn.
        for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'auto'; j++) screen.onInput('down');
        screen.onInput('confirm');
      }
    }
    return { flow, drawn: calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id), said: texts(calls) };
  }

  test('a machine that launches units is drawn as one sprite, what it launches appears, and its parts carry its own names', () => {
    const { flow, drawn, said } = watch([ENEMIES.leviathan]);
    expect(flow.state.events.some((e) => e.type === 'launch')).toBe(true);
    expect(drawn).toEqual(expect.arrayContaining(['boss-leviathan', 'enemy-bomb-crawler']));
    expect(said.some((text) => /^FUSE \d$/.test(text))).toBe(true);
    expect(flow.state.events.some((e) => e.type === 'fuse')).toBe(true);
  });

  test('aiming at a machine shows what it is and what it calls its parts', () => {
    const { ctx, calls } = recorder();
    const flow = new BattleFlow(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.leviathan], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    screen.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['LEVIATHAN', 'CARRIER', 'Hull', 'Wheel', 'Crane', 'Deck']));
  });

  test('a boss with phases says its line, and every new kind of event has something to draw', () => {
    const { flow, said } = watch([ENEMIES['shield-drone'], ENEMIES.sable, ENEMIES['repair-drone']], { support: { name: 'Ashfall', damage: 45 } });
    const kinds = new Set(flow.state.events.map((e) => e.type));
    expect(kinds.has('support')).toBe(true);
    expect(said).toEqual(expect.arrayContaining(['COVERED']));
    if (kinds.has('phase')) expect(said).toEqual(expect.arrayContaining(['SABLE']));
  });

  test('a battle against a boss opens with a warning and its name; a press dismisses it, and nothing moves before', () => {
    const { ctx, calls } = recorder();
    const flow = new BattleFlow(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.sable], CATALOG, 7), CATALOG);
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, title: 'HOSTILE AUDIT', boss: 'Sable' });
    const shown = flow.eventsShown;
    screen.update(WARNING_MS - 100);
    screen.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['WARNING', 'SABLE']));
    expect(texts(calls)).not.toContain('HOSTILE AUDIT');
    expect(flow.eventsShown).toBe(shown);
    screen.onInput('confirm');
    calls.length = 0;
    screen.update(16);
    screen.draw(ctx);
    expect(texts(calls)).not.toContain('WARNING');
  });

  test('a fast battle has no banner, no weather and no smoke: it is drawn as bare as before', () => {
    const { ctx, calls } = recorder();
    const flow = new BattleFlow(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true, title: 'PATROL', background: 'bg-neon-district' });
    screen.update(16);
    screen.draw(ctx);
    expect(texts(calls)).not.toContain('PATROL');
    // Rain would be dozens of one-pixel streaks.
    expect(calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && c.args[3] === 4)).toHaveLength(0);
  });

  test('rain falls over a battle in the neon district, and smoke rises from a part that is gone', () => {
    const { ctx, calls } = recorder();
    const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7);
    state.units[0].parts.arms!.ap = 0;
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, background: 'bg-neon-district' });
    screen.onInput('confirm');
    for (let i = 0; i < 40; i++) screen.update(16);
    screen.draw(ctx);
    expect(calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && c.args[3] === 4).length).toBeGreaterThan(20);
    const styles: string[] = [];
    const spy = new Proxy({}, { get: (_t, name: string) => (name === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (_t, name: string, value) => { if (name === 'fillStyle') styles.push(String(value)); return true; } }) as unknown as CanvasRenderingContext2D;
    screen.draw(spy);
    expect(styles.some((style) => style.startsWith('rgba(70, 68, 84'))).toBe(true);
  });

  test('a new screen comes up out of black, and a battle from behind a shutter', () => {
    const { ctx, calls } = recorder();
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(done('intro-1')), CATALOG), sprites, fast: false, seed: 3 });
    press(app, 'confirm');
    const veil = () => { calls.length = 0; app.draw(ctx); return calls.filter((c) => c.name === 'fillRect').at(-1)!.args; };
    // The last thing drawn is the veil over the whole screen.
    expect(veil()).toEqual([0, 0, 310, 270]);
    app.update(400);
    expect(veil()).not.toEqual([0, 0, 310, 270]);
    select(app, 'contracts');
    select(app, 'patrol');
    app.update(6000);
    select(app, 'accept');
    // Two leaves, top and bottom, drawing back.
    calls.length = 0;
    app.update(16);
    app.draw(ctx);
    const leaves = calls.filter((c) => c.name === 'fillRect').slice(-2).map((c) => c.args);
    expect(leaves[0][1]).toBe(0);
    expect(leaves[1][1]).toBe(270 - (leaves[1][3] as number));
    expect(leaves[0][3]).toBeGreaterThan(100);
  });

  test('every objective draws its line', () => {
    expect(watch([ENEMIES.jammer, ENEMIES['gun-turret']], { objective: { type: 'leader', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['TARGET: JAMMER MAST', 'TARGET']));
    expect(watch([ENEMIES['gun-turret']], { objective: { type: 'survive', rounds: 4 } }, 30).said).toEqual(expect.arrayContaining(['HOLD OUT 1/4']));
    expect(watch([ENEMIES.ripper], { objective: { type: 'disable', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['DISABLE: MANTIS RIPPER']));
    expect(watch([ENEMIES.rival], { objective: { type: 'driveOff', target: 0, share: 0.5 } }, 30).said).toEqual(expect.arrayContaining(['DRIVE OFF: ASHFALL']));
  });
});
