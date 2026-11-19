# Freight on the Field Implementation Plan

**Goal:** What an escort keeps alive stands on the field as a picture of its own, and what happens to it is seen on it: struck as a round begins, smoking when it is nearly gone, coming apart when it is lost.

**Architecture:** A `protect` objective may name a sprite; `createBattle` carries it on the battle's `asset`. The stage gains one spot for freight (on the far line, left of the enemy's line), the battle screen draws it there before the enemies and the pilot's mech, and the battle's effects turn the `asset` event the rules already send into a jolt, a flash, sparks and a figure at that spot. Seven sprites are made by the art pipeline as a new kind, `asset`. A battle whose freight names no sprite is drawn exactly as before.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright; the art scripts in `scripts/art` (image service through the proxy, lowest quality only).

**Spec:** `docs/superpowers/specs/2026-11-19-freight-on-field-design.md`

## Global Constraints

- No rule of combat changes: the freight loses what it lost before, when it lost it.
- A battle without a sprite for its freight (and every battle without freight) is drawn pixel for pixel as it was.
- In a calm picture the field does not shake and nothing flashes hard (the freight flinches and is lit gently, as a machine that is hit is there); a hurried screen waits for nothing.
- Images at quality `low` only; the ledger's ceiling holds; the proxy's address and key are never written into the repository.
- Every new English text has its Dutch, inside the room its kind has.
- Nothing is merged without the owner's word.

## Review Focus

- Every line-up the board fields for an escort (one, two or three machines, a mech of the largest size among them) and both story escorts: the freight's box does not cover an enemy's box by more than a few pixels, and is inside the field.
- A battle whose freight has no sprite, and a kept battle from before: drawn as before, no error.
- The freight lost in the same moment the last enemy falls, and freight that loses nothing in a round (no enemy standing): no jolt, no figure.
- A sprite id that is not in the sprite sheet: the placeholder the sprite store gives, not a crash.
- The camera pushed in on a blow while the freight is struck: the figure is still written where the freight is.

---

### Task V1: the pictures and the names

**Files:** `scripts/art/jobs.ts`, `scripts/art/process.ts` (the new kind's box), `art/raw/*`, `public/sprites/*`, `src/content/sprites.json`, `art/ledger.json`, `src/core/types.ts`, `src/core/battle.ts`, `src/core/jobs.ts`, `src/content/board.ts`, `src/content/missions.ts`, tests beside each

**Interfaces:**

- `Objective` of type `protect`: `sprite?: string`. `Asset`: `sprite?: string`, copied from the objective when the battle is made.
- `JobText.assetSprites: string[]`: one for each background, same order as `assets`.
- Sprite ids: `asset-wage-truck`, `asset-ore-lift`, `asset-motorcade`, `asset-pump-barge`, `asset-convoy`, `asset-ore-train`, `asset-core-stack`; art kind `asset`, box 56 by 38.

**Steps:**

- [x] The seven jobs in `scripts/art/jobs.ts` and the kind's box; generate at `low`; process; look at each at the game's size and redo what does not read.
- [x] The objective and the asset carry the sprite: tests in the rules (made with one, made without, a later telling's tougher escort keeps it).
- [x] The board's escorts, the story's two and the convoys name theirs: tests that every escort there is names a sprite that is in the sheet, and that the hangar and a wingman's frame name none.

### Task V2: on the field

**Files:** `src/ui/stage.ts`, `src/ui/battleScreen.ts`, `src/ui/battleFx.ts`, `src/content/codex.ts`, `src/content/nl/*`, tests beside each, `e2e/freight.spec.ts`, `docs/handleiding.md`, `README.md`

**Interfaces:**

- `stage.ts`: `freightSpot(place: Place): Spot` and `freightAt(spot, size): Standing`.
- `BattleFx`: the `asset` event with a sprite on the field is a jolt and a flash of the freight, sparks and the figure at it; without one, the figure under the strip as before.
- `BattleScreen`: draws the freight and its shadow before the enemies; smoke from a third down; breaking when lost.
- `BattleFlow.assetLeft: number | null`: what is left of the freight as far as the message bar has said; the strip's count and meter use it.

**Steps:**

- [x] Where it stands, with tests over every line-up (the Review Focus's first line).
- [x] Drawn with its shadow; not drawn without a sprite: tests on the recorded canvas, a battle with and one without, calm and hurried.
- [x] Struck, smoking, lost: tests of what is drawn and written as the events come, and in a calm picture.
- [x] What is left of it goes by what the message bar has said (`BattleFlow.assetLeft`): the strip, the smoke and the picture are not a message ahead of the blow. A round that took nothing is no blow and no line.
- [x] The manual's line on objectives, Dutch, the guide.
- [x] Browser test with pictures in each place. Mutation over the step. APK.

### Task V3: final check

- [x] Read through once more; the soak; the last APK; a short Dutch summary. (Browser tests added for the freight the others did not come to: the core stack in the vault, the favour's convoy in the sluice, the drill's convoy in the hall.)
