import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  'recon-drone': {
    id: 'recon-drone', name: 'Recon Drone', ai: 'gunner', sprite: 'enemy-recon-drone',
    build: { core: 'core-drone', legs: 'legs-rotor', generator: 'gen-drone', shoulder: 'wpn-drone-stinger' },
  },
  'gun-turret': {
    id: 'gun-turret', name: 'Gun Turret', ai: 'gunner', sprite: 'enemy-gun-turret',
    build: { core: 'core-turret', generator: 'gen-turret', shoulder: 'wpn-turret-cannon' },
  },
};

/** Enemy ids per battle, one to three per encounter. */
export const ENCOUNTERS: Record<string, string[]> = {
  intro: ['recon-drone', 'recon-drone'],
  outpost: ['gun-turret', 'recon-drone'],
};
