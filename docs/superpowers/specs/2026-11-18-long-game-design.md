# The Long Game: design

> Let op: dit document verklapt een paar wendingen van een latere ronde.
> This document gives away a few turns of a later cycle.

## Why

The user has credits left and asked what to do with them. The weakest part of the game as it
stands is what happens after the first ending, and the round before this one made that part
matter: the third ending can only be reached in a later cycle.

Measured, with the automatic player that uses everything the game offers (wingmen, Overdrive,
repairs), on Standard:

- A pilot is fully grown after one cycle: level 20 (the cap, 19 of 23 perk ranks) and the best
  frame, which costs 28,100 credits in all.
- Money has no use after that. A career ends its first cycle with 141,000 credits to spare, its
  fourth with 502,000, its fifth with 678,000.
- Enemies gain a quarter of their strength (armour and damage both) with every cycle, without
  end. The fifth cycle's last contract is lost three times before it is won; the sixth cannot be
  won at all (42 tries). A plainer player (no wingman, no Overdrive) meets that wall in the fourth.
- A later cycle is the first one again but for three contracts, one conversation and the
  recorder's lines.

## Goals

- **The bench.** A pilot can spend credits to make the parts they own better, a step at a time.
  Money matters again, and a pilot keeps growing after the best frame is bought.
- **Later cycles that are fair.** What a later cycle fields grows no faster than a pilot can, and
  stops growing. Standard stays Standard however often the story is told.
- **The other offer.** In a later cycle three contracts of the first act can be flown for the
  other side: another briefing, another fight, other consequences. What was learned in the first
  cycle can be acted on where it was learned.
- **A picture for every find.** The page FOUND shows what a paper or a check looks like.

## Not goals

- No new parts, enemies, places or story contracts (the other offers reuse what there is).
- No change to a first cycle for a pilot who does not use the bench.
- No reputation system: what a pilot did to a client is told in letters and remembered at the end.

## What would make it a failure

- The bench as a chore: a pilot who has to grind to pay for it, or who cannot tell what a step did.
- The first cycle made easier for nothing: the bench must cost what the surplus of a cycle is worth.
- An other offer that is a free upgrade (the same contract with a better prize) or a trap that
  nothing warns of.
- A saved game that no longer loads.

## How it works

**The bench.** In the garage, on a part the pilot owns: R1 opens the bench for it. A step costs
its number times the part's price (the second step costs twice the price) and adds a twentieth:
armour to a frame part, damage to a weapon, output to a generator. Boosters, fire control, modules
and shields are not tuned. The work is on the model, not the copy: it stays when a part is sold
and bought again, and through the cycles. The bench goes two steps in a first cycle and one step
further with every cycle, to five. The garage shows a part's numbers as tuned; a tuned part
carries its step after its name ("+2"). A stock frame that is lent (the Gauntlet's, a loaner) is
as the factory made it. The mirror match's copy of the pilot's mech is tuned as the pilot's is.

**Later cycles.** The strength and the pay of a cycle grow as before up to the fourth cycle and
then stay: what the fourth cycle fields, every later cycle fields. The exact figures are set by
simulation against a pilot who has every perk and has used the bench as far as it goes in that
cycle: the automatic player wins each verdict on Standard at least six times in ten in every
cycle, and no contract of the story less than half the time.

**The other offer.** From the second cycle on, the briefing of three contracts has a second
entry, "The other offer": the other side's briefing, with its own pay. Accepting it flies another
fight under the same contract. Winning it finishes the contract (the story goes on as it would)
and is remembered as an answer to a question, like the story's other decisions:

| Contract | The other offer | From | What it changes |
|---|---|---|---|
| `hadron-1` Strikebreaker | Stand with the occupants of Seam Nine against Hadron's clearance crew; their tank fires for the pilot | Tamsin | The purchase order is found at once (what is under the tank's seat). Brenn writes |
| `hadron-2` Overburden | Hold the weighbridge while the train stands on the scale | Tamsin | The weigh ticket is found at once. Brenn writes |
| `undertow-1` Lights Out | Leave the relay dark, for Lumen's money, and see off those who come to light it | Varga | It pays three times as much. No rhyme is found, Tamsin writes, and she makes no third offer in this cycle |

The two papers no longer come to a later cycle for flying the contract alone: they come as in a
first cycle (the S, when the war is over) or by the other offer. The third offer is the
temptation: its letter says what it cost.

**Pictures.** Every find has a small picture on its page, above its text; one not found shows
none. Papers are made with the image budget at low quality (this round may spend up to one
dollar; 8.78 of the 14 remain). A check shows the number stamped on it: where a generated picture
cannot be trusted with a figure, the game draws the check itself.

## Approaches considered

1. **Higher levels and more perks.** Cheap, but it moves the wall one cycle and leaves money
   useless.
2. **Stop the scaling and nothing else.** Fair, but then nothing grows at all after the first
   cycle, and the surplus still has no use.
3. **Chosen: the bench, and scaling that stops where the bench does.** Growth has a price and an
   end, and both sides reach their ceiling in the same cycle.

For the later cycle's contracts: a second contract that stands in for the first was considered
and dropped (every condition that names the first would have to learn about the second). The
other offer is a decision inside the same contract, kept where the story's other decisions are.

## Constraints

- A saved game from before loads; it has no bench work and is none the worse for it.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the user's word.

## Left to the builder

The exact figures of a later cycle (by simulation), the words, where on the garage's panel a
part's step and its price are shown, the pictures' prompts and size.
