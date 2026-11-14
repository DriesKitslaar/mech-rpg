import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { autoBattle, choose, enterHub, nextFrame, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

/** A pilot with the best gear there is who has done the given contracts and seen the pages of story that go with them. */
function pilot(done: string[], extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of done) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS.tier6)) {
    g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return { ...g, credits: 9000, scenes: ['act-1', 'act-2', 'act-3', 'war-won-hadron', 'war-won-lumen', 'war-won-undertow'], ...extra };
}

async function load(page: Page, save: GameState, url?: string): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page, url);
  await choose(page, 'continue');
}

/** From the hub into the given contract, up to the moment its first battle is on screen. */
async function accept(page: Page, missionId: string): Promise<void> {
  await choose(page, 'contracts');
  await choose(page, missionId);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
}

/**
 * Gets to the battle with the given index of a contract: accepts it, wins the battles before that one
 * with Auto Turn, and waits until the player may act. A lost battle means starting the contract again.
 */
async function reachBattle(page: Page, missionId: string, index: number): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await accept(page, missionId);
    let lost = false;
    for (let i = 0; i < index && !lost; i++) {
      const end = await autoBattle(page);
      lost = end.battle?.outcome !== 'victory';
      await press(page, 'Enter');
    }
    if (!lost) break;
    await waitForScreen(page, 'settlement');
    await press(page, 'Enter');
    await enterHub(page);
  }
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle).toMatchObject({ mission: missionId, index });
}

test('an objective: the briefing names it, the battle opens with talk and shows it, and the archive keeps the contract', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Not in fast mode: the talk is part of what is being looked at.
  await load(page, pilot(['intro-1', 'intro-2', 'hadron-1'], { ranks: { 'intro-1': 'S', 'intro-2': 'B' } }), '/?seed=7');
  await enterHub(page);

  await choose(page, 'contracts');
  await choose(page, 'archive');
  expect((await snap(page)).menu.items.map((i) => [i.id, i.note])).toEqual([['intro-1', 'S'], ['intro-2', 'B'], ['hadron-1', '-']]);
  await page.screenshot({ path: shot('archive') });
  await press(page, 'Escape');

  await choose(page, 'hadron-2');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-objective') });
  await choose(page, 'accept');
  await waitForPhase(page, 'talk');
  const opening = await snap(page);
  expect(opening.battle).toMatchObject({ objective: 'ORE TRAIN 12/12', enemies: ['recon-drone', 'bomb-crawler', 'recon-drone'] });
  expect(opening.battle?.spoken).toContain('Count the hostiles');
  // First the banner, then the line of talk writing itself out.
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('battle-banner') });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot('battle-talk') });
  await press(page, 'Enter');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-objective') });
  expect(errors).toEqual([]);
});

test('the title is alive, and a battle against a boss opens with a warning', async ({ page }) => {
  const story = [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3'];
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(pilot(story)));
  await open(page, '/?seed=7');
  await page.waitForTimeout(700);
  await page.screenshot({ path: shot('title-live') });
  await choose(page, 'continue');
  await enterHub(page);
  await accept(page, 'verdict-enforce');
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('battle-warning') });
  // The warning can be dismissed with a press; then Ashfall has something to say.
  await press(page, 'Enter');
  await waitForPhase(page, 'talk');
  expect((await snap(page)).battle?.spoken).toContain('I wondered which of us');
});

test('the machines: each one is on screen with its own part names, and what it launches joins the fight', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, pilot([...ACT_ONE, 'choice-hadron', 'hadron-3']));
  await enterHub(page);

  // Leviathan is the second battle of Deep Water.
  await reachBattle(page, 'hadron-4', 1);
  expect((await snap(page)).battle?.enemies).toEqual(['leviathan']);
  await choose(page, 'fire');
  await press(page, 'Enter');
  expect((await snap(page)).menu.items.map((i) => i.label)).toEqual(['Hull', 'Wheel', 'Crane', 'Deck']);
  await page.screenshot({ path: shot('boss-leviathan') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  // It drops a crawler every fourth turn: brace and wait for one.
  for (let turn = 0; turn < 6 && !(await snap(page)).battle?.enemies.includes('bomb-crawler'); turn++) {
    await choose(page, 'guard');
    await waitForPhase(page, 'action');
    await choose(page, 'endTurn');
    await page.waitForFunction(() => ['action', 'result'].includes((window as any).__game.snapshot().battle?.phase));
  }
  expect((await snap(page)).battle?.enemies).toContain('bomb-crawler');
  await nextFrame(page);
  await page.screenshot({ path: shot('boss-leviathan-crawler') });
  expect(errors).toEqual([]);
});

test('the Strip-Miner fills its side of the field', async ({ page }) => {
  await load(page, pilot([...ACT_ONE, 'choice-lumen']));
  await enterHub(page);
  await reachBattle(page, 'lumen-3', 1);
  expect((await snap(page)).battle?.enemies).toEqual(['strip-miner']);
  await page.screenshot({ path: shot('boss-strip-miner') });
});

test('the Overseer keeps a shield drone close', async ({ page }) => {
  await load(page, pilot([...ACT_ONE, 'choice-undertow', 'undertow-3']));
  await enterHub(page);
  await reachBattle(page, 'undertow-4', 1);
  expect((await snap(page)).battle?.enemies).toEqual(['overseer', 'shield-drone']);
  await choose(page, 'fire');
  await press(page, 'Enter');
  await page.screenshot({ path: shot('boss-overseer') });
});

test('the third act: Meridian, the two verdicts, the last machine and an epilogue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const story = [...ACT_ONE, 'choice-undertow', 'undertow-3', 'undertow-4', 'undertow-5', 'finale-undertow', 'audit-1', 'audit-2', 'audit-3'];
  await load(page, pilot(story));
  await enterHub(page);

  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((i) => i.id).filter((id) => id.startsWith('verdict'))).toEqual(['verdict-enforce', 'verdict-default']);
  await choose(page, 'verdict-enforce');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-verdict') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle?.enemies).toEqual(['ashfall-unbound']);
  await page.screenshot({ path: shot('duel-ashfall') });
  // Walk away from this one: the other verdict is the one being played.
  await choose(page, 'retreat');
  await choose(page, 'yes');
  await waitForPhase(page, 'result');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await press(page, 'Enter');
  await enterHub(page);

  await reachBattle(page, 'verdict-default', 1);
  expect((await snap(page)).battle?.enemies).toEqual(['adjuster']);
  await choose(page, 'fire');
  await press(page, 'Enter');
  expect((await snap(page)).menu.items.map((i) => i.label)).toEqual(['Seal', 'Base', 'Scale', 'Mask']);
  await page.screenshot({ path: shot('boss-adjuster') });
  await press(page, 'Escape');
  await press(page, 'Escape');

  // Play it out, as many times as it takes: the point is that the story can be finished and what follows.
  let won = false;
  for (let attempt = 0; attempt < 8 && !won; attempt++) {
    const end = await autoBattle(page);
    won = end.battle?.outcome === 'victory';
    await press(page, 'Enter');
    await waitForScreen(page, 'settlement');
    if (won) await page.screenshot({ path: shot('settlement-rank') });
    await press(page, 'Enter');
    if (!won) {
      await enterHub(page);
      await reachBattle(page, 'verdict-default', 1);
    }
  }
  expect(won).toBe(true);
  await waitForScreen(page, 'ending');
  expect(await snap(page)).toMatchObject({ scene: 'ending-default-undertow', ending: 'undertow' });
  await page.screenshot({ path: shot('scene-ending') });
  await enterHub(page);
  const after = await snap(page) as any;
  expect(after.completed).toContain('verdict-default');
  expect(after.menu.items.map((i: { id: string }) => i.id)).toContain('cycle');
  // The shop now sells what Meridian left behind.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  expect((await snap(page)).menu.items.map((i) => i.id)).toContain('head-auditor');
  expect(errors).toEqual([]);
});
