import { placeBars } from '../../src/ui/stage';
import { fitTags, labelFits, markPosition, tagWidth } from '../../src/ui/tags';

const tag = (text: string, rank: number) => ({ text, rank, color: '#fff' });

test('a tag is as wide as its letters and the gap after it', () => {
  expect(tagWidth('GUARD')).toBe(25);
  expect(tagWidth('BARRIER 170')).toBe(49);
});

test('tags that fit are all kept, in their order', () => {
  const tags = [tag('CARRIER', 2), tag('CHARGING', 8), tag('BARRIER 170', 7)];
  expect(fitTags(tags, 200)).toEqual(tags);
  // The gap after the last one needs no room.
  expect(fitTags(tags, 33 + 37 + 49 - 5)).toEqual(tags);
});

test('with too little room the least pressing go first, and the rest keep their order', () => {
  const tags = [tag('CARRIER', 2), tag('CHARGING', 8), tag('BARRIER 170', 7)];
  expect(fitTags(tags, 90).map((t) => t.text)).toEqual(['CHARGING', 'BARRIER 170']);
  expect(fitTags(tags, 60).map((t) => t.text)).toEqual(['CHARGING']);
  expect(fitTags(tags, 10)).toEqual([]);
});

test('of two equally pressing tags the later one goes first', () => {
  const tags = [tag('PAINTED', 3), tag('CHAFF', 3), tag('GUARD', 6)];
  expect(fitTags(tags, 60).map((t) => t.text)).toEqual(['PAINTED', 'GUARD']);
});

test('the input is not changed', () => {
  const tags = [tag('CARRIER', 2), tag('CHARGING', 8)];
  fitTags(tags, 40);
  expect(tags.map((t) => t.text)).toEqual(['CARRIER', 'CHARGING']);
});

describe('the label at the end of the message bar', () => {
  test('is shown beside a message that leaves it room', () => {
    expect(labelFits('Round 1 - your move', 'ENGAGEMENT 1/2')).toBe(true);
    expect(labelFits('', 'ENGAGEMENT 1/2')).toBe(true);
  });

  test('makes way for a message that needs the room: nothing is written over anything', () => {
    const long = 'Your Thermal Cutter hits Colossus Juggernaut: Core -112';
    expect(long.length * 4.8 + 5).toBeGreaterThan(310 - 5 - 'ENGAGEMENT 1/2'.length * 4.8);
    expect(labelFits(long, 'ENGAGEMENT 1/2')).toBe(false);
    // A gap of a letter or so is kept between the two.
    const edge = 'x'.repeat(Math.floor((310 - 10 - 14 * 4.8) / 4.8));
    expect(labelFits(edge, 'ENGAGEMENT 1/2')).toBe(false);
    expect(labelFits(edge.slice(2), 'ENGAGEMENT 1/2')).toBe(true);
  });
});

describe('the mark over a unit on the field', () => {
  const upper = { x: 228, y: 55, w: 60, h: 40 };
  const lower = { x: 255, y: 108, w: 40, h: 62 };
  /** The bars under each, where a field with only the two of them puts them. */
  const [upperBars, lowerBars] = placeBars([upper, lower]);

  test('is written just above the unit, in the middle', () => {
    expect(markPosition(upper, [lowerBars], 24)).toEqual({ x: 258, y: 45, inside: false });
  });

  test('is never written higher than the first row under the message bar', () => {
    expect(markPosition({ x: 200, y: 30, w: 40, h: 40 }, [], 24).y).toBe(26);
  });

  test('is written on the unit itself when the place above it is where another unit\'s bars are', () => {
    // The upper unit's bars run under it from 97 to 101, across where the lower one's mark would go.
    expect(upperBars).toEqual({ x: 236, y: 97, w: 44 });
    expect(markPosition(lower, [upperBars], 24)).toEqual({ x: 275, y: 110, inside: true });
    // A unit that is clear of those bars keeps its mark above it: to the side of them, or far enough under them.
    expect(markPosition({ ...lower, x: 300 }, [upperBars], 24).inside).toBe(false);
    expect(markPosition({ ...lower, y: 130 }, [upperBars], 24).inside).toBe(false);
  });

  test('keeps clear of bars where they are, a pixel all round: to the pixel on every side', () => {
    const unit = { x: 200, y: 100, w: 40, h: 40 };
    // Its mark is 24 wide round 220, from 208 to 232, and nine high from 90.
    const clear = (bar: { x: number; y: number; w: number }): boolean => !markPosition(unit, [bar], 24).inside;
    expect(clear({ x: 232, y: 90, w: 30 })).toBe(true);
    expect(clear({ x: 231, y: 90, w: 30 })).toBe(false);
    expect(clear({ x: 178, y: 90, w: 30 })).toBe(true);
    expect(clear({ x: 179, y: 90, w: 30 })).toBe(false);
    // Over it: bars four high with a pixel to spare end five rows above. Under it: a pixel under its nine rows.
    expect(clear({ x: 210, y: 85, w: 30 })).toBe(true);
    expect(clear({ x: 210, y: 86, w: 30 })).toBe(false);
    expect(clear({ x: 210, y: 100, w: 30 })).toBe(true);
    expect(clear({ x: 210, y: 99, w: 30 })).toBe(false);
  });

  test('bars that were moved down out of the way of others are kept clear of where they were moved to', () => {
    // Two machines side by side with a third in front between them: the third's bars would lie on the others' and are moved down.
    const boxes = [{ x: 170, y: 60, w: 60, h: 40 }, { x: 236, y: 60, w: 60, h: 40 }, { x: 205, y: 62, w: 50, h: 40 }];
    const bars = placeBars(boxes);
    expect(bars[2].y).toBeGreaterThan(boxes[2].y + boxes[2].h + 2);
    expect(bars[2].y - (boxes[2].y + boxes[2].h + 2)).toBe(3);
    // A fourth thing whose mark would be written where the third's bars are now, and under where they would have been.
    const low = { x: 210, y: bars[2].y + 13, w: 40, h: 30 };
    expect(markPosition(low, [bars[2]], 24).inside).toBe(true);
    expect(markPosition(low, [{ ...bars[2], y: boxes[2].y + boxes[2].h + 2 }], 24).inside).toBe(false);
  });
});
