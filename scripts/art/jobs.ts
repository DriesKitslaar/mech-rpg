/** Every image the game needs, with the prompt fragment that describes it. */
export type JobKind = 'legs' | 'core' | 'head' | 'arm' | 'handWeapon' | 'shoulderWeapon' | 'enemy' | 'background';
export interface ArtJob {
  id: string;
  kind: JobKind;
  subject: string;
  /** Mirror horizontally after processing (enemies face the player). */
  flip?: boolean;
}

/** Maximum processed size per kind, in logical pixels. */
export const BOX: Record<JobKind, { w: number; h: number }> = {
  legs: { w: 64, h: 52 },
  core: { w: 56, h: 40 },
  head: { w: 26, h: 22 },
  arm: { w: 22, h: 44 },
  handWeapon: { w: 52, h: 20 },
  shoulderWeapon: { w: 60, h: 22 },
  enemy: { w: 96, h: 96 },
  background: { w: 310, h: 270 },
};

export const STYLE =
  '16-bit pixel art, side view facing right, muted military palette of olive, steel grey and orange accents, ' +
  'crisp pixels, no anti-aliasing, no text, no ground shadow.';
export const FRAMING =
  'Show only this single component, centred, filling most of the frame, on a solid pure magenta #FF00FF background.';
export const REFERENCE_NOTE =
  'Match the attached reference image exactly in pixel size, palette, outline weight and shading.';

export const QUALITY = 'medium' as const;

export function promptFor(job: ArtJob): string {
  if (job.kind === 'background') return job.subject;
  return `${STYLE} ${REFERENCE_NOTE} Draw: ${job.subject} ${FRAMING}`;
}

export const JOBS: ArtJob[] = [
  { id: 'legs-strider', kind: 'legs',
    subject: 'the lower body of a heavy combat mech: a hip block with two thick reverse-jointed legs, standing, both feet flat on the same level. No torso, no arms, no weapons.' },
  { id: 'legs-proof-b', kind: 'legs',
    subject: 'the lower body of a mech built as a low tracked chassis: twin tank treads with a flat hip mounting plate on top. No torso, no turret, no weapons.' },
  { id: 'core-hauler', kind: 'core',
    subject: 'the boxy, angular armoured torso block of a heavy combat mech with a cockpit hatch and side vents. Torso only: no head, no arms, no legs, no weapons.' },
  { id: 'core-proof-b', kind: 'core',
    subject: 'the slim, rounded torso pod of a light scout mech with a glass canopy at the front. Torso only: no head, no arms, no legs, no weapons.' },
  { id: 'head-scout-mk1', kind: 'head',
    subject: 'a small, flat sensor head unit of a mech with a single orange visor lens facing right. Head only, no neck, no body.' },
  { id: 'head-proof-b', kind: 'head',
    subject: 'a tall radar head unit of a mech with a round dish and one antenna. Head only, no neck, no body.' },
  { id: 'arms-rigger', kind: 'arm',
    subject: 'one single heavy mech arm hanging straight down: shoulder joint at the top, upper arm, elbow, forearm ending in a clamp hand at the bottom. One arm only, vertical, no body, no weapon.' },
  { id: 'arms-proof-b', kind: 'arm',
    subject: 'one single slender mech arm hanging straight down with a round shoulder pauldron at the top and a three-finger manipulator at the bottom. One arm only, vertical, no body, no weapon.' },
  { id: 'wpn-rivet-rifle', kind: 'handWeapon',
    subject: 'a chunky handheld mech rifle lying horizontal, barrel pointing right, grip near the left end. Weapon only, no hand.' },
  { id: 'wpn-arc-pistol', kind: 'handWeapon',
    subject: 'a compact handheld energy pistol for a mech with glowing orange coil rings around the barrel, horizontal, muzzle pointing right. Weapon only, no hand.' },
  { id: 'wpn-mortar-pod', kind: 'shoulderWeapon',
    subject: 'a shoulder-mounted multi-tube mortar launcher pod for a mech, horizontal, tubes pointing right, with a mounting bracket underneath. Weapon only.' },
  { id: 'enemy-recon-drone', kind: 'enemy', flip: true,
    subject: 'a small hovering quad-rotor reconnaissance drone with a single red sensor eye and a small stinger gun underneath. The whole drone, nothing else.' },
  { id: 'enemy-gun-turret', kind: 'enemy', flip: true,
    subject: 'a fixed armoured gun turret on a squat concrete base with one long heavy cannon barrel pointing right. The whole turret, nothing else.' },
  { id: 'bg-quarry', kind: 'background',
    subject: '16-bit pixel art background, no anti-aliasing: a wide view of an exhausted open-pit quarry on a barren planet at dusk, terraced rock walls, distant derelict mining machinery, flat empty ground filling the lower third, muted desaturated browns and greys under a dim orange sky. No characters, no robots, no vehicles in the foreground, no text.' },
];
