import type { BattleEvent } from '../core/battle';
import type { DamageType, FrameSlot, Weapon, WeaponSlot } from '../core/types';
import { figure } from '../content/language';
import { STRINGS } from '../content/strings';
import { TYPE_COLOR, lightsOf, paintFx } from './fxPaint';
import { LOGICAL_W } from './display';
import type { Glow, Pt } from './light';
import { COLORS } from './widgets';

export type { Pt } from './light';

/** Where things are on screen. The battle screen supplies this; the effects know no layout. */
export interface Scene {
  muzzle(unitId: string, weapon: WeaponSlot): Pt;
  hitPoint(unitId: string, part: FrameSlot): Pt;
  centre(unitId: string): Pt;
  /** 1 when the unit faces right, -1 when it faces left. */
  facing(unitId: string): 1 | -1;
  /**
   * How far off a unit is: 0 as near as the pilot's mech, 1 on the farthest line there is. A
   * scene that does not say is flat: everything in it is drawn at one size.
   */
  depth?(unitId: string): number;
  /** Which way a unit looks at the other side: one pixel long. A scene that does not say has everybody looking straight left or right. */
  heading?(unitId: string): Pt;
  /**
   * Where a unit stands on the floor, or the place on the floor it hangs over. What moves over
   * the floor (a lunge, a bomb that throws itself) goes from where the one stands towards where
   * the other does. A scene that does not say has it go from the one's middle to what it strikes.
   */
  foot?(unitId: string): Pt;
  damageType(unitId: string, weapon: WeaponSlot): DamageType;
  /** True when the weapon is a blade or a ram: it is swung, not fired. */
  isMelee(unitId: string, weapon: WeaponSlot): boolean;
  /** The kind of weapon it is, where it is of a kind. A scene that does not say has no word for what a kind made of a hit. */
  kind?(unitId: string, weapon: WeaponSlot): Weapon['trait'];
  /**
   * Where what the battle is fought to keep alive stands on the field: the middle of its picture, and its top. Null,
   * and in a scene that does not say, it has no picture: what happens to it is then written by the strip that names it.
   */
  freight?(): { at: Pt; top: number } | null;
  /**
   * True when the weapon is on the far side of its mech from the camera, so that the mech's own
   * body is between the two: what it fires is seen to come out from behind the mech. A scene that
   * does not say has every weapon in plain view.
   */
  hidden?(unitId: string, weapon: WeaponSlot): boolean;
}

/**
 * Where an effect is drawn. Most are on the `stage`, over everything that stands on it. What a
 * hidden weapon fires is `under` the one that fires it: drawn before that one is, so that its body
 * covers the flash and the shot comes out from behind it. And what is written `over` the field is
 * not on the stage at all: it is drawn where the screen has it, after the field is done.
 */
export type FxLayer = 'under' | 'stage' | 'over';

export interface UnitTransform {
  dx: number;
  /** How far down what stands on its legs is thrown: the legs stay where they are. */
  dy: number;
  /** How far up or down the whole of it has moved, legs and all: a lunge and a kick go along the line to what they are aimed at. */
  lift: number;
  flash: boolean;
  alpha: number;
  /** Lit by its own gun. */
  glare: boolean;
  /** How far behind it each of its after-images stands, across and down, with their signs: nothing while it is not lunging. */
  trail: number;
  trailY: number;
}

/** How large something is drawn for how far off it is: a fifth larger than life as near as the pilot's mech, seven tenths on the farthest line. */
export const NEAR_SIZE = 1.2;
export const FAR_SIZE = 0.7;
export const sizeAt = (depth: number): number => NEAR_SIZE - (NEAR_SIZE - FAR_SIZE) * Math.max(0, Math.min(1, depth));
/** How far past its target a shot that misses flies on, and how far to the side of it it passes. */
const MISS_ON = 34;
const MISS_WIDE = 12;

/**
 * What the freight goes by among the things the effects throw, light and take away: it is no unit,
 * and no unit has this name.
 */
export const FREIGHT = 'freight';

/** How many pixels the hardest blow there is throws the field: a bomb going off. The screen draws its picture out further than that. */
export const HARDEST_JOLT = 5;

export const PROJECTILE_MS = 160;
export const SHELL_MS = 260;
export const HIT_MS = 220;
/** How long a shot of this type takes to reach its target. */
export const flightFor = (dtype: DamageType): number => (dtype === 'explosive' ? SHELL_MS : PROJECTILE_MS);
export const TEXT_MS = 650;
export const DEATH_MS = 550;
/** How long a machine that breaks off takes to be gone, and how far it has gone by then. */
export const LEAVE_MS = 520;
export const LEAVE_PX = 64;
const RECOIL_MS = 140;
const LUNGE_MS = 320;
const STEAM_MS = 520;
const SPARK_MS = 380;
const SLASH_MS = 200;
const SHIELD_MS = 420;
const GATHER_MS = 480;
/** How long a blade takes to reach its target: the lunge, not a flight. */
export const MELEE_MS = 150;
const MODULE_COLOR: Record<string, string> = {
  coolant: '#dfe6f5', barrier: COLORS.energy, overclock: COLORS.heat, painter: COLORS.danger, nanites: COLORS.armor,
  shock: '#ffe9a8', chaff: COLORS.dim, limiter: COLORS.accent,
};

/** How long a barrel's flash lasts. */
const MUZZLE_MS = 90;
/** The last and largest blast of a machine going up: when it comes, how long it burns, and how large it is at life size. */
export const WRECK_AT = 300;
export const WRECK_MS = 480;
export const WRECK_SIZE = 26;
/**
 * How many times as large the last blast of an overkill is, and how far above where the figure of the hit was written
 * its word is. The figure has been rising for a while by then, and the word is to stand as clear of it as the word for
 * a blocked hit stands of its figure.
 */
export const OVERKILL_SIZE = 1.5;
export const OVERKILL_UP = 24;
/** How far apart two words stand that are written over one unit at one moment: the word for a blocked hit over its figure, the count of a run over whatever else is said of the pilot. */
export const WORD_GAP = 12;
/** How large a word is as it lands, before it settles (see `paintFx`): a letter is four tenths of its size wide. */
const LANDING = 24;
/** How far a gun kicks its mech back, how far a lunge carries one, and how far behind it each of its after-images stands. */
export const RECOIL_PX = 3;
export const LUNGE_PX = 9;
const TRAIL_PX = 7;

/**
 * What a burst looks like: something struck (a flash, a ring, streaks), something went up (a
 * fireball, a shock ring, smoke), or something pulsed (a ring of its colour).
 */
export type BurstStyle = 'impact' | 'fire' | 'ring';

type Timed = { start: number; dur: number };
/**
 * `aim` is the way something points: one pixel long, from where it starts towards what it is
 * aimed at. `size` and `grow` are how large something is drawn for how far off it is (`sizeAt`):
 * what flies has a size where it leaves and one where it lands.
 */
export type Fx = Timed & (
  | { kind: 'projectile'; from: Pt; to: Pt; dtype: DamageType; grow: [number, number]; under?: true }
  | { kind: 'muzzle'; at: Pt; dtype: DamageType; aim: Pt; size: number; under?: true }
  | { kind: 'recoil'; unit: string; aim: Pt }
  | { kind: 'hit'; unit: string }
  | { kind: 'pulse'; unit: string }
  | { kind: 'lunge'; unit: string; from: Pt; aim: Pt }
  | { kind: 'death'; unit: string; at: Pt }
  /** A machine that breaks off: it goes out the way `aim` points, faster as it goes, and is gone at the end. */
  | { kind: 'leave'; unit: string; from: Pt; aim: Pt }
  | { kind: 'burst'; at: Pt; size: number; color: string; style: BurstStyle }
  | { kind: 'sparks'; at: Pt; color: string }
  | { kind: 'steam'; at: Pt }
  /** A figure or a word. One that is `over` the field is written where the screen has it, not on the stage: it belongs to what is written along the field's top. */
  | { kind: 'text'; at: Pt; text: string; color: string; over?: true; run?: true }
  | { kind: 'slash'; at: Pt; dir: number; color: string }
  | { kind: 'shield'; at: Pt; aim: Pt }
  | { kind: 'gather'; at: Pt; color: string }
);

/** The layer an effect is drawn in. */
export function layerOf(fx: Fx): FxLayer {
  if (fx.kind === 'text' && fx.over) return 'over';
  if ((fx.kind === 'muzzle' || fx.kind === 'projectile') && fx.under) return 'under';
  return 'stage';
}

/** The way from one point to another, one pixel long; where the two are one point, straight ahead the way the unit faces. */
function towards(from: Pt, to: Pt, dir: number): Pt {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length > 0 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : { x: dir, y: 0 };
}

/** Rounds without ever producing negative zero. */
const px = (n: number): number => Math.round(n) || 0;

/**
 * Short code-drawn animations for battle events: shots, hits, misses, breakdowns and the rest.
 * It only decorates; the rules have already been applied when an event arrives here.
 */
export class BattleFx {
  private now = 0;
  private effects: Fx[] = [];
  private gone = new Set<string>();
  /** The unit a barrier last took part of a hit for, and when the word for that came up. */
  private blocked: { unit: string; at: number } | null = null;
  /** Jolts to the whole field: when each lands, how long it lasts, how far it throws things, and whether it has been felt. */
  private jolts: { start: number; dur: number; amount: number; felt: boolean }[] = [];

  constructor(private scene: Scene) {}

  private add(delay: number, dur: number, fx: Fx extends infer T ? (T extends Timed ? Omit<T, 'start' | 'dur'> : never) : never): void {
    this.effects.push({ ...fx, start: this.now + delay, dur } as Fx);
  }

  /**
   * Writes a word or a figure that floats up from `at`. One on the stage is kept inside it at the size
   * it lands at, so that a word over a machine at the edge of the field is not cut by the edge, from
   * the camera's home or from close by.
   */
  private say(delay: number, at: Pt, text: string, color: string, how: { over?: true; run?: true } = {}): void {
    const half = (text.length * LANDING * 0.4) / 2 + 2;
    const x = how.over ? at.x : Math.max(half, Math.min(LOGICAL_W - half, at.x));
    this.add(delay, TEXT_MS, { kind: 'text', at: { x, y: at.y - 10 }, text, color, ...how });
  }

  /**
   * The word for what a weapon's kind made of a hit, where it made something of it: over the one who fired, of a
   * redline fired warm and of a surge; over the machine it landed on, clear of the figure, of a punish.
   */
  private sayKind(event: Extract<BattleEvent, { type: 'shot' }>, flight: number, target: Pt): void {
    if (event.lift === undefined) return;
    const K = STRINGS.fx.kinds;
    const own = this.scene.centre(event.unit);
    const over = { x: own.x, y: own.y - WORD_GAP };
    switch (this.scene.kind?.(event.unit, event.weapon)) {
      case 'redline': return this.say(0, over, K.redline(event.lift - 100), COLORS.heat);
      case 'surge': return this.say(0, over, K.surge(figure((event.lift / 100).toFixed(1))), COLORS.energy);
      case 'punish': return this.say(flight, { x: target.x, y: target.y - WORD_GAP }, K.punish, COLORS.accent);
      default:
    }
  }

  /** Shakes the whole field by up to `amount` pixels for `dur`, starting after `delay`: never by more than the hardest jolt there is. */
  private jolt(delay: number, amount: number, dur: number): void {
    this.jolts.push({ start: this.now + delay, dur, amount: Math.min(HARDEST_JOLT, amount), felt: false });
  }

  /** How far the field is thrown right now: the hardest jolt that is still going, dying away. */
  shake(): { dx: number; dy: number } {
    let amp = 0;
    for (const j of this.jolts) {
      if (this.now < j.start || this.now >= j.start + j.dur) continue;
      amp = Math.max(amp, j.amount * (1 - (this.now - j.start) / j.dur));
    }
    if (amp <= 0) return { dx: 0, dy: 0 };
    return { dx: px(Math.sin(this.now * 0.11) * amp), dy: px(Math.cos(this.now * 0.17) * amp) };
  }

  /** Milliseconds the handheld should rumble for the jolts that have landed since this was last asked. */
  takeRumble(): number {
    let ms = 0;
    for (const j of this.jolts) {
      if (j.felt || this.now < j.start) continue;
      j.felt = true;
      ms = Math.max(ms, Math.round(j.dur * 0.6));
    }
    return ms;
  }

  /** How large what happens at a unit is drawn: larger than life near the camera, smaller far off, life size in a scene that is flat. */
  private sizeOf(unitId: string): number {
    return this.scene.depth ? sizeAt(this.scene.depth(unitId)) : 1;
  }

  /** Which way a unit looks at the other side. */
  private headingOf(unitId: string): Pt {
    return this.scene.heading?.(unitId) ?? { x: this.scene.facing(unitId), y: 0 };
  }

  /** The way one unit goes over the floor to get at another: from where it stands towards where the other does. */
  private wayTo(unitId: string, targetId: string, struck: Pt): Pt {
    const s = this.scene;
    return s.foot ? towards(s.foot(unitId), s.foot(targetId), s.facing(unitId)) : towards(s.centre(unitId), struck, s.facing(unitId));
  }

  onEvent(event: BattleEvent): void {
    const s = this.scene;
    switch (event.type) {
      case 'shot': {
        const dtype = s.damageType(event.unit, event.weapon);
        // What leapt on from a fork's hit comes from the middle of the machine that hit landed on, not from the barrel.
        const from = event.via ? s.hitPoint(event.via, 'core') : s.muzzle(event.unit, event.weapon);
        const target = s.hitPoint(event.target, event.appliedTo);
        const dir = s.facing(event.unit);
        const melee = s.isMelee(event.unit, event.weapon);
        const flight = melee ? MELEE_MS : flightFor(dtype);
        // What happens at the target is as large as the target is far off; what leaves the barrel, as the one who fires.
        const near = this.sizeOf(event.via ?? event.unit);
        const far = this.sizeOf(event.target);
        if (event.via) {
          this.add(0, flight, { kind: 'projectile', from, to: target, dtype, grow: [near, far] });
        } else if (melee) {
          // A blade is carried to the target by the mech itself, over the floor between the two.
          this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, from: s.centre(event.unit), aim: this.wayTo(event.unit, event.target, target) });
          this.add(flight, SLASH_MS, { kind: 'slash', at: target, dir, color: TYPE_COLOR[dtype] });
        } else {
          const aim = towards(from, target, dir);
          // A miss flies on past the target, wide of it on the side that is up the screen.
          const up = aim.x >= 0 ? { x: aim.y, y: -aim.x } : { x: -aim.y, y: aim.x };
          const to = event.hit ? target : { x: target.x + aim.x * MISS_ON + up.x * MISS_WIDE, y: target.y + aim.y * MISS_ON + up.y * MISS_WIDE };
          // A weapon on the far side of its mech: the flash at its barrel and what it fires are behind the mech.
          const under = s.hidden?.(event.unit, event.weapon) === true ? { under: true as const } : {};
          this.add(0, MUZZLE_MS, { kind: 'muzzle', at: from, dtype, aim, size: near, ...under });
          this.add(0, RECOIL_MS, { kind: 'recoil', unit: event.unit, aim });
          this.add(0, flight, { kind: 'projectile', from, to, dtype, grow: [near, far], ...under });
        }
        if (event.hit) {
          // A hit that takes a real bite is felt by the whole field.
          if (event.damage >= 60) this.jolt(flight, 2, 170);
          this.add(flight, HIT_MS, { kind: 'hit', unit: event.target });
          // A shell goes up where it lands; anything else strikes.
          if (dtype === 'explosive') this.add(flight, HIT_MS + 120, { kind: 'burst', at: target, size: 14 * far, color: TYPE_COLOR[dtype], style: 'fire' });
          else this.add(flight, HIT_MS, { kind: 'burst', at: target, size: 8 * far, color: TYPE_COLOR[dtype], style: 'impact' });
          if (event.absorbed) {
            this.say(flight, { x: target.x, y: target.y - WORD_GAP }, STRINGS.fx.block(event.absorbed), COLORS.energy);
            this.blocked = { unit: event.target, at: this.now + flight };
          }
          if (event.damage > 0 || !event.absorbed) this.say(flight, target, `-${event.damage}`, '#ffffff');
          this.sayKind(event, flight, target);
        } else {
          this.say(flight, target, STRINGS.fx.miss, '#c9c6e8');
        }
        break;
      }
      case 'partDestroyed': {
        const at = s.hitPoint(event.unit, event.part);
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: '#ffd27f' });
        this.add(0, 280, { kind: 'burst', at, size: 9 * this.sizeOf(event.unit), color: '#ff8a3c', style: 'fire' });
        this.jolt(0, 2, 180);
        break;
      }
      case 'unitDestroyed': {
        const at = s.centre(event.unit);
        // A machine that goes up far off goes up smaller than one that goes up near.
        const size = this.sizeOf(event.unit);
        this.jolt(0, 3, 320);
        this.add(0, DEATH_MS, { kind: 'death', unit: event.unit, at });
        // It goes up in pieces first, and then all at once: that last blast outlasts the wreck.
        for (const [i, off] of [[0, 0], [-10, 6], [9, -7]].entries()) {
          this.add(i * 110, 280, { kind: 'burst', at: { x: at.x + off[0] * size, y: at.y + off[1] * size }, size: (11 + i) * size, color: '#ff8a3c', style: 'fire' });
        }
        this.add(WRECK_AT, WRECK_MS, { kind: 'burst', at, size: WRECK_SIZE * size, color: '#ff8a3c', style: 'fire' });
        this.jolt(WRECK_AT, 4, 300);
        // Far more than was needed: the word for it, over the machine and clear of the figure of the hit that did it,
        // which was written where its core is hit and has begun to rise.
        if (event.overkill) {
          // Where a barrier took part of that hit, the word for that is over the figure still: this one goes over both.
          const over = this.blocked?.unit === event.unit && this.now - this.blocked.at < TEXT_MS ? WORD_GAP : 0;
          this.say(0, { x: at.x, y: s.hitPoint(event.unit, 'core').y - OVERKILL_UP - over }, STRINGS.fx.overkill, COLORS.accent);
        }
        break;
      }
      case 'momentum':
        // From the second machine of a turn the run is counted, over the one who is on it: above whatever else is
        // said of them just then (a run can end in an overheat), and one count at a time, the last making way for the next.
        if (event.chain >= 2) {
          this.effects = this.effects.filter((fx) => !(fx.kind === 'text' && fx.run));
          const at = s.centre(event.unit);
          this.say(0, { x: at.x, y: at.y - WORD_GAP }, STRINGS.fx.chain(event.chain), COLORS.accent, { run: true });
        }
        break;
      case 'boost': {
        const from = s.centre(event.unit);
        this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, from, aim: this.headingOf(event.unit) });
        break;
      }
      case 'shaken':
        this.add(0, 420, { kind: 'pulse', unit: event.unit });
        this.say(0, s.centre(event.unit), STRINGS.fx.shaken, COLORS.accent);
        break;
      case 'rout': {
        // It goes back the way it came: away from what it was facing. One that cannot move goes nowhere: it
        // goes dark where it stands, and is lost to sight there.
        const heading = this.headingOf(event.unit);
        const aim = event.fixed ? { x: 0, y: 0 } : { x: -heading.x || 0, y: -heading.y || 0 };
        this.add(0, LEAVE_MS, { kind: 'leave', unit: event.unit, from: s.centre(event.unit), aim });
        this.say(0, s.centre(event.unit), event.fixed ? STRINGS.fx.offline : STRINGS.fx.rout, COLORS.accent);
        break;
      }
      case 'cool':
        this.add(0, STEAM_MS, { kind: 'steam', at: s.centre(event.unit) });
        break;
      case 'turnSkipped':
        this.add(0, STEAM_MS, { kind: 'steam', at: s.centre(event.unit) });
        break;
      case 'repair': {
        const at = s.hitPoint(event.unit, event.part);
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: COLORS.armor });
        this.say(0, at, `+${event.amount}`, COLORS.armor);
        break;
      }
      case 'overheat':
        this.add(0, 480, { kind: 'pulse', unit: event.unit });
        this.say(0, s.centre(event.unit), STRINGS.fx.overheat, COLORS.danger);
        break;
      case 'guard':
        this.add(0, SHIELD_MS, { kind: 'shield', at: s.centre(event.unit), aim: this.headingOf(event.unit) });
        break;
      case 'stagger': {
        const at = s.centre(event.unit);
        this.jolt(0, 3, 260);
        this.add(0, 480, { kind: 'pulse', unit: event.unit });
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: COLORS.heat });
        this.say(0, at, STRINGS.fx.stagger, COLORS.heat);
        break;
      }
      case 'charge':
        this.add(0, GATHER_MS, { kind: 'gather', at: s.muzzle(event.unit, event.weapon), color: TYPE_COLOR[s.damageType(event.unit, event.weapon)] });
        break;
      case 'module': {
        const at = s.centre(event.unit);
        const color = MODULE_COLOR[event.effect] ?? COLORS.text;
        this.add(0, 320, { kind: 'burst', at, size: 22, color, style: 'ring' });
        this.say(0, at, STRINGS.fx.modules[event.effect], color);
        break;
      }
      case 'mend': {
        const at = s.hitPoint(event.target, event.part);
        this.add(0, SPARK_MS, { kind: 'sparks', at: s.centre(event.unit), color: COLORS.armor });
        this.add(120, SPARK_MS, { kind: 'sparks', at, color: COLORS.armor });
        this.say(120, at, `+${event.amount}`, COLORS.armor);
        break;
      }
      case 'fuse':
        this.add(0, 300, { kind: 'pulse', unit: event.unit });
        this.say(0, s.centre(event.unit), STRINGS.tags.fuse(event.left), event.left <= 1 ? COLORS.danger : COLORS.heat);
        break;
      case 'blast': {
        // The bomb throws itself at its target and goes up there.
        const from = s.centre(event.unit);
        const at = s.hitPoint(event.target, 'core');
        const size = this.sizeOf(event.target);
        this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, from, aim: this.wayTo(event.unit, event.target, at) });
        for (const [i, off] of [[0, 0], [-14, 8], [12, -10], [4, 14]].entries()) {
          this.add(MELEE_MS + i * 90, 380, { kind: 'burst', at: { x: at.x + off[0] * size, y: at.y + off[1] * size }, size: (i === 0 ? 26 : 18) * size, color: '#ff8a3c', style: 'fire' });
        }
        this.add(MELEE_MS, HIT_MS * 2, { kind: 'hit', unit: event.target });
        this.jolt(MELEE_MS, HARDEST_JOLT, 450);
        this.say(MELEE_MS, at, `-${event.damage}`, '#ffffff');
        break;
      }
      case 'launch': {
        const from = s.centre(event.unit);
        const at = s.centre(event.spawned);
        this.add(0, 260, { kind: 'burst', at: from, size: 12, color: COLORS.heat, style: 'ring' });
        this.add(0, 200, { kind: 'projectile', from, to: at, dtype: 'kinetic', grow: [this.sizeOf(event.unit), this.sizeOf(event.spawned)] });
        this.add(200, 320, { kind: 'burst', at, size: 16, color: COLORS.heat, style: 'ring' });
        break;
      }
      case 'arrive':
        // It is there all at once, in a ring of its own light: nobody on the field sent it.
        this.add(0, 320, { kind: 'burst', at: s.centre(event.unit), size: 16, color: COLORS.heat, style: 'ring' });
        break;
      case 'phase': {
        const at = s.centre(event.unit);
        this.jolt(0, 4, 500);
        this.add(0, 700, { kind: 'pulse', unit: event.unit });
        for (const [i, size] of [18, 30, 44].entries()) this.add(i * 140, 380, { kind: 'burst', at, size, color: COLORS.accent, style: 'ring' });
        this.say(0, at, STRINGS.fx.phase(event.phase + 1), COLORS.accent);
        break;
      }
      case 'support': {
        // Fire from an ally who is not on the field comes in from behind the player.
        const to = s.hitPoint(event.target, 'core');
        const from = { x: -6, y: Math.max(20, to.y - 40) };
        // It comes from as near as the pilot's own mech stands.
        this.add(0, PROJECTILE_MS, { kind: 'projectile', from, to, dtype: 'energy', grow: [this.scene.depth ? NEAR_SIZE : 1, this.sizeOf(event.target)] });
        this.add(PROJECTILE_MS, HIT_MS, { kind: 'hit', unit: event.target });
        this.jolt(PROJECTILE_MS, 2, 160);
        this.add(PROJECTILE_MS, HIT_MS, { kind: 'burst', at: to, size: 12, color: TYPE_COLOR.energy, style: 'impact' });
        this.say(PROJECTILE_MS, to, `-${event.damage}`, '#ffffff');
        break;
      }
      case 'asset': {
        if (event.lost <= 0) break;
        const freight = s.freight?.() ?? null;
        // What is being guarded and has no picture is nothing on the field: what it loses is written under the strip that names it, on the screen.
        if (!freight) { this.say(0, { x: 30, y: 44 }, `-${event.lost}`, COLORS.danger, { over: true }); break; }
        // With a picture it is struck where it stands: thrown and lit as a machine that is hit is, sparks off it, and what it lost over it.
        const { at, top } = freight;
        this.add(0, HIT_MS, { kind: 'hit', unit: FREIGHT });
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: COLORS.heat });
        this.add(0, HIT_MS, { kind: 'burst', at, size: 10 * FAR_SIZE, color: COLORS.heat, style: 'impact' });
        this.jolt(0, 1, 140);
        this.say(0, { x: at.x, y: top - 2 }, `-${event.lost}`, COLORS.danger);
        // With nothing left of it, it goes up as a machine does, far off: in pieces, then all at once.
        if (event.hp <= 0) {
          this.add(HIT_MS, DEATH_MS, { kind: 'death', unit: FREIGHT, at });
          for (const [i, off] of [[0, 0], [-8, 4], [7, -5]].entries()) {
            this.add(HIT_MS + i * 110, 280, { kind: 'burst', at: { x: at.x + off[0], y: at.y + off[1] }, size: (11 + i) * FAR_SIZE, color: '#ff8a3c', style: 'fire' });
          }
          this.add(HIT_MS + WRECK_AT, WRECK_MS, { kind: 'burst', at, size: WRECK_SIZE * FAR_SIZE, color: '#ff8a3c', style: 'fire' });
          this.jolt(HIT_MS, 3, 320);
        }
        break;
      }
      case 'fieldDown': {
        // The field goes out over the whole machine: sparks in the colour it had, and the word for it.
        const at = s.centre(event.unit);
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: COLORS.energy });
        this.say(0, at, STRINGS.fx.fieldDown, COLORS.energy);
        break;
      }
      case 'hardeningGone': {
        // The hardening goes in a shower off the whole machine, in the colour its word was written in.
        const at = s.centre(event.unit);
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: COLORS.accent });
        this.say(0, at, STRINGS.fx.hardeningGone, COLORS.accent);
        break;
      }
      case 'fieldUp': {
        const at = s.centre(event.unit);
        this.add(0, SHIELD_MS, { kind: 'shield', at, aim: this.headingOf(event.unit) });
        this.say(0, at, STRINGS.fx.fieldUp, COLORS.energy);
        break;
      }
      case 'turnStart':
        // What a core's buffer kept from the turn before is there now: said over the machine in the colour of energy.
        if (event.kept) {
          const at = s.centre(event.unit);
          this.say(0, { x: at.x, y: at.y - WORD_GAP }, STRINGS.fx.kept(event.kept), COLORS.energy);
        }
        break;
      case 'recover':
      case 'outcome':
        break;
    }
  }

  update(dtMs: number): void {
    this.now += dtMs;
    this.effects = this.effects.filter((fx) => {
      const done = this.now >= fx.start + fx.dur;
      if (done && (fx.kind === 'death' || fx.kind === 'leave')) this.gone.add(fx.unit);
      return !done;
    });
    this.jolts = this.jolts.filter((j) => this.now < j.start + j.dur || !j.felt);
  }

  private active(): { fx: Fx; p: number }[] {
    return this.effects
      .filter((fx) => this.now >= fx.start)
      .map((fx) => ({ fx, p: Math.min(1, (this.now - fx.start) / fx.dur) }));
  }

  /** True while anything is playing or waiting to play. */
  get busy(): boolean {
    return this.effects.length > 0;
  }

  /**
   * What an overkill adds to a machine going up, where the picture is not a calm one: its last blast
   * half as large again, and the hardest jolt there is. It lasts no longer than the blast it is laid over.
   */
  harder(unitId: string): void {
    const at = this.scene.centre(unitId);
    this.add(WRECK_AT, WRECK_MS, { kind: 'burst', at, size: WRECK_SIZE * OVERKILL_SIZE * this.sizeOf(unitId), color: '#ffd27f', style: 'fire' });
    this.jolt(WRECK_AT, HARDEST_JOLT, 300);
  }

  /** A unit whose destruction, or whose leaving, has finished playing; the screen stops drawing it. */
  isGone(unitId: string): boolean {
    return this.gone.has(unitId);
  }

  /** What is in the air now: where each thing fired comes from and where it is going, and how large it is at either end. */
  flights(): { from: Pt; to: Pt; grow: [number, number] }[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'projectile' ? [{ from: fx.from, to: fx.to, grow: fx.grow }] : []));
  }

  kinds(): string[] {
    return this.active().map(({ fx }) => fx.kind);
  }

  texts(): string[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'text' ? [fx.text] : []));
  }

  /** What is written over the field now: each figure or word, where it begins to rise from and in what colour. */
  written(): { text: string; at: Pt; color: string }[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'text' ? [{ text: fx.text, at: fx.at, color: fx.color }] : []));
  }

  /** What each burst that is playing looks like and how large it is, for tests: nobody can watch a test run. */
  bursts(): { style: BurstStyle; size: number }[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'burst' ? [{ style: fx.style, size: fx.size }] : []));
  }

  /** How to displace and tint a unit's sprite right now. */
  transform(unitId: string): UnitTransform {
    let dx = 0, dy = 0, lift = 0, alpha = 1, flash = false, glare = false, trail = 0, trailY = 0;
    for (const { fx, p } of this.active()) {
      if (!('unit' in fx) || fx.unit !== unitId) continue;
      // A gun kicks its mech back along its barrel; a lunge carries it along the line to what it is aimed at, and back.
      if (fx.kind === 'recoil') { dx -= fx.aim.x * RECOIL_PX * (1 - p); lift -= fx.aim.y * RECOIL_PX * (1 - p); glare ||= p < 0.6; }
      else if (fx.kind === 'lunge') {
        const out = Math.sin(Math.PI * p);
        dx += fx.aim.x * LUNGE_PX * out;
        lift += fx.aim.y * LUNGE_PX * out;
        trail = fx.aim.x * TRAIL_PX * out;
        trailY = fx.aim.y * TRAIL_PX * out;
      }
      else if (fx.kind === 'hit') { flash ||= p < 0.5; dx += Math.floor(p * 6) % 2 === 0 ? 2 : -2; }
      else if (fx.kind === 'pulse') flash ||= Math.floor(p * 4) % 2 === 0;
      // A wreck is seen coming apart before it fades: whole for the first half, gone at the end.
      else if (fx.kind === 'death') { alpha = Math.min(alpha, Math.min(1, 2 * (1 - p))); dy += 8 * p; flash ||= p < 0.25; }
      // A machine that breaks off gathers speed as it goes and is lost to sight on the way.
      else if (fx.kind === 'leave') {
        dx += fx.aim.x * LEAVE_PX * p * p;
        lift += fx.aim.y * LEAVE_PX * p * p;
        alpha = Math.min(alpha, 1 - p);
        trail = fx.aim.x * TRAIL_PX * p;
        trailY = fx.aim.y * TRAIL_PX * p;
      }
    }
    return { dx: px(dx), dy: px(dy), lift: px(lift), flash, alpha, glare, trail: px(trail), trailY: px(trailY) };
  }

  /**
   * Draws what is solid of every effect that is playing in one layer: flame, tracers, fire, rings, sparks,
   * smoke, figures. Without a layer, what is on the stage.
   */
  draw(ctx: CanvasRenderingContext2D, calm = false, layer: FxLayer = 'stage'): void {
    const playing = this.active().filter(({ fx }) => layerOf(fx) === layer);
    // What is written goes over what burns: a figure or a word is not lost behind a blast that went off after it.
    for (const { fx, p } of playing) if (fx.kind !== 'text') paintFx(ctx, fx, p, calm);
    for (const { fx, p } of playing) if (fx.kind === 'text') paintFx(ctx, fx, p, calm);
  }

  /**
   * The light that everything playing in one layer throws at this moment, for the screen to add: over the
   * field for what is on the stage, and before the one that fires for what is under it, so that the flash
   * of a hidden weapon is seen round its mech and does not light the back the camera sees.
   */
  lights(layer: FxLayer = 'stage'): Glow[] {
    return this.active().flatMap(({ fx, p }) => (layerOf(fx) === layer ? lightsOf(fx, p) : []));
  }
}
