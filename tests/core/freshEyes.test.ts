import { heldAlready } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { FINDS } from '../../src/content/finds';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/** What four testers who had not seen the game found in its rules, held so that it stays mended. */
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const ORDER = FINDS.find((find) => find.id === 'paper-order')!;

describe('an answer that hands over something the pilot already holds', () => {
  test('names it: the find the answer is good for, where it was held before the answer was given', () => {
    expect(ORDER.after).toBe('s:hadron-1&finale|chose:seam=stand');
    const before: GameState = { ...fresh(), codex: ['paper-order'] };
    const after: GameState = { ...before, choices: { seam: 'stand' } };
    expect(heldAlready(before, after, FINDS).map((find) => find.id)).toEqual(['paper-order']);
  });

  test('nothing where the find is new with the answer, where the answer is another, or where it was given before', () => {
    const empty = fresh();
    expect(heldAlready(empty, { ...empty, choices: { seam: 'stand' } }, FINDS)).toEqual([]);
    const holding: GameState = { ...fresh(), codex: ['paper-order'] };
    expect(heldAlready(holding, { ...holding, choices: { seam: 'clear' } }, FINDS)).toEqual([]);
    expect(heldAlready(holding, { ...holding, choices: { other: 'stand' } }, FINDS)).toEqual([]);
    const answered: GameState = { ...holding, choices: { seam: 'stand' } };
    expect(heldAlready(answered, answered, FINDS)).toEqual([]);
    expect(heldAlready(answered, { ...answered, battlesWon: 9 }, FINDS)).toEqual([]);
    // And nothing where there was no game before.
    expect(heldAlready(null, answered, FINDS)).toEqual([]);
  });

  test('an answer that is only part of what a find asks for is good for it all the same: it is what the answer hands over', () => {
    const both = FINDS.filter((find) => find.after.split('|').some((way) => way.split('&').length > 1 && way.includes('chose:')));
    expect(both.length).toBeGreaterThan(0);
    for (const find of both) {
      const way = find.after.split('|').find((w) => w.includes('chose:'))!;
      const [question, answer] = way.split('&').find((term) => term.startsWith('chose:'))!.slice('chose:'.length).split('=');
      const before: GameState = { ...fresh(), codex: [find.id] };
      expect(heldAlready(before, { ...before, choices: { [question]: answer } }, FINDS).map((f) => f.id), find.id).toContain(find.id);
    }
  });
});
