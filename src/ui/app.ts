import { adviceAfter, type Advice } from '../core/advice';
import {
  CUPS, MIRROR_ID, arenaMission, checkChallenge, cupMission, cupOpen, isCup, mirrorEnemy, mirrorMission, mirrorOpen, recordArenaWin, recordCupWin, recordMirrorWin,
} from '../core/arena';
import { askSettlement, generateBoard, swarmContract } from '../core/board';
import { validatePlayerBuild } from '../core/build';
import {
  archiveMissions, availableMissions, campaignComplete, completeMission, decide, dueScenes, settleOldStory, forCycle, introductionsDone, lentPatrol, otherOffer, markRead,
  markSceneSeen, startNewCycle, stockFor, unreadMessages, LESSONS,
  type Mission, type Scene,
} from '../core/campaign';
import { isFind, metByRecord, openEntries, type Entry, type Find } from '../core/codex';
import { applySettlement, debtRelief, settle, type Settlement } from '../core/economy';
import { MEDAL_PAY, awardMedals, type Medal, type Tier } from '../core/medals';
import {
  TEXT_FACTOR, DEFAULT_SETTINGS, DIFFICULTY_SCALE, LIGHT_DETAILS, ensureArmed, learn, newGame, type GameState, type LightDetail, type Settings,
} from '../core/game';
import { ARCHETYPES, archetypeOf, recordWinAs, type Archetype } from '../core/archetype';
import { crownHeld, crownSettlement, isMaster, masterMission, mastersOpen, parseMaster, recordMasterWin } from '../core/masters';
import { startFight, type Fight } from '../core/mission';
import { fitSortie, sortieBuilds, type Sortie } from '../core/sortie';
import { wingmanFor, withWingman, type Wingman } from '../core/wingman';
import { WINGMEN } from '../content/wingmen';
import { intentOf } from '../core/intent';
import { intentText } from './tags';
import { addXp, buyPerk, checkBuyPerk, levelFor, perkEffects, xpForContract } from '../core/pilot';
import { nameRank } from '../core/renown';
import { missionPar, performanceOf, rankSettlement, recordRank } from '../core/rank';
import { NO_STATS, addStats, contractStats, retreated, tallyBattle, type Stats } from '../core/stats';
import {
  SPAR_ENEMY, isRange, parseRange, parseSpar, rangeKinds, rangeLimit, rangeMission, rangeSettlement, sparEnemy, sparMission, sparSlots,
} from '../core/range';
import { drillMission, drillOpen, drillPassed, drillSettlement, isDrill, recordDrill, type Drill } from '../core/training';
import { tunedCatalog, type Tuning } from '../core/tuning';
import type { BuildError, Catalog, EnemyDef, Part } from '../core/types';
import { ALL_ENEMIES, ARENA } from '../content/arena';
import { masterOf } from '../content/masters';
import { BOARD_TEXT } from '../content/board';
import { UNITS, WORLD } from '../content/codex';
import { FINDS } from '../content/finds';
import { DRILLS, LESSON_LINES } from '../content/drills';
import { MEDALS } from '../content/medals';
import { MESSAGES, MISSIONS } from '../content/missions';
import { PERKS } from '../content/perks';
import { SCENES } from '../content/scenes';
import { SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../content/parts';
import { starterOf } from '../content/starters';
import { SONGS } from '../content/songs';
import { STRINGS } from '../content/strings';
import type { Sfx, SoundName } from '../platform/audio';
import { HUSH, type TrackName } from '../platform/music';
import type { InputAction } from '../platform/input';
import { MAX_TRIES, SLOTS, type SaveFile } from '../platform/storage';
import { ArenaScreen, MIRROR } from './arenaScreen';
import { BattleFlow, BattleScreen } from './battleScreen';
import { BriefingScreen } from './briefingScreen';
import { CallsignScreen } from './callsignScreen';
import { StarterScreen } from './starterScreen';
import { CreditsScreen } from './creditsScreen';
import { DatabaseScreen } from './databaseScreen';
import { LOGICAL_H, LOGICAL_W } from './display';
import { GarageScreen } from './garageScreen';
import { HubScreen } from './hubScreen';
import type { ListItem } from './menuList';
import { MessagesScreen } from './messagesScreen';
import { OptionsScreen } from './optionsScreen';
import { PilotScreen } from './pilotScreen';
import { SceneScreen } from './sceneScreen';
import { TalkScreen } from './talkScreen';
import { setLanguage } from '../content/language';
import '../content/nl';
import { GauntletScreen } from './gauntletScreen';
import {
  descend, doors, enter, fall, floorMission, floorsCleared, isGauntlet, runMods, runOverdrive, runPayout, startRun, take, takeRelic,
  type Door, type Offer, type RelicId, type Run,
} from '../core/gauntlet';
import { GAUNTLET_BUILD, GAUNTLET_TEXT } from '../content/gauntlet';
import { ENEMIES } from '../content/enemies';
import { OVERDRIVES, type BattleState, type OverdriveId } from '../core/battle';
import { fittedOverdrive, overdriveOpen } from '../core/pilot';
import { SettlementScreen } from './settlementScreen';
import { battleTrack, briefingTrack, trackFor } from './soundtrack';
import type { Typing } from './typewriter';
import { ShopScreen } from './shopScreen';
import type { SpriteStore } from './sprites';
import { TitleScreen } from './titleScreen';
import { TrainingScreen } from './trainingScreen';
import { setDetail } from './light';
import { Pace, type Detail } from './pace';
import { COLORS, drawMedal, drawPage, drawPanel, drawText } from './widgets';
import { drawBlind, drawDoors } from './wipe';

/** What a screen reports about itself, for tests and for telling whether an input did anything. */
export interface ScreenView {
  menu: { items: ListItem[]; cursor: number };
  message?: string;
  [key: string]: unknown;
}

export interface Screen {
  update(dtMs: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  onInput(action: InputAction): void;
  view(): ScreenView;
}

export type ScreenName =
  | 'title' | 'callsign' | 'starter' | 'hub' | 'garage' | 'shop' | 'messages' | 'briefing' | 'battle' | 'settlement' | 'scene' | 'ending'
  | 'arena' | 'pilot' | 'options' | 'database' | 'training' | 'credits' | 'gauntlet';

/** One of the kept games as the title shows it: empty, unreadable, or a game. */
export interface SlotView { slot: number; game: GameState | null; unusable: boolean }

/** How much quicker a battle plays with the fast-battles option on. */
export const FAST_BATTLE_SPEED = 2.5;
/** How much soft light each choice is. */
const LEVEL_OF: Record<LightDetail, Detail> = { full: 2, lean: 1, bare: 0 };
/** A handheld whose light was found not to be what it is slow at is left alone for so many sessions, and then judged again. */
export const TRY_AGAIN = 5;
/**
 * How many sessions a handheld that was found slow waits for a chance at the step of light it
 * lost, by how often it has lost that chance already: none the first time (what was found may have
 * been about that day, and not about the handheld), and longer each time after.
 */
export const WAITS = [0, 2, 4, 8];

/** How a session starts: with how much light, whether the handheld is judged in it, and whether it is a chance. */
export interface LightStart {
  level: Detail;
  judge: boolean;
  /** The session is a chance at a step more light than was kept up with: how often that chance was lost before. */
  chance?: { tries: number };
}

/**
 * How much light a session starts with, and whether the handheld is judged in it: all of it and
 * judged, unless an earlier session found something out. Then it starts where that one ended, and
 * counts; when it has waited long enough it starts a step higher, judged, as a chance. What is
 * kept is not changed by a chance until it is seen how that goes: a session closed at once has
 * found nothing out.
 */
export function startingLight(save: Pick<SaveFile, 'loadPace' | 'savePace'>): LightStart {
  const hint = save.loadPace();
  if (!hint) return { level: 2, judge: true };
  const tries = hint.tries ?? 0;
  const wait = hint.held ? TRY_AGAIN : WAITS[Math.min(tries, WAITS.length - 1)];
  if (hint.runs >= wait) return { level: Math.min(2, hint.level + 1) as Detail, judge: true, chance: { tries } };
  save.savePace({ ...hint, runs: hint.runs + 1 });
  return { level: hint.level, judge: hint.held !== true };
}

/** How long the blind over a new screen takes to be drawn off it, and the doors over a battle to open. */
export const FADE_MS = 200;
export const SHUTTER_MS = 320;
/** How long a medal's announcement stays up, and how much of that it spends sliding in and out. */
export const TOAST_MS = 2600;
const TOAST_SLIDE_MS = 180;

/** More medals than this earned at once are announced together. */
const TOASTS_AT_ONCE = 3;
/**
 * The screens with room at the foot for an announcement. Anywhere else it would lie over a line of
 * button hints, a figure or a line of text for as long as it is up, and a battle or a page of story
 * is not interrupted at all: there it waits, and is announced where there is room for it.
 */
const TOAST_ROOM: ScreenName[] = ['hub', 'settlement', 'options'];

/** What the battles of a contract added up to, for the record. */
export interface Fought { tally: Stats; met: string[]; retreated: boolean; overdrives?: number }

/** Something to tell the pilot in passing: a medal earned, the database grown. */
interface Toast {
  id: string;
  heading: string;
  title: string;
  /** Written at the right: what a medal pays. */
  note?: string;
  /** The metal of a medal; an announcement without one is about the database. */
  tier?: Tier;
  sound: SoundName;
}

/** One announcement a medal, or one for all of them when there are many. */
function medalToasts(earned: Medal[]): Toast[] {
  const M = STRINGS.medals;
  if (earned.length > TOASTS_AT_ONCE) {
    const pay = earned.reduce((sum, medal) => sum + MEDAL_PAY[medal.tier], 0);
    const best = Math.max(...earned.map((medal) => medal.tier)) as Tier;
    return [{ id: `medals:${earned.length}`, heading: M.earnedMany, title: M.count(earned.length), note: M.pay(pay), tier: best, sound: 'medal' }];
  }
  return earned.map((medal) => ({ id: medal.id, heading: M.earned, title: medal.name, note: M.pay(MEDAL_PAY[medal.tier]), tier: medal.tier, sound: 'medal' as const }));
}

/** One entry is announced by its title, several as a count. */
function entryToasts(opened: Entry[]): Toast[] {
  const D = STRINGS.database;
  if (opened.length === 0) return [];
  if (opened.length === 1) return [{ id: `entry:${opened[0].id}`, heading: D.toast, title: opened[0].title, sound: 'entry' }];
  return [{ id: `entries:${opened.length}`, heading: D.toast, title: D.newEntries(opened.length), sound: 'entry' }];
}

/** One announcement for a find, by its name, or one for all of them when there are several. */
function findToasts(found: Find[]): Toast[] {
  const D = STRINGS.database;
  if (found.length === 0) return [];
  if (found.length === 1) return [{ id: `find:${found[0].id}`, heading: D.findToast, title: found[0].title, sound: 'entry' }];
  return [{ id: `finds:${found.length}`, heading: D.findToast, title: D.newFinds(found.length), sound: 'entry' }];
}

/** Everything the database opens as the story goes: what comes to light about the world, and what is found. */
const CODEX: Entry[] = [...WORLD, ...FINDS];

/** The part of the music player the app steers. */
export interface MusicControl {
  enabled: boolean;
  /** Set while a battle is going badly for the pilot; the song then ticks faster. */
  tense?: boolean;
  /** How loud the music is beside what it usually is: turned down while something is to be heard above it. */
  hush?: number;
  play(track: TrackName | null): void;
}

export interface AppDeps {
  catalog: Catalog;
  save: SaveFile;
  sprites: SpriteStore;
  sfx?: Sfx;
  music?: MusicControl;
  /** Skips message pauses and effects; used by tests. */
  fast: boolean;
  /** Makes the device vibrate for a number of milliseconds, where it can. */
  vibrate?: (ms: number) => void;
  /** The time, in milliseconds: for work that is done a little a frame and has to stop when its share of the frame is used up. Without it such work does a fixed amount. */
  now?: () => number;
  seed: number;
}

/** A contract in progress: its battles in order, each starting where the last one left the mech. */
class MissionHost implements Screen {
  private index = 0;
  /** Rounds fought in the battles already won. */
  private rounds = 0;
  private flow!: BattleFlow;
  private screen!: BattleScreen;
  /** The contract's outcome, once it has been booked. */
  private settlement: Settlement | null = null;
  /** What the battles already over added to the record, and the kinds of enemy seen in them. */
  private tally: Stats = NO_STATS;
  private met = new Set<string>();
  /** Overdrives set off in the battles already counted. */
  private overdrives = 0;
  /** What there is to say about the battle the contract was lost in; null after a win or a retreat. */
  private tip: Advice | null = null;
  /** What the contract's battles are fought with, as the app said when the battle on screen began. */
  private fought!: Fight;

  constructor(private app: App, private mission: Mission, private seed: number) {
    this.begin();
  }

  private begin(): void {
    const { catalog, sprites, sfx, fast } = this.app.deps;
    const total = this.mission.battles.length;
    // A drill and a floor of the Gauntlet are flown in a machine that is not the pilot's. The range is flown in
    // the pilot's own, and like those two it has the simulator's voice and nobody else's.
    const lent = isDrill(this.mission) || isGauntlet(this.mission);
    const drill = lent || isRange(this.mission);
    // What the contract is fought with is the app's to say: the odds on the briefing were counted from the same.
    this.fought = this.app.fight(this.mission);
    const state = startFight(this.fought, this.mission, this.index, catalog, this.seed, this.index > 0 ? this.flow.state : undefined);
    // Each battle of a contract has its own song: the last one may be against a boss.
    this.app.playTrack(battleTrack(this.mission, this.index, this.app.enemies()));
    // Tests play without the talk: it is words to read, and they have nobody reading.
    // A pilot with a name flies under it: on the banner of every battle that is not a drill, and in the
    // message bar as a battle against ordinary machines opens. They are the ones who have heard it.
    const game = this.app.game;
    const rank = game && !drill ? nameRank(game) : 0;
    const known = rank > 0 ? STRINGS.renown.names[rank - 1].toUpperCase() : null;
    const opening = known && state.open ? STRINGS.renown.opening(known, STRINGS.renown.notes[rank - 1]) : undefined;
    // What Dispatch explains once is explained on a contract: the simulator and the Gauntlet have voices of their own.
    const told = game?.lessons ?? [];
    const lessons = drill ? {} : Object.fromEntries(LESSONS.filter((id) => !told.includes(id)).map((id) => [id, LESSON_LINES[id]]));
    this.flow = new BattleFlow(state, catalog, {
      talk: this.mission.battles[this.index].talk, quiet: fast, cycle: this.app.game?.cycle ?? 0, lessons, ...(opening ? { opening } : {}),
    });
    const battle = this.mission.battles[this.index];
    const boss = battle.enemies.map((id) => this.app.enemies()[id]).find((enemy) => (enemy?.phases?.length ?? 0) > 0);
    if (this.index > 0) this.app.openShutter();
    this.screen = new BattleScreen(this.flow, sprites, catalog, {
      fast, sfx, speed: this.app.settings.fastBattles ? FAST_BATTLE_SPEED : 1, paint: lent ? undefined : this.app.game!.paint,
      title: this.mission.title.toUpperCase(), rumble: (ms) => this.app.rumble(ms), jingle: (won) => this.app.jingle(won),
      ...(boss ? { boss: boss.name } : {}),
      ...(known && game?.callsign ? { pilot: STRINGS.renown.banner(game.callsign, known) } : {}),
      coach: this.coach,
      typing: this.app.typing(), calm: this.app.settings.calm === true,
      ...(this.radio() ? { radio: this.radio()! } : {}),
      background: this.mission.battles[this.index].background,
      label: total > 1 ? STRINGS.mission.engagement(this.index + 1, total) : '',
      resultHint: this.hasNext() ? STRINGS.mission.next : STRINGS.hints.result,
    });
  }

  /** The hired wingman flying along on this battle, and what they say on the radio. An ally of the story's own keeps quiet. */
  private radio(): { who: string; lines: Wingman['radio'] } | undefined {
    // Only a wingman who was hired takes orders: that is how one is told from an ally of the story.
    const support = this.flow.state.support;
    const wingman = support?.orders ? WINGMEN.find((w) => w.name === support.name) : undefined;
    return wingman ? { who: wingman.name, lines: wingman.radio } : undefined;
  }

  /** True for a pilot who has not finished the introductions of a first story: they are told which button does what. */
  private get coach(): boolean {
    const game = this.app.game;
    return !!game && game.cycle === 0 && !introductionsDone(game, MISSIONS);
  }

  /** How much stronger or weaker than the book the enemy is in this contract. */
  private enemyScale(): number {
    return this.fought.opts.enemyScale ?? 1;
  }

  /** True when winning the current battle leads to another one. */
  private hasNext(): boolean {
    return this.index + 1 < this.mission.battles.length;
  }

  /**
   * Books the contract the moment its last battle is decided, while the result is still being
   * shown. Closing the game there can then neither lose a reward nor dodge a bill.
   */
  private bookIfOver(): void {
    const { outcome } = this.flow.state;
    if (this.settlement || outcome === 'ongoing' || (outcome === 'victory' && this.hasNext())) return;
    // After a defeat Dispatch has a word about what went wrong in the battle that was lost.
    this.tip = adviceAfter(this.flow.state);
    if (isGauntlet(this.mission)) {
      // A floor bills nothing and pays nothing by itself: the run is paid when it ends.
      this.settlement = { won: outcome === 'victory', reward: 0, ammoCost: 0, repairCost: 0, net: 0, lines: [] };
      this.app.bookGauntlet(this.flow.state);
      return;
    }
    if (isDrill(this.mission)) {
      // The simulator bills nothing and counts for nothing but the list of drills passed.
      this.settlement = drillSettlement(outcome === 'victory', this.mission);
      this.app.bookDrill(this.settlement, this.mission);
      return;
    }
    const { payBonus, costDiscount } = this.app.perks();
    if (isRange(this.mission)) {
      // The range bills, pays and counts nothing: the bill is what a real flight would have cost, and it is only shown.
      this.settlement = rangeSettlement(settle(this.flow.state, 0, this.app.deps.catalog, { payBonus: 0, costDiscount }));
      return;
    }
    const bill = settle(this.flow.state, this.mission.reward, this.app.deps.catalog, { payBonus, costDiscount });
    const performance = performanceOf(this.flow.state, this.rounds + this.flow.state.round, missionPar(this.mission));
    // A contract that asked for a class pays more to a pilot who won it as one; a master beaten in a machine of
    // their own class gives up the crown, which the bill says before the win is written down.
    const flown = this.app.flownAs(this.mission);
    const settlement = crownSettlement(askSettlement(rankSettlement(bill, performance), this.mission, flown), this.mission, flown, this.app.game!);
    this.count();
    const relief = this.app.bookSettlement(settlement, this.mission, { tally: this.tally, met: [...this.met], retreated: retreated(this.flow.state), overdrives: this.overdrives });
    // What the debt limit wrote off is shown with the bill.
    this.settlement = relief > 0 ? { ...settlement, relief } : settlement;
  }

  /** Adds the battle that has just ended to what the contract has added up to. */
  private count(): void {
    this.tally = addStats(this.tally, tallyBattle(this.flow.state));
    // Whatever was on the field was met, what joined later included.
    for (const unit of this.flow.state.units) if (unit.side === 'enemy' && unit.kind) this.met.add(unit.kind);
    this.overdrives += this.flow.state.events.filter((event) => event.type === 'overdrive').length;
  }

  update(dtMs: number): void {
    this.screen.update(dtMs);
    this.keepLessons();
    this.bookIfOver();
  }

  /**
   * What the pilot has just been told is kept at once: closing the game in the middle of that fight does not bring
   * the line back. (Asked every frame: what the kept game already holds changes nothing and saves nothing.)
   */
  private keepLessons(): void {
    this.app.learn(this.flow.taught);
  }

  draw(ctx: CanvasRenderingContext2D): void { this.screen.draw(ctx); }

  /** True while the last machine of a battle is looked at from close by: the music is turned down for it. */
  get closeLook(): boolean {
    return this.screen.closeLook;
  }

  /** True while the pilot's core is nearly gone and the battle is still on: the music is told. */
  get tense(): boolean {
    const core = this.flow.state.units[0].parts.core;
    return this.flow.state.outcome === 'ongoing' && !!core && core.ap > 0 && core.ap < core.maxAp * 0.35;
  }

  onInput(action: InputAction): void {
    if (this.flow.phase !== 'result') {
      this.screen.onInput(action);
      this.bookIfOver();
      return;
    }
    if (action !== 'confirm') return;
    // A floor of the Gauntlet has no bill to show: straight back to the run, and what is on offer.
    if (this.settlement && isGauntlet(this.mission)) this.app.go('gauntlet');
    else if (this.settlement) this.app.showSettlement(this.settlement, this.mission, this.tip);
    else {
      this.rounds += this.flow.state.round;
      this.count();
      this.index += 1;
      this.begin();
    }
  }

  view(): ScreenView {
    const { flow } = this;
    const player = flow.state.units[0];
    return {
      menu: flow.menu,
      player: {
        maxAp: Object.values(player.parts).reduce((sum, part) => sum + (part?.maxAp ?? 0), 0), repairsLeft: player.repairsLeft,
        // How hard the mech hits, against the plain figure: 1 unless something about the run or the contract changes it.
        damage: player.mods.damage,
      },
      message: flow.message,
      // A line of talk holds its place for a moment: a press then is passed over, not refused.
      busy: this.screen.holding,
      battle: {
        banner: this.screen.banner, typing: this.screen.typing,
        // The options the battle is fought with, as they reached the field.
        calm: this.screen.calm, pace: this.screen.pace,
        // What is being staged: the Overdrive's band while it is up, and the close look at the last machine to fall.
        cutIn: this.screen.motion.cutIn, finish: this.screen.motion.finish !== null,
        phase: flow.phase, outcome: flow.state.outcome, round: flow.state.round, message: flow.message,
        mission: this.mission.id, index: this.index, of: this.mission.battles.length, enemyScale: this.enemyScale(),
        targetId: flow.targetId, targetPart: flow.targetPart, shown: flow.eventsShown,
        objective: flow.objective?.text ?? null, spoken: flow.spoken?.text ?? null, replay: !!this.mission.replay,
        enemies: flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed).map((u) => u.kind ?? u.id),
        support: flow.state.support?.name ?? null,
        // What the hired wingman is saying on the radio, if anything.
        radio: this.screen.radioLine,
        coach: this.coach,
        ground: flow.state.ground?.id ?? null,
        // The elites on the field, and what sets each apart.
        elites: flow.state.units.flatMap((u) => (u.mark && !u.destroyed ? [{ id: u.id, mark: u.mark }] : [])),
        // The Overdrive's meter, for a mech that has one.
        drive: flow.state.units[0].overdrive ? { kind: flow.state.units[0].overdrive, value: flow.state.units[0].drive } : null,
        // What the enemy being aimed at is about to do.
        intent: intentText(intentOf(flow.state, flow.state.units.find((u) => u.id === flow.targetId) ?? flow.state.units[0], this.app.deps.catalog)),
        enemyArmour: Object.values(flow.state.units[1].parts).reduce((sum, part) => sum + (part?.maxAp ?? 0), 0),
      },
    };
  }
}

/** Owns the game state and the current screen, and moves between screens. */
export class App {
  game: GameState | null = null;
  /** True when the last attempt to save was refused by the device. */
  saveFailed = false;
  /** True while the options as they are now have not been stored: storing them is tried again with every save. */
  private settingsUnsaved = false;
  /**
   * How long the title has been looked at this session. The title is built anew every time it is
   * come back to, and goes on from here: its sign comes on once, not at every return from the
   * options, and its weather does not start over.
   */
  titleClock = 0;
  /** How well the handheld keeps up, and so how much soft light there is when that is left to the game. */
  private pace: Pace;
  /** A session that is a chance at more light: the light it began with, how often the chance was lost before, and whether it has been kept so far. */
  private chance: { level: Detail; tries: number; kept: boolean } | null = null;
  /** Sound, music and battle speed. Stored on their own, so they exist before a game does. */
  settings: Settings;
  private name: ScreenName = 'title';
  private current!: Screen;
  private seed: number;
  /** The kept game being played: every save goes there. */
  private file: SaveFile;
  /** The way the current screen is still coming into view: what is left of it and how long it takes. */
  private entering = { left: 0, total: 1, shutter: false };
  /** What has not been announced yet, and what is being announced with the time it has left. */
  private toasts: Toast[] = [];
  private toast: { item: Toast; left: number } | null = null;
  /** Time played since the record was last brought up to date, in milliseconds. */
  private played = 0;

  constructor(readonly deps: AppDeps) {
    this.seed = deps.seed;
    this.file = deps.save.forSlot(deps.save.lastSlot());
    this.settings = deps.save.loadSettings() ?? { ...DEFAULT_SETTINGS, ...(this.file.load()?.settings ?? {}) };
    // A hurried game is not judged, and neither is one whose player has said how much light there is to be.
    const from: LightStart = deps.fast || this.settings.detail ? { level: 2, judge: true } : startingLight(deps.save);
    this.pace = new Pace(from.level, from.judge);
    if (from.chance) this.chance = { level: from.level, tries: from.chance.tries, kept: false };
    this.applySettings();
    this.show('title', new TitleScreen(this));
  }

  /** Puts a screen up and picks the music that goes with it. A battle picks its own as it begins. */
  private show(name: ScreenName, screen: Screen, track: TrackName = trackFor(name)): void {
    this.current = screen;
    this.name = name;
    // What the handheld made of the screen before says nothing about this one.
    this.pace.moved();
    if (name !== 'battle') this.playTrack(track);
    if (name === 'battle') this.openShutter();
    else if (!this.deps.fast) this.entering = { left: FADE_MS, total: FADE_MS, shutter: false };
  }

  /** A battle comes into view from behind a shutter that opens from the middle. */
  openShutter(): void {
    if (!this.deps.fast) this.entering = { left: SHUTTER_MS, total: SHUTTER_MS, shutter: true };
  }

  /** Rumbles the handheld, unless the player has turned that off. */
  rumble(ms: number): void {
    if (this.settings.rumble !== false && !this.deps.fast) this.deps.vibrate?.(ms);
  }

  /** How written text is to be written: at the speed the player asked for, or all of it at once. */
  typing(): Typing {
    const speed = this.settings.textSpeed ?? 'normal';
    return { factor: TEXT_FACTOR[speed], instant: !!this.deps.fast || speed === 'instant' };
  }

  playTrack(track: TrackName): void {
    this.deps.music?.play(track);
    // What the pilot has heard is theirs to play again from the database. With the music off nothing is heard.
    if (this.settings.music) this.heardNow.add(track === 'menu' ? 'hub' : track);
  }

  /** Silence, until the next screen asks for its song. */
  stopMusic(): void {
    this.deps.music?.play(null);
  }

  /** The songs heard since the game on now was opened: they go into the save with the next thing that does. */
  private heardNow = new Set<string>();

  /** Every song the pilot has heard, in this sitting or an earlier one. */
  heard(): string[] {
    return [...new Set([...(this.game?.heard ?? []), ...this.heardNow])];
  }

  /** Starts the fanfare for a battle won or lost, if there is music to play it. Says whether it did. */
  jingle(won: boolean): boolean {
    if (!this.deps.music || !this.settings.music) return false;
    this.playTrack(won ? 'victory' : 'defeat');
    return true;
  }

  private applySettings(): void {
    if (this.deps.sfx) this.deps.sfx.muted = !this.settings.sfx;
    if (this.deps.music) this.deps.music.enabled = this.settings.music;
    setLanguage(this.settings.language ?? 'en');
    this.applyLight();
  }

  /** How much soft light is drawn from now on: what the player chose, or else what the handheld keeps up with. */
  private applyLight(): void {
    setDetail(LEVEL_OF[this.lightNow()]);
  }

  /** How much soft light is being drawn. */
  lightNow(): LightDetail {
    return this.settings.detail ?? LIGHT_DETAILS[2 - this.pace.level];
  }

  /**
   * Told how long it has been since the frame before. Where that shows the handheld is not keeping
   * up, a step of light is given up; where giving it up gained nothing, it is put back. What was
   * found is kept for the next session. While the player's own choice holds, nothing is found out.
   */
  frame(gapMs: number): void {
    if (this.deps.fast) return;
    const { save } = this.deps;
    if (!this.pace.frame(gapMs, this.settings.detail === undefined)) {
      // A chance at more light is kept once the handheld has kept up with it for a good while.
      if (this.chance && !this.chance.kept && this.pace.steady) {
        this.chance.kept = true;
        save.savePace(this.chance.level === 2 ? null : { level: this.chance.level, runs: 0 });
      }
      return;
    }
    const { level, judging } = this.pace;
    // Put back: the light was not what it is slow at. Or a step given up; in a session that is a chance the
    // first step given up is the one the chance was at: it is lost, however long it had seemed kept, and
    // that is counted.
    const lost = this.chance;
    if (!judging) save.savePace({ level, runs: 0, held: true });
    else save.savePace({ level, runs: 0, ...(lost ? { tries: Math.min(MAX_TRIES, lost.tries + 1) } : {}) });
    // The chance is over: keeping up with less light for the rest of the session wins nothing back.
    this.chance = null;
    this.applyLight();
  }

  /** How many frames a second the handheld is showing. */
  get fps(): number {
    return this.pace.fps;
  }

  /** The player has handed the light back to the game: it starts from all of it and judges afresh. */
  judgeAfresh(): void {
    this.pace = new Pace();
    this.chance = null;
    this.deps.save.savePace(null);
    this.applyLight();
  }

  /** Changes the options, applies them at once and stores them, with the game when there is one. */
  setSettings(next: Settings): void {
    this.settings = { ...next };
    this.applySettings();
    this.settingsUnsaved = !this.deps.save.saveSettings(this.settings);
    if (this.game) this.commit({ ...this.game, settings: { ...this.settings } });
  }

  openOptions(): void {
    const from = this.name;
    this.show('options', new OptionsScreen(this, () => this.go(from === 'title' ? 'title' : 'hub')));
  }

  /** What the pilot's perks add up to. */
  perks(): ReturnType<typeof perkEffects> {
    return perkEffects(this.game?.perks ?? {}, PERKS);
  }

  buyPerk(perkId: string): void {
    if (this.game && checkBuyPerk(this.game, perkId, PERKS) === null) this.commit(buyPerk(this.game, perkId, PERKS));
  }

  get screen(): ScreenName {
    return this.name;
  }

  /** The kept games, in order. */
  slots(): SlotView[] {
    return Array.from({ length: SLOTS }, (_, slot) => {
      const file = this.deps.save.forSlot(slot);
      const game = file.load();
      return { slot, game, unusable: game === null && file.hasUnusableData() };
    });
  }

  /** The game Continue goes on with: the one played last, or failing that the first one there is. */
  continueSlot(): number | null {
    const kept = this.slots().filter((s) => s.game !== null).map((s) => s.slot);
    const last = this.deps.save.lastSlot();
    return kept.includes(last) ? last : kept[0] ?? null;
  }

  /** Asks what the new pilot is called before the game in that slot begins. `name` is what was typed, for a pilot coming back to it. */
  askCallsign(slot: number, name?: string): void {
    this.show('callsign', new CallsignScreen(this, slot, name));
  }

  /** Shows the new pilot the frames there are to start in. */
  chooseStarter(slot: number, callsign: string): void {
    this.show('starter', new StarterScreen(this, slot, callsign));
  }

  /**
   * Starts a new game in a slot, over whatever was kept there, in the frame that was chosen: the one
   * every pilot used to start in, when none is named.
   */
  startNewGame(slot = 0, callsign?: string, starter?: string): void {
    this.file = this.deps.save.forSlot(slot);
    this.file.rememberSlot();
    this.played = 0;
    const kit = starterOf(starter);
    this.commit({ ...newGame(this.deps.catalog, kit.build, callsign), credits: kit.credits, settings: { ...this.settings } });
    this.go('hub');
  }

  /** Goes on with the game kept in a slot, if there is one. */
  continueGame(slot: number): void {
    const file = this.deps.save.forSlot(slot);
    const saved = file.load();
    if (!saved) return;
    this.file = file;
    this.file.rememberSlot();
    this.played = 0;
    // Saved at once: a game from an older version is brought up to date where it is kept, and what it
    // had already done is recognised now (medals, entries of the database, the enemies its finished
    // contracts put in front of it) rather than at its next save.
    this.lastRun = null;
    this.commit({ ...settleOldStory(saved, SCENES, MISSIONS), met: metByRecord(saved, MISSIONS, ARENA), settings: { ...this.settings } });
    // A run that was on a floor when the game was closed fell there.
    if (this.run?.fighting) this.loseFloor();
    this.go('hub');
  }

  /**
   * Replaces the game state and saves it. On the way the record is brought up to date with the
   * time played, any medal the pilot now has what it takes for is awarded, and the database's
   * entries whose time has come are opened; both are queued to be announced.
   */
  commit(next: GameState): void {
    const seconds = Math.floor(this.played / 1000);
    this.played -= seconds * 1000;
    // What has been heard since the last save is written down with it. Only what is a song is kept,
    // and once: a list that names anything else is not passed on, so it cannot outgrow what a save may hold.
    const listed = next.heard ?? [];
    const songs = [...new Set([...listed, ...this.heardNow])].filter((song) => Object.hasOwn(SONGS, song));
    const heard = songs.length !== listed.length || songs.some((song, i) => song !== listed[i]) ? { ...next, heard: songs } : next;
    const timed = seconds > 0 ? { ...heard, stats: { ...heard.stats, seconds: heard.stats.seconds + seconds } } : heard;
    const { game: awarded, earned } = awardMedals(timed, MEDALS);
    // The database does not run ahead of the story: while a page of story is waiting to be shown,
    // nothing opens, so what that page is about to reveal is not announced before it.
    const waiting = dueScenes(awarded, SCENES, MISSIONS).length > 0;
    const { game, opened } = waiting ? { game: awarded, opened: [] } : openEntries(awarded, CODEX, MISSIONS);
    // An Overdrive that the pilot's level has just opened is said once, so the page it is fitted on gets looked at.
    const before = this.game;
    const drives = before ? OVERDRIVES.filter((id) => overdriveOpen(game, id) && !overdriveOpen(before, id)) : [];
    // Several at once (a pilot who jumps levels) are one announcement, like several medals are.
    const driveToasts: Toast[] = drives.length === 0 ? []
      : [{ id: `overdrive:${drives.join('+')}`, heading: STRINGS.overdrive.opened, title: drives.map((id) => STRINGS.overdrive.names[id]).join(', '), sound: 'entry' }];
    // A name the record has just earned is said once, as it is earned. A game that is loaded with one has it without ceremony.
    const named = before && nameRank(game) > nameRank(before) ? nameRank(game) : 0;
    const nameToasts: Toast[] = named === 0 ? []
      : [{ id: `name:${named}`, heading: STRINGS.renown.earned, title: STRINGS.renown.names[named - 1], sound: 'medal' }];
    // A crown that has just been taken is said once, by what its holder is now called.
    const crownToasts: Toast[] = !before ? [] : ARCHETYPES.filter((kind) => crownHeld(game, kind) && !crownHeld(before, kind))
      .map((kind) => ({ id: `crown:${kind}`, heading: STRINGS.arena.masters.taken, title: STRINGS.arena.masters.titles[kind], sound: 'medal' }));
    this.toasts.push(...crownToasts, ...medalToasts(earned), ...nameToasts, ...entryToasts(opened.filter((entry) => !isFind(entry))), ...findToasts(opened.filter(isFind)), ...driveToasts);
    this.game = game;
    this.saveFailed = !this.file.save(game);
    // Options that could not be stored when they were changed go with the next thing that can be.
    if (this.settingsUnsaved) this.settingsUnsaved = !this.deps.save.saveSettings(this.settings);
  }

  /** Why the current build may not deploy; empty when it may. */
  buildErrors(): BuildError[] {
    // As the garage reads it: a generator the bench has worked on gives what it now gives.
    return this.game ? validatePlayerBuild(this.game.build, tunedCatalog(this.deps.catalog, this.game.tuning)) : [];
  }

  /**
   * The contracts on offer now: the patrol, the story contracts as this cycle offers them, and,
   * once the introductions are done, three open contracts that change with every battle won.
   */
  missions(): Mission[] {
    const game = this.game;
    if (!game) return [];
    // A pilot whose own mech cannot deploy is not left without work: the patrol, as it is in the first
    // cycle, in a stock frame Dispatch lends. Everything else waits for the mech to be put right.
    if (this.buildErrors().length > 0) {
      return MISSIONS.filter((m) => m.id === 'patrol').map((m) => lentPatrol(m, STARTER_BUILD, STRINGS.briefing.lentNote));
    }
    const story = availableMissions(game, MISSIONS).map((m) => forCycle(m, game.cycle));
    return this.sideWorkOpen() ? [...story, ...generateBoard(game.battlesWon, game.cycle, BOARD_TEXT), swarmContract(game.battlesWon, game.cycle, BOARD_TEXT)] : story;
  }

  /** True once the arena and the open contracts are available. */
  sideWorkOpen(): boolean {
    return !!this.game && introductionsDone(this.game, MISSIONS);
  }

  /** True when the story is over and its ending has been seen, so it can be started again. */
  canStartCycle(): boolean {
    return !!this.game && campaignComplete(this.game, MISSIONS) && this.game.endingSeen;
  }

  startCycle(): void {
    if (!this.canStartCycle()) return;
    this.commit(startNewCycle(this.game!, MISSIONS));
    this.openHub();
  }

  /** The arena fight against the opponent of this rank, if the pilot may challenge them. */
  private arenaFight(rank: number): Mission | undefined {
    const game = this.game;
    if (!game || !this.sideWorkOpen() || checkChallenge(game, rank) !== null) return undefined;
    return arenaMission(game, ARENA[rank - 1], STRINGS.arena);
  }

  openArenaBriefing(rank: number): void {
    const mission = this.arenaFight(rank);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  /** The mirror match, if the arena offers it to this pilot. */
  private mirrorFight(): Mission | undefined {
    const game = this.game;
    if (!game || !this.sideWorkOpen() || !mirrorOpen(game)) return undefined;
    return mirrorMission(game, { client: STRINGS.arena.client, win: STRINGS.arena.win, ...STRINGS.arena.mirror });
  }

  /** A cup, if the office enters this pilot for it. */
  private cupFight(cupId: string): Mission | undefined {
    const game = this.game;
    const cup = CUPS.find((c) => c.id === cupId);
    if (!game || !cup || !this.sideWorkOpen() || !cupOpen(game, cup)) return undefined;
    const A = STRINGS.arena;
    return cupMission(game, cup, ARENA, { client: A.client, win: A.win, title: A.cups.names[cup.id], briefing: A.cups.briefing });
  }

  openCupBriefing(cupId: string): void {
    const mission = this.cupFight(cupId);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  openMirrorBriefing(): void {
    const mission = this.mirrorFight();
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  /**
   * The duel with the master of a class, if the masters take this pilot's challenge. A pilot who holds that
   * crown hears the arena's usual word after a win; anyone else is told where the crown goes.
   */
  private masterFight(kind: Archetype): Mission | undefined {
    const game = this.game;
    if (!game || !this.sideWorkOpen() || !mastersOpen(game)) return undefined;
    const A = STRINGS.arena;
    return masterMission(game, masterOf(kind), { client: A.client, win: crownHeld(game, kind) ? A.win : A.masters.win });
  }

  openMasterBriefing(kind: Archetype): void {
    const mission = this.masterFight(kind);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  /** The bench's work on a pilot's parts, as a battle takes it: nothing at all when there is none. */
  private tune(game: GameState | null): { tune?: Tuning } {
    const tuning = game?.tuning;
    return tuning && Object.keys(tuning).length > 0 ? { tune: tuning } : {};
  }

  /** Every enemy a battle can field, the opponent of a mirror match made from the pilot's build: the one fitted now, or the one `game` has. */
  enemies(game: GameState | null = this.game): Record<string, EnemyDef> {
    if (!game) return ALL_ENEMIES;
    // The saved builds that can be sparred with are opponents too, each made from its own parts.
    const spars = sparSlots(game, this.deps.catalog).map((slot) => [SPAR_ENEMY(slot), sparEnemy(game, slot, STRINGS.training.spar(slot + 1), this.deps.catalog)]);
    return { ...ALL_ENEMIES, mirror: mirrorEnemy(game, STRINGS.arena.mirror.name), ...Object.fromEntries(spars) };
  }

  /**
   * What a contract's battles are fought with. Every battle is started from this, and the odds on a
   * briefing are counted from it, so that what is counted is the fight that follows. `game` is the game
   * the contract is flown from: the one kept, or that one with another of the pilot's builds fitted.
   */
  fight(mission: Mission, game: GameState | null = this.game): Fight {
    // The pilot's perks apply in every battle of the contract, the first and the carried ones alike.
    // A drill is fought in the simulator's mech as it comes: the pilot's own build and perks stay outside.
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(game?.perks ?? {}, PERKS);
    const run = isGauntlet(mission) ? game?.gauntlet ?? null : null;
    const drill = isDrill(mission);
    // A run of the Gauntlet has an Overdrive only if a warden left it one; a drill only if it teaches it.
    const fitted = run ? runOverdrive(run) : drill || !game ? undefined : fittedOverdrive(game);
    const overdrive = mission.overdrive ?? (fitted ? { kind: fitted, drive: 0 } : undefined);
    return {
      build: mission.loaner ?? game!.build,
      enemies: this.enemies(game),
      opts: {
        // The contract's own scale times the difficulty the player chose. A drill is the same for everyone.
        enemyScale: (mission.scale ?? 1) * (isDrill(mission) || isGauntlet(mission) ? 1 : DIFFICULTY_SCALE[this.settings.difficulty]),
        // The pilot's own Overdrive goes with the pilot's own mech; a drill that teaches it brings its own.
        ...(overdrive ? { overdrive: overdrive.kind } : {}),
        // A run of the Gauntlet has its own boons and arrives as the last floor left it; the pilot's perks stay outside.
        // The bench's work is on the pilot's own parts: a frame that is lent is as the factory made it.
        ...(run ? { mods: runMods(run), carry: run.carry ?? undefined } : drill ? {}
          : { mods: { aim, evasion, energy, cooling, repairs, armour, ...(mission.loaner ? {} : this.tune(game)) } }),
      },
      ...(overdrive && overdrive.drive > 0 ? { drive: overdrive.drive } : {}),
    };
  }

  /** The drills in list order, each with whether it is open yet and whether it has been passed. */
  drillList(): { drill: Drill; open: boolean; passed: boolean }[] {
    const game = this.game;
    return game ? DRILLS.map((drill) => ({ drill, open: drillOpen(game, drill, MISSIONS), passed: drillPassed(game, drill.id) })) : [];
  }

  /** The drill as a contract, if it is open. */
  private drillFight(drillId: string): Mission | undefined {
    const entry = this.drillList().find(({ drill }) => drill.id === drillId);
    return entry?.open ? drillMission(this.game!, entry.drill, STRINGS.training.client) : undefined;
  }

  /**
   * What the range can field. First the pilot's saved builds that can be sparred with, one of each, with the
   * slot they are saved in; then every kind of machine the database has a page for that the pilot has met,
   * with how many of it at most.
   */
  rangeList(): { kind: string; name: string; limit: number; spar?: number }[] {
    const game = this.game;
    if (!game) return [];
    const spars = sparSlots(game, this.deps.catalog).map((slot) => ({ kind: SPAR_ENEMY(slot), name: STRINGS.training.spar(slot + 1), limit: 1, spar: slot }));
    return [...spars, ...rangeKinds(game, UNITS.map((unit) => unit.id)).map((kind) => ({ kind, name: ALL_ENEMIES[kind].name, limit: rangeLimit(kind) }))];
  }

  /**
   * A fight on the range as a contract, if what is asked for is on the range's list: a machine met, or a saved
   * build that can be sparred with. The range is flown in the pilot's own mech: while that may not deploy it
   * is closed, as the arena is, and no fight on it is on offer.
   */
  private rangeFight(kind: string, count: number): Mission | undefined {
    if (this.buildErrors().length > 0) return undefined;
    const entry = this.rangeList().find((machine) => machine.kind === kind);
    if (!entry) return undefined;
    const T = STRINGS.training;
    if (entry.spar !== undefined) {
      return sparMission(entry.spar, { title: T.sparTitle, client: T.client, free: T.rangeFree, debrief: T.rangeDebrief, briefing: T.sparBriefing });
    }
    return rangeMission(kind, count, entry.name, {
      title: T.rangeTitle, client: T.client, free: T.rangeFree, debrief: T.rangeDebrief,
      briefing: (name, fielded) => T.rangeBriefing(fielded > 1 ? `${name} ${T.rangeCount(fielded)}` : name),
    });
  }

  openRangeBriefing(kind: string, count: number): void {
    const mission = this.rangeFight(kind, count);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  openDrillBriefing(drillId: string): void {
    const mission = this.drillFight(drillId);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  /** The run of the Gauntlet under way, if any. */
  get run(): Run | null {
    return this.game?.gauntlet ?? null;
  }

  /** The floor the run is on, as a contract; nothing while a draft is owed or no run is under way. */
  gauntletFloor(): Mission | undefined {
    const run = this.run;
    if (!run || run.drafting) return undefined;
    const names = Object.fromEntries(Object.values(this.enemies()).map((e) => [e.id, e.name]));
    return floorMission(run, GAUNTLET_TEXT, names);
  }

  /** Starts a run in the stock frame. A run already under way is left as it is. */
  startGauntlet(): void {
    if (!this.game || this.run || !this.sideWorkOpen()) return;
    this.seed = (this.seed + 7919) % 2147483647;
    this.lastRun = null;
    this.commit({ ...this.game, gauntlet: startRun(this.seed, GAUNTLET_BUILD, this.game.gauntletBest ?? 0) });
  }

  /** Into the floor the run is on, by one of its doors. */
  descendGauntlet(door = 0): void {
    const run = this.run;
    if (!this.game || !run || run.drafting || door < 0 || door >= this.gauntletDoors().length) return;
    // Written down before the first shot: a game closed on a floor finds the run fallen there.
    this.commit({ ...this.game, gauntlet: enter(run, door, GAUNTLET_TEXT.backgrounds) });
    const floor = this.gauntletFloor();
    if (floor) this.startMission(floor.id);
  }

  /** The ways into the floor ahead: two for an open floor, one for a warden's. None without a run. */
  gauntletDoors(): Door[] {
    return this.run ? doors(this.run, GAUNTLET_TEXT.backgrounds) : [];
  }

  /** Takes one of the two relics a warden left. */
  takeRelic(relic: RelicId): void {
    const game = this.game;
    const run = this.run;
    if (!game || !run || !run.relicOwed) return;
    const held = takeRelic(run, relic);
    this.commit({ ...game, gauntlet: held, relicsHeld: Math.max(game.relicsHeld ?? 0, held.relics?.length ?? 0) });
    // What a warden leaves is worth a sound of its own.
    this.deps.sfx?.play('relic');
  }

  /**
   * Books a floor the moment it is decided: won, the run goes one deeper and is owed a draft; lost
   * or left, the run is over and pays for the floors it cleared. Returns what it paid, if it ended.
   */
  bookGauntlet(end: BattleState): void {
    const game = this.game;
    const run = this.run;
    if (!game || !run) return;
    // What was fought down there has been met, and a floor cleared counts towards the best at once.
    const met = [...new Set([...game.met, ...end.units.flatMap((u) => (u.side === 'enemy' && u.kind && Object.hasOwn(ENEMIES, u.kind) ? [u.kind] : []))])];
    // An Overdrive set off down here counts like any other.
    const used = end.events.filter((event) => event.type === 'overdrive').length;
    const counted = { ...game, met, ...(used > 0 ? { overdrives: (game.overdrives ?? 0) + used } : {}) };
    if (end.outcome === 'victory') {
      // An elite beaten is counted for the pilot, like the floor itself.
      const elites = run.elite ? { elites: (game.elites ?? 0) + 1 } : {};
      return this.commit({ ...counted, ...elites, gauntlet: descend(run, end), gauntletBest: Math.max(game.gauntletBest ?? 0, run.floor) });
    }
    this.commit(counted);
    this.loseFloor();
  }

  /** A floor lost, left or closed on: a Spare Core puts the run before it again, once; without one the run is over. */
  private loseFloor(): void {
    const game = this.game;
    const run = this.run;
    if (!game || !run) return;
    const again = fall(run);
    if (again) this.commit({ ...game, gauntlet: again });
    else this.endGauntlet();
  }

  /** Ends the run where it stands and pays it out. */
  endGauntlet(): void {
    const game = this.game;
    const run = this.run;
    if (!game || !run) return;
    const cleared = floorsCleared(run);
    const best = Math.max(game.gauntletBest ?? 0, cleared);
    const paid = runPayout(run);
    this.lastRun = { cleared, paid, record: cleared > (run.bestBefore ?? 0) };
    this.commit({ ...game, credits: game.credits + paid, gauntlet: null, gauntletBest: best });
  }

  /** How the last run of this sitting ended, for the Gauntlet's own screen. */
  lastRun: { cleared: number; paid: number; record: boolean } | null = null;

  /** Takes one of the three things on offer after a floor. */
  takeDraft(offer: Offer): void {
    const game = this.game;
    const run = this.run;
    if (!game || !run || !run.drafting) return;
    this.commit({ ...game, gauntlet: take(run, offer, this.deps.catalog) });
  }

  /** Books a drill: the first pass pays and is remembered; nothing else changes. */
  /** Writes into the kept game what the pilot has been told in the field, so that it is not said again. */
  learn(lessons: readonly string[]): void {
    const next = learn(this.game!, lessons);
    if (next !== this.game) this.commit(next);
  }

  bookDrill(settlement: Settlement, mission: Mission): void {
    const next = recordDrill(this.game!, settlement, mission);
    if (next !== this.game) this.commit(next);
  }

  /** Leaves a settlement: a drill for the training list, anything else for the hub. */
  leaveSettlement(mission: Mission): void {
    if (isGauntlet(mission)) this.go('gauntlet');
    else if (isDrill(mission) || isRange(mission)) this.show('training', new TrainingScreen(this, mission.id));
    else this.go('hub');
  }

  /** Leaves a briefing for the list it was opened from. */
  closeBriefing(mission: Mission): void {
    if (isDrill(mission) || isRange(mission)) this.show('training', new TrainingScreen(this, mission.id));
    else if (mission.id === MIRROR_ID) this.show('arena', new ArenaScreen(this, MIRROR));
    else if (isCup(mission) || isMaster(mission)) this.show('arena', new ArenaScreen(this, mission.id));
    else if (mission.arenaRank !== undefined) this.show('arena', new ArenaScreen(this, `rank-${mission.arenaRank}`));
    else this.openHub(mission.replay ? 'archive' : 'contracts', mission.id);
  }

  /** The story contracts already done, as they can be played again: for less pay, and without changing the story. */
  archive(): Mission[] {
    const game = this.game;
    return game ? archiveMissions(game, MISSIONS.map((m) => forCycle(m, game.cycle))) : [];
  }

  /** What the shop sells at this point in the campaign. */
  stock(): Part[] {
    return this.game ? stockFor(this.game, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS) : [];
  }

  unreadCount(): number {
    return this.game ? unreadMessages(this.game, MESSAGES, MISSIONS).length : 0;
  }

  readMessage(id: string): void {
    if (this.game && !this.game.read.includes(id)) this.commit(markRead(this.game, id));
  }

  private offered(missionId: string, replay: boolean): Mission | undefined {
    if (replay) return this.archive().find((m) => m.id === missionId);
    if (missionId.startsWith('drill-')) return this.drillFight(missionId);
    const spar = parseSpar(missionId);
    if (spar !== null) return this.rangeFight(SPAR_ENEMY(spar), 1);
    const range = parseRange(missionId);
    if (range) return this.rangeFight(range.kind, range.count);
    if (missionId.startsWith('gauntlet-')) return this.gauntletFloor()?.id === missionId ? this.gauntletFloor() : undefined;
    if (missionId === MIRROR_ID) return this.mirrorFight();
    if (missionId.startsWith('cup-')) return this.cupFight(missionId);
    const master = parseMaster(missionId);
    if (master) return this.masterFight(master);
    const arena = /^arena-(\d+)$/.exec(missionId);
    return arena ? this.arenaFight(Number(arena[1])) : this.missions().find((m) => m.id === missionId);
  }

  /** Opens a contract's briefing; `replay` for one from the archive. */
  openBriefing(missionId: string, replay = false): void {
    const mission = this.offered(missionId, replay);
    if (mission) this.show('briefing', new BriefingScreen(this, mission), briefingTrack(mission));
  }

  /** The contract as the other side offers it, when they do: only in a later telling, and until the contract is done. */
  otherOffer(mission: Mission): Mission | null {
    return this.game ? otherOffer(this.game, mission, MISSIONS) : null;
  }

  /** What a contract can be taken in now: the build on the floor, and the saved builds that can be fitted and may deploy. */
  sorties(): Sortie[] {
    return this.game ? sortieBuilds(this.game, tunedCatalog(this.deps.catalog, this.game.tuning)) : [];
  }

  /**
   * Starts a contract, unless it is not on offer, or the build may not deploy and the contract lends
   * no mech of its own. With `other` it is flown as the other side offers it, if they do. With `fit`
   * the saved build in that slot is fitted first, as the garage would load it: a slot that cannot be
   * flown from starts nothing, and nothing is fitted for a contract that is not on offer.
   */
  startMission(missionId: string, replay = false, wingmanId: string | null = null, other = false, fit: number | null = null): void {
    if (fit !== null) {
      // A contract in a lent mech is not flown in any build of the pilot's: nothing is fitted for it either.
      const asked = this.offered(missionId, replay);
      const fitted = asked && asked.loaner === undefined ? this.fitted(fit) : null;
      if (!fitted) return;
      this.commit(fitted);
    }
    const first = this.offered(missionId, replay);
    const offered = other && first ? this.otherOffer(first) ?? undefined : first;
    if (!offered || (offered.loaner === undefined && this.buildErrors().length > 0)) return;
    this.seed = (this.seed + 101) % 2147483647;
    this.show('battle', new MissionHost(this, this.crewed(offered, wingmanId), this.seed));
  }

  /** The game as it would be kept with one of `sorties()` fitted: itself for the build on the floor, nothing for a slot that cannot be flown from. */
  fitted(slot: number | null): GameState | null {
    return this.game ? fitSortie(this.game, slot, tunedCatalog(this.deps.catalog, this.game.tuning)) : null;
  }

  /** An offer as it is flown: a second pilot comes along when one was hired who takes calls, with their fire and their share of the fee. */
  crewed(offered: Mission, wingmanId: string | null): Mission {
    const wingman = this.wingmen(offered).find((w) => w.id === wingmanId);
    return wingman ? withWingman(offered, wingman) : offered;
  }

  /**
   * What accepting an offer would start: the contract as it would be flown, and what its battles would be
   * fought with in the build of that slot (null for the one on the floor). Nothing for a contract in a lent
   * mech, a slot that cannot be flown from, or a build that may not deploy.
   */
  prospect(offered: Mission, wingmanId: string | null, slot: number | null): { mission: Mission; fight: Fight } | null {
    const game = offered.loaner === undefined ? this.fitted(slot) : null;
    if (!game || validatePlayerBuild(game.build, tunedCatalog(this.deps.catalog, game.tuning)).length > 0) return null;
    const mission = this.crewed(offered, wingmanId);
    return { mission, fight: this.fight(mission, game) };
  }

  /** Chooses the Overdrive to fly with, among those open to the pilot. */
  fitOverdrive(id: OverdriveId): void {
    const game = this.game;
    if (!game || !overdriveOpen(game, id) || game.overdrive === id) return;
    this.commit({ ...game, overdrive: id });
  }

  /** The pilots for hire who take this pilot's calls. */
  wingmen(mission?: Mission): Wingman[] {
    const game = this.game;
    return game ? WINGMEN.flatMap((w) => (mission?.busy?.includes(w.id) ? [] : wingmanFor(game, w, MISSIONS) ?? [])) : [];
  }

  go(name: ScreenName): void {
    switch (name) {
      case 'title': return this.show(name, new TitleScreen(this));
      case 'hub': return this.openHub();
      case 'garage': return this.show(name, new GarageScreen(this));
      case 'shop': return this.show(name, new ShopScreen(this));
      case 'messages': return this.show(name, new MessagesScreen(this));
      case 'pilot': return this.show(name, new PilotScreen(this));
      case 'database': return this.show(name, new DatabaseScreen(this));
      case 'training': return this.show(name, new TrainingScreen(this));
      case 'gauntlet': if (this.sideWorkOpen()) this.show(name, new GauntletScreen(this)); return;
      case 'arena': if (this.sideWorkOpen()) this.show(name, new ArenaScreen(this)); return;
      case 'options': return this.openOptions();
      default: return; // briefings, battles, settlements and endings open through their own methods
    }
  }

  /**
   * Opens the hub, optionally straight on one of its lists with the cursor on an entry. Two things are checked on the way in:
   * a pilot without any weapon is issued one, and a scene that is due (the opening of an act, an
   * ending that was earned but never seen) is shown first.
   */
  openHub(list?: 'contracts' | 'archive', at?: string): void {
    const game = this.game;
    if (game) {
      const armed = ensureArmed(game, this.deps.catalog, STARTER_BUILD.rightHand!);
      if (armed !== game) this.commit(armed);
      const scene = dueScenes(armed, SCENES, MISSIONS)[0];
      if (scene) return this.show(scene.ending ? 'ending' : 'scene', scene.talk ? new TalkScreen(this, scene) : new SceneScreen(this, scene));
    }
    this.show('hub', new HubScreen(this, list, at));
  }

  /**
   * Records a contract's outcome: money and experience, and after a win the contract itself (story
   * contracts) or the new arena rank (arena fights). Open contracts and the patrol leave no record.
   */
  bookSettlement(settlement: Settlement, mission: Mission, fought: Fought = { tally: NO_STATS, met: [], retreated: false }): number {
    const relief = debtRelief(this.game!, settlement);
    let next = applySettlement(this.game!, settlement);
    next = addXp(next, xpForContract(mission.reward, settlement.won));
    const pay = settlement.reward + (settlement.bonus ?? 0) + (settlement.asked?.bonus ?? 0);
    next = {
      ...next,
      stats: addStats(next.stats, contractStats(fought.tally, { won: settlement.won, retreated: fought.retreated, pay })),
      met: [...next.met, ...fought.met.filter((kind) => !next.met.includes(kind))],
      ...(fought.overdrives ? { overdrives: (next.overdrives ?? 0) + fought.overdrives } : {}),
    };
    // A win in the pilot's own build is a win for the kind of machine that build is.
    const kind = this.flownAs(mission);
    if (settlement.won && kind) next = recordWinAs(next, kind);
    if (settlement.won) {
      if (mission.arenaRank !== undefined) next = recordArenaWin(next, mission.arenaRank);
      else if (mission.id === MIRROR_ID) next = recordMirrorWin(next);
      else if (isCup(mission)) next = recordCupWin(next, mission.id);
      // A master beaten is beaten whatever was flown; the crown goes with the class of the build it was flown in.
      else if (mission.crown !== undefined) next = recordMasterWin(next, mission.crown, kind);
      else if (MISSIONS.some((m) => m.id === mission.id)) {
        // Flown for the other side, it is remembered as that: an answer, like the story's other decisions.
        if (mission.turned && !mission.replay) next = decide(next, mission.turned.question, mission.turned.answer);
        // Winning a contract again from the archive completes nothing new; its rank can still improve.
        next = completeMission(next, mission.id, MISSIONS);
        if (mission.phase !== 'patrol' && settlement.rank) next = recordRank(next, mission.id, settlement.rank);
      }
    }
    this.commit(next);
    return relief;
  }

  /** The kind of machine a contract is flown as: that of the build on the floor. A mech that was lent is nobody's kind. */
  flownAs(mission: Mission): Archetype | null {
    return this.game && mission.loaner === undefined ? archetypeOf(this.game.build, this.deps.catalog) : null;
  }

  /** Shows a settlement that has already been booked. */
  showSettlement(settlement: Settlement, mission: Mission, tip: Advice | null = null): void {
    this.show('settlement', new SettlementScreen(this, settlement, mission, tip), trackFor('settlement', settlement));
  }

  /** Marks a scene as seen and goes on to the hub, or to the next scene that is due. An ending is followed by the end roll. */
  /** Records what the pilot answered when the story asked. */
  decide(choice: string, option: string, pay = 0): void {
    if (!this.game) return;
    const next = decide(this.game, choice, option, pay);
    if (next !== this.game) this.commit(next);
  }

  finishScene(scene: Scene): void {
    if (this.game) {
      const next = markSceneSeen(this.game, scene);
      if (next !== this.game) this.commit(next);
    }
    if (scene.ending && this.game) this.showCredits();
    else this.openHub();
  }

  /** True once there is an end roll to watch again: an ending has been seen, in this cycle or an earlier one. */
  canWatchCredits(): boolean {
    return !!this.game && (this.game.endingSeen || this.game.cycle > 0);
  }

  showCredits(): void {
    if (this.game) this.show('credits', new CreditsScreen(this));
  }

  closeCredits(): void {
    this.openHub();
  }

  /** Stores the game as it is if the last attempt failed; true when what is kept is the game being played. */
  saveNow(): boolean {
    // A song heard since the last save goes in with this one: it is all there may be to write down.
    const unheard = this.game ? [...this.heardNow].some((song) => !(this.game!.heard ?? []).includes(song)) : false;
    if (this.game && unheard) this.commit(this.game);
    else if (this.game && this.saveFailed) this.saveFailed = !this.file.save(this.game);
    return !this.saveFailed;
  }

  /**
   * Leaves the game being played for the title, where another kept game can be continued or a new
   * one started. Every change was saved as it was made; one that could not be is tried once more here,
   * and is lost if it still cannot be (the options warn before they call this).
   */
  quitToTitle(): void {
    this.saveNow();
    this.saveFailed = false;
    this.game = null;
    this.toasts = [];
    this.toast = null;
    this.played = 0;
    // What this game heard stays with it: the next one starts with the title's song and nothing else.
    this.heardNow = new Set();
    this.go('title');
  }

  update(dtMs: number): void {
    this.entering.left = Math.max(0, this.entering.left - dtMs);
    this.current.update(dtMs);
    if (this.deps.music) {
      this.deps.music.tense = this.current instanceof MissionHost && this.current.tense;
      this.deps.music.hush = this.current instanceof MissionHost && this.current.closeLook ? HUSH : 1;
    }
    if (this.game && this.name !== 'title' && this.name !== 'callsign' && this.name !== 'starter') this.played += dtMs;
    this.stepToast(dtMs);
  }

  /** One announcement at a time, and only where there is room for one (`TOAST_ROOM`): elsewhere they wait. */
  private stepToast(dtMs: number): void {
    const room = TOAST_ROOM.includes(this.name);
    if (this.toast) {
      // One that is up when the pilot goes somewhere without room for it steps aside, and is announced again after.
      if (!room) {
        this.toasts.unshift(this.toast.item);
        this.toast = null;
        return;
      }
      this.toast.left -= dtMs;
      if (this.toast.left <= 0) this.toast = null;
      return;
    }
    if (this.toasts.length === 0 || !room) return;
    this.toast = { item: this.toasts.shift()!, left: TOAST_MS };
    this.deps.sfx?.play(this.toast.item.sound);
  }

  /**
   * An announcement: a strip that slides up from the bottom edge, stays, and slides back. It is only
   * shown on a screen whose foot is free (`TOAST_ROOM`); at the top it would cover the name of the
   * screen, or the heading of a settlement.
   */
  private drawToast(ctx: CanvasRenderingContext2D): void {
    if (!this.toast) return;
    const { item, left } = this.toast;
    const slide = Math.min(1, left / TOAST_SLIDE_MS, (TOAST_MS - left) / TOAST_SLIDE_MS);
    const w = 176;
    const h = 28;
    const x = Math.round((LOGICAL_W - w) / 2);
    const y = Math.round(LOGICAL_H - (h + 2) * (this.deps.fast ? 1 : Math.max(0, slide)));
    // Nothing of the screen underneath shows through.
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(x, y, w, h);
    drawPanel(ctx, x, y, w, h);
    if (item.tier) drawMedal(ctx, x + 6, y + 9, item.tier, true);
    else drawPage(ctx, x + 6, y + 9);
    drawText(ctx, item.heading, x + 20, y + 2, { color: COLORS.dim, size: 10 });
    drawText(ctx, item.title, x + 20, y + 12, { color: COLORS.accent });
    if (item.note) drawText(ctx, item.note, x + w - 6, y + 12, { align: 'right', color: COLORS.armor });
  }

  private drawScreen(ctx: CanvasRenderingContext2D): void {
    this.current.draw(ctx);
    const { left, total, shutter } = this.entering;
    if (left <= 0) return;
    // A battle opens between two doors; any other screen comes out from behind a blind.
    if (shutter) drawDoors(ctx, left / total);
    else drawBlind(ctx, left / total);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawScreen(ctx);
    this.drawToast(ctx);
  }

  /** True while a shutter still hides the battle behind it. */
  private get shuttered(): boolean {
    return !this.deps.fast && this.entering.shutter && this.entering.left > 0;
  }

  onInput(action: InputAction): void {
    // Nothing is pressed on a battle that cannot be seen yet.
    if (this.shuttered) return;
    this.current.onInput(action);
  }

  snapshot(): unknown {
    const game = this.game;
    const view = this.current.view();
    return {
      screen: this.name,
      credits: game?.credits ?? null,
      battlesWon: game?.battlesWon ?? null,
      completed: game?.completed ?? null,
      build: game?.build ?? null,
      inventory: game?.inventory ?? null,
      xp: game?.xp ?? null,
      level: game ? levelFor(game.xp) : null,
      arenaRank: game?.arenaRank ?? null,
      cycle: game?.cycle ?? null,
      settings: this.settings,
      paint: game?.paint ?? null,
      loadouts: game?.loadouts.map((build) => build !== null) ?? null,
      slot: this.file.slot,
      callsign: game?.callsign ?? null,
      ranks: game?.ranks ?? null,
      scenes: game?.scenes ?? null,
      medals: game?.medals ?? [],
      drills: game?.drills ?? [],
      toast: this.toast?.item.id ?? null,
      toasts: this.toasts.map((item) => item.id),
      saveFailed: this.saveFailed,
      // How many frames a second the handheld is showing, as the game has been told.
      fps: this.pace.fps,
      ...view,
      // Not taking input right now: behind a shutter, or holding a line of text for a moment.
      busy: this.shuttered || view.busy === true,
    };
  }
}
