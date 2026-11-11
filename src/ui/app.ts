import { validatePlayerBuild } from '../core/build';
import {
  availableMissions, campaignComplete, chosenFaction, completeMission, markRead, stockFor, unreadMessages,
  type Faction, type Mission,
} from '../core/campaign';
import { applySettlement, settle, type Settlement } from '../core/economy';
import { ensureArmed, newGame, type GameState } from '../core/game';
import { startMissionBattle } from '../core/mission';
import type { BuildError, Catalog, Part } from '../core/types';
import { ENEMIES } from '../content/enemies';
import { MESSAGES, MISSIONS } from '../content/missions';
import { SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../content/parts';
import { STRINGS } from '../content/strings';
import type { Sfx } from '../platform/audio';
import type { InputAction } from '../platform/input';
import type { SaveFile } from '../platform/storage';
import { BattleFlow, BattleScreen } from './battleScreen';
import { BriefingScreen } from './briefingScreen';
import { EndingScreen } from './endingScreen';
import { GarageScreen } from './garageScreen';
import { HubScreen } from './hubScreen';
import type { ListItem } from './menuList';
import { MessagesScreen } from './messagesScreen';
import { SettlementScreen } from './settlementScreen';
import { ShopScreen } from './shopScreen';
import type { SpriteStore } from './sprites';
import { TitleScreen } from './titleScreen';

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

export type ScreenName = 'title' | 'hub' | 'garage' | 'shop' | 'messages' | 'briefing' | 'battle' | 'settlement' | 'ending';

export interface AppDeps {
  catalog: Catalog;
  save: SaveFile;
  sprites: SpriteStore;
  sfx?: Sfx;
  /** Skips message pauses and effects; used by tests. */
  fast: boolean;
  seed: number;
}

/** A contract in progress: its battles in order, each starting where the last one left the mech. */
class MissionHost implements Screen {
  private index = 0;
  private flow!: BattleFlow;
  private screen!: BattleScreen;
  /** The contract's outcome, once it has been booked. */
  private settlement: Settlement | null = null;

  constructor(private app: App, private mission: Mission, private seed: number) {
    this.begin();
  }

  private begin(): void {
    const { catalog, sprites, sfx, fast } = this.app.deps;
    const total = this.mission.battles.length;
    const state = startMissionBattle(
      this.app.game!.build, this.mission, this.index, ENEMIES, catalog, this.seed, this.index > 0 ? this.flow.state : undefined,
    );
    this.flow = new BattleFlow(state, catalog);
    this.screen = new BattleScreen(this.flow, sprites, catalog, {
      fast, sfx,
      background: this.mission.battles[this.index].background,
      label: total > 1 ? STRINGS.mission.engagement(this.index + 1, total) : '',
      resultHint: this.hasNext() ? STRINGS.mission.next : STRINGS.hints.result,
    });
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
    this.settlement = settle(this.flow.state, this.mission.reward, this.app.deps.catalog);
    this.app.bookSettlement(this.settlement, this.mission);
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
      this.index += 1;
      this.begin();
    }
  }

  view(): ScreenView {
    const { flow } = this;
    return {
      menu: flow.menu,
      message: flow.message,
      battle: {
        phase: flow.phase, outcome: flow.state.outcome, round: flow.state.round, message: flow.message,
        mission: this.mission.id, index: this.index, of: this.mission.battles.length,
        targetId: flow.targetId, targetPart: flow.targetPart, shown: flow.eventsShown,
      },
    };
  }
}

/** Owns the game state and the current screen, and moves between screens. */
export class App {
  game: GameState | null = null;
  /** True when the last attempt to save was refused by the device. */
  saveFailed = false;
  private name: ScreenName = 'title';
  private current: Screen;
  private seed: number;

  constructor(readonly deps: AppDeps) {
    this.seed = deps.seed;
    this.current = new TitleScreen(this);
  }

  get screen(): ScreenName {
    return this.name;
  }

  /** The saved game, if there is a usable one. */
  loadSave(): GameState | null {
    return this.deps.save.load();
  }

  /** True when something is saved that this version cannot read. */
  saveIsUnusable(): boolean {
    return this.deps.save.hasUnusableData();
  }

  startNewGame(): void {
    this.commit(newGame(this.deps.catalog, STARTER_BUILD));
    this.go('hub');
  }

  continueGame(saved: GameState): void {
    this.game = saved;
    this.go('hub');
  }

  /** Replaces the game state and saves it. */
  commit(next: GameState): void {
    this.game = next;
    this.saveFailed = !this.deps.save.save(next);
  }

  /** Why the current build may not deploy; empty when it may. */
  buildErrors(): BuildError[] {
    return this.game ? validatePlayerBuild(this.game.build, this.deps.catalog) : [];
  }

  /** The contracts on offer now. The patrol is always among them. */
  missions(): Mission[] {
    return this.game ? availableMissions(this.game, MISSIONS) : [];
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

  private offered(missionId: string): Mission | undefined {
    return this.missions().find((m) => m.id === missionId);
  }

  openBriefing(missionId: string): void {
    const mission = this.offered(missionId);
    if (!mission) return;
    this.current = new BriefingScreen(this, mission);
    this.name = 'briefing';
  }

  /** Starts a contract, unless the build may not deploy or the contract is not on offer. */
  startMission(missionId: string): void {
    const mission = this.offered(missionId);
    if (!mission || this.buildErrors().length > 0) return;
    this.seed = (this.seed + 101) % 2147483647;
    this.current = new MissionHost(this, mission, this.seed);
    this.name = 'battle';
  }

  go(name: ScreenName): void {
    switch (name) {
      case 'title': this.current = new TitleScreen(this); break;
      case 'hub': return this.openHub(false);
      case 'garage': this.current = new GarageScreen(this); break;
      case 'shop': this.current = new ShopScreen(this); break;
      case 'messages': this.current = new MessagesScreen(this); break;
      default: return; // briefings, battles, settlements and endings open through their own methods
    }
    this.name = name;
  }

  /**
   * Opens the hub, optionally straight on the contract list. Two things are checked on the way in:
   * a pilot without any weapon is issued one, and an ending that was earned but never seen is shown first.
   */
  openHub(onContracts: boolean): void {
    const game = this.game;
    if (game) {
      const armed = ensureArmed(game, this.deps.catalog, STARTER_BUILD.rightHand!);
      if (armed !== game) this.commit(armed);
      const faction = chosenFaction(armed, MISSIONS);
      if (campaignComplete(armed, MISSIONS) && !armed.endingSeen && faction) return this.showEnding(faction);
    }
    this.current = new HubScreen(this, onContracts);
    this.name = 'hub';
  }

  /** Records a contract's outcome: money, the win, and the contract itself when it was won. */
  bookSettlement(settlement: Settlement, mission: Mission): void {
    let next = applySettlement(this.game!, settlement);
    if (settlement.won) next = completeMission(next, mission.id, MISSIONS);
    this.commit(next);
  }

  /** Shows a settlement that has already been booked. */
  showSettlement(settlement: Settlement, mission: Mission): void {
    this.current = new SettlementScreen(this, settlement, mission);
    this.name = 'settlement';
  }

  showEnding(faction: Faction): void {
    this.current = new EndingScreen(this, faction);
    this.name = 'ending';
  }

  /** Marks the ending as seen and returns to the hub. */
  finishEnding(): void {
    if (this.game && !this.game.endingSeen) this.commit({ ...this.game, endingSeen: true });
    this.openHub(false);
  }

  update(dtMs: number): void { this.current.update(dtMs); }
  draw(ctx: CanvasRenderingContext2D): void { this.current.draw(ctx); }
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
      saveFailed: this.saveFailed,
      ...this.current.view(),
    };
  }
}
