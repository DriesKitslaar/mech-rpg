import type { Scene, Talk } from '../core/campaign';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { SCENE_HOLD_MS, drawPlace, hearThunder } from './sceneScreen';
import { drawWord, fitTall, wordTop } from './signType';
import { Typewriter } from './typewriter';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawPortrait, drawOutlined, drawText, wrap } from './widgets';

/** Where the words of a conversation go: beside the portrait, in the panel at the foot of the screen. */
const PANEL_Y = 176;
const TEXT_X = 72;
export const TALK_SCENE_CHARS = charsFor(LOGICAL_W - TEXT_X - 10);
/** Lines of one thing said that fit under the speaker's name. */
export const TALK_SCENE_LINES = 5;
/** How long a question is on screen before an answer is taken. */
export const QUESTION_HOLD_MS = 1500;
/** Characters of an answer that fit on its row of the list. */
export const ANSWER_CHARS = charsFor(LOGICAL_W - TEXT_X - 22);

/** How dark the shade over the place a conversation is held in is. */
export const TALK_VEIL = 0.25;
/** Where the middle of a conversation's title is, how tall its letters are at most, and how wide it may be. */
export const TALK_TITLE_Y = 31;
export const TALK_TITLE_TALL = 16;
export const TALK_TITLE_W = 290;

/**
 * A conversation between contracts: people speak in turn, each with their face beside their words,
 * and at the end the pilot may be asked something. What is answered is remembered.
 */
export class TalkScreen implements Screen {
  private clock = 0;
  private at = 0;
  private said: Talk[];
  private writer!: Typewriter;
  private rows: string[] = [];
  private hold: number;
  private typeTick = 0;
  /** The answers, while the pilot is being asked; and the answer given, once it has been. */
  private answers: MenuList | null = null;
  private answered = false;

  constructor(private app: App, private scene: Scene) {
    this.said = [...(scene.talk ?? [])];
    this.hold = app.deps.fast ? 0 : SCENE_HOLD_MS;
    this.open();
  }

  private open(): void {
    this.rows = wrap(this.said[this.at]?.text ?? '', TALK_SCENE_CHARS);
    const typing = this.app.typing();
    this.writer = new Typewriter(this.rows, 70 * typing.factor, typing.instant);
    // A line that is all there at once is held for a moment like one that was just written out:
    // a button held down skips nothing unread.
    if (this.writer.done && !this.app.deps.fast) this.hold = Math.max(this.hold, SCENE_HOLD_MS / 2);
  }

  private get asking(): boolean { return this.answers !== null && !this.answered; }

  update(dtMs: number): void {
    const before = this.clock;
    this.clock += dtMs;
    this.hold = Math.max(0, this.hold - dtMs);
    hearThunder(this.app, this.scene.picture, before, this.clock);
    this.typeTick -= dtMs;
    if (!this.asking && this.writer.update(dtMs) > 0 && this.typeTick <= 0) {
      this.app.deps.sfx?.play('type');
      this.typeTick = 80;
    }
  }

  onInput(action: InputAction): void {
    if (this.asking) {
      if (action === 'up') this.answers!.move(-1);
      else if (action === 'down') this.answers!.move(1);
      else if (action === 'confirm' && this.hold <= 0) this.answer();
      return;
    }
    if (action !== 'confirm' || this.hold > 0) return;
    if (!this.writer.done) {
      this.writer.finish();
      this.hold = this.app.deps.fast ? 0 : SCENE_HOLD_MS / 2;
      return;
    }
    if (this.at + 1 < this.said.length) {
      this.at += 1;
      this.open();
      return;
    }
    const choice = this.scene.choice;
    // A question answered before the game was closed is not asked again: the answer given is replied to.
    const given = choice && !this.answered ? choice.options.find((o) => o.id === this.app.game?.choices?.[choice.id]) : undefined;
    if (given) {
      this.answered = true;
      this.said.push(given.reply);
      this.at = this.said.length - 1;
      this.open();
      return;
    }
    if (choice && !this.answered) {
      // The talking is done: the question is on the table. What is answered stands, so a button being
      // mashed through the talk gets nowhere for a good while.
      this.answers = new MenuList(choice.options.map((o) => ({ id: o.id, label: o.label, enabled: true })));
      this.hold = this.app.deps.fast ? 0 : QUESTION_HOLD_MS;
      return;
    }
    this.app.finishScene(this.scene);
  }

  private answer(): void {
    const choice = this.scene.choice!;
    const option = choice.options[this.answers!.cursor];
    this.app.decide(choice.id, option.id, option.pay ?? 0);
    this.answered = true;
    this.said.push(option.reply);
    this.at = this.said.length - 1;
    this.open();
  }

  view(): ScreenView {
    const line = this.said[this.at];
    return {
      menu: this.asking ? { items: this.answers!.items, cursor: this.answers!.cursor } : { items: [], cursor: 0 },
      scene: this.scene.id, typing: !this.writer.done, busy: this.hold > 0,
      talk: { at: this.at, of: this.said.length, who: line?.who ?? '', asking: this.asking },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { scene } = this;
    const { sprites } = this.app.deps;
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // The place the talking is done in, alive, under a light shade: what is said has a box of its own to be read in.
    if (scene.picture) drawPlace(ctx, this.app, scene.picture, this.clock);
    ctx.fillStyle = `rgba(8, 8, 20, ${TALK_VEIL})`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    if (scene.heading) drawOutlined(ctx, scene.heading, LOGICAL_W / 2, 10, { align: 'center', color: COLORS.dim });
    // What the conversation is called, in the sign's letters; in the font where the sign cannot write it.
    const tall = fitTall(scene.title, TALK_TITLE_W, TALK_TITLE_TALL);
    if (tall === null) drawText(ctx, scene.title, LOGICAL_W / 2, 22, { size: 16, align: 'center', color: COLORS.accent });
    else drawWord(ctx, scene.title, LOGICAL_W / 2, wordTop(TALK_TITLE_Y, tall), { tall, metal: 'neon' });

    const line = this.said[this.at];
    drawPanel(ctx, 4, PANEL_Y, LOGICAL_W - 8, LOGICAL_H - PANEL_Y - 4);
    drawPortrait(ctx, sprites, line?.portrait, 8, PANEL_Y + 4, 56);
    if (this.asking) {
      drawText(ctx, STRINGS.scene.yourCall, TEXT_X, PANEL_Y + 6, { color: COLORS.heat });
      drawList(ctx, this.answers!, TEXT_X, PANEL_Y + 24, LOGICAL_W - TEXT_X - 12, 4);
      if (this.hold <= 0) drawText(ctx, STRINGS.scene.answer, TEXT_X, LOGICAL_H - 18, { color: COLORS.dim });
      return;
    }
    drawText(ctx, (line?.who ?? '').toUpperCase(), TEXT_X, PANEL_Y + 6, { color: COLORS.accent });
    this.writer.visible().slice(0, TALK_SCENE_LINES).forEach((text, i) => drawText(ctx, text, TEXT_X, PANEL_Y + 21 + i * LINE));
    if (this.writer.done && (this.app.deps.fast || Math.floor(this.clock / 400) % 2 === 0)) {
      drawText(ctx, 'v', LOGICAL_W - 14, LOGICAL_H - 16, { color: COLORS.dim });
    }
  }
}
