/**
 * Every image the game needs, with its prompt.
 *
 * Mech frames work like a paper doll: each family is drawn once as a whole mecha in one shared
 * pose (kind 'family'), then cut into layers (kind 'layer') that keep their place in that pose.
 * Layers of different families therefore fit on each other without any scaling or shifting.
 */
export type JobKind = 'family' | 'layer' | 'handWeapon' | 'shoulderWeapon' | 'enemy' | 'enemyMech' | 'portrait' | 'background';
export type Layer = 'legs' | 'torso' | 'head' | 'armNear' | 'armFar';

export interface ArtJob {
  id: string;
  kind: JobKind;
  /** The complete prompt. */
  prompt: string;
  /** Images sent along as references; with none the image is generated from text alone. */
  references?: string[];
  /** Process this raw image instead of generating one: enemy mechs reuse the family drawings. */
  source?: string;
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
  enemyMech: { w: 84, h: 84 },
  portrait: { w: 56, h: 56 },
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

const WEAPON_STYLE = 'gunmetal body with the accent colours and glowing lights of the reference';

function portrait(id: string, who: string): ArtJob {
  return {
    id, kind: 'portrait',
    prompt: `16-bit pixel art character portrait, crisp pixels, no anti-aliasing, no text: head and shoulders of an original character, ${who}. Facing slightly to the left, serious expression, lit by pink and cyan neon from the sides, plain very dark blue background.`,
  };
}

export const JOBS: ArtJob[] = [
  // Ronin defines the pose; every other family is that pose redrawn in its own design.
  poseFamily('ronin',
    'Heavy imposing proportions inspired by samurai armour: layered shoulder plates, helmet-like head with a single ' +
    'curved crest, armoured skirt plates over the hips, dark lacquered charcoal and deep red armour with glowing magenta accent lines.'),
  family('halo', 'ronin',
    'a slender white and navy mecha with sharp angular armour panels, glowing cyan accent lights and a compact ' +
    'helmet head with a horizontal cyan visor band and one swept-back blade antenna; slimmer limbs than the first image.',
    'art/reference/ref-light.png'),
  family('salvage', 'ronin',
    'a scrappy salvaged mecha patched together from mismatched plates in faded teal and rust orange, with visible weld ' +
    'seams, bolts, a few exposed cables and one hazard-striped shoulder; its head is a simple boxy sensor unit with a single ' +
    'round amber lens. Medium build, plainer and more worn than the first image, with small amber lights.'),
  family('bulwark', 'ronin',
    'a massive industrial mining mecha in safety yellow with black hazard stripes and dark steel joints: very thick blocky ' +
    'limbs, huge square shoulders, a wide barrel chest, and a low cab-like head with a row of small white work lights. ' +
    'Bulkier than the first image, with heavy flat feet.'),

  ...layersOf('salvage', { legs: 'legs-strider', core: 'core-hauler', head: 'head-scout-mk1', arms: 'arms-rigger' }),
  ...layersOf('halo', { legs: 'legs-halo', core: 'core-halo', head: 'head-halo', arms: 'arms-halo' }),
  ...layersOf('bulwark', { legs: 'legs-bulwark', core: 'core-bulwark', head: 'head-bulwark', arms: 'arms-bulwark' }),
  ...layersOf('ronin', { legs: 'legs-ronin', core: 'core-ronin', head: 'head-ronin', arms: 'arms-ronin' }),

  item('wpn-rivet-rifle', 'handWeapon', 'halo',
    'a long handheld rifle sized for this mecha, in gunmetal and navy with a few cyan lights, lying exactly horizontal, barrel pointing right, grip near the left end. The rifle only, no hand, no mecha.'),
  item('wpn-arc-pistol', 'handWeapon', 'halo',
    'a compact handheld energy pistol sized for this mecha, white and navy with glowing cyan coil rings around the barrel, lying exactly horizontal, muzzle pointing right. The pistol only, no hand, no mecha.'),
  item('wpn-scatter-gun', 'handWeapon', 'bulwark',
    `a short, wide-barrelled handheld blaster for a robot in a retro video game, ${WEAPON_STYLE}: a stubby double barrel and a boxy stock, lying exactly horizontal, barrels pointing right. The tool only, no hand, no mecha.`),
  item('wpn-rail-lance', 'handWeapon', 'bulwark',
    `a very long, slender handheld rail rifle for a robot in a retro video game, ${WEAPON_STYLE}: two exposed parallel rails along the barrel and a chunky power pack at the back, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-pulse-carbine', 'handWeapon', 'halo',
    `a compact handheld energy carbine for a robot in a retro video game, ${WEAPON_STYLE}: a sleek body with a glowing power cell on top, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-lance-emitter', 'handWeapon', 'halo',
    `a long handheld energy emitter for a robot in a retro video game, ${WEAPON_STYLE}: a slim barrel ending in a glowing focusing crystal, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-frag-launcher', 'handWeapon', 'salvage',
    `a stubby handheld launcher for a robot in a retro video game, ${WEAPON_STYLE}: a fat short barrel with a revolving drum, patched and worn, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-mortar-pod', 'shoulderWeapon', 'ronin',
    'a boxy shoulder-mounted equipment pod for this robot, as in a retro video game: a rectangular charcoal and deep red housing with six short round tubes in two rows on its right face, magenta lights and a mounting bracket underneath, exactly horizontal. The pod only, no mecha.'),
  item('wpn-siege-cannon', 'shoulderWeapon', 'bulwark',
    `a heavy shoulder-mounted equipment unit for a robot in a retro video game, ${WEAPON_STYLE}: one thick long barrel on a square housing with a mounting bracket underneath, exactly horizontal, barrel pointing right. The unit only, no mecha.`),
  item('wpn-halo-array', 'shoulderWeapon', 'halo',
    `a shoulder-mounted emitter array for a robot in a retro video game, ${WEAPON_STYLE}: a flat panel with a row of four glowing lenses on its right face and a mounting bracket underneath, exactly horizontal. The unit only, no mecha.`),
  item('wpn-swarm-rack', 'shoulderWeapon', 'salvage',
    `a shoulder-mounted rack for a robot in a retro video game, ${WEAPON_STYLE}: a worn frame holding twelve small round tubes in three rows on its right face, with a mounting bracket underneath, exactly horizontal. The rack only, no mecha.`),
  item('enemy-recon-drone', 'enemy', 'ronin',
    'a small hovering security drone in the same dark charcoal and deep red armour: a compact body with two ducted rotors, one glowing magenta sensor eye and a small barrel underneath. The whole drone, nothing else, no mecha.', true),
  item('enemy-gun-turret', 'enemy', 'ronin',
    'a fixed gun turret in the same dark charcoal and deep red armour with magenta lights: a squat armoured base with one long heavy cannon barrel pointing right. The whole turret, nothing else, no mecha.', true),

  item('enemy-tank', 'enemy', 'salvage',
    'a squat salvaged battle tank in the same patched teal and rust plating: a low hull on two wide treads with a short stubby turret and one amber lamp. The whole tank, nothing else, no mecha.', true),

  // Enemy mechs are the family drawings themselves, mirrored: no new image needed.
  { id: 'enemy-light-mech', kind: 'enemyMech', source: 'family-halo', flip: true, prompt: '' },
  { id: 'enemy-heavy-mech', kind: 'enemyMech', source: 'family-bulwark', flip: true, prompt: '' },
  { id: 'enemy-rival', kind: 'enemyMech', source: 'family-ronin', flip: true, prompt: '' },

  portrait('portrait-hadron', 'a heavyset middle-aged mining executive with tired eyes and slicked-back grey hair, wearing a high-collared charcoal coat with a small yellow and black hazard-striped pin'),
  portrait('portrait-lumen', 'a composed woman analyst with a short dark bob, wearing a white high-tech jacket with thin glowing cyan piping and a translucent data visor over one eye'),
  portrait('portrait-undertow', 'an older resistance organiser with a weathered face and cropped white hair, wearing a patched teal work jacket and a rust-orange scarf, a smudge of oil on one cheek'),
  portrait('portrait-rival', 'a confident mercenary pilot with short black hair with one red streak and a thin scar through one eyebrow, wearing a charcoal and deep red flight suit with a glowing magenta collar ring'),

  { id: 'bg-neon-district', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: an industrial megacity district at night seen from street level, wet reflective ground filling the lower third, towering dark buildings, cranes and pipes, many glowing neon signs in pink, cyan and purple with abstract shapes instead of readable text, light haze and rain. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-mine', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a vast terraced strip mine inside a megacity at night, giant conveyor gantries and excavator arms, harsh yellow floodlights, hazard-striped barriers and a few amber neon signs with abstract shapes instead of readable text, dusty haze, flat packed-earth ground filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-plaza', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a spotless corporate research plaza at night, tall white and glass towers with thin cyan light lines, floating hologram panels with abstract shapes instead of readable text, trimmed planters, a smooth pale reflective floor filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-undercity', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a flooded lower level of a megacity, huge rusted pipes and support pillars, shacks built from scrap, strings of mismatched teal and orange neon lights, dripping water and steam, a shallow wet concrete floor filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-garage', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: the inside of a dim mecha hangar bay at night, steel gantries and catwalks, hanging chains and cables, tool racks along the walls, strips of cyan and magenta neon work lights, an empty metal floor filling the lower half. No characters, no robots, no vehicles, no text.' },
];
