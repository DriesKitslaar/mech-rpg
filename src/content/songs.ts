import type { Kit, Song, Tone } from '../platform/music';

export type SongName = 'title' | 'hub' | 'briefing' | 'battle' | 'battle2' | 'boss' | 'arena' | 'ending' | 'victory' | 'defeat';

// Songs are written the way a tracker shows them: one token per step, "." for a rest, "-" to hold the note
// before it, "|" between bars for the reader, and for the drums k, s, h, o, c and t (kick, snare, closed and
// open hat, clap, tick). The helpers below only save typing; what they return is that text.

/** Joins bars into one voice line. */
const bars = (...list: string[]): string => list.join(' | ');

/** The same bar a number of times. */
const times = (count: number, bar: string): string => bars(...Array<string>(count).fill(bar));

/** One note per bar, held for the whole bar. "-" ties the bar to the one before it and "." leaves it empty. */
const whole = (notes: string, steps = 16): string =>
  bars(...notes.split(' ').map((note) => [note, ...Array<string>(steps - 1).fill(note === '.' ? '.' : '-')].join(' ')));

/** Plays a figure on a chord: the digits in the figure are replaced by the chord's notes, counted from 1. */
const fill = (figure: string, notes: string): string => {
  const chord = notes.split(' ');
  return figure.split(' ').map((token) => (/^\d$/.test(token) ? chord[Number(token) - 1] : token)).join(' ');
};

/** One figure on every chord of a song: a table from chord name to a bar. */
const figures = (figure: string, chords: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(chords).map(([chord, notes]) => [chord, fill(figure, notes)]));

/** Reads a chord chart such as "Am F C G" off a table of one-bar figures. */
const chart = (table: Record<string, string>, chords: string): string => bars(...chords.split(' ').map((chord) => table[chord]));

/** Lines for the pad voices: one chord tone per bar each, lowest voice first. */
const pads = (steps: number, ...tones: string[]): Record<string, string> =>
  Object.fromEntries(tones.map((line, index) => [`pad${index + 1}`, whole(line, steps)]));

// The instruments every song starts from. A song changes what it needs to sound like itself.
const BASS: Tone = { wave: 'sawtooth', gain: 0.24, attack: 0.005, decay: 0.16, sustain: 0.5, release: 0.05, cutoff: 420, resonance: 5, sweep: 6 };
const PAD: Tone = { wave: 'sawtooth', gain: 0.1, attack: 0.5, decay: 0.8, sustain: 0.75, release: 1, detune: 9, cutoff: 1700 };
const LEAD: Tone = { wave: 'square', gain: 0.1, attack: 0.02, decay: 0.3, sustain: 0.65, release: 0.14, cutoff: 3600, vibrato: 14, echo: 0.3 };
const PLUCK: Tone = { wave: 'square', gain: 0.1, attack: 0.004, decay: 0.22, sustain: 0, release: 0.06, cutoff: 1800, resonance: 3, sweep: 4, echo: 0.3 };
const BELL: Tone = { wave: 'sine', gain: 0.14, attack: 0.004, decay: 2.2, sustain: 0, release: 0.5, overtone: 2.76, echo: 0.4 };
const KIT: Kit = { drums: true, gain: 0.5 };

const REST = '. . . . . . . . . . . . . . . .';
const HATS_8 = 'h . h . h . h . h . h . h . h .';
const HATS_8_OPEN = 'h . h . h . h . h . h . h . o .';
const HATS_16 = 'h h h h h h h h h h h h h h h h';
const KICK_4 = 'k . . . k . . . k . . . k . . .';
const SNARE_24 = '. . . . s . . . . . . . s . . .';
const SNARE_8 = 's . s . s . s . s . s . s . s .';
const SNARE_16 = 's s s s s s s s s s s s s s s s';

// The game's theme: three notes falling in a slow three-three-two, then a long landing.
// The title plays it in A minor and the ending brings it back over C major.
const THEME_CALL = bars(
  'E5 - - - - - D5 - - - - - C5 - - -',
  'A4 - - - - - - - - - . . G4 - A4 -',
  'C5 - - - - - D5 - - - - - E5 - - -',
  'D5 - - - - - - - - - . . B4 - D5 -',
);
const THEME_ANSWER = [
  'E5 - - - - - D5 - - - - - C5 - - -',
  'A4 - - - - - - - - - . . C5 - E5 -',
  'G5 - - - - - E5 - - - - - D5 - - -',
];
/** The answer's last bar when the tune carries on upwards, and when it comes to rest. */
const THEME_ONWARD = 'B4 - - - - - - - - - . . D5 - E5 -';
const THEME_REST = 'B4 - - - - - - - - - - - . . . .';

// Title. A minor, 84 bpm, 24 bars: the theme alone over pads (8), a lift through F and G to the dominant (8),
// the theme again with the full band (8). The E major before the return borrows G# as a leading tone.
const TITLE_BASS = figures('1 - 1 - 1 - 2 - 1 - 1 - 1 - 2 -', {
  Am: 'A1 A2', F: 'F2 F3', C: 'C2 C3', G: 'G1 G2', Em: 'E2 E3', E: 'E2 E3',
});
// Root, fifth and octave in threes against the beat: the rhythm of the theme, twice as fast.
const TITLE_ARP = {
  ...figures('1 2 3 1 2 3 1 2 1 2 3 1 2 3 1 2', { Am: 'A3 E4 A4', F: 'F3 C4 F4', C: 'C4 G4 C5', G: 'G3 D4 G4', Em: 'E3 B3 E4' }),
  E: fill('1 2 3 1 2 3 1 2 1 2 3 1 2 3 1 2', 'E3 G#3 B3'),
};
const TITLE_BEAT = bars('k . . . s . . . k . . . s . . .', 'k . . . s . . . k . k . s . . .');
const TITLE_PADS = pads(16, 'A3 - G3 -', 'C4 - - B3', 'E4 F4 E4 D4');

const title: Song = {
  bpm: 84, stepsPerBeat: 4, loop: true,
  scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], accidentals: ['G#'],
  echo: { steps: 3, feedback: 0.4 },
  instruments: { bass: BASS, pad: PAD, lead: LEAD, arp: PLUCK, kit: { ...KIT, gain: 0.42 } },
  voices: { bass: 'bass', pad1: 'pad', pad2: 'pad', pad3: 'pad', lead: 'lead', arp: 'arp', drums: 'kit', hats: 'kit' },
  pan: { pad1: -0.7, pad3: 0.7, arp: 0.35, hats: -0.25 },
  patterns: {
    alone1: { steps: 64, lines: { ...TITLE_PADS, bass: whole('A1 F2 C2 G1'), lead: THEME_CALL } },
    alone2: {
      steps: 64,
      lines: {
        ...TITLE_PADS, bass: whole('A1 F2 C2 G1'), lead: bars(...THEME_ANSWER, THEME_ONWARD),
        arp: chart(TITLE_ARP, 'Am F C G'),
        drums: bars('k . . . . . . . . . . . . . . .', 'k . . . . . . . . . . . . . . .', 'k . . . . . . . . . . . . . . .', 'k . . . . . . . . . . . s . s s'),
      },
    },
    lift1: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 B3 - A3', 'C4 D4 E4 C4', 'F4 G4 - E4'), bass: chart(TITLE_BASS, 'F G Em Am'),
        lead: bars(
          'F5 - - - - - - - E5 - - - C5 - - -',
          'D5 - - - - - - - - - C5 - B4 - - -',
          'E5 - - - - - - - D5 - - - B4 - - -',
          'C5 - - - - - - - - - - - . . A4 -',
        ),
        arp: chart(TITLE_ARP, 'F G Em Am'), drums: bars(TITLE_BEAT, TITLE_BEAT), hats: bars(HATS_8, HATS_8_OPEN, HATS_8, HATS_8_OPEN),
      },
    },
    lift2: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 B3 - -', 'C4 D4 E4 -', 'F4 G4 G#4 -'), bass: chart(TITLE_BASS, 'F G E E'),
        lead: bars(
          'F5 - - - - - - - E5 - - - C5 - - -',
          'D5 - - - - - - - - - C5 - B4 - - -',
          'G#4 - - - - - B4 - - - - - D5 - - -',
          'E5 - - - - - - - - - - - . . . .',
        ),
        arp: chart(TITLE_ARP, 'F G E E'),
        drums: bars(TITLE_BEAT, 'k . . . s . . . k . . . s . . .', 'k . . . s . . . k . . . s s s s'),
        hats: bars(HATS_8, HATS_8_OPEN, HATS_8, HATS_8_OPEN),
      },
    },
    band1: {
      steps: 64,
      lines: {
        ...TITLE_PADS, bass: chart(TITLE_BASS, 'Am F C G'), lead: THEME_CALL, arp: chart(TITLE_ARP, 'Am F C G'),
        drums: bars(TITLE_BEAT, TITLE_BEAT), hats: bars(HATS_8, HATS_8_OPEN, HATS_8, HATS_8_OPEN),
      },
    },
    band2: {
      steps: 64,
      lines: {
        ...TITLE_PADS, bass: chart(TITLE_BASS, 'Am F C G'), lead: bars(...THEME_ANSWER, THEME_REST), arp: chart(TITLE_ARP, 'Am F C G'),
        drums: bars(TITLE_BEAT, 'k . . . s . . . k . . . s . . .', 'k . . . s . . . k . . . . . . .'),
        hats: bars(HATS_8, HATS_8_OPEN, HATS_8, HATS_8),
      },
    },
  },
  order: ['alone1', 'alone2', 'lift1', 'lift2', 'band1', 'band2'],
};

// Hub. D dorian, 72 bpm, 24 bars: the hangar between jobs. Seventh chords held for two bars each, a bass that
// walks to the next root, and a few notes on the keys with a bar of room after them. A soft beat comes in for
// the middle (8) and stays for the reprise (8), then leaves again when the loop turns.
// A knock on the rim where a snare would be: the beat is there to be leaned on, not listened to.
const HUB_BEAT = { drums: times(4, 'k . . . t . . . . . k . t . . .'), hats: times(4, HATS_8) };
// D minor seven and G, then F major seven and A minor seven: the bass has the roots, the pads the rest.
const HUB_PADS_1 = pads(16, 'A3 - B3 -', 'C4 - D4 -', 'F4 - G4 -');
const HUB_PADS_2 = pads(16, 'A3 - G3 -', 'C4 - - -', 'E4 - - -');
const HUB_WALK_1 = bars(
  'D2 - - - - - - - - - - - - - - -',
  'D2 - - - - - - - C2 - - - A1 - - -',
  'G1 - - - - - - - - - - - - - - -',
  'G1 - - - - - - - - - - - D2 - E2 -',
);
const HUB_WALK_2 = bars(
  'F2 - - - - - - - - - - - - - - -',
  'F2 - - - - - - - - - - - E2 - C2 -',
  'A1 - - - - - - - - - - - - - - -',
  'A1 - - - - - - - - - - - C2 - - -',
);

const hub: Song = {
  bpm: 72, stepsPerBeat: 4, loop: true,
  scale: ['D', 'E', 'F', 'G', 'A', 'B', 'C'],
  echo: { steps: 3, feedback: 0.35 },
  instruments: {
    bass: { ...BASS, gain: 0.17, attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.15, cutoff: 300, resonance: 2, sweep: 2.5 },
    pad: { ...PAD, gain: 0.13, attack: 0.8, release: 1.4, cutoff: 1100 },
    keys: { wave: 'triangle', gain: 0.18, attack: 0.008, decay: 1.4, sustain: 0.1, release: 0.4, echo: 0.35 },
    kit: { ...KIT, gain: 0.3 },
  },
  voices: { bass: 'bass', pad1: 'pad', pad2: 'pad', pad3: 'pad', keys: 'keys', drums: 'kit', hats: 'kit' },
  pan: { pad1: -0.7, pad3: 0.7, keys: 0.25, hats: -0.25 },
  patterns: {
    still1: {
      steps: 64,
      lines: {
        ...HUB_PADS_1, bass: HUB_WALK_1,
        keys: bars('. . . . A4 - C5 - D5 - - - - - - -', REST, '. . . . B4 - D5 - E5 - - - - - - -', '. . . . . . . . D5 - B4 - - - . .'),
      },
    },
    still2: {
      steps: 64,
      lines: {
        ...HUB_PADS_2, bass: HUB_WALK_2,
        keys: bars('. . . . A4 - C5 - E5 - - - - - - -', REST, '. . . . G4 - A4 - C5 - - - - - - -', '. . . . . . . . E4 - G4 - A4 - - -'),
      },
    },
    drift1: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 - G3 -', 'C4 - B3 -', 'E4 - D4 -'), ...HUB_BEAT,
        bass: bars(
          'F2 - - - - - - - - - - - - - - -',
          'F2 - - - - - - - - - - - C2 - D2 -',
          'E2 - - - - - - - - - - - - - - -',
          'E2 - - - - - - - - - - - D2 - E2 -',
        ),
        keys: bars(
          'E5 - - - - - - - C5 - - - - - A4 -',
          'C5 - - - - - - - . . . . . . . .',
          'D5 - - - - - - - B4 - - - - - G4 -',
          'B4 - - - - - - - . . . . . . . .',
        ),
      },
    },
    drift2: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 - G3 A3', 'C4 - B3 C4', 'E4 - D4 E4'), ...HUB_BEAT,
        bass: bars(
          'F2 - - - - - - - - - - - - - - -',
          'F2 - - - - - - - - - - - A2 - - -',
          'G2 - - - - - - - - - - - - - - -',
          'A2 - - - - - - - - - - - E2 - - -',
        ),
        keys: bars(
          'E5 - - - - - - - C5 - - - - - A4 -',
          'C5 - - - - - - - . . . . E5 - - -',
          'D5 - - - - - - - B4 - - - - - - -',
          'C5 - - - - - - - - - - - . . . .',
        ),
      },
    },
    home1: {
      steps: 64,
      lines: {
        ...HUB_PADS_1, ...HUB_BEAT, bass: HUB_WALK_1,
        keys: bars('. . . . D5 - C5 - A4 - - - - - - -', '. . . . . . . . . . . . F4 - A4 -', '. . . . E5 - D5 - B4 - - - - - - -', '. . . . . . . . . . . . G4 - B4 -'),
      },
    },
    home2: {
      steps: 64,
      lines: {
        ...HUB_PADS_2, bass: HUB_WALK_2,
        drums: bars(times(3, 'k . . . t . . . . . k . t . . .'), 'k . . . t . . . . . k . . . . .'), hats: times(4, HATS_8),
        keys: bars('. . . . E5 - C5 - A4 - - - - - - -', REST, '. . . . C5 - A4 - G4 - - - - - - -', REST),
      },
    },
  },
  order: ['still1', 'still2', 'drift1', 'drift2', 'home1', 'home2'],
};

// Briefing. C phrygian, 60 bpm, 16 bars: a low drone on C and G, a muffled pulse on every half beat, a tick on
// every beat like a clock, and now and then a bell. The drone sinks to A flat and then to a diminished chord on
// G, whose D flat leans back down into C when the loop turns.
const PULSE = '1 . 1 . 1 . 1 . 1 . 1 . 1 . 1 .';
const TICK = 't . . . t . . . t . . . t . . .';
const TICKS = bars(TICK, TICK, TICK, 't . . . t . . . t . . . t . t .');

const briefing: Song = {
  bpm: 60, stepsPerBeat: 4, loop: true,
  scale: ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  echo: { steps: 3, feedback: 0.5 },
  instruments: {
    drone: { ...PAD, gain: 0.15, attack: 1.5, release: 2.5, detune: 12, cutoff: 900 },
    pulse: { ...BASS, gain: 0.26, decay: 0.12, sustain: 0, cutoff: 300, resonance: 4, sweep: 4 },
    bell: { ...BELL, gain: 0.24 },
    kit: { ...KIT, gain: 0.34 },
  },
  voices: { drone1: 'drone', drone2: 'drone', drone3: 'drone', pulse: 'pulse', bell: 'bell', ticks: 'kit', thud: 'kit' },
  pan: { drone2: -0.6, drone3: 0.6, bell: 0.3, ticks: -0.3 },
  patterns: {
    wait1: {
      steps: 64,
      lines: {
        drone1: whole('C2 - - -'), drone2: whole('G2 - - -'), drone3: whole('Eb3 - F3 Eb3'),
        pulse: times(4, fill(PULSE, 'C3')), ticks: TICKS,
        bell: bars(REST, '. . . . . . . . G5 - - - - - - -', REST, '. . . . Ab5 - - - - - G5 - - - - -'),
      },
    },
    wait2: {
      steps: 64,
      lines: {
        drone1: whole('C2 - - -'), drone2: whole('G2 - - -'), drone3: whole('Eb3 - Db3 -'),
        pulse: bars(times(3, fill(PULSE, 'C3')), 'C3 . C3 . C3 . C3 . C3 . C3 . . . . .'), ticks: TICKS,
        bell: bars(REST, '. . . . . . . . Eb5 - - - - - - -', REST, '. . . . F5 - - - - - Db5 - - - - -'),
      },
    },
    sink1: {
      steps: 64,
      lines: {
        drone1: whole('Ab1 - - -'), drone2: whole('Eb2 - - -'), drone3: whole('C3 - - -'),
        pulse: times(4, fill(PULSE, 'Ab2')), ticks: TICKS, thud: times(4, 'k . . . . . . . . . . . . . . .'),
        bell: bars('C5 - - - - - - - . . . . . . . .', '. . . . . . . . Eb5 - - - - - - -', REST, '. . . . G5 - - - - - Eb5 - - - - -'),
      },
    },
    sink2: {
      steps: 64,
      lines: {
        drone1: whole('G1 - - -'), drone2: whole('G2 - - -'), drone3: whole('Bb2 - Db3 -'),
        pulse: bars(times(3, fill(PULSE, 'G2')), 'G2 . G2 . G2 . G2 . G2 . . . . . . .'), ticks: TICKS,
        thud: times(4, 'k . . . . . . . . . . . . . . .'),
        bell: bars('. . . . . . . . Db5 - - - - - - -', '. . . . . . . . Bb4 - - - - - - -', REST, '. . . . F5 - - - - - Db5 - - - - -'),
      },
    },
  },
  order: ['wait1', 'wait2', 'sink1', 'sink2'],
};

// Battle. E minor, 130 bpm, 32 bars: a riff in three-three-two over sixteenths in the bass (8), a held tune
// over C, D and E minor (8), the riff again with chords under it (8), and a bridge that opens on G and builds
// back down to B minor under a snare roll (8).
const BATTLE_BASS = figures('1 1 2 1 1 1 2 1 1 1 2 1 1 1 2 1', {
  Em: 'E2 E3', C: 'C2 C3', D: 'D2 D3', Bm: 'B1 B2', G: 'G1 G2', Am: 'A1 A2',
});
// Six notes up and down against four beats, so the pattern keeps shifting against the bar.
const BATTLE_ARP = figures('1 2 3 4 3 2 1 2 3 4 3 2 1 2 3 2', {
  Em: 'E4 G4 B4 E5', C: 'C4 E4 G4 C5', D: 'D4 F#4 A4 D5', Bm: 'B3 D4 F#4 B4', G: 'G3 B3 D4 G4', Am: 'A3 C4 E4 A4',
});
const BATTLE_RIFF = [
  'E4 . . E4 . . G4 . E4 . . E4 . . A4 G4',
  'E4 . . E4 . . G4 . B4 . A4 . G4 . D4 .',
  'E4 . . E4 . . G4 . E4 . . E4 . . C5 B4',
];
const BATTLE_DRIVE = { bass: chart(BATTLE_BASS, 'Em Em C D'), kick: times(4, KICK_4), hats: times(4, 'h . o . h . o . h . o . h . o .') };
const BATTLE_RIFF_1 = { ...BATTLE_DRIVE, snare: times(4, SNARE_24), riff: bars(...BATTLE_RIFF, 'F#4 . . F#4 . . A4 . D5 . A4 . F#4 . D4 .') };
const BATTLE_RIFF_2 = {
  ...BATTLE_DRIVE, snare: bars(times(3, SNARE_24), '. . . . s . . . . . . . s . s s'),
  riff: bars(...BATTLE_RIFF, 'F#4 . . F#4 . . A4 . D5 . A4 . D5 . F#5 .'),
};
// The second time round the riff gets chords under it, so that it comes back bigger than it left.
const BATTLE_RIFF_PADS = pads(16, 'B3 - G3 A3', 'E4 - - F#4');

const battle: Song = {
  bpm: 130, stepsPerBeat: 4, loop: true,
  scale: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  echo: { steps: 3, feedback: 0.3 },
  instruments: {
    bass: { ...BASS, gain: 0.21, decay: 0.1, sustain: 0.35, release: 0.03, cutoff: 480, resonance: 8, sweep: 6 },
    riff: { wave: 'sawtooth', gain: 0.3, attack: 0.004, decay: 0.2, sustain: 0.4, release: 0.08, cutoff: 3400, resonance: 2, sweep: 2, echo: 0.15 },
    lead: { ...LEAD, gain: 0.12 },
    pad: PAD,
    arp: { ...PLUCK, gain: 0.11 },
    kit: KIT,
  },
  voices: { bass: 'bass', riff: 'riff', lead: 'lead', pad1: 'pad', pad2: 'pad', arp: 'arp', kick: 'kit', snare: 'kit', hats: 'kit' },
  pan: { riff: -0.2, pad1: -0.6, pad2: 0.6, arp: 0.35, hats: 0.25 },
  patterns: {
    riff1: { steps: 64, lines: BATTLE_RIFF_1 },
    riff2: { steps: 64, lines: BATTLE_RIFF_2 },
    again1: { steps: 64, lines: { ...BATTLE_RIFF_1, ...BATTLE_RIFF_PADS } },
    again2: { steps: 64, lines: { ...BATTLE_RIFF_2, ...BATTLE_RIFF_PADS } },
    tune1: {
      steps: 64,
      lines: {
        ...pads(16, 'G3 A3 B3 -', 'E4 F#4 G4 -'), bass: chart(BATTLE_BASS, 'C D Em Em'), arp: chart(BATTLE_ARP, 'C D Em Em'),
        kick: times(4, KICK_4), snare: times(4, SNARE_24), hats: times(4, HATS_16),
        lead: bars(
          'E5 - - - - - - - G5 - - - - - E5 -',
          'F#5 - - - - - - - A5 - - - - - F#5 -',
          'G5 - - - - - - - - - - - F#5 - E5 -',
          'B4 - - - - - - - - - - - . . . .',
        ),
      },
    },
    tune2: {
      steps: 64,
      lines: {
        ...pads(16, 'G3 A3 B3 -', 'E4 F#4 - -'), bass: chart(BATTLE_BASS, 'C D Bm Bm'), arp: chart(BATTLE_ARP, 'C D Bm Bm'),
        kick: times(4, KICK_4), snare: bars(times(3, SNARE_24), '. . . . s . . . . . . . s . s s'), hats: times(4, HATS_16),
        lead: bars(
          'E5 - - - - - - - G5 - - - - - E5 -',
          'F#5 - - - - - - - A5 - - - - - F#5 -',
          'B5 - - - - - - - A5 - - - F#5 - - -',
          'D5 - - - - - - - - - - - . . . .',
        ),
      },
    },
    bridge1: {
      steps: 64,
      lines: {
        ...pads(16, 'G3 - A3 -', 'D4 - F#4 -'), bass: chart(BATTLE_BASS, 'G G D D'), arp: chart(BATTLE_ARP, 'G G D D'),
        kick: times(4, 'k . . . . . . . . . k . . . . .'), snare: times(4, '. . . . . . . . s . . . . . . .'), hats: times(4, HATS_8),
        lead: bars(
          'D5 - - - - - - - B4 - - - D5 - - -',
          'G5 - - - - - - - - - - - . . . .',
          'F#5 - - - - - - - D5 - - - F#5 - - -',
          'A5 - - - - - - - - - - - . . . .',
        ),
      },
    },
    bridge2: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 - B3 -', 'E4 - F#4 -'), bass: chart(BATTLE_BASS, 'Am Am Bm Bm'), arp: chart(BATTLE_ARP, 'Am Am Bm Bm'),
        kick: times(4, KICK_4), snare: bars(SNARE_24, SNARE_24, SNARE_8, SNARE_16), hats: times(4, HATS_16),
        lead: bars(
          'E5 - - - - - - - C5 - - - E5 - - -',
          'A5 - - - - - - - G5 - - - E5 - - -',
          'F#5 - - - - - - - - - - - D5 - - -',
          'B4 - - - - - - - . . . . . . . .',
        ),
      },
    },
  },
  order: ['riff1', 'riff2', 'tune1', 'tune2', 'again1', 'again2', 'bridge1', 'bridge2'],
};

// Second battle theme. F minor, 138 bpm in twelve-eight (three steps to the beat), 32 bars: a gallop instead of
// straight sixteenths. A long-short tune over F minor (8), a broader one from A flat (8), the first again over
// an arpeggio (8), and a climb from D flat to the dominant (8), whose E natural is the one note from outside
// the key.
const GALLOP_BASS = figures('1 . 1 1 . 1 1 . 1 2 . 1', {
  Fm: 'F2 F3', Db: 'Db2 Db3', Eb: 'Eb2 Eb3', Ab: 'Ab1 Ab2', Bbm: 'Bb1 Bb2', C: 'C2 C3',
});
const GALLOP_ARP = figures('1 2 3 1 2 3 1 2 3 2 3 4', {
  Fm: 'F3 Ab3 C4 F4', Db: 'F3 Ab3 Db4 F4', Eb: 'G3 Bb3 Eb4 G4', Ab: 'Eb3 Ab3 C4 Eb4', Bbm: 'F3 Bb3 Db4 F4', C: 'E3 G3 C4 E4',
});
const GALLOP_KICK = 'k . . k . . k . . k . .';
const GALLOP_SNARE = '. . . s . . . . . s . .';
const GALLOP_HATS = 'h h h h h h h h h h h h';
const GALLOP_TUNE = {
  ...pads(12, 'Ab3 - - Bb3 Ab3 - - G3', 'C4 - Db4 Eb4 C4 - Db4 E4'),
  bass: chart(GALLOP_BASS, 'Fm Fm Db Eb Fm Fm Db C'),
  lead: bars(
    'C5 - - Ab4 - C5 F5 - - - - -',
    'Eb5 - - C5 - Ab4 C5 - - - - -',
    'Db5 - - Ab4 - Db5 F5 - - - - -',
    'Eb5 - - Bb4 - Eb5 G5 - - - - -',
    'Ab5 - - G5 - F5 C5 - - - - -',
    'Eb5 - - C5 - Ab4 C5 - - - - -',
    'Db5 - - Ab4 - Db5 F5 - - Eb5 - Db5',
    'C5 - - - - - E5 - - G5 - -',
  ),
  kick: times(8, GALLOP_KICK), snare: bars(times(7, GALLOP_SNARE), '. . . s . . . . . s s s'), hats: times(8, GALLOP_HATS),
};

const battle2: Song = {
  bpm: 138, stepsPerBeat: 3, loop: true,
  scale: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'], accidentals: ['E'],
  echo: { steps: 2, feedback: 0.3 },
  instruments: {
    bass: { ...BASS, wave: 'square', gain: 0.16, decay: 0.12, sustain: 0.4, release: 0.04, cutoff: 520, sweep: 4 },
    lead: { ...LEAD, wave: 'sawtooth', gain: 0.17, cutoff: 4000 },
    pad: PAD,
    arp: { ...PLUCK, gain: 0.11 },
    kit: KIT,
  },
  voices: { bass: 'bass', lead: 'lead', pad1: 'pad', pad2: 'pad', arp: 'arp', kick: 'kit', snare: 'kit', hats: 'kit' },
  pan: { pad1: -0.6, pad2: 0.6, arp: -0.35, hats: 0.25 },
  patterns: {
    tune: { steps: 96, lines: GALLOP_TUNE },
    again: { steps: 96, lines: { ...GALLOP_TUNE, arp: chart(GALLOP_ARP, 'Fm Fm Db Eb Fm Fm Db C') } },
    broad: {
      steps: 96,
      lines: {
        ...pads(12, 'C4 Bb3 Ab3 - C4 Bb3 - G3', 'Eb4 - C4 - Eb4 - Db4 E4'),
        bass: chart(GALLOP_BASS, 'Ab Eb Fm Fm Ab Eb Bbm C'), arp: chart(GALLOP_ARP, 'Ab Eb Fm Fm Ab Eb Bbm C'),
        lead: bars(
          'Ab5 - - - - - Eb5 - - C5 - -',
          'Bb4 - - - - - Eb5 - - G5 - -',
          'F5 - - - - - - - - Eb5 - C5',
          'Ab4 - - - - - - - - . . .',
          'Ab5 - - - - - Eb5 - - C5 - -',
          'Bb4 - - - - - Eb5 - - G5 - -',
          'F5 - - - - - Db5 - - Bb4 - -',
          'C5 - - - - - - - - . . .',
        ),
        kick: times(8, GALLOP_KICK), snare: bars(times(7, GALLOP_SNARE), '. . . s . . . . . s s s'), hats: times(8, GALLOP_HATS),
      },
    },
    climb: {
      steps: 96,
      lines: {
        ...pads(12, 'Ab3 - Bb3 - Ab3 - G3 -', 'Db4 - Eb4 - C4 - E4 -'),
        bass: chart(GALLOP_BASS, 'Db Db Eb Eb Fm Fm C C'), arp: chart(GALLOP_ARP, 'Db Db Eb Eb Fm Fm C C'),
        lead: bars(
          'F4 - - - - - - - - Ab4 - -',
          'F4 - - - - - - - - . . .',
          'G4 - - - - - - - - Bb4 - -',
          'G4 - - - - - - - - . . .',
          'Ab4 - - - - - - - - C5 - -',
          'Ab4 - - - - - - - - . . .',
          'G4 - - - - - C5 - - E5 - -',
          'G5 - - - - - - - - . . .',
        ),
        kick: bars(times(4, 'k . . . . . k . . . . .'), times(4, GALLOP_KICK)),
        snare: bars(times(6, GALLOP_SNARE), 's . . s . . s . . s . .', 's . s s . s s s s s s s'),
        hats: times(8, GALLOP_HATS),
      },
    },
  },
  order: ['tune', 'broad', 'again', 'climb'],
};

// Boss. D phrygian, 160 bpm, 32 bars, and it never lets up. A pedal riff on D that keeps stabbing at E flat and
// at the tritone A flat, joined half way by a siren of a lead (8), a sequence falling through C minor and
// B flat onto a diminished chord (8), the riff and the siren again over a restless arpeggio (8), and a climb
// in the bass, E flat, F, G, A flat, A, back into D (8).
const BOSS_RIFF = bars(
  'D2 D2 D2 D3 D2 D2 Eb3 D2 D2 D2 D2 D3 D2 D2 Ab2 D2',
  'D2 D2 D2 D3 D2 D2 Eb3 D2 D2 D2 F3 D2 Eb3 D2 C3 D2',
);
// Bare fifths that follow the accents of the riff; the last one of the first bar is the tritone itself.
const BOSS_STABS = {
  stab1: bars('D3 - - . . . Eb3 - - . . . . . Ab3 -', 'D3 - - . . . Eb3 - - . F3 - Eb3 - C3 -'),
  stab2: bars('A3 - - . . . Bb3 - - . . . . . D4 -', 'A3 - - . . . Bb3 - - . C4 - Bb3 - G3 -'),
};
const BOSS_BASS = figures('1 1 1 2 1 1 2 1 1 1 1 2 1 1 2 1', {
  Dm: 'D2 D3', Cm: 'C2 C3', Bb: 'Bb1 Bb2', Adim: 'A1 A2', Eb: 'Eb2 Eb3', F: 'F2 F3', Gm: 'G2 G3', Ab: 'Ab2 Ab3', Aup: 'A2 A3',
});
const BOSS_ARP = figures('1 2 3 2 1 2 3 2 1 2 3 2 1 2 3 2', {
  Eb: 'Eb4 G4 Bb4', F: 'F4 A4 C5', Gm: 'G4 Bb4 D5', Ab: 'Ab4 C5 Eb5', Aup: 'A4 C5 Eb5',
});
const BOSS_PEDAL_ARP = bars('D4 A4 D5 A4 D4 A4 D5 A4 D4 A4 D5 A4 D4 Ab4 D5 Ab4', 'D4 A4 D5 A4 D4 A4 D5 A4 D4 A4 D5 A4 D4 A4 D5 A4');
const BOSS_KICK = 'k . . . k . . . k . . . k . k .';
const BOSS_SIREN = [
  'D5 - - Eb5 - - D5 - C5 - - - Ab4 - - -',
  'A4 - - Bb4 - - A4 - G4 - - - D5 - - -',
  'D5 - - Eb5 - - D5 - C5 - - - Ab4 - - -',
];
const BOSS_PEDAL = {
  bass: bars(BOSS_RIFF, BOSS_RIFF), stab1: bars(BOSS_STABS.stab1, BOSS_STABS.stab1), stab2: bars(BOSS_STABS.stab2, BOSS_STABS.stab2),
  kick: times(4, BOSS_KICK), snare: times(4, SNARE_24), hats: times(4, HATS_16),
};
const BOSS_FALL = {
  bass: chart(BOSS_BASS, 'Dm Cm Bb Adim'), stab1: whole('F3 Eb3 D3 C3'), stab2: whole('A3 G3 F3 Eb3'),
  kick: times(4, 'k . k . k . k . k . k . k . k .'), hats: times(4, HATS_16),
};

const boss: Song = {
  bpm: 160, stepsPerBeat: 4, loop: true,
  scale: ['D', 'Eb', 'F', 'G', 'A', 'Bb', 'C'], accidentals: ['Ab'],
  echo: { steps: 3, feedback: 0.3 },
  instruments: {
    bass: { ...BASS, gain: 0.22, decay: 0.08, sustain: 0.4, release: 0.03, cutoff: 520, resonance: 8, sweep: 6 },
    stab: { wave: 'sawtooth', gain: 0.14, attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.1, detune: 14, cutoff: 2400, resonance: 2 },
    lead: { ...LEAD, wave: 'sawtooth', gain: 0.17, cutoff: 4200, vibrato: 18 },
    arp: { ...PLUCK, gain: 0.1 },
    kit: { ...KIT, gain: 0.55 },
  },
  voices: { bass: 'bass', stab1: 'stab', stab2: 'stab', lead: 'lead', arp: 'arp', kick: 'kit', snare: 'kit', hats: 'kit' },
  pan: { stab1: -0.6, stab2: 0.6, arp: 0.3, hats: -0.25 },
  patterns: {
    pedal: { steps: 64, lines: BOSS_PEDAL },
    siren: { steps: 64, lines: { ...BOSS_PEDAL, lead: bars(...BOSS_SIREN, 'A4 - - Bb4 - - A4 - F4 - Eb4 - D4 - - -') } },
    fall1: {
      steps: 64,
      lines: {
        ...BOSS_FALL, snare: times(4, SNARE_24),
        lead: bars(
          'A4 - D5 - F5 - - - Eb5 - D5 - A4 - - -',
          'G4 - C5 - Eb5 - - - D5 - C5 - G4 - - -',
          'F4 - Bb4 - D5 - - - C5 - Bb4 - F4 - - -',
          'Eb5 - - - C5 - - - A4 - - - Eb4 - - -',
        ),
      },
    },
    fall2: {
      steps: 64,
      lines: {
        ...BOSS_FALL, snare: bars(times(3, SNARE_24), '. . . . s . . . . . . . s . s s'),
        lead: bars(
          'A4 - D5 - F5 - - - Eb5 - D5 - A4 - - -',
          'G4 - C5 - Eb5 - - - D5 - C5 - G4 - - -',
          'F4 - Bb4 - D5 - - - F5 - - - Bb5 - - -',
          'A5 - - - - - - - Eb5 - - - - - - -',
        ),
      },
    },
    siren2: {
      steps: 64,
      lines: { ...BOSS_PEDAL, arp: bars(BOSS_PEDAL_ARP, BOSS_PEDAL_ARP), lead: bars(...BOSS_SIREN, 'A4 - - Bb4 - - A4 - F4 - Eb4 - D4 - - -') },
    },
    siren3: {
      steps: 64,
      lines: { ...BOSS_PEDAL, arp: bars(BOSS_PEDAL_ARP, BOSS_PEDAL_ARP), lead: bars(...BOSS_SIREN, 'A4 - - Bb4 - - A4 - D5 - Eb5 - F5 - - -') },
    },
    climb1: {
      steps: 64,
      lines: {
        bass: chart(BOSS_BASS, 'Eb Eb F F'), arp: chart(BOSS_ARP, 'Eb Eb F F'), stab1: whole('G3 - A3 -'), stab2: whole('Bb3 - C4 -'),
        lead: whole('Bb4 - C5 -'), kick: times(4, KICK_4), snare: times(4, SNARE_24), hats: times(4, HATS_16),
      },
    },
    climb2: {
      steps: 64,
      lines: {
        bass: chart(BOSS_BASS, 'Gm Gm Ab Aup'), arp: chart(BOSS_ARP, 'Gm Gm Ab Aup'), stab1: whole('Bb3 - C4 -'), stab2: whole('D4 - Eb4 -'),
        lead: whole('D5 - Eb5 -'), kick: times(4, KICK_4), snare: bars(SNARE_8, SNARE_8, SNARE_8, SNARE_16), hats: times(4, HATS_16),
      },
    },
  },
  order: ['pedal', 'siren', 'fall1', 'fall2', 'siren2', 'siren3', 'climb1', 'climb2'],
};

// Arena. G dorian, 104 bpm with swung sixteenths, 24 bars: a vamp between G minor seven and C nine with a
// cocky call and answer on top (8), three chords climbing in parallel under a sung line, ending on a
// stop-time break (8), then the crowd clapping every beat over bass and drums until the band comes back (8).
// The D flat in the lead is the blue note.
const ARENA_BASS = {
  Gm: 'G2 - . G2 . . Bb2 C3 . D3 . . F3 . D3 .',
  C9: 'C3 - . C3 . . E3 G3 . Bb2 . . C3 . Bb2 A2',
  Bb: 'Bb2 - . Bb2 . . D3 F3 . Bb2 . . D3 . F3 .',
  C: 'C3 - . C3 . . E3 G3 . C3 . . E3 . G3 .',
  Dm: 'D3 - . D3 . . F3 A3 . D3 . . C3 . A2 .',
};
const ARENA_CHORDS: Record<string, string[]> = {
  Gm: ['F3', 'Bb3', 'D4'], C9: ['E3', 'Bb3', 'D4'], Bb: ['F3', 'Bb3', 'D4'], C: ['G3', 'C4', 'E4'], Dm: ['A3', 'D4', 'F4'], Dm7: ['A3', 'C4', 'F4'],
};
/** The three stab voices for a row of bars, each bar a rhythm of "1" marks played on a chord. */
const arenaStabs = (...row: [rhythm: string, chord: string][]): Record<string, string> =>
  Object.fromEntries([0, 1, 2].map((voice) => [`stab${voice + 1}`, bars(...row.map(([rhythm, chord]) => fill(rhythm, ARENA_CHORDS[chord][voice])))]));
const VAMP_A = '. . . . 1 . . . . . 1 - . . . .';
const VAMP_B = '. . . . 1 . . . . . 1 - . . 1 .';
const PUSH = '1 - . . . . 1 . . 1 - . . . 1 .';
const STOP = '1 . . 1 . . 1 . 1 - - - . . . .';
const ARENA_VAMP = arenaStabs([VAMP_A, 'Gm'], [VAMP_B, 'C9'], [VAMP_A, 'Gm'], [VAMP_B, 'C9']);
const ARENA_KICK = 'k . . . . . . k . . k . . . . .';
const ARENA_HATS = bars(HATS_16, 'h h h h h h h h h h h h h h o .', HATS_16, 'h h h h h h h h h h h h h h o .');
const ARENA_GROOVE = { bass: chart(ARENA_BASS, 'Gm C9 Gm C9'), kick: times(4, ARENA_KICK), snare: times(4, SNARE_24), hats: ARENA_HATS };
const BACKBEAT = '. . . . c . . . . . . . c . . .';

const arena: Song = {
  bpm: 104, stepsPerBeat: 4, loop: true, swing: 0.18,
  scale: ['G', 'A', 'Bb', 'C', 'D', 'E', 'F'], accidentals: ['Db'],
  echo: { steps: 3, feedback: 0.25 },
  instruments: {
    bass: { ...BASS, wave: 'square', gain: 0.2, decay: 0.14, sustain: 0.3, release: 0.04, cutoff: 500, resonance: 8, sweep: 5 },
    stab: { wave: 'sawtooth', gain: 0.14, attack: 0.008, decay: 0.16, sustain: 0.35, release: 0.07, detune: 7, cutoff: 3200, resonance: 2, sweep: 1.6 },
    lead: { ...LEAD, gain: 0.12, decay: 0.2, vibrato: 10, echo: 0.2 },
    kit: KIT,
  },
  voices: { bass: 'bass', stab1: 'stab', stab2: 'stab', stab3: 'stab', lead: 'lead', kick: 'kit', snare: 'kit', hats: 'kit', clap: 'kit' },
  pan: { stab1: -0.6, stab3: 0.6, hats: 0.25, clap: -0.2 },
  patterns: {
    call1: {
      steps: 64,
      lines: {
        ...ARENA_GROOVE, ...ARENA_VAMP,
        lead: bars(
          'D5 . . F5 . D5 . C5 Bb4 . G4 . . . . .',
          REST,
          'F5 . . D5 . F5 . G5 - - . . . . . .',
          '. . . . E5 . D5 . C5 . Bb4 . G4 - - -',
        ),
      },
    },
    call2: {
      steps: 64,
      lines: {
        ...ARENA_GROOVE, ...ARENA_VAMP,
        lead: bars(
          'D5 . . F5 . D5 . C5 Bb4 . G4 . . . . .',
          '. . . . . . . . . . . . D5 . Db5 C5',
          'Bb4 . . G4 . Bb4 . C5 - - . . D5 . F5 .',
          'G5 - - - - - . . . . . . . . . .',
        ),
      },
    },
    rise1: {
      steps: 64,
      lines: {
        ...arenaStabs([PUSH, 'Bb'], [PUSH, 'C'], [PUSH, 'Dm'], [PUSH, 'Dm']),
        bass: chart(ARENA_BASS, 'Bb C Dm Dm'), kick: times(4, ARENA_KICK), snare: times(4, SNARE_24), hats: ARENA_HATS, clap: times(4, BACKBEAT),
        lead: bars(
          'F5 - - - - - D5 - - - Bb4 - - - D5 -',
          'E5 - - - - - C5 - - - G4 - - - C5 -',
          'D5 - - - - - F5 - - - A5 - - - - -',
          '. . . . A5 . G5 . F5 . D5 . C5 . D5 .',
        ),
      },
    },
    rise2: {
      steps: 64,
      lines: {
        ...arenaStabs([PUSH, 'Bb'], [PUSH, 'C'], [PUSH, 'Dm'], [STOP, 'Dm7']),
        bass: bars(chart(ARENA_BASS, 'Bb C Dm'), 'D3 . . D3 . . F3 . D3 - - - . . . .'),
        kick: bars(times(3, ARENA_KICK), 'k . . k . . k . k . . . . . . .'), snare: bars(times(3, SNARE_24), REST),
        hats: bars(HATS_16, 'h h h h h h h h h h h h h h o .', HATS_16, 'h h h h h h h h . . . . . . . .'),
        clap: bars(times(3, BACKBEAT), '. . . . . . . . . . . . c . c c'),
        lead: bars(
          'F5 - - - - - D5 - - - Bb4 - - - D5 -',
          'E5 - - - - - C5 - - - G4 - - - C5 -',
          'D5 - - - - - F5 - - - A5 - - - - -',
          'D5 . . D5 . . F5 . D5 - - - . . . .',
        ),
      },
    },
    crowd1: { steps: 64, lines: { ...ARENA_GROOVE, clap: times(4, 'c . . . c . . . c . . . c . . .') } },
    crowd2: {
      steps: 64,
      lines: {
        ...ARENA_GROOVE, ...ARENA_VAMP, snare: bars(times(3, SNARE_24), '. . . . s . . . . . . . s . s s'),
        clap: times(4, 'c . . . c . . . c . . . c . . .'),
        lead: bars(
          'G5 . F5 D5 . . . . G5 . F5 D5 . . . .',
          'G5 . E5 C5 . . . . G5 . E5 C5 . . . .',
          'G5 . F5 D5 . . . . G5 . F5 D5 . . Bb4 C5',
          'D5 . . E5 . . G5 - - - - - . . . .',
        ),
      },
    },
  },
  order: ['call1', 'call2', 'rise1', 'rise2', 'crowd1', 'crowd2'],
};

// Ending. C major, 66 bpm, 16 bars, no drums. The title's theme comes back note for note, but the chords under
// it are now major (8). A new tune answers it and closes through F minor, whose A flat is the bittersweet note,
// before the dominant hands back to the theme (8).
const ENDING_KEYS = figures('1 . 2 . 3 . 2 . 1 . 2 . 3 . 2 .', {
  C: 'C4 E4 G4', Am: 'A3 C4 E4', F: 'A3 C4 F4', G: 'B3 D4 G4', Em: 'B3 E4 G4', Fm: 'Ab3 C4 F4',
});

const ending: Song = {
  bpm: 66, stepsPerBeat: 4, loop: true,
  scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], accidentals: ['Ab'],
  echo: { steps: 3, feedback: 0.45 },
  instruments: {
    bass: { ...BASS, gain: 0.18, attack: 0.03, decay: 0.5, sustain: 0.6, release: 0.3, cutoff: 320, resonance: 1, sweep: 2 },
    pad: { ...PAD, gain: 0.12, attack: 0.9, release: 1.6, cutoff: 1300 },
    lead: { wave: 'triangle', gain: 0.13, attack: 0.05, decay: 0.4, sustain: 0.8, release: 0.3, vibrato: 12, echo: 0.35 },
    keys: { ...BELL, gain: 0.1, decay: 1.2, release: 0.3, overtone: 4, echo: 0.3 },
  },
  voices: { bass: 'bass', pad1: 'pad', pad2: 'pad', pad3: 'pad', lead: 'lead', keys: 'keys' },
  pan: { pad1: -0.7, pad3: 0.7, keys: -0.3 },
  patterns: {
    theme1: {
      steps: 64,
      lines: { ...pads(16, 'G3 A3 - G3', 'C4 - - B3', 'E4 - F4 D4'), bass: whole('C2 A1 F2 G2'), keys: chart(ENDING_KEYS, 'C Am F G'), lead: THEME_CALL },
    },
    theme2: {
      steps: 64,
      lines: {
        ...pads(16, 'G3 A3 G3 -', 'C4 - B3 -', 'E4 - - D4'), bass: whole('C2 A1 E2 G2'), keys: chart(ENDING_KEYS, 'C Am Em G'),
        lead: bars(...THEME_ANSWER, THEME_REST),
      },
    },
    reply1: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 G3 - A3', 'C4 B3 - C4', 'F4 D4 E4 -'), bass: whole('F2 G2 E2 A2'), keys: chart(ENDING_KEYS, 'F G Em Am'),
        lead: bars(
          'A4 - - - C5 - - - F5 - - - - - E5 -',
          'D5 - - - - - - - B4 - - - G4 - - -',
          'G4 - - - B4 - - - E5 - - - - - D5 -',
          'C5 - - - - - - - - - - - . . . .',
        ),
      },
    },
    reply2: {
      steps: 64,
      lines: {
        ...pads(16, 'A3 Ab3 G3 -', 'C4 - - B3', 'F4 - E4 D4'), bass: whole('F2 - C2 G2'), keys: chart(ENDING_KEYS, 'F Fm C G'),
        lead: bars(
          'A4 - - - C5 - - - F5 - - - - - E5 -',
          'C5 - - - - - - - Ab4 - - - - - - -',
          'G4 - - - - - - - C5 - - - E5 - - -',
          'D5 - - - - - - - - - - - . . . .',
        ),
      },
    },
  },
  order: ['theme1', 'theme2', 'reply1', 'reply2'],
};

// Victory. Three seconds: a quick climb up A minor, then F and G under the theme's three-three rhythm onto A.
// The last chord has no third, so it lands without turning sweet.
const victory: Song = {
  bpm: 132, stepsPerBeat: 4, loop: false,
  scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  echo: { steps: 3, feedback: 0.35 },
  instruments: {
    bass: { ...BASS, decay: 0.3, sustain: 0.6, release: 0.3 },
    stab: { wave: 'sawtooth', gain: 0.12, attack: 0.008, decay: 0.4, sustain: 0.7, release: 0.5, detune: 9, cutoff: 2800 },
    lead: { ...LEAD, gain: 0.12, release: 0.4 },
    kit: KIT,
  },
  voices: { bass: 'bass', stab1: 'stab', stab2: 'stab', stab3: 'stab', lead: 'lead', drums: 'kit', hats: 'kit' },
  pan: { stab1: -0.6, stab3: 0.6 },
  patterns: {
    won: {
      steps: 28,
      lines: {
        lead: 'A4 C5 E5 F5 - - G5 - - A5 - - - - - - - - - - - - . . . . . .',
        stab1: '. . . A3 - - B3 - - A3 - - - - - - - - - - - - . . . . . .',
        stab2: '. . . C4 - - D4 - - E4 - - - - - - - - - - - - . . . . . .',
        stab3: '. . . F4 - - G4 - - A4 - - - - - - - - - - - - . . . . . .',
        bass: '. . . F2 - - G2 - - A2 - - - - - - A1 - - - - - . . . . . .',
        drums: 's s s k . . k . . k . . . . . . k . . . . . . . . . . .',
        hats: '. . . . . . . . . o . . . . . . . . . . . . . . . . . .',
      },
    },
  },
  order: ['won'],
};

// Defeat. Three seconds and what rings on after them: the bass walks down from A to E under bare fifths and
// stays there, unresolved, while one voice leans on the F above and falls back.
const defeat: Song = {
  bpm: 88, stepsPerBeat: 4, loop: false,
  scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  echo: { steps: 3, feedback: 0.25 },
  instruments: {
    bass: { ...BASS, gain: 0.22, attack: 0.02, decay: 0.5, sustain: 0.6, release: 0.4, cutoff: 340, resonance: 2, sweep: 2 },
    stab: { ...PAD, gain: 0.12, attack: 0.05, release: 0.6, cutoff: 1100 },
    lead: { ...LEAD, gain: 0.1, release: 0.45 },
    kit: KIT,
  },
  voices: { bass: 'bass', stab1: 'stab', stab2: 'stab', lead: 'lead', drums: 'kit' },
  pan: { stab1: -0.6, stab2: 0.6 },
  patterns: {
    lost: {
      steps: 18,
      lines: {
        lead: 'E5 - - - D5 - - - C5 - - - B4 - - - - -',
        stab1: 'C4 - - - B3 - - - A3 - - - B3 - - - - -',
        stab2: 'E4 - - - D4 - - - C4 - - - E4 - F4 - E4 -',
        bass: 'A2 - - - G2 - - - F2 - - - E2 - - - - -',
        drums: 'k . . . . . . . . . . . k . . . . .',
      },
    },
  },
  order: ['lost'],
};

export const SONGS: Record<SongName, Song> = { title, hub, briefing, battle, battle2, boss, arena, ending, victory, defeat };
