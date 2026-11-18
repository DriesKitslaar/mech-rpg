import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { BattleFlow, BattleScreen } from '../../src/ui/battleScreen';
import { HitStop } from '../../src/ui/hitStop';
import { Particles } from '../../src/ui/particles';
import { Puppet, ShownStance } from '../../src/ui/pose';
import type { SpriteStore } from '../../src/ui/sprites';

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function recorder() {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 }) : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/** Plays a battle on the real screen with the automatic player, and reports what was seen moving. */
function watch(fast: boolean, speed = 1) {
  const ctx = recorder();
  const flow = new BattleFlow(createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, 7), CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast, speed });
  let particles = 0;
  let flashes = 0;
  let broke = 0;
  let wasFlash = false;
  for (let i = 0; i < 20000 && flow.phase !== 'result'; i++) {
    screen.update(16);
    screen.draw(ctx);
    const m = screen.motion;
    particles = Math.max(particles, m.particles);
    if (m.flash > 0 && !wasFlash) flashes += 1;
    wasFlash = m.flash > 0;
    if (flow.state.units.some((u) => u.side === 'enemy' && (m.breaking(u.id) ?? 0) > 0)) broke += 1;
    if (flow.phase === 'action') {
      // Auto Turn: the automatic player takes the whole turn.
      for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'auto'; j++) screen.onInput('down');
      screen.onInput('confirm');
    }
  }
  return { particles, flashes, broke, outcome: flow.state.outcome };
}

describe('the battle screen sets things in motion', () => {
  test('a battle throws particles, and each machine destroyed is held with a flash and seen coming apart', () => {
    const seen = watch(false);
    expect(seen.outcome).toBe('victory');
    expect(seen.particles).toBeGreaterThan(5);
    expect(seen.flashes).toBe(2);
    expect(seen.broke).toBeGreaterThan(10);
  });

  test('with fast battles on the flash is still drawn for each kill', () => {
    expect(watch(false, 2.5).flashes).toBe(2);
  });

  test('in test mode nothing moves at all', () => {
    expect(watch(true)).toMatchObject({ particles: 0, flashes: 0, broke: 0, outcome: 'victory' });
  });
});

describe('a hold', () => {
  test('is drawn for at least one frame however long the frame that struck it', () => {
    const hold = new HitStop();
    hold.strike(36);
    expect(hold.pass(40)).toBe(0);
    expect(hold.flash).toBeGreaterThan(0);
    expect(hold.pass(40)).toBe(4);
    expect(hold.flash).toBe(0);
  });
});

describe('how a unit is shown standing', () => {
  const unit = (over: Partial<{ guarding: boolean; staggered: number; overheated: boolean; destroyed: boolean }> = {}) =>
    ({ id: 'player', destroyed: false, guarding: false, staggered: 0, overheated: false, ...over });

  test('a guard is kept up until the screen reaches the turn that drops it, whatever the rules already say', () => {
    const shown = new ShownStance();
    shown.onEvent({ type: 'guard', unit: 'player' });
    // The rules have moved on to the player's next turn; the screen is still showing the enemy's.
    shown.onEvent({ type: 'blast', unit: 'enemy-0' });
    expect(shown.of('player').guarding).toBe(true);
    shown.onEvent({ type: 'turnStart', unit: 'player' });
    expect(shown.of('player').guarding).toBe(false);
  });

  test('a mech that lost its turn to heat hangs until its next turn starts', () => {
    const shown = new ShownStance();
    shown.onEvent({ type: 'overheat', unit: 'player' });
    shown.onEvent({ type: 'turnSkipped', unit: 'player' });
    shown.sync([unit()]);
    expect(shown.of('player').overheated).toBe(true);
    shown.onEvent({ type: 'turnStart', unit: 'player' });
    expect(shown.of('player').overheated).toBe(false);
  });

  test('a stagger starts with its own message and ends with the recovery', () => {
    const shown = new ShownStance();
    shown.onEvent({ type: 'shot', unit: 'enemy-0' });
    expect(shown.of('player').staggered).toBe(false);
    shown.onEvent({ type: 'stagger', unit: 'player' });
    expect(shown.of('player').staggered).toBe(true);
    shown.onEvent({ type: 'recover', unit: 'player' });
    expect(shown.of('player').staggered).toBe(false);
  });

  test('a machine that loses its nerve looks it from the moment that is said, and not before', () => {
    const shown = new ShownStance();
    // The rules shook it with the shot; the screen is still showing the shot.
    shown.onEvent({ type: 'shot', unit: 'player' });
    shown.onEvent({ type: 'momentum', unit: 'player' });
    expect(shown.of('enemy-2').shaken).toBe(false);
    shown.onEvent({ type: 'shaken', unit: 'enemy-2' });
    expect(shown.of('enemy-2').shaken).toBe(true);
    expect(shown.of('enemy-1').shaken).toBe(false);
    // With everything shown the rules are taken at their word, here too.
    const turret = { id: 'enemy-2', destroyed: false, guarding: false, staggered: 0, overheated: false };
    shown.sync([{ ...turret, shaken: true as const }]);
    expect(shown.of('enemy-2').shaken).toBe(true);
    shown.sync([turret]);
    expect(shown.of('enemy-2').shaken).toBe(false);
    const late = new ShownStance();
    late.sync([{ ...turret, shaken: true as const }]);
    expect(late.of('enemy-2').shaken).toBe(true);
  });

  test('with everything shown the rules are taken at their word, except for a wreck', () => {
    const shown = new ShownStance();
    shown.onEvent({ type: 'guard', unit: 'player' });
    shown.sync([unit({ destroyed: true })]);
    expect(shown.of('player').guarding).toBe(true);
    shown.sync([unit({ staggered: 1 })]);
    expect(shown.of('player')).toMatchObject({ guarding: false, staggered: true });
  });
});

describe('coming apart', () => {
  test('a mech destroyed while it guards breaks up from where it stood, without snapping upright first', () => {
    const puppet = new Puppet(0, true, true);
    const before = puppet.pose({ guarding: true }, 1000);
    puppet.play('destroyed');
    puppet.update(1);
    const after = puppet.pose({ guarding: true }, 1016);
    for (const slot of ['core', 'armFar'] as const) {
      expect(Math.abs((after[slot]?.dx ?? 0) - (before[slot]?.dx ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after[slot]?.dy ?? 0) - (before[slot]?.dy ?? 0))).toBeLessThanOrEqual(1);
    }
  });
});

describe('casings', () => {
  test('thrown from a mech\'s hand reach the ground before they fade', () => {
    const particles = new Particles(3, true);
    for (let i = 0; i < 20; i++) particles.emit('casing', { x: 120, y: 66 }, 1, 0, 172);
    let landed = 0;
    for (let t = 0; t < 1400; t += 16) {
      particles.update(16);
      landed = Math.max(landed, particles.all().filter((p) => p.y >= 171).length);
    }
    expect(landed).toBe(20);
  });
});
