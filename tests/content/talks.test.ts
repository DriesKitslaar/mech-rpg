import { chose, decide, dueScenes, reached, startNewCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { standing, wingmanFor } from '../../src/core/wingman';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { AFTERMATH, TALKS, TALK_PAY } from '../../src/content/talks';
import { WINGMEN } from '../../src/content/wingmen';
import { isValidState } from '../../src/core/game';
import { CATALOG } from '../../src/content/parts';
import { SCENE_CHARS, SCENE_LINES } from '../../src/ui/sceneScreen';
import { ANSWER_CHARS, TALK_SCENE_CHARS, TALK_SCENE_LINES } from '../../src/ui/talkScreen';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, inHub, press, savedGame, skipTalks, snap, strong } from '../helpers/app';

const [kite, marrow, sixty] = WINGMEN;
const all = (answer: 0 | 1): Record<string, string> => Object.fromEntries(TALKS.map((t) => [t.choice!.id, t.choice!.options[answer].id]));

describe('the conversations', () => {
  test('are six, each ends with a question with two answers, and everything said fits its panel', () => {
    expect(TALKS.map((t) => t.choice?.id)).toEqual(['kite', 'logs', 'rival', 'marrow', 'sixty', 'dispatch']);
    for (const talk of TALKS) {
      expect(SCENES).toContain(talk);
      expect(talk.picture! in SPRITES, talk.picture).toBe(true);
      expect(talk.choice!.options).toHaveLength(2);
      for (const line of [...talk.talk!, ...talk.choice!.options.map((o) => o.reply)]) {
        expect(wrap(line.text, TALK_SCENE_CHARS).length, `${talk.id}: ${line.text}`).toBeLessThanOrEqual(TALK_SCENE_LINES);
        if (line.portrait) expect(line.portrait in SPRITES, line.portrait).toBe(true);
        expect(line.who.length).toBeLessThanOrEqual(16);
      }
      for (const option of talk.choice!.options) expect(option.label.length, option.label).toBeLessThanOrEqual(ANSWER_CHARS);
    }
  });

  test('come up when their moment has come and not for a pilot who is already past it', () => {
    const due = (g: GameState) => dueScenes({ ...g, scenes: ['act-1', 'act-2', 'act-3'] }, SCENES, MISSIONS).map((s) => s.id);
    expect(due(fresh())).toEqual([]);
    expect(due(done('intro-1', 'intro-2'))).toEqual(['talk-kite']);
    expect(due(done('intro-1', 'intro-2', 'lumen-1'))).toEqual(['talk-kite', 'talk-logs']);
    expect(due(done('intro-1', 'intro-2', 'lumen-1', 'rival-1'))).toEqual(['talk-rival', 'talk-marrow']);
  });

  test('an answer is remembered, stands, pays what it says, and is forgotten when the story starts over', () => {
    let g = decide(fresh(), 'logs', 'sell', TALK_PAY.logs);
    expect(chose(g, 'logs')).toBe('sell');
    expect(g.credits).toBe(fresh().credits + 1200);
    expect(decide(g, 'logs', 'keep', 500)).toBe(g);
    expect(reached(g, 'chose:logs=sell', MISSIONS)).toBe(true);
    expect(reached(g, 'chose:logs=keep', MISSIONS)).toBe(false);
    expect(isValidState(g, CATALOG)).toBe(true);
    expect(isValidState({ ...g, choices: { logs: 5 } }, CATALOG)).toBe(false);
    expect(isValidState({ ...g, choices: undefined }, CATALOG)).toBe(true);
    g = { ...g, completed: MISSIONS.map((m) => m.id) };
    expect(startNewCycle(g, MISSIONS).choices).toEqual({});
  });
});

describe('bonds', () => {
  const met = { ...done('intro-1', 'intro-2', 'rival-1', 'choice-lumen') };

  test('a friend flies for five points less, and someone the pilot crossed does not take the call', () => {
    const friends = { ...met, choices: all(0) };
    expect([kite, marrow, sixty].map((w) => standing(friends, w))).toEqual(['ally', 'ally', 'ally']);
    expect([kite, marrow, sixty].map((w) => wingmanFor(friends, w, MISSIONS)?.share)).toEqual([0.1, 0.2, 0.3]);
    const crossed = { ...met, choices: all(1) };
    expect([kite, marrow, sixty].map((w) => standing(crossed, w))).toEqual(['neutral', 'enemy', 'enemy']);
    expect([kite, marrow, sixty].map((w) => wingmanFor(crossed, w, MISSIONS)?.share)).toEqual([0.15, undefined, undefined]);
    expect([kite, marrow, sixty].map((w) => wingmanFor(met, w, MISSIONS)?.share)).toEqual([0.15, 0.25, 0.35]);
  });
});

describe('what became of them', () => {
  test('a line for each thing decided, on two pages that fit; nothing for a pilot who decided nothing', () => {
    for (const answers of [all(0), all(1)]) {
      const pages = AFTERMATH.map((page) => page.linesFor!(answers));
      expect(pages.map((p) => p.length)).toEqual([3, 3]);
      for (const lines of pages) {
        const rows = lines.reduce((sum, l) => sum + wrap(l, SCENE_CHARS).length, 0) + (lines.length - 1) * 0.75;
        expect(rows).toBeLessThanOrEqual(SCENE_LINES);
      }
    }
    expect(AFTERMATH.flatMap((page) => page.linesFor!({}))).toEqual([]);
    const judged = { ...done(...MISSIONS.filter((m) => m.faction !== 'hadron' && m.faction !== 'undertow' && m.verdict !== 'default').map((m) => m.id)), scenes: SCENES.filter((s) => !s.ending).map((s) => s.id).filter((id) => !id.startsWith('left-')) };
    expect(dueScenes(judged, SCENES, MISSIONS).map((s) => s.id).filter((id) => id.startsWith('left-'))).toEqual([]);
    expect(dueScenes({ ...judged, choices: { kite: 'vouch' } }, SCENES, MISSIONS).map((s) => s.id).filter((id) => id.startsWith('left-'))).toEqual(['left-1']);
  });
});

describe('a conversation on screen', () => {
  test('each press brings the next thing said, then the question; the answer is kept, paid and replied to', () => {
    const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1', 'talk-kite'] });
    const credits = snap(app).credits;
    app.commit({ ...app.game!, completed: [...app.game!.completed, 'lumen-1'] });
    app.go('hub');
    const talk = () => snap(app).talk as { at: number; of: number; who: string; asking: boolean };
    expect(snap(app)).toMatchObject({ screen: 'scene', scene: 'talk-logs' });
    expect(talk()).toMatchObject({ at: 0, of: 3, who: 'Analyst Varga', asking: false });
    press(app, 'confirm', 'confirm');
    expect(talk()).toMatchObject({ at: 2, who: 'Tamsin' });
    press(app, 'confirm');
    expect(talk().asking).toBe(true);
    expect(snap(app).menu.items.map((i) => i.id)).toEqual(['sell', 'keep']);
    // Nothing but an answer gets past the question.
    press(app, 'cancel');
    expect(talk().asking).toBe(true);
    press(app, 'down', 'confirm');
    expect(talk()).toMatchObject({ asking: false, who: 'Tamsin', at: 3, of: 4 });
    expect(savedGame(store).choices).toEqual({ logs: 'keep' });
    expect(snap(app).credits).toBe(credits);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    expect(savedGame(store).scenes).toContain('talk-logs');
  });

  test('selling pays on the spot', () => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2', 'lumen-1')), scenes: ['act-1', 'talk-kite', 'talk-logs'], choices: {} });
    const credits = snap(app).credits;
    app.commit({ ...app.game!, scenes: ['act-1', 'talk-kite'] });
    app.go('hub');
    press(app, 'confirm', 'confirm', 'confirm', 'confirm');
    expect(snap(app).credits).toBe(credits + TALK_PAY.logs);
    skipTalks(app);
    expect(snap(app).screen).toBe('hub');
  });

  test('a game closed in the middle of a conversation has it again, and one closed after the answer is not asked twice', () => {
    const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'] , choices: { kite: 'pass' } });
    // The answer was given before the game was closed: the conversation came up again and was sat through.
    expect(savedGame(store).choices).toEqual({ kite: 'pass' });
    expect(savedGame(store).scenes).toContain('talk-kite');
    expect(snap(app).screen).toBe('hub');
  });
});
