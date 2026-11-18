import { createBattle } from '../../src/core/battle';
import { computeBuildStats, impactOf, validatePlayerBuild } from '../../src/core/build';
import { mirrorEnemy } from '../../src/core/arena';
import { buy, equip, sell, type GameState } from '../../src/core/game';
import { tunable, tunedCatalog, tunedPart } from '../../src/core/tuning';
import type { FramePart, Generator, Weapon } from '../../src/core/types';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { DRILLS } from '../../src/content/drills';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { GarageFlow } from '../../src/ui/garageFlow';
import { COMPARE_LINE_CHARS, PART_LINE_CHARS, compareParts, partLines } from '../../src/ui/partInfo';
import { COLORS } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';
import { JUGGERNAUT, accept, done, finishBattle, fresh, inHub, medalPay, press, savedGame, select, snap, strong } from '../helpers/app';

const core = CATALOG['core-hauler'] as FramePart;
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const generator = CATALOG['gen-kd1'] as Generator;
type Bench = { id: string; name: string; step: number; cap: number; figure: string; now: number; next: number; cost: number; refusal: string | null };
const garage = (app: Parameters<typeof snap>[0]) => snap(app).garage as { mode: string; candidate: string | null; errors: string[]; bench?: Bench };
const rich = (extra: Partial<GameState> = {}): GameState => ({ ...fresh(), credits: 50_000, ...extra });
/** The first step a pilot ever has taken earns a medal, and a medal pays. */
const FIRST = medalPay(['bench-1']);
/** Into the garage and onto the list of parts for a slot. */
function toParts(app: Parameters<typeof snap>[0], slot: string): void {
  select(app, 'garage');
  select(app, slot);
  expect(garage(app).mode).toBe('parts');
}

describe('the bench, in the garage', () => {
  test('R1 on a part puts it on the bench: where it stands, what a step would make of it, and what the step costs', () => {
    const { app } = inHub(rich());
    toParts(app, 'core');
    expect(garage(app).candidate).toBe('core-hauler');
    press(app, 'next');
    expect(garage(app)).toMatchObject({
      mode: 'bench',
      bench: { id: 'core-hauler', name: core.name, step: 0, cap: 2, figure: 'armour', now: core.ap, next: Math.round(core.ap * 1.05), cost: core.price, refusal: null },
    });
    expect(snap(app).menu).toEqual({
      items: [{ id: 'tune', label: 'Tune to +1', enabled: true, note: `${core.price} c` }, { id: 'back', label: 'Back', enabled: true }],
      cursor: 0,
    });
  });

  test('a step is paid for, saved at once, and shown wherever the part is named', () => {
    const { app, store } = inHub(rich());
    const had = snap(app).credits;
    toParts(app, 'core');
    press(app, 'next', 'confirm');
    expect(snap(app).credits).toBe(had - core.price + FIRST);
    expect(savedGame(store).tuning).toEqual({ 'core-hauler': 1 });
    expect(savedGame(store).credits).toBe(had - core.price + FIRST);
    expect(savedGame(store).medals).toContain('bench-1');
    // Still on the bench, one step on: the next costs twice the price.
    expect(garage(app).bench).toMatchObject({ name: `${core.name} +1`, step: 1, now: Math.round(core.ap * 1.05), next: Math.round(core.ap * 1.1), cost: 2 * core.price });
    expect(snap(app).menu.items[0]).toEqual({ id: 'tune', label: 'Tune to +2', enabled: true, note: `${2 * core.price} c` });
    // Back among the parts the step stands beside it; among the slots it follows the name.
    press(app, 'cancel');
    expect(garage(app).mode).toBe('parts');
    expect(snap(app).menu.items.find((item) => item.id === 'core-hauler')).toMatchObject({ label: `${core.name} *`, note: '+1' });
    press(app, 'cancel');
    expect(snap(app).menu.items.find((item) => item.id === 'core')!.note).toBe(`${core.name} +1`);
  });

  test('goes as far as the cycle allows and then says so: the way on is closed and the cursor is on the way back', () => {
    const { app, store } = inHub(rich());
    const had = snap(app).credits;
    toParts(app, 'core');
    press(app, 'next', 'confirm', 'confirm');
    expect(savedGame(store).tuning).toEqual({ 'core-hauler': 2 });
    expect(garage(app).bench).toMatchObject({ step: 2, cap: 2, refusal: 'limit' });
    expect(snap(app).menu).toEqual({ items: [{ id: 'tune', label: 'No further this cycle', enabled: false }, { id: 'back', label: 'Back', enabled: true }], cursor: 1 });
    // Confirming there leaves the bench, and nothing more was paid.
    press(app, 'confirm');
    expect(garage(app).mode).toBe('parts');
    expect(snap(app).credits).toBe(had - 3 * core.price + FIRST);
  });

  test('a later cycle goes one step further, and the fifth step is the last there is', () => {
    const later = inHub(rich({ cycle: 1, tuning: { 'core-hauler': 2 } })).app;
    toParts(later, 'core');
    press(later, 'next');
    expect(garage(later).bench).toMatchObject({ step: 2, cap: 3, refusal: null });
    const last = inHub(rich({ cycle: 6, tuning: { 'core-hauler': 5 } })).app;
    toParts(last, 'core');
    press(last, 'next');
    expect(garage(last).bench).toMatchObject({ step: 5, cap: 5, refusal: 'limit' });
    expect(snap(last).menu.items[0]).toEqual({ id: 'tune', label: 'As far as it goes', enabled: false });
  });

  test('without the money the step is shown with its price and cannot be taken', () => {
    const { app, store } = inHub(rich({ credits: core.price - 1 }));
    toParts(app, 'core');
    press(app, 'next');
    expect(garage(app).bench).toMatchObject({ refusal: 'credits', cost: core.price });
    expect(snap(app).menu).toEqual({ items: [{ id: 'tune', label: 'Tune to +1', enabled: false, note: `${core.price} c` }, { id: 'back', label: 'Back', enabled: true }], cursor: 1 });
    press(app, 'up', 'confirm');
    expect(savedGame(store).tuning).toBeUndefined();
    expect(snap(app).credits).toBe(core.price - 1);
  });

  test('the first step a pilot ever takes pays a medal, and that pay counts at once towards the next step', () => {
    // What loading this game pays in medals to a pilot with little, so that the pilot below has exactly what is meant.
    const paid = snap(inHub(rich({ credits: 1000 })).app).credits! - 1000;
    // Enough for the first step, and for the second only with what the medal for the first one pays.
    const { app, store } = inHub(rich({ credits: 3 * core.price - FIRST - paid }));
    expect(snap(app).credits).toBe(3 * core.price - FIRST);
    toParts(app, 'core');
    press(app, 'next', 'confirm');
    expect(snap(app).credits).toBe(2 * core.price);
    // The way on is open and the cursor is on it: nothing says the money is short.
    expect(snap(app).menu).toEqual({
      items: [{ id: 'tune', label: 'Tune to +2', enabled: true, note: `${2 * core.price} c` }, { id: 'back', label: 'Back', enabled: true }],
      cursor: 0,
    });
    expect(garage(app).bench).toMatchObject({ step: 1, refusal: null });
    expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).not.toContain('Not enough credits');
    press(app, 'confirm');
    expect(savedGame(store).tuning).toEqual({ 'core-hauler': 2 });
    expect(snap(app).credits).toBe(0);
  });

  test('a pilot one credit short of that second step is told so, and the cursor is on the way back', () => {
    const paid = snap(inHub(rich({ credits: 1000 })).app).credits! - 1000;
    const { app } = inHub(rich({ credits: 3 * core.price - FIRST - paid - 1 }));
    toParts(app, 'core');
    press(app, 'next', 'confirm');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'tune', enabled: false });
    expect(snap(app).menu.cursor).toBe(1);
    expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).toContain('Not enough credits');
  });

  test('takes a weapon and a generator as well, each by its own figure', () => {
    const { app } = inHub(rich());
    toParts(app, 'rightHand');
    press(app, 'next');
    expect(garage(app).bench).toMatchObject({ id: 'wpn-rivet-rifle', figure: 'damage', now: rifle.damage, next: Math.round(rifle.damage * 1.05 * 10) / 10 });
    press(app, 'cancel', 'cancel');
    select(app, 'generator');
    press(app, 'next');
    expect(garage(app).bench).toMatchObject({ id: 'gen-kd1', figure: 'output', now: generator.output, next: generator.output + Math.round(generator.output * 0.05) });
  });

  test('does not take a booster, fire control, or nothing at all: R1 does nothing there', () => {
    const { app } = inHub(rich());
    for (const slot of ['booster', 'fcs']) {
      toParts(app, slot);
      press(app, 'next');
      expect(garage(app).mode, slot).toBe('parts');
      press(app, 'cancel', 'cancel');
    }
    // An empty hand: the first row is "(none)".
    toParts(app, 'leftHand');
    press(app, 'next');
    expect(garage(app).mode).toBe('parts');
  });

  test('takes a part that is owned and not fitted', () => {
    const { app, store } = inHub(buy(rich(), 'core-bulwark', CATALOG));
    toParts(app, 'core');
    select(app, 'core-hauler');
    select(app, 'core');
    // The cursor is on the fitted core; the other one is the row below or above it.
    const at = snap(app).menu.items.findIndex((item) => item.id === 'core-bulwark');
    for (let i = 0; i < 6 && snap(app).menu.cursor !== at; i++) press(app, 'down');
    press(app, 'next', 'confirm');
    expect(savedGame(store).tuning).toEqual({ 'core-bulwark': 1 });
    expect(savedGame(store).build.core).toBe('core-hauler');
  });

  test('is drawn with the part, its step, the figure as it is and as it would be, the choice, and what the pilot has', () => {
    const { app } = inHub(rich());
    const had = snap(app).credits;
    toParts(app, 'core');
    // On a part the bench takes, the foot of the panel says which button puts it there.
    expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).toContain('R1: THE BENCH');
    press(app, 'next', 'confirm');
    const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(said).toEqual(expect.arrayContaining([
      'THE BENCH', `${core.name} +1`, 'Step 1 of 2', `Armour ${Math.round(core.ap * 1.05)}`, `> ${Math.round(core.ap * 1.1)}`, 'Tune to +2',
      `${2 * core.price} c`, 'Back', `You have ${had - core.price + FIRST} c`,
    ]));
    expect(said).not.toContain('Not enough credits');
  });

  test('says why not when the money is short, and has no hint for a part it does not take', () => {
    const poor = inHub(rich({ credits: 10 })).app;
    toParts(poor, 'core');
    press(poor, 'next');
    expect(record((ctx) => poor.draw(ctx)).texts.map((t) => t.text)).toEqual(expect.arrayContaining(['Not enough credits', 'You have 10 c']));
    const { app } = inHub(rich());
    toParts(app, 'booster');
    expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).not.toContain('R1: THE BENCH');
  });

  test('the hint for the bench stands over the list of parts, where a build that may not leave does not hide it', () => {
    // A core too heavy for the legs: the foot of the screen then says what is wrong, in large letters.
    const base = fresh();
    const heavy = Object.values(CATALOG).find((part) =>
      part.vendor && part.kind === 'core' && validatePlayerBuild({ ...base.build, core: part.id }, CATALOG).includes('overweight'))!;
    const game = sell(equip(buy({ ...base, credits: 99_999 }, heavy.id, CATALOG), 'core', heavy.id, CATALOG), base.build.core, CATALOG);
    for (const [name, saved] of [['sound', rich()], ['overweight', game]] as const) {
      const { app } = inHub(saved);
      toParts(app, 'core');
      const texts = record((ctx) => app.draw(ctx)).texts;
      const hint = texts.find((t) => t.text === 'R1: THE BENCH')!;
      expect(hint, name).toBeDefined();
      const slot = texts.find((t) => t.text === STRINGS.slots.core.toUpperCase())!;
      // On the line of the slot's name, at the right of the panel, clear of that name and of the edge of the screen.
      expect(hint.y, name).toBeGreaterThanOrEqual(slot.y);
      expect(hint.y, name).toBeLessThanOrEqual(slot.y + 2);
      expect(hint.left, name).toBeGreaterThan(slot.right + 8);
      expect(hint.right, name).toBeLessThanOrEqual(310 - 6);
      if (name === 'overweight') expect(texts.map((t) => t.text)).toContain(STRINGS.buildErrors.overweight);
    }
  });

  test('in Dutch it is the werkbank', () => {
    try {
      const base = rich();
      const { app } = inHub({ ...base, settings: { ...base.settings, language: 'nl' } });
      const had = snap(app).credits;
      toParts(app, 'core');
      expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).toContain('R1: WERKBANK');
      press(app, 'next', 'confirm', 'confirm');
      const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
      // A cycle is a cyclus in the Dutch game, and a ronde is a round of a battle: the bench's limit is the cycle's.
      expect(said).toEqual(expect.arrayContaining(['DE WERKBANK', 'Stap 2 van 2', 'Niet verder deze cyclus', 'Terug', `Je hebt ${had - 3 * core.price + FIRST} c`]));
      expect(said).not.toContain('Niet verder deze ronde');
      expect(said.some((text) => text.startsWith('Pantser '))).toBe(true);
    } finally {
      setLanguage('en');
    }
  });
});

describe('what the garage shows of a tuned mech', () => {
  const tuning = { 'core-hauler': 2, 'legs-strider': 1, 'gen-kd1': 2, 'wpn-rivet-rifle': 2 };

  test('the panel reads the build as tuned: its armour and the energy of a turn', () => {
    const plain = new GarageFlow(fresh(), CATALOG);
    const tuned = new GarageFlow({ ...fresh(), tuning }, CATALOG);
    const ap = (id: string): number => (CATALOG[id] as FramePart).ap;
    expect(tuned.armour(STARTER_BUILD) - plain.armour(STARTER_BUILD))
      .toBe(Math.round(ap('core-hauler') * 1.1) - ap('core-hauler') + Math.round(ap('legs-strider') * 1.05) - ap('legs-strider'));
    expect(tuned.stats.turnEnergy).toBe(plain.stats.turnEnergy + Math.round(generator.output * 0.1));
    // The part's own lines are read from the same view.
    expect((tuned.partOf('wpn-rivet-rifle') as Weapon).damage).toBe(Math.round(rifle.damage * 1.1 * 10) / 10);
    expect(tuned.partOf('bst-stock')).toBe(CATALOG['bst-stock']);
    expect(tuned.partOf('no-such-part')).toBeUndefined();
  });

  test('after a step the garage shows the mech as the bench just left it: the part\'s own lines, and the armour of the whole', () => {
    const { app } = inHub(rich());
    toParts(app, 'core');
    const shown = (): { line: string; armour: number } => {
      const texts = record((ctx) => app.draw(ctx)).texts;
      const label = texts.find((t) => t.text === STRINGS.garage.armour)!;
      const value = texts.find((t) => t.y === label.y && t.align === 'right' && t.x > label.x && t.x < label.x + 100)!;
      return { line: texts.map((t) => t.text).find((text) => text.startsWith(`${STRINGS.partInfo.ap} `))!, armour: Number(value.text) };
    };
    const before = shown();
    expect(before.line.startsWith(`AP ${core.ap} `)).toBe(true);
    // Onto the bench, one step, and back to the list of parts: nothing was left and come back to.
    press(app, 'next', 'confirm', 'cancel');
    expect(garage(app).mode).toBe('parts');
    const after = shown();
    expect(after.line.startsWith(`AP ${Math.round(core.ap * 1.05)} `)).toBe(true);
    expect(after.armour).toBe(before.armour + Math.round(core.ap * 1.05) - core.ap);
  });

  test('the garage itself judges whether a build may leave by its parts as the bench left them', () => {
    const stats = computeBuildStats(STARTER_BUILD, CATALOG);
    const weak = { ...CATALOG, 'gen-kd1': { ...generator, output: generator.output - stats.turnEnergy + rifle.energy - 1 } };
    const inGarage = (game: GameState): { errors: string[]; said: string[] } => {
      const { app } = inHub(game, 5, { catalog: weak });
      select(app, 'garage');
      return { errors: garage(app).errors, said: record((ctx) => app.draw(ctx)).texts.map((t) => t.text) };
    };
    const plain = inGarage(fresh());
    expect(plain.errors).toEqual(['insufficientEnergy']);
    expect(plain.said).toContain(STRINGS.buildErrors.insufficientEnergy);
    const tuned = inGarage({ ...fresh(), tuning: { 'gen-kd1': 1 } });
    expect(tuned.errors).toEqual([]);
    expect(tuned.said).not.toContain(STRINGS.buildErrors.insufficientEnergy);
    // A part looked at in the list is judged the same way before it is fitted.
    const flow = new GarageFlow({ ...fresh(), tuning: { 'gen-kd1': 1 } }, weak);
    expect(flow.previewErrors).toEqual([]);
    expect(new GarageFlow(fresh(), weak).previewErrors).toEqual(['insufficientEnergy']);
  });

  test('a build that is short of energy as the factory made it may deploy once its generator has been on the bench', () => {
    // A catalogue in which the stock generator gives one point less than the rifle takes to fire.
    const stats = computeBuildStats(STARTER_BUILD, CATALOG);
    const weak = { ...CATALOG, 'gen-kd1': { ...generator, output: generator.output - stats.turnEnergy + rifle.energy - 1 } };
    expect(validatePlayerBuild(STARTER_BUILD, weak)).toEqual(['insufficientEnergy']);
    expect(validatePlayerBuild(STARTER_BUILD, tunedCatalog(weak, { 'gen-kd1': 1 }))).toEqual([]);
    // The game says the same, and so the contracts are on offer: what the garage shows is what deploys.
    expect(inHub(fresh(), 5, { catalog: weak }).app.buildErrors()).toEqual(['insufficientEnergy']);
    const { app } = inHub({ ...fresh(), tuning: { 'gen-kd1': 1 } }, 5, { catalog: weak });
    expect(app.buildErrors()).toEqual([]);
    accept(app, 'intro-1');
    expect(snap(app).screen).toBe('battle');
  });
});

describe('a tuned mech in a battle', () => {
  const frame = ['head-scout-mk1', 'core-hauler', 'arms-rigger', 'legs-strider'];
  const tuning = Object.fromEntries(frame.map((id) => [id, 2]));
  const total = (factor: number): number => frame.reduce((sum, id) => sum + Math.round((CATALOG[id] as FramePart).ap * factor), 0);

  test('the pilot\'s own mech flies as the bench left it', () => {
    const plain = inHub(fresh()).app;
    accept(plain, 'intro-1');
    expect(snap(plain).player!.maxAp).toBe(total(1));
    const { app } = inHub({ ...fresh(), tuning });
    accept(app, 'intro-1');
    expect(snap(app).player!.maxAp).toBe(total(1.1));
  });

  test('every battle of a contract is flown as the bench left the mech, not only the first', () => {
    const heavy = Object.fromEntries(Object.values(JUGGERNAUT).map((id) => [id, 2]));
    const worn = [JUGGERNAUT.head, JUGGERNAUT.core, JUGGERNAUT.arms, JUGGERNAUT.legs].reduce((sum, id) => sum + Math.round((CATALOG[id] as FramePart).ap * 1.1), 0);
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), tuning: heavy });
    accept(app, 'hadron-1');
    expect(snap(app).battle).toMatchObject({ mission: 'hadron-1', index: 0, of: 2 });
    expect(snap(app).player!.maxAp).toBe(worn);
    finishBattle(app);
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ mission: 'hadron-1', index: 1, of: 2 });
    expect(snap(app).player!.maxAp).toBe(worn);
  });

  test('the mech of a drill is the simulator\'s own: a pilot\'s work on the same parts does not go into it', () => {
    const drill = DRILLS[0];
    const armour = (game: GameState): number => {
      const { app } = inHub(game);
      select(app, 'training');
      select(app, drill.id);
      select(app, 'accept');
      expect(snap(app).screen).toBe('battle');
      return snap(app).player!.maxAp;
    };
    const base = strong(done('intro-1', 'intro-2'));
    // Every part of the drill's frame the bench takes, as far as the bench goes in a first telling.
    const frame = Object.values(drill.build).filter((id) => CATALOG[id].kind === 'core' || CATALOG[id].kind === 'legs' || CATALOG[id].kind === 'head' || CATALOG[id].kind === 'arms');
    expect(frame.length).toBe(4);
    expect(armour({ ...base, tuning: Object.fromEntries(Object.values(drill.build).filter((id) => tunable(CATALOG[id])).map((id) => [id, 2])) })).toBe(armour(base));
    expect(armour(base)).toBe(frame.reduce((sum, id) => sum + (CATALOG[id] as FramePart).ap, 0));
  });

  test('the mirror the arena fields is the pilot\'s mech as the bench left it: its armour has grown as the pilot\'s has', () => {
    const heavy = Object.fromEntries(Object.values(JUGGERNAUT).map((id) => [id, 2]));
    const fielded = (game: GameState): { mine: number; theirs: number } => {
      const { app } = inHub(game);
      select(app, 'arena');
      select(app, snap(app).menu.items.find((item) => /mirror/.test(item.id))!.id);
      select(app, 'accept');
      expect(snap(app).screen).toBe('battle');
      return { mine: snap(app).player!.maxAp, theirs: (snap(app).battle as unknown as { enemyArmour: number }).enemyArmour };
    };
    const base = { ...strong(done('intro-1', 'intro-2')), arenaRank: 5 };
    const plain = fielded(base);
    const tuned = fielded({ ...base, tuning: heavy });
    expect(tuned.mine).toBeGreaterThan(plain.mine);
    expect(tuned.theirs).toBeGreaterThan(plain.theirs);
    // Part by part a tenth more, as the pilot's own: the two have grown by the same share, to within the rounding of four parts.
    expect(Math.abs(tuned.theirs / plain.theirs - tuned.mine / plain.mine)).toBeLessThan(0.005);
  });

  test('a mech that is lent is as the factory made it, though it is made of parts the pilot has had on the bench', () => {
    // A pilot whose own mech may not deploy flies the patrol in the stock frame.
    const base = fresh();
    const heavy = Object.values(CATALOG).find((part) =>
      part.vendor && part.kind === 'core' && validatePlayerBuild({ ...base.build, core: part.id }, CATALOG).includes('overweight'))!;
    let game: GameState = { ...base, credits: 99_999 };
    game = sell(equip(buy(game, heavy.id, CATALOG), 'core', heavy.id, CATALOG), base.build.core, CATALOG);
    const { app } = inHub({ ...game, credits: 0, tuning });
    select(app, 'contracts');
    select(app, 'patrol');
    expect(snap(app).briefing).toMatchObject({ mission: 'patrol', lent: true });
    select(app, 'accept');
    const stock = createBattle(STARTER_BUILD, [], CATALOG, 1).units[0];
    expect(snap(app).player!.maxAp).toBe(Object.values(stock.parts).reduce((sum, part) => sum + part!.maxAp, 0));
  });

  test('the Gauntlet\'s frame is the same for everybody: stock parts, whatever the bench has done to the pilot\'s own', () => {
    const base = strong(done('intro-1', 'intro-2'));
    const floor = (game: GameState): number => {
      const { app } = inHub(game);
      select(app, 'gauntlet');
      select(app, 'start');
      // An open floor has two doors, a warden's floor one way down.
      select(app, snap(app).menu.items.some((item) => item.id === 'descend') ? 'descend' : 'door-0');
      expect(snap(app).screen).toBe('battle');
      return snap(app).player!.maxAp;
    };
    // The frame of a run is made of the parts a pilot starts with: exactly the ones on the bench here.
    expect(floor({ ...base, tuning })).toBe(floor(base));
  });

  test('the copy a mirror match fields is tuned as the pilot\'s mech is, and plain when the pilot\'s is', () => {
    expect(mirrorEnemy({ ...fresh(), tuning }, 'Mirror').tune).toEqual(tuning);
    expect('tune' in mirrorEnemy(fresh(), 'Mirror')).toBe(false);
    expect('tune' in mirrorEnemy({ ...fresh(), tuning: {} }, 'Mirror')).toBe(false);
    // Its own copy of the record: what is done to one is not done to the other.
    const game = { ...fresh(), tuning };
    expect(mirrorEnemy(game, 'Mirror').tune).not.toBe(game.tuning);
  });
});

describe('what the shop shows beside a tuned mech', () => {
  const colossus = CATALOG['legs-colossus'] as FramePart;
  const crawler = CATALOG['legs-crawler'] as FramePart;
  /** A pilot in the fourth telling, in the heaviest frame the shop sells, with money to spare. */
  const pilot = (tuningOf: Record<string, number> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), credits: 500_000, cycle: 3, tuning: tuningOf });
  /** Into the shop and onto a pair of legs on its shelf; what the page then says. */
  function onLegs(game: GameState, id: string) {
    const { app } = inHub(game);
    select(app, 'shop');
    for (let i = 0; i < 12 && (snap(app).shop as { tab: string }).tab !== 'legs'; i++) press(app, 'next');
    expect(snap(app).menu.items.map((item) => item.id)).toContain(id);
    for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
    // What the shelf asks for it, beside its name in the list.
    priced = snap(app).menu.items.find((item) => item.id === id)!.note;
    return record((ctx) => app.draw(ctx)).texts;
  }
  let priced: string | undefined;
  const chipOf = (texts: ReturnType<typeof onLegs>) => texts.find((t) => /^AP [+-]/.test(t.text))!;

  test('with nothing on the bench it is as it was: the treads have more armour than the legs that are worn', () => {
    const texts = onLegs(pilot(), 'legs-crawler');
    expect(crawler.ap - colossus.ap).toBe(20);
    expect(chipOf(texts)).toMatchObject({ text: 'AP +20', color: COLORS.armor });
    expect(texts.map((t) => t.text)).toContain(STRINGS.partInfo.versus(colossus.name));
    expect(texts.map((t) => t.text)).toContain(crawler.name);
  });

  test('a part is held against what is worn as the bench left it: what looks better on the shelf can be worse than what is on the mech', () => {
    const texts = onLegs(pilot({ 'legs-colossus': 5 }), 'legs-crawler');
    // The legs that are worn have a quarter more armour than the factory gave them: the treads would take fifty off, not add twenty.
    expect(crawler.ap - Math.round(colossus.ap * 1.25)).toBe(-50);
    expect(chipOf(texts)).toMatchObject({ text: 'AP -50', color: COLORS.danger });
    // And it says which legs it is holding them against: the ones with the work in them.
    expect(texts.map((t) => t.text)).toContain(STRINGS.partInfo.versus(`${colossus.name} +5`));
    const closer = onLegs(pilot({ 'legs-colossus': 2 }), 'legs-crawler');
    expect(chipOf(closer)).toMatchObject({ text: `AP ${crawler.ap - Math.round(colossus.ap * 1.1)}`, color: COLORS.danger });
  });

  test('a part the pilot has had on the bench before is shown as it would come back: the work is in the model, and the shelf says so', () => {
    // Never owned now, but worked on once: bought again, it has the armour the bench gave it.
    const texts = onLegs(pilot({ 'legs-crawler': 3 }), 'legs-crawler');
    const tuned = Math.round(crawler.ap * 1.15);
    // On its page, that is: the row in the list is the shelf's label, and stays as printed.
    const page = texts.filter((t) => t.x > 168).map((t) => t.text);
    expect(page).toContain(`${crawler.name} +3`);
    expect(page).not.toContain(crawler.name);
    expect(texts.filter((t) => t.x <= 168).map((t) => t.text)).toContain(crawler.name);
    expect(texts.some((t) => t.text.startsWith(`${STRINGS.partInfo.ap} ${tuned}`))).toBe(true);
    expect(chipOf(texts)).toMatchObject({ text: `AP +${tuned - colossus.ap}`, color: COLORS.armor });
    // What it costs is what it always cost: the bench's work was paid for at the bench.
    const asked = priced;
    onLegs(pilot(), 'legs-crawler');
    expect(asked).toBe(priced);
    expect(asked).toBe(String(crawler.price));
  });
});

describe('what a step does not change', () => {
  const weapons = Object.values(CATALOG).filter((part): part is Weapon => part.kind === 'weapon');

  test('a tuned weapon pushes as hard as it did: the garage shows the impact the battle gives, whatever the step', () => {
    expect(weapons.length).toBeGreaterThan(30);
    for (const weapon of weapons) {
      for (const step of [1, 3, 5]) {
        const shown = tunedCatalog(CATALOG, { [weapon.id]: step })[weapon.id] as Weapon;
        expect(impactOf(shown), `${weapon.id} +${step}`).toBe(impactOf(weapon));
        expect(partLines(shown)[1], `${weapon.id} +${step}`).toBe(partLines(weapon)[1]);
        // The damage is what grew, and nothing else on its lines.
        expect(shown.damage, weapon.id).toBeGreaterThan(weapon.damage);
        expect(partLines(shown).slice(2), weapon.id).toEqual(partLines(weapon).slice(2));
      }
    }
    // Among them are weapons whose push is worked out from their damage: those are the ones a careless view would inflate.
    expect(weapons.filter((weapon) => weapon.impact === undefined).length).toBeGreaterThan(20);
  });
});

describe('the lines of a part the bench has worked on', () => {
  const parts = Object.values(CATALOG).filter(tunable);
  const weapons = parts.filter((part): part is Weapon => part.kind === 'weapon');

  test.each(['en', 'nl'] as const)('fit the panel of the garage and of the shop at every step (%s)', (language) => {
    setLanguage(language);
    try {
      for (const part of parts) {
        for (let step = 0; step <= 5; step++) {
          for (const line of partLines(tunedPart(part, step))) expect(line.length, `${part.id} +${step}: ${line}`).toBeLessThanOrEqual(PART_LINE_CHARS);
        }
      }
    } finally {
      setLanguage('en');
    }
  });

  test('a figure of a hundred or more is shown whole, and a smaller one to a tenth: every step of every weapon shows', () => {
    for (const weapon of weapons) {
      let last = '';
      for (let step = 0; step <= 5; step++) {
        const said = /DMG (\S+)/.exec(partLines(tunedPart(weapon, step))[0])![1];
        expect(said, `${weapon.id} +${step}`).toMatch(weapon.damage * (1 + 0.05 * step) >= 100 ? /^\d{3,}$/ : /^\d{1,2}(\.\d)?$/);
        expect(said, `${weapon.id} +${step}`).not.toBe(last);
        last = said;
      }
    }
  });

  test.each(['en', 'nl'] as const)('what sets two parts apart is said in figures with one decimal at most, in rows that fit (%s)', (language) => {
    setLanguage(language);
    try {
      for (const mine of weapons) {
        for (const theirs of weapons) {
          if (mine.id === theirs.id) continue;
          for (const [a, b] of [[5, 0], [0, 3], [1, 2]]) {
            for (const row of compareParts(tunedPart(mine, a), tunedPart(theirs, b))) {
              expect(row.reduce((sum, chip) => sum + chip.text.length + 2, -2), `${mine.id} +${a} against ${theirs.id} +${b}`).toBeLessThanOrEqual(COMPARE_LINE_CHARS);
              for (const chip of row) expect(chip.text, `${mine.id} +${a} against ${theirs.id} +${b}`).toMatch(/ [+-]\d+(\.\d)?%?$/);
            }
          }
        }
      }
    } finally {
      setLanguage('en');
    }
  });

  test('a saved build that lacks a part names the part and not the work in it, so the line fits in both languages', () => {
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      try {
        const longest = parts.reduce((a, b) => (b.name.length > a.name.length ? b : a));
        // A build saved with the part, the part since sold, the bench's work still on its model.
        const base = fresh();
        const flow = new GarageFlow({ ...base, cycle: 3, tuning: { [longest.id]: 5 }, loadouts: [{ ...base.build, [longest.kind === 'weapon' ? 'rightHand' : longest.kind]: longest.id }, ...base.loadouts.slice(1)] }, CATALOG);
        // To the saved builds, and onto the first of them.
        flow.onInput('right');
        flow.onInput('confirm');
        expect(flow.mode).toBe('loadoutMenu');
        const note = flow.loadoutMenu.items[0].note!;
        expect(note).toBe(STRINGS.garage.missing(longest.name));
        // The garage writes it from 168 dots in, at 4.8 dots a letter, and the screen is 310 wide.
        expect(168 + note.length * 4.8, note).toBeLessThanOrEqual(310 - 2);
        expect(168 + STRINGS.garage.missing(`${longest.name} +5`).length * 4.8).toBeGreaterThan(language === 'nl' ? 310 : 300);
      } finally {
        setLanguage('en');
      }
    }
  });
});
