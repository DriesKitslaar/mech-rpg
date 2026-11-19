import { DEFAULT_MIXES, MIX_KEYS, MIX_STEPS, mixId, mixesOf, stepMix, type Mix } from '../../src/core/mix';
import {
  CROWN_PAINTS, FACTORY, MIX_FINISH, MIX_GLOW, MIX_SHADE, PAINTS, SEAT_PAINT, analyse, hex, hueBucket, mixSwatches, paintById, paintsFor, rampOf, recolour,
  schemeOfMix, toHsl,
  type PaintInfo,
} from '../../src/ui/paint';

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

/** A mix of the pilot's own as a paint: what colours its steps are. */
describe('a mix as a paint', () => {
  const mix = (slot: number, hue: number, finish: number, shade: number, trim: number, glow: number): Mix => ({ slot, hue, finish, shade, trim, glow });
  const READY = [...PAINTS, ...CROWN_PAINTS, SEAT_PAINT];
  const lightness = (rgb: [number, number, number]): number => toHsl(...rgb)[2];
  const saturation = (rgb: [number, number, number]): number => toHsl(...rgb)[1];

  test('each thing a mix sets has a value for every one of its steps', () => {
    expect(MIX_FINISH).toHaveLength(MIX_STEPS.finish);
    expect(MIX_SHADE).toHaveLength(MIX_STEPS.shade);
    expect(MIX_GLOW).toHaveLength(MIX_STEPS.glow);
    // Each runs one way: the finish and the glow up, the shade from light to dark.
    for (const steps of [MIX_FINISH, MIX_SHADE, MIX_GLOW]) expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    for (const steps of [MIX_FINISH, MIX_SHADE, MIX_GLOW]) expect(new Set(steps).size).toBe(steps.length);
  });

  test('its scheme: the colours round the wheel in steps of fifteen degrees, and the values of its other steps', () => {
    const scheme = schemeOfMix(mix(2, 14, 3, 1, 5, 0));
    expect(scheme).toEqual({ id: 'mix2-14-3-1-5-0', name: 'Mix 2', hue: 210, sat: MIX_FINISH[3], accentHue: 75, accentSat: MIX_GLOW[0], shade: MIX_SHADE[1] });
    expect(schemeOfMix(mix(1, 0, 0, 0, 23, 2))).toMatchObject({ name: 'Mix 1', hue: 0, accentHue: 345, sat: MIX_FINISH[0], shade: MIX_SHADE[0], accentSat: MIX_GLOW[2] });
    expect(360 / MIX_STEPS.hue).toBe(15);
    // Every step of every thing gives another scheme.
    const base = mix(1, 5, 1, 2, 7, 1);
    for (const key of MIX_KEYS) {
      const seen = new Set<string>();
      for (let step = 0; step < MIX_STEPS[key]; step++) {
        const { id: _id, ...colours } = schemeOfMix({ ...base, [key]: step });
        seen.add(JSON.stringify(colours));
      }
      expect(seen.size, key).toBe(MIX_STEPS[key]);
    }
  });

  test('a mix is no lighter, no darker, no stronger and no fainter than the ready paints already go', () => {
    const sats = READY.map((paint) => paint.sat);
    const shades = READY.map((paint) => paint.shade ?? 0);
    const glows = READY.map((paint) => paint.accentSat);
    expect(Math.min(...MIX_FINISH)).toBeGreaterThanOrEqual(Math.min(...sats));
    expect(Math.max(...MIX_FINISH)).toBeLessThanOrEqual(Math.max(...sats));
    expect(Math.min(...MIX_SHADE)).toBeGreaterThanOrEqual(Math.min(...shades));
    expect(Math.max(...MIX_SHADE)).toBeLessThanOrEqual(Math.max(...shades));
    expect(Math.min(...MIX_GLOW)).toBeGreaterThanOrEqual(Math.min(...glows));
    expect(Math.max(...MIX_GLOW)).toBeLessThanOrEqual(Math.max(...glows));
    // The middle shade is neither: the armour as a ready paint without a shade has it.
    expect(MIX_SHADE[2]).toBe(0);
  });

  test('the three as they come: a white machine with cyan lights, a black one with red, and navy with gold', () => {
    const [white, black, navy] = DEFAULT_MIXES.map((one) => schemeOfMix(one));
    // White: hardly a colour at all, and its ramp runs as light as a ramp may; its lights are cyan.
    const pale = rampOf(white);
    expect(Math.max(...pale.map(saturation))).toBeLessThan(0.12);
    expect(lightness(pale[6])).toBeGreaterThan(0.9);
    expect(lightness(pale[3])).toBeGreaterThan(0.5);
    expect(white.accentHue).toBeGreaterThanOrEqual(180);
    expect(white.accentHue).toBeLessThanOrEqual(200);
    // Black: as little colour, and its middle is darker than white's darkest; its lights are red.
    const dark = rampOf(black);
    expect(Math.max(...dark.map(saturation))).toBeLessThan(0.12);
    expect(lightness(dark[3])).toBeLessThan(lightness(pale[0]));
    expect(black.accentHue).toBe(0);
    // Navy: blue and dark, with gold.
    expect(navy.hue).toBeGreaterThanOrEqual(205);
    expect(navy.hue).toBeLessThanOrEqual(230);
    expect(navy.shade).toBeGreaterThan(0);
    expect(navy.sat).toBeGreaterThanOrEqual(0.5);
    expect(navy.accentHue).toBe(45);
  });

  test('a paint is found by its name whether it is a ready one or a mix; a name of the shape of a mix that is none is no paint', () => {
    expect(paintById('mix1-14-3-2-13-2')).toEqual(schemeOfMix(mix(1, 14, 3, 2, 13, 2)));
    expect(paintById('mix3-0-0-0-0-0')?.name).toBe('Mix 3');
    for (const name of ['mix1-99-9-9-99-9', 'mix4-0-0-0-0-0', 'mix1-1-1-1-1', 'mix', 'mix1-01-0-0-0-0']) expect(paintById(name), name).toBeUndefined();
    // The ready ones are found as they were.
    expect(paintById(PAINTS[3].id)).toBe(PAINTS[3]);
    expect(paintById(SEAT_PAINT.id)).toBe(SEAT_PAINT);
    expect(paintById(FACTORY)).toBeUndefined();
  });

  test('the paints a pilot may wear end with their three mixes: as they come, or as they are kept', () => {
    const fresh = paintsFor({});
    expect(fresh.slice(-3)).toEqual(DEFAULT_MIXES.map(mixId));
    expect(fresh.slice(0, -3)).toEqual([FACTORY, ...PAINTS.map((paint) => paint.id)]);
    const kept = ['mix1-3-3-2-11-1', 'mix2-0-0-4-0-2', 'mix3-20-1-0-5-0'];
    expect(paintsFor({ mixes: kept }).slice(-3)).toEqual(kept);
    // After the paints of the crowns held and the keeper's, which stand where they stood.
    const all = paintsFor({ crowns: ['bastion'], seat: true, mixes: kept });
    expect(all.slice(-5)).toEqual(['basalt', SEAT_PAINT.id, ...kept]);
    // A kept name that is no mix is not offered: the mix as it comes stands in its place.
    expect(paintsFor({ mixes: ['mix1-99-0-0-0-0', kept[1], kept[2]] }).slice(-3)).toEqual([mixId(DEFAULT_MIXES[0]), kept[1], kept[2]]);
    // Every one of them is a paint that is found, but factory colours.
    for (const id of all.slice(1)) expect(paintById(id), id).toBeDefined();
    expect(mixesOf({ mixes: kept }).map((one) => schemeOfMix(one).id)).toEqual(kept);
    expect(schemeOfMix(stepMix(DEFAULT_MIXES[0], 'hue', 1)).hue).toBe(schemeOfMix(DEFAULT_MIXES[0]).hue + 15);
  });
});

/** The strips of the paint page: the steps of each of the five things a mix sets, in the colours they would give. */
describe('the colours of a mix\'s steps', () => {
  const mix: Mix = { slot: 1, hue: 5, finish: 2, shade: 1, trim: 17, glow: 1 };
  const rgb = (colour: string): [number, number, number] => [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16)) as [number, number, number];
  const hsl = (colour: string) => toHsl(...rgb(colour));

  test('a colour is written with two figures for each of its three parts, however low the part', () => {
    expect(hex([255, 128, 16])).toBe('#ff8010');
    expect(hex([0, 5, 15])).toBe('#00050f');
    expect(hex([9, 200, 0])).toBe('#09c800');
  });

  test('a strip has a colour for each of its steps, written as a canvas takes a colour', () => {
    for (const key of MIX_KEYS) {
      const strip = mixSwatches(mix, key);
      expect(strip, key).toHaveLength(MIX_STEPS[key]);
      for (const colour of strip) expect(colour, key).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set(strip).size, key).toBe(MIX_STEPS[key]);
    }
  });

  test('the two wheels are charts: twenty-four colours round from red, the same whatever the mix is', () => {
    const other: Mix = { slot: 3, hue: 20, finish: 0, shade: 4, trim: 2, glow: 0 };
    for (const key of ['hue', 'trim'] as const) {
      const wheel = mixSwatches(mix, key);
      expect(wheel).toEqual(mixSwatches(other, key));
      // Red first, then round by fifteen degrees: green a third of the way, blue two thirds.
      wheel.forEach((colour, step) => expect(Math.round(hsl(colour)[0]) % 360, `${key} ${step}`).toBe(step * 15));
      const [r, g, b] = [rgb(wheel[0]), rgb(wheel[8]), rgb(wheel[16])];
      expect(r[0]).toBeGreaterThan(Math.max(r[1], r[2]));
      expect(g[1]).toBeGreaterThan(Math.max(g[0], g[2]));
      expect(b[2]).toBeGreaterThan(Math.max(b[0], b[1]));
      // Strong enough to be told apart.
      for (const colour of wheel) expect(hsl(colour)[1]).toBeGreaterThan(0.6);
    }
  });

  test('the finish and the shade are shown in the armour\'s own colours: the step that is chosen is the colour the machine has', () => {
    const finish = mixSwatches(mix, 'finish');
    const shade = mixSwatches(mix, 'shade');
    const own = rampOf(schemeOfMix(mix))[4];
    expect(rgb(finish[mix.finish])).toEqual(own);
    expect(rgb(shade[mix.shade])).toEqual(own);
    // Each step is the machine as that step would have it.
    finish.forEach((colour, step) => expect(rgb(colour), `finish ${step}`).toEqual(rampOf(schemeOfMix({ ...mix, finish: step }))[4]));
    shade.forEach((colour, step) => expect(rgb(colour), `shade ${step}`).toEqual(rampOf(schemeOfMix({ ...mix, shade: step }))[4]));
    // The finish runs from hardly a colour to a strong one; the shade from light to dark.
    const strength = finish.map((colour) => hsl(colour)[1]);
    expect([...strength].sort((a, b) => a - b)).toEqual(strength);
    expect(strength[0]).toBeLessThan(0.15);
    const lightness = shade.map((colour) => hsl(colour)[2]);
    expect([...lightness].sort((a, b) => b - a)).toEqual(lightness);
  });

  test('the glow is shown in the trim\'s colour, from soft to bright', () => {
    const glow = mixSwatches(mix, 'glow');
    for (const colour of glow) expect(Math.round(hsl(colour)[0])).toBe(mix.trim * 15);
    const strength = glow.map((colour) => hsl(colour)[1]);
    expect([...strength].sort((a, b) => a - b)).toEqual(strength);
    glow.forEach((colour, step) => expect(hsl(colour)[1], `glow ${step}`).toBeCloseTo(MIX_GLOW[step], 1));
  });

  test('a strip changes with what it is made of and with nothing else', () => {
    const turned = { ...mix, hue: mix.hue + 6 };
    expect(mixSwatches(turned, 'finish')).not.toEqual(mixSwatches(mix, 'finish'));
    expect(mixSwatches(turned, 'shade')).not.toEqual(mixSwatches(mix, 'shade'));
    expect(mixSwatches(turned, 'glow')).toEqual(mixSwatches(mix, 'glow'));
    const trimmed = { ...mix, trim: mix.trim - 9 };
    expect(mixSwatches(trimmed, 'glow')).not.toEqual(mixSwatches(mix, 'glow'));
    expect(mixSwatches(trimmed, 'finish')).toEqual(mixSwatches(mix, 'finish'));
    expect(mixSwatches(trimmed, 'shade')).toEqual(mixSwatches(mix, 'shade'));
    // The glow chosen does not change the strip it is chosen on.
    expect(mixSwatches({ ...mix, glow: 0 }, 'glow')).toEqual(mixSwatches(mix, 'glow'));
  });
});
