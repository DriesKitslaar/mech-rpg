/**
 * Every image the game needs, with its prompt.
 *
 * Mech frames work like a paper doll: each family is drawn once as a whole mecha in one shared
 * pose (kind 'family'), then cut into layers (kind 'layer') that keep their place in that pose.
 * Layers of different families therefore fit on each other without any scaling or shifting.
 */
export type JobKind =
  | 'family' | 'layer' | 'handWeapon' | 'shoulderWeapon' | 'shield' | 'enemy' | 'enemyMech' | 'boss' | 'portrait' | 'background'
  | 'still' | 'icon';
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
  /** On a family drawing that is another family with its lower body replaced: that family. */
  base?: string;
  /** On a layer: the side of the pose box its drawing is reduced to, where that is not `POSE_BOX`. */
  box?: number;
  /**
   * On a weapon or a shield made from a raw picture that is already there: the view it is made
   * for. From behind it is turned and reduced to what the mech from behind is; for a mech that
   * stands far off it is only reduced.
   */
  view?: 'back' | 'small';
  quality?: 'low' | 'medium' | 'high';
}

/** Side of the square pose box that a 1024 px family drawing is reduced to. Matches MECH_BOX in the game. */
export const POSE_BOX = 160;
/**
 * Side of the pose box a drawing of a mech from behind is reduced to. Matches BACK_BOX in the game.
 * In a battle the pilot's mech is seen from behind, nearer than anything else on the field; it is
 * drawn smaller than in the garage so that the field has room for what it faces.
 */
export const BACK_POSE_BOX = 128;
/**
 * Side of the pose box of a mech built from parts that stands far off: the other mech in a duel.
 * It is made from the same drawings from the front, reduced further. Matches SMALL_BOX in the game.
 */
export const SMALL_POSE_BOX = 104;
/** How many degrees a weapon is turned upwards when its mech is seen from behind: its arm points away, up and to the right. */
export const BACK_TILT = 12;

/** Maximum processed size for free-standing sprites, in logical pixels. */
export const BOX: Record<Exclude<JobKind, 'family' | 'layer'>, { w: number; h: number }> = {
  handWeapon: { w: 58, h: 22 },
  shoulderWeapon: { w: 44, h: 26 },
  shield: { w: 34, h: 52 },
  enemy: { w: 64, h: 64 },
  enemyMech: { w: 104, h: 104 },
  // A machine that fills the enemy's half of the field on its own.
  boss: { w: 136, h: 128 },
  portrait: { w: 56, h: 56 },
  background: { w: 310, h: 270 },
  // The picture behind a page of story.
  still: { w: 310, h: 270 },
  // The app icon: kept at full size for scripts/art/icon.ts, and reduced for the web page.
  icon: { w: 192, h: 192 },
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

/** One layer cut from a family drawing. `id` is the sprite id the game asks for. `keep` replaces the usual description of the part. */
function layer(id: string, fromFamily: string, which: Layer, keep: string = KEEP[which]): ArtJob {
  return {
    id, kind: 'layer', references: [familyFile(fromFamily)],
    prompt:
      'Edit the attached pixel art image. Keep the listed part of the mecha exactly as it is: same pixels, same ' +
      'position, same size, same colours. Erase everything else and fill it with the same solid pure green #00FF00 ' +
      `as the background. Do not move, redraw, rescale or recentre anything. Keep: ${keep}`,
  };
}

/**
 * A family drawing with only its lower body replaced: the source of a free-standing pair of legs
 * (tracks, four legs, a hover unit) that still meets every torso at the same waist.
 */
function lowerBody(id: string, fromFamily: string, description: string): ArtJob {
  return {
    id: `family-${id}`, kind: 'family', references: [familyFile(fromFamily)], base: fromFamily,
    prompt:
      'Edit the attached pixel art image of a mecha. Keep everything above the waist exactly as it is: same pixels, ' +
      'same position, same size, same colours. Replace only the lower body (the hips, both legs and both feet) with: ' +
      `${description} The new lower body joins the torso at the same waist and rests on the same ground line as the ` +
      `original feet, and is drawn in the same colours and style as the rest of the mecha. ${PIXEL} ${GREEN}`,
  };
}

/**
 * The family whose paint a frame layer takes: the family it was cut from, or, for free-standing
 * legs, the family their drawing was edited from. Legs then take a paint scheme the way the torso
 * above them does. A layer cut from a drawing from behind takes the paint of the same family.
 */
export function paintFamilyOf(layerJob: ArtJob): string {
  const name = /(?:family|back)-([a-z0-9-]+)\.png$/.exec(layerJob.references?.[0] ?? '')?.[1] ?? layerJob.id;
  return JOBS.find((job) => job.id === `family-${name}`)?.base ?? name;
}

/**
 * Per family of frame layers: every layer that takes its paint (`all`), and the layers it is judged
 * by (`judged`). A family is judged by what was cut from its own drawing from the front. The views
 * from behind and the small copies take the family's paint and do not shift it: they are the same
 * machine, and what it looks like painted in the garage must not change because it was drawn again.
 * Free-standing legs come from an edited copy of a drawing: they take that family's paint and do not
 * shift it either; a family that has nothing of its own is judged by all it has from the front.
 */
export function paintGroups(jobs: ArtJob[]): Map<string, { judged: string[]; all: string[] }> {
  const families = new Map<string, { own: string[]; front: string[]; all: string[] }>();
  for (const job of jobs) {
    if (job.kind !== 'layer') continue;
    const family = paintFamilyOf(job);
    const group = families.get(family) ?? { own: [], front: [], all: [] };
    group.all.push(job.id);
    // From the front: not a copy of another job's picture, and in the pose box every layer has unless it says otherwise.
    if (!job.source && !job.box) {
      group.front.push(job.id);
      if (job.references?.[0]?.endsWith(`family-${family}.png`)) group.own.push(job.id);
    }
    families.set(family, group);
  }
  return new Map([...families].map(([family, { own, front, all }]) => [family, { judged: own.length > 0 ? own : front.length > 0 ? front : all, all }]));
}

/* ---- The mech from behind ---- */

const backFile = (family: string): string => `${RAW}/back-${family}.png`;

/** The view every drawing from behind shares, and the stance in it. */
const BACK_VIEW =
  'a three-quarter back view: the camera stands behind the mecha and a little to its right, so that its back and its ' +
  'right side are seen and it faces away from the viewer, towards the upper right of the image';
const BACK_STANCE =
  'combat stance with legs apart and knees slightly bent, both feet planted on the ground; the arm on the right side of ' +
  'the image is stretched forward, away from the viewer and towards the upper right, at chest height, with a closed ' +
  'empty fist; the arm on the left side of the image is bent at its side with a closed empty fist; the whole body is ' +
  'visible from head to feet, centred, filling most of the frame. No weapons, nothing held in the hands.';

/** The first drawing from behind, made from that family's drawing from the front: it defines the pose from behind. */
function backPose(family: string): ArtJob {
  return {
    id: `back-${family}`, kind: 'family', references: [familyFile(family)],
    prompt:
      'The attached image shows a pixel art mecha from the front. Draw the same mecha seen from behind, in ' +
      `${BACK_VIEW}. It keeps its design, colours, proportions, pixel size, outline weight and shading; its back shows ` +
      `armour plates and a compact backpack unit in the same colours and glowing accents. Pose: ${BACK_STANCE} ` +
      `${PIXEL} ${GREEN}`,
  };
}

/**
 * A further family from behind: the pose from behind redrawn in another design, the way the
 * families from the front were made. The design is given in words and by its drawing from the front.
 */
function backFamily(family: string, poseFrom: string): ArtJob {
  return {
    id: `back-${family}`, kind: 'family', references: [backFile(poseFrom), familyFile(family)],
    prompt:
      'The first image shows a mecha seen from behind in a combat stance. Redraw it as a different mecha design in ' +
      'exactly the same pose, camera angle, body size and position on the canvas: every joint (head, shoulders, ' +
      'elbows, hands, hips, knees, feet) stays in the same place. In particular the arm on the right side of the ' +
      'image stays raised and stretched forward towards the upper right, with its fist exactly where it is in the ' +
      'first image, and the arm on the left side stays bent at its side. The new design is shown from the front in ' +
      `the second image; in words it is: ${DESIGNS[family]} Seen from behind, its back shows armour plates and a ` +
      `backpack unit that suit that design. Keep the same proportions between joints. No weapons, empty hands. ${PIXEL} ${GREEN}`,
  };
}

/** A drawing from behind with only its lower body replaced, as `lowerBody` does from the front. */
function backLowerBody(id: string, fromFamily: string, description: string): ArtJob {
  return {
    id: `back-${id}`, kind: 'family', references: [backFile(fromFamily)], base: fromFamily,
    prompt:
      'Edit the attached pixel art image of a mecha seen from behind. Keep everything above the waist exactly as it ' +
      'is: same pixels, same position, same size, same colours. Replace only the lower body (the hips, both legs and ' +
      `both feet) with: ${description} It is seen from behind like the rest, joins the torso at the same waist and ` +
      'rests on the same ground line as the original feet, and is drawn in the same colours and style as the rest of ' +
      `the mecha. ${PIXEL} ${GREEN}`,
  };
}

const KEEP_BACK: Record<Layer, string> = {
  legs: 'only the lower body: the hips with any hip or skirt armour, both legs and both feet. Erase the torso with its backpack, the head and both arms.',
  torso: 'only the torso seen from behind: the back with its backpack unit, from the waist up to the neck. Erase the head, both arms with their shoulder armour, the hips and the legs.',
  head: 'only the head: the helmet or sensor unit itself with its crest or antenna, and nothing below the neck. Erase everything else: the whole torso and in particular the backpack unit on its back, which lies under the head, both arms and the legs.',
  armNear: 'only the arm on the right side of the image that is stretched forward, complete with its shoulder armour, forearm and fist. Erase the torso, head, legs and the other arm.',
  armFar: 'only the arm on the left side of the image, complete with its shoulder armour, forearm and fist. Erase the torso, head, legs and the other arm.',
};

/** One layer cut from a drawing from behind. Its sprite is the part's own id with `.back` after it. */
function backLayer(id: string, fromFamily: string, which: Layer, keep: string = KEEP_BACK[which]): ArtJob {
  return { ...layer(`${id}.back`, fromFamily, which, keep), references: [backFile(fromFamily)], box: BACK_POSE_BOX };
}

/**
 * Heads that came away with a piece of the backpack under them however the usual words were put:
 * each is told what its own head and its own backpack look like. A head with a backpack on it puts
 * that backpack on every other family's back.
 */
const HEAD_FROM_BEHIND: Record<string, string> = {
  ronin:
    'only the helmet itself: the rounded helmet dome with its single tall curved crest and the short flared neck guard ' +
    'directly under the dome. It is the small part at the very top of the mecha. Erase everything else: in particular ' +
    'the large round backpack unit with the magenta lights that lies below the helmet, both shoulders with their ' +
    'layered plates, the arms, the torso, the skirt plates and the legs.',
  bulwark:
    'only the head itself: the low cab-like head unit at the very top of the mecha with its small roll bar. Erase ' +
    'everything else: in particular the big yellow backpack box with the ribbed vents that lies below the head, both ' +
    'shoulders, the arms, the torso and the legs.',
  mantis:
    'only the head itself: the small triangular head with its two short antennae, at the very top of the mecha. Erase ' +
    'everything else: in particular the rings and the backpack that lie below the head, both shoulders, the arms, the ' +
    'torso and the legs.',
};

/** The five layers of one family from behind, named after the parts that use them. */
function backLayersOf(fromFamily: string, ids: { legs: string; core: string; head: string; arms: string }): ArtJob[] {
  return [
    backLayer(ids.legs, fromFamily, 'legs'),
    backLayer(ids.core, fromFamily, 'torso'),
    backLayer(ids.head, fromFamily, 'head', HEAD_FROM_BEHIND[fromFamily]),
    backLayer(`${ids.arms}.near`, fromFamily, 'armNear'),
    backLayer(`${ids.arms}.far`, fromFamily, 'armFar'),
  ];
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

/** A machine boss: one big sprite, drawn facing right and mirrored to face the player. */
function boss(id: string, styleFrom: string, subject: string): ArtJob {
  return {
    id, kind: 'boss', flip: true, references: [familyFile(styleFrom)],
    prompt:
      `${PIXEL} Three-quarter side view facing right. The attached image is the style reference: match its colours, ` +
      `glowing accents, pixel size, outline weight and shading. Draw a huge war machine from a retro video game: ${subject} ` +
      `Show only this single machine, whole, centred, filling most of the frame. ${GREEN}`,
  };
}

function background(id: string, scene: string): ArtJob {
  return {
    id, kind: 'background',
    prompt: `16-bit pixel art background, no anti-aliasing: ${scene} No characters, no robots, no vehicles in the foreground, no readable text.`,
  };
}

/** The picture behind a page of story: a whole scene, not a stage for a battle. */
function still(id: string, scene: string): ArtJob {
  return {
    id, kind: 'still',
    prompt: `16-bit pixel art illustration, crisp pixels, no anti-aliasing, no text, no lettering, cinematic composition: ${scene}`,
  };
}

function item(id: string, kind: 'handWeapon' | 'shoulderWeapon' | 'shield' | 'enemy', styleFrom: string, subject: string, flip = false): ArtJob {
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

/** What each family looks like, in words: its drawing from the front and its drawing from behind are both made from this. */
const DESIGNS: Record<string, string> = {
  halo:
    'a slender white and navy mecha with sharp angular armour panels, glowing cyan accent lights and a compact ' +
    'helmet head with a horizontal cyan visor band and one swept-back blade antenna; slimmer limbs than the first image.',
  salvage:
    'a scrappy salvaged mecha patched together from mismatched plates in faded teal and rust orange, with visible weld ' +
    'seams, bolts, a few exposed cables and one hazard-striped shoulder; its head is a simple boxy sensor unit with a single ' +
    'round amber lens. Medium build, plainer and more worn than the first image, with small amber lights.',
  bulwark:
    'a massive industrial mining mecha in safety yellow with black hazard stripes and dark steel joints: very thick blocky ' +
    'limbs, huge square shoulders, a wide barrel chest, and a low cab-like head with a row of small white work lights. ' +
    'Bulkier than the first image, with heavy flat feet.',
  wraith:
    'a lean stealth reconnaissance mecha in matte indigo and black armour with thin glowing amber light slits: narrow ' +
    'waist, slim angular limbs, small pointed shoulder guards, and a smooth faceless mask head with one vertical amber ' +
    'slit. Slimmer than the first image, sinister and quiet.',
  colossus:
    'a towering siege mecha in burnished bronze plating with deep blue enamel panels and small white light ports: ' +
    'enormous rounded pauldrons, a broad barrel chest, forearms like tower shields, thick pillar legs, and a crowned ' +
    'head with three short upright fins. The biggest and heaviest of all, regal and slow.',
  mantis:
    'a wiry insect-like scrapyard mecha in olive green and sand yellow plating with thin glowing lime light strips: ' +
    'reverse-jointed grasshopper legs whose knees bend backwards and end in two-toed clawed feet (hips and feet stay ' +
    'where they are in the first image), a narrow waist, forearms with a folded blade-like fin along each, small ' +
    'angular shoulders, and a triangular head with two short antennae and a wide lime visor. Lean and agile.',
  auditor:
    'a tall, severe corporate enforcement mecha in glossy black lacquer armour with fine gold trim lines and a few small ' +
    'white lights: long coat-like armour skirts hanging from the hips at the front and back, narrow shoulders with upright ' +
    'gold-edged collar plates, slender precise limbs, and a smooth faceless mask head with one thin vertical gold line and ' +
    'a low crown ridge. Slimmer and taller-looking than the first image, elegant, cold and expensive.',
};

/** Everything that is drawn: asked of the image service, or the same raw picture used a second time. */
const DRAWN: ArtJob[] = [
  // Ronin defines the pose; every other family is that pose redrawn in its own design.
  poseFamily('ronin',
    'Heavy imposing proportions inspired by samurai armour: layered shoulder plates, helmet-like head with a single ' +
    'curved crest, armoured skirt plates over the hips, dark lacquered charcoal and deep red armour with glowing magenta accent lines.'),
  family('halo', 'ronin', DESIGNS.halo, 'art/reference/ref-light.png'),
  family('salvage', 'ronin', DESIGNS.salvage),
  family('bulwark', 'ronin', DESIGNS.bulwark),

  family('wraith', 'ronin', DESIGNS.wraith),
  family('colossus', 'ronin', DESIGNS.colossus),

  family('mantis', 'ronin', DESIGNS.mantis),
  family('auditor', 'ronin', DESIGNS.auditor),
  // Free-standing lower bodies: a family drawing with only the legs replaced, from which the legs layer is cut.
  lowerBody('crawler', 'bulwark',
    'a tank lower body: a wide, low armoured chassis carried on two heavy caterpillar tracks, one on each side, ' +
    'with hazard stripes on the track guards. No legs and no feet.'),
  lowerBody('spider', 'ronin',
    'a four-legged walker base: a compact hip block from which four armoured spider-like legs spread wide, two ' +
    'towards the front and two towards the back, each ending in a pointed foot planted on the ground.'),
  lowerBody('glide', 'halo',
    'a hover unit: a flared white skirt of armour panels below the waist with three downward-pointing thruster ' +
    'nozzles glowing cyan under it, floating a little above the ground. No legs and no feet.'),

  ...layersOf('salvage', { legs: 'legs-strider', core: 'core-hauler', head: 'head-scout-mk1', arms: 'arms-rigger' }),
  ...layersOf('halo', { legs: 'legs-halo', core: 'core-halo', head: 'head-halo', arms: 'arms-halo' }),
  ...layersOf('bulwark', { legs: 'legs-bulwark', core: 'core-bulwark', head: 'head-bulwark', arms: 'arms-bulwark' }),
  ...layersOf('ronin', { legs: 'legs-ronin', core: 'core-ronin', head: 'head-ronin', arms: 'arms-ronin' }),
  ...layersOf('wraith', { legs: 'legs-wraith', core: 'core-wraith', head: 'head-wraith', arms: 'arms-wraith' }),
  ...layersOf('colossus', { legs: 'legs-colossus', core: 'core-colossus', head: 'head-colossus', arms: 'arms-colossus' }),
  ...layersOf('mantis', { legs: 'legs-mantis', core: 'core-mantis', head: 'head-mantis', arms: 'arms-mantis' }),
  ...layersOf('auditor', { legs: 'legs-auditor', core: 'core-auditor', head: 'head-auditor', arms: 'arms-auditor' }),
  layer('legs-crawler', 'crawler', 'legs',
    'only the lower body below the waist: the whole tracked chassis with both caterpillar tracks. Erase the torso, head and both arms.'),
  layer('legs-spider', 'spider', 'legs',
    'only the lower body below the waist: the hip block and all four legs with their feet. Erase the torso, head and both arms.'),
  layer('legs-glide', 'glide', 'legs',
    'only the lower body below the waist: the whole hover skirt with its thruster nozzles and their glow. Erase the torso, head and both arms.'),

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
  item('wpn-needler', 'handWeapon', 'salvage',
    `a slim twin-barrelled handheld rapid-fire tool for a robot in a retro video game, ${WEAPON_STYLE}: two thin parallel barrels and a box magazine underneath, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-thermal-lance', 'handWeapon', 'halo',
    `a handheld heat-beam emitter for a robot in a retro video game, ${WEAPON_STYLE}: a ribbed barrel with glowing orange heat fins and a white body, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-void-rifle', 'handWeapon', 'wraith',
    `a long, thin precision rifle for a robot in a retro video game, ${WEAPON_STYLE}: a very slender barrel, a large scope on top and a skeletal stock, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-arc-caster', 'handWeapon', 'wraith',
    `a compact handheld device for a robot in a retro video game, ${WEAPON_STYLE}: a short body ending in two prongs with a crackling spark between them, lying exactly horizontal, pointing right. The tool only, no hand, no mecha.`),
  item('wpn-hailstorm', 'shoulderWeapon', 'bulwark',
    `a shoulder-mounted rotary unit for a robot in a retro video game, ${WEAPON_STYLE}: a cluster of six long thin barrels in a ring on a drum housing with a mounting bracket underneath, exactly horizontal, barrels pointing right. The unit only, no mecha.`),
  item('wpn-inferno-pod', 'shoulderWeapon', 'salvage',
    `a shoulder-mounted equipment pod for a robot in a retro video game, ${WEAPON_STYLE}: a scorched rectangular housing with four wide nozzles glowing orange on its right face and a mounting bracket underneath, exactly horizontal. The pod only, no mecha.`),
  item('wpn-null-beam', 'shoulderWeapon', 'wraith',
    `a shoulder-mounted emitter for a robot in a retro video game, ${WEAPON_STYLE}: a long tapering dish-tipped projector on a slim housing with a mounting bracket underneath, exactly horizontal, pointing right. The unit only, no mecha.`),
  item('wpn-breaker-cannon', 'shoulderWeapon', 'colossus',
    `a huge shoulder-mounted equipment unit for a robot in a retro video game, ${WEAPON_STYLE}: one very thick short barrel with a heavy muzzle ring on an armoured block with a mounting bracket underneath, exactly horizontal, barrel pointing right. The unit only, no mecha.`),

  item('wpn-arc-blade', 'handWeapon', 'halo',
    `a long straight energy sword for a robot in a retro video game, ${WEAPON_STYLE}: a short white and navy hilt with a small hand guard at the left end and a long flat blade of bright glowing cyan light, lying exactly horizontal, blade pointing right. The object only, no hand, no mecha.`),
  item('wpn-breach-pick', 'handWeapon', 'bulwark',
    `a heavy handheld pile-driver tool for a robot in a retro video game, ${WEAPON_STYLE}: a thick boxy housing with a piston on top and one fat pointed steel spike sticking out of its right end, lying exactly horizontal, spike pointing right. The tool only, no hand, no mecha.`),
  item('wpn-chain-gun', 'handWeapon', 'bulwark',
    `a handheld rotary device for a toy robot in a retro video game, ${WEAPON_STYLE}: five short round tubes arranged in a ring at the front of a drum-shaped body, with a square box hanging underneath, lying exactly horizontal, tubes pointing right. The object only, no hand, no robot.`),
  item('wpn-longbow', 'handWeapon', 'wraith',
    `an extremely long, thin handheld energy device for a toy robot in a retro video game, ${WEAPON_STYLE}: two very long thin parallel rods with a bright glow between them and a round drum above the handle, lying exactly horizontal, rods pointing right. The object only, no hand, no robot.`),
  item('wpn-hornet-salvo', 'shoulderWeapon', 'salvage',
    `a shoulder-mounted rack for a robot in a retro video game, ${WEAPON_STYLE}: a wide flat patched box with sixteen small round tubes in two rows of eight on its right face, with a mounting bracket underneath, exactly horizontal. The unit only, no mecha.`),
  item('wpn-sunlance', 'shoulderWeapon', 'halo',
    `a shoulder-mounted beam projector for a robot in a retro video game, ${WEAPON_STYLE}: a long barrel ringed by three glowing focusing rings, a round capacitor at the back and a mounting bracket underneath, exactly horizontal, pointing right. The unit only, no mecha.`),
  item('shd-riot', 'shield', 'bulwark',
    `a tall rectangular riot shield for a robot in a retro video game, ${WEAPON_STYLE}: a thick slab of plate armour with a narrow viewing slit near the top, hazard stripes along the bottom edge and rivets around the rim, seen from the front and standing upright. The shield only, no hand, no mecha.`),

  item('wpn-ram-fist', 'handWeapon', 'salvage',
    `a huge oversized metal boxing glove for a toy robot in a retro video game, ${WEAPON_STYLE}: a blocky riveted fist with a thick piston behind it, patched and worn, lying exactly horizontal, knuckles pointing right. The object only, no arm, no robot.`),
  item('wpn-thermal-cutter', 'handWeapon', 'salvage',
    `a short wide cutting torch blade for a toy robot in a retro video game, ${WEAPON_STYLE}: a stubby worn handle and a broad flat blade glowing white-hot orange along its edge, lying exactly horizontal, blade pointing right. The object only, no hand, no robot.`),
  item('wpn-marksman', 'handWeapon', 'halo',
    `a long slim precision device for a toy robot in a retro video game, ${WEAPON_STYLE}: a thin straight tube with a large round scope on top and a slender shoulder rest, lying exactly horizontal, pointing right. The object only, no hand, no robot.`),
  item('wpn-flak', 'handWeapon', 'salvage',
    `a chunky handheld launcher for a toy robot in a retro video game, ${WEAPON_STYLE}: two short fat tubes side by side on a boxy body with a carrying handle on top, patched and worn, lying exactly horizontal, pointing right. The object only, no hand, no robot.`),
  item('wpn-disruptor', 'handWeapon', 'halo',
    `a compact handheld energy device for a toy robot in a retro video game, ${WEAPON_STYLE}: a short body ending in a ring of three prongs around a glowing violet orb, lying exactly horizontal, pointing right. The object only, no hand, no robot.`),
  item('wpn-plasma', 'handWeapon', 'bulwark',
    `a heavy handheld heat projector for a toy robot in a retro video game, ${WEAPON_STYLE}: a wide flared nozzle glowing orange at the front, a ribbed body and a round fuel tank underneath, lying exactly horizontal, nozzle pointing right. The object only, no hand, no robot.`),
  item('wpn-coil-pistol', 'handWeapon', 'bulwark',
    `a short handheld device for a toy robot in a retro video game, ${WEAPON_STYLE}: a stubby square body wrapped in four thick copper coils with a glowing tip, lying exactly horizontal, tip pointing right. The object only, no hand, no robot.`),
  item('shd-barrier', 'shield', 'halo',
    `a tall energy barrier for a toy robot in a retro video game, ${WEAPON_STYLE}: a small white emitter bar at the centre projecting an upright hexagonal panel of bright translucent cyan light with a honeycomb pattern, seen from the front. The object only, no hand, no robot.`),
  item('shd-tower', 'shield', 'colossus',
    `a huge tower shield for a toy robot in a retro video game, ${WEAPON_STYLE}: a very thick tall slab of layered plate armour, slightly curved, with a heavy rim, three vertical ribs and a row of rivets, seen from the front and standing upright. The object only, no hand, no robot.`),
  item('wpn-micro-salvo', 'shoulderWeapon', 'salvage',
    `a small shoulder-mounted box for a toy robot in a retro video game, ${WEAPON_STYLE}: a compact patched rectangular case with eight small round openings in two rows of four on its right face, like a honeycomb, with a mounting bracket underneath, exactly horizontal. The object only, no robot.`),
  item('wpn-gauss', 'shoulderWeapon', 'colossus',
    `a huge shoulder-mounted accelerator for a toy robot in a retro video game, ${WEAPON_STYLE}: a very long square beam wrapped in six thick glowing rings, with a heavy block at the back and a mounting bracket underneath, exactly horizontal, pointing right. The unit only, no robot.`),
  item('wpn-flare-mortar', 'shoulderWeapon', 'bulwark',
    `a shoulder-mounted equipment pod for a toy robot in a retro video game, ${WEAPON_STYLE}: a short fat upward-angled tube on a square housing with orange glowing vents and a mounting bracket underneath. The unit only, no robot.`),
  item('wpn-buzzsaw', 'shoulderWeapon', 'bulwark',
    `a shoulder-mounted rotary unit for a toy robot in a retro video game, ${WEAPON_STYLE}: four short thick tubes in a square cluster on a boxy drum with a belt feed on one side and a mounting bracket underneath, exactly horizontal, pointing right. The unit only, no robot.`),
  item('wpn-storm-array', 'shoulderWeapon', 'halo',
    `a shoulder-mounted emitter for a toy robot in a retro video game, ${WEAPON_STYLE}: a fan of five slim antenna rods with crackling light between their tips on a slim housing with a mounting bracket underneath. The unit only, no robot.`),
  item('wpn-howler', 'shoulderWeapon', 'salvage',
    `a shoulder-mounted horn for a toy robot in a retro video game, ${WEAPON_STYLE}: one very wide flared trumpet-shaped mouth on a patched round body with a mounting bracket underneath, exactly horizontal, mouth pointing right. The unit only, no robot.`),

  item('enemy-gunship', 'enemy', 'ronin',
    'a compact hovering gunship drone in the same dark charcoal and deep red armour: a wedge-shaped body with two side engine pods glowing magenta and two small tube pods under the nose. The whole craft, nothing else, no mecha.', true),
  item('enemy-lance-tower', 'enemy', 'ronin',
    'a tall slender fixed sentry tower in the same dark charcoal and deep red armour with one magenta lens: a narrow column on a tripod base carrying one extremely long thin barrel pointing right. The whole tower, nothing else, no mecha.', true),

  item('wpn-writ', 'handWeapon', 'auditor',
    `a long, elegant handheld instrument for a toy robot in a retro video game, ${WEAPON_STYLE}: a slim black body with fine gold inlay, one long straight thin tube ending in a gold ring, a small round lens on top and a slender shoulder rest, lying exactly horizontal, pointing right. The object only, no hand, no robot.`),
  item('wpn-gavel', 'handWeapon', 'auditor',
    `a heavy ceremonial war hammer for a toy robot in a retro video game, ${WEAPON_STYLE}: a short black shaft with gold bands and a large square black hammer head edged in gold at its right end, lying exactly horizontal, head pointing right. The object only, no hand, no robot.`),
  item('wpn-decree', 'shoulderWeapon', 'auditor',
    `a shoulder-mounted beam projector for a toy robot in a retro video game, ${WEAPON_STYLE}: a long black tapering barrel with three thin gold rings and a white glowing lens at its tip, on a black housing with a mounting bracket underneath, exactly horizontal, pointing right. The unit only, no robot.`),

  // Enemy-only weapons borrow the look of a shop weapon.
  { id: 'wpn-enemy-longbow', kind: 'handWeapon', source: 'wpn-longbow', prompt: '' },
  { id: 'wpn-enemy-claw', kind: 'handWeapon', source: 'wpn-thermal-cutter', prompt: '' },
  { id: 'wpn-enemy-pinpoint', kind: 'handWeapon', source: 'wpn-void-rifle', prompt: '' },
  { id: 'wpn-enemy-edge', kind: 'handWeapon', source: 'wpn-arc-blade', prompt: '' },
  { id: 'wpn-enemy-cutter', kind: 'handWeapon', source: 'wpn-thermal-cutter', prompt: '' },
  { id: 'wpn-enemy-flak', kind: 'handWeapon', source: 'wpn-flak', prompt: '' },
  { id: 'wpn-enemy-siege', kind: 'shoulderWeapon', source: 'wpn-breaker-cannon', prompt: '' },
  { id: 'wpn-enemy-writ', kind: 'handWeapon', source: 'wpn-writ', prompt: '' },
  { id: 'wpn-enemy-seizer', kind: 'handWeapon', source: 'wpn-arc-caster', prompt: '' },
  { id: 'wpn-enemy-gavel', kind: 'handWeapon', source: 'wpn-gavel', prompt: '' },
  { id: 'wpn-enemy-decree', kind: 'shoulderWeapon', source: 'wpn-decree', prompt: '' },
  { id: 'wpn-enemy-carbine', kind: 'handWeapon', source: 'wpn-pulse-carbine', prompt: '' },
  { id: 'wpn-enemy-shotgun', kind: 'handWeapon', source: 'wpn-scatter-gun', prompt: '' },
  { id: 'wpn-enemy-lance', kind: 'handWeapon', source: 'wpn-rail-lance', prompt: '' },
  { id: 'wpn-enemy-rack', kind: 'shoulderWeapon', source: 'wpn-swarm-rack', prompt: '' },
  { id: 'wpn-enemy-needle', kind: 'handWeapon', source: 'wpn-needler', prompt: '' },
  { id: 'wpn-enemy-maul', kind: 'handWeapon', source: 'wpn-scatter-gun', prompt: '' },
  { id: 'wpn-enemy-mortar', kind: 'shoulderWeapon', source: 'wpn-mortar-pod', prompt: '' },

  item('enemy-recon-drone', 'enemy', 'ronin',
    'a small hovering security drone in the same dark charcoal and deep red armour: a compact body with two ducted rotors, one glowing magenta sensor eye and a small barrel underneath. The whole drone, nothing else, no mecha.', true),
  item('enemy-gun-turret', 'enemy', 'ronin',
    'a fixed gun turret in the same dark charcoal and deep red armour with magenta lights: a squat armoured base with one long heavy cannon barrel pointing right. The whole turret, nothing else, no mecha.', true),

  item('enemy-tank', 'enemy', 'salvage',
    'a squat salvaged battle tank in the same patched teal and rust plating: a low hull on two wide treads with a short stubby turret and one amber lamp. The whole tank, nothing else, no mecha.', true),

  // Units that help the others, and one that will not wait.
  item('enemy-shield-drone', 'enemy', 'halo',
    'a hovering support drone in the same white and navy armour with cyan lights: a round body with two small side rotors, carrying in front of it a large upright hexagonal panel of translucent cyan light with a honeycomb pattern. The whole drone, nothing else, no mecha.', true),
  item('enemy-repair-drone', 'enemy', 'salvage',
    'a hovering repair drone in the same patched teal and rust plating: a boxy body with two rotors on top, two small jointed tool arms underneath, one ending in a welding torch with a bright spark, and one amber lamp. The whole drone, nothing else, no mecha.', true),
  item('enemy-jammer', 'enemy', 'ronin',
    'a field signal mast in the same dark charcoal and deep red armour: a squat tripod base carrying a tall mast with three stacked dish antennas and a crown of thin aerials, with magenta rings of light pulsing from its top. The whole mast, nothing else, no mecha.', true),
  item('enemy-bomb-crawler', 'enemy', 'bulwark',
    'a small four-legged walking robot in the same safety yellow with black hazard stripes: a round barrel-shaped body on four short jointed legs, with one red blinking lamp on top and warning stripes around its belly. The whole robot, nothing else, no mecha.', true),
  item('enemy-carrier', 'enemy', 'ronin',
    'a heavy six-wheeled carrier vehicle in the same dark charcoal and deep red armour: a long low armoured hull with an open bay on its back holding two small folded drones, a short radar mast and magenta running lights. The whole vehicle, nothing else, no mecha.', true),
  item('enemy-lien-drone', 'enemy', 'auditor',
    'a hovering enforcement drone in the same glossy black armour with fine gold trim: a sleek wedge-shaped body with two ducted fans, a single white lens, and a small clamp arm underneath holding a glowing gold tag. The whole drone, nothing else, no mecha.', true),

  // More machines for the open contracts and the Gauntlet.
  item('enemy-mortar-nest', 'enemy', 'bulwark',
    'a dug-in mortar emplacement in the same safety yellow with black hazard stripes and dark steel: a low ring of armoured plates and sandbags around one short fat mortar tube pointing up and to the right, with a small ammunition rack and one white work light. The whole emplacement, nothing else, no mecha.', true),
  item('enemy-hunter-drone', 'enemy', 'wraith',
    'a slim fast hunter drone in the same colours and lights as the reference: a narrow dart-shaped body with swept-back wings, one bright sensor eye at the nose and two thin needle barrels underneath, a small glowing thruster at the back. The whole drone, nothing else, no mecha.', true),
  item('enemy-flak-walker', 'enemy', 'salvage',
    'a small two-legged walking gun platform in the same patched teal and rust plating: a boxy body on two bent bird-like legs, carrying a cluster of four short flak barrels on top and one amber lamp. No arms, no head. The whole walker, nothing else.', true),
  item('enemy-breacher', 'enemy', 'bulwark',
    'a heavy armoured ram vehicle in the same safety yellow with black hazard stripes: a wedge-shaped hull on four big studded wheels with a massive flat steel ram plate on the front, exhaust stacks at the back and one white work light. The whole vehicle, nothing else, no mecha.', true),
  item('enemy-arc-pylon', 'enemy', 'halo',
    'a field energy pylon in the same white and navy armour with cyan lights: a slim armoured column on a round base with three curved prongs at the top holding a crackling ball of cyan lightning between them. The whole pylon, nothing else, no mecha.', true),
  item('enemy-longshot', 'enemy', 'auditor',
    'a hovering sniper drone in the same glossy black armour with fine gold trim: a long thin body with two ducted fans at the back, one very long slender rail barrel pointing right, and a single white scope lens on top. The whole drone, nothing else, no mecha.', true),

  // Machines that are a battle on their own.
  boss('boss-scrap-king', 'salvage',
    'a huge six-legged crab-like scavenger walker in the same patched teal and rust plating: a wide low armoured shell on six thick jointed legs, two enormous mismatched claw arms in front, one a crushing pincer and one a spinning saw, a crown of welded scrap spikes on its back and three amber lamps. Ugly, heavy and patched together.'),
  boss('boss-night-train', 'ronin',
    'a colossal armoured war locomotive in the same dark charcoal and deep red armour with magenta lights: a long heavy engine on many small wheels with a pointed plough front, one enormous rail cannon mounted along its roof, side gun ports and a glowing magenta furnace grille. Massive, fast and menacing.'),
  boss('boss-strip-miner', 'bulwark',
    'a colossal mining machine in the same safety yellow with black hazard stripes and dark steel: a huge armoured cab on two enormous caterpillar tracks, with a giant bucket-wheel excavator arm reaching forward and a row of white work lights. Massive and industrial.'),
  boss('boss-overseer', 'halo',
    'a large floating command platform in the same white and navy armour with cyan lights: a wide disc-shaped body with one huge glowing cyan eye lens at its centre, a ring of smaller emitters around its rim and three thrusters glowing underneath. Clean, cold and watchful.'),
  boss('boss-leviathan', 'salvage',
    'a huge salvaged amphibious war barge in the same patched teal and rust plating: a long low hull on rows of small wheels, a front ram shaped like a jaw with teeth of scrap steel, a crane arm on its back, two smokestacks and amber lamps. Ugly, heavy and patched together.'),
  boss('boss-adjuster', 'auditor',
    'a towering judge-like machine in the same glossy black armour with fine gold trim: a tall narrow body like a robed figure on a wide skirt base, a faceless mask head with a crown of gold spikes, and four long arms, two holding up a large golden balance scale and two ending in long barrels. Imposing, elegant and cold.'),

  // Enemy mechs are the family drawings themselves, mirrored: no new image needed.
  { id: 'enemy-light-mech', kind: 'enemyMech', source: 'family-halo', flip: true, prompt: '' },
  { id: 'enemy-heavy-mech', kind: 'enemyMech', source: 'family-bulwark', flip: true, prompt: '' },
  { id: 'enemy-rival', kind: 'enemyMech', source: 'family-ronin', flip: true, prompt: '' },
  { id: 'enemy-stalker', kind: 'enemyMech', source: 'family-wraith', flip: true, prompt: '' },
  { id: 'enemy-juggernaut', kind: 'enemyMech', source: 'family-colossus', flip: true, prompt: '' },
  { id: 'enemy-ripper', kind: 'enemyMech', source: 'family-mantis', flip: true, prompt: '' },
  { id: 'enemy-bailiff', kind: 'enemyMech', source: 'family-auditor', flip: true, prompt: '' },

  portrait('portrait-hadron', 'a heavyset middle-aged mining executive with tired eyes and slicked-back grey hair, wearing a high-collared charcoal coat with a small yellow and black hazard-striped pin'),
  portrait('portrait-lumen', 'a composed woman analyst with a short dark bob, wearing a white high-tech jacket with thin glowing cyan piping and a translucent data visor over one eye'),
  portrait('portrait-undertow', 'an older resistance organiser with a weathered face and cropped white hair, wearing a patched teal work jacket and a rust-orange scarf, a smudge of oil on one cheek'),
  portrait('portrait-rival', 'a confident mercenary pilot with short black hair with one red streak and a thin scar through one eyebrow, wearing a charcoal and deep red flight suit with a glowing magenta collar ring'),

  portrait('portrait-dispatch', 'a tired night-shift dispatcher in their forties with a headset over messy tied-back hair, wearing a worn grey hoodie, lit by the glow of monitors'),
  portrait('portrait-sable', 'a pale, sharp-featured woman ace pilot with silver-white hair in a tight braid and a cold stare, wearing a white flight suit with thin glowing cyan piping'),
  portrait('portrait-kite', 'a nervous but eager young rookie pilot barely twenty with freckles and untidy sandy hair, wearing a second-hand olive flight jacket a size too large with a fresh paper licence tag clipped to the collar'),
  portrait('portrait-marrow', 'a hard-faced woman siege gunner in her forties with a shaved undercut and a burn scar along her jaw, wearing a heavy charcoal armoured vest with the yellow and black hazard stripes scratched off'),
  portrait('portrait-sixty', 'a dignified old veteran pilot in his seventies with a trimmed white beard, deep lines and kind tired eyes, wearing a faded navy flight coat with a row of small brass contract pins'),
  portrait('portrait-rook', 'a broad, grinning scrapyard pilot with a shaved head and welding goggles pushed up on his forehead, wearing a patched teal jacket with a rust-orange armband'),
  portrait('portrait-krell', 'a scarred veteran security chief with a square jaw and a grey buzz cut, wearing a heavy charcoal uniform with yellow and black hazard-striped shoulder boards'),
  portrait('portrait-actuary', 'a thin, immaculate insurance adjuster with slicked dark hair, round gold-rimmed glasses and a faint polite smile, wearing a black high-collared suit with a small gold pin shaped like a balance scale'),

  // The six with a price on them, each in the colours of the frame they fly, and the Guild's broker.
  portrait('portrait-magpie', 'a wiry, sharp-eyed young scavenger pilot with a crooked grin and a shock of hair dyed half black and half white, wearing a patched royal blue flight jacket hung with small stolen trinkets and a cracked visor pushed up on the forehead'),
  portrait('portrait-dredge', 'a huge heavy-browed toll-road enforcer with a thick neck and a short braided beard full of grit, wearing a sand-coloured quilted armour vest with dust goggles hanging around the neck'),
  portrait('portrait-lark', 'a slender, composed contract killer with a calm half-smile and hair pinned up in a neat bun, a small brass marksman eyepiece over the right eye, wearing a tailored dusty rose coat with a high collar'),
  portrait('portrait-hollow', 'a gaunt hollow-cheeked salvage cutter with sunken eyes and a shaved head, a breathing mask hanging loose at the throat, wearing an oil-stained leather apron over a sickly yellow-green coverall'),
  portrait('portrait-paragon', 'a proud weathered former officer in his fifties with a square greying moustache and a black eye patch, wearing a sun-yellow and orange dress uniform jacket crowded with mismatched medals'),
  portrait('portrait-notary', 'a severe pale bureaucrat with slicked silver hair and thin lips, a round brass seal lens over one eye like a monocle, wearing a glossy black high-collared robe with a heavy brass seal on a chain'),
  portrait('portrait-guild', 'a sly night-market broker of uncertain age in a hooded patchwork cloak, half of the face hidden behind a lacquered dark red trader mask, fingers heavy with mismatched rings, lit by warm lantern light'),

  { id: 'app-icon', kind: 'icon',
    prompt: '16-bit pixel art app icon, crisp pixels, no anti-aliasing, no text, no lettering: the head of an original Japanese anime-style mecha seen from the front, a helmet in dark charcoal armour with one curved crest and a single horizontal visor glowing hot pink, lit from the sides by pink and cyan neon, bold simple shapes, centred, filling most of the square, on a plain very dark navy background.' },

  background('bg-foundry', 'the inside of a huge smelting foundry in a megacity at night, channels of glowing molten metal, giant ladles hanging on chains, black steel gantries, harsh orange light and drifting sparks, a flat grated steel floor filling the lower third.'),
  background('bg-vault', 'the inside of a vast data vault, endless rows of tall white monolith cabinets with thin cyan light lines receding into the distance, cold mist along a glossy pale floor that fills the lower third.'),
  background('bg-sluice', 'enormous floodgates at the bottom of a megacity at night, towering rusted gate doors standing half open with water pouring between them, catwalks and chains, strings of teal and orange lights, a wet concrete quay filling the lower third.'),
  background('bg-rooftop', 'the rooftops of a megacity at dawn, antenna masts, water tanks and ventilation units, the sky turning orange and pink behind distant dark towers, a flat gravel roof filling the lower third.'),
  background('bg-simulator', 'the inside of a vast empty training simulator hall, the floor and far walls drawn as a dark grid of thin glowing cyan lines that fade into the distance like a hologram, a few floating wireframe practice shapes in magenta, soft haze, the gridded floor filling the lower third.'),
  background('bg-clearing', 'the inside of an immense clearing hall of an insurance company, tall black marble pillars with thin gold inlay lines, hanging gold lamps, long empty counters, a polished black floor with gold reflections filling the lower third.'),

  still('still-varn', 'a wide view over an industrial megacity at night in the rain: a strip mine lit by yellow floodlights on the left, white and cyan corporate towers in the centre and a dim flooded shanty town of teal and orange lights below them, with one small mecha silhouette standing on a rooftop in the foreground looking out over it all.'),
  still('still-war', 'two giant mecha silhouettes facing each other across a burning city street at night, searchlights and streaks of tracer fire in the sky, flickering neon signs with abstract shapes, seen from a dramatic low angle.'),
  still('still-notice', 'a colossal featureless black tower with thin gold light lines rising above a dark megacity at night, far taller than everything around it, while thousands of small golden slips of paper fall like snow over the streets.'),
  still('still-dawn', 'sunrise over a megacity whose enormous floodgates stand open, warm golden light pouring into the streets, tiny crowds of people walking up broad ramps into the light, and a battered mecha kneeling at rest in the foreground.'),
  still('still-ledger', 'a cold orderly megacity at grey dawn where every tower is the same black with gold lines in perfect rows, the streets clean and empty, and a single mecha in black and gold armour standing guard in the foreground.'),

  { id: 'bg-neon-district', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: an industrial megacity district at night seen from street level, wet reflective ground filling the lower third, towering dark buildings, cranes and pipes, many glowing neon signs in pink, cyan and purple with abstract shapes instead of readable text, light haze and rain. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-mine', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a vast terraced strip mine inside a megacity at night, giant conveyor gantries and excavator arms, harsh yellow floodlights, hazard-striped barriers and a few amber neon signs with abstract shapes instead of readable text, dusty haze, flat packed-earth ground filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-plaza', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a spotless corporate research plaza at night, tall white and glass towers with thin cyan light lines, floating hologram panels with abstract shapes instead of readable text, trimmed planters, a smooth pale reflective floor filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-undercity', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: a flooded lower level of a megacity, huge rusted pipes and support pillars, shacks built from scrap, strings of mismatched teal and orange neon lights, dripping water and steam, a shallow wet concrete floor filling the lower third. No characters, no robots, no vehicles in the foreground.' },
  { id: 'bg-arena', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: an underground mecha duelling arena at night, a wide scuffed steel floor filling the lower third, tall cage walls, floodlights, banks of spectator stands with a silhouetted crowd, and neon scoreboards in pink and cyan with abstract shapes instead of readable text. No characters or robots in the foreground, no vehicles.' },
  // The pilot's mech as a battle shows it: from behind. Ronin defines that pose too.
  backPose('ronin'),
  backFamily('salvage', 'ronin'),
  backFamily('halo', 'ronin'),
  backFamily('bulwark', 'ronin'),
  backFamily('wraith', 'ronin'),
  backFamily('colossus', 'ronin'),
  backFamily('mantis', 'ronin'),
  backFamily('auditor', 'ronin'),
  backLowerBody('crawler', 'bulwark',
    'a tank lower body: a wide, low armoured chassis carried on two heavy caterpillar tracks, one on each side, ' +
    'with hazard stripes on the track guards. No legs and no feet.'),
  backLowerBody('spider', 'ronin',
    'a four-legged walker base: a compact hip block from which four armoured spider-like legs spread wide, two ' +
    'towards the front and two towards the back, each ending in a pointed foot planted on the ground.'),
  backLowerBody('glide', 'halo',
    'a hover unit: a flared white skirt of armour panels below the waist with three downward-pointing thruster ' +
    'nozzles glowing cyan under it, floating a little above the ground. No legs and no feet.'),
  ...backLayersOf('salvage', { legs: 'legs-strider', core: 'core-hauler', head: 'head-scout-mk1', arms: 'arms-rigger' }),
  ...backLayersOf('halo', { legs: 'legs-halo', core: 'core-halo', head: 'head-halo', arms: 'arms-halo' }),
  ...backLayersOf('bulwark', { legs: 'legs-bulwark', core: 'core-bulwark', head: 'head-bulwark', arms: 'arms-bulwark' }),
  ...backLayersOf('ronin', { legs: 'legs-ronin', core: 'core-ronin', head: 'head-ronin', arms: 'arms-ronin' }),
  ...backLayersOf('wraith', { legs: 'legs-wraith', core: 'core-wraith', head: 'head-wraith', arms: 'arms-wraith' }),
  ...backLayersOf('colossus', { legs: 'legs-colossus', core: 'core-colossus', head: 'head-colossus', arms: 'arms-colossus' }),
  ...backLayersOf('mantis', { legs: 'legs-mantis', core: 'core-mantis', head: 'head-mantis', arms: 'arms-mantis' }),
  ...backLayersOf('auditor', { legs: 'legs-auditor', core: 'core-auditor', head: 'head-auditor', arms: 'arms-auditor' }),
  backLayer('legs-crawler', 'crawler', 'legs',
    'only the lower body below the waist: the whole tracked chassis with both caterpillar tracks. Erase the torso, head and both arms.'),
  backLayer('legs-spider', 'spider', 'legs',
    'only the lower body below the waist: the hip block and all four legs with their feet. Erase the torso, head and both arms.'),
  backLayer('legs-glide', 'glide', 'legs',
    'only the lower body below the waist: the whole hover skirt with its thruster nozzles and their glow. Erase the torso, head and both arms.'),

  { id: 'bg-garage', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: the inside of a dim mecha hangar bay at night, steel gantries and catwalks, hanging chains and cables, tool racks along the walls, strips of cyan and magenta neon work lights, an empty metal floor filling the lower half. No characters, no robots, no vehicles, no text.' },
];

const CARRIED: JobKind[] = ['handWeapon', 'shoulderWeapon', 'shield'];

/**
 * What is made from raw pictures that are already there, with nothing asked of the image service:
 * every layer from the front once more for a mech that stands far off (`.small`), and every weapon
 * and shield once more for that mech (`.small`) and for the mech seen from behind (`.back`). The
 * weapons only enemies carry are never seen from behind.
 */
function derived(drawn: ArtJob[]): ArtJob[] {
  const more: ArtJob[] = [];
  for (const job of drawn) {
    if (job.kind === 'layer' && job.box === undefined) {
      more.push({ ...job, id: `${job.id}.small`, source: job.source ?? job.id, box: SMALL_POSE_BOX });
    }
    if (CARRIED.includes(job.kind)) {
      const source = job.source ?? job.id;
      more.push({ id: `${job.id}.small`, kind: job.kind, source, view: 'small', prompt: '', ...(job.flip ? { flip: true } : {}) });
      if (!job.id.startsWith('wpn-enemy-')) more.push({ id: `${job.id}.back`, kind: job.kind, source, view: 'back', prompt: '' });
    }
  }
  return more;
}

export const JOBS: ArtJob[] = [...DRAWN, ...derived(DRAWN)];
