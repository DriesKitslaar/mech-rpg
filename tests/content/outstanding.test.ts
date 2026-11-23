import { HARDENED } from '../../src/core/battle';
import { MECH_ENEMIES, POOL } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { GRUDGE, GRUDGE_MEETINGS, GRUDGE_ORIGINS, grudgeContract, type Grudge } from '../../src/core/grudge';
import type { Weapon } from '../../src/core/types';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { BOARD_TEXT, GRUDGE_LINES, GRUDGE_NAMES } from '../../src/content/board';
import { PEOPLE } from '../../src/content/codex';
import { dictionaryOf, setLanguage } from '../../src/content/language';
import { MASTERS } from '../../src/content/masters';
import '../../src/content/nl';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { KEEPER } from '../../src/content/seat';
import { STARTERS } from '../../src/content/starters';
import { STRINGS } from '../../src/content/strings';
import { WINGMEN } from '../../src/content/wingmen';
import { TALK_CHARS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, groundLines, hostiles, objectiveLines } from '../../src/ui/briefingScreen';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * The words of an account, held to the game: who its pilots may be called, that every notice there
 * can be fits the page it is read on in both languages, and that what a briefing says of the
 * machine is what the machine is.
 */
afterEach(() => setLanguage('en'));

const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const weapons = Object.values(CATALOG).filter((part): part is Weapon => part.kind === 'weapon' && part.price > 0);
/** The weapon a pilot can own whose name takes the most room. */
const LONGEST = weapons.reduce((a, b) => (b.name.length > a.name.length ? b : a));
const game = (grudge: Grudge, battlesWon = 20): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), battlesWon, grudge });
const account = (change: Partial<Grudge> = {}): Grudge => ({ name: 'Brakk', kind: 'stalker', origin: 'wrecked', knows: LONGEST.id, met: 0, waited: 9, ...change });
const notice = (grudge: Grudge, battlesWon = 20): Mission => grudgeContract(game(grudge, battlesWon), BOARD_TEXT, CALLED)!;

describe('the callsigns', () => {
  test('are sixteen, each one plain word that fits a title, and no two alike', () => {
    expect(GRUDGE_NAMES).toHaveLength(16);
    expect(new Set(GRUDGE_NAMES).size).toBe(16);
    for (const name of GRUDGE_NAMES) {
      expect(name, name).toMatch(/^[A-Z][a-z]{2,6}$/);
      // The notice is called after them, and a contract's title has eighteen letters of room.
      expect(BOARD_TEXT.grudge.title(name).length, name).toBeLessThanOrEqual(18);
    }
    expect(BOARD_TEXT.grudge.names).toBe(GRUDGE_NAMES);
  });

  test('none is a name, or a word of a name, that the game already uses for somebody or something', () => {
    const taken = [
      ...Object.values(ALL_ENEMIES).map((enemy) => enemy.name), ...PEOPLE.map((person) => person.name), ...WINGMEN.map((wingman) => wingman.name),
      ...MASTERS.map((master) => master.name), ...ARENA.map((opponent) => opponent.name), KEEPER.name, ...STARTERS.map((starter) => starter.name),
      ...Object.values(CATALOG).map((part) => part.name), ...BOARD_TEXT.clients, ...BOARD_TEXT.adjectives, ...BOARD_TEXT.nouns,
    ];
    expect(taken.length).toBeGreaterThan(300);
    const words = new Set(taken.flatMap((name) => name.toLowerCase().split(/[^a-z]+/)).filter(Boolean));
    expect(GRUDGE_NAMES.filter((name) => words.has(name.toLowerCase()))).toEqual([]);
  });
});

describe('the lines', () => {
  const gaps = (line: string): string[] => (line.match(/\{\w+\}/g) ?? []).sort();
  const all: string[] = [
    GRUDGE_LINES.title, ...Object.values(GRUDGE_LINES.first), ...GRUDGE_LINES.again, ...GRUDGE_LINES.hardened, ...Object.values(GRUDGE_LINES.opens.first),
    ...GRUDGE_LINES.opens.again, ...GRUDGE_LINES.falls, GRUDGE_LINES.hurt, ...GRUDGE_LINES.debrief,
  ];

  test('there is one for each way an account begins, each later meeting, each thing said and each bill', () => {
    expect(Object.keys(GRUDGE_LINES.first).sort()).toEqual([...GRUDGE_ORIGINS].sort());
    expect(Object.keys(GRUDGE_LINES.opens.first).sort()).toEqual([...GRUDGE_ORIGINS].sort());
    expect(GRUDGE_LINES.again).toHaveLength(GRUDGE_MEETINGS - 1);
    expect(GRUDGE_LINES.opens.again).toHaveLength(GRUDGE_MEETINGS - 1);
    expect(GRUDGE_LINES.falls).toHaveLength(GRUDGE_MEETINGS);
    expect(GRUDGE_LINES.debrief).toHaveLength(GRUDGE_MEETINGS);
    // Nothing known, and one weapon known.
    expect(GRUDGE_LINES.hardened).toHaveLength(2);
    expect(new Set(all).size).toBe(all.length);
  });

  test('each has the gaps its place fills and no other, and the Dutch has the same', () => {
    expect(gaps(GRUDGE_LINES.title)).toEqual(['{name}']);
    for (const line of [...Object.values(GRUDGE_LINES.first), ...GRUDGE_LINES.again]) expect(gaps(line), line).toEqual(['{machine}', '{name}']);
    expect(gaps(GRUDGE_LINES.hardened[0])).toEqual([]);
    expect(gaps(GRUDGE_LINES.hardened[1])).toEqual(['{a}']);
    for (const line of GRUDGE_LINES.debrief) expect(gaps(line), line).toEqual(['{name}']);
    // What is said over a battle is said by them, of themselves: nobody is named in it.
    for (const line of [...Object.values(GRUDGE_LINES.opens.first), ...GRUDGE_LINES.opens.again, ...GRUDGE_LINES.falls, GRUDGE_LINES.hurt]) expect(gaps(line), line).toEqual([]);
    const nl = dictionaryOf('nl');
    for (const line of all) {
      expect(Object.hasOwn(nl, line), line).toBe(true);
      expect(gaps(nl[line]), line).toEqual(gaps(line));
      expect(nl[line], line).not.toBe(line);
    }
  });

  test('are read as they are asked for: the same notice is in whatever language is set when it is made', () => {
    const english = notice(account());
    setLanguage('nl');
    const dutch = notice(account());
    setLanguage('en');
    expect(dutch.title).toBe('Vervallen: Brakk');
    expect(english.title).toBe('Overdue: Brakk');
    expect(dutch.briefing[1]).not.toBe(english.briefing[1]);
    expect(dutch.briefing[2]).toContain('gehard');
    expect(dutch.debrief).not.toBe(english.debrief);
    expect(dutch.battles[0].talk!.map((line) => line.text)).not.toEqual(english.battles[0].talk!.map((line) => line.text));
    // What is a name stays one.
    for (const made of [english, dutch]) {
      expect(made.briefing[1]).toContain('Brakk');
      expect(made.briefing[1]).toContain(ALL_ENEMIES.stalker.name);
      expect(made.briefing[2]).toContain(LONGEST.name);
      expect(made.debrief).toContain('Brakk');
      expect(made.battles[0].talk!.map((line) => line.who)).toEqual(['Brakk', 'Dispatch', 'Brakk']);
    }
    // And once English is set again the notice is English again.
    expect(notice(account())).toEqual(english);
  });
});

describe('every notice there can be fits the page it is read on', () => {
  /** Every callsign, machine, way of beginning and meeting, at a progress for each place; knowing the weapon with the longest name, and none. */
  function* notices(): Generator<Mission> {
    for (let i = 0; i < GRUDGE_NAMES.length; i++) {
      for (const kind of MECHS) {
        for (const origin of GRUDGE_ORIGINS) {
          for (let met = 0; met < GRUDGE_MEETINGS; met++) {
            // (Sixteen progresses in a row: every place the board has comes up among them.)
            yield notice(account({ name: GRUDGE_NAMES[i], kind, origin, met }), 20 + i);
          }
        }
        const { knows: _, ...unknown } = account({ name: GRUDGE_NAMES[i], kind });
        yield notice(unknown, 20 + i);
      }
    }
  }

  for (const language of ['en', 'nl'] as const) {
    test(`in ${language === 'en' ? 'English' : 'Dutch'}: the briefing within the rows it has, the lines under it, what is said, and the bill`, () => {
      setLanguage(language);
      const places = new Set<string>();
      let seen = 0;
      for (const made of notices()) {
        seen += 1;
        places.add(made.battles[0].background);
        const label = `${made.title} ${made.grudge} ${made.briefing[1].slice(0, 30)}`;
        expect(made.title.length, label).toBeLessThanOrEqual(18);
        // The body, wrapped as the page wraps it, in the rows left over by what stands under it.
        const body = made.briefing.reduce((sum, paragraph) => sum + wrap(paragraph, BRIEFING_CHARS).length, 0);
        expect(body, label).toBeLessThanOrEqual(briefingRows(made));
        for (const line of [...objectiveLines(made), ...groundLines(made)]) expect(line.length, `${label}: ${line}`).toBeLessThanOrEqual(BRIEFING_CHARS);
        // What the contract asks names them, and so does the list of what to expect.
        expect(objectiveLines(made)).toEqual([STRINGS.objectives.brief.leader(made.names![GRUDGE])]);
        expect(hostiles(made)[0]).toBe(made.names![GRUDGE]);
        for (const paragraph of made.briefing) expect(paragraph, label).not.toMatch(/[{}]/);
        // Three lines of the bill for its words, four of the box a line is said in.
        expect(wrap(made.debrief, charsFor(210)).length, `${label}: ${made.debrief}`).toBeLessThanOrEqual(3);
        for (const line of made.battles[0].talk!) expect(wrap(line.text, TALK_CHARS).length, `${label}: ${line.text}`).toBeLessThanOrEqual(4);
      }
      expect(seen).toBe(16 * MECHS.length * (GRUDGE_ORIGINS.length * GRUDGE_MEETINGS + 1));
      expect(places.size).toBe(BOARD_TEXT.backgrounds.length);
    });
  }
});

describe('what a briefing says of the machine is so', () => {
  test('half is the figure the rules have, and the weapon named is the one the machine is hardened against', () => {
    expect(HARDENED).toBe(0.5);
    expect(GRUDGE_LINES.hardened[1]).toContain('that does half to it');
    expect(dictionaryOf('nl')[GRUDGE_LINES.hardened[1]]).toContain('die doet de helft');
    const made = notice(account({ knows: 'wpn-arc-blade' }));
    expect(made.briefing[2]).toContain(`your ${CATALOG['wpn-arc-blade'].name}`);
    expect(made.briefing[2]).toContain('which hurt it most last time');
    // One that knows nothing says so, and names no weapon.
    const { knows: _, ...unknown } = account();
    const blank = notice(unknown);
    expect(blank.briefing[2]).toBe(GRUDGE_LINES.hardened[0]);
    for (const weapon of weapons) expect(blank.briefing[2], weapon.name).not.toContain(weapon.name);
  });

  test('the second and third say it is the same machine, which it is', () => {
    for (const met of [1, 2]) {
      const made = notice(account({ met, kind: 'ripper' }));
      expect(made.briefing[1]).toContain(`that ${ALL_ENEMIES.ripper.name}`);
    }
    expect(notice(account({ met: 2 })).briefing[1]).toContain('a third time');
    expect(notice(account({ met: 2 })).briefing[1]).toContain('After this the account is closed');
  });
});
