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

Both are designs of this game's own, with their own names, made as the other frames were made
(one drawing in the shared pose, cut into layers, the same from behind): a knight in white plate
with a coat of thruster vanes, and a masked butcher bird with blades along its forearms.

- **Sterling**: pearl white with gold seams, slim. Nearly as quick as a Wraith, better plated, and
  its core raises a **field**: a barrier of 25 that takes the first of whatever lands. While any of
  it stands at the pilot's own turn it is whole again; a field that was broken stays down for a
  round, and is whole the turn after. It is hard to hit and forgives being hit a little.
- **Shrike**: ash grey with rust-red edges, light. The best arms there are for a hand weapon, and
  they have **poise**: the first blade to strike in a turn does not give up the boost that carried
  the mech in. A second blade after it does, as any blade does from other arms.

**How a pilot comes by them.** Once the audit is over, two duels are posted, one at a time
(`duel-1` By Appointment, `duel-2` First Sword): the Coast Circuit duels for standing, and sends a
sword, then its first, for the pilot who settled Varn. Larder flies a Shrike, Argent a Sterling.
A duel won opens its frame in the shop (`won:duel-N`, a new condition: a contract that has left a
rank). Ranks are kept through the cycles, so a duel won is won for good; and unlike what a
client's contract opens, the frames are not handed to a later telling that never fought for them.
So a pilot meets each frame on the field before owning it.

**What measuring changed.**

- A field of 50 a round, as first drawn, made both verdicts and half the back room a formality:
  a quick mech is seldom hit, and the field ate what did land. A flat 25 was still too much
  (verdict Default in a second telling went from 35 wins in 100 to 88). The rule became the one
  above: under steady fire the field works every other round. With it a Sterling with two guns
  wins that verdict 62 times in 100, the audit's third contract 95, and still loses to Longshot,
  Brother Rust and the Founder nearly every time.
- Poise as first written (every blade keeps the boost) took a Shrike with two blades past the
  Founder 67 times in 100, where the best build there was won 37. Once a turn, it wins 10.
- The Sterling's core on a Colossus is worse than the Colossus's own in the back room: what it
  gives in field it takes in plate. Mixing is a choice, not an upgrade.
- The two pilots: with the frames as sold and a contract's scale, a duel was over in two rounds.
  They are **plated** (a new figure on an enemy: armour beyond its parts, which a scale would
  also turn into damage and balance): twice the frame's armour. Argent aimed at the head at
  first, which blinds a heavy mech in two rounds; he aims for the core now. His field is 70,
  tuned past what the yard sells (an enemy may raise more than its core is sold with).
- With the perks of a pilot who has finished the story, the automatic pilot wins the first duel
  nearly always in a quick mech with a blade, about half the time in a Colossus; the second
  nearly always with anything that lands one great blow a round, and one time in four with a
  Colossus whose beam only feeds the field. The second duel is meant to be answered with a
  different build, and its briefing says so.

### Archetypes the game knows (B2)

A build is one of seven kinds, asked about in this order, and it is the first that fits:

| Kind | What makes one |
| --- | --- |
| Duellist | A blade in either hand |
| Sharpshooter (`marksman`) | A weapon that has to charge |
| Artillery | A salvo |
| Lancer | Two weapons or more, every one of them an energy weapon |
| Bastion | A shield, or legs of mobility 18 or less |
| Skirmisher | Legs of mobility 40 or more |
| All-rounder | Anything else |

Only the weapons, a shield and the legs are asked about, and the legs are read as they are sold,
not as the load leaves them: a head, a core, arms, a generator, a booster, fire control or a module
can be changed, and a heavier gun fitted, without the machine being called something else. The
three starters come out as three kinds (all-rounder, skirmisher, bastion), and so do the reference
builds (all-rounder, bastion in heavy plate, duellist on the ladder).

**Where the pilot meets it.** The garage says the kind and what it is good at along its top, as it
would be with the part under the cursor fitted, lit when that part would change it. The pilot's
screen has a page of the seven: what makes each, what was won as each, what the one under the
cursor is good at, and a build of it to put together now. That build is the best of the kind's
three (below) whose every part is owned or on the shelf and whose missing parts the credits in
hand pay for; when they pay for none it is the one nearest to complete, and before anything of it
is sold it is the first, with what no shop sells yet shown dim. A contract won in the pilot's own
machine is counted for the kind that machine is (not a lent mech, a drill or a Gauntlet floor), and
three medals go by that count: three kinds tried, twenty-five contracts as one, five as each.

**A build of each kind at three stages** (`src/content/archetypeBuilds.ts`): bought with what the
first act sells (7200 credits at most), with what the choice sells (13700), and with what the arena
pays out (28100). They are what the page suggests and what the tests fly.

**What measuring showed.** Several builds of each kind were measured at each stage before these
were chosen (thirty to forty battles a fight with the game's own automatic pilot, no perks until
the audit). The figures are wins in a hundred over all the fights of a stage.

- Early (the second contracts, the rival, the three choices), every kind wins 93 to 100.
- In the war (its nine contracts and three finales) the kinds spread out: sharpshooter 95,
  skirmisher 93, duellist 92, all-rounder 90, bastion 83, artillery 81, lancer 77. The lancer is the
  one that had to be found: built round the emitters that only burn it wins 19 to 50, because a
  turn's energy does not pay for them and a cooler generator makes less of it; built round the
  weapons that heat and drain the other machine it wins 77. A salvo does little to one heavy
  machine, so artillery carries two good guns beside it.
- At the audit and the two verdicts every pilot is offered, with a veteran's perks, every kind wins
  91 to 100.
- Whole careers: the bot flew each kind's ladder by three roads on Standard and finished all
  twenty-one without a patrol flown for money and with at most one story contract lost; on Veteran
  all seven finish too, the duellist with thirty patrols and the rest with ten at most.

**Edges.** No kind was given a rule of its own. The measurements did not ask for one: the kind
furthest behind gets through the story on Veteran with parts the shop already sells. A rule for
each kind stays the obvious next thing, and stays out until somebody wants the balance of the
whole story moved for it.

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
