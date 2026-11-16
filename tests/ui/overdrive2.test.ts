import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { buy, equip, sell, type GameState } from '../../src/core/game';
import { validatePlayerBuild } from '../../src/core/build';
import { xpForLevel } from '../../src/core/pilot';
import type { EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MEDALS } from '../../src/content/medals';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { soundsForEvent } from '../../src/platform/audio';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { recordLines } from '../../src/ui/record';
import type { SpriteStore } from '../../src/ui/sprites';
import { wrap, charsFor } from '../../src/ui/widgets';
import { done, fresh, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { ALL } from '../helpers/testParts';

/** What the review of the Overdrive found that no test would have caught, on the screens. */

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

describe('R1 and the Overdrive', () => {
  test('L1 never sets it off', () => {
    const flow = flowOf(battle([turret], { overdrive: 'iron-skin', drive: 100 }));
    const before = structuredClone(flow.state);
    flow.onInput('prev');
    expect(flow.state).toEqual(before);
    expect(flow.phase).toBe('action');
  });

  test('one menu deeper R1 is not the Overdrive: choosing a weapon, a part to repair, or whether to retreat', () => {
    const worn = battle([turret], { overdrive: 'iron-skin', drive: 100 });
    worn.units[0].parts.legs!.ap = 10;
    for (const open of ['fire', 'repair', 'retreat']) {
      const flow = flowOf(structuredClone(worn));
      pick(flow, open);
      expect(flow.phase).not.toBe('action');
      expect(flow.overdrive).toBeNull();
      flow.onInput('next');
      expect(flow.state.units[0], open).toMatchObject({ drive: 100, ironSkin: false });
    }
  });

  test('the bar offers it only on the pilot\'s own menu: not while aiming, not during the enemy\'s turn, not over the result', () => {
    const flow = flowOf(battle([turret], { overdrive: 'iron-skin', drive: 100 }));
    expect(flow.overdrive).toBe('ready');
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    expect(flow.phase).toBe('target');
    expect(flow.overdrive).toBeNull();
    flow.onInput('cancel');
    flow.onInput('cancel');
    pick(flow, 'endTurn');
    expect(flow.phase).toBe('animating');
    expect(flow.overdrive).toBeNull();
    const over = flowOf({ ...battle([turret], { overdrive: 'iron-skin', drive: 100 }), outcome: 'victory' });
    expect(over.phase).toBe('result');
    expect(over.overdrive).toBeNull();
    // Nor for a mech with no Overdrive, or a meter that is short.
    expect(flowOf(battle([turret])).overdrive).toBeNull();
    expect(flowOf(battle([turret], { overdrive: 'deadeye', drive: 99 })).overdrive).toBeNull();
  });

  test('with one enemy to aim at, R1 leaves the part that was chosen alone', () => {
    // A mech has four parts to aim at; a turret only the one.
    const mech: EnemyDef = { id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD };
    const flow = flowOf(battle([mech], { overdrive: 'deadeye', drive: 100 }));
    pick(flow, 'fire');
    pick(flow, 'rightHand');
    const first = flow.targetPart;
    flow.onInput('down');
    const chosen = flow.targetPart;
    expect(chosen).not.toBe(first);
    flow.onInput('next');
    flow.onInput('prev');
    expect(flow.targetPart).toBe(chosen);
    expect(flow.targetId).toBe('enemy-0');
  });

  test('after it the cursor is back on the row it was on', () => {
    const flow = flowOf(battle([turret], { overdrive: 'iron-skin', drive: 100 }));
    flow.onInput('down');
    flow.onInput('down');
    const row = flow.menu.items[flow.menu.cursor].id;
    expect(row).toBe('guard');
    flow.onInput('next');
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(flow.menu.items[flow.menu.cursor].id).toBe('guard');
    // The next turn opens on the first row as it always did.
    pick(flow, 'endTurn');
    settle(flow);
    expect(flow.menu.cursor).toBe(0);
  });

  test('the screen says which one went off in the language that is set', () => {
    setLanguage('nl');
    try {
      const flow = flowOf(battle([turret], { overdrive: 'deadeye', drive: 100 }));
      flow.onInput('next');
      expect(flow.message).toBe('OVERDRIVE: SCHERPOOG');
      const wind = flowOf(battle([turret], { overdrive: 'second-wind', drive: 100 }));
      wind.onInput('next');
      expect(wind.message).toBe('Tweede Adem: gebruik eerst je beurt.');
    } finally {
      setLanguage('en');
    }
    expect(STRINGS.overdrive.spendFirst).toBe('Second Wind: spend your turn first.');
  });
});

describe('the meter on the field', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  /** The height the column is filled to, or null when it is not drawn at all. */
  function column(screen: BattleScreen): number | null {
    let filled: number | null = null;
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillRect' && args[0] === 2 && args[2] === 3) filled = Number(args[3]); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    screen.draw(ctx);
    return filled;
  }
  const screenOf = (state: BattleState, fast = true, sfx?: { play: (name: string) => void }) => {
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    return { flow, screen: new BattleScreen(flow, sprites, CATALOG, { fast, ...(sfx ? { sfx: sfx as never } : {}) }) };
  };
  const at = (drive: number) => createBattle(DEMO_BUILD, [turret], CATALOG, 7, { overdrive: 'iron-skin', drive });

  test('is as full as the meter is: empty at nought, half way at fifty, to the top at a hundred', () => {
    const height = (drive: number) => { const { screen } = screenOf(at(drive)); screen.update(16); return column(screen); };
    const full = height(100)!;
    expect(full).toBeGreaterThan(100);
    expect(height(0)).toBe(0);
    expect(height(50)).toBe(Math.round(full / 2));
    expect(height(25)).toBe(Math.round(full / 4));
  });

  test('is not there for a mech with no Overdrive, over the banner that opens the battle, or for a wreck', () => {
    const none = screenOf(createBattle(DEMO_BUILD, [turret], CATALOG, 7));
    none.screen.update(16);
    expect(column(none.screen)).toBeNull();
    const opening = screenOf(at(50), false);
    expect(opening.screen.banner).toBe(true);
    expect(column(opening.screen)).toBeNull();
    for (let i = 0; i < 400 && opening.screen.banner; i++) opening.screen.update(16);
    expect(column(opening.screen)).not.toBeNull();
    const wrecked = at(50);
    wrecked.units[0].destroyed = true;
    const wreck = screenOf(wrecked);
    wreck.screen.update(16);
    expect(column(wreck.screen)).toBeNull();
  });

  test('going off, it is heard', () => {
    expect(soundsForEvent({ type: 'overdrive', unit: 'player', kind: 'deadeye' }, 'kinetic', 0)).toEqual([{ name: 'overdrive', delayMs: 0 }]);
    const played: string[] = [];
    const { flow, screen } = screenOf(at(100), false, { play: (name) => { played.push(name); } });
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    screen.onInput('next');
    screen.update(16);
    expect(played).toContain('overdrive');
  });
});

describe('the pilot\'s page of Overdrives', () => {
  test('draws the Overdrives, what the one under the cursor does and how the meter fills, and nothing of the record', () => {
    const { app } = inHub({ ...done('intro-1', 'intro-2'), xp: xpForLevel(6) });
    select(app, 'pilot');
    press(app, 'prev', 'down');
    const said: string[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    app.draw(ctx);
    const width = charsFor(310 - 28);
    expect(said).toEqual(expect.arrayContaining([
      'OVERDRIVE', 'Second Wind', 'Iron Skin', 'Deadeye', 'IRON SKIN', 'FITTED', 'LV 9',
      ...wrap(STRINGS.overdrive.notes['iron-skin'], width), ...wrap(STRINGS.overdrive.how, width), STRINGS.overdrive.hint,
    ]));
    // The record's own lines are not there (its line about medals shares a word with the tab above, which is).
    const tabs: string[] = Object.values(STRINGS.pilot.pages);
    const record = recordLines(app.game!, MEDALS.length).map((line) => line.label).filter((label) => !tabs.includes(label));
    expect(record.length).toBeGreaterThan(8);
    for (const label of record) expect(said, label).not.toContain(label);
  });
});

describe('the Overdrive and the pilot\'s game', () => {
  type AppOf = ReturnType<typeof inHub>['app'];
  const drive = (app: AppOf) => (snap(app).battle as unknown as { drive: { kind: string; value: number } | null }).drive;
  /** Plays the battle on screen to its result, pressing R1 whenever the meter is full. Says how often that set something off. */
  function fight(app: AppOf): number {
    let used = 0;
    for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
      const s = snap(app);
      if (s.battle!.phase === 'animating') app.update(16);
      else if (s.battle!.phase === 'action') {
        const before = drive(app)?.value;
        if (before === 100) press(app, 'next');
        if (before === 100 && drive(app)?.value === 0) used += 1;
        else if (s.menu.items[0].enabled) press(app, 'confirm');
        else select(app, 'endTurn');
      } else press(app, 'confirm');
    }
    return used;
  }
  /** Takes a contract and plays it through, battle by battle. Returns how many Overdrives went off in each battle. */
  function contract(app: AppOf, id: string): number[] {
    select(app, 'contracts');
    select(app, id);
    select(app, 'accept');
    const uses: number[] = [];
    for (let b = 0; b < 6 && snap(app).screen === 'battle'; b++) { uses.push(fight(app)); press(app, 'confirm'); }
    expect(snap(app).screen).toBe('settlement');
    press(app, 'confirm');
    for (let i = 0; i < 120 && snap(app).screen !== 'hub'; i++) press(app, 'confirm');
    return uses;
  }
  const skinned = (): GameState => ({ ...strong(done('intro-1', 'intro-2')), xp: xpForLevel(6), overdrive: 'iron-skin' });

  test('every battle of a contract is counted, and the next contract adds to the count instead of replacing it', () => {
    const { app, store } = inHub(skinned());
    const first = contract(app, 'lumen-1');
    // One went off in each of the two battles: the first battle's is not forgotten when the second is booked.
    expect(first.length).toBe(2);
    expect(first.every((n) => n > 0)).toBe(true);
    const total = first.reduce((a, b) => a + b, 0);
    expect(savedGame(store).overdrives).toBe(total);
    const second = contract(app, 'hadron-1').reduce((a, b) => a + b, 0);
    expect(second).toBeGreaterThan(0);
    expect(savedGame(store).overdrives).toBe(total + second);
  });

  test('the patrol in a lent mech is flown with the pilot\'s own Overdrive', () => {
    // A pilot whose own mech cannot deploy: a core too heavy for the legs, the old one sold.
    const base = { ...done('intro-1', 'intro-2'), xp: xpForLevel(3) };
    const core = SHOP_PARTS.find((part) => part.kind === 'core' && validatePlayerBuild({ ...base.build, core: part.id }, CATALOG).includes('overweight'))!;
    let g: GameState = { ...base, credits: 99999 };
    g = sell(equip(buy(g, core.id, CATALOG), 'core', core.id, CATALOG), base.build.core, CATALOG);
    const { app } = inHub({ ...g, credits: 100 });
    select(app, 'contracts');
    select(app, 'patrol');
    expect(snap(app).briefing).toMatchObject({ lent: true });
    select(app, 'accept');
    expect(drive(app)).toEqual({ kind: 'second-wind', value: 0 });
  });

  test('an Overdrive that the pilot\'s level has just opened is announced once; one that was open already is not', () => {
    const { app } = inHub({ ...fresh(), scenes: ['act-1'] });
    for (let i = 0; i < 20 && snap(app).toast; i++) app.update(6000);
    app.commit({ ...app.game!, xp: xpForLevel(3) });
    const ids = () => [snap(app).toast, ...snap(app).toasts];
    expect(ids()).toContain('overdrive:second-wind');
    for (let i = 0; i < 40 && (snap(app).toast || snap(app).toasts.length > 0); i++) app.update(6000);
    app.commit({ ...app.game!, xp: xpForLevel(4) });
    expect(ids()).not.toContain('overdrive:second-wind');
    app.commit({ ...app.game!, xp: xpForLevel(6) });
    expect(ids()).toContain('overdrive:iron-skin');
    // A game opened at level nine is told nothing: nothing has just opened.
    const old = inHub({ ...fresh(), scenes: ['act-1'], xp: xpForLevel(9) }).app;
    expect([snap(old).toast, ...snap(old).toasts].some((id) => String(id).startsWith('overdrive:'))).toBe(false);
  });
});
