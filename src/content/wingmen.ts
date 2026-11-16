import type { Wingman } from '../core/wingman';

/** The pilots for hire, cheapest first. Each takes a larger share than the last and hits harder for it. */
export const WINGMEN: Wingman[] = [
  {
    id: 'kite', name: 'Kite', damage: 18, share: 0.15, after: 'intro-2', bond: { choice: 'kite', ally: 'vouch' },
    text: 'New licence, old frame, steady hands. One shot a round at whatever looks strongest.',
    radio: { start: 'On station. Ready when you are.', kill: 'Got one! Did you see that?', cheer: 'Nice shot!', warn: 'Your core! Guard, guard!', win: 'We did it! I mean: contract done.' },
  },
  {
    id: 'marrow', name: 'Marrow', damage: 28, share: 0.25, after: 'rival-1', bond: { choice: 'marrow', ally: 'cover', enemy: 'sell' },
    text: 'Ex-Hadron. Fires a siege gun from somewhere you will not see, and invoices promptly.',
    radio: { start: 'Gun is laid. Call it.', kill: 'Target down. It is on the bill.', cheer: 'Clean.', warn: 'Your core is thin. Fix it.', win: 'Done. Invoice follows.' },
  },
  {
    id: 'sixty', name: 'Old Sixty', damage: 40, share: 0.35, after: 'choice', bond: { choice: 'sixty', ally: 'keep', enemy: 'file' },
    text: 'Sixty contracts without a loss, or so the callsign says. Expensive, and worth most of it.',
    radio: { start: 'Take your time. I have.', kill: 'One fewer. Carry on.', cheer: 'Tidy work.', warn: 'Mind your core, youngster.', win: 'Another. I stopped counting.' },
  },
];
