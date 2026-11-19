import { completeMission } from '../../src/core/campaign';
import { PEOPLE } from '../../src/content/codex';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import SPRITES from '../../src/content/sprites.json';
import { WINGMEN } from '../../src/content/wingmen';
import { PAGE_CHARS, personKnown } from '../../src/ui/databaseScreen';
import { wrap } from '../../src/ui/widgets';
import { done, fresh, inHub, press, select, snap } from '../helpers/app';

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

describe('the people of Varn', () => {
  test('everybody with a face has a page, and every page has a face', () => {
    // One face is nobody's: the recorder behind the seat of the pilot's frame has a voice and a picture, and no page.
    const faces = Object.keys(SPRITES).filter((id) => id.startsWith('portrait-') && id !== 'portrait-recorder').sort();
    expect(PEOPLE.map((p) => p.portrait).sort()).toEqual(faces);
    expect(Object.keys(SPRITES)).toContain('portrait-recorder');
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
    expect(new Set(PEOPLE.map((p) => p.name)).size).toBe(PEOPLE.length);
    expect(PEOPLE).toHaveLength(21);
  });

  test.each(['en', 'nl'] as const)('every name fits the list, every role the line beside the face, and every text the page under it (%s)', (language) => {
    setLanguage(language);
    try {
      for (const person of PEOPLE) {
        expect(person.name.length, person.name).toBeLessThanOrEqual(18);
        // Beside the face there are 122 pixels, at four a letter.
        expect(person.role.length, person.role).toBeLessThanOrEqual(30);
        expect(wrap(person.text, PAGE_CHARS).length, person.text).toBeLessThanOrEqual(8);
      }
    } finally {
      setLanguage('en');
    }
  });

  test('those who are met in battle are machines the game fields, and the others open at a point the story has', () => {
    const points = new Set(['start', 'choice', 'finale', 'verdict', ...MISSIONS.map((m) => m.id)]);
    for (const person of PEOPLE) {
      if ('met' in person.when) expect(Object.hasOwn(ENEMIES, person.when.met), person.id).toBe(true);
      else expect(points.has(person.when.after), person.id).toBe(true);
    }
    // A wingman's page opens when they are for hire.
    for (const wingman of WINGMEN) expect(PEOPLE.find((p) => p.id === wingman.id)!.when).toEqual({ after: wingman.after });
  });

  test('a new pilot knows only Dispatch; the clients, the Guild and the first wingman come with the introductions', () => {
    const known = (game = fresh()) => PEOPLE.filter((p) => personKnown(game, p)).map((p) => p.id);
    expect(known()).toEqual(['dispatch']);
    expect(known(done('intro-1', 'intro-2'))).toEqual(['dispatch', 'brenn', 'varga', 'tamsin', 'guild', 'kite']);
    expect(known(done('intro-1', 'intro-2', 'hadron-1'))).toContain('ashfall');
    // Somebody met in battle is known from then on, whether or not the battle was won.
    expect(known({ ...fresh(), met: ['magpie', 'sable'] })).toEqual(['dispatch', 'sable', 'magpie']);
    expect(known(completeMission(done('intro-1', 'intro-2'), 'rival-1', MISSIONS))).toContain('marrow');
  });

  test('the database\'s second page lists them: those known by name with their face, the others kept back', () => {
    const { app } = inHub({ ...done('intro-1', 'intro-2'), met: ['recon-drone', 'lark'] });
    people(app);
    expect(snap(app).menu.items).toHaveLength(PEOPLE.length);
    expect(db(app).count).toBe('KNOWN 7/21');
    expect(db(app).detail).toMatchObject({ title: 'DISPATCH', portrait: 'portrait-dispatch', role: 'Dispatch' });
    expect(db(app).detail!.lines.join(' ')).toBe(PEOPLE[0].text);
    point(app, 'lark');
    expect(db(app).detail).toMatchObject({ title: 'LARK', portrait: 'portrait-lark', role: 'Wanted' });
    point(app, 'notary');
    expect(snap(app).menu.items.find((i) => i.id === 'notary')).toMatchObject({ label: '? ? ?', enabled: false });
    expect(db(app).detail).toEqual({ title: '? ? ?', lines: ['Not met yet.'] });
  });

  test('somebody with a price on them is wanted until their notice has been collected on', () => {
    const wanted = PEOPLE.filter((p) => p.bounty);
    expect(wanted.map((p) => p.bounty)).toEqual(['bounty-1', 'bounty-2', 'bounty-3', 'bounty-4', 'bounty-5', 'bounty-6']);
    // Each notice is the contract that fields that pilot.
    for (const person of wanted) {
      const notice = MISSIONS.find((m) => m.id === person.bounty)!;
      expect(notice.battles[0].enemies[0], person.id).toBe(person.id);
      expect(notice.portrait).toBe(person.portrait);
    }
    const loose = inHub({ ...done('intro-1', 'intro-2'), met: ['magpie'] }).app;
    people(loose);
    point(loose, 'magpie');
    expect(db(loose).detail!.role).toBe('Wanted');
    const caught = inHub({ ...done('intro-1', 'intro-2', 'bounty-1'), met: ['magpie'] }).app;
    people(caught);
    point(caught, 'magpie');
    expect(db(caught).detail!.role).toBe('Brought in');
  });

  test('the page draws the face, the name, whom they work for and the line about them', () => {
    const { app } = inHub(done('intro-1', 'intro-2'));
    people(app);
    point(app, 'brenn');
    const said: string[] = [];
    const drawn: string[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => {
          if (name === 'fillText') said.push(String(args[0]));
          if (name === 'drawImage') drawn.push(JSON.stringify(args[0]));
        }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    app.draw(ctx);
    expect(said).toEqual(expect.arrayContaining(['PEOPLE', 'DIRECTOR BRENN', 'HADRON MINING', 'Director Brenn', 'KNOWN 6/21', ...wrap(PEOPLE[1].text, PAGE_CHARS)]));
  });
});
