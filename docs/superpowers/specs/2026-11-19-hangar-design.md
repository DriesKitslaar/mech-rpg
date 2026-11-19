# The Hangar

## Why

There are seven classes of machine, and since the last round a crown to take as each. A pilot
keeps three saved builds. To go after a fourth crown they have to take a build apart that they
still want, and put it together again afterwards from memory. The build row at the briefing, the
odds, the range and sparring all work from saved builds: three places is the narrowest point of
everything the last four rounds built.

The standing brief is to keep working, on my own judgment, towards a game that plays like a
finished one; the user's word on what matters was variety in builds.

## Goals

1. **Seven places for a saved build** where there were three: room for one of each class. They
   are not tied to classes; a pilot may keep seven duellists.
2. **A saved build goes by its class.** The garage lists each place with what kind of machine is
   kept there, where it named the build after its core.
3. A game kept with three places loads as it was, with four more places empty.
4. An APK after every step. No rule of combat changes.

## Not goals

- No names typed in for builds: the handheld has no keyboard, and a class says more than a core.
- No change to what a saved build is, to loading one, or to what the garage refuses.

## What would make it a failure

- A kept game that does not load, or loads with a saved build gone or in another place.
- A list in the garage, a line in the briefing or a row on the range that does not fit with seven
  builds saved, in either language.
- A place past the third that can be saved to and not flown from, or sparred with, or the other
  way round.

## How it works

`LOADOUT_SLOTS` is seven. Everything that turns through saved builds already takes its number
from the list: the build row at the briefing, the odds beside it, the range's sparring partners.
The range knew a sparring partner's place by a figure from 0 to 2; it now knows as many as there
are places.

The garage's list of saved builds has seven rows. A row is the place's number, the class of the
build kept there, and the frame its core is from: `2  Bastion    Colossus`. An empty place says
so, as before.

A kept game may hold a shorter list (three places, from before this round). It is valid, and the
places it does not name are empty; it is brought to full length when it is loaded, so that the
game in hand has one shape. Saving into any place writes the full list.

## Approaches considered

For how many: five (does not hold one of each class, which is the reason for more), one place a
class and tied to it (a build that changes class when a weapon is swapped would have to move, and
a pilot with two bastions has nowhere for the second), or seven free places (chosen).

For the kept game: a new save version with a step that pads the list (the pattern the storage
has, but it turns away a game from a newer version on an older build, and nothing else about the
game's shape changes), or the same version with a shorter list read as places that are empty
(chosen): older and newer builds of the game read each other's games as far as they can.

For what a row says: the core, as it was (seven rows of `Colossus Core` and `Ronin Core` say
little), the weapons (too long for the row), or the class and the frame (chosen).

## Constraints

- A kept game loads and is as it was.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the user's word.

## Left to the builder

Where things stand in the row, and the words of the manual and the guide.
