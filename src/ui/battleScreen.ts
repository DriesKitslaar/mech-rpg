import { coolCost, boostCost, turnEnergyOf, HEAT_LIMIT, type UnitState } from '../core/battle';
import { weaponIn } from '../core/build';
import { FRAME_SLOTS, type Catalog, type FrameSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { BattleFlow } from './battleFlow';
import { LOGICAL_H, LOGICAL_W } from './display';
import type { Sfx } from '../platform/audio';
import { soundsForEvent } from '../platform/audio';
import { ApDisplay } from './apDisplay';
import { BattleFx, flightFor, type Scene } from './battleFx';
import { BACK_MOUNT, FAR_FIST, NEAR_FIST } from './mechLayout';
import { drawMech, mechSprites, type MechSprites } from './mechView';
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
/** Where a hit on each part of the player's mech lands, inside the pose box. */
const PLAYER_HIT: Record<FrameSlot, { x: number; y: number }> = {
  head: { x: 76, y: 20 }, core: { x: 78, y: 50 }, arms: { x: 108, y: 44 }, legs: { x: 76, y: 108 },
};
export class BattleScreen {
  private timer = 0;
  private clock = 0;
  private fx = new BattleFx(this.scene());
  /** Events already handed to the effects. */
  private fxDone = 0;
  /** Armour as shown, which trails the rules until each shot has landed. */
  private shownAp: ApDisplay;

  constructor(
    private flow: BattleFlow, private sprites: SpriteStore, private catalog: Catalog,
    private opts: { fast: boolean; sfx?: Sfx },
  ) {
    this.shownAp = new ApDisplay(flow.state.units);
  }

  update(dtMs: number): void {
    this.clock += dtMs;
    this.spawnEffects();
    this.fx.update(dtMs);
    this.shownAp.update(dtMs);
    if (this.flow.phase !== 'animating') this.shownAp.sync(this.flow.state.units);
    if (this.flow.phase !== 'animating') { this.timer = 0; return; }
    this.timer += dtMs;
    if (this.opts.fast || this.timer >= MESSAGE_MS) {
      this.timer = 0;
      this.flow.advance();
    }
  }

  /** Starts an effect for every event the flow has shown since the last frame, so none is ever skipped. */
  private spawnEffects(): void {
    const events = this.flow.state.events;
    const shown = this.flow.eventsShown;
    for (let i = this.fxDone; i < shown; i++) {
      const event = events[i];
      const dtype = event.type === 'shot' ? this.scene().damageType(event.unit, event.weapon) : 'kinetic';
      // In fast mode messages fly by within a frame: no effects, no sound, no waiting.
      const flight = this.opts.fast || event.type !== 'shot' ? 0 : flightFor(dtype);
      this.shownAp.schedule(event, flight);
      if (this.opts.fast) continue;
      this.fx.onEvent(event);
      for (const sound of soundsForEvent(event, dtype, flight)) this.opts.sfx?.play(sound.name, sound.delayMs);
    }
    this.fxDone = shown;
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
    this.fx.draw(ctx);
    this.drawMessage(ctx);
    this.drawBottom(ctx);
    if (this.flow.phase === 'result') this.drawResult(ctx);
  }

  /** A destroyed unit stays on screen until its destruction has played out. */
  private hidden(unit: UnitState): boolean {
    if (!unit.destroyed) return false;
    return this.opts.fast || this.fx.isGone(unit.id) || (this.flow.phase === 'result' && !this.fx.busy);
  }

  /** Applies an effect transform around a draw call. */
  private withTransform(ctx: CanvasRenderingContext2D, unit: UnitState, idleDy: number, draw: (dx: number, dy: number) => void): void {
    const t = this.fx.transform(unit.id);
    ctx.globalAlpha = t.alpha;
    ctx.filter = t.flash ? 'brightness(2.6)' : 'none';
    draw(t.dx, t.dy + (unit.destroyed ? 0 : idleDy));
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  private playerSprites(): MechSprites {
    return mechSprites(this.sprites, this.flow.state.units[0].build);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (this.hidden(player)) return;
    // A slow one-pixel sway of the upper body keeps the mech from looking frozen.
    const idle = Math.round(Math.sin(this.clock / 520));
    this.withTransform(ctx, player, idle, (dx, dy) =>
      drawMech(ctx, this.playerSprites(), MECH_ORIGIN.x, MECH_ORIGIN.y, { dx, dy: 0 }, dy));
  }

  private enemyRect(index: number): { x: number; y: number; w: number; h: number; sprite: Sprite } {
    const enemy = this.flow.state.units[index + 1];
    const spot = ENEMY_SPOTS[index];
    const sprite = this.sprites.get(enemy.sprite ?? enemy.id, { w: 48, h: 48, label: enemy.name });
    return {
      x: spot.x + Math.round((ENEMY_BOX - sprite.w) / 2), y: spot.y + (ENEMY_BOX - sprite.h), w: sprite.w, h: sprite.h, sprite,
    };
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const enemies = this.flow.state.units.slice(1);
    enemies.forEach((enemy, i) => {
      if (this.hidden(enemy)) return;
      const spot = ENEMY_SPOTS[i];
      const r = this.enemyRect(i);
      // Flying units bob; anything bolted to the ground stays put.
      const hover = enemy.parts.legs ? Math.round(2 * Math.sin(this.clock / 380 + i * 2)) : 0;
      this.withTransform(ctx, enemy, hover, (dx, dy) => ctx.drawImage(r.sprite.image, r.x + dx, r.y + dy, r.w, r.h));
      if (enemy.destroyed) return;
      const core = enemy.parts.core!;
      drawMeter(ctx, spot.x + 12, spot.y + ENEMY_BOX + 2, ENEMY_BOX - 24, 2, this.shownAp.ap(enemy.id, 'core'), core.maxAp, COLORS.armor);
      if (this.flow.phase === 'target' && this.flow.targetId === enemy.id) this.drawBrackets(ctx, spot.x, spot.y);
    });
  }

  /** Screen positions the effects need: where shots leave from and where they land. */
  private scene(): Scene {
    const isPlayer = (id: string) => id === 'player';
    const enemyIndex = (id: string) => this.flow.state.units.findIndex((u) => u.id === id) - 1;
    const at = (p: { x: number; y: number }) => ({ x: MECH_ORIGIN.x + p.x, y: MECH_ORIGIN.y + p.y });
    return {
      muzzle: (id, weapon) => {
        if (!isPlayer(id)) {
          const r = this.enemyRect(enemyIndex(id));
          return { x: r.x + 2, y: r.y + Math.round(r.h * 0.62) };
        }
        const w = this.playerSprites()[weapon]?.w ?? 40;
        if (weapon === 'rightHand') return at({ x: NEAR_FIST.x + 0.8 * w, y: NEAR_FIST.y - 2 });
        if (weapon === 'leftHand') return at({ x: FAR_FIST.x + 0.8 * w, y: FAR_FIST.y - 2 });
        return at({ x: BACK_MOUNT.x + 0.4 * w, y: BACK_MOUNT.y });
      },
      hitPoint: (id, part) => {
        if (isPlayer(id)) return at(PLAYER_HIT[part]);
        const r = this.enemyRect(enemyIndex(id));
        const offset = { core: 0.5, legs: 0.25, arms: 0.5, head: 0.2 }[part];
        return { x: r.x + r.w / 2, y: r.y + r.h * offset };
      },
      centre: (id) => {
        if (isPlayer(id)) return at({ x: 78, y: 70 });
        const r = this.enemyRect(enemyIndex(id));
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      },
      facing: (id) => (isPlayer(id) ? 1 : -1),
      damageType: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return weaponIn(unit.build, weapon, this.catalog)?.damageType ?? 'kinetic';
      },
    };
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
      const ap = this.shownAp.ap(unit.id, slot);
      const dead = ap <= 0;
      const color = slot === highlight ? COLORS.accent : dead ? COLORS.dim : COLORS.text;
      drawText(ctx, STRINGS.parts[slot], x, y, { color, strike: dead });
      drawMeter(ctx, x + 30, y + 4, 74, 4, ap, part.maxAp, COLORS.armor);
      drawText(ctx, String(ap), x + 144, y, { color, align: 'right' });
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
