import { createBattle, type BattleState } from '../../src/core/battle';
import type { Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { SOUNDS, soundsForEvent } from '../../src/platform/audio';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';

/**
 * A kill that readies the weapon, and a blow that goes through a machine, as the pilot meets them:
 * what the aiming line promises, what the message bar says, what is heard, and what the weapon
 * menu offers afterwards.
 */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
/** A catalogue in which the rifle destroys whatever it hits. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 } };
const battle = (enemies: string[], catalog: Catalog, seed: number): BattleState => createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), catalog, seed);

function made(state: BattleState, catalog: Catalog, fast = true) {
  const heard: string[] = [];
  const flow = new BattleFlow(state, catalog, { quiet: true });
  const screen = new BattleScreen(flow, sprites, catalog, { fast, sfx: { play: (name: string) => { heard.push(name); } } as never });
  const said: string[] = [];
  /** Lets the battle run until the pilot can act again, or it is over; remembers what the message bar said on the way. */
  const note = (): void => { if (flow.message && flow.message !== said.at(-1)) said.push(flow.message); };
  const settle = (): void => {
    // What a press put in the bar is there before the first frame.
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
  /** Takes aim with a weapon at the n-th enemy still standing, without firing. */
  const aim = (weapon: string, nth = 0): void => {
    choose('fire');
    choose(weapon);
    for (let n = 0; n < nth; n++) screen.onInput('next');
  };
  const texts = () => record((ctx) => screen.draw(ctx)).texts;
  return { flow, screen, heard, said, settle, choose, aim, texts };
}
/** The first battle, by seed, in which the pilot's volleys land as the test needs them to: the dice are the game's own. */
function lucky<T>(play: (seed: number) => T | null): T {
  for (let seed = 1; seed <= 400; seed++) {
    const found = play(seed);
    if (found) return found;
  }
  throw new Error('no seed in 400 gave the hits this test is about');
}

describe('the aiming line', () => {
  const aimLine = (m: ReturnType<typeof made>) => m.texts().filter((t) => t.size === 16 && t.text.startsWith(STRINGS.preview.hit));

  test('says DESTROYS, in the accent colour, where one hit would finish the machine, and the figure where it would not', () => {
    const m = made(battle(['recon-drone', 'gun-turret'], CATALOG, 1), CATALOG);
    m.settle();
    m.aim('rightHand');
    expect(m.flow.targetId).toBe('enemy-0');
    expect(m.flow.preview).toMatchObject({ shatter: true, kills: true });
    expect(aimLine(m).map((t) => [t.text, t.color])).toEqual([[`HIT ${m.flow.preview!.hitChance}%   DESTROYS`, COLORS.accent]]);
    // The turret beside it takes the same slug and stands: the line says what the slug does to it.
    m.screen.onInput('next');
    expect(m.flow.targetId).toBe('enemy-1');
    expect(m.flow.preview).toMatchObject({ shatter: false, kills: false, damage: 23 });
    expect(aimLine(m).map((t) => [t.text, t.color])).toEqual([[`HIT ${m.flow.preview!.hitChance}%   DMG 23`, COLORS.text]]);
  });

  test('says it of a hit that is simply enough, and not of one a barrier would take', () => {
    const worn = battle(['gun-turret', 'gun-turret'], CATALOG, 1);
    worn.units[1].parts.core!.ap = 20;
    const m = made(worn, CATALOG);
    m.settle();
    m.aim('rightHand');
    expect(m.flow.preview).toMatchObject({ shatter: false, kills: true, damage: 23 });
    expect(aimLine(m)[0].text).toMatch(/DESTROYS$/);
    // Behind a barrier of ten the same hit leaves seven of the housing standing.
    const shielded = battle(['gun-turret', 'gun-turret'], CATALOG, 1);
    shielded.units[1].parts.core!.ap = 20;
    shielded.units[1].barrier = 10;
    const n = made(shielded, CATALOG);
    n.settle();
    n.aim('rightHand');
    expect(n.flow.preview).toMatchObject({ kills: false, damage: 23 });
    expect(aimLine(n)[0].text).toMatch(/DMG 23$/);
  });

  test('in Dutch, and at its longest, stays inside the panel', () => {
    setLanguage('nl');
    const m = made(battle(['recon-drone', 'gun-turret'], CATALOG, 1), CATALOG);
    m.settle();
    m.aim('rightHand');
    const [line] = aimLine(m);
    expect(line.text).toBe(`TREF ${m.flow.preview!.hitChance}%   VERNIETIGT`);
    // A sure shot is one figure longer than any other.
    const widest = `TREF 100%   VERNIETIGT`.length - line.text.length;
    expect(line.right + widest * (line.right - line.left) / line.text.length).toBeLessThanOrEqual(310 - 4);
  });
});

describe('a kill that readies the weapon', () => {
  /** Three volleys of the rifle that all land: two drones and the turret behind them. */
  const run = () => lucky((seed) => {
    const m = made(battle(['recon-drone', 'recon-drone', 'gun-turret'], HEAVY, seed), HEAVY, false);
    m.settle();
    const marks: number[] = [];
    for (let n = 0; n < 3; n++) {
      if (m.flow.phase !== 'action') return null;
      m.aim('rightHand');
      m.screen.onInput('confirm');
      m.settle();
      if (m.flow.state.units.filter((u) => u.side === 'enemy' && u.destroyed).length !== n + 1) return null;
      marks.push(m.said.length);
    }
    return { ...m, marks };
  });

  test('is said in the message bar: the weapon by name, and from the second in a turn the chain', () => {
    const m = run();
    const [first, second] = [m.said.slice(0, m.marks[0]), m.said.slice(m.marks[0], m.marks[1])];
    // In the order it happened: the blow, the machine going, the weapon back.
    expect(first.slice(-4)).toEqual(['Rivet Rifle SHATTERS Recon Drone A', 'Recon Drone A destroyed', 'Rivet Rifle ready again', 'Round 1 - your move']);
    expect(second).toContain('CHAIN x2 - Rivet Rifle ready again');
    // The third ended the battle: nothing is ready for anything, and nothing says so.
    expect(m.flow.state.outcome).toBe('victory');
    expect(m.said.filter((line) => line.includes('ready again'))).toHaveLength(2);
    expect(m.flow.state.units[0].chain).toBe(3);
  });

  test('is heard: once for each, and not for the one that ends the battle', () => {
    const m = run();
    // The first is the weapon back; the second, a step higher, is the run going on.
    expect(m.heard.filter((name) => ['ready', 'chain2', 'chain3'].includes(name))).toEqual(['ready', 'chain2']);
    // The machine is heard to go before the weapon is heard to be back.
    expect(m.heard.indexOf('ready')).toBeGreaterThan(m.heard.indexOf('unitDestroyed'));
    expect(soundsForEvent({ type: 'momentum', unit: 'player', weapon: 'rightHand', chain: 1 }, 'kinetic', 90)).toEqual([{ name: 'ready', delayMs: 0 }]);
    // A breech and two notes going up, over in a seventh of a second: nothing that holds a turn up.
    const tones = SOUNDS.ready;
    expect(tones.map((tone) => tone.wave)).toEqual(['noise', 'square', 'square']);
    expect(tones[2].from).toBeGreaterThan(tones[1].from);
    expect(Math.max(...tones.map((tone) => tone.start + tone.dur))).toBeLessThanOrEqual(0.15);
  });

  test('puts the weapon back in the menu with what it costs, and leaves a weapon that only wounded where it was', () => {
    const m = lucky((seed) => {
      const made1 = made(battle(['recon-drone', 'gun-turret', 'gun-turret'], HEAVY, seed), HEAVY);
      made1.settle();
      made1.aim('rightHand');
      made1.screen.onInput('confirm');
      made1.settle();
      if (!made1.flow.state.units[1].destroyed) return null;
      // The pistol at a turret: a hit or a miss, it has fired.
      made1.aim('leftHand');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.phase === 'action' ? made1 : null;
    });
    m.choose('fire');
    const items = Object.fromEntries(m.flow.menu.items.map((item) => [item.id, item]));
    expect(items.rightHand).toMatchObject({ enabled: true, label: `Rivet Rifle x${rifle.ammo! - 1}`, note: `EN ${rifle.energy}  HEAT ${rifle.heat}` });
    expect(items.leftHand).toMatchObject({ enabled: false, note: 'fired' });
  });

  test('does not put back a weapon whose last round the kill was', () => {
    const m = lucky((seed) => {
      const state = battle(['recon-drone', 'gun-turret'], HEAVY, seed);
      state.units[0].ammo.rightHand = 1;
      const made1 = made(state, HEAVY);
      made1.settle();
      made1.aim('rightHand');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.state.units[1].destroyed ? made1 : null;
    });
    expect(m.said).toContain('Rivet Rifle ready again');
    m.choose('fire');
    expect(m.flow.menu.items.find((item) => item.id === 'rightHand')).toMatchObject({ enabled: false, label: 'Rivet Rifle x0', note: 'no ammo' });
  });
});

describe('in Dutch', () => {
  test('the blow that goes through a machine, the weapon that is ready again and the chain are said in Dutch', () => {
    setLanguage('nl');
    const m = lucky((seed) => {
      const made1 = made(battle(['recon-drone', 'recon-drone', 'gun-turret'], CATALOG, seed), CATALOG);
      made1.settle();
      for (let n = 0; n < 2; n++) {
        made1.aim('rightHand');
        made1.screen.onInput('confirm');
        made1.settle();
        if (made1.flow.state.units.filter((u) => u.side === 'enemy' && u.destroyed).length !== n + 1) return null;
      }
      return made1;
    });
    expect(m.said).toContain('Rivet Rifle VERMORZELT Recon Drone A');
    expect(m.said).toContain('Rivet Rifle weer klaar');
    expect(m.said).toContain('REEKS x2 - Rivet Rifle weer klaar');
    expect(m.said.some((line) => /SHATTERS|ready again|CHAIN/.test(line))).toBe(false);
  });
});
