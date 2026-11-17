import type { Scene } from '../core/campaign';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { drawLights } from './light';
import { drawWord, fitTall, wordLevel, wordLights, wordTop } from './signType';
import { drawStill, stillWeather } from './stills';
import { Typewriter } from './typewriter';
import { THUNDER_AFTER_MS, strokeBegan } from './weather';
import { COLORS, LINE, charsFor, drawOutlined, drawText, wrap } from './widgets';

/** Characters of a scene's text that fit on a line, and the lines that fit on the page. */
export const SCENE_CHARS = charsFor(LOGICAL_W - 40);
export const SCENE_LINES = 13;

/** How many lines a scene's text takes on the page, with the gaps between its paragraphs. */
export function sceneRows(scene: Scene): number {
  return scene.lines.reduce((sum, paragraph) => sum + wrap(paragraph, SCENE_CHARS).length, 0) + (scene.lines.length - 1) * 0.75;
}

/** How long the picture is left alone before the text comes up over it. */
const PICTURE_MS = 900;
/**
 * How long a press is ignored after the page comes up, and after the press that wrote it out: a
 * button mashed through the settlement must not carry the reader past a page of the story.
 */
export const SCENE_HOLD_MS = 500;

/** How dark the shade over a page's picture is while the picture has the screen to itself, and once the words are up. */
export const VEIL_CLEAR = 0.1;
export const VEIL_WORDS = 0.45;
/** How far the picture drifts up and down, and how long there and back takes: it is seen as from a hovering frame. */
export const DRIFT = 3;
export const DRIFT_MS = 16000;

/**
 * Draws the picture of a page of story or of a conversation, alive: drifting very slightly, with
 * its lights, its haze and what falls through it. A hurried game has it standing still.
 */
export function drawPlace(ctx: CanvasRenderingContext2D, app: App, picture: string, clockMs: number): void {
  const fast = !!app.deps.fast;
  const image = app.deps.sprites.get(picture, { w: LOGICAL_W, h: LOGICAL_H, label: '' }).image;
  const drift = fast ? 0 : Math.round(Math.sin((clockMs / DRIFT_MS) * 2 * Math.PI) * DRIFT);
  // Pixel for pixel: once as it is, and once more a few pixels up or down, so the drift never shows an edge.
  ctx.drawImage(image, 0, 0, LOGICAL_W, LOGICAL_H);
  if (drift !== 0) ctx.drawImage(image, 0, drift, LOGICAL_W, LOGICAL_H);
  // What makes it a place belongs to the picture, and drifts with it.
  ctx.save();
  ctx.translate(0, drift);
  drawStill(ctx, picture, clockMs, app.settings.calm === true, fast);
  ctx.restore();
}

/** Where it rains there is lightning, and its thunder is heard a moment after: not in a hurried game, and not in a calm picture. */
export function hearThunder(app: App, picture: string | undefined, beforeMs: number, nowMs: number): void {
  if (app.deps.fast || !picture || stillWeather(picture) !== 'rain') return;
  if (strokeBegan(beforeMs, nowMs, app.settings.calm === true)) app.deps.sfx?.play('thunder', THUNDER_AFTER_MS, true);
}

/** Where the middle of a page's title is, how tall its letters are at most and at least, and how wide it may be. */
export const TITLE_Y = 47;
export const TITLE_TALL = 28;
export const TITLE_SMALL = 18;
export const TITLE_W = 294;

/** A page of story between contracts: the opening of an act, or how it all ended. Shown once. */
export class SceneScreen implements Screen {
  private clock = 0;
  /** The paragraphs, wrapped; and one writer over all their lines. */
  private rows: string[][];
  private writer: Typewriter;
  private typeTick = 0;
  /** What is left of the time a press is ignored. */
  private hold: number;

  constructor(private app: App, private scene: Scene) {
    // What the pilot decided along the way is written into the page.
    const lines = [...scene.lines, ...(scene.linesFor?.(app.game?.choices ?? {}) ?? [])];
    this.rows = lines.map((paragraph) => wrap(paragraph, SCENE_CHARS));
    const typing = app.typing();
    this.writer = new Typewriter(this.rows.flat(), 60 * typing.factor, typing.instant);
    this.hold = app.deps.fast ? 0 : SCENE_HOLD_MS;
  }

  /** Whether the words have come up: the picture has the screen to itself for a moment first, whatever the speed of text. */
  private get wordsUp(): boolean {
    return !!this.app.deps.fast || this.clock >= PICTURE_MS;
  }

  update(dtMs: number): void {
    const before = this.clock;
    this.clock += dtMs;
    this.hold = Math.max(0, this.hold - dtMs);
    hearThunder(this.app, this.scene.picture, before, this.clock);
    // The picture has the screen to itself for a moment; then the words come.
    if (!this.wordsUp) return;
    this.typeTick -= dtMs;
    if (this.writer.update(dtMs) > 0 && this.typeTick <= 0) {
      this.app.deps.sfx?.play('type');
      this.typeTick = 80;
    }
  }

  onInput(action: InputAction): void {
    if (action !== 'confirm' || this.hold > 0) return;
    // The first press writes the page out; the next one leaves it. Each is held off for a moment
    // after what came before it, so a mashed button skips nothing unread.
    if (!this.wordsUp || !this.writer.done) {
      this.clock = Math.max(this.clock, PICTURE_MS);
      this.writer.finish();
      this.hold = this.app.deps.fast ? 0 : SCENE_HOLD_MS;
    } else this.app.finishScene(this.scene);
  }

  view(): ScreenView {
    const { id, ending, faction } = this.scene;
    return {
      menu: { items: [], cursor: 0 }, scene: id, typing: !this.wordsUp || !this.writer.done, busy: this.hold > 0,
      ...(ending && faction ? { ending: faction } : {}),
    };
  }

  /**
   * The title, in the sign's letters and the game's colour, as tall as fits across the page. It
   * comes on like a tube as the page opens. One the sign cannot write is written in the font.
   */
  private drawTitle(ctx: CanvasRenderingContext2D): void {
    const { title } = this.scene;
    const tall = fitTall(title, TITLE_W, TITLE_TALL, TITLE_SMALL);
    if (tall === null) {
      drawText(ctx, title, LOGICAL_W / 2 + 1, 31, { size: 32, align: 'center', color: '#3b1d5a' });
      drawText(ctx, title, LOGICAL_W / 2, 30, { size: 32, align: 'center', color: COLORS.accent });
      return;
    }
    const calm = this.app.settings.calm === true;
    const level = this.app.deps.fast ? 1 : wordLevel(this.clock, calm);
    drawLights(ctx, wordLights(title, LOGICAL_W / 2, TITLE_Y, tall, 'neon', level), calm ? 0.5 : 1);
    drawWord(ctx, title, LOGICAL_W / 2, wordTop(TITLE_Y, tall), { tall, metal: 'neon', level });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { scene } = this;
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (scene.picture) drawPlace(ctx, this.app, scene.picture, this.clock);
    // The picture is seen clearly first; the shade behind the words comes up over it. It is a light
    // shade: the picture goes on living under it, and the words have a dark edge to be read by.
    const shade = this.app.deps.fast ? 1 : Math.max(0, Math.min(1, (this.clock - PICTURE_MS * 0.5) / (PICTURE_MS * 0.5)));
    ctx.fillStyle = `rgba(8, 8, 20, ${(VEIL_CLEAR + (VEIL_WORDS - VEIL_CLEAR) * shade).toFixed(3)})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (scene.heading) drawOutlined(ctx, scene.heading, LOGICAL_W / 2, 18, { align: 'center', color: COLORS.dim });
    this.drawTitle(ctx);
    // Not a word before the shade is up: text that is all there at once would otherwise sit on the bare picture.
    if (!this.wordsUp) return;
    const written = this.writer.visible();
    let at = 0;
    let y = 84;
    for (const paragraph of this.rows) {
      for (const full of paragraph) {
        // Each line is centred as it will be when complete, so the words do not slide while they appear.
        const left = LOGICAL_W / 2 - (full.length * 4.8) / 2;
        drawOutlined(ctx, written[at++], Math.round(left), y);
        y += LINE + 1;
      }
      y += 8;
    }
    if (this.writer.done && (this.app.deps.fast || Math.floor(this.clock / 400) % 2 === 0)) {
      drawOutlined(ctx, scene.ending ? STRINGS.ending.continue : STRINGS.scene.continue, LOGICAL_W / 2, 250, { align: 'center', color: COLORS.dim });
    }
  }
}
