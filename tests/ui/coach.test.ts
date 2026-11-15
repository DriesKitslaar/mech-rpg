import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow, BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { accept, done, inHub, snap, strong } from '../helpers/app';

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function recorder() {
  const said: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
      : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, said };
}
function screenWith(coach: boolean) {
  const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true, coach });
  for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
  const said = () => { const { ctx, said: s } = recorder(); screen.draw(ctx); return s; };
  return { flow, screen, said };
}

describe('a new pilot is told which button does what', () => {
  test('at each step of a turn: choosing what to do, which weapon, and which part', () => {
    const { flow, screen, said } = screenWith(true);
    expect(said()).toContain(STRINGS.coach.action);
    screen.onInput('confirm');
    expect(flow.phase).toBe('weapon');
    expect(said()).toContain(STRINGS.coach.weapon);
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    expect(said()).toContain(STRINGS.coach.target);
    expect(said()).not.toContain(STRINGS.coach.action);
  });

  test('a pilot who knows is told nothing', () => {
    const { screen, said } = screenWith(false);
    const all: string[] = Object.values(STRINGS.coach);
    expect(said().filter((text) => all.includes(text))).toEqual([]);
    screen.onInput('confirm');
    expect(said().filter((text) => all.includes(text))).toEqual([]);
  });

  test('every line fits across the field in small letters', () => {
    for (const line of Object.values(STRINGS.coach)) expect(line.length * 4, line).toBeLessThanOrEqual(300);
  });

  test('it lasts until the introductions are done, and is not said again when the story starts over', () => {
    const coached = (app: Parameters<typeof snap>[0]) => (snap(app).battle as unknown as { coach: boolean }).coach;
    const first = inHub().app;
    accept(first, 'intro-1');
    expect(coached(first)).toBe(true);
    const second = inHub(strong(done('intro-1'))).app;
    accept(second, 'intro-2');
    expect(coached(second)).toBe(true);
    const later = inHub(strong(done('intro-1', 'intro-2'))).app;
    accept(later, 'patrol');
    expect(coached(later)).toBe(false);
    const again = inHub({ ...strong(done()), cycle: 1 }).app;
    accept(again, 'intro-1');
    expect(coached(again)).toBe(false);
  });
});
