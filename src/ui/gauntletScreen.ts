import { draft, isWardenFloor, relicOffers, runPayout, wear, type BoonId, type Door, type Offer, type RelicId } from '../core/gauntlet';
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
/** Letters of ordinary text across the panel, and of small text. */
const WIDE = 29;
const SMALL = 36;

/**
 * The Gauntlet's own room: where a run is started, where what a warden left and what is on offer
 * after a floor are taken, and where the doors down are. It shows the frame the run is flown in,
 * how worn it is, and who is behind the door being looked at.
 */
export class GauntletScreen implements Screen {
  private list!: MenuList;
  private offers: Offer[] = [];
  private relics: RelicId[] = [];
  private asking = false;
  private clock = 0;
  /** The door whose floor is shown. */
  private shown = 0;

  constructor(private app: App) {
    this.open();
  }

  /** The list for wherever the run stands: nothing under way, a relic or a draft owed, or a floor waiting. */
  private open(): void {
    const run = this.app.run;
    this.asking = false;
    this.relics = run?.relicOwed ? relicOffers(run) : [];
    this.offers = run?.drafting && !run.relicOwed ? draft(run, this.app.deps.catalog) : [];
    const found = this.app.gauntletDoors();
    if (this.shown >= found.length) this.shown = 0;
    if (!run) {
      this.list = new MenuList([{ id: 'start', label: G.start, enabled: true }, { id: 'back', label: G.back, enabled: true }]);
    } else if (run.relicOwed) {
      this.list = new MenuList(this.relics.map((id) => ({ id: `relic-${id}`, label: G.relics[id].name, enabled: true })));
    } else if (run.drafting) {
      this.list = new MenuList(this.offers.map((offer, i) => ({ id: `offer-${i}`, label: this.offerName(offer), enabled: true })));
    } else {
      // A warden's floor has one way in; any other has two doors.
      const ways = found.length > 1 ? found.map((_, i) => ({ id: `door-${i}`, label: G.doors[i], enabled: true })) : [{ id: 'descend', label: G.descend, enabled: true }];
      this.list = new MenuList([...ways, { id: 'abandon', label: G.abandon, enabled: true }, { id: 'back', label: G.back, enabled: true }]);
      this.list.cursor = Math.min(this.shown, ways.length - 1);
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

  /** Looks at the other door, where there is one. */
  private look(): void {
    const doors = this.app.gauntletDoors().length;
    // Not while a relic is being chosen: no door is in view then, and the one looked at should not change unseen.
    if (doors < 2 || this.asking || this.app.run?.relicOwed) return;
    this.shown = (this.shown + 1) % doors;
    // While the doors are the list, the cursor goes with the eye.
    if (this.list.selected?.id.startsWith('door-')) this.list.cursor = this.shown;
  }

  onInput(action: InputAction): void {
    if (action === 'up' || action === 'down') {
      this.list.move(action === 'up' ? -1 : 1);
      const id = this.list.selected?.id ?? '';
      if (id.startsWith('door-')) this.shown = Number(id.slice(5));
    } else if (action === 'left' || action === 'right' || action === 'prev' || action === 'next') this.look();
    else if (action === 'cancel') {
      if (this.asking) this.open();
      // What is owed is not walked away from, but the game can be: the run waits in the save.
      else this.app.go('hub');
    } else if (action === 'confirm') this.choose(this.list.selected?.id ?? '');
  }

  private choose(id: string): void {
    if (this.asking) {
      if (id === 'yes') this.app.endGauntlet();
      return this.open();
    }
    if (id === 'start') { this.app.lastRun = null; this.app.startGauntlet(); this.shown = 0; return this.open(); }
    if (id === 'back') return this.app.go('hub');
    if (id === 'descend') return this.app.descendGauntlet(0);
    if (id.startsWith('door-')) return this.app.descendGauntlet(Number(id.slice(5)));
    if (id === 'abandon') {
      this.asking = true;
      this.list = new MenuList([{ id: 'no', label: G.no, enabled: true }, { id: 'yes', label: G.yes, enabled: true }]);
      return;
    }
    if (id.startsWith('relic-')) { this.app.takeRelic(id.slice(6) as RelicId); return this.open(); }
    const offer = this.offers[Number(id.slice(6))];
    if (offer) { this.app.takeDraft(offer); this.shown = 0; this.open(); }
  }

  /** The door being looked at. */
  private door(): Door | undefined {
    return this.app.gauntletDoors()[this.shown];
  }

  view(): ScreenView {
    const run = this.app.run;
    const found = this.app.gauntletDoors();
    const door = this.door();
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      gauntlet: {
        best: this.app.game?.gauntletBest ?? 0, floor: run?.floor ?? null, drafting: !!run?.drafting, asking: this.asking,
        offers: this.offers, boons: run?.boons ?? {}, build: run?.build ?? null, enemies: door?.enemies ?? [], warden: !!run && isWardenFloor(run.floor), ground: groundFor(door?.background ?? '')?.id ?? null,
        wear: run ? Math.round(wear(run, this.app.deps.catalog) * 100) : 0, last: this.app.lastRun,
        // The ways down, and which of them is being looked at.
        doors: found.map((d) => ({ enemies: d.enemies, ground: groundFor(d.background)?.id ?? null, elite: d.elite ? { at: d.elite.at, mark: d.elite.mark } : null })),
        shown: this.shown,
        relics: run?.relics ?? [], relicOwed: !!run?.relicOwed, relicOffers: this.relics, revived: !!run?.revived, pays: run ? runPayout(run) : 0,
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
    drawText(ctx, G.floorLabel(run.floor), x + 6, y, { size: 16, color: COLORS.accent });
    if (isWardenFloor(run.floor)) drawText(ctx, G.wardenLabel, x + w - 6, y + 4, { align: 'right', color: COLORS.danger });
    y += 20;
    drawText(ctx, G.armour(100 - Math.round(wear(run, catalog) * 100)), x + 6, y, { color: COLORS.armor });
    // The Spare Core has just been spent: said once, beside the armour it made whole.
    if (run.revived) drawText(ctx, G.revived, x + w - 6, y, { align: 'right', color: COLORS.heat, size: 10 });
    y += LINE;
    // The boons taken so far and the relics held, in short, on as few lines as they need: the list below them must not be pushed off the panel.
    const boons = Object.entries(run.boons).filter(([, count]) => count > 0).map(([id, count]) => `${G.boons[id as BoonId].short}${count > 1 ? ` x${count}` : ''}`);
    for (const line of wrap(boons.join('  '), SMALL).slice(0, 2)) {
      if (line) { drawText(ctx, line, x + 6, y, { color: COLORS.dim, size: 10 }); y += LINE - 2; }
    }
    for (const line of wrap((run.relics ?? []).map((id) => G.relics[id].short).join('  '), SMALL).slice(0, 2)) {
      if (line) { drawText(ctx, line, x + 6, y, { color: COLORS.accent, size: 10 }); y += LINE - 2; }
    }
    y += 4;
    if (this.asking) {
      drawText(ctx, G.abandonAsk(runPayout(run)), x + 6, y, { color: COLORS.heat });
      drawList(ctx, this.list, x + 6, y + LINE + 4, w - 16, 2);
      return;
    }
    if (run.relicOwed) {
      // What the warden left comes before anything else: two to choose from, and what the one under the cursor does.
      drawText(ctx, G.relicHeading, x + 6, y, { color: COLORS.heat });
      drawList(ctx, this.list, x + 6, y + LINE + 2, w - 16, 2);
      const relic = this.relics[this.list.cursor];
      if (relic) wrap(G.relics[relic].note, WIDE).slice(0, 4).forEach((line, i) => drawText(ctx, line, x + 6, y + 3 * LINE + 10 + i * LINE, { color: COLORS.dim }));
      drawText(ctx, G.hint, x + 6, LOGICAL_H - 20, { color: COLORS.dim });
      return;
    }
    // Who is behind the door being looked at and what its ground does: said while choosing what to take too, since that is what the choice is for.
    const found = this.app.gauntletDoors();
    const door = this.door();
    const two = found.length > 1;
    drawText(ctx, two ? G.doors[this.shown].toUpperCase() : G.expected, x + 6, y, { color: COLORS.dim });
    const ground = groundFor(door?.background ?? '');
    if (ground) drawText(ctx, STRINGS.ground[ground.id].name, x + w - 6, y, { align: 'right', color: COLORS.energy, size: 10 });
    (door?.enemies ?? []).forEach((id, i) => {
      drawText(ctx, this.app.enemies()[id]?.name ?? id, x + 6, y + (i + 1) * LINE);
      // The elite among them carries its mark.
      if (door?.elite?.at === i) drawText(ctx, STRINGS.tags.marks[door.elite.mark], x + w - 6, y + (i + 1) * LINE, { align: 'right', color: COLORS.danger, size: 10 });
    });
    if (run.drafting) {
      // Taking comes first here: the ground's rule is said again at the doors.
      y += 4 * LINE + 2;
      drawText(ctx, G.draftHeading, x + 6, y, { color: COLORS.heat });
      drawList(ctx, this.list, x + 6, y + LINE + 2, w - 16, this.offers.length);
      const offer = this.offers[this.list.cursor];
      const under = y + LINE + 2 + this.offers.length * LINE + 4;
      if (offer) this.offerNotes(offer).forEach((line, i) => drawText(ctx, line, x + 6, under + i * (LINE - 1), { color: COLORS.dim }));
    } else {
      // What that ground does, in full: a floor has no briefing to say it.
      if (ground) wrap(STRINGS.ground[ground.id].note, SMALL).slice(0, 2).forEach((line, i) => drawText(ctx, line, x + 6, y + 4 * LINE - 2 + i * (LINE - 2), { color: COLORS.energy, size: 10 }));
      y += 6 * LINE;
      const rows = this.list.items.length;
      drawList(ctx, this.list, x + 6, y, w - 16, rows);
      // Which door hides an elite is said on its row.
      found.forEach((d, i) => { if (two && d.elite) drawText(ctx, G.elite, x + w - 6, y + i * LINE, { align: 'right', color: COLORS.danger, size: 10 }); });
      // What the frame carries, under the list, as far as there is room above the hints.
      const carried = (['rightHand', 'leftHand', 'shoulder', 'module'] as const).flatMap((slot) => (run.build[slot] ? [this.partName(run.build[slot])] : []));
      carried.forEach((name, i) => {
        const at = y + rows * LINE + 6 + i * (LINE - 1);
        if (at <= LOGICAL_H - (two ? 42 : 32)) drawText(ctx, name, x + 6, at, { color: COLORS.dim, size: 10 });
      });
    }
    if (two) drawText(ctx, G.otherDoor, x + 6, LOGICAL_H - 30, { color: COLORS.dim });
    drawText(ctx, G.hint, x + 6, LOGICAL_H - 20, { color: COLORS.dim });
  }
}
