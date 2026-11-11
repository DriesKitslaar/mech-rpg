import type { Message, Mission } from '../core/campaign';

const NEON = 'bg-neon-district';
const MINE = 'bg-mine';
const PLAZA = 'bg-plaza';
const UNDER = 'bg-undercity';

/** Every contract in the game. A playthrough takes seven of the eleven story contracts. */
export const MISSIONS: Mission[] = [
  {
    id: 'patrol', phase: 'patrol', title: 'Perimeter Sweep', client: 'Dispatch', reward: 400,
    briefing: [
      'Standing contract from the district council. Stray security drones keep drifting into the freight lanes.',
      'Clear them out. The pay is thin, but it is always there.',
    ],
    debrief: 'Lanes clear. The council thanks you with the minimum fee.',
    battles: [{ enemies: ['recon-drone', 'recon-drone'], background: NEON }],
  },
  {
    id: 'intro-1', phase: 'intro', title: 'Shakedown Run', client: 'Dispatch', reward: 600,
    briefing: [
      'Welcome to Varn, pilot. Your frame is scrap and your credit is worse, so we start small.',
      'Two drones are harassing a freight convoy. Pick a weapon, pick a target, pick the part you want to hit.',
      'The core kills. The rest cripples.',
    ],
    debrief: 'Clean enough. You get paid, the convoy gets through, nobody asks whose drones those were.',
    battles: [{ enemies: ['recon-drone', 'recon-drone'], background: NEON }],
  },
  {
    id: 'intro-2', phase: 'intro', title: 'Hot Barrel', client: 'Dispatch', reward: 800,
    briefing: [
      'An abandoned checkpoint turret has woken up and is shooting at anything that moves.',
      'It hits hard and never moves. Boost to make yourself harder to hit, and watch your heat.',
      'Push past the red line and your mech shuts down for a turn. Vent before that happens.',
    ],
    debrief: 'Turret silenced. Three clients just asked for your number. That is how it starts.',
    battles: [{ enemies: ['gun-turret'], background: MINE }],
  },
  {
    id: 'hadron-1', phase: 'faction', faction: 'hadron', title: 'Strikebreaker', client: 'Director Brenn, Hadron Mining',
    portrait: 'portrait-hadron', reward: 1600,
    briefing: [
      'Squatters have occupied Seam Nine. Unarmed. Disorganised. A nuisance, nothing more.',
      'Walk in, make noise, walk out. Hadron pays promptly and remembers its friends.',
    ],
    debrief: 'Unarmed, he said. Brenn pays in full and does not mention the tank.',
    battles: [
      { enemies: ['recon-drone', 'recon-drone', 'recon-drone'], background: UNDER },
      { enemies: ['tank', 'recon-drone'], background: UNDER },
    ],
  },
  {
    id: 'lumen-1', phase: 'faction', faction: 'lumen', title: 'Clean Extraction', client: 'Analyst Varga, Lumen Systems',
    portrait: 'portrait-lumen', reward: 1500,
    briefing: [
      'A Hadron survey station holds data that belongs to us. Its defences are automated and predictable.',
      'Disable them. Our team collects the data. You were never there, and neither were we.',
    ],
    debrief: 'Data secured. Varga confirms the transfer in four words and closes the channel.',
    battles: [
      { enemies: ['gun-turret', 'recon-drone'], background: MINE },
      { enemies: ['tank', 'gun-turret'], background: MINE },
    ],
  },
  {
    id: 'undertow-1', phase: 'faction', faction: 'undertow', title: 'Lights Out', client: 'Tamsin, The Undertow',
    portrait: 'portrait-undertow', reward: 1300,
    briefing: [
      'I will not lie to you: we cannot pay what the others pay.',
      'Lumen is cutting power to the lower levels to starve us out. Their relay is guarded by drones and one of their white machines.',
      'It is fast. Take its legs first, or you will be shooting at air.',
    ],
    debrief: 'The lower levels have light again. Tamsin sends what she promised, to the credit.',
    battles: [
      { enemies: ['recon-drone', 'recon-drone', 'recon-drone'], background: PLAZA },
      { enemies: ['light-mech'], background: PLAZA },
    ],
  },
  {
    id: 'choice-hadron', phase: 'choice', faction: 'hadron', title: 'Scorched Seam', client: 'Director Brenn, Hadron Mining',
    portrait: 'portrait-hadron', reward: 2800,
    briefing: [
      'Time to choose who your friends are, pilot. Take this and the other two will stop calling.',
      'The Undertow has dug in below Seam Nine, and Lumen is arming them. Burn both out.',
      'Hadron will own this city by morning. Be on the right side of the ledger.',
    ],
    debrief: 'The seam is quiet. Brenn calls it a successful restructuring.',
    battles: [
      { enemies: ['tank', 'recon-drone'], background: UNDER },
      { enemies: ['light-mech'], background: UNDER },
      { enemies: ['gun-turret', 'tank'], background: UNDER },
    ],
  },
  {
    id: 'choice-lumen', phase: 'choice', faction: 'lumen', title: 'Silent Partner', client: 'Analyst Varga, Lumen Systems',
    portrait: 'portrait-lumen', reward: 2600,
    briefing: [
      'This offer excludes the others. Accept, and you work with us until the matter is settled.',
      'Hadron moves its reserves through one depot. Remove the depot and its guardians.',
      'Their heavy frames are slow. Do not let that comfort you.',
    ],
    debrief: 'Depot removed. Varga adjusts a number on a screen you will never see.',
    battles: [
      { enemies: ['gun-turret', 'gun-turret'], background: MINE },
      { enemies: ['heavy-mech'], background: MINE },
      { enemies: ['heavy-mech', 'recon-drone'], background: MINE },
    ],
  },
  {
    id: 'choice-undertow', phase: 'choice', faction: 'undertow', title: 'Open the Gates', client: 'Tamsin, The Undertow',
    portrait: 'portrait-undertow', reward: 2000,
    briefing: [
      'If you take this, the companies will never hire you again. I want you to know that before you answer.',
      'The floodgates that seal the lower levels are held by both of them. Open the gates and the city is one city again.',
    ],
    debrief: 'The gates stand open. Down below, people are walking up into streets they have never seen.',
    battles: [
      { enemies: ['light-mech', 'recon-drone'], background: PLAZA },
      { enemies: ['gun-turret', 'gun-turret', 'recon-drone'], background: MINE },
      { enemies: ['heavy-mech'], background: MINE },
    ],
  },
  {
    id: 'finale-hadron', phase: 'finale', faction: 'hadron', title: 'Last Shift', client: 'Director Brenn, Hadron Mining',
    portrait: 'portrait-hadron', reward: 5000,
    briefing: [
      'Lumen has hired a specialist to stop us. Callsign Ashfall. You may have heard the name.',
      'Break their tower guard, then break their mercenary. After tonight there is one company on Varn.',
    ],
    debrief: 'Lumen Tower goes dark floor by floor. Brenn is already drafting the announcement.',
    battles: [
      { enemies: ['light-mech', 'recon-drone'], background: PLAZA },
      { enemies: ['gun-turret', 'tank'], background: PLAZA },
      { enemies: ['rival'], background: PLAZA },
    ],
  },
  {
    id: 'finale-lumen', phase: 'finale', faction: 'lumen', title: 'Zero Day', client: 'Analyst Varga, Lumen Systems',
    portrait: 'portrait-lumen', reward: 5000,
    briefing: [
      'Hadron has retained a mercenary called Ashfall to hold the central pit. The probability that you know each other is high.',
      'Remove the pit garrison and the mercenary. Lumen will handle the transition.',
    ],
    debrief: 'The pit falls silent. Somewhere a system marks Hadron Mining as an archived entity.',
    battles: [
      { enemies: ['heavy-mech', 'tank'], background: MINE },
      { enemies: ['gun-turret', 'gun-turret', 'tank'], background: MINE },
      { enemies: ['rival'], background: MINE },
    ],
  },
  {
    id: 'finale-undertow', phase: 'finale', faction: 'undertow', title: 'Daybreak', client: 'Tamsin, The Undertow',
    portrait: 'portrait-undertow', reward: 4000,
    briefing: [
      'They have stopped fighting each other. Both companies are paying one pilot to close the gates again: Ashfall.',
      'This is everything we have. Hold the gate. After tonight we either live up here, or nowhere.',
    ],
    debrief: 'Sunrise finds the gates still open. Tamsin pays you from a collection tin. It is all there.',
    battles: [
      { enemies: ['heavy-mech'], background: NEON },
      { enemies: ['light-mech', 'recon-drone'], background: NEON },
      { enemies: ['rival'], background: NEON },
    ],
  },
];

/** Shown once, after the finale. */
export const ENDINGS: Record<string, { title: string; body: string[] }> = {
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

export const MESSAGES: Message[] = [
  {
    id: 'welcome', from: 'Dispatch', subject: 'Your licence is active', after: 'start',
    body: [
      'Pilot, your mercenary licence for the Varn districts is active.',
      'Contracts pay on completion. Ammunition and repairs come out of your fee, so a sloppy win can cost you money.',
      'Parts sell back for what you paid. Experiment.',
    ],
  },
  {
    id: 'after-intro-1', from: 'Dispatch', subject: 'Not bad', after: 'intro-1',
    body: ['You shoot straight. One more job and I can put your name in front of real clients.'],
  },
  {
    id: 'clients', from: 'Dispatch', subject: 'Three offers', after: 'intro-2',
    body: [
      'Three clients want you. Hadron Mining pays best and lies most. Lumen Systems pays well and tells you nothing.',
      'The Undertow pays badly and tells the truth, which in this city is the stranger habit.',
      'Each of them stocks the shop with their gear once you have worked for them.',
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
    id: 'rival-choice', from: 'Ashfall', portrait: 'portrait-rival', subject: 'You picked a side', after: 'choice',
    body: [
      'Word travels. You have picked a side, which means the other side has picked me.',
      'Nothing personal. My old frame is on the open market now, if you want to meet me on even terms.',
    ],
  },
];
