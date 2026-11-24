import { createBattle, type BattleOptions } from '../../src/core/battle';
import { completeMission } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { BattleFlow, BattleScreen, INTRO_MS, TALK_CHARS, TALK_HOLD_MS, TALK_LINES, WARNING_MS } from '../../src/ui/battleScreen';
import { pictureTop, placeFor } from '../../src/ui/stage';
import { SCENE_HOLD_MS } from '../../src/ui/sceneScreen';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { MANUAL, WORLD } from '../../src/content/codex';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { TALKS } from '../../src/content/talks';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../../src/platform/storage';
import type { InputAction } from '../../src/platform/input';
import { App, SHUTTER_MS } from '../../src/ui/app';
import { BRIEFING_HOLD_MS } from '../../src/ui/briefingScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { pastLaunch } from '../helpers/app';
import { record, signCount, signIn } from '../helpers/canvas';

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
const snap = (app: App) => app.snapshot() as {
  screen: string; busy: boolean; typing?: boolean; menu: { items: { id: string }[]; cursor: number };
  battle?: { phase: string; banner: boolean; typing: boolean };
};
const press = (app: App, ...actions: InputAction[]) => actions.forEach((a) => app.onInput(a));
function select(app: App, id: string): void {
  // A briefing that has just opened does not take A for a moment, at a walking pace: that is let pass, as a hand lets it.
  if (snap(app).screen === 'briefing' && (snap(app) as { busy?: boolean }).busy) app.update(BRIEFING_HOLD_MS);
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
  // The conversations are for their own tests: here they have been had.
  const game = saved && { ...saved, scenes: [...saved.scenes, ...TALKS.map((t) => t.id)] };
  const app = new App({ catalog: CATALOG, save: new SaveFile(store(game), CATALOG), sprites, fast, seed: 3 });
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
  pastLaunch(app);
  app.update(16);
  app.draw(ctx);
  expect(calls.some((c) => c.name === 'scale' && c.args[0] === -1 && c.args[1] === 1)).toBe(true);
  const drawn = calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id);
  // It stands far off: every part of it is its small drawing.
  for (const id of ['legs-bulwark', 'core-bulwark', 'head-bulwark', 'arms-bulwark.near', 'arms-bulwark.far', 'wpn-enemy-shotgun']) {
    expect(drawn, id).toContain(`${id}.small`);
    expect(drawn, id).not.toContain(id);
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
  pastLaunch(app);
  app.update(16);
  app.draw(ctx);
  const drawn = calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id);
  expect(drawn.filter((id) => id === 'enemy-recon-drone')).toHaveLength(3);
  expect(calls.some((c) => c.name === 'scale' && c.args[0] === -1)).toBe(false);
});

test('with more than one enemy to aim at, the target list says which one this is and which buttons go to the next', () => {
  const app = start({ ...done(), scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) });
  select(app, 'contracts');
  select(app, 'intro-1');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
  // The drones are quicker and go first.
  for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) app.update(16);
  // The list of actions says what each costs: energy, or for a field repair the rest of the turn; and of a
  // row that cannot be chosen, why not.
  const actions = recorder();
  app.draw(actions.ctx);
  const repair = (snap(app).menu.items as { id: string; enabled: boolean }[]).find((item) => item.id === 'repair')!;
  expect(actions.calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0])))
    .toContain(repair.enabled ? 'Field Repair  ends turn' : 'Field Repair  not needed');
  select(app, 'fire');
  press(app, 'confirm');
  expect(snap(app).battle?.phase).toBe('target');
  const { ctx, calls } = recorder();
  app.update(16);
  app.draw(ctx);
  const said = calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
  expect(said).toContain('TARGET 1/2  L1/R1');
  // On to the other one, and the count follows.
  press(app, 'next');
  const next = recorder();
  app.draw(next.ctx);
  expect(next.calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]))).toContain('TARGET 2/2  L1/R1');
});

describe('the screens the three-act story added', () => {
  const texts = (calls: { name: string; args: unknown[] }[]) => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));

  test('a page of story draws its heading, title and picture, and waits a moment before it can be closed', () => {
    const { ctx, calls } = recorder();
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(), CATALOG), sprites, fast: false, seed: 3 });
    // New game, then the callsign on offer, then the frame on offer.
    press(app, 'confirm', 'confirm', 'confirm');
    expect(snap(app).screen).toBe('scene');
    app.draw(ctx);
    expect(texts(calls)).toContain('ACT I');
    // The title is in the sign's letters, in the game's colour.
    expect(signIn(record((c) => app.draw(c)), 'THE WAGE', 'neon')).not.toBeNull();
    expect(calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'still-varn')).toBe(true);
    // A press as the page comes up is held off; a later one writes the page out; one straight after
    // that is held off again; only then does a press leave.
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'scene', typing: true, busy: true });
    app.update(SCENE_HOLD_MS);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'scene', typing: false, busy: true });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('scene');
    app.update(SCENE_HOLD_MS);
    expect(snap(app)).toMatchObject({ busy: false });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a button mashed through a page of story still leaves it up long enough to be noticed', () => {
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(), CATALOG), sprites, fast: false, seed: 3 });
    // A new game: the callsign and the frame on offer are taken, and the first page of the story comes up.
    press(app, 'confirm', 'confirm', 'confirm');
    expect(snap(app).screen).toBe('scene');
    let up = 0;
    for (let i = 0; i < 200 && snap(app).screen === 'scene'; i++) {
      press(app, 'confirm');
      app.update(120);
      up += 120;
    }
    expect(snap(app).screen).toBe('hub');
    expect(up).toBeGreaterThanOrEqual(1000);
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
    // (The launch it opens with is for its own tests.)
    pastLaunch(app);
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
    const line = 'Count the hostiles. That is what the train';
    expect(texts(calls)).not.toContain(line);
    app.update(TALK_HOLD_MS);
    press(app, 'confirm');
    expect(snap(app).battle?.phase).toBe('talk');
    calls.length = 0;
    app.draw(ctx);
    expect(texts(calls)).toContain(line);
    app.update(TALK_HOLD_MS);
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
    // A line of text is eleven pixels high: one is left empty between the last part and what the client says, which
    // is two lines here and begins a line lower for it.
    expect(lowest + 2 * 11).toBeLessThanOrEqual(debrief);
    expect(drawn.filter((d) => d.y >= debrief && d.y < 180)).toHaveLength(2);
  });

  /** A battle with one line of talk at its start, past its banner, with the line on screen. */
  function talking() {
    const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret'], ENEMIES['recon-drone']], CATALOG, 7);
    const flow = new BattleFlow(state, CATALOG, { talk: [{ at: 'start', who: 'Dispatch', text: 'Two hostiles. The one on the ground cannot dodge, so start with that one.' }] });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false });
    screen.update(INTRO_MS + 16);
    screen.update(16);
    const drawn = () => {
      const { ctx, calls } = recorder();
      screen.draw(ctx);
      return calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), y: Number(c.args[2]) }));
    };
    return { flow, screen, drawn };
  }

  test('talk is written in the panel under the field: nothing on the field is covered, and the menu is put away meanwhile', () => {
    const { flow, drawn } = talking();
    expect(flow.phase).toBe('talk');
    const all = drawn();
    const who = all.find((d) => d.text === 'DISPATCH')!;
    // The field ends where the panel begins, 178 pixels down.
    expect(who.y).toBeGreaterThanOrEqual(178);
    expect(all.filter((d) => d.y >= 178).every((d) => d.y < 270)).toBe(true);
    // Nothing of the menu or of the pilot's own panel shows through.
    expect(all.some((d) => d.text.startsWith('REPAIRS'))).toBe(false);
    expect(all.some((d) => d.text === 'Fire')).toBe(false);
  });

  test('a press that comes too soon after a line appears, or after the press that finished writing it, does nothing', () => {
    const { flow, screen, drawn } = talking();
    const whole = 'Two hostiles. The one on the ground cannot';
    // Mashed at once: the line goes on writing itself.
    screen.onInput('confirm');
    expect(drawn().some((d) => d.text === whole)).toBe(false);
    screen.update(TALK_HOLD_MS);
    screen.onInput('confirm');
    expect(drawn().some((d) => d.text === whole)).toBe(true);
    // Mashed again at once: the line stays up to be read.
    screen.onInput('confirm');
    screen.update(TALK_HOLD_MS - 20);
    screen.onInput('confirm');
    expect(flow.phase).toBe('talk');
    screen.update(40);
    screen.onInput('confirm');
    expect(flow.phase).not.toBe('talk');
  });

  test('a line that comes up by itself is never shown whole before it is written, and cannot be skipped the moment it appears', () => {
    // A line for the second round: nobody presses anything to bring it up.
    const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7);
    const text = 'Second round. They have your range now, so do not stand where you stood.';
    const flow = new BattleFlow(state, CATALOG, { talk: [{ at: 2, who: 'Dispatch', text }] });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false });
    const whole = 'Second round. They have your range now, so do';
    const drawnWhole = () => {
      const { ctx, calls } = recorder();
      screen.draw(ctx);
      return calls.some((c) => c.name === 'fillText' && String(c.args[0]).startsWith(whole));
    };
    let flashed = false;
    let skipped = false;
    for (let i = 0; i < 4000 && flow.state.round < 3 && flow.phase !== 'result'; i++) {
      screen.update(16);
      if (flow.phase === 'talk') {
        // Drawn on the very frame it comes up, and pressed on the same frame, as a waiting thumb would.
        if (drawnWhole()) flashed = true;
        screen.onInput('confirm');
        if (flow.phase !== 'talk') skipped = true;
        break;
      }
      if (flow.phase === 'action') {
        for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'endTurn'; j++) screen.onInput('down');
        screen.onInput('confirm');
      }
    }
    expect(flow.phase).toBe('talk');
    expect(flashed).toBe(false);
    expect(skipped).toBe(false);
  });

  test('the banner says what the battle asks for, in the words of the briefing, in capitals like the rest of it', () => {
    const banner = (objective?: BattleOptions['objective']): string[] => {
      const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['recon-drone']], CATALOG, 7, objective ? { objective } : {});
      const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, title: 'OVERBURDEN' });
      screen.update(300);
      const { ctx, calls } = recorder();
      screen.draw(ctx);
      return texts(calls);
    };
    const protect = banner({ type: 'protect', name: 'Ore Train', hp: 12 });
    expect(protect).toEqual(expect.arrayContaining(['OVERBURDEN', 'PROTECT: ORE TRAIN', 'ORE TRAIN 12/12']));
    // The briefing's own words, which are not in capitals there, are not on the banner as they stand.
    expect(STRINGS.objectives.brief.protect('Ore Train')).toBe('Protect: Ore Train');
    expect(protect).not.toContain('Protect: Ore Train');
    expect(banner({ type: 'survive', rounds: 6 })).toContain('HOLD OUT FOR 6 ROUNDS');
    // A battle that asks for nothing but the field cleared has always said so in capitals.
    expect(banner()).toContain(STRINGS.battleIntro.destroy);
    expect(STRINGS.battleIntro.destroy).toBe(STRINGS.battleIntro.destroy.toUpperCase());
  });

  test('a speaker\'s face is drawn at its own size, and a line may run to four rows beside it', () => {
    const { flow, screen } = talking();
    expect(flow.phase).toBe('talk');
    expect([TALK_CHARS, TALK_LINES]).toEqual([46, 4]);
    const { ctx, calls } = recorder();
    screen.draw(ctx);
    // No face of his own: Dispatch has the plain terminal mark, 56 pixels square.
    const mark = calls.filter((c) => c.name === 'fillRect').find((c) => c.args[2] === 56 && c.args[3] === 56);
    expect(mark).toBeDefined();
  });

  test('rain falls at its own pace whatever the battle speed', () => {
    const rain = (speed: number) => {
      const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7);
      const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, speed, background: 'bg-neon-district' });
      for (let i = 0; i < 120; i++) screen.update(16);
      const { ctx, calls } = recorder();
      screen.draw(ctx);
      // Raindrops are the thin dashes drawn inside the field's own frame of reference.
      return calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && Number(c.args[3]) >= 3 && Number(c.args[3]) <= 6).map((c) => c.args.join(','));
    };
    expect(rain(1).length).toBeGreaterThan(10);
    expect(rain(2.5)).toEqual(rain(1));
  });

  test('a battle that is over is marked by one fanfare: the jingle where there is music, the effect where there is not', () => {
    const outcome = (jingle?: (won: boolean) => boolean) => {
      const played: string[] = [];
      const sfx = { muted: false, play: (name: string) => { played.push(name); } } as unknown as import('../../src/platform/audio').Sfx;
      const state = structuredClone(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['recon-drone']], CATALOG, 7));
      state.units[1].parts.core!.ap = 1;
      const flow = new BattleFlow(state, CATALOG, { quiet: true });
      const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, sfx, ...(jingle ? { jingle } : {}) });
      for (let i = 0; i < 6000 && flow.phase !== 'result'; i++) {
        screen.update(16);
        if (flow.phase === 'action') {
          for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'auto'; j++) screen.onInput('down');
          screen.onInput('confirm');
        }
      }
      expect(flow.state.outcome).toBe('victory');
      for (let i = 0; i < 60; i++) screen.update(16);
      return played;
    };
    const asked: boolean[] = [];
    expect(outcome((won) => { asked.push(won); return true; })).not.toContain('victory');
    expect(asked).toEqual([true]);
    expect(outcome()).toContain('victory');
    expect(outcome(() => false)).toContain('victory');
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
    // The word is in the sign's letters, red or amber as it blinks, and the boss's name in steel under it.
    const warned = record((c) => screen.draw(c));
    expect(signIn(warned, 'WARNING', 'red') ?? signIn(warned, 'WARNING', 'amber')).not.toBeNull();
    expect(signIn(warned, 'SABLE', 'steel')).not.toBeNull();
    expect(signCount(warned)).toBe(2);
    expect(texts(calls)).not.toContain('HOSTILE AUDIT');
    expect(flow.eventsShown).toBe(shown);
    screen.onInput('confirm');
    calls.length = 0;
    screen.update(16);
    screen.draw(ctx);
    expect(signCount(record((c) => screen.draw(c)))).toBe(0);
  });

  test('a fast battle has no banner, no weather and no smoke: it is drawn as bare as before', () => {
    const { ctx, calls } = recorder();
    const flow = new BattleFlow(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true, title: 'PATROL', background: 'bg-neon-district' });
    screen.update(16);
    screen.draw(ctx);
    expect(texts(calls)).not.toContain('PATROL');
    // Rain would be dozens of one-pixel streaks, the near ones five pixels long.
    expect(calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && c.args[3] === 5)).toHaveLength(0);
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
    // Rain at two depths: short streaks far off, long ones close by.
    expect(calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && c.args[3] === 5).length).toBeGreaterThan(15);
    expect(calls.filter((c) => c.name === 'fillRect' && c.args[2] === 1 && c.args[3] === 2).length).toBeGreaterThan(15);
    const styles: string[] = [];
    const spy = new Proxy({}, { get: (_t, name: string) => (name === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (_t, name: string, value) => { if (name === 'fillStyle') styles.push(String(value)); return true; } }) as unknown as CanvasRenderingContext2D;
    screen.draw(spy);
    expect(styles.some((style) => style.startsWith('rgba(70, 68, 84'))).toBe(true);
  });

  test('a new screen comes out from behind a blind, and a battle from between two doors', () => {
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(done('intro-1')), CATALOG), sprites, fast: false, seed: 3 });
    press(app, 'confirm');
    /** The dark of a blind or of the doors, as it is drawn over the screen. */
    const dark = () => record((ctx) => app.draw(ctx)).rects.filter((r) => r.color === '#04040c');
    const covered = (): number => dark().reduce((sum, r) => sum + r.w * r.h, 0);
    // The blind is over the whole of the new screen, then over some of it, and then it is gone.
    expect(covered()).toBe(310 * 270);
    app.update(100);
    const half = covered();
    expect(half).toBeGreaterThan(310 * 270 * 0.3);
    expect(half).toBeLessThan(310 * 270 * 0.7);
    app.update(400);
    expect(covered()).toBe(0);
    select(app, 'contracts');
    select(app, 'patrol');
    app.update(6000);
    select(app, 'accept');
    // Two doors, top and bottom, drawing back.
    app.update(16);
    const doors = dark();
    expect(doors).toHaveLength(2);
    expect(doors[0]).toMatchObject({ x: 0, y: 0, w: 310 });
    expect(doors[1]).toMatchObject({ x: 0, y: 270 - doors[1].h, w: 310 });
    expect(doors[0].h).toBeGreaterThan(100);
    // What is dark is the last thing laid over the screen: nothing of the battle is drawn over the doors but their own edges.
    const page = record((ctx) => app.draw(ctx));
    const after = page.rects.slice(page.rects.indexOf(page.rects.filter((r) => r.color === '#04040c').at(-1)!) + 1);
    expect(after.length).toBeLessThanOrEqual(4);
    for (const line of after) expect(line.h).toBe(1);
  });

  test('nothing is pressed on a contract the shutter still hides: the launch is there when it has opened, and the banner after it', () => {
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(done('intro-1')), CATALOG), sprites, fast: false, seed: 3 });
    press(app, 'confirm');
    select(app, 'contracts');
    select(app, 'patrol');
    select(app, 'accept');
    app.update(48);
    expect(snap(app)).toMatchObject({ screen: 'battle', busy: true, launch: { stage: 'ready' }, battle: { banner: true, phase: 'launch' } });
    // Behind the shutter a press cuts nothing short.
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ launch: { stage: 'ready' }, battle: { banner: true } });
    // Once it has opened, one press cuts the launch and the next dismisses the banner, as a press always did.
    app.update(SHUTTER_MS);
    expect(snap(app).busy).toBe(false);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ launch: null, battle: { banner: true } });
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ banner: false });
  });

  test('a fight that has no launch is behind the shutter as it ever was: the banner is there when it has opened', () => {
    const base = done('intro-1', 'intro-2', 'hadron-1', 'hadron-2');
    const app = new App({ catalog: CATALOG, save: new SaveFile(store({ ...base, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id) }), CATALOG), sprites, fast: false, seed: 3 });
    press(app, 'confirm');
    select(app, 'arena');
    app.update(400);
    press(app, 'confirm');
    app.update(400);
    select(app, 'accept');
    app.update(48);
    expect(snap(app)).toMatchObject({ screen: 'battle', busy: true, launch: null, battle: { banner: true } });
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ banner: true });
    app.update(SHUTTER_MS);
    expect(snap(app).busy).toBe(false);
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ banner: false });
  });

  test('the field and the title are drawn pixel for pixel while nothing shakes', () => {
    // Stretched by a few pixels, a pixel picture loses its grid: rows and columns double up unevenly.
    const title = new App({ catalog: CATALOG, save: new SaveFile(store(), CATALOG), sprites, fast: false, seed: 3 });
    const shown = (app: App, id: string) => {
      const { ctx, calls } = recorder();
      app.update(700);
      app.draw(ctx);
      return calls.filter((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === id).map((c) => c.args.slice(3));
    };
    for (const size of shown(title, 'still-varn')) expect(size).toEqual([310, 270]);
    const state = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['gun-turret']], CATALOG, 7);
    const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, background: 'bg-mine' });
    screen.update(INTRO_MS + 16);
    const { ctx, calls } = recorder();
    screen.draw(ctx);
    const field = calls.filter((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'bg-mine');
    // Once, at its own size, as far up as shows the band of it the field looks at.
    expect(field.map((c) => c.args.slice(1))).toEqual([[0, pictureTop(placeFor('bg-mine')), 310, 270]]);
    expect(pictureTop(placeFor('bg-mine'))).toBe(-89);
  });

  test('every objective draws its line', () => {
    expect(watch([ENEMIES.jammer, ENEMIES['gun-turret']], { objective: { type: 'leader', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['TARGET: JAMMER MAST', 'TARGET']));
    expect(watch([ENEMIES['gun-turret']], { objective: { type: 'survive', rounds: 4 } }, 30).said).toEqual(expect.arrayContaining(['HOLD OUT 1/4']));
    expect(watch([ENEMIES.ripper], { objective: { type: 'disable', target: 0 } }, 30).said).toEqual(expect.arrayContaining(['DISABLE: MANTIS RIPPER']));
    expect(watch([ENEMIES.rival], { objective: { type: 'driveOff', target: 0, share: 0.5 } }, 30).said).toEqual(expect.arrayContaining(['DRIVE OFF: ASHFALL']));
  });
});

describe('the screens the pilot\'s record added', () => {
  const texts = (calls: { name: string; args: unknown[] }[]) => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));

  test('the pilot screen draws its three pages, each under its own tab', () => {
    const app = start({ ...done('intro-1'), callsign: 'VANTA', medals: ['first-contract'], ranks: { 'intro-1': 'S' }, scenes: ['act-1'] });
    select(app, 'pilot');
    const page = () => { const { ctx, calls } = recorder(); app.update(16); app.draw(ctx); return texts(calls); };
    const perks = page();
    expect(perks).toEqual(expect.arrayContaining(['PILOT', 'VANTA', 'PERKS', 'MEDALS', 'RECORD', 'Marksman']));
    press(app, 'next');
    const medals = page();
    expect(medals).toEqual(expect.arrayContaining(['First Invoice', 'EARNED', 'FIRST INVOICE', 'Complete a contract.']));
    // Thirteen rows of medals, however many there are.
    expect(medals).not.toContain('Fully Vested');
    press(app, 'next');
    const record = page();
    expect(record).toEqual(expect.arrayContaining(['CONTRACTS WON', 'TIME PLAYED', 'RANKS HELD', 'S', 'D']));
  });

  test('a medal is announced over whatever screen is up, with its name and what it pays', () => {
    const app = start({ ...done('intro-1'), scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) }, false);
    app.commit({ ...app.game!, arenaRank: 1 });
    const { ctx, calls } = recorder();
    // One frame brings it up, the next few slide it into view.
    app.update(16);
    app.update(400);
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['MEDAL EARNED', 'On the Ladder', '+100 c']));
    // It sits along the bottom edge, clear of the name of the screen and of any heading.
    const heading = calls.find((c) => c.name === 'fillText' && c.args[0] === 'MEDAL EARNED')!;
    expect(Number(heading.args[2])).toBeGreaterThanOrEqual(238);
    expect(Number(heading.args[2])).toBeLessThan(270);
    // It goes away by itself.
    const later = recorder();
    app.update(3000);
    app.draw(later.ctx);
    expect(texts(later.calls)).not.toContain('MEDAL EARNED');
  });

  test('the way out of a settlement is written clear of an announcement: its letters end where the strip begins', () => {
    const app = start({ ...done('intro-1'), scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) }, false);
    const mission = MISSIONS.find((m) => m.id === 'patrol')!;
    app.showSettlement({ won: true, reward: 300, ammoCost: 20, repairCost: 10, net: 270, lines: [] }, mission);
    app.commit({ ...app.game!, arenaRank: 1 });
    app.update(16);
    app.update(400);
    const { ctx, calls } = recorder();
    app.draw(ctx);
    const y = (text: string) => Number(calls.find((c) => c.name === 'fillText' && c.args[0] === text)!.args[2]);
    // The strip's heading is written two below its top edge; a line of text is twelve tall.
    const stripTop = y('MEDAL EARNED') - 2;
    expect(y('Press A to continue') + 12).toBeLessThanOrEqual(stripTop);
  });

  test('the database draws its pages: a unit with its picture and figures, somebody with a face, an entry about the world, a topic of the manual', () => {
    const app = start({ ...done('intro-1'), met: ['recon-drone', 'gun-turret'], scenes: ['act-1'] });
    select(app, 'database');
    const page = () => { const { ctx, calls } = recorder(); app.update(16); app.draw(ctx); return { said: texts(calls), calls }; };
    press(app, 'down', 'down', 'down', 'down', 'down');
    const unit = page();
    expect(unit.said).toEqual(expect.arrayContaining([
      'DATABASE', 'UNITS', 'WORLD', 'MANUAL', 'GUN TURRET', 'ARMOUR', '260', 'WEAK TO', 'Explosive', 'Bastion Cannon (Kinetic)', 'SEEN 2/49', '? ? ?',
    ]));
    expect(unit.calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'enemy-gun-turret')).toBe(true);
    press(app, 'next');
    // A pilot one contract in knows only the voice that hands out the work.
    expect(page().said).toEqual(expect.arrayContaining(['PEOPLE', 'DISPATCH', 'Dispatch', 'KNOWN 1/23', '? ? ?']));
    press(app, 'next');
    expect(page().said).toEqual(expect.arrayContaining(['VARN', 'Varn', 'The Licence', 'Hadron Mining']));
    press(app, 'next');
    // Nothing is found yet: every paper has its number, and the page of the first says where to look.
    expect(page().said).toEqual(expect.arrayContaining(['FOUND', '01 ? ? ?', 'Not found yet.', 'FOUND 0/40   LAMP CHECKS 0']));
    press(app, 'next');
    // The manual opens on the buttons and the short words, and what a first hour asks follows.
    expect(page().said).toEqual(expect.arrayContaining(['CONTROLS', 'Short Words', 'Short Words: Guns', 'The Basics', 'Your Turn', 'Aiming', 'Heat', 'Field Repairs', 'Money', `${MANUAL.length} TOPICS`]));
    expect(MANUAL).toHaveLength(53);
  });

  test('the database growing is announced with its own mark, and medals after it one by one', () => {
    // A game from before there was a database: its entries open as it is loaded.
    const app = start({ ...done('intro-1'), scenes: ['act-1'] }, false);
    const strip = () => { const { ctx, calls } = recorder(); app.update(400); app.draw(ctx); return texts(calls); };
    expect(strip()).toEqual(expect.arrayContaining(['DATABASE', '6 new entries']));
    app.commit({ ...app.game!, arenaRank: 10 });
    app.update(3000);
    expect(strip()).toEqual(expect.arrayContaining(['MEDAL EARNED', 'On the Ladder', '+100 c']));
    app.update(3000);
    expect(strip()).toEqual(expect.arrayContaining(['MEDAL EARNED', 'Champion of Varn', '+1200 c']));
  });

  test('the training screen lists the drills, shows the mech the selected one lends, and says what it is about', () => {
    const app = start({ ...done('intro-1'), drills: ['drill-heat'], scenes: ['act-1'] });
    select(app, 'training');
    const { ctx, calls } = recorder();
    app.update(16);
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining([
      'TRAINING', 'PASSED 1/13', 'Take It Apart', 'Heat Discipline', 'PASSED', 'LOCKED', '150', 'TAKE IT APART', 'Aim at parts', 'OPEN',
    ]));
    // The lent mech is drawn from its parts: the Halo head of the first drill is among them.
    expect(calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'head-halo')).toBe(true);
    // A locked drill says when it opens instead of what it teaches in full.
    press(app, 'down', 'down', 'down');
    const locked = recorder();
    app.draw(locked.ctx);
    expect(texts(locked.calls).some((text) => text.startsWith('The simulator opens this drill'))).toBe(true);
  });

  test('a drill\'s briefing and settlement say that it is a drill', () => {
    const app = start({ ...done('intro-1'), scenes: ['act-1'] });
    select(app, 'training');
    select(app, 'drill-aim');
    const briefing = recorder();
    app.update(16);
    app.draw(briefing.ctx);
    expect(texts(briefing.calls)).toEqual(expect.arrayContaining(['TAKE IT APART', 'Training Simulator', 'PAYS 150']));
    expect(texts(briefing.calls).some((text) => text.startsWith('TRAINING: a lent mech'))).toBe(true);
    const mission = { id: 'drill-aim', phase: 'patrol' as const, title: 'Take It Apart', client: 'x', briefing: [], debrief: 'Done.', reward: 150, battles: [], loaner: REFERENCE_BUILDS.tier1 };
    app.showSettlement({ won: true, reward: 150, ammoCost: 0, repairCost: 0, net: 150, lines: [] }, mission);
    const settlement = recorder();
    app.update(16);
    app.draw(settlement.ctx);
    expect(texts(settlement.calls)).toEqual(expect.arrayContaining(['DRILL PASSED', 'Take It Apart']));
    expect(texts(settlement.calls)).not.toContain('CONTRACT COMPLETE');
  });

  test('the end roll draws what is on screen as it climbs, and its last line stops in the middle', () => {
    const app = start({ ...done('intro-1'), callsign: 'VANTA', endingSeen: true, scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) }, false);
    app.showCredits();
    const frame = () => { const { ctx, calls } = recorder(); app.draw(ctx); return calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), y: Number(c.args[2]) })); };
    // At first nothing has climbed into view.
    expect(frame().map((d) => d.text)).not.toContain('IRONWAGE');
    for (let i = 0; i < 60; i++) app.update(100);
    const early = frame();
    expect(early.map((d) => d.text)).toEqual(expect.arrayContaining(['IRONWAGE', 'FLOWN BY', 'VANTA']));
    expect(early.every((d) => d.y > -40 && d.y < 270)).toBe(true);
    // A press too soon after it opens does nothing; later it skips to the end, where the goodbye sits mid-screen.
    for (let i = 0; i < 2000; i++) app.update(100);
    const end = frame();
    const thanks = end.find((d) => d.text === 'THANK YOU FOR FLYING')!;
    expect(thanks.y).toBeGreaterThan(100);
    expect(thanks.y).toBeLessThan(150);
    expect(end.map((d) => d.text)).not.toContain('IRONWAGE');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a settlement that ran into the debt limit says what was written off', () => {
    const app = start({ ...done('intro-1'), credits: -2000, scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) });
    const mission = MISSIONS.find((m) => m.id === 'patrol')!;
    app.showSettlement({ won: false, reward: 0, ammoCost: 80, repairCost: 320, net: -400, lines: [], relief: 400 }, mission);
    const { ctx, calls } = recorder();
    app.update(16);
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['CONTRACT FAILED', 'Debt limit reached: 400 written off', '-2000']));
    // One that did not says nothing about it.
    app.showSettlement({ won: false, reward: 0, ammoCost: 80, repairCost: 320, net: -400, lines: [] }, mission);
    const plain = recorder();
    app.draw(plain.ctx);
    expect(texts(plain.calls).some((text) => text.startsWith('Debt limit'))).toBe(false);
  });

  test('the end roll says how to skip it while it climbs, and no longer once it has stopped', () => {
    const app = start({ ...done('intro-1'), callsign: 'VANTA', endingSeen: true, scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) }, false);
    app.showCredits();
    const frame = () => { const { ctx, calls } = recorder(); app.draw(ctx); return texts(calls); };
    for (let i = 0; i < 20; i++) app.update(100);
    expect(frame()).toContain('A: skip');
    for (let i = 0; i < 2000; i++) app.update(100);
    expect(frame()).not.toContain('A: skip');
  });

  test('once the story is over, the line that says so is clear of the menu: no row is written over', () => {
    const story = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const app = start({ ...done(...story), endingSeen: true, scenes: ['act-1'], codex: WORLD.map((entry) => entry.id) });
    expect(snap(app).screen).toBe('hub');
    expect(snap(app).menu.items.map((item) => item.id)).toContain('cycle');
    const { ctx, calls } = recorder();
    app.update(16);
    app.draw(ctx);
    const drawn = calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), y: Number(c.args[2]) }));
    const over = drawn.find((d) => d.text === 'The war is over. The work is not.')!;
    expect(over).toBeDefined();
    for (const label of ['Contracts', 'Arena', 'Training', 'The Gauntlet', 'Garage', 'Shop', 'Pilot', 'Messages', 'Database', 'Options', 'New Cycle']) {
      const row = drawn.find((d) => d.text === label)!;
      expect(row, label).toBeDefined();
      expect(Math.abs(over.y - row.y), label).toBeGreaterThanOrEqual(11);
    }
    expect(over.y).toBeLessThan(238);
  });

  test('on the title the pilot\'s name stands clear of Continue, however long it is', () => {
    const saved = { ...done('intro-1'), callsign: 'ABCDEFGH', scenes: ['act-1'] };
    const app = new App({ catalog: CATALOG, save: new SaveFile(store(saved), CATALOG), sprites, fast: true, seed: 3 });
    expect(snap(app).screen).toBe('title');
    const { ctx, calls } = recorder();
    app.draw(ctx);
    const at = (text: string) => Number(calls.find((c) => c.name === 'fillText' && c.args[0] === text)!.args[1]);
    // The label is written from its left edge, the name up to its right edge; a letter is 4.8 wide.
    expect(at('ABCDEFGH') - 8 * 4.8).toBeGreaterThanOrEqual(at('Continue') + 8 * 4.8 + 6);
  });

  test('the hub shows the pilot\'s callsign and level', () => {
    const app = start({ ...done('intro-1'), callsign: 'VANTA', scenes: ['act-1'] });
    const { ctx, calls } = recorder();
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['VANTA', 'LV 1']));
  });
});
