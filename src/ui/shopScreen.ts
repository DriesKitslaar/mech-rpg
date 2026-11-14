import { SHOP_PARTS } from '../content/parts';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawPartIcon, hasIcon } from './partIcon';
import { compareParts, fittedFor, partLines } from './partInfo';
import { SHOP_TABS, ShopFlow } from './shopFlow';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

const S = STRINGS.shop;
const LIST_W = 168;
const ROWS = 12;

/** Draws the shop and passes its results to the app: every trade is saved at once. */
export class ShopScreen implements Screen {
  private flow: ShopFlow;

  constructor(private app: App) {
    this.flow = new ShopFlow(app.game!, app.deps.catalog, app.stock(), SHOP_PARTS);
  }

  update(): void {}

  onInput(action: InputAction): void {
    const result = this.flow.onInput(action);
    if (result === 'changed') {
      this.app.commit(this.flow.game);
      // The next change starts from the game as it was saved, not from the copy made before it.
      this.flow.adopt(this.app.game!);
    } else if (result === 'exit') this.app.go('hub');
  }

  view(): ScreenView {
    const { flow } = this;
    return {
      menu: { items: flow.list.items, cursor: flow.list.cursor },
      message: flow.message,
      shop: { tab: flow.tab, mode: flow.mode, selected: flow.selected?.id ?? null },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const { sprites } = this.app.deps;
    const game = this.app.game!;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.5)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, S.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, `${game.credits} ${S.credits}`, LOGICAL_W - 5, 1, { align: 'right', color: game.credits < 0 ? COLORS.danger : COLORS.text });
    // Buy and sell side by side, the active one lit.
    drawText(ctx, S.buy, 120, 1, { color: flow.mode === 'buy' ? COLORS.accent : COLORS.dim });
    drawText(ctx, S.sell, 150, 1, { color: flow.mode === 'sell' ? COLORS.accent : COLORS.dim });

    // Category tabs.
    drawPanel(ctx, 0, 16, LOGICAL_W, 15);
    const tabW = LOGICAL_W / SHOP_TABS.length;
    SHOP_TABS.forEach((tab, i) => {
      const active = tab === flow.tab;
      if (active) { ctx.fillStyle = COLORS.accent; ctx.fillRect(Math.round(i * tabW) + 3, 29, Math.round(tabW) - 6, 1); }
      drawText(ctx, S.tabs[tab], Math.round(i * tabW + tabW / 2), 18, { align: 'center', color: active ? COLORS.accent : COLORS.dim });
    });

    drawPanel(ctx, 0, 33, LIST_W, 200);
    drawList(ctx, flow.list, 6, 39, LIST_W - 20, ROWS);

    this.drawDetail(ctx, LIST_W + 2, 33, LOGICAL_W - LIST_W - 2, 200);

    drawPanel(ctx, 0, 235, LOGICAL_W, LOGICAL_H - 235);
    const refused = flow.message === S.cannotAfford || flow.message === S.inUse || flow.message === S.needWeapon;
    if (flow.message) drawText(ctx, flow.message, LOGICAL_W / 2, 240, { align: 'center', size: 16, color: refused ? COLORS.danger : COLORS.armor });
    else drawText(ctx, S.hint, LOGICAL_W / 2, 243, { align: 'center', color: COLORS.dim });
  }

  private drawDetail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    drawPanel(ctx, x, y, w, h);
    const part = this.flow.selected;
    if (!part) return;
    const { sprites } = this.app.deps;

    // Picture: arms show the outstretched arm; parts that sit inside the mech get an icon.
    const boxH = 72;
    const cx = x + w / 2;
    const cy = y + 6 + boxH / 2;
    if (hasIcon(part.kind)) {
      drawPartIcon(ctx, part.kind, cx, cy);
    } else {
      const id = part.kind === 'arms' ? `${part.id}.near` : part.id;
      const sprite = sprites.get(id, { w: 48, h: 48, label: part.name });
      // Large layers are shown at half size so they fit the panel.
      const scale = sprite.w > w - 12 || sprite.h > boxH ? 0.5 : 1;
      const dw = Math.round(sprite.w * scale);
      const dh = Math.round(sprite.h * scale);
      ctx.drawImage(sprite.image, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
    }

    let ty = y + boxH + 10;
    drawText(ctx, part.name, x + 6, ty, { color: COLORS.accent });
    ty += LINE;
    if (part.vendor) { drawText(ctx, STRINGS.partInfo.vendors[part.vendor], x + 6, ty, { color: COLORS.dim }); ty += LINE; }
    for (const line of partLines(part)) { drawText(ctx, line, x + 6, ty); ty += LINE; }

    // How it differs from what is fitted now: green for better, red for worse.
    const fitted = fittedFor(part, this.app.game!.build, this.app.deps.catalog);
    const rows = fitted && fitted.id !== part.id ? compareParts(part, fitted) : [];
    if (fitted && rows.length > 0 && ty + (rows.length + 1) * LINE <= y + h - 2) {
      ty += 2;
      drawText(ctx, STRINGS.partInfo.versus(fitted.name), x + 6, ty, { color: COLORS.dim, size: 10 });
      ty += LINE - 1;
      for (const row of rows) {
        // Placed by characters from the left edge, so rounding never adds up along a row.
        let chars = 0;
        for (const chip of row) {
          drawText(ctx, chip.text, x + 6 + Math.round(chars * 4.8), ty, { color: chip.good ? COLORS.armor : COLORS.danger });
          chars += chip.text.length + 2;
        }
        ty += LINE;
      }
    }
  }
}
