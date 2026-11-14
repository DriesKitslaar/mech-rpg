import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { LOGICAL_W } from './display';
import { COLORS, drawPanel, drawText } from './widgets';

/**
 * A small readout of the last input, toggled with the menu button. It exists so a button that
 * does the wrong thing on a handheld can be identified by its key code.
 */
export class InputDebug {
  private visible = false;
  private lastAction: string = STRINGS.debug.none;
  private lastKey: string = STRINGS.debug.none;

  toggle(): void {
    this.visible = !this.visible;
  }

  action(action: InputAction): void {
    this.lastAction = action;
  }

  /** `mappedTo` is the key the shell translated the code to, or an empty string when it is unmapped. */
  record(keyCode: number, mappedTo: string): void {
    this.lastKey = mappedTo ? `${keyCode} > ${mappedTo}` : `${keyCode} (unmapped)`;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    const w = 128;
    const x = LOGICAL_W - w;
    drawPanel(ctx, x, 14, w, 38);
    drawText(ctx, STRINGS.debug.title, x + 4, 16, { color: COLORS.accent });
    drawText(ctx, `${STRINGS.debug.action}: ${this.lastAction}`, x + 4, 27);
    drawText(ctx, `${STRINGS.debug.key}: ${this.lastKey}`, x + 4, 38);
  }
}
