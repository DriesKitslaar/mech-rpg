import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { availableMissions, campaignComplete, completeMission, sideMissions, startNewCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { BOUNTIES, FAVOURS, SIDE_WORK } from '../../src/content/sidework';
import { TALKS } from '../../src/content/talks';
import { done, fresh, ids, inHub, select, snap, strong } from '../helpers/app';

const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
const side = (g: GameState) => sideMissions(g, MISSIONS).map((m) => m.id);
const wins = (missionId: string, build: string, seeds = 12): number => {
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  let won = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const end = playMission(REFERENCE_BUILDS[build], mission, ALL_ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') won += 1;
  }
  return won / seeds;
};

describe('the bounty board', () => {
  test('has six notices, each one fight for a named pilot who is met nowhere else, and each pays more than the last', () => {
    expect(BOUNTIES.map((m) => m.id)).toEqual(['bounty-1', 'bounty-2', 'bounty-3', 'bounty-4', 'bounty-5', 'bounty-6']);
    const targets = BOUNTIES.map((m) => m.battles[0].enemies[0]);
    expect(targets).toEqual(['magpie', 'dredge', 'vesper', 'hollow', 'paragon', 'notary']);
    for (const [i, m] of BOUNTIES.entries()) {
      expect(m.battles).toHaveLength(1);
      expect(m.battles[0].objective).toEqual({ type: 'leader', target: 0 });
      expect(m.title).toBe(`Wanted: ${ENEMIES[targets[i]].name.replace(/^The /, 'The ')}`);
      if (i > 0) expect(m.reward).toBeGreaterThan(BOUNTIES[i - 1].reward);
      const elsewhere = MISSIONS.filter((other) => other !== m).flatMap((other) => other.battles.flatMap((b) => b.enemies));
      expect(elsewhere).not.toContain(targets[i]);
    }
  });

  test('posts two notices an act and offers them one at a time, in order', () => {
    expect(side(fresh())).toEqual([]);
    expect(side(done(...ACT_ONE))).toEqual(['bounty-1']);
    let g = completeMission(done(...ACT_ONE), 'bounty-1', MISSIONS);
    expect(side(g)).toEqual(['bounty-2']);
    g = completeMission(g, 'bounty-2', MISSIONS);
    // The next two wait for the pilot to take a side.
    expect(side(g)).toEqual([]);
    g = completeMission(g, 'choice-lumen', MISSIONS);
    expect(side(g)).toEqual(['bounty-3']);
    g = completeMission(completeMission(g, 'bounty-3', MISSIONS), 'bounty-4', MISSIONS);
    expect(side(g)).toEqual([]);
    for (const id of ['lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen']) g = completeMission(g, id, MISSIONS);
    expect(side(g)).toEqual(['bounty-5']);
  });

  test('is beside the story: the story ends without it, and it is all posted again when the story starts over', () => {
    const story = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.verdict !== 'default');
    const g = done(...story.map((m) => m.id));
    expect(campaignComplete(g, MISSIONS)).toBe(true);
    expect(side(g)).toEqual(['bounty-1']);
    const again = startNewCycle(completeMission(g, 'bounty-1', MISSIONS), MISSIONS);
    expect(again.completed).toEqual([]);
    expect(availableMissions(again, MISSIONS).map((m) => m.id)).toEqual(['patrol', 'intro-1']);
  });
});

describe('favours', () => {
  test('come of what the pilot decided: one for each answer that leaves somebody in the pilot\'s debt', () => {
    expect(FAVOURS.map((m) => m.when)).toEqual([
      'chose:kite=vouch', 'chose:logs=keep', 'chose:logs=sell', 'chose:rival=pull', 'chose:marrow=cover', 'chose:sixty=keep', 'chose:dispatch=forgive',
    ]);
    // Every one hangs on a question the story really asks, and an answer it really offers.
    for (const m of FAVOURS) {
      const [question, answer] = m.when!.slice(6).split('=');
      const choice = TALKS.find((t) => t.choice?.id === question)?.choice;
      expect(choice?.options.map((o) => o.id), m.id).toContain(answer);
    }
    expect(side({ ...fresh(), choices: { kite: 'vouch', logs: 'sell' } })).toEqual(['favour-kite', 'favour-lumen']);
    expect(side({ ...fresh(), choices: { kite: 'pass', logs: 'keep', rival: 'leave' } })).toEqual(['favour-undertow']);
    expect(side(completeMission({ ...fresh(), choices: { kite: 'vouch' } }, 'favour-kite', MISSIONS))).toEqual([]);
  });
});

describe('side work in the list of contracts', () => {
  test('is listed after the story, and the cursor still starts on the story', () => {
    const { app } = inHub({ ...strong(done(...ACT_ONE)), scenes: ['act-1', 'act-2', ...TALKS.map((t) => t.id)], choices: { kite: 'vouch' } });
    select(app, 'contracts');
    const listed = ids(app).filter((id) => !id.startsWith('open-') && id !== 'archive');
    expect(listed).toEqual(['patrol', 'choice-hadron', 'choice-lumen', 'choice-undertow', 'bounty-1', 'favour-kite']);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('choice-hadron');
    select(app, 'bounty-1');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'bounty-1', reward: 2400 } });
  });
});

describe('how hard the side work is', () => {
  // Each with the build a pilot can afford when it is posted; measured over sixty seeds, checked here over twelve.
  test.each([
    ['bounty-1', 'tier2'], ['bounty-2', 'tier2'], ['bounty-3', 'tier3'], ['bounty-4', 'tier4'], ['bounty-5', 'tier4'], ['bounty-6', 'tier5'],
    ['favour-kite', 'tier2'], ['favour-undertow', 'tier2'], ['favour-lumen', 'tier2'], ['favour-ashfall', 'tier2'], ['favour-marrow', 'tier2'],
    ['favour-sixty', 'tier4'], ['favour-dispatch', 'tier4'],
  ])('%s can be won with %s more often than not', (missionId, build) => {
    expect(wins(missionId, build)).toBeGreaterThanOrEqual(0.5);
  });

  test('a bounty is not for a new pilot: the starter mech loses the first notice more often than it wins it', () => {
    expect(wins('bounty-1', 'starter')).toBeLessThan(0.5);
    expect(SIDE_WORK).toHaveLength(13);
  });
});
