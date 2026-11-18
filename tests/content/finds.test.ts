import { completeMission, decide, sideMissions, type Mission } from '../../src/core/campaign';
import { checksHeld, isFind, openEntries } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { ARENA } from '../../src/content/arena';
import { PEOPLE, WORLD } from '../../src/content/codex';
import { FINDS } from '../../src/content/finds';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { FIND_CLUE_LINES, FIND_TEXT_LINES, PAGE_CHARS, findLabel } from '../../src/ui/databaseScreen';
import { wrap } from '../../src/ui/widgets';
import { storyQuestions, unknownTerms } from '../helpers/conditions';

const papers = FINDS.filter((find) => find.kind === 'paper');
const checks = FINDS.filter((find) => find.kind === 'check');
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const found = (game: GameState): string[] => openEntries(game, FINDS, MISSIONS).opened.map((find) => find.id);
/** The questions a conversation asks: what a pilot answers without having looked for a second offer. */
const asked = storyQuestions();
const flown = (...ids: string[]): GameState => ids.reduce((game, id) => completeMission(game, id, MISSIONS), fresh());
/** The same game with the best rank there is on these contracts. */
const withS = (game: GameState, ...ids: string[]): GameState => ({ ...game, ranks: { ...game.ranks, ...Object.fromEntries(ids.map((id) => [id, 'S' as const])) } });
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
const LUMENS_WAR = ['choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen'];

/** A whole road through the story in one cycle, with nothing done beside it, and the first answer given to every question. */
function road(faction: 'hadron' | 'lumen' | 'undertow', cycle = 0): GameState {
  const on = (m: Mission): boolean =>
    ['intro', 'faction', 'rival', 'audit'].includes(m.phase) || (['choice', 'path', 'finale'].includes(m.phase) && m.faction === faction) || m.id === 'verdict-default';
  let game: GameState = { ...fresh(), cycle };
  for (const m of MISSIONS.filter(on)) game = completeMission(game, m.id, MISSIONS);
  // The first answer to every question the story asks in every telling; the one about the frame is only asked in a later one.
  for (const [question, answers] of asked) if (question !== 'frame') game = decide(game, question, answers[0]);
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
    for (const find of FINDS) expect(unknownTerms(find.after), find.id).toEqual([]);
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
      expect(FINDS.find((f) => f.id === 'check-dock')!.title).toBe('PENNING 114');
    } finally {
      setLanguage('en');
    }
  });

  test('a clue says where a thing is after its fashion: no name of a person, no title of a contract, no words of the thing itself, no answer to a question', () => {
    const names = [...PEOPLE.map((person) => person.name), ...MISSIONS.map((m) => m.title), 'Meridian', 'Hadron', 'Lumen', 'Undertow', 'Society', 'Secretary']
      .filter((name) => name.length > 3);
    const words = (text: string): string[] => text.toLowerCase().match(/[a-z']+/g) ?? [];
    /** Every run of this many words in a text. */
    const runs = (text: string, n: number): string[] => {
      const all = words(text);
      return all.slice(0, Math.max(0, all.length - n + 1)).map((_, i) => all.slice(i, i + n).join(' '));
    };
    const holds = (text: string, run: string): boolean => ` ${words(text).join(' ')} `.includes(` ${run} `);
    const telling = (run: string): boolean => run.split(' ').filter((word) => word.length > 3).length >= 2;
    // What a pilot can answer to a question of the story, and what is said back to it.
    const answers = SCENES.flatMap((scene) => (scene.choice ? scene.choice.options.flatMap((option) => [option.label, option.reply.text]) : []));
    // Seven questions, two answers to each, and what is said back to each answer.
    expect(answers.length).toBe(28);
    for (const find of FINDS) {
      for (const name of names) expect(find.clue.toLowerCase().includes(name.toLowerCase()), `${find.id}: ${name}`).toBe(false);
      // Four words running out of the thing itself are a quotation, not a clue.
      for (const run of runs(find.clue, 4)) expect(holds(find.text, run), `${find.id} quotes itself: ${run}`).toBe(false);
      // And three out of an answer, or out of what is said back to one, are the answer. ("It to the" is nobody's answer:
      // a run counts when two of its words say something.)
      for (const run of runs(find.clue, 3).filter(telling)) expect(answers.filter((answer) => holds(answer, run)), `${find.id}: ${run}`).toEqual([]);
      expect(find.clue.length).toBeGreaterThan(10);
    }
    // (The check can tell: this is what one clue used to say, and what a dead woman says.)
    expect(runs('A dead woman pays her debts in ordnance, and in one other thing.', 3).filter(telling).filter((run) => answers.some((answer) => holds(answer, run))))
      .toEqual(['debts in ordnance']);
  });

  test('a clue for what the story hands out by itself says nothing of what is to come', () => {
    const clue = (id: string): string => FINDS.find((f) => f.id === id)!.clue;
    // The third act is not on the first page of the database: no seals, no roof, no war that ends, no collecting.
    for (const id of ['paper-policy', 'paper-letterhead', 'paper-receipts', 'paper-schedule']) {
      expect(clue(id), id).not.toMatch(/seal|roof|war|collect|notice|priced|defend/i);
    }
    // And none tells the pilot what to do to somebody.
    expect(clue('paper-licence')).toBe('In a drawer that has been shut for eleven years. It opens for a voice it knows.');
    // What only a later telling can find says so, after its fashion.
    expect(clue('paper-stop')).toMatch(/First the channel has to speak\.$/);
    expect(clue('paper-playback-1')).toMatch(/the second time/);
    expect(clue('paper-adjourned')).toMatch(/been there twice/);
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
    // (Not the contracts nobody posted, nor the verdict that waits for the last of them: those are a later telling's.)
    const offered = MISSIONS.filter((mission) => mission.phase !== 'patrol' && !/cycle:|quest-/.test(mission.when ?? ''));
    for (const m of offered) all = completeMission(all, m.id, MISSIONS);
    all = { ...all, ranks: Object.fromEntries(all.completed.map((id) => [id, 'S' as const])) };
    for (const [question, answers] of asked) if (question !== 'frame') all = decide(all, question, answers[0]);
    const missing = FINDS.map((f) => f.id).filter((id) => !found(all).includes(id));
    expect(missing.sort()).toEqual(['check-letter', 'paper-adjourned', 'paper-licence', 'paper-minutes', 'paper-playback-1', 'paper-playback-2', 'paper-stop']);
    // The one check that is missing goes with the other answer to an old pilot's question.
    const other = found({ ...all, choices: { ...all.choices, sixty: 'file' } });
    expect(other).toContain('check-letter');
  });

  test('the second telling hears the recorder in the water of the dock', () => {
    expect(found(road('lumen', 0))).not.toContain('paper-playback-1');
    expect(found(road('lumen', 1))).toContain('paper-playback-1');
    // And is shown what the first only showed to the Undertow's own pilot.
    expect(found(road('lumen', 0))).not.toContain('paper-book');
    expect(found(road('lumen', 1))).toContain('paper-book');
    // The two papers of Seam Nine are not handed over for flying the contract again: they come, as in a first
    // telling, when the war is over and to an S, or at once by taking the other side's offer.
    expect(found(road('lumen', 1)).filter((id) => ['paper-order', 'paper-ticket'].includes(id))).toEqual([]);
    expect(found(decide(decide(road('lumen', 1), 'seam', 'stand'), 'train', 'weigh'))).toEqual(expect.arrayContaining(['paper-order', 'paper-ticket']));
  });

  test('what answers a hint of the first act comes when the war is over, to a pilot who flew that contract as well as it can be flown', () => {
    const war = (base: GameState): GameState => LUMENS_WAR.reduce((game, id) => completeMission(game, id, MISSIONS), base);
    const actOne = withS(flown(...ACT_ONE), 'hadron-1', 'hadron-2');
    expect(found(actOne).filter((id) => ['paper-ticket', 'paper-order'].includes(id))).toEqual([]);
    expect(found(war(actOne))).toEqual(expect.arrayContaining(['paper-ticket', 'paper-order']));
    // One for each S: without it the end of the war brings neither.
    const one = found(war(withS(flown(...ACT_ONE), 'hadron-2')));
    expect(one).toContain('paper-ticket');
    expect(one).not.toContain('paper-order');
    expect(found(war(flown(...ACT_ONE))).filter((id) => ['paper-ticket', 'paper-order'].includes(id))).toEqual([]);
    // A later telling knows where to look, and can act on it: standing with those the tank was given to finds
    // what is under its seat, with the war still on. Flying the contract as it was first offered does not.
    const later: GameState = { ...flown('intro-1', 'intro-2', 'hadron-1'), cycle: 1 };
    expect(found(later)).not.toContain('paper-order');
    expect(found(decide(later, 'seam', 'stand'))).toContain('paper-order');
    expect(found(decide(later, 'seam', 'stand'))).not.toContain('paper-ticket');
    expect(found(decide(later, 'train', 'weigh'))).toContain('paper-ticket');
    // The ticket says the train weighed nothing and that it passed. It does not say for whom.
    const ticket = FINDS.find((f) => f.id === 'paper-ticket')!;
    expect(ticket.text).toMatch(/Weighed: empty\. Passed\. Consignee: by standing order\./);
    expect(ticket.text).not.toMatch(/Meridian/);
  });

  test('nothing found while the war is on names the insurer: a first telling learns that name from the notice', () => {
    const named = FINDS.filter((f) => /Meridian(?! PIT)/.test(`${f.title} ${f.source} ${f.clue} ${f.text}`)).map((f) => f.id);
    expect(named.sort()).toEqual(['check-notary', 'paper-letterhead', 'paper-receipts']);
    // The most a first telling can have done before its war ends: by each road, with either answer to every question.
    for (const faction of ['hadron', 'lumen', 'undertow'] as const) {
      for (const pick of [0, 1]) {
        let game: GameState = { ...fresh(), arenaRank: ARENA.length, gauntletBest: 99 };
        const before = MISSIONS.filter((m) => ['intro', 'faction', 'rival'].includes(m.phase) || (['choice', 'path'].includes(m.phase) && m.faction === faction));
        for (const m of before) game = completeMission(game, m.id, MISSIONS);
        for (const [question, answers] of asked) if (question !== 'frame') game = decide(game, question, answers[pick]);
        // With every contract beside the story that is on offer by then, one after the other.
        for (let side = sideMissions(game, MISSIONS); side.length > 0; side = sideMissions(game, MISSIONS)) game = completeMission(game, side[0].id, MISSIONS);
        game = withS(game, ...game.completed);
        const ids = found(game);
        expect(ids.filter((id) => named.includes(id)), `${faction} ${pick}`).toEqual([]);
        expect(ids.length, `${faction} ${pick}`).toBeGreaterThan(10);
      }
    }
  });

  test('the note that speaks of the dock is not found before the dock', () => {
    for (const answer of ['keep', 'sell']) {
      const asked = decide(flown('intro-1', 'intro-2', 'lumen-1', 'lumen-2'), 'logs', answer);
      expect(found(asked), answer).not.toContain('paper-model');
      expect(found(completeMission(completeMission(asked, 'undertow-1', MISSIONS), 'undertow-2', MISSIONS)), answer).toContain('paper-model');
    }
    expect(FINDS.find((f) => f.id === 'paper-model')!.text).toMatch(/Since the dock: six\./);
  });

  test('the letter that answers the board\'s comes once the war is over, not the moment the file is sent', () => {
    const sent = (game: GameState): GameState => ({ ...game, choices: { ...game.choices, sixty: 'file' } });
    const war = completeMission(completeMission(fresh(), 'choice-lumen', MISSIONS), 'lumen-3', MISSIONS);
    expect(found(sent(war))).not.toContain('check-letter');
    expect(found(sent(completeMission(war, 'finale-lumen', MISSIONS)))).toContain('check-letter');
    // And never to a pilot who burned the file instead.
    expect(found(decide(completeMission(war, 'finale-lumen', MISSIONS), 'sixty', 'keep'))).not.toContain('check-letter');
  });

  test('a game kept before there was anything to find, now in a later telling, is given what its record has earned', () => {
    // A whole road for the Undertow in the first telling, each contract with a rank to show for it; the second has just begun.
    const first = road('undertow');
    const old: GameState = { ...fresh(), cycle: 1, ranks: Object.fromEntries(first.completed.map((id) => [id, 'B' as const])) };
    const ids = found(old);
    expect(ids).toEqual(expect.arrayContaining([
      'paper-rules', 'paper-policy', 'paper-rhyme', 'paper-survey', 'paper-minute', 'paper-letterhead', 'paper-book', 'paper-receipts', 'paper-schedule',
      'check-dock', 'check-krell',
    ]));
    // What a first telling of that road finds, less what its answers found: those were not kept.
    const then = found(first);
    expect(ids.filter((id) => !then.includes(id))).toEqual([]);
    expect(then.filter((id) => !ids.includes(id)).sort()).toEqual(['paper-booking', 'paper-escort', 'paper-model']);
    // Not what only a later telling hears, though this is one: nobody had heard it then.
    expect(ids).not.toContain('paper-playback-1');
    // An S that was earned then counts, now that the war it was earned in is over.
    expect(found(withS(old, 'hadron-1', 'hadron-2'))).toEqual(expect.arrayContaining(['paper-ticket', 'paper-order']));
    expect(ids).not.toContain('paper-ticket');
    // Given once. With a find to its name the game is judged by what it does, like any other.
    const { game } = openEntries(old, FINDS, MISSIONS);
    expect(openEntries(game, FINDS, MISSIONS).opened).toEqual([]);
    expect(found({ ...old, codex: ['check-magpie'] })).toEqual([]);
    // What the world's pages wait for is not judged by the record: they tell the story as it is told now.
    expect(openEntries(old, WORLD, MISSIONS).opened.map((entry) => entry.id))
      .toEqual(openEntries({ ...old, ranks: {} }, WORLD, MISSIONS).opened.map((entry) => entry.id));
  });

  test('in a first telling the record adds nothing: a rank is only had for what was flown', () => {
    for (const faction of ['hadron', 'lumen', 'undertow'] as const) {
      const game = road(faction);
      expect(found({ ...game, ranks: Object.fromEntries(game.completed.map((id) => [id, 'A' as const])) })).toEqual(found(game));
    }
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
