import type { BoardText } from '../core/board';
import type { JobText } from '../core/jobs';
import { STRINGS } from './strings';

export const BOARD_TEXT: BoardText & JobText = {
  adjectives: [
    'Cold', 'Silent', 'Broken', 'Burning', 'Empty', 'Rusted', 'Neon', 'Blind', 'Late', 'Buried', 'Crooked', 'Paper',
    'Black', 'Second', 'Quiet', 'Glass',
  ],
  nouns: [
    'Ledger', 'Signal', 'Harvest', 'Curfew', 'Invoice', 'Lantern', 'Tithe', 'Shift', 'Dividend', 'Rain', 'Circuit',
    'Furnace', 'Audit', 'Freight', 'Static', 'Verdict',
  ],
  clients: ['Dispatch', 'Varn Freight Union', 'District Council', 'Anonymous Client', 'Insurance Desk 9', 'Night Market Guild'],
  // Dispatch is somebody the pilot knows by sight; the rest are letterheads.
  faces: { Dispatch: 'portrait-dispatch' },
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
    'mortar-nest': 'A mortar nest is dug in on site. It misses often. Do not be standing there when it does not.',
    'hunter-drone': 'Hunter drones have been seen. Hard to hit, and they go for the head.',
    'flak-walker': 'A flak walker covers the site. Small blasts, three at a time, all over you.',
    breacher: 'A Breacher is on site: a ram on wheels. It will knock you off balance if it reaches you.',
    'arc-pylon': 'An arc pylon is live on site. Every hit heats you up, so vent before you have to.',
    longshot: 'A Railhawk is overhead: it charges for a turn, then shoots through armour. Kill it while it charges.',
    bulldozer: 'A Hadron Bulldozer holds the ground: tracks, a riot shield and no interest in dodging.',
  },
  debriefs: [
    'Site clear. Payment released without comment.',
    'Job done. The client has already forgotten your name, which is how you want it.',
    'Confirmed. The wreckage will be someone else\'s invoice.',
    'Contract closed. Dispatch has logged it under routine maintenance.',
  ],
  // Read where it is used, so that it is in whatever language is set then.
  battles: (count) => STRINGS.board.battles(count),
  // No contract of the story or the side work is called any of these: two rows of one name in a list are one too many.
  swarmTitles: ['Drone Season', 'Locust Hour', 'Nest Clearance', 'Rust Tide', 'Flush Order', 'Pest Notice', 'Night Hatch', 'Loose Stock'],
  swarm: 'A nest has woken up: light machines, far more of them than a field holds. As one falls the next comes on. The client pays by the head, for every one of them.',
  elite: {
    armoured: 'Among them: an armoured elite, far thicker. Pays extra.',
    overclocked: 'Among them: an overclocked elite, hitting hard. Pays extra.',
    swift: 'Among them: a swift elite, much harder to hit. Pays extra.',
    shielded: 'Among them: an elite behind a renewing barrier. Pays extra.',
  },
  // Work that asks for something else. A title begins with its kind, as a wanted notice begins with what it is.
  jobs: {
    hit: {
      titles: ['Hit: Loose End', 'Hit: Quiet Word', 'Hit: Night Clerk', 'Hit: Old Account', 'Hit: Key Witness'],
      brief: 'The fee is for one machine, marked on the field: overclocked, and hitting hard. When it falls the job is done. The rest is nobody\'s business.',
    },
    repo: {
      titles: ['Repo: Late Fees', 'Repo: Bad Paper', 'Repo: Lost Lease', 'Repo: Final Demand', 'Repo: Skipped Town'],
      brief: 'The client wants one machine back in one piece. Take its arms and legs and leave the core. Destroy it and nobody is paid.',
    },
    escort: {
      titles: ['Escort: Wage Run', 'Escort: Last Mile', 'Escort: Day Shift', 'Escort: Cold Chain', 'Escort: Fragile'],
      brief: 'The client\'s freight is under fire. Every round, each machine left standing takes a piece of it. Clear them first.',
    },
    hold: {
      titles: ['Hold: Gate Nine', 'Hold: No Relief', 'Hold: Long Shift', 'Hold: Dead Hours', 'Hold: Overtime'],
      brief: 'More is coming than the fee could ask you to beat. Last the rounds and relief takes over. What you break is replaced.',
    },
  },
  // What an escort keeps alive, by the place: the freight lanes, the mine, the plaza, the undercity.
  assets: ['Wage Truck', 'Ore Lift', 'Motorcade', 'Pump Barge'],
  assetSprites: ['asset-wage-truck', 'asset-ore-lift', 'asset-motorcade', 'asset-pump-barge'],
};
