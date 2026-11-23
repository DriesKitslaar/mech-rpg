import { archetypeOf, type Archetype } from '../core/archetype';
import { computeBuildStats } from '../core/build';
import { SPAR_ENEMY, parseRange, parseSpar } from '../core/range';
import { DRILL_PAY } from '../core/training';
import { tunedCatalog } from '../core/tuning';
import type { Build, BuildError } from '../core/types';
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
import { COLORS, LINE, STATE_COLORS, charsFor, drawList, drawPanel, drawTabs, drawText, wrap } from './widgets';

const T = STRINGS.training;
const C = STRINGS.classes;
const G = STRINGS.garage;

/** The simulator's pages: its drills, and the range where the pilot's own build is tried. */
export type TrainingPage = 'drills' | 'range';
const PAGES: TrainingPage[] = ['drills', 'range'];
/** Rows of the list that are in view at once: as many as there are drills. */
const ROWS = DRILLS.length;
/**
 * Where the machines of the range stand: the box beside the list, how much larger than life one may be drawn,
 * and how far along its own width each of several stands from the one before it.
 */
/**
 * The room the panel at the foot has for what a drill is about, or for the note of a machine on the range: this
 * many lines of this many letters. Nothing more of a text is drawn, so every text shown there has to fit, in
 * every language.
 */
export const PANEL_CHARS = charsFor(LOGICAL_W - 28);
export const PANEL_LINES = 3;
const STAND = { x: 160, y: 20, w: 144, h: 160 };
const STAND_SCALE = 2;
const STAND_STEP = 0.55;

/** What is said of a saved build to spar with: where it is saved, its parts, the kind of machine it is, and its figures as the garage reads them. */
interface Sparred { slot: number; build: Build; kind: Archetype; armour: number; mobility: number; energy: number }
/** A row of the range as the screen holds it: what the app listed, and the saved build it is when it is one. */
interface Fielded { kind: string; name: string; limit: number; spar: Sparred | null }

/**
 * The simulator. Its first page is the drills, each shown with the mech it lends: passing one pays
 * once, and none of them costs anything. Its second is the range: every machine the pilot has met,
 * to be fought in the pilot's own build for nothing.
 */
export class TrainingScreen implements Screen {
  private page: TrainingPage;
  private drills: MenuList;
  private machines: MenuList;
  /**
   * What the range can field, how many drills are passed, and whether the pilot's own mech may deploy.
   * Nothing on this screen changes any of them, so the app is asked once, when the screen is opened,
   * and not again with every frame.
   */
  private readonly fielded: Fielded[];
  private readonly passed: number;
  /** Why the range is closed, when it is: the first thing that keeps the pilot's own mech from deploying. */
  private readonly shut: BuildError | null;
  /** How many of each machine the range is to field: one, until the pilot says otherwise. */
  private counts = new Map<string, number>();
  private clock = 0;

  /** `at` puts the cursor where a briefing or a settlement was left from: a drill's id, or a fight on the range's. */
  constructor(private app: App, at?: string) {
    const drills = app.drillList();
    this.passed = drills.filter((d) => d.passed).length;
    this.drills = new MenuList(drills.map(({ drill, open, passed }) => ({
      id: drill.id, label: drill.title, enabled: open, note: !open ? T.locked : passed ? T.passed : String(DRILL_PAY),
    })), Math.max(0, drills.findIndex(({ drill }) => drill.id === at)));
    this.fielded = app.rangeList().map(({ kind, name, limit, spar }) => ({ kind, name, limit, spar: this.sparred(spar) }));
    this.shut = app.buildErrors()[0] ?? null;
    // A fight on the range was against so many of a machine, or a spar with the saved build of a slot.
    const spar = at ? parseSpar(at) : null;
    const fought = spar !== null ? { kind: SPAR_ENEMY(spar), count: 1 } : at ? parseRange(at) : null;
    this.page = fought ? 'range' : 'drills';
    if (fought) this.counts.set(fought.kind, fought.count);
    this.machines = new MenuList(this.rows(), Math.max(0, this.fielded.findIndex((machine) => machine.kind === fought?.kind)));
  }

  /** The saved build a row of the range stands for, when it is one of the pilot's own to spar with: its class, and its figures with the bench's work counted. */
  private sparred(slot: number | undefined): Sparred | null {
    const build = slot === undefined ? null : this.app.game?.loadouts[slot];
    if (slot === undefined || !build) return null;
    const catalog = tunedCatalog(this.app.deps.catalog, this.app.game?.tuning);
    const stats = computeBuildStats(build, catalog);
    const armour = (['head', 'core', 'arms', 'legs'] as const).reduce((sum, part) => sum + (catalog[build[part]!] as { ap: number }).ap, 0);
    return { slot, build, kind: archetypeOf(build, this.app.deps.catalog), armour, mobility: stats.mobility, energy: stats.turnEnergy };
  }

  /**
   * The range's rows. A saved build to spar with goes by the name the garage gives it, with the kind of
   * machine it is; a machine met goes by its name, with how many of it are to be fielded. While the range
   * is closed they are there to be read and none of them can be chosen. They carry no note then: a list
   * writes the note of a row that cannot be chosen in the colour of what is wrong, and what is wrong is
   * said once, under the list.
   */
  private rows(): { id: string; label: string; enabled: boolean; note?: string }[] {
    const open = this.shut === null;
    return this.fielded.map(({ kind, name, spar }) => ({
      id: kind, label: name, enabled: open, note: !open ? undefined : spar ? C.names[spar.kind] : T.rangeCount(this.counts.get(kind) ?? 1),
    }));
  }

  private get list(): MenuList {
    return this.page === 'drills' ? this.drills : this.machines;
  }

  private get drill() {
    return DRILLS[this.drills.cursor];
  }

  /** What is under the cursor on the range, how many of it are asked for, and how many may be; and the saved build it is, when it is one. */
  private get machine(): (Fielded & { count: number }) | null {
    const entry = this.fielded[this.machines.cursor];
    return entry ? { ...entry, count: Math.min(entry.limit, this.counts.get(entry.kind) ?? 1) } : null;
  }

  private count(): string {
    // Machines met, of those the database has: the pilot's own builds are not among either.
    if (this.page === 'range') return STRINGS.database.met(this.fielded.filter((entry) => !entry.spar).length, UNITS.length);
    return T.count(this.passed, DRILLS.length);
  }

  /** One more or one fewer of a machine, round and round within what may be fielded. */
  private field(machine: Fielded & { count: number }, step: number): void {
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
      // A range that is closed can be read, and that is all.
      if (!machine || this.shut !== null) return;
      if (action === 'left' || action === 'right') this.field(machine, action === 'right' ? 1 : -1);
      else if (action === 'confirm') this.app.openRangeBriefing(machine.kind, machine.count);
    } else if (action === 'confirm' && this.list.selected?.enabled) this.app.openDrillBriefing(this.drill.id);
  }

  view(): ScreenView {
    const machine = this.machine;
    const title = !machine ? '' : machine.spar ? T.spar(machine.spar.slot + 1) : ALL_ENEMIES[machine.kind].name;
    return {
      menu: { items: this.list.items, cursor: this.list.cursor }, count: this.count(), page: this.page,
      detail: this.page === 'drills' ? { title: this.drill.title.toUpperCase(), lesson: this.drill.lesson } : { title: title.toUpperCase(), lesson: '' },
      // On the range: what is under the cursor, how many of it are to be fielded, and how many may be.
      range: this.page === 'range' && machine ? { kind: machine.kind, count: machine.count, limit: machine.limit } : null,
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
    const machine = this.machine;
    if (this.page === 'drills') this.drawMech(ctx, this.drill.build);
    else if (machine?.spar) this.drawMech(ctx, machine.spar.build);
    else if (machine) this.drawMachine(ctx, machine);
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
    else this.drawRange(ctx, machine);
  }

  /** A mech beside the list, facing left towards it: the one the selected drill lends, or the saved build that is sparred with. */
  private drawMech(ctx: CanvasRenderingContext2D, build: Build): void {
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMechShadow(ctx, 0, 0);
    drawMech(ctx, mechSprites(this.app.deps.sprites, build), 0, 0, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));
    ctx.restore();
  }

  /**
   * What the range is to field, standing beside the list: as many of the machine as were asked for, in a row
   * that overlaps, as large as the box allows and no more than twice their size.
   */
  private drawMachine(ctx: CanvasRenderingContext2D, machine: Fielded & { count: number }): void {
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
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === T.locked ? STATE_COLORS.shut : state === T.passed ? STATE_COLORS.done : STATE_COLORS.todo });
    drawText(ctx, drill.lesson, 12, 207, { color: COLORS.armor });
    const text = selected?.enabled ? drill.briefing[0] : T.lockedNote;
    wrap(text, PANEL_CHARS).slice(0, PANEL_LINES).forEach((row, i) => drawText(ctx, row, 12, 219 + i * LINE));
    drawText(ctx, T.hint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }

  /** The machine under the cursor: its name, how many are fielded, its armour and what it is weak to, and what the database says of it. */
  private drawRange(ctx: CanvasRenderingContext2D, machine: (Fielded & { count: number }) | null): void {
    // The last row names the keys; while the range is closed none of them does anything, and it says why instead.
    const hint = (keys: string): void => {
      const shut = this.shut;
      drawText(ctx, shut ? T.rangeShut(STRINGS.buildErrors[shut]) : keys, LOGICAL_W / 2, 255, { align: 'center', color: shut ? COLORS.danger : COLORS.dim });
    };
    if (!machine) {
      // Nothing has been met: nothing to field yet.
      wrap(T.rangeEmpty, charsFor(LOGICAL_W - 28)).forEach((row, i) => drawText(ctx, row, 12, 207 + i * LINE, { color: COLORS.dim }));
      hint(T.hint);
      return;
    }
    if (machine.spar) {
      // A saved build to spar with: its name in the garage, its figures with the bench's work counted, what kind of machine it is.
      const { slot, kind, armour, mobility, energy } = machine.spar;
      drawText(ctx, T.spar(slot + 1).toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
      // In capitals, as the line of a machine from the book is.
      drawText(ctx, `${G.armour.toUpperCase()} ${armour}   ${G.mobility.toUpperCase()} ${mobility}   ${G.energy.toUpperCase()} ${energy}`, 12, 207, { color: COLORS.armor });
      drawText(ctx, C.garage(C.names[kind], C.tags[kind]), 12, 219);
      drawText(ctx, T.sparNote, 12, 219 + LINE, { color: COLORS.dim });
      hint(T.hint);
      return;
    }
    const def = ALL_ENEMIES[machine.kind];
    const [armour, weak] = unitPage(def, this.app.deps.catalog).stats;
    drawText(ctx, def.name.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    // How many: lit where it can be set, which it cannot where one is all there may be, nor on a range that is closed.
    drawText(ctx, T.rangeCount(machine.count), LOGICAL_W - 12, 191, { align: 'right', color: machine.limit > 1 && this.shut === null ? COLORS.text : COLORS.dim });
    drawText(ctx, `${armour.label} ${armour.value}   ${weak.label} ${weak.value}`, 12, 207, { color: COLORS.armor });
    const note = UNITS.find((unit) => unit.id === machine.kind)?.note ?? '';
    wrap(note, PANEL_CHARS).slice(0, PANEL_LINES).forEach((row, i) => drawText(ctx, row, 12, 219 + i * LINE));
    hint(T.rangeHint);
  }
}
