/**
 * Every image the game needs, with its prompt.
 *
 * Mech frames work like a paper doll: each family is drawn once as a whole mecha in one shared
 * pose (kind 'family'), then cut into layers (kind 'layer') that keep their place in that pose.
 * Layers of different families therefore fit on each other without any scaling or shifting.
 */
export type JobKind = 'family' | 'layer' | 'handWeapon' | 'shoulderWeapon' | 'enemy' | 'background';
export type Layer = 'legs' | 'torso' | 'head' | 'armNear' | 'armFar';

export interface ArtJob {
  id: string;
  kind: JobKind;
  /** The complete prompt. */
  prompt: string;
  /** Images sent along as references; with none the image is generated from text alone. */
  references?: string[];
  /** Mirror horizontally after processing (enemies face the player). */
  flip?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

/** Side of the square pose box that a 1024 px family drawing is reduced to. Matches MECH_BOX in the game. */
export const POSE_BOX = 160;

/** Maximum processed size for free-standing sprites, in logical pixels. */
export const BOX: Record<Exclude<JobKind, 'family' | 'layer'>, { w: number; h: number }> = {
  handWeapon: { w: 58, h: 22 },
  shoulderWeapon: { w: 44, h: 26 },
  enemy: { w: 64, h: 64 },
  background: { w: 310, h: 270 },
};

/**
 * Default quality. Low keeps each request well inside the 30-second limit some networks impose
 * and has proven sharp enough once the image is reduced to sprite size.
 */
export const QUALITY = 'low' as const;
export const qualityFor = (job: ArtJob): 'low' | 'medium' | 'high' => job.quality ?? QUALITY;

const RAW = 'art/raw';
const familyFile = (family: string): string => `${RAW}/family-${family}.png`;
const PIXEL = '16-bit pixel art, crisp pixels, no anti-aliasing, no text.';
const GREEN = 'Solid pure green #00FF00 background, no green on the subject itself.';

/** The pose every family shares. The first family is drawn from this text; the others copy its pose. */
const POSE =
  'three-quarter view facing right, dynamic combat stance with legs apart and knees slightly bent, the near arm ' +
  'extended forward at hip height with a closed empty fist, the far arm bent slightly behind the body, whole body ' +
  'visible from head to feet. No weapons, nothing held in the hands.';

/** A family drawn from text. Use for the first family only: it defines the pose. */
function poseFamily(family: string, design: string): ArtJob {
  return {
    id: `family-${family}`, kind: 'family',
    prompt: `16-bit pixel art sprite of an original Japanese anime-style mecha (original design, not from any existing series), ${POSE} ${design} Crisp pixels, no anti-aliasing, no text. ${GREEN}`,
  };
}

/** A further family: the pose family redrawn in another design. `designRef` is an optional picture of that design. */
function family(family: string, poseFrom: string, design: string, designRef?: string): ArtJob {
  return {
    id: `family-${family}`, kind: 'family',
    references: [familyFile(poseFrom), ...(designRef ? [designRef] : [])],
    prompt:
      'The first image shows a mecha in a combat stance. Redraw it as a different mecha design in exactly the same ' +
      'pose, camera angle, body size and position on the canvas: every joint (head, shoulders, elbows, hands, hips, ' +
      `knees, feet) stays in the same place. The new design${designRef ? ', shown in the second image,' : ''} is: ${design} ` +
      `Keep the same proportions between joints. No weapons, empty hands. ${PIXEL} ${GREEN}`,
  };
}

const KEEP: Record<Layer, string> = {
  legs: 'only the lower body: the hips with any hip or skirt armour, both legs and both feet. Erase the torso, head and both arms.',
  torso: 'only the torso: chest, abdomen and back, from the waist up to the neck. Erase the head, both arms with their shoulder armour, the hips and the legs.',
  head: 'only the head with its helmet, crest or antenna. Erase everything below the neck.',
  armNear: 'only the arm that is extended forward towards the right side of the image, complete with its shoulder armour, forearm and fist. Erase the torso, head, legs and the other arm.',
  armFar: 'only the arm on the left side of the image that hangs back behind the body, complete with its shoulder armour, forearm and fist. Erase the torso, head, legs and the other arm.',
};

/** One layer cut from a family drawing. `id` is the sprite id the game asks for. */
function layer(id: string, fromFamily: string, which: Layer): ArtJob {
  return {
    id, kind: 'layer', references: [familyFile(fromFamily)],
    prompt:
      'Edit the attached pixel art image. Keep the listed part of the mecha exactly as it is: same pixels, same ' +
      'position, same size, same colours. Erase everything else and fill it with the same solid pure green #00FF00 ' +
      `as the background. Do not move, redraw, rescale or recentre anything. Keep: ${KEEP[which]}`,
  };
}

/** The five layers of one family, named after the parts that use them. */
function layersOf(fromFamily: string, ids: { legs: string; core: string; head: string; arms: string }): ArtJob[] {
  return [
    layer(ids.legs, fromFamily, 'legs'),
    layer(ids.core, fromFamily, 'torso'),
    layer(ids.head, fromFamily, 'head'),
    layer(`${ids.arms}.near`, fromFamily, 'armNear'),
    layer(`${ids.arms}.far`, fromFamily, 'armFar'),
  ];
}

function item(id: string, kind: 'handWeapon' | 'shoulderWeapon' | 'enemy', styleFrom: string, subject: string, flip = false): ArtJob {
  return {
    id, kind, flip, references: [familyFile(styleFrom)],
    prompt:
      `${PIXEL} Strict side view facing right. The attached image is the style reference: match its colours, glowing ` +
      `accents, pixel size, outline weight and shading. Draw: ${subject} Show only this single object, centred, ` +
      `filling most of the frame. ${GREEN}`,
  };
}

export const JOBS: ArtJob[] = [
  poseFamily('heavy',
    'Heavy imposing proportions inspired by samurai armour: layered shoulder plates, helmet-like head with a single ' +
    'curved crest, armoured skirt plates over the hips, dark lacquered charcoal and deep red armour with glowing magenta accent lines.'),
  family('light', 'heavy',
    'a slender white and navy mecha with sharp angular armour panels, glowing cyan accent lights and a compact ' +
    'helmet head with a horizontal cyan visor band and one swept-back blade antenna; slimmer limbs than the first image.',
    'art/reference/ref-light.png'),

  ...layersOf('light', { legs: 'legs-strider', core: 'core-hauler', head: 'head-scout-mk1', arms: 'arms-rigger' }),
  ...layersOf('heavy', { legs: 'legs-proof-b', core: 'core-proof-b', head: 'head-proof-b', arms: 'arms-proof-b' }),

  item('wpn-rivet-rifle', 'handWeapon', 'light',
    'a long handheld rifle sized for this mecha, in gunmetal and navy with a few cyan lights, lying exactly horizontal, barrel pointing right, grip near the left end. The rifle only, no hand, no mecha.'),
  item('wpn-arc-pistol', 'handWeapon', 'light',
    'a compact handheld energy pistol sized for this mecha, white and navy with glowing cyan coil rings around the barrel, lying exactly horizontal, muzzle pointing right. The pistol only, no hand, no mecha.'),
  item('wpn-mortar-pod', 'shoulderWeapon', 'heavy',
    'a boxy shoulder-mounted equipment pod for this robot, as in a retro video game: a rectangular charcoal and deep red housing with six short round tubes in two rows on its right face, magenta lights and a mounting bracket underneath, exactly horizontal. The pod only, no mecha.'),
  item('enemy-recon-drone', 'enemy', 'heavy',
    'a small hovering security drone in the same dark charcoal and deep red armour: a compact body with two ducted rotors, one glowing magenta sensor eye and a small barrel underneath. The whole drone, nothing else, no mecha.', true),
  item('enemy-gun-turret', 'enemy', 'heavy',
    'a fixed gun turret in the same dark charcoal and deep red armour with magenta lights: a squat armoured base with one long heavy cannon barrel pointing right. The whole turret, nothing else, no mecha.', true),

  { id: 'bg-neon-district', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: an industrial megacity district at night seen from street level, wet reflective ground filling the lower third, towering dark buildings, cranes and pipes, many glowing neon signs in pink, cyan and purple with abstract shapes instead of readable text, light haze and rain. No characters, no robots, no vehicles in the foreground.' },
];
