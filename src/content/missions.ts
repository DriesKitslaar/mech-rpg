import type { Support } from '../core/battle';
import type { Battle, Faction, Message, Mission, TalkLine, Verdict } from '../core/campaign';

const NEON = 'bg-neon-district';
const MINE = 'bg-mine';
const PLAZA = 'bg-plaza';
const UNDER = 'bg-undercity';
const FOUNDRY = 'bg-foundry';
const VAULT = 'bg-vault';
const SLUICE = 'bg-sluice';
const ROOFTOP = 'bg-rooftop';
const CLEARING = 'bg-clearing';
const HANGAR = 'bg-garage';

const BRENN = { client: 'Director Brenn, Hadron Mining', portrait: 'portrait-hadron', faction: 'hadron' } as const;
const VARGA = { client: 'Analyst Varga, Lumen Systems', portrait: 'portrait-lumen', faction: 'lumen' } as const;
const TAMSIN = { client: 'Tamsin, The Undertow', portrait: 'portrait-undertow', faction: 'undertow' } as const;
const DISPATCH = { client: 'Dispatch', portrait: 'portrait-dispatch' } as const;

/** Who says a line, with their face. */
const says = (who: string, portrait?: string) => (at: TalkLine['at'], text: string): TalkLine => ({ at, who, text, ...(portrait ? { portrait } : {}) });
const dispatch = says('Dispatch', 'portrait-dispatch');
const brenn = says('Director Brenn', 'portrait-hadron');
const varga = says('Analyst Varga', 'portrait-lumen');
const tamsin = says('Tamsin', 'portrait-undertow');
const ashfall = says('Ashfall', 'portrait-rival');
const sable = says('Sable', 'portrait-sable');
const rook = says('Rook', 'portrait-rook');
const krell = says('Krell', 'portrait-krell');
const actuary = says('The Actuary', 'portrait-actuary');

/** Ashfall on the next roof: one shot a round at the strongest enemy standing. */
const ASHFALL_FIRE: Support = { name: 'Ashfall', damage: 30 };
/** Ashfall at the pilot's back in the clearing house, with nothing left to save ammunition for. */
const ASHFALL_ALL_IN: Support = { name: 'Ashfall', damage: 45 };
const battle = (enemies: string[], background: string, extra: Partial<Battle> = {}): Battle => ({ enemies, background, ...extra });

/**
 * Every contract in the game: the patrol and twenty-nine story contracts, of which one pilot plays eighteen.
 * Act I is the introductions, two contracts for each client and the first meeting with Ashfall; Act II
 * the choice of a client, that client's three contracts and the end of the war; Act III the audit.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'patrol', phase: 'patrol', title: 'Perimeter Sweep', ...DISPATCH, reward: 400,
    briefing: [
      'Standing contract from the district council. Stray security drones keep drifting into the freight lanes.',
      'Clear them out. The pay is thin, but it is always there.',
    ],
    debrief: 'Lanes clear. The council thanks you with the minimum fee.',
    battles: [battle(['recon-drone', 'recon-drone'], NEON)],
  },

  // Act I.
  {
    id: 'intro-1', phase: 'intro', title: 'Shakedown Run', ...DISPATCH, reward: 600,
    briefing: [
      'Welcome to Varn, pilot. Your frame is scrap and your credit is worse, so we start small.',
      'Two drones are harassing a freight convoy. Pick a weapon, pick a target, pick the part you want to hit.',
      'The core kills. The rest cripples.',
    ],
    debrief: 'Clean enough. You get paid, the convoy gets through, nobody asks whose drones those were.',
    battles: [battle(['recon-drone', 'recon-drone'], NEON, {
      talk: [
        dispatch('start', 'Two drones on the convoy. Fire, choose a weapon, choose a part. Cores kill. Everything else just hurts.'),
        dispatch('win', 'There. The city pays people for that. Not much, but it pays.'),
      ],
    })],
  },
  {
    id: 'intro-2', phase: 'intro', title: 'Hot Barrel', ...DISPATCH, reward: 800,
    briefing: [
      'An abandoned checkpoint turret has woken up and is shooting at anything that moves.',
      'It hits hard and never moves. Boost to make yourself harder to hit, and watch your heat.',
      'Push past the red line and your mech shuts down for a turn. Vent before that happens.',
    ],
    debrief: 'Turret silenced. Three clients just asked for your number. That is how it starts.',
    battles: [battle(['gun-turret'], MINE, {
      talk: [dispatch('start', 'That turret hits like rent day. Boost before you end a turn, or Guard if you would rather take it on the chin.')],
    })],
  },
  {
    id: 'hadron-1', phase: 'faction', title: 'Strikebreaker', ...BRENN, reward: 1600,
    briefing: [
      'Squatters have occupied Seam Nine. Unarmed. Disorganised. A nuisance, nothing more.',
      'Walk in, make noise, walk out. Hadron pays promptly and remembers its friends.',
    ],
    debrief: 'Unarmed, he said. Brenn pays in full and does not mention the tank.',
    battles: [
      battle(['recon-drone', 'recon-drone', 'recon-drone'], UNDER),
      battle(['tank', 'recon-drone'], UNDER, { talk: [brenn('start', 'That tank is stolen company property. Feel free to write it off.')] }),
    ],
  },
  {
    id: 'hadron-2', phase: 'faction', after: 'hadron-1', title: 'Overburden', ...BRENN, reward: 2000,
    briefing: [
      'The ore train out of Seam Nine is behind schedule, and someone has sent machines to make it later.',
      'Keep them off the train. Every one of them left standing takes a bite out of it each round.',
      'The crawlers are walking charges, and those are meant for you. Kill them or brace before the fuse runs out.',
    ],
    debrief: 'The train rolls. Brenn sends a bonus and an invoice for one dented wagon. They cancel out.',
    battles: [
      battle(['recon-drone', 'bomb-crawler', 'recon-drone'], MINE, {
        objective: { type: 'protect', name: 'Ore Train', hp: 12 },
        talk: [dispatch('start', 'Count the hostiles. That is what the train loses every round. And mind the one with the fuse.')],
      }),
      battle(['tank', 'bomb-crawler'], MINE, { objective: { type: 'protect', name: 'Ore Train', hp: 9 } }),
    ],
  },
  {
    id: 'lumen-1', phase: 'faction', title: 'Clean Extraction', ...VARGA, reward: 1500,
    briefing: [
      'A Hadron survey station holds data that belongs to us. Its defences are automated and predictable.',
      'Disable them. Our team collects the data. You were never there, and neither were we.',
    ],
    debrief: 'Data secured. Varga confirms the transfer in four words and closes the channel.',
    battles: [
      battle(['gun-turret', 'recon-drone'], MINE),
      battle(['tank', 'gun-turret'], MINE, { talk: [varga('start', 'The tank resists bullets and little else. Adjust accordingly.')] }),
    ],
  },
  {
    id: 'lumen-2', phase: 'faction', after: 'lumen-1', title: 'Line Noise', ...VARGA, reward: 2100,
    briefing: [
      'Hadron has raised a jamming mast over the survey fields. Our instruments now disagree with each other, which is unacceptable.',
      'The mast is the contract. Destroy it and its escort has no orders left to follow.',
      'While it stands, your targeting will suffer. Consider that an incentive.',
    ],
    debrief: 'The static clears. Varga notes that your accuracy improved by twenty points the moment it fell.',
    battles: [
      battle(['gun-turret', 'jammer', 'gun-turret'], MINE, {
        objective: { type: 'leader', target: 1 },
        talk: [varga('start', 'Your aim is degraded while the mast transmits. Everything else on the field is optional.')],
      }),
      battle(['tank', 'jammer', 'lance-tower'], MINE, { objective: { type: 'leader', target: 1 } }),
    ],
  },
  {
    id: 'undertow-1', phase: 'faction', title: 'Lights Out', ...TAMSIN, reward: 1300,
    briefing: [
      'I will not lie to you: we cannot pay what the others pay.',
      'Lumen is cutting power to the lower levels to starve us out. Their relay is guarded by drones and one of their white machines.',
      'It is fast. Take its legs first, or you will be shooting at air.',
    ],
    debrief: 'The lower levels have light again. Tamsin sends what she promised, to the credit.',
    battles: [
      battle(['recon-drone', 'recon-drone', 'recon-drone'], PLAZA),
      battle(['light-mech'], PLAZA, { talk: [tamsin('start', 'There it is. Legs first, pilot. Once it cannot dance, it is only a machine.')] }),
    ],
  },
  {
    id: 'undertow-2', phase: 'faction', after: 'undertow-1', scale: 2, title: 'Dry Dock', ...TAMSIN, reward: 1800,
    briefing: [
      'Hadron has found the dock where we move people out of the flooded levels. They are sending machines to close it.',
      'You do not have to win. You have to still be standing when the last boat is away.',
      'Their carrier keeps launching drones. Shoot what you like, but do not chase: hold, brace, last.',
    ],
    debrief: 'The last boat clears the sluice. Tamsin counts heads twice and gets the same number both times.',
    battles: [
      battle(['carrier', 'gun-turret'], SLUICE, {
        objective: { type: 'survive', rounds: 6 },
        talk: [tamsin('start', 'Six rounds, pilot. The boats need six rounds.'), tamsin(4, 'Second boat is away. Hold a little longer.')],
      }),
      battle(['heavy-mech', 'gunship'], SLUICE, {
        objective: { type: 'survive', rounds: 6 },
        talk: [tamsin('start', 'An Enforcer. Do not trade blows with it. Just be here when it is over.')],
      }),
    ],
  },
  {
    id: 'rival-1', phase: 'rival', scale: 1.1, title: 'Double Booking', ...DISPATCH, reward: 2600,
    briefing: [
      'Bad news, and it is mine. I sold your slot on the freight escort twice. The other buyer hired Ashfall.',
      'Clear the lane guards first. Then Ashfall will want a word, and the word will be a lance.',
      'You do not need to finish it. Put most of their core on the floor and they will remember another appointment.',
    ],
    debrief: 'Ashfall leaves at a walk. Dispatch refunds nobody and calls it a learning experience.',
    battles: [
      battle(['gunship', 'gun-turret'], NEON),
      battle(['rival'], NEON, {
        par: 6,
        objective: { type: 'driveOff', target: 0, share: 0.4 },
        talk: [
          ashfall('start', 'So you are the other booking. Nothing personal. I am simply more expensive than you.'),
          ashfall('win', 'Enough. You have cost me half a fee and a paint job. We will do this properly some day.'),
        ],
      }),
    ],
  },

  // Act II: the choice.
  {
    id: 'choice-hadron', phase: 'choice', title: 'Scorched Seam', ...BRENN, reward: 2800,
    briefing: [
      'Time to choose who your friends are, pilot. Take this and the other two will stop calling.',
      'The Undertow has dug in below Seam Nine, and Lumen is arming them. Burn both out.',
      'Hadron will own this city by morning. Be on the right side of the ledger.',
    ],
    debrief: 'The seam is quiet. Brenn calls it a successful restructuring.',
    battles: [battle(['tank', 'recon-drone'], UNDER), battle(['light-mech'], UNDER), battle(['gun-turret', 'tank'], UNDER)],
  },
  {
    id: 'choice-lumen', phase: 'choice', title: 'Silent Partner', ...VARGA, reward: 2600,
    briefing: [
      'This offer excludes the others. Accept, and you work with us until the matter is settled.',
      'Hadron moves its reserves through one depot. Remove the depot and its guardians.',
      'Their heavy frames are slow. Do not let that comfort you.',
    ],
    debrief: 'Depot removed. Varga adjusts a number on a screen you will never see.',
    battles: [battle(['gun-turret', 'gun-turret'], MINE), battle(['heavy-mech'], MINE), battle(['heavy-mech', 'recon-drone'], MINE)],
  },
  {
    id: 'choice-undertow', phase: 'choice', title: 'Open the Gates', ...TAMSIN, reward: 2000,
    briefing: [
      'If you take this, the companies will never hire you again. I want you to know that before you answer.',
      'The floodgates that seal the lower levels are held by both of them. Open the gates and the city is one city again.',
    ],
    debrief: 'The gates stand open. Down below, people are walking up into streets they have never seen.',
    battles: [
      battle(['light-mech', 'recon-drone'], PLAZA), battle(['gun-turret', 'gun-turret', 'recon-drone'], MINE), battle(['heavy-mech'], MINE),
    ],
  },

  // Act II: Hadron's war, against Lumen and the Undertow.
  {
    id: 'hadron-3', phase: 'path', scale: 0.92, title: 'Hostile Audit', ...BRENN, reward: 3400,
    briefing: [
      'Lumen keeps the proof of everything it ever stole from us in one vault. I want the vault opened. Loudly.',
      'Their shield drones cover whatever stands near them, so shoot the drones first.',
      'They will send their best pilot. Her name is Sable. Do not let her choose the distance.',
    ],
    debrief: 'The vault burns clean and white. Brenn frames a photograph of it for his office.',
    battles: [
      battle(['lance-tower', 'shield-drone', 'recon-drone'], VAULT, {
        talk: [dispatch('start', 'Shield drone. While it flies, your shots on the others do little more than half.')],
      }),
      battle(['marksman', 'shield-drone'], VAULT),
      battle(['sable'], VAULT, {
        par: 9,
        talk: [
          sable('start', 'A Hadron contractor. I have read your file. It is short, and I am about to end it.'),
          sable('win', 'Noted. I will correct for you next time.'),
        ],
      }),
    ],
  },
  {
    id: 'hadron-4', phase: 'path', title: 'Deep Water', ...BRENN, reward: 3600,
    briefing: [
      'The Undertow has floated something out of the old drowned yards. It is eating my pump stations.',
      'They call it Leviathan. It is a barge with a jaw, and it sheds walking bombs like a dog sheds hair.',
      'Blasts barely mark it. Bring beams, and keep an eye on the fuses.',
    ],
    debrief: 'Leviathan settles into the canal for good. Hadron bills the Undertow for the obstruction.',
    battles: [
      battle(['tank', 'repair-drone', 'tank'], SLUICE, {
        talk: [dispatch('start', 'Repair drone. Whatever you break, it mends. You know what to shoot first.')],
      }),
      battle(['leviathan'], SLUICE, {
        par: 10,
        talk: [dispatch('start', 'There she is. Every few turns she drops a crawler. Do not let them pile up.')],
      }),
    ],
  },
  {
    id: 'hadron-5', phase: 'path', title: 'Asset Recovery', ...BRENN, reward: 3500,
    briefing: [
      'The Undertow has built a frame that jumps. My engineers would like to take it apart slowly.',
      'So do not destroy it. Take off its legs and its arms and leave the core alone. A dead prototype is scrap.',
      'It has a repair drone with it. That is your problem, not mine.',
    ],
    debrief: 'The Mantis is winched onto a flatbed, still twitching. Brenn pays in full, for once without comment.',
    battles: [
      battle(['gunship', 'tank'], UNDER),
      battle(['ripper', 'repair-drone'], UNDER, {
        objective: { type: 'disable', target: 0 },
        talk: [brenn('start', 'Legs and arms, pilot. If that core goes out, so does your fee.')],
      }),
    ],
  },

  // Act II: Lumen's war, against Hadron and the Undertow.
  {
    id: 'lumen-3', phase: 'path', title: 'Blunt Instrument', ...VARGA, reward: 3600,
    briefing: [
      'Hadron has armed a mining machine and pointed it at our eastern campus. It is roughly the size of the campus.',
      'It is called the Strip-Miner. Its hull laughs at bullets. Energy weapons are indicated.',
      'It cannot dodge and it cannot be reasoned with. Remove it before it arrives.',
    ],
    debrief: 'The Strip-Miner stops forty metres short of the campus fence. Varga calls the margin adequate.',
    battles: [
      battle(['bulldozer', 'gun-turret'], FOUNDRY, {
        talk: [dispatch('start', 'Bulldozer. Tracks and a riot shield. It cannot dodge, so nothing you fire at it is wasted.')],
      }),
      battle(['strip-miner'], FOUNDRY, {
        par: 9,
        talk: [varga('start', 'Kinetic fire is wasted on the hull and the wheel arm. Energy weapons go through all of it.')],
      }),
    ],
  },
  {
    id: 'lumen-4', phase: 'path', title: 'Scrap Tide', ...VARGA, reward: 3400,
    briefing: [
      'The Undertow is sending its machines up through the service levels. Crawlers first, then their champion.',
      'His callsign is Rook. He fights with a cutting torch and enjoys it, which our models find difficult to price.',
      'He closes the distance every turn. Break his legs or his arms before he breaks yours.',
    ],
    debrief: 'Rook limps home laughing. Varga files him under "unresolved" and moves on.',
    battles: [
      battle(['bomb-crawler', 'tank', 'bomb-crawler'], UNDER, { talk: [dispatch('start', 'Two crawlers, two fuses. Kill one, brace for the other.')] }),
      battle(['rook'], UNDER, {
        par: 8,
        talk: [
          rook('start', 'Lumen sent a person! I was told they only had spreadsheets. Come on, then.'),
          rook('win', 'Ha! All right, all right. That one is yours. Buy me a drink when this is over.'),
        ],
      }),
    ],
  },
  {
    id: 'lumen-5', phase: 'path', title: 'Clean Room', ...VARGA, reward: 3500,
    briefing: [
      'Hadron and the Undertow have each sent machines for the core stack. For once they agree on something.',
      'The stack cannot defend itself and cannot be rebuilt. Every hostile left standing damages it each round.',
      'Prioritise. We will not tell you how. That is what you are paid for.',
    ],
    debrief: 'The stack hums on, intact. Varga sends a number with more digits than usual and no words.',
    battles: [
      battle(['bomb-crawler', 'gunship', 'bomb-crawler'], VAULT, { objective: { type: 'protect', name: 'Core Stack', hp: 11 } }),
      battle(['tank', 'repair-drone', 'gunship'], VAULT, { objective: { type: 'protect', name: 'Core Stack', hp: 12 } }),
    ],
  },

  // Act II: the Undertow's war, against Hadron and Lumen.
  {
    id: 'undertow-3', phase: 'path', scale: 1.15, title: 'Foreman', ...TAMSIN, reward: 3000,
    briefing: [
      'Hadron runs its pits through one man. Krell. He has broken every strike this city ever had.',
      'He hides behind a jammer and a tower shield. Take the mast down first, then take him down.',
      'He fights dirty and he never tires. I would not ask if there were anyone else.',
    ],
    debrief: 'Krell walks away from the wreck on foot. Down below, the night shift does not clock in.',
    battles: [
      battle(['gun-turret', 'jammer', 'gun-turret'], FOUNDRY, { objective: { type: 'leader', target: 1 } }),
      battle(['krell'], FOUNDRY, {
        par: 9,
        talk: [
          krell('start', 'A scab for the scavengers. I have buried better pilots than you under better rock.'),
          krell('win', 'Huh. Tell Tamsin the pits are hers tonight. Only tonight.'),
        ],
      }),
    ],
  },
  {
    id: 'undertow-4', phase: 'path', scale: 1.2, title: 'Eye in the Tower', ...TAMSIN, reward: 3200,
    briefing: [
      'Lumen watches the lower levels through one machine. They call it the Overseer. We call it the Eye.',
      'It spoils your aim, it keeps a shield drone close, and beams slide off it. Use bullets and blasts.',
      'Put out the Eye itself, the great lens, and it shoots like a blind thing.',
    ],
    debrief: 'The Eye falls into the plaza fountain. For one night nobody below is being counted.',
    battles: [
      battle(['marksman', 'shield-drone'], PLAZA),
      battle(['overseer', 'shield-drone'], PLAZA, { par: 10, talk: [tamsin('start', 'That is it. Shoot the drone first, then put out the lens.')] }),
    ],
  },
  {
    id: 'undertow-5', phase: 'path', scale: 1.7, title: 'Water Rights', ...TAMSIN, reward: 3000,
    briefing: [
      'The pumps that keep the lower levels dry are ours tonight. Both companies want them back by morning.',
      'They will come in two waves. You cannot kill them all and you do not need to.',
      'Six rounds each time. Stand in the door and do not fall over.',
    ],
    debrief: 'Morning comes and the pumps are still turning. Tamsin brings you tea in a tin mug.',
    battles: [
      battle(['juggernaut', 'carrier'], SLUICE, { objective: { type: 'survive', rounds: 6 } }),
      battle(['stalker', 'heavy-mech', 'gunship'], SLUICE, { objective: { type: 'survive', rounds: 6 } }),
    ],
  },

  // Act II: the end of the war.
  {
    id: 'finale-hadron', phase: 'finale', scale: 1, title: 'Last Shift', ...BRENN, reward: 5000,
    briefing: [
      'Lumen has hired a specialist to stop us. Callsign Ashfall. You have met.',
      'Break their tower guard, then break their mercenary. After tonight there is one company on Varn.',
    ],
    debrief: 'Lumen Tower goes dark floor by floor. Brenn is already drafting the announcement.',
    battles: [
      battle(['light-mech', 'recon-drone'], PLAZA),
      battle(['gun-turret', 'tank'], PLAZA),
      battle(['rival-2'], PLAZA, {
        par: 8,
        talk: [
          ashfall('start', 'Lumen pays better than you would think. Shall we?'),
          ashfall('win', 'Well fought. Remember that it was only ever a contract.'),
        ],
      }),
    ],
  },
  {
    id: 'finale-lumen', phase: 'finale', scale: 1, title: 'Zero Day', ...VARGA, reward: 5000,
    briefing: [
      'Hadron has retained a mercenary called Ashfall to hold the central pit. Our records show you are acquainted.',
      'Remove the pit garrison and the mercenary. Lumen will handle the transition.',
    ],
    debrief: 'The pit falls silent. Somewhere a system marks Hadron Mining as an archived entity.',
    battles: [
      battle(['heavy-mech', 'tank'], MINE),
      battle(['gun-turret', 'gun-turret', 'tank'], MINE),
      battle(['rival-2'], MINE, {
        par: 8,
        talk: [
          ashfall('start', 'Hadron hired me to hold a hole in the ground. I have had worse postings.'),
          ashfall('win', 'There it is. Spend it wisely. They will not thank you.'),
        ],
      }),
    ],
  },
  {
    id: 'finale-undertow', phase: 'finale', scale: 1, title: 'Daybreak', ...TAMSIN, reward: 4000,
    briefing: [
      'They have stopped fighting each other. Both companies are paying one pilot to close the gates again: Ashfall.',
      'This is everything we have. Hold the gate. After tonight we either live up here, or nowhere.',
    ],
    debrief: 'Sunrise finds the gates still open. Tamsin pays you from a collection tin. It is all there.',
    battles: [
      battle(['heavy-mech'], NEON),
      battle(['light-mech', 'recon-drone'], NEON),
      battle(['rival-2'], NEON, {
        par: 8,
        talk: [
          ashfall('start', 'Both of them are paying me tonight. Twice the fee to close one gate. You understand.'),
          ashfall('win', 'Keep your gate. I hope it is worth what it cost you.'),
        ],
      }),
    ],
  },

  // Act III: the audit.
  {
    id: 'audit-1', phase: 'audit', scale: 1.22, title: 'Notice of Default', ...DISPATCH, reward: 5500,
    briefing: [
      'You are going to want to sit down. The war was insured. All three sides, the same insurer: Meridian Mutual.',
      'Meridian has ruled the whole city a total loss. Their drones are in the freight lanes putting seals on everything, my office included.',
      'Their clamps drain your generator. Clear the lane before they reach your hangar.',
    ],
    debrief: 'The lane is clear. A polite man in black leaves a message asking when it would suit you to be seized.',
    battles: [
      battle(['lien-drone', 'lien-drone', 'lien-drone'], NEON, {
        talk: [dispatch('start', 'Lien drones. Every hit takes energy out of your next turn. Kill them quickly or end up watching.')],
      }),
      battle(['bailiff', 'lien-drone'], NEON, {
        talk: [
          actuary('start', 'Good evening. I am the Actuary. You are listed as collateral. Please do not take it personally.'),
          actuary('win', 'Resisting lawful seizure. I will add it to the schedule of costs.'),
        ],
      }),
    ],
  },
  {
    id: 'audit-2', phase: 'audit', scale: 1.15, title: 'Collections', ...DISPATCH, reward: 6000,
    briefing: [
      'They are coming for the hangar. Yours. The one with your name on the lease and my chair in it.',
      'Every Meridian machine left standing tags something in there each round. Lose the hangar and you are a pilot with no mech.',
      'I will be under the desk. Good luck.',
    ],
    debrief: 'The hangar is yours for another night. Dispatch comes out from under the desk and denies ever being there.',
    battles: [
      battle(['lien-drone', 'bomb-crawler', 'lien-drone'], HANGAR, { objective: { type: 'protect', name: 'Hangar', hp: 12 } }),
      battle(['lien-drone', 'shield-drone', 'lien-drone'], HANGAR, {
        objective: { type: 'protect', name: 'Hangar', hp: 12 },
        talk: [actuary('start', 'The lease on this building lapsed at midnight. We are merely tidying up.')],
      }),
    ],
  },
  {
    id: 'audit-3', phase: 'audit', scale: 1.2, title: 'Unlikely Terms', client: 'Ashfall', portrait: 'portrait-rival', reward: 6500,
    briefing: [
      'It is me. Do not hang up. Meridian has put a lien on my frame too, and I dislike owing people.',
      'Their Assessor is walking the rooftops, pricing the city. I will shoot from the next roof. You stand in front of it.',
      'I fire at whatever is strongest, once a round. Try to deserve it.',
    ],
    debrief: 'The Assessor goes off the roof in two pieces. Ashfall says "we", once, and then corrects it.',
    battles: [
      battle(['bailiff', 'shield-drone', 'lien-drone'], ROOFTOP, {
        support: ASHFALL_FIRE,
        talk: [ashfall('start', 'I am on the east roof. One shot a round, at the biggest thing you have not killed yet.')],
      }),
      battle(['assessor'], ROOFTOP, {
        par: 8,
        support: ASHFALL_FIRE,
        talk: [
          actuary('start', 'Two debtors on one roof. Efficient. The Assessor will value you both.'),
          ashfall('win', 'Hm. We work well. Tell nobody. They want to talk to you now. So do I.'),
        ],
      }),
    ],
  },
  {
    id: 'verdict-enforce', phase: 'verdict', verdict: 'enforce', scale: 1.06, title: 'Enforce', client: 'The Actuary, Meridian Mutual',
    portrait: 'portrait-actuary', reward: 10000,
    briefing: [
      'Meridian values competence. Sign with Collections and your debt is cleared, your licence restored, your frame your own.',
      'One account remains open in Varn: the mercenary called Ashfall, who has declined our terms.',
      'Close it, and the city is settled.',
    ],
    debrief: 'Ashfall\'s frame goes dark on the roof. The Actuary shakes your hand. His is dry and very cold.',
    battles: [
      battle(['ashfall-unbound'], ROOFTOP, {
        par: 11,
        talk: [
          ashfall('start', 'I wondered which of us they would ask. I am almost flattered that it was you.'),
          ashfall('win', 'Paid in full, then. Look after the city. Somebody should have.'),
        ],
      }),
    ],
  },
  {
    id: 'verdict-default', phase: 'verdict', verdict: 'default', scale: 1.07, title: 'Default', client: 'Ashfall', portrait: 'portrait-rival', reward: 8000,
    briefing: [
      'Here is my counter-offer. Meridian\'s claim on Varn lives in one machine in their clearing house: the Adjuster.',
      'Break it and the policy is void. Nobody owns the city. Nobody owes it either, which will be new.',
      'I will be behind you, shooting. It pays less than they are offering. I thought you should hear that from me.',
    ],
    debrief: 'The Adjuster\'s scales hit the marble. Somewhere a ledger the size of a city balances to zero.',
    battles: [
      battle(['bailiff', 'lien-drone', 'shield-drone'], CLEARING, { support: ASHFALL_ALL_IN }),
      battle(['adjuster'], CLEARING, {
        par: 12,
        support: ASHFALL_ALL_IN,
        talk: [
          actuary('start', 'You are making an uninsurable decision. I want that on the record.'),
          actuary('win', 'Policy... void. I shall have to find other work. How novel.'),
        ],
      }),
    ],
  },
];

/** How the war ended for each client: shown once after the finale, before the audit begins. */
export const ENDINGS: Record<Faction, { title: string; body: string[] }> = {
  hadron: {
    title: 'ONE COMPANY',
    body: [
      'Hadron Mining owns Varn now: the pits, the towers, the air.',
      'Your account has never looked better. The city has never been quieter.',
      'Director Brenn sends a retainer offer. It is generous. It does not expire.',
    ],
  },
  lumen: {
    title: 'OPTIMISED',
    body: [
      'Lumen Systems runs Varn like a clean equation. Every light is on. Every door needs a clearance.',
      'You are paid in full, on time, with a note thanking you for your "reliable throughput".',
      'Analyst Varga does not call again. A system does it for her.',
    ],
  },
  undertow: {
    title: 'DAYBREAK',
    body: [
      'The gates stay open. The companies still exist, smaller, behind their own walls.',
      'You are poorer than the other pilots who worked this war, and the only one people wave at.',
      'Tamsin says there is always work for someone who shows up. She means it kindly.',
    ],
  },
};

/** How it all ended: one for each verdict and each client the pilot fought the war for. */
export const EPILOGUES: Record<Verdict, Record<Faction, { title: string; body: string[] }>> = {
  enforce: {
    hadron: {
      title: 'SOLVENT',
      body: [
        'Meridian keeps the mines open and keeps the receipts. Director Brenn keeps his office and reports, weekly, to a form.',
        'Varn is quiet, insured and owned. Your account is in credit for the first time in your life.',
        'Collections sends your next assignment. It is a name you do not know. It always will be.',
      ],
    },
    lumen: {
      title: 'RECONCILED',
      body: [
        'Meridian finds Lumen\'s systems admirably easy to audit and leaves them running. Analyst Varga is retained as an asset.',
        'Every light in Varn is on, every door is logged, and every log belongs to an insurer.',
        'Your licence comes back with a new crest on it. The work is the same. The clients have simply merged.',
      ],
    },
    undertow: {
      title: 'FORECLOSED',
      body: [
        'The gates you opened are still open. They have turnstiles now, and a fee.',
        'Tamsin does not call. Her people nod when you pass and say nothing, which is worse.',
        'Meridian thanks you for your service and sends the next name. You have a mech, a wage, and nobody left to explain it to.',
      ],
    },
  },
  default: {
    hadron: {
      title: 'UNINSURED',
      body: [
        'With the policy void, Hadron owns only what it can hold. It turns out to be less than Brenn told the board.',
        'The pits strike in the spring. Nobody is hired to break it: you are busy, and Ashfall is expensive.',
        'Varn is nobody\'s now. You are poorer than you were promised and freer than you were sold.',
      ],
    },
    lumen: {
      title: 'OFF THE BOOKS',
      body: [
        'Lumen\'s models have no entry for a city without an owner. Analyst Varga calls it noise. A week later she calls again, asking for rates.',
        'The towers stay lit, the doors stop asking who you are, and the data goes back to being weather.',
        'Ashfall sends a postcard with nothing written on it. You understand it anyway.',
      ],
    },
    undertow: {
      title: 'OPEN GATES',
      body: [
        'The gates stay open and nobody sends the bill. The companies shrink behind their own fences and learn to buy things.',
        'Tamsin has a council now, and arguments, and a budget that does not add up. She says it is the best problem she ever had.',
        'There is always work for a pilot who shows up. Some of it even pays.',
      ],
    },
  },
};

const FACTIONS: Faction[] = ['hadron', 'lumen', 'undertow'];
const VERDICTS: Verdict[] = ['enforce', 'default'];

/** After the finale, how the war ended can be read again in the inbox; after the verdict, how everything did. */
const warWon = (faction: Faction): Message => ({
  id: `ending-${faction}`, from: 'Epilogue', subject: ENDINGS[faction].title, after: `finale-${faction}`, body: ENDINGS[faction].body,
});
const epilogue = (verdict: Verdict, faction: Faction): Message => ({
  id: `epilogue-${verdict}-${faction}`, from: 'Epilogue', subject: EPILOGUES[verdict][faction].title, after: `verdict-${verdict}`, faction,
  body: EPILOGUES[verdict][faction].body,
});

/** Letters from the arena office: no face, only letterhead. */
const OFFICE = { from: 'Arena Office' };

export const MESSAGES: Message[] = [
  {
    id: 'welcome', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'Your licence is active', after: 'start',
    body: [
      'Pilot, your mercenary licence for the Varn districts is active.',
      'Contracts pay on completion. Ammunition and repairs come out of your fee, so a sloppy win can cost you money.',
      'Parts sell back for what you paid. Experiment.',
    ],
  },
  {
    id: 'after-intro-1', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'Not bad', after: 'intro-1',
    body: [
      'You shoot straight. One more job and I can put your name in front of real clients.',
      'Spend what you earned. A second weapon in your other hand, or one on your shoulder, lets you do more with every turn.',
    ],
  },
  {
    id: 'clients', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'Three offers', after: 'intro-2',
    body: [
      'Three clients want you. Hadron Mining pays best and lies most. Lumen Systems pays well and tells you nothing.',
      'The Undertow pays badly and tells the truth, which in this city is the stranger habit.',
      'Each of them stocks the shop with their gear once you have worked for them, and each has a second job waiting after the first.',
    ],
  },
  {
    id: 'ranks', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'About your rank', after: 'intro-2',
    body: [
      'Clients grade the work. Finish quickly, come home in one piece and leave the field repairs alone, and the grade goes up.',
      'An S pays a quarter on top of the fee, an A a tenth. Anything lower pays the fee and a look.',
      'Old contracts stay in the archive. You can fly them again for a share of the pay and a better grade.',
    ],
  },
  {
    id: 'rival-hello', from: 'Ashfall', portrait: 'portrait-rival', subject: 'New face', after: 'hadron-1',
    body: [
      'So you are the one in the salvage frame. I watched the feed. You have decent instincts and terrible equipment.',
      'Buy better. I would hate to be paid to kill you while you still look like that.',
    ],
  },
  {
    id: 'lumen-thanks', from: 'Analyst Varga', portrait: 'portrait-lumen', subject: 'Access granted', after: 'lumen-1',
    body: ['Your vendor clearance for Lumen equipment is active. Halo frames reward precision. Do not waste them.'],
  },
  {
    id: 'undertow-thanks', from: 'Tamsin', portrait: 'portrait-undertow', subject: 'Thank you', after: 'undertow-1',
    body: [
      'The lights are on down here because of you. We do not forget that.',
      'Our people have put something on the shelf for you. It is ugly and it works.',
    ],
  },
  {
    id: 'hadron-thanks', from: 'Director Brenn', portrait: 'portrait-hadron', subject: 'A productive start', after: 'hadron-1',
    body: ['Hadron equipment is now available to you. It is heavy because it is meant to survive. So are our friends.'],
  },
  {
    id: 'hadron-second', from: 'Director Brenn', portrait: 'portrait-hadron', subject: 'Punctuality', after: 'hadron-2',
    body: [
      'The train arrived. In this city that makes you management material.',
      'I will remember it when the time comes to choose. See that you do too.',
    ],
  },
  {
    id: 'lumen-second', from: 'Analyst Varga', portrait: 'portrait-lumen', subject: 'Signal restored', after: 'lumen-2',
    body: ['Your performance under interference was within tolerance. We are preparing an offer. Do not accept others.'],
  },
  {
    id: 'undertow-second', from: 'Tamsin', portrait: 'portrait-undertow', subject: 'Everyone made it', after: 'undertow-2',
    body: [
      'Forty-one people got out through that dock. They asked your name.',
      'I gave them your callsign instead. Names get people killed down here.',
    ],
  },
  {
    id: 'rival-after', from: 'Ashfall', portrait: 'portrait-rival', subject: 'About tonight', after: 'rival-1',
    body: [
      'You fight better than your equipment. That is rarer than the other way round.',
      'The clients are about to make you choose. Whoever you turn down will send me. Next time I will not be leaving early.',
    ],
  },
  {
    id: 'rival-choice', from: 'Ashfall', portrait: 'portrait-rival', subject: 'You picked a side', after: 'choice',
    body: [
      'Word travels. You have picked a side, which means the other side has picked me.',
      'Nothing personal. My old frame is on the open market now, if you want to meet me on even terms.',
    ],
  },
  ...FACTIONS.map(warWon),
  {
    id: 'notice', from: 'Meridian Mutual', portrait: 'portrait-actuary', subject: 'NOTICE OF DEFAULT', after: 'finale',
    body: [
      'This notice concerns policy VRN-1, War and Civil Disturbance, held jointly by Hadron Mining, Lumen Systems and the association known as the Undertow.',
      'Following total loss, all insured assets in the city of Varn pass to Meridian Mutual. Your pilot licence and your frame are listed in Schedule C.',
      'No action is required of you at this time. An adjuster will call.',
    ],
  },
  {
    id: 'ashfall-cockpit', from: 'Ashfall', portrait: 'portrait-rival', subject: 'A proposal', after: 'audit-2',
    body: [
      'They took my hangar this morning. I am sleeping in the cockpit, which I have not done since I was twenty.',
      'We should talk, you and I. There is a job. I cannot pay you. Call it a pooling of grievances.',
    ],
  },
  {
    id: 'two-offers', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'Two offers', after: 'audit-3',
    body: [
      'Meridian wants you on staff. Ashfall wants you on the floor of their clearing house with a gun.',
      'You can only answer one of them, and whichever you pick is the end of this. I want my office back. Choose well.',
    ],
  },
  ...VERDICTS.flatMap((verdict) => FACTIONS.map((faction) => epilogue(verdict, faction))),
  {
    ...OFFICE, id: 'mirror-match', subject: 'A proposal', after: 'arena:3',
    body: [
      'You have a following now, so the office has a proposal: a mirror match.',
      'Our house pilot flies a copy of your own mech against you. Your frame, your weapons, whatever you have fitted that day. The crowd loves it.',
      'Full purse the first time you win, a quarter after that. It is on the arena list under the ladder.',
    ],
  },
  {
    ...OFFICE, id: 'back-room', subject: 'A door behind the pit', after: 'arena:10',
    body: [
      'Champion. There is a room behind the pit that the crowd does not know about.',
      'Five pilots fight there who stopped caring about the ladder years ago. They have asked to meet you.',
      'No rules change. The purses do.',
    ],
  },
  {
    id: 'meridian-stock', from: 'Dispatch', portrait: 'portrait-dispatch', subject: 'Meridian\'s stock', after: 'verdict',
    body: [
      'Whatever else happened, a great deal of black and gold equipment is suddenly on the market.',
      'The Auditor frame and three of their weapons are in the shop. They cost what you would expect from an insurer.',
    ],
  },
];
