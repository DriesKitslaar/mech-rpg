import { completeMission, decide, type Mission } from '../../src/core/campaign';
import { checksHeld, isFind, openEntries } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { ARENA } from '../../src/content/arena';
import { PEOPLE, WORLD } from '../../src/content/codex';
import { FINDS } from '../../src/content/finds';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { FIND_CLUE_LINES, FIND_TEXT_LINES, PAGE_CHARS, findLabel } from '../../src/ui/databaseScreen';
import { wrap } from '../../src/ui/widgets';
import { questions, unknownTerms } from '../helpers/conditions';

const papers = FINDS.filter((find) => find.kind === 'paper');
const checks = FINDS.filter((find) => find.kind === 'check');
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const found = (game: GameState): string[] => openEntries(game, FINDS, MISSIONS).opened.map((find) => find.id);
const asked = questions();
/** What finds wait for that later parts of the round bring: three contracts without a client, a third verdict, a question about the frame. */
const LATER = ['quest-1', 'quest-2', 'quest-3', 'verdict-quorum', 'chose:frame=ask', 'chose:frame=quiet'];

/** A whole road through the story in one cycle, with nothing done beside it, and the first answer given to every question. */
function road(faction: 'hadron' | 'lumen' | 'undertow', cycle = 0): GameState {
  const on = (m: Mission): boolean =>
    ['intro', 'faction', 'rival', 'audit'].includes(m.phase) || (['choice', 'path', 'finale'].includes(m.phase) && m.faction === faction) || m.id === 'verdict-default';
  let game: GameState = { ...fresh(), cycle };
  for (const m of MISSIONS.filter(on)) game = completeMission(game, m.id, MISSIONS);
  for (const [question, answers] of asked) game = decide(game, question, answers[0]);
  return game;
}

describe('what there is to find', () => {
  test('twenty-four papers, numbered without a gap in the order they are listed, and sixteen checks', () => {
    expect(papers.map((p) => p.no)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(checks.length).toBe(16);
    expect(FINDS.indexOf(checks[0])).toBe(24);
    for (const paper of papers) expect(paper.id).toMatch(/^paper-[a-z0-9-]+$/);
    for (const check of checks) {
      expect(check.id).toMatch(/^check-[a-z]+$/);
      expect(check.title).toBe(`CHECK ${check.no}`);
      // The number stamped on it is in what is said about it.
      expect(check.text).toContain(`${check.no}`);
    }
    expect(new Set(FINDS.map((f) => f.id)).size).toBe(40);
    expect(new Set(checks.map((c) => c.no)).size).toBe(16);
    // None of them is one of the world's entries under another name.
    expect(FINDS.filter((f) => WORLD.some((entry) => entry.id === f.id))).toEqual([]);
    expect(FINDS.every(isFind)).toBe(true);
    expect(WORLD.some(isFind)).toBe(false);
  });

  test('each waits for something that exists', () => {
    for (const find of FINDS) expect(unknownTerms(find.after).filter((term) => !LATER.includes(term)), find.id).toEqual([]);
    // And the helper that says so can tell: a contract nobody wrote, an answer nobody can give.
    expect(unknownTerms('undertow-1|no-such-contract&chose:kite=maybe&!arena:99&cycle:1')).toEqual(['no-such-contract', 'chose:kite=maybe', 'arena:99']);
  });

  test('each fits its page and its row of the list, in English and in Dutch', () => {
    const fits = () => {
      for (const find of FINDS) {
        expect(find.title.length, find.title).toBeLessThanOrEqual(14);
        expect(findLabel(find, true).length, findLabel(find, true)).toBeLessThanOrEqual(17);
        expect(findLabel(find, false).length, findLabel(find, false)).toBeLessThanOrEqual(17);
        expect(find.source.length, find.source).toBeLessThanOrEqual(PAGE_CHARS);
        expect(wrap(find.clue, PAGE_CHARS).length, find.clue).toBeLessThanOrEqual(FIND_CLUE_LINES);
        expect(wrap(find.text, PAGE_CHARS).length, find.text).toBeLessThanOrEqual(FIND_TEXT_LINES);
      }
    };
    fits();
    setLanguage('nl');
    try {
      fits();
      expect(FINDS.find((f) => f.id === 'paper-rhyme')!.title).toBe('AFTELRIJM');
      expect(FINDS.find((f) => f.id === 'check-dock')!.title).toBe('PENNING 117');
    } finally {
      setLanguage('en');
    }
  });

  test('a clue says where a thing is after its fashion: no name of a person, no title of a contract, nothing of what the thing says', () => {
    const names = [...PEOPLE.map((person) => person.name), ...MISSIONS.map((m) => m.title), 'Meridian', 'Hadron', 'Lumen', 'Undertow', 'Society', 'Secretary']
      .filter((name) => name.length > 3);
    for (const find of FINDS) {
      for (const name of names) expect(find.clue.toLowerCase().includes(name.toLowerCase()), `${find.id}: ${name}`).toBe(false);
      expect(find.clue).not.toBe(find.text);
      expect(find.clue.length).toBeGreaterThan(10);
    }
  });
});

describe('what a pilot finds', () => {
  test('a new game has found nothing', () => {
    expect(found(fresh())).toEqual([]);
  });

  test('the first telling, by any client\'s road and with nothing done beside it, finds about half the papers and far fewer than nine checks', () => {
    for (const faction of ['hadron', 'lumen', 'undertow'] as const) {
      const ids = found(road(faction));
      const [paper, check] = [ids.filter((id) => id.startsWith('paper-')), ids.filter((id) => id.startsWith('check-'))];
      expect(paper.length, faction).toBeGreaterThanOrEqual(10);
      expect(paper.length, faction).toBeLessThanOrEqual(14);
      // The one from the dock, and the one their own road has.
      expect(check.length, faction).toBe(2);
      expect(check).toContain('check-dock');
      // What every first telling shows: what the insurer is, and what makes a meeting.
      expect(paper).toEqual(expect.arrayContaining(['paper-rules', 'paper-policy', 'paper-rhyme', 'paper-survey', 'paper-letterhead', 'paper-schedule']));
    }
  });

  test('some papers are for a later telling only, whatever the first one does', () => {
    // Everything there is to do, done, in the first cycle: every contract, an S on each, the arena won, the Gauntlet to its depths.
    let all: GameState = { ...fresh(), arenaRank: ARENA.length, gauntletBest: 99 };
    for (const m of MISSIONS.filter((mission) => mission.phase !== 'patrol')) all = completeMission(all, m.id, MISSIONS);
    all = { ...all, ranks: Object.fromEntries(all.completed.map((id) => [id, 'S' as const])) };
    for (const [question, answers] of asked) all = decide(all, question, answers[0]);
    const missing = FINDS.map((f) => f.id).filter((id) => !found(all).includes(id));
    expect(missing.sort()).toEqual(['check-letter', 'paper-adjourned', 'paper-licence', 'paper-minutes', 'paper-playback-1', 'paper-playback-2', 'paper-stop']);
    // The one check that is missing goes with the other answer to an old pilot's question.
    const other = found({ ...all, choices: { ...all.choices, sixty: 'file' } });
    expect(other).toContain('check-letter');
  });

  test('the second telling hears the recorder in the water of the dock', () => {
    expect(found(road('lumen', 0))).not.toContain('paper-playback-1');
    expect(found(road('lumen', 1))).toContain('paper-playback-1');
    // And is handed what the first had to earn.
    expect(found(road('lumen', 0))).not.toContain('paper-order');
    expect(found(road('lumen', 1))).toEqual(expect.arrayContaining(['paper-order', 'paper-ticket', 'paper-book']));
  });

  test('checks found are checks held, and are kept when the story starts over', () => {
    const { game } = openEntries(road('undertow'), FINDS, MISSIONS);
    expect(checksHeld(game)).toBe(2);
    expect(game.codex).toEqual(expect.arrayContaining(['check-dock', 'check-krell']));
    const again: GameState = { ...game, completed: [], choices: {}, scenes: [], read: [], endingSeen: false, cycle: game.cycle + 1 };
    expect(checksHeld(again)).toBe(2);
    expect(openEntries(again, FINDS, MISSIONS).opened).toEqual([]);
  });
});
