import { existsSync } from 'node:fs';
import { forCycle, type Battle, type Mission } from '../../src/core/campaign';
import { makeJob } from '../../src/core/jobs';
import { startMissionBattle } from '../../src/core/mission';
import { BOARD_TEXT } from '../../src/content/board';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SIDE_WORK } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { BOX, JOBS } from '../../scripts/art/jobs';

/**
 * What a pilot is asked to keep alive, and the picture of it that stands on the field: which
 * things have one, that every one named is there to be drawn, and that it is small enough for
 * the place it stands in.
 */

const sheet = SPRITES as Record<string, { file: string; w: number; h: number }>;
/** Every battle the game has written out, with whose it is: the story's (the other side's offers with them), the side work's, the drills'. */
const written = (): { id: string; battle: Battle }[] => {
  const missions: Mission[] = [...new Map([...MISSIONS, ...SIDE_WORK].map((mission) => [mission.id, mission])).values()];
  return [
    ...missions.flatMap((mission) => [...mission.battles, ...(mission.other?.battles ?? [])].map((battle) => ({ id: mission.id, battle }))),
    ...DRILLS.map((drill) => ({ id: drill.id, battle: drill.battle })),
  ];
};
const guarded = () => written().flatMap(({ id, battle }) => (battle.objective?.type === 'protect' ? [{ id, name: battle.objective.name, sprite: battle.objective.sprite }] : []));

describe('the pictures', () => {
  const IDS = ['asset-wage-truck', 'asset-ore-lift', 'asset-motorcade', 'asset-pump-barge', 'asset-convoy', 'asset-ore-train', 'asset-core-stack'];

  test('there are seven, each drawn as freight is drawn, and each is in the sheet at a size that fits where freight stands', () => {
    const drawn = JOBS.filter((job) => job.kind === 'asset');
    expect(drawn.map((job) => job.id).sort()).toEqual([...IDS].sort());
    expect(BOX.asset).toEqual({ w: 56, h: 38 });
    for (const job of drawn) {
      // From the side, facing the enemy, against the frame of a machine no enemy flies as a single picture; and unarmed.
      expect(job.flip, job.id).toBeFalsy();
      expect(job.references, job.id).toHaveLength(1);
      expect(job.references![0]).toMatch(/family-(courier|dozer)\.png$/);
      expect(job.prompt).toContain('Strict side view facing right.');
      expect(job.prompt).toContain('no guns, no barrels');
      expect(job.quality ?? 'low').toBe('low');
    }
    for (const id of IDS) {
      const entry = sheet[id];
      expect(entry, id).toBeDefined();
      expect(entry.file).toBe(`sprites/${id}.png`);
      expect(existsSync(`public/${entry.file}`), id).toBe(true);
      expect(entry.w, id).toBeLessThanOrEqual(56);
      expect(entry.h, id).toBeLessThanOrEqual(38);
      // Large enough to be made out: no thinner than a quarter of the room it has.
      expect(entry.w, id).toBeGreaterThanOrEqual(40);
      expect(entry.h, id).toBeGreaterThanOrEqual(14);
    }
    // Nothing else in the sheet is called freight.
    expect(Object.keys(sheet).filter((id) => id.startsWith('asset-')).sort()).toEqual([...IDS].sort());
  });
});

describe('what has a picture', () => {
  test('the story\'s train and stack and every convoy have theirs; the hangar, which is the place itself, and a wingman\'s frame have none', () => {
    const byName = new Map<string, Set<string | undefined>>();
    for (const { name, sprite } of guarded()) byName.set(name, (byName.get(name) ?? new Set()).add(sprite));
    expect(Object.fromEntries([...byName].map(([name, sprites]) => [name, [...sprites]]))).toEqual({
      'Ore Train': ['asset-ore-train'], 'Core Stack': ['asset-core-stack'], Convoy: ['asset-convoy'], Hangar: [undefined], "Kite's Frame": [undefined],
    });
    // Where they are: two battles of the train, two of the stack, two of the hangar; a convoy in a drill and twice in a favour; the frame once.
    const count = (name: string): number => guarded().filter((entry) => entry.name === name).length;
    expect(['Ore Train', 'Core Stack', 'Hangar', 'Convoy', "Kite's Frame"].map(count)).toEqual([2, 2, 2, 3, 1]);
    for (const { id, sprite } of guarded()) if (sprite !== undefined) expect(sheet[sprite], `${id}: ${sprite}`).toBeDefined();
  });

  test('the board\'s escorts have one for each place, the one that goes with the name', () => {
    expect(BOARD_TEXT.assetSprites).toEqual(['asset-wage-truck', 'asset-ore-lift', 'asset-motorcade', 'asset-pump-barge']);
    expect(BOARD_TEXT.assets).toEqual(['Wage Truck', 'Ore Lift', 'Motorcade', 'Pump Barge']);
    for (const id of BOARD_TEXT.assetSprites) expect(sheet[id], id).toBeDefined();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const [battle] = makeJob('escort', 4, seed, BOARD_TEXT).battles;
      const place = BOARD_TEXT.backgrounds.indexOf(battle.background);
      expect(battle.objective).toMatchObject({ type: 'protect', name: BOARD_TEXT.assets[place], sprite: BOARD_TEXT.assetSprites[place] });
      seen.add((battle.objective as { sprite: string }).sprite);
    }
    expect(seen.size).toBe(4);
    // No other kind of job has freight.
    for (const kind of ['hit', 'repo', 'hold'] as const) expect(makeJob(kind, 4, 7, BOARD_TEXT).battles[0].objective).not.toHaveProperty('sprite');
  });

  test('it reaches the field: a battle begun from the contract has it, and a later telling\'s tougher escort keeps it', () => {
    const train = MISSIONS.find((mission) => mission.battles.some((battle) => battle.objective?.type === 'protect' && battle.objective.name === 'Ore Train'))!;
    const first = startMissionBattle(DEMO_BUILD, train, 0, ENEMIES, CATALOG, 3);
    expect(first.asset).toEqual({ name: 'Ore Train', hp: 12, maxHp: 12, sprite: 'asset-ore-train' });
    const again = forCycle(train, 2);
    const tougher = again.battles[0].objective as { type: 'protect'; hp: number; sprite?: string };
    expect(tougher.hp).toBeGreaterThan(12);
    expect(tougher.sprite).toBe('asset-ore-train');
    expect(startMissionBattle(DEMO_BUILD, again, 0, ENEMIES, CATALOG, 3).asset).toEqual({ name: 'Ore Train', hp: tougher.hp, maxHp: tougher.hp, sprite: 'asset-ore-train' });
    // The hangar is a battle with freight and no picture.
    const hangar = MISSIONS.find((mission) => mission.battles.some((battle) => battle.objective?.type === 'protect' && battle.objective.name === 'Hangar'))!;
    const inside = startMissionBattle(DEMO_BUILD, hangar, 0, ENEMIES, CATALOG, 3);
    expect(inside.asset).toEqual({ name: 'Hangar', hp: 12, maxHp: 12 });
  });
});
