# Heavy Metal: design

## Why

The user asked how the game does on power fantasy, and called it very important in a mech game.
Measured, it does badly. The game is a fair fight from the first contract to the last, and a mech
game also has to let a pilot who has built something frightening feel that it is.

Measured with the automatic player in the best frame the shop sells, every perk that counts in a
fight and the bench at its limit, over every story contract and the patrol (twelve seeds each):

| | End of a first telling | At the peak (third telling) |
|---|---|---|
| Rounds a battle | 4.1 | 6.0 |
| Volleys fired for each machine destroyed | 3.8 | 5.0 |
| Turns of the pilot's in which a machine is destroyed | 43% | 31% |
| Turns in which two are destroyed | 2% | 1% |
| Turns in which three are destroyed | never | never |

On the patrol, which never changes (two recon drones), the same pilot takes 2.7 rounds.

So: the strongest pilot there can be never clears a field in a turn, the weakest machines in the
game take it most of three rounds, and a pilot gets weaker against the field as the tellings go on
(enemies half again as tough at the peak, the pilot a quarter more at best). What the game has for
the feeling (the Overdrive, staggering, shooting parts off, the camera) makes for drama; it does
not make for being overwhelming.

## Goals

- **Momentum.** Destroying a machine pays the pilot back at once: the weapon that did it is ready
  again. A pilot who outguns the field goes through it in one turn; a machine that takes more than
  one volley stops the run.
- **They break.** A pilot who destroys two machines in one turn is seen doing it: whatever ordinary
  machine is left breaks off rather than face the next turn.
- **Swarms.** Contracts made for it: more light machines than the field holds, arriving as others fall.
- **A name.** What the pilot has done earns a name that the game uses: on the pilot's page, at the
  head of a battle, and in what is said about them.
- **Weight.** A kill that is far more than was needed looks and sounds like it; a run of kills is
  counted on the screen.
- The same measurements at the end of the round, in the plan, beside the ones above.

## Not goals

- No new parts, frames or bosses, and no change to what a part costs or does.
- No change to how strong a cycle's enemies are (the round before settled that) or to the bench.
- No new progression to manage (no second perk tree, no new currency).
- No real-time action: it stays a game of turns.

## What would make it a failure

- A hard fight that is no longer hard. A boss, a named pilot, a duel or the last contracts of a
  war must be won as often as before, within a few seeds. The feeling has to come from the fights
  a pilot has outgrown, not from the ones that are the point.
- A rule the player cannot see coming: a weapon that fires again, or a machine that leaves, without
  the screen saying why.
- A first hour that plays differently. A new pilot in the starter frame cannot destroy anything in
  one volley, and must not need to.
- Lines of the story lost. What is said when one enemy is left is sometimes a clue; a rule that
  ends a battle the moment two machines fall would skip it.
- Noise. On a handheld, a counter, a word and a heavier bang; nothing that covers the field or
  ignores the calm setting.

## How it works

**Momentum.** When a volley destroys a unit, the weapon that fired it is ready again in the same
turn and the energy it took is given back. Heat is not given back and the round is spent, so a run
ends in an overheat or an empty magazine if nothing else stops it: pushing on is a choice. A
charged weapon has to be charged again. Each unit counts the units its volleys have destroyed this
turn (its *chain*); the battle says so in an event the screen and the sound can use. The rule is
the same for every unit; only a pilot has more than one thing to shoot at.

**They break.** When a unit's chain reaches two, every *ordinary* enemy still standing is shaken.
A shaken machine breaks off when its own turn comes, instead of acting: it leaves the field, and
the battle goes on without it (or is won, if nothing else stands). Until then it can still be shot.
Ordinary means none of: a boss or a machine with phases; a named pilot; an elite; the machine an
objective names (a leader, one to disable, one to drive off). A machine that left is not a kill.
Breaking off at its own turn, not at once, is what keeps the line that is said when one enemy is
left.

**Swarms.** A battle can have a reserve: machines that are not on the field yet. At the start of
each round, while fewer than three enemies stand and the reserve is not empty, the next comes on.
The battle is won when nothing stands and nothing is left to come. The briefing and the field say
how many are still to come. Swarm contracts appear on the open board: light machines only, six to
nine in all, paid by the head. One enters the story's side work as a standing job once the first
war is over.

**A name.** The record a game already keeps (machines destroyed, the arena, the tellings) is read
as renown, and renown as one of a short ladder of names. No new saved state: the name is worked
out from the record. A new name is announced as a medal is. The pilot's page shows it; a battle's
opening banner carries it under the callsign once there is one; and when ordinary machines face a
pilot far above them, the opening line of the battle says they know who it is.

**Weight.** A volley that destroys a machine with at least twice what was left of it is an
*overkill*: the event says so, the machine goes up harder, and the word is on the screen for a
moment. A chain of two or more is counted on the screen ("CHAIN x2") with a rising note. A machine
that breaks off is seen to leave, and the word for that is on the screen too. All of it is quieter
under the calm setting and none of it holds the turn up.

## Approaches considered

1. **Rules that pay for kills (chosen).** Momentum and the break turn a pilot's strength into a
   different kind of turn, not only a shorter one, and need no new thing to manage. They do nothing
   in a fight against one strong machine, so the hard fights stay as they are.
2. **More raw power for the pilot** (bigger bench steps, weaker later cycles). Rejected: it is the
   balance the last round measured its way to, it would make the hard fights easy, and a bigger
   number is not a feeling.
3. **A second tree of ace abilities** bought with credits or earned by deeds. Rejected for now: it
   is a system to manage, and the first of its abilities would be Momentum. If the rules above
   want a way to grow later, this is where it would go.
4. **Presentation only** (bigger explosions, bigger numbers). Rejected as the whole answer: the
   measurements say the turns themselves are the problem. It is the last part of this round.

## Constraints

- A saved game from before this round loads and stays valid; nothing new is saved for the name.
- Every new English text has its Dutch, inside the room its kind has.
- Balance tests of the story are measured again and reported; where a hard fight moved by more
  than a few seeds, the rule is changed, not the test.
- No image is generated unless a part of the round cannot do without one; low quality only, and
  the ledger's ceiling stands.
- Nothing is merged without the user's word.

## Left to the builder

The exact wording on the screen, the sound of a chain, how a machine is seen to leave, the ladder
of names and where its steps lie, how many machines a swarm has at which tier, and what a swarm
pays, are settled in the plan as each part is built, with what was measured.
