import type { BattleState, UnitState } from './battle';
import { Dice, ENEMY_COST, MECH_ENEMIES, PAY_PER_BATTLE, POOL, boardTier, budgetFor, faceOf, scaleFor, type BoardText } from './board';
import type { Mission, TalkLine } from './campaign';
import type { GameState } from './game';
import { JOB_NUMBERS, MENDERS, company } from './jobs';
import { countsForClass } from './stripes';
import type { EnemyDef } from './types';

/**
 * An account: a pilot the player wrecked, drove off or lost to, who comes back for them. One at a
 * time. They come back three times, as a notice beside the board that the player takes when they
 * choose, in their own machine. The first time it is that machine as it comes: they do not know
 * the player yet. The second and third time it is rebuilt thicker, and hardened against the one
 * weapon that took most armour off it the meeting before (see `HARDENED` in battle.ts). The third
 * meeting won closes the account, and somebody else's may begin.
 *
 * One weapon, and not every weapon they have ever been hit with: measured, a machine that knew all
 * of a build's weapons was a wall where the machine was a quick one (a Stalker or a Ripper that
 * knew all three was beaten one time in ten), and no trouble at all where it was a heavy one.
 * And a hardening that wears (see `GrudgeNumbers.hardening`): one that did not shut out a pilot
 * who carries one weapon, for whom half of that weapon was half of everything for the whole fight.
 *
 * What they learn they learn in a meeting, where the machine is theirs and what hit it is plain.
 * The contract an account began in teaches them nothing: a machine that broke off untouched had
 * met none of the pilot's weapons, and one that was wrecked is not the machine they come back in.
 *
 * Nothing here is rolled when it is asked for: an account is what the saved game says it is, and
 * its notice is a pure function of that game, the same after a reload and made again with every
 * contract won, on dice of its own. The board, the job and the swarm beside it are what they were.
 */

/** How an account began: they won (or the pilot walked away) with their machine standing, their machine broke off, or the pilot destroyed it. */
export type GrudgeOrigin = 'beat' | 'ran' | 'wrecked';
/** The strongest reason first: where a contract gives two, this is the order they are kept in. */
export const GRUDGE_ORIGINS: GrudgeOrigin[] = ['beat', 'ran', 'wrecked'];

export interface Grudge {
  /** Their callsign. */
  name: string;
  /** The machine they fly now: a mech of the board's pool. */
  kind: string;
  origin: GrudgeOrigin;
  /** The weapon their machine is hardened against, by its id: the one that took most armour off it at the last meeting. Absent until a meeting has taught them one. */
  knows?: string;
  /** Meetings the pilot has won. */
  met: number;
  /** Contracts won since the account began, or since the last meeting. */
  waited: number;
}

/** What the notice's id ends with, where the board's own three end with their place on it; and the key its machine is fielded under. */
export const GRUDGE = 'grudge';
/** An account is this many meetings. */
export const GRUDGE_MEETINGS = 3;
/** Contracts won before each meeting's notice is on offer. */
export const GRUDGE_WAIT = [3, 2, 2] as const;

/** The numbers a meeting is set by, one of each for each of the three. */
export interface GrudgeNumbers {
  /**
   * Armour their machine has beyond what its parts give it, as a share of them (see `EnemyDef.plating`): it is
   * rebuilt thicker each time. Thicker and not stronger, and not much thicker: a machine that hit harder with
   * every meeting, or was plated half as thick again by the third, was where the machine was a Ripper a third
   * meeting lost two times in three by a build it knew one weapon of.
   */
  plating: number[];
  /** What a hit's fee for the machine is multiplied by. */
  pay: number[];
  /** Rounds a good pilot needs. */
  par: number;
  /**
   * How much the hardening takes before it is gone, as a share of the armour the machine's core stands in (see
   * `EnemyDef.hardening`). Enough that a build with two or three weapons, which does about half its work with
   * the one the machine knows, feels it for most of the fight; and little enough that a build with that one
   * weapon and no other is through it well before the fight is done.
   */
  hardening: number;
}
/**
 * Set by measurement (`scripts/grudge.ts`): every class's build for the stage, flown by the game's own pilot
 * against every mech the tier's budget pays for, to these ends. A build none of whose weapons the machine knows
 * wins a meeting about as often as it wins a hit, and is paid about as much for a round of it. A build whose
 * best weapon the machine knows still wins more often than not on Standard, the classes together, and earns
 * about half as much for a round. A pilot with one weapon and no other, of whom the machine knows all there is
 * to know, is at a disadvantage and still wins: with a hardening that did not wear, one with a gun and a shield
 * won a third meeting with a quick machine one time in five. Each meeting is a little harder and pays a quarter
 * more than the last. The figures as they stand are in the plan of the round.
 */
export const GRUDGE_NUMBERS: GrudgeNumbers = { plating: [0, 0.1, 0.15], pay: [1, 1.25, 1.5], par: 7, hardening: 0.33 };
/**
 * No account begins below this tier of the board, which is where its elites begin too. What makes an account
 * worth meeting is having something else to bring, and a pilot newer than that has one build and the money for
 * no other; and in the builds of the first act a named Ripper is a fight lost four times in ten before it has
 * learned anything.
 */
export const GRUDGE_TIER = 3;

/** The machines an account can be about: the mechs the board fields. */
const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
const isMech = (kind: string | undefined): kind is string => kind !== undefined && MECHS.includes(kind);

/** A machine a finished battle saw, and what became of it. */
export interface Witness { kind: string; origin: GrudgeOrigin }

/** The dearest of these, the first of them where two cost the same. */
function dearest(units: UnitState[]): UnitState | undefined {
  return units.reduce<UnitState | undefined>((best, unit) => (!best || ENEMY_COST[unit.kind!] > ENEMY_COST[best.kind!] ? unit : best), undefined);
}

/**
 * Who an account could begin with, of a battle that is over: a mech of the board's pool that was
 * standing when the pilot fell or walked away; failing that one that broke off under its own power
 * (a machine that shut down where it stood went nowhere); failing that one the pilot destroyed.
 */
export function witness(state: BattleState): Witness | null {
  const mechs = state.units.filter((unit) => unit.side === 'enemy' && isMech(unit.kind));
  const seen = (unit: UnitState | undefined, origin: GrudgeOrigin): Witness | null => (unit ? { kind: unit.kind!, origin } : null);
  const said = (type: 'rout' | 'unitDestroyed'): Set<string> =>
    new Set(state.events.flatMap((event) => (event.type === type && !(event.type === 'rout' && event.fixed) ? [event.unit] : [])));
  const left = said('rout');
  const fell = said('unitDestroyed');
  return (state.outcome === 'defeat' ? seen(dearest(mechs.filter((unit) => !unit.destroyed)), 'beat') : null)
    ?? seen(dearest(mechs.filter((unit) => left.has(unit.id))), 'ran')
    ?? seen(dearest(mechs.filter((unit) => fell.has(unit.id))), 'wrecked');
}

/** Of what two battles saw, the one an account would begin with: the stronger reason, then the dearer machine, then the first. */
export function stronger(a: Witness | null, b: Witness | null): Witness | null {
  if (!a || !b) return a ?? b;
  const rank = (w: Witness): number => GRUDGE_ORIGINS.indexOf(w.origin);
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? a : b;
  return ENEMY_COST[b.kind] > ENEMY_COST[a.kind] ? b : a;
}

/**
 * The armour the pilot's weapons took off the other side in a battle (off one machine of it, where one is named),
 * by the weapon's id. What a hit took off, and not what it was worth: a great shot into a part with little left
 * did little.
 */
export function dealtBy(state: BattleState, target?: string): Record<string, number> {
  const { build } = state.units[0];
  const dealt: Record<string, number> = {};
  for (const event of state.events) {
    if (event.type !== 'shot' || event.unit !== 'player' || !event.hit || (target !== undefined && event.target !== target)) continue;
    const id = build[event.weapon];
    if (id) dealt[id] = (dealt[id] ?? 0) + (event.took ?? event.damage);
  }
  return dealt;
}

/** What two battles' weapons did, together. */
export function addDealt(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const sum = { ...a };
  for (const [id, amount] of Object.entries(b)) sum[id] = (sum[id] ?? 0) + amount;
  return sum;
}

/** The weapon that did most: the first of them where two did the same. None where nothing did anything. */
function most(dealt: Record<string, number>): string | undefined {
  // (A sort leaves what did alike in the order it was in.)
  return Object.entries(dealt).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
}

type Kept = Pick<GameState, 'grudge' | 'accounts' | 'battlesWon' | 'cycle'>;

/** The account that is open, or null: where there is none, and where what is kept is about a machine no account is about. */
export function grudgeOf(game: Pick<GameState, 'grudge'>): Grudge | null {
  const g = game.grudge;
  if (!g || !isMech(g.kind) || !GRUDGE_ORIGINS.includes(g.origin)) return null;
  if (!Number.isInteger(g.met) || g.met < 0 || g.met >= GRUDGE_MEETINGS || !Number.isInteger(g.waited) || g.waited < 0) return null;
  if (g.knows !== undefined && typeof g.knows !== 'string') return null;
  return g;
}

/**
 * The callsign of an account that has just begun: one that is open in the game as it is now and was not in the
 * game as it was. Null where there was no game before: one that is loaded with an account began nothing.
 */
export function accountBegun(before: Pick<GameState, 'grudge'> | null | undefined, after: Pick<GameState, 'grudge'>): string | null {
  if (!before) return null;
  const [was, is] = [grudgeOf(before), grudgeOf(after)];
  return is && (!was || was.name !== is.name) ? is.name : null;
}

/** An account as its page lists it: one that is closed is a callsign; the one that is open says the rest. */
export type LedgerEntry =
  | { name: string; open: false }
  | {
    name: string; open: true; kind: string; origin: GrudgeOrigin; met: number; knows?: string;
    /** Contracts still to be won before its notice is out: none once it is. */
    wait: number;
  };

/**
 * The accounts there are to read about: the one that is open, then the closed ones in the order they were
 * closed, each callsign once. A callsign that has come round again and is open is that, and is not listed as
 * closed beside it. Nobody is listed with whom no account has begun.
 */
export function ledger(game: Pick<GameState, 'grudge' | 'accounts'>): LedgerEntry[] {
  const open = grudgeOf(game);
  const closed = Array.isArray(game.accounts) ? [...new Set(game.accounts)].filter((name) => name !== open?.name) : [];
  return [
    ...(open ? [{
      name: open.name, open: true as const, kind: open.kind, origin: open.origin, met: open.met,
      ...(open.knows === undefined ? {} : { knows: open.knows }), wait: Math.max(0, GRUDGE_WAIT[open.met] - open.waited),
    }] : []),
    ...closed.map((name) => ({ name, open: false as const })),
  ];
}

/** How many accounts the pilot has closed. */
export const accountsClosed = (game: Pick<GameState, 'accounts'>): number => (Array.isArray(game.accounts) ? game.accounts.length : 0);

/** How many meetings with the pilot of an account the pilot has won, over every account there has been. */
export const meetingsWon = (game: Pick<GameState, 'grudge' | 'accounts'>): number => accountsClosed(game) * GRUDGE_MEETINGS + (grudgeOf(game)?.met ?? 0);

/** True of the notice of an account. It is an open contract like the board's own. */
export const isGrudge = (mission: Pick<Mission, 'id'>): boolean => mission.id.startsWith('open-') && mission.id.endsWith(`-${GRUDGE}`);

/** Whether the notice is on offer: enough contracts have been won since the account began or since the last meeting. */
export function grudgeDue(game: Pick<GameState, 'grudge'>): boolean {
  const g = grudgeOf(game);
  return !!g && g.waited >= GRUDGE_WAIT[g.met];
}

/** The words an account is written with, beside the board's own. */
export interface GrudgeText {
  grudge: {
    /** The callsigns there are. None is a name the game uses for anybody else. */
    names: string[];
    /** The face of a callsign that has one, as the sprite of its portrait: beside what its pilot says. */
    faces?: Record<string, string>;
    /** What the notice is called. */
    title: (name: string) => string;
    /** Where it is to be: a line for each of the board's backgrounds, in their order. They chose it, and there is no client. */
    places: string[];
    /** Who this is, at the first meeting, by how the account began; `machine` is what they fly now. */
    first: Record<GrudgeOrigin, (name: string, machine: string) => string>;
    /** Which meeting this is, at the second and at the third. */
    again: [(name: string, machine: string) => string, (name: string, machine: string) => string];
    /** What their machine is hardened against: the weapon by its name, or null where it knows none. */
    hardened: (weapon: string | null) => string;
    /** What they say as the fight opens: the first time by how it began, then by the meeting. */
    opens: { first: Record<GrudgeOrigin, string>; again: [string, string] };
    /** What they say as their machine falls, by the meeting. */
    falls: [string, string, string];
    /** Dispatch, when the player's core is below half: of a machine that knows no weapon, and of one that does. */
    hurt: [string, string];
    /** Shown with the bill, by the meeting. */
    debrief: [(name: string) => string, (name: string) => string, (name: string) => string];
  };
}

/** Who briefs a notice, and speaks when the pilot is hurt. */
const DISPATCH = 'Dispatch';

/** The face of a callsign, where it has one: to be put beside what its pilot says, or on their page. */
export const grudgeFace = (text: GrudgeText, name: string): { portrait?: string } => {
  const faces = text.grudge.faces;
  return faces && Object.hasOwn(faces, name) ? { portrait: faces[name] } : {};
};

/**
 * The notice of the account that is open, once it is due: one battle about their machine, with the
 * company the board's budget for the tier leaves after it (nothing that mends, as with a hit; none
 * at all where nothing is left, and then they came alone). Null where there is no account or it is
 * not due. `called` gives a machine's and a weapon's name as the player reads them.
 */
export function grudgeContract(
  game: Kept, text: BoardText & GrudgeText, called: { machine: (kind: string) => string; weapon: (id: string) => string }, numbers: GrudgeNumbers = GRUDGE_NUMBERS,
): Mission | null {
  const g = grudgeOf(game);
  if (!g || !grudgeDue(game)) return null;
  const words = text.grudge;
  const tier = boardTier(game.battlesWon, game.cycle);
  const dice = new Dice(((game.battlesWon + 1) * 67867979 + game.cycle * 49979693 + g.met * 7919 + 53) | 0);
  const place = dice.roll(text.backgrounds.length);
  const machine = called.machine(g.kind);
  const face = faceOf(text, DISPATCH);
  const theirs = grudgeFace(text, g.name);
  const talk: TalkLine[] = [
    { at: 'start', who: g.name, text: g.met === 0 ? words.opens.first[g.origin] : words.opens.again[g.met - 1], ...theirs },
    { at: 'hurt', who: DISPATCH, text: words.hurt[g.knows === undefined ? 0 : 1], ...face },
    { at: 'win', who: g.name, text: words.falls[g.met], ...theirs },
  ];
  return {
    id: `open-${game.cycle}-${game.battlesWon}-${GRUDGE}`, phase: 'patrol', title: words.title(g.name), client: DISPATCH, ...face,
    briefing: [
      words.places[place],
      g.met === 0 ? words.first[g.origin](g.name, machine) : words.again[g.met - 1](g.name, machine),
      words.hardened(g.knows === undefined ? null : called.weapon(g.knows)),
    ],
    debrief: words.debrief[g.met](g.name),
    reward: Math.round(((JOB_NUMBERS.hitPay * ENEMY_COST[g.kind] + PAY_PER_BATTLE) * numbers.pay[g.met]) / 50) * 50,
    scale: scaleFor(tier),
    grudge: g.met + 1,
    // Their machine goes by their callsign wherever the contract's machines are named.
    names: { [GRUDGE]: g.name },
    battles: [{
      enemies: [GRUDGE, ...company(dice, budgetFor(tier) - ENEMY_COST[g.kind], MENDERS)],
      objective: { type: 'leader', target: 0 }, par: numbers.par, background: text.backgrounds[place], talk,
    }],
  };
}

/**
 * Their machine as a battle fields it, under the key `GRUDGE`: the kind's own, by their callsign, plated as the
 * meeting has it and hardened against the weapon they know, with a hardening that wears.
 */
export function grudgeEnemy(game: Pick<GameState, 'grudge'>, enemies: Record<string, EnemyDef>, numbers: GrudgeNumbers = GRUDGE_NUMBERS): EnemyDef | null {
  const g = grudgeOf(game);
  if (!g || !Object.hasOwn(enemies, g.kind)) return null;
  const def = enemies[g.kind];
  const plating = (def.plating ?? 0) + numbers.plating[g.met];
  return { ...def, name: g.name, ...(plating > 0 ? { plating } : {}), ...(g.knows === undefined ? {} : { hardened: [g.knows], hardening: numbers.hardening }) };
}

/** What the bill of a meeting won says: whose account, which of its meetings, and whether that closed it. Null of anything else. */
export function accountLine(game: Pick<GameState, 'grudge'>, mission: Pick<Mission, 'id'>): { name: string; meeting: number; closed: boolean } | null {
  const g = grudgeOf(game);
  return g && isGrudge(mission) ? { name: g.name, meeting: g.met + 1, closed: g.met + 1 >= GRUDGE_MEETINGS } : null;
}

/** What a contract's battles came to, as far as an account goes. */
export interface Fought {
  /** Who an account could begin with. */
  seen: Witness | null;
  /** The armour the pilot's weapons took off the named machine of a meeting, by weapon: all its pilot learns from. */
  named: Record<string, number>;
}

/** A contract none of whose battles has been fought yet. */
export const NOTHING_FOUGHT: Fought = { seen: null, named: {} };

/**
 * What a battle that has ended adds to what its contract's battles came to. `meeting` says the battle is a notice's,
 * whose named machine stands first: what the pilot's weapons took off that machine is kept. Of any other battle
 * only who was seen is.
 */
export function foughtIn(fought: Fought, state: BattleState, meeting: boolean): Fought {
  return {
    seen: stronger(fought.seen, witness(state)),
    named: meeting ? addDealt(fought.named, dealtBy(state, 'enemy-0')) : fought.named,
  };
}

/** The game without an account. */
function without<T extends Kept>(game: T): T {
  const { grudge: _, ...rest } = game;
  return rest as T;
}

/**
 * Books a contract as far as an account goes. A meeting won is one more met, and what took most off
 * their machine in it is what they know from now on (what they knew, where the pilot's weapons took
 * nothing off it); the third closes the account. Any other contract won is one waited through. And
 * where no account is open, one may begin with whoever the contract's battles saw, won or lost,
 * knowing nothing yet, as long as it was a contract that counts (not the simulator, the range, the
 * Gauntlet or a fight in a lent mech) and the board has grown to `GRUDGE_TIER`.
 */
export function bookGrudge<T extends Kept>(game: T, mission: Pick<Mission, 'id' | 'loaner'>, won: boolean, fought: Fought, names: string[]): T {
  const open = grudgeOf(game);
  if (open) {
    if (!won) return game;
    if (!isGrudge(mission)) return { ...game, grudge: { ...open, waited: open.waited + 1 } };
    const met = open.met + 1;
    if (met >= GRUDGE_MEETINGS) return { ...without(game), accounts: [...(Array.isArray(game.accounts) ? game.accounts : []), open.name] };
    const learnt = most(fought.named);
    return { ...game, grudge: { ...open, met, waited: 0, ...(learnt ? { knows: learnt } : {}) } };
  }
  if (!fought.seen || !isMech(fought.seen.kind) || !countsForClass(mission) || boardTier(game.battlesWon, game.cycle) < GRUDGE_TIER) return game;
  const closed = Array.isArray(game.accounts) ? game.accounts : [];
  const fresh = names.filter((name) => !closed.includes(name));
  const dice = new Dice(((game.battlesWon + 1) * 22801763 + game.cycle * 32452867 + closed.length * 613 + 5) | 0);
  return { ...game, grudge: { name: dice.pick(fresh.length > 0 ? fresh : names), kind: fought.seen.kind, origin: fought.seen.origin, met: 0, waited: 0 } };
}
