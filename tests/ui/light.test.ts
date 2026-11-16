import {
  FIELD_LIGHT, FIRE, MAX_LIGHTS, brightness, chosenLights, disc, discRows, drawBeam, drawCone, drawGlow, drawGlows, drawShadow, fireColor, pixelLine, rgb, ringOf, type Glow,
} from '../../src/ui/light';
import { record } from '../helpers/canvas';

const glow = (over: Partial<Glow> = {}): Glow => ({ x: 100, y: 80, r: 30, color: '#ff8040', alpha: 0.8, ...over });
/** The kind of canvas most tests draw on: it takes any call and answers nothing. */
function standIn(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('soft light', () => {
  test('a glow is one round gradient, added to what is there, and the canvas is left as it was found', () => {
    const page = record((ctx) => {
      ctx.globalCompositeOperation = 'source-over';
      drawGlow(ctx, glow());
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });
    expect(page.glows).toHaveLength(1);
    expect(page.glows[0]).toMatchObject({ x: 100, y: 80, r: 30, blend: 'lighter' });
    // Brightest in the middle, gone at the edge, in its own colour.
    expect(page.glows[0].stops[0]).toEqual([0, 'rgba(255, 128, 64, 0.800)']);
    expect(page.glows[0].stops.at(-1)).toEqual([1, 'rgba(255, 128, 64, 0)']);
    expect(page.rects).toEqual([]);
  });

  test('its strength scales it, never past full, and a light too faint to see is not drawn', () => {
    const first = (g: Glow, strength?: number) => record((ctx) => drawGlow(ctx, g, strength)).glows[0]?.stops[0][1];
    expect(first(glow(), 0.5)).toBe('rgba(255, 128, 64, 0.400)');
    expect(first(glow({ alpha: 3 }))).toBe('rgba(255, 128, 64, 1.000)');
    expect(first(glow({ alpha: 0.005 }))).toBeUndefined();
    expect(first(glow({ r: 0 }))).toBeUndefined();
    expect(first(glow({ alpha: -1 }))).toBeUndefined();
  });

  test('a canvas that cannot make a gradient is left alone: nothing is drawn and nothing fails', () => {
    const ctx = standIn();
    expect(() => {
      drawGlow(ctx, glow());
      drawGlows(ctx, [glow(), glow({ x: 10 })]);
      drawShadow(ctx, 50, 200, 60, 10, 0.4);
      drawBeam(ctx, { x: 0, y: 0 }, { x: 50, y: 20 }, 3, '#7fe9ff', 1);
      disc(ctx, 20, 20, 6, '#ffffff');
      ringOf(ctx, 20, 20, 9, '#ffffff');
      pixelLine(ctx, { x: 0, y: 0 }, { x: 9, y: 4 }, '#ffffff');
    }).not.toThrow();
    // The soft kind changed nothing about how the canvas blends.
    expect((ctx as unknown as { fillStyle?: unknown }).fillStyle).not.toBeUndefined();
  });

  test('of many lights the sixteen brightest are drawn', () => {
    expect(MAX_LIGHTS).toBe(16);
    const many = Array.from({ length: 40 }, (_, i) => glow({ x: i, alpha: 0.1 + (i % 10) * 0.05, r: 10 + i }));
    const kept = chosenLights(many);
    expect(kept).toHaveLength(16);
    const dimmest = Math.min(...kept.map(brightness));
    for (const left of many.filter((g) => !kept.includes(g))) expect(brightness(left)).toBeLessThanOrEqual(dimmest);
    expect(record((ctx) => drawGlows(ctx, many)).glows).toHaveLength(16);
  });

  test('a calm picture has its lights at half strength, and none that covers the field', () => {
    expect(FIELD_LIGHT).toBe(80);
    const lights = [glow({ r: 30, alpha: 0.8 }), glow({ r: 200, alpha: 0.9 }), glow({ r: 80, alpha: 0.6 })];
    const calm = record((ctx) => drawGlows(ctx, lights, true)).glows;
    expect(calm.map((g) => g.r).sort((a, b) => a - b)).toEqual([30, 80]);
    expect(calm.find((g) => g.r === 30)!.stops[0][1]).toBe('rgba(255, 128, 64, 0.400)');
    const plain = record((ctx) => drawGlows(ctx, lights)).glows;
    expect(plain).toHaveLength(3);
    expect(plain.find((g) => g.r === 30)!.stops[0][1]).toBe('rgba(255, 128, 64, 0.800)');
  });

  test('a shadow is a dark ellipse laid over the ground, not added to it', () => {
    const page = record((ctx) => drawShadow(ctx, 60, 200, 80, 12, 0.4));
    expect(page.glows).toHaveLength(1);
    expect(page.glows[0]).toMatchObject({ x: 60, y: 200, r: 40, blend: 'source-over' });
    // As wide as asked and as flat as asked.
    expect(page.glows[0].ry).toBeCloseTo(6, 6);
    expect(page.glows[0].stops[0][1]).toBe('rgba(0, 0, 8, 0.400)');
    expect(record((ctx) => drawShadow(ctx, 60, 200, 0, 12, 0.4)).glows).toEqual([]);
    expect(record((ctx) => drawShadow(ctx, 60, 200, 80, 12, 0)).glows).toEqual([]);
  });

  test('a beam is a white core in a halo of its colour, widest and faintest outside, all of it added', () => {
    const page = record((ctx) => drawBeam(ctx, { x: 10, y: 20 }, { x: 110, y: 40 }, 3, '#7fe9ff', 1));
    expect(page.strokes).toHaveLength(4);
    for (const stroke of page.strokes) {
      expect(stroke.blend).toBe('lighter');
      expect(stroke.points).toEqual([{ x: 10, y: 20 }, { x: 110, y: 40 }]);
    }
    const widths = page.strokes.map((s) => s.width);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
    expect(page.strokes.at(-1)!.color).toBe('rgba(255, 255, 255, 1.000)');
    expect(page.strokes[0].color).toBe('rgba(127, 233, 255, 0.160)');
    expect(record((ctx) => drawBeam(ctx, { x: 0, y: 0 }, { x: 9, y: 9 }, 3, '#7fe9ff', 0)).strokes).toEqual([]);
  });

  test('a colour is read from its six figures, and anything else is white', () => {
    expect(rgb('#ff8040')).toEqual([255, 128, 64]);
    expect(rgb('#7FE9FF')).toEqual([127, 233, 255]);
    expect(rgb('red')).toEqual([255, 255, 255]);
  });
});

describe('solid light, on the pixel grid', () => {
  const filled = (draw: (ctx: CanvasRenderingContext2D) => void): Set<string> => {
    const on = new Set<string>();
    for (const r of record(draw).rects) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) on.add(`${x},${y}`);
    return on;
  };

  test('a disc is round, whole and the same on both sides', () => {
    const on = filled((ctx) => disc(ctx, 50, 50, 6, '#ffffff'));
    expect(on.has('50,50')).toBe(true);
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4]]) expect(on.has(`${50 + dx},${50 + dy}`), `${dx},${dy}`).toBe(true);
    for (const [dx, dy] of [[7, 0], [0, 7], [6, 6], [-6, 5]]) expect(on.has(`${50 + dx},${50 + dy}`), `${dx},${dy}`).toBe(false);
    for (const key of on) {
      const [x, y] = key.split(',').map(Number);
      expect(on.has(`${100 - x},${y}`), key).toBe(true);
      expect(on.has(`${x},${100 - y}`), key).toBe(true);
    }
    // About as much as a circle of that size holds.
    expect(on.size).toBeGreaterThan(Math.PI * 36 * 0.9);
    expect(on.size).toBeLessThan(Math.PI * 49 * 1.1);
    expect(discRows(6)).toHaveLength(13);
    expect(filled((ctx) => disc(ctx, 50, 50, 0.2, '#ffffff')).size).toBe(0);
  });

  test('a ring is the edge of the disc and nothing of its middle', () => {
    const ring = filled((ctx) => ringOf(ctx, 50, 50, 10, '#ffffff'));
    const whole = filled((ctx) => disc(ctx, 50, 50, 10, '#ffffff'));
    expect(ring.size).toBeGreaterThan(40);
    expect(ring.size).toBeLessThan(whole.size / 2);
    for (const key of ring) expect(whole.has(key), key).toBe(true);
    expect(ring.has('50,50')).toBe(false);
    expect(ring.has('60,50')).toBe(true);
    expect(ring.has('50,40')).toBe(true);
    // A thicker ring holds more, and still not the middle.
    const thick = filled((ctx) => ringOf(ctx, 50, 50, 10, '#ffffff', 3));
    expect(thick.size).toBeGreaterThan(ring.size * 2);
    expect(thick.has('50,50')).toBe(false);
  });

  test('a line of pixels runs from one point to the other without a gap', () => {
    const on = filled((ctx) => pixelLine(ctx, { x: 10, y: 10 }, { x: 30, y: 18 }, '#ffffff'));
    expect(on.has('10,10')).toBe(true);
    expect(on.has('30,18')).toBe(true);
    for (let x = 10; x <= 30; x++) expect([...on].some((key) => key.startsWith(`${x},`)), `column ${x}`).toBe(true);
  });

  test('fire burns from white through yellow, orange and red to smoke', () => {
    expect(FIRE).toHaveLength(7);
    expect(fireColor(0)).toBe('#ffffff');
    expect(fireColor(1)).toBe(FIRE[6]);
    expect(fireColor(-2)).toBe('#ffffff');
    expect(fireColor(7)).toBe(FIRE[6]);
    // It never gets brighter again as it burns out.
    const light = (hex: string): number => rgb(hex).reduce((sum, c) => sum + c, 0);
    for (let i = 1; i < FIRE.length; i++) expect(light(FIRE[i]), FIRE[i]).toBeLessThan(light(FIRE[i - 1]));
    expect([0, 0.2, 0.4, 0.6, 0.8, 0.99].map(fireColor)).toEqual([FIRE[0], FIRE[1], FIRE[2], FIRE[4], FIRE[5], FIRE[6]]);
  });
});

describe('a cone of light', () => {
  const from = { x: 100, y: 200 };
  const to = { x: 100, y: 50 };

  test('is a point at its lamp and as wide as asked at its end, in two layers, the inner under half as wide', () => {
    const page = record((ctx) => {
      ctx.globalCompositeOperation = 'source-over';
      drawCone(ctx, from, to, 30, '#80c0ff', 0.2);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });
    expect(page.shapes).toHaveLength(2);
    const [outer, inner] = page.shapes;
    // Straight up: the far corners are fifteen either side of the middle, the near ones half a pixel.
    expect(outer.points.map((p) => [Math.round(p.x * 10) / 10, p.y])).toEqual([[99.5, 200], [85, 50], [115, 50], [100.5, 200]]);
    expect(inner.points.map((p) => [Math.round(p.x * 100) / 100, p.y])).toEqual([[99.5, 200], [93.25, 50], [106.75, 50], [100.5, 200]]);
    for (const shape of page.shapes) {
      expect(shape.blend).toBe('lighter');
      expect(shape.stops).toEqual([[0, 'rgba(128, 192, 255, 0.200)'], [1, 'rgba(128, 192, 255, 0)']]);
    }
    expect(page.rects).toEqual([]);
    expect(page.glows).toEqual([]);
  });

  test('is never brighter than full, and nothing at all when it has no light, no width or no length', () => {
    expect(record((ctx) => drawCone(ctx, from, to, 30, '#80c0ff', 4)).shapes[0].stops[0][1]).toBe('rgba(128, 192, 255, 1.000)');
    expect(record((ctx) => drawCone(ctx, from, to, 30, '#80c0ff', 0)).shapes).toEqual([]);
    expect(record((ctx) => drawCone(ctx, from, to, 30, '#80c0ff', 0.005)).shapes).toEqual([]);
    expect(record((ctx) => drawCone(ctx, from, to, 0, '#80c0ff', 0.2)).shapes).toEqual([]);
    expect(record((ctx) => drawCone(ctx, from, from, 30, '#80c0ff', 0.2)).shapes).toEqual([]);
    expect(() => drawCone(standIn(), from, to, 30, '#80c0ff', 0.2)).not.toThrow();
  });

  test('leans with the way it points: its end is always square across it', () => {
    const page = record((ctx) => drawCone(ctx, { x: 0, y: 0 }, { x: 30, y: 40 }, 20, '#ffffff', 0.5));
    const [, b, c] = page.shapes[0].points;
    // Fifty long; across it is the direction (-4, 3) / 5.
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(20, 6);
    expect((b.x - c.x) * 30 + (b.y - c.y) * 40).toBeCloseTo(0, 6);
    expect((b.x + c.x) / 2).toBeCloseTo(30, 6);
    expect((b.y + c.y) / 2).toBeCloseTo(40, 6);
  });
});
