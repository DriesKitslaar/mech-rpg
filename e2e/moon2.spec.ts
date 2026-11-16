import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { MISSIONS } from '../src/content/missions';
import { SCENES } from '../src/content/scenes';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

function pilot(level: number): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of ['intro-1', 'intro-2']) g = completeMission(g, id, MISSIONS);
  return { ...g, xp: xpForLevel(level), scenes: SCENES.map((s) => s.id) };
}

test('the Overdrive: one is fitted on the pilot\'s page, the simulator teaches it, and R1 sets it off', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify(pilot(6)));
  await open(page);
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  await press(page, 'KeyQ');
  expect(await snap(page)).toMatchObject({ page: 'drive', overdrive: 'second-wind' });
  await page.screenshot({ path: shot('pilot-drive') });
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  expect(await snap(page)).toMatchObject({ page: 'drive', overdrive: 'iron-skin' });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  // The drill lends Second Wind whatever the pilot has fitted, with the meter full.
  await choose(page, 'training');
  await choose(page, 'drill-overdrive');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  const drive = async () => (await snap(page) as unknown as { battle: { drive: { kind: string; value: number } | null } }).battle.drive;
  expect(await drive()).toEqual({ kind: 'second-wind', value: 100 });
  await page.screenshot({ path: shot('battle-overdrive-ready') });
  await press(page, 'KeyE');
  await waitForPhase(page, 'action');
  expect(await drive()).toEqual({ kind: 'second-wind', value: 0 });
  await page.screenshot({ path: shot('battle-overdrive-spent') });
  expect(errors).toEqual([]);
});
