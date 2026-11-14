import { completeMission } from '../../src/core/campaign';
import { newGame, saveLoadout, setPaint, type GameState } from '../../src/core/game';
import { MEDAL_PAY, awardMedals, medalProgress, type Medal } from '../../src/core/medals';
import { xpForLevel } from '../../src/core/pilot';
import { ENEMIES } from '../../src/content/enemies';
import { MEDALS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const medal = (id: string, tier: 1 | 2 | 3, have: (g: GameState) => number, need = 1): Medal =>
  ({ id, name: id, text: '', tier, progress: (game) => ({ have: have(game), need }) });
const WINS = medal('wins', 1, (g) => g.battlesWon, 3);
const RICH = medal('rich', 2, (g) => g.credits, 5000);
const BOTH = medal('both', 3, (g) => ['wins', 'rich'].filter((id) => g.medals.includes(id)).length, 2);

describe('awarding', () => {
  test('a medal is earned once the pilot has what it takes: it joins the list and pays by its tier', () => {
    const g = { ...fresh(), battlesWon: 3 };
    const { game, earned } = awardMedals(g, [WINS, RICH]);
    expect(earned).toEqual([WINS]);
    expect(game.medals).toEqual(['wins']);
    expect(game.credits).toBe(g.credits + MEDAL_PAY[1]);
    expect(g.medals).toEqual([]);
  });

  test('pays 100, 400 and 1200 by tier: a tip, not a wage', () => {
    expect(MEDAL_PAY).toEqual({ 1: 100, 2: 400, 3: 1200 });
  });

  test('a medal already held is not awarded or paid again, even if its condition no longer holds', () => {
    const g = { ...fresh(), battlesWon: 9, medals: ['wins', 'rich'], credits: 10 };
    const { game, earned } = awardMedals(g, [WINS, RICH]);
    expect(earned).toEqual([]);
    expect(game).toBe(g);
  });

  test('several at once are awarded in the order of the list, and a medal that asks for others follows in the same go', () => {
    const g = { ...fresh(), battlesWon: 3, credits: 6000 };
    const { game, earned } = awardMedals(g, [BOTH, WINS, RICH]);
    expect(earned.map((m) => m.id)).toEqual(['wins', 'rich', 'both']);
    expect(game.medals).toEqual(['wins', 'rich', 'both']);
    expect(game.credits).toBe(6000 + 100 + 400 + 1200);
  });

  test('what a medal pays can earn the next one', () => {
    const g = { ...fresh(), battlesWon: 3, credits: 4900 };
    expect(awardMedals(g, [WINS, RICH]).game.medals).toEqual(['wins', 'rich']);
  });

  test('progress is what the pilot has of what it takes, never more, and whether it is held', () => {
    expect(medalProgress(WINS, { ...fresh(), battlesWon: 2 })).toEqual({ have: 2, need: 3, earned: false });
    expect(medalProgress(WINS, { ...fresh(), battlesWon: 40 })).toEqual({ have: 3, need: 3, earned: false });
    expect(medalProgress(WINS, { ...fresh(), medals: ['wins'] })).toEqual({ have: 3, need: 3, earned: true });
  });
});

describe('the medals', () => {
  const byId = (id: string): Medal => MEDALS.find((m) => m.id === id)!;
  const earns = (id: string, game: GameState): boolean => awardMedals(game, MEDALS).earned.some((m) => m.id === id);
  const stats = (extra: Partial<GameState['stats']>): GameState => ({ ...fresh(), stats: { ...fresh().stats, ...extra } });
  const did = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());

  test('there are about forty, each with an id of its own, a name that fits its row and a text that fits its panel', () => {
    expect(MEDALS.length).toBeGreaterThanOrEqual(36);
    expect(new Set(MEDALS.map((m) => m.id)).size).toBe(MEDALS.length);
    expect(new Set(MEDALS.map((m) => m.name)).size).toBe(MEDALS.length);
    for (const m of MEDALS) {
      expect(m.id).toMatch(/^[a-z0-9-]+$/);
      expect(m.name.length, m.id).toBeLessThanOrEqual(20);
      expect(m.text.length, m.id).toBeLessThanOrEqual(60);
      expect([1, 2, 3]).toContain(m.tier);
      expect(m.progress(fresh()).need, m.id).toBeGreaterThan(0);
    }
  });

  test('a pilot who has done nothing holds none', () => {
    expect(awardMedals(fresh(), MEDALS).earned).toEqual([]);
  });

  test.each([
    ['first-contract', { contracts: 1 }], ['contracts-25', { contracts: 25 }], ['contracts-100', { contracts: 100 }],
    ['first-loss', { lost: 1 }], ['first-retreat', { retreats: 1 }], ['earned', { earned: 100000 }],
    ['kills-50', { kills: 50 }], ['kills-250', { kills: 250 }], ['parts-60', { parts: 60 }], ['staggers-40', { staggers: 40 }],
    ['bombs-5', { bombs: 5 }], ['first-boss', { bosses: 1 }], ['bosses-8', { bosses: 8 }], ['overheats-10', { overheats: 10 }],
    ['hits-1000', { hits: 1000 }], ['first-flawless', { flawless: 1 }], ['flawless-10', { flawless: 10 }],
  ] as const)('%s is earned from the record', (id, record) => {
    expect(earns(id, stats(record))).toBe(true);
    const short = Object.fromEntries(Object.entries(record).map(([key, n]) => [key, n - 1]));
    expect(earns(id, stats(short))).toBe(false);
  });

  test('ranks: one S, ten and twenty-five', () => {
    const ranked = (n: number): GameState => ({ ...fresh(), ranks: Object.fromEntries(Array.from({ length: n }, (_, i) => [`m${i}`, 'S' as const])) });
    expect(earns('first-s', { ...fresh(), ranks: { a: 'A' } })).toBe(false);
    expect(earns('first-s', ranked(1))).toBe(true);
    expect(earns('s-10', ranked(9))).toBe(false);
    expect(earns('s-10', ranked(10))).toBe(true);
    expect(earns('s-25', ranked(25))).toBe(true);
  });

  test('the story: a side taken, a war won for each client, the audit and the two verdicts', () => {
    expect(earns('side', did('choice-lumen'))).toBe(true);
    expect(earns('side', did('intro-1'))).toBe(false);
    expect(earns('war-hadron', did('finale-hadron'))).toBe(true);
    expect(earns('war-lumen', did('finale-lumen'))).toBe(true);
    expect(earns('war-undertow', did('finale-undertow'))).toBe(true);
    expect(earns('war-lumen', did('finale-hadron'))).toBe(false);
    expect(earns('audit', did('audit-3'))).toBe(true);
    expect(earns('verdict-enforce', did('verdict-enforce'))).toBe(true);
    expect(earns('verdict-default', did('verdict-default'))).toBe(true);
    expect(earns('cycle', { ...fresh(), cycle: 1 })).toBe(true);
  });

  test('medals for the whole story are earned from the medals for its parts, whichever cycle those came from', () => {
    const two = { ...did('finale-undertow'), medals: ['war-hadron', 'war-lumen'] };
    expect(awardMedals(two, MEDALS).earned.map((m) => m.id)).toEqual(expect.arrayContaining(['war-undertow', 'free-agent']));
    expect(earns('free-agent', { ...fresh(), medals: ['war-hadron', 'war-lumen'] })).toBe(false);
    expect(earns('both-verdicts', { ...did('verdict-default'), medals: ['verdict-enforce'] })).toBe(true);
    expect(earns('both-verdicts', did('verdict-default'))).toBe(false);
  });

  test('the turns of the third act keep their names to themselves until they are earned', () => {
    expect(MEDALS.filter((m) => m.secret).map((m) => m.id)).toEqual(['audit', 'verdict-enforce', 'verdict-default', 'both-verdicts']);
  });

  test('the arena, the pilot and the hangar', () => {
    expect(earns('first-arena', { ...fresh(), arenaRank: 1 })).toBe(true);
    expect(earns('champion', { ...fresh(), arenaRank: 9 })).toBe(false);
    expect(earns('champion', { ...fresh(), arenaRank: 10 })).toBe(true);
    expect(earns('level-5', { ...fresh(), xp: xpForLevel(5) })).toBe(true);
    expect(earns('level-5', { ...fresh(), xp: xpForLevel(5) - 1 })).toBe(false);
    expect(earns('level-10', { ...fresh(), xp: xpForLevel(10) })).toBe(true);
    expect(earns('level-20', { ...fresh(), xp: xpForLevel(20) })).toBe(true);
    expect(earns('painted', setPaint(fresh(), 'cobalt'))).toBe(true);
    expect(earns('loadout', saveLoadout(fresh(), 1))).toBe(true);
    expect(earns('rich', { ...fresh(), credits: 30000 })).toBe(true);
    const parts = Object.values(CATALOG).filter((p) => p.vendor).slice(0, 40);
    expect(earns('parts-40', { ...fresh(), inventory: Object.fromEntries(parts.map((p) => [p.id, 1])) })).toBe(true);
    expect(earns('parts-40', fresh())).toBe(false);
  });

  test('the enemies met: twenty kinds, and every kind there is', () => {
    const kinds = Object.keys(ENEMIES);
    expect(earns('met-20', { ...fresh(), met: kinds.slice(0, 20) })).toBe(true);
    expect(earns('met-20', { ...fresh(), met: kinds.slice(0, 19) })).toBe(false);
    expect(earns('met-all', { ...fresh(), met: kinds.slice(1) })).toBe(false);
    // Arena pilots are met too, but they are not kinds of enemy.
    expect(earns('met-all', { ...fresh(), met: [...kinds.slice(1), 'arena-1'] })).toBe(false);
    expect(earns('met-all', { ...fresh(), met: kinds })).toBe(true);
    expect(byId('met-all').progress(fresh()).need).toBe(kinds.length);
  });

  test('the last one asks for every other medal', () => {
    const all = byId('all');
    expect(MEDALS[MEDALS.length - 1]).toBe(all);
    const others = MEDALS.filter((m) => m !== all).map((m) => m.id);
    expect(all.progress({ ...fresh(), medals: others }).need).toBe(others.length);
    expect(earns('all', { ...fresh(), medals: others })).toBe(true);
    expect(earns('all', { ...fresh(), medals: others.slice(1) })).toBe(false);
  });
});

test('every kind of enemy can be met in the story, so the medal for meeting them all can be earned', () => {
  const met = new Set(MISSIONS.flatMap((m) => m.battles.flatMap((b) => b.enemies)));
  for (const def of Object.values(ENEMIES)) if (def.abilities?.carrier) met.add(def.abilities.carrier.unit.id);
  expect(Object.keys(ENEMIES).filter((id) => !met.has(id))).toEqual([]);
});
