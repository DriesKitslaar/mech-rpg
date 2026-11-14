import { createBattle, type BattleOptions } from '../../src/core/battle';
import { completeMission } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { BattleFlow, BattleScreen } from '../../src/ui/battleScreen';
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
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['1: Protect: Ore Train', '2: Protect: Ore Train']));
    select(app, 'accept');
    calls.length = 0;
    app.update(16);
    app.draw(ctx);
    expect(snap(app).battle?.phase).toBe('talk');
    expect(texts(calls)).toEqual(expect.arrayContaining(['DISPATCH', 'ORE TRAIN 12/12', 'FUSE 3']));
    expect(calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'portrait-dispatch')).toBe(true);
    press(app, 'confirm');
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

  test('tags never run into the name beside them: with no room for all, the least pressing are left out', () => {
    // The Adjuster with a barrier up and its decree loaded has three tags and a long name.
    const state = structuredClone(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.adjuster], CATALOG, 7));
    const boss = state.units[1];
    boss.barrier = 170;
    boss.charged = ['shoulder'];
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    const { ctx, calls } = recorder();
    screen.draw(ctx);
    const drawn = calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), x: Number(c.args[1]), y: Number(c.args[2]) }));
    const name = drawn.find((d) => d.text === 'THE ADJUSTER')!;
    const row = drawn.filter((d) => ['CARRIER', 'CHARGING', 'BARRIER 170'].includes(d.text) && Math.abs(d.y - name.y) <= 1);
    // What is about to hurt stays; what the machine is, the briefing has already said.
    expect(row.map((d) => d.text)).toEqual(['CHARGING', 'BARRIER 170']);
    expect(Math.min(...row.map((d) => d.x))).toBeGreaterThanOrEqual(name.x + 'THE ADJUSTER'.length * 4.8);
  });

  test('the pilot\'s own tags stop short of the repairs count', () => {
    const state = structuredClone(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.overseer], CATALOG, 7));
    const me = state.units[0];
    me.barrier = 170;
    me.guarding = true;
    me.boosted = true;
    me.chaff = 20;
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    const { ctx, calls } = recorder();
    screen.draw(ctx);
    const drawn = calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), x: Number(c.args[1]), y: Number(c.args[2]) }));
    const repairs = drawn.find((d) => d.text.startsWith('REPAIRS'))!;
    const tags = drawn.filter((d) => Math.abs(d.y - repairs.y) <= 1 && d !== repairs);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    // The count is written from the right edge; every tag ends before it begins.
    const repairsLeft = repairs.x - repairs.text.length * 4.8;
    for (const tag of tags) expect(tag.x + tag.text.length * 4, tag.text).toBeLessThanOrEqual(repairsLeft);
    expect(tags.map((d) => d.text)).not.toContain('CHAFF');
  });

  test('a settlement with a rank bonus and four repair lines keeps them clear of what the client says', () => {
    const app = start({ ...done('intro-1', 'intro-2'), scenes: ['act-1'] });
    const mission = MISSIONS.find((m) => m.id === 'hadron-1')!;
    const lines = ['head-scout-mk1', 'core-hauler', 'arms-rigger', 'legs-strider'].map((partId) => ({ partId, lost: 9, cost: 7 }));
    app.showSettlement({ won: true, reward: 1600, ammoCost: 120, repairCost: 28, net: 1612, lines, rank: 'A', score: 80, bonus: 160 }, mission);
    const { ctx, calls } = recorder();
    app.draw(ctx);
    const drawn = calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), y: Number(c.args[2]) }));
    const lowest = Math.max(...drawn.filter((d) => /^ {2}\S/.test(d.text)).map((d) => d.y));
    expect(drawn.filter((d) => /^ {2}\S/.test(d.text))).toHaveLength(4);
    expect(drawn.some((d) => d.text === 'Rank A bonus')).toBe(true);
    const debrief = Math.min(...drawn.filter((d) => d.y >= 140 && d.y < 180).map((d) => d.y));
    // A line of text is eleven pixels high.
    expect(lowest + 11).toBeLessThanOrEqual(debrief);
  });

  test('a boss with phases says its line, and every new kind of event has something to draw', () => {
    const { flow, said } = watch([ENEMIES['shield-drone'], ENEMIES.sable, ENEMIES['repair-drone']], { support: { name: 'Ashfall', damage: 45 } });
    const kinds = new Set(flow.state.events.map((e) => e.type));
    expect(kinds.has('support')).toBe(true);
    expect(said).toEqual(expect.arrayContaining(['COVERED']));
    if (kinds.has('phase')) expect(said).toEqual(expect.arrayContaining(['SABLE']));
  });

  test('every objective draws its line', () => {
    expect(watch([ENEMIES.jammer, ENEMIES['gun-turret']], { objective: { type: 'leader', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['TARGET: JAMMER MAST', 'TARGET']));
    expect(watch([ENEMIES['gun-turret']], { objective: { type: 'survive', rounds: 4 } }, 30).said).toEqual(expect.arrayContaining(['HOLD OUT 1/4']));
    expect(watch([ENEMIES.ripper], { objective: { type: 'disable', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['DISABLE: MANTIS RIPPER']));
    expect(watch([ENEMIES.rival], { objective: { type: 'driveOff', target: 0, share: 0.5 } }, 30).said).toEqual(expect.arrayContaining(['DRIVE OFF: ASHFALL']));
  });
});
