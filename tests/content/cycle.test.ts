import { availableMissions, completeMission, decide, dueScenes, arrivedMessages, forCycle, type Mission } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { QUEST } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { unknownTerms } from '../helpers/conditions';
import { done, inHub, press, select, snap, strong } from '../helpers/app';

const fresh = (cycle = 0): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), cycle });
const did = (game: GameState, ...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), game);
const offered = (game: GameState): string[] => availableMissions(game, MISSIONS).map((m) => m.id);
const quests = (game: GameState): string[] => offered(game).filter((id) => id.startsWith('quest-'));
const due = (game: GameState): string[] => dueScenes(game, SCENES, MISSIONS).map((s) => s.id);
const letters = (game: GameState): string[] => arrivedMessages(game, MESSAGES, MISSIONS).map((m) => m.id);
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
const WAR = [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen'];
const mission = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;
/** What is said before the pilot's first turn in a battle of a contract, in a game of the given cycle. */
function opening(id: string, index: number, cycle: number): string[] {
  const m = forCycle(mission(id), cycle);
  const flow = new BattleFlow(startMissionBattle(STARTER_BUILD, m, index, ALL_ENEMIES, CATALOG, 3), CATALOG, { talk: m.battles[index].talk, cycle });
  const said: string[] = [];
  for (let guard = 0; guard < 2000; guard++) {
    if (flow.phase === 'animating') flow.advance();
    else if (flow.phase === 'talk') { said.push(`${flow.spoken!.who}: ${flow.spoken!.text}`); flow.onInput('confirm'); } else break;
  }
  return said;
}

/**
 * Everything said in a battle of a contract while the pilot does nothing but end their turns, up to
 * the given round. A sturdy pilot's frame has armour enough to be standing there whatever is fielded.
 */
function heard(id: string, index: number, cycle: number, rounds: number, sturdy = false): string[] {
  const m = forCycle(mission(id), cycle);
  const flow = new BattleFlow(startMissionBattle(STARTER_BUILD, m, index, ALL_ENEMIES, CATALOG, 3), CATALOG, { talk: m.battles[index].talk, cycle });
  if (sturdy) {
    const state = structuredClone(flow.state);
    for (const part of Object.values(state.units[0].parts)) if (part) { part.ap *= 200; part.maxAp *= 200; }
    flow.state = state;
  }
  const said: string[] = [];
  for (let guard = 0; guard < 20000; guard++) {
    if (flow.phase === 'animating') flow.advance();
    else if (flow.phase === 'talk') { said.push(`${flow.spoken!.who}: ${flow.spoken!.text}`); flow.onInput('confirm'); }
    else if (flow.phase === 'action' && flow.state.round <= rounds) {
      for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'endTurn'; i++) flow.onInput('down');
      flow.onInput('confirm');
    } else break;
  }
  return said;
}

describe('the first telling', () => {
  test('is as it was: no page about the recorder, no contract without a client, whatever has been done', () => {
    expect(due(fresh())).toEqual(['act-1']);
    const far = decide(decide(did(fresh(), ...WAR, 'audit-1', 'audit-2', 'audit-3'), 'logs', 'keep'), 'frame', 'ask');
    expect(quests(far)).toEqual([]);
    expect(due(far)).not.toContain('playback');
    expect(due(far)).not.toContain('talk-playback');
    expect(letters(far).filter((id) => ['ashfall-paper', 'tidy-desk-box'].includes(id))).toEqual([]);
  });

  test('hears nothing of the recorder in a battle, played to the round the recorder speaks in', () => {
    // Every battle of a contract of every telling in which the recorder has a line, and the round of that line.
    const spoken = MISSIONS.filter((m) => !(m.when ?? '').includes('cycle:')).flatMap((m) => m.battles.flatMap((battle, i) =>
      (battle.talk ?? []).filter((line) => line.who === 'Recorder').map((line) => ({ id: m.id, i, round: line.at as number }))));
    expect(spoken.map((s) => `${s.id}/${s.i} ${s.round}`)).toEqual(['undertow-2/0 2', 'undertow-2/1 2', 'hadron-4/0 2', 'undertow-5/0 4', 'favour-sixty/0 2']);
    for (const { id, i, round } of spoken) {
      // The later telling hears it by then, so the same turns of a first telling would too, were the line not kept back.
      expect(heard(id, i, 1, round, true).filter((line) => line.startsWith('Recorder')).length, `${id}/${i} later`).toBe(1);
      expect(heard(id, i, 0, round, true).filter((line) => line.startsWith('Recorder')), `${id}/${i}`).toEqual([]);
    }
  });
});

describe('a later telling', () => {
  test('opens with the act and then with the frame\'s recorder', () => {
    expect(due(fresh(1))).toEqual(['act-1', 'playback']);
    expect(due(fresh(3))).toEqual(['act-1', 'playback']);
    // Once the first contract is flown the page is behind the pilot.
    expect(due({ ...did(fresh(1), 'intro-1'), scenes: ['act-1'] })).not.toContain('playback');
  });

  test('offers three contracts nobody posted, one at a time, each when its moment has come', () => {
    expect(QUEST.map((q) => q.id)).toEqual(['quest-1', 'quest-2', 'quest-3']);
    for (const quest of QUEST) {
      expect(quest.client).toBe('Unlisted');
      expect(quest.portrait).toBe('portrait-recorder');
      expect(quest.portrait! in SPRITES).toBe(true);
      expect(unknownTerms(quest.when!), quest.id).toEqual([]);
      expect(quest.when, quest.id).toContain('cycle:1');
    }
    const kept = (game: GameState): GameState => decide(game, 'logs', 'keep');
    expect(quests(did(fresh(1), ...ACT_ONE.slice(0, 8)))).toEqual([]);
    expect(quests(did(fresh(1), ...ACT_ONE))).toEqual(['quest-1']);
    // The second waits for a side to be taken, and for the first.
    expect(quests(kept(did(fresh(1), ...ACT_ONE, 'choice-lumen')))).toEqual(['quest-1']);
    expect(quests(kept(did(fresh(1), ...ACT_ONE, 'quest-1')))).toEqual([]);
    expect(quests(kept(did(fresh(1), ...ACT_ONE, 'quest-1', 'choice-lumen')))).toEqual(['quest-2']);
    // The third waits for the war to be over.
    expect(quests(kept(did(fresh(1), ...ACT_ONE, 'quest-1', 'choice-lumen', 'quest-2', 'lumen-3')))).toEqual([]);
    expect(quests(kept(did(fresh(1), ...WAR, 'quest-1', 'quest-2')))).toEqual(['quest-3']);
    expect(quests(kept(did(fresh(1), ...WAR, 'quest-1', 'quest-2', 'quest-3')))).toEqual([]);
  });

  test('a pilot who sold the frame\'s logs is never offered the second, and so never the third', () => {
    const sold = (game: GameState): GameState => decide(game, 'logs', 'sell');
    expect(quests(sold(did(fresh(1), ...ACT_ONE, 'quest-1', 'choice-lumen')))).toEqual([]);
    expect(quests(sold(did(fresh(1), ...WAR, 'quest-1')))).toEqual([]);
    // Nor is one who was never asked: nothing was kept that was never decided.
    expect(quests(did(fresh(1), ...ACT_ONE, 'quest-1', 'choice-lumen'))).toEqual([]);
  });

  test('the recorder is played to Dispatch once the frame has stood at gate four again, and what is answered is remembered', () => {
    const base = { ...decide(did(fresh(1), ...ACT_ONE, 'quest-1', 'choice-lumen'), 'logs', 'keep'), scenes: SCENES.filter((s) => s.id !== 'talk-playback').map((s) => s.id) };
    expect(due(base)).toEqual([]);
    expect(due(did(base, 'quest-2'))).toEqual(['talk-playback']);
    const talk = SCENES.find((s) => s.id === 'talk-playback')!;
    expect(talk.talk![0].who).toBe('Recorder');
    expect(talk.choice).toMatchObject({ id: 'frame', options: [{ id: 'ask' }, { id: 'quiet' }] });
    // A verdict given, the moment is past.
    expect(due(did(base, 'quest-2', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-default'))).not.toContain('talk-playback');
  });

  test('brings two letters the first telling never gets', () => {
    expect(letters(did(fresh(1), ...ACT_ONE))).not.toContain('ashfall-paper');
    expect(letters(did(fresh(1), ...ACT_ONE, 'quest-1'))).toContain('ashfall-paper');
    expect(letters(did(fresh(1), ...WAR, 'quest-1', 'quest-2', 'quest-3'))).toContain('tidy-desk-box');
  });

  test('hears the recorder where the frame has stood before: at the dock, and nowhere it has not been', () => {
    expect(opening('undertow-2', 0, 1)).toEqual(['Tamsin: Six rounds, pilot. The boats need six rounds.']);
    // In the second round the old channel comes through, and in the third Dispatch asks the pilot to ignore it.
    const second = heard('undertow-2', 0, 1, 3);
    expect(second.filter((line) => line.startsWith('Recorder'))).toEqual(['Recorder: Gate four. Trucks one and two are through. Lead, where are you. Lead, answer.']);
    expect(second.findIndex((line) => line.startsWith('Dispatch: ...What was that.'))).toBeGreaterThan(second.findIndex((line) => line.startsWith('Recorder')));
    // The same battle, the same turns, the first time round: Tamsin, and nobody else.
    const first = heard('undertow-2', 0, 0, 3);
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter((line) => !line.startsWith('Tamsin'))).toEqual([]);
    const lines = (id: string, index: number) => mission(id).battles[index].talk!.filter((line) => line.who === 'Recorder');
    expect(lines('undertow-2', 0).map((l) => [l.at, l.cycle])).toEqual([[2, 1]]);
    expect(lines('undertow-2', 1).map((l) => [l.at, l.cycle])).toEqual([[2, 1]]);
    // Every place it speaks in is the water of the sluice.
    for (const m of MISSIONS) {
      for (const battle of m.battles) {
        if ((battle.talk ?? []).some((line) => line.who === 'Recorder')) expect(battle.background, m.id).toBe('bg-sluice');
      }
    }
  });

  test('the contracts nobody posted grow with the cycle like every other contract', () => {
    const second = availableMissions(did(fresh(1), ...ACT_ONE), MISSIONS).map((m) => forCycle(m, 1)).find((m) => m.id === 'quest-1')!;
    expect(second.scale).toBeCloseTo(mission('quest-1').scale! * 1.25, 5);
    expect(second.reward).toBe(Math.round(mission('quest-1').reward * 1.5));
  });
});

describe('the game itself tells a battle which telling it is', () => {
  /** Everything said in the first battle at the dock, played in the game with its talk on, while the pilot only ends turns. */
  function atTheDock(cycle: number): string[] {
    const base = strong(done('intro-1', 'intro-2', 'undertow-1'));
    const { app } = inHub({ ...base, cycle, scenes: SCENES.filter((s) => !s.ending).map((s) => s.id) }, 5, { fast: false });
    select(app, 'contracts');
    select(app, 'undertow-2');
    select(app, 'accept');
    const said: string[] = [];
    for (let i = 0; i < 8000 && snap(app).screen === 'battle'; i++) {
      const battle = snap(app).battle as unknown as { phase: string; round: number; spoken: string | null };
      if (battle.phase === 'talk') {
        if (battle.spoken && said[said.length - 1] !== battle.spoken) said.push(battle.spoken);
        app.update(400);
        press(app, 'confirm');
      } else if (battle.phase === 'action') {
        if (battle.round > 3) break;
        select(app, 'endTurn');
      } else if (battle.phase === 'result') break;
      else app.update(100);
    }
    return said;
  }
  const RECORDER = 'Gate four. Trucks one and two are through. Lead, where are you. Lead, answer.';

  test('in the second telling the recorder is heard at the dock; in the first, with the same presses, it is not', () => {
    const first = atTheDock(0);
    const second = atTheDock(1);
    expect(first).toContain('Six rounds, pilot. The boats need six rounds.');
    expect(first).not.toContain(RECORDER);
    expect(second).toContain('Six rounds, pilot. The boats need six rounds.');
    expect(second).toContain(RECORDER);
    expect(second.indexOf(RECORDER)).toBeGreaterThan(0);
  });
});
