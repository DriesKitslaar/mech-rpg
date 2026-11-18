import { createBattle, type BattleState } from '../../src/core/battle';
import type { Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { soundsForEvent } from '../../src/platform/audio';
import { BattleFlow, type FlowOptions } from '../../src/ui/battleFlow';
import { LEAVE_MS, LEAVE_PX } from '../../src/ui/battleFx';
import { BattleScreen } from '../../src/ui/battleScreen';
import { EYES, EYE_ALPHA } from '../../src/ui/eyes';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { record, type Drawn, type Glowed, type Pictured } from '../helpers/canvas';

/**
 * They break, as the pilot meets it: what is said and heard when a machine loses its nerve and when
 * it leaves, how it is marked while it still stands, and that it goes without leaving a wreck.
 */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const idOf = (image: Pictured): string => (image.image as { id: string }).id;
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };
const FIELD = ['recon-drone', 'recon-drone', 'gun-turret'];
const battle = (seed: number): BattleState => createBattle(DEMO_BUILD, FIELD.map((id) => ENEMIES[id]), HEAVY, seed);

function made(state: BattleState, opts: { fast?: boolean; calm?: boolean; flow?: FlowOptions } = {}) {
  const heard: string[] = [];
  const flow = new BattleFlow(state, HEAVY, opts.flow ?? { quiet: true });
  const screen = new BattleScreen(flow, sprites, HEAVY, {
    fast: opts.fast ?? false, ...(opts.calm ? { calm: true } : {}), sfx: { play: (name: string) => { heard.push(name); } } as never,
  });
  const said: string[] = [];
  const note = (): void => { if (flow.message && flow.message !== said.at(-1)) said.push(flow.message); };
  /** Lets the battle run until the pilot can act again, somebody speaks, or it is over. */
  const settle = (): void => {
    note();
    for (let i = 0; i < 20000 && (screen.banner || !['action', 'result', 'talk'].includes(flow.phase)); i++) { screen.update(16); note(); }
  };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Fires the rifle at the first machine still standing. */
  const shoot = (): void => { choose('fire'); choose('rightHand'); screen.onInput('confirm'); settle(); };
  const page = () => record((ctx) => screen.draw(ctx));
  return { flow, screen, heard, said, settle, choose, shoot, page };
}
type Made = ReturnType<typeof made>;
/** A battle, by seed, in which the pilot's first two volleys take the two drones: the dice are the game's own. */
function broken(opts: Parameters<typeof made>[1] = {}, between: (m: Made) => void = () => undefined): Made {
  for (let seed = 1; seed <= 400; seed++) {
    const m = made(battle(seed), opts);
    m.settle();
    m.shoot();
    if (m.flow.state.units.filter((u) => u.destroyed).length !== 1) continue;
    between(m);
    m.shoot();
    if (m.flow.state.units.filter((u) => u.destroyed).length !== 2) continue;
    return m;
  }
  throw new Error('no seed in 400 gave the two hits this test is about');
}

describe('a machine that loses its nerve', () => {
  test('is said to, after the chain that did it, and is heard', () => {
    const m = broken();
    expect(m.flow.state.units[3].shaken).toBe(true);
    expect(m.said.slice(-3)).toEqual(['CHAIN x2 - Rivet Rifle ready again', 'Gun Turret loses its nerve', 'Round 1 - your move']);
    expect(m.heard.filter((name) => name === 'stagger')).toHaveLength(1);
    expect(m.heard.lastIndexOf('stagger')).toBeGreaterThan(m.heard.lastIndexOf('ready'));
    expect(soundsForEvent({ type: 'shaken', unit: 'enemy-2' }, 'kinetic', 90)).toEqual([{ name: 'stagger', delayMs: 0 }]);
    // It is the pilot's turn still, and the turret is still there to be aimed at.
    expect(m.flow.phase).toBe('action');
    expect(m.flow.state.units[3].destroyed).toBe(false);
  });

  test('has the word over it as it happens', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const m = made(battle(seed));
      m.settle();
      m.shoot();
      if (m.flow.state.units.filter((u) => u.destroyed).length !== 1) continue;
      m.choose('fire'); m.choose('rightHand'); m.screen.onInput('confirm');
      if (m.flow.state.units.filter((u) => u.destroyed).length !== 2) continue;
      for (let i = 0; i < 2000 && m.flow.message !== 'Gun Turret loses its nerve'; i++) m.screen.update(16);
      expect(m.flow.message).toBe('Gun Turret loses its nerve');
      m.screen.update(16);
      const word = m.page().texts.filter((t) => t.text === 'SHAKEN');
      expect(word).toHaveLength(6);
      expect(word.at(-1)!.color).toBe(COLORS.accent);
      // It is over the turret: on the far side of the field.
      expect(word.at(-1)!.x).toBeGreaterThan(200);
      return;
    }
    throw new Error('no seed gave the two hits');
  });

  test('is marked in the panel when it is aimed at, in place of what it was about to do', () => {
    const calm = made(battle(1), { fast: true });
    calm.settle();
    calm.choose('fire'); calm.choose('rightHand');
    calm.screen.onInput('next'); calm.screen.onInput('next');
    expect(calm.flow.targetId).toBe('enemy-2');
    const before = calm.page().texts.map((t) => t.text);
    expect(before.some((text) => /^AIMS /.test(text))).toBe(true);
    expect(before).not.toContain('SHAKEN');
    const m = broken({ fast: true });
    m.choose('fire'); m.choose('rightHand');
    expect(m.flow.targetId).toBe('enemy-2');
    const tags = m.page().texts.filter((t) => t.text === 'SHAKEN' || /^AIMS /.test(t.text));
    expect(tags.map((t) => [t.text, t.color])).toEqual([['SHAKEN', COLORS.accent]]);
  });

  test('looks it: its eye is low from the moment it is said', () => {
    const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
    /** The light that sits on the turret's eye. */
    const eyeIn = (drawn: Drawn): Glowed => {
      const image = drawn.images.find((picture) => idOf(picture) === 'enemy-gun-turret')!;
      const at = EYES['enemy-gun-turret'];
      return drawn.glows.find((g) => g.blend === 'lighter' && g.r === at.r && Math.abs(g.x - (image.x + at.x)) < 0.01 && Math.abs(g.y - (image.y + at.y)) < 0.01)!;
    };
    const eye = (m: Made): number => strength(eyeIn(m.page()));
    const fresh = made(battle(1), { calm: true });
    fresh.settle();
    const awake = eye(fresh);
    const m = broken({ calm: true });
    expect(m.screen.motion.stance('enemy-2').shaken).toBe(true);
    expect(m.screen.motion.stance('enemy-0').shaken).toBe(false);
    // A calm picture's eyes hold: a dazed one at 0.35 of what an eye is, at half strength.
    expect(eye(m)).toBeCloseTo((EYE_ALPHA * 0.35) / 2, 2);
    expect(eye(m)).toBeLessThan(awake);
  });
});

describe('a machine that breaks off', () => {
  test('is said to and heard, and the battle is won', () => {
    const m = broken();
    const before = m.said.length;
    const heard = m.heard.length;
    m.choose('endTurn');
    m.settle();
    expect(m.flow.phase).toBe('result');
    expect(m.flow.state.outcome).toBe('victory');
    expect(m.flow.state.units[3].fled).toBe(true);
    expect(m.said.slice(before)).toContain('Gun Turret breaks off');
    expect(m.said.slice(before).some((line) => /Gun Turret (destroyed|fires|hits|misses)/.test(line))).toBe(false);
    expect(m.heard.slice(heard)).toContain('boost');
    expect(m.heard.slice(heard)).not.toContain('unitDestroyed');
    expect(soundsForEvent({ type: 'rout', unit: 'enemy-2' }, 'kinetic', 90)).toEqual([{ name: 'boost', delayMs: 0 }]);
  });

  test('is seen to go: back the way it came, faster as it goes, fading, and then it is not there', () => {
    const m = broken();
    // The machine itself is the last picture of it drawn: what is drawn before it, fainter, is what it leaves behind as it goes.
    const turret = (): Pictured | undefined => m.page().images.filter((image) => idOf(image) === 'enemy-gun-turret').at(-1);
    const home = turret()!;
    expect(home.alpha).toBe(1);
    m.choose('endTurn');
    for (let i = 0; i < 2000 && m.flow.message !== 'Gun Turret breaks off'; i++) m.screen.update(16);
    expect(m.flow.message).toBe('Gun Turret breaks off');
    const xs: number[] = [];
    const alphas: number[] = [];
    let frames = 0;
    for (; frames < 200; frames++) {
      m.screen.update(16);
      const drawn = turret();
      if (!drawn) break;
      xs.push(drawn.x);
      alphas.push(drawn.alpha);
    }
    // Gone within the time it takes, and not at once.
    expect(frames * 16).toBeGreaterThan(LEAVE_MS * 0.6);
    expect(frames * 16).toBeLessThanOrEqual(LEAVE_MS + 64);
    // An enemy looks towards the pilot, on the left: it goes off to the right, and never comes back a step.
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    expect(xs.at(-1)! - home.x).toBeGreaterThan(LEAVE_PX * 0.5);
    expect(xs.at(-1)! - home.x).toBeLessThanOrEqual(LEAVE_PX);
    // Each step is at least as long as the one before: it gathers speed.
    const steps = xs.slice(1).map((x, i) => x - xs[i]);
    expect(steps.at(-1)!).toBeGreaterThan(steps[0]);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1]);
    expect(alphas.at(-1)!).toBeLessThan(0.3);
    // It stays gone, and where it stood there is no wreck: only the two drones left any.
    for (let i = 0; i < 60; i++) m.screen.update(16);
    expect(turret()).toBeUndefined();
    expect(m.screen.motion.wrecks).toHaveLength(2);
  });

  test('in a hurried game is simply gone', () => {
    const m = broken({ fast: true });
    m.choose('endTurn');
    m.settle();
    expect(m.flow.phase).toBe('result');
    expect(m.page().images.some((image) => idOf(image) === 'enemy-gun-turret')).toBe(false);
  });
});

describe('what is said when one enemy is left', () => {
  test('is still said: the machine stands until its turn, and the pilot is handed the menu first', () => {
    const talk = [{ at: 'last' as const, who: 'Dispatch', text: 'One left. It has seen enough.' }];
    const m = broken({ flow: { talk } });
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken).toMatchObject({ who: 'Dispatch', text: 'One left. It has seen enough.' });
    // (A press finishes the line being written; the next one, a moment later, goes on.)
    for (let i = 0; i < 8 && m.flow.phase === 'talk'; i++) {
      for (let frame = 0; frame < 30; frame++) m.screen.update(16);
      m.screen.onInput('confirm');
    }
    m.settle();
    expect(m.flow.phase).toBe('action');
    m.choose('endTurn');
    m.settle();
    expect(m.flow.phase).toBe('result');
    expect(m.flow.state.units[3].fled).toBe(true);
  });
});

describe('in Dutch', () => {
  test('the machine panics, is marked so, and flees', () => {
    setLanguage('nl');
    const m = broken({ fast: true });
    expect(m.said).toContain('Gun Turret raakt in paniek');
    m.choose('fire'); m.choose('rightHand');
    expect(m.page().texts.filter((t) => t.text === 'PANIEK').map((t) => t.color)).toEqual([COLORS.accent]);
    m.screen.onInput('cancel'); m.screen.onInput('cancel');
    m.choose('endTurn');
    m.settle();
    expect(m.said).toContain('Gun Turret vlucht');
    expect(m.said.some((line) => /loses its nerve|breaks off/.test(line))).toBe(false);
  });
});
