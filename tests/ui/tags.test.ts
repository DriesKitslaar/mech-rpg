import { fitTags, tagWidth } from '../../src/ui/tags';

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
