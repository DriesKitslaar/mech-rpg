import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { CUPS, cupMission, cupOpen, cupPurse, cupWon, recordCupWin } from '../../src/core/arena';
import { isValidState } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import { takesWingman } from '../../src/core/wingman';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { STRINGS } from '../../src/content/strings';
import { battleTrack } from '../../src/ui/soundtrack';
import { done, finishMission, fresh, ids, inHub, press, savedGame, select, snap, strong } from '../helpers/app';

const A = STRINGS.arena;
const text = (id: string) => ({ client: A.client, win: A.win, title: A.cups.names[id], briefing: A.cups.briefing });
const at = (arenaRank: number) => ({ ...strong(done('intro-1', 'intro-2')), arenaRank });
const [bronze, silver, gold] = CUPS;

describe('the arena cups', () => {
  test('are three, each three of the ladder back to back, each opening to a pilot who has beaten its three', () => {
    expect(CUPS.map((c) => c.id)).toEqual(['cup-bronze', 'cup-silver', 'cup-gold']);
    expect(CUPS.map((c) => c.ranks)).toEqual([[1, 2, 3], [5, 6, 7], [8, 9, 10]]);
    expect([2, 3, 6, 7, 9, 10].map((rank) => CUPS.map((c) => cupOpen(at(rank), c)))).toEqual([
      [false, false, false], [true, false, false], [true, false, false], [true, true, false], [true, true, false], [true, true, true],
    ]);
    for (const cup of CUPS) {
      const m = cupMission(at(10), cup, ARENA, text(cup.id));
      expect(m.battles.map((b) => b.enemies)).toEqual(cup.ranks.map((rank) => [`arena-${rank}`]));
      expect(m.battles.every((b) => b.background === 'bg-arena')).toBe(true);
      const mean = cup.ranks.reduce((sum, rank) => sum + ARENA[rank - 1].scale, 0) / 3;
      expect(m.scale).toBeCloseTo(mean * cup.tune, 2);
      expect(takesWingman(m)).toBe(false);
      expect(battleTrack(m, 0, ALL_ENEMIES)).toBe('arena');
      for (const line of m.briefing) expect(line.length).toBeLessThanOrEqual(2 * 59);
    }
  });

  test('pay the purse once and a quarter after, and are kept on record in a save', () => {
    const before = at(3);
    expect(cupPurse(before, bronze)).toBe(2500);
    const won = recordCupWin(before, 'cup-bronze');
    expect(cupWon(won, bronze)).toBe(true);
    expect(cupPurse(won, bronze)).toBe(625);
    expect(recordCupWin(won, 'cup-bronze')).toBe(won);
    expect(isValidState(won, CATALOG)).toBe(true);
    expect(isValidState({ ...won, cups: [5] }, CATALOG)).toBe(false);
    expect(cupWon(fresh(), gold)).toBe(false);
  });

  test.each([['cup-bronze', 'tier2'], ['cup-silver', 'tier4'], ['cup-gold', 'tier6']])('%s can be won with %s, and not as a matter of course', (id, build) => {
    const cup = CUPS.find((c) => c.id === id)!;
    const m = cupMission(at(10), cup, ARENA, text(id));
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const end = playMission(REFERENCE_BUILDS[build], m, ALL_ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: m.scale });
      if (end.outcome === 'victory') wins += 1;
    }
    expect(wins / 12).toBeGreaterThanOrEqual(0.25);
  });
});

describe('a cup in the arena', () => {
  test('is listed under the mirror match, locked until its three are beaten', () => {
    const { app } = inHub(at(3));
    select(app, 'arena');
    expect(ids(app).slice(-3)).toEqual(['cup-bronze', 'cup-silver', 'cup-gold']);
    expect(snap(app).menu.items.slice(-3).map((i) => [i.enabled, i.note])).toEqual([[true, '2500'], [false, A.locked], [false, A.locked]]);
    select(app, 'cup-bronze');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'cup-bronze', reward: 2500 } });
    expect(ids(app)).toEqual(['accept', 'back']);
    press(app, 'cancel');
    expect(snap(app).screen).toBe('arena');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('cup-bronze');
  });

  test('is three battles; winning it pays the purse, puts it on record and earns the medal; the rank on the ladder does not move', () => {
    const { app, store } = inHub(at(3));
    const credits = snap(app).credits;
    select(app, 'arena');
    select(app, 'cup-bronze');
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ index: 0, of: 3, enemies: ['arena-1'] });
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 2500 });
    expect(savedGame(store)).toMatchObject({ cups: ['cup-bronze'], arenaRank: 3 });
    expect(savedGame(store).medals).toContain('cup');
    expect(savedGame(store).credits).toBeGreaterThan(credits);
    press(app, 'confirm');
    app.go('arena');
    expect((snap(app).arena as unknown as { cups: string[] }).cups).toEqual(['cup-bronze']);
    expect(snap(app).menu.items.find((i) => i.id === 'cup-bronze')!.note).toBe('625');
  });

  test('a cup that is not open cannot be entered by its name, and its line says whom to beat first', () => {
    const { app } = inHub(at(3));
    app.openCupBriefing('cup-gold');
    expect(snap(app).screen).toBe('hub');
    app.startMission('cup-gold');
    expect(snap(app).screen).toBe('hub');
    expect(A.cups.locked(ARENA[9].name)).toContain(ARENA[9].name);
  });
});
