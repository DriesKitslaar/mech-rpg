# Own Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pilot mixes a paint of their own on a page of the garage, keeps three, and wears one wherever the machine is shown.

**Architecture:** A mix is five whole numbers and the slot it is kept in; its name as a paint carries them (`mix1-14-3-2-13-2`), so everything that is handed a paint can colour a machine with it and nothing that draws needs the game. The grammar and the steps are rules without colour (`src/core/mix.ts`); what colours the steps are is the screen's (`src/ui/paint.ts`). The garage's flow gets a third page; the sprite store forgets the pictures of mixes it has not been asked for lately.

**Tech Stack:** TypeScript, Canvas 2D at 310 x 270, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-own-colours-design.md`

## Global Constraints

- Steps: armour 24, finish 4, shade 5, trim 24, glow 3. Three kept mixes: `MIX_SLOTS = 3`.
- A mix's name as a paint: `mix<slot 1-3>-<armour>-<finish>-<shade>-<trim>-<glow>`, each a whole number in its range, written without leading zeros. Anything else is no mix.
- The values behind the steps stay within what the ready paints use: armour saturation 0.08 to 0.8, shade -0.16 to 0.2, trim saturation 0.55 to 0.95.
- Untouched, the three are: white with cyan lights, black with red, navy with gold.
- A paint the game does not know is worn as factory colours, as now; a kept game is never refused for it.
- The pictures of at most four mixes are kept: `MIX_KEPT = 4`.
- The garage's pages stand in a ring, PAINT, PARTS, BUILDS: left and right go round it.
- Every new text has its Dutch; interface strings at most two letters longer than the English.
- No rule of combat and no number changes.

## Review Focus

- A kept game whose paint or kept mixes are not right (a step out of range, a slot that does not match its place, a list of the wrong length, something that is no text): opens, wears factory colours or the three as they come, and does not crash.
- Trying a hundred mixes in a row: the store holds the pictures of four, and none of a ready paint is ever forgotten.
- A mix worn in the hangar, from behind in a battle and in the launch: coloured, not as drawn. And a dark mix against a copy of itself: the copy is not in a paint as dark.
- L1 and R1 on the parts page, which went through twelve paints and back to factory colours: through the three mixes as well, without changing one.
- The rows of the paint page in Dutch; and a pilot on a row that is dim pressing L1: nothing changes and nothing is kept.

---

### Task C1: a mix as a paint

**Files:**
- Create: `src/core/mix.ts`, `src/ui/paintedCache.ts`, `tests/core/mix.test.ts`, `tests/ui/paintedCache.test.ts`
- Modify: `src/core/game.ts` (`GameState.mixes`, what is checked of `paint` and `mixes`), `src/ui/paint.ts` (`schemeOfMix`, `paintById`, `paintsFor`), `src/ui/sprites.ts` (the cache), `tests/ui/paint.test.ts`, `tests/core/game.test.ts`, `tests/ui/garageFlow.test.ts` (the order of the paints)

**Interfaces:**
- `src/core/mix.ts`:
  - `MIX_SLOTS = 3`, `MIX_STEPS = { hue: 24, finish: 4, shade: 5, trim: 24, glow: 3 }`, `MIX_KEYS: MixKey[]` in that order.
  - `interface Mix { slot: number; hue: number; finish: number; shade: number; trim: number; glow: number }`
  - `mixId(mix: Mix): string`, `parseMix(id: unknown): Mix | null`, `isMix(paint: unknown): boolean`
  - `DEFAULT_MIXES: Mix[]` (three, slots 1 to 3)
  - `mixesOf(state: Pick<GameState, 'mixes'>): Mix[]` (three: what is kept where it is right, else as they come)
  - `stepMix(mix: Mix, key: MixKey, step: number): Mix` (round and round)
  - `setMix(state: GameState, mix: Mix): GameState` (kept in its slot, and worn)
  - `likenessPaint(paint: string): string` (what a copy of the pilot's own machine wears against it: `obsidian`, or `bone` where the pilot's is obsidian or a mix of the two darkest shades)
- `GameState.mixes?: string[]`.
- `src/ui/paint.ts`: `MIX_FINISH: number[]` (4), `MIX_SHADE: number[]` (5), `MIX_GLOW: number[]` (3), `schemeOfMix(mix: Mix): PaintScheme` (its id is `mixId(mix)`, its name `Mix <slot>`); `paintById` knows a mix; `paintsFor(state)` ends with the three.
- `src/ui/paintedCache.ts`: `MIX_KEPT = 4`, `class PaintedCache<T> { constructor(kept: number, passing: (paint: string) => boolean); get(sprite: string, paint: string, make: () => T): T; size: number }`.

**Steps:**

- [x] The rules of a mix with their tests: the grammar both ways, every name that is no mix, the steps going round, the three as they come, what a game keeps and what it makes of a list that is not right.
- [x] What is checked of a kept game: a mix worn, three kept; a game from before the round; one with a paint or a list that is not right. Tests.
- [x] The colours: `schemeOfMix` for every step within the ready paints' range, white and black where the spec says, the name; `paintById` and `paintsFor`. Tests.
- [x] The cache with its tests, and the sprite store using it.
- [x] Through the game: a mix worn in the hangar, from behind in a battle and in the launch is coloured (the store is asked for that paint). Tests.
- [x] Mutation over the step.

### Task C2: the paint page

**Files:**
- Modify: `src/ui/garageFlow.ts` (the page, the ring), `src/ui/garageScreen.ts` (drawing it), `src/content/strings.ts`, `src/content/nl/strings.ts`, `src/content/medals.ts`, `src/content/codex.ts`, `src/content/nl/reference.ts`, `docs/handleiding.md`, `README.md`, `tests/ui/garageFlow.test.ts`, `tests/content/docs.test.ts`, `e2e/soak.spec.ts`
- Create: `tests/ui/paintPage.test.ts`, `e2e/paint.spec.ts`

**Interfaces:**
- `GarageFlow.mode` gains `'paint'`; `GarageFlow.paintRows: MenuList` (ids `paint`, then `MIX_KEYS`); `GarageFlow.mix: Mix | null` (the mix worn, when it is one).
- The garage's snapshot gains `mix: Mix | null`.
- `STRINGS.garage.mixer = { heading, change, rows: { paint, hue, finish, shade, trim, glow }, finish: string[4], shade: string[5], glow: string[3], ready, yours }`, and `STRINGS.garage.pages = { slots, paint }`: what the foot of the parts and of the paint page say of which way the other pages are.
- `src/ui/paint.ts`: `mixSwatches(mix: Mix, key: MixKey): string[]` (the colours of a row's steps, as `#rrggbb`); `src/ui/garageScreen.ts`: `MIX_PAGE` (where the page's heading, rows, strips and the line under them stand).
- A medal `mixed` (tier 1): wear a mix.

**Steps:**

- [x] The ring and the page in the flow: left and right from each of the three, up and down the rows, L1 and R1 on each row, the dim rows, what is kept. Tests.
- [x] Drawing it: the rows, the strips in the colours they would give, the mark on the chosen step, the names, the line under them; nothing over anything, in both languages. Tests.
- [x] The words, the medal, the manual's chapter and the garage's own, the guide, the README: with claim tests.
- [x] In a browser: the page in both languages, a white machine in the hangar, behind it in a battle and in the launch; every other browser test still passing.
- [x] Mutation over the step.

### Task C3: final check

- [ ] Read through once more; all tests; the soak with a player in a mix; the last APK; a short Dutch summary.
