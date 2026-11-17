import { createBattle, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { BLINK_EVERY_MS, BLINK_MS, EYES, EYE_ALPHA, eyeLevel, eyeLight, eyeOf } from '../../src/ui/eyes';
import { MAX_LIGHTS, setDetail } from '../../src/ui/light';
import type { SpriteStore } from '../../src/ui/sprites';
import { record, type Drawn, type Glowed } from '../helpers/canvas';
import { readPng } from '../helpers/png';

/**
 * Machines that look back: every machine the pilot meets has a small light where it sees from,
 * steady while it is itself, narrowing now and then, sputtering while it is staggered or cooked.
 */

afterEach(() => setDetail(2));

const manifest = SPRITES as Record<string, { file: string; w: number; h: number }>;
const pictureOf = (enemy: string): string => ENEMIES[enemy].sprite ?? enemy;
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);

describe('where each machine\'s eye is', () => {
  test('every machine there is has one, and no eye is told about that no machine has', () => {
    const pictures = [...new Set(Object.keys(ENEMIES).map(pictureOf))];
    expect(pictures.length).toBeGreaterThanOrEqual(30);
    for (const picture of pictures) expect(eyeOf(picture), picture).not.toBeNull();
    expect(Object.keys(EYES).sort()).toEqual(pictures.sort());
    expect(eyeOf('no-such-machine')).toBeNull();
    expect(eyeOf('constructor')).toBeNull();
  });

  test('each is on its machine: inside the picture, on a pixel of it and not on the air round it, of a size and a colour', () => {
    for (const [picture, eye] of Object.entries(EYES)) {
      const { w, h, file } = manifest[picture];
      expect(eye.x, picture).toBeGreaterThanOrEqual(2);
      expect(eye.x, picture).toBeLessThan(w - 2);
      expect(eye.y, picture).toBeGreaterThanOrEqual(2);
      expect(eye.y, picture).toBeLessThan(h - 2);
      const pixels = readPng(`public/${file}`);
      expect([pixels.w, pixels.h], picture).toEqual([w, h]);
      expect(pixels.at(eye.x, eye.y)[3], picture).toBeGreaterThanOrEqual(200);
      expect(eye.r, picture).toBeGreaterThanOrEqual(5);
      expect(eye.r, picture).toBeLessThanOrEqual(14);
      expect(eye.color, picture).toMatch(/^#[0-9a-f]{6}$/);
      // In the upper two thirds of the machine: nothing looks out of its feet.
      expect(eye.y, picture).toBeLessThan(h * 0.67);
    }
  });

  test('where a machine has a lens or a lamp the eye sits on it: the picture is bright there, and of the eye\'s colour', () => {
    /** The pixel of the machine within two of a point that is nearest a colour: how far off it is, and how bright. */
    const nearest = (picture: string, x: number, y: number, color: string) => {
      const pixels = readPng(`public/${manifest[picture].file}`);
      const own = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
      let best = { off: Infinity, bright: 0 };
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= pixels.w || py >= pixels.h) continue;
          const [r, g, b, a] = pixels.at(px, py);
          if (a < 200) continue;
          const off = Math.abs(r - own[0]) + Math.abs(g - own[1]) + Math.abs(b - own[2]);
          if (off < best.off) best = { off, bright: Math.max(r, g, b) };
        }
      }
      return best;
    };
    // Four have a helmet with a dark visor and nothing lit in it; one has a lamp at the front of its cab and one
    // a beacon on its back that are not lit in their pictures. There the light is what opens the eye.
    const dark = ['enemy-bailiff', 'enemy-stalker', 'enemy-juggernaut', 'boss-adjuster', 'enemy-carrier', 'enemy-bomb-crawler'];
    for (const [picture, eye] of Object.entries(EYES)) {
      const found = nearest(picture, eye.x, eye.y, eye.color);
      if (dark.includes(picture)) {
        // Nothing there is lit, or it would not be in this list.
        expect(found.off > 90 || found.bright < 200, picture).toBe(true);
        continue;
      }
      // Something of the eye's own colour, and bright, is right there.
      expect(found.off, picture).toBeLessThanOrEqual(90);
      expect(found.bright, picture).toBeGreaterThanOrEqual(200);
    }
    // The ones without a lit lens are still on the head, the cab or the back: high up on the machine.
    for (const picture of dark) expect(EYES[picture].y, picture).toBeLessThan(manifest[picture].h * 0.45);
  });

  test('a great machine\'s eye throws its light further than a small one\'s', () => {
    const bosses = Object.keys(EYES).filter((picture) => picture.startsWith('boss-'));
    expect(bosses).toHaveLength(6);
    for (const boss of bosses) expect(EYES[boss].r, boss).toBeGreaterThanOrEqual(8);
    for (const [picture, eye] of Object.entries(EYES)) if (!picture.startsWith('boss-')) expect(eye.r, picture).toBeLessThanOrEqual(8);
  });
});

describe('how open an eye is', () => {
  test('awake it glows and swells a little, and every few seconds narrows for a moment', () => {
    expect([EYE_ALPHA, BLINK_EVERY_MS, BLINK_MS]).toEqual([0.5, 4600, 130]);
    for (let i = 0; i < 4; i++) {
      let blinks = 0;
      let narrow = 0;
      let was = false;
      for (let ms = 0; ms < 60_000; ms += 10) {
        const level = eyeLevel(ms, i, 'awake');
        const shut = level < 0.3;
        if (shut) {
          narrow++;
          expect(level).toBeGreaterThanOrEqual(0.13);
        } else {
          expect(level).toBeGreaterThanOrEqual(0.7);
          expect(level).toBeLessThanOrEqual(1);
        }
        if (shut && !was) blinks++;
        was = shut;
      }
      // Once in every stretch of 4.6 seconds, for 130 milliseconds each time.
      expect(blinks, `machine ${i}`).toBeGreaterThanOrEqual(12);
      expect(blinks, `machine ${i}`).toBeLessThanOrEqual(14);
      expect(narrow * 10, `machine ${i}`).toBeGreaterThanOrEqual(blinks * BLINK_MS - 20 * blinks);
      expect(narrow * 10, `machine ${i}`).toBeLessThanOrEqual(blinks * BLINK_MS + 20 * blinks);
    }
  });

  test('no two machines blink together, and the same machine does not blink at the same moment of every stretch', () => {
    const blinkAt = (i: number, from: number): number => { for (let ms = from; ms < from + BLINK_EVERY_MS * 2; ms += 5) if (eyeLevel(ms, i, 'awake') < 0.3) return ms; return -1; };
    const first = [0, 1, 2].map((i) => blinkAt(i, 0));
    expect(new Set(first).size).toBe(3);
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) expect(Math.abs(first[a] - first[b])).toBeGreaterThan(BLINK_MS);
    // Where in its stretch one machine blinks differs from one stretch to the next.
    const offsets = Array.from({ length: 8 }, (_, k) => blinkAt(0, k * BLINK_EVERY_MS) % BLINK_EVERY_MS);
    expect(new Set(offsets.map((offset) => Math.round(offset / 100))).size).toBeGreaterThanOrEqual(5);
  });

  test('dazed, it is low and sputters', () => {
    const levels = Array.from({ length: 200 }, (_, k) => eyeLevel(k * 16, 1, 'dazed'));
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(0.25);
      expect(level).toBeLessThanOrEqual(0.45);
    }
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.15);
    // Quickly: it goes up and down many times a second.
    const turns = levels.filter((level, k) => k > 1 && (level - levels[k - 1]) * (levels[k - 1] - levels[k - 2]) < 0).length;
    expect(turns).toBeGreaterThan(20);
    // Always lower than an eye that is awake and not narrowed.
    expect(Math.max(...levels)).toBeLessThan(0.7);
  });

  test('a calm picture has no blink and no sputter: the eye holds, low when the machine is dazed', () => {
    for (let ms = 0; ms < 60_000; ms += 10) {
      expect(eyeLevel(ms, 0, 'awake', true)).toBeGreaterThanOrEqual(0.7);
      expect(eyeLevel(ms, 0, 'dazed', true)).toBe(0.35);
    }
    // It still swells and fades, slowly.
    const levels = Array.from({ length: 100 }, (_, k) => eyeLevel(k * 100, 0, 'awake', true));
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.2);
  });

  test('the light of an eye: on the eye, wherever the machine\'s picture is, as bright as the eye is open', () => {
    const eye = EYES['enemy-tank'];
    const light = eyeLight('enemy-tank', 200, 120, 1234, 2, 'awake')!;
    expect(light).toMatchObject({ x: 200 + eye.x, y: 120 + eye.y, r: eye.r, color: eye.color });
    expect(light.alpha).toBeCloseTo(EYE_ALPHA * eyeLevel(1234, 2, 'awake'), 9);
    expect(eyeLight('enemy-tank', 200, 120, 1234, 2, 'dazed')!.alpha).toBeCloseTo(EYE_ALPHA * eyeLevel(1234, 2, 'dazed'), 9);
    expect(eyeLight('enemy-tank', 200, 120, 1234, 2, 'dazed', true)!.alpha).toBeCloseTo(EYE_ALPHA * 0.35, 9);
    expect(eyeLight('no-such-machine', 200, 120, 1234, 2, 'awake')).toBeNull();
  });
});

describe('the eyes of the machines on the field', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: manifest[id]?.w ?? fallback.w, h: manifest[id]?.h ?? fallback.h }) };
  function battle(enemies: string[], change: (state: BattleState) => void = () => undefined, opts: { fast?: boolean; calm?: boolean } = {}) {
    const state = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 7);
    change(state);
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: 'bg-nowhere', ...(opts.calm ? { calm: true } : {}) });
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    return { flow, screen, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
  }
  /** Where each machine's picture was drawn, by its name. */
  const drawnAt = (page: Drawn, picture: string) => page.images.find((image) => (image.image as { id: string }).id === picture)!;
  /** The light on a machine's eye: the one light of the eye's size that sits on the eye. */
  const eyeIn = (page: Drawn, picture: string): Glowed | undefined => {
    const at = drawnAt(page, picture);
    const eye = EYES[picture];
    return page.glows.find((g) => isLight(g) && g.r === eye.r && Math.abs(g.x - (at.x + eye.x)) < 0.01 && Math.abs(g.y - (at.y + eye.y)) < 0.01);
  };

  test('each machine that stands has one light, on its eye, in its eye\'s colour', () => {
    const { page } = battle(['tank', 'gun-turret', 'bomb-crawler']);
    const drawn = page();
    for (const picture of ['enemy-tank', 'enemy-gun-turret', 'enemy-bomb-crawler']) {
      const light = eyeIn(drawn, picture)!;
      expect(light, picture).toBeDefined();
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(EYES[picture].color.slice(at, at + 2), 16));
      expect(light.stops[0][1].startsWith(`rgba(${r}, ${g}, ${b},`), picture).toBe(true);
      expect(strength(light)).toBeGreaterThan(0.05);
      expect(strength(light)).toBeLessThanOrEqual(EYE_ALPHA);
    }
    // Three machines, three lights: nothing else on a quiet field is lit.
    expect(drawn.glows.filter(isLight)).toHaveLength(3);
    // The light is over the machine it is on.
    const tank = drawnAt(drawn, 'enemy-tank');
    const order = (kind: string, thing: unknown, list: unknown[]): number => drawn.order.findIndex((step) => step.kind === kind && list[step.at] === thing);
    expect(order('glow', eyeIn(drawn, 'enemy-tank'), drawn.glows)).toBeGreaterThan(order('image', tank, drawn.images));
  });

  test('the light moves as the machine moves: what flies bobs, and its eye bobs with it', () => {
    const { screen, page } = battle(['recon-drone']);
    const heights = new Set<number>();
    for (let i = 0; i < 80; i++) {
      screen.update(48);
      const drawn = page();
      const light = eyeIn(drawn, 'enemy-recon-drone');
      expect(light, `frame ${i}`).toBeDefined();
      heights.add(drawnAt(drawn, 'enemy-recon-drone').y);
    }
    expect(heights.size).toBeGreaterThanOrEqual(3);
  });

  test('a machine that flinches takes its eye with it', () => {
    const { flow, screen, page } = battle(['tank'], (state) => { for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 9999; });
    const home = drawnAt(page(), 'enemy-tank').x;
    let moved = 0;
    for (let i = 0; i < 600; i++) {
      if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
      screen.update(16);
      const drawn = page();
      // Every frame the light is on the eye of the picture as it is drawn in that frame.
      expect(eyeIn(drawn, 'enemy-tank'), `frame ${i}`).toBeDefined();
      if (drawnAt(drawn, 'enemy-tank').x !== home) moved++;
    }
    // And it was hit, and did flinch, in some of them.
    expect(moved).toBeGreaterThan(3);
  });

  test('two machines on the field do not narrow their eyes together', () => {
    const { screen, page } = battle(['tank', 'gun-turret']);
    const narrowed: Record<string, number[]> = { 'enemy-tank': [], 'enemy-gun-turret': [] };
    for (let i = 0; i < 700; i++) {
      screen.update(16);
      const drawn = page();
      for (const picture of Object.keys(narrowed)) if (strength(eyeIn(drawn, picture)!) < EYE_ALPHA * 0.3) narrowed[picture].push(i);
    }
    // Each did, twice or so in those eleven seconds, and never in the same frame as the other.
    for (const frames of Object.values(narrowed)) expect(frames.length).toBeGreaterThanOrEqual(8);
    expect(narrowed['enemy-tank'].filter((frame) => narrowed['enemy-gun-turret'].includes(frame))).toEqual([]);
  });

  test('a machine that is staggered or cooked has its eye low; one that is coming apart or gone has none', () => {
    const awake = battle(['tank', 'gun-turret'], () => undefined, { calm: true });
    const full = strength(eyeIn(awake.page(), 'enemy-tank')!);
    const dazed = battle(['tank', 'gun-turret'], (state) => { state.units[1].staggered = 2; state.units[2].overheated = true; }, { calm: true });
    // A calm picture's eyes hold: at half strength, the dazed ones at 0.35 of the brightest an eye is.
    for (const picture of ['enemy-tank', 'enemy-gun-turret']) {
      const low = strength(eyeIn(dazed.page(), picture)!);
      expect(low, picture).toBeCloseTo((EYE_ALPHA * 0.35) / 2, 2);
      expect(low).toBeLessThan(full);
    }
  });

  test('a machine shot to pieces loses its eye in the frame it starts to come apart, and not before', () => {
    const { flow, screen, page } = battle(['gun-turret', 'tank'], (state) => { for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 1; });
    expect(eyeIn(page(), 'enemy-gun-turret')).toBeDefined();
    let seen = false;
    let doomed = 0;
    for (let i = 0; i < 4000 && !seen; i++) {
      if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
      screen.update(16);
      if (screen.motion.breaking('enemy-0') !== null) seen = true;
      else if (flow.state.units[1].destroyed) {
        // The rules have it destroyed already, but the shot is still on its way and the machine stands whole: it still looks out.
        doomed++;
        expect(eyeIn(page(), 'enemy-gun-turret'), `frame ${i}`).toBeDefined();
      }
    }
    expect(seen).toBe(true);
    expect(doomed).toBeGreaterThan(0);
    const drawn = page();
    const turretEye = EYES['enemy-gun-turret'];
    expect(drawn.glows.filter((g) => isLight(g) && g.r === turretEye.r && g.stops[0][1].startsWith('rgba(235, 34, 190,'))).toEqual([]);
    // The one that still stands keeps its own.
    expect(eyeIn(drawn, 'enemy-tank')).toBeDefined();
  });

  test('a calm picture has the eyes at half strength; a hurried game has none; where no soft light is drawn there are none', () => {
    const calm = battle(['tank'], () => undefined, { calm: true });
    expect(strength(eyeIn(calm.page(), 'enemy-tank')!)).toBeCloseTo((EYE_ALPHA * eyeLevel(0, 0, 'awake', true)) / 2, 1);
    expect(strength(eyeIn(calm.page(), 'enemy-tank')!)).toBeLessThanOrEqual(EYE_ALPHA / 2);
    const fast = battle(['tank', 'gun-turret'], () => undefined, { fast: true });
    expect(fast.page().glows.filter(isLight)).toEqual([]);
    const bare = battle(['tank', 'gun-turret']);
    setDetail(0);
    expect(bare.page().glows).toEqual([]);
  });

  test('the eyes are among the battle\'s sixteen lights, and among its eight where there is to be less light', () => {
    for (const [detail, most] of [[2, MAX_LIGHTS], [1, MAX_LIGHTS / 2]] as [1 | 2, number][]) {
      const { flow, screen, page } = battle(['recon-drone', 'gunship', 'hunter-drone']);
      setDetail(detail);
      let peak = 0;
      let eyesSeen = 0;
      for (let i = 0; i < 1500 && flow.phase !== 'result'; i++) {
        if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
        screen.update(16);
        const drawn = page();
        peak = Math.max(peak, drawn.glows.filter(isLight).length);
        eyesSeen = Math.max(eyesSeen, ['enemy-recon-drone', 'enemy-gunship', 'enemy-hunter-drone'].filter((picture) => drawnAt(drawn, picture) && eyeIn(drawn, picture)).length);
      }
      // All three flyers burn underneath and look out: six lights that stand, and what is fired on top of them.
      expect(eyesSeen, `detail ${detail}`).toBe(3);
      expect(peak, `detail ${detail}`).toBeGreaterThan(6);
      expect(peak, `detail ${detail}`).toBeLessThanOrEqual(most);
      setDetail(2);
    }
  });

  test('in a duel the other frame is built from parts like the pilot\'s own, and has no eye that is known', () => {
    const { flow, page } = battle(['rival-2']);
    expect(flow.state.units[1].composed).toBe(true);
    expect(page().glows.filter(isLight)).toEqual([]);
  });
});
