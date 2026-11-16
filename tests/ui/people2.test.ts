import { startNewCycle } from '../../src/core/campaign';
import { PEOPLE } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { PAGE_CHARS, personKnown } from '../../src/ui/databaseScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, inHub, press, select, snap } from '../helpers/app';
import { overlap, record } from '../helpers/canvas';

/** What the last review found about the people of Varn. */

interface Db { page: string; count: string; detail: { title: string; lines: string[]; portrait?: string; role?: string } | null }
type AppOf = ReturnType<typeof inHub>['app'];
const db = (app: AppOf): Db => snap(app) as unknown as Db;
function people(app: AppOf): void {
  select(app, 'database');
  press(app, 'next');
  expect(db(app).page).toBe('people');
}
function point(app: AppOf, id: string): void {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
}
const known = (game = fresh()) => PEOPLE.filter((p) => personKnown(game, p)).map((p) => p.id);
/** A story played to its end on Hadron's side. */
const FINISHED = ['intro-1', 'intro-2', 'hadron-1', 'rival-1', 'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
/** A sprite store that says which picture it handed out. */
const named: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };

describe('when somebody\'s page opens', () => {
  test('those the story brings in: each at the point where the pilot first has to do with them', () => {
    const after = Object.fromEntries(PEOPLE.flatMap((p) => ('after' in p.when ? [[p.id, p.when.after]] : [])));
    expect(after).toEqual({
      dispatch: 'start', brenn: 'intro-2', varga: 'intro-2', tamsin: 'intro-2', guild: 'intro-2', kite: 'intro-2',
      ashfall: 'hadron-1', marrow: 'rival-1', sixty: 'choice',
      // The Actuary says who they are on the field of the first contract of the audit: not a contract earlier.
      actuary: 'audit-1',
    });
    const upTo = (id: string) => done(...FINISHED.slice(0, FINISHED.indexOf(id) + 1));
    expect(known(upTo('finale-hadron'))).not.toContain('actuary');
    expect(known(upTo('audit-1'))).toContain('actuary');
  });

  test('those who are met in battle: each when their own machine has been on the field, and no other', () => {
    const met = PEOPLE.flatMap((p) => ('met' in p.when ? [p] : []));
    expect(met.map((p) => p.id)).toEqual(['sable', 'rook', 'krell', 'magpie', 'dredge', 'lark', 'hollow', 'paragon', 'notary']);
    const everything = Object.keys(ENEMIES);
    for (const person of met) {
      // Their page is theirs: it is opened by the machine that carries their name.
      expect('met' in person.when && person.when.met, person.id).toBe(person.id);
      expect(known({ ...fresh(), met: [person.id] }), person.id).toContain(person.id);
      expect(known({ ...fresh(), met: everything.filter((id) => id !== person.id) }), person.id).not.toContain(person.id);
    }
  });
});

describe('a new cycle', () => {
  test('leaves everybody known who was known: the story starts over, the database does not', () => {
    const finished = { ...done(...FINISHED), met: ['sable', 'recon-drone'] };
    const before = known(finished);
    expect(before).toEqual(['dispatch', 'brenn', 'varga', 'tamsin', 'guild', 'kite', 'ashfall', 'marrow', 'sixty', 'sable', 'actuary']);
    const again = startNewCycle(finished, MISSIONS);
    expect(again).toMatchObject({ completed: [], cycle: 1 });
    expect(known(again)).toEqual(before);
    // Somebody who was never met in battle is still not known: a second story does not hand them over.
    expect(known(again)).not.toContain('rook');
  });

  test('the page says as many are known after it as before', () => {
    const finished = { ...done(...FINISHED), met: ['sable'] };
    const first = inHub(finished).app;
    people(first);
    expect(db(first).count).toBe('KNOWN 11/19');
    const second = inHub(startNewCycle(finished, MISSIONS)).app;
    people(second);
    expect(db(second).count).toBe('KNOWN 11/19');
    point(second, 'brenn');
    expect(db(second).detail).toMatchObject({ title: 'DIRECTOR BRENN', portrait: 'portrait-hadron' });
  });

  test('a pilot in a first story is told nothing early', () => {
    expect(known(fresh())).toEqual(['dispatch']);
    expect(known({ ...fresh(), cycle: 0, met: [] })).toEqual(['dispatch']);
  });
});

describe('somebody\'s page, as it is drawn', () => {
  test('the face is on it, at its own size, with whom they work for beside it and the line about them under it', () => {
    const { app } = inHub(done('intro-1', 'intro-2'), undefined, { sprites: named });
    people(app);
    point(app, 'brenn');
    const page = record((ctx) => app.draw(ctx));
    const face = page.images.filter((picture) => (picture.image as { id?: string }).id === 'portrait-hadron');
    expect(face).toHaveLength(1);
    expect(face[0]).toMatchObject({ w: 56, h: 56 });
    const role = page.texts.find((t) => t.text === 'HADRON MINING')!;
    // Beside the face, not on it: to its right, on a row the face is on.
    expect(role.left).toBeGreaterThanOrEqual(face[0].x + face[0].w);
    expect(role.y).toBeGreaterThanOrEqual(face[0].y);
    expect(role.y).toBeLessThan(face[0].y + face[0].h);
    // The line about them: under the face, every row of it, inside the page.
    const lines = wrap(PEOPLE[1].text, PAGE_CHARS);
    const rows = lines.map((line) => page.texts.find((t) => t.text === line)!);
    for (const row of rows) {
      expect(row, 'a line of the text').toBeDefined();
      expect(row.y).toBeGreaterThanOrEqual(face[0].y + face[0].h);
      expect(row.right).toBeLessThanOrEqual(306);
    }
    expect(overlap(role, page.texts.find((t) => t.text === 'DIRECTOR BRENN')!)).toBe(false);
    // Somebody not met yet has no face on the page.
    point(app, 'notary');
    const kept = record((ctx) => app.draw(ctx));
    expect(kept.images.filter((picture) => String((picture.image as { id?: string }).id).startsWith('portrait-'))).toEqual([]);
  });
});
