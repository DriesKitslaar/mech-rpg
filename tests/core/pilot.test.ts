import { newGame, type GameState } from '../../src/core/game';
import {
  MAX_LEVEL, addXp, buyPerk, checkBuyPerk, levelFor, perkEffects, perkPoints, xpForContract, xpForLevel,
} from '../../src/core/pilot';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';

const fresh = (xp = 0): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), xp });

describe('levels', () => {
  test('the thresholds follow the plan', () => {
    expect([1, 2, 3, 5, 10].map(xpForLevel)).toEqual([0, 200, 500, 1400, 5400]);
  });

  test('a level is reached exactly at its threshold', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(199)).toBe(1);
    expect(levelFor(200)).toBe(2);
    expect(levelFor(5400)).toBe(10);
  });

  test('levels stop at the maximum', () => {
    expect(levelFor(10 ** 9)).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(20);
  });

  test('a won contract gives a tenth of its pay in experience, a lost one nothing', () => {
    expect(xpForContract(1600, true)).toBe(160);
    expect(xpForContract(405, true)).toBe(41);
    expect(xpForContract(1600, false)).toBe(0);
  });

  test('experience accumulates and never exceeds what the maximum level needs', () => {
    expect(addXp(fresh(100), 60).xp).toBe(160);
    expect(addXp(fresh(), 10 ** 9).xp).toBe(xpForLevel(MAX_LEVEL));
    const g = fresh(5);
    addXp(g, 10);
    expect(g.xp).toBe(5);
  });
});

describe('perks', () => {
  test('there are eight, with the ranks from the plan', () => {
    expect(PERKS.map((p) => [p.id, p.maxRank])).toEqual([
      ['marksman', 3], ['reflexes', 3], ['capacitor', 3], ['heatsinks', 3], ['fieldTech', 2], ['plating', 3], ['haggler', 3], ['quartermaster', 3],
    ]);
    for (const perk of PERKS) {
      expect(perk.name.length).toBeGreaterThan(0);
      expect(perk.description.length).toBeGreaterThan(0);
    }
  });

  test('each level above the first gives one point', () => {
    expect(perkPoints(fresh(0), PERKS)).toBe(0);
    expect(perkPoints(fresh(500), PERKS)).toBe(2);
  });

  test('spending a point raises the rank and uses the point', () => {
    const g = buyPerk(fresh(500), 'marksman', PERKS);
    expect(g.perks).toEqual({ marksman: 1 });
    expect(perkPoints(g, PERKS)).toBe(1);
  });

  test('refusals: no points, at the maximum rank, unknown perk', () => {
    expect(checkBuyPerk(fresh(0), 'marksman', PERKS)).toBe('noPoints');
    const maxed = { ...fresh(10 ** 6), perks: { fieldTech: 2 } };
    expect(checkBuyPerk(maxed, 'fieldTech', PERKS)).toBe('maxed');
    expect(checkBuyPerk(fresh(10 ** 6), 'constructor', PERKS)).toBe('unknown');
    expect(() => buyPerk(fresh(0), 'marksman', PERKS)).toThrow('illegal perk: noPoints');
  });

  test('buying does not change the given state', () => {
    const g = fresh(500);
    buyPerk(g, 'marksman', PERKS);
    expect(g.perks).toEqual({});
  });

  test('effects add up per rank', () => {
    expect(perkEffects({}, PERKS)).toEqual({
      aim: 0, evasion: 0, energy: 0, cooling: 0, repairs: 0, armour: 0, payBonus: 0, costDiscount: 0,
    });
    const e = perkEffects({ marksman: 3, reflexes: 1, capacitor: 2, heatsinks: 3, fieldTech: 2, plating: 3, haggler: 2, quartermaster: 3 }, PERKS);
    expect(e).toMatchObject({ aim: 12, evasion: 4, energy: 40, cooling: 15, repairs: 2 });
    expect(e.armour).toBeCloseTo(0.18);
    expect(e.payBonus).toBeCloseTo(0.16);
    expect(e.costDiscount).toBeCloseTo(0.45);
  });

  test('ranks of perks that no longer exist are ignored', () => {
    expect(perkEffects({ retired: 3 }, PERKS).aim).toBe(0);
  });
});
