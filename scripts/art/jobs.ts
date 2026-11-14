/**
 * Every image the game needs, with its prompt.
 *
 * Mech frames work like a paper doll: each family is drawn once as a whole mecha in one shared
 * pose (kind 'family'), then cut into layers (kind 'layer') that keep their place in that pose.
 * Layers of different families therefore fit on each other without any scaling or shifting.
 */
export type JobKind =
  | 'family' | 'layer' | 'handWeapon' | 'shoulderWeapon' | 'shield' | 'enemy' | 'enemyMech' | 'portrait' | 'background';
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
  shield: { w: 34, h: 52 },
  enemy: { w: 64, h: 64 },
  enemyMech: { w: 104, h: 104 },
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
    id: `family-${id}`, kind: 'family', references: [familyFile(fromFamily)],
    prompt:
      'Edit the attached pixel art image of a mecha. Keep everything above the waist exactly as it is: same pixels, ' +
      'same position, same size, same colours. Replace only the lower body (the hips, both legs and both feet) with: ' +
      `${description} The new lower body joins the torso at the same waist and rests on the same ground line as the ` +
      `original feet, and is drawn in the same colours and style as the rest of the mecha. ${PIXEL} ${GREEN}`,
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

  family('wraith', 'ronin',
    'a lean stealth reconnaissance mecha in matte indigo and black armour with thin glowing amber light slits: narrow ' +
    'waist, slim angular limbs, small pointed shoulder guards, and a smooth faceless mask head with one vertical amber ' +
    'slit. Slimmer than the first image, sinister and quiet.'),
  family('colossus', 'ronin',
    'a towering siege mecha in burnished bronze plating with deep blue enamel panels and small white light ports: ' +
    'enormous rounded pauldrons, a broad barrel chest, forearms like tower shields, thick pillar legs, and a crowned ' +
    'head with three short upright fins. The biggest and heaviest of all, regal and slow.'),

  family('mantis', 'ronin',
    'a wiry insect-like scrapyard mecha in olive green and sand yellow plating with thin glowing lime light strips: ' +
    'reverse-jointed grasshopper legs whose knees bend backwards and end in two-toed clawed feet (hips and feet stay ' +
    'where they are in the first image), a narrow waist, forearms with a folded blade-like fin along each, small ' +
    'angular shoulders, and a triangular head with two short antennae and a wide lime visor. Lean and agile.'),
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

  // Enemy-only weapons borrow the look of a shop weapon.
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

  // Enemy mechs are the family drawings themselves, mirrored: no new image needed.
  { id: 'enemy-light-mech', kind: 'enemyMech', source: 'family-halo', flip: true, prompt: '' },
  { id: 'enemy-heavy-mech', kind: 'enemyMech', source: 'family-bulwark', flip: true, prompt: '' },
  { id: 'enemy-rival', kind: 'enemyMech', source: 'family-ronin', flip: true, prompt: '' },
  { id: 'enemy-stalker', kind: 'enemyMech', source: 'family-wraith', flip: true, prompt: '' },
  { id: 'enemy-juggernaut', kind: 'enemyMech', source: 'family-colossus', flip: true, prompt: '' },

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
  { id: 'bg-arena', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: an underground mecha duelling arena at night, a wide scuffed steel floor filling the lower third, tall cage walls, floodlights, banks of spectator stands with a silhouetted crowd, and neon scoreboards in pink and cyan with abstract shapes instead of readable text. No characters or robots in the foreground, no vehicles.' },
  { id: 'bg-garage', kind: 'background',
    prompt: '16-bit pixel art background, no anti-aliasing: the inside of a dim mecha hangar bay at night, steel gantries and catwalks, hanging chains and cables, tool racks along the walls, strips of cyan and magenta neon work lights, an empty metal floor filling the lower half. No characters, no robots, no vehicles, no text.' },
];
