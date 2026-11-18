import { MARKS, type EnemyMark } from './battle';
import type { Mission } from './campaign';
import { nextRandom } from './rng';

/** What each enemy costs out of a battle's budget. */
export const ENEMY_COST: Record<string, number> = {
  'recon-drone': 1, 'gun-turret': 2, tank: 2, gunship: 2, 'lance-tower': 3, 'light-mech': 3, stalker: 4, 'heavy-mech': 4,
  rival: 5, juggernaut: 6,
  'shield-drone': 2, 'repair-drone': 2, jammer: 2, 'bomb-crawler': 2, carrier: 4, marksman: 4, ripper: 4, bulldozer: 5,
  'lien-drone': 2, bailiff: 6,
  'mortar-nest': 3, 'hunter-drone': 2, 'flak-walker': 3, breacher: 4, 'arc-pylon': 3, longshot: 3, 'scrap-king': 9, 'night-train': 9,
  magpie: 5, dredge: 6, lark: 6, hollow: 6, paragon: 7, notary: 9,
  sable: 7, rook: 7, krell: 8, 'rival-2': 7, assessor: 9, 'strip-miner': 9, overseer: 9, leviathan: 9, 'ashfall-unbound': 10, adjuster: 12, proxy: 12,
};
/** At most one of these per battle. */
export const MECH_ENEMIES = [
  'light-mech', 'stalker', 'heavy-mech', 'rival', 'juggernaut', 'marksman', 'ripper', 'bulldozer', 'bailiff',
  'sable', 'rook', 'krell', 'rival-2', 'assessor', 'ashfall-unbound',
  'magpie', 'dredge', 'lark', 'hollow', 'paragon', 'notary',
];
/** Enemies that belong to the story: the named pilots, the great machines, and everything of Meridian's. */
export const STORY_ENEMIES = [
  'rival', 'rival-2', 'ashfall-unbound', 'sable', 'rook', 'krell', 'strip-miner', 'overseer', 'leviathan',
  'lien-drone', 'bailiff', 'assessor', 'adjuster', 'proxy',
  'scrap-king', 'night-train',
  // The wanted are met on their own notices.
  'magpie', 'dredge', 'lark', 'hollow', 'paragon', 'notary',
];
/**
 * Enemies that are no fight on their own: they cover, mend or jam for the others, or simply blow
 * up. An open contract fields at most one in a battle, and never as the first enemy picked.
 */
export const SUPPORT_ENEMIES = ['shield-drone', 'repair-drone', 'jammer', 'bomb-crawler'];
/** Machines that stand where they were put: nothing makes them any harder to hit. */
export const ROOTED = ['gun-turret', 'lance-tower', 'mortar-nest', 'arc-pylon', 'jammer'];
/** Machines that do no harm of their own, with neither a weapon nor a charge: nothing makes them hit harder. */
export const HARMLESS = ['jammer'];
/** The marks that change something about a machine. An elite is never given one that would do nothing. */
export const marksFor = (id: string): EnemyMark[] =>
  MARKS.filter((mark) => !(mark === 'swift' && ROOTED.includes(id)) && !(mark === 'overclocked' && HARMLESS.includes(id)));
/** Enemies that open contracts may field. */
const POOL = Object.keys(ENEMY_COST).filter((id) => !STORY_ENEMIES.includes(id));

export const MAX_TIER = 8;
export const MAX_BUDGET = 8;
export const BOARD_SIZE = 3;
export const WINS_PER_TIER = 5;
export const PAY_PER_POINT = 250;
export const PAY_PER_BATTLE = 200;
/**
 * From this tier on, the heaviest contract on the board is, about one board in two, an elite one: the
 * dearest machine of its last battle carries a mark, the briefing says which, and the contract pays this much more.
 */
export const ELITE_TIER = 3;
export const ELITE_PAY = 400;

/** The words open contracts are written with. */
export interface BoardText {
  adjectives: string[];
  nouns: string[];
  clients: string[];
  backgrounds: string[];
  /** One opening line per background, same order. */
  places: string[];
  /** Keyed by enemy id: a line about the strongest enemy in the contract. */
  threats: Record<string, string>;
  debriefs: string[];
  battles: (count: number) => string;
  /** Keyed by mark: a line saying that an elite is there and what sets it apart. */
  elite: Record<EnemyMark, string>;
}

/** How far the board has grown: one tier per five battles won, two per cycle. */
export function boardTier(battlesWon: number, cycle: number): number {
  return Math.min(MAX_TIER, Math.floor(battlesWon / WINS_PER_TIER) + 2 * cycle);
}

/** The three contracts differ in weight: the first sits two tiers below the board's, the last at it. */
export function contractTier(battlesWon: number, cycle: number, index: number): number {
  return Math.max(0, boardTier(battlesWon, cycle) - (BOARD_SIZE - 1 - index));
}

export const budgetFor = (tier: number): number => Math.min(MAX_BUDGET, 2 + tier);
export const scaleFor = (tier: number): number => 1 + 0.04 * Math.max(0, tier - 4);

export class Dice {
  constructor(private state: number) {}
  /** An integer from 0 up to, not including, `n`. */
  roll(n: number): number {
    const next = nextRandom(this.state);
    this.state = next.state;
    return Math.floor(next.value * n);
  }
  pick<T>(items: T[]): T {
    return items[this.roll(items.length)];
  }
}

/** Spends as much of the budget as it can on at most three enemies, one mech at most. */
export function rollEnemies(dice: Dice, budget: number): string[] {
  const enemies: string[] = [];
  let left = budget;
  for (let slotsLeft = 3; slotsLeft > 0 && left > 0; slotsLeft--) {
    const hasMech = enemies.some((id) => MECH_ENEMIES.includes(id));
    const noSupport = enemies.length === 0 || enemies.some((id) => SUPPORT_ENEMIES.includes(id));
    const affordable = POOL.filter((id) =>
      ENEMY_COST[id] <= left && !(hasMech && MECH_ENEMIES.includes(id)) && !(noSupport && SUPPORT_ENEMIES.includes(id)));
    if (affordable.length === 0) break;
    // Prefer enemies big enough that the remaining slots can use the budget up.
    const share = Math.ceil(left / slotsLeft);
    const fitting = affordable.filter((id) => ENEMY_COST[id] >= share);
    const id = dice.pick(fitting.length > 0 ? fitting : affordable);
    enemies.push(id);
    left -= ENEMY_COST[id];
  }
  return enemies;
}

/**
 * The open contracts on offer, lightest first. A pure function of the pilot's progress: the same
 * board after a reload, a new one after every battle won.
 */
export function generateBoard(battlesWon: number, cycle: number, text: BoardText): Mission[] {
  const dice = new Dice(((battlesWon + 1) * 7919 + cycle * 104729) | 0);
  const usedTitles = new Set<string>();
  const board: Mission[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const tier = contractTier(battlesWon, cycle, i);
    const budget = budgetFor(tier);
    // The first is a single fight; the others run longer and pay more.
    const battleCount = 1 + (i === 0 ? 0 : dice.roll(i + 1));
    const place = dice.roll(text.backgrounds.length);
    const battles = Array.from({ length: battleCount }, () => ({
      enemies: rollEnemies(dice, budget), background: text.backgrounds[place],
    }));
    const spent = battles.reduce((sum, b) => sum + b.enemies.reduce((s, id) => s + ENEMY_COST[id], 0), 0);
    const strongest = battles.flatMap((b) => b.enemies).reduce((a, b) => (ENEMY_COST[b] > ENEMY_COST[a] ? b : a));
    let title = `${dice.pick(text.adjectives)} ${dice.pick(text.nouns)}`;
    while (usedTitles.has(title)) title = `${dice.pick(text.adjectives)} ${dice.pick(text.nouns)}`;
    usedTitles.add(title);
    board.push({
      id: `open-${cycle}-${battlesWon}-${i}`, phase: 'patrol', title, client: dice.pick(text.clients),
      briefing: [text.places[place], text.threats[strongest], text.battles(battleCount)],
      debrief: dice.pick(text.debriefs),
      reward: PAY_PER_POINT * spent + PAY_PER_BATTLE * battleCount,
      battles, scale: scaleFor(tier),
    });
  }
  // Whether the heaviest contract is an elite one is decided on dice of its own, so that every board
  // is otherwise exactly the board it always was.
  const fate = new Dice(((battlesWon + 1) * 104729 + cycle * 7919 + 13) | 0);
  const heaviest = board[BOARD_SIZE - 1];
  if (contractTier(battlesWon, cycle, BOARD_SIZE - 1) >= ELITE_TIER && fate.roll(2) === 0) {
    const battle = heaviest.battles[heaviest.battles.length - 1];
    // The mark goes to the dearest machine of the last battle, the first of them when two cost the same.
    let at = 0;
    battle.enemies.forEach((id, i) => { if (ENEMY_COST[id] > ENEMY_COST[battle.enemies[at]]) at = i; });
    const mark = fate.pick(marksFor(battle.enemies[at]));
    battle.marks = { [at]: mark };
    heaviest.elite = mark;
    heaviest.reward += ELITE_PAY;
    heaviest.briefing = [...heaviest.briefing, text.elite[mark]];
  }
  return board;
}
