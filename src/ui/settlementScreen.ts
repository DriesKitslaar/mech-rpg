import type { Mission } from '../core/campaign';
import type { Settlement } from '../core/economy';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS, LINE, charsFor, drawPanel, drawText, wrap } from './widgets';

const S = STRINGS.settlement;
/** When the rank comes down, how long it takes to land, and how long the net amount takes to count up. */
const STAMP_AT = 500;
const STAMP_MS = 160;
const COUNT_MS = 700;

/** The bill after a battle: reward, ammunition, repairs and what is left. */
export class SettlementScreen implements Screen {
  private clock = 0;

  constructor(private app: App, private settlement: Settlement, private mission: Mission) {}

  update(dtMs: number): void {
    const before = this.clock;
    this.clock += dtMs;
    if (this.settlement.rank && before < STAMP_AT && this.clock >= STAMP_AT) this.app.deps.sfx?.play('stamp');
  }

  onInput(action: InputAction): void {
    // The settlement is already booked; this screen only shows it.
    // After a won finale the hub shows the ending first.
    if (action === 'confirm') this.app.go('hub');
  }

  view(): ScreenView {
    const { net, won, reward, ammoCost, repairCost, rank, bonus } = this.settlement;
    return { menu: { items: [], cursor: 0 }, settlement: { net, won, reward, ammoCost, repairCost, rank: rank ?? null, bonus: bonus ?? 0 } };
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
    drawText(ctx, this.mission.title, LOGICAL_W / 2, 42, { align: 'center', color: COLORS.dim });
    drawText(ctx, s.won ? S.won : S.lost, LOGICAL_W / 2, 26, { size: 16, align: 'center', color: s.won ? COLORS.accent : COLORS.danger });
    const fast = this.app.deps.fast;
    if (s.rank) {
      // How well it was done, in the corner: S and A are the ones that pay. It is stamped on a moment after the bill appears.
      const color = s.rank === 'S' ? COLORS.accent : s.rank === 'A' ? COLORS.armor : s.rank === 'B' ? COLORS.text : COLORS.dim;
      drawText(ctx, S.rank, right - 16, 33, { size: 10, align: 'right', color: COLORS.dim });
      if (fast || this.clock >= STAMP_AT) {
        const landed = fast ? 1 : Math.min(1, (this.clock - STAMP_AT) / STAMP_MS);
        const scale = 3 - 2 * landed;
        ctx.save();
        ctx.translate(right - 6, 36);
        ctx.scale(scale, scale);
        drawText(ctx, s.rank, 6, -16, { size: 32, align: 'right', color });
        ctx.restore();
      }
    }

    // Four rows and four repair lines, a line apart, end just above what the client says.
    let y = 55;
    const row = (label: string, amount: number, color: string = COLORS.text): void => {
      drawText(ctx, label, x + 10, y, { color: COLORS.text });
      drawText(ctx, amount > 0 ? `+${amount}` : String(amount), right, y, { align: 'right', color });
      y += LINE;
    };
    row(S.reward, s.reward, s.reward > 0 ? COLORS.armor : COLORS.dim);
    if (s.rank && s.bonus) row(S.rankBonus(s.rank), s.bonus, COLORS.armor);
    row(S.ammo, -s.ammoCost, s.ammoCost > 0 ? COLORS.danger : COLORS.dim);
    row(S.repairs, -s.repairCost, s.repairCost > 0 ? COLORS.danger : COLORS.dim);
    // Four repair lines fit; the total above always covers all of them.
    for (const line of s.lines.slice(0, 4)) {
      drawText(ctx, `  ${catalog[line.partId]?.name ?? line.partId}`, x + 10, y, { color: COLORS.dim });
      drawText(ctx, String(-line.cost), right, y, { align: 'right', color: COLORS.dim });
      y += LINE;
    }

    // After a win, what the client had to say about it.
    if (s.won) {
      wrap(this.mission.debrief, charsFor(w - 20)).slice(0, 3).forEach((line, i) =>
        drawText(ctx, line, x + 10, 144 + i * LINE, { color: COLORS.dim }));
    }

    ctx.fillStyle = COLORS.border;
    ctx.fillRect(x + 10, 180, w - 20, 1);
    drawText(ctx, S.net, x + 10, 186, { size: 16 });
    // The net amount counts up (or down) to what it is.
    const net = fast ? s.net : Math.round(s.net * Math.min(1, this.clock / COUNT_MS));
    drawText(ctx, net > 0 ? `+${net}` : String(net), right, 186, { size: 16, align: 'right', color: s.net >= 0 ? COLORS.armor : COLORS.danger });
    const balance = this.app.game!.credits; // already includes this settlement
    drawText(ctx, S.balance, x + 10, 206, { color: COLORS.dim });
    drawText(ctx, String(balance), right, 206, { align: 'right', color: balance < 0 ? COLORS.danger : COLORS.text });
    drawText(ctx, S.continue, LOGICAL_W / 2, 230, { align: 'center', color: COLORS.dim });
  }
}
