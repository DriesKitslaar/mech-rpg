import type { Faction } from '../core/campaign';
import { ENDINGS } from '../content/missions';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS, LINE, charsFor, drawText, wrap } from './widgets';

const BACKGROUND: Record<Faction, string> = { hadron: 'bg-mine', lumen: 'bg-plaza', undertow: 'bg-neon-district' };

/** How the war ended, told once after the finale. */
export class EndingScreen implements Screen {
  private clock = 0;

  constructor(private app: App, private faction: Faction) {}

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    // A short hold-off keeps a button mashed through the settlement from skipping the ending unread.
    if (action === 'confirm' && (this.app.deps.fast || this.clock > 800)) this.app.go('hub');
  }

  view(): ScreenView {
    return { menu: { items: [], cursor: 0 }, ending: this.faction };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const ending = ENDINGS[this.faction];
    const bg = this.app.deps.sprites.get(BACKGROUND[this.faction], { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawText(ctx, ending.title, LOGICAL_W / 2, 30, { size: 32, align: 'center', color: COLORS.accent });
    let y = 84;
    for (const paragraph of ending.body) {
      for (const line of wrap(paragraph, charsFor(LOGICAL_W - 40))) {
        drawText(ctx, line, LOGICAL_W / 2, y, { align: 'center' });
        y += LINE + 1;
      }
      y += 8;
    }
    drawText(ctx, STRINGS.ending.continue, LOGICAL_W / 2, 246, { align: 'center', color: COLORS.dim });
  }
}
