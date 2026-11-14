import { MEDAL_PAY, medalProgress, type Medal } from '../core/medals';
import { MAX_LEVEL, checkBuyPerk, levelFor, perkPoints, xpForLevel } from '../core/pilot';
import { MEDALS } from '../content/medals';
import { PERKS } from '../content/perks';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { RECORD_ROWS, rankTally, recordLines } from './record';
import { COLORS, LINE, MEDAL_COLORS, charsFor, drawList, drawMedal, drawMeter, drawPanel, drawTabs, drawText, wrap } from './widgets';

const P = STRINGS.pilot;
const M = STRINGS.medals;
export type PilotPage = 'perks' | 'medals' | 'record';
const PAGES: PilotPage[] = ['perks', 'medals', 'record'];
/** Medals listed at a time. */
const MEDAL_ROWS = 13;

/** The pilot: level and perks, the medals earned and still to earn, and the record of what they have done. */
export class PilotScreen implements Screen {
  private page: PilotPage = 'perks';
  private perks = new MenuList();
  private medals = new MenuList();

  constructor(private app: App) {
    this.refresh();
  }

  private refresh(): void {
    const game = this.app.game!;
    this.perks.setItems(PERKS.map((perk) => ({
      id: perk.id, label: perk.name, enabled: checkBuyPerk(game, perk.id, PERKS) === null,
      note: `${game.perks[perk.id] ?? 0}/${perk.maxRank}`,
    })));
    this.medals.setItems(MEDALS.map((medal) => {
      const { have, need, earned } = medalProgress(medal, game);
      return {
        id: medal.id, label: this.nameOf(medal), enabled: earned,
        // Earned, or how far along; a medal that is simply done or not says nothing until it is.
        note: earned ? M.held : need > 1 ? `${have}/${need}` : undefined,
      };
    }));
  }

  private isHidden(medal: Medal): boolean {
    return !!medal.secret && !this.app.game!.medals.includes(medal.id);
  }

  private nameOf(medal: Medal): string {
    return this.isHidden(medal) ? M.secretName : medal.name;
  }

  /** The medal under the cursor: its name, what it takes, and whether it is held or what it will pay. */
  private detail(): { title: string; lines: string[]; status: string } | null {
    const medal = MEDALS.find((m) => m.id === this.medals.selected?.id);
    if (!medal) return null;
    const earned = this.app.game!.medals.includes(medal.id);
    return {
      title: this.nameOf(medal),
      lines: wrap(this.isHidden(medal) ? M.secretText : medal.text, charsFor(LOGICAL_W - 60)),
      status: earned ? M.held : M.pays(MEDAL_PAY[medal.tier]),
    };
  }

  private get list(): MenuList | null {
    return this.page === 'perks' ? this.perks : this.page === 'medals' ? this.medals : null;
  }

  private turn(by: number): void {
    this.page = PAGES[(PAGES.indexOf(this.page) + by + PAGES.length) % PAGES.length];
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list?.move(-1);
    else if (action === 'down') this.list?.move(1);
    else if (action === 'next' || action === 'right') this.turn(1);
    else if (action === 'prev' || action === 'left') this.turn(-1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.page === 'perks' && this.perks.selected?.enabled) {
      this.app.buyPerk(this.perks.selected.id);
      this.refresh();
    }
  }

  view(): ScreenView {
    const game = this.app.game!;
    return {
      menu: { items: this.list?.items ?? [], cursor: this.list?.cursor ?? 0 },
      page: this.page,
      pilot: { level: levelFor(game.xp), points: perkPoints(game, PERKS) },
      medalCount: { earned: MEDALS.filter((m) => game.medals.includes(m.id)).length, of: MEDALS.length },
      ...(this.page === 'medals' ? { detail: this.detail() } : {}),
      ...(this.page === 'record' ? { record: recordLines(game, MEDALS.length) } : {}),
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const bg = this.app.deps.sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, P.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, game.callsign, 36, 1);
    drawTabs(ctx, LOGICAL_W - 5, 1, PAGES.map((page) => P.pages[page]), PAGES.indexOf(this.page));

    if (this.page === 'perks') this.drawPerks(ctx);
    else if (this.page === 'medals') this.drawMedals(ctx);
    else this.drawRecord(ctx);
    drawText(ctx, this.page === 'perks' ? P.hint : P.pageHint, LOGICAL_W / 2, 255, { align: 'center', color: COLORS.dim });
  }

  private drawPerks(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    // Level and progress towards the next one.
    const level = levelFor(game.xp);
    const points = perkPoints(game, PERKS);
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 50);
    drawText(ctx, P.level, 12, 24, { color: COLORS.dim });
    drawText(ctx, String(level), 12, 34, { size: 24, color: COLORS.accent });
    drawText(ctx, P.points, LOGICAL_W - 12, 24, { align: 'right', color: COLORS.dim });
    drawText(ctx, String(points), LOGICAL_W - 12, 34, { size: 24, align: 'right', color: points > 0 ? COLORS.armor : COLORS.dim });
    if (level < MAX_LEVEL) {
      const floor = xpForLevel(level);
      const ceiling = xpForLevel(level + 1);
      drawText(ctx, `${P.xp} ${game.xp} / ${ceiling}`, LOGICAL_W / 2, 26, { align: 'center' });
      drawMeter(ctx, 70, 42, LOGICAL_W - 140, 6, game.xp - floor, ceiling - floor, COLORS.energy);
      drawText(ctx, P.next, LOGICAL_W / 2, 51, { align: 'center', color: COLORS.dim, size: 10 });
    } else {
      drawText(ctx, P.maxLevel, LOGICAL_W / 2, 36, { align: 'center', color: COLORS.armor });
    }

    // Perks, and what the selected one does.
    drawPanel(ctx, 4, 72, LOGICAL_W - 8, 108);
    drawList(ctx, this.perks, 12, 80, LOGICAL_W - 36, PERKS.length);
    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 68);
    const perk = PERKS.find((p) => p.id === this.perks.selected?.id);
    if (perk) {
      drawText(ctx, perk.name.toUpperCase(), 12, 190, { color: COLORS.accent });
      wrap(perk.description, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((text, i) => drawText(ctx, text, 12, 204 + i * LINE));
      const refusal = checkBuyPerk(game, perk.id, PERKS);
      if (refusal === 'maxed') drawText(ctx, P.maxed, 12, 238, { color: COLORS.dim });
      else if (refusal === 'noPoints') drawText(ctx, P.noPoints, 12, 238, { color: COLORS.dim });
    }
  }

  private drawMedals(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const earned = MEDALS.filter((m) => game.medals.includes(m.id));
    // How many are held, and how many of each metal.
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, 18);
    drawText(ctx, `${M.heading} ${earned.length}/${MEDALS.length}`, 12, 21, { color: COLORS.accent });
    ([3, 2, 1] as const).forEach((tier, i) => {
      const x = LOGICAL_W - 46 - i * 40;
      drawMedal(ctx, x, 22, tier, true);
      drawText(ctx, `${earned.filter((m) => m.tier === tier).length}/${MEDALS.filter((m) => m.tier === tier).length}`, x + 12, 21, { color: MEDAL_COLORS[tier] });
    });

    drawPanel(ctx, 4, 40, LOGICAL_W - 8, MEDAL_ROWS * LINE + 10);
    const { items, offset } = this.medals.visible(MEDAL_ROWS);
    items.forEach((item, i) => {
      const y = 45 + i * LINE;
      const selected = offset + i === this.medals.cursor;
      const medal = MEDALS[offset + i];
      if (selected) drawText(ctx, '>', 10, y, { color: COLORS.accent });
      drawMedal(ctx, 18, y + 1, medal.tier, item.enabled);
      drawText(ctx, item.label, 32, y, { color: selected ? COLORS.accent : item.enabled ? COLORS.text : COLORS.dim });
      if (item.note) drawText(ctx, item.note, LOGICAL_W - 22, y, { align: 'right', color: item.enabled ? COLORS.armor : COLORS.dim });
    });
    if (offset > 0) drawText(ctx, '^', LOGICAL_W - 16, 45, { color: COLORS.dim });
    if (offset + MEDAL_ROWS < this.medals.items.length) drawText(ctx, 'v', LOGICAL_W - 16, 45 + (MEDAL_ROWS - 1) * LINE, { color: COLORS.dim });

    // The one under the cursor: what it takes, and what it pays or that it is held.
    drawPanel(ctx, 4, 197, LOGICAL_W - 8, 55);
    const detail = this.detail();
    const medal = MEDALS.find((m) => m.id === this.medals.selected?.id);
    if (detail && medal) {
      const held = game.medals.includes(medal.id);
      drawMedal(ctx, 12, 203, medal.tier, held);
      drawText(ctx, detail.title.toUpperCase(), 26, 202, { color: COLORS.accent });
      detail.lines.slice(0, 2).forEach((text, i) => drawText(ctx, text, 26, 215 + i * LINE));
      drawText(ctx, detail.status, LOGICAL_W - 12, 238, { align: 'right', color: held ? COLORS.armor : COLORS.dim });
    }
  }

  private drawRecord(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const lines = recordLines(game, MEDALS.length);
    drawPanel(ctx, 4, 18, LOGICAL_W - 8, RECORD_ROWS * LINE + 12);
    const columnW = (LOGICAL_W - 8 - 24) / 2;
    lines.forEach((line, i) => {
      const x = 12 + Math.floor(i / RECORD_ROWS) * (columnW + 8);
      const y = 24 + (i % RECORD_ROWS) * LINE;
      drawText(ctx, line.label, x, y, { color: COLORS.dim });
      drawText(ctx, line.value, x + columnW, y, { align: 'right' });
    });

    // The ranks held, best first, as one row of counts.
    const top = 18 + RECORD_ROWS * LINE + 16;
    drawPanel(ctx, 4, top, LOGICAL_W - 8, 40);
    drawText(ctx, STRINGS.record.ranksHeld, 12, top + 5, { color: COLORS.dim });
    rankTally(game).forEach(([rank, count], i) => {
      const x = 12 + i * 58;
      drawText(ctx, rank, x, top + 17, { size: 16, color: count > 0 ? COLORS.accent : COLORS.dim });
      drawText(ctx, String(count), x + 14, top + 20, { color: count > 0 ? COLORS.text : COLORS.dim });
    });
  }
}
