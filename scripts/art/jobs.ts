/** Every image the game needs, with the prompt fragment that describes it. */
export type JobKind = 'legs' | 'core' | 'head' | 'arm' | 'handWeapon' | 'shoulderWeapon' | 'enemy' | 'background';
/** Which reference image fixes the look: the slender white frame or the heavy samurai frame. */
export type Family = 'light' | 'heavy';
export interface ArtJob {
  id: string;
  kind: JobKind;
  subject: string;
  /** Reference family; omitted for backgrounds, which use no reference. */
  family?: Family;
  /** Mirror horizontally after processing (enemies face the player). */
  flip?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

/** Maximum processed size per kind, in logical pixels. */
export const BOX: Record<JobKind, { w: number; h: number }> = {
  legs: { w: 60, h: 72 },
  core: { w: 52, h: 44 },
  head: { w: 36, h: 26 },
  arm: { w: 26, h: 56 },
  handWeapon: { w: 70, h: 24 },
  shoulderWeapon: { w: 44, h: 26 },
  enemy: { w: 64, h: 64 },
  background: { w: 310, h: 270 },
};

export const REFERENCE: Record<Family, string> = {
  light: 'art/reference/ref-light.png',
  heavy: 'art/reference/ref-heavy.png',
};

/** Background colour that is removed afterwards. Green, because the designs glow in magenta and cyan. */
export const KEY_COLOUR: [number, number, number] = [0, 255, 0];

export const STYLE =
  '16-bit pixel art, strict side profile view facing right, Japanese anime-style mecha design, ' +
  'crisp pixels, no anti-aliasing, no text, no ground shadow.';
export const REFERENCE_NOTE =
  'The attached image is the design and style reference: match its armour shapes, colours, glowing accents, ' +
  'pixel size, outline weight and shading exactly.';
export const FRAMING =
  'Show only this single component, upright, centred, filling most of the frame, on a solid pure green #00FF00 background. ' +
  'Use no green anywhere on the component itself.';

/**
 * Default quality. Low keeps each request well inside the 30-second limit some networks impose
 * and has proven sharp enough once the image is reduced to sprite size.
 */
export const QUALITY = 'low' as const;
export const qualityFor = (job: ArtJob): 'low' | 'medium' | 'high' => job.quality ?? QUALITY;

export function promptFor(job: ArtJob): string {
  if (job.kind === 'background') return job.subject;
  return `${STYLE} ${REFERENCE_NOTE} Draw: ${job.subject} ${FRAMING}`;
}

const LEGS = 'only the lower body of this mecha: the hip block and both legs with their feet, standing straight. Nothing above the waist: no torso, no arms.';
const CORE = 'only the torso of this mecha, from the waist up to the neck: chest and back armour. No head, no arms, no shoulder armour, no legs.';
const HEAD = 'only the head of this mecha, facing right. No neck, no body.';
const ARM = 'only one arm of this mecha, hanging straight down: shoulder armour at the top, upper arm, forearm and hand at the bottom. One single arm, vertical, no body, no weapon.';

export const JOBS: ArtJob[] = [
  { id: 'legs-strider', kind: 'legs', family: 'light', subject: LEGS },
  { id: 'legs-proof-b', kind: 'legs', family: 'heavy', subject: LEGS + ' Include the armoured skirt plates over the hips.' },
  { id: 'core-hauler', kind: 'core', family: 'light', subject: CORE },
  { id: 'core-proof-b', kind: 'core', family: 'heavy', subject: CORE },
  { id: 'head-scout-mk1', kind: 'head', family: 'light', subject: HEAD + ' Keep its visor band and single swept-back antenna.' },
  { id: 'head-proof-b', kind: 'head', family: 'heavy', subject: HEAD + ' Keep its helmet and single curved crest.' },
  { id: 'arms-rigger', kind: 'arm', family: 'light', subject: ARM },
  { id: 'arms-proof-b', kind: 'arm', family: 'heavy', subject: ARM + ' Keep the layered shoulder plates.' },
  { id: 'wpn-rivet-rifle', kind: 'handWeapon', family: 'light',
    subject: 'a long handheld rifle sized for this mecha, in gunmetal and navy with a few cyan lights, lying exactly horizontal, barrel pointing right, grip near the left end. The rifle only, no hand, no mecha.' },
  { id: 'wpn-arc-pistol', kind: 'handWeapon', family: 'light',
    subject: 'a compact handheld energy pistol sized for this mecha, white and navy with glowing cyan coil rings around the barrel, lying exactly horizontal, muzzle pointing right. The pistol only, no hand, no mecha.' },
  { id: 'wpn-mortar-pod', kind: 'shoulderWeapon', family: 'heavy',
    subject: 'a boxy shoulder-mounted equipment pod for this robot, as in a retro video game: a rectangular charcoal and deep red housing with six short round tubes in two rows on its right face, magenta lights and a mounting bracket underneath, exactly horizontal. The pod only, no mecha.' },
  { id: 'enemy-recon-drone', kind: 'enemy', family: 'heavy', flip: true,
    subject: 'a small hovering security drone in the same dark charcoal and deep red armour: a compact body with two ducted rotors, one glowing magenta sensor eye and a small barrel underneath. The whole drone, nothing else, no mecha.' },
  { id: 'enemy-gun-turret', kind: 'enemy', family: 'heavy', flip: true,
    subject: 'a fixed gun turret in the same dark charcoal and deep red armour with magenta lights: a squat armoured base with one long heavy cannon barrel pointing right. The whole turret, nothing else, no mecha.' },
  { id: 'bg-neon-district', kind: 'background',
    subject: '16-bit pixel art background, no anti-aliasing: an industrial megacity district at night seen from street level, wet reflective ground filling the lower third, towering dark buildings, cranes and pipes, many glowing neon signs in pink, cyan and purple with abstract shapes instead of readable text, light haze and rain. No characters, no robots, no vehicles in the foreground.' },
];
