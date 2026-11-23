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

#### Batch 3: the Dutch (tester 2, and what tester 4 saw of it)

Tests: the Dutch section of `tests/content/freshEyes.test.ts`, the measured exceptions in `tests/content/dutch.test.ts`, and "no word lies over another" in `tests/ui/freshEyes.test.ts`, which draws the rooms, the shop, the garage, a briefing, a battle and a bill in both languages.

| Finding | So? | Answer |
|---|---|---|
| T2-4, T4-7: UP/DOWN and LEFT/RIGHT in eight Dutch hints | So | OP/NEER and LINKS/RECHTS; a test holds that no Dutch text names the cross in English. |
| T2-5 to T2-18, T2-28, T2-30: single lines that read as translated | So | Each rewritten as the tester had it or nearer the room: "Gun Turret zet zich schrap", "Volgend gevecht met A", "Einde beurt", "KIES ER EEN", "DE EERSTE REGEL DIE PAST, TELT", "hier staat niets boven je", "Niets te verkopen", the three medals "in 3 klassen", "ieder koelt 4 extra per beurt", "Ertstrein onder vuur", the twelve lines of T2-18, omverslaat, warmgehouden, "Je viel met reparaties op zak". |
| T2-15: "slot" means a kept game, locked, and where a part goes | So | A kept game has a PLEK ("START OP WELKE PLEK?"), and a mount is a plek too; OP SLOT keeps the word for locked. |
| T2-16, T4-9: WINST for wins | So | A count of wins is ZEGES, a thing won is GEWONNEN; a test holds that WINST stands nowhere. |
| T2-19, T4-23: no accented letters anywhere | So, and the cause was a rule of ours | A test forbade them "for a letter the font may not have". Measured in a browser: the font has é, è, ë, ï and their capitals at the width of every other letter. The rule now allows them, and the Dutch is spelt with them (barrière, relikwieën, tweeënhalf, kopieën, cliënten, Efficiënt). |
| T2-20, T4-16: English Title Case on Dutch titles ("Boost En Klingen"); "Kinds Of Work" | So | A list writes a title as a title in English, small words inside it small ("Kinds of Work"), and as a sentence in Dutch, with the names it is called after ("Frames van de werf", "Hadron Mining"): `listTitle` in `content/titles.ts`. The contracts the board makes up follow: "Kalm grootboek". Left: "The eighth seat" as the subject of a message beside "The Eighth Seat" as a row of the arena: a subject is a sentence, as every other subject is. |
| T2-21: a decimal point in Dutch | So | A figure with a tenth is written through `figure()`: 39,9 in Dutch, 39.9 in English; the manual's Dutch says 0,8. |
| T2-22, T2-23, T4-22: a singular after a count, words cut short where there is room | So | MEDAILLES, VONDSTEN, EENHEDEN, "Nieuwe cyclus", "Verkocht:", CONTRACTEN GEWONNEN, VOLGEND LEVEL. The rule that held a Dutch word to two letters over the English was what cut them: it now has a list of places measured to hold more (`ROOM_FOR`), and the screens are drawn and looked at for words over words. |
| T2-24: one thing, two names | So in part | OEFENINGEN and RANGLIJST for the two tabs; the handbook names the option as the options do (Snel vechten); the end roll says "piloot met licentie" as the database does; Vol on both rows of the options; "onderdeel" where there is room for it. Left: AP beside Pantser and FCS beside vuurleiding (the short word is the part's line, the long one the sentence, and the legend now joins them); "LV 17" beside a callsign. |
| T2-25, T4-8: Scherpschutter is a perk and a class; "reeks" is a run of the Gauntlet and a chain of kills | So | The perk is Vaste hand. A run of the Gauntlet is an afdaling; REEKS is the chain alone. |
| T2-26: paint names half translated | Left | Names stay as they are in Dutch: parts, weapons, machines, songs, paints. "Fabriek" is not a paint's name but what the row says of a machine with none. |
| T2-27: three genders for a machine | So in part | The two lines found now say zijn and hij, as the briefings do. |
| T2-29: the guide's words are not the screen's | So | The guide and the README say mech, balans, akte, hoofd and kern, and Guard where they said bewaken; the options are all listed; Load Game is said to be there with more than one kept game; End Turn is among the actions; the hub's table has a column of the Dutch names, and the battle's actions are given in Dutch once. |
| (found by the new test, by nobody else) | So | A row of the database's list that is nineteen letters long ran under the mark that says the list goes on, when it stood first or last in view ("Colossus Juggernaut", in both languages). A row is now cut at eighteen in the list and stands whole at the head of its page. |

#### Batch 4: one game (tester 4: the same thing, said and shown the same way on every screen)

Tests: the section "one game" of `tests/ui/freshEyes.test.ts`. Older tests that held an old word or an old place were brought along: the bill in `asks` and `draw`, the arena's hint in `masters`, the seat's label in `seat`, the colour of a part to buy in `classes`, the range's figures in `range`, the bench's hint in `bench`, the count of what is owned in `shopFlow`, the mixer's hint in `docs`.

| Finding | So? | Answer |
|---|---|---|
| T4-4: one word for how something stands, two colours (OPEN grey here and teal there; PASSED teal, BEATEN grey) | So | One colour for each meaning, in `STATE_COLORS`: to do is teal (OPEN, NEXT OPPONENT), done is grey (PASSED, BEATEN, WON), shut is red (LOCKED), held is pink (a crown, the seat). Training and the arena's three pages take their colours from it. |
| T4-5: the line that names the buttons has several dialects | So | One form: the button, a colon, what it does in small letters, three spaces before the next. Brought to it: the garage's lines ("LEFT: paint shop   RIGHT: builds", "L1/R1: paint Factory", "R1: the bench"), the mixer's, and the battle's lines for a weapon, a target and a repair. Training now says "L1/R1: page", and the page of saved builds has a line where it had none ("A: load or save   B: back"). The test walks every text of the game in both languages: one that names two buttons, or begins with a button and a colon, has to be such a line. Left: where the line stands on each screen (centred in a panel here, at the right there); each stands on the row its screen has free, and moving them would shift lists the testers counted as good. "Press A to continue" stays a sentence: it is alone on its row and is said to the player, not listed. |
| T4-6: BUY and SELL in the shop do not look or turn as tabs do elsewhere | Left | The shop has two things to turn: the kind of part (L1/R1, as pages turn everywhere) and whether one buys or sells (LEFT/RIGHT, in the bar). A second row in the look of the first would say that both turn with L1/R1. The hint has named both since batch 3. |
| T4-10: pink means "still to buy" on one page | So | Red, as a part that is missing is everywhere else; pink is the cursor's and a title's. |
| T4-11: what a contract pays has four names | So in part | The bill's row is "Fee", the word the briefings, the wingmen and the manual use. PAYS heads a column in the lists; PURSE is the arena's own word for a prize that no client pays, and the Dutch keeps POT for it. |
| T4-12: how many you own is "(1)" in the shop and "x1" in the garage | So | "x1" in both. |
| T4-13: "nothing here" is written five ways | So in part | The garage said "Empty" on the row and "(none)" in the picker of the same place: both say "Empty". Left: a dash is what an empty cell of a table is; "None" is a choice (no wingman) and not an empty place; "? ? ?" is something not yet known, which is another thing than nothing. |
| T4-14: the places of a machine are named differently in the garage and the shop | So in part | The shop's tab says "Boost", as the garage's row does. Left: the shop's tabs are kinds of part (a hand weapon goes in either hand, so "Hand") and the garage's rows are places on the machine; the picker writes LEFT HAND in full because it has the room. |
| T4-15: the test range has two names in English | So | TEST RANGE on its tab and at the head of its briefing, "Test Range" over its bill, "The Test Range" in the manual. |
| T4-18: REPAIRS is field repairs left in a battle and a cost on the bill | So | The bill's row is "Armour repair" (Pantserherstel); REPAIRS in battle stays the count it is. |
| T4-19: capitals here and not there in the range's panel | So | The figures of a saved build are written as a machine's are in the same panel: ARMOUR 705   MOBILITY 7   ENERGY 235. |
| T4-24: the ring that runs out from the rank's stamp cuts the word RANK | So | The word is written after the ring, which passes under it. The test holds both that the ring crosses the word's place and that the word comes later. |
| T4-25: the rows of a full bill run into what the client says | So | A line stays empty between the last row and the client's words. Seven lines are shared by what was added to the fee, the parts repaired and what is said: words of one or two lines begin lower for it, and a bill names fewer than four parts only where what was added to the fee and what is said take more than three lines between them (the total above the parts covers all of them, as it did). |
| T4-26: the hint reads as a fourth line of a master's description | So | It stands 16 px under the third line where it stood 13 (`HINT_Y` in the arena), which is as low as the screen lets it go. |
| T4-27: "THE EIGHTH SEAT" and "WON" read as one phrase | So | The seat's label ends twelve pixels further left; the test holds the gap, and the Dutch label stands at the same place. |
| T4-29: three Overdrives opened at once are too wide for an announcement in Dutch | So | They are named while their names fit, and counted when they do not: "3 Overdrives". |
| T4-30: the bottom-left panel of a battle is a bare box while the menu is down | Left | The menu comes back into it within a second or two; whatever stood there in between would be read as a menu. |

Tester 4's other findings were answered where they belong: T4-1, 2, 3, 17, 21 and 28 in batch 1, T4-20 in batch 2, and T4-7, 8, 9, 16, 22 and 23 in batch 3.

### Task F4: final check

- [ ] `npx tsc --noEmit`; all unit tests; the browser tests; the endurance test.
- [ ] Deliberate faults over what was changed; a test for each that is not caught.
- [ ] A reviewer who has seen none of it reads the round's changes; its findings answered.
- [ ] The last APK; a short Dutch summary.
