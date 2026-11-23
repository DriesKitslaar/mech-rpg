import { completeMission, cyclePay, cycleStrength, forCycle } from '../../src/core/campaign';
import type { GameState } from '../../src/core/game';
import { tuneCap } from '../../src/core/tuning';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { record } from '../helpers/canvas';
import { fresh, ids, inHub, select, snap } from '../helpers/app';

/** A pilot at the end of a telling of the story: Lumen's war, the audit, a verdict, and every page read. */
function finished(cycle: number): GameState {
  const told = MISSIONS.filter((m) =>
    ['intro', 'faction', 'rival', 'audit'].includes(m.phase) || (['choice', 'path', 'finale'].includes(m.phase) && m.faction === 'lumen') || m.id === 'verdict-default');
  const game = told.reduce((g, m) => completeMission(g, m.id, MISSIONS), fresh());
  return { ...game, cycle, endingSeen: true, scenes: SCENES.map((scene) => scene.id) };
}
const question = (next: number): string[] => STRINGS.hub.cycleQuestion(next);

describe('the question before the story starts over', () => {
  test('says what the cycle that would begin changes: tougher and better paid up to the third telling, a step more at the bench up to the fourth', () => {
    expect(question(1)).toEqual([
      'Start the war again?', 'You keep credits, parts,', 'level, perks and arena rank.',
      // What leaves the list of contracts until the story brings it back.
      'Side work, duels and the', 'Archive start over with it.',
      'Tougher enemies, better pay,', 'one more step at the bench.',
    ]);
    expect(question(2)).toEqual(question(1));
    expect(question(3).slice(5)).toEqual(['Enemies are as tough as now.', 'The bench has one step left.']);
    expect(question(4).slice(5)).toEqual(['Enemies are as tough as now,', 'and the pay is the same.']);
    expect(question(9)).toEqual(question(4));
  });

  test('says no more than is so, whatever the cycle', () => {
    for (let next = 1; next <= 8; next++) {
      const said = question(next).join(' ');
      const tougher = cycleStrength(next) > cycleStrength(next - 1);
      expect(/Tougher enemies, better pay/.test(said), `cycle ${next}`).toBe(tougher);
      expect(/as tough as now/.test(said), `cycle ${next}`).toBe(!tougher);
      expect(cyclePay(next) > cyclePay(next - 1), `cycle ${next}`).toBe(tougher);
      // The bench is spoken of exactly while there is a step to come.
      expect(/bench/.test(said), `cycle ${next}`).toBe(tuneCap(next) > tuneCap(next - 1));
    }
  });

  test.each(['en', 'nl'] as const)('is seven lines that fit the box (%s)', (language) => {
    setLanguage(language);
    try {
      for (let next = 1; next <= 6; next++) {
        expect(question(next)).toHaveLength(7);
        for (const row of question(next)) expect(row.length, row).toBeLessThanOrEqual(30);
      }
      // The first five lines are the same whatever the cycle: what is kept, and what starts over.
      expect(question(5).slice(0, 5)).toEqual(question(1).slice(0, 5));
    } finally {
      setLanguage('en');
    }
  });

  test('the hub asks it for the cycle the pilot would begin', () => {
    const asked = (cycle: number): string[] => {
      const { app } = inHub(finished(cycle));
      expect(ids(app)).toContain('cycle');
      select(app, 'cycle');
      expect(ids(app)).toEqual(['no', 'yes']);
      return record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    };
    expect(asked(0)).toEqual(expect.arrayContaining(question(1)));
    expect(asked(2)).toEqual(expect.arrayContaining(question(3)));
    expect(asked(2)).not.toContain('Tougher enemies, better pay,');
    expect(asked(5)).toEqual(expect.arrayContaining(question(6)));
  });

  test('and the cycle that begins is what was said: a contract of the fourth telling is the contract of the third', () => {
    const { app } = inHub(finished(2));
    select(app, 'cycle');
    select(app, 'yes');
    expect(app.game!.cycle).toBe(3);
    const first = MISSIONS.find((m) => m.id === 'intro-1')!;
    expect(forCycle(first, app.game!.cycle)).toEqual(forCycle(first, 2));
    // The pay the list shows is the third telling's.
    while (snap(app).screen !== 'hub') app.onInput('confirm');
    select(app, 'contracts');
    expect(snap(app).menu.items.find((item) => item.id === 'intro-1')!.note).toBe(String(forCycle(first, 2).reward));
  });
});
