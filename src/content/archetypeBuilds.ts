import type { Archetype } from '../core/archetype';
import type { Build } from '../core/types';
import { REFERENCE_BUILDS } from './referenceBuilds';

/** The three stretches of the story a build is bought for: the first act, the war, and the audit that follows it. */
export const STAGES = ['early', 'war', 'late'] as const;
export type Stage = typeof STAGES[number];

/**
 * What a pilot can have spent on a build by each stage: what the reference build of that stage
 * costs (the gear of the three clients, a full Ronin, the top of the ladder).
 */
export const STAGE_BUDGET: Record<Stage, number> = { early: 7200, war: 13700, late: 28100 };

const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' };
const HAULER = { head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider' };
const DOZER = { head: 'head-dozer', core: 'core-dozer', arms: 'arms-dozer', legs: 'legs-dozer' };
const MANTIS = { head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis' };
const RONIN = { head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin' };
const WRAITH = { head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith' };
const COLOSSUS = { head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus' };

/**
 * A build of each kind for each stage of the story, bought with what that stage sells and what a
 * pilot has by then. They are what the game suggests to a pilot who wants to fly that kind, and
 * what the balance tests and the careers fly to show that every kind gets through the story.
 * Each was chosen by measurement from several of its kind; none is the only way to build one.
 */
export const ARCHETYPE_BUILDS: Record<Archetype, Record<Stage, Build>> = {
  /** A blade from the first shop that sells one, on legs quick enough to get it there; then two; then the Wraith the arena pays out. */
  duellist: {
    early: { ...HAULER, legs: 'legs-mantis', generator: 'gen-dynamo', booster: 'bst-sprint', fcs: 'fcs-stock', rightHand: 'wpn-arc-blade', leftHand: 'wpn-rivet-rifle' },
    war: { ...MANTIS, generator: 'gen-prism', booster: 'bst-sprint', fcs: 'fcs-stock', rightHand: 'wpn-arc-blade', leftHand: 'wpn-thermal-cutter' },
    late: REFERENCE_BUILDS.tier5,
  },
  /** A coil pistol and a sharp eye; then a longbow in the hand and a sunlance on the shoulder; then the same with the power to fire both. */
  marksman: {
    early: { ...HAULER, head: 'head-halo', generator: 'gen-dynamo', booster: 'bst-stock', fcs: 'fcs-tracer', rightHand: 'wpn-coil-pistol', leftHand: 'wpn-rivet-rifle' },
    war: { ...RONIN, head: 'head-halo', generator: 'gen-prism', ...STOCK, rightHand: 'wpn-longbow', shoulder: 'wpn-sunlance' },
    late: { ...RONIN, generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-hawkeye', rightHand: 'wpn-longbow', shoulder: 'wpn-sunlance' },
  },
  /** A salvo over two good guns: the salvo for whatever comes in numbers, the guns for whatever comes alone. */
  artillery: {
    early: { ...HAULER, head: 'head-halo', generator: 'gen-prism', ...STOCK, rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-micro-salvo' },
    war: { ...RONIN, generator: 'gen-prism', booster: 'bst-stock', fcs: 'fcs-tracer', rightHand: 'wpn-rail-lance', leftHand: 'wpn-rivet-rifle', shoulder: 'wpn-micro-salvo' },
    late: { ...COLOSSUS, generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-ballista', rightHand: 'wpn-frag-launcher', leftHand: 'wpn-flak', shoulder: 'wpn-hornet-salvo' },
  },
  /** Energy and nothing else. It is the weapons that cook and starve the other machine that carry it, more than the ones that only burn. */
  lancer: {
    early: { ...HAULER, generator: 'gen-prism', booster: 'bst-stock', fcs: 'fcs-lattice', rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol' },
    war: {
      ...RONIN, head: 'head-halo', arms: 'arms-rigger', generator: 'gen-prism', ...STOCK, module: 'mod-coolant',
      rightHand: 'wpn-plasma', leftHand: 'wpn-disruptor', shoulder: 'wpn-halo-array',
    },
    late: {
      ...RONIN, legs: 'legs-spider', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-omni', module: 'mod-cryo',
      rightHand: 'wpn-plasma', leftHand: 'wpn-disruptor', shoulder: 'wpn-null-beam',
    },
  },
  /** A yard dozer behind a riot shield; then the heavy plate of the choice; then the Colossus. */
  bastion: {
    early: { ...DOZER, generator: 'gen-furnace', ...STOCK, rightHand: 'wpn-pulse-carbine', leftHand: 'shd-riot', shoulder: 'wpn-mortar-pod' },
    war: REFERENCE_BUILDS.tier3,
    late: REFERENCE_BUILDS.tier6,
  },
  /** Quick legs under whatever shoots straight: it is the legs that are kept, and the rest that grows. */
  skirmisher: {
    early: { ...HAULER, legs: 'legs-mantis', generator: 'gen-dynamo', booster: 'bst-sprint', fcs: 'fcs-stock', rightHand: 'wpn-needler', leftHand: 'wpn-arc-pistol' },
    war: { ...MANTIS, core: 'core-ronin', arms: 'arms-halo', generator: 'gen-prism', booster: 'bst-vector', fcs: 'fcs-stock', rightHand: 'wpn-rail-lance', leftHand: 'wpn-pulse-carbine' },
    late: { ...WRAITH, generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-pulse-carbine' },
  },
  /** The builds every pilot has been measured in, and at the end a Ronin on four legs with a gun of each sort. */
  allrounder: {
    early: REFERENCE_BUILDS.tier2,
    war: REFERENCE_BUILDS.tier4,
    late: {
      ...RONIN, legs: 'legs-spider', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-omni', module: 'mod-aegis',
      rightHand: 'wpn-rail-lance', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-null-beam',
    },
  },
};
