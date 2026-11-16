import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { xpForLevel } from '../../src/core/pilot';
import type { GameState } from '../../src/core/game';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { CATALOG } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { done, finishBattle, fresh, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { ALL } from '../helpers/testParts';

const turret = ENEMIES['gun-turret'];
const battle = (enemies: EnemyDef[], opts: BattleOptions = {}): BattleState => createBattle(DEMO_BUILD, enemies, ALL, 1, opts);
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const flowOf = (state: BattleState) => settle(new BattleFlow(state, ALL, {}));
function pick(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
  flow.onInput('confirm');
}

describe('the Overdrive in a battle', () => {
  test('R1 on the pilot\'s turn sets off a full meter: the screen says which, the meter is empty and the turn goes on', () => {
    const flow = flowOf(battle([turret], { overdrive: 'iron-skin', drive: 100 }));
    expect(flow.phase).toBe('action');
    const cursor = flow.menu.cursor;
    flow.onInput('next');
    expect(flow.message).toBe('OVERDRIVE: IRON SKIN');
    expect(flow.lastEvent).toEqual({ type: 'overdrive', unit: 'player', kind: 'iron-skin' });
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(flow.state.units[0]).toMatchObject({ drive: 0, ironSkin: true });
    expect(flow.menu.cursor).toBe(cursor);
    // Once is once: the button does nothing until the meter is full again.
    const before = structuredClone(flow.state);
    flow.onInput('next');
    expect(flow.state).toEqual(before);
    expect(flow.phase).toBe('action');
  });

  test('R1 does nothing while the meter is short, or for a mech that has no Overdrive', () => {
    for (const opts of [{ overdrive: 'deadeye', drive: 99 }, {}, { drive: 100 }] as BattleOptions[]) {
      const flow = flowOf(battle([turret], opts));
      const before = structuredClone(flow.state);
      flow.onInput('next');
      expect(flow.state).toEqual(before);
      expect(flow.phase).toBe('action');
    }
  });

  test('while a weapon is being aimed, R1 still goes to the next enemy and the meter is left alone', () => {
    const flow = flowOf(battle([turret, turret], { overdrive: 'deadeye', drive: 100 }));
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    expect(flow.targetId).toBe('enemy-0');
    flow.onInput('next');
    expect(flow.targetId).toBe('enemy-1');
    expect(flow.state.units[0]).toMatchObject({ drive: 100, deadeye: false });
  });

  test('Second Wind makes a weapon that was fired ready to fire again in the same turn', () => {
    const flow = flowOf(battle([turret], { overdrive: 'second-wind', drive: 100 }));
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    flow.onInput('confirm');
    settle(flow);
    expect(flow.phase).toBe('action');
    pick(flow, 'fire');
    expect(flow.menu.items.find((i) => i.id === 'rightHand')).toMatchObject({ enabled: false });
    flow.onInput('cancel');
    flow.onInput('next');
    settle(flow);
    pick(flow, 'fire');
    expect(flow.menu.items.find((i) => i.id === 'rightHand')).toMatchObject({ enabled: true });
  });

  test('Deadeye is in the numbers the pilot is shown: 100 in 100, and more damage', () => {
    const plain = flowOf(battle([turret], { overdrive: 'deadeye', drive: 100 }));
    pick(plain, 'fire');
    pick(plain, 'rightHand');
    const before = plain.preview!;
    plain.onInput('cancel');
    plain.onInput('cancel');
    plain.onInput('next');
    settle(plain);
    pick(plain, 'fire');
    pick(plain, 'rightHand');
    expect(plain.preview!.hitChance).toBe(100);
    expect(plain.preview!.damage).toBeGreaterThan(before.damage);
  });
});

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
/** A battle screen on the pilot's turn, and what it writes when it is drawn. */
function screenOf(opts: BattleOptions, fast = true, coach = false) {
  const flow = new BattleFlow(createBattle(DEMO_BUILD, [turret], CATALOG, 7, opts), CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast, coach });
  for (let i = 0; i < 400 && flow.phase !== 'action'; i++) screen.update(16);
  const written = () => {
    const said: { text: string; y: number }[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillText') said.push({ text: String(args[0]), y: Number(args[2]) }); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    screen.draw(ctx);
    return said;
  };
  return { flow, screen, written, said: () => written().map((w) => w.text) };
}

describe('the Overdrive on the screen', () => {
  test('the button is named in the message bar once the meter is full, on the pilot\'s own menu and nowhere else', () => {
    const ready = screenOf({ overdrive: 'iron-skin', drive: 100 });
    const label = ready.written().find((w) => w.text === 'R1: OVERDRIVE')!;
    expect(label).toBeDefined();
    // In the bar at the top, not on the field where the mech stands.
    expect(label.y).toBe(1);
    expect(screenOf({ overdrive: 'iron-skin', drive: 99 }).said()).not.toContain('R1: OVERDRIVE');
    expect(screenOf({}).said()).not.toContain('R1: OVERDRIVE');
    // One menu deeper R1 means something else, and the bar no longer offers it.
    ready.screen.onInput('confirm');
    expect(ready.flow.phase).toBe('weapon');
    expect(ready.said()).not.toContain('R1: OVERDRIVE');
    ready.screen.onInput('confirm');
    expect(ready.flow.phase).toBe('target');
    expect(ready.said()).not.toContain('R1: OVERDRIVE');
    ready.screen.onInput('cancel');
    ready.screen.onInput('cancel');
    expect(ready.said()).toContain('R1: OVERDRIVE');
    // Spent, the name goes.
    ready.screen.onInput('next');
    for (let i = 0; i < 20; i++) ready.screen.update(16);
    expect(ready.flow.phase).toBe('action');
    expect(ready.said()).not.toContain('R1: OVERDRIVE');
  });

  test('a Second Wind is named but waits: R1 with nothing of the turn spent says so and keeps the meter', () => {
    const { flow, screen, said } = screenOf({ overdrive: 'second-wind', drive: 100 });
    expect(flow.overdrive).toBe('wait');
    expect(said()).toContain('R1: OVERDRIVE');
    screen.onInput('next');
    expect(flow.message).toBe(STRINGS.overdrive.spendFirst);
    expect(flow.state.units[0].drive).toBe(100);
    expect(flow.phase).toBe('action');
    // With a weapon fired the press counts.
    screen.onInput('confirm');
    screen.onInput('confirm');
    screen.onInput('confirm');
    for (let i = 0; i < 40 && flow.phase !== 'action'; i++) screen.update(16);
    expect(flow.overdrive).toBe('ready');
    screen.onInput('next');
    expect(flow.state.units[0].drive).toBe(0);
  });

  test('the meter on the field shows what the messages have got to, not what the rules already know', () => {
    const { flow, screen } = screenOf({ overdrive: 'iron-skin', drive: 92 }, false);
    const column = (): number => {
      let filled = 0;
      const target: Record<string, unknown> = {};
      const ctx = new Proxy(target, {
        get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
          : (...args: unknown[]) => { if (name === 'fillRect' && args[0] === 2 && args[2] === 3) filled = Number(args[3]); }),
        set: (t, name: string, value) => { t[name] = value; return true; },
      }) as unknown as CanvasRenderingContext2D;
      screen.draw(ctx);
      return filled;
    };
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    const before = column();
    expect(before).toBeGreaterThan(0);
    // The turn is ended. The rules play the enemy's shot at once; the screen announces it a moment later.
    for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'endTurn'; j++) flow.onInput('down');
    screen.onInput('confirm');
    let ahead = false;
    for (let i = 0; i < 600 && !ahead && flow.phase !== 'action' && flow.phase !== 'result'; i++) {
      screen.update(16);
      // The first moment the rules know of a hit that has not been announced yet: the column has not moved.
      if (flow.state.units[0].drive > 92 && flow.eventsShown < flow.state.events.length) {
        ahead = true;
        expect(column()).toBe(before);
      }
    }
    expect(ahead).toBe(true);
    // Once the screen has said everything there is to say, the column is where the rules are.
    for (let i = 0; i < 600 && flow.phase !== 'action' && flow.phase !== 'result'; i++) screen.update(16);
    screen.update(16);
    expect(column()).toBeGreaterThan(before);
  });

  test('one that lasts is tagged on the pilot\'s mech for as long as it does', () => {
    const skin = screenOf({ overdrive: 'iron-skin', drive: 100 });
    expect(skin.said()).not.toContain('IRON SKIN');
    skin.screen.onInput('next');
    for (let i = 0; i < 20 && skin.flow.phase !== 'action'; i++) skin.screen.update(16);
    expect(skin.said()).toContain('IRON SKIN');
    const eye = screenOf({ overdrive: 'deadeye', drive: 100 });
    eye.screen.onInput('next');
    for (let i = 0; i < 20 && eye.flow.phase !== 'action'; i++) eye.screen.update(16);
    expect(eye.said()).toContain('DEADEYE');
    // The turn over, Deadeye is over too.
    eye.flow.onInput('up');
    for (let i = 0; i < 12 && eye.flow.menu.items[eye.flow.menu.cursor]?.id !== 'endTurn'; i++) eye.flow.onInput('down');
    eye.screen.onInput('confirm');
    for (let i = 0; i < 400 && eye.flow.phase !== 'action' && eye.flow.phase !== 'result'; i++) eye.screen.update(16);
    expect(eye.said()).not.toContain('DEADEYE');
  });

  test('going off, it holds the field for a moment, throws sparks and sends a ring out from the mech', () => {
    const { screen } = screenOf({ overdrive: 'iron-skin', drive: 100 }, false);
    for (let i = 0; i < 200 && screen.banner; i++) screen.update(16);
    expect(screen.motion).toMatchObject({ surge: false, flash: 0 });
    const before = screen.motion.particles;
    screen.onInput('next');
    screen.update(16);
    expect(screen.motion.surge).toBe(true);
    expect(screen.motion.flash).toBeGreaterThan(0);
    expect(screen.motion.particles).toBeGreaterThan(before);
    for (let i = 0; i < 60; i++) screen.update(16);
    expect(screen.motion.surge).toBe(false);
  });
});

interface Drive { kind: string; value: number }
const drive = (app: ReturnType<typeof inHub>['app']): Drive | null => (snap(app).battle as unknown as { drive: Drive | null }).drive;
const level = (n: number, base: GameState = done('intro-1', 'intro-2')): GameState => ({ ...base, xp: xpForLevel(n) });
type AppOf = ReturnType<typeof inHub>['app'];
/** From the hub into a contract's first battle, past its briefing. */
function into(app: AppOf, list: string, id: string): void {
  select(app, list);
  select(app, id);
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
}
/** Plays the battle on screen to its result, pressing R1 whenever the pilot has the turn. Says how often that set something off. */
function fight(app: AppOf): number {
  let used = 0;
  for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
    const s = snap(app);
    if (s.battle!.phase === 'animating') app.update(16);
    else if (s.battle!.phase === 'action') {
      // R1 whenever the meter is full: a Second Wind does not take it until something of the turn is spent.
      if (drive(app)?.value === 100) press(app, 'next');
      if (drive(app)?.value === 0 && s.battle && (s.battle as unknown as { drive: { value: number } }).drive.value === 100) used += 1;
      else if (s.menu.items[0].enabled) press(app, 'confirm');
      else select(app, 'endTurn');
    } else press(app, 'confirm');
  }
  expect(snap(app).battle?.phase).toBe('result');
  return used;
}

describe('whose Overdrive it is', () => {
  test('a pilot below level 3 fights without a meter; from level 3 the meter is there, empty, with Second Wind behind it', () => {
    const early = inHub(level(2)).app;
    into(early, 'contracts', 'patrol');
    expect(drive(early)).toBeNull();
    const { app } = inHub(level(3));
    into(app, 'contracts', 'patrol');
    expect(drive(app)).toEqual({ kind: 'second-wind', value: 0 });
  });

  test('the pilot\'s page lists the three: the one fitted, those open, and the level the others take', () => {
    const { app } = inHub(level(6));
    select(app, 'pilot');
    press(app, 'prev');
    expect(snap(app)).toMatchObject({ page: 'drive', overdrive: 'second-wind' });
    expect(snap(app).menu.items).toEqual([
      { id: 'second-wind', label: 'Second Wind', enabled: true, note: 'FITTED' },
      { id: 'iron-skin', label: 'Iron Skin', enabled: true },
      { id: 'deadeye', label: 'Deadeye', enabled: false, note: 'LV 9' },
    ]);
    const none = inHub(level(1)).app;
    select(none, 'pilot');
    press(none, 'prev');
    expect(snap(none)).toMatchObject({ page: 'drive', overdrive: null });
    expect(snap(none).menu.items.map((i) => [i.enabled, i.note])).toEqual([[false, 'LV 3'], [false, 'LV 6'], [false, 'LV 9']]);
  });

  test('one that is open can be fitted: it is saved, the cursor stays on it, and the next battle is fought with it', () => {
    const { app, store } = inHub(level(6));
    select(app, 'pilot');
    press(app, 'prev', 'down', 'confirm');
    expect(snap(app)).toMatchObject({ page: 'drive', overdrive: 'iron-skin', menu: { cursor: 1 } });
    expect(snap(app).menu.items.map((i) => i.note)).toEqual([undefined, 'FITTED', 'LV 9']);
    expect(savedGame(store).overdrive).toBe('iron-skin');
    // One that is not open yet cannot be.
    press(app, 'down', 'confirm');
    expect(savedGame(store).overdrive).toBe('iron-skin');
    press(app, 'cancel');
    into(app, 'contracts', 'patrol');
    expect(drive(app)).toEqual({ kind: 'iron-skin', value: 0 });
  });

  test('the simulator lends its own for the drill that teaches it, full from the start, and none for any other drill', () => {
    const { app } = inHub(level(9));
    into(app, 'training', 'drill-overdrive');
    expect(drive(app)).toEqual({ kind: 'second-wind', value: 100 });
    const other = inHub(level(9)).app;
    into(other, 'training', 'drill-aim');
    expect(drive(other)).toBeNull();
  });

  test('the Gauntlet is fought without one, until a warden leaves the run one', () => {
    const { app } = inHub(strong(level(9)));
    select(app, 'gauntlet');
    select(app, 'start');
    select(app, 'door-0');
    expect(snap(app).screen).toBe('battle');
    expect(drive(app)).toBeNull();
  });
});

describe('an Overdrive in a contract', () => {
  test('the meter fills as the pilot fights and is carried into the contract\'s next battle', () => {
    const { app } = inHub(strong(level(3, done('intro-1', 'intro-2'))));
    into(app, 'contracts', 'hadron-1');
    expect(drive(app)!.value).toBe(0);
    finishBattle(app);
    const filled = drive(app)!.value;
    expect(filled).toBeGreaterThan(0);
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ index: 1 });
    expect(drive(app)).toEqual({ kind: 'second-wind', value: filled });
  });

  test('set off, it is counted for the pilot\'s record and earns the first medal for it', () => {
    const { app, store } = inHub(strong(level(3, done('intro-1', 'intro-2'))));
    into(app, 'contracts', 'hadron-1');
    let used = fight(app);
    press(app, 'confirm');
    used += fight(app);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('settlement');
    expect(used).toBeGreaterThan(0);
    expect(savedGame(store).overdrives).toBe(used);
    expect(savedGame(store).medals).toContain('overdrive');
  });

  test('one set off in the simulator is not counted: the simulator counts for nothing but its drills', () => {
    const { app, store } = inHub(level(3));
    into(app, 'training', 'drill-overdrive');
    expect(fight(app)).toBeGreaterThan(0);
    press(app, 'confirm');
    expect(savedGame(store).overdrives ?? 0).toBe(0);
    expect(savedGame(store).medals).not.toContain('overdrive');
  });

  test('the battle says in the pilot\'s language which one went off', () => {
    expect(STRINGS.overdrive.used(STRINGS.overdrive.names.deadeye)).toBe('OVERDRIVE: DEADEYE');
  });
});
