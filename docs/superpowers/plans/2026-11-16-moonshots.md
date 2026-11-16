# IRONWAGE: moonshots

The owner's word (16 Nov): the model credits are back and may be used up; make it a truly wild
game, moonshots and all. Standing rules still hold: work alone, decide alone, test everything,
one independent review a phase on a snapshot, a draft PR a phase stacked on the one before, an APK
and a short note in Dutch a phase, merge only when the owner says so. Image spend stays under the
old limit (ledger ceiling $14, spent $3.78, low quality only): the owner raised the model budget,
not that one. Game text is English until phase M6.

## Status

Update as work lands. After a context reset, start here.

- [x] M1: The Gauntlet (branch `feat/moon-gauntlet`, PR 18). Built, reviewed, fixed. APK sent with M2 and M3.
- [ ] M2: Ground and weather (branch `feat/moon-ground`, PR 19, on top of M1). Built and tested: seven places have a rule
      (`src/core/ground.ts`), said in the briefing, on the field and in the Gauntlet. Review of M2 and M3 together is running (snapshot `scratchpad/reviewM23`); APK sent.
- [ ] M3: New machines (branch `feat/moon-machines`, PR 20, on top of M2). Built and tested: six machines for the open
      contracts and the Gauntlet, two great machines (Scrap King, Night Train), four Guild jobs. Review of M2 and M3 together is running (snapshot `scratchpad/reviewM23`); APK sent.
- [ ] M4: Orders for the wingman (branch `feat/moon-orders`, PR 21, on top of M3). Built and tested. Pending: review, APK.
- [ ] M5: Cups
- [ ] M6: Dutch
- [ ] M7: Last review, APK, summary

## M1: The Gauntlet

A second way to play, beside the story: a run of battles that goes on until the pilot falls.

1. From the hub once the introductions are done. A run starts in a stock frame, not the pilot's
   own: everybody starts level, and nothing in the garage is at risk.
2. Each floor is one battle, harder than the last; every fifth is a named pilot or a great machine.
   Damage carries; a little is patched between floors.
3. After each floor: a draft. Three things on offer, one taken: a part fitted at once, a field
   repair, a boon for the run (more energy, cooler guns, a wingman for three floors).
4. The run is kept in the save, so it survives closing the game. Leaving ends it.
5. The record: best floor, and credits paid out at the end by how far the run got. Medals for
   floors 5, 10, 20.
6. Everything from one seed, so a run can be replayed in tests.

## M2: Ground and weather

Each background gets one rule that holds for both sides, said in the briefing and on the field:
rain cools, the foundry heats, sand spoils aim, the sluice slows boosts, the vault dampens blasts,
the rooftop wind bends bullets. The balance is re-measured with the simulator and the career
tests, and the numbers are kept small enough that the measured limits hold or are re-measured
and said.

## M3: New machines

Six new enemies and two great machines with pictures of their own, two new places. They go into
the Gauntlet, the open contracts and four new side contracts. Each gets a database page.

## M4: Orders for the wingman

Three orders, set at the start of a battle and changeable on the pilot's turn: strike the
strongest, strike my target, cover me (their fire becomes a share of damage taken off the pilot).

## M5: Cups

The arena gets three cups: three fights back to back with damage carried, a prize part each, and
a place in the record.

## M6: Dutch

Dutch as a language for all game text, chosen in the options. Text goes through one lookup; the
content files are translated side by side with the English and every fit test runs in both.

## M7: The end

A last independent review of the whole, an APK, a summary for the owner in Dutch.

## Changes made while building

M1:

- A floor has no briefing and no settlement of its own: the Gauntlet's room shows what is expected
  and the way down, and a floor won leads straight back to it and to what is on offer.
- The wingman boon was left out: a run's frame is lent, and nobody is hired into a lent mech.
- Measured with a pilot that only presses Auto Turn and takes the dearest part: of sixty runs the
  median clears 7 floors, the best 12, the worst 2. Beating a warden earns a full service, or the
  floor after the first warden was a wall.
- A game closed in the middle of a floor finds the run on that floor again: closing is not falling.

M2:

- Seven rules: rain and furnace heat (cooling up or down 4), dust (aim down 5), flood water (a
  boost dodges 6 less), a sealed vault (blasts 15% down), crosswind (bullets down 6), clear air
  (beams up 4). The undercity, the clearing house, the hangar, the arena and the simulator are
  level ground.
- Furnace heat lowers cooling instead of raising the heat of each shot, so that what the enemy and
  the Auto Turn count on when they decide to fire stays true.
- The measured limits of the career tests and the difficulty of every contract held with the
  rules in; one briefing (Line Noise) lost a few words to make room for its ground line.

M3:

- Eight pictures at low quality: ledger at $3.93 of $14.
- No new places: there were ten already, and seven now have a rule of their own.
- The six smaller machines join the open contracts' pool; the two great ones are wardens of the
  Gauntlet (floors 10 and 20) and the last two of four jobs for the Night Market Guild, a second
  series of side work beside the bounties.

M1, after its review:

- A run starts with an arc pistol in the other hand, which needs no ammunition; field repairs are
  restocked every floor; a game closed on a floor finds the run fallen there (`Run.fighting`);
  parts stay on offer at any depth and a hand weapon goes to the empty hand; wear counts plating;
  the best and its medals count as floors are cleared; what is fought down there is met; the floor
  ahead is shown while choosing. The Gauntlet's own machines are its first two wardens, so nobody
  from the story is met before floor 15.
- Left as it is: boons add up without limit, so a very good run has no hard wall.

M4:

- Three orders (`Support.order`): strongest (as before), my target (the enemy the pilot fired at
  last, `BattleState.focus`), cover (no shot; every shot at the pilot does less by a share that
  grows with the wingman's damage, at most three in ten). Only a hired wingman takes them. The row
  in the battle menu says what they are doing; choosing it gives the next order, for nothing.
