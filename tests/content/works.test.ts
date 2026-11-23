import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { bufferOf, heatLimitOf, HEAT_LIMIT } from '../../src/core/battle';
import { archetypeOf } from '../../src/core/archetype';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import type { Build, FramePart, Part } from '../../src/core/types';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { PART_LINE_CHARS, partLines } from '../../src/ui/partInfo';

/**
 * The two frames the yard's works pilots fly, as they are sold: what each part is to the figure, what only
 * they have, what they cost, how they stand beside the frames there were, and that each has its pictures.
 */
const SIROCCO = ['head-sirocco', 'core-sirocco', 'arms-sirocco', 'legs-sirocco'];
const SOLSTICE = ['head-solstice', 'core-solstice', 'arms-solstice', 'legs-solstice'];
const family = (name: string): string[] => ['head', 'core', 'arms', 'legs'].map((kind) => `${kind}-${name}`);
const parts = (ids: string[]): FramePart[] => ids.map((id) => CATALOG[id] as FramePart);
const total = (ids: string[], figure: 'ap' | 'weight' | 'drain' | 'price'): number => parts(ids).reduce((sum, part) => sum + part[figure], 0);
const legs = (ids: string[]): FramePart => parts(ids)[3];
/** What the legs still carry once the frame itself is on them. */
const room = (ids: string[]): number => legs(ids).capacity! - total(ids, 'weight');
afterEach(() => setLanguage('en'));

describe('the two frames, as they are sold', () => {
  test('are what was measured, to the figure: armour, what each shrugs off, weight, drain, price, and what only they have', () => {
    const freelance = (figures: object) => ({ ...figures, vendor: 'freelance' });
    const measured: Record<string, object> = {
      'head-sirocco': freelance({ name: 'Sirocco Visor', kind: 'head', ap: 80, resist: { kinetic: 0.15, energy: 0.25, explosive: 0.25 }, weight: 40, drain: 30, price: 3800, aim: 16 }),
      'core-sirocco': freelance({ name: 'Sirocco Core', kind: 'core', ap: 300, resist: { kinetic: 0.2, energy: 0.3, explosive: 0.3 }, weight: 280, drain: 75, price: 5200, heatLimit: 130 }),
      'arms-sirocco': freelance({ name: 'Sirocco Arms', kind: 'arms', ap: 150, resist: { kinetic: 0.15, energy: 0.25, explosive: 0.25 }, weight: 130, drain: 50, price: 3600, aim: 12 }),
      'legs-sirocco': freelance({ name: 'Sirocco Legs', kind: 'legs', ap: 200, resist: { kinetic: 0.15, energy: 0.25, explosive: 0.25 }, weight: 220, drain: 65, price: 4200, capacity: 1350, mobility: 34 }),
      'head-solstice': freelance({ name: 'Solstice Helm', kind: 'head', ap: 60, resist: { kinetic: 0.15, energy: 0.3, explosive: 0.15 }, weight: 30, drain: 25, price: 4000, aim: 18 }),
      'core-solstice': freelance({ name: 'Solstice Core', kind: 'core', ap: 230, resist: { kinetic: 0.2, energy: 0.35, explosive: 0.2 }, weight: 220, drain: 65, price: 6000, buffer: 50 }),
      'arms-solstice': freelance({ name: 'Solstice Arms', kind: 'arms', ap: 110, resist: { kinetic: 0.15, energy: 0.3, explosive: 0.15 }, weight: 100, drain: 40, price: 3600, aim: 14 }),
      'legs-solstice': freelance({ name: 'Solstice Legs', kind: 'legs', ap: 155, resist: { kinetic: 0.15, energy: 0.3, explosive: 0.15 }, weight: 170, drain: 60, price: 4400, capacity: 1100, mobility: 46 }),
    };
    for (const [id, figures] of Object.entries(measured)) expect(CATALOG[id], id).toEqual({ id, ...figures });
    expect(SHOP_PARTS.filter((part: Part) => /-(sirocco|solstice)$/.test(part.id)).map((part: Part) => part.id).sort()).toEqual([...SIROCCO, ...SOLSTICE].sort());
  });

  test('one core in the catalogue has a heat limit of its own and one a buffer: nothing else has either', () => {
    const all = Object.values(CATALOG) as FramePart[];
    expect(all.filter((part) => part.heatLimit !== undefined).map((part) => [part.id, part.heatLimit])).toEqual([['core-sirocco', 130]]);
    expect(all.filter((part) => part.buffer !== undefined).map((part) => [part.id, part.buffer])).toEqual([['core-solstice', 50]]);
    // What the core does goes with the core: on another frame it is there, and another core on this frame takes it away.
    const mixed: Build = { head: 'head-auditor', core: 'core-sirocco', arms: 'arms-auditor', legs: 'legs-auditor', generator: 'gen-tidal' };
    expect(heatLimitOf(mixed, CATALOG)).toBe(130);
    expect(heatLimitOf({ ...mixed, core: 'core-auditor', head: 'head-sirocco', arms: 'arms-sirocco', legs: 'legs-sirocco' }, CATALOG)).toBe(HEAT_LIMIT);
    expect(bufferOf({ ...mixed, core: 'core-solstice' }, CATALOG)).toBe(50);
    expect(bufferOf({ ...mixed, core: 'core-auditor', head: 'head-solstice', arms: 'arms-solstice', legs: 'legs-solstice' }, CATALOG)).toBe(0);
  });

  test('each opens with its own duel, and with nothing else', () => {
    expect(SIROCCO.map((id) => SHOP_UNLOCKS[id])).toEqual(Array(4).fill('won:duel-3'));
    expect(SOLSTICE.map((id) => SHOP_UNLOCKS[id])).toEqual(Array(4).fill('won:duel-4'));
    expect(Object.entries(SHOP_UNLOCKS).filter(([, when]) => when === 'won:duel-3' || when === 'won:duel-4').map(([id]) => id).sort()).toEqual([...SIROCCO, ...SOLSTICE].sort());
  });

  test('cost what the end of the game costs: more than a Sterling, the Solstice more than the Sirocco, and neither near a Sovereign', () => {
    expect([total(SIROCCO, 'price'), total(SOLSTICE, 'price')]).toEqual([16800, 18000]);
    expect(total(SIROCCO, 'price')).toBeGreaterThan(total(family('sterling'), 'price'));
    expect(total(SOLSTICE, 'price')).toBeLessThan(total(family('sovereign'), 'price') * 0.7);
    // The core is the dear part of each: it is what the frame is.
    for (const ids of [SIROCCO, SOLSTICE]) expect(Math.max(...parts(ids).map((part) => part.price))).toBe(parts(ids)[1].price);
  });
});

describe('how they stand beside the frames there were', () => {
  test('a Sirocco is plated lightly for its weight: better than a Ronin, not as well as an Auditor, and its legs carry a third weapon', () => {
    expect(total(SIROCCO, 'ap')).toBe(730);
    expect(total(SIROCCO, 'ap')).toBeGreaterThan(total(family('ronin'), 'ap'));
    expect(total(SIROCCO, 'ap')).toBeLessThan(total(family('auditor'), 'ap'));
    // As quick as an Auditor, and with as much left to carry: only the Colossus and the Sovereign carry more.
    expect(legs(SIROCCO).mobility).toBeGreaterThan(legs(family('auditor')).mobility!);
    expect(room(SIROCCO)).toBe(680);
    const more = ['ronin', 'wraith', 'auditor', 'shrike', 'sterling', 'colossus', 'sovereign', 'solstice'].filter((name) => room(family(name)) > room(SIROCCO));
    expect(more.sort()).toEqual(['auditor', 'colossus', 'sovereign']);
    expect(room(family('auditor')) - room(SIROCCO)).toBeLessThanOrEqual(5);
  });

  test('a Solstice is quick and light: quicker than a Sirocco, slower than a Sterling, a little better plated than one, and it asks the least of its generator', () => {
    expect(total(SOLSTICE, 'ap')).toBe(555);
    expect(total(SOLSTICE, 'ap')).toBeGreaterThan(total(family('sterling'), 'ap'));
    expect(total(SOLSTICE, 'ap')).toBeLessThan(total(SIROCCO, 'ap'));
    expect(legs(SOLSTICE).mobility).toBeGreaterThan(legs(SIROCCO).mobility!);
    expect(legs(SOLSTICE).mobility).toBeLessThan(legs(family('sterling')).mobility!);
    // What a frame draws is what a turn does not have: of the frames of the end of the game only a Wraith draws less.
    const drain = Object.fromEntries(['wraith', 'shrike', 'sterling', 'auditor', 'sovereign', 'sirocco', 'solstice'].map((name) => [name, total(family(name), 'drain')]));
    expect(drain.solstice).toBe(190);
    expect(Object.keys(drain).filter((name) => drain[name] < drain.solstice)).toEqual(['wraith']);
  });

  test('each can be flown with what it is for and the best that goes inside: not too heavy, not short of energy', () => {
    const inside = { generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle' };
    const [sh, sc, sa, sl] = SIROCCO;
    const hot: Build = { head: sh, core: sc, arms: sa, legs: sl, ...inside, rightHand: 'wpn-slagcaster', leftHand: 'wpn-slagcaster', shoulder: 'wpn-crucible' };
    expect(validatePlayerBuild(hot, CATALOG)).toEqual([]);
    const [oh, oc, oa, ol] = SOLSTICE;
    const blades: Build = { head: oh, core: oc, arms: oa, legs: ol, ...inside, rightHand: 'wpn-arc-blade', leftHand: 'wpn-gavel' };
    expect(validatePlayerBuild(blades, CATALOG)).toEqual([]);
    // A Solstice draws little, so the same parts inside leave it more of a turn than they leave a Sterling.
    const sterling: Build = { ...blades, head: 'head-sterling', core: 'core-sterling', arms: 'arms-sterling', legs: 'legs-sterling' };
    expect(computeBuildStats(blades, CATALOG).turnEnergy).toBe(computeBuildStats(sterling, CATALOG).turnEnergy + 20);
    // Neither frame makes a class of its own: a build is classed by what it carries, as ever.
    expect(archetypeOf(blades, CATALOG)).toBe('duellist');
    expect(archetypeOf(hot, CATALOG)).not.toBe('duellist');
  });
});

describe('what is written and drawn of them', () => {
  test.each(['en', 'nl'] as const)('every line of every part fits the room a line has (%s)', (language) => {
    setLanguage(language);
    for (const id of [...SIROCCO, ...SOLSTICE]) {
      const lines = partLines(CATALOG[id]);
      expect(lines.length, id).toBeGreaterThanOrEqual(2);
      for (const line of lines) expect(line.length, `${id}: ${line}`).toBeLessThanOrEqual(PART_LINE_CHARS);
    }
    // A core says its one thing under its figures: one line for a limit, two for a buffer.
    expect(partLines(CATALOG['core-sirocco']).length).toBe(partLines(CATALOG['core-auditor']).length + 1);
    expect(partLines(CATALOG['core-solstice']).length).toBe(partLines(CATALOG['core-auditor']).length + 2);
  });

  test('each part has every picture a frame part has: from the front, from behind and small, and the arms a near and a far one of each', () => {
    const sheet = SPRITES as Record<string, { w: number; h: number }>;
    for (const name of ['sirocco', 'solstice']) {
      const have = Object.keys(sheet).filter((key) => key.includes(`-${name}`)).sort();
      const sterling = Object.keys(sheet).filter((key) => key.includes('-sterling')).map((key) => key.replace('sterling', name)).sort();
      expect(have, name).toEqual(sterling);
      expect(have).toHaveLength(15);
      for (const key of have) {
        expect(sheet[key].w, key).toBeGreaterThan(4);
        expect(sheet[key].h, key).toBeGreaterThan(4);
        expect(existsSync(join(__dirname, '../../public/sprites', `${key}.png`)), key).toBe(true);
      }
    }
  });

  test('the two works pilots have a face, and their weapons a picture', () => {
    const sheet = SPRITES as Record<string, unknown>;
    for (const key of ['portrait-kiln', 'portrait-vesper', 'wpn-enemy-brand', 'wpn-enemy-flue', 'wpn-enemy-wave', 'wpn-enemy-brand.small', 'wpn-enemy-flue.small', 'wpn-enemy-wave.small']) {
      expect(key in sheet, key).toBe(true);
      expect(existsSync(join(__dirname, '../../public/sprites', `${key}.png`)), key).toBe(true);
    }
  });
});
