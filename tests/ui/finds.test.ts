import { FINDS } from '../../src/content/finds';
import { SCENES } from '../../src/content/scenes';
import { findLabel } from '../../src/ui/databaseScreen';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { TOAST_MS } from '../../src/ui/app';
import { COLORS } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';
import { done, fresh, inHub, press, savedGame, select, snap } from '../helpers/app';

type Detail = { title: string; lines: string[]; source?: string };
const detail = (app: Parameters<typeof snap>[0]) => snap(app).detail as Detail;
/** Opens the database on the page of what has been found. */
function onFinds(saved = fresh()) {
  const made = inHub({ ...saved, scenes: ['act-1'] });
  select(made.app, 'database');
  press(made.app, 'next', 'next', 'next');
  expect(snap(made.app).page).toBe('finds');
  return made;
}
const labels = (app: Parameters<typeof snap>[0]) => snap(app).menu.items.map((item) => item.label);

describe('the page of what has been found', () => {
  test('comes after the world and before the manual', () => {
    const { app } = inHub();
    select(app, 'database');
    const pages = ['units', 'people', 'world', 'finds', 'manual', 'music'];
    for (const page of pages) {
      expect(snap(app).page).toBe(page);
      press(app, 'next');
    }
    expect(snap(app).page).toBe('units');
    press(app, 'prev', 'prev', 'prev');
    expect(snap(app).page).toBe('finds');
  });

  test('a new game sees forty rows, the papers by their numbers, and no names', () => {
    const { app } = onFinds();
    expect(labels(app).length).toBe(40);
    expect(labels(app).slice(0, 3)).toEqual(['01 ? ? ?', '02 ? ? ?', '03 ? ? ?']);
    expect(labels(app)[23]).toBe('24 ? ? ?');
    expect(labels(app).slice(24)).toEqual(Array.from({ length: 16 }, () => 'Check ? ? ?'));
    expect(snap(app).menu.items.every((item) => !item.enabled)).toBe(true);
    expect(snap(app).count).toBe('FOUND 0/40   LAMP CHECKS 0');
  });

  test('the page of one not found shows its clue and nothing of what it is', () => {
    const { app } = onFinds();
    press(app, 'down', 'down');
    const rhyme = FINDS[2];
    expect(detail(app)).toEqual({ title: '? ? ?', source: 'Not found yet.', lines: expect.any(Array) });
    expect(detail(app).lines.join(' ')).toBe(rhyme.clue);
    expect(detail(app).lines.join(' ')).not.toContain('Brass');
  });

  test('what is found has its name in the list and its words on the page', () => {
    // The lights are back on below, and the last boat is away: a rhyme and a check.
    const { app, store } = onFinds(done('intro-1', 'intro-2', 'undertow-1', 'undertow-2'));
    expect(savedGame(store).codex).toEqual(expect.arrayContaining(['paper-rhyme', 'check-dock']));
    expect(labels(app)[2]).toBe('03 Counting Rhyme');
    expect(labels(app)[24]).toBe('Check 114');
    expect(snap(app).menu.items.filter((item) => item.enabled).map((item) => item.id)).toEqual(['paper-rhyme', 'check-dock']);
    expect(snap(app).count).toBe('FOUND 2/40   LAMP CHECKS 1');
    press(app, 'down', 'down');
    expect(detail(app)).toMatchObject({ title: 'COUNTING RHYME', source: 'Sung to children below the gates.' });
    expect(detail(app).lines.join(' ')).toBe(FINDS[2].text);
    for (let i = 0; i < 22; i++) press(app, 'down');
    expect(detail(app)).toMatchObject({ title: 'CHECK 114', source: 'Tied to your frame\'s left foot.' });
  });

  test('a name in the list is written small but for a number in it, which stays as stamped', () => {
    const paper = (id: string) => FINDS.find((f) => f.id === id)!;
    expect(findLabel(paper('paper-policy'), true)).toBe('02 Policy VRN-1');
    expect(findLabel(paper('paper-book'), true)).toBe('18 Tamsin\'s Book');
    expect(findLabel(paper('paper-schedule'), true)).toBe('22 Schedule C');
    try {
      setLanguage('nl');
      expect(findLabel(paper('paper-policy'), true)).toBe('02 Polis VRN-1');
      expect(findLabel(paper('paper-retainer'), true)).toBe('16 Vast Contract');
    } finally {
      setLanguage('en');
    }
  });

  test('is drawn with where a find comes from in a dimmer letter, under its name', () => {
    const { app } = onFinds(done('intro-1', 'intro-2', 'undertow-1'));
    press(app, 'down', 'down');
    const drawn = record((ctx) => app.draw(ctx));
    const name = drawn.texts.find((t) => t.text === 'COUNTING RHYME')!;
    const source = drawn.texts.find((t) => t.text === 'Sung to children below the gates.')!;
    const first = drawn.texts.find((t) => t.text.startsWith('Brass for the owner'))!;
    expect(name.color).toBe(COLORS.accent);
    expect(source.color).toBe(COLORS.dim);
    expect(source.y).toBeGreaterThan(name.y);
    expect(first.y).toBeGreaterThan(source.y);
    expect(source.x).toBe(name.x);
    // Every line of it is on the page.
    const page = drawn.texts.filter((t) => t.x === name.x && t.y > source.y);
    expect(page.map((t) => t.text).join(' ')).toBe(FINDS[2].text);
    for (const line of page) expect(line.y).toBeLessThan(252 - 11);
  });

  test('in Dutch a check is a penning, and the rhyme is the Dutch one', () => {
    try {
      // The language is the game's own setting: the app sets it as the game is loaded.
      const base = done('intro-1', 'intro-2', 'undertow-1', 'undertow-2');
      const { app } = onFinds({ ...base, settings: { ...base.settings, language: 'nl' } });
      expect(labels(app)[2]).toBe('03 Aftelrijm');
      expect(labels(app)[24]).toBe('Penning 114');
      expect(labels(app)[25]).toBe('Penning ? ? ?');
      expect(snap(app).count).toBe('VONDST 2/40   PENNINGEN 1');
      press(app, 'down', 'down');
      expect(detail(app).lines.join(' ')).toContain('ijzer voor de delver');
    } finally {
      setLanguage('en');
    }
  });
});

describe('a find is announced', () => {
  const settle = (app: Parameters<typeof snap>[0]) => { app.update(TOAST_MS); app.update(16); };

  test('one by its name, several as a count, and apart from what the database learns about the world', () => {
    const { app } = inHub();
    app.update(16);
    expect(snap(app).toast).toBe('entries:6');
    settle(app);
    app.commit({ ...app.game!, completed: ['intro-1', 'intro-2', 'undertow-1'], scenes: [...app.game!.scenes, 'talk-kite'] });
    app.update(16);
    // The introductions open two entries about the world; the lights going back on finds a rhyme.
    expect(snap(app)).toMatchObject({ toast: 'entries:2', toasts: ['find:paper-rhyme'] });
    settle(app);
    expect(snap(app).toast).toBe('find:paper-rhyme');
    settle(app);
    app.commit({ ...app.game!, completed: [...app.game!.completed, 'undertow-2', 'lumen-1'] });
    app.update(16);
    expect(snap(app)).toMatchObject({ toast: 'finds:2', toasts: [] });
  });

  test('nothing is found while a page of story is waiting to be shown', () => {
    const { app, store } = inHub();
    // The meeting with Ashfall is followed by pages of story: until they are read, the lights going on finds nothing.
    app.commit({ ...app.game!, completed: ['intro-1', 'intro-2', 'undertow-1', 'rival-1'] });
    expect(savedGame(store).codex).not.toContain('paper-rhyme');
    app.commit({ ...app.game!, scenes: [...app.game!.scenes, 'act-2', 'talk-kite', 'talk-logs', 'talk-rival', 'talk-marrow'] });
    expect(savedGame(store).codex).toContain('paper-rhyme');
  });

  test('a game from before there was anything to find has at once what it had earned, in one announcement', () => {
    const { app, store } = inHub({ ...done('intro-1', 'intro-2', 'undertow-1', 'undertow-2', 'lumen-1'), scenes: ['act-1', 'talk-kite'] });
    expect(savedGame(store).codex).toEqual(expect.arrayContaining(['paper-rhyme', 'paper-survey', 'check-dock']));
    app.update(16);
    expect(snap(app).toasts.concat(snap(app).toast ?? []).filter((id) => id.startsWith('find'))).toEqual(['finds:3']);
  });

  test('one that has since started the story over is given what its earlier telling earned, in one announcement, once', () => {
    // Nothing done yet in the second telling. Of the first, the ranks are what is left.
    const earlier = ['intro-1', 'intro-2', 'undertow-1', 'undertow-2', 'lumen-1'];
    const old = { ...fresh(), cycle: 1, ranks: Object.fromEntries(earlier.map((id) => [id, 'B' as const])), scenes: SCENES.filter((scene) => !scene.ending).map((scene) => scene.id) };
    const finds = (ids: string[]) => ids.filter((id) => id.startsWith('paper-') || id.startsWith('check-')).sort();
    const { app, store } = inHub(old);
    expect(finds(savedGame(store).codex)).toEqual(['check-dock', 'paper-rhyme', 'paper-survey']);
    app.update(16);
    expect(snap(app).toasts.concat(snap(app).toast ?? []).filter((id) => id.startsWith('find'))).toEqual(['finds:3']);
    // Once: the next thing saved finds nothing more.
    app.commit({ ...app.game! });
    expect(finds(savedGame(store).codex)).toEqual(['check-dock', 'paper-rhyme', 'paper-survey']);
    expect(snap(app).toasts.concat(snap(app).toast ?? []).filter((id) => id.startsWith('find'))).toEqual(['finds:3']);
  });
});
