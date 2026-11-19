import { parseRange } from '../core/range';
import { DRILL_PAY } from '../core/training';
import { ALL_ENEMIES } from '../content/arena';
import { UNITS } from '../content/codex';
import { DRILLS } from '../content/drills';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { unitPage } from './unitPage';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawTabs, drawText, wrap } from './widgets';

const T = STRINGS.training;

/** The simulator's pages: its drills, and the range where the pilot's own build is tried. */
export type TrainingPage = 'drills' | 'range';
const PAGES: TrainingPage[] = ['drills', 'range'];
/** Rows of the list that are in view at once: as many as there are drills. */
const ROWS = DRILLS.length;
/**
 * Where the machines of the range stand: the box beside the list, how much larger than life one may be drawn,
 * and how far along its own width each of several stands from the one before it.
 */
const STAND = { x: 160, y: 20, w: 144, h: 160 };
const STAND_SCALE = 2;
const STAND_STEP = 0.55;

/**
 * The simulator. Its first page is the drills, each shown with the mech it lends: passing one pays
 * once, and none of them costs anything. Its second is the range: every machine the pilot has met,
 * to be fought in the pilot's own build for nothing.
 */
export class TrainingScreen implements Screen {
  private page: TrainingPage;
  private drills: MenuList;
  private machines: MenuList;
  /** How many of each machine the range is to field: one, until the pilot says otherwise. */
  private counts = new Map<string, number>();
  private clock = 0;

  /** `at` puts the cursor where a briefing or a settlement was left from: a drill's id, or a fight on the range's. */
  constructor(private app: App, at?: string) {
    const drills = app.drillList();
    this.drills = new MenuList(drills.map(({ drill, open, passed }) => ({
      id: drill.id, label: drill.title, enabled: open, note: !open ? T.locked : passed ? T.passed : String(DRILL_PAY),
    })), Math.max(0, drills.findIndex(({ drill }) => drill.id === at)));
    const fought = at ? parseRange(at) : null;
    this.page = fought ? 'range' : 'drills';
    if (fought) this.counts.set(fought.kind, fought.count);
    this.machines = new MenuList(this.rows(), Math.max(0, app.rangeList().findIndex((machine) => machine.kind === fought?.kind)));
  }

  /** The range's rows: each machine met by its name, with how many of it are to be fielded. */
  private rows(): { id: string; label: string; enabled: boolean; note: string }[] {
    return this.app.rangeList().map(({ kind, name }) => ({ id: kind, label: name, enabled: true, note: T.rangeCount(this.counts.get(kind) ?? 1) }));
  }

  private get list(): MenuList {
    return this.page === 'drills' ? this.drills : this.machines;
  }

  private get drill() {
    return DRILLS[this.drills.cursor];
  }

  /** The machine under the cursor on the range, how many of it are asked for, and how many may be. */
  private get machine(): { kind: string; count: number; limit: number } | null {
    const entry = this.app.rangeList()[this.machines.cursor];
    return entry ? { kind: entry.kind, count: this.counts.get(entry.kind) ?? 1, limit: entry.limit } : null;
  }

  private count(): string {
    if (this.page === 'range') return STRINGS.database.met(this.app.rangeList().length, UNITS.length);
    return T.count(this.app.drillList().filter((d) => d.passed).length, DRILLS.length);
  }

  /** One more or one fewer of the machine under the cursor, round and round within what may be fielded. */
  private field(step: number): void {
    const machine = this.machine;
    if (!machine) return;
    this.counts.set(machine.kind, ((machine.count - 1 + step + machine.limit) % machine.limit) + 1);
    this.machines.setItems(this.rows());
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'prev' || action === 'next') {
      this.page = PAGES[(PAGES.indexOf(this.page) + (action === 'next' ? 1 : -1) + PAGES.length) % PAGES.length];
    } else if (this.page === 'range') {
      const machine = this.machine;
      if (action === 'left' || action === 'right') this.field(action === 'right' ? 1 : -1);
      else if (action === 'confirm' && machine) this.app.openRangeBriefing(machine.kind, machine.count);
    } else if (action === 'confirm' && this.list.selected?.enabled) this.app.openDrillBriefing(this.drill.id);
  }

  view(): ScreenView {
    const machine = this.machine;
    return {
      menu: { items: this.list.items, cursor: this.list.cursor }, count: this.count(), page: this.page,
      detail: this.page === 'drills' ? { title: this.drill.title.toUpperCase(), lesson: this.drill.lesson }
        : { title: machine ? ALL_ENEMIES[machine.kind].name.toUpperCase() : '', lesson: '' },
      // On the range: the machine under the cursor, how many of it are to be fielded, and how many may be.
      range: this.page === 'range' ? machine : null,
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites, fast } = this.app.deps;
    const bg = sprites.get('bg-simulator', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.35)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    const calm = this.app.settings.calm === true;
    const clock = fast ? 0 : this.clock;
    drawRoom(ctx, 'bg-simulator', clock, calm, fast);
    if (this.page === 'drills') this.drawLent(ctx);
    else this.drawMachine(ctx);
    drawRoomSpill(ctx, 'bg-simulator', clock, calm);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, T.heading, 5, 1, { color: COLORS.accent });
    drawTabs(ctx, LOGICAL_W - 5, 1, PAGES.map((page) => T.pages[page]), PAGES.indexOf(this.page));

    // The list, with what it counts above it: drills passed, or machines met.
    drawPanel(ctx, 4, 18, 150, 20 + ROWS * LINE);
    drawText(ctx, this.count(), 10, 22, { color: COLORS.dim, size: 10 });
    if (this.page === 'drills') drawText(ctx, T.pays, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, ROWS);

    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    if (this.page === 'drills') this.drawDrill(ctx);
    else this.drawRange(ctx);
  }

  /** The mech the selected drill lends, facing left towards the list. */
  private drawLent(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMechShadow(ctx, 0, 0);
    drawMech(ctx, mechSprites(this.app.deps.sprites, this.drill.build), 0, 0, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));
    ctx.restore();
  }

  /**
   * What the range is to field, standing beside the list: as many of the machine as were asked for, in a row
   * that overlaps, as large as the box allows and no more than twice their size.
   */
  private drawMachine(ctx: CanvasRenderingContext2D): void {
    const machine = this.machine;
    if (!machine) return;
    const sprite = this.app.deps.sprites.get(ALL_ENEMIES[machine.kind].sprite, { w: 64, h: 64, label: '' });
    const row = 1 + STAND_STEP * (machine.count - 1);
    const scale = Math.min(STAND_SCALE, STAND.w / (sprite.w * row), STAND.h / sprite.h);
    // Rounded down, so that the row never runs out of its box.
    const w = Math.floor(sprite.w * scale);
    const h = Math.floor(sprite.h * scale);
    const step = Math.floor(w * STAND_STEP);
    const left = STAND.x + Math.round((STAND.w - w - step * (machine.count - 1)) / 2);
    for (let i = 0; i < machine.count; i++) ctx.drawImage(sprite.image, left + i * step, STAND.y + STAND.h - h, w, h);
  }

  /** What the selected drill is about, in the simulator's own words. */
  private drawDrill(ctx: CanvasRenderingContext2D): void {
    const drill = this.drill;
    const selected = this.list.selected;
    const state = !selected?.enabled ? T.locked : selected.note === T.passed ? T.passed : T.open;
    drawText(ctx, drill.title.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === T.locked ? COLORS.danger : state === T.passed ? COLORS.armor : COLORS.dim });
    drawText(ctx, drill.lesson, 12, 207, { color: COLORS.armor });
    const text = selected?.enabled ? drill.briefing[0] : T.lockedNote;
    wrap(text, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 219 + i * LINE));
    drawText(ctx, T.hint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }

  /** The machine under the cursor: its name, how many are fielded, its armour and what it is weak to, and what the database says of it. */
  private drawRange(ctx: CanvasRenderingContext2D): void {
    const machine = this.machine;
    if (!machine) {
      // Nothing has been met: nothing to field yet.
      wrap(T.rangeEmpty, charsFor(LOGICAL_W - 28)).forEach((row, i) => drawText(ctx, row, 12, 207 + i * LINE, { color: COLORS.dim }));
      drawText(ctx, T.hint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
      return;
    }
    const def = ALL_ENEMIES[machine.kind];
    const [armour, weak] = unitPage(def, this.app.deps.catalog).stats;
    drawText(ctx, def.name.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, T.rangeCount(machine.count), LOGICAL_W - 12, 191, { align: 'right', color: machine.limit > 1 ? COLORS.text : COLORS.dim });
    drawText(ctx, `${armour.label} ${armour.value}   ${weak.label} ${weak.value}`, 12, 207, { color: COLORS.armor });
    const note = UNITS.find((unit) => unit.id === machine.kind)?.note ?? '';
    wrap(note, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 219 + i * LINE));
    drawText(ctx, T.rangeHint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }
}
