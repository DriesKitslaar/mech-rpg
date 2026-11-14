import { createBattle, applyAction } from '../../src/core/battle';
import { completeMission } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { startMissionBattle } from '../../src/core/mission';
import { feeAfter, takesWingman, wingmanOpen, withWingman } from '../../src/core/wingman';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { WINGMEN } from '../../src/content/wingmen';
import { drillMission } from '../../src/core/training';
import { arenaMission } from '../../src/core/arena';
import { STRINGS } from '../../src/content/strings';
import { BRIEFING_CHARS } from '../../src/ui/briefingScreen';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const did = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
const mission = (id: string) => MISSIONS.find((m) => m.id === id)!;
const [kite, marrow, sixty] = WINGMEN;

describe('pilots for hire', () => {
  test('are three, each dearer and harder-hitting than the last, with a line that fits the briefing', () => {
    expect(WINGMEN.map((w) => w.id)).toEqual(['kite', 'marrow', 'sixty']);
    expect(WINGMEN.map((w) => w.share)).toEqual([0.15, 0.25, 0.35]);
    for (let i = 1; i < WINGMEN.length; i++) expect(WINGMEN[i].damage).toBeGreaterThan(WINGMEN[i - 1].damage);
    for (const w of WINGMEN) {
      expect(w.text.length).toBeLessThanOrEqual(2 * BRIEFING_CHARS);
      expect(w.name.length).toBeLessThanOrEqual(10);
    }
  });

  test('take calls as the story goes on, and all of them once it has started over', () => {
    expect(WINGMEN.map((w) => wingmanOpen(fresh(), w, MISSIONS))).toEqual([false, false, false]);
    expect(WINGMEN.map((w) => wingmanOpen(did('intro-1', 'intro-2'), w, MISSIONS))).toEqual([true, false, false]);
    expect(WINGMEN.map((w) => wingmanOpen(did('intro-1', 'intro-2', 'rival-1', 'choice-lumen'), w, MISSIONS))).toEqual([true, true, true]);
    expect(WINGMEN.map((w) => wingmanOpen({ ...fresh(), cycle: 1 }, w, MISSIONS))).toEqual([true, true, true]);
  });
});

describe('a contract flown with a wingman', () => {
  test('pays the fee less their share, to the credit', () => {
    expect(feeAfter(1300, kite)).toBe(1105);
    expect(feeAfter(1300, sixty)).toBe(845);
    expect(withWingman(mission('undertow-1'), kite).reward).toBe(1105);
    expect(mission('undertow-1').reward).toBe(1300);
  });

  test('has their fire in every battle, and the battles are otherwise the same', () => {
    const flown = withWingman(mission('undertow-1'), marrow);
    expect(flown.battles.map((b) => b.support)).toEqual([{ name: 'Marrow', damage: 28 }, { name: 'Marrow', damage: 28 }]);
    expect(flown.battles.map((b) => b.enemies)).toEqual(mission('undertow-1').battles.map((b) => b.enemies));
    expect(flown.id).toBe('undertow-1');
  });

  test('a battle that already has an ally keeps that ally', () => {
    const allied = MISSIONS.find((m) => m.battles.some((b) => b.support))!;
    const flown = withWingman(allied, kite);
    allied.battles.forEach((b, i) => { if (b.support) expect(flown.battles[i].support).toEqual(b.support); else expect(flown.battles[i].support?.name).toBe('Kite'); });
  });

  test('the wingman fires at the start of every round after the first, at the strongest enemy', () => {
    let s = startMissionBattle(DEMO_BUILD, withWingman(mission('patrol'), sixty), 0, ALL_ENEMIES, CATALOG, 3);
    expect(s.support).toEqual({ name: 'Old Sixty', damage: 40 });
    const seen: unknown[] = [];
    for (let i = 0; i < 12 && s.round === 1 && s.outcome === 'ongoing'; i++) {
      s = applyAction(s, { type: 'endTurn' }, CATALOG);
      seen.push(...s.events.filter((e) => e.type === 'support'));
    }
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0]).toMatchObject({ name: 'Old Sixty' });
    // Without one, nobody fires for the pilot.
    const alone = createBattle(DEMO_BUILD, [ALL_ENEMIES['recon-drone']], CATALOG, 3);
    expect(alone.support).toBeUndefined();
  });

  test('nobody comes along into the arena or the simulator', () => {
    const duel = arenaMission(did('intro-1', 'intro-2'), ARENA[0], { client: 'Arena Office', win: 'Done.' })!;
    expect(takesWingman(duel)).toBe(false);
    expect(withWingman(duel, kite)).toBe(duel);
    const drill = drillMission(fresh(), DRILLS[0], 'Training Simulator');
    expect(takesWingman(drill)).toBe(false);
    expect(takesWingman(mission('patrol'))).toBe(true);
  });

  test('the briefing has words for the choice', () => {
    expect(STRINGS.briefing.wingman).toBe('Wingman');
    expect(STRINGS.briefing.alone).toBe('None');
    expect(STRINGS.briefing.wingmanShare(25)).toBe('-25% fee');
  });
});
