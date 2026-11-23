import { chooseEnemyAction } from '../../src/core/ai';
import { HEAT_LIMIT, activeUnit, applyAction, bufferRoom, createBattle, turnEnergyOf, type Action, type BattleState, type UnitState } from '../../src/core/battle';
import type { Build, Catalog, FramePart, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { STRINGS } from '../../src/content/strings';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, GENERATOR } from '../../src/ui/battleScreen';
import { PART_LINE_CHARS, partLines } from '../../src/ui/partInfo';
import type { SpriteStore } from '../../src/ui/sprites';
import { intentText } from '../../src/ui/tags';
import { COLORS } from '../../src/ui/widgets';
import { record, type Drawn, type Glowed, type Written } from '../helpers/canvas';

/**
 * What a pilot sees of the two cores in a battle: the heat bar drawn to the machine's own limit and red where
 * that limit is near, the warning at that limit and no sooner, and what a buffer kept said as the turn opens.
 */
const stock = CATALOG[DEMO_BUILD.core!] as FramePart;
const HOT: FramePart = { ...stock, id: 'core-t-hot', name: 'core-t-hot', heatLimit: 130 };
const DEEP: FramePart = { ...stock, id: 'core-t-deep', name: 'core-t-deep', buffer: 50 };
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const WARM: Weapon = { ...rifle, id: 'wpn-t-warm', name: 'wpn-t-warm', ammo: null, costPerShot: 0, damage: 5, energy: 40, heat: 30 };
const WORKS: Catalog = { ...CATALOG, [HOT.id]: HOT, [DEEP.id]: DEEP, [WARM.id]: WARM };

const END: Action = { type: 'endTurn' };
const player = (s: BattleState): UnitState => s.units[0];
function battle(core: string, heat = 0): BattleState {
  const build: Build = { ...DEMO_BUILD, core, rightHand: WARM.id };
  delete build.leftHand;
  delete build.shoulder;
  let s = createBattle(build, [ENEMIES['heavy-mech']], WORKS, 1);
  for (let guard = 0; activeUnit(s).id !== 'player' && guard < 20; guard++) s = applyAction(s, END, WORKS);
  s = structuredClone(s);
  player(s).heat = heat;
  return s;
}
const sheet = SPRITES as Record<string, { w: number; h: number }>;
const sprites: SpriteStore = {
  get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: sheet[id]?.w ?? fallback.w, h: sheet[id]?.h ?? fallback.h }),
};
function shown(state: BattleState, fast = true): { screen: BattleScreen; flow: BattleFlow; page: () => Drawn } {
  const flow = new BattleFlow(state, WORKS, { quiet: true });
  const screen = new BattleScreen(flow, sprites, WORKS, { fast, background: 'bg-mine' });
  for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
  return { screen, flow, page: () => record((ctx) => screen.draw(ctx)) };
}
/** The row of the heat meter: its label, the figure at its right, and the bar between them (what is filled, and how long it could be). */
function heatRow(page: Drawn): { figure: Written; filled: number; room: number; color: string } {
  const label = page.texts.find((t) => t.text === STRINGS.meters.heat)!;
  const figure = page.texts.find((t) => t.y === label.y && t.align === 'right' && t.x > label.x)!;
  const bars = page.rects.filter((r) => r.y === label.y + 4 && r.h === 4 && r.x === label.x + 30);
  const empty = bars.find((r) => r.color === COLORS.empty)!;
  const fill = bars.find((r) => r.color !== COLORS.empty && r.w <= empty.w)!;
  return { figure, filled: fill.w, room: empty.w, color: fill.color };
}
afterEach(() => setLanguage('en'));
/** A copy of a battle with something about it changed. */
const change = (s: BattleState, to: (draft: BattleState) => void): BattleState => { const copy = structuredClone(s); to(copy); return copy; };

describe('the heat bar of a machine with a limit of its own', () => {
  test('is as long as that limit, and says the limit beside the figure; any other machine\'s says the figure alone', () => {
    const hot = heatRow(shown(battle(HOT.id, 84)).page());
    expect(hot.figure.text).toBe('84/130');
    expect(hot.filled).toBe(Math.round((hot.room * 84) / 130));
    const plain = heatRow(shown(battle(stock.id, 84)).page());
    expect(plain.figure.text).toBe('84');
    expect(plain.filled).toBe(Math.round((plain.room * 84) / HEAT_LIMIT));
    // The same heat is a shorter bar in the machine that can take more of it.
    expect(plain.room).toBe(hot.room);
    expect(hot.filled).toBeLessThan(plain.filled);
  });

  test('past a hundred the bar is still not full, and the figure says how far there is to go', () => {
    const row = heatRow(shown(battle(HOT.id, 120)).page());
    expect(row.figure.text).toBe('120/130');
    expect(row.filled).toBeLessThan(row.room);
    expect(row.filled).toBe(Math.round((row.room * 120) / 130));
    // In any other machine a bar is full at a hundred.
    const full = heatRow(shown(battle(stock.id, 100)).page());
    expect(full.filled).toBe(full.room);
  });

  test('turns red three quarters of the way to the machine\'s own limit: past 97 of 130, past 75 of a hundred', () => {
    const red = (core: string, heat: number): boolean => {
      const row = heatRow(shown(battle(core, heat)).page());
      expect(row.figure.color).toBe(row.color === COLORS.danger ? COLORS.danger : COLORS.text);
      return row.color === COLORS.danger;
    };
    expect([75, 76, 97, 98].map((heat) => red(stock.id, heat))).toEqual([false, true, true, true]);
    expect([75, 76, 97, 98].map((heat) => red(HOT.id, heat))).toEqual([false, false, false, true]);
  });

  test('the figure is the same in Dutch', () => {
    setLanguage('nl');
    expect(heatRow(shown(battle(HOT.id, 84)).page()).figure.text).toBe('84/130');
  });
});

describe('a machine seen to be hot, on the field', () => {
  /** The lights of one colour on a page: the glow of a hot machine is orange-red, the light of its generator amber. */
  const lights = (page: Drawn, rgb: string): Glowed[] => page.glows.filter((glow) => glow.stops[0]?.[1].startsWith(`rgba(${rgb},`));
  const brightness = (glow: Glowed): number => Number(/, ([\d.]+)\)$/.exec(glow.stops[0][1])![1]);
  const HEAT_GLOW = '255, 90, 32';
  const AMBER = '255, 176, 96';
  const seen = (core: string, heat: number): Drawn => shown(battle(core, heat), false).page();

  test('glows from three quarters of the way to its own limit: from 75 of a hundred, from 98 of 130', () => {
    const glowing = (core: string, heat: number): number => lights(seen(core, heat), HEAT_GLOW).length;
    expect([74, 75, 97, 98].map((heat) => glowing(stock.id, heat))).toEqual([0, 1, 1, 1]);
    expect([74, 75, 97, 98].map((heat) => glowing(HOT.id, heat))).toEqual([0, 0, 0, 1]);
  });

  test('and the brighter the nearer it is to that limit: at 110 of 130 it is not yet half-way from where the glow begins to the limit', () => {
    // (The glow breathes; two screens brought to the pilot's turn in the same way are at the same breath.)
    const at = (core: string, heat: number): number => brightness(lights(seen(core, heat), HEAT_GLOW)[0]);
    const full = at(HOT.id, 130);
    // The glow is half as strong where it begins as at the limit, and rises evenly between: 97.5 to 130 here.
    const share = (110 / 130 - 0.75) / 0.25;
    expect(share).toBeLessThan(0.5);
    expect(at(HOT.id, 110) / full).toBeCloseTo((1 + share) / 2, 1);
    expect(at(HOT.id, 110)).toBeLessThan(full * 0.8);
    // Any other machine at a hundred is as far gone as this one at 130, and is at its brightest long before 110.
    expect(at(stock.id, 100)).toBeCloseTo(full, 2);
    expect(at(stock.id, 110)).toBeCloseTo(full, 2);
  });

  test('the light of the pilot\'s generator swells with its heat as a share of the machine\'s own limit', () => {
    const radius = (core: string, heat: number): number => lights(seen(core, heat), AMBER)[0].r;
    expect(radius(stock.id, 0)).toBe(GENERATOR.r);
    expect(radius(HOT.id, 0)).toBe(GENERATOR.r);
    // Half-way to its own limit it has swollen by half of what it can: 65 of 130, 50 of a hundred.
    expect(radius(HOT.id, 65)).toBe(GENERATOR.r + 3);
    expect(radius(stock.id, 50)).toBe(GENERATOR.r + 3);
    expect(radius(HOT.id, 130)).toBe(GENERATOR.r + 6);
    expect(radius(stock.id, 65)).toBeCloseTo(GENERATOR.r + 3.9, 5);
  });
});

describe('a machine that has kept energy, seen from the other side', () => {
  const foe = (s: BattleState): UnitState => s.units[1];
  /** The works pilot against a Colossus: the Solstice is the quicker, and has held by the pilot's first turn. */
  function held(): BattleState {
    let s = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.vesper], WORKS, 1);
    expect(activeUnit(s).id).toBe('enemy-0');
    for (let guard = 0; guard < 6 && activeUnit(s).id === 'enemy-0'; guard++) s = applyAction(s, chooseEnemyAction(s, WORKS), WORKS);
    expect(foe(s)).toMatchObject({ guarding: true, kept: 180 });
    return s;
  }
  /** The words written over the field at the size a mark is written in. */
  const marks = (page: Drawn): Written[] => page.texts.filter((t) => t.size === 10 && t.align === 'center');
  const K = STRINGS.fx.kept(180);

  test('a surge loaded with what its machine kept is written over the machine: how much, in place of its guard, and it blinks', () => {
    const { screen, page } = shown(held());
    expect(screen.markOver('enemy-0')).toBe('+180 EN');
    const over = marks(page());
    expect(over.map((t) => t.text)).toEqual([K]);
    expect([COLORS.energy, COLORS.danger]).toContain(over[0].color);
    // It is in one colour or the other as the clock goes: both are seen.
    const colours = new Set<string>();
    for (let i = 0; i < 60; i++) { screen.update(16); colours.add(marks(page())[0].color); }
    expect([...colours].sort()).toEqual([COLORS.danger, COLORS.energy].sort());
    expect(page().texts.some((t) => t.text === STRINGS.tags.guard)).toBe(false);
  });

  test('knocked off balance it is still what is written: the kept energy comes down all the same', () => {
    const { screen } = shown(change(held(), (d) => { foe(d).staggered = 1; foe(d).stagger = foe(d).staggerMax; }));
    expect(screen.markOver('enemy-0')).toBe('+180 EN');
  });

  test('nothing of it is written once there is nothing to brace for: spent, too little, a turn lost to heat, or no surge to fire it with', () => {
    const over = (s: BattleState): string | null => shown(s).screen.markOver('enemy-0');
    expect(over(change(held(), (d) => { foe(d).kept = 0; }))).toBe(STRINGS.tags.guard);
    expect(over(change(held(), (d) => { foe(d).kept = 89; }))).toBe(STRINGS.tags.guard);
    expect(over(change(held(), (d) => { foe(d).overheated = true; }))).toBe(STRINGS.tags.guard);
    expect(over(change(held(), (d) => { foe(d).build = { ...foe(d).build, rightHand: 'wpn-enemy-pinpoint' }; }))).toBe(STRINGS.tags.guard);
    // With no guard up either there is nothing to say of it.
    expect(over(change(held(), (d) => { foe(d).kept = 0; foe(d).guarding = false; }))).toBeNull();
    // And a machine that is gone has nothing over it.
    expect(over(change(held(), (d) => { foe(d).destroyed = true; }))).toBeNull();
    expect(bufferRoom(foe(held()), WORKS)).toBe(180);
  });

  test('beside its name, once it is aimed at: its guard and what it is about to do, and what it kept where there is room', () => {
    const { screen, flow, page } = shown(held());
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    const said = page().texts.map((t) => t.text);
    expect(said).toContain(STRINGS.tags.guard);
    expect(said).toContain(STRINGS.intent.aim('core'));
    // Here there is room: it is said twice, over the machine and in the row. In the row it is in the colour of energy, and still.
    expect(page().texts.filter((t) => t.text === K).map((t) => t.align).sort()).toEqual(['center', 'left']);
    const colours = new Set<string>();
    for (let i = 0; i < 60; i++) { screen.update(16); colours.add(page().texts.find((t) => t.text === K && t.align === 'left')!.color); }
    expect([...colours]).toEqual([COLORS.energy]);
    // A machine that has kept energy and has no surge says so in that row and nowhere else.
    const plain = shown(change(held(), (d) => { foe(d).build = { ...foe(d).build, rightHand: 'wpn-enemy-pinpoint' }; foe(d).guarding = false; }));
    plain.screen.onInput('confirm');
    plain.screen.onInput('confirm');
    expect(plain.flow.phase).toBe('target');
    // (In the row: from the panel's edge, not centred over the machine as a mark is.)
    expect(plain.page().texts.filter((t) => t.text === K).map((t) => t.align)).toEqual(['left']);
    expect(plain.screen.markOver('enemy-0')).toBeNull();
  });
});

describe('a row beside a name with no room for everything', () => {
  test('what the machine kept is the first to make way, before what it is about to do: over the machine it is said already', () => {
    let s = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES.vesper], WORKS, 1);
    for (let guard = 0; guard < 6 && activeUnit(s).id === 'enemy-0'; guard++) s = applyAction(s, chooseEnemyAction(s, WORKS), WORKS);
    s = structuredClone(s);
    expect(s.units[1]).toMatchObject({ guarding: true, kept: 180 });
    // One tag more than the row holds beside this name.
    s.units[1].painted = 2;
    const { screen, flow, page } = shown(s);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    const said = page().texts;
    const row = said.filter((t) => t.y === said.find((w) => w.text === STRINGS.tags.guard)!.y && t.align === 'left' && t.size === 10).map((t) => t.text);
    expect(row).toEqual([STRINGS.tags.guard, STRINGS.tags.painted, STRINGS.intent.aim('core')]);
    expect(said.filter((t) => t.text === STRINGS.fx.kept(180)).map((t) => t.align)).toEqual(['center']);
    // Without that one tag more, all of it is there.
    const roomy = shown(change(s, (d) => { d.units[1].painted = 0; }));
    roomy.screen.onInput('confirm');
    roomy.screen.onInput('confirm');
    expect(roomy.page().texts.filter((t) => t.text === STRINGS.fx.kept(180)).map((t) => t.align).sort()).toEqual(['center', 'left']);
  });
});

describe('what a machine that holds is about to do', () => {
  test('is written as holding, in a word of its own, in both languages', () => {
    expect(intentText({ kind: 'hold' })).toBe('HOLDS');
    expect(intentText({ kind: 'hold' })).not.toBe(intentText({ kind: 'cool' }));
    setLanguage('nl');
    expect(intentText({ kind: 'hold' })).toBe('WACHT');
    expect(intentText({ kind: 'hold' })).not.toBe(intentText({ kind: 'cool' }));
  });
});

describe('the warning that a shot will overheat', () => {
  /** Whether the weapon's shot is warned of once it is picked, and what the bar at the top then says. */
  function aimed(core: string, heat: number): { warned: boolean; message: string } {
    const { screen, flow } = shown(battle(core, heat));
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    return { warned: flow.overheatWarning, message: flow.message };
  }

  test('is given where the shot would take the machine past its own limit, and not before', () => {
    // The weapon makes thirty heat.
    expect([70, 71].map((heat) => aimed(stock.id, heat).warned)).toEqual([false, true]);
    expect([70, 71, 100, 101].map((heat) => aimed(HOT.id, heat).warned)).toEqual([false, false, false, true]);
    expect(aimed(HOT.id, 101).message).toBe(STRINGS.overheatWarning);
    expect(aimed(HOT.id, 100).message).not.toBe(STRINGS.overheatWarning);
  });

  test('and the bar is red while it is given, whatever the heat', () => {
    const at = (core: string, heat: number): string => {
      const { screen, page } = shown(battle(core, heat));
      screen.onInput('confirm');
      screen.onInput('confirm');
      return heatRow(page()).color;
    };
    expect(at(stock.id, 71)).toBe(COLORS.danger);
    expect(at(HOT.id, 71)).toBe(COLORS.heat);
  });

  test('what is said after a battle lost to heat names no figure: the bar is as long as the machine\'s own limit', () => {
    expect(STRINGS.advice.heat).toBe('You overheated and lost a turn. Vent before the heat bar is full.');
    expect(/\d/.test(STRINGS.advice.heat)).toBe(false);
    setLanguage('nl');
    expect(/\d/.test(STRINGS.advice.heat)).toBe(false);
  });
});

describe('what a buffer kept', () => {
  test('is said over the machine as its next turn opens, in the colour of energy, and the energy figure is more than a turn gives', () => {
    const { screen, flow, page } = shown(battle(DEEP.id), false);
    const turn = turnEnergyOf(player(flow.state), WORKS);
    // One shot of forty, and the turn is ended with the rest unspent.
    screen.onInput('confirm');
    screen.onInput('confirm');
    screen.onInput('confirm');
    const seen = new Map<string, string>();
    const watch = (): void => { for (const t of page().texts) if (/^\+\d+ EN$/.test(t.text)) seen.set(t.text, t.color); };
    for (let i = 0; i < 3000 && flow.phase !== 'action'; i++) screen.update(16);
    expect(player(flow.state).energy).toBe(turn - WARM.energy);
    expect(seen.size).toBe(0);
    for (let guard = 0; guard < 12 && flow.menu.items[flow.menu.cursor].id !== 'endTurn'; guard++) screen.onInput('down');
    expect(flow.menu.items[flow.menu.cursor].id).toBe('endTurn');
    screen.onInput('confirm');
    for (let i = 0; i < 6000 && (flow.phase !== 'action' || flow.state.round < 2); i++) { screen.update(16); watch(); }
    const kept = Math.floor(turn / 2);
    // Half a turn is what the core holds: the rest of what was left is gone.
    expect(turn - WARM.energy).toBeGreaterThan(kept);
    expect([...seen]).toEqual([[STRINGS.fx.kept(kept), COLORS.energy]]);
    expect(player(flow.state).energy).toBe(turn + kept);
    const label = page().texts.find((t) => t.text === STRINGS.meters.energy)!;
    const figure = page().texts.find((t) => t.y === label.y && t.align === 'right' && t.x > label.x)!;
    expect(figure.text).toBe(String(turn + kept));
  });

  test('a machine without one says nothing as its turn opens', () => {
    const { screen, flow, page } = shown(battle(stock.id), false);
    for (let guard = 0; guard < 12 && flow.menu.items[flow.menu.cursor].id !== 'endTurn'; guard++) screen.onInput('down');
    expect(flow.menu.items[flow.menu.cursor].id).toBe('endTurn');
    screen.onInput('confirm');
    let said = 0;
    for (let i = 0; i < 6000 && (flow.phase !== 'action' || flow.state.round < 2); i++) {
      screen.update(16);
      said += page().texts.filter((t) => /^\+\d+ EN$/.test(t.text)).length;
    }
    expect(flow.state.round).toBe(2);
    expect(said).toBe(0);
  });
});

describe('the line of each core, in the shop and the garage', () => {
  test.each(['en', 'nl'] as const)('says what the core does, under its figures, inside the room a line has (%s)', (language) => {
    setLanguage(language);
    const I = STRINGS.partInfo;
    expect(I.heatLimit(130)).toBe(language === 'en' ? 'RUNS HOT: heat limit 130' : 'HEET: hittegrens 130');
    expect(I.buffer).toBe(language === 'en' ? 'BUFFER: keeps unspent EN' : 'BUFFER: houdt EN over');
    expect(I.bufferMost(50)).toBe(language === 'en' ? 'Up to 50% of a turn' : 'Tot 50% van een beurt');
    const plain = partLines(stock);
    // One line more for a limit, two for a buffer, after everything a core says anyway.
    expect(partLines(HOT)).toEqual([...plain, I.heatLimit(130)]);
    expect(partLines(DEEP)).toEqual([...plain, I.buffer, I.bufferMost(50)]);
    for (const line of [...partLines(HOT), ...partLines(DEEP)]) expect(line.length, line).toBeLessThanOrEqual(PART_LINE_CHARS);
    // The cores that are sold say what the test's cores say.
    expect(partLines(CATALOG['core-sirocco'])).toContain(I.heatLimit(130));
    expect(partLines(CATALOG['core-solstice'])).toEqual(expect.arrayContaining([I.buffer, I.bufferMost(50)]));
    // And no other part says either.
    const others = Object.values(CATALOG).filter((part) => !['core-sirocco', 'core-solstice'].includes(part.id));
    for (const part of others) {
      expect(partLines(part).some((line) => line === I.buffer || line.startsWith(I.heatLimit(130).split(':')[0])), part.id).toBe(false);
    }
  });
});
