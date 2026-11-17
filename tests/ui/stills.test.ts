import { DEFAULT_SETTINGS, type GameState, type Settings } from '../../src/core/game';
import { setLanguage } from '../../src/content/language';
import { CATALOG } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { SAVE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { AMBIENCE, LIGHT_ALPHA, lightLevel, placeLights } from '../../src/ui/ambience';
import { App } from '../../src/ui/app';
import { drawCone, setDetail } from '../../src/ui/light';
import { DRIFT, DRIFT_MS, SceneScreen, VEIL_CLEAR, VEIL_WORDS, drawPlace } from '../../src/ui/sceneScreen';
import { forgetWords } from '../../src/ui/signType';
import type { SpriteStore } from '../../src/ui/sprites';
import { PAPERS, RAY_ALPHA, RAY_SWAY, STILLS, drawStill, paperAt, stillLights, stillWeather } from '../../src/ui/stills';
import { TALK_VEIL, TalkScreen } from '../../src/ui/talkScreen';
import { SEARCHLIGHTS, TITLE_LIGHTS, titleLights } from '../../src/ui/titleScene';
import { EMBER_LIGHTS, LIGHTNING_MS, PARTICLES, SPLASHES, THUNDER_AFTER_MS, lightning, strokeBegan } from '../../src/ui/weather';
import { COLORS } from '../../src/ui/widgets';
import { done, memoryStore, press, snap } from '../helpers/app';
import { record, type Drawn, type Filled, type Glowed, type Shaped } from '../helpers/canvas';
import { brightAt, brightOverall, readPng } from '../helpers/png';

/**
 * The pictures of the story and the places conversations are held in are alive, as the title's
 * picture is: each has its lights, found in the picture itself, its haze, and what falls or rises
 * through it; the shade over it is light, and the words have a dark edge to be read by.
 */

afterEach(() => { setLanguage('en'); setDetail(2); forgetWords(); });

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const scene = (id: string) => SCENES.find((s) => s.id === id)!;
const PICTURES = [...new Set(SCENES.map((s) => s.picture).filter((picture): picture is string => !!picture))];
const fileOf = (picture: string): string => `public/${(SPRITES as Record<string, { file: string }>)[picture].file}`;
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
/** How strong a shaft of light is where it is strongest. */
const alphaOf = (shape: Shaped): number => Math.max(...shape.stops.map((stop) => Number(/, ([\d.]+)\)$/.exec(stop[1])![1])));
/** A moment at which lightning is at its brightest. */
const STRIKE = (() => { for (let t = 0; t < LIGHTNING_MS * 3; t += 10) if (lightning(t) === 1) return t; throw new Error('no stroke'); })();
/** A game in the hub, hurried or not, with these options, that hears what is played. */
function appWith(settings: Partial<Settings> = {}, fast = false, saved: GameState = done('intro-1', 'intro-2')) {
  const heard: { name: string; delay: number; ambient: boolean }[] = [];
  const sfx = { muted: false, unlock() {}, play: (name: string, delay = 0, ambient = false) => { heard.push({ name, delay, ambient }); } };
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify(saved), [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }) });
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast, seed: 5, sfx: sfx as never });
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { press(app, 'confirm'); app.update(600); }
  expect(snap(app).screen).toBe('hub');
  heard.length = 0;
  return { app, heard };
}

describe('what each picture is told about itself', () => {
  test('every picture a page or a conversation is shown on is a place: it has lights of its own', () => {
    expect(PICTURES.sort()).toEqual(['bg-mine', 'bg-neon-district', 'bg-plaza', 'still-dawn', 'still-ledger', 'still-notice', 'still-varn', 'still-war']);
    for (const picture of PICTURES) expect(stillLights(picture, 0).length, picture).toBeGreaterThanOrEqual(3);
    // The four that are neither the title's picture nor a battlefield are told about here.
    expect(Object.keys(STILLS).sort()).toEqual(['still-dawn', 'still-ledger', 'still-notice', 'still-war']);
    for (const picture of Object.keys(STILLS)) expect(Object.keys(SPRITES)).toContain(picture);
    // The title's picture has the title's lights, and a battlefield its own.
    expect(stillLights('still-varn', 1234)).toEqual(titleLights(1234));
    expect(stillLights('bg-mine', 1234)).toEqual(placeLights('bg-mine', 1234));
    expect(stillLights('no-such-picture', 1234)).toEqual([]);
  });

  test('each light is on the picture, of a size, a colour and a kind, and there are no more than eight to a picture', () => {
    for (const [picture, still] of Object.entries(STILLS)) {
      expect(still.lights.length, picture).toBeLessThanOrEqual(8);
      expect(still.lights.length, picture).toBeGreaterThanOrEqual(3);
      for (const light of still.lights) {
        expect(light.x, picture).toBeGreaterThanOrEqual(0);
        expect(light.x, picture).toBeLessThan(310);
        expect(light.y, picture).toBeGreaterThanOrEqual(0);
        expect(light.y, picture).toBeLessThan(270);
        expect(light.r, picture).toBeGreaterThanOrEqual(12);
        expect(light.r, picture).toBeLessThanOrEqual(64);
        expect(light.color, picture).toMatch(/^#[0-9a-f]{6}$/);
        expect(Object.keys(LIGHT_ALPHA)).toContain(light.kind);
      }
      if (still.haze) {
        expect(still.haze.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(still.haze.y).toBeGreaterThan(150);
        expect(still.haze.y).toBeLessThan(270);
        expect(still.haze.alpha).toBeLessThanOrEqual(0.16);
      }
    }
  });

  test('each light sits on something bright in its picture: the lights were found there, not made up', () => {
    for (const [picture, still] of Object.entries(STILLS)) {
      const pixels = readPng(fileOf(picture));
      expect([pixels.w, pixels.h]).toEqual([310, 270]);
      const overall = brightOverall(pixels);
      for (const light of still.lights) {
        // What the light sits on is a good deal brighter than the picture is on the whole.
        expect(brightAt(pixels, light.x, light.y, 4), `${picture} at ${light.x},${light.y}`).toBeGreaterThan(overall * 1.5);
        // And the light is of the colour of what it sits on: its strongest channel is the picture's strongest there.
        const here = [0, 1, 2].map((channel) => {
          let sum = 0;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) sum += pixels.at(Math.min(309, Math.max(0, light.x + dx)), Math.min(269, Math.max(0, light.y + dy)))[channel];
          return sum;
        });
        const own = [1, 3, 5].map((at) => parseInt(light.color.slice(at, at + 2), 16));
        expect(own.indexOf(Math.max(...own)), `${picture} at ${light.x},${light.y}`).toBe(here.indexOf(Math.max(...here)));
      }
    }
    // The same holds for the title's picture and for the places conversations are held in. (The beacons
    // on Varn's stack are small red lamps: bright for what they are, and less so than a street on fire.)
    const varn = readPng(fileOf('still-varn'));
    for (const light of TITLE_LIGHTS) {
      // All but the eye of the machine on the roof: that one is not in the picture, it is the picture looking back.
      if (light.kind === 'eye') continue;
      expect(brightAt(varn, light.x, light.y, 4), `varn at ${light.x},${light.y}`).toBeGreaterThan(brightOverall(varn) * 1.3);
    }
    expect(TITLE_LIGHTS.filter((light) => light.kind === 'eye')).toHaveLength(1);
    for (const place of ['bg-mine', 'bg-neon-district', 'bg-plaza']) {
      const pixels = readPng(fileOf(place));
      for (const light of AMBIENCE[place].lights) expect(brightAt(pixels, light.x, light.y, 4), `${place} at ${light.x},${light.y}`).toBeGreaterThan(brightOverall(pixels) * 1.3);
    }
    // The measure tells a light from a place with nothing in it: the sky over the tower, the dark of the street.
    expect(brightAt(readPng(fileOf('still-notice')), 60, 20, 4)).toBeLessThan(brightOverall(readPng(fileOf('still-notice'))) * 1.3);
    expect(brightAt(readPng(fileOf('still-war')), 200, 20, 4)).toBeLessThan(brightOverall(readPng(fileOf('still-war'))) * 1.3);
  });

  test('where a picture has a sun, the sun is where its light is brightest and its shafts come down from it', () => {
    const suns = Object.entries(STILLS).filter(([, still]) => still.sun);
    expect(suns.map(([picture]) => picture)).toEqual(['still-dawn']);
    const { sun } = STILLS['still-dawn'];
    const pixels = readPng(fileOf('still-dawn'));
    expect(brightAt(pixels, sun!.x, sun!.y, 6)).toBeGreaterThan(220);
    expect(sun!.rays).toHaveLength(3);
    for (const ray of sun!.rays) {
      expect(ray.to.y).toBeGreaterThan(sun!.y + 150);
      expect(ray.to.x - RAY_SWAY).toBeGreaterThan(40);
      expect(ray.to.x + RAY_SWAY).toBeLessThan(270);
      expect(ray.width).toBeLessThanOrEqual(40);
    }
    // They fan out: left of the sun, under it, right of it.
    expect(sun!.rays.map((ray) => Math.sign(ray.to.x - sun!.x))).toEqual([-1, 0, 1]);
  });

  test('what falls or rises through each: sparks, notices, dust, motes, rain; a place has its own weather', () => {
    expect(stillWeather('still-war')).toBe('embers');
    expect(stillWeather('still-notice')).toBe('paper');
    expect(stillWeather('still-ledger')).toBe('dust');
    expect(stillWeather('still-dawn')).toBe('motes');
    expect(stillWeather('still-varn')).toBe('rain');
    expect(stillWeather('bg-neon-district')).toBe('rain');
    expect(stillWeather('bg-mine')).toBe('dust');
    expect(stillWeather('bg-plaza')).toBe('motes');
    expect(stillWeather('no-such-picture')).toBe('none');
  });

  test('its lights are as bright as their kind is, and never quite hold still', () => {
    for (const [picture, still] of Object.entries(STILLS)) {
      const now = stillLights(picture, 3000);
      still.lights.forEach((light, i) => {
        expect(now[i]).toMatchObject({ x: light.x, y: light.y, r: light.r, color: light.color });
        expect(now[i].alpha).toBeCloseTo(LIGHT_ALPHA[light.kind] * lightLevel(light.kind, 3000, i), 9);
      });
      const later = stillLights(picture, 3700);
      expect(later.some((light, i) => Math.abs(light.alpha - now[i].alpha) > 0.005), picture).toBe(true);
      // A calm picture's lights only swell and fade: none drops out, and no fire flickers low.
      for (let t = 0; t < 6000; t += 70) {
        stillLights(picture, t, true).forEach((light, i) => expect(light.alpha).toBeGreaterThanOrEqual(LIGHT_ALPHA[still.lights[i].kind] * 0.59));
      }
    }
    // Otherwise a fire does flicker lower than that, and a sign does drop out.
    const lowest = (kind: string): number => {
      let low = 1;
      for (let t = 0; t < 60_000; t += 20) {
        stillLights('still-war', t).forEach((light, i) => { if (STILLS['still-war'].lights[i].kind === kind) low = Math.min(low, light.alpha / LIGHT_ALPHA[STILLS['still-war'].lights[i].kind]); });
      }
      return low;
    };
    expect(lowest('fire')).toBeLessThan(0.5);
    expect(lowest('neon')).toBeLessThan(0.4);
  });
});

describe('the notices that fall over Meridian\'s tower', () => {
  test('each drifts down slowly, swaying, turns over as it goes, and comes round again at the top', () => {
    expect(PAPERS).toBe(18);
    for (let i = 0; i < PAPERS; i++) {
      let turned = 0;
      let fell = 0;
      let last = paperAt(i, 0, 310, 270);
      for (let t = 100; t <= 60_000; t += 100) {
        const now = paperAt(i, t, 310, 270);
        expect(now.x).toBeGreaterThanOrEqual(0);
        expect(now.x).toBeLessThanOrEqual(307);
        expect(now.y).toBeGreaterThanOrEqual(0);
        expect(now.y).toBeLessThanOrEqual(267);
        // Down by a pixel or two a tenth of a second, or back to the top.
        const dy = now.y - last.y;
        if (dy >= 0) { expect(dy).toBeLessThanOrEqual(2); fell += dy; } else expect(last.y).toBeGreaterThan(260);
        if (now.flat !== last.flat) turned++;
        last = now;
      }
      // Between nine and seventeen pixels a second, and it turned over many times on the way.
      expect(fell / 60, `paper ${i}`).toBeGreaterThan(8);
      expect(fell / 60, `paper ${i}`).toBeLessThan(18);
      expect(turned, `paper ${i}`).toBeGreaterThan(20);
    }
    // Each sways from side to side as it falls: over a minute it is seen well to either side of where it would fall straight.
    for (let i = 0; i < PAPERS; i++) {
      const xs = Array.from({ length: 300 }, (_, k) => paperAt(i, k * 200, 310, 270).x);
      expect(Math.max(...xs) - Math.min(...xs), `paper ${i}`).toBeGreaterThanOrEqual(12);
    }
    // No two of them fall together, and where each is depends on the clock alone.
    const spots = Array.from({ length: PAPERS }, (_, i) => paperAt(i, 5000, 310, 270));
    expect(new Set(spots.map((spot) => `${spot.x},${spot.y}`)).size).toBe(PAPERS);
    expect(paperAt(7, 5000, 310, 270)).toEqual(paperAt(7, 5000, 310, 270));
  });
});

describe('a picture, drawn as a place', () => {
  const draw = (picture: string, clock: number, calm = false, still = false): Drawn => record((ctx) => drawStill(ctx, picture, clock, calm, still));
  const hazes = (page: Drawn): Glowed[] => page.glows.filter((g) => !isLight(g));
  const particles = (page: Drawn): Filled[] => page.rects.filter((r) => r.w <= 3 && r.h <= 5);

  test('the burning street: its eight lights, the light of six sparks, its smoke along the ground, and sparks rising', () => {
    const page = draw('still-war', 2000);
    const lit = page.glows.filter(isLight);
    expect(lit).toHaveLength(8 + EMBER_LIGHTS);
    STILLS['still-war'].lights.forEach((light, i) => expect(lit[i]).toMatchObject({ x: light.x, y: light.y, r: light.r }));
    expect(hazes(page)).toHaveLength(3);
    expect(particles(page)).toHaveLength(PARTICLES.embers);
    for (const spark of particles(page)) {
      expect(spark.x).toBeGreaterThanOrEqual(0);
      expect(spark.x).toBeLessThan(310);
      expect(spark.y).toBeGreaterThanOrEqual(0);
      expect(spark.y).toBeLessThan(270);
    }
    // They are all over the picture, not only its upper part where a battle's field would be.
    const everywhere = Array.from({ length: 20 }, (_, k) => particles(draw('still-war', 2000 + k * 700))).flat();
    expect(everywhere.filter((spark) => spark.y > 200).length).toBeGreaterThan(20);
    for (const picture of ['still-varn', 'still-ledger', 'still-dawn', 'bg-mine']) {
      const fallen = Array.from({ length: 20 }, (_, k) => draw(picture, 2000 + k * 700).rects.filter((r) => r.w <= 3 && r.h <= 5)).flat();
      expect(fallen.filter((r) => r.y > 200).length, picture).toBeGreaterThan(10);
    }
    // They rise.
    const before = particles(draw('still-war', 2000)).map((spark) => spark.y);
    const after = particles(draw('still-war', 2200)).map((spark) => spark.y);
    expect(after.filter((y, i) => y < before[i]).length).toBeGreaterThan(PARTICLES.embers * 0.7);
    expect(page.shapes).toEqual([]);
  });

  test('the tower: its lights, and eighteen notices falling, each three pixels by two or two by three, in gold', () => {
    const page = draw('still-notice', 2000);
    expect(page.glows.filter(isLight)).toHaveLength(STILLS['still-notice'].lights.length);
    const papers = page.rects.filter((r) => r.color === '#f0cf7a' || r.color === '#c79844');
    expect(papers).toHaveLength(PAPERS);
    for (const paper of papers) expect([[3, 2], [2, 3]]).toContainEqual([paper.w, paper.h]);
    expect(new Set(papers.map((paper) => paper.color)).size).toBe(2);
    papers.forEach((paper, i) => expect([paper.x, paper.y]).toEqual([paperAt(i, 2000, 310, 270).x, paperAt(i, 2000, 310, 270).y]));
  });

  test('the gates at daybreak: three shafts of light from the sun, swaying a little, in its colour', () => {
    const { sun } = STILLS['still-dawn'];
    const page = draw('still-dawn', 1000);
    // A shaft is two shapes, a wide one and a narrow one inside it: three shafts are six.
    expect(page.shapes).toHaveLength(6);
    for (const shaft of page.shapes) {
      expect(shaft.blend).toBe('lighter');
      expect(shaft.stops[0][1]).toMatch(/^rgba\(255, 208, 112, /);
      // It starts at the sun.
      expect(shaft.points.some((p) => Math.abs(p.x - sun!.x) < 1 && Math.abs(p.y - sun!.y) < 1)).toBe(true);
    }
    expect(alphaOf(page.shapes[0])).toBeCloseTo(alphaOf(record((ctx) => drawCone(ctx, sun!, sun!.rays[0].to, sun!.rays[0].width, sun!.color, RAY_ALPHA)).shapes[0]), 3);
    // Over half a minute each shaft's foot moves from side to side, by no more than it may.
    const feet = (clock: number): number[] => draw('still-dawn', clock).shapes.filter((_, i) => i % 2 === 0).map((shaft) => shaft.points.reduce((sum, p) => sum + (p.y > 200 ? p.x : 0), 0) / shaft.points.filter((p) => p.y > 200).length);
    const seen = Array.from({ length: 60 }, (_, i) => feet(i * 500));
    sun!.rays.forEach((ray, i) => {
      const xs = seen.map((at) => at[i]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(RAY_SWAY);
      for (const x of xs) expect(Math.abs(x - ray.to.x)).toBeLessThanOrEqual(RAY_SWAY + 0.5);
    });
    // Its lights, its warm haze, and motes in the air.
    expect(page.glows.filter(isLight)).toHaveLength(3);
    expect(hazes(page)).toHaveLength(3);
    expect(particles(page)).toHaveLength(PARTICLES.motes);
  });

  test('the title\'s picture is the place the title is: its lights, its two searchlights, its mist and its rain', () => {
    const page = draw('still-varn', 2000);
    // Every light of the title that is on at that moment (a beacon may be dark), and both searchlights.
    expect(page.glows.filter(isLight)).toHaveLength(titleLights(2000).filter((light) => light.alpha >= 0.01).length);
    expect(page.glows.filter(isLight).length).toBeGreaterThanOrEqual(TITLE_LIGHTS.length - 3);
    expect(page.shapes).toHaveLength(SEARCHLIGHTS.length * 2);
    // Three banks of mist over the water, and the darker edges the title's picture has.
    expect(hazes(page)).toHaveLength(4);
    expect(page.rects.filter((r) => r.w === 1 && r.h >= 2)).toHaveLength(PARTICLES.rain);
    expect(page.rects.length).toBeGreaterThan(PARTICLES.rain);
    expect(page.rects.length).toBeLessThanOrEqual(PARTICLES.rain + SPLASHES * 3 + 1);
    // Lightning lights it when it strikes.
    expect(draw('still-varn', STRIKE).rects.filter((r) => r.blend === 'overlay')).toHaveLength(1);
  });

  test('a place a conversation is held in has that place\'s lights, haze and weather', () => {
    const mine = draw('bg-mine', 2000);
    expect(mine.glows.filter(isLight)).toHaveLength(AMBIENCE['bg-mine'].lights.length);
    AMBIENCE['bg-mine'].lights.forEach((light, i) => expect(mine.glows.filter(isLight)[i]).toMatchObject({ x: light.x, y: light.y, r: light.r }));
    expect(hazes(mine)).toHaveLength(3);
    expect(particles(mine)).toHaveLength(PARTICLES.dust);
    const rain = draw('bg-neon-district', STRIKE);
    expect(rain.rects.filter((r) => r.blend === 'overlay')).toHaveLength(1);
    expect(rain.glows.filter(isLight)).toHaveLength(AMBIENCE['bg-neon-district'].lights.length);
  });

  test('a picture nothing is known about is left as it is, and nothing fails', () => {
    const page = draw('no-such-picture', 2000);
    expect([page.glows, page.rects, page.shapes, page.washes]).toEqual([[], [], [], []]);
  });

  test('a calm picture has its lights and shafts at half strength and no lightning; nothing that falls is taken away', () => {
    for (const picture of ['still-war', 'still-dawn', 'bg-mine']) {
      const full = draw(picture, 2000).glows.filter(isLight);
      const calm = draw(picture, 2000, true).glows.filter(isLight);
      expect(calm).toHaveLength(full.length);
      // Each at half of what a calm picture's light of that kind is.
      const want = stillLights(picture, 2000, true);
      want.forEach((light, i) => expect(strength(calm[i]), `${picture} light ${i}`).toBeCloseTo(light.alpha / 2, 2));
      expect(particles(draw(picture, 2000, true))).toHaveLength(particles(draw(picture, 2000)).length);
    }
    // The title's picture as well: its beacons hold instead of coming and going, and all of it is at half strength.
    const varn = draw('still-varn', 2000, true).glows.filter(isLight);
    const wanted = titleLights(2000, true);
    expect(varn).toHaveLength(wanted.length);
    wanted.forEach((light, i) => expect(strength(varn[i]), `varn light ${i}`).toBeCloseTo(light.alpha / 2, 2));
    expect(titleLights(2000, true).map((light) => light.alpha)).not.toEqual(titleLights(2000).map((light) => light.alpha));
    const shafts = draw('still-dawn', 1000, true).shapes;
    expect(shafts).toHaveLength(6);
    expect(alphaOf(shafts[0])).toBeCloseTo(alphaOf(draw('still-dawn', 1000).shapes[0]) / 2, 3);
    for (const picture of ['still-varn', 'bg-neon-district']) expect(draw(picture, STRIKE, true).rects.filter((r) => r.blend === 'overlay')).toEqual([]);
  });

  test('a hurried game has the picture standing still: its lights as they are at the start, and nothing falling', () => {
    for (const picture of PICTURES) {
      const page = draw(picture, 7777, false, true);
      expect(page.rects, picture).toEqual([]);
      expect(page.glows.filter(isLight).length, picture).toBeGreaterThanOrEqual(3);
      expect(page, picture).toEqual(draw(picture, 0, false, true));
      expect(page.glows.filter(isLight).map(strength), picture).toEqual(stillLights(picture, 0).filter((light) => light.alpha >= 0.01).map((light) => Number(Math.min(1, light.alpha).toFixed(3))));
    }
    // The shafts of the sun stand straight.
    const { sun } = STILLS['still-dawn'];
    const shafts = draw('still-dawn', 7777, false, true).shapes.filter((_, i) => i % 2 === 0);
    shafts.forEach((shaft, i) => {
      const foot = shaft.points.filter((p) => p.y > 200);
      expect(foot.reduce((sum, p) => sum + p.x, 0) / foot.length).toBeCloseTo(sun!.rays[i].to.x, 5);
    });
  });

  test('with less light: half of each picture\'s lights and neither haze nor shafts; with none, only what falls', () => {
    setDetail(1);
    for (const picture of PICTURES) {
      const page = draw(picture, 2000);
      const own = stillLights(picture, 2000).length;
      const sparks = stillWeather(picture) === 'embers' ? EMBER_LIGHTS : 0;
      expect(page.glows.filter(isLight), picture).toHaveLength(Math.ceil(own / 2) + sparks);
      expect(hazes(page), picture).toEqual([]);
      expect(page.shapes, picture).toEqual([]);
    }
    setDetail(0);
    for (const picture of PICTURES) {
      const page = draw(picture, 2000);
      expect([page.glows, page.shapes, page.washes], picture).toEqual([[], [], []]);
      expect(page.rects.length, picture).toBeGreaterThan(10);
    }
  });
});

describe('a page of story on its picture', () => {
  const shade = (page: Drawn): Filled => page.rects.find((r) => r.w === 310 && r.h === 270 && r.color.startsWith('rgba(8, 8, 20,'))!;
  const veil = (page: Drawn): number => Number(/, ([\d.]+)\)$/.exec(shade(page).color)![1]);

  test('the picture drifts very slightly, and what makes it a place drifts with it', () => {
    expect([DRIFT, DRIFT_MS]).toEqual([3, 16000]);
    const { app } = appWith();
    const drifts = new Set<number>();
    for (let clock = 0; clock <= DRIFT_MS; clock += 250) {
      const page = record((ctx) => drawPlace(ctx, app, 'still-war', clock));
      const pictures = page.images.filter((image) => (image.image as { id: string }).id === 'still-war');
      // Pixel for pixel, once as it is, and once more a few pixels up or down so that no edge shows.
      expect(pictures[0]).toMatchObject({ x: 0, y: 0, w: 310, h: 270 });
      const drift = pictures.length === 2 ? pictures[1].y : 0;
      expect(pictures.length).toBe(drift === 0 ? 1 : 2);
      if (pictures[1]) expect(pictures[1]).toMatchObject({ x: 0, w: 310, h: 270 });
      expect(Number.isInteger(drift)).toBe(true);
      expect(Math.abs(drift)).toBeLessThanOrEqual(DRIFT);
      drifts.add(drift);
      // Its first light is where the picture has it, moved by as much.
      const first = page.glows.filter(isLight)[0];
      expect(first.y).toBe(STILLS['still-war'].lights[0].y + drift);
      expect(first.x).toBe(STILLS['still-war'].lights[0].x);
    }
    // Up and down by all three pixels, and back where it began after sixteen seconds.
    expect([...drifts].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    const at = (clock: number): number => record((ctx) => drawPlace(ctx, app, 'still-war', clock)).glows.filter(isLight)[0].y;
    expect(at(DRIFT_MS + 1000)).toBe(at(1000));
    expect(at(DRIFT_MS / 4)).toBe(STILLS['still-war'].lights[0].y + DRIFT);
    // What was moved for the picture is put back for what is drawn after it.
    const after = record((ctx) => { drawPlace(ctx, app, 'still-war', DRIFT_MS / 4); ctx.fillRect(5, 5, 1, 1); });
    expect(after.rects.at(-1)).toMatchObject({ x: 5, y: 5 });
  });

  test('a calm picture is told to the place: its lights are at half strength on a page as anywhere', () => {
    const { app } = appWith({ calm: true });
    const page = record((ctx) => drawPlace(ctx, app, 'still-war', 0));
    const wanted = stillLights('still-war', 0, true);
    const lit = page.glows.filter(isLight).slice(0, wanted.length);
    wanted.forEach((light, i) => expect(strength(lit[i]), `light ${i}`).toBeCloseTo(light.alpha / 2, 2));
    // Otherwise they are at full strength.
    const full = record((ctx) => drawPlace(ctx, appWith().app, 'still-war', 0)).glows.filter(isLight);
    expect(strength(full[0])).toBeCloseTo(stillLights('still-war', 0)[0].alpha, 2);
  });

  test('a hurried game has the picture standing still, drawn once, with nothing falling', () => {
    const { app } = appWith({}, true);
    const page = record((ctx) => drawPlace(ctx, app, 'still-war', DRIFT_MS / 4));
    expect(page.images).toHaveLength(1);
    expect(page.rects).toEqual([]);
    expect(page.glows.filter(isLight)[0].y).toBe(STILLS['still-war'].lights[0].y);
  });

  test('the picture has the screen to itself under hardly any shade; with the words up the shade is light', () => {
    expect([VEIL_CLEAR, VEIL_WORDS]).toEqual([0.1, 0.45]);
    const screen = new SceneScreen(appWith({ textSpeed: 'instant' }).app, scene('act-2'));
    expect(veil(record((ctx) => screen.draw(ctx)))).toBeCloseTo(VEIL_CLEAR, 3);
    screen.update(440);
    expect(veil(record((ctx) => screen.draw(ctx)))).toBeCloseTo(VEIL_CLEAR, 3);
    screen.update(235);
    expect(veil(record((ctx) => screen.draw(ctx)))).toBeCloseTo((VEIL_CLEAR + VEIL_WORDS) / 2, 2);
    screen.update(400);
    expect(veil(record((ctx) => screen.draw(ctx)))).toBeCloseTo(VEIL_WORDS, 3);
    // A hurried game has the words at once, and the shade with them.
    const fast = new SceneScreen(appWith({}, true).app, scene('act-2'));
    expect(veil(record((ctx) => fast.draw(ctx)))).toBeCloseTo(VEIL_WORDS, 3);
  });

  test('the place is under the shade and the words are over it', () => {
    const screen = new SceneScreen(appWith({ textSpeed: 'instant' }).app, scene('act-2'));
    screen.update(3000);
    const page = record((ctx) => screen.draw(ctx));
    const at = (kind: string, index: number): number => page.order.findIndex((step) => step.kind === kind && step.at === index);
    const veilAt = at('rect', page.rects.indexOf(shade(page)));
    // The picture's own eight lights and the sparks' are before the shade; the title's light comes after.
    const lights = page.glows.map((glow, i) => ({ glow, i })).filter(({ glow }) => isLight(glow));
    const place = lights.filter(({ glow }) => STILLS['still-war'].lights.some((light) => light.x === glow.x && light.r === glow.r));
    expect(place).toHaveLength(8);
    for (const { i } of place) expect(at('glow', i)).toBeLessThan(veilAt);
    expect(lights.filter(({ i }) => at('glow', i) > veilAt).length).toBeGreaterThanOrEqual(2);
    // Every spark is under the shade, and every word over it.
    const sparks = page.rects.map((rect, i) => ({ rect, i })).filter(({ rect }) => rect.w === 1 && rect.h === 1 && rect.color.startsWith('rgba(255,'));
    expect(sparks).toHaveLength(PARTICLES.embers);
    for (const { i } of sparks) expect(at('rect', i)).toBeLessThan(veilAt);
    expect(page.texts.length).toBeGreaterThan(20);
    page.texts.forEach((_, i) => expect(at('text', i)).toBeGreaterThan(veilAt));
    expect(at('image', 0)).toBeLessThan(at('glow', place[0].i));
  });

  test('every word has a dark edge to be read by: the heading, each line of the page, and the way on', () => {
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const { app } = appWith({ textSpeed: 'instant' }, true);
      for (const page of SCENES.filter((s) => !s.talk)) {
        const drawn = record((ctx) => new SceneScreen(app, page).draw(ctx));
        const words = drawn.texts.filter((t) => t.color !== '#07061a');
        expect(words.length, page.id).toBeGreaterThanOrEqual(1);
        for (const word of words) {
          // Eight times in the dark colour, a pixel off in every direction, before the word itself.
          const edge = drawn.texts.filter((t) => t.color === '#07061a' && t.text === word.text && Math.abs(t.x - word.x) <= 1 && Math.abs(t.y - word.y) <= 1);
          expect(edge.length, `${language} ${page.id}: ${word.text}`).toBe(8);
          expect(drawn.texts.indexOf(word)).toBeGreaterThan(Math.max(...edge.map((t) => drawn.texts.indexOf(t))));
          // And it stays on the screen, with room either side.
          expect(word.left, word.text).toBeGreaterThanOrEqual(4);
          expect(word.right, word.text).toBeLessThanOrEqual(306);
          expect(word.y + word.size, word.text).toBeLessThanOrEqual(266);
        }
        // The way on is written in the dim colour, the lines in the plain one.
        expect(words.at(-1)!.color).toBe(COLORS.dim);
      }
    }
  });

  test('where it rains on the page there is lightning, and its thunder is heard; nowhere else, and not in a calm picture or a hurried game', () => {
    const strokes = (ms: number): number => { let n = 0; for (let now = 16; now <= ms; now += 16) if (strokeBegan(now - 16, now)) n++; return n; };
    const run = (id: string, settings: Partial<Settings> = {}, fast = false, detail: 0 | 1 | 2 = 2) => {
      const { app, heard } = appWith(settings, fast);
      // A game sets how much light there is as it starts: what this page is drawn with is set after.
      setDetail(detail);
      const picked = scene(id);
      const screen = picked.talk ? new TalkScreen(app, picked) : new SceneScreen(app, picked);
      for (let t = 0; t < 60_000; t += 16) screen.update(16);
      return heard.filter((sound) => sound.name === 'thunder');
    };
    // The first act opens on Varn in the rain; a conversation in the neon district is rained on too.
    for (const id of ['act-1', 'talk-kite']) {
      const thunder = run(id);
      expect(thunder, id).toHaveLength(strokes(60_000));
      expect(thunder.length).toBeGreaterThanOrEqual(5);
      for (const clap of thunder) expect(clap).toEqual({ name: 'thunder', delay: THUNDER_AFTER_MS, ambient: true });
    }
    for (const id of ['act-2', 'act-3', 'ending-default-undertow', 'talk-marrow', 'talk-logs']) expect(run(id), id).toEqual([]);
    expect(run('act-1', { calm: true })).toEqual([]);
    expect(run('act-1', {}, true)).toEqual([]);
    // Where no soft light is drawn there is no lightning to hear; with less of it there is.
    expect(run('act-1', {}, false, 0)).toEqual([]);
    expect(run('act-1', {}, false, 1)).toHaveLength(strokes(60_000));
  });
});

describe('a conversation in its place', () => {
  test('the place is alive under a light shade, and what is said is in its box over it', () => {
    expect(TALK_VEIL).toBe(0.25);
    const { app } = appWith();
    const screen = new TalkScreen(app, scene('talk-marrow'));
    screen.update(2000);
    const page = record((ctx) => screen.draw(ctx));
    const veilIndex = page.rects.findIndex((r) => r.w === 310 && r.h === 270 && r.color === 'rgba(8, 8, 20, 0.25)');
    expect(veilIndex).toBeGreaterThan(-1);
    const at = (kind: string, index: number): number => page.order.findIndex((step) => step.kind === kind && step.at === index);
    const veilAt = at('rect', veilIndex);
    // The mine's six lamps, its haze and its dust, all under the shade.
    const lamps = page.glows.map((glow, i) => ({ glow, i })).filter(({ glow }) => isLight(glow) && AMBIENCE['bg-mine'].lights.some((light) => light.x === glow.x && light.r === glow.r));
    expect(lamps).toHaveLength(AMBIENCE['bg-mine'].lights.length);
    for (const { i } of lamps) expect(at('glow', i)).toBeLessThan(veilAt);
    const dust = page.rects.map((rect, i) => ({ rect, i })).filter(({ rect }) => rect.w === 1 && rect.h === 1 && rect.color.startsWith('rgba(214, 190, 140,'));
    expect(dust).toHaveLength(PARTICLES.dust);
    for (const { i } of dust) expect(at('rect', i)).toBeLessThan(veilAt);
    // What is said comes after.
    page.texts.forEach((_, i) => expect(at('text', i)).toBeGreaterThan(veilAt));
    // The heading has a dark edge; it is not in a box.
    const heading = page.texts.filter((t) => t.text === scene('talk-marrow').heading);
    expect(heading).toHaveLength(9);
    expect(heading.at(-1)!.color).toBe(COLORS.dim);
  });

  test('every conversation\'s place is one that is told about: none is a bare picture', () => {
    for (const talk of SCENES.filter((s) => s.talk)) {
      expect(talk.picture, talk.id).toBeDefined();
      expect(stillLights(talk.picture!, 0).length, talk.id).toBeGreaterThanOrEqual(3);
    }
  });

  test('a hurried game has the place standing still', () => {
    const { app } = appWith({}, true);
    const page = record((ctx) => new TalkScreen(app, scene('talk-marrow')).draw(ctx));
    expect(page.images.filter((image) => (image.image as { id: string }).id === 'bg-mine')).toHaveLength(1);
    expect(page.rects.filter((r) => r.color.startsWith('rgba(214, 190, 140,'))).toEqual([]);
  });
});
