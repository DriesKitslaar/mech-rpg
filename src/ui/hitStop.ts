/**
 * The beat a battle skips when something is destroyed: the field stands still for a few frames and
 * flashes, so the blow reads as heavier than the ones before it. Time goes in, and comes out
 * shortened by whatever is being held.
 */
export class HitStop {
  private left = 0;
  private total = 0;
  private fresh = false;

  constructor(private moving = true) {}

  /** Holds the field for this long from now; a hold already running is never cut short. */
  strike(ms: number): void {
    if (!this.moving || ms <= this.left) return;
    this.left = ms;
    this.total = ms;
    this.fresh = true;
  }

  /**
   * Takes the time of a frame and returns how much of it the field may move by. A hold that has just
   * been struck is not eaten by the frame it was struck in: it is seen for at least one drawn frame.
   */
  pass(dtMs: number): number {
    if (this.left <= 0) return dtMs;
    if (this.fresh) { this.fresh = false; return 0; }
    const held = Math.min(this.left, dtMs);
    this.left -= held;
    return dtMs - held;
  }

  /** How white the field is washed, from 0 to 1: strongest at the blow, gone when the hold ends. */
  get flash(): number {
    return this.left > 0 ? 0.55 * (this.left / this.total) : 0;
  }
}
