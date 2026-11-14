import { ENEMIES } from '../../src/content/enemies';
import { CATALOG } from '../../src/content/parts';
import { unitPage } from '../../src/ui/unitPage';

const page = (id: string) => unitPage(ENEMIES[id], CATALOG);

test('a plain unit: its armour, what its core is weak to and tough against, and its weapons with their kind', () => {
  expect(page('gun-turret')).toEqual({
    stats: [{ label: 'ARMOUR', value: '260' }, { label: 'WEAK TO', value: 'Explosive' }, { label: 'TOUGH VS', value: 'Kinetic' }],
    weapons: ['Bastion Cannon (Kinetic)'],
    abilities: [],
  });
});

test('a unit with no weakness and no strength says so with a dash', () => {
  expect(page('recon-drone').stats).toEqual([
    { label: 'ARMOUR', value: '80' }, { label: 'WEAK TO', value: '-' }, { label: 'TOUGH VS', value: '-' },
  ]);
});

test('what a unit does for its side is spelled out in a line', () => {
  expect(page('shield-drone').abilities).toEqual(['Covers the rest: -40% damage']);
  expect(page('repair-drone').abilities).toEqual(['Mends 22% of a part a turn']);
  expect(page('jammer').abilities).toEqual(['Jams your aim: -20']);
  expect(page('bomb-crawler').abilities).toEqual(['Goes off on turn 3: 90 damage']);
  expect(page('carrier').abilities).toEqual(['Launches Recon Drone, every 2 turns']);
});

test('a boss says how often it changes its ways, after whatever else it does', () => {
  expect(page('sable').abilities).toEqual(['Changes tactics once']);
  expect(page('leviathan').abilities).toEqual(['Launches Bomb Crawler, every 4 turns', 'Changes tactics once']);
  expect(page('adjuster').abilities).toEqual(['Launches Lien Drone, every 4 turns', 'Changes tactics twice']);
  expect(page('overseer').abilities).toEqual(['Jams your aim: -12', 'Changes tactics once']);
});

test('every line of every page fits the width of the panel', () => {
  for (const id of Object.keys(ENEMIES)) {
    const { stats, weapons, abilities } = page(id);
    for (const line of [...weapons, ...abilities]) expect(line.length, `${id}: ${line}`).toBeLessThanOrEqual(37);
    for (const stat of stats) expect(stat.value.length, id).toBeLessThanOrEqual(9);
    expect(weapons.length + abilities.length, id).toBeLessThanOrEqual(5);
  }
});
