import type { Mission, MissionPhase } from '../../src/core/campaign';
import { MISSIONS } from '../../src/content/missions';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { wrap } from '../../src/ui/widgets';

/** The phases of the story, in the order they are played. */
const STORY: MissionPhase[] = ['intro', 'faction', 'rival', 'choice', 'path', 'finale', 'audit', 'verdict'];
const story = MISSIONS.filter((m) => STORY.includes(m.phase));
const linesOf = (m: Mission) => m.battles.flatMap((battle, i) => (battle.talk ?? []).map((line) => ({ ...line, battle, mission: m.id, index: i })));
/** What a pilot is told in the first cycle. */
const firstCycle = (m: Mission) => linesOf(m).filter((line) => (line.cycle ?? 0) === 0);

describe('the voices in a battle', () => {
  test('every contract of the story has somebody speaking in it', () => {
    expect(story.length).toBe(30);
    expect(story.filter((m) => firstCycle(m).length === 0).map((m) => m.id)).toEqual([]);
  });

  test('every contract done as a favour has the one who asked on the radio', () => {
    const favours = MISSIONS.filter((m) => m.id.startsWith('favour-'));
    expect(favours.length).toBe(7);
    for (const favour of favours) expect(linesOf(favour).length, favour.id).toBeGreaterThan(0);
  });

  test('nobody talks a battle to a standstill: at most three lines for one moment, each inside the box', () => {
    for (const m of MISSIONS) {
      for (const line of linesOf(m)) {
        expect(wrap(line.text, TALK_CHARS).length, line.text).toBeLessThanOrEqual(TALK_LINES);
        const together = linesOf(m).filter((other) => other.index === line.index && other.at === line.at && (other.cycle ?? 0) <= (line.cycle ?? 0));
        expect(together.length, `${m.id} battle ${line.index} at ${String(line.at)}`).toBeLessThanOrEqual(3);
      }
    }
  });

  test('a line for the last enemy is only written for a battle that begins with more than one', () => {
    for (const m of MISSIONS) {
      for (const line of linesOf(m)) {
        if (line.at === 'last') expect(line.battle.enemies.length, `${m.id} battle ${line.index}`).toBeGreaterThan(1);
      }
    }
  });

  test('a line for a round is written for a round the battle can reach', () => {
    for (const m of MISSIONS) {
      for (const line of linesOf(m)) {
        if (typeof line.at !== 'number') continue;
        const objective = line.battle.objective;
        // A battle that is outlasted ends with its last round; any other has at least as many rounds as a good pilot needs.
        const rounds = objective?.type === 'survive' ? objective.rounds : (line.battle.par ?? 3 + 2 * line.battle.enemies.length);
        expect(line.at, `${m.id} battle ${line.index}: ${line.text}`).toBeLessThanOrEqual(rounds);
      }
    }
  });

  test('the first telling does not give away what only a later one is to find', () => {
    const early = story.filter((m) => !['audit', 'verdict'].includes(m.phase));
    // Until the war is over nobody has heard of the insurer by name.
    for (const m of early) for (const line of firstCycle(m)) expect(line.text, m.id).not.toMatch(/Meridian/);
    // And at no point does anybody in a battle say what is under the story. (A contract that only a later telling offers is not the first telling.)
    for (const m of MISSIONS.filter((mission) => !/cycle:|quest-/.test(mission.when ?? ''))) {
      for (const line of firstCycle(m)) expect(line.text, m.id).not.toMatch(/\b(Society|lamp check|quorum|proxy|the box|second escort)\b/i);
    }
    // What the recorder says is never said in a first telling: every line of it is kept for a later one, or is in a contract that is.
    for (const m of MISSIONS) {
      for (const line of linesOf(m).filter((l) => l.who === 'Recorder')) expect((line.cycle ?? 0) >= 1 || (m.when ?? '').includes('cycle:1'), `${m.id}: ${line.text}`).toBe(true);
    }
    // Dispatch says what an operator can see. That the seam is finished, and what the Eye counts for, are not things seen from a desk.
    for (const m of story) for (const line of firstCycle(m)) expect(line.text, m.id).not.toMatch(/seam (was|is) finished|counts heads/i);
    // What goes up the tower every night is Tamsin's to say: she lives under it.
    const underTheEye = MISSIONS.find((m) => m.id === 'undertow-4')!.battles[0].talk!;
    expect(underTheEye.map((line) => `${line.who}: ${line.text.slice(0, 28)}`)).toEqual(['Tamsin: It does not watch us, pilot.']);
  });

  test('what is kept for a later telling is the recorder and what those who hear it say: these lines, and no others', () => {
    const later = MISSIONS.flatMap((m) => linesOf(m).filter((line) => (line.cycle ?? 0) > 0).map((line) => `${m.id}/${line.index} ${String(line.at)} ${line.who}`));
    expect(later).toEqual([
      'intro-1/0 2 Dispatch', 'undertow-2/0 2 Recorder', 'undertow-2/0 3 Dispatch', 'undertow-2/1 2 Recorder', 'rival-1/1 hurt Dispatch',
      'hadron-4/0 2 Recorder', 'undertow-5/0 4 Recorder', 'audit-2/0 2 Dispatch', 'favour-sixty/0 2 Recorder', 'favour-sixty/0 3 Old Sixty',
    ]);
    // Each of Dispatch's speaks of the frame's past or its recorder, which Dispatch does not own up to the first time round.
    const dispatch = MISSIONS.flatMap((m) => linesOf(m)).filter((line) => (line.cycle ?? 0) > 0 && line.who === 'Dispatch').map((line) => line.text);
    expect(dispatch.map((text) => /the file says|dead channel|been left|the recorder/.test(text))).toEqual([true, true, true, true]);
    // And the same words are in no line of the first telling, in a contract every telling has.
    for (const m of MISSIONS.filter((mission) => !/cycle:|quest-/.test(mission.when ?? ''))) {
      for (const line of firstCycle(m)) expect(line.text, m.id).not.toMatch(/the file says|dead channel|the recorder/);
    }
  });

  test('the recorder is a tape: it says what was said that night, and nothing about tonight', () => {
    const tape = MISSIONS.flatMap((m) => linesOf(m)).filter((line) => line.who === 'Recorder').map((line) => line.text);
    expect(tape.length).toBe(6);
    for (const text of tape) expect(text).not.toMatch(/that night|than it was|\bnow\b|eleven years/);
  });
});
