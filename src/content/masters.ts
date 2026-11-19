import type { Archetype } from '../core/archetype';
import { masterEnemy, masterId, type Master } from '../core/masters';
import type { EnemyDef } from '../core/types';

const SHRIKE = { head: 'head-shrike', core: 'core-shrike', arms: 'arms-shrike', legs: 'legs-shrike' };
const STERLING = { head: 'head-sterling', core: 'core-sterling', arms: 'arms-sterling', legs: 'legs-sterling' };
const AUDITOR = { head: 'head-auditor', core: 'core-auditor', arms: 'arms-auditor', legs: 'legs-auditor' };
const COLOSSUS = { head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus' };
const RONIN = { head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin' };
const WRAITH = { head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith' };

/**
 * The seven masters, in the order the rules ask about the classes. Each flies the purest machine of
 * their class, put together from parts a pilot can own, in a paint only they wear.
 *
 * How strong each is was set by measurement (`scripts/masters.ts`), against the late build the game
 * suggests for their own class, flown on Auto Turn by a pilot with a veteran's six ranks of perks:
 * that pilot takes the crown about half the time, one with no perks seldom, one with every perk
 * nearly always. A class that kills quickly meets a master plated to last, who hits no harder for
 * it; a class that is slow to kill meets one who hits harder and is plated little, so that the duel
 * is decided before the magazines are empty. The tests hold the measure as ranges.
 */
export const MASTERS: Master[] = [
  {
    kind: 'duellist', name: 'Quillon', paint: 'mercury', scale: 0.8, plating: 3,
    style: 'A Shrike with a Gavel in one hand, an arc blade in the other and nothing that shoots. He is on you every round, and plated to outlast you there.',
    taunt: 'Guns are for people who are afraid of the distance.',
    concede: 'At my own distance. Take it, and keep it sharp.',
    build: { ...SHRIKE, generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-overclock', rightHand: 'wpn-gavel', leftHand: 'wpn-arc-blade' },
  },
  {
    kind: 'marksman', name: 'Plumb', paint: 'abyss', scale: 1.2, plating: 1,
    style: 'An Auditor on four legs that do not sway, a Longbow in the hand and a Decree on the shoulder. Both charge for a turn. Guard when they glow: what they hit, they finish.',
    taunt: 'One line. I only draw it once.',
    concede: 'You drew it straighter than I did. The crown is yours.',
    build: { ...AUDITOR, legs: 'legs-spider', generator: 'gen-singularity', booster: 'bst-stock', fcs: 'fcs-hawkeye', module: 'mod-oracle', rightHand: 'wpn-longbow', shoulder: 'wpn-decree' },
  },
  {
    kind: 'artillery', name: 'Cadence', paint: 'brass', scale: 1.6,
    style: 'A Ronin body on Colossus legs that fires by the clock: a Hornet salvo, a frag launcher, and a Writ rifle through whatever they open. End it before your magazines do.',
    taunt: 'Count with me. You will not get to ten.',
    concede: 'You kept better time than I did. Take the crown.',
    build: { ...RONIN, legs: 'legs-colossus', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-ballista', module: 'mod-overclock', rightHand: 'wpn-writ', leftHand: 'wpn-frag-launcher', shoulder: 'wpn-hornet-salvo' },
  },
  {
    kind: 'lancer', name: 'Filament', paint: 'ultraviolet', scale: 1, plating: 0.5,
    style: 'Energy and nothing else, behind a Sterling field: a lance emitter, a disruptor and a null beam. Every hit comes out of your next turn. Small hits stop at the field.',
    taunt: 'You brought ammunition. How quaint.',
    concede: 'Light against light, and yours was brighter. It is yours.',
    build: { ...STERLING, legs: 'legs-auditor', generator: 'gen-singularity', booster: 'bst-stock', fcs: 'fcs-lattice', module: 'mod-cryo', rightHand: 'wpn-lance-emitter', leftHand: 'wpn-disruptor', shoulder: 'wpn-null-beam' },
  },
  {
    kind: 'bastion', name: 'Keystone', paint: 'basalt', scale: 1.5, plating: 0.25,
    style: 'Colossus plate on treads behind a tower shield. A void rifle that halves what your armour resists, and a breaker cannon. It does not move, and nothing here hits harder.',
    taunt: 'Push. Everyone pushes. I am still here.',
    concede: 'Moved. The first time in eleven years. The crown is yours.',
    build: { ...COLOSSUS, legs: 'legs-crawler', generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-tracer', module: 'mod-aegis', rightHand: 'wpn-void-rifle', leftHand: 'shd-tower', shoulder: 'wpn-breaker-cannon' },
  },
  {
    kind: 'skirmisher', name: 'Mayfly', paint: 'kingfisher', scale: 1.15, plating: 0.5,
    style: 'A Wraith that is never where you aimed, with a void rifle, a needler and chaff for when you get a lock. She wins on the shots you miss, so make each one count.',
    taunt: 'Take your time aiming. I will be somewhere else.',
    concede: 'You were there before I was. Nobody has been. Take it.',
    build: { ...WRAITH, generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-chaff', rightHand: 'wpn-void-rifle', leftHand: 'wpn-needler' },
  },
  {
    kind: 'allrounder', name: 'Journeyman', paint: 'patina', scale: 0.9, plating: 1.5,
    style: 'An Auditor with a gun of each sort: a Writ rifle, a pulse carbine and a howler that knocks you flat, and nanites to put the armour back. No trick, and no weakness to find.',
    taunt: 'Thirty years, and they still call me Journeyman.',
    concede: 'Now there is nothing left to learn from me. Take the crown.',
    build: { ...AUDITOR, generator: 'gen-singularity', booster: 'bst-stock', fcs: 'fcs-omni', module: 'mod-nanites', rightHand: 'wpn-writ', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-howler' },
  },
];

/** The master of a class. */
export const masterOf = (kind: Archetype): Master => MASTERS.find((master) => master.kind === kind)!;

/** The masters as a battle fields them, by the id of their duel. */
export const MASTER_ENEMIES: Record<string, EnemyDef> = Object.fromEntries(MASTERS.map((master) => [masterId(master.kind), masterEnemy(master)]));
