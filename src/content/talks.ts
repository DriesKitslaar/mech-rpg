import type { Scene, Talk } from '../core/campaign';

const says = (who: string, portrait?: string) => (text: string): Talk => ({ who, text, ...(portrait ? { portrait } : {}) });
const dispatch = says('Dispatch', 'portrait-dispatch');
const kite = says('Kite', 'portrait-kite');
const marrow = says('Marrow', 'portrait-marrow');
const sixty = says('Old Sixty', 'portrait-sixty');
const ashfall = says('Ashfall', 'portrait-rival');
const brenn = says('Director Brenn', 'portrait-hadron');
const varga = says('Analyst Varga', 'portrait-lumen');
const tamsin = says('Tamsin', 'portrait-undertow');
const recorder = says('Recorder', 'portrait-recorder');

/** What selling something in a conversation pays. */
export const TALK_PAY = { logs: 1200, marrow: 1500 } as const;

/**
 * The conversations between contracts, in the order they come up. Each ends with a question, and
 * what the pilot answers is remembered: it decides who will fly their wing, and what is written
 * about them when the story is over.
 */
export const TALKS: Scene[] = [
  {
    id: 'talk-kite', heading: 'THE BAY', title: 'NEW LICENCE', picture: 'bg-neon-district', after: 'intro-2', before: 'rival-1', lines: [],
    talk: [
      dispatch('You have a visitor in the bay. Says he is a pilot. His frame says otherwise.'),
      kite('Kite. Licence came through on Monday. Nobody takes a first-week pilot on a contract, so I can\'t get to a second week.'),
      kite('Put my name on one of yours. I fire when you fire, I take a small cut, and I stay out of your way.'),
      dispatch('The board lets a licensed pilot vouch for one newcomer. If he folds, your record takes the mark.'),
    ],
    choice: {
      id: 'kite', options: [
        { id: 'vouch', label: 'Vouch for him.', reply: kite('You won\'t regret it. Well. You might. But I\'ll be cheap about it.') },
        { id: 'pass', label: 'Tell him to ask someone else.', reply: kite('Fair. I\'d say the same. I\'m on the board anyway, full rate, if you change your mind.') },
      ],
    },
  },
  {
    id: 'talk-logs', heading: 'A PRIVATE LINE', title: 'THE SPARE KEY', picture: 'bg-plaza', after: 'lumen-2', before: 'rival-1', lines: [],
    talk: [
      varga('A small matter. Your mech logs everything it sees on a contract. Hadron\'s yards. The Undertow\'s gates.'),
      varga('Lumen would like copies. Nothing is taken from you. Nobody is hurt this week. The fee is generous.'),
      tamsin('Pilot. We hear who is selling what down here. People live behind those gates. Just so you have heard it from a person.'),
    ],
    choice: {
      id: 'logs', options: [
        { id: 'sell', label: `Sell the logs. (+${TALK_PAY.logs})`, pay: TALK_PAY.logs, reply: varga('Sensible. The transfer is done. You will find we remember our suppliers.') },
        { id: 'keep', label: 'The logs stay in the mech.', reply: tamsin('Huh. Noted. That gets around too.') },
      ],
    },
  },
  {
    id: 'talk-rival', heading: 'THE FREIGHT LANE', title: 'THE WRECK', picture: 'bg-neon-district', after: 'rival-1', before: 'finale', lines: [],
    talk: [
      dispatch('Ashfall walked off the field, and got four blocks. The frame is down in the freight lane with the cockpit jammed. Recovery wants forty minutes. The coolant fire wants ten.'),
      ashfall('Don\'t look at me like that. You took the same contract. Dispatch booked us both and let us find out.'),
      dispatch('...That is true. I am sorry. It paid twice.'),
    ],
    choice: {
      id: 'rival', options: [
        { id: 'pull', label: 'Tear the hatch off.', reply: ashfall('Hm. I\'ll remember which of us did that. Don\'t make it strange.') },
        { id: 'leave', label: 'Leave it to recovery.', reply: ashfall('Right. Business. I\'d have done the same, and I\'ll remember that too.') },
      ],
    },
  },
  {
    id: 'talk-marrow', heading: 'THE BAY', title: 'THE DESERTER', picture: 'bg-mine', after: 'rival-1', before: 'finale', lines: [],
    talk: [
      marrow('You\'re the one who sent Ashfall home on foot. Good. I like working with people who finish things.'),
      marrow('I flew siege for Hadron for nine years. I left with the gun. They list it as stolen and me as dead, and I\'d like to keep it that way.'),
      brenn('Pilot. Hadron pays well for word of a missing siege frame. Think about who keeps the lights on in this city.'),
    ],
    choice: {
      id: 'marrow', options: [
        { id: 'cover', label: 'Never seen her.', reply: marrow('Then I owe you one. I pay my debts in ordnance.') },
        { id: 'sell', label: `Tell Brenn where she is. (+${TALK_PAY.marrow})`, pay: TALK_PAY.marrow, reply: brenn('Noted, and paid. She will not be taking contracts again.') },
      ],
    },
  },
  {
    id: 'talk-sixty', heading: 'THE CANTEEN', title: 'SIXTY AND ONE', picture: 'still-war', after: 'choice', before: 'verdict', lines: [],
    talk: [
      sixty('Sit. I looked at your record. Somebody ought to tell you what a clean one costs.'),
      sixty('Sixty contracts, no losses. The sixty-first I lost. A convoy, in the sluice. I paid a clerk to file it under another callsign.'),
      sixty('The families were told a stranger failed them. The clerk retired last week and sent you the file. He always liked a tidy desk.'),
    ],
    choice: {
      id: 'sixty', options: [
        { id: 'keep', label: 'Burn the file.', reply: sixty('Then it dies with the two of us. I\'ll fly your wing at a friend\'s rate. It is the least and the most I have.') },
        { id: 'file', label: 'Send it to the board.', reply: sixty('Good. No, I mean it. Good. Don\'t call me, though.') },
      ],
    },
  },
  {
    id: 'talk-dispatch', heading: 'CHANNEL NINE', title: 'NIGHT SHIFT', picture: 'still-notice', after: 'finale', before: 'verdict', lines: [],
    talk: [
      dispatch('Before Meridian\'s people get here. Your debt. The one nobody called in.'),
      dispatch('I sold it. Two years ago, in a bundle, to keep this desk open. Meridian bought the bundle. That is how your name got on their list.'),
      dispatch('Every good contract I had since, I routed to you. That was me paying. It isn\'t enough and I know it.'),
    ],
    choice: {
      id: 'dispatch', options: [
        { id: 'forgive', label: 'We\'re square. Stay on the radio.', reply: dispatch('...Copy. Staying on. Whatever you decide about them, I\'m on your channel.') },
        { id: 'cut', label: 'We\'re not square. Contracts only.', reply: dispatch('Understood. Contracts only, then. For what it\'s worth, you were the best thing on my board.') },
      ],
    },
  },
  // Only in a later telling, once the frame has stood at gate four again: the pilot plays what it kept to the one who said it.
  {
    id: 'talk-playback', heading: 'CHANNEL NINE', title: 'THE TAPE', picture: 'bg-neon-district', after: 'quest-2', before: 'verdict', lines: [],
    talk: [
      recorder('Count the trucks. Count them again.'),
      dispatch('Where did you get that. ...No. Leave it running.'),
      dispatch('That is gate four. Eleven years back, on the night shift. The second escort stayed with the trucks. The second escort got the bill.'),
      dispatch('Then the second escort got a desk, because a desk was all that was going.'),
    ],
    choice: {
      id: 'frame', options: [
        { id: 'ask', label: 'Whose frame was this?', reply: dispatch('You know whose. I issued it to you myself. I wanted to see it come home, once. I am on your channel. I always was.') },
        { id: 'quiet', label: 'Say nothing. Play it again.', reply: dispatch('...Yes. That is me. Younger. Still counting. Leave it running, would you. I never heard how it ended.') },
      ],
    },
  },
];

/** One line for each thing the pilot decided, for the pages before the epilogue. */
export const REMEMBERED: Record<string, Record<string, string>> = {
  kite: {
    vouch: 'Kite made his second week, and his fiftieth. He still undercharges.',
    pass: 'Kite found someone else to vouch for him. He never says who.',
  },
  logs: {
    sell: 'Lumen\'s maps of the gates were very accurate, when the time came.',
    keep: 'Below the waterline they still say your mech keeps its mouth shut.',
  },
  rival: {
    pull: 'For as long as Ashfall flew, the story of the hatch changed with every telling. In all of them, you pulled.',
    leave: 'Ashfall never once said whose fault the limp was.',
  },
  marrow: {
    cover: 'Hadron still lists one siege frame as missing. It is very well maintained.',
    sell: 'Marrow\'s gun went back to Hadron. Marrow did not.',
  },
  sixty: {
    keep: 'Old Sixty retired at sixty-one, sure that only two people knew the count was right.',
    file: 'The board corrected a record eleven years late. Some families got a letter.',
  },
  dispatch: {
    forgive: 'Dispatch is still on the night shift. Yours is the one channel that is never muted.',
    cut: 'Dispatch still routes your contracts. Neither of you says a word that is not on the form.',
  },
  // What a pilot of a later telling did with the other side's offer for a contract.
  seam: { stand: 'Seam Nine still has its tank. Nobody on either side will say who taught it which way to point.' },
  train: { weigh: 'The weighbridge at the Hadron yard has a new dial. What the old one read was never found.' },
  lights: { dark: 'Below the gates they remember one more dark week, and who was paid for it.' },
  frame: {
    ask: 'There is a cancelled licence behind glass over the night desk now. The callsign is still cut out of it.',
    quiet: 'Some nights channel nine carries an old recording from start to finish. Nobody on the desk turns it off.',
  },
};

const remembered = (questions: string[]) => (choices: Record<string, string>): string[] =>
  questions.flatMap((q) => (Object.hasOwn(choices, q) && Object.hasOwn(REMEMBERED[q], choices[q]) ? [REMEMBERED[q][choices[q]]] : []));

/** What became of the people the pilot decided about: shown after the verdict, before the epilogue, and only if anything was decided. */
export const AFTERMATH: Scene[] = [
  { id: 'left-1', heading: 'AFTERWARDS', title: 'WHO WAS LEFT', picture: 'still-varn', after: 'verdict', lines: [], linesFor: remembered(['kite', 'logs', 'rival']) },
  { id: 'left-2', heading: 'AFTERWARDS', title: 'WHO WAS LEFT', picture: 'still-varn', after: 'verdict', lines: [], linesFor: remembered(['marrow', 'sixty', 'dispatch', 'frame']) },
  { id: 'left-3', heading: 'AFTERWARDS', title: 'WHO WAS LEFT', picture: 'still-varn', after: 'verdict', lines: [], linesFor: remembered(['seam', 'train', 'lights']) },
];
