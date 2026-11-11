import { campaignComplete } from '../core/campaign';
import { MISSIONS } from '../content/missions';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import type { App, Screen, ScreenView } from './app';
import { LOGICAL_H, LOGICAL_W } from './display';
import { MenuList } from './menuList';
import { drawMech, mechSprites } from './mechView';
import { COLORS, drawList, drawPanel, drawText } from './widgets';

const H = STRINGS.hub;

/** The place between contracts: shows the money and leads to contracts, garage, shop and messages. */
export class HubScreen implements Screen {
  private main: MenuList;
  /** The contract list, while it is open. */
  private contracts: MenuList | null = null;
  private clock = 0;

  /** `onContracts` opens with the contract list showing, for returning from a briefing. */
  constructor(private app: App, onContracts = false) {
    const errors = app.buildErrors();
    const unread = app.unreadCount();
    this.main = new MenuList([
      { id: 'contracts', label: H.contractsItem, enabled: errors.length === 0, note: errors[0] ? STRINGS.buildErrors[errors[0]] : undefined },
      { id: 'garage', label: H.garage, enabled: true },
      { id: 'shop', label: H.shop, enabled: true },
      { id: 'messages', label: H.messages, enabled: true, note: unread > 0 ? H.unread(unread) : undefined },
      // With a build that may not deploy the cursor starts on the garage, where that is fixed.
    ], errors.length === 0 ? 0 : 1);
    if (onContracts && errors.length === 0) this.openContracts();
  }

  private openContracts(): void {
    this.contracts = new MenuList(this.app.missions().map((m) => ({ id: m.id, label: m.title, enabled: true, note: String(m.reward) })));
  }

  private get list(): MenuList {
    return this.contracts ?? this.main;
  }

  update(dtMs: number): void {
    this.clock += dtMs;
  }

  onInput(action: InputAction): void {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'cancel') this.contracts = null;
    else if (action === 'confirm' && this.list.selected?.enabled) {
      const id = this.list.selected.id;
      if (this.contracts) this.app.openBriefing(id);
      else if (id === 'contracts') this.openContracts();
      else this.app.go(id as 'garage' | 'shop' | 'messages');
    }
  }

  view(): ScreenView {
    return { menu: { items: this.list.items, cursor: this.list.cursor }, message: this.app.saveFailed ? STRINGS.saveFailed : '' };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const game = this.app.game!;
    const { sprites } = this.app.deps;
    const bg = sprites.get('bg-garage', { w: LOGICAL_W, h: LOGICAL_H, label: '' });
    ctx.fillStyle = '#0c0c18';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    drawMech(ctx, mechSprites(sprites, game.build), 0, 70, { dx: 0, dy: 0 }, Math.round(Math.sin(this.clock / 520)));

    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    drawText(ctx, H.heading, 5, 1, { color: COLORS.accent });
    if (this.app.saveFailed) drawText(ctx, STRINGS.saveFailed, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.danger });

    const x = 160;
    const w = LOGICAL_W - x - 4;
    drawPanel(ctx, x, 20, w, 40);
    drawText(ctx, H.credits, x + 6, 25, { color: COLORS.dim });
    drawText(ctx, String(game.credits), x + w - 6, 23, { size: 16, align: 'right', color: game.credits < 0 ? COLORS.danger : COLORS.text });
    drawText(ctx, H.battlesWon, x + 6, 41, { color: COLORS.dim });
    drawText(ctx, String(game.battlesWon), x + w - 6, 41, { align: 'right' });

    const rows = this.contracts ? 5 : 4;
    drawPanel(ctx, x, 68, w, 26 + rows * 11);
    drawText(ctx, this.contracts ? `${H.contracts} - ${H.reward}` : H.heading, x + 6, 73, { color: COLORS.dim, size: 10 });
    drawList(ctx, this.list, x + 6, 86, w - 16, rows);

    if (campaignComplete(game, MISSIONS)) drawText(ctx, H.campaignDone, x + w / 2, 152, { align: 'center', color: COLORS.dim, size: 10 });
  }
}
