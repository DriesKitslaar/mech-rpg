import { generateBoard, swarmContract } from '../../src/core/board';
import { completeMission } from '../../src/core/campaign';
import { DEFAULT_CALLSIGN } from '../../src/core/game';
import { BOARD_TEXT } from '../../src/content/board';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { STRINGS_NL } from '../../src/content/nl/strings';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { rollShows } from '../../src/ui/creditsScreen';
import { done, fresh, inHub, press, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';

/**
 * Small things found when every screen of the game was laid side by side, each held here so that
 * it stays mended. (Where an announcement is shown has a file of its own: toastRoom.test.ts.)
 */

afterEach(() => setLanguage('en'));

type AppOf = ReturnType<typeof inHub>['app'];
/** What is written in the bar across the top of the screen. */
const header = (app: AppOf): string[] => record((ctx) => app.draw(ctx)).texts.filter((t) => t.y <= 2).map((t) => t.text);

describe('the header of the pilot\'s page', () => {
  const pilot = (callsign: string) => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), callsign });
    select(app, 'pilot');
    expect(snap(app).screen).toBe('pilot');
    return app;
  };

  test('names the pilot beside the heading', () => {
    const said = header(pilot('VANTA'));
    expect(said.slice(0, 2)).toEqual([STRINGS.pilot.heading, 'VANTA']);
  });

  test('does not say PILOT twice for a pilot who never took a name', () => {
    expect(DEFAULT_CALLSIGN).toBe('PILOT');
    expect(STRINGS.pilot.heading).toBe('PILOT');
    const said = header(pilot(DEFAULT_CALLSIGN));
    expect(said.filter((text) => text === 'PILOT')).toHaveLength(1);
    // Beside the heading there are only the tabs.
    expect(said.slice(1).sort()).toEqual(Object.values(STRINGS.pilot.pages).sort());
  });

  test('nor PILOOT PILOT in Dutch', () => {
    const app = pilot(DEFAULT_CALLSIGN);
    setLanguage('nl');
    const said = header(app);
    expect(said[0]).toBe('PILOOT');
    expect(said).not.toContain('PILOT');
  });
});

describe('the arena\'s ladder', () => {
  const ladder = (arenaRank: number) => {
    const { app } = inHub({ ...strong(done('intro-1', 'intro-2')), arenaRank });
    select(app, 'arena');
    expect(snap(app).screen).toBe('arena');
    return snap(app).menu.items.filter((item) => item.id.startsWith('rank-'));
  };

  test('writes its numbers to one width: the tenth name begins under the ninth', () => {
    const rows = ladder(3);
    expect(rows).toHaveLength(10);
    expect(rows[8].label).toMatch(/^ 9\. \S/);
    expect(rows[9].label).toMatch(/^10\. \S/);
    // Every name starts in the same column.
    expect(new Set(rows.map((row) => row.label.indexOf('. '))).size).toBe(1);
  });

  test('and so does the back room, where every number has two figures', () => {
    const rows = ladder(15);
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows.map((row) => row.label.indexOf('. '))).size).toBe(1);
    expect(rows[0].label).toMatch(/^ 1\. \S/);
    expect(rows.at(-1)!.label).toMatch(/^15\. \S/);
  });
});

describe('the end roll', () => {
  const ended = () => ({ ...completeMission(fresh(), 'intro-1', MISSIONS), scenes: ['act-1'], endingSeen: true, cycle: 1 });
  const lines = (app: AppOf) => record((ctx) => app.draw(ctx)).texts;
  /** Whether the roll has come to its end. (On this screen the snapshot's `credits` is the roll, not the pilot's money.) */
  const stopped = (app: AppOf): boolean => (snap(app) as unknown as { credits: { done: boolean } }).credits.done;

  test('once it stands still shows no line that the top edge cuts in half', () => {
    // Played hurried, the roll is at its end at once.
    const { app } = inHub(ended());
    select(app, 'options');
    select(app, 'credits');
    expect(snap(app)).toMatchObject({ screen: 'credits', credits: { done: true } });
    const shown = lines(app);
    expect(shown.some((t) => t.text === STRINGS.credits.thanks)).toBe(true);
    for (const t of shown) {
      expect(t.y, t.text).toBeGreaterThanOrEqual(0);
      expect(t.y + (t.size ?? 12), t.text).toBeLessThanOrEqual(270);
    }
  });

  test('what is whole and what is cut is settled to the pixel', () => {
    // Standing still: a line a single row over either edge is left out.
    expect(rollShows(0, 11, true)).toBe(true);
    expect(rollShows(-1, 11, true)).toBe(false);
    expect(rollShows(270 - 11, 11, true)).toBe(true);
    expect(rollShows(270 - 10, 11, true)).toBe(false);
    // Climbing: a line is drawn for as long as a row of it is on screen.
    expect(rollShows(-10, 11, false)).toBe(true);
    expect(rollShows(-11, 11, false)).toBe(false);
    expect(rollShows(269, 11, false)).toBe(true);
    expect(rollShows(270, 11, false)).toBe(false);
  });

  test('while it climbs, a line still leaves by the top edge a row at a time', () => {
    const { app } = inHub(ended(), 1, { fast: false });
    select(app, 'options');
    select(app, 'credits');
    let cut = false;
    for (let i = 0; i < 4000 && !stopped(app); i++) {
      app.update(100);
      if (!stopped(app) && lines(app).some((t) => t.y < 0)) cut = true;
    }
    expect(cut).toBe(true);
    expect(stopped(app)).toBe(true);
    // Standing still at the end: nothing is cut any more.
    for (const t of lines(app)) expect(t.y, t.text).toBeGreaterThanOrEqual(0);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('a contract from the board', () => {
  /** Every open contract and every swarm the board offers over a long career. */
  const offered = () => Array.from({ length: 60 }, (_, wins) => [...generateBoard(wins, 0, BOARD_TEXT), swarmContract(wins, 0, BOARD_TEXT)]).flat();

  test('that comes from Dispatch is briefed under Dispatch\'s face, as the contracts of the story are', () => {
    const fromDispatch = offered().filter((mission) => mission.client === 'Dispatch');
    expect(fromDispatch.length).toBeGreaterThan(5);
    for (const mission of fromDispatch) expect(mission.portrait, mission.id).toBe('portrait-dispatch');
    expect('portrait-dispatch' in SPRITES).toBe(true);
    // Swarms among them too.
    expect(fromDispatch.some((mission) => mission.id.endsWith('-swarm'))).toBe(true);
  });

  test('from a letterhead has no face', () => {
    const others = offered().filter((mission) => mission.client !== 'Dispatch');
    expect(others.length).toBeGreaterThan(50);
    for (const mission of others) expect(mission.portrait, `${mission.id} ${mission.client}`).toBeUndefined();
  });

  test('in Dutch the same holds: Dispatch is a name, and keeps it', () => {
    setLanguage('nl');
    const fromDispatch = offered().filter((mission) => mission.client === 'Dispatch');
    expect(fromDispatch.length).toBeGreaterThan(5);
    for (const mission of fromDispatch) expect(mission.portrait, mission.id).toBe('portrait-dispatch');
    for (const mission of offered().filter((m) => m.client !== 'Dispatch')) expect(mission.portrait, mission.id).toBeUndefined();
  });
});

describe('words and signs that are the same thing', () => {
  test('credits have one sign wherever a figure of them is written: the shop\'s, the bench\'s and a medal\'s', () => {
    for (const S of [STRINGS, STRINGS_NL]) {
      expect(S.shop.credits).toBe('c');
      expect(S.garage.benchCost(300)).toBe('300 c');
      expect(S.medals.pay(100)).toBe('+100 c');
    }
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'shop');
    const money = snap(app).credits;
    expect(header(app)).toContain(`${money} c`);
  });

  test('a saved build that holds nothing is called what a slot that holds nothing is called', () => {
    for (const S of [STRINGS, STRINGS_NL]) expect(S.garage.emptyLoadout).toBe(S.garage.empty);
    expect(STRINGS.garage.empty).toBe('Empty');
    expect(STRINGS_NL.garage.empty).toBe('Leeg');
  });
});

