/**
 * Light. The game's pictures are pixels and stay pixels; what is added here is of two kinds. Soft
 * light (glow, shadow, beams) is drawn smooth, at whatever resolution the screen has, and added to
 * what is under it. Solid light (fire, rings, flashes) is drawn on the pixel grid like everything
 * else. A canvas that cannot make a gradient, as the tests' stand-ins cannot, is left alone by the
 * soft kind: nothing is drawn and nothing fails.
 */
export type Pt = { x: number; y: number };

/** A round light: brightest at its centre, gone at its edge. */
export interface Glow { x: number; y: number; r: number; color: string; alpha: number }

/** More lights than this at once are never drawn: the brightest are kept. */
export const MAX_LIGHTS = 16;
/** A light wider than this covers the field: a calm picture leaves it out. */
export const FIELD_LIGHT = 80;

/** Rounds to the pixel grid without ever producing negative zero. */
const px = (n: number): number => Math.round(n) || 0;

/** The red, green and blue of '#rrggbb'; white for anything else. */
export function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

/** How much a light adds to the picture, for telling the brightest from the rest. */
export const brightness = (glow: Glow): number => Math.max(0, glow.alpha) * glow.r * glow.r;

/** Adds one soft light to what is there. `strength` scales it: a calm picture asks for half. */
export function drawGlow(ctx: CanvasRenderingContext2D, glow: Glow, strength = 1): void {
  const alpha = Math.max(0, Math.min(1, glow.alpha * strength));
  if (alpha < 0.01 || glow.r <= 0) return;
  const gradient = ctx.createRadialGradient?.(glow.x, glow.y, 0, glow.x, glow.y, glow.r) as CanvasGradient | undefined;
  if (!gradient || typeof gradient.addColorStop !== 'function') return;
  const [r, g, b] = rgb(glow.color);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`);
  gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.45).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  const before = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2);
  ctx.globalCompositeOperation = before;
}

/**
 * The lights that are drawn of those there are: the brightest, and in a calm picture none that
 * covers the field. `most` is how many there is room for, where some of the room is taken already.
 */
export function chosenLights(glows: readonly Glow[], calm = false, most = MAX_LIGHTS): Glow[] {
  return glows
    .filter((glow) => glow.alpha > 0.01 && glow.r > 0 && !(calm && glow.r > FIELD_LIGHT))
    .sort((a, b) => brightness(b) - brightness(a))
    .slice(0, Math.max(0, Math.min(MAX_LIGHTS, most)));
}

/** Adds the lights of a moment. A calm picture has them at half strength and none that covers the field. */
export function drawGlows(ctx: CanvasRenderingContext2D, glows: readonly Glow[], calm = false, most = MAX_LIGHTS): void {
  for (const glow of chosenLights(glows, calm, most)) drawGlow(ctx, glow, calm ? 0.5 : 1);
}

/** A soft shadow on the ground: an ellipse `w` wide and `h` high around its middle, darkest there. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number): void {
  if (w <= 0 || h <= 0 || alpha <= 0) return;
  const gradient = ctx.createRadialGradient?.(0, 0, 0, 0, 0, w / 2) as CanvasGradient | undefined;
  if (!gradient || typeof gradient.addColorStop !== 'function') return;
  gradient.addColorStop(0, `rgba(0, 0, 8, ${Math.min(1, alpha).toFixed(3)})`);
  gradient.addColorStop(0.6, `rgba(0, 0, 8, ${(Math.min(1, alpha) * 0.5).toFixed(3)})`);
  gradient.addColorStop(1, 'rgba(0, 0, 8, 0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, h / w);
  ctx.fillStyle = gradient;
  ctx.fillRect(-w / 2, -w / 2, w, w);
  ctx.restore();
}

/** A beam of light from one point to another: a white core in a halo of its colour, added to what is there. */
export function drawBeam(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, width: number, color: string, alpha: number): void {
  if (alpha <= 0.01 || width <= 0) return;
  const before = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const [r, g, b] = rgb(color);
  const line = (w: number, style: string): void => {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };
  line(width * 3.2, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.16).toFixed(3)})`);
  line(width * 1.9, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.4).toFixed(3)})`);
  line(width, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.9).toFixed(3)})`);
  line(Math.max(1, width * 0.4), `rgba(255, 255, 255, ${alpha.toFixed(3)})`);
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = before;
}

/**
 * A cone of light from a lamp: a point where it starts, `width` wide where it ends, and fading
 * away along its length. Added to what is there, in two layers so that its sides are soft.
 */
export function drawCone(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, width: number, color: string, alpha: number): void {
  if (alpha <= 0.01 || width <= 0) return;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= 0) return;
  const fade = ctx.createLinearGradient?.(from.x, from.y, to.x, to.y) as CanvasGradient | undefined;
  if (!fade || typeof fade.addColorStop !== 'function') return;
  const [r, g, b] = rgb(color);
  fade.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha).toFixed(3)})`);
  fade.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  // Across the cone, at right angles to the way it points.
  const nx = -(to.y - from.y) / length;
  const ny = (to.x - from.x) / length;
  const before = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = fade;
  for (const share of [1, 0.45]) {
    const half = (width * share) / 2;
    ctx.beginPath();
    ctx.moveTo(from.x - nx * 0.5, from.y - ny * 0.5);
    ctx.lineTo(to.x - nx * half, to.y - ny * half);
    ctx.lineTo(to.x + nx * half, to.y + ny * half);
    ctx.lineTo(from.x + nx * 0.5, from.y + ny * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = before;
}

/** The rows of a filled circle on the pixel grid: for each row its distance from the middle and half its width. */
export function discRows(r: number): { dy: number; half: number }[] {
  const radius = Math.max(0, Math.round(r));
  const rows: { dy: number; half: number }[] = [];
  for (let dy = -radius; dy <= radius; dy++) rows.push({ dy, half: Math.floor(Math.sqrt(radius * radius - dy * dy + radius * 0.8)) });
  return rows;
}

/** A filled circle on the pixel grid. */
export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  if (r < 0.5) return;
  ctx.fillStyle = color;
  const cx = px(x);
  const cy = px(y);
  for (const { dy, half } of discRows(r)) ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
}

/** The outline of a circle on the pixel grid, `thick` pixels wide. */
export function ringOf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, thick = 1): void {
  if (r < 1) return;
  ctx.fillStyle = color;
  const cx = px(x);
  const cy = px(y);
  const outer = discRows(r);
  const inner = new Map(discRows(Math.max(0, r - thick)).map((row) => [row.dy, row.half]));
  for (const { dy, half } of outer) {
    const hole = inner.get(dy);
    if (hole === undefined) { ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1); continue; }
    const w = half - hole;
    if (w <= 0) continue;
    ctx.fillRect(cx - half, cy + dy, w, 1);
    ctx.fillRect(cx + hole + 1, cy + dy, w, 1);
  }
}

/** A straight run of pixels from one point to another, `thick` pixels wide. */
export function pixelLine(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, color: string, thick = 1): void {
  ctx.fillStyle = color;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(px(from.x + (to.x - from.x) * t - thick / 2 + 0.5), px(from.y + (to.y - from.y) * t - thick / 2 + 0.5), thick, thick);
  }
}

/** Fire as it burns out: white heat, yellow, orange, red, and the smoke it leaves. */
export const FIRE = ['#ffffff', '#fff3b8', '#ffd45e', '#ff9a34', '#f0562a', '#a8302a', '#4a3a44'];
/** The colour of a fire that is `p` of the way from lit (0) to smoke (1). */
export const fireColor = (p: number): string => FIRE[Math.max(0, Math.min(FIRE.length - 1, Math.floor(Math.max(0, p) * FIRE.length)))];
