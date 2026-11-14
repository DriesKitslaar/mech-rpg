import { DIFFICULTIES, type Settings } from '../core/game';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

const O = STRINGS.options;
type Toggle = 'sfx' | 'music' | 'fastBattles' | 'rumble';
const KEYS: (keyof Settings)[] = ['sfx', 'music', 'rumble', 'fastBattles', 'difficulty', 'swapAB'];
/** The entries that are not settings: the end roll once more, and the way back to the title. */
const CREDITS = 'credits';
const TITLE = 'title';

/** Sound, music, battle speed, difficulty and which button confirms. Opened from the title or the hub, and returns to where it came from. */
export class OptionsScreen implements Screen {
  private list = new MenuList();
  /** True once the player has been told that leaving now loses a change that could not be saved. */
  private warned = false;

  constructor(private app: App, private back: () => void) {
    this.refresh();
  }

  private refresh(): void {
    const settings = this.app.settings;
    const value = (key: keyof Settings): string =>
      key === 'difficulty' ? O.difficulties[settings.difficulty]
        : key === 'swapAB' ? (settings.swapAB ? O.swapped : O.normal)
          : this.isOn(key as Toggle) ? O.on : O.off;
    this.list.setItems([
      ...KEYS.map((key) => ({ id: key as string, label: O[key], enabled: true, note: value(key) })),
      // Once an ending has been seen, the end roll can be watched again from here.
      ...(this.app.canWatchCredits() ? [{ id: CREDITS, label: O.credits, enabled: true, note: O.watch }] : []),
      // While a game is on, this is the way to the title: to another kept game, or a new one.
      ...(this.app.game ? [{ id: TITLE, label: O.title, enabled: true, ...(this.warned ? { note: O.unsaved } : {}) }] : []),
    ]);
  }

  private isAction(): boolean {
    const id = this.list.selected?.id;
    return id === CREDITS || id === TITLE;
  }

  /** Whether a switch is on. Rumble is on in a game saved before there was a switch for it. */
  private isOn(key: Toggle): boolean {
    return key === 'rumble' ? this.app.settings.rumble !== false : this.app.settings[key];
  }

  /** The entries that do something rather than hold a setting: only a confirm sets them off. */
  private act(): void {
    if (this.list.selected!.id === CREDITS) return this.app.showCredits();
    // Every change is saved as it is made. One that could not be is tried once more; if it still cannot
    // be, leaving would lose it, so the first press only says so.
    if (!this.app.saveNow() && !this.warned) {
      this.warned = true;
      return this.refresh();
    }
    this.app.quitToTitle();
  }

  /** Flips a switch, or steps the difficulty one way or the other. */
  private change(step: number): void {
    const settings = this.app.settings;
    const id = this.list.selected!.id;
    if (id === CREDITS || id === TITLE) {
      if (step === 0) this.act();
      return;
    }
    const key = id as keyof Settings;
    if (key === 'difficulty') {
      const n = DIFFICULTIES.length;
      const difficulty = DIFFICULTIES[(DIFFICULTIES.indexOf(settings.difficulty) + step + n) % n];
      this.app.setSettings({ ...settings, difficulty });
    } else if (key === 'swapAB') {
      // Kept only while it is on, so settings without it stay as they always were.
      const { swapAB, ...rest } = settings;
      this.app.setSettings(swapAB ? rest : { ...rest, swapAB: true });
    } else this.app.setSettings({ ...settings, [key]: !this.isOn(key as Toggle) });
    this.refresh();
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.back();
    else if (action === 'confirm') this.change(this.isAction() ? 0 : 1);
    else if (action === 'right') this.change(1);
    else if (action === 'left') this.change(-1);
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const bg = this.app.deps.sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    const w = 230;
    const x = (LOGICAL_W - w) / 2;
    // The panel grows with the list: the line of help and the hint sit under however many rows there are.
    const rows = this.list.items.length;
    const help = 96 + rows * LINE + 6;
    drawPanel(ctx, x, 64, w, help + 31 - 64);
    drawText(ctx, O.heading, LOGICAL_W / 2, 70, { size: 16, align: 'center', color: COLORS.accent });
    drawList(ctx, this.list, x + 14, 96, w - 34, rows);
    const selected = this.list.selected?.id;
    const words = selected === 'difficulty' ? O.difficultyHelp[this.app.settings.difficulty]
      : selected === 'swapAB' ? O.swapHelp : selected === TITLE && this.warned ? O.unsavedHelp : null;
    if (words) drawText(ctx, words, LOGICAL_W / 2, help, { align: 'center', color: COLORS.text, size: 10 });
    drawText(ctx, O.hint, LOGICAL_W / 2, help + 14, { align: 'center', color: COLORS.dim });
  }
}
