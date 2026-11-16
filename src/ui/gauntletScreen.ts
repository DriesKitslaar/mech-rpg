import { draft, floorsCleared, isWardenFloor, payout, wear, type BoonId, type Offer } from '../core/gauntlet';
import { groundFor } from '../core/ground';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { idlePose } from './pose';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, LINE, drawList, drawPanel, drawText, wrap } from './widgets';

const G = STRINGS.gauntlet;

/**
 * The Gauntlet's own room: where a run is started, where what is on offer after a floor is taken,
 * and where the way down is. It shows the frame the run is flown in and how worn it is.
 */
export class GauntletScreen implements Screen {
  private list!: MenuList;
  private offers: Offer[] = [];
  private asking = false;
  private clock = 0;

  constructor(private app: App) {
    this.open();
  }

  /** The list for wherever the run stands: nothing under way, a draft owed, or a floor waiting. */
  private open(): void {
    const run = this.app.run;
    this.asking = false;
    this.offers = run?.drafting ? draft(run, this.app.deps.catalog) : [];
    if (!run) {
      this.list = new MenuList([{ id: 'start', label: G.start, enabled: true }, { id: 'back', label: G.back, enabled: true }]);
    } else if (run.drafting) {
      this.list = new MenuList(this.offers.map((offer, i) => ({ id: `offer-${i}`, label: this.offerName(offer), enabled: true })));
    } else {
      this.list = new MenuList([
        { id: 'descend', label: G.descend, enabled: true }, { id: 'abandon', label: G.abandon, enabled: true }, { id: 'back', label: G.back, enabled: true },
      ]);
    }
  }

  private partName(id: string | undefined): string {
    return id ? this.app.deps.catalog[id]?.name ?? id : G.empty;
  }

  private offerName(offer: Offer): string {
    if (offer.kind === 'service') return G.service;
    if (offer.kind === 'boon') return G.boons[offer.boon].name;
    return this.partName(offer.part);
  }

  /** A few short lines about the thing the cursor is on. */
  private offerNotes(offer: Offer): string[] {
    if (offer.kind === 'service') return [G.serviceNote];
    if (offer.kind === 'boon') return [G.boons[offer.boon].note];
    return [G.slot(G.slots[offer.slot]), G.replaces, this.partName(this.app.run?.build[offer.slot])];
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') {
      if (this.asking) this.open();
      // A draft that is owed is not walked away from, but the game can be: the run waits in the save.
      else this.app.go('hub');
    } else if (action === 'confirm') this.choose(this.list.selected?.id ?? '');
  }

  private choose(id: string): void {
    if (this.asking) {
      if (id === 'yes') this.app.endGauntlet();
      return this.open();
    }
    if (id === 'start') { this.app.lastRun = null; this.app.startGauntlet(); return this.open(); }
    if (id === 'back') return this.app.go('hub');
    if (id === 'descend') return this.app.descendGauntlet();
    if (id === 'abandon') {
      this.asking = true;
      this.list = new MenuList([{ id: 'no', label: G.no, enabled: true }, { id: 'yes', label: G.yes, enabled: true }]);
      return;
    }
    const offer = this.offers[Number(id.slice(6))];
    if (offer) { this.app.takeDraft(offer); this.open(); }
  }

  view(): ScreenView {
    const run = this.app.run;
    const floor = this.app.gauntletAhead();
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      gauntlet: {
        best: this.app.game?.gauntletBest ?? 0, floor: run?.floor ?? null, drafting: !!run?.drafting, asking: this.asking,
        offers: this.offers, boons: run?.boons ?? {}, build: run?.build ?? null, enemies: floor?.battles[0].enemies ?? [], warden: !!run && isWardenFloor(run.floor), ground: groundFor(floor?.battles[0].background ?? '')?.id ?? null,
        wear: run ? Math.round(wear(run, this.app.deps.catalog) * 100) : 0, last: this.app.lastRun,
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { sprites, catalog } = this.app.deps;
    const run = this.app.run;
    const bg = sprites.get('bg-vault', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.55)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, G.heading, 5, 2, { color: COLORS.accent });
    drawText(ctx, G.best(this.app.game?.gauntletBest ?? 0), LOGICAL_W - 5, 2, { align: 'right', color: COLORS.dim });

    // The frame the run is flown in, on the left.
    if (run) drawMech(ctx, mechSprites(sprites, run.build), 0, 30, { dx: 0, dy: 0 }, 0, this.app.deps.fast ? {} : idlePose(this.clock));

    const x = 150;
    const w = LOGICAL_W - x - 4;
    drawPanel(ctx, x, 20, w, 244);
    let y = 26;
    if (!run) {
      const last = this.app.lastRun;
      if (last) {
        drawText(ctx, G.over, x + 6, y, { color: COLORS.danger });
        drawText(ctx, G.cleared(last.cleared), x + 6, y + LINE + 2);
        drawText(ctx, G.paid(last.paid), x + 6, y + 2 * LINE + 2, { color: COLORS.armor });
        if (last.record) drawText(ctx, G.record, x + 6, y + 3 * LINE + 2, { color: COLORS.heat });
        y += 5 * LINE;
      } else {
        G.pitch.forEach((line, i) => drawText(ctx, line, x + 6, y + i * LINE));
        y += (G.pitch.length + 1) * LINE;
      }
      drawList(ctx, this.list, x + 6, y, w - 16, 3);
      return;
    }
    const cleared = floorsCleared(run);
    const ahead = this.app.gauntletAhead();
    drawText(ctx, G.floorLabel(run.floor), x + 6, y, { size: 16, color: COLORS.accent });
    if (isWardenFloor(run.floor)) drawText(ctx, G.wardenLabel, x + w - 6, y + 4, { align: 'right', color: COLORS.danger });
    y += 20;
    drawText(ctx, G.armour(100 - Math.round(wear(run, catalog) * 100)), x + 6, y, { color: COLORS.armor });
    y += LINE;
    // The boons taken so far, in short, on as few lines as they need: the list below them must not be pushed off the panel.
    const boons = Object.entries(run.boons).filter(([, count]) => count > 0).map(([id, count]) => `${G.boons[id as BoonId].short}${count > 1 ? ` x${count}` : ''}`);
    for (const line of wrap(boons.join('  '), 36).slice(0, 2)) {
      if (line) { drawText(ctx, line, x + 6, y, { color: COLORS.dim, size: 10 }); y += LINE - 2; }
    }
    y += 4;
    if (this.asking) {
      drawText(ctx, G.abandonAsk(payout(cleared)), x + 6, y, { color: COLORS.heat });
      drawList(ctx, this.list, x + 6, y + LINE + 4, w - 16, 2);
      return;
    }
    // Who is on the floor ahead and what its ground does: said while choosing too, since that is what the choice is for.
    drawText(ctx, G.expected, x + 6, y, { color: COLORS.dim });
    const ground = groundFor(ahead?.battles[0].background ?? '');
    if (ground) drawText(ctx, STRINGS.ground[ground.id].name, x + w - 6, y, { align: 'right', color: COLORS.energy, size: 10 });
    const names = (ahead?.battles[0].enemies ?? []).map((id) => this.app.enemies()[id]?.name ?? id);
    names.forEach((name, i) => drawText(ctx, name, x + 6, y + (i + 1) * LINE));
    y += 4 * LINE + 4;
    if (run.drafting) {
      drawText(ctx, G.draftHeading, x + 6, y, { color: COLORS.heat });
      drawList(ctx, this.list, x + 6, y + LINE + 2, w - 16, 3);
      const offer = this.offers[this.list.cursor];
      if (offer) this.offerNotes(offer).forEach((line, i) => drawText(ctx, line, x + 6, y + 4 * LINE + 8 + i * (LINE - 1), { color: COLORS.dim }));
    } else {
      drawList(ctx, this.list, x + 6, y, w - 16, 3);
      // What the frame carries, under the list, as far as there is room above the hint.
      const carried = (['rightHand', 'leftHand', 'shoulder', 'module'] as const).flatMap((slot) => (run.build[slot] ? [this.partName(run.build[slot])] : []));
      carried.forEach((name, i) => {
        const at = y + 3 * LINE + 6 + i * (LINE - 1);
        if (at <= LOGICAL_H - 32) drawText(ctx, name, x + 6, at, { color: COLORS.dim, size: 10 });
      });
    }
    drawText(ctx, G.hint, x + 6, LOGICAL_H - 20, { color: COLORS.dim });
  }
}
