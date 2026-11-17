import { HEAT_LIMIT, createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { AMBIENCE } from '../../src/ui/ambience';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { ENEMY_LEFT, HERO, HERO_FEET, PLAIN, horizonOf } from '../../src/ui/stage';
import { FIELD_LIGHT, MAX_LIGHTS } from '../../src/ui/light';
import type { SpriteStore } from '../../src/ui/sprites';
import { EMBER_LIGHTS, LIGHTNING_MS } from '../../src/ui/weather';
import { onStage, record, type Drawn, type Glowed } from '../helpers/canvas';
import { eyesIn, generatorIn } from '../helpers/eyes';

/**
 * The look of the field, where it meets a whole battle: what is left of machines that went up, what
 * a calm picture is spared at every place it is promised, and how many lights a busy frame holds.
 */

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const isShadow = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1].startsWith('rgba(0, 0, 8,');
const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
const colored = (g: Glowed, rgb: string): boolean => g.stops[0][1].startsWith(`rgba(${rgb},`);
const HEAT = '255, 90, 32';
const BURN = '255, 122, 184';
const EMBER = '255, 122, 48';
const SMOKE = ['#3a3644', '#4a4654'];

function fight(enemies: string[], frail: number[] = [], opts: BattleOptions = {}, seed = 7): BattleState {
  const state = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, seed, opts);
  for (const i of frail) for (const part of Object.values(state.units[i + 1].parts)) if (part) part.ap = 1;
  return state;
}
function screenOf(state: BattleState, opts: { fast?: boolean; calm?: boolean; background?: string } = {}) {
  const flow = new BattleFlow(state, CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast: opts.fast ?? false, background: opts.background ?? 'bg-nowhere', ...(opts.calm ? { calm: true } : {}) });
  for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
  expect(flow.phase).toBe('action');
  // The field as it stands on the stage, whatever the camera is doing: a light is counted by where and how large it is there.
  const page = (): Drawn => onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
  /** The phase as it is now: asked for afresh, since a press or a moment changes it. */
  const phase = (): string => flow.phase;
  /** Walks the cursor to an entry of the pilot's menu and takes it. */
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Fires this weapon at this unit; false when it cannot be fired. */
  const fireAt = (weapon: string, target: string): boolean => {
    if (flow.phase !== 'action' || !flow.menu.items.find((item) => item.id === 'fire')?.enabled) return false;
    choose('fire');
    if (!flow.menu.items.find((item) => item.id === weapon)?.enabled) { screen.onInput('cancel'); return false; }
    choose(weapon);
    for (let n = 0; n < 8 && flow.targetId !== target; n++) screen.onInput('right');
    if (flow.targetId !== target) { screen.onInput('cancel'); screen.onInput('cancel'); return false; }
    screen.onInput('confirm');
    return true;
  };
  /** Lets the battle run until the pilot can act again or it is over. */
  const settle = (): void => { for (let i = 0; i < 4000 && flow.phase !== 'action' && flow.phase !== 'result'; i++) screen.update(16); };
  return { flow, screen, page, choose, fireAt, settle, phase };
}

describe('what is left of a machine', () => {
  test('lies where it went up, under its middle and on the ground, and smokes upwards from there', () => {
    const { flow, screen, page, fireAt } = screenOf(fight(['gun-turret', 'tank'], [0]));
    expect(screen.motion.wrecks).toEqual([]);
    for (let i = 0; i < 4000 && screen.motion.wrecks.length === 0; i++) { fireAt('rightHand', 'enemy-0'); screen.update(16); }
    expect(flow.state.units[1].destroyed).toBe(true);
    expect(screen.motion.wrecks).toHaveLength(1);
    const wreck = screen.motion.wrecks[0];
    // In the right half of the field, where the machines stand, and not under the ground.
    expect(wreck.x).toBeGreaterThan(155);
    expect(wreck.y).toBeGreaterThan(90);
    expect(wreck.y).toBeLessThanOrEqual(178 - 14);
    // A while later it smokes: every puff is over it, none under.
    for (let i = 0; i < 150; i++) screen.update(16);
    const smoke = page().rects.filter((r) => SMOKE.includes(r.color));
    expect(smoke.length).toBeGreaterThan(10);
    for (const row of smoke) {
      expect(row.y).toBeLessThanOrEqual(wreck.y + 16);
      expect(Math.abs(row.x + row.w / 2 - wreck.x)).toBeLessThan(24);
    }
    expect(Math.min(...smoke.map((r) => r.y))).toBeLessThan(wreck.y - 20);
  });

  test('burns bright at first and dies down to a smoulder', () => {
    const { flow, screen, page, fireAt } = screenOf(fight(['gun-turret', 'tank'], [0]));
    for (let i = 0; i < 4000 && screen.motion.wrecks.length === 0; i++) { fireAt('rightHand', 'enemy-0'); screen.update(16); }
    expect(flow.state.units[1].destroyed).toBe(true);
    const ember = (): number[] => page().glows.filter((g) => isLight(g) && colored(g, EMBER)).map(strength);
    // As the machine goes up, and for the half second after.
    let early = 0;
    for (let i = 0; i < 30; i++) { screen.update(16); early = Math.max(early, ...ember()); }
    expect(early).toBeGreaterThan(0.45);
    expect(early).toBeLessThanOrEqual(0.65);
    // Ten seconds on it only smoulders, and it never goes out.
    for (let i = 0; i < 625; i++) screen.update(16);
    const late = ember();
    expect(late).toHaveLength(1);
    expect(late[0]).toBeLessThan(early * 0.5);
    expect(late[0]).toBeGreaterThan(0.08);
    expect(late[0]).toBeLessThanOrEqual(0.15);
  });

  test('a place holds one: where a carrier keeps sending drones into the same place, their wrecks do not pile up', () => {
    const state = fight(['recon-drone', 'carrier']);
    // The pilot is not what this is about: it cannot be brought down, and the carrier cannot either.
    for (const unit of [state.units[0], state.units[2]]) for (const part of Object.values(unit.parts)) if (part) { part.ap = 99999; part.maxAp = 99999; }
    const { flow, screen, page, fireAt, choose, phase } = screenOf(state);
    const drones = () => flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed && u.sprite === 'enemy-recon-drone');
    let downed = 0;
    let most = 0;
    for (let i = 0; i < 60000 && downed < 7 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') {
        // Every drone goes down to whatever lands on it.
        for (const drone of drones()) for (const part of Object.values(drone.parts)) if (part) part.ap = 1;
        const before = drones().length;
        const target = drones()[0];
        if (!target || !(fireAt('rightHand', target.id) || fireAt('leftHand', target.id) || fireAt('shoulder', target.id))) choose('endTurn');
        for (let t = 0; t < 400 && phase() === 'animating'; t++) screen.update(16);
        if (drones().length < before) downed++;
      } else screen.update(16);
      most = Math.max(most, screen.motion.wrecks.length);
      // No two of them in one place, at any moment.
      const wrecks = screen.motion.wrecks;
      wrecks.forEach((a, n) => wrecks.slice(n + 1).forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20)));
    }
    expect(downed).toBe(7);
    // Seven drones went down; they stood in one or two places, and that is how many wrecks there ever were.
    expect(most).toBeLessThanOrEqual(2);
    expect(most).toBeGreaterThanOrEqual(1);
    // And a drone that stands where one fell does not stand in its smoke: its wreck went when it came.
    for (let i = 0; i < 3000 && drones().length === 0 && flow.phase !== 'result'; i++) { if (flow.phase === 'action') choose('endTurn'); screen.update(16); }
    expect(drones().length).toBeGreaterThan(0);
    const standing = page().glows.filter((g) => isLight(g) && colored(g, BURN));
    expect(standing.length).toBe(drones().length);
    for (const burn of standing) {
      for (const wreck of screen.motion.wrecks) expect(Math.hypot(wreck.x - burn.x, wreck.y - burn.y)).toBeGreaterThan(20);
    }
  });
});

describe('where the pilot stands', () => {
  test('the pilot\'s shadow lies under the mech\'s feet, on the floor at the foot of the field, and every other shadow on the floor further off', () => {
    const { page } = screenOf(fight(['gun-turret']), { fast: true });
    const shadows = page().glows.filter(isShadow);
    const own = shadows.reduce((a, b) => (b.r > a.r ? b : a));
    // Under the middle of the mech as it is seen from behind, a few pixels over the line its feet stand on.
    expect(own).toMatchObject({ x: HERO.x + 58, y: HERO_FEET - 4, r: 52 });
    expect(own.ry).toBeCloseTo(6.5, 5);
    expect(shadows).toHaveLength(2);
    // Every shadow is on the floor: under where the floor begins, and the enemy's further off than the pilot's own.
    for (const shadow of shadows) expect(shadow.y).toBeGreaterThan(horizonOf(PLAIN));
    const other = shadows.find((shadow) => shadow !== own)!;
    expect(other.y).toBeLessThan(own.y - 10);
    expect(other.x).toBeGreaterThan(ENEMY_LEFT);
  });
});

describe('a calm picture, at every place it was promised', () => {
  /** The same moment of the same battle, with the picture as it comes and calm. */
  const both = (make: () => BattleState, opts: { background?: string } = {}, ready: (s: ReturnType<typeof screenOf>) => void = () => undefined) => {
    const plain = screenOf(make(), opts);
    const calm = screenOf(make(), { ...opts, calm: true });
    ready(plain);
    ready(calm);
    return { plain, calm };
  };

  test('a machine close to its heat limit glows half as strongly', () => {
    const hot = (): BattleState => { const s = fight(['gun-turret']); s.units[0].heat = HEAT_LIMIT * 0.95; return s; };
    const { plain, calm } = both(hot);
    const glow = (s: ReturnType<typeof screenOf>) => s.page().glows.filter((g) => isLight(g) && colored(g, HEAT));
    expect(glow(plain)).toHaveLength(1);
    expect(glow(calm)).toHaveLength(1);
    expect(strength(glow(calm)[0])).toBeCloseTo(strength(glow(plain)[0]) / 2, 2);
    // A machine that is not hot does not glow at all.
    expect(glow(screenOf(fight(['gun-turret'])))).toEqual([]);
  });

  test('what flies burns half as brightly underneath', () => {
    const { plain, calm } = both(() => fight(['recon-drone', 'gun-turret']));
    const burn = (s: ReturnType<typeof screenOf>) => s.page().glows.filter((g) => isLight(g) && colored(g, BURN));
    expect(burn(plain)).toHaveLength(1);
    expect(burn(calm)).toHaveLength(1);
    expect(strength(burn(calm)[0])).toBeCloseTo(strength(burn(plain)[0]) / 2, 2);
    expect([burn(calm)[0].x, burn(calm)[0].y, burn(calm)[0].r]).toEqual([burn(plain)[0].x, burn(plain)[0].y, burn(plain)[0].r]);
  });

  test('no lightning over a battle in the rain, where the picture as it comes has it', () => {
    const { plain, calm } = both(() => fight(['gun-turret']), { background: 'bg-neon-district' });
    const strokes = (s: ReturnType<typeof screenOf>): number => {
      let n = 0;
      for (let t = 0; t < LIGHTNING_MS * 2; t += 48) { s.screen.update(48); if (s.page().rects.some((r) => r.blend === 'overlay')) n++; }
      return n;
    };
    expect(strokes(plain)).toBeGreaterThan(0);
    expect(strokes(calm)).toBe(0);
  });

  test('a beam\'s halo is at half strength and holds steady, where it flickers otherwise', () => {
    const { plain, calm } = both(() => fight(['gun-turret']));
    /**
     * How strong the widest band of a beam is, step by step, from the first moment it is seen to the last. A beam that
     * is fired across the floor narrows as it goes: its bands are four-cornered shapes, wider where they leave than where they land.
     */
    const halo = (s: ReturnType<typeof screenOf>): number[] => {
      expect(s.fireAt('leftHand', 'enemy-0')).toBe(true);
      const seen: number[] = [];
      // In steps much shorter than a frame, so that every flicker is seen.
      for (let i = 0; i < 200; i++) {
        s.screen.update(3);
        const across = (k: { points: { x: number; y: number }[] }): number => Math.hypot(k.points[0].x - k.points[3].x, k.points[0].y - k.points[3].y);
        const bands = s.page().shapes.filter((k) => k.blend === 'lighter' && k.points.length === 4);
        const widest = [...bands].sort((a, b) => across(b) - across(a))[0];
        // It narrows as it goes: wider at the barrel than at what it burns.
        if (widest) expect(across(widest)).toBeGreaterThan(Math.hypot(widest.points[1].x - widest.points[2].x, widest.points[1].y - widest.points[2].y));
        seen.push(widest ? Number(/, ([\d.]+)\)$/.exec(widest.color)![1]) : 0);
      }
      const first = seen.findIndex((level) => level > 0);
      const last = seen.length - 1 - [...seen].reverse().findIndex((level) => level > 0);
      return seen.slice(first, last + 1);
    };
    const full = halo(plain);
    const half = halo(calm);
    expect(full.length).toBeGreaterThan(30);
    // At half strength its last faint moments are too faint to draw: a step or two fewer.
    expect(full.length - half.length).toBeGreaterThanOrEqual(0);
    expect(full.length - half.length).toBeLessThanOrEqual(3);
    // At its strongest the calm one is half of the other.
    expect(Math.max(...half)).toBeCloseTo(Math.max(...full) / 2, 2);
    // From first to last it is never gone: a beam that burns does not go out and come back.
    expect(full.every((level) => level > 0)).toBe(true);
    expect(half.every((level) => level > 0)).toBe(true);
    // The full one drops by a quarter and comes back, over and over: each time it comes back it is a third brighter.
    const rises = (levels: number[]): number[] => levels.flatMap((level, i) => (i > 0 && level > levels[i - 1] * 1.05 ? [level / levels[i - 1]] : []));
    const flickers = rises(full.slice(full.indexOf(Math.max(...full))));
    expect(flickers.length).toBeGreaterThanOrEqual(3);
    for (const rise of flickers) {
      expect(rise).toBeGreaterThan(1.15);
      expect(rise).toBeLessThan(1.5);
    }
    // The calm one, once it is at its strongest, only ever fades.
    expect(rises(half.slice(half.indexOf(Math.max(...half))))).toEqual([]);
  });

  test('a machine going up lights the whole field, but not in a calm picture', () => {
    const { plain, calm } = both(() => fight(['gun-turret', 'tank'], [0]));
    /** The widest light of the frames in which the machine goes up, and how strong the strongest was. */
    const blast = (s: ReturnType<typeof screenOf>) => {
      for (let i = 0; i < 40 && !s.flow.state.units[1].destroyed; i++) { s.fireAt('rightHand', 'enemy-0'); for (let t = 0; t < 40 && s.screen.motion.breaking('enemy-0') === null; t++) s.screen.update(16); }
      expect(s.screen.motion.breaking('enemy-0')).not.toBeNull();
      let widest = 0;
      let strongest = 0;
      let moved = 0;
      for (let i = 0; i < 50; i++) {
        s.screen.update(16);
        const page = s.page();
        const lights = page.glows.filter(isLight);
        widest = Math.max(widest, ...lights.map((g) => g.r));
        strongest = Math.max(strongest, ...lights.map(strength));
        // While a blast shakes the field its picture is drawn a few pixels larger.
        if (page.images.some((img) => (img.image as { id?: string }).id === 'bg-nowhere' && img.w > 310)) moved++;
        // A white wash over the field is a flash.
        expect(page.rects.filter((r) => /^rgba\(255, 255, 255/.test(r.color) && r.w >= 300 && r.h > 100).length > 0 && s === calm).toBe(false);
      }
      return { widest, strongest, moved };
    };
    const full = blast(plain);
    const spared = blast(calm);
    expect(full.widest).toBeGreaterThan(FIELD_LIGHT);
    expect(spared.widest).toBeLessThanOrEqual(FIELD_LIGHT);
    expect(spared.strongest).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(full.strongest).toBeGreaterThan(spared.strongest * 1.5);
    expect(full.moved).toBeGreaterThan(0);
    expect(spared.moved).toBe(0);
  });
});

describe('how many lights a frame holds', () => {
  test('on real ground, in the thick of it: the battle\'s own are sixteen at most, the place has its few and the weather its few', () => {
    // The foundry: fire in the picture, embers in the air. Three that fly, a hot mech, and machines going up.
    const make = (): BattleState => {
      const s = fight(['recon-drone', 'recon-drone', 'recon-drone', 'gun-turret'], [0, 1, 2, 3]);
      s.units[0].heat = HEAT_LIMIT * 0.9;
      return s;
    };
    const { flow, screen, page, fireAt, choose } = screenOf(make(), { background: 'bg-foundry' });
    const place = AMBIENCE['bg-foundry'].lights.length;
    let most = 0;
    let own = 0;
    for (let i = 0; i < 6000 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') {
        const target = flow.state.units.find((u) => u.side === 'enemy' && !u.destroyed)!;
        if (!(fireAt('shoulder', target.id) || fireAt('rightHand', target.id) || fireAt('leftHand', target.id))) choose('endTurn');
      }
      screen.update(16);
      if (i % 3) continue;
      const drawn = page();
      const lights = drawn.glows.filter(isLight);
      // The place's lights are drawn twice: behind what stands on the field and never again. The weather's are the embers.
      const weather = lights.filter((g) => g.r === 7).length;
      expect(weather).toBeLessThanOrEqual(EMBER_LIGHTS);
      // The eyes of the machines are apart from the sixteen: one for each that stands.
      // And so is the generator on the back of the pilot's mech, while that mech stands.
      const eyes = eyesIn(drawn).length + (generatorIn(drawn) ? 1 : 0);
      expect(eyes).toBeLessThanOrEqual(5);
      most = Math.max(most, lights.length);
      own = Math.max(own, lights.length - place - weather - eyes);
    }
    expect(own).toBeLessThanOrEqual(MAX_LIGHTS);
    expect(own).toBeGreaterThan(6);
    expect(most).toBeLessThanOrEqual(MAX_LIGHTS + place + EMBER_LIGHTS + 5);
    // Four machines stood in four places: that is how many wrecks there can be.
    expect(screen.motion.wrecks.length).toBeLessThanOrEqual(4);
  });
});
