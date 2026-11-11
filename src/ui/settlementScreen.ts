import type { Settlement } from '../core/economy';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS, LINE, drawPanel, drawText } from './widgets';

const S = STRINGS.settlement;

/** The bill after a battle: reward, ammunition, repairs and what is left. */
export class SettlementScreen implements Screen {
  constructor(private app: App, private settlement: Settlement) {}

  update(): void {}

  onInput(action: InputAction): void {
    // The settlement is already booked; this screen only shows it.
    if (action === 'confirm') this.app.go('hub');
  }

  view(): ScreenView {
    const { net, won, reward, ammoCost, repairCost } = this.settlement;
    return { menu: { items: [], cursor: 0 }, settlement: { net, won, reward, ammoCost, repairCost } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.settlement;
    const { catalog, sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    const x = 40;
    const w = LOGICAL_W - 80;
    const right = x + w - 10;
    drawPanel(ctx, x, 20, w, 230);
    drawText(ctx, s.won ? S.won : S.lost, LOGICAL_W / 2, 26, { size: 16, align: 'center', color: s.won ? COLORS.accent : COLORS.danger });

    let y = 52;
    const row = (label: string, amount: number, color: string = COLORS.text): void => {
      drawText(ctx, label, x + 10, y, { color: COLORS.text });
      drawText(ctx, amount > 0 ? `+${amount}` : String(amount), right, y, { align: 'right', color });
      y += LINE + 1;
    };
    row(S.reward, s.reward, s.reward > 0 ? COLORS.armor : COLORS.dim);
    row(S.ammo, -s.ammoCost, s.ammoCost > 0 ? COLORS.danger : COLORS.dim);
    row(S.repairs, -s.repairCost, s.repairCost > 0 ? COLORS.danger : COLORS.dim);
    // Up to six repair lines fit; the total above always covers all of them.
    for (const line of s.lines.slice(0, 6)) {
      drawText(ctx, `  ${catalog[line.partId]?.name ?? line.partId}`, x + 10, y, { color: COLORS.dim });
      drawText(ctx, String(-line.cost), right, y, { align: 'right', color: COLORS.dim });
      y += LINE;
    }

    ctx.fillStyle = COLORS.border;
    ctx.fillRect(x + 10, 180, w - 20, 1);
    drawText(ctx, S.net, x + 10, 186, { size: 16 });
    drawText(ctx, s.net > 0 ? `+${s.net}` : String(s.net), right, 186, { size: 16, align: 'right', color: s.net >= 0 ? COLORS.armor : COLORS.danger });
    const balance = this.app.game!.credits; // already includes this settlement
    drawText(ctx, S.balance, x + 10, 206, { color: COLORS.dim });
    drawText(ctx, String(balance), right, 206, { align: 'right', color: balance < 0 ? COLORS.danger : COLORS.text });
    drawText(ctx, S.continue, LOGICAL_W / 2, 230, { align: 'center', color: COLORS.dim });
  }
}
