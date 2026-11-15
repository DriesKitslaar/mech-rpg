import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { choose, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/** A pilot past the first rival: two of the three wingmen take their calls. */
function licensed(): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1']) g = completeMission(g, id, MISSIONS);
  // Kite was sent away and the logs kept; the wreck and the deserter are still to come.
  return { ...g, credits: 5000, scenes: ['act-1', 'act-2', 'talk-kite', 'talk-logs'], choices: { kite: 'pass', logs: 'keep' } };
}

test('a wingman is hired from the briefing, fires in the battle, and the enemy aimed at shows what it is about to do', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify(licensed()));
  await open(page);
  await choose(page, 'continue');
  // Two conversations are due: the wreck (the hatch is torn off) and the deserter (she is covered for).
  await waitForScreen(page, 'scene');
  const talk = async () => (await snap(page) as unknown as { scene: string; talk: { who: string; asking: boolean } });
  expect((await talk()).scene).toBe('talk-rival');
  for (let i = 0; i < 40 && !(await talk()).talk.asking; i++) await press(page, 'Enter');
  await page.screenshot({ path: shot('talk-question') });
  for (let i = 0; i < 40 && (await talk()).talk?.asking; i++) await press(page, 'Enter');
  for (let i = 0; i < 40 && (await talk()).scene === 'talk-rival'; i++) await press(page, 'Enter');
  expect((await talk()).scene).toBe('talk-marrow');
  for (let i = 0; i < 20 && (await talk()).talk.who !== 'Marrow'; i++) await press(page, 'Enter');
  for (let i = 0; i < 20 && (await snap(page) as unknown as { typing: boolean }).typing; i++) await press(page, 'Enter');
  await page.screenshot({ path: shot('talk-marrow') });
  for (let i = 0; i < 80 && (await snap(page)).screen !== 'hub'; i++) await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  // The board has posted its first notice, and three people owe this pilot a favour.
  const listed = (await snap(page)).menu.items.map((i) => i.id).filter((id) => /^(bounty|favour)-/.test(id));
  expect(listed).toEqual(['bounty-1', 'favour-undertow', 'favour-ashfall', 'favour-marrow']);
  await page.screenshot({ path: shot('contracts-side') });
  await choose(page, 'bounty-1');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-bounty') });
  await press(page, 'Escape');
  await choose(page, 'patrol');
  await waitForScreen(page, 'briefing');
  const briefing = async () => (await snap(page) as unknown as { briefing: { reward: number; wingman: { id: string | null; open: number } } }).briefing;
  // Kite at his full rate, and Marrow as a friend.
  expect((await briefing()).wingman).toMatchObject({ id: null, open: 2 });
  await press(page, 'ArrowDown');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  expect(await briefing()).toMatchObject({ reward: 320, wingman: { id: 'marrow', share: 20 } });
  await page.screenshot({ path: shot('briefing-wingman') });
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitForPhase(page, 'action');
  const battle = async () => (await snap(page)).battle as unknown as { support: string | null; intent: string | null; phase: string };
  expect((await battle()).support).toBe('Marrow');
  // Into aiming: the first action is to fire, the first weapon, and then the enemy is on screen with its tags.
  await press(page, 'Enter');
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  expect((await battle()).intent).toMatch(/^(AIMS (CORE|HEAD|LEGS|ARMS)|DARTING|MENDING)$/);
  await page.screenshot({ path: shot('battle-intent') });
  expect(errors).toEqual([]);
});
