/**
 * How well the handheld is keeping up. Nobody who made the game has held the handheld it is for;
 * the soft light the game draws costs the graphics chip real work, and if that chip cannot do it
 * sixty times a second the game has to notice by itself and give light up before it gives
 * smoothness up. This watches the time between one frame and the next and says how much light
 * there is to be: all of it, less, or none.
 *
 * Giving light up has to buy something. A handheld can be slow for reasons that have nothing to
 * do with light (a screen that shows thirty frames a second, a setting that saves power), and one
 * like that would lose its light and gain nothing. So once everything has been given up and the
 * frames are no better for it, the light goes back to where it was, once, and stays there.
 */

/** How much of the soft light is drawn: all of it, less of it, or none. */
export type Detail = 2 | 1 | 0;

/** How many frames are looked at together. */
export const WINDOW = 90;
/** A frame that took this long or longer was late: on a screen that shows sixty a second, it missed one. */
export const LATE_MS = 25;
/** A window with more than this share of late frames is a slow one. */
export const LATE_SHARE = 0.2;
/** So many slow windows in a row, and a step of light is given up. */
export const SLOW_WINDOWS = 3;
/** A gap longer than this is no frame: the game was put aside, and the window it fell in starts again. */
export const PAUSE_MS = 250;
/** The first frames of a session are not judged: pictures are still being unpacked and everything is drawn for the first time. */
export const WARM_UP = 120;
/** Giving light up helped when late frames became rarer than this share of what they were... */
export const HELPED = 0.75;
/** ...or when frames came to take less than this share of the time they took. */
export const SHORTER = 0.85;

const NOTHING_SLOW = { windows: 0, late: 0, took: 0 };

export class Pace {
  /** How much light there is to be. */
  level: Detail;
  /** False once there is nothing more to find out this session: what the level is then, it stays. */
  judging: boolean;
  private seen = 0;
  private inWindow = 0;
  private late = 0;
  private took = 0;
  /** The slow windows that have followed each other: how many, their late frames, and the time they took. */
  private slow = NOTHING_SLOW;
  /** A coming down that has not yet been seen to help: where it began, and the frames that began it. */
  private descent: { from: Detail; late: number; took: number } | null = null;
  /** The time the last frames took, for the count of frames a second. */
  private recent: number[] = [];

  /** Starts with so much light. A session that is not to `judge`, or has no light to give up, only counts its frames. */
  constructor(start: Detail = 2, judge = true) {
    this.level = start;
    this.judging = judge && start > 0;
  }

  /**
   * Takes the time since the frame before, in milliseconds. True when that changed how much light
   * there is to be. A frame that is not to be judged (the player has chosen how much light there is)
   * is only counted.
   */
  frame(gapMs: number, judge = true): boolean {
    if (!(gapMs > 0)) return false;
    if (gapMs > PAUSE_MS || !judge) {
      // Put aside and taken up again: what was counted before does not belong with what comes after.
      if (gapMs <= PAUSE_MS) this.count(gapMs);
      this.inWindow = 0;
      this.late = 0;
      this.took = 0;
      this.slow = NOTHING_SLOW;
      return false;
    }
    this.count(gapMs);
    if (!this.judging) return false;
    if (this.seen < WARM_UP) { this.seen++; return false; }
    this.inWindow++;
    this.took += gapMs;
    if (gapMs >= LATE_MS) this.late++;
    if (this.inWindow < WINDOW) return false;
    if (this.late / WINDOW > LATE_SHARE) {
      this.slow = { windows: this.slow.windows + 1, late: this.slow.late + this.late, took: this.slow.took + this.took };
    } else {
      // A window in which it kept up: where the light is now is good enough, and what was given up helped.
      this.slow = NOTHING_SLOW;
      this.descent = null;
    }
    this.inWindow = 0;
    this.late = 0;
    this.took = 0;
    if (this.slow.windows < SLOW_WINDOWS) return false;
    const spell = this.slow;
    this.slow = NOTHING_SLOW;
    if (this.level > 0) {
      this.descent ??= { from: this.level, late: spell.late, took: spell.took };
      this.level = (this.level - 1) as Detail;
      return true;
    }
    // Nothing is left to give up, and it is slow still: there is no more to find out. Where it has
    // come straight down and gained nothing by it, the light was not what it is slow at.
    this.judging = false;
    const was = this.descent;
    if (!was || spell.late < was.late * HELPED || spell.took < was.took * SHORTER) return false;
    this.level = was.from;
    return true;
  }

  private count(gapMs: number): void {
    this.recent.push(gapMs);
    if (this.recent.length > 30) this.recent.shift();
  }

  /** How many frames a second the last half second or so came to. */
  get fps(): number {
    if (this.recent.length === 0) return 0;
    const mean = this.recent.reduce((sum, gap) => sum + gap, 0) / this.recent.length;
    return Math.round(1000 / mean);
  }
}
