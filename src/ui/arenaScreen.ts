import { ARENA_RANKS, CHAMPION_RANK, arenaPurse, checkChallenge, mirrorEnemy, mirrorOpen, mirrorPurse, shownRanks } from '../core/arena';
import { ARENA, ARENA_ENEMIES } from '../content/arena';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawText, wrap } from './widgets';

const A = STRINGS.arena;

/** The entry of the list that is the mirror match. No opponent has this id. */
export const MIRROR = 'mirror';
/** Rows of the list shown at a time. */
const ROWS = 10;

/**
 * The ladder: ten opponents, fought in order, each shown with their mech before the challenge. A
 * champion also sees the five of the back room. Under them all is the mirror match.
 */
export class ArenaScreen implements Screen {
  private list: MenuList;
  private clock = 0;
  /** How many ranks this pilot is shown. */
  private shown: number;

  /** `at` puts the cursor on that entry, for returning from its briefing. */
  constructor(private app: App, at?: string) {
    const game = app.game!;
    this.shown = shownRanks(game);
    const items = [
      ...ARENA.slice(0, this.shown).map((o) => ({
        id: `rank-${o.rank}`, label: `${o.rank}. ${o.name}`, enabled: checkChallenge(game, o.rank) === null,
        note: String(arenaPurse(game, o)),
      })),
      { id: MIRROR, label: A.mirror.title, enabled: mirrorOpen(game), note: mirrorOpen(game) ? String(mirrorPurse(game)) : A.locked },
    ];
    // The cursor starts on the next opponent, or on the last one once there is nobody left to beat.
    const index = items.findIndex((item) => item.id === at);
    this.list = new MenuList(items, index >= 0 ? index : Math.min(game.arenaRank, this.shown - 1));
  }

  /** The opponent under the cursor; none while it is on the mirror match. */
  private get opponent() {
    return this.list.selected?.id === MIRROR ? undefined : ARENA[this.list.cursor];
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'confirm' && this.list.selected?.enabled) {
      if (this.opponent) this.app.openArenaBriefing(this.opponent.rank);
      else this.app.openMirrorBriefing();
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, arena: { rank: this.app.game!.arenaRank, of: this.shown } };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-arena', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    // The selected opponent's mech, facing left towards the list. For the mirror match, the pilot's own in the house paint.
    const o = this.opponent;
    const shown = o ? ARENA_ENEMIES[o.enemy] : mirrorEnemy(game, A.mirror.name);
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMech(ctx, mechSprites(sprites, shown.build, shown.paint), 0, 0, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));
    ctx.restore();

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, A.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, A.yourRank(game.arenaRank, this.shown), LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    drawPanel(ctx, 4, 18, 150, 128);
    drawText(ctx, A.purse, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, ROWS);

    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    const state = !o ? (this.list.selected?.enabled ? A.next : A.locked)
      : o.rank <= game.arenaRank ? A.beaten : o.rank === game.arenaRank + 1 ? A.next : A.locked;
    drawText(ctx, (o ? o.name : A.mirror.title).toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === A.locked ? COLORS.danger : state === A.next ? COLORS.armor : COLORS.dim });
    // The one at the top of what this pilot can see has a word for whoever has beaten them.
    const last = o && o.rank === game.arenaRank && (o.rank === CHAMPION_RANK || o.rank === ARENA_RANKS);
    const words = !o ? (this.list.selected?.enabled ? A.mirror.style : A.mirror.locked)
      : last ? (o.rank === ARENA_RANKS ? A.apex : A.champion) : o.style;
    wrap(words, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 207 + i * LINE));
    drawText(ctx, A.back, LOGICAL_W / 2, 253, { align: 'center', color: COLORS.dim });
  }
}
