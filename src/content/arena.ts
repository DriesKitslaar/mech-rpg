import type { ArenaOpponent } from '../core/arena';
import type { AiProfile, Build, EnemyDef } from '../core/types';
import { ENEMIES } from './enemies';

const PURSES = [800, 1200, 1600, 2000, 2600, 3200, 3800, 4600, 5400, 7000];

type Entry = Omit<ArenaOpponent, 'rank' | 'enemy' | 'purse'> & { ai: AiProfile; build: Build };

/** The ladder, bottom first. Every mech is built from parts the shop sells. */
const LADDER: Entry[] = [
  {
    name: 'Rustjaw', ai: 'gunner', scale: 1.5,
    style: 'A scrapper in a stock salvage frame. Shoots straight for the core and nothing else.',
    taunt: 'Fresh paint. I will fix that for you.',
    build: {
      head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider', generator: 'gen-kd1',
      rightHand: 'wpn-rivet-rifle',
    },
  },
  {
    name: 'Sister Volt', ai: 'skirmisher', scale: 0.9,
    style: 'Halo optics on a salvage body. Boosts often and aims for the head.',
    taunt: 'Hold still. This only hurts if I miss.',
    build: {
      head: 'head-halo', core: 'core-hauler', arms: 'arms-halo', legs: 'legs-strider', generator: 'gen-kd1',
      rightHand: 'wpn-arc-pistol',
    },
  },
  {
    name: 'Brick', ai: 'bruiser', scale: 1.5,
    style: 'A Bulwark core on borrowed legs, with a scatter gun. Hunts whatever is already damaged.',
    taunt: 'I do not dodge. I do not need to.',
    build: {
      head: 'head-scout-mk1', core: 'core-bulwark', arms: 'arms-rigger', legs: 'legs-bulwark', generator: 'gen-kd1',
      rightHand: 'wpn-scatter-gun',
    },
  },
  {
    name: 'Mirage', ai: 'skirmisher', scale: 0.9,
    style: 'A full Halo frame with a pulse carbine. Very hard to hit while her legs work.',
    taunt: 'You will be shooting at where I was.',
    build: {
      head: 'head-halo', core: 'core-halo', arms: 'arms-halo', legs: 'legs-halo', generator: 'gen-prism',
      rightHand: 'wpn-pulse-carbine',
    },
  },
  {
    name: 'Anvil', ai: 'bruiser', scale: 1.3,
    style: 'A full Bulwark with a rail lance. Shrugs off bullets; energy weapons cut right through.',
    taunt: 'Hadron built me to break strikes. You are a small one.',
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-bulwark', generator: 'gen-furnace',
      rightHand: 'wpn-rail-lance',
    },
  },
  {
    name: 'Kestrel', ai: 'sprayer', scale: 0.9,
    style: 'A Ronin frame with a pulse carbine and a shoulder array. Takes your mech apart piece by piece.',
    taunt: 'Nothing personal. I am paid per part.',
    build: {
      head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-prism',
      rightHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array',
    },
  },
  {
    name: 'Cinder', ai: 'gunner', scale: 1.0,
    style: 'A Ronin with thermal weapons. Every hit heats you up, so vent early or shut down.',
    taunt: 'Let us see how you fight with your cockpit on fire.',
    build: {
      head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-ember',
      rightHand: 'wpn-thermal-lance', shoulder: 'wpn-inferno-pod',
    },
  },
  {
    name: 'Phantom', ai: 'skirmisher', scale: 0.8,
    style: 'A full Wraith with a void rifle that ignores half your armour. The fastest mech on the ladder.',
    taunt: 'Eight seasons. Nobody has touched the mask.',
    build: {
      head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal',
      rightHand: 'wpn-void-rifle',
    },
  },
  {
    name: 'Bastion', ai: 'bruiser', scale: 0.85,
    style: 'A full Colossus with a breaker cannon. Slow to kill and slow to shoot, but one hit can end you.',
    taunt: 'Take your time. I have all the armour in the world.',
    build: {
      head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-tidal',
      rightHand: 'wpn-rail-lance', shoulder: 'wpn-breaker-cannon',
    },
  },
  {
    name: 'The Magistrate', ai: 'bruiser', scale: 1.25,
    style: 'The champion. Colossus armour, a Wraith mask, a void rifle and a null beam that drains your generator.',
    taunt: 'The ladder ends here. Most careers do.',
    build: {
      head: 'head-wraith', core: 'core-colossus', arms: 'arms-ronin', legs: 'legs-colossus', generator: 'gen-tidal',
      rightHand: 'wpn-void-rifle', shoulder: 'wpn-null-beam',
    },
  },
];

const enemyId = (rank: number): string => `arena-${rank}`;

export const ARENA: ArenaOpponent[] = LADDER.map(({ ai: _ai, build: _build, ...entry }, i) => ({
  ...entry, rank: i + 1, enemy: enemyId(i + 1), purse: PURSES[i],
}));

export const ARENA_ENEMIES: Record<string, EnemyDef> = Object.fromEntries(LADDER.map((entry, i) => [
  enemyId(i + 1),
  {
    id: enemyId(i + 1), name: entry.name, ai: entry.ai, sprite: 'enemy-rival', composed: true,
    // Whoever does not name a booster or fire control flies the stock ones.
    build: { booster: 'bst-stock', fcs: 'fcs-stock', ...entry.build },
  },
]));

/** Every enemy a battle can field: contract enemies and arena opponents. */
export const ALL_ENEMIES: Record<string, EnemyDef> = { ...ENEMIES, ...ARENA_ENEMIES };
