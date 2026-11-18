import type { BuildSlot } from '../core/game';
import type { BuildStats } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { GarageFlow } from './garageFlow';
import { drawMech, mechSprites } from './mechView';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { idlePose } from './pose';
import { partLines } from './partInfo';
import { CHAR_W, COLORS, LINE, drawList, drawPanel, drawRowLight, drawText } from './widgets';

const G = STRINGS.garage;
const LIST_X = 162;
const LIST_W = LOGICAL_W - LIST_X;
const STATS_Y = 196;

/** Draws the garage and passes its results to the app: every change is saved at once. */
export class GarageScreen implements Screen {
  private flow: GarageFlow;
  private clock = 0;

  constructor(private app: App) {
    this.flow = new GarageFlow(app.game!, app.deps.catalog);
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    const result = this.flow.onInput(action);
    if (result === 'changed') {
      this.app.commit(this.flow.game);
      // The next change starts from the game as it was saved, not from the copy made before it.
      this.flow.adopt(this.app.game!);
    } else if (result === 'exit') this.app.go('hub');
  }

  view(): ScreenView {
    const { flow } = this;
    const list = { slots: flow.slots, parts: flow.parts, loadouts: flow.loadouts, loadoutMenu: flow.loadoutMenu, bench: flow.bench }[flow.mode];
    const bench = flow.benchInfo;
    return {
      menu: { items: list.items, cursor: list.cursor },
      garage: { mode: flow.mode, slot: flow.slot, candidate: flow.candidate, errors: flow.errors, paint: flow.game.paint, ...(bench ? { bench } : {}) },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    // The mech shows the highlighted part already fitted, so a choice can be judged before confirming.
    const { fast } = this.app.deps;
    const calm = this.app.settings.calm === true;
    const clock = fast ? 0 : this.clock;
    drawRoom(ctx, 'bg-garage', clock, calm, fast);
    drawMechShadow(ctx, 0, 30);
    drawMech(ctx, mechSprites(sprites, flow.previewBuild, flow.game.paint), 0, 30, { dx: 0, dy: 0 }, 0, fast ? {} : idlePose(this.clock));
    drawRoomSpill(ctx, 'bg-garage', clock, calm);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, G.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, G.back, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    // Right: the slot list, or the parts for the chosen slot with the highlighted part's statistics.
    drawPanel(ctx, LIST_X, 20, LIST_W, 174);
    if (flow.mode === 'slots') {
      flow.slots.items.forEach((item, i) => {
        const selected = i === flow.slots.cursor;
        const y = 24 + i * 15;
        if (selected) {
          drawRowLight(ctx, LIST_X + 1, y + 1, LIST_W - 3);
          drawText(ctx, '>', LIST_X + 3, y, { color: COLORS.accent });
        }
        drawText(ctx, G.slotTags[item.id as BuildSlot], LIST_X + 10, y + 1, { color: COLORS.dim, size: 10 });
        drawText(ctx, item.note ?? '', LIST_X + 40, y, { color: selected ? COLORS.accent : item.note === G.empty ? COLORS.dim : COLORS.text });
      });
    } else if (flow.mode === 'loadouts' || flow.mode === 'loadoutMenu') {
      drawText(ctx, G.loadouts, LIST_X + 6, 24, { color: COLORS.dim });
      drawList(ctx, flow.loadouts, LIST_X + 6, 40, LIST_W - 18, 3);
      if (flow.mode === 'loadoutMenu') {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(LIST_X + 6, 80, LIST_W - 12, 1);
        // The load entry's note says which part is missing; it gets a line of its own so it fits.
        flow.loadoutMenu.items.forEach((item, i) => {
          const selected = i === flow.loadoutMenu.cursor;
          const y = 88 + i * 13;
          if (selected) {
            drawRowLight(ctx, LIST_X + 3, y + 1, LIST_W - 15);
            drawText(ctx, '>', LIST_X + 6, y, { color: COLORS.accent });
          }
          drawText(ctx, item.label, LIST_X + 14, y, { color: !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text });
        });
        const missing = flow.loadoutMenu.items[0].note;
        if (missing) drawText(ctx, missing, LIST_X + 6, 146, { color: COLORS.danger });
      }
    } else if (flow.mode === 'bench') {
      this.drawBench(ctx);
    } else {
      drawText(ctx, STRINGS.slots[flow.slot].toUpperCase(), LIST_X + 6, 24, { color: COLORS.dim });
      // On a part the bench takes, the head of the list says which button puts it there: the foot of
      // the screen may be taken up by what is wrong with the build, and that is when the bench matters.
      if (flow.benchable) drawText(ctx, G.toBench, LOGICAL_W - 8, 25, { align: 'right', color: COLORS.dim, size: 10 });
      drawList(ctx, flow.parts, LIST_X + 6, 37, LIST_W - 18, 7);
      // The part as the pilot's garage reads it: with what the bench has done to it counted in.
      const part = flow.candidate ? flow.partOf(flow.candidate) : undefined;
      if (part) {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(LIST_X + 6, 119, LIST_W - 12, 1);
        partLines(part).slice(0, 6).forEach((line, i) => drawText(ctx, line, LIST_X + 6, 123 + i * LINE));
      }
    }

    this.drawStats(ctx);
  }

  /** The bench: the part on it, where it stands, what the next step would make of it, and the choice. */
  private drawBench(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const bench = flow.benchInfo;
    if (!bench) return;
    const x = LIST_X + 6;
    drawText(ctx, G.bench, x, 24, { color: COLORS.dim });
    drawText(ctx, bench.name, x, 40, { color: COLORS.accent });
    drawText(ctx, G.benchStep(bench.step, bench.cap), x, 40 + LINE);
    // What the bench works on: as it is and, while there is a step to take, as that step would leave it.
    const figure = `${G.benchFigures[bench.figure]} ${bench.now}`;
    drawText(ctx, figure, x, 40 + 2 * LINE + 2);
    if (bench.refusal !== 'limit') {
      drawText(ctx, `> ${bench.next}`, x + (figure.length + 1) * CHAR_W, 40 + 2 * LINE + 2, { color: COLORS.armor });
    }
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(x, 84, LIST_W - 12, 1);
    drawList(ctx, flow.bench, x, 90, LIST_W - 18, 2);
    drawText(ctx, G.benchCredits(flow.game.credits), x, 90 + 2 * LINE + 6, { color: COLORS.dim });
    if (bench.refusal === 'credits') drawText(ctx, G.benchShort, x, 90 + 3 * LINE + 6, { color: COLORS.danger });
  }

  private drawStats(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const now = flow.stats;
    const next = flow.preview;
    const errors = flow.shownErrors;
    drawPanel(ctx, 0, STATS_Y, LOGICAL_W, LOGICAL_H - STATS_Y);

    const cell = (label: string, value: string, diff: number, higherIsBetter: boolean, bad: boolean, col: number, row: number): void => {
      const x = 8 + col * 152;
      const y = STATS_Y + 5 + row * (LINE + 2);
      drawText(ctx, label, x, y, { color: COLORS.dim });
      drawText(ctx, value, x + 92, y, { align: 'right', color: bad ? COLORS.danger : COLORS.text });
      if (diff !== 0) {
        const good = diff > 0 === higherIsBetter;
        drawText(ctx, diff > 0 ? `+${diff}` : String(diff), x + 96, y, { color: good ? COLORS.armor : COLORS.danger });
      }
    };
    const capacity = (s: BuildStats): string => (Number.isFinite(s.capacity) ? String(s.capacity) : '-');
    cell(G.weight, `${next.weight}/${capacity(next)}`, next.weight - now.weight, false, errors.includes('overweight'), 0, 0);
    cell(G.energy, String(next.turnEnergy), next.turnEnergy - now.turnEnergy, true, errors.includes('insufficientEnergy'), 1, 0);
    cell(G.mobility, String(next.mobility), next.mobility - now.mobility, true, false, 0, 1);
    cell(G.armour, String(flow.armour(flow.previewBuild)), flow.armour(flow.previewBuild) - flow.armour(flow.game.build), true, false, 1, 1);
    cell(G.stability, String(next.stability), next.stability - now.stability, true, false, 0, 2);
    const was = flow.details(flow.game.build);
    const will = flow.details(flow.previewBuild);
    cell(G.cooling, String(will.cooling), will.cooling - was.cooling, true, false, 1, 2);
    cell(G.evasion, String(will.evasion), will.evasion - was.evasion, true, false, 0, 3);
    // A volley that takes more than a turn's energy is not an error, but worth seeing: it shows in the warning colour.
    cell(G.volley, String(will.volley), will.volley - was.volley, false, will.volley > next.turnEnergy, 1, 3);

    if (errors.length > 0) {
      drawText(ctx, errors.map((e) => STRINGS.buildErrors[e]).join(' - '), LOGICAL_W / 2, STATS_Y + 57, { align: 'center', color: COLORS.danger, size: 16 });
    } else if (flow.mode === 'slots') {
      // With nothing wrong, the foot of the panel says what the shoulder buttons and the D-pad do here.
      drawText(ctx, G.paint(flow.paintName), 8, STATS_Y + 61, { color: COLORS.dim, size: 10 });
      drawText(ctx, G.toLoadouts, LOGICAL_W - 8, STATS_Y + 61, { align: 'right', color: COLORS.dim, size: 10 });
    }
  }
}
