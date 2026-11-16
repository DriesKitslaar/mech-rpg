import { levelFor } from '../core/pilot';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView, SlotView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList, type ListItem } from './menuList';
import { playTime } from './record';
import { drawGlow } from './light';
import { LOGO, drawLogo, logoGleam, logoLevel, logoLights } from './logo';
import { drawSearchlights, drawTitleScene } from './titleScene';
import { drawWeather, drawWeatherExtras } from './weather';
import { COLORS, drawList, drawOutlined, drawPanel, drawText } from './widgets';

const T = STRINGS.titleScreen;
type Mode = 'main' | 'new' | 'load' | 'ask';
const slotId = (slot: number): string => `slot-${slot + 1}`;
/** Where the sign hangs: in the middle of the sky. */
export const SIGN = { x: Math.round((LOGICAL_W - LOGO.w) / 2), y: 16 };
/** Where the menu's box starts, and where it ends at the bottom whatever it holds. */
export const MENU_X = 10;
export const MENU_BOTTOM = 262;

/**
 * Continue, a new game, another of the kept games, or the options. Three games are kept; a new
 * one is started in the slot the player picks, and starting over a slot that holds anything asks first.
 */
export class TitleScreen implements Screen {
  private slots: SlotView[];
  private list: MenuList;
  private mode: Mode = 'main';
  /** The slot the question on screen is about. */
  private asked = 0;
  private clock = 0;

  constructor(private app: App) {
    this.slots = app.slots();
    this.list = this.mainMenu();
  }

  private get kept(): SlotView[] {
    return this.slots.filter((s) => s.game !== null);
  }

  /** The game Continue goes on with: the one played last, or the first there is. */
  private continued(): SlotView['game'] {
    const slot = this.app.continueSlot();
    return this.slots.find((s) => s.slot === slot)?.game ?? null;
  }

  private mainMenu(): MenuList {
    return new MenuList([
      // Continue names the pilot it goes on with: with more than one game kept, that is worth knowing.
      ...(this.kept.length > 0 ? [{ id: 'continue', label: T.continue, enabled: true, note: this.continued()?.callsign }] : []),
      { id: 'new', label: T.newGame, enabled: true },
      // With one game kept, Continue is all the loading there is to do.
      ...(this.kept.length > 1 ? [{ id: 'load', label: T.loadGame, enabled: true }] : []),
      { id: 'options', label: T.options, enabled: true },
    ]);
  }

  /** One row per slot: who is kept there and how far along, or that it is empty. */
  private slotItems(loading: boolean): ListItem[] {
    return this.slots.map(({ slot, game, unusable }) => ({
      id: slotId(slot),
      label: game ? T.slot(slot + 1, game.callsign, levelFor(game.xp)) : `${slot + 1}  ${unusable ? T.unreadable : T.empty}`,
      // An empty slot cannot be loaded; any slot can be started in.
      enabled: !loading || game !== null,
      note: game ? T.progress(game.completed.length, game.cycle, playTime(game.stats.seconds)) : undefined,
    }));
  }

  private back(): void {
    this.mode = 'main';
    this.list = this.mainMenu();
  }

  private openSlots(mode: 'new' | 'load'): void {
    this.mode = mode;
    const items = this.slotItems(mode === 'load');
    // Loading is offered the first game there is. A new game is offered the first empty slot, and one
    // holding something unreadable only when no slot is empty: that may be a game from a newer version.
    const free = (unusable: boolean) => this.slots.findIndex((s) => s.game === null && s.unusable === unusable);
    const wanted = mode === 'load' ? items.findIndex((item) => item.enabled) : free(false) >= 0 ? free(false) : free(true);
    this.list = new MenuList(items, Math.max(0, wanted));
  }

  /** The question while asking; otherwise why there is no Continue, when a game is kept but cannot be read. */
  private notice(): string {
    if (this.mode === 'ask') return this.slots[this.asked].game ? T.eraseQuestion : T.eraseUnreadable;
    if (this.mode === 'new') return T.pickNew;
    if (this.mode === 'load') return T.pickLoad;
    return this.kept.length === 0 && this.slots.some((s) => s.unusable) ? T.unusable : '';
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') return this.list.move(-1);
    if (action === 'down') return this.list.move(1);
    if (action === 'cancel') {
      if (this.mode === 'ask') this.openSlots('new');
      else if (this.mode !== 'main') this.back();
      return;
    }
    const item = this.list.selected;
    if (action !== 'confirm' || !item?.enabled) return;
    const slot = this.slots.findIndex((s) => slotId(s.slot) === item.id);
    switch (this.mode) {
      case 'main':
        if (item.id === 'continue') this.app.continueGame(this.app.continueSlot()!);
        // The very first game needs no choosing: it goes in the first slot.
        else if (item.id === 'new') { if (this.kept.length === 0 && !this.slots.some((s) => s.unusable)) this.app.askCallsign(0); else this.openSlots('new'); }
        else if (item.id === 'load') this.openSlots('load');
        else if (item.id === 'options') this.app.openOptions();
        return;
      case 'load':
        return this.app.continueGame(slot);
      case 'new':
        // Only a slot with nothing in it is started in without a question.
        if (this.slots[slot].game === null && !this.slots[slot].unusable) return this.app.askCallsign(slot);
        this.asked = slot;
        this.mode = 'ask';
        this.list = new MenuList([{ id: 'no', label: T.no, enabled: true }, { id: 'yes', label: T.yes, enabled: true }]);
        return;
      case 'ask':
        if (item.id === 'yes') this.app.askCallsign(this.asked);
        else this.openSlots('new');
        return;
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message: this.notice(), mode: this.mode };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const fast = this.app.deps.fast;
    const calm = this.app.settings.calm === true;
    // A hurried game has the picture standing still: its lights where they are at the start, no rain, the sign on.
    const clock = fast ? 0 : this.clock;
    // Varn in the rain, drifting very slightly, as if seen from a hovering frame.
    const bg = this.app.deps.sprites.get('still-varn', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    const drift = fast ? 0 : Math.round(Math.sin(this.clock / 2600) * 3);
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // Pixel for pixel: once as it is, and once more a few pixels up or down, so the drift never shows an edge.
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    if (drift !== 0) ctx.drawImage(bg.image, 0, drift, LOGICAL_W, LOGICAL_H);
    // The picture's lights, its searchlights and its mist belong to it, and drift with it.
    ctx.save();
    ctx.translate(0, drift);
    drawTitleScene(ctx, clock, calm);
    ctx.restore();
    if (!fast) {
      drawWeather(ctx, 'rain', this.clock, LOGICAL_W, LOGICAL_H);
      drawWeatherExtras(ctx, 'rain', this.clock, LOGICAL_W, LOGICAL_H, calm);
    }

    // The sign: it comes on with a flicker, throws its own light, and a gleam crosses it now and then.
    const level = fast ? 1 : logoLevel(this.clock, calm);
    for (const glow of logoLights(SIGN.x, SIGN.y, level)) drawGlow(ctx, glow, calm ? 0.5 : 1);
    drawLogo(ctx, SIGN.x, SIGN.y, { level, gleam: fast ? null : logoGleam(this.clock) });
    ctx.save();
    ctx.translate(0, drift);
    drawSearchlights(ctx, clock, calm);
    ctx.restore();
    drawOutlined(ctx, T.tagline, LOGICAL_W / 2, SIGN.y + LOGO.h + 5, { align: 'center', color: COLORS.text });

    // The menu stands at the lower left, clear of the machine on the roof that the picture is about.
    const picking = this.mode === 'new' || this.mode === 'load';
    const w = picking ? 230 : 190;
    const x = MENU_X;
    const notice = this.notice();
    const h = notice ? 70 : 56;
    const top = MENU_BOTTOM - h;
    drawPanel(ctx, x, top, w, h);
    let y = top + 6;
    if (notice) {
      drawText(ctx, notice, x + w / 2, y, { align: 'center', color: this.mode === 'ask' || this.mode === 'main' ? COLORS.danger : COLORS.dim });
      y += 14;
    }
    if (picking) drawList(ctx, this.list, x + 10, y, w - 26, 3);
    // Wide enough for the longest callsign to stand clear of Continue.
    else drawList(ctx, this.list, x + 40, y, 110, 4);
  }
}
