import type { BattleState } from '../../src/core/battle';
import type { Mission } from '../../src/core/campaign';
import { FORECAST_PLAYS, FORECAST_STEPS, advance, counted, newCount, type Count, type Forecast } from '../../src/core/forecast';
import { DIFFICULTY_SCALE, saveLoadout, type GameState } from '../../src/core/game';
import { startFight, type Fight } from '../../src/core/mission';
import { fittedOverdrive, perkEffects, xpForLevel } from '../../src/core/pilot';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { STRINGS } from '../../src/content/strings';
import type { App, AppDeps } from '../../src/ui/app';
import { ODDS_BUDGET_MS, ODDS_FAIR, ODDS_GOES, ODDS_GOOD, oddsColor } from '../../src/ui/briefingScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { CHAR_W, COLORS, LINE } from '../../src/ui/widgets';
import { autoBattle, done, fresh, ids, inHub, makeApp, press, select, snap } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The odds on a briefing: how the contract is likely to go in the build chosen, counted a little
 * each frame by the game's own pilot from exactly what the fight that follows is started from.
 */

afterEach(() => setLanguage('en'));

interface Odds extends Forecast { done: boolean }
const oddsOf = (app: App): Odds | null => (snap(app).briefing as unknown as { odds: Odds | null }).odds;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const B = STRINGS.briefing;
const quiet = (base: GameState): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const DUELLIST = ARCHETYPE_BUILDS.duellist.war;
const BASTION = ARCHETYPE_BUILDS.bastion.war;
const SHARP = ARCHETYPE_BUILDS.marksman.war;

/**
 * A pilot at the war who flies a duellist and has a bastion saved first and a sharpshooter second.
 * Kite has been met and sent on, so a wingman is for hire.
 */
function threeBuilds(extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3');
  let game = saveLoadout(wearing(story, BASTION), 0);
  game = saveLoadout(wearing(game, SHARP), 1);
  game = wearing(game, DUELLIST);
  return { ...quiet(game), scenes: ['act-1', 'act-2', 'talk-kite'], choices: { kite: 'pass' }, arenaRank: 3, ...extra };
}
/**
 * Into the hub out of the hurried mode, unless asked otherwise: the odds are counted where somebody is
 * reading. There, whatever page of story is due takes time to read past, as it does for a player.
 */
function reading(saved: GameState, deps: Partial<AppDeps> = {}): App {
  const { app } = makeApp(saved, undefined, { fast: false, ...deps });
  press(app, 'confirm');
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(600); press(app, 'confirm'); }
  expect(snap(app).screen).toBe('hub');
  return app;
}
/** At a contract's briefing. */
function atBriefing(saved: GameState, contract = 'lumen-4', deps: Partial<AppDeps> = {}): App {
  const app = reading(saved, deps);
  select(app, 'contracts');
  select(app, contract);
  expect(snap(app).screen).toBe('briefing');
  return app;
}
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
const frames = (app: App, n: number): void => { for (let i = 0; i < n; i++) app.update(16); };
/** Lets frames pass until the odds showing are counted, and says what they are. */
function countOut(app: App): Odds {
  for (let i = 0; i < 20_000 && !oddsOf(app)?.done; i++) app.update(16);
  expect(oddsOf(app)?.done).toBe(true);
  return oddsOf(app)!;
}
/** The offer the briefing is showing, as the app holds it. */
const showing = (app: App): Mission => (app as unknown as { current: { mission: Mission } }).current.mission;
/** The same count, done apart from any screen: so many goes of the usual size. */
function goes(prospect: { mission: Mission; fight: Fight }, n: number): Count {
  let count = newCount();
  for (let i = 0; i < n; i++) count = advance(count, prospect.fight, prospect.mission, CATALOG);
  return count;
}
function counts(prospect: { mission: Mission; fight: Fight }): Forecast {
  let count = newCount();
  while (!counted(count)) count = advance(count, prospect.fight, prospect.mission, CATALOG, 100_000);
  return count.tally;
}
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};

describe('the odds are counted while the briefing is read', () => {
  test('a little each frame, from the moment the briefing opens: one go of the count a frame where the time cannot be told', () => {
    const app = atBriefing(threeBuilds());
    const prospect = app.prospect(showing(app), null, null)!;
    expect(oddsOf(app)).toEqual({ played: 0, won: 0, done: false });
    frames(app, 1);
    expect(oddsOf(app)).toEqual({ ...goes(prospect, 1).tally, done: false });
    frames(app, 11);
    const twelve = goes(prospect, 12);
    expect(oddsOf(app)).toEqual({ ...twelve.tally, done: false });
    // Twelve goes of eight steps have flown some of the twenty and not all of them.
    expect(twelve.tally.played).toBeGreaterThan(0);
    expect(twelve.tally.played).toBeLessThan(FORECAST_PLAYS);
    expect(FORECAST_STEPS).toBe(8);
  });

  test('counted out, they are the odds of the contract as accepting it would start it, and they stay', () => {
    const app = atBriefing(threeBuilds());
    const prospect = app.prospect(showing(app), null, null)!;
    const odds = countOut(app);
    expect(odds).toEqual({ ...counts(prospect), done: true });
    expect(odds.played).toBe(FORECAST_PLAYS);
    frames(app, 30);
    expect(oddsOf(app)).toEqual(odds);
  });

  test('nothing is counted in the hurried mode, where nobody is reading: no odds, and none written', () => {
    const app = atBriefing(threeBuilds(), 'lumen-4', { fast: true });
    frames(app, 30);
    expect(oddsOf(app)).toBeNull();
    toRow(app, 'build');
    expect(drawn(app).texts.filter((t) => /ODDS/.test(t.text))).toEqual([]);
  });

  test('none for a drill, which is flown in the simulator\'s machine', () => {
    const app = reading(threeBuilds());
    select(app, 'training');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    frames(app, 30);
    expect(oddsOf(app)).toBeNull();
    expect(drawn(app).texts.filter((t) => /ODDS/.test(t.text))).toEqual([]);
  });
});

describe('the count is of what is showing', () => {
  test('another build is another count, of that build; what was counted is kept for when the pilot turns back', () => {
    const app = atBriefing(threeBuilds());
    const offer = showing(app);
    const onFloor = countOut(app);
    toRow(app, 'build');
    press(app, 'right');
    // The bastion saved first: nothing counted yet, and its count is its own.
    expect(oddsOf(app)).toEqual({ played: 0, won: 0, done: false });
    const bastion = app.prospect(offer, null, 0)!;
    expect(bastion.fight.build).toEqual(BASTION);
    frames(app, 40);
    expect(oddsOf(app)).toEqual({ ...goes(bastion, 40).tally, done: false });
    // Turned away from half way and turned back to: it goes on from where it was.
    press(app, 'left');
    expect(oddsOf(app)).toEqual(onFloor);
    frames(app, 25);
    expect(oddsOf(app)).toEqual(onFloor);
    press(app, 'right');
    expect(oddsOf(app)).toEqual({ ...goes(bastion, 40).tally, done: false });
    expect(countOut(app)).toEqual({ ...counts(bastion), done: true });
    // The sharpshooter saved second is a third count.
    press(app, 'right');
    const sharp = app.prospect(offer, null, 1)!;
    expect(sharp.fight.build).toEqual(SHARP);
    expect(countOut(app)).toEqual({ ...counts(sharp), done: true });
    // Round to the floor again: counted already, and shown at once.
    press(app, 'right');
    expect(oddsOf(app)).toEqual(onFloor);
    // The three builds do not fare alike in this one.
    expect(new Set([onFloor.won, counts(bastion).won, counts(sharp).won]).size).toBeGreaterThan(1);
  });

  test('hiring a wingman is another count, with the wingman firing; sending them home shows the first again', () => {
    const app = atBriefing(threeBuilds());
    const offer = showing(app);
    toRow(app, 'build');
    press(app, 'right', 'right');
    const alone = countOut(app);
    toRow(app, 'wingman');
    press(app, 'right');
    expect((snap(app).briefing as unknown as { wingman: { id: string | null } }).wingman.id).toBe('kite');
    expect(oddsOf(app)).toEqual({ played: 0, won: 0, done: false });
    const crewed = app.prospect(offer, 'kite', 1)!;
    expect(crewed.mission.battles.every((battle) => battle.support?.name === 'Kite')).toBe(true);
    expect(crewed.fight.build).toEqual(SHARP);
    expect(countOut(app)).toEqual({ ...counts(crewed), done: true });
    // Kite's fire tells: the sharpshooter fares better with it than alone.
    expect(counts(crewed).won).toBeGreaterThan(alone.won);
    press(app, 'left');
    expect(oddsOf(app)).toEqual(alone);
  });

  test('the other side\'s offer is another fight and another count', () => {
    // A later telling, where the first contract of the story has two offers.
    const again: GameState = { ...quiet(wearing(fresh(), DUELLIST)), cycle: 1, completed: ['intro-1', 'intro-2'], scenes: ['act-1', 'again-1'] };
    const app = atBriefing(again, 'hadron-1');
    expect(ids(app)).toContain('other');
    const first = showing(app);
    const firstOdds = countOut(app);
    expect(firstOdds).toEqual({ ...counts(app.prospect(first, null, null)!), done: true });
    select(app, 'other');
    const other = showing(app);
    expect(other).not.toBe(first);
    expect(oddsOf(app)).toEqual({ played: 0, won: 0, done: false });
    const otherOdds = countOut(app);
    expect(otherOdds).toEqual({ ...counts(app.prospect(other, null, null)!), done: true });
    expect(otherOdds.won).not.toBe(firstOdds.won);
    // And back: the first offer's odds were kept.
    select(app, 'other');
    expect(oddsOf(app)).toEqual(firstOdds);
  });
});

describe('what is counted is the fight that follows', () => {
  /** What a battle is, however far it has got: who is in it with what, how strong the enemy is, and who fires in support. */
  const fought = (state: BattleState) => ({
    units: state.units.map((unit) => ({
      id: unit.id, build: unit.build, mods: unit.mods, overdrive: unit.overdrive,
      armour: Object.fromEntries(Object.entries(unit.parts).map(([slot, part]) => [slot, part?.maxAp])),
    })),
    enemyScale: state.enemyScale, support: state.support?.name ?? null, objective: state.objective,
  });
  const battleOf = (app: App): BattleState => (app as unknown as { current: { flow: { state: BattleState } } }).current.flow.state;

  test('accepting starts exactly what was counted: the build chosen, the wingman hired, the perks, the bench, the Overdrive and the difficulty', () => {
    const seasoned = threeBuilds({
      xp: xpForLevel(7), overdrive: 'iron-skin', perks: { marksman: 2, plating: 1 }, tuning: { [SHARP.generator!]: 1 },
      settings: { ...fresh().settings, difficulty: 'veteran' },
    });
    const app = atBriefing(seasoned);
    const offer = showing(app);
    toRow(app, 'build');
    press(app, 'right', 'right');
    toRow(app, 'wingman');
    press(app, 'right');
    const prospect = app.prospect(offer, 'kite', 1)!;
    expect(countOut(app)).toEqual({ ...counts(prospect), done: true });
    // Each of them is in what was counted.
    expect(prospect.fight.build).toEqual(SHARP);
    expect(prospect.fight.opts.enemyScale).toBe((offer.scale ?? 1) * DIFFICULTY_SCALE.veteran);
    expect(prospect.fight.opts.overdrive).toBe('iron-skin');
    expect(prospect.fight.opts.mods).toMatchObject({ aim: perkEffects({ marksman: 2 }, PERKS).aim, armour: perkEffects({ plating: 1 }, PERKS).armour, tune: { [SHARP.generator!]: 1 } });
    expect(perkEffects({ marksman: 2 }, PERKS).aim).toBeGreaterThan(0);
    // And the battle that accepting starts is that fight, begun with the app's own seed.
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    const seed = (app as unknown as { seed: number }).seed;
    expect(fought(battleOf(app))).toEqual(fought(startFight(prospect.fight, prospect.mission, 0, CATALOG, seed)));
    expect(fought(battleOf(app)).support).toBe('Kite');
    expect(app.game!.build).toEqual(SHARP);
  });

  test('the battles after the first are begun from the same fight, each from the one before as it ended', () => {
    const { app } = inHub(threeBuilds());
    select(app, 'contracts');
    select(app, 'lumen-4');
    const contract = showing(app);
    expect(contract.battles).toHaveLength(2);
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ index: 0, of: 2 });
    autoBattle(app);
    expect(snap(app).battle!.outcome).toBe('victory');
    const ended = battleOf(app);
    const seed = (app as unknown as { seed: number }).seed;
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ index: 1, of: 2 });
    const second = startFight(app.fight(contract), contract, 1, CATALOG, seed, ended);
    expect(fought(battleOf(app))).toEqual(fought(second));
    // Not the first battle over again: other machines, and the mech as the first battle left it.
    expect(second.units.slice(1).map((unit) => unit.name)).not.toEqual(startFight(app.fight(contract), contract, 0, CATALOG, seed).units.slice(1).map((unit) => unit.name));
    expect(snap(app).player!.maxAp).toBe(second.units[0].parts.core!.maxAp + second.units[0].parts.head!.maxAp + second.units[0].parts.arms!.maxAp + second.units[0].parts.legs!.maxAp);
  });

  test('a mirror match in a saved build is counted against a mirror of that build', () => {
    const app = reading(threeBuilds());
    select(app, 'arena');
    select(app, 'mirror');
    expect(snap(app).screen).toBe('briefing');
    const offer = showing(app);
    expect(app.prospect(offer, null, null)!.fight.enemies.mirror.build).toEqual(DUELLIST);
    toRow(app, 'build');
    press(app, 'right');
    const mirrored = app.prospect(offer, null, 0)!;
    expect(mirrored.fight.build).toEqual(BASTION);
    expect(mirrored.fight.enemies.mirror.build).toEqual(BASTION);
    expect(countOut(app)).toEqual({ ...counts(mirrored), done: true });
    // Nothing was fitted to count it: the build on the floor is the one it was.
    expect(app.game!.build).toEqual(DUELLIST);
  });

  test('what a fight is made of, piece by piece: perks, the bench, the difficulty and the Overdrive; a lent mech and a drill bring their own', () => {
    const plain = threeBuilds();
    const { app } = inHub(plain);
    select(app, 'contracts');
    select(app, 'lumen-4');
    const offer = showing(app);
    const none = perkEffects({}, PERKS);
    const bare = { aim: none.aim, evasion: none.evasion, energy: none.energy, cooling: none.cooling, repairs: none.repairs, armour: none.armour };
    // A pilot with nothing: the build on the floor, the book's enemies, no bench work and no Overdrive.
    expect(app.fight(offer)).toEqual({ build: DUELLIST, enemies: app.enemies(), opts: { enemyScale: offer.scale ?? 1, mods: bare } });
    // Perks, each on its own figure.
    const perked = app.fight(offer, { ...plain, perks: { marksman: 1, plating: 2 } });
    expect(perked.opts.mods).toEqual({ ...bare, aim: perkEffects({ marksman: 1 }, PERKS).aim, armour: perkEffects({ plating: 2 }, PERKS).armour });
    // The bench's work goes along as it is kept; none at all is no word about it.
    expect(app.fight(offer, { ...plain, tuning: { 'gen-kd1': 2 } }).opts.mods).toEqual({ ...bare, tune: { 'gen-kd1': 2 } });
    expect(app.fight(offer, { ...plain, tuning: {} }).opts.mods).toEqual(bare);
    // The Overdrive is the one the pilot flies with; the meter starts empty.
    const levelled = { ...plain, xp: xpForLevel(9), overdrive: 'deadeye' as const };
    expect(fittedOverdrive(levelled)).toBe('deadeye');
    expect(fittedOverdrive(plain)).not.toBe('deadeye');
    expect(app.fight(offer, levelled).opts.overdrive).toBe('deadeye');
    expect(app.fight(offer, levelled).drive).toBeUndefined();
    // A contract that brings an Overdrive of its own brings it whatever the pilot flies with, and its meter as full as it says.
    const brought = app.fight({ ...offer, overdrive: { kind: 'iron-skin', drive: 50 } }, levelled);
    expect([brought.opts.overdrive, brought.drive]).toEqual(['iron-skin', 50]);
    // A pilot too green to have one has none, and no word about it.
    expect(app.fight(offer, { ...plain, xp: 0 }).opts).toEqual({ enemyScale: offer.scale ?? 1, mods: bare });
    // Another build fitted: that build, and a mirror of it.
    const other = app.fight(offer, { ...plain, build: BASTION });
    expect(other.build).toEqual(BASTION);
    expect(other.enemies.mirror.build).toEqual(BASTION);
    // A contract's own scale is multiplied by the difficulty.
    expect(app.fight({ ...offer, scale: 1.5 }).opts.enemyScale).toBe(1.5);
    // A lent mech is flown as the factory made it: the pilot's perks, not the pilot's bench.
    const lent = app.fight({ ...offer, loaner: STARTER_BUILD }, { ...plain, perks: { marksman: 1 }, tuning: { 'gen-kd1': 2 } });
    expect(lent.build).toEqual(STARTER_BUILD);
    expect(lent.opts.mods).toEqual({ ...bare, aim: perkEffects({ marksman: 1 }, PERKS).aim });
  });

  test('the difficulty set scales the enemy of a contract, and not of a drill; a drill has no perks and may hand over a full meter', () => {
    const hard = threeBuilds({ xp: xpForLevel(9), perks: { marksman: 2 }, settings: { ...fresh().settings, difficulty: 'veteran' } });
    const { app } = inHub(hard);
    select(app, 'contracts');
    select(app, 'lumen-4');
    const offer = showing(app);
    expect(app.fight(offer).opts.enemyScale).toBe((offer.scale ?? 1) * 1.2);
    press(app, 'cancel', 'cancel');
    select(app, 'training');
    for (let i = 0; i < 30 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'drill-overdrive'; i++) press(app, 'down');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    const drill = showing(app);
    expect(drill.id).toBe('drill-overdrive');
    const fight = app.fight(drill);
    expect(fight.opts).toEqual({ enemyScale: drill.scale ?? 1, overdrive: 'second-wind' });
    expect(fight.drive).toBe(100);
    expect(fight.build).toEqual(drill.loaner);
    // No odds for it: it is not flown in a build of the pilot's.
    expect(app.prospect(drill, null, null)).toBeNull();
  });

  test('no odds where nothing would start: a slot that cannot be flown from, and a build that may not deploy', () => {
    const { app } = inHub(threeBuilds());
    select(app, 'contracts');
    select(app, 'lumen-4');
    const offer = showing(app);
    expect(app.prospect(offer, null, null)).not.toBeNull();
    expect(app.prospect(offer, null, 2)).toBeNull();
    expect(app.prospect(offer, null, 7)).toBeNull();
    // The build on the floor with its weapons taken off may not deploy.
    const unarmed = { ...threeBuilds(), build: { ...DUELLIST, rightHand: undefined, leftHand: undefined, shoulder: undefined } };
    const stripped = inHub(unarmed).app;
    expect(stripped.buildErrors().length).toBeGreaterThan(0);
    expect(stripped.prospect(offer, null, null)).toBeNull();
    // A saved build that may deploy still has its odds.
    expect(stripped.prospect(offer, null, 0)!.fight.build).toEqual(BASTION);
    // What may deploy is judged with the bench's work counted: a generator the bench has worked on carries what it could not as sold.
    const hungry = { ...STARTER_BUILD, head: 'head-auditor', core: 'core-sterling', arms: 'arms-shrike', fcs: 'fcs-omni', rightHand: undefined, shoulder: 'wpn-sunlance' };
    const benched = inHub({ ...wearing(threeBuilds(), hungry), tuning: { 'gen-kd1': 1 } }).app;
    expect(benched.buildErrors()).toEqual([]);
    expect(benched.prospect(offer, null, null)!.fight.build).toEqual(hungry);
    expect(inHub(wearing(threeBuilds(), hungry)).app.prospect(offer, null, null)).toBeNull();
  });
});

describe('the count takes what a frame can spare', () => {
  /** A clock that moves on by so much every time it is read. */
  const clock = (step: number): (() => number) => { let at = 1000; return () => { at += step; return at; }; };

  test('where the time can be told it works on while there is time: up to eight goes a frame, and never less than one', () => {
    expect([ODDS_BUDGET_MS, ODDS_GOES]).toEqual([4, 8]);
    const game = threeBuilds();
    // A clock that stands still: there is always time, so every frame works the most it may.
    const quick = atBriefing(game, 'lumen-4', { now: () => 1000 });
    const prospect = quick.prospect(showing(quick), null, null)!;
    frames(quick, 3);
    expect(oddsOf(quick)).toEqual({ ...goes(prospect, 3 * ODDS_GOES).tally, done: false });
    // A clock that jumps past the budget between readings: one go a frame, as without a clock.
    const slow = atBriefing(game, 'lumen-4', { now: clock(5) });
    frames(slow, 24);
    expect(oddsOf(slow)).toEqual({ ...goes(prospect, 24).tally, done: false });
    // A millisecond a reading: the budget of four is used up after four goes.
    const steady = atBriefing(game, 'lumen-4', { now: clock(1) });
    frames(steady, 6);
    expect(oddsOf(steady)).toEqual({ ...goes(prospect, 6 * 4).tally, done: false });
    expect(goes(prospect, 24).tally.played).toBeGreaterThan(0);
  });

  test('however it is sliced, the odds come out the same, and a count that is done costs nothing more', () => {
    const game = threeBuilds();
    const reads = { n: 0 };
    const quick = atBriefing(game, 'lumen-4', { now: () => { reads.n += 1; return 1000; } });
    const plain = atBriefing(game);
    const odds = countOut(quick);
    expect(odds).toEqual(countOut(plain));
    const before = reads.n;
    frames(quick, 10);
    expect(reads.n).toBe(before);
  });
});

describe('where the odds are written', () => {
  test('in the corner, under the kind of machine: dim while they are counted, then in the colour of the odds', () => {
    const app = atBriefing(threeBuilds());
    // Before the first flight is over there is nothing to say yet.
    let line = written(drawn(app), 'ODDS ..');
    expect(line).toMatchObject({ y: 30, right: LOGICAL_W - 12, align: 'right', color: COLORS.dim, size: 12 });
    frames(app, 12);
    const part = oddsOf(app)!;
    expect(part.done).toBe(false);
    expect(part.played).toBeGreaterThan(0);
    line = written(drawn(app), `ODDS ${part.won}/${part.played}`);
    expect(line).toMatchObject({ y: 30, right: LOGICAL_W - 12, color: COLORS.dim });
    const odds = countOut(app);
    line = written(drawn(app), `ODDS ${odds.won}/20`);
    expect(line).toMatchObject({ y: 30, right: LOGICAL_W - 12, color: oddsColor(odds) });
    // Under the name of the class, a line below it, and above the client's tag.
    const name = written(drawn(app), 'DUELLIST');
    expect(line.y - name.y).toBe(LINE);
    expect(line.y + LINE).toBeLessThanOrEqual(41);
  });

  test('good odds, fair odds and poor odds each have their colour', () => {
    expect([ODDS_GOOD, ODDS_FAIR]).toEqual([0.75, 0.4]);
    // Wins first, then flights.
    expect(B.odds(3, 7)).toBe('ODDS 3/7');
    const colour = (won: number) => oddsColor({ played: 20, won });
    expect([20, 15].map(colour)).toEqual([COLORS.armor, COLORS.armor]);
    expect([14, 8].map(colour)).toEqual([COLORS.heat, COLORS.heat]);
    expect([7, 0].map(colour)).toEqual([COLORS.danger, COLORS.danger]);
    expect(new Set([COLORS.armor, COLORS.heat, COLORS.danger, COLORS.dim]).size).toBe(4);
  });

  test('on the page about the build, with what they are: under what it carries and above the hint', () => {
    const app = atBriefing(threeBuilds());
    toRow(app, 'build');
    const odds = countOut(app);
    const shown = drawn(app);
    const lines = shown.texts.filter((t) => t.text === `ODDS ${odds.won}/20`).sort((a, b) => a.y - b.y);
    expect(lines.map((t) => t.y)).toEqual([30, 165]);
    expect(lines[1]).toMatchObject({ left: 12, color: oddsColor(odds) });
    const note = written(shown, ': this contract flown on Auto Turn');
    expect(note).toMatchObject({ y: 165, color: COLORS.dim });
    expect(note.left).toBe(12 + Math.round(`ODDS ${odds.won}/20`.length * CHAR_W));
    // Below the last thing the build carries, and clear of the hint.
    const module = shown.texts.find((t) => t.text === STRINGS.garage.slotTags.module)!;
    const hint = written(shown, B.buildHint);
    expect(lines[1].y).toBeGreaterThanOrEqual(module.y - 1 + LINE);
    expect(hint.y - lines[1].y).toBeGreaterThanOrEqual(LINE);
    // While it is still being counted the page says so in the same place, dim.
    press(app, 'right');
    frames(app, 30);
    const part = oddsOf(app)!;
    expect(part.done).toBe(false);
    const counting = drawn(app).texts.filter((t) => t.y === 165);
    expect(counting.map((t) => [t.text, t.color])).toEqual([
      [part.played === 0 ? 'ODDS ..' : `ODDS ${part.won}/${part.played}`, COLORS.dim], [': this contract flown on Auto Turn', COLORS.dim],
    ]);
  });

  test('nothing in the header runs into anything else, with the longest client there is, in both languages', () => {
    for (const language of ['en', 'nl'] as const) {
      // Director Brenn of Hadron Mining has the longest line a client has.
      const hadron = threeBuilds({ completed: ['intro-1', 'intro-2'] });
      const app = atBriefing(hadron, 'hadron-1');
      setLanguage(language);
      countOut(app);
      const S = language === 'nl' ? STRINGS_NL : STRINGS;
      const shown = drawn(app);
      const header = shown.texts.filter((t) => t.y < 66);
      const line = header.find((t) => t.text === S.briefing.odds(oddsOf(app)!.won, 20))!;
      expect(line, language).toBeDefined();
      // Rows that are not the same row can still share height: a line is as tall as its letters, and no taller than a row.
      const tall = (t: Written): number => Math.min(t.size, LINE);
      const clash = (a: Written, b: Written): boolean => a.y < b.y + tall(b) && b.y < a.y + tall(a) && a.left < b.right && b.left < a.right;
      for (const other of header) if (other !== line) expect(clash(line, other), `${language}: "${line.text}" and "${other.text}"`).toBe(false);
      for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `${language}: "${a.text}" and "${b.text}"`).toBe(false);
      // The odds at their widest are ten letters; the longest client line, thirty.
      expect(S.briefing.odds(20, 20).length).toBe(10);
      expect(72 + 30 * CHAR_W).toBeLessThan(LOGICAL_W - 12 - 10 * CHAR_W - 8);
      setLanguage('en');
    }
  });

  test('in Dutch: the odds, the dots while nothing is counted, and what they are', () => {
    const app = atBriefing(threeBuilds());
    setLanguage('nl');
    expect(written(drawn(app), 'KANS ..').y).toBe(30);
    toRow(app, 'build');
    const odds = countOut(app);
    const shown = drawn(app);
    expect(shown.texts.filter((t) => t.text === `KANS ${odds.won}/20`).map((t) => t.y).sort((a, b) => a - b)).toEqual([30, 165]);
    expect(written(shown, ': dit contract op Auto-beurt').y).toBe(165);
    expect(shown.texts.some((t) => /ODDS/.test(t.text))).toBe(false);
    expect(STRINGS_NL.briefing.odds(3, 7)).toBe('KANS 3/7');
  });
});
