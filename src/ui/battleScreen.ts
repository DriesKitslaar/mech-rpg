import {
  aegisFactor, coolCost, boostCost, fieldOf, guardCost, jamOn, objectiveTarget, turnEnergyOf, HEAT_LIMIT, MAX_ENEMIES, type BattleEvent, type UnitState, DRIVE_MAX,
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
import { BattleFx, FREIGHT, HARDEST_JOLT, HIT_MS, MELEE_MS, PROJECTILE_MS, WRECK_AT, flightFor, type Scene } from './battleFx';
import { Camera, applyView, atHome, seenBy, type View } from './camera';
import { MECH_BOX, VIEWS, dropOf, fistOf, hitOn, muzzleOf, type MechView } from './mechLayout';
import { HitStop } from './hitStop';
import { eyeLight, eyeOf } from './eyes';
import { MAX_LIGHTS, chosenLights, disc, drawAll, drawGlow, drawGlows, drawShadow, lightRoom, type Glow, type Pt } from './light';
import { drawWord, fitTall, wordLevel, wordLights, wordTop } from './signType';
import {
  CUT_IN_MS, FINISH_FIELD_MS, FINISH_HOLD_MS, FINISH_SLOW, FINISH_ZOOM, MECH_HEAD, drawCutIn, drawDefeat, drawEntrance, drawLetterbox, drawVictory, endsBattle, focusOn, letterbox,
  type Entrant,
} from './cinema';
import { drawMech, layMech, mechSprites, type MechSprites } from './mechView';
import { Particles } from './particles';
import { Puppet, ShownStance, shatter, type Pose, type Stance } from './pose';
import type { Sprite, SpriteStore } from './sprites';
import {
  ENEMY_LEFT, ENEMY_RIGHT, FAR_LINE, FIELD, FIELD_Y, FLYERS, HERO, HERO_FEET, NEAR_LINE, PANEL_Y, SMALL_MIDDLE, depthOf, duelAt, enemySpots, farToNear, horizonOf, pictureTop,
  freightAt, freightSpot, placeBars,
  placeFor, standAt, type Place, type Spot,
} from './stage';
import { fitTags, intentText, labelFits, markPosition, tagWidth, type Tag } from './tags';
import { looming } from '../core/ai';
import { intentOf } from '../core/intent';
import { PLAIN_TYPING, TYPING_SPEED, Typewriter, type Typing } from './typewriter';
import { THUNDER_AFTER_MS, drawWeather, drawWeatherExtras, strokeBegan, weatherFor } from './weather';
import { CHAR_W, COLORS, LINE, charsFor, drawMeter, drawPanel, drawPortrait, drawRowLight, drawScrollMenu, drawText, wrap } from './widgets';

export { BattleFlow } from './battleFlow';
export type { BattlePhase, FlowOptions, MenuView } from './battleFlow';

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
/** The share of the heat limit from which a machine is seen to be hot. */
const HOT = 0.75;
const DEFAULT_BACKGROUND = 'bg-neon-district';
const MENU_W = 154;
/** The letters that fit under a weapon's name in the list of weapons: its row is written small, from a little way in. */
export const WEAPON_NOTE_CHARS = Math.floor((MENU_W - 6 - 14 - 6) / 4);
/**
 * Where the middle of the pilot's mech is, inside its pose box from behind; and of a mech built
 * from parts that is fought alone, inside its small box as it is drawn from the front. Where a hit
 * on each part lands is the layout's to say (`hitOn`): it is a spot on that part's own picture.
 */
const HERO_MIDDLE: Pt = { x: 58, y: 62 };
const DUEL_MIDDLE: Pt = { x: SMALL_MIDDLE, y: 46 };
/** The middle of the floor the enemies stand on: what the pilot's mech looks at across the floor. */
const ACROSS: Pt = { x: (ENEMY_LEFT + ENEMY_RIGHT) / 2, y: (FAR_LINE + NEAR_LINE) / 2 };
/** The generator's light on the back of the pilot's mech: where it is in the pose box from behind, how large and how bright it is at rest, and how bright while the mech is dazed. */
export const GENERATOR = { x: 58, y: 37, r: 10, color: '#ffb060', alpha: 0.2, dazed: 0.06 };
/** How many times as bright as it is a unit is drawn: when it is hit, when it is hit in a calm picture, and while its own gun lights it. */
export const BRIGHT = { hit: 2.6, calm: 1.4, glare: 1.35 };
/** What is fought over burns from here down: this share of what it could take, as one over it. A third. */
export const FREIGHT_BURNS = 3;
/** How far the camera pushes in on what happens: a bullet or a beam that lands, a shell, a blade, a machine going up, an Overdrive going off. */
export const PUSH = { shot: 0.06, shell: 0.09, blade: 0.12, wreck: 0.12, surge: 0.08 };
/** Where the strip the wingman's line is written on starts, and how far under the top of the field it and the new pilot's line are. */
const RADIO_X = 8;
const STRIP_Y = FIELD_Y + 13;
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

/** How far a place's picture is drawn out beyond its edges while the field is thrown: a pixel further than the hardest blow throws it. */
export const EDGE = HARDEST_JOLT + 1;

/** How a mech that is drawn from its parts is put on the canvas: `drawMech`, layer by layer, or `layMech`, whole. */
type MechPainter = typeof drawMech;

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
  /** What is known of the picture the battle is fought in front of: the band of it the field shows, and where its floor begins. */
  private place: Place;
  /** What the field is looked at through: it comes down the picture as the battle opens, and pushes in when a blow lands. */
  private camera: Camera;
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
      /** The pilot as the banner names them, once the record has earned them a name: the callsign and the name. */
      pilot?: string;
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
    this.place = placeFor(opts.background ?? DEFAULT_BACKGROUND);
    // A calm picture has it standing at home. A hurried game never asks it to move: nothing is staged there, no banner and no blow.
    this.camera = new Camera(this.place, opts.calm !== true);
    this.shownAp = new ApDisplay(flow.state.units);
    const enemies = flow.state.units.filter((u) => u.side === 'enemy');
    // Where machines can join, from a carrier or from a reserve, every place of the field is kept for them.
    this.places = enemies.some((u) => u.abilities.carrier) || flow.state.reserve.length > 0
      ? MAX_ENEMIES : Math.min(MAX_ENEMIES, Math.max(1, ...enemies.map((u) => (u.slot ?? 0) + 1)));
    // (A machine of the reserve comes on as a later round begins: by then the screen is there to show it.)
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
    this.pass(realMs);
    this.endStaging();
  }

  /**
   * A battle that is over is not staged any more: the band of an Overdrive and whatever push was
   * going on or still to come are over the moment its result is up. This is seen to after every
   * press and every step of time, either of which can bring the result up, so that nothing that
   * draws the battle or reports on it has to ask whether it is over. (The close look at the last
   * machine is over before a result can come up: a press ends it, and while it lasts nothing goes
   * on to what is next.)
   */
  private endStaging(): void {
    if (this.flow.phase !== 'result') return;
    this.cutIn = null;
    this.camera.settle();
  }

  private pass(realMs: number): void {
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
    if (this.flow.phase === 'result') this.resultMs += realMs;
    this.fx.update(moved);
    this.camera.update(moved);
    for (const puppet of this.puppets.values()) puppet.update(moved);
    this.particles.update(moved);
    if (this.surge && (this.surge.ms += moved) >= SURGE_MS) this.surge = null;
    this.shownAp.update(dtMs);
    this.updateTalk(realMs);
    const rumble = this.fx.takeRumble();
    if (rumble > 0) this.opts.rumble?.(rumble);
    if (this.flow.phase !== 'animating') this.shownAp.sync(this.flow.state.units);
    if (this.flow.phase !== 'animating') { this.timer = 0; return; }
    // Nothing more is said while the last machine goes down: what comes next waits for it. And what comes after the
    // loss of what was fought over is the end of the battle: it waits until that has been seen to go up.
    if (!this.finish) this.timer += dtMs;
    if (this.opts.fast || (this.timer >= MESSAGE_MS && !this.freightGoing())) {
      this.timer = 0;
      this.flow.advance();
      // A line of talk may have come up with that step: it gets its writer before anything is drawn.
      this.syncTalk();
      // What a kill gave back is said as the turn is handed back: its word and its sound begin with the menu, in
      // this frame and not the next, and what the screen shows of each machine has caught up with the rules by then.
      if (this.handedBack()) this.spawnEffects();
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

  /** True while the pilot has the menu. (Asked through a method: a step of the flow changes its phase behind the type checker's back.) */
  private handedBack(): boolean {
    return this.flow.phase === 'action';
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
      if (event.type === 'launch' || event.type === 'arrive') {
        const joined = event.type === 'launch' ? event.spawned : event.unit;
        this.shownAp.adopt(this.flow.state.units);
        this.arrived.add(joined);
        // Whatever was left of the machine that stood there before is gone: something else stands there now.
        this.clearWreck(this.wreckSpot(joined));
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
      // A weapon that a first kill readied for nothing (its last round went with it, or nothing is left to fire at)
      // is not heard to be ready. From the second kill on what is heard is the run, which is real whatever the weapon.
      if (event.type === 'momentum' && event.chain < 2 && this.flow.readiedForNothing(i)) continue;
      for (const sound of soundsForEvent(event, dtype, flight)) this.opts.sfx?.play(sound.name, sound.delayMs);
    }
    this.fxDone = shown;
    // With every message shown the screen has caught up with the rules: the stances, and how full the Overdrive's meter is.
    if (shown >= events.length) {
      this.stances.sync(this.flow.state.units);
      this.shownDrive = this.flow.state.units[0].drive;
    }
  }

  /** What is written over a unit of the other side at this moment: the one state worth flagging, if there is one. */
  markOver(unitId: string): string | null {
    const unit = this.flow.state.units.find((u) => u.id === unitId);
    return unit && !unit.destroyed ? this.fieldMark(unit)?.text ?? null : null;
  }

  /** The words rising over the field at this moment: figures, and what a weapon's kind or a great hit is called. */
  get words(): string[] {
    return this.fx.texts();
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
    /** Where the camera is: the point of the stage in the middle of the field, and how many times its size the stage is shown at. */
    view: View;
    /**
     * Where things are on the field: where a unit's weapon fires from, where a hit on a part of it lands, its middle, the
     * line of the floor under it, how far off it is (0 near, 1 far) and which way it looks at the other side.
     */
    at: {
      muzzle: (id: string, weapon: 'rightHand' | 'leftHand' | 'shoulder') => Pt; hit: (id: string, part: FrameSlot) => Pt; centre: (id: string) => Pt;
      floor: (id: string) => number; depth: (id: string) => number; heading: (id: string) => Pt; foot: (id: string) => Pt;
    };
  } {
    const scene = this.scene();
    return {
      view: this.view(),
      at: {
        muzzle: (id, weapon) => scene.muzzle(id, weapon), hit: (id, part) => scene.hitPoint(id, part), centre: (id) => scene.centre(id), floor: (id) => this.floorUnder(id),
        depth: (id) => scene.depth!(id), heading: (id) => scene.heading!(id), foot: (id) => scene.foot!(id),
      },
      particles: this.particles.count, flash: this.hitStop.flash, surge: this.surge !== null, stance: (id) => ({ ...this.stances.of(id) }),
      breaking: (id) => this.puppets.get(id)?.breaking ?? null,
      cutIn: this.cutIn?.name ?? null, finish: this.finish ? { ...this.finish.at } : null,
      blasts: this.fx.bursts().filter((burst) => burst.style === 'fire').map((burst) => burst.size), wrecks: this.wrecks.map((wreck) => ({ ...wreck.at })),
    };
  }

  onInput(action: InputAction): void {
    this.press(action);
    this.endStaging();
  }

  private press(action: InputAction): void {
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

    // The field, which a heavy blow shakes as a whole, the picture behind it with it.
    const { dx, dy } = this.opts.calm ? { dx: 0, dy: 0 } : this.fx.shake();
    this.syncTalk();
    const field = FIELD;
    // The band of the picture the field shows: its floor begins about half way down.
    const top = pictureTop(this.place);
    this.standing = 0;
    const { finish, cutIn } = this;
    // Where the camera is: on its way down the picture while the banner is up, pushed in towards a blow, at home, or
    // looking at the last machine to fall from twice as close. A calm picture stays where it is.
    const view = this.view();
    const close = !!finish && !this.opts.calm;
    // The part of the stage that is in view, where that is not the field itself. From close by the field is drawn as
    // it stands, only larger: its darker edges and its lights are the field's own.
    const seen = close || atHome(view) ? null : seenBy(view);
    ctx.save();
    applyView(ctx, view);
    ctx.translate(dx, dy);
    // Pixel for pixel, still or thrown: the picture goes where the field goes, as it is, so the floor stays under
    // the feet that stand on it. So that no edge shows while it is thrown, its outermost rows and columns are drawn
    // out a little way beyond it on every side.
    ctx.drawImage(bg.image, 0, top, LOGICAL_W, LOGICAL_H);
    if (dx !== 0 || dy !== 0) {
      ctx.drawImage(bg.image, 0, 0, 1, bg.h, -EDGE, top, EDGE, LOGICAL_H);
      ctx.drawImage(bg.image, bg.w - 1, 0, 1, bg.h, LOGICAL_W, top, EDGE, LOGICAL_H);
      ctx.drawImage(bg.image, 0, 0, bg.w, 1, -EDGE, top - EDGE, LOGICAL_W + 2 * EDGE, EDGE);
      ctx.drawImage(bg.image, 0, bg.h - 1, bg.w, 1, -EDGE, top + LOGICAL_H, LOGICAL_W + 2 * EDGE, EDGE);
    }
    // What the place adds to its picture: darker edges, its own lights, a haze over the ground. A hurried
    // screen has it standing still, as it is at the first moment.
    const calm = this.opts.calm === true;
    const placeClock = this.opts.fast ? 0 : this.clock;
    // The place's lights are where its picture is; its haze lies where the floor begins and, thinner, at the pilot's feet.
    const lie = { shift: top, far: horizonOf(this.place) + 6, near: HERO_FEET - 8, ...(seen ? { seen } : {}) };
    drawAmbience(ctx, background, placeClock, 'behind', field, calm, lie);
    // How many of the battle's sixteen lights are still to be had, with what stands on the field counted so far (see below).
    const weight = lightRoom(MAX_LIGHTS) > 0 ? MAX_LIGHTS / lightRoom(MAX_LIGHTS) : 1;
    const room = (): number => (finish && !calm ? MAX_LIGHTS / 2 : MAX_LIGHTS) - this.standing * weight;
    this.drawShadows(ctx);
    // What is furthest off is drawn first: what is fought over, on the farthest line; the enemies from the back to the
    // front; and the pilot's mech, the nearest of all, last.
    this.drawFreight(ctx);
    this.drawEnemies(ctx);
    // What the pilot's mech fires from the hand on its far side comes out from behind it: it is drawn before the mech
    // is, and its light with it. They are lights of the battle like any other and count among the sixteen, after what
    // stands on the field: the heat of what is close to its limit is still to be drawn, over the units, and is counted here.
    this.fx.draw(ctx, calm, 'under');
    const behind = this.opts.fast ? [] : chosenLights(this.fx.lights('under'), calm, room() - this.hot().length * weight);
    for (const glow of behind) drawGlow(ctx, glow, calm ? 0.5 : 1);
    this.drawPlayer(ctx);
    this.drawEnemyMarks(ctx);
    this.drawHeat(ctx);
    this.drawSmoke(ctx);
    drawAmbience(ctx, background, placeClock, 'front', field, calm, lie);
    if (!this.opts.fast) {
      ctx.save();
      ctx.translate(0, FIELD_Y);
      // While the camera is higher up the picture than the field, what falls there falls through what it sees too.
      if (seen && seen.top < FIELD_Y) {
        ctx.translate(0, -FIELD.height);
        drawWeather(ctx, weatherFor(background), this.clock, LOGICAL_W, FIELD.height);
        ctx.translate(0, FIELD.height);
      }
      drawWeather(ctx, weatherFor(background), this.clock, LOGICAL_W, FIELD.height);
      // Rain lands on the whole of the floor, from where it begins down to the panel; lightning lights all that is in view.
      drawWeatherExtras(ctx, weatherFor(background), this.clock, LOGICAL_W, FIELD.height, calm, PANEL_Y - horizonOf(this.place) - 6,
        seen ? { x: seen.left, y: seen.top - FIELD_Y, w: seen.width, h: seen.height } : undefined);
      ctx.restore();
    }
    this.particles.draw(ctx);
    this.fx.draw(ctx, calm);
    this.drawSurge(ctx);
    // The light of everything that burns, fires or glows is added over the field: at half strength, and
    // never over the whole of it, in a calm picture. Sixteen lights are the battle's in all, with those
    // of what stands on the field (the burn under what flies, the heat of what is close to its limit:
    // seven at most) counted first. The eyes of machines are apart from that: they are too small to count.
    // From close by every light is four times the size: half as many are drawn. And where there is to
    // be less light the sixteen are eight: what stands on the field then counts for two of the sixteen each.
    if (!this.opts.fast) drawGlows(ctx, this.lights(), calm, room() - behind.length * weight);
    if (this.hitStop.flash > 0 && !this.opts.calm) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.hitStop.flash.toFixed(2)})`;
      // Over the field: a camera that is pushed in on a blow has a part of the field in view, and nothing else.
      ctx.fillRect(0, FIELD_Y, LOGICAL_W, PANEL_Y - FIELD_Y);
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
      // What happens to what the battle is about is written by the strip that names it: on the screen, wherever the
      // camera is and however the field is thrown.
      this.fx.draw(ctx, calm, 'over');
      this.drawGround(ctx);
      this.drawDrive(ctx);
      this.drawRadio(ctx);
      if (this.opts.coach && this.intro <= 0) this.drawCoach(ctx);
    }
    if (cutIn) {
      drawCutIn(ctx, cutIn.ms, field, { heading: STRINGS.overdrive.heading, name: cutIn.name },
        (c) => drawMech(c, mechSprites(this.sprites, this.flow.state.units[0].build, this.opts.paint), 0, 0), calm);
    }
    // While someone talks, their words have the panel: there is nothing to choose until they are done.
    const talking = this.flow.phase === 'talk' && this.intro <= 0;
    if (!talking) this.drawBottom(ctx);
    if (this.intro > 0) return this.drawIntro(ctx);
    if (talking) this.drawTalk(ctx);
    if (this.flow.phase === 'result') this.drawResult(ctx);
  }

  /**
   * The view the field is drawn with right now: the close look at the last machine while that
   * lasts (a battle that is over is not staged any more, and a calm picture keeps its distance),
   * the way down the picture while the banner is up, a push towards a blow, or home.
   */
  private view(): View {
    if (this.finish && !this.opts.calm) return { x: this.finish.at.x, y: this.finish.at.y, zoom: FINISH_ZOOM };
    return this.intro > 0 ? this.camera.view(1 - this.intro / this.introTotal) : this.camera.view();
  }

  /**
   * What the wingman is saying: one small line near the top of the field, from its left edge, under
   * what the battle asks for and over the pilot's mech: the foot of the field is where that mech
   * stands. Not over the banner, not while somebody is talking, and not where a new pilot is being
   * told the buttons.
   */
  private drawRadio(ctx: CanvasRenderingContext2D): void {
    const line = this.radio?.line;
    // (There is no line before the banner has gone: the wingman reports in as it goes.)
    if (!line || this.opts.coach || this.flow.phase === 'talk') return;
    const width = line.length * 4 + 8;
    const y = STRIP_Y;
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

  /** For a new pilot: one small line near the top of the field saying which button does what right now. */
  private drawCoach(ctx: CanvasRenderingContext2D): void {
    const line = (STRINGS.coach as Record<string, string>)[this.flow.phase];
    if (!line) return;
    const width = line.length * 4 + 8;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.8)';
    ctx.fillRect(Math.round(LOGICAL_W / 2 - width / 2), STRIP_Y, width, 11);
    drawText(ctx, line, LOGICAL_W / 2, STRIP_Y + 1, { align: 'center', size: 10, color: COLORS.heat });
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
    // What the battle asks, in capitals whatever it asks: the banner is written in them throughout.
    drawText(ctx, this.instruction().toUpperCase(), x + LOGICAL_W / 2, y + 27, { align: 'center', color: COLORS.heat });
    // A battle against ordinary machines says so before the first shot: the rule that holds there, at the end of that line.
    if (this.flow.state.open) drawText(ctx, STRINGS.battleIntro.open, x + LOGICAL_W - 8, y + 27, { align: 'right', color: COLORS.accent });
    // Who is flying it, once that is somebody: on a band of its own under the banner, coming and going with it.
    if (this.opts.pilot) {
      ctx.fillStyle = 'rgba(8, 8, 20, 0.92)';
      ctx.fillRect(x, y + h + 2, LOGICAL_W, 15);
      drawText(ctx, this.opts.pilot, x + LOGICAL_W / 2, y + h + 4, { align: 'center' });
    }
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
    if (!this.hidden(player)) drawShadow(ctx, HERO.x + HERO_MIDDLE.x, HERO_FEET - 4, 104, 13, 0.5);
    for (const enemy of this.flow.state.units.slice(1)) {
      if (this.hidden(enemy)) continue;
      const r = this.enemyRect(enemy);
      // On the floor under it: what hangs over the floor throws a smaller, fainter one than what stands on it.
      const lifted = r.ground - (r.y + r.h) > 2;
      // It goes where the machine goes and thins as the machine does: one that leaves takes its shadow with it.
      const t = this.fx.transform(enemy.id);
      drawShadow(ctx, r.x + r.w / 2 + t.dx, r.ground - 1, r.w * (lifted ? 0.7 : 0.9), Math.max(5, r.w * (lifted ? 0.12 : 0.16)), (lifted ? 0.35 : 0.45) * t.alpha);
    }
    // What is fought over stands on the floor like a machine: its shadow goes where it is thrown and goes when it does.
    const freight = this.freightRect();
    if (freight) {
      const t = this.fx.transform(FREIGHT);
      drawShadow(ctx, freight.x + freight.w / 2 + t.dx, freight.ground - 1, freight.w * 0.9, Math.max(5, freight.w * 0.16), 0.45 * t.alpha);
    }
  }

  /**
   * What the battle is fought to keep alive, where it has a picture: the box it is drawn in, on the farthest line of
   * the floor. Null where it has none, and once it is lost and has been seen to go up (a hurried screen does not wait
   * to see, and a battle that is over shows what is left).
   */
  private freightRect(): { x: number; y: number; w: number; h: number; ground: number; sprite: Sprite } | null {
    const asset = this.flow.state.asset;
    if (!asset?.sprite) return null;
    // It stands for as long as it has been said to: the rules have it lost a message before the screen does.
    if ((this.flow.assetLeft ?? 0) <= 0 && (this.opts.fast || this.fx.isGone(FREIGHT) || (this.flow.phase === 'result' && !this.fx.busy))) return null;
    const sprite = this.sprites.get(asset.sprite, { w: 48, h: 32, label: asset.name });
    return { ...freightAt(freightSpot(this.place), sprite), w: sprite.w, h: sprite.h, sprite };
  }

  /** True while what was fought over is being seen to go up: lost, as the message bar has said, and not yet gone. */
  private freightGoing(): boolean {
    return !this.opts.fast && !!this.flow.state.asset?.sprite && (this.flow.assetLeft ?? 0) <= 0 && !this.fx.isGone(FREIGHT);
  }

  /** What is fought over as the field shows it: its picture's name and the box it is drawn in. Null when there is none to be seen. */
  get freight(): { sprite: string; x: number; y: number; w: number; h: number } | null {
    const r = this.freightRect();
    const sprite = this.flow.state.asset?.sprite;
    return r && sprite ? { sprite, x: r.x, y: r.y, w: r.w, h: r.h } : null;
  }

  /**
   * What is fought over, as it stands: one picture, thrown and lit when it is struck as a machine
   * that is hit is, and fading as it goes up. Drawn before every machine: whatever stands nearer
   * stands in front of it.
   */
  private drawFreight(ctx: CanvasRenderingContext2D): void {
    const r = this.freightRect();
    if (!r) return;
    this.withTransform(ctx, { id: FREIGHT, destroyed: false }, 0, (dx, dy, lift) => ctx.drawImage(r.sprite.image, r.x + dx, r.y + dy + lift, r.w, r.h));
  }

  /** A machine close to its heat limit glows from inside, and the air over it wavers. */
  /** The units that glow with their own heat at this moment: close to their limit, and there to be seen. A hurried game has none. */
  private hot(): UnitState[] {
    if (this.opts.fast) return [];
    return this.flow.state.units.filter((unit) => !unit.destroyed && !this.hidden(unit) && unit.heat >= unit.heatLimit * HOT);
  }

  private drawHeat(ctx: CanvasRenderingContext2D): void {
    const scene = this.scene();
    for (const unit of this.hot()) {
      const at = scene.hitPoint(unit.id, 'core');
      const over = Math.min(1, (unit.heat / unit.heatLimit - HOT) / (1 - HOT));
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
    // What is fought over burns once it is worn down to a third of what it could take: smoke off its top, thicker
    // than a wound's so that it is seen from where the pilot stands, and a lick of flame under the smoke.
    const freight = this.freightRect();
    const asset = this.flow.state.asset;
    const left = this.flow.assetLeft ?? 0;
    if (freight && asset && left > 0 && left * FREIGHT_BURNS <= asset.maxHp) {
      const x = freight.x + freight.w / 2;
      const y = freight.y + 3;
      for (let i = 0; i < 4; i++) {
        const age = (this.clock / 1700 + i / 4) % 1;
        ctx.globalAlpha = 0.6 * (1 - age);
        disc(ctx, x + Math.sin(age * 5 + i * 1.7) * 4, y - age * 30, 2 + age * 5, i % 2 ? '#5c5868' : '#757083');
      }
      ctx.globalAlpha = 1;
      const lick = Math.floor(this.clock / 90) % 3;
      ctx.fillStyle = '#ff8a3c';
      ctx.fillRect(Math.round(x) - 2 + lick, y, 3, 2);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(Math.round(x) - 1 + (lick % 2), y - 1, 1, 2);
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
    // What falls, falls to the floor under the machine it came off: further up the screen for one that stands further off.
    const ground = (id: string): number => this.floorUnder(id);
    if (event.type === 'shot') {
      const dtype = scene.damageType(event.unit, event.weapon);
      // A gun that fires bullets throws a casing (not for what leaps on from a hit: nothing was fired for it); whatever lands throws sparks in its own colour.
      if (!melee && !event.via && dtype === 'kinetic') this.particles.emit('casing', scene.muzzle(event.unit, event.weapon), scene.facing(event.unit), 0, ground(event.unit));
      if (event.hit) {
        const at = scene.hitPoint(event.target, event.appliedTo);
        // The camera pushes in on the blow as it lands: most for a blade, more for a shell than for a bullet or a beam.
        this.camera.push(at, melee ? PUSH.blade : dtype === 'explosive' ? PUSH.shell : PUSH.shot, flight);
        this.particles.emit('sparks', at, scene.facing(event.unit), flight, undefined, { kinetic: '#ffe9a8', energy: '#7fe9ff', explosive: '#ffb46b' }[dtype]);
        if (dtype === 'explosive') {
          this.particles.emit('fire', at, 1, flight);
          this.particles.emit('smoke', at, 1, flight + 60);
        }
      }
    }
    if (event.type === 'boost') {
      const c = scene.centre(event.unit);
      this.particles.emit('dust', { x: c.x, y: ground(event.unit) }, scene.facing(event.unit));
    }
    if (event.type === 'asset' && event.lost > 0) {
      // What is fought over is struck where it stands, if it stands on the field: bits come off it; and with nothing
      // left it goes up a moment later, the camera pushed in on it, and what is left of it smokes from then on.
      const freight = scene.freight?.() ?? null;
      if (freight) {
        const floor = freightSpot(this.place).y - 1;
        this.particles.emit('debris', freight.at, 1, 0, floor);
        if (event.hp <= 0) {
          this.hitStop.strike(90);
          this.camera.push(freight.at, PUSH.wreck, HIT_MS);
          // Heard to go up as it is seen to: the sound of a machine that does.
          this.opts.sfx?.play('unitDestroyed', HIT_MS);
          this.particles.emit('debris', freight.at, 1, HIT_MS, floor);
          this.particles.emit('fire', freight.at, 1, HIT_MS);
          this.particles.emit('embers', freight.at, 1, HIT_MS + 60);
          this.particles.emit('smoke', freight.at, 1, HIT_MS + 120);
          this.leaveWreck({ x: freight.at.x, y: Math.min(PANEL_Y - 14, freight.at.y + 6) });
        }
      }
    }
    if (event.type === 'partDestroyed') {
      const at = scene.hitPoint(event.unit, event.part);
      this.particles.emit('debris', at, 1, 0, ground(event.unit));
      this.particles.emit('fire', at, 1);
      this.particles.emit('smoke', at, 1, 80);
    }
    if (event.type === 'overdrive') {
      // The field holds its breath, the mech surges, and sparks come off it.
      this.hitStop.strike(140);
      const c = scene.centre(event.unit);
      this.camera.push(c, PUSH.surge);
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
        // The field is held, then looked at from close by while the machine goes up slowly: that look has the picture to itself.
        this.finish = { at: focusOn(c, { top: FIELD_Y, height: PANEL_Y - FIELD_Y, width: LOGICAL_W }), real: 0, field: 0, heard: false };
        this.camera.settle();
      } else this.camera.push(c, PUSH.wreck);
      this.particles.emit('debris', c, 1, 60, ground(event.unit));
      this.particles.emit('debris', c, 1, 180, ground(event.unit));
      this.particles.emit('fire', c, 1);
      this.particles.emit('embers', c, 1, 60);
      this.particles.emit('smoke', c, 1, 120);
      // The last blast throws the most, and what is left smokes from then on.
      this.particles.emit('debris', c, 1, 300, ground(event.unit));
      this.particles.emit('fire', c, 1, 300);
      this.particles.emit('embers', c, 1, 320);
      this.particles.emit('smoke', c, 1, 380);
      // A machine that went up to far more than was needed goes up harder, and throws more. Not in a calm picture: there
      // the word says it. And not the one the battle ends with: that one is looked at from close by, which is more.
      if (event.overkill && !this.opts.calm && !staged) {
        this.fx.harder(event.unit);
        this.particles.emit('debris', c, 1, 300, ground(event.unit));
        this.particles.emit('embers', c, 1, 300);
      }
      if (event.unit !== 'player') this.leaveWreck(this.wreckSpot(event.unit));
    }
    if (event.type === 'blast') {
      // A bomb's flash and bursts come a beat after its message, and so does everything it throws up.
      const c = scene.centre(event.target);
      this.camera.push(c, PUSH.wreck, MELEE_MS);
      this.particles.emit('fire', c, 1, MELEE_MS);
      this.particles.emit('embers', c, 1, MELEE_MS);
      this.particles.emit('debris', c, 1, MELEE_MS + 40, ground(event.target));
      this.particles.emit('smoke', c, 1, MELEE_MS + 100);
    }
    if (event.type === 'shot') {
      const shooter = unit(event.unit);
      const kick = melee ? 'strike' : event.weapon === 'rightHand' ? 'fireNear' : event.weapon === 'leftHand' ? 'fireFar' : 'fireShoulder';
      // What leaps on from a fork's hit was not fired: the one who fired the hit stands as they stood.
      if (shooter && !event.via) this.puppet(shooter).play(kick);
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

  /**
   * Applies an effect transform around a draw call. What is drawn is told how far across it has
   * moved, how far down what stands on its legs is thrown (with how it bobs), and how far up or
   * down the whole of it has moved: a lunge and a kick go along the line to what they are aimed at.
   */
  private withTransform(
    ctx: CanvasRenderingContext2D, unit: Pick<UnitState, 'id' | 'destroyed'>, idleDy: number,
    draw: (dx: number, dy: number, lift: number, mech: MechPainter) => void,
  ): void {
    const t = this.fx.transform(unit.id);
    // A unit that lunges leaves two after-images behind it on the line it came along, the further the fainter.
    if ((t.trail !== 0 || t.trailY !== 0) && !this.opts.fast) {
      for (const k of [2, 1]) {
        ctx.globalAlpha = t.alpha * (k === 1 ? 0.3 : 0.14);
        draw(t.dx - t.trail * k, t.dy + (unit.destroyed ? 0 : idleDy), t.lift - t.trailY * k, drawMech);
      }
    }
    ctx.globalAlpha = t.alpha;
    draw(t.dx, t.dy + (unit.destroyed ? 0 : idleDy), t.lift, drawMech);
    // A unit that is hit lights up: hard as a rule, gently in a calm picture.
    // One that fires is lit by its own gun for a moment, though not in a calm picture.
    const bright = t.flash ? (this.opts.calm ? BRIGHT.calm : BRIGHT.hit) : t.glare && !this.opts.calm ? BRIGHT.glare : 1;
    if (bright > 1) {
      // Its own picture is laid over it again as light: once for each whole time brighter it is to be, and once more,
      // fainter, for what is left over. That is what a brightness filter works out, without asking the canvas for one:
      // a canvas that has no graphics chip to do filters on takes sixty milliseconds and more over a frame that has one.
      // A mech that is drawn from its parts is laid on whole, as the one picture it is seen as: layer by layer, the
      // layers that lie under others would add their light through them.
      const whole: MechPainter = (to, parts, x, y, shift, sway, pose, view) => layMech(to, this.sprites, parts, x, y, shift, sway, pose, view);
      const before = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (let more = bright - 1; more > 0.001; more -= 1) {
        ctx.globalAlpha = t.alpha * Math.min(1, more);
        draw(t.dx, t.dy + (unit.destroyed ? 0 : idleDy), t.lift, whole);
      }
      ctx.globalCompositeOperation = before;
    }
    ctx.globalAlpha = 1;
  }

  /** The pilot's mech as the field shows it: from behind. */
  private playerSprites(): MechSprites {
    return mechSprites(this.sprites, this.flow.state.units[0].build, this.opts.paint, 'back');
  }

  /** The pilot's mech: near, in the lower left, its back to the camera. */
  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const player = this.flow.state.units[0];
    if (this.hidden(player)) return;
    // Its layers move by themselves: breathing, kicking back, flinching, coming apart.
    const pose = this.poseOf(player);
    this.withTransform(ctx, player, 0, (dx, dy, lift, mech) =>
      mech(ctx, this.playerSprites(), HERO.x, HERO.y, { dx, dy: lift }, dy, pose, 'back'));
    this.drawGenerator(ctx, player, pose);
  }

  /**
   * The pilot's mech stands with its back to the camera: it has no eye that can be seen. What is
   * seen of it being alive is its generator, a small warm light on its back that breathes, grows
   * as the mech runs hotter, and sinks low while the mech is dazed. It goes where the body goes,
   * and goes out in the frame the mech is seen to come apart, not sooner: the shot that ends it is
   * still in the air when the rules have it ended. Like an eye it is too small to be one of the
   * battle's lights; a hurried game has none.
   */
  private drawGenerator(ctx: CanvasRenderingContext2D, player: UnitState, pose: Pose): void {
    if (this.opts.fast || this.puppet(player).breaking !== null) return;
    const t = this.fx.transform(player.id);
    const body = pose.core ?? { dx: 0, dy: 0 };
    const stance = this.stances.of(player.id);
    const dazed = stance.staggered || stance.overheated;
    const hot = Math.max(0, Math.min(1, player.heat / player.heatLimit));
    const breath = 0.8 + 0.2 * Math.sin(this.clock / 700);
    drawGlow(ctx, {
      x: HERO.x + GENERATOR.x + t.dx + body.dx,
      y: HERO.y + GENERATOR.y + dropOf(this.playerSprites()) + t.dy + t.lift + body.dy,
      r: GENERATOR.r + 6 * hot,
      color: GENERATOR.color,
      alpha: dazed ? GENERATOR.dazed : (GENERATOR.alpha + 0.2 * hot) * breath,
    }, this.opts.calm ? 0.5 : 1);
  }

  /** True when the battle's single enemy is a mech drawn from its parts, turned round to face the pilot's. */
  private duel(): boolean {
    return this.places === 1 && this.flow.state.units[1].composed;
  }

  /** The place each enemy stands on, by how many places there are. */
  private spotOf(enemy: UnitState): Spot {
    const spots = enemySpots(this.places, this.place);
    return spots[enemy.slot ?? 0] ?? spots[spots.length - 1];
  }

  /** A mech that is fought alone, as it stands far off: small, from the front. */
  private duelSprites(enemy: UnitState): MechSprites {
    return mechSprites(this.sprites, enemy.build, enemy.paint, 'small');
  }

  /** The box an enemy is drawn in, and the line of the floor it stands on or hangs over. */
  private enemyRect(enemy: UnitState): { x: number; y: number; w: number; h: number; ground: number; sprite: Sprite } {
    const spot = this.spotOf(enemy);
    // A duelling mech stands in its small pose box, turned round; this is the part of it the body occupies.
    if (this.duel()) return { ...duelAt(spot).body, ground: spot.y, sprite: { image: null as unknown as CanvasImageSource, w: 0, h: 0 } };
    const fallback = { w: 48, h: 48, label: enemy.name };
    const id = enemy.sprite ?? enemy.id;
    const sprite = enemy.paint && this.sprites.painted ? this.sprites.painted(id, enemy.paint, fallback) : this.sprites.get(id, fallback);
    // On its spot, or over it when it flies; one too big for its place is moved in from the edges rather than cut off by them.
    return { ...standAt(spot, sprite, FLYERS.has(enemy.sprite ?? '')), w: sprite.w, h: sprite.h, sprite };
  }

  /** The line of the floor under a unit: where what falls off it comes to rest. */
  private floorUnder(id: string): number {
    const unit = this.flow.state.units.find((u) => u.id === id);
    return !unit || unit.side === 'player' ? HERO_FEET - 2 : this.enemyRect(unit).ground - 1;
  }

  /** The enemies' machines, the farthest first, so that one that stands nearer stands in front. */
  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    const shown = this.flow.state.units.slice(1).filter((enemy) => !this.hidden(enemy));
    // Each keeps the number it has among those on the field, whatever order they are drawn in: its bob and its eye go by it.
    const standing = shown.map((enemy, i) => { const r = this.enemyRect(enemy); return { enemy, i, r, ground: r.ground }; });
    farToNear(standing).forEach(({ enemy, i, r }) => {
      // Flying units bob; anything that stands on the ground stays put.
      const flies = FLYERS.has(enemy.sprite ?? '');
      const hover = flies ? Math.round(2 * Math.sin(this.clock / 380 + i * 2)) : 0;
      // What flies burns underneath to stay up: under it wherever it is, and no brighter than it is there to be seen.
      if (flies && !this.opts.fast && !this.duel()) {
        this.standing++;
        const t = this.fx.transform(enemy.id);
        drawGlow(ctx, { x: r.x + r.w / 2 + t.dx, y: r.y + r.h - 4 + hover + t.lift, r: 9 + r.w * 0.22, color: '#ff7ab8', alpha: (0.3 + 0.1 * Math.sin(this.clock / 90 + i)) * t.alpha }, this.opts.calm ? 0.5 : 1);
      }
      if (this.duel()) {
        const parts = this.duelSprites(enemy);
        const pose = this.poseOf(enemy);
        const box = duelAt(this.spotOf(enemy));
        this.withTransform(ctx, enemy, 0, (dx, dy, lift, mech) => {
          // Mirror the pose box so the mech faces left; a shift to the right is a shift to the left in there.
          ctx.save();
          ctx.translate(box.right, box.top);
          ctx.scale(-1, 1);
          mech(ctx, parts, 0, 0, { dx: -dx, dy: lift }, dy, pose, 'small');
          ctx.restore();
        });
      } else {
        // A machine that is one picture moves as a whole, the way its body would: it faces left, so forward is left.
        const body = this.poseOf(enemy).core ?? { dx: 0, dy: 0 };
        const breaking = this.puppet(enemy).breaking;
        this.withTransform(ctx, enemy, hover, (dx, down, lift) => {
          // A machine that is one picture has no legs to leave behind: all of it goes where it is thrown and where it lunges.
          const dy = down + lift;
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
        // the air. Not in a hurried game. It is too small to be counted among the battle's sixteen lights:
        // the largest eye is a seventh of a common light.
        if (!this.opts.fast && breaking === null) {
          const t = this.fx.transform(enemy.id);
          // Dazed as far as has been shown: the rules can be a shot ahead of the screen.
          const stance = this.stances.of(enemy.id);
          const dazed = stance.staggered || stance.overheated || stance.shaken;
          // Where its picture is drawn: one that the rules have ended hangs still until it is seen to come apart.
          const eye = eyeLight(enemy.sprite ?? enemy.id, r.x + t.dx - body.dx, r.y + t.dy + t.lift + (enemy.destroyed ? 0 : hover) + body.dy, this.clock, i, dazed ? 'dazed' : 'awake', this.opts.calm === true);
          // It dims with the machine: one that leaves is lost to sight, eye and all.
          if (eye) drawGlow(ctx, eye, (this.opts.calm ? 0.5 : 1) * t.alpha);
        }
      }
    });
  }

  /** Everything that is written over the enemies, after every machine is drawn, so that none hides another's bars. */
  private drawEnemyMarks(ctx: CanvasRenderingContext2D): void {
    const enemies = this.flow.state.units.slice(1).filter((enemy) => !this.hidden(enemy));
    const marked = this.flow.objective?.target;
    // While a fork is aimed (there is no preview of a shot at any other time): the machine its hit would leap on to.
    const forked = this.flow.preview?.fork;
    // Each machine's bars are under it; where machines stand so close that their bars would lie on one another, they are stacked.
    // A machine has them until it has been seen to go: the rules can be a turn ahead of the screen.
    const standing = enemies.filter((enemy) => !this.fallen(enemy));
    const bars = placeBars(standing.map((enemy) => this.enemyRect(enemy)));
    for (const enemy of enemies) {
      if (this.fallen(enemy)) continue;
      const r = this.enemyRect(enemy);
      const core = enemy.parts.core!;
      const bar = bars[standing.indexOf(enemy)];
      drawMeter(ctx, bar.x, bar.y, bar.w, 2, this.shownAp.ap(enemy.id, 'core'), core.maxAp, COLORS.armor);
      // Under the armour line, how much balance the enemy has left.
      drawMeter(ctx, bar.x, bar.y + 3, bar.w, 1, enemy.staggerMax - enemy.stagger, enemy.staggerMax, COLORS.heat);
      const mark = this.fieldMark(enemy) ?? (enemy.id === marked ? { text: STRINGS.objectives.mark, color: COLORS.heat } : null)
        ?? (enemy.id === forked ? { text: STRINGS.preview.fork, color: COLORS.energy } : null);
      if (mark) {
        // Above the unit, unless that is where the bars of one standing higher up are: then on the unit, on a dark
        // ground. (Its own bars are under its feet: they are never where its mark would go.)
        const width = mark.text.length * 4;
        const at = markPosition(r, bars, width);
        if (at.inside) {
          ctx.fillStyle = 'rgba(8, 8, 20, 0.7)';
          ctx.fillRect(at.x - width / 2 - 2, at.y - 1, width + 4, 10);
        }
        drawText(ctx, mark.text, at.x, at.y, { align: 'center', size: 10, color: mark.color });
      }
      // The enemy the objective is about wears small amber corners all battle long.
      if (enemy.id === marked) this.drawBrackets(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, COLORS.heat, 3);
      if (this.flow.phase === 'target' && this.flow.targetId === enemy.id) this.drawBrackets(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      // Small corners in the colour of the bolt on the one it would go on to: inside any the objective gives it.
      if (enemy.id === forked) this.drawBrackets(ctx, r.x, r.y, r.w, r.h, COLORS.energy, 3);
    }
  }

  /** True once a unit's destruction, or its leaving, has been shown: until then it is on the field for all the screen knows. */
  private fallen(unit: UnitState): boolean {
    if (!unit.destroyed) return false;
    const events = this.flow.state.events;
    for (let i = this.fxDone; i < events.length; i++) {
      const event = events[i];
      if ((event.type === 'unitDestroyed' || event.type === 'rout') && event.unit === unit.id) return false;
    }
    return true;
  }

  /**
   * The one state worth flagging over an enemy's head. A machine that has lost its nerve says so and nothing
   * else: it will leave, and whatever it was about to do (a bomb's fuse, a charge) it will not do. Then a bomb
   * about to go off, then a charge about to land.
   */
  private fieldMark(unit: UnitState): { text: string; color: string } | null {
    const T = STRINGS.tags;
    const blink = Math.floor(this.clock / 260) % 2 === 0;
    // As far as has been shown: the rules know it from the moment of the second kill, the screen from when it is said.
    if (this.stances.of(unit.id).shaken) return { text: T.shaken, color: COLORS.accent };
    if (unit.fuse !== undefined) return { text: T.fuse(unit.fuse), color: unit.fuse <= 1 && blink ? COLORS.danger : COLORS.heat };
    if (unit.charged.length > 0) return { text: T.charging, color: blink ? COLORS.danger : COLORS.heat };
    // A surge about to be fired with what its machine kept on top of a turn: how much that is, as pressing as a charge,
    // and said in place of the guard the machine took while it held (the row beside its name says both).
    if (looming(this.flow.state, unit, this.catalog)) return { text: STRINGS.fx.kept(unit.kept), color: blink ? COLORS.danger : COLORS.energy };
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
      ...(unit.shaken ? [{ text: T.shaken, color: COLORS.accent, rank: 9 }] : []),
      // A bomb that has lost its nerve leaves with its fuse unlit: it is not counted down to.
      ...(unit.fuse !== undefined && !unit.shaken ? [{ text: T.fuse(unit.fuse), color: COLORS.danger, rank: 9 }] : []),
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
      // What a core's buffer is keeping for the unit's next turn. The first to make way in a full row: where it is
      // about to matter it is written over the machine as well.
      ...(unit.kept > 0 ? [{ text: STRINGS.fx.kept(unit.kept), color: COLORS.energy, rank: 0 }] : []),
      // A core's field that has been broken: said for as long as nothing stands in its place.
      ...(unit.barrier === 0 && fieldOf(unit, this.catalog) > 0 ? [{ text: T.fieldDown, color: COLORS.dim, rank: 7 }] : []),
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
    const rival = () => this.flow.state.units[1];
    /** The middle of the pilot's mech as it lands on the screen: a mech on tracks carries its upper body lower, and its middle with it. */
    const at = (p: Pt) => ({ x: HERO.x + p.x, y: HERO.y + p.y + dropOf(this.playerSprites()) });
    /** The same for the mech that is fought alone, in its small pose box turned round. */
    const mirror = (p: Pt) => {
      const box = duelAt(this.spotOf(rival()));
      return { x: box.right - p.x, y: box.top + p.y + dropOf(this.duelSprites(rival())) };
    };
    /**
     * Where a weapon fires from in a mech's pose box: the far end of what is held, or, where nothing
     * is held (or there is no arm left to hold it), the fist it would be in or the mount on the
     * shoulder. What the legs lower is in the point already.
     */
    /** Where a unit stands on the floor: under its middle, on the line its feet are on or it hangs over. */
    const footOf = (id: string): Pt => {
      if (isPlayer(id)) return { x: HERO.x + HERO_MIDDLE.x, y: HERO_FEET };
      const r = rectOf(id);
      return { x: r.x + r.w / 2, y: r.ground };
    };
    const firesFrom = (parts: MechSprites, weapon: 'rightHand' | 'leftHand' | 'shoulder', view: MechView): Pt => {
      const end = muzzleOf(parts, weapon, view);
      if (end) return end;
      if (weapon !== 'shoulder') return fistOf(parts, weapon, view);
      const { mount } = VIEWS[view];
      return { x: mount.x, y: mount.y + dropOf(parts) };
    };
    return {
      muzzle: (id, weapon) => {
        if (!isPlayer(id)) {
          if (this.duel()) {
            const p = firesFrom(this.duelSprites(rival()), weapon, 'small');
            const box = duelAt(this.spotOf(rival()));
            return { x: box.right - p.x, y: box.top + p.y };
          }
          const r = rectOf(id);
          return { x: r.x + 2, y: r.y + Math.round(r.h * 0.62) };
        }
        const p = firesFrom(this.playerSprites(), weapon, 'back');
        return { x: HERO.x + p.x, y: HERO.y + p.y };
      },
      hitPoint: (id, part) => {
        // On a mech drawn from its parts a hit lands on the part's own picture, wherever its legs have lowered it to.
        if (isPlayer(id)) { const p = hitOn(this.playerSprites(), part, 'back'); return { x: HERO.x + p.x, y: HERO.y + p.y }; }
        if (this.duel()) {
          const p = hitOn(this.duelSprites(rival()), part, 'small');
          const box = duelAt(this.spotOf(rival()));
          return { x: box.right - p.x, y: box.top + p.y };
        }
        const r = rectOf(id);
        const offset = { core: 0.5, legs: 0.25, arms: 0.5, head: 0.2 }[part];
        return { x: r.x + r.w / 2, y: r.y + r.h * offset };
      },
      centre: (id) => {
        if (isPlayer(id)) return at(HERO_MIDDLE);
        if (this.duel()) return mirror(DUEL_MIDDLE);
        const r = rectOf(id);
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      },
      facing: (id) => (isPlayer(id) ? 1 : -1),
      // What is fought over, where it has a picture and still stands: the middle of it, and its top.
      freight: () => {
        const r = this.freightRect();
        return r ? { at: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, top: r.y } : null;
      },
      // The pilot's mech is as near as anything is; an enemy is as far off as the line of the floor it stands on or hangs over.
      depth: (id) => (isPlayer(id) ? 0 : depthOf(rectOf(id).ground)),
      // Where each stands on the floor: the pilot's mech on the nearest line, an enemy on the line under it.
      foot: (id) => footOf(id),
      // Each side looks across the floor at the other: the pilot's mech at the middle of where the enemies stand, an enemy at the pilot's mech.
      heading: (id) => {
        const own = footOf(id);
        const other = isPlayer(id) ? ACROSS : footOf('player');
        const length = Math.hypot(other.x - own.x, other.y - own.y) || 1;
        return { x: (other.x - own.x) / length, y: (other.y - own.y) / length };
      },
      damageType: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return weaponIn(unit.build, weapon, this.catalog)?.damageType ?? 'kinetic';
      },
      isMelee: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return !!weaponIn(unit.build, weapon, this.catalog)?.melee;
      },
      kind: (id, weapon) => {
        const unit = this.flow.state.units.find((u) => u.id === id)!;
        return weaponIn(unit.build, weapon, this.catalog)?.trait;
      },
      // The pilot's mech is seen from behind and a little from its right: its left hand is on the far side of its body.
      hidden: (id, weapon) => isPlayer(id) && weapon === 'leftHand',
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
        // A hit that would finish the machine says so instead of a figure: that is what the figure would mean.
        if (p.kills) drawText(ctx, `${STRINGS.preview.hit} ${p.hitChance}%   ${STRINGS.preview.kills}`, x, y + 1, { size: 16, color: COLORS.accent });
        else drawText(ctx, `${STRINGS.preview.hit} ${p.hitChance}%   ${STRINGS.preview.damage} ${p.damage}${times}`, x, y + 1, { size: 16 });
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
    // Red from where a machine is seen to be hot (three quarters of the way to its own limit), or when the weapon being aimed would pass the limit.
    const hot = player.heat > player.heatLimit * HOT || this.flow.overheatWarning;
    this.drawStat(ctx, STRINGS.meters.energy, player.energy, turnEnergyOf(player, this.catalog), COLORS.energy, x, y, width);
    // The bar is as long as the machine's limit, and a limit that is not the usual one is written beside the figure.
    const figure = player.heatLimit === HEAT_LIMIT ? String(player.heat) : `${player.heat}/${player.heatLimit}`;
    this.drawStat(ctx, STRINGS.meters.heat, player.heat, player.heatLimit, hot ? COLORS.danger : COLORS.heat, x, y + LINE, width, figure);
  }

  private drawStat(
    ctx: CanvasRenderingContext2D, label: string, value: number, max: number, color: string, x: number, y: number,
    width: number, figure = String(value),
  ): void {
    drawText(ctx, label, x, y, { color: COLORS.dim });
    drawMeter(ctx, x + 30, y + 4, width - 70, 4, value, max, color);
    drawText(ctx, figure, x + width, y, { align: 'right', color: color === COLORS.danger ? COLORS.danger : COLORS.text });
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
      drawAll(ctx, wordLights(word, LOGICAL_W / 2, y + RESULT_WORD_Y, tall, metal, level), calm ? 0.5 : 1);
      drawWord(ctx, word, LOGICAL_W / 2, wordTop(y + RESULT_WORD_Y, tall), { tall, metal, level });
    }
    if (note) drawText(ctx, note, LOGICAL_W / 2, y + 40, { align: 'center' });
    drawText(ctx, this.opts.resultHint ?? STRINGS.hints.result, LOGICAL_W / 2, y + h - 18, { align: 'center', color: COLORS.dim });
  }
}
