import { JUKEBOX, MANUAL, PEOPLE } from '../../src/content/codex';
import { ACCENTED, dictionaryOf, registeredTexts, setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { MENU_ROW_CHARS, TALK_CHARS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS } from '../../src/ui/briefingScreen';
import { KIND_CHARS } from '../../src/ui/hubScreen';
import { MESSAGE_CHARS } from '../../src/ui/tags';
import { FIND_CLUE_LINES, FIND_TEXT_LINES, PAGE_CHARS } from '../../src/ui/databaseScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { SCENE_CHARS } from '../../src/ui/sceneScreen';
import { ANSWER_CHARS, TALK_SCENE_CHARS } from '../../src/ui/talkScreen';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * The room each kind of text has. `width`: the text is wrapped at this many characters, and the
 * Dutch may take no more lines than the English does (the English is known to fit), or, where the
 * room is a box of a known height, no more than `lines`. `max`: the text is one line, and the
 * Dutch may be as long as the English or this, whichever is longer.
 */
const ROOM: Record<string, { width?: number; max?: number; lines?: number }> = {
  'mission.title': { max: 18 }, client: { max: 30 }, who: { max: 16 }, asset: { max: 12 },
  briefing: { width: BRIEFING_CHARS }, debrief: { width: charsFor(210) }, 'battle.talk': { width: TALK_CHARS },
  'scene.heading': { max: 22 }, 'scene.title': { max: 14 }, 'scene.lines': { width: SCENE_CHARS },
  'talk.text': { width: TALK_SCENE_CHARS }, answer: { max: ANSWER_CHARS },
  'message.subject': { max: 30 },
  'page.title': { max: 24 }, 'page.text': { width: PAGE_CHARS },
  'drill.lesson': { max: 24 },
  // A frame to start in: the kind of machine it is, beside its name in the list; and what it is, in the panel under it.
  'starter.role': { max: 24 }, 'starter.text': { width: charsFor(LOGICAL_W - 28) },
  'perk.name': { max: 18 }, 'perk.text': { width: charsFor(LOGICAL_W - 28) },
  'medal.name': { max: 20 }, 'medal.text': { width: charsFor(LOGICAL_W - 60) },
  'arena.style': { width: charsFor(LOGICAL_W - 28) }, 'arena.taunt': { width: BRIEFING_CHARS - 2 },
  'board.word': { max: 9 }, 'part.name': { max: 5 },
  // A wingman's line on the radio: how much room it really has depends on their name; see tests/ui/radio.test.ts.
  radio: { max: 30 },
  // Whom somebody works for, on their page of the database.
  'person.role': { max: 20 },
  // A find: where it comes from, on one line under its name; and the clue that stands in for one not found.
  // Its text and its clue stand in a page with room to spare: what they may take is that room, in either language.
  'find.source': { max: 37 }, 'find.clue': { width: PAGE_CHARS, lines: FIND_CLUE_LINES }, 'find.text': { width: PAGE_CHARS, lines: FIND_TEXT_LINES },
};
/**
 * Places of the interface where the Dutch may run more than two letters past the English, because the place is
 * known to hold more: the most letters it holds, and how that is known. A word that is cut short where there is
 * room for it is a fault of its own. Everything that is not listed keeps the rule; what is drawn is held to its
 * screen by `tests/ui/freshEyes.test.ts`, which looks for words that lie over one another.
 */
const ROOM_FOR: Record<string, number> = {
  // A row of the battle's menu, from where its words start to the panel's edge.
  'actions.endTurn': MENU_ROW_CHARS,
  // The new pilot's lines over the field: 75 small letters fit across it (tests/ui/coach.test.ts).
  'coach.target': 75, 'coach.repairPart': 75,
  // The heading of an announcement, in small letters: 150 wide.
  'shop.shelfToast': 30,
  // The heading of a bill, in large letters across a panel that is 230 wide.
  'settlement.rematchWon': 20, 'settlement.rematchLost': 20,
  // Under the figures of a frame to start in: the panel is 150 wide, in small letters.
  'starter.later': 34,
  // A ground's rule stands after its name on one line of the briefing.
  'ground.furnace.note': BRIEFING_CHARS - 16,
  // The Gauntlet's panel is 156 wide and its words start 6 in: 30 letters; a row of its menu starts 8 further in.
  'gauntlet.start': 27, 'gauntlet.abandon': 27, 'gauntlet.draftHeading': 30, 'gauntlet.over': 30,
  // The hub: a row of its menu that has no note beside it, the line under its panel, and the label over a figure
  // of at most five digits in the panel above the menu (144 wide).
  'hub.cycle': 27, 'hub.campaignDone': KIND_CHARS, 'hub.battlesWon': 24,
  // The names of pages, and of what a page counts: a plural is a letter or two more than the English has.
  'pilot.pages.medals': 10, 'database.pages.units': 10, 'database.pages.finds': 10, 'training.pages.drills': 10, 'arena.pages.ladder': 10,
  'medals.heading': 10, 'record.medals': 10, 'arena.cups.won': 10,
  // A row of the record: its label at the left, its figure at the right, half the screen between them.
  'record.contracts': 20, 'record.lost': 20,
  // Under the bar of experience, in small letters, in the middle of the screen.
  'pilot.next': 20,
  // A line of the end roll.
  'credits.roles.ashfall': 24,
};
/**
 * Sentences a function builds around names and figures, where the Dutch words are this many letters more than the
 * English ones and the place has the room: a machine that braces in the message bar (the bar holds 62 letters, the
 * longest name is eighteen), the count of what is found at the foot of its page, and what the shop says of a sale
 * in large letters across its foot (48 letters).
 */
const SLACK_FOR: Record<string, number> = { guard: 9, 'database.found': 3, 'shop.sold': 5 };

/** Kinds that are names: they may stay as they are. Everything else has to be translated. */
const MAY_STAY = new Set(['who', 'client', 'asset', 'part.name', 'board.word', 'scene.heading', 'scene.title', 'mission.title', 'medal.name', 'perk.name', 'page.title', 'person.role']);

/**
 * The letters the game's font is known to write at the width of every other: plain ones, and those Dutch spelling
 * asks for (a browser test holds the font to that: e2e/dutch.spec.ts). Anything else might be drawn from another
 * font, at another width.
 */
const WRITABLE = new RegExp(`^[\\x20-\\x7e${ACCENTED}]*$`);

const texts = registeredTexts();
const nl = dictionaryOf('nl');

describe('Dutch: the content', () => {
  test('every kind of text has its room written down', () => {
    expect([...new Set(texts.map((t) => t.kind))].filter((kind) => !ROOM[kind])).toEqual([]);
    expect(texts.length).toBeGreaterThan(900);
  });

  test('everything that is not a name is translated', () => {
    const missing = [...new Set(texts.filter((t) => !MAY_STAY.has(t.kind) && !Object.hasOwn(nl, t.english)).map((t) => `[${t.kind}] ${t.english}`))];
    expect(missing).toEqual([]);
  });

  test('nothing is in the dictionary that the game does not say', () => {
    const said = new Set(texts.map((t) => t.english));
    expect(Object.keys(nl).filter((english) => !said.has(english))).toEqual([]);
  });

  test('every translation fits the room its English fits', () => {
    const tooBig: string[] = [];
    for (const { english, kind } of texts) {
      const dutch = nl[english];
      if (dutch === undefined) continue;
      const room = ROOM[kind];
      if (!room) continue;
      if (room.width !== undefined) {
        const [had, has] = [room.lines ?? wrap(english, room.width).length, wrap(dutch, room.width).length];
        if (has > had) tooBig.push(`[${kind}] ${has} lines for ${had} at ${room.width}: ${dutch}`);
      } else if (dutch.length > Math.max(english.length, room.max ?? 0)) tooBig.push(`[${kind}] ${dutch.length} for ${Math.max(english.length, room.max ?? 0)}: ${dutch}`);
    }
    expect([...new Set(tooBig)]).toEqual([]);
  });

  test('no translation is empty, has stray spaces, or needs a letter the font may not have', () => {
    for (const [english, dutch] of Object.entries(nl)) {
      expect(dutch.length, english).toBeGreaterThan(0);
      expect(dutch, english).toBe(dutch.trim());
      expect(WRITABLE.test(dutch), dutch).toBe(true);
      // What is quoted or numbered in the English is in the Dutch: figures are rules, not prose.
      const figures = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
      expect(figures(dutch), `${english} -> ${dutch}`).toBe(figures(english));
    }
  });
});

describe('Dutch: titles in the database', () => {
  test('every chapter of the manual has a Dutch title, but for the four words that are the same in both', () => {
    // A page may keep its name, which is why the kind is let off above; a chapter of the manual is not a name.
    const same = ['MODULES', 'OVERDRIVE', 'OVERKILL', 'WINGMEN'];
    expect(MANUAL.filter((topic) => !Object.hasOwn(nl, topic.title)).map((topic) => topic.title).sort()).toEqual(same);
  });

  test('a name that is also a word somewhere else is not translated as that word', () => {
    // The dictionary goes by the English alone, so a pilot called after an ordinary word would get that word's Dutch.
    const kinds = new Map<string, Set<string>>();
    for (const t of texts) kinds.set(t.english, (kinds.get(t.english) ?? new Set<string>()).add(t.kind));
    const clash = [...kinds].filter(([english, found]) => found.has('who') && found.size > 1 && Object.hasOwn(nl, english) && nl[english] !== english);
    expect(clash.map(([english]) => english)).toEqual([]);
    setLanguage('nl');
    try {
      // The wanted pilot the board once shared a word with.
      expect(PEOPLE.find((person) => person.id === 'hollow')!.name).toBe('Hollow');
      expect(PEOPLE.map((person) => person.name)).not.toContain('Hol');
    } finally {
      setLanguage('en');
    }
  });

  test('whom somebody works for is said in Dutch, but for the names of the five that are names', () => {
    // A role may stay, which is why the kind is let off above: a company's name is a name. Anything else is a word.
    const roles = [...new Set(PEOPLE.map((person) => person.role))];
    expect(roles.filter((role) => !Object.hasOwn(nl, role)).sort()).toEqual(['Coast Circuit', 'Dispatch', 'Hadron Mining', 'Lumen Systems', 'Meridian Mutual']);
    expect(nl['The Undertow']).toBe('De Undertow');
    expect(nl.Wanted).toBe('Gezocht');
  });

  test('the songs keep their names: none is called after something another page translates', () => {
    expect(JUKEBOX.filter((song) => Object.hasOwn(nl, song.title)).map((song) => song.title)).toEqual([]);
    setLanguage('nl');
    try {
      expect(JUKEBOX.map((song) => song.title)).toEqual(expect.arrayContaining(['COMPANY TIME', 'CLEAN ROOM', 'LOW WATER', 'THE WAY DOWN']));
    } finally {
      setLanguage('en');
    }
  });
});

/** Every leaf of a table of interface text, by its path; a function is called with stand-ins to see what it says. */
function leaves(table: unknown, path = ''): { path: string; said: string[] }[] {
  if (typeof table === 'string') return [{ path, said: [table] }];
  if (Array.isArray(table)) return table.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (typeof table === 'function') {
    const samples: unknown[][] = [
      ['Old Sixty', 'Ripper Claw', 'Core', 88], [3, 12, 'ABCDEFGH', 5], [1, 'Kite', 7, 2], ['strongest', 'strongest'], ['target', 'target'],
      ['cover', 'cover'], [['Phantom', 'Bastion', 'The Magistrate']], ['head', 4], ['Marrow', 'cover'], ['Marrow', 'target'], ['Marrow', 'strongest'],
    ];
    const said: string[] = [];
    for (const args of samples) {
      try {
        const out = (table as (...a: unknown[]) => unknown)(...args);
        if (typeof out === 'string') said.push(out);
        else if (Array.isArray(out)) said.push(...out.filter((line): line is string => typeof line === 'string'));
      } catch { /* not the kind of argument this one takes */ }
    }
    return [{ path, said }];
  }
  if (typeof table === 'object' && table !== null) return Object.entries(table).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  return [];
}

describe('Dutch: the interface', () => {
  const english = leaves(STRINGS);

  test('has every text the English has, of the same kind, and nothing else', () => {
    const kinds = (table: unknown) => Object.fromEntries(leaves(table).map((leaf) => [leaf.path, leaf.said.length > 0 ? 'text' : 'none']));
    // A few things are the same in every language and are not in the Dutch table at all.
    const same = (path: string) => path === 'title' || path.startsWith('callsign.rows') || path.startsWith('options.languages');
    const want = Object.keys(kinds(STRINGS)).filter((path) => !same(path)).sort();
    expect(Object.keys(kinds(STRINGS_NL)).sort()).toEqual(want);
  });

  test('says no more than the English does wherever it stands, give or take two letters', () => {
    const dutch = new Map(leaves(STRINGS_NL).map((leaf) => [leaf.path, leaf.said]));
    const tooLong: string[] = [];
    for (const { path, said } of english) {
      const other = dutch.get(path);
      if (!other) continue;
      said.forEach((text, i) => {
        if (other[i] === undefined) return;
        // Where the place is known to hold more, it is that room the Dutch is held to.
        const room = Object.hasOwn(ROOM_FOR, path) ? ROOM_FOR[path] : text.length + (Object.hasOwn(SLACK_FOR, path) ? SLACK_FOR[path] : 2);
        if (other[i].length > room) tooLong.push(`${path}: "${other[i]}" (${other[i].length}) for "${text}" (${text.length})`);
      });
    }
    expect(tooLong).toEqual([]);
    // Every place listed as roomier is a place the game has, and one where the Dutch does use the room.
    const paths = new Set(english.map((leaf) => leaf.path));
    expect([...Object.keys(ROOM_FOR), ...Object.keys(SLACK_FOR)].filter((path) => !paths.has(path))).toEqual([]);
    expect(MESSAGE_CHARS).toBeGreaterThanOrEqual(18 + ' zet zich schrap'.length + SLACK_FOR.guard);
    const unused = [...Object.keys(ROOM_FOR), ...Object.keys(SLACK_FOR)].filter((path) => {
      const said = english.find((leaf) => leaf.path === path)!.said;
      return (dutch.get(path) ?? []).every((text, i) => said[i] === undefined || text.length <= said[i].length + 2);
    });
    expect(unused).toEqual([]);
  });

  test('says the numbers the English says, in the order the English says them: a count, a price or a threshold is the same in both', () => {
    const numbers = (text: string): string[] => text.match(/\d+/g) ?? [];
    const dutch = new Map(leaves(STRINGS_NL).map((leaf) => [leaf.path, leaf.said]));
    const differ: string[] = [];
    for (const { path, said } of english) {
      const other = dutch.get(path);
      if (!other) continue;
      said.forEach((text, i) => {
        if (other[i] !== undefined && numbers(other[i]).join(' ') !== numbers(text).join(' ')) differ.push(`${path}: "${other[i]}" for "${text}"`);
      });
    }
    expect(differ).toEqual([]);
  });

  test('setting the language puts it over the English in place, and setting it back puts the English back', () => {
    const before = JSON.stringify(leaves(STRINGS));
    setLanguage('nl');
    expect(STRINGS.actions.fire).not.toBe('Fire');
    expect(JSON.stringify(leaves(STRINGS))).toBe(JSON.stringify(leaves({ ...STRINGS })));
    setLanguage('en');
    expect(STRINGS.actions.fire).toBe('Fire');
    expect(JSON.stringify(leaves(STRINGS))).toBe(before);
  });
});
