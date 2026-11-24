import { arenaMission } from '../../src/core/arena';
import { generateBoard, swarmContract } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import { jobContract } from '../../src/core/jobs';
import { MAX_COUNT } from '../../src/core/kept';
import { STAKES, TOP_STAKE, bondFor, checkStake, forfeit, raisedAt, raisedWon, recordRaised, stakeSettlement, staked, takesStake } from '../../src/core/stakes';
import { ARENA } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/** The open board as it stands for a pilot at the end of a first story. */
const board = (): Mission[] => generateBoard(33, 0, BOARD_TEXT);
const row = (): Mission => board()[2];
/** A job of the kind that has something to protect: the first there is as the contracts won go up. */
const escort = (): Mission => {
  for (let won = 10; won < 80; won++) {
    const job = jobContract(won, 0, BOARD_TEXT);
    if (job?.job === 'escort') return job;
  }
  throw new Error('no escort on any board');
};
const fresh = (more: Partial<GameState> = {}): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), ...more });
const bill = (won: boolean, reward: number): Settlement => ({ won, reward: won ? reward : 0, ammoCost: 120, repairCost: 300, net: (won ? reward : 0) - 420, lines: [] });

describe('the terms an open contract can be taken on', () => {
  test('the four terms: what each multiplies and what each stakes', () => {
    expect(STAKES).toEqual([1, 1.5, 2, 3]);
    expect(TOP_STAKE).toBe(3);
    // The bond is what there is to gain: the fee times what the terms add to it.
    expect([1, 2, 3].map((level) => bondFor(4800, level))).toEqual([2400, 4800, 9600]);
    expect(bondFor(4801, 1)).toBe(2401);
    // Standard stakes nothing, and neither does a level there is none of.
    for (const level of [0, 4, -1, 1.5, Number.NaN]) expect(bondFor(4800, level), String(level)).toBe(0);
  });

  test('which contracts take them: the open board\'s three, its job and its swarm, and no other', () => {
    for (const mission of board()) expect(takesStake(mission), mission.id).toBe(true);
    expect(takesStake(jobContract(33, 0, BOARD_TEXT)!)).toBe(true);
    expect(takesStake(swarmContract(33, 0, BOARD_TEXT))).toBe(true);
    // An account's notice stands on the board and is no contract of the board's: it has its own terms.
    expect(takesStake({ ...row(), grudge: 1 })).toBe(false);
    // In a lent mech nothing is the pilot's to stake.
    expect(takesStake({ ...row(), loaner: STARTER_BUILD })).toBe(false);
    for (const mission of MISSIONS) expect(takesStake(mission), mission.id).toBe(false);
    expect(takesStake(arenaMission(fresh({ arenaRank: 3 }), ARENA[3], { client: 'Arena', win: 'Done.' }))).toBe(false);
  });

  test('a contract on raised terms is the same contract against more', () => {
    const offered = row();
    for (const level of [1, 2, 3]) {
      const flown = staked(offered, level);
      expect(flown.scale, String(level)).toBe(Math.round((offered.scale ?? 1) * STAKES[level] * 100) / 100);
      expect(flown.stake).toEqual({ level, amount: bondFor(offered.reward, level) });
      // The fee is the fee: what the terms add is paid beside it, and staked.
      expect(flown.reward).toBe(offered.reward);
      const { scale: _scale, stake: _stake, ...rest } = flown;
      const { scale: _was, ...same } = offered;
      expect(rest).toEqual(same);
    }
    // Standard is the contract as it was offered, and so is a level there is none of.
    for (const level of [0, 4, -1, 1.5]) expect(staked(offered, level), String(level)).toBe(offered);
    // A contract that takes no terms is flown as it is, whatever is asked.
    const story = MISSIONS.find((mission) => mission.id === 'intro-2')!;
    expect(staked(story, 2)).toBe(story);
    const notice = { ...offered, grudge: 1 };
    expect(staked(notice, 3)).toBe(notice);
  });

  test('what it asks to be protected grows as the opposition does', () => {
    const job = escort();
    const guarded = job.battles.filter((battle) => battle.objective?.type === 'protect');
    expect(guarded.length).toBeGreaterThan(0);
    for (const level of [1, 2, 3]) {
      const flown = staked(job, level);
      flown.battles.forEach((battle, i) => {
        const was = job.battles[i];
        if (was.objective?.type === 'protect') {
          expect(battle.objective).toEqual({ ...was.objective, hp: Math.ceil(was.objective.hp * STAKES[level]) });
          expect({ ...battle, objective: was.objective }).toEqual(was);
        } else expect(battle).toBe(was);
      });
    }
    // Any other thing asked is asked as it was: rounds to hold are rounds, and a machine wanted whole is the same machine.
    const hold = { ...row(), battles: [{ ...row().battles[0], objective: { type: 'survive' as const, rounds: 6 } }] };
    expect(staked(hold, 3).battles).toEqual(hold.battles);
  });

  test('who may raise them: a pilot who holds the bond', () => {
    const offered = row();
    const bond = bondFor(offered.reward, 2);
    expect(checkStake({ credits: bond }, offered, 2)).toBeNull();
    expect(checkStake({ credits: bond - 1 }, offered, 2)).toBe('bond');
    expect(checkStake({ credits: 10_000_000 }, offered, 3)).toBeNull();
    // Standard asks nothing, of a pilot in debt as of any other.
    expect(checkStake({ credits: -300 }, offered, 0)).toBeNull();
    // What is not a level is not offered; and a contract that takes none offers none above Standard.
    for (const level of [4, -1, 1.5]) expect(checkStake({ credits: 10_000_000 }, offered, level), String(level)).toBe('none');
    const story = MISSIONS.find((mission) => mission.id === 'intro-2')!;
    expect(checkStake({ credits: 10_000_000 }, story, 2)).toBe('none');
    expect(checkStake({ credits: 10_000_000 }, story, 0)).toBeNull();
  });

  test('the bill of it: won, the hazard pay beside the fee; lost, the bond', () => {
    const flown = staked({ ...row(), reward: 4800 }, 2);
    const won = stakeSettlement(bill(true, 4800), flown);
    expect(won).toEqual({ ...bill(true, 4800), hazard: { level: 2, pay: 4800 }, net: bill(true, 4800).net + 4800 });
    const lost = stakeSettlement(bill(false, 4800), flown);
    expect(lost).toEqual({ ...bill(false, 4800), bond: { level: 2, lost: 4800 }, net: bill(false, 4800).net - 4800 });
    // A contract on Standard terms is billed as it always was.
    const plain = bill(true, 4800);
    const standard: Mission = { ...row(), reward: 4800 };
    expect(stakeSettlement(plain, standard)).toBe(plain);
    expect(stakeSettlement(plain, {})).toBe(plain);
  });

  test('what is kept of it: wins on raised terms, by the terms', () => {
    const none: Pick<GameState, 'raised'> = {};
    expect(recordRaised(none, 2).raised).toEqual([0, 1, 0]);
    expect(recordRaised(recordRaised(none, 2), 2).raised).toEqual([0, 2, 0]);
    expect(recordRaised({ raised: [3, 1, 0] }, 3).raised).toEqual([3, 1, 1]);
    // Standard is no raised win, and neither is a level there is none of.
    const kept = { raised: [3, 1, 0] };
    for (const level of [0, 4, -1, 1.5]) expect(recordRaised(kept, level), String(level)).toBe(kept);
    // A count stays at the most a count may say.
    expect(recordRaised({ raised: [MAX_COUNT, 0, 0] }, 1).raised).toEqual([MAX_COUNT, 0, 0]);
    expect(raisedWon({ raised: [3, 1, 2] })).toBe(6);
    expect([1, 2, 3, 0, 4].map((level) => raisedAt({ raised: [3, 1, 2] }, level))).toEqual([3, 1, 2, 0, 0]);
    expect(raisedWon({})).toBe(0);
    // What a kept game says of it is read with care: anything but three whole counts reads as none.
    for (const odd of [[1, 2], [1, 2, 3, 4], [1, -1, 0], [1, 1.5, 0], '3', null, {}]) {
      const game = { raised: odd as unknown as number[] };
      expect(raisedWon(game), JSON.stringify(odd)).toBe(0);
      expect(recordRaised(game, 1).raised).toEqual([1, 0, 0]);
    }
  });

  test('a bond left in the air is taken', () => {
    const { game, lost } = forfeit({ credits: 9000, atStake: 4800 });
    expect(game).toEqual({ credits: 4200 });
    expect(Object.hasOwn(game, 'atStake')).toBe(false);
    expect(lost).toBe(4800);
    // With nothing staked nothing is taken, and the game is the game handed in.
    const plain = { credits: 9000 };
    expect(forfeit(plain)).toEqual({ game: plain, lost: 0 });
    expect(forfeit(plain).game).toBe(plain);
    // What is staked is read with care too: only a whole amount above nothing is one.
    for (const odd of [0, -1, 1.5, '4800', null, MAX_COUNT + 1]) {
      const kept = { credits: 9000, atStake: odd as unknown as number };
      expect(forfeit(kept).lost, String(odd)).toBe(0);
      expect(forfeit(kept).game.credits).toBe(9000);
      expect(Object.hasOwn(forfeit(kept).game, 'atStake')).toBe(false);
    }
  });

  test('a kept game is read with care', () => {
    const game = JSON.parse(JSON.stringify(fresh({ atStake: 4800, raised: [3, 1, 0] })));
    expect(isValidState(game, CATALOG)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(fresh())), CATALOG)).toBe(true);
    for (const atStake of [0, -1, 1.5, '4800', null, MAX_COUNT + 1, [4800]]) expect(isValidState({ ...game, atStake }, CATALOG), `atStake ${JSON.stringify(atStake)}`).toBe(false);
    for (const raised of [[1, 2], [1, 2, 3, 4], [1, -1, 0], [1, 1.5, 0], '3', null, {}, [1, 2, MAX_COUNT + 1]]) expect(isValidState({ ...game, raised }, CATALOG), `raised ${JSON.stringify(raised)}`).toBe(false);
    // What the rules write is what the reader takes: at the limit as anywhere.
    const most = recordRaised({ ...fresh(), raised: [MAX_COUNT, MAX_COUNT, MAX_COUNT] }, 3);
    expect(isValidState(JSON.parse(JSON.stringify(most)), CATALOG)).toBe(true);
  });
});
