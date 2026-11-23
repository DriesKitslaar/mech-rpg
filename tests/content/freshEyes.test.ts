import { BOARD_TEXT } from '../../src/content/board';
import { UNITS } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { dictionaryOf } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { PANEL_CHARS, PANEL_LINES } from '../../src/ui/trainingScreen';
import { wrap } from '../../src/ui/widgets';

/**
 * What four testers who had not seen the game found in a play-through of the whole of it, held so
 * that it stays mended: the words of the game, in both languages, against the room they are drawn in.
 */
const nl = dictionaryOf('nl');
const dutch = (english: string): string => nl[english] ?? english;
const linesOf = (text: string, chars: number): number => wrap(text, chars).length;

describe('nothing is cut off where a panel draws only so many lines', () => {
  test('what a drill is about is all there in the panel under the list, in English and in Dutch', () => {
    expect([PANEL_CHARS, PANEL_LINES]).toEqual([58, 3]);
    const cut: string[] = [];
    for (const drill of DRILLS) {
      for (const text of [drill.briefing[0], dutch(drill.briefing[0])]) {
        if (linesOf(text, PANEL_CHARS) > PANEL_LINES) cut.push(`${drill.id}: ${text}`);
      }
      // (And it has its Dutch.)
      expect(dutch(drill.briefing[0]), drill.id).not.toBe(drill.briefing[0]);
    }
    expect(cut).toEqual([]);
    for (const strings of [STRINGS, STRINGS_NL]) expect(linesOf(strings.training.lockedNote, PANEL_CHARS)).toBeLessThanOrEqual(PANEL_LINES);
  });

  test('and so is the note of every machine that can stand on the test range', () => {
    expect(UNITS.length).toBeGreaterThan(40);
    const cut: string[] = [];
    for (const unit of UNITS) {
      for (const text of [unit.note, dutch(unit.note)]) {
        if (linesOf(text, PANEL_CHARS) > PANEL_LINES) cut.push(`${unit.id}: ${text}`);
      }
    }
    expect(cut).toEqual([]);
  });
});

describe('an escort\'s title does not say what the freight is: that is the place\'s to say', () => {
  test('no title of an escort has a word of any freight in it, in English or in Dutch: it may be drawn with any of them', () => {
    const titles = BOARD_TEXT.jobs.escort.titles;
    expect(titles).toHaveLength(5);
    expect(BOARD_TEXT.assets).toHaveLength(4);
    const clash: string[] = [];
    for (const title of titles) {
      for (const asset of BOARD_TEXT.assets) {
        for (const [t, a] of [[title, asset], [dutch(title), dutch(asset)]]) {
          const words = a.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
          if (words.some((word) => t.toLowerCase().includes(word))) clash.push(`${t} / ${a}`);
        }
      }
      expect(dutch(title), title).not.toBe(title);
      expect(title.length, title).toBeLessThanOrEqual(18);
      expect(dutch(title).length, dutch(title)).toBeLessThanOrEqual(18);
    }
    expect(clash).toEqual([]);
  });
});
