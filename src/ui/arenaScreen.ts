import { ARCHETYPES, type Archetype } from '../core/archetype';
import { ARENA_RANKS, CHAMPION_RANK, CUPS, arenaPurse, checkChallenge, cupOpen, cupPurse, cupWon, mirrorEnemy, mirrorOpen, mirrorPurse, shownRanks } from '../core/arena';
import { crownHeld, crownsHeld, masterBeaten, masterId, masterPurse, mastersOpen, parseMaster } from '../core/masters';
import { SEAT_ID, seatHeld, seatOpen, seatPurse } from '../core/seat';
import { ARENA, ARENA_ENEMIES } from '../content/arena';
import { MASTER_ENEMIES, masterOf } from '../content/masters';
import { KEEPER, SEAT_ENEMIES } from '../content/seat';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { idlePose } from './pose';
import { COLORS, LINE, charsFor, drawList, drawPanel, drawTabs, drawText, wrap } from './widgets';

const A = STRINGS.arena;
const M = A.masters;
const S = A.seat;
const C = STRINGS.classes;

/** The entry of the list that is the mirror match. No opponent has this id. */
export const MIRROR = 'mirror';
/** Rows of the list shown at a time. */
const ROWS = 10;
/** The arena's pages: the ladder with the mirror match and the cups under it, and the masters who stand apart from it. */
export type ArenaPage = 'ladder' | 'masters';
const PAGES: ArenaPage[] = ['ladder', 'masters'];
/** How it stands between the pilot and a master. */
export type MasterState = 'locked' | 'open' | 'beaten' | 'crown';
/** How it stands between the pilot and the keeper of the eighth seat: not every crown held yet, the challenge open, or the seat the pilot's. */
export type SeatState = 'locked' | 'open' | 'held';

/**
 * The arena. Its first page is the ladder: ten opponents, fought in order, each shown with their
 * mech before the challenge; a champion also sees the five of the back room, and under them all are
 * the mirror match and the cups. Its second is the masters: one of each class, who take challenges
 * from the champion, and under them the eighth seat, whose keeper takes one from the holder of
 * every crown.
 */
export class ArenaScreen implements Screen {
  private page: ArenaPage;
  private ladder: MenuList;
  private masters: MenuList;
  private clock = 0;
  /** How many ranks this pilot is shown. */
  private shown: number;

  /** `at` puts the cursor on that entry, for returning from its briefing: a rank, the mirror match, a cup, or a master's duel by its id. */
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
    this.ladder = new MenuList(items, index >= 0 ? index : Math.min(game.arenaRank, this.shown - 1));
    // The masters, by their class: what the duel pays, or that the crown is the pilot's already.
    const open = mastersOpen(game);
    const fought = at ? parseMaster(at) : null;
    // Under them the seat that is no class's: how many of the crowns it asks for are held, then what its duel pays, then that it is the pilot's.
    const seat = {
      id: SEAT_ID, label: S.row, enabled: seatOpen(game),
      note: seatHeld(game) ? S.held : seatOpen(game) ? String(seatPurse(game)) : S.count(crownsHeld(game), ARCHETYPES.length),
    };
    this.masters = new MenuList([...ARCHETYPES.map((kind) => ({
      id: masterId(kind), label: C.names[kind], enabled: open,
      note: !open ? A.locked : crownHeld(game, kind) ? M.crowned : String(masterPurse(game, kind)),
    })), seat], at === SEAT_ID ? ARCHETYPES.length : fought ? ARCHETYPES.indexOf(fought) : 0);
    this.page = fought || at === SEAT_ID ? 'masters' : 'ladder';
  }

  private get list(): MenuList {
    return this.page === 'ladder' ? this.ladder : this.masters;
  }

  /** The opponent under the cursor; none while it is on the mirror match or a cup, or on the masters' page. */
  private get opponent() {
    return this.page === 'ladder' && this.ladder.selected?.id.startsWith('rank-') ? ARENA[this.ladder.cursor] : undefined;
  }

  /** The cup under the cursor, if it is on one. */
  private get cup() {
    return this.page === 'ladder' ? CUPS.find((cup) => cup.id === this.ladder.selected?.id) : undefined;
  }

  /** The class whose master is under the cursor, on the masters' page; none while it is on the eighth seat. */
  private get master(): Archetype | null {
    return this.page === 'masters' ? ARCHETYPES[this.masters.cursor] ?? null : null;
  }

  /** True while the cursor is on the eighth seat. */
  private get onSeat(): boolean {
    return this.page === 'masters' && this.masters.selected?.id === SEAT_ID;
  }

  /** How it stands with the seat's keeper. */
  private get seatState(): SeatState {
    const game = this.app.game!;
    return seatHeld(game) ? 'held' : seatOpen(game) ? 'open' : 'locked';
  }

  /** How it stands with the master of a class: not open to this pilot yet, open, beaten in another machine, or the crown held. */
  private stateOf(kind: Archetype): MasterState {
    const game = this.app.game!;
    return !mastersOpen(game) ? 'locked' : crownHeld(game, kind) ? 'crown' : masterBeaten(game, kind) ? 'beaten' : 'open';
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.app.go('hub');
    else if (action === 'prev' || action === 'next') {
      this.page = PAGES[(PAGES.indexOf(this.page) + (action === 'next' ? 1 : -1) + PAGES.length) % PAGES.length];
    } else if (action === 'confirm' && this.list.selected?.enabled) {
      if (this.onSeat) this.app.openSeatBriefing();
      else if (this.master) this.app.openMasterBriefing(this.master);
      else if (this.opponent) this.app.openArenaBriefing(this.opponent.rank);
      else if (this.cup) this.app.openCupBriefing(this.cup.id);
      else this.app.openMirrorBriefing();
    }
  }

  view(): ScreenView {
    const game = this.app.game!;
    const master = this.master;
    return {
      menu: { items: this.list.items, cursor: this.list.cursor }, arena: { rank: game.arenaRank, of: this.shown, cups: game.cups ?? [] }, page: this.page,
      // On the masters' page: whose master is under the cursor, and how it stands with them.
      master: master ? { kind: master, state: this.stateOf(master) } : null,
      // On the eighth seat: how it stands with its keeper, and how many crowns the pilot holds of those it asks for.
      seat: this.onSeat ? { state: this.seatState, crowns: crownsHeld(game) } : null,
    };
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
    const master = this.master;
    // For a cup, the last of its three: the one the purse has to be taken from.
    const shown = this.onSeat ? SEAT_ENEMIES[SEAT_ID] : master ? MASTER_ENEMIES[masterId(master)] : o ? ARENA_ENEMIES[o.enemy] : cup ? ARENA_ENEMIES[ARENA[cup.ranks[2] - 1].enemy] : mirrorEnemy(game, A.mirror.name);
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
    drawTabs(ctx, LOGICAL_W - 5, 1, PAGES.map((page) => A.pages[page]), PAGES.indexOf(this.page));

    // The list, with what the page counts above it: the pilot's rank on the ladder, or the crowns held.
    drawPanel(ctx, 4, 18, 150, 128);
    drawText(ctx, this.page === 'masters' ? M.crowns(crownsHeld(game), ARCHETYPES.length) : A.yourRank(game.arenaRank, this.shown), 10, 22, { color: COLORS.dim, size: 10 });
    drawText(ctx, A.purse, 146, 22, { align: 'right', color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, 10, 32, 134, ROWS);

    drawPanel(ctx, 4, 184, LOGICAL_W - 8, 82);
    if (this.onSeat) this.drawSeat(ctx);
    else if (master) this.drawMaster(ctx, master);
    else {
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
    }
    // A is offered where the row in hand takes a challenge, and nowhere else.
    drawText(ctx, this.list.selected?.enabled ? A.back : A.backLocked, LOGICAL_W / 2, 253, { align: 'center', color: COLORS.dim });
  }

  /**
   * The master of a class: their name, how it stands with them, what they are the master of, and how they
   * fight. While the masters are not open to this pilot, whom they take challenges from stands where the
   * line about their fighting would.
   */
  private drawMaster(ctx: CanvasRenderingContext2D, kind: Archetype): void {
    const master = masterOf(kind);
    const state = this.stateOf(kind);
    const word = { locked: A.locked, open: M.open, beaten: A.beaten, crown: M.crowned }[state];
    const color = { locked: COLORS.danger, open: COLORS.armor, beaten: COLORS.dim, crown: COLORS.accent }[state];
    drawText(ctx, master.name.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, word, LOGICAL_W - 12, 191, { align: 'right', color });
    drawText(ctx, M.titles[kind].toUpperCase(), 12, 207, { color: COLORS.armor });
    wrap(state === 'locked' ? M.locked : master.style, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 207 + (i + 1) * LINE));
  }

  /**
   * The keeper of the eighth seat, as a master is shown: their name, how it stands with them, what they
   * keep, and how they fight. Until every crown is the pilot's, whom they take a challenge from stands
   * where the line about their fighting would.
   */
  private drawSeat(ctx: CanvasRenderingContext2D): void {
    const state = this.seatState;
    const word = { locked: A.locked, open: M.open, held: S.held }[state];
    const color = { locked: COLORS.danger, open: COLORS.armor, held: COLORS.accent }[state];
    drawText(ctx, KEEPER.name.toUpperCase(), 12, 189, { size: 16, color: COLORS.accent });
    drawText(ctx, word, LOGICAL_W - 12, 191, { align: 'right', color });
    drawText(ctx, S.title.toUpperCase(), 12, 207, { color: COLORS.armor });
    wrap(state === 'locked' ? S.locked : KEEPER.style, charsFor(LOGICAL_W - 28)).slice(0, 3).forEach((row, i) => drawText(ctx, row, 12, 207 + (i + 1) * LINE));
  }
}
