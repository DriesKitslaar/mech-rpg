import { campaignComplete } from '../core/campaign';
import { levelFor, perkPoints } from '../core/pilot';
import { MISSIONS } from '../content/missions';
import { PERKS } from '../content/perks';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, LINE, drawList, drawPanel, drawText } from './widgets';

const H = STRINGS.hub;
const ROWS = 10;
/** The entry of the contract list that opens the archive. No contract has this id. */
export const ARCHIVE = 'archive';

/** The place between contracts: shows the pilot's standing and leads to everything else. */
/** The title of the contract that ends the introductions, after which the arena and open contracts are offered. */
const lastIntroduction = (): string => MISSIONS.filter((m) => m.phase === 'intro').at(-1)?.title ?? '';

export class HubScreen implements Screen {
  private main: MenuList;
  /** The contract list, the archive or the new-cycle question, while one is open. */
  private sub: MenuList | null = null;
  private asking = false;
  /** True while the list showing is the archive of contracts already done. */
  private inArchive = false;
  private clock = 0;

  /** `list` opens with that list showing, and the cursor on the entry `at`, for returning from a briefing. */
  constructor(private app: App, list?: 'contracts' | 'archive', at?: string) {
    const errors = app.buildErrors();
    const unread = app.unreadCount();
    const points = perkPoints(app.game!, PERKS);
    const sideWork = app.sideWorkOpen();
    this.main = new MenuList([
      { id: 'contracts', label: H.contractsItem, enabled: errors.length === 0, note: errors[0] ? STRINGS.buildErrors[errors[0]] : undefined },
      // Until the arena opens, the entry says what opens it: the last of the introductory contracts.
      { id: 'arena', label: H.arena, enabled: sideWork && errors.length === 0, note: sideWork ? undefined : H.opensAfter(lastIntroduction()) },
      { id: 'training', label: H.training, enabled: true },
      { id: 'garage', label: H.garage, enabled: true },
      { id: 'shop', label: H.shop, enabled: true },
      { id: 'pilot', label: H.pilot, enabled: true, note: points > 0 ? H.points(points) : undefined },
      { id: 'messages', label: H.messages, enabled: true, note: unread > 0 ? H.unread(unread) : undefined },
      { id: 'database', label: H.database, enabled: true },
      { id: 'options', label: H.options, enabled: true },
      ...(app.canStartCycle() ? [{ id: 'cycle', label: H.cycle, enabled: true }] : []),
      // With a build that may not deploy the cursor starts on the garage, where that is fixed.
    ], errors.length === 0 ? 0 : 3);
    if (list && errors.length === 0) {
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
    const done = this.app.archive().length;
    const missions = this.app.missions();
    // The patrol heads the list, but the cursor starts on the next contract of the story: the same
    // button pressed again and again should lead on, not round and round the patrol.
    const story = missions.findIndex((m) => m.phase !== 'patrol');
    this.sub = new MenuList([
      ...missions.map((m) => ({ id: m.id, label: m.title, enabled: true, note: String(m.reward) })),
      ...(done > 0 ? [{ id: ARCHIVE, label: H.archive, enabled: true, note: String(done) }] : []),
    ], Math.max(0, story));
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
      } else this.app.go(id as 'arena' | 'training' | 'garage' | 'shop' | 'pilot' | 'messages' | 'database' | 'options');
    }
  }

  view(): ScreenView {
    const message = this.app.saveFailed ? STRINGS.saveFailed : this.asking ? H.cycleQuestion[0] : '';
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message, list: this.inArchive ? 'archive' : this.sub && !this.asking ? 'contracts' : 'main' };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    drawMech(ctx, mechSprites(sprites, game.build, game.paint), -8, 78, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));

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
      H.cycleQuestion.forEach((row, i) => drawText(ctx, row, x + 6, 83 + i * LINE, { color: i === 0 ? COLORS.accent : COLORS.text }));
      drawList(ctx, this.list, x + 6, 96 + H.cycleQuestion.length * LINE, w - 16, 2);
    } else {
      const heading = this.inArchive ? `${H.archive.toUpperCase()} - ${H.bestRank}` : this.sub ? `${H.contracts} - ${H.reward}` : H.heading;
      drawText(ctx, heading, x + 6, 83, { color: COLORS.dim, size: 10 });
      drawList(ctx, this.list, x + 6, 96, w - 16, ROWS);
    }

    // Under the menu's panel, clear of its last row and of anything announced along the bottom edge.
    if (campaignComplete(game, MISSIONS)) {
      drawText(ctx, H.campaignDone, x + w / 2, 78 + 24 + ROWS * LINE + 4, { align: 'center', color: COLORS.dim, size: 10 });
    }
  }
}
