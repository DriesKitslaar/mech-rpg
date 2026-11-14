import type { BoardText } from '../core/board';

export const BOARD_TEXT: BoardText = {
  adjectives: [
    'Cold', 'Silent', 'Broken', 'Burning', 'Hollow', 'Rusted', 'Neon', 'Blind', 'Late', 'Buried', 'Crooked', 'Paper',
    'Black', 'Second', 'Quiet', 'Glass',
  ],
  nouns: [
    'Ledger', 'Signal', 'Harvest', 'Curfew', 'Invoice', 'Lantern', 'Tithe', 'Shift', 'Dividend', 'Rain', 'Circuit',
    'Furnace', 'Audit', 'Freight', 'Static', 'Verdict',
  ],
  clients: ['Dispatch', 'Varn Freight Union', 'District Council', 'Anonymous Client', 'Insurance Desk 9', 'Night Market Guild'],
  backgrounds: ['bg-neon-district', 'bg-mine', 'bg-plaza', 'bg-undercity'],
  places: [
    'Trouble in the freight lanes of the neon district. The client wants it gone before the morning shift.',
    'Something has dug in at the old mine works. Nobody who owns the land wants their name on this.',
    'The corporate plaza has uninvited hardware on its doorstep. Appearances matter there, so be thorough.',
    'A job in the undercity, where the signal dies and nobody files reports.',
  ],
  threats: {
    'recon-drone': 'Drones only. Light work, light pay.',
    'gun-turret': 'Expect emplaced guns. They hit hard and do not move.',
    tank: 'Armoured vehicles on site. Thick against bullets, weak against blasts.',
    gunship: 'Gunships overhead. Fast, and they shoot at everything you have.',
    'lance-tower': 'A lance tower covers the approach. It goes for the head, so kill it early.',
    'light-mech': 'A Halo Guard is on site. Quick on its feet until you take its legs.',
    stalker: 'A Wraith Stalker has been seen. Very hard to hit, and it aims for your head.',
    'heavy-mech': 'A Bulwark Enforcer holds the ground. Slow, thick, and it hunts damaged parts.',
    rival: 'A veteran mercenary is on the other side.',
    juggernaut: 'A Colossus Juggernaut is on site. Bring everything you own.',
    'shield-drone': 'A shield drone covers the rest. While it flies, they take little more than half. Shoot it first.',
    'repair-drone': 'A repair drone is patching the others up as fast as you break them. Shoot it first.',
    jammer: 'A jammer mast is spoiling everyone\'s aim but theirs. It cannot shoot back.',
    'bomb-crawler': 'One of them is a walking charge on a fuse. Kill it or brace before it reaches zero.',
    carrier: 'A drone carrier is parked on site. It will not stop launching until it is scrap.',
    marksman: 'A Halo Marksman is on overwatch. It charges for a turn, then shoots through armour.',
    ripper: 'A Mantis Ripper is loose. It jumps in and cuts, so cripple it early.',
    bulldozer: 'A Hadron Bulldozer holds the ground: tracks, a riot shield and no interest in dodging.',
  },
  debriefs: [
    'Site clear. Payment released without comment.',
    'Job done. The client has already forgotten your name, which is how you want it.',
    'Confirmed. The wreckage will be someone else\'s invoice.',
    'Contract closed. Dispatch has logged it under routine maintenance.',
  ],
  battles: (count) => (count === 1
    ? 'One engagement. In and out.'
    : `${count} engagements back to back. Field service between them, nothing more.`),
};
