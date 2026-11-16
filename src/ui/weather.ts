import { drawGlow } from './light';

/** What drifts across a battlefield. */
export type Weather = 'rain' | 'dust' | 'embers' | 'motes' | 'none';

/** The weather of each background. */
export const WEATHER: Record<string, Weather> = {
  // What is seen falling agrees with what the ground's rule is called: rain where the rule is rain, dust where it is dust.
  'bg-neon-district': 'rain', 'bg-sluice': 'motes', 'bg-undercity': 'motes',
  'bg-mine': 'dust', 'bg-rooftop': 'motes',
  'bg-foundry': 'embers',
  'bg-vault': 'motes', 'bg-clearing': 'motes', 'bg-plaza': 'motes',
  'bg-arena': 'none', 'bg-garage': 'none', 'bg-simulator': 'none',
};

export const weatherFor = (background: string): Weather => (Object.hasOwn(WEATHER, background) ? WEATHER[background] : 'none');

/** How many particles each kind of weather draws. */
export const PARTICLES: Record<Weather, number> = { rain: 46, dust: 26, embers: 22, motes: 18, none: 0 };

/** A number from 0 to 1 that depends only on the particle and the salt: the same every frame. */
const scatter = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const wrapTo = (value: number, size: number): number => ((value % size) + size) % size;

/** Where one of the embers is: they rise and sway. */
function emberAt(i: number, t: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.floor(wrapTo(scatter(i, 1) * w + Math.sin(t * 1.3 + i) * 5, w - 1)),
    y: Math.floor(wrapTo(scatter(i, 2) * h - t * (16 + 22 * scatter(i, 3)), h - 1)),
  };
}

/** How many drops are seen to land at once, and how many embers throw light. */
export const SPLASHES = 12;
export const EMBER_LIGHTS = 6;
/** How long there is between two strokes of lightning, and how strongly the field is lit at its brightest. */
export const LIGHTNING_MS = 9400;
export const LIGHTNING_ALPHA = 0.55;
/** How bright the top of the sky goes on top of that. */
export const SKY_ALPHA = 0.3;

/**
 * How bright the lightning is at this moment, from 0 to 1: nothing for most of the time, then two
 * strokes close together, the second dying away. When in its stretch of time a stroke comes differs
 * from one stretch to the next.
 */
export function lightning(clockMs: number): number {
  const slot = Math.floor(clockMs / LIGHTNING_MS);
  const at = clockMs - slot * LIGHTNING_MS - 1500 - scatter(slot, 9) * 5000;
  if (at < 0 || at >= 260) return 0;
  if (at < 70) return 1;
  if (at < 150) return 0.15;
  return 0.8 * (1 - (at - 150) / 110);
}

/**
 * What the weather does besides fall: rain lands, and now and then lightning lights the whole
 * field; embers throw a little light. A calm picture has no lightning and its embers glow at half
 * strength.
 */
export function drawWeatherExtras(ctx: CanvasRenderingContext2D, kind: Weather, clockMs: number, w: number, h: number, calm = false): void {
  const t = clockMs / 1000;
  if (kind === 'rain') {
    // Each drop that lands throws up a crown for a moment, somewhere new every time.
    for (let i = 0; i < SPLASHES; i++) {
      const rate = 1.6 + scatter(i, 4);
      const turn = t * rate + scatter(i, 5);
      const phase = turn - Math.floor(turn);
      if (phase > 0.3) continue;
      const x = Math.floor(scatter(Math.floor(turn), i + 6) * (w - 4)) + 2;
      const y = h - 3 - Math.floor(scatter(Math.floor(turn), i + 7) * 14);
      ctx.fillStyle = `rgba(190, 215, 255, ${(0.4 * (1 - phase / 0.3)).toFixed(2)})`;
      ctx.fillRect(x - 1, y, 3, 1);
      if (phase < 0.15) { ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); }
    }
    const flash = calm ? 0 : lightning(clockMs);
    if (flash > 0) {
      const before = ctx.globalCompositeOperation;
      // The whole field is lit, in a way that leaves dark things dark: what is bright gets brighter, and nothing goes milky.
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(200, 220, 255, ${(LIGHTNING_ALPHA * flash).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      // And the sky itself goes white-blue, most at the top.
      const sky = ctx.createLinearGradient?.(0, 0, 0, h * 0.7) as CanvasGradient | undefined;
      if (sky && typeof sky.addColorStop === 'function') {
        sky.addColorStop(0, `rgba(170, 200, 255, ${(SKY_ALPHA * flash).toFixed(3)})`);
        sky.addColorStop(1, 'rgba(170, 200, 255, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h * 0.7);
      }
      ctx.globalCompositeOperation = before;
    }
  }
  if (kind === 'embers') {
    for (let i = 0; i < EMBER_LIGHTS; i++) {
      const { x, y } = emberAt(i * 3, t, w, h);
      drawGlow(ctx, { x, y, r: 7, color: '#ff9a3c', alpha: 0.3 + 0.2 * Math.abs(Math.sin(t * 5 + i * 5.1)) }, calm ? 0.5 : 1);
    }
  }
}

/**
 * Draws the weather over a field `w` by `h`, from its top left corner. Where every particle is
 * follows from the clock alone, so nothing has to be remembered between frames.
 */
export function drawWeather(ctx: CanvasRenderingContext2D, kind: Weather, clockMs: number, w: number, h: number): void {
  const t = clockMs / 1000;
  for (let i = 0; i < PARTICLES[kind]; i++) {
    const a = scatter(i, 1);
    const b = scatter(i, 2);
    const c = scatter(i, 3);
    switch (kind) {
      case 'rain': {
        // Streaks falling a little to the left, at two depths: far rain is short, faint and slow, near rain long, bright and fast.
        const near = i % 2 === 1;
        const speed = near ? 230 + 100 * c : 130 + 50 * c;
        const length = near ? 5 : 2;
        const x = Math.floor(wrapTo(a * w - t * (near ? 34 : 18), w - 1));
        const y = Math.floor(wrapTo(b * h + t * speed, h - length));
        ctx.fillStyle = `rgba(150, 190, 255, ${(near ? 0.2 + 0.2 * c : 0.1 + 0.08 * c).toFixed(2)})`;
        ctx.fillRect(x, y, 1, length);
        break;
      }
      case 'dust': {
        // Slow specks carried sideways by the wind.
        const x = Math.floor(wrapTo(a * w + t * (10 + 16 * c), w - 1));
        const y = Math.floor(wrapTo(b * h + Math.sin(t * 0.7 + i) * 6, h - 1));
        ctx.fillStyle = `rgba(214, 190, 140, ${(0.12 + 0.14 * c).toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
        break;
      }
      case 'embers': {
        // Sparks rising and swaying, flickering as they go.
        const { x, y } = emberAt(i, t, w, h);
        const glow = 0.25 + 0.3 * Math.abs(Math.sin(t * 5 + i * 1.7));
        ctx.fillStyle = `rgba(255, ${150 + Math.floor(80 * c)}, 60, ${glow.toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
        break;
      }
      case 'motes': {
        // Pale specks that barely move.
        const x = Math.floor(wrapTo(a * w + Math.sin(t * 0.4 + i) * 8, w - 1));
        const y = Math.floor(wrapTo(b * h + Math.cos(t * 0.3 + i * 2) * 6, h - 1));
        ctx.fillStyle = `rgba(200, 230, 255, ${(0.1 + 0.12 * Math.abs(Math.sin(t + i))).toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
        break;
      }
      case 'none':
        break;
    }
  }
}
