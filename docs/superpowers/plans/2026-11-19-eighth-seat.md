# The Eighth Seat Implementation Plan

**Goal:** An eighth duel on the masters' page that opens with all seven crowns, against a machine that fights three ways; its frame, the Sovereign, on sale to the pilot who wins; and the seat seen wherever a crown is.

**Architecture:** The seat is a small module of its own beside the masters (`src/core/seat.ts`): whether it is open (seven crowns), whether it is held (`GameState.seat`), the duel as a contract, and the win written down. Its keeper is content (`src/content/seat.ts`): one enemy built from the Sovereign's parts with two boss phases, fielded through `ALL_ENEMIES` like a master. The frame is four parts in the catalogue with twelve pictures from the art pipeline, sold on a new condition, `seat`. The arena screen's masters' list gains a row that is not a class; the app opens, flies and settles the duel as it does a master's.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright; the art scripts in `scripts/art` (image service through the proxy, lowest quality only); `scripts/masters.ts` for measurement.

**Spec:** `docs/superpowers/specs/2026-11-19-eighth-seat-design.md`

## Global Constraints

- No rule of combat changes, and no balance test of what exists changes.
- Images at quality `low` only; the ledger's ceiling holds; the proxy's address and key are never written into the repository.
- Every new English text has its Dutch, inside the room its kind has; names (Touchstone, Sovereign) stay as they are.
- A kept game from before this round loads as it was, with no seat.
- The Sovereign is sold only with the seat held, in every telling.
- Nothing is merged without the owner's word.

## Review Focus

- A kept game whose `seat` is anything but `true` (a string, a number, `false`): loaded without a seat, and without an error.
- Seven crowns held and one master not beaten in anything else, or `crowns` naming a class twice or a class this version does not know: the seat opens on seven different known classes and on nothing less.
- The seat won a second time: paid a quarter, nothing said to be taken, nothing written twice.
- A pilot who holds the seat and starts a new telling: the seat, the paint and the Sovereign's place in the shop are kept.
- The duel lost, or left by defeat in a later phase: no seat, no parts in the shop, the row still open.

---

### Task E1: the Sovereign

**Files:** `scripts/art/jobs.ts`, `art/raw/*`, `public/sprites/*`, `src/content/sprites.json`, `art/ledger.json`, `src/content/parts.ts`, `src/core/campaign.ts` (the condition), `src/core/game.ts` (the field), `src/core/seat.ts` (new: held), tests beside each

**Interfaces:**

- `GameState.seat?: true`, validated on load (anything else is dropped).
- `seat.ts`: `seatHeld(state: Pick<GameState, 'seat'>): boolean`.
- `Condition` `'seat'`: reached when the seat is held; `stockFor` treats it as earned (never kept by a vendor's memory).
- Parts: `head-sovereign` (Sovereign Crest), `core-sovereign` (Sovereign Core), `arms-sovereign` (Sovereign Arms), `legs-sovereign` (Sovereign Legs); vendor `freelance`; `SHOP_UNLOCKS[...] = 'seat'`.
- `FramePart.bespoke?: true`: built to order, never offered by the Gauntlet. `OWN_COLOURS` in `scripts/art/jobs.ts`: colours a family has beside the shared palette.
- Art: `family('sovereign', …)`, `layersOf`, `backFamily`, `backLayersOf` as the Shrike and the Sterling have; the design's words in `DESIGNS.sovereign`.

**Steps:**

- [x] The design's words; the twelve jobs; generate at `low`; process; look at the machine put together from the front and from behind, in factory colours and in two paints; redo what does not read.
- [x] The four parts with first figures (a little above the Auditor in armour, mobility 36, a field of 20 in the core, poise in the arms, aim 20 and 14, the highest drain and price of any frame and a weight only the Colossus passes): tests that it is the dearest frame, that a late build in it stands and is of the class its weapons make it, and that on its own legs with plain guns it is an all-rounder and never a skirmisher.
- [x] `GameState.seat`, `seatHeld`, the condition, the unlock: tests that the shop has no Sovereign without the seat in a first telling and in a later one, and has all four with it; that a kept game with a wrong `seat` loads without one.
- [x] Colours of its own beside the shared palette (`OWN_COLOURS`), so that it is violet and no other picture changes; built to order (`FramePart.bespoke`), so that the Gauntlet's salvage does not turn it up and that mode's measure stands.
- [x] Mutation over the step. APK.

### Task E2: the duel

**Files:** `src/core/seat.ts`, `src/content/seat.ts` (new), `src/content/arena.ts` (`ALL_ENEMIES`), `src/ui/arenaScreen.ts`, `src/ui/app.ts`, `src/ui/briefingScreen.ts`, `src/ui/soundtrack.ts`, `src/ui/settlementScreen.ts`, `src/core/economy.ts` (the bill's word), `src/content/strings.ts`, `src/content/nl/*`, `scripts/masters.ts`, tests beside each, `e2e/seat.spec.ts`

**Interfaces:**

- `seat.ts`: `SEAT_ID = 'arena-seat'`, `SEAT_PURSE = 15000`, `seatOpen(state): boolean` (seven crowns), `seatPurse(state): number`, `isSeat(mission): boolean`, `interface Keeper { name; build; paint; scale; plating?; style; taunt; concede; phases: BossPhase[] }`, `keeperEnemy(keeper): EnemyDef`, `seatMission(state, keeper, text): Mission`, `recordSeatWin(state)`, `seatSettlement(settlement, mission, state): Settlement` (adds `seated: true` to a first win).
- `content/seat.ts`: `KEEPER: Keeper` (Touchstone), `SEAT_ENEMIES: Record<string, EnemyDef>`.
- `Settlement.seated?: true`.
- `ArenaScreen`: the masters' list has `ARCHETYPES.length + 1` rows, the last with id `SEAT_ID`; its snapshot says `seat: { state: 'locked' | 'open' | 'held'; crowns: number } | null` when the cursor is on it.
- `App.openSeatBriefing(): void`.

**Steps:**

- [x] The rules: open on seven crowns, the purse, the contract, the win written once: tests, with the Review Focus's lines.
- [x] Touchstone: the build, the two changes (at two thirds and at one third of the core) with their weapons, flying and lines; the measurement added to `scripts/masters.ts`; scale set by it (0.8, no plating; the first loadout a charging rail with a howler, which is what keeps a marksman's own charges from deciding it); tests that hold the measure as ranges and that the duel does not drag.
- [x] The row, the panel under it and the picture; the briefing with its tag and no line that asks for a class; the bill and its word; back to the row from the briefing: tests on the recorded canvas and through the app, in both languages. (The duel is fought to the boss's song, as every fight with a machine that changes is: nothing was added for it.)
- [x] Browser test with pictures: the row locked, open, the briefing, each of the three ways on the field, the bill, the row held. Mutation over the step. APK.

### Task E3: what the seat gives

**Files:** `src/ui/paint.ts`, `src/ui/garageFlow.ts` (if the paint list needs it), `src/ui/pilotScreen.ts`, `src/content/medals.ts`, `src/content/missions.ts` (messages), `src/core/campaign.ts` (`crowns:N`), `src/content/codex.ts`, `src/content/nl/*`, `docs/handleiding.md`, `README.md`, tests beside each

**Interfaces:**

- `paint.ts`: `SEAT_PAINT: PaintScheme` (id `touchstone`), in `paintsFor` after the crowns' paints when the seat is held, found by `paintById`.
- `Condition` `'crowns:N'`.
- Medal `seat` (tier 3); messages `seat-open` (after `crowns:7`) and `seat-yard` (after `seat`); a toast when the seat is taken.
- The manual's chapter on the masters says what the eighth row asks and what it gives.

**Steps:**

- [ ] The paint and who may wear it; the pilot's page; the toast: tests.
- [ ] The medal, the two messages, the manual, Dutch, the guide and the README: tests and claims.
- [ ] Mutation over the step.

### Task E4: final check

- [ ] Read through once more; all tests; the soak with a pilot who holds seven crowns and takes the seat; the last APK; a short Dutch summary.
