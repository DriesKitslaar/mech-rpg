import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { AMBIENCE, LIGHT_ALPHA, ambienceFor, drawAmbience, lightLevel, placeLights, type LightKind } from '../../src/ui/ambience';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { FIELD_Y, HERO_FEET, PANEL_Y, horizonOf, pictureTop, placeFor } from '../../src/ui/stage';
import type { SpriteStore } from '../../src/ui/sprites';
import { EMBER_LIGHTS, GROUND_STRIP, LIGHTNING_ALPHA, LIGHTNING_MS, SKY_ALPHA, SPLASHES, WEATHER, drawWeatherExtras, lightning } from '../../src/ui/weather';
import { record, type Glowed } from '../helpers/canvas';

/** What a place adds to its picture: its own lights, a haze over the ground, darker edges, and weather that does more than fall. */

const FIELD = { top: 14, height: 164, width: 310 };
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const isVignette = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1] === 'rgba(4, 4, 14, 0)';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
function standIn(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('the lights of a place', () => {
  test('every background a battle can be fought on has them, and none is named that is not a picture', () => {
    expect(Object.keys(AMBIENCE).sort()).toEqual(Object.keys(WEATHER).sort());
    for (const id of Object.keys(AMBIENCE)) expect(Object.hasOwn(SPRITES, id), id).toBe(true);
    expect(ambienceFor('bg-nowhere')).toBeNull();
    expect(placeLights('bg-nowhere', 0)).toEqual([]);
  });

  test('each sits in the field, on something that could glow: a size, a colour, and room between it and the next', () => {
    for (const [id, place] of Object.entries(AMBIENCE)) {
      expect(place.lights.length, id).toBeGreaterThanOrEqual(2);
      expect(place.lights.length, id).toBeLessThanOrEqual(6);
      for (const light of place.lights) {
        expect(light.x, id).toBeGreaterThanOrEqual(0);
        expect(light.x, id).toBeLessThan(310);
        expect(light.y, id).toBeGreaterThanOrEqual(FIELD.top);
        expect(light.y, id).toBeLessThan(FIELD.top + FIELD.height);
        expect(light.r, id).toBeGreaterThanOrEqual(12);
        expect(light.r, id).toBeLessThanOrEqual(44);
        expect(light.color, id).toMatch(/^#[0-9a-f]{6}$/);
      }
      for (const [i, a] of place.lights.entries()) {
        for (const b of place.lights.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y), `${id}: two lights on one spot`).toBeGreaterThan(18);
      }
      if (place.haze) {
        expect(place.haze.y, id).toBeGreaterThan(140);
        expect(place.haze.y, id).toBeLessThan(178);
        expect(place.haze.alpha, id).toBeLessThanOrEqual(0.2);
      }
    }
  });

  test('none is ever quite still, none is ever dark, and none is brighter than its kind allows', () => {
    for (const kind of Object.keys(LIGHT_ALPHA) as LightKind[]) {
      const levels = Array.from({ length: 600 }, (_, i) => lightLevel(kind, i * 100, 2));
      expect(Math.min(...levels), kind).toBeGreaterThan(0.2);
      expect(Math.max(...levels), kind).toBeLessThanOrEqual(1.0001);
      expect(Math.max(...levels) - Math.min(...levels), kind).toBeGreaterThan(0.1);
    }
    for (const [id, place] of Object.entries(AMBIENCE)) {
      for (const t of [0, 700, 5300]) {
        for (const glow of placeLights(id, t)) expect(glow.alpha, id).toBeLessThanOrEqual(LIGHT_ALPHA[place.kind] + 1e-9);
      }
    }
  });

  test('a sign drops out now and then, a lamp breathes slowly, a fire flickers, and two lights of a place do not move as one', () => {
    const minute = (kind: LightKind, calm = false) => Array.from({ length: 720 }, (_, i) => lightLevel(kind, i * (1000 / 12), 1, calm));
    const neon = minute('neon');
    const out = neon.filter((level) => level < 0.4).length;
    // A few times a minute, a twelfth of a second each.
    expect(out).toBeGreaterThan(5);
    expect(out).toBeLessThan(60);
    // In a calm picture it never drops out.
    expect(minute('neon', true).filter((level) => level < 0.4)).toEqual([]);
    // How often a light turns from brightening to dimming: fire many times a second, a lamp once in several seconds.
    const turns = (levels: number[]) => levels.filter((level, i) => i > 1 && (level - levels[i - 1]) * (levels[i - 1] - levels[i - 2]) < 0).length;
    expect(turns(minute('fire'))).toBeGreaterThan(turns(minute('lamp')) * 5);
    expect(turns(minute('fire', true))).toBeLessThan(turns(minute('fire')) / 3);
    expect(lightLevel('lamp', 1000, 0)).not.toBeCloseTo(lightLevel('lamp', 1000, 1), 3);
  });
});

describe('a place, as it is drawn', () => {
  test('behind the units: darker edges, each of its lights added, and the haze over the ground', () => {
    const page = record((ctx) => drawAmbience(ctx, 'bg-foundry', 1000, 'behind', FIELD));
    expect(page.glows.filter(isVignette)).toHaveLength(1);
    const lights = page.glows.filter(isLight);
    expect(lights).toHaveLength(AMBIENCE['bg-foundry'].lights.length);
    expect(lights.map((g) => [g.x, g.y, g.r])).toEqual(AMBIENCE['bg-foundry'].lights.map((l) => [l.x, l.y, l.r]));
    // Three banks of haze, wide and flat, in the place's colour, low over the ground.
    const haze = page.glows.filter((g) => !isLight(g) && !isVignette(g));
    expect(haze).toHaveLength(3);
    for (const bank of haze) {
      expect(bank.stops[0][1]).toMatch(/^rgba\(160, 74, 32, /);
      expect(bank.ry).toBeLessThan(bank.r / 4);
      expect(bank.y).toBeGreaterThan(150);
      expect(bank.y).toBeLessThan(178);
    }
    // Nothing but soft light: no rectangle of solid colour is laid over the picture.
    expect(page.rects).toEqual([]);
  });

  test('in front of the units: only the last thin layer of haze, at their feet', () => {
    const front = record((ctx) => drawAmbience(ctx, 'bg-foundry', 1000, 'front', FIELD));
    expect(front.glows.filter(isLight)).toEqual([]);
    expect(front.glows.filter(isVignette)).toEqual([]);
    expect(front.glows).toHaveLength(3);
    const behind = record((ctx) => drawAmbience(ctx, 'bg-foundry', 1000, 'behind', FIELD)).glows.filter((g) => !isLight(g) && !isVignette(g));
    expect(Math.max(...front.glows.map(strength))).toBeLessThan(Math.max(...behind.map(strength)));
  });

  test('a picture that is not where the screen is: its lights move with it, those of its lowest part are seen, and those that have left the field are not drawn', () => {
    const lie = { shift: -92, far: 120, near: 169 };
    const plain = record((ctx) => drawAmbience(ctx, 'bg-sluice', 1000, 'behind', FIELD)).glows.filter(isLight);
    const moved = record((ctx) => drawAmbience(ctx, 'bg-sluice', 1000, 'behind', FIELD, false, lie)).glows.filter(isLight);
    // As a room shows it: the six lights of the picture, where the picture has them, and nothing of its lowest part.
    expect(plain.map((g) => [g.x, g.y, g.r])).toEqual(AMBIENCE['bg-sluice'].lights.map((l) => [l.x, l.y, l.r]));
    // Looked at lower: every light is 92 further up; five of the six have left the field and are not drawn; the five low ones are.
    const all = [...AMBIENCE['bg-sluice'].lights, ...AMBIENCE['bg-sluice'].low!];
    const seen = all.filter((l) => l.y - 92 + l.r > FIELD.top && l.y - 92 - l.r < FIELD.top + FIELD.height);
    expect(seen).toHaveLength(6);
    expect(moved.map((g) => [g.x, g.y, g.r])).toEqual(seen.map((l) => [l.x, l.y - 92, l.r]));
    // A light keeps its own flicker whichever others are drawn with it: the one both show is as bright in both.
    expect(strength(moved[0])).toBeCloseTo(strength(plain[0]), 6);
    // A light that only touches the field's edge is still drawn; one that has just left it is not.
    const edge = (shift: number) => record((ctx) => drawAmbience(ctx, 'bg-sluice', 0, 'behind', FIELD, false, { ...lie, shift })).glows.filter(isLight).some((g) => g.x === 155 && g.r === 35);
    expect(edge(FIELD.top - 145 - 35 + 1)).toBe(true);
    expect(edge(FIELD.top - 145 - 35)).toBe(false);
    expect(edge(FIELD.top + FIELD.height - 145 + 35 - 1)).toBe(true);
    expect(edge(FIELD.top + FIELD.height - 145 + 35)).toBe(false);
  });

  test('its haze lies along the two lines it is given: far off behind the units, near in front of them', () => {
    const lie = { shift: -92, far: 120, near: 169 };
    const haze = (layer: 'behind' | 'front', with_?: typeof lie) => record((ctx) => drawAmbience(ctx, 'bg-sluice', 1000, layer, FIELD, false, with_)).glows.filter((g) => !isLight(g) && !isVignette(g));
    expect(haze('behind', lie)).toHaveLength(3);
    expect(haze('front', lie)).toHaveLength(3);
    // Each bank lies within a few pixels of its line: they are stacked five apart and sway by two.
    for (const bank of haze('behind', lie)) expect(Math.abs(bank.y - 120)).toBeLessThanOrEqual(7);
    for (const bank of haze('front', lie)) expect(Math.abs(bank.y - 169)).toBeLessThanOrEqual(7);
    // Without one it lies where the picture's own ground is, and a little lower in front.
    const own = AMBIENCE['bg-sluice'].haze!.y;
    for (const bank of haze('behind')) expect(Math.abs(bank.y - own)).toBeLessThanOrEqual(7);
    for (const bank of haze('front')) expect(Math.abs(bank.y - (own + 6))).toBeLessThanOrEqual(7);
    // The darker edges are the field's, wherever the picture is.
    const edges = (with_?: typeof lie) => record((ctx) => drawAmbience(ctx, 'bg-sluice', 1000, 'behind', FIELD, false, with_)).glows.filter(isVignette);
    expect(edges(lie)).toEqual(edges());
  });

  test('a place without haze has none, and ground the game does not know still gets its darker edges', () => {
    expect(AMBIENCE['bg-simulator'].haze).toBeUndefined();
    expect(record((ctx) => drawAmbience(ctx, 'bg-simulator', 0, 'front', FIELD)).glows).toEqual([]);
    const nowhere = record((ctx) => drawAmbience(ctx, 'bg-nowhere', 0, 'behind', FIELD));
    expect(nowhere.glows).toHaveLength(1);
    expect(isVignette(nowhere.glows[0])).toBe(true);
  });

  test('the haze drifts: a moment later it lies somewhere else, and the lights have changed', () => {
    const at = (ms: number) => record((ctx) => drawAmbience(ctx, 'bg-mine', ms, 'behind', FIELD)).glows;
    const now = at(0);
    const later = at(4000);
    const hazeX = (glows: Glowed[]) => glows.filter((g) => !isLight(g) && !isVignette(g)).map((g) => g.x);
    expect(hazeX(later)).not.toEqual(hazeX(now));
    expect(later.filter(isLight).map(strength)).not.toEqual(now.filter(isLight).map(strength));
    // What does not move: where the lights are.
    expect(later.filter(isLight).map((g) => [g.x, g.y])).toEqual(now.filter(isLight).map((g) => [g.x, g.y]));
  });

  test('a calm picture has the same lights at half strength', () => {
    const lights = (calm: boolean) => record((ctx) => drawAmbience(ctx, 'bg-mine', 0, 'behind', FIELD, calm)).glows.filter(isLight).map(strength);
    const plain = lights(false);
    const calm = lights(true);
    expect(calm).toHaveLength(plain.length);
    calm.forEach((level, i) => expect(level).toBeCloseTo(plain[i] / 2, 2));
  });

  test('a canvas that can do nothing is drawn on without error', () => {
    const ctx = standIn();
    expect(() => {
      for (const id of [...Object.keys(AMBIENCE), 'bg-nowhere']) { drawAmbience(ctx, id, 500, 'behind', FIELD); drawAmbience(ctx, id, 500, 'front', FIELD); }
      for (const kind of ['rain', 'embers', 'dust', 'motes', 'none'] as const) drawWeatherExtras(ctx, kind, 500, 310, 164);
    }).not.toThrow();
  });
});

describe('weather that does more than fall', () => {
  test('lightning: dark nearly all the time, then two strokes close together, once in every nine seconds or so', () => {
    expect(LIGHTNING_MS).toBe(9400);
    for (let stretch = 0; stretch < 6; stretch++) {
      const levels = Array.from({ length: LIGHTNING_MS / 10 }, (_, i) => lightning(stretch * LIGHTNING_MS + i * 10));
      const lit = levels.filter((level) => level > 0).length * 10;
      expect(lit, `stretch ${stretch}`).toBeGreaterThanOrEqual(240);
      expect(lit, `stretch ${stretch}`).toBeLessThanOrEqual(270);
      expect(Math.max(...levels)).toBe(1);
      // Two strokes: bright, nearly dark, bright again and dying away.
      const first = levels.findIndex((level) => level > 0);
      expect(levels[first]).toBe(1);
      expect(levels[first + 10]).toBeCloseTo(0.15, 6);
      expect(levels[first + 16]).toBeGreaterThan(0.5);
      expect(levels[first + 24]).toBeLessThan(levels[first + 16]);
    }
    // It does not come at the same moment of every stretch.
    const when = (stretch: number) => Array.from({ length: LIGHTNING_MS / 10 }, (_, i) => lightning(stretch * LIGHTNING_MS + i * 10)).findIndex((level) => level > 0);
    expect(new Set([0, 1, 2, 3, 4].map(when)).size).toBeGreaterThan(2);
  });

  test('over rain it lights the whole field for those moments, and never in a calm picture', () => {
    const stroke = Array.from({ length: LIGHTNING_MS / 10 }, (_, i) => i * 10).find((ms) => lightning(ms) === 1)!;
    const drawn = (ms: number, calm = false) => record((ctx) => {
      drawWeatherExtras(ctx, 'rain', ms, 310, 164, calm);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });
    const flashes = (ms: number, calm = false) => drawn(ms, calm).rects.filter((r) => r.blend !== 'source-over');
    const lit = flashes(stroke);
    // The field is lit in a way that leaves dark things dark,
    expect(lit).toHaveLength(1);
    expect(lit[0]).toMatchObject({ x: 0, y: 0, w: 310, h: 164, blend: 'overlay', color: `rgba(200, 220, 255, ${LIGHTNING_ALPHA.toFixed(3)})` });
    // and the sky goes white-blue from the top down.
    const sky = drawn(stroke).washes;
    expect(sky).toHaveLength(1);
    expect(sky[0]).toMatchObject({ x: 0, y: 0, w: 310, blend: 'lighter' });
    expect(sky[0].h).toBeLessThan(164);
    expect(sky[0].stops[0]).toEqual([0, `rgba(170, 200, 255, ${SKY_ALPHA.toFixed(3)})`]);
    expect(sky[0].stops.at(-1)).toEqual([1, 'rgba(170, 200, 255, 0)']);
    expect(flashes(stroke, true)).toEqual([]);
    expect(drawn(stroke, true).washes).toEqual([]);
    expect(flashes(stroke + 2000)).toEqual([]);
    expect(drawn(stroke + 2000).washes).toEqual([]);
    // No other weather has it.
    expect(record((ctx) => drawWeatherExtras(ctx, 'dust', stroke, 310, 164)).rects).toEqual([]);
  });

  test('rain lands: a few drops at a time throw up a crown on the ground, somewhere new every time', () => {
    expect(SPLASHES).toBe(12);
    const crowns = (ms: number) => record((ctx) => drawWeatherExtras(ctx, 'rain', ms, 310, 164, true)).rects.filter((r) => r.w === 3 && r.h === 1);
    const seen = new Set<string>();
    let most = 0;
    for (let ms = 0; ms < 6000; ms += 50) {
      const now = crowns(ms);
      most = Math.max(most, now.length);
      expect(now.length).toBeLessThanOrEqual(SPLASHES);
      for (const crown of now) {
        // On the ground: the bottom of the field, and inside it.
        expect(crown.y).toBeGreaterThanOrEqual(164 - 18);
        expect(crown.y).toBeLessThan(164);
        expect(crown.x).toBeGreaterThanOrEqual(0);
        expect(crown.x + crown.w).toBeLessThanOrEqual(310);
        seen.add(`${crown.x},${crown.y}`);
      }
    }
    expect(most).toBeGreaterThan(1);
    expect(seen.size).toBeGreaterThan(40);
  });

  test('where the floor reaches far up the field, rain lands on all of it: as far up as the floor goes and no further', () => {
    expect(GROUND_STRIP).toBe(14);
    const rows = (floor?: number) => {
      const ys = new Set<number>();
      for (let ms = 0; ms < 20000; ms += 50) {
        for (const crown of record((ctx) => drawWeatherExtras(ctx, 'rain', ms, 310, 164, true, floor)).rects.filter((r) => r.w === 3 && r.h === 1)) ys.add(crown.y);
      }
      return [...ys].sort((a, b) => a - b);
    };
    // Nothing said: the strip at the foot of the field, as it was.
    expect(rows()).toEqual(rows(GROUND_STRIP));
    expect(rows()[0]).toBeGreaterThanOrEqual(164 - 3 - GROUND_STRIP);
    // A floor seventy pixels deep: drops land all over it, the furthest near its far edge, none beyond it.
    const deep = rows(70);
    expect(deep[0]).toBeGreaterThanOrEqual(164 - 3 - 70);
    expect(deep[0]).toBeLessThan(164 - 3 - 60);
    expect(deep.at(-1)).toBe(164 - 3);
    expect(deep.length).toBeGreaterThan(50);
    // At a moment a drop lands, it lands at the same place across the field however deep the floor is: only how far up differs.
    const at = (floor: number) => record((ctx) => drawWeatherExtras(ctx, 'rain', 1000, 310, 164, true, floor)).rects.filter((r) => r.w === 3 && r.h === 1);
    expect(at(70).map((r) => r.x)).toEqual(at(14).map((r) => r.x));
  });

  test('embers throw a little light, a few of them, at half strength in a calm picture', () => {
    expect(EMBER_LIGHTS).toBe(6);
    const glows = (calm: boolean) => record((ctx) => drawWeatherExtras(ctx, 'embers', 1200, 310, 164, calm)).glows;
    expect(glows(false)).toHaveLength(6);
    for (const glow of glows(false)) expect(glow).toMatchObject({ r: 7, blend: 'lighter' });
    glows(true).forEach((glow, i) => expect(strength(glow)).toBeCloseTo(strength(glows(false)[i]) / 2, 2));
    expect(record((ctx) => drawWeatherExtras(ctx, 'motes', 1200, 310, 164)).glows).toEqual([]);
  });
});

describe('the battle screen and its place', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  function screenOf(opts: { fast?: boolean; calm?: boolean; background?: string; enemies?: string[]; hot?: boolean } = {}) {
    const state = createBattle(DEMO_BUILD, (opts.enemies ?? ['tank']).map((id) => ENEMIES[id]), CATALOG, 7);
    if (opts.hot) state.units[0].heat = 90;
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: opts.background ?? 'bg-mine', ...(opts.calm ? { calm: true } : {}) });
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    return { flow, screen, page: () => record((ctx) => screen.draw(ctx)) };
  }
  /** The picture of a place is not where the screen is: the field shows a band of it, and its lights are where it is. */
  const shiftOf = (id: string): number => pictureTop(placeFor(id));
  /** Every light a place has: those of its picture as a room shows it, and those of the lowest part only a battle shows. */
  const allOf = (id: string) => [...AMBIENCE[id].lights, ...(AMBIENCE[id].low ?? [])];
  const placeOf = (glows: Glowed[], id: string) => glows.filter(isLight).filter((g) => allOf(id).some((l) => l.x === g.x && l.y + shiftOf(id) === g.y && l.r === g.r));
  /** The lights of a place that reach onto the field once its picture is where it is. */
  const onField = (id: string) => allOf(id).filter((l) => l.y + shiftOf(id) + l.r > FIELD_Y && l.y + shiftOf(id) - l.r < PANEL_Y);

  test('the place is under the units and its last haze over them', () => {
    const { page } = screenOf();
    const drawn = page();
    // The mine's lamps hang where its picture has them: four of the six are in the band of it the field shows,
    // and so are the two down by the floor that only a battle sees.
    expect(AMBIENCE['bg-mine'].lights.filter((l) => onField('bg-mine').includes(l))).toHaveLength(4);
    expect(onField('bg-mine')).toHaveLength(6);
    expect(placeOf(drawn.glows, 'bg-mine')).toHaveLength(6);
    expect(drawn.glows.filter(isVignette)).toHaveLength(1);
    // Six banks of haze in all: three behind the units and three in front.
    const haze = drawn.glows.filter((g) => g.stops[0][1].startsWith('rgba(138, 116, 64,'));
    expect(haze).toHaveLength(6);
    // Those behind lie far off, where the floor begins; those in front lie near, at the feet of the pilot's mech.
    const horizon = horizonOf(placeFor('bg-mine'));
    for (const bank of haze.slice(0, 3)) expect(Math.abs(bank.y - (horizon + 6))).toBeLessThanOrEqual(8);
    for (const bank of haze.slice(3)) expect(Math.abs(bank.y - (HERO_FEET - 8))).toBeLessThanOrEqual(8);
    // What is drawn first is what is under everything else.
    const firstUnit = drawn.order.findIndex((step) => step.kind === 'image' && step.at > 0);
    const hazeAt = drawn.order.map((step, i) => (step.kind === 'glow' && haze.includes(drawn.glows[step.at]) ? i : -1)).filter((i) => i >= 0);
    expect(hazeAt.slice(0, 3).every((i) => i < firstUnit)).toBe(true);
    expect(hazeAt.slice(3).every((i) => i > firstUnit)).toBe(true);
  });

  test('every place has lights in the band of its picture the field shows, and none of those drawn has left the field', () => {
    for (const id of Object.keys(AMBIENCE)) {
      const drawn = screenOf({ background: id }).page();
      const seen = placeOf(drawn.glows, id);
      expect(seen.length, id).toBe(onField(id).length);
      // Enough of them that the place glows, and no more than a place had before the field looked lower.
      expect(seen.length, id).toBeGreaterThanOrEqual(5);
      expect(seen.length, id).toBeLessThanOrEqual(8);
      // What glows in the lowest part of a picture is in it: all of it is seen in a battle.
      for (const low of AMBIENCE[id].low ?? []) {
        expect(low.y, id).toBeGreaterThanOrEqual(150);
        expect(low.y, id).toBeLessThan(270);
        expect(onField(id), id).toContain(low);
      }
      for (const light of seen) {
        expect(light.y + light.r, id).toBeGreaterThan(FIELD_Y);
        expect(light.y - light.r, id).toBeLessThan(PANEL_Y);
      }
    }
  });

  test('a hurried screen has the place standing still: the same lights, the same haze, frame after frame', () => {
    const { screen, page } = screenOf({ fast: true });
    const first = page().glows;
    for (let i = 0; i < 60; i++) screen.update(16);
    expect(page().glows).toEqual(first);
    expect(placeOf(first, 'bg-mine')).toHaveLength(onField('bg-mine').length);
    // One that is watched moves.
    const watched = screenOf();
    const before = watched.page().glows;
    for (let i = 0; i < 60; i++) watched.screen.update(16);
    expect(watched.page().glows).not.toEqual(before);
  });

  test('what flies burns underneath to stay up; what stands on the ground does not', () => {
    const under = (enemies: string[]) => screenOf({ enemies, background: 'bg-nowhere' }).page().glows.filter(isLight).filter((g) => g.stops[0][1].startsWith('rgba(255, 122, 184,'));
    expect(under(['recon-drone', 'tank'])).toHaveLength(1);
    expect(under(['tank', 'gun-turret'])).toEqual([]);
    expect(under(['recon-drone', 'gunship'])).toHaveLength(2);
    // A hurried screen leaves it out: it would be a flame standing still.
    expect(screenOf({ fast: true, enemies: ['recon-drone'], background: 'bg-nowhere' }).page().glows.filter(isLight)).toEqual([]);
  });

  test('a mech close to its heat limit glows from inside and the air over it wavers; a cool one does neither', () => {
    const glow = (g: Glowed) => g.stops[0][1].startsWith('rgba(255, 90, 32,');
    const hot = screenOf({ hot: true, background: 'bg-nowhere' }).page();
    expect(hot.glows.filter(isLight).filter(glow)).toHaveLength(1);
    expect(hot.rects.filter((r) => (r.color === '#ffb070' || r.color === '#ffe0b0') && r.w === 1 && r.h === 3)).toHaveLength(4);
    const cool = screenOf({ background: 'bg-nowhere' }).page();
    expect(cool.glows.filter(glow)).toEqual([]);
    expect(cool.rects.filter((r) => r.color === '#ffb070' || r.color === '#ffe0b0')).toEqual([]);
  });
});
