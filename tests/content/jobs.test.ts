import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import { generateBoard, scaleFor } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import { settle } from '../../src/core/economy';
import { HIT_MARK, JOB_KINDS, makeJob, type JobKind } from '../../src/core/jobs';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS, type Stage } from '../../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../../src/content/board';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { SIDE_WORK } from '../../src/content/sidework';
import { STRINGS } from '../../src/content/strings';
import { BRIEFING_CHARS } from '../../src/ui/briefingScreen';
import { wrap } from '../../src/ui/widgets';

/**
 * The board's jobs as the game has them: what they are called, what their briefings say, and how
 * they play for a build of every class (the numbers in src/core/jobs.ts were set by scripts/jobs.ts;
 * this holds them to what they were set for, on fewer flights).
 */

describe('the words', () => {
  const WORD: Record<JobKind, string> = { hit: 'Hit', repo: 'Repo', escort: 'Escort', hold: 'Hold' };

  test('a title begins with its kind, as a wanted notice begins with what it is, and fits the list', () => {
    for (const kind of JOB_KINDS) {
      const { titles } = BOARD_TEXT.jobs[kind];
      expect(titles, kind).toHaveLength(5);
      expect(new Set(titles).size).toBe(5);
      for (const title of titles) {
        expect(title.startsWith(`${WORD[kind]}: `), title).toBe(true);
        expect(title.length, title).toBeLessThanOrEqual(18);
        expect(title.length, title).toBeGreaterThan(WORD[kind].length + 5);
      }
    }
  });

  test('no other contract is called what a job is called', () => {
    const mine = JOB_KINDS.flatMap((kind) => BOARD_TEXT.jobs[kind].titles);
    expect(new Set(mine).size).toBe(mine.length);
    const others = [...MISSIONS, ...SIDE_WORK, ...DRILLS].map((mission) => mission.title).concat(BOARD_TEXT.swarmTitles);
    for (const title of mine) expect(others, title).not.toContain(title);
    // And nothing else begins as a job does.
    for (const title of others) for (const word of Object.values(WORD)) expect(title.startsWith(`${word}:`), title).toBe(false);
  });

  test('what each kind asks is said in three rows or fewer, and says it', () => {
    for (const kind of JOB_KINDS) expect(wrap(BOARD_TEXT.jobs[kind].brief, BRIEFING_CHARS).length, kind).toBeLessThanOrEqual(3);
    const { hit, repo, escort, hold } = BOARD_TEXT.jobs;
    // The mark a hit's machine carries, by the name the field gives it.
    expect(HIT_MARK).toBe('overclocked');
    expect(STRINGS.tags.marks[HIT_MARK]).toBe('OVERCLOCKED');
    expect(hit.brief).toContain('one machine');
    expect(hit.brief).toContain('overclocked');
    expect(hit.brief).toMatch(/When it falls the job is done\./);
    expect(repo.brief).toMatch(/one machine back in one piece/);
    expect(repo.brief).toMatch(/arms and legs/);
    expect(repo.brief).toMatch(/leave the core/);
    expect(repo.brief).toMatch(/Destroy it and nobody is paid\./);
    expect(escort.brief).toMatch(/freight/);
    expect(escort.brief).toMatch(/Every round, each machine left standing takes a piece of it\./);
    expect(hold.brief).toMatch(/Last the rounds/);
    expect(hold.brief).toMatch(/What you break is replaced\./);
  });

  test('the freight has a name for every place, short enough for the field', () => {
    expect(BOARD_TEXT.assets).toEqual(['Wage Truck', 'Ore Lift', 'Motorcade', 'Pump Barge']);
    expect(BOARD_TEXT.backgrounds).toEqual(['bg-neon-district', 'bg-mine', 'bg-plaza', 'bg-undercity']);
    for (const name of BOARD_TEXT.assets) expect(name.length, name).toBeLessThanOrEqual(12);
  });
});

describe('how they play', () => {
  const perks = (ranks: Record<string, number>): object => {
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
    return { aim, evasion, energy, cooling, repairs, armour };
  };
  /** The build and the pilot a tier is met with: the stages of the story, as the board grows through them. */
  const stageOf = (tier: number): Stage => (tier <= 2 ? 'early' : tier <= 5 ? 'war' : 'late');
  const pilotOf = (tier: number): object => (tier <= 2 ? {} : tier <= 5 ? perks({ marksman: 1, plating: 1 }) : perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }));
  const seedOf = (flight: number): number => (flight % 2 ? flight * 7919 : flight * 104729 + 13);
  interface Cell { wins: number; flown: number; rounds: number; net: number }
  const empty = (): Cell => ({ wins: 0, flown: 0, rounds: 0, net: 0 });
  function fly(mission: Mission, tier: number, difficulty: number, flown: Archetype, flights: number, cell: Cell): Cell {
    for (let flight = 1; flight <= flights; flight++) {
      const end = playMission(ARCHETYPE_BUILDS[flown][stageOf(tier)], mission, ALL_ENEMIES, CATALOG, seedOf(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
        { mods: pilotOf(tier), enemyScale: (mission.scale ?? 1) * difficulty });
      cell.flown += 1;
      cell.rounds += end.round;
      cell.net += settle(end, mission.reward, CATALOG).net;
      if (end.outcome === 'victory') cell.wins += 1;
    }
    return cell;
  }
  const JOBS = 4;
  const FLIGHTS = 3;
  /** Every class on every kind at a tier: four jobs of it, three flights each. */
  const flownAt = (tier: number, difficulty: number, kind: JobKind): Record<Archetype, Cell> =>
    Object.fromEntries(ARCHETYPES.map((flown) => {
      const cell = empty();
      for (let i = 0; i < JOBS; i++) fly({ id: 'open-0-0-job', ...makeJob(kind, tier, (i + 1) * 86028121 + tier * 7919, BOARD_TEXT) }, tier, difficulty, flown, FLIGHTS, cell);
      return [flown, cell];
    })) as Record<Archetype, Cell>;
  const rate = (cell: Cell): number => cell.wins / cell.flown;
  const TIERS = [2, 6, 8];
  const standard = new Map<string, Record<Archetype, Cell>>();
  // A thousand flights: a few seconds alone, more beside the rest of the suite.
  beforeAll(() => {
    for (const tier of TIERS) for (const kind of JOB_KINDS) standard.set(`${kind}-${tier}`, flownAt(tier, 1, kind));
  }, 120_000);
  const at = (kind: JobKind, tier: number): Record<Archetype, Cell> => standard.get(`${kind}-${tier}`)!;

  test('on Standard no class wins fewer than one in three of any kind, early, late or at the end', () => {
    for (const tier of TIERS) for (const kind of JOB_KINDS) for (const flown of ARCHETYPES) {
      expect(rate(at(kind, tier)[flown]), `${kind} at tier ${tier} as ${flown}`).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  test('the class flown matters: an escort is a duellist\'s and not a bastion\'s, a holding action the other way about', () => {
    // An escort is a race, and what kills fastest wins it.
    const escort = TIERS.map((tier) => at('escort', tier));
    const over = (cells: Record<Archetype, Cell>[], flown: Archetype): number => cells.reduce((sum, cell) => sum + cell[flown].wins, 0) / cells.reduce((sum, cell) => sum + cell[flown].flown, 0);
    expect(over(escort, 'duellist')).toBeGreaterThanOrEqual(0.9);
    expect(over(escort, 'duellist') - over(escort, 'bastion')).toBeGreaterThanOrEqual(0.2);
    expect(over(escort, 'duellist') - over(escort, 'lancer')).toBeGreaterThanOrEqual(0.15);
    // A holding action is outlasted, and what stands longest does that.
    const hold = [at('hold', 6)];
    expect(over(hold, 'bastion')).toBe(1);
    expect(over(hold, 'artillery')).toBe(1);
    expect(over(hold, 'bastion') - over(hold, 'duellist')).toBeGreaterThanOrEqual(0.3);
    expect(over(hold, 'bastion') - over(hold, 'skirmisher')).toBeGreaterThanOrEqual(0.2);
    // A hit is quickest for what hits hardest at once.
    const rounds = (flown: Archetype): number => TIERS.reduce((sum, tier) => sum + at('hit', tier)[flown].rounds, 0) / TIERS.reduce((sum, tier) => sum + at('hit', tier)[flown].flown, 0);
    expect(rounds('duellist')).toBeLessThan(4);
    expect(rounds('bastion')).toBeGreaterThan(rounds('duellist') * 1.5);
    // On two kinds at least, somewhere, the best class and the worst are thirty wins in a hundred apart.
    const apart = JOB_KINDS.filter((kind) => TIERS.some((tier) => {
      const rates = ARCHETYPES.map((flown) => rate(at(kind, tier)[flown]));
      return Math.max(...rates) - Math.min(...rates) >= 0.3;
    }));
    expect(apart.length).toBeGreaterThanOrEqual(2);
    expect(apart).toEqual(expect.arrayContaining(['escort', 'hold']));
  });

  test('on Veteran no kind is one that every class wins nine times in ten', { timeout: 60_000 }, () => {
    // Each where it bites: a hit and an escort in the war, a repossession early, a holding action late.
    const where: Record<JobKind, number> = { hit: 4, repo: 2, escort: 4, hold: 6 };
    for (const kind of JOB_KINDS) {
      const cells = flownAt(where[kind], 1.2, kind);
      const rates = ARCHETYPES.map((flown) => rate(cells[flown]));
      expect(Math.min(...rates), kind).toBeLessThan(0.9);
      // And none that nobody can do.
      expect(Math.max(...rates), kind).toBeGreaterThanOrEqual(0.9);
    }
  });

  test('a round of a job nets about what a round of the board\'s own contracts nets, over the classes and the stages together', { timeout: 60_000 }, () => {
    // The board's own, for the same pilots: its three contracts at a progress of each tier.
    const board = empty();
    for (const tier of TIERS) {
      for (const contract of generateBoard(tier * 5, 0, BOARD_TEXT)) for (const flown of ARCHETYPES) fly({ ...contract, scale: scaleFor(tier) }, tier, 1, flown, FLIGHTS, board);
    }
    const own = board.net / board.rounds;
    expect(own).toBeGreaterThan(150);
    for (const kind of JOB_KINDS) {
      const all = empty();
      for (const tier of TIERS) for (const flown of ARCHETYPES) { const cell = at(kind, tier)[flown]; all.net += cell.net; all.rounds += cell.rounds; }
      const ratio = all.net / all.rounds / own;
      expect(ratio, `${kind}: ${Math.round(all.net / all.rounds)} a round against ${Math.round(own)}`).toBeGreaterThanOrEqual(0.67);
      expect(ratio, `${kind}: ${Math.round(all.net / all.rounds)} a round against ${Math.round(own)}`).toBeLessThanOrEqual(1.5);
    }
  });
});
