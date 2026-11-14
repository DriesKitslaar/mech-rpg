/** What drifts across a battlefield. */
export type Weather = 'rain' | 'dust' | 'embers' | 'motes' | 'none';

/** The weather of each background. */
export const WEATHER: Record<string, Weather> = {
  'bg-neon-district': 'rain', 'bg-sluice': 'rain', 'bg-undercity': 'rain',
  'bg-mine': 'dust', 'bg-rooftop': 'dust',
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
        // Fast streaks falling a little to the left.
        const speed = 190 + 90 * c;
        const x = Math.floor(wrapTo(a * w - t * 28, w - 1));
        const y = Math.floor(wrapTo(b * h + t * speed, h - 4));
        ctx.fillStyle = `rgba(150, 190, 255, ${(0.14 + 0.16 * c).toFixed(2)})`;
        ctx.fillRect(x, y, 1, 4);
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
        const x = Math.floor(wrapTo(a * w + Math.sin(t * 1.3 + i) * 5, w - 1));
        const y = Math.floor(wrapTo(b * h - t * (16 + 22 * c), h - 1));
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
