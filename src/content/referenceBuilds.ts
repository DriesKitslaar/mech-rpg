import type { Build } from '../core/types';
import { DEMO_BUILD, STARTER_BUILD } from './parts';

/**
 * Builds a player can afford at each stage of the campaign. The balance tests and the simulation
 * script play the contracts with these to check that each stage is winnable.
 */
export const REFERENCE_BUILDS: Record<string, Build> = {
  /** What a new game starts with. */
  starter: STARTER_BUILD,
  /** After the introductions: two more weapons (1300 credits). */
  tier1: DEMO_BUILD,
  /** After the three clients: a sharper head, a stronger generator and an energy carbine (3800 more). */
  tier2: { ...DEMO_BUILD, head: 'head-halo', generator: 'gen-prism', leftHand: 'wpn-pulse-carbine' },
  /** After the exclusive contract: heavy legs and core to carry it all, and a cooler generator (4200 more). */
  tier3: {
    ...DEMO_BUILD, head: 'head-halo', core: 'core-bulwark', legs: 'legs-bulwark', generator: 'gen-furnace',
    leftHand: 'wpn-pulse-carbine',
  },
};
