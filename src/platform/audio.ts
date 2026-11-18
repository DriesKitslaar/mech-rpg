import type { BattleEvent } from '../core/battle';
import type { DamageType } from '../core/types';
import type { InputAction } from './input';

export type SoundName =
  | 'move' | 'confirm' | 'cancel' | 'deny'
  | 'shotKinetic' | 'shotEnergy' | 'shotExplosive' | 'hit' | 'miss'
  | 'partDestroyed' | 'unitDestroyed' | 'boost' | 'cool' | 'repair' | 'overheat' | 'victory' | 'defeat'
  | 'guard' | 'stagger' | 'charge' | 'module'
  | 'type' | 'blast' | 'launch' | 'mend' | 'alarm' | 'support' | 'fuse' | 'asset' | 'stamp' | 'banner' | 'warning' | 'medal' | 'entry' | 'overdrive' | 'radio' | 'relic'
  | 'thunder' | 'sign' | 'slam' | 'ready' | 'chain2' | 'chain3';

/** One synthesised note or burst. Times are in seconds, frequencies in hertz. */
export interface Tone {
  wave: 'square' | 'sawtooth' | 'triangle' | 'noise';
  from: number;
  /** Glide to this frequency over the tone; omitted means a steady pitch. */
  to?: number;
  start: number;
  dur: number;
  gain: number;
  /** Everything of this tone above so many hertz is taken off: what is left sounds dark, or far away. Omitted, nothing is. */
  cut?: number;
  /** How loud the tone still is when it ends. Omitted, it dies away to nothing; with it, it is held, for something else to take over from. */
  fade?: number;
}

const t = (wave: Tone['wave'], from: number, start: number, dur: number, gain: number, to?: number): Tone =>
  ({ wave, from, to, start, dur, gain });
/**
 * A burst of noise with its top taken off, held to the loudness it ends on. Taking the top off
 * takes most of a noise's power with it, so these are given more to start with than a bare noise.
 */
const dark = (start: number, dur: number, gain: number, cut: number, fade?: number): Tone =>
  ({ wave: 'noise', from: 0, start, dur, gain, cut, ...(fade ? { fade } : {}) });

/** Every sound is built from a few tones, so the game ships no audio files. */
export const SOUNDS: Record<SoundName, Tone[]> = {
  move: [t('square', 660, 0, 0.03, 0.25)],
  confirm: [t('square', 880, 0, 0.05, 0.3), t('square', 1320, 0.05, 0.07, 0.3)],
  cancel: [t('square', 440, 0, 0.05, 0.25), t('square', 330, 0.05, 0.07, 0.25)],
  deny: [t('sawtooth', 140, 0, 0.12, 0.3)],
  shotKinetic: [t('noise', 0, 0, 0.05, 0.5), t('noise', 0, 0.06, 0.05, 0.45), t('noise', 0, 0.12, 0.05, 0.4), t('square', 220, 0, 0.04, 0.2, 110)],
  shotEnergy: [t('sawtooth', 1400, 0, 0.18, 0.3, 320), t('triangle', 2200, 0, 0.1, 0.2, 900)],
  shotExplosive: [t('noise', 0, 0, 0.16, 0.6), t('triangle', 160, 0, 0.2, 0.5, 55)],
  hit: [t('noise', 0, 0, 0.1, 0.55), t('square', 190, 0, 0.1, 0.3, 80)],
  miss: [t('noise', 0, 0, 0.14, 0.12)],
  partDestroyed: [t('noise', 0, 0, 0.08, 0.5), t('noise', 0, 0.1, 0.08, 0.4), t('sawtooth', 300, 0, 0.2, 0.25, 70)],
  unitDestroyed: [t('noise', 0, 0, 0.5, 0.7), t('triangle', 120, 0, 0.5, 0.6, 35)],
  boost: [t('sawtooth', 180, 0, 0.28, 0.3, 720), t('noise', 0, 0, 0.28, 0.2)],
  guard: [t('square', 150, 0, 0.08, 0.35, 110), t('noise', 0, 0, 0.1, 0.25), t('triangle', 300, 0.08, 0.12, 0.25)],
  stagger: [t('sawtooth', 620, 0, 0.3, 0.35, 90), t('noise', 0, 0, 0.22, 0.4), t('square', 110, 0.12, 0.2, 0.3, 60)],
  charge: [t('sawtooth', 160, 0, 0.5, 0.25, 960), t('triangle', 320, 0.1, 0.4, 0.2, 1400)],
  module: [t('triangle', 660, 0, 0.07, 0.3), t('triangle', 990, 0.07, 0.07, 0.3), t('triangle', 1320, 0.14, 0.14, 0.3)],
  cool: [t('noise', 0, 0, 0.45, 0.25)],
  // A letter appearing: barely there.
  type: [t('square', 1500, 0, 0.012, 0.08)],
  // A bomb going off: longer and lower than a destroyed unit.
  blast: [t('noise', 0, 0, 0.7, 0.8), t('triangle', 90, 0, 0.7, 0.7, 28), t('sawtooth', 220, 0, 0.25, 0.3, 60)],
  // A unit leaving a launch bay.
  launch: [t('noise', 0, 0, 0.12, 0.3), t('sawtooth', 240, 0, 0.3, 0.25, 900)],
  // Welding: two bright stutters.
  mend: [t('square', 980, 0, 0.04, 0.2), t('noise', 0, 0.02, 0.08, 0.25), t('square', 1240, 0.1, 0.05, 0.2), t('noise', 0, 0.12, 0.08, 0.2)],
  // A boss changing its ways: a two-tone siren.
  alarm: [t('square', 440, 0, 0.16, 0.3), t('square', 587, 0.16, 0.16, 0.3), t('square', 440, 0.32, 0.16, 0.3), t('square', 587, 0.48, 0.2, 0.3)],
  // Fire from off the field: a long falling whistle, then the caller hears the hit.
  support: [t('sawtooth', 1900, 0, 0.16, 0.25, 500), t('triangle', 2600, 0, 0.1, 0.15, 1200)],
  // A fuse burning down a notch.
  fuse: [t('square', 1047, 0, 0.05, 0.25), t('square', 1047, 0.1, 0.05, 0.25)],
  // Something the pilot was meant to keep safe taking damage.
  asset: [t('triangle', 196, 0, 0.18, 0.4, 130), t('noise', 0, 0, 0.1, 0.2)],
  // The rank coming down on the settlement.
  stamp: [t('noise', 0, 0, 0.06, 0.6), t('triangle', 110, 0, 0.16, 0.6, 55), t('square', 660, 0.08, 0.1, 0.2)],
  // The banner that opens a battle.
  banner: [t('noise', 0, 0, 0.22, 0.18), t('triangle', 330, 0, 0.22, 0.2, 660)],
  // The warning that opens a battle with a boss.
  warning: [t('sawtooth', 311, 0, 0.22, 0.3), t('sawtooth', 311, 0.3, 0.22, 0.3), t('sawtooth', 311, 0.6, 0.3, 0.3), t('square', 155, 0, 0.9, 0.15)],
  // An Overdrive going off: everything winds up at once and rings.
  overdrive: [t('sawtooth', 220, 0, 0.32, 0.3, 880), t('square', 440, 0.04, 0.28, 0.2, 1320), t('noise', 0, 0, 0.14, 0.25), t('triangle', 1320, 0.3, 0.3, 0.3)],
  // The wingman keying the radio: a click of static and two short tones.
  radio: [t('noise', 0, 0, 0.03, 0.12), t('square', 1175, 0.03, 0.04, 0.1), t('square', 1568, 0.08, 0.05, 0.1)],
  // A relic taken in the Gauntlet: a low bell, and a fifth and an octave opening over it.
  relic: [t('triangle', 147, 0, 0.6, 0.3), t('triangle', 220, 0.06, 0.5, 0.22), t('triangle', 294, 0.14, 0.55, 0.22), t('square', 587, 0.28, 0.3, 0.1)],
  // Thunder, some way off: a crack, something tearing, and a roll that goes on under it and dies away, each burst darker than the last.
  thunder: [
    t('noise', 0, 0, 0.08, 0.6), t('sawtooth', 150, 0, 0.3, 0.3, 50),
    dark(0.03, 0.5, 0.9, 1100, 0.35), dark(0.35, 0.55, 0.8, 800, 0.3), dark(0.7, 0.6, 0.65, 600, 0.2), dark(1.1, 0.6, 0.45, 450, 0.1), dark(1.5, 0.55, 0.3, 330),
    { ...t('triangle', 72, 0.02, 1.9, 0.5, 36), fade: 0.02 },
  ],
  // A tube of the sign striking: the snap of its starter, a buzz, and the glass ringing.
  sign: [t('noise', 0, 0, 0.03, 0.35), t('sawtooth', 100, 0, 0.12, 0.3), t('triangle', 3100, 0.01, 0.14, 0.16, 2600)],
  // The blow a battle ends with, as the field is held for it: an iron door falling shut.
  slam: [t('noise', 0, 0, 0.05, 0.7), dark(0.02, 0.4, 0.9, 500, 0.1), { ...t('triangle', 110, 0, 0.45, 0.8, 34), fade: 0.05 }, t('square', 55, 0, 0.16, 0.3)],
  // A medal: three bright notes going up and a held fourth.
  medal: [t('triangle', 784, 0, 0.07, 0.3), t('triangle', 988, 0.08, 0.07, 0.3), t('triangle', 1175, 0.16, 0.07, 0.3), t('square', 1568, 0.24, 0.22, 0.18)],
  // The database growing: two quiet notes, like a terminal acknowledging.
  entry: [t('square', 988, 0, 0.05, 0.14), t('square', 1319, 0.07, 0.09, 0.14)],
  repair: [t('triangle', 520, 0, 0.08, 0.35), t('triangle', 780, 0.09, 0.12, 0.35)],
  // A weapon ready again after a kill: a breech closing, and a note up a fifth.
  ready: [t('noise', 0, 0, 0.02, 0.3), t('square', 740, 0.02, 0.04, 0.22), t('square', 1110, 0.065, 0.08, 0.22)],
  // The second of a turn, and the third and after: the same breech, each a step higher than the last, the third with a note more.
  chain2: [t('noise', 0, 0, 0.02, 0.3), t('square', 880, 0.02, 0.04, 0.22), t('square', 1320, 0.065, 0.08, 0.22)],
  chain3: [t('noise', 0, 0, 0.02, 0.3), t('square', 1047, 0.02, 0.04, 0.22), t('square', 1568, 0.065, 0.05, 0.22), t('square', 2093, 0.12, 0.08, 0.2)],
  overheat: [t('square', 520, 0, 0.1, 0.35), t('square', 390, 0.16, 0.1, 0.35), t('square', 520, 0.32, 0.1, 0.35)],
  victory: [t('square', 523, 0, 0.12, 0.3), t('square', 659, 0.13, 0.12, 0.3), t('square', 784, 0.26, 0.12, 0.3), t('square', 1047, 0.39, 0.3, 0.3)],
  defeat: [t('sawtooth', 392, 0, 0.2, 0.3), t('sawtooth', 311, 0.22, 0.2, 0.3), t('sawtooth', 233, 0.44, 0.45, 0.3)],
};

const SHOT: Record<DamageType, SoundName> = { kinetic: 'shotKinetic', energy: 'shotEnergy', explosive: 'shotExplosive' };
const MOVES = new Set<InputAction>(['up', 'down', 'left', 'right', 'prev', 'next']);

/** The sounds a battle event makes. `flightMs` is how long the shot takes to arrive. */
export function soundsForEvent(event: BattleEvent, damageType: DamageType, flightMs: number): { name: SoundName; delayMs: number }[] {
  const now = (name: SoundName) => [{ name, delayMs: 0 }];
  switch (event.type) {
    case 'shot': return [{ name: SHOT[damageType], delayMs: 0 }, { name: event.hit ? 'hit' : 'miss', delayMs: flightMs }];
    case 'partDestroyed': return now('partDestroyed');
    // A machine that went up to far more than was needed is heard to: the slam of a blow that ends things, under the blast.
    case 'unitDestroyed': return event.overkill ? [...now('unitDestroyed'), ...now('slam')] : now('unitDestroyed');
    case 'momentum': return now(event.chain >= 3 ? 'chain3' : event.chain === 2 ? 'chain2' : 'ready');
    case 'arrive': return now('launch');
    case 'shaken': return now('stagger');
    // One that leaves is heard to go; one that cannot move is heard to go quiet.
    case 'rout': return now(event.fixed ? 'cool' : 'boost');
    case 'boost': return now('boost');
    case 'guard': return now('guard');
    case 'stagger': return now('stagger');
    case 'charge': return now('charge');
    case 'module': return now('module');
    case 'recover': return [];
    case 'cool':
    case 'turnSkipped': return now('cool');
    case 'repair': return now('repair');
    case 'mend': return now('mend');
    case 'fuse': return now('fuse');
    case 'blast': return now('blast');
    case 'launch': return now('launch');
    case 'phase': return now('alarm');
    case 'support': return [{ name: 'support', delayMs: 0 }, { name: 'hit', delayMs: flightMs }];
    case 'order': return [];
    case 'overdrive': return now('overdrive');
    case 'asset': return event.lost > 0 ? now('asset') : [];
    case 'overheat': return now('overheat');
    case 'outcome': return now(event.outcome === 'victory' ? 'victory' : 'defeat');
    case 'turnStart': return [];
  }
}

/**
 * The sound for a menu input. `changed` says whether the input actually did something; `busy` that
 * the screen was not taking input (it was still coming up, or holding a line of text for a moment),
 * in which case a press that did nothing is passed over in silence rather than refused.
 */
export function soundForInput(action: InputAction, changed: boolean, busy = false): SoundName | null {
  if (!changed && busy) return null;
  if (action === 'confirm') return changed ? 'confirm' : 'deny';
  if (!changed) return null;
  if (action === 'cancel') return 'cancel';
  return MOVES.has(action) ? 'move' : null;
}

const MASTER = 0.3;

/** Plays the synthesised sounds. Silent until `unlock()` runs, which browsers require to follow an input. */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  /** The audio engine once it has been unlocked; null before that or on a device without sound. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Call on the first input. Safe to call again. A device without audio simply stays silent. */
  unlock(): void {
    if (this.failed) return;
    try {
      this.ctx ??= this.createContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.failed = true;
      this.ctx = null;
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.6);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /** True when a sound asked for now is heard now: there is an engine, and it is not asleep. */
  get awake(): boolean {
    const state = this.ctx?.state as string | undefined;
    return !!this.ctx && (state === undefined || state === 'running');
  }

  /** Where a tone goes in: straight into its own loudness, or through a filter first where its top is to come off. */
  private into(ctx: AudioContext, tone: Tone, gain: GainNode): AudioNode {
    if (!tone.cut) return gain;
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = tone.cut;
      filter.connect(gain);
      return filter;
    } catch {
      // An engine that makes no filters plays the tone as it is.
      return gain;
    }
  }

  /**
   * Plays a sound, so much later. An `ambient` sound belongs to a moment nobody pressed for (thunder,
   * a sign coming on): an engine that is asleep, as a browser's is before its first input, would keep
   * it and play it on waking, at the wrong moment and together with all the others it kept. Those
   * are not played at all then. The answer to a press is kept: the press is what wakes the engine.
   */
  play(name: SoundName, delayMs = 0, ambient = false): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || (ambient && !this.awake)) return;
    try {
      for (const tone of SOUNDS[name]) {
        const at = ctx.currentTime + delayMs / 1000 + tone.start;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(tone.gain * MASTER, at);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, (tone.fade ?? 0) * MASTER), at + tone.dur);
        gain.connect(ctx.destination);
        const into = this.into(ctx, tone, gain);
        if (tone.wave === 'noise') {
          const source = ctx.createBufferSource();
          source.buffer = this.noiseBuffer(ctx);
          source.connect(into);
          source.start(at);
          source.stop(at + tone.dur + 0.02);
        } else {
          const osc = ctx.createOscillator();
          osc.type = tone.wave;
          osc.frequency.setValueAtTime(tone.from, at);
          if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, at + tone.dur);
          osc.connect(into);
          osc.start(at);
          osc.stop(at + tone.dur + 0.02);
        }
      }
    } catch {
      // Sound is decoration: a failing audio engine must never interrupt the game.
    }
  }
}
