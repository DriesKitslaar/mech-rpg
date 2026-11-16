import { STRINGS } from '../../src/content/strings';
import { accept, done, inHub, press, select, snap, strong } from '../helpers/app';

function texts(app: ReturnType<typeof inHub>['app']): string[] {
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

describe('the ground is said where it matters', () => {
  test('in the briefing, under what the contract asks for', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'patrol');
    expect((snap(app).briefing as unknown as { ground: string[] }).ground).toEqual(['RAIN: all shed 4 more heat a turn']);
    expect(texts(app)).toContain('RAIN: all shed 4 more heat a turn');
  });

  test('on the field, by name, for as long as the battle lasts', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    accept(app, 'patrol');
    expect((snap(app).battle as unknown as { ground: string | null }).ground).toBe('rain');
    expect(texts(app)).toContain(STRINGS.ground.rain.name);
  });

  test('a drill in the simulator is on level ground and says nothing', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'training');
    press(app, 'confirm');
    expect((snap(app).briefing as unknown as { ground: string[] }).ground).toEqual([]);
    select(app, 'accept');
    expect((snap(app).battle as unknown as { ground: string | null }).ground).toBeNull();
  });

  test('the Gauntlet says what ground the floor ahead is on', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'gauntlet');
    select(app, 'start');
    // The floors go round the Gauntlet's places in order: the first is the undercity, which is level; the second the sluice.
    expect((snap(app).gauntlet as { ground: string | null }).ground).toBeNull();
    app.commit({ ...app.game!, gauntlet: { ...app.game!.gauntlet!, floor: 2 } });
    app.go('gauntlet');
    expect((snap(app).gauntlet as { ground: string | null }).ground).toBe('flood');
    expect(texts(app)).toContain('FLOOD WATER');
  });
});
