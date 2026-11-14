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

  test('is written just above the unit, in the middle', () => {
    expect(markPosition(upper, [lower], 24)).toEqual({ x: 258, y: 45, inside: false });
  });

  test('is never written higher than the first row under the message bar', () => {
    expect(markPosition({ x: 200, y: 30, w: 40, h: 40 }, [], 24).y).toBe(26);
  });

  test('is written on the unit itself when the place above it is where another unit\'s bars are', () => {
    // The upper unit's bars run under it from 96 to 102, across where the lower one's mark would go.
    expect(markPosition(lower, [upper], 24)).toEqual({ x: 275, y: 110, inside: true });
    // A unit that is clear of those bars keeps its mark above it.
    expect(markPosition({ ...lower, x: 300 }, [upper], 24).inside).toBe(false);
    expect(markPosition({ ...lower, y: 130 }, [upper], 24).inside).toBe(false);
  });
});
