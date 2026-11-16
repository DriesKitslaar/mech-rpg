import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS } from './widgets';

/**
 * The way from one screen to the next. A new screen comes into view from behind a dark blind that
 * is drawn off it to the right, its edge at a slant and lit in the game's colour; a battle comes
 * into view between two doors that draw back to the top and the bottom. Both are solid and on the
 * pixel grid, and both follow from how much of the way is still to go.
 */

/** How far the blind's edge leans from the top of the screen to the bottom, and how tall each strip of it is. */
export const BLIND_SLANT = 48;
export const BLIND_STEP = 6;
/** How wide the lit edge of the blind is. */
const EDGE = 2;
const DARK = '#04040c';

/** The blind over a new screen. `left` is how much of the way it still has to go: 1 covers everything, 0 nothing. */
export function drawBlind(ctx: CanvasRenderingContext2D, left: number): void {
  const done = 1 - Math.max(0, Math.min(1, left));
  if (done >= 1) return;
  // The edge starts off the left of the screen, top and bottom, and ends off the right.
  const reach = LOGICAL_W + BLIND_SLANT + EDGE;
  for (let y = 0; y < LOGICAL_H; y += BLIND_STEP) {
    const edge = Math.round(done * reach - EDGE - (y / LOGICAL_H) * BLIND_SLANT);
    if (edge >= LOGICAL_W) continue;
    const x = Math.max(0, edge);
    ctx.fillStyle = DARK;
    ctx.fillRect(x, y, LOGICAL_W - x, BLIND_STEP);
    if (edge >= 0) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(edge, y, Math.min(EDGE, LOGICAL_W - edge), BLIND_STEP);
    }
  }
}

/** The doors over a battle. `left` is how much of the way they still have to go: 1 is shut, 0 is open. */
export function drawDoors(ctx: CanvasRenderingContext2D, left: number): void {
  const h = Math.ceil((LOGICAL_H / 2) * Math.max(0, Math.min(1, left)));
  if (h <= 0) return;
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, LOGICAL_W, h);
  ctx.fillRect(0, LOGICAL_H - h, LOGICAL_W, h);
  // Each door has a lit edge, and a seam a little way in from it.
  if (h < 5) return;
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(0, h - 5, LOGICAL_W, 1);
  ctx.fillRect(0, LOGICAL_H - h + 4, LOGICAL_W, 1);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, h - 1, LOGICAL_W, 1);
  ctx.fillRect(0, LOGICAL_H - h, LOGICAL_W, 1);
}
