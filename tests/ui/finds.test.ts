import { FINDS } from '../../src/content/finds';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { FIND_PICTURE, FIND_SOURCE_CHARS, FIND_TEXT_LINES, PAGE_CHARS, findLabel } from '../../src/ui/databaseScreen';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { TOAST_MS, type AppDeps } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS, wrap } from '../../src/ui/widgets';
import { record } from '../helpers/canvas';
import { done, fresh, inHub, press, savedGame, select, snap } from '../helpers/app';

type Detail = { title: string; lines: string[]; source?: string; picture?: string; stamp?: string };
const detail = (app: Parameters<typeof snap>[0]) => snap(app).detail as Detail;
/** A store whose pictures say which they are, so that a test can tell what was drawn. */
const named: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
/** Opens the database on the page of what has been found. */
function onFinds(saved = fresh(), deps: Partial<AppDeps> = {}) {
  const made = inHub({ ...saved, scenes: ['act-1'] }, undefined, deps);
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
      // In Dutch a title in a list is written as a sentence is.
      expect(findLabel(paper('paper-retainer'), true)).toBe('16 Vast contract');
    } finally {
      setLanguage('en');
    }
  });

  test('is drawn with its picture under its name, where it comes from beside the picture in a dimmer letter, and its words below', () => {
    const { app } = onFinds(done('intro-1', 'intro-2', 'undertow-1'), { sprites: named });
    press(app, 'down', 'down');
    expect(detail(app)).toMatchObject({ title: 'COUNTING RHYME', source: 'Sung to children below the gates.', picture: 'find-paper-rhyme' });
    expect(detail(app).stamp).toBeUndefined();
    const drawn = record((ctx) => app.draw(ctx));
    const name = drawn.texts.find((t) => t.text === 'COUNTING RHYME')!;
    const picture = drawn.images.find((i) => (i.image as { id?: string }).id === 'find-paper-rhyme')!;
    expect(name.color).toBe(COLORS.accent);
    // The picture is drawn as it was made, pixel for pixel, at the left of the page under the name.
    expect(picture).toMatchObject({ x: name.x, w: FIND_PICTURE, h: FIND_PICTURE });
    expect(FIND_PICTURE).toBe(56);
    expect(picture.y).toBeGreaterThanOrEqual(name.y + 11);
    // Where it comes from: beside the picture, in as many short lines as it takes, none below the picture's foot.
    const source = wrap('Sung to children below the gates.', FIND_SOURCE_CHARS);
    expect(source.length).toBe(2);
    const beside = source.map((line) => drawn.texts.find((t) => t.text === line)!);
    for (const line of beside) {
      expect(line.color).toBe(COLORS.dim);
      expect(line.x).toBe(picture.x + FIND_PICTURE + 6);
      expect(line.right).toBeLessThanOrEqual(306 - 4);
      expect(line.y).toBeGreaterThanOrEqual(picture.y);
      expect(line.y + 11).toBeLessThanOrEqual(picture.y + FIND_PICTURE);
    }
    // Every line of what it says is on the page, under the picture.
    const first = drawn.texts.find((t) => t.text.startsWith('Brass for the owner'))!;
    expect(first.x).toBe(name.x);
    expect(first.y).toBeGreaterThanOrEqual(picture.y + FIND_PICTURE + 4);
    const page = drawn.texts.filter((t) => t.x === name.x && t.y >= first.y);
    expect(page.map((t) => t.text).join(' ')).toBe(FINDS[2].text);
    for (const line of page) expect(line.y).toBeLessThan(252 - 11);
  });

  test('a check is the bare brass with its number stamped on it by the game: dark on the metal, with a light edge under it', () => {
    const { app } = onFinds(done('intro-1', 'intro-2', 'undertow-1', 'undertow-2'), { sprites: named });
    for (let i = 0; i < 24; i++) press(app, 'down');
    expect(detail(app)).toMatchObject({ title: 'CHECK 114', picture: 'find-check-0', stamp: '114' });
    const drawn = record((ctx) => app.draw(ctx));
    const picture = drawn.images.find((i) => (i.image as { id?: string }).id === 'find-check-0')!;
    expect(picture).toMatchObject({ w: FIND_PICTURE, h: FIND_PICTURE });
    const stamps = drawn.texts.filter((t) => t.text === '114' && t.align === 'center');
    expect(stamps.length).toBe(2);
    const [edge, cut] = stamps;
    // The number sits in the middle of the disc, below the hole it hung by.
    expect(cut.x).toBe(picture.x + FIND_PICTURE / 2);
    expect(cut.y).toBeGreaterThan(picture.y + 16);
    expect(cut.y + cut.size).toBeLessThan(picture.y + FIND_PICTURE - 8);
    expect([edge.x - cut.x, edge.y - cut.y]).toEqual([1, 1]);
    expect(edge.color).not.toBe(cut.color);
    // It is drawn after the brass, or the brass would cover it.
    const at = (kind: string, of: unknown[], item: unknown) => drawn.order.findIndex((step) => step.kind === kind && step.at === of.indexOf(item));
    expect(at('text', drawn.texts, edge)).toBeGreaterThan(at('image', drawn.images, picture));
    expect(at('text', drawn.texts, cut)).toBeGreaterThan(at('text', drawn.texts, edge));
    // The widest number there is still lies inside the face of the disc.
    const widest = Math.max(...FINDS.filter((f) => f.kind === 'check').map((f) => String(f.no).length));
    expect(widest * cut.size * 0.4).toBeLessThanOrEqual(34);
  });

  test('one not found shows no picture, and nothing is stamped', () => {
    const { app } = onFinds(done('intro-1', 'intro-2', 'undertow-1'), { sprites: named });
    for (const steps of [0, 24]) {
      for (let i = 0; i < steps; i++) press(app, 'down');
      expect(detail(app).title).toBe('? ? ?');
      expect(detail(app).picture).toBeUndefined();
      expect(detail(app).stamp).toBeUndefined();
      const drawn = record((ctx) => app.draw(ctx));
      expect(drawn.images.filter((i) => String((i.image as { id?: string }).id).startsWith('find-'))).toEqual([]);
      // As before: that it is not found, under the three marks, and then the clue.
      const marks = drawn.texts.find((t) => t.text === '? ? ?' && t.color === COLORS.accent)!;
      const not = drawn.texts.find((t) => t.text === 'Not found yet.')!;
      expect(not.x).toBe(marks.x);
      expect(not.y).toBeGreaterThan(marks.y);
    }
  });

  test.each(['en', 'nl'] as const)('with its picture above them every find still has all its words on the page (%s)', (language) => {
    try {
      const base = fresh();
      const { app } = onFinds({ ...base, codex: FINDS.map((f) => f.id), settings: { ...base.settings, language } }, { sprites: named });
      for (const find of FINDS) {
        expect(detail(app).title, find.id).toBe(find.title);
        expect(detail(app).picture, find.id).toBe(find.picture);
        const drawn = record((ctx) => app.draw(ctx));
        const picture = drawn.images.find((i) => (i.image as { id?: string }).id === find.picture)!;
        // Where it comes from fits beside the picture.
        const source = wrap(find.source, FIND_SOURCE_CHARS);
        expect(source.length, find.id).toBeLessThanOrEqual(Math.floor(FIND_PICTURE / 11));
        for (const line of source) expect(drawn.texts.some((t) => t.text === line && t.x === picture.x + FIND_PICTURE + 6), `${find.id}: ${line}`).toBe(true);
        // Every line of its words is drawn, under the picture and above the foot of the page.
        const words = wrap(find.text, PAGE_CHARS);
        expect(words.length, find.id).toBeLessThanOrEqual(FIND_TEXT_LINES);
        const below = drawn.texts.filter((t) => t.x === picture.x && t.y >= picture.y + FIND_PICTURE);
        expect(below.map((t) => t.text), find.id).toEqual(words);
        for (const line of below) expect(line.y + 11, find.id).toBeLessThanOrEqual(252 - 2);
        press(app, 'down');
      }
    } finally {
      setLanguage('en');
    }
  });

  test('every picture is one the game has, the size of a face: each paper its own, a check one of three bare brasses', () => {
    const sprites = SPRITES as Record<string, { w: number; h: number }>;
    for (const find of FINDS) expect(sprites[find.picture], find.id).toMatchObject({ w: FIND_PICTURE, h: FIND_PICTURE });
    const papers = FINDS.filter((f) => f.kind === 'paper');
    expect(papers.map((f) => f.picture)).toEqual(papers.map((f) => `find-${f.id}`));
    const brass = (id: string): string => FINDS.find((f) => f.id === `check-${id}`)!.picture;
    // Kept dry it is brass still; what lay under water, or would not shine up, is green; what came through a fire is black.
    expect(['dock', 'kite', 'convoy', 'letter', 'debt', 'notary', 'pit', 'krell', 'rook', 'gate'].map(brass)).toEqual(Array.from({ length: 10 }, () => 'find-check-0'));
    expect(['magpie', 'depth', 'barge'].map(brass)).toEqual(['find-check-1', 'find-check-1', 'find-check-1']);
    expect(['marrow', 'hatch', 'king'].map(brass)).toEqual(['find-check-2', 'find-check-2', 'find-check-2']);
    // And the game holds no picture of a find that no find shows.
    expect(Object.keys(sprites).filter((id) => id.startsWith('find-')).sort()).toEqual([...new Set(FINDS.map((f) => f.picture))].sort());
  });

  test('in Dutch a check is a penning, and the rhyme is the Dutch one', () => {
    try {
      // The language is the game's own setting: the app sets it as the game is loaded.
      const base = done('intro-1', 'intro-2', 'undertow-1', 'undertow-2');
      const { app } = onFinds({ ...base, settings: { ...base.settings, language: 'nl' } });
      expect(labels(app)[2]).toBe('03 Aftelrijm');
      expect(labels(app)[24]).toBe('Penning 114');
      expect(labels(app)[25]).toBe('Penning ? ? ?');
      expect(snap(app).count).toBe('VONDSTEN 2/40   PENNINGEN 1');
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
