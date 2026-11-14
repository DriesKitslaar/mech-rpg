import type { Faction, Scene, Verdict } from '../core/campaign';
import { ENDINGS, EPILOGUES } from './missions';

const FACTIONS: Faction[] = ['hadron', 'lumen', 'undertow'];
const VERDICTS: Verdict[] = ['enforce', 'default'];
/** The place each client's war ended in. */
const WON_IN: Record<Faction, string> = { hadron: 'bg-mine', lumen: 'bg-plaza', undertow: 'bg-neon-district' };
/** What the city looks like after each verdict. */
const AFTER: Record<Verdict, string> = { enforce: 'still-ledger', default: 'still-dawn' };

/** How the war ended for the client the pilot chose: the close of the second act. */
const warWon = (faction: Faction): Scene => ({
  id: `war-won-${faction}`, heading: 'THE WAR IS OVER', title: ENDINGS[faction].title, lines: ENDINGS[faction].body,
  picture: WON_IN[faction], after: `finale-${faction}`, before: 'verdict', faction,
});

const ending = (verdict: Verdict, faction: Faction): Scene => ({
  id: `ending-${verdict}-${faction}`, heading: 'EPILOGUE', title: EPILOGUES[verdict][faction].title, lines: EPILOGUES[verdict][faction].body,
  picture: AFTER[verdict], after: `verdict-${verdict}`, faction, ending: true,
});

/** The pages of story shown between contracts, in the order they come up. */
export const SCENES: Scene[] = [
  {
    id: 'act-1', heading: 'ACT I', title: 'THE WAGE', picture: 'still-varn', after: 'start', before: 'intro-1',
    lines: [
      'Varn does not sleep. It mines, it calculates, and underneath all of that it drowns.',
      'Three powers hold the city, and none of them will fight for it in person. That is what pilots are for.',
      'You have a salvaged frame, a licence and a debt. Start with the debt.',
    ],
  },
  {
    id: 'act-2', heading: 'ACT II', title: 'THE SIDE', picture: 'still-war', after: 'rival-1', before: 'finale',
    lines: [
      'The quiet contracts are over. Hadron, Lumen and the Undertow have stopped pretending.',
      'Each of them wants you, and only you. Whoever you choose, the other two will hire someone like you to stop you.',
      'Choose who you can live with. Then make it worth it.',
    ],
  },
  ...FACTIONS.map(warWon),
  {
    id: 'act-3', heading: 'ACT III', title: 'THE AUDIT', picture: 'still-notice', after: 'finale', before: 'verdict',
    lines: [
      'The war had an insurer. All three sides bought the same policy from the same firm, and none of them read it.',
      'Meridian Mutual has declared Varn a total loss. Everything in it is collateral now: the mines, the towers, the gates.',
      'Your licence is on the list. So is your mech.',
    ],
  },
  ...VERDICTS.flatMap((verdict) => FACTIONS.map((faction) => ending(verdict, faction))),
];
