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

- [ ] The kit, and a page that says how to use it.
- [ ] Kept games along two careers (two clients, two verdicts) at some ten stages each, with a line for each that says where it stands.
- [ ] Tried by hand: from a new game to the first bill through the kit alone, and a kept game of the long game opened in Dutch.

### Task F2: the four testers

- [ ] Four testers at once, each with one lens, the kit, the rules of the round and a file of its own for notes: the first two hours in English; all of it in Dutch; the middle, the end and the long game; the screens side by side.
- [ ] What each handed in, kept beside the plan's findings (in the scratchpad; the findings themselves go into this plan).

### Task F3: the findings, checked and answered

- [ ] Each finding checked against the game: so, not so, or so in part. Grouped, worst first.
- [ ] Each one answered, worst first: the test that fails for it, the mend, the test passing; or the reason it is left.
- [ ] The list of what is good, and that no mend touched it.

(The findings and their answers are written here as they are settled.)

### Task F4: final check

- [ ] `npx tsc --noEmit`; all unit tests; the browser tests; the endurance test.
- [ ] Deliberate faults over what was changed; a test for each that is not caught.
- [ ] A reviewer who has seen none of it reads the round's changes; its findings answered.
- [ ] The last APK; a short Dutch summary.
