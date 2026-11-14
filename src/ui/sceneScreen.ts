import type { Scene } from '../core/campaign';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { COLORS, LINE, charsFor, drawText, wrap } from './widgets';

/** Characters of a scene's text that fit on a line, and the lines that fit on the page. */
export const SCENE_CHARS = charsFor(LOGICAL_W - 40);
export const SCENE_LINES = 13;

/** How many lines a scene's text takes on the page, with the gaps between its paragraphs. */
export function sceneRows(scene: Scene): number {
  return scene.lines.reduce((sum, paragraph) => sum + wrap(paragraph, SCENE_CHARS).length, 0) + (scene.lines.length - 1) * 0.75;
}

/** A page of story between contracts: the opening of an act, or how it all ended. Shown once. */
export class SceneScreen implements Screen {
  private clock = 0;

  constructor(private app: App, private scene: Scene) {}

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    // A short hold-off keeps a button mashed through the settlement from skipping the page unread.
    if (action === 'confirm' && (this.app.deps.fast || this.clock > 800)) this.app.finishScene(this.scene);
  }

  view(): ScreenView {
    const { id, ending, faction } = this.scene;
    return { menu: { items: [], cursor: 0 }, scene: id, ...(ending && faction ? { ending: faction } : {}) };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { scene } = this;
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (scene.picture) {
      const picture = this.app.deps.sprites.get(scene.picture, { w: LOGICAL_W, h: LOGICAL_H, label: '' });
      ctx.drawImage(picture.image, 0, 0, LOGICAL_W, LOGICAL_H);
    }
    ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (scene.heading) drawText(ctx, scene.heading, LOGICAL_W / 2, 18, { align: 'center', color: COLORS.dim });
    drawText(ctx, scene.title, LOGICAL_W / 2, 30, { size: 32, align: 'center', color: COLORS.accent });
    let y = 84;
    for (const paragraph of scene.lines) {
      for (const line of wrap(paragraph, SCENE_CHARS)) {
        drawText(ctx, line, LOGICAL_W / 2, y, { align: 'center' });
        y += LINE + 1;
      }
      y += 8;
    }
    drawText(ctx, scene.ending ? STRINGS.ending.continue : STRINGS.scene.continue, LOGICAL_W / 2, 250, { align: 'center', color: COLORS.dim });
  }
}
