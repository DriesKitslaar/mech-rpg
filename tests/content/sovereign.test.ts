import { existsSync } from 'node:fs';
import { ARCHETYPES, QUICK_LEGS, SLOW_LEGS, archetypeOf } from '../../src/core/archetype';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { reached, startNewCycle, stockFor } from '../../src/core/campaign';
import { isValidState, type GameState } from '../../src/core/game';
import { draft, startRun, type Run } from '../../src/core/gauntlet';
import { seatHeld } from '../../src/core/seat';
import type { Build, FramePart, Part } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { GAUNTLET_BUILD } from '../../src/content/gauntlet';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { JOBS, OWN_COLOURS } from '../../scripts/art/jobs';
import { PAINTS, hueBucket, recolour, toHsl, type PaintInfo } from '../../src/ui/paint';
import { done } from '../helpers/app';
import { readPng } from '../helpers/png';

/**
 * The Sovereign: the frame of the one who keeps the eighth seat. What its four parts are, beside
 * the frames a pilot could own before it; that its pictures are there; and that it is sold to the
 * pilot who holds the seat and to nobody else, in any telling.
 */

const SOVEREIGN = ['head-sovereign', 'core-sovereign', 'arms-sovereign', 'legs-sovereign'];
const AUDITOR = ['head-auditor', 'core-auditor', 'arms-auditor', 'legs-auditor'];
const frame = (ids: string[]): FramePart[] => ids.map((id) => CATALOG[id] as FramePart);
const sum = (ids: string[], of: (part: FramePart) => number): number => frame(ids).reduce((total, part) => total + of(part), 0);
/** Every frame part a pilot can own: sold by somebody. */
const OWNED = SHOP_PARTS.filter((part): part is FramePart => ['head', 'core', 'arms', 'legs'].includes(part.kind));
const sheet = SPRITES as Record<string, { file: string; w: number; h: number; paint?: { accent: number[] } }>;
const STORY = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
const ended = (): GameState => done(...STORY, 'verdict-enforce');
const shelf = (g: GameState): string[] => stockFor(g, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((part: Part) => part.id).filter((id) => id.endsWith('-sovereign'));
const wearing = (build: Build): Build => ({ ...build, head: SOVEREIGN[0], core: SOVEREIGN[1], arms: SOVEREIGN[2], legs: SOVEREIGN[3] });

describe('the four parts', () => {
  test('they are a head, a core, arms and legs by the names the yard gives them, and each is among what the shop can sell', () => {
    expect(frame(SOVEREIGN).map((part) => [part.id, part.name, part.kind])).toEqual([
      ['head-sovereign', 'Sovereign Crest', 'head'], ['core-sovereign', 'Sovereign Core', 'core'],
      ['arms-sovereign', 'Sovereign Arms', 'arms'], ['legs-sovereign', 'Sovereign Legs', 'legs'],
    ]);
    for (const id of SOVEREIGN) expect(SHOP_PARTS.some((part) => part.id === id), id).toBe(true);
    // No name is longer than the longest a part already had: the rows it is written in were made for that.
    const longest = Math.max(...SHOP_PARTS.filter((part) => !SOVEREIGN.includes(part.id)).map((part) => part.name.length));
    for (const part of frame(SOVEREIGN)) expect(part.name.length, part.name).toBeLessThanOrEqual(longest);
  });

  test('nothing a pilot can own costs more, part for part, or draws more from the generator', () => {
    for (const part of frame(SOVEREIGN)) {
      const others = OWNED.filter((other) => other.kind === part.kind && other.id !== part.id);
      expect(others.length).toBeGreaterThan(5);
      expect(Math.max(...others.map((other) => other.price)), part.id).toBeLessThan(part.price);
      expect(Math.max(...others.map((other) => other.drain)), part.id).toBeLessThan(part.drain);
    }
    expect(sum(SOVEREIGN, (part) => part.price)).toBe(29200);
    // Twice an Auditor and more: the frame that was the dearest before it.
    expect(sum(SOVEREIGN, (part) => part.price)).toBeGreaterThan(2 * sum(AUDITOR, (part) => part.price));
  });

  test('it is plated a little above the Auditor and well below the Colossus, and is quicker on its feet than either', () => {
    const armour = (ids: string[]): number => sum(ids, (part) => part.ap);
    const COLOSSUS = ['head-colossus', 'core-colossus', 'arms-colossus', 'legs-colossus'];
    expect(armour(SOVEREIGN)).toBe(855);
    expect(armour(SOVEREIGN) / armour(AUDITOR)).toBeGreaterThan(1.04);
    expect(armour(SOVEREIGN) / armour(AUDITOR)).toBeLessThan(1.1);
    expect(armour(SOVEREIGN)).toBeLessThan(armour(COLOSSUS) * 0.9);
    // No part of it resists anything less than the Auditor's part does.
    for (const [i, part] of frame(SOVEREIGN).entries()) {
      const theirs = frame(AUDITOR)[i];
      for (const type of ['kinetic', 'energy', 'explosive'] as const) expect(part.resist[type], `${part.id} ${type}`).toBeGreaterThanOrEqual(theirs.resist[type]);
    }
    const legs = (id: string): FramePart => CATALOG[id] as FramePart;
    expect(legs('legs-sovereign').mobility).toBe(36);
    expect(legs('legs-sovereign').mobility!).toBeGreaterThan(legs('legs-auditor').mobility!);
    expect(legs('legs-sovereign').mobility!).toBeGreaterThan(legs('legs-colossus').mobility!);
    // And slower than the frames that are made to be quick, and than the line a skirmisher's legs are over.
    expect(legs('legs-sovereign').mobility!).toBeLessThan(legs('legs-sterling').mobility!);
    expect(legs('legs-sovereign').mobility!).toBeLessThan(QUICK_LEGS);
    expect(legs('legs-sovereign').mobility!).toBeGreaterThan(SLOW_LEGS);
    // It carries more than an Auditor's legs do, and weighs more than an Auditor does; only the Colossus is heavier.
    expect(legs('legs-sovereign').capacity!).toBeGreaterThan(legs('legs-auditor').capacity!);
    const weight = (ids: string[]): number => sum(ids, (part) => part.weight);
    expect(weight(SOVEREIGN)).toBeGreaterThan(weight(AUDITOR));
    expect(weight(SOVEREIGN)).toBeLessThan(weight(COLOSSUS));
  });

  test('it has what each of the two duel frames has of its own: a field in its core, smaller than the Sterling\'s, and arms that keep their balance', () => {
    const core = CATALOG['core-sovereign'] as FramePart;
    const arms = CATALOG['arms-sovereign'] as FramePart;
    expect(core.field).toBe(20);
    expect(core.field!).toBeLessThan((CATALOG['core-sterling'] as FramePart).field!);
    expect(arms.poise).toBe(true);
    expect((CATALOG['arms-shrike'] as FramePart).poise).toBe(true);
    // Nothing else a pilot can own has either, but those two frames.
    expect(OWNED.filter((part) => part.field !== undefined).map((part) => part.id).sort()).toEqual(['core-sovereign', 'core-sterling']);
    expect(OWNED.filter((part) => part.poise).map((part) => part.id).sort()).toEqual(['arms-shrike', 'arms-sovereign']);
    // Its eye is as sharp as the duel frames' and no sharper than the Wraith's.
    expect((CATALOG['head-sovereign'] as FramePart).aim).toBe(20);
    expect((CATALOG['head-sovereign'] as FramePart).aim!).toBeLessThan((CATALOG['head-wraith'] as FramePart).aim!);
  });
});

describe('what can be built in it', () => {
  test('the late build of every class but the skirmisher stands in it, with what it draws left over: less than the build had in its own frame', () => {
    for (const kind of ARCHETYPES) {
      const late = ARCHETYPE_BUILDS[kind].late;
      const worn = wearing(late);
      expect(validatePlayerBuild(worn, CATALOG), kind).toEqual([]);
      const [before, after] = [computeBuildStats(late, CATALOG), computeBuildStats(worn, CATALOG)];
      expect(after.turnEnergy, kind).toBeLessThan(before.turnEnergy);
      expect(after.turnEnergy, kind).toBeGreaterThanOrEqual(250);
      expect(after.weight, kind).toBeLessThanOrEqual(after.capacity);
    }
  });

  test('what it carries makes it a duellist, a marksman, artillery or a lancer; on its own legs with plain guns it is an all-rounder, and never a skirmisher', () => {
    const made = (kind: (typeof ARCHETYPES)[number]) => archetypeOf(wearing(ARCHETYPE_BUILDS[kind].late), CATALOG);
    expect(Object.fromEntries(ARCHETYPES.map((kind) => [kind, made(kind)]))).toEqual({
      duellist: 'duellist', marksman: 'marksman', artillery: 'artillery', lancer: 'lancer',
      // A bastion's guns and a skirmisher's are plain guns: what made those builds of their class was their legs.
      bastion: 'allrounder', skirmisher: 'allrounder', allrounder: 'allrounder',
    });
    // Behind a shield it is a bastion, as anything is.
    const shielded = { ...wearing(ARCHETYPE_BUILDS.allrounder.late), leftHand: 'shd-riot' };
    expect(validatePlayerBuild(shielded, CATALOG)).toEqual([]);
    expect(archetypeOf(shielded, CATALOG)).toBe('bastion');
    // Its head, core and arms on the quickest legs there are weigh more than those legs carry, whatever else is left off.
    const quick: Build = { ...wearing(ARCHETYPE_BUILDS.skirmisher.late), legs: 'legs-wraith', leftHand: undefined, shoulder: undefined };
    expect(validatePlayerBuild(quick, CATALOG)).toContain('overweight');
  });
});

describe('its pictures', () => {
  test('there are twelve, drawn as every frame is: the machine and its five layers, from the front and from behind', () => {
    const ids = [
      'family-sovereign', 'legs-sovereign', 'core-sovereign', 'head-sovereign', 'arms-sovereign.near', 'arms-sovereign.far',
      'back-sovereign', 'legs-sovereign.back', 'core-sovereign.back', 'head-sovereign.back', 'arms-sovereign.near.back', 'arms-sovereign.far.back',
    ];
    // (Its five small layers, for where a mech is drawn small, are those from the front made smaller: nothing is drawn for them.)
    const drawn = JOBS.filter((job) => job.id.includes('sovereign') && !job.source);
    expect(drawn.map((job) => job.id).sort()).toEqual([...ids].sort());
    expect(JOBS.filter((job) => job.id.includes('sovereign') && job.source).map((job) => job.id).sort())
      .toEqual(ids.slice(1, 6).map((id) => `${id}.small`).sort());
    for (const job of drawn) {
      expect(job.quality ?? 'low', job.id).toBe('low');
      expect(existsSync(`art/raw/${job.id}.png`), job.id).toBe(true);
    }
    // The design is the game's own, and says so in words no other frame's has.
    const design = JOBS.find((job) => job.id === 'family-sovereign')!.prompt;
    expect(design).toContain('seven short gold points');
    expect(design).toContain('deep violet enamel');
    expect(JOBS.filter((job) => job.kind === 'family' && job.prompt.includes('violet enamel')).map((job) => job.id).sort()).toEqual(['back-sovereign', 'family-sovereign']);
  });

  test('every layer the game draws a mech from is in the sheet for it, with what a paint needs to know, and the same for all of them', () => {
    const layers = ['legs-sovereign', 'core-sovereign', 'head-sovereign', 'arms-sovereign.near', 'arms-sovereign.far'];
    const all = [...layers, ...layers.map((id) => `${id}.back`), ...layers.map((id) => `${id}.small`)];
    for (const id of all) {
      const entry = sheet[id];
      expect(entry, id).toBeDefined();
      expect(existsSync(`public/${entry.file}`), id).toBe(true);
      expect(entry.w, id).toBeGreaterThan(8);
      expect(entry.h, id).toBeGreaterThan(8);
    }
    const paints = [...layers, ...layers.map((id) => `${id}.back`)].map((id) => JSON.stringify(sheet[id].paint));
    expect(new Set(paints).size).toBe(1);
    expect(sheet['core-sovereign'].paint!.accent.length).toBeGreaterThan(0);
    // The other frames that are drawn so have the same layers: nothing of this one is missing beside them.
    const sterling = Object.keys(sheet).filter((id) => id.includes('sterling')).map((id) => id.replace('sterling', 'sovereign')).sort();
    expect(Object.keys(sheet).filter((id) => id.includes('sovereign')).sort()).toEqual(sterling);
  });
});

describe('its colours', () => {
  /** How much of a picture that is there is violet: between blue and magenta, and plainly a colour. */
  const violet = (id: string): number => {
    const picture = readPng(`public/sprites/${id}.png`);
    let [solid, found] = [0, 0];
    for (let y = 0; y < picture.h; y++) {
      for (let x = 0; x < picture.w; x++) {
        const [r, g, b, a] = picture.at(x, y);
        if (a === 0) continue;
        solid++;
        const [hue, sat, light] = toHsl(r, g, b);
        if (hue >= 255 && hue <= 295 && sat >= 0.4 && light >= 0.1) found++;
      }
    }
    return found / solid;
  };

  test('it is in violet enamel, which no other frame is: its own colours beside the palette every picture shares', () => {
    expect(OWN_COLOURS.sovereign).toHaveLength(5);
    for (const [r, g, b] of OWN_COLOURS.sovereign) {
      const [hue, sat] = toHsl(r, g, b);
      expect(hue).toBeGreaterThanOrEqual(255);
      expect(hue).toBeLessThanOrEqual(295);
      expect(sat).toBeGreaterThanOrEqual(0.4);
    }
    // From its shadow to its shine, each lighter than the last.
    const lightness = OWN_COLOURS.sovereign.map(([r, g, b]) => toHsl(r, g, b)[2]);
    expect([...lightness].sort((a, b) => a - b)).toEqual(lightness);
    expect(Object.keys(OWN_COLOURS)).toEqual(['sovereign']);
    // A tenth and more of every layer of it is that violet, from the front, from behind and small: the rest is its gold, its ivory and its shadow.
    for (const part of ['head-sovereign', 'core-sovereign', 'legs-sovereign', 'arms-sovereign.near', 'arms-sovereign.far']) {
      for (const view of ['', '.back', '.small']) expect(violet(`${part}${view}`), `${part}${view}`).toBeGreaterThan(0.1);
    }
    for (const view of ['', '.back', '.small']) expect(violet(`legs-sovereign${view}`), view).toBeGreaterThan(0.25);
    // And nothing of any other frame is: the palette they share has no such colour.
    for (const other of ['core-auditor', 'core-sterling', 'core-ronin', 'core-wraith', 'core-colossus', 'core-halo', 'core-shrike', 'legs-wraith']) expect(violet(other), other).toBe(0);
  });

  test('a paint takes it as it takes any frame: the violet is armour and goes with the scheme, the gold is trim and goes with the scheme\'s trim', () => {
    const info = sheet['core-sovereign'].paint!;
    // Violet is the ninth of twelve hues round the wheel (270 to 300 degrees); gold the second (30 to 60).
    expect(info.accent).not.toContain(hueBucket(280));
    expect(info.accent).toContain(hueBucket(45));
    const picture = readPng('public/sprites/core-sovereign.png');
    const data = new Uint8ClampedArray(picture.w * picture.h * 4);
    for (let y = 0; y < picture.h; y++) for (let x = 0; x < picture.w; x++) data.set(picture.at(x, y), (y * picture.w + x) * 4);
    const crimson = PAINTS.find((paint) => paint.id === 'crimson')!;
    const painted = recolour(data, crimson, info as PaintInfo);
    let [purple, red] = [0, 0];
    for (let i = 0; i < painted.length; i += 4) {
      if (painted[i + 3] === 0) continue;
      const [hue, sat] = toHsl(painted[i], painted[i + 1], painted[i + 2]);
      if (sat >= 0.4 && hue >= 255 && hue <= 295) purple++;
      if (sat >= 0.4 && (hue >= 335 || hue <= 15)) red++;
    }
    expect(purple).toBe(0);
    expect(red).toBeGreaterThan(100);
  });
});

describe('where it is not come by', () => {
  test('the Gauntlet offers what the market sells and nothing built to order: no floor of any run has a part of it on offer', () => {
    for (const part of frame(SOVEREIGN)) expect(part.bespoke, part.id).toBe(true);
    // Nothing else is built to order: every other part a pilot can own may turn up in a run.
    expect(SHOP_PARTS.filter((part) => 'bespoke' in part && part.bespoke).map((part) => part.id)).toEqual(SOVEREIGN);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      // Deep floors, where everything else that is dear is on offer; with the frame bare enough that anything fits.
      for (const floor of [1, 6, 10, 12, 14, 16, 20, 30, 60]) {
        const run: Run = { ...startRun(seed, GAUNTLET_BUILD), floor };
        for (const offer of draft(run, CATALOG)) if (offer.kind === 'part') seen.add(offer.part);
        for (const offer of draft({ ...run, elite: true, relics: ['key'] }, CATALOG)) if (offer.kind === 'part') seen.add(offer.part);
      }
    }
    expect([...seen].filter((id) => id.endsWith('-sovereign'))).toEqual([]);
    // The frames that were the dearest before it are offered down there, so the floors looked at are deep enough.
    expect([...seen].some((id) => id.endsWith('-auditor') || id.endsWith('-sterling'))).toBe(true);
  });
});

describe('who is sold it', () => {
  test('the seat is held by a plain yes in the kept game and by nothing else', () => {
    const g = ended();
    expect(seatHeld(g)).toBe(false);
    expect(seatHeld({ ...g, seat: true })).toBe(true);
    for (const odd of [false, 1, 'true', 'yes', null, {}, []]) expect(seatHeld({ ...g, seat: odd as unknown as true }), String(odd)).toBe(false);
    // A kept game is a game with the seat or without it, and one with something odd there is still a game: without it.
    expect(isValidState({ ...g, seat: true }, CATALOG)).toBe(true);
    expect(isValidState(g, CATALOG)).toBe(true);
    expect(isValidState({ ...g, seat: 'yes' }, CATALOG)).toBe(true);
    expect(reached({ ...g, seat: 'yes' as unknown as true }, 'seat', MISSIONS)).toBe(false);
  });

  test('`seat` is reached when the seat is held, and joins the other conditions as any does', () => {
    const g = ended();
    const seated: GameState = { ...g, seat: true };
    expect(reached(g, 'seat', MISSIONS)).toBe(false);
    expect(reached(seated, 'seat', MISSIONS)).toBe(true);
    expect(reached(seated, 'seat&verdict', MISSIONS)).toBe(true);
    expect(reached(seated, '!seat', MISSIONS)).toBe(false);
    expect(reached(g, '!seat', MISSIONS)).toBe(true);
    // Seven crowns are not the seat, and a contract that happened to be called so is not either.
    expect(reached({ ...g, crowns: [...ARCHETYPES], masters: [...ARCHETYPES] }, 'seat', MISSIONS)).toBe(false);
    expect(reached({ ...g, completed: [...g.completed, 'seat'] }, 'seat', MISSIONS)).toBe(false);
  });

  test('all four parts wait for the seat, and the shelf has none of them without it: in a first telling, with every crown, and in a later telling', () => {
    expect(SOVEREIGN.map((id) => SHOP_UNLOCKS[id])).toEqual(['seat', 'seat', 'seat', 'seat']);
    const g = ended();
    expect(shelf(g)).toEqual([]);
    expect(shelf({ ...g, arenaRank: 15, crowns: [...ARCHETYPES], masters: [...ARCHETYPES] })).toEqual([]);
    // A vendor remembers what a contract opened; nobody remembers a seat that was never taken.
    const later: GameState = { ...startNewCycle(g, MISSIONS), cycle: 2 };
    expect(shelf(later)).toEqual([]);
    expect(shelf({ ...later, arenaRank: 15 })).toEqual([]);
  });

  test('with the seat held all four are on the shelf, and stay there when the story starts over', () => {
    const seated: GameState = { ...ended(), seat: true };
    expect(shelf(seated)).toEqual(SOVEREIGN);
    const again = startNewCycle(seated, MISSIONS);
    expect(again.seat).toBe(true);
    expect(shelf(again)).toEqual(SOVEREIGN);
    // The rest of the shelf is what it was: the seat puts four parts on it and takes nothing off.
    const rest = (state: GameState): string[] => stockFor(state, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((part) => part.id).filter((id) => !id.endsWith('-sovereign'));
    expect(rest(seated)).toEqual(rest(ended()));
  });
});
