# Tailored

## Why

The round before this one gave every build a name (one of seven classes), a count of what was won
as it, and a build of each class to put together. That makes a pilot want more than one build. The
game already keeps three saved builds. What it does not have is the moment where owning three is
worth it: a contract is taken in whatever happens to be on the floor, and changing it means going
back through the hub and the garage. In the games this one looks up to, the build is chosen at the
sortie, with the mission in front of you.

The standing brief is to keep working, on my own judgment, towards a game that plays like a
finished one; the user's last word was that variety in builds matters a great deal. This round is
the other half of that: the last one made the kinds, this one makes a pilot use them.

## Goals

1. **The build is chosen at the briefing.** A row of the briefing says what will be flown and lets
   the pilot turn through the saved builds; accepting the contract fits the one chosen.
2. **The briefing says how the contract is likely to go in the build chosen.** Not a table of
   advice by class: the odds for this pilot's own build, with everything about it counted.
3. **Work that asks for a class.** One open contract on the board asks for a class and pays more
   to a pilot who wins it as one.
4. An APK after every step. No battle changes: nothing here touches a rule of combat or the
   balance of any contract.

## Not goals

- No fourth saved build, and no editing of a build from the briefing: the garage is where builds
  are made.
- No promise in the odds: they are what the game's automatic pilot makes of the contract, which a
  careful pilot beats and a careless one does not reach. They say so.

## What would make it a failure

- A build fitted at the briefing that may not deploy, or a contract started in another build than
  the briefing showed.
- Odds that are not the odds of the fight that follows: counted without the pilot's perks, the
  bench's work, the difficulty set, the wingman hired or the Overdrive fitted.
- A briefing that stutters on the handheld while the odds are worked out.
- A briefing that no longer fits its panel, in either language.

## How it works

### The build row (M1)

Every briefing of a contract flown in the pilot's own machine has a row `Build`. Left, right or A
on it turns through what can be flown: the build on the floor first, then each saved build that
can be fitted and may deploy (every part still owned, not overweight, not short of energy, armed).
While the cursor is on the row the client makes way, as it does for a wingman, for what is being
considered: which build it is, its class and what that class is good at, its armour, mobility and
energy, and what it carries. The header says the class of the build chosen at all times, so that
it is in view while the client talks. Accepting fits the chosen build (the same as loading it in
the garage: it stays fitted afterwards) and starts the contract.

A briefing with nothing to turn to still has the row: it shows the build on the floor and says
that builds saved in the garage can be chosen here.

Not on a contract flown in a lent mech, a drill, or the Gauntlet: those are not flown in the
pilot's build.

### The odds (M2)

A first plan was a table: for each contract of the story, the classes that do best in it, measured
with each class's build for that stage. Measuring it showed why not. In twenty of the story's
twenty-eight contracts every class wins nine times in ten with its stage's build, so the table
says "anything" nearly everywhere; where it says more, what matters is which build falls behind
(a bastion wins one war contract one time in four), and a table by class says nothing about the
build a pilot actually owns.

So the briefing works the odds out for the build chosen. The contract is flown twenty times by the
game's own automatic pilot in that build, set up exactly as the fight that follows would be: the
pilot's perks, the bench's work, the difficulty, the Overdrive fitted, the wingman hired, the offer
that is showing; for a mirror match, against a mirror of that build. The wins are counted and
written in the header under the class (`ODDS 17/20`) and on the build's page. Turning to another
build, hiring or sending home a wingman, or turning to the other side's offer counts afresh; what
was counted before is kept for when the pilot turns back.

A whole flight is too much to work out between two frames: measured on the build machine one takes
eleven milliseconds on average and the longest nearly ninety, and the handheld is slower. So a
count is kept as it stands and moved on a few actions at a time, every frame, while the briefing
goes on writing itself out: eight steps a go, one go a frame, and where the time can be told as
many more goes (up to eight) as fit in four milliseconds. However it is sliced, the odds come out
the same. While it is counted the header shows the count as it rises, dim (`ODDS 9/11`); counted
out, the odds stand in their colour: good at fifteen of twenty or more, fair from eight, poor
under that.

The flights are always the same flights: the same build on the same contract gets the same odds
every time it is looked at. In the game's hurried mode (the tests', the career bot's) nothing is
counted.

Not on a contract flown in a lent mech or a drill, and not for a build that may not deploy.

The battle and the count are started from the same thing. The app says what a contract is fought
with (`App.fight`: the build, every enemy with the mirror of that build, the scale, the perks, the
bench's work, the Overdrive) and what accepting would start (`App.prospect`: the offer with whoever
was hired, in the build of the slot chosen); the battle is begun from the first and the odds are
counted from the second, which is made of the first.

### Work that asks for a class (M3)

Once the board has grown two stages (ten contracts won; at once in a later cycle), one of its three
open contracts asks for a class each time it is posted. Which contract and which class are drawn on
dice of their own, so that every board is otherwise exactly the board it always was (a test holds
1440 contracts to that). The swarm and the patrol never ask.

- **The list:** the contract's pay ends in a plus (`2900+`).
- **The briefing:** a line under the contract's tag, `WANTS A BASTION: +25% PAY`. It is a notice in
  amber while the build chosen is of another class, and stands in the colour of pay once a build
  of that class is turned to on the Build row. While it is a notice it points to the first saved
  build of that class, when the pilot has one that can be flown: `... (BUILD 1)`. With the odds
  beside it, the briefing then answers both questions: does it pay to switch, and can that build
  do it.
- **The settlement:** won in a build of that class, a quarter of the fee as it was paid (after a
  wingman's share and the pilot's pay perk; not of what the rank added) on a row of its own,
  `Bastion bonus +725`. Won as anything else, or lost, it pays what it says. With the rank's row
  and the class's row both there, a repair line makes way so that the bill still ends above the
  client's words.

It can always be flown in anything: asking is an offer, never a condition.

A duel, found on the way: its briefing says the other side asked for the pilot "and for nobody
else", yet a wingman could be hired for it. A duel now takes no wingman.

## Approaches considered

For choosing the build:

1. **A shortcut from the briefing to the garage and back.** Everything the garage can do, at the
   cost of leaving the briefing: the client's words are gone while the build is changed.
2. **A row that turns through the saved builds** (chosen). One press to change, the contract
   still in front of you, and it uses what the game already keeps.
3. **Choosing a class and letting the game fit its suggested build.** It would buy and sell on
   the pilot's behalf, which is nobody's idea of a briefing.

For what suits a contract, three ways were weighed: a rule of thumb from what the contract fields
(a swarm wants a salvo, a field wants one great shot), a table by class from measurement, and the
odds of the pilot's own build worked out on the spot (chosen). The first is wrong wherever a fight
is not what it looks like; the second was measured and says little (above); the third is the only
one that is about the build on the page, and it covers the board's contracts and the arena too.

## Constraints

- A kept game loads and is as it was.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the user's word.

## Left to the builder

Where the class stands in the header, the words on the build's page, how many flights make the
odds, what the asked class pays, and how the board chooses which contract asks.
