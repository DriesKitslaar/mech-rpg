import { createBattle } from '../../src/core/battle';
import { isValidState } from '../../src/core/game';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { PACE_KEY, SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { AMBIENCE, drawAmbience, placeLights } from '../../src/ui/ambience';
import { App, TRY_AGAIN, WAITS, startingLight } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { drawCutIn, drawDefeat, drawVictory } from '../../src/ui/cinema';
import {
  MAX_LIGHTS, chosenLights, detail, discRows, drawAll, drawBeam, drawCone, drawGlow, drawGlows, drawLights, drawShadow, keptLights, lightRoom, setDetail, soft, wide, type Glow,
} from '../../src/ui/light';
import { WARM_UP } from '../../src/ui/pace';
import { drawRoom, drawRoomSpill } from '../../src/ui/room';
import { STILLS, drawStill, stillLights } from '../../src/ui/stills';
import { drawTitleScene, titleLights } from '../../src/ui/titleScene';
import { LOGO, logoLights } from '../../src/ui/logo';
import { wordLights } from '../../src/ui/signType';
import { EMBER_LIGHTS, LIGHTNING_MS, drawWeatherExtras, lightning, struck } from '../../src/ui/weather';
import { COLORS, drawPanel, drawRowLight } from '../../src/ui/widgets';
import { done, inHub, memoryStore, press, select, snap } from '../helpers/app';
import { record, signIn, type Drawn, type Glowed } from '../helpers/canvas';

/**
 * How much of the soft light is drawn: all of it, less, or none. Less and none are for a handheld
 * that cannot keep up, or a player who asks for it; what is solid is the same at every level.
 */

afterEach(() => setDetail(2));

const FIELD = { top: 14, height: 164, width: 310 };
const glow = (over: Partial<Glow> = {}): Glow => ({ x: 100, y: 80, r: 30, color: '#ff8040', alpha: 0.8, ...over });
const many = (n: number): Glow[] => Array.from({ length: n }, (_, i) => glow({ x: i, alpha: 0.1 + (i % 10) * 0.05, r: 10 + i }));
/** Everything soft in a drawing: round lights and shadows, washes, cones, and strokes that add light. */
const softThings = (page: Drawn): number => page.glows.length + page.washes.length + page.shapes.length + page.strokes.filter((s) => s.blend === 'lighter').length;
/** A moment at which lightning is at its brightest. */
const STRIKE = (() => { for (let t = 0; t < LIGHTNING_MS * 3; t += 10) if (lightning(t) === 1) return t; throw new Error('no stroke'); })();

describe('the three levels', () => {
  test('all of the light unless something says otherwise', () => {
    expect(detail()).toBe(2);
    expect(soft()).toBe(true);
    expect(wide()).toBe(true);
    expect([0, 1, 7, 16, 17].map(lightRoom)).toEqual([0, 1, 7, 16, 17]);
    setDetail(1);
    expect([soft(), wide()]).toEqual([true, false]);
    expect([0, 1, 7, 16, 17].map(lightRoom)).toEqual([0, 1, 4, 8, 9]);
    setDetail(0);
    expect([soft(), wide()]).toEqual([false, false]);
    expect([0, 1, 7, 16, 17].map(lightRoom)).toEqual([0, 0, 0, 0, 0]);
  });

  test('less: half the lights, and nothing that lies over a whole field or screen', () => {
    setDetail(1);
    expect(chosenLights(many(40))).toHaveLength(MAX_LIGHTS / 2);
    expect(record((ctx) => drawGlows(ctx, many(40))).glows).toHaveLength(8);
    // Where some of the room is taken already, half of what is left.
    expect(chosenLights(many(40), false, 10)).toHaveLength(5);
    // A place's own set of lights: the larger half of it, in the order it was given.
    const set = many(17);
    const drawn = record((ctx) => drawLights(ctx, set)).glows;
    expect(drawn).toHaveLength(9);
    expect(drawn.map((g) => g.x)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    // A row of lights that was thinned where it was made is drawn as it is given: nothing more is taken from it.
    expect(record((ctx) => drawAll(ctx, set)).glows).toHaveLength(17);
    // Single lights, shadows under machines and beams are small: they stay.
    expect(record((ctx) => drawGlow(ctx, glow())).glows).toHaveLength(1);
    expect(record((ctx) => drawShadow(ctx, 50, 200, 60, 10, 0.4)).glows).toHaveLength(1);
    expect(record((ctx) => drawBeam(ctx, { x: 0, y: 0 }, { x: 50, y: 20 }, 3, '#7fe9ff', 1)).strokes).toHaveLength(4);
    // A cone of light, the darker edges of a place and its haze do not.
    expect(record((ctx) => drawCone(ctx, { x: 100, y: 200 }, { x: 100, y: 50 }, 30, '#80c0ff', 0.2)).shapes).toEqual([]);
    const place = record((ctx) => drawAmbience(ctx, 'bg-foundry', 1000, 'behind', FIELD));
    expect(place.glows.filter((g) => g.blend === 'source-over')).toEqual([]);
    expect(place.glows.filter((g) => g.blend === 'lighter')).toHaveLength(Math.ceil(AMBIENCE['bg-foundry'].lights.length / 2));
    expect(record((ctx) => drawAmbience(ctx, 'bg-foundry', 1000, 'front', FIELD)).glows).toEqual([]);
    // What a room's lights spill onto the mech standing in it: half of them too, and the same half.
    const lights = placeLights('bg-garage', 1000);
    expect(lights.length).toBeGreaterThan(2);
    const spill = record((ctx) => drawRoomSpill(ctx, 'bg-garage', 1000)).glows;
    expect(spill).toHaveLength(Math.ceil(lights.length / 2));
    const behind = record((ctx) => drawRoom(ctx, 'bg-garage', 1000, false, true)).glows.filter((g) => g.blend === 'lighter');
    expect(spill.map((g) => [g.x, g.y])).toEqual(behind.map((g) => [g.x, g.y]));
    setDetail(2);
    expect(record((ctx) => drawRoomSpill(ctx, 'bg-garage', 1000)).glows.filter((g) => g.blend === 'lighter')).toHaveLength(lights.length);
  });

  test('less: a box keeps its plate and loses its shadow; the row under the cursor is still lit', () => {
    setDetail(1);
    const box = record((ctx) => drawPanel(ctx, 7, 20, 100, 60));
    expect(box.washes.length).toBeGreaterThan(1);
    expect(box.washes.every((w) => w.y + w.h <= 80)).toBe(true);
    expect(record((ctx) => drawRowLight(ctx, 20, 50, 90)).washes).toHaveLength(1);
  });

  test('less: what a battle stages keeps what is solid and gives up what lies over the field', () => {
    setDetail(1);
    // The band keeps its wash of colour: it is as large as the band, not as the field.
    expect(record((ctx) => drawCutIn(ctx, 400, FIELD, { heading: 'OVERDRIVE', name: 'DEADEYE' }, () => undefined)).washes).toHaveLength(1);
    // A field that was won: the motes rise, and that is all.
    const won = record((ctx) => drawVictory(ctx, 2000, FIELD));
    expect([won.washes, won.shapes]).toEqual([[], []]);
    expect(won.rects.length).toBeGreaterThan(5);
    // A field that was lost: the colour is not taken out (that is the costliest thing a result draws) and no
    // red closes in from its edges (that lies over the whole field); it is darker instead.
    const lost = record((ctx) => drawDefeat(ctx, 2000, FIELD));
    expect(lost.rects.some((r) => r.blend === 'saturation')).toBe(false);
    expect(lost.rects.map((r) => r.color)).toEqual(['rgba(6, 4, 10, 0.550)']);
    expect(softThings(lost)).toBe(0);
    setDetail(2);
    expect(record((ctx) => drawDefeat(ctx, 2000, FIELD)).glows).toHaveLength(1);
    setDetail(1);
    // Lightning lights the field and leaves the sky alone.
    const stroke = record((ctx) => drawWeatherExtras(ctx, 'rain', STRIKE, 310, 164));
    expect(stroke.rects.filter((r) => r.blend === 'overlay')).toHaveLength(1);
    expect(stroke.washes).toEqual([]);
  });

  test('none: nothing soft is drawn by anything, and nothing fails', () => {
    setDetail(0);
    const page = record((ctx) => {
      drawGlow(ctx, glow());
      drawGlows(ctx, many(40));
      drawLights(ctx, many(17));
      drawAll(ctx, many(17));
      drawShadow(ctx, 50, 200, 60, 10, 0.4);
      drawBeam(ctx, { x: 0, y: 0 }, { x: 50, y: 20 }, 3, '#7fe9ff', 1);
      drawCone(ctx, { x: 100, y: 200 }, { x: 100, y: 50 }, 30, '#80c0ff', 0.2);
      drawAmbience(ctx, 'bg-foundry', 1000, 'behind', FIELD);
      drawAmbience(ctx, 'bg-foundry', 1000, 'front', FIELD);
      drawRowLight(ctx, 20, 50, 90);
      drawVictory(ctx, 2000, FIELD);
      drawWeatherExtras(ctx, 'rain', STRIKE, 310, 164);
      drawWeatherExtras(ctx, 'embers', 1000, 310, 164);
    });
    expect(softThings(page)).toBe(0);
    expect(struck(STRIKE)).toBe(0);
    expect(page.rects.some((r) => r.blend === 'overlay')).toBe(false);
    expect(chosenLights(many(40))).toEqual([]);
  });

  test('none: a box is its plain dark plate, framed; a lost field is only darker; a band is only its plate', () => {
    setDetail(0);
    const box = record((ctx) => drawPanel(ctx, 7, 20, 100, 60));
    expect(softThings(box)).toBe(0);
    const plate = box.rects.filter((r) => r.color === COLORS.panel);
    expect(plate.reduce((sum, r) => sum + r.w * r.h, 0)).toBe(100 * 60 - 12);
    expect(box.rects.some((r) => r.color === COLORS.border)).toBe(true);
    for (const r of box.rects) expect(r.y + r.h).toBeLessThanOrEqual(80);
    const lost = record((ctx) => drawDefeat(ctx, 2000, FIELD));
    expect(softThings(lost)).toBe(0);
    expect(lost.rects.map((r) => [r.color, r.blend])).toEqual([['rgba(6, 4, 10, 0.550)', 'source-over']]);
    const band = record((ctx) => drawCutIn(ctx, 400, FIELD, { heading: 'OVERDRIVE', name: 'DEADEYE' }, () => undefined));
    expect(softThings(band)).toBe(0);
    expect(band.rects.some((r) => r.color === 'rgba(8, 6, 22, 0.94)')).toBe(true);
    // Its name is in the sign's letters: solid, like the plate.
    expect(signIn(band, 'DEADEYE', 'steel')).not.toBeNull();
  });

  test('the rows of a circle are worked out once for each size', () => {
    expect(discRows(6)).toBe(discRows(6));
    expect(discRows(6.4)).toBe(discRows(6));
    expect(discRows(7)).not.toBe(discRows(6));
    expect(discRows(6)).toHaveLength(13);
    expect(discRows(0).map((row) => row.half)).toEqual([0]);
  });
});

describe('whole screens with less light, and with none', () => {
  const named = { sprites: { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) } };
  const settled = () => ({ ...done('intro-1', 'intro-2'), scenes: SCENES.map((scene) => scene.id) });
  /** A battle on real ground, a few frames into a volley of its heaviest gun. */
  function volley(): Drawn {
    const state = createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES.tank], CATALOG, 7);
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, named.sprites, CATALOG, { fast: false, background: 'bg-foundry' });
    for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    screen.onInput('confirm');
    for (let i = 0; i < 12; i++) screen.update(16);
    return record((ctx) => screen.draw(ctx));
  }

  test('with none: a battle in the thick of it, the title, the hub and its rooms draw nothing soft at all', () => {
    setDetail(0);
    expect(softThings(volley())).toBe(0);
    const title = new App({ catalog: CATALOG, save: new SaveFile(memoryStore(), CATALOG), sprites: named.sprites, fast: false, seed: 3 });
    title.update(3000);
    setDetail(0);
    expect(softThings(record((ctx) => title.draw(ctx)))).toBe(0);
    const { app } = inHub(settled(), undefined, { ...named, fast: false });
    app.update(2500);
    setDetail(0);
    expect(softThings(record((ctx) => app.draw(ctx)))).toBe(0);
    for (const room of ['garage', 'arena', 'training', 'gauntlet', 'shop', 'options']) {
      select(app, room);
      app.update(300);
      setDetail(0);
      expect(softThings(record((ctx) => app.draw(ctx))), room).toBe(0);
      press(app, 'cancel');
    }
  });

  test('with less: a battle has at most eight lights of its own beside the place\'s, and no haze or darker edges', () => {
    setDetail(1);
    const page = volley();
    const lights = page.glows.filter((g) => g.blend === 'lighter');
    const place = Math.ceil(AMBIENCE['bg-foundry'].lights.length / 2);
    expect(lights.length).toBeGreaterThan(place);
    // The place's half, the embers in its air, and the battle's eight.
    expect(lights.length).toBeLessThanOrEqual(place + 6 + 8);
    // The only soft thing that is not a light is a shadow under each of the three that stand there.
    expect(page.glows.filter((g) => g.blend === 'source-over')).toHaveLength(3);
    expect(page.shapes).toEqual([]);
  });
});

describe('what the handheld managed, from one session to the next', () => {
  const file = (data: Record<string, string> = {}) => { const store = memoryStore(data); return { store, save: new SaveFile(store, CATALOG) }; };

  test('a handheld never found wanting starts with all of the light, judged, and nothing is kept about it', () => {
    const { store, save } = file();
    expect(startingLight(save)).toEqual({ level: 2, judge: true });
    expect(store.data[PACE_KEY]).toBeUndefined();
  });

  test('one that was found slow gets a chance at the step it lost in the very next session: it may have been the day, not the handheld', () => {
    const { store, save } = file({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 0 }) });
    expect(startingLight(save)).toEqual({ level: 2, judge: true, chance: { tries: 0 } });
    // What is kept is not touched until it is seen how the chance goes: a session closed at once has found nothing out.
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    expect(startingLight(save)).toEqual({ level: 2, judge: true, chance: { tries: 0 } });
    // From no light at all the chance is one step, not two.
    const dark = file({ [PACE_KEY]: JSON.stringify({ level: 0, runs: 0 }) });
    expect(startingLight(dark.save)).toEqual({ level: 1, judge: true, chance: { tries: 0 } });
    expect(JSON.parse(dark.store.data[PACE_KEY])).toEqual({ level: 0, runs: 0 });
  });

  test('a chance that was lost is not given again at once: two sessions later, then four, then every eight', () => {
    expect(WAITS).toEqual([0, 2, 4, 8]);
    for (const [tries, wait] of [[1, 2], [2, 4], [3, 8], [4, 8], [40, 8]]) {
      const { store, save } = file({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 0, tries }) });
      // Until then it starts where it ended, judged (it may have to give up more), and the sessions are counted.
      for (let run = 1; run <= wait; run++) {
        expect(startingLight(save), `${tries} tries`).toEqual({ level: 1, judge: true });
        expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: run, tries });
      }
      expect(startingLight(save), `${tries} tries`).toEqual({ level: 2, judge: true, chance: { tries } });
      expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: wait, tries });
    }
  });

  test('one whose light was found not to be what it is slow at is left alone for five sessions, then judged again', () => {
    expect(TRY_AGAIN).toBe(5);
    const { store, save } = file({ [PACE_KEY]: JSON.stringify({ level: 2, runs: 0, held: true }) });
    for (let run = 1; run <= TRY_AGAIN; run++) {
      expect(startingLight(save)).toEqual({ level: 2, judge: false });
      expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 2, runs: run, held: true });
    }
    // Judged again with all of its light; what is kept stays until it is seen how that goes.
    expect(startingLight(save)).toEqual({ level: 2, judge: true, chance: { tries: 0 } });
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 2, runs: TRY_AGAIN, held: true });
    // Left alone at less than all of it: the chance it gets is a step up, and that is judged.
    const lean = file({ [PACE_KEY]: JSON.stringify({ level: 1, runs: TRY_AGAIN, held: true }) });
    expect(startingLight(lean.save)).toEqual({ level: 2, judge: true, chance: { tries: 0 } });
    // Not sooner than that, however often a chance was lost before.
    const early = file({ [PACE_KEY]: JSON.stringify({ level: 1, runs: TRY_AGAIN - 1, held: true }) });
    expect(startingLight(early.save)).toEqual({ level: 1, judge: false });
  });

  test('what is kept but cannot be read counts as nothing kept', () => {
    const unreadable = [
      '{not json', '[]', '7', 'null',
      // All of the light and judged is what a handheld has that nothing is kept about: kept, it says nothing.
      { level: 2, runs: 0 }, { level: 3, runs: 0, held: true }, { level: -1, runs: 0 },
      { level: 1, runs: -1 }, { level: 1, runs: 1.5 }, { level: 1, runs: 10000 }, { level: '1', runs: 0 }, { level: 1 }, { runs: 1 },
      { level: 1, runs: 0, held: 'yes' }, { level: 1, runs: 0, held: false }, { level: 2, runs: 0, held: 1 },
      // How often a chance was lost: a whole number from one to ninety-nine, and no reason by itself to keep all of the light.
      { level: 1, runs: 0, tries: 0 }, { level: 1, runs: 0, tries: 1.5 }, { level: 1, runs: 0, tries: 100 }, { level: 1, runs: 0, tries: '1' }, { level: 2, runs: 0, tries: 1 },
    ].map((raw) => (typeof raw === 'string' ? raw : JSON.stringify(raw)));
    for (const raw of unreadable) {
      const { save } = file({ [PACE_KEY]: raw });
      expect(save.loadPace(), raw).toBeNull();
      expect(startingLight(save), raw).toEqual({ level: 2, judge: true });
    }
    const { save } = file();
    expect(save.savePace({ level: 0, runs: 3 })).toBe(true);
    expect(save.loadPace()).toEqual({ level: 0, runs: 3 });
    expect(save.savePace({ level: 2, runs: 9999, held: true })).toBe(true);
    expect(save.loadPace()).toEqual({ level: 2, runs: 9999, held: true });
    expect(save.savePace({ level: 0, runs: 3, tries: 99 })).toBe(true);
    expect(save.loadPace()).toEqual({ level: 0, runs: 3, tries: 99 });
    expect(save.savePace(null)).toBe(true);
    expect(save.loadPace()).toBeNull();
    // A store that cannot be written to: it says so, and nothing fails.
    const full = new SaveFile({ getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('full'); } }, CATALOG);
    expect(full.savePace({ level: 1, runs: 0 })).toBe(false);
    expect(full.savePace(null)).toBe(false);
    expect(startingLight(full)).toEqual({ level: 2, judge: true });
  });
});

describe('less light stands still', () => {
  const at = (g: { x: number; y: number }): string => `${g.x},${g.y}`;
  const lit = (page: Drawn): Glowed[] => page.glows.filter((g) => g.blend === 'lighter');

  test('the half of a set that is kept is its largest lights, and the same ones however they flicker', () => {
    setDetail(1);
    const sizes = [12, 30, 18, 30, 44, 12, 26];
    const set = (t: number): Glow[] => sizes.map((r, i) => glow({ x: i * 10, r, alpha: 0.2 + 0.6 * Math.abs(Math.sin(t / 130 + i * 1.7)) }));
    // Four of seven: the forty-four, both thirties and the twenty-six, in the order they were given.
    expect(keptLights(set(0)).map((g) => g.x)).toEqual([10, 30, 40, 60]);
    // The brightest four are not always those four: by brightness the choice would change as they flicker.
    const brightest = new Set<string>();
    for (let t = 0; t < 20000; t += 16) {
      expect(record((ctx) => drawLights(ctx, set(t))).glows.map((g) => g.x)).toEqual([10, 30, 40, 60]);
      brightest.add([...set(t)].sort((a, b) => b.alpha * b.r * b.r - a.alpha * a.r * a.r).slice(0, 4).map((g) => g.x).sort((a, b) => a - b).join());
    }
    expect(brightest.size).toBeGreaterThan(1);
    // Of lights of one size, the ones given first.
    expect(keptLights([1, 2, 3, 4, 5].map((x) => ({ x, r: 20 }))).map((g) => g.x)).toEqual([1, 2, 3]);
    // With all of the light there is nothing to choose, and with none nothing to keep.
    setDetail(2);
    expect(keptLights(set(0)).map((g) => g.x)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    setDetail(0);
    expect(keptLights(set(0))).toEqual([]);
  });

  test('every place, every picture of the story and the title: the lights that are drawn are the same ones for a minute on end', () => {
    const sets: [string, (t: number, calm: boolean) => Glow[], (t: number, calm: boolean) => Drawn][] = [
      ...Object.keys(AMBIENCE).map((place): [string, (t: number, calm: boolean) => Glow[], (t: number, calm: boolean) => Drawn] => [
        place, (t, calm) => placeLights(place, t, calm), (t, calm) => record((ctx) => drawAmbience(ctx, place, t, 'behind', FIELD, calm)),
      ]),
      ...Object.keys(STILLS).map((picture): [string, (t: number, calm: boolean) => Glow[], (t: number, calm: boolean) => Drawn] => [
        picture, (t, calm) => stillLights(picture, t, calm), (t, calm) => record((ctx) => drawStill(ctx, picture, t, calm)),
      ]),
      ['the title', (t, calm) => titleLights(t, calm), (t, calm) => record((ctx) => drawTitleScene(ctx, t, calm))],
    ];
    expect(sets.length).toBeGreaterThan(12);
    setDetail(1);
    for (const [name, lights, draw] of sets) {
      for (const calm of [false, true]) {
        const own = new Set(lights(0, calm).map(at));
        expect(own.size, name).toBe(lights(0, calm).length);
        expect(lights(0, calm).every((g) => g.r > 7), name).toBe(true);
        const seen = new Set<string>();
        // The sparks in the air have lights of their own, which move: they are told apart by their size.
        for (let t = 0; t < 60000; t += 16) for (const g of lit(draw(t, calm))) if (g.r !== 7 && own.has(at(g))) seen.add(at(g));
        // Half of them (rounded up) and never any other: none comes while another goes.
        expect(seen.size, `${name}${calm ? ', calm' : ''}`).toBe(Math.ceil(own.size / 2));
      }
    }
  });

  test('a row of lights is thinned where it is made: half as many, as evenly about its middle', () => {
    /** How far the lights of a row lie from its middle, left to right: the same going in from either end. */
    const even = (lights: Glow[], middle: number, name: string): void => {
      const off = lights.map((g) => g.x - middle);
      off.forEach((o, i) => expect(Math.abs(o + off[off.length - 1 - i]), name).toBeLessThanOrEqual(1));
    };
    setDetail(2);
    expect(logoLights(10, 20, 1)).toHaveLength(6);
    const words: [string, number][] = [['VICTORY', 26], ['DEFEAT', 26], ['GEWONNEN', 26], ['VERLOREN', 26], ['THE AUDIT', 28], ['WARNING', 23], ['SCRAP KING', 18], ['GO', 40]];
    const full = words.map(([text, tall]) => wordLights(text, 155, 60, tall, 'neon').length);
    expect(Math.max(...full)).toBeGreaterThanOrEqual(3);
    setDetail(1);
    // The sign: three of its six, one over its middle and one as far to either side.
    const sign = logoLights(10, 20, 1);
    expect(sign).toHaveLength(3);
    even(sign, 10 + LOGO.w / 2, 'the sign');
    expect(new Set(sign.map((g) => g.color)).size).toBe(2);
    words.forEach(([text, tall], i) => {
      const lights = wordLights(text, 155, 60, tall, 'neon');
      expect(lights, text).toHaveLength(Math.ceil(full[i] / 2));
      even(lights, 155, text);
    });
    // And they are drawn as they were made: every one of them, on the title and under a result.
    expect(lit(record((ctx) => drawAll(ctx, sign))).map((g) => g.x)).toEqual(sign.map((g) => g.x));
    setDetail(0);
    expect(logoLights(10, 20, 1)).toEqual([]);
    expect(wordLights('VICTORY', 155, 60, 26, 'neon')).toEqual([]);
  });

  test('the sparks that have a light: half of them where there is to be less', () => {
    expect(EMBER_LIGHTS).toBe(6);
    expect(lit(record((ctx) => drawWeatherExtras(ctx, 'embers', 1000, 310, 164)))).toHaveLength(6);
    setDetail(1);
    const less = lit(record((ctx) => drawWeatherExtras(ctx, 'embers', 1000, 310, 164)));
    expect(less).toHaveLength(3);
    // The same three sparks as the first three of the six.
    setDetail(2);
    const all = lit(record((ctx) => drawWeatherExtras(ctx, 'embers', 1000, 310, 164)));
    expect(less.map(at)).toEqual(all.slice(0, 3).map(at));
  });
});

describe('the game keeping pace', () => {
  const sprites = { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  const open = (data: Record<string, string> = {}, fast = false) => {
    const store = memoryStore(data);
    return { store, app: new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast, seed: 3 }) };
  };
  // Frames of 34 ms: a window is a second and a half of them, forty-five frames.
  const slowFor = (app: App, windows: number): void => { for (let i = 0; i < 45 * windows; i++) app.frame(34); };
  const warm = (app: App): void => { for (let i = 0; i < WARM_UP; i++) app.frame(16.7); };
  const note = (app: App): string | undefined => (snap(app).menu.items as { id: string; note?: string }[]).find((item) => item.id === 'detail')?.note;

  test('a handheld that keeps up has all of the light, and one that does not has it turned down and remembered', () => {
    const { app, store } = open();
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    warm(app);
    // A minute and a half of keeping up: sixty-six windows of ninety frames.
    for (let i = 0; i < 90 * 66; i++) app.frame(16.7);
    expect(app.lightNow()).toBe('full');
    expect(store.data[PACE_KEY]).toBeUndefined();
    slowFor(app, 3);
    expect(app.lightNow()).toBe('lean');
    expect(detail()).toBe(1);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    slowFor(app, 3);
    expect(app.lightNow()).toBe('bare');
    expect(detail()).toBe(0);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 0, runs: 0 });
    // The next session is a chance at one step more, and the options say where the light is.
    const next = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 3 });
    expect(next.lightNow()).toBe('lean');
    expect(detail()).toBe(1);
    select(next, 'options');
    expect(note(next)).toBe(STRINGS.options.detailAuto.lean);
    expect(snap(next).light).toBe('lean');
    // A chance that is lost: back to none, and the session after that starts there, with nothing to say but that.
    warm(next);
    slowFor(next, 3);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 0, runs: 0, tries: 1 });
    const third = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 3 });
    expect(third.lightNow()).toBe('bare');
    expect(detail()).toBe(0);
    select(third, 'options');
    expect(note(third)).toBe(STRINGS.options.detailAuto.bare);
    expect(snap(third).light).toBe('bare');
  });

  test('one that is slow whatever is drawn gets its light back, and the sessions after leave it alone', () => {
    const { app, store } = open();
    warm(app);
    slowFor(app, 6);
    expect(app.lightNow()).toBe('bare');
    // Without any light the frames are what they were: the light was not what it is slow at.
    slowFor(app, 3);
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 2, runs: 0, held: true });
    slowFor(app, 30);
    expect(app.lightNow()).toBe('full');
    const next = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 3 });
    warm(next);
    slowFor(next, 30);
    expect(next.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 2, runs: 1, held: true });
    select(next, 'options');
    expect(note(next)).toBe('Auto');
  });

  test('a chance at more light that is kept: once it has kept up for a good while, what was held against it is forgotten', () => {
    // Found slow last time, and given all of its light again.
    const { app, store } = open({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 0 }) });
    expect(app.lightNow()).toBe('full');
    warm(app);
    for (let i = 0; i < 90 * 10 - 1; i++) app.frame(16.7);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    app.frame(16.7);
    expect(store.data[PACE_KEY]).toBeUndefined();
    expect(app.lightNow()).toBe('full');
    // From none to less: that is kept as where it is now, and the session after is a chance at the rest.
    const dark = open({ [PACE_KEY]: JSON.stringify({ level: 0, runs: 0 }) });
    expect(dark.app.lightNow()).toBe('lean');
    warm(dark.app);
    for (let i = 0; i < 90 * 10; i++) dark.app.frame(16.7);
    expect(JSON.parse(dark.store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    const next = new App({ catalog: CATALOG, save: new SaveFile(dark.store, CATALOG), sprites, fast: false, seed: 3 });
    expect(next.lightNow()).toBe('full');
  });

  test('a chance that is lost is counted, so that the next one is longer in coming', () => {
    const { app, store } = open({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 2, tries: 1 }) });
    expect(app.lightNow()).toBe('full');
    warm(app);
    slowFor(app, 3);
    expect(app.lightNow()).toBe('lean');
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0, tries: 2 });
    // Further down in the same session is something new found out: nothing has been tried from there yet.
    slowFor(app, 3);
    expect(app.lightNow()).toBe('bare');
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 0, runs: 0 });
    // Lost after it had seemed kept (the title kept up, a battle did not): counted all the same.
    const late = open({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 0 }) });
    warm(late.app);
    for (let i = 0; i < 90 * 10; i++) late.app.frame(16.7);
    expect(late.store.data[PACE_KEY]).toBeUndefined();
    slowFor(late.app, 3);
    expect(JSON.parse(late.store.data[PACE_KEY])).toEqual({ level: 1, runs: 0, tries: 1 });
    // What is lost is not won back by keeping up with less light for the rest of the session.
    const after = open({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 2, tries: 1 }) });
    warm(after.app);
    slowFor(after.app, 3);
    for (let i = 0; i < 90 * 12; i++) after.app.frame(16.7);
    expect(after.app.lightNow()).toBe('lean');
    expect(JSON.parse(after.store.data[PACE_KEY])).toEqual({ level: 1, runs: 0, tries: 2 });
    // And the count does not run away.
    const often = open({ [PACE_KEY]: JSON.stringify({ level: 0, runs: 8, tries: 99 }) });
    warm(often.app);
    slowFor(often.app, 3);
    expect(JSON.parse(often.store.data[PACE_KEY])).toEqual({ level: 0, runs: 0, tries: 99 });
  });

  test('a handheld found slow for the first time has nothing counted against it: its next session is a chance', () => {
    const { app, store } = open();
    warm(app);
    slowFor(app, 3);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    const next = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 3 });
    expect(next.lightNow()).toBe('full');
    // That one is closed before anything is seen: what is kept is as it was, and the one after is a chance again.
    for (let i = 0; i < 200; i++) next.frame(16.7);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    const third = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: false, seed: 3 });
    expect(third.lightNow()).toBe('full');
  });

  test('a player who takes the light in hand and gives it back ends the chance: what follows is judged afresh, with nothing counted', () => {
    const { app, store } = open({ [PACE_KEY]: JSON.stringify({ level: 1, runs: 2, tries: 1 }) });
    expect(app.lightNow()).toBe('full');
    select(app, 'options');
    for (let i = 0; i < 20 && (snap(app).menu.items as { id: string }[])[snap(app).menu.cursor as number].id !== 'detail'; i++) press(app, 'down');
    // Round the four choices and back to Auto.
    for (let i = 0; i < 4; i++) press(app, 'right');
    expect(note(app)).toBe('Auto');
    expect(store.data[PACE_KEY]).toBeUndefined();
    warm(app);
    slowFor(app, 3);
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
  });

  test('slow on one screen and then on another: nothing is concluded about the light, and it stays down', () => {
    const { app, store } = open();
    warm(app);
    slowFor(app, 6);
    expect(app.lightNow()).toBe('bare');
    // The player goes somewhere else: what is seen there is not held against what was seen on the title.
    select(app, 'options');
    slowFor(app, 30);
    expect(app.lightNow()).toBe('bare');
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 0, runs: 0 });
  });

  test('the options say what the light has come down to, also when it comes down while they are open', () => {
    const { app } = open();
    select(app, 'options');
    expect(note(app)).toBe('Auto');
    warm(app);
    slowFor(app, 3);
    app.update(16);
    expect(note(app)).toBe(STRINGS.options.detailAuto.lean);
    slowFor(app, 3);
    app.update(16);
    expect(note(app)).toBe(STRINGS.options.detailAuto.bare);
    // The cursor is where it was.
    const at = snap(app).menu.cursor;
    slowFor(app, 3);
    app.update(16);
    expect(snap(app).menu.cursor).toBe(at);
  });

  test('while the player has chosen, nothing is found out about the handheld and what is kept about it is not touched', () => {
    const hint = JSON.stringify({ level: 1, runs: 2 });
    const chosen = JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', detail: 'full' });
    const { app, store } = open({ [PACE_KEY]: hint, [SETTINGS_KEY]: chosen });
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    warm(app);
    slowFor(app, 12);
    expect(app.lightNow()).toBe('full');
    expect(store.data[PACE_KEY]).toBe(hint);
    // Its frames are still counted, for whoever looks.
    expect(app.fps).toBe(29);
  });

  test('the frames a second it is showing can be asked for', () => {
    const { app } = open();
    for (let i = 0; i < 100; i++) app.frame(16.7);
    expect(app.fps).toBe(60);
  });

  test('a hurried game is not judged: it has all of the light whatever its frames take', () => {
    const { app, store } = open({ [PACE_KEY]: JSON.stringify({ level: 0, runs: 0 }) }, true);
    expect(app.lightNow()).toBe('full');
    for (let i = 0; i < 2000; i++) app.frame(90);
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    // What was kept about the handheld is not touched by a session that was not judged.
    expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 0, runs: 0 });
  });

  test('the option: Auto, Full, Reduced, Off; a choice holds whatever the handheld does, and is kept only when it is a choice', () => {
    const { app, store } = open();
    select(app, 'options');
    const point = (): void => { for (let i = 0; i < 20 && (snap(app).menu.items as { id: string }[])[snap(app).menu.cursor as number].id !== 'detail'; i++) press(app, 'down'); };
    point();
    expect(note(app)).toBe('Auto');
    const seen: (string | undefined)[] = [];
    const kept: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      press(app, 'right');
      seen.push(note(app));
      kept.push(JSON.parse(store.data[SETTINGS_KEY]).detail);
    }
    expect(seen).toEqual(['Full', 'Reduced', 'Off', 'Auto']);
    expect(kept).toEqual(['full', 'lean', 'bare', undefined]);
    // And backwards.
    press(app, 'left');
    expect(note(app)).toBe('Off');
    expect(detail()).toBe(0);
    press(app, 'left');
    expect(detail()).toBe(1);
    press(app, 'left');
    expect(note(app)).toBe('Full');
    expect(detail()).toBe(2);
    // Full is full, however badly the handheld is doing.
    warm(app);
    slowFor(app, 9);
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    // Nothing was found out meanwhile. Handed back to the game, it starts from all of the light and judges afresh.
    expect(store.data[PACE_KEY]).toBeUndefined();
    store.data[PACE_KEY] = JSON.stringify({ level: 0, runs: 1 });
    press(app, 'left');
    expect(note(app)).toBe('Auto');
    expect(app.lightNow()).toBe('full');
    expect(store.data[PACE_KEY]).toBeUndefined();
    warm(app);
    slowFor(app, 3);
    expect(note(app)).toBe('Auto');
    press(app, 'up', 'down');
    expect(app.lightNow()).toBe('lean');
    // The row says what Auto has come to once the list is made again.
    press(app, 'cancel');
    select(app, 'options');
    expect(note(app)).toBe(STRINGS.options.detailAuto.lean);
  });

  test('what the game had come down to is kept while the player chooses, and forgotten when it is handed back', () => {
    const { app, store } = open();
    warm(app);
    slowFor(app, 3);
    expect(app.lightNow()).toBe('lean');
    select(app, 'options');
    for (let i = 0; i < 20 && (snap(app).menu.items as { id: string }[])[snap(app).menu.cursor as number].id !== 'detail'; i++) press(app, 'down');
    expect(note(app)).toBe(STRINGS.options.detailAuto.lean);
    // Full, Reduced, Off: the player's word, and what was found about the handheld is left where it is.
    for (const [choice, level] of [['Full', 2], ['Reduced', 1], ['Off', 0]] as [string, number][]) {
      press(app, 'right');
      expect(note(app)).toBe(choice);
      expect(detail()).toBe(level);
      expect(JSON.parse(store.data[PACE_KEY])).toEqual({ level: 1, runs: 0 });
    }
    // Back to Auto: all of the light again, not the less it had come down to, and nothing kept.
    press(app, 'right');
    expect(note(app)).toBe('Auto');
    expect(app.lightNow()).toBe('full');
    expect(detail()).toBe(2);
    expect(store.data[PACE_KEY]).toBeUndefined();
  });

  test('the line of help under the list says what Auto does, in the box', () => {
    const { app } = open();
    select(app, 'options');
    for (let i = 0; i < 20 && (snap(app).menu.items as { id: string }[])[snap(app).menu.cursor as number].id !== 'detail'; i++) press(app, 'down');
    const page = record((ctx) => app.draw(ctx));
    const help = page.texts.find((t) => t.text === STRINGS.options.detailHelp)!;
    expect(help).toBeDefined();
    expect(help.left).toBeGreaterThan(40);
    expect(help.right).toBeLessThan(270);
  });

  test('a saved game with a choice of light that is none of the three is no saved game; a settings file with one is read without it', () => {
    const game = done('intro-1');
    for (const choice of ['full', 'lean', 'bare']) expect(isValidState({ ...game, settings: { ...game.settings, detail: choice } }, CATALOG)).toBe(true);
    expect(isValidState({ ...game, settings: { ...game.settings, detail: 'auto' } }, CATALOG)).toBe(false);
    expect(isValidState({ ...game, settings: { ...game.settings, detail: 2 } }, CATALOG)).toBe(false);
    const read = (detailValue: unknown) => new SaveFile(memoryStore({ [SETTINGS_KEY]: JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', detail: detailValue }) }), CATALOG).loadSettings();
    expect(read('lean')).toMatchObject({ detail: 'lean' });
    expect(read('auto')).not.toHaveProperty('detail');
    expect(read(1)).not.toHaveProperty('detail');
    expect(read(undefined)).not.toHaveProperty('detail');
  });
});
