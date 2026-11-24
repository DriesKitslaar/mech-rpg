# Stakes: terms a pilot can raise, and something to raise them for

Round after Fresh Eyes. Stacked on `feat/fresh-eyes`.

## Intent, and why

Three of the four testers of the last round said one thing from three sides, and it was left as this
round's subject. After the first act nothing on the contract board can be lost: every briefing reads
"ODDS 20/20", on Standard and on Veteran, in any telling. A defeat costs a few hundred credits. Money
piles up (84,000 at the end of the story, 130,000 after the duels) with nothing left to want. And the
one fight that does resist, the ladder's champion, reads 5/20 and says nothing of why.

It was measured before anything was designed (the game's own count of odds, at stages of three kept
careers):

- At the end of the story all sixteen rows of the list read 20/20; so do all fifteen ranks of the
  arena and nearly every master. On Veteran the same, give or take a master.
- The open board has a great deal of room. With every enemy half again as strong, most rows still read
  19 or 20. At twice as strong they spread from 0 to 20 by the row; at three times most are lost and
  a few stand. A pilot's best machine with the bench at its end (five steps where a first telling has
  two) moves a three-times row from 10 to 19.
- The champion is not a matter of numbers for every machine. For the first act's machine he reads 5/20
  as he is and 17/20 five percent weaker: a knife's edge. For the war's machine he reads 4/20 whatever
  is taken off him: a matter of the build, which the briefing's odds for each saved build already show.

So the game is not short of difficulty. It is short of a way to **ask for it and be paid for it**, of a
reason to be stronger than the story needs, and of a briefing that says how near a loss was.

A mech game's long game is the machine: a pilot who has built something strong wants a fight that
shows it, and wants the next step of it to be worth saving for. That is what this round is for.

## Goals

1. **Terms.** An open contract can be taken on harder terms for more pay: the opposition half again,
   twice or three times as strong, the fee half again, twice or three times as much, and a bond of
   what there is to gain, lost with the contract. The pilot chooses in the briefing, with the odds
   counted for the terms chosen.
2. **A loss on raised terms costs what was staked**, and cannot be walked away from: a contract left
   in the air is lost with its bond.
3. **A briefing says how near its lost flights were**: narrowly, clearly, or outmatched. For raised
   terms it says whether a little more machine would do; for the champion it is the gate saying what
   it wants.
4. **Something worth saving for.** The bench's third, fourth and fifth step, which so far only a new
   telling brought, can be licensed for credits in any telling: dear, permanent, and what the top
   terms ask for.
5. **Measured.** The eighteen careers come out the same to the credit for a pilot who never raises the
   terms; a pilot who raises them by the odds is measured beside them; the map of odds is drawn again
   after.

## Non-goals

- The story's contracts, side work, accounts, the arena, the Gauntlet and the drills keep the terms
  they have. Terms are for the open board: its three contracts, the job and the swarm.
- No change to what the difficulty setting does, to the board's own growth, or to any opponent's
  strength. The champion keeps his: the numbers were shown not to be the lever.
- No new picture, no new music.
- No new kind of enemy, weapon or part.

## Anti-goals

- **A board that gets harder because the pilot got stronger.** Buying a part must never be what makes
  the next contract worse. The pilot raises the terms; the game never does.
- **A bet nobody can read.** The odds stand on the page for the terms chosen before anything is
  accepted, and the bond is a figure, not a word.
- **A stake that is not one.** If closing the game in a losing fight saved the bond, there would be no
  bond.
- **Free money as the only outcome.** A strong machine may find the lower terms routine: that is what
  being strong is. The top terms must still be a bet for the best machine a first telling can build.

## Constraints

- One screen of 310 by 270; every text in English and Dutch under the rules both have (Dutch no more
  than two letters longer unless listed; hint lines in the one grammar; nothing over anything).
- A kept game from before the round opens as it is; what is added to a kept game is optional, held to
  what the reader accepts where it is written (`src/core/kept.ts`).
- The count of odds is the fight that follows: whatever the terms change, they change on the contract
  as it is flown, which the briefing's count and the battle are both started from, where a hired
  wingman already changes it.
- The bill adds up: balance is the old balance plus the net, but for medals, which it names.

## Approaches

1. **The board keeps pace by itself**: its tier follows the worth of the machine fitted or the pilot's
   level. No new row, no choice to explain. But it is the anti-goal: a better part makes the next
   contract harder, the pilot cannot say no, and it has to be right for every build of seven classes at
   once, which the measurements show no single number is (rows spread from 0 to 20 at the same scale).
2. **Terms the pilot raises, contract by contract** (chosen). One row in the briefing, three steps,
   one rule a line can say ("twice the opposition, twice the fee, and the fee again as a bond"). The
   odds the briefing already counts do the judging, per build and per step. It asks nothing of a pilot
   who wants none of it, and careers that never touch it are unchanged, which is checked.
3. **A harder board as a mode**: a switch in the options, or a second board of "hard contracts". A mode
   is all or nothing where the measurements say the right step differs by the row; a second board is a
   new list on a screen that has one.

For the sink: raising the prices of the last frames was weighed (the words of their makers promise
more than 6,000 for a core) and set aside: it moves the worth of every build that advises them, the
bench's cost on them, and the careers' purchases, for something that is still bought once. The bench's
further steps are already there, already priced by the step, and wanted by exactly the pilot who raises
the terms.

## What is decided

### Terms

- Four of them, by a number kept with the contract as it is flown: `0` Standard, `1` Hazard, `2`
  Severe, `3` Ruinous. Dutch: Standaard, Riskant, Zwaar, Ruïneus.

  | Terms | Opposition | Fee | Bond |
  |---|---|---|---|
  | Standard | as offered | as offered | none |
  | Hazard | x1.5 | x1.5 | half the fee |
  | Severe | x2 | x2 | the fee |
  | Ruinous | x3 | x3 | twice the fee |

- "Opposition" is the contract's own scale, multiplied: armour and damage both, as a later telling
  already multiplies it. And as in a later telling, what a contract asks to be protected grows sturdier
  by as much: freight loses armour by the head of enemy standing, and tougher enemies stand longer.
  (Measured for the story's-end machine on five escorts: with the freight as offered, three times the
  opposition reads 0/20 on all five, nearly every flight lost by the freight; with the freight grown,
  20, 15, 0, 0 and 5.)
- The fee is the fee as offered to this pilot: after a later telling's better pay, after a wingman's
  share. What a contract that asks for a class pays on top is a share of the fee as offered at Standard,
  as it is now; the two add.
- **Which contracts**: the open board's three, its job and its swarm. Not an account's notice, not a
  contract in a lent mech.
- **Who**: a pilot for whom the board is open (the introductions done). A level is offered only to a
  pilot who holds its bond: one that cannot be posted is shown, with what it asks, and cannot be chosen.
- **The bond** is not taken when the contract is accepted: it is written down as staked. Won, nothing
  of it is seen but the fee. Lost or retreated from, it is on the bill and off the balance. A game
  opened with a bond still staked was closed with the contract in the air: the bond is taken then, and
  said (as a run of the Gauntlet that was on a floor falls there).
- A win on raised terms is a contract won like any other: the board turns, the class wins, the rank is
  given as it is earned.
- The terms are chosen fresh in each briefing, and begin at Standard.

### In the briefing

- A row `Terms` under `Accept`, for a contract that takes them. LEFT/RIGHT (and A) turn through the
  four; on it the panel says the terms' name, what the opposition, the fee and the bond come to, and
  the odds. The header's PAYS and ODDS follow the terms chosen wherever the cursor is, and raised terms
  are named in the header in the colour of a warning, so that what A accepts is always in view.
- The odds are counted for the terms chosen (each kept once counted). **On raised terms Accept waits
  for them**: until the count for the terms showing is done, the row says that the odds are being
  counted and A does not take it. At Standard nothing changes. So that the wait is short: once the
  count showing is done, the briefing goes on to count the terms one step up; and a count that Accept
  is waiting for may work half a frame where others work a quarter. A device too slow for that is not
  held for ever: after eight seconds on the same terms A is taken, with the odds as far as counted on
  the page (dim, as an unfinished count is today).
- **How near the lost flights were**: where the odds are not good (fewer than three flights in four
  won), the line that says what the odds are ends in how the lost flights were lost instead: narrowly,
  clearly, or outmatched. It is measured by the game itself, not by a figure that stands in for it:
  once the odds are counted, every lost flight is flown again against a tenth less opposition, and the
  share of them that is then won decides the word (two thirds or more: narrowly; a third or more:
  clearly; fewer: outmatched). A tenth is about what the first two steps of the bench are worth. On
  every briefing with odds, not only raised ones.
  - Why not the armour the other side had left, as the advice after a defeat measures it: it was
    measured and reads wrong where it matters. The champion against the first act's machine, which
    five percent turns from 5/20 to 17/20, reads "clearly, a hair from outmatched" by armour left (a
    machine falls through its core and keeps its limbs); a contract of two battles reads nearer at
    three times the opposition than at twice, because the second battle is never reached. Flown
    again against a tenth less: the champion turns 14 of the first act's machine's 15 lost flights
    (narrowly) and 1 of the war's machine's 16 (outmatched); the two-battle contract turns 1 of 20 at
    twice and none at three times.

### On the bill, and kept

- Won: a row for the hazard pay, by the terms' name. Lost: a row for the bond, in the colour of a loss.
- Wins on raised terms are counted by the level (three small counts kept with the game), shown on the
  pilot's record, and three medals are for them: a first win on raised terms, a win on ruinous terms,
  and twenty-five wins on raised terms.

### The bench's licence

- The bench goes two steps, and one further for each new telling, to five: that stays. A step beyond
  where the telling has brought it can also be **licensed**: 50,000, 100,000 and 150,000 credits for
  the third, fourth and fifth. A licence is for the bench, not for a part: every part may then go that
  step, each at the step's own price as now.
- A licence is kept through every telling, and a new telling still brings its own step on top of it:
  nobody pays for a step and is then handed the same step. The furthest is five either way, and what a
  licence costs goes by the step it opens (in a second telling, where the bench goes three, the first
  licence opens the fourth and costs 100,000).
- In the garage, on the bench: a part at the bench's end says what the next step's licence costs, and
  the same button that takes a step buys it, after a question that rests on No.
- The prices are the design's first figures; the plan's measuring step may move them, with the reason.

### Words

- A chapter of the manual for terms and a line in the bench's chapter for the licence; the guide gets
  a section; the list's line for an open contract and the first open briefing are left as they are.

## Left to the builder

- The names of the three medals and their tiers; the exact words, within the rules for text.
- Where on the record page the count stands.
- Whether L1/R1 also turn the terms from any row of the briefing: only if the hint line has room and
  the browser tests show nobody presses it by accident.
- How the career bot decides to raise terms for the measurement (the design asks only that one bot
  never does and one does by the counted odds).
