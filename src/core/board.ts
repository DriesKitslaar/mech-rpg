import type { Mission } from './campaign';
import { nextRandom } from './rng';

/** What each enemy costs out of a battle's budget. */
export const ENEMY_COST: Record<string, number> = {
  'recon-drone': 1, 'gun-turret': 2, tank: 2, gunship: 2, 'lance-tower': 3, 'light-mech': 3, stalker: 4, 'heavy-mech': 4,
  rival: 5, juggernaut: 6,
  'shield-drone': 2, 'repair-drone': 2, jammer: 2, 'bomb-crawler': 2, carrier: 4, marksman: 4, ripper: 4, bulldozer: 5,
  'lien-drone': 2, bailiff: 6,
  sable: 7, rook: 7, krell: 8, 'rival-2': 7, assessor: 9, 'strip-miner': 9, overseer: 9, leviathan: 9, 'ashfall-unbound': 10, adjuster: 12,
};
/** At most one of these per battle. */
export const MECH_ENEMIES = [
  'light-mech', 'stalker', 'heavy-mech', 'rival', 'juggernaut', 'marksman', 'ripper', 'bulldozer', 'bailiff',
  'sable', 'rook', 'krell', 'rival-2', 'assessor', 'ashfall-unbound',
];
/** Enemies that belong to the story: the named pilots, the great machines, and everything of Meridian's. */
export const STORY_ENEMIES = [
  'rival', 'rival-2', 'ashfall-unbound', 'sable', 'rook', 'krell', 'strip-miner', 'overseer', 'leviathan',
  'lien-drone', 'bailiff', 'assessor', 'adjuster',
];
/**
 * Enemies that are no fight on their own: they cover, mend or jam for the others, or simply blow
 * up. An open contract fields at most one in a battle, and never as the first enemy picked.
 */
export const SUPPORT_ENEMIES = ['shield-drone', 'repair-drone', 'jammer', 'bomb-crawler'];
/** Enemies that open contracts may field. */
const POOL = Object.keys(ENEMY_COST).filter((id) => !STORY_ENEMIES.includes(id));

export const MAX_TIER = 8;
export const MAX_BUDGET = 8;
export const BOARD_SIZE = 3;
export const WINS_PER_TIER = 5;
export const PAY_PER_POINT = 250;
export const PAY_PER_BATTLE = 200;

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

class Dice {
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
function rollEnemies(dice: Dice, budget: number): string[] {
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
  return board;
}
