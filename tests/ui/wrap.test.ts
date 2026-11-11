import { wrap } from '../../src/ui/widgets';

test('text is broken at spaces to fit the width', () => {
  expect(wrap('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
});

test('short text stays on one line and empty text gives no lines', () => {
  expect(wrap('hello', 10)).toEqual(['hello']);
  expect(wrap('', 10)).toEqual([]);
});

test('a word longer than the width is split rather than lost', () => {
  expect(wrap('abcdefghijkl mn', 5)).toEqual(['abcde', 'fghij', 'kl mn']);
});

test('several spaces count as one', () => {
  expect(wrap('a   b', 10)).toEqual(['a b']);
});
