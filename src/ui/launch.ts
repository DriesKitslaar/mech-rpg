import type { Build } from '../core/types';
import type { SoundName } from '../platform/audio';
import { LOGICAL_H, LOGICAL_W } from './display';
import { disc, drawGlow, pixelLine } from './light';
import { layMech, mechSprites, type MechSprites } from './mechView';
import { idlePose } from './pose';
import { MIN_TALL, canWrite, drawWord, fitTall, wordLevel } from './signType';
import type { SpriteStore } from './sprites';
import { COLORS, drawText } from './widgets';

/**
 * The launch that opens a contract flown from the hangar: the pilot's own machine from behind on
 * the catapult, three lamps, and away down the tunnel into the light. It is the first stage of the
 * contract's own screen, which holds the battle still until this is over (see `MissionHost`).
 */

/** How long the machine stands on the catapult while the lamps come on, and how long it takes to go. */
export const LAUNCH_READY_MS = 700;
export const LAUNCH_GO_MS = 800;
export const LAUNCH_MS = LAUNCH_READY_MS + LAUNCH_GO_MS;
/** How long the light the machine went into still lies over the battle as it opens. */
export const LAUNCH_GLOW_MS = 200;
/** When each of the three lamps comes on. */
export const LAMPS_AT = [140, 330, 520] as const;
/** The picture of the tunnel. */
export const LAUNCH_PICTURE = 'launch-tunnel';
/** The opening at the tunnel's far end, in that picture: the machine goes to it, and the light comes out of it. */
export const LAUNCH_EXIT = { x: 155, y: 108 };
/** Where the machine stands before it goes: its feet on the rail, the middle of its body over the middle of the rail. */
export const LAUNCH_FEET = { x: 155, y: 258 };
/** Where, in the box a machine is drawn in from behind, the middle of its body is and its feet are. */
export const LAUNCH_BODY = { x: 54, y: 124 };
/** How much smaller than itself the machine is as it reaches the opening: one part in so many. */
export const LAUNCH_FAR = 15;
/** How long the word stands across the picture as the catapult fires. */
export const LAUNCH_WORD_MS = 520;
/** The lines of light that run out of the opening as the machine goes, and how many of them a calm picture has. */
export const LAUNCH_LINES = 14;
export const LAUNCH_LINES_CALM = 6;
/** Where the lamps hang, the middle one over the middle of the rail, and what colour each burns. */
export const LAUNCH_LAMPS = { y: 30, gap: 14, colors: [COLORS.danger, COLORS.heat, '#62e27f'] } as const;
/** Where the two boosters on the machine's back are, measured from its feet, and how long their flames are, on the machine as it stands. */
export const LAUNCH_BOOSTERS = { dx: 10, up: 58, long: 34 } as const;
/** What the picture goes to as the machine reaches the opening: the light it went into, or in a calm picture the dark. */
export const LAUNCH_VEIL = { light: '#ffffff', calm: '#07061a' } as const;

export interface LaunchOpts {
  /** A calm picture: nothing shakes, the lines of light stand still, and the picture goes to the battle through dark. */
  calm: boolean;
  sfx?: { play(name: SoundName, delayMs?: number): void };
  rumble(ms: number): void;
  /** How long the handheld rumbles as the catapult fires. */
  rumbleMs: number;
  /** Written over the picture: the pilot, the class of the machine, where this is, and the word as it goes. */
  callsign: string;
  kind: string;
  bay: string;
  go: string;
}

/** How far through its going the machine is: 0 until the catapult fires, 1 at the opening. */
export const launchShare = (ms: number): number => Math.max(0, Math.min(1, (ms - LAUNCH_READY_MS) / LAUNCH_GO_MS));

/** How large the machine is drawn this far through its going: itself as it stands, a fifteenth of itself at the opening. It gathers speed as it goes. */
export const launchScale = (share: number): number => 1 / (1 + (LAUNCH_FAR - 1) * share * share);

/** Where its feet are this far through its going: on the rail, which runs to the foot of the opening. */
export function launchFeet(share: number): { x: number; y: number } {
  const near = (launchScale(share) - 1 / LAUNCH_FAR) / (1 - 1 / LAUNCH_FAR);
  const end = LAUNCH_EXIT.y + 4;
  return { x: LAUNCH_FEET.x, y: Math.round(end + (LAUNCH_FEET.y - end) * near) };
}

/** How much of the picture the light at the opening has taken this far through the going: none until past halfway, all of it at the end. */
export function launchBloom(share: number): number {
  // (Counted in whole parts of ten thousand, so that it begins at exactly nothing and ends at exactly all of it.)
  const p = Math.max(0, Math.min(1, (Math.round(share * 10000) - 5500) / 4500));
  return p * p;
}

/** Lays what the picture goes to over all of it, this strongly: for the end of the launch, and for the battle that opens out of it. */
export function drawLaunchVeil(ctx: CanvasRenderingContext2D, strength: number, calm: boolean): void {
  const alpha = Math.max(0, Math.min(1, strength));
  if (alpha <= 0) return;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = calm ? LAUNCH_VEIL.calm : LAUNCH_VEIL.light;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.globalAlpha = before;
}

/** The directions the lines of light run in, round the opening: spread evenly, none of them straight down the rail. */
const lineAngle = (i: number, of: number): number => ((i + 0.5) / of) * Math.PI * 2 + 0.2;

export class LaunchScene {
  private ms = 0;
  private readonly parts: MechSprites;

  constructor(private sprites: SpriteStore, build: Build, paint: string | undefined, private opts: LaunchOpts) {
    this.parts = mechSprites(sprites, build, paint, 'back');
  }

  /** True once the machine has gone. */
  get done(): boolean {
    return this.ms >= LAUNCH_MS;
  }

  /** Lets time pass: each lamp is heard as it comes on, and the catapult is heard and felt as it fires. */
  update(dtMs: number): void {
    if (this.done) return;
    const before = this.ms;
    this.ms = Math.min(LAUNCH_MS, this.ms + Math.max(0, dtMs));
    const reached = (at: number): boolean => before < at && this.ms >= at;
    for (const at of LAMPS_AT) if (reached(at)) this.opts.sfx?.play('lamp');
    if (reached(LAUNCH_READY_MS)) {
      this.opts.sfx?.play('catapult');
      this.opts.rumble(this.opts.rumbleMs);
    }
  }

  view(): { ms: number; stage: 'ready' | 'go'; lamps: number } {
    return { ms: this.ms, stage: this.ms < LAUNCH_READY_MS ? 'ready' : 'go', lamps: LAMPS_AT.filter((at) => this.ms >= at).length };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { calm } = this.opts;
    const going = this.ms >= LAUNCH_READY_MS;
    const share = launchShare(this.ms);
    ctx.fillStyle = LAUNCH_VEIL.calm;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    // The picture shakes as the catapult fires and stills as the machine gets away. A calm picture stands.
    const shake = going && !calm ? Math.round(2 * (1 - share) * Math.sin(this.ms / 18)) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    const picture = this.sprites.get(LAUNCH_PICTURE, { w: LOGICAL_W, h: LOGICAL_H, label: LAUNCH_PICTURE });
    ctx.drawImage(picture.image, 0, 0, LOGICAL_W, LOGICAL_H);
    if (going) this.drawLines(ctx, share);
    this.drawMachine(ctx, share, going);
    ctx.restore();
    this.drawLamps(ctx);
    this.drawWords(ctx, going);
    // The light at the opening takes the picture; in a calm one the dark does.
    const bloom = launchBloom(share);
    if (bloom > 0 && !calm) drawGlow(ctx, { x: LAUNCH_EXIT.x, y: LAUNCH_EXIT.y, r: Math.round(24 + 260 * bloom), color: LAUNCH_VEIL.light, alpha: Math.min(1, bloom * 1.4) });
    drawLaunchVeil(ctx, bloom, calm);
  }

  /** Lines of light running out of the opening towards the edges: longer and further out as the machine gathers speed. A calm picture has a few, standing still. */
  private drawLines(ctx: CanvasRenderingContext2D, share: number): void {
    const { calm } = this.opts;
    const count = calm ? LAUNCH_LINES_CALM : LAUNCH_LINES;
    const run = calm ? 0 : this.ms - LAUNCH_READY_MS;
    for (let i = 0; i < count; i++) {
      const angle = lineAngle(i, count);
      // Each starts a little further out than the one before it and comes round again from the opening.
      const from = 14 + ((run * 0.5 + i * 37) % 150);
      const long = calm ? 20 : 8 + 34 * share;
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      pixelLine(
        ctx, { x: LAUNCH_EXIT.x + cos * from, y: LAUNCH_EXIT.y + sin * from }, { x: LAUNCH_EXIT.x + cos * (from + long), y: LAUNCH_EXIT.y + sin * (from + long) },
        i % 2 === 0 ? '#ffd27a' : '#8fe6ff',
      );
    }
  }

  /** The machine on the rail: standing while the lamps come on, braced as the last one does, then smaller and further up the rail with its boosters lit. */
  private drawMachine(ctx: CanvasRenderingContext2D, share: number, going: boolean): void {
    const scale = launchScale(share);
    const feet = launchFeet(share);
    // It settles onto the catapult as the last lamp comes on.
    const brace = !going && this.ms >= LAMPS_AT[2] ? 2 : 0;
    ctx.save();
    ctx.translate(feet.x, feet.y + brace);
    ctx.scale(scale, scale);
    layMech(ctx, this.sprites, this.parts, -LAUNCH_BODY.x, -LAUNCH_BODY.y, { dx: 0, dy: 0 }, 0, going ? {} : idlePose(this.ms), 'back');
    ctx.restore();
    if (going) this.drawBoosters(ctx, feet, scale);
  }

  /**
   * The two boosters on its back, burning towards whoever watches it go: a light round each where
   * there is soft light, and a flame that is drawn either way, widest and whitest at the nozzle.
   * The flames flicker; in a calm picture they burn steadily.
   */
  private drawBoosters(ctx: CanvasRenderingContext2D, feet: { x: number; y: number }, scale: number): void {
    const { dx, up, long } = LAUNCH_BOOSTERS;
    const burn = this.opts.calm ? 0.85 : 0.7 + 0.3 * Math.abs(Math.sin(this.ms / 23));
    const tall = Math.max(3, Math.round(long * scale * burn));
    const y = feet.y - Math.round(up * scale);
    for (const side of [-1, 1]) {
      const x = feet.x + Math.round(side * dx * scale);
      drawGlow(ctx, { x, y, r: Math.round(6 + 24 * scale), color: '#8fe6ff', alpha: 0.8 });
      ([[7, '#ffffff'], [5, '#c9f4ff'], [3, '#6fd0ff']] as const).forEach(([wide, color], i) => {
        const w = Math.max(1, Math.round(wide * scale));
        ctx.fillStyle = color;
        ctx.fillRect(x - Math.floor(w / 2), y + Math.round((tall * i) / 3), w, Math.max(1, Math.ceil(tall / 3)));
      });
    }
  }

  /** The three lamps in their housing: dark until their moment, then each in its colour with its light round it. */
  private drawLamps(ctx: CanvasRenderingContext2D): void {
    const { y, gap, colors } = LAUNCH_LAMPS;
    const lit = LAMPS_AT.filter((at) => this.ms >= at).length;
    ctx.fillStyle = 'rgba(8, 8, 20, 0.85)';
    ctx.fillRect(LAUNCH_EXIT.x - gap - 7, y - 7, gap * 2 + 15, 15);
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(LAUNCH_EXIT.x - gap - 7, y - 7, gap * 2 + 15, 1);
    ctx.fillRect(LAUNCH_EXIT.x - gap - 7, y + 7, gap * 2 + 15, 1);
    colors.forEach((color, i) => {
      const x = LAUNCH_EXIT.x + (i - 1) * gap;
      disc(ctx, x, y, 4, i < lit ? color : COLORS.empty);
      if (i < lit) drawGlow(ctx, { x, y, r: 12, color, alpha: 0.6 });
    });
  }

  /** Who is going, in what, and from where; and the word across the picture as the catapult fires. */
  private drawWords(ctx: CanvasRenderingContext2D, going: boolean): void {
    const { callsign, kind, bay, go, calm } = this.opts;
    if (callsign) drawText(ctx, callsign, 10, 18, { color: COLORS.text });
    drawText(ctx, kind, 10, callsign ? 30 : 18, { color: COLORS.armor, size: 10 });
    drawText(ctx, bay, LOGICAL_W - 10, 18, { align: 'right', color: COLORS.dim, size: 10 });
    const since = this.ms - LAUNCH_READY_MS;
    if (!going || since >= LAUNCH_WORD_MS) return;
    const tall = fitTall(go, LOGICAL_W - 60, 30);
    if (tall !== null && canWrite(go)) drawWord(ctx, go, LOGICAL_W / 2, 52, { tall: Math.max(MIN_TALL, tall), metal: 'amber', level: wordLevel(since, calm) });
    else drawText(ctx, go, LOGICAL_W / 2, 58, { align: 'center', size: 16, color: COLORS.heat });
  }
}
