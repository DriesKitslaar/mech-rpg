import type { Intent } from '../core/intent';
import { STRINGS } from '../content/strings';
import { BARS_H } from './stage';

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

/** A letter of ordinary text is this wide, and the bar's text starts and ends this far from its edges. */
const LETTER = 4.8;
const EDGE = 5;

/**
 * Whether the label at the right end of the message bar (which battle of the contract this is) can be
 * shown beside the message: a message that needs the room has it, and the label waits.
 */
export function labelFits(message: string, label: string, width = 310): boolean {
  return EDGE + message.length * LETTER + LETTER <= width - EDGE - label.length * LETTER;
}

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Where the small mark over a unit on the field is written (a fuse, a charge, the contract's
 * target): centred just above it, but not on the bars of another unit that stands higher up.
 * Where it would be, it is written on the unit itself. `bars` are the others' bars where they were
 * put (`placeBars`): bars that were moved down out of each other's way are kept clear of where they are.
 */
export function markPosition(unit: Box, bars: { x: number; y: number; w: number }[], textWidth: number): { x: number; y: number; inside: boolean } {
  const x = Math.round(unit.x + unit.w / 2);
  const y = Math.max(26, unit.y - 10);
  const left = x - textWidth / 2;
  const right = x + textWidth / 2;
  // A row of text is nine pixels high; bars are kept a pixel clear above and below.
  const onBars = bars.some((bar) => left < bar.x + bar.w && right > bar.x && y < bar.y + BARS_H + 1 && y + 9 > bar.y - 1);
  return onBars ? { x, y: unit.y + 2, inside: true } : { x, y, inside: false };
}


/**
 * The word for what an enemy is about to do. A fuse, a charge and a stagger have tags of their own,
 * so nothing more is said about those.
 */
export function intentText(intent: Intent | null): string | null {
  if (!intent) return null;
  switch (intent.kind) {
    case 'aim': return STRINGS.intent.aim(intent.part);
    case 'dart': return STRINGS.intent.dart;
    case 'mend': return STRINGS.intent.mend;
    case 'cool': return STRINGS.intent.cool;
    // A charge already held has its own tag; this is the turn spent winding one up.
    case 'charge': return STRINGS.intent.windUp;
    default: return null;
  }
}
