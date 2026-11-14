import type { Build } from '../core/types';
import { DEMO_BUILD, STARTER_BUILD } from './parts';

const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' };

/**
 * Builds a player can afford at each stage of the campaign. The balance tests and the simulation
 * script play the contracts with these to check that each stage is winnable.
 */
export const REFERENCE_BUILDS: Record<string, Build> = {
  /** What a new game starts with. */
  starter: STARTER_BUILD,
  /** After the introductions: two more weapons (1300 credits). */
  tier1: DEMO_BUILD,
  /** After the three clients: a sharper head, a stronger generator, an energy carbine and fire control to match. Part of the cost comes from selling what they replace. */
  tier2: { ...DEMO_BUILD, head: 'head-halo', generator: 'gen-prism', leftHand: 'wpn-pulse-carbine', fcs: 'fcs-lattice' },
  /** After the exclusive contract: heavy legs and core to carry it all, a cooler generator, the same fire control and a barrier. */
  tier3: {
    ...DEMO_BUILD, head: 'head-halo', core: 'core-bulwark', legs: 'legs-bulwark', generator: 'gen-furnace',
    leftHand: 'wpn-pulse-carbine', fcs: 'fcs-lattice', module: 'mod-barrier',
  },
  /** After the campaign: a full Ronin with a rail lance and a shoulder array. */
  tier4: {
    ...STOCK, head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-prism',
    rightHand: 'wpn-rail-lance', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array', module: 'mod-coolant',
  },
  /** Deep into the arena: a Wraith duellist with a void rifle and a blade, on phase jets. */
  tier5: {
    head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal',
    booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade',
  },
  /** The top of the ladder: a full Colossus with the best generator, a lance emitter that never runs dry, a breaker cannon and a barrier. */
  tier6: {
    head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-singularity',
    booster: 'bst-stock', fcs: 'fcs-omni', module: 'mod-aegis', rightHand: 'wpn-lance-emitter', shoulder: 'wpn-breaker-cannon',
  },
};
