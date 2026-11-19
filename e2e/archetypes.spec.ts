import { expect, test, type Page } from '@playwright/test';
import { STARTERS } from '../src/content/starters';
import { acceptContract, choose, enterHub, finishMission, nextFrame, open, press, snap, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

type Lot = { id: string; callsign: string; slot: number; credits: number; figures: [string, string][] };
const lot = async (page: Page): Promise<Lot> => (await snap(page) as unknown as { starter: Lot }).starter;

/** From the title to the lot: a new game, the callsign on offer. */
async function toLot(page: Page): Promise<void> {
  await choose(page, 'new');
  await waitForScreen(page, 'callsign');
  await press(page, 'Enter');
  await waitForScreen(page, 'starter');
  // The screen has come in once a few frames have passed.
  for (let i = 0; i < 30; i++) await nextFrame(page);
}

test('a new pilot is shown the three frames there are to start in, each drawn as it is looked at', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await toLot(page);
  const pictures: Buffer[] = [];
  for (const starter of STARTERS) {
    expect(await lot(page)).toMatchObject({ id: starter.id, credits: starter.credits, callsign: 'PILOT', slot: 0 });
    pictures.push(await page.screenshot({ path: shot(`starter-${starter.id}`) }));
    await press(page, 'ArrowDown');
    for (let i = 0; i < 6; i++) await nextFrame(page);
  }
  // Round again to the first; each of the three is a picture of its own.
  expect((await lot(page)).id).toBe('hauler');
  expect(pictures[0].equals(pictures[1])).toBe(false);
  expect(pictures[1].equals(pictures[2])).toBe(false);
  expect(pictures[0].equals(pictures[2])).toBe(false);
  // Nothing is kept until a frame is taken, and B is the way back to the name.
  expect(await page.evaluate(() => window.localStorage.getItem('ironwage-save'))).toBeNull();
  await press(page, 'Escape');
  await waitForScreen(page, 'callsign');
  expect(await page.evaluate(() => window.localStorage.getItem('ironwage-save'))).toBeNull();
  expect(errors).toEqual([]);
});

test('a new game in the Courier: it is the pilot\'s frame in the hub and the garage, it wins the first contract, and the other two frames are in the shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const courier = STARTERS[1];
  await open(page);
  await toLot(page);
  await press(page, 'ArrowDown');
  expect((await lot(page)).id).toBe('courier');
  await press(page, 'Enter');
  await enterHub(page);
  let s = await snap(page);
  expect(s.build).toEqual(courier.build);
  expect(s.credits).toBe(courier.credits);
  expect(s.inventory).toEqual(Object.fromEntries(Object.values(courier.build).map((part) => [part, 1])));

  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await page.screenshot({ path: shot('starter-courier-garage') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Every part of the two frames that were left on the lot can be bought from the first visit.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  const shelf = async (): Promise<string[]> => (await snap(page)).menu.items.map((item) => item.id);
  const seen = new Set<string>();
  for (let tab = 0; tab < 12; tab++) {
    for (const id of await shelf()) seen.add(id);
    await press(page, 'KeyE');
  }
  for (const other of [STARTERS[0], STARTERS[2]]) {
    for (const slot of ['head', 'core', 'arms', 'legs'] as const) expect([...seen], other.build[slot]).toContain(other.build[slot]);
  }
  expect([...seen]).toContain('shd-plate');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await acceptContract(page, 'intro-1');
  await page.screenshot({ path: shot('starter-courier-battle') });
  await finishMission(page);
  s = await snap(page);
  expect(s.settlement).toMatchObject({ won: true });
  expect(errors).toEqual([]);
});

test('in Dutch the lot is in Dutch', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('ironwage-settings')) {
      window.localStorage.setItem('ironwage-settings', JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', language: 'nl' }));
    }
  });
  await open(page);
  await toLot(page);
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  for (let i = 0; i < 6; i++) await nextFrame(page);
  const s = await snap(page);
  expect((await lot(page)).id).toBe('dozer');
  // What each frame is, is said in Dutch; its name is a name.
  expect(s.menu.items.map((item) => item.label)).toEqual(STARTERS.map((starter) => starter.name));
  expect(s.menu.items.map((item) => item.note)).toEqual(['Het werkpaard', 'De renner', 'De muur']);
  await page.screenshot({ path: 'docs/screenshots/nl-starter-dozer.png' });
});
