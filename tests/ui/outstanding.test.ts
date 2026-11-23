import { activeUnit, applyAction, createBattle, previewShot, type Action, type BattleState } from '../../src/core/battle';
import { MECH_ENEMIES, POOL, generateBoard, swarmContract } from '../../src/core/board';
import type { GameState } from '../../src/core/game';
import { GRUDGE, GRUDGE_MEETINGS, GRUDGE_NUMBERS, GRUDGE_WAIT, grudgeContract, grudgeEnemy, type Grudge } from '../../src/core/grudge';
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
import { BattleScreen, MARK_TURN_MS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, BriefingScreen, briefingRows, briefingShown } from '../../src/ui/briefingScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS, wrap } from '../../src/ui/widgets';
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

  test('with the mech that fell or broke off in it, knowing nothing of the pilot yet; and its notice is there three contracts later, after the job and before the swarm', () => {
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
    // Whatever these flights fired at it, it taught them nothing: that is for a meeting.
    expect(begun).toEqual({ name: begun.name, kind: begun.kind, origin: begun.origin, met: 0, waited: 0 });
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

  test('all of its briefing is on the page, to the last line, wherever it is fought and at every meeting: in English and in Dutch', () => {
    const places = new Set<string>();
    for (const language of ['en', 'nl'] as const) {
      for (let won = 20; won < 28; won++) {
        for (const met of [0, 1, 2]) {
          const state = pilot(won, { grudge: account({ met }) });
          const { app } = inHub(language === 'nl' ? dutch(state) : state);
          setLanguage(language);
          const made = grudgeContract(state, BOARD_TEXT, CALLED)!;
          places.add(made.battles[0].background);
          select(app, 'contracts');
          select(app, made.id);
          for (let i = 0; i < 400 && (snap(app) as { typing?: boolean }).typing; i++) app.update(50);
          const words = said(app);
          for (const paragraph of made.briefing) {
            for (const line of wrap(paragraph, BRIEFING_CHARS)) expect(words, `${language} ${won} won, meeting ${met + 1}: ${line}`).toContain(line);
          }
        }
      }
    }
    expect(places.size).toBe(BOARD_TEXT.backgrounds.length);
  });

  test('its battle fields their machine under their callsign, hardened against the weapon they know, and nothing else on the field is', () => {
    const { app } = inHub(game);
    accept(app, notice.id);
    const battle = snap(app).battle as unknown as { enemies: string[]; hardened: string[]; objective: string };
    expect(battle.enemies[0]).toBe('heavy-mech');
    expect(battle.hardened).toEqual([JUGGERNAUT.rightHand]);
    // With a hardening that wears: so much of the armour its core stands in.
    const core = createBattle(JUGGERNAUT, [grudgeEnemy(game, ENEMIES)!], CATALOG, 1, { enemyScale: notice.scale }).units[1].parts.core!;
    expect((battle as unknown as { hardening: number }).hardening).toBe(Math.round(GRUDGE_NUMBERS.hardening * core.maxAp));
    expect(battle.objective).toBe(STRINGS.objectives.leader('Brakk'));
    expect(said(app)).toContain(STRINGS.objectives.leader('Brakk'));
  });
});

describe('how much of a briefing the page draws, and how much it is said to draw', () => {
  /** A paragraph that wraps to exactly so many lines, each one its own: so that a line can be looked for on the page. */
  const paragraph = (lines: number, mark: string): string => Array.from({ length: lines }, (_, i) => `${mark}${i}`.padEnd(BRIEFING_CHARS, 'x')).join(' ');
  /** The notice at this progress with other words for a briefing, drawn once it has written itself out. */
  function page(won: number, briefing: string[]) {
    const state = pilot(won, { grudge: account() });
    const { app } = inHub(state);
    const mission = { ...grudgeContract(state, BOARD_TEXT, CALLED)!, briefing };
    const screen = new BriefingScreen(app, mission);
    for (let i = 0; i < 2000 && screen.view().typing; i++) screen.update(50);
    const texts = record((ctx) => screen.draw(ctx)).texts;
    const body = briefing.flatMap((text) => wrap(text, BRIEFING_CHARS));
    const drawnLines = body.filter((line) => texts.some((t) => t.text === line));
    return { mission, body, drawn: drawnLines.length, at: (line: string) => texts.find((t) => t.text === line)!.y, said: briefingShown(mission) };
  }
  // A notice with a line for the ground under it, and one without: eight rows for what is said, and nine.
  const withGround = Array.from({ length: 12 }, (_, i) => 20 + i).find((won) => briefingRows(grudgeContract(pilot(won, { grudge: account() }), BOARD_TEXT, CALLED)!) === 8)!;
  const without = Array.from({ length: 12 }, (_, i) => 20 + i).find((won) => briefingRows(grudgeContract(pilot(won, { grudge: account() }), BOARD_TEXT, CALLED)!) === 9)!;

  test('there is a notice of each kind, and a paragraph made for the test wraps to the lines it was made of', () => {
    expect(withGround).toBeDefined();
    expect(without).toBeDefined();
    expect(wrap(paragraph(3, 'a'), BRIEFING_CHARS)).toHaveLength(3);
    expect(new Set(wrap(paragraph(3, 'a'), BRIEFING_CHARS)).size).toBe(3);
  });

  test('one paragraph: as many lines as there are rows, and no more', () => {
    for (const [won, rows] of [[withGround, 8], [without, 9]] as const) {
      const full = page(won, [paragraph(rows, 'a')]);
      expect(full.body).toHaveLength(rows);
      expect([full.drawn, full.said.shown, full.said.lines], `${rows} rows, full`).toEqual([rows, rows, rows]);
      const over = page(won, [paragraph(rows + 1, 'a')]);
      expect([over.drawn, over.said.shown, over.said.lines], `${rows} rows, one over`).toEqual([rows, rows, rows + 1]);
    }
  });

  test('three paragraphs: a line less than there are rows, because of the gap under each; and the page and the count agree', () => {
    for (const [won, rows] of [[withGround, 8], [without, 9]] as const) {
      const fits = page(won, [paragraph(1, 'a'), paragraph(3, 'b'), paragraph(rows - 5, 'c')]);
      expect(fits.body).toHaveLength(rows - 1);
      expect([fits.drawn, fits.said.shown, fits.said.lines], `${rows} rows, a line under`).toEqual([rows - 1, rows - 1, rows - 1]);
      // As many lines as rows: the last is not drawn, and is not said to be.
      const over = page(won, [paragraph(1, 'a'), paragraph(3, 'b'), paragraph(rows - 4, 'c')]);
      expect(over.body).toHaveLength(rows);
      expect([over.drawn, over.said.shown, over.said.lines], `${rows} rows, as many lines`).toEqual([rows - 1, rows - 1, rows]);
      // The gap: a line of the next paragraph stands that much lower than a line of the same paragraph would.
      const [first, second, third] = [fits.at(fits.body[0]), fits.at(fits.body[1]), fits.at(fits.body[2])];
      expect(third - second).toBe(11);
      expect(second - first).toBe(11 + 4);
    }
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
  /** The battle on its screen, at the pilot's turn: hurried, or (asked so) played as it is on the handheld, with what is heard written down. */
  function shown(state: BattleState, fast = true) {
    const heard: string[] = [];
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast, background: 'bg-mine', sfx: { play: (name: string) => { heard.push(name); } } as never });
    for (let i = 0; i < 4000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
    return { screen, flow, heard, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
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
    const row = texts.filter((t) => t.size === 10 && t.align === 'left' && (t.text.startsWith(STRINGS.tags.hardened) || t.text === STRINGS.tags.half));
    // In the row: hardened, with what the hardening can still take, and that this weapon does half.
    const left = made.flow.state.units[1].hardening!;
    expect(left).toBeGreaterThan(20);
    expect(STRINGS.tags.hardenedLeft(left)).toBe(`HARDENED ${left}`);
    expect(row.map((t) => [t.text, t.color])).toEqual([[STRINGS.tags.hardenedLeft(left), COLORS.accent], [STRINGS.tags.half, COLORS.danger]]);
    const preview = previewShot(made.flow.state, 'player', 'rightHand', 'enemy-0', 'core', CATALOG);
    const plain = previewShot(field(ENEMIES['heavy-mech']), 'player', 'rightHand', 'enemy-0', 'core', CATALOG);
    expect(preview.damage).toBeLessThan(plain.damage);
    expect(texts.some((t) => t.text.includes(`${STRINGS.preview.damage} ${preview.damage}`))).toBe(true);
    expect(texts.some((t) => t.text.includes(`${STRINGS.preview.damage} ${plain.damage}`))).toBe(false);
  });

  test('in a row with no room for everything, what it is about to do makes way: that it is hardened, and that this weapon does half, are said nowhere else', () => {
    const T = STRINGS.tags;
    const rowOf = (made: ReturnType<typeof shown>): string[] => {
      const texts = made.page().texts;
      const at = texts.find((t) => t.text.startsWith(T.hardened) && t.align === 'left')!.y;
      return texts.filter((t) => t.y === at && t.align === 'left' && t.size === 10).map((t) => t.text);
    };
    // With nothing else on it the row has room for what the machine is about to do, which stands last.
    const roomy = shown(field());
    aim(roomy, 0);
    const plain = rowOf(roomy);
    const word = T.hardenedLeft(roomy.flow.state.units[1].hardening!);
    expect(plain.slice(0, 2)).toEqual([word, T.half]);
    expect(plain).toHaveLength(3);
    const intent = plain[2];
    // Guarding as well, there is one tag more than the row holds beside this name.
    const full = field();
    full.units[1].guarding = true;
    const tight = shown(full);
    aim(tight, 0);
    expect(rowOf(tight)).toEqual([word, T.half, T.guard]);
    expect(tight.page().texts.filter((t) => t.text === intent)).toEqual([]);
  });

  test('a hit of the weapon it knows takes what it did off the number in the row; shot away, nothing says hardened or half, and the bar says it is gone', () => {
    for (let seed = 1; seed <= 30; seed++) {
      // A hardening one hit short of gone, and one with room for many.
      const thin = field();
      thin.rng = createBattle(JUGGERNAUT, [theirs], CATALOG, seed).rng;
      const whole = structuredClone(thin);
      thin.units[1].hardening = 3;
      // (Not hurried: what is written over a machine and what is heard are left out of a hurried battle.)
      const fire = (state: BattleState) => {
        const made = shown(state, false);
        aim(made, 0);
        const worth = previewShot(made.flow.state, 'player', 'rightHand', 'enemy-0', made.flow.targetPart!, CATALOG).damage;
        const at = made.flow.state.events.length;
        made.screen.onInput('confirm');
        const said: string[] = [];
        // What is written over the field while the shot plays, looked at every few frames.
        const words = new Set<string>();
        made.heard.length = 0;
        for (let i = 0; i < 6000 && (made.flow.phase === 'animating' || made.flow.phase === 'target'); i++) {
          made.screen.update(16);
          if (!said.includes(made.flow.message)) said.push(made.flow.message);
          if (i % 4 === 0) for (const t of made.page().texts) words.add(t.text);
        }
        const landed = made.flow.state.events.slice(at).filter((event) => event.type === 'shot' && event.unit === 'player' && event.hit);
        return { made, worth, landed: landed.length, said, words, heard: [...made.heard] };
      };
      const a = fire(whole);
      if (a.landed !== 1) continue;
      // With room: the number is less by what the hit did, and it is hardened still.
      const before = whole.units[1].hardening!;
      expect(a.made.flow.state.units[1].hardening).toBe(before - a.worth);
      expect(a.made.screen.markOver('enemy-0')).not.toBeNull();
      expect(a.said).not.toContain(STRINGS.hardeningGone('Brakk'));
      expect(a.words.has(STRINGS.fx.hardeningGone)).toBe(false);
      // One hit short of gone: it is gone, the bar has said so, and nothing over the machine or beside its name says hardened.
      const b = fire(thin);
      expect(b.landed).toBe(1);
      expect(b.made.flow.state.units[1].hardened).toBeUndefined();
      expect(b.said).toContain(STRINGS.hardeningGone('Brakk'));
      expect(STRINGS.hardeningGone('Brakk')).toBe('Brakk has no hardening left');
      // And over the machine, as it goes, the word for it.
      expect(b.words.has(STRINGS.fx.hardeningGone)).toBe(true);
      expect(STRINGS.fx.hardeningGone).toBe('HARDENING GONE');
      // It is heard: the ring of a machine knocked off its balance, which the shot with room left did not make.
      expect(b.heard).toContain('stagger');
      expect(a.heard).not.toContain('stagger');
      expect(b.made.screen.markOver('enemy-0')).not.toBe(STRINGS.tags.hardened);
      expect(b.made.flow.halved).toBe(false);
      const texts = b.made.page().texts.map((t) => t.text);
      expect(texts.filter((text) => text.startsWith(STRINGS.tags.hardened) || text === STRINGS.tags.half)).toEqual([]);
      return;
    }
    throw new Error('no seed on which the one shot lands');
  });

  test('beside a machine that covers it, it says that it is covered and that it is hardened in turn: neither hides the other', () => {
    let s = createBattle(JUGGERNAUT, [theirs, ENEMIES['shield-drone']], CATALOG, 3, { objective: { type: 'leader', target: 0 } });
    for (let guard = 0; activeUnit(s).id !== 'player' && guard < 20; guard++) s = applyAction(s, END, CATALOG);
    s = structuredClone(s);
    for (const unit of s.units) { unit.boosted = false; unit.guarding = false; unit.staggered = 0; }
    const { screen } = shown(s);
    const words = new Set<string | null>();
    for (let t = 0; t < 2 * MARK_TURN_MS; t += 16) { screen.update(16); words.add(screen.markOver('enemy-0')); }
    expect([...words].sort()).toEqual([STRINGS.tags.covered, STRINGS.tags.hardened].sort());
    // The same machine not hardened says only that it is covered.
    let plain = createBattle(JUGGERNAUT, [ENEMIES['heavy-mech'], ENEMIES['shield-drone']], CATALOG, 3);
    for (let guard = 0; activeUnit(plain).id !== 'player' && guard < 20; guard++) plain = applyAction(plain, END, CATALOG);
    plain = structuredClone(plain);
    for (const unit of plain.units) { unit.boosted = false; unit.guarding = false; unit.staggered = 0; }
    const other = shown(plain).screen;
    const seen = new Set<string | null>();
    for (let t = 0; t < 2 * MARK_TURN_MS; t += 16) { other.update(16); seen.add(other.markOver('enemy-0')); }
    expect([...seen]).toEqual([STRINGS.tags.covered]);
  });

  test('aimed at with any other weapon: hardened still, and nothing does half', () => {
    const made = shown(field());
    aim(made, 1);
    expect(made.flow.halved).toBe(false);
    const texts = made.page().texts;
    expect(texts.filter((t) => t.text === STRINGS.tags.half)).toEqual([]);
    expect(texts.some((t) => t.text.startsWith(STRINGS.tags.hardened) && t.align === 'left')).toBe(true);
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
