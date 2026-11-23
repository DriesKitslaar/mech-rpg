import { MECH_ENEMIES, POOL, generateBoard } from '../../src/core/board';
import type { GameState } from '../../src/core/game';
import { GRUDGE, ledger, type Grudge } from '../../src/core/grudge';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT, GRUDGE_FACES, GRUDGE_NAMES, ledgerText } from '../../src/content/board';
import { PEOPLE } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import { MISSIONS } from '../../src/content/missions';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App, AppDeps } from '../../src/ui/app';
import { LIST, PAGE_CHARS, PERSON_LINES, ROW_NAME } from '../../src/ui/databaseScreen';
import { forgetWords } from '../../src/ui/signType';
import type { SpriteStore } from '../../src/ui/sprites';
import { PANEL_Y } from '../../src/ui/stage';
import { COLORS, clip, wrap } from '../../src/ui/widgets';
import { JUGGERNAUT, accept, done, finishBattle, finishMission, ids, inHub, makeApp, pastLaunch, press, retreat, savedGame, select, snap, strong, toHub } from '../helpers/app';
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

/** What the game tells of the battle on the screen: its banner, who comes in on a band, and whose face is beside the line. */
type Fought = { banner: boolean; entrance: { warning: string; name: string } | null; face: string | null; spoken: string | null; outcome: string; phase: string };
const fought = (app: App): Fought => snap(app).battle as unknown as Fought;
/** Lets the banner run out. */
function pastBanner(app: App): void {
  for (let i = 0; i < 600 && fought(app).banner; i++) app.update(16);
  expect(fought(app).banner).toBe(false);
}
/** What the page of the database shows of the row chosen. */
type Shown = { title: string; portrait?: string; role?: string; lines: string[] };
const detail = (app: App): Shown => (snap(app) as unknown as { detail: Shown }).detail;
/** From the hub to the database's page of people. */
function toPeople(app: App): void {
  select(app, 'database');
  press(app, 'next');
  expect(snap(app).page).toBe('people');
}

/** A battle taken from the hub at a walking pace, well into its banner's time: it has come in and holds. */
function walkedInto(game: GameState, mission: string, deps: Partial<AppDeps> = {}): App {
  const { app } = makeApp(game, 5, { fast: false, ...deps });
  press(app, 'confirm');
  for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(16); press(app, 'confirm'); }
  select(app, 'contracts');
  select(app, mission);
  for (let i = 0; i < 200 && snap(app).screen !== 'briefing'; i++) app.update(16);
  select(app, 'accept');
  for (let i = 0; i < 400 && snap(app).screen !== 'battle'; i++) app.update(16);
  pastLaunch(app);
  for (let i = 0; i < 40; i++) app.update(16);
  expect((snap(app).battle as { mission: string }).mission).toBe(mission);
  return app;
}
/** Everything of the story up to the verdict, on Lumen's side: the contract then on offer is one machine, a boss. */
const TO_THE_VERDICT = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3',
];
const BOSS = ENEMIES[MISSIONS.find((mission) => mission.id === 'verdict-enforce')!.battles[0].enemies[0]];
const beforeTheVerdict = (extra: Partial<GameState> = {}): GameState => strong({ ...done(...TO_THE_VERDICT), scenes: ['war-won-lumen', 'act-3'], ...extra });
const sign = (page: Drawn, word: string) => signIn(page, word, 'red') ?? signIn(page, word, 'amber');

describe('a meeting opens as a boss\'s battle does', () => {
  /** The first frames of a battle taken from the hub at a walking pace, with its banner up. */
  const opened = (game: GameState, mission: string): Drawn => drawn(walkedInto(game, mission));

  test('the band, under the notice\'s own word and not the warning, with their callsign in the sign\'s letters', () => {
    const page = opened(pilot(22, { grudge: account() }), noticeId(22));
    expect(STRINGS.battleIntro.overdue).toBe('OVERDUE');
    expect(sign(page, STRINGS.battleIntro.overdue)).not.toBeNull();
    expect(sign(page, STRINGS.battleIntro.warning)).toBeNull();
    expect(signIn(page, 'BRAKK', 'steel')).not.toBeNull();
    // Their machine in the band's window: a picture drawn at twice its size, beside the words.
    expect(page.rects.some((r) => r.color === 'rgba(40, 8, 14, 0.9)')).toBe(true);
  });

  test('under every one of the sixteen callsigns, at the first meeting, when they know nothing, as at the second and the third', () => {
    expect(GRUDGE_NAMES).toHaveLength(16);
    GRUDGE_NAMES.forEach((name, i) => {
      const met = i % 3;
      const { knows: _, ...unknowing } = account({ name, met, waited: 3 });
      const page = opened(pilot(22, { grudge: met === 0 ? unknowing : account({ name, met, waited: 3 }) }), noticeId(22));
      expect(sign(page, STRINGS.battleIntro.overdue), name).not.toBeNull();
      expect(signIn(page, name.toUpperCase(), 'steel'), name).not.toBeNull();
    });
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

  test('none of the machines an account can be about is a boss: a meeting has one band to come in on, the notice\'s', () => {
    expect(MECHS.length).toBeGreaterThanOrEqual(7);
    for (const id of MECHS) expect(ALL_ENEMIES[id].phases ?? [], id).toEqual([]);
  });

  test('a boss still comes in under the warning, whether or not an account is open: the notice\'s word is a meeting\'s alone', () => {
    expect(BOSS.phases!.length).toBeGreaterThan(0);
    for (const extra of [{}, { grudge: account() }]) {
      const page = opened(beforeTheVerdict(extra), 'verdict-enforce');
      expect(sign(page, STRINGS.battleIntro.warning)).not.toBeNull();
      expect(sign(page, STRINGS.battleIntro.overdue)).toBeNull();
      expect(signIn(page, BOSS.name.toUpperCase(), 'steel')).not.toBeNull();
    }
  });
});

describe('what the game tells of it to a test that cannot read a canvas', () => {
  test('a meeting: the notice\'s word and their callsign while the band is up, as the band has them; and nobody\'s once it has gone', () => {
    const app = walkedInto(pilot(22, { grudge: account() }), noticeId(22));
    expect(fought(app)).toMatchObject({ banner: true, entrance: { warning: 'OVERDUE', name: 'BRAKK' } });
    const page = drawn(app);
    expect(sign(page, fought(app).entrance!.warning)).not.toBeNull();
    expect(signIn(page, fought(app).entrance!.name, 'steel')).not.toBeNull();
    pastBanner(app);
    expect(fought(app).entrance).toBeNull();
  });

  test('in Dutch it is the Dutch word', () => {
    const app = walkedInto(dutch(pilot(22, { grudge: account() })), noticeId(22));
    expect(fought(app).entrance).toEqual({ warning: 'VERVALLEN', name: 'BRAKK' });
  });

  test('a boss: the warning and its name; a contract of the board: nobody comes in on a band', () => {
    expect(fought(walkedInto(beforeTheVerdict({ grudge: account() }), 'verdict-enforce')).entrance).toEqual({ warning: 'WARNING', name: BOSS.name.toUpperCase() });
    const board = walkedInto(pilot(22, { grudge: account() }), generateBoard(22, 0, BOARD_TEXT)[0].id);
    expect(fought(board)).toMatchObject({ banner: true, entrance: null });
  });

  test('nobody is said to come in while the machine is still on its way to the field', () => {
    const { app } = makeApp(pilot(22, { grudge: account() }), 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(16); press(app, 'confirm'); }
    select(app, 'contracts');
    select(app, noticeId(22));
    for (let i = 0; i < 200 && snap(app).screen !== 'briefing'; i++) app.update(16);
    select(app, 'accept');
    for (let i = 0; i < 400 && snap(app).screen !== 'battle'; i++) app.update(16);
    expect((snap(app) as { launch?: unknown }).launch).toBeTruthy();
    expect(fought(app)).toMatchObject({ entrance: null, face: null });
  });

  test('in a calm picture, and with the option that plays battles faster, the band is there as a boss\'s is, and stays up as long', () => {
    const base = pilot(22, { grudge: account() });
    /** How long the band of a notice stays up from where `walkedInto` leaves it, on the clock. */
    const upFor = (settings: Partial<GameState['settings']>): number => {
      const app = walkedInto({ ...base, settings: { ...base.settings, ...settings } }, noticeId(22));
      expect(fought(app).entrance, JSON.stringify(settings)).toEqual({ warning: 'OVERDUE', name: 'BRAKK' });
      expect(sign(drawn(app), 'OVERDUE'), JSON.stringify(settings)).not.toBeNull();
      let ms = 0;
      for (; ms < 60000 && fought(app).banner; ms += 16) app.update(16);
      return ms;
    };
    const plain = upFor({});
    expect(plain).toBeGreaterThan(1000);
    expect(upFor({ calm: true })).toBe(plain);
    // The player's option hurries what is fought, not who comes in: the band is on the clock of the room.
    expect(upFor({ fastBattles: true })).toBe(plain);
  });

  test('in a game run hurried for a test (which no player has) there is no banner at all, for them as for a boss', () => {
    for (const [game, mission] of [[pilot(22, { grudge: account() }), noticeId(22)], [beforeTheVerdict(), 'verdict-enforce']] as const) {
      const { app } = makeApp(game);
      press(app, 'confirm');
      for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) press(app, 'confirm');
      accept(app, mission);
      expect(fought(app), mission).toMatchObject({ banner: false, entrance: null });
    }
  });

  test('their face is beside the line they open with once the band has gone, and not while the band is over it', () => {
    const app = walkedInto(pilot(22, { grudge: account() }), noticeId(22));
    const line = BOARD_TEXT.grudge.opens.again[0];
    expect(fought(app)).toMatchObject({ banner: true, spoken: line, face: null });
    expect(drawn(app).texts.map((t) => t.text)).not.toContain('BRAKK');
    pastBanner(app);
    expect(fought(app)).toMatchObject({ spoken: line, face: GRUDGE_FACES.Brakk });
    // The box is theirs now: their callsign over what they say.
    expect(drawn(app).texts.map((t) => t.text)).toContain('BRAKK');
  });

  test('a callsign with no face has none beside its line: the line is said all the same, under the callsign', () => {
    const faceless = walkedInto(pilot(22, { grudge: account({ name: 'Quill' }) }), noticeId(22));
    pastBanner(faceless);
    expect(fought(faceless)).toMatchObject({ spoken: BOARD_TEXT.grudge.opens.again[0], face: null });
    expect(drawn(faceless).texts.map((t) => t.text)).toContain('QUILL');
  });
});

describe('the face as it is drawn', () => {
  /** A store whose pictures say which they are: a test can then see whose face was drawn, and where. */
  const named: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  const idOf = (image: unknown): string => String((image as { id?: string }).id ?? '');
  /** Every face on the page: whose, where, and how large. */
  const faces = (page: Drawn) => page.images.filter((p) => idOf(p.image).startsWith('portrait-')).map((p) => ({ id: idOf(p.image), x: p.x, y: p.y, w: p.w, h: p.h }));
  /** The square of the mark a voice with no face has in place of one. */
  const marks = (page: Drawn) => page.rects.filter((r) => r.w === 56 && r.h === 56 && r.color === COLORS.empty);
  const TALK_FACE = { x: 10, y: PANEL_Y + 10, w: 56, h: 56 };

  test('in a fight, as it opens: no face while the band is over the line, and theirs once it has gone, at its own size at the left of the box with their callsign beside it', () => {
    const app = walkedInto(pilot(22, { grudge: account() }), noticeId(22), { sprites: named });
    expect(faces(drawn(app))).toEqual([]);
    pastBanner(app);
    const page = drawn(app);
    expect(faces(page)).toEqual([{ id: GRUDGE_FACES.Brakk, ...TALK_FACE }]);
    expect(marks(page)).toEqual([]);
    const callsign = page.texts.find((t) => t.text === 'BRAKK' && t.y >= PANEL_Y)!;
    expect(callsign.left).toBeGreaterThan(TALK_FACE.x + TALK_FACE.w);
    expect(page.texts.some((t) => t.y >= PANEL_Y && BOARD_TEXT.grudge.opens.again[0].startsWith(t.text))).toBe(true);
  });

  test('as their machine falls: the same face beside their last word; and beside no line of the battle is there a face that is not theirs or Dispatch\'s', () => {
    for (const name of [GRUDGE_NAMES[3], GRUDGE_NAMES[12]]) {
      const app = walkedInto(pilot(22, { grudge: account({ name, met: 2, waited: 3 }) }), noticeId(22), { sprites: named });
      const seen = new Set<string>();
      let last: Drawn | null = null;
      for (let i = 0; i < 400000 && fought(app).phase !== 'result'; i++) {
        const b = fought(app);
        if (b.phase === 'talk' && !b.banner) {
          const page = drawn(app);
          for (const face of faces(page)) seen.add(`${face.id}@${face.x},${face.y}`);
          if (b.outcome === 'victory' && b.spoken === BOARD_TEXT.grudge.falls[2] && faces(page).length > 0) last = page;
        }
        if (b.phase === 'action') {
          if (snap(app).menu.items[0].enabled) press(app, 'confirm'); else select(app, 'endTurn');
        } else {
          // (A line holds a press off for a moment, and the banner and whatever is staged run on the clock.)
          app.update(16);
          if (b.phase !== 'animating') press(app, 'confirm');
        }
      }
      expect(fought(app).outcome, name).toBe('victory');
      expect(last, name).not.toBeNull();
      expect(faces(last!), name).toEqual([{ id: GRUDGE_FACES[name], ...TALK_FACE }]);
      expect(last!.texts.some((t) => t.text === name.toUpperCase() && t.y >= PANEL_Y), name).toBe(true);
      const theirs = `${GRUDGE_FACES[name]}@${TALK_FACE.x},${TALK_FACE.y}`;
      const dispatch = `${BOARD_TEXT.faces!.Dispatch}@${TALK_FACE.x},${TALK_FACE.y}`;
      expect(seen.has(theirs), name).toBe(true);
      for (const at of seen) expect([theirs, dispatch], at).toContain(at);
    }
  });

  test('on their page: the face of the open one and of a closed one, at its own size under the callsign, with what the account is beside it and the lines under it', () => {
    const { app } = inHub(pilot(22, { grudge: account(), accounts: ['Tally'] }), undefined, { sprites: named });
    toPeople(app);
    for (const [name, role] of [['Brakk', 'OPEN ACCOUNT'], ['Tally', 'ACCOUNT CLOSED']]) {
      const page = drawn(app);
      const [face, ...others] = faces(page);
      expect(others, name).toEqual([]);
      expect(face, name).toMatchObject({ id: GRUDGE_FACES[name], w: 56, h: 56 });
      const title = page.texts.find((t) => t.text === name.toUpperCase() && t.x >= LIST.x + LIST.w)!;
      expect(face.x, name).toBe(title.x);
      expect(face.y, name).toBeGreaterThan(title.y);
      const word = page.texts.find((t) => t.text === role)!;
      expect(word.left, name).toBeGreaterThan(face.x + face.w);
      expect(word.y, name).toBeGreaterThanOrEqual(face.y);
      expect(word.y, name).toBeLessThan(face.y + face.h);
      for (const line of detail(app).lines) expect(page.texts.find((t) => t.text === line)!.y, line).toBeGreaterThanOrEqual(face.y + face.h);
      press(app, 'down');
    }
  });

  test('a callsign with no face: in a fight the square has the mark every voice without a face has, and no picture; on its page nothing is drawn where a face would be', () => {
    const state = pilot(22, { grudge: account({ name: 'Quill' }) });
    const fight = walkedInto(state, noticeId(22), { sprites: named });
    pastBanner(fight);
    const box = drawn(fight);
    expect(faces(box)).toEqual([]);
    expect(marks(box)).toMatchObject([TALK_FACE]);
    expect(box.texts.some((t) => t.text === 'QUILL' && t.y >= PANEL_Y && t.left > TALK_FACE.x + TALK_FACE.w)).toBe(true);
    const { app } = inHub(state, undefined, { sprites: named });
    toPeople(app);
    const page = drawn(app);
    expect(faces(page)).toEqual([]);
    expect(marks(page)).toEqual([]);
    // What it is to the pilot stands where the face would have had it beside it: right under the callsign.
    const title = page.texts.find((t) => t.text === 'QUILL' && t.x >= LIST.x + LIST.w)!;
    const word = page.texts.find((t) => t.text === 'OPEN ACCOUNT')!;
    expect(word.x).toBe(title.x);
    expect(word.y).toBeGreaterThan(title.y);
    expect(word.y).toBeLessThan(title.y + 30);
  });
});

describe('the moment an account begins', () => {
  /** The first progress of the third tier whose lightest contract has a mech of the board in it. */
  const wins = Array.from({ length: 30 }, (_, i) => 15 + i).find((w) => generateBoard(w, 0, BOARD_TEXT)[0].battles.some((b) => b.enemies.some((id) => MECHS.includes(id))))!;
  const contract = generateBoard(wins, 0, BOARD_TEXT)[0];

  test('is announced over the bill of the contract it began in: that an account is opened, and the callsign', () => {
    const played: string[] = [];
    const { app, store } = inHub(pilot(wins), undefined, { sfx: { play: (name: string) => { played.push(name); } } as never });
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([]);
    accept(app, contract.id);
    finishMission(app);
    expect(snap(app).screen).toBe('settlement');
    const begun = savedGame(store).grudge!;
    expect(announced(app).filter((id) => id.startsWith('account:'))).toEqual([`account:${begun.name}`]);
    // Shown, it says so in the words the game has for it.
    for (let i = 0; i < 80 && snap(app).toast !== `account:${begun.name}`; i++) app.update(snap(app).toast === null ? 16 : 3000);
    expect(snap(app).toast).toBe(`account:${begun.name}`);
    // It comes up with the sound a new page of the database comes up with: their page is there from now on.
    expect(played.at(-1)).toBe('entry');
    const texts = drawn(app).texts;
    const words = texts.map((t) => t.text);
    expect(words).toContain(STRINGS.accounts.opened);
    expect(words).toContain(STRINGS.accounts.callsign(begun.name));
    // What it is stands small over whose it is.
    const heading = texts.find((t) => t.text === STRINGS.accounts.opened)!;
    const title = texts.find((t) => t.text === STRINGS.accounts.callsign(begun.name))!;
    expect(heading).toMatchObject({ size: 10, color: COLORS.dim });
    expect(title).toMatchObject({ x: heading.x, y: heading.y + 10, color: COLORS.accent });
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
  const count = (app: App): string => (snap(app) as unknown as { count: string }).count;
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

  test('a row says which it is: OPEN behind the callsign of the open account, CLOSED behind a closed one, and nothing behind a person of the story', () => {
    const { app } = inHub(pilot(22, { grudge: account({ met: 1, waited: 1 }), accounts: ['Tally', 'Docket'] }));
    toPeople(app);
    expect(snap(app).menu.items.slice(0, 3).map((item) => [item.label, item.note])).toEqual([['Brakk', 'OPEN'], ['Tally', 'CLOSED'], ['Docket', 'CLOSED']]);
    for (const item of snap(app).menu.items.slice(3)) expect(item.note, item.id).toBeUndefined();
    expect([D.rowOpen, D.rowClosed]).toEqual(['OPEN', 'CLOSED']);
    // On the screen: at the right edge of its row, dim, on the callsign's own line and clear of it.
    const texts = drawn(app).texts;
    for (const [name, note] of [['Brakk', 'OPEN'], ['Tally', 'CLOSED'], ['Docket', 'CLOSED']]) {
      const label = texts.find((t) => t.text === name && t.x < LIST.x + LIST.w)!;
      const word = texts.find((t) => t.text === note && t.y === label.y)!;
      expect(word, name).toMatchObject({ align: 'right', color: COLORS.dim, size: 12 });
      expect(word.left, name).toBeGreaterThan(label.right + 4);
      expect(word.right, name).toBeLessThanOrEqual(LIST.x + LIST.w - 4);
    }
    // With none open the first row is a closed one, and says so.
    const closed = inHub(pilot(22, { accounts: ['Tally'] })).app;
    toPeople(closed);
    expect(snap(closed).menu.items[0]).toMatchObject({ id: 'account:Tally', label: 'Tally', note: 'CLOSED' });
  });

  test('in Dutch the rows say OPEN and DICHT', () => {
    const { app } = inHub(dutch(pilot(22, { grudge: account(), accounts: ['Tally'] })));
    toPeople(app);
    expect(snap(app).menu.items.slice(0, 2).map((item) => item.note)).toEqual(['OPEN', 'DICHT']);
    expect([STRINGS_NL.database.rowOpen, STRINGS_NL.database.rowClosed]).toEqual(['OPEN', 'DICHT']);
  });

  test('a callsign from a file made elsewhere, as long as a saved game may hold: its row is cut to what the row has room for, and its page has it whole', () => {
    const long = 'Bartholomew-Longstridder';
    expect(long).toHaveLength(24);
    expect(ROW_NAME).toBe(10);
    for (const game of [pilot(22, { grudge: account({ name: long }) }), pilot(22, { accounts: [long] })]) {
      const { app } = inHub(game);
      toPeople(app);
      const row = snap(app).menu.items[0];
      expect(row).toMatchObject({ id: `account:${long}`, label: 'Bartholom.' });
      expect(detail(app).title).toBe(long.toUpperCase());
      const texts = drawn(app).texts;
      const label = texts.find((t) => t.text === row.label)!;
      const word = texts.find((t) => t.text === row.note && t.y === label.y)!;
      // The callsign and the word behind it stand clear of each other, inside the list, at the size every row is written in.
      expect(word.size).toBe(12);
      expect(word.left).toBeGreaterThan(label.right + 4);
      expect(label.right).toBeLessThan(LIST.x + LIST.w);
      // The page has room for all of it.
      const title = texts.find((t) => t.text === long.toUpperCase())!;
      expect(title.right).toBeLessThanOrEqual(310 - 4);
    }
    // The game's own callsigns are all shorter than that: none is ever cut.
    for (const name of GRUDGE_NAMES) expect(name.length, name).toBeLessThanOrEqual(ROW_NAME);
    // And one of exactly the letters the row has room for is there whole: only what does not fit is cut.
    const exact = 'Tenletters';
    expect(exact).toHaveLength(ROW_NAME);
    const fits = inHub(pilot(22, { accounts: [exact] })).app;
    toPeople(fits);
    expect(snap(fits).menu.items[0].label).toBe(exact);
    expect([clip('abc', 3), clip('abcd', 3), clip('ab', 3), clip('', 3)]).toEqual(['abc', 'ab.', 'ab', '']);
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
    expect(detail(app).lines.join(' ')).toContain('Their notice is out, and stays out until you win it.');
    press(app, 'cancel');
    select(app, 'contracts');
    expect(ids(app)).toContain(noticeId(24));
  });

  describe('a meeting that is not won leaves the account as it was', () => {
    /** A pilot in the frame every pilot starts in: no match for the machine of a notice at the board's fourth tier. */
    const weak = (grudge: Grudge): GameState => ({ ...done('intro-1', 'intro-2'), battlesWon: 22, credits: 5000, scenes: ['act-1'], grudge });
    const accounts = (app: App): string[] => announced(app).filter((id) => id.startsWith('account:'));
    /** What the page says of the open account, read from the hub and left again. */
    function pageOf(app: App): string {
      toPeople(app);
      expect(detail(app)).toMatchObject({ title: 'BRAKK', role: D.accountOpen });
      const said = detail(app).lines.join(' ');
      press(app, 'cancel');
      return said;
    }

    for (const [met, won] of [[0, 'none'], [1, 'one'], [2, 'two']] as const) {
      test(`lost, with ${won} won before it: nothing is announced, and the page still counts ${won} won and says the notice is out`, () => {
        const open = account({ met, waited: 5 });
        const { app, store } = inHub(weak(open));
        const before = pageOf(app);
        expect(before).toContain(`Meetings won: ${won} of the three that close the account.`);
        accept(app, noticeId(22));
        finishBattle(app);
        expect(snap(app).battle!.outcome).toBe('defeat');
        press(app, 'confirm');
        expect(snap(app).screen).toBe('settlement');
        expect(snap(app).settlement!.won).toBe(false);
        expect(accounts(app)).toEqual([]);
        expect(savedGame(store).grudge).toEqual(open);
        toHub(app);
        // Word for word what it said before the meeting: nothing of the account has changed.
        expect(pageOf(app)).toBe(before);
        expect(before).toContain('Their notice is out, and stays out until you win it.');
        select(app, 'contracts');
        expect(ids(app)).toContain(noticeId(22));
      });
    }

    test('walked away from: nothing is announced, and the page says what it said', () => {
      const open = account({ met: 1, waited: 2 });
      const { app, store } = inHub(pilot(22, { grudge: open }));
      const before = pageOf(app);
      accept(app, noticeId(22));
      retreat(app);
      expect(snap(app).settlement!.won).toBe(false);
      expect(accounts(app)).toEqual([]);
      expect(savedGame(store).grudge).toEqual(open);
      toHub(app);
      expect(pageOf(app)).toBe(before);
      expect(before).toContain('Meetings won: one of the three that close the account.');
    });
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
    expect(said).toContain('Meetings won: none of the three that close the account.');
    expect(said).toContain('Their machine knows nothing of what you fly.');
    expect(said).toContain('Their notice comes after 3 more contracts won.');
    // One account is an account: it is counted.
    expect(count(app)).toBe(`${D.known(knownOf(app), PEOPLE.length)}   ${D.accounts(1)}`);
  });

  test('one closed account and none open: it stands first, and is counted', () => {
    const { app } = inHub(pilot(22, { accounts: ['Tally'] }));
    toPeople(app);
    expect(ids(app)).toEqual(['account:Tally', ...story]);
    expect(detail(app)).toMatchObject({ title: 'TALLY', portrait: GRUDGE_FACES.Tally, role: D.accountClosed });
    expect(count(app)).toBe(`${D.known(knownOf(app), PEOPLE.length)}   ${D.accounts(1)}`);
    expect(D.accounts(1)).toBe('ACCOUNTS 1');
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
    expect(detail(app).lines.join(' ')).toContain('Ontmoetingen gewonnen: een van de drie die de rekening sluiten.');
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
