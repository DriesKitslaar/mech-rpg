import {
  ARCHIVE_PAY, archiveMissions, arrivedMessages, availableMissions, campaignComplete, chosenFaction, chosenVerdict, completeMission,
  dueScenes, markSceneSeen, startNewCycle, stockFor,
  type Faction, type Message, type Mission, type Scene,
} from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { CATALOG, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';

const m = (id: string, phase: Mission['phase'], extra: Partial<Mission> = {}): Mission => ({
  id, phase, title: id, client: 'c', briefing: ['b'], debrief: 'd', reward: 1000,
  battles: [{ enemies: ['recon-drone'], background: 'bg' }], ...extra,
});
const FACTIONS: Faction[] = ['hadron', 'lumen', 'undertow'];
/** The shape of the full story: two introductions, two contracts a client, the rival, the choice, three on the path, the finale, three audits, two verdicts. */
const STORY: Mission[] = [
  m('patrol', 'patrol'), m('intro-1', 'intro'), m('intro-2', 'intro'),
  ...FACTIONS.flatMap((faction) => [m(`${faction}-1`, 'faction', { faction }), m(`${faction}-2`, 'faction', { faction, after: `${faction}-1` })]),
  m('rival-1', 'rival'),
  ...FACTIONS.map((faction) => m(`choice-${faction}`, 'choice', { faction })),
  ...FACTIONS.flatMap((faction) => [3, 4, 5].map((n) => m(`${faction}-${n}`, 'path', { faction }))),
  ...FACTIONS.map((faction) => m(`finale-${faction}`, 'finale', { faction })),
  m('audit-1', 'audit'), m('audit-2', 'audit'), m('audit-3', 'audit'),
  m('verdict-enforce', 'verdict', { verdict: 'enforce' }), m('verdict-default', 'verdict', { verdict: 'default' }),
];
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
const ACT_TWO = ['choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen'];
const ACT_THREE = ['audit-1', 'audit-2', 'audit-3'];
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const after = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, STORY), fresh());
const offered = (g: GameState) => availableMissions(g, STORY).map((x) => x.id);

describe('the story in three acts', () => {
  test('a client\'s second contract waits for its first', () => {
    expect(offered(after('intro-1', 'intro-2'))).toEqual(['patrol', 'hadron-1', 'lumen-1', 'undertow-1']);
    expect(offered(after('intro-1', 'intro-2', 'lumen-1'))).toEqual(['patrol', 'hadron-1', 'lumen-2', 'undertow-1']);
    expect(offered(after('intro-1', 'intro-2', 'lumen-1', 'lumen-2'))).toEqual(['patrol', 'hadron-1', 'undertow-1']);
  });

  test('the rival turns up when all six are done, and only then the clients ask for a side', () => {
    const six = ACT_ONE.slice(0, 8);
    expect(offered(after(...six.slice(0, 7)))).toEqual(['patrol', 'undertow-2']);
    expect(offered(after(...six))).toEqual(['patrol', 'rival-1']);
    expect(offered(after(...ACT_ONE))).toEqual(['patrol', 'choice-hadron', 'choice-lumen', 'choice-undertow']);
  });

  test('the chosen client\'s contracts come one at a time, and then its finale', () => {
    expect(offered(after(...ACT_ONE, 'choice-lumen'))).toEqual(['patrol', 'lumen-3']);
    expect(offered(after(...ACT_ONE, 'choice-lumen', 'lumen-3'))).toEqual(['patrol', 'lumen-4']);
    expect(offered(after(...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5'))).toEqual(['patrol', 'finale-lumen']);
  });

  test('after the finale the audit comes one contract at a time', () => {
    expect(offered(after(...ACT_ONE, ...ACT_TWO))).toEqual(['patrol', 'audit-1']);
    expect(offered(after(...ACT_ONE, ...ACT_TWO, 'audit-1', 'audit-2'))).toEqual(['patrol', 'audit-3']);
  });

  test('the audit ends in two verdicts, of which one is taken, and then the story is over', () => {
    const g = after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE);
    expect(offered(g)).toEqual(['patrol', 'verdict-enforce', 'verdict-default']);
    expect(chosenVerdict(g, STORY)).toBeNull();
    expect(campaignComplete(g, STORY)).toBe(false);
    const done = completeMission(g, 'verdict-default', STORY);
    expect(offered(done)).toEqual(['patrol']);
    expect(chosenVerdict(done, STORY)).toBe('default');
    expect(campaignComplete(done, STORY)).toBe(true);
  });

  test('a story with verdicts is not complete at its finale', () => {
    expect(campaignComplete(after(...ACT_ONE, ...ACT_TWO), STORY)).toBe(false);
  });

  test('the whole of it is eighteen contracts for one pilot', () => {
    let g = fresh();
    let played = 0;
    for (let guard = 0; guard < 40 && !campaignComplete(g, STORY); guard++) {
      const next = availableMissions(g, STORY).find((x) => x.phase !== 'patrol');
      expect(next).toBeDefined();
      g = completeMission(g, next!.id, STORY);
      played += 1;
    }
    expect(played).toBe(18);
    expect(chosenFaction(g, STORY)).toBe('hadron');
  });
});

describe('pilots who were further along before the story grew', () => {
  const OLD_ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1'];

  test('one who had worked for all three clients once is offered their second contracts', () => {
    expect(offered(after(...OLD_ACT_ONE))).toEqual(['patrol', 'hadron-2', 'lumen-2', 'undertow-2']);
  });

  test('one who had taken a side goes on with that client, not back to the others', () => {
    expect(offered(after(...OLD_ACT_ONE, 'choice-undertow'))).toEqual(['patrol', 'undertow-3']);
  });

  test('one who had won the war goes straight into the audit', () => {
    const g = after(...OLD_ACT_ONE, 'choice-undertow', 'finale-undertow');
    expect(offered(g)).toEqual(['patrol', 'audit-1']);
    expect(campaignComplete(g, STORY)).toBe(false);
  });
});

describe('the archive', () => {
  test('lists the story contracts done, in the order they were done, for a share of the pay', () => {
    const g = after('intro-1', 'intro-2', 'lumen-1', 'patrol');
    const archive = archiveMissions(g, STORY);
    expect(archive.map((x) => x.id)).toEqual(['intro-1', 'intro-2', 'lumen-1']);
    expect(ARCHIVE_PAY).toBe(0.3);
    expect(archive[0]).toMatchObject({ reward: 300, replay: true, phase: 'intro' });
  });

  test('is empty for a new pilot, and forgets ids the story no longer has', () => {
    expect(archiveMissions(fresh(), STORY)).toEqual([]);
    expect(archiveMissions({ ...fresh(), completed: ['gone', 'intro-1'] }, STORY).map((x) => x.id)).toEqual(['intro-1']);
  });

  test('playing one again changes nothing in the story', () => {
    const g = after(...ACT_ONE, 'choice-lumen');
    expect(completeMission(g, 'choice-lumen', STORY)).toBe(g);
    expect(completeMission(g, 'intro-1', STORY)).toBe(g);
  });
});

describe('scenes', () => {
  const s = (id: string, extra: Partial<Scene>): Scene => ({ id, title: id, lines: ['x'], after: 'start', ...extra });
  const SCENES: Scene[] = [
    s('act-1', { after: 'start', before: 'intro-1' }),
    s('act-2', { after: 'rival-1', before: 'finale' }),
    s('war-won-lumen', { after: 'finale', before: 'verdict', faction: 'lumen' }),
    s('war-won-hadron', { after: 'finale', before: 'verdict', faction: 'hadron' }),
    s('act-3', { after: 'finale', before: 'verdict' }),
    s('end-lumen-default', { after: 'verdict-default', faction: 'lumen', ending: true }),
    s('end-lumen-enforce', { after: 'verdict-enforce', faction: 'lumen', ending: true }),
    s('end-hadron-default', { after: 'verdict-default', faction: 'hadron', ending: true }),
  ];
  const due = (g: GameState) => dueScenes(g, SCENES, STORY).map((x) => x.id);

  test('a new pilot is shown the opening, once', () => {
    expect(due(fresh())).toEqual(['act-1']);
    const seen = markSceneSeen(fresh(), SCENES[0]);
    expect(seen.scenes).toEqual(['act-1']);
    expect(due(seen)).toEqual([]);
    expect(markSceneSeen(seen, SCENES[0])).toBe(seen);
  });

  test('a scene is not shown to a pilot who is already past it', () => {
    expect(due(after('intro-1'))).toEqual([]);
    expect(due(after(...ACT_ONE))).toEqual(['act-2']);
    expect(due(after(...ACT_ONE, ...ACT_TWO))).toEqual(['war-won-lumen', 'act-3']);
    expect(due(after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE, 'verdict-default'))).toEqual(['end-lumen-default']);
  });

  test('scenes for one client are not shown to a pilot who chose another', () => {
    expect(due(after(...ACT_ONE, 'choice-hadron', 'finale-hadron'))).toEqual(['war-won-hadron', 'act-3']);
  });

  test('seeing an ending is what marks the ending as seen', () => {
    const g = after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE, 'verdict-enforce');
    expect(markSceneSeen(g, SCENES[2]).endingSeen).toBe(false);
    expect(markSceneSeen(g, SCENES[6])).toMatchObject({ endingSeen: true, scenes: ['end-lumen-enforce'] });
  });

  test('a new cycle plays the scenes again and keeps the ranks', () => {
    const done: GameState = {
      ...after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE, 'verdict-enforce'), endingSeen: true, scenes: ['act-1', 'act-2'], ranks: { 'intro-1': 'S' },
    };
    const next = startNewCycle(done, STORY);
    expect(next).toMatchObject({ scenes: [], ranks: { 'intro-1': 'S' }, completed: [], cycle: 1 });
    expect(due(next)).toEqual(['act-1']);
  });
});

describe('what waits for the story', () => {
  test('messages and stock can wait for any finale and any verdict, and messages for a client', () => {
    const MESSAGES: Message[] = [
      { id: 'a', from: 'x', subject: 's', body: ['b'], after: 'finale' },
      { id: 'b', from: 'x', subject: 's', body: ['b'], after: 'verdict' },
      { id: 'c', from: 'x', subject: 's', body: ['b'], after: 'finale', faction: 'hadron' },
      { id: 'd', from: 'x', subject: 's', body: ['b'], after: 'finale', faction: 'lumen' },
    ];
    const ids = (g: GameState) => arrivedMessages(g, MESSAGES, STORY).map((x) => x.id);
    expect(ids(after(...ACT_ONE))).toEqual([]);
    expect(ids(after(...ACT_ONE, ...ACT_TWO))).toEqual(['a', 'd']);
    expect(ids(after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE, 'verdict-default'))).toEqual(['a', 'b', 'd']);
    const stock = (g: GameState) => stockFor(g, SHOP_PARTS, { 'gen-prism': 'verdict' }, STORY).map((p) => p.id);
    expect(stock(after(...ACT_ONE, ...ACT_TWO))).not.toContain('gen-prism');
    expect(stock(after(...ACT_ONE, ...ACT_TWO, ...ACT_THREE, 'verdict-default'))).toContain('gen-prism');
  });

  test('a later cycle keeps what the third act unlocked in stock only for a pilot who has been through it', () => {
    const unlocks = { 'gen-prism': 'verdict', 'wpn-thermal-lance': 'audit-2', 'wpn-void-rifle': 'lumen-3' };
    const stock = (g: GameState) => stockFor(g, SHOP_PARTS, unlocks, STORY).map((p) => p.id);
    // A game from before there was a third act, already in its second cycle: it never met Meridian.
    const old: GameState = { ...fresh(), cycle: 1 };
    expect(stock(old)).toContain('wpn-void-rifle');
    expect(stock(old)).not.toContain('gen-prism');
    expect(stock(old)).not.toContain('wpn-thermal-lance');
    // Getting there in this cycle opens them as it would in the first.
    expect(stock({ ...after(...ACT_ONE, ...ACT_TWO, 'audit-1', 'audit-2'), cycle: 1 })).toContain('wpn-thermal-lance');
    // A pilot who gave a verdict in an earlier cycle holds a rank on it: for them the shop forgets nothing.
    const veteran: GameState = { ...fresh(), cycle: 1, ranks: { 'verdict-default': 'C' } };
    expect(stock(veteran)).toEqual(expect.arrayContaining(['gen-prism', 'wpn-thermal-lance', 'wpn-void-rifle']));
  });
});
