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
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { WINGMEN } from '../../src/content/wingmen';
import { TALK_CHARS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, briefingShown, groundLines, hostiles, objectiveLines } from '../../src/ui/briefingScreen';
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
    GRUDGE_LINES.title, ...GRUDGE_LINES.places, ...Object.values(GRUDGE_LINES.first), ...GRUDGE_LINES.again, ...GRUDGE_LINES.hardened, ...Object.values(GRUDGE_LINES.opens.first),
    ...GRUDGE_LINES.opens.again, ...GRUDGE_LINES.falls, ...GRUDGE_LINES.hurt, ...GRUDGE_LINES.debrief,
  ];

  test('there is one for each way an account begins, each later meeting, each thing said and each bill', () => {
    expect(Object.keys(GRUDGE_LINES.first).sort()).toEqual([...GRUDGE_ORIGINS].sort());
    expect(Object.keys(GRUDGE_LINES.opens.first).sort()).toEqual([...GRUDGE_ORIGINS].sort());
    expect(GRUDGE_LINES.again).toHaveLength(GRUDGE_MEETINGS - 1);
    expect(GRUDGE_LINES.opens.again).toHaveLength(GRUDGE_MEETINGS - 1);
    expect(GRUDGE_LINES.falls).toHaveLength(GRUDGE_MEETINGS);
    expect(GRUDGE_LINES.debrief).toHaveLength(GRUDGE_MEETINGS);
    // Nothing known, and one weapon known: what the briefing says of the machine, and what Dispatch says in the fight.
    expect(GRUDGE_LINES.hardened).toHaveLength(2);
    expect(GRUDGE_LINES.hurt).toHaveLength(2);
    // And a line for each place the board has, in its order.
    expect(GRUDGE_LINES.places).toHaveLength(BOARD_TEXT.backgrounds.length);
    expect(new Set(all).size).toBe(all.length);
  });

  test('each has the gaps its place fills and no other, and the Dutch has the same', () => {
    expect(gaps(GRUDGE_LINES.title)).toEqual(['{name}']);
    for (const line of [...Object.values(GRUDGE_LINES.first), ...GRUDGE_LINES.again]) expect(gaps(line), line).toEqual(['{machine}', '{name}']);
    expect(gaps(GRUDGE_LINES.hardened[0])).toEqual([]);
    expect(gaps(GRUDGE_LINES.hardened[1])).toEqual(['{a}']);
    for (const line of GRUDGE_LINES.debrief) expect(gaps(line), line).toEqual(['{name}']);
    // What is said over a battle is said by them, of themselves: nobody is named in it.
    for (const line of [...Object.values(GRUDGE_LINES.opens.first), ...GRUDGE_LINES.opens.again, ...GRUDGE_LINES.falls, ...GRUDGE_LINES.hurt, ...GRUDGE_LINES.places]) expect(gaps(line), line).toEqual([]);
    const nl = dictionaryOf('nl');
    for (const line of all) {
      expect(Object.hasOwn(nl, line), line).toBe(true);
      expect(gaps(nl[line]), line).toEqual(gaps(line));
      expect(nl[line], line).not.toBe(line);
    }
  });

  test('each place of the board\'s text reads the line that is written for it, and no other', () => {
    const filled = (line: string, gaps: Record<string, string>): string => Object.entries(gaps).reduce((text, [gap, word]) => text.replaceAll(`{${gap}}`, word), line);
    const words = BOARD_TEXT.grudge;
    const who = { name: 'Brakk', machine: 'Stalker' };
    expect(words.title(who.name)).toBe('Overdue: Brakk');
    for (const origin of GRUDGE_ORIGINS) {
      expect(words.first[origin](who.name, who.machine), origin).toBe(filled(GRUDGE_LINES.first[origin], who));
      expect(words.opens.first[origin], origin).toBe(GRUDGE_LINES.opens.first[origin]);
    }
    for (const meeting of [0, 1]) {
      expect(words.again[meeting](who.name, who.machine), `meeting ${meeting + 2}`).toBe(filled(GRUDGE_LINES.again[meeting], who));
      expect(words.opens.again[meeting], `meeting ${meeting + 2}`).toBe(GRUDGE_LINES.opens.again[meeting]);
    }
    for (const meeting of [0, 1, 2]) {
      expect(words.falls[meeting], `meeting ${meeting + 1}`).toBe(GRUDGE_LINES.falls[meeting]);
      expect(words.debrief[meeting](who.name), `meeting ${meeting + 1}`).toBe(filled(GRUDGE_LINES.debrief[meeting], { name: who.name }));
    }
    expect(words.hurt).toEqual(GRUDGE_LINES.hurt);
    expect(words.places).toEqual(GRUDGE_LINES.places);
    // The places are the board's, each under its own line: what a notice says of where is where it is fought.
    const neon = BOARD_TEXT.backgrounds.indexOf('bg-neon-district');
    expect(words.places[neon]).toContain('neon district');
    expect(words.places[BOARD_TEXT.backgrounds.indexOf('bg-mine')]).toContain('mine');
    expect(words.places[BOARD_TEXT.backgrounds.indexOf('bg-plaza')]).toContain('plaza');
    expect(words.places[BOARD_TEXT.backgrounds.indexOf('bg-undercity')]).toContain('undercity');
    for (const made of [notice(account(), 20), notice(account(), 21), notice(account(), 22), notice(account(), 23), notice(account(), 24), notice(account(), 25)]) {
      expect(made.briefing[0]).toBe(words.places[BOARD_TEXT.backgrounds.indexOf(made.battles[0].background)]);
    }
  });

  test('and each line says what its place is for: how it began, which meeting it is, and only the last that it is the last', () => {
    expect(GRUDGE_LINES.first.beat).toContain('could not finish');
    expect(GRUDGE_LINES.first.ran).toContain('broke off');
    expect(GRUDGE_LINES.first.wrecked).toContain('You wrecked');
    expect(GRUDGE_LINES.opens.first.beat).toContain('Back for more');
    expect(GRUDGE_LINES.opens.first.ran).toContain('I ran');
    expect(GRUDGE_LINES.opens.first.wrecked).toContain('cost me a machine');
    expect(GRUDGE_LINES.again[0]).toContain('again');
    expect(GRUDGE_LINES.again[0]).not.toContain('third');
    expect(GRUDGE_LINES.again[1]).toContain('a third time');
    expect(GRUDGE_LINES.opens.again[0]).toContain('rebuilt');
    expect(GRUDGE_LINES.opens.again[1]).toContain('Last time');
    expect(GRUDGE_LINES.falls[2]).toContain('Account closed');
    expect(GRUDGE_LINES.debrief[2]).toContain('account is closed');
    for (const line of [GRUDGE_LINES.falls[0], GRUDGE_LINES.falls[1], GRUDGE_LINES.debrief[0], GRUDGE_LINES.debrief[1]]) expect(line.toLowerCase(), line).not.toContain('closed');
    // The second bill says there is a third to come.
    expect(GRUDGE_LINES.debrief[1]).toContain('a third time');
    // A notice made of them says the same: one that began with a defeat, at its third meeting.
    const third = notice(account({ origin: 'beat', met: 2 }));
    expect(third.battles[0].talk!.map((line) => line.text)).toEqual([GRUDGE_LINES.opens.again[1], GRUDGE_LINES.hurt[1], GRUDGE_LINES.falls[2]]);
    expect(third.debrief).toBe(GRUDGE_LINES.debrief[2].replace('{name}', 'Brakk'));
    const { knows: _, ...unknown } = account({ origin: 'beat' });
    const first = notice(unknown);
    expect(first.briefing[1]).toContain('could not finish');
    expect(first.battles[0].talk!.map((line) => line.text)).toEqual([GRUDGE_LINES.opens.first.beat, GRUDGE_LINES.hurt[0], GRUDGE_LINES.falls[0]]);
    expect(first.debrief).toBe(GRUDGE_LINES.debrief[0].replace('{name}', 'Brakk'));
  });

  test('none says what is not so of some account it is said of', () => {
    const nl = dictionaryOf('nl');
    // A notice has no client: they named the place themselves.
    for (const line of GRUDGE_LINES.places) {
      expect(line.toLowerCase(), line).not.toContain('client');
      expect(nl[line].toLowerCase(), line).not.toContain('klant');
    }
    // A machine that stood when the pilot left the field did not have to have beaten them: they may have walked away.
    expect(GRUDGE_LINES.first.beat).not.toContain('put you down');
    // At the second meeting one that began with a wreck has lost twice, and one that ran or won has lost once.
    expect(GRUDGE_LINES.again[0]).not.toMatch(/once|twice/i);
    // The first wreck of one that ran or won is not another.
    expect(GRUDGE_LINES.debrief[0]).not.toContain('another');
    // Dispatch speaks of a machine built for a weapon only where it knows one, and names the word the row says.
    expect(GRUDGE_LINES.hurt[0]).not.toMatch(/half|last time|built for/i);
    expect(GRUDGE_LINES.hurt[1]).toContain('last time');
    expect(GRUDGE_LINES.hurt[1]).toContain(STRINGS.tags.half);
    expect(nl[GRUDGE_LINES.hurt[1]]).toContain(STRINGS_NL.tags.half);
    // What the machine is hardened against is said to have hurt it last time: so it is said of no first meeting the
    // game makes, where it knows nothing; and what a hardening is, it is said to be for a while and not for good.
    expect(GRUDGE_LINES.hardened[1]).toContain('until the hardening is shot away');
    expect(nl[GRUDGE_LINES.hardened[1]]).toContain('tot de harding is weggeschoten');
    // In Dutch, where the notice and the bill speak of their pilot, that pilot is nobody's he or she and no "they" of
    // several: a callsign, "de piloot" or "die".
    const told = [...GRUDGE_LINES.places, ...Object.values(GRUDGE_LINES.first), ...GRUDGE_LINES.again, ...GRUDGE_LINES.hardened, ...GRUDGE_LINES.debrief];
    for (const line of told) expect(nl[line], line).not.toMatch(/\b(hij|zij|ze|hun|haar)\b/i);
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
        // The body, as the page draws it: every line of it, down to the last row the contract leaves and with the
        // gap under each paragraph. (Counting lines against rows is not enough: three paragraphs hold a line less.)
        const { lines, shown } = briefingShown(made);
        expect(shown, `${label}: ${made.briefing[2]}`).toBe(lines);
        expect(lines, label).toBeLessThanOrEqual(briefingRows(made));
        expect(made.briefing.every((paragraph) => wrap(paragraph, BRIEFING_CHARS).length >= 1)).toBe(true);
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
    expect(dictionaryOf('nl')[GRUDGE_LINES.hardened[1]]).toContain('doet nu de helft');
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
