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

**Files:** `src/core/types.ts` (`FramePart.field`, `FramePart.poise`, `Abilities.field`, `EnemyDef.plating`), `src/core/battle.ts` (`fieldOf`, the field raised at a unit's own turn and down a round once broken, events `fieldDown`/`fieldUp`, a blade's strike and the boost), `src/core/campaign.ts` (`won:contract`), `src/core/board.ts`, `src/content/parts.ts` (eight parts, unlocks), `src/content/enemies.ts` (`larder`, `argent`), `src/content/sidework.ts` (`DUELS`), `src/content/codex.ts`, `src/content/nl/*`, `src/ui/partInfo.ts`, `src/ui/battleFlow.ts`, `src/ui/battleFx.ts`, `src/ui/battleScreen.ts`, `src/platform/audio.ts`, `scripts/art/jobs.ts`

- [x] The two rules, with tests (`tests/core/frameRules.test.ts`): the field stands when a battle opens, takes a hit before the armour, is whole again at the unit's own turn while any of it stands, and stays down a round once broken; the first blade of a turn keeps the boost from arms with poise, a second gives it up; an enemy plated beyond its parts; an enemy tuned to raise a field.
- [x] Parts measured against `audit-3`, both verdicts (also in a second telling) and the back room, in whole frames and mixed onto a Wraith and a Colossus, before they were priced.
- [x] Drawings: both frames from the front and from behind, two portraits. Heads and bodies from behind redone with their own descriptions.
- [x] The duels: two contracts once the audit is over, one at a time; a duel won opens its frame for good (`tests/content/duels.test.ts`).
- [x] How a field is shown, said and heard (`tests/ui/field.test.ts`); a part's own lines; Dutch.
- [x] Browser test with pictures; the guide; mutation (a hundred faults: ninety-eight found once seven tests were added, two in figures nothing reads); APK.

### Task B2: archetypes

**Files:** `src/core/archetype.ts` (`ARCHETYPES`, `archetypeOf`, `wonAs`, `kindsWon`, `mostWonAs`, `recordWinAs`, `adviceFor`), `src/core/game.ts` (`wonAs`, checked on loading), `src/content/archetypeBuilds.ts` (`ARCHETYPE_BUILDS`, `STAGES`, `STAGE_BUDGET`), `src/content/medals.ts` (three medals), `src/content/strings.ts` and `nl/` (`classes`), `src/ui/pilotScreen.ts` (the page), `src/ui/garageScreen.ts` (the line), `src/ui/app.ts` (the count), `scripts/careerBot.ts` (`ladder`, `wonAs` in the report)

- [x] The rule, with tests (`tests/core/archetype.test.ts`): seven kinds in order, each rule and what it yields to, the legs as sold, that no part of no consequence changes the name, the count and its check on loading.
- [x] Builds measured for each kind at three stages; the ones chosen held to their stage (`tests/content/archetypeBuilds.test.ts`) and flown through whole careers (`tests/scripts/kinds.test.ts`).
- [x] The page, the garage's line, the count and the suggestion (`tests/ui/classes.test.ts`), in both languages.
- [x] The medals' tests, the browser test with pictures, the guide and a chapter of the manual, mutation (a hundred and twenty-six faults, all found once the Dutch rules and what each build costs were pinned), APK.

### Task B4: final check

- [ ] Mutation over the round, the soak, the last APK, a short Dutch summary.
