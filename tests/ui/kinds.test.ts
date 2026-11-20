import { activeUnit, applyAction, createBattle, type Action, type BattleEvent, type BattleOptions, type BattleState, type UnitState } from '../../src/core/battle';
import { tallyBattle } from '../../src/core/stats';
import type { Build, Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { STRINGS } from '../../src/content/strings';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, WEAPON_NOTE_CHARS } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { record, type Drawn } from '../helpers/canvas';

/**
 * The five kinds that ask something of their machine, as a pilot meets them in a battle: what the
 * row of a weapon says before it is fired, what is said when a fork's hit leaps on, and what is
 * drawn over the machine it would leap on to.
 */

const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const made = (id: string, change: Partial<Weapon>): Weapon => ({ ...rifle, id, name: id, ammo: null, costPerShot: 0, ...change });
const REDLINE = made('wpn-t-redline', { trait: 'redline', traitPower: 6, damage: 30, energy: 60, heat: 10 });
const SURGE = made('wpn-t-surge', { trait: 'surge', damageType: 'energy', damage: 20, energy: 80, heat: 10 });
const PUNISH = made('wpn-t-punish', { trait: 'punish', traitPower: 50, damage: 30, energy: 60, heat: 10 });
const FORK = made('wpn-t-fork', { trait: 'fork', traitPower: 50, damageType: 'energy', damage: 30, accuracy: 999, energy: 60, heat: 10 });
const SPOOL = made('wpn-t-spool', { trait: 'spool', traitPower: 3, damage: 5, energy: 70, heat: 10, mount: 'shoulder' });
const PLAIN = made('wpn-t-plain', { damage: 30, energy: 60, heat: 30 });
/** A redline that cannot miss, and a fork that breaks whatever it touches. */
const SURE = made('wpn-t-sure', { trait: 'redline', traitPower: 6, damage: 30, accuracy: 999, energy: 60, heat: 10 });
const BREAKER = made('wpn-t-breaker', { trait: 'fork', traitPower: 50, damageType: 'energy', damage: 4000, accuracy: 999, energy: 60, heat: 10 });
const KINDS: Catalog = { ...CATALOG, ...Object.fromEntries([REDLINE, SURGE, PUNISH, FORK, SPOOL, PLAIN, SURE, BREAKER].map((w) => [w.id, w])) };

const END: Action = { type: 'endTurn' };
const player = (s: BattleState): UnitState => s.units[0];
function battle(carried: Partial<Build>, enemies = ['gun-turret', 'gun-turret', 'gun-turret'], seed = 1, catalog: Catalog = KINDS, opts: BattleOptions = {}): BattleState {
  const build: Build = { ...DEMO_BUILD, rightHand: undefined, leftHand: undefined, shoulder: undefined, ...carried };
  for (const key of Object.keys(build) as (keyof Build)[]) if (build[key] === undefined) delete build[key];
  let s = createBattle(build, enemies.map((id) => ENEMIES[id]), catalog, seed, opts);
  for (let guard = 0; activeUnit(s).id !== 'player' && guard < 20; guard++) s = applyAction(s, END, catalog);
  return s;
}
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
function flowOf(state: BattleState, catalog: Catalog = KINDS): BattleFlow {
  const flow = new BattleFlow(state, catalog, { quiet: true });
  for (let guard = 0; flow.phase === 'animating' && guard < 500; guard++) flow.advance();
  return flow;
}
/** What is written under each weapon once the list of them is open. */
function rows(state: BattleState, catalog: Catalog = KINDS): Record<string, { note: string; enabled: boolean }> {
  const flow = flowOf(state, catalog);
  expect(flow.menu.items[flow.menu.cursor].id).toBe('fire');
  flow.onInput('confirm');
  expect(flow.phase).toBe('weapon');
  return Object.fromEntries(flow.menu.items.map((item) => [item.id, { note: item.note ?? '', enabled: item.enabled }]));
}
afterEach(() => setLanguage('en'));

describe('the row of a weapon in a battle', () => {
  const carried = battle({ rightHand: SURGE.id, leftHand: REDLINE.id, shoulder: SPOOL.id });
  const had = player(carried).energy;

  test('a weapon of no kind, a punish and a fork say what they cost, as every weapon did', () => {
    const plain = rows(battle({ rightHand: PLAIN.id, leftHand: PUNISH.id }));
    expect(plain.rightHand.note).toBe('EN 60  HEAT 30');
    expect(plain.leftHand.note).toBe('EN 60  HEAT 10');
    expect(rows(battle({ rightHand: FORK.id })).rightHand.note).toBe('EN 60  HEAT 10');
  });

  test('a surge says that it takes all the energy, and how much that is now', () => {
    expect(rows(carried).rightHand.note).toBe(`EN ALL ${had}  HEAT 10`);
    expect(rows(edit(carried, (d) => { player(d).energy = 137; })).rightHand.note).toBe('EN ALL 137  HEAT 10');
  });

  test('a surge with less than the least it asks is refused for that, like any weapon', () => {
    expect(rows(edit(carried, (d) => { player(d).energy = SURGE.energy - 1; })).rightHand).toEqual({ note: 'no energy', enabled: false });
    expect(rows(edit(carried, (d) => { player(d).energy = SURGE.energy; })).rightHand).toEqual({ note: `EN ALL ${SURGE.energy}  HEAT 10`, enabled: true });
  });

  test('a spool says how many shots it has wound up to', () => {
    expect(rows(carried).shoulder.note).toBe('EN 70  HEAT 10  2 SHOTS');
    expect(rows(edit(carried, (d) => { player(d).spool = { shoulder: 2 }; })).shoulder.note).toBe('EN 70  HEAT 10  4 SHOTS');
    expect(rows(edit(carried, (d) => { player(d).spool = { shoulder: 9 }; })).shoulder.note).toBe('EN 70  HEAT 10  5 SHOTS');
  });

  test('a redline says what its machine\'s heat adds, once it adds anything', () => {
    expect(rows(carried).leftHand.note).toBe('EN 60  HEAT 10');
    expect(rows(edit(carried, (d) => { player(d).heat = 50; })).leftHand.note).toBe('EN 60  HEAT 10  +30%');
    expect(rows(edit(carried, (d) => { player(d).heat = 3; })).leftHand.note).toBe('EN 60  HEAT 10  +2%');
  });

  test('in Dutch', () => {
    setLanguage('nl');
    const hot = rows(edit(carried, (d) => { player(d).heat = 50; player(d).spool = { shoulder: 1 }; }));
    expect(hot.rightHand.note).toBe(`EN ALLES ${had}  HITTE 10`);
    expect(hot.leftHand.note).toBe('EN 60  HITTE 10  +30%');
    expect(hot.shoulder.note).toBe('EN 70  HITTE 10  3 SCHOTEN');
  });

  test('the longest thing a row can say of the weapons that are sold fits under the weapon\'s name, in both languages', () => {
    const sold = (CATALOG as Record<string, Weapon>);
    const hands: Partial<Build>[] = [
      { rightHand: 'wpn-slagcaster', leftHand: 'wpn-flywheel', shoulder: 'wpn-spillway' },
      { rightHand: 'wpn-sluice', leftHand: 'wpn-forkbolt', shoulder: 'wpn-thresher' },
      { rightHand: 'wpn-spike-driver', shoulder: 'wpn-crucible' },
      { rightHand: 'wpn-headsman', shoulder: 'wpn-thunderhead' },
    ];
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      for (const build of hands) {
        // As hot, as wound up and as full of energy as a machine gets: the figures at their widest.
        const state = edit(battle({ ...build }, ['gun-turret'], 1, CATALOG), (d) => {
          player(d).heat = 100;
          player(d).energy = 999;
          player(d).usedBoost = true;
          player(d).spool = { rightHand: 9, leftHand: 9, shoulder: 9 };
        });
        for (const [slot, row] of Object.entries(rows(state, CATALOG))) {
          expect(row.enabled, `${language} ${build[slot as keyof Build]}`).toBe(true);
          expect(row.note.length, `${language} ${sold[build[slot as keyof Build]!].name}: ${row.note}`).toBeLessThanOrEqual(WEAPON_NOTE_CHARS);
        }
      }
    }
  });
});

describe('a fork fired in a battle', () => {
  /** A battle in which the fork's first shot of the first turn lands: it is nearly sure to, and the seed is one where it does. */
  const landing = (): BattleState => {
    for (let seed = 1; seed < 20; seed++) {
      const state = battle({ rightHand: FORK.id }, ['gun-turret', 'gun-turret', 'gun-turret'], seed);
      const after = applyAction(state, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, KINDS);
      if (after.events.slice(state.events.length).some((e) => e.type === 'shot' && e.via)) return state;
    }
    throw new Error('no seed in which the fork lands');
  };
  /** Everything the bar says from the trigger to the pilot's next choice. */
  function said(state: BattleState): string[] {
    const flow = flowOf(state);
    flow.onInput('confirm');
    flow.onInput('confirm');
    expect(flow.phase).toBe('target');
    expect(flow.preview?.fork).toBe('enemy-1');
    flow.onInput('confirm');
    // The first thing is said as the trigger is pulled.
    const lines: string[] = [flow.message];
    for (let guard = 0; flow.phase === 'animating' && guard < 50; guard++) {
      flow.advance();
      if (flow.phase === 'animating') lines.push(flow.message);
    }
    return lines;
  }

  test('the bar says the hit, and then where it leapt on to and what it took there', () => {
    const lines = said(landing());
    expect(lines[0]).toMatch(/^wpn-t-fork hits Gun Turret A - \w+ -\d+$/);
    expect(lines[1]).toMatch(/^It leaps on to Gun Turret B - \w+ -\d+$/);
    // Half of what the first took, as the weapon is sold to send on (the turrets are alike).
    const taken = (line: string): number => Number(/-(\d+)$/.exec(line)![1]);
    expect(taken(lines[1])).toBe(Math.max(1, Math.round(taken(lines[0]) / 2)));
  });

  test('in Dutch', () => {
    setLanguage('nl');
    const lines = said(landing());
    expect(lines[1]).toMatch(/^Slaat over op Gun Turret B - \w+ -\d+$/);
  });

  test('where a barrier took all of what leapt on, the bar says what the barrier lost, as it does of any hit', () => {
    const lines = said(edit(landing(), (d) => { d.units[2].barrier = 500; }));
    expect(lines[1]).toMatch(/^wpn-t-fork hits Gun Turret B - barrier -\d+$/);
  });

  test('and where what leapt on broke the second machine in one, the bar says that of it, as it does of any hit', () => {
    const flow = flowOf(battle({ rightHand: BREAKER.id }));
    flow.onInput('confirm');
    flow.onInput('confirm');
    flow.onInput('confirm');
    const lines: string[] = [flow.message];
    for (let guard = 0; flow.phase === 'animating' && guard < 50; guard++) {
      flow.advance();
      if (flow.phase === 'animating') lines.push(flow.message);
    }
    expect(lines[0]).toBe(STRINGS.shatter(BREAKER.name, 'Gun Turret A'));
    expect(lines).toContain(STRINGS.shatter(BREAKER.name, 'Gun Turret B'));
    expect(lines.some((line) => line.startsWith('It leaps'))).toBe(false);
  });

  test('what leapt on is not a shot of its own in the pilot\'s record: one shot, one hit, and the armour both took off', () => {
    const state = landing();
    const after = applyAction(state, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, KINDS);
    const shots = after.events.slice(state.events.length).filter((e): e is Extract<BattleEvent, { type: 'shot' }> => e.type === 'shot');
    expect(shots).toHaveLength(2);
    const tally = tallyBattle({ ...after, events: after.events.slice(state.events.length) });
    expect(tally).toMatchObject({ shots: 1, hits: 1, damage: shots[0].damage + shots[1].damage });
    expect(shots[1].damage).toBeGreaterThan(0);
  });
});

describe('where a fork would leap on to, on the field', () => {
  const sheet = SPRITES as Record<string, { w: number; h: number }>;
  const sprites: SpriteStore = {
    get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: sheet[id]?.w ?? fallback.w, h: sheet[id]?.h ?? fallback.h }),
  };
  /** The screen with a weapon aimed at a machine: the page as drawn, and the screen to press on. */
  function aiming(weapon: Weapon, target = 0): { page: () => Drawn; screen: BattleScreen; flow: BattleFlow } {
    const flow = new BattleFlow(battle({ rightHand: weapon.id }), KINDS, { quiet: true });
    const screen = new BattleScreen(flow, sprites, KINDS, { fast: true, background: 'bg-mine' });
    for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    for (let n = 0; n < target; n++) screen.onInput('next');
    expect(flow.phase).toBe('target');
    expect(flow.targetId).toBe(`enemy-${target}`);
    return { page: () => record((ctx) => screen.draw(ctx)), screen, flow };
  }
  const word = (page: Drawn, text: string) => page.texts.filter((t) => t.text === text);
  /** The small corners in the bolt's colour: eight thin pieces of three pixels. */
  const corners = (page: Drawn) => page.rects.filter((r) => r.color === COLORS.energy && ((r.w === 3 && r.h === 1) || (r.w === 1 && r.h === 3)));

  test('the word FORK and small corners in the bolt\'s colour are over the next machine along the line while a fork is aimed', () => {
    const { page } = aiming(FORK);
    const shown = page();
    const [mark] = word(shown, 'FORK');
    expect(word(shown, 'FORK')).toHaveLength(1);
    expect(mark).toMatchObject({ color: COLORS.energy, size: 10, align: 'center' });
    const marks = corners(shown);
    expect(marks).toHaveLength(8);
    // The corners are round the machine the word is over: the word stands between their left and right.
    const left = Math.min(...marks.map((r) => r.x));
    const right = Math.max(...marks.map((r) => r.x + r.w));
    expect(mark.x).toBeGreaterThan(left);
    expect(mark.x).toBeLessThan(right);
  });

  test('aimed at another machine, they are over the one after that; round to the first from the last', () => {
    const at = [0, 1, 2].map((target) => word(aiming(FORK, target).page(), 'FORK')[0]);
    expect(new Set(at.map((mark) => `${mark.x},${mark.y}`)).size).toBe(3);
    const flows = [0, 1, 2].map((target) => aiming(FORK, target).flow.preview?.fork);
    expect(flows).toEqual(['enemy-1', 'enemy-2', 'enemy-0']);
  });

  test('nothing of the kind for a weapon that is no fork, or before a fork is aimed', () => {
    const plain = aiming(PLAIN).page();
    expect(word(plain, 'FORK')).toEqual([]);
    expect(corners(plain)).toEqual([]);
    const { page, screen, flow } = aiming(FORK);
    screen.onInput('cancel');
    expect(flow.phase).toBe('weapon');
    expect(word(page(), 'FORK')).toEqual([]);
    expect(corners(page())).toEqual([]);
  });

  test('what is more pressing to say of that machine is said in place of the word; the corners are there all the same', () => {
    const flow = new BattleFlow(edit(battle({ rightHand: FORK.id }), (d) => { d.units[2].staggered = 2; }), KINDS, { quiet: true });
    const screen = new BattleScreen(flow, sprites, KINDS, { fast: true, background: 'bg-mine' });
    for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.preview?.fork).toBe('enemy-1');
    const shown = record((ctx) => screen.draw(ctx));
    expect(word(shown, 'FORK')).toEqual([]);
    expect(word(shown, 'STAGGER')).toHaveLength(1);
    expect(corners(shown)).toHaveLength(8);
  });

  test('on the machine the client wants in one piece the objective\'s word stands, and the bolt\'s corners lie a pixel inside the objective\'s', () => {
    const flow = new BattleFlow(battle({ rightHand: FORK.id }, ['gun-turret', 'heavy-mech', 'gun-turret'], 1, KINDS, { objective: { type: 'disable', target: 1 } }), KINDS, { quiet: true });
    const screen = new BattleScreen(flow, sprites, KINDS, { fast: true, background: 'bg-mine' });
    for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    for (let i = 0; i < 4 && flow.targetId !== 'enemy-0'; i++) screen.onInput('next');
    expect(flow.targetId).toBe('enemy-0');
    expect(flow.preview?.fork).toBe('enemy-1');
    const shown = record((ctx) => screen.draw(ctx));
    expect(word(shown, 'FORK')).toEqual([]);
    expect(word(shown, STRINGS.objectives.mark)).toHaveLength(1);
    const box = (pieces: Drawn['rects']) => ({
      left: Math.min(...pieces.map((r) => r.x)), top: Math.min(...pieces.map((r) => r.y)),
      right: Math.max(...pieces.map((r) => r.x + r.w)), bottom: Math.max(...pieces.map((r) => r.y + r.h)),
    });
    const amber = shown.rects.filter((r) => r.color === COLORS.heat && ((r.w === 3 && r.h === 1) || (r.w === 1 && r.h === 3)));
    expect(amber).toHaveLength(8);
    expect(corners(shown)).toHaveLength(8);
    const [outer, inner] = [box(amber), box(corners(shown))];
    expect(inner).toEqual({ left: outer.left + 1, top: outer.top + 1, right: outer.right - 1, bottom: outer.bottom - 1 });
  });

  test('a redline fired warm through the screen itself: the screen tells the effects what kind the weapon is, and the word is written', () => {
    const flow = new BattleFlow(edit(battle({ rightHand: SURE.id }), (d) => { player(d).heat = 50; }), KINDS, { quiet: true });
    // (Not hurried: a screen that is plays no effects at all.)
    const screen = new BattleScreen(flow, sprites, KINDS, { fast: false, background: 'bg-mine' });
    for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    expect(screen.words).toEqual([]);
    screen.onInput('confirm');
    const seen = new Set<string>();
    for (let i = 0; i < 2000 && flow.phase !== 'action'; i++) {
      screen.update(16);
      for (const text of screen.words) seen.add(text);
    }
    expect([...seen]).toContain('REDLINE +30%');
    // And a room of thirty-two letters is what a row's note has: the menu's width less its edges and the cursor.
    expect(WEAPON_NOTE_CHARS).toBe(32);
  });

  test('once the trigger is pulled the mark is gone: there is no shot being aimed any more', () => {
    const { page, screen, flow } = aiming(FORK);
    screen.onInput('confirm');
    expect(flow.phase).not.toBe('target');
    expect(flow.preview).toBeNull();
    expect(word(page(), 'FORK')).toEqual([]);
    expect(corners(page())).toEqual([]);
  });

  test('in Dutch the word is VONK', () => {
    setLanguage('nl');
    const shown = aiming(FORK).page();
    expect(word(shown, 'VONK')).toHaveLength(1);
    expect(word(shown, 'FORK')).toEqual([]);
  });
});
