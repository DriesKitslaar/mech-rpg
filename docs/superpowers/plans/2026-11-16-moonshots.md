# IRONWAGE: moonshots

The owner's word (16 Nov): the model credits are back and may be used up; make it a truly wild
game, moonshots and all. Standing rules still hold: work alone, decide alone, test everything,
one independent review a phase on a snapshot, a draft PR a phase stacked on the one before, an APK
and a short note in Dutch a phase, merge only when the owner says so. Image spend stays under the
old limit (ledger ceiling $14, spent $3.78, low quality only): the owner raised the model budget,
not that one. Game text is English until phase M6.

## Status

Update as work lands. After a context reset, start here.

- [ ] M1: The Gauntlet (branch `feat/moon-gauntlet`, PR 18). Built and tested (rules in `src/core/gauntlet.ts`, screen in
      `src/ui/gauntletScreen.ts`). Its review is running (snapshot `scratchpad/reviewM1`). Pending: fixes, APK.
- [ ] M2: Ground and weather (branch `feat/moon-ground`, PR 19, on top of M1). Built and tested: seven places have a rule
      (`src/core/ground.ts`), said in the briefing, on the field and in the Gauntlet. Pending: review, APK.
- [ ] M3: New machines
- [ ] M4: Orders for the wingman
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
