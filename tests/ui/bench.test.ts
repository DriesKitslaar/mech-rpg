import { createBattle } from '../../src/core/battle';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { mirrorEnemy } from '../../src/core/arena';
import { buy, equip, sell, type GameState } from '../../src/core/game';
import { tunedCatalog } from '../../src/core/tuning';
import type { FramePart, Generator, Weapon } from '../../src/core/types';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { GarageFlow } from '../../src/ui/garageFlow';
import { record } from '../helpers/canvas';
import { accept, done, fresh, inHub, medalPay, press, savedGame, select, snap, strong } from '../helpers/app';

const core = CATALOG['core-hauler'] as FramePart;
const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const generator = CATALOG['gen-kd1'] as Generator;
type Bench = { id: string; name: string; step: number; cap: number; figure: string; now: number; next: number; cost: number; refusal: string | null };
const garage = (app: Parameters<typeof snap>[0]) => snap(app).garage as { mode: string; candidate: string | null; bench?: Bench };
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

  test('in Dutch it is the werkbank', () => {
    try {
      const base = rich();
      const { app } = inHub({ ...base, settings: { ...base.settings, language: 'nl' } });
      const had = snap(app).credits;
      toParts(app, 'core');
      expect(record((ctx) => app.draw(ctx)).texts.map((t) => t.text)).toContain('R1: WERKBANK');
      press(app, 'next', 'confirm', 'confirm');
      const said = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
      expect(said).toEqual(expect.arrayContaining(['DE WERKBANK', 'Stap 2 van 2', 'Niet verder deze ronde', 'Terug', `Je hebt ${had - 3 * core.price + FIRST} c`]));
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
