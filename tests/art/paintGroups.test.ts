import { JOBS, paintFamilyOf, paintGroups } from '../../scripts/art/jobs';
import manifest from '../../src/content/sprites.json';
import { analyse } from '../../src/ui/paint';
import { readPng } from '../helpers/png';

const layer = (id: string) => JOBS.find((job) => job.id === id)!;

test('layers cut from one family drawing are painted as one family', () => {
  expect(paintFamilyOf(layer('legs-halo'))).toBe('halo');
  expect(paintFamilyOf(layer('core-halo'))).toBe('halo');
  expect(paintFamilyOf(layer('arms-bulwark.near'))).toBe('bulwark');
});

test('free-standing legs are painted with the family their drawing was edited from', () => {
  expect(paintFamilyOf(layer('legs-glide'))).toBe('halo');
  expect(paintFamilyOf(layer('legs-crawler'))).toBe('bulwark');
  expect(paintFamilyOf(layer('legs-spider'))).toBe('ronin');
});

test('a layer cut from a drawing from behind is painted as the same family, and so is its small one', () => {
  expect(paintFamilyOf(layer('core-halo.back'))).toBe('halo');
  expect(paintFamilyOf(layer('arms-bulwark.far.back'))).toBe('bulwark');
  expect(paintFamilyOf(layer('head-scout-mk1.back'))).toBe('salvage');
  expect(paintFamilyOf(layer('legs-glide.back'))).toBe('halo');
  expect(paintFamilyOf(layer('legs-crawler.back'))).toBe('bulwark');
  expect(paintFamilyOf(layer('legs-spider.back'))).toBe('ronin');
  // Every layer from the front has one from behind and a small one, of the same family.
  const fronts = JOBS.filter((job) => job.kind === 'layer' && !/\.(back|small)$/.test(job.id));
  expect(fronts).toHaveLength(78);
  for (const front of fronts) {
    for (const view of ['back', 'small']) expect(paintFamilyOf(layer(`${front.id}.${view}`)), `${front.id}.${view}`).toBe(paintFamilyOf(front));
  }
});

test('the small drawings, and what is carried from behind, are made from drawings that are already there: none is asked of the service', () => {
  // A small one of every layer and of everything carried, and one from behind of everything a pilot can carry.
  const views = JOBS.filter((job) => job.id.endsWith('.small') || (job.kind !== 'layer' && job.id.endsWith('.back')));
  expect(views.length).toBeGreaterThan(100);
  for (const job of views) {
    // The service is only asked for a job that has no source: these all have one, and it is a drawing that was asked for.
    expect(job.source, job.id).toBeDefined();
    expect(JOBS.some((other) => other.id === job.source && !other.source), job.id).toBe(true);
  }
  // The drawings from behind of the frame were asked for: they are no copies.
  expect(JOBS.filter((job) => job.kind === 'layer' && job.id.endsWith('.back')).every((job) => !job.source)).toBe(true);
  expect(JOBS.some((job) => job.id.startsWith('wpn-enemy-') && job.id.endsWith('.back'))).toBe(false);
});

test('every frame layer belongs to a family that has a body', () => {
  const families = new Set(JOBS.filter((job) => job.kind === 'layer').map(paintFamilyOf));
  for (const family of families) {
    expect(JOBS.some((job) => job.kind === 'layer' && job.id.startsWith('core-') && paintFamilyOf(job) === family), family).toBe(true);
  }
});

describe('what a family is judged by', () => {
  test('what was cut from its own drawing from the front: not its views from behind, its small copies, or legs edited onto it', () => {
    const groups = paintGroups(JOBS);
    expect([...groups.keys()].sort()).toEqual(['auditor', 'bulwark', 'colossus', 'courier', 'dozer', 'halo', 'mantis', 'ronin', 'salvage', 'shrike', 'sirocco', 'solstice', 'sovereign', 'sterling', 'wraith']);
    for (const [family, { judged, all }] of groups) {
      expect(judged.length, family).toBeGreaterThanOrEqual(5);
      for (const id of judged) {
        expect(/\.(back|small)$/.test(id), id).toBe(false);
        expect(layer(id).references?.[0], id).toMatch(new RegExp(`family-${family}\\.png$`));
        // Each of them takes the family's paint in all three views.
        for (const view of ['', '.back', '.small']) expect(all, `${id}${view}`).toContain(`${id}${view}`);
      }
      // Whatever takes a family's paint is one of its layers.
      for (const id of all) expect(paintFamilyOf(layer(id)), id).toBe(family);
    }
    expect([...groups.get('bulwark')!.judged].sort()).toEqual(['arms-bulwark.far', 'arms-bulwark.near', 'core-bulwark', 'head-bulwark', 'legs-bulwark']);
    // Tracks were edited onto the Bulwark's drawing: they take its paint and are no part of what it is judged by.
    expect(groups.get('bulwark')!.all).toEqual(expect.arrayContaining(['legs-crawler', 'legs-crawler.back', 'legs-crawler.small']));
    expect(groups.get('bulwark')!.judged).not.toContain('legs-crawler');
    // Every frame layer there is takes some family's paint.
    expect([...groups.values()].flatMap((group) => group.all).sort()).toEqual(JOBS.filter((job) => job.kind === 'layer').map((job) => job.id).sort());
  });

  test('a family with nothing cut from a drawing of its own is judged by what it has from the front, and failing that by what there is', () => {
    const tracks = JOBS.filter((job) => job.kind === 'layer' && /^legs-crawler(\.|$)/.test(job.id));
    expect(tracks.map((job) => job.id).sort()).toEqual(['legs-crawler', 'legs-crawler.back', 'legs-crawler.small']);
    expect(paintGroups(tracks).get('bulwark')!.judged).toEqual(['legs-crawler']);
    expect([...paintGroups(tracks.filter((job) => job.id !== 'legs-crawler')).get('bulwark')!.judged].sort()).toEqual(['legs-crawler.back', 'legs-crawler.small']);
    // Only frame layers have a family.
    expect(paintGroups(JOBS.filter((job) => job.kind !== 'layer')).size).toBe(0);
  });

  test('the paint that shipped is what that rule gives: worked out again here from each family\'s pictures from the front', () => {
    const pixels = (id: string): { data: Uint8ClampedArray } => {
      const picture = readPng(`public/sprites/${id}.png`);
      const data = new Uint8ClampedArray(picture.w * picture.h * 4);
      for (let y = 0; y < picture.h; y++) for (let x = 0; x < picture.w; x++) data.set(picture.at(x, y), (y * picture.w + x) * 4);
      return { data };
    };
    const shipped = manifest as Record<string, { paint?: unknown }>;
    for (const [family, { judged, all }] of paintGroups(JOBS)) {
      const paint = analyse(judged.map(pixels));
      for (const id of all) expect(shipped[id].paint, `${family}: ${id}`).toEqual(paint);
    }
  });
});
