import type { FrameSlot } from '../core/types';

/** The name battles give the player's own mech. */
export const PLAYER_NAME = 'You';
/** "You boost" but "Halo Guard boosts": the verb form that goes with the unit's name. */
const does = (unit: string, they: string, you: string): string => `${unit} ${unit === PLAYER_NAME ? you : they}`;
/** The unit's name where it is the one acted on: "hits you", "hits Halo Guard". */
const obj = (unit: string): string => (unit === PLAYER_NAME ? 'you' : unit);

/** All player-facing text. UI code never contains literal copy. */
export const STRINGS = {
  title: 'IRONWAGE',
  actions: {
    fire: 'Fire', boost: 'Boost', guard: 'Guard', cool: 'Cool', module: 'Module', repair: 'Field Repair', auto: 'Auto Turn',
    endTurn: 'End Turn', retreat: 'Retreat',
  },
  retreat: { question: 'Retreat? The contract is lost.', no: 'No', yes: 'Yes' },
  parts: { core: 'Core', legs: 'Legs', arms: 'Arms', head: 'Head' } satisfies Record<FrameSlot, string>,
  meters: { energy: 'EN', heat: 'HEAT', ammo: 'AMMO', unlimited: '--', repairs: 'REPAIRS' },
  headings: { you: 'YOUR MECH', target: 'TARGET', weapons: 'WEAPONS', repair: 'REPAIR WHICH PART?', paint: 'MARK WHICH ENEMY?' },
  preview: { hit: 'HIT', damage: 'DMG', all: 'ALL' },
  weaponMenu: {
    charge: 'CHARGE', ready: 'READY',
    reasons: {
      alreadyFired: 'fired', noAmmo: 'no ammo', noEnergy: 'no energy', weaponDisabled: 'arms destroyed', needsBoost: 'needs Boost',
      alreadyUsed: 'charged', notCharged: 'not charged', invalidTarget: 'no target',
    },
  },
  tags: {
    boost: 'BOOST', guard: 'GUARD', stagger: 'STAGGER', charged: 'CHARGED', charging: 'CHARGING', painted: 'PAINTED',
    barrier: (n: number) => `BARRIER ${n}`, chaff: 'CHAFF', stability: 'STAB',
  },
  yourTurn: (round: number) => `Round ${round} - your move`,
  hit: (weapon: string, target: string, part: string, damage: number) => `${weapon} hits ${obj(target)} - ${part} -${damage}`,
  miss: (weapon: string, target: string) => `${weapon} misses ${obj(target)}`,
  partDestroyed: (unit: string, part: string) => `${unit}: ${part} destroyed`,
  unitDestroyed: (unit: string) => does(unit, 'destroyed', 'are destroyed'),
  boost: (unit: string) => does(unit, 'boosts', 'boost'),
  guard: (unit: string) => does(unit, 'braces', 'brace'),
  stagger: (unit: string) => does(unit, 'is STAGGERED', 'are STAGGERED'),
  recover: (unit: string) => does(unit, 'steadies', 'steady'),
  charge: (unit: string, weapon: string) => does(unit, `charges ${weapon}`, `charge ${weapon}`),
  barrierHit: (weapon: string, target: string, absorbed: number) => `${weapon} hits ${obj(target)} - barrier -${absorbed}`,
  module: {
    coolant: (unit: string, amount: number) => does(unit, `flushes coolant -${amount} heat`, `flush coolant -${amount} heat`),
    barrier: (unit: string, amount: number) => does(unit, `raises a barrier ${amount}`, `raise a barrier ${amount}`),
    overclock: (unit: string, amount: number) => does(unit, `overclocks +${amount} EN`, `overclock +${amount} EN`),
    painter: (unit: string, _amount: number, target: string) => does(unit, `paints ${obj(target)}`, `paint ${obj(target)}`),
    nanites: (unit: string, amount: number) => does(unit, `runs nanites +${amount} armour`, `run nanites +${amount} armour`),
    shock: (unit: string) => does(unit, 'fires a shock pulse', 'fire a shock pulse'),
    chaff: (unit: string) => does(unit, 'scatters chaff', 'scatter chaff'),
    limiter: (unit: string) => does(unit, 'releases the limiter', 'release the limiter'),
  },
  cool: (unit: string, amount: number) => does(unit, `vents heat -${amount}`, `vent heat -${amount}`),
  repair: (unit: string, part: string, amount: number) => does(unit, `repairs ${part} +${amount}`, `repair ${part} +${amount}`),
  overheatPlayer: 'Overheated! Next turn lost',
  overheatWarning: 'Warning: this shot will overheat',
  overheat: (unit: string) => does(unit, 'overheats', 'overheat'),
  turnSkipped: (unit: string) => does(unit, 'is cooling down - turn lost', 'are cooling down - turn lost'),
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  hints: { result: 'Press A to continue' },
  titleScreen: {
    tagline: 'Every contract pays. Not every pilot collects.',
    continue: 'Continue', newGame: 'New Game', options: 'Options', eraseQuestion: 'Start over? This erases your save.', no: 'No', yes: 'Yes',
    unusable: 'Your saved game could not be read.',
  },
  hub: {
    heading: 'HEADQUARTERS', contractsItem: 'Contracts', arena: 'Arena', garage: 'Garage', shop: 'Shop', pilot: 'Pilot',
    messages: 'Messages', options: 'Options', cycle: 'New Cycle',
    credits: 'CREDITS', battlesWon: 'BATTLES WON', level: 'PILOT LEVEL', contracts: 'CONTRACTS', reward: 'pays',
    unread: (n: number) => `${n} new`, points: (n: number) => (n === 1 ? '1 point' : `${n} points`),
    locked: 'Locked', campaignDone: 'The war is over. The work is not.',
    cycleLabel: (n: number) => `CYCLE ${n + 1}`,
    cycleQuestion: ['Start the war again?', 'You keep credits, parts,', 'level, perks and arena rank.', 'Enemies get tougher and', 'pay improves.'],
    no: 'No', yes: 'Yes',
  },
  arena: {
    heading: 'ARENA', client: 'Arena Office', win: 'The crowd got what it paid for. So did you.',
    rank: (n: number) => `RANK ${n}`, purse: 'PURSE', rematch: 'REMATCH',
    next: 'NEXT OPPONENT', beaten: 'BEATEN', locked: 'LOCKED', champion: 'You are the champion of Varn.',
    yourRank: (n: number) => (n === 0 ? 'UNRANKED' : `YOUR RANK ${n}/10`), fight: 'ARENA FIGHT', back: 'A: challenge   B: back',
  },
  pilot: {
    heading: 'PILOT', level: 'LEVEL', xp: 'XP', next: 'NEXT LEVEL', maxLevel: 'MAX LEVEL', points: 'PERK POINTS',
    hint: 'A: spend a point   B: back', noPoints: 'No perk points. Win contracts to level up.', maxed: 'This perk is at its highest rank.',
  },
  options: {
    heading: 'OPTIONS', sfx: 'Sound Effects', music: 'Music', fastBattles: 'Fast Battles', difficulty: 'Difficulty',
    on: 'On', off: 'Off',
    difficulties: { story: 'Story', standard: 'Standard', veteran: 'Veteran' },
    difficultyHelp: {
      story: 'Enemies have 20% less armour and firepower.',
      standard: 'The game as it was balanced.',
      veteran: 'Enemies have 20% more armour and firepower.',
    },
    hint: 'A: change   B: back',
  },
  buildErrors: {
    overweight: 'Overweight', insufficientEnergy: 'Not enough energy', missingSlot: 'Missing part',
    wrongMount: 'Wrong mount', unknownPart: 'Unknown part', noWeapon: 'No weapon',
  },
  briefing: {
    accept: 'Accept', back: 'Back', reward: 'PAYS', engagements: (n: number) => (n === 1 ? '1 ENGAGEMENT' : `${n} ENGAGEMENTS`),
    hostiles: 'EXPECTED', exclusive: 'EXCLUSIVE: the other two clients will withdraw their offers.',
    finale: 'FINAL CONTRACT', repeatable: 'STANDING CONTRACT', open: 'OPEN CONTRACT',
  },
  mission: {
    engagement: (i: number, n: number) => `ENGAGEMENT ${i}/${n}`,
    next: 'Press A for the next engagement',
  },
  messagesScreen: { heading: 'MESSAGES', isNew: 'NEW', from: 'FROM', empty: 'No messages', back: 'B: back' },
  ending: { continue: 'Press A to return to headquarters' },
  settlement: {
    won: 'CONTRACT COMPLETE', lost: 'CONTRACT FAILED', reward: 'Reward', ammo: 'Ammunition', repairs: 'Repairs',
    net: 'NET', balance: 'BALANCE', continue: 'Press A to continue',
  },
  saveFailed: 'Could not save: storage is full or blocked',
  slots: {
    head: 'Head', core: 'Core', arms: 'Arms', legs: 'Legs', generator: 'Generator',
    booster: 'Booster', fcs: 'FCS', module: 'Module',
    rightHand: 'Right Hand', leftHand: 'Left Hand', shoulder: 'Shoulder',
  },
  garage: {
    heading: 'GARAGE', empty: 'Empty', none: '(none)', inUse: 'In use', fitted: '*',
    weight: 'Weight', energy: 'Energy', mobility: 'Mobility', armour: 'Armour', stability: 'Stability', cooling: 'Cooling',
    evasion: 'Boost evade', volley: 'Volley EN', back: 'B: back',
    factoryPaint: 'Factory', paint: (name: string) => `L1/R1 PAINT: ${name}`, toLoadouts: 'LEFT/RIGHT: SAVED BUILDS',
    loadouts: 'SAVED BUILDS', emptyLoadout: '(empty)', load: 'Load', save: 'Save current build', clear: 'Clear', backItem: 'Back',
    missing: (name: string) => `Missing: ${name}`,
    slotTags: {
      head: 'HEAD', core: 'CORE', arms: 'ARMS', legs: 'LEGS', generator: 'GEN', booster: 'BOOST', fcs: 'FCS', module: 'MOD',
      rightHand: 'R.HAND', leftHand: 'L.HAND', shoulder: 'SHLDR',
    },
  },
  shop: {
    heading: 'SHOP', buy: 'BUY', sell: 'SELL', credits: 'CR',
    tabs: {
      head: 'Head', core: 'Core', arms: 'Arms', legs: 'Legs', generator: 'Gen', booster: 'Bst', fcs: 'FCS', module: 'Mod',
      hand: 'Hand', shoulder: 'Shldr',
    },
    bought: (name: string) => `Bought ${name}`,
    sold: (name: string, price: number) => `Sold ${name} +${price}`,
    cannotAfford: 'Not enough credits', inUse: 'In use', nothingToSell: 'Nothing to sell here',
    lastWeapon: 'Last weapon', needWeapon: 'You need at least one weapon',
    hint: 'L1/R1 category   LEFT/RIGHT buy or sell   B back',
  },
  partInfo: {
    ap: 'AP', resist: 'RES K/E/X', weight: 'WT', drain: 'DRAIN', aim: 'AIM', capacity: 'LOAD', mobility: 'MOB',
    output: 'OUTPUT', cooling: 'COOLING', damage: 'DMG', accuracy: 'ACC', energy: 'EN', heat: 'HEAT', ammo: 'AMMO',
    impact: 'IMP', unlimited: 'unlimited', perShot: '/shot',
    thrust: 'THRUST', boostCost: 'BOOST COST', aimByType: 'AIM K/E/X', focus: 'FOCUS', uses: 'USES',
    guard: (blocked: number) => `GUARD: blocks ${blocked}%`, guardShort: 'GUARD',
    versus: (name: string) => `VS ${name}`,
    charge: 'CHARGE: fires a turn later', melee: 'MELEE: needs Boost',
    traits: {
      twin: () => 'TWIN: fires twice',
      pierce: () => 'PIERCE: halves resistance',
      thermal: (power: number) => `THERMAL: +${power} heat on target`,
      drain: (power: number) => `DRAIN: -${power} energy on target`,
      burst: (power: number) => `BURST: fires ${power} times`,
      salvo: () => 'SALVO: hits every enemy',
    },
    legTypes: {
      biped: '', reverse: 'REVERSE: boost +8 evasion', quad: 'QUAD: steady, shoulder +6',
      tank: 'TRACKS: no boost, guard 50%', hover: 'HOVER: cheap boost, unsteady',
    },
    modules: {
      coolant: (p: number) => `Vents ${p} heat at once.`,
      barrier: (p: number) => `Absorbs the next ${p} damage until your next turn.`,
      overclock: (p: number) => `+${p} energy this turn, +25 heat.`,
      painter: (p: number) => `Marks a target: +${p} to hit it for 3 turns.`,
      nanites: (p: number) => `Restores ${p}% armour on every working part.`,
      shock: (p: number) => `${p} impact and 15 damage to every enemy.`,
      chaff: (p: number) => `-${p} to hit you until your next turn.`,
      limiter: (p: number) => `+${p}% damage this turn, +30 heat.`,
    },
    types: { kinetic: 'Kinetic', energy: 'Energy', explosive: 'Explosive' },
    vendors: { undertow: 'The Undertow', lumen: 'Lumen Systems', hadron: 'Hadron Mining', freelance: 'Freelance' },
  },
  fx: {
    miss: 'MISS', overheat: 'OVERHEAT', stagger: 'STAGGER', block: (n: number) => `BLOCK ${n}`,
    modules: {
      coolant: 'COOLANT', barrier: 'BARRIER', overclock: 'OVERCLOCK', painter: 'PAINTED', nanites: 'NANITES', shock: 'SHOCK',
      chaff: 'CHAFF', limiter: 'LIMITER',
    },
  },
  debug: { title: 'INPUT', action: 'action', key: 'key', none: '-' },
} as const;
