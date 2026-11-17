import {
  aegisFactor, coolCost, boostCost, guardCost, jamOn, objectiveTarget, turnEnergyOf, HEAT_LIMIT, MAX_ENEMIES, type BattleEvent, type UnitState, DRIVE_MAX,
} from '../core/battle';
import { weaponIn } from '../core/build';
import { FRAME_SLOTS, type Catalog, type FrameSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import type { RadioCue } from '../core/wingman';
import { Radio } from './radio';
import type { InputAction } from '../platform/input';
import { BattleFlow, partName } from './battleFlow';
import { LOGICAL_H, LOGICAL_W } from './display';
import type { Sfx } from '../platform/audio';
import { soundsForEvent } from '../platform/audio';
import { drawAmbience } from './ambience';
import { ApDisplay } from './apDisplay';
import { BattleFx, MELEE_MS, PROJECTILE_MS, WRECK_AT, flightFor, type Scene } from './battleFx';
import { BACK_MOUNT, FAR_FIST, MECH_BOX, NEAR_FIST, dropOf } from './mechLayout';
import { HitStop } from './hitStop';
import { eyeLight, eyeOf } from './eyes';
import { MAX_LIGHTS, disc, drawGlow, drawGlows, drawLights, drawShadow, lightRoom, type Glow, type Pt } from './light';
import { drawWord, fitTall, wordLevel, wordLights, wordTop } from './signType';
import {
  CUT_IN_MS, FINISH_FIELD_MS, FINISH_HOLD_MS, FINISH_SLOW, MECH_HEAD, drawCutIn, drawDefeat, drawEntrance, drawLetterbox, drawVictory, endsBattle, focusOn, letterbox, lookClose,
  type Entrant,
} from './cinema';
import { drawMech, mechSprites, type MechSprites } from './mechView';
import { Particles } from './particles';
import { Puppet, ShownStance, shatter, type Pose, type Stance } from './pose';
import type { Sprite, SpriteStore } from './sprites';
import { fitTags, intentText, labelFits, markPosition, tagWidth, type Tag } from './tags';
import { intentOf } from '../core/intent';
import { PLAIN_TYPING, TYPING_SPEED, Typewriter, type Typing } from './typewriter';
import { THUNDER_AFTER_MS, drawWeather, drawWeatherExtras, strokeBegan, weatherFor } from './weather';
import { CHAR_W, COLORS, LINE, charsFor, drawMeter, drawPanel, drawPortrait, drawRowLight, drawScrollMenu, drawText, wrap } from './widgets';

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
/** The share of the heat limit from which a machine is seen to be hot. */
const HOT = 0.75;
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
  'enemy-hunter-drone', 'enemy-longshot',
]);
const MENU_W = 154;
/** Where a hit on each part of the player's mech lands, inside the pose box. */
const PLAYER_HIT: Record<FrameSlot, { x: number; y: number }> = {
  head: { x: 76, y: 20 }, core: { x: 78, y: 50 }, arms: { x: 108, y: 44 }, legs: { x: 76, y: 108 },
};
/** Where the strip the wingman's line is written on starts. */
const RADIO_X = 8;
/** How long an elite under cover says each of the two over its head before it says the other. */
export const MARK_TURN_MS = 1600;

/** How long the ring of an Overdrive takes to run out. */
const SURGE_MS = 420;
/** With battles played faster the Overdrive's band is up for less, but no less than this many times less. */
const CUT_IN_HURRY = 1.5;
/** How near to one another two wrecks count as lying in the same place. */
const WRECK_ROOM = 20;

/** A circle one pixel thick, drawn pixel by pixel so that it keeps to the grid like everything else on the field. */
function drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string): void {
  const r = Math.round(radius);
  ctx.fillStyle = color;
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    for (const [dx, dy] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) {
      ctx.fillRect(Math.round(cx) + dx, Math.round(cy) + dy, 1, 1);
    }
    y += 1;
    if (err < 0) err += 2 * y + 1;
    else { x -= 1; err += 2 * (y - x) + 1; }
  }
}

/** The box a battle's result is in, how tall the letters of its word are at most and at least, and how far down the box their middle is. */
export const RESULT_W = 190;
export const RESULT_TALL = 26;
export const RESULT_SMALL = 20;
export const RESULT_WORD_Y = 25;

export class BattleScreen {
  private timer = 0;
  private clock = 0;
  /** The Overdrive's meter as far as the messages have got: the rules are an action ahead of what has been shown. */
  private shownDrive = 0;
  /** The hired wingman's voice, when one flies along and has things to say. */
  private radio: Radio | null = null;
  private radioOpened = false;
  /** The ring that runs out from a mech as its Overdrive goes off: where it started, and how long ago. */
  private surge: { x: number; y: number; ms: number } | null = null;
  /** The band an Overdrive goes off behind: which one, and how long it has been up. */
  private cutIn: { name: string; ms: number } | null = null;
  /**
   * The last machine of the battle going down, slowly and from close by: what the picture is drawn
   * round, how long it has been by the player's clock and by the field's own, and whether its last
   * blast has been heard.
   */
  private finish: { at: Pt; real: number; field: number; heard: boolean } | null = null;
  /** How long the battle has been over. */
  private resultMs = 0;
  /** How many lights this frame has given to what stands on the field (what flies burns, what is hot glows): the effects get what room is left. */
  private standing = 0;
  /** Where machines went up, and when: what is left of them smokes for the rest of the battle. One to a place. */
  private wrecks: { at: Pt; since: number }[] = [];
  private fx = new BattleFx(this.scene());
  /** What moves each unit's layers: one puppet a unit, made when it is first drawn. */
  private puppets = new Map<string, Puppet>();
  private stances = new ShownStance();
  /** Casings, sparks, wreckage, smoke and dust. */
  private particles: Particles;
  /** The beat the field holds when something is destroyed. */
  private hitStop: HitStop;
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
      /** A new pilot: say over the field which button does what at each step of a turn. */
      coach?: boolean;
      /** The hired wingman and what they say on the radio. */
      radio?: { who: string; lines: Record<RadioCue, string> };
      /** How fast what is said writes itself out. */
      typing?: Typing;
      /** A calm picture: the field does not shake or flash, and the warning does not blink. */
      calm?: boolean;
    },
  ) {
    if (opts.radio) this.radio = new Radio(opts.radio.who, opts.radio.lines);
    this.shownDrive = flow.state.units[0].drive;
    this.particles = new Particles(7, !opts.fast);
    this.hitStop = new HitStop(!opts.fast);
    this.introTotal = opts.fast ? 0 : opts.boss ? WARNING_MS : INTRO_MS;
    this.intro = this.introTotal;
    this.shownAp = new ApDisplay(flow.state.units);
    const enemies = flow.state.units.filter((u) => u.side === 'enemy');
    this.places = enemies.some((u) => u.abilities.carrier)
      ? MAX_ENEMIES : Math.min(MAX_ENEMIES, Math.max(1, ...enemies.map((u) => (u.slot ?? 0) + 1)));
    const unseen = flow.state.events.slice(flow.eventsShown).flatMap((e) => (e.type === 'launch' ? [e.spawned] : []));
    this.arrived = new Set(flow.state.units.map((u) => u.id).filter((id) => !unseen.includes(id)));
  }

  /** True while the last machine of the battle is looked at from close by: the music is turned down for it. */
  get closeLook(): boolean {
    return this.finish !== null;
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

  /** Whether the picture is kept calm, and how written text is written: as the player set them. */
  get calm(): boolean {
    return this.opts.calm === true;
  }

  get pace(): Typing {
    return this.opts.typing ?? PLAIN_TYPING;
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
    // Where it rains, lightning is seen, and its thunder is heard a moment after: on the weather's own
    // clock, whatever pace the battle is played at.
    if (!this.opts.fast && weatherFor(this.opts.background ?? DEFAULT_BACKGROUND) === 'rain' && strokeBegan(this.clock - realMs, this.clock, this.opts.calm === true)) {
      this.opts.sfx?.play('thunder', THUNDER_AFTER_MS, true);
    }
    if (this.intro > 0) {
      if (!this.introHeard) this.opts.sfx?.play(this.opts.boss ? 'warning' : 'banner');
      this.introHeard = true;
      this.intro = Math.max(0, this.intro - realMs);
      return;
    }
    this.spawnEffects();
    if (this.radio) {
      // The wingman reports in as the banner goes; after that they speak when something happens.
      if (!this.radioOpened) { this.radioOpened = true; this.radio.open(); }
      // While somebody is talking the radio waits its turn: the line comes up, and is heard, when they are done.
      if (this.flow.phase !== 'talk') {
        this.radio.update(realMs);
        if (this.radio.takeFresh() > 0) this.opts.sfx?.play('radio');
      }
    }
    // A killing blow holds everything that moves for a few frames.
    // The hold is counted in real time, so it is as long with fast battles on as without.
    // While the last machine goes down everything on the field moves at half its speed.
    const moved = this.hitStop.pass(realMs) * (this.opts.speed ?? 1) * (this.finish ? FINISH_SLOW : 1);
    // The band is there to be read: with battles played faster it is up for less, but never for a blink.
    if (this.cutIn && (this.cutIn.ms += realMs * Math.min(this.opts.speed ?? 1, CUT_IN_HURRY)) >= CUT_IN_MS) this.cutIn = null;
    if (this.finish) {
      // The close look is counted on the field's own clock, so that whatever the pace, the machine's
      // last blast is in it; and that blast is heard at the moment it is seen.
      const before = this.finish.field;
      this.finish.real += realMs;
      this.finish.field += moved;
      if (!this.finish.heard && before < WRECK_AT && this.finish.field >= WRECK_AT) {
        this.finish.heard = true;
        this.opts.sfx?.play('unitDestroyed');
      }
      if (this.finish.field >= FINISH_FIELD_MS) this.finish = null;
    }
    // A battle that is over is not staged any more: whatever was up comes down with the result.
    if (this.flow.phase === 'result') {
      this.resultMs += realMs;
      this.finish = null;
      this.cutIn = null;
    }
    this.fx.update(moved);
    for (const puppet of this.puppets.values()) puppet.update(moved);
    this.particles.update(moved);
    if (this.surge && (this.surge.ms += moved) >= SURGE_MS) this.surge = null;
    this.shownAp.update(dtMs);
    this.updateTalk(realMs);
    const rumble = this.fx.takeRumble();
    if (rumble > 0) this.opts.rumble?.(rumble);
    if (this.flow.phase !== 'animating') this.shownAp.sync(this.flow.state.units);
    if (this.flow.phase !== 'animating') { this.timer = 0; return; }
    // Nothing more is said while the last machine goes down: what comes next waits for it.
    if (!this.finish) this.timer += dtMs;
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
    const typing = this.opts.typing ?? PLAIN_TYPING;
    this.talkWriter = line ? new Typewriter(wrap(line.text, TALK_CHARS).slice(0, TALK_LINES), TYPING_SPEED * typing.factor, this.opts.fast || typing.instant) : null;
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
        // Whatever was left of the machine that stood there before is gone: something else stands there now.
        this.clearWreck(this.wreckSpot(event.spawned));
      }
      this.radio?.hear(event, this.flow.state);
      if (this.opts.fast) continue;
      this.stances.onEvent(event);
      this.fx.onEvent(event);
      // The one the battle ends with is staged, unless a press has already gone on to the result.
      const staged = event.type === 'unitDestroyed' && this.flow.phase === 'animating' && endsBattle(events, this.flow.state.outcome, i);
      this.move(event, melee, flight, staged);
      // The end of a battle is marked once: by the music's fanfare where there is music, by the effect where there is not.
      if (event.type === 'outcome' && this.opts.jingle?.(event.outcome === 'victory')) continue;
      // The blow that ends it is a slam, as the field is held; the machine is heard to go up when it is seen to, in the close look.
      if (staged) { this.opts.sfx?.play('slam'); continue; }
      for (const sound of soundsForEvent(event, dtype, flight)) this.opts.sfx?.play(sound.name, sound.delayMs);
    }
    this.fxDone = shown;
    // With every message shown the screen has caught up with the rules: the stances, and how full the Overdrive's meter is.
    if (shown >= events.length) {
      this.stances.sync(this.flow.state.units);
      this.shownDrive = this.flow.state.units[0].drive;
    }
  }

  /** What the wingman is saying right now, if anything. */
  get radioLine(): string | null {
    return this.radio?.line ?? null;
  }

  /** What is moving on the field right now, for tests: nobody can watch a test run. */
  get motion(): {
    particles: number; flash: number; surge: boolean; stance: (id: string) => Stance; breaking: (id: string) => number | null;
    /** The Overdrive's band, while it is up: what it says. The close look at the last machine, while it lasts: what it is drawn round. */
    cutIn: string | null; finish: Pt | null;
    /** How large each blast is that is going off right now, and where what is left of machines lies. */
    blasts: number[]; wrecks: Pt[];
  } {
    return {
      particles: this.particles.count, flash: this.hitStop.flash, surge: this.surge !== null, stance: (id) => ({ ...this.stances.of(id) }),
      breaking: (id) => this.puppets.get(id)?.breaking ?? null,
      cutIn: this.cutIn?.name ?? null, finish: this.finish ? { ...this.finish.at } : null,
      blasts: this.fx.bursts().filter((burst) => burst.style === 'fire').map((burst) => burst.size), wrecks: this.wrecks.map((wreck) => ({ ...wreck.at })),
    };
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
      // A press goes on to what is next; the close look at the last machine is over with it.
      if (action === 'confirm') { this.timer = 0; this.finish = null; this.flow.advance(); }
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
    const { dx, dy } = this.opts.calm ? { dx: 0, dy: 0 } : this.fx.shake();
    this.syncTalk();
    const field = { top: FIELD_Y, height: PANEL_Y - FIELD_Y, width: LOGICAL_W };
    this.standing = 0;
    // A battle that is over is not staged any more, from the very frame its result is up.
    const over = this.flow.phase === 'result';
    const finish = over ? null : this.finish;
    const cutIn = over ? null : this.cutIn;
    ctx.save();
    // The last machine to fall is looked at from twice as close. A calm picture stays where it is.
    if (finish && !this.opts.calm) lookClose(ctx, finish.at, field);
    ctx.translate(dx, dy);
    // Pixel for pixel while the field is still. Only while a blow moves it is the picture drawn a
    // little larger, so that no edge shows: stretched, a pixel picture loses its grid.
    if (dx === 0 && dy === 0) ctx.drawImage(bg.image, 0, 0, LOGICAL_W, LOGICAL_H);
    else ctx.drawImage(bg.image, -6, -6, LOGICAL_W + 12, LOGICAL_H + 12);
    // What the place adds to its picture: darker edges, its own lights, a haze over the ground. A hurried
    // screen has it standing still, as it is at the first moment.
    const calm = this.opts.calm === true;
    const placeClock = this.opts.fast ? 0 : this.clock;
    drawAmbience(ctx, background, placeClock, 'behind', field, calm);
    this.drawShadows(ctx);
    this.drawPlayer(ctx);
    this.drawEnemies(ctx);
    this.drawHeat(ctx);
    this.drawSmoke(ctx);
    drawAmbience(ctx, background, placeClock, 'front', field, calm);
    if (!this.opts.fast) {
      ctx.save();
      ctx.translate(0, FIELD_Y);
      drawWeather(ctx, weatherFor(background), this.clock, LOGICAL_W, PANEL_Y - FIELD_Y);
      drawWeatherExtras(ctx, weatherFor(background), this.clock, LOGICAL_W, PANEL_Y - FIELD_Y, calm);
      ctx.restore();
    }
    this.particles.draw(ctx);
    this.fx.draw(ctx, calm);
    this.drawSurge(ctx);
    // The light of everything that burns, fires or glows is added over the field: at half strength, and
    // never over the whole of it, in a calm picture. Sixteen lights are the battle's in all, with those
    // of what stands on the field counted first.
    // From close by every light is four times the size: half as many are drawn. And where there is to
    // be less light the sixteen are eight: what stands on the field then counts for two of the sixteen each.
    const weight = lightRoom(MAX_LIGHTS) > 0 ? MAX_LIGHTS / lightRoom(MAX_LIGHTS) : 1;
    if (!this.opts.fast) drawGlows(ctx, this.lights(), calm, (finish && !calm ? MAX_LIGHTS / 2 : MAX_LIGHTS) - this.standing * weight);
    if (this.hitStop.flash > 0 && !this.opts.calm) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.hitStop.flash.toFixed(2)})`;
      ctx.fillRect(0, 14, LOGICAL_W, PANEL_Y - 14);
    }
    ctx.restore();

    // A battle that is over looks like what it was.
    if (this.flow.phase === 'result') {
      if (this.flow.state.outcome === 'victory') drawVictory(ctx, this.resultMs, field, calm, this.opts.fast);
      else drawDefeat(ctx, this.resultMs, field, this.opts.fast);
    }
    this.drawMessage(ctx);
    if (finish) {
      // While the last machine goes down there is nothing over the field but two black bars.
      drawLetterbox(ctx, letterbox(finish.real, finish.field), field);
    } else {
      this.drawObjective(ctx);
      this.drawGround(ctx);
      this.drawDrive(ctx);
      this.drawRadio(ctx);
      if (this.opts.coach && this.intro <= 0) this.drawCoach(ctx);
    }
    if (cutIn) {
      drawCutIn(ctx, cutIn.ms, field, { heading: STRINGS.overdrive.heading, name: cutIn.name },
        (c) => drawMech(c, this.playerSprites(), 0, 0), calm);
    }
    // While someone talks, their words have the panel: there is nothing to choose until they are done.
    const talking = this.flow.phase === 'talk' && this.intro <= 0;
    if (!talking) this.drawBottom(ctx);
    if (this.intro > 0) return this.drawIntro(ctx);
    if (talking) this.drawTalk(ctx);
    if (this.flow.phase === 'result') this.drawResult(ctx);
  }

  /**
   * What the wingman is saying: one small line at the foot of the field, from its left edge, where
   * the longest line still ends short of the bars of the enemy standing lowest. Not over the banner,
   * not while somebody is talking, and not where a new pilot is being told the buttons.
   */
  private drawRadio(ctx: CanvasRenderingContext2D): void {
    const line = this.radio?.line;
    if (!line || this.intro > 0 || this.opts.coach || this.flow.phase === 'talk') return;
    const width = line.length * 4 + 8;
    const y = PANEL_Y - 13;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.8)';
    ctx.fillRect(RADIO_X, y, width, 11);
    // The name in the colour of a friendly voice, what is said in plain white.
    const at = line.indexOf(':') + 1;
    drawText(ctx, line.slice(0, at), RADIO_X + 4, y + 1, { size: 10, color: COLORS.energy });
    drawText(ctx, line.slice(at), RADIO_X + 4 + at * 4, y + 1, { size: 10 });
  }


  /** Two rings running out from the mech whose Overdrive has just gone off, fading as they go. */
  private drawSurge(ctx: CanvasRenderingContext2D): void {
    if (!this.surge) return;
    const t = this.surge.ms / SURGE_MS;
    drawRing(ctx, this.surge.x, this.surge.y, 8 + t * 54, `rgba(255, 93, 177, ${(1 - t).toFixed(2)})`);
    drawRing(ctx, this.surge.x, this.surge.y, 4 + t * 34, `rgba(255, 255, 255, ${(0.8 * (1 - t)).toFixed(2)})`);
  }

  /**
   * The Overdrive's meter: a thin column at the left edge of the field that fills from the bottom,
   * as far as the messages have got. The button that sets it off is named in the message bar; see `drawMessage`.
   */
  private drawDrive(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (!player.overdrive || this.intro > 0 || player.destroyed) return;
    const top = FIELD_Y + 18;
    const height = PANEL_Y - 6 - top;
    const drive = Math.min(DRIVE_MAX, this.shownDrive);
    const filled = Math.round((height * drive) / DRIVE_MAX);
    const full = drive >= DRIVE_MAX;
    const lit = full && (this.opts.fast || Math.floor(this.clock / 260) % 2 === 0);
    ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
    ctx.fillRect(1, top - 1, 5, height + 2);
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(2, top, 3, height);
    ctx.fillStyle = full ? (lit ? '#ffffff' : COLORS.accent) : COLORS.accent;
    ctx.fillRect(2, top + height - filled, 3, filled);
  }

  /** The ground's rule, small, in the top right corner of the field: its name, so the briefing's line is not forgotten. */
  private drawGround(ctx: CanvasRenderingContext2D): void {
    const ground = this.flow.state.ground;
    if (!ground || this.intro > 0) return;
    const name = STRINGS.ground[ground.id].name;
    const width = name.length * 4 + 6;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
    ctx.fillRect(LOGICAL_W - width, 14, width, 10);
    drawText(ctx, name, LOGICAL_W - 3, 14, { align: 'right', size: 10, color: COLORS.energy });
  }

  /** For a new pilot: one small line at the foot of the field saying which button does what right now. */
  private drawCoach(ctx: CanvasRenderingContext2D): void {
    const line = (STRINGS.coach as Record<string, string>)[this.flow.phase];
    if (!line) return;
    const width = line.length * 4 + 8;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.8)';
    ctx.fillRect(Math.round(LOGICAL_W / 2 - width / 2), PANEL_Y - 13, width, 11);
    drawText(ctx, line, LOGICAL_W / 2, PANEL_Y - 12, { align: 'center', size: 10, color: COLORS.heat });
  }

  /** The banner that opens a battle: the contract and what it asks for, or a warning with the name of a boss. */
  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const p = 1 - this.intro / this.introTotal;
    const boss = this.opts.boss;
    if (boss) {
      // A boss comes in on a band of its own, from its side of the field: the warning, its name, and itself from close by.
      const alarm = this.opts.calm === true || Math.floor(this.clock / 180) % 2 === 0;
      drawEntrance(ctx, p, this.clock, { top: FIELD_Y, height: PANEL_Y - FIELD_Y, width: LOGICAL_W },
        { warning: STRINGS.battleIntro.warning, name: boss.toUpperCase(), alarm }, this.entrant(boss), this.opts.calm === true);
      return;
    }
    // It slides in from the left, holds, and leaves to the right.
    const x = Math.round(LOGICAL_W * (Math.min(1, p / 0.16) - 1 + Math.max(0, (p - 0.88) / 0.12)));
    const h = 46;
    const y = 62;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.92)';
    ctx.fillRect(x, y, LOGICAL_W, h);
    const edge = COLORS.accent;
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, LOGICAL_W, 1);
    ctx.fillRect(x, y + h - 1, LOGICAL_W, 1);
    const title = this.opts.title ?? this.opts.label ?? '';
    drawText(ctx, title, x + LOGICAL_W / 2, y + 7, { size: 16, align: 'center', color: COLORS.accent });
    drawText(ctx, this.instruction(), x + LOGICAL_W / 2, y + 27, { align: 'center', color: COLORS.heat });
  }

  /**
   * The boss as its band shows it: the machine of that name on the field, looked at where its eye
   * is. A frame built from parts like the pilot's own is looked at where its head is, and has no
   * eye that is known. Null where there is no such machine: the band then has its words and
   * nothing else.
   */
  private entrant(name: string): Entrant | null {
    const unit = this.flow.state.units.find((u) => u.side === 'enemy' && u.name === name);
    if (!unit) return null;
    if (this.duel()) {
      const parts = mechSprites(this.sprites, unit.build, unit.paint);
      // Turned round in its own box, as it stands on the field: it faces left.
      return {
        draw: (c) => { c.translate(MECH_BOX, 0); c.scale(-1, 1); drawMech(c, parts, 0, 0); },
        focus: { x: MECH_BOX - MECH_HEAD.x, y: MECH_HEAD.y }, eye: null,
      };
    }
    const r = this.enemyRect(unit);
    const eye = eyeOf(unit.sprite ?? unit.id);
    return {
      draw: (c) => c.drawImage(r.sprite.image, 0, 0, r.w, r.h),
      focus: eye ?? { x: r.w / 2, y: Math.min(r.h / 2, 24) }, eye: eye && { r: eye.r, color: eye.color },
    };
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
  /** The ground under every unit is darker: it is what makes them stand on it. */
  private drawShadows(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (!this.hidden(player)) drawShadow(ctx, this.playerX() + 76, PANEL_Y - 7, 108, 13, 0.5);
    for (const enemy of this.flow.state.units.slice(1)) {
      if (this.hidden(enemy)) continue;
      const r = this.enemyRect(enemy);
      drawShadow(ctx, r.x + r.w / 2, Math.min(PANEL_Y - 5, r.y + r.h - 1), r.w * 0.9, Math.max(5, r.w * 0.16), 0.45);
    }
  }

  /** A machine close to its heat limit glows from inside, and the air over it wavers. */
  private drawHeat(ctx: CanvasRenderingContext2D): void {
    if (this.opts.fast) return;
    const scene = this.scene();
    for (const unit of this.flow.state.units) {
      if (unit.destroyed || this.hidden(unit) || unit.heat < HEAT_LIMIT * HOT) continue;
      const at = scene.hitPoint(unit.id, 'core');
      const over = Math.min(1, (unit.heat / HEAT_LIMIT - HOT) / (1 - HOT));
      this.standing++;
      drawGlow(ctx, { x: at.x, y: at.y, r: 30, color: '#ff5a20', alpha: (0.16 + 0.16 * over) * (0.8 + 0.2 * Math.sin(this.clock / 140)) }, this.opts.calm ? 0.5 : 1);
      // Wisps of hot air rising off it.
      for (let i = 0; i < 4; i++) {
        const age = (this.clock / 1300 + i / 4) % 1;
        ctx.globalAlpha = 0.28 * (1 - age);
        ctx.fillStyle = i % 2 ? '#ffb070' : '#ffe0b0';
        ctx.fillRect(Math.round(at.x - 14 + i * 9 + Math.sin(age * 9 + i) * 2), Math.round(at.y - 22 - age * 26), 1, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Where what is left of this unit lies, or would lie: a little under its middle, and on the ground. */
  private wreckSpot(unit: string): Pt {
    const c = this.scene().centre(unit);
    return { x: c.x, y: Math.min(PANEL_Y - 14, c.y + 10) };
  }

  /**
   * What is left of a machine stays where it went up. A place holds one wreck: a machine that falls
   * where another fell before takes its place. The field has only so many places, so there are
   * never more wrecks than that.
   */
  private leaveWreck(at: Pt): void {
    this.clearWreck(at);
    this.wrecks.push({ at, since: this.clock + 500 });
  }

  /** Takes away what is left of a machine at this spot: something else is standing there now. */
  private clearWreck(at: Pt): void {
    this.wrecks = this.wrecks.filter((wreck) => Math.hypot(wreck.at.x - at.x, wreck.at.y - at.y) > WRECK_ROOM);
  }

  /** Every light of this moment: what the effects throw, what glows in the air, and the fires in the wrecks. */
  private lights(): Glow[] {
    const embers = this.wrecks.map(({ at, since }) => {
      const age = this.clock - since;
      // A wreck burns bright at first and smoulders after; its light breathes a little.
      const burn = Math.max(0.12, 0.55 - age / 6000);
      return { x: at.x, y: at.y + 6, r: 26, color: '#ff7a30', alpha: burn * (0.8 + 0.2 * Math.sin(this.clock / 170 + at.x)) };
    });
    return [...this.fx.lights(), ...this.particles.lights(), ...embers];
  }

  private drawSmoke(ctx: CanvasRenderingContext2D): void {
    if (this.opts.fast) return;
    const scene = this.scene();
    // What is left of a machine smokes where it went up: wider and darker than a wound, and for as long as the battle lasts.
    for (const { at, since } of this.wrecks) {
      for (let i = 0; i < 5; i++) {
        const age = ((this.clock - since) / 2100 + i / 5) % 1;
        if (this.clock - since < age * 2100) continue;
        ctx.globalAlpha = 0.5 * (1 - age);
        disc(ctx, at.x + Math.sin(age * 5 + i * 1.7) * 5, at.y + 4 - age * 46, 2 + age * 7, i % 2 ? '#3a3644' : '#4a4654');
      }
      ctx.globalAlpha = 1;
    }
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

  /** The puppet of a unit. A mech built from layers breathes; a machine that is one picture only reacts. */
  private puppet(unit: UnitState): Puppet {
    let puppet = this.puppets.get(unit.id);
    if (!puppet) {
      // Only a mech drawn from its parts breathes: in a group an enemy mech is one picture like the rest.
      const layered = unit.side === 'player' || (unit.composed && this.duel());
      puppet = new Puppet(this.flow.state.units.indexOf(unit) * 2.1, !this.opts.fast, layered);
      this.puppets.set(unit.id, puppet);
    }
    return puppet;
  }

  /** How a unit's layers are shifted right now. */
  private poseOf(unit: UnitState): Pose {
    return this.puppet(unit).pose(this.stances.of(unit.id), this.clock);
  }

  /**
   * Sets the units an event is about in motion: the one that fires kicks, the one that is hit
   * flinches. Only a game that is not hurried comes here: a hurried one has no effects at all.
   */
  private move(event: BattleEvent, melee: boolean, flight: number, staged = false): void {
    const unit = (id: string): UnitState | undefined => this.flow.state.units.find((u) => u.id === id);
    const scene = this.scene();
    const ground = PANEL_Y - 6;
    if (event.type === 'shot') {
      const dtype = scene.damageType(event.unit, event.weapon);
      // A gun that fires bullets throws a casing; whatever lands throws sparks in its own colour.
      if (!melee && dtype === 'kinetic') this.particles.emit('casing', scene.muzzle(event.unit, event.weapon), scene.facing(event.unit), 0, ground);
      if (event.hit) {
        const at = scene.hitPoint(event.target, event.appliedTo);
        this.particles.emit('sparks', at, scene.facing(event.unit), flight, undefined, { kinetic: '#ffe9a8', energy: '#7fe9ff', explosive: '#ffb46b' }[dtype]);
        if (dtype === 'explosive') {
          this.particles.emit('fire', at, 1, flight);
          this.particles.emit('smoke', at, 1, flight + 60);
        }
      }
    }
    if (event.type === 'boost') {
      const c = scene.centre(event.unit);
      this.particles.emit('dust', { x: c.x, y: ground }, scene.facing(event.unit));
    }
    if (event.type === 'partDestroyed') {
      const at = scene.hitPoint(event.unit, event.part);
      this.particles.emit('debris', at, 1, 0, ground);
      this.particles.emit('fire', at, 1);
      this.particles.emit('smoke', at, 1, 80);
    }
    if (event.type === 'overdrive') {
      // The field holds its breath, the mech surges, and sparks come off it.
      this.hitStop.strike(140);
      const c = scene.centre(event.unit);
      this.particles.emit('embers', c, 1);
      this.particles.emit('sparks', c, 1, 60, undefined, '#ff5db1');
      this.surge = { x: c.x, y: c.y, ms: 0 };
      this.cutIn = { name: STRINGS.overdrive.names[event.kind].toUpperCase(), ms: 0 };
      this.opts.rumble?.(120);
      const who = unit(event.unit);
      if (who) this.puppet(who).play('boost');
    }
    if (event.type === 'unitDestroyed') {
      this.hitStop.strike(staged ? FINISH_HOLD_MS : event.unit === 'player' ? 160 : 90);
      const c = scene.centre(event.unit);
      if (staged) {
        // The field is held, then looked at from close by while the machine goes up slowly.
        this.finish = { at: focusOn(c, { top: FIELD_Y, height: PANEL_Y - FIELD_Y, width: LOGICAL_W }), real: 0, field: 0, heard: false };
      }
      this.particles.emit('debris', c, 1, 60, ground);
      this.particles.emit('debris', c, 1, 180, ground);
      this.particles.emit('fire', c, 1);
      this.particles.emit('embers', c, 1, 60);
      this.particles.emit('smoke', c, 1, 120);
      // The last blast throws the most, and what is left smokes from then on.
      this.particles.emit('debris', c, 1, 300, ground);
      this.particles.emit('fire', c, 1, 300);
      this.particles.emit('embers', c, 1, 320);
      this.particles.emit('smoke', c, 1, 380);
      if (event.unit !== 'player') this.leaveWreck(this.wreckSpot(event.unit));
    }
    if (event.type === 'blast') {
      // A bomb's flash and bursts come a beat after its message, and so does everything it throws up.
      const c = scene.centre(event.target);
      this.particles.emit('fire', c, 1, MELEE_MS);
      this.particles.emit('embers', c, 1, MELEE_MS);
      this.particles.emit('debris', c, 1, MELEE_MS + 40, ground);
      this.particles.emit('smoke', c, 1, MELEE_MS + 100);
    }
    if (event.type === 'shot') {
      const shooter = unit(event.unit);
      const kick = melee ? 'strike' : event.weapon === 'rightHand' ? 'fireNear' : event.weapon === 'leftHand' ? 'fireFar' : 'fireShoulder';
      if (shooter) this.puppet(shooter).play(kick);
      const target = unit(event.target);
      if (event.hit && target) this.puppet(target).play('hit', flight);
    } else if (event.type === 'boost') {
      const who = unit(event.unit);
      if (who) this.puppet(who).play('boost');
    } else if (event.type === 'blast' || event.type === 'support') {
      const target = unit(event.target);
      if (target) this.puppet(target).play('hit', event.type === 'blast' ? MELEE_MS : flight);
    } else if (event.type === 'unitDestroyed') {
      const who = unit(event.unit);
      if (who) this.puppet(who).play('destroyed');
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
    // A unit that lunges leaves two after-images behind it, the further the fainter.
    if (t.trail !== 0 && !this.opts.fast) {
      for (const k of [2, 1]) {
        ctx.globalAlpha = t.alpha * (k === 1 ? 0.3 : 0.14);
        draw(t.dx - t.trail * k, t.dy + (unit.destroyed ? 0 : idleDy));
      }
    }
    ctx.globalAlpha = t.alpha;
    // A unit that is hit lights up: hard as a rule, gently in a calm picture.
    // One that fires is lit by its own gun for a moment, though not in a calm picture.
    ctx.filter = t.flash ? (this.opts.calm ? 'brightness(1.4)' : 'brightness(2.6)') : t.glare && !this.opts.calm ? 'brightness(1.35)' : 'none';
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
    // Its layers move by themselves: breathing, kicking back, flinching, coming apart.
    const pose = this.poseOf(player);
    this.withTransform(ctx, player, 0, (dx, dy) =>
      drawMech(ctx, this.playerSprites(), this.playerX(), MECH_ORIGIN.y, { dx, dy: 0 }, dy, pose));
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
      // What flies burns underneath to stay up.
      if (flies && !this.opts.fast && !this.duel()) {
        this.standing++;
        drawGlow(ctx, { x: r.x + r.w / 2, y: r.y + r.h - 4 + hover, r: 9 + r.w * 0.22, color: '#ff7ab8', alpha: 0.3 + 0.1 * Math.sin(this.clock / 90 + i) }, this.opts.calm ? 0.5 : 1);
      }
      if (this.duel()) {
        const parts = mechSprites(this.sprites, enemy.build, enemy.paint);
        const pose = this.poseOf(enemy);
        this.withTransform(ctx, enemy, 0, (dx, dy) => {
          // Mirror the pose box so the mech faces left; a shift to the right is a shift to the left in there.
          ctx.save();
          ctx.translate(DUEL_RIGHT, MECH_ORIGIN.y);
          ctx.scale(-1, 1);
          drawMech(ctx, parts, 0, 0, { dx: -dx, dy: 0 }, dy, pose);
          ctx.restore();
        });
      } else {
        // A machine that is one picture moves as a whole, the way its body would: it faces left, so forward is left.
        const body = this.poseOf(enemy).core ?? { dx: 0, dy: 0 };
        const breaking = this.puppet(enemy).breaking;
        this.withTransform(ctx, enemy, hover, (dx, dy) => {
          if (breaking === null) return ctx.drawImage(r.sprite.image, r.x + dx - body.dx, r.y + dy + body.dy, r.w, r.h);
          // Destroyed, it comes apart in four quarters cut from its own picture.
          const image = r.sprite.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
          const iw = (image.naturalWidth || image.width || r.w) / 2;
          const ih = (image.naturalHeight || image.height || r.h) / 2;
          const w = Math.ceil(r.w / 2);
          const h = Math.ceil(r.h / 2);
          shatter(breaking).forEach((o, i) => {
            const col = i % 2;
            const row = i < 2 ? 0 : 1;
            ctx.drawImage(r.sprite.image, col * iw, row * ih, iw, ih, r.x + col * (r.w - w) + o.dx, r.y + row * (r.h - h) + o.dy, w, h);
          });
        });
        // A machine that stands looks back: a small light on its eye, that moves as it moves. It goes out
        // in the frame the machine is seen to come apart, not sooner: a shot that will end it is still in
        // the air. Not in a hurried game. It is one of the battle's sixteen lights.
        if (!this.opts.fast && breaking === null) {
          const t = this.fx.transform(enemy.id);
          const dazed = enemy.staggered > 0 || enemy.overheated;
          const eye = eyeLight(enemy.sprite ?? enemy.id, r.x + t.dx - body.dx, r.y + t.dy + hover + body.dy, this.clock, i, dazed ? 'dazed' : 'awake', this.opts.calm === true);
          if (eye) {
            this.standing++;
            drawGlow(ctx, eye, this.opts.calm ? 0.5 : 1);
          }
        }
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
      if (mark) {
        // Above the unit, unless that is where the bars of one standing higher up are: then on the unit, on a dark ground.
        const others = enemies.filter((other) => other !== enemy && !other.destroyed).map((other) => this.enemyRect(other));
        const width = mark.text.length * 4;
        const at = markPosition(r, others, width);
        if (at.inside) {
          ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
          ctx.fillRect(at.x - width / 2 - 2, at.y - 1, width + 4, 10);
        }
        drawText(ctx, mark.text, at.x, at.y, { align: 'center', size: 10, color: mark.color });
      }
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
    // An elite is known by its mark whenever there is nothing more pressing to say about it. Cover
    // lasts as long as the drone that gives it, so an elite under cover says both in turn: neither
    // hides the other for the whole battle.
    const marked = !!unit.mark && Math.floor(this.clock / MARK_TURN_MS) % 2 === 0;
    if (aegisFactor(this.flow.state, unit) < 1 && !marked) return { text: T.covered, color: COLORS.energy };
    if (unit.mark) return { text: T.marks[unit.mark], color: COLORS.accent };
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
    const intent = intentText(intentOf(state, unit, this.catalog));
    return [
      ...(unit.fuse !== undefined ? [{ text: T.fuse(unit.fuse), color: COLORS.danger, rank: 9 }] : []),
      ...(unit.abilities.aegis !== undefined ? [{ text: T.aegis, color: COLORS.energy, rank: 2 }] : []),
      ...(unit.abilities.jam !== undefined ? [{ text: T.jammer, color: COLORS.heat, rank: 2 }] : []),
      ...(unit.abilities.mend !== undefined ? [{ text: T.mender, color: COLORS.armor, rank: 2 }] : []),
      ...(unit.abilities.carrier ? [{ text: T.carrier, color: COLORS.heat, rank: 2 }] : []),
      ...(unit.mark ? [{ text: T.marks[unit.mark], color: COLORS.accent, rank: 4 }] : []),
      ...(aegisFactor(state, unit) < 1 ? [{ text: T.covered, color: COLORS.energy, rank: 4 }] : []),
      ...(jammed > 0 ? [{ text: T.jammed(jammed), color: COLORS.heat, rank: 5 }] : []),
      ...(unit.boosted ? [{ text: T.boost, color: COLORS.energy, rank: 5 }] : []),
      ...(unit.guarding ? [{ text: T.guard, color: COLORS.armor, rank: 6 }] : []),
      ...(unit.charged.length > 0 ? [{ text: unit.side === 'player' ? T.charged : T.charging, color: COLORS.heat, rank: 8 }] : []),
      ...(unit.barrier > 0 ? [{ text: T.barrier(unit.barrier), color: COLORS.energy, rank: 7 }] : []),
      // An Overdrive that lasts says so for as long as it does.
      ...(unit.ironSkin ? [{ text: T.ironSkin, color: COLORS.accent, rank: 8 }] : []),
      ...(unit.deadeye ? [{ text: T.deadeye, color: COLORS.accent, rank: 8 }] : []),
      ...(unit.painted > 0 ? [{ text: T.painted, color: COLORS.danger, rank: 3 }] : []),
      ...(unit.chaff > 0 ? [{ text: T.chaff, color: COLORS.dim, rank: 3 }] : []),
      // What an enemy is lining up to do comes last in the row, and is the first to make way: everything
      // else in the row is said nowhere else.
      ...(intent ? [{ text: intent, color: COLORS.danger, rank: 1 }] : []),
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
    const message = this.flow.phase !== 'result' ? this.flow.message : '';
    // While R1 would set off the Overdrive, the bar says so at its right end: only on the pilot's own
    // menu, where R1 does nothing else. It blinks when the press would count, and stands dim while a
    // Second Wind is still waiting for something of the turn to be spent.
    const drive = this.intro <= 0 ? this.flow.overdrive : null;
    if (drive && labelFits(message, STRINGS.overdrive.ready)) {
      const lit = this.opts.fast || Math.floor(this.clock / 260) % 2 === 0;
      drawText(ctx, STRINGS.overdrive.ready, LOGICAL_W - 5, 1, { align: 'right', color: drive === 'wait' ? COLORS.dim : lit ? '#ffffff' : COLORS.accent });
      return;
    }
    // Which battle of the contract this is makes way for a message that needs the room.
    if (this.opts.label && labelFits(message, this.opts.label)) drawText(ctx, this.opts.label, LOGICAL_W - 5, 1, { align: 'right', color: COLORS.dim });
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
      if (selected) {
        // A weapon takes two lines, and the light is behind both.
        drawRowLight(ctx, x - 3, top + 1, MENU_W - 8, 2 * LINE - 1);
        drawText(ctx, '>', x, top, { color: COLORS.accent });
      }
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
    const w = RESULT_W;
    const h = note ? 72 : 60;
    const x = (LOGICAL_W - w) / 2;
    const y = 30;
    drawPanel(ctx, x, y, w, h);
    const won = this.flow.state.outcome === 'victory';
    const word = this.flow.message;
    // The word in the sign's letters: the game's colour for a battle won, red for one lost. Both of a
    // language's words are written at the height the longer of them fits at, so neither looks the lesser.
    const fits = [STRINGS.victory, STRINGS.defeat, word].map((text) => fitTall(text, w - 16, RESULT_TALL, RESULT_SMALL));
    const tall = fits.includes(null) ? null : Math.min(...(fits as number[]));
    if (tall === null) drawText(ctx, word, LOGICAL_W / 2, y + 8, { size: 32, align: 'center', color: won ? COLORS.accent : COLORS.danger });
    else {
      // It comes on like a tube, and lit it throws a little of its colour on the box it is in.
      const calm = this.opts.calm === true;
      const level = this.opts.fast ? 1 : wordLevel(this.resultMs, calm);
      const metal = won ? 'neon' : 'red';
      drawLights(ctx, wordLights(word, LOGICAL_W / 2, y + RESULT_WORD_Y, tall, metal, level), calm ? 0.5 : 1);
      drawWord(ctx, word, LOGICAL_W / 2, wordTop(y + RESULT_WORD_Y, tall), { tall, metal, level });
    }
    if (note) drawText(ctx, note, LOGICAL_W / 2, y + 40, { align: 'center' });
    drawText(ctx, this.opts.resultHint ?? STRINGS.hints.result, LOGICAL_W / 2, y + h - 18, { align: 'center', color: COLORS.dim });
  }
}
