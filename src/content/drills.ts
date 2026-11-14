import type { TalkLine } from '../core/campaign';
import type { Drill } from '../core/training';

const HALL = 'bg-arena';
/** The simulator talks in the plain terminal voice Dispatch uses when nobody is on the line. */
const sim = (at: TalkLine['at'], text: string): TalkLine => ({ at, who: 'Simulator', text });
const STOCK = { booster: 'bst-stock', fcs: 'fcs-stock' };
const STARTER_FRAME = { head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider' };

/**
 * The drills, in the order the training list shows them. Each is one battle in a lent mech and is
 * about one thing; the mech and the enemies are picked so that doing that thing wins it.
 */
export const DRILLS: Drill[] = [
  {
    id: 'drill-aim', title: 'Take It Apart', lesson: 'Aim at parts', after: 'start', scale: 0.8,
    briefing: [
      'A shot is aimed at a part. The core is the easiest to hit and the only one that kills. Legs gone, a mech cannot dodge. Arms gone, it cannot use its hands.',
      'This one we want back in one piece. Take off its legs and its arms and leave the core alone.',
    ],
    debrief: 'Disabled, not destroyed. Some clients pay for exactly that.',
    build: {
      head: 'head-halo', core: 'core-hauler', arms: 'arms-halo', legs: 'legs-strider', generator: 'gen-prism',
      booster: 'bst-stock', fcs: 'fcs-surgeon', rightHand: 'wpn-marksman', leftHand: 'wpn-pulse-carbine',
    },
    battle: {
      enemies: ['light-mech'], background: HALL, objective: { type: 'disable', target: 0 },
      talk: [
        sim('start', 'Fire, pick a weapon, then pick a part with up and down. Legs first: it is quick, and without them it cannot dodge.'),
        sim(2, 'This fire control aims at limbs as well as it aims at a core. Most do not: watch the hit chance change as you move down the list.'),
      ],
    },
  },
  {
    id: 'drill-heat', title: 'Heat Discipline', lesson: 'Heat and venting', after: 'start', scale: 2,
    briefing: [
      'Every shot makes heat. Your generator sheds some at the end of each turn. Pass 100 and you overheat: your next turn is lost, and you stand there while they shoot.',
      'This mech carries three hot weapons and a generator that cannot cool all of them. Fire what the bar allows, and vent when it climbs.',
    ],
    debrief: 'Cool and still shooting. Heat is a budget like any other.',
    build: {
      ...STARTER_FRAME, legs: 'legs-ronin', ...STOCK, generator: 'gen-tidal',
      rightHand: 'wpn-thermal-lance', leftHand: 'wpn-plasma', shoulder: 'wpn-halo-array',
    },
    battle: {
      enemies: ['heavy-mech'], background: HALL,
      talk: [
        sim('start', 'The amber bar is heat. The weapon list says what each shot adds. Vent sheds heat at once for a fifth of your energy.'),
        sim(3, 'A turn lost to heat is a turn you cannot guard in. The enforcer is counting on it.'),
      ],
    },
  },
  {
    id: 'drill-boost', title: 'Do Not Be There', lesson: 'Boost to dodge', after: 'start', scale: 2,
    briefing: [
      'Boost makes you much harder to hit until your next turn. A light mech with good thrusters lives on it.',
      'You cannot win this one by shooting. Last five rounds.',
    ],
    debrief: 'Five rounds and most of your armour. The best armour is not being where the shot lands.',
    build: {
      head: 'head-wraith', core: 'core-wraith', arms: 'arms-wraith', legs: 'legs-wraith', generator: 'gen-tidal',
      booster: 'bst-phase', fcs: 'fcs-stock', rightHand: 'wpn-arc-pistol',
    },
    battle: {
      enemies: ['heavy-mech', 'tank', 'gun-turret'], background: HALL, objective: { type: 'survive', rounds: 5 },
      talk: [
        sim('start', 'Boost first, every turn, then spend what is left. The round counter is at the top of the field.'),
      ],
    },
  },
  {
    id: 'drill-guard', title: 'Brace', lesson: 'Guard against what is coming', after: 'intro-2', scale: 1.5,
    briefing: [
      'Guard costs a fifth of your energy and stops a good part of every hit until your next turn. A shield in the left hand stops more, and so do tracks.',
      'Some enemies tell you what is coming. A weapon that says CHARGING fires next turn. A bomb that says FUSE 1 goes off next turn. Guard on that turn.',
    ],
    debrief: 'You took the worst they had on the shield. That is what it is for.',
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-crawler', generator: 'gen-furnace',
      ...STOCK, rightHand: 'wpn-rail-lance', leftHand: 'shd-tower', shoulder: 'wpn-mortar-pod',
    },
    battle: {
      enemies: ['marksman', 'bomb-crawler', 'bomb-crawler'], background: HALL,
      talk: [
        sim('start', 'Tracks cannot boost, so there is no dodging this. Watch the words over their heads, and guard before the shot, not after.'),
      ],
    },
  },
  {
    id: 'drill-types', title: 'The Right Tool', lesson: 'Damage types', after: 'intro-2', scale: 0.8,
    briefing: [
      'There are three kinds of damage: kinetic, energy and explosive. Every part resists each kind differently.',
      'A turret stops bullets and is soft to blasts. An enforcer shrugs at bullets and blasts and has almost no answer to a beam. The damage shown before you fire already counts this.',
    ],
    debrief: 'Each of them got what it liked least. The database lists a weakness for everything you have met.',
    build: {
      ...STARTER_FRAME, ...STOCK, generator: 'gen-prism',
      rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-mortar-pod',
    },
    battle: {
      enemies: ['gun-turret', 'heavy-mech'], background: HALL,
      talk: [
        sim('start', 'Rifle, carbine, mortar: one of each kind. Aim each at both targets and compare the damage before you commit.'),
      ],
    },
  },
  {
    id: 'drill-stagger', title: 'Off Balance', lesson: 'Stagger', after: 'intro-2', scale: 1.3,
    briefing: [
      'Every hit pushes on a mech\'s balance. The thin bar under its armour shows how much it has left.',
      'When the bar runs out the mech staggers: it cannot dodge, takes 30% more damage and starts its next turn short of energy. Heavy weapons push hardest. Lead with them.',
    ],
    debrief: 'Knocked flat, then taken apart. In that order.',
    build: {
      head: 'head-ronin', core: 'core-ronin', arms: 'arms-ronin', legs: 'legs-ronin', generator: 'gen-prism',
      ...STOCK, rightHand: 'wpn-scatter-gun', leftHand: 'wpn-rivet-rifle', shoulder: 'wpn-howler',
    },
    battle: {
      enemies: ['heavy-mech'], background: HALL,
      talk: [
        sim('start', 'The Howler on your shoulder does little damage and a great deal of pushing. Fire it first, then the rest while the enforcer is reeling.'),
      ],
    },
  },
  {
    id: 'drill-helpers', title: 'Kill Order', lesson: 'Shoot the helpers first', after: 'intro-2', scale: 0.7,
    briefing: [
      'Some machines fight by making the others harder to beat. A shield drone covers everything near it. A repair drone welds armour back on every turn.',
      'Shoot the big one first and you will be here all day. Take the helpers down, then the one they were helping.',
    ],
    debrief: 'Drones first. The enforcer was only ever as strong as its friends.',
    build: {
      head: 'head-halo', core: 'core-bulwark', arms: 'arms-rigger', legs: 'legs-bulwark', generator: 'gen-furnace',
      booster: 'bst-stock', fcs: 'fcs-lattice', rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-halo-array',
    },
    battle: {
      enemies: ['heavy-mech', 'shield-drone', 'repair-drone'], background: HALL,
      talk: [
        sim('start', 'L1 and R1 switch targets. The target panel says AEGIS on the one that shields and MENDER on the one that repairs.'),
      ],
    },
  },
  {
    id: 'drill-blade', title: 'Close In', lesson: 'Boost and strike', after: 'intro-2',
    briefing: [
      'A blade hits harder than anything you can carry in one hand and makes almost no heat. It only reaches from close in.',
      'So a blade strikes only in a turn that began with a boost, and the strike spends the boost: you do not dodge afterwards. Reverse legs like these boost further.',
    ],
    debrief: 'Three machines, three cuts. Mind what is left standing when you land.',
    build: {
      head: 'head-mantis', core: 'core-mantis', arms: 'arms-mantis', legs: 'legs-mantis', generator: 'gen-dynamo',
      booster: 'bst-sprint', fcs: 'fcs-stock', rightHand: 'wpn-arc-blade', leftHand: 'wpn-arc-pistol',
    },
    battle: {
      enemies: ['lance-tower', 'gun-turret', 'lance-tower'], background: HALL,
      talk: [
        sim('start', 'Boost, then Fire, then the blade. The weapon list tells you when a blade still needs its boost.'),
      ],
    },
  },
  {
    id: 'drill-module', title: 'One Button', lesson: 'Use your module', after: 'intro-2',
    briefing: [
      'A mech carries one module: a few uses a battle, no energy. This one is a target painter. Whatever it marks is easier to hit for three turns.',
      'Your guns here are heavy and clumsy and the target is quick. Paint it first.',
    ],
    debrief: 'Marked, then hit. A module that stays in its rack did nothing for you.',
    build: {
      head: 'head-bulwark', core: 'core-bulwark', arms: 'arms-bulwark', legs: 'legs-bulwark', generator: 'gen-prism',
      ...STOCK, module: 'mod-oracle', rightHand: 'wpn-scatter-gun', shoulder: 'wpn-siege-cannon',
    },
    battle: {
      enemies: ['stalker'], background: HALL,
      talk: [
        sim('start', 'Module is in the action list. Look at your hit chance before and after you paint.'),
      ],
    },
  },
  {
    id: 'drill-protect', title: 'The Convoy', lesson: 'Protect something', after: 'intro-2',
    briefing: [
      'Sometimes the contract is to keep something else alive. It loses one point at the start of each round for every hostile still standing.',
      'So thin them out fast, the weakest first. A salvo fires at all of them at once.',
    ],
    debrief: 'The convoy rolls on with paint to spare. Counting heads is half of this job.',
    build: {
      ...STARTER_FRAME, ...STOCK, generator: 'gen-prism',
      rightHand: 'wpn-needler', leftHand: 'wpn-pulse-carbine', shoulder: 'wpn-micro-salvo',
    },
    battle: {
      enemies: ['recon-drone', 'gunship', 'recon-drone'], background: HALL, objective: { type: 'protect', name: 'Convoy', hp: 10 },
      talk: [
        sim('start', 'The convoy\'s armour is at the top of the field. Three hostiles standing means three points gone when the next round starts.'),
      ],
    },
  },
];
