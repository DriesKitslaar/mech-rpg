import { BOARD_TEXT } from '../../src/content/board';
import { MANUAL, UNITS, WORLD } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { dictionaryOf, figure, setLanguage } from '../../src/content/language';
import { listTitle } from '../../src/content/titles';
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
    const longGame = ['works', 'rematches', 'cups', 'crowns', 'masters', 'seat', 'cycle'];
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

describe('Dutch, as a Dutch reader reported it', () => {
  /** Every text of the Dutch interface, by its path; a function is called with stand-ins to see what it says. */
  function leaves(table: unknown, path = ''): { path: string; text: string }[] {
    if (typeof table === 'string') return [{ path, text: table }];
    if (Array.isArray(table)) return table.flatMap((item, i) => leaves(item, `${path}[${i}]`));
    if (typeof table === 'function') {
      const out: { path: string; text: string }[] = [];
      for (const args of [['Old Sixty', 'Ripper Claw', 'Core', 88], [3, 12, 'ABCDEFGH', 5], ['head', 4]]) {
        try {
          const said = (table as (...a: unknown[]) => unknown)(...args);
          if (typeof said === 'string') out.push({ path, text: said });
          else if (Array.isArray(said)) out.push(...said.filter((line): line is string => typeof line === 'string').map((text) => ({ path, text })));
        } catch { /* not the kind of argument this one takes */ }
      }
      return out;
    }
    if (typeof table === 'object' && table !== null) return Object.entries(table).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
    return [];
  }
  const interfaceTexts = leaves(STRINGS_NL);
  const everything = [...interfaceTexts.map((leaf) => leaf.text), ...Object.values(nl)];

  test('it is spelt with its accents: the font has them, and a word without them is a misspelling', () => {
    const plain = /barriere|relikwieen|tweeenhalf|kopieen|clienten|\bEfficient\b|ideeen|financiele|officiele|categorieen/i;
    expect(everything.filter((text) => plain.test(text))).toEqual([]);
    expect(everything.some((text) => text.includes('barrière'))).toBe(true);
    expect(dutch('ELITES AND RELICS')).toBe('ELITES, RELIKWIEËN');
  });

  test('the buttons of the cross have Dutch names in every hint', () => {
    expect(interfaceTexts.filter((leaf) => /UP\/DOWN|\bLEFT\b|\bRIGHT\b/.test(leaf.text)).map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
    expect(STRINGS_NL.coach.action).toMatch(/^OP\/NEER: /);
    expect(STRINGS_NL.training.rangeHint).toMatch(/^LINKS\/RECHTS: /);
  });

  test('a figure with a tenth has a comma in Dutch and a point in English', () => {
    expect(figure(39.9)).toBe('39.9');
    setLanguage('nl');
    expect(figure(39.9)).toBe('39,9');
    expect(figure(40)).toBe('40');
    expect(figure('1.5')).toBe('1,5');
    // And no Dutch text writes one with a point.
    expect(everything.filter((text) => /\d\.\d/.test(text))).toEqual([]);
  });

  test('one word for one thing: a run of the Gauntlet is not a chain of kills, and the perk is not the class', () => {
    expect(STRINGS_NL.fx.chain(2)).toBe('REEKS x2');
    const gauntlet = leaves(STRINGS_NL.gauntlet).map((leaf) => leaf.text);
    expect(gauntlet.filter((text) => /reeks/i.test(text))).toEqual([]);
    expect(STRINGS_NL.gauntlet.start).toBe('Start afdaling');
    expect(dutch('Marksman')).toBe('Vaste hand');
    expect(dutch('Marksman')).not.toBe(STRINGS_NL.classes.names.marksman);
    // The place a game is kept in is not the word for locked, nor for where a part goes.
    expect(STRINGS_NL.titleScreen.pickNew).toBe('START OP WELKE PLEK?');
    expect(STRINGS_NL.arena.locked).toBe('OP SLOT');
    // Won is said one way: a count of wins is ZEGES, a thing that is won is GEWONNEN.
    expect([STRINGS_NL.classes.won, STRINGS_NL.arena.cups.won, STRINGS_NL.hub.battlesWon]).toEqual(['ZEGES', 'GEWONNEN', 'CONTRACTEN GEWONNEN']);
    expect(interfaceTexts.filter((leaf) => /\bWINST\b/.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
  });

  test('what a page counts has a plural, and nothing is cut short where there is room for the word', () => {
    expect(STRINGS_NL.database.pages).toMatchObject({ units: 'EENHEDEN', people: 'MENSEN', finds: 'VONDSTEN' });
    expect(STRINGS_NL.pilot.pages.medals).toBe('MEDAILLES');
    expect(STRINGS_NL.database.found(16, 40)).toBe('VONDSTEN 16/40');
    expect(interfaceTexts.filter((leaf) => /\bNwe\b|\bVerk\.|CONTR\.|\bLVL\b/.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
  });
});

describe('a title kept in capitals, as a list writes it', () => {
  test('in English as a title: every word but the small ones inside it', () => {
    const cases: [string, string][] = [
      ['KINDS OF WORK', 'Kinds of Work'], ['WHAT IS FOUND', 'What Is Found'], ['THE EIGHTH SEAT', 'The Eighth Seat'],
      ['BOOST AND BLADES', 'Boost and Blades'], ['A NAME', 'A Name'], ['A NEW CYCLE', 'A New Cycle'], ['THE STRIP-MINER', 'The Strip-Miner'],
      ['POLICY VRN-1', 'Policy VRN-1'], ['APPENDIX C', 'Appendix C'], ['SHORT WORDS: GUNS', 'Short Words: Guns'], ['THE WAY DOWN', 'The Way Down'],
    ];
    for (const [kept, written] of cases) expect(listTitle(kept, 'en'), kept).toBe(written);
  });

  test('in Dutch as a sentence: the first word and the names', () => {
    const cases: [string, string][] = [
      ['BOOST EN KLINGEN', 'Boost en klingen'], ['FRAMES VAN DE WERF', 'Frames van de werf'], ['WAT GEVONDEN IS', 'Wat gevonden is'],
      ['LEVELS EN PERKS', 'Levels en perks'], ['ZE VLUCHTEN', 'Ze vluchten'], ['VRIJE FRAMES', 'Vrije frames'], ['DRIE BONNEN', 'Drie bonnen'],
      ['HADRON MINING', 'Hadron Mining'], ['DE UNDERTOW', 'De Undertow'], ['DE STRIP-MINER', 'De Strip-Miner'], ['MERIDIAN MUTUAL', 'Meridian Mutual'],
      ['THE ACTUARY', 'The Actuary'], ['DE GAUNTLET', 'De Gauntlet'], ['POLIS VRN-1', 'Polis VRN-1'], ['BIJLAGE C', 'Bijlage C'],
      ['ELITES, RELIKWIEËN', 'Elites, relikwieën'], ['AFKORTINGEN: WAPEN', 'Afkortingen: wapen'], ['DE ACHTSTE STOEL', 'De achtste stoel'],
    ];
    for (const [kept, written] of cases) expect(listTitle(kept, 'nl'), kept).toBe(written);
  });

  test('every page of the world keeps the capital of the name it is called after, and no other word has one', () => {
    setLanguage('nl');
    const written = WORLD.map((entry) => listTitle(entry.title));
    expect(written).toEqual([
      'Varn', 'De licentie', 'Dispatch', 'Hadron Mining', 'Lumen Systems', 'De Undertow', 'Vrije frames', 'De arena', 'De achterkamer', 'Ashfall',
      'De oorlog', 'De sluizen', 'Sable', 'Rook', 'Krell', 'Leviathan', 'De Strip-Miner', 'De Overseer', 'Meridian Mutual', 'De Auditors',
      'The Actuary', 'Incasso', 'De Adjuster', 'De Society',
    ]);
  });

  test('a contract the board makes up is written the same way: in Dutch its noun has no capital', () => {
    setLanguage('nl');
    for (const noun of BOARD_TEXT.nouns) expect(noun, noun).toBe(noun.toLowerCase());
    for (const adjective of BOARD_TEXT.adjectives) expect(adjective[0], adjective).toBe(adjective[0].toUpperCase());
    setLanguage('en');
    for (const noun of BOARD_TEXT.nouns) expect(noun[0], noun).toBe(noun[0].toUpperCase());
  });
});
