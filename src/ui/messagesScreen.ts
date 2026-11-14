import { arrivedMessages, type Message } from '../core/campaign';
import { MESSAGES, MISSIONS } from '../content/missions';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { Typewriter } from './typewriter';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const M = STRINGS.messagesScreen;

/** The inbox: newest first. Opening a message marks it read. */
export class MessagesScreen implements Screen {
  private list: MenuList;
  private reading: Message | null = null;
  /** The message being read, wrapped, and the writer that types it out. */
  private rows: string[][] = [];
  private writer: Typewriter | null = null;

  constructor(private app: App) {
    this.list = new MenuList(this.items());
  }

  private arrived(): Message[] {
    return arrivedMessages(this.app.game!, MESSAGES, MISSIONS).reverse();
  }

  private items() {
    const read = this.app.game!.read;
    return this.arrived().map((m) => ({ id: m.id, label: m.subject, enabled: true, note: read.includes(m.id) ? undefined : M.isNew }));
  }

  update(dtMs: number): void {
    this.writer?.update(dtMs);
  }

  onInput(action: InputAction): void {
    if (this.reading) {
      if (action === 'cancel' || action === 'confirm') {
        this.reading = null;
        this.list.setItems(this.items());
      }
      return;
    }
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.list.selected) {
      this.reading = this.arrived().find((m) => m.id === this.list.selected!.id) ?? null;
      if (this.reading) {
        this.app.readMessage(this.reading.id);
        this.rows = this.reading.body.map((paragraph) => wrap(paragraph, charsFor(LOGICAL_W - 24)));
        this.writer = new Typewriter(this.rows.flat(), 150, this.app.deps.fast);
      }
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, reading: this.reading?.id ?? null };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, M.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, M.back, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    const message = this.reading;
    if (!message) {
      drawPanel(ctx, 4, 20, LOGICAL_W - 8, 244);
      if (this.list.items.length === 0) drawText(ctx, M.empty, 12, 28, { color: COLORS.dim });
      drawList(ctx, this.list, 10, 26, LOGICAL_W - 34, 20);
      return;
    }

    drawPanel(ctx, 4, 20, LOGICAL_W - 8, 64);
    let textX = 12;
    if (message.portrait) {
      const p = sprites.get(message.portrait, { w: 56, h: 56, label: '' });
      ctx.drawImage(p.image, 8, 24, 56, 56);
      textX = 72;
    }
    drawText(ctx, M.from, textX, 26, { color: COLORS.dim, size: 10 });
    drawText(ctx, message.from, textX, 36, { color: COLORS.text });
    wrap(message.subject, charsFor(LOGICAL_W - textX - 12, 16)).slice(0, 2).forEach((line, i) =>
      drawText(ctx, line, textX, 50 + i * 14, { size: 16, color: COLORS.accent }));

    drawPanel(ctx, 4, 88, LOGICAL_W - 8, 176);
    const written = this.writer?.visible() ?? this.rows.flat();
    let at = 0;
    let y = 96;
    for (const paragraph of this.rows) {
      for (const _full of paragraph) { drawText(ctx, written[at++], 12, y); y += LINE; }
      y += 5;
    }
  }
}
