import {
  aegisFactor, coolCost, boostCost, guardCost, jamOn, objectiveTarget, turnEnergyOf, HEAT_LIMIT, MAX_ENEMIES, type UnitState,
} from '../core/battle';
import { weaponIn } from '../core/build';
import { FRAME_SLOTS, type Catalog, type FrameSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { InputAction } from '../platform/input';
import { BattleFlow, partName } from './battleFlow';
import { LOGICAL_H, LOGICAL_W } from './display';
import type { Sfx } from '../platform/audio';
import { soundsForEvent } from '../platform/audio';
import { ApDisplay } from './apDisplay';
import { BattleFx, MELEE_MS, PROJECTILE_MS, flightFor, type Scene } from './battleFx';
import { BACK_MOUNT, FAR_FIST, NEAR_FIST, dropOf } from './mechLayout';
import { drawMech, mechSprites, type MechSprites } from './mechView';
import type { Sprite, SpriteStore } from './sprites';
import { fitTags, tagWidth, type Tag } from './tags';
import { Typewriter } from './typewriter';
import { drawWeather, weatherFor } from './weather';
import { CHAR_W, COLORS, LINE, charsFor, drawMeter, drawPanel, drawPortrait, drawScrollMenu, drawText, wrap } from './widgets';

export { BattleFlow } from './battleFlow';
export type { BattlePhase, FlowOptions, MenuView } from './battleFlow';

const PANEL_Y = 178;
/**
 * The box a line of talk is shown in: the panel under the field, where the menu is at other times,
 * so that whatever is being talked about stays in view. Lines of `TALK_CHARS`, at most `TALK_LINES`.
 */
const TALK = { x: 0, y: PANEL_Y, w: LOGICAL_W, h: LOGICAL_H - PANEL_Y, portrait: 56 };
export const TALK_CHARS = charsFor(TALK.w - TALK.portrait - 30);
export const TALK_LINES = 4;
/** How long a press is ignored after a line comes up, and after the press that finished writing it: a mashed button skips nothing unread. */
export const TALK_HOLD_MS = 250;

const MESSAGE_MS = 600;
/** How long the banner that opens a battle stays up: longer when it warns of a boss. */
export const INTRO_MS = 1100;
export const WARNING_MS = 1700;
/** Top of the field: the message bar ends here. */
const FIELD_Y = 14;
const DEFAULT_BACKGROUND = 'bg-neon-district';
const MECH_ORIGIN = { x: -8, y: 16 };
/** Where each enemy stands (the bottom centre of its sprite), by how many there are. */
const ENEMY_ANCHORS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 250, y: 150 }],
  2: [{ x: 240, y: 120 }, { x: 270, y: 174 }],
  3: [{ x: 252, y: 96 }, { x: 274, y: 174 }, { x: 210, y: 174 }],
};
/** Right edge of the mirrored pose box of a duelling enemy mech, and the area its body covers. */
const DUEL_RIGHT = 330;
const DUEL_BODY = { x: 192, y: 22, w: 118, h: 150 };
/** In a duel the player's mech stands this much further left, so two full-size mechs cross weapons, not bodies. */
const DUEL_SHIFT = 6;
/** Sprites of units that fly: these bob up and down, everything else stands still. */
const FLYERS = new Set([
  'enemy-recon-drone', 'enemy-gunship', 'enemy-shield-drone', 'enemy-repair-drone', 'enemy-lien-drone', 'boss-overseer',
]);
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
  /** How many places the enemies stand in: as many as the battle opened with, or all of them when more can join. */
  private places: number;
  /** Units that are on the field as far as the player has been shown: one that is launched appears with its launch. */
  private arrived: Set<string>;
  /** The line of talk being written out, and the writer doing it. */
  private talkLine: unknown = null;
  private talkWriter: Typewriter | null = null;
  /** What is left of the time a press on a line of talk is ignored. */
  private talkHold = 0;
  private typeTick = 0;
  /** What is left of the opening banner, and how long it lasts in all. Nothing else moves while it is up. */
  private intro: number;
  private introTotal: number;
  private introHeard = false;

  constructor(
    private flow: BattleFlow, private sprites: SpriteStore, private catalog: Catalog,
    private opts: {
      fast: boolean; sfx?: Sfx; background?: string; label?: string; resultHint?: string; speed?: number;
      /** The paint scheme of the player's mech. */
      paint?: string;
      /** The contract's name, for the banner that opens the battle. */
      title?: string;
      /** The boss the battle is against, if it is against one: the banner becomes a warning. */
      boss?: string;
      /** Makes the handheld rumble for a number of milliseconds. */
      rumble?: (ms: number) => void;
      /**
       * Called when the battle is decided. Returns true when it has started the music's own fanfare,
       * in which case the sound effect for the outcome is left out: one fanfare is enough.
       */
      jingle?: (won: boolean) => boolean;
    },
  ) {
    this.introTotal = opts.fast ? 0 : opts.boss ? WARNING_MS : INTRO_MS;
    this.intro = this.introTotal;
    this.shownAp = new ApDisplay(flow.state.units);
    const enemies = flow.state.units.filter((u) => u.side === 'enemy');
    this.places = enemies.some((u) => u.abilities.carrier)
      ? MAX_ENEMIES : Math.min(MAX_ENEMIES, Math.max(1, ...enemies.map((u) => (u.slot ?? 0) + 1)));
    const unseen = flow.state.events.slice(flow.eventsShown).flatMap((e) => (e.type === 'launch' ? [e.spawned] : []));
    this.arrived = new Set(flow.state.units.map((u) => u.id).filter((id) => !unseen.includes(id)));
  }

  /** True while the opening banner is up. */
  get banner(): boolean {
    return this.intro > 0;
  }

  /** True while a line of talk is still being written out. */
  get typing(): boolean {
    this.syncTalk();
    return !!this.talkWriter && !this.talkWriter.done;
  }

  /** True while a press on a line of talk would be ignored. */
  get holding(): boolean {
    this.syncTalk();
    return this.talkHold > 0;
  }

  update(realMs: number): void {
    // The fast-battles option plays every pause and effect at a multiple of normal speed. What is only
    // there to be looked at (rain, smoke, the sway of a mech, anything that blinks) keeps its own pace.
    const dtMs = realMs * (this.opts.speed ?? 1);
    this.clock += realMs;
    if (this.intro > 0) {
      if (!this.introHeard) this.opts.sfx?.play(this.opts.boss ? 'warning' : 'banner');
      this.introHeard = true;
      this.intro = Math.max(0, this.intro - realMs);
      return;
    }
    this.spawnEffects();
    this.fx.update(dtMs);
    this.shownAp.update(dtMs);
    this.updateTalk(realMs);
    const rumble = this.fx.takeRumble();
    if (rumble > 0) this.opts.rumble?.(rumble);
    if (this.flow.phase !== 'animating') this.shownAp.sync(this.flow.state.units);
    if (this.flow.phase !== 'animating') { this.timer = 0; return; }
    this.timer += dtMs;
    if (this.opts.fast || this.timer >= MESSAGE_MS) {
      this.timer = 0;
      this.flow.advance();
      // A line of talk may have come up with that step: it gets its writer before anything is drawn.
      this.syncTalk();
    }
  }

  /**
   * Gives the line on screen its writer and its hold-off. A line can come up at any point of a
   * frame: by a press, by the banner running out, by the message timer. Whatever draws it or
   * listens for a press on it asks here first, so it is never shown whole or skipped unwritten.
   */
  private syncTalk(): void {
    const line = this.flow.phase === 'talk' ? this.flow.spoken : null;
    if (line === this.talkLine) return;
    this.talkLine = line;
    this.talkWriter = line ? new Typewriter(wrap(line.text, TALK_CHARS).slice(0, TALK_LINES), undefined, this.opts.fast) : null;
    this.talkHold = line && !this.opts.fast ? TALK_HOLD_MS : 0;
  }

  /** Writes the line of talk out, with a tick now and then. A new line starts a new writer. */
  private updateTalk(realMs: number): void {
    const before = this.talkLine;
    this.syncTalk();
    // A line that has only just come up keeps the whole of its hold-off.
    if (this.talkLine === before) this.talkHold = Math.max(0, this.talkHold - realMs);
    if (!this.talkWriter) return;
    this.typeTick -= realMs;
    if (this.talkWriter.update(realMs) > 0 && this.typeTick <= 0) {
      this.opts.sfx?.play('type');
      this.typeTick = 70;
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
      const melee = event.type === 'shot' && this.scene().isMelee(event.unit, event.weapon);
      const flight = this.opts.fast ? 0 : event.type === 'support' ? PROJECTILE_MS
        : event.type !== 'shot' ? 0 : melee ? MELEE_MS : flightFor(dtype);
      this.shownAp.schedule(event, flight);
      // A module changes armour without a shot or a repair to say so; the state already holds the result.
      if (event.type === 'module') this.shownAp.refresh(this.flow.state.units);
      // A unit that joins the battle is shown as it arrives.
      if (event.type === 'launch') {
        this.shownAp.adopt(this.flow.state.units);
        this.arrived.add(event.spawned);
      }
      if (this.opts.fast) continue;
      this.fx.onEvent(event);
      // The end of a battle is marked once: by the music's fanfare where there is music, by the effect where there is not.
      if (event.type === 'outcome' && this.opts.jingle?.(event.outcome === 'victory')) continue;
      for (const sound of soundsForEvent(event, dtype, flight)) this.opts.sfx?.play(sound.name, sound.delayMs);
    }
    this.fxDone = shown;
  }

  onInput(action: InputAction): void {
    // The banner can be dismissed; nothing else is listened to while it is up.
    if (this.intro > 0) {
      if (action === 'confirm') this.intro = 0;
      this.syncTalk();
      return;
    }
    this.syncTalk();
    if (this.flow.phase === 'animating') {
      if (action === 'confirm') { this.timer = 0; this.flow.advance(); }
      return;
    }
    // The first press on a line still being written finishes it; the next one goes on. A press that
    // comes straight after the line appeared, or straight after the one that finished it, is ignored.
    if (this.flow.phase === 'talk' && action === 'confirm') {
      if (this.talkHold > 0) return;
      if (this.talkWriter && !this.talkWriter.done) {
        this.talkWriter.finish();
        this.talkHold = this.opts.fast ? 0 : TALK_HOLD_MS;
        return;
      }
    }
    // In targeting, left/right also switch enemies.
    if (this.flow.phase === 'target' && (action === 'left' || action === 'right')) {
      this.flow.onInput(action === 'left' ? 'prev' : 'next');
      return;
    }
    this.flow.onInput(action);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const background = this.opts.background ?? DEFAULT_BACKGROUND;
    const bg = this.sprites.get(background, { w: LOGICAL_W, h: LOGICAL_H, label: background });
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // The field, which a heavy blow shakes as a whole; the picture behind it is drawn a little
    // larger so that no edge shows when it moves.
    const { dx, dy } = this.fx.shake();
    this.syncTalk();
    ctx.save();
    ctx.translate(dx, dy);
    // Pixel for pixel while the field is still. Only while a blow moves it is the picture drawn a
    // little larger, so that no edge shows: stretched, a pixel picture loses its grid.
    if (dx === 0 && dy === 0) ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    else ctx.drawImage(bg.image, -6, -6, LOGICAL_W + 12, LOGICAL_H + 12);
    this.drawPlayer(ctx);
    this.drawEnemies(ctx);
    this.drawSmoke(ctx);
    if (!this.opts.fast) {
      ctx.save();
      ctx.translate(0, FIELD_Y);
      drawWeather(ctx, weatherFor(background), this.clock, LOGICAL_W, PANEL_Y - FIELD_Y);
      ctx.restore();
    }
    this.fx.draw(ctx);
    ctx.restore();

    this.drawMessage(ctx);
    this.drawObjective(ctx);
    // While someone talks, their words have the panel: there is nothing to choose until they are done.
    const talking = this.flow.phase === 'talk' && this.intro <= 0;
    if (!talking) this.drawBottom(ctx);
    if (this.intro > 0) return this.drawIntro(ctx);
    if (talking) this.drawTalk(ctx);
    if (this.flow.phase === 'result') this.drawResult(ctx);
  }

  /** The banner that opens a battle: the contract and what it asks for, or a warning with the name of a boss. */
  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const p = 1 - this.intro / this.introTotal;
    // It slides in from the left, holds, and leaves to the right.
    const x = Math.round(LOGICAL_W * (Math.min(1, p / 0.16) - 1 + Math.max(0, (p - 0.88) / 0.12)));
    const boss = this.opts.boss;
    const h = 46;
    const y = 62;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.92)';
    ctx.fillRect(x, y, LOGICAL_W, h);
    const edge = boss ? COLORS.danger : COLORS.accent;
    if (boss) {
      // Hazard stripes run along both edges of a warning.
      const shift = Math.floor(this.clock / 40) % 16;
      for (let sx = -16; sx < LOGICAL_W + 16; sx += 16) {
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(x + sx + shift, y, 8, 3);
        ctx.fillRect(x + sx + 16 - shift, y + h - 3, 8, 3);
      }
      const blink = Math.floor(this.clock / 180) % 2 === 0;
      drawText(ctx, STRINGS.battleIntro.warning, x + LOGICAL_W / 2, y + 5, { size: 32, align: 'center', color: blink ? COLORS.danger : COLORS.heat });
      drawText(ctx, boss.toUpperCase(), x + LOGICAL_W / 2, y + 30, { align: 'center' });
      return;
    }
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, LOGICAL_W, 1);
    ctx.fillRect(x, y + h - 1, LOGICAL_W, 1);
    const title = this.opts.title ?? this.opts.label ?? '';
    drawText(ctx, title, x + LOGICAL_W / 2, y + 7, { size: 16, align: 'center', color: COLORS.accent });
    drawText(ctx, this.instruction(), x + LOGICAL_W / 2, y + 27, { align: 'center', color: COLORS.heat });
  }

  /** What the battle asks for, in the words the briefing used: the strip above the field keeps the count. */
  private instruction(): string {
    const { objective } = this.flow.state;
    const B = STRINGS.objectives.brief;
    const name = objectiveTarget(this.flow.state)?.name ?? '';
    switch (objective.type) {
      case 'survive': return B.survive(objective.rounds);
      case 'protect': return B.protect(objective.name);
      case 'leader': return B.leader(name);
      case 'disable': return B.disable(name);
      case 'driveOff': return B.driveOff(name);
      default: return STRINGS.battleIntro.destroy;
    }
  }

  /** Smoke rising from every destroyed part of a machine that still stands. */
  private drawSmoke(ctx: CanvasRenderingContext2D): void {
    if (this.opts.fast) return;
    const scene = this.scene();
    for (const unit of this.flow.state.units) {
      if (unit.destroyed || this.hidden(unit)) continue;
      for (const slot of FRAME_SLOTS) {
        if (!unit.parts[slot] || this.shownAp.ap(unit.id, slot) > 0) continue;
        const from = scene.hitPoint(unit.id, slot);
        for (let i = 0; i < 3; i++) {
          // Each puff rises, drifts, swells and thins, then starts again from the wound.
          const age = (this.clock / 1500 + i / 3 + (slot.length % 3) * 0.17) % 1;
          const size = 2 + Math.round(age * 4);
          const x = Math.round(from.x + Math.sin(age * 6 + i * 2) * 3 - size / 2);
          const y = Math.round(from.y - age * 24 - size / 2);
          ctx.fillStyle = `rgba(70, 68, 84, ${(0.55 * (1 - age)).toFixed(2)})`;
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }

  /** A destroyed unit stays on screen until its destruction has played out; a launched one is not there before its launch. */
  private hidden(unit: UnitState): boolean {
    if (!this.arrived.has(unit.id)) return true;
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
    return mechSprites(this.sprites, this.flow.state.units[0].build, this.opts.paint);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (this.hidden(player)) return;
    // A slow one-pixel sway of the upper body keeps the mech from looking frozen.
    const idle = Math.round(Math.sin(this.clock / 520));
    this.withTransform(ctx, player, idle, (dx, dy) =>
      drawMech(ctx, this.playerSprites(), this.playerX(), MECH_ORIGIN.y, { dx, dy: 0 }, dy));
  }

  /** Left edge of the player's pose box. */
  private playerX(): number {
    return MECH_ORIGIN.x - (this.duel() ? DUEL_SHIFT : 0);
  }

  /** True when the battle's single enemy is a mech drawn full size from its parts, mirrored. */
  private duel(): boolean {
    return this.places === 1 && this.flow.state.units[1].composed;
  }

  private enemyRect(enemy: UnitState): { x: number; y: number; w: number; h: number; sprite: Sprite } {
    // A duelling mech fills the mirrored pose box; this is the part of it the body occupies.
    if (this.duel()) return { x: DUEL_BODY.x, y: DUEL_BODY.y, w: DUEL_BODY.w, h: DUEL_BODY.h, sprite: { image: null as unknown as CanvasImageSource, w: 0, h: 0 } };
    const anchor = (ENEMY_ANCHORS[this.places] ?? ENEMY_ANCHORS[3])[enemy.slot ?? 0] ?? ENEMY_ANCHORS[3][2];
    const fallback = { w: 48, h: 48, label: enemy.name };
    const id = enemy.sprite ?? enemy.id;
    const sprite = enemy.paint && this.sprites.painted ? this.sprites.painted(id, enemy.paint, fallback) : this.sprites.get(id, fallback);
    // A machine too big for its place is moved in from the edges rather than cut off by them.
    const x = Math.max(MENU_W - 20, Math.min(Math.round(anchor.x - sprite.w / 2), LOGICAL_W - sprite.w - 2));
    const y = Math.max(16, Math.min(anchor.y, PANEL_Y - 8) - sprite.h);
    return { x, y, w: sprite.w, h: sprite.h, sprite };
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const enemies = this.flow.state.units.slice(1).filter((enemy) => !this.hidden(enemy));
    const marked = this.flow.objective?.target;
    // The machines first, back to front as they were placed.
    enemies.forEach((enemy, i) => {
      const r = this.enemyRect(enemy);
      // Flying units bob; anything that stands on the ground stays put.
      const flies = FLYERS.has(enemy.sprite ?? '');
      const hover = flies ? Math.round(2 * Math.sin(this.clock / 380 + i * 2)) : 0;
      if (this.duel()) {
        const parts = mechSprites(this.sprites, enemy.build, enemy.paint);
        const sway = Math.round(Math.sin(this.clock / 520 + 2));
        this.withTransform(ctx, enemy, sway, (dx, dy) => {
          // Mirror the pose box so the mech faces left; a shift to the right is a shift to the left in there.
          ctx.save();
          ctx.translate(DUEL_RIGHT, MECH_ORIGIN.y);
          ctx.scale(-1, 1);
          drawMech(ctx, parts, 0, 0, { dx: -dx, dy: 0 }, dy);
          ctx.restore();
        });
      } else {
        this.withTransform(ctx, enemy, hover, (dx, dy) => ctx.drawImage(r.sprite.image, r.x + dx, r.y + dy, r.w, r.h));
      }
    });
    // Then everything that is written over them, so no machine hides another's bars.
    for (const enemy of enemies) {
      if (enemy.destroyed) continue;
      const r = this.enemyRect(enemy);
      const core = enemy.parts.core!;
      drawMeter(ctx, r.x + 8, r.y + r.h + 2, r.w - 16, 2, this.shownAp.ap(enemy.id, 'core'), core.maxAp, COLORS.armor);
      // Under the armour line, how much balance the enemy has left.
      drawMeter(ctx, r.x + 8, r.y + r.h + 5, r.w - 16, 1, enemy.staggerMax - enemy.stagger, enemy.staggerMax, COLORS.heat);
      const mark = this.fieldMark(enemy) ?? (enemy.id === marked ? { text: STRINGS.objectives.mark, color: COLORS.heat } : null);
      if (mark) drawText(ctx, mark.text, Math.round(r.x + r.w / 2), Math.max(26, r.y - 10), { align: 'center', size: 10, color: mark.color });
      // The enemy the objective is about wears small amber corners all battle long.
      if (enemy.id === marked) this.drawBrackets(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, COLORS.heat, 3);
      if (this.flow.phase === 'target' && this.flow.targetId === enemy.id) this.drawBrackets(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    }
  }

  /** The one state worth flagging over an enemy's head: a bomb about to go off comes first, then a charge about to land. */
  private fieldMark(unit: UnitState): { text: string; color: string } | null {
    const T = STRINGS.tags;
    const blink = Math.floor(this.clock / 260) % 2 === 0;
    if (unit.fuse !== undefined) return { text: T.fuse(unit.fuse), color: unit.fuse <= 1 && blink ? COLORS.danger : COLORS.heat };
    if (unit.charged.length > 0) return { text: T.charging, color: blink ? COLORS.danger : COLORS.heat };
    if (unit.staggered > 0) return { text: T.stagger, color: blink ? COLORS.heat : COLORS.text };
    if (unit.guarding) return { text: T.guard, color: COLORS.armor };
    if (unit.boosted) return { text: T.boost, color: COLORS.energy };
    if (aegisFactor(this.flow.state, unit) < 1) return { text: T.covered, color: COLORS.energy };
    return null;
  }

  /**
   * Short labels for everything that is on a unit right now, what it does for its side first. The
   * rank says what is left out when a row has no room for them all: what a unit is goes before what
   * is about to happen to the pilot.
   */
  private tagsOf(unit: UnitState): Tag[] {
    const T = STRINGS.tags;
    const state = this.flow.state;
    const jammed = unit.side === 'player' ? jamOn(state, unit) : 0;
    return [
      ...(unit.fuse !== undefined ? [{ text: T.fuse(unit.fuse), color: COLORS.danger, rank: 9 }] : []),
      ...(unit.abilities.aegis !== undefined ? [{ text: T.aegis, color: COLORS.energy, rank: 2 }] : []),
      ...(unit.abilities.jam !== undefined ? [{ text: T.jammer, color: COLORS.heat, rank: 2 }] : []),
      ...(unit.abilities.mend !== undefined ? [{ text: T.mender, color: COLORS.armor, rank: 2 }] : []),
      ...(unit.abilities.carrier ? [{ text: T.carrier, color: COLORS.heat, rank: 2 }] : []),
      ...(aegisFactor(state, unit) < 1 ? [{ text: T.covered, color: COLORS.energy, rank: 4 }] : []),
      ...(jammed > 0 ? [{ text: T.jammed(jammed), color: COLORS.heat, rank: 5 }] : []),
      ...(unit.boosted ? [{ text: T.boost, color: COLORS.energy, rank: 5 }] : []),
      ...(unit.guarding ? [{ text: T.guard, color: COLORS.armor, rank: 6 }] : []),
      ...(unit.charged.length > 0 ? [{ text: unit.side === 'player' ? T.charged : T.charging, color: COLORS.heat, rank: 8 }] : []),
      ...(unit.barrier > 0 ? [{ text: T.barrier(unit.barrier), color: COLORS.energy, rank: 7 }] : []),
      ...(unit.painted > 0 ? [{ text: T.painted, color: COLORS.danger, rank: 3 }] : []),
      ...(unit.chaff > 0 ? [{ text: T.chaff, color: COLORS.dim, rank: 3 }] : []),
    ];
  }

  /**
   * Draws as many of a unit's tags as fit in `room` pixels, in a row; from the right edge when
   * `right` is set. Returns whether there were any.
   */
  private drawTags(ctx: CanvasRenderingContext2D, unit: UnitState, x: number, y: number, room: number, right = false): boolean {
    const tags = fitTags(this.tagsOf(unit), room);
    let at = right ? x - tags.reduce((sum, t) => sum + tagWidth(t.text), 0) + 5 : x;
    for (const tag of tags) {
      drawText(ctx, tag.text, at, y + 1, { size: 10, color: tag.color });
      at += tagWidth(tag.text);
    }
    return tags.length > 0;
  }

  /** The stability row: what balance is left, or the word STAGGER while there is none. */
  private drawStability(ctx: CanvasRenderingContext2D, unit: UnitState, x: number, y: number, width: number): number {
    const left = unit.staggerMax - unit.stagger;
    const down = unit.staggered > 0;
    const blink = Math.floor(this.clock / 260) % 2 === 0;
    drawText(ctx, STRINGS.tags.stability, x, y, { color: COLORS.dim });
    drawMeter(ctx, x + 30, y + 4, width - 70, 4, down ? 0 : left, unit.staggerMax, COLORS.heat);
    if (down) drawText(ctx, STRINGS.tags.stagger, x + width, y, { align: 'right', color: blink ? COLORS.danger : COLORS.heat });
    else drawText(ctx, String(left), x + width, y, { align: 'right', color: left <= unit.staggerMax / 2 ? COLORS.heat : COLORS.text });
    return y + LINE;
  }

  /** Screen positions the effects need: where shots leave from and where they land. */
  private scene(): Scene {
    const isPlayer = (id: string) => id === 'player';
    const rectOf = (id: string) => this.enemyRect(this.flow.state.units.find((u) => u.id === id)!);
    // A mech on tracks carries its upper body lower; every point above the legs comes down with it.
    const lowered = (unitIndex: number, part?: FrameSlot): number =>
      (part === 'legs' ? 0 : dropOf(unitIndex === 0 ? this.playerSprites() : mechSprites(this.sprites, this.flow.state.units[unitIndex].build)));
    const at = (p: { x: number; y: number }, part?: FrameSlot) => ({ x: this.playerX() + p.x, y: MECH_ORIGIN.y + p.y + lowered(0, part) });
    /** A point of the pose box as it lands on screen for the mirrored enemy. */
    const mirror = (p: { x: number; y: number }, part?: FrameSlot) => ({ x: DUEL_RIGHT - p.x, y: MECH_ORIGIN.y + p.y + lowered(1, part) });
    return {
      muzzle: (id, weapon) => {
        if (!isPlayer(id)) {
          if (this.duel()) {
            const enemy = this.flow.state.units[1];
            const w = mechSprites(this.sprites, enemy.build)[weapon]?.w ?? 40;
            const p = weapon === 'rightHand' ? { x: NEAR_FIST.x + 0.8 * w, y: NEAR_FIST.y - 2 }
              : weapon === 'leftHand' ? { x: FAR_FIST.x + 0.8 * w, y: FAR_FIST.y - 2 }
              : { x: BACK_MOUNT.x + 0.4 * w, y: BACK_MOUNT.y };
            return mirror(p);
          }
          const r = rectOf(id);
          return { x: r.x + 2, y: r.y + Math.round(r.h * 0.62) };
        }
        const w = this.playerSprites()[weapon]?.w ?? 40;
        if (weapon === 'rightHand') return at({ x: NEAR_FIST.x + 0.8 * w, y: NEAR_FIST.y - 2 });
        if (weapon === 'leftHand') return at({ x: FAR_FIST.x + 0.8 * w, y: FAR_FIST.y - 2 });
        return at({ x: BACK_MOUNT.x + 0.4 * w, y: BACK_MOUNT.y });
      },
      hitPoint: (id, part) => {
        if (isPlayer(id)) return at(PLAYER_HIT[part], part);
        if (this.duel()) return mirror(PLAYER_HIT[part], part);
        const r = rectOf(id);
        const offset = { core: 0.5, legs: 0.25, arms: 0.5, head: 0.2 }[part];
        return { x: r.x + r.w / 2, y: r.y + r.h * offset };
      },
      centre: (id) => {
        if (isPlayer(id)) return at({ x: 78, y: 70 });
        if (this.duel()) return mirror({ x: 78, y: 70 });
        const r = rectOf(id);
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      },
      facing: (id) => (isPlayer(id) ? 1 : -1),
      damageType: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return weaponIn(unit.build, weapon, this.catalog)?.damageType ?? 'kinetic';
      },
      isMelee: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return !!weaponIn(unit.build, weapon, this.catalog)?.melee;
      },
    };
  }

  private drawBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = COLORS.accent, k = 6): void {
    ctx.fillStyle = color;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.fillRect(dx > 0 ? cx : cx - k, dy > 0 ? cy : cy - 1, k, 1);
      ctx.fillRect(dx > 0 ? cx : cx - 1, dy > 0 ? cy : cy - k, 1, k);
    }
  }

  private drawMessage(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, LOGICAL_W, 14);
    if (this.flow.phase !== 'result') {
      drawText(ctx, this.flow.message, 5, 1, { color: this.flow.overheatWarning ? COLORS.danger : COLORS.text });
    }
    if (this.opts.label) drawText(ctx, this.opts.label, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });
  }

  /** What the battle asks for, under the message bar, with a bar where there is something to count. */
  private drawObjective(ctx: CanvasRenderingContext2D): void {
    const objective = this.flow.objective;
    if (!objective) return;
    const type = this.flow.state.objective.type;
    const textW = Math.ceil(objective.text.length * 4.8);
    const meterW = objective.meter ? 44 : 0;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.78)';
    ctx.fillRect(0, 14, textW + meterW + 12, 12);
    drawText(ctx, objective.text, 5, 14, { color: COLORS.heat });
    if (!objective.meter) return;
    const { value, max } = objective.meter;
    // An asset running out and an enemy close to leaving both deserve the eye.
    const low = value <= max / 3;
    const color = type === 'protect' ? (low ? COLORS.danger : COLORS.armor) : type === 'driveOff' ? (low ? COLORS.accent : COLORS.danger) : COLORS.energy;
    drawMeter(ctx, textW + 9, 18, meterW - 4, 4, value, max, color);
  }

  /** The line being said: the speaker's face, their name, and the words, in the panel under the field. */
  private drawTalk(ctx: CanvasRenderingContext2D): void {
    const line = this.flow.spoken;
    const { x, y, w, h, portrait } = TALK;
    drawPanel(ctx, x, y, w, h);
    if (!line) return;
    // The face at its own size: squeezed, a pixel portrait smears.
    drawPortrait(ctx, this.sprites, line.portrait, x + 10, y + 10, portrait);
    const left = x + portrait + 22;
    drawText(ctx, line.who.toUpperCase(), left, y + 10, { color: COLORS.accent });
    const rows = this.talkWriter?.visible() ?? wrap(line.text, TALK_CHARS).slice(0, TALK_LINES);
    // The panel has room to spare: the lines stand a little further apart than usual.
    rows.forEach((row, i) => drawText(ctx, row, left, y + 25 + i * (LINE + 2)));
    // The prompt to go on shows once the line is all there.
    if ((this.talkWriter?.done ?? true) && Math.floor(this.clock / 320) % 2 === 0) drawText(ctx, 'A', x + w - 14, y + h - 16, { color: COLORS.dim });
  }

  private drawBottom(ctx: CanvasRenderingContext2D): void {
    const h = LOGICAL_H - PANEL_Y;
    drawPanel(ctx, 0, PANEL_Y, MENU_W, h);
    drawPanel(ctx, MENU_W - 1, PANEL_Y, LOGICAL_W - MENU_W + 1, h);
    const { phase, menu } = this.flow;
    const player = this.flow.state.units[0];
    const aiming = phase === 'target' || phase === 'moduleTarget';

    const heading = phase === 'weapon' ? STRINGS.headings.weapons
      : phase === 'repairPart' ? STRINGS.headings.repair
      : phase === 'target' ? this.targetHeading()
      : phase === 'moduleTarget' ? STRINGS.headings.paint
      : phase === 'confirmRetreat' ? STRINGS.actions.retreat.toUpperCase() : '';
    let menuY = PANEL_Y + 3;
    if (heading) { drawText(ctx, heading, 6, menuY, { color: COLORS.dim }); menuY += LINE; }
    // While aiming, the foot of the menu panel shows energy and heat, so the list above it is shorter.
    const rows = aiming ? 4 : heading ? 7 : 8;
    if (phase === 'weapon') this.drawWeaponMenu(ctx, 6, menuY);
    else drawScrollMenu(ctx, 6, menuY, phase === 'action' ? this.actionLabels() : menu.items, menu.cursor, rows);

    const x = MENU_W + 5;
    const top = PANEL_Y + 3;
    const width = 144;
    const target = aiming && this.flow.targetId ? this.flow.state.units.find((u) => u.id === this.flow.targetId) : undefined;
    if (target) {
      const name = target.name.toUpperCase();
      drawText(ctx, name, x, top, { color: COLORS.accent });
      // The tags get what the name leaves of the row, less a gap.
      this.drawTags(ctx, target, x + width, top, width - Math.ceil(name.length * CHAR_W) - 4, true);
      let y = this.drawParts(ctx, target, x, top + LINE, this.flow.targetPart);
      y = this.drawStability(ctx, target, x, y, width);
      const p = this.flow.preview;
      if (phase === 'target' && p) {
        const times = p.salvo ? ` ${STRINGS.preview.all}` : p.shots > 1 ? ` x${p.shots}` : '';
        drawText(ctx, `${STRINGS.preview.hit} ${p.hitChance}%   ${STRINGS.preview.damage} ${p.damage}${times}`, x, y + 1, { size: 16 });
      }
      this.drawEnergyAndHeat(ctx, player, 6, LOGICAL_H - 2 * LINE - 2, 132);
    } else {
      const repairs = `${STRINGS.meters.repairs} ${player.repairsLeft}`;
      // The pilot's own tags stop short of the repairs count at the other end of the row.
      if (!this.drawTags(ctx, player, x, top, width - Math.ceil(repairs.length * CHAR_W) - 4)) drawText(ctx, STRINGS.headings.you, x, top, { color: COLORS.dim });
      drawText(ctx, repairs, x + width, top, { color: COLORS.dim, align: 'right' });
      let y = this.drawParts(ctx, player, x, top + LINE, null);
      y = this.drawStability(ctx, player, x, y, width);
      this.drawEnergyAndHeat(ctx, player, x, y, width);
    }
  }

  /** Over the list of parts while aiming: with a choice of enemies, which one this is and how to get to the next. */
  private targetHeading(): string {
    const { at, of } = this.flow.targetChoice;
    return of > 1 ? STRINGS.headings.targetOf(at, of) : STRINGS.headings.target;
  }

  /** The weapon menu: each weapon's name, and under it what firing it costs or why it cannot be fired. */
  private drawWeaponMenu(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const { items, cursor } = this.flow.menu;
    items.forEach((item, i) => {
      const selected = i === cursor;
      const top = y + i * (2 * LINE);
      if (selected) drawText(ctx, '>', x, top, { color: COLORS.accent });
      drawText(ctx, item.label, x + 8, top, { color: !item.enabled ? COLORS.dim : selected ? COLORS.accent : COLORS.text });
      if (item.note) drawText(ctx, item.note, x + 14, top + LINE - 1, { color: item.enabled ? COLORS.dim : COLORS.danger, size: 10 });
    });
  }

  /** Action menu labels with their energy cost where there is one. */
  private actionLabels(): { label: string; enabled: boolean }[] {
    const player = this.flow.state.units[0];
    const cost: Record<string, number | undefined> = {
      boost: boostCost(player, this.catalog), guard: guardCost(player, this.catalog), cool: coolCost(player, this.catalog),
    };
    return this.flow.menu.items.map((item) => ({
      ...item,
      label: cost[item.id] !== undefined ? `${item.label}  ${STRINGS.meters.energy} ${cost[item.id]}`
        : item.id === 'repair' ? `${item.label}  ${STRINGS.actionNotes.repair}` : item.label,
    }));
  }

  private drawParts(ctx: CanvasRenderingContext2D, unit: UnitState, x: number, y: number, highlight: FrameSlot | null): number {
    for (const slot of FRAME_SLOTS) {
      const part = unit.parts[slot];
      if (!part) continue;
      const ap = this.shownAp.ap(unit.id, slot);
      const dead = ap <= 0;
      const color = slot === highlight ? COLORS.accent : dead ? COLORS.dim : COLORS.text;
      drawText(ctx, partName(unit, slot), x, y, { color, strike: dead });
      // A core that is nearly gone blinks red.
      const failing = slot === 'core' && !dead && ap <= part.maxAp * 0.25 && Math.floor(this.clock / 240) % 2 === 0;
      drawMeter(ctx, x + 30, y + 4, 74, 4, ap, part.maxAp, failing ? COLORS.danger : COLORS.armor);
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
    const note = this.flow.resultNote;
    const w = 170;
    const h = note ? 72 : 60;
    const x = (LOGICAL_W - w) / 2;
    const y = 30;
    drawPanel(ctx, x, y, w, h);
    const won = this.flow.state.outcome === 'victory';
    drawText(ctx, this.flow.message, LOGICAL_W / 2, y + 8, { size: 32, align: 'center', color: won ? COLORS.accent : COLORS.danger });
    if (note) drawText(ctx, note, LOGICAL_W / 2, y + 40, { align: 'center' });
    drawText(ctx, this.opts.resultHint ?? STRINGS.hints.result, LOGICAL_W / 2, y + h - 18, { align: 'center', color: COLORS.dim });
  }
}
