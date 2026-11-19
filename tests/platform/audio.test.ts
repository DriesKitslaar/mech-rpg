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
  // A field going out is a hiss; one coming back is heard as a guard going up.
  [{ type: 'fieldDown', unit: 'player' }, 'cool'],
  [{ type: 'fieldUp', unit: 'enemy-0' }, 'guard'],
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
      // A tone that is held ends quieter than it began, and on something.
      if (tone.fade !== undefined) {
        expect(tone.fade, name).toBeGreaterThan(0);
        expect(tone.fade, name).toBeLessThan(tone.gain);
      }
      if (tone.cut !== undefined) expect(tone.cut, name).toBeGreaterThanOrEqual(100);
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

test('a relic has a sound of its own: a low bell that opens upward, nothing like a medal\'s three bright notes', () => {
  const relic = SOUNDS.relic;
  const medal = SOUNDS.medal;
  // The bell: the lowest tone first, a fifth and an octave over it, and something brighter to finish.
  expect(relic.map((tone) => tone.from)).toEqual([147, 220, 294, 587]);
  expect(relic[0]).toMatchObject({ wave: 'triangle', start: 0 });
  expect(relic[0].dur).toBeGreaterThanOrEqual(0.5);
  expect(relic.map((tone) => tone.start)).toEqual([...relic.map((tone) => tone.start)].sort((a, b) => a - b));
  // The medal starts two octaves and more above it, and is over in a third of the time.
  expect(medal[0].from).toBeGreaterThan(relic[0].from * 4);
  expect(relic.map((tone) => tone.from)).not.toEqual(medal.map((tone) => tone.from));
  expect(Math.max(...relic.map((tone) => tone.start + tone.dur))).toBeGreaterThan(Math.max(...medal.map((tone) => tone.start + tone.dur)));
});

// ---- sounds for what is seen ----

/** An engine that also makes filters, and remembers what was plugged into what. */
function filteringContext(state = 'running') {
  const started: { kind: string; at: number }[] = [];
  const filters: { type: string; cut: number }[] = [];
  const wires: [string, string][] = [];
  /** What each tone's loudness was told to die away to, and by when. */
  const fades: { to: number; at: number }[] = [];
  const param = (kind = '') => ({
    setValueAtTime() {}, linearRampToValueAtTime() {}, value: 0,
    exponentialRampToValueAtTime(to: number, at: number) { if (kind === 'gain') fades.push({ to, at }); },
  });
  const node = (kind: string) => ({
    kind,
    connect(to: { kind?: string }) { wires.push([kind, to.kind ?? 'out']); return to; },
    start(at: number) { started.push({ kind, at }); },
    stop() {},
    frequency: param(), gain: param(kind), type: '', buffer: null as unknown,
  });
  const ctx = {
    currentTime: 10, sampleRate: 8000, state, destination: {}, resume: async () => {},
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    createBufferSource: () => node('noise'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBiquadFilter: () => {
      const filter = node('filter');
      const record = { type: '', cut: 0 };
      filters.push(record);
      Object.defineProperty(filter, 'type', { set: (value: string) => { record.type = value; }, get: () => record.type });
      filter.frequency = { ...param(), set value(value: number) { record.cut = value; }, get value() { return record.cut; } };
      return filter;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started, filters, wires, fades };
}
const ends = (name: SoundName): number => Math.max(...SOUNDS[name].map((tone) => tone.start + tone.dur));

test('thunder is a crack and a long roll under it that dies away, and nothing in the game goes on for longer', () => {
  const thunder = SOUNDS.thunder;
  // The crack: bare noise, at once, over in a moment.
  expect(thunder[0]).toMatchObject({ wave: 'noise', start: 0 });
  expect(thunder[0].cut).toBeUndefined();
  expect(thunder[0].dur).toBeLessThan(0.1);
  // The roll: noise with its top taken off, one burst after another, each darker and quieter than the one before.
  const roll = thunder.filter((tone) => tone.wave === 'noise' && tone.cut !== undefined);
  expect(roll.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < roll.length; i++) {
    expect(roll[i].start).toBeGreaterThan(roll[i - 1].start);
    // No gap in it: each burst begins well before the one before has ended, and that one is held until it has.
    expect(roll[i].start).toBeLessThanOrEqual(roll[i - 1].start + roll[i - 1].dur - 0.1);
    expect(roll[i - 1].fade).toBeGreaterThan(0);
    expect(roll[i].cut!).toBeLessThan(roll[i - 1].cut!);
    expect(roll[i].gain).toBeLessThan(roll[i - 1].gain);
  }
  // The last of it dies away to nothing.
  expect(roll.at(-1)!.fade).toBeUndefined();
  expect(roll[0].cut!).toBeLessThanOrEqual(1200);
  // Something low under it all, for whoever has the speakers for it.
  expect(thunder.some((tone) => tone.wave === 'triangle' && tone.from < 100 && tone.dur > 1)).toBe(true);
  expect(ends('thunder')).toBeGreaterThan(1.8);
  expect(ends('thunder')).toBeLessThan(2.2);
  for (const name of Object.keys(SOUNDS) as SoundName[]) if (name !== 'thunder') expect(ends(name), name).toBeLessThan(ends('thunder'));
  // It is weather, not a weapon: its crack, the one bare noise in it, is not as loud as a shell going off.
  expect(thunder[0].gain).toBeLessThan(SOUNDS.blast[0].gain);
});

test('the sign striking is a snap, a buzz and a ring of glass, over in a moment', () => {
  const sign = SOUNDS.sign;
  expect(ends('sign')).toBeLessThan(0.2);
  expect(sign.some((tone) => tone.wave === 'noise' && tone.dur <= 0.04)).toBe(true);
  expect(sign.some((tone) => tone.wave !== 'noise' && tone.from >= 80 && tone.from <= 130)).toBe(true);
  expect(sign.some((tone) => tone.wave === 'triangle' && tone.from >= 2000)).toBe(true);
  // It is heard under a song: quiet.
  expect(Math.max(...sign.map((tone) => tone.gain))).toBeLessThanOrEqual(0.35);
  // And no filter or hold in it: it is as plain as a click.
  expect(sign.every((tone) => tone.cut === undefined && tone.fade === undefined)).toBe(true);
});

test('the slam is low and heavy: lower than a machine going up, and as loud as anything', () => {
  const slam = SOUNDS.slam;
  const lowest = (name: SoundName): number => Math.min(...SOUNDS[name].filter((tone) => tone.wave !== 'noise').map((tone) => Math.min(tone.from, tone.to ?? tone.from)));
  expect(lowest('slam')).toBeLessThanOrEqual(lowest('unitDestroyed'));
  expect(slam.some((tone) => tone.wave === 'noise')).toBe(true);
  expect(Math.max(...slam.map((tone) => tone.gain))).toBeGreaterThanOrEqual(0.7);
  // Short: the machine's own blast is heard after it.
  expect(ends('slam')).toBeLessThanOrEqual(0.5);
  // Its thud is dull, like an iron door: after the first crack nothing of its noise is let through above 600 Hz.
  const thud = slam.filter((tone) => tone.wave === 'noise' && tone.cut !== undefined);
  expect(thud.length).toBeGreaterThanOrEqual(1);
  for (const tone of thud) expect(tone.cut).toBeLessThanOrEqual(600);
  expect(slam.filter((tone) => tone.wave === 'noise' && tone.cut === undefined).every((tone) => tone.dur <= 0.06)).toBe(true);
});

test('no burst of noise in the new sounds is longer than the noise there is', () => {
  for (const name of ['thunder', 'sign', 'slam'] as SoundName[]) {
    for (const tone of SOUNDS[name]) if (tone.wave === 'noise') expect(tone.dur, name).toBeLessThanOrEqual(0.6);
  }
});

test('a tone with a ceiling is played through a filter that takes off what is above it', () => {
  const { ctx, started, filters, wires } = filteringContext();
  const sfx = new Sfx(() => ctx);
  sfx.unlock();
  sfx.play('thunder');
  const capped = SOUNDS.thunder.filter((tone) => tone.cut !== undefined);
  expect(started).toHaveLength(SOUNDS.thunder.length);
  expect(filters).toEqual(capped.map((tone) => ({ type: 'lowpass', cut: tone.cut })));
  // The source goes into the filter and the filter into the tone's own loudness; the others go straight there.
  expect(wires.filter(([from, to]) => from === 'noise' && to === 'filter')).toHaveLength(capped.length);
  expect(wires.filter(([from, to]) => from === 'filter' && to === 'gain')).toHaveLength(capped.length);
  expect(wires.filter(([from, to]) => from !== 'filter' && from !== 'gain' && to === 'gain')).toHaveLength(SOUNDS.thunder.length - capped.length);
  // A sound without one makes no filter.
  sfx.play('confirm');
  expect(filters).toHaveLength(capped.length);
});

test('a tone that is held ends on the loudness it names; the others die away to nothing', () => {
  const { ctx, fades } = filteringContext();
  const sfx = new Sfx(() => ctx);
  sfx.unlock();
  sfx.play('thunder', 250);
  expect(fades).toHaveLength(SOUNDS.thunder.length);
  SOUNDS.thunder.forEach((tone, i) => {
    // 0.3 is how loud all sound effects are let through.
    expect(fades[i].to, `tone ${i}`).toBeCloseTo(tone.fade ? tone.fade * 0.3 : 0.0001, 9);
    expect(fades[i].at, `tone ${i}`).toBeCloseTo(10 + 0.25 + tone.start + tone.dur, 9);
  });
  expect(SOUNDS.thunder.filter((tone) => tone.fade).length).toBeGreaterThanOrEqual(4);
});

test('an engine that makes no filters still plays the sound, with its top left on', () => {
  const { ctx, started } = fakeContext();
  const sfx = new Sfx(() => ctx);
  sfx.unlock();
  sfx.play('thunder');
  expect(started).toHaveLength(SOUNDS.thunder.length);
  // One whose filters fail when they are made, as well.
  const broken = filteringContext();
  (broken.ctx as unknown as { createBiquadFilter: () => never }).createBiquadFilter = () => { throw new Error('no filters'); };
  const other = new Sfx(() => broken.ctx);
  other.unlock();
  other.play('slam');
  expect(broken.started).toHaveLength(SOUNDS.slam.length);
});

test('a sound that belongs to a moment is not kept for later by an engine that is asleep', () => {
  const asleep = filteringContext('suspended');
  const sfx = new Sfx(() => asleep.ctx);
  sfx.unlock();
  // Thunder nobody pressed for: by the time the engine wakes, the lightning is long gone.
  sfx.play('thunder', 380, true);
  sfx.play('sign', 0, true);
  expect(asleep.started).toEqual([]);
  // The answer to a press is kept: the press is what wakes the engine.
  sfx.play('confirm');
  expect(asleep.started).toHaveLength(SOUNDS.confirm.length);
  const awake = filteringContext();
  const other = new Sfx(() => awake.ctx);
  other.unlock();
  other.play('sign', 0, true);
  expect(awake.started).toHaveLength(SOUNDS.sign.length);
  // Not heard with the sound off, or before there is an engine at all.
  other.muted = true;
  other.play('sign', 0, true);
  expect(awake.started).toHaveLength(SOUNDS.sign.length);
  expect(() => new Sfx(() => awake.ctx).play('thunder', 0, true)).not.toThrow();
});
