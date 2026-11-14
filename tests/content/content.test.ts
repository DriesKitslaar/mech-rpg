import { validatePlayerBuild } from '../../src/core/build';
import type { Faction, Mission } from '../../src/core/campaign';
import { startMissionBattle } from '../../src/core/mission';
import type { Build, FramePart, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { ENDINGS, EPILOGUES, MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, objectiveLines } from '../../src/ui/briefingScreen';
import { SCENE_LINES, sceneRows } from '../../src/ui/sceneScreen';
import { charsFor, wrap } from '../../src/ui/widgets';

/** What may sit in each slot: a shield goes where a left-hand weapon would. */
const SLOT_KINDS: Record<keyof Build, string[]> = {
  head: ['head'], core: ['core'], arms: ['arms'], legs: ['legs'], generator: ['generator'],
  booster: ['booster'], fcs: ['fcs'], module: ['module'],
  rightHand: ['weapon'], leftHand: ['weapon', 'shield'], shoulder: ['weapon'],
};
const FACTIONS: Faction[] = ['hadron', 'lumen', 'undertow'];
/** The conditions something can wait for that are not the id of a contract. */
const isKeyword = (condition: string): boolean => ['start', 'choice', 'finale', 'verdict'].includes(condition) || /^arena:([1-9]|10)$/.test(condition);
const builds: [string, Build][] = [
  ['starter', STARTER_BUILD], ['demo', DEMO_BUILD],
  ...Object.values(ENEMIES).map((e): [string, Build] => [e.id, e.build]),
];

test.each(builds)('build %s references existing parts of the right kind', (_name, build) => {
  for (const [slot, id] of Object.entries(build)) {
    expect(CATALOG[id], `${slot}: ${id}`).toBeDefined();
    expect(SLOT_KINDS[slot as keyof Build], `${slot}: ${id}`).toContain(CATALOG[id].kind);
  }
});

test('catalogue keys match part ids', () => {
  for (const [key, part] of Object.entries(CATALOG)) expect(part.id).toBe(key);
});

test('enemy keys match enemy ids', () => {
  for (const [key, enemy] of Object.entries(ENEMIES)) expect(enemy.id).toBe(key);
});

test('resist values stay between 0 and 0.6', () => {
  const frames = Object.values(CATALOG).filter((p): p is FramePart => 'resist' in p);
  expect(frames.length).toBeGreaterThan(0);
  for (const part of frames) {
    for (const value of Object.values(part.resist)) {
      expect(value, part.id).toBeGreaterThanOrEqual(0);
      expect(value, part.id).toBeLessThanOrEqual(0.6);
    }
  }
});

test('part names are unique', () => {
  const names = Object.values(CATALOG).map((p) => p.name);
  expect(new Set(names).size).toBe(names.length);
});

describe('shop catalogue', () => {
  const frames = SHOP_PARTS.filter((p): p is FramePart => 'resist' in p);
  const weapons = SHOP_PARTS.filter((p): p is Weapon => p.kind === 'weapon');

  test('the shelf: frame parts, generators, weapons, shields, boosters, fire control and modules', () => {
    const count = (kind: string) => SHOP_PARTS.filter((p) => p.kind === kind).length;
    expect([count('head'), count('core'), count('arms'), count('legs')]).toEqual([8, 8, 8, 11]);
    expect(count('generator')).toBe(8);
    expect(count('booster')).toBe(7);
    expect(count('fcs')).toBe(7);
    expect(count('module')).toBe(11);
    expect(weapons.filter((w) => w.mount === 'hand')).toHaveLength(24);
    expect(weapons.filter((w) => w.mount === 'shoulder')).toHaveLength(17);
    expect(count('shield')).toBe(3);
    expect(SHOP_PARTS).toHaveLength(112);
  });

  test('every trait has what it needs, and each trait is used', () => {
    for (const w of weapons) {
      if (w.trait === 'thermal' || w.trait === 'drain' || w.trait === 'burst') expect(w.traitPower, w.id).toBeGreaterThan(0);
      else expect(w.traitPower, w.id).toBeUndefined();
    }
    expect(new Set(weapons.map((w) => w.trait).filter(Boolean))).toEqual(new Set(['pierce', 'thermal', 'drain', 'twin', 'burst', 'salvo']));
  });

  test('blades and charge weapons: a blade needs no ammunition and pushes hard, and both kinds exist in each mount they come in', () => {
    const blades = weapons.filter((w) => w.melee);
    const chargers = weapons.filter((w) => w.charge);
    expect(blades.length).toBeGreaterThanOrEqual(4);
    for (const blade of blades) {
      expect(blade.mount, blade.id).toBe('hand');
      expect(blade.ammo, blade.id).toBeNull();
      expect(blade.impact, blade.id).toBeGreaterThan(0);
      expect(blade.charge, blade.id).toBeUndefined();
    }
    // Most blades push harder than they cut; the thermal one trades its push for heat.
    expect(blades.filter((blade) => blade.impact! > blade.damage).length).toBeGreaterThanOrEqual(3);
    expect(new Set(chargers.map((w) => w.mount))).toEqual(new Set(['hand', 'shoulder']));
    // A charged shot has to be worth the turn it takes: clearly more than any uncharged weapon of its mount.
    for (const charger of chargers) {
      const rest = weapons.filter((w) => w.mount === charger.mount && !w.charge && !w.melee);
      expect(charger.damage, charger.id).toBeGreaterThan(Math.max(...rest.map((w) => w.damage)));
    }
  });

  test('every shop part has a price and a vendor and is in the catalogue', () => {
    for (const part of SHOP_PARTS) {
      expect(part.price, part.id).toBeGreaterThan(0);
      expect(part.vendor, part.id).toBeDefined();
      expect(CATALOG[part.id]).toBe(part);
    }
  });

  test('enemy-only parts are not for sale', () => {
    expect(SHOP_PARTS.find((p) => p.id === 'core-drone')).toBeUndefined();
    expect(CATALOG['core-drone'].vendor).toBeUndefined();
  });

  test.each(['scout-mk1|hauler|rigger|strider', 'halo|halo|halo|halo', 'bulwark|bulwark|bulwark|bulwark', 'ronin|ronin|ronin|ronin',
    'wraith|wraith|wraith|wraith', 'colossus|colossus|colossus|colossus', 'mantis|mantis|mantis|mantis',
    'auditor|auditor|auditor|auditor'])(
    'family %s makes a valid build with every generator', (family) => {
      const [head, core, arms, legs] = family.split('|');
      for (const generator of ['gen-kd1', 'gen-prism', 'gen-furnace']) {
        const build: Build = {
          head: `head-${head}`, core: `core-${core}`, arms: `arms-${arms}`, legs: `legs-${legs}`, generator,
          booster: 'bst-stock', fcs: 'fcs-stock', rightHand: 'wpn-rivet-rifle',
        };
        expect(validatePlayerBuild(build, CATALOG), `${family} + ${generator}`).toEqual([]);
      }
    });

  test('every kind of legs exists, and each free-standing pair carries a frame of its own weight class', () => {
    const legs = frames.filter((p) => p.kind === 'legs');
    expect(new Set(legs.map((p) => p.legType ?? 'biped'))).toEqual(new Set(['biped', 'reverse', 'quad', 'tank', 'hover']));
    const on = (legsId: string, family: string): Build => ({
      head: `head-${family}`, core: `core-${family}`, arms: `arms-${family}`, legs: legsId, generator: 'gen-kd1',
      booster: 'bst-stock', fcs: 'fcs-stock', rightHand: 'wpn-rivet-rifle',
    });
    expect(validatePlayerBuild(on('legs-crawler', 'colossus'), CATALOG)).toEqual([]);
    expect(validatePlayerBuild(on('legs-spider', 'ronin'), CATALOG)).toEqual([]);
    expect(validatePlayerBuild(on('legs-glide', 'halo'), CATALOG)).toEqual([]);
    expect(validatePlayerBuild(on('legs-glide', 'colossus'), CATALOG)).toEqual(['overweight']);
  });

  test('spot checks against the plan', () => {
    expect(CATALOG['legs-bulwark']).toMatchObject({ capacity: 1500, mobility: 14, price: 1400, vendor: 'hadron' });
    expect(CATALOG['wpn-rail-lance']).toMatchObject({ damage: 85, accuracy: 82, ammo: 10, mount: 'hand' });
    expect(CATALOG['gen-prism']).toMatchObject({ output: 520, cooling: 22 });
    expect(CATALOG['head-scout-mk1'].price).toBe(300);
    expect(CATALOG['wpn-halo-array']).toMatchObject({ ammo: null, mount: 'shoulder', damageType: 'energy' });
    expect(CATALOG['legs-wraith']).toMatchObject({ capacity: 800, mobility: 60, price: 2600 });
    expect(CATALOG['core-colossus']).toMatchObject({ ap: 400, weight: 480 });
    expect(CATALOG['wpn-needler']).toMatchObject({ trait: 'twin', damage: 26, ammo: 16 });
    expect(CATALOG['wpn-null-beam']).toMatchObject({ trait: 'drain', traitPower: 100, mount: 'shoulder' });
    expect(CATALOG['gen-tidal']).toMatchObject({ output: 600, cooling: 30 });
    expect(SHOP_UNLOCKS).toMatchObject({ 'wpn-breaker-cannon': 'arena:9', 'wpn-needler': 'undertow-1', 'gen-ember': 'arena:3', 'head-colossus': 'arena:8' });
  });

});

describe('sprites', () => {
  test('every part the player can see has a sprite', () => {
    const missing: string[] = [];
    for (const part of SHOP_PARTS) {
      // Generators, boosters, fire control and modules sit inside the mech and are never drawn.
      if (['generator', 'booster', 'fcs', 'module'].includes(part.kind)) continue;
      const ids = part.kind === 'arms' ? [`${part.id}.near`, `${part.id}.far`] : [part.id];
      for (const id of ids) if (!(id in SPRITES)) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  test('frame layers record where they sit in the pose and free-standing sprites do not', () => {
    const sprites = SPRITES as Record<string, { ox?: number; oy?: number }>;
    expect(sprites['legs-bulwark'].ox).toBeTypeOf('number');
    expect(sprites['arms-rigger.near'].oy).toBeTypeOf('number');
    expect(sprites['wpn-rail-lance'].ox).toBeUndefined();
  });

  test('both backgrounds and both enemies have sprites', () => {
    for (const id of ['bg-neon-district', 'bg-garage', 'enemy-recon-drone', 'enemy-gun-turret']) expect(id in SPRITES, id).toBe(true);
  });
});

describe('campaign content', () => {
  const story = MISSIONS.filter((m) => m.phase !== 'patrol');
  const of = (phase: Mission['phase']) => MISSIONS.filter((m) => m.phase === phase);

  test('there are twenty-nine story contracts and one patrol, with unique ids, none of them called like the archive', () => {
    expect(story).toHaveLength(29);
    expect(of('patrol')).toHaveLength(1);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(MISSIONS.some((m) => m.id === 'archive')).toBe(false);
  });

  test('the story has its shape: two introductions, two contracts a client, the rival, the choice, three a client, the finales, the audit, two verdicts', () => {
    expect(of('intro')).toHaveLength(2);
    expect(of('rival')).toHaveLength(1);
    expect(of('audit')).toHaveLength(3);
    for (const faction of FACTIONS) {
      const mine = (phase: Mission['phase']) => of(phase).filter((m) => m.faction === faction);
      expect(mine('faction').map((m) => [m.id, m.after])).toEqual([[`${faction}-1`, undefined], [`${faction}-2`, `${faction}-1`]]);
      expect(mine('choice').map((m) => m.id)).toEqual([`choice-${faction}`]);
      expect(mine('path').map((m) => m.id)).toEqual([3, 4, 5].map((n) => `${faction}-${n}`));
      expect(mine('finale').map((m) => m.id)).toEqual([`finale-${faction}`]);
    }
    expect(of('verdict').map((m) => m.verdict).sort()).toEqual(['default', 'enforce']);
    // Only the contracts that belong to a client name one.
    for (const m of [...of('intro'), ...of('rival'), ...of('audit'), ...of('verdict')]) expect(m.faction, m.id).toBeUndefined();
  });

  test.each(MISSIONS.map((m) => [m.id, m] as const))('contract %s is complete and fights known enemies', (_id, mission) => {
    expect(mission.title.length).toBeGreaterThan(0);
    // The hub lists the title with the fee beside it.
    expect(mission.title.length).toBeLessThanOrEqual(18);
    expect(mission.briefing.length).toBeGreaterThan(0);
    expect(mission.debrief.length).toBeGreaterThan(0);
    expect(mission.reward).toBeGreaterThan(0);
    expect(mission.battles.length).toBeGreaterThanOrEqual(1);
    expect(mission.battles.length).toBeLessThanOrEqual(3);
    for (const battle of mission.battles) {
      expect(battle.enemies.length).toBeGreaterThanOrEqual(1);
      expect(battle.enemies.length).toBeLessThanOrEqual(3);
      for (const id of battle.enemies) expect(ENEMIES[id], id).toBeDefined();
      expect(battle.background in SPRITES, battle.background).toBe(true);
    }
    if (mission.portrait) expect(mission.portrait in SPRITES, mission.portrait).toBe(true);
  });

  test.each(MISSIONS.map((m) => [m.id, m] as const))('every battle of %s can be started as it is written', (_id, mission) => {
    for (let i = 0; i < mission.battles.length; i++) {
      const battle = mission.battles[i];
      const state = startMissionBattle(DEMO_BUILD, mission, i, ENEMIES, CATALOG, 1);
      expect(state.objective.type).toBe(battle.objective?.type ?? 'destroy');
      // A machine wanted in one piece is not for an ally to shoot at, and a named enemy must be worth naming.
      if (battle.objective?.type === 'disable') expect(battle.support, `${mission.id} battle ${i + 1}`).toBeUndefined();
      if (battle.objective?.type === 'leader') expect(battle.enemies.length, `${mission.id} battle ${i + 1}`).toBeGreaterThan(1);
    }
  });

  test.each(MISSIONS.map((m) => [m.id, m] as const))('the words of %s fit where they are shown', (_id, mission) => {
    // The briefing: every line is drawn, above whatever lines of objectives there are.
    const rows = briefingRows(mission);
    expect(objectiveLines(mission).length, 'objective lines').toBeLessThanOrEqual(3);
    for (const line of objectiveLines(mission)) expect(line.length, line).toBeLessThanOrEqual(BRIEFING_CHARS);
    let y = 0;
    for (const paragraph of mission.briefing) {
      for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
        expect(y, `briefing of ${mission.id} is too long`).toBeLessThanOrEqual((rows - 1) * 11);
        y += 11;
      }
      y += 4;
    }
    // The debrief: three lines on the settlement.
    expect(wrap(mission.debrief, charsFor(210)).length, mission.debrief).toBeLessThanOrEqual(3);
    // Talk: three lines in the box, said at a moment that exists, by someone with a face that exists.
    for (const battle of mission.battles) {
      for (const line of battle.talk ?? []) {
        expect(wrap(line.text, TALK_CHARS).length, line.text).toBeLessThanOrEqual(TALK_LINES);
        expect(line.who.length).toBeGreaterThan(0);
        expect(line.at === 'start' || line.at === 'win' || (Number.isInteger(line.at) && (line.at as number) >= 1), String(line.at)).toBe(true);
        if (line.portrait) expect(line.portrait in SPRITES, line.portrait).toBe(true);
      }
    }
  });

  test('every enemy has a sprite and a build made of known parts', () => {
    for (const enemy of Object.values(ENEMIES)) {
      expect(enemy.sprite in SPRITES, enemy.sprite).toBe(true);
      for (const id of Object.values(enemy.build)) expect(CATALOG[id], `${enemy.id}: ${id}`).toBeDefined();
      if (enemy.portrait) expect(enemy.portrait in SPRITES, enemy.portrait).toBe(true);
    }
    expect(Object.keys(ENEMIES)).toHaveLength(30);
  });

  test('every enemy appears in the story', () => {
    const used = new Set(MISSIONS.flatMap((m) => m.battles.flatMap((b) => b.enemies)));
    expect(Object.keys(ENEMIES).filter((id) => !used.has(id))).toEqual([]);
  });

  test('enemies that are drawn from their parts have a sprite for every part they show, in every phase', () => {
    const composed = Object.values(ENEMIES).filter((e) => e.composed);
    expect(composed.map((e) => e.id).sort()).toEqual([
      'ashfall-unbound', 'assessor', 'bailiff', 'bulldozer', 'heavy-mech', 'juggernaut', 'krell', 'light-mech', 'marksman',
      'ripper', 'rival', 'rival-2', 'rook', 'sable', 'stalker',
    ]);
    for (const enemy of composed) {
      const { head, core, arms, legs } = enemy.build;
      const carried = [enemy.build, ...(enemy.phases ?? []).map((p) => p.refit ?? {})].flatMap((b) => [b.rightHand, b.leftHand, b.shoulder]);
      const ids = [head, core, legs, `${arms}.near`, `${arms}.far`, ...carried].filter(Boolean) as string[];
      for (const id of ids) expect(id in SPRITES, `${enemy.id}: ${id}`).toBe(true);
    }
  });

  test('what enemies can do is well formed: phases in order, parts named briefly, carriers launching known units', () => {
    for (const enemy of Object.values(ENEMIES)) {
      const shares = (enemy.phases ?? []).map((p) => p.at);
      for (const [i, at] of shares.entries()) {
        expect(at, enemy.id).toBeGreaterThan(0);
        expect(at, enemy.id).toBeLessThan(i === 0 ? 1 : shares[i - 1]);
      }
      for (const phase of enemy.phases ?? []) {
        expect(phase.line, enemy.id).toBeTruthy();
        expect(wrap(phase.line!, TALK_CHARS).length, phase.line).toBeLessThanOrEqual(TALK_LINES);
        for (const id of Object.values(phase.refit ?? {})) expect(CATALOG[id!], `${enemy.id}: ${id}`).toBeDefined();
      }
      // The part column of the battle panel holds five characters with room to spare before the bar.
      for (const name of Object.values(enemy.partNames ?? {})) expect(name.length, `${enemy.id}: ${name}`).toBeLessThanOrEqual(5);
      const { carrier, bomb, aegis, jam, mend } = enemy.abilities ?? {};
      if (carrier) {
        expect(ENEMIES[carrier.unit.id], enemy.id).toBe(carrier.unit);
        expect(carrier.unit.abilities?.carrier, enemy.id).toBeUndefined();
        expect(carrier.every).toBeGreaterThanOrEqual(1);
      }
      if (bomb) expect(bomb.fuse).toBeGreaterThanOrEqual(2);
      if (aegis !== undefined) expect(aegis > 0 && aegis < 1, enemy.id).toBe(true);
      if (jam !== undefined) expect(jam > 0 && jam <= 30, enemy.id).toBe(true);
      if (mend !== undefined) expect(mend > 0 && mend <= 0.5, enemy.id).toBe(true);
    }
  });

  test('every client has an end to their war, and every verdict an epilogue for every client', () => {
    expect(Object.keys(ENDINGS).sort()).toEqual(['hadron', 'lumen', 'undertow']);
    expect(Object.keys(EPILOGUES).sort()).toEqual(['default', 'enforce']);
    for (const verdict of ['enforce', 'default'] as const) expect(Object.keys(EPILOGUES[verdict]).sort()).toEqual(['hadron', 'lumen', 'undertow']);
    const titles = [...Object.values(ENDINGS), ...Object.values(EPILOGUES).flatMap((e) => Object.values(e))].map((e) => e.title);
    expect(new Set(titles).size).toBe(9);
  });

  test('scenes: unique ids, real conditions and pictures, text that fits the page, and an ending for every way the story can end', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    for (const scene of SCENES) {
      for (const condition of [scene.after, ...(scene.before ? [scene.before] : [])]) {
        expect(isKeyword(condition) || MISSIONS.some((m) => m.id === condition), `${scene.id}: ${condition}`).toBe(true);
      }
      if (scene.picture) expect(scene.picture in SPRITES, scene.picture).toBe(true);
      expect(sceneRows(scene), scene.id).toBeLessThanOrEqual(SCENE_LINES);
      expect(scene.title.length, scene.id).toBeLessThanOrEqual(14);
    }
    expect(SCENES.filter((s) => !s.ending && !s.faction).map((s) => s.id)).toEqual(['act-1', 'act-2', 'act-3']);
    const endings = SCENES.filter((s) => s.ending);
    expect(endings.map((s) => `${s.after}|${s.faction}`).sort()).toEqual(
      ['enforce', 'default'].flatMap((v) => FACTIONS.map((f) => `verdict-${v}|${f}`)).sort());
  });

  test('messages have unique ids and wait for events that exist', () => {
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
    for (const message of MESSAGES) {
      expect(isKeyword(message.after) || MISSIONS.some((m) => m.id === message.after), message.id).toBe(true);
      if (message.portrait) expect(message.portrait in SPRITES, message.portrait).toBe(true);
      // The body panel of the inbox holds fourteen lines.
      const rows = message.body.reduce((sum, paragraph) => sum + wrap(paragraph, BRIEFING_CHARS).length, 0) + (message.body.length - 1) * 0.5;
      expect(rows, message.id).toBeLessThanOrEqual(14);
    }
  });

  test('shop unlocks name real parts and real conditions, and the starter kit is never locked', () => {
    for (const [partId, condition] of Object.entries(SHOP_UNLOCKS)) {
      expect(SHOP_PARTS.some((p) => p.id === partId), partId).toBe(true);
      expect(isKeyword(condition) || MISSIONS.some((m) => m.id === condition), condition).toBe(true);
    }
    for (const id of Object.values(STARTER_BUILD)) expect(id in SHOP_UNLOCKS, id).toBe(false);
  });

  test('a second and third weapon can be bought before any client has been worked for', () => {
    const open = SHOP_PARTS.filter((p) => !(p.id in SHOP_UNLOCKS) && p.kind === 'weapon');
    expect(open.filter((p) => p.kind === 'weapon' && p.mount === 'hand').length).toBeGreaterThanOrEqual(2);
    expect(open.filter((p) => p.kind === 'weapon' && p.mount === 'shoulder').length).toBeGreaterThanOrEqual(1);
  });
});
