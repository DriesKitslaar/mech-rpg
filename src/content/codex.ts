import type { Entry } from '../core/codex';

/** One page of the database's list of units: which kind of enemy, what to call it there, and how to fight it. */
export interface UnitPage {
  /** The enemy's id. */
  id: string;
  /** Its name on the page, when that differs from the name it fights under. */
  title?: string;
  note: string;
}

/** Every kind of enemy, in the order the database lists them: what flies and what is bolted down, vehicles, mechs, pilots, machines, Meridian. */
export const UNITS: UnitPage[] = [
  { id: 'recon-drone', note: 'The cheapest thing in the sky. Thin armour and a light gun; they only matter in numbers.' },
  { id: 'gunship', note: 'Rocket pods on rotors. It has little armour. Bring it down before the pods add up.' },
  { id: 'shield-drone', note: 'While it flies, every other enemy takes 40% less damage. Shoot it first.' },
  { id: 'repair-drone', note: 'Every turn it welds armour back onto the most damaged friend it has. Shoot it first.' },
  { id: 'bomb-crawler', note: 'Walks up and goes off on its third turn for heavy damage. Destroy it before then, or guard.' },
  { id: 'gun-turret', note: 'Bolted down, so it never dodges. Its plating stops bullets well and blasts badly.' },
  { id: 'lance-tower', note: 'A sentry lance on a post. It cannot dodge and has little armour, but its aim is good.' },
  { id: 'jammer', note: 'A mast with no gun. While it stands, everything you fire is 20 less likely to hit.' },
  { id: 'tank', note: 'Tracks and a howitzer. Bullets bounce off the hull; blasts do not.' },
  { id: 'carrier', note: 'Launches a recon drone every second turn while fewer than three enemies stand. Kill the carrier, not its drones.' },
  { id: 'light-mech', note: 'Lumen security. Quick, and hard to hit while its legs work: shoot those out first.' },
  { id: 'marksman', note: 'Charges a piercing longbow for a turn, then fires it. Guard or boost on the turn it is loaded.' },
  { id: 'heavy-mech', note: 'Hadron muscle. Slow, thick, and it goes for whatever is already damaged. Beams cut through it.' },
  { id: 'bulldozer', note: 'A Bulwark on tracks behind a riot shield, with a mortar. It never dodges. Beams cut through it.' },
  { id: 'stalker', note: 'Twin needles on fast legs, picking at your limbs. Staggered, it cannot dodge at all.' },
  { id: 'ripper', note: 'The Undertow\'s jumping frame. It boosts in and strikes with a claw. Blasts barely mark it.' },
  { id: 'juggernaut', note: 'The heaviest frame there is, with a maul and a mortar. Nothing gets through it easily.' },
  { id: 'rival', note: 'A licensed pilot in a Ronin frame, with a lance and a rack. Hits hard and takes it well.' },
  { id: 'rival-2', title: 'Ashfall, at war', note: 'Ashfall with a barrier that soaks up the first damage each time it is raised, and a second wind.' },
  { id: 'ashfall-unbound', title: 'Ashfall Unbound', note: 'Ashfall with nothing held back: lance, edge and rack, a barrier, and two changes of pace.' },
  { id: 'sable', note: 'Lumen\'s best pilot. A piercing rifle at range and a blade when she closes. Do not let her choose the distance.' },
  { id: 'rook', note: 'The Undertow\'s champion. He closes in every turn with a cutting torch that heats you up, and drops chaff.' },
  { id: 'krell', note: 'Hadron\'s strike-breaker, in a Colossus behind a tower shield. Slow, and very hard to hurt while he guards.' },
  { id: 'leviathan', note: 'A barge with a jaw. It drops a bomb crawler every fourth turn. Blasts barely mark it; beams do.' },
  { id: 'strip-miner', note: 'A mining machine the size of a campus. It cannot dodge. Its hull laughs at bullets; use beams.' },
  { id: 'overseer', note: 'Lumen\'s eye over the lower levels. It spoils your aim and charges a beam. Beams slide off it.' },
  { id: 'lien-drone', note: 'Meridian\'s errand runner. Sturdier than a recon drone, and each hit drains your next turn\'s energy.' },
  { id: 'bailiff', note: 'Meridian\'s Auditor frame: a piercing rifle and a coil that drains your energy. Armoured alike all round.' },
  { id: 'assessor', note: 'A Bailiff with a barrier and a decree that charges for a turn. It refits itself when it starts losing.' },
  { id: 'adjuster', note: 'Meridian\'s claim on the city, on tracks. A barrier, lien drones every fourth turn, three ways of fighting.' },
];

/** What there is to know about Varn, in the order it comes to light. */
export const WORLD: Entry[] = [
  {
    id: 'varn', title: 'VARN', after: 'start',
    text: 'A mining city on a seam that should have run dry forty years ago. The pits go down, the towers go up, and the lowest streets flood every spring. Nobody governs Varn. Three powers hold it between them, and none of them will fight for it in person.',
  },
  {
    id: 'licence', title: 'THE LICENCE', after: 'start',
    text: 'A pilot\'s licence lets you carry weapons inside the city for pay. It is issued on credit. Yours came with a salvaged frame and a debt, and the debt is the larger of the two. Repairs and ammunition come out of every fee.',
  },
  {
    id: 'dispatch', title: 'DISPATCH', after: 'start',
    text: 'The office that finds a licensed pilot work and takes its cut. Dispatch has no side. It will sell your time to anyone whose money clears, and it keeps a standing patrol contract for the days nobody else is hiring.',
  },
  {
    id: 'hadron', title: 'HADRON MINING', after: 'start',
    text: 'The oldest power in Varn. Hadron owns the seam, the rails and most of the people who work them. It builds heavy: Bulwark frames, tracks, shields, guns fed by the belt. Its answer to most problems is more plating. Director Brenn speaks for it.',
  },
  {
    id: 'lumen', title: 'LUMEN SYSTEMS', after: 'start',
    text: 'Lumen sells calculation: routes, prices, forecasts, and the security that keeps them private. Its towers are the newest thing in Varn. Its Halo frames are light, quick and precise, and nearly everything it makes fires a beam. Analyst Varga speaks for it.',
  },
  {
    id: 'undertow', title: 'THE UNDERTOW', after: 'start',
    text: 'Not a company. The people of the flooded levels: salvage crews, pump hands, gate-keepers. They build from what the other two throw away, and they are fond of explosives. Tamsin speaks for them, when anyone asks.',
  },
  {
    id: 'freelance', title: 'FREELANCE FRAMES', after: 'intro-2',
    text: 'Not every frame has a flag on it. Ronin, Wraith and Colossus are built by small shops for pilots who answer to nobody, and sold to anyone who can pay. They are not cheap.',
  },
  {
    id: 'arena', title: 'THE ARENA', after: 'intro-2',
    text: 'Ranked pilots fight for purses in a pit under the rail yard. It is licensed, legal and heavily bet on. Beat the next rank and the purse is yours in full; beat someone you have beaten before and you get a quarter.',
  },
  {
    id: 'back-room', title: 'THE BACK ROOM', after: 'arena:10',
    text: 'Behind the pit is a room the crowd does not know about. Five pilots fight there who stopped caring about the ladder years ago: for larger purses, without an audience, and only against a champion.',
  },
  {
    id: 'ashfall', title: 'ASHFALL', after: 'rival-1',
    text: 'A licensed pilot in a Ronin frame, with a longer record than yours. Ashfall takes the contracts that begin with the words "stop this person". Nobody at Dispatch will say who is paying.',
  },
  {
    id: 'war', title: 'THE WAR', after: 'choice',
    text: 'Nobody declared it. The three powers stopped sharing the city and started hiring. Each wants a pilot of its own, and only its own. Whoever you fly for, the other two will pay someone to stop you.',
  },
  {
    id: 'floodgates', title: 'THE FLOODGATES', after: 'choice-undertow',
    text: 'The gates that seal the lower levels from the city above. Both companies held them, and held them shut. With the gates open Varn is one city again, and neither company will ever hire whoever opened them.',
  },
  {
    id: 'sable', title: 'SABLE', after: 'hadron-3',
    text: 'Lumen\'s best pilot, in a Wraith frame. She fought with a piercing rifle and finished with a blade. Lumen\'s models priced her above the vault she was guarding. The models were wrong about one of them.',
  },
  {
    id: 'rook', title: 'ROOK', after: 'lumen-4',
    text: 'The Undertow\'s champion. He came up through the salvage yards with a cutting torch and never put it down. He fought for the pleasure of it, which Lumen\'s models found difficult to price.',
  },
  {
    id: 'krell', title: 'KRELL', after: 'undertow-3',
    text: 'Hadron ran its pits through one man. Krell broke every strike Varn ever had from inside a Colossus, behind a tower shield and a jammer mast. He fought dirty and he never tired.',
  },
  {
    id: 'leviathan', title: 'LEVIATHAN', after: 'hadron-4',
    text: 'A barge the Undertow floated out of the old drowned yards and gave a jaw. It ate pump stations and shed walking bombs like a dog sheds hair. Blasts barely marked it. It is back under the water now.',
  },
  {
    id: 'strip-miner', title: 'THE STRIP-MINER', after: 'lumen-3',
    text: 'A Hadron mining machine roughly the size of the campus it was pointed at. A bucket wheel, blasting charges and a hull that laughed at bullets. It could not dodge and it could not be reasoned with.',
  },
  {
    id: 'overseer', title: 'THE OVERSEER', after: 'undertow-4',
    text: 'The machine Lumen watched the lower levels through. Lumen called it the Overseer; the Undertow called it the Eye. It spoiled your aim, kept a shield drone close, and beams slid off it.',
  },
  {
    id: 'meridian', title: 'MERIDIAN MUTUAL', after: 'finale',
    text: 'The war had an insurer. All three sides bought the same policy from the same firm, and none of them read it. Meridian Mutual has declared Varn a total loss. Everything in it is collateral now: the mines, the towers, the gates. Your licence is on the list.',
  },
  {
    id: 'auditors', title: 'THE AUDITORS', after: 'audit-1',
    text: 'Meridian\'s machines are pale, quiet and all alike. Lien drones clamp on to anything that still has power. Bailiffs serve the writs. They do not fight to win. They fight to collect, and they drain your generator while they do it.',
  },
  {
    id: 'actuary', title: 'THE ACTUARY', after: 'audit-3',
    text: 'The voice Meridian uses when it wants something signed. It values competence. It offers to clear your debt and restore your licence, and it has one account in Varn still open.',
  },
  {
    id: 'collections', title: 'COLLECTIONS', after: 'verdict-enforce',
    text: 'Meridian\'s Collections division took on one more pilot the night the last account in Varn was closed. The debt is cleared. The frame is your own. The city is settled.',
  },
  {
    id: 'adjuster', title: 'THE ADJUSTER', after: 'verdict-default',
    text: 'Meridian\'s claim on Varn lived in one machine in its clearing house. With the Adjuster broken the policy is void. Nobody owns the city. Nobody owes it either, which is new.',
  },
];

/** How the game works, a topic at a time. Every number here is the rule as the game plays it. */
export const MANUAL: { id: string; title: string; text: string }[] = [
  {
    id: 'basics', title: 'THE BASICS',
    text: 'You are paid by the contract. A contract is one to three battles; damage and spent rounds carry from one to the next. Win and the fee is yours, less repairs and ammunition. Lose or walk away and you pay those all the same.',
  },
  {
    id: 'turn', title: 'YOUR TURN',
    text: 'Each turn your generator gives you energy. Spend it on firing each weapon once, on Boost, Guard, Vent or your module, then end the turn. The more mobile unit acts first each round. Auto Turn plays one turn for you.',
  },
  {
    id: 'aim', title: 'AIMING',
    text: 'Pick a target and a part. The core is the easiest to hit; legs are 5 harder, arms 10, the head 20. Destroy the core and the unit is gone. A part that is already destroyed passes half of any further damage on to the core.',
  },
  {
    id: 'parts', title: 'LOSING PARTS',
    text: 'Without legs a unit cannot dodge or boost. Without arms it cannot use what it holds in its hands. Without a head its aim drops by 30. That is as true of you as of them.',
  },
  {
    id: 'types', title: 'DAMAGE TYPES',
    text: 'Kinetic, energy, explosive. Every part resists each kind differently, and the units page shows what an enemy\'s core is weak to once you have met it. A piercing weapon halves the resistance it meets.',
  },
  {
    id: 'heat', title: 'HEAT',
    text: 'Firing makes heat, and your generator sheds some at the end of every turn. Reach 100 and you overheat: your next turn is lost. Vent sheds heat at once for a fifth of a turn\'s energy.',
  },
  {
    id: 'stagger', title: 'STAGGER',
    text: 'Every hit pushes on the target\'s balance; the thin bar shows how much it has left. When it runs out the unit staggers: it cannot dodge, takes 30% more damage, and starts its next turn with less energy. Heavy mechs are steadier.',
  },
  {
    id: 'boost', title: 'BOOST AND BLADES',
    text: 'Boost makes you much harder to hit until your next turn. A blade can only strike in a turn that began with a boost, and the strike uses the boost up. Tracks cannot boost at all.',
  },
  {
    id: 'guard', title: 'GUARD',
    text: 'Guard costs a fifth of a turn\'s energy. Until your next turn it stops 40% of the damage and half the push of every hit. A shield in the left hand stops more, and so do tracks.',
  },
  {
    id: 'charge', title: 'CHARGED WEAPONS',
    text: 'Some weapons charge for a turn before they fire. When an enemy has one loaded, the turn before it fires is the time to guard or boost.',
  },
  {
    id: 'modules', title: 'MODULES',
    text: 'One module fits each mech: a coolant flush, a barrier, an overclock, a target painter and others. A module has a few uses per battle and costs no energy. The shop and the garage say what each one does.',
  },
  {
    id: 'repairs', title: 'FIELD REPAIRS',
    text: 'Twice per contract you can patch a damaged part in the field, which restores 40% of its armour. A destroyed part cannot be patched. Each repair you use lowers your rank a little.',
  },
  {
    id: 'tricks', title: 'ENEMY TRICKS',
    text: 'Shield drones cover the others. Repair drones weld them back together. Jammers spoil your aim. Bomb crawlers go off on a fuse. Carriers launch more. Shoot the helper first.',
  },
  {
    id: 'objectives', title: 'OBJECTIVES',
    text: 'Not every battle is won by destroying everything. Some ask you to outlast a number of rounds, to protect something, to take out one leader, to disable a machine without destroying it, or to drive a pilot off. The line at the top of the field says which.',
  },
  {
    id: 'ranks', title: 'RANKS',
    text: 'A won contract is ranked S to D on three things: rounds taken against par, armour lost, and field repairs used. S pays 25% more and A 10% more. The archive lets you play a contract again for a better rank and a share of the pay.',
  },
  {
    id: 'money', title: 'MONEY',
    text: 'Repairs cost 0.8 credits per point of armour and every round fired has a price. Selling a part returns what you paid for it, so trying something out costs nothing. Debt stops you buying, never flying.',
  },
  {
    id: 'garage', title: 'THE GARAGE',
    text: 'A build must stay under the weight its legs can carry and within the energy its generator makes. L1 and R1 change the paint. Left and right open your three saved builds.',
  },
  {
    id: 'legs', title: 'LEG TYPES',
    text: 'Reverse legs dodge better when they boost. Four legs are steady and aim shoulder weapons better. Tracks cannot boost, but guard best and are the hardest to stagger. Hover boosts cheaply and is easily knocked off balance.',
  },
  {
    id: 'pilot', title: 'LEVELS AND PERKS',
    text: 'Contracts won are experience. Every level gives a perk point; perks are bought on the pilot screen and kept for good. Medals are earned for what you do, pay a little, and are listed there too.',
  },
  {
    id: 'cycle', title: 'A NEW CYCLE',
    text: 'When the story is over it can be started again. You keep credits, parts, level, perks, medals, the database and your arena rank. Enemies get tougher and contracts pay better each time.',
  },
  {
    id: 'difficulty', title: 'DIFFICULTY',
    text: 'Story takes a fifth off enemy armour and firepower; Veteran adds a fifth. Change it in the options whenever you like. Fast battles play everything at two and a half times the speed.',
  },
  {
    id: 'controls', title: 'CONTROLS',
    text: 'D-pad: move. A: confirm. B: back. L1 and R1: turn pages, switch tabs, and in battle switch targets.',
  },
];
