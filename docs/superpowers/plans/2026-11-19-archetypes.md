# Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three ways to start, two frames for the end of the game, and archetypes the game knows by name.

**Architecture:** New frames are new parts in the catalogue with their own drawings, made by the art pipeline the other frames came from (one drawing of the whole frame in the shared pose, cut into five layers, the same from behind). The starter is a choice on a screen of its own between the callsign and the story. An archetype is a pure function of a build.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright; `scripts/art` for the drawings.

**Spec:** `docs/superpowers/specs/2026-11-19-archetypes-design.md`

## Global Constraints

- No existing part changes; a kept game loads and is as it was.
- `STARTER_BUILD` stays the Hauler: everything that lends the starter frame (the patrol in a lent mech, the Gauntlet, the drills) lends that.
- Every new English text has its Dutch, inside the room its kind has.
- Images: low quality only, through `scripts/art/generate.ts`, the address of the proxy never written into the repository, every image in the ledger.
- No balance test of the story changes; new frames are measured against `verdict-*`, `audit-3` and the back room before they are priced.
- Nothing is merged without the user's word.

## Review Focus

- A new game started by pressing A through everything (the tests' way, and a hurried player's): it gets the Hauler, as before.
- B on the starter screen: back to the callsign with the name as it was typed.
- A starter whose legs carry less than its kit weighs: no kit may start overweight or short of energy.
- The two starters not taken: in the shop from the first visit, and their layers fit on each other and on every other frame (the pose is shared).
- A kept game from before this round: loads and is as it was (no field is added: the frame chosen is only the build and the credits a game begins with).

---

### Task B1.1: the parts and the kits

**Files:** `src/content/parts.ts`, `src/content/starters.ts` (new), `tests/content/starters.test.ts` (new)

**Values:** as the spec's table. Parts: `head-courier` (AP 40, aim 10, weight 30, drain 20), `core-courier` (155, weight 190, drain 55), `arms-courier` (75, aim 6, weight 90, drain 35), `legs-courier` (105, weight 150, drain 50, capacity 800, mobility 40), resists kinetic/energy/explosive 0.05/0.12/0.05 (core 0.1/0.12/0.1), vendor lumen; `head-dozer` (75, aim 8, weight 60, drain 15), `core-dozer` (275, weight 380, drain 60), `arms-dozer` (135, aim 5, weight 180, drain 40), `legs-dozer` (195, weight 300, drain 50, capacity 1400, mobility 18), resists 0.2/0.12/0.15 (core 0.25/0.12/0.15), vendor hadron; `shd-plate` Scrap Plate (guard 0.5, weight 80, vendor hadron). All 300 credits, none in `SHOP_UNLOCKS`.

**Produces:** `export interface Starter { id: 'hauler' | 'courier' | 'dozer'; name: string; role: string; text: string; build: Build; credits: number }`, `export const STARTERS: Starter[]` (Hauler first), `starterOf(id)`.

- [x] Tests: each kit deploys (`validatePlayerBuild` empty), guns plus credits come to 1500, the Hauler's kit is `STARTER_BUILD` with 1200; over 60 battles each kit wins the patrol and both introductions at least 57 times; with its first purchases (Hauler: pistol and mortar; Courier: rifle; Dozer: pistol in place of the plate, and mortar) each wins `hadron-1`, `lumen-1`, `undertow-1` at least 51 times of 60; no kit is best at all three of those as it comes; every part of the two new frames is below the same part of Halo and Bulwark in armour.

### Task B1.2: the drawings

**Files:** `scripts/art/jobs.ts` (designs `courier`, `dozer`; their family, layers, back family, back layers; the shield), `art/raw/*`, `public/sprites/*`, `src/content/sprites.json`, `art/ledger.json`

- [x] Generate (`--only` the new ids), process, look at every new picture and at the three frames composed in the garage and from behind; redo a layer that came away wrong (`--force`).
- [x] The manifest test (`tests/art` and the sprite tests) passes: every part id has its sprite in every view it is asked for.
- [x] The Dozer's arms from behind hang lower than the shared pose: `FISTS` in `scripts/art/process.ts` names where their hands are, `fistOf` in `src/ui/mechLayout.ts` holds what they carry there.

### Task B1.3: the screen and the flow

**Files:** `src/ui/starterScreen.ts` (new), `src/ui/app.ts` (`'starter'` screen; `chooseStarter(slot, callsign)`; `startNewGame(slot, callsign, starter = 'hauler')`), `src/ui/callsignScreen.ts` (OK goes to the starter screen; an initial name), `src/content/strings.ts`, `src/content/nl/strings.ts`, `src/content/nl/missions.ts` or `reference.ts` for the kits' texts, `e2e/helpers.ts` (`enterHub` presses through `starter`), `tests/helpers/app.ts` (`skipScenes` likewise), `scripts/careerBot.ts`

- [x] Tests (`tests/ui/starter.test.ts`): callsign → starter → hub with the kit's build, inventory and credits; pressing A through gives the Hauler with 1200; B goes back to the callsign with the name kept; the snapshot names the frame under the cursor; every text fits (three rows of the detail panel, the list's notes); Dutch.
- [x] Browser test (`e2e/archetypes.spec.ts`): a picture of the screen with each frame under the cursor (`starter-hauler`, `starter-courier`, `starter-dozer`), a new game in the Courier flown through the first contract.
- [x] The guide: the first quarter of an hour begins with the choice.

### Task B1.4: all green, APK

- [ ] `tsc`, unit suite, both browser halves, mutation on the new code, commit, push, draft PR, APK.

### Task B3: Sterling and Shrike

- [ ] Parts, drawings, the two rules (a field on the core that renews each round; a blade's strike that keeps the boost), where they are sold and who flies them, each measured against the verdicts, `audit-3` and the back room before it is priced. Detailed when B1 is in.

### Task B2: archetypes

- [ ] `archetypeOf(build, catalog)`, the garage's line, the record's count and the medals, a reference build for each kind at three stages, the whole story measured for each. Detailed when B3 is in.

### Task B4: final check

- [ ] Mutation over the round, the soak, the last APK, a short Dutch summary.
