# The Small Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the story a hidden layer that is never stated, things to find that hint at it, voices during the fighting, a second cycle that is not the first one again, and a third ending that only that second cycle can reach.

**Architecture:** The story is content: contracts, conversations, pages and messages in `src/content`, each waiting for a `Condition` that `reached()` in `src/core/campaign.ts` answers. The round widens what a condition can say (all of, any of, not, the cycle, an S rank, a floor of the Gauntlet, checks held), lets a line of a battle be said at two new moments and be kept for a later cycle, lets a verdict wait for a condition, and adds one kind of content: finds, which are database entries with a number, a source and a clue, kept in the list the world's entries are kept in (`GameState.codex`), so a saved game holds nothing new. The database gets a sixth page. Everything else is writing, in English and Dutch.

**Tech Stack:** TypeScript, Canvas 2D, vitest with recording canvases, Playwright; the career bot in `scripts/careerBot.ts` for whole roads through the story; the art pipeline in `scripts/art` for four pictures.

**Spec:** `docs/superpowers/specs/2026-11-17-small-print-design.md`. It holds the truth under the story; every text written in this round has to agree with it and may not state it.

## Global Constraints

- No existing line of the story is contradicted. An existing line is changed only where the plan names it.
- A saved game from before loads unchanged. `SAVE_VERSION` stays 8.
- The rules of a battle do not change, apart from the two new moments at which a line can be said.
- Every new English text has its Dutch, inside the room its kind has (`tests/content/dutch.test.ts`): Dutch in plain ASCII, the same figures as the English, no more lines than the English takes.
- Numbers in the hidden layer are written as words ("nine", "forty", "eleven"), except where a document would print a figure (a check's number, VRN-1, Desk 9).
- Room: a line of a battle is at most 4 lines of 46 characters; a line of a conversation 5 of 47; an answer 44; a find's text 12 lines of 37, its title 14 characters, its source 37, its clue 3 lines of 37; a scene's title 14, its heading 22; a contract's title 18.
- Image spend: 5.18 of 14 dollars were spent before this round. This round may spend up to 1 dollar, at low quality, every request through the ledger. The proxy's address and key are never written into the repository.
- Branches are stacked: `feat/print-voices`, `feat/print-finds`, `feat/print-cycle`, `feat/print-ending`, `feat/print-review`, each with a draft pull request. Nothing is merged without the user's word.

## Review Focus

- A game saved before this round, at any point of the story and in any cycle: it must load, and what it has already earned must be found at once, in one announcement, without a page of story being run ahead of.
- A pilot in the first cycle: no line of the recorder, no contract without a client, no third offer, whatever they hold.
- A pilot in a later cycle who sold the logs, or holds eight checks, or has not brought up the box: the third offer is not made. (With the box and too few checks a letter says what the box wants; nothing says how to get it.)
- A battle with a line for `last` or `hurt` that is won before the moment comes, or in which the moment comes twice: the line is said at most once, and never after the battle is over.
- Every find's clue against the deed that finds it: a clue may not name a contract, an answer or a person outright, and may not be so dark that the find is a matter of luck.

## Status

- [x] K1: Voices in a battle (branch `feat/print-voices`)
- [x] K2: Finds (branch `feat/print-finds`)
- [x] K3: A later cycle (branch `feat/print-cycle`)
- [x] K4: The third verdict (branch `feat/print-ending`)
- [x] K5: Review, soak, APK, summary (branch `feat/print-review`)

## K1: Voices in a battle

**Files:** `src/core/campaign.ts` (`TalkLine`), `src/ui/battleFlow.ts`, `src/ui/app.ts` (the cycle handed to a battle), `src/content/missions.ts`, `src/content/sidework.ts`, `src/content/nl/missions.ts`, tests in `tests/ui/battleFlow5.test.ts` (new), `tests/content/voices.test.ts` (new).

**Interfaces:**
- `TalkLine.at: 'start' | 'win' | 'last' | 'hurt' | number`; `TalkLine.cycle?: number` (said only when the game's cycle is at least this; cycles count from 0).
- `FlowOptions.cycle?: number` (0 when absent). `BattleFlow` says a line only when `(line.cycle ?? 0) <= (opts.cycle ?? 0)`.
- `last`: once, when exactly one enemy stands and the battle began with more than one. `hurt`: once, when the pilot's core is below half its armour. Both are said whenever the pilot is about to be handed the menu (at the start of a turn, or in the middle of one after an action that leaves it going), after the lines of the round, in the order `last`, `hurt`; never once the battle is over.

- [x] Tests first (`battleFlow5.test.ts`): a `last` line is said once when one of two enemies is left, never in a battle that began with one enemy, never after the battle is over; a `hurt` line is said once when the core is below half and not at exactly half; a line with `cycle: 1` is not said with no cycle given and is said with `cycle: 1`; the lines of a round still come first; `quiet` says none of it.
- [x] `BattleFlow`: the two moments and the cycle; the app hands the game's cycle to every battle of a contract.
- [x] The writing: every story contract has at least one line that is not about tactics; the lines of the list in the spec's "Voices in a battle" are in `missions.ts` (see the table below); Dutch for each.
- [x] `voices.test.ts`: every story contract (phases intro to verdict) has a line in one of its battles; no battle has more than four lines for one moment; every line fits four lines of 46; no line for `last` in a battle with one enemy; no first-cycle line names Meridian before the finale, the Society, a check, or the box.
- [x] All tests, the browser tests that play battles, screenshots that changed, an APK.

Lines added in K1 (first cycle; who, when):

| Contract, battle | When | Who | About |
|---|---|---|---|
| intro-2 | hurt | Dispatch | the frame has taken worse |
| hadron-1, 2 | round 2 | Dispatch | factory grease on a squatters' tank |
| hadron-2, 1 | last | Dispatch | the wagons ride high |
| hadron-2, 2 | start | Brenn | the train is insured |
| lumen-1, 1 | round 2 | Dispatch | a company that does not dig is paying for forty years of rock |
| lumen-2, 2 | start | Varga | a second mast: somebody buys in pairs |
| undertow-1, 1 | round 2 | Tamsin | they count us |
| undertow-2, 2 | round 4 | Tamsin | forty-one, counted again |
| rival-1, 2 | round 3 | Ashfall | who bought my slot |
| choice-hadron, 1 and 3 | start, last | Brenn, Dispatch | nothing down there is on a register; logged as routine |
| choice-lumen, 2 | start | Varga | the ledgers burn with the depot |
| choice-undertow, 1 and 3 | start, win | Tamsin | which way the bolts face; forty years, one afternoon |
| hadron-3, 2 | start | Brenn | paid not to read |
| hadron-4, 2 | round 3 | Dispatch | a yard number older than Hadron |
| hadron-5, 1 | start | Dispatch | a frame that could clear a floodgate |
| lumen-3, 2 | round 3 | Dispatch | the cab is empty; nobody has told it to stop |
| lumen-4, 1 | last | Varga | their champion's price |
| lumen-5, 1 | start | Varga | the forecasts, yours included |
| undertow-3, 1 | start | Tamsin | Krell kept the valve keys |
| undertow-4, 1 | start | Tamsin | it does not watch, it counts |
| undertow-5, 1 and 2 | round 3, round 5 | Tamsin | the pumps; what the water was hiding |
| finale-*, 1 | start | the client | what comes after tonight |
| audit-1, 1 | last | Dispatch | shooting to tag |
| audit-2, 1 | start | Dispatch | a drawer not opened in eleven years |
| audit-3, 2 | hurt | Ashfall | an escort whose partner is late |
| verdict-default, 1 | start | Ashfall | the policy and the people it was written for |

## K2: Finds

**Files:** `src/core/campaign.ts` (`reached`), `src/core/codex.ts` (`Find`, `checksHeld`), `src/content/finds.ts` (new), `src/content/strings.ts`, `src/content/nl/{index,reference,strings}.ts`, `src/ui/databaseScreen.ts`, `src/ui/app.ts` (opening and announcing), `src/content/missions.ts` (two letters from A Tidy Desk), tests in `tests/core/conditions.test.ts` (new), `tests/core/codex.test.ts`, `tests/content/finds.test.ts` (new), `tests/ui/finds.test.ts` (new), `tests/content/dutch.test.ts` (room for the new kinds).

**Interfaces:**
- `reached(state, condition, missions)`: `a|b` any of, `a&b` all of, `!a` not; `cycle:N` (the cycle is at least N), `s:<contract>` (its best rank is S), `floor:N` (the deepest floor of the Gauntlet is at least N), `checks:N` (at least N ids in `state.codex` begin with `check-`). `|` binds loosest, then `&`, then `!`.
- `interface Find extends Entry { no: number; kind: 'paper' | 'check'; source: string; clue: string }`; ids of checks begin with `check-`, of papers with `paper-`. `checksHeld(game): number`.
- `FINDS: Find[]` in list order: papers 1 to 24, then the checks.
- The database: `DatabasePage` gains `'finds'` after `'world'`; a row is `NN Title` for a paper and `Check NNN` for a check, or `NN ? ? ?` / `Check ? ? ?` while it is not found; the page of one not found shows its clue.

- [x] Tests first for `reached`: each new form alone, the three joined, a condition of the old kind still read as before (a contract id with a dash, `chose:x=y`, `arena:N`).
- [x] `Find`, `FINDS` (the forty of the table below), opened with the world's entries wherever those are opened, announced apart from them: one find by its title, several as a count.
- [x] The page FOUND, its count line (`FOUND n/40   CHECKS n`), Dutch.
- [x] Two letters: from A Tidy Desk after the talk with Old Sixty (what he sends and why), and after a verdict of a first telling (the frame has a recorder; fly the war again).
- [x] `finds.test.ts`: every condition names contracts, questions and answers that exist; numbers run 1 to 24 without a gap; every text, source, clue and title fits its room; no clue contains the title of a contract or a person's name; a career through each client's road in the first cycle finds between eight and twenty and holds fewer than nine checks without side work.
- [x] All tests, screenshots of the page (found, not found, a check), an APK.

The finds (when; what it is):

| No | Title | When | What |
|---|---|---|---|
| 1 | RULE BOOK | `floor:5\|verdict` | the Society's rules: a tenth in iron; nine checks make a meeting |
| 2 | POLICY VRN-1 | `audit-2` | written for the Society, by the Society; passes to the Mutual, for its members |
| 3 | COUNTING RHYME | `undertow-1` | brass for the owner, iron for the digger, water for the floor |
| 4 | SURVEY REPORT | `lumen-1` | every seam worked out, forty years ago; not to be circulated |
| 5 | BOARD MINUTE | `hadron-3\|lumen-5\|undertow-4` | the report stays in the room; the box is noted; the pumps are uneconomic |
| 6 | SHIFT LOG | `floor:15` | water at the nine level; we are hanging our checks on the board |
| 7 | MINUTE BOOK | `quest-3` | adjourned for want of a quorum; forty years in one hand |
| 8 | PROXY FORM | `bounty-6\|quest-3` | the Secretary to vote for me, for ever; all signed in one hand |
| 9 | LETTERHEAD | `audit-1` | owned by its members; registered office: Society Hall, bottom level |
| 10 | WEIGH TICKET | `s:hadron-2&finale\|cycle:1&hadron-2` | declared full, weighed empty, for forty years |
| 11 | ESCORT FILE | `chose:sixty=keep\|chose:sixty=file` | four trucks, an iron box; the second callsign cut out |
| 12 | STOP ORDER | `quest-1` | stop a convoy, do not open the trucks; a new licence, aged twenty |
| 13 | PLAYBACK ONE | `cycle:1&undertow-2` | gate four; lead, answer; count the trucks |
| 14 | PLAYBACK TWO | `quest-2` | the box is in the water; they will take the frame for this |
| 15 | OLD LICENCE | `chose:frame=ask\|chose:frame=quiet` | cancelled eleven years ago; the frame number is yours |
| 16 | RETAINER | `favour-ashfall` | payer left blank; renewed eleven times |
| 17 | MODEL NOTE | `undertow-2&chose:logs=keep\|undertow-2&chose:logs=sell` | heads below the gates; years of quorum remaining |
| 18 | TAMSIN'S BOOK | `finale-undertow\|cycle:1&finale` | nine with their brass and we can sit |
| 19 | PURCHASE ORDER | `s:hadron-1&finale\|cycle:1&hadron-1` | one tank, to the occupants of Seam Nine; bill Hadron, as stolen |
| 20 | BOOKING SLIP | `chose:rival=pull\|chose:rival=leave` | second buyer: Desk 9; do not tell either pilot |
| 21 | THREE RECEIPTS | `audit-3` | the Society: paid in full, forty years in advance |
| 22 | SCHEDULE C | `finale` | item 1: one salvage frame, with its recorder |
| 23 | BRASS PLATE | `floor:20\|quest-3` | registered office; members only; somebody keeps it polished |
| 24 | THE MINUTES | `verdict-quorum` | the meeting, as it was minuted |

| Check | When |
|---|---|
| 114 (the dock) | `undertow-2` |
| 302 (Kite) | `favour-kite` |
| 58 (Marrow) | `favour-marrow` |
| 61 (the lead truck) | `favour-sixty` |
| 204 (a letter) | `chose:sixty=file&finale` |
| 9 (the debt) | `favour-dispatch` |
| 441 (the hatch) | `favour-ashfall` |
| 12 (the Scrap King) | `guild-3` |
| 276 (Magpie) | `bounty-1` |
| 3 (the Notary) | `bounty-6` |
| 88 (the back room) | `arena:12` |
| 190 (ten floors down) | `floor:10` |
| 2 (Krell) | `undertow-3` |
| 350 (Rook) | `lumen-4` |
| 71 (Leviathan) | `hadron-4` |
| 133 (the east gate) | `favour-undertow` |

## K3: A later cycle

**Files:** `src/content/missions.ts`, `src/content/sidework.ts` (the three contracts), `src/content/talks.ts`, `src/content/scenes.ts`, `src/content/codex.ts` (nothing, in the end: the recorder has a face and a voice and no page among the people), `src/content/nl/*`, `scripts/art/jobs.ts` (`portrait-recorder`), `scripts/careerBot.ts` (answers to the story's questions; the side contracts of a later cycle), tests in `tests/content/cycle.test.ts` (new), `tests/core/campaign.test.ts`, `tests/scripts/career.test.ts`.

- [x] A page before the first contract of a later cycle (`playback`: heading THE HANGAR, title PLAYBACK).
- [x] The recorder's lines (`cycle: 1`) in the battles at the sluice: `undertow-2`, `hadron-4`, `undertow-5`, `favour-sixty`; Dispatch's slips in `intro-1` and `rival-1`.
- [x] `quest-1` Dead Channel (`cycle:1&rival-1`), `quest-2` Low Water (`cycle:1&choice&chose:logs=keep&quest-1`), `quest-3` Registered Office (`cycle:1&finale&quest-2`), each also `&!verdict` since K5; client `Unlisted`, the recorder's face. `quest-3` begins at the sluice, where the box is lifted, and ends in the hall (`bg-hall`, made here with the other three pictures of the round: the flood's rule holds in it).
- [x] `talk-playback` (after `quest-2`, before `verdict`): the recorder played to Dispatch; the question `frame` with the answers `ask` and `quiet`; a line for each in what is remembered.
- [x] A letter from Ashfall after `quest-1` (gate four); one from A Tidy Desk after `quest-3` (nine hasps).
- [x] `cycle.test.ts`: in the first cycle none of it is on offer or shown, whatever has been done; in a later cycle each comes when its condition says and not before; with the logs sold `quest-2` never comes.
- [x] The career bot answers questions as told and flies the contracts without a client; a career of two cycles reaches `quest-3`.
- [x] All tests, screenshots, an APK.

## K4: The third verdict

**Files:** `src/core/campaign.ts` (`Verdict`, a verdict that waits), `src/content/missions.ts` (`verdict-quorum`, the epilogues, the third offer), `src/content/scenes.ts`, `src/content/enemies.ts` and `src/content/parts.ts` (the Proxy), `src/content/codex.ts`, `src/content/medals.ts`, `src/content/strings.ts`, `src/content/nl/*`, `scripts/art/jobs.ts` (`bg-hall`, `still-meeting`, `boss-proxy`), `scripts/career.ts`, `scripts/careerBot.ts`, tests in `tests/core/campaign.test.ts`, `tests/content/quorum.test.ts` (new), `tests/core/balance2.test.ts` (the Proxy against the reference builds), `tests/scripts/career.test.ts`.

**Interfaces:**
- `type Verdict = 'enforce' | 'default' | 'quorum'`.
- A contract of the phase `verdict` with a `when` is on offer only once `when` is reached. `verdict-quorum` waits for `quest-3&checks:9`.

- [x] Tests first: with two verdicts on offer and the third one's condition not reached, two are offered; reached, three; once any is done, none.
- [x] `verdict-quorum` Any Other Business: client `Tamsin, for the Society`; the door (six rounds, the count read out a round at a time), then the Proxy; Ashfall on the stair in both.
- [x] The Proxy: a machine hung with the checks of the drowned; three ways of fighting; its numbers set against the reference builds like the Adjuster's.
- [x] Pictures: the hall, the still of the meeting, the Proxy; `quest-3` moved to the hall.
- [x] Three epilogues (`quorum` for each client), the scene of the ending, the third offer in Dispatch's letter when it is made, a world entry, a medal for the verdict and one for nine checks, the credits and the manual where they speak of two verdicts.
- [x] A career: two cycles, the second by each client's road, ends with the third ending seen.
- [x] All tests, screenshots, an APK.

Notes on what K4 became:

- The picture of the meeting shows eight checks on the board, not nine. The count in the last contract and the minutes (paper 24) say so, and say where the ninth is: tied to the left foot of the frame in the door, where the first find of every telling put it. Nothing was redrawn.
- A pilot with the box and fewer than nine checks is written to by Tamsin (`short-of-nine`): the box will not open for less, and some people would hand theirs to a pilot they trusted. The plan's Review Focus had "nothing says why"; a letter that says what the box wants without saying how to get it is fairer.
- The Proxy is sturdier than the Adjuster part for part and hits less sharply: at first it was a race that a fifth more strength turned from nearly always won to never won. The contract's scale is 1.25, the highest of the story: with the best frame and no perks it is won 9 times in 10 at that scale, in a second cycle (a quarter tougher again) hardly ever; with a seasoned pilot's perks nearly always. Four whole careers of two cycles, by different roads and on all three difficulties, reach it and win it.
- Four medals rather than two: the meeting (secret), nine checks, twelve papers, all the papers.


## K5: Review, soak, APK, summary

- [x] A fresh reviewer reads the round against the spec: the hidden layer stated nowhere, no contradiction with a line that was there, every clue fair; and the code against the Review Focus.
- [x] The faults a reviewer names are answered one by one; the mutation runner over the new code (`campaign.ts`, `codex.ts`, `battleFlow.ts`, the database page).
- [x] `docs/handleiding.md` brought up to date (without giving the hidden layer away).
- [x] The whole suite, both halves of the browser tests, the soak, the last APK, a short summary for the user.

Notes on K5:

- **Faults.** 57 small faults were put into the new code one at a time (conditions joined and read, the verdict that waits, the two moments and the cycle of a battle's lines, what is found and how it is announced, the page of the database, and the conditions the content hangs on). 54 were found by the tests as they stood. The other three: a check that a pilot with no core is not spoken to, which could never be reached and was removed; the game handing its cycle to a battle, which only the flow's own tests covered and now has a test that plays the dock in the game itself, first telling and second; and the letter with a check in it, which was only tested after the war and is now tested before it too. All 58 (one more for the line that was simplified) are found now.
- **Soak.** Five minutes each of five ways of playing in a real browser, two at a time, while a reviewer was reading the repository: 5 passed, 257,440 frames, 84 battles.
- **The guide.** `docs/handleiding.md` says that there is a page of things found, that clues are not literal, that what is said in a battle is worth hearing, and that a second telling is not the first one again. It says nothing of what any of it means.
- **The independent review.** One fresh reader went through the whole round against the spec and this plan and found no high-severity defect: nothing crashes, nothing blocks the story, no single text explains the hidden layer. The weak points were in the telling. What was done with each point:

| Point | What it was | What was done |
|---|---|---|
| W1 | A first-act paper named the insurer; three papers answered the question their own battle had just asked | The weigh ticket names no consignee. It and the purchase order now come when the war is over (to a pilot with the S; a later telling still finds them on the spot), so hint and answer are an act apart. At the survey station the paper stays, as the find that shows what a find is, and Dispatch asks another question: why a company that does not dig pays for rock |
| W2 | All forty clues can be read from a new game; four outlined the third act | The clues of what the story hands out say nothing of what is to come (papers 2, 9, 11, 20, 21, 22), and none tells the pilot what to do to somebody (15). Clues for what only a later telling finds stay: they are how a first telling learns there is one. Tests keep the third act's words out of those clues, and keep any clue from quoting its own find or an answer |
| W3 | Dispatch stated two hidden facts | "Nobody has told it to stop"; the count that goes up the tower is Tamsin's to see, and she says it |
| W4 | The third offer "pays nothing" and paid more than Ashfall's | It "pays out of a collection tin" and pays least of the three (6000) |
| W5 | Burning the file did not burn it; "only two people know" had become false | What is remembered is what Old Sixty believes; the file's source owns up to the copy |
| W6 | Two lines of the recorder were about tonight | Both are things said that night. A test |
| W7 | Nine on the board against eight and one; the box never opened in words | The world's entry says nine counted. The briefing says what opened the box, the minutes that it was opened and the roll read. Nobody claims a living hand for every hook: the ninth hook is the frame's |
| W8 | "Another forty years"; "nothing to minute in forty years" | "For good"; "nothing I did not do myself" |
| W9 | Three papers copied the spec too plainly | The model note is in a forecast desk's words; the board no longer minutes its motive; the escort file does not say gate four |
| W10 | The contracts nobody posted said things untrue when flown late | They are not flown once a verdict is given, and their lines hold whenever they are flown. There is more than one Assessor |
| W11 | Two strings spoke of two verdicts | Both changed |
| W12 | The third ending can be walked into with one answer that is not the first | Left, and here is why. It takes a second telling, the logs kept, three contracts nobody posted, nine checks (six or seven of them from work beside the story) and the offer that pays least. A question with one right answer would shut out the pilot who cannot guess it, which the spec counts the worse failure. Two things were added on the side of being findable: a pilot of a later telling who sells the logs hears from Dispatch what went with them, and nobody now takes the third offer for its fee |
| Craft | Ten small points | 1, 2, 3, 5, 7, 9, 10 as proposed; 4 by the new clue; 6 became a hint with something behind it (a frame that could clear a floodgate); 8: the clerk no longer names a screen |
| Clues | Thirteen to adjust | All of them; and one the new test found (check 276 quoted its own find) |
| Dutch | Twenty-five corrections | All of them, some reworded to fit. "Not found yet." is "Nog zoek.": the proposal was four letters longer than the English, and an interface word may be two |
| Originality | Nothing taken; faint echoes | The check on the frame's foot is 114. Three callsigns in the arena that another series of games also uses were renamed (Shimmer, Clinker, Nightjar). The nine is this game's own and older than the round |
| K1 | The third offer could come after a verdict | `&!verdict` on the three contracts and on Tamsin's two letters |
| K2 | A save from before the round, in a later cycle, was credited with nothing from its earlier cycles | A game that holds no find is judged once by its record (`earlierRecord`, `core/codex.ts`): what it has a rank for counts as flown, as in a first telling. Answers of earlier tellings were not kept and are not made good |
| K3 | "One more file" came in every cycle | `verdict&!cycle:1` |
| K4 | Four faults the tests did not notice | Tests for all four: the cycle handed to a battle (already there); moments never said once the battle is over, won or lost; the ten later-telling lines pinned by contract, battle, moment and speaker; a condition that begins with `!` |
| K5 | "That makes nine" was lost with a turn lost to heat | The ninth is counted at the win, before the Actuary answers it |
| K6 | `last` is said in the middle of a turn | Kept: it is said as soon as the pilot is handed the menu. The interface above says so now, and a test plays it |
| K7 | "Policy Vrn-1" in the list | A word with a figure in it stays as written |
| K8 | A letter could be taken back out of the inbox | A letter that has been read stays (`arrivedMessages`) |
| K9 | Letters out of the order they arrive in | Reordered |
| K10 | The balance test plays the third verdict at a strength only Story meets | Said in the test; the careers test is what plays it as a pilot meets it |
| K11 | Small things | The test of the recorder plays to the round the recorder speaks in; the exception for a later part of the round is gone; the limits are the spec's twelve lines and three; three tries in the browser, not eight; the imports; the spec's count of checks. Left: counting finds by the head of their id (a find that is renamed needs a migration either way) |

- **After the review.** The whole suite passes: 3142 tests in 141 files. Twenty-five more small faults were put into what the review changed (the record of an old save, the letter that stays, the name with a figure in it, each condition that was tightened, the ninth counted at the win, a moment said after the battle, a later-telling line said early, the insurer's name back on the ticket): twenty-four were found by the tests as written, and the twenty-fifth (who it is that speaks under the Eye) has a test now. Both halves of the browser tests pass (46; the third verdict in at most three tries). The soak was run again with nothing else touching the repository: 5 passed, 286,808 frames, 90 battles.

