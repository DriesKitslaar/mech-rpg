/** Small drawing helpers. All coordinates are logical (310x270) units. */
export const COLORS = {
  panel: 'rgba(16, 20, 24, 0.92)',
  border: '#3a4046',
  text: '#d8d4c4',
  dim: '#6a6e72',
  accent: '#e08a2c',
  armor: '#8a9a4a',
  energy: '#4aa3c7',
  heat: '#d6a02c',
  danger: '#e04a2c',
  empty: '#22262a',
};
export const FONT = 'VT323';
export const LINE = 11;

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
