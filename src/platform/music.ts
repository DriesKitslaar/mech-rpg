export type TrackName = 'menu' | 'battle';

/** One instrument line. Each step is a frequency in hertz, or 0 for silence. */
export interface Voice {
  wave: OscillatorType;
  gain: number;
  steps: number[];
}

/** A loop of `length` steps, each `stepSeconds` long. */
export interface Track {
  stepSeconds: number;
  length: number;
  voices: Voice[];
}

const NOTE: Record<string, number> = {
  E2: 82.41, G2: 98, A2: 110, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440,
};
/** Turns "A2 . . E3" into frequencies; a dot is a rest. */
const line = (text: string): number[] => text.trim().split(/\s+/).map((name) => (name === '.' ? 0 : NOTE[name]));

/** Two short loops, synthesised like the sound effects so the game ships no audio files. */
export const TRACKS: Record<TrackName, Track> = {
  // Slow and low: a bass note every bar with a sparse figure above it.
  menu: {
    stepSeconds: 0.32, length: 32,
    voices: [
      { wave: 'triangle', gain: 0.2, steps: line('A2 . . . . . . . F3 . . . . . . . C3 . . . . . . . G2 . . . . . E3 .') },
      { wave: 'square', gain: 0.05, steps: line('. . E4 . A3 . . C4 . . . A3 C4 . . . . . G3 . E4 . . C4 . . D4 . B3 . . .') },
    ],
  },
  // A driving bass with a short alarm-like motif.
  battle: {
    stepSeconds: 0.15, length: 32,
    voices: [
      { wave: 'sawtooth', gain: 0.12, steps: line('E2 . E2 E3 . E2 . E2 E2 . E2 E3 . E2 G2 . A2 . A2 A3 . A2 . A2 G2 . G2 G3 . B2 D3 .') },
      { wave: 'square', gain: 0.05, steps: line('E4 . . . G4 . E4 . . . D4 . E4 . . . A4 . . . G4 . E4 . . . D4 . B3 . D4 .') },
    ],
  },
};

export interface DueNote { step: number; freq: number; voice: Voice }

/** The notes on steps `from` up to, not including, `to`. Steps count on past the end of the loop. */
export function notesBetween(track: Track, from: number, to: number): DueNote[] {
  const due: DueNote[] = [];
  for (let step = from; step < to; step++) {
    for (const voice of track.voices) {
      const freq = voice.steps[step % track.length];
      if (freq > 0) due.push({ step, freq, voice });
    }
  }
  return due;
}

const MASTER = 0.25;
const LOOKAHEAD = 0.25;

/**
 * Plays one loop at a time, quietly. Call `update()` every frame: it queues the notes that fall in
 * the next quarter second. Silent until the audio engine exists, which needs a first input.
 */
export class Music {
  enabled = true;
  private track: TrackName | null = null;
  private running = false;
  private origin = 0;
  private nextStep = 0;

  constructor(private context: () => AudioContext | null) {}

  /** Switches to a loop, or to silence. Asking for the loop already playing changes nothing. */
  play(name: TrackName | null): void {
    if (name === this.track) return;
    this.track = name;
    this.running = false;
  }

  update(): void {
    if (!this.enabled || !this.track) { this.running = false; return; }
    try {
      const ctx = this.context();
      if (!ctx) return;
      const track = TRACKS[this.track];
      if (!this.running) {
        this.running = true;
        this.origin = ctx.currentTime + 0.05;
        this.nextStep = 0;
      }
      const now = ctx.currentTime - this.origin;
      // After a long pause (the app was in the background) skip what was missed instead of playing it all at once.
      const from = Math.max(this.nextStep, Math.floor(now / track.stepSeconds));
      const to = Math.floor((now + LOOKAHEAD) / track.stepSeconds) + 1;
      for (const note of notesBetween(track, from, to)) {
        const at = this.origin + note.step * track.stepSeconds;
        const length = track.stepSeconds * 1.8;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(note.voice.gain * MASTER, at);
        gain.gain.linearRampToValueAtTime(0.0001, at + length);
        gain.connect(ctx.destination);
        const osc = ctx.createOscillator();
        osc.type = note.voice.wave;
        osc.frequency.setValueAtTime(note.freq, at);
        osc.connect(gain);
        osc.start(at);
        osc.stop(at + length + 0.02);
      }
      this.nextStep = Math.max(this.nextStep, to);
    } catch {
      // Music is decoration: a failing audio engine must never interrupt the game.
    }
  }
}
