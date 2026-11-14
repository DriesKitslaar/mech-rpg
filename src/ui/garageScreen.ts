import type { BuildStats } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { GarageFlow } from './garageFlow';
import { drawMech, mechSprites } from './mechView';
import { partLines } from './partInfo';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

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
    if (result === 'changed') this.app.commit(this.flow.game);
    else if (result === 'exit') this.app.go('hub');
  }

  view(): ScreenView {
    const list = this.flow.mode === 'slots' ? this.flow.slots : this.flow.parts;
    return {
      menu: { items: list.items, cursor: list.cursor },
      garage: { mode: this.flow.mode, slot: this.flow.slot, candidate: this.flow.candidate, errors: this.flow.errors },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const { sprites, catalog } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    // The mech shows the highlighted part already fitted, so a choice can be judged before confirming.
    drawMech(ctx, mechSprites(sprites, flow.previewBuild), 0, 30, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, G.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, G.back, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    // Right: the slot list, or the parts for the chosen slot with the highlighted part's statistics.
    drawPanel(ctx, LIST_X, 20, LIST_W, 170);
    if (flow.mode === 'slots') {
      flow.slots.items.forEach((item, i) => {
        const selected = i === flow.slots.cursor;
        const y = 26 + i * 20;
        if (selected) drawText(ctx, '>', LIST_X + 4, y + 5, { color: COLORS.accent });
        drawText(ctx, item.label.toUpperCase(), LIST_X + 12, y, { color: COLORS.dim, size: 10 });
        drawText(ctx, item.note ?? '', LIST_X + 12, y + 8, { color: selected ? COLORS.accent : item.note === G.empty ? COLORS.dim : COLORS.text });
      });
    } else {
      drawText(ctx, STRINGS.slots[flow.slot].toUpperCase(), LIST_X + 6, 24, { color: COLORS.dim });
      drawList(ctx, flow.parts, LIST_X + 6, 38, LIST_W - 18, 8);
      const part = flow.candidate ? catalog[flow.candidate] : undefined;
      if (part) {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(LIST_X + 6, 134, LIST_W - 12, 1);
        partLines(part).forEach((line, i) => drawText(ctx, line, LIST_X + 6, 138 + i * LINE, { size: 10 }));
      }
    }

    this.drawStats(ctx);
  }

  private drawStats(ctx: CanvasRenderingContext2D): void {
    const { flow } = this;
    const now = flow.stats;
    const next = flow.preview;
    const errors = flow.mode === 'parts' ? flow.previewErrors : flow.errors;
    drawPanel(ctx, 0, STATS_Y, LOGICAL_W, LOGICAL_H - STATS_Y);

    const cell = (label: string, value: string, diff: number, higherIsBetter: boolean, bad: boolean, col: number, row: number): void => {
      const x = 8 + col * 152;
      const y = STATS_Y + 6 + row * (LINE + 3);
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

    if (errors.length > 0) {
      drawText(ctx, errors.map((e) => STRINGS.buildErrors[e]).join(' - '), LOGICAL_W / 2, STATS_Y + 40, { align: 'center', color: COLORS.danger, size: 16 });
    }
  }
}
