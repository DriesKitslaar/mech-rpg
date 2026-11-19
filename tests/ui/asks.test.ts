import { archetypeOf, type Archetype } from '../../src/core/archetype';
import { ASK_BONUS, ASK_TIER, boardTier, generateBoard } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import { saveLoadout, type GameState } from '../../src/core/game';
import { feeAfter } from '../../src/core/wingman';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../../src/content/board';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { WINGMEN } from '../../src/content/wingmen';
import type { App } from '../../src/ui/app';
import { COLORS, LINE } from '../../src/ui/widgets';
import { JUGGERNAUT, autoBattle, done, inHub, medalPay, press, savedGame, select, snap, strong } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * Work that asks for a class, as the player meets it: the contract's row on the list, the line under
 * its client that lights up for a build of the class, and what the settlement pays for it.
 */

afterEach(() => setLanguage('en'));

const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const quiet = (base: GameState): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const B = STRINGS.briefing;
const BASTION = ARCHETYPE_BUILDS.bastion.war;
interface Asks { kind: Archetype; met: boolean }
const asksOf = (app: App): Asks | null => (snap(app).briefing as unknown as { asks: Asks | null }).asks;
interface Asked { kind: Archetype; bonus: number }
const askedOf = (app: App): Asked | null => (snap(app).settlement as unknown as { asked: Asked | null }).asked;
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};

/** The first board, from so many battles won on, whose asking contract asks for this class (and passes the test, if one is given). */
function boardAsking(kind: Archetype, from = 10, fits: (asking: Mission, board: Mission[]) => boolean = () => true): { won: number; asking: Mission; board: Mission[] } {
  for (let won = from; won < from + 4000; won++) {
    const board = generateBoard(won, 0, BOARD_TEXT);
    const asking = board.find((mission) => mission.asks === kind);
    if (asking && fits(asking, board)) return { won, asking, board };
  }
  throw new Error(`no board asks for a ${kind}`);
}
/** The juggernaut the tests win with is a lancer: two weapons and more, all energy. */
const LANCER = JUGGERNAUT as unknown as GameState['build'];
/** A pilot at the war in the juggernaut, with so many battles won, a bastion saved first, and Kite for hire. */
function pilot(won: number, extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  const saved = saveLoadout(wearing(story, BASTION), 0);
  return { ...quiet(strong(saved)), battlesWon: won, scenes: ['act-1', 'act-2', 'talk-kite'], choices: { kite: 'pass' }, arenaRank: 3, ...extra };
}
/** Plays the contract on screen to its settlement with Auto Turn. */
function fly(app: App): void {
  for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) { autoBattle(app); press(app, 'confirm'); }
  expect(snap(app).screen).toBe('settlement');
}
function atBriefing(saved: GameState, contract: string): App {
  const { app } = inHub(saved);
  select(app, 'contracts');
  select(app, contract);
  expect(snap(app).screen).toBe('briefing');
  return app;
}

test('the juggernaut is a lancer, and the bastion saved beside it a bastion', () => {
  expect(archetypeOf(LANCER, CATALOG)).toBe('lancer');
  expect(archetypeOf(BASTION, CATALOG)).toBe('bastion');
});

describe('on the list of contracts', () => {
  test('the contract that asks has a plus after what it pays, and no other row has', () => {
    const { won, asking, board } = boardAsking('lancer');
    const { app } = inHub(pilot(won));
    select(app, 'contracts');
    const notes = Object.fromEntries(snap(app).menu.items.map((item) => [item.id, item.note]));
    expect(notes[asking.id]).toBe(`${asking.reward}+`);
    for (const other of board.filter((mission) => mission !== asking)) expect(notes[other.id]).toBe(String(other.reward));
    expect(Object.values(notes).filter((note) => note?.endsWith('+'))).toHaveLength(1);
  });

  test('before the board has grown two stages no row has a plus', () => {
    expect(boardTier(9, 0)).toBeLessThan(ASK_TIER);
    const { app } = inHub(pilot(9));
    select(app, 'contracts');
    expect(snap(app).menu.items.filter((item) => item.note?.endsWith('+'))).toEqual([]);
  });
});

describe('at the briefing', () => {
  test('a line under the client says which class is wanted and what it pays more: lit for a build of that class, a plain notice for any other', () => {
    const { won, asking } = boardAsking('lancer');
    const app = atBriefing(pilot(won), asking.id);
    // The juggernaut on the floor is a lancer: the line is lit, in the colour of pay.
    expect(asksOf(app)).toEqual({ kind: 'lancer', met: true });
    let line = written(drawn(app), 'WANTS A LANCER: +25% PAY');
    expect(line).toMatchObject({ left: 72, y: 51, color: COLORS.armor, size: 12 });
    // Under the contract's own tag, a row lower.
    const tag = drawn(app).texts.find((t) => t.y === 40 && t.left === 72)!;
    expect(tag.text).toMatch(/^OPEN CONTRACT/);
    expect(line.y - tag.y).toBe(LINE);
    // Turned to the bastion saved first, it is a notice and no more.
    toRow(app, 'build');
    press(app, 'right');
    expect(asksOf(app)).toEqual({ kind: 'lancer', met: false });
    line = written(drawn(app), 'WANTS A LANCER: +25% PAY');
    expect(line.color).toBe(COLORS.heat);
    // And back.
    press(app, 'left');
    expect(asksOf(app)).toEqual({ kind: 'lancer', met: true });
    expect(written(drawn(app), 'WANTS A LANCER: +25% PAY').color).toBe(COLORS.armor);
  });

  test('a saved build of the class asked for lights it up when it is turned to', () => {
    const { won, asking } = boardAsking('bastion');
    const app = atBriefing(pilot(won), asking.id);
    expect(asksOf(app)).toEqual({ kind: 'bastion', met: false });
    expect(written(drawn(app), 'WANTS A BASTION: +25% PAY').color).toBe(COLORS.heat);
    toRow(app, 'build');
    press(app, 'right');
    expect(asksOf(app)).toEqual({ kind: 'bastion', met: true });
    expect(written(drawn(app), 'WANTS A BASTION: +25% PAY').color).toBe(COLORS.armor);
  });

  test('a contract that asks for nothing has no such line, and neither has the patrol or a contract of the story', () => {
    const { won, asking, board } = boardAsking('lancer');
    const { app } = inHub(pilot(won));
    select(app, 'contracts');
    for (const id of [board.find((mission) => mission !== asking)!.id, 'patrol', 'lumen-3']) {
      select(app, id);
      expect(asksOf(app), id).toBeNull();
      expect(drawn(app).texts.filter((t) => /WANTS/.test(t.text)), id).toEqual([]);
      press(app, 'cancel');
    }
  });

  test('every class is named as it is wanted, with the share it pays taken from the rule', () => {
    expect(B.wanted).toEqual({
      duellist: 'A DUELLIST', marksman: 'A SHARPSHOOTER', artillery: 'ARTILLERY', lancer: 'A LANCER', bastion: 'A BASTION', skirmisher: 'A SKIRMISHER', allrounder: 'AN ALL-ROUNDER',
    });
    expect(B.asks('A BASTION', 25)).toBe('WANTS A BASTION: +25% PAY');
    expect(ASK_BONUS * 100).toBe(25);
    for (const kind of Object.keys(B.wanted) as Archetype[]) expect(B.wanted[kind]).toContain(STRINGS.classes.names[kind].toUpperCase());
  });

  test('an elite contract that also asks says both, one under the other, and nothing runs into anything', () => {
    for (const language of ['en', 'nl'] as const) {
      const { won, asking } = boardAsking('marksman', 15, (mission) => mission.elite !== undefined);
      const app = atBriefing(pilot(won), asking.id);
      setLanguage(language);
      const S = language === 'nl' ? STRINGS_NL : STRINGS;
      const shown = drawn(app);
      const header = shown.texts.filter((t) => t.y < 66);
      expect(written(shown, S.briefing.openElite).y).toBe(40);
      const line = written(shown, S.briefing.asks(S.briefing.wanted.marksman, 25));
      expect(line.y).toBe(51);
      expect(line.right).toBeLessThan(310 - 12);
      for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `${language}: "${a.text}" and "${b.text}"`).toBe(false);
      setLanguage('en');
    }
  });

  test('in Dutch', () => {
    const { won, asking } = boardAsking('marksman');
    const app = atBriefing(pilot(won), asking.id);
    setLanguage('nl');
    expect(written(drawn(app), 'ZOEKT SCHERPSCHUTTER: +25% LOON')).toMatchObject({ left: 72, y: 51 });
    expect(STRINGS_NL.briefing.wanted).toEqual({
      duellist: 'DUELLIST', marksman: 'SCHERPSCHUTTER', artillery: 'ARTILLERIE', lancer: 'LANSIER', bastion: 'BASTION', skirmisher: 'JAGER', allrounder: 'ALLROUNDER',
    });
  });
});

describe('at the settlement', () => {
  test('won as the class asked for: a quarter of the fee on top, on a row of its own, and in the pilot\'s pocket', () => {
    const { won, asking } = boardAsking('lancer');
    const { app, store } = inHub(pilot(won));
    const before = savedGame(store);
    select(app, 'contracts');
    select(app, asking.id);
    select(app, 'accept');
    fly(app);
    const s = snap(app).settlement!;
    expect(s.won).toBe(true);
    expect(s.reward).toBe(asking.reward);
    const bonus = Math.round(asking.reward * ASK_BONUS);
    expect(askedOf(app)).toEqual({ kind: 'lancer', bonus });
    // The net is the fee, what the rank and the class added, less the bill.
    const { ammoCost, repairCost } = s as unknown as { ammoCost: number; repairCost: number };
    expect(s.net).toBe(s.reward + s.bonus + bonus - ammoCost - repairCost);
    const after = savedGame(store);
    // (A medal earned on the way pays a little of its own.)
    expect(after.credits).toBe(before.credits + s.net + medalPay(after.medals.filter((id) => !before.medals.includes(id))));
    // What was paid is counted with the rest of what the pilot has earned.
    expect(after.stats.earned - before.stats.earned).toBe(s.reward + s.bonus + bonus);
    // The row: the class by its name, and what it added, in the colour of pay.
    const shown = drawn(app);
    const label = written(shown, 'Lancer bonus');
    const amount = shown.texts.find((t) => t.y === label.y && t.text === `+${bonus}`)!;
    expect(amount).toMatchObject({ color: COLORS.armor, align: 'right' });
    // Under the fee (and the rank's row, when the rank paid), above the bill for ammunition.
    const fee = written(shown, STRINGS.settlement.reward);
    const ammo = written(shown, STRINGS.settlement.ammo);
    expect(label.y).toBeGreaterThan(fee.y);
    expect(ammo.y - label.y).toBe(LINE);
  });

  test('won as another class: what the contract says and no more, and no row', () => {
    const { won, asking } = boardAsking('bastion', 10, (mission) => mission.battles.length === 1);
    const { app, store } = inHub(pilot(won));
    const before = savedGame(store);
    select(app, 'contracts');
    select(app, asking.id);
    select(app, 'accept');
    fly(app);
    const s = snap(app).settlement!;
    expect(s.won).toBe(true);
    expect(askedOf(app)).toBeNull();
    const { ammoCost, repairCost } = s as unknown as { ammoCost: number; repairCost: number };
    expect(s.net).toBe(s.reward + s.bonus - ammoCost - repairCost);
    const after = savedGame(store);
    expect(after.credits).toBe(before.credits + s.net + medalPay(after.medals.filter((id) => !before.medals.includes(id))));
    expect(drawn(app).texts.filter((t) => /bonus$/.test(t.text) && !/^Rank/.test(t.text))).toEqual([]);
  });

  test('with a wingman along, the quarter is of what the pilot is paid after the wingman\'s share', () => {
    const { won, asking } = boardAsking('lancer');
    const app = atBriefing(pilot(won), asking.id);
    toRow(app, 'wingman');
    press(app, 'right');
    toRow(app, 'accept');
    press(app, 'confirm');
    fly(app);
    const kite = WINGMEN.find((w) => w.id === 'kite')!;
    const fee = feeAfter(asking.reward, kite);
    expect(snap(app).settlement!.reward).toBe(fee);
    expect(askedOf(app)).toEqual({ kind: 'lancer', bonus: Math.round(fee * ASK_BONUS) });
  });

  test('lost as the class asked for: nothing for it', () => {
    const { won, asking } = boardAsking('lancer');
    const { app } = inHub(pilot(won));
    select(app, 'contracts');
    select(app, asking.id);
    select(app, 'accept');
    // Walking away is a contract lost.
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
      if (snap(app).battle!.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    select(app, 'retreat');
    select(app, 'yes');
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'result'; i++) app.update(16);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('settlement');
    expect(snap(app).settlement!.won).toBe(false);
    expect(askedOf(app)).toBeNull();
  });

  test('with the rank\'s row and the class\'s row both there, the bill still ends above what the client says: a repair line makes way', () => {
    const { won, asking } = boardAsking('lancer');
    const { app } = inHub(pilot(won));
    select(app, 'contracts');
    select(app, asking.id);
    select(app, 'accept');
    fly(app);
    const screen = (app as unknown as { current: { settlement: { lines: { partId: string; lost: number; cost: number }[]; rank?: string; bonus?: number } } }).current;
    // A bill with every row there can be: the rank paid, the class paid, and four parts to repair.
    screen.settlement = {
      ...screen.settlement, rank: 'S', bonus: 500,
      lines: ['head-colossus', 'core-colossus', 'arms-colossus', 'legs-colossus'].map((partId) => ({ partId, lost: 10, cost: 8 })),
    };
    const shown = drawn(app);
    const words = shown.texts.filter((t) => t.y >= 144 && t.y < 180 && t.color === COLORS.dim && t.left === 50);
    expect(words.length).toBeGreaterThan(0);
    const rows = shown.texts.filter((t) => t.y >= 55 && t.y < 144 && t.left === 50);
    // Reward, rank, class, ammunition, repairs and three of the four parts: eight rows, the last one above the client's words.
    expect(rows.map((t) => t.y)).toEqual([55, 66, 77, 88, 99, 110, 121, 132]);
    expect(Math.max(...rows.map((t) => t.y)) + LINE).toBeLessThanOrEqual(144);
    expect(rows.slice(0, 5).map((t) => t.text)).toEqual(['Reward', 'Rank S bonus', 'Lancer bonus', 'Ammunition', 'Repairs']);
    // With one of the two rows gone there is room for all four parts again, and with both gone no more than four are listed.
    const full = screen.settlement as typeof screen.settlement & { asked?: unknown };
    const rowsOf = (bill: typeof full): string[] => {
      screen.settlement = bill;
      return drawn(app).texts.filter((t) => t.y >= 55 && t.y < 144 && t.left === 50).map((t) => t.text.trim());
    };
    const parts = ['head-colossus', 'core-colossus', 'arms-colossus', 'legs-colossus'].map((id) => CATALOG[id].name);
    expect(parts[1]).toBe('Colossus Core');
    expect(rowsOf({ ...full, asked: undefined })).toEqual(['Reward', 'Rank S bonus', 'Ammunition', 'Repairs', ...parts]);
    expect(rowsOf({ ...full, rank: 'B', bonus: 0 })).toEqual(['Reward', 'Lancer bonus', 'Ammunition', 'Repairs', ...parts]);
    expect(rowsOf({ ...full, asked: undefined, rank: 'B', bonus: 0 })).toEqual(['Reward', 'Ammunition', 'Repairs', ...parts]);
    expect(rowsOf({ ...full, asked: undefined, rank: 'B', bonus: 0, lines: [...full.lines, { partId: 'gen-kd1', lost: 1, cost: 1 }] })).toEqual(['Reward', 'Ammunition', 'Repairs', ...parts]);
  });

  test('in Dutch the row names the class', () => {
    expect(STRINGS.settlement.askBonus('Bastion')).toBe('Bastion bonus');
    expect(STRINGS_NL.settlement.askBonus('Bastion')).toBe('Bonus Bastion');
  });
});
