import { chose, decide, dueScenes, reached, settleOldStory, startNewCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { standing, wingmanFor } from '../../src/core/wingman';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { AFTERMATH, REMEMBERED, TALKS, TALK_PAY } from '../../src/content/talks';
import { WINGMEN } from '../../src/content/wingmen';
import { isValidState } from '../../src/core/game';
import { CATALOG } from '../../src/content/parts';
import { SCENE_CHARS, SCENE_LINES } from '../../src/ui/sceneScreen';
import { ANSWER_CHARS, QUESTION_HOLD_MS, TALK_SCENE_CHARS, TALK_SCENE_LINES } from '../../src/ui/talkScreen';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, inHub, makeApp, press, savedGame, select, skipTalks, snap, strong } from '../helpers/app';
import { record, signIn } from '../helpers/canvas';

const [kite, marrow, sixty] = WINGMEN;
const all = (answer: 0 | 1): Record<string, string> => Object.fromEntries(TALKS.map((t) => [t.choice!.id, t.choice!.options[answer].id]));

describe('the conversations', () => {
  test('are seven, the last of them only in a later telling; each ends with a question with two answers, and everything said fits its panel', () => {
    expect(TALKS.map((t) => t.choice?.id)).toEqual(['kite', 'logs', 'rival', 'marrow', 'sixty', 'dispatch', 'frame']);
    expect(TALKS.filter((t) => t.after.includes('quest-')).map((t) => t.id)).toEqual(['talk-playback']);
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
    expect(due(done('intro-1', 'intro-2', 'lumen-1'))).toEqual(['talk-kite']);
    expect(due(done('intro-1', 'intro-2', 'lumen-1', 'lumen-2'))).toEqual(['talk-kite', 'talk-logs']);
    expect(due(done('intro-1', 'intro-2', 'lumen-1', 'lumen-2', 'rival-1'))).toEqual(['talk-rival', 'talk-marrow']);
  });

  test('an answer is remembered, stands, pays what it says, and is forgotten when the story starts over', () => {
    let g = decide(fresh(), 'logs', 'sell', TALK_PAY.logs);
    expect(chose(g, 'logs')).toBe('sell');
    expect(g.credits).toBe(fresh().credits + 1200);
    expect(decide(g, 'logs', 'keep', 500)).toBe(g);
    expect(reached(g, 'chose:logs=sell', MISSIONS)).toBe(true);
    expect(reached(g, 'chose:logs=keep', MISSIONS)).toBe(false);
    // A condition that names no answer is never met, asked or not.
    expect(reached(g, 'chose:logs', MISSIONS)).toBe(false);
    expect(reached(fresh(), 'chose:kite', MISSIONS)).toBe(false);
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
  test('a line for each thing decided, on pages that fit; nothing for a pilot who decided nothing', () => {
    // The third page is for what a pilot of a later telling did with the other side's offers.
    const turned = { seam: 'stand', train: 'weigh', lights: 'dark' };
    expect(AFTERMATH.map((page) => page.id)).toEqual(['left-1', 'left-2', 'left-3']);
    expect(AFTERMATH[2].linesFor!(all(0))).toEqual([]);
    expect(AFTERMATH[2].linesFor!(turned)).toHaveLength(3);
    expect(AFTERMATH[2].linesFor!({ train: 'weigh' })).toEqual([REMEMBERED.train.weigh]);
    for (const answers of [{ ...all(0), ...turned }, { ...all(1), ...turned }]) {
      const pages = AFTERMATH.map((page) => page.linesFor!(answers));
      expect(pages.map((p) => p.length)).toEqual([3, 4, 3]);
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
    app.commit({ ...app.game!, completed: [...app.game!.completed, 'lumen-1', 'lumen-2'] });
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
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2', 'lumen-1', 'lumen-2')), scenes: ['act-1', 'talk-kite', 'talk-logs'], choices: {} });
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

describe('what a conversation guards against', () => {
  function texts(app: ReturnType<typeof inHub>['app']): string[] {
    const said: string[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    app.draw(ctx);
    return said;
  }

  test('a button mashed through the talk does not answer the question: it is on screen a good while first', () => {
    const { app, store } = makeApp({ ...strong(done('intro-1', 'intro-2', 'lumen-1', 'lumen-2')), scenes: ['act-1', 'talk-kite'] }, 5, { fast: false });
    const talk = () => snap(app).talk as { asking: boolean } | undefined;
    // From the title into the game: the conversation is the first thing that comes up.
    for (let t = 0; t < 5000 && snap(app).screen !== 'scene'; t += 100) { app.update(100); press(app, 'confirm'); }
    expect(snap(app).scene).toBe('talk-logs');
    // A press every tenth of a second until the question is up, and for a second after.
    let asked = -1;
    for (let t = 0; t < 30000 && snap(app).screen === 'scene'; t += 100) {
      app.update(100);
      press(app, 'confirm');
      if (asked < 0 && talk()?.asking) asked = t;
      if (asked >= 0 && t - asked >= QUESTION_HOLD_MS - 200) break;
    }
    expect(asked).toBeGreaterThan(0);
    expect(talk()?.asking).toBe(true);
    expect(savedGame(store).choices).toEqual({});
    expect(QUESTION_HOLD_MS).toBeGreaterThanOrEqual(1500);
    // Left alone for a moment, the pilot is told the answer stands, and then it is taken.
    app.update(400);
    expect(texts(app)).toContain('UP/DOWN: choose   A: answer. It stands.');
    press(app, 'down', 'confirm');
    expect(savedGame(store).choices).toEqual({ logs: 'keep' });
  });

  test('a question answered before the game was closed is not asked again: the answer given is replied to', () => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2', 'lumen-1', 'lumen-2')), scenes: ['act-1', 'talk-kite', 'talk-logs'], choices: { kite: 'pass', logs: 'keep' } });
    const credits = snap(app).credits;
    app.commit({ ...app.game!, scenes: ['act-1', 'talk-kite'] });
    app.go('hub');
    const talk = () => snap(app).talk as { at: number; of: number; who: string; asking: boolean };
    press(app, 'confirm', 'confirm', 'confirm');
    expect(talk()).toMatchObject({ asking: false, who: 'Tamsin', at: 3, of: 4 });
    expect(texts(app).join(' ')).toContain('That gets around too.');
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'hub', credits });
  });

  test('what is said is drawn: the speaker, their words, and every answer', () => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'] , choices: { kite: 'pass' } });
    app.commit({ ...app.game!, scenes: ['act-1'], choices: {} });
    app.go('hub');
    expect(texts(app)).toContain('DISPATCH');
    // What the conversation is called is in the sign's letters, in the game's colour.
    expect(signIn(record((ctx) => app.draw(ctx)), 'NEW LICENCE', 'neon')).not.toBeNull();
    expect(texts(app).join(' ')).toContain('You have a visitor in the bay. Says he is a pilot. His frame says otherwise.');
    press(app, 'confirm', 'confirm', 'confirm', 'confirm');
    expect(texts(app)).toEqual(expect.arrayContaining(['YOUR CALL', 'Vouch for him.', 'Tell him to ask someone else.']));
  });

  test('what the pilot decided is written on the pages before the epilogue', () => {
    const judged = done(...MISSIONS.filter((m) => m.phase !== 'side' && m.faction !== 'hadron' && m.faction !== 'undertow' && m.verdict !== 'default').map((m) => m.id));
    const { app } = makeApp({ ...judged, scenes: SCENES.filter((s) => !s.ending && !s.id.startsWith('left-')).map((s) => s.id), choices: { kite: 'vouch', dispatch: 'cut' } });
    press(app, 'confirm');
    expect(snap(app).scene).toBe('left-1');
    expect(texts(app).join(' ')).toContain('He still undercharges.');
    press(app, 'confirm');
    expect(snap(app).scene).toBe('left-2');
    expect(texts(app).join(' ')).toContain('not on the form.');
  });

  test('a game from before there were conversations is not told about what is long past', () => {
    const old = { ...done('intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3'), scenes: ['act-1', 'act-2'] };
    delete (old as { choices?: unknown }).choices;
    const settled = settleOldStory(old, SCENES, MISSIONS);
    expect(settled.choices).toEqual({});
    expect(dueScenes(settled, SCENES, MISSIONS).map((s) => s.id)).toEqual([]);
    // What is still to come, comes.
    const later = done.call(null);
    expect(later.choices).toEqual({});
    expect(settleOldStory(settled, SCENES, MISSIONS)).toBe(settled);
    const { app } = inHub(old);
    expect(snap(app).screen).toBe('hub');
    expect(app.game!.choices).toEqual({});
  });
});

describe('bonds in the briefing', () => {
  test('a friend is offered at the friend\'s rate, someone crossed is not offered, and nobody is hired into their own trouble', () => {
    const base = { ...strong(done('intro-1', 'intro-2', 'rival-1')), scenes: SCENES.map((s) => s.id) };
    const offered = (choices: Record<string, string>, mission: string) => {
      const { app } = inHub({ ...base, choices });
      select(app, 'contracts');
      select(app, mission);
      const seen: { id: string | null; share: number }[] = [];
      if (!snap(app).menu.items.some((i) => i.id === 'wingman')) return seen;
      press(app, 'down');
      for (let i = 0; i < 3; i++) {
        press(app, 'right');
        const w = (snap(app).briefing as unknown as { wingman: { id: string | null; share: number } }).wingman;
        if (w.id === null) break;
        seen.push({ id: w.id, share: w.share });
      }
      return seen;
    };
    expect(offered({ kite: 'vouch', marrow: 'cover' }, 'patrol')).toEqual([{ id: 'kite', share: 10 }, { id: 'marrow', share: 20 }]);
    expect(offered({ kite: 'pass', marrow: 'sell' }, 'patrol')).toEqual([{ id: 'kite', share: 15 }]);
    expect(offered({ kite: 'vouch', marrow: 'cover' }, 'favour-kite')).toEqual([{ id: 'marrow', share: 20 }]);
    expect(offered({ kite: 'vouch', marrow: 'cover' }, 'favour-marrow')).toEqual([{ id: 'kite', share: 10 }]);
  });
});
