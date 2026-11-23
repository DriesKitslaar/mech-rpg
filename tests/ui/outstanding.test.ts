import { activeUnit, applyAction, createBattle, previewShot, type Action, type BattleState } from '../../src/core/battle';
import { MECH_ENEMIES, POOL, generateBoard, swarmContract } from '../../src/core/board';
import type { GameState } from '../../src/core/game';
import { GRUDGE, GRUDGE_MEETINGS, GRUDGE_WAIT, grudgeContract, grudgeEnemy, type Grudge } from '../../src/core/grudge';
import { jobContract } from '../../src/core/jobs';
import type { EnemyDef } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT, GRUDGE_NAMES } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { JUGGERNAUT, accept, done, finishMission, ids, inHub, press, retreat, savedGame, select, snap, strong, toHub } from '../helpers/app';
import { overlap, record, type Drawn } from '../helpers/canvas';

/**
 * An account as the pilot meets it: how one begins in a contract flown through the app, where its
 * notice stands and what its briefing says, what the field shows of a machine that is hardened, and
 * what the bill and the pilot's page say afterwards.
 */
afterEach(() => setLanguage('en'));

const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const said = (app: App): string[] => drawn(app).texts.map((t) => t.text);
/** A pilot past the introductions in a frame nothing on the board can hurt much, with so many contracts won. */
const pilot = (wins: number, extra: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins, credits: 5000, scenes: ['act-1'], ...extra });
const dutch = (game: GameState): GameState => ({ ...game, settings: { ...game.settings, language: 'nl' } });
const account = (change: Partial<Grudge> = {}): Grudge => ({ name: 'Brakk', kind: 'heavy-mech', origin: 'wrecked', knows: JUGGERNAUT.rightHand, met: 0, waited: 3, ...change });
const noticeId = (wins: number): string => `open-0-${wins}-${GRUDGE}`;
/** The contracts on the list, by their ids. */
function listed(app: App): string[] {
  select(app, 'contracts');
  const found = ids(app);
  press(app, 'cancel');
  return found;
}

describe('an account begins in a contract flown through the app', () => {
  /** The first progress of the third tier whose lightest contract has a mech of the board in it. */
  const wins = Array.from({ length: 30 }, (_, i) => 15 + i).find((w) => generateBoard(w, 0, BOARD_TEXT)[0].battles.some((b) => b.enemies.some((id) => MECHS.includes(id))))!;
  const contract = generateBoard(wins, 0, BOARD_TEXT)[0];
  const mechs = contract.battles.flatMap((b) => b.enemies).filter((id) => MECHS.includes(id));

  test('with the mech that fell or broke off in it, knowing the weapon that did most; and its notice is there three contracts later, after the job and before the swarm', () => {
    expect(mechs.length).toBeGreaterThan(0);
    const { app, store } = inHub(pilot(wins));
    expect(snap(app).grudge).toBeNull();
    accept(app, contract.id);
    finishMission(app);
    expect(snap(app).settlement!.won).toBe(true);
    // The bill of a contract in which one begins says nothing of it: they are heard from when they come back.
    expect((snap(app).settlement as { account?: unknown }).account).toBeNull();
    toHub(app);
    const begun = savedGame(store).grudge!;
    expect(mechs).toContain(begun.kind);
    expect(['wrecked', 'ran']).toContain(begun.origin);
    expect(GRUDGE_NAMES).toContain(begun.name);
    // The only weapon these flights fire is the one in the right hand.
    expect(begun).toMatchObject({ knows: JUGGERNAUT.rightHand, met: 0, waited: 0 });
    expect(snap(app).grudge).toEqual(begun);
    expect(listed(app).filter((id) => id.endsWith(`-${GRUDGE}`))).toEqual([]);

    // Three more contracts won, and no other account begins meanwhile.
    for (let i = 1; i <= GRUDGE_WAIT[0]; i++) {
      expect(listed(app).filter((id) => id.endsWith(`-${GRUDGE}`)), `after ${i - 1}`).toEqual([]);
      accept(app, `open-0-${wins + i}-0`);
      finishMission(app);
      expect(snap(app).settlement!.won).toBe(true);
      toHub(app);
      expect(savedGame(store).grudge).toEqual({ ...begun, waited: i });
    }
    const now = wins + 1 + GRUDGE_WAIT[0];
    const list = listed(app);
    const job = jobContract(now, 0, BOARD_TEXT)!;
    expect(list.slice(list.indexOf(job.id), list.indexOf(job.id) + 3)).toEqual([job.id, noticeId(now), swarmContract(now, 0, BOARD_TEXT).id]);
  });
});

describe('the notice', () => {
  const wins = 22;
  const game = pilot(wins, { grudge: account() });
  const notice = grudgeContract(game, BOARD_TEXT, CALLED)!;

  test('is on the list by its title, with what it pays, and the board beside it is the board', () => {
    const { app } = inHub(game);
    select(app, 'contracts');
    const item = snap(app).menu.items.find((entry) => entry.id === notice.id)!;
    expect(item).toMatchObject({ label: 'Overdue: Brakk', enabled: true, note: String(notice.reward) });
    const board = generateBoard(wins, 0, BOARD_TEXT).map((mission) => mission.id);
    expect(ids(app).filter((id) => /^open-0-22-\d$/.test(id))).toEqual(board);
  });

  test('its briefing: what kind of contract it is, who is asked for by name, their callsign among what to expect, and the weapon their machine knows', () => {
    const { app } = inHub(game);
    select(app, 'contracts');
    select(app, notice.id);
    expect(snap(app).screen).toBe('briefing');
    expect(snap(app).briefing).toMatchObject({ mission: notice.id, reward: notice.reward, objectives: [STRINGS.objectives.brief.leader('Brakk')] });
    // Read to the end of what Dispatch says.
    for (let i = 0; i < 400 && (snap(app) as { typing?: boolean }).typing; i++) app.update(50);
    const page = drawn(app);
    const words = page.texts.map((t) => t.text);
    expect(words).toContain(STRINGS.briefing.account);
    expect(words).toContain('OVERDUE: BRAKK');
    expect(words.some((text) => text.includes('Brakk') && !text.includes(':'))).toBe(true);
    expect(words.join(' ')).toContain(`your ${CATALOG[JUGGERNAUT.rightHand].name}`);
    expect(words).toContain(STRINGS.objectives.brief.leader('Brakk'));
    // Nothing on the page is written over anything else.
    const lines = page.texts.filter((t) => t.text.trim().length > 0);
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) expect(overlap(lines[i], lines[j]), `${lines[i].text} | ${lines[j].text}`).toBe(false);
  });

  test('its battle fields their machine under their callsign, hardened against the weapon they know, and nothing else on the field is', () => {
    const { app } = inHub(game);
    accept(app, notice.id);
    const battle = snap(app).battle as unknown as { enemies: string[]; hardened: string[]; objective: string };
    expect(battle.enemies[0]).toBe('heavy-mech');
    expect(battle.hardened).toEqual([JUGGERNAUT.rightHand]);
    expect(battle.objective).toBe(STRINGS.objectives.leader('Brakk'));
    expect(said(app)).toContain(STRINGS.objectives.leader('Brakk'));
  });
});

describe('a machine that is hardened, on the field', () => {
  const sheet = SPRITES as Record<string, { w: number; h: number }>;
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: sheet[id]?.w ?? fallback.w, h: sheet[id]?.h ?? fallback.h }) };
  const END: Action = { type: 'endTurn' };
  const theirs: EnemyDef = grudgeEnemy({ grudge: account({ kind: 'heavy-mech' }) }, ENEMIES)!;
  /** Their machine and a tank beside it, at the pilot's turn, with nothing else to say of either. */
  function field(first: EnemyDef = theirs): BattleState {
    let s = createBattle(JUGGERNAUT, [first, ENEMIES.tank], CATALOG, 3, { objective: { type: 'leader', target: 0 } });
    for (let guard = 0; activeUnit(s).id !== 'player' && guard < 20; guard++) s = applyAction(s, END, CATALOG);
    s = structuredClone(s);
    for (const unit of s.units) { unit.boosted = false; unit.guarding = false; unit.staggered = 0; }
    return s;
  }
  function shown(state: BattleState) {
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true, background: 'bg-mine' });
    for (let i = 0; i < 2000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    return { screen, flow, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
  }
  /** Takes aim with the weapon at this place in the weapon menu. */
  function aim(made: ReturnType<typeof shown>, weapon: number): void {
    made.screen.onInput('confirm');
    for (let i = 0; i < weapon; i++) made.screen.onInput('down');
    made.screen.onInput('confirm');
    expect(made.flow.phase).toBe('target');
    expect(made.flow.targetId).toBe('enemy-0');
  }

  test('says so over its head, as an elite says its mark; the machine beside it says nothing', () => {
    const { screen, page } = shown(field());
    expect(screen.markOver('enemy-0')).toBe(STRINGS.tags.hardened);
    expect(screen.markOver('enemy-1')).toBeNull();
    const mark = page().texts.filter((t) => t.text === STRINGS.tags.hardened);
    expect(mark.map((t) => [t.align, t.color])).toEqual([['center', COLORS.accent]]);
    // The same machine not hardened has nothing over it.
    expect(shown(field(ENEMIES['heavy-mech'])).screen.markOver('enemy-0')).toBeNull();
  });

  test('anything more pressing is said first: its guard, its balance', () => {
    const guarding = field();
    guarding.units[1].guarding = true;
    expect(shown(guarding).screen.markOver('enemy-0')).toBe(STRINGS.tags.guard);
    const reeling = field();
    reeling.units[1].staggered = 1;
    expect(shown(reeling).screen.markOver('enemy-0')).toBe(STRINGS.tags.stagger);
  });

  test('aimed at with the weapon it knows: HALF beside its name, and the figure is the halved one', () => {
    const made = shown(field());
    expect(made.flow.halved).toBe(false);
    aim(made, 0);
    expect(made.flow.halved).toBe(true);
    const texts = made.page().texts;
    const row = texts.filter((t) => t.size === 10 && t.align === 'left' && (t.text === STRINGS.tags.hardened || t.text === STRINGS.tags.half));
    expect(row.map((t) => [t.text, t.color])).toEqual([[STRINGS.tags.hardened, COLORS.accent], [STRINGS.tags.half, COLORS.danger]]);
    const preview = previewShot(made.flow.state, 'player', 'rightHand', 'enemy-0', 'core', CATALOG);
    const plain = previewShot(field(ENEMIES['heavy-mech']), 'player', 'rightHand', 'enemy-0', 'core', CATALOG);
    expect(preview.damage).toBeLessThan(plain.damage);
    expect(texts.some((t) => t.text.includes(`${STRINGS.preview.damage} ${preview.damage}`))).toBe(true);
    expect(texts.some((t) => t.text.includes(`${STRINGS.preview.damage} ${plain.damage}`))).toBe(false);
  });

  test('aimed at with any other weapon: hardened still, and nothing does half', () => {
    const made = shown(field());
    aim(made, 1);
    expect(made.flow.halved).toBe(false);
    const texts = made.page().texts;
    expect(texts.filter((t) => t.text === STRINGS.tags.half)).toEqual([]);
    expect(texts.some((t) => t.text === STRINGS.tags.hardened && t.align === 'left')).toBe(true);
    const preview = previewShot(made.flow.state, 'player', 'leftHand', 'enemy-0', 'core', CATALOG);
    const plain = previewShot(field(ENEMIES['heavy-mech']), 'player', 'leftHand', 'enemy-0', 'core', CATALOG);
    expect(preview.damage).toBe(plain.damage);
  });

  test('the machine beside it, aimed at with that same weapon, takes all of it and says nothing', () => {
    const made = shown(field());
    made.screen.onInput('confirm');
    made.screen.onInput('confirm');
    // On to the next machine the weapon reaches.
    made.screen.onInput('next');
    expect(made.flow.targetId).toBe('enemy-1');
    expect(made.flow.halved).toBe(false);
    expect(made.page().texts.filter((t) => t.text === STRINGS.tags.half)).toEqual([]);
  });

  test('and once the aim is let go nothing is said of half', () => {
    const made = shown(field());
    aim(made, 0);
    made.screen.onInput('cancel');
    made.screen.onInput('cancel');
    expect(made.flow.phase).toBe('action');
    expect(made.flow.halved).toBe(false);
  });
});

describe('the bill of a meeting, and the game afterwards', () => {
  const wins = 22;
  const at = (change: Partial<Grudge> = {}, extra: Partial<GameState> = {}): GameState => pilot(wins, { grudge: account(change), ...extra });

  test('a first meeting won: the bill says which of the three it was, they know what hit them hardest, and the waiting begins again', () => {
    // An account whose pilot knows nothing yet: what they know afterwards they learned in this meeting.
    const { knows: _, ...unknowing } = account();
    const { app, store } = inHub(pilot(wins, { grudge: unknowing }));
    accept(app, noticeId(wins));
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 1, closed: false } });
    expect(said(app)).toContain(STRINGS.settlement.account(1, GRUDGE_MEETINGS));
    expect(said(app)).not.toContain(STRINGS.settlement.won);
    expect(STRINGS.settlement.account(1, GRUDGE_MEETINGS)).toBe('ACCOUNT: 1 OF 3');
    toHub(app);
    const after = savedGame(store).grudge!;
    expect(after).toEqual({ ...unknowing, met: 1, waited: 0, knows: after.knows });
    expect([JUGGERNAUT.rightHand, JUGGERNAUT.leftHand, JUGGERNAUT.shoulder]).toContain(after.knows);
    expect(savedGame(store).accounts).toBeUndefined();
    expect(listed(app).filter((id) => id.endsWith(`-${GRUDGE}`))).toEqual([]);
  });

  test('the third: the account closed and gone, the callsign written down and counted on the pilot\'s page', () => {
    const { app, store } = inHub(at({ met: 2, waited: 2 }));
    accept(app, noticeId(wins));
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 3, closed: true } });
    expect(said(app)).toContain(STRINGS.settlement.accountClosed);
    toHub(app);
    const kept = savedGame(store);
    expect(kept.grudge).toBeUndefined();
    expect(kept.accounts).toEqual(['Brakk']);
    expect(snap(app)).toMatchObject({ grudge: null, accounts: ['Brakk'] });
    select(app, 'pilot');
    press(app, 'next', 'next');
    expect(snap(app).page).toBe('record');
    expect(snap(app).accounts).toBe(1);
    const line = drawn(app).texts.find((t) => t.text === STRINGS.record.accounts(1))!;
    expect(line.align).toBe('right');
    expect(STRINGS.record.accounts(1)).toBe('ACCOUNTS CLOSED 1');
  });

  test('a pilot who has closed none has no such line on the page', () => {
    const { app } = inHub(at());
    select(app, 'pilot');
    press(app, 'next', 'next');
    expect(snap(app).accounts).toBe(0);
    expect(said(app).filter((text) => text.startsWith('ACCOUNTS CLOSED'))).toEqual([]);
  });

  test('a meeting walked away from changes nothing: the bill is a contract lost, and the notice is where it was', () => {
    const { app, store } = inHub(at());
    accept(app, noticeId(wins));
    retreat(app);
    expect(snap(app).settlement).toMatchObject({ won: false, account: null });
    expect(said(app)).toContain(STRINGS.settlement.lost);
    toHub(app);
    expect(savedGame(store).grudge).toEqual(account());
    expect(listed(app)).toContain(noticeId(wins));
  });

  test('any other contract won while one is due is one more waited through, and the notice stays', () => {
    const { app, store } = inHub(at());
    accept(app, `open-0-${wins}-0`);
    finishMission(app);
    toHub(app);
    expect(savedGame(store).grudge).toEqual(account({ waited: 4 }));
    expect(listed(app)).toContain(noticeId(wins + 1));
  });
});

describe('in Dutch', () => {
  const wins = 22;
  const game = dutch(pilot(wins, { grudge: account() }));

  test('the notice, its briefing and its bill', () => {
    const { app } = inHub(game);
    select(app, 'contracts');
    expect(snap(app).menu.items.find((entry) => entry.id === noticeId(wins))!.label).toBe('Vervallen: Brakk');
    select(app, noticeId(wins));
    for (let i = 0; i < 400 && (snap(app) as { typing?: boolean }).typing; i++) app.update(50);
    const page = drawn(app);
    const words = page.texts.map((t) => t.text);
    expect(words).toContain(STRINGS_NL.briefing.account);
    expect(words.join(' ')).toContain(`gehard tegen je ${CATALOG[JUGGERNAUT.rightHand].name}`);
    const lines = page.texts.filter((t) => t.text.trim().length > 0);
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) expect(overlap(lines[i], lines[j]), `${lines[i].text} | ${lines[j].text}`).toBe(false);
    select(app, 'accept');
    finishMission(app);
    expect(said(app)).toContain(STRINGS_NL.settlement.account(1, GRUDGE_MEETINGS));
    expect(STRINGS_NL.settlement.account(1, GRUDGE_MEETINGS)).toBe('REKENING: 1 VAN 3');
  });
});
