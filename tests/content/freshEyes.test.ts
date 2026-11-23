import { BOARD_TEXT } from '../../src/content/board';
import { MANUAL, UNITS } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { dictionaryOf, setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { PANEL_CHARS, PANEL_LINES } from '../../src/ui/trainingScreen';
import { wrap } from '../../src/ui/widgets';

/**
 * What four testers who had not seen the game found in a play-through of the whole of it, held so
 * that it stays mended: the words of the game, in both languages, against the room they are drawn in.
 */
afterEach(() => setLanguage('en'));
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

describe('the manual, in the order a pilot comes to need it', () => {
  const at = (id: string): number => {
    const index = MANUAL.findIndex((topic) => topic.id === id);
    expect(index, id).toBeGreaterThanOrEqual(0);
    return index;
  };

  test('it opens on the buttons and the short words, not on the fiftieth page', () => {
    expect(MANUAL.slice(0, 3).map((topic) => topic.id)).toEqual(['controls', 'words', 'words-guns']);
  });

  test('what a first hour asks comes before what the open board brings, and the long game stands last', () => {
    const firstHour = ['basics', 'turn', 'aim', 'parts', 'types', 'heat', 'boost', 'guard', 'stagger', 'repairs', 'ranks', 'money', 'garage'];
    const board = ['momentum', 'shatter', 'rout', 'swarm', 'jobs', 'accounts', 'range', 'gauntlet'];
    const longGame = ['works', 'cups', 'crowns', 'masters', 'seat', 'cycle'];
    const last = (ids: string[]): number => Math.max(...ids.map(at));
    const first = (ids: string[]): number => Math.min(...ids.map(at));
    expect(last(firstHour)).toBeLessThan(first(board));
    expect(last(board)).toBeLessThan(first(longGame));
    expect(at('cycle')).toBe(MANUAL.length - 1);
  });

  test('the legend names every short word a part\'s lines and the battle\'s panel use, in English and in Dutch', () => {
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const legend = `${MANUAL[at('words')].text} ${MANUAL[at('words-guns')].text}`;
      const P = S.partInfo;
      const words = [P.ap, P.weight, P.drain, P.resist, P.capacity, P.mobility, P.output, P.cooling, P.damage, P.accuracy, P.energy, P.heat,
        P.ammo, P.impact, P.aim, P.focus, P.thrust, P.boostCost, S.tags.stability, S.garage.mobility];
      expect(words.filter((word) => !legend.includes(word)).map((word) => `${language}: ${word}`)).toEqual([]);
      // And the three letters of the kinds of damage, as the lines write them.
      expect(legend).toContain(`K/${P.typeLetters.energy}/${P.typeLetters.explosive}`);
    }
  });
});
