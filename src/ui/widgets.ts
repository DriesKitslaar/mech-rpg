/** Small drawing helpers. All coordinates are logical (310x270) units. */
export const COLORS = {
  panel: 'rgba(12, 12, 24, 0.93)',
  border: '#3b3760',
  text: '#e4e2f0',
  dim: '#76739a',
  accent: '#ff5db1',
  armor: '#5fd9c2',
  energy: '#4aa8ff',
  heat: '#d6a02c',
  danger: '#e04a2c',
  empty: '#22203a',
};
export const FONT = 'VT323';
export const LINE = 11;

/** Breaks text into lines of at most `maxChars`, at spaces; a longer word is split. The UI font is monospaced. */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (word.length > maxChars) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Characters of the UI font that fit in `width` logical pixels at `size`. */
export const charsFor = (width: number, size = 12): number => Math.max(1, Math.floor(width / (size * 0.4)));

export interface TextOptions { size?: number; color?: string; align?: CanvasTextAlign; strike?: boolean }

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOptions = {}): void {
  const size = opts.size ?? 12;
  ctx.font = `${size}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.align ?? 'left';
  ctx.fillStyle = opts.color ?? COLORS.text;
  ctx.fillText(text, x, y);
  if (opts.strike) {
    const w = ctx.measureText(text).width;
    const left = ctx.textAlign === 'right' ? x - w : ctx.textAlign === 'center' ? x - w / 2 : x;
    ctx.fillRect(left, y + Math.round(size / 2), w, 1);
  }
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Where sprites come from, as far as a widget needs to know. */
interface Sprites { get(id: string, fallback: { w: number; h: number; label: string }): { image: CanvasImageSource } }

/** A speaker's face in a square; without one, the plain terminal mark the dispatcher has. */
export function drawPortrait(ctx: CanvasRenderingContext2D, sprites: Sprites, id: string | undefined, x: number, y: number, size: number): void {
  if (id) {
    ctx.drawImage(sprites.get(id, { w: size, h: size, label: '' }).image, x, y, size, size);
    return;
  }
  ctx.fillStyle = COLORS.empty;
  ctx.fillRect(x, y, size, size);
  const step = Math.max(4, Math.round(size / 7));
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? COLORS.energy : COLORS.accent;
    ctx.fillRect(x + step, y + Math.round(size * 0.18) + i * step, size - 2 * step - i * Math.round(size / 11), Math.max(2, Math.round(size / 18)));
  }
}

/** What a medal of each tier is made of: bronze, silver, gold. */
export const MEDAL_COLORS: Record<1 | 2 | 3, string> = { 1: '#c0773c', 2: '#c3c9d6', 3: '#f2c744' };

/** A medal nine pixels square: a ribbon and a disc in the metal of its tier, or its outline while it is not earned. */
export function drawMedal(ctx: CanvasRenderingContext2D, x: number, y: number, tier: 1 | 2 | 3, earned: boolean): void {
  ctx.fillStyle = earned ? COLORS.accent : COLORS.border;
  ctx.fillRect(x + 2, y, 2, 3);
  ctx.fillStyle = earned ? COLORS.energy : COLORS.border;
  ctx.fillRect(x + 5, y, 2, 3);
  ctx.fillStyle = earned ? MEDAL_COLORS[tier] : COLORS.border;
  ctx.fillRect(x + 2, y + 3, 5, 6);
  ctx.fillRect(x + 1, y + 4, 7, 4);
  if (!earned) {
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(x + 3, y + 4, 3, 4);
    ctx.fillRect(x + 2, y + 5, 5, 2);
  } else {
    // A glint, so the three metals read as metal.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(x + 3, y + 4, 2, 1);
    ctx.fillRect(x + 2, y + 5, 1, 1);
  }
}

/** A horizontal bar filled to value/max. */
export function drawMeter(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, max: number, color: string,
): void {
  ctx.fillStyle = COLORS.empty;
  ctx.fillRect(x, y, w, h);
  const fill = max > 0 ? Math.round(w * Math.max(0, Math.min(1, value / max))) : 0;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fill, h);
}

/** Draws a scrolling list: cursor mark, label, and the item's note at the right edge. */
export function drawList(
  ctx: CanvasRenderingContext2D, list: { cursor: number; items: unknown[]; visible(rows: number): { items: { label: string; enabled: boolean; note?: string }[]; offset: number } },
  x: number, y: number, width: number, rows: number,
): void {
  const { items, offset } = list.visible(rows);
  items.forEach((item, i) => {
    const selected = offset + i === list.cursor;
    const color = !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text;
    if (selected) drawText(ctx, '>', x, y + i * LINE, { color: COLORS.accent });
    drawText(ctx, item.label, x + 8, y + i * LINE, { color });
    if (item.note) drawText(ctx, item.note, x + width, y + i * LINE, { color: item.enabled ? COLORS.dim : COLORS.danger, align: 'right' });
  });
  // Small marks show that the list continues above or below.
  if (offset > 0) drawText(ctx, '^', x + width + 4, y, { color: COLORS.dim });
  if (offset + rows < list.items.length) drawText(ctx, 'v', x + width + 4, y + (rows - 1) * LINE, { color: COLORS.dim });
}

export function drawMenu(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  items: { label: string; enabled: boolean }[], cursor: number,
): void {
  items.forEach((item, i) => {
    const selected = i === cursor;
    if (selected) drawText(ctx, '>', x, y + i * LINE, { color: COLORS.accent });
    drawText(ctx, item.label, x + 8, y + i * LINE, {
      color: !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text,
    });
  });
}

/** Like `drawMenu`, but shows only `rows` items, scrolled so the cursor stays in view, with marks when there is more. */
export function drawScrollMenu(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  items: { label: string; enabled: boolean }[], cursor: number, rows: number,
): void {
  const offset = Math.max(0, Math.min(cursor - Math.floor(rows / 2), items.length - rows));
  drawMenu(ctx, x, y, items.slice(offset, offset + rows), cursor - offset);
  if (offset > 0) drawText(ctx, '^', x + 140, y, { color: COLORS.dim });
  if (offset + rows < items.length) drawText(ctx, 'v', x + 140, y + (rows - 1) * LINE, { color: COLORS.dim });
}
