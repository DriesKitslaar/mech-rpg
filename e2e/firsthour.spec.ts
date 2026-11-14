import { expect, test, type Page } from '@playwright/test';
import { validatePlayerBuild } from '../src/core/build';
import { buy, equip, newGame, sell, type GameState } from '../src/core/game';
import { WORLD } from '../src/content/codex';
import { CATALOG, SHOP_PARTS, STARTER_BUILD } from '../src/content/parts';
import { choose, enterHub, nextFrame, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page);
  await choose(page, 'continue');
}

test('a lost contract ends on a settlement with a word from Dispatch about what went wrong', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await choose(page, 'new');
  await enterHub(page);
  // The contracts list opens on the story's next contract: two presses and a briefing later the battle is on.
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items[(await snap(page)).menu.cursor].id).toBe('intro-1');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  // Stand still until the drones have won.
  for (let i = 0; i < 400; i++) {
    const s = await snap(page);
    if (s.battle?.phase === 'result') break;
    if (s.battle?.phase === 'action') await choose(page, 'endTurn');
    else await nextFrame(page);
  }
  expect((await snap(page)).battle).toMatchObject({ phase: 'result', outcome: 'defeat' });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: false, tip: 'stance' });
  await page.screenshot({ path: shot('settlement-lost') });
  expect(errors).toEqual([]);
});

test('a pilot whose own mech cannot deploy still has the patrol, in a mech that is lent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A core the starting legs cannot carry, the old core sold, and a hundred credits left.
  const base = { ...newGame(CATALOG, STARTER_BUILD, 'VANTA'), scenes: ['act-1'], codex: WORLD.map((e) => e.id) };
  const core = SHOP_PARTS.find((part) => part.kind === 'core' && validatePlayerBuild({ ...base.build, core: part.id }, CATALOG).includes('overweight'))!;
  let stranded: GameState = { ...base, credits: 99999 };
  stranded = sell(equip(buy(stranded, core.id, CATALOG), 'core', core.id, CATALOG), base.build.core, CATALOG);
  await load(page, { ...stranded, credits: 100 });
  await enterHub(page);
  await page.screenshot({ path: shot('hub-cannot-deploy') });
  const hub = (await snap(page)).menu.items;
  expect(hub.find((i) => i.id === 'contracts')).toMatchObject({ enabled: true, note: 'Overweight' });
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['patrol']);
  await choose(page, 'patrol');
  await waitForScreen(page, 'briefing');
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot('briefing-lent') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-lent') });
  expect(errors).toEqual([]);
});

test('after a purchase the shop says the part still has to be fitted', async ({ page }) => {
  await open(page);
  await choose(page, 'new');
  await enterHub(page);
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  for (let i = 0; i < 8; i++) await press(page, 'KeyE');
  await choose(page, 'wpn-arc-pistol');
  expect((await snap(page) as unknown as { shop: { fitHint: boolean } }).shop.fitHint).toBe(true);
  await page.screenshot({ path: shot('shop-bought') });
});
