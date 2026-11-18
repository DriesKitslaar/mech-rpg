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
    // In the order it happened: the blow, the machine going, the weapon back. The last of them is said as the pilot
    // is handed the turn again and stands in the bar while they choose: the turn's own line does not come over it.
    expect(first.slice(-3)).toEqual(['Rivet Rifle SHATTERS Recon Drone A', 'Recon Drone A destroyed', 'Rivet Rifle ready again']);
    expect(second.at(-1)).toBe('CHAIN x2 - Rivet Rifle ready again');
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
      // Played at its own pace: a hurried battle makes no sound to be wrong about.
      const made1 = made(state, HEAVY, false);
      made1.settle();
      made1.aim('rightHand');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.state.units[1].destroyed ? made1 : null;
    });
    // It is not called ready, and is not heard to be: the menu would say otherwise a moment later.
    expect(m.said.some((line) => /ready again/.test(line))).toBe(false);
    expect(m.said.at(-1)).toBe('Rivet Rifle is empty');
    expect(m.heard).toContain('unitDestroyed');
    expect(m.heard.filter((name) => ['ready', 'chain2', 'chain3'].includes(name))).toEqual([]);
    m.choose('fire');
    expect(m.flow.menu.items.find((item) => item.id === 'rightHand')).toMatchObject({ enabled: false, label: 'Rivet Rifle x0', note: 'no ammo' });
    // The menu opens on what can be fired.
    expect(m.flow.menu.items[m.flow.menu.cursor].id).toBe('leftHand');
  });

  test('says of a weapon that has to be charged that it can charge again, and the menu says CHARGE', () => {
    const rail = CATALOG['wpn-gauss'] as Weapon;
    expect(rail).toMatchObject({ charge: true, mount: 'shoulder' });
    const heavy: Catalog = { ...CATALOG, [rail.id]: { ...rail, damage: 900 } };
    const m = lucky((seed) => {
      const state = createBattle({ ...DEMO_BUILD, shoulder: rail.id }, [ENEMIES['recon-drone'], ENEMIES['gun-turret']], heavy, seed);
      // Charged the turn before: it fires now.
      state.units[0].charged = ['shoulder'];
      const made1 = made(state, heavy, false);
      made1.settle();
      made1.aim('shoulder');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.state.units[1].destroyed ? made1 : null;
    });
    expect(m.said.at(-1)).toBe(`${rail.name} can charge again`);
    expect(m.heard.filter((name) => name === 'ready')).toHaveLength(1);
    m.choose('fire');
    const item = m.flow.menu.items.find((entry) => entry.id === 'shoulder')!;
    expect(item.enabled).toBe(true);
    expect(item.note).toMatch(/^CHARGE /);
    expect(m.flow.menu.items[m.flow.menu.cursor].id).toBe('shoulder');
  });

  test('says nothing of a weapon that something else stops: one that has to charge, with no energy to charge it', () => {
    const rail = CATALOG['wpn-gauss'] as Weapon;
    const heavy: Catalog = { ...CATALOG, [rail.id]: { ...rail, damage: 900 } };
    const m = lucky((seed) => {
      const state = createBattle({ ...DEMO_BUILD, shoulder: rail.id }, [ENEMIES['recon-drone'], ENEMIES['gun-turret']], heavy, seed);
      state.units[0].charged = ['shoulder'];
      const made1 = made(state, heavy, false);
      made1.settle();
      // Firing what is charged costs nothing; charging it again would, and there is nothing to pay with.
      made1.flow.state.units[0].energy = 0;
      made1.aim('shoulder');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.state.units[1].destroyed ? made1 : null;
    });
    expect(m.flow.readied('shoulder')).toBe('none');
    expect(m.said.some((line) => /ready again|can charge again|is empty|clear/.test(line))).toBe(false);
    expect(m.flow.message).toBe(`Round ${m.flow.state.round} - your move`);
    expect(m.heard).toContain('unitDestroyed');
    expect(m.heard).not.toContain('ready');
    // With no energy at all nothing can be fired or charged: the menu's Fire is dim.
    expect(m.flow.menu.items.find((entry) => entry.id === 'fire')!.enabled).toBe(false);
  });

  test('is said before the heat is, and waited for like any line, where the same volley put the pilot over the limit', () => {
    const m = lucky((seed) => {
      const state = battle(['recon-drone', 'recon-drone', 'gun-turret'], HEAVY, seed);
      const made1 = made(state, HEAVY, false);
      made1.settle();
      // Hot already: this volley is the one that goes over.
      made1.flow.state.units[0].heat = 95;
      made1.aim('rightHand');
      made1.screen.onInput('confirm');
      const lines: { text: string; frames: number }[] = [];
      for (let i = 0; i < 20000 && made1.flow.phase !== 'action' && made1.flow.phase !== 'result'; i++) {
        made1.screen.update(16);
        if (lines.at(-1)?.text === made1.flow.message) lines.at(-1)!.frames++;
        else lines.push({ text: made1.flow.message, frames: 1 });
      }
      return made1.flow.state.units[1].destroyed && made1.flow.state.units[0].overheated ? { ...made1, lines } : null;
    });
    const texts = m.lines.map((line) => line.text);
    const at = texts.indexOf('Rivet Rifle ready again');
    expect(at).toBeGreaterThan(0);
    expect(texts.slice(at, at + 2)).toEqual(['Rivet Rifle ready again', 'Overheated! Next turn lost']);
    // It is not the last word of the volley here, so it is held as long as any line is.
    expect(m.lines[at].frames).toBeGreaterThan(20);
    expect(m.lines[at].frames).toBe(m.lines[at - 1].frames);
  });

  test('says the field is clear where the kill left nothing standing and more are to come: there is nothing to turn the weapon on', () => {
    const drone = ENEMIES['recon-drone'];
    const m = lucky((seed) => {
      const made1 = made(createBattle(DEMO_BUILD, [drone], HEAVY, seed, { reserve: [drone, drone] }), HEAVY, false);
      made1.settle();
      made1.aim('rightHand');
      made1.screen.onInput('confirm');
      made1.settle();
      return made1.flow.state.units[1].destroyed ? made1 : null;
    });
    expect(m.flow.state.outcome).toBe('ongoing');
    expect(m.flow.state.open).toBe(true);
    expect(m.said.at(-1)).toBe('Field clear');
    expect(m.said.some((line) => /ready again/.test(line))).toBe(false);
    expect(m.heard).toContain('unitDestroyed');
    expect(m.heard).not.toContain('ready');
    expect(m.flow.menu.items.find((item) => item.id === 'fire')!.enabled).toBe(false);
  });
});

describe('a salvo that destroys several at once', () => {
  const salvo = CATALOG['wpn-micro-salvo'] as Weapon;
  const WIDE: Catalog = { ...CATALOG, 'wpn-micro-salvo': { ...salvo, damage: 900 } };
  const drone = ENEMIES['recon-drone'];
  /** One volley of the salvo at three drones, all of which it takes, at the battle's own pace. */
  const volley = (more: number) => lucky((seed) => {
    const state = createBattle({ ...DEMO_BUILD, shoulder: salvo.id }, [drone, drone, drone], WIDE, seed, { reserve: Array.from({ length: more }, () => drone) });
    const m = made(state, WIDE, false);
    m.settle();
    const before = m.said.length;
    const heard = m.heard.length;
    m.aim('shoulder');
    m.screen.onInput('confirm');
    m.settle();
    return m.flow.state.units.filter((u) => u.side === 'enemy' && u.destroyed).length === 3 ? { ...m, said: m.said.slice(before), heard: m.heard.slice(heard) } : null;
  });

  test('says each machine going, and of the run one thing, once, when the last of the volley has landed', () => {
    const m = volley(3);
    expect(m.flow.state.outcome).toBe('ongoing');
    expect(m.said).toEqual([
      'Micro Salvo SHATTERS Recon Drone A', 'Recon Drone A destroyed',
      'Micro Salvo SHATTERS Recon Drone B', 'Recon Drone B destroyed',
      'Micro Salvo SHATTERS Recon Drone C', 'Recon Drone C destroyed',
      // Nothing stands: the weapon is ready for nothing until the next come on, and is not called ready.
      'CHAIN x3 - Field clear',
    ]);
    // Nobody is said to lose their nerve who is destroyed a moment later.
    expect(m.said.some((line) => /loses its nerve|lose their nerve/.test(line))).toBe(false);
    expect(m.heard).not.toContain('stagger');
    // The run is heard once, as what it is: the third of a turn.
    expect(m.heard.filter((name) => ['ready', 'chain2', 'chain3'].includes(name))).toEqual(['chain3']);
    expect(m.flow.message).toBe('CHAIN x3 - Field clear');
  });

  test('that ends the battle says nothing of a run and readies nothing in anybody\'s hearing', () => {
    const m = volley(0);
    expect(m.flow.state.outcome).toBe('victory');
    expect(m.said.filter((line) => /ready|CHAIN|nerve|clear/.test(line))).toEqual([]);
    expect(m.heard.filter((name) => ['ready', 'chain2', 'chain3', 'stagger'].includes(name))).toEqual([]);
  });
});

describe('what a kill gives back holds nothing up', () => {
  /** How many frames pass from the press that fires the rifle until the pilot has the menu again, and what the bar said. */
  const frames = (enemies: string[]) => lucky((seed) => {
    const m = made(battle(enemies, HEAVY, seed), HEAVY, false);
    m.settle();
    const before = m.said.length;
    m.aim('rightHand');
    m.screen.onInput('confirm');
    let count = 0;
    for (; count < 20000 && m.flow.phase !== 'action' && m.flow.phase !== 'result'; count++) { m.screen.update(16); if (m.flow.message !== m.said.at(-1)) m.said.push(m.flow.message); }
    return m.flow.phase === 'action' && m.flow.state.units[1].destroyed ? { count, said: m.said.slice(before), open: m.flow.state.open } : null;
  });

  test('the turn is handed back in as many frames after a kill in a fight against ordinary machines as in one that is led', () => {
    // A Bailiff leads: beside it a drone is destroyed by the old rules.
    const led = frames(['recon-drone', 'bailiff']);
    const open = frames(['recon-drone', 'gun-turret', 'gun-turret']);
    expect(led.open).toBe(false);
    expect(open.open).toBe(true);
    expect(led.said.some((line) => /ready again/.test(line))).toBe(false);
    expect(open.said.at(-1)).toBe('Rivet Rifle ready again');
    expect(open.count).toBe(led.count);
    expect(open.count).toBeGreaterThan(40);
  });

  test('and the second of a turn waits only for whatever lost its nerve to be said to, once, however many there are', () => {
    const second = (enemies: string[]) => lucky((seed) => {
      const m = made(battle(enemies, HEAVY, seed), HEAVY, false);
      m.settle();
      m.aim('rightHand');
      m.screen.onInput('confirm');
      m.settle();
      if (m.flow.phase !== 'action' || !m.flow.state.units[1].destroyed) return null;
      const before = m.said.length;
      m.aim('rightHand');
      m.screen.onInput('confirm');
      let count = 0;
      for (; count < 20000 && m.flow.phase !== 'action' && m.flow.phase !== 'result'; count++) { m.screen.update(16); if (m.flow.message !== m.said.at(-1)) m.said.push(m.flow.message); }
      return m.flow.phase === 'action' && m.flow.state.units[2].destroyed ? { count, said: m.said.slice(before) } : null;
    });
    const first = frames(['recon-drone', 'gun-turret', 'gun-turret']);
    const one = second(['recon-drone', 'recon-drone', 'gun-turret']);
    expect(one.said.slice(-2)).toEqual(['Gun Turret loses its nerve', 'CHAIN x2 - Rivet Rifle ready again']);
    // One line more than a kill that shakes nobody, and that line is as long as any.
    const line = one.count - first.count;
    expect(line).toBeGreaterThan(20);
    expect(line).toBeLessThan(first.count);
  });
});

describe('in Dutch', () => {
  test('what a kill gave back is said in Dutch whatever it was good for, and never in more room than the bar has', () => {
    setLanguage('nl');
    const M = STRINGS.momentum;
    expect([M.ready('Ketsgeweer'), M.charge('Ketsgeweer'), M.empty('Ketsgeweer'), M.boost('Ketsgeweer'), M.clear]).toEqual([
      'Ketsgeweer weer klaar', 'Ketsgeweer kan weer laden', 'Ketsgeweer is leeg', 'Ketsgeweer vraagt weer Boost', 'Veld leeg',
    ]);
    expect(M.run(3, M.clear)).toBe('REEKS x3 - Veld leeg');
    expect(M.run(2, '')).toBe('REEKS x2');
    expect(STRINGS.arriveMany(3, 2)).toBe('3 machines komen erbij - nog 2 erachter');
    expect(STRINGS.arriveMany(2, 0)).toBe('2 machines komen erbij - de laatste');
    // The bar is as wide as the screen, less five pixels at each end, and a letter in it is 4.8 wide: 62 letters.
    // The longest weapon name there is, at the ninth of a turn.
    const room = Math.floor((310 - 10) / 4.8);
    expect(room).toBe(62);
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const names = Object.values(CATALOG).filter((part): part is Weapon => part.kind === 'weapon').map((weapon) => weapon.name);
      const longest = names.reduce((a, b) => (b.length > a.length ? b : a));
      for (const what of [STRINGS.momentum.ready(longest), STRINGS.momentum.charge(longest), STRINGS.momentum.empty(longest), STRINGS.momentum.boost(longest), STRINGS.momentum.clear]) {
        expect(STRINGS.momentum.run(9, what).length, `${language}: ${what}`).toBeLessThanOrEqual(room);
      }
      expect(STRINGS.arriveMany(3, 6).length).toBeLessThanOrEqual(room);
    }
  });

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
