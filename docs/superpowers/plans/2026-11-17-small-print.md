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
- A pilot in a later cycle who sold the logs, or holds eight checks, or has not brought up the box: the third offer is not made, and nothing says why.
- A battle with a line for `last` or `hurt` that is won before the moment comes, or in which the moment comes twice: the line is said at most once, and never after the battle is over.
- Every find's clue against the deed that finds it: a clue may not name a contract, an answer or a person outright, and may not be so dark that the find is a matter of luck.

## Status

- [x] K1: Voices in a battle (branch `feat/print-voices`)
- [x] K2: Finds (branch `feat/print-finds`)
- [x] K3: A later cycle (branch `feat/print-cycle`)
- [ ] K4: The third verdict (branch `feat/print-ending`)
- [ ] K5: Review, soak, APK, summary (branch `feat/print-review`)

## K1: Voices in a battle

**Files:** `src/core/campaign.ts` (`TalkLine`), `src/ui/battleFlow.ts`, `src/ui/app.ts` (the cycle handed to a battle), `src/content/missions.ts`, `src/content/sidework.ts`, `src/content/nl/missions.ts`, tests in `tests/ui/battleFlow5.test.ts` (new), `tests/content/voices.test.ts` (new).

**Interfaces:**
- `TalkLine.at: 'start' | 'win' | 'last' | 'hurt' | number`; `TalkLine.cycle?: number` (said only when the game's cycle is at least this; cycles count from 0).
- `FlowOptions.cycle?: number` (0 when absent). `BattleFlow` says a line only when `(line.cycle ?? 0) <= (opts.cycle ?? 0)`.
- `last`: at the start of the pilot's turn, once, when exactly one enemy stands and the battle began with more than one. `hurt`: at the start of the pilot's turn, once, when the pilot's core is below half its armour. Both are said after the lines of the round, in the order `last`, `hurt`.

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
| lumen-1, 1 | round 2 | Dispatch | forty years of readings, guarded like a mint |
| lumen-2, 2 | start | Varga | a second mast: somebody buys in pairs |
| undertow-1, 1 | round 2 | Tamsin | they count us |
| undertow-2, 2 | round 4 | Tamsin | forty-one, counted again |
| rival-1, 2 | round 3 | Ashfall | who bought my slot |
| choice-hadron, 1 and 3 | start, last | Brenn, Dispatch | nothing down there is on a register; logged as routine |
| choice-lumen, 2 | start | Varga | the ledgers burn with the depot |
| choice-undertow, 1 and 3 | start, win | Tamsin | which way the bolts face; forty years, one afternoon |
| hadron-3, 2 | start | Brenn | paid not to read |
| hadron-4, 2 | round 3 | Dispatch | a yard number older than Hadron |
| hadron-5, 1 | start | Dispatch | what a mining company wants with a frame that jumps |
| lumen-3, 2 | round 3 | Dispatch | the cab is empty |
| lumen-4, 1 | last | Varga | their champion's price |
| lumen-5, 1 | start | Varga | the forecasts, yours included |
| undertow-3, 1 | start | Tamsin | Krell kept the valve keys |
| undertow-4, 1 | start | Dispatch | the Eye counts heads |
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
- [x] Two letters: from A Tidy Desk after the talk with Old Sixty (what he sends and why), and after any verdict (the frame has a recorder; fly the war again).
- [x] `finds.test.ts`: every condition names contracts, questions and answers that exist; numbers run 1 to 24 without a gap; every text, source, clue and title fits its room; no clue contains the title of a contract or a person's name; a career through each client's road in the first cycle finds between eight and twenty and holds fewer than nine checks without side work.
- [x] All tests, screenshots of the page (found, not found, a check), an APK.

The finds (when; what it is):

| No | Title | When | What |
|---|---|---|---|
| 1 | RULE BOOK | `floor:5\|verdict` | the Society's rules: a tenth in iron; nine checks make a meeting |
| 2 | POLICY VRN-1 | `audit-2` | written for the Society, by the Society; passes to the Mutual, for its members |
| 3 | COUNTING RHYME | `undertow-1` | brass for the owner, iron for the digger, water for the floor |
| 4 | SURVEY REPORT | `lumen-1` | every seam worked out, forty years ago; not to be circulated |
| 5 | BOARD MINUTE | `hadron-3\|lumen-5\|undertow-4` | a fund that cannot meet cannot object; the pumps are uneconomic |
| 6 | SHIFT LOG | `floor:15` | water at the nine level; we are hanging our checks on the board |
| 7 | MINUTE BOOK | `quest-3` | adjourned for want of a quorum; forty years in one hand |
| 8 | PROXY FORM | `bounty-6\|quest-3` | the Secretary to vote for me, for ever; all signed in one hand |
| 9 | LETTERHEAD | `audit-1` | owned by its members; registered office: Society Hall, bottom level |
| 10 | WEIGH TICKET | `s:hadron-2\|cycle:1&hadron-2` | declared full, weighed empty, for forty years |
| 11 | ESCORT FILE | `chose:sixty=keep\|chose:sixty=file` | four trucks, an iron box; the second callsign cut out |
| 12 | STOP ORDER | `quest-1` | stop a convoy, do not open the trucks; a new licence, aged twenty |
| 13 | PLAYBACK ONE | `cycle:1&undertow-2` | gate four; lead, answer; count the trucks |
| 14 | PLAYBACK TWO | `quest-2` | the box is in the water; they will take the frame for this |
| 15 | OLD LICENCE | `chose:frame=ask\|chose:frame=quiet` | cancelled eleven years ago; the frame number is yours |
| 16 | RETAINER | `favour-ashfall` | payer left blank; renewed eleven times |
| 17 | MODEL NOTE | `chose:logs=keep\|chose:logs=sell` | heads below the gates; years until no meeting can be had |
| 18 | TAMSIN'S BOOK | `finale-undertow\|cycle:1&finale` | nine with their brass and we can sit |
| 19 | PURCHASE ORDER | `s:hadron-1\|cycle:1&hadron-1` | one tank, to the occupants of Seam Nine; bill Hadron, as stolen |
| 20 | BOOKING SLIP | `chose:rival=pull\|chose:rival=leave` | second buyer: Desk 9; do not tell either pilot |
| 21 | THREE RECEIPTS | `audit-3` | the Society: paid in full, forty years in advance |
| 22 | SCHEDULE C | `finale` | item 1: one salvage frame, with its recorder |
| 23 | BRASS PLATE | `floor:20\|quest-3` | registered office; members only; somebody keeps it polished |
| 24 | THE MINUTES | `verdict-quorum` | the meeting, as it was minuted |

| Check | When |
|---|---|
| 117 (the dock) | `undertow-2` |
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

**Files:** `src/content/missions.ts`, `src/content/sidework.ts` (the three contracts), `src/content/talks.ts`, `src/content/scenes.ts`, `src/content/codex.ts` (the recorder among the people), `src/content/nl/*`, `scripts/art/jobs.ts` (`portrait-recorder`), `scripts/careerBot.ts` (answers to the story's questions; the side contracts of a later cycle), tests in `tests/content/cycle.test.ts` (new), `tests/core/campaign.test.ts`, `tests/scripts/career.test.ts`.

- [x] A page before the first contract of a later cycle (`playback`: heading THE HANGAR, title PLAYBACK).
- [x] The recorder's lines (`cycle: 1`) in the battles at the sluice: `undertow-2`, `hadron-4`, `undertow-5`, `favour-sixty`; Dispatch's slips in `intro-1` and `rival-1`.
- [x] `quest-1` Dead Channel (`cycle:1&rival-1`), `quest-2` Low Water (`cycle:1&choice&chose:logs=keep&quest-1`), `quest-3` Registered Office (`cycle:1&finale&quest-2`); client `Unlisted`, the recorder's face. `quest-3` begins at the sluice, where the box is lifted, and ends in the hall (`bg-hall`, made here with the other three pictures of the round: the flood's rule holds in it).
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

- [ ] Tests first: with two verdicts on offer and the third one's condition not reached, two are offered; reached, three; once any is done, none.
- [ ] `verdict-quorum` Any Other Business: client `Tamsin, for the Society`; the door (six rounds, the count read out a round at a time), then the Proxy; Ashfall on the stair in both.
- [ ] The Proxy: a machine hung with the checks of the drowned; three ways of fighting; its numbers set against the reference builds like the Adjuster's.
- [ ] Pictures: the hall, the still of the meeting, the Proxy; `quest-3` moved to the hall.
- [ ] Three epilogues (`quorum` for each client), the scene of the ending, the third offer in Dispatch's letter when it is made, a world entry, a medal for the verdict and one for nine checks, the credits and the manual where they speak of two verdicts.
- [ ] A career: two cycles, the second by each client's road, ends with the third ending seen.
- [ ] All tests, screenshots, an APK.

## K5: Review, soak, APK, summary

- [ ] A fresh reviewer reads the round against the spec: the hidden layer stated nowhere, no contradiction with a line that was there, every clue fair; and the code against the Review Focus.
- [ ] The faults a reviewer names are answered one by one; the mutation runner over the new code (`campaign.ts`, `codex.ts`, `battleFlow.ts`, the database page).
- [ ] `docs/handleiding.md` brought up to date (without giving the hidden layer away).
- [ ] The whole suite, both halves of the browser tests, the soak, the last APK, a short summary for the user.
