import { coolCost, boostCost, turnEnergyOf, HEAT_LIMIT, type UnitState } from '../core/battle';
import { FRAME_SLOTS, type Catalog, type FrameSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { BattleFlow } from './battleFlow';
import { LOGICAL_H, LOGICAL_W } from './display';
import { layoutMech, type SpriteSize, type SpriteSlot } from './mechLayout';
import type { Sprite, SpriteStore } from './sprites';
import { COLORS, LINE, drawMenu, drawMeter, drawPanel, drawText } from './widgets';

export { BattleFlow } from './battleFlow';
export type { BattlePhase, MenuView } from './battleFlow';

const MESSAGE_MS = 600;
const MECH_ORIGIN = { x: 14, y: 58 };
const ENEMY_BOX = 64;
const ENEMY_SPOTS = [{ x: 190, y: 30 }, { x: 236, y: 62 }, { x: 190, y: 100 }];
const PANEL_Y = 178;
const MENU_W = 150;
/** Placeholder sizes when a part sprite is missing. */
const FALLBACK: Record<SpriteSlot, SpriteSize> = {
  legs: { w: 64, h: 52 }, core: { w: 56, h: 40 }, head: { w: 26, h: 22 }, arm: { w: 22, h: 44 },
  rightHand: { w: 52, h: 20 }, leftHand: { w: 52, h: 20 }, shoulder: { w: 60, h: 22 },
};
const BUILD_SLOT: Record<SpriteSlot, 'legs' | 'core' | 'head' | 'arms' | 'rightHand' | 'leftHand' | 'shoulder'> = {
  legs: 'legs', core: 'core', head: 'head', arm: 'arms', rightHand: 'rightHand', leftHand: 'leftHand', shoulder: 'shoulder',
};

export class BattleScreen {
  private timer = 0;
  private clock = 0;

  constructor(
    private flow: BattleFlow, private sprites: SpriteStore, private catalog: Catalog,
    private opts: { fast: boolean },
  ) {}

  update(dtMs: number): void {
    this.clock += dtMs;
    if (this.flow.phase !== 'animating') { this.timer = 0; return; }
    this.timer += dtMs;
    if (this.opts.fast || this.timer >= MESSAGE_MS) {
      this.timer = 0;
      this.flow.advance();
    }
  }

  onInput(action: InputAction): void {
    if (this.flow.phase === 'animating') {
      if (action === 'confirm') { this.timer = 0; this.flow.advance(); }
      return;
    }
    // In targeting, left/right also switch enemies.
    if (this.flow.phase === 'target' && (action === 'left' || action === 'right')) {
      this.flow.onInput(action === 'left' ? 'prev' : 'next');
      return;
    }
    this.flow.onInput(action);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const bg = this.sprites.get('bg-quarry', { w: LOGICAL_W, h: LOGICAL_H, label: 'bg-quarry' });
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);

    this.drawPlayer(ctx);
    this.drawEnemies(ctx);
    this.drawMessage(ctx);
    this.drawBottom(ctx);
    if (this.flow.phase === 'result') this.drawResult(ctx);
  }

  /** True while the current message is about this unit being hit: the sprite blinks. */
  private blinking(unitId: string): boolean {
    const e = this.flow.lastEvent;
    return this.flow.phase === 'animating' && !!e && e.type === 'shot' && e.hit && e.target === unitId
      && Math.floor(this.clock / 80) % 2 === 0;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (player.destroyed || this.blinking(player.id)) return;
    const parts: Partial<Record<SpriteSlot, Sprite>> = {};
    for (const slot of Object.keys(BUILD_SLOT) as SpriteSlot[]) {
      const id = player.build[BUILD_SLOT[slot]];
      if (id) parts[slot] = this.sprites.get(id, { ...FALLBACK[slot], label: id });
    }
    for (const cmd of layoutMech(parts)) {
      const sprite = parts[cmd.slot]!;
      ctx.filter = cmd.dim ? 'brightness(0.65)' : 'none';
      ctx.drawImage(sprite.image, MECH_ORIGIN.x + cmd.x, MECH_ORIGIN.y + cmd.y, sprite.w, sprite.h);
    }
    ctx.filter = 'none';
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const enemies = this.flow.state.units.slice(1);
    enemies.forEach((enemy, i) => {
      if (enemy.destroyed) return;
      const spot = ENEMY_SPOTS[i];
      const sprite = this.sprites.get(enemy.sprite ?? enemy.id, { w: 48, h: 48, label: enemy.name });
      const x = spot.x + Math.round((ENEMY_BOX - sprite.w) / 2);
      const y = spot.y + (ENEMY_BOX - sprite.h);
      if (!this.blinking(enemy.id)) ctx.drawImage(sprite.image, x, y, sprite.w, sprite.h);
      const core = enemy.parts.core!;
      drawMeter(ctx, spot.x + 12, spot.y + ENEMY_BOX + 2, ENEMY_BOX - 24, 2, core.ap, core.maxAp, COLORS.armor);
      if (this.flow.phase === 'target' && this.flow.targetId === enemy.id) this.drawBrackets(ctx, spot.x, spot.y);
    });
  }

  private drawBrackets(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const s = ENEMY_BOX;
    const k = 6;
    ctx.fillStyle = COLORS.accent;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]]) {
      ctx.fillRect(dx > 0 ? cx : cx - k, dy > 0 ? cy : cy - 1, k, 1);
      ctx.fillRect(dx > 0 ? cx : cx - 1, dy > 0 ? cy : cy - k, 1, k);
    }
  }

  private drawMessage(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    if (this.flow.phase !== 'result') drawText(ctx, this.flow.message, 5, 1);
  }

  private drawBottom(ctx: CanvasRenderingContext2D): void {
    const h = LOGICAL_H - PANEL_Y;
    drawPanel(ctx, 0, PANEL_Y, MENU_W, h);
    drawPanel(ctx, MENU_W - 1, PANEL_Y, LOGICAL_W - MENU_W + 1, h);
    const { phase, menu } = this.flow;
    const player = this.flow.state.units[0];

    const heading = phase === 'weapon' ? STRINGS.headings.weapons
      : phase === 'repairPart' ? STRINGS.headings.repair
      : phase === 'target' ? STRINGS.headings.target : '';
    let menuY = PANEL_Y + 5;
    if (heading) { drawText(ctx, heading, 6, menuY, { color: COLORS.dim }); menuY += LINE + 1; }
    drawMenu(ctx, 6, menuY, phase === 'action' ? this.actionLabels() : menu.items, menu.cursor);

    const x = MENU_W + 5;
    if (phase === 'target' && this.flow.targetId) {
      const target = this.flow.state.units.find((u) => u.id === this.flow.targetId)!;
      drawText(ctx, target.name.toUpperCase(), x, PANEL_Y + 5, { color: COLORS.accent });
      const y = this.drawParts(ctx, target, x, PANEL_Y + 5 + LINE + 1, this.flow.targetPart);
      const p = this.flow.preview!;
      drawText(ctx, `${STRINGS.preview.hit} ${p.hitChance}%   ${STRINGS.preview.damage} ${p.damage}`, x, y + 3, { size: 16 });
    } else {
      drawText(ctx, STRINGS.headings.you, x, PANEL_Y + 5, { color: COLORS.dim });
      drawText(ctx, `${STRINGS.meters.repairs} ${player.repairsLeft}`, x + 148, PANEL_Y + 5, { color: COLORS.dim, align: 'right' });
      let y = this.drawParts(ctx, player, x, PANEL_Y + 5 + LINE + 1, null);
      const max = turnEnergyOf(player, this.catalog);
      this.drawStat(ctx, STRINGS.meters.energy, player.energy, max, COLORS.energy, x, y);
      y += LINE;
      this.drawStat(ctx, STRINGS.meters.heat, player.heat, HEAT_LIMIT, player.heat > 75 ? COLORS.danger : COLORS.heat, x, y);
    }
  }

  /** Action menu labels with their energy cost where there is one. */
  private actionLabels(): { label: string; enabled: boolean }[] {
    const player = this.flow.state.units[0];
    const cost: Record<string, number | undefined> = {
      boost: boostCost(player, this.catalog), cool: coolCost(player, this.catalog),
    };
    return this.flow.menu.items.map((item) => ({
      ...item, label: cost[item.id] !== undefined ? `${item.label}  ${STRINGS.meters.energy} ${cost[item.id]}` : item.label,
    }));
  }

  private drawParts(ctx: CanvasRenderingContext2D, unit: UnitState, x: number, y: number, highlight: FrameSlot | null): number {
    for (const slot of FRAME_SLOTS) {
      const part = unit.parts[slot];
      if (!part) continue;
      const dead = part.ap <= 0;
      const color = slot === highlight ? COLORS.accent : dead ? COLORS.dim : COLORS.text;
      drawText(ctx, STRINGS.parts[slot], x, y, { color, strike: dead });
      drawMeter(ctx, x + 30, y + 4, 78, 4, part.ap, part.maxAp, COLORS.armor);
      drawText(ctx, String(part.ap), x + 148, y, { color, align: 'right' });
      y += LINE;
    }
    return y;
  }

  private drawStat(
    ctx: CanvasRenderingContext2D, label: string, value: number, max: number, color: string, x: number, y: number,
  ): void {
    drawText(ctx, label, x, y, { color: COLORS.dim });
    drawMeter(ctx, x + 30, y + 4, 78, 4, value, max, color);
    drawText(ctx, String(value), x + 148, y, { align: 'right', color: color === COLORS.danger ? COLORS.danger : COLORS.text });
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const w = 170;
    const h = 60;
    const x = (LOGICAL_W - w) / 2;
    const y = 22;
    drawPanel(ctx, x, y, w, h);
    const won = this.flow.state.outcome === 'victory';
    drawText(ctx, this.flow.message, LOGICAL_W / 2, y + 8, { size: 32, align: 'center', color: won ? COLORS.accent : COLORS.danger });
    drawText(ctx, STRINGS.hints.result, LOGICAL_W / 2, y + 42, { align: 'center', color: COLORS.dim });
  }
}
