import { LESSONS, startNewCycle } from '../../src/core/campaign';
import { isValidState, learn, type GameState } from '../../src/core/game';
import type { Catalog, Weapon } from '../../src/core/types';
import { LESSON_LINES } from '../../src/content/drills';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { wrap } from '../../src/ui/widgets';
import { accept, done, fresh, ids, inHub, makeApp, press, savedGame, select, snap, strong } from '../helpers/app';

/**
 * What Dispatch explains once, as the game is played: said in a contract the first time its moment
 * comes, written into the kept game at once, and never said in the simulator or the Gauntlet.
 */

afterEach(() => setLanguage('en'));

const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
const lance = CATALOG['wpn-rail-lance'] as Weapon;
const emitter = CATALOG['wpn-lance-emitter'] as Weapon;
/** A catalogue in which the weapons these tests fire destroy whatever they hit. */
const HEAVY: Catalog = {
  ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage: 900 }, 'wpn-rail-lance': { ...lance, damage: 900 }, 'wpn-lance-emitter': { ...emitter, damage: 900 },
};
type AppOf = ReturnType<typeof inHub>['app'];
type Battle = { phase: string; outcome: string; spoken: string | null; message: string; enemies: string[] };
const battle = (app: AppOf): Battle => snap(app).battle as unknown as Battle;

/**
 * Into the hub of a game played at its own pace, with everything said that is said: past the title
 * and whatever pages of story are due, a press at a time, with the moment a page asks for before it
 * takes one.
 */
function slowHub(saved: GameState, seed: number) {
  const made = makeApp(saved, seed, { fast: false, catalog: HEAVY });
  for (let i = 0; i < 600 && snap(made.app).screen !== 'hub'; i++) {
    made.app.update(700);
    press(made.app, 'confirm');
  }
  expect(snap(made.app).screen).toBe('hub');
  return made;
}

/** Lets time pass until the pilot has something to answer: a line to confirm, a menu, or the result. */
function settle(app: AppOf): void {
  for (let i = 0; i < 40000 && (battle(app).phase === 'animating' || snap(app).busy === true); i++) app.update(16);
}
/** Reads past whatever is being said, to the menu or the result; returns what was said. */
function listen(app: AppOf): string[] {
  const said: string[] = [];
  settle(app);
  for (let i = 0; i < 40 && battle(app).phase === 'talk'; i++) {
    // A line takes two presses where it is still being written: one to finish it, one to go on.
    if (said.at(-1) !== battle(app).spoken) said.push(battle(app).spoken!);
    // A line that has only just come up ignores a mashed button for a moment.
    app.update(600);
    press(app, 'confirm');
    settle(app);
  }
  return said;
}
/** Fires the first weapon at the core of the first machine standing, and lets what follows play out. Returns what is said after. */
function fire(app: AppOf): string[] {
  expect(battle(app).phase).toBe('action');
  select(app, 'fire');
  press(app, 'confirm');
  press(app, 'confirm');
  return listen(app);
}
const standing = (app: AppOf): number => battle(app).enemies.length;

/** The first game, by seed, in which things go as the test needs them to: the dice are the game's own. */
function lucky<T>(play: (seed: number) => T | null): T {
  for (let seed = 1; seed <= 200; seed++) {
    const found = play(seed);
    if (found) return found;
  }
  throw new Error('no seed in 200 gave the hits this test is about');
}

describe('the lines themselves', () => {
  test('there is one for each lesson, from Dispatch, and it fits the box a line is said in, in both languages', () => {
    expect(Object.keys(LESSON_LINES).sort()).toEqual([...LESSONS].sort());
    for (const lang of ['en', 'nl'] as const) {
      setLanguage(lang);
      for (const id of LESSONS) {
        const line = LESSON_LINES[id];
        expect(line.who).toBe('Dispatch');
        expect(line.portrait).toBe('portrait-dispatch');
        expect(wrap(line.text, TALK_CHARS).length, `${lang} ${id}`).toBeLessThanOrEqual(TALK_LINES);
      }
    }
  });

  test('name what the pilot sees on the screen, in the language that is set', () => {
    expect(LESSON_LINES.momentum.text).toContain(STRINGS.battleIntro.open);
    expect(LESSON_LINES.momentum.text).toContain('ready again');
    setLanguage('nl');
    expect(LESSON_LINES.momentum.text).toContain(STRINGS.battleIntro.open);
    expect(STRINGS.battleIntro.open).toBe('DOORSTOTEN');
    // The bar says "weer klaar" of the weapon; the line uses the same words.
    expect(STRINGS.momentum.ready('X')).toContain('weer klaar');
    expect(LESSON_LINES.momentum.text).toContain('weer klaar');
    expect(LESSON_LINES.rout.text).toContain('paniek');
  });
});

describe('what a kept game remembers of them', () => {
  test('learn adds what is new, once, and hands the same game back when nothing is', () => {
    const g = fresh();
    expect(g.lessons).toBeUndefined();
    const one = learn(g, ['momentum']);
    expect(one.lessons).toEqual(['momentum']);
    expect(g.lessons).toBeUndefined();
    expect(learn(one, ['momentum'])).toBe(one);
    expect(learn(one, [])).toBe(one);
    expect(learn(one, ['rout', 'rout', 'momentum']).lessons).toEqual(['momentum', 'rout']);
  });

  test('a game kept with them loads; one that holds something else in their place does not', () => {
    const g = fresh();
    expect(isValidState({ ...g, lessons: ['momentum', 'rout'] }, CATALOG)).toBe(true);
    // An id from a later version is kept as it is.
    expect(isValidState({ ...g, lessons: ['momentum', 'something-later'] }, CATALOG)).toBe(true);
    expect(isValidState({ ...g, lessons: 'momentum' }, CATALOG)).toBe(false);
    expect(isValidState({ ...g, lessons: [1] }, CATALOG)).toBe(false);
    expect(isValidState({ ...g, lessons: ['Not An Id'] }, CATALOG)).toBe(false);
    expect(isValidState({ ...g, lessons: Array.from({ length: 33 }, (_, i) => `a${'b'.repeat(i % 5)}-${'c'.repeat(i % 7)}x`) }, CATALOG)).toBe(false);
  });

  test('a new cycle keeps them: nothing is explained twice to the same pilot', () => {
    const story = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const told = { ...done(...story), endingSeen: true, lessons: ['momentum', 'rout'] };
    const again = startNewCycle(told, MISSIONS);
    expect(again.cycle).toBe(1);
    expect(again.completed).toEqual([]);
    expect(again.lessons).toEqual(['momentum', 'rout']);
    // And the game as it is kept and loaded holds them.
    const { store } = inHub({ ...strong(done('intro-1', 'intro-2')), lessons: ['momentum', 'rout'] });
    expect(savedGame(store).lessons).toEqual(['momentum', 'rout']);
  });
});

describe('in the first contract of a new game', () => {
  /** A new pilot in the first fight of the game, the first drone just destroyed by the rifle. */
  const firstKill = (saved: GameState = fresh()) => lucky((seed) => {
    const made = slowHub(saved, seed);
    accept(made.app, 'intro-1');
    const opening = listen(made.app);
    const after = fire(made.app);
    return standing(made.app) === 1 ? { ...made, opening, after } : null;
  });

  test('Dispatch says why the rifle is ready again as the first drone falls, and the kept game holds it at once', () => {
    const { app, store, opening, after } = firstKill();
    // The contract's own first line is the one about how to fire; the lesson is not said before anything has happened.
    expect(opening).toHaveLength(1);
    expect(opening[0]).not.toBe(LESSON_LINES.momentum.text);
    expect(after[0]).toBe(LESSON_LINES.momentum.text);
    // It is in the kept game while the battle is still being fought.
    expect(battle(app).outcome).toBe('ongoing');
    expect(savedGame(store).lessons).toEqual(['momentum']);
    // And the bar says which weapon, as the menu comes.
    expect(battle(app).phase).toBe('action');
    expect(battle(app).message).toBe(STRINGS.momentum.ready(rifle.name));
  });

  test('a pilot who has been told is not told again, in that battle or the next contract', () => {
    const { app, store, after } = firstKill({ ...fresh(), lessons: ['momentum'] });
    expect(after).not.toContain(LESSON_LINES.momentum.text);
    expect(battle(app).message).toBe(STRINGS.momentum.ready(rifle.name));
    expect(savedGame(store).lessons).toEqual(['momentum']);
  });

  test('in a game set to Dutch it is the Dutch line', () => {
    const dutch = fresh();
    const { after } = firstKill({ ...dutch, settings: { ...dutch.settings, language: 'nl' } });
    expect(after[0]).toContain('DOORSTOTEN');
    expect(after[0]).toBe(LESSON_LINES.momentum.text);
  });
});

describe('a game kept from before there were lessons', () => {
  test('hears each at its next occasion: two drones of three in one turn, and the third loses its nerve', () => {
    const veteran = strong(done('intro-1', 'intro-2'));
    expect(veteran.lessons).toBeUndefined();
    const m = lucky((seed) => {
      const made = slowHub(veteran, seed);
      accept(made.app, 'hadron-1');
      listen(made.app);
      const first = fire(made.app);
      if (standing(made.app) !== 2) return null;
      const second = fire(made.app);
      return standing(made.app) === 1 ? { ...made, first, second } : null;
    });
    expect(m.first).toEqual([LESSON_LINES.momentum.text]);
    expect(m.second[0]).toBe(LESSON_LINES.rout.text);
    expect(savedGame(m.store).lessons).toEqual(['momentum', 'rout']);
  });
});

describe('where nothing is explained', () => {
  test('the simulator has its own voice: a kill in the drill that teaches the rule says no line of Dispatch\'s', () => {
    const m = lucky((seed) => {
      const made = slowHub(strong(done('intro-1', 'intro-2')), seed);
      select(made.app, 'training');
      select(made.app, 'drill-momentum');
      expect(snap(made.app).screen).toBe('briefing');
      select(made.app, 'accept');
      expect(snap(made.app).screen).toBe('battle');
      const opening = listen(made.app);
      const after = fire(made.app);
      // The lance destroys whatever it hits here, the enforcer included: one machine has fallen.
      return standing(made.app) === 2 ? { ...made, opening, after } : null;
    });
    expect(m.opening).toHaveLength(1);
    expect(m.after).toEqual([]);
    expect(battle(m.app).message).toBe(STRINGS.momentum.ready(lance.name));
    expect(savedGame(m.store).lessons).toBeUndefined();
  });

  test('nor is anything in the Gauntlet, where open floors are the rule', () => {
    const m = lucky((seed) => {
      const made = slowHub(strong(done('intro-1', 'intro-2')), seed);
      select(made.app, 'gauntlet');
      select(made.app, 'start');
      // A floor with more than one machine on it, by one of its doors.
      const enemies = (snap(made.app).gauntlet as { enemies: string[] }).enemies;
      if (enemies.length < 2) return null;
      select(made.app, ids(made.app).includes('descend') ? 'descend' : 'door-0');
      if (snap(made.app).screen !== 'battle') return null;
      listen(made.app);
      const before = standing(made.app);
      if (before < 2) return null;
      const after = fire(made.app);
      return standing(made.app) === before - 1 && battle(made.app).message === STRINGS.momentum.ready(rifle.name) ? { ...made, after } : null;
    });
    expect(m.after).toEqual([]);
    expect(savedGame(m.store).lessons).toBeUndefined();
  });
});
