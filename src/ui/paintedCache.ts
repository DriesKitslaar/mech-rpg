/**
 * The pictures of machines as they are coloured for a paint, each coloured once and kept. For the
 * ready paints that is a number with an end. For a pilot's own mixes it is not: a pilot trying
 * colours asks for a new mix with every press, and every one would be kept for as long as the game
 * runs. So paints of a passing kind are counted, and the pictures of the one asked for longest ago
 * are let go once there are more of them than are kept.
 */

/** How many of the pilot's own mixes have their pictures kept: the three there are to wear, and the one being tried. */
export const MIX_KEPT = 4;

export class PaintedCache<T> {
  private readonly pictures = new Map<string, Map<string, T>>();
  /** The passing paints that have pictures, the one asked for longest ago first. */
  private recent: string[] = [];

  /** `passing` says which paints are let go again: every other paint's pictures are kept for good. */
  constructor(private readonly kept: number, private readonly passing: (paint: string) => boolean) {}

  /** The picture of this sprite in this paint: made now if it has not been, or has been let go. */
  get(sprite: string, paint: string, make: () => T): T {
    let ofPaint = this.pictures.get(paint);
    if (!ofPaint) {
      ofPaint = new Map();
      this.pictures.set(paint, ofPaint);
    }
    if (this.passing(paint)) {
      this.recent = [...this.recent.filter((other) => other !== paint), paint];
      while (this.recent.length > this.kept) this.pictures.delete(this.recent.shift()!);
    }
    if (!ofPaint.has(sprite)) ofPaint.set(sprite, make());
    return ofPaint.get(sprite)!;
  }

  /** How many pictures are kept in all. */
  get size(): number {
    let count = 0;
    for (const ofPaint of this.pictures.values()) count += ofPaint.size;
    return count;
  }
}
