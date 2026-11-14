import type { Scene } from '../core/campaign';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { Typewriter } from './typewriter';
import { COLORS, LINE, charsFor, drawText, wrap } from './widgets';

/** Characters of a scene's text that fit on a line, and the lines that fit on the page. */
export const SCENE_CHARS = charsFor(LOGICAL_W - 40);
export const SCENE_LINES = 13;

/** How many lines a scene's text takes on the page, with the gaps between its paragraphs. */
export function sceneRows(scene: Scene): number {
  return scene.lines.reduce((sum, paragraph) => sum + wrap(paragraph, SCENE_CHARS).length, 0) + (scene.lines.length - 1) * 0.75;
}

/** How long the picture is left alone before the text comes up over it. */
const PICTURE_MS = 900;

/** A page of story between contracts: the opening of an act, or how it all ended. Shown once. */
export class SceneScreen implements Screen {
  private clock = 0;
  /** The paragraphs, wrapped; and one writer over all their lines. */
  private rows: string[][];
  private writer: Typewriter;
  private typeTick = 0;

  constructor(private app: App, private scene: Scene) {
    this.rows = scene.lines.map((paragraph) => wrap(paragraph, SCENE_CHARS));
    this.writer = new Typewriter(this.rows.flat(), 60, app.deps.fast);
  }

  update(dtMs: number): void {
    this.clock += dtMs;
    // The picture has the screen to itself for a moment; then the words come.
    if (this.clock < PICTURE_MS && !this.app.deps.fast) return;
    this.typeTick -= dtMs;
    if (this.writer.update(dtMs) > 0 && this.typeTick <= 0) {
      this.app.deps.sfx?.play('type');
      this.typeTick = 80;
    }
  }

  onInput(action: InputAction): void {
    if (action !== 'confirm') return;
    // The first press writes the page out; the next one leaves it. A short hold-off keeps a button
    // mashed through the settlement from skipping the page unread.
    if (!this.writer.done) {
      this.clock = Math.max(this.clock, PICTURE_MS);
      this.writer.finish();
    } else if (this.app.deps.fast || this.clock > 800) this.app.finishScene(this.scene);
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
    // The picture is seen clearly first; the shade behind the words comes up over it.
    const shade = this.app.deps.fast ? 1 : Math.max(0, Math.min(1, (this.clock - PICTURE_MS * 0.5) / (PICTURE_MS * 0.5)));
    ctx.fillStyle = `rgba(8, 8, 20, ${(0.2 + 0.5 * shade).toFixed(3)})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (scene.heading) drawText(ctx, scene.heading, LOGICAL_W / 2, 18, { align: 'center', color: COLORS.dim });
    drawText(ctx, scene.title, LOGICAL_W / 2 + 1, 31, { size: 32, align: 'center', color: '#3b1d5a' });
    drawText(ctx, scene.title, LOGICAL_W / 2, 30, { size: 32, align: 'center', color: COLORS.accent });
    const written = this.writer.visible();
    let at = 0;
    let y = 84;
    for (const paragraph of this.rows) {
      for (const full of paragraph) {
        // Each line is centred as it will be when complete, so the words do not slide while they appear.
        const left = LOGICAL_W / 2 - (full.length * 4.8) / 2;
        drawText(ctx, written[at++], Math.round(left), y);
        y += LINE + 1;
      }
      y += 8;
    }
    if (this.writer.done && (this.app.deps.fast || Math.floor(this.clock / 400) % 2 === 0)) {
      drawText(ctx, scene.ending ? STRINGS.ending.continue : STRINGS.scene.continue, LOGICAL_W / 2, 250, { align: 'center', color: COLORS.dim });
    }
  }
}
