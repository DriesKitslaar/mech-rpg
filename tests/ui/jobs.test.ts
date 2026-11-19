import { JOB_KINDS, jobContract, jobKind, type JobKind } from '../../src/core/jobs';
import { boardTier, generateBoard, swarmContract } from '../../src/core/board';
import type { GameState } from '../../src/core/game';
import { MEDAL_PAY, medalProgress } from '../../src/core/medals';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { setLanguage } from '../../src/content/language';
import { MEDALS } from '../../src/content/medals';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS } from '../../src/ui/widgets';
import { autoBattle, done, finishMission, ids, inHub, makeApp, press, savedGame, select, snap, strong, toHub } from '../helpers/app';
import { overlap, record, type Drawn } from '../helpers/canvas';

/**
 * The board's jobs as the pilot meets them: on the list of contracts, at the briefing, on the field
 * to the end of each kind, won and lost, and in the kept game afterwards.
 */

afterEach(() => setLanguage('en'));

const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
/** Battles won at which each kind is on offer in a first telling, early in the board's second tier. */
const AT: Record<JobKind, number> = { hit: 12, repo: 13, escort: 10, hold: 11 };
/** A pilot past the introductions in a frame nothing on an early board can hurt much, with so many battles won. */
const pilot = (wins: number, extra: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins, credits: 5000, scenes: ['act-1'], ...extra });
const jobOf = (wins: number, cycle = 0) => jobContract(wins, cycle, BOARD_TEXT)!;
const dutch = (game: GameState): GameState => ({ ...game, settings: { ...game.settings, language: 'nl' } });

/** Plays the battle on screen to its result without doing anything in it. */
function idle(app: App): void {
  for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
    const s = snap(app);
    if (s.battle!.phase === 'animating') app.update(16);
    else if (s.battle!.phase === 'action') select(app, 'endTurn');
    else press(app, 'confirm');
  }
  expect(snap(app).battle?.phase).toBe('result');
}
function open(game: GameState, id: string) {
  const made = inHub(game);
  select(made.app, 'contracts');
  select(made.app, id);
  expect(snap(made.app).screen).toBe('briefing');
  return made;
}
function fly(game: GameState, id: string) {
  const made = open(game, id);
  select(made.app, 'accept');
  expect(snap(made.app).screen).toBe('battle');
  return made;
}

describe('on the list of contracts', () => {
  test('the kinds are where this file says they are', () => {
    for (const kind of JOB_KINDS) {
      expect(jobKind(AT[kind], 0), kind).toBe(kind);
      expect(boardTier(AT[kind], 0)).toBe(2);
      expect(jobOf(AT[kind]).job).toBe(kind);
    }
  });

  test('the job stands after the board\'s three and before the swarm, by its title, with what it pays', () => {
    const { app } = inHub(pilot(12));
    const job = jobOf(12);
    const board = generateBoard(12, 0, BOARD_TEXT);
    const swarm = swarmContract(12, 0, BOARD_TEXT);
    expect(app.missions().map((mission) => mission.id).slice(-5)).toEqual([...board.map((mission) => mission.id), 'open-0-12-job', swarm.id]);
    expect(app.missions().find((mission) => mission.id === 'open-0-12-job')).toEqual(job);
    select(app, 'contracts');
    const rows = snap(app).menu.items;
    const at = rows.findIndex((row) => row.id === 'open-0-12-job');
    expect(rows[at]).toEqual({ id: 'open-0-12-job', label: job.title, enabled: true, note: String(job.reward) });
    expect(job.title.startsWith('Hit: ')).toBe(true);
    expect(rows[at - 1].id).toBe(board[2].id);
    expect(rows[at + 1].id).toBe(swarm.id);
    // On the page: the title whole, clear of what it pays.
    const shown = drawn(app);
    const title = shown.texts.filter((t) => t.text === job.title);
    expect(title).toHaveLength(1);
    const pay = shown.texts.filter((t) => t.text === String(job.reward) && t.y >= title[0].y && t.y <= title[0].y + 1);
    expect(pay.length).toBeGreaterThanOrEqual(1);
    expect(pay[0].left).toBeGreaterThanOrEqual(title[0].right + 4);
  });

  test('there is none before the board has grown to its first tier, and none for a pilot whose own mech cannot deploy', () => {
    const early = inHub(pilot(4)).app;
    expect(early.missions().some((mission) => mission.job !== undefined)).toBe(false);
    expect(early.missions().filter((mission) => mission.id.startsWith('open-'))).toHaveLength(4);
    expect(inHub(pilot(5)).app.missions().filter((mission) => mission.id.startsWith('open-')).map((mission) => mission.id)).toEqual(['open-0-5-0', 'open-0-5-1', 'open-0-5-2', 'open-0-5-job', 'open-0-5-swarm']);
    // Before the introductions are done there are no open contracts at all.
    expect(inHub({ ...pilot(12), completed: ['intro-1'] }).app.missions().some((mission) => mission.id.startsWith('open-'))).toBe(false);
    // Unarmed: Dispatch lends a frame for the patrol and nothing else is on offer.
    const base = pilot(12);
    const unarmed = inHub({ ...base, build: { ...base.build, rightHand: undefined, leftHand: undefined, shoulder: undefined } }).app;
    expect(unarmed.buildErrors()).toContain('noWeapon');
    expect(unarmed.missions().map((mission) => mission.id)).toEqual(['patrol']);
  });

  test('in every one of forty boards the list keeps to its panel in both languages', () => {
    for (const language of ['en', 'nl'] as const) {
      for (let wins = 5; wins < 45; wins++) {
        const base = pilot(wins);
        const { app } = inHub(language === 'nl' ? dutch(base) : base);
        select(app, 'contracts');
        const job = app.missions().find((mission) => mission.job !== undefined)!;
        expect(job.title.length, job.title).toBeLessThanOrEqual(18);
        const shown = drawn(app);
        const title = shown.texts.filter((t) => t.text === job.title);
        expect(title, `${language} ${wins} ${job.title}`).toHaveLength(1);
        const pay = shown.texts.filter((t) => t.align === 'right' && t.y >= title[0].y && t.y <= title[0].y + 1);
        expect(pay).toHaveLength(1);
        expect(pay[0].left, job.title).toBeGreaterThanOrEqual(title[0].right + 4);
        expect(pay[0].right).toBeLessThanOrEqual(LOGICAL_W - 4);
      }
    }
  });
});

describe('at the briefing', () => {
  const HEAD: Record<JobKind, string> = {
    hit: 'OPEN CONTRACT: A HIT', repo: 'OPEN CONTRACT: A REPOSSESSION', escort: 'OPEN CONTRACT: AN ESCORT', hold: 'OPEN CONTRACT: A HOLDING ACTION',
  };
  const KOP: Record<JobKind, string> = {
    hit: 'OPEN CONTRACT: DOELWIT', repo: 'OPEN CONTRACT: EEN BESLAG', escort: 'OPEN CONTRACT: EEN ESCORTE', hold: 'OPEN CONTRACT: STANDHOUDEN',
  };
  const named = (wins: number): string => {
    const [battle] = jobOf(wins).battles;
    return ALL_ENEMIES[battle.enemies[(battle.objective as { target: number }).target]].name;
  };

  test.each(JOB_KINDS)('a %s is headed by its kind and says under the client\'s words what it asks', (kind) => {
    const job = jobOf(AT[kind]);
    const { app } = open(pilot(AT[kind]), job.id);
    expect(STRINGS.briefing.jobs).toEqual(HEAD);
    const brief = snap(app).briefing!;
    expect(brief).toMatchObject({ mission: job.id, reward: job.reward, replay: false, lent: false });
    const asked: Record<JobKind, () => string[]> = {
      hit: () => [`Destroy: ${named(AT.hit)}`],
      repo: () => [`Disable, do not destroy: ${named(AT.repo)}`],
      escort: () => [`Protect: ${(job.battles[0].objective as { name: string }).name}`],
      hold: () => ['Hold out for 6 rounds', '4 more come on as they fall'],
    };
    expect(brief.objectives).toEqual(asked[kind]());
    // The client's words are written out letter by letter; what is asked stands under them once they are.
    for (let i = 0; i < 4000; i++) app.update(16);
    const shown = drawn(app);
    const head = shown.texts.filter((t) => t.text === HEAD[kind]);
    expect(head.map((t) => [t.x, t.y, t.color])).toEqual([[72, 40, COLORS.dim]]);
    expect(shown.texts.filter((t) => t.text === job.title.toUpperCase()).map((t) => [t.x, t.y])).toEqual([[72, 8]]);
    for (const line of asked[kind]()) expect(shown.texts.filter((t) => t.text === line).map((t) => t.color), line).toEqual([COLORS.heat]);
    // What the kind asks is among the client's words, whole.
    const said = shown.texts.map((t) => t.text).join(' ');
    for (const word of BOARD_TEXT.jobs[kind].brief.split(' ')) expect(said, word).toContain(word);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 2);
    const header = shown.texts.filter((t) => t.y < 70);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });

  test.each(JOB_KINDS)('a %s in Dutch: its heading, its title and what it asks fit the page', (kind) => {
    const { app } = open(dutch(pilot(AT[kind])), `open-0-${AT[kind]}-job`);
    expect(STRINGS_NL.briefing.jobs).toEqual(KOP);
    for (let i = 0; i < 4000; i++) app.update(16);
    const job = app.missions().find((mission) => mission.job === kind)!;
    const shown = drawn(app);
    expect(shown.texts.filter((t) => t.text === KOP[kind]).map((t) => [t.x, t.y])).toEqual([[72, 40]]);
    expect(job.title).toMatch(/^(Doelwit|Beslag|Escorte|Stand): /);
    expect(shown.texts.filter((t) => t.text === job.title.toUpperCase())).toHaveLength(1);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 2);
    const header = shown.texts.filter((t) => t.y < 70);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    const asked = (snap(app).briefing as { objectives: string[] }).objectives;
    expect(asked.length).toBe(kind === 'hold' ? 2 : 1);
    expect(asked[0]).toMatch({ hit: /^Vernietig: /, repo: /^Leg lam, vernietig niet: /, escort: /^Bescherm: (Loonwagen|Ertslift|Colonne|Pompschuit)$/, hold: /^Houd 6 rondes vol$/ }[kind]);
    for (const line of asked) expect(shown.texts.filter((t) => t.text === line)).toHaveLength(1);
  });

  test('the odds are counted for a job as for any contract, where somebody is reading', () => {
    const { app } = makeApp(pilot(AT.escort), undefined, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(600); press(app, 'confirm'); }
    select(app, 'contracts');
    select(app, `open-0-${AT.escort}-job`);
    const odds = () => (snap(app).briefing as unknown as { odds: { played: number; won: number; done: boolean } | null }).odds;
    for (let i = 0; i < 4000 && !odds()?.done; i++) app.update(16);
    expect(odds()).toMatchObject({ played: 20, done: true });
    // The heaviest frame there is, early in the board: it wins nearly all of them.
    expect(odds()!.won).toBeGreaterThanOrEqual(17);
    expect(drawn(app).texts.filter((t) => t.text === `ODDS ${odds()!.won}/20`)).toHaveLength(1);
  });

  test('in Dutch every title begins with its kind in Dutch, every asset has its Dutch name, and all of them fit', () => {
    setLanguage('nl');
    const woord: Record<JobKind, string> = { hit: 'Doelwit', repo: 'Beslag', escort: 'Escorte', hold: 'Stand' };
    for (const kind of JOB_KINDS) {
      const { titles, brief } = BOARD_TEXT.jobs[kind];
      expect(titles).toHaveLength(5);
      expect(new Set(titles).size).toBe(5);
      for (const title of titles) {
        expect(title.startsWith(`${woord[kind]}: `), title).toBe(true);
        expect(title.length, title).toBeLessThanOrEqual(18);
      }
      // What the kind asks is said in Dutch.
      expect(brief).toMatch({ hit: /^Het loon is voor een machine/, repo: /^De klant wil een machine heel terug/, escort: /^De vracht van de klant/, hold: /^Er komt meer dan dit loon waard is/ }[kind]);
    }
    expect(BOARD_TEXT.assets).toEqual(['Loonwagen', 'Ertslift', 'Colonne', 'Pompschuit']);
    setLanguage('en');
    expect(BOARD_TEXT.assets).toEqual(['Wage Truck', 'Ore Lift', 'Motorcade', 'Pump Barge']);
    expect(BOARD_TEXT.jobs.hit.titles[0]).toBe('Hit: Loose End');
  });

  test('no job is headed as an elite contract or as a plain one, and the board\'s own are headed as they were', () => {
    const { app } = open(pilot(12), 'open-0-12-job');
    const texts = drawn(app).texts.map((t) => t.text);
    expect(texts).not.toContain('OPEN CONTRACT');
    expect(texts).not.toContain('OPEN CONTRACT: AN ELITE');
    const plain = open(pilot(12), 'open-0-12-0').app;
    expect(drawn(plain).texts.map((t) => t.text)).toContain('OPEN CONTRACT');
    const swarm = open(pilot(12), 'open-0-12-swarm').app;
    expect(drawn(swarm).texts.map((t) => t.text)).toContain('OPEN CONTRACT: A SWARM');
  });
});

describe('on the field', () => {
  test('a hit: the named machine is marked and overclocked, and the job is won when it falls with the rest still standing', () => {
    const job = jobOf(AT.hit);
    const { app, store } = fly(pilot(AT.hit), job.id);
    const target = (job.battles[0].objective as { target: number }).target;
    const name = ALL_ENEMIES[job.battles[0].enemies[target]].name;
    expect(snap(app).battle).toMatchObject({ mission: job.id, of: 1, objective: `TARGET: ${name.toUpperCase()}`, elites: [{ id: `enemy-${target}`, mark: 'overclocked' }] });
    expect(snap(app).battle!.enemyScale).toBeCloseTo(job.scale!, 10);
    autoBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory' });
    expect(snap(app).battle).toMatchObject({ note: 'Their leader is down.' });
    expect(snap(app).battle!.enemies.length).toBe(job.battles[0].enemies.length - 1);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: job.reward });
    expect(savedGame(store).jobs).toEqual({ hit: 1 });
    expect(savedGame(store).battlesWon).toBe(AT.hit + 1);
    // Back in the hub the board has turned: the job on offer is the next kind.
    toHub(app);
    expect(app.missions().find((mission) => mission.job !== undefined)).toMatchObject({ id: `open-0-${AT.hit + 1}-job`, job: 'repo' });
  });

  test('a repossession is lost when the machine wanted is destroyed, and nothing is counted or paid', () => {
    const job = jobOf(AT.repo);
    const { app, store } = fly(pilot(AT.repo), job.id);
    const name = ALL_ENEMIES[job.battles[0].enemies[0]].name;
    expect(snap(app).battle).toMatchObject({ objective: `DISABLE: ${name.toUpperCase()}`, elites: [] });
    // The aim starts on what has to come off it. Moved to its core, turn after turn, it is destroyed.
    let first: string | null = null;
    for (let i = 0; i < 40000 && snap(app).battle?.phase !== 'result'; i++) {
      const s = snap(app);
      const phase = s.battle!.phase;
      if (phase === 'animating') app.update(16);
      else if (phase === 'action') { if (s.menu.items[0].enabled) press(app, 'confirm'); else select(app, 'endTurn'); }
      else if (phase === 'target') { first ??= s.menu.items[s.menu.cursor].id; select(app, 'core'); }
      else press(app, 'confirm');
    }
    expect(['legs', 'arms']).toContain(first);
    expect(snap(app).battle).toMatchObject({ outcome: 'defeat', note: 'The target was destroyed.' });
    expect(snap(app).battle!.enemies).not.toContain(job.battles[0].enemies[0]);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: false, reward: 0 });
    expect(savedGame(store).jobs).toBeUndefined();
    expect(savedGame(store).battlesWon).toBe(AT.repo);
  });

  test('a repossession flown by firing at whatever is aimed at first is won: the aim never starts on the core of the machine wanted', () => {
    const job = jobOf(AT.repo);
    const { app, store } = fly(pilot(AT.repo), job.id);
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: job.reward });
    expect(savedGame(store).jobs).toEqual({ repo: 1 });
  });

  test('a repossession is won with the machine\'s arms and legs gone and its core whole', () => {
    const job = jobOf(AT.repo);
    const { app, store } = fly(pilot(AT.repo), job.id);
    autoBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory' });
    expect(snap(app).battle).toMatchObject({ note: 'Disabled, in one piece.' });
    expect(snap(app).battle!.enemies).toContain(job.battles[0].enemies[0]);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: job.reward });
    expect(savedGame(store).jobs).toEqual({ repo: 1 });
  });

  test('an escort is lost when the freight is, and won with it standing', () => {
    const job = jobOf(AT.escort);
    const asset = (job.battles[0].objective as { name: string; hp: number });
    const lost = fly(pilot(AT.escort), job.id);
    expect(snap(lost.app).battle).toMatchObject({ objective: `${asset.name.toUpperCase()} ${asset.hp}/${asset.hp}` });
    idle(lost.app);
    expect(snap(lost.app).battle).toMatchObject({ outcome: 'defeat' });
    expect(snap(lost.app).battle).toMatchObject({ note: `${asset.name}: lost.` });
    press(lost.app, 'confirm');
    expect(snap(lost.app).settlement).toMatchObject({ won: false });
    expect(savedGame(lost.store).jobs).toBeUndefined();
    const won = fly(pilot(AT.escort), job.id);
    autoBattle(won.app);
    expect(snap(won.app).battle).toMatchObject({ outcome: 'victory', enemies: [] });
    expect(snap(won.app).battle).toMatchObject({ note: `${asset.name}: safe.` });
    press(won.app, 'confirm');
    expect(snap(won.app).settlement).toMatchObject({ won: true, reward: job.reward });
    expect(savedGame(won.store).jobs).toEqual({ escort: 1 });
  });

  test('a holding action counts its rounds, says how many are behind, and is won when the sixth is over', () => {
    const job = jobOf(AT.hold);
    const { app, store } = fly(pilot(AT.hold), job.id);
    expect(snap(app).battle).toMatchObject({ objective: 'HOLD OUT 1/6  +4', round: 1, note: null });
    expect(snap(app).battle!.enemyScale).toBeCloseTo(job.scale!, 10);
    idle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory', round: 6 });
    expect(snap(app).battle).toMatchObject({ note: 'You held the line.' });
    expect(snap(app).battle!.enemies.length).toBeGreaterThan(0);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: job.reward });
    expect(savedGame(store).jobs).toEqual({ hold: 1 });
  });
});

describe('in the kept game', () => {
  const medal = (id: string) => MEDALS.find((m) => m.id === id)!;

  test('there is a medal for one of each kind and one for twenty-five jobs, and they say how far along a pilot is', () => {
    expect(medal('job-each')).toMatchObject({ name: 'Odd Jobs', text: 'Win a job of each of the 4 kinds on the board.', tier: 1 });
    expect(medal('job-25')).toMatchObject({ name: 'On Retainer', text: 'Win 25 jobs.', tier: 2 });
    const none = pilot(12);
    expect(medalProgress(medal('job-each'), none)).toEqual({ have: 0, need: 4, earned: false });
    expect(medalProgress(medal('job-25'), none)).toEqual({ have: 0, need: 25, earned: false });
    const some = { ...none, jobs: { hit: 9, hold: 3 } };
    expect(medalProgress(medal('job-each'), some)).toEqual({ have: 2, need: 4, earned: false });
    expect(medalProgress(medal('job-25'), some)).toEqual({ have: 12, need: 25, earned: false });
    // Twenty-five of one kind are twenty-five jobs and one kind.
    const one = { ...none, jobs: { repo: 25 } };
    expect(medalProgress(medal('job-each'), one)).toMatchObject({ have: 1 });
    expect(medalProgress(medal('job-25'), one)).toMatchObject({ have: 25, need: 25 });
    // In Dutch they have Dutch names and say in Dutch what they take.
    setLanguage('nl');
    expect(medal('job-each')).toMatchObject({ name: 'Klusjesman', text: 'Win een klus van elk van de 4 soorten op het bord.' });
    expect(medal('job-25')).toMatchObject({ name: 'Vaste kracht', text: 'Win 25 klussen.' });
  });

  test('the fourth kind won earns the first medal, and the twenty-fifth job the second, each paid once', () => {
    const job = jobOf(AT.hold);
    const { app, store } = fly(pilot(AT.hold, { jobs: { hit: 1, repo: 1, escort: 21 } }), job.id);
    const before = savedGame(store);
    expect(before.medals).not.toContain('job-each');
    idle(app);
    press(app, 'confirm');
    const after = savedGame(store);
    expect(after.jobs).toEqual({ hit: 1, repo: 1, escort: 21, hold: 1 });
    expect(after.medals).toEqual(expect.arrayContaining(['job-each']));
    expect(after.medals).not.toContain('job-25');
    const earned = after.medals.filter((id) => !before.medals.includes(id));
    const paid = earned.reduce((sum, id) => sum + MEDAL_PAY[medal(id).tier], 0);
    expect(after.credits).toBe(before.credits + snap(app).settlement!.net + paid);
    // One more job, of any kind, is the twenty-fifth.
    toHub(app);
    const next = app.missions().find((mission) => mission.job !== undefined)!;
    select(app, 'contracts');
    select(app, next.id);
    select(app, 'accept');
    autoBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'victory' });
    press(app, 'confirm');
    expect(savedGame(store).medals).toEqual(expect.arrayContaining(['job-each', 'job-25']));
    expect(savedGame(store).medals.filter((id) => id === 'job-each')).toHaveLength(1);
  });

  test('a contract of the board\'s own, a swarm and the patrol are no jobs: winning one counts nothing', () => {
    for (const id of ['open-0-12-0', 'open-0-12-swarm', 'patrol']) {
      const { app, store } = fly(pilot(12), id);
      for (let i = 0; i < 4 && snap(app).screen === 'battle'; i++) { autoBattle(app); press(app, 'confirm'); }
      expect(snap(app).settlement, id).toMatchObject({ won: true });
      expect(savedGame(store).jobs, id).toBeUndefined();
    }
  });

  test('the list of contracts as a pilot with jobs behind them sees it is the list anyone sees', () => {
    const plain = inHub(pilot(12)).app;
    const veteran = inHub(pilot(12, { jobs: { hit: 40, repo: 40, escort: 40, hold: 40 } })).app;
    expect(veteran.missions()).toEqual(plain.missions());
    select(veteran, 'contracts');
    expect(ids(veteran)).toContain('open-0-12-job');
  });
});
