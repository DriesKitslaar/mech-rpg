import { createBattle, type BattleEvent, type BattleOptions, type BattleState } from '../../src/core/battle';
import type { Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { MISSIONS } from '../../src/content/missions';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SIDE_WORK } from '../../src/content/sidework';
import { STRINGS } from '../../src/content/strings';
import { SOUNDS, soundsForEvent } from '../../src/platform/audio';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleFx, HARDEST_JOLT, OVERKILL_SIZE, OVERKILL_UP, WORD_GAP, WRECK_AT, WRECK_MS, WRECK_SIZE, sizeAt, type Scene } from '../../src/ui/battleFx';
import { BattleScreen, INTRO_MS } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';

/**
 * Weight: an overkill looks and sounds like one, a run of kills is counted on the screen, a machine
 * that leaves is said to, and a battle against ordinary machines says so as it opens. None of it
 * holds a turn up, and a calm picture has the words without the rest.
 */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
/** The dark edge that everything written over the field is given. */
const EDGE = '#0a0812';
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const doing = (damage: number): Catalog => ({ ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage } });
const battle = (enemies: string[], catalog: Catalog, seed: number, opts: BattleOptions = {}): BattleState =>
  createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), catalog, seed, opts);

function made(state: BattleState, catalog: Catalog, opts: { calm?: boolean } = {}) {
  const heard: string[] = [];
  const flow = new BattleFlow(state, catalog, { quiet: true });
  const screen = new BattleScreen(flow, sprites, catalog, { fast: false, ...(opts.calm ? { calm: true } : {}), sfx: { play: (name: string) => { heard.push(name); } } as never });
  /**
   * Every word that floated over the field, and the largest each blast was, since the last time this was asked for;
   * the most that was in the air at once; and, wherever the word of an overkill and the figure of a hit were both
   * written at their settled size, how many rows the figure stood under the word.
   */
  const seen = { words: new Map<string, { x: number; color: string }>(), blasts: new Set<number>(), frames: 0, most: 0, gaps: [] as number[] };
  const look = (): void => {
    const texts = record((ctx) => screen.draw(ctx)).texts;
    for (const t of texts) if (t.size >= 16 && /^[A-Z]+( x\d)?$/.test(t.text)) seen.words.set(t.text, { x: t.x, color: t.color });
    for (const size of screen.motion.blasts) seen.blasts.add(Math.round(size * 100) / 100);
    seen.most = Math.max(seen.most, screen.motion.particles);
    const word = texts.find((t) => t.text === STRINGS.fx.overkill && t.size === 16 && t.color === COLORS.accent);
    const figure = texts.find((t) => /^-\d+$/.test(t.text) && t.size === 16 && t.color !== EDGE);
    if (word && figure) seen.gaps.push(figure.y - word.y);
  };
  /** Lets the battle run until the pilot can act again, or it is over. */
  const settle = (): void => {
    for (let i = 0; i < 20000 && (screen.banner || (flow.phase !== 'action' && flow.phase !== 'result')); i++) { screen.update(16); seen.frames++; look(); }
  };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Fires the rifle at the first machine standing and lets it play out. Says how many frames that took. */
  const shoot = (): number => { const before = seen.frames; choose('fire'); choose('rightHand'); screen.onInput('confirm'); settle(); return seen.frames - before; };
  const down = (): number => flow.state.events.filter((e) => e.type === 'unitDestroyed' && e.unit !== 'player').length;
  /** Goes on looking for this many frames more, whatever the battle is doing. */
  const watch = (frames: number): void => { for (let i = 0; i < frames; i++) { screen.update(16); seen.frames++; look(); } };
  return { flow, screen, heard, seen, settle, choose, shoot, down, watch };
}
type Made = ReturnType<typeof made>;
/** The first battle, by seed, in which things go as the test needs them to: the dice are the game's own. */
function lucky<T>(play: (seed: number) => T | null): T {
  for (let seed = 1; seed <= 400; seed++) {
    const found = play(seed);
    if (found) return found;
  }
  throw new Error('no seed in 400 gave what this test is about');
}
/** A drone destroyed by the pilot's first volley, with a turret left standing. */
const firstKill = (catalog: Catalog, opts: { calm?: boolean } = {}) => lucky((seed) => {
  const m = made(battle(['recon-drone', 'gun-turret'], catalog, seed), catalog, opts);
  m.settle();
  const frames = m.shoot();
  return m.down() === 1 ? { ...m, frames, seed } : null;
});

describe('an overkill', () => {
  test('has the word over the machine, a last blast half as large again, and a slam under the bang', () => {
    const m = firstKill(doing(200));
    expect(m.flow.state.events.some((e) => e.type === 'unitDestroyed' && e.overkill)).toBe(true);
    expect(m.seen.words.get('OVERKILL')).toMatchObject({ color: COLORS.accent });
    // Over the drone, on the far side of the field.
    expect(m.seen.words.get('OVERKILL')!.x).toBeGreaterThan(180);
    const blasts = [...m.seen.blasts].sort((a, b) => a - b);
    const largest = blasts.at(-1)!;
    expect(blasts.some((size) => Math.abs(size * OVERKILL_SIZE - largest) < 0.02)).toBe(true);
    expect(m.heard.filter((name) => name === 'slam')).toHaveLength(1);
    expect(m.heard.indexOf('slam')).toBeGreaterThanOrEqual(m.heard.indexOf('unitDestroyed'));
  });

  test('the word stands clear of the figure of the hit that did it: the two are never written into each other', () => {
    const m = firstKill(doing(200));
    // Both were on the screen at once, at the size they settle to, for several frames: the figure was there first.
    // (For the seven frames in which the word lands it is half as large again and lies over the top of the figure,
    // which is fading by then and is drawn under it: see the last test of the next group but one.)
    expect(m.seen.gaps.length).toBeGreaterThanOrEqual(5);
    // As clear of it as the word for a blocked hit stands of its figure, which is twelve; and no further off than it
    // was put, for it is the word of that machine.
    for (const gap of m.seen.gaps) {
      expect(gap).toBeGreaterThanOrEqual(12);
      expect(gap).toBeLessThanOrEqual(OVERKILL_UP);
    }
  });

  test('throws more into the air than a machine that simply goes up', () => {
    const plain = firstKill(doing(40));
    const over = lucky((seed) => {
      if (seed !== plain.seed) return null;
      const m = made(battle(['recon-drone', 'gun-turret'], doing(200), seed), doing(200));
      m.settle();
      m.shoot();
      return m.down() === 1 ? m : null;
    });
    expect(plain.seen.most).toBeGreaterThan(0);
    expect(over.seen.most).toBeGreaterThan(plain.seen.most);
    // In a calm picture it does not.
    const calm = firstKill(doing(200), { calm: true });
    const quiet = firstKill(doing(40), { calm: true });
    expect(calm.seed).toBe(quiet.seed);
    expect(calm.seen.most).toBe(quiet.seen.most);
  });

  test('is not said of a machine that was simply destroyed, nor shown, nor heard', () => {
    // Forty goes through a drone's fifty, and is nothing like twice it.
    const m = firstKill(doing(40));
    expect(m.flow.state.events.some((e) => e.type === 'shot' && e.shatter)).toBe(true);
    expect(m.flow.state.events.some((e) => e.type === 'unitDestroyed' && e.overkill)).toBe(false);
    expect(m.seen.words.has('OVERKILL')).toBe(false);
    expect(m.heard).not.toContain('slam');
    const plain = [...m.seen.blasts].sort((a, b) => a - b).at(-1)!;
    const over = [...firstKill(doing(200)).seen.blasts].sort((a, b) => a - b).at(-1)!;
    expect(over).toBeCloseTo(plain * OVERKILL_SIZE, 1);
  });

  test('in a calm picture is the word and nothing more', () => {
    const m = firstKill(doing(200), { calm: true });
    expect(m.seen.words.get('OVERKILL')).toMatchObject({ color: COLORS.accent });
    const calm = [...m.seen.blasts].sort((a, b) => a - b).at(-1)!;
    const plain = [...firstKill(doing(40), { calm: true }).seen.blasts].sort((a, b) => a - b).at(-1)!;
    expect(calm).toBe(plain);
  });

  test('holds nothing up: the pilot is handed the menu again in as many frames as after any kill', () => {
    const plain = firstKill(doing(40));
    const over = lucky((seed) => {
      if (seed !== plain.seed) return null;
      const m = made(battle(['recon-drone', 'gun-turret'], doing(200), seed), doing(200));
      m.settle();
      const frames = m.shoot();
      return m.down() === 1 ? { frames } : null;
    });
    expect(over.frames).toBe(plain.frames);
    expect(plain.frames).toBeGreaterThan(20);
  });

  test('is never the pilot\'s own end, however hard the blow: no word over their mech, no slam, no harder blast', () => {
    const turret = CATALOG[ENEMIES['gun-turret'].build.rightHand ?? ENEMIES['gun-turret'].build.shoulder!] as Weapon;
    const cruel: Catalog = { ...CATALOG, [turret.id]: { ...turret, damage: 5000 } };
    const m = lucky((seed) => {
      const made1 = made(battle(['gun-turret', 'gun-turret'], cruel, seed), cruel);
      made1.settle();
      for (let turn = 0; turn < 6 && made1.flow.phase === 'action'; turn++) { made1.choose('endTurn'); made1.settle(); }
      return made1.flow.state.outcome === 'defeat' ? made1 : null;
    });
    // The battle does not call it one: five thousand in a hit is many times the pilot's core, and nothing says so.
    expect(m.flow.state.events.filter((e) => e.type === 'unitDestroyed')).toEqual([{ type: 'unitDestroyed', unit: 'player' }]);
    expect(m.seen.words.has('OVERKILL')).toBe(false);
    // Nor does the pilot's mech go up any harder for it: its last blast is the one any mech of its size has.
    const largest = [...m.seen.blasts].sort((a, b) => a - b).at(-1)!;
    expect(largest).toBeCloseTo(WRECK_SIZE * sizeAt(m.screen.motion.at.depth('player')), 1);
    // What is heard of an overkill is the bang and, under it, the slam.
    expect(soundsForEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }, 'kinetic', 0).map((s) => s.name)).toEqual(['unitDestroyed', 'slam']);
    expect(soundsForEvent({ type: 'unitDestroyed', unit: 'enemy-0' }, 'kinetic', 0).map((s) => s.name)).toEqual(['unitDestroyed']);
  });
});

describe('an overkill that ends the battle', () => {
  /** One drone, destroyed by the pilot's first volley: the battle is won by it, and the close look at the last machine follows. */
  const last = (damage: number, seed?: number) => lucky((s) => {
    if (seed !== undefined && s !== seed) return null;
    const m = made(battle(['recon-drone'], doing(damage), s), doing(damage));
    m.settle();
    m.shoot();
    if (m.flow.state.outcome !== 'victory') return null;
    m.watch(240);
    return { ...m, seed: s };
  });

  test('is looked at from close by as any last machine is: the word is over it, and the blasts are the ones that look has', () => {
    const over = last(200);
    // Sixty destroys a drone that stands alone and is nothing like a drone and a half.
    const plain = last(60, over.seed);
    expect(over.flow.state.events.some((e) => e.type === 'unitDestroyed' && e.overkill)).toBe(true);
    expect(plain.flow.state.events.some((e) => e.type === 'unitDestroyed' && e.overkill)).toBe(false);
    expect(over.seen.words.get('OVERKILL')).toMatchObject({ color: COLORS.accent });
    expect(plain.seen.words.has('OVERKILL')).toBe(false);
    // That look has the picture, and the light there is to spend on it, to itself: nothing is laid over it.
    expect([...over.seen.blasts].sort((a, b) => a - b)).toEqual([...plain.seen.blasts].sort((a, b) => a - b));
    expect(over.seen.blasts.size).toBeGreaterThan(2);
    expect(over.seen.most).toBe(plain.seen.most);
    expect(over.seen.frames).toBe(plain.seen.frames);
    // The blow that ends a battle is a slam already: it is heard once, not twice.
    expect(over.heard.filter((name) => name === 'slam')).toHaveLength(1);
    expect(plain.heard.filter((name) => name === 'slam')).toHaveLength(1);
    expect(over.heard).toEqual(plain.heard);
  });

  test('the pilot destroyed by such a blow, with a press that has gone on to the result before it is seen: their mech goes up as any does', () => {
    const turret = CATALOG[ENEMIES['gun-turret'].build.rightHand ?? ENEMIES['gun-turret'].build.shoulder!] as Weapon;
    const cruel: Catalog = { ...CATALOG, [turret.id]: { ...turret, damage: 5000 } };
    const m = lucky((seed) => {
      const tried = made(battle(['gun-turret', 'gun-turret'], cruel, seed), cruel);
      tried.settle();
      tried.choose('endTurn');
      // The message that the pilot is destroyed comes up at the end of one frame; what is seen of it starts in the next.
      const told = (): boolean => tried.flow.state.events.slice(0, tried.flow.eventsShown).some((e) => e.type === 'unitDestroyed' && e.unit === 'player');
      for (let i = 0; i < 4000 && !told() && tried.flow.phase === 'animating'; i++) tried.screen.update(16);
      if (!told()) return null;
      for (let i = 0; i < 6 && tried.flow.phase !== 'result'; i++) tried.screen.onInput('confirm');
      return tried.flow.phase === 'result' ? tried : null;
    });
    expect(m.flow.state.events.filter((e) => e.type === 'unitDestroyed')).toEqual([{ type: 'unitDestroyed', unit: 'player' }]);
    m.seen.blasts.clear();
    for (let i = 0; i < 90; i++) {
      m.watch(1);
      // Nothing is staged over the result: this is a mech going up on the field, as one does in the middle of a battle.
      expect(m.screen.motion.finish).toBeNull();
    }
    const largest = [...m.seen.blasts].sort((a, b) => a - b).at(-1)!;
    expect(largest).toBeCloseTo(WRECK_SIZE * sizeAt(m.screen.motion.at.depth('player')), 1);
    expect(m.seen.words.has('OVERKILL')).toBe(false);
    expect(m.heard).not.toContain('slam');
  });
});

describe('what the effects make of an overkill, a piece at a time', () => {
  const scene = (depth?: number): Scene => ({
    muzzle: (id) => (id === 'player' ? { x: 100, y: 50 } : { x: 220, y: 60 }),
    hitPoint: (id) => (id === 'player' ? { x: 80, y: 70 } : { x: 240, y: 60 }),
    centre: (id) => (id === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
    facing: (id) => (id === 'player' ? 1 : -1),
    damageType: () => 'kinetic',
    isMelee: () => false,
    ...(depth === undefined ? {} : { depth: () => depth }),
  });
  const over: BattleEvent = { type: 'unitDestroyed', unit: 'enemy-0', overkill: true };
  const plain: BattleEvent = { type: 'unitDestroyed', unit: 'enemy-0' };
  const jolts = (fx: BattleFx) => (fx as unknown as { jolts: { start: number; dur: number; amount: number }[] }).jolts.map(({ start, dur, amount }) => ({ start, dur, amount }));
  const fires = (fx: BattleFx): number[] => fx.bursts().filter((burst) => burst.style === 'fire').map((burst) => burst.size).sort((a, b) => a - b);

  test('the event by itself is a machine going up with a word over it: what is harder is asked for apart, by a screen that is not calm', () => {
    const a = new BattleFx(scene());
    const b = new BattleFx(scene());
    a.onEvent(over);
    b.onEvent(plain);
    a.update(1);
    b.update(1);
    expect(a.texts()).toEqual(['OVERKILL']);
    expect(b.texts()).toEqual([]);
    expect(jolts(a)).toEqual(jolts(b));
    expect(Math.max(...jolts(a).map((jolt) => jolt.amount))).toBe(4);
    a.update(WRECK_AT);
    b.update(WRECK_AT);
    expect(fires(a)).toEqual(fires(b));
    expect(fires(a).at(-1)).toBe(WRECK_SIZE);
  });

  test.each([[undefined, 1], [0, sizeAt(0)], [1, sizeAt(1)]] as [number | undefined, number][])(
    'asked for, at depth %s: a blast half as large again over the last one, from the moment that goes off until it is over', (depth, size) => {
      expect(OVERKILL_SIZE).toBe(1.5);
      const fx = new BattleFx(scene(depth));
      fx.onEvent(over);
      fx.harder('enemy-0');
      fx.update(WRECK_AT - 1);
      expect(fires(fx).every((burst) => burst < WRECK_SIZE * size)).toBe(true);
      fx.update(1);
      expect(fires(fx).slice(-2)).toEqual([WRECK_SIZE * size, WRECK_SIZE * OVERKILL_SIZE * size]);
      fx.update(WRECK_MS - 1);
      expect(fires(fx).slice(-2)).toEqual([WRECK_SIZE * size, WRECK_SIZE * OVERKILL_SIZE * size]);
      fx.update(1);
      expect(fires(fx)).toEqual([]);
    });

  test('asked for: the field is thrown as hard as anything throws it, as that blast goes off and not before', () => {
    const fx = new BattleFx(scene());
    fx.onEvent(over);
    const before = jolts(fx).length;
    fx.harder('enemy-0');
    expect(jolts(fx).slice(before)).toEqual([{ start: WRECK_AT, dur: 300, amount: HARDEST_JOLT }]);
    fx.update(WRECK_AT - 1);
    const early = fx.shake();
    expect(Math.max(Math.abs(early.dx), Math.abs(early.dy))).toBeLessThan(HARDEST_JOLT);
    let furthest = 0;
    for (let ms = 0; ms < 60; ms += 4) { fx.update(4); const { dx, dy } = fx.shake(); furthest = Math.max(furthest, Math.abs(dx), Math.abs(dy)); }
    expect(furthest).toBe(HARDEST_JOLT);
  });

  test('what is written is over what burns: the word, and the figure of the hit, are drawn after every blast', () => {
    const fx = new BattleFx(scene());
    fx.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 200 });
    fx.update(170);
    fx.onEvent(over);
    fx.harder('enemy-0');
    fx.update(WRECK_AT + 60);
    expect(fx.texts().sort()).toEqual(['-200', 'OVERKILL']);
    expect(fires(fx).at(-1)).toBe(WRECK_SIZE * OVERKILL_SIZE);
    const page = record((ctx) => fx.draw(ctx));
    const first = page.order.findIndex((step) => step.kind === 'text');
    // There is fire, and all of it was drawn before the first letter.
    expect(first).toBeGreaterThan(3);
    expect(page.order.slice(first).every((step) => step.kind === 'text')).toBe(true);
    expect(page.texts.filter((t) => t.color !== EDGE).map((t) => t.text).sort()).toEqual(['-200', 'OVERKILL']);
    // And of the two the word, which came later, is written last: where it lands over the figure it is the word that is read.
    const names = page.texts.map((t) => t.text);
    expect(names.lastIndexOf('-200')).toBeLessThan(names.indexOf('OVERKILL'));
    const landing = new BattleFx(scene());
    landing.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 200 });
    landing.update(160 + 450);
    landing.onEvent(over);
    landing.update(16);
    const early = record((ctx) => landing.draw(ctx)).texts;
    expect(early.find((t) => t.text === 'OVERKILL')!.size).toBeGreaterThan(16);
    expect(early.map((t) => t.text).lastIndexOf('-200')).toBeLessThan(early.map((t) => t.text).indexOf('OVERKILL'));
    // The word is that far above where a figure is written, on the machine's own middle.
    const word = page.texts.find((t) => t.text === 'OVERKILL' && t.color !== EDGE)!;
    expect(word.x).toBe(240);
    expect(OVERKILL_UP).toBe(24);
  });
});

describe('words that are written over one unit at one moment stand clear of each other', () => {
  const scene = (enemyX = 240): Scene => ({
    muzzle: (id) => (id === 'player' ? { x: 100, y: 50 } : { x: enemyX - 20, y: 60 }),
    hitPoint: (id) => (id === 'player' ? { x: 80, y: 70 } : { x: enemyX, y: 60 }),
    centre: (id) => (id === 'player' ? { x: 80, y: 80 } : { x: enemyX, y: 60 }),
    facing: (id) => (id === 'player' ? 1 : -1),
    damageType: () => 'kinetic',
    isMelee: () => false,
  });
  /** Where each word that is playing is written, top row first: its own colour, not its dark edge. */
  const written = (fx: BattleFx) => record((ctx) => fx.draw(ctx)).texts.filter((t) => t.color !== EDGE).sort((a, b) => a.y - b.y);

  test('an overkill through a barrier: the word is over BLOCK, which is over the figure', () => {
    expect(WORD_GAP).toBe(12);
    const fx = new BattleFx(scene());
    fx.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 192, absorbed: 8 });
    // The figure and the word for the barrier land with the shot; the machine goes up a little later.
    fx.update(160 + 300);
    fx.onEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true });
    // Once the word has settled to its size: three rows, a row apart or more.
    fx.update(140);
    const rows = written(fx);
    expect(rows.map((t) => t.text)).toEqual(['OVERKILL', 'BLOCK 8', '-192']);
    expect(rows.every((t) => t.size === 16)).toBe(true);
    expect(rows[1].y - rows[0].y).toBeGreaterThanOrEqual(WORD_GAP);
    expect(rows[2].y - rows[1].y).toBe(WORD_GAP);
    // Without a barrier there is nothing to go over, and the word is where it always is.
    const bare = new BattleFx(scene());
    bare.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 200 });
    bare.update(160 + 300);
    bare.onEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true });
    bare.update(140);
    expect(written(bare)[0].y - rows[0].y).toBe(WORD_GAP);
    // Nor for a barrier that took part of a hit on somebody else, or long before.
    const other = new BattleFx(scene());
    other.onEvent({ type: 'shot', unit: 'enemy-0', weapon: 'rightHand', target: 'player', part: 'core', appliedTo: 'core', hit: true, damage: 5, absorbed: 8 });
    other.update(160 + 300);
    other.onEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true });
    other.update(140);
    expect(written(other).find((t) => t.text === 'OVERKILL')!.y).toBe(written(bare)[0].y);
    const old = new BattleFx(scene());
    old.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 192, absorbed: 8 });
    old.update(160 + 900);
    old.onEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true });
    old.update(140);
    expect(written(old).map((t) => [t.text, t.y])).toEqual([['OVERKILL', written(bare)[0].y]]);
  });

  test('a run that ends in an overheat: the count stands over the word for the heat', () => {
    const fx = new BattleFx(scene());
    fx.onEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 3 });
    fx.onEvent({ type: 'overheat', unit: 'player' });
    fx.update(140);
    const rows = written(fx);
    expect(rows.map((t) => t.text)).toEqual(['CHAIN x3', 'OVERHEAT']);
    expect(rows[1].y - rows[0].y).toBe(WORD_GAP);
    expect(rows[0].x).toBe(rows[1].x);
  });

  test('a pilot who presses on: one count at a time, the last making way for the next', () => {
    const fx = new BattleFx(scene());
    fx.onEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 2 });
    fx.update(60);
    expect(fx.texts()).toEqual(['CHAIN x2']);
    fx.onEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 3 });
    fx.update(1);
    expect(fx.texts()).toEqual(['CHAIN x3']);
    // Nothing else that is written is taken away by it.
    fx.onEvent({ type: 'overheat', unit: 'player' });
    fx.onEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 4 });
    fx.update(1);
    expect(fx.texts().sort()).toEqual(['CHAIN x4', 'OVERHEAT']);
  });

  test('a word over a machine at the edge of the field is kept inside it, as wide as it lands: from the camera\'s home and from twice as close', () => {
    // At the size a word lands at a letter is 9.6 wide: OVERKILL is 76.8, and with two pixels to spare its middle is 40.4 from an edge.
    for (const [enemyX, wanted] of [[300, 310 - 40.4], [8, 40.4], [200, 200]] as const) {
      const fx = new BattleFx(scene(enemyX));
      fx.onEvent({ type: 'unitDestroyed', unit: 'enemy-0', overkill: true });
      fx.update(1);
      const [word] = written(fx);
      expect(word.text).toBe('OVERKILL');
      expect(word.size).toBe(24);
      expect(word.x).toBeCloseTo(wanted, 0);
      expect(word.left).toBeGreaterThanOrEqual(0);
      expect(word.right).toBeLessThanOrEqual(310);
      // From twice as close, with the view against the edge the machine is at (it shows half the field), it is still inside.
      const viewLeft = enemyX > 155 ? 155 : 0;
      expect((word.left - viewLeft) * 2).toBeGreaterThanOrEqual(0);
      expect((word.right - viewLeft) * 2).toBeLessThanOrEqual(310);
    }
    // A figure is narrow and stays where it was written unless it is all but on the edge.
    const fx = new BattleFx(scene(300));
    fx.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 7 });
    fx.update(170);
    // (Two letters are 19.2 wide as they land: with the two pixels, its middle is 11.6 from the edge, drawn on the whole pixel.)
    expect(written(fx).map((t) => [t.text, t.x])).toEqual([['-7', 298]]);
    const inside = new BattleFx(scene(280));
    inside.onEvent({ type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit: true, damage: 7 });
    inside.update(170);
    expect(written(inside).map((t) => [t.text, t.x])).toEqual([['-7', 280]]);
  });
});

describe('what the effects make of a machine that is out of the fight', () => {
  const scene: Scene = {
    muzzle: (id) => (id === 'player' ? { x: 100, y: 50 } : { x: 220, y: 60 }),
    hitPoint: (id) => (id === 'player' ? { x: 80, y: 70 } : { x: 240, y: 60 }),
    centre: (id) => (id === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
    facing: (id) => (id === 'player' ? 1 : -1),
    damageType: () => 'kinetic',
    isMelee: () => false,
  };
  const playing = (event: BattleEvent, ms: number) => {
    const fx = new BattleFx(scene);
    fx.onEvent(event);
    fx.update(ms);
    return { fx, page: record((ctx) => fx.draw(ctx)) };
  };

  test('one that leaves goes on a jet, which is drawn behind it and lights the field; one that shuts down has neither', () => {
    const leaves = playing({ type: 'rout', unit: 'enemy-0' }, 200);
    // The jet and the lines it leaves are drawn, and then the word.
    expect(leaves.page.order.filter((step) => step.kind !== 'text').length).toBeGreaterThan(5);
    expect(leaves.fx.lights()).toHaveLength(1);
    expect(leaves.fx.lights()[0].color).toBe(COLORS.energy);
    expect(leaves.fx.texts()).toEqual(['ROUT']);
    // It moves, away from the pilot.
    expect(leaves.fx.transform('enemy-0').dx).toBeGreaterThan(0);
    const dark = playing({ type: 'rout', unit: 'enemy-0', fixed: true }, 200);
    // Nothing but the word is drawn for it, nothing lights the field, and it does not stir: it only thins.
    expect(dark.page.order.every((step) => step.kind === 'text')).toBe(true);
    expect(dark.page.order.length).toBeGreaterThan(0);
    expect(dark.fx.lights()).toEqual([]);
    expect(dark.fx.texts()).toEqual(['OFFLINE']);
    expect(dark.fx.transform('enemy-0')).toMatchObject({ dx: 0, lift: 0, trail: 0, trailY: 0 });
    expect(dark.fx.transform('enemy-0').alpha).toBeLessThan(1);
    expect(dark.fx.transform('enemy-0').alpha).toBeCloseTo(leaves.fx.transform('enemy-0').alpha, 5);
  });
});

describe('a run of kills', () => {
  /** Three volleys that take three drones, with more behind them so that the battle goes on. */
  const run = () => lucky((seed) => {
    const catalog = doing(900);
    const drone = ENEMIES['recon-drone'];
    const m = made(createBattle(DEMO_BUILD, [drone, drone, drone], catalog, seed, { reserve: [drone, drone] }), catalog);
    m.settle();
    for (let n = 1; n <= 3; n++) { m.shoot(); if (m.down() !== n) return null; }
    return m;
  });

  test('is counted over the pilot\'s mech from the second, in the accent colour', () => {
    const m = run();
    expect([...m.seen.words.keys()].filter((word) => word.startsWith('CHAIN'))).toEqual(['CHAIN x2', 'CHAIN x3']);
    for (const word of ['CHAIN x2', 'CHAIN x3']) {
      expect(m.seen.words.get(word)).toMatchObject({ color: COLORS.accent });
      // Over the one who is on the run: the near side of the field.
      expect(m.seen.words.get(word)!.x).toBeLessThan(140);
    }
  });

  test('is heard going up: the weapon back, then a step higher, then higher again with a note more', () => {
    const m = run();
    expect(m.heard.filter((name) => ['ready', 'chain2', 'chain3'].includes(name))).toEqual(['ready', 'chain2', 'chain3']);
    const at = (chain: number) => soundsForEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain }, 'kinetic', 0);
    expect([1, 2, 3, 4, 9].map((chain) => at(chain)[0].name)).toEqual(['ready', 'chain2', 'chain3', 'chain3', 'chain3']);
    const top = (name: 'ready' | 'chain2' | 'chain3'): number => Math.max(...SOUNDS[name].map((tone) => tone.from));
    expect(top('chain2')).toBeGreaterThan(top('ready'));
    expect(top('chain3')).toBeGreaterThan(top('chain2'));
    expect(SOUNDS.chain3.length).toBe(SOUNDS.chain2.length + 1);
    // None of them is longer than a fifth of a second.
    for (const name of ['chain2', 'chain3'] as const) expect(Math.max(...SOUNDS[name].map((tone) => tone.start + tone.dur))).toBeLessThanOrEqual(0.2);
  });

  test('in Dutch', () => {
    setLanguage('nl');
    const m = run();
    expect([...m.seen.words.keys()].filter((word) => /^(REEKS|CHAIN)/.test(word))).toEqual(['REEKS x2', 'REEKS x3']);
  });
});

describe('a machine that leaves', () => {
  /** Two drones fall in one turn; what is left loses its nerve, and the turn is ended. */
  const routed = (third: string) => lucky((seed) => {
    const catalog = doing(900);
    const m = made(battle(['recon-drone', 'recon-drone', third], catalog, seed), catalog);
    m.settle();
    for (let n = 1; n <= 2; n++) { m.shoot(); if (m.down() !== n) return null; }
    m.seen.words.clear();
    m.choose('endTurn');
    m.settle();
    return m;
  });

  test('has the word over it as it goes', () => {
    const m = routed('light-mech');
    expect(m.flow.state.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2' }]);
    expect(m.seen.words.get('ROUT')).toMatchObject({ color: COLORS.accent });
    expect(m.seen.words.get('ROUT')!.x).toBeGreaterThan(180);
    expect(m.seen.words.has('OFFLINE')).toBe(false);
  });

  test('one that cannot move has another word over it: it has not run anywhere', () => {
    const m = routed('gun-turret');
    expect(m.flow.state.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2', fixed: true }]);
    expect(m.seen.words.get('OFFLINE')).toMatchObject({ color: COLORS.accent });
    expect(m.seen.words.get('OFFLINE')!.x).toBeGreaterThan(180);
    expect(m.seen.words.has('ROUT')).toBe(false);
  });

  test('in Dutch', () => {
    setLanguage('nl');
    expect(routed('light-mech').seen.words.has('VLUCHT')).toBe(true);
    expect(routed('gun-turret').seen.words.has('UIT')).toBe(true);
  });
});

describe('the banner of a battle against ordinary machines', () => {
  const banner = (state: BattleState, opts: { boss?: string } = {}) => {
    const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, title: 'PERIMETER SWEEP', ...opts });
    for (let ms = 0; ms < INTRO_MS * 0.5; ms += 16) screen.update(16);
    expect(screen.banner).toBe(true);
    return record((ctx) => screen.draw(ctx)).texts;
  };

  test('names the rule that holds there, at the end of the line that says what the battle asks', () => {
    const said = banner(battle(['recon-drone', 'recon-drone'], CATALOG, 1));
    const tag = said.find((t) => t.text === 'MOMENTUM')!;
    const asked = said.find((t) => t.text === 'DESTROY ALL HOSTILES')!;
    expect(tag).toMatchObject({ align: 'right', color: COLORS.accent });
    expect(tag.y).toBe(asked.y);
    expect(tag.left).toBeGreaterThan(asked.right + 4);
    expect(tag.right).toBeLessThanOrEqual(310 - 4);
  });

  test('is not there where the fight is not open: one machine, somebody who leads, a boss coming in', () => {
    expect(banner(battle(['gun-turret'], CATALOG, 1)).some((t) => t.text === 'MOMENTUM')).toBe(false);
    expect(banner(battle(['magpie', 'recon-drone'], CATALOG, 1)).some((t) => t.text === 'MOMENTUM')).toBe(false);
    expect(banner(battle(['gun-turret', 'recon-drone'], CATALOG, 1, { objective: { type: 'leader', target: 0 } })).some((t) => t.text === 'MOMENTUM')).toBe(false);
    expect(banner(battle(['scrap-king'], CATALOG, 1), { boss: 'Scrap King' }).some((t) => t.text === 'MOMENTUM')).toBe(false);
  });

  test('never runs into what the battle asks, in either language, whatever an open battle of the game asks', () => {
    // What a battle with nobody to lead it can ask: everything destroyed, a time to be outlasted, something to protect.
    const assets = [...MISSIONS, ...SIDE_WORK].flatMap((m) => m.battles.flatMap((b) => (b.objective?.type === 'protect' ? [b.objective.name] : [])));
    expect(assets.length).toBeGreaterThan(3);
    const longest = assets.reduce((a, b) => (b.length > a.length ? b : a));
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      for (const objective of [undefined, { type: 'survive', rounds: 12 }, { type: 'protect', name: longest, hp: 12 }] as const) {
        const said = banner(battle(['recon-drone', 'recon-drone'], CATALOG, 1, objective ? { objective } : {}));
        const tag = said.find((t) => t.text === STRINGS.battleIntro.open)!;
        const asked = said.find((t) => t.y === tag.y && t !== tag)!;
        expect(tag, `${language} ${objective?.type ?? 'destroy'}`).toBeDefined();
        expect(tag.left, `${language}: "${asked.text}"`).toBeGreaterThan(asked.right + 4);
      }
    }
    setLanguage('nl');
    expect(STRINGS.battleIntro.open).toBe('DOORSTOTEN');
  });
});
