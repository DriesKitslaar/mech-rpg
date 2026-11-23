import { chooseEnemyAction } from '../../src/core/ai';
import { HEAT_LIMIT, activeUnit, applyAction, checkAction, createBattle, type BattleState } from '../../src/core/battle';
import { LESSONS, type LessonLine } from '../../src/core/campaign';
import { WEAPON_SLOTS } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { MANUAL } from '../../src/content/codex';
import { LESSON_LINES } from '../../src/content/drills';
import { STARTERS } from '../../src/content/starters';
import type { Build } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, MENU_ROW_CHARS } from '../../src/ui/battleScreen';
import { LOGICAL_W } from '../../src/ui/display';
import type { SpriteStore } from '../../src/ui/sprites';
import { archetypeOf } from '../../src/core/archetype';
import { generateBoard } from '../../src/core/board';
import { xpForLevel } from '../../src/core/pilot';
import { validatePlayerBuild } from '../../src/core/build';
import { buy, equip, sell, type GameState } from '../../src/core/game';
import { GRUDGE, type Grudge } from '../../src/core/grudge';
import { JOB, jobContract } from '../../src/core/jobs';
import { drillOpen } from '../../src/core/training';
import { BOARD_TEXT } from '../../src/content/board';
import { DRILLS } from '../../src/content/drills';
import { MEDALS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS } from '../../src/content/parts';
import type { App } from '../../src/ui/app';
import { BRIEFING_HOLD_MS } from '../../src/ui/briefingScreen';
import { ARCHIVE, KIND_CHARS, kindOf } from '../../src/ui/hubScreen';
import { MESSAGE_CHARS } from '../../src/ui/tags';
import { JUGGERNAUT, accept, done, finishBattle, finishMission, fresh, inHub, makeApp, press, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';
import { ALL } from '../helpers/testParts';

/**
 * What a pilot in their first hours could not find out from the screen, as the tester who played them
 * reported it: held here so that it stays findable.
 */
afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const battle = (build: Build = DEMO_BUILD, enemies = ['gun-turret'], seed = 1): BattleState =>
  createBattle(build, enemies.map((id) => ENEMIES[id]), ALL, seed);
/** Plays out queued messages and enemy turns until the player may act (or the battle is over). */
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 800) flow.advance();
  return flow;
}
const ready = (state: BattleState, opts: ConstructorParameters<typeof BattleFlow>[2] = {}) => settle(new BattleFlow(state, ALL, opts));
function toItem(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
}
const pick = (flow: BattleFlow, id: string) => { toItem(flow, id); flow.onInput('confirm'); };
const item = (flow: BattleFlow, id: string) => flow.menu.items.find((i) => i.id === id)!;
const under = (flow: BattleFlow): string => flow.menu.items[flow.menu.cursor].id;
/** Fires every weapon the machine has at whatever is first in its sights. */
function fireAll(flow: BattleFlow): void {
  for (let i = 0; i < 4 && item(flow, 'fire').enabled && flow.state.outcome === 'ongoing'; i++) {
    pick(flow, 'fire');
    flow.onInput('confirm');
    flow.onInput('confirm');
    settle(flow);
  }
}
/** A battle as it stands after the pilot's machine has been changed by hand. */
const with_ = (change: (state: BattleState) => void, build: Build = DEMO_BUILD): BattleFlow => {
  const state = structuredClone(ready(battle(build)).state);
  change(state);
  return ready(state);
};

describe('a row of the battle menu that cannot be chosen says why, beside it', () => {
  const N = STRINGS.actionNotes;

  test('Fire, once every weapon has fired; and what else stops a weapon when one has not', () => {
    const flow = ready(battle());
    expect(item(flow, 'fire').note).toBeUndefined();
    fireAll(flow);
    expect(flow.phase).toBe('action');
    expect(item(flow, 'fire')).toMatchObject({ enabled: false, note: STRINGS.weaponMenu.reasons.alreadyFired });
    // With nothing fired and nothing to fire it with, the row says what is short.
    const dry = with_((state) => { state.units[0].energy = 0; });
    expect(item(dry, 'fire')).toMatchObject({ enabled: false, note: STRINGS.weaponMenu.reasons.noEnergy });
    const armless = with_((state) => { state.units[0].parts.arms!.ap = 0; }, { ...DEMO_BUILD, shoulder: undefined });
    expect(item(armless, 'fire')).toMatchObject({ enabled: false, note: STRINGS.weaponMenu.reasons.weaponDisabled });
  });

  test('Boost and Guard shut each other out for the turn, and each says which of the two the machine is doing', () => {
    const guarded = ready(battle());
    pick(guarded, 'guard');
    settle(guarded);
    expect(item(guarded, 'boost')).toMatchObject({ enabled: false, note: N.guarding });
    expect(item(guarded, 'guard')).toMatchObject({ enabled: false, note: N.guarding });
    const boosted = ready(battle());
    pick(boosted, 'boost');
    settle(boosted);
    expect(item(boosted, 'boost')).toMatchObject({ enabled: false, note: N.boosting });
    expect(item(boosted, 'guard')).toMatchObject({ enabled: false, note: N.boosting });
  });

  test('Vent once it is done, and anything that costs energy when there is none', () => {
    const flow = ready(battle());
    pick(flow, 'cool');
    settle(flow);
    expect(item(flow, 'cool')).toMatchObject({ enabled: false, note: N.vented });
    const dry = with_((state) => { state.units[0].energy = 0; });
    for (const id of ['boost', 'guard', 'cool']) expect(item(dry, id), id).toMatchObject({ enabled: false, note: N.noEnergy });
  });

  test('Boost on a machine that has lost its legs, or stands on tracks, or has been staggered', () => {
    expect(item(with_((state) => { state.units[0].parts.legs!.ap = 0; }), 'boost')).toMatchObject({ enabled: false, note: N.legs });
    expect(item(with_((state) => { state.units[0].staggered = 1; }), 'boost')).toMatchObject({ enabled: false, note: N.staggered });
    const tracks = Object.values(ALL).find((part) => part.kind === 'legs' && part.legType === 'tank')!;
    expect(item(ready(battle({ ...DEMO_BUILD, legs: tracks.id })), 'boost')).toMatchObject({ enabled: false, note: N.tracks });
  });

  test('Field Repair with nothing damaged, with nothing left that can be patched, and with none left', () => {
    expect(item(ready(battle()), 'repair')).toMatchObject({ enabled: false, note: N.whole });
    expect(item(with_((state) => { state.units[0].parts.arms!.ap = 0; }), 'repair')).toMatchObject({ enabled: false, note: N.late });
    const spent = with_((state) => { state.units[0].parts.arms!.ap = 1; state.units[0].repairsLeft = 0; });
    expect(item(spent, 'repair')).toMatchObject({ enabled: false, note: N.spent });
  });

  test('a module that has been used this turn; one with no uses left says so in its own count', () => {
    const flow = ready(battle({ ...DEMO_BUILD, module: 'mod-t-coolant' }));
    pick(flow, 'module');
    settle(flow);
    expect(item(flow, 'module')).toMatchObject({ label: 'coolant x1', enabled: false, note: N.used });
    const empty = with_((state) => { state.units[0].moduleUses = 0; }, { ...DEMO_BUILD, module: 'mod-t-coolant' });
    expect(item(empty, 'module')).toMatchObject({ label: 'coolant x0', enabled: false });
    expect(item(empty, 'module').note).toBeUndefined();
  });

  test('the screen writes the reason in the row, in place of what the row would cost', () => {
    const flow = ready(battle());
    pick(flow, 'guard');
    settle(flow);
    const screen = new BattleScreen(flow, sprites, ALL, { fast: true });
    const texts = record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
    expect(texts).toContain(`${STRINGS.actions.guard}  ${N.guarding}`);
    expect(texts).toContain(`${STRINGS.actions.boost}  ${N.guarding}`);
    expect(texts.filter((text) => text.startsWith(`${STRINGS.actions.cool}  ${STRINGS.meters.energy} `))).toHaveLength(1);
  });

  test('every row with every reason fits the menu, in English and in Dutch', () => {
    const fitted = Object.entries(ALL).filter(([id]) => id.startsWith('mod-') && !id.startsWith('mod-t-')).map(([, part]) => part);
    const modules = fitted.map((part) => part.name);
    // Only a module that marks an enemy can be short of one to mark.
    const painters = fitted.filter((part) => part.kind === 'module' && part.effect === 'painter').map((part) => part.name);
    expect(modules.length).toBeGreaterThan(8);
    expect(painters.length).toBeGreaterThan(1);
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const notes = S.actionNotes;
      const reasons = Object.values(S.weaponMenu.reasons);
      const rows: string[] = [
        ...reasons.map((reason) => `${S.actions.fire}  ${reason}`),
        ...[notes.boosting, notes.guarding, notes.noEnergy, notes.legs, notes.tracks, notes.staggered].map((note) => `${S.actions.boost}  ${note}`),
        ...[notes.boosting, notes.guarding, notes.noEnergy].map((note) => `${S.actions.guard}  ${note}`),
        ...[notes.vented, notes.noEnergy].map((note) => `${S.actions.cool}  ${note}`),
        ...[notes.whole, notes.late, notes.spent, notes.repair].map((note) => `${S.actions.repair}  ${note}`),
        ...modules.map((name) => `${name} x9  ${notes.used}`),
        ...painters.map((name) => `${name} x9  ${notes.noTarget}`),
      ];
      expect(rows.filter((row) => row.length > MENU_ROW_CHARS).map((row) => `${language}: ${row}`)).toEqual([]);
    }
  });
});

describe('where the cursor rests when the menu is handed over', () => {
  test('on Fire while a weapon can fire; on End Turn once none can, not on a row that costs energy', () => {
    // One light weapon: with it fired there is energy over, and Boost is the first row that could still be taken.
    const flow = ready(battle({ ...DEMO_BUILD, leftHand: undefined, shoulder: undefined }, ['scrap-king']));
    expect(under(flow)).toBe('fire');
    fireAll(flow);
    expect(flow.phase).toBe('action');
    expect(item(flow, 'fire').enabled).toBe(false);
    expect(item(flow, 'boost').enabled).toBe(true);
    expect(under(flow)).toBe('endTurn');
  });

  test('on Boost when what cannot fire is a blade waiting for one', () => {
    const blade = Object.values(ALL).find((part) => part.kind === 'weapon' && part.melee)!;
    const flow = ready(battle({ ...DEMO_BUILD, rightHand: blade.id, leftHand: undefined, shoulder: undefined }));
    expect(item(flow, 'fire')).toMatchObject({ enabled: false, note: STRINGS.weaponMenu.reasons.needsBoost });
    expect(under(flow)).toBe('boost');
    pick(flow, 'boost');
    settle(flow);
    expect(under(flow)).toBe('fire');
  });

  test('on Auto Turn for a pilot who let the machine fly the turn before, until they do something else', () => {
    const flow = ready(battle(DEMO_BUILD, ['scrap-king']));
    pick(flow, 'auto');
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(under(flow)).toBe('auto');
    // Backing out of a retreat leaves it where it was.
    pick(flow, 'retreat');
    flow.onInput('cancel');
    expect(under(flow)).toBe('auto');
    // Anything the pilot does themselves ends it: the next turn opens on Fire again.
    pick(flow, 'endTurn');
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(under(flow)).toBe('fire');
  });

  test('and in the next battle of the same contract, when the last turn of the one before was flown so', () => {
    const first = ready(battle(DEMO_BUILD, ['scrap-king']));
    expect(first.flewItself).toBe(false);
    pick(first, 'auto');
    settle(first);
    expect(first.flewItself).toBe(true);
    expect(under(ready(battle(), { auto: first.flewItself }))).toBe('auto');
    expect(under(ready(battle(), { auto: false }))).toBe('fire');
  });
});

describe('a contract of two battles, flown on Auto Turn', () => {
  /** Presses A on whatever is under the cursor until the battle on screen is over. */
  function mash(app: App): void {
    for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
      if (snap(app).battle!.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    expect(snap(app).battle?.phase).toBe('result');
  }

  test('takes the walk to Auto Turn once: after that the cursor is on it, in the second battle too', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    accept(app, 'hadron-1');
    for (let i = 0; i < 4000 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('fire');
    select(app, 'auto');
    mash(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory', index: 0 });
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ index: 1 });
    for (let i = 0; i < 4000 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('auto');
    mash(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory', index: 1 });
  });

  test('a pilot who flew the first battle themselves starts the second on Fire', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    accept(app, 'hadron-1');
    finishBattle(app);
    press(app, 'confirm');
    for (let i = 0; i < 4000 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    expect(snap(app).battle).toMatchObject({ index: 1 });
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('fire');
  });
});

describe('a new pilot is told what the row under the cursor does', () => {
  function screenWith(coach: boolean, build: Build = DEMO_BUILD) {
    const flow = new BattleFlow(battle(build, ['recon-drone', 'recon-drone'], 7), ALL, { quiet: true });
    const screen = new BattleScreen(flow, sprites, ALL, { fast: true, coach });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    const said = () => record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
    return { flow, screen, said };
  }

  test('under the line about the buttons, and it changes as the cursor moves', () => {
    const { flow, screen, said } = screenWith(true);
    expect(said()).toContain(STRINGS.coach.action);
    expect(said()).toContain(STRINGS.coachRows.fire);
    screen.onInput('down');
    expect(under(flow)).toBe('boost');
    expect(said()).toContain(STRINGS.coachRows.boost);
    expect(said()).not.toContain(STRINGS.coachRows.fire);
    for (const id of ['guard', 'cool', 'repair', 'endTurn', 'auto', 'retreat'] as const) {
      screen.onInput('down');
      expect(under(flow)).toBe(id);
      expect(said(), id).toContain(STRINGS.coachRows[id]);
    }
    // Choosing a weapon is another step, with its own line and none of these.
    toItem(flow, 'fire');
    screen.onInput('confirm');
    expect(said().filter((text) => (Object.values(STRINGS.coachRows) as string[]).includes(text))).toEqual([]);
  });

  test('the two lines stand one under the other, and neither on the other', () => {
    const { screen } = screenWith(true);
    const texts = record((ctx) => screen.draw(ctx)).texts;
    const buttons = texts.find((t) => t.text === STRINGS.coach.action)!;
    const row = texts.find((t) => t.text === STRINGS.coachRows.fire)!;
    expect(row.y).toBeGreaterThanOrEqual(buttons.y + 10);
    expect(row.left).toBeGreaterThanOrEqual(0);
  });

  test('a module and a wingman have a line too', () => {
    const { flow, said } = screenWith(true, { ...DEMO_BUILD, module: 'mod-t-coolant' });
    toItem(flow, 'module');
    expect(said()).toContain(STRINGS.coachRows.module);
    expect(STRINGS.coachRows.order.length).toBeGreaterThan(10);
  });

  test('a pilot who knows is told none of it', () => {
    const { screen, said } = screenWith(false);
    const all = Object.values(STRINGS.coachRows) as string[];
    expect(said().filter((text) => all.includes(text))).toEqual([]);
    screen.onInput('down');
    expect(said().filter((text) => all.includes(text))).toEqual([]);
  });

  test('every row has a line that names it and fits across the field, in English and in Dutch', () => {
    const ids = ['fire', 'boost', 'guard', 'cool', 'module', 'repair', 'order', 'endTurn', 'auto', 'retreat'] as const;
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      expect(Object.keys(S.coachRows).sort()).toEqual([...ids].sort());
      for (const id of ids) {
        const line = S.coachRows[id];
        expect(line.length * 4, `${language} ${line}`).toBeLessThanOrEqual(300);
        // It opens with the row's own name, in capitals, so the eye finds which row it is about.
        if (id !== 'order' && id !== 'module') expect(line.startsWith(`${S.actions[id].toUpperCase()}: `), `${language} ${line}`).toBe(true);
      }
    }
  });
});

/** Walks the cursor down to a row without choosing it. */
function onto(app: App, id: string): void {
  for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
}
const under_ = (app: App): string => snap(app).menu.items[snap(app).menu.cursor].id;

describe('the hub says that there are drills to run', () => {
  const note = (app: App): string | undefined => snap(app).menu.items.find((item) => item.id === 'training')!.note;
  const open = (game: GameState): number => DRILLS.filter((drill) => drillOpen(game, drill, MISSIONS) && !game.drills.includes(drill.id)).length;

  test('beside Training, as Messages says what is new: how many are open and not passed', () => {
    const game = fresh();
    expect(open(game)).toBe(3);
    expect(note(inHub(game).app)).toBe(STRINGS.hub.drills(3));
    expect(STRINGS.hub.drills(3)).toBe('3 open');
    expect(note(inHub({ ...game, drills: ['drill-aim'] }).app)).toBe(STRINGS.hub.drills(2));
    // More open once Dispatch has finished the introductions.
    const later = done('intro-1', 'intro-2');
    expect(open(later)).toBe(DRILLS.length);
    expect(note(inHub(later).app)).toBe(STRINGS.hub.drills(DRILLS.length));
  });

  test('and nothing once every one of them is passed', () => {
    expect(note(inHub({ ...done('intro-1', 'intro-2'), drills: DRILLS.map((drill) => drill.id) }).app)).toBeUndefined();
  });
});

describe('the list of contracts says what kind of row is in hand', () => {
  const K = STRINGS.hub.kinds;
  const pilot = (wins: number, extra: Partial<GameState> = {}): GameState =>
    ({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins, credits: 5000, scenes: ['act-1'], ...extra });
  const account: Grudge = { name: 'Brakk', kind: 'heavy-mech', origin: 'wrecked', knows: JUGGERNAUT.rightHand, met: 1, waited: 2 };
  /** The line under the list, as the game tells a test of it. */
  const row = (app: App): string | null => (snap(app) as unknown as { row: string | null }).row;
  /** A number of contracts won at which the board has a contract that asks for a class, and a job beside it. */
  const WINS = Array.from({ length: 60 }, (_, i) => 20 + i)
    .find((wins) => generateBoard(wins, 0, BOARD_TEXT).some((m) => m.asks) && jobContract(wins, 0, BOARD_TEXT) !== null)!;

  test('a new pilot is told which row is the story and which the patrol; the main menu has no such line', () => {
    const { app } = inHub();
    expect(row(app)).toBeNull();
    select(app, 'contracts');
    expect(under_(app)).toBe('intro-1');
    expect(row(app)).toBe(K.story);
    onto(app, 'patrol');
    expect(row(app)).toBe(K.patrol);
    press(app, 'cancel');
    expect(row(app)).toBeNull();
  });

  test('it is written under the list, clear of the list above it and of an announcement below', () => {
    const { app } = inHub();
    select(app, 'contracts');
    const texts = record((ctx) => app.draw(ctx)).texts;
    const line = texts.find((t) => t.text === K.story)!;
    expect(line).toBeDefined();
    // The list's panel ends at 223; an announcement comes up from the foot of the screen to 240.
    expect(line.y).toBeGreaterThanOrEqual(224);
    expect(line.y + 10).toBeLessThanOrEqual(240);
    expect(line.left).toBeGreaterThanOrEqual(150);
    expect(line.right).toBeLessThanOrEqual(308);
  });

  test('with the board open: side work, an open contract, one that asks for a class, the job, an account, the swarm, the archive', () => {
    expect(WINS).toBeGreaterThan(0);
    const { app } = inHub(pilot(WINS, { grudge: account }));
    select(app, 'contracts');
    expect(under_(app)).toBe('hadron-1');
    expect(row(app)).toBe(K.story);
    onto(app, 'guild-1');
    expect(row(app)).toBe(K.side);
    const board = generateBoard(WINS, 0, BOARD_TEXT);
    onto(app, board.find((m) => !m.asks)!.id);
    expect(row(app)).toBe(K.open);
    onto(app, board.find((m) => m.asks)!.id);
    expect(row(app)).toBe(K.asks);
    onto(app, `open-0-${WINS}-${JOB}`);
    expect(row(app)).toBe(K.job);
    onto(app, `open-0-${WINS}-${GRUDGE}`);
    expect(row(app)).toBe(K.account);
    onto(app, snap(app).menu.items.find((item) => item.id.endsWith('-swarm'))!.id);
    expect(row(app)).toBe(K.swarm);
    onto(app, ARCHIVE);
    expect(row(app)).toBe(K.archive);
    // And in the archive itself: every row there is a contract flown again.
    press(app, 'confirm');
    expect(snap(app).list).toBe('archive');
    expect(row(app)).toBe(K.replay);
  });

  test('the three contracts that choose a client, and the verdicts, say that taking one closes the others', () => {
    const act = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
    const { app } = inHub(strong(done(...act)));
    select(app, 'contracts');
    for (const id of ['choice-hadron', 'choice-lumen', 'choice-undertow']) {
      onto(app, id);
      expect(row(app), id).toBe(K.choice);
    }
    const verdicts = MISSIONS.filter((m) => m.phase === 'verdict');
    expect(verdicts.length).toBeGreaterThan(1);
    for (const verdict of verdicts) expect(kindOf(verdict, false)).toBe('verdict');
    for (const phase of ['intro', 'faction', 'rival', 'path', 'finale', 'audit'] as const) {
      expect(kindOf(MISSIONS.find((m) => m.phase === phase)!, false), phase).toBe('story');
    }
  });

  test('a mech that cannot deploy: the list holds the patrol alone, and says why', () => {
    const base = fresh();
    const core = SHOP_PARTS.find((part) => part.kind === 'core' && validatePlayerBuild({ ...base.build, core: part.id }, CATALOG).includes('overweight'))!;
    let game: GameState = { ...base, credits: 99999 };
    game = buy(game, core.id, CATALOG);
    game = equip(game, 'core', core.id, CATALOG);
    game = sell(game, base.build.core, CATALOG);
    const { app } = inHub({ ...game, credits: 100 });
    select(app, 'contracts');
    expect(snap(app).menu.items.map((item) => item.id)).toEqual(['patrol']);
    expect(row(app)).toBe(K.lent);
  });

  test('with the story told the cursor rests on the open board, where the work is, and not on the patrol', () => {
    const all = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const game = { ...strong(done(...all)), endingSeen: true, scenes: [] };
    const { app } = inHub(game);
    select(app, 'contracts');
    expect(under_(app)).toBe(generateBoard(game.battlesWon, 0, BOARD_TEXT)[0].id);
    expect(row(app)).toBe(K.open);
  });

  test('every line fits under the list, in English and in Dutch, and opens with a word in capitals', () => {
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const lines = Object.values(S.hub.kinds);
      expect(lines).toHaveLength(13);
      for (const line of lines) {
        expect(line.length, `${language} ${line}`).toBeLessThanOrEqual(KIND_CHARS);
        expect(line, language).toMatch(/^[A-Z][A-Z ]+: /);
      }
    }
  });
});

describe('heat is explained when a machine runs hot, and not before', () => {
  const HEAT: LessonLine = { who: 'Dispatch', text: 'you are running hot' };

  test('Hot Barrel does not warn of heat: nothing a pilot can start in gets near the line there', () => {
    const mission = MISSIONS.find((m) => m.id === 'intro-2')!;
    for (const starter of STARTERS) {
      // The hottest a starter can fly it: a boost and everything it carries, every turn.
      let peak = 0;
      for (let seed = 1; seed <= 12; seed++) {
        let state = createBattle(starter.build, mission.battles[0].enemies.map((id) => ENEMIES[id]), CATALOG, seed);
        for (let i = 0; i < 2000 && state.outcome === 'ongoing'; i++) {
          if (activeUnit(state).side === 'enemy') { state = applyAction(state, chooseEnemyAction(state, CATALOG), CATALOG); continue; }
          if (checkAction(state, { type: 'boost' }, CATALOG) === null) state = applyAction(state, { type: 'boost' }, CATALOG);
          for (const weapon of WEAPON_SLOTS) {
            const fire = { type: 'fire' as const, weapon, target: 'enemy-0', part: 'core' as const };
            if (state.outcome === 'ongoing' && checkAction(state, fire, CATALOG) === null) state = applyAction(state, fire, CATALOG);
          }
          peak = Math.max(peak, state.units[0].heat);
          if (state.outcome === 'ongoing') state = applyAction(state, { type: 'endTurn' }, CATALOG);
        }
      }
      expect(peak, starter.id).toBeGreaterThan(0);
      expect(peak, starter.id).toBeLessThan(HEAT_LIMIT / 2);
    }
    // So the contract speaks of what it does ask for, and leaves heat to the moment it is true.
    const words = [...mission.briefing, ...mission.battles.flatMap((b) => (b.talk ?? []).map((line) => line.text))].join(' ');
    expect(words).not.toMatch(/heat|red line|\bvent\b|shuts down/i);
    expect(words).toMatch(/Boost/);
    expect(words).toMatch(/Guard/);
  });

  test('the first time the menu comes with the machine at half its limit or hotter, Dispatch says what that means: once', () => {
    const hot = (heat: number, opts: ConstructorParameters<typeof BattleFlow>[2]): BattleFlow => {
      const state = structuredClone(ready(battle()).state);
      state.units[0].heat = heat;
      return settle(new BattleFlow(state, ALL, opts));
    };
    const limit = ready(battle()).state.units[0].heatLimit;
    const cool = hot(limit / 2 - 1, { lessons: { heat: HEAT } });
    expect(cool.phase).toBe('action');
    expect(cool.taught).toEqual([]);
    const flow = hot(limit / 2, { lessons: { heat: HEAT } });
    expect(flow.phase).toBe('talk');
    expect(flow.spoken).toMatchObject({ who: 'Dispatch', text: HEAT.text });
    expect(flow.taught).toEqual(['heat']);
    flow.onInput('confirm');
    expect(flow.phase).toBe('action');
    // Not again in the same battle, however hot it gets.
    pick(flow, 'guard');
    settle(flow);
    expect(flow.phase).toBe('action');
    expect(flow.taught).toEqual(['heat']);
    // A pilot who has heard it is handed no line, and hears nothing.
    expect(hot(limit, {}).phase).toBe('action');
  });

  test('it is one of the things a pilot is told once, by Dispatch, and it names what to do', () => {
    expect(LESSONS).toContain('heat');
    expect(LESSON_LINES.heat.who).toBe('Dispatch');
    expect(LESSON_LINES.heat.text).toMatch(/Vent/);
    expect(LESSON_LINES.heat.text).toMatch(/next turn/);
  });
});

describe('a briefing in the introductions tells the contract and nothing else', () => {
  /** A briefing at a walking pace, sat in front of for a while: where odds are counted, they have been. */
  function briefed(game: GameState | undefined, mission: string) {
    const { app } = makeApp(game, 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(100); press(app, 'confirm'); }
    expect(snap(app).screen).toBe('hub');
    app.update(1000);
    select(app, 'contracts');
    select(app, mission);
    expect(snap(app).screen).toBe('briefing');
    for (let i = 0; i < 200; i++) app.update(50);
    const texts = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    return { app, texts, rows: snap(app).menu.items.map((item) => item.id) };
  }
  const classes = Object.values(STRINGS.classes.names).map((name) => name.toUpperCase());
  const spoken = (texts: string[]) => ({
    class: texts.some((text) => classes.includes(text)),
    odds: texts.some((text) => /^ODDS \d+\/\d+$/.test(text)),
  });

  test('the first two contracts: no class, no odds, no row for the build', () => {
    for (const [game, mission] of [[undefined, 'intro-1'], [done('intro-1'), 'intro-2']] as const) {
      const { texts, rows } = briefed(game, mission);
      expect(rows, mission).toEqual(['accept', 'back']);
      expect(spoken(texts), mission).toEqual({ class: false, odds: false });
    }
  });

  test('from the third on it is all there, and in a later telling from the first', () => {
    const later = briefed(done('intro-1', 'intro-2'), 'hadron-1');
    expect(later.rows).toContain('build');
    expect(spoken(later.texts)).toEqual({ class: true, odds: true });
    const again = briefed({ ...done(), cycle: 1, scenes: ['act-1', 'again-1'] }, 'intro-1');
    expect(again.rows).toContain('build');
    expect(spoken(again.texts)).toEqual({ class: true, odds: true });
  });
});

describe('an announcement says where what it names is to be found, and a level gained is announced', () => {
  const announced = (app: App): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => id !== null);
  /** Lets announcements pass until the one of that id is up, and hands back what is written on it. */
  function shown(app: App, id: string): { heading: string; where: string; texts: string[] } {
    for (let i = 0; i < 400 && snap(app).toast !== id; i++) app.update(snap(app).toast === null ? 16 : 3000);
    expect(snap(app).toast).toBe(id);
    const texts = record((ctx) => app.draw(ctx)).texts.filter((t) => t.y >= 238);
    const row = texts.filter((t) => t.size === 10).sort((a, b) => a.left - b.left);
    expect(row).toHaveLength(2);
    // The heading from the left, the place at the right, and a gap between them.
    expect(row[0].right).toBeLessThan(row[1].left - 3);
    return { heading: row[0].text, where: row[1].text, texts: texts.map((t) => t.text) };
  }
  /** A pilot one contract short of the next level, in a frame that wins. */
  const about = (level: number, extra: Partial<GameState> = {}): GameState =>
    ({ ...strong(done('intro-1', 'intro-2')), xp: xpForLevel(level) - 1, scenes: ['act-1'], ...extra });

  test('a level: its number, the points there are to spend, and the page they are spent on', () => {
    const { app } = inHub(about(2));
    accept(app, 'patrol');
    finishMission(app);
    expect(announced(app)).toContain('level:2');
    const { heading, where, texts } = shown(app, 'level:2');
    expect(heading).toBe('LEVEL GAINED');
    expect(where).toBe('Pilot, PERKS');
    expect(texts).toContain('Level 2');
    expect(texts).toContain('1 point');
  });

  test('a contract that gains no level announces none', () => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), xp: xpForLevel(2), scenes: ['act-1'] });
    accept(app, 'patrol');
    finishMission(app);
    expect(announced(app).filter((id) => id.startsWith('level:'))).toEqual([]);
  });

  test('an Overdrive that opens with a level: after the level, and with the page it is chosen on', () => {
    const { app } = inHub(about(3));
    accept(app, 'patrol');
    finishMission(app);
    const ids = announced(app);
    expect(ids).toContain('level:3');
    expect(ids).toContain('overdrive:second-wind');
    expect(ids.indexOf('level:3')).toBeLessThan(ids.indexOf('overdrive:second-wind'));
    expect(shown(app, 'overdrive:second-wind')).toMatchObject({ heading: STRINGS.overdrive.opened, where: 'Pilot, DRIVE' });
  });

  test('a stripe says the page of classes, in Dutch too', () => {
    const game = { ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'] };
    const kind = archetypeOf(game.build, CATALOG);
    const { app } = inHub({ ...game, wonAs: { [kind]: 2 }, settings: { ...game.settings, language: 'nl' } });
    accept(app, 'patrol');
    finishMission(app);
    const id = announced(app).find((entry) => entry.startsWith('stripe:'))!;
    expect(id).toBe(`stripe:${kind}:1`);
    expect(shown(app, id)).toMatchObject({ heading: STRINGS_NL.stripes.earned, where: 'Piloot, KLASSE' });
  });

  test('every heading leaves room for the place beside it, in English and in Dutch', () => {
    for (const S of [STRINGS, STRINGS_NL]) {
      const pairs: [string, string][] = [
        [S.stripes.earned, S.pilot.pages.classes], [S.overdrive.opened, S.pilot.pages.drive],
        [S.renown.earned, S.pilot.pages.record], [S.pilot.levelUp, S.pilot.pages.perks],
      ];
      // An announcement is 176 wide; its words start 20 in and stop 6 short of the edge.
      for (const [heading, page] of pairs) expect((heading.length + `${S.hub.pilot}, ${page}`.length) * 4 + 6, heading).toBeLessThanOrEqual(150);
    }
  });
});

describe('the bill adds up when a medal pays', () => {
  type Bill = { net: number; medals: number };
  const bill = (app: App): Bill => snap(app).settlement as unknown as Bill;
  const written = (app: App): string[] => record((ctx) => app.draw(ctx)).texts.map((t) => t.text);

  test('what the medals paid stands beside the balance: the balance is what there was, the net, and that', () => {
    const { app } = inHub();
    const before = snap(app).credits;
    accept(app, 'intro-1');
    finishMission(app);
    const { net, medals } = bill(app);
    expect(medals).toBeGreaterThan(0);
    expect(snap(app).credits).toBe(before + net + medals);
    expect(written(app)).toContain(`with medals +${medals}`);
    // The line stands on the row of the balance, after the word and before the figure.
    const texts = record((ctx) => app.draw(ctx)).texts;
    const word = texts.find((t) => t.text === STRINGS.settlement.balance)!;
    const line = texts.find((t) => t.text === `with medals +${medals}`)!;
    const figure = texts.find((t) => t.text === String(snap(app).credits) && Math.abs(t.y - word.y) <= 1)!;
    expect(Math.abs(line.y - word.y)).toBeLessThanOrEqual(1);
    expect(line.left).toBeGreaterThan(word.right + 3);
    expect(line.right).toBeLessThan(figure.left - 3);
  });

  test('a bill with no medal has no such line', () => {
    const game = { ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'], medals: MEDALS.map((medal) => medal.id) };
    const { app } = inHub(game);
    accept(app, 'patrol');
    finishMission(app);
    expect(bill(app).medals).toBe(0);
    expect(written(app).filter((text) => text.startsWith('with medals'))).toEqual([]);
    expect(snap(app).credits).toBe(game.credits + bill(app).net);
  });

  test('in Dutch it fits between the word and the figure too', () => {
    // The widest it can be: a balance of seven figures, and medals that paid four.
    const room = 310 - 2 * 34;
    for (const S of [STRINGS, STRINGS_NL]) {
      expect((S.settlement.balance.length + 2 + 7) * 4.8 + S.settlement.medals(9999).length * 4).toBeLessThan(room);
    }
  });
});

describe('choosing a frame to start in', () => {
  test('what comes with it does not read as a price, and the screen says nothing is fixed by the choice', () => {
    const { app } = makeApp();
    press(app, 'confirm');
    for (let i = 0; i < 40 && snap(app).screen !== 'starter'; i++) press(app, 'confirm');
    expect(snap(app).screen).toBe('starter');
    const texts = record((ctx) => app.draw(ctx)).texts;
    const words = texts.map((t) => t.text);
    expect(words).toContain('Plus credits');
    expect(words).not.toContain('Credits');
    const later = texts.find((t) => t.text === STRINGS.starter.later)!;
    expect(later).toBeDefined();
    // Under the panel of figures, inside its width, and clear of the panel below.
    expect(later.left).toBeGreaterThanOrEqual(LOGICAL_W - 154);
    expect(later.right).toBeLessThanOrEqual(LOGICAL_W - 4);
    expect(later.y).toBeGreaterThanOrEqual(132);
    expect(later.y + 10).toBeLessThanOrEqual(182);
  });

  test('the Dutch says the same in the same room', () => {
    expect(STRINGS_NL.starter.credits).not.toBe('Credits');
    expect(STRINGS_NL.starter.later.length * 4).toBeLessThanOrEqual(150);
    expect(STRINGS.starter.later.length * 4).toBeLessThanOrEqual(150);
  });
});

describe('a press that comes in a briefing\'s first moment', () => {
  function walked(mission: string) {
    const { app } = makeApp(strong(done('intro-1', 'intro-2')), 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(100); press(app, 'confirm'); }
    app.update(1000);
    select(app, 'contracts');
    select(app, mission);
    expect(snap(app).screen).toBe('briefing');
    return app;
  }
  type Told = { typing: boolean; busy: boolean };
  const told = (app: App): Told => snap(app) as unknown as Told;

  test('is not taken: the press that chose the contract does not launch it, and the game says it is busy', () => {
    const app = walked('patrol');
    expect(told(app)).toMatchObject({ typing: true, busy: true });
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    app.update(BRIEFING_HOLD_MS - 10);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    // The cursor moves all the while, and B goes back.
    press(app, 'down');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).not.toBe('accept');
    press(app, 'up');
  });

  test('after that moment one press launches, written out or not: hub to launch stays three presses', () => {
    const app = walked('patrol');
    app.update(BRIEFING_HOLD_MS);
    expect(told(app)).toMatchObject({ typing: true, busy: false });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect(BRIEFING_HOLD_MS).toBeLessThanOrEqual(300);
  });

  test('the hurried mode has no such moment', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'patrol');
    expect((snap(app) as unknown as Told).busy).toBe(false);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
  });
});

describe('every row of the options says what it is', () => {
  test('under the list while the cursor is on it, in English and in Dutch, and it fits the panel', () => {
    const finished = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      const base = { ...done(...finished), endingSeen: true, scenes: [] as string[] };
      const { app } = inHub({ ...base, settings: { ...base.settings, language } });
      select(app, 'options');
      const O = S.options;
      const known = [...Object.values(O.help), ...Object.values(O.difficultyHelp), O.swapHelp, O.calmHelp, O.detailHelp];
      const rows = snap(app).menu.items.map((item) => item.id);
      expect(rows).toEqual(['sfx', 'music', 'rumble', 'fastBattles', 'textSpeed', 'calm', 'detail', 'difficulty', 'swapAB', 'language', 'credits', 'title']);
      const said: string[] = [];
      for (const id of rows) {
        onto(app, id);
        const texts = record((ctx) => app.draw(ctx)).texts.filter((t) => known.includes(t.text));
        expect(texts.map((t) => t.text), `${language} ${id}`).toHaveLength(1);
        expect(texts[0].right - texts[0].left, texts[0].text).toBeLessThanOrEqual(216);
        said.push(texts[0].text);
      }
      // Each row has words of its own.
      expect(new Set(said).size).toBe(rows.length);
    }
  });
});

describe('a shot that is not the pilot\'s says whose it was', () => {
  test('the weapon, and in brackets the machine that fired it; the pilot\'s own shots are worded as before', () => {
    const flow = new BattleFlow(battle(DEMO_BUILD, ['recon-drone', 'recon-drone'], 3), ALL, {});
    const said: string[] = [];
    for (let i = 0; i < 4000 && flow.phase === 'animating'; i++) { flow.advance(); if (flow.message) said.push(flow.message); }
    // The drones are quicker and fire first.
    const theirs = said.filter((message) => / (hits|misses) you/.test(message));
    expect(theirs.length).toBeGreaterThan(0);
    for (const message of theirs) expect(message).toMatch(/^Stinger \(Recon Drone [AB]\) (hits|misses) you/);
    pick(flow, 'fire');
    flow.onInput('confirm');
    flow.onInput('confirm');
    // The shot is reported as it is fired, and what follows it after.
    const mine: string[] = [flow.message];
    for (let i = 0; i < 4000 && flow.phase === 'animating'; i++) { flow.advance(); if (flow.message) mine.push(flow.message); }
    expect(mine.filter((message) => /^Rivet Rifle (hits|misses|SHATTERS) Recon Drone [AB]/.test(message)).length).toBeGreaterThan(0);
  });

  test('the longest such line still fits the bar, for every machine in the game and all it carries, in English and in Dutch', () => {
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const wide: string[] = [];
      const parts = Object.values(S.parts);
      for (const enemy of Object.values(ALL_ENEMIES)) {
        const weapons = (['rightHand', 'leftHand', 'shoulder'] as const).map((slot) => enemy.build[slot]).filter((id): id is string => !!id)
          .map((id) => CATALOG[id]).filter((part) => part?.kind === 'weapon');
        for (const weapon of weapons) {
          // A second machine of its kind has a letter after its name.
          const whose = `${weapon.name} (${enemy.name} B)`;
          const lines = [...parts.map((part) => S.hit(whose, 'You', part, 999)), S.miss(whose, 'You'), S.barrierHit(whose, 'You', 999)];
          for (const line of lines) if (line.length > MESSAGE_CHARS) wide.push(`${language} ${line.length}: ${line}`);
        }
      }
      expect(wide).toEqual([]);
    }
  });
});

describe('the word over an enemy says what it means to do, and the manual says so', () => {
  test('the chapter on what enemies do names those words as the field writes them, in both languages', () => {
    const tricks = MANUAL.find((topic) => topic.id === 'tricks')!;
    expect(tricks.text.length).toBeLessThanOrEqual(330);
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const text = MANUAL.find((topic) => topic.id === 'tricks')!.text;
      for (const word of [S.intent.aim('head'), S.intent.windUp, S.intent.hold]) expect(text, `${language} ${word}`).toContain(word);
    }
  });
});
