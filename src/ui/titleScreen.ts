import type { GameState } from '../core/game';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawWeather } from './weather';
import { COLORS, drawList, drawPanel, drawText } from './widgets';

const T = STRINGS.titleScreen;

/** New game or continue. Starting over an existing save asks first. */
export class TitleScreen implements Screen {
  private saved: GameState | null;
  private list: MenuList;
  private asking = false;
  private clock = 0;

  constructor(private app: App) {
    this.saved = app.loadSave();
    this.list = this.mainMenu();
  }

  private mainMenu(): MenuList {
    return new MenuList([
      ...(this.saved ? [{ id: 'continue', label: T.continue, enabled: true }] : []),
      { id: 'new', label: T.newGame, enabled: true },
      { id: 'options', label: T.options, enabled: true },
    ]);
  }

  private back(): void {
    this.asking = false;
    this.list = this.mainMenu();
  }

  /** The question while asking; otherwise why there is no Continue, when a save exists but cannot be used. */
  private notice(): string {
    if (this.asking) return T.eraseQuestion;
    return !this.saved && this.app.saveIsUnusable() ? T.unusable : '';
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel' && this.asking) this.back();
    else if (action === 'confirm') {
      switch (this.list.selected?.id) {
        case 'continue': this.app.continueGame(this.saved!); break;
        case 'new':
          if (!this.saved) { this.app.startNewGame(); break; }
          this.asking = true;
          this.list = new MenuList([{ id: 'no', label: T.no, enabled: true }, { id: 'yes', label: T.yes, enabled: true }]);
          break;
        case 'options': this.app.openOptions(); break;
        case 'yes': this.app.startNewGame(); break;
        case 'no': this.back(); break;
      }
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message: this.notice() };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const fast = this.app.deps.fast;
    // Varn in the rain, drifting very slightly, as if seen from a hovering frame.
    const bg = this.app.deps.sprites.get('still-varn', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    const drift = fast ? 0 : Math.round(Math.sin(this.clock / 2600) * 3);
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // Pixel for pixel: once as it is, and once more a few pixels up or down, so the drift never shows an edge.
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    if (drift !== 0) ctx.drawImage(bg.image, 0, drift, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.4)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (!fast) drawWeather(ctx, 'rain', this.clock, LOGICAL_W, LOGICAL_H);

    drawText(ctx, STRINGS.title, LOGICAL_W / 2 + 2, 62, { size: 64, align: 'center', color: '#3b1d5a' });
    drawText(ctx, STRINGS.title, LOGICAL_W / 2, 60, { size: 64, align: 'center', color: COLORS.accent });
    if (!fast) {
      // A glint crosses the title every few seconds: the same letters, lighter, seen through a narrow moving slit.
      const sweep = (this.clock % 4200) / 900;
      if (sweep < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.round(40 + sweep * 240), 56, 12, 62);
        ctx.clip();
        drawText(ctx, STRINGS.title, LOGICAL_W / 2, 60, { size: 64, align: 'center', color: '#ffe3f2' });
        ctx.restore();
      }
    }
    drawText(ctx, T.tagline, LOGICAL_W / 2, 122, { align: 'center', color: COLORS.text });

    const w = 190;
    const x = (LOGICAL_W - w) / 2;
    const notice = this.notice();
    drawPanel(ctx, x, 160, w, notice ? 64 : 50);
    let y = 166;
    if (notice) { drawText(ctx, notice, LOGICAL_W / 2, y, { align: 'center', color: COLORS.danger }); y += 14; }
    drawList(ctx, this.list, x + 60, y, 70, 3);
  }
}
