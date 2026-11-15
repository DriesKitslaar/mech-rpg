import type { Battle, Mission } from '../core/campaign';

const battle = (enemies: string[], background: string, extra: Partial<Battle> = {}): Battle => ({ enemies, background, ...extra });
const BOARD = { client: 'The Bounty Board' } as const;

/** What the board says about each of the wanted, in the order they are posted. */
const bounty = (n: number, when: string, _target: string, title: string, reward: number, scale: number, briefing: string[], debrief: string, battles: Battle[]): Mission => ({
  id: `bounty-${n}`, phase: 'side', series: 'bounty', when, title, ...BOARD, reward, scale, briefing, debrief, battles,
});

/**
 * Six pilots with a price on them, posted two an act and hunted one at a time. Each is one fight:
 * the name on the notice and whoever they brought. Bring the name down and the rest go home.
 */
export const BOUNTIES: Mission[] = [
  bounty(1, 'rival-1', 'magpie', 'Wanted: Magpie', 2400, 1, [
    'WANTED: callsign Magpie. Strips the cockpits of downed frames while the pilots are still in them.',
    'Fast, and goes for the head. Flies with two drones that are not the point. Bring Magpie down and the notice pays.',
  ], 'Magpie is grounded and the board has stamped the notice. Three pilots have asked for their helmets back.', [
    battle(['magpie', 'recon-drone', 'recon-drone'], 'bg-rooftop', { objective: { type: 'leader', target: 0 } }),
  ]),
  bounty(2, 'rival-1', 'dredge', 'Wanted: Dredge', 2900, 1.3, [
    'WANTED: callsign Dredge. Runs a toll on the old mine road and collects it with a mortar.',
    'A Bulwark on tracks. Tracks cannot boost, so it is easy to hit, and it will find whichever of your parts is already hurt.',
  ], 'The mine road is open. Dredge\'s tracks are being sold by the metre.', [
    battle(['dredge', 'gun-turret'], 'bg-mine', { objective: { type: 'leader', target: 0 } }),
  ]),
  bounty(3, 'choice', 'vesper', 'Wanted: Vesper', 3800, 1.7, [
    'WANTED: callsign Vesper. Contract killer. Takes one shot a job from behind a tower shield and has not needed two.',
    'The rail charges for a turn before it fires. A shield drone keeps Vesper covered: decide what to shoot first.',
  ], 'Vesper\'s rail is in an evidence locker. The board notes that the shield was the expensive part.', [
    battle(['vesper', 'shield-drone'], 'bg-plaza', { objective: { type: 'leader', target: 0 } }),
  ]),
  bounty(4, 'choice', 'hollow', 'Wanted: Hollow', 4300, 0.6, [
    'WANTED: callsign Hollow. Cuts frames open for the Night Market and leaves the pilots where they fall.',
    'A Mantis with a cutting torch. It has to reach you to hurt you, and it brought something to patch it up when you hurt it back.',
  ], 'Hollow is in custody and the Night Market is short one supplier. Prices went up by lunchtime.', [
    battle(['hollow', 'repair-drone'], 'bg-undercity', { objective: { type: 'leader', target: 0 } }),
  ]),
  bounty(5, 'finale', 'paragon', 'Wanted: Paragon', 5600, 1.1, [
    'WANTED: callsign Paragon. Decorated in the war by whichever side was paying, then kept the mech and the habit.',
    'Thermal weapons: every hit heats you. A jammer mast spoils your aim while it stands. Vent early.',
  ], 'Paragon surrendered the frame and three sets of medals. The board kept the medals as a deposit.', [
    battle(['paragon', 'jammer'], 'bg-foundry', { objective: { type: 'leader', target: 0 } }),
  ]),
  bounty(6, 'finale', 'notary', 'Wanted: The Notary', 7000, 1, [
    'WANTED: The Notary. Left Meridian with a frame, a seal and a client list, and has been foreclosing on people privately.',
    'An Auditor frame behind a barrier, with lien drones that drain your energy. The last notice on the board, and the largest.',
  ], 'The seal is broken and the client list is public. Several people in Varn slept well for the first time in years.', [
    battle(['notary', 'lien-drone', 'lien-drone'], 'bg-vault', { objective: { type: 'leader', target: 0 } }),
  ]),
];

/**
 * Contracts that come out of what the pilot decided when the story asked: somebody returning a
 * favour, or collecting on one.
 */
export const FAVOURS: Mission[] = [
  {
    id: 'favour-kite', phase: 'side', when: 'chose:kite=vouch', title: 'Second Week', client: 'Kite', portrait: 'portrait-kite', reward: 1400, scale: 1,
    briefing: [
      'It\'s Kite. I took a job on my own. Escort, easy money. My left leg seized in the freight lane and the easy money is circling.',
      'I vouched for myself on this one, so. If you could keep them off my frame until recovery gets here, I\'d owe you twice.',
    ],
    debrief: 'Kite\'s frame is on a flatbed and Kite is on the radio thanking everyone, including the flatbed.',
    battles: [battle(['recon-drone', 'gunship', 'recon-drone'], 'bg-neon-district', { objective: { type: 'protect', name: 'Kite\'s Frame', hp: 10 } })],
  },
  {
    id: 'favour-undertow', phase: 'side', when: 'chose:logs=keep', title: 'What Gets Around', client: 'Tamsin, The Undertow', portrait: 'portrait-undertow', reward: 1900, scale: 2.4,
    briefing: [
      'Somebody sold Lumen a map of the east gate anyway. Not you. We know who doesn\'t talk.',
      'Their machines are at the gate now. Hold it until the pumps are sealed. Six rounds. Nobody has to win, they just have to not get in.',
    ],
    debrief: 'The pumps are sealed and the gate held. Tamsin sends the fee in small notes, which is how the Undertow says thank you.',
    battles: [battle(['heavy-mech', 'light-mech', 'gunship'], 'bg-sluice', { objective: { type: 'survive', rounds: 6 } })],
  },
  {
    id: 'favour-lumen', phase: 'side', when: 'chose:logs=sell', title: 'Preferred Supplier', client: 'Analyst Varga, Lumen Systems', portrait: 'portrait-lumen', reward: 2300, scale: 1.7,
    briefing: [
      'Your logs showed us a Hadron relay we did not know we were missing. You are owed the first refusal on removing it.',
      'One turret is the relay. The rest are there to keep it standing. Remove the relay and they will stop caring.',
    ],
    debrief: 'The relay is off the air. Varga has filed you under "reliable", which at Lumen is a pay grade.',
    battles: [battle(['gun-turret', 'tank', 'recon-drone'], 'bg-mine', { objective: { type: 'leader', target: 0 } })],
  },
  {
    id: 'favour-ashfall', phase: 'side', when: 'chose:rival=pull', title: 'Owed', client: 'Ashfall', portrait: 'portrait-rival', reward: 2600, scale: 1,
    briefing: [
      'I have a contract I can\'t fly. Doctor says six weeks, the client says tonight. You pulled me out, so you get it. Don\'t read into that.',
      'A stalker and its spotter on the rooftops. The stalker aims for the head. I\'d take its legs first, but I would, wouldn\'t I.',
    ],
    debrief: 'Done. Ashfall forwards the whole fee, less nothing, with the note: "Now we\'re even. Almost."',
    battles: [battle(['stalker', 'recon-drone'], 'bg-rooftop')],
  },
  {
    id: 'favour-marrow', phase: 'side', when: 'chose:marrow=cover', title: 'Paid in Ordnance', client: 'Marrow', portrait: 'portrait-marrow', reward: 3000, scale: 1,
    briefing: [
      'Hadron sent a recovery crew for my gun. A Bulldozer and a tank. I\'d handle it, but then they\'d know I\'m not dead.',
      'I want the Bulldozer\'s frame afterwards: take its legs and arms and leave the core standing. The fee is real. The gun stays missing.',
    ],
    debrief: 'One Bulldozer, lightly used, no limbs. Marrow says she will have it walking by spring, on her side this time.',
    battles: [battle(['bulldozer', 'tank'], 'bg-mine', { objective: { type: 'disable', target: 0 } })],
  },
  {
    id: 'favour-sixty', phase: 'side', when: 'chose:sixty=keep', title: 'The Sixty-First', client: 'Old Sixty', portrait: 'portrait-sixty', reward: 3400, scale: 1.1,
    briefing: [
      'There is a convoy going through the sluice tonight. Same road. Same sort of people in the trucks. I asked for the contract and then found I could not sit in the seat.',
      'Fly it for me. Every machine left standing takes from the convoy each round. Get them all through, and I can stop counting.',
    ],
    debrief: 'Every truck came out the far side. Old Sixty does not say anything for a while, and then pays in full.',
    battles: [
      battle(['recon-drone', 'bomb-crawler', 'gunship'], 'bg-sluice', { objective: { type: 'protect', name: 'Convoy', hp: 12 } }),
      battle(['heavy-mech', 'recon-drone'], 'bg-sluice', { objective: { type: 'protect', name: 'Convoy', hp: 10 } }),
    ],
  },
  {
    id: 'favour-dispatch', phase: 'side', when: 'chose:dispatch=forgive', title: 'Off the Books', client: 'Dispatch', portrait: 'portrait-dispatch', reward: 4200, scale: 1.15,
    briefing: [
      'Meridian keeps the paper on your debt in a branch vault. Paper. They are that kind of firm. I know which night the guard changes.',
      'This one isn\'t on my board and you were never there. A Bailiff and its drones. Leave nothing that can file a report.',
    ],
    debrief: 'There is no paper any more. Dispatch logs the night as "quiet" and, for once, sounds like she slept.',
    battles: [battle(['bailiff', 'lien-drone', 'lien-drone'], 'bg-vault')],
  },
];

export const SIDE_WORK: Mission[] = [...BOUNTIES, ...FAVOURS];
