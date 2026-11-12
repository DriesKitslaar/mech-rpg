import type { Mission } from './campaign';
import { nextRandom } from './rng';

/** What each enemy costs out of a battle's budget. */
export const ENEMY_COST: Record<string, number> = {
  'recon-drone': 1, 'gun-turret': 2, tank: 2, gunship: 2, 'lance-tower': 3, 'light-mech': 3, stalker: 4, 'heavy-mech': 4,
  rival: 5, juggernaut: 6,
};
/** At most one of these per battle. */
export const MECH_ENEMIES = ['light-mech', 'stalker', 'heavy-mech', 'rival', 'juggernaut'];
/** Enemies that open contracts may field. The rival belongs to the story. */
const POOL = Object.keys(ENEMY_COST).filter((id) => id !== 'rival');

export const MAX_TIER = 8;
export const MAX_BUDGET = 9;
export const BOARD_SIZE = 3;
export const PAY_PER_POINT = 220;
export const PAY_PER_BATTLE = 150;

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

export function boardTier(battlesWon: number, cycle: number): number {
  return Math.min(MAX_TIER, Math.floor(battlesWon / 3) + 2 * cycle);
}

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
    const affordable = POOL.filter((id) => ENEMY_COST[id] <= left && !(hasMech && MECH_ENEMIES.includes(id)));
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
 * The open contracts on offer. A pure function of the pilot's progress: the same board after a
 * reload, a new one after every battle won.
 */
export function generateBoard(battlesWon: number, cycle: number, text: BoardText): Mission[] {
  const tier = boardTier(battlesWon, cycle);
  const budget = Math.min(MAX_BUDGET, 2 + tier);
  const dice = new Dice(((battlesWon + 1) * 7919 + cycle * 104729) | 0);
  const usedTitles = new Set<string>();
  const board: Mission[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
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
      battles, scale: 1 + 0.08 * Math.max(0, tier - 4),
    });
  }
  return board;
}
