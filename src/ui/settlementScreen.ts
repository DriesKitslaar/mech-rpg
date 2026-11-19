import type { Advice } from '../core/advice';
import type { Mission } from '../core/campaign';
import { isDrill } from '../core/training';
import type { Settlement } from '../core/economy';
import { masterOf } from '../content/masters';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { drawStamp } from './cinema';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawRoom } from './room';
import { COLORS, LINE, charsFor, drawPanel, drawText, wrap } from './widgets';

const S = STRINGS.settlement;
/** When the rank comes down, how long it takes to land, and how long the net amount takes to count up. */
const STAMP_AT = 500;
const STAMP_MS = 160;
/** Where the way out is written: its letters end above line 240, where an announcement begins. */
export const HINT_Y = 227;
const COUNT_MS = 700;

/** The bill after a battle: reward, ammunition, repairs and what is left. */
export class SettlementScreen implements Screen {
  private clock = 0;

  /** `tip` is what Dispatch has to say after a defeat, shown where the client's words go after a win. */
  constructor(private app: App, private settlement: Settlement, private mission: Mission, private tip: Advice | null = null) {}

  update(dtMs: number): void {
    const before = this.clock;
    this.clock += dtMs;
    if (this.settlement.rank && before < STAMP_AT && this.clock >= STAMP_AT) this.app.deps.sfx?.play('stamp');
  }

  onInput(action: InputAction): void {
    // The settlement is already booked; this screen only shows it.
    // After a won finale the hub shows the ending first.
    if (action === 'confirm') this.app.leaveSettlement(this.mission);
  }

  view(): ScreenView {
    const { net, won, reward, ammoCost, repairCost, rank, bonus, relief, asked, simulated, crowned } = this.settlement;
    return {
      menu: { items: [], cursor: 0 },
      settlement: {
        net, won, reward, ammoCost, repairCost, rank: rank ?? null, bonus: bonus ?? 0, relief: relief ?? 0, tip: won ? null : this.tip,
        // What the contract paid on top for being won as the class it asked for, and which class.
        asked: asked ?? null,
        // True of the bill of a fight on the range: shown, and not booked.
        simulated: simulated === true,
        // The class whose crown this duel took from its master.
        crowned: crowned ?? null,
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.settlement;
    const { catalog, sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    // The bill is read in the hangar, and the hangar is lit.
    const calm = this.app.settings.calm === true;
    drawRoom(ctx, 'bg-garage', this.app.deps.fast ? 0 : this.clock, calm, this.app.deps.fast);

    const x = 40;
    const w = LOGICAL_W - 80;
    const right = x + w - 10;
    drawPanel(ctx, x, 20, w, 230);
    drawText(ctx, this.mission.title, LOGICAL_W / 2, 42, { align: 'center', color: COLORS.dim });
    const drill = isDrill(this.mission);
    const T = STRINGS.training;
    // A duel that took a master's crown is headed by that.
    const heading = drill ? (s.won ? T.won : T.lost) : s.simulated ? (s.won ? T.rangeWon : T.rangeLost) : s.crowned ? S.crowned : s.won ? S.won : S.lost;
    drawText(ctx, heading, LOGICAL_W / 2, 26, { size: 16, align: 'center', color: s.won ? COLORS.accent : COLORS.danger });
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
        // As it lands a ring runs out from it; the ranks that pay flare and throw sparks.
        if (!fast) drawStamp(ctx, { x: right - 6, y: 36 }, this.clock - STAMP_AT - STAMP_MS, color, s.rank === 'S' || s.rank === 'A', calm);
      }
    }

    // Eight rows, a line apart, end just above what the client says: the fee, what was added to it, the bill, and
    // as many repair lines as that leaves room for.
    let y = 55;
    const row = (label: string, amount: number, color: string = COLORS.text): void => {
      drawText(ctx, label, x + 10, y, { color: COLORS.text });
      drawText(ctx, amount > 0 ? `+${amount}` : String(amount), right, y, { align: 'right', color });
      y += LINE;
    };
    // A fight on the range had no fee on offer: its bill begins with what it would have cost.
    if (!s.simulated) row(S.reward, s.reward, s.reward > 0 ? COLORS.armor : COLORS.dim);
    if (s.rank && s.bonus) row(S.rankBonus(s.rank), s.bonus, COLORS.armor);
    // What a contract that asked for a class paid for being won as one.
    if (s.asked) row(S.askBonus(STRINGS.classes.names[s.asked.kind]), s.asked.bonus, COLORS.armor);
    row(S.ammo, -s.ammoCost, s.ammoCost > 0 ? COLORS.danger : COLORS.dim);
    row(S.repairs, -s.repairCost, s.repairCost > 0 ? COLORS.danger : COLORS.dim);
    // Four repair lines fit, three when both the rank and the class paid; the total above always covers all of them.
    for (const line of s.lines.slice(0, Math.min(4, (143 - y) / LINE))) {
      drawText(ctx, `  ${catalog[line.partId]?.name ?? line.partId}`, x + 10, y, { color: COLORS.dim });
      drawText(ctx, String(-line.cost), right, y, { align: 'right', color: COLORS.dim });
      y += LINE;
    }

    // After a win, what the client had to say about it; after a defeat, what Dispatch makes of it.
    // A master who has just lost the crown says so themselves.
    const words = s.crowned ? `"${masterOf(s.crowned).concede}"` : s.won ? this.mission.debrief : this.tip ? STRINGS.advice[this.tip] : '';
    wrap(words, charsFor(w - 20)).slice(0, 3).forEach((line, i) =>
      drawText(ctx, line, x + 10, 144 + i * LINE, { color: s.won ? COLORS.dim : COLORS.text }));

    ctx.fillStyle = COLORS.border;
    ctx.fillRect(x + 10, 180, w - 20, 1);
    // The net amount counts up (or down) to what it is.
    const net = fast ? s.net : Math.round(s.net * Math.min(1, this.clock / COUNT_MS));
    if (s.simulated) {
      // Nothing of this bill is booked: where the net stands, what a real flight would have come to, and not in the colours of money.
      drawText(ctx, S.wouldCost, x + 10, 186, { size: 16, color: COLORS.dim });
      drawText(ctx, String(-net), right, 186, { size: 16, align: 'right', color: COLORS.dim });
    } else {
      drawText(ctx, S.net, x + 10, 186, { size: 16 });
      drawText(ctx, net > 0 ? `+${net}` : String(net), right, 186, { size: 16, align: 'right', color: s.net >= 0 ? COLORS.armor : COLORS.danger });
    }
    const balance = this.app.game!.credits; // already includes this settlement
    drawText(ctx, S.balance, x + 10, 206, { color: COLORS.dim });
    drawText(ctx, String(balance), right, 206, { align: 'right', color: balance < 0 ? COLORS.danger : COLORS.text });
    // A bill that ran into the debt limit: what Dispatch wrote off, between the balance and the way out.
    if (s.relief) drawText(ctx, S.relief(s.relief), LOGICAL_W / 2, 217, { align: 'center', color: COLORS.heat, size: 10 });
    // Clear of the strip along the bottom edge where a medal or a database entry is announced.
    drawText(ctx, S.continue, LOGICAL_W / 2, HINT_Y, { align: 'center', color: COLORS.dim });
  }
}
