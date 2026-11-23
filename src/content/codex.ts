import type { SongName } from './songs';
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
  { id: 'light-mech', note: 'Lumen security. Quick, and hard to hit while its legs work. Fire at the core anyway. Staggered, it cannot dodge.' },
  { id: 'marksman', note: 'Charges a piercing longbow for a turn, then fires it. Guard or boost on the turn it is loaded.' },
  { id: 'heavy-mech', note: 'Hadron muscle. Slow, thick, and it goes for whatever is already damaged. Beams cut through it.' },
  { id: 'bulldozer', note: 'A Bulwark on tracks behind a riot shield, with a mortar. Tracks cannot boost, so it is easy to hit. Beams cut through it.' },
  { id: 'stalker', note: 'Twin needles on fast legs, aimed at your head to spoil your aim. Staggered, it cannot dodge at all.' },
  { id: 'ripper', note: 'The Undertow\'s jumping frame. It boosts in and strikes with a claw. Blasts barely mark it.' },
  { id: 'juggernaut', note: 'The heaviest frame there is, with a maul and a mortar. Nothing gets through it easily.' },
  { id: 'rival', note: 'A licensed pilot in a Ronin frame, with a lance and a rack. Hits hard and takes it well.' },
  { id: 'rival-2', title: 'Ashfall, at war', note: 'Ashfall with a barrier that soaks up the first damage each time it is raised, and a second wind.' },
  { id: 'ashfall-unbound', title: 'Ashfall Unbound', note: 'Ashfall with nothing held back: lance, edge and rack, a barrier, and two changes of pace.' },
  { id: 'sable', note: 'Lumen\'s best pilot. A piercing rifle at range and a blade when she closes. Do not let her choose the distance.' },
  { id: 'rook', note: 'The Undertow\'s champion. He closes in every turn with a cutting torch that heats you up, and drops chaff.' },
  { id: 'krell', note: 'Hadron\'s strike-breaker, in a Colossus behind a tower shield. Slow, and very hard to hurt while he guards.' },
  { id: 'leviathan', note: 'A barge with a jaw. It drops a bomb crawler every fourth turn. Blasts barely mark it; beams do.' },
  { id: 'strip-miner', note: 'A mining machine the size of a campus. It hardly moves, so little misses it. Its hull laughs at bullets; use beams.' },
  { id: 'overseer', note: 'Lumen\'s eye over the lower levels. It spoils your aim and charges a beam. Beams slide off it.' },
  { id: 'lien-drone', note: 'Meridian\'s errand runner. Sturdier than a recon drone, and each hit drains your next turn\'s energy.' },
  { id: 'bailiff', note: 'Meridian\'s Auditor frame: a piercing rifle and a coil that drains your energy. Armoured alike all round.' },
  { id: 'assessor', note: 'A Bailiff with a barrier and a decree that charges for a turn. It refits itself when it starts losing.' },
  { id: 'adjuster', note: 'Meridian\'s claim on the city, on tracks. A barrier, lien drones every fourth turn, three ways of fighting.' },
  { id: 'proxy', title: 'The Proxy', note: 'Meridian\'s vote for everybody who cannot attend. A barrier, a gavel that knocks you off balance, lien drones every fifth turn, three ways of fighting.' },
  { id: 'mortar-nest', note: 'A mortar in a ring of plate. It cannot move and often misses, but what lands takes a quarter of a core. Beams go through the ring.' },
  { id: 'hunter-drone', note: 'A dart with twin needles, aimed at your head. Very hard to hit. Anything that lands on it is nearly enough.' },
  { id: 'flak-walker', note: 'A gun on two legs. Each volley is three small blasts over the whole mech. Its legs are easier to break than its housing.' },
  { id: 'breacher', note: 'A ram on wheels. It drives in and hits with the plate, and what it hits is thrown off balance. Its wheels are softer than its hull.' },
  { id: 'arc-pylon', note: 'A pylon that throws lightning. It cannot move. Every hit heats you by 16. Beams slide off it.' },
  { id: 'longshot', note: 'A rail on rotors. It charges for a turn, then shoots through half your armour. Frail: kill it while it charges.' },
  { id: 'scrap-king', title: 'The Scrap King', note: 'A crab of welded wrecks from under the Night Market. A pincer that staggers, flak from its back, and it gets worse twice.' },
  { id: 'night-train', title: 'The Night Train', note: 'A rail cannon on wheels. The cannon charges for a turn and pierces; the gun ports never wait. It cannot dodge.' },
  { id: 'magpie', note: 'Wanted. A Halo in violet with a carbine and a needle, both aimed at your head. Shoot the legs and it stops dancing.' },
  { id: 'dredge', note: 'Wanted. A Bulwark on tracks with a shotgun and a mortar. Tracks cannot boost, so it is easy to hit. Beams cut through it.' },
  { id: 'lark', note: 'Wanted. Charges a piercing longbow behind a tower shield. Guard or boost on the turn it is loaded.' },
  { id: 'hollow', note: 'Wanted. A Mantis that leaps in with a thermal cutter. Every cut heats you up. Blasts barely mark it.' },
  { id: 'paragon', note: 'Wanted. A Ronin with a thermal lance and an inferno pod. It spreads its fire over all of you. Vent early.' },
  { id: 'notary', title: 'The Notary', note: 'Wanted. An Auditor frame gone private: a barrier, a draining coil and a decree. It hits harder once it is losing.' },
  { id: 'larder', note: 'Coast Circuit. A Shrike with a blade and a rifle. It boosts in, strikes and is still boosting: hard to hit until it staggers or loses its legs.' },
  { id: 'argent', note: 'The Circuit\'s first sword, in a Sterling. Its field takes what lands first and is whole each round unless you break it. Broken, it is down a round.' },
  { id: 'kiln', note: 'The coast yard\'s works pilot, in a Sirocco. Its heat limit is 130, and both weapons hit harder the hotter it runs. Stagger it, or heat it past that.' },
  { id: 'vesper', note: 'The coast yard\'s other works pilot, in a Solstice. It holds every other round and keeps the energy: the next, its one weapon has a turn and a half.' },
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
    text: 'A Hadron mining machine roughly the size of the campus it was pointed at. A bucket wheel, blasting charges and a hull that laughed at bullets. It barely moved and it could not be reasoned with.',
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
  {
    id: 'society', title: 'THE SOCIETY', after: 'verdict-quorum',
    text: 'The Meridian Pit Mutual Aid Society met in its hall for the first time in forty years, with nine checks counted. The Secretary took the minutes. Nobody owns the city now but the people in it, and they own a good deal more than the city.',
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
    text: 'Each turn your generator gives you energy. Spend it on firing each weapon once, on Boost, Guard or Vent, then end the turn. Your module costs none. The more mobile unit acts first each round. Auto Turn plays one turn for you.',
  },
  {
    id: 'momentum', title: 'MOMENTUM',
    text: 'Where the banner says MOMENTUM (two or more machines, none of them a boss, a named pilot, an elite, a Bailiff or an objective\'s target), a volley that destroys one pays for itself: the weapon is ready again, its energy comes back, and the run is counted (CHAIN x2). Heat and rounds stay spent; a charged weapon must charge again.',
  },
  {
    id: 'shatter', title: 'SHATTER',
    text: 'In the same fights, one hit of yours that takes half of a machine\'s core, as it stood at full strength, finishes it: a heavy weapon goes through a light machine. The aiming line says DESTROYS when a hit would do it. It is never done to you, and a wingman\'s fire does not do it.',
  },
  {
    id: 'overkill', title: 'OVERKILL',
    text: 'One hit of yours that destroys a machine and does at least one and a half times its whole core, as it stood at full strength, is an OVERKILL: the machine goes up harder and the word is over it. It is said in any fight and changes nothing. How worn the machine already was makes no difference.',
  },
  {
    id: 'rout', title: 'THEY BREAK',
    text: 'Destroy two machines with your weapons in one turn of the same fights and whatever still stands against you loses its nerve. It is marked SHAKEN and is out of the fight when its turn comes, without firing: it leaves (ROUT), or shuts down if it cannot move (OFFLINE). That is not a kill: destroy it first if you want it counted.',
  },
  {
    id: 'swarm', title: 'SWARMS',
    text: 'Some contracts field more machines than a field holds. Three stand at a time; as a round begins the next come on where others fell or left. The line at the top of the field says how many are still to come, and the battle is not won until that is none. The swarm on the open board pays by the head.',
  },
  {
    id: 'renown', title: 'A NAME',
    text: 'What you destroy on contracts earns you a name. Every machine counts one, a boss eight, a rank of the arena four, a telling of the story forty. There are five names; your record says which is yours and what the next asks. A contract\'s banner carries it, unless a boss is coming in, and ordinary machines are told who is coming.',
  },
  {
    id: 'aim', title: 'AIMING',
    text: 'Pick a target and a part. The core is the easiest to hit; legs are 5 harder, arms 10, the head 20. Destroy the core and the unit is gone. A part that is already destroyed passes half of any further damage on to the core.',
  },
  {
    id: 'parts', title: 'LOSING PARTS',
    text: 'Without legs a unit cannot dodge or boost. Without arms it cannot fire what it holds in its hands, though a shield there still covers it. Without a head its aim drops by 30. That is as true of you as of them.',
  },
  {
    id: 'types', title: 'DAMAGE TYPES',
    text: 'Kinetic, energy, explosive. Every part resists each kind differently, and the units page shows what an enemy\'s core is weak to once you have met it. A piercing weapon halves the resistance it meets.',
  },
  {
    id: 'heat', title: 'HEAT',
    text: 'Firing makes heat, and your generator sheds some at the end of every turn. Pass 100 and you overheat: your next turn is lost. Vent sheds heat at once for a fifth of a turn\'s energy.',
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
    id: 'kinds', title: 'FIVE KINDS',
    text: 'Five kinds of weapon ask something of you. REDLINE hits harder the hotter you run: fire it last. SURGE takes all the energy you have left and hits for every 100 of it. PUNISH does far more to a staggered machine. FORK: a hit leaps to the next machine. SPOOL fires 2 shots, and one more for every turn in a row.',
  },
  {
    id: 'modules', title: 'MODULES',
    text: 'One module fits each mech: a coolant flush, a barrier, an overclock, a target painter and others. A module has a few uses per battle and costs no energy. The shop and the garage say what each one does.',
  },
  {
    id: 'repairs', title: 'FIELD REPAIRS',
    text: 'Twice per contract you can patch a damaged part in the field, which restores 40% of its armour. A destroyed part cannot be patched. A repair ends your turn, so fire first. Each one you use lowers your rank a little.',
  },
  {
    id: 'tricks', title: 'ENEMY TRICKS',
    text: 'Shield drones cover the others. Repair drones weld them back together. Jammers spoil your aim. Bomb crawlers go off on a fuse. Carriers launch more. Shoot the helper first.',
  },
  {
    id: 'objectives', title: 'OBJECTIVES',
    text: 'Not every battle is won by destroying everything. Some ask you to outlast a number of rounds, to protect something, to take out one leader, to disable a machine without destroying it, or to drive a pilot off. The line at the top of the field says which. Freight you guard stands on the field; if it burns, a third or less is left.',
  },
  {
    id: 'ranks', title: 'RANKS',
    text: 'A won contract is ranked S to D on three things: rounds taken against par, armour lost, and field repairs used. S pays 25% more and A 10% more. The archive lets you play a contract again for a better rank and a share of the pay. A contract won for the other side is kept there as it was first offered.',
  },
  {
    id: 'money', title: 'MONEY',
    text: 'Repairs cost 0.8 credits per point of armour and every round fired has a price. Selling a part returns what you paid for it, so trying something out costs nothing. Debt stops you buying, never flying, and you can owe 2000 at most: what a bill adds beyond that, Dispatch writes off.',
  },
  {
    id: 'garage', title: 'THE GARAGE',
    text: 'A build must stay under the weight its legs can carry and within the energy its generator makes. L1 and R1 change the paint. Right opens your seven saved builds: room for one of each class, each listed by the class it is. Left opens the paint shop.',
  },
  {
    id: 'paint', title: 'THE PAINT SHOP',
    text: "Twelve paints come ready, and a master's crown brings theirs. MIX 1, 2 and 3 are yours to mix: put one on and its five rows wake. Up and down choose a row, left and right change it: the armour's colour, how strong and how dark it is, the colour of the trim and how hard it glows. A mix is kept as you leave it.",
  },
  {
    id: 'legs', title: 'LEG TYPES',
    text: 'Reverse legs dodge better when they boost. Four legs are steady and aim shoulder weapons better. Tracks cannot boost, but guard best and are the hardest to stagger. Hover boosts cheaply and is easily knocked off balance.',
  },
  {
    id: 'classes', title: 'CLASSES',
    text: 'A build is one of seven classes, the first it fits: a blade makes a Duellist, a weapon that charges a Sharpshooter, a salvo Artillery, two or more weapons, all energy, a Lancer, a shield or legs of MOB 18 or less a Bastion, legs of MOB 40 or more a Skirmisher, anything else an All-rounder. The garage names yours.',
  },
  {
    id: 'stripes', title: 'STRIPES',
    text: "A class gives you a stripe at 3, at 8 and at 15 contracts won flying it: three a class, twenty-one in all. Every fifth stripe you hold, of whatever classes, is a perk point: the first is soonest had by flying five kinds of machine. The CLASS page shows them, and a briefing's Build row how near the next is.",
  },
  {
    id: 'odds', title: 'ODDS',
    text: 'A briefing gives the odds of the contract in the build you have chosen: Auto Turn flies it 20 times with your perks, bench work, Overdrive, wingman and difficulty, and its wins are counted. Another build is another count. The odds are what Auto Turn makes of the fight: flying it yourself, you can do better.',
  },
  {
    id: 'asks', title: 'CLASS WANTED',
    text: 'Once the board has grown a little, one of its three open contracts wants a class: its pay on the list ends in a plus, and its briefing says which. It can be won as anything; won in a build of that class it pays a quarter more. Turn to such a build on the Build row and the line lights up.',
  },
  {
    id: 'jobs', title: 'KINDS OF WORK',
    text: "Once the board has grown a little, a job stands beside its three. Its title says which of four it is. Hit: paid for one machine, over when it falls. Repo: take that machine's arms and legs and leave its core. Escort: whatever stands wears the freight down each round. Hold: last six rounds. They turn with every contract won.",
  },
  {
    id: 'range', title: 'THE RANGE',
    text: "The simulator's second page (L1/R1) is the range: your own build against any machine you have met, up to three of the lighter ones, one of a mech or anything of the story's. A real fight: perks, bench work, Overdrive and difficulty all count. Nothing is billed, paid or counted; afterwards you see what it would have cost.",
  },
  {
    id: 'spar', title: 'SPARRING',
    text: "The range also lists your saved builds that can be flown. Pick one and the simulator flies it against you: the same parts, with the bench's work on them, in other colours, flown as its class is flown. The odds in the briefing say which of two builds beats the other before a shot is fired. Nothing is billed, paid or counted.",
  },
  {
    id: 'pilot', title: 'LEVELS AND PERKS',
    text: 'Contracts won are experience. Every level gives a perk point; perks are bought on the pilot screen and kept for good. Medals are earned for what you do, pay a little, and are listed there too.',
  },
  {
    id: 'cycle', title: 'A NEW CYCLE',
    text: 'When the story is over it can be started again. You keep credits, parts, level, perks, medals, the database and arena rank. Enemies get tougher and pay gets better the first two times, then both stay as they are. The bench goes a step further each time, up to five. Some contracts then have a second offer, from the other side.',
  },
  {
    id: 'finds', title: 'WHAT IS FOUND',
    text: 'Some of what you do leaves something behind: a paper, a brass check. The database keeps them under FOUND, the papers by their numbers. One you have not found shows a clue in its place. Nothing found is lost when the story starts over.',
  },
  {
    id: 'bench', title: 'THE BENCH',
    text: 'In the garage, R1 on a part you own puts it on the bench. A step costs its number times the price of the part and adds a twentieth: armour to a frame part, damage to a weapon, output to a generator. The work stays with the part when it is sold. The bench goes two steps, and one further each time the story starts over, to five.',
  },
  {
    id: 'difficulty', title: 'DIFFICULTY',
    text: 'Story takes a fifth off enemy armour and firepower; Veteran adds a fifth. Change it in the options whenever you like. Fast battles play everything at two and a half times the speed.',
  },
  {
    id: 'overdrive', title: 'OVERDRIVE',
    text: 'From pilot level 3 a meter at the left edge of the field fills as you fight: 8 for a volley that lands, 10 for one you take, 15 for a machine destroyed. Full, R1 on your turn sets off your Overdrive. Second Wind starts your turn over; Iron Skin (level 6) halves damage until your next turn; Deadeye (level 9) cannot miss.',
  },
  {
    id: 'ground', title: 'GROUND',
    text: 'Some places have a rule for both sides. Rain: all shed 4 more heat a turn. Furnace heat: 4 less. Dust: every shot 5 less likely to hit. Flood water: a boost dodges 6 less. Sealed vault: explosions do 15% less. Crosswind: kinetic hits 6 less likely. Clear air: beams 4 more likely. The briefing and the field name it.',
  },
  {
    id: 'wingmen', title: 'WINGMEN',
    text: 'A wingman is hired in the briefing for a share of fee and experience, and fires once a round from round 2. In battle the Wing row gives orders for nothing: strike the strongest, strike what you fired at last, or cover you, which takes a share off every shot at you while they hold fire.',
  },
  {
    id: 'gauntlet', title: 'THE GAUNTLET',
    text: 'A run of floors in a stock frame, with none of your own parts or perks. Most floors have two doors: pick your fight. After each floor take one thing on offer: a part, a full service, or a boon for the run. Every fifth floor has a warden. Falling, retreating or closing the game on a floor ends the run. It pays by floors cleared.',
  },
  {
    id: 'elites', title: 'ELITES AND RELICS',
    text: 'An elite is a machine with a mark. ARMOURED: two fifths more armour. OVERCLOCKED: a quarter more damage. SWIFT: harder to hit. SHIELDED: a barrier, new every turn. The Gauntlet hides one behind some doors: beat it for one more thing on offer. Some open contracts have one, and pay more. A warden beaten leaves one of two relics.',
  },
  {
    id: 'cups', title: 'ARENA CUPS',
    text: 'A cup is three of the ladder back to back, with only field service between. It opens once you have beaten its three. The purse is paid for all three or not at all: in full the first time, a quarter after.',
  },
  {
    id: 'crowns', title: 'CROWNS',
    text: "A crown is kept for good, through every telling. It is marked on your page of classes, and its holder is called by the master's title there. The garage offers the holder the master's own paint. A contract on the board that asks for that class pays the holder half as much again, where it pays anyone else a quarter more.",
  },
  {
    id: 'masters', title: 'THE MASTERS',
    text: "The arena's second page (L1/R1): seven masters, one of each class, who take challenges from the champion. Any build may fight one, for a purse: in full the first time, a quarter after. Beat a master in a build of their own class and the crown of that class is yours. The briefing says which build that is.",
  },
  {
    id: 'seat', title: 'THE EIGHTH SEAT',
    text: "Under the seven masters is a seat that is no class's. Its keeper takes one challenge: from the pilot who holds all seven crowns, in any build. The keeper's machine fights three ways and changes as it is hurt. Take the seat and its frame, the Sovereign, is on the shop's list, and the keeper's paint is yours.",
  },
  {
    id: 'controls', title: 'CONTROLS',
    text: 'D-pad: move. A: confirm. B: back. L1 and R1: turn pages, switch tabs, and in battle switch targets. R1 on your own turn sets off a full Overdrive. A or B cuts short the launch a contract opens with; with Fast Battles on there is none.',
  },
];

/** The songs of the game as the database's jukebox lists them, roughly in the order a pilot comes across them. */
export const JUKEBOX: { id: SongName; title: string; text: string }[] = [
  { id: 'title', title: 'IRONWAGE', text: 'The title. Where every contract begins.' },
  { id: 'hub', title: 'HEADQUARTERS', text: 'Between contracts: the garage, the shop and the board.' },
  { id: 'briefing', title: 'THE SMALL PRINT', text: 'Briefings, and the story between them.' },
  { id: 'battle', title: 'CONTRACT WORK', text: 'The first act and the odd jobs.' },
  { id: 'victory', title: 'PAID IN FULL', text: 'A contract won.' },
  { id: 'defeat', title: 'WRITTEN OFF', text: 'A contract lost.' },
  { id: 'hadron', title: 'COMPANY TIME', text: 'The briefings of Director Brenn.' },
  { id: 'lumen', title: 'CLEAN ROOM', text: 'The briefings of Analyst Varga.' },
  { id: 'undertow', title: 'LOW WATER', text: 'The briefings of Tamsin.' },
  { id: 'arena', title: 'THE PITS', text: 'The arena, its cups and its back room.' },
  { id: 'rival', title: 'ASHFALL', text: 'The duels with the pilot who keeps turning up.' },
  { id: 'boss', title: 'SOMETHING LARGE', text: 'Great machines, and pilots with a name.' },
  { id: 'battle2', title: 'THE WAR FOR VARN', text: 'The war, the audit and the verdicts.' },
  { id: 'gauntlet', title: 'THE WAY DOWN', text: 'The room of the Gauntlet, between floors.' },
  { id: 'descent', title: 'FLOOR BY FLOOR', text: 'The floors of the Gauntlet.' },
  { id: 'ending', title: 'WHAT IT COST', text: 'The endings and the end roll.' },
];

/** Somebody of Varn with a face: who they are, whose side they are on, and a line about them. */
export interface Person {
  id: string;
  name: string;
  portrait: string;
  /** Whom they work for, or what they are to the pilot. */
  role: string;
  /** When their page opens: once the story has got that far, or once they have been met in battle. */
  when: { after: string } | { met: string };
  /** For somebody with a price on them: the contract that brings them in. Once it is done their page says so. */
  bounty?: string;
  text: string;
}

/** The people of Varn, in the order a pilot comes across them. */
export const PEOPLE: Person[] = [
  { id: 'dispatch', name: 'Dispatch', portrait: 'portrait-dispatch', role: 'Dispatch', when: { after: 'start' },
    text: 'The voice on the night shift that hands out the work and reads out the bill. Never gave a name. Sounds tired in a way sleep does not fix.' },
  { id: 'brenn', name: 'Director Brenn', portrait: 'portrait-hadron', role: 'Hadron Mining', when: { after: 'intro-2' },
    text: 'Runs the pits of Hadron Mining and counts everything in them, pilots included. Pays promptly. Remembers who cost him money.' },
  { id: 'varga', name: 'Analyst Varga', portrait: 'portrait-lumen', role: 'Lumen Systems', when: { after: 'intro-2' },
    text: 'Files people the way Lumen files data: neatly, and for later. Being called reliable by her is a pay grade.' },
  { id: 'tamsin', name: 'Tamsin', portrait: 'portrait-undertow', role: 'The Undertow', when: { after: 'intro-2' },
    text: 'Organises the Undertow from wherever the pumps still run. Pays in small notes and long memories.' },
  { id: 'guild', name: 'Guild Broker', portrait: 'portrait-guild', role: 'Night Market Guild', when: { after: 'intro-2' },
    text: 'The voice of the Night Market Guild. Half a face, many rings, and a price for everything, the lights included.' },
  { id: 'kite', name: 'Kite', portrait: 'portrait-kite', role: 'Wingman', when: { after: 'intro-2' },
    text: 'The newest licence in Varn, in a frame older than its pilot. Flies wing for a small share and thanks everyone on the radio.' },
  { id: 'ashfall', name: 'Ashfall', portrait: 'portrait-rival', role: 'Licensed pilot', when: { after: 'hadron-1' },
    text: 'Keeps turning up on the other side of the contract. Insists it is only ever business. Keeps count anyway.' },
  { id: 'marrow', name: 'Marrow', portrait: 'portrait-marrow', role: 'Wingman', when: { after: 'rival-1' },
    text: 'A siege gunner who left Hadron and is officially dead. Fires from somewhere you will not see and invoices promptly.' },
  { id: 'sixty', name: 'Old Sixty', portrait: 'portrait-sixty', role: 'Wingman', when: { after: 'choice' },
    text: 'Sixty contracts without a loss, the callsign says. Expensive, careful, and still counting something that is not contracts.' },
  { id: 'sable', name: 'Sable', portrait: 'portrait-sable', role: 'Lumen Systems', when: { met: 'sable' },
    text: 'The ace of Lumen Systems. Cold, exact, and writes up every fight afterwards. You are in the notes.' },
  { id: 'rook', name: 'Rook', portrait: 'portrait-rook', role: 'The Undertow', when: { met: 'rook' },
    text: 'Flies a scrapyard Mantis for the Undertow and laughs on an open channel. Hits harder than the laugh suggests.' },
  { id: 'krell', name: 'Krell', portrait: 'portrait-krell', role: 'Hadron Mining', when: { met: 'krell' },
    text: 'Chief of security at Hadron. Was here before the company and expects to be here after it.' },
  { id: 'actuary', name: 'The Actuary', portrait: 'portrait-actuary', role: 'Meridian Mutual', when: { after: 'audit-1' },
    text: 'The adjuster Meridian sends when a war is over. Polite, immaculate, and already knows what you are worth to the decimal.' },
  { id: 'magpie', name: 'Magpie', portrait: 'portrait-magpie', role: 'Wanted', when: { met: 'magpie' }, bounty: 'bounty-1',
    text: 'Stripped the cockpits of downed frames with the pilots still in them. Proud of the helmet collection.' },
  { id: 'dredge', name: 'Dredge', portrait: 'portrait-dredge', role: 'Wanted', when: { met: 'dredge' }, bounty: 'bounty-2',
    text: 'Ran a toll on the old mine road and collected it with a mortar.' },
  { id: 'lark', name: 'Lark', portrait: 'portrait-lark', role: 'Wanted', when: { met: 'lark' }, bounty: 'bounty-3',
    text: 'Contract killer. One shot a job from behind a tower shield, until the job was you.' },
  { id: 'hollow', name: 'Hollow', portrait: 'portrait-hollow', role: 'Wanted', when: { met: 'hollow' }, bounty: 'bounty-4',
    text: 'Cut frames open for the Night Market and left the pilots where they fell.' },
  { id: 'paragon', name: 'Paragon', portrait: 'portrait-paragon', role: 'Wanted', when: { met: 'paragon' }, bounty: 'bounty-5',
    text: 'Decorated in the war by whichever side was paying. Kept the mech, the medals and the habit.' },
  { id: 'notary', name: 'The Notary', portrait: 'portrait-notary', role: 'Wanted', when: { met: 'notary' }, bounty: 'bounty-6',
    text: 'Left Meridian with a frame, a seal and a client list, and went on foreclosing in private.' },
  { id: 'larder', name: 'Larder', portrait: 'portrait-larder', role: 'Coast Circuit', when: { met: 'larder' },
    text: 'Duels for standing up and down the coast and keeps what it wins. Named for the place a shrike hangs its catch.' },
  { id: 'argent', name: 'Argent', portrait: 'portrait-argent', role: 'Coast Circuit', when: { met: 'argent' },
    text: 'First sword of the Coast Circuit for nine seasons. Salutes before the duel and after it, and means it both times.' },
  { id: 'kiln', name: 'Kiln', portrait: 'portrait-kiln', role: 'Coast yard', when: { met: 'kiln' },
    text: 'Works pilot. Has run every machine the yard builds past its limit, and written a report on each that begins: it was fine.' },
  { id: 'vesper', name: 'Vesper', portrait: 'portrait-vesper', role: 'Coast yard', when: { met: 'vesper' },
    text: 'Works pilot. Speaks rarely and flies rarely, and the yard has learnt to pay attention to both.' },
];
