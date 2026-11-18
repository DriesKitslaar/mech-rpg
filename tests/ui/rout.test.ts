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
import { PANEL_Y } from '../../src/ui/stage';
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
const battle = (seed: number, field: string[] = FIELD): BattleState => createBattle(DEMO_BUILD, field.map((id) => ENEMIES[id]), HEAVY, seed);
/** How strong a soft light or a shadow is at its middle. */
const strengthOf = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);

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
function broken(opts: Parameters<typeof made>[1] = {}, between: (m: Made) => void = () => undefined, field: string[] = FIELD): Made {
  for (let seed = 1; seed <= 400; seed++) {
    const m = made(battle(seed, field), opts);
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
  test('is said to, before what the kill gave back is, and is heard', () => {
    const m = broken();
    expect(m.flow.state.units[3].shaken).toBe(true);
    // The machine goes, what is left loses its nerve, and the run is the line the pilot is handed the turn back under.
    expect(m.said.slice(-3)).toEqual(['Recon Drone B destroyed', 'Gun Turret loses its nerve', 'CHAIN x2 - Rivet Rifle ready again']);
    expect(m.flow.message).toBe('CHAIN x2 - Rivet Rifle ready again');
    expect(m.heard.filter((name) => name === 'stagger')).toHaveLength(1);
    expect(m.heard.lastIndexOf('chain2')).toBeGreaterThan(m.heard.lastIndexOf('stagger'));
    expect(m.heard.lastIndexOf('stagger')).toBeGreaterThan(m.heard.lastIndexOf('unitDestroyed'));
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
      // Until it is said, nothing on the screen says it: the rules have known since the second kill.
      expect(m.flow.state.units[3].shaken).toBe(true);
      const early = made(battle(seed));
      early.settle();
      early.shoot();
      early.choose('fire'); early.choose('rightHand'); early.screen.onInput('confirm');
      for (let i = 0; i < 2000 && early.flow.message !== 'Recon Drone B destroyed'; i++) early.screen.update(16);
      expect(early.flow.message).toBe('Recon Drone B destroyed');
      for (let i = 0; i < 10; i++) early.screen.update(16);
      expect(early.flow.state.units[3].shaken).toBe(true);
      expect(early.page().texts.some((t) => t.text === 'SHAKEN')).toBe(false);
      m.screen.update(16);
      const all = m.page().texts.filter((t) => t.text === 'SHAKEN');
      // The word that floats up from it: written large, with its dark edge.
      const word = all.filter((t) => t.size >= 16);
      expect(word).toHaveLength(6);
      expect(word.at(-1)!.color).toBe(COLORS.accent);
      // It is over the turret: on the far side of the field.
      expect(word.at(-1)!.x).toBeGreaterThan(200);
      // And the small mark over its head, which stays for as long as the machine does.
      const mark = all.filter((t) => t.size === 10);
      expect(mark.map((t) => [t.color, t.align])).toEqual([[COLORS.accent, 'center']]);
      expect(mark[0].x).toBeGreaterThan(200);
      for (let i = 0; i < 200; i++) m.screen.update(16);
      expect(m.page().texts.filter((t) => t.text === 'SHAKEN').map((t) => t.size)).toEqual([10]);
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
    // Twice, and nothing of what it was about to do: the mark over its head on the field, and the tag in the panel.
    expect(tags.map((t) => [t.text, t.color])).toEqual([['SHAKEN', COLORS.accent], ['SHAKEN', COLORS.accent]]);
    expect(tags.map((t) => t.y < PANEL_Y).sort()).toEqual([false, true]);
  });

  test('a bomb that loses its nerve is not counted down to: it leaves with its fuse unlit, and nothing says FUSE', () => {
    const field = ['recon-drone', 'recon-drone', 'bomb-crawler'];
    const fresh = made(battle(1, field));
    fresh.settle();
    // Before: the fuse is over its head.
    expect(fresh.page().texts.some((t) => /^FUSE \d$/.test(t.text) && t.y < PANEL_Y)).toBe(true);
    const m = broken({}, undefined, field);
    expect(m.flow.state.units[3]).toMatchObject({ shaken: true });
    expect(m.flow.state.units[3].fuse).toBeDefined();
    for (let i = 0; i < 60; i++) m.screen.update(16);
    // Over its head it says what it is going to do, which is leave.
    const field1 = m.page().texts.filter((t) => t.y < PANEL_Y && t.size === 10);
    expect(field1.map((t) => t.text)).toContain('SHAKEN');
    expect(field1.some((t) => /^FUSE/.test(t.text))).toBe(false);
    // Aimed at, its panel says the same.
    m.choose('fire'); m.choose('rightHand');
    expect(m.flow.targetId).toBe('enemy-2');
    const aimed = m.page().texts.map((t) => t.text);
    expect(aimed.filter((text) => text === 'SHAKEN')).toHaveLength(2);
    expect(aimed.some((text) => /^FUSE/.test(text))).toBe(false);
    m.screen.onInput('cancel'); m.screen.onInput('cancel');
    // And it does leave, and nothing goes off.
    m.choose('endTurn');
    m.settle();
    expect(m.flow.state.events.filter((e) => e.type === 'rout').map((e) => e.unit)).toEqual(['enemy-2']);
    expect(m.flow.state.events.some((e) => e.type === 'blast')).toBe(false);
    expect(m.said).toContain('Bomb Crawler breaks off');
  });

  test('looks it: its eye is low from the moment it is said', () => {
    const strength = strengthOf;
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

/** Two drones and a machine that walks: when it loses its nerve it has somewhere to go. */
const WALKER = ['recon-drone', 'recon-drone', 'light-mech'];

describe('a machine that breaks off', () => {
  test('is said to and heard, and the battle is won', () => {
    const m = broken({}, undefined, WALKER);
    const before = m.said.length;
    const heard = m.heard.length;
    m.choose('endTurn');
    m.settle();
    expect(m.flow.phase).toBe('result');
    expect(m.flow.state.outcome).toBe('victory');
    expect(m.flow.state.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2' }]);
    expect(m.said.slice(before)).toContain('Halo Guard breaks off');
    expect(m.said.slice(before).some((line) => /Halo Guard (destroyed|fires|hits|misses|shuts down)/.test(line))).toBe(false);
    expect(m.heard.slice(heard)).toContain('boost');
    expect(m.heard.slice(heard)).not.toContain('unitDestroyed');
    expect(soundsForEvent({ type: 'rout', unit: 'enemy-2' }, 'kinetic', 90)).toEqual([{ name: 'boost', delayMs: 0 }]);
  });

  test('that cannot move shuts down where it stands: it is said to, is heard to go quiet, and the battle is won', () => {
    const m = broken();
    const before = m.said.length;
    const heard = m.heard.length;
    m.choose('endTurn');
    m.settle();
    expect(m.flow.state.outcome).toBe('victory');
    expect(m.flow.state.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2', fixed: true }]);
    expect(m.said.slice(before)).toContain('Gun Turret shuts down');
    expect(m.said.slice(before).some((line) => /Gun Turret (destroyed|fires|hits|misses|breaks off)/.test(line))).toBe(false);
    // A hiss, not the burn of something leaving.
    expect(m.heard.slice(heard)).toContain('cool');
    expect(m.heard.slice(heard)).not.toContain('boost');
    expect(m.heard.slice(heard)).not.toContain('unitDestroyed');
    expect(soundsForEvent({ type: 'rout', unit: 'enemy-2', fixed: true }, 'kinetic', 90)).toEqual([{ name: 'cool', delayMs: 0 }]);
  });

  test('that cannot move is seen to go dark where it stands: it does not stir, it thins, and then it is not there', () => {
    const m = broken();
    const turret = (): Pictured[] => m.page().images.filter((image) => idOf(image) === 'enemy-gun-turret');
    const home = turret().at(-1)!;
    m.choose('endTurn');
    for (let i = 0; i < 2000 && m.flow.message !== 'Gun Turret shuts down'; i++) m.screen.update(16);
    expect(m.flow.message).toBe('Gun Turret shuts down');
    const alphas: number[] = [];
    const words = new Set<string>();
    let frames = 0;
    for (; frames < 200; frames++) {
      m.screen.update(16);
      const drawn = turret();
      if (drawn.length === 0) break;
      // One picture of it, where it always stood: nothing is left behind it, for it goes nowhere.
      expect(drawn).toHaveLength(1);
      expect([drawn[0].x, drawn[0].y]).toEqual([home.x, home.y]);
      alphas.push(drawn[0].alpha);
      for (const t of m.page().texts) if (t.size >= 16 && /^[A-Z]+$/.test(t.text)) words.add(t.text);
    }
    expect(frames * 16).toBeGreaterThan(LEAVE_MS * 0.6);
    expect(frames * 16).toBeLessThanOrEqual(LEAVE_MS + 64);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1]);
    expect(alphas.at(-1)!).toBeLessThan(0.3);
    // The word over it says what happened to it, which is not that it ran. (The word for its nerve may still be fading.)
    expect([...words]).toContain('OFFLINE');
    expect([...words]).not.toContain('ROUT');
    for (let i = 0; i < 60; i++) m.screen.update(16);
    expect(turret()).toEqual([]);
    expect(m.screen.motion.wrecks).toHaveLength(2);
  });

  test('is seen to go: back the way it came, faster as it goes, fading, and then it is not there', () => {
    const m = broken({}, undefined, WALKER);
    // The machine itself is the last picture of it drawn: what is drawn before it, fainter, is what it leaves behind as it goes.
    const turret = (): Pictured | undefined => m.page().images.filter((image) => idOf(image) === 'enemy-light-mech').at(-1);
    const home = turret()!;
    expect(home.alpha).toBe(1);
    m.choose('endTurn');
    for (let i = 0; i < 2000 && m.flow.message !== 'Halo Guard breaks off'; i++) m.screen.update(16);
    expect(m.flow.message).toBe('Halo Guard breaks off');
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

  test('keeps its bars until it is seen to go: the rules have it gone a turn before the screen does', () => {
    const m = broken();
    /** The armour lines under the machines on the field. */
    const bars = (): number => m.page().rects.filter((r) => r.y < PANEL_Y && r.h === 2 && r.color === COLORS.armor).length;
    for (let i = 0; i < 90; i++) m.screen.update(16);
    expect(bars()).toBe(1);
    m.choose('endTurn');
    // By the rules it has left already.
    expect(m.flow.state.units[3].destroyed).toBe(true);
    expect(m.flow.state.events.some((e) => e.type === 'rout' && e.unit === 'enemy-2')).toBe(true);
    expect(bars()).toBe(1);
    for (let i = 0; i < 2000 && m.flow.message !== 'Gun Turret shuts down'; i++) { expect(bars()).toBe(1); m.screen.update(16); }
    expect(m.flow.message).toBe('Gun Turret shuts down');
    // Seen to go, it has none.
    m.screen.update(16);
    m.screen.update(16);
    expect(bars()).toBe(0);
  });

  test('takes its shadow with it, and what burns under one that flies, and the light of its eye: none of them is left where it stood', () => {
    // Two turrets fall and a drone, which flies, is what is left to lose its nerve.
    const m = broken({}, undefined, ['gun-turret', 'gun-turret', 'recon-drone']);
    expect(m.flow.state.units[3]).toMatchObject({ kind: 'recon-drone', shaken: true });
    const seen = () => {
      const drawn = m.page();
      const picture = drawn.images.filter((image) => idOf(image) === 'enemy-recon-drone').at(-1);
      // Its shadow is the dark on the far side of the floor; what burns under it is the pink light; its eye is the small light on it.
      const shadow = drawn.glows.find((g) => g.stops[0][1].startsWith('rgba(0, 0, 8') && g.x > 150);
      const burner = drawn.glows.find((g) => g.stops[0][1].startsWith('rgba(255, 122, 184'));
      const eye = picture ? drawn.glows.find((g) => g.blend === 'lighter' && g.r === EYES['enemy-recon-drone'].r && Math.abs(g.y - (picture.y + EYES['enemy-recon-drone'].y)) < 3) : undefined;
      return { picture, shadow, burner, eye };
    };
    // An eye glimmers and a burner flickers while the machine hangs there: the brightest each is, standing.
    const most = { eye: 0, burner: 0 };
    for (let i = 0; i < 90; i++) {
      m.screen.update(16);
      const now = seen();
      most.eye = Math.max(most.eye, strengthOf(now.eye!));
      most.burner = Math.max(most.burner, strengthOf(now.burner!));
    }
    const home = seen();
    expect(home.picture && home.shadow && home.burner && home.eye).toBeTruthy();
    const off = { shadow: home.shadow!.x - home.picture!.x, burner: home.burner!.x - home.picture!.x, eye: home.eye!.x - home.picture!.x };
    m.choose('endTurn');
    for (let i = 0; i < 2000 && m.flow.message !== 'Recon Drone breaks off'; i++) m.screen.update(16);
    expect(m.flow.message).toBe('Recon Drone breaks off');
    let last = { shadow: strengthOf(home.shadow!), burner: 1, eye: strengthOf(home.eye!) };
    let frames = 0;
    for (; frames < 200; frames++) {
      m.screen.update(16);
      const now = seen();
      if (!now.picture) break;
      // Each of them is where it was under the machine, wherever the machine has got to.
      if (now.shadow) expect(now.shadow.x - now.picture.x).toBeCloseTo(off.shadow, 0);
      if (now.burner) expect(now.burner.x - now.picture.x).toBeCloseTo(off.burner, 0);
      if (now.eye) expect(now.eye.x - now.picture.x).toBeCloseTo(off.eye, 0);
      // And no stronger than the machine is there to be seen: the shadow only ever thins, and the lights are at
      // most what they were at their brightest, by as much as is left of the machine.
      const shadow = now.shadow ? strengthOf(now.shadow) : 0;
      const eye = now.eye ? strengthOf(now.eye) : 0;
      const burner = now.burner ? strengthOf(now.burner) : 0;
      expect(shadow).toBeLessThanOrEqual(last.shadow + 0.001);
      expect(eye).toBeLessThanOrEqual(most.eye * now.picture.alpha + 0.002);
      expect(burner).toBeLessThanOrEqual(most.burner * now.picture.alpha + 0.002);
      last = { shadow, burner, eye };
    }
    expect(frames).toBeGreaterThan(10);
    // As the machine is all but gone, so are they.
    expect(last.shadow).toBeLessThan(strengthOf(home.shadow!) * 0.3);
    expect(last.burner).toBeLessThan(most.burner * 0.3);
    expect(last.eye).toBeLessThan(most.eye * 0.3);
    // And then nothing is left where it stood.
    for (let i = 0; i < 30; i++) m.screen.update(16);
    const after = seen();
    expect(after.picture ?? after.shadow ?? after.burner).toBeUndefined();
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
    expect(m.flow.state.events.filter((e) => e.type === 'rout').map((e) => e.unit)).toEqual(['enemy-2']);
  });
});

describe('in Dutch', () => {
  test('the machine panics, is marked so, and flees', () => {
    setLanguage('nl');
    const m = broken({ fast: true });
    expect(m.said).toContain('Gun Turret raakt in paniek');
    m.choose('fire'); m.choose('rightHand');
    // Over its head and in the panel.
    expect(m.page().texts.filter((t) => t.text === 'PANIEK').map((t) => t.color)).toEqual([COLORS.accent, COLORS.accent]);
    m.screen.onInput('cancel'); m.screen.onInput('cancel');
    m.choose('endTurn');
    m.settle();
    // A turret cannot run: it gives out where it stands. A machine that walks does run.
    expect(m.said).toContain('Gun Turret valt uit');
    expect(m.said.some((line) => /loses its nerve|breaks off|shuts down|vlucht/.test(line))).toBe(false);
    const walker = broken({ fast: true }, undefined, WALKER);
    walker.choose('endTurn');
    walker.settle();
    expect(walker.said).toContain('Halo Guard vlucht');
  });
});
