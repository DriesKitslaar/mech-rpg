import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, drawList, drawPanel, drawText } from './widgets';

const H = STRINGS.hub;

/** The place between battles: shows the money and leads to the sortie, the garage and the shop. */
export class HubScreen implements Screen {
  private list: MenuList;
  private clock = 0;

  constructor(private app: App) {
    const errors = app.buildErrors();
    this.list = new MenuList([
      { id: 'sortie', label: H.sortie, enabled: errors.length === 0, note: errors[0] ? STRINGS.buildErrors[errors[0]] : undefined },
      { id: 'garage', label: H.garage, enabled: true },
      { id: 'shop', label: H.shop, enabled: true },
    ], errors.length === 0 ? 0 : 1);
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'confirm' && this.list.selected?.enabled) {
      const id = this.list.selected.id;
      if (id === 'sortie') this.app.go('battle');
      else if (id === 'garage') this.app.go('garage');
      else if (id === 'shop') this.app.go('shop');
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message: this.app.saveFailed ? STRINGS.saveFailed : '' };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    drawMech(ctx, mechSprites(sprites, game.build), 4, 70, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, H.heading, 5, 1, { color: COLORS.accent });
    if (this.app.saveFailed) drawText(ctx, STRINGS.saveFailed, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.danger });

    const x = 172;
    const w = LOGICAL_W - x - 6;
    drawPanel(ctx, x, 24, w, 62);
    drawText(ctx, H.credits, x + 6, 29, { color: COLORS.dim });
    drawText(ctx, String(game.credits), x + w - 6, 27, { size: 16, align: 'right', color: game.credits < 0 ? COLORS.danger : COLORS.text });
    drawText(ctx, H.battlesWon, x + 6, 45, { color: COLORS.dim });
    drawText(ctx, String(game.battlesWon), x + w - 6, 45, { align: 'right' });
    drawText(ctx, H.next, x + 6, 59, { color: COLORS.dim });
    drawText(ctx, STRINGS.encounters[this.app.nextEncounter()] ?? this.app.nextEncounter(), x + 6, 70, { color: COLORS.accent });

    drawPanel(ctx, x, 96, w, 50);
    drawList(ctx, this.list, x + 6, 102, w - 14, 3);
  }
}
