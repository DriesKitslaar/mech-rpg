import type { FrameSlot } from '../core/types';

/** All player-facing text. UI code never contains literal copy. */
export const STRINGS = {
  title: 'IRONWAGE',
  actions: { fire: 'Fire', boost: 'Boost', cool: 'Cool', repair: 'Field Repair', endTurn: 'End Turn' },
  parts: { core: 'Core', legs: 'Legs', arms: 'Arms', head: 'Head' } satisfies Record<FrameSlot, string>,
  meters: { energy: 'EN', heat: 'HEAT', ammo: 'AMMO', unlimited: '--', repairs: 'REPAIRS' },
  headings: { you: 'YOUR MECH', target: 'TARGET', weapons: 'WEAPONS', repair: 'REPAIR WHICH PART?' },
  preview: { hit: 'HIT', damage: 'DMG' },
  yourTurn: (round: number) => `Round ${round} - your move`,
  hit: (weapon: string, target: string, part: string, damage: number) => `${weapon} hits ${target} - ${part} -${damage}`,
  miss: (weapon: string, target: string) => `${weapon} misses ${target}`,
  partDestroyed: (unit: string, part: string) => `${unit}: ${part} destroyed`,
  unitDestroyed: (unit: string) => `${unit} destroyed`,
  boost: (unit: string) => `${unit} boosts`,
  cool: (unit: string, amount: number) => `${unit} vents heat -${amount}`,
  repair: (unit: string, part: string, amount: number) => `${unit} repair ${part} +${amount}`,
  overheatPlayer: 'Overheated! Next turn lost',
  overheatWarning: 'Warning: this shot will overheat',
  overheat: (unit: string) => `${unit} overheats`,
  turnSkipped: (unit: string) => `${unit} cooling down - turn lost`,
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  hints: { result: 'Press A to continue' },
  titleScreen: {
    tagline: 'Every contract pays. Not every pilot collects.',
    continue: 'Continue', newGame: 'New Game', eraseQuestion: 'Start over? This erases your save.', no: 'No', yes: 'Yes',
  },
  hub: {
    heading: 'HEADQUARTERS', sortie: 'Sortie', garage: 'Garage', shop: 'Shop',
    credits: 'CREDITS', battlesWon: 'CONTRACTS WON', next: 'NEXT CONTRACT',
  },
  buildErrors: {
    overweight: 'Overweight', insufficientEnergy: 'Not enough energy', missingSlot: 'Missing part',
    wrongMount: 'Wrong mount', unknownPart: 'Unknown part',
  },
  encounters: { intro: 'Drone Patrol', outpost: 'Outpost Assault' } as Record<string, string>,
  settlement: {
    won: 'CONTRACT COMPLETE', lost: 'CONTRACT FAILED', reward: 'Reward', ammo: 'Ammunition', repairs: 'Repairs',
    net: 'NET', balance: 'BALANCE', continue: 'Press A to continue',
  },
  saveFailed: 'Could not save: storage is full or blocked',
  fx: { miss: 'MISS', overheat: 'OVERHEAT' },
  debug: { title: 'INPUT', action: 'action', key: 'key', none: '-' },
} as const;
