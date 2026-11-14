import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { LOGICAL_W } from './display';
import { CHAR_W, COLORS, LINE, drawPanel, drawText } from './widgets';

const D = STRINGS.debug;
const W = 150;

/**
 * A small readout toggled with the menu button. It exists so that what goes wrong on a handheld can
 * be told apart from a distance: which key a button sends and what the game takes it for, the size
 * the game is drawn at, and anything that went wrong while drawing.
 */
export class InputDebug {
  private visible = false;
  private lastAction: string = D.none;
  private lastKey: string = D.none;
  private size: string = D.none;
  private error: string | null = null;

  toggle(): void {
    this.visible = !this.visible;
  }

  /** The action as the game took it: with the A and B buttons swapped in the options, the swapped one. */
  action(action: InputAction): void {
    this.lastAction = action;
  }

  /** `mappedTo` is the key the shell translated the code to, or an empty string when it is unmapped. */
  record(keyCode: number, mappedTo: string): void {
    this.lastKey = mappedTo ? `${keyCode} > ${mappedTo}` : `${keyCode} (unmapped)`;
  }

  /** The viewport in device pixels as the browser reports it, and how many times the game is enlarged. */
  screen(deviceW: number, deviceH: number, scale: number): void {
    this.size = `${Math.round(deviceW)}x${Math.round(deviceH)} x${scale}`;
  }

  /** Something went wrong in a frame: the window opens by itself so that it is seen. */
  fault(message: string): void {
    this.error = message;
    this.visible = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    const x = LOGICAL_W - W;
    const lines = [
      `${D.action}: ${this.lastAction}`,
      `${D.key}: ${this.lastKey}`,
      `${D.screen}: ${this.size}`,
      ...(this.error ? [`${D.error}: ${this.error}`] : []),
    ];
    const fit = Math.floor((W - 8) / CHAR_W);
    drawPanel(ctx, x, 14, W, 16 + (lines.length + 1) * LINE);
    drawText(ctx, D.title, x + 4, 16, { color: COLORS.accent });
    lines.forEach((line, i) => drawText(ctx, line.slice(0, fit), x + 4, 27 + i * LINE, i === 3 ? { color: COLORS.danger } : {}));
    drawText(ctx, D.close, x + 4, 27 + lines.length * LINE, { color: COLORS.dim });
  }
}
