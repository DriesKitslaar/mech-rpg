import { isSwarm } from '../core/board';
import { campaignComplete, type Mission } from '../core/campaign';
import type { GameState } from '../core/game';
import { isGrudge } from '../core/grudge';
import { isJob } from '../core/jobs';
import { levelFor, perkPoints } from '../core/pilot';
import { drillOpen, drillPassed } from '../core/training';
import { DRILLS } from '../content/drills';
import { MISSIONS } from '../content/missions';
import { PERKS } from '../content/perks';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { drawMechShadow, drawRoom, drawRoomSpill } from './room';
import { idlePose } from './pose';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

const H = STRINGS.hub;
const ROWS = 11;
/** The entry of the contract list that opens the archive. No contract has this id. */
export const ARCHIVE = 'archive';
/** The letters the line under the list of contracts may have: the width of the list's panel, in small letters. */
export const KIND_CHARS = 39;

/** The kinds of row the list of contracts tells apart, each with a line of its own under the list. */
export type RowKind = 'story' | 'choice' | 'verdict' | 'side' | 'open' | 'asks' | 'job' | 'account' | 'swarm' | 'patrol' | 'lent';
/**
 * Which kind a contract on the list is. `lent`: the pilot's own mech cannot deploy, and the list is the
 * patrol alone, flown in a lent one. The open board's own contracts come and go with every win; the job, the
 * notice of an account and the swarm stand beside them and are each their own kind.
 */
export function kindOf(mission: Pick<Mission, 'id' | 'phase' | 'asks'>, lent: boolean): RowKind {
  if (lent) return 'lent';
  if (isGrudge(mission)) return 'account';
  if (isSwarm(mission)) return 'swarm';
  if (isJob(mission)) return 'job';
  if (mission.id.startsWith('open-')) return mission.asks ? 'asks' : 'open';
  if (mission.phase === 'patrol') return 'patrol';
  if (mission.phase === 'side' || mission.phase === 'choice' || mission.phase === 'verdict') return mission.phase;
  return 'story';
}

/** What a row of the list ends in when its contract is new to a pilot who has told the story before. */
export const UNFLOWN_MARK = '*';
/**
 * Whether a contract on the list is new to this pilot in a later telling: a contract of the story, or
 * one beside it, that has left no rank in any telling (a rank is kept through them all). In a first
 * telling everything is new and nothing is marked; a contract that decides something keeps its own
 * line under the list, which says what it decides.
 */
export function isUnflown(game: Pick<GameState, 'cycle' | 'ranks'>, mission: Pick<Mission, 'id'>, kind: RowKind): boolean {
  return game.cycle > 0 && (kind === 'story' || kind === 'side') && !Object.hasOwn(game.ranks, mission.id);
}

/** The place between contracts: shows the pilot's standing and leads to everything else. */
/** The title of the contract that ends the introductions, after which the arena and open contracts are offered. */
const lastIntroduction = (): string => MISSIONS.filter((m) => m.phase === 'intro').at(-1)?.title ?? '';

export class HubScreen implements Screen {
  private main: MenuList;
  /** The contract list, the archive or the new-cycle question, while one is open. */
  private sub: MenuList | null = null;
  private asking = false;
  /** The cycle that starting over would begin. */
  private get nextCycle(): number {
    return (this.app.game?.cycle ?? 0) + 1;
  }
  /** True while the list showing is the archive of contracts already done. */
  private inArchive = false;
  /** What kind each contract on the list is, by its id. */
  private kinds = new Map<string, RowKind>();
  /** The contracts on the list that are new to a pilot who has told the story before, by their id. */
  private unflown = new Set<string>();
  private clock = 0;

  /** `list` opens with that list showing, and the cursor on the entry `at`, for returning from a briefing. */
  constructor(private app: App, list?: 'contracts' | 'archive', at?: string) {
    const errors = app.buildErrors();
    const unread = app.unreadCount();
    const points = perkPoints(app.game!, PERKS);
    const sideWork = app.sideWorkOpen();
    const drills = DRILLS.filter((drill) => drillOpen(app.game!, drill, MISSIONS) && !drillPassed(app.game!, drill.id)).length;
    this.main = new MenuList([
      // Open even when the mech cannot deploy: the patrol is then flown in a lent one. The note says what is wrong.
      { id: 'contracts', label: H.contractsItem, enabled: true, note: errors[0] ? STRINGS.buildErrors[errors[0]] : undefined },
      // Until the arena opens, the entry says what opens it: the last of the introductory contracts.
      { id: 'arena', label: H.arena, enabled: sideWork && errors.length === 0, note: sideWork ? undefined : H.opensAfter(lastIntroduction()) },
      // Drills that are open and have not been passed are said beside it, as unread messages are beside theirs.
      { id: 'training', label: H.training, enabled: true, note: drills > 0 ? H.drills(drills) : undefined },
      // A run is flown in a stock frame, so it is open whatever state the pilot's own mech is in.
      { id: 'gauntlet', label: STRINGS.gauntlet.item, enabled: sideWork, note: sideWork ? undefined : H.opensAfter(lastIntroduction()) },
      { id: 'garage', label: H.garage, enabled: true },
      { id: 'shop', label: H.shop, enabled: true },
      { id: 'pilot', label: H.pilot, enabled: true, note: points > 0 ? H.points(points) : undefined },
      { id: 'messages', label: H.messages, enabled: true, note: unread > 0 ? H.unread(unread) : undefined },
      { id: 'database', label: H.database, enabled: true },
      { id: 'options', label: H.options, enabled: true },
      ...(app.canStartCycle() ? [{ id: 'cycle', label: H.cycle, enabled: true }] : []),
      // With a build that may not deploy the cursor starts on the garage, where that is fixed.
    ], errors.length === 0 ? 0 : 4);
    if (list) {
      this.openContracts();
      if (list === 'archive' && this.app.archive().length > 0) this.openArchive();
      const index = this.sub!.items.findIndex((item) => item.id === at);
      if (index >= 0) this.sub!.cursor = index;
    }
  }

  /** The contracts on offer, and under them the way into the archive once there is something in it. */
  private openContracts(): void {
    this.asking = false;
    this.inArchive = false;
    // The archive is flown in the pilot's own mech: it is not offered while that cannot deploy.
    const done = this.app.buildErrors().length === 0 ? this.app.archive().length : 0;
    const missions = this.app.missions();
    // The patrol heads the list, but the cursor starts on the next contract of the story: the same
    // button pressed again and again should lead on, not round and round the patrol, and not into a
    // bounty either: side work is chosen, never fallen into.
    const story = missions.findIndex((m) => m.phase !== 'patrol' && m.phase !== 'side');
    const lent = this.app.buildErrors().length > 0;
    this.kinds = new Map(missions.map((m) => [m.id, kindOf(m, lent)]));
    // In a later telling most of the list has been flown before: what has not is marked, so that it is found.
    this.unflown = new Set(missions.filter((m) => isUnflown(this.app.game!, m, this.kinds.get(m.id)!)).map((m) => m.id));
    // With no story on offer (it is told, or waits on something), the cursor rests on the open board, where the
    // work is: its first contract, the single fight. The patrol is what is left when there is neither.
    const board = missions.findIndex((m) => ['open', 'asks'].includes(this.kinds.get(m.id)!));
    this.sub = new MenuList([
      // A contract that asks for a class pays more to a pilot who wins it as one: a plus after what it pays.
      ...missions.map((m) => ({ id: m.id, label: this.unflown.has(m.id) ? `${m.title} ${UNFLOWN_MARK}` : m.title, enabled: true, note: m.asks ? `${m.reward}+` : String(m.reward) })),
      ...(done > 0 ? [{ id: ARCHIVE, label: H.archive, enabled: true, note: String(done) }] : []),
    ], Math.max(0, story >= 0 ? story : board));
  }

  /** What the row in hand is, for under the list, while the contracts or the archive are showing. */
  private get row(): string | null {
    if (!this.sub || this.asking) return null;
    if (this.inArchive) return H.kinds.replay;
    const id = this.list.selected?.id;
    if (id === ARCHIVE) return H.kinds.archive;
    if (id !== undefined && this.unflown.has(id)) return H.kinds.unflown;
    const kind = id === undefined ? undefined : this.kinds.get(id);
    return kind ? H.kinds[kind] : null;
  }

  /** The contracts already done, each with the best rank earned on it. */
  private openArchive(): void {
    const ranks = this.app.game!.ranks;
    this.inArchive = true;
    this.sub = new MenuList(this.app.archive().map((m) => ({
      id: m.id, label: m.title, enabled: true, note: Object.hasOwn(ranks, m.id) ? ranks[m.id] : H.noRank,
    })));
  }

  private get list(): MenuList {
    return this.sub ?? this.main;
  }

  /** One step back: from the archive to the contracts, from anything else to the main menu. */
  private closeSub(): void {
    if (this.inArchive) return this.openContracts();
    this.sub = null;
    this.asking = false;
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.closeSub();
    else if (action === 'confirm' && this.list.selected?.enabled) {
      const id = this.list.selected.id;
      if (this.asking) {
        if (id === 'yes') this.app.startCycle();
        else this.closeSub();
      } else if (this.inArchive) this.app.openBriefing(id, true);
      else if (this.sub && id === ARCHIVE) this.openArchive();
      else if (this.sub) this.app.openBriefing(id);
      else if (id === 'contracts') this.openContracts();
      else if (id === 'cycle') {
        this.asking = true;
        this.sub = new MenuList([{ id: 'no', label: H.no, enabled: true }, { id: 'yes', label: H.yes, enabled: true }]);
      } else this.app.go(id as 'arena' | 'training' | 'gauntlet' | 'garage' | 'shop' | 'pilot' | 'messages' | 'database' | 'options');
    }
  }

  view(): ScreenView {
    const message = this.app.saveFailed ? STRINGS.saveFailed : this.asking ? H.cycleQuestion(this.nextCycle)[0] : '';
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message, list: this.inArchive ? 'archive' : this.sub && !this.asking ? 'contracts' : 'main', row: this.row };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    // The hangar is lit and somebody is at work in it; the mech stands in that light, on its own shadow.
    const { fast } = this.app.deps;
    const calm = this.app.settings.calm === true;
    const clock = fast ? 0 : this.clock;
    drawRoom(ctx, 'bg-garage', clock, calm, fast);
    drawMechShadow(ctx, -8, 78);
    drawMech(ctx, mechSprites(sprites, game.build, game.paint), -8, 78, { dx: 0, dy: 0 }, 0, fast ? {} : idlePose(this.clock));
    drawRoomSpill(ctx, 'bg-garage', clock, calm);

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, H.heading, 5, 1, { color: COLORS.accent });
    if (this.app.saveFailed) drawText(ctx, STRINGS.saveFailed, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.danger });
    else if (game.cycle > 0) drawText(ctx, H.cycleLabel(game.cycle), LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });

    const x = 150;
    const w = LOGICAL_W - x - 4;
    drawPanel(ctx, x, 20, w, 52);
    drawText(ctx, H.credits, x + 6, 25, { color: COLORS.dim });
    drawText(ctx, String(game.credits), x + w - 6, 23, { size: 16, align: 'right', color: game.credits < 0 ? COLORS.danger : COLORS.text });
    // The pilot, by callsign.
    drawText(ctx, game.callsign, x + 6, 41, { color: COLORS.armor });
    drawText(ctx, H.level(levelFor(game.xp)), x + w - 6, 41, { align: 'right' });
    drawText(ctx, H.battlesWon, x + 6, 53, { color: COLORS.dim });
    drawText(ctx, String(game.battlesWon), x + w - 6, 53, { align: 'right' });

    drawPanel(ctx, x, 78, w, 24 + ROWS * LINE);
    if (this.asking) {
      const question = H.cycleQuestion(this.nextCycle);
      question.forEach((row, i) => drawText(ctx, row, x + 6, 83 + i * LINE, { color: i === 0 ? COLORS.accent : COLORS.text }));
      drawList(ctx, this.list, x + 6, 96 + question.length * LINE, w - 16, 2);
    } else {
      const heading = this.inArchive ? `${H.archive.toUpperCase()} - ${H.bestRank}` : this.sub ? `${H.contracts} - ${H.reward}` : H.heading;
      drawText(ctx, heading, x + 6, 83, { color: COLORS.dim, size: 10 });
      drawList(ctx, this.list, x + 6, 96, w - 16, ROWS);
    }

    // Under the menu's panel, clear of its last row and of anything announced along the bottom edge: what kind of
    // row is in hand while the contracts are showing, and otherwise, once the story is told, that it is.
    const foot = this.row ?? (campaignComplete(game, MISSIONS) ? H.campaignDone : null);
    if (foot) drawText(ctx, foot, x + w / 2, 78 + 24 + ROWS * LINE + 4, { align: 'center', color: COLORS.dim, size: 10 });
  }
}
