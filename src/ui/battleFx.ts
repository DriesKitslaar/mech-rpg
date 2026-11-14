import type { BattleEvent } from '../core/battle';
import type { DamageType, FrameSlot, WeaponSlot } from '../core/types';
import { STRINGS } from '../content/strings';
import { COLORS, drawText } from './widgets';

export type Pt = { x: number; y: number };

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

export interface UnitTransform { dx: number; dy: number; flash: boolean; alpha: number }

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

type Timed = { start: number; dur: number };
type Fx = Timed & (
  | { kind: 'projectile'; from: Pt; to: Pt; dtype: DamageType }
  | { kind: 'muzzle'; at: Pt; dtype: DamageType }
  | { kind: 'recoil'; unit: string; dir: number }
  | { kind: 'hit'; unit: string }
  | { kind: 'pulse'; unit: string }
  | { kind: 'lunge'; unit: string; dir: number; from: Pt }
  | { kind: 'death'; unit: string; at: Pt }
  | { kind: 'burst'; at: Pt; size: number; color: string }
  | { kind: 'sparks'; at: Pt; color: string }
  | { kind: 'steam'; at: Pt }
  | { kind: 'text'; at: Pt; text: string; color: string }
  | { kind: 'slash'; at: Pt; dir: number; color: string }
  | { kind: 'shield'; at: Pt; dir: number }
  | { kind: 'gather'; at: Pt; color: string }
);

const TYPE_COLOR: Record<DamageType, string> = { kinetic: '#ffe9a8', energy: '#7fe9ff', explosive: '#ffb46b' };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
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

  constructor(private scene: Scene) {}

  private add(delay: number, dur: number, fx: Fx extends infer T ? (T extends Timed ? Omit<T, 'start' | 'dur'> : never) : never): void {
    this.effects.push({ ...fx, start: this.now + delay, dur } as Fx);
  }

  private say(delay: number, at: Pt, text: string, color: string): void {
    this.add(delay, TEXT_MS, { kind: 'text', at: { x: at.x, y: at.y - 10 }, text, color });
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
          this.add(0, 70, { kind: 'muzzle', at: from, dtype });
          this.add(0, RECOIL_MS, { kind: 'recoil', unit: event.unit, dir });
          this.add(0, flight, { kind: 'projectile', from, to, dtype });
        }
        if (event.hit) {
          this.add(flight, HIT_MS, { kind: 'hit', unit: event.target });
          this.add(flight, HIT_MS, { kind: 'burst', at: target, size: dtype === 'explosive' ? 14 : 7, color: TYPE_COLOR[dtype] });
          if (event.absorbed) this.say(flight, { x: target.x, y: target.y - 12 }, STRINGS.fx.block(event.absorbed), COLORS.energy);
          if (event.damage > 0 || !event.absorbed) this.say(flight, target, `-${event.damage}`, '#ffffff');
        } else {
          this.say(flight, target, STRINGS.fx.miss, '#c9c6e8');
        }
        break;
      }
      case 'partDestroyed':
        this.add(0, SPARK_MS, { kind: 'sparks', at: s.hitPoint(event.unit, event.part), color: '#ffd27f' });
        break;
      case 'unitDestroyed': {
        const at = s.centre(event.unit);
        this.add(0, DEATH_MS, { kind: 'death', unit: event.unit, at });
        for (const [i, off] of [[0, 0], [-10, 6], [9, -7]].entries()) {
          this.add(i * 130, 300, { kind: 'burst', at: { x: at.x + off[0], y: at.y + off[1] }, size: 16, color: '#ff8a3c' });
        }
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
        this.add(0, 320, { kind: 'burst', at, size: 22, color });
        this.say(0, at, STRINGS.fx.modules[event.effect], color);
        break;
      }
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

  /** How to displace and tint a unit's sprite right now. */
  transform(unitId: string): UnitTransform {
    let dx = 0, dy = 0, alpha = 1, flash = false;
    for (const { fx, p } of this.active()) {
      if (!('unit' in fx) || fx.unit !== unitId) continue;
      if (fx.kind === 'recoil') dx -= fx.dir * 3 * (1 - p);
      else if (fx.kind === 'lunge') dx += fx.dir * 9 * Math.sin(Math.PI * p);
      else if (fx.kind === 'hit') { flash ||= p < 0.5; dx += Math.floor(p * 6) % 2 === 0 ? 2 : -2; }
      else if (fx.kind === 'pulse') flash ||= Math.floor(p * 4) % 2 === 0;
      else if (fx.kind === 'death') { alpha = Math.min(alpha, 1 - p); dy += 8 * p; flash ||= p < 0.25; }
    }
    return { dx: px(dx), dy: px(dy), flash, alpha };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const { fx, p } of this.active()) {
      switch (fx.kind) {
        case 'muzzle': this.dot(ctx, fx.at, 5 - 2 * p, '#ffffff'); this.dot(ctx, fx.at, 3, TYPE_COLOR[fx.dtype]); break;
        case 'projectile': this.projectile(ctx, fx, p); break;
        case 'burst': this.ring(ctx, fx.at, 2 + fx.size * p, fx.color, 1 - p); if (p < 0.4) this.dot(ctx, fx.at, fx.size * 0.4, '#ffffff'); break;
        case 'sparks': this.sparks(ctx, fx.at, p, fx.color); break;
        case 'steam': this.steam(ctx, fx.at, p); break;
        case 'lunge': this.streaks(ctx, fx.from, fx.dir, p); break;
        case 'slash': this.slash(ctx, fx.at, fx.dir, p, fx.color); break;
        case 'shield': this.shield(ctx, fx.at, fx.dir, p); break;
        case 'gather': this.gather(ctx, fx.at, p, fx.color); break;
        case 'text':
          ctx.globalAlpha = 1 - p * p;
          drawText(ctx, fx.text, px(fx.at.x) + 1, px(fx.at.y - 16 * p) + 1, { size: 16, align: 'center', color: '#000000' });
          drawText(ctx, fx.text, px(fx.at.x), px(fx.at.y - 16 * p), { size: 16, align: 'center', color: fx.color });
          ctx.globalAlpha = 1;
          break;
        default: break; // unit effects are applied through transform()
      }
    }
  }

  private dot(ctx: CanvasRenderingContext2D, at: Pt, size: number, color: string): void {
    const s = Math.max(1, px(size));
    ctx.fillStyle = color;
    ctx.fillRect(px(at.x - s / 2), px(at.y - s / 2), s, s);
  }

  private ring(ctx: CanvasRenderingContext2D, at: Pt, radius: number, color: string, alpha: number): void {
    ctx.globalAlpha = Math.max(0, alpha);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.dot(ctx, { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius }, 2, color);
    }
    ctx.globalAlpha = 1;
  }

  private sparks(ctx: CanvasRenderingContext2D, at: Pt, p: number, color: string): void {
    ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const d = (8 + (i % 3) * 5) * p;
      this.dot(ctx, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d + 6 * p * p }, 2, i % 2 ? color : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  private steam(ctx: CanvasRenderingContext2D, at: Pt, p: number): void {
    ctx.globalAlpha = 0.7 * (1 - p);
    for (let i = 0; i < 5; i++) {
      this.dot(ctx, { x: at.x - 16 + i * 8 + Math.sin(p * 6 + i) * 2, y: at.y - 20 - (18 + i * 3) * p }, 3 + 3 * p, '#dfe6f5');
    }
    ctx.globalAlpha = 1;
  }

  /** A blade's arc: a diagonal sweep of bright dots across the point of impact. */
  private slash(ctx: CanvasRenderingContext2D, at: Pt, dir: number, p: number, color: string): void {
    ctx.globalAlpha = 1 - p * p;
    for (let i = 0; i < 9; i++) {
      const t = i / 8 - 0.5;
      const reach = Math.min(1, p * 2.5);
      if (Math.abs(t) > reach / 2 + 0.05) continue;
      this.dot(ctx, { x: at.x + dir * t * 30, y: at.y + t * 34 }, i % 2 ? 3 : 2, i % 3 === 0 ? '#ffffff' : color);
    }
    ctx.globalAlpha = 1;
  }

  /** A guard: a curved wall of dots between the unit and whoever it faces. */
  private shield(ctx: CanvasRenderingContext2D, at: Pt, dir: number, p: number): void {
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, p * 1.2)) * 0.9;
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 1.6;
      this.dot(ctx, { x: at.x + dir * (26 + Math.cos(a) * 10), y: at.y + Math.sin(a) * 36 }, 2, i % 2 ? COLORS.armor : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  /** A charge: motes drawn in towards the weapon. */
  private gather(ctx: CanvasRenderingContext2D, at: Pt, p: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + p * 2;
      const d = 22 * (1 - p);
      this.dot(ctx, { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d }, 2, i % 2 ? color : '#ffffff');
    }
    if (p > 0.6) this.dot(ctx, at, 4, '#ffffff');
  }

  private streaks(ctx: CanvasRenderingContext2D, from: Pt, dir: number, p: number): void {
    ctx.globalAlpha = 0.8 * (1 - p);
    ctx.fillStyle = COLORS.energy;
    for (let i = 0; i < 4; i++) {
      const len = 14 + i * 4;
      ctx.fillRect(px(from.x - dir * (20 + len * p) - (dir > 0 ? len : 0)), px(from.y - 24 + i * 16), len, 1);
    }
    ctx.globalAlpha = 1;
  }

  private projectile(ctx: CanvasRenderingContext2D, fx: Extract<Fx, { kind: 'projectile' }>, p: number): void {
    const color = TYPE_COLOR[fx.dtype];
    const at = (t: number): Pt => ({ x: lerp(fx.from.x, fx.to.x, t), y: lerp(fx.from.y, fx.to.y, t) });
    if (fx.dtype === 'energy') {
      // A beam: reaches the target quickly, then flickers.
      const end = at(Math.min(1, p * 2.5));
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.floor(p * 10) % 2 ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (fx.dtype === 'explosive') {
      // A shell on a shallow arc with a short trail.
      for (let i = 0; i < 4; i++) {
        const t = Math.max(0, p - i * 0.06);
        const pos = at(t);
        this.dot(ctx, { x: pos.x, y: pos.y - Math.sin(Math.PI * t) * 14 }, i === 0 ? 4 : 2, i === 0 ? '#ffffff' : color);
      }
    } else {
      // Three tracers in quick succession.
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const t = p - i * 0.18;
        if (t <= 0) continue;
        const a = at(Math.min(1, t)), b = at(Math.max(0, Math.min(1, t) - 0.2));
        ctx.beginPath(); ctx.moveTo(b.x, b.y + i - 1); ctx.lineTo(a.x, a.y + i - 1); ctx.stroke();
      }
    }
  }
}
