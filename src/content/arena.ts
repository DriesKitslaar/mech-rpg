import type { ArenaOpponent } from '../core/arena';
import type { AiProfile, Build, EnemyDef } from '../core/types';
import { ENEMIES } from './enemies';

const PURSES = [800, 1200, 1600, 2000, 2600, 3200, 3800, 4600, 5400, 7000];

type Entry = Omit<ArenaOpponent, 'rank' | 'enemy' | 'purse'> & { ai: AiProfile; build: Build; paint?: string };

const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' };

/**
 * The ladder, bottom first. Every mech is built from parts the shop sells, in its pilot's own paint.
 * The scales were set by simulation against the builds a player can afford at each rank.
 */
const LADDER: Entry[] = [
  {
    name: 'Rustjaw', ai: 'gunner', scale: 0.85,
    style: 'A scrapper in a stock salvage frame. Shoots for the core, then boosts in to finish with a ram fist.',
    taunt: 'Fresh paint. I will fix that for you.',
    build: {
      ...STOCK, head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider', generator: 'gen-kd1',
      rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-ram-fist',
    },
  },
  {
    name: 'Sister Volt', ai: 'skirmisher', scale: 0.8, paint: 'cobalt',
    style: 'Halo optics on a salvage body. Paints you, drains your generator and aims for the head.',
    taunt: 'Hold still. This only hurts if I miss.',
    build: {
      head: 'head-halo', core: 'core-hauler', arms: 'arms-halo', legs: 'legs-strider', generator: 'gen-kd1',
      booster: 'bst-glide', fcs: 'fcs-stock', module: 'mod-painter', rightHand: 'wpn-arc-pistol', leftHand: 'wpn-disruptor',
    },
  },
  {
    name: 'Brick', ai: 'bruiser', scale: 1, paint: 'steel',
    style: 'A Bulwark core behind a riot shield, with a scatter gun and a flare mortar. Hunts whatever is already damaged.',
    taunt: 'I do not dodge. I do not need to.',
    build: {
      ...STOCK, head: 'head-scout-mk1', core: 'core-bulwark', arms: 'arms-rigger', legs: 'legs-bulwark', generator: 'gen-dynamo',
      module: 'mod-coolant', rightHand: 'wpn-scatter-gun', leftHand: 'shd-riot', shoulder: 'wpn-flare-mortar',
    },
  },
  {
    name: 'Mirage', ai: 'skirmisher', scale: 0.8, paint: 'rose',
    style: 'A full Halo frame with a marksman rifle and chaff. Very hard to hit while her legs work.',
    taunt: 'You will be shooting at where I was.',
    build: {
      head: 'head-halo', core: 'core-halo', arms: 'arms-halo', legs: 'legs-halo', generator: 'gen-prism',
      booster: 'bst-vector', fcs: 'fcs-lattice', module: 'mod-chaff', rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-marksman',
    },
  },
  {
    name: 'Anvil', ai: 'bruiser', scale: 1.2, paint: 'obsidian',
    style: 'A Bulwark on tracks behind a tower shield. It cannot dodge and does not care; energy weapons cut through it.',
    taunt: 'Hadron built me to break strikes. You are a small one.',
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-crawler', generator: 'gen-furnace',
      booster: 'bst-stock', fcs: 'fcs-tracer', module: 'mod-overclock',
      rightHand: 'wpn-rail-lance', leftHand: 'shd-tower', shoulder: 'wpn-flare-mortar',
    },
  },
  {
    name: 'Kestrel', ai: 'sprayer', scale: 0.85, paint: 'viridian',
    style: 'A Mantis that leaps in with a thermal cutter and peppers you with flak. Takes your mech apart piece by piece.',
    taunt: 'Nothing personal. I am paid per part.',
    build: {
      head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis', generator: 'gen-prism',
      booster: 'bst-ram', fcs: 'fcs-ballista', module: 'mod-coolant', rightHand: 'wpn-thermal-cutter', leftHand: 'wpn-flak',
    },
  },
  {
    name: 'Cinder', ai: 'gunner', scale: 1.1, paint: 'sunburst',
    style: 'A Ronin on four legs with thermal weapons. Every hit heats you up, so vent early or shut down.',
    taunt: 'Let us see how you fight with your cockpit on fire.',
    build: {
      ...STOCK, head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-spider', generator: 'gen-furnace',
      module: 'mod-limiter', rightHand: 'wpn-thermal-lance', shoulder: 'wpn-inferno-pod',
    },
  },
  {
    name: 'Phantom', ai: 'skirmisher', scale: 0.75, paint: 'bone',
    style: 'A full Wraith with a void rifle that ignores half your armour, and an arc blade for when you stagger.',
    taunt: 'Eight seasons. Nobody has touched the mask.',
    build: {
      head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal',
      booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade',
    },
  },
  {
    name: 'Bastion', ai: 'bruiser', scale: 0.95, paint: 'midnight',
    style: 'A full Colossus with a breaker cannon and a barrier for when it hurts. One hit can end you.',
    taunt: 'Take your time. I have all the armour in the world.',
    build: {
      head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-tidal',
      booster: 'bst-stock', fcs: 'fcs-tracer', module: 'mod-aegis',
      rightHand: 'wpn-rail-lance', leftHand: 'shd-riot', shoulder: 'wpn-breaker-cannon',
    },
  },
  {
    name: 'The Magistrate', ai: 'bruiser', scale: 1.25, paint: 'royal',
    style: 'The champion. Colossus armour, a Wraith mask, a void rifle and a null beam that drains your generator.',
    taunt: 'The ladder ends here. Most careers do.',
    build: {
      head: 'head-wraith', core: 'core-colossus', arms: 'arms-ronin', legs: 'legs-colossus', generator: 'gen-singularity',
      booster: 'bst-phase', fcs: 'fcs-omni', module: 'mod-aegis', rightHand: 'wpn-void-rifle', shoulder: 'wpn-null-beam',
    },
  },
];

const enemyId = (rank: number): string => `arena-${rank}`;

export const ARENA: ArenaOpponent[] = LADDER.map(({ ai: _ai, build: _build, paint: _paint, ...entry }, i) => ({
  ...entry, rank: i + 1, enemy: enemyId(i + 1), purse: PURSES[i],
}));

export const ARENA_ENEMIES: Record<string, EnemyDef> = Object.fromEntries(LADDER.map((entry, i) => [
  enemyId(i + 1),
  {
    id: enemyId(i + 1), name: entry.name, ai: entry.ai, sprite: 'enemy-rival', composed: true, build: entry.build,
    ...(entry.paint ? { paint: entry.paint } : {}),
  },
]));

/** Every enemy a battle can field: contract enemies and arena opponents. */
export const ALL_ENEMIES: Record<string, EnemyDef> = { ...ENEMIES, ...ARENA_ENEMIES };
