/** A short label for something that is on a unit right now. */
export interface Tag {
  text: string;
  color: string;
  /** How pressing it is: when a row has no room for every tag, the lowest ranks are left out first. */
  rank: number;
}

/** Tags are written small: four pixels a letter, and five between one tag and the next. */
export const tagWidth = (text: string): number => text.length * 4 + 5;

/** The room a row of tags takes: the gap after the last one does not count. */
const rowWidth = (tags: { text: string }[]): number => (tags.length === 0 ? 0 : tags.reduce((sum, t) => sum + tagWidth(t.text), 0) - 5);

/**
 * The tags that fit in `room` pixels. When there are too many, the least pressing is left out,
 * the later of two equally pressing ones first, until the rest fit. Their order is kept.
 */
export function fitTags<T extends { text: string; rank: number }>(tags: T[], room: number): T[] {
  const kept = [...tags];
  while (kept.length > 0 && rowWidth(kept) > room) {
    let out = 0;
    kept.forEach((t, i) => { if (t.rank <= kept[out].rank) out = i; });
    kept.splice(out, 1);
  }
  return kept;
}
