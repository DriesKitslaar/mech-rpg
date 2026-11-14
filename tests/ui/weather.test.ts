import SPRITES from '../../src/content/sprites.json';
import { PARTICLES, WEATHER, drawWeather, weatherFor, type Weather } from '../../src/ui/weather';

function recorder() {
  const rects: number[][] = [];
  const ctx = { fillStyle: '', fillRect: (...args: number[]) => { rects.push(args); } } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

test('every background has its weather, and every background named is a real one', () => {
  for (const id of Object.keys(WEATHER)) expect(id in SPRITES, id).toBe(true);
  const backgrounds = Object.keys(SPRITES).filter((id) => id.startsWith('bg-'));
  for (const id of backgrounds) expect(Object.keys(WEATHER), id).toContain(id);
  expect(weatherFor('bg-neon-district')).toBe('rain');
  expect(weatherFor('bg-foundry')).toBe('embers');
  expect(weatherFor('bg-mine')).toBe('dust');
  expect(weatherFor('bg-vault')).toBe('motes');
  expect(weatherFor('no-such-place')).toBe('none');
});

test('no weather draws nothing', () => {
  const { ctx, rects } = recorder();
  drawWeather(ctx, 'none', 1234, 310, 164);
  expect(rects).toEqual([]);
});

test.each(['rain', 'dust', 'embers', 'motes'] as Weather[])('%s draws its particles inside the field, and they move', (kind) => {
  const at = (clock: number) => { const r = recorder(); drawWeather(r.ctx, kind, clock, 310, 164); return r.rects; };
  const now = at(1000);
  expect(now).toHaveLength(PARTICLES[kind]);
  for (const [x, y, w, h] of now) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(310);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y + h).toBeLessThanOrEqual(164);
    expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
  }
  expect(at(1000)).toEqual(now);
  expect(at(1400)).not.toEqual(now);
});
