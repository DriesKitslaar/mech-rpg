import { JOBS, paintFamilyOf } from '../../scripts/art/jobs';

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
  expect(fronts).toHaveLength(43);
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
