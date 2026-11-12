import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  'recon-drone': {
    id: 'recon-drone', name: 'Recon Drone', ai: 'sprayer', sprite: 'enemy-recon-drone',
    build: { core: 'core-drone', legs: 'legs-rotor', generator: 'gen-drone', shoulder: 'wpn-drone-stinger' },
  },
  'gun-turret': {
    id: 'gun-turret', name: 'Gun Turret', ai: 'gunner', sprite: 'enemy-gun-turret',
    build: { core: 'core-turret', generator: 'gen-turret', shoulder: 'wpn-turret-cannon' },
  },
  tank: {
    id: 'tank', name: 'Salvage Tank', ai: 'sprayer', sprite: 'enemy-tank',
    build: { core: 'core-tank', legs: 'legs-tracks', generator: 'gen-tank', shoulder: 'wpn-tank-gun' },
  },
  // Fast and hard to hit until its legs are shot out.
  'light-mech': {
    id: 'light-mech', name: 'Halo Guard', ai: 'skirmisher', sprite: 'enemy-light-mech', composed: true,
    build: {
      head: 'head-halo', core: 'core-halo', arms: 'arms-halo', legs: 'legs-halo', generator: 'gen-kd1',
      rightHand: 'wpn-enemy-carbine',
    },
  },
  // Slow, thick, and goes for whatever is already damaged.
  'heavy-mech': {
    id: 'heavy-mech', name: 'Bulwark Enforcer', ai: 'bruiser', sprite: 'enemy-heavy-mech', composed: true,
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-bulwark', generator: 'gen-kd1',
      rightHand: 'wpn-enemy-shotgun',
    },
  },
  rival: {
    id: 'rival', name: 'Ashfall', ai: 'bruiser', sprite: 'enemy-rival', composed: true,
    build: {
      head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-kd1',
      rightHand: 'wpn-enemy-lance', shoulder: 'wpn-enemy-rack',
    },
  },
  gunship: {
    id: 'gunship', name: 'Gunship', ai: 'sprayer', sprite: 'enemy-gunship',
    build: { core: 'core-gunship', legs: 'legs-thrusters', generator: 'gen-gunship', shoulder: 'wpn-gunship-pods' },
  },
  // Has no legs, so it never boosts: the skirmisher profile just makes it aim for the head.
  'lance-tower': {
    id: 'lance-tower', name: 'Lance Tower', ai: 'skirmisher', sprite: 'enemy-lance-tower',
    build: { core: 'core-tower', generator: 'gen-tower', shoulder: 'wpn-tower-lance' },
  },
  stalker: {
    id: 'stalker', name: 'Wraith Stalker', ai: 'skirmisher', sprite: 'enemy-stalker', composed: true,
    build: {
      head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-kd1',
      rightHand: 'wpn-enemy-needle',
    },
  },
  juggernaut: {
    id: 'juggernaut', name: 'Colossus Juggernaut', ai: 'bruiser', sprite: 'enemy-juggernaut', composed: true,
    build: {
      head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-furnace',
      rightHand: 'wpn-enemy-maul', shoulder: 'wpn-enemy-mortar',
    },
  },
};
