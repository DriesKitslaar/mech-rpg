import { coolCost, boostCost, turnEnergyOf, HEAT_LIMIT, type UnitState } from '../core/battle';
import { FRAME_SLOTS, type Build, type Catalog, type FrameSlot } from '../core/types';
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
const BACKGROUND = 'bg-neon-district';
const MECH_ORIGIN = { x: 0, y: 16 };
const ENEMY_BOX = 64;
const ENEMY_SPOTS = [{ x: 204, y: 30 }, { x: 244, y: 64 }, { x: 204, y: 100 }];
const PANEL_Y = 178;
const MENU_W = 154;
/** Placeholder boxes, roughly where each layer sits in the pose, for when a sprite is missing. */
const FALLBACK: Record<SpriteSlot, SpriteSize> = {
  armFar: { w: 30, h: 42, ox: 18, oy: 38 }, legs: { w: 96, h: 84, ox: 14, oy: 72 }, core: { w: 42, h: 52, ox: 54, oy: 28 },
  head: { w: 24, h: 24, ox: 66, oy: 6 }, armNear: { w: 54, h: 30, ox: 88, oy: 34 },
  rightHand: { w: 70, h: 24 }, leftHand: { w: 40, h: 20 }, shoulder: { w: 44, h: 26 },
};
/** Which sprite a slot shows for a build: the arms part supplies two layers. */
const SPRITE_ID: Record<SpriteSlot, (build: Build) => string | undefined> = {
  armFar: (b) => b.arms && `${b.arms}.far`,
  legs: (b) => b.legs,
  core: (b) => b.core,
  head: (b) => b.head,
  armNear: (b) => b.arms && `${b.arms}.near`,
  rightHand: (b) => b.rightHand,
  leftHand: (b) => b.leftHand,
  shoulder: (b) => b.shoulder,
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
    const bg = this.sprites.get(BACKGROUND, { w: LOGICAL_W, h: LOGICAL_H, label: BACKGROUND });
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
    for (const slot of Object.keys(SPRITE_ID) as SpriteSlot[]) {
      const id = SPRITE_ID[slot](player.build);
      if (id) parts[slot] = this.sprites.get(id, { ...FALLBACK[slot], label: id });
    }
    for (const cmd of layoutMech(parts)) {
      const sprite = parts[cmd.slot]!;
      ctx.drawImage(sprite.image, MECH_ORIGIN.x + cmd.x, MECH_ORIGIN.y + cmd.y, sprite.w, sprite.h);
    }
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
    if (this.flow.phase !== 'result') {
      drawText(ctx, this.flow.message, 5, 1, { color: this.flow.overheatWarning ? COLORS.danger : COLORS.text });
    }
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
      // Energy and heat stay in view while aiming, at the foot of the menu panel.
      this.drawEnergyAndHeat(ctx, player, 6, LOGICAL_H - 2 * LINE - 4, 132);
    } else {
      drawText(ctx, STRINGS.headings.you, x, PANEL_Y + 5, { color: COLORS.dim });
      drawText(ctx, `${STRINGS.meters.repairs} ${player.repairsLeft}`, x + 144, PANEL_Y + 5, { color: COLORS.dim, align: 'right' });
      const y = this.drawParts(ctx, player, x, PANEL_Y + 5 + LINE + 1, null);
      this.drawEnergyAndHeat(ctx, player, x, y, 144);
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
      drawMeter(ctx, x + 30, y + 4, 74, 4, part.ap, part.maxAp, COLORS.armor);
      drawText(ctx, String(part.ap), x + 144, y, { color, align: 'right' });
      y += LINE;
    }
    return y;
  }

  private drawEnergyAndHeat(ctx: CanvasRenderingContext2D, player: UnitState, x: number, y: number, width: number): void {
    const hot = player.heat > 75 || this.flow.overheatWarning;
    this.drawStat(ctx, STRINGS.meters.energy, player.energy, turnEnergyOf(player, this.catalog), COLORS.energy, x, y, width);
    this.drawStat(ctx, STRINGS.meters.heat, player.heat, HEAT_LIMIT, hot ? COLORS.danger : COLORS.heat, x, y + LINE, width);
  }

  private drawStat(
    ctx: CanvasRenderingContext2D, label: string, value: number, max: number, color: string, x: number, y: number,
    width: number,
  ): void {
    drawText(ctx, label, x, y, { color: COLORS.dim });
    drawMeter(ctx, x + 30, y + 4, width - 70, 4, value, max, color);
    drawText(ctx, String(value), x + width, y, { align: 'right', color: color === COLORS.danger ? COLORS.danger : COLORS.text });
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
