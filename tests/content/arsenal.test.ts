import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPOOL_BASE, shotsOf } from '../../src/core/battle';
import { impactOf } from '../../src/core/build';
import { stockFor } from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import type { Part, Weapon } from '../../src/core/types';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { COMPARE_LINE_CHARS, PART_LINE_CHARS, compareParts, partLines } from '../../src/ui/partInfo';

const KINDS = ['redline', 'surge', 'punish', 'fork', 'spool'] as const;
/** The ten, by kind: the one to be had by the middle of the story first, then the one for a pilot deep into the arena. */
const TEN: Record<typeof KINDS[number], [string, string]> = {
  redline: ['wpn-slagcaster', 'wpn-crucible'],
  surge: ['wpn-sluice', 'wpn-spillway'],
  punish: ['wpn-spike-driver', 'wpn-headsman'],
  fork: ['wpn-forkbolt', 'wpn-thunderhead'],
  spool: ['wpn-flywheel', 'wpn-thresher'],
};
const IDS = Object.values(TEN).flat();
const weapon = (id: string): Weapon => CATALOG[id] as Weapon;
const weapons = SHOP_PARTS.filter((p): p is Weapon => p.kind === 'weapon');
const old = weapons.filter((w) => !IDS.includes(w.id));
const root = join(__dirname, '..', '..');

describe('the ten weapons of the five kinds', () => {
  test('two of each kind are sold, and nothing else is of those kinds', () => {
    for (const kind of KINDS) expect(weapons.filter((w) => w.trait === kind).map((w) => w.id).sort(), kind).toEqual([...TEN[kind]].sort());
    expect(old.filter((w) => (KINDS as readonly string[]).includes(w.trait ?? ''))).toEqual([]);
    expect(new Set(IDS).size).toBe(10);
  });

  test('of each kind there is one for a hand; and, but for the punish, whose second is a blade, one for the shoulder', () => {
    for (const kind of KINDS) {
      const [first, second] = TEN[kind].map(weapon);
      expect(first.mount, first.id).toBe('hand');
      expect(first.melee, first.id).toBeUndefined();
      if (kind === 'punish') expect(second).toMatchObject({ mount: 'hand', melee: true });
      else expect(second.mount, second.id).toBe('shoulder');
      // The one for later is the dearer of the two.
      expect(second.price, second.id).toBeGreaterThan(first.price);
    }
  });

  test('each is a weapon of one kind only: none is charged, and only the one blade is a blade', () => {
    for (const id of IDS) expect(weapon(id).charge, id).toBeUndefined();
    expect(IDS.filter((id) => weapon(id).melee)).toEqual(['wpn-headsman']);
    // A blade costs nothing to swing, like every blade.
    expect(weapon('wpn-headsman')).toMatchObject({ ammo: null, costPerShot: 0 });
  });

  test('each is sold with what its kind needs', () => {
    for (const id of [...TEN.redline, ...TEN.punish, ...TEN.fork]) {
      expect(weapon(id).traitPower, id).toBeGreaterThan(0);
      expect(weapon(id).traitPower, id).toBeLessThanOrEqual(100);
    }
    // What leaps on from a fork is less than the hit it leaps on from.
    for (const id of TEN.fork) expect(weapon(id).traitPower, id).toBeLessThan(100);
    // A spool winds some way, and not for ever.
    for (const id of TEN.spool) {
      expect(weapon(id).traitPower, id).toBeGreaterThanOrEqual(2);
      expect(weapon(id).traitPower, id).toBeLessThanOrEqual(5);
      expect(shotsOf(weapon(id)), id).toBe(SPOOL_BASE);
    }
    // A surge asks something at the least, and never more than the weakest generator leaves a machine with.
    for (const id of TEN.surge) {
      expect(weapon(id).traitPower, id).toBeUndefined();
      expect(weapon(id).energy, id).toBeGreaterThanOrEqual(80);
      expect(weapon(id).energy, id).toBeLessThanOrEqual(200);
      expect(weapon(id).ammo, id).toBeNull();
    }
    // A punish does not do its own staggering: it pushes less than any blade or any weapon sold for its push.
    for (const id of TEN.punish) expect(impactOf(weapon(id)), id).toBeLessThanOrEqual(40);
  });

  test('none is built to order, each has somebody who sells it, and no name is used twice or is too long for a row', () => {
    for (const id of IDS) {
      expect(weapon(id).vendor, id).toBeDefined();
      expect('bespoke' in weapon(id), id).toBe(false);
      expect(weapon(id).name.length, id).toBeLessThanOrEqual(16);
    }
    expect(new Set(weapons.map((w) => w.name)).size).toBe(weapons.length);
    // Two from each client, four from nobody's yard.
    const by = (vendor: string): string[] => IDS.filter((id) => weapon(id).vendor === vendor).sort();
    expect(by('undertow')).toEqual(['wpn-slagcaster', 'wpn-spike-driver']);
    expect(by('lumen')).toEqual(['wpn-forkbolt', 'wpn-sluice']);
    expect(by('hadron')).toEqual(['wpn-flywheel', 'wpn-thresher']);
    expect(by('freelance')).toEqual(['wpn-crucible', 'wpn-headsman', 'wpn-spillway', 'wpn-thunderhead']);
  });
});

describe('where the ten come from', () => {
  const fresh = newGame(CATALOG, STARTER_BUILD);
  const sold = (game: GameState): string[] => stockFor(game, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((p) => p.id).filter((id) => IDS.includes(id));
  const done = (...ids: string[]): GameState => ({ ...fresh, completed: ids });
  const exclusive = MISSIONS.filter((m) => m.phase === 'choice').map((m) => m.id);
  const verdicts = MISSIONS.filter((m) => m.phase === 'verdict').map((m) => m.id);

  test('a new game is sold none of them', () => {
    expect(sold(fresh)).toEqual([]);
  });

  test('a client\'s first contract puts that client\'s hand weapon on the shelf: three kinds are met early', () => {
    expect(sold(done('undertow-1'))).toEqual(['wpn-slagcaster']);
    expect(sold(done('lumen-1'))).toEqual(['wpn-forkbolt']);
    expect(sold(done('hadron-1'))).toEqual(['wpn-flywheel']);
    const three = sold(done('undertow-1', 'lumen-1', 'hadron-1')).map(weapon);
    expect(new Set(three.map((w) => w.trait))).toEqual(new Set(['redline', 'fork', 'spool']));
    expect(three.every((w) => w.mount === 'hand')).toBe(true);
    // And none of the three is dear for where the pilot then is: no more than a rail lance.
    for (const w of three) expect(w.price, w.id).toBeLessThanOrEqual(weapon('wpn-rail-lance').price);
  });

  test('the exclusive contract, whoever it is for, adds a surge, a punish and the second spool: all five kinds by the middle of the story', () => {
    expect(exclusive).toHaveLength(3);
    for (const id of exclusive) {
      expect(sold(done(id)).sort(), id).toEqual(['wpn-sluice', 'wpn-spike-driver', 'wpn-thresher']);
      const all = sold(done('undertow-1', 'lumen-1', 'hadron-1', id)).map(weapon);
      expect(new Set(all.map((w) => w.trait)), id).toEqual(new Set(KINDS));
    }
  });

  test('ranks of the arena open three, in this order, and the audit\'s end the blade', () => {
    const ranked = (rank: number): string[] => sold({ ...fresh, arenaRank: rank });
    expect(ranked(4)).toEqual([]);
    expect(ranked(5)).toEqual(['wpn-thunderhead']);
    expect(ranked(6).sort()).toEqual(['wpn-crucible', 'wpn-thunderhead']);
    expect(ranked(8).sort()).toEqual(['wpn-crucible', 'wpn-thunderhead']);
    expect(ranked(9).sort()).toEqual(['wpn-crucible', 'wpn-spillway', 'wpn-thunderhead']);
    expect(verdicts.length).toBeGreaterThan(0);
    for (const id of verdicts) expect(sold(done(id)), id).toEqual(['wpn-headsman']);
    // Every one of the ten has a way on to the shelf, and it is one of these.
    expect(Object.fromEntries(IDS.map((id) => [id, SHOP_UNLOCKS[id]]))).toEqual({
      'wpn-slagcaster': 'undertow-1', 'wpn-forkbolt': 'lumen-1', 'wpn-flywheel': 'hadron-1',
      'wpn-sluice': 'choice', 'wpn-spike-driver': 'choice', 'wpn-thresher': 'choice',
      'wpn-thunderhead': 'arena:5', 'wpn-crucible': 'arena:6', 'wpn-spillway': 'arena:9', 'wpn-headsman': 'verdict',
    });
  });
});

describe('what the shop and the garage say of them', () => {
  afterEach(() => setLanguage('en'));
  const lines = (id: string): string[] => partLines(weapon(id));

  test('each kind has its line, with the number the weapon is sold with', () => {
    expect(lines('wpn-slagcaster')).toContain(`REDLINE: +${weapon('wpn-slagcaster').traitPower}% per 10 heat`);
    expect(lines('wpn-sluice')).toContain('SURGE: all EN, DMG per 100');
    expect(lines('wpn-spike-driver')).toContain(`PUNISH: +${weapon('wpn-spike-driver').traitPower}% on staggered`);
    expect(lines('wpn-forkbolt')).toContain(`FORK: ${weapon('wpn-forkbolt').traitPower}% leaps to the next`);
    // A spool's line says the fewest and the most it fires.
    for (const id of TEN.spool) expect(lines(id), id).toContain(`SPOOL: ${SPOOL_BASE}-${SPOOL_BASE + weapon(id).traitPower!} shots, +1/turn`);
    expect(weapon('wpn-thresher').traitPower).not.toBe(weapon('wpn-flywheel').traitPower);
  });

  test('in Dutch too, with the same numbers', () => {
    setLanguage('nl');
    expect(lines('wpn-crucible')).toContain(`WITHEET: +${weapon('wpn-crucible').traitPower}% per 10 hitte`);
    expect(lines('wpn-spillway')).toContain('PIEK: alle EN, SCH per 100');
    expect(lines('wpn-headsman')).toContain(`STRAF: +${weapon('wpn-headsman').traitPower}% op wankelend`);
    expect(lines('wpn-thunderhead')).toContain(`VONK: ${weapon('wpn-thunderhead').traitPower}% slaat over`);
    expect(lines('wpn-thresher')).toContain(`OPTOEREN: ${SPOOL_BASE}-${SPOOL_BASE + weapon('wpn-thresher').traitPower!}x, +1/beurt`);
  });

  test('a surge\'s energy is marked as the least it takes; nothing else has the mark', () => {
    for (const id of TEN.surge) expect(lines(id)[1], id).toMatch(new RegExp(`^EN ${weapon(id).energy}\\+  HEAT ${weapon(id).heat}  IMP `));
    for (const w of weapons.filter((other) => other.trait !== 'surge')) expect(partLines(w).join('\n'), w.id).not.toContain('+  ');
  });

  test('no line of any of them is wider than the panel, in either language, and none has more lines than a weapon has had', () => {
    const most = Math.max(...old.map((w) => partLines(w).length));
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      for (const id of IDS) {
        expect(lines(id).length, `${language} ${id}`).toBeLessThanOrEqual(most);
        for (const line of lines(id)) expect(line.length, `${language} ${id}: ${line}`).toBeLessThanOrEqual(PART_LINE_CHARS);
      }
    }
  });

  test('a surge is compared by what can be compared: not by damage, push or energy, which are by what it finds', () => {
    const labels = (part: Part, fitted: Part): string[] => compareParts(part, fitted).flat().map((chip) => chip.text.split(' ')[0]);
    const lance = weapon('wpn-lance-emitter');
    for (const id of TEN.surge) {
      expect(labels(weapon(id), lance), id).toEqual(expect.arrayContaining(['ACC', 'HEAT', 'WT']));
      for (const pair of [[weapon(id), lance], [lance, weapon(id)]] as const) {
        expect(labels(...pair).filter((label) => ['DMG', 'EN', 'IMP'].includes(label)), id).toEqual([]);
      }
    }
    // Less heat and less weight are for the better, and a truer aim is.
    const sluice = weapon('wpn-sluice');
    const better = (label: string, mine: number, theirs: number, more: boolean): boolean => (mine > theirs) === more;
    expect(Object.fromEntries(compareParts(sluice, lance).flat().map((chip) => [chip.text.split(' ')[0], chip.good]))).toEqual({
      ACC: better('ACC', sluice.accuracy, lance.accuracy, true), HEAT: better('HEAT', sluice.heat, lance.heat, false), WT: better('WT', sluice.weight, lance.weight, false),
    });
    // Two weapons of other kinds are still compared by all of it.
    expect(labels(weapon('wpn-slagcaster'), lance)).toEqual(expect.arrayContaining(['DMG', 'EN', 'IMP']));
    // And a spool by the shots it is sold with.
    const [damage] = compareParts(weapon('wpn-flywheel'), weapon('wpn-rivet-rifle')).flat();
    expect(damage.text).toBe(`DMG ${weapon('wpn-flywheel').damage * SPOOL_BASE - weapon('wpn-rivet-rifle').damage}`);
    for (const id of IDS) {
      for (const row of compareParts(weapon(id), lance)) expect(row.reduce((sum, chip) => sum + chip.text.length + 2, -2), id).toBeLessThanOrEqual(COMPARE_LINE_CHARS);
    }
  });
});

describe('what they look like', () => {
  test('each has a picture of its own from the side, from behind and far off, drawn at the lowest quality', () => {
    const sprites = SPRITES as Record<string, { file: string; w: number; h: number }>;
    for (const id of IDS) {
      for (const view of ['', '.back', '.small']) {
        const sprite = sprites[`${id}${view}`];
        expect(sprite, `${id}${view}`).toBeDefined();
        expect(existsSync(join(root, 'public', sprite.file)), sprite.file).toBe(true);
      }
      const record = JSON.parse(readFileSync(join(root, 'art', 'raw', `${id}.json`), 'utf8')) as { quality: string; prompt: string };
      expect(record.quality, id).toBe('low');
      expect(existsSync(join(root, 'art', 'raw', `${id}.png`)), id).toBe(true);
    }
    // No two of them are the same picture.
    const files = IDS.map((id) => readFileSync(join(root, 'public', sprites[id].file)).toString('base64'));
    expect(new Set(files).size).toBe(10);
  });
});
