import { SONGS, type SongName } from '../../src/content/songs';
import {
  MASTER_GAIN, MAX_FEEDBACK, MAX_NOTE_GAIN, Music, compileSong, envelopePoints, lineTokens, noteFrequency, noteNumber,
  notesBetween, parseLine, parseToken, pitchClass, songSeconds, songSteps, stepTime,
  type Song, type Tone, type TrackName,
} from '../../src/platform/music';

// ---- reading songs ----

test('note names become frequencies, with sharps and flats', () => {
  expect(noteFrequency('A4')).toBe(440);
  expect(noteFrequency('A2')).toBeCloseTo(110, 6);
  expect(noteFrequency('C4')).toBeCloseTo(261.63, 2);
  expect(noteFrequency('E2')).toBeCloseTo(82.41, 2);
  expect(noteNumber('A4')).toBe(69);
  expect(noteNumber('C#4')).toBe(noteNumber('Db4'));
  expect(noteNumber('Cb4')).toBe(noteNumber('B3'));
  expect(noteNumber('C4')).toBe(noteNumber('B3')! + 1);
  for (const unknown of ['H2', 'A', 'a4', 'A#', '4A', 'A10', 'k', '.', '']) expect(noteFrequency(unknown), unknown).toBeNull();
});

test('pitch classes count semitones up from C, whatever the spelling', () => {
  expect(['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(pitchClass)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  expect(pitchClass('F#')).toBe(pitchClass('Gb'));
  expect(pitchClass('Cb')).toBe(11);
  expect(pitchClass('A4')).toBeNull();
});

test('a token is a rest, a hold, a note or a drum hit', () => {
  expect(parseToken('.', false)).toEqual({ kind: 'rest' });
  expect(parseToken('-', false)).toEqual({ kind: 'hold' });
  expect(parseToken('A2', false)).toEqual({ kind: 'note', midi: 45 });
  expect(parseToken('Bb3', false)).toEqual({ kind: 'note', midi: 58 });
  expect(['k', 's', 'h', 'o', 'c', 't'].map((hit) => parseToken(hit, true))).toEqual(
    ['kick', 'snare', 'hat', 'open', 'clap', 'tick'].map((drum) => ({ kind: 'hit', drum })),
  );
});

test('a drum voice does not take notes and a pitched voice does not take hits', () => {
  expect(parseToken('A2', true)).toBeNull();
  expect(parseToken('k', false)).toBeNull();
  expect(parseToken('x', true)).toBeNull();
});

test('a voice line becomes notes with the step they start on and how long they last', () => {
  expect(parseLine('A2 - - . | C3 . E3 -', false)).toEqual([
    { step: 0, length: 3, midi: 45 }, { step: 4, length: 1, midi: 48 }, { step: 6, length: 2, midi: 52 },
  ]);
  expect(parseLine('k . s . | h o . c', true)).toEqual([
    { step: 0, length: 1, drum: 'kick' }, { step: 2, length: 1, drum: 'snare' }, { step: 4, length: 1, drum: 'hat' },
    { step: 5, length: 1, drum: 'open' }, { step: 7, length: 1, drum: 'clap' },
  ]);
});

test('bar lines and extra spaces are for the reader and take no steps', () => {
  expect(lineTokens(' A2 -  | . C3 |\n E3 . ')).toEqual(['A2', '-', '.', 'C3', 'E3', '.']);
});

test('a hold with nothing before it is rejected', () => {
  expect(() => parseLine('- A2', false)).toThrow('the hold at step 0 has no note before it');
  expect(() => parseLine('A2 . - .', false)).toThrow('the hold at step 2 has no note before it');
  expect(() => parseLine('k - . .', true)).toThrow('the hold at step 1 has no note before it');
});

test('a token that is neither a note nor a mark is rejected', () => {
  expect(() => parseLine('A2 . X9 .', false)).toThrow('unknown token "X9" at step 2');
  expect(() => parseLine('k . A2 .', true)).toThrow('unknown token "A2" at step 2');
});

const BEEP: Tone = { wave: 'square', gain: 0.1, attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.05 };

/** A one-pattern song at 120 bpm in sixteenths, so a step is an eighth of a second. */
function song(lines: Record<string, string>, extra: Partial<Song> = {}): Song {
  return {
    bpm: 120, stepsPerBeat: 4, loop: true, scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    instruments: { beep: BEEP, kit: { drums: true, gain: 0.5 } },
    voices: { a: 'beep', b: 'beep', drums: 'kit' },
    patterns: { p: { steps: lineTokens(Object.values(lines)[0]).length, lines } },
    order: ['p'],
    ...extra,
  };
}

test('a broken song says which pattern and which voice is wrong', () => {
  expect(() => compileSong(song({ a: 'C4 . X9 .' }))).toThrow('pattern "p", voice "a": unknown token "X9" at step 2');
  expect(() => compileSong(song({ a: 'C4 . . .', b: 'E4 . .' }))).toThrow('pattern "p", voice "b": 3 steps where the pattern has 4');
  expect(() => compileSong(song({ a: 'C4 . . .', b: '. - . .' }))).toThrow('pattern "p", voice "b": the hold at step 1 has no note before it');
  expect(() => compileSong(song({ a: 'C4 . . .', drums: 'k . C4 .' }))).toThrow('pattern "p", voice "drums": unknown token "C4" at step 2');
});

test('a song that names something it does not have is rejected', () => {
  expect(() => compileSong(song({ a: 'C4 .', flute: 'C4 .' }))).toThrow('pattern "p" has a line for an unknown voice "flute"');
  expect(() => compileSong(song({ a: 'C4 .' }, { voices: { a: 'organ' } }))).toThrow('voice "a" plays an unknown instrument "organ"');
  expect(() => compileSong(song({ a: 'C4 .' }, { order: ['p', 'q'] }))).toThrow('the order names an unknown pattern "q"');
  expect(() => compileSong(song({ a: 'C4 .' }, { order: [] }))).toThrow('at least one pattern');
  expect(() => compileSong(song({ a: 'C4 .' }, { bpm: 0 }))).toThrow('tempo');
});

test('notes are found by the step they start on, with their length, wrapping around a loop', () => {
  const compiled = compileSong(song({ a: 'C4 - - . | E4 . G4 -', drums: 'k . . . | s . . .' }));
  const found = (from: number, to: number) => notesBetween(compiled, from, to).map((n) => [n.step, n.length, n.midi ?? n.drum]);
  expect(found(0, 8)).toEqual([[0, 3, 60], [0, 1, 'kick'], [4, 1, 64], [4, 1, 'snare'], [6, 2, 67]]);
  expect(found(1, 4)).toEqual([]);
  expect(found(6, 9)).toEqual([[6, 2, 67], [8, 3, 60], [8, 1, 'kick']]);
  expect(found(20, 21)).toEqual([[20, 1, 64], [20, 1, 'snare']]);
  expect(found(3, 3)).toEqual([]);
});

test('patterns follow each other in the order the song gives', () => {
  const twoPatterns = song({ a: 'C4 .' }, {
    patterns: { p: { steps: 2, lines: { a: 'C4 .' } }, q: { steps: 4, lines: { b: '. E4 - -' } } },
    order: ['p', 'q', 'p'],
  });
  const compiled = compileSong(twoPatterns);
  expect(compiled.steps).toBe(8);
  expect(notesBetween(compiled, 0, 8).map((n) => [n.step, n.length, n.voice, n.midi])).toEqual([[0, 1, 0, 60], [3, 3, 1, 64], [6, 1, 0, 60]]);
});

test('a song that plays once has no notes past its end', () => {
  const compiled = compileSong(song({ a: 'C4 . E4 .' }, { loop: false }));
  expect(notesBetween(compiled, 2, 40).map((n) => n.step)).toEqual([2]);
  expect(notesBetween(compiled, 4, 40)).toEqual([]);
});

test('the length of a song follows from its order, its steps and its tempo', () => {
  const short = song({ a: 'C4 . . . . . . .' }, { order: ['p', 'p', 'p'] });
  expect(songSteps(short)).toBe(24);
  expect(songSeconds(short)).toBeCloseTo(3, 9);
  expect(songSeconds({ ...short, bpm: 60, stepsPerBeat: 3 })).toBeCloseTo(8, 9);
  expect(compileSong(short).stepSeconds).toBeCloseTo(0.125, 9);
});

test('swing delays every second step and leaves the beat where it is', () => {
  const straight = compileSong(song({ a: 'C4 . . .' }));
  const swung = compileSong(song({ a: 'C4 . . .' }, { swing: 0.2 }));
  expect([0, 1, 2, 3, 4].map((step) => stepTime(straight, step))).toEqual([0, 0.125, 0.25, 0.375, 0.5]);
  expect(stepTime(swung, 1)).toBeCloseTo(0.15, 9);
  expect(stepTime(swung, 2)).toBeCloseTo(0.25, 9);
  expect(stepTime(swung, 7)).toBeCloseTo(0.9, 9);
  expect(stepTime(swung, 400)).toBeCloseTo(50, 9);
});

test('an envelope rises, decays to its sustain level and falls away when the note is let go', () => {
  const points = envelopePoints({ attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 }, 1);
  expect(points.map((p) => [p.at, p.level, p.curve])).toEqual([
    [0.1, 1, 'linear'], [expect.closeTo(0.3, 9), 0.5, 'exponential'], [1, 0.5, 'linear'], [1.3, 0, 'linear'],
  ]);
});

test('a note let go during its attack or its decay falls from where it was', () => {
  const env = { attack: 0.1, decay: 0.2, sustain: 0.25, release: 0.3 };
  expect(envelopePoints(env, 0.05)).toEqual([{ at: 0.05, level: 0.5, curve: 'linear' }, { at: 0.35, level: 0, curve: 'linear' }]);
  // Half way through an exponential decay from 1 to a quarter the level is a half.
  const [, cut, gone] = envelopePoints(env, 0.2);
  expect(cut).toEqual({ at: 0.2, level: expect.closeTo(0.5, 9), curve: 'exponential' });
  expect(gone).toEqual({ at: 0.5, level: 0, curve: 'linear' });
});

test('a pluck decays towards silence but never asks an exponential ramp for zero', () => {
  for (const held of [0.01, 0.1, 0.5, 3]) {
    const points = envelopePoints({ attack: 0, decay: 0.2, sustain: 0, release: 0 }, held);
    for (const point of points) {
      if (point.curve === 'exponential') expect(point.level).toBeGreaterThan(0);
      expect(point.level).toBeLessThanOrEqual(1);
    }
    expect(points.at(-1)!.level).toBe(0);
    expect(points.at(-1)!.at).toBeGreaterThan(held);
    expect(points.map((p) => p.at)).toEqual([...points.map((p) => p.at)].sort((a, b) => a - b));
  }
});

// ---- the songs the game ships ----

const ALL = Object.entries(SONGS) as [SongName, Song][];
const LOOPS = ALL.filter(([, s]) => s.loop);
const isKit = (s: Song, voice: string): boolean => 'drums' in s.instruments[s.voices[voice]];
/** Every voice line of a song, with the pattern and the voice it belongs to. */
const linesOf = (s: Song): { pattern: string; steps: number; voice: string; tokens: string[] }[] =>
  Object.entries(s.patterns).flatMap(([pattern, { steps, lines }]) =>
    Object.entries(lines).map(([voice, text]) => ({ pattern, steps, voice, tokens: lineTokens(text) })));

test('the game has its ten songs', () => {
  expect(Object.keys(SONGS).sort()).toEqual(['arena', 'battle', 'battle2', 'boss', 'briefing', 'defeat', 'ending', 'hub', 'title', 'victory']);
});

test.each(ALL)('%s parses', (_name, s) => {
  const compiled = compileSong(s);
  expect(compiled.steps).toBe(songSteps(s));
  expect(compiled.voices.map((v) => v.name)).toEqual(Object.keys(s.voices));
});

test.each(ALL)('every voice line of %s has exactly as many steps as its pattern', (_name, s) => {
  for (const line of linesOf(s)) expect(line.tokens, `${line.pattern}/${line.voice}`).toHaveLength(line.steps);
});

test.each(ALL)('every note name and drum hit in %s is known', (_name, s) => {
  for (const { pattern, voice, tokens } of linesOf(s)) {
    expect(Object.keys(s.voices), `${pattern}/${voice}`).toContain(voice);
    for (const token of tokens) expect(parseToken(token, isKit(s, voice)), `"${token}" in ${pattern}/${voice}`).not.toBeNull();
  }
});

test.each(ALL)('every pitched note of %s lies in the scale the song declares', (_name, s) => {
  const classes = (names: string[]): Set<number> => new Set(names.map((name) => {
    expect(pitchClass(name), `"${name}" is a pitch class`).not.toBeNull();
    return pitchClass(name) ?? -1;
  }));
  const scale = classes(s.scale);
  const meant = classes(s.accidentals ?? []);
  expect(scale.size).toBe(7);
  const used = new Set<number>();
  for (const { pattern, voice, tokens } of linesOf(s)) {
    if (isKit(s, voice)) continue;
    for (const token of tokens) {
      const midi = noteNumber(token);
      if (midi === null) continue;
      used.add(midi % 12);
      expect(scale.has(midi % 12) || meant.has(midi % 12), `${token} in ${pattern}/${voice}`).toBe(true);
    }
  }
  // An exception is a decision, not a licence: each one is outside the scale and is actually played.
  expect(meant.size).toBeLessThanOrEqual(1);
  for (const pitch of meant) {
    expect(scale.has(pitch)).toBe(false);
    expect(used.has(pitch)).toBe(true);
  }
});

test.each(ALL)('no note of %s is too low to hear as a pitch or too high to be pleasant', (_name, s) => {
  for (const { pattern, voice, tokens } of linesOf(s)) {
    for (const token of tokens) {
      const hertz = noteFrequency(token);
      if (hertz === null) continue;
      expect(hertz, `${token} in ${pattern}/${voice}`).toBeGreaterThan(45);
      expect(hertz, `${token} in ${pattern}/${voice}`).toBeLessThan(1000);
    }
  }
});

test.each(ALL)('%s uses every pattern, voice and instrument it defines', (_name, s) => {
  expect(Object.keys(s.patterns).sort()).toEqual([...new Set(s.order)].sort());
  expect(Object.keys(s.instruments).sort()).toEqual([...new Set(Object.values(s.voices))].sort());
  expect([...new Set(linesOf(s).map((line) => line.voice))].sort()).toEqual(Object.keys(s.voices).sort());
  for (const voice of Object.keys(s.pan ?? {})) expect(Object.keys(s.voices)).toContain(voice);
});

test.each(ALL)('the gains of %s stay under the limits', (_name, s) => {
  for (const [name, instrument] of Object.entries(s.instruments)) {
    expect(instrument.gain, name).toBeGreaterThan(0);
    expect(instrument.gain, name).toBeLessThanOrEqual('drums' in instrument ? 0.55 : 0.3);
    expect(instrument.gain, name).toBeLessThanOrEqual(MAX_NOTE_GAIN);
    if (!('drums' in instrument)) {
      expect(instrument.echo ?? 0, name).toBeLessThanOrEqual(0.5);
      expect(instrument.sustain, name).toBeGreaterThanOrEqual(0);
      expect(instrument.sustain, name).toBeLessThanOrEqual(1);
    }
  }
  expect(s.echo?.feedback ?? 0).toBeLessThanOrEqual(0.5);
  expect(s.echo?.feedback ?? 0).toBeLessThan(MAX_FEEDBACK);
  expect(s.swing ?? 0).toBeLessThan(0.5);
  for (const pan of Object.values(s.pan ?? {})) expect(Math.abs(pan)).toBeLessThanOrEqual(1);
  // Even with every voice at its loudest in the same instant and no compressor, the song is at less than
  // half of full scale after the master gain. The other half is room for filter peaks and echoes.
  const together = Object.values(s.voices).reduce((sum, instrument) => sum + s.instruments[instrument].gain, 0);
  expect(together * MASTER_GAIN).toBeLessThan(0.5);
});

test('the master gain keeps music under the sound effects', () => {
  // The sound effects' master gain is 0.3.
  expect(MASTER_GAIN).toBeGreaterThanOrEqual(0.16);
  expect(MASTER_GAIN).toBeLessThanOrEqual(0.2);
});

test.each(LOOPS)('%s runs for at least sixteen whole bars and has more than one section', (_name, s) => {
  const bar = 4 * s.stepsPerBeat;
  expect(songSteps(s) % bar).toBe(0);
  expect(songSteps(s) / bar).toBeGreaterThanOrEqual(16);
  for (const pattern of Object.values(s.patterns)) expect(pattern.steps % bar).toBe(0);
  // Two sections are two stretches whose tune differs, not the same notes with another drum fill.
  const tunes = new Set(Object.values(s.patterns).map((pattern) =>
    Object.entries(pattern.lines).filter(([voice]) => !isKit(s, voice)).map(([voice, text]) => `${voice}:${lineTokens(text).join(' ')}`).sort().join('|')));
  expect(tunes.size).toBeGreaterThanOrEqual(2);
});

test.each(LOOPS)('something sounds in every bar of %s', (_name, s) => {
  const compiled = compileSong(s);
  const bar = 4 * s.stepsPerBeat;
  const sounding = new Set<number>();
  for (const note of compiled.starts.flat()) {
    for (let step = note.step; step < note.step + note.length; step++) sounding.add(Math.floor(step / bar));
  }
  expect(sounding.size).toBe(compiled.steps / bar);
});

test('the looping songs are the eight the game moves between', () => {
  expect(LOOPS.map(([name]) => name).sort()).toEqual(['arena', 'battle', 'battle2', 'boss', 'briefing', 'ending', 'hub', 'title']);
});

test.each(['victory', 'defeat'] as const)('%s plays once and lasts between two and four seconds', (name) => {
  expect(SONGS[name].loop).toBe(false);
  expect(songSeconds(SONGS[name])).toBeGreaterThanOrEqual(2);
  expect(songSeconds(SONGS[name])).toBeLessThanOrEqual(4);
});

test('the battle theme drives: about 130 beats a minute with a note on every sixteenth of the bass', () => {
  const { battle, boss } = SONGS;
  expect(battle.bpm).toBeGreaterThanOrEqual(125);
  expect(battle.bpm).toBeLessThanOrEqual(135);
  expect(battle.stepsPerBeat).toBe(4);
  const bass = linesOf(battle).filter((line) => line.voice === 'bass');
  expect(bass.length).toBeGreaterThan(0);
  for (const line of bass) expect(line.tokens.every((token) => noteNumber(token) !== null), line.pattern).toBe(true);
  expect(boss.bpm).toBeGreaterThan(battle.bpm);
});

test('the two battle themes differ in key and in feel', () => {
  const { battle, battle2 } = SONGS;
  expect(new Set(battle2.scale.map(pitchClass))).not.toEqual(new Set(battle.scale.map(pitchClass)));
  expect(battle2.stepsPerBeat).not.toBe(battle.stepsPerBeat);
});

test('the ending brings back the motif of the title', () => {
  const lead = (s: Song): [number, number][] => {
    const compiled = compileSong(s);
    const voice = compiled.voices.findIndex((v) => v.name === 'lead');
    return compiled.starts.flat().filter((note) => note.voice === voice).map((note) => [note.midi!, note.length]);
  };
  const title = lead(SONGS.title);
  const ending = lead(SONGS.ending);
  // The motif is the first four notes of the title's lead: their intervals and their rhythm, in any key.
  const shape = (notes: [number, number][]): string => notes.map(([midi, length]) => `${midi - notes[0][0]}/${length}`).join(' ');
  const motif = shape(title.slice(0, 4));
  expect(motif).toBe('0/6 -2/6 -4/4 -7/10');
  const heard = ending.map((_, i) => shape(ending.slice(i, i + 4))).filter((candidate) => candidate === motif);
  expect(heard.length).toBeGreaterThanOrEqual(1);
});

// ---- playing ----

interface FakeSource { kind: 'tone' | 'noise'; frequency: number; startsAt: number; stopsAt: number; queuedAt: number }

/**
 * Stands in for the browser's audio engine. It keeps the clock, remembers what was started and stopped, and is
 * as strict as the real one about the values it is given, since the player swallows the errors it would throw.
 */
function fakeAudio(without: string[] = []) {
  const problems: string[] = [];
  const sources: FakeSource[] = [];
  const fades: { calledAt: number; until: number }[] = [];
  const counts = { unplugged: 0 };
  const number = (what: string, ...values: number[]): void => {
    if (values.some((value) => !Number.isFinite(value))) problems.push(`${what} was given ${values.join(', ')}`);
  };
  const param = (initial: number, isGain = false) => {
    let current = initial;
    return {
      get value() { return current; },
      set value(value: number) { number('value', value); current = value; },
      setValueAtTime(value: number, at: number) { number('setValueAtTime', value, at); current = value; },
      linearRampToValueAtTime(value: number, at: number) {
        number('linearRampToValueAtTime', value, at);
        if (isGain && value === 0) fades.push({ calledAt: ctx.currentTime, until: at });
      },
      exponentialRampToValueAtTime(value: number, at: number) {
        number('exponentialRampToValueAtTime', value, at);
        if (!(value > 0)) problems.push(`an exponential ramp cannot end on ${value}`);
      },
    };
  };
  const node = <T extends object>(extra: T) => Object.assign({ connect() {}, disconnect() { counts.unplugged++; } }, extra);
  const source = (kind: FakeSource['kind'], frequency?: ReturnType<typeof param>) => {
    const record: FakeSource = { kind, frequency: 0, startsAt: NaN, stopsAt: Infinity, queuedAt: NaN };
    return node({
      type: 'sine', frequency, detune: param(0), buffer: null as unknown,
      start(at: number) {
        number('start', at);
        if (!Number.isNaN(record.startsAt)) problems.push('a source was started twice');
        Object.assign(record, { startsAt: at, queuedAt: ctx.currentTime, frequency: frequency?.value ?? 0 });
        if (frequency && !(record.frequency > 0 && record.frequency < 20000)) problems.push(`an oscillator at ${record.frequency} Hz`);
        sources.push(record);
      },
      stop(at: number) {
        number('stop', at);
        if (Number.isNaN(record.startsAt)) problems.push('a source was stopped before it was started');
        record.stopsAt = at;
      },
    });
  };
  const ctx: Record<string, unknown> & { currentTime: number } = {
    currentTime: 0, sampleRate: 8000, destination: node({}),
    createGain: () => node({ gain: param(1, true) }),
    createOscillator: () => source('tone', param(440)),
    createBufferSource: () => source('noise'),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createDelay: () => node({ delayTime: param(0) }),
    createDynamicsCompressor: () => node({ threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) }),
    createStereoPanner: () => node({ pan: param(0) }),
  };
  for (const name of without) delete ctx[name];
  return { ctx, context: () => ctx as unknown as AudioContext, sources, fades, problems, counts };
}

type FakeAudio = ReturnType<typeof fakeAudio>;

/** Lets time pass in frames, calling the player on each one like the game loop does. */
function run(audio: FakeAudio, music: Music, seconds: number, fps = 60): void {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    audio.ctx.currentTime += 1 / fps;
    music.update();
  }
}

/** Asks for a song on the first frame, at time zero, so that the times in a test are easy to read. */
function begin(audio: FakeAudio, music: Music, track: TrackName): void {
  music.play(track);
  music.update();
}

const STEP = 0.125;
/** Songs start a twentieth of a second after they are asked for. */
const FIRST = 0.05;
const SCALE = song({ a: 'C4 D4 E4 F4 G4 A4 B4 C5' });
const SCALE_HERTZ = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((name) => noteFrequency(name)!);
/** One note held for two seconds, then two seconds of nothing. */
const DRONE = song({ a: `C3${' -'.repeat(15)}${' .'.repeat(16)}` });

test('nothing is queued before a song is asked for', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  run(audio, music, 1);
  expect(audio.sources).toHaveLength(0);
});

test('notes are queued about a quarter of a second ahead of the clock', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  music.play('battle');
  music.update();
  expect(audio.sources.map((s) => s.startsAt)).toEqual([FIRST, FIRST + STEP]);
  music.update();
  expect(audio.sources).toHaveLength(2);
  for (let frame = 0; frame < 300; frame++) {
    audio.ctx.currentTime += 1 / 60;
    music.update();
    const furthest = Math.max(...audio.sources.map((s) => s.startsAt));
    expect(furthest).toBeGreaterThan(audio.ctx.currentTime + 0.1);
    expect(furthest).toBeLessThan(audio.ctx.currentTime + 0.25 + STEP);
  }
  expect(audio.problems).toEqual([]);
});

test('every note is queued once, on a grid that starts where the song did and does not drift', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  begin(audio, music, 'battle');
  run(audio, music, 30, 47);
  expect(audio.sources.length).toBeGreaterThan(230);
  audio.sources.forEach((s, index) => {
    expect(s.startsAt).toBeCloseTo(FIRST + index * STEP, 9);
    expect(s.startsAt).toBeGreaterThanOrEqual(s.queuedAt);
  });
});

test('a looping song starts again from the top when it reaches its end', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  begin(audio, music, 'battle');
  run(audio, music, 3);
  const played = audio.sources.map((s) => s.frequency);
  expect(played.length).toBeGreaterThanOrEqual(24);
  played.forEach((hertz, index) => expect(hertz).toBeCloseTo(SCALE_HERTZ[index % 8], 6));
});

test('after a long pause it skips what was missed instead of playing it all at once', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  begin(audio, music, 'battle');
  run(audio, music, 1);
  const before = audio.sources.length;
  audio.ctx.currentTime += 60;
  music.update();
  const burst = audio.sources.slice(before);
  expect(burst.length).toBeGreaterThanOrEqual(1);
  expect(burst.length).toBeLessThanOrEqual(3);
  for (const s of burst) {
    expect(s.startsAt).toBeGreaterThanOrEqual(audio.ctx.currentTime);
    // Still on the beat the song started on, a minute ago.
    const steps = (s.startsAt - FIRST) / STEP;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    expect(s.frequency).toBeCloseTo(SCALE_HERTZ[Math.round(steps) % 8], 6);
  }
  run(audio, music, 1);
  const times = audio.sources.slice(before).map((s) => s.startsAt);
  expect(new Set(times.map((at) => at.toFixed(6))).size).toBe(times.length);
  expect(times.length).toBeGreaterThanOrEqual(8);
  expect(times.length).toBeLessThanOrEqual(11);
});

test('a note that was being held when the pause ended comes back for what is left of it', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: DRONE });
  begin(audio, music, 'battle');
  run(audio, music, 0.5);
  expect(audio.sources).toHaveLength(1);
  // The song is four seconds long. Five seconds in, its second drone has a second left to sound.
  audio.ctx.currentTime = 4.95;
  music.update();
  expect(audio.sources).toHaveLength(2);
  const resumed = audio.sources[1];
  expect(resumed.frequency).toBeCloseTo(noteFrequency('C3')!, 6);
  expect(resumed.startsAt).toBeCloseTo(FIRST + 5, 9);
  expect(resumed.stopsAt).toBeGreaterThan(FIRST + 6);
  expect(resumed.stopsAt).toBeLessThan(FIRST + 6.2);
  // Where the pause ends in the silent half of the song, nothing is brought back.
  audio.ctx.currentTime = 22.5;
  music.update();
  expect(audio.sources).toHaveLength(2);
});

test('a song that plays once stops at its end', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { victory: song({ a: 'C4 E4 G4 C5' }, { loop: false }) });
  begin(audio, music, 'victory');
  run(audio, music, 3);
  expect(audio.sources.map((s) => s.startsAt)).toEqual([0, 1, 2, 3].map((step) => expect.closeTo(FIRST + step * STEP, 9)));
});

test('asking again for a jingle that has finished does not restart it, but asking after something else does', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { victory: song({ a: 'C4 E4 G4 C5' }, { loop: false }), battle: SCALE });
  music.play('victory');
  run(audio, music, 2);
  music.play('victory');
  run(audio, music, 2);
  expect(audio.sources).toHaveLength(4);
  music.play(null);
  run(audio, music, 0.5);
  music.play('victory');
  run(audio, music, 2);
  expect(audio.sources).toHaveLength(8);
});

/** The fades to nothing that were asked for at `now` and are over within a tenth of a second: a song being cut. */
const cuts = (audio: FakeAudio, now: number): number =>
  audio.fades.filter((fade) => fade.calledAt === now && fade.until > now && fade.until <= now + 0.1).length;

/** After the song was told to stop at `now`: it fades within a tenth of a second and nothing is left running. */
function expectQuiet(audio: FakeAudio, now: number): void {
  expect(cuts(audio, now)).toBe(1);
  expect(audio.fades.filter((fade) => fade.calledAt === now)).toHaveLength(1);
  for (const s of audio.sources) expect(s.stopsAt).toBeLessThanOrEqual(now + 0.1);
}

test('turning the music off fades it out within a tenth of a second and queues nothing more', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: DRONE });
  music.play('battle');
  run(audio, music, 1);
  expect(audio.sources[0].stopsAt).toBeGreaterThan(2);
  music.enabled = false;
  music.update();
  expectQuiet(audio, audio.ctx.currentTime);
  const unplugged = audio.counts.unplugged;
  run(audio, music, 5);
  expect(audio.sources).toHaveLength(1);
  // Once the fade is over the song's nodes are taken out of the graph.
  expect(audio.counts.unplugged).toBeGreaterThan(unplugged);
});

test('turning the music back on starts the song from the top', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  music.play('battle');
  run(audio, music, 0.6);
  music.enabled = false;
  run(audio, music, 1);
  const before = audio.sources.length;
  music.enabled = true;
  music.update();
  const again = audio.sources.slice(before);
  expect(again.map((s) => s.frequency)).toEqual([SCALE_HERTZ[0], SCALE_HERTZ[1]].map((hertz) => expect.closeTo(hertz, 6)));
  expect(again[0].startsAt).toBeCloseTo(audio.ctx.currentTime + FIRST, 9);
});

test('switching to silence fades the song out within a tenth of a second', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: DRONE });
  music.play('battle');
  run(audio, music, 1);
  music.play(null);
  music.update();
  expectQuiet(audio, audio.ctx.currentTime);
  run(audio, music, 5);
  expect(audio.sources).toHaveLength(1);
});

test('switching songs cuts the old one short and starts the new one at once', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: DRONE, hub: SCALE });
  music.play('battle');
  run(audio, music, 1);
  music.play('hub');
  music.update();
  const now = audio.ctx.currentTime;
  expect(cuts(audio, now)).toBe(1);
  expect(audio.sources[0].stopsAt).toBeLessThanOrEqual(now + 0.1);
  const fresh = audio.sources.slice(1);
  expect(fresh.map((s) => s.startsAt)).toEqual([expect.closeTo(now + FIRST, 9), expect.closeTo(now + FIRST + STEP, 9)]);
  run(audio, music, 2);
  expect(audio.sources.slice(1).every((s) => SCALE_HERTZ.some((hertz) => Math.abs(hertz - s.frequency) < 1e-6))).toBe(true);
});

test('the hub song goes on from where it was left, so coming back from a briefing does not start it over', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { hub: SCALE, briefing: DRONE });
  begin(audio, music, 'hub');
  // Left in the middle of its fourth note.
  run(audio, music, 0.05 + 3 * STEP + 0.02);
  music.play('briefing');
  run(audio, music, 2);
  const before = audio.sources.length;
  music.play('hub');
  music.update();
  const now = audio.ctx.currentTime;
  const back = audio.sources.slice(before);
  // It picks up at the note it was on, not at the first; nothing is queued in the past or all at once.
  expect(back.length).toBeGreaterThanOrEqual(1);
  expect(back.length).toBeLessThanOrEqual(4);
  expect(Math.abs(back[0].frequency - SCALE_HERTZ[0])).toBeGreaterThan(1);
  expect(SCALE_HERTZ.slice(3, 6).some((hertz) => Math.abs(hertz - back[0].frequency) < 1e-6)).toBe(true);
  for (const s of back) expect(s.startsAt).toBeGreaterThanOrEqual(now - 1e-9);
  // And from there it runs on its grid as ever.
  run(audio, music, 2);
  const later = audio.sources.slice(before).filter((s) => SCALE_HERTZ.some((hertz) => Math.abs(hertz - s.frequency) < 1e-6));
  for (let i = 1; i < later.length; i++) expect(later[i].startsAt - later[i - 1].startsAt).toBeCloseTo(STEP, 9);
  expect(audio.problems).toEqual([]);
});

test('a battle song always starts from the top, however often it is left and come back to', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE, hub: DRONE });
  begin(audio, music, 'battle');
  run(audio, music, 0.05 + 3 * STEP + 0.02);
  music.play('hub');
  run(audio, music, 1);
  const before = audio.sources.length;
  music.play('battle');
  music.update();
  const back = audio.sources.slice(before);
  expect(back[0].frequency).toBeCloseTo(SCALE_HERTZ[0], 6);
  expect(back[0].startsAt).toBeCloseTo(audio.ctx.currentTime + FIRST, 9);
});

test('asking for the song that is already playing changes nothing', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: SCALE });
  begin(audio, music, 'battle');
  run(audio, music, 1);
  music.play('battle');
  run(audio, music, 1);
  // The only ramps to nothing are the ends of the notes themselves: the song was never cut.
  expect(audio.fades).toHaveLength(audio.sources.length);
  audio.sources.forEach((s, index) => expect(s.startsAt).toBeCloseTo(FIRST + index * STEP, 9));
});

test('a song waits for the audio engine and starts from the top when it arrives', () => {
  const audio = fakeAudio();
  let unlocked = false;
  const music = new Music(() => (unlocked ? audio.context() : null), { battle: SCALE });
  music.play('battle');
  run(audio, music, 2);
  expect(audio.sources).toHaveLength(0);
  unlocked = true;
  music.update();
  expect(audio.sources.map((s) => s.startsAt)).toEqual([audio.ctx.currentTime + FIRST, audio.ctx.currentTime + FIRST + STEP]);
});

test('without an audio engine nothing happens and nothing throws', () => {
  const silent = new Music(() => null);
  silent.play('battle');
  expect(() => silent.update()).not.toThrow();
  const broken = new Music(() => { throw new Error('no audio'); });
  broken.play('battle');
  expect(() => broken.update()).not.toThrow();
  expect(() => broken.play(null)).not.toThrow();
});

test('an audio engine that fails on every call never throws out of the player', () => {
  const dead = new Proxy({}, { get: (_target, key) => (key === 'currentTime' ? 0 : () => { throw new Error('dead'); }) });
  const music = new Music(() => dead as unknown as AudioContext);
  for (const track of ['title', 'battle', 'victory', null, 'menu'] as const) {
    expect(() => { music.play(track); music.update(); music.update(); }).not.toThrow();
  }
  expect(() => { music.enabled = false; music.update(); music.enabled = true; music.update(); }).not.toThrow();
});

test('a song the player does not have, or one that is broken, is silence rather than an error', () => {
  const audio = fakeAudio();
  const music = new Music(audio.context, { battle: song({ a: '- C4' }) });
  music.play('battle');
  expect(() => run(audio, music, 1)).not.toThrow();
  music.play('boss');
  expect(() => run(audio, music, 1)).not.toThrow();
  expect(audio.sources).toHaveLength(0);
});

test('an engine without a compressor, a panner or a delay still plays', () => {
  const audio = fakeAudio(['createDynamicsCompressor', 'createStereoPanner', 'createDelay']);
  const music = new Music(audio.context);
  music.play('title');
  run(audio, music, 30, 30);
  expect(audio.sources.length).toBeGreaterThan(100);
  expect(audio.problems).toEqual([]);
});

test('an engine that cannot make noise still plays the pitched voices and the kick', () => {
  const audio = fakeAudio(['createBuffer']);
  const music = new Music(audio.context);
  music.play('battle');
  run(audio, music, 4, 30);
  expect(audio.sources.length).toBeGreaterThan(50);
  expect(audio.sources.every((s) => s.kind === 'tone')).toBe(true);
});

test("the names the app uses today still work: 'menu' is the hub song and 'battle' the first battle theme", () => {
  // What the app asks of the music player; it must keep compiling against the new one.
  const control: { enabled: boolean; play(track: 'menu' | 'battle' | null): void } = new Music(() => null);
  expect(control.enabled).toBe(true);
  const queued = (track: TrackName): string[] => {
    const audio = fakeAudio();
    const music = new Music(audio.context);
    music.play(track);
    run(audio, music, 3, 30);
    return audio.sources.map((s) => `${s.kind} ${s.frequency.toFixed(2)} at ${s.startsAt.toFixed(4)}`);
  };
  expect(queued('menu').length).toBeGreaterThan(0);
  expect(queued('menu')).toEqual(queued('hub'));
  expect(queued('battle').length).toBeGreaterThan(queued('menu').length);
  expect(queued('battle')).not.toEqual(queued('battle2'));
});

test.each(ALL)('%s plays through a strict audio engine without a single bad value', (name, s) => {
  const audio = fakeAudio();
  const music = new Music(audio.context);
  music.play(name);
  const seconds = Math.min(songSeconds(s) + 1, 40);
  run(audio, music, seconds, 30);
  expect(audio.problems).toEqual([]);
  // Every note makes at least one sound: nothing was dropped on the way.
  const compiled = compileSong(s);
  const stepsPlayed = Math.floor((seconds - 0.5) / compiled.stepSeconds);
  expect(audio.sources.length).toBeGreaterThanOrEqual(notesBetween(compiled, 0, stepsPlayed).length);
  for (const source of audio.sources) {
    expect(source.startsAt).toBeGreaterThanOrEqual(source.queuedAt);
    expect(source.stopsAt).toBeGreaterThan(source.startsAt);
    expect(source.stopsAt).toBeLessThan(source.startsAt + 30);
  }
});
