/**
 * A pilot that plays a whole career by itself: the story to an ending by a chosen road, the arena as
 * far as it can climb, buying better gear as it becomes affordable. It presses the same buttons a
 * player does for everything but the shop and the garage, where it changes the game through the
 * same rules those screens use. It exists to find what a person would find after ten hours: a
 * contract nobody can win with what the shop sells by then, a pilot left without the money to go
 * on, a screen there is no way out of.
 */
import { validatePlayerBuild } from '../src/core/build';
import type { Faction, Verdict } from '../src/core/campaign';
import {
  BUILD_SLOTS, buy, checkBuy, checkSell, equip, isValidState, ownedCount, sell, type BuildSlot, type Difficulty, type GameState,
} from '../src/core/game';
import { levelFor } from '../src/core/pilot';
import type { Build } from '../src/core/types';
import { CATALOG } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import type { InputAction } from '../src/platform/input';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../src/platform/storage';
import { App } from '../src/ui/app';
import type { SpriteStore } from '../src/ui/sprites';

export interface CareerOptions {
  faction: Faction;
  verdict: Verdict;
  difficulty: Difficulty;
  seed: number;
  /** How many times the story is played: 2 goes on into a second cycle. */
  cycles?: number;
  /** Stop after this many contracts, whatever has been reached. */
  maxContracts?: number;
}

export interface CareerReport {
  options: CareerOptions;
  /** True when every cycle asked for ended with its ending seen. */
  finished: boolean;
  /** Why it stopped short, when it did. */
  stopped?: string;
  contracts: number;
  won: number;
  /** Losses per contract id, for the contracts that were lost at least once. */
  losses: Record<string, number>;
  /** The contract lost most often in a row, and how often. */
  worst: { id: string; streak: number };
  /** Patrols and arena rematches flown only for the money. */
  grind: number;
  credits: number;
  level: number;
  arenaRank: number;
  medals: number;
  /** The reference build the pilot ended in. */
  tier: string;
  cycle: number;
  /** The lowest the pilot's credits ever were. */
  lowestCredits: number;
}

type Snap = {
  screen: string; credits: number; completed: string[];
  menu: { items: { id: string; label: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: { phase: string; outcome: string; mission: string };
  settlement?: { won: boolean };
};

const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function memoryStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

const TIERS = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'];
/** Credits the pilot keeps back when buying: a bad contract must not leave it unable to pay for the next. */
const RESERVE = 400;
/** How often a contract is tried before the pilot goes to earn money and gear elsewhere, and how often that is allowed. */
const TRIES = 3;
/** Patrols flown in one stretch before the contract is tried again, and in a whole career before it is called stuck. */
const PATROLS = 10;
const MAX_GRIND = 150;

class Stuck extends Error {}

export function playCareer(options: CareerOptions): CareerReport {
  const store = memoryStore();
  const app = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites, fast: true, seed: options.seed });
  const snap = (): Snap => app.snapshot() as Snap;
  const press = (...actions: InputAction[]): void => actions.forEach((a) => app.onInput(a));
  const select = (id: string): void => {
    for (let i = 0; i < 80 && snap().menu.items[snap().menu.cursor]?.id !== id; i++) press('down');
    if (snap().menu.items[snap().menu.cursor]?.id !== id) throw new Stuck(`no "${id}" on ${snap().screen}: ${snap().menu.items.map((i) => i.id).join(',')}`);
    press('confirm');
  };
  /** Presses through anything that only wants confirming, until the hub is up. */
  const toHub = (): void => {
    for (let i = 0; i < 40 && snap().screen !== 'hub'; i++) {
      if (!['callsign', 'scene', 'ending', 'credits', 'settlement'].includes(snap().screen)) throw new Stuck(`cannot get to the hub from ${snap().screen}`);
      press('confirm');
    }
    if (snap().screen !== 'hub') throw new Stuck(`still on ${snap().screen}`);
  };
  const report: CareerReport = {
    options, finished: false, contracts: 0, won: 0, losses: {}, worst: { id: '', streak: 0 }, grind: 0,
    credits: 0, level: 1, arenaRank: 0, medals: 0, tier: 'starter', cycle: 0, lowestCredits: Infinity,
  };
  let tier = -1;

  /** Checks that what is stored is what is in memory, and that it would load. */
  const checkSave = (): void => {
    const stored: unknown = JSON.parse(store.data[SAVE_KEY]);
    if (!isValidState(stored, CATALOG)) throw new Stuck('the stored game is not valid');
    if (JSON.stringify(stored) !== JSON.stringify(app.game)) throw new Stuck('the stored game differs from the one in memory');
    report.lowestCredits = Math.min(report.lowestCredits, app.game!.credits);
  };

  /** Fights the battles of the contract on screen with Auto Turn. Returns whether it was won. */
  const fight = (): boolean => {
    for (let i = 0; i < 400000; i++) {
      const s = snap();
      if (s.screen === 'settlement') return !!s.settlement?.won;
      if (s.screen !== 'battle') throw new Stuck(`a battle led to ${s.screen}`);
      const phase = s.battle!.phase;
      if (phase === 'animating') app.update(16);
      else if (phase === 'action') select('auto');
      else press('confirm');
    }
    throw new Stuck('a battle that does not end');
  };

  /** Flies one contract from the hub and comes back to the hub. */
  const fly = (open: () => void, id: string): boolean => {
    open();
    if (snap().screen !== 'briefing') throw new Stuck(`no briefing for ${id}`);
    select('accept');
    if (snap().screen !== 'battle') throw new Stuck(`${id} did not start: ${snap().screen}`);
    const won = fight();
    report.contracts += 1;
    if (won) report.won += 1;
    checkSave();
    toHub();
    return won;
  };
  const contract = (id: string): boolean => fly(() => { select('contracts'); select(id); }, id);
  const arena = (rank: number): boolean => fly(() => { select('arena'); select(`rank-${rank}`); }, `arena-${rank}`);

  /**
   * Moves into the best reference build the shop can supply and the pilot can pay for, selling what
   * the new build does not use. Selling returns the full price, so this never loses money.
   */
  const gearUp = (): void => {
    const stock = new Set(app.stock().map((part) => part.id));
    for (let t = TIERS.length - 1; t > tier; t--) {
      const target: Build = REFERENCE_BUILDS[TIERS[t]];
      const wanted = Object.values(target);
      let game: GameState = app.game!;
      if (!wanted.every((id) => stock.has(id) || ownedCount(game, id) > 0)) continue;
      // Take everything off that can come off, sell what the target does not need, buy what is missing.
      const needed: Record<string, number> = {};
      for (const id of wanted) needed[id] = (needed[id] ?? 0) + 1;
      const price = (id: string): number => CATALOG[id].price;
      const cost = Object.entries(needed).reduce((sum, [id, n]) => sum + Math.max(0, n - ownedCount(game, id)) * price(id), 0);
      const refund = Object.entries(game.inventory).reduce((sum, [id, n]) => sum + Math.max(0, n - (needed[id] ?? 0)) * price(id), 0);
      if (game.credits + refund - cost < RESERVE) continue;
      // Buy first where there is money for it, fit the new build, then sell the rest: a part in use cannot be sold.
      const buyMissing = (): void => {
        for (const [id, n] of Object.entries(needed)) {
          while (ownedCount(game, id) < n && checkBuy(game, id, CATALOG) === null) game = buy(game, id, CATALOG);
        }
      };
      const sellSpare = (): void => {
        for (const id of Object.keys(game.inventory)) {
          while (ownedCount(game, id) > (needed[id] ?? 0) && checkSell(game, id, CATALOG) === null) game = sell(game, id, CATALOG);
        }
      };
      const fit = (): void => {
        for (const slot of BUILD_SLOTS) {
          const id = target[slot as BuildSlot];
          if (id !== undefined && ownedCount(game, id) > 0 && game.build[slot] !== id) {
            // A part already fitted elsewhere has no spare copy yet: skip it this round.
            try { game = equip(game, slot, id, CATALOG); } catch { /* fitted on a later pass */ }
          } else if (id === undefined && game.build[slot] !== undefined) {
            try { game = equip(game, slot, null, CATALOG); } catch { /* a required slot stays as it is */ }
          }
        }
      };
      for (let pass = 0; pass < 6; pass++) { buyMissing(); fit(); sellSpare(); }
      const fitted = BUILD_SLOTS.every((slot) => game.build[slot] === target[slot as BuildSlot]);
      if (!fitted || validatePlayerBuild(game.build, CATALOG).length > 0) continue;
      app.commit(game);
      app.go('hub');
      tier = t;
      report.tier = TIERS[t];
      checkSave();
      return;
    }
  };

  /** Spends perk points as they come, on what keeps a mech alive and hitting. */
  const learn = (): void => {
    for (const id of ['plating', 'marksman', 'capacitor', 'heatsinks', 'reflexes', 'fieldTech', 'quartermaster', 'haggler']) {
      for (let i = 0; i < 3; i++) app.buyPerk(id);
    }
  };

  /** The next story contract on offer, by the road this pilot takes. */
  const nextStory = (): string | undefined => {
    const ids = app.missions().map((m) => m.id).filter((id) => id !== 'patrol' && !id.startsWith('open-'));
    const choice = ids.find((id) => id === `choice-${options.faction}`);
    const verdict = ids.find((id) => id === `verdict-${options.verdict}`);
    return choice ?? verdict ?? ids.find((id) => !id.startsWith('choice-') && !id.startsWith('verdict-'));
  };

  /** Climbs the arena for as long as it wins. Prizes put better parts in the shop. */
  const climb = (): void => {
    while (app.sideWorkOpen() && app.game!.arenaRank < 15 && app.buildErrors().length === 0) {
      const rank = app.game!.arenaRank + 1;
      // The back room is shown only to a champion.
      if (rank > 10 && app.game!.arenaRank < 10) return;
      if (!arena(rank)) return;
      gearUp();
      learn();
    }
  };

  try {
    press('confirm', 'confirm'); // New Game, and the callsign on offer.
    toHub();
    app.setSettings({ ...app.settings, difficulty: options.difficulty });
    app.go('hub');
    const cycles = options.cycles ?? 1;
    const limit = options.maxContracts ?? 2000;
    let streak = 0;
    let last = '';
    while (report.contracts < limit) {
      gearUp();
      learn();
      if (app.canStartCycle()) {
        if (app.game!.cycle + 1 >= cycles) { report.finished = true; break; }
        select('cycle');
        select('yes');
        toHub();
        continue;
      }
      const id = nextStory();
      if (!id) throw new Stuck('no story contract on offer and the story is not over');
      const won = contract(id);
      if (won) { streak = 0; climb(); continue; }
      report.losses[id] = (report.losses[id] ?? 0) + 1;
      streak = id === last ? streak + 1 : 1;
      last = id;
      if (streak > report.worst.streak) report.worst = { id, streak };
      if (streak % TRIES === 0) {
        // Three losses in a row: what anyone would do is earn somewhere safer until better gear is
        // within reach, climb the arena for better stock, and only then come back.
        if (report.grind >= MAX_GRIND) throw new Stuck(`${id} cannot be won: lost ${report.losses[id]} times, in ${report.tier}`);
        const had = tier;
        for (let i = 0; i < PATROLS && tier === had && report.grind < MAX_GRIND; i++) {
          contract('patrol');
          report.grind += 1;
          climb();
          gearUp();
        }
      }
    }
    if (!report.finished && !report.stopped) report.stopped = `stopped after ${report.contracts} contracts`;
  } catch (error) {
    if (!(error instanceof Stuck)) throw error;
    report.stopped = error.message;
  }
  const game = app.game!;
  return {
    ...report, credits: game.credits, level: levelFor(game.xp), arenaRank: game.arenaRank, medals: game.medals.length, cycle: game.cycle,
    lowestCredits: Number.isFinite(report.lowestCredits) ? report.lowestCredits : game.credits,
  };
}

/** One line a career, for the table the script prints. */
export function careerLine(r: CareerReport): string {
  const { faction, verdict, difficulty, seed } = r.options;
  const lost = Object.entries(r.losses).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => `${id} x${n}`).join(', ');
  return [
    `${faction}/${verdict}/${difficulty}/#${seed}`.padEnd(34),
    r.finished ? 'finished' : `STOPPED (${r.stopped})`,
    `contracts ${r.contracts} (won ${r.won})`, `grind ${r.grind}`, `level ${r.level}`, `arena ${r.arenaRank}`, `${r.tier}`,
    `credits ${r.credits} (low ${r.lowestCredits})`, `medals ${r.medals}`, lost ? `lost: ${lost}` : 'lost nothing',
  ].join('  ');
}
