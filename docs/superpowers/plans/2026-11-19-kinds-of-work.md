# Kinds of Work Implementation Plan

**Goal:** A fourth open contract beside the board's three and the swarm that asks for something other than everything destroyed: a hit, a repossession, an escort or a holding action, turning in order, each measured so that the class flown matters.

**Architecture:** A new rules file, `src/core/jobs.ts`, makes the job from the pilot's progress as `board.ts` makes the board and the swarm: a pure function, on dice of its own, from the same `BoardText`. A job is an ordinary `Mission` of one battle that carries its kind (`job`); what it asks is an `Objective` the battle rules already have, with marks, a reserve and a scale where the kind wants them. The app lists it between the board and the swarm and counts a won one by its kind in the kept game. Nothing in `battle.ts` changes.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-kinds-of-work-design.md`

## Global Constraints

- No rule of combat changes; the board's three contracts, the swarm and the patrol are what they were for every progress a pilot can have.
- A kept game loads and is as it was; the count of jobs won is a field a kept game may lack.
- Every new English text has its Dutch, inside the room its kind has: a title eighteen letters, an asset twelve, an interface string at most two letters longer than the English.
- The targets the numbers are set to: no class under one win in three on Standard at the stage it meets a job; no kind on which every class wins nine in ten on Veteran; pay for a round of fighting, over the classes and the stages together, within half as much again of the board's own contracts.
- Nothing is merged without the owner's word.

## Review Focus

- Every progress a pilot can have (battles won 0 to 400, cycles 0 to 3): the job is one the rules take (a hit has two machines or more and names the dearest; a repossession names a machine with arms and legs; an escort's freight starts with something to lose; a holding action's rounds are a number a battle can last), and below the first tier there is none.
- A repossession whose machine is destroyed, by the pilot or by anything else on the pilot's side: lost, and said to be lost for that.
- A holding action in which everything is destroyed before the rounds are up, reserve included: won.
- A job with the pilot's own mech unable to deploy: not offered (only the lent patrol is).
- A kept game from before the round: loads, and its first job won is counted.

---

### Task W1: the rules

**Files:** `src/core/jobs.ts` (new), `src/core/campaign.ts`, `src/core/game.ts`, `src/core/board.ts` (exports only), `src/content/board.ts`, `scripts/jobs.ts` (new), `tests/core/jobs.test.ts` (new), `tests/content/jobs.test.ts` (new), `tests/core/game.test.ts`

**Interfaces:**

- `type JobKind = 'hit' | 'repo' | 'escort' | 'hold'`; `JOB_KINDS: JobKind[]` in that order; `JOB = 'job'`; `JOB_TIER = 1`.
- `isJob(mission: Pick<Mission, 'id'>): boolean`: an open contract whose id ends in `-job`.
- `jobKind(battlesWon: number, cycle: number): JobKind`: `JOB_KINDS[(battlesWon + cycle) % 4]`.
- `jobContract(battlesWon: number, cycle: number, text: BoardText): Mission | null`: null below `JOB_TIER`; else a mission with id `open-<cycle>-<battlesWon>-job`, `phase: 'patrol'`, `job`, one battle, `scale`, `reward`.
- `Mission.job?: JobKind`.
- `BoardText.jobs: Record<JobKind, { titles: string[]; brief: string }>`; `BoardText.assets: string[]` (one for each background, same order).
- `GameState.jobs?: Partial<Record<JobKind, number>>`; `jobsWon(game, kind?): number`; `kindsOfJob(game): number`; `recordJob(game, kind)`.
- The numbers, exported by name with a comment that says what measurement set them: the hit's scale and pay, the freight's armour, the holding action's rounds, budget, reserve and scale, each kind's pay.

**Steps:**

- [x] `scripts/jobs.ts`: every kind at tiers 1 to 8, flown by each class's build for the stage on Auto Turn on both difficulties: wins, rounds, and what a round of it pays against the board's own. Set the numbers from it.
- [x] The generator, with tests: pure; null below the tier; the kinds in turn; for every progress a job the rules take (the Review Focus's first line, by starting the battle); the board and the swarm beside it unchanged.
- [x] The count in the kept game, with tests: recorded by kind, read, valid and invalid shapes, a kept game without it.
- [x] How hard, as tests that hold the numbers to the targets (fewer flights than the script, the same builds).
- [x] Mutation over the step.

### Task W2: in the game

**Files:** `src/ui/app.ts`, `src/ui/briefingScreen.ts`, `src/content/strings.ts`, `src/content/medals.ts`, `src/content/codex.ts`, `src/content/nl/*`, `tests/ui/jobs.test.ts` (new), `tests/content/claims.test.ts`, `tests/ui/draw.test.ts`, `e2e/jobs.spec.ts` (new), `docs/handleiding.md`, `README.md`

**Interfaces:**

- `App.missions()`: the job after the board's three and before the swarm, when side work is open and there is one.
- `App.bookSettlement`: a won job is recorded by its kind.
- Briefing: headed `STRINGS.briefing.jobs[kind]`; the objective lines as they are.
- Medals `job-each` (one of each kind) and `job-25` (twenty-five jobs).
- Manual chapter `jobs` after the chapter on the board.

**Steps:**

- [x] The job on the list and at the briefing: tests with the drawn pages, each kind, both languages.
- [x] Each kind flown in the app to its end, won and lost: the hit over when its machine falls; the repossession lost when its machine is destroyed; the escort lost with the freight; the holding action won at its round and won early with nothing left. What the result says each time.
- [x] Booked: counted by kind, the medals, a kept game from before.
- [x] The manual and the claims that hold it to the rules; Dutch; the guide.
- [x] Browser test with pictures. Mutation over the step. APK.

### Task W3: final check

- [ ] Read through once more; the soak; the last APK; a short Dutch summary.
