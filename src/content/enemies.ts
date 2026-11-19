import type { EnemyDef } from '../core/types';

const RECON_DRONE: EnemyDef = {
  id: 'recon-drone', name: 'Recon Drone', ai: 'sprayer', sprite: 'enemy-recon-drone',
  build: { core: 'core-drone', legs: 'legs-rotor', generator: 'gen-drone', shoulder: 'wpn-drone-stinger' },
};

// Covers every other enemy while it flies: shots at them do only part of their damage.
const SHIELD_DRONE: EnemyDef = {
  id: 'shield-drone', name: 'Shield Drone', ai: 'sprayer', sprite: 'enemy-shield-drone', abilities: { aegis: 0.6 },
  build: { core: 'core-shield-drone', legs: 'legs-rotor', generator: 'gen-drone', shoulder: 'wpn-drone-stinger' },
};

// Walks up and blows itself apart on its third turn. It has no gun: the fuse is the weapon.
const BOMB_CRAWLER: EnemyDef = {
  id: 'bomb-crawler', name: 'Bomb Crawler', ai: 'gunner', sprite: 'enemy-bomb-crawler', abilities: { bomb: { fuse: 3, damage: 90 } },
  build: { core: 'core-bomb', legs: 'legs-bomb', generator: 'gen-drone' },
};

// Meridian's errand runner: sturdier than a recon drone, and every hit takes energy from the next turn.
const LIEN_DRONE: EnemyDef = {
  id: 'lien-drone', name: 'Lien Drone', ai: 'sprayer', sprite: 'enemy-lien-drone',
  build: { core: 'core-lien-drone', legs: 'legs-lien-drone', generator: 'gen-lien-drone', shoulder: 'wpn-lien-clamp' },
};

const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' };
const RONIN = { head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin' };
const AUDITOR = { head: 'head-auditor', core: 'core-auditor', arms: 'arms-auditor', legs: 'legs-auditor' };

const HALO = { head: 'head-halo', core: 'core-halo', arms: 'arms-halo', legs: 'legs-halo' };
const BULWARK = { head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-bulwark' };
const MANTIS = { head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis' };

/**
 * The pilots with a price on them: each a mech of ordinary parts in its own colours, flown by
 * somebody with a name. They are met on the bounty contracts and nowhere else.
 */
const WANTED: Record<string, EnemyDef> = {
  // Quick, and after the head: a thief who strips cockpits.
  magpie: {
    id: 'magpie', name: 'Magpie', ai: 'skirmisher', sprite: 'enemy-rival', composed: true, portrait: 'portrait-magpie', paint: 'royal',
    build: { ...HALO, generator: 'gen-prism', rightHand: 'wpn-enemy-carbine', leftHand: 'wpn-enemy-needle' },
  },
  // A Bulwark on tracks with a mortar: slow, and it hunts whatever is already broken.
  dredge: {
    id: 'dredge', name: 'Dredge', ai: 'bruiser', sprite: 'enemy-rival', composed: true, portrait: 'portrait-dredge', paint: 'desert',
    build: { ...BULWARK, legs: 'legs-crawler', generator: 'gen-furnace', rightHand: 'wpn-enemy-shotgun', shoulder: 'wpn-enemy-mortar' },
  },
  // Charges a rail behind a tower shield.
  lark: {
    id: 'lark', name: 'Lark', ai: 'gunner', sprite: 'enemy-rival', composed: true, portrait: 'portrait-lark', paint: 'rose',
    build: { ...HALO, generator: 'gen-prism', rightHand: 'wpn-enemy-longbow', leftHand: 'shd-tower' },
  },
  // A hot blade, a leap, and needles for when the blade arm is gone.
  hollow: {
    id: 'hollow', name: 'Hollow', ai: 'skirmisher', sprite: 'enemy-rival', composed: true, portrait: 'portrait-hollow', paint: 'toxic',
    build: { ...MANTIS, generator: 'gen-tidal', booster: 'bst-ram', rightHand: 'wpn-thermal-cutter', leftHand: 'wpn-enemy-needle' },
  },
  // A Ronin that cooks its targets and takes its time.
  paragon: {
    id: 'paragon', name: 'Paragon', ai: 'sprayer', sprite: 'enemy-rival', composed: true, portrait: 'portrait-paragon', paint: 'sunburst',
    build: { ...RONIN, ...STOCK, generator: 'gen-furnace', module: 'mod-coolant', rightHand: 'wpn-thermal-lance', shoulder: 'wpn-inferno-pod' },
  },
  // Meridian's own, gone private: an Auditor frame with a barrier and a decree.
  notary: {
    id: 'notary', name: 'The Notary', ai: 'bruiser', sprite: 'enemy-bailiff', composed: true, portrait: 'portrait-notary', paint: 'obsidian',
    build: { ...AUDITOR, generator: 'gen-tidal', module: 'mod-barrier', rightHand: 'wpn-enemy-writ', leftHand: 'wpn-enemy-seizer', shoulder: 'wpn-enemy-decree' },
    phases: [{ at: 0.4, damage: 1.15, line: 'Witnessed, sealed, and now enforced.' }],
  },
};

const SHRIKE = { head: 'head-shrike', core: 'core-shrike', arms: 'arms-shrike', legs: 'legs-shrike' };
const STERLING = { head: 'head-sterling', core: 'core-sterling', arms: 'arms-sterling', legs: 'legs-sterling' };

/**
 * The two swords of the Coast Circuit, who come to Varn once the audit is over. Each flies a frame no yard in
 * Varn builds, in its own colours, and is met in a duel and nowhere else. Both are plated to last a duel: twice
 * the armour of the frame as it is sold, so that the fight is long enough for what the frame does to be seen.
 * Measured with the game's own automatic pilot and the perks of a pilot who has finished the story: the first is
 * won nearly always by a quick mech with a blade, about half the time by a Colossus and a quarter by a Ronin
 * with guns alone; the second nearly always by anything that lands one great blow a round (a rail, two blades),
 * and one time in four by a Colossus whose beam only ever feeds the field.
 */
const CIRCUIT: Record<string, EnemyDef> = {
  // Boosts in, strikes, and is still boosting: a blade does not cost a Shrike its boost. Goes for whatever is already hurt.
  larder: {
    id: 'larder', name: 'Larder', ai: 'bruiser', sprite: 'enemy-rival', composed: true, portrait: 'portrait-larder', plating: 1,
    build: { ...SHRIKE, generator: 'gen-tidal', booster: 'bst-vector', fcs: 'fcs-surgeon', rightHand: 'wpn-enemy-edge', leftHand: 'wpn-enemy-pinpoint' },
  },
  // The first sword's own Sterling: its field is tuned far past what the yard sells. It aims for the core, as a duellist of standing does.
  argent: {
    id: 'argent', name: 'Argent', ai: 'gunner', sprite: 'enemy-rival', composed: true, portrait: 'portrait-argent', plating: 1, abilities: { field: 70 },
    build: { ...STERLING, generator: 'gen-singularity', booster: 'bst-vector', fcs: 'fcs-omni', rightHand: 'wpn-enemy-pinpoint', leftHand: 'wpn-enemy-edge' },
  },
};

/** Machines that turn up on open contracts and in the Gauntlet. */
const FIELD: Record<string, EnemyDef> = {
  // Dug in and slow to aim; what lands, lands hard.
  'mortar-nest': {
    id: 'mortar-nest', name: 'Mortar Nest', ai: 'gunner', sprite: 'enemy-mortar-nest',
    build: { core: 'core-nest', generator: 'gen-turret', shoulder: 'wpn-nest-mortar' },
  },
  // Very hard to hit, and it goes for the head.
  'hunter-drone': {
    id: 'hunter-drone', name: 'Hunter Drone', ai: 'skirmisher', sprite: 'enemy-hunter-drone',
    build: { core: 'core-hunter', legs: 'legs-hunter', generator: 'gen-lien-drone', shoulder: 'wpn-hunter-needles' },
  },
  // Three small blasts a volley, over the whole mech.
  'flak-walker': {
    id: 'flak-walker', name: 'Flak Walker', ai: 'sprayer', sprite: 'enemy-flak-walker',
    build: { core: 'core-flak', legs: 'legs-flak', generator: 'gen-tank', shoulder: 'wpn-flak-cluster' },
  },
  // Drives in and hits with the plate: it staggers what it hits.
  breacher: {
    id: 'breacher', name: 'Breacher', ai: 'bruiser', sprite: 'enemy-breacher',
    build: { core: 'core-breacher', legs: 'legs-breacher', generator: 'gen-tank', rightHand: 'wpn-breacher-ram' },
  },
  // Cannot move. Every hit heats what it hits.
  'arc-pylon': {
    id: 'arc-pylon', name: 'Arc Pylon', ai: 'gunner', sprite: 'enemy-arc-pylon',
    build: { core: 'core-pylon', generator: 'gen-tower', shoulder: 'wpn-pylon-arc' },
  },
  // A rail on rotors: it charges for a turn, then shoots through armour.
  longshot: {
    id: 'longshot', name: 'Railhawk', ai: 'gunner', sprite: 'enemy-longshot',
    build: { core: 'core-longshot', legs: 'legs-lien-drone', generator: 'gen-lien-drone', shoulder: 'wpn-longshot-rail' },
  },
  // Two more machines that are a battle on their own.
  'scrap-king': {
    id: 'scrap-king', name: 'Scrap King', ai: 'bruiser', sprite: 'boss-scrap-king',
    partNames: { core: 'Shell', legs: 'Legs', arms: 'Claws', head: 'Lamps' },
    build: {
      head: 'head-king', core: 'core-king', arms: 'arms-king', legs: 'legs-king', generator: 'gen-king',
      rightHand: 'wpn-king-pincer', shoulder: 'wpn-king-flak',
    },
    phases: [
      { at: 0.6, damage: 1.2, line: 'MINE. ALL OF IT. MINE.' },
      { at: 0.3, damage: 1.25, evasion: 8, line: 'YOU WILL LOOK GOOD ON THE PILE.' },
    ],
  },
  'night-train': {
    id: 'night-train', name: 'Night Train', ai: 'gunner', sprite: 'boss-night-train',
    partNames: { core: 'Motor', legs: 'Wheel', head: 'Grate' },
    build: {
      head: 'head-train', core: 'core-train', legs: 'legs-train', generator: 'gen-train',
      rightHand: 'wpn-train-ports', shoulder: 'wpn-train-rail',
    },
    phases: [{ at: 0.5, damage: 1.3, line: 'NO STOPS. NO SIGNALS. FULL STEAM.' }],
  },
};

export const ENEMIES: Record<string, EnemyDef> = {
  ...WANTED,
  ...CIRCUIT,
  ...FIELD,
  'recon-drone': RECON_DRONE,
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
    id: 'rival', name: 'Ashfall', ai: 'bruiser', sprite: 'enemy-rival', composed: true, portrait: 'portrait-rival',
    build: { ...RONIN, generator: 'gen-prism', rightHand: 'wpn-enemy-lance', shoulder: 'wpn-enemy-rack' },
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

  // Units that help the others.
  'shield-drone': SHIELD_DRONE,
  // Patches the most damaged of its side every turn. Nothing it guards stays hurt for long.
  'repair-drone': {
    id: 'repair-drone', name: 'Repair Drone', ai: 'gunner', sprite: 'enemy-repair-drone', abilities: { mend: 0.22 },
    build: { core: 'core-repair-drone', legs: 'legs-rotor', generator: 'gen-drone', shoulder: 'wpn-drone-welder' },
  },
  // Spoils the player's aim for as long as it stands. It cannot shoot and cannot move.
  jammer: {
    id: 'jammer', name: 'Jammer Mast', ai: 'gunner', sprite: 'enemy-jammer', abilities: { jam: 20 },
    build: { core: 'core-jammer', generator: 'gen-turret' },
  },
  'bomb-crawler': BOMB_CRAWLER,
  // Launches a drone every other turn, as long as there is room on the field.
  carrier: {
    id: 'carrier', name: 'Drone Carrier', ai: 'gunner', sprite: 'enemy-carrier', abilities: { carrier: { unit: RECON_DRONE, every: 2 } },
    build: { core: 'core-carrier', legs: 'legs-carrier', generator: 'gen-carrier', shoulder: 'wpn-carrier-gun' },
  },

  // More mechs.
  // Charges its rail for a turn, then puts the shot through armour. Shoot it while it charges.
  marksman: {
    id: 'marksman', name: 'Halo Marksman', ai: 'gunner', sprite: 'enemy-light-mech', composed: true, paint: 'cobalt',
    build: {
      head: 'head-halo', core: 'core-halo', arms: 'arms-halo', legs: 'legs-halo', generator: 'gen-kd1',
      rightHand: 'wpn-enemy-longbow',
    },
  },
  // Leaps in and cuts. The needles are for when its claw arm is gone.
  ripper: {
    id: 'ripper', name: 'Mantis Ripper', ai: 'skirmisher', sprite: 'enemy-ripper', composed: true,
    build: {
      head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis', generator: 'gen-dynamo',
      rightHand: 'wpn-enemy-claw', leftHand: 'wpn-enemy-needle',
    },
  },
  // A Bulwark on tracks behind a riot shield: cannot dodge, does not need to.
  bulldozer: {
    id: 'bulldozer', name: 'Hadron Bulldozer', ai: 'bruiser', sprite: 'enemy-heavy-mech', composed: true, paint: 'steel',
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-crawler', generator: 'gen-furnace',
      rightHand: 'wpn-enemy-shotgun', leftHand: 'shd-riot', shoulder: 'wpn-enemy-mortar',
    },
  },

  // The clients' own pilots.
  sable: {
    id: 'sable', name: 'Sable', ai: 'skirmisher', sprite: 'enemy-stalker', composed: true, paint: 'bone', portrait: 'portrait-sable',
    build: {
      head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal', booster: 'bst-vector',
      rightHand: 'wpn-enemy-pinpoint', leftHand: 'wpn-enemy-edge',
    },
    phases: [{ at: 0.5, damage: 1.2, line: 'You are inside my error margin. I am widening it.' }],
  },
  rook: {
    id: 'rook', name: 'Rook', ai: 'skirmisher', sprite: 'enemy-ripper', composed: true, paint: 'desert', portrait: 'portrait-rook',
    build: {
      head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis', generator: 'gen-dynamo', booster: 'bst-sprint',
      module: 'mod-chaff', rightHand: 'wpn-enemy-cutter', leftHand: 'wpn-enemy-flak',
    },
    phases: [{ at: 0.5, ai: 'bruiser', damage: 1.25, line: 'Ha! There you are. Now we are having a proper fight.' }],
  },
  krell: {
    id: 'krell', name: 'Krell', ai: 'bruiser', sprite: 'enemy-juggernaut', composed: true, paint: 'steel', portrait: 'portrait-krell',
    build: {
      head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-tidal',
      rightHand: 'wpn-enemy-maul', leftHand: 'shd-tower', shoulder: 'wpn-enemy-siege',
    },
    // He throws the shield away for a second gun.
    phases: [{ at: 0.5, damage: 1.2, refit: { leftHand: 'wpn-enemy-shotgun' }, line: 'Shield is slowing me down. Shift change, pilot.' }],
  },
  // Ashfall as the finales meet them: the same frame, better fed, and with something held back.
  'rival-2': {
    id: 'rival-2', name: 'Ashfall', ai: 'bruiser', sprite: 'enemy-rival', composed: true, portrait: 'portrait-rival',
    build: { ...RONIN, generator: 'gen-furnace', module: 'mod-barrier', rightHand: 'wpn-enemy-lance', shoulder: 'wpn-enemy-rack' },
    phases: [{ at: 0.5, damage: 1.2, evasion: 6, line: 'Good. I was told you would be worth the fee.' }],
  },
  // Ashfall with nothing held back and nobody paying: the last debt on Meridian's list. Lance and rack
  // while there is distance to keep; in the last third the edge comes out, and the reactor is run past
  // its limit to feed a boost, the edge and a gun in the same turn.
  'ashfall-unbound': {
    id: 'ashfall-unbound', name: 'Ashfall', ai: 'bruiser', sprite: 'enemy-rival', composed: true, portrait: 'portrait-rival',
    build: {
      ...RONIN, ...STOCK, generator: 'gen-tidal', booster: 'bst-ram', module: 'mod-barrier',
      rightHand: 'wpn-enemy-lance', shoulder: 'wpn-enemy-rack',
    },
    phases: [
      { at: 0.66, damage: 1.15, line: 'So you signed. I hope the pen was heavy.' },
      {
        at: 0.33, ai: 'skirmisher', damage: 1.2, evasion: 10, energy: 60, refit: { leftHand: 'wpn-enemy-edge' },
        line: 'Nobody is paying me for this part. That is how you know I mean it.',
      },
    ],
  },

  // Machines that are a battle on their own.
  'strip-miner': {
    id: 'strip-miner', name: 'Strip-Miner', ai: 'gunner', sprite: 'boss-strip-miner',
    partNames: { core: 'Hull', legs: 'Tread', arms: 'Wheel', head: 'Cab' },
    build: {
      head: 'head-miner', core: 'core-miner', arms: 'arms-miner', legs: 'legs-miner', generator: 'gen-miner',
      rightHand: 'wpn-miner-wheel', shoulder: 'wpn-miner-charge',
    },
    // First it runs hotter; then it opens the rock chute and throws the mountain as well.
    phases: [
      { at: 0.6, damage: 1.2, line: 'GOVERNOR OFFLINE. ALL SHIFTS REPORT TO THE FACE.' },
      { at: 0.3, ai: 'bruiser', energy: 80, refit: { leftHand: 'wpn-miner-chute' }, line: 'CAVE-IN PROTOCOL. STAND CLEAR. STAND CLEAR.' },
    ],
  },
  overseer: {
    id: 'overseer', name: 'Overseer', ai: 'gunner', sprite: 'boss-overseer',
    partNames: { core: 'Core', legs: 'Lift', head: 'Eye' },
    abilities: { jam: 12 },
    build: {
      head: 'head-overseer', core: 'core-overseer', legs: 'legs-overseer', generator: 'gen-overseer',
      rightHand: 'wpn-overseer-ring', shoulder: 'wpn-overseer-eye',
    },
    phases: [{ at: 0.5, damage: 1.25, evasion: 8, line: 'OBSERVATION COMPLETE. CORRECTION BEGINS.' }],
  },
  leviathan: {
    id: 'leviathan', name: 'Leviathan', ai: 'bruiser', sprite: 'boss-leviathan',
    partNames: { core: 'Hull', legs: 'Wheel', arms: 'Crane', head: 'Deck' },
    abilities: { carrier: { unit: BOMB_CRAWLER, every: 4 } },
    build: {
      head: 'head-leviathan', core: 'core-leviathan', arms: 'arms-leviathan', legs: 'legs-leviathan', generator: 'gen-leviathan',
      rightHand: 'wpn-leviathan-jaw', shoulder: 'wpn-leviathan-gun',
    },
    phases: [{ at: 0.5, damage: 1.25, line: 'ALL HANDS. SHE HAS BEEN SUNK BEFORE. RAMMING SPEED.' }],
  },

  // Meridian Mutual, Collections Division.
  'lien-drone': LIEN_DRONE,
  bailiff: {
    // It serves the writ and the clerks follow it: a fight with a Bailiff in it is fought to the last plate.
    id: 'bailiff', name: 'Bailiff', ai: 'gunner', sprite: 'enemy-bailiff', composed: true, leader: true,
    build: { ...AUDITOR, generator: 'gen-prism', rightHand: 'wpn-enemy-writ', leftHand: 'wpn-enemy-seizer' },
  },
  assessor: {
    id: 'assessor', name: 'Assessor', ai: 'bruiser', sprite: 'enemy-bailiff', composed: true, portrait: 'portrait-actuary',
    build: {
      ...AUDITOR, generator: 'gen-tidal', module: 'mod-barrier',
      rightHand: 'wpn-enemy-writ', leftHand: 'wpn-enemy-seizer', shoulder: 'wpn-enemy-decree',
    },
    // It puts the coil away and takes out the gavel.
    phases: [{ at: 0.5, refit: { leftHand: 'wpn-enemy-gavel' }, line: 'Valuation complete. You are worth more as parts.' }],
  },
  adjuster: {
    id: 'adjuster', name: 'The Adjuster', ai: 'sprayer', sprite: 'boss-adjuster', portrait: 'portrait-actuary',
    partNames: { core: 'Seal', legs: 'Base', arms: 'Scale', head: 'Mask' },
    abilities: { carrier: { unit: LIEN_DRONE, every: 4 } },
    build: {
      head: 'head-adjuster', core: 'core-adjuster', arms: 'arms-adjuster', legs: 'legs-adjuster', generator: 'gen-adjuster',
      module: 'mod-barrier', rightHand: 'wpn-adjuster-writ', leftHand: 'wpn-adjuster-lien', shoulder: 'wpn-adjuster-decree',
    },
    // It starts by going over every part of you. Each phase raises its barrier again and narrows its attention:
    // first to what is already damaged, then to the core, with a hail of small claims in place of the drain.
    phases: [
      { at: 0.66, ai: 'bruiser', damage: 1.1, line: 'Your objection has been noted. It changes nothing.' },
      { at: 0.33, ai: 'gunner', damage: 1.1, refit: { leftHand: 'wpn-adjuster-liquidation' }, line: 'Then we proceed to liquidation.' },
    ],
  },
  // The machine that casts the votes of the drowned: every disc it is hung with is a lamp check. A gavel that
  // unbalances, a volley of small votes, a motion that charges for a turn; its clerks arrive every fifth turn.
  // Losing, it stops counting and starts closing: the volley gives way to a drain.
  proxy: {
    id: 'proxy', name: 'The Proxy', ai: 'gunner', sprite: 'boss-proxy', portrait: 'portrait-actuary',
    partNames: { core: 'Urn', legs: 'Dais', arms: 'Gavel', head: 'Mask' },
    abilities: { carrier: { unit: LIEN_DRONE, every: 5 } },
    build: {
      head: 'head-proxy', core: 'core-proxy', arms: 'arms-proxy', legs: 'legs-proxy', generator: 'gen-proxy',
      module: 'mod-barrier', rightHand: 'wpn-proxy-gavel', leftHand: 'wpn-proxy-ballot', shoulder: 'wpn-proxy-motion',
    },
    phases: [
      { at: 0.66, ai: 'bruiser', damage: 1.1, line: 'The absent have voted. They are unanimous. They always are.' },
      { at: 0.33, ai: 'gunner', damage: 1.1, refit: { leftHand: 'wpn-proxy-closure' }, line: 'Then I move the closure. There will be no further business.' },
    ],
  },
};
