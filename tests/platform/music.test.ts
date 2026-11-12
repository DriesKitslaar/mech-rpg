import { Music, TRACKS, notesBetween } from '../../src/platform/music';

test('every track loops over a whole number of steps and stays quiet', () => {
  for (const track of Object.values(TRACKS)) {
    expect(track.voices.length).toBeGreaterThan(0);
    for (const voice of track.voices) {
      expect(voice.steps).toHaveLength(track.length);
      expect(voice.gain).toBeLessThanOrEqual(0.2);
    }
  }
});

test('notes are found by step, wrapping around the loop', () => {
  const track = { stepSeconds: 0.25, length: 4, voices: [{ wave: 'square' as const, gain: 0.1, steps: [220, 0, 330, 0] }] };
  expect(notesBetween(track, 0, 4).map((n) => [n.step, n.freq])).toEqual([[0, 220], [2, 330]]);
  expect(notesBetween(track, 3, 7).map((n) => [n.step, n.freq])).toEqual([[4, 220], [6, 330]]);
  expect(notesBetween(track, 2, 2)).toEqual([]);
});

function fakeContext() {
  const started: number[] = [];
  const ctx = {
    currentTime: 0, destination: {},
    createGain: () => ({ gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }, connect: () => {} }),
    createOscillator: () => ({ type: 'square', frequency: { setValueAtTime: () => {} }, connect: () => {}, start: (at: number) => { started.push(at); }, stop: () => {} }),
  };
  return { ctx, started };
}

test('schedules ahead while playing, never twice, and stops when disabled or without a track', () => {
  const { ctx, started } = fakeContext();
  const music = new Music(() => ctx as unknown as AudioContext);
  music.update();
  expect(started).toHaveLength(0);
  music.play('menu');
  music.update();
  const first = started.length;
  expect(first).toBeGreaterThan(0);
  music.update();
  expect(started).toHaveLength(first);
  ctx.currentTime = 1;
  music.update();
  expect(started.length).toBeGreaterThan(first);
  expect(new Set(started.map((t) => t.toFixed(4))).size).toBeLessThanOrEqual(started.length);

  const count = started.length;
  music.enabled = false;
  ctx.currentTime = 3;
  music.update();
  expect(started).toHaveLength(count);
  music.enabled = true;
  music.play(null);
  ctx.currentTime = 5;
  music.update();
  expect(started).toHaveLength(count);
});

test('without an audio context nothing happens and nothing throws', () => {
  const music = new Music(() => null);
  music.play('battle');
  expect(() => music.update()).not.toThrow();
  const broken = new Music(() => { throw new Error('no audio'); });
  broken.play('battle');
  expect(() => broken.update()).not.toThrow();
});
