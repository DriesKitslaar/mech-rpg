import { createBattle, type BattleState } from '../../src/core/battle';
import type { LessonLine } from '../../src/core/campaign';
import type { Build, Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow, type FlowOptions } from '../../src/ui/battleFlow';

/**
 * What a pilot is told once, the first time it happens: why the weapon is ready again after a
 * kill, and why the machine that is left is leaving. Here: when the flow says each line, what it
 * says it before, and what it remembers having said.
 */

const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const salvo = CATALOG['wpn-micro-salvo'] as Weapon;
/** A catalogue in which the rifle and the salvo destroy whatever they hit. */
const HEAVY: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 }, 'wpn-micro-salvo': { ...salvo, damage: 900 } };
const SALVO: Build = { ...DEMO_BUILD, shoulder: 'wpn-micro-salvo' };
const MOMENTUM: LessonLine = { who: 'Dispatch', portrait: 'portrait-dispatch', text: 'ready again, because of the banner' };
const ROUT: LessonLine = { who: 'Dispatch', text: 'it has lost its nerve' };
const BOTH = { momentum: MOMENTUM, rout: ROUT };
const DRONES = ['recon-drone', 'recon-drone', 'recon-drone'];

const battle = (enemies: string[], seed: number, build: Build = DEMO_BUILD, catalog: Catalog = HEAVY): BattleState =>
  createBattle(build, enemies.map((id) => ENEMIES[id]), catalog, seed);

function made(state: BattleState, opts: FlowOptions, catalog: Catalog = HEAVY) {
  const flow = new BattleFlow(state, catalog, opts);
  /** Everything that was said, in order: a line of talk as `who: text`, the message bar as it stood when the menu came. */
  const heard: string[] = [];
  /** Lets the battle run until the pilot has something to answer: a line to confirm, the menu, or the result. */
  const settle = (): void => {
    for (let i = 0; i < 20000 && flow.phase === 'animating'; i++) flow.advance();
    if (flow.phase === 'talk') heard.push(`${flow.spoken!.who}: ${flow.spoken!.text}`);
    if (flow.phase === 'action') heard.push(flow.message);
  };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) flow.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) flow.onInput('up');
    flow.onInput('confirm');
    settle();
  };
  /** Fires a weapon at the core of the first machine standing. */
  const fire = (weapon: string): void => {
    choose('fire');
    choose(weapon);
    flow.onInput('confirm');
    settle();
  };
  const confirm = (): void => { flow.onInput('confirm'); settle(); };
  const standing = (): number => flow.state.units.filter((u) => u.side === 'enemy' && !u.destroyed).length;
  settle();
  return { flow, heard, settle, choose, fire, confirm, standing };
}

/** The first battle, by seed, in which the pilot's volleys land as the test needs them to: the dice are the game's own. */
function lucky<T>(play: (seed: number) => T | null): T {
  for (let seed = 1; seed <= 400; seed++) {
    const found = play(seed);
    if (found) return found;
  }
  throw new Error('no seed in 400 gave the hits this test is about');
}

/** A battle against three drones in which the rifle's first shot destroys one. */
const afterFirstKill = (opts: FlowOptions) => lucky((seed) => {
  const m = made(battle(DRONES, seed), opts);
  m.fire('rightHand');
  return m.standing() === 2 ? m : null;
});

describe('why the weapon is ready again', () => {
  test('is said as the menu comes back after the kill, before the bar says which weapon it is', () => {
    const m = afterFirstKill({ lessons: BOTH });
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken).toEqual({ who: 'Dispatch', portrait: 'portrait-dispatch', text: MOMENTUM.text });
    expect(m.flow.taught).toEqual(['momentum']);
    m.confirm();
    expect(m.flow.phase).toBe('action');
    expect(m.flow.message).toBe(STRINGS.momentum.ready(rifle.name));
    // The menu is the turn's own: the rifle can be fired again.
    expect(m.flow.menu.items.find((item) => item.id === 'fire')!.enabled).toBe(true);
  });

  test('is said once in a battle: the next kill has only its own line', () => {
    const m = lucky((seed) => {
      const made3 = made(battle([...DRONES], seed), { lessons: { momentum: MOMENTUM } });
      made3.fire('rightHand');
      if (made3.standing() !== 2) return null;
      made3.confirm();
      made3.fire('rightHand');
      return made3.standing() === 1 ? made3 : null;
    });
    expect(m.flow.taught).toEqual(['momentum']);
    expect(m.heard.filter((line) => line === `Dispatch: ${MOMENTUM.text}`)).toHaveLength(1);
    expect(m.flow.phase).toBe('action');
  });

  test('is not said to a pilot who has been told: the menu comes back with the bar\'s line at once', () => {
    const m = afterFirstKill({ lessons: { rout: ROUT } });
    expect(m.flow.phase).toBe('action');
    expect(m.flow.message).toBe(STRINGS.momentum.ready(rifle.name));
    expect(m.flow.taught).toEqual([]);
  });

  test('is not said of a weapon the kill left empty: the line would not be true', () => {
    const last: Catalog = { ...HEAVY, 'wpn-rivet-rifle': { ...rifle, damage: 900, ammo: 1 } };
    const m = lucky((seed) => {
      const one = made(battle(DRONES, seed, DEMO_BUILD, last), { lessons: BOTH }, last);
      one.fire('rightHand');
      return one.standing() === 2 ? one : null;
    });
    expect(m.flow.phase).toBe('action');
    expect(m.flow.message).toBe(STRINGS.momentum.empty(rifle.name));
    expect(m.flow.taught).toEqual([]);
  });

  test('is not said of the kill that ends the battle, and is not counted as said', () => {
    // A salvo that destroys both machines there are: nothing is handed back.
    const m = lucky((seed) => {
      const two = made(battle(['recon-drone', 'recon-drone'], seed, SALVO), { lessons: BOTH });
      two.fire('shoulder');
      return two.standing() === 0 ? two : null;
    });
    expect(m.flow.phase).toBe('result');
    expect(m.flow.taught).toEqual([]);
    expect(m.heard.some((line) => line.startsWith('Dispatch'))).toBe(false);
  });

  test('is not said in a battle that is played without talk, and is not counted as said', () => {
    const m = afterFirstKill({ lessons: BOTH, quiet: true });
    expect(m.flow.phase).toBe('action');
    expect(m.flow.taught).toEqual([]);
  });

  test('is not said in a battle that is not open: no kill gives anything back there', () => {
    const m = lucky((seed) => {
      const closed = made(createBattle(DEMO_BUILD, DRONES.map((id) => ENEMIES[id]), HEAVY, seed, { closed: true }), { lessons: BOTH });
      closed.fire('rightHand');
      return closed.standing() === 2 ? closed : null;
    });
    expect(m.flow.phase).toBe('action');
    expect(m.flow.taught).toEqual([]);
  });

  test('a turn played by Auto Turn hands no menu over and says nothing; the next kill by hand is the occasion', () => {
    const m = lucky((seed) => {
      const auto = made(battle(['recon-drone', 'recon-drone', 'recon-drone'], seed), { lessons: { momentum: MOMENTUM } });
      auto.choose('auto');
      // The automatic player destroyed one at least, and the battle went on to another turn of the pilot's.
      return auto.flow.phase === 'action' && auto.standing() >= 1 && auto.standing() < 3 ? auto : null;
    });
    expect(m.flow.taught).toEqual([]);
    expect(m.heard.some((line) => line.startsWith('Dispatch'))).toBe(false);
  });
});

describe('why the machine that is left is leaving', () => {
  /** Two drones destroyed in one turn by the rifle, one shot each: the third has lost its nerve and still stands. */
  const afterSecondKill = (opts: FlowOptions) => lucky((seed) => {
    const m = made(battle(DRONES, seed), opts);
    m.fire('rightHand');
    if (m.standing() !== 2) return null;
    if (m.flow.phase === 'talk') m.confirm();
    m.fire('rightHand');
    return m.standing() === 1 ? m : null;
  });

  test('is said as the menu comes back, while the machine that lost its nerve still stands', () => {
    const m = afterSecondKill({ lessons: BOTH });
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken).toEqual({ who: 'Dispatch', text: ROUT.text });
    expect(m.flow.taught).toEqual(['momentum', 'rout']);
    expect(m.flow.state.units.some((u) => u.shaken && !u.destroyed)).toBe(true);
    m.confirm();
    expect(m.flow.phase).toBe('action');
    // The bar still says what the second kill gave back.
    expect(m.flow.message).toBe(STRINGS.momentum.run(2, STRINGS.momentum.ready(rifle.name)));
  });

  test('both moments in one volley are said one after the other, the weapon first', () => {
    // A salvo that destroys two of three: the first kill this pilot is handed a weapon back for is also the first rout.
    const m = lucky((seed) => {
      const three = made(battle(DRONES, seed, SALVO), { lessons: BOTH });
      three.fire('shoulder');
      return three.standing() === 1 ? three : null;
    });
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken!.text).toBe(MOMENTUM.text);
    m.confirm();
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken!.text).toBe(ROUT.text);
    expect(m.flow.taught).toEqual(['momentum', 'rout']);
    m.confirm();
    expect(m.flow.phase).toBe('action');
    expect(m.flow.message).toBe(STRINGS.momentum.run(2, STRINGS.momentum.ready(salvo.name)));
  });

  test('is not said again in the same battle, nor to a pilot who has been told', () => {
    const told = afterSecondKill({ lessons: { momentum: MOMENTUM } });
    expect(told.flow.phase).toBe('action');
    expect(told.flow.taught).toEqual(['momentum']);
    const m = afterSecondKill({ lessons: BOTH });
    m.confirm();
    // The turn goes on with the machine still standing: ending it and coming back says nothing more.
    expect(m.heard.filter((line) => line === `Dispatch: ${ROUT.text}`)).toHaveLength(1);
  });

  test('a lesson comes before what the battle itself has to say at that moment', () => {
    const talk = [{ at: 'last' as const, who: 'Dispatch', text: 'one left' }];
    const m = afterSecondKill({ lessons: { rout: ROUT }, talk });
    expect(m.flow.spoken!.text).toBe(ROUT.text);
    m.confirm();
    expect(m.flow.phase).toBe('talk');
    expect(m.flow.spoken!.text).toBe('one left');
  });
});
