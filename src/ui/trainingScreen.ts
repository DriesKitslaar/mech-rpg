import { DRILL_PAY } from '../core/training';
import { DRILLS } from '../content/drills';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const T = STRINGS.training;

/** The simulator: ten drills, each shown with the mech it lends. Passing one pays once; none of them costs anything. */
export class TrainingScreen implements Screen {
  private list: MenuList;
  private clock = 0;

  /** `at` puts the cursor on that drill, for returning from its briefing or its settlement. */
  constructor(private app: App, at?: string) {
    const drills = app.drillList();
    this.list = new MenuList(drills.map(({ drill, open, passed }) => ({
      id: drill.id, label: drill.title, enabled: open, note: !open ? T.locked : passed ? T.passed : String(DRILL_PAY),
    })), Math.max(0, drills.findIndex(({ drill }) => drill.id === at)));
  }

  private get drill() {
    return DRILLS[this.list.cursor];
  }

  private count(): string {
    return T.count(this.app.drillList().filter((d) => d.passed).length, DRILLS.length);
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.list.selected?.enabled) this.app.openDrillBriefing(this.drill.id);
  }

  view(): ScreenView {
    return {
      menu: { items: this.list.items, cursor: this.list.cursor }, count: this.count(),
      detail: { title: this.drill.title.toUpperCase(), lesson: this.drill.lesson },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-arena', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.35)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // The mech the selected drill lends, facing left towards the list.
    const drill = this.drill;
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMech(ctx, mechSprites(sprites, drill.build), 0, 0, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));
    ctx.restore();

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, T.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, this.count(), LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    drawPanel(ctx, 4, 18, 150, 20 + DRILLS.length * LINE);
    drawText(ctx, T.pays, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, DRILLS.length);

    // What the selected drill is about, in the simulator's own words.
    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    const selected = this.list.selected;
    const state = !selected?.enabled ? T.locked : selected.note === T.passed ? T.passed : T.open;
    drawText(ctx, drill.title.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === T.locked ? COLORS.danger : state === T.passed ? COLORS.armor : COLORS.dim });
    drawText(ctx, drill.lesson, 12, 207, { color: COLORS.armor });
    const text = selected?.enabled ? drill.briefing[0] : T.lockedNote;
    wrap(text, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 219 + i * LINE));
    drawText(ctx, T.hint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }
}
