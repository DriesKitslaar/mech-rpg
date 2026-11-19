# Of One Piece

## Why

The game was built in ten rounds, a few screens and a few rules at a time. Each round was tested
and reviewed inside its own bounds. Nobody has played the whole of it from the first screen with
fresh eyes since, and the last round (Heavy Metal) changed the rules of the very first fight of the
game without the game saying so: the first banner a new pilot ever sees reads MOMENTUM, and nothing
in play says what that is. The manual does, and the guide does; a player on a handheld reads
neither before the first fight.

A game that is finished reads as one thing: what it teaches is what it does, nothing on a screen
runs into something else, and the middle and the end hold up as well as the first hour. This round
is for that.

## Goals

1. The rules of Heavy Metal are taught by play: said once, where they first happen, and practised
   in the simulator.
2. The whole game is played through by four testers who have not seen it: the first hours in
   English, all of it in Dutch, the middle, the end and the long game, and every screen laid side
   by side. What they find is checked against the game and answered: mended, with a test, or left
   as it is with the reason written down here.
3. An APK after every step. The fights that are hard stay as hard: no balance test of the story
   changes unless a finding is about balance and is measured first.

## Not goals

- No new system and no new mode.
- No new picture unless a finding cannot be answered without one (low quality only; the ledger's
  ceiling stands).
- No rebalancing that is not the answer to a finding.

## What would make it a failure

- Teaching that talks over the game: more than one line for one moment, a line said twice, a line
  said in a fight where it is not true, or anything that holds a turn up.
- A drill that is passed without what it teaches, or failed more than rarely by a pilot who does
  what it teaches.
- Mending a finding by taking away something players like. The testers are asked what is good and
  should not be touched, and that list is kept beside the findings.

## How it works

### Said once, where it happens

Two things in Heavy Metal are not plain from the screen alone: why a weapon is ready again after a
kill and where that holds (the word on the banner), and why the last machine standing suddenly
leaves. Each gets one line from Dispatch, the first time it happens to this pilot:

- **momentum**: the first time a kill gives a weapon back. Said as the menu is handed back, before
  the bar says which weapon is ready again.
- **rout**: the first time a machine loses its nerve (SHAKEN). Said as the menu is next handed
  back, so the pilot knows what the word over that machine means before it leaves.

A line is said once for a kept game (`GameState.lessons`), and is saved the moment it is said, so
closing the game in the middle of that fight does not bring it back. It is said in contracts only:
the simulator and the Gauntlet have voices of their own. A game kept from before this round has
heard neither, and hears each at its next occasion. For a new pilot the first is said in the first
fight of the game, after the first drone falls, which is where the rifle is ready again.

The other words explain themselves and get no line: CHAIN x2 is a count, OVERKILL changes nothing,
DESTROYS on the aiming line is a promise the next shot keeps, and a swarm is explained by its
briefing and the strip that counts what is still to come.

### Practised in the simulator

Two drills join the eleven. A drill is never an open battle (so that a lent weapon cannot win it in
place of the lesson); these two say of themselves that they are open, because that is their lesson.

- **Follow Through** (momentum and rout). One Rail Lance, an enforcer the lance cannot hurt, and
  two drones the lance destroys in one blow. Destroy both drones in one turn, with the one weapon,
  and the enforcer leaves. Measured over 60 battles: a pilot who does that passes 58 times and is
  done in the first round; without the rules it cannot be passed at all; a pilot who shoots at the
  enforcer passes 15 times.
- **The Nest** (a swarm). A full Ronin with a lance and a salvo, against three light machines on
  the field and five more to come. It is there to be enjoyed: every pilot can feel, from the second
  contract on, what a strong frame does to a field of light machines. Measured over 60 battles:
  always passed, in about four rounds.

Thirteen rows fit the list as it is drawn. The medal for passing every drill counts thirteen; a
pilot who has it keeps it.

### The testers

Four testers play a built copy of the game in a real browser, each with a port and a folder of
their own, from first starts and from kept games taken along two careers of the automatic pilot
(first act, the choice, the war, the audit, the ending, second and third cycle). Each hands in
findings with the picture that shows them, worst first, a list of what is good, and three wishes.
Findings are checked against the game before anything is changed (a tester's mistake comes back in
the same voice as a tester's find), grouped, and answered worst first.

## Approaches considered (for the teaching)

1. **Lines written into the first contracts** (the first kill of the first contract, the first
   three-drone fight of each client). Cheapest. It misses every kept game that is past those
   contracts, and says its line whether or not the thing has just happened.
2. **A line for the moment, once for a kept game** (chosen). Said when the thing happens, whichever
   contract that is in, in the voice the game already uses for everything it says in a fight.
3. **A panel that explains the rule** over the field. The game has no such panel anywhere; a new
   kind of window for two rules is more than they need, and it would hold the turn up.

## Constraints

- A kept game from before this round loads and stays valid.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the user's word.

## What the testers found, and what it changed

(Written as the findings are answered.)

## Left to the builder

The exact words, the lent builds and the scale of the two drills, and the order in which findings
are answered, are settled in the plan as each part is built, with what was measured.
