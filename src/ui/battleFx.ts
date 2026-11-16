import type { BattleEvent } from '../core/battle';
import type { DamageType, FrameSlot, WeaponSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import { TYPE_COLOR, lightsOf, paintFx } from './fxPaint';
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
  damageType(unitId: string, weapon: WeaponSlot): DamageType;
  /** True when the weapon is a blade or a ram: it is swung, not fired. */
  isMelee(unitId: string, weapon: WeaponSlot): boolean;
}

export interface UnitTransform {
  dx: number;
  dy: number;
  flash: boolean;
  alpha: number;
  /** Lit by its own gun. */
  glare: boolean;
  /** How far behind it each of its after-images stands, with its sign: nothing while it is not lunging. */
  trail: number;
}

export const PROJECTILE_MS = 160;
export const SHELL_MS = 260;
export const HIT_MS = 220;
/** How long a shot of this type takes to reach its target. */
export const flightFor = (dtype: DamageType): number => (dtype === 'explosive' ? SHELL_MS : PROJECTILE_MS);
export const TEXT_MS = 650;
export const DEATH_MS = 550;
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
/** The last and largest blast of a machine going up: when it comes, and how long it burns. */
export const WRECK_AT = 300;
const WRECK_MS = 480;

/**
 * What a burst looks like: something struck (a flash, a ring, streaks), something went up (a
 * fireball, a shock ring, smoke), or something pulsed (a ring of its colour).
 */
export type BurstStyle = 'impact' | 'fire' | 'ring';

type Timed = { start: number; dur: number };
export type Fx = Timed & (
  | { kind: 'projectile'; from: Pt; to: Pt; dtype: DamageType }
  | { kind: 'muzzle'; at: Pt; dtype: DamageType; dir: number }
  | { kind: 'recoil'; unit: string; dir: number }
  | { kind: 'hit'; unit: string }
  | { kind: 'pulse'; unit: string }
  | { kind: 'lunge'; unit: string; dir: number; from: Pt }
  | { kind: 'death'; unit: string; at: Pt }
  | { kind: 'burst'; at: Pt; size: number; color: string; style: BurstStyle }
  | { kind: 'sparks'; at: Pt; color: string }
  | { kind: 'steam'; at: Pt }
  | { kind: 'text'; at: Pt; text: string; color: string }
  | { kind: 'slash'; at: Pt; dir: number; color: string }
  | { kind: 'shield'; at: Pt; dir: number }
  | { kind: 'gather'; at: Pt; color: string }
);

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
  /** Jolts to the whole field: when each lands, how long it lasts, how far it throws things, and whether it has been felt. */
  private jolts: { start: number; dur: number; amount: number; felt: boolean }[] = [];

  constructor(private scene: Scene) {}

  private add(delay: number, dur: number, fx: Fx extends infer T ? (T extends Timed ? Omit<T, 'start' | 'dur'> : never) : never): void {
    this.effects.push({ ...fx, start: this.now + delay, dur } as Fx);
  }

  private say(delay: number, at: Pt, text: string, color: string): void {
    this.add(delay, TEXT_MS, { kind: 'text', at: { x: at.x, y: at.y - 10 }, text, color });
  }

  /** Shakes the whole field by up to `amount` pixels for `dur`, starting after `delay`. */
  private jolt(delay: number, amount: number, dur: number): void {
    this.jolts.push({ start: this.now + delay, dur, amount, felt: false });
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

  onEvent(event: BattleEvent): void {
    const s = this.scene;
    switch (event.type) {
      case 'shot': {
        const dtype = s.damageType(event.unit, event.weapon);
        const from = s.muzzle(event.unit, event.weapon);
        const target = s.hitPoint(event.target, event.appliedTo);
        const dir = s.facing(event.unit);
        const melee = s.isMelee(event.unit, event.weapon);
        const flight = melee ? MELEE_MS : flightFor(dtype);
        if (melee) {
          // A blade is carried to the target by the mech itself.
          this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, dir, from: s.centre(event.unit) });
          this.add(flight, SLASH_MS, { kind: 'slash', at: target, dir, color: TYPE_COLOR[dtype] });
        } else {
          // A miss flies on past the target.
          const to = event.hit ? target : { x: target.x + dir * 34, y: target.y - 16 };
          this.add(0, MUZZLE_MS, { kind: 'muzzle', at: from, dtype, dir });
          this.add(0, RECOIL_MS, { kind: 'recoil', unit: event.unit, dir });
          this.add(0, flight, { kind: 'projectile', from, to, dtype });
        }
        if (event.hit) {
          // A hit that takes a real bite is felt by the whole field.
          if (event.damage >= 60) this.jolt(flight, 2, 170);
          this.add(flight, HIT_MS, { kind: 'hit', unit: event.target });
          // A shell goes up where it lands; anything else strikes.
          if (dtype === 'explosive') this.add(flight, HIT_MS + 120, { kind: 'burst', at: target, size: 14, color: TYPE_COLOR[dtype], style: 'fire' });
          else this.add(flight, HIT_MS, { kind: 'burst', at: target, size: 8, color: TYPE_COLOR[dtype], style: 'impact' });
          if (event.absorbed) this.say(flight, { x: target.x, y: target.y - 12 }, STRINGS.fx.block(event.absorbed), COLORS.energy);
          if (event.damage > 0 || !event.absorbed) this.say(flight, target, `-${event.damage}`, '#ffffff');
        } else {
          this.say(flight, target, STRINGS.fx.miss, '#c9c6e8');
        }
        break;
      }
      case 'partDestroyed': {
        const at = s.hitPoint(event.unit, event.part);
        this.add(0, SPARK_MS, { kind: 'sparks', at, color: '#ffd27f' });
        this.add(0, 280, { kind: 'burst', at, size: 9, color: '#ff8a3c', style: 'fire' });
        this.jolt(0, 2, 180);
        break;
      }
      case 'unitDestroyed': {
        const at = s.centre(event.unit);
        this.jolt(0, 3, 320);
        this.add(0, DEATH_MS, { kind: 'death', unit: event.unit, at });
        // It goes up in pieces first, and then all at once: that last blast outlasts the wreck.
        for (const [i, off] of [[0, 0], [-10, 6], [9, -7]].entries()) {
          this.add(i * 110, 280, { kind: 'burst', at: { x: at.x + off[0], y: at.y + off[1] }, size: 11 + i, color: '#ff8a3c', style: 'fire' });
        }
        this.add(WRECK_AT, WRECK_MS, { kind: 'burst', at, size: 26, color: '#ff8a3c', style: 'fire' });
        this.jolt(WRECK_AT, 4, 300);
        break;
      }
      case 'boost': {
        const from = s.centre(event.unit);
        this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, dir: s.facing(event.unit), from });
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
        this.add(0, SHIELD_MS, { kind: 'shield', at: s.centre(event.unit), dir: s.facing(event.unit) });
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
        this.add(0, LUNGE_MS, { kind: 'lunge', unit: event.unit, dir: s.facing(event.unit), from });
        for (const [i, off] of [[0, 0], [-14, 8], [12, -10], [4, 14]].entries()) {
          this.add(MELEE_MS + i * 90, 380, { kind: 'burst', at: { x: at.x + off[0], y: at.y + off[1] }, size: i === 0 ? 26 : 18, color: '#ff8a3c', style: 'fire' });
        }
        this.add(MELEE_MS, HIT_MS * 2, { kind: 'hit', unit: event.target });
        this.jolt(MELEE_MS, 5, 450);
        this.say(MELEE_MS, at, `-${event.damage}`, '#ffffff');
        break;
      }
      case 'launch': {
        const from = s.centre(event.unit);
        const at = s.centre(event.spawned);
        this.add(0, 260, { kind: 'burst', at: from, size: 12, color: COLORS.heat, style: 'ring' });
        this.add(0, 200, { kind: 'projectile', from, to: at, dtype: 'kinetic' });
        this.add(200, 320, { kind: 'burst', at, size: 16, color: COLORS.heat, style: 'ring' });
        break;
      }
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
        this.add(0, PROJECTILE_MS, { kind: 'projectile', from, to, dtype: 'energy' });
        this.add(PROJECTILE_MS, HIT_MS, { kind: 'hit', unit: event.target });
        this.jolt(PROJECTILE_MS, 2, 160);
        this.add(PROJECTILE_MS, HIT_MS, { kind: 'burst', at: to, size: 12, color: TYPE_COLOR.energy, style: 'impact' });
        this.say(PROJECTILE_MS, to, `-${event.damage}`, '#ffffff');
        break;
      }
      case 'asset':
        if (event.lost > 0) this.say(0, { x: 30, y: 44 }, `-${event.lost}`, COLORS.danger);
        break;
      case 'recover':
      case 'turnStart':
      case 'outcome':
        break;
    }
  }

  update(dtMs: number): void {
    this.now += dtMs;
    this.effects = this.effects.filter((fx) => {
      const done = this.now >= fx.start + fx.dur;
      if (done && fx.kind === 'death') this.gone.add(fx.unit);
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

  /** A unit whose destruction has finished playing; the screen stops drawing it. */
  isGone(unitId: string): boolean {
    return this.gone.has(unitId);
  }

  kinds(): string[] {
    return this.active().map(({ fx }) => fx.kind);
  }

  texts(): string[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'text' ? [fx.text] : []));
  }

  /** What each burst that is playing looks like and how large it is, for tests: nobody can watch a test run. */
  bursts(): { style: BurstStyle; size: number }[] {
    return this.active().flatMap(({ fx }) => (fx.kind === 'burst' ? [{ style: fx.style, size: fx.size }] : []));
  }

  /** How to displace and tint a unit's sprite right now. */
  transform(unitId: string): UnitTransform {
    let dx = 0, dy = 0, alpha = 1, flash = false, glare = false, trail = 0;
    for (const { fx, p } of this.active()) {
      if (!('unit' in fx) || fx.unit !== unitId) continue;
      if (fx.kind === 'recoil') { dx -= fx.dir * 3 * (1 - p); glare ||= p < 0.6; }
      else if (fx.kind === 'lunge') { dx += fx.dir * 9 * Math.sin(Math.PI * p); trail = fx.dir * 7 * Math.sin(Math.PI * p); }
      else if (fx.kind === 'hit') { flash ||= p < 0.5; dx += Math.floor(p * 6) % 2 === 0 ? 2 : -2; }
      else if (fx.kind === 'pulse') flash ||= Math.floor(p * 4) % 2 === 0;
      // A wreck is seen coming apart before it fades: whole for the first half, gone at the end.
      else if (fx.kind === 'death') { alpha = Math.min(alpha, Math.min(1, 2 * (1 - p))); dy += 8 * p; flash ||= p < 0.25; }
    }
    return { dx: px(dx), dy: px(dy), flash, alpha, glare, trail: px(trail) };
  }

  /** Draws what is solid of every effect that is playing: flame, tracers, fire, rings, sparks, smoke, figures. */
  draw(ctx: CanvasRenderingContext2D, calm = false): void {
    for (const { fx, p } of this.active()) paintFx(ctx, fx, p, calm);
  }

  /** The light that everything playing throws at this moment, for the screen to add over the field. */
  lights(): Glow[] {
    return this.active().flatMap(({ fx, p }) => lightsOf(fx, p));
  }
}
