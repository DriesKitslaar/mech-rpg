import { STRINGS } from '../../src/content/strings';
import { done, finishMission, ids, inHub, press, select, snap, strong } from '../helpers/app';

interface Hire { wingman: { id: string | null; name: string; share: number; open: number } | null; reward: number }
const hire = (app: Parameters<typeof snap>[0]): Hire => snap(app).briefing as unknown as Hire;
const toRow = (app: Parameters<typeof snap>[0], id: string): void => {
  for (let i = 0; i < 6 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
};

describe('hiring a wingman from the briefing', () => {
  test('nobody is for hire before the introductions are done', () => {
    const { app } = inHub(strong(done('intro-1')));
    select(app, 'contracts');
    select(app, 'patrol');
    expect(ids(app)).toEqual(['accept', 'back']);
    expect(hire(app).wingman).toBeNull();
  });

  test('after them the briefing has a row for it, and left and right walk through who takes calls', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'patrol');
    expect(ids(app)).toEqual(['accept', 'wingman', 'back']);
    expect(hire(app)).toMatchObject({ wingman: { id: null, name: STRINGS.briefing.alone, open: 1 }, reward: 400 });
    toRow(app, 'wingman');
    press(app, 'right');
    expect(hire(app)).toMatchObject({ wingman: { id: 'kite', name: 'Kite', share: 15 }, reward: 340 });
    press(app, 'right');
    expect(hire(app).wingman?.id).toBeNull();
    press(app, 'left');
    expect(hire(app).wingman?.id).toBe('kite');
    // Confirming on the row walks on as well, and does not start anything.
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    expect(hire(app).wingman?.id).toBeNull();
  });

  test('the contract is flown with them: they fire, and the fee that is booked is the fee less their share', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    const before = snap(app).credits;
    select(app, 'contracts');
    select(app, 'patrol');
    toRow(app, 'wingman');
    press(app, 'right');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect((snap(app).battle as unknown as { support: string | null }).support).toBe('Kite');
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 340 });
    // A first medal may pay on top.
    expect(snap(app).credits).toBeGreaterThanOrEqual(before + snap(app).settlement!.net);
  });

  test('flown alone the fee is whole and nobody fires for the pilot', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'patrol');
    select(app, 'accept');
    expect((snap(app).battle as unknown as { support: string | null }).support).toBeNull();
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ reward: 400 });
  });

  test('the arena and the simulator have no such row', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'arena');
    press(app, 'confirm');
    if (snap(app).screen === 'briefing') expect(ids(app)).toEqual(['accept', 'back']);
    app.go('training');
    press(app, 'confirm');
    if (snap(app).screen === 'briefing') expect(ids(app)).toEqual(['accept', 'back']);
  });

  test('while an enemy is aimed at, the battle says what it is about to do', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'patrol');
    select(app, 'accept');
    const battle = () => snap(app).battle as unknown as { intent: string | null; phase: string; targetId: string | null };
    for (let i = 0; i < 4000 && battle().phase !== 'target'; i++) {
      // Talk on screen holds a press for a moment; time passes and the press is tried again.
      app.update(16);
      if (battle().phase !== 'animating') press(app, 'confirm');
    }
    expect(battle().phase).toBe('target');
    expect(battle().intent).toMatch(/^(AIMS (CORE|HEAD|LEGS|ARMS)|DARTING|MENDING)$/);
  });
});
