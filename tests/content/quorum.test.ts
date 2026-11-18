import { arrivedMessages, availableMissions, completeMission, decide, dueScenes, forCycle, type Mission } from '../../src/core/campaign';
import { checksHeld, openEntries, papersFound } from '../../src/core/codex';
import { awardMedals } from '../../src/core/medals';
import { newGame, type GameState } from '../../src/core/game';
import { ENEMY_COST, STORY_ENEMIES } from '../../src/core/board';
import { takesWingman } from '../../src/core/wingman';
import { UNITS, WORLD } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { FINDS } from '../../src/content/finds';
import { MEDALS } from '../../src/content/medals';
import { EPILOGUES, MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { eyeOf } from '../../src/ui/eyes';
import { placeFor, PLACES } from '../../src/ui/stage';
import { autoBattle, done, inHub, press, savedGame, select, skipScenes, snap, strong } from '../helpers/app';

const quorum = MISSIONS.find((m) => m.id === 'verdict-quorum') as Mission;
const fresh = (cycle = 1): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), cycle });
const did = (game: GameState, ...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), game);
const WAR = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-undertow', 'undertow-3', 'undertow-4', 'undertow-5', 'finale-undertow',
];
const AUDIT = ['audit-1', 'audit-2', 'audit-3'];
const QUESTS = ['quest-1', 'quest-2', 'quest-3'];
/** This many checks, beginning with the two the Undertow's road always leaves a pilot with: the dock's and Krell's. */
const checks = (n: number): string[] => {
  const all = FINDS.filter((f) => f.kind === 'check').map((f) => f.id);
  return [...all.filter((id) => id === 'check-dock' || id === 'check-krell'), ...all.filter((id) => id !== 'check-dock' && id !== 'check-krell')].slice(0, n);
};
/** A pilot of a later telling at the end of the audit, with the box brought home and this many checks. */
const audited = (held: number, cycle = 1): GameState => ({ ...decide(did(fresh(cycle), ...WAR, ...QUESTS, ...AUDIT), 'logs', 'keep'), codex: checks(held) });
const verdicts = (game: GameState): string[] => availableMissions(game, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('verdict-'));
const letters = (game: GameState): string[] => arrivedMessages(game, MESSAGES, MISSIONS).map((m) => m.id);

describe('the third verdict', () => {
  test('is offered beside the other two to a pilot who brought the box home and holds nine checks, and to nobody else', () => {
    expect(verdicts(audited(9))).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
    expect(verdicts(audited(16))).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
    expect(verdicts(audited(8))).toEqual(['verdict-enforce', 'verdict-default']);
    // Nine checks without the box: nothing to open with them.
    expect(verdicts({ ...did(fresh(1), ...WAR, 'quest-1', 'quest-2', ...AUDIT), codex: checks(12) })).toEqual(['verdict-enforce', 'verdict-default']);
    // The first telling cannot have the box, so it is never offered there, whatever it holds.
    expect(verdicts({ ...did(fresh(0), ...WAR, ...AUDIT), codex: checks(16) })).toEqual(['verdict-enforce', 'verdict-default']);
    // Before the audit is over it is not on offer either.
    expect(verdicts({ ...did(fresh(1), ...WAR, ...QUESTS, 'audit-1'), codex: checks(9) })).toEqual([]);
  });

  test('is Tamsin\'s, is fought in the hall, and nobody can be hired for it: Ashfall is on the stair', () => {
    expect(quorum).toMatchObject({ phase: 'verdict', verdict: 'quorum', client: 'Tamsin, for the Society', portrait: 'portrait-undertow', title: 'Any Other Business' });
    expect(quorum.faction).toBeUndefined();
    expect(quorum.battles.map((b) => b.background)).toEqual(['bg-hall', 'bg-hall']);
    expect(Object.hasOwn(PLACES, 'bg-hall')).toBe(true);
    expect(placeFor('bg-hall').floor).toBeGreaterThan(120);
    expect('bg-hall' in SPRITES).toBe(true);
    expect(quorum.battles.map((b) => b.support)).toEqual([{ name: 'Ashfall', damage: 45 }, { name: 'Ashfall', damage: 45 }]);
    expect(takesWingman(quorum)).toBe(false);
    // It pays least of the three, as the letter that offers it says: nobody takes it for the fee.
    const reward = (id: string): number => MISSIONS.find((m) => m.id === id)!.reward;
    expect(quorum.reward).toBeLessThan(reward('verdict-default'));
    expect(reward('verdict-default')).toBeLessThan(reward('verdict-enforce'));
    expect(MESSAGES.find((m) => m.id === 'third-offer')!.body[0]).toMatch(/Here is a third\. It pays out of a collection tin/);
  });

  test('the door is held for six rounds while the checks are counted aloud, a round at a time, to nine', () => {
    const [door] = quorum.battles;
    expect(door.objective).toEqual({ type: 'survive', rounds: 6 });
    const said = (at: 'start' | 'win' | number): string => door.talk!.filter((line) => line.at === at).map((line) => `${line.who}: ${line.text}`).join(' ');
    expect(said('start')).toMatch(/^Tamsin: .*One\. Two\. Three\.$/);
    expect(said(3)).toMatch(/Four\. Five\. Six\./);
    // Eight are hung from the bag, however many the pilot holds: the ninth hook is the frame's own.
    expect(said(5)).toMatch(/Seven\. Eight\. Eight on the board\. The ninth hook is yours, pilot/);
    // The ninth is the one that was tied to the frame at the dock, in the first act of every telling. It is
    // counted when the door has been held, before the Actuary answers it: a line kept for a round is lost
    // with a turn lost to heat when no turn follows, and the last round of a door has none after it.
    expect(said(6)).toBe('');
    expect(said('win')).toMatch(/^Tamsin: The ninth is tied to your left foot\. .*the dock\. .*That makes nine\. The Actuary: A quorum\./);
    expect(FINDS.find((f) => f.id === 'check-dock')!.source).toBe('Tied to your frame\'s left foot.');
    // Every round but the last has somebody speaking, and nobody speaks after the count is done.
    expect([...new Set(door.talk!.map((line) => line.at))]).toEqual(['start', 2, 3, 4, 5, 'win']);
  });

  test('then the Proxy: Meridian\'s own machine, with three ways of fighting, a barrier, and clerks that keep arriving', () => {
    expect(quorum.battles[1].enemies).toEqual(['proxy']);
    const proxy = ENEMIES.proxy;
    expect(proxy).toMatchObject({ name: 'The Proxy', sprite: 'boss-proxy', portrait: 'portrait-actuary' });
    expect(proxy.phases!.map((phase) => phase.at)).toEqual([0.66, 0.33]);
    for (const phase of proxy.phases!) expect(phase.line!.length).toBeGreaterThan(20);
    expect(proxy.build.module).toBe('mod-barrier');
    expect(proxy.abilities).toEqual({ carrier: { unit: ENEMIES['lien-drone'], every: 5 } });
    expect(proxy.partNames).toEqual({ core: 'Urn', legs: 'Dais', arms: 'Gavel', head: 'Mask' });
    // Sturdier than the machine the other road ends on, part for part.
    const ap = (id: string): number => (CATALOG[id] as { ap: number }).ap;
    for (const part of ['core', 'legs', 'arms', 'head'] as const) expect(ap(`${part}-proxy`), part).toBeGreaterThan(ap(`${part}-adjuster`));
    // It is of the story: the open contracts never field it, the database has its page, and it looks back.
    expect(STORY_ENEMIES).toContain('proxy');
    expect(ENEMY_COST.proxy).toBe(ENEMY_COST.adjuster);
    expect(UNITS.find((unit) => unit.id === 'proxy')).toMatchObject({ title: 'The Proxy' });
    expect(eyeOf('boss-proxy')).not.toBeNull();
    expect('boss-proxy' in SPRITES).toBe(true);
  });

  test('grows with the cycle like every contract: in the second telling it is a quarter tougher again', () => {
    expect(forCycle(quorum, 1).scale).toBeCloseTo(quorum.scale! * 1.25, 2);
    expect(forCycle(quorum, 2).scale).toBeCloseTo(quorum.scale! * 1.5, 2);
    expect(forCycle(quorum, 1).battles[0].objective).toEqual({ type: 'survive', rounds: 6 });
  });
});

describe('how the third verdict ends', () => {
  const held = (faction: 'hadron' | 'lumen' | 'undertow'): GameState => {
    const war = WAR.map((id) => id.replace(/undertow-([345])|choice-undertow|finale-undertow/, (whole, n) => (n ? `${faction}-${n}` : whole.replace('undertow', faction))));
    return { ...did(fresh(1), ...war, ...QUESTS, ...AUDIT, 'verdict-quorum'), scenes: SCENES.filter((s) => !s.ending && !s.id.startsWith('left-')).map((s) => s.id) };
  };

  test('with a page for each client the war was fought for, on the picture of the meeting', () => {
    expect(Object.keys(EPILOGUES.quorum).sort()).toEqual(['hadron', 'lumen', 'undertow']);
    for (const faction of ['hadron', 'lumen', 'undertow'] as const) {
      const due = dueScenes(held(faction), SCENES, MISSIONS);
      expect(due.map((s) => s.id)).toEqual([`ending-quorum-${faction}`]);
      expect(due[0]).toMatchObject({ ending: true, picture: 'still-meeting', title: EPILOGUES.quorum[faction].title, heading: 'EPILOGUE' });
      expect(due[0].lines).toBe(EPILOGUES.quorum[faction].body);
    }
    expect('still-meeting' in SPRITES).toBe(true);
    // In every one of them the debt the story began with is dealt with, or the check is where it belongs.
    expect(EPILOGUES.quorum.hadron.body.join(' ')).toMatch(/Your debt is on the agenda\./);
    expect(EPILOGUES.quorum.lumen.body.join(' ')).toMatch(/Your debt is on the agenda\./);
    expect(EPILOGUES.quorum.undertow.body.join(' ')).toMatch(/Your check hangs on the board/);
  });

  test('the minutes are found, the world has a new entry, and Dispatch writes; the clerk has nothing more to send', () => {
    const game = held('undertow');
    expect(openEntries(game, FINDS, MISSIONS).opened.map((f) => f.id)).toContain('paper-minutes');
    expect(openEntries(game, WORLD, MISSIONS).opened.map((e) => e.id)).toContain('society');
    expect(letters(game)).toContain('count-closed');
    expect(letters(game)).not.toContain('tidy-desk-again');
    // After a verdict in a first telling the clerk writes once more: fly the war again and let the frame listen.
    expect(letters(did(fresh(0), ...WAR, ...AUDIT, 'verdict-default'))).toContain('tidy-desk-again');
    expect(letters(did(fresh(0), ...WAR, ...AUDIT, 'verdict-enforce'))).toContain('tidy-desk-again');
    // In a later telling the frame has listened all the way, and he does not say it again; Dispatch has no count to close.
    for (const cycle of [1, 2]) {
      const other = did(fresh(cycle), ...WAR, ...AUDIT, 'verdict-default');
      expect(letters(other), `cycle ${cycle}`).not.toContain('tidy-desk-again');
      expect(letters(other)).not.toContain('count-closed');
    }
    // The minutes say what the count said: eight on the board, and the ninth on the frame. And that the box was opened.
    const minutes = FINDS.find((f) => f.id === 'paper-minutes')!.text;
    expect(minutes).toMatch(/eight checks on the board; a ninth, tied to the foot of a frame in the door/);
    expect(minutes).toMatch(/The box was opened and the roll read\./);
    // The world's entry counts the same way: nine counted, not nine on the board.
    expect(WORLD.find((e) => e.id === 'society')!.text).toMatch(/with nine checks counted\./);
    expect(quorum.briefing[0]).toMatch(/^Nine in brass opened the box\. The roll was inside\./);
  });

  test('no letter about the hall comes once a verdict is given, and none that was read is taken back', () => {
    // The box brought home with eight checks: Tamsin writes that it will not open.
    const eight = audited(8);
    expect(letters(eight)).toContain('short-of-nine');
    expect(letters(eight)).not.toContain('third-offer');
    // A ninth is found before a verdict. The letter about eight has been read: it stays, and the offer comes.
    const read = { ...eight, read: ['short-of-nine'] };
    expect(letters({ ...read, codex: checks(9) })).toEqual(expect.arrayContaining(['short-of-nine', 'third-offer']));
    // One that was never opened says nothing true any more, and goes.
    expect(letters({ ...eight, codex: checks(9) })).not.toContain('short-of-nine');
    // A verdict is given with eight. A ninth found afterwards brings no offer: there is nothing left to offer.
    const decided = did(eight, 'verdict-default');
    expect(letters({ ...decided, codex: checks(9) })).not.toContain('third-offer');
    expect(letters(decided)).not.toContain('short-of-nine');
    // The offer was read and another verdict given: the letter is still in the inbox.
    const offered = { ...audited(9), read: ['third-offer'] };
    expect(letters(did(offered, 'verdict-enforce'))).toContain('third-offer');
    // What was read is forgotten when the story starts over, like everything else in the inbox.
    expect(letters({ ...fresh(2), read: [] })).not.toContain('third-offer');
  });

  test('the three contracts nobody posted are not flown once a verdict is given', () => {
    const offered = (game: GameState): string[] => availableMissions(game, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('quest-'));
    const war = decide(did(fresh(1), ...WAR), 'logs', 'keep');
    expect(offered(war)).toEqual(['quest-1']);
    expect(offered(did(war, 'quest-1'))).toEqual(['quest-2']);
    expect(offered(did(war, 'quest-1', 'quest-2', ...AUDIT))).toEqual(['quest-3']);
    for (const verdict of ['verdict-default', 'verdict-enforce']) {
      expect(offered(did(war, ...AUDIT, verdict)), verdict).toEqual([]);
      expect(offered(did(war, 'quest-1', ...AUDIT, verdict)), verdict).toEqual([]);
      expect(offered(did(war, 'quest-1', 'quest-2', ...AUDIT, verdict)), verdict).toEqual([]);
    }
    // So the letter the first of them brings cannot come from a pilot whose frame has gone dark on a roof.
    expect(letters(did(war, ...AUDIT, 'verdict-enforce'))).not.toContain('ashfall-paper');
  });

  test('a pilot of a later telling who sells the logs is told what went with them', () => {
    const sold = decide(did(fresh(1), 'intro-1', 'intro-2', 'lumen-1', 'lumen-2'), 'logs', 'sell');
    expect(letters(sold)).toContain('logs-sold');
    expect(MESSAGES.find((m) => m.id === 'logs-sold')).toMatchObject({ from: 'Dispatch', subject: 'About the logs' });
    expect(MESSAGES.find((m) => m.id === 'logs-sold')!.body.join(' ')).toMatch(/Not this year\.$/);
    // Kept, there is nothing to tell; and in a first telling there was nothing else on the tape to sell.
    expect(letters(decide(did(fresh(1), 'intro-1', 'intro-2', 'lumen-1', 'lumen-2'), 'logs', 'keep'))).not.toContain('logs-sold');
    expect(letters(decide(did(fresh(0), 'intro-1', 'intro-2', 'lumen-1', 'lumen-2'), 'logs', 'sell'))).not.toContain('logs-sold');
  });

  test('medals: one for the meeting, one for nine checks, two for the papers', () => {
    const earned = (game: GameState): string[] => awardMedals(game, MEDALS).earned.map((medal) => medal.id);
    expect(earned(did(fresh(1), 'verdict-quorum'))).toContain('verdict-quorum');
    expect(earned({ ...fresh(), codex: checks(8) })).not.toContain('checks-9');
    expect(earned({ ...fresh(), codex: checks(9) })).toContain('checks-9');
    const papers = (n: number): string[] => FINDS.filter((f) => f.kind === 'paper').slice(0, n).map((f) => f.id);
    expect(papersFound({ ...fresh(), codex: [...papers(11), ...checks(5)] })).toBe(11);
    expect(checksHeld({ ...fresh(), codex: [...papers(11), ...checks(5)] })).toBe(5);
    expect(earned({ ...fresh(), codex: papers(11) })).not.toContain('papers-12');
    expect(earned({ ...fresh(), codex: papers(12) })).toContain('papers-12');
    expect(earned({ ...fresh(), codex: papers(23) })).not.toContain('papers-all');
    expect(earned({ ...fresh(), codex: papers(24) })).toContain('papers-all');
    expect(FINDS.filter((f) => f.kind === 'paper')).toHaveLength(24);
  });
});

describe('the letters at the end of the audit', () => {
  test('with nine checks Tamsin makes the offer; with fewer she says what the box wants; without the box she does not write', () => {
    expect(letters(audited(9)).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual(['third-offer']);
    expect(letters(audited(8)).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual(['short-of-nine']);
    expect(letters(audited(0)).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual(['short-of-nine']);
    const boxless = { ...did(fresh(1), ...WAR, ...AUDIT), codex: checks(12) };
    expect(letters(boxless).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual([]);
    // Dispatch's letter about the two offers still comes to everybody.
    for (const game of [audited(9), audited(8), boxless]) expect(letters(game)).toContain('two-offers');
    // Before the audit is over neither is sent.
    expect(letters({ ...did(fresh(1), ...WAR, ...QUESTS, 'audit-1', 'audit-2'), codex: checks(9) }).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual([]);
  });
});

describe('the third verdict, played', () => {
  const ready = (held: number): GameState => ({
    ...strong({ ...done(...WAR, ...QUESTS, ...AUDIT), cycle: 1 }),
    choices: { logs: 'keep' }, codex: [...WORLD.map((e) => e.id), ...FINDS.filter((f) => f.kind === 'paper').map((f) => f.id), ...checks(held)],
    scenes: SCENES.filter((s) => !s.ending && !s.id.startsWith('left-')).map((s) => s.id), xp: 60000, perks: { plating: 3, marksman: 3, capacitor: 3, heatsinks: 3, reflexes: 3, fieldTech: 2 },
  });

  test('the hub lists three verdicts for a pilot with nine checks and two for one with eight', () => {
    const offered = (held: number): string[] => {
      const { app } = inHub(ready(held));
      select(app, 'contracts');
      return snap(app).menu.items.map((item) => item.id).filter((id) => id.startsWith('verdict-'));
    };
    expect(offered(9)).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
    expect(offered(8)).toEqual(['verdict-enforce', 'verdict-default']);
  });

  test('won, it shows what became of people, then its epilogue, then the end roll; and the story can be started again', () => {
    const { app, store } = inHub({ ...ready(9), settings: { ...ready(9).settings, difficulty: 'story' } });
    select(app, 'contracts');
    select(app, 'verdict-quorum');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'verdict-quorum' } });
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ mission: 'verdict-quorum', index: 0, of: 2, enemies: ['bailiff', 'lien-drone', 'lien-drone'] });
    for (let i = 0; i < 2 && snap(app).screen === 'battle'; i++) {
      autoBattle(app);
      press(app, 'confirm');
    }
    expect(snap(app).settlement).toMatchObject({ won: true });
    expect(savedGame(store).completed).toContain('verdict-quorum');
    press(app, 'confirm');
    // What became of the people the pilot decided about (here: the logs that were kept), then the epilogue.
    const pages: string[] = [];
    for (let i = 0; i < 60 && ['scene', 'ending'].includes(snap(app).screen); i++) {
      if (pages[pages.length - 1] !== String(snap(app).scene)) pages.push(String(snap(app).scene));
      press(app, 'confirm');
    }
    expect(pages).toEqual(['left-1', 'ending-quorum-undertow']);
    expect(snap(app).screen).toBe('credits');
    skipScenes(app);
    expect(snap(app).screen).toBe('hub');
    expect(savedGame(store)).toMatchObject({ endingSeen: true });
    expect(savedGame(store).medals).toEqual(expect.arrayContaining(['verdict-quorum', 'checks-9', 'papers-all']));
    expect(savedGame(store).codex).toEqual(expect.arrayContaining(['paper-minutes', 'society']));
    expect(snap(app).menu.items.map((item) => item.id)).toContain('cycle');
  });
});
