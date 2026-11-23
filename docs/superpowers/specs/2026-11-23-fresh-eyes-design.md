# Fresh Eyes: the whole game, played by somebody who has not seen it

Round after The Ledger. Stacked on `feat/ledger`.

## Intent, and why

Fifteen rounds have been built since the game was last looked at whole (Of One Piece): archetypes,
work that asks for a class, the range, the masters, the hangar, kinds of work, freight on the field,
the eighth seat, the launch, stripes, paint, the arsenal, the works, accounts, and their faces. Each
was tested and reviewed inside its own bounds. And that last whole look was itself cut short: of its
four testers only the one who laid the screens side by side handed anything in. The first hours, the
whole of it in Dutch, and the middle and the end have never been played by anybody with fresh eyes.

A game that is finished reads as one thing. Every one of those rounds added a rule, a room or a row.
Whether a new pilot can take them in the order the game hands them out, whether the Dutch of the
ninth round and of the twenty-ninth is one voice, whether the long game still has something to spend
on and something to do: nobody knows, because nobody has looked.

## Goals

1. **Four testers who have not seen the game play it**, each through one lens:
   - the first two hours, in English, from the first screen: what a new pilot is asked to
     understand and in what order, and where they would stall or guess;
   - all of it in Dutch: every text a player reads, read as a Dutch reader reads, and wherever the
     Dutch and the screen say different things;
   - the middle, the end and the long game: what opens when, what money does, what there is to do
     after the story, and where two systems speak against each other;
   - the screens side by side, from the pictures taken since the last whole look: one word for one
     thing, one place for one thing.
2. **Every finding is checked against the game before anything is changed** (a tester's mistake
   comes back in the same voice as a tester's find), then answered worst first: mended, with a test
   that holds the mend, or left as it is with the reason written down.
3. **What the testers say is good is kept on a list beside the findings**, and no mend takes away
   anything on it.

## Non-goals

- No new system, mode, room or rule.
- No rebalancing that is not the answer to a finding that was measured first; no balance test of
  the story changes otherwise.
- No new picture unless a finding cannot be answered without one (lowest quality; the ledger's
  ceiling stands).

## Anti-goals

- A round of notes: findings written down and nothing mended.
- Mending by talking. The first answer to "a player would not understand this" is to make the
  screen say it where the screen already says something, not a new line or a new panel for every
  finding.
- Testers who never get started, as last time. They are handed a kit that works before they begin,
  and they write their notes as they go, so that what they saw is kept wherever they are stopped.

## Approaches

1. **Testers in a real browser**, as last time. Closest to the handheld. Each needs a built copy, a
   port and a script for every look, and last time three of the four spent all the time they had on
   that.
2. **Testers drive the game itself through a kit that shows each screen as the words on it**
   (chosen). The `App` the tests drive; a function that prints the screen as rows of text where
   they stand; kept games at stages of two careers; and the four hundred kept pictures for what
   words cannot show. A look costs a second, so a tester's time goes into looking.
3. **One reader of the code.** Cheapest. Finds what the code shows, and not what a player meets in
   the order they meet it.

## How it works

- **The kit** is no part of the game and is kept out of the repository: a file that opens a game
  (new or kept), presses, lets time pass, and prints the screen, its menu and what the game tells a
  test of itself; kept games taken along two careers of the automatic pilot at some ten stages each
  (first contracts, the first act, the choice, the war, the audit, the ending, the long game, a
  second cycle); and a page that says how.
- **Each tester** gets the kit, its lens, the rules of the round (nothing in the repository is
  changed; nothing is run in a browser; notes go into a file of its own as it goes) and nothing of
  what was reasoned while the game was built.
- **A finding** says what, where (the screen, the state, how to get there), what a player would
  expect, and whether it was seen or is suspected. Findings worst first; then what is good and
  should not be touched; then three wishes.
- **Answering.** Each finding is checked against the game, the findings are grouped, and they are
  answered worst first. A mend is written test first. What is left as it is, is written into the
  plan with its reason.

## Constraints

- A kept game from before this round loads and stays valid.
- Every text that is changed or added has its Dutch, within the room its kind has.
- Nothing is merged without the owner's word.

## Left to the builder

- Which findings are mended and which are left, and in what order: the plan says, finding by
  finding.
- Whether a wish of a tester is worth a round of its own after this one.
