# Of One Piece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game reads as one thing: the rules of Heavy Metal are taught by play, and what four fresh testers find in a play-through of the whole game is answered.

**Architecture:** Teaching is two lines of the kind the game already says in a fight (`TalkLine`), said once for a kept game at the moment that calls for them, and two drills that are open battles. The rest of the round is findings, each checked against the game, mended with a test or left with a reason.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-of-one-piece-design.md`

## Global Constraints

- A kept game from before this round loads and stays valid (`lessons` is optional).
- Every new English text has its Dutch, inside the room its kind has (`tests/content/dutch.test.ts`).
- A lesson is said at most once for a kept game, never in a drill, never in the Gauntlet, never when the battle is played hurried (`quiet`).
- A drill is an open battle only where it says so (`Drill.open`); the eleven that were there play to their last event as before.
- No balance test of the story changes.
- Nothing is merged without the user's word.

## Review Focus

- A lesson whose moment comes in the volley that ends the battle: nothing is said, and it is not counted as said.
- Both moments in one turn (the first chain a kept game ever has is also its first rout): two lines, one after the other, then the menu with the bar's own line.
- A turn played by Auto Turn: no menu is handed over, so nothing is said; the line keeps for the next time the thing happens with the pilot at the controls (said a turn late, it would speak of a weapon that is no longer ready).
- A kept game with `lessons` holding an id this version does not know: loads, and is left as it is.
- The training list with thirteen rows, in Dutch: every title fits its row beside PASSED / the pay.

---

### Task U1.1: lessons in the flow

**Files:**
- Modify: `src/core/game.ts` (`GameState.lessons?: Lesson[]`, `learn(game, ids)`), `src/core/campaign.ts` (`Lesson`)
- Modify: `src/ui/battleFlow.ts`
- Test: `tests/ui/lessons.test.ts`

**Interfaces:**
- Produces: `export type Lesson = 'momentum' | 'rout'` (campaign.ts); `FlowOptions.lessons?: Partial<Record<Lesson, TalkLine>>` (what this pilot has not been told); `BattleFlow.taught: Lesson[]` (what was said in this battle, in order); `learn(game: GameState, ids: Lesson[]): GameState` (adds what is new, same object when nothing is).

- [ ] Tests: the momentum line is said when the menu comes back after a kill that readied a weapon, before the bar's "ready again"; not said when the kill ended the battle, left the weapon empty, or was made by Auto Turn; not said when `quiet`; not said twice in one battle; rout line said while a machine that lost its nerve still stands; both in one volley come in the order momentum, rout; `taught` lists exactly what was said.
- [ ] Implement in `moments()`: lessons come before the round's lines and the `last`/`hurt` moments.
- [ ] `learn` and its tests in `tests/core/game.test.ts`.

### Task U1.2: lessons in the app

**Files:**
- Create: `LESSONS` in `src/content/drills.ts` (Dispatch, with his portrait), registered for translation in `src/content/nl/index.ts`, Dutch in `src/content/nl/missions.ts`
- Modify: `src/ui/app.ts` (`MissionHost.begin` passes the lessons not yet in `game.lessons`, for a contract only; `update` saves what `flow.taught` has gained)
- Test: `tests/ui/lessonsApp.test.ts`, `tests/content/dutch.test.ts` (covered by the kind `battle.talk`)

- [ ] Tests: a new game's first contract says the momentum line after the first drone falls and the kept game holds `lessons: ['momentum']` at once; the next contract does not say it; a drill and a Gauntlet floor never say one; a game kept without `lessons` hears it.
- [ ] Each line wraps to at most `TALK_LINES` rows of `TALK_CHARS`, in both languages.

### Task U1.3: two drills

**Files:**
- Modify: `src/core/training.ts` (`Drill.open?: true`; `drillMission` closes the battle unless the drill is open)
- Modify: `src/content/drills.ts` (`drill-momentum`, `drill-swarm`), `src/content/nl/missions.ts`
- Modify: `tests/core/training.test.ts`, `src/ui/trainingScreen.ts` (comment), `docs/handleiding.md`

**Values (measured, 60 battles each):**
- `drill-momentum` "Follow Through", lesson "Momentum and rout", after `intro-2`, scale 1.5, open. Build: `head-wraith`, `core-ronin`, `arms-wraith`, `legs-ronin`, `gen-prism`, `bst-stock`, `fcs-tracer`, right hand `wpn-rail-lance`. Enemies `heavy-mech`, `recon-drone`, `recon-drone`. Auto Turn passes 58; with the battle closed 0; firing at the first machine 15.
- `drill-swarm` "The Nest", lesson "A swarm", after `intro-2`, scale 1, open. Build: full Ronin, `gen-tidal`, `bst-stock`, `fcs-omni`, right hand `wpn-rail-lance`, shoulder `wpn-micro-salvo`. Enemies `recon-drone`, `bomb-crawler`, `recon-drone`; reserve `recon-drone`, `recon-drone`, `bomb-crawler`, `recon-drone`, `recon-drone`. Auto Turn passes 60 in about four rounds.

- [ ] Tests: thirteen drills; the two are open and the eleven are not; `drill-momentum` passed at least nine times in ten by Auto Turn, never with its battle closed, at most four in ten by a pilot who fires at the first machine; the lance's aiming line promises DESTROYS on both drones and not on the enforcer; `drill-swarm` passed nineteen in twenty, with eight machines in all; the eleven old drills' fingerprints unchanged.
- [ ] The guide: "Dertien oefeningen", and where the rules are learnt.

### Task U1.4: all green, APK

- [ ] `tsc`, the whole unit suite, both halves of the browser tests (new screenshots of the two drills and of a lesson line), commit, push, draft PR, APK.

### Task U3: the testers' findings

- [ ] Read all four `findings.md`. For each finding: reproduce it (the picture, then the game), decide (mend / leave with the reason), group by what mends it.
- [ ] Mend worst first, one group at a time, each with a test that fails before and passes after.
- [ ] Write "What the testers found, and what it changed" in the spec.
- [ ] An APK after each group that a player would notice.

### Task U4: final check

- [ ] Small faults put into the new code one at a time (mutation), the gaps closed.
- [ ] `tsc`, the whole unit suite, both browser halves, the five-minute soak of all six setups.
- [ ] Draft PR, last APK, a short Dutch summary.
