import { createBattle } from '../core/battle';
import { validatePlayerBuild } from '../core/build';
import { applySettlement, settle, type Settlement } from '../core/economy';
import { newGame, type GameState } from '../core/game';
import type { BuildError, Catalog } from '../core/types';
import { ENCOUNTERS, ENCOUNTER_REWARD, ENCOUNTER_UNLOCK, ENEMIES } from '../content/enemies';
import { STARTER_BUILD } from '../content/parts';
import type { Sfx } from '../platform/audio';
import type { InputAction } from '../platform/input';
import type { SaveFile } from '../platform/storage';
import { BattleFlow, BattleScreen } from './battleScreen';
import { GarageScreen } from './garageScreen';
import { HubScreen } from './hubScreen';
import type { ListItem } from './menuList';
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

export type ScreenName = 'title' | 'hub' | 'garage' | 'shop' | 'battle' | 'settlement';

export interface AppDeps {
  catalog: Catalog;
  save: SaveFile;
  sprites: SpriteStore;
  sfx?: Sfx;
  /** Skips message pauses and effects; used by tests. */
  fast: boolean;
  seed: number;
}

/** A battle in progress, wrapped so that its result leads to the settlement. */
class BattleHost implements Screen {
  readonly flow: BattleFlow;
  private screen: BattleScreen;

  constructor(private app: App, readonly encounter: string, seed: number) {
    const { catalog, sprites, sfx, fast } = app.deps;
    const enemies = ENCOUNTERS[encounter].map((id) => ENEMIES[id]);
    this.flow = new BattleFlow(createBattle(app.game!.build, enemies, catalog, seed), catalog);
    this.screen = new BattleScreen(this.flow, sprites, catalog, { fast, sfx });
  }

  update(dtMs: number): void { this.screen.update(dtMs); }
  draw(ctx: CanvasRenderingContext2D): void { this.screen.draw(ctx); }

  onInput(action: InputAction): void {
    if (this.flow.phase !== 'result') { this.screen.onInput(action); return; }
    if (action === 'confirm') {
      this.app.showSettlement(settle(this.flow.state, ENCOUNTER_REWARD[this.encounter] ?? 0, this.app.deps.catalog));
    }
  }

  view(): ScreenView {
    const { flow } = this;
    return {
      menu: flow.menu,
      message: flow.message,
      battle: {
        phase: flow.phase, outcome: flow.state.outcome, round: flow.state.round, message: flow.message,
        encounter: this.encounter, targetId: flow.targetId, targetPart: flow.targetPart, shown: flow.eventsShown,
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

  /** The contracts on offer now. The first is always available, so a pilot can never run out of work. */
  availableEncounters(): { id: string; reward: number }[] {
    const won = this.game?.battlesWon ?? 0;
    return Object.keys(ENCOUNTERS)
      .filter((id) => won >= (ENCOUNTER_UNLOCK[id] ?? 0))
      .map((id) => ({ id, reward: ENCOUNTER_REWARD[id] ?? 0 }));
  }

  /** Starts a contract, unless the build may not deploy or the contract is not on offer. */
  startBattle(encounter: string): void {
    if (this.buildErrors().length > 0 || !this.availableEncounters().some((e) => e.id === encounter)) return;
    this.seed = (this.seed + 1) % 2147483647;
    this.current = new BattleHost(this, encounter, this.seed);
    this.name = 'battle';
  }

  go(name: ScreenName): void {
    switch (name) {
      case 'title': this.current = new TitleScreen(this); break;
      case 'hub': this.current = new HubScreen(this); break;
      case 'garage': this.current = new GarageScreen(this); break;
      case 'shop': this.current = new ShopScreen(this); break;
      default: return; // battles start through startBattle, and the settlement follows a battle
    }
    this.name = name;
  }

  /**
   * Books a settlement and shows it. It is saved before the screen appears, so closing the game
   * there can neither lose a reward nor dodge a bill.
   */
  showSettlement(settlement: Settlement): void {
    this.commit(applySettlement(this.game!, settlement));
    this.current = new SettlementScreen(this, settlement);
    this.name = 'settlement';
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
      build: game?.build ?? null,
      inventory: game?.inventory ?? null,
      saveFailed: this.saveFailed,
      ...this.current.view(),
    };
  }
}
