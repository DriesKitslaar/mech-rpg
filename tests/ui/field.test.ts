import { createBattle, type BattleState } from '../../src/core/battle';
import type { Build } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleFx, type Fx, type Scene } from '../../src/ui/battleFx';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { PANEL_Y } from '../../src/ui/stage';
import { COLORS } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';

/**
 * A core's field as the pilot meets it in a battle: the label that says how much of it stands, what
 * is said, shown and heard when it is broken and when it is back, on the pilot's own mech and on
 * the one mech in the game that is fought behind one.
 */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const FIELDED: Build = { ...DEMO_BUILD, core: 'core-sterling' };

function made(state: BattleState, fast = true) {
  const heard: string[] = [];
  const flow = new BattleFlow(state, CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast, sfx: { play: (name: string) => { heard.push(name); } } as never });
  const said: string[] = [];
  /** What was written over the field at some moment: the words that come up over a machine, not the labels in the panel under it. */
  const shown = new Set<string>();
  const texts = () => record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
  const note = (): void => {
    if (flow.message && flow.message !== said.at(-1)) said.push(flow.message);
    for (const text of record((ctx) => screen.draw(ctx)).texts) if (text.y > 14 && text.y < PANEL_Y - 10) shown.add(text.text);
  };
  /** Lets the battle run until the pilot can act again, or it is over; remembers what the message bar said and what was written on the way. */
  const settle = (): void => {
    note();
    for (let i = 0; i < 20000 && (screen.banner || (flow.phase !== 'action' && flow.phase !== 'result')); i++) {
      screen.update(16);
      note();
    }
  };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Ends the pilot's turn and lets the round go by. */
  const pass = (): void => { choose('endTurn'); settle(); };
  return { flow, screen, heard, said, shown, settle, choose, pass, texts };
}
const player = (m: ReturnType<typeof made>) => m.flow.state.units.find((u) => u.id === 'player')!;
/** The first battle, by seed, that goes the way the test is about: the dice are the game's own. */
function lucky<T>(play: (seed: number) => T | null): T {
  for (let seed = 1; seed <= 300; seed++) {
    const found = play(seed);
    if (found) return found;
  }
  throw new Error('no seed in 300 gave the battle this test is about');
}

describe('the label of a field', () => {
  test('says how much of it stands, as a barrier does; a mech whose core raises none has no such label', () => {
    const m = made(createBattle(FIELDED, [ENEMIES['gun-turret']], CATALOG, 1));
    m.settle();
    expect(player(m).barrier).toBe(25);
    expect(m.texts()).toContain(STRINGS.tags.barrier(25));
    expect(m.texts()).not.toContain(STRINGS.tags.fieldDown);
    const plain = made(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1));
    plain.settle();
    expect(plain.texts().filter((text) => text.startsWith('BARRIER') || text === STRINGS.tags.fieldDown)).toEqual([]);
  });

  test('says FIELD DOWN for as long as nothing stands where the field was, and only on a mech that has a field', () => {
    const m = made(createBattle(FIELDED, [ENEMIES['gun-turret']], CATALOG, 1));
    m.settle();
    player(m).barrier = 0;
    expect(m.texts()).toContain(STRINGS.tags.fieldDown);
    expect(m.texts().filter((text) => text.startsWith('BARRIER'))).toEqual([]);
    // Something raised in its place is what the label says then.
    player(m).barrier = 90;
    expect(m.texts()).toContain(STRINGS.tags.barrier(90));
    expect(m.texts()).not.toContain(STRINGS.tags.fieldDown);
    const plain = made(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1));
    plain.settle();
    expect(plain.texts()).not.toContain(STRINGS.tags.fieldDown);
  });

  test('in Dutch too', () => {
    setLanguage('nl');
    const m = made(createBattle(FIELDED, [ENEMIES['gun-turret']], CATALOG, 1));
    m.settle();
    expect(m.texts()).toContain('BARRIERE 25');
    player(m).barrier = 0;
    expect(m.texts()).toContain('VELD WEG');
  });

  test('is on the target\'s row when the pilot takes aim at the one mech that is fought behind a field: the first sword\'s, of seventy', () => {
    const m = made(createBattle(REFERENCE_BUILDS.tier5, [ENEMIES.argent], CATALOG, 1));
    m.settle();
    // Not before: the row is the target's, and there is no target until a weapon is raised.
    expect(m.texts()).not.toContain(STRINGS.tags.barrier(70));
    m.choose('fire');
    m.choose('rightHand');
    expect(m.flow.targetId).toBe('enemy-0');
    expect(m.texts()).toContain(STRINGS.tags.barrier(70));
    m.flow.state.units[1].barrier = 0;
    expect(m.texts()).toContain(STRINGS.tags.fieldDown);
    expect(m.texts()).not.toContain(STRINGS.tags.barrier(70));
  });
});

describe('a field that is broken, and comes back', () => {
  /**
   * A battle in which the turret's first shot at the pilot lands and takes the whole field with it. Played as it is
   * on the handheld, not hurried: what is written over a machine and what is heard are left out of a hurried battle.
   */
  const broken = () => lucky((seed) => {
    const m = made(createBattle(FIELDED, [ENEMIES['gun-turret']], CATALOG, seed), false);
    m.settle();
    m.pass();
    return m.flow.state.events.some((e) => e.type === 'fieldDown' && e.unit === 'player') && m.flow.phase === 'action' ? m : null;
  });

  test('is said in the message bar, written over the mech and heard, once, when the blow lands that breaks it', () => {
    const m = broken();
    expect(m.said).toContain(STRINGS.fieldDown('You'));
    expect(m.said.filter((line) => line === STRINGS.fieldDown('You'))).toHaveLength(1);
    expect(STRINGS.fieldDown('You')).toBe('You lose your field');
    expect(m.shown.has(STRINGS.fx.fieldDown)).toBe(true);
    expect(m.heard).toContain('cool');
    // And from then on its label says so.
    expect(player(m).barrier).toBe(0);
    expect(m.texts()).toContain(STRINGS.tags.fieldDown);
  });

  test('is down through the round after, and back at the turn after that: said, shown and heard again', () => {
    // A battle that goes on long enough for it: broken in the first round, and the pilot still standing two rounds on.
    const m = lucky((seed) => {
      const play = made(createBattle(FIELDED, [ENEMIES['gun-turret']], CATALOG, seed), false);
      play.settle();
      play.pass();
      if (!play.flow.state.events.some((e) => e.type === 'fieldDown') || play.flow.phase !== 'action') return null;
      // The turn after it broke: down, and nothing has said otherwise.
      expect(player(play).fieldDown).toBe(true);
      expect(play.said).not.toContain(STRINGS.fieldUp('You'));
      expect(play.shown.has(STRINGS.fx.fieldUp)).toBe(false);
      expect(play.heard).not.toContain('guard');
      // The round it is down for goes by.
      play.pass();
      return play.flow.phase === 'action' ? play : null;
    });
    expect(player(m).fieldDown).toBeUndefined();
    expect(player(m).barrier).toBeGreaterThan(0);
    expect(m.said).toContain(STRINGS.fieldUp('You'));
    expect(STRINGS.fieldUp('You')).toBe('You have your field back');
    expect(m.shown.has(STRINGS.fx.fieldUp)).toBe(true);
    expect(m.heard).toContain('guard');
    expect(m.flow.state.events.filter((e) => e.type === 'fieldUp')).toHaveLength(1);
  });

  test('over the machine it goes out in sparks of its own colour under the words FIELD DOWN, and comes back as a guard goes up, under FIELD UP', () => {
    const scene: Scene = {
      muzzle: () => ({ x: 100, y: 50 }), hitPoint: () => ({ x: 80, y: 70 }),
      centre: (id) => (id === 'player' ? { x: 80, y: 80 } : { x: 240, y: 60 }),
      facing: (id) => (id === 'player' ? 1 : -1), damageType: () => 'kinetic', isMelee: () => false,
    };
    const shows = (type: 'fieldDown' | 'fieldUp', unit: string): Fx[] => {
      const fx = new BattleFx(scene);
      fx.onEvent({ type, unit });
      fx.update(1);
      return (fx as unknown as { effects: Fx[] }).effects;
    };
    // The words are these, whichever language the rest is in; each is over the machine the field is on.
    expect([STRINGS.fx.fieldDown, STRINGS.fx.fieldUp]).toEqual(['FIELD DOWN', 'FIELD UP']);
    for (const unit of ['player', 'enemy-0']) {
      const at = scene.centre(unit);
      // A word floats up from just over the middle of the machine.
      const over = { x: at.x, y: at.y - 10 };
      const down = shows('fieldDown', unit);
      expect(down.map((fx) => fx.kind).sort()).toEqual(['sparks', 'text']);
      expect(down.find((fx) => fx.kind === 'sparks')).toMatchObject({ at, color: COLORS.energy });
      expect(down.find((fx) => fx.kind === 'text')).toMatchObject({ at: over, text: 'FIELD DOWN', color: COLORS.energy });
      const up = shows('fieldUp', unit);
      expect(up.map((fx) => fx.kind).sort()).toEqual(['shield', 'text']);
      // The guard stands on the side the machine faces: towards the other side of the field.
      expect(up.find((fx) => fx.kind === 'shield')).toMatchObject({ at, aim: { x: unit === 'player' ? 1 : -1, y: 0 } });
      expect(up.find((fx) => fx.kind === 'text')).toMatchObject({ at: over, text: 'FIELD UP', color: COLORS.energy });
    }
  });

  test('of an enemy it is said by name', () => {
    expect(STRINGS.fieldDown('Argent')).toBe('Argent loses its field');
    expect(STRINGS.fieldUp('Argent')).toBe('Argent has its field back');
    setLanguage('nl');
    expect(STRINGS.fieldDown('Argent')).toBe('Argent: veld weg');
    expect(STRINGS.fieldUp('You')).toBe('Je: veld terug');
    expect([STRINGS.fx.fieldDown, STRINGS.fx.fieldUp]).toEqual(['VELD WEG', 'VELD TERUG']);
  });
});
