# Fresh Eyes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four testers who have not seen the game play the whole of it, and what they find is checked against the game and answered: mended with a test, or left with the reason written down.

**Architecture:** No new system. The testers drive the game's own `App` through a kit kept outside the repository, which prints each screen as the words on it, and start from kept games taken along two careers of the automatic pilot. Each mend is the smallest change that answers its finding, written test first, in the place the finding lives.

**Tech Stack:** TypeScript, Canvas 2D at 310x270, vitest, Playwright; `scripts/careerBot.ts` for the kept games.

**Spec:** `docs/superpowers/specs/2026-11-23-fresh-eyes-design.md`

## Global Constraints

- No new system, mode, room or rule; no new picture unless a finding cannot be answered without one.
- No balance test of the story changes unless a finding is about balance and was measured first.
- A kept game from before this round loads and stays valid.
- Every text that is changed or added has its Dutch, within the room its kind has; interface strings in Dutch at most two letters longer than the English, with the same numbers in the same order.
- Nothing a tester lists as good is taken away by a mend.
- Nothing is merged without the owner's word.

## Review Focus

1. A mend that changes a word on a screen: the same thing is called the same wherever else it is named (the guide, the manual, the Dutch).
2. A mend in the first hour: a kept game that is already past that point still loads, and is told nothing twice.
3. A mend that moves or adds something on a screen: nothing lies over anything, with the longest text the screen can hold, in English and in Dutch.
4. A mend to money or to pace: measured before and after with the career script; every road still finishes on every difficulty.
5. A finding that is a tester's mistake: answered as that, with what shows it, and nothing changed for it.

---

### Task F1: the kit and the kept games

**Files:** none in the repository. In the scratchpad: `kit.ts`, `saves/*.json`, `README.md`.

**Interfaces:**
- Produces: `open(game?, options?)` (an app over a store in memory, new or kept, hurried or at a walking pace), `press(app, ...actions)`, `wait(app, ms)`, `screen(app)` (the screen as rows of text where they stand), `menu(app)`, `told(app)` (what the game tells a test of itself), `kept(store)` (the game as saved).

- [x] The kit, and a page that says how to use it. A screen is printed in a second; a battle flown by the game's own Auto Turn hands back what was said and reported in it, line by line. (A text with an edge is written three times a pixel apart: the kit counts it once.)
- [x] Kept games along three careers of the automatic pilot (Hadron on Standard into a second telling, Lumen on Standard, the Undertow on Story) at nine or ten stages each: twenty-nine. Four more made by hand from the one where the story is over, for the long game: an account with its notice out, the seven crowns held, the eighth seat taken, and two million credits.
- [x] Tried by hand: a new game from the title to its first bill through the kit alone (the briefing, the battle's lines, the bill), and six kept games opened in Dutch, the long game's list of contracts among them.

### Task F2: the four testers

- [x] Four testers at once, each with one lens, the kit, the rules of the round and a file of its own for notes: the first two hours in English; all of it in Dutch; the middle, the end and the long game; the screens side by side (the 225 pictures added since the last whole look).
- [x] What each handed in, kept beside the plan's findings (in the scratchpad; the findings themselves go into this plan). A hundred and one findings: 22 from the first two hours (T1), 30 from the Dutch (T2), 19 from the middle, the end and the long game (T3), 30 from the screens side by side (T4). None of them stops a player.

### Task F3: the findings, checked and answered

- [ ] Each finding checked against the game: so, not so, or so in part. Grouped, worst first.
- [ ] Each one answered, worst first: the test that fails for it, the mend, the test passing; or the reason it is left.
- [ ] The list of what is good, and that no mend touched it.

(The findings and their answers are written here as they are settled. A finding is named by its tester and its number in that tester's report: T2-1 is the first finding of the tester who played in Dutch.)

#### Batch 1: what was broken or untrue

| Finding | So? | Answer |
|---|---|---|
| T2-2, T4-1: a Dutch paragraph cut off in the middle of a sentence (the first drill, and the range's note on Kiln's machine) | So | The panel's room is a number now (`PANEL_CHARS`, `PANEL_LINES` in `trainingScreen.ts`), and `tests/content/freshEyes.test.ts` measures every drill's text and every note of the range against it, in both languages. Two Dutch texts were shortened. |
| T4-2, T4-28: a mark written bare on a tall machine (TARGET in amber on a yellow machine; HARDENED, OVERCLOCKED, REDLINE) | So | A mark that the top of the field pushes down onto the machine it belongs to gets the dark plate, as a mark moved for another machine's bars already had (`markPosition` in `tags.ts`; `tests/ui/tags.test.ts`). |
| T4-3: the shop's detail lines run onto the panel's right border | So | A line holds 27 letters, as the garage's did (`PART_LINE_CHARS` in `partInfo.ts`); a row of figures that is longer closes up its spaces. `tests/ui/freshEyes.test.ts` measures every part's lines against the border, in both languages. |
| T2-3: a long opening line runs under the fight counter in the top bar | Not so | The bar already leaves the counter out when the line would reach it (`labelFits`). Seen again with the kit on the same contract: the counter is not drawn while that line stands. The tester measured the two texts, not what was drawn. Nothing changed. |
| T2-1: the shop's comparison says K, E and X, where the Dutch heading says K, S and E | So | The letters come from the strings (`partInfo.typeLetters`); a test holds the comparison to the heading's letters in both languages. |
| T1-15: a destroyed part can still be aimed at, and the shot goes to the core unannounced | So in part | The figures were right: a shot at a part that is gone passes half on to the core, and the preview showed that half. What was missing is the word: the row of such a part now reads "Legs: gone, half to core". Left as a choice, since half a shot at the core is sometimes the one that finishes it. |
| T4-17: an escort's title names one freight and its objective another ("ESCORT: WAGE RUN", "Protect: Ore Lift") | So | The five titles name no freight any more (Safe Hands, Last Mile, Day Shift, Signed For, Fragile); a test holds every title against the six freights' names. |
| T4-21: a locked row of the arena still offers "A: challenge" | So | On a row that cannot be challenged the hint leaves A out. |
| T3-5: the other side's offer hands over a paper the pilot already holds, and then says nothing | So | The bill is followed by "ALREADY FOUND" over the paper's name (`heldAlready` in `core/codex.ts`; tests in `tests/core/freshEyes.test.ts` and `tests/ui/freshEyes.test.ts`). |
| T3-17: an account's notice pays the same in a later telling, where everything else pays half as much again | Not so, as stated | A notice is board work, and nothing on the open board grows with the telling: the board's pay is by the pilot's own record (capped at 2200), a notice's by the machine and the meeting (1700 to 4800, measured). The story's contracts are what pay more the second time. Left as it is; whether the open board should keep pace is the subject named below for the next round. |

#### Batch 2: the first hours (tester 1, with what the others said of the same things)

Tests: `tests/ui/firstHours.test.ts` (52), and the manual's order and legend in `tests/content/freshEyes.test.ts`.

| Finding | So? | Answer |
|---|---|---|
| T1-1: the battle menu never says what its rows do | So | While a new pilot is told the buttons, a second line under that one says what the row under the cursor is for, and changes as the cursor moves (`STRINGS.coachRows`, ten rows, both languages). |
| T1-2: rows go grey with no reason | So | A row that cannot be chosen says why beside it, for every pilot: "Fire  fired", "Guard  boosting", "Boost  no energy", "Field Repair  not needed" (`shut` in `battleFlow.ts`). Every row with every reason is measured against the menu's width in both languages. |
| T1-2, T3-10: the cursor jumps to Boost once the weapons have fired; Auto Turn is three presses every turn | So | The cursor rests on Fire while a weapon can fire, on Boost when what cannot fire is a blade waiting for one, and otherwise on End Turn: never on a row that spends energy under a press meant for something else. A pilot who gave the turn to Auto Turn finds the cursor on it the turn after, and in the next battle of the same contract, until they do something themselves. |
| T1-17: a curious first press of Field Repair wastes one | So in part | The row's line now says it takes the rest of the turn, and the list of parts it opens can be left with B. A repair of a part that is barely scratched is still the pilot's to spend. |
| T1-3: nothing sends a winning pilot to Training | So | The hub's row says how many drills are open and not passed ("3 open"), as Messages says what is new. |
| T1-4, T3-14, T4-20: after the second contract the list is eleven rows of one colour; the rows that fork the story look like any other | So | Under the list a line says what kind of row is in hand: STORY, STORY (one client and the others go), SIDE WORK, OPEN (a new offer after every win), OPEN with a + (pays more in the class it asks), JOB, ACCOUNT, SWARM, PATROL, ARCHIVE, and in the archive REPLAY (`kindOf` in `hubScreen.ts`). With no story on offer the cursor rests on the open board and not on the patrol. |
| T1-5: an overweight mech and the story contract is gone, with the reason only in the briefing | So in part | The list's line says it: "CANNOT DEPLOY: patrol only, lent mech"; the hub's row and the garage already said Overweight. Left: the shop shows what a part weighs against the one fitted, not the load it would make. The garage is where a fit is judged, and shows it on the row under the cursor. |
| T1-7: Hot Barrel warns of heat and cannot make a starting machine hot | So (measured) | Flown as hot as a starter can be flown (a boost and everything it carries, every turn, twelve battles each), the three starters peak at 12, 22 and 12 of 100. The briefing now says what the contract does ask (Boost, or Guard, one of the two each turn), and heat is explained when it is true: the first time the menu comes with the pilot's machine at half its limit or hotter, Dispatch says what that leads to and what Vent does, once (`heat`, a third lesson beside the two). A test holds the measurement and the briefing to each other. |
| T1-8: short words with no key anywhere; "MOB" and "Mobility" are two numbers | So | Two chapters of the manual are a legend (SHORT WORDS, SHORT WORDS: GUNS), and say that MOB is a pair of legs' own figure and a machine's Mobility less the more it is loaded. A test holds the legend to every short word a part's lines use, in both languages. The shop says under its hint where that is: "What the short words mean: Database, MANUAL". |
| T1-11: the manual is one flat list with Controls fiftieth | So | In the order a pilot comes to need it: the buttons, the legend, what a first hour asks, what the open board brings, the long game last. Left: no chapter is hidden until it opens. A manual is looked things up in, and a chapter that is not there yet reads as missing. |
| T1-8, T1-22: "Start is idle" | Not so | Start opens the window that shows what the handheld passes on (the guide's first table and its last chapter). The kit drives the game past the shell that owns that button, so the tester never saw it. It is not given a second meaning. |
| T1-9: the first briefing shows a class, odds and a stripe before anything explains them | So | A pilot still in the two introductions is shown the contract alone: no class, no odds, no row for the build. From the third contract, and in a later telling from the first, it is all there. |
| T1-10: announcements name a thing and not where it is; levels come silently | So | A stripe, an Overdrive and a name say at the right of their heading where they are ("Pilot, CLASS", "Pilot, DRIVE", "Pilot, RECORD"); a level gained is announced, with the perk points there are to spend ("LEVEL GAINED", "Pilot, PERKS"). |
| T1-12: the enemy shoots under a name that is not the enemy's; AIMS HEAD is unexplained | So | A shot that is not the pilot's names the machine after the weapon: "Stinger (Recon Drone A) hits you". The longest such line is measured against the bar for every machine in the game. The manual's chapter on what enemies do says what the word over a machine is. |
| T1-13, T3-9: the balance is not the old balance and the net when a medal pays | So | Beside the word BALANCE the bill says what the medals earned with it paid ("with medals +200"); the net is the contract's alone, as before. |
| T1-14: "Credits 1200" on the starter choice reads as a price; nothing says the choice is not for good | So | The row reads "Plus credits", and under the figures: "Any part can be changed later." |
| T1-18: A in a briefing's first moment launches the contract | So | A briefing that has just opened does not take A for a quarter of a second, as a line of talk does not. Not longer, and not "the first press finishes the text": tester 3 lists three presses from hub to launch as good, and it stays three. |
| T1-22: the options' rows have no description | So in part | Four rows had one (difficulty, the two effects, the A/B swap); the other eight have one now. |
| T1-16: the shop opens on Head when the advice was a weapon; new stock is unmarked | Left | A mark for new stock needs the game to keep what the pilot has looked at: a new thing to keep, for a small gain. |
| T1-19: with a wingman the menu has nine rows and Retreat scrolls off | Left | The list shows that it goes on (the mark at its foot), and the row most used last is the one under the cursor. |
| T1-20: the hub names a contract nobody has met ("after Hot Barrel") | Left | It names what opens the arena exactly, and that contract is the next row the list shows. "After two contracts" would be untrue of a pilot who flies the patrol twice. |
| T1-21: the first retreat pays | Left, and now said | The medal is meant; the bill now says beside the balance what it paid. |
| T1-6: the whole first act is won on Auto Turn in the starter | Left for the next round | See the end of this section: difficulty and stakes are a round of their own. |

### Task F4: final check

- [ ] `npx tsc --noEmit`; all unit tests; the browser tests; the endurance test.
- [ ] Deliberate faults over what was changed; a test for each that is not caught.
- [ ] A reviewer who has seen none of it reads the round's changes; its findings answered.
- [ ] The last APK; a short Dutch summary.
