import { soft, wide } from './light';

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
/** How wide one character of the UI font is at the usual size. */
export const CHAR_W = 4.8;

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

/** Text over a picture: the same words in the dark colour one pixel off in every direction, and then the words themselves. */
/**
 * The colour of what is written small over a picture: a heading, the word to go on. The dim colour
 * of the boxes will not do there: a picture can be as light as that itself (a sky at daybreak
 * is), and the word is then only an edge with nothing in it.
 */
export const OVER_PICTURE = '#cbc6e8';

export function drawOutlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOptions = {}, edge = '#07061a'): void {
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) drawText(ctx, text, x + dx, y + dy, { ...opts, color: edge });
  drawText(ctx, text, x, y, opts);
}

/** A '#rrggbb' colour mixed towards white (`t` above 0) or towards black (`t` below 0), as far as `t` says. */
export function shade(hex: string, t: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const to = t > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(t));
  return `#${[m[1], m[2], m[3]].map((c) => Math.round(parseInt(c, 16) + (to - parseInt(c, 16)) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** A panel lower than this is a bar across the screen, not a box. */
export const BAR_H = 16;
/** How far a panel's corners are cut. */
const CUT = 2;
const FRAME_LIGHT = 'rgba(150, 140, 230, 0.22)';
/** How far below a panel its shadow reaches. */
export const PANEL_SHADOW = 4;

/** What a panel is filled with: a little lighter at the top than at the bottom, or the plain panel colour where the canvas makes no gradients. */
function panelFill(ctx: CanvasRenderingContext2D, y: number, h: number): string | CanvasGradient {
  const body = soft() ? ctx.createLinearGradient?.(0, y, 0, y + h) as CanvasGradient | undefined : undefined;
  if (!body || typeof body.addColorStop !== 'function') return COLORS.panel;
  body.addColorStop(0, 'rgba(27, 25, 52, 0.95)');
  body.addColorStop(0.45, 'rgba(14, 14, 28, 0.94)');
  body.addColorStop(1, 'rgba(8, 8, 18, 0.95)');
  return body;
}

/**
 * A panel stands a little off what is behind it: the picture under its bottom edge is darkened,
 * most right under it. Soft, so a canvas that makes no gradients gets none.
 */
function panelShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const fall = wide() ? ctx.createLinearGradient?.(0, y, 0, y + PANEL_SHADOW) as CanvasGradient | undefined : undefined;
  if (!fall || typeof fall.addColorStop !== 'function') return;
  fall.addColorStop(0, 'rgba(0, 0, 8, 0.5)');
  fall.addColorStop(1, 'rgba(0, 0, 8, 0)');
  ctx.fillStyle = fall;
  ctx.fillRect(x, y, w, PANEL_SHADOW);
}

/**
 * The box everything is written in: a dark plate with its corners cut, a frame, a line of light
 * under its top edge, a mark in the game's colour at two of its corners, and a shadow under it.
 * A low one is a bar across the screen: no cut corners and a line under it, and the one at the
 * top of the screen has the mark at its left end.
 */
export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (h <= BAR_H || w <= CUT * 4) {
    panelShadow(ctx, x, y + h, w);
    ctx.fillStyle = panelFill(ctx, y, h);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(x, y + h - 1, w, 1);
    if (y === 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x, y + h - 1, Math.min(w, 28), 1);
    }
    return;
  }
  panelShadow(ctx, x + CUT, y + h, w - CUT * 2);
  ctx.fillStyle = panelFill(ctx, y, h);
  // The plate, in pieces that do not overlap: it is not quite opaque, and two layers would show.
  ctx.fillRect(x + CUT, y, w - CUT * 2, h);
  ctx.fillRect(x, y + CUT, CUT, h - CUT * 2);
  ctx.fillRect(x + w - CUT, y + CUT, CUT, h - CUT * 2);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  // The frame, stepping round the cut corners.
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(x + CUT, y, w - CUT * 2, 1);
  ctx.fillRect(x + CUT, y + h - 1, w - CUT * 2, 1);
  ctx.fillRect(x, y + CUT, 1, h - CUT * 2);
  ctx.fillRect(x + w - 1, y + CUT, 1, h - CUT * 2);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  // Light catches the inside of the top edge.
  ctx.fillStyle = FRAME_LIGHT;
  ctx.fillRect(x + CUT + 1, y + 1, w - CUT * 2 - 2, 1);
  // The game's colour at the top left and the bottom right.
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(x + CUT, y, Math.min(8, w - CUT * 2), 1);
  ctx.fillRect(x + w - CUT - Math.min(8, w - CUT * 2), y + h - 1, Math.min(8, w - CUT * 2), 1);
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

/** A row of page names ending at `right`, the current one lit: for screens the shoulder buttons page through. */
export function drawTabs(ctx: CanvasRenderingContext2D, right: number, y: number, labels: string[], current: number): void {
  let x = right;
  for (let i = labels.length - 1; i >= 0; i--) {
    const width = Math.round(labels[i].length * CHAR_W);
    drawText(ctx, labels[i], x, y, { align: 'right', color: i === current ? COLORS.accent : COLORS.dim });
    // The page that is open is underlined.
    if (i === current) { ctx.fillStyle = COLORS.accent; ctx.fillRect(x - width, y + 11, width, 1); }
    x -= width + 8;
  }
}

/** What a medal of each tier is made of: bronze, silver, gold. */
export const MEDAL_COLORS: Record<1 | 2 | 3, string> = { 1: '#c0773c', 2: '#c3c9d6', 3: '#f2c744' };

/** A medal nine pixels square: a ribbon and a disc in the metal of its tier, or its outline while it is not earned. */
export function drawMedal(ctx: CanvasRenderingContext2D, x: number, y: number, tier: 1 | 2 | 3, earned: boolean): void {
  // The ribbon: one band in two colours, narrowing to where the disc hangs.
  ctx.fillStyle = earned ? COLORS.accent : COLORS.border;
  ctx.fillRect(x + 1, y, 3, 2);
  ctx.fillRect(x + 2, y + 2, 2, 1);
  ctx.fillStyle = earned ? COLORS.energy : COLORS.border;
  ctx.fillRect(x + 5, y, 3, 2);
  ctx.fillRect(x + 5, y + 2, 2, 1);
  ctx.fillStyle = earned ? '#e4e2f0' : COLORS.border;
  ctx.fillRect(x + 4, y, 1, 3);
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

/** A page with lines on it, nine pixels square: the mark of the database. */
export function drawPage(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.energy;
  ctx.fillRect(x + 1, y, 7, 9);
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x + 2, y + 1, 5, 7);
  ctx.fillStyle = COLORS.text;
  for (const row of [2, 4, 6]) ctx.fillRect(x + 3, y + row, row === 6 ? 2 : 3, 1);
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
  // A bar with any height to it is given some: light along its top, shade along its bottom, a bright
  // end where it stops, and a mark at every tenth so that its length can be read.
  if (h < 3) return;
  if (fill > 0) {
    ctx.fillStyle = shade(color, 0.4);
    ctx.fillRect(x, y, fill, 1);
    ctx.fillStyle = shade(color, -0.35);
    ctx.fillRect(x, y + h - 1, fill, 1);
    if (fill < w) { ctx.fillStyle = shade(color, 0.7); ctx.fillRect(x + fill - 1, y, 1, h); }
  }
  if (w >= 50) {
    ctx.fillStyle = 'rgba(8, 8, 20, 0.45)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round((w * i) / 10), y, 1, h);
  }
}

/**
 * The row the cursor is on is lit from the left in the game's colour, fading out to the right. Soft
 * light: a canvas that makes no gradients is left as it is.
 */
export function drawRowLight(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height = LINE): void {
  const band = soft() ? ctx.createLinearGradient?.(x, 0, x + width, 0) as CanvasGradient | undefined : undefined;
  if (!band || typeof band.addColorStop !== 'function') return;
  band.addColorStop(0, 'rgba(255, 93, 177, 0.3)');
  band.addColorStop(0.6, 'rgba(255, 93, 177, 0.1)');
  band.addColorStop(1, 'rgba(255, 93, 177, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(x, y, width, height);
}

/** Draws a scrolling list: cursor mark, label, and the item's note at the right edge. */
export function drawList(
  ctx: CanvasRenderingContext2D, list: { cursor: number; items: unknown[]; visible(rows: number): { items: { label: string; enabled: boolean; note?: string }[]; offset: number } },
  x: number, y: number, width: number, rows: number,
): void {
  const { items, offset } = list.visible(rows);
  // A note that would run into the name beside it is written smaller, so that the two stand apart. Where one
  // row of a list needs that, every row's note is written so: the notes are one column, whichever rows are in view.
  const all = list.items as { label: string; note?: string }[];
  const tight = all.some((item) => !!item.note && x + width - item.note.length * CHAR_W < x + 8 + (item.label.length + 1) * CHAR_W);
  items.forEach((item, i) => {
    const selected = offset + i === list.cursor;
    const color = !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text;
    if (selected) {
      drawRowLight(ctx, x - 3, y + i * LINE + 1, width + 3);
      drawText(ctx, '>', x, y + i * LINE, { color: COLORS.accent });
    }
    drawText(ctx, item.label, x + 8, y + i * LINE, { color });
    if (item.note) {
      drawText(ctx, item.note, x + width, y + i * LINE + (tight ? 1 : 0), { color: item.enabled ? COLORS.dim : COLORS.danger, align: 'right', size: tight ? 10 : 12 });
    }
  });
  // Small marks show that the list continues above or below.
  if (offset > 0) drawText(ctx, '^', x + width + 4, y, { color: COLORS.dim });
  if (offset + rows < list.items.length) drawText(ctx, 'v', x + width + 4, y + (rows - 1) * LINE, { color: COLORS.dim });
}

export function drawMenu(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  items: { label: string; enabled: boolean }[], cursor: number,
): void {
  // The light behind the row chosen is as wide as the widest row, and a little more.
  const width = Math.round(Math.max(0, ...items.map((item) => item.label.length)) * CHAR_W) + 20;
  items.forEach((item, i) => {
    const selected = i === cursor;
    if (selected) {
      drawRowLight(ctx, x - 3, y + i * LINE + 1, width);
      drawText(ctx, '>', x, y + i * LINE, { color: COLORS.accent });
    }
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
