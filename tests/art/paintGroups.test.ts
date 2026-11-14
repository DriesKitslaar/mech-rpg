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

test('every frame layer belongs to a family that has a body', () => {
  const families = new Set(JOBS.filter((job) => job.kind === 'layer').map(paintFamilyOf));
  for (const family of families) {
    expect(JOBS.some((job) => job.kind === 'layer' && job.id.startsWith('core-') && paintFamilyOf(job) === family), family).toBe(true);
  }
});
