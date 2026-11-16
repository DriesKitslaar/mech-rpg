import { ELITE_PAY, generateBoard } from '../../src/core/board';
import { BOARD_TEXT } from '../../src/content/board';
import { STRINGS } from '../../src/content/strings';
import { done, finishBattle, inHub, press, select, snap, strong } from '../helpers/app';

/** The first count of battles won, from fifteen on, whose board has an elite contract (or has none). */
const winsWith = (elite: boolean): number => {
  for (let wins = 15; wins < 200; wins++) if (!!generateBoard(wins, 0, BOARD_TEXT)[2].elite === elite) return wins;
  throw new Error('no such board');
};
function written(app: ReturnType<typeof inHub>['app']): string[] {
  const said: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
      : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  app.update(16);
  app.draw(ctx);
  return said;
}

describe('an elite contract on the board', () => {
  test('its briefing says there is an elite, what sets it apart, and pays for it', () => {
    const wins = winsWith(true);
    const mission = generateBoard(wins, 0, BOARD_TEXT)[2];
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins });
    select(app, 'contracts');
    select(app, mission.id);
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: mission.id, reward: mission.reward } });
    const said = written(app);
    expect(said).toContain(STRINGS.briefing.openElite);
    expect(said).not.toContain(STRINGS.briefing.open);
    expect(said.join(' ')).toContain(BOARD_TEXT.elite[mission.elite!]);
    // The same contract without its elite would pay that much less.
    expect(mission.reward).toBeGreaterThan(ELITE_PAY);
  });

  test('the elite stands in the contract\'s last battle, with its mark, and nowhere before', () => {
    const wins = winsWith(true);
    const mission = generateBoard(wins, 0, BOARD_TEXT)[2];
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins });
    select(app, 'contracts');
    select(app, mission.id);
    select(app, 'accept');
    const elites = () => (snap(app).battle as unknown as { elites: { id: string; mark: string }[] }).elites;
    for (let i = 0; i < mission.battles.length - 1; i++) {
      expect(elites()).toEqual([]);
      finishBattle(app);
      expect(snap(app).battle?.outcome).toBe('victory');
      press(app, 'confirm');
    }
    expect(snap(app).battle).toMatchObject({ index: mission.battles.length - 1 });
    expect(elites()).toHaveLength(1);
    expect(elites()[0].mark).toBe(mission.elite);
  });

  test('a contract without one is briefed as it always was', () => {
    const wins = winsWith(false);
    const mission = generateBoard(wins, 0, BOARD_TEXT)[2];
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), battlesWon: wins });
    select(app, 'contracts');
    select(app, mission.id);
    const said = written(app);
    expect(said).toContain(STRINGS.briefing.open);
    expect(said).not.toContain(STRINGS.briefing.openElite);
  });
});
