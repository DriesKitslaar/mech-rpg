import { boostProfile, computeBuildStats, framePart } from '../core/build';
import { FRAME_SLOTS } from '../core/types';
import { STARTERS } from '../content/starters';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { idlePose } from './pose';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const T = STRINGS.starter;
const G = STRINGS.garage;
/** How many rows of figures stand under the list. */
const FIGURES = 5;
/** The panel the list and the figures stand in: on the right, where the garage has its own. The frame stands left of it. */
const LIST = { x: LOGICAL_W - 154, y: 18, w: 150 };
/** The panel that says what the frame under the cursor is. */
const ABOUT = { y: 182, h: 84 };

/**
 * The lot: the three frames a new pilot chooses between, after the callsign and before the story. The one under the
 * cursor is drawn large, with what it is and its figures as the garage will give them. The first is the frame every
 * pilot used to start in, so a pilot who presses on without looking gets what they always got.
 */
export class StarterScreen implements Screen {
  private list: MenuList;
  private clock = 0;

  constructor(private app: App, private slot: number, private callsign: string) {
    this.list = new MenuList(STARTERS.map((starter) => ({ id: starter.id, label: starter.name, enabled: true, note: starter.role })), 0);
  }

  private get starter() {
    return STARTERS[this.list.cursor];
  }

  /** The figures of the frame under the cursor, by the names the garage has for them and worked out as the garage does. */
  private figures(): [string, string][] {
    const { catalog } = this.app.deps;
    const { build } = this.starter;
    const stats = computeBuildStats(build, catalog);
    const armour = FRAME_SLOTS.reduce((sum, slot) => sum + (framePart(build, slot, catalog)?.ap ?? 0), 0);
    const boost = boostProfile(build, catalog);
    return [
      [G.armour, String(armour)],
      [G.mobility, String(stats.mobility)],
      [G.evasion, String(stats.mobility + (boost.able ? boost.thrust : 0))],
      [G.weight, `${stats.weight}/${stats.capacity}`],
      [T.credits, String(this.starter.credits)],
    ];
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    // Back to the name, as it was typed.
    else if (action === 'cancel') this.app.askCallsign(this.slot, this.callsign);
    else if (action === 'confirm') this.app.startNewGame(this.slot, this.callsign, this.starter.id);
  }

  view(): ScreenView {
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      starter: { id: this.starter.id, callsign: this.callsign, slot: this.slot, credits: this.starter.credits, figures: this.figures() },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites, fast } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.35)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // The frame under the cursor, where a mech stands in the garage and as it stands there: facing the list,
    // breathing, and still where the game is hurried. It is not turned round: what is painted on it reads as it was painted.
    const starter = this.starter;
    const calm = this.app.settings.calm === true;
    const clock = fast ? 0 : this.clock;
    drawRoom(ctx, 'bg-garage', clock, calm, fast);
    drawMechShadow(ctx, 0, LIST.y);
    drawMech(ctx, mechSprites(sprites, starter.build), 0, LIST.y, { dx: 0, dy: 0 }, 0, fast ? {} : idlePose(this.clock));
    drawRoomSpill(ctx, 'bg-garage', clock, calm);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, T.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, this.callsign, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    const rows = STARTERS.length;
    drawPanel(ctx, LIST.x, LIST.y, LIST.w, 20 + rows * LINE + 6 + FIGURES * LINE);
    drawList(ctx, this.list, LIST.x + 6, LIST.y + 6, LIST.w - 16, rows);
    // Its figures, under the three names.
    const top = LIST.y + 6 + rows * LINE + 8;
    this.figures().forEach(([label, value], i) => {
      drawText(ctx, label, LIST.x + 14, top + i * LINE, { color: COLORS.dim });
      drawText(ctx, value, LIST.x + LIST.w - 10, top + i * LINE, { align: 'right' });
    });

    // What it is, in the words of whoever keeps the lot.
    drawPanel(ctx, 4, ABOUT.y, LOGICAL_W - 8, ABOUT.h);
    drawText(ctx, starter.name.toUpperCase(), 12, ABOUT.y + 4, { size: 16, color: COLORS.accent });
    drawText(ctx, starter.role, 12, ABOUT.y + 22, { color: COLORS.armor });
    wrap(starter.text, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, ABOUT.y + 33 + i * LINE));
    drawText(ctx, T.hint, LOGICAL_W / 2, ABOUT.y + 71, { align: 'center', color: COLORS.dim });
  }
}
