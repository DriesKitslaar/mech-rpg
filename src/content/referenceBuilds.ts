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
  /** After the three clients: a sharper head, a stronger generator and an energy carbine. Costs 3800, part of which comes from selling the parts they replace. */
  tier2: { ...DEMO_BUILD, head: 'head-halo', generator: 'gen-prism', leftHand: 'wpn-pulse-carbine' },
  /** After the exclusive contract: heavy legs and core to carry it all, and a cooler generator. Again partly paid for by selling what it replaces. */
  tier3: {
    ...DEMO_BUILD, head: 'head-halo', core: 'core-bulwark', legs: 'legs-bulwark', generator: 'gen-furnace',
    leftHand: 'wpn-pulse-carbine',
  },
  /** After the campaign: a full Ronin with a rail lance and a shoulder array. */
  tier4: {
    head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-prism',
    rightHand: 'wpn-rail-lance', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array',
  },
  /** Deep into the arena: a Wraith striker with a void rifle. */
  tier5: {
    head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal',
    rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-caster', shoulder: 'wpn-halo-array',
  },
  /** The top of the ladder: a full Colossus carrying the heaviest guns there are. */
  tier6: {
    head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-tidal',
    rightHand: 'wpn-void-rifle', leftHand: 'wpn-lance-emitter', shoulder: 'wpn-breaker-cannon',
  },
};
