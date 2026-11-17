import { expect, test, type Page } from '@playwright/test';
import { completeMission, decide } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { MISSIONS } from '../src/content/missions';
import { CATALOG } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { FINDS } from '../src/content/finds';
import { autoBattle, choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

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

/** A pilot of a later telling at the end of the audit: the Undertow's war won, the box brought home, and this many checks. */
function audited(checks: number): GameState {
  const story = [
    ...ACT_ONE, 'choice-undertow', 'undertow-3', 'undertow-4', 'undertow-5', 'finale-undertow', 'quest-1', 'quest-2', 'quest-3', 'audit-1', 'audit-2', 'audit-3',
  ];
  const all = FINDS.filter((f) => f.kind === 'check').map((f) => f.id);
  // The dock's check and Krell's are found by this road in any case: they come first.
  const held = [...all.filter((id) => id === 'check-dock' || id === 'check-krell'), ...all.filter((id) => id !== 'check-dock' && id !== 'check-krell')].slice(0, checks);
  const seen = SCENES.filter((s) => !s.ending && !s.id.startsWith('left-')).map((s) => s.id);
  const base = again(story, { scenes: seen, codex: held, perks: { plating: 3, marksman: 3, capacitor: 3, heatsinks: 3, reflexes: 3, fieldTech: 2 }, xp: xpForLevel(20) });
  return { ...base, build: { ...REFERENCE_BUILDS.tier6 }, inventory: Object.fromEntries(Object.values(REFERENCE_BUILDS.tier6).map((id) => [id, 1])) };
}

test('with eight checks the third verdict is not offered, and Tamsin writes what the box wants', async ({ page }) => {
  await load(page, audited(8));
  await enterHub(page);
  await choose(page, 'contracts');
  const offered = (await snap(page)).menu.items.map((item) => item.id).filter((id) => id.startsWith('verdict-'));
  expect(offered).toEqual(['verdict-enforce', 'verdict-default']);
  await press(page, 'Escape');
  await choose(page, 'messages');
  expect((await snap(page)).menu.items.map((item) => item.id)).toContain('short-of-nine');
});

test('the third verdict: the door of the hall, the Proxy, and the meeting', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, audited(9));
  await enterHub(page);
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((item) => item.id).filter((id) => id.startsWith('verdict-'))).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
  await choose(page, 'verdict-quorum');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-quorum') });

  // Play it out, as many times as it takes: what is being looked at is what it leads to.
  let won = false;
  for (let attempt = 0; attempt < 8 && !won; attempt++) {
    await choose(page, 'accept');
    await waitForPhase(page, 'action');
    expect((await snap(page)).battle).toMatchObject({ mission: 'verdict-quorum', index: 0, objective: expect.stringContaining('1/6') });
    if (attempt === 0) await page.screenshot({ path: shot('battle-quorum-door') });
    let end = await autoBattle(page);
    if (end.battle?.outcome === 'victory') {
      await press(page, 'Enter');
      await waitForPhase(page, 'action');
      expect((await snap(page)).battle).toMatchObject({ index: 1, enemies: ['proxy'] });
      await choose(page, 'fire');
      await press(page, 'Enter');
      expect((await snap(page)).menu.items.map((i) => i.label)).toEqual(['Urn', 'Dais', 'Gavel', 'Mask']);
      await page.screenshot({ path: shot('boss-proxy') });
      await press(page, 'Escape');
      await press(page, 'Escape');
      end = await autoBattle(page);
      won = end.battle?.outcome === 'victory';
    }
    await press(page, 'Enter');
    await waitForScreen(page, 'settlement');
    await press(page, 'Enter');
    if (!won) {
      await enterHub(page);
      await choose(page, 'contracts');
      await choose(page, 'verdict-quorum');
      await waitForScreen(page, 'briefing');
    }
  }
  expect(won).toBe(true);
  // What became of the people this pilot decided about, then the epilogue on the picture of the meeting.
  for (let i = 0; i < 200 && (await snap(page)).screen === 'scene'; i++) await press(page, 'Enter');
  await waitForScreen(page, 'ending');
  expect(await snap(page)).toMatchObject({ scene: 'ending-quorum-undertow', ending: 'undertow' });
  await page.screenshot({ path: shot('scene-ending-quorum') });
  await enterHub(page);
  expect((await snap(page)).completed).toContain('verdict-quorum');
  expect((await snap(page)).menu.items.map((item) => item.id)).toContain('cycle');
  expect(errors).toEqual([]);
});
