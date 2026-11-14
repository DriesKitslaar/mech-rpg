import type { BuildSlot } from '../core/game';
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
    if (result === 'changed') {
      this.app.commit(this.flow.game);
      // The next change starts from the game as it was saved, not from the copy made before it.
      this.flow.adopt(this.app.game!);
    } else if (result === 'exit') this.app.go('hub');
  }

  view(): ScreenView {
    const { flow } = this;
    const list = { slots: flow.slots, parts: flow.parts, loadouts: flow.loadouts, loadoutMenu: flow.loadoutMenu }[flow.mode];
    return {
      menu: { items: list.items, cursor: list.cursor },
      garage: { mode: flow.mode, slot: flow.slot, candidate: flow.candidate, errors: flow.errors, paint: flow.game.paint },
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
    drawMech(ctx, mechSprites(sprites, flow.previewBuild, flow.game.paint), 0, 30, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, G.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, G.back, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    // Right: the slot list, or the parts for the chosen slot with the highlighted part's statistics.
    drawPanel(ctx, LIST_X, 20, LIST_W, 174);
    if (flow.mode === 'slots') {
      flow.slots.items.forEach((item, i) => {
        const selected = i === flow.slots.cursor;
        const y = 24 + i * 15;
        if (selected) drawText(ctx, '>', LIST_X + 3, y, { color: COLORS.accent });
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
          if (selected) drawText(ctx, '>', LIST_X + 6, y, { color: COLORS.accent });
          drawText(ctx, item.label, LIST_X + 14, y, { color: !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text });
        });
        const missing = flow.loadoutMenu.items[0].note;
        if (missing) drawText(ctx, missing, LIST_X + 6, 146, { color: COLORS.danger });
      }
    } else {
      drawText(ctx, STRINGS.slots[flow.slot].toUpperCase(), LIST_X + 6, 24, { color: COLORS.dim });
      drawList(ctx, flow.parts, LIST_X + 6, 37, LIST_W - 18, 7);
      const part = flow.candidate ? catalog[flow.candidate] : undefined;
      if (part) {
        ctx.fillStyle = COLORS.border;
        ctx.fillRect(LIST_X + 6, 119, LIST_W - 12, 1);
        partLines(part).slice(0, 6).forEach((line, i) => drawText(ctx, line, LIST_X + 6, 123 + i * LINE));
      }
    }

    this.drawStats(ctx);
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
