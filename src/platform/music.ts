import { SONGS, type SongName } from '../content/songs';

/** What the app may ask for: a song, or the name the menus used when the game had only two loops. */
export type TrackName = SongName | 'menu';

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type Drum = 'kick' | 'snare' | 'hat' | 'open' | 'clap' | 'tick';

/** A pitched instrument: one or two oscillators through a low-pass filter and an envelope. Times are in seconds. */
export interface Tone {
  wave: Wave;
  /** Level of one note at the top of its attack, before the master gain. */
  gain: number;
  attack: number;
  decay: number;
  /** The level a held note settles on, as a share of its peak. Zero makes a pluck. */
  sustain: number;
  release: number;
  /** Cents. Two oscillators this far either side of the pitch instead of one, which is what makes a pad wide. */
  detune?: number;
  /** Low-pass cutoff in hertz. Without it the wave is left raw. */
  cutoff?: number;
  /** Height of the filter's peak at the cutoff, in decibels. */
  resonance?: number;
  /** The filter opens this many times above the cutoff and closes over the decay: the snap of a plucked string. */
  sweep?: number;
  /** Cents of vibrato. It fades in, and only on notes long enough to want it. */
  vibrato?: number;
  /** A sine this many times above the pitch that dies away early. A ratio that is not whole rings like a bell. */
  overtone?: number;
  /** How much of the sound also feeds the song's echo. */
  echo?: number;
}

/** A drum machine. Its voices take hits instead of note names. */
export interface Kit {
  drums: true;
  gain: number;
}

export type Instrument = Tone | Kit;

/**
 * A stretch of a song, written the way a tracker shows it: one token per step and voice. A token is a note
 * name ("A2", "C#4", "Bb3"), "." for a rest or "-" to hold the note before it; a drum voice takes k (kick),
 * s (snare), h (closed hat), o (open hat), c (clap) and t (tick). "|" between bars is ignored.
 */
export interface Pattern {
  steps: number;
  /** One line of tokens per voice, keyed by voice name. A voice without a line rests. A hold never reaches back into the pattern before. */
  lines: Record<string, string>;
}

export interface Song {
  /** Beats per minute. */
  bpm: number;
  /** Steps in a beat: 4 for sixteenths, 3 for a triplet feel. */
  stepsPerBeat: number;
  /** False for a jingle, which plays once and stops. */
  loop: boolean;
  /** The pitch classes the song is written in. The tests hold every note to them, so a typo cannot hide. */
  scale: string[];
  /** Pitch classes outside the scale that are meant: a leading tone, a blue note. */
  accidentals?: string[];
  /** How late every second step comes, as a share of a step. */
  swing?: number;
  /** A feedback delay, shared by the instruments that send to it. */
  echo?: { steps: number; feedback: number };
  instruments: Record<string, Instrument>;
  /** Voice name to instrument name. A voice plays one note at a time, so a chord needs a voice per note. */
  voices: Record<string, string>;
  /** Where a voice sits between the left speaker (-1) and the right (1). */
  pan?: Record<string, number>;
  patterns: Record<string, Pattern>;
  /** Pattern names in the order they are played. */
  order: string[];
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL: Record<string, number> = { '': 0, '#': 1, b: -1 };
const HITS = new Map<string, Drum>([['k', 'kick'], ['s', 'snare'], ['h', 'hat'], ['o', 'open'], ['c', 'clap'], ['t', 'tick']]);

/** The semitone of a pitch class such as "F#" or "Bb": 0 for C up to 11 for B. Null when it is not one. */
export function pitchClass(name: string): number | null {
  const match = /^([A-G])(#|b)?$/.exec(name);
  return match ? (SEMITONE[match[1]] + ACCIDENTAL[match[2] ?? ''] + 12) % 12 : null;
}

/** The MIDI number of a note name such as "A2" or "C#4"; A4 is 69. Null when it is not a note. */
export function noteNumber(name: string): number | null {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  return match ? 12 * (Number(match[3]) + 1) + SEMITONE[match[1]] + ACCIDENTAL[match[2] ?? ''] : null;
}

/** Hertz of a MIDI number in equal temperament, with A4 at 440. */
export const midiFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Hertz of a note name, or null when the name is not a note. */
export function noteFrequency(name: string): number | null {
  const midi = noteNumber(name);
  return midi === null ? null : midiFrequency(midi);
}

export type Token = { kind: 'rest' } | { kind: 'hold' } | { kind: 'note'; midi: number } | { kind: 'hit'; drum: Drum };

/** Reads one token. Drum voices take hits and the others take note names; anything else is null. */
export function parseToken(token: string, drums: boolean): Token | null {
  if (token === '.') return { kind: 'rest' };
  if (token === '-') return { kind: 'hold' };
  if (drums) {
    const drum = HITS.get(token);
    return drum ? { kind: 'hit', drum } : null;
  }
  const midi = noteNumber(token);
  return midi === null ? null : { kind: 'note', midi };
}

/** Splits a voice line into its tokens, one per step. Bar lines are only there for the reader. */
export function lineTokens(text: string): string[] {
  return text.split(/\s+/).filter((token) => token !== '' && token !== '|');
}

/** A note of one voice: the step it starts on, how many steps it lasts, and its pitch or its drum. */
export interface LineNote {
  step: number;
  length: number;
  midi?: number;
  drum?: Drum;
}

/** The notes of one voice line. Throws on a token it does not know and on a hold with nothing to hold. */
export function parseLine(text: string, drums: boolean): LineNote[] {
  const notes: LineNote[] = [];
  let open: LineNote | null = null;
  lineTokens(text).forEach((raw, step) => {
    const token = parseToken(raw, drums);
    if (!token) throw new Error(`unknown token "${raw}" at step ${step}`);
    if (token.kind === 'hold') {
      // A drum hit rings out on its own, so there is never anything to hold in a drum voice.
      if (!open || drums) throw new Error(`the hold at step ${step} has no note before it`);
      open.length++;
      return;
    }
    open = null;
    if (token.kind === 'rest') return;
    open = token.kind === 'note' ? { step, length: 1, midi: token.midi } : { step, length: 1, drum: token.drum };
    notes.push(open);
  });
  return notes;
}

/** A note placed in the song: `step` counts from the start of the song and `voice` is the voice's position. */
export interface SongNote extends LineNote {
  voice: number;
}

/** A song laid out flat, pattern after pattern, ready to be asked what starts on a step. */
export interface CompiledSong {
  song: Song;
  stepSeconds: number;
  /** Steps from the first to the last pattern in the order. */
  steps: number;
  voices: { name: string; instrument: string }[];
  /** For every step of the song, the notes that start on it. */
  starts: SongNote[][];
  /** The longest pattern: no note is longer, because a hold never crosses into the next pattern. */
  longest: number;
}

/** Steps from the start of a song to the end of its last pattern. */
export function songSteps(song: Song): number {
  return song.order.reduce((sum, name) => sum + (song.patterns[name]?.steps ?? 0), 0);
}

/** Seconds a song takes to play through once. */
export function songSeconds(song: Song): number {
  return songSteps(song) * 60 / song.bpm / song.stepsPerBeat;
}

/** Checks a song and lays it out flat. Throws with the pattern and the voice when something is wrong. */
export function compileSong(song: Song): CompiledSong {
  if (!(song.bpm > 0) || !(song.stepsPerBeat > 0)) throw new Error('a song needs a tempo');
  const voices = Object.entries(song.voices).map(([name, instrument]) => {
    if (!song.instruments[instrument]) throw new Error(`voice "${name}" plays an unknown instrument "${instrument}"`);
    return { name, instrument };
  });
  const starts: SongNote[][] = [];
  let longest = 0;
  for (const name of song.order) {
    const pattern = song.patterns[name];
    if (!pattern) throw new Error(`the order names an unknown pattern "${name}"`);
    if (!(pattern.steps > 0)) throw new Error(`pattern "${name}" has no steps`);
    for (const voice of Object.keys(pattern.lines)) {
      if (!(voice in song.voices)) throw new Error(`pattern "${name}" has a line for an unknown voice "${voice}"`);
    }
    const offset = starts.length;
    for (let step = 0; step < pattern.steps; step++) starts.push([]);
    longest = Math.max(longest, pattern.steps);
    voices.forEach((voice, index) => {
      const text = pattern.lines[voice.name];
      if (text === undefined) return;
      try {
        const count = lineTokens(text).length;
        if (count !== pattern.steps) throw new Error(`${count} steps where the pattern has ${pattern.steps}`);
        for (const note of parseLine(text, 'drums' in song.instruments[voice.instrument])) {
          starts[offset + note.step].push({ ...note, step: offset + note.step, voice: index });
        }
      } catch (error) {
        throw new Error(`pattern "${name}", voice "${voice.name}": ${error instanceof Error ? error.message : error}`);
      }
    });
  }
  if (starts.length === 0) throw new Error('a song needs at least one pattern in its order');
  return { song, stepSeconds: 60 / song.bpm / song.stepsPerBeat, steps: starts.length, voices, starts, longest };
}

/**
 * The notes that start on steps `from` up to, not including, `to`. Steps count on past the end of a looping
 * song, and each note comes back with the step it was asked for; a song that plays once has nothing past its end.
 */
export function notesBetween(compiled: CompiledSong, from: number, to: number): SongNote[] {
  const due: SongNote[] = [];
  const end = compiled.song.loop ? to : Math.min(to, compiled.steps);
  for (let step = Math.max(0, from); step < end; step++) {
    for (const note of compiled.starts[step % compiled.steps]) due.push({ ...note, step });
  }
  return due;
}

/** Seconds from the start of a song to a step. Swing delays every second step; the beat itself never moves. */
export function stepTime(compiled: CompiledSong, step: number): number {
  const late = step % 2 === 1 ? compiled.song.swing ?? 0 : 0;
  return (step + late) * compiled.stepSeconds;
}

/** A corner of an envelope: ramp to `level` (0 to 1) so that it is reached `at` seconds after the note began. */
export interface EnvelopePoint {
  at: number;
  level: number;
  curve: 'linear' | 'exponential';
}

/** The quietest level an exponential ramp is sent to; it cannot reach zero. Sixty decibels down. */
const QUIET = 0.001;
/** Shorter ramps than this click. */
const SHORTEST = 0.003;

/**
 * The shape of a note held for `held` seconds: a linear attack, an exponential decay to the sustain level,
 * and a linear release from wherever the note is when it is let go, even in the middle of its attack.
 */
export function envelopePoints(env: Pick<Tone, 'attack' | 'decay' | 'sustain' | 'release'>, held: number): EnvelopePoint[] {
  const attack = Math.max(env.attack, SHORTEST);
  const decay = Math.max(env.decay, SHORTEST);
  const floor = Math.max(env.sustain, QUIET);
  const points: EnvelopePoint[] = [];
  if (held <= attack) {
    points.push({ at: held, level: held / attack, curve: 'linear' });
  } else {
    points.push({ at: attack, level: 1, curve: 'linear' });
    if (held < attack + decay) {
      // An exponential ramp cut short is the same ramp to the level it had reached by then.
      points.push({ at: held, level: floor ** ((held - attack) / decay), curve: 'exponential' });
    } else {
      points.push({ at: attack + decay, level: floor, curve: 'exponential' });
      if (held > attack + decay) points.push({ at: held, level: floor, curve: 'linear' });
    }
  }
  points.push({ at: held + Math.max(env.release, SHORTEST), level: 0, curve: 'linear' });
  return points;
}

/**
 * Music sits well under the sound effects, whose master gain is 0.3. The compressor in front of this gain
 * holds the mix to about full scale at most, so the loudest moment of a song leaves at under 0.2.
 */
export const MASTER_GAIN = 0.18;
/** No note is let through louder than this, whatever a song says. */
export const MAX_NOTE_GAIN = 0.6;
/** An echo that fed back more than this would build up instead of dying away. */
export const MAX_FEEDBACK = 0.7;

/** How far ahead of the clock notes are queued. Frames come far more often, so the queue never runs dry. */
const LOOKAHEAD = 0.25;
/** A song starts this long after it is asked for, so that its first notes are not already late. */
const LEAD_IN = 0.05;
/**
 * Songs that go on from where they were left instead of starting over. The hub song is left and come
 * back to with every briefing; started from the top each time, nobody would hear past its first bars.
 */
const RESUMES: SongName[] = ['hub'];
/** A stopped song is faded out over this long, to cut it short without a click. */
const FADE = 0.06;
/** Vibrato waits this long and takes as long again to reach its depth. */
const VIBRATO_DELAY = 0.2;

/** Something that is making sound, kept so that stopping the song can stop it too. */
interface Sounding {
  source: AudioScheduledSourceNode;
  until: number;
}

/** Where one voice of a playing song plugs in. */
interface Port {
  ctx: AudioContext;
  out: AudioNode;
  send: AudioNode | null;
  live: Sounding[];
}

function run(port: Port, source: AudioScheduledSourceNode, at: number, until: number): void {
  source.start(at);
  source.stop(until);
  port.live.push({ source, until });
}

function playTone(port: Port, tone: Tone, frequency: number, at: number, held: number): void {
  const { ctx } = port;
  const cents = tone.detune ? [-tone.detune, tone.detune] : [0];
  const peak = Math.min(tone.gain, MAX_NOTE_GAIN) / cents.length;
  const amp = ctx.createGain();
  // A gain node starts at 1. Without this a sample or two can slip through at full level before the envelope begins.
  amp.gain.value = 0;
  amp.gain.setValueAtTime(0, at);
  let end = at;
  for (const point of envelopePoints(tone, held)) {
    end = at + point.at;
    if (point.curve === 'exponential') amp.gain.exponentialRampToValueAtTime(Math.max(point.level, QUIET) * peak, end);
    else amp.gain.linearRampToValueAtTime(point.level * peak, end);
  }
  end += 0.02;
  amp.connect(port.out);
  if (port.send) amp.connect(port.send);

  let input: AudioNode = amp;
  if (tone.cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = tone.resonance ?? 0;
    if (tone.sweep) {
      filter.frequency.setValueAtTime(Math.min(tone.cutoff * tone.sweep, 16000), at);
      filter.frequency.exponentialRampToValueAtTime(tone.cutoff, at + tone.attack + tone.decay);
    } else {
      filter.frequency.value = tone.cutoff;
    }
    filter.connect(amp);
    input = filter;
  }
  const pitched = cents.map((offset) => {
    const osc = ctx.createOscillator();
    osc.type = tone.wave;
    osc.frequency.value = frequency;
    osc.detune.value = offset;
    osc.connect(input);
    run(port, osc, at, end);
    return osc;
  });
  if (tone.vibrato && held >= VIBRATO_DELAY * 2) {
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    depth.gain.setValueAtTime(0, at + VIBRATO_DELAY);
    depth.gain.linearRampToValueAtTime(tone.vibrato, at + VIBRATO_DELAY * 2);
    wobble.connect(depth);
    for (const osc of pitched) depth.connect(osc.detune);
    run(port, wobble, at, end);
  }
  if (tone.overtone) {
    const partial = ctx.createOscillator();
    partial.frequency.value = frequency * tone.overtone;
    const level = ctx.createGain();
    level.gain.value = 0.4;
    level.gain.setValueAtTime(0.4, at);
    level.gain.exponentialRampToValueAtTime(0.02, at + Math.max(0.05, tone.decay / 3));
    partial.connect(level);
    level.connect(amp);
    run(port, partial, at, end);
  }
}

/** A burst of filtered noise that dies away: the body of a snare, a hat or a clap. */
function burst(
  port: Port, noise: AudioBuffer | null, at: number, offset: number,
  filter: { type: BiquadFilterType; frequency: number; q: number }, level: number, length: number, flams = 0,
): void {
  if (!noise) return;
  const { ctx } = port;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const shape = ctx.createBiquadFilter();
  shape.type = filter.type;
  shape.frequency.value = filter.frequency;
  shape.Q.value = filter.q;
  const amp = ctx.createGain();
  amp.gain.value = level;
  let start = at;
  // A clap is several hands that do not land together: a few quick bursts before the tail.
  for (let i = 0; i < flams; i++) {
    amp.gain.setValueAtTime(level, start);
    amp.gain.exponentialRampToValueAtTime(level * 0.2, start + 0.011);
    start += 0.011;
  }
  amp.gain.setValueAtTime(level, start);
  amp.gain.exponentialRampToValueAtTime(level * QUIET, start + length);
  source.connect(shape);
  shape.connect(amp);
  amp.connect(port.out);
  // Starting each hit somewhere else in the noise keeps a row of hats from sounding like one sample on repeat.
  source.start(at, offset % 0.5);
  source.stop(start + length + 0.02);
  port.live.push({ source, until: start + length + 0.02 });
}

/** A sine or triangle whose pitch drops as it dies away: a kick, or the shell under a snare. */
function thump(port: Port, wave: Wave, from: number, to: number, drop: number, level: number, length: number, at: number): void {
  const { ctx } = port;
  const body = ctx.createOscillator();
  body.type = wave;
  body.frequency.setValueAtTime(from, at);
  body.frequency.exponentialRampToValueAtTime(to, at + drop);
  const amp = ctx.createGain();
  amp.gain.value = level;
  amp.gain.setValueAtTime(level, at);
  amp.gain.exponentialRampToValueAtTime(level * QUIET, at + length);
  body.connect(amp);
  amp.connect(port.out);
  run(port, body, at, at + length + 0.02);
}

function playDrum(port: Port, kit: Kit, drum: Drum, at: number, accent: number, noise: AudioBuffer | null, offset: number): void {
  const level = Math.min(kit.gain, MAX_NOTE_GAIN);
  switch (drum) {
    case 'kick':
      thump(port, 'sine', 170, 46, 0.11, level, 0.3, at);
      // A sine this low is felt more than heard, and not at all on a small speaker: the click is what says "kick".
      burst(port, noise, at, offset, { type: 'bandpass', frequency: 3000, q: 0.7 }, level * 0.3, 0.012);
      break;
    case 'snare':
      burst(port, noise, at, offset, { type: 'bandpass', frequency: 2400, q: 0.7 }, level * 0.8, 0.18);
      thump(port, 'triangle', 190, 140, 0.06, level * 0.5, 0.1, at);
      break;
    case 'hat':
      burst(port, noise, at, offset, { type: 'highpass', frequency: 7200, q: 0 }, level * 0.4 * accent, 0.045);
      break;
    case 'open':
      burst(port, noise, at, offset, { type: 'highpass', frequency: 6400, q: 0 }, level * 0.35 * accent, 0.22);
      break;
    case 'clap':
      burst(port, noise, at, offset, { type: 'bandpass', frequency: 1250, q: 1.4 }, level * 0.8, 0.17, 2);
      break;
    case 'tick':
      // A dry knock in the range a small speaker is best at: a clock, or a stick on the rim.
      thump(port, 'triangle', 2000, 1400, 0.015, level * 0.6 * accent, 0.04, at);
      break;
  }
}

/** A second of white noise. Seeded, so that a song renders the same way every time. */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2f6e2b1;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = (seed >>> 0) / 0x80000000 - 1;
  }
  return buffer;
}

/** The end of the chain for one audio engine: every song goes through it. */
interface Rig {
  ctx: AudioContext;
  input: AudioNode;
  /** Made on the first drum hit; null when the engine cannot make it. */
  noise?: AudioBuffer | null;
}

interface Playing {
  name: SongName;
  compiled: CompiledSong;
  rig: Rig;
  /** The time on the audio clock of step 0. Every note is placed from here, so timing cannot drift. */
  origin: number;
  /** The first step that has not been queued yet. */
  next: number;
  /** Everything of this song passes through here, so it can be faded out and unplugged as one. */
  bus: GainNode;
  channels: { instrument: Instrument; out: AudioNode; send: AudioNode | null }[];
  nodes: AudioNode[];
  live: Sounding[];
}

function unplug(nodes: AudioNode[]): void {
  for (const node of nodes) {
    try { node.disconnect(); } catch { /* already gone */ }
  }
}

/**
 * Plays one song at a time, quietly. Call `update()` every frame: it queues the notes of the next quarter
 * second on the audio clock. Silent until the audio engine exists, which needs a first input.
 */
export class Music {
  enabled = true;
  private wanted: SongName | null = null;
  private playing: Playing | null = null;
  private rig: Rig | null = null;
  private compiled = new Map<SongName, CompiledSong | null>();
  /** How far into its loop a song was when it was last left, in seconds, for the songs that pick up where they were. */
  private left = new Map<SongName, number>();
  /** Songs that were stopped and are waiting for their fade to end before they are unplugged. */
  private fading: { ctx: AudioContext; nodes: AudioNode[]; until: number }[] = [];

  constructor(private context: () => AudioContext | null, private songs: Partial<Record<SongName, Song>> = SONGS) {}

  /**
   * Switches to a song, or to silence. Asking for the song already chosen changes nothing, so a jingle that
   * has finished stays finished until something else has been asked for in between. "menu" is the old name
   * of the hub song.
   */
  play(name: TrackName | null): void {
    this.wanted = name === 'menu' ? 'hub' : name;
  }

  update(): void {
    try {
      const ctx = this.context();
      if (!ctx) return;
      const wanted = this.enabled ? this.wanted : null;
      if (this.playing && (this.playing.name !== wanted || this.playing.rig.ctx !== ctx)) {
        this.remember(this.playing);
        this.silence(this.playing);
        this.playing = null;
      }
      this.sweep(ctx);
      if (!wanted) return;
      this.playing ??= this.begin(ctx, wanted);
      if (this.playing) this.queue(this.playing, ctx.currentTime);
    } catch {
      // Music is decoration: a failing audio engine must never interrupt the game.
    }
  }

  /** The song laid out flat, or null when it is missing or broken; either way it is only worked out once. */
  private compile(name: SongName): CompiledSong | null {
    let compiled = this.compiled.get(name);
    if (compiled === undefined) {
      const song = this.songs[name];
      try { compiled = song ? compileSong(song) : null; } catch { compiled = null; }
      this.compiled.set(name, compiled);
    }
    return compiled;
  }

  private rigFor(ctx: AudioContext): Rig {
    if (this.rig?.ctx === ctx) return this.rig;
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    let input: AudioNode = master;
    try {
      if (typeof ctx.createDynamicsCompressor === 'function') {
        // Gentle settings: it evens out a mix of many voices and gives a little under the kick.
        const squeeze = ctx.createDynamicsCompressor();
        squeeze.threshold.value = -18;
        squeeze.knee.value = 12;
        squeeze.ratio.value = 4;
        squeeze.attack.value = 0.005;
        squeeze.release.value = 0.2;
        squeeze.connect(master);
        input = squeeze;
      }
    } catch {
      // An engine without a working compressor still plays, only less evenly.
    }
    return (this.rig = { ctx, input });
  }

  private begin(ctx: AudioContext, name: SongName): Playing | null {
    const compiled = this.compile(name);
    if (!compiled) return null;
    const rig = this.rigFor(ctx);
    const { song } = compiled;
    const bus = ctx.createGain();
    const nodes: AudioNode[] = [bus];
    try {
      bus.connect(rig.input);
      const echo = this.delayLine(ctx, compiled, bus, nodes);
      const sends = new Map<string, AudioNode>();
      const channels = compiled.voices.map((voice) => {
        const instrument = song.instruments[voice.instrument];
        let out: AudioNode = bus;
        const pan = song.pan?.[voice.name];
        if (pan && typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.value = pan;
          panner.connect(bus);
          nodes.push(panner);
          out = panner;
        }
        let send = sends.get(voice.instrument) ?? null;
        if (!send && echo && !('drums' in instrument) && instrument.echo) {
          const level = ctx.createGain();
          level.gain.value = instrument.echo;
          level.connect(echo);
          nodes.push(level);
          sends.set(voice.instrument, level);
          send = level;
        }
        return { instrument, out, send };
      });
      // A song that picks up where it was left is laid on the clock as if it had been playing all along:
      // the queue then skips what is behind and brings in the notes still sounding, as it does after a pause.
      const into = RESUMES.includes(name) ? this.left.get(name) ?? 0 : 0;
      return { name, compiled, rig, origin: ctx.currentTime + LEAD_IN - into, next: 0, bus, channels, nodes, live: [] };
    } catch (error) {
      unplug(nodes);
      throw error;
    }
  }

  /** A feedback delay whose repeats fall on the song's steps and get duller as they fade. Null without one. */
  private delayLine(ctx: AudioContext, compiled: CompiledSong, bus: AudioNode, nodes: AudioNode[]): AudioNode | null {
    const { echo } = compiled.song;
    if (!echo || typeof ctx.createDelay !== 'function') return null;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = Math.min(2, echo.steps * compiled.stepSeconds);
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 3400;
    const feedback = ctx.createGain();
    feedback.gain.value = Math.min(echo.feedback, MAX_FEEDBACK);
    delay.connect(dull);
    dull.connect(feedback);
    feedback.connect(delay);
    dull.connect(bus);
    nodes.push(delay, dull, feedback);
    return delay;
  }

  private queue(playing: Playing, now: number): void {
    const { compiled } = playing;
    const elapsed = now - playing.origin;
    // The first step that has not begun yet. After a pause (the app was in the background) this is far past
    // what was queued, and the steps in between are skipped instead of played all at once.
    const due = Math.max(0, Math.ceil(elapsed / compiled.stepSeconds));
    const from = Math.max(playing.next, due);
    const to = Math.floor((elapsed + LOOKAHEAD) / compiled.stepSeconds) + 1;
    if (to <= from) return;
    const notes = notesBetween(compiled, from, to);
    if (from > playing.next) {
      // A note that began in the gap and would still be sounding, such as a pad chord, comes in for what is left of it.
      for (const note of notesBetween(compiled, Math.max(playing.next, from - compiled.longest), from)) {
        const left = note.step + note.length - from;
        const instrument = playing.channels[note.voice].instrument;
        if (left > 1 && !('drums' in instrument) && instrument.sustain > 0) notes.push({ ...note, step: from, length: left });
      }
    }
    // Moved on before anything is built: if building a note fails, it is lost rather than played twice.
    playing.next = to;
    playing.live = playing.live.filter((sounding) => sounding.until > now);
    for (const note of notes) {
      try { this.sound(playing, note); } catch { /* one note less */ }
    }
  }

  private sound(playing: Playing, note: SongNote): void {
    const { compiled, rig } = playing;
    const { instrument, out, send } = playing.channels[note.voice];
    const port: Port = { ctx: rig.ctx, out, send, live: playing.live };
    const at = playing.origin + stepTime(compiled, note.step);
    if ('drums' in instrument) {
      if (!note.drum) return;
      if (rig.noise === undefined) {
        try { rig.noise = makeNoise(rig.ctx); } catch { rig.noise = null; }
      }
      // Hats and ticks on the beat are played full and the ones in between softer, which is what makes a row of them move.
      const beat = compiled.song.stepsPerBeat;
      const accent = note.step % beat === 0 ? 1 : beat % 2 === 0 && note.step % (beat / 2) === 0 ? 0.75 : 0.55;
      playDrum(port, instrument, note.drum, at, accent, rig.noise, note.step * 0.137);
    } else if (note.midi !== undefined) {
      const held = playing.origin + stepTime(compiled, note.step + note.length) - at;
      playTone(port, instrument, midiFrequency(note.midi), at, held);
    }
  }

  /** Notes how far into its loop a song is as it is left. */
  private remember(playing: Playing): void {
    const { compiled, name } = playing;
    if (!compiled.song.loop || !RESUMES.includes(name)) return;
    const length = compiled.steps * compiled.stepSeconds;
    const into = playing.rig.ctx.currentTime - playing.origin;
    this.left.set(name, length > 0 && into > 0 ? into % length : 0);
  }

  /** Fades a song out within a tenth of a second and stops everything it had queued. */
  private silence(playing: Playing): void {
    const { ctx } = playing.rig;
    try {
      const now = ctx.currentTime;
      playing.bus.gain.setValueAtTime(1, now);
      playing.bus.gain.linearRampToValueAtTime(0, now + FADE);
      for (const { source } of playing.live) {
        try { source.stop(now + FADE); } catch { /* it never started */ }
      }
      this.fading.push({ ctx, nodes: playing.nodes, until: now + FADE + 0.02 });
    } catch {
      unplug(playing.nodes);
    }
  }

  /** Unplugs the songs whose fade is over. */
  private sweep(ctx: AudioContext): void {
    if (this.fading.length === 0) return;
    this.fading = this.fading.filter((faded) => {
      if (faded.ctx === ctx && ctx.currentTime < faded.until) return true;
      unplug(faded.nodes);
      return false;
    });
  }
}
