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
2. **The briefing says what suits the contract.** For the contracts of the story, which classes
   do best in it, by measurement, and whether the build chosen is one of them.
3. **Work that asks for a class.** One open contract on the board asks for a class and pays more
   to a pilot who wins it as one.
4. An APK after every step. No battle changes: nothing here touches a rule of combat or the
   balance of any contract.

## Not goals

- No fourth saved build, and no editing of a build from the briefing: the garage is where builds
  are made.
- No hint for contracts the board rolls or for the arena: only fixed contracts are measured.
- No penalty for flying a class that does not suit. It is advice.

## What would make it a failure

- A build fitted at the briefing that may not deploy, or a contract started in another build than
  the briefing showed.
- Advice that is wrong: a class named as suiting a contract it loses.
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

### What suits (M2)

For each contract of the story, the seven classes' builds for that stage of the story are flown
through it by the game's own automatic pilot, and the classes that do best are written down in a
table (`src/content/suits.ts`). A class suits when it is within a few points of the best and wins
more often than not; at most three are named, best first. The build row's page says which classes
suit the contract and whether the build chosen is one; the class in the header is lit when it is.
A test flies the same fights with fewer battles and holds the table to it: no class named may be
far behind the best, and the best measured may not be missing.

### Work that asks for a class (M3)

Each time the board is posted, one of its open contracts asks for a class, drawn with the board's
own dice. Its row and its briefing say so. Won in a build of that class it pays a quarter more;
won as anything else it pays what it says. The swarm and the patrol never ask.

## Approaches considered

For choosing the build:

1. **A shortcut from the briefing to the garage and back.** Everything the garage can do, at the
   cost of leaving the briefing: the client's words are gone while the build is changed.
2. **A row that turns through the saved builds** (chosen). One press to change, the contract
   still in front of you, and it uses what the game already keeps.
3. **Choosing a class and letting the game fit its suggested build.** It would buy and sell on
   the pilot's behalf, which is nobody's idea of a briefing.

For the advice: a rule of thumb from what the contract fields (a swarm wants a salvo, a field
wants one great shot) was set against measuring. Measuring is what the project is set up to do,
and a rule of thumb would be wrong wherever the fights are not what they look like.

## Constraints

- A kept game loads and is as it was.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the user's word.

## Left to the builder

Where the class stands in the header, the words on the build's page, how many points count as
"within a few", what the asked class pays, and how the board chooses which contract asks.
