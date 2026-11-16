import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { MISSIONS } from '../src/content/missions';
import { SCENES } from '../src/content/scenes';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { doors, startRun } from '../src/core/gauntlet';
import { GAUNTLET_BUILD, GAUNTLET_TEXT } from '../src/content/gauntlet';
import { choose, enterHub, finishBattle, open, press, snap, waitForPhase, waitForScreen } from './helpers';

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
  // A Second Wind gives a turn back, so something of this one is spent first: R1 before that keeps the meter.
  await press(page, 'KeyE');
  expect(await drive()).toEqual({ kind: 'second-wind', value: 100 });
  await press(page, 'Enter');
  await press(page, 'Enter');
  await press(page, 'Enter');
  await waitForPhase(page, 'action');
  await press(page, 'KeyE');
  await waitForPhase(page, 'action');
  expect(await drive()).toEqual({ kind: 'second-wind', value: 0 });
  await page.screenshot({ path: shot('battle-overdrive-spent') });
  expect(errors).toEqual([]);
});

test('the Gauntlet\'s doors: an elite behind one, a fourth thing on offer for beating it, and a relic from the warden', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A run about to meet its first elite: the first floor from the third on with one behind its left door.
  let found: { seed: number; floor: number } | null = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    for (const floor of [3, 4]) if (!found && doors({ ...startRun(seed, GAUNTLET_BUILD), floor }, GAUNTLET_TEXT.backgrounds)[0].elite) found = { seed, floor };
  }
  expect(found).not.toBeNull();
  // A frame that does not lose, so the test is about the rooms between floors.
  const boons = { plating: 30, capacitor: 20, optics: 30, heatsinks: 10 };
  const save = { ...pilot(6), gauntlet: { ...startRun(found!.seed, GAUNTLET_BUILD), floor: found!.floor, boons } };
  await page.addInitScript((text) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', text);
  }, JSON.stringify(save));
  await open(page);
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'gauntlet');
  await waitForScreen(page, 'gauntlet');
  type Room = { floor: number; drafting: boolean; offers: unknown[]; shown: number; relicOwed: boolean; relics: string[]; doors: { elite: { mark: string } | null }[] };
  const g = async () => (await snap(page) as unknown as { gauntlet: Room }).gauntlet;
  expect((await g()).doors.map((d) => !!d.elite)).toEqual([true, false]);
  await page.screenshot({ path: shot('gauntlet-doors-elite') });
  // The other door, looked at with R1.
  await press(page, 'KeyE');
  expect((await g()).shown).toBe(1);
  await page.screenshot({ path: shot('gauntlet-doors-other') });
  await press(page, 'KeyQ');
  await choose(page, 'door-0');
  await waitForPhase(page, 'action');
  const elites = (await snap(page) as unknown as { battle: { elites: { mark: string }[] } }).battle.elites;
  expect(elites).toHaveLength(1);
  await page.screenshot({ path: shot('battle-elite') });
  let end = await finishBattle(page);
  expect(end.battle?.outcome).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'gauntlet');
  expect((await g()).offers).toHaveLength(4);
  await page.screenshot({ path: shot('gauntlet-draft-four') });
  await press(page, 'Enter');
  // On to the warden: its floor has one way in, and it leaves a relic.
  for (let i = 0; i < 4 && (await g()).floor < 5; i++) {
    await choose(page, 'door-1');
    await waitForPhase(page, 'action');
    end = await finishBattle(page);
    expect(end.battle?.outcome).toBe('victory');
    await press(page, 'Enter');
    await waitForScreen(page, 'gauntlet');
    await press(page, 'Enter');
  }
  expect(await g()).toMatchObject({ floor: 5, drafting: false });
  await choose(page, 'descend');
  await waitForPhase(page, 'action');
  end = await finishBattle(page);
  expect(end.battle?.outcome).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'gauntlet');
  expect(await g()).toMatchObject({ floor: 6, relicOwed: true });
  await page.screenshot({ path: shot('gauntlet-relic') });
  await press(page, 'Enter');
  const after = await g();
  expect(after).toMatchObject({ relicOwed: false, drafting: true });
  expect(after.relics).toHaveLength(1);
  await page.screenshot({ path: shot('gauntlet-relic-held') });
  expect(errors).toEqual([]);
});

test('faces and voices: a wanted notice with a face, the wanted pilot\'s word as the fight opens, and the wingman on the radio', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let g = pilot(6);
  for (const id of ['hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1']) g = completeMission(g, id, MISSIONS);
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify({ ...g, credits: 9000, scenes: SCENES.map((s) => s.id), choices: {} }));
  // At the game's own speed: in fast mode nobody talks.
  await page.goto('/?seed=7');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'contracts');
  await choose(page, 'bounty-1');
  await waitForScreen(page, 'briefing');
  // The screen opens out of the dark and writes its text: wait for both.
  await page.waitForTimeout(4500);
  await page.screenshot({ path: shot('briefing-wanted') });
  await choose(page, 'wingman');
  await choose(page, 'accept');
  await waitForPhase(page, 'talk');
  expect((await snap(page)).battle?.spoken).toBe('Nice helmet. I will have it when you are done with it.');
  for (let i = 0; i < 60 && (await snap(page) as unknown as { battle: { typing: boolean } }).battle.typing; i++) await page.waitForTimeout(100);
  await page.screenshot({ path: shot('battle-wanted-talk') });
  // The wingman waits until Magpie is done, and then reports in.
  expect((await snap(page) as unknown as { battle: { radio: string | null } }).battle.radio).toMatch(/^KITE: /);
  for (let i = 0; i < 40 && (await snap(page)).battle?.phase === 'talk'; i++) { await press(page, 'Enter'); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
  expect((await snap(page) as unknown as { battle: { radio: string | null } }).battle.radio).toBe('KITE: On station. Ready when you are.');
  await page.screenshot({ path: shot('battle-radio') });
  expect(errors).toEqual([]);
});

test('comfort: the speed of text and a calm picture are options, and the database plays the songs heard so far', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify({ ...pilot(6), heard: ['title', 'hub', 'briefing', 'battle', 'victory', 'boss'] }));
  await open(page);
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'options');
  await waitForScreen(page, 'options');
  const noteOf = async (id: string) => (await snap(page)).menu.items.find((i) => i.id === id)?.note;
  expect(await noteOf('textSpeed')).toBe('Normal');
  expect(await noteOf('calm')).toBe('Full');
  // Down to the speed of text, one step on; then the calm picture, on.
  for (let i = 0; i < 12 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== 'textSpeed'; i++) await press(page, 'ArrowDown');
  await press(page, 'ArrowRight');
  expect(await noteOf('textSpeed')).toBe('Fast');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  expect(await noteOf('calm')).toBe('Calm');
  await page.screenshot({ path: shot('options-comfort') });
  // They are kept: the stored settings say so.
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-settings') ?? '{}'));
  expect(stored).toMatchObject({ textSpeed: 'fast', calm: true });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'database');
  await waitForScreen(page, 'database');
  await press(page, 'KeyQ');
  expect(await snap(page)).toMatchObject({ page: 'music' });
  const heard = (await snap(page)).menu.items.filter((i) => i.enabled).map((i) => i.id);
  expect(heard).toEqual(expect.arrayContaining(['title', 'hub', 'boss']));
  for (let i = 0; i < 20 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== 'boss'; i++) await press(page, 'ArrowDown');
  await press(page, 'Enter');
  expect(await snap(page) as unknown as { playing: string | null }).toMatchObject({ playing: 'boss' });
  await page.screenshot({ path: shot('database-music') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});
