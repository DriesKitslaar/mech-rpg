import { MAX_LEVEL, checkBuyPerk, levelFor, perkPoints, xpForLevel } from '../core/pilot';
import { PERKS } from '../content/perks';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { COLORS, LINE, charsFor, drawList, drawMeter, drawPanel, drawText, wrap } from './widgets';

const P = STRINGS.pilot;

/** The pilot's level and experience, and the perks that perk points buy. */
export class PilotScreen implements Screen {
  private list = new MenuList();

  constructor(private app: App) {
    this.refresh();
  }

  private refresh(): void {
    const game = this.app.game!;
    this.list.setItems(PERKS.map((perk) => ({
      id: perk.id, label: perk.name, enabled: checkBuyPerk(game, perk.id, PERKS) === null,
      note: `${game.perks[perk.id] ?? 0}/${perk.maxRank}`,
    })));
  }

  update(): void {}

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.list.selected?.enabled) {
      this.app.buyPerk(this.list.selected.id);
      this.refresh();
    }
  }

  view(): ScreenView {
    const game = this.app.game!;
    return {
      menu: { items: this.list.items, cursor: this.list.cursor },
      pilot: { level: levelFor(game.xp), points: perkPoints(game, PERKS) },
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
    drawList(ctx, this.list, 12, 80, LOGICAL_W - 36, PERKS.length);
    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    const perk = PERKS.find((p) => p.id === this.list.selected?.id);
    if (perk) {
      drawText(ctx, perk.name.toUpperCase(), 12, 190, { color: COLORS.accent });
      wrap(perk.description, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((text, i) => drawText(ctx, text, 12, 204 + i * LINE));
      const refusal = checkBuyPerk(game, perk.id, PERKS);
      if (refusal === 'maxed') drawText(ctx, P.maxed, 12, 240, { color: COLORS.dim });
      else if (refusal === 'noPoints') drawText(ctx, P.noPoints, 12, 240, { color: COLORS.dim });
    }
    drawText(ctx, P.hint, LOGICAL_W / 2, 253, { align: 'center', color: COLORS.dim });
  }
}
