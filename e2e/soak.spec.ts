import { expect, test, type Page } from '@playwright/test';
import { ARCHETYPES } from '../src/core/archetype';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import { meetingsWon, type Grudge } from '../src/core/grudge';
import { DEFAULT_MIXES, MIX_KEYS, isMix, mixId, setMix, stepMix, type Mix } from '../src/core/mix';
import { xpForLevel } from '../src/core/pilot';
import { stripesEarned } from '../src/core/stripes';
import { tunable } from '../src/core/tuning';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { FINDS } from '../src/content/finds';
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

const AFTER_THE_WAR = [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];

type Seen = Snap & {
  list?: string; busy?: boolean; page?: string; launch?: unknown; gauntlet?: { floor: number | null; drafting: boolean }; briefing?: { turned?: boolean }; toasts?: string[];
  player?: { heat: number };
  /** The account that is open, and on a bill the meeting it is of. */
  grudge?: Grudge | null; settlement?: { account?: { name: string; meeting: number; closed: boolean } | null };
};

/**
 * A pilot with the best gear there is who has done these contracts and has read nothing of the story yet.
 * The contracts done are contracts won: the board has grown by them, as it would have.
 */
function pilot(done: string[], wears: Partial<Build> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of done) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999, battlesWon: done.length };
  // The frame first, then what it carries: weapons other than the build's own, where the player wears them.
  for (const [slot, id] of [...Object.entries(REFERENCE_BUILDS.tier6), ...Object.entries(wears)]) {
    // A slot the player leaves empty is emptied.
    if (id === undefined) { g = equip(g, slot as keyof GameState['build'], null, CATALOG); continue; }
    g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return { ...g, credits: 9000, scenes: [] };
}

/**
 * The same pilot telling the story a second time: every part of the frame the bench takes at the
 * furthest the bench goes there, and everything there is to find found, so that each find's page
 * has its picture.
 */
function again(done: string[]): GameState {
  const g = pilot(done);
  const worked = Object.values(g.build).filter((id): id is string => !!id && tunable(CATALOG[id]));
  return { ...g, cycle: 1, tuning: Object.fromEntries(worked.map((id) => [id, 3])), codex: FINDS.map((find) => find.id) };
}

/**
 * A pilot the keeper of the eighth seat takes a challenge from, and loses to: the war and the audit
 * over, champion of the arena, every crown held, in a build with a veteran's perks and the bench's
 * last step on all of it. With `seated` the seat is theirs already, and the build is on the
 * Sovereign's frame in the keeper's paint: the frame is then drawn from behind in every battle.
 */
function crowned(seated: boolean): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of AFTER_THE_WAR) g = completeMission(g, id, MISSIONS);
  const frame = { head: 'head-sovereign', core: 'core-sovereign', arms: 'arms-sovereign', legs: 'legs-sovereign', generator: 'gen-singularity' };
  const build: Build = { ...ARCHETYPE_BUILDS.allrounder.late, ...(seated ? frame : {}) };
  g = { ...g, credits: 9_999_999 };
  const parts = Object.values(build).filter((id): id is string => id !== undefined);
  for (const id of new Set(parts)) while ((g.inventory[id] ?? 0) < parts.filter((other) => other === id).length) g = buy(g, id, CATALOG);
  // (A part may not fit until another has gone on: what does not go on in the first pass goes on in the second.)
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      try {
        if (id === undefined && g.build[slot] !== undefined) g = equip(g, slot, null, CATALOG);
        else if (id !== undefined && g.build[slot] !== id) g = equip(g, slot, id, CATALOG);
      } catch { /* the next pass */ }
    }
  }
  return {
    ...g, credits: 64000, xp: xpForLevel(20), cycle: 3, battlesWon: 60, arenaRank: 15, scenes: [], endingSeen: true,
    perks: { marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 },
    tuning: Object.fromEntries(parts.filter((id) => tunable(CATALOG[id])).map((id) => [id, 5])),
    masters: [...ARCHETYPES], crowns: [...ARCHETYPES], ...(seated ? { seat: true as const, paint: 'touchstone' } : {}),
  };
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

/** How long a bill is left on the screen while there is something being announced over it: four notices' worth. */
const BILL_MS = 11_000;

interface Played {
  missions: string[]; screens: string[]; battles: number; floors: number; frames: number; swarms: number; jobs: string[]; duel: boolean; launches: number; flown: number;
  /** The stripes that were announced while it played, and whatever was still waiting to be said when it stopped. */
  stripes: string[]; waiting: string[];
  /** How many notices came up over a screen in all: medals, stripes, crowns, new pages of the database. */
  notices: number;
  /** What was seen of the five kinds of weapon, where it was looked at: words over the field, lines of the bar, marks, rows of the list. */
  kinds: string[];
  /** The notices of an account taken from the list, and the bills that were a meeting's: whose, which, and whether it closed the account. */
  meetings: number; bills: string[];
}

/**
 * Plays: the first swarm that is on offer beside the board (more machines than the field holds,
 * coming on as others fall), a job of each kind as the board comes to offer it (a machine to bring
 * down, one to take whole, freight to keep, rounds to last: each has its own strip on the field),
 * the story as far as it goes (of contracts on offer together, the one whose name holds one of
 * `prefer`), then the Gauntlet for a few floors, then a look into every room. Battles are left to Auto Turn. With `other`, a contract the other side has made an offer
 * for is flown for the other side. With `seat`, the duel for the eighth seat of the arena's masters is
 * flown before anything else. With `hand`, the pilot opens the list of weapons once a turn, while the machine is
 * cool, and aims and fires the last weapon on it that can be fired (the one on the shoulder) for themselves, at the
 * second machine where there is one; Auto Turn has the rest of the turn. With `account`, the notice of an account is
 * taken before anything else whenever it is on offer, and while one is open and not yet due the board's own contracts
 * are flown to wait it through. It stops when all of that is done or its time is up.
 */
async function play(page: Page, prefer: string[], minutes: number, other = false, seat = false, hand = false, account = false): Promise<Played> {
  const tried = new Map<string, number>();
  const screens = new Set<string>();
  const rooms = ['gauntlet', 'training', 'arena', 'garage', 'shop', 'pilot', 'messages', 'database', 'options'];
  const until = Date.now() + minutes * 60_000;
  let storyOver = false;
  let battles = 0;
  let floors = 0;
  let runs = 0;
  let swarms = 0;
  // The duel for the eighth seat: entered once, where it is asked for.
  let duel = false;
  // The contracts taken from the hangar's list, and the launches watched: each as it comes on, and none of them cut short.
  let flown = 0;
  let launches = 0;
  let launching = false;
  // The stripes announced, as each comes up: one may be said again after stepping aside for a screen with no room for it.
  const stripes = new Set<string>();
  // Whether the garage's page of paint has been tried.
  let painted = false;
  // Every notice that came up, and how long the bill on the screen has been left standing for them.
  const notices = new Set<string>();
  let read = 0;
  // The kinds of job flown, by the word their titles begin with: each once, won or lost.
  const jobs: string[] = [];
  // What was seen of the five kinds of weapon, and the turn that has had its shot aimed by hand.
  const kinds = new Set<string>();
  let aimed = '';
  let last = '';
  // The notices of an account taken, the bills that were a meeting's, and the board's contracts flown to wait one through.
  let meetings = 0;
  const bills = new Set<string>();
  let waits = 0;
  // The hardening last seen on the first machine of a battle, and which battle that was.
  let hardening = { of: '', left: 0 };
  let frames = 0;
  const step = async (ms: number): Promise<void> => { frames += Math.ceil(ms / 16); await adv(page, ms); };
  while (Date.now() < until) {
    const s = await snap(page) as Seen;
    screens.add(s.screen);
    if (!!s.launch && !launching) launches++;
    launching = !!s.launch;
    if (s.toast?.startsWith('stripe:')) stripes.add(s.toast);
    if (s.toast) notices.add(s.toast);
    if (s.screen !== 'settlement') read = 0;
    const bill = s.screen === 'settlement' ? s.settlement?.account : null;
    if (bill) bills.add(`${bill.name}:${bill.meeting}:${bill.closed ? 'closed' : 'open'}`);
    const items = s.menu?.items ?? [];
    const cur = items[s.menu?.cursor ?? 0]?.id;
    const has = (id: string): boolean => items.some((item) => item.id === id && item.enabled);
    const go = (id: string): Promise<void> => tap(page, cur === id ? 'Enter' : 'ArrowDown');
    if (s.busy) { await step(96); continue; }
    if (s.screen === 'title') {
      await (s.mode && s.mode !== 'main' ? tap(page, 'Enter') : go(has('continue') ? 'continue' : 'new'));
    } else if (s.screen === 'settlement' && (s.toast || (s.toasts?.length ?? 0) > 0) && read < BILL_MS) {
      // A bill is read as a person reads it: what is announced over it is let slide up, stand and go, for as long as a person would stay.
      read += 320;
      await step(320);
    } else if (['callsign', 'scene', 'ending', 'credits', 'settlement'].includes(s.screen)) {
      await tap(page, 'Enter');
      await step(320);
    } else if (s.screen === 'briefing') {
      // A player told to reads the other side's offer where there is one, and takes it.
      await go(other && has('other') && !s.briefing?.turned ? 'other' : 'accept');
    } else if (s.screen === 'battle') {
      const b = s.battle!;
      if (`${b.mission}/${b.index}/${b.round > 1}` !== last && b.round === 1) { battles++; last = `${b.mission}/${b.index}/false`; }
      const fought = b as unknown as { words?: string[]; fork?: string | null; weapons?: { note: string }[] | null; hardened?: string[]; halved?: boolean; hardening?: number | null };
      // The machine of an account: hardened against a weapon, and, while that weapon is aimed at it, said to take half;
      // and a hardening seen to have less left than it had, or to have gone while the battle went on.
      if ((fought.hardened ?? []).length > 0) kinds.add('hardened');
      if (fought.halved) kinds.add('half');
      if (typeof fought.hardening === 'number') {
        if (hardening.of === `${b.mission}/${b.index}` && fought.hardening < hardening.left) kinds.add('wearing');
        hardening = { of: `${b.mission}/${b.index}`, left: fought.hardening };
      } else if (hardening.of === `${b.mission}/${b.index}` && b.outcome === 'ongoing') { kinds.add('worn'); hardening = { of: '', left: 0 }; }
      for (const word of fought.words ?? []) {
        const kind = /^(REDLINE|SURGE|PUNISH|WITHEET|PIEK|STRAF)\b/.exec(word);
        if (kind) kinds.add(kind[1]);
      }
      if (/^(It leaps on to|Slaat over op) /.test(b.message)) kinds.add('leap');
      // What the two works frames do: a turn opened with what the core kept, and a machine past a hundred and not past its own limit.
      if ((fought.words ?? []).some((word) => /^\+\d+ EN$/.test(word))) kinds.add('kept');
      // (Seen whenever it is so: by the pilot's next choice the end of the turn has cooled the machine again.)
      if ((s.player?.heat ?? 0) > 100 && (s.player?.heat ?? 0) <= 130) kinds.add('hot');
      if (fought.fork) kinds.add('mark');
      for (const row of fought.weapons ?? []) {
        const said = / (ALL|ALLES) \d+ /.test(row.note) ? 'row:surge' : / \d+ (SHOTS|SCHOTEN)$/.test(row.note) ? 'row:spool' : / \+\d+%$/.test(row.note) ? 'row:redline' : null;
        if (said) kinds.add(said);
      }
      const turn = `${b.mission}/${b.index}/${b.round}`;
      if (b.phase === 'action') {
        const look = hand && aimed !== turn && has('fire') && (s.player?.heat ?? 0) <= 50;
        aimed = turn;
        await go(look ? 'fire' : 'auto');
        // (The cursor may still be on its way to the row: the turn has its look when the list opens.)
        if (look && cur !== 'fire') aimed = '';
      } else if (b.phase === 'talk' || b.phase === 'result') { await tap(page, 'Enter'); await step(160); }
      else if (b.phase === 'weapon' && hand) {
        // The rows are read, and the last that can be fired is taken.
        await step(320);
        const last = items.map((item) => item.enabled).lastIndexOf(true);
        if (last < 0) await tap(page, 'Escape');
        else await tap(page, (s.menu?.cursor ?? 0) === last ? 'Enter' : 'ArrowDown');
      } else if (b.phase === 'target' && hand) {
        // Aimed at the machine the game chose and then at the next one: the mark of where a fork would go on to moves with it.
        await step(320);
        await tap(page, 'KeyE');
        await step(320);
        // (What the row says of the machine the aim has moved to is looked at as well.)
        if (((await snap(page)).battle as { halved?: boolean } | undefined)?.halved) kinds.add('half');
        await tap(page, 'Enter');
      } else if (b.phase === 'weapon' || b.phase === 'target') await tap(page, 'Escape');
      else await step(160);
    } else if (s.screen === 'hub' && s.list && s.list !== 'main') {
      const story = items.filter((item) => PHASE[item.id] && !['patrol', 'side'].includes(PHASE[item.id]) && (tried.get(item.id) ?? 0) < 3);
      const swarm = swarms < 1 ? items.find((item) => item.id.endsWith('-swarm') && item.enabled) : undefined;
      const kindOf = (item: { label: string }): string => item.label.split(':')[0];
      const job = items.find((item) => item.id.endsWith('-job') && item.enabled && !jobs.includes(kindOf(item)));
      // The notice of an account first, whenever it is there (a few times over, should a meeting be lost); and while
      // one is open with no notice out, one of the board's own three, which is one more contract waited through.
      const notice = account && meetings < 6 ? items.find((item) => item.id.endsWith('-grudge') && item.enabled) : undefined;
      const wait = account && !notice && s.grudge && waits < 12 ? items.find((item) => /^open-\d+-\d+-\d+$/.test(item.id) && item.enabled) : undefined;
      const pick = notice ?? swarm ?? job ?? story.find((item) => prefer.some((word) => item.id.includes(word))) ?? story[0] ?? wait;
      if (!pick) { storyOver = true; await tap(page, 'Escape'); }
      else if (cur !== pick.id) await tap(page, 'ArrowDown');
      else {
        if (pick === notice) meetings++; else if (pick === wait) waits++;
        else if (pick === swarm) swarms++; else if (pick === job) jobs.push(kindOf(job)); else tried.set(pick.id, (tried.get(pick.id) ?? 0) + 1);
        flown++;
        await tap(page, 'Enter');
      }
    } else if (s.screen === 'hub') {
      while (rooms.length > 0 && !has(rooms[0])) rooms.shift();
      if (seat && !duel) await go('arena');
      else if (!storyOver) await go('contracts');
      else if (rooms.length > 0) await go(rooms[0]);
      else break;
    } else if (s.screen === 'arena' && seat && !duel) {
      // To the masters' page, down to the row under the seven, and in.
      if (s.page !== 'masters') await tap(page, 'KeyE');
      else if (cur !== 'arena-seat') await tap(page, 'ArrowDown');
      else { duel = true; await tap(page, 'Enter'); }
      await step(160);
    } else if (s.screen === 'gauntlet' && rooms[0] === 'gauntlet' && floors < 4 && !(has('start') && runs >= 1)) {
      if (has('start')) { runs++; await go('start'); }
      else if (s.gauntlet?.drafting) { floors++; await tap(page, 'Enter'); }
      else if (has('door-0')) await go('door-0');
      else if (has('descend')) await go('descend');
      else await tap(page, 'Enter');
      await step(160);
    } else if (s.screen === 'garage' && rooms[0] === 'garage' && !painted) {
      // The garage's page of paint first: down a mix's rows, each taken a few steps on, so that a machine is coloured
      // afresh on a real canvas with every press. (With a ready paint worn the rows are dim and the presses do nothing.)
      painted = true;
      await tap(page, 'ArrowLeft');
      for (let row = 0; row < 5; row++) {
        await tap(page, 'ArrowDown');
        for (let i = 0; i < 3; i++) { await tap(page, 'ArrowRight'); await step(160); }
      }
      // B is the way back to the parts.
      await tap(page, 'Escape');
      await step(240);
    } else {
      // A room: a look round it, touching nothing that is bought, sold or set, and out again.
      // In the database that ends on the page of what was found, three rows down it.
      for (const key of ['ArrowDown', 'ArrowDown', 'KeyE', 'ArrowDown', 'KeyE', 'KeyQ', 'ArrowUp', 'KeyE', 'KeyE', 'ArrowDown', 'ArrowDown', 'ArrowDown']) { await tap(page, key); await step(240); }
      for (let i = 0; i < 8 && (await snap(page)).screen !== 'hub'; i++) { await tap(page, 'Escape'); await step(240); }
      rooms.shift();
    }
  }
  const end = await snap(page) as Seen;
  const waiting = [end.toast, ...(end.toasts ?? [])].filter((id): id is string => !!id);
  return {
    missions: end.completed ?? [], screens: [...screens].sort(), battles, floors, frames, swarms, jobs, duel, launches, flown, stripes: [...stripes], waiting, notices: notices.size,
    kinds: [...kinds].sort(), meetings, bills: [...bills],
  };
}

/** A mix that is none of the three as they come: orange armour, vivid and dark, with violet trim. */
const OWN: Mix = { slot: 3, hue: 2, finish: 3, shade: 3, trim: 19, glow: 1 };

/** Three of the five kinds of weapon in one machine: a surge and a spool in its hands, a fork on its shoulder. */
const THREE_KINDS: Partial<Build> = { rightHand: 'wpn-sluice', leftHand: 'wpn-flywheel', shoulder: 'wpn-thunderhead' };
/** And the other two: a redline and a punish, with a howler to knock a machine off balance for the punish. */
const TWO_KINDS: Partial<Build> = { rightHand: 'wpn-slagcaster', leftHand: 'wpn-spike-driver', shoulder: 'wpn-howler' };

/** A Sirocco with a volley of three hot weapons, two of them redlines, and a coolant flush. */
const HOT_VOLLEY: Partial<Build> = {
  head: 'head-sirocco', core: 'core-sirocco', arms: 'arms-sirocco', legs: 'legs-sirocco', generator: 'gen-tidal', module: 'mod-coolant',
  rightHand: 'wpn-plasma', leftHand: 'wpn-slagcaster', shoulder: 'wpn-crucible',
};
/** A Solstice with a rifle and a blade and nothing on its shoulder: what a turn leaves over is kept. */
const KEEPER_OF_TURNS: Partial<Build> = {
  head: 'head-solstice', core: 'core-solstice', arms: 'arms-solstice', legs: 'legs-solstice', generator: 'gen-tidal', booster: 'bst-phase',
  fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade', shoulder: undefined,
};

const PLAYERS: {
  name: string; done: string[]; prefer: string[]; settings: Record<string, unknown>; later?: boolean; seat?: 'taken' | 'held'; mix?: Mix;
  /** Weapons worn in place of the build's own, and whether one of them is aimed by hand each turn. */
  wears?: Partial<Build>; hand?: boolean;
  /** The account that is open as the player sets out, and the callsigns of those closed before it. */
  account?: { open: Grudge; closed?: string[] };
}[] = [
  // In the white mix as it comes: the launch and every battle from the first contract on show a mixed machine from behind.
  { name: 'from the first contract, in English, with all of the light', done: [], prefer: ['hadron'], settings: {}, mix: DEFAULT_MIXES[0] },
  { name: 'with Hadron through the war and the audit, enforcing', done: ACT_ONE, prefer: ['hadron', 'enforce'], settings: {} },
  { name: 'with Lumen, in Dutch, in a calm picture, defaulting', done: ACT_ONE, prefer: ['lumen', 'default'], settings: { language: 'nl', calm: true } },
  { name: 'with the Undertow, with less light and battles played faster', done: ACT_ONE, prefer: ['undertow', 'enforce'], settings: { detail: 'lean', fastBattles: true } },
  { name: 'a later telling in a frame the bench has worked on, taking the other side\'s offers', done: [], prefer: ['hadron'], settings: {}, later: true },
  // In a mix of their own, which the garage's page of paint then changes row by row.
  { name: 'the Gauntlet and every room, after the war, with no soft light', done: AFTER_THE_WAR, prefer: [], settings: { detail: 'bare' }, mix: OWN },
  // The keeper's machine through its three ways, and then the bill, the notice and the rooms of the one who took the seat from it.
  { name: 'the holder of seven crowns, who takes the eighth seat', done: AFTER_THE_WAR, prefer: [], settings: { difficulty: 'story' }, seat: 'taken' },
  // The Sovereign from behind in every battle, in the keeper's paint, against its own likeness first.
  { name: 'the holder of the seat in the Sovereign, in Dutch', done: AFTER_THE_WAR, prefer: [], settings: { difficulty: 'story', language: 'nl' }, seat: 'held' },
  // The five kinds of weapon that ask something of their machine: the list of weapons and the aiming line by hand, a
  // bolt that leaps on, a spool winding up and a surge emptying the cell; and what Auto Turn makes of a redline and a punish.
  { name: 'with a surge, a spool and a fork, one weapon aimed by hand each turn', done: ACT_ONE, prefer: ['lumen', 'enforce'], settings: {}, wears: THREE_KINDS, hand: true },
  { name: 'with a redline and a punish, in Dutch, left to Auto Turn', done: ACT_ONE, prefer: ['hadron', 'default'], settings: { language: 'nl' }, wears: TWO_KINDS },
  // The two frames of the yard's works pilots, each from behind in every battle: a heat bar drawn to 130 and a machine
  // past a hundred, and a turn that opens with what the last one did not spend.
  { name: 'in a Sirocco with a volley of three hot weapons, left to Auto Turn', done: AFTER_THE_WAR, prefer: ['undertow', 'enforce'], settings: {}, wears: HOT_VOLLEY },
  { name: 'in a Solstice with a rifle and a blade, in Dutch, one weapon aimed by hand each turn', done: AFTER_THE_WAR, prefer: ['lumen', 'default'], settings: { language: 'nl' }, wears: KEEPER_OF_TURNS, hand: true },
  // A pilot somebody has come back for. One whose second notice is out, in a machine hardened against the cannon
  // this pilot aims by hand: HARDENED over it, HALF beside its name while that cannon is on it, and a hardening
  // that each of those shots wears. And one at the third meeting, in Dutch, which closes the account; whoever the
  // board's contracts then leave may begin another, who knows nothing yet.
  {
    name: 'with an account at its second meeting, whose machine knows the cannon aimed by hand', done: AFTER_THE_WAR, prefer: [], settings: {}, hand: true,
    account: { open: { name: 'Brakk', kind: 'heavy-mech', origin: 'ran', knows: REFERENCE_BUILDS.tier6.shoulder!, met: 1, waited: 2 } },
  },
  {
    name: 'with an account at its third meeting and one closed before it, in Dutch', done: AFTER_THE_WAR, prefer: [], settings: { language: 'nl' },
    account: { open: { name: 'Tally', kind: 'stalker', origin: 'beat', knows: REFERENCE_BUILDS.tier6.rightHand!, met: 2, waited: 2 }, closed: ['Brakk'] },
  },
];

for (const player of PLAYERS) {
  test(`soak: ${player.name}`, async ({ page }) => {
    test.skip(!ASKED, 'a long look: run with SOAK=1');
    test.setTimeout((MINUTES + 2) * 60_000);
    const made = player.seat ? crowned(player.seat === 'held') : player.later ? again(player.done) : pilot(player.done, player.wears);
    const mixed = player.mix ? setMix(made, player.mix) : made;
    const start: GameState = player.account ? { ...mixed, grudge: player.account.open, ...(player.account.closed ? { accounts: player.account.closed } : {}) } : mixed;
    const errors = await open(page, start, player.settings);
    const played = await play(page, player.prefer, MINUTES, player.later, !!player.seat, !!player.hand, !!player.account);
    const faults = await page.evaluate(() => (window as any).__faults as string[]);
    console.log(`${player.name}: ${played.frames} frames, ${played.battles} battles, ${played.flown} contracts flown, ${played.launches} launches, ${played.swarms} swarm, jobs ${played.jobs.join(' ') || 'none'}, ${played.floors} floors, ${played.notices} notices, stripes ${played.stripes.join(' ') || 'none'}, contracts ${played.missions.length}, screens ${played.screens.join(' ')}`);
    expect([...new Set(faults)]).toEqual([]);
    expect(errors).toEqual([]);
    expect(played.frames).toBeGreaterThan(1000);
    // Every contract flown from the hangar opened with its launch, watched to the end: but for the player who asked
    // for faster battles, who was shown none. (The last contract taken may still be at its briefing when the time is up.)
    expect(played.flown).toBeGreaterThanOrEqual(5);
    if (player.settings.fastBattles) expect(played.launches).toBe(0);
    else expect([played.flown, played.flown - 1]).toContain(played.launches);
    // The stripes the kept game has now and had not when it was opened are the ones that were announced, or are waiting
    // for a screen with room to be: none earned in silence, and none announced that the record does not bear out.
    const record = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as { wonAs?: GameState['wonAs'] });
    const earned = stripesEarned(start, record).map(({ kind, stripe }) => `stripe:${kind}:${stripe}`);
    for (const id of earned) expect([...played.stripes, ...played.waiting], id).toContain(id);
    for (const id of played.stripes) expect(earned, id).toContain(id);
    console.log(`${player.name}: stripes earned ${earned.join(' ') || 'none'}, of which still waiting ${earned.filter((id) => !played.stripes.includes(id)).join(' ') || 'none'}`);
    // A player who set out in a mix: one who never came to the garage still wears it, and one who did has it changed as
    // the page of paint was pressed: each of its five things three steps on. (The look round the garage after that
    // steps on to other paints, so what is worn at the end is not asked.)
    if (player.mix) {
      const worn = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as { paint: string; mixes?: string[] });
      if (!played.screens.includes('garage')) expect(worn.paint).toBe(mixId(player.mix));
      else {
        const turned = MIX_KEYS.reduce((mix, key) => stepMix(mix, key, 3), player.mix);
        expect(isMix(worn.mixes?.[player.mix.slot - 1])).toBe(true);
        expect(worn.mixes?.[player.mix.slot - 1]).toBe(mixId(turned));
      }
    }
    // A machine that carries the new kinds was seen to use them: the words they write over the field, and for the one
    // who aims by hand the rows of the list, the mark over the next machine and the line of what leapt on.
    if (player.wears) console.log(`${player.name}: of the five kinds, seen ${played.kinds.join(' ') || 'nothing'}`);
    if (player.wears === THREE_KINDS) expect(played.kinds).toEqual(expect.arrayContaining(['SURGE', 'leap', 'mark', 'row:spool', 'row:surge']));
    if (player.wears === TWO_KINDS) expect(played.kinds).toEqual(expect.arrayContaining(['STRAF', 'WITHEET']));
    if (player.wears === HOT_VOLLEY) expect(played.kinds).toEqual(expect.arrayContaining(['hot', 'REDLINE']));
    if (player.wears === KEEPER_OF_TURNS) expect(played.kinds).toContain('kept');
    if (player.account) {
      // The notice was taken and their machine stood there hardened; the one who aims the weapon it knows by hand was told
      // it does half. Every meeting won is in the kept game, and had a bill that said whose account it was and which of
      // its meetings (the last may not have come up yet when the time ran out).
      const kept = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as Pick<GameState, 'grudge' | 'accounts'>);
      const won = meetingsWon(kept) - meetingsWon(start);
      console.log(`${player.name}: notices taken ${played.meetings}, meetings won ${won}, bills ${played.bills.join(' ') || 'none'}, closed ${(kept.accounts ?? []).join(' ') || 'none'}, open ${kept.grudge ? `${kept.grudge.name} at ${kept.grudge.met}` : 'none'}, seen ${played.kinds.filter((kind) => ['hardened', 'half', 'wearing', 'worn'].includes(kind)).join(' ') || 'nothing'}`);
      expect(played.meetings).toBeGreaterThanOrEqual(1);
      expect(played.kinds).toContain('hardened');
      // The one who aims the weapon it knows by hand, turn after turn, was told it does half and saw the hardening wear.
      if (player.hand) expect(played.kinds).toEqual(expect.arrayContaining(['half', 'wearing']));
      expect(won).toBeGreaterThanOrEqual(1);
      expect([won, won - 1]).toContain(played.bills.length);
      // Whoever was closed before is still written down, and whoever a bill said was closed is with them.
      for (const name of player.account.closed ?? []) expect(kept.accounts, name).toContain(name);
      for (const bill of played.bills.filter((line) => line.endsWith(':closed'))) expect(kept.accounts, bill).toContain(bill.split(':')[0]);
    }
    // Every one of them flew a swarm: the machines that come on later were on the screen.
    expect(played.swarms).toBe(1);
    // And jobs, once the board had one to offer: what each kind asks was on the field, with everything drawn.
    expect(played.jobs.length).toBeGreaterThanOrEqual(1);
    expect(new Set(played.jobs).size).toBe(played.jobs.length);
    if (player.seat) {
      // The duel was flown, and the seat is this pilot's: taken in it, or kept through it.
      expect(played.duel).toBe(true);
      const kept = await page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as { seat?: boolean; met?: string[]; medals?: string[] });
      expect(kept.met).toContain('arena-seat');
      expect(kept.seat).toBe(true);
      expect(kept.medals).toContain('seat');
    }
    if (player.later) {
      // It did fly for the other side: each of those contracts it finished is remembered as that.
      const kept = await page.evaluate(() => (JSON.parse(window.localStorage.getItem('ironwage-save')!) as { choices?: Record<string, string> }).choices ?? {});
      const taken: Record<string, [string, string]> = { 'hadron-1': ['seam', 'stand'], 'hadron-2': ['train', 'weigh'], 'undertow-1': ['lights', 'dark'] };
      expect(played.missions).toContain('hadron-1');
      for (const [id, [question, answer]] of Object.entries(taken)) if (played.missions.includes(id)) expect(kept[question], id).toBe(answer);
    }
  });
}
