import type { Part } from '../core/types';
import { COLORS } from './widgets';

/** Kinds of part that sit inside the mech and have no sprite of their own. */
export type IconKind = Extract<Part['kind'], 'generator' | 'booster' | 'fcs' | 'module'>;
export const hasIcon = (kind: Part['kind']): kind is IconKind =>
  kind === 'generator' || kind === 'booster' || kind === 'fcs' || kind === 'module';

/** Draws a simple pixel icon for a part that is never seen on the mech, centred on (cx, cy). */
export function drawPartIcon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const box = (dx: number, dy: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  // A plate behind every icon ties them together.
  box(-24, -28, 48, 56, COLORS.empty);
  box(-24, -28, 48, 1, COLORS.border);
  box(-24, 27, 48, 1, COLORS.border);
  box(-24, -28, 1, 56, COLORS.border);
  box(23, -28, 1, 56, COLORS.border);
  switch (kind) {
    case 'generator':
      // A cell with four charge bars.
      for (let i = 0; i < 4; i++) box(-16, -20 + i * 11, 32 - i * 5, 6, COLORS.energy);
      break;
    case 'booster':
      // A nozzle with its flame.
      box(-10, -20, 20, 8, COLORS.dim);
      box(-13, -12, 26, 6, COLORS.text);
      box(-16, -6, 32, 4, COLORS.dim);
      box(-10, 0, 20, 6, COLORS.heat);
      box(-7, 6, 14, 6, COLORS.accent);
      box(-4, 12, 8, 5, COLORS.heat);
      box(-1, 17, 2, 4, COLORS.text);
      break;
    case 'fcs':
      // A reticle.
      box(-16, -1, 10, 2, COLORS.armor);
      box(6, -1, 10, 2, COLORS.armor);
      box(-1, -16, 2, 10, COLORS.armor);
      box(-1, 6, 2, 10, COLORS.armor);
      box(-2, -2, 4, 4, COLORS.accent);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        box(sx > 0 ? 10 : -16, sy > 0 ? 14 : -16, 6, 2, COLORS.text);
        box(sx > 0 ? 14 : -16, sy > 0 ? 10 : -16, 2, 6, COLORS.text);
      }
      break;
    case 'module':
      // A chip with pins.
      box(-12, -12, 24, 24, COLORS.dim);
      box(-7, -7, 14, 14, COLORS.accent);
      box(-3, -3, 6, 6, COLORS.text);
      for (let i = 0; i < 3; i++) {
        box(-9 + i * 7, -17, 4, 5, COLORS.text);
        box(-9 + i * 7, 12, 4, 5, COLORS.text);
        box(-17, -9 + i * 7, 5, 4, COLORS.text);
        box(12, -9 + i * 7, 5, 4, COLORS.text);
      }
      break;
  }
}
