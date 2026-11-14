import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { NO_STATS } from '../src/core/stats';
import { WORLD } from '../src/content/codex';
import { MEDALS } from '../src/content/medals';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { autoBattle, choose, enterHub, nextFrame, open, press, snap, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/** A pilot some way into a career, with a record worth looking at. */
function veteran(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1']) g = completeMission(g, id, MISSIONS);
  return {
    ...g, credits: 8450, xp: xpForLevel(6) + 40, arenaRank: 3, battlesWon: 19, scenes: ['act-1'],
    ranks: { 'intro-1': 'S', 'intro-2': 'S', 'hadron-1': 'A', 'hadron-2': 'B', 'lumen-1': 'S' },
    medals: ['first-contract', 'first-s', 'first-arena', 'level-5', 'first-flawless', 'painted'], paint: 'cobalt',
    met: ['recon-drone', 'gun-turret', 'tank', 'light-mech', 'bomb-crawler'],
    stats: {
      ...NO_STATS, contracts: 19, lost: 2, retreats: 1, flawless: 3, shots: 412, hits: 318, damage: 20984, taken: 5120, kills: 44,
      parts: 37, staggers: 12, overheats: 2, bombs: 3, bosses: 0, rounds: 131, earned: 31250, seconds: 2 * 3600 + 14 * 60,
    },
    ...extra,
  };
}

async function load(page: Page, save: GameState, url?: string): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page, url);
  await choose(page, 'continue');
}

test('the pilot screen: perks, medals and the record, paged with the shoulder buttons', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, veteran());
  await enterHub(page);
  await page.screenshot({ path: shot('hub-callsign') });
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  expect(await snap(page)).toMatchObject({ page: 'perks', callsign: 'VANTA' });
  await page.screenshot({ path: shot('pilot-perks') });
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('medals');
  await page.screenshot({ path: shot('pilot-medals') });
  for (let i = 0; i < 30; i++) await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('pilot-medals-secret') });
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('record');
  await page.screenshot({ path: shot('pilot-record') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});

test('the database: units met and not met, the world so far, and the manual', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const met = ['recon-drone', 'gunship', 'shield-drone', 'bomb-crawler', 'gun-turret', 'tank', 'light-mech', 'heavy-mech', 'rival', 'leviathan', 'adjuster'];
  await load(page, veteran({ met, codex: ['varn', 'licence', 'dispatch', 'hadron', 'lumen', 'undertow', 'arena', 'ashfall'] }));
  await enterHub(page);
  await page.screenshot({ path: shot('hub-menu') });
  await choose(page, 'database');
  await waitForScreen(page, 'database');
  expect(await snap(page)).toMatchObject({ page: 'units' });
  await page.screenshot({ path: shot('database-unit') });
  for (const id of ['heavy-mech', 'leviathan', 'adjuster']) {
    for (let i = 0; i < 40 && (await snap(page)).menu.items[(await snap(page)).menu.cursor].id !== id; i++) await press(page, 'ArrowDown');
    await page.screenshot({ path: shot(`database-${id}`) });
  }
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('world');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('database-world') });
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('manual');
  await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('database-manual') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});

test('training: the list of drills, a briefing, the lent mech on the field, and a drill passed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, veteran({ drills: ['drill-heat'] }));
  await enterHub(page);
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await page.screenshot({ path: shot('training') });
  await choose(page, 'drill-aim');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('training-briefing') });
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  const end = await autoBattle(page);
  expect(end.battle).toMatchObject({ mission: 'drill-aim', outcome: 'victory' });
  await page.screenshot({ path: shot('training-result') });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await page.screenshot({ path: shot('training-settlement') });
  expect((await snap(page)).settlement).toMatchObject({ won: true, net: 150 });
  await press(page, 'Enter');
  await waitForScreen(page, 'training');
  expect(errors).toEqual([]);
});

test('the arena past the ladder: the back room for a champion, and a mirror match against the pilot\'s own mech', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, veteran({ arenaRank: 10, medals: MEDALS.map((m) => m.id), codex: WORLD.map((e) => e.id) }));
  await enterHub(page);
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  const list = await snap(page);
  expect(list.menu.items).toHaveLength(16);
  expect(list.menu.items[list.menu.cursor].id).toBe('rank-11');
  await page.screenshot({ path: shot('arena-back-room') });
  await choose(page, 'mirror');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('arena-mirror-briefing') });
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.phase === 'action');
  expect((await snap(page)).battle).toMatchObject({ mission: 'arena-mirror', enemies: ['mirror'] });
  await page.screenshot({ path: shot('arena-mirror-duel') });
  expect(errors).toEqual([]);
});

test('a medal earned is announced over the hub and then goes away', async ({ page }) => {
  // This pilot has done what two medals take but holds neither: the first save awards them.
  await load(page, veteran({ medals: ['first-contract'] }), '/?seed=7');
  await enterHub(page);
  // Changing an option saves the game.
  await choose(page, 'options');
  await waitForScreen(page, 'options');
  await press(page, 'Enter');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await page.waitForFunction(() => (window as any).__game.snapshot().toast !== null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('toast-medal') });
  const first = (await snap(page)).toast;
  expect(typeof first).toBe('string');
  await page.waitForFunction((id) => (window as any).__game.snapshot().toast !== id, first, { timeout: 8000 });
  await nextFrame(page);
});
