/**
 * Small things in the air: shell casings, sparks, chunks of a destroyed machine, smoke, dust.
 * Each is a square of a few pixels with a speed, a weight and a lifetime. Nothing here knows about
 * the battle; it is told where to throw what, and when.
 */
export type ParticleKind = 'casing' | 'sparks' | 'embers' | 'debris' | 'smoke' | 'dust';
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  /** Milliseconds lived and to live. */
  age: number; life: number;
  size: number; grow: number;
  /** Downward pull, in pixels a second squared; smoke has a negative one. */
  gravity: number;
  color: string;
  /** Where the ground is for this one, if it lands. */
  floor?: number;
}
export type Pt = { x: number; y: number };

/** More than this at once is never kept: the oldest make way. */
export const MAX_PARTICLES = 220;

const COLORS = {
  casing: ['#e8c466', '#b8923c'], sparks: ['#fff2b0', '#ffd15a', '#ffffff'], embers: ['#ff8a3c', '#ffd15a', '#ff5a36'],
  debris: ['#3a3a4c', '#56566c', '#22222e', '#8a6a4a'], smoke: ['#46445a', '#5a586e', '#32303e'], dust: ['#8c8478', '#6e685e'],
};

export class Particles {
  private live: Particle[] = [];
  private waiting: { at: number; kind: ParticleKind; from: Pt; dir: number; floor?: number; color?: string }[] = [];
  private now = 0;
  private state: number;

  constructor(seed = 1, private moving = true) {
    this.state = (seed | 0) || 1;
  }

  /** A number from 0 up to 1, the same sequence for the same seed. */
  private random(): number {
    this.state = (Math.imul(this.state, 1103515245) + 12345) & 0x7fffffff;
    return this.state / 0x80000000;
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  /**
   * Throws a burst of one kind from a point. `dir` is the way the unit it comes from faces (1 right,
   * -1 left); `floor` is where what falls comes to rest; `color` tints sparks by what struck.
   */
  emit(kind: ParticleKind, from: Pt, dir: number, delayMs = 0, floor?: number, color?: string): void {
    if (!this.moving) return;
    this.waiting.push({ at: this.now + delayMs, kind, from, dir, floor, color });
  }

  private spawn(kind: ParticleKind, from: Pt, dir: number, floor?: number, color?: string): void {
    const pick = (list: string[]): string => list[Math.floor(this.random() * list.length)];
    const add = (p: Omit<Particle, 'age'>): void => { this.live.push({ ...p, age: 0 }); };
    switch (kind) {
      case 'casing':
        add({ x: from.x - dir * 6, y: from.y - 2, vx: -dir * this.between(40, 70), vy: -this.between(70, 110), life: 1500, size: 2, grow: 0, gravity: 520, color: pick(COLORS.casing), floor });
        break;
      case 'sparks':
        for (let i = 0, n = 6 + Math.floor(this.random() * 5); i < n; i++) {
          const angle = this.between(0, Math.PI * 2);
          const speed = this.between(40, 150);
          add({ x: from.x, y: from.y, vx: Math.cos(angle) * speed - dir * 30, vy: Math.sin(angle) * speed - 30, life: this.between(140, 320), size: 1, grow: 0, gravity: 260, color: color && this.random() < 0.6 ? color : pick(COLORS.sparks) });
        }
        break;
      case 'embers':
        for (let i = 0; i < 8; i++) add({ x: from.x + this.between(-8, 8), y: from.y + this.between(-6, 6), vx: this.between(-25, 25), vy: -this.between(20, 70), life: this.between(400, 900), size: 1, grow: 0, gravity: -20, color: pick(COLORS.embers) });
        break;
      case 'debris':
        for (let i = 0, n = 10 + Math.floor(this.random() * 6); i < n; i++) {
          const angle = this.between(-Math.PI, 0);
          const speed = this.between(50, 170);
          add({ x: from.x + this.between(-6, 6), y: from.y + this.between(-6, 6), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: this.between(500, 1000), size: 1 + Math.floor(this.random() * 3), grow: 0, gravity: 420, color: pick(COLORS.debris), floor });
        }
        break;
      case 'smoke':
        for (let i = 0; i < 5; i++) add({ x: from.x + this.between(-6, 6), y: from.y + this.between(-4, 4), vx: this.between(-10, 10), vy: -this.between(14, 34), life: this.between(700, 1300), size: 3, grow: 7, gravity: -8, color: pick(COLORS.smoke) });
        break;
      case 'dust':
        for (let i = 0; i < 6; i++) add({ x: from.x + this.between(-10, 10), y: from.y, vx: -dir * this.between(20, 80), vy: -this.between(4, 22), life: this.between(300, 600), size: 2, grow: 4, gravity: 30, color: pick(COLORS.dust) });
        break;
    }
    if (this.live.length > MAX_PARTICLES) this.live.splice(0, this.live.length - MAX_PARTICLES);
  }

  update(dtMs: number): void {
    this.now += dtMs;
    const due = this.waiting.filter((w) => w.at <= this.now);
    this.waiting = this.waiting.filter((w) => w.at > this.now);
    for (const w of due) this.spawn(w.kind, w.from, w.dir, w.floor, w.color);
    const dt = dtMs / 1000;
    for (const p of this.live) {
      p.age += dtMs;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      // What lands bounces once, weakly, and then lies still.
      if (p.floor !== undefined && p.y >= p.floor && p.vy > 0) {
        p.y = p.floor;
        p.vy = Math.abs(p.vy) > 60 ? -p.vy * 0.3 : 0;
        p.vx *= 0.5;
        if (p.vy === 0) p.gravity = 0;
      }
    }
    this.live = this.live.filter((p) => p.age < p.life);
  }

  get count(): number {
    return this.live.length;
  }

  all(): readonly Particle[] {
    return this.live;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.live) {
      const left = 1 - p.age / p.life;
      const size = Math.max(1, Math.round(p.size));
      ctx.globalAlpha = p.grow > 0 ? Math.max(0, left * 0.6) : left < 0.3 ? left / 0.3 : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }
}
