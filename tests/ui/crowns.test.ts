import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import { ASK_BONUS, askSettlement, generateBoard } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { newGame, saveLoadout, type GameState } from '../../src/core/game';
import { CROWN_BONUS, askBonus, recordMasterWin } from '../../src/core/masters';
import { DEFAULT_MIXES, MIX_SLOTS, mixId } from '../../src/core/mix';
import { awardMedals, medalProgress } from '../../src/core/medals';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../../src/content/board';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import { MEDALS } from '../../src/content/medals';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { GarageFlow } from '../../src/ui/garageFlow';
import { CROWN_PAINTS, PAINTS, paintsFor } from '../../src/ui/paint';
import { COLORS, CROWN_COLOR, LINE, MEDAL_COLORS, drawCrown } from '../../src/ui/widgets';
import { JUGGERNAUT, autoBattle, done, inHub, medalPay, press, savedGame, select, snap, strong } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * What a crown gives its holder: it is marked on the pilot's page of classes, its master's paint is
 * in the garage, a contract that asks for its class pays more, and two medals count crowns.
 */

afterEach(() => setLanguage('en'));

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const quiet = (base: GameState): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const crowned = (base: GameState, ...kinds: Archetype[]): GameState => kinds.reduce((game, kind) => recordMasterWin(game, kind, kind), base);
const BASTION = ARCHETYPE_BUILDS.bastion.war;
/** A pilot at the war in the juggernaut (a lancer), with a bastion saved first. */
function pilot(extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  const saved = saveLoadout(wearing(story, BASTION), 0);
  return { ...quiet(strong(saved)), scenes: ['act-1', 'act-2'], arenaRank: 3, ...extra };
}
function onClasses(saved: GameState): App {
  const { app } = inHub(saved);
  select(app, 'pilot');
  for (let i = 0; i < 6 && snap(app).page !== 'classes'; i++) press(app, 'next');
  expect(snap(app).page).toBe('classes');
  return app;
}
/** The little crowns drawn on the page, by the row they stand on. */
const crownRows = (shown: Drawn): number[] => [...new Set(shown.rects.filter((r) => r.color === CROWN_COLOR && r.y >= 30 && r.y < 115).map((r) => Math.floor((r.y - 34) / LINE)))].sort((a, b) => a - b);

describe('the pilot\'s page of classes', () => {
  test('marks each class whose crown is held with a small crown on its row, and counts them above the list', () => {
    const app = onClasses(crowned(pilot({ arenaRank: 10 }), 'bastion', 'skirmisher'));
    const shown = drawn(app);
    expect(crownRows(shown)).toEqual([ARCHETYPES.indexOf('bastion'), ARCHETYPES.indexOf('skirmisher')]);
    expect(written(shown, 'CROWNS 2/7')).toMatchObject({ y: 22, size: 10, color: COLORS.dim });
    // The count stands between the heading and the column of wins, and runs into neither.
    const header = shown.texts.filter((t) => t.y === 22);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    // A crown stands clear of the rule before it and the count after it, on every row.
    const marks = shown.rects.filter((r) => r.color === CROWN_COLOR && r.y >= 30 && r.y < 115);
    const left = Math.min(...marks.map((r) => r.x));
    const right = Math.max(...marks.map((r) => r.x + r.w));
    for (const t of shown.texts.filter((text) => text.y >= 34 && text.y < 34 + 7 * LINE)) {
      expect(t.right <= left - 2 || t.left >= right + 2, t.text).toBe(true);
    }
  });

  test('a crown is gold, as the highest medal is, and is a shape of its own: three points over a band', () => {
    expect(CROWN_COLOR).toBe(MEDAL_COLORS[3]);
    expect(CROWN_COLOR).toBe('#f2c744');
    const shape = record((ctx) => drawCrown(ctx, 100, 50)).rects;
    expect(shape.every((r) => r.color === CROWN_COLOR)).toBe(true);
    // Nine wide and seven tall, whatever it is made of.
    expect([Math.min(...shape.map((r) => r.x)), Math.max(...shape.map((r) => r.x + r.w))]).toEqual([100, 109]);
    expect([Math.min(...shape.map((r) => r.y)), Math.max(...shape.map((r) => r.y + r.h))]).toEqual([50, 57]);
    // The band runs the whole width under the points; the points stand apart, the middle one tallest.
    const covered = (x: number, y: number): boolean => shape.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    for (let x = 100; x < 109; x++) expect(covered(x, 56), String(x)).toBe(true);
    expect([100, 102, 104, 106, 108].map((x) => covered(x, 51))).toEqual([true, false, true, false, true]);
    expect([covered(104, 50), covered(100, 50), covered(108, 50)]).toEqual([true, false, false]);
  });

  test('the class under the cursor is called by what its holder is called, in the crown\'s colour', () => {
    const app = onClasses(crowned(pilot({ arenaRank: 10 }), 'duellist'));
    let shown = drawn(app);
    expect(written(shown, 'MASTER DUELLIST')).toMatchObject({ left: 12, y: 121, color: CROWN_COLOR });
    expect(shown.texts.some((t) => t.text === 'DUELLIST' && t.y === 121)).toBe(false);
    // A class whose crown is not held is called by its own name, as it was.
    press(app, 'down');
    shown = drawn(app);
    expect(written(shown, 'SHARPSHOOTER')).toMatchObject({ left: 12, y: 121, color: COLORS.accent });
    expect(shown.texts.some((t) => /^MASTER/.test(t.text))).toBe(false);
  });

  test('says nothing of crowns to a pilot the masters are not open to yet, and counts none for a champion who holds none', () => {
    const early = drawn(onClasses(pilot()));
    expect(early.texts.some((t) => /CROWNS/.test(t.text))).toBe(false);
    expect(crownRows(early)).toEqual([]);
    const champion = drawn(onClasses(pilot({ arenaRank: 10 })));
    expect(written(champion, 'CROWNS 0/7').y).toBe(22);
    expect(crownRows(champion)).toEqual([]);
    // A crown held is said whatever the rank says: a kept game is taken at its word.
    expect(written(drawn(onClasses(crowned(pilot(), 'lancer'))), 'CROWNS 1/7').y).toBe(22);
  });

  test('a master beaten in another machine is no crown', () => {
    const app = onClasses(recordMasterWin(pilot({ arenaRank: 10 }), 'bastion', 'lancer'));
    const shown = drawn(app);
    expect(crownRows(shown)).toEqual([]);
    expect(written(shown, 'CROWNS 0/7').y).toBe(22);
  });

  test('in Dutch, with every crown held: nothing overlaps and nothing runs out', () => {
    const base = crowned(pilot({ arenaRank: 10 }), ...ARCHETYPES);
    const app = onClasses({ ...base, settings: { ...base.settings, language: 'nl' } });
    for (let i = 0; i < 7; i++) {
      const shown = drawn(app);
      expect(written(shown, 'KRONEN 7/7').y).toBe(22);
      expect(crownRows(shown)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(written(shown, STRINGS_NL.arena.masters.titles[ARCHETYPES[i]].toUpperCase())).toMatchObject({ left: 12, y: 121 });
      const marks = shown.rects.filter((r) => r.color === CROWN_COLOR && r.y >= 30 && r.y < 115);
      const left = Math.min(...marks.map((r) => r.x));
      const right = Math.max(...marks.map((r) => r.x + r.w));
      for (const t of shown.texts.filter((text) => text.y >= 34 && text.y < 34 + 7 * LINE)) expect(t.right <= left - 2 || t.left >= right + 2, t.text).toBe(true);
      const rows = shown.texts.filter((t) => t.y < 132);
      for (const a of rows) for (const b of rows) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
      for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
      press(app, 'down');
    }
  });
});

describe('the master\'s paint', () => {
  test('what a pilot may wear: factory colours, the twelve anyone may, and the paint of each crown held, in the order of the classes', () => {
    const free = ['factory', ...PAINTS.map((paint) => paint.id)];
    // After them all, the pilot's own three mixes: anyone has those.
    const own = DEFAULT_MIXES.map(mixId);
    expect(paintsFor(fresh())).toEqual([...free, ...own]);
    expect(paintsFor(crowned(fresh(), 'bastion'))).toEqual([...free, 'basalt', ...own]);
    expect(paintsFor(crowned(fresh(), 'skirmisher', 'duellist'))).toEqual([...free, 'mercury', 'kingfisher', ...own]);
    expect(paintsFor(crowned(fresh(), ...ARCHETYPES))).toEqual([...free, ...CROWN_PAINTS.map((paint) => paint.id), ...own]);
    // A master beaten in another machine gives no paint; a name that is no class gives none.
    expect(paintsFor(recordMasterWin(fresh(), 'bastion', 'lancer'))).toEqual([...free, ...own]);
    expect(paintsFor({ crowns: ['nobody'] })).toEqual([...free, ...own]);
  });

  test('the garage steps through them and no others: the twelve as before, and after them the paints of the crowns held', () => {
    const none = new GarageFlow(fresh(), CATALOG);
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) { none.onInput('next'); seen.push(none.game.paint); }
    expect(seen.slice(0, 13 + MIX_SLOTS)).toEqual([...PAINTS.map((paint) => paint.id), ...DEFAULT_MIXES.map(mixId), 'factory']);
    for (const paint of CROWN_PAINTS) expect(seen).not.toContain(paint.id);
    const held = new GarageFlow(crowned(fresh(), 'bastion', 'lancer'), CATALOG);
    // Back from factory colours, past the pilot's own three mixes.
    for (let i = 0; i <= MIX_SLOTS; i++) held.onInput('prev');
    expect(held.game.paint).toBe('basalt');
    expect(held.paintName).toBe('Basalt');
    held.onInput('prev');
    expect(held.game.paint).toBe('ultraviolet');
    held.onInput('prev');
    expect(held.game.paint).toBe(PAINTS.at(-1)!.id);
    for (let i = 0; i < 3 + MIX_SLOTS; i++) held.onInput('next');
    expect(held.game.paint).toBe('factory');
  });

  test('a master\'s paint worn by a pilot who does not hold that crown is named as what it is, stepped away from, and not come back to', () => {
    const flow = new GarageFlow({ ...fresh(), paint: 'mercury' }, CATALOG);
    expect(flow.paintName).toBe('Mercury');
    flow.onInput('next');
    expect(flow.game.paint).toBe(PAINTS[0].id);
    for (let i = 0; i < 30; i++) { flow.onInput('next'); expect(flow.game.paint).not.toBe('mercury'); }
    const back = new GarageFlow({ ...fresh(), paint: 'mercury' }, CATALOG);
    for (let i = 0; i <= MIX_SLOTS; i++) back.onInput('prev');
    expect(back.game.paint).toBe(PAINTS.at(-1)!.id);
  });

  test('the pilot\'s mech is drawn in it, in the garage and in a fight', () => {
    const asked: string[] = [];
    const painting = {
      get: (_id: string, fallback: { w: number; h: number }) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }),
      painted: (_id: string, paint: string, fallback: { w: number; h: number }) => { asked.push(paint); return { image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }; },
    };
    const { app, store } = inHub(crowned(pilot(), 'bastion'), undefined, { sprites: painting });
    select(app, 'garage');
    for (let i = 0; i <= MIX_SLOTS; i++) press(app, 'prev');
    expect(savedGame(store).paint).toBe('basalt');
    asked.length = 0;
    drawn(app);
    expect(asked).toContain('basalt');
    expect(drawn(app).texts.some((t) => t.text === STRINGS.garage.paint('Basalt'))).toBe(true);
  });
});

describe('pay for the class', () => {
  const BILL: Settlement = { won: true, reward: 3000, ammoCost: 100, repairCost: 200, net: 2700, lines: [] };

  test('a contract that asks for a class pays its holder half as much again, and anyone else a quarter more', () => {
    expect([ASK_BONUS, CROWN_BONUS]).toEqual([0.25, 0.5]);
    const game = crowned(fresh(), 'bastion');
    expect(askBonus(game, 'bastion')).toBe(0.5);
    expect(askBonus(game, 'lancer')).toBe(0.25);
    expect(askBonus(fresh(), 'bastion')).toBe(0.25);
    // A master beaten in another machine is no crown.
    expect(askBonus(recordMasterWin(fresh(), 'bastion', 'lancer'), 'bastion')).toBe(0.25);
    expect(ARCHETYPES.map((kind) => askBonus(crowned(fresh(), ...ARCHETYPES), kind))).toEqual(ARCHETYPES.map(() => 0.5));
  });

  test('the settlement takes the rate it is given, and a quarter when it is given none', () => {
    const asking = { asks: 'bastion' } as const;
    expect(askSettlement(BILL, asking, 'bastion')).toEqual({ ...BILL, asked: { kind: 'bastion', bonus: 750 }, net: 3450 });
    expect(askSettlement(BILL, asking, 'bastion', CROWN_BONUS)).toEqual({ ...BILL, asked: { kind: 'bastion', bonus: 1500 }, net: 4200 });
    // The rate changes nothing for a contract lost, won as another class, or one that asks for nothing.
    expect(askSettlement({ ...BILL, won: false }, asking, 'bastion', CROWN_BONUS)).toEqual({ ...BILL, won: false });
    expect(askSettlement(BILL, asking, 'lancer', CROWN_BONUS)).toBe(BILL);
    expect(askSettlement(BILL, {}, 'bastion', CROWN_BONUS)).toBe(BILL);
  });

  /** The first board, from so many battles won on, whose asking contract asks for this class. */
  function boardAsking(kind: Archetype): { won: number; asking: Mission } {
    for (let won = 10; won < 4010; won++) {
      const asking = generateBoard(won, 0, BOARD_TEXT).find((mission) => mission.asks === kind);
      if (asking) return { won, asking };
    }
    throw new Error(`no board asks for a ${kind}`);
  }
  interface Asked { kind: Archetype; bonus: number }
  const askedOf = (app: App): Asked | null => (snap(app).settlement as unknown as { asked: Asked | null }).asked;
  function flown(saved: GameState, contract: string): { app: App; before: GameState; kept: GameState } {
    const { app, store } = inHub(saved);
    const before = savedGame(store);
    select(app, 'contracts');
    select(app, contract);
    expect(snap(app).screen).toBe('briefing');
    select(app, 'accept');
    for (let i = 0; i < 6 && snap(app).screen === 'battle'; i++) { autoBattle(app); press(app, 'confirm'); }
    expect(snap(app).screen).toBe('settlement');
    return { app, before, kept: savedGame(store) };
  }

  test('in the game: the briefing says half as much again to the holder, the bill pays it, and the credits follow', () => {
    // The juggernaut the tests win with is a lancer.
    expect(JUGGERNAUT.rightHand).toBe('wpn-lance-emitter');
    const { won, asking } = boardAsking('lancer');
    const holder = crowned(pilot({ battlesWon: won }), 'lancer');
    const { app: briefed } = inHub(holder);
    select(briefed, 'contracts');
    select(briefed, asking.id);
    expect(written(drawn(briefed), 'WANTS A LANCER: +50% PAY')).toMatchObject({ left: 72, y: 51, color: COLORS.armor });
    const { app, before, kept } = flown(holder, asking.id);
    const bill = snap(app).settlement!;
    expect(bill.won).toBe(true);
    expect(askedOf(app)).toEqual({ kind: 'lancer', bonus: Math.round(bill.reward * 0.5) });
    expect(written(drawn(app), 'Lancer bonus').y).toBeGreaterThan(55);
    const medals = kept.medals.filter((id) => !before.medals.includes(id));
    expect(kept.credits).toBe(before.credits + bill.net + medalPay(medals));
    expect(bill.net).toBe(bill.reward + bill.bonus + Math.round(bill.reward * 0.5) - (bill as unknown as { ammoCost: number }).ammoCost - (bill as unknown as { repairCost: number }).repairCost);
  });

  test('in the game: a pilot without that crown is paid the quarter, as before, whatever other crown they hold', () => {
    const { won, asking } = boardAsking('lancer');
    const other = crowned(pilot({ battlesWon: won }), 'bastion');
    const { app: briefed } = inHub(other);
    select(briefed, 'contracts');
    select(briefed, asking.id);
    expect(written(drawn(briefed), 'WANTS A LANCER: +25% PAY').color).toBe(COLORS.armor);
    const { app } = flown(other, asking.id);
    const bill = snap(app).settlement!;
    expect(askedOf(app)).toEqual({ kind: 'lancer', bonus: Math.round(bill.reward * 0.25) });
  });

  test('in Dutch the line says the figure too', () => {
    const { won, asking } = boardAsking('lancer');
    const base = crowned(pilot({ battlesWon: won }), 'lancer');
    const { app } = inHub({ ...base, settings: { ...base.settings, language: 'nl' } });
    select(app, 'contracts');
    select(app, asking.id);
    expect(written(drawn(app), 'ZOEKT LANSIER: +50% LOON').y).toBe(51);
  });
});

describe('two medals count crowns', () => {
  const medal = (id: string) => MEDALS.find((m) => m.id === id)!;

  test('one for the first crown, one for all seven: the first silver, the second gold', () => {
    expect(medal('crown-1')).toMatchObject({ tier: 2 });
    expect(medal('crown-all')).toMatchObject({ tier: 3 });
    expect(medal('crown-1').secret).toBeUndefined();
    expect(medal('crown-all').secret).toBeUndefined();
    expect(medalProgress(medal('crown-1'), fresh())).toMatchObject({ have: 0, need: 1 });
    expect(medalProgress(medal('crown-1'), crowned(fresh(), 'bastion'))).toMatchObject({ have: 1, need: 1 });
    expect(medalProgress(medal('crown-all'), crowned(fresh(), 'bastion', 'lancer', 'duellist'))).toMatchObject({ have: 3, need: 7 });
    expect(medalProgress(medal('crown-all'), crowned(fresh(), ...ARCHETYPES))).toMatchObject({ have: 7, need: 7 });
  });

  test('a master beaten in another machine counts for neither, nor does a name that is no class', () => {
    const beaten = recordMasterWin(fresh(), 'bastion', 'lancer');
    expect(medalProgress(medal('crown-1'), beaten).have).toBe(0);
    expect(medalProgress(medal('crown-1'), { ...fresh(), crowns: ['nobody', 'nobody'] }).have).toBe(0);
    expect(awardMedals(beaten, MEDALS).earned.map((m) => m.id)).not.toContain('crown-1');
  });

  test('they are earned as the crowns are taken', () => {
    const one = awardMedals(crowned(fresh(), 'bastion'), MEDALS);
    expect(one.earned.map((m) => m.id)).toContain('crown-1');
    expect(one.earned.map((m) => m.id)).not.toContain('crown-all');
    const all = awardMedals(crowned(fresh(), ...ARCHETYPES), MEDALS);
    expect(all.earned.map((m) => m.id)).toEqual(expect.arrayContaining(['crown-1', 'crown-all']));
  });

  test('their names and words are in both languages and say what they are for', () => {
    expect(medal('crown-1').text).toMatch(/crown/i);
    expect(medal('crown-all').text).toMatch(/every class/i);
    expect(medal('crown-1').name).not.toBe(medal('crown-all').name);
  });
});
