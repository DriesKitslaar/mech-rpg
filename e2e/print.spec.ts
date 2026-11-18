import { expect, test, type Page } from '@playwright/test';
import { completeMission, decide } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { MISSIONS } from '../src/content/missions';
import { CATALOG } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

/** A pilot who has finished the story once and is telling it again, in a mech that can take what a later cycle fields. */
function again(done: string[], extra: Partial<GameState> = {}): GameState {
  const build = REFERENCE_BUILDS.tier5;
  let g = newGame(CATALOG, build, 'VANTA');
  for (const id of done) g = completeMission(g, id, MISSIONS);
  return { ...decide(g, 'logs', 'keep'), cycle: 1, credits: 20000, xp: xpForLevel(12), medals: ['cycle'], ...extra };
}

async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page);
  await choose(page, 'continue');
}

test('a later telling opens with the act and then with a page about the recorder of the frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, again([]));
  await waitForScreen(page, 'scene');
  expect((await snap(page)).scene).toBe('act-1');
  await press(page, 'Enter');
  expect(await snap(page)).toMatchObject({ screen: 'scene', scene: 'playback' });
  await page.screenshot({ path: shot('scene-playback') });
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});

test('a later telling offers a contract nobody posted: the recorder briefs it, and machines nobody should know yet are on the field', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seen = SCENES.filter((s) => !s.ending).map((s) => s.id);
  await load(page, again(ACT_ONE, { scenes: seen, choices: { kite: 'vouch', logs: 'keep', rival: 'pull', marrow: 'cover' } }));
  await enterHub(page);
  await choose(page, 'contracts');
  const offered = (await snap(page)).menu.items.map((item) => item.id);
  expect(offered).toContain('quest-1');
  expect(offered).not.toContain('quest-2');
  await choose(page, 'quest-1');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-unlisted') });
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  expect((await snap(page)).battle).toMatchObject({ mission: 'quest-1', enemies: ['lien-drone', 'lien-drone'] });
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-unlisted') });
  expect(errors).toEqual([]);
});

test('the first telling is offered none of it', async ({ page }) => {
  const seen = SCENES.filter((s) => !s.ending).map((s) => s.id);
  await load(page, again(ACT_ONE, { cycle: 0, medals: [], scenes: seen, choices: { kite: 'vouch', logs: 'keep', rival: 'pull', marrow: 'cover' } }));
  await enterHub(page);
  await choose(page, 'contracts');
  const offered = (await snap(page)).menu.items.map((item) => item.id);
  expect(offered.filter((id) => id.startsWith('quest-'))).toEqual([]);
});
