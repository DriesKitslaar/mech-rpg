import { createBattle } from '../../src/core/battle';
import type { GameState } from '../../src/core/game';
import { NAME_AT } from '../../src/core/renown';
import { NO_STATS, type Stats } from '../../src/core/stats';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, INTRO_MS } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { accept, done, finishMission, inHub, makeApp, pastLaunch, press, select, snap, strong, toHub } from '../helpers/app';
import { record } from '../helpers/canvas';

/** A name from deeds, where the pilot meets it: on their page, as it is earned, and as a battle opens. */

afterEach(() => setLanguage('en'));

const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
const pilot = (stats: Partial<Stats>, rest: Partial<GameState> = {}): GameState =>
  ({ ...strong(done('intro-1', 'intro-2')), callsign: 'VANTA', stats: { ...NO_STATS, ...stats }, ...rest });
type AppOf = ReturnType<typeof inHub>['app'];
const texts = (app: AppOf) => record((ctx) => app.draw(ctx)).texts;
function recordPage(app: AppOf) {
  select(app, 'pilot');
  for (let i = 0; i < 4 && snap(app).page !== 'record'; i++) press(app, 'next');
  expect(snap(app).page).toBe('record');
  return { known: snap(app).known as { rank: number; renown: number; next: number | null }, said: texts(app) };
}

describe('the names', () => {
  test('are five, each with what it means to the other side, in both languages', () => {
    for (const R of [STRINGS.renown, STRINGS_NL.renown]) {
      expect(R.names).toHaveLength(NAME_AT.length);
      expect(R.notes).toHaveLength(NAME_AT.length);
      expect(new Set(R.names).size).toBe(5);
      expect(new Set(R.notes).size).toBe(5);
    }
    expect(STRINGS.renown.names).toEqual(['Line Item', 'Write-Off', 'Total Loss', 'Act of God', 'The Last Invoice']);
    expect(STRINGS_NL.renown.names).toEqual(['Kostenpost', 'Afboeking', 'Total Loss', 'Overmacht', 'De Eindafrekening']);
  });

  test('with what they mean fit the message bar and the pilot\'s page, in both languages', () => {
    for (const R of [STRINGS.renown, STRINGS_NL.renown]) {
      R.names.forEach((name, i) => {
        // The bar is 310 wide and a letter 4.8: the opening line has to leave the edges alone.
        expect(R.opening(name.toUpperCase(), R.notes[i]).length, name).toBeLessThanOrEqual(60);
        // The page's panel holds 59 letters across.
        expect(R.notes[i].length, name).toBeLessThanOrEqual(59);
        expect(R.banner('WWWWWWWW', name.toUpperCase()).length, name).toBeLessThanOrEqual(60);
      });
    }
  });
});

describe('the pilot\'s page', () => {
  test('says there is no name yet, and how far off the first is', () => {
    const { app } = inHub(pilot({}));
    const { known, said } = recordPage(app);
    expect(known).toEqual({ rank: 0, renown: 0, next: 20 });
    expect(said.find((t) => t.text === 'KNOWN AS')).toMatchObject({ color: COLORS.dim });
    expect(said.find((t) => t.text === 'no name yet')).toMatchObject({ color: COLORS.dim });
    expect(said.find((t) => t.text === 'RENOWN 0/20')).toMatchObject({ align: 'right' });
    for (const note of STRINGS.renown.notes) expect(said.map((t) => t.text)).not.toContain(note);
  });

  test('shows the name the record has earned, what it means, and what the next one asks', () => {
    const { app } = inHub(pilot({ kills: 85, bosses: 5 }, { arenaRank: 15 }));
    const { known, said } = recordPage(app);
    expect(known).toEqual({ rank: 3, renown: 185, next: 320 });
    expect(said.find((t) => t.text === 'TOTAL LOSS')).toMatchObject({ color: COLORS.accent });
    expect(said.map((t) => t.text)).toContain('Nobody quotes for a site you are near.');
    expect(said.map((t) => t.text)).toContain('RENOWN 185/320');
    // Under the ranks held and over the hint at the foot of the page: nothing of it is written across either.
    const mine = said.filter((t) => ['KNOWN AS', 'TOTAL LOSS', 'Nobody quotes for a site you are near.', 'RENOWN 185/320'].includes(t.text));
    const held = said.find((t) => t.text === STRINGS.record.ranksHeld)!;
    const hint = said.find((t) => t.text === STRINGS.pilot.pageHint)!;
    for (const t of mine) {
      expect(t.y, t.text).toBeGreaterThan(held.y + 30);
      expect(t.y + 12, t.text).toBeLessThanOrEqual(hint.y);
      expect(t.left).toBeGreaterThanOrEqual(8);
      expect(t.right).toBeLessThanOrEqual(310 - 8);
    }
  });

  test('at the top says only what the renown is', () => {
    const { app } = inHub(pilot({ kills: 700 }));
    const { known, said } = recordPage(app);
    expect(known).toEqual({ rank: 5, renown: 700, next: null });
    expect(said.map((t) => t.text)).toContain('THE LAST INVOICE');
    expect(said.map((t) => t.text)).toContain('RENOWN 700');
  });

  test('in Dutch', () => {
    const { app } = inHub({ ...pilot({ kills: 85, bosses: 5 }, { arenaRank: 15 }), settings: { ...pilot({}).settings, language: 'nl' } });
    const { said } = recordPage(app);
    const all = said.map((t) => t.text);
    expect(all).toEqual(expect.arrayContaining(['BEKEND ALS', 'TOTAL LOSS', 'Bij jou in de buurt verzekert niemand.', 'FAAM 185/320']));
    expect(all).not.toContain('KNOWN AS');
  });
});

describe('a name that is earned', () => {
  test('is announced as it is earned, once, and not for a game that is loaded with it', () => {
    // Nineteen machines down: the patrol's two drones make it twenty-one.
    const { app } = inHub(pilot({ kills: 19 }));
    expect(snap(app).toasts.concat(snap(app).toast ?? []).some((id) => id.startsWith('name:'))).toBe(false);
    accept(app, 'patrol');
    finishMission(app);
    toHub(app);
    const announced = (): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => !!id && id.startsWith('name:'));
    expect(announced()).toEqual(['name:1']);
    // What it says: that there is a name, and the name.
    for (let i = 0; i < 2000 && snap(app).toast !== 'name:1'; i++) app.update(16);
    expect(snap(app).toast).toBe('name:1');
    const said = texts(app).map((t) => t.text);
    expect(said).toContain('YOU HAVE A NAME');
    expect(said).toContain('Line Item');
    // Another patrol earns no other name, and the one there is is not said again.
    for (let i = 0; i < 2000 && (snap(app).toast || snap(app).toasts.length > 0); i++) app.update(16);
    accept(app, 'patrol');
    finishMission(app);
    toHub(app);
    expect(announced()).toEqual([]);
    // A game opened with a name already: nothing is announced.
    const loaded = inHub(pilot({ kills: 200 })).app;
    expect([snap(loaded).toast, ...snap(loaded).toasts].some((id) => !!id && id.startsWith('name:'))).toBe(false);
  });

  test('two marks passed at once are one name: the higher', () => {
    const { app } = inHub(pilot({ kills: 19 }));
    app.commit({ ...app.game!, stats: { ...app.game!.stats, kills: 70 } });
    expect([snap(app).toast, ...snap(app).toasts].filter((id) => !!id && id.startsWith('name:'))).toEqual(['name:2']);
  });
});

describe('as a battle opens', () => {
  const open = () => createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, 1);

  test('the banner carries the callsign and the name on a band under it, while it is up and not after', () => {
    const flow = new BattleFlow(open(), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, title: 'PERIMETER SWEEP', pilot: 'VANTA, WRITE-OFF' });
    const band = () => record((ctx) => screen.draw(ctx)).texts.filter((t) => t.text === 'VANTA, WRITE-OFF');
    for (let ms = 0; ms < INTRO_MS * 0.5; ms += 16) screen.update(16);
    expect(screen.banner).toBe(true);
    const [line] = band();
    expect(band()).toHaveLength(1);
    expect(line.align).toBe('center');
    // Under the contract's name and what it asks for, on the same band of the field.
    const title = record((ctx) => screen.draw(ctx)).texts.find((t) => t.text === 'PERIMETER SWEEP')!;
    expect(line.y).toBeGreaterThan(title.y + 30);
    expect(line.x).toBe(title.x);
    for (let ms = 0; ms < INTRO_MS; ms += 16) screen.update(16);
    expect(screen.banner).toBe(false);
    expect(band()).toEqual([]);
    // Without a name there is no band.
    const plain = new BattleScreen(new BattleFlow(open(), CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, title: 'PERIMETER SWEEP' });
    for (let ms = 0; ms < INTRO_MS * 0.5; ms += 16) plain.update(16);
    expect(record((ctx) => plain.draw(ctx)).texts.some((t) => /,/.test(t.text))).toBe(false);
  });

  test('the message bar opens with the name and what it means, until something happens', () => {
    const flow = new BattleFlow(open(), CATALOG, { quiet: true, opening: 'WRITE-OFF. They enter as lost whatever they send at you.' });
    expect(flow.message).toBe('WRITE-OFF. They enter as lost whatever they send at you.');
    for (let i = 0; i < 400 && flow.phase === 'animating'; i++) flow.advance();
    expect(flow.message).not.toMatch(/WRITE-OFF/);
    expect(new BattleFlow(open(), CATALOG, { quiet: true }).message).toBe('');
  });

  /** The first frame of a battle taken from the hub at a walking pace: what the bar says and what the banner carries. */
  function opened(game: GameState, mission: string) {
    const { app } = makeApp(game, 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(16); press(app, 'confirm'); }
    select(app, 'contracts');
    select(app, mission);
    for (let i = 0; i < 200 && snap(app).screen !== 'briefing'; i++) app.update(16);
    select(app, 'accept');
    for (let i = 0; i < 400 && snap(app).screen !== 'battle'; i++) app.update(16);
    // (The launch it opens with is for its own tests.)
    pastLaunch(app);
    for (let i = 0; i < 20; i++) app.update(16);
    return { app, said: texts(app).map((t) => t.text), message: snap(app).message };
  }

  test('against ordinary machines a pilot with a name is known: the bar says so, and the banner carries the name', () => {
    const { said, message } = opened(pilot({ kills: 60 }), 'patrol');
    expect(message).toBe('WRITE-OFF. They enter as lost whatever they send at you.');
    expect(said).toContain('VANTA, WRITE-OFF');
  });

  test('a pilot without one opens a battle as they always did', () => {
    const { said, message } = opened(pilot({ kills: 3 }), 'patrol');
    expect(message ?? '').toBe('');
    expect(said.some((text) => text.startsWith('VANTA,'))).toBe(false);
  });

  test('in a fight that is not open the banner still carries the name, and the bar says nothing: nobody there is impressed', () => {
    // The first Lumen contract after its first: a leader to bring down, and so a fight that is not open.
    const game = pilot({ kills: 60 }, { completed: ['intro-1', 'intro-2', 'lumen-1'] });
    const { app, said, message } = opened(game, 'lumen-2');
    expect((snap(app).battle as { mission: string }).mission).toBe('lumen-2');
    expect(message ?? '').toBe('');
    expect(said).toContain('VANTA, WRITE-OFF');
  });

  test('a drill is flown under no name: the simulator has not heard of anybody', () => {
    const { app } = makeApp(pilot({ kills: 60 }), 5, { fast: false });
    press(app, 'confirm');
    for (let i = 0; i < 400 && snap(app).screen !== 'hub'; i++) { app.update(16); press(app, 'confirm'); }
    select(app, 'training');
    for (let i = 0; i < 200 && snap(app).screen !== 'training'; i++) app.update(16);
    press(app, 'confirm');
    for (let i = 0; i < 200 && snap(app).screen !== 'briefing'; i++) app.update(16);
    select(app, 'accept');
    for (let i = 0; i < 400 && snap(app).screen !== 'battle'; i++) app.update(16);
    for (let i = 0; i < 20; i++) app.update(16);
    expect(snap(app).screen).toBe('battle');
    expect(snap(app).message ?? '').not.toMatch(/WRITE-OFF/);
    expect(texts(app).some((t) => t.text.startsWith('VANTA,'))).toBe(false);
  });

  test('where a boss comes in, the warning has the field to itself: no band under it', () => {
    const boss = createBattle(DEMO_BUILD, [ENEMIES['scrap-king']], CATALOG, 1);
    const screen = new BattleScreen(new BattleFlow(boss, CATALOG, { quiet: true }), sprites, CATALOG, { fast: false, title: 'THE SCRAP KING', boss: 'Scrap King', pilot: 'VANTA, WRITE-OFF' });
    for (let ms = 0; ms < 600; ms += 16) screen.update(16);
    expect(screen.banner).toBe(true);
    // (The warning and the name of the boss are drawn in the letters of the sign, not written.)
    const said = record((ctx) => screen.draw(ctx)).texts.map((t) => t.text);
    expect(said).not.toContain('VANTA, WRITE-OFF');
    expect(said).not.toContain('THE SCRAP KING');
  });

  test('in Dutch', () => {
    const base = pilot({ kills: 60 });
    const { said, message } = opened({ ...base, settings: { ...base.settings, language: 'nl' } }, 'patrol');
    expect(message).toBe('AFBOEKING. Wat ze op je af sturen, boeken ze meteen af.');
    expect(said).toContain('VANTA, AFBOEKING');
  });
});
