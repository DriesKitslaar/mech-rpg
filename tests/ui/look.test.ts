import { createBattle, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BRIGHT, BattleScreen } from '../../src/ui/battleScreen';
import { FIELD_LIGHT, MAX_LIGHTS } from '../../src/ui/light';
import { JOINT_DARK, JOINT_LIT } from '../../src/ui/mechView';
import { MAX_PARTICLES, PARTICLE_LIGHTS, Particles } from '../../src/ui/particles';
import type { SpriteStore } from '../../src/ui/sprites';
import { NEAR_SIZE } from '../../src/ui/battleFx';
import { onStage, record, recorder, type Drawn, type Glowed, type Pictured } from '../helpers/canvas';
import { generatorIn } from '../helpers/eyes';

/** The look of the field in battle: what stands on it, what lights it, and when it is left alone. */

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const isShadow = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1].startsWith('rgba(0, 0, 8,');
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
/** How bright a light is at its middle. */
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);

function battle(seed = 7, wound = false): BattleState {
  // Two machines that stand on the ground: what flies burns underneath, and that is a light of its own.
  const state = createBattle(DEMO_BUILD, [ENEMIES.tank, ENEMIES['gun-turret']], CATALOG, seed);
  // A machine with one point of armour left goes up at the first thing that lands.
  if (wound) for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 1;
  return state;
}
function screenOf(opts: { fast?: boolean; calm?: boolean; state?: BattleState; sprites?: SpriteStore } = {}) {
  const flow = new BattleFlow(opts.state ?? battle(), CATALOG, { quiet: true });
  // On ground that has no lamps or signs of its own, so that every light seen is the battle's.
  const screen = new BattleScreen(flow, opts.sprites ?? sprites, CATALOG, { fast: opts.fast ?? false, background: 'bg-nowhere', ...(opts.calm ? { calm: true } : {}) });
  // Past the banner that opens the battle, to the pilot's own menu.
  for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
  expect(flow.phase).toBe('action');
  const fire = (): void => { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); };
  // The field as it stands on the stage: where the camera is, is another matter.
  const page = (): Drawn => onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
  return { flow, screen, fire, page };
}

describe('shadows', () => {
  test('every unit stands on one: the pilot and each machine, flat on the ground under them', () => {
    const { page } = screenOf({ fast: true });
    const shadows = page().glows.filter(isShadow);
    expect(shadows).toHaveLength(3);
    for (const shadow of shadows) {
      expect(shadow.ry).toBeLessThan(shadow.r / 3);
      expect(shadow.y).toBeGreaterThan(90);
      expect(shadow.y).toBeLessThanOrEqual(175);
    }
    // The pilot's is the widest and furthest left.
    const widest = shadows.reduce((a, b) => (b.r > a.r ? b : a));
    expect(widest.x).toBe(Math.min(...shadows.map((s) => s.x)));
  });

  test('a machine that is gone leaves none', () => {
    const { flow, screen, fire, page } = screenOf({ fast: true, state: battle(7, true) });
    for (let i = 0; i < 12 && !flow.state.units[1].destroyed && flow.phase === 'action'; i++) { fire(); screen.update(16); }
    expect(flow.state.units[1].destroyed).toBe(true);
    screen.update(16);
    expect(page().glows.filter(isShadow)).toHaveLength(2);
  });
});

describe('light on the field', () => {
  test('a hurried screen adds none, whatever is fired', () => {
    const { screen, fire, page } = screenOf({ fast: true });
    fire();
    screen.update(16);
    expect(page().glows.filter(isLight)).toEqual([]);
  });

  test('a gun going off lights the field around its barrel, and the light is gone when the volley is over', () => {
    const { screen, fire, page } = screenOf();
    // Before anything is fired the only lights on the field are the eyes of the two machines that stand there,
    // and on the back of the pilot's own mech, which has no eye to be seen, its generator.
    const quiet = page();
    const generator = generatorIn(quiet)!;
    expect(generator).toBeDefined();
    expect(generator.x).toBeLessThan(155);
    const eyes = quiet.glows.filter((g) => isLight(g) && g !== generator);
    expect(eyes).toHaveLength(2);
    for (const eye of eyes) {
      expect(eye.r).toBeLessThanOrEqual(8);
      expect(eye.x).toBeGreaterThan(155);
    }
    fire();
    screen.update(32);
    const lights = page().glows.filter(isLight);
    expect(lights.length).toBeGreaterThan(3);
    expect(lights.length).toBeLessThanOrEqual(MAX_LIGHTS);
    // The barrel's own: at the end of the pilot's gun, short of the machines it is aimed at, in the gun's colour,
    // and larger than life: the gun is as near the camera as anything is.
    const barrel = lights.find((g) => g.r === 46 * NEAR_SIZE)!;
    expect(barrel.x).toBeGreaterThan(120);
    expect(barrel.x).toBeLessThan(200);
    expect(barrel.stops[0][1]).toMatch(/^rgba\(255, 233, 168, /);
    for (let i = 0; i < 200; i++) screen.update(16);
    // With the volley over, the eyes are all there is again, where they were.
    const after = page();
    expect(after.glows.filter((g) => isLight(g) && g !== generatorIn(after)).map((g) => [g.x, g.y, g.r])).toEqual(eyes.map((g) => [g.x, g.y, g.r]));
  });

  test('the one that fires is lit by its own gun for a moment; a calm picture leaves that out', () => {
    /** The pictures that are laid over themselves as light at the moment the gun goes off: which, and how strongly. */
    const lit = (calm: boolean): { id: string; alpha: number }[] => {
      const { screen, fire, page } = screenOf({ calm });
      fire();
      screen.update(32);
      const drawn = page();
      // No picture is ever handed to the canvas with a filter on it.
      expect(new Set(drawn.images.map((i) => i.filter))).toEqual(new Set(['none']));
      return drawn.images.filter((i) => i.blend === 'lighter').map((i) => ({ id: (i.image as { id?: string }).id ?? '', alpha: i.alpha }));
    };
    const glare = lit(false);
    // Every layer of the pilot's mech and what it carries, once more, at a little over a third: it is that much brighter.
    expect(glare.length).toBeGreaterThanOrEqual(5);
    for (const layer of glare) expect(layer.alpha).toBeCloseTo(BRIGHT.glare - 1, 6);
    expect(lit(true)).toEqual([]);
  });

  test('a machine that is hit lights up by its own picture laid over it as light: 2.6 times as bright, 1.4 in a calm picture, exactly where it stands', () => {
    /** Every drawing of the first machine in the frames after a shot at it, frame by frame: how it was laid on and how strongly. */
    const hit = (calm: boolean): { blend: string; alpha: number; x: number; y: number }[][] => {
      const { screen, fire, page } = screenOf({ calm });
      fire();
      const frames: { blend: string; alpha: number; x: number; y: number }[][] = [];
      for (let i = 0; i < 40; i++) {
        screen.update(16);
        const drawn = page();
        expect(drawn.images.every((image) => image.filter === 'none')).toBe(true);
        frames.push(drawn.images.filter((image) => (image.image as { id?: string }).id === 'enemy-tank').map((image) => ({ blend: image.blend, alpha: image.alpha, x: image.x, y: image.y })));
      }
      return frames;
    };
    for (const [calm, bright] of [[false, BRIGHT.hit], [true, BRIGHT.calm]] as [boolean, number][]) {
      const frames = hit(calm);
      const lit = frames.filter((frame) => frame.some((image) => image.blend === 'lighter'));
      // It lights up for a few frames as the shot lands, and is itself again after.
      expect(lit.length, `calm ${calm}`).toBeGreaterThanOrEqual(3);
      expect(frames.at(-1), `calm ${calm}`).toHaveLength(1);
      for (const frame of lit) {
        const [own, ...light] = frame;
        expect(own).toMatchObject({ blend: 'source-over', alpha: 1 });
        // All of it adds up to how many times as bright it is to be, and every layer of light lies exactly on the picture.
        expect(1 + light.reduce((sum, image) => sum + image.alpha, 0)).toBeCloseTo(bright, 6);
        for (const image of light) expect([image.blend, image.x, image.y]).toEqual(['lighter', own.x, own.y]);
        expect(light.every((image) => image.alpha <= 1)).toBe(true);
      }
    }
    expect([BRIGHT.hit, BRIGHT.calm, BRIGHT.glare]).toEqual([2.6, 1.4, 1.35]);
  });

  describe('a mech that is drawn from its parts lights up as the one picture it is seen as', () => {
    const idOf = (image: Pictured): string => (image.image as { id?: string }).id ?? '';
    /** A store that lends sheets: every loan is a canvas that remembers what is drawn on it. */
    function lending(): { store: SpriteStore; loans: ReturnType<typeof recorder>[] } {
      const loans: ReturnType<typeof recorder>[] = [];
      const image = { id: 'sheet' } as unknown as CanvasImageSource;
      return { loans, store: { ...sprites, sheet: () => { const sheet = recorder(); loans.push(sheet); return { image, ctx: sheet.ctx }; } } };
    }
    /** The pilot ends the turn whenever it is theirs: whatever lights up after that was hit by something else. */
    const wait = (flow: BattleFlow, screen: BattleScreen): void => {
      if (flow.phase !== 'action') return;
      const at = flow.menu.items.findIndex((item) => item.id === 'endTurn');
      for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
      screen.onInput('confirm');
    };
    /** From its left edge to its right and from its top to its bottom, whichever way round it was drawn. */
    const span = (p: { x: number; y: number; w: number; h: number }) => ({ left: Math.min(p.x, p.x + p.w), right: Math.max(p.x, p.x + p.w), top: p.y, bottom: p.y + p.h });
    /**
     * Checks one frame in which a mech is lit: the sheet lies exactly over the mech as it was drawn layer by layer in that
     * frame, each time it is laid on; and each loan holds that mech, layer for layer where it stands. `own` picks the
     * mech's own layers out of the frame, `joints` says whether it has joints to be seen.
     */
    function whole(drawn: Drawn, loans: ReturnType<typeof recorder>[], own: (image: Pictured) => boolean, joints: boolean): number[] {
      const layers = drawn.images.filter((image) => image.blend === 'source-over' && image.alpha === 1 && own(image));
      const bars = joints ? drawn.rects.filter((r) => r.color === JOINT_DARK || r.color === JOINT_LIT) : [];
      expect(layers.length).toBeGreaterThanOrEqual(5);
      expect(bars).toHaveLength(joints ? 6 : 0);
      const spans = [...layers, ...bars].map(span);
      const box = { left: Math.min(...spans.map((s) => s.left)), right: Math.max(...spans.map((s) => s.right)), top: Math.min(...spans.map((s) => s.top)), bottom: Math.max(...spans.map((s) => s.bottom)) };
      const light = drawn.images.filter((image) => image.blend === 'lighter');
      // Nothing is laid on as light but the sheet: no layer by itself.
      expect(light.map(idOf)).toEqual(light.map(() => 'sheet'));
      expect(loans).toHaveLength(light.length);
      for (const [n, laid] of light.entries()) {
        expect(span(laid)).toEqual(box);
        expect(laid.from).toEqual({ x: 0, y: 0, w: box.right - box.left, h: box.bottom - box.top });
        // On the sheet the mech is as it stands, not turned round: the canvas turns the sheet round with everything else.
        const turned = laid.w < 0 ? -1 : 1;
        const on = loans[n].drawn;
        expect(on.images.map((image) => [idOf(image), image.x, image.y, image.w, image.h]))
          .toEqual(layers.map((image) => [idOf(image), (image.x - laid.x) * turned || 0, image.y - laid.y, Math.abs(image.w), image.h]));
        expect(on.rects.map((r) => [r.color, r.x, r.y, r.w, r.h]))
          .toEqual(bars.map((r) => [r.color, (r.x - laid.x) * turned || 0, r.y - laid.y, Math.abs(r.w), r.h]));
        expect(on.images.every((image) => image.blend === 'source-over' && image.alpha === 1)).toBe(true);
      }
      return light.map((image) => image.alpha);
    }

    test('the pilot\'s mech by its own gun: once, at a little over a third', () => {
      const { store, loans } = lending();
      const { screen, fire } = screenOf({ sprites: store });
      fire();
      screen.update(32);
      const drawn = onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
      const alphas = whole(drawn, loans, (image) => idOf(image).endsWith('.back'), true);
      expect(alphas).toHaveLength(1);
      expect(alphas[0]).toBeCloseTo(BRIGHT.glare - 1, 6);
    });

    test('the pilot\'s mech when it is hit: 2.6 times as bright in two layers of light, 1.4 in one in a calm picture, shaken as it is', () => {
      for (const [calm, want] of [[false, [1, BRIGHT.hit - 2]], [true, [BRIGHT.calm - 1]]] as [boolean, number[]][]) {
        const { store, loans } = lending();
        const { flow, screen } = screenOf({ sprites: store, calm });
        let lit = 0;
        const shaken = new Set<number>();
        for (let i = 0; i < 4000 && lit < 6 && flow.phase !== 'result'; i++) {
          wait(flow, screen);
          screen.update(16);
          loans.length = 0;
          const drawn = onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
          if (!drawn.images.some((image) => image.blend === 'lighter' && idOf(image) === 'sheet')) continue;
          lit++;
          const alphas = whole(drawn, loans, (image) => idOf(image).endsWith('.back'), true);
          expect(alphas).toHaveLength(want.length);
          alphas.forEach((alpha, n) => expect(alpha, `calm ${calm}`).toBeCloseTo(want[n], 6));
          shaken.add((screen as unknown as { fx: { transform(id: string): { dx: number } } }).fx.transform('player').dx);
        }
        expect(lit, `calm ${calm}`).toBe(6);
        // It was thrown both ways while it was lit, and the light went with it each time.
        expect([...shaken].sort((a, b) => a - b), `calm ${calm}`).toEqual([-2, 2]);
      }
    });

    test('the pilot\'s mech as it goes down: lit while it sinks and comes apart, the light sinking and coming apart with it', () => {
      const { store, loans } = lending();
      const state = battle();
      // One point of armour left everywhere: the first thing that lands ends it.
      for (const part of Object.values(state.units[0].parts)) if (part) part.ap = 1;
      const { flow, screen } = screenOf({ sprites: store, state });
      const fx = (screen as unknown as { fx: { transform(id: string): { dy: number; flash: boolean } } }).fx;
      let sinking = 0;
      for (let i = 0; i < 4000 && flow.phase !== 'result'; i++) {
        wait(flow, screen);
        screen.update(16);
        const t = fx.transform('player');
        // Lit, and already on its way down.
        if (!t.flash || t.dy === 0) continue;
        sinking++;
        loans.length = 0;
        const drawn = onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
        expect(screen.motion.breaking('player')).not.toBeNull();
        const alphas = whole(drawn, loans, (image) => idOf(image).endsWith('.back'), true);
        expect(alphas).toHaveLength(2);
      }
      expect(flow.state.units[0].destroyed).toBe(true);
      expect(sinking).toBeGreaterThanOrEqual(2);
    });

    test('a mech that is fought alone, drawn turned round: the sheet is turned round with it', () => {
      const { store, loans } = lending();
      const state = createBattle(DEMO_BUILD, [ENEMIES.rival], CATALOG, 7);
      const { flow, screen, fire } = screenOf({ sprites: store, state });
      let lit = 0;
      for (let i = 0; i < 4000 && lit < 3 && flow.phase !== 'result'; i++) {
        if (flow.phase === 'action') fire();
        screen.update(16);
        loans.length = 0;
        const drawn = onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
        // The pilot's own mech lights up by its gun as well: these are the frames in which the other one is hit.
        const theirs = drawn.images.filter((image) => image.blend === 'lighter' && image.w < 0);
        if (theirs.length === 0) continue;
        lit++;
        const mine = drawn.images.filter((image) => image.blend === 'lighter' && image.w > 0);
        const alphas = whole(
          { ...drawn, images: drawn.images.filter((image) => !mine.includes(image)) },
          loans.filter((loan) => loan.drawn.images.some((image) => idOf(image).endsWith('.small'))),
          (image) => idOf(image).endsWith('.small'), false,
        );
        expect(alphas).toHaveLength(2);
        expect(alphas[0] + alphas[1]).toBeCloseTo(BRIGHT.hit - 1, 6);
      }
      expect(lit).toBe(3);
    });

    test('a machine that is one picture needs no sheet: its picture is laid over it as it is', () => {
      const { store, loans } = lending();
      const { screen, fire } = screenOf({ sprites: store });
      fire();
      let lit = 0;
      for (let i = 0; i < 40; i++) {
        screen.update(16);
        const drawn = record((ctx) => screen.draw(ctx));
        lit += drawn.images.filter((image) => image.blend === 'lighter' && idOf(image) === 'enemy-tank').length;
      }
      expect(lit).toBeGreaterThanOrEqual(6);
      // Whatever went on a sheet in that time was the pilot's own mech, lit by its gun.
      expect(loans.length).toBeGreaterThan(0);
      for (const loan of loans) expect(loan.drawn.images.every((image) => idOf(image).endsWith('.back'))).toBe(true);
    });
  });

  test('a calm picture has the same lights at half strength, and none that covers the field', () => {
    const at = (calm: boolean): Glowed[] => {
      const { screen, fire, page } = screenOf({ calm });
      fire();
      screen.update(32);
      return page().glows.filter(isLight);
    };
    const plain = at(false);
    const calm = at(true);
    const barrel = (lights: Glowed[]) => lights.find((g) => g.r === 46 * NEAR_SIZE)!;
    expect(strength(barrel(calm))).toBeCloseTo(strength(barrel(plain)) / 2, 2);
    for (const light of calm) expect(light.r).toBeLessThanOrEqual(FIELD_LIGHT);
  });

  test('a machine that went up keeps smoking and smouldering where it stood, for as long as the battle lasts', () => {
    const { flow, screen, fire, page } = screenOf({ state: battle(7, true) });
    for (let i = 0; i < 12 && !flow.state.units[1].destroyed; i++) {
      if (flow.phase === 'action') fire();
      for (let j = 0; j < 120; j++) screen.update(16);
    }
    expect(flow.state.units[1].destroyed).toBe(true);
    expect(flow.state.outcome).toBe('ongoing');
    for (let i = 0; i < 400; i++) screen.update(16);
    const later = page();
    const ember = later.glows.filter(isLight).filter((g) => g.stops[0][1].startsWith('rgba(255, 122, 48,'));
    expect(ember).toHaveLength(1);
    expect(ember[0].r).toBe(26);
    expect(later.rects.some((r) => r.color === '#3a3644' || r.color === '#4a4654')).toBe(true);
    // A hurried screen draws neither.
    const hurried = screenOf({ fast: true, state: battle(7, true) });
    for (let i = 0; i < 12 && !hurried.flow.state.units[1].destroyed && hurried.flow.phase === 'action'; i++) { hurried.fire(); hurried.screen.update(16); }
    hurried.screen.update(16);
    const still = hurried.page();
    expect(still.glows.filter(isLight)).toEqual([]);
    expect(still.rects.some((r) => r.color === '#3a3644' || r.color === '#4a4654')).toBe(false);
  });
});

describe('what is in the air', () => {
  const at = { x: 100, y: 100 };

  test('there may be more of it than before, and still no more than there is room for', () => {
    expect(MAX_PARTICLES).toBe(320);
    const p = new Particles(3);
    for (let i = 0; i < 80; i++) p.emit('debris', at, 1);
    p.update(16);
    expect(p.count).toBe(MAX_PARTICLES);
  });

  test('flames rise, shrink and burn out through fire\'s colours', () => {
    const p = new Particles(5);
    p.emit('fire', at, 1);
    p.update(16);
    expect(p.count).toBe(7);
    const young = p.all().map((f) => ({ y: f.y, size: f.size }));
    const colour = (): string[] => [...new Set(record((ctx) => p.draw(ctx)).rects.map((r) => r.color))];
    const first = colour();
    p.update(200);
    expect(p.all().every((f, i) => f.y < young[i].y)).toBe(true);
    expect(p.all().every((f, i) => f.size < young[i].size)).toBe(true);
    expect(colour()).not.toEqual(first);
    p.update(700);
    expect(p.count).toBe(0);
  });

  test('smoke is round once there is enough of it; a spark is one pixel', () => {
    const smoke = new Particles(5);
    smoke.emit('smoke', at, 1);
    smoke.update(600);
    const puffs = record((ctx) => smoke.draw(ctx)).rects;
    expect(puffs.length).toBeGreaterThan(smoke.count * 3);
    // Rows of different widths: a disc, not a square.
    expect(new Set(puffs.map((r) => r.w)).size).toBeGreaterThan(2);
    const sparks = new Particles(5);
    sparks.emit('sparks', at, 1);
    sparks.update(30);
    expect(record((ctx) => sparks.draw(ctx)).rects).toHaveLength(sparks.count);
  });

  test('what glows throws a little light: sparks, embers and flames, a few lights for all of them, and smoke none', () => {
    expect(PARTICLE_LIGHTS).toBe(8);
    const p = new Particles(5);
    expect(p.lights()).toEqual([]);
    p.emit('smoke', at, 1);
    p.emit('debris', at, 1);
    p.update(16);
    expect(p.lights()).toEqual([]);
    for (let i = 0; i < 6; i++) { p.emit('sparks', at, 1); p.emit('embers', at, 1); p.emit('fire', at, 1); }
    p.update(16);
    const lights = p.lights();
    expect(lights.length).toBeGreaterThan(4);
    expect(lights.length).toBeLessThanOrEqual(8);
    for (const light of lights) {
      expect(light.alpha).toBeGreaterThan(0);
      expect(light.alpha).toBeLessThanOrEqual(0.5);
      expect(light.r).toBeLessThan(16);
    }
    // They die with what throws them.
    p.update(2000);
    expect(p.lights()).toEqual([]);
  });
});

describe('a unit that lunges', () => {
  test('leaves two after-images behind it, the further the fainter, and none when the screen is hurried', () => {
    const boost = (fast: boolean) => {
      const made = screenOf({ fast });
      // Boost is the second row of the pilot's menu.
      made.screen.onInput('down');
      made.screen.onInput('confirm');
      for (let i = 0; i < 6; i++) made.screen.update(16);
      return made;
    };
    const watched = boost(false);
    expect(watched.flow.state.units[0].boosted).toBe(true);
    const faint = watched.page().images.filter((image) => image.alpha < 1 && image.alpha > 0.05);
    expect([...new Set(faint.map((image) => image.alpha))].sort()).toEqual([0.14, 0.3]);
    // The same mech three times over: twice faint, once whole.
    const id = (image: { image: unknown }): string => (image.image as { id: string }).id;
    const whole = watched.page().images.filter((image) => image.alpha === 1 && faint.some((f) => id(f) === id(image)));
    expect(whole.length).toBeGreaterThan(0);
    // Each after-image stands behind the mech: to its left, since the pilot faces right.
    const layer = id(faint[0]);
    const xs = (alpha: number) => watched.page().images.filter((image) => id(image) === layer && image.alpha === alpha).map((image) => image.x);
    expect(xs(0.3)[0]).toBeLessThan(xs(1)[0]);
    expect(xs(0.14)[0]).toBeLessThan(xs(0.3)[0]);
    const hurried = boost(true);
    expect(hurried.page().images.filter((image) => image.alpha < 1 && image.alpha > 0.05)).toEqual([]);
  });
});
