import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import { DIFFICULTY_SCALE, type GameState } from '../../src/core/game';
import { masterId } from '../../src/core/masters';
import { MIX_SLOTS } from '../../src/core/mix';
import { xpForLevel } from '../../src/core/pilot';
import { SEAT_ID, seatHeld } from '../../src/core/seat';
import { tunable } from '../../src/core/tuning';
import type { Build } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { KEEPER } from '../../src/content/seat';
import { STRINGS } from '../../src/content/strings';
import { TOAST_MS, type App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { battleTrack } from '../../src/ui/soundtrack';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS, CROWN_COLOR, LINE, charsFor, wrap } from '../../src/ui/widgets';
import { autoBattle, done, inHub, press, savedGame, select, snap } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The eighth seat of the arena's masters, as the player meets it: the row under the seven classes, the
 * briefing, the duel, the bill that says the seat changed hands, and what is kept of it.
 */

afterEach(() => setLanguage('en'));

const A = STRINGS.arena;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const late = (kind: Archetype): Build => ARCHETYPE_BUILDS[kind].late;
const CROWNED = { masters: [...ARCHETYPES], crowns: [...ARCHETYPES] };
/**
 * A champion of the ladder who has everything a pilot can have: every perk that helps in a fight, the bench's
 * last step on every part worn, and the game set to its gentlest. These tests are about what follows the duel,
 * not about winning it.
 */
function champion(build: Build, extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  const worn = wearing(story, build);
  const tuning = Object.fromEntries(Object.values(build).filter((id): id is string => id !== undefined && tunable(CATALOG[id])).map((id) => [id, 5]));
  return {
    ...worn, codex: WORLD.map((entry) => entry.id), scenes: ['act-1', 'act-2'], arenaRank: 10, cycle: 3, xp: xpForLevel(20), credits: 5000,
    perks: { marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 }, tuning,
    settings: { ...worn.settings, difficulty: 'story' }, lessons: ['momentum', 'rout'], ...extra,
  };
}
/** Into the arena, on to its second page and down to the row under the seven classes. */
function atSeat(saved: GameState, seed?: number, deps: Parameters<typeof inHub>[2] = {}): ReturnType<typeof inHub> {
  const made = inHub(saved, seed, deps);
  select(made.app, 'arena');
  press(made.app, 'next');
  expect(snap(made.app).page).toBe('masters');
  for (let i = 0; i < 12 && snap(made.app).menu.items[snap(made.app).menu.cursor]?.id !== SEAT_ID; i++) press(made.app, 'down');
  expect(snap(made.app).menu.items[snap(made.app).menu.cursor]?.id).toBe(SEAT_ID);
  return made;
}
interface SeatView { state: string; crowns: number }
const seatShown = (app: App): SeatView | null => (snap(app) as unknown as { seat: SeatView | null }).seat;
const row = (app: App) => snap(app).menu.items.find((item) => item.id === SEAT_ID)!;
interface Bill { won: boolean; reward: number; seated: boolean; crowned: Archetype | null }
const bill = (app: App): Bill => snap(app).settlement as unknown as Bill;
/** From the seat's row: challenges, accepts, and flies the duel on Auto Turn to its settlement. */
function duel(app: App): void {
  press(app, 'confirm');
  expect(snap(app).screen).toBe('briefing');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
  autoBattle(app);
  press(app, 'confirm');
  expect(snap(app).screen).toBe('settlement');
}
/** The duel flown until it ends as these tests need it to: the same pilot, with whatever seed first gives that. */
function ended(saved: GameState, won: boolean): ReturnType<typeof inHub> {
  for (let seed = 1; seed <= 16; seed++) {
    const made = atSeat(saved, seed);
    duel(made.app);
    if (bill(made.app).won === won) return made;
  }
  throw new Error(`no duel ${won ? 'won' : 'lost'} in sixteen tries`);
}

describe('the row under the seven classes', () => {
  test('is there from the start, for a pilot the masters do not take yet: locked, counting the crowns it asks for', () => {
    const { app } = atSeat(champion(late('duellist'), { arenaRank: 9 }));
    expect(snap(app).menu.items.map((item) => item.id)).toEqual([...ARCHETYPES.map(masterId), SEAT_ID]);
    expect(row(app)).toEqual({ id: SEAT_ID, label: 'The Eighth Seat', enabled: false, note: '0/7' });
    expect(seatShown(app)).toEqual({ state: 'locked', crowns: 0 });
    // No master is under the cursor there, and no seat is while it is on a master.
    expect((snap(app) as unknown as { master: unknown }).master).toBeNull();
    press(app, 'up');
    expect(seatShown(app)).toBeNull();
    expect((snap(app) as unknown as { master: { kind: string } }).master.kind).toBe('allrounder');
  });

  test('counts the crowns held, and does not open for six of them', () => {
    for (const held of [1, 3, 6]) {
      const crowns = ARCHETYPES.slice(0, held);
      const { app } = atSeat(champion(late('duellist'), { masters: [...ARCHETYPES], crowns }));
      expect(row(app)).toMatchObject({ enabled: false, note: `${held}/7` });
      expect(seatShown(app)).toEqual({ state: 'locked', crowns: held });
      // A does nothing on it.
      press(app, 'confirm');
      expect(snap(app).screen).toBe('arena');
    }
  });

  test('under the list while it is locked: the keeper by name, what they keep, and whom they take a challenge from', () => {
    const { app } = atSeat(champion(late('duellist'), { crowns: ['duellist', 'bastion'], masters: ['duellist', 'bastion'] }));
    const shown = drawn(app);
    expect(written(shown, 'TOUCHSTONE')).toMatchObject({ left: 12, y: 189, size: 16, color: COLORS.accent });
    expect(written(shown, 'LOCKED')).toMatchObject({ right: LOGICAL_W - 12, y: 191, color: COLORS.danger });
    // What they keep stands beside the name, on its row.
    expect(written(shown, 'KEEPER OF THE EIGHTH SEAT')).toMatchObject({ y: 191, color: COLORS.armor });
    expect(written(shown, 'KEEPER OF THE EIGHTH SEAT').left - written(shown, 'TOUCHSTONE').right).toBeGreaterThanOrEqual(8);
    const rows = wrap(A.seat.locked, charsFor(LOGICAL_W - 28));
    expect(rows.length).toBeLessThanOrEqual(3);
    rows.forEach((text, i) => expect(written(shown, text)).toMatchObject({ left: 12, y: 207 + i * LINE }));
    expect(A.seat.locked).toContain('all seven crowns');
    // How the keeper fights is not said to a pilot they do not take yet.
    expect(shown.texts.some((t) => t.text.includes('charging rail'))).toBe(false);
    // The crowns are counted over the list as on any row of this page, and the list's own count is on the row.
    expect(written(shown, 'CROWNS 2/7')).toMatchObject({ left: 10, y: 22 });
    // (Where every row's note ends: the list is 134 wide from 10.)
    expect(written(shown, '2/7').right).toBe(144);
    expect(shown.texts.filter((t) => t.text === '9000').every((t) => t.right === 144)).toBe(true);
    expect(written(shown, 'The Eighth Seat').color).toBe(COLORS.dim);
    // Nothing on the page runs into anything else or off it.
    for (const a of shown.texts) {
      expect(a.right, a.text).toBeLessThanOrEqual(LOGICAL_W - 4);
      for (const b of shown.texts) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    }
  });

  test('beside the list stands the keeper\'s machine in the keeper\'s paint, from the start: what is to be had is on show', () => {
    const asked: string[] = [];
    const painting: SpriteStore = {
      get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }),
      painted: (id, paint, fallback) => { asked.push(`${paint}:${id.split('.')[0]}`); return { image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }; },
    };
    for (const extra of [{}, CROWNED, { ...CROWNED, seat: true as const }]) {
      const { app } = atSeat(champion(late('duellist'), extra), undefined, { sprites: painting });
      asked.length = 0;
      drawn(app);
      expect(asked.length).toBeGreaterThan(0);
      expect(asked.every((entry) => entry.startsWith('touchstone:'))).toBe(true);
      for (const part of ['head-sovereign', 'core-sovereign', 'arms-sovereign', 'legs-sovereign']) expect(asked).toContain(`touchstone:${part}`);
      // A row up it is the all-rounders' master again.
      press(app, 'up');
      asked.length = 0;
      drawn(app);
      expect(asked.some((entry) => entry.startsWith('touchstone:'))).toBe(false);
    }
  });

  test('with every crown held it opens: the purse on the row, the word OPEN, and how the keeper fights', () => {
    const { app } = atSeat(champion(late('marksman'), CROWNED));
    expect(row(app)).toEqual({ id: SEAT_ID, label: 'The Eighth Seat', enabled: true, note: '15000' });
    expect(seatShown(app)).toEqual({ state: 'open', crowns: 7 });
    const shown = drawn(app);
    expect(written(shown, 'OPEN')).toMatchObject({ right: LOGICAL_W - 12, y: 191, color: COLORS.armor });
    expect(written(shown, 'KEEPER OF THE EIGHTH SEAT').y).toBe(191);
    const rows = wrap(KEEPER.style, charsFor(LOGICAL_W - 28));
    rows.forEach((text, i) => expect(written(shown, text)).toMatchObject({ left: 12, y: 207 + i * LINE }));
    expect(shown.texts.some((t) => t.text.includes('who takes one challenge'))).toBe(false);
    expect(written(shown, 'CROWNS 7/7').y).toBe(22);
    expect(written(shown, 'The Eighth Seat').color).not.toBe(COLORS.dim);
    for (const a of shown.texts) for (const b of shown.texts) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });
});

describe('the briefing', () => {
  test('is a master\'s, with the seat\'s own heading and no line that asks for a class: any build may come', () => {
    const { app } = atSeat(champion(late('marksman'), CROWNED));
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing' });
    const shown = drawn(app);
    expect(written(shown, 'TOUCHSTONE')).toMatchObject({ left: 72, y: 8, size: 16 });
    expect(written(shown, 'THE EIGHTH SEAT: one against one, for the seat').left).toBe(72);
    // The heading is one line where it stands, in either language: nothing of it runs on to a second or is cut.
    for (const tag of [STRINGS.arena.seat.tag, STRINGS_NL.arena.seat.tag]) expect(wrap(tag, charsFor(LOGICAL_W - 84)), tag).toHaveLength(1);
    expect(shown.texts.filter((t) => t.left === 72 && t.y > 26 && t.y < 64).map((t) => t.text)).toEqual(['THE EIGHTH SEAT: one against one, for the seat']);
    expect(shown.texts.some((t) => /^CROWN:/.test(t.text) || t.text === A.masters.held || t.text === A.masters.tag)).toBe(false);
    expect((snap(app).briefing as unknown as { crown: unknown }).crown).toBeNull();
    // How the keeper fights and what they say, as a master's briefing has it.
    const body = shown.texts.map((t) => t.text).join(' ');
    expect(body).toContain('charging rail');
    expect(body).toContain('"Seven crowns.');
    expect(shown.texts.some((t) => t.text.includes('15000'))).toBe(true);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    // B goes back to the row it came from.
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'arena', page: 'masters' });
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe(SEAT_ID);
  });

  test('the duel is one against one in the arena against the keeper, as hard as the keeper is set and the game is set, to the song a boss is fought to', () => {
    const { app } = atSeat(champion(late('marksman'), CROWNED));
    press(app, 'confirm');
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ mission: SEAT_ID, index: 0, of: 1, enemies: [SEAT_ID] });
    expect(snap(app).battle!.enemyScale).toBeCloseTo(KEEPER.scale * DIFFICULTY_SCALE.story, 5);
    const mission = (app as unknown as { current: { mission: Parameters<typeof battleTrack>[0] } }).current.mission;
    // A machine that changes as it is hurt is a boss, and the last word goes to the boss song: a master's duel has the arena's.
    expect(battleTrack(mission, 0, ALL_ENEMIES)).toBe('boss');
    expect(mission.crown).toBeUndefined();
  });
});

describe('the duel is for the holder of every crown', () => {
  test('asked for by a pilot who holds fewer, however it is asked, there is no briefing: the row cannot be entered, and the app would not open one', () => {
    for (const crowns of [[], ARCHETYPES.slice(0, 6)]) {
      const { app } = atSeat(champion(late('marksman'), { masters: [...ARCHETYPES], crowns }));
      press(app, 'confirm');
      expect(snap(app).screen).toBe('arena');
      // Past the row: asked of the app itself, as a screen would.
      app.openSeatBriefing();
      expect(snap(app).screen).toBe('arena');
    }
    // With all seven the same asking opens it.
    const { app } = atSeat(champion(late('marksman'), CROWNED));
    app.openSeatBriefing();
    expect(snap(app).screen).toBe('briefing');
  });
});

describe('the duel won', () => {
  test('the seat is the pilot\'s: said on the bill in the keeper\'s own words and in a notice, and kept', () => {
    const { app, store } = ended(champion(late('marksman'), CROWNED), true);
    expect(bill(app)).toMatchObject({ won: true, reward: 15000, seated: true, crowned: null });
    const kept = savedGame(store);
    expect(seatHeld(kept)).toBe(true);
    expect(kept.seat).toBe(true);
    // The crowns are what they were.
    expect([...(kept.crowns ?? [])].sort()).toEqual([...ARCHETYPES].sort());
    const shown = drawn(app);
    expect(written(shown, 'THE SEAT IS YOURS')).toMatchObject({ y: 26, size: 16, color: COLORS.accent });
    expect(shown.texts.some((t) => t.text === STRINGS.settlement.won || t.text === STRINGS.settlement.crowned)).toBe(false);
    // The keeper's own words, and after them where the keeper's machine is to be had: in the three rows there are for it.
    const words = shown.texts.filter((t) => t.y >= 144 && t.y < 180);
    expect(words.map((t) => t.text).join(' ')).toBe(`"${KEEPER.concede}" ${A.seat.win}`);
    expect(A.seat.win).toBe('The yard that built its machine takes your order now.');
    expect(words.length).toBeLessThanOrEqual(3);
    expect(Math.max(...words.map((t) => t.y))).toBeLessThan(180 - LINE + 2);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    // The notice waits its turn behind whatever else is being announced.
    expect([snap(app).toast, ...snap(app).toasts]).toContain('seat');
    for (let i = 0; i < 40 && snap(app).toast !== 'seat'; i++) app.update(TOAST_MS + 1);
    expect(snap(app).toast).toBe('seat');
    const notice = drawn(app);
    expect(notice.texts.some((t) => t.text === 'SEAT TAKEN')).toBe(true);
    expect(notice.texts.some((t) => t.text === 'The Eighth Seat')).toBe(true);
    for (const t of notice.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
  });

  test('the row then says so, and a second duel is for a quarter of the purse and takes nothing: no heading, no notice', () => {
    const first = ended(champion(late('marksman'), CROWNED), true);
    const holder = savedGame(first.store);
    const { app } = atSeat(holder);
    expect(row(app)).toEqual({ id: SEAT_ID, label: 'The Eighth Seat', enabled: true, note: 'SEAT' });
    expect(seatShown(app)).toEqual({ state: 'held', crowns: 7 });
    // The word stands twice: on the row, where a crown's stands on a master's, and in the panel, where OPEN stood.
    const words = drawn(app).texts.filter((t) => t.text === 'SEAT');
    expect(words).toHaveLength(2);
    expect(words.some((t) => t.y === 191 && t.right === LOGICAL_W - 12 && t.color === COLORS.accent)).toBe(true);
    expect(words.some((t) => t.right === 144)).toBe(true);
    // Fought again and won again.
    const again = ended(holder, true);
    expect(bill(again.app)).toMatchObject({ won: true, reward: 3750, seated: false });
    const shown = drawn(again.app);
    // It is billed as the rematch it is.
    expect(written(shown, STRINGS.settlement.rematchWon).y).toBe(26);
    expect(shown.texts.some((t) => t.text === 'THE SEAT IS YOURS')).toBe(false);
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe(A.win);
    expect([snap(again.app).toast, ...snap(again.app).toasts]).not.toContain('seat');
    expect(savedGame(again.store).seat).toBe(true);
    expect(savedGame(again.store).rematches).toEqual({ [SEAT_ID]: 1 });
  });

  test('a game loaded with the seat has it without ceremony', () => {
    const { app } = inHub(champion(late('marksman'), { ...CROWNED, seat: true }));
    expect([snap(app).toast, ...snap(app).toasts]).not.toContain('seat');
  });
});

describe('the duel lost', () => {
  test('nothing is taken and nothing is kept of it: the row is as open as it was', () => {
    // A pilot with seven crowns on paper and nothing else: the starter's own late build, no perks, the game at its hardest.
    const weak: GameState = { ...champion(late('skirmisher'), CROWNED), perks: {}, tuning: {}, settings: { ...champion(late('skirmisher')).settings, difficulty: 'veteran' } };
    const { app, store } = ended(weak, false);
    expect(bill(app)).toMatchObject({ won: false, seated: false });
    expect(savedGame(store).seat).toBeUndefined();
    expect(drawn(app).texts.some((t) => t.text === 'THE SEAT IS YOURS')).toBe(false);
    expect([snap(app).toast, ...snap(app).toasts]).not.toContain('seat');
    const back = atSeat(savedGame(store));
    expect(row(back.app)).toMatchObject({ enabled: true, note: '15000' });
    expect(seatShown(back.app)).toEqual({ state: 'open', crowns: 7 });
  });
});

describe('in Dutch', () => {
  test('the row, the panel, the briefing\'s heading and the bill', () => {
    const base = champion(late('marksman'), CROWNED);
    const dutch: GameState = { ...base, settings: { ...base.settings, language: 'nl' } };
    const { app } = atSeat(dutch);
    expect(row(app)).toMatchObject({ label: 'De achtste stoel', note: '15000' });
    let shown = drawn(app);
    expect(written(shown, 'TOUCHSTONE').y).toBe(189);
    expect(written(shown, 'HOUDER VAN DE ACHTSTE STOEL').y).toBe(191);
    expect(shown.texts.some((t) => t.text.includes('oplaadrail'))).toBe(true);
    for (const a of shown.texts) {
      expect(a.right, a.text).toBeLessThanOrEqual(LOGICAL_W - 4);
      for (const b of shown.texts) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    }
    press(app, 'confirm');
    shown = drawn(app);
    expect(written(shown, 'DE ACHTSTE STOEL: een tegen een, om de stoel').left).toBe(72);
    expect(shown.texts.map((t) => t.text).join(' ')).toContain('"Zeven kronen.');
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    // Locked, it says in Dutch whom the keeper takes.
    const locked = atSeat({ ...dutch, crowns: ['bastion'], masters: ['bastion'] }).app;
    expect(row(locked)).toMatchObject({ label: 'De achtste stoel', note: '1/7', enabled: false });
    expect(drawn(locked).texts.map((t) => t.text).join(' ')).toContain('alle zeven kronen');
    // Won, the bill is headed in Dutch and the keeper concedes in Dutch.
    const made = ended(dutch, true);
    const won = drawn(made.app);
    expect(written(won, 'DE STOEL IS VAN JOU').y).toBe(26);
    const woorden = won.texts.filter((t) => t.y >= 144 && t.y < 180);
    expect(woorden.map((t) => t.text).join(' ')).toBe('"Hij werd alleen warmgehouden. Ga zitten, piloot." De werf van zijn machine neemt nu jouw order aan.');
    expect(woorden.length).toBeLessThanOrEqual(3);
    for (let i = 0; i < 40 && snap(made.app).toast !== 'seat'; i++) made.app.update(TOAST_MS + 1);
    const notice = drawn(made.app);
    expect(notice.texts.some((t) => t.text === 'STOEL GEPAKT')).toBe(true);
    expect(notice.texts.some((t) => t.text === 'De achtste stoel')).toBe(true);
  });
});

describe('where the seat is seen and what comes of it', () => {
  function onClasses(saved: GameState): App {
    const { app } = inHub(saved);
    select(app, 'pilot');
    for (let i = 0; i < 6 && snap(app).page !== 'classes'; i++) press(app, 'next');
    expect(snap(app).page).toBe('classes');
    return app;
  }

  test('the pilot\'s page of classes says so where the crowns were counted: every row has its crown, and the count has nothing left to say', () => {
    const before = drawn(onClasses(champion(late('marksman'), CROWNED)));
    expect(written(before, 'CROWNS 7/7')).toMatchObject({ right: 273, y: 22, size: 10, color: COLORS.dim });
    expect(before.texts.some((t) => t.text === 'THE EIGHTH SEAT')).toBe(false);
    const held = drawn(onClasses(champion(late('marksman'), { ...CROWNED, seat: true })));
    // It ends short of the column of crowns: two letters and more lie between it and the word over the next column.
    expect(written(held, 'THE EIGHTH SEAT')).toMatchObject({ right: 261, y: 22, size: 10, color: CROWN_COLOR });
    const beside = held.texts.filter((t) => t.y === 22 && t.left > 261).sort((a, b) => a.left - b.left)[0];
    expect(beside.left - 261).toBeGreaterThanOrEqual(12);
    expect(held.texts.some((t) => /^CROWNS /.test(t.text))).toBe(false);
    // Nothing in that row of the page runs into anything else, in either language.
    const header = held.texts.filter((t) => t.y === 22);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    const base = champion(late('marksman'), { ...CROWNED, seat: true });
    const dutch = drawn(onClasses({ ...base, settings: { ...base.settings, language: 'nl' } }));
    expect(written(dutch, 'DE ACHTSTE STOEL')).toMatchObject({ right: 261, y: 22, color: CROWN_COLOR });
    const kop = dutch.texts.filter((t) => t.y === 22);
    for (const a of kop) for (const b of kop) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });

  test('taking it earns the medal and brings the yard\'s letter; the keeper\'s paint is in the garage and the Sovereign in the shop', () => {
    const { app, store } = ended(champion(late('marksman'), CROWNED), true);
    const kept = savedGame(store);
    expect(kept.medals).toContain('seat');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    // The letter is among the messages, unread.
    select(app, 'messages');
    expect(snap(app).menu.items.map((item) => item.id)).toContain('seat-yard');
    press(app, 'cancel');
    // The garage: L1 from the factory's colours, past the pilot's own three mixes, is the last paint that is won, which is the keeper's now.
    select(app, 'garage');
    for (let i = 0; i <= MIX_SLOTS; i++) press(app, 'prev');
    expect(savedGame(store).paint).toBe('touchstone');
    expect(drawn(app).texts.some((t) => t.text === STRINGS.garage.paint('Touchstone'))).toBe(true);
    press(app, 'cancel');
    // The shop: the four parts, at the prices the yard asks.
    select(app, 'shop');
    expect(snap(app).menu.items.find((item) => item.id === 'head-sovereign')).toMatchObject({ label: 'Sovereign Crest' });
  });

  test('a pilot with seven crowns and no seat has the invitation and none of the rest', () => {
    const { app, store } = inHub(champion(late('marksman'), CROWNED));
    expect(savedGame(store).medals ?? []).not.toContain('seat');
    select(app, 'messages');
    const letters = snap(app).menu.items.map((item) => item.id);
    expect(letters).toContain('seat-open');
    expect(letters).not.toContain('seat-yard');
    press(app, 'cancel');
    select(app, 'garage');
    for (let i = 0; i <= MIX_SLOTS; i++) {
      press(app, 'prev');
      expect(savedGame(store).paint).not.toBe('touchstone');
    }
    press(app, 'cancel');
    select(app, 'shop');
    expect(snap(app).menu.items.some((item) => item.id === 'head-sovereign')).toBe(false);
  });
});
