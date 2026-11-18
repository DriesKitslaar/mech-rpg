import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { swarmContract } from '../../src/core/board';
import type { Catalog, Weapon } from '../../src/core/types';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { soundsForEvent } from '../../src/platform/audio';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { accept, done, finishMission, ids, inHub, press, savedGame, select, snap, strong, toHub } from '../helpers/app';
import { record, type Pictured } from '../helpers/canvas';

/**
 * Swarms, as the pilot meets them: the strip that says how many are still to come, a machine
 * coming on, and the swarm that is on offer beside the board.
 */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const idOf = (image: Pictured): string => (image.image as { id: string }).id;
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };
const drone = ENEMIES['recon-drone'];
const swarmOf = (more: number, seed = 1, opts: BattleOptions = {}): BattleState =>
  createBattle(DEMO_BUILD, [drone, drone, drone], HEAVY, seed, { reserve: Array.from({ length: more }, () => drone), ...opts });

function made(state: BattleState, fast = true) {
  const heard: string[] = [];
  const flow = new BattleFlow(state, HEAVY, { quiet: true });
  const screen = new BattleScreen(flow, sprites, HEAVY, { fast, sfx: { play: (name: string) => { heard.push(name); } } as never });
  const said: string[] = [];
  const note = (): void => { if (flow.message && flow.message !== said.at(-1)) said.push(flow.message); };
  const settle = (): void => {
    note();
    for (let i = 0; i < 20000 && (screen.banner || !['action', 'result'].includes(flow.phase)); i++) { screen.update(16); note(); }
  };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  const shoot = (): void => { choose('fire'); choose('rightHand'); screen.onInput('confirm'); settle(); };
  const page = () => record((ctx) => screen.draw(ctx));
  const down = (): number => flow.state.units.filter((u) => u.side === 'enemy' && u.destroyed).length;
  return { flow, screen, heard, said, settle, choose, shoot, page, down };
}
type Made = ReturnType<typeof made>;
/** A battle, by seed, in which the pilot's first volley takes a drone: the dice are the game's own. */
function firstBlood(more: number, fast = true, opts: BattleOptions = {}): Made {
  for (let seed = 1; seed <= 400; seed++) {
    const m = made(swarmOf(more, seed, opts), fast);
    m.settle();
    m.shoot();
    if (m.down() === 1) return m;
  }
  throw new Error('no seed in 400 gave the hit this test is about');
}

describe('the strip under the message bar', () => {
  test('says how many are still to come where the battle asks for nothing else, counts down as they come on, and goes when none are left', () => {
    const m = firstBlood(2);
    expect(m.flow.objective).toEqual({ text: '2 MORE TO COME' });
    expect(m.page().texts.filter((t) => t.text === '2 MORE TO COME').map((t) => [t.x, t.y, t.color])).toEqual([[5, 14, COLORS.heat]]);
    m.choose('endTurn');
    m.settle();
    // One came on where the first fell; one is left behind it.
    expect(m.flow.state.reserve).toHaveLength(1);
    expect(m.flow.objective).toEqual({ text: '1 MORE TO COME' });
    const plain = made(createBattle(DEMO_BUILD, [drone, drone, drone], HEAVY, 1));
    plain.settle();
    expect(plain.flow.objective).toBeNull();
    expect(plain.page().texts.some((t) => /MORE TO COME/.test(t.text))).toBe(false);
  });

  test('counts down as the machines are said to come on, and not before: the rules have them on the field a message sooner', () => {
    // Turrets, which move after the pilot does. Two fall in one turn, with four behind them; the third has lost its
    // nerve and leaves when its turn comes, at the end of the round; and as the next round begins three come on.
    const turret = ENEMIES['gun-turret'];
    let m: Made | undefined;
    for (let seed = 1; seed <= 400 && !m; seed++) {
      const tried = made(createBattle(DEMO_BUILD, [turret, turret, turret], HEAVY, seed, { reserve: [turret, turret, turret, turret] }), false);
      tried.settle();
      if (tried.flow.state.round !== 1) continue;
      tried.shoot();
      if (tried.down() !== 1) continue;
      tried.shoot();
      if (tried.down() === 2) m = tried;
    }
    expect(m).toBeDefined();
    const { flow, screen } = m!;
    expect(flow.objective).toEqual({ text: '4 MORE TO COME' });
    m!.choose('endTurn');
    // By the rules the third has left and three more are on the field already, with one left behind them.
    expect(flow.state.reserve).toHaveLength(1);
    expect(flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed)).toHaveLength(3);
    /** What the strip said, and what was drawn of it, for every frame the message bar said each thing. */
    const strips = new Map<string, Set<string>>();
    const drawn = new Map<string, Set<string>>();
    for (let i = 0; i < 20000 && flow.phase !== 'action' && flow.phase !== 'result'; i++) {
      const bar = flow.message;
      if (!strips.has(bar)) { strips.set(bar, new Set()); drawn.set(bar, new Set()); }
      strips.get(bar)!.add(flow.objective?.text ?? '');
      for (const t of m!.page().texts) if (/MORE TO COME$/.test(t.text)) drawn.get(bar)!.add(t.text);
      screen.update(16);
    }
    const bars = [...strips.keys()];
    // The one that lost its nerve is said to give out first; then the three are said to come on, in one line.
    expect(bars.slice(0, 2)).toEqual(['Gun Turret C shuts down', '3 machines come on - 1 more behind them']);
    expect(bars.some((bar) => /Gun Turret [DEF] comes on/.test(bar))).toBe(false);
    // While it leaves the strip still says four are to come: nothing has been said of them. From then on, one.
    expect([...strips.get('Gun Turret C shuts down')!]).toEqual(['4 MORE TO COME']);
    expect([...drawn.get('Gun Turret C shuts down')!]).toEqual(['4 MORE TO COME']);
    for (const bar of bars.slice(1)) {
      expect([...strips.get(bar)!], bar).toEqual(['1 MORE TO COME']);
      expect([...drawn.get(bar)!], bar).toEqual(['1 MORE TO COME']);
    }
    expect(flow.objective).toEqual({ text: '1 MORE TO COME' });
  });

  test('says it after what the battle asks for, where it asks for something', () => {
    const m = made(swarmOf(4, 1, { objective: { type: 'protect', name: 'Ore Train', hp: 12 } }));
    m.settle();
    expect(m.flow.objective).toEqual({ text: 'ORE TRAIN 12/12  +4', meter: { value: 12, max: 12 } });
    const held = made(swarmOf(4, 1, { objective: { type: 'survive', rounds: 6 } }));
    held.settle();
    expect(held.flow.objective).toMatchObject({ text: 'HOLD OUT 1/6  +4' });
  });

  test('in Dutch', () => {
    setLanguage('nl');
    const m = made(swarmOf(4));
    m.settle();
    expect(m.flow.objective).toEqual({ text: 'NOG 4 OP KOMST' });
  });
});

describe('a machine that comes on', () => {
  test('is said to, with how many are behind it, and is heard', () => {
    const m = firstBlood(2, false);
    const before = m.said.length;
    const heard = m.heard.length;
    m.choose('endTurn');
    m.settle();
    expect(m.said.slice(before)).toContain('Recon Drone D comes on - 1 more behind it');
    expect(m.heard.slice(heard)).toContain('launch');
    expect(soundsForEvent({ type: 'arrive', unit: 'enemy-3', left: 1 }, 'kinetic', 90)).toEqual([{ name: 'launch', delayMs: 0 }]);
    // The last of them says so.
    const last = firstBlood(1, false);
    last.choose('endTurn');
    last.settle();
    expect(last.said).toContain('Recon Drone D comes on - the last of them');
  });

  test('is not on the field before its coming on has been shown, and stands where the one before it fell', () => {
    const m = firstBlood(1, false);
    const drones = (): Pictured[] => m.page().images.filter((image) => idOf(image) === 'enemy-recon-drone');
    // Its wreck lies where it fell, and two drones are left.
    for (let i = 0; i < 120; i++) m.screen.update(16);
    expect(drones()).toHaveLength(2);
    expect(m.screen.motion.wrecks).toHaveLength(1);
    m.choose('endTurn');
    // The rules have brought the fourth on at once; the screen has not got there.
    expect(m.flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed)).toHaveLength(3);
    expect(drones()).toHaveLength(2);
    for (let i = 0; i < 4000 && !m.said.includes('Recon Drone D comes on - the last of them'); i++) { m.screen.update(16); if (m.flow.message) m.said.push(m.flow.message); }
    m.screen.update(16);
    expect(drones()).toHaveLength(3);
    // Something stands there now: what was left of the first is gone.
    expect(m.screen.motion.wrecks).toHaveLength(0);
  });

  test('in Dutch', () => {
    setLanguage('nl');
    const m = firstBlood(2);
    m.choose('endTurn');
    m.settle();
    expect(m.said).toContain('Recon Drone D komt erbij - nog 1 erachter');
  });

  test('comes on in a ring of light where it stands', () => {
    const m = firstBlood(1, false);
    // The pilot has the menu while the machine they destroyed is still going up: this one lets that play out,
    // so that the camera is back where it stands before anything else happens.
    for (let i = 0; i < 120; i++) m.screen.update(16);
    m.choose('endTurn');
    for (let i = 0; i < 4000 && !/comes on/.test(m.flow.message); i++) m.screen.update(16);
    expect(m.flow.message).toBe('Recon Drone D comes on - the last of them');
    m.screen.update(16);
    const at = m.screen.motion.at.centre('enemy-3');
    // A ring's light reaches 2.4 times as far as the ring is large, and the ring is 16.
    const rings = m.page().glows.filter((g) => g.blend === 'lighter' && Math.abs(g.r - 16 * 2.4) < 0.01 && Math.abs(g.x - at.x) < 1 && Math.abs(g.y - at.y) < 1);
    expect(rings).toHaveLength(1);
  });

  test('a field of one machine with more behind it is drawn as a field, not as a duel', () => {
    const one = made(createBattle(DEMO_BUILD, [ENEMIES['light-mech']], HEAVY, 1, { reserve: [drone, drone] }), false);
    const alone = made(createBattle(DEMO_BUILD, [ENEMIES['light-mech']], HEAVY, 1), false);
    one.settle();
    alone.settle();
    // Fought alone a mech is drawn from the sprites of its parts; among others, from the one picture of it.
    const whole = (m: Made): boolean => m.page().images.some((image) => idOf(image) === 'enemy-light-mech');
    expect(whole(alone)).toBe(false);
    expect(whole(one)).toBe(true);
  });
});

describe('the swarm beside the board', () => {
  const ready = () => inHub(strong(done('intro-1', 'intro-2')));

  test('is on offer once the open board is, after the board, with what it pays', () => {
    const { app } = ready();
    select(app, 'contracts');
    const game = app.game!;
    const swarm = swarmContract(game.battlesWon, game.cycle, BOARD_TEXT);
    const listed = ids(app);
    expect(listed).toContain(swarm.id);
    expect(listed.indexOf(swarm.id)).toBe(listed.indexOf(`open-${game.cycle}-${game.battlesWon}-2`) + 1);
    expect(snap(app).menu.items.find((item) => item.id === swarm.id)).toMatchObject({ label: swarm.title, note: String(swarm.reward) });
    // A pilot still on the introductions is offered neither.
    const early = inHub(done('intro-1'));
    select(early.app, 'contracts');
    expect(ids(early.app).some((id) => id.startsWith('open-'))).toBe(false);
  });

  test('in Dutch its row in the list has a Dutch name, which is no other row\'s, and so has its briefing', () => {
    const { app } = ready();
    const game = app.game!;
    const english = swarmContract(game.battlesWon, game.cycle, BOARD_TEXT).title;
    setLanguage('nl');
    select(app, 'contracts');
    const swarm = swarmContract(game.battlesWon, game.cycle, BOARD_TEXT);
    const rows = snap(app).menu.items;
    const row = rows.find((item) => item.id === swarm.id)!;
    expect(row.label).toBe(swarm.title);
    expect(row.label).not.toBe(english);
    expect(/^[\x20-\x7e]+$/.test(row.label)).toBe(true);
    expect(rows.filter((item) => item.label === row.label)).toHaveLength(1);
    // Drawn as the list draws it.
    expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).toContain(row.label);
    select(app, swarm.id);
    const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(said).toContain('OPEN CONTRACT: EEN ZWERM');
    expect(said).toContain(row.label.toUpperCase());
    const total = swarm.battles[0].enemies.length + swarm.battles[0].reserve!.length;
    expect(snap(app).briefing).toMatchObject({ objectives: [`Nog ${total - 3} volgen als er een valt`] });
  });

  test('its briefing says what it is, how many machines, and that more come on', () => {
    const { app } = ready();
    const swarm = swarmContract(app.game!.battlesWon, app.game!.cycle, BOARD_TEXT);
    const total = swarm.battles[0].enemies.length + swarm.battles[0].reserve!.length;
    select(app, 'contracts');
    select(app, swarm.id);
    expect(snap(app).screen).toBe('briefing');
    expect(snap(app).briefing).toMatchObject({ mission: swarm.id, reward: swarm.reward, objectives: [`${total - 3} more come on as they fall`] });
    const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(said).toContain('OPEN CONTRACT: A SWARM');
    expect(said).toContain(`Recon Drone x${total}`);
  });

  test('is played to the end, pays by the head, and a new one is on offer after it', () => {
    const { app, store } = ready();
    const before = app.game!;
    const swarm = swarmContract(before.battlesWon, before.cycle, BOARD_TEXT);
    accept(app, swarm.id);
    expect(snap(app).battle).toMatchObject({ mission: swarm.id, of: 1 });
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: swarm.reward });
    toHub(app);
    const after = savedGame(store);
    expect(after.battlesWon).toBe(before.battlesWon + 1);
    expect(after.stats.kills).toBeGreaterThanOrEqual(before.stats.kills + swarm.battles[0].enemies.length);
    // It is not a contract of the story: nothing is completed, and there is another where it was.
    expect(after.completed).toEqual(before.completed);
    select(app, 'contracts');
    const next = swarmContract(after.battlesWon, after.cycle, BOARD_TEXT);
    expect(ids(app)).toContain(next.id);
    expect(ids(app)).not.toContain(swarm.id);
    press(app, 'cancel');
  });
});
