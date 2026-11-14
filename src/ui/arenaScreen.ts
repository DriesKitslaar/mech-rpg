import { arenaPurse, checkChallenge } from '../core/arena';
import { ARENA, ARENA_ENEMIES } from '../content/arena';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const A = STRINGS.arena;

/** The ladder: ten opponents, fought in order, each shown with their mech before the challenge. */
export class ArenaScreen implements Screen {
  private list: MenuList;
  private clock = 0;

  constructor(private app: App) {
    const game = app.game!;
    this.list = new MenuList(ARENA.map((o) => ({
      id: `rank-${o.rank}`, label: `${o.rank}. ${o.name}`, enabled: checkChallenge(game, o.rank) === null,
      note: String(arenaPurse(game, o)),
      // The cursor starts on the next opponent, or on the champion once the ladder is cleared.
    })), Math.min(game.arenaRank, ARENA.length - 1));
  }

  private get opponent() {
    return ARENA[this.list.cursor];
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.list.selected?.enabled) this.app.openArenaBriefing(this.opponent.rank);
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, arena: { rank: this.app.game!.arenaRank } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-arena', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    // The selected opponent's mech, facing left towards the list.
    const o = this.opponent;
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMech(ctx, mechSprites(sprites, ARENA_ENEMIES[o.enemy].build, ARENA_ENEMIES[o.enemy].paint), 0, 0, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));
    ctx.restore();

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, A.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, A.yourRank(game.arenaRank), LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    drawPanel(ctx, 4, 18, 150, 128);
    drawText(ctx, A.purse, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, ARENA.length);

    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    const state = o.rank <= game.arenaRank ? A.beaten : o.rank === game.arenaRank + 1 ? A.next : A.locked;
    drawText(ctx, o.name.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === A.locked ? COLORS.danger : state === A.next ? COLORS.armor : COLORS.dim });
    const text = game.arenaRank >= ARENA.length && o.rank === ARENA.length ? [A.champion] : wrap(o.style, charsFor(LOGICAL_W - 28));
    text.slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 207 + i * LINE));
    drawText(ctx, A.back, LOGICAL_W / 2, 253, { align: 'center', color: COLORS.dim });
  }
}
