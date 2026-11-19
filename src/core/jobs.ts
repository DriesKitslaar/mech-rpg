import type { EnemyMark } from './battle';
import {
  Dice, ENEMY_COST, MECH_ENEMIES, PAY_PER_BATTLE, PAY_PER_POINT, POOL, SUPPORT_ENEMIES, SWARM_KINDS, boardTier, budgetFor, faceOf, rollEnemies, scaleFor,
  type BoardText,
} from './board';
import type { Battle, Mission } from './campaign';
import type { GameState } from './game';

/**
 * Work that asks for something else. Beside the board's three contracts and the swarm stands one
 * more open contract, and where those ask for everything on the field destroyed, this one asks for
 * one of four other things:
 *
 * - a hit: one machine is named and paid for, and the job is over when it falls;
 * - a repossession: one machine is wanted back in one piece, its arms and legs gone and its core whole;
 * - an escort: the client's freight is worn down every round by whatever still stands;
 * - a holding action: more than the fee could ask anyone to beat, to be outlasted.
 *
 * Each is made from what a battle's rules already have: an objective, an elite's mark, a reserve,
 * a scale. What differs from one to the next is which build is the one to bring.
 */
export type JobKind = 'hit' | 'repo' | 'escort' | 'hold';
/** The kinds, in the order they turn in. */
export const JOB_KINDS: JobKind[] = ['hit', 'repo', 'escort', 'hold'];
/** What the id of the job on offer ends with, where the board's own three end with their place on it. */
export const JOB = 'job';
/**
 * The mark a hit's machine carries: it has been worked on to hit harder. Of the marks an elite can carry this is
 * the one that makes a hit what it should be, a machine to bring down before it does the same: the others (thicker,
 * harder to hit, behind a barrier) made it a slow job, seventeen rounds for a slow frame late on, where the board's
 * whole contract took thirteen.
 */
export const HIT_MARK: EnemyMark = 'overclocked';
/** From this tier of the board on there is a job: below it a budget buys too little for any of them to be one. */
export const JOB_TIER = 1;

/** True of the job that is on offer beside the board. It is an open contract like the board's own. */
export const isJob = (mission: Pick<Mission, 'id'>): boolean => mission.id.startsWith('open-') && mission.id.endsWith(`-${JOB}`);

/**
 * Which kind is on offer. They turn in order, one step for every contract won (what the board counts
 * as `battlesWon` goes up by one with every bill that says won), so that four contracts won have shown
 * all four; a later telling of the story begins one step on.
 */
export const jobKind = (battlesWon: number, cycle: number): JobKind => JOB_KINDS[(battlesWon + cycle) % JOB_KINDS.length];

/** The words jobs are written with, beside the board's own. */
export interface JobText {
  jobs: Record<JobKind, {
    /** What a job of this kind can be called: each begins with the kind. */
    titles: string[];
    /** The line of its briefing that says what the kind asks. */
    brief: string;
  }>;
  /** What an escort keeps alive, one for each background, same order. */
  assets: string[];
}

/**
 * The numbers the kinds are set by. They were set by measurement (`scripts/jobs.ts`): every class's
 * build for the stage, flown by the game's own pilot on both difficulties, to these ends: no class
 * under one win in three on Standard at the stage it meets a job, no kind on which every class wins
 * nine in ten on Veteran, and pay for a round of fighting, over the classes and the stages together,
 * near what the board's own contracts pay.
 *
 * As they stand (Standard, forty flights a cell, tiers 1 to 8): a hit is won 83 to 100 times in a hundred,
 * quickest by what hits hardest at once (a duellist in two to four rounds, a bastion in four to twelve); a
 * repossession 80 to 100, by everything, slowly; an escort 57 to 100, by a duellist nearly always and by a
 * bastion as little as six times in ten; a holding action 57 to 100, the other way about: a bastion and
 * artillery always, a duellist and a skirmisher least. On Veteran the lowest of each are 75, 73, 33 and 48.
 * A round of each nets between four fifths and all of what a round of the board's own nets.
 */
export interface JobNumbers {
  /** A hit multiplies the board's scale by this: the named machine and its company are a harder lot than the board's. */
  hitScale: number;
  /** What a hit pays for each point its named machine costs: the machine is paid for and nothing else is. */
  hitPay: number;
  /** Rounds a good pilot needs for a hit: one machine to bring down, with others shooting. */
  hitPar: number;
  /** What a repossession pays on top, as a share of the fee the board would pay for the same machines. */
  repoPay: number;
  /**
   * What the freight can take: this much for each point the machines on the field cost, rounded up, and this much
   * besides. It goes by what they cost and not by how many they are: one heavy machine wears it down slowly for
   * a long time, three light ones quickly for a short one, and it comes to much the same.
   */
  escortPoint: number;
  escortFlat: number;
  /** What an escort pays on top, as a share of the board's fee for the same machines. */
  escortPay: number;
  /** A holding action is outlasted in this many rounds. */
  holdRounds: number;
  /** It is rolled on the board's budget and this much more, with this many light machines behind it. */
  holdBudget: number;
  holdReserve: number;
  /** It multiplies the board's scale by this. */
  holdScale: number;
  /**
   * What a holding action pays on top, as a share of the board's fee for a battle on the board's own budget: the
   * machines are not paid for, since nobody asks for them destroyed. The rounds are.
   */
  holdPay: number;
}

export const JOB_NUMBERS: JobNumbers = {
  hitScale: 1.1, hitPay: 500, hitPar: 6,
  repoPay: 0.35,
  escortPoint: 1.5, escortFlat: 2, escortPay: 0.4,
  holdRounds: 6, holdBudget: 2, holdReserve: 4, holdScale: 1.5, holdPay: 0.25,
};

/** The machines of the board that put armour back on the others. */
export const MENDERS = ['repair-drone'];

const costOf = (ids: string[]): number => ids.reduce((sum, id) => sum + ENEMY_COST[id], 0);
/** Where the dearest machine stands, the first of them when two cost the same. */
const dearest = (ids: string[]): number => ids.reduce((at, id, i) => (ENEMY_COST[id] > ENEMY_COST[ids[at]] ? i : at), 0);
/** What the board pays for a battle against these. */
const boardFee = (ids: string[]): number => PAY_PER_POINT * costOf(ids) + PAY_PER_BATTLE;
/** A fee is a round sum: to the nearest fifty. */
const rounded = (fee: number): number => Math.round(fee / 50) * 50;

/** The machines of the board that can be taken in one piece: they have arms or legs to lose. */
const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
/** The machines that stand with one: anything of the board's that is not a mech, at most one of them a helper. */
function company(dice: Dice, budget: number): string[] {
  const picked: string[] = [];
  let left = budget;
  while (picked.length < 2 && left > 0) {
    const helped = picked.some((id) => SUPPORT_ENEMIES.includes(id));
    const affordable = POOL.filter((id) => !MECH_ENEMIES.includes(id) && ENEMY_COST[id] <= left && !(helped && SUPPORT_ENEMIES.includes(id)));
    if (affordable.length === 0) break;
    const id = dice.pick(affordable);
    picked.push(id);
    left -= ENEMY_COST[id];
  }
  return picked;
}

/** What each kind puts on the field and asks of it, and what it pays. */
function make(kind: JobKind, dice: Dice, tier: number, place: number, text: BoardText & JobText, n: JobNumbers): Pick<Mission, 'reward' | 'scale' | 'briefing' | 'elite'> & { battle: Omit<Battle, 'background'> } {
  const budget = budgetFor(tier);
  const scale = scaleFor(tier);
  switch (kind) {
    case 'hit': {
      // The board's roll, less anything that mends: a drone that put back what the pilot took off the named machine
      // made a hit that some builds could not finish at all, fifty rounds and lost to the clock. And never one machine
      // on its own, which is a contract and not a hit: a drone flies with it.
      let enemies = rollEnemies(dice, budget).filter((id) => !MENDERS.includes(id));
      if (enemies.length < 2) enemies = [...enemies, 'recon-drone'];
      // The machine that is named is the dearest that fights: nobody takes out a contract on a mast or a drone that mends.
      const fighters = enemies.map((_, i) => i).filter((i) => !SUPPORT_ENEMIES.includes(enemies[i]));
      const target = fighters.reduce((at, i) => (ENEMY_COST[enemies[i]] > ENEMY_COST[enemies[at]] ? i : at));
      return {
        battle: { enemies, objective: { type: 'leader', target }, marks: { [target]: HIT_MARK }, par: n.hitPar },
        reward: rounded(n.hitPay * ENEMY_COST[enemies[target]] + PAY_PER_BATTLE), scale: scale * n.hitScale, elite: HIT_MARK,
        briefing: [text.places[place], text.jobs.hit.brief],
      };
    }
    case 'repo': {
      const affordable = MECHS.filter((id) => ENEMY_COST[id] <= budget);
      const mech = dice.pick(affordable);
      const enemies = [mech, ...company(dice, budget - ENEMY_COST[mech])];
      return {
        battle: { enemies, objective: { type: 'disable', target: 0 } },
        reward: rounded(boardFee(enemies) * (1 + n.repoPay)), scale,
        briefing: [text.places[place], text.jobs.repo.brief, text.threats[mech]],
      };
    }
    case 'escort': {
      const enemies = rollEnemies(dice, budget);
      return {
        battle: { enemies, objective: { type: 'protect', name: text.assets[place], hp: Math.ceil(n.escortPoint * costOf(enemies)) + n.escortFlat } },
        reward: rounded(boardFee(enemies) * (1 + n.escortPay)), scale,
        briefing: [text.places[place], text.jobs.escort.brief, text.threats[enemies[dearest(enemies)]]],
      };
    }
    case 'hold': {
      const enemies = rollEnemies(dice, budget + n.holdBudget);
      const light = [...SWARM_KINDS].reverse().find((entry) => tier >= entry.from)!.kinds;
      const reserve = Array.from({ length: n.holdReserve }, () => dice.pick(light));
      return {
        battle: { enemies, reserve, objective: { type: 'survive', rounds: n.holdRounds } },
        reward: rounded((PAY_PER_POINT * budget + PAY_PER_BATTLE) * (1 + n.holdPay)), scale: scale * n.holdScale,
        briefing: [text.places[place], text.jobs.hold.brief, text.threats[enemies[dearest(enemies)]]],
      };
    }
  }
}

/**
 * A job of a kind as the board's tier makes it, on dice begun at a seed: where it is, what it is
 * called, who asks, and its one battle. Everything about a job but its id, which says whose progress it is.
 */
export function makeJob(kind: JobKind, tier: number, seed: number, text: BoardText & JobText, numbers: JobNumbers = JOB_NUMBERS): Omit<Mission, 'id'> {
  const dice = new Dice(seed | 0);
  const place = dice.roll(text.backgrounds.length);
  const title = dice.pick(text.jobs[kind].titles);
  const client = dice.pick(text.clients);
  const { battle, ...made } = make(kind, dice, tier, place, text, numbers);
  return {
    phase: 'patrol', title, client, ...faceOf(text, client), debrief: dice.pick(text.debriefs), job: kind, ...made,
    battles: [{ ...battle, background: text.backgrounds[place] }],
  };
}

/**
 * The job on offer beside the board: one battle that asks for something other than everything
 * destroyed. Like the board it is a pure function of the pilot's progress, on dice of its own: the
 * same job after a reload, a new one after every contract won, and the board and the swarm beside it
 * exactly what they always were. There is none below the board's first tier.
 */
export function jobContract(battlesWon: number, cycle: number, text: BoardText & JobText, numbers: JobNumbers = JOB_NUMBERS): Mission | null {
  const tier = boardTier(battlesWon, cycle);
  if (tier < JOB_TIER) return null;
  const seed = (battlesWon + 1) * 86028121 + cycle * 49979693 + 41;
  return { id: `open-${cycle}-${battlesWon}-${JOB}`, ...makeJob(jobKind(battlesWon, cycle), tier, seed, text, numbers) };
}

type Kept = Pick<GameState, 'jobs'>;

/** How many jobs the pilot has won: of one kind, or of every kind together. */
export function jobsWon(game: Kept, kind?: JobKind): number {
  const of = (k: JobKind): number => {
    const count = game.jobs && Object.hasOwn(game.jobs, k) ? game.jobs[k] : 0;
    return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? count : 0;
  };
  return kind ? of(kind) : JOB_KINDS.reduce((sum, k) => sum + of(k), 0);
}

/** How many of the kinds the pilot has won a job of. */
export const kindsOfJob = (game: Kept): number => JOB_KINDS.filter((kind) => jobsWon(game, kind) > 0).length;

/** Writes a won job down against its kind. */
export function recordJob<T extends Kept>(game: T, kind: JobKind): T {
  return { ...game, jobs: { ...(game.jobs ?? {}), [kind]: jobsWon(game, kind) + 1 } };
}
