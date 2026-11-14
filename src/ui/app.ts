import { arenaMission, checkChallenge, recordArenaWin } from '../core/arena';
import { generateBoard } from '../core/board';
import { validatePlayerBuild } from '../core/build';
import {
  archiveMissions, availableMissions, campaignComplete, completeMission, dueScenes, forCycle, introductionsDone, markRead,
  markSceneSeen, startNewCycle, stockFor, unreadMessages,
  type Mission, type Scene,
} from '../core/campaign';
import { applySettlement, settle, type Settlement } from '../core/economy';
import { MEDAL_PAY, awardMedals, type Medal } from '../core/medals';
import { DEFAULT_SETTINGS, DIFFICULTY_SCALE, ensureArmed, newGame, type GameState, type Settings } from '../core/game';
import { startMissionBattle } from '../core/mission';
import { addXp, buyPerk, checkBuyPerk, levelFor, perkEffects, xpForContract } from '../core/pilot';
import { missionPar, performanceOf, rankSettlement, recordRank } from '../core/rank';
import { NO_STATS, addStats, contractStats, retreated, tallyBattle, type Stats } from '../core/stats';
import type { BuildError, Catalog, Part } from '../core/types';
import { ALL_ENEMIES, ARENA } from '../content/arena';
import { BOARD_TEXT } from '../content/board';
import { MEDALS } from '../content/medals';
import { MESSAGES, MISSIONS } from '../content/missions';
import { PERKS } from '../content/perks';
import { SCENES } from '../content/scenes';
import { SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../content/parts';
import { STRINGS } from '../content/strings';
import type { Sfx } from '../platform/audio';
import type { TrackName } from '../platform/music';
import type { InputAction } from '../platform/input';
import { SLOTS, type SaveFile } from '../platform/storage';
import { ArenaScreen } from './arenaScreen';
import { BattleFlow, BattleScreen } from './battleScreen';
import { BriefingScreen } from './briefingScreen';
import { CallsignScreen } from './callsignScreen';
import { LOGICAL_H, LOGICAL_W } from './display';
import { GarageScreen } from './garageScreen';
import { HubScreen } from './hubScreen';
import type { ListItem } from './menuList';
import { MessagesScreen } from './messagesScreen';
import { OptionsScreen } from './optionsScreen';
import { PilotScreen } from './pilotScreen';
import { SceneScreen } from './sceneScreen';
import { SettlementScreen } from './settlementScreen';
import { battleTrack, trackFor } from './soundtrack';
import { ShopScreen } from './shopScreen';
import type { SpriteStore } from './sprites';
import { TitleScreen } from './titleScreen';
import { COLORS, drawMedal, drawPanel, drawText } from './widgets';

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
  | 'title' | 'callsign' | 'hub' | 'garage' | 'shop' | 'messages' | 'briefing' | 'battle' | 'settlement' | 'scene' | 'ending'
  | 'arena' | 'pilot' | 'options';

/** One of the kept games as the title shows it: empty, unreadable, or a game. */
export interface SlotView { slot: number; game: GameState | null; unusable: boolean }

/** How much quicker a battle plays with the fast-battles option on. */
export const FAST_BATTLE_SPEED = 2.5;
/** How long a new screen takes to come up out of black, and the shutter over a battle to open. */
export const FADE_MS = 170;
export const SHUTTER_MS = 320;
/** How long a medal's announcement stays up, and how much of that it spends sliding in and out. */
export const TOAST_MS = 2600;
const TOAST_SLIDE_MS = 180;

/** What the battles of a contract added up to, for the record. */
export interface Fought { tally: Stats; met: string[]; retreated: boolean }

/** The part of the music player the app steers. */
export interface MusicControl {
  enabled: boolean;
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

  constructor(private app: App, private mission: Mission, private seed: number) {
    this.begin();
  }

  private begin(): void {
    const { catalog, sprites, sfx, fast } = this.app.deps;
    const total = this.mission.battles.length;
    // The pilot's perks apply in every battle of the contract, the first and the carried ones alike.
    const { aim, evasion, energy, cooling, repairs, armour } = this.app.perks();
    const state = startMissionBattle(
      this.app.game!.build, this.mission, this.index, ALL_ENEMIES, catalog, this.seed, this.index > 0 ? this.flow.state : undefined,
      { enemyScale: this.enemyScale(), mods: { aim, evasion, energy, cooling, repairs, armour } },
    );
    // Each battle of a contract has its own song: the last one may be against a boss.
    this.app.playTrack(battleTrack(this.mission, this.index, ALL_ENEMIES));
    // Tests play without the talk: it is words to read, and they have nobody reading.
    this.flow = new BattleFlow(state, catalog, { talk: this.mission.battles[this.index].talk, quiet: fast });
    const battle = this.mission.battles[this.index];
    const boss = battle.enemies.map((id) => ALL_ENEMIES[id]).find((enemy) => (enemy?.phases?.length ?? 0) > 0);
    if (this.index > 0) this.app.openShutter();
    this.screen = new BattleScreen(this.flow, sprites, catalog, {
      fast, sfx, speed: this.app.settings.fastBattles ? FAST_BATTLE_SPEED : 1, paint: this.app.game!.paint,
      title: this.mission.title.toUpperCase(), rumble: (ms) => this.app.rumble(ms),
      ...(boss ? { boss: boss.name } : {}),
      background: this.mission.battles[this.index].background,
      label: total > 1 ? STRINGS.mission.engagement(this.index + 1, total) : '',
      resultHint: this.hasNext() ? STRINGS.mission.next : STRINGS.hints.result,
    });
  }

  /** The contract's own scale times the difficulty the player chose. */
  private enemyScale(): number {
    return (this.mission.scale ?? 1) * DIFFICULTY_SCALE[this.app.settings.difficulty];
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
    const { payBonus, costDiscount } = this.app.perks();
    const bill = settle(this.flow.state, this.mission.reward, this.app.deps.catalog, { payBonus, costDiscount });
    const performance = performanceOf(this.flow.state, this.rounds + this.flow.state.round, missionPar(this.mission));
    this.settlement = rankSettlement(bill, performance);
    this.count();
    this.app.bookSettlement(this.settlement, this.mission, { tally: this.tally, met: [...this.met], retreated: retreated(this.flow.state) });
  }

  /** Adds the battle that has just ended to what the contract has added up to. */
  private count(): void {
    this.tally = addStats(this.tally, tallyBattle(this.flow.state));
    // Whatever was on the field was met, what joined later included.
    for (const unit of this.flow.state.units) if (unit.side === 'enemy' && unit.kind) this.met.add(unit.kind);
  }

  update(dtMs: number): void {
    this.screen.update(dtMs);
    this.bookIfOver();
  }

  draw(ctx: CanvasRenderingContext2D): void { this.screen.draw(ctx); }

  onInput(action: InputAction): void {
    if (this.flow.phase !== 'result') {
      this.screen.onInput(action);
      this.bookIfOver();
      return;
    }
    if (action !== 'confirm') return;
    if (this.settlement) this.app.showSettlement(this.settlement, this.mission);
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
      },
      message: flow.message,
      battle: {
        phase: flow.phase, outcome: flow.state.outcome, round: flow.state.round, message: flow.message,
        mission: this.mission.id, index: this.index, of: this.mission.battles.length, enemyScale: this.enemyScale(),
        targetId: flow.targetId, targetPart: flow.targetPart, shown: flow.eventsShown,
        objective: flow.objective?.text ?? null, spoken: flow.spoken?.text ?? null, replay: !!this.mission.replay,
        enemies: flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed).map((u) => u.kind ?? u.id),
      },
    };
  }
}

/** Owns the game state and the current screen, and moves between screens. */
export class App {
  game: GameState | null = null;
  /** True when the last attempt to save was refused by the device. */
  saveFailed = false;
  /** Sound, music and battle speed. Stored on their own, so they exist before a game does. */
  settings: Settings;
  private name: ScreenName = 'title';
  private current!: Screen;
  private seed: number;
  /** The kept game being played: every save goes there. */
  private file: SaveFile;
  /** The way the current screen is still coming into view: what is left of it and how long it takes. */
  private entering = { left: 0, total: 1, shutter: false };
  /** Medals earned and not yet announced, and the one being announced with the time it has left. */
  private toasts: Medal[] = [];
  private toast: { medal: Medal; left: number } | null = null;
  /** Time played since the record was last brought up to date, in milliseconds. */
  private played = 0;

  constructor(readonly deps: AppDeps) {
    this.seed = deps.seed;
    this.file = deps.save.forSlot(deps.save.lastSlot());
    this.settings = deps.save.loadSettings() ?? { ...DEFAULT_SETTINGS, ...(this.file.load()?.settings ?? {}) };
    this.applySettings();
    this.show('title', new TitleScreen(this));
  }

  /** Puts a screen up and picks the music that goes with it. A battle picks its own as it begins. */
  private show(name: ScreenName, screen: Screen, track: TrackName = trackFor(name)): void {
    this.current = screen;
    this.name = name;
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

  playTrack(track: TrackName): void {
    this.deps.music?.play(track);
  }

  private applySettings(): void {
    if (this.deps.sfx) this.deps.sfx.muted = !this.settings.sfx;
    if (this.deps.music) this.deps.music.enabled = this.settings.music;
  }

  /** Changes the options, applies them at once and stores them, with the game when there is one. */
  setSettings(next: Settings): void {
    this.settings = { ...next };
    this.applySettings();
    this.deps.save.saveSettings(this.settings);
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

  /** Asks what the new pilot is called before the game in that slot begins. */
  askCallsign(slot: number): void {
    this.show('callsign', new CallsignScreen(this, slot));
  }

  /** Starts a new game in a slot, over whatever was kept there. */
  startNewGame(slot = 0, callsign?: string): void {
    this.file = this.deps.save.forSlot(slot);
    this.file.rememberSlot();
    this.played = 0;
    this.commit({ ...newGame(this.deps.catalog, STARTER_BUILD, callsign), settings: { ...this.settings } });
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
    this.game = { ...saved, settings: { ...this.settings } };
    this.go('hub');
  }

  /**
   * Replaces the game state and saves it. On the way the record is brought up to date with the
   * time played, and any medal the pilot now has what it takes for is awarded and queued to be announced.
   */
  commit(next: GameState): void {
    const seconds = Math.floor(this.played / 1000);
    this.played -= seconds * 1000;
    const timed = seconds > 0 ? { ...next, stats: { ...next.stats, seconds: next.stats.seconds + seconds } } : next;
    const { game, earned } = awardMedals(timed, MEDALS);
    this.toasts.push(...earned);
    this.game = game;
    this.saveFailed = !this.file.save(game);
  }

  /** Why the current build may not deploy; empty when it may. */
  buildErrors(): BuildError[] {
    return this.game ? validatePlayerBuild(this.game.build, this.deps.catalog) : [];
  }

  /**
   * The contracts on offer now: the patrol, the story contracts as this cycle offers them, and,
   * once the introductions are done, three open contracts that change with every battle won.
   */
  missions(): Mission[] {
    const game = this.game;
    if (!game) return [];
    const story = availableMissions(game, MISSIONS).map((m) => forCycle(m, game.cycle));
    return this.sideWorkOpen() ? [...story, ...generateBoard(game.battlesWon, game.cycle, BOARD_TEXT)] : story;
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
    if (mission) this.show('briefing', new BriefingScreen(this, mission));
  }

  /** Leaves a briefing for the list it was opened from. */
  closeBriefing(mission: Mission): void {
    if (mission.arenaRank !== undefined) this.go('arena');
    else this.openHub(mission.replay ? 'archive' : 'contracts');
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
    const arena = /^arena-(\d+)$/.exec(missionId);
    return arena ? this.arenaFight(Number(arena[1])) : this.missions().find((m) => m.id === missionId);
  }

  /** Opens a contract's briefing; `replay` for one from the archive. */
  openBriefing(missionId: string, replay = false): void {
    const mission = this.offered(missionId, replay);
    if (mission) this.show('briefing', new BriefingScreen(this, mission));
  }

  /** Starts a contract, unless the build may not deploy or the contract is not on offer. */
  startMission(missionId: string, replay = false): void {
    const mission = this.offered(missionId, replay);
    if (!mission || this.buildErrors().length > 0) return;
    this.seed = (this.seed + 101) % 2147483647;
    this.show('battle', new MissionHost(this, mission, this.seed));
  }

  go(name: ScreenName): void {
    switch (name) {
      case 'title': return this.show(name, new TitleScreen(this));
      case 'hub': return this.openHub();
      case 'garage': return this.show(name, new GarageScreen(this));
      case 'shop': return this.show(name, new ShopScreen(this));
      case 'messages': return this.show(name, new MessagesScreen(this));
      case 'pilot': return this.show(name, new PilotScreen(this));
      case 'arena': if (this.sideWorkOpen()) this.show(name, new ArenaScreen(this)); return;
      case 'options': return this.openOptions();
      default: return; // briefings, battles, settlements and endings open through their own methods
    }
  }

  /**
   * Opens the hub, optionally straight on one of its lists. Two things are checked on the way in:
   * a pilot without any weapon is issued one, and a scene that is due (the opening of an act, an
   * ending that was earned but never seen) is shown first.
   */
  openHub(list?: 'contracts' | 'archive'): void {
    const game = this.game;
    if (game) {
      const armed = ensureArmed(game, this.deps.catalog, STARTER_BUILD.rightHand!);
      if (armed !== game) this.commit(armed);
      const scene = dueScenes(armed, SCENES, MISSIONS)[0];
      if (scene) return this.show(scene.ending ? 'ending' : 'scene', new SceneScreen(this, scene));
    }
    this.show('hub', new HubScreen(this, list));
  }

  /**
   * Records a contract's outcome: money and experience, and after a win the contract itself (story
   * contracts) or the new arena rank (arena fights). Open contracts and the patrol leave no record.
   */
  bookSettlement(settlement: Settlement, mission: Mission, fought: Fought = { tally: NO_STATS, met: [], retreated: false }): void {
    let next = applySettlement(this.game!, settlement);
    next = addXp(next, xpForContract(mission.reward, settlement.won));
    const pay = settlement.reward + (settlement.bonus ?? 0);
    next = {
      ...next,
      stats: addStats(next.stats, contractStats(fought.tally, { won: settlement.won, retreated: fought.retreated, pay })),
      met: [...next.met, ...fought.met.filter((kind) => !next.met.includes(kind))],
    };
    if (settlement.won) {
      if (mission.arenaRank !== undefined) next = recordArenaWin(next, mission.arenaRank);
      else if (MISSIONS.some((m) => m.id === mission.id)) {
        // Winning a contract again from the archive completes nothing new; its rank can still improve.
        next = completeMission(next, mission.id, MISSIONS);
        if (mission.phase !== 'patrol' && settlement.rank) next = recordRank(next, mission.id, settlement.rank);
      }
    }
    this.commit(next);
  }

  /** Shows a settlement that has already been booked. */
  showSettlement(settlement: Settlement, mission: Mission): void {
    this.show('settlement', new SettlementScreen(this, settlement, mission), trackFor('settlement', settlement));
  }

  /** Marks a scene as seen and goes on to the hub, or to the next scene that is due. */
  finishScene(scene: Scene): void {
    if (this.game) {
      const next = markSceneSeen(this.game, scene);
      if (next !== this.game) this.commit(next);
    }
    this.openHub();
  }

  update(dtMs: number): void {
    this.entering.left = Math.max(0, this.entering.left - dtMs);
    this.current.update(dtMs);
    if (this.game && this.name !== 'title' && this.name !== 'callsign') this.played += dtMs;
    this.stepToast(dtMs);
  }

  /** One announcement at a time, and none over a battle: they wait for the settlement. */
  private stepToast(dtMs: number): void {
    if (this.toast) {
      this.toast.left -= dtMs;
      if (this.toast.left <= 0) this.toast = null;
      return;
    }
    if (this.toasts.length === 0 || this.name === 'battle') return;
    this.toast = { medal: this.toasts.shift()!, left: TOAST_MS };
    this.deps.sfx?.play('medal');
  }

  /** A medal's announcement: a strip that slides down from the top edge, stays, and slides back. */
  private drawToast(ctx: CanvasRenderingContext2D): void {
    if (!this.toast) return;
    const { medal, left } = this.toast;
    const slide = Math.min(1, left / TOAST_SLIDE_MS, (TOAST_MS - left) / TOAST_SLIDE_MS);
    const w = 176;
    const h = 28;
    const x = Math.round((LOGICAL_W - w) / 2);
    const y = Math.round(-h + (h + 16) * (this.deps.fast ? 1 : Math.max(0, slide)));
    // Nothing of the screen underneath shows through.
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(x, y, w, h);
    drawPanel(ctx, x, y, w, h);
    drawMedal(ctx, x + 6, y + 9, medal.tier, true);
    drawText(ctx, STRINGS.medals.earned, x + 20, y + 2, { color: COLORS.dim, size: 10 });
    drawText(ctx, medal.name, x + 20, y + 12, { color: COLORS.accent });
    drawText(ctx, STRINGS.medals.pay(MEDAL_PAY[medal.tier]), x + w - 6, y + 12, { align: 'right', color: COLORS.armor });
  }

  private drawScreen(ctx: CanvasRenderingContext2D): void {
    this.current.draw(ctx);
    const { left, total, shutter } = this.entering;
    if (left <= 0) return;
    const p = left / total;
    if (shutter) {
      // Two black leaves that draw back to the top and the bottom.
      const h = Math.ceil((LOGICAL_H / 2) * p);
      ctx.fillStyle = '#04040c';
      ctx.fillRect(0, 0, LOGICAL_W, h);
      ctx.fillRect(0, LOGICAL_H - h, LOGICAL_W, h);
    } else {
      ctx.fillStyle = `rgba(4, 4, 12, ${p.toFixed(3)})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawScreen(ctx);
    this.drawToast(ctx);
  }
  onInput(action: InputAction): void { this.current.onInput(action); }

  snapshot(): unknown {
    const game = this.game;
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
      toast: this.toast?.medal.id ?? null,
      toasts: this.toasts.map((medal) => medal.id),
      saveFailed: this.saveFailed,
      ...this.current.view(),
    };
  }
}
