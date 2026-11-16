import { language, setLanguage } from '../../src/content/language';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { CATALOG } from '../../src/content/parts';
import { SETTINGS_KEY, SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { creditLines } from '../../src/ui/creditsScreen';
import { BRIEFING_CHARS, briefingRows, groundLines, objectiveLines } from '../../src/ui/briefingScreen';
import { SCENE_LINES, sceneRows } from '../../src/ui/sceneScreen';
import { charsFor, wrap } from '../../src/ui/widgets';
import { done, finishMission, fresh, inHub, makeApp, press, savedGame, select, snap, strong } from '../helpers/app';

type AppOf = ReturnType<typeof inHub>['app'];
function drawn(app: AppOf): string[] {
  const said: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
      : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  app.update(16);
  app.draw(ctx);
  return said;
}
const dutch = (base = strong(done('intro-1', 'intro-2'))) => ({ ...base, settings: { ...base.settings, language: 'nl' as const } });

afterEach(() => setLanguage('en'));

describe('the game in Dutch', () => {
  test('a game kept in Dutch opens in Dutch, and every screen of the hub draws in it without a word of the English menu', () => {
    const { app } = inHub(dutch());
    expect(language()).toBe('nl');
    expect(snap(app).menu.items.map((i) => i.label)).toEqual(
      ['Contracten', 'Arena', 'Training', 'De Gauntlet', 'Garage', 'Winkel', 'Piloot', 'Berichten', 'Database', 'Opties']);
    for (const screen of ['garage', 'shop', 'pilot', 'messages', 'database', 'training', 'arena', 'gauntlet', 'options'] as const) {
      select(app, screen);
      expect(snap(app).screen).toBe(screen);
      const said = drawn(app);
      expect(said.length, screen).toBeGreaterThan(3);
      for (const english of ['Back', 'B: back', 'Sound Effects', 'CREDITS OWED', 'PURSE', 'HEADQUARTERS']) expect(said, screen).not.toContain(english);
      press(app, 'cancel');
      if (snap(app).screen !== 'hub') press(app, 'cancel');
      expect(snap(app).screen).toBe('hub');
    }
  });

  test('a contract is briefed, fought and settled in Dutch from the first screen to the last', () => {
    const { app } = inHub(dutch());
    select(app, 'contracts');
    select(app, 'patrol');
    const briefing = drawn(app).join(' ');
    expect(briefing).toContain('REGEN');
    expect(briefing).not.toContain('Standing contract');
    select(app, 'accept');
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
      if (snap(app).battle?.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    expect(snap(app).menu.items.map((i) => i.label).slice(0, 2)).toEqual(['Vuur', 'Boost']);
    expect(snap(app).message).toBe('Ronde 1 - jouw zet');
    finishMission(app);
    expect(drawn(app).join(' ')).not.toContain('Press A');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('the language is changed in the options on the spot, is kept with the settings, and English comes back whole', () => {
    const { app, store } = inHub();
    const english = snap(app).menu.items.map((i) => i.label);
    select(app, 'options');
    select(app, 'language');
    expect(snap(app).menu.items.find((i) => i.id === 'language')).toMatchObject({ label: 'Taal', note: 'Nederlands' });
    expect(savedGame(store).settings.language).toBe('nl');
    expect(JSON.parse(store.data[SETTINGS_KEY]).language).toBe('nl');
    press(app, 'cancel');
    expect(snap(app).menu.items.map((i) => i.label)).not.toEqual(english);
    select(app, 'options');
    select(app, 'language');
    press(app, 'cancel');
    expect(snap(app).menu.items.map((i) => i.label)).toEqual(english);
    // A game that says nothing about a language is in English, whatever was played before it.
    setLanguage('nl');
    const plain = makeApp(fresh()).app;
    expect(language()).toBe('en');
    expect(snap(plain).menu.items.map((i) => i.label)).toContain('Continue');
  });

  test('in Dutch every briefing still fits its panel and every page of story its page', () => {
    setLanguage('nl');
    for (const mission of MISSIONS) {
      const rows = briefingRows(mission);
      let y = 0;
      for (const paragraph of mission.briefing) {
        for (const _line of wrap(paragraph, BRIEFING_CHARS)) { expect(y, mission.id).toBeLessThanOrEqual((rows - 1) * 11); y += 11; }
        y += 4;
      }
      for (const line of [...objectiveLines(mission), ...groundLines(mission)]) expect(line.length, `${mission.id}: ${line}`).toBeLessThanOrEqual(BRIEFING_CHARS);
      expect(wrap(mission.debrief, charsFor(210)).length, mission.id).toBeLessThanOrEqual(3);
      expect(mission.title.length, mission.title).toBeLessThanOrEqual(18);
    }
    for (const scene of SCENES) {
      expect(sceneRows(scene), scene.id).toBeLessThanOrEqual(SCENE_LINES);
      expect(scene.title.length, scene.title).toBeLessThanOrEqual(14);
    }
    expect(STRINGS.title).toBe('IRONWAGE');
  });

  test('the end roll is in Dutch from top to bottom, and in English again afterwards', () => {
    const game = { ...strong(done('intro-1', 'intro-2', 'hadron-1', 'lumen-1')), met: ['rival', 'sable'] };
    const roll = () => creditLines(game, 50).map((line) => line.text);
    const english = roll();
    expect(english).toEqual(expect.arrayContaining(['Director Brenn', 'who found you the work', 'a licensed pilot']));
    setLanguage('nl');
    const dutchRoll = roll();
    expect(dutchRoll).toEqual(expect.arrayContaining(['Directeur Brenn', 'Analist Varga', 'die je het werk bezorgde', 'een erkende piloot']));
    for (const text of ['Director Brenn', 'Analyst Varga', 'who found you the work', 'a licensed pilot', 'Lumen\'s best']) expect(dutchRoll).not.toContain(text);
    setLanguage('en');
    expect(roll()).toEqual(english);
  });

  test('the content goes back to English whole, not only the interface', () => {
    const texts = () => JSON.stringify([MISSIONS.map((m) => [m.title, m.briefing, m.debrief]), SCENES.map((s) => [s.title, s.lines, s.talk?.map((t) => t.text)])]);
    const english = texts();
    setLanguage('nl');
    expect(texts()).not.toBe(english);
    expect(MISSIONS.find((m) => m.id === 'patrol')!.briefing[0]).not.toContain('Standing contract');
    setLanguage('en');
    expect(texts()).toBe(english);
  });

  test('the language kept with the settings is the language the game opens in, before any game is loaded', () => {
    const { app, store } = inHub();
    select(app, 'options');
    select(app, 'language');
    const again = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites: app.deps.sprites, fast: true, seed: 2 });
    expect(language()).toBe('nl');
    expect(snap(again).menu.items.map((i) => i.label)).not.toContain('Continue');
  });

  test('the line about a thermal weapon stays on the screen in both languages', () => {
    for (const lang of ['en', 'nl'] as const) {
      setLanguage(lang);
      // Drawn from x 176 on a 310 screen, at 4.8 a letter.
      expect(176 + STRINGS.partInfo.traits.thermal(26).length * 4.8, lang).toBeLessThanOrEqual(310);
    }
  });
});
