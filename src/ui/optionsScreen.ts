import { DIFFICULTIES, LIGHT_DETAILS, TEXT_SPEEDS, type LightDetail, type Settings } from '../core/game';
import { LANGUAGES } from '../content/language';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

const O = STRINGS.options;
type Toggle = 'sfx' | 'music' | 'fastBattles' | 'rumble';
const KEYS: (keyof Settings)[] = ['sfx', 'music', 'rumble', 'fastBattles', 'textSpeed', 'calm', 'detail', 'difficulty', 'swapAB', 'language'];
/** The choices for how much light is drawn, in the order they are stepped through: the game's own choice first. */
const DETAILS: ('auto' | LightDetail)[] = ['auto', ...LIGHT_DETAILS];
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
          : key === 'language' ? O.languages[settings.language ?? 'en']
            : key === 'textSpeed' ? O.textSpeeds[settings.textSpeed ?? 'normal']
              : key === 'calm' ? (settings.calm ? O.calmed : O.full)
                : key === 'detail' ? this.detailNote()
                  : this.isOn(key as Toggle) ? O.on : O.off;
    this.list.setItems([
      ...KEYS.map((key) => ({ id: key as string, label: O[key], enabled: true, note: value(key) })),
      // Once an ending has been seen, the end roll can be watched again from here.
      ...(this.app.canWatchCredits() ? [{ id: CREDITS, label: O.credits, enabled: true, note: O.watch }] : []),
      // While a game is on, this is the way to the title: to another kept game, or a new one.
      ...(this.app.game ? [{ id: TITLE, label: O.title, enabled: true, ...(this.warned ? { note: O.unsaved } : {}) }] : []),
    ]);
  }

  /** What the row for the light says: the player's choice, or Auto with what the game has had to turn it down to. */
  private detailNote(): string {
    const chosen = this.app.settings.detail;
    if (chosen) return O.details[chosen];
    const now = this.app.lightNow();
    return now === 'full' ? O.details.auto : O.detailAuto[now as 'lean' | 'bare'];
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
    } else if (key === 'language') {
      // The words on this very screen change with it: the list is made again below.
      const n = LANGUAGES.length;
      this.app.setSettings({ ...settings, language: LANGUAGES[(LANGUAGES.indexOf(settings.language ?? 'en') + step + n) % n] });
    } else if (key === 'swapAB') {
      // Kept only while it is on, so settings without it stay as they always were.
      const { swapAB, ...rest } = settings;
      this.app.setSettings(swapAB ? rest : { ...rest, swapAB: true });
    } else if (key === 'calm') {
      const { calm, ...rest } = settings;
      this.app.setSettings(calm ? rest : { ...rest, calm: true });
    } else if (key === 'detail') {
      // Kept only when the player chose: left to the game, there is nothing to keep.
      const n = DETAILS.length;
      const { detail, ...rest } = settings;
      const next = DETAILS[(DETAILS.indexOf(detail ?? 'auto') + step + n) % n];
      this.app.setSettings(next === 'auto' ? rest : { ...rest, detail: next });
      // Handed back to the game, it starts from all of the light and judges afresh.
      if (next === 'auto') this.app.judgeAfresh();
    } else if (key === 'textSpeed') {
      // Kept only when it is not the ordinary speed.
      const n = TEXT_SPEEDS.length;
      const { textSpeed, ...rest } = settings;
      const next = TEXT_SPEEDS[(TEXT_SPEEDS.indexOf(textSpeed ?? 'normal') + step + n) % n];
      this.app.setSettings(next === 'normal' ? rest : { ...rest, textSpeed: next });
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
    return { menu: { items: this.list.items, cursor: this.list.cursor }, light: this.app.lightNow() };
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
    // With every entry there, the list is eleven rows: it starts high enough that they all fit above the help and the hint.
    const rows = this.list.items.length;
    const top = 30;
    const first = top + 30;
    const help = first + rows * LINE + 6;
    drawPanel(ctx, x, top, w, help + 31 - top);
    drawText(ctx, O.heading, LOGICAL_W / 2, top + 6, { size: 16, align: 'center', color: COLORS.accent });
    drawList(ctx, this.list, x + 14, first, w - 34, rows);
    const selected = this.list.selected?.id;
    const words = selected === 'difficulty' ? O.difficultyHelp[this.app.settings.difficulty]
      : selected === 'swapAB' ? O.swapHelp : selected === 'calm' ? O.calmHelp : selected === 'detail' ? O.detailHelp
        : selected === TITLE && this.warned ? O.unsavedHelp : null;
    if (words) drawText(ctx, words, LOGICAL_W / 2, help, { align: 'center', color: COLORS.text, size: 10 });
    drawText(ctx, O.hint, LOGICAL_W / 2, help + 14, { align: 'center', color: COLORS.dim });
  }
}
