import { createBattle } from '../core/battle';
import { validatePlayerBuild } from '../core/build';
import { applySettlement, settle, type Settlement } from '../core/economy';
import { newGame, type GameState } from '../core/game';
import type { BuildError, Catalog } from '../core/types';
import { ENCOUNTERS, ENCOUNTER_REWARD, ENEMIES } from '../content/enemies';
import { STARTER_BUILD } from '../content/parts';
import type { Sfx } from '../platform/audio';
import type { InputAction } from '../platform/input';
import type { SaveFile } from '../platform/storage';
import { BattleFlow, BattleScreen } from './battleScreen';
import { HubScreen } from './hubScreen';
import type { ListItem } from './menuList';
import { SettlementScreen } from './settlementScreen';
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

  /** The encounter the next sortie leads to. */
  nextEncounter(): string {
    const names = Object.keys(ENCOUNTERS);
    return names[(this.game?.battlesWon ?? 0) % names.length];
  }

  go(name: ScreenName): void {
    switch (name) {
      case 'title': this.current = new TitleScreen(this); break;
      case 'hub': this.current = new HubScreen(this); break;
      case 'battle':
        if (this.buildErrors().length > 0) return;
        this.seed = (this.seed + 1) % 2147483647;
        this.current = new BattleHost(this, this.nextEncounter(), this.seed);
        break;
      default: return; // garage, shop and settlement are opened through their own methods
    }
    this.name = name;
  }

  showSettlement(settlement: Settlement): void {
    this.current = new SettlementScreen(this, settlement);
    this.name = 'settlement';
  }

  /** Books a settlement and returns to the hub. */
  finishSettlement(settlement: Settlement): void {
    this.commit(applySettlement(this.game!, settlement));
    this.go('hub');
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
