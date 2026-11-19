import { ARCHETYPES, CLASS_AI } from '../../src/core/archetype';
import { settle, type Settlement } from '../../src/core/economy';
import { createBattle } from '../../src/core/battle';
import { newGame, type GameState } from '../../src/core/game';
import { MASTER_PURSE } from '../../src/core/masters';
import {
  SEAT_ID, SEAT_PURSE, isSeat, keeperEnemy, recordSeatWin, seatHeld, seatMission, seatOpen, seatPurse, seatSettlement, type Keeper,
} from '../../src/core/seat';
import { takesWingman } from '../../src/core/wingman';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { ENEMIES } from '../../src/content/enemies';

/** The eighth seat of the arena's masters, as the rules have it: who may come for it, what the duel is, and what winning it writes down. */

const game = (extra: Partial<GameState> = {}): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), ...extra });
const KEEPER: Keeper = {
  name: 'Keeper', paint: 'bone', scale: 0.9, plating: 0.5, style: 'Fights.', taunt: 'Come.', concede: 'Go.',
  build: { ...DEMO_BUILD },
  phases: [{ at: 0.5, ai: 'bruiser', line: 'Closer.' }],
};
const TEXT = { client: 'Arena Office', win: 'Won.' };

describe('who may come for it', () => {
  test('the pilot who holds the crown of every class, and nobody with fewer: six are not seven', () => {
    expect(seatOpen(game())).toBe(false);
    expect(seatOpen(game({ crowns: [...ARCHETYPES] }))).toBe(true);
    for (const missing of ARCHETYPES) expect(seatOpen(game({ crowns: ARCHETYPES.filter((kind) => kind !== missing) })), missing).toBe(false);
  });

  test('a crown counted twice, or one of a class nobody knows, is not a seventh', () => {
    const six = ARCHETYPES.slice(0, 6);
    expect(seatOpen(game({ crowns: [...six, six[0]] }))).toBe(false);
    expect(seatOpen(game({ crowns: [...six, 'paladin'] }))).toBe(false);
    expect(seatOpen(game({ crowns: [...six, six[0], 'paladin', six[1]] }))).toBe(false);
    // The seven, in whatever order and with whatever else is kept beside them.
    expect(seatOpen(game({ crowns: [...ARCHETYPES].reverse() }))).toBe(true);
    expect(seatOpen(game({ crowns: ['paladin', ...ARCHETYPES, ARCHETYPES[2]] }))).toBe(true);
  });

  test('it is the crowns that count: every master beaten in something else opens nothing, and the seat held closes nothing', () => {
    expect(seatOpen(game({ masters: [...ARCHETYPES] }))).toBe(false);
    expect(seatOpen(game({ masters: [...ARCHETYPES], crowns: [...ARCHETYPES], seat: true }))).toBe(true);
    // The ladder's rank is not asked again: whoever holds the crowns has been its champion.
    expect(seatOpen(game({ crowns: [...ARCHETYPES], arenaRank: 0 }))).toBe(true);
  });
});

describe('the duel', () => {
  test('is a contract of one battle in the arena against the keeper, with their words for a briefing and a purse larger than any master\'s', () => {
    const mission = seatMission(game(), KEEPER, TEXT);
    expect(mission).toEqual({
      id: 'arena-seat', phase: 'patrol', title: 'Keeper', client: 'Arena Office', briefing: ['Fights.', '"Come."'], debrief: 'Won.', reward: 15000,
      battles: [{ enemies: ['arena-seat'], background: 'bg-arena' }], scale: 0.9,
    });
    expect([SEAT_ID, SEAT_PURSE]).toEqual(['arena-seat', 15000]);
    expect(SEAT_PURSE).toBeGreaterThan(MASTER_PURSE);
    // No class is asked for, and no crown is named.
    expect(mission.crown).toBeUndefined();
    expect(mission.asks).toBeUndefined();
  });

  test('it pays in full until the seat is the pilot\'s, and a quarter after', () => {
    expect(seatPurse(game())).toBe(15000);
    expect(seatPurse(game({ seat: true }))).toBe(3750);
    expect(seatMission(game({ seat: true }), KEEPER, TEXT).reward).toBe(3750);
    // Something odd where the seat is kept is no seat, and pays as none.
    expect(seatPurse(game({ seat: 'yes' as unknown as true }))).toBe(15000);
  });

  test('it is known by its id, which begins as an arena fight\'s does: one against one, and nobody else\'s id is it', () => {
    expect(isSeat({ id: 'arena-seat' })).toBe(true);
    for (const id of ['arena-1', 'arena-master-duellist', 'arena-mirror', 'arena-seat-2', 'seat', 'cup-gold', '']) expect(isSeat({ id }), id).toBe(false);
    expect(takesWingman(seatMission(game(), KEEPER, TEXT))).toBe(false);
  });

  test('the keeper is fielded as their machine part for part, in their paint, flown as a marksman\'s until it changes, with the changes a boss goes through', () => {
    const enemy = keeperEnemy(KEEPER);
    expect(enemy).toEqual({
      id: 'arena-seat', name: 'Keeper', ai: CLASS_AI.marksman, sprite: 'enemy-rival', composed: true, build: KEEPER.build, paint: 'bone',
      phases: KEEPER.phases, plating: 0.5,
    });
    // A keeper with no more plate than the parts give is fielded with none said.
    const { plating: _plating, ...bare } = KEEPER;
    expect(keeperEnemy(bare)).not.toHaveProperty('plating');
    expect(keeperEnemy({ ...KEEPER, plating: 0 })).not.toHaveProperty('plating');
    // On the field it is a machine a fight is about: it has changes to go through, so the battle is no open one.
    const battle = createBattle(DEMO_BUILD, [enemy], CATALOG, 5);
    expect(battle.units[1]).toMatchObject({ id: 'enemy-0', kind: 'arena-seat', name: 'Keeper', phase: 0 });
    expect(battle.units[1].phases).toEqual(KEEPER.phases);
    expect(battle.open).toBe(false);
  });
});

describe('what winning it writes down', () => {
  test('the seat is the pilot\'s, once: a second win writes nothing', () => {
    const before = game({ crowns: [...ARCHETYPES] });
    const after = recordSeatWin(before);
    expect(after.seat).toBe(true);
    expect(seatHeld(after)).toBe(true);
    expect(before.seat).toBeUndefined();
    expect(recordSeatWin(after)).toBe(after);
    // Everything else is as it was.
    const { seat: _seat, ...rest } = after;
    expect(rest).toEqual(before);
    // Something odd in its place is written over with the plain yes.
    expect(recordSeatWin(game({ seat: 'yes' as unknown as true })).seat).toBe(true);
  });

  test('the bill says the seat changed hands when it did: a win of this duel by a pilot who did not hold it, and no other bill', () => {
    const battle = (outcome: 'victory' | 'defeat') => ({ ...createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 3), outcome });
    const won: Settlement = settle(battle('victory'), 15000, CATALOG);
    const lost: Settlement = settle(battle('defeat'), 15000, CATALOG);
    const mission = seatMission(game(), KEEPER, TEXT);
    expect(seatSettlement(won, mission, game())).toEqual({ ...won, seated: true });
    // Lost, or won by the seat's holder, or won on some other contract: the bill is the bill.
    expect(seatSettlement(lost, mission, game())).toBe(lost);
    expect(seatSettlement(won, mission, game({ seat: true }))).toBe(won);
    expect(seatSettlement(won, { id: 'arena-master-duellist' }, game())).toBe(won);
    expect(seatSettlement(won, { id: 'arena-10' }, game())).toBe(won);
  });
});
