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
  });
});
