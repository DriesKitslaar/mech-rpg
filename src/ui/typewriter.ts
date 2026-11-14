/** How fast text writes itself out when nothing says otherwise, in characters a second. */
export const TYPING_SPEED = 90;

/**
 * Text that writes itself out, a line at a time. It only keeps count: the screen draws what
 * `visible()` returns. `instant` writes everything at once, for tests and impatient modes.
 */
export class Typewriter {
  private shown = 0;
  private readonly total: number;

  constructor(private lines: string[], private charsPerSecond = TYPING_SPEED, instant = false) {
    this.total = lines.reduce((sum, line) => sum + line.length, 0);
    if (instant) this.shown = this.total;
  }

  get done(): boolean {
    return this.shown >= this.total;
  }

  /** Writes on for the given time. Returns how many whole characters appeared, for the sound of typing. */
  update(dtMs: number): number {
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.total, this.shown + (dtMs / 1000) * this.charsPerSecond);
    return Math.floor(this.shown) - before;
  }

  finish(): void {
    this.shown = this.total;
  }

  /** Each line as far as it has been written. */
  visible(): string[] {
    let left = Math.floor(this.shown);
    return this.lines.map((line) => {
      const part = line.slice(0, left);
      left -= part.length;
      return part;
    });
  }
}
