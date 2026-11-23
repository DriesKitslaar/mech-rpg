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

### Task F4: final check

- [ ] `npx tsc --noEmit`; all unit tests; the browser tests; the endurance test.
- [ ] Deliberate faults over what was changed; a test for each that is not caught.
- [ ] A reviewer who has seen none of it reads the round's changes; its findings answered.
- [ ] The last APK; a short Dutch summary.
