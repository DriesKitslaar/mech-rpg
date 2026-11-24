import { archetypeOf } from '../../src/core/archetype';
import { generateBoard } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { isValidState, type GameState } from '../../src/core/game';
import { advance, counted, newCount, type Forecast, type Nearness } from '../../src/core/forecast';
import { STAKES, bondFor } from '../../src/core/stakes';
import { BOARD_TEXT } from '../../src/content/board';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { forfeitToast, type App } from '../../src/ui/app';
import { BRIEFING_CHARS, BRIEFING_HOLD_MS, TERMS_WAIT_MS } from '../../src/ui/briefingScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS, LINE, wrap } from '../../src/ui/widgets';
import { JUGGERNAUT, done, finishBattle, finishMission, inHub, makeApp, medalPay, press, retreat, savedGame, select, snap, strong } from '../helpers/app';
import { record, type Drawn, type Written } from '../helpers/canvas';

afterEach(() => setLanguage('en'));

/** A pilot past the introductions with a machine that wins, thirty-three contracts in: the board is at its fullest, and there is money for any bond. */
const pilot = (more: Partial<GameState> = {}): GameState => ({
  ...strong(done('intro-1', 'intro-2')), scenes: ['act-1', 'talk-kite'], choices: { kite: 'pass' }, battlesWon: 33, credits: 60_000, ...more,
});
const open = (app: App): Mission[] => app.missions().filter((mission) => mission.id.startsWith('open-'));
/** The lightest contract of the board: a single fight. */
const light = (app: App): Mission => open(app)[0];
const bill = (app: App): Settlement & { won: boolean } => snap(app).settlement as unknown as Settlement;
const scale = (app: App): number => snap(app).battle!.enemyScale;

describe('a contract flown on raised terms', () => {
  test('is flown against more: the opposition as the terms multiply it, and the bond written down as staked', () => {
    const plain = inHub(pilot());
    plain.app.startMission(light(plain.app).id);
    const standard = scale(plain.app);
    expect(savedGame(plain.store).atStake).toBeUndefined();
    for (const level of [1, 2, 3]) {
      const { app, store } = inHub(pilot());
      const row = light(app);
      const held = savedGame(store).credits;
      app.startMission(row.id, false, null, false, null, level);
      expect(snap(app).screen).toBe('battle');
      expect(scale(app), String(level)).toBeCloseTo(standard * STAKES[level], 5);
      expect(savedGame(store).atStake, String(level)).toBe(bondFor(row.reward, level));
      // Nothing has been paid or taken yet: the bond is staked, not spent.
      expect(savedGame(store).credits).toBe(held);
    }
  });

  test('won, it pays the fee and what the terms add to it; the bond was never touched', () => {
    const { app, store } = inHub(pilot());
    const row = light(app);
    const before = savedGame(store);
    app.startMission(row.id, false, null, false, null, 2);
    finishMission(app);
    const settled = bill(app);
    expect(settled.won).toBe(true);
    expect(settled.hazard).toEqual({ level: 2, pay: row.reward });
    expect(settled.bond).toBeNull();
    const after = savedGame(store);
    // The balance is the balance before and the bill's net (and what a medal earned with it paid).
    expect(after.credits).toBe(before.credits + settled.net + medalPay(after.medals.filter((id) => !before.medals.includes(id))));
    expect(after.atStake).toBeUndefined();
    expect(after.raised).toEqual([0, 1, 0]);
    // It is a contract won like any other: the board turns on it.
    expect(after.battlesWon).toBe(before.battlesWon + 1);
    expect(isValidState(JSON.parse(JSON.stringify(after)), CATALOG)).toBe(true);
  });

  test('walked away from, the bond is on the bill and off the balance', () => {
    const { app, store } = inHub(pilot());
    const row = light(app);
    const held = savedGame(store).credits;
    app.startMission(row.id, false, null, false, null, 2);
    retreat(app);
    const settled = bill(app);
    expect(settled.won).toBe(false);
    expect(settled.bond).toEqual({ level: 2, lost: row.reward });
    expect(settled.hazard).toBeNull();
    // Nothing was earned: the bill is what the flight cost, and the bond.
    expect(settled.reward).toBe(0);
    expect(settled.net).toBe(-settled.ammoCost - settled.repairCost - row.reward);
    const after = savedGame(store);
    const before = inHub(pilot()).store;
    // (A medal earned as it was booked pays beside the bill.)
    expect(after.credits).toBe(held + settled.net + medalPay(after.medals.filter((id) => !savedGame(before).medals.includes(id))));
    expect(after.atStake).toBeUndefined();
    expect(after.raised).toBeUndefined();
    expect(after.battlesWon).toBe(33);
  });

  test('closed in the air and opened again, the bond is taken once, and said once', () => {
    const { app, store } = inHub(pilot());
    const row = light(app);
    const held = savedGame(store).credits;
    app.startMission(row.id, false, null, false, null, 3);
    const bond = bondFor(row.reward, 3);
    expect(savedGame(store).atStake).toBe(bond);
    // The game is closed there. Opened again: the contract was walked away from.
    const again = inHub(savedGame(store));
    const kept = savedGame(again.store);
    expect(kept.credits).toBe(held - bond);
    expect(kept.atStake).toBeUndefined();
    expect(kept.battlesWon).toBe(33);
    const announced = (app: App): (string | null)[] => [snap(app).toast, ...snap(app).toasts];
    expect(announced(again.app)).toContain('forfeit');
    expect(forfeitToast(bond)).toEqual([{ id: 'forfeit', heading: 'BOND LOST', title: `Left in the air: -${bond} c`, sound: 'entry' }]);
    expect(forfeitToast(0)).toEqual([]);
    // And opened once more: nothing is staked, nothing is taken, nothing is said of it.
    const third = inHub(savedGame(again.store));
    expect(savedGame(third.store).credits).toBe(held - bond);
    expect(announced(third.app)).not.toContain('forfeit');
  });

  test('the same in the second battle of a contract of two', () => {
    // A board whose heaviest contract runs to a second battle.
    let won = 20;
    while (generateBoard(won, 0, BOARD_TEXT)[2].battles.length < 2) won += 1;
    const { app, store } = inHub(pilot({ battlesWon: won }));
    const row = open(app)[2];
    expect(row.battles.length).toBeGreaterThanOrEqual(2);
    const held = savedGame(store).credits;
    app.startMission(row.id, false, null, false, null, 1);
    finishBattle(app);
    expect(snap(app).battle!.outcome).toBe('victory');
    press(app, 'confirm');
    expect(snap(app).battle).toMatchObject({ index: 1 });
    // The terms hold through every battle of it, and so does the stake.
    expect(scale(app)).toBeCloseTo((row.scale ?? 1) * STAKES[1], 5);
    expect(savedGame(store).atStake).toBe(bondFor(row.reward, 1));
    const again = inHub(savedGame(store));
    expect(savedGame(again.store).credits).toBe(held - bondFor(row.reward, 1));
    expect(savedGame(again.store).atStake).toBeUndefined();
  });

  test('a level whose bond is not held is not flown: the contract goes at Standard, and nothing is staked', () => {
    const probe = inHub(pilot());
    const row = light(probe.app);
    probe.app.startMission(row.id);
    const standard = scale(probe.app);
    const short = bondFor(row.reward, 2) - 1;
    const { app, store } = inHub(pilot({ credits: short }));
    // What the briefing is told of the four: which of them this pilot holds the bond of.
    expect(app.stakes(row, null)).toEqual([
      { level: 0, factor: 1, fee: row.reward, bond: 0, refusal: null },
      { level: 1, factor: 1.5, fee: row.reward, bond: bondFor(row.reward, 1), refusal: null },
      { level: 2, factor: 2, fee: row.reward, bond: bondFor(row.reward, 2), refusal: 'bond' },
      { level: 3, factor: 3, fee: row.reward, bond: bondFor(row.reward, 3), refusal: 'bond' },
    ]);
    app.startMission(row.id, false, null, false, null, 2);
    expect(scale(app)).toBeCloseTo(standard, 5);
    expect(savedGame(store).atStake).toBeUndefined();
    // And a pilot in debt is offered Standard alone.
    const owing = inHub(pilot({ credits: -300 }));
    expect(owing.app.stakes(row, null).map((terms) => terms.refusal)).toEqual([null, 'bond', 'bond', 'bond']);
  });

  test('a contract that takes no terms is flown as it is, whatever is asked', () => {
    const { app, store } = inHub(pilot());
    expect(app.stakes(app.missions().find((mission) => mission.id === 'patrol')!, null)).toEqual([]);
    app.startMission('patrol', false, null, false, null, 3);
    expect(snap(app).screen).toBe('battle');
    expect(savedGame(store).atStake).toBeUndefined();
    const plain = inHub(pilot());
    plain.app.startMission('patrol');
    expect(scale(app)).toBe(scale(plain.app));
  });

  test('everything that pays, at once: a later telling, a wingman\'s share, a class asked for by its crown\'s holder, the pay perk, and the terms', () => {
    // The second telling's board, on a day it asks for the class the pilot flies in its lightest contract; the pilot
    // holds that class's crown, has hired, and haggles.
    const kind = archetypeOf(JUGGERNAUT, CATALOG)!;
    let won = 33;
    while (generateBoard(won, 1, BOARD_TEXT)[0].asks !== kind) won += 1;
    const base = pilot({ battlesWon: won, cycle: 1, crowns: [kind], masters: [kind], perks: { haggler: 3 }, credits: 200_000 });
    const { app, store } = inHub(base);
    const row = open(app)[0];
    expect(row.asks).toBe(kind);
    const [wingman] = app.wingmen(row);
    expect(wingman).toBeDefined();
    const terms = app.stakes(row, wingman.id)[1];
    // The fee the terms are figured from is the fee as this pilot would be paid it at Standard: after the wingman's share.
    const fee = row.reward - Math.round((row.reward * Math.round(wingman.share * 100)) / 100);
    expect(fee).toBeLessThan(row.reward);
    expect(terms).toEqual({ level: 1, factor: 1.5, fee, bond: Math.round(fee / 2), refusal: null });
    const before = savedGame(store);
    app.startMission(row.id, false, wingman.id, false, null, 1);
    expect(savedGame(store).atStake).toBe(terms.bond);
    finishMission(app);
    const settled = bill(app);
    expect(settled.won).toBe(true);
    // The fee with the perk on it; the class bonus as it is at Standard, a share of the fee as paid; the hazard pay, which is the bond.
    expect(settled.reward).toBe(Math.round(fee * 1.24));
    expect(settled.asked).toEqual({ kind, bonus: Math.round(settled.reward * 0.5) });
    expect(settled.hazard).toEqual({ level: 1, pay: terms.bond });
    expect(settled.net).toBe(settled.reward + (settled.bonus ?? 0) + settled.asked!.bonus + terms.bond - settled.ammoCost - settled.repairCost);
    const after = savedGame(store);
    expect(after.credits).toBe(before.credits + settled.net + medalPay(after.medals.filter((id) => !before.medals.includes(id))));
  });
});

interface TermsView { level: number; factor: number; fee: number; bond: number; held: boolean; waiting: boolean }
interface Briefed { mission: string; reward: number; terms: TermsView | null; odds: (Forecast & { done: boolean }) | null; near: Nearness | null }
const brief = (app: App): Briefed => snap(app).briefing as unknown as Briefed;
const B = STRINGS.briefing;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const texts = (app: App): string[] => drawn(app).texts.map((t) => t.text);
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
/** At the briefing of a contract of the list, in the hurried game. */
function briefed(saved: GameState, pick: (app: App) => string): App {
  const { app } = inHub(saved);
  const id = pick(app);
  select(app, 'contracts');
  select(app, id);
  expect(snap(app).screen).toBe('briefing');
  return app;
}
/** The same, in a game that is read: the odds are counted there, a go of the usual size each frame. */
function reading(saved: GameState, pick: (app: App) => string): App {
  const { app } = makeApp(saved, undefined, { fast: false });
  press(app, 'confirm');
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(600); press(app, 'confirm'); }
  expect(snap(app).screen).toBe('hub');
  const id = pick(app);
  select(app, 'contracts');
  select(app, id);
  expect(snap(app).screen).toBe('briefing');
  return app;
}
const frames = (app: App, n: number): void => { for (let i = 0; i < n; i++) app.update(16); };
const lightId = (app: App): string => light(app).id;

describe('the terms in the briefing', () => {
  test('an open contract has a row for its terms under Accept, and no other contract has', () => {
    for (const pick of [lightId, (app: App) => open(app)[2].id, (app: App) => open(app).find((mission) => mission.job !== undefined)!.id, (app: App) => open(app).find((mission) => mission.id.endsWith('-swarm'))!.id]) {
      const app = briefed(pilot(), pick);
      expect(snap(app).menu.items.map((item) => item.id).slice(0, 2), brief(app).mission).toEqual(['accept', 'terms']);
      expect(brief(app).terms).toMatchObject({ level: 0, factor: 1, bond: 0, held: true, waiting: false });
    }
    for (const id of ['patrol', 'hadron-1']) {
      const app = briefed(pilot(), () => id);
      expect(snap(app).menu.items.map((item) => item.id), id).not.toContain('terms');
      expect(brief(app).terms).toBeNull();
    }
  });

  test('LEFT, RIGHT and A on it turn through the four, round and round, and the page says what each asks', () => {
    const app = briefed(pilot(), lightId);
    const row = light(app);
    toRow(app, 'terms');
    const seen: number[] = [];
    for (const action of ['right', 'right', 'confirm', 'right', 'left', 'left'] as const) { press(app, action); seen.push(brief(app).terms!.level); }
    expect(seen).toEqual([1, 2, 3, 0, 3, 2]);
    expect(snap(app).screen).toBe('briefing');
    for (let level = 0; level <= 3; level++) {
      while (brief(app).terms!.level !== level) press(app, 'right');
      const terms = app.stakes(row, null)[level];
      expect(brief(app).terms).toEqual({ level, factor: terms.factor, fee: terms.fee, bond: terms.bond, held: true, waiting: false });
      const shown = drawn(app);
      const name = B.termsName(STRINGS.stakes.names[level]);
      expect(written(shown, name)).toMatchObject({ left: 12, y: 78, color: COLORS.accent });
      const lines = level === 0 ? [B.termsStandard] : [B.opposition(terms.factor), B.termsFee(terms.fee + terms.bond), B.termsBond(terms.bond)];
      lines.forEach((line, i) => expect(written(shown, line), line).toMatchObject({ left: 12, y: 78 + 15 + i * LINE }));
      expect(written(shown, B.termsHint)).toMatchObject({ left: 12, y: 191 - LINE, color: COLORS.dim });
      // The client makes way for it: nothing of the briefing's own words is on the page while the cursor is here.
      for (const line of row.briefing.flatMap((paragraph) => wrap(paragraph, BRIEFING_CHARS))) expect(shown.texts.some((t) => t.text === line), line).toBe(false);
    }
  });

  test('raised terms are named under the client wherever the cursor is, in the colour of a warning; Standard is not named', () => {
    const app = briefed(pilot(), lightId);
    const row = light(app);
    const standard = written(drawn(app), row.elite ? B.openElite : B.open);
    expect(standard).toMatchObject({ left: 72, y: 40, color: COLORS.dim });
    toRow(app, 'terms');
    press(app, 'right', 'right');
    const tag = B.termsTag(STRINGS.stakes.names[2], 2);
    expect(tag).toBe('SEVERE TERMS: opposition x2');
    for (const id of ['terms', 'build', 'back', 'accept']) {
      toRow(app, id);
      expect(written(drawn(app), tag), id).toMatchObject({ left: 72, y: 40, color: COLORS.heat });
      expect(texts(app)).not.toContain(B.open);
    }
    // Half again is written with its half.
    toRow(app, 'terms');
    press(app, 'left');
    expect(texts(app)).toContain('HAZARD TERMS: opposition x1.5');
  });

  test('what Accept would pay is the fee of the terms showing, after whoever was hired', () => {
    const app = briefed(pilot(), lightId);
    const row = light(app);
    expect(brief(app).reward).toBe(row.reward);
    toRow(app, 'terms');
    for (const factor of [1.5, 2, 3]) {
      press(app, 'right');
      expect(brief(app).reward).toBe(row.reward + Math.round(row.reward * (factor - 1)));
      expect(texts(app)).toContain(`${B.reward} ${brief(app).reward}`);
    }
    // A wingman's share comes off the fee, and the terms are figured from what is left.
    toRow(app, 'wingman');
    press(app, 'right');
    const [wingman] = app.wingmen(row);
    const fee = app.stakes(row, wingman.id)[3].fee;
    expect(fee).toBeLessThan(row.reward);
    expect(brief(app)).toMatchObject({ reward: fee * 3, terms: { level: 3, fee, bond: fee * 2 } });
  });

  test('a level whose bond is not held is shown and not accepted', () => {
    const probe = inHub(pilot());
    const fee = light(probe.app).reward;
    const app = briefed(pilot({ credits: fee - 1 }), lightId);
    const held = app.game!.credits;
    expect(held).toBeLessThan(fee);
    toRow(app, 'terms');
    press(app, 'right');
    // Half the fee is held: Hazard can be taken.
    expect(brief(app).terms).toMatchObject({ level: 1, held: true });
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'accept', enabled: true });
    press(app, 'right');
    expect(brief(app).terms).toMatchObject({ level: 2, bond: fee, held: false });
    const shown = drawn(app);
    expect(written(shown, B.termsNoBond(fee, held)).color).toBe(COLORS.danger);
    expect(shown.texts.some((t) => t.text === B.termsBond(fee))).toBe(false);
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'accept', enabled: false });
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    // One step down it is taken again.
    toRow(app, 'terms');
    press(app, 'left');
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
  });

  test('Accept flies the terms showing', () => {
    const plain = briefed(pilot(), lightId);
    press(plain, 'confirm');
    const standard = scale(plain);
    const app = briefed(pilot(), lightId);
    toRow(app, 'terms');
    press(app, 'right', 'right');
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect(scale(app)).toBeCloseTo(standard * 2, 5);
    // Turned up and back down again, it is flown as offered.
    const back = briefed(pilot(), lightId);
    toRow(back, 'terms');
    press(back, 'right', 'right', 'left', 'left');
    toRow(back, 'accept');
    press(back, 'confirm');
    expect(scale(back)).toBeCloseTo(standard, 5);
  });

  describe('where the game is read, and the odds are counted', () => {
    const countOut = (app: App): void => { for (let i = 0; i < 40_000 && !brief(app).odds?.done; i++) app.update(16); expect(brief(app).odds?.done).toBe(true); };

    test('on raised terms Accept waits for the odds, and says that it is counting; at Standard it never waits', () => {
      const app = reading(pilot(), lightId);
      app.update(BRIEFING_HOLD_MS);
      expect(brief(app).terms).toMatchObject({ level: 0, waiting: false });
      expect(snap(app).menu.items[0]).toMatchObject({ id: 'accept', label: B.accept, enabled: true });
      toRow(app, 'terms');
      press(app, 'right');
      expect(brief(app).odds).toMatchObject({ played: 0, done: false });
      expect(brief(app).terms).toMatchObject({ level: 1, waiting: true });
      expect(snap(app).menu.items[0]).toMatchObject({ id: 'accept', label: B.counting, enabled: false });
      toRow(app, 'accept');
      press(app, 'confirm');
      expect(snap(app).screen).toBe('briefing');
      countOut(app);
      expect(brief(app).terms!.waiting).toBe(false);
      expect(snap(app).menu.items[0]).toMatchObject({ id: 'accept', label: B.accept, enabled: true });
      press(app, 'confirm');
      expect(snap(app).screen).toBe('battle');
      // At Standard A is taken with the count still running, as it always was.
      const plain = reading(pilot(), lightId);
      plain.update(BRIEFING_HOLD_MS);
      expect(brief(plain).odds!.done).toBe(false);
      press(plain, 'confirm');
      expect(snap(plain).screen).toBe('battle');
    });

    test('and not for ever: on a machine too slow to count, A is taken after eight seconds on the same terms', () => {
      expect(TERMS_WAIT_MS).toBe(8000);
      // A clock that says every frame's share is used up before it begins: the count gets its one go a frame and no more.
      const app = reading(pilot(), (a) => open(a)[2].id);
      toRow(app, 'terms');
      press(app, 'right', 'right', 'right');
      toRow(app, 'accept');
      // Time passes without the count being worked (as on a machine with no time to spare): the wait runs out.
      const screen = (app as unknown as { current: { waited: number } }).current;
      expect(brief(app).terms!.waiting).toBe(true);
      screen.waited = TERMS_WAIT_MS - 1;
      expect(brief(app).terms!.waiting).toBe(true);
      screen.waited = TERMS_WAIT_MS;
      expect(brief(app).terms!.waiting).toBe(false);
      // Turning the terms begins the wait again.
      toRow(app, 'terms');
      press(app, 'left');
      expect(screen.waited).toBe(0);
      expect(brief(app).terms).toMatchObject({ level: 2, waiting: true });
      // And the wait is time on the terms: a frame adds its length to it.
      app.update(16);
      expect(screen.waited).toBe(16);
    });

    test('each terms has a count of its own: turning away keeps it, and turning back goes on with it', () => {
      const app = reading(pilot(), (a) => open(a)[2].id);
      // Until the first of its twenty flights is counted: a go of the usual size each frame.
      for (let i = 0; i < 4000 && brief(app).odds!.played === 0; i++) frames(app, 1);
      const standard = brief(app).odds!;
      expect(standard.played).toBe(1);
      expect(standard.done).toBe(false);
      toRow(app, 'terms');
      press(app, 'right');
      // Another terms: its count begins at nothing.
      expect(brief(app).odds).toMatchObject({ played: 0, won: 0, done: false });
      frames(app, 6);
      const hazard = brief(app).odds!;
      press(app, 'left');
      // Back: Standard is where it was left, and goes on from there.
      expect(brief(app).odds).toEqual(standard);
      frames(app, 1);
      press(app, 'right');
      expect(brief(app).odds!.played).toBeGreaterThanOrEqual(hazard.played);
      // Counted, each stands at once when turned to, and is what the game's own count of that fight comes to.
      const row = open(app)[2];
      const flights = (level: number): Forecast => {
        const prospect = app.prospect(row, null, null, level)!;
        let count = newCount();
        while (!counted(count)) count = advance(count, prospect.fight, prospect.mission, CATALOG, 100_000);
        return count.tally;
      };
      for (const level of [1, 0]) {
        while (brief(app).terms!.level !== level) press(app, 'right');
        countOut(app);
        expect({ played: brief(app).odds!.played, won: brief(app).odds!.won }, String(level)).toEqual(flights(level));
      }
      press(app, 'right');
      expect(brief(app).odds!.done).toBe(true);
    });

    test('the terms one step up are counted ahead, once the count showing has nothing more to work out', () => {
      const app = reading(pilot(), lightId);
      countOut(app);
      // The cursor is left where it is: time passes, and Hazard is counted behind the page.
      for (let i = 0; i < 40_000; i++) app.update(16);
      toRow(app, 'terms');
      press(app, 'right');
      expect(brief(app).odds!.done).toBe(true);
      expect(brief(app).terms!.waiting).toBe(false);
      // Two steps up was not: one ahead is all that is counted behind the page.
      const fresh = reading(pilot(), lightId);
      countOut(fresh);
      frames(fresh, 2);
      toRow(fresh, 'terms');
      press(fresh, 'right', 'right');
      expect(brief(fresh).odds!.done).toBe(false);
    });

    test('where the odds are not good the line says how the flights were lost, on the page of the build and of the terms', () => {
      // The heaviest contract on ruinous terms, in a machine it is too much for.
      const app = reading(pilot(), (a) => open(a)[2].id);
      toRow(app, 'terms');
      press(app, 'right', 'right', 'right');
      countOut(app);
      const odds = brief(app).odds!;
      expect(odds.won).toBeLessThan(15);
      // Until the lost flights have been flown again the line is as it was; then it says how near they were.
      for (let i = 0; i < 60_000 && brief(app).near === null; i++) app.update(16);
      const near = brief(app).near!;
      expect(['narrow', 'clear', 'outmatched']).toContain(near);
      const line = `: ${B.oddsNear[near]}`;
      expect(texts(app)).toContain(line);
      expect(texts(app)).not.toContain(`: ${B.oddsNote}`);
      toRow(app, 'build');
      expect(texts(app)).toContain(line);
      // With good odds nothing is said of the few that were lost: the line is what it always was.
      const safe = reading(pilot(), lightId);
      countOut(safe);
      for (let i = 0; i < 200; i++) safe.update(16);
      expect(brief(safe).odds!.won).toBeGreaterThanOrEqual(15);
      expect(brief(safe).near).toBeNull();
      toRow(safe, 'build');
      expect(texts(safe)).toContain(`: ${B.oddsNote}`);
    });
  });

  test('in Dutch the row, the page of each terms and the header\'s line fit where they stand', () => {
    const N = STRINGS_NL.briefing;
    expect([N.terms, N.counting, N.termsHint]).toEqual(['Inzet', 'Telt nog', 'LINKS/RECHTS: andere inzet']);
    // (Few credits: the page of the upper terms then has the line of a bond that is not held, which is the longest.)
    const app = briefed(pilot({ credits: 3000, settings: { ...pilot().settings, language: 'nl' } }), (a) => open(a)[2].id);
    expect(texts(app)).toContain('Inzet');
    toRow(app, 'terms');
    for (let level = 0; level <= 3; level++) {
      const shown = drawn(app);
      const page = shown.texts.filter((t) => t.left === 12 && t.y >= 78 && t.y < 191);
      expect(page.length, String(level)).toBeGreaterThanOrEqual(3);
      for (const t of page) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 12);
      for (const a of shown.texts) for (const b of shown.texts) if (a !== b && a.y === b.y) expect(a.left < b.right && b.left < a.right, `"${a.text}" and "${b.text}"`).toBe(false);
      press(app, 'right');
    }
    expect(STRINGS.briefing.termsTag(STRINGS.stakes.names[1], 1.5)).toBe('INZET RISKANT: tegenstand x1,5');
    expect(STRINGS.briefing.termsName(STRINGS.stakes.names[3])).toBe('INZET RUÏNEUS');
  });
});
