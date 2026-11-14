import type { BattleEvent } from '../../src/core/battle';
import { SOUNDS, Sfx, soundForInput, soundsForEvent, type SoundName } from '../../src/platform/audio';

const shot = (hit: boolean): BattleEvent => ({
  type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: 'core', appliedTo: 'core', hit, damage: hit ? 38 : 0,
});

test('a hit plays the weapon sound at once and the impact when the projectile lands', () => {
  expect(soundsForEvent(shot(true), 'kinetic', 160)).toEqual([
    { name: 'shotKinetic', delayMs: 0 }, { name: 'hit', delayMs: 160 },
  ]);
});

test('each damage type has its own weapon sound', () => {
  expect(soundsForEvent(shot(false), 'energy', 160)[0].name).toBe('shotEnergy');
  expect(soundsForEvent(shot(false), 'explosive', 260)[0].name).toBe('shotExplosive');
});

test('a miss plays a miss instead of an impact', () => {
  expect(soundsForEvent(shot(false), 'kinetic', 160)[1]).toEqual({ name: 'miss', delayMs: 160 });
});

test.each([
  [{ type: 'partDestroyed', unit: 'enemy-0', part: 'legs' }, 'partDestroyed'],
  [{ type: 'unitDestroyed', unit: 'enemy-0' }, 'unitDestroyed'],
  [{ type: 'boost', unit: 'player' }, 'boost'],
  [{ type: 'cool', unit: 'player', amount: 25 }, 'cool'],
  [{ type: 'turnSkipped', unit: 'player' }, 'cool'],
  [{ type: 'repair', unit: 'player', part: 'core', amount: 10 }, 'repair'],
  [{ type: 'overheat', unit: 'player' }, 'overheat'],
  [{ type: 'outcome', outcome: 'victory' }, 'victory'],
  [{ type: 'outcome', outcome: 'defeat' }, 'defeat'],
] as [BattleEvent, SoundName][])('event %j plays %s', (event, name) => {
  expect(soundsForEvent(event, 'kinetic', 160)).toEqual([{ name, delayMs: 0 }]);
});

test('a turn starting is silent', () => {
  expect(soundsForEvent({ type: 'turnStart', unit: 'player' }, 'kinetic', 160)).toEqual([]);
});

test('menu input maps to move, confirm, cancel or deny', () => {
  expect(soundForInput('down', true)).toBe('move');
  expect(soundForInput('next', true)).toBe('move');
  expect(soundForInput('confirm', true)).toBe('confirm');
  expect(soundForInput('cancel', true)).toBe('cancel');
  expect(soundForInput('confirm', false)).toBe('deny');
  expect(soundForInput('down', false)).toBeNull();
  expect(soundForInput('menu', true)).toBeNull();
});

test('a press on a screen that is not taking input yet is silent, not refused', () => {
  expect(soundForInput('confirm', false, true)).toBeNull();
  expect(soundForInput('confirm', true, true)).toBe('confirm');
  expect(soundForInput('cancel', false, true)).toBeNull();
});

test('every sound has at least one audible tone', () => {
  for (const [name, tones] of Object.entries(SOUNDS)) {
    expect(tones.length, name).toBeGreaterThan(0);
    for (const tone of tones) {
      expect(tone.dur, name).toBeGreaterThan(0);
      expect(tone.gain, name).toBeGreaterThan(0);
      expect(tone.gain, name).toBeLessThanOrEqual(1);
    }
  }
});

/** A stand-in for the browser's audio engine that records what was scheduled. */
function fakeContext() {
  const started: { kind: string; at: number }[] = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 });
  const node = (kind: string) => ({
    connect() { return this; },
    start(at: number) { started.push({ kind, at }); },
    stop() {},
    frequency: param(), gain: param(), type: '', buffer: null as unknown,
  });
  const ctx = {
    currentTime: 10,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    resume: async () => {},
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    createBufferSource: () => node('noise'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { ctx: ctx as unknown as AudioContext, started };
}

test('playing schedules one source per tone, shifted by the delay', () => {
  const { ctx, started } = fakeContext();
  const sfx = new Sfx(() => ctx);
  sfx.unlock();
  sfx.play('confirm', 500);
  expect(started).toHaveLength(SOUNDS.confirm.length);
  expect(started[0].at).toBeCloseTo(10 + 0.5 + SOUNDS.confirm[0].start, 5);
});

test('nothing plays before the first input unlocks audio, or while muted', () => {
  const { ctx, started } = fakeContext();
  const sfx = new Sfx(() => ctx);
  sfx.play('confirm');
  expect(started).toHaveLength(0);
  sfx.unlock();
  sfx.muted = true;
  sfx.play('confirm');
  expect(started).toHaveLength(0);
});

test('a device without audio support stays silent instead of failing', () => {
  const sfx = new Sfx(() => { throw new Error('no audio here'); });
  expect(() => { sfx.unlock(); sfx.play('hit'); }).not.toThrow();
});

test('the events the three-act story added each have a sound of their own', () => {
  const one = (event: Parameters<typeof soundsForEvent>[0]) => soundsForEvent(event, 'kinetic', 160).map((sound) => sound.name);
  expect(one({ type: 'mend', unit: 'enemy-0', target: 'enemy-1', part: 'core', amount: 20 })).toEqual(['mend']);
  expect(one({ type: 'fuse', unit: 'enemy-0', left: 2 })).toEqual(['fuse']);
  expect(one({ type: 'blast', unit: 'enemy-0', target: 'player', damage: 80 })).toEqual(['blast']);
  expect(one({ type: 'launch', unit: 'enemy-0', spawned: 'enemy-1' })).toEqual(['launch']);
  expect(one({ type: 'phase', unit: 'enemy-0', phase: 1 })).toEqual(['alarm']);
  expect(soundsForEvent({ type: 'support', name: 'Ashfall', target: 'enemy-0', damage: 30 }, 'kinetic', 160))
    .toEqual([{ name: 'support', delayMs: 0 }, { name: 'hit', delayMs: 160 }]);
  expect(one({ type: 'asset', hp: 4, lost: 2 })).toEqual(['asset']);
  expect(one({ type: 'asset', hp: 4, lost: 0 })).toEqual([]);
});
