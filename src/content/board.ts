import type { BoardText } from '../core/board';
import type { GrudgeText } from '../core/grudge';
import type { JobText } from '../core/jobs';
import { STRINGS } from './strings';

/** The callsigns an account's pilot can have. None is a name the game uses for anybody else. */
export const GRUDGE_NAMES = ['Brakk', 'Tally', 'Docket', 'Lapse', 'Surety', 'Margin', 'Stub', 'Escrow', 'Harrow', 'Flint', 'Thistle', 'Pike', 'Calder', 'Sorrel', 'Vandal', 'Mercer'];

/**
 * The words of an account: its notice, the lines of its briefing, what is said over its battle and what the bill
 * says. A line has gaps for what differs from one account to the next: the callsign, the machine, the weapon.
 * The gaps are filled where the line is used, so that the line is in whatever language is set then.
 */
export const GRUDGE_LINES = {
  title: 'Overdue: {name}',
  // Where it is to be, for each of the board's backgrounds in their order. They named it: there is no client.
  places: [
    'They named the place: the neon district, freight lanes.',
    'They named the place: the old mine works, past the fence.',
    'They named the place: the corporate plaza, in plain view.',
    'They named the place: the undercity, where nobody files.',
  ],
  // Who this is, at the first meeting, by how the account began.
  first: {
    beat: 'The {machine} you could not finish a few jobs back has a callsign: {name}. They would like another go, and have asked for you by name.',
    ran: 'A {machine} broke off from you a few jobs back, and its pilot has not lived it down: callsign {name}. They have asked for you by name.',
    wrecked: 'You wrecked a {machine} a few jobs back. Its pilot walked out of it: callsign {name}. They have another now, and they have asked for you by name.',
  },
  // Which meeting this is, at the second and at the third.
  again: [
    '{name} again, in that {machine}, rebuilt from the frame up. They have had time to go over the last one, and a yard to do it in.',
    '{name}, a third time. Everything they own is in that {machine} now. After this the account is closed, one way or the other.',
  ],
  // What their machine is hardened against: nothing yet, or the weapon that took most off it at the last meeting.
  hardened: [
    'They do not know what you fly yet: nothing on that machine is hardened against you.',
    'It is hardened against your {a}, which hurt it most last time: that does half to it until the hardening is shot away.',
  ],
  // What they say as the fight opens.
  opens: {
    first: {
      beat: 'Back for more? I kept the gun camera film. I watch it most nights.',
      ran: 'I ran. Everybody saw it. Nobody is going to see it twice.',
      wrecked: 'You cost me a machine. I have come to see what this one costs you.',
    },
    again: [
      'I had it rebuilt around what you did to it. Go on. Try that again.',
      'Last time. I sold the lot for this machine. Either you pay or I do.',
    ],
  },
  // What they say as their machine falls.
  falls: [
    'Not finished. You will hear from me.',
    'Again. Fine. I know what to change.',
    'That is everything I had. Account closed. Fly well.',
  ],
  // Dispatch, when the pilot is hurt: of a machine that knows no weapon, and of one that does.
  hurt: [
    'They came for you by name, and it shows. Guard when they wind up, and stay on one part.',
    'It was built for what you hit it with last time. Whatever says HALF: shoot the hardening away, or stop firing it.',
  ],
  debrief: [
    '{name} walks away from the wreck. That one keeps a list, and you are on it.',
    '{name} climbs out and is on the radio to a yard before the dust settles. There will be a third time.',
    '{name} signs the wreck over where it lies. The account is closed, and paid in full.',
  ],
};
const fill = (line: string, gaps: Record<string, string | undefined>): string => line.replace(/\{(\w+)\}/g, (_, gap: string) => gaps[gap] ?? '');

export const BOARD_TEXT: BoardText & JobText & GrudgeText = {
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
  // An account: a pilot who comes back for this one. Every line is read from `GRUDGE_LINES` as it is asked for.
  grudge: {
    names: GRUDGE_NAMES,
    title: (name) => fill(GRUDGE_LINES.title, { name }),
    get places() { return [...GRUDGE_LINES.places]; },
    first: {
      beat: (name, machine) => fill(GRUDGE_LINES.first.beat, { name, machine }),
      ran: (name, machine) => fill(GRUDGE_LINES.first.ran, { name, machine }),
      wrecked: (name, machine) => fill(GRUDGE_LINES.first.wrecked, { name, machine }),
    },
    again: [(name, machine) => fill(GRUDGE_LINES.again[0], { name, machine }), (name, machine) => fill(GRUDGE_LINES.again[1], { name, machine })],
    hardened: (weapon) => (weapon === null ? GRUDGE_LINES.hardened[0] : fill(GRUDGE_LINES.hardened[1], { a: weapon })),
    get opens() { return { first: GRUDGE_LINES.opens.first, again: [GRUDGE_LINES.opens.again[0], GRUDGE_LINES.opens.again[1]] as [string, string] }; },
    get falls() { return [GRUDGE_LINES.falls[0], GRUDGE_LINES.falls[1], GRUDGE_LINES.falls[2]] as [string, string, string]; },
    get hurt() { return [GRUDGE_LINES.hurt[0], GRUDGE_LINES.hurt[1]] as [string, string]; },
    debrief: [(name) => fill(GRUDGE_LINES.debrief[0], { name }), (name) => fill(GRUDGE_LINES.debrief[1], { name }), (name) => fill(GRUDGE_LINES.debrief[2], { name })],
  },
};
