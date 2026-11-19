# Archetypes

## Why

The user asked for it in so many words: build variety matters a great deal, archetypes, perhaps a
choice between three starter builds in the story, and new machines for the end of the game in the
spirit of the sleek white high-speed knight and the light fast duellist of the games he loves.

The game has the parts for many ways of building a mech (five kinds of legs, blades, shields,
charge weapons, salvos, modules), and three of its reference builds are already different kinds of
machine. What it lacks is the beginning and the end of that: every pilot starts in the same frame,
and the two frames at the top are a fortress and a corporate all-rounder. And nothing in the game
says what kind of machine a build is, or gives a pilot a reason to try another kind.

## Goals

1. **Three ways to start.** A new pilot chooses one of three salvage frames: an all-rounder, a
   light one that dodges, a heavy one that guards. Each wins the introductions as it comes, and
   with what the introductions pay for wins the first contracts of all three clients.
2. **Two frames for the end of the game**, each with something no other frame has: a white knight
   that is quick and carries a field, and a duellist built around the blade. Original designs with
   their own names: nothing of an existing game's machine is copied, not its name, not its look.
3. **Archetypes the game knows.** The garage says what kind of machine a build is, the pilot's
   record keeps what was won as each kind, and every kind is shown by measurement to be able to
   finish the story.
4. An APK after every step. The hard fights stay as hard: a new frame is measured against the
   verdicts and the third audit contract before it is priced.

## Not goals

- No change to the frame every kept game already flies, or to any existing part.
- No new rule for a whole class of builds until it has been measured (see "Edges" below): the
  first aim is that every kind of build is viable and known by name.
- No picture at more than low quality; the ledger's ceiling stands (about 8 dollars of it are
  left; a frame costs about 0.24).

## What would make it a failure

- A starter that is plainly the best, or one that cannot get through the first act.
- An end-game frame that makes a verdict or a finale a formality.
- A frame that looks like, or is named after, a machine from an existing game.
- Archetype names that flicker: a build that changes its name when a part of no consequence is
  swapped.

## How it works

### Three starters (B1)

After the callsign, before the first page of the story, the pilot is shown three frames on the
lot and takes one. Each is a full set of four salvage parts (300 credits each, always in stock, so
the two not taken can be bought and mixed from the first minute), with the stock generator,
thrusters and fire control. The story is unchanged: it speaks of "your frame", never of which.

| | Hauler (as it was) | Courier (new) | Dozer (new) |
| --- | --- | --- | --- |
| Whose salvage | Undertow dock frame | Lumen courier | Hadron yard dozer |
| Armour, all parts | 540 | 375 | 680 |
| Carries | 1000 | 800 | 1400 |
| Mobility of the legs | 30 | 40 | 18 |
| Aim (head, arms) | 10, 5 | 10, 6 | 8, 5 |
| Starts with | Rivet Rifle (kinetic) | Arc Pistol (energy) | Rivet Rifle, Scrap Plate |
| Credits in hand | 1200 | 900 | 900 |

The Scrap Plate is a new salvage shield (lets half of a hit through while guarding, where no
shield lets 0.6 through and the Riot Shield 0.4). Guns and credits come to 1500 for each.

Measured over 120 battles a contract with the game's own automatic pilot:

| | Patrol | Intro 1 | Intro 2 | Hadron 1 | Lumen 1 | Undertow 1 |
| --- | --- | --- | --- | --- | --- | --- |
| Hauler as it comes | 100 | 100 | 100 | 98 | 55 | 35 |
| Courier as it comes | 100 | 100 | 100 | 100 | 94 | 35 |
| Dozer as it comes | 100 | 100 | 100 | 100 | 43 | 44 |
| Hauler, two more guns | 100 | 100 | 100 | 100 | 98 | 97 |
| Courier, a rifle beside the pistol | 100 | 100 | 100 | 100 | 100 | 90 |
| Dozer, a pistol and a mortar | 100 | 100 | 100 | 100 | 100 | 99 |

Each has a contract it likes (the Courier shrugs at Lumen's own guards, the Dozer at Hadron's
yard), none likes all three, and with the first purchases all three are through the first act.

The screen is the garage's, turned to this use: the frame under the cursor stands where a mech
stands in the garage, the three frames are listed where the garage has its panel, with the
figures of the one under the cursor, and under them what it is in three lines. A takes it, B
goes back to the name. A game that is kept is not asked: it has its frame.

What building it turned up:

- The frame is not turned round to face the list, as the simulator turns its mech: the Dozer's
  plate has a number painted on it, and turned round it read backwards.
- From behind the Dozer's arms hang lower than the pose every frame shares (a squat frame carries
  its shoulders low), so what it held hung in the air over its hands. Drawn again with the fist
  raised the arm lost its shoulder, twice. So an arm may now say where its own fist was drawn
  (`fx`/`fy` in the manifest, from `FISTS` in `scripts/art/process.ts`), and what it holds is held
  there; an arm that says nothing has its fist where the view has it, as before.
- The game does not remember which frame was chosen: a frame is only the build and the credits a
  game begins with, and nothing reads it afterwards.

### Two frames for the end (B3)

- **Sterling**: pearl white and silver, slim, long thruster fins on its back. Nearly as quick as a
  Wraith, better armoured, and its core carries a field that takes the first part of the damage of
  every round. A knight: it is hard to hit and forgives being hit.
- **Shrike**: gunmetal and steel blue, light, built forward. The fastest arms there are, and a
  blade's strike from it does not spend the boost: it strikes and is still not there.

Both are sold only at the very end (the back room of the arena, whose last pilots fly them, so a
pilot meets each on the field before owning it). Figures, prices and the size of the field are
settled by measurement against the verdicts, the third audit contract and the back room itself.

### Archetypes the game knows (B2)

A build is one of a handful of kinds, by what it carries and how it moves: for instance a blade
and quick legs make a duellist, tracks or a shield and thick plate a bastion, a charge weapon and
a sharp eye a marksman, a salvo on a wide stance artillery, two energy weapons a lancer, quick
legs and light guns a skirmisher, and anything else a workhorse. The rules are few, checked in
order, and written so that swapping a part of no consequence does not change the name.

The garage shows the name with one line on what that kind of machine is good at. The record keeps
the contracts won as each kind, and there are medals for flying several kinds. Each kind has a
reference build at three stages of the story, and each is measured over the whole story: a kind
that cannot finish it has its parts looked at, not the fights.

**Edges.** A rule of its own for each kind (a duellist's kill giving the boost back, and the like)
is the obvious next thing and is not promised here: it is added only for kinds the measurements
show to be behind, and only after the same measurements say what it does to the hard fights.

## Approaches considered

For the starters:

1. **Three fittings of the one frame** (the same four parts, three sets of guns). No art needed,
   and no difference a pilot would feel after the first shop visit.
2. **Three frames of salvage, each a taste of one of the three powers** (chosen). Different to
   look at, to fly and to grow; six new pictures; the story untouched because it never names the
   frame.
3. **Three of the existing frames, worn** (a Halo, a Bulwark and the Hauler with lower figures).
   Cheap, but a pilot would then own at the start what the first act is spent earning.

For the end-game frames: a frame that is only better figures was set against a frame with one
thing nobody else has; the second is what makes a machine wanted, and is the only kind that needs
measuring, which the project is set up to do.

## Constraints

- A kept game from before this round loads and stays valid; nothing about it changes.
- Every new English text has its Dutch, inside the room its kind has.
- The story's own words stay true of every starter: all three stand on two feet.
- Nothing is merged without the user's word.

## Left to the builder

The exact figures of every new part within the measured bands, the words on the starter screen,
the archetype names and the order of their rules, which medals there are, and what the two new
frames cost.
