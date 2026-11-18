import type { DamageType } from './types';

/**
 * What the place a battle is fought in does to the fighting. One rule a place, small, and the same
 * for both sides: it changes which weapons and habits pay there, not who wins by default.
 */
export interface Ground {
  id: string;
  /** Added to the heat every unit sheds at the end of its turn and when it vents. */
  cooling?: number;
  /** Added to every unit's aim: for all weapons, or for weapons of one kind. */
  aim?: Partial<Record<DamageType | 'all', number>>;
  /** Multiplies the damage of weapons of one kind. */
  damage?: Partial<Record<DamageType, number>>;
  /** Added to what a boost adds to evasion; never takes it below nothing. */
  thrust?: number;
}

export const GROUNDS: Record<string, Ground> = {
  rain: { id: 'rain', cooling: 4 },
  furnace: { id: 'furnace', cooling: -4 },
  dust: { id: 'dust', aim: { all: -5 } },
  flood: { id: 'flood', thrust: -6 },
  sealed: { id: 'sealed', damage: { explosive: 0.85 } },
  wind: { id: 'wind', aim: { kinetic: -6 } },
  clear: { id: 'clear', aim: { energy: 4 } },
};

/** Which rule holds where. A place that is not listed has none: the arena and the simulator are level ground. */
const PLACES: Record<string, string> = {
  'bg-neon-district': 'rain', 'bg-foundry': 'furnace', 'bg-mine': 'dust', 'bg-sluice': 'flood', 'bg-vault': 'sealed',
  'bg-rooftop': 'wind', 'bg-plaza': 'clear', 'bg-hall': 'flood',
};

export const groundFor = (background: string): Ground | undefined => (Object.hasOwn(PLACES, background) ? GROUNDS[PLACES[background]] : undefined);
