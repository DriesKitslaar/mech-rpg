import { MECH_ENEMIES, POOL, generateBoard } from '../../src/core/board';
import type { GameState } from '../../src/core/game';
import { GRUDGE, ledger, type Grudge } from '../../src/core/grudge';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT, GRUDGE_FACES, GRUDGE_NAMES, ledgerText } from '../../src/content/board';
import { PEOPLE } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { PAGE_CHARS, PERSON_LINES } from '../../src/ui/databaseScreen';
import { forgetWords } from '../../src/ui/signType';
import { wrap } from '../../src/ui/widgets';
import { JUGGERNAUT, accept, done, finishMission, ids, inHub, makeApp, pastLaunch, press, savedGame, select, snap, strong, toHub } from '../helpers/app';
import { record, signIn, type Drawn } from '../helpers/canvas';

/**
 * The pilots of an account as the player meets them beyond the fight itself: the band a meeting
 * opens on, the announcement when an account begins, and their page in the database.
 */
afterEach(() => { setLanguage('en'); forgetWords(); });

const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const pilot = (wins: number, extra: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins, credits: 5000, scenes: ['act-1'], ...extra });
const dutch = (game: GameState): GameState => ({ ...game, settings: { ...game.settings, language: 'nl' } });
const account = (change: Partial<Grudge> = {}): Grudge => ({ name: 'Brakk', kind: 'heavy-mech', origin: 'wrecked', knows: JUGGERNAUT.rightHand, met: 1, waited: 2, ...change });
const noticeId = (wins: number): string => `open-0-${wins}-${GRUDGE}`;
/** What is being announced, and what is waiting to be. */
const announced = (app: App): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => id !== null);

describe('a meeting opens as a boss\'s battle does', () => {
  /** The first frames of a battle taken from the hub at a walking pace, with its banner up. */
  function opened(game: GameState, mission: string): Drawn {
    const { app } = makeApp(game, 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(16); press(app, 'confirm'); }
    select(app, 'contracts');
    select(app, mission);
    for (let i = 0; i < 200 && snap(app).screen !== 'briefing'; i++) app.update(16);
    select(app, 'accept');
    for (let i = 0; i < 400 && snap(app).screen !== 'battle'; i++) app.update(16);
    pastLaunch(app);
    // Well into the band's time: it has come in and holds.
    for (let i = 0; i < 40; i++) app.update(16);
    expect((snap(app).battle as { mission: string }).mission).toBe(mission);
    return drawn(app);
  }
  const sign = (page: Drawn, word: string) => signIn(page, word, 'red') ?? signIn(page, word, 'amber');

  test('the band, under the notice\'s own word and not the warning, with their callsign in the sign\'s letters', () => {
    const page = opened(pilot(22, { grudge: account() }), noticeId(22));
    expect(STRINGS.battleIntro.overdue).toBe('OVERDUE');
    expect(sign(page, STRINGS.battleIntro.overdue)).not.toBeNull();
    expect(sign(page, STRINGS.battleIntro.warning)).toBeNull();
    expect(signIn(page, 'BRAKK', 'steel')).not.toBeNull();
    // Their machine in the band's window: a picture drawn at twice its size, beside the words.
    expect(page.rects.some((r) => r.color === 'rgba(40, 8, 14, 0.9)')).toBe(true);
  });

  test('at every meeting and under every callsign: the first, when they know nothing, as the third', () => {
    for (const [name, met] of [[GRUDGE_NAMES[10], 0], [GRUDGE_NAMES[15], 2]] as const) {
      const { knows: _, ...unknowing } = account({ name, met, waited: 3 });
      const page = opened(pilot(22, { grudge: met === 0 ? unknowing : account({ name, met, waited: 3 }) }), noticeId(22));
      expect(sign(page, STRINGS.battleIntro.overdue), name).not.toBeNull();
      expect(signIn(page, name.toUpperCase(), 'steel'), name).not.toBeNull();
    }
  });

  test('in Dutch the word is the notice\'s Dutch one', () => {
    const page = opened(dutch(pilot(22, { grudge: account() })), noticeId(22));
    expect(STRINGS_NL.battleIntro.overdue).toBe('VERVALLEN');
    expect(sign(page, STRINGS_NL.battleIntro.overdue)).not.toBeNull();
    expect(signIn(page, 'BRAKK', 'steel')).not.toBeNull();
  });

  test('a contract of the board opens with its own banner: no band, no word of the notice', () => {
    const board = generateBoard(22, 0, BOARD_TEXT)[0];
    const page = opened(pilot(22, { grudge: account() }), board.id);
    expect(sign(page, STRINGS.battleIntro.overdue)).toBeNull();
    expect(sign(page, STRINGS.battleIntro.warning)).toBeNull();
    expect(page.rects.some((r) => r.color === 'rgba(40, 8, 14, 0.9)')).toBe(false);
    expect(page.texts.map((t) => t.text)).toContain(board.title.toUpperCase());
  });
});

describe('the moment an account begins', () => {
  /** The first progress of the third tier whose lightest contract has a mech of the board in it. */
  const wins = Array.from({ length: 30 }, (_, i) => 15 + i).find((w) => generateBoard(w, 0, BOARD_TEXT)[0].battles.some((b) => b.enemies.some((id) => MECHS.includes(id))))!;
  const contract = generateBoard(wins, 0, BOARD_TEXT)[0];

  test('is announced over the bill of the contract it began in: that an account is opened, and the callsign', () => {
    const { app, store } = inHub(pilot(wins));
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([]);
    accept(app, contract.id);
    finishMission(app);
    expect(snap(app).screen).toBe('settlement');
    const begun = savedGame(store).grudge!;
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([`account:${begun.name}`]);
    // Shown, it says so in the words the game has for it.
    for (let i = 0; i < 80 && snap(app).toast !== `account:${begun.name}`; i++) app.update(snap(app).toast === null ? 16 : 3000);
    expect(snap(app).toast).toBe(`account:${begun.name}`);
    const words = drawn(app).texts.map((t) => t.text);
    expect(words).toContain(STRINGS.accounts.opened);
    expect(words).toContain(STRINGS.accounts.callsign(begun.name));
    expect([STRINGS.accounts.opened, STRINGS.accounts.callsign('Brakk')]).toEqual(['ACCOUNT OPENED', 'Callsign Brakk']);
    expect([STRINGS_NL.accounts.opened, STRINGS_NL.accounts.callsign('Brakk')]).toEqual(['REKENING GEOPEND', 'Roepnaam Brakk']);
  });

  test('once: the contracts waited through after it, a game that is loaded with it and a meeting won announce nothing', () => {
    const { app, store } = inHub(pilot(wins));
    accept(app, contract.id);
    finishMission(app);
    const name = savedGame(store).grudge!.name;
    for (let i = 0; i < 200 && announced(app).length > 0; i++) app.update(3000);
    toHub(app);
    accept(app, `open-0-${wins + 1}-0`);
    finishMission(app);
    expect(savedGame(store).grudge).toMatchObject({ name, waited: 1 });
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([]);
    // Loaded with an account open.
    const loaded = inHub(pilot(22, { grudge: account() }));
    expect(announced(loaded.app).filter((id) => id.startsWith('account:'))).toEqual([]);
    // A meeting won.
    accept(loaded.app, noticeId(22));
    finishMission(loaded.app);
    expect(savedGame(loaded.store).grudge).toMatchObject({ name: 'Brakk', met: 2 });
    expect(announced(loaded.app).filter((id) => id.startsWith('account:'))).toEqual([]);
  });

  test('the third meeting closes one, and the next contract with a mech in it opens another: that one is announced', () => {
    const { app, store } = inHub(pilot(wins - 1, { grudge: account({ met: 2 }) }));
    accept(app, noticeId(wins - 1));
    finishMission(app);
    expect(savedGame(store).grudge).toBeUndefined();
    expect(savedGame(store).accounts).toEqual(['Brakk']);
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([]);
    for (let i = 0; i < 200 && announced(app).length > 0; i++) app.update(3000);
    toHub(app);
    accept(app, contract.id);
    finishMission(app);
    const next = savedGame(store).grudge!;
    expect(next.name).not.toBe('Brakk');
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([`account:${next.name}`]);
  });
});

describe('their page in the database', () => {
  const D = STRINGS.database;
  type Shown = { title: string; portrait?: string; role?: string; lines: string[] };
  const detail = (app: App): Shown => (snap(app) as unknown as { detail: Shown }).detail;
  const count = (app: App): string => (snap(app) as unknown as { count: string }).count;
  /** From the hub to the database's page of people. */
  function toPeople(app: App): void {
    select(app, 'database');
    press(app, 'next');
    expect(snap(app).page).toBe('people');
  }
  const story = PEOPLE.map((person) => person.id);
  const knownOf = (app: App): number => snap(app).menu.items.filter((item) => item.enabled && !item.id.startsWith('account:')).length;

  test('nobody is listed before an account with them begins: the page is the people of the story, counted as they were', () => {
    const { app } = inHub(pilot(22));
    toPeople(app);
    expect(ids(app)).toEqual(story);
    expect(count(app)).toBe(D.known(knownOf(app), PEOPLE.length));
    expect(count(app)).not.toContain('ACCOUNTS');
  });

  test('the one that is open stands first, then the closed ones, then the people of the story; and the count says how many accounts there are', () => {
    const state = pilot(22, { grudge: account({ met: 1, waited: 1 }), accounts: ['Tally', 'Docket'] });
    const { app } = inHub(state);
    toPeople(app);
    expect(ids(app).slice(0, 3)).toEqual(['account:Brakk', 'account:Tally', 'account:Docket']);
    expect(ids(app).slice(3)).toEqual(story);
    expect(snap(app).menu.items.slice(0, 3).map((item) => [item.label, item.enabled])).toEqual([['Brakk', true], ['Tally', true], ['Docket', true]]);
    expect(snap(app).menu.cursor).toBe(0);
    expect(count(app)).toBe(`${D.known(knownOf(app), PEOPLE.length)}   ${D.accounts(3)}`);
    expect(D.accounts(3)).toBe('ACCOUNTS 3');
    // The people of the story are counted as they are without the accounts.
    const plain = inHub(pilot(22)).app;
    toPeople(plain);
    expect(knownOf(app)).toBe(knownOf(plain));
  });

  test('the open one: their face, that the account is open, and what there is to know of it, every line on the page', () => {
    const state = pilot(22, { grudge: account({ met: 1, waited: 1 }) });
    const { app } = inHub(state);
    toPeople(app);
    const [entry] = ledger(state);
    const lines = wrap(ledgerText(entry, CALLED), PAGE_CHARS);
    expect(detail(app)).toEqual({ title: 'BRAKK', portrait: GRUDGE_FACES.Brakk, role: D.accountOpen, lines });
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines.length).toBeLessThanOrEqual(PERSON_LINES);
    expect(lines.join(' ')).toContain(`hardened against your ${CATALOG[JUGGERNAUT.rightHand].name}`);
    expect(lines.join(' ')).toContain('Their notice comes after one more contract won.');
    const words = drawn(app).texts.map((t) => t.text);
    expect(words).toContain('BRAKK');
    expect(words).toContain('OPEN ACCOUNT');
    for (const line of lines) expect(words, line).toContain(line);
  });

  test('a closed one: their face, that the account is closed, and no more of it than that', () => {
    const { app } = inHub(pilot(22, { grudge: account(), accounts: ['Tally'] }));
    toPeople(app);
    press(app, 'down');
    expect(detail(app)).toEqual({ title: 'TALLY', portrait: GRUDGE_FACES.Tally, role: D.accountClosed, lines: wrap(ledgerText({ name: 'Tally', open: false }, CALLED), PAGE_CHARS) });
    const words = drawn(app).texts.map((t) => t.text);
    expect(words).toContain('ACCOUNT CLOSED');
    expect(words.join(' ')).toContain('The account is closed.');
    // And down again is the first of the story's people.
    press(app, 'down');
    expect(detail(app).title).not.toBe('TALLY');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe(story[0]);
  });

  test('it says what is so now: after a contract waited through there is one fewer to wait, and when the notice is out it says so', () => {
    const { app } = inHub(pilot(22, { grudge: account({ met: 1, waited: 0 }) }));
    toPeople(app);
    expect(detail(app).lines.join(' ')).toContain('Their notice comes after 2 more contracts won.');
    press(app, 'cancel');
    accept(app, 'open-0-22-0');
    finishMission(app);
    toHub(app);
    toPeople(app);
    expect(detail(app).lines.join(' ')).toContain('Their notice comes after one more contract won.');
    press(app, 'cancel');
    accept(app, 'open-0-23-0');
    finishMission(app);
    toHub(app);
    toPeople(app);
    expect(detail(app).lines.join(' ')).toContain('Their notice is out: it is among the open contracts.');
    press(app, 'cancel');
    select(app, 'contracts');
    expect(ids(app)).toContain(noticeId(24));
  });

  test('an account that has just begun is on the page at once, knowing nothing, with its notice three contracts off', () => {
    const wins = Array.from({ length: 30 }, (_, i) => 15 + i).find((w) => generateBoard(w, 0, BOARD_TEXT)[0].battles.some((b) => b.enemies.some((id) => MECHS.includes(id))))!;
    const { app, store } = inHub(pilot(wins));
    accept(app, generateBoard(wins, 0, BOARD_TEXT)[0].id);
    finishMission(app);
    toHub(app);
    const begun = savedGame(store).grudge!;
    toPeople(app);
    expect(ids(app)[0]).toBe(`account:${begun.name}`);
    expect(detail(app)).toMatchObject({ title: begun.name.toUpperCase(), portrait: GRUDGE_FACES[begun.name], role: D.accountOpen });
    const said = detail(app).lines.join(' ');
    expect(said).toContain('You have not met by name yet.');
    expect(said).toContain('Their machine knows nothing of what you fly.');
    expect(said).toContain('Their notice comes after 3 more contracts won.');
  });

  test('in Dutch: the rows, what they are to the pilot and the lines', () => {
    const state = dutch(pilot(22, { grudge: account({ met: 1, waited: 1 }), accounts: ['Tally'] }));
    const { app } = inHub(state);
    toPeople(app);
    expect(detail(app).role).toBe(STRINGS_NL.database.accountOpen);
    const words = drawn(app).texts.map((t) => t.text);
    expect(words).toContain('OPEN REKENING');
    expect(detail(app).lines.join(' ')).toContain(`De machine is gehard tegen je ${CATALOG[JUGGERNAUT.rightHand].name}.`);
    expect(detail(app).lines.join(' ')).toContain('Het bericht komt na nog een gewonnen contract.');
    expect(count(app)).toContain(STRINGS_NL.database.accounts(2));
    expect(STRINGS_NL.database.accounts(2)).toBe('REKENINGEN 2');
    press(app, 'down');
    expect(detail(app).role).toBe(STRINGS_NL.database.accountClosed);
    expect(drawn(app).texts.map((t) => t.text)).toContain('REKENING DICHT');
  });

  test('a callsign that has no face is listed all the same: what it is to the pilot is the first line of its page', () => {
    const state = pilot(22, { grudge: account({ name: 'Quill' }) });
    const { app } = inHub(state);
    toPeople(app);
    expect(GRUDGE_NAMES).not.toContain('Quill');
    const shown = detail(app);
    expect(shown.title).toBe('QUILL');
    expect('portrait' in shown).toBe(false);
    expect(shown.lines.slice(0, 2)).toEqual(['OPEN ACCOUNT', '']);
    expect(shown.lines.length).toBeLessThanOrEqual(PERSON_LINES + 5);
    const words = drawn(app).texts.map((t) => t.text);
    for (const line of shown.lines.filter((text) => text !== '')) expect(words, line).toContain(line);
  });
});
