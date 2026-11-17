import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, type BattleState } from '../../src/core/battle';
import { availableMissions, campaignComplete, completeMission, forCycle, sideMissions, startNewCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { generateBoard } from '../../src/core/board';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { BOUNTIES, FAVOURS, GUILD_JOBS, SIDE_WORK } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { TALKS } from '../../src/content/talks';
import { BattleFlow } from '../../src/ui/battleFlow';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, ids, inHub, select, snap, strong } from '../helpers/app';

const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
/** The bounties and favours on offer; the Guild's jobs have their own tests. */
const side = (g: GameState) => sideMissions(g, MISSIONS).map((m) => m.id).filter((id) => !id.startsWith('guild-'));
const guild = (g: GameState) => sideMissions(g, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('guild-'));
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
    expect(targets).toEqual(['magpie', 'dredge', 'lark', 'hollow', 'paragon', 'notary']);
    // Nobody on the board shares a name with anybody in the arena, and the open contracts never field them.
    expect(ARENA.map((a) => a.name).filter((name) => Object.values(ENEMIES).some((e) => e.name === name))).toEqual([]);
    for (let wins = 0; wins < 300; wins += 7) {
      for (const open of generateBoard(wins, wins % 3, BOARD_TEXT)) expect(open.battles.flatMap((b) => b.enemies).filter((id) => targets.includes(id))).toEqual([]);
    }
    // Later in a later cycle they pay and hit as everything else does then.
    expect(forCycle(BOUNTIES[5], 1).reward).toBeGreaterThan(BOUNTIES[5].reward);
    for (const [i, m] of BOUNTIES.entries()) {
      expect(m.battles).toHaveLength(1);
      expect(m.battles[0].objective).toEqual({ type: 'leader', target: 0 });
      expect(m.title).toBe(`Wanted: ${ENEMIES[targets[i]].name}`);
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
    expect(listed).toEqual(['patrol', 'choice-hadron', 'choice-lumen', 'choice-undertow', 'bounty-1', 'favour-kite', 'guild-1']);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('choice-hadron');
    select(app, 'bounty-1');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'bounty-1', reward: 2400 } });
  });
});

describe('the Night Market Guild', () => {
  test('has four jobs, one at a time, about machines the story never fields; the last two are a battle on their own', () => {
    expect(GUILD_JOBS.map((m) => m.id)).toEqual(['guild-1', 'guild-2', 'guild-3', 'guild-4']);
    expect(guild(fresh())).toEqual([]);
    expect(guild(done('intro-1', 'intro-2'))).toEqual(['guild-1']);
    expect(guild(completeMission(done('intro-1', 'intro-2'), 'guild-1', MISSIONS))).toEqual([]);
    expect(guild(completeMission(done(...ACT_ONE), 'guild-1', MISSIONS))).toEqual(['guild-2']);
    const story = MISSIONS.filter((m) => m.phase !== 'side').flatMap((m) => m.battles.flatMap((b) => b.enemies));
    const fielded = [...new Set(GUILD_JOBS.flatMap((m) => m.battles.flatMap((b) => b.enemies)))].sort();
    expect(fielded).toEqual(['arc-pylon', 'breacher', 'flak-walker', 'hunter-drone', 'longshot', 'mortar-nest', 'night-train', 'scrap-king']);
    for (const id of fielded) expect(story, id).not.toContain(id);
    expect(GUILD_JOBS.slice(2).map((m) => m.battles.map((b) => b.enemies))).toEqual([[['scrap-king']], [['night-train']]]);
  });

  test.each([['guild-1', 'tier1'], ['guild-2', 'tier2'], ['guild-3', 'tier3'], ['guild-4', 'tier4']])('%s can be won with %s more often than not', (missionId, build) => {
    expect(wins(missionId, build)).toBeGreaterThanOrEqual(0.5);
  });

  test('the two great machines are a fight: the build a pilot has a stage earlier does not win as a matter of course', () => {
    expect(wins('guild-3', 'tier2', 20)).toBeLessThan(0.8);
    expect(wins('guild-4', 'tier2', 20)).toBeLessThan(0.5);
  });

  test('the Scrap King still fights with its claws gone, and the Hunter Drone really does dart', () => {
    const acts = (id: string, prepare: (s: BattleState) => void): string[] => {
      let s = createBattle(REFERENCE_BUILDS.tier3, [ALL_ENEMIES[id]], CATALOG, 5);
      prepare(s);
      const seen: string[] = [];
      for (let i = 0; i < 60 && s.outcome === 'ongoing'; i++) {
        const mine = activeUnit(s).side === 'player';
        const action = mine ? { type: 'endTurn' as const } : chooseEnemyAction(s, CATALOG);
        if (!mine) seen.push(action.type);
        s = applyAction(s, action, CATALOG);
      }
      return seen;
    };
    expect(acts('scrap-king', (s) => { s.units[1].parts.arms!.ap = 0; })).toContain('fire');
    expect(acts('hunter-drone', () => undefined)).toContain('boost');
  });

  test('every open contract is briefed in full: each machine it can field has its line', () => {
    for (let won = 0; won < 400; won += 3) {
      for (const open of generateBoard(won, won % 4, BOARD_TEXT)) for (const line of open.briefing) expect(typeof line, open.id).toBe('string');
    }
  });
});

describe('how hard the side work is', () => {
  // Each with the build a pilot can afford when it is posted; measured over sixty seeds, checked here over twelve.
  test.each([
    ['bounty-1', 'tier2'], ['bounty-2', 'tier2'], ['bounty-3', 'tier3'], ['bounty-4', 'tier4'], ['bounty-5', 'tier4'], ['bounty-6', 'tier5'],
    ['favour-kite', 'tier1'], ['favour-undertow', 'tier2'], ['favour-lumen', 'tier2'], ['favour-ashfall', 'tier2'], ['favour-marrow', 'tier2'],
    ['favour-sixty', 'tier4'], ['favour-dispatch', 'tier4'],
  ])('%s can be won with %s more often than not', (missionId, build) => {
    expect(wins(missionId, build)).toBeGreaterThanOrEqual(0.5);
  });

  test('a bounty is not for a new pilot: the starter mech loses the first notice more often than it wins it', () => {
    expect(wins('bounty-1', 'starter')).toBeLessThan(0.5);
    // Six notices, seven favours, four jobs for the Guild, and three contracts nobody posted.
    expect(SIDE_WORK).toHaveLength(20);
  });
});

describe('the faces of the wanted and of the Guild', () => {
  const WANTED = ['magpie', 'dredge', 'lark', 'hollow', 'paragon', 'notary'];

  test('every notice carries the face of whoever it is for, and that face is drawn', () => {
    expect(BOUNTIES.map((b) => b.portrait)).toEqual(WANTED.map((id) => `portrait-${id}`));
    for (const bounty of BOUNTIES) expect(bounty.portrait! in SPRITES, bounty.portrait).toBe(true);
    expect(new Set(BOUNTIES.map((b) => b.portrait)).size).toBe(6);
    // The same face speaks in the battle, and is the machine's own for whatever it says as it changes.
    WANTED.forEach((id, i) => {
      expect(ALL_ENEMIES[id].portrait).toBe(`portrait-${id}`);
      expect(BOUNTIES[i].battles[0].enemies[0]).toBe(id);
    });
  });

  test('each of the wanted has a word when the fight opens and another when it is lost, in their own name and face, and both fit', () => {
    WANTED.forEach((id, i) => {
      const talk = BOUNTIES[i].battles.flatMap((b) => b.talk ?? []);
      expect(talk.map((line) => line.at)).toEqual(['start', 'win']);
      for (const line of talk) {
        expect(line.who).toBe(ALL_ENEMIES[id].name);
        expect(line.portrait).toBe(`portrait-${id}`);
        expect(line.text.length).toBeGreaterThan(10);
        expect(wrap(line.text, TALK_CHARS).length, line.text).toBeLessThanOrEqual(TALK_LINES);
      }
    });
    const all = BOUNTIES.flatMap((b) => b.battles.flatMap((battle) => (battle.talk ?? []).map((line) => line.text)));
    expect(new Set(all).size).toBe(12);
  });

  test('the Guild has a broker with a face, who has one thing to say as each job opens', () => {
    expect('portrait-guild' in SPRITES).toBe(true);
    for (const job of GUILD_JOBS) {
      expect(job.portrait).toBe('portrait-guild');
      const talk = job.battles.flatMap((b) => b.talk ?? []);
      expect(talk).toHaveLength(1);
      expect(job.battles[0].talk).toEqual(talk);
      expect(talk[0]).toMatchObject({ at: 'start', who: 'Guild Broker', portrait: 'portrait-guild' });
      expect(wrap(talk[0].text, TALK_CHARS).length, talk[0].text).toBeLessThanOrEqual(TALK_LINES);
    }
    expect(new Set(GUILD_JOBS.map((job) => job.battles[0].talk![0].text)).size).toBe(4);
  });
});

describe('the wanted are heard in their battles', () => {
  test.each(BOUNTIES.map((b) => [b.id, b] as const))('%s: the pilot on the notice speaks when the fight opens and again when it is lost, and nobody else does', (_id, bounty) => {
    const state = createBattle(REFERENCE_BUILDS.tier6, bounty.battles[0].enemies.map((id) => ALL_ENEMIES[id]), CATALOG, 7, { objective: bounty.battles[0].objective, enemyScale: 0.3 });
    const flow = new BattleFlow(state, CATALOG, { talk: bounty.battles[0].talk });
    const said: { who: string; text: string; portrait?: string }[] = [];
    for (let i = 0; i < 20000 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'talk') {
        if (said[said.length - 1]?.text !== flow.spoken!.text) said.push({ ...flow.spoken! });
        flow.onInput('confirm');
      } else if (flow.phase === 'animating') flow.advance();
      else if (flow.phase === 'action') {
        // Auto Turn, by the menu: the automatic pilot plays the turn out.
        for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'auto'; j++) flow.onInput('down');
        flow.onInput('confirm');
      } else flow.onInput('confirm');
    }
    expect(flow.state.outcome).toBe('victory');
    const name = ALL_ENEMIES[bounty.battles[0].enemies[0]].name;
    const own = said.filter((line) => line.who === name);
    // What the machine says as it changes (the Notary has such a line) is in the same voice and comes between the two.
    expect(own[0].text).toBe(bounty.battles[0].talk![0].text);
    expect(own[own.length - 1].text).toBe(bounty.battles[0].talk![1].text);
    expect(said.every((line) => line.who === name)).toBe(true);
    for (const line of own) expect(line.portrait).toBe(bounty.portrait);
  });
});
