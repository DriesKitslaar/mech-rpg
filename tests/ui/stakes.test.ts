import { archetypeOf } from '../../src/core/archetype';
import { generateBoard } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { isValidState, type GameState } from '../../src/core/game';
import { STAKES, bondFor } from '../../src/core/stakes';
import { BOARD_TEXT } from '../../src/content/board';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG } from '../../src/content/parts';
import { forfeitToast, type App } from '../../src/ui/app';
import { JUGGERNAUT, done, finishBattle, finishMission, inHub, medalPay, press, retreat, savedGame, snap, strong } from '../helpers/app';

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
