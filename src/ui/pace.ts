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
 * frames are no better for it, the light goes back to where it was, once, and stays there. That
 * is only concluded where like is held against like: of one screen, not of two.
 */

/** How much of the soft light is drawn: all of it, less of it, or none. */
export type Detail = 2 | 1 | 0;

/** How many frames are looked at together... */
export const WINDOW = 90;
/** ...and for how long at most: a handheld is not kept waiting longer for being slow. Ninety frames at sixty a second. */
export const WINDOW_MS = 1500;
/** A frame that took this long or longer was late: on a screen that shows sixty a second, it missed one. */
export const LATE_MS = 25;
/** A window with more than this share of late frames is a slow one. */
export const LATE_SHARE = 0.2;
/** So many slow windows in a row, and a step of light is given up. */
export const SLOW_WINDOWS = 3;
/** A gap longer than this is no frame: the game was put aside, and the window it fell in starts again. */
export const PAUSE_MS = 1000;
/**
 * The first frames of a session are not judged: pictures are still being unpacked and everything
 * is drawn for the first time. So many frames, or so long, whichever is over first.
 */
export const WARM_UP = 120;
export const WARM_UP_MS = 2000;
/** Giving light up helped when late frames became rarer than this share of what they were... */
export const HELPED = 0.75;
/** ...or when frames came to take less than this share of the time they took. */
export const SHORTER = 0.85;
/** So many windows on end in which it kept up, and it is steady at the light it has. */
export const STEADY = 10;

/** A run of slow windows: how many, the frames they had, how many of those were late, the time they took, and the longest of them. */
interface Spell { windows: number; frames: number; late: number; took: number; longest: number }
const NOTHING_SLOW: Spell = { windows: 0, frames: 0, late: 0, took: 0, longest: 0 };

export class Pace {
  /** How much light there is to be. */
  level: Detail;
  /** False once there is nothing more to find out this session: what the level is then, it stays. */
  judging: boolean;
  private seen = 0;
  private warmed = 0;
  private inWindow = 0;
  private late = 0;
  private took = 0;
  private longest = 0;
  /** The slow windows that have followed each other. */
  private slow = NOTHING_SLOW;
  /** The windows in which it kept up that have followed each other. */
  private good = 0;
  /** A coming down that has not yet been seen to help: where it began, and the frames that began it. */
  private descent: { from: Detail; frames: number; late: number; took: number; longest: number } | null = null;
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
      this.longest = 0;
      this.slow = NOTHING_SLOW;
      this.good = 0;
      return false;
    }
    this.count(gapMs);
    if (!this.judging) return false;
    if (this.seen < WARM_UP && this.warmed < WARM_UP_MS) { this.seen++; this.warmed += gapMs; return false; }
    this.inWindow++;
    this.took += gapMs;
    if (gapMs >= LATE_MS) this.late++;
    if (gapMs > this.longest) this.longest = gapMs;
    if (this.inWindow < WINDOW && this.took < WINDOW_MS) return false;
    if (this.late / this.inWindow > LATE_SHARE) {
      this.slow = {
        windows: this.slow.windows + 1, frames: this.slow.frames + this.inWindow, late: this.slow.late + this.late,
        took: this.slow.took + this.took, longest: Math.max(this.slow.longest, this.longest),
      };
      this.good = 0;
    } else {
      // A window in which it kept up: where the light is now is good enough, and what was given up helped.
      this.slow = NOTHING_SLOW;
      this.descent = null;
      this.good++;
    }
    this.inWindow = 0;
    this.late = 0;
    this.took = 0;
    this.longest = 0;
    if (this.slow.windows < SLOW_WINDOWS) return false;
    const spell = this.slow;
    this.slow = NOTHING_SLOW;
    if (this.level > 0) {
      this.descent ??= { from: this.level, frames: spell.frames, late: spell.late, took: spell.took, longest: spell.longest };
      this.level = (this.level - 1) as Detail;
      return true;
    }
    // Nothing is left to give up, and it is slow still: there is no more to find out. Where it has
    // come straight down and gained nothing by it, the light was not what it is slow at. The two
    // spells did not have as many frames (shorter frames are more frames to a window), so it is
    // the share of them that was late and the time one of them took that are held side by side.
    this.judging = false;
    const was = this.descent;
    if (!was) return false;
    const rarer = spell.late * was.frames < was.late * HELPED * spell.frames;
    // The longest frame of each spell is left out of its time: one hitch says nothing about the light.
    const shorter = (spell.took - spell.longest) * (was.frames - 1) < (was.took - was.longest) * SHORTER * (spell.frames - 1);
    if (rarer || shorter) return false;
    this.level = was.from;
    return true;
  }

  /**
   * Told that what is on the screen has changed for something else. A coming down that began on
   * the screen before cannot be held against what is seen on this one: whatever is found at the
   * bottom now, nothing is concluded from it about the light. The windows go on being counted:
   * slow on two screens is slow.
   */
  moved(): void {
    this.descent = null;
  }

  /** True once it has kept up, at the light it has, for a good while on end: what a chance at more light is won by. */
  get steady(): boolean {
    return this.judging && this.good >= STEADY;
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
