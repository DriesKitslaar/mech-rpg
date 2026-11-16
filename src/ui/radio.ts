import type { BattleEvent, BattleState } from '../core/battle';
import type { RadioCue } from '../core/wingman';

/** How long a line stays up. */
export const RADIO_MS = 2600;
/**
 * The widest a line may be with its speaker's name. The strip starts 8 from the left edge of the
 * field and a letter is 4 wide: with its margins it must end by 172, where the bars of a mech
 * standing lowest begin.
 */
export const RADIO_CHARS = 39;
/** The pilot's core below this share of its armour is worth a warning. */
export const RADIO_WARN = 0.35;
/** Which of the pilot's kills the wingman remarks on: the first, and every third after it. */
export const cheered = (kills: number): boolean => kills % 3 === 1;

/** A line as it is written on the field. */
export const radioText = (who: string, text: string): string => `${who.toUpperCase()}: ${text}`;

/**
 * What a hired wingman says over the radio during a battle. They speak up when the battle opens,
 * when their own shot finishes a machine, now and then when the pilot's does, once when the pilot's
 * core is getting thin, and when the battle is won. A line stays up a moment and is never waited for:
 * it takes no press, holds nothing up, and the next one simply replaces it.
 */
export class Radio {
  /** What is being said, if anything. */
  line: string | null = null;
  private left = 0;
  private kills = 0;
  private warned = false;
  /** Whose fire landed last: the wingman's, the pilot's, or anybody else's (an enemy's shot, a bomb going off). */
  private last: 'wing' | 'pilot' | 'other' = 'other';
  private fresh = 0;

  constructor(private who: string, private lines: Record<RadioCue, string>) {}

  private say(cue: RadioCue): void {
    this.line = radioText(this.who, this.lines[cue]);
    this.left = RADIO_MS;
    this.fresh += 1;
  }

  /** The battle opens. */
  open(): void {
    this.say('start');
  }

  /** An event of the battle as it is shown; `state` is the battle as it stands after the action the event belongs to. */
  hear(event: BattleEvent, state: BattleState): void {
    if (event.type === 'support') this.last = 'wing';
    else if (event.type === 'shot' || event.type === 'module') this.last = event.unit === state.units[0].id ? 'pilot' : 'other';
    else if (event.type === 'blast') this.last = 'other';
    if (event.type === 'outcome') {
      if (event.outcome === 'victory') this.say('win');
      return;
    }
    if (event.type === 'unitDestroyed') {
      if (state.units.find((u) => u.id === event.unit)?.side !== 'enemy') return;
      if (this.last === 'wing') return this.say('kill');
      // A bomb that went off, or anything else the pilot did not do, is nobody's kill.
      if (this.last !== 'pilot') return;
      this.kills += 1;
      if (cheered(this.kills)) this.say('cheer');
      return;
    }
    // A hit on the pilot that leaves the core thin is worth a word, once a battle.
    const hurt = (event.type === 'shot' && event.hit && event.target === 'player') || (event.type === 'blast' && event.target === 'player' && event.damage > 0);
    const core = state.units[0].parts.core;
    if (hurt && !this.warned && core && core.ap > 0 && core.ap < core.maxAp * RADIO_WARN) {
      this.warned = true;
      this.say('warn');
    }
  }

  update(ms: number): void {
    if (this.line && (this.left -= ms) <= 0) this.line = null;
  }

  /** How many lines have come up since this was last asked: each is worth a sound. */
  takeFresh(): number {
    const n = this.fresh;
    this.fresh = 0;
    return n;
  }
}
