import { ARENA_RANKS, CHAMPION_RANK, CUPS, arenaPurse, checkChallenge, cupOpen, cupPurse, cupWon, mirrorEnemy, mirrorOpen, mirrorPurse, shownRanks } from '../core/arena';
import { ARENA, ARENA_ENEMIES } from '../content/arena';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { idlePose } from './pose';
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
    // The numbers are written to one width, so that the names under each other begin under each other.
    const digits = String(this.shown).length;
    const items = [
      ...ARENA.slice(0, this.shown).map((o) => ({
        id: `rank-${o.rank}`, label: `${String(o.rank).padStart(digits)}. ${o.name}`, enabled: checkChallenge(game, o.rank) === null,
        note: String(arenaPurse(game, o)),
      })),
      { id: MIRROR, label: A.mirror.title, enabled: mirrorOpen(game), note: mirrorOpen(game) ? String(mirrorPurse(game)) : A.locked },
      // The three cups, under everything else: each opens to a pilot who has beaten its three on the ladder.
      ...CUPS.map((cup) => ({ id: cup.id, label: A.cups.names[cup.id], enabled: cupOpen(game, cup), note: cupOpen(game, cup) ? String(cupPurse(game, cup)) : A.locked })),
    ];
    // The cursor starts on the next opponent, or on the last one once there is nobody left to beat.
    const index = items.findIndex((item) => item.id === at);
    this.list = new MenuList(items, index >= 0 ? index : Math.min(game.arenaRank, this.shown - 1));
  }

  /** The opponent under the cursor; none while it is on the mirror match. */
  private get opponent() {
    return this.list.selected?.id.startsWith('rank-') ? ARENA[this.list.cursor] : undefined;
  }

  /** The cup under the cursor, if it is on one. */
  private get cup() {
    return CUPS.find((cup) => cup.id === this.list.selected?.id);
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
      else if (this.cup) this.app.openCupBriefing(this.cup.id);
      else this.app.openMirrorBriefing();
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, arena: { rank: this.app.game!.arenaRank, of: this.shown, cups: this.app.game!.cups ?? [] } };
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
    const cup = this.cup;
    // For a cup, the last of its three: the one the purse has to be taken from.
    const shown = o ? ARENA_ENEMIES[o.enemy] : cup ? ARENA_ENEMIES[ARENA[cup.ranks[2] - 1].enemy] : mirrorEnemy(game, A.mirror.name);
    const { fast } = this.app.deps;
    const calm = this.app.settings.calm === true;
    const clock = fast ? 0 : this.clock;
    drawRoom(ctx, 'bg-arena', clock, calm, fast);
    ctx.save();
    ctx.translate(LOGICAL_W + 6, 18);
    ctx.scale(-1, 1);
    drawMechShadow(ctx, 0, 0);
    drawMech(ctx, mechSprites(sprites, shown.build, shown.paint), 0, 0, { dx: 0, dy: 0 }, 0, fast ? {} : idlePose(this.clock));
    ctx.restore();
    drawRoomSpill(ctx, 'bg-arena', clock, calm);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, A.heading, 5, 1, { color: COLORS.accent });
    drawText(ctx, A.yourRank(game.arenaRank, this.shown), LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    drawPanel(ctx, 4, 18, 150, 128);
    drawText(ctx, A.purse, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, ROWS);

    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    const state = cup ? (!cupOpen(game, cup) ? A.locked : cupWon(game, cup) ? A.cups.won : A.cups.open)
      : !o ? (this.list.selected?.enabled ? A.next : A.locked)
      : o.rank <= game.arenaRank ? A.beaten : o.rank === game.arenaRank + 1 ? A.next : A.locked;
    drawText(ctx, (o ? o.name : cup ? A.cups.names[cup.id] : A.mirror.title).toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, state, LOGICAL_W - 12, 191, { align: 'right', color: state === A.locked ? COLORS.danger : state === A.next ? COLORS.armor : COLORS.dim });
    // The one at the top of what this pilot can see has a word for whoever has beaten them.
    const last = o && o.rank === game.arenaRank && (o.rank === CHAMPION_RANK || o.rank === ARENA_RANKS);
    const cupNames = cup ? cup.ranks.map((rank) => ARENA[rank - 1].name) : [];
    const words = cup ? (cupOpen(game, cup) ? A.cups.style(cupNames) : A.cups.locked(cupNames[2]))
      : !o ? (this.list.selected?.enabled ? A.mirror.style : A.mirror.locked)
      : last ? (o.rank === ARENA_RANKS ? A.apex : A.champion) : o.style;
    wrap(words, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 207 + i * LINE));
    drawText(ctx, A.back, LOGICAL_W / 2, 253, { align: 'center', color: COLORS.dim });
  }
}
