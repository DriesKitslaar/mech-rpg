import { CALLSIGN_MAX, DEFAULT_CALLSIGN, isCallsign } from '../core/game';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS, drawPanel, drawText } from './widgets';

const C = STRINGS.callsign;
const ROWS: readonly string[] = C.rows;
/** The row under the letters: erase, and done. */
const KEYS = ['del', 'ok'] as const;
const COLS = ROWS[0].length;

/**
 * Asks what the new pilot is called, on a grid of letters worked with the D-pad. It opens with a
 * callsign already in place and the cursor on OK, so one press is enough for a pilot in a hurry.
 */
export class CallsignScreen implements Screen {
  private name = DEFAULT_CALLSIGN;
  /** The cursor: a row of the grid and a column in it. The last row holds the two keys. */
  private row: number = ROWS.length;
  private col = 1;

  constructor(private app: App, private slot: number) {}

  /** What the cursor is on: a letter, or one of the keys. */
  private get at(): string {
    return this.row < ROWS.length ? ROWS[this.row][this.col] : KEYS[this.col];
  }

  private move(dRow: number, dCol: number): void {
    const keys = ROWS.length;
    if (dCol !== 0) {
      const n = this.row === keys ? KEYS.length : COLS;
      this.col = (this.col + dCol + n) % n;
      return;
    }
    const next = (this.row + dRow + keys + 1) % (keys + 1);
    // Between the letters and the keys the cursor goes to whichever is nearest.
    if (next === keys && this.row !== keys) this.col = this.col < COLS / 2 ? 0 : 1;
    else if (this.row === keys && next !== keys) this.col = this.col === 0 ? 2 : COLS - 3;
    this.row = next;
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') return this.move(-1, 0);
    if (action === 'down') return this.move(1, 0);
    if (action === 'left') return this.move(0, -1);
    if (action === 'right') return this.move(0, 1);
    if (action === 'cancel') {
      // Erases a letter; with nothing left to erase, it is a way back to the title.
      if (this.name.length > 0) this.name = this.name.slice(0, -1);
      else this.app.go('title');
      return;
    }
    if (action !== 'confirm') return;
    const at = this.at;
    if (at === 'del') this.name = this.name.slice(0, -1);
    else if (at === 'ok') { if (isCallsign(this.name)) this.app.startNewGame(this.slot, this.name); }
    else if (this.name.length < CALLSIGN_MAX) this.name += at;
  }

  view(): ScreenView {
    return {
      menu: { items: [{ id: this.at, label: this.at, enabled: this.at !== 'ok' || isCallsign(this.name) }], cursor: 0 },
      entry: { name: this.name, at: this.at, slot: this.slot },
    };
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
    drawPanel(ctx, x, 30, w, 210);
    drawText(ctx, C.heading, LOGICAL_W / 2, 38, { size: 16, align: 'center', color: COLORS.accent });

    // The callsign so far, on a row of places, with the next place marked while there is room.
    const cell = 22;
    const left = (LOGICAL_W - CALLSIGN_MAX * cell) / 2;
    for (let i = 0; i < CALLSIGN_MAX; i++) {
      const cx = left + i * cell;
      ctx.fillStyle = i === this.name.length ? COLORS.accent : COLORS.border;
      ctx.fillRect(cx + 3, 86, cell - 6, 1);
      if (i < this.name.length) drawText(ctx, this.name[i], cx + cell / 2, 62, { size: 32, align: 'center' });
    }

    const gx = (LOGICAL_W - COLS * cell) / 2;
    ROWS.forEach((letters, r) => {
      for (let c = 0; c < COLS; c++) {
        const selected = this.row === r && this.col === c;
        drawText(ctx, letters[c], gx + c * cell + cell / 2, 104 + r * 22, { size: 16, align: 'center', color: selected ? COLORS.accent : COLORS.text });
        if (selected) { ctx.fillStyle = COLORS.accent; ctx.fillRect(gx + c * cell + 4, 121 + r * 22, cell - 8, 1); }
      }
    });
    const keyY = 104 + ROWS.length * 22 + 4;
    KEYS.forEach((key, i) => {
      const selected = this.row === ROWS.length && this.col === i;
      const usable = key !== 'ok' || isCallsign(this.name);
      const kx = LOGICAL_W / 2 + (i === 0 ? -50 : 50);
      drawText(ctx, C[key], kx, keyY, { size: 16, align: 'center', color: !usable ? COLORS.dim : selected ? COLORS.accent : COLORS.text });
      if (selected) { ctx.fillStyle = COLORS.accent; ctx.fillRect(kx - 14, keyY + 17, 28, 1); }
    });
    drawText(ctx, C.hint, LOGICAL_W / 2, 224, { align: 'center', color: COLORS.dim });
  }
}
