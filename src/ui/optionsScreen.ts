import { DIFFICULTIES, type Settings } from '../core/game';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, drawList, drawPanel, drawText } from './widgets';

const O = STRINGS.options;
type Toggle = 'sfx' | 'music' | 'fastBattles';
const KEYS: (keyof Settings)[] = ['sfx', 'music', 'fastBattles', 'difficulty'];

/** Sound, music, battle speed and difficulty. Opened from the title or the hub, and returns to where it came from. */
export class OptionsScreen implements Screen {
  private list = new MenuList();

  constructor(private app: App, private back: () => void) {
    this.refresh();
  }

  private refresh(): void {
    const settings = this.app.settings;
    const value = (key: keyof Settings): string =>
      (key === 'difficulty' ? O.difficulties[settings.difficulty] : settings[key] ? O.on : O.off);
    this.list.setItems(KEYS.map((key) => ({ id: key, label: O[key], enabled: true, note: value(key) })));
  }

  /** Flips a switch, or steps the difficulty one way or the other. */
  private change(step: number): void {
    const settings = this.app.settings;
    const key = this.list.selected!.id as keyof Settings;
    if (key === 'difficulty') {
      const n = DIFFICULTIES.length;
      const difficulty = DIFFICULTIES[(DIFFICULTIES.indexOf(settings.difficulty) + step + n) % n];
      this.app.setSettings({ ...settings, difficulty });
    } else this.app.setSettings({ ...settings, [key]: !settings[key as Toggle] });
    this.refresh();
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.back();
    else if (action === 'confirm' || action === 'right') this.change(1);
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
    drawPanel(ctx, x, 70, w, 112);
    drawText(ctx, O.heading, LOGICAL_W / 2, 76, { size: 16, align: 'center', color: COLORS.accent });
    drawList(ctx, this.list, x + 14, 102, w - 34, KEYS.length);
    if (this.list.selected?.id === 'difficulty') {
      drawText(ctx, O.difficultyHelp[this.app.settings.difficulty], LOGICAL_W / 2, 152, { align: 'center', color: COLORS.text, size: 10 });
    }
    drawText(ctx, O.hint, LOGICAL_W / 2, 166, { align: 'center', color: COLORS.dim });
  }
}
