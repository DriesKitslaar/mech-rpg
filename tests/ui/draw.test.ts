import { createBattle, type BattleOptions } from '../../src/core/battle';
import { completeMission } from '../../src/core/campaign';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { BattleFlow, BattleScreen, INTRO_MS, TALK_HOLD_MS, WARNING_MS } from '../../src/ui/battleScreen';
import { buy, equip, newGame, type GameState } from '../../src/core/game';
import { WORLD } from '../../src/content/codex';
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
    // New game, then the callsign on offer.
    press(app, 'confirm', 'confirm');
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
    // A line of text is eleven pixels high.
    expect(lowest + 11).toBeLessThanOrEqual(debrief);
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
    const whole = 'Two hostiles. The one on the ground cannot dodge,';
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

  test('the database draws its three pages: a unit with its picture and figures, an entry about the world, a topic of the manual', () => {
    const app = start({ ...done('intro-1'), met: ['recon-drone', 'gun-turret'], scenes: ['act-1'] });
    select(app, 'database');
    const page = () => { const { ctx, calls } = recorder(); app.update(16); app.draw(ctx); return { said: texts(calls), calls }; };
    press(app, 'down', 'down', 'down', 'down', 'down');
    const unit = page();
    expect(unit.said).toEqual(expect.arrayContaining([
      'DATABASE', 'UNITS', 'WORLD', 'MANUAL', 'GUN TURRET', 'ARMOUR', '260', 'WEAK TO', 'Explosive', 'Bastion Cannon (Kinetic)', 'MET 2/30', '? ? ?',
    ]));
    expect(unit.calls.some((c) => c.name === 'drawImage' && (c.args[0] as { id: string }).id === 'enemy-gun-turret')).toBe(true);
    press(app, 'next');
    expect(page().said).toEqual(expect.arrayContaining(['VARN', 'Varn', 'The Licence', 'Hadron Mining']));
    press(app, 'next');
    expect(page().said).toEqual(expect.arrayContaining(['THE BASICS', 'Your Turn', 'Leg Types', `${22} TOPICS`]));
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
      'TRAINING', 'PASSED 1/10', 'Take It Apart', 'Heat Discipline', 'PASSED', 'LOCKED', '150', 'TAKE IT APART', 'Aim at parts', 'OPEN',
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

  test('the hub shows the pilot\'s callsign and level', () => {
    const app = start({ ...done('intro-1'), callsign: 'VANTA', scenes: ['act-1'] });
    const { ctx, calls } = recorder();
    app.draw(ctx);
    expect(texts(calls)).toEqual(expect.arrayContaining(['VANTA', 'LV 1']));
  });
});
