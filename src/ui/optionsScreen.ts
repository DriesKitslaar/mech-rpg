import type { Settings } from '../core/game';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, drawList, drawPanel, drawText } from './widgets';

const O = STRINGS.options;
const KEYS: (keyof Settings)[] = ['sfx', 'music', 'fastBattles'];

/** Sound, music and battle speed. Opened from the title or the hub, and returns to where it came from. */
export class OptionsScreen implements Screen {
  private list = new MenuList();

  constructor(private app: App, private back: () => void) {
    this.refresh();
  }

  private refresh(): void {
    const settings = this.app.settings;
    this.list.setItems(KEYS.map((key) => ({ id: key, label: O[key], enabled: true, note: settings[key] ? O.on : O.off })));
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.back();
    else if (action === 'confirm' || action === 'left' || action === 'right') {
      const key = this.list.selected!.id as keyof Settings;
      this.app.setSettings({ ...this.app.settings, [key]: !this.app.settings[key] });
      this.refresh();
    }
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

    const w = 200;
    const x = (LOGICAL_W - w) / 2;
    drawPanel(ctx, x, 80, w, 86);
    drawText(ctx, O.heading, LOGICAL_W / 2, 86, { size: 16, align: 'center', color: COLORS.accent });
    drawList(ctx, this.list, x + 14, 112, w - 34, 3);
    drawText(ctx, O.hint, LOGICAL_W / 2, 150, { align: 'center', color: COLORS.dim });
  }
}
