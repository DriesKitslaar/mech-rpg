import type { Battle, Mission, TalkLine } from '../core/campaign';

const battle = (enemies: string[], background: string, extra: Partial<Battle> = {}): Battle => ({ enemies, background, ...extra });
const BOARD = { client: 'The Bounty Board' } as const;
/** Who says a line, with their face. */
const says = (who: string, portrait: string) => (at: TalkLine['at'], text: string): TalkLine => ({ at, who, text, portrait });

/**
 * What the board says about each of the wanted, in the order they are posted. The notice carries
 * the face of whoever it is for, and they have a word to say when the fight opens and when it is lost.
 */
const bounty = (
  n: number, when: string, target: string, name: string, title: string, reward: number, scale: number,
  briefing: string[], debrief: string, battles: Battle[], opening: string, yielding: string,
): Mission => {
  const speaks = says(name, `portrait-${target}`);
  return {
    id: `bounty-${n}`, phase: 'side', series: 'bounty', when, title, ...BOARD, portrait: `portrait-${target}`, reward, scale, briefing, debrief,
    battles: battles.map((b, i) => ({
      ...b, talk: [...(b.talk ?? []), ...(i === 0 ? [speaks('start', opening)] : []), ...(i === battles.length - 1 ? [speaks('win', yielding)] : [])],
    })),
  };
};

/**
 * Six pilots with a price on them, posted two an act and hunted one at a time. Each is one fight:
 * the name on the notice and whoever they brought. Bring the name down and the rest go home.
 */
export const BOUNTIES: Mission[] = [
  bounty(1, 'rival-1', 'magpie', 'Magpie', 'Wanted: Magpie', 2400, 1, [
    'WANTED: callsign Magpie. Strips the cockpits of downed frames while the pilots are still in them.',
    'Fast, and goes for the head. Flies with two drones that are not the point. Bring Magpie down and the notice pays.',
  ], 'Magpie is grounded and the board has stamped the notice. Three pilots have asked for their helmets back.', [
    battle(['magpie', 'recon-drone', 'recon-drone'], 'bg-rooftop', { objective: { type: 'leader', target: 0 } }),
  ], 'Nice helmet. I will have it when you are done with it.', 'All right, all right! Keep the helmet. Mine was nicer anyway.'),
  bounty(2, 'rival-1', 'dredge', 'Dredge', 'Wanted: Dredge', 2900, 1.3, [
    'WANTED: callsign Dredge. Runs a toll on the old mine road and collects it with a mortar.',
    'A Bulwark on tracks. Tracks cannot boost, so it is easy to hit, and it will find whichever of your parts is already hurt.',
  ], 'The mine road is open. Dredge\'s tracks are being sold by the metre.', [
    battle(['dredge', 'gun-turret'], 'bg-mine', { objective: { type: 'leader', target: 0 } }),
  ], 'The toll is one mech. Pay now, or I collect.', 'The road is yours. It was a bad road anyway.'),
  bounty(3, 'choice', 'lark', 'Lark', 'Wanted: Lark', 3800, 1.7, [
    'WANTED: callsign Lark. Contract killer. Takes one shot a job from behind a tower shield and has not needed two.',
    'The rail charges for a turn before it fires. A shield drone keeps Lark covered: decide what to shoot first.',
  ], 'Lark\'s rail is in an evidence locker. The board notes that the shield was the expensive part.', [
    battle(['lark', 'shield-drone'], 'bg-plaza', { objective: { type: 'leader', target: 0 } }),
  ], 'One shot a job. Hold still and this takes no time at all.', 'That was going to take two. I have never needed two. Take me in.'),
  bounty(4, 'choice', 'hollow', 'Hollow', 'Wanted: Hollow', 4300, 0.6, [
    'WANTED: callsign Hollow. Cuts frames open for the Night Market and leaves the pilots where they fall.',
    'A Mantis with a cutting torch and needles for the walk in. It wants to be close, and it brought something to patch it up when you hurt it back.',
  ], 'Hollow is in custody and the Night Market is short one supplier. Prices went up by lunchtime.', [
    battle(['hollow', 'repair-drone'], 'bg-undercity', { objective: { type: 'leader', target: 0 } }),
  ], 'Good frame. Clean welds. It will come apart nicely.', 'You cut deeper than I do. The Market will want your number.'),
  bounty(5, 'finale', 'paragon', 'Paragon', 'Wanted: Paragon', 5600, 1.1, [
    'WANTED: callsign Paragon. Decorated in the war by whichever side was paying, then kept the mech and the habit.',
    'Thermal weapons: every hit heats you. A jammer mast spoils your aim while it stands. Vent early.',
  ], 'Paragon surrendered the frame and three sets of medals. The board kept the medals as a deposit.', [
    battle(['paragon', 'jammer'], 'bg-foundry', { objective: { type: 'leader', target: 0 } }),
  ], 'Four armies decorated me for this. You may pay for the fifth.', 'I yield. Mind the medals. Some of them were earned.'),
  bounty(6, 'finale', 'notary', 'The Notary', 'Wanted: The Notary', 7000, 1, [
    'WANTED: The Notary. Left Meridian with a frame, a seal and a client list, and has been foreclosing on people privately.',
    'An Auditor frame behind a barrier, with lien drones that drain your energy. The last notice on the board, and the largest.',
  ], 'The seal is broken and the client list is public. Several people in Varn slept well for the first time in years.', [
    battle(['notary', 'lien-drone', 'lien-drone'], 'bg-vault', { objective: { type: 'leader', target: 0 } }),
  ], 'You are in default, pilot. This frame is the notice.', 'This is irregular. My clients will hear of... no. I suppose they will not.'),
];

const kite = says('Kite', 'portrait-kite');
const tamsin = says('Tamsin', 'portrait-undertow');
const varga = says('Analyst Varga', 'portrait-lumen');
const ashfall = says('Ashfall', 'portrait-rival');
const marrow = says('Marrow', 'portrait-marrow');
const sixty = says('Old Sixty', 'portrait-sixty');
const dispatch = says('Dispatch', 'portrait-dispatch');
const actuary = says('The Actuary', 'portrait-actuary');
/** The recorder behind the seat of the pilot's frame. */
const recorder = says('Recorder', 'portrait-recorder');
/** A line kept for a later telling: nobody says it in the first cycle. */
const again = (line: TalkLine): TalkLine => ({ ...line, cycle: 1 });

/**
 * Contracts that come out of what the pilot decided when the story asked: somebody returning a
 * favour, or collecting on one. Whoever asked is on the radio while it is flown.
 */
export const FAVOURS: Mission[] = [
  {
    id: 'favour-kite', phase: 'side', when: 'chose:kite=vouch', busy: ['kite'], title: 'Second Week', client: 'Kite', portrait: 'portrait-kite', reward: 1400, scale: 0.8,
    briefing: [
      'It\'s Kite. I took a job on my own. Escort, easy money. My left leg seized in the freight lane and the easy money is circling.',
      'I vouched for myself on this one, so. If you could keep them off my frame until recovery gets here, I\'d owe you twice.',
    ],
    debrief: 'Kite\'s frame is on a flatbed and Kite is on the radio thanking everyone, including the flatbed.',
    battles: [battle(['recon-drone', 'gunship', 'recon-drone'], 'bg-neon-district', {
      objective: { type: 'protect', name: 'Kite\'s Frame', hp: 10 },
      talk: [kite('start', 'They\'re circling. I can\'t turn the left leg. Sorry. I really did think it was easy money.'), kite('win', 'Recovery\'s here. I owe you twice. I\'m writing it down so I don\'t forget.')],
    })],
  },
  {
    id: 'favour-undertow', phase: 'side', when: 'chose:logs=keep', title: 'What Gets Around', client: 'Tamsin, The Undertow', portrait: 'portrait-undertow', reward: 1500, scale: 2.4,
    briefing: [
      'Somebody sold Lumen a map of the east gate anyway. Not you. We know who doesn\'t talk.',
      'Their machines are at the gate now. Hold it until the pumps are sealed. Six rounds. Nobody has to win, they just have to not get in.',
    ],
    debrief: 'The pumps are sealed and the gate held. Tamsin sends the fee in small notes, which is how the Undertow says thank you.',
    battles: [battle(['heavy-mech', 'light-mech', 'gunship'], 'bg-sluice', { objective: { type: 'survive', rounds: 6 }, talk: [tamsin('start', 'Six rounds until the pumps are sealed. Somebody sold them a map of this gate. It was a good map.')] })],
  },
  {
    id: 'favour-lumen', phase: 'side', when: 'chose:logs=sell', title: 'Preferred Supplier', client: 'Analyst Varga, Lumen Systems', portrait: 'portrait-lumen', reward: 2300, scale: 1.7,
    briefing: [
      'Your logs showed us a Hadron relay we did not know we were missing. You are owed the first refusal on removing it.',
      'One turret is the relay. The rest are there to keep it standing. Remove the relay and they will stop caring.',
    ],
    debrief: 'The relay is off the air. Varga has filed you under "reliable", which at Lumen is a pay grade.',
    battles: [battle(['gun-turret', 'tank', 'recon-drone'], 'bg-mine', { objective: { type: 'leader', target: 0 }, talk: [varga('start', 'The first turret is the relay. Your logs found it for us. We find that we like your logs.')] })],
  },
  {
    id: 'favour-ashfall', phase: 'side', when: 'chose:rival=pull', title: 'Owed', client: 'Ashfall', portrait: 'portrait-rival', reward: 2600, scale: 1,
    briefing: [
      'I have a contract I can\'t fly. Doctor says six weeks, the client says tonight. You pulled me out, so you get it. Don\'t read into that.',
      'A stalker and its spotter on the rooftops. The stalker aims for the head. I\'d take its legs first, but I would, wouldn\'t I.',
    ],
    debrief: 'Done. Ashfall forwards the whole fee, less nothing, with the note: "Now we\'re even. Almost."',
    battles: [battle(['stalker', 'recon-drone'], 'bg-rooftop', { talk: [ashfall('start', 'I am watching the feed from a hospital bed. Do not make me shout advice. It hurts to shout.')] })],
  },
  {
    id: 'favour-marrow', phase: 'side', when: 'chose:marrow=cover', busy: ['marrow'], title: 'Paid in Ordnance', client: 'Marrow', portrait: 'portrait-marrow', reward: 3000, scale: 1,
    briefing: [
      'Hadron sent a recovery crew for my gun. A Bulldozer and a tank. I\'d handle it, but then they\'d know I\'m not dead.',
      'I want the Bulldozer\'s frame afterwards: take its legs and arms and leave the core standing. The fee is real. The gun stays missing.',
    ],
    debrief: 'One Bulldozer, lightly used, no limbs. Marrow says she will have it walking by spring, on her side this time.',
    battles: [battle(['bulldozer', 'tank'], 'bg-mine', { objective: { type: 'disable', target: 0 }, talk: [marrow('start', 'Legs and arms. Leave the core. I\'m three streets off with the gun cold, being dead.')] })],
  },
  {
    id: 'favour-sixty', phase: 'side', when: 'chose:sixty=keep', busy: ['sixty'], title: 'The Sixty-First', client: 'Old Sixty', portrait: 'portrait-sixty', reward: 3400, scale: 1.1,
    briefing: [
      'There is a convoy going through the sluice tonight. Same road. Same sort of people in the trucks. I asked for the contract and then found I could not sit in the seat.',
      'Fly it for me. Every machine left standing takes from the convoy each round. Get them all through, and I can stop counting.',
    ],
    debrief: 'Every truck came out the far side. Old Sixty does not say anything for a while, and then pays in full.',
    battles: [
      battle(['recon-drone', 'bomb-crawler', 'gunship'], 'bg-sluice', { objective: { type: 'protect', name: 'Convoy', hp: 12 }, talk: [
        sixty('start', 'Same road. Same hour, near enough. I am on the radio and nowhere else. Bring them all through.'),
        again(recorder(2, 'Lead, where are you.')),
        again(sixty(3, '...Whose voice is that on your radio, youngster. No. Do not tell me. I know whose.')),
      ] }),
      battle(['heavy-mech', 'recon-drone'], 'bg-sluice', { objective: { type: 'protect', name: 'Convoy', hp: 10 }, talk: [sixty('last', 'One left. That is further than I got.')] }),
    ],
  },
  {
    id: 'favour-dispatch', phase: 'side', when: 'chose:dispatch=forgive', title: 'Off the Books', client: 'Dispatch', portrait: 'portrait-dispatch', reward: 4200, scale: 1.15,
    briefing: [
      'Meridian keeps the paper on your debt in a branch vault. Paper. They are that kind of firm. I know which night the guard changes.',
      'This one isn\'t on my board and you were never there. A Bailiff and its drones. Leave nothing that can file a report.',
    ],
    debrief: 'There is no paper any more. Dispatch logs the night as "quiet" and, for once, sounds rested.',
    battles: [battle(['bailiff', 'lien-drone', 'lien-drone'], 'bg-vault', { talk: [dispatch('start', 'The paper is in the third cabinet. Do not read it. I mean that kindly.')] })],
  },
];

const GUILD = { client: 'Night Market Guild', portrait: 'portrait-guild' } as const;
/** The Guild's voice: a broker who is never met, only heard, and who thinks of everything as stock. */
const broker = says('Guild Broker', 'portrait-guild');

/**
 * Four jobs for the Night Market Guild, one at a time, each about machines the story never fields:
 * the last two are machines that are a battle on their own.
 */
export const GUILD_JOBS: Mission[] = [
  {
    id: 'guild-1', phase: 'side', series: 'guild', when: 'intro-2', title: 'Quarry Guns', ...GUILD, reward: 1300, scale: 1.3,
    briefing: [
      'Somebody has dug a mortar into our quarry and put a flak walker beside it. We did not rent them the space.',
      'The mortar misses often and hurts when it does not. The walker spreads its fire all over you. Evict both.',
    ],
    debrief: 'The quarry is ours again. The Guild pays in full and asks whether the mortar tube survived. It did not.',
    battles: [battle(['mortar-nest', 'flak-walker'], 'bg-mine', { talk: [broker('start', 'Mind the quarry face while you are at it. We sell that stone.')] })],
  },
  {
    id: 'guild-2', phase: 'side', series: 'guild', when: 'rival-1', title: 'Live Wires', ...GUILD, reward: 2400, scale: 1.25,
    briefing: [
      'Lumen has planted arc pylons along our lane and hung a Railhawk over them. Every hit from a pylon heats you up.',
      'The Railhawk charges for a turn before it fires through your armour. A hunter drone runs errands for them. Clear the lane.',
    ],
    debrief: 'The lane is dark again, which is how the Night Market likes it.',
    battles: [
      battle(['arc-pylon', 'longshot', 'hunter-drone'], 'bg-neon-district', { talk: [broker('start', 'Leave the lane dark when you go. Dark is good for business.')] }),
      battle(['arc-pylon', 'breacher'], 'bg-neon-district'),
    ],
  },
  {
    id: 'guild-3', phase: 'side', series: 'guild', when: 'choice', title: 'The Scrap King', ...GUILD, reward: 5200, scale: 1,
    briefing: [
      'There is a thing under the market that eats wrecks and wears them. It was useful. Now it has started on our stalls.',
      'It closes in with a pincer that will knock you off balance and sprays flak on the way. It gets angrier twice. Bring it down.',
    ],
    debrief: 'The King is scrap again. The Guild is already arguing over who gets the shell.',
    battles: [battle(['scrap-king'], 'bg-undercity', { talk: [broker('start', 'It was a good pet once. Do not tell the stallholders I said so.')] })],
  },
  {
    id: 'guild-4', phase: 'side', series: 'guild', when: 'finale', title: 'The Night Train', ...GUILD, reward: 6800, scale: 1,
    briefing: [
      'A war train with no side left to fight for is still running the foundry loop, shelling whatever moves. Nobody will insure the line.',
      'The roof cannon charges for a turn and shoots through armour: guard or boost when it is loaded. The gun ports never wait. It cannot dodge.',
    ],
    debrief: 'The Night Train is stopped at last. The Guild has bought the wreck, the line, and by the sound of it the foundry.',
    battles: [battle(['night-train'], 'bg-foundry', { talk: [broker('start', 'Nobody will insure that line. Stop the train and we will make an offer on it.')] })],
  },
];

const UNLISTED = { client: 'Unlisted', portrait: 'portrait-recorder' } as const;

/**
 * Three contracts nobody posted, one at a time, and only in a later telling of the story: what the
 * recorder of the pilot's own frame brings up, in the order it brings it up. The second is not
 * offered to a pilot who sold the frame's logs: what it leads to was then found by somebody else.
 */
export const QUEST: Mission[] = [
  {
    id: 'quest-1', phase: 'side', series: 'quest', when: 'cycle:1&rival-1', title: 'Dead Channel', ...UNLISTED, reward: 900, scale: 0.8,
    briefing: [
      'PLAYBACK FAULT. Channel nine is carrying a live signal. Channel nine has been dead for eleven years.',
      'Source: a relay in the freight lanes, low on the wall where nobody looks. It is listening for this frame.',
      'There is no client. There is no fee. There is a relay.',
    ],
    debrief: 'The relay is dead. It held one address: a desk, and a nine. A fee arrives anyway. Nobody sent it.',
    battles: [
      battle(['lien-drone', 'lien-drone'], 'bg-neon-district', { talk: [dispatch('start', 'Those are not on my board. I do not know that livery. ...I do. I saw it once, eleven years ago.')] }),
      battle(['lien-drone', 'shield-drone', 'lien-drone'], 'bg-neon-district', { talk: [dispatch('last', 'Whoever owns those has been in this city longer than the war. Tell nobody you saw them. Least of all me.')] }),
    ],
  },
  {
    id: 'quest-2', phase: 'side', series: 'quest', when: 'cycle:1&choice&chose:logs=keep&quest-1', title: 'Low Water', ...UNLISTED, reward: 1400, scale: 1,
    briefing: [
      'PLAYBACK. Gate four, the sluice. The plate under the seat has a mark scratched in it. The mark is a place.',
      'The water is down as far as it goes. Both companies have machines on the gate. Neither has been told what for.',
      'Nobody else holds a copy of this log. Keep it that way.',
    ],
    debrief: 'Under the mark, in the silt: an iron box with nine hasps. Too deep to lift tonight. But it is there.',
    battles: [
      battle(['gun-turret', 'tank'], 'bg-sluice', { talk: [recorder('start', 'The box is in the water. I can see the lid. Marking the place on the plate.')] }),
      battle(['light-mech', 'marksman'], 'bg-sluice', { talk: [dispatch('start', 'Hadron on one side of the gate, Lumen on the other. Same standing order, same paymaster. I checked. I wish I had not.')] }),
    ],
  },
  {
    id: 'quest-3', phase: 'side', series: 'quest', when: 'cycle:1&finale&quest-2', title: 'Registered Office', ...UNLISTED, reward: 2400, scale: 1,
    briefing: [
      'PLAYBACK ENDS. There is nothing more on the tape. What follows is not recorded anywhere.',
      'The pumps are running and nobody is watching them: Meridian is busy sealing the city above. The box will lift tonight or not at all.',
      'It was on its way to be opened. Take it where it can be: down, to the door with the brass plate.',
    ],
    debrief: 'The box stands under the hooks in the hall. Nine hasps. It will not open for less than nine.',
    battles: [
      battle(['bailiff', 'lien-drone', 'lien-drone'], 'bg-sluice', { talk: [dispatch('start', 'They are sealing the gate. If the seal goes on, the box stays under it for another forty years. Break the seal crew.')] }),
      battle(['assessor'], 'bg-hall', { par: 9, talk: [actuary('start', 'Good evening. This is the registered office. It is not open to the public. It has not been open to anybody for some time.'), actuary('win', 'I shall have to minute this. There has been nothing to minute in forty years.')] }),
    ],
  },
];

export const SIDE_WORK: Mission[] = [...BOUNTIES, ...FAVOURS, ...GUILD_JOBS, ...QUEST];
