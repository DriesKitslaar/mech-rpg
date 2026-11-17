import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { snap, type Snap } from './helpers';

/**
 * A long look at everything that moves. The other tests in a browser play the game hurried
 * (nothing that moves is drawn then) or photograph a few chosen moments; the tests without a
 * browser draw on a canvas that paints nothing and so cannot refuse anything. Here a player made
 * of a few rules plays the game through with everything drawn, on a real canvas, and whatever a
 * canvas refuses (a light with a radius under nothing, a colour that is none, a picture that is
 * not there) is written down: by the canvas itself, and by the game's own guard, which shows what
 * went wrong in a frame in its window.
 *
 * It takes minutes, so it is only run when asked for: SOAK=1 npx playwright test e2e/soak.spec.ts
 * (SOAK_MINUTES sets how long each player plays; three when nothing is said).
 */
const ASKED = !!process.env.SOAK;
const MINUTES = Number(process.env.SOAK_MINUTES ?? 3);
// At twice the game's own size, half the handheld's: the same drawing, a quarter of the pixels to fill, so more of the game is seen in the time.
test.use({ viewport: { width: 620, height: 540 } });
// Each player has a browser of its own: they play side by side where there are workers for it (--workers 5).
test.describe.configure({ mode: 'parallel' });
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];
const PHASE = Object.fromEntries(MISSIONS.map((m) => [m.id, m.phase as string]));

type Seen = Snap & { list?: string; busy?: boolean; gauntlet?: { floor: number | null; drafting: boolean } };

/** A pilot with the best gear there is who has done these contracts and has read nothing of the story yet. */
function pilot(done: string[]): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of done) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS.tier6)) {
    g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return { ...g, credits: 9000, scenes: [] };
}

const adv = (page: Page, ms: number): Promise<void> => page.evaluate((n) => (window as any).__game.advance(n), ms);
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await adv(page, 48);
}

/** Opens the game with its clock stopped, a kept game and options in place, and everything a canvas refuses written down. */
async function open(page: Page, save: GameState, settings: Record<string, unknown>): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.addInitScript(({ kept, options }) => {
    if (!window.localStorage.getItem('ironwage-save')) {
      window.localStorage.setItem('ironwage-save', kept);
      window.localStorage.setItem('ironwage-settings', options);
    }
    const faults: string[] = [];
    (window as any).__faults = faults;
    const say = (value: unknown): string => (typeof value === 'number' || typeof value === 'string' ? String(value) : typeof value);
    const canvas = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of ['createRadialGradient', 'createLinearGradient', 'drawImage', 'fillRect', 'fillText', 'arc', 'ellipse', 'setTransform', 'translate', 'scale', 'fill', 'stroke', 'clip']) {
      const real = canvas[name];
      canvas[name] = function (this: unknown, ...args: unknown[]) {
        // What the game's guard caught in a frame it writes in its window: that is read here.
        if (name === 'fillText' && /^(error|fout): /.test(String(args[0]))) faults.push(`shown: ${String(args[0])}`);
        try {
          return real.apply(this, args);
        } catch (e) {
          faults.push(`${name}(${args.map(say).join(', ')}): ${(e as Error).message}`);
          throw e;
        }
      };
    }
    const stop = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function (offset: number, color: string) {
      try {
        return stop.call(this, offset, color);
      } catch (e) {
        faults.push(`addColorStop(${offset}, ${color}): ${(e as Error).message}`);
        throw e;
      }
    };
  }, { kept: JSON.stringify(save), options: JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', ...settings }) });
  await page.goto('/?seed=7&step=1');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await adv(page, 600);
  return errors;
}

interface Played { missions: string[]; screens: string[]; battles: number; floors: number; frames: number }

/**
 * Plays: the story as far as it goes (of contracts on offer together, the one whose name holds
 * one of `prefer`), then the Gauntlet for a few floors, then a look into every room. Battles are
 * left to Auto Turn. It stops when all of that is done or its time is up.
 */
async function play(page: Page, prefer: string[], minutes: number): Promise<Played> {
  const tried = new Map<string, number>();
  const screens = new Set<string>();
  const rooms = ['gauntlet', 'training', 'arena', 'garage', 'shop', 'pilot', 'messages', 'database', 'options'];
  const until = Date.now() + minutes * 60_000;
  let storyOver = false;
  let battles = 0;
  let floors = 0;
  let runs = 0;
  let last = '';
  let frames = 0;
  const step = async (ms: number): Promise<void> => { frames += Math.ceil(ms / 16); await adv(page, ms); };
  while (Date.now() < until) {
    const s = await snap(page) as Seen;
    screens.add(s.screen);
    const items = s.menu?.items ?? [];
    const cur = items[s.menu?.cursor ?? 0]?.id;
    const has = (id: string): boolean => items.some((item) => item.id === id && item.enabled);
    const go = (id: string): Promise<void> => tap(page, cur === id ? 'Enter' : 'ArrowDown');
    if (s.busy) { await step(96); continue; }
    if (s.screen === 'title') {
      await (s.mode && s.mode !== 'main' ? tap(page, 'Enter') : go(has('continue') ? 'continue' : 'new'));
    } else if (['callsign', 'scene', 'ending', 'credits', 'settlement'].includes(s.screen)) {
      await tap(page, 'Enter');
      await step(320);
    } else if (s.screen === 'briefing') {
      await go('accept');
    } else if (s.screen === 'battle') {
      const b = s.battle!;
      if (`${b.mission}/${b.index}/${b.round > 1}` !== last && b.round === 1) { battles++; last = `${b.mission}/${b.index}/false`; }
      if (b.phase === 'action') await go('auto');
      else if (b.phase === 'talk' || b.phase === 'result') { await tap(page, 'Enter'); await step(160); }
      else if (b.phase === 'weapon' || b.phase === 'target') await tap(page, 'Escape');
      else await step(160);
    } else if (s.screen === 'hub' && s.list && s.list !== 'main') {
      const story = items.filter((item) => PHASE[item.id] && !['patrol', 'side'].includes(PHASE[item.id]) && (tried.get(item.id) ?? 0) < 3);
      const pick = story.find((item) => prefer.some((word) => item.id.includes(word))) ?? story[0];
      if (!pick) { storyOver = true; await tap(page, 'Escape'); } else if (cur === pick.id) { tried.set(pick.id, (tried.get(pick.id) ?? 0) + 1); await tap(page, 'Enter'); } else await tap(page, 'ArrowDown');
    } else if (s.screen === 'hub') {
      while (rooms.length > 0 && !has(rooms[0])) rooms.shift();
      if (!storyOver) await go('contracts');
      else if (rooms.length > 0) await go(rooms[0]);
      else break;
    } else if (s.screen === 'gauntlet' && rooms[0] === 'gauntlet' && floors < 4 && !(has('start') && runs >= 1)) {
      if (has('start')) { runs++; await go('start'); }
      else if (s.gauntlet?.drafting) { floors++; await tap(page, 'Enter'); }
      else if (has('door-0')) await go('door-0');
      else if (has('descend')) await go('descend');
      else await tap(page, 'Enter');
      await step(160);
    } else {
      // A room: a look round it, touching nothing that is bought, sold or set, and out again.
      for (const key of ['ArrowDown', 'ArrowDown', 'KeyE', 'ArrowDown', 'KeyE', 'KeyQ', 'ArrowUp']) { await tap(page, key); await step(240); }
      for (let i = 0; i < 8 && (await snap(page)).screen !== 'hub'; i++) { await tap(page, 'Escape'); await step(240); }
      rooms.shift();
    }
  }
  const end = await snap(page);
  return { missions: end.completed ?? [], screens: [...screens].sort(), battles, floors, frames };
}

const PLAYERS: { name: string; done: string[]; prefer: string[]; settings: Record<string, unknown> }[] = [
  { name: 'from the first contract, in English, with all of the light', done: [], prefer: ['hadron'], settings: {} },
  { name: 'with Hadron through the war and the audit, enforcing', done: ACT_ONE, prefer: ['hadron', 'enforce'], settings: {} },
  { name: 'with Lumen, in Dutch, in a calm picture, defaulting', done: ACT_ONE, prefer: ['lumen', 'default'], settings: { language: 'nl', calm: true } },
  { name: 'with the Undertow, with less light and battles played faster', done: ACT_ONE, prefer: ['undertow', 'enforce'], settings: { detail: 'lean', fastBattles: true } },
  { name: 'the Gauntlet and every room, after the war, with no soft light', done: [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'], prefer: [], settings: { detail: 'bare' } },
];

for (const player of PLAYERS) {
  test(`soak: ${player.name}`, async ({ page }) => {
    test.skip(!ASKED, 'a long look: run with SOAK=1');
    test.setTimeout((MINUTES + 2) * 60_000);
    const errors = await open(page, pilot(player.done), player.settings);
    const played = await play(page, player.prefer, MINUTES);
    const faults = await page.evaluate(() => (window as any).__faults as string[]);
    console.log(`${player.name}: ${played.frames} frames, ${played.battles} battles, ${played.floors} floors, contracts ${played.missions.length}, screens ${played.screens.join(' ')}`);
    expect([...new Set(faults)]).toEqual([]);
    expect(errors).toEqual([]);
    expect(played.frames).toBeGreaterThan(1000);
  });
}
