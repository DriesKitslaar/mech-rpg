import { MECH_ENEMIES, POOL } from '../../src/core/board';
import { GRUDGE_MEETINGS, GRUDGE_ORIGINS, grudgeContract, type Grudge, type LedgerEntry } from '../../src/core/grudge';
import { newGame, type GameState } from '../../src/core/game';
import type { Weapon } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT, GRUDGE_FACES, GRUDGE_NAMES, LEDGER_LINES, ledgerText } from '../../src/content/board';
import { PEOPLE } from '../../src/content/codex';
import { dictionaryOf, setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { PAGE_CHARS, PERSON_LINES } from '../../src/ui/databaseScreen';
import { wrap } from '../../src/ui/widgets';

/**
 * The faces of the pilots of an account: one for each callsign, each a picture the game has, and
 * beside what its pilot says in a fight.
 */
const sheet = SPRITES as Record<string, { file: string; w: number; h: number }>;
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const game = (grudge: Grudge): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), battlesWon: 20, grudge });

describe('the faces', () => {
  test('there is one for each callsign, and no two callsigns share one', () => {
    expect(Object.keys(GRUDGE_FACES).sort()).toEqual([...GRUDGE_NAMES].sort());
    expect(new Set(Object.values(GRUDGE_FACES)).size).toBe(GRUDGE_NAMES.length);
    for (const name of GRUDGE_NAMES) expect(GRUDGE_FACES[name], name).toBe(`portrait-acct-${name.toLowerCase()}`);
    expect(BOARD_TEXT.grudge.faces).toBe(GRUDGE_FACES);
  });

  test('each is a picture the game has, of the size a face is', () => {
    const face = sheet['portrait-dispatch'];
    expect(face).toMatchObject({ w: 56, h: 56 });
    for (const [name, id] of Object.entries(GRUDGE_FACES)) {
      expect(sheet[id], name).toEqual({ file: `sprites/${id}.png`, w: face.w, h: face.h });
    }
  });

  test('none is the face of anybody else', () => {
    const taken = new Set([...PEOPLE.map((person) => person.portrait), ...Object.values(BOARD_TEXT.faces ?? {}), ...Object.values(ALL_ENEMIES).flatMap((enemy) => (enemy.portrait ? [enemy.portrait] : []))]);
    expect(taken.size).toBeGreaterThan(15);
    for (const id of Object.values(GRUDGE_FACES)) expect(taken.has(id), id).toBe(false);
  });
});

describe('where a face is seen in a fight', () => {
  test('beside what they say as it opens and as their machine falls, at every meeting and however it began; Dispatch keeps Dispatch\'s', () => {
    for (const name of GRUDGE_NAMES) {
      for (const origin of GRUDGE_ORIGINS) {
        for (const met of [0, 1, 2]) {
          const talk = grudgeContract(game({ name, kind: 'stalker', origin, met, waited: 9 }), BOARD_TEXT, CALLED)!.battles[0].talk!;
          expect(talk.map((line) => [line.at, line.who, line.portrait]), `${name} ${origin} ${met}`).toEqual([
            ['start', name, GRUDGE_FACES[name]], ['hurt', 'Dispatch', BOARD_TEXT.faces!.Dispatch], ['win', name, GRUDGE_FACES[name]],
          ]);
        }
      }
    }
  });
});

describe('what the page of an account says', () => {
  const nl = dictionaryOf('nl');
  const weapons = Object.values(CATALOG).filter((part): part is Weapon => part.kind === 'weapon' && part.price > 0);
  const LONGEST = weapons.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
  const open = (change: Partial<Extract<LedgerEntry, { open: true }>> = {}): LedgerEntry => ({ name: 'Brakk', open: true, kind: 'stalker', origin: 'ran', met: 1, knows: 'wpn-arc-blade', wait: 2, ...change });
  afterEach(() => setLanguage('en'));

  test('of the one that is open: what they fly and how it began, the meetings there have been, what their machine knows, and how long until the notice', () => {
    const stalker = ALL_ENEMIES.stalker.name;
    const blade = CATALOG['wpn-arc-blade'].name;
    expect(ledgerText(open(), CALLED)).toBe(`Flies a ${stalker} that broke off from you. You have met once, and won. Their machine is hardened against your ${blade}. Their notice comes after 2 more contracts won.`);
    expect(ledgerText(open({ origin: 'beat', met: 0, wait: 3 }), CALLED)).toContain(`Flies a ${stalker} that you could not finish. You have not met by name yet.`);
    expect(ledgerText(open({ origin: 'wrecked', met: 2 }), CALLED)).toContain(`You wrecked their ${stalker}. They have another. You have met twice, and won both.`);
    const { knows: _, ...unknowing } = open() as Extract<LedgerEntry, { open: true }>;
    expect(ledgerText(unknowing, CALLED)).toContain('Their machine knows nothing of what you fly.');
    expect(ledgerText(unknowing, CALLED)).not.toContain(blade);
    expect(ledgerText(open({ wait: 0 }), CALLED)).toContain('Their notice is out: it is among the open contracts.');
    expect(ledgerText(open({ wait: 1 }), CALLED)).toContain('Their notice comes after one more contract won.');
    expect(ledgerText(open({ wait: 3 }), CALLED)).toContain('Their notice comes after 3 more contracts won.');
    // Nothing is left of a gap that was not filled.
    expect(ledgerText(open(), CALLED)).not.toMatch(/[{}]/);
  });

  test('of one that is closed: that it is, and no more', () => {
    expect(ledgerText({ name: 'Tally', open: false }, CALLED)).toBe('Came back for you three times and lost three machines. The account is closed.');
  });

  test('the lines: one for each way an account begins, each number of meetings, what is known and how long; each with its Dutch and the same gaps', () => {
    expect(Object.keys(LEDGER_LINES.began).sort()).toEqual([...GRUDGE_ORIGINS].sort());
    expect(LEDGER_LINES.met).toHaveLength(GRUDGE_MEETINGS);
    expect(LEDGER_LINES.knows).toHaveLength(2);
    expect(LEDGER_LINES.due).toHaveLength(3);
    const all = [...Object.values(LEDGER_LINES.began), ...LEDGER_LINES.met, ...LEDGER_LINES.knows, ...LEDGER_LINES.due, LEDGER_LINES.closed];
    expect(new Set(all).size).toBe(all.length);
    const gaps = (line: string): string[] => (line.match(/\{\w+\}/g) ?? []).sort();
    for (const line of Object.values(LEDGER_LINES.began)) expect(gaps(line), line).toEqual(['{machine}']);
    expect(gaps(LEDGER_LINES.knows[1])).toEqual(['{a}']);
    expect(gaps(LEDGER_LINES.due[2])).toEqual(['{n}']);
    for (const line of [...LEDGER_LINES.met, LEDGER_LINES.knows[0], LEDGER_LINES.due[0], LEDGER_LINES.due[1], LEDGER_LINES.closed]) expect(gaps(line), line).toEqual([]);
    for (const line of all) {
      expect(Object.hasOwn(nl, line), line).toBe(true);
      expect(gaps(nl[line]), line).toEqual(gaps(line));
      expect(nl[line], line).not.toBe(line);
      // Their pilot is nobody's he or she, in the page as in the notice.
      expect(nl[line], line).not.toMatch(/\b(hij|zij|ze|hun|haar)\b/i);
    }
  });

  for (const language of ['en', 'nl'] as const) {
    test(`every page there can be is on the page to its last line, in ${language === 'en' ? 'English' : 'Dutch'}`, () => {
      setLanguage(language);
      expect(PERSON_LINES).toBe(13);
      let seen = 0;
      let longest = 0;
      for (const kind of MECHS) {
        for (const origin of GRUDGE_ORIGINS) {
          for (const met of [0, 1, 2]) {
            for (const knows of [LONGEST.id, undefined]) {
              for (const wait of [0, 1, 2, 3]) {
                const { knows: _, ...rest } = open({ kind, origin, met, wait }) as Extract<LedgerEntry, { open: true }>;
                const lines = wrap(ledgerText(knows ? { ...rest, knows } : rest, CALLED), PAGE_CHARS);
                seen += 1;
                longest = Math.max(longest, lines.length);
                expect(lines.length, `${kind} ${origin} ${met} ${knows} ${wait}`).toBeLessThanOrEqual(PERSON_LINES);
              }
            }
          }
        }
      }
      expect(seen).toBe(MECHS.length * GRUDGE_ORIGINS.length * 3 * 2 * 4);
      // (And it is not so short that the room is never needed.)
      expect(longest).toBeGreaterThanOrEqual(5);
      expect(wrap(ledgerText({ name: 'Tally', open: false }, CALLED), PAGE_CHARS).length).toBeLessThanOrEqual(PERSON_LINES);
    });
  }
});
