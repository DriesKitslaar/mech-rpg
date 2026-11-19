import { ARCHETYPES, recordWinAs, type Archetype } from '../../src/core/archetype';
import { newGame, type GameState } from '../../src/core/game';
import { MAX_LEVEL, buyPerk, checkBuyPerk, perkPoints, xpForLevel } from '../../src/core/pilot';
import {
  ALL_STRIPES, MAX_STRIPES, MAX_STRIPE_POINTS, STRIPES_AT, STRIPES_A_POINT, countsForClass, nextPointAt, nextStripeAt, stripePoints, stripesEarned, stripesHeld,
  stripesOf,
} from '../../src/core/stripes';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';

/** Stripes, as the rules have them: read off what the pilot has won as each class, and every fifth a perk point. */

const won = (counts: Partial<{ [kind in Archetype]: number }>): Pick<GameState, 'wonAs'> => ({ wonAs: counts as GameState['wonAs'] });
/** A record with so many stripes: the first of each class in the classes' order, then the second of each, then the third. */
function holding(stripes: number): Pick<GameState, 'wonAs'> {
  const counts: Partial<{ [kind in Archetype]: number }> = {};
  for (let i = 0; i < stripes; i++) counts[ARCHETYPES[i % ARCHETYPES.length]] = STRIPES_AT[Math.floor(i / ARCHETYPES.length)];
  return won(counts);
}

describe('how many a class has given', () => {
  test('one at three contracts won as it, two at eight, three at fifteen, and never more', () => {
    expect(STRIPES_AT).toEqual([3, 8, 15]);
    expect([MAX_STRIPES, ALL_STRIPES]).toEqual([3, 21]);
    const at = (n: number): number => stripesOf(won({ lancer: n }), 'lancer');
    expect([0, 1, 2, 3, 4, 7, 8, 9, 14, 15, 16, 400].map(at)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  test('a class is counted by itself: what was won as another gives it nothing', () => {
    const record = won({ lancer: 20, bastion: 3 });
    expect(ARCHETYPES.map((kind) => stripesOf(record, kind))).toEqual([0, 0, 0, 3, 1, 0, 0]);
    expect(stripesHeld(record)).toBe(4);
    expect(stripesHeld(won({}))).toBe(0);
    expect(stripesHeld(won(Object.fromEntries(ARCHETYPES.map((kind) => [kind, 15]))))).toBe(ALL_STRIPES);
    for (let n = 0; n <= ALL_STRIPES; n++) expect(stripesHeld(holding(n))).toBe(n);
  });

  test('a pilot with no record, or an odd one, has none: a count that is no number, a negative one, a class nobody knows', () => {
    expect(stripesOf({}, 'lancer')).toBe(0);
    expect(stripesHeld(newGame(CATALOG, STARTER_BUILD))).toBe(0);
    const odd = { wonAs: { lancer: '20', bastion: -5, duellist: 4.5, marksman: Infinity, paladin: 99, skirmisher: null } } as unknown as Pick<GameState, 'wonAs'>;
    expect(ARCHETYPES.map((kind) => stripesOf(odd, kind))).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect([stripesHeld(odd), stripePoints(odd), nextPointAt(odd)]).toEqual([0, 0, 5]);
  });

  test('the next comes at the next of those counts, and after the third there is none', () => {
    const next = (n: number): number | null => nextStripeAt(won({ skirmisher: n }), 'skirmisher');
    expect([0, 2, 3, 7, 8, 14, 15, 99].map(next)).toEqual([3, 3, 8, 8, 15, 15, null, null]);
  });

  test('a contract won as a class is what moves it: the third brings the first', () => {
    let game = newGame(CATALOG, STARTER_BUILD);
    for (let i = 0; i < 2; i++) game = recordWinAs(game, 'bastion');
    expect(stripesOf(game, 'bastion')).toBe(0);
    game = recordWinAs(game, 'bastion');
    expect(stripesOf(game, 'bastion')).toBe(1);
    expect(stripesHeld(game)).toBe(1);
  });
});

describe('every fifth is a perk point', () => {
  test('one for five stripes held, of whatever classes: four at twenty, and the twenty-first brings no fifth', () => {
    expect([STRIPES_A_POINT, MAX_STRIPE_POINTS]).toEqual([5, 4]);
    const points = Array.from({ length: ALL_STRIPES + 1 }, (_, n) => stripePoints(holding(n)));
    expect(points).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4]);
    // Five of one kind there are not: it is five of whatever classes gave them.
    expect(stripePoints(won({ lancer: 15, bastion: 8 }))).toBe(1);
    expect(stripePoints(won({ lancer: 15, bastion: 3 }))).toBe(0);
  });

  test('how many stripes the next point asks for, and that there is none after the fourth', () => {
    const next = Array.from({ length: ALL_STRIPES + 1 }, (_, n) => nextPointAt(holding(n)));
    expect(next).toEqual([5, 5, 5, 5, 5, 10, 10, 10, 10, 10, 15, 15, 15, 15, 15, 20, 20, 20, 20, 20, null, null]);
  });

  test('the points are the pilot\'s to spend like any: counted with the levels\', and spent with them', () => {
    const base = newGame(CATALOG, STARTER_BUILD);
    expect(perkPoints(base, PERKS)).toBe(0);
    expect(checkBuyPerk(base, 'marksman', PERKS)).toBe('noPoints');
    const striped = { ...base, ...holding(5) };
    expect(perkPoints(striped, PERKS)).toBe(1);
    expect(checkBuyPerk(striped, 'marksman', PERKS)).toBeNull();
    const spent = buyPerk(striped, 'marksman', PERKS);
    expect(perkPoints(spent, PERKS)).toBe(0);
    expect(checkBuyPerk(spent, 'reflexes', PERKS)).toBe('noPoints');
    // With levels: each adds what it adds.
    expect(perkPoints({ ...base, xp: xpForLevel(4), ...holding(11) }, PERKS)).toBe(3 + 2);
  });

  test('a pilot at the highest level with twenty stripes can hold every rank of every perk, and has nothing left over', () => {
    const ranks = PERKS.reduce((sum, perk) => sum + perk.maxRank, 0);
    expect(MAX_LEVEL - 1 + MAX_STRIPE_POINTS).toBe(ranks);
    let game: GameState = { ...newGame(CATALOG, STARTER_BUILD), xp: xpForLevel(MAX_LEVEL), ...holding(20) };
    expect(perkPoints(game, PERKS)).toBe(ranks);
    for (const perk of PERKS) for (let rank = 0; rank < perk.maxRank; rank++) game = buyPerk(game, perk.id, PERKS);
    expect(perkPoints(game, PERKS)).toBe(0);
    for (const perk of PERKS) expect(checkBuyPerk(game, perk.id, PERKS)).toBe('maxed');
    // Without the stripes the same pilot is four ranks short.
    expect(perkPoints({ ...game, wonAs: undefined }, PERKS)).toBe(-MAX_STRIPE_POINTS);
  });
});

describe('what was earned between then and now', () => {
  test('nothing where the counts crossed no line; the stripe where one did', () => {
    expect(stripesEarned(won({ lancer: 3 }), won({ lancer: 4 }))).toEqual([]);
    expect(stripesEarned(won({ lancer: 2 }), won({ lancer: 3 }))).toEqual([{ kind: 'lancer', stripe: 1, point: false }]);
    expect(stripesEarned(won({ lancer: 7 }), won({ lancer: 8 }))).toEqual([{ kind: 'lancer', stripe: 2, point: false }]);
    expect(stripesEarned(won({ lancer: 14 }), won({ lancer: 15 }))).toEqual([{ kind: 'lancer', stripe: 3, point: false }]);
    expect(stripesEarned(won({ lancer: 15 }), won({ lancer: 16 }))).toEqual([]);
  });

  test('the one that makes the count five, ten, fifteen or twenty says it brought a point; the twenty-first does not', () => {
    for (let n = 1; n <= ALL_STRIPES; n++) {
      const earned = stripesEarned(holding(n - 1), holding(n));
      expect(earned, `the stripe that makes ${n}`).toHaveLength(1);
      expect(earned[0].point, `the stripe that makes ${n}`).toBe(n % 5 === 0);
      // What it says agrees with what the points did.
      expect(earned[0].point).toBe(stripePoints(holding(n)) > stripePoints(holding(n - 1)));
    }
  });

  test('several at once, each by its number: in the order of the classes, a class\'s lower stripe first; and the point is the fifth\'s', () => {
    expect(stripesEarned(won({}), won({ skirmisher: 9, duellist: 3 }))).toEqual([
      { kind: 'duellist', stripe: 1, point: false }, { kind: 'skirmisher', stripe: 1, point: false }, { kind: 'skirmisher', stripe: 2, point: false },
    ]);
    // A record that went backwards earned nothing.
    expect(stripesEarned(won({ lancer: 15 }), won({ lancer: 2 }))).toEqual([]);
    // From nothing at all to everything: all twenty-one, four of them with a point.
    const all = stripesEarned({}, won(Object.fromEntries(ARCHETYPES.map((kind) => [kind, 99]))));
    expect(all).toHaveLength(ALL_STRIPES);
    expect(all.map((entry) => entry.point).filter(Boolean)).toHaveLength(MAX_STRIPE_POINTS);
    expect(all.map((entry, i) => (entry.point ? i + 1 : 0)).filter(Boolean)).toEqual([5, 10, 15, 20]);
    // Three held already, three more at once: the second of them is the fifth.
    expect(stripesEarned(won({ lancer: 15 }), won({ lancer: 15, bastion: 15 })).map((entry) => entry.point)).toEqual([false, true, false]);
  });
});

describe('which contracts count for a class', () => {
  test('any flown in a build of the pilot\'s own: the story\'s, the board\'s, the arena\'s and its masters\'', () => {
    for (const id of ['intro-1', 'patrol', 'open-0-30-0', 'open-2-41-job', 'bounty-1', 'arena-3', 'arena-mirror', 'cup-gold', 'arena-master-bastion', 'arena-seat']) {
      expect(countsForClass({ id }), id).toBe(true);
    }
  });

  test('not the simulator\'s drills or its range, not a floor of the Gauntlet, and nothing flown in a lent machine', () => {
    for (const id of ['drill-basics', 'range-1-heavy-mech', 'range-spar-1', 'gauntlet-4']) expect(countsForClass({ id }), id).toBe(false);
    expect(countsForClass({ id: 'patrol', loaner: STARTER_BUILD })).toBe(false);
    expect(countsForClass({ id: 'intro-1', loaner: STARTER_BUILD })).toBe(false);
    // A contract that only has such a word somewhere in its name is an ordinary one.
    for (const id of ['open-range-1', 'the-drill-yard', 'old-gauntlet-road']) expect(countsForClass({ id }), id).toBe(true);
  });
});
