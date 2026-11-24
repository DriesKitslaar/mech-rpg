/**
 * The long game on raised terms, measured. A career is played to the end of its story; from there the
 * open board is flown for sixty contracts three ways: by a pilot who never raises the terms, by one who
 * raises them as far as the counted odds stay at 18 of 20 or better, and by one who goes as far as 12 of
 * 20. What is over goes to the bench as the career's pilot spends it, and to a licence where the bench
 * is at its end.
 * Usage: npx tsx scripts/stakes.ts                       Standard and Veteran, sixty contracts
 *        npx tsx scripts/stakes.ts --difficulty veteran --contracts 20 --seed 2
 *        npx tsx scripts/stakes.ts --top                 the best machine a first telling can build, against every terms
 *
 * What it is, so that nobody reads more into it than there is: in a battle the pilot only ever presses
 * Auto Turn; the odds are the briefing's own count; of the board's three contracts (its job and its
 * swarm are left alone: counting those on every terms takes longer than the rest together) the contract
 * and the terms are picked by what they are expected to bring (what the terms pay by the odds, less the
 * bond by the odds against), among the terms whose odds the pilot's rule allows and whose bond is held.
 */
import type { Mission } from '../src/core/campaign';
import { FORECAST_PLAYS, advance, counted, newCount } from '../src/core/forecast';
import type { Difficulty, GameState } from '../src/core/game';
import { STAKES } from '../src/core/stakes';
import { LICENCE_PRICES, TUNE_MAX, benchCap, buyLicence, checkLicence, checkTune, licencePrice, stepOf, tunable, tune } from '../src/core/tuning';
import { CATALOG } from '../src/content/parts';
import type { InputAction } from '../src/platform/input';
import { SAVE_KEY, SaveFile, type KeyValueStore } from '../src/platform/storage';
import { App } from '../src/ui/app';
import type { SpriteStore } from '../src/ui/sprites';
import { playCareer } from './careerBot';

/** A rule for raising terms: the least the counted odds may be, of twenty; none for a pilot who never raises them. */
export interface Rule { name: string; least: number | null }
export const RULES: Rule[] = [{ name: 'never', least: null }, { name: 'odds 18+', least: 18 }, { name: 'odds 12+', least: 12 }];
/** What the pilot keeps back when spending: enough to post the bond of the top terms on a contract of the late board. */
const RESERVE = 15_000;

export interface Flown { id: string; level: number; odds: number; won: boolean; net: number; credits: number }
export interface LongGame {
  rule: Rule;
  difficulty: Difficulty;
  /** Every contract flown, in order. */
  flown: Flown[];
  /** Contracts won and lost at each of the four terms. */
  won: number[];
  lost: number[];
  /** What the bonds lost came to. */
  bonds: number;
  /** The licences bought: after how many contracts each was. */
  licences: number[];
  /** How far the bench goes at the end, and the steps on the parts the pilot flies. */
  cap: number;
  steps: number;
  start: number;
  credits: number;
}

type Snap = { screen: string; menu: { items: { id: string }[]; cursor: number }; battle?: { phase: string }; settlement?: { won: boolean; net: number } };
const sprites: SpriteStore = { get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }) };
function memoryStore(game: GameState): KeyValueStore {
  const data: Record<string, string> = { [SAVE_KEY]: JSON.stringify(game) };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
}

/** Flies the open board from a game whose story is over, by a rule. */
export function playLongGame(from: GameState, rule: Rule, contracts: number, seed: number): LongGame {
  const game: GameState = { ...from, settings: { ...from.settings } };
  const app = new App({ catalog: CATALOG, save: new SaveFile(memoryStore(game), CATALOG), sprites, fast: true, seed });
  const snap = (): Snap => app.snapshot() as Snap;
  const press = (...actions: InputAction[]): void => actions.forEach((a) => app.onInput(a));
  const select = (id: string): void => {
    for (let i = 0; i < 80 && snap().menu.items[snap().menu.cursor]?.id !== id; i++) press('down');
    if (snap().menu.items[snap().menu.cursor]?.id !== id) throw new Error(`no "${id}" on ${snap().screen}`);
    press('confirm');
  };
  const toHub = (): void => {
    for (let i = 0; i < 80 && snap().screen !== 'hub'; i++) press('confirm');
    if (snap().screen !== 'hub') throw new Error(`still on ${snap().screen}`);
  };
  select('continue');
  toHub();

  const report: LongGame = {
    rule, difficulty: game.settings.difficulty, flown: [], won: [0, 0, 0, 0], lost: [0, 0, 0, 0], bonds: 0, licences: [], cap: 0, steps: 0,
    start: app.game!.credits, credits: 0,
  };

  /** What is over goes to the bench: a step on whichever fitted part is furthest behind; and at the bench's end, to the licence. */
  const spend = (): void => {
    let now: GameState = app.game!;
    for (let guard = 0; guard < 400; guard++) {
      const fitted = [...new Set(Object.values(now.build))].filter((id) => tunable(CATALOG[id]));
      const next = fitted.filter((id) => checkTune(now, id, CATALOG) === null)
        .sort((a, b) => stepOf(now.tuning, a) - stepOf(now.tuning, b) || CATALOG[a].price - CATALOG[b].price)[0];
      if (next !== undefined && now.credits - CATALOG[next].price * (stepOf(now.tuning, next) + 1) >= RESERVE) { now = tune(now, next, CATALOG); continue; }
      // Every part the pilot flies at the bench's end: the licence, once it can be paid with the reserve kept.
      const atEnd = fitted.every((id) => stepOf(now.tuning, id) >= benchCap(now));
      if (atEnd && checkLicence(now) === null && now.credits - licencePrice(now)! >= RESERVE) {
        now = buyLicence(now);
        report.licences.push(report.flown.length);
        continue;
      }
      break;
    }
    if (now !== app.game) { app.commit(now); app.go('hub'); }
  };

  /** The briefing's own count for a contract on given terms: the flights won of twenty. */
  const odds = (mission: Mission, level: number): number => {
    const prospect = app.prospect(mission, null, null, level);
    if (!prospect) return 0;
    let count = newCount();
    for (let i = 0; i < 400_000 && !counted(count); i++) count = advance(count, prospect.fight, prospect.mission, CATALOG, 64);
    return count.tally.won;
  };

  /** The contract and the terms this pilot takes: what is expected to bring most, among what the rule allows. */
  const choose = (): { mission: Mission; level: number; odds: number } => {
    let best: { mission: Mission; level: number; odds: number; worth: number } | null = null;
    for (const mission of app.missions().filter((offered) => /^open-\d+-\d+-\d+$/.test(offered.id))) {
      const terms = app.stakes(mission, null);
      for (const { level, fee, bond, refusal } of terms) {
        if (refusal !== null || (level > 0 && rule.least === null)) break;
        const won = odds(mission, level);
        // Terms the rule does not allow end the climb on this contract: the terms above them are no better.
        if (level > 0 && won < (rule.least ?? FORECAST_PLAYS)) break;
        const p = won / FORECAST_PLAYS;
        const worth = p * (fee + bond) - (1 - p) * bond;
        if (best === null || worth > best.worth) best = { mission, level, odds: won, worth };
      }
    }
    if (best === null) throw new Error('no open contract on the board');
    return best;
  };

  for (let n = 0; n < contracts; n++) {
    spend();
    const { mission, level, odds: counted } = choose();
    app.startMission(mission.id, false, null, false, null, level);
    for (let i = 0; i < 400_000 && snap().screen === 'battle'; i++) {
      const phase = snap().battle!.phase;
      if (phase === 'animating') app.update(16);
      else if (phase === 'action') select('auto');
      else press('confirm');
    }
    const settled = snap().settlement;
    if (snap().screen !== 'settlement' || !settled) throw new Error(`a contract led to ${snap().screen}`);
    (settled.won ? report.won : report.lost)[level] += 1;
    if (!settled.won && level > 0) report.bonds += app.stakes(mission, null)[level].bond;
    toHub();
    report.flown.push({ id: mission.id, level, odds: counted, won: settled.won, net: settled.net, credits: app.game!.credits });
  }
  spend();
  const end = app.game!;
  return {
    ...report, cap: benchCap(end), credits: end.credits,
    steps: Object.values(end.build).reduce((sum, id) => sum + stepOf(end.tuning, id), 0),
  };
}

/**
 * The odds of the board's three contracts on each of the four terms, for a game as it stands, on a number of boards:
 * each board is the one a pilot with that many more contracts won would be offered.
 */
export function oddsOfBoards(from: GameState, boards: number, seed: number): { id: string; fee: number; odds: number[] }[] {
  const rows: { id: string; fee: number; odds: number[] }[] = [];
  for (let board = 0; board < boards; board++) {
    const game: GameState = { ...from, battlesWon: from.battlesWon + board, settings: { ...from.settings } };
    const app = new App({ catalog: CATALOG, save: new SaveFile(memoryStore(game), CATALOG), sprites, fast: true, seed });
    for (let i = 0; i < 80 && (app.snapshot() as Snap).screen !== 'hub'; i++) app.onInput('confirm');
    for (const mission of app.missions().filter((offered) => /^open-\d+-\d+-\d+$/.test(offered.id))) {
      const odds = STAKES.map((_, level) => {
        const prospect = app.prospect(mission, null, null, level);
        if (!prospect) return 0;
        let count = newCount();
        for (let i = 0; i < 400_000 && !counted(count); i++) count = advance(count, prospect.fight, prospect.mission, CATALOG, 64);
        return count.tally.won;
      });
      rows.push({ id: mission.id, fee: mission.reward, odds });
    }
  }
  return rows;
}

/** A game with every licence bought and every part it flies at the bench's last step: the best that machine can be. */
export function atTheTop(game: GameState): GameState {
  const tuning = { ...(game.tuning ?? {}) };
  for (const id of new Set(Object.values(game.build))) if (tunable(CATALOG[id])) tuning[id] = TUNE_MAX;
  return { ...game, bench: LICENCE_PRICES.length, tuning };
}

/** One line a long game, for the table the script prints. */
export function longGameLine(r: LongGame): string {
  const every = Math.max(1, Math.floor(r.flown.length / 6));
  const at = r.flown.filter((_, i) => (i + 1) % every === 0).map((f) => String(f.credits).padStart(7)).join('');
  const by = (counts: number[]): string => counts.map((n) => String(n).padStart(2)).join('/');
  return [
    `${r.difficulty}/${r.rule.name}`.padEnd(20), `won ${by(r.won)}`, `lost ${by(r.lost)}`, `bonds lost ${String(r.bonds).padStart(6)}`,
    `licences ${r.licences.length} (after ${r.licences.join(', ') || '-'})`.padEnd(30), `bench to ${r.cap}, ${String(r.steps).padStart(2)} steps`,
    `credits ${String(r.start).padStart(6)} ->${at}`,
  ].join('  ');
}

function main(): void {
  const arg = (name: string, fallback: string): string => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  const contracts = Number(arg('--contracts', '60'));
  const seed = Number(arg('--seed', '1'));
  const only = arg('--difficulty', '');
  if (process.argv.includes('--top')) {
    // The anti-goal looked at: is the top terms still a bet for the best machine? The career's machine as it ends the
    // story, and the same machine with every licence and every part it flies at the last step, on twelve boards.
    for (const difficulty of (only ? [only] : ['standard', 'veteran']) as Difficulty[]) {
      const career = playCareer({ faction: 'hadron', verdict: 'default', difficulty, seed });
      if (!career.finished) throw new Error(`the career did not finish: ${career.stopped}`);
      for (const [name, game] of [['as the story ends', career.game], ['every licence, every part at +5', atTheTop(career.game)]] as const) {
        const rows = oddsOfBoards(game, Number(arg('--boards', '12')), seed);
        console.log(`${difficulty}, ${name}: the odds of ${rows.length} contracts on each terms (of ${FORECAST_PLAYS})`);
        for (const row of rows) console.log(`  ${row.id.padEnd(16)} fee ${String(row.fee).padStart(5)}   ${row.odds.map((won) => String(won).padStart(3)).join(' ')}`);
        STAKES.forEach((factor, level) => {
          const won = rows.map((row) => row.odds[level]);
          const share = (from: number, to: number): string => String(won.filter((n) => n >= from && n <= to).length).padStart(2);
          console.log(`  x${factor}: 18 or more of 20 on ${share(18, 20)}, 12 to 17 on ${share(12, 17)}, 5 to 11 on ${share(5, 11)}, fewer on ${share(0, 4)}`);
        });
      }
    }
    return;
  }
  console.log(`Terms: ${STAKES.map((factor, level) => `${level} x${factor}`).join(', ')}. Counts are by the terms: Standard/Hazard/Severe/Ruinous. Credits every ${Math.max(1, Math.floor(contracts / 6))} contracts.`);
  for (const difficulty of (only ? [only] : ['standard', 'veteran']) as Difficulty[]) {
    const career = playCareer({ faction: 'hadron', verdict: 'default', difficulty, seed });
    if (!career.finished) throw new Error(`the career did not finish: ${career.stopped}`);
    for (const rule of RULES) console.log(longGameLine(playLongGame(career.game, rule, contracts, seed)));
  }
}
if (process.argv[1]?.endsWith('stakes.ts')) main();
