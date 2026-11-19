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
    fire: 'Fire', boost: 'Boost', guard: 'Guard', cool: 'Vent', module: 'Module', repair: 'Field Repair', auto: 'Auto Turn',
    endTurn: 'End Turn', retreat: 'Retreat',
  },
  /** What an action costs other than energy, said beside it in the list. */
  actionNotes: { repair: 'ends turn' },
  retreat: { question: 'Retreat? The contract is lost.', no: 'No', yes: 'Yes' },
  parts: { core: 'Core', legs: 'Legs', arms: 'Arms', head: 'Head' } satisfies Record<FrameSlot, string>,
  meters: { energy: 'EN', heat: 'HEAT', ammo: 'AMMO', unlimited: '--', repairs: 'REPAIRS' },
  headings: {
    you: 'YOUR MECH', target: 'TARGET', weapons: 'WEAPONS', repair: 'REPAIR WHICH PART?', paint: 'MARK WHICH ENEMY?',
    // With more than one enemy to aim at: which one this is, and the buttons that go to the next.
    targetOf: (n: number, of: number) => `TARGET ${n}/${of}  L1/R1`,
  },
  preview: { hit: 'HIT', damage: 'DMG', all: 'ALL', kills: 'DESTROYS' },
  weaponMenu: {
    charge: 'CHARGE', ready: 'READY',
    reasons: {
      alreadyFired: 'fired', noAmmo: 'no ammo', noEnergy: 'no energy', weaponDisabled: 'arms destroyed', needsBoost: 'needs Boost',
      alreadyUsed: 'charged', notCharged: 'not charged', invalidTarget: 'no target',
    },
  },
  tags: {
    boost: 'BOOST', guard: 'GUARD', stagger: 'STAGGER', charged: 'CHARGED', charging: 'CHARGING', painted: 'PAINTED',
    barrier: (n: number) => `BARRIER ${n}`, fieldDown: 'FIELD DOWN', chaff: 'CHAFF', stability: 'STAB',
    fuse: (n: number) => `FUSE ${n}`, aegis: 'AEGIS', jammer: 'JAMMER', mender: 'MENDER', carrier: 'CARRIER', shaken: 'SHAKEN',
    covered: 'COVERED', jammed: (n: number) => `JAMMED -${n}`, ironSkin: 'IRON SKIN', deadeye: 'DEADEYE',
    // What sets an elite enemy apart.
    marks: { armoured: 'ARMOURED', overclocked: 'OVERCLOCKED', swift: 'SWIFT', shielded: 'SHIELDED' } as Record<string, string>,
  },
  // What an enemy is about to do, read from how it moves: shown with its tags while it is aimed at.
  intent: { aim: (part: string) => `AIMS ${part.toUpperCase()}`, dart: 'DARTING', mend: 'MENDING', cool: 'COOLING', windUp: 'WINDS UP' },
  objectives: {
    survive: (round: number, rounds: number) => `HOLD OUT ${round}/${rounds}`,
    protect: (name: string, hp: number, max: number) => `${name.toUpperCase()} ${hp}/${max}`,
    leader: (name: string) => `TARGET: ${name.toUpperCase()}`,
    disable: (name: string) => `DISABLE: ${name.toUpperCase()}`,
    driveOff: (name: string) => `DRIVE OFF: ${name.toUpperCase()}`,
    mark: 'TARGET',
    // Machines that are not on the field yet: on their own, and after whatever else the battle asks for.
    reserve: (n: number) => `${n} MORE TO COME`, more: (n: number) => `+${n}`,
    won: {
      survive: 'You held the line.', protect: (name: string) => `${name}: safe.`, leader: 'Their leader is down.',
      disable: 'Disabled, in one piece.', driveOff: (name: string) => `${name} breaks off.`,
    },
    lost: { asset: (name: string) => `${name}: lost.`, target: 'The target was destroyed.', time: 'Out of time.' },
    brief: {
      destroy: 'Destroy all hostiles', survive: (rounds: number) => `Hold out for ${rounds} rounds`,
      protect: (name: string) => `Protect: ${name}`, leader: (name: string) => `Destroy: ${name}`,
      disable: (name: string) => `Disable, do not destroy: ${name}`, driveOff: (name: string) => `Drive off: ${name}`,
      reserve: (more: number) => `${more} more come on as they fall`,
    },
  },
  // `open` is on the banner of a battle against ordinary machines: the rule that holds there, by the name the manual has it under.
  battleIntro: { warning: 'WARNING', destroy: 'DESTROY ALL HOSTILES', open: 'MOMENTUM' },
  yourTurn: (round: number) => `Round ${round} - your move`,
  hit: (weapon: string, target: string, part: string, damage: number) => `${weapon} hits ${obj(target)} - ${part} -${damage}`,
  miss: (weapon: string, target: string) => `${weapon} misses ${obj(target)}`,
  // A hit that took half of an ordinary machine's core in one blow, and so all of it.
  shatter: (weapon: string, target: string) => `${weapon} SHATTERS ${obj(target)}`,
  partDestroyed: (unit: string, part: string) => `${unit}: ${part} destroyed`,
  unitDestroyed: (unit: string) => does(unit, 'destroyed', 'are destroyed'),
  // A volley that destroyed something: its weapon may fire again this turn. From the second in a turn the run is counted.
  // What a kill gave back, as it is of use to the pilot: fired again, charged again, or not at all (the last round
  // went with it, a blade wants another Boost, nothing is left standing). `run` puts the count of the turn before it.
  momentum: {
    ready: (weapon: string) => `${weapon} ready again`, charge: (weapon: string) => `${weapon} can charge again`,
    empty: (weapon: string) => `${weapon} is empty`, boost: (weapon: string) => `${weapon} needs Boost again`,
    clear: 'Field clear',
    run: (chain: number, what: string) => (what ? `CHAIN x${chain} - ${what}` : `CHAIN x${chain}`),
  },
  // Two machines down in one turn: what still stands will leave when its turn comes, and then does.
  // A machine of the reserve comes on as a round begins; the last of them says so.
  arrive: (unit: string, left: number) => (left > 0 ? `${unit} comes on - ${left} more behind it` : `${unit} comes on - the last of them`),
  // Machines that come on together are said in one line.
  arriveMany: (count: number, left: number) => (left > 0 ? `${count} machines come on - ${left} more behind them` : `${count} machines come on - the last of them`),
  shaken: (unit: string) => `${unit} loses its nerve`,
  rout: (unit: string) => `${unit} breaks off`,
  // Of a machine that cannot move: it does not leave, it goes dark where it stands.
  shutdown: (unit: string) => `${unit} shuts down`,
  boost: (unit: string) => does(unit, 'boosts', 'boost'),
  guard: (unit: string) => does(unit, 'braces', 'brace'),
  stagger: (unit: string) => does(unit, 'is STAGGERED', 'are STAGGERED'),
  recover: (unit: string) => does(unit, 'steadies', 'steady'),
  // The field of a core that raises one: broken by what it took, and whole again a round later.
  fieldDown: (unit: string) => does(unit, 'loses its field', 'lose your field'),
  fieldUp: (unit: string) => does(unit, 'has its field back', 'have your field back'),
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
  mend: (unit: string, target: string, part: string, amount: number) => `${unit} patches ${obj(target)} - ${part} +${amount}`,
  fuse: (unit: string, left: number) => `${unit}: fuse ${left}`,
  blast: (unit: string, target: string, damage: number) => `${unit} DETONATES on ${obj(target)} -${damage}`,
  launch: (unit: string, spawned: string) => `${unit} launches ${spawned}`,
  phase: (unit: string) => `${unit} changes tactics`,
  // The pilot's Overdrive: a meter that fills in battle and buys one great move.
  overdrive: {
    heading: 'OVERDRIVE', ready: 'R1: OVERDRIVE', used: (name: string) => `OVERDRIVE: ${name.toUpperCase()}`,
    names: { 'second-wind': 'Second Wind', 'iron-skin': 'Iron Skin', deadeye: 'Deadeye' } as Record<string, string>,
    notes: {
      'second-wind': 'Spend your turn first, then it starts over: energy back; weapons, Vent and Module ready again. A Boost or Guard still up stays up. So does the heat.',
      'iron-skin': 'Until your next turn you take half damage and cannot be staggered.',
      deadeye: 'Until your turn ends every shot hits and does a quarter more.',
    } as Record<string, string>,
    how: 'The meter at the edge of the field fills as you land hits, take them and destroy machines. When it is full, press R1 on your turn.',
    // Said when R1 is pressed for a Second Wind before anything of the turn has been spent.
    spendFirst: 'Second Wind: spend your turn first.',
    // Announced in passing when the pilot's level opens one.
    opened: 'OVERDRIVE OPEN',
    level: (n: number) => `LV ${n}`, fitted: 'FITTED', hint: 'A: fit   L1/R1: page   B: back',
  },
  // What a hired wingman can be told, on the pilot's turn, for nothing.
  orders: {
    item: (order: 'strongest' | 'target' | 'cover') => ({ strongest: 'Wing: strongest', target: 'Wing: my target', cover: 'Wing: cover me' })[order],
    told: (name: string, order: 'strongest' | 'target' | 'cover') => ({
      strongest: `${name}: firing on the strongest.`, target: `${name}: firing where you fire.`, cover: `${name}: holding fire, drawing theirs.`,
    })[order],
  },
  support: (ally: string, target: string, damage: number) => `${ally} fires on ${obj(target)} -${damage}`,
  asset: (asset: string, hp: number, lost: number) => `${asset} takes fire -${lost} (${hp} left)`,
  cool: (unit: string, amount: number) => does(unit, `vents heat -${amount}`, `vent heat -${amount}`),
  repair: (unit: string, part: string, amount: number) => does(unit, `repairs ${part} +${amount}`, `repair ${part} +${amount}`),
  overheatPlayer: 'Overheated! Next turn lost',
  overheatWarning: 'Warning: this shot will overheat',
  overheat: (unit: string) => does(unit, 'overheats', 'overheat'),
  turnSkipped: (unit: string) => does(unit, 'is cooling down - turn lost', 'are cooling down - turn lost'),
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  hints: { result: 'Press A to continue' },
  // Said over the field in a new pilot's first battles: which button does what at this step.
  coach: {
    action: 'UP/DOWN: choose what to do   A: confirm',
    weapon: 'Pick a weapon with A.   B: go back',
    target: 'Pick the part to hit with A. The core kills.',
    repairPart: 'Pick the part to patch with A.   B: go back',
  },
  titleScreen: {
    tagline: 'Every contract pays. Not every pilot collects.',
    continue: 'Continue', newGame: 'New Game', loadGame: 'Load Game', options: 'Options',
    eraseQuestion: 'Start over? This erases that game.', eraseUnreadable: 'Overwrite what is kept there?', no: 'No', yes: 'Yes',
    unusable: 'Your saved game could not be read.',
    pickNew: 'START IN WHICH SLOT?', pickLoad: 'LOAD WHICH GAME?', empty: 'EMPTY', unreadable: 'UNREADABLE',
    slot: (n: number, callsign: string, level: number) => `${n}  ${callsign}  LV ${level}`,
    progress: (done: number, cycle: number, time: string) => `${done} done  ${cycle > 0 ? `C${cycle + 1}  ` : ''}${time}`,
  },
  // The frames a new pilot chooses between. Their figures go by the garage's own names.
  starter: { heading: 'CHOOSE A FRAME', hint: 'A: take this one   B: back', credits: 'Credits' },
  callsign: {
    heading: 'YOUR CALLSIGN', hint: 'A: pick   B: erase', del: 'DEL', ok: 'OK',
    rows: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ0', '123456789'],
  },
  // What each kind of ground does, for the briefing and for the field. The numbers are the rules' own; a test holds them to it.
  ground: {
    rain: { name: 'RAIN', note: 'all shed 4 more heat a turn' },
    furnace: { name: 'FURNACE HEAT', note: 'all shed 4 less heat a turn' },
    dust: { name: 'DUST', note: 'every shot is 5 less likely to hit' },
    flood: { name: 'FLOOD WATER', note: 'a boost dodges 6 less' },
    sealed: { name: 'SEALED VAULT', note: 'explosions do 15% less damage' },
    wind: { name: 'CROSSWIND', note: 'kinetic hits are 6 less likely' },
    clear: { name: 'CLEAR AIR', note: 'beams are 4 more likely to hit' },
  } as Record<string, { name: string; note: string }>,
  // The last line of an open contract's briefing: how many battles it is.
  board: {
    battles: (count: number) => (count === 1 ? 'One engagement. In and out.' : `${count} engagements back to back. Field service between them, nothing more.`),
  },
  // The Gauntlet: a run of battles in a stock frame that goes on until the pilot falls.
  gauntlet: {
    item: 'The Gauntlet', heading: 'THE GAUNTLET', client: 'The Gauntlet',
    title: (floor: number) => `Floor ${floor}`,
    floor: (floor: number) => `Floor ${floor}. Whatever is down here was put here to stop you.`,
    warden: (name: string) => `This floor has a warden: ${name}. Beat them and the house patches you up.`,
    debrief: 'Floor cleared.',
    pitch: ['A stock frame, for one run.', 'Each floor is harder and', 'has two doors: pick your', 'fight. After each, take', 'one thing on offer.', 'Wardens leave relics.', 'It ends when you fall,', 'and pays by how deep.'],
    // The two ways into an open floor, and what is said of the one that hides an elite.
    doors: ['Left door', 'Right door'], elite: 'ELITE', otherDoor: 'L1/R1: other door',
    relicHeading: 'THE WARDEN LEFT', revived: 'SPARE CORE SPENT',
    relics: {
      redline: { name: 'Redline Core', short: 'REDLINE', note: 'The frame gets an Overdrive: Second Wind. R1 when the meter is full.' },
      rig: { name: 'Salvage Rig', short: 'RIG', note: 'Twice as much armour is patched between floors.' },
      key: { name: 'Quartermaster Key', short: 'KEY', note: 'One more thing on offer after every floor.' },
      spare: { name: 'Spare Core', short: 'SPARE', note: 'Once, a floor lost is fought again in a whole mech.' },
      cannon: { name: 'Glass Cannon', short: 'CANNON', note: 'You deal 30% more damage. Your armour is 15% thinner.' },
      ledger: { name: 'Hazard Pay', short: 'PAY', note: 'The run pays half as much again.' },
    } as Record<string, { name: string; short: string; note: string }>,
    best: (n: number) => `BEST ${n}`, floorLabel: (n: number) => `FLOOR ${n}`, wardenLabel: 'WARDEN', armour: (pct: number) => `ARMOUR ${pct}%`,
    start: 'Start a run', descend: 'Descend', abandon: 'End the run', back: 'Back', yes: 'Yes, end it', no: 'No',
    abandonAsk: (pay: number) => `End it here for ${pay}?`,
    draftHeading: 'TAKE ONE', service: 'Full service', serviceNote: 'all armour restored',
    slot: (slot: string) => `fits: ${slot}`, replaces: 'replaces:', empty: 'an empty mount',
    boons: {
      capacitor: { name: 'Capacitor', short: 'CAP', note: '+15 energy a turn' }, heatsinks: { name: 'Heat sinks', short: 'SINK', note: '+6 cooling a turn' },
      plating: { name: 'Plating', short: 'PLATE', note: '+8% armour' }, optics: { name: 'Optics', short: 'OPTIC', note: '+4 aim' },
      patchkit: { name: 'Patch kit', short: 'PATCH', note: '+1 repair a floor' },
    },
    over: 'RUN OVER', cleared: (n: number) => (n === 1 ? '1 floor cleared' : `${n} floors cleared`), paid: (n: number) => `Paid ${n}`, record: 'A new best.',
    hint: 'A: choose   B: back', expected: 'EXPECTED',
    slots: {
      head: 'head', core: 'core', arms: 'arms', legs: 'legs', generator: 'generator', booster: 'booster', fcs: 'fire control', module: 'module',
      rightHand: 'right hand', leftHand: 'left hand', shoulder: 'shoulder',
    } as Record<string, string>,
  },
  hub: {
    heading: 'HEADQUARTERS', contractsItem: 'Contracts', arena: 'Arena', garage: 'Garage', shop: 'Shop', pilot: 'Pilot',
    messages: 'Messages', database: 'Database', training: 'Training', options: 'Options', cycle: 'New Cycle', archive: 'Archive', noRank: '-', bestRank: 'best rank',
    credits: 'CREDITS', battlesWon: 'CONTRACTS WON', level: (n: number) => `LV ${n}`, contracts: 'CONTRACTS', reward: 'pays',
    unread: (n: number) => `${n} new`, points: (n: number) => (n === 1 ? '1 point' : `${n} points`),
    locked: 'Locked', opensAfter: (title: string) => `after ${title}`, campaignDone: 'The war is over. The work is not.',
    cycleLabel: (n: number) => `CYCLE ${n + 1}`,
    // What starting over keeps, and what the cycle that would begin changes: tougher enemies and better pay up to the third
    // telling, a step more at the bench up to the fourth.
    cycleQuestion: (next: number): string[] => ['Start the war again?', 'You keep credits, parts,', 'level, perks and arena rank.',
      ...(next <= 2 ? ['Tougher enemies, better pay,', 'one more step at the bench.']
        : next === 3 ? ['Enemies are as tough as now.', 'The bench has one step left.']
          : ['Enemies are as tough as now,', 'and the pay is the same.'])],
    no: 'No', yes: 'Yes',
  },
  arena: {
    heading: 'ARENA', client: 'Arena Office', win: 'The crowd got what it paid for. So did you.',
    rank: (n: number) => `RANK ${n}`, purse: 'PURSE', rematch: 'REMATCH',
    next: 'NEXT OPPONENT', beaten: 'BEATEN', locked: 'LOCKED', champion: 'You are the champion of Varn.',
    yourRank: (n: number, of: number) => (n === 0 ? 'UNRANKED' : `YOUR RANK ${n}/${of}`), fight: 'ARENA FIGHT', back: 'A: challenge   B: back',
    apex: 'There is nobody left to beat. The back room drinks to you.',
    // The cups: three of the ladder back to back.
    cups: {
      tag: 'ARENA CUP: three fights, no rest',
      names: { 'cup-bronze': 'Bronze Cup', 'cup-silver': 'Silver Cup', 'cup-gold': 'Gold Cup' } as Record<string, string>,
      briefing: (names: string[]) => [
        `Three fights back to back: ${names[0]}, then ${names[1]}, then ${names[2]}.`,
        'Field service between them and nothing more. What you lose in the first you miss in the third.',
      ],
      style: (names: string[]) => `${names.join(', ')}: one after the other, with only field service between. The purse is paid for all three or not at all.`,
      locked: (name: string) => `The office enters pilots who have beaten ${name} on the ladder.`,
      won: 'WON', open: 'OPEN',
    },
    mirror: {
      title: 'Mirror Match', name: 'Echo', taunt: 'After you.',
      style: 'The house pilot flies a copy of your mech as it stands today, part for part, tuned a little hotter. Whatever you bring, it brings.',
      locked: 'The office offers this to pilots of the third rank and up.',
    },
  },
  pilot: {
    heading: 'PILOT', level: 'LEVEL', xp: 'XP', next: 'NEXT LEVEL', maxLevel: 'MAX LEVEL', points: 'PERK POINTS',
    hint: 'A: spend a point   L1/R1: page   B: back', pageHint: 'L1/R1: page   B: back',
    noPoints: 'No perk points. Win contracts to level up.', maxed: 'This perk is at its highest rank.',
    pages: { perks: 'PERKS', drive: 'DRIVE', medals: 'MEDALS', record: 'RECORD', classes: 'CLASS' },
  },
  // What kind of machine a build is: what each kind is called, what makes one, what it is good at, and one to try.
  classes: {
    heading: 'A MACHINE IS THE FIRST OF THESE IT FITS', won: 'WON', yours: 'YOURS NOW',
    names: {
      duellist: 'Duellist', marksman: 'Sharpshooter', artillery: 'Artillery', lancer: 'Lancer', bastion: 'Bastion', skirmisher: 'Skirmisher',
      allrounder: 'All-rounder',
    },
    // What makes one. The figures are the rules' own; a test holds them to it.
    rules: {
      duellist: 'A blade in either hand', marksman: 'A weapon that has to charge', artillery: 'A salvo on the shoulder',
      lancer: 'Two weapons or more, all energy', bastion: 'A shield, or legs of MOB 18 or less', skirmisher: 'Legs of MOB 40 or more',
      allrounder: 'Anything else',
    },
    // What it is good at, in a few words: said in the garage, after the name.
    tags: {
      duellist: 'boosts in and strikes', marksman: 'one great shot at a time', artillery: 'fire on the whole field',
      lancer: 'beams that never run dry', bastion: 'takes it and stays standing', skirmisher: 'hard to hit, quick to act',
      allrounder: 'no weakness, no speciality',
    },
    notes: {
      duellist: 'Closes in on a boost and strikes with a blade: a heavy blow every turn, and it never runs dry. Every strike needs a boost first.',
      marksman: 'Charges in one turn and fires in the next: one great shot that takes a part off or breaks a field. Slow to answer a crowd.',
      artillery: 'One salvo is fired at every machine on the field. Made for swarms and escorts. Carry good guns beside it: one heavy machine barely notices.',
      lancer: 'Nothing to reload and no bill for a shot. Hot and hungry: heat and the generator are its limits. Thermal and drain weapons cook and starve the other machine.',
      bastion: 'Takes the blow and stays standing: a shield to guard behind, or legs that carry the heaviest plate. It is not built to dodge.',
      skirmisher: 'Hard to hit and first to act: it boosts, shoots and is gone. Thin plate: what does land, lands hard.',
      allrounder: 'Does every job and owns none of them: room for a gun of each sort, and an answer to most things.',
    },
    garage: (name: string, tag: string) => `${name.toUpperCase()}: ${tag}`,
    // A build of the kind under the cursor that the shop can supply now, and what of it is still to be bought.
    advice: 'ONE TO FLY NOW', owned: 'You own all of it', toBuy: (credits: number) => `Still to buy: ${credits} c`,
    unsold: 'Not all of it is sold yet',
  },
  medals: {
    heading: 'MEDALS', earned: 'MEDAL EARNED', earnedMany: 'MEDALS EARNED', count: (n: number) => `${n} medals`, pay: (credits: number) => `+${credits} c`, held: 'EARNED', pays: (credits: number) => `Pays ${credits} c`,
    secretName: '? ? ?', secretText: 'A turn of the story.',
  },
  record: {
    contracts: 'CONTRACTS WON', lost: 'CONTRACTS LOST', retreats: 'WALKED AWAY', flawless: 'WITHOUT A SCRATCH',
    kills: 'ENEMIES DESTROYED', parts: 'PARTS SHOT OFF', staggers: 'STAGGERS', bombs: 'BOMBS DEFUSED', bosses: 'BOSSES BEATEN',
    sRanks: 'S RANKS', arena: 'ARENA RANK', shots: 'SHOTS FIRED', hits: 'SHOTS LANDED', accuracy: 'ACCURACY',
    damage: 'ARMOUR SHOT OFF', taken: 'ARMOUR LOST', overheats: 'TURNS LOST TO HEAT', rounds: 'ROUNDS FOUGHT',
    earned: 'CREDITS EARNED', medals: 'MEDALS', cycle: 'CYCLE', time: 'TIME PLAYED', none: '-', ranksHeld: 'RANKS HELD',
  },
  // The name a pilot's record has earned: five of them, each with what it means to the other side.
  renown: {
    names: ['Line Item', 'Write-Off', 'Total Loss', 'Act of God', 'The Last Invoice'],
    notes: [
      'Somebody has a row for you in a budget.',
      'They enter as lost whatever they send at you.',
      'Nobody quotes for a site you are near.',
      'Meridian files you under weather.',
      'Nobody sends the next one.',
    ],
    label: 'KNOWN AS', none: 'no name yet', earned: 'YOU HAVE A NAME',
    renown: (have: number) => `RENOWN ${have}`, towards: (have: number, next: number) => `RENOWN ${have}/${next}`,
    // Under the contract's name as a battle opens, and in the message bar where the machines are ordinary ones.
    banner: (callsign: string, name: string) => `${callsign}, ${name}`, opening: (name: string, note: string) => `${name}. ${note}`,
  },
  database: {
    heading: 'DATABASE', pages: { units: 'UNITS', people: 'PEOPLE', world: 'WORLD', finds: 'FOUND', manual: 'MANUAL', music: 'MUSIC' }, hint: 'L1/R1: page   B: back',
    // What has been found: papers and brass lamp checks. One not found has a clue where its text will be.
    found: (n: number, of: number) => `FOUND ${n}/${of}`, checks: (n: number) => `LAMP CHECKS ${n}`, check: 'Check', notFound: 'Not found yet.',
    findToast: 'FOUND', newFinds: (n: number) => `${n} new finds`,
    // The people of Varn the pilot has come across.
    known: (n: number, of: number) => `KNOWN ${n}/${of}`, broughtIn: 'Brought in',
    // The jukebox: the songs heard so far, to be played again.
    heard: (n: number, of: number) => `HEARD ${n}/${of}`, notHeard: 'Not heard so far.', play: 'A: play', stop: 'A: stop', playing: 'NOW PLAYING',
    length: (time: string) => `LENGTH ${time}`, tempo: (bpm: number) => `TEMPO ${bpm}`, musicOff: 'Music is off. Turn it on in Options to hear this.',
    unknown: '? ? ?', notMet: 'Not met yet.', met: (n: number, of: number) => `SEEN ${n}/${of}`,
    entries: (n: number, of: number) => `ENTRIES ${n}/${of}`, topics: (n: number) => `${n} TOPICS`,
    armour: 'ARMOUR', weak: 'WEAK TO', strong: 'TOUGH VS', none: '-',
    weapon: (name: string, type: string) => `${name} (${type})`,
    aegis: (share: number) => `Covers the rest: -${share}% damage`,
    mend: (share: number) => `Mends ${share}% of a part a turn`,
    jam: (aim: number) => `Jams your aim: -${aim}`,
    bomb: (fuse: number, damage: number) => `Goes off on turn ${fuse}: ${damage} damage`,
    carrier: (unit: string, every: number) => `Launches ${unit}, every ${every} turns`,
    phases: (n: number) => `Changes tactics ${n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`}`,
    toast: 'DATABASE', newEntries: (n: number) => `${n} new entries`,
  },
  training: {
    heading: 'TRAINING', client: 'Training Simulator', pays: 'PAYS', passed: 'PASSED', locked: 'LOCKED', open: 'OPEN',
    count: (n: number, of: number) => `PASSED ${n}/${of}`, hint: 'A: briefing   B: back',
    lockedNote: 'The simulator opens this drill once Dispatch has finished introducing you.',
    tag: 'TRAINING: a lent mech in the simulator. It costs nothing.',
    won: 'DRILL PASSED', lost: 'DRILL FAILED',
    // The simulator's second page: the pilot's own build against any machine met, for nothing.
    pages: { drills: 'DRILLS', range: 'TEST RANGE' },
    rangeTitle: 'Test Range',
    rangeBriefing: (fielded: string) => `The simulator fields ${fielded} against your own machine, as the book has it and as hard as the game is set.`,
    rangeFree: 'Nothing here is billed, paid or counted. Afterwards you see what a real flight would have cost.',
    rangeDebrief: 'The simulator resets. Your machine is as it was.',
    rangeTag: 'RANGE: your own mech in the simulator. Nothing is billed or counted.',
    rangeWon: 'RANGE CLEARED', rangeLost: 'SHOT DOWN',
    rangeEmpty: 'Nothing met yet. Fly a contract and come back.',
    rangeHint: 'LEFT/RIGHT: how many   A: briefing   B: back',
    rangeCount: (n: number) => `x${n}`,
    // Where a contract's briefing says what it pays.
    rangePays: 'FREE',
  },
  credits: {
    flownBy: 'FLOWN BY', level: (n: number) => `PILOT LEVEL ${n}`, record: 'THE RECORD', stat: (label: string, value: string) => `${label}  ${value}`,
    cast: 'IN VARN', unknown: '? ? ?', notMet: 'on a road not taken',
    names: {
      dispatch: 'Dispatch', brenn: 'Director Brenn', varga: 'Analyst Varga', tamsin: 'Tamsin', ashfall: 'Ashfall', sable: 'Sable',
      rook: 'Rook', krell: 'Krell', actuary: 'The Actuary',
    },
    roles: {
      dispatch: 'who found you the work', brenn: 'Hadron Mining', varga: 'Lumen Systems', tamsin: 'The Undertow',
      ashfall: 'a licensed pilot', sable: 'Lumen\'s best', rook: 'the Undertow\'s champion', krell: 'Hadron\'s strike-breaker',
      actuary: 'Meridian Mutual',
    },
    again: 'THE WAR CAN BE FOUGHT AGAIN', cycle: 'New Cycle, at headquarters', thanks: 'THANK YOU FOR FLYING', skip: 'A: skip',
  },
  options: {
    heading: 'OPTIONS', sfx: 'Sound Effects', music: 'Music', rumble: 'Rumble', fastBattles: 'Fast Battles', difficulty: 'Difficulty',
    credits: 'End Roll', watch: 'Watch', title: 'Quit to Title',
    language: 'Language', languages: { en: 'English', nl: 'Nederlands' },
    textSpeed: 'Text Speed', textSpeeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast', instant: 'Instant' },
    calm: 'Screen Effects', full: 'Full', calmed: 'Calm', calmHelp: 'Calm: no shaking, no flashes, a still camera.',
    // How much glow, haze and shadow is drawn. Auto is the game deciding: all of it while the handheld keeps up.
    detail: 'Light Effects', details: { auto: 'Auto', full: 'Full', lean: 'Reduced', bare: 'Off' },
    detailAuto: { lean: 'Auto: reduced', bare: 'Auto: off' },
    detailHelp: 'Auto: less glow if the handheld cannot keep up.',
    swapAB: 'A/B Buttons', normal: 'Normal', swapped: 'Swapped', swapHelp: 'Swap them if B confirms on your handheld.',
    unsaved: 'Not saved', unsavedHelp: 'The last change could not be saved. A again: quit.',
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
    finale: 'THE LAST MOVE OF THE WAR', repeatable: 'STANDING CONTRACT', open: 'OPEN CONTRACT', openElite: 'OPEN CONTRACT: AN ELITE', swarm: 'OPEN CONTRACT: A SWARM',
    verdict: 'VERDICT: your answer ends the story. Every other offer is withdrawn.',
    replay: 'ARCHIVE: pays less. Nothing in the story changes.',
    lent: 'LENT MECH: yours cannot deploy. The bill is still yours.',
    // A second pilot for the contract: the row in the briefing's menu, and what they cost.
    wingman: 'Wingman', alone: 'None', wingmanShare: (percent: number) => `-${percent}% fee`,
    wingmanHint: 'LEFT/RIGHT: choose a wingman',
    aloneText: 'Fly it alone and keep the whole fee.',
    wingmanTerms: (damage: number, percent: number) => `Up to ${damage} a round from round 2. Takes ${percent}% of fee and XP.`,
    // The build the contract is taken in: the row in the briefing's menu, which build it is, and how to turn to another.
    build: 'Build', buildOnFloor: 'CURRENT BUILD', buildSaved: (slot: number) => `SAVED BUILD ${slot}`,
    buildHint: 'LEFT/RIGHT: another build', buildNone: 'Save builds in the Garage to choose one here.',
    // How the contract is likely to go in that build: what the game's own pilot wins of it, flight by flight as it is counted.
    odds: (won: number, played: number) => `ODDS ${won}/${played}`, oddsWait: 'ODDS ..',
    oddsNote: 'this contract flown on Auto Turn',
    // An open contract that asks for a class of machine: the line under its client, and each class as it is asked for.
    asks: (wanted: string, percent: number) => `WANTS ${wanted}: +${percent}% PAY`,
    // After it, while another build is chosen: which of the pilot's saved builds is of that class.
    asksBuild: (slot: number) => `(BUILD ${slot})`,
    wanted: {
      duellist: 'A DUELLIST', marksman: 'A SHARPSHOOTER', artillery: 'ARTILLERY', lancer: 'A LANCER', bastion: 'A BASTION',
      skirmisher: 'A SKIRMISHER', allrounder: 'AN ALL-ROUNDER',
    },
    lentNote: 'Your own mech cannot deploy as it stands, so Dispatch lends you a stock frame for this one. Put yours right in the Garage; until then this is the work there is.',
    support: (name: string) => `Fire support: ${name}`,
    // In a later telling some contracts can be flown for the other side: the row in the menu, and the line under the client.
    otherOffer: 'Other offer', firstOffer: 'First offer',
    twoOffers: 'TWO OFFERS: the same night, from both sides. You can fly one.',
    otherTag: 'THE OTHER OFFER: taking it is remembered.',
  },
  mission: {
    engagement: (i: number, n: number) => `ENGAGEMENT ${i}/${n}`,
    next: 'Press A for the next engagement',
  },
  messagesScreen: { heading: 'MESSAGES', isNew: 'NEW', from: 'FROM', empty: 'No messages', back: 'B: back' },
  ending: { continue: 'Press A to return to headquarters' },
  scene: { continue: 'Press A to continue', yourCall: 'YOUR CALL', answer: 'UP/DOWN: choose   A: answer. It stands.' },
  settlement: {
    won: 'CONTRACT COMPLETE', lost: 'CONTRACT FAILED', reward: 'Reward', ammo: 'Ammunition', repairs: 'Repairs',
    rank: 'RANK', rankBonus: (rank: string) => `Rank ${rank} bonus`,
    // What a contract that asked for a class paid on top to a pilot who won it as one: the row is the class by its name.
    askBonus: (name: string) => `${name} bonus`,
    net: 'NET', balance: 'BALANCE', continue: 'Press A to continue',
    // On the bill of a fight on the range, where the net stands on one that is paid: what it would have come to.
    wouldCost: 'WOULD HAVE COST',
    relief: (credits: number) => `Debt limit reached: ${credits} written off`,
  },
  /** What Dispatch says after a lost battle; `adviceAfter` picks which. Each fits three lines of the settlement. */
  advice: {
    disable: 'The machine was wanted in one piece. Aim at its legs and arms; leave the core alone.',
    protect: 'It loses a point a round for every hostile still standing. Thin them out, weakest first.',
    heat: 'You overheated and lost a turn. Vent before the heat bar passes 100.',
    stance: 'You never used Boost or Guard. Boost makes you hard to hit; Guard blunts what lands.',
    repairs: 'You went down with field repairs unused. A repair ends your turn: fire, then patch.',
    time: 'The fight ran out of time. Bring more firepower, and aim at what the contract names.',
    patrol: 'Short of parts? The patrol always pays, and a second weapon changes most fights.',
    drills: 'The drills under Training teach one trick each, in a mech lent for the purpose.',
    auto: 'Auto Turn plays a turn for you. Watch what it does with the same mech.',
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
    loadouts: 'SAVED BUILDS', emptyLoadout: 'Empty', load: 'Load', save: 'Save current build', clear: 'Clear', backItem: 'Back',
    missing: (name: string) => `Missing: ${name}`,
    slotTags: {
      head: 'HEAD', core: 'CORE', arms: 'ARMS', legs: 'LEGS', generator: 'GEN', booster: 'BOOST', fcs: 'FCS', module: 'MOD',
      rightHand: 'R.HAND', leftHand: 'L.HAND', shoulder: 'SHLDR',
    },
    // The bench: a part made a step better for credits.
    toBench: 'R1: THE BENCH', bench: 'THE BENCH', benchStep: (step: number, cap: number) => `Step ${step} of ${cap}`,
    tune: (step: number) => `Tune to +${step}`, benchCost: (cost: number) => `${cost} c`, benchCredits: (credits: number) => `You have ${credits} c`,
    benchFigures: { armour: 'Armour', damage: 'Damage', output: 'Output' },
    benchAtLimit: 'No further this cycle', benchAtEnd: 'As far as it goes', benchShort: 'Not enough credits',
  },
  shop: {
    heading: 'SHOP', buy: 'BUY', sell: 'SELL', credits: 'c',
    tabs: {
      head: 'Head', core: 'Core', arms: 'Arms', legs: 'Legs', generator: 'Gen', booster: 'Bst', fcs: 'FCS', module: 'Mod',
      hand: 'Hand', shoulder: 'Shldr',
    },
    bought: (name: string) => `Bought ${name}`,
    sold: (name: string, price: number) => `Sold ${name} +${price}`,
    cannotAfford: 'Not enough credits', inUse: 'In use', nothingToSell: 'Nothing to sell here',
    lastWeapon: 'Last weapon', needWeapon: 'You need at least one weapon',
    hint: 'A trade  L1/R1 category  LEFT/RIGHT buy/sell list  B back', fitHint: 'Fit it in the Garage.',
  },
  partInfo: {
    ap: 'AP', resist: 'RES K/E/X', weight: 'WT', drain: 'DRAIN', aim: 'AIM', capacity: 'LOAD', mobility: 'MOB',
    output: 'OUTPUT', cooling: 'COOLING', damage: 'DMG', accuracy: 'ACC', energy: 'EN', heat: 'HEAT', ammo: 'AMMO',
    impact: 'IMP', unlimited: 'unlimited', perShot: '/shot',
    thrust: 'THRUST', boostCost: 'BOOST COST', aimByType: 'AIM K/E/X', focus: 'FOCUS', uses: 'USES',
    guard: (blocked: number) => `GUARD: blocks ${blocked}%`, guardShort: 'GUARD',
    versus: (name: string) => `VS ${name}`,
    charge: 'CHARGE: fires a turn later', melee: 'MELEE: spends your Boost',
    // What a part of a frame does that no other part does: a core's field, and arms that strike and are gone again.
    field: (n: number) => `FIELD: absorbs ${n} a round`, fieldBreak: 'Broken, it is down a turn',
    poise: 'POISE: 1 blade keeps Boost',
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
    miss: 'MISS', overheat: 'OVERHEAT', stagger: 'STAGGER', shaken: 'SHAKEN', block: (n: number) => `BLOCK ${n}`,
    fieldDown: 'FIELD DOWN', fieldUp: 'FIELD UP',
    // Over a machine that went up to far more than was needed, over the pilot as a run goes on, over a machine that leaves.
    overkill: 'OVERKILL', chain: (n: number) => `CHAIN x${n}`, rout: 'ROUT', offline: 'OFFLINE',
    phase: (n: number) => `PHASE ${n}`,
    modules: {
      coolant: 'COOLANT', barrier: 'BARRIER', overclock: 'OVERCLOCK', painter: 'PAINTED', nanites: 'NANITES', shock: 'SHOCK',
      chaff: 'CHAFF', limiter: 'LIMITER',
    },
  },
  debug: { title: 'INPUT', action: 'action', key: 'key', screen: 'screen', pace: 'pace', light: 'light', error: 'error', close: 'START: close', none: '-' },
} as const;
