import { FACTORY, PAINTS, analyse, hueBucket, paintById, rampOf, recolour, toHsl, type PaintInfo } from '../../src/ui/paint';

type Px = [number, number, number, number];
const image = (pixels: Px[]) => ({ data: Uint8ClampedArray.from(pixels.flat()) });
const repeat = (px: Px, n: number): Px[] => Array.from({ length: n }, () => px);
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const at = (data: Uint8ClampedArray, i: number): Px => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];

const CYAN: Px = [20, 220, 230, 255];
const YELLOW: Px = [230, 190, 20, 255];
const greys = (n: number): Px[] => Array.from({ length: n }, (_, i) => { const v = 20 + Math.round((i / (n - 1)) * 200); return [v, v, v, 255] as Px; });

describe('working out what is armour and what is trim', () => {
  test('a hue that covers little of the mech is trim; greys are always armour', () => {
    const info = analyse([image([...greys(90), ...repeat(CYAN, 10)])]);
    expect(info.accent).toEqual([hueBucket(toHsl(...(CYAN.slice(0, 3) as [number, number, number]))[0])]);
  });

  test('a hue that covers much of the mech is armour, however bright it is', () => {
    const info = analyse([image([...greys(60), ...repeat(YELLOW, 40)])]);
    expect(info.accent).toEqual([]);
  });

  test('all layers of a family are judged together', () => {
    // Cyan fills one small layer but is a sliver of the whole family.
    const info = analyse([image(repeat(CYAN, 8)), image(greys(92))]);
    expect(info.accent).toHaveLength(1);
  });

  test('the brightness range of the armour is recorded low, middle, high', () => {
    const info = analyse([image([...greys(100), ...repeat(CYAN, 5)])]);
    expect(info.lo).toBeLessThan(info.mid);
    expect(info.mid).toBeLessThan(info.hi);
    expect(info.lo).toBeGreaterThanOrEqual(0);
    expect(info.hi).toBeLessThanOrEqual(1);
  });

  test('transparent pixels count for nothing, and an empty family gets a usable default', () => {
    const info = analyse([image([[255, 0, 0, 0], [0, 255, 0, 0]])]);
    expect(info).toEqual({ accent: [], lo: 0, mid: 0.5, hi: 1 });
  });
});

describe('the schemes', () => {
  test('there are twelve, each with its own id and name, and factory is not one of them', () => {
    expect(PAINTS).toHaveLength(12);
    expect(new Set(PAINTS.map((p) => p.id)).size).toBe(12);
    expect(new Set(PAINTS.map((p) => p.name)).size).toBe(12);
    expect(paintById(FACTORY)).toBeUndefined();
    expect(paintById(PAINTS[3].id)).toBe(PAINTS[3]);
    expect(paintById('constructor')).toBeUndefined();
  });

  test.each(PAINTS.map((p) => [p.name, p] as const))('%s has a ramp that runs from dark to light', (_name, scheme) => {
    const ramp = rampOf(scheme);
    expect(ramp).toHaveLength(7);
    for (let i = 1; i < ramp.length; i++) expect(luma(...ramp[i])).toBeGreaterThan(luma(...ramp[i - 1]));
  });
});

describe('recolouring', () => {
  const info: PaintInfo = { accent: [6], lo: 0.1, mid: 0.5, hi: 0.9 };
  const scheme = PAINTS[0];

  test('armour is mapped by brightness onto the scheme: darker stays darker', () => {
    const src = image(greys(40));
    const out = recolour(src.data, scheme, info);
    const ramp = rampOf(scheme);
    expect(at(out, 0).slice(0, 3)).toEqual(ramp[0]);
    expect(at(out, 39).slice(0, 3)).toEqual(ramp[6]);
    for (let i = 1; i < 40; i++) {
      expect(luma(...(at(out, i).slice(0, 3) as [number, number, number])))
        .toBeGreaterThanOrEqual(luma(...(at(out, i - 1).slice(0, 3) as [number, number, number])));
    }
  });

  test('trim takes the scheme\'s accent hue and keeps its own brightness order', () => {
    const dim: Px = [10, 110, 115, 255];
    const out = recolour(image([CYAN, dim]).data, scheme, info);
    const [h1, , l1] = toHsl(...(at(out, 0).slice(0, 3) as [number, number, number]));
    const [h2, , l2] = toHsl(...(at(out, 1).slice(0, 3) as [number, number, number]));
    for (const h of [h1, h2]) expect(Math.abs(((h - scheme.accentHue + 540) % 360) - 180)).toBeLessThan(6);
    expect(l1).toBeGreaterThan(l2);
  });

  test('a hue that is not trim for this family is painted as armour', () => {
    const out = recolour(image([YELLOW]).data, scheme, info);
    expect(rampOf(scheme)).toContainEqual(at(out, 0).slice(0, 3));
  });

  test('transparent pixels are left exactly as they were, and opacity never changes', () => {
    const src = image([[9, 8, 7, 0], [100, 100, 100, 255], [50, 60, 70, 128]]);
    const out = recolour(src.data, scheme, info);
    expect(at(out, 0)).toEqual([9, 8, 7, 0]);
    expect(at(out, 1)[3]).toBe(255);
    expect(at(out, 2)[3]).toBe(128);
  });

  test('the source is not changed, and the same input always gives the same output', () => {
    const src = image([...greys(10), CYAN]);
    const before = Uint8ClampedArray.from(src.data);
    const a = recolour(src.data, scheme, info);
    const b = recolour(src.data, scheme, info);
    expect(src.data).toEqual(before);
    expect(a).toEqual(b);
    expect(a).not.toEqual(before);
  });

  test('a family whose armour is all one brightness does not divide by zero', () => {
    const flat: PaintInfo = { accent: [], lo: 0.5, mid: 0.5, hi: 0.5 };
    const out = recolour(image(repeat([128, 128, 128, 255], 3)).data, scheme, flat);
    expect([...out].every((v) => Number.isFinite(v))).toBe(true);
  });

  test('different schemes give different colours', () => {
    const src = image(greys(5));
    expect(recolour(src.data, PAINTS[0], info)).not.toEqual(recolour(src.data, PAINTS[1], info));
  });
});
