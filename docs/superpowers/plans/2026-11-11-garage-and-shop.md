# Garage and Shop Implementation Plan (plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable loop on the handheld: start or continue a game, buy and sell parts, assemble the mech in the garage, fight, get paid, and have all of it saved.

**Architecture:** A pure `GameState` (credits, owned parts, current build) with rule functions in `src/core`. Each screen is a small flow class without drawing (unit-tested) plus a drawing class, switched by an `App`. Storage is injected so saving is testable.

**Tech Stack:** unchanged (TypeScript, Vite, Vitest, Playwright, Capacitor).

**Spec:** `docs/superpowers/specs/2026-11-10-mech-rpg-design.md` §3, §5, §7, §8, §10. Missions, factions unlocking stock, messages and the three endings stay in plan 3.

## Global Constraints

- Everything from plan 1 still holds: English text only in `src/content/strings.ts`; logical screen 310×270; nine input actions; `src/core` imports nothing from UI, platform, DOM or Node; no `Math.random` in `src/core`; no secrets or proxy addresses committed; every generated image has a sidecar.
- Selling returns the full price (spec §5). Credits may go negative only through a settlement; buying is refused while credits are below the price.
- The player can never be stuck: the hub always offers a battle, and a build that fails validation cannot deploy but can always be changed.
- Saving happens after every purchase, sale, equip change and settlement. A missing, corrupt or wrong-version save never crashes: it leads to the title screen with only "New Game".
- Sprite id equals part id. An arms part has two sprites, `<id>.near` and `<id>.far`.
- Image generation stays at `low` quality and is capped at 26 images for this plan.

## Review Focus

1. **Selling an equipped part.** Expected: only spare copies can be sold; the build never references a part the player no longer owns.
2. **Corrupt or old save data** (truncated JSON, unknown part ids, a build that no longer validates). Expected: treated as no save; no crash, no half-loaded state.
3. **An invalid build at deploy time** (overweight after a swap, not enough energy). Expected: the hub refuses to start a battle and says why; the garage shows which limit is broken.
4. **Empty lists** (nothing owned for a slot, nothing affordable, an empty shop tab). Expected: an explanatory line instead of an empty menu, and `cancel` always works.
5. **Debt.** Expected: with negative credits the shop refuses purchases, selling still works, and a battle can still be started.

---

## Content (authoritative values)

Resist is kinetic / energy / explosive. All existing enemy-only parts stay unchanged.

**Frame parts** — four families, one part per slot each.

| Id | Name | Kind | AP | Resist | Weight | Drain | Other | Price | Vendor |
|---|---|---|---|---|---|---|---|---|---|
| `head-scout-mk1` | Scout Mk1 | head | 60 | .10/.10/.10 | 40 | 20 | aim 10 | 300 | undertow |
| `core-hauler` | Hauler Core | core | 220 | .20/.10/.15 | 260 | 60 | | 300 | undertow |
| `arms-rigger` | Rigger Arms | arms | 110 | .15/.10/.10 | 120 | 40 | aim 5 | 300 | undertow |
| `legs-strider` | Strider Legs | legs | 150 | .15/.10/.10 | 200 | 50 | capacity 1000, mobility 30 | 300 | undertow |
| `head-halo` | Halo Visor | head | 45 | .05/.25/.05 | 25 | 25 | aim 18 | 900 | lumen |
| `core-halo` | Halo Core | core | 170 | .10/.30/.10 | 180 | 50 | | 1400 | lumen |
| `arms-halo` | Halo Arms | arms | 80 | .10/.25/.05 | 80 | 35 | aim 12 | 1000 | lumen |
| `legs-halo` | Halo Legs | legs | 110 | .10/.25/.05 | 140 | 55 | capacity 850, mobility 48 | 1300 | lumen |
| `head-bulwark` | Bulwark Cab | head | 90 | .30/.05/.15 | 70 | 15 | aim 4 | 800 | hadron |
| `core-bulwark` | Bulwark Core | core | 320 | .35/.05/.20 | 420 | 70 | | 1500 | hadron |
| `arms-bulwark` | Bulwark Arms | arms | 160 | .30/.05/.15 | 200 | 45 | aim 2 | 1000 | hadron |
| `legs-bulwark` | Bulwark Legs | legs | 230 | .30/.05/.20 | 330 | 60 | capacity 1500, mobility 14 | 1400 | hadron |
| `head-ronin` | Ronin Helm | head | 75 | .20/.15/.25 | 50 | 25 | aim 12 | 1200 | freelance |
| `core-ronin` | Ronin Core | core | 270 | .25/.15/.30 | 320 | 75 | | 1900 | freelance |
| `arms-ronin` | Ronin Arms | arms | 140 | .20/.15/.25 | 150 | 50 | aim 8 | 1400 | freelance |
| `legs-ronin` | Ronin Legs | legs | 190 | .20/.15/.25 | 260 | 65 | capacity 1250, mobility 26 | 1700 | freelance |

Visual families: Salvage (the four starter parts: patched, mismatched teal and rust plating), Halo (the existing white frame), Bulwark (industrial, yellow and black hazard markings), Ronin (the existing samurai frame).

**Generators**

| Id | Name | Output | Cooling | Weight | Price | Vendor |
|---|---|---|---|---|---|---|
| `gen-kd1` | KD-1 Cell | 400 | 25 | 100 | 500 | undertow |
| `gen-prism` | Prism Reactor | 520 | 22 | 90 | 1600 | lumen |
| `gen-furnace` | Furnace Block | 460 | 38 | 170 | 1300 | hadron |

**Weapons**

| Id | Name | Mount | Type | Dmg | Acc | Energy | Heat | Ammo | Cost/shot | Weight | Price | Vendor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wpn-rivet-rifle` | Rivet Rifle | hand | kinetic | 38 | 75 | 60 | 12 | 30 | 15 | 80 | 300 | undertow |
| `wpn-arc-pistol` | Arc Pistol | hand | energy | 30 | 80 | 90 | 22 | none | 0 | 50 | 600 | lumen |
| `wpn-scatter-gun` | Scatter Gun | hand | kinetic | 62 | 55 | 70 | 18 | 14 | 30 | 110 | 900 | hadron |
| `wpn-rail-lance` | Rail Lance | hand | kinetic | 85 | 82 | 130 | 30 | 10 | 70 | 150 | 1800 | hadron |
| `wpn-pulse-carbine` | Pulse Carbine | hand | energy | 44 | 78 | 110 | 26 | none | 0 | 70 | 1300 | lumen |
| `wpn-lance-emitter` | Lance Emitter | hand | energy | 72 | 70 | 170 | 40 | none | 0 | 95 | 2000 | lumen |
| `wpn-frag-launcher` | Frag Launcher | hand | explosive | 55 | 65 | 65 | 20 | 12 | 45 | 100 | 800 | undertow |
| `wpn-mortar-pod` | Mortar Pod | shoulder | explosive | 70 | 60 | 80 | 30 | 8 | 60 | 140 | 700 | undertow |
| `wpn-siege-cannon` | Siege Cannon | shoulder | kinetic | 110 | 58 | 120 | 38 | 6 | 110 | 240 | 2000 | hadron |
| `wpn-halo-array` | Halo Array | shoulder | energy | 60 | 85 | 150 | 34 | none | 0 | 120 | 1900 | lumen |
| `wpn-swarm-rack` | Swarm Rack | shoulder | explosive | 95 | 68 | 110 | 36 | 6 | 120 | 180 | 1700 | undertow |

`STARTER_BUILD` and `DEMO_BUILD` are unchanged. A new game starts with the starter build's six parts owned and 1200 credits. Encounter rewards: `intro` 600, `outpost` 1100.

---

### Task 1: Full catalogue

**Files:** Modify `src/core/types.ts`, `src/content/parts.ts`, `src/content/enemies.ts`. Test: `tests/content/content.test.ts`, `tests/core/build.test.ts`.

**Interfaces — Produces:**
- `type Vendor = 'undertow' | 'lumen' | 'hadron' | 'freelance'`; `vendor?: Vendor` on `FramePart`, `Generator`, `Weapon` (absent on enemy-only parts).
- `SHOP_PARTS: Part[]` in `src/content/parts.ts`: every part with a vendor, in the table order above.
- `ENCOUNTER_REWARD: Record<string, number>` in `src/content/enemies.ts`.

- [ ] Tests: `SHOP_PARTS` has 30 entries (16 frame, 3 generators, 11 weapons: 7 hand, 4 shoulder); every one has a positive price and a vendor; each frame slot has exactly 4; every family's four frame parts with any shop generator and the Rivet Rifle pass `validatePlayerBuild`; every encounter has a reward; spot checks: `legs-bulwark` capacity 1500, `wpn-rail-lance` damage 85, `gen-prism` output 520.
- [ ] Watch them fail, add the data, watch them pass. Update the two starter-price expectations if any test pinned 400.
- [ ] Commit: `Add the full part catalogue`.

### Task 2: Game state and ownership rules

**Files:** Create `src/core/game.ts`. Test: `tests/core/game.test.ts`.

**Interfaces — Produces:**

```ts
export const SAVE_VERSION = 1;
export const STARTING_CREDITS = 1200;
export interface GameState { version: number; credits: number; inventory: Record<string, number>; build: Build; battlesWon: number }
export type BuildSlot = keyof Build;                      // the eight slots
export const BUILD_SLOTS: BuildSlot[];                    // head, core, arms, legs, generator, rightHand, leftHand, shoulder
export type TradeRefusal = 'notForSale' | 'cannotAfford' | 'notOwned' | 'equipped';
export type EquipRefusal = 'notOwned' | 'wrongSlot' | 'noSpare' | 'required';
export function newGame(catalog: Catalog): GameState;
export function equippedCount(state: GameState, partId: string): number;
export function spareCount(state: GameState, partId: string): number;   // owned minus equipped
export function fits(part: Part, slot: BuildSlot): boolean;             // kind and weapon mount match the slot
export function checkBuy(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null;
export function buy(state: GameState, partId: string, catalog: Catalog): GameState;
export function checkSell(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null;
export function sell(state: GameState, partId: string, catalog: Catalog): GameState;
export function checkEquip(state: GameState, slot: BuildSlot, partId: string | null, catalog: Catalog): EquipRefusal | null;
export function equip(state: GameState, slot: BuildSlot, partId: string | null, catalog: Catalog): GameState;
export function isValidState(value: unknown, catalog: Catalog): value is GameState;
```

**Rules:**
- `checkBuy`: `notForSale` when the part is unknown or has no vendor; `cannotAfford` when `credits < price`.
- `checkSell`: `notOwned` when none owned; `equipped` when every owned copy is fitted. Selling adds the full price.
- `checkEquip` with a part: `notOwned`; `wrongSlot` when it does not fit; `noSpare` when every owned copy is fitted elsewhere (re-fitting the part already in that slot is allowed and changes nothing). With `null`: `required` for the four frame slots and the generator; weapon slots may be emptied.
- `buy`, `sell`, `equip` return a new state and throw `Error('illegal trade: <refusal>')` / `Error('illegal equip: <refusal>')` when refused.
- `isValidState`: an object with the current `version`, finite numeric `credits`, an inventory of known shop part ids with whole counts ≥ 0, a build whose every part is owned, fits its slot and is not fitted more often than owned, with all required slots filled, and a whole `battlesWon` ≥ 0. It does not require the build to pass weight or energy limits.

- [ ] Tests: new game owns exactly the starter build's parts, one each, with 1200 credits and passes `isValidState`; buying deducts the price and adds one; buying the same part twice gives two; `cannotAfford` at credits one below the price and allowed at exactly the price; `notForSale` for `core-drone` and for an unknown id; selling a spare returns the full price; selling the only fitted copy is `equipped`; selling something not owned is `notOwned`; after buying a second Rivet Rifle it can be fitted to `leftHand`, and then neither copy can be sold; equipping a shoulder weapon in a hand slot is `wrongSlot`; a head in the core slot is `wrongSlot`; equipping an unowned part is `notOwned`; clearing `core` is `required`, clearing `shoulder` is allowed; re-fitting the fitted part is a no-op; no function mutates its input; `isValidState` rejects: `null`, a wrong version, `credits: NaN`, an unknown part id in the inventory, a build part with count 0, a missing required slot, a negative count, the same single-owned weapon in both hands.
- [ ] Watch fail, implement, watch pass. Commit: `Add game state and ownership rules`.

### Task 3: Settlement

**Files:** Create `src/core/economy.ts`. Test: `tests/core/economy.test.ts`.

**Interfaces — Produces:**

```ts
export const REPAIR_RATE = 0.5;   // rebuilding a destroyed part costs half its price
export interface Settlement { won: boolean; reward: number; ammoCost: number; repairCost: number; net: number;
  lines: { partId: string; lost: number; cost: number }[] }
export function settle(battle: BattleState, reward: number, catalog: Catalog): Settlement;
export function applySettlement(state: GameState, settlement: Settlement): GameState;
```

**Rules:** `reward` counts only on victory. `ammoCost` = Σ over the player's weapons of shots fired (starting ammo minus remaining) × `costPerShot`. `repairCost` = Σ over the player's frame parts of `round(lostAp / maxAp × price × REPAIR_RATE)`, with one `lines` entry per damaged part. `net = (won ? reward : 0) − ammoCost − repairCost`. `applySettlement` adds `net` to credits (it may go negative) and increments `battlesWon` on a win. `settle` throws on a battle that is still ongoing.

- [ ] Tests: an untouched victory nets the full reward; 4 Rivet Rifle shots cost 60; a core at 110 of 220 on the 300-credit Hauler Core costs 75; a destroyed 300-credit part costs 150; a defeat pays nothing but still charges both; unlimited-ammo weapons cost nothing; credits can end below zero; `battlesWon` rises only on a win; an ongoing battle throws.
- [ ] Watch fail, implement, watch pass. Commit: `Add battle settlement`.

### Task 4: Saving

**Files:** Create `src/platform/storage.ts`. Test: `tests/platform/storage.test.ts`.

**Interfaces — Produces:**

```ts
export const SAVE_KEY = 'ironwage-save';
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class SaveFile { constructor(store: KeyValueStore, catalog: Catalog);
  load(): GameState | null;            // null for missing, unreadable or invalid data
  save(state: GameState): boolean;     // false when the store refuses (full or unavailable)
  clear(): void }
```

- [ ] Tests with an in-memory store: round trip; missing key → `null`; `'{'`, `'null'`, `'[]'`, a wrong version and a state with an unknown part → `null`; a store whose `getItem` throws → `null`; a store whose `setItem` throws → `save` returns `false` and does not throw; `clear` removes the key.
- [ ] Watch fail, implement, watch pass. Commit: `Add save file`.

### Task 5: Art for the new parts

**Files:** Modify `scripts/art/jobs.ts`; rename existing raw images; generate; run `process.ts`. No game code.

- Rename raw files (and sidecars): the white family's layers to `legs-halo`, `core-halo`, `head-halo`, `arms-halo.near/.far`, `family-light` → `family-halo`; the samurai layers to `legs-ronin`, `core-ronin`, `head-ronin`, `arms-ronin.near/.far`, `family-heavy` → `family-ronin`. `family-ronin` stays the pose family.
- New families (6 images each): `salvage` — a scrappy salvaged mecha of mismatched patched plates in teal and rust with exposed cables and a single round lens head; `bulwark` — a massive industrial mining mecha in yellow and black hazard markings with a cab-like head and blocky limbs. Their layers get the starter part ids and the `-bulwark` ids.
- New weapon sprites (8): the eight weapons in the table without one, each described in one sentence in `jobs.ts`, styled after the family of its vendor (`freelance` uses `ronin`).
- A garage background `bg-garage`: a dim mech hangar bay with gantries and neon work lights, empty floor in the lower half.
- `proof.ts` builds its sheet from the four families' ids.

- [ ] Rename, update `jobs.ts`, run `process.ts palette`, generate (cap 26), process, build the proof sheet, look at every new sprite and at the sheet, regenerate individual failures within the cap.
- [ ] `tests/content/content.test.ts` gains: every shop part has a sprite in `src/content/sprites.json` (arms: both `.near` and `.far`; generators are exempt — they are not drawn).
- [ ] Commit: `Add sprites for the Salvage and Bulwark families and the new weapons`.

### Task 6: Screens framework, title and hub

**Files:** Create `src/ui/app.ts`, `src/ui/titleScreen.ts`, `src/ui/hubScreen.ts`, `src/ui/menuList.ts`; modify `src/main.ts`, `src/content/strings.ts`. Test: `tests/ui/menuList.test.ts`, `tests/ui/app.test.ts`.

**Interfaces — Produces:**

```ts
// menuList.ts — the one list behaviour every screen shares
export interface ListItem { id: string; label: string; enabled: boolean; note?: string }
export class MenuList { constructor(items: ListItem[], cursor?: number);
  items: ListItem[]; cursor: number; readonly selected: ListItem | undefined;
  move(delta: number): void;          // wraps; no-op on an empty list
  setItems(items: ListItem[]): void;  // keeps the cursor on the same id when it still exists, else clamps
  visible(rows: number): { items: ListItem[]; offset: number };  // a scrolling window that keeps the cursor in view
}
// app.ts
export interface Screen { update(dtMs: number): void; draw(ctx: CanvasRenderingContext2D): void; onInput(action: InputAction): void }
export type ScreenName = 'title' | 'hub' | 'garage' | 'shop' | 'battle' | 'settlement';
export class App { constructor(deps: { catalog: Catalog; save: SaveFile; sprites: SpriteStore; sfx?: Sfx; fast: boolean; seed: number });
  readonly screen: ScreenName; game: GameState | null;
  go(name: ScreenName): void; update(dtMs: number): void; draw(ctx): void; onInput(action: InputAction): void;
  commit(next: GameState): void;      // replaces the game state and saves it
  snapshot(): unknown }               // for window.__game
```

- Title: `Continue` (only when a valid save exists) and `New Game`. `New Game` over an existing save asks once: `Start over? This erases your save.` with `No` selected first.
- Hub: shows credits (red when negative) and battles won; items `Sortie`, `Garage`, `Shop`. `Sortie` is disabled with the reason as its note when `validatePlayerBuild` fails (`Overweight`, `Not enough energy`, `Missing part`). `Sortie` starts the encounter `intro` when `battlesWon` is even and `outpost` when odd.
- `window.__game` exposes `app.snapshot()`: `{ screen, credits, build, inventory, battlesWon, menu: { items, cursor }, battle?: {...as before} }`. Existing e2e tests are updated to enter a battle through the menus; the URL parameter `encounter` is dropped, `seed` and `fast` stay.

- [ ] Tests: `MenuList` wrap, empty list, `setItems` cursor keeping and clamping, `visible` window at the top, middle and bottom of a 12-item list with 5 rows; `App` with an in-memory store: no save → title offers only `New Game`; new game → hub with 1200 credits and a save written; a valid save → `Continue` first; `New Game` over a save needs confirmation and `No` keeps the save; hub `Sortie` disabled with `Overweight` for an overweight build; `cancel` on hub does nothing; `go('garage')` and back.
- [ ] Watch fail, implement, watch pass, run e2e. Commit: `Add title and hub screens`.

### Task 7: Garage

**Files:** Create `src/ui/garageScreen.ts` (flow class `GarageFlow` and drawing class). Test: `tests/ui/garageFlow.test.ts`.

**Interfaces — Produces:**

```ts
export class GarageFlow { constructor(game: GameState, catalog: Catalog);
  game: GameState; mode: 'slots' | 'parts'; slots: MenuList; parts: MenuList;
  readonly slot: BuildSlot; readonly candidate: string | null;      // part highlighted in 'parts' mode
  readonly stats: BuildStats; readonly preview: BuildStats;         // preview = stats with the candidate fitted
  readonly errors: BuildError[]; readonly previewErrors: BuildError[];
  readonly previewBuild: Build;
  onInput(action: InputAction): 'stay' | 'changed' | 'exit' }
```

- `slots` lists the eight slots with the fitted part's name (`Empty` for a free weapon slot). `confirm` opens `parts`; `cancel` exits.
- `parts` lists owned parts that fit the slot, the fitted one marked, each with its spare count; weapon slots start with `(none)`. A part with no spare copy that is not the fitted one is disabled with the note `In use`. `confirm` equips and returns to `slots` with `'changed'`; `cancel` returns to `slots`.
- Drawing: the mech (pose box) on the left built from `previewBuild`, so the highlighted part is shown fitted before confirming; right panel with the list; bottom strip with `Weight a/b`, `Energy`, `Mobility`, `Armour` (sum of frame AP), each followed by the preview difference (`+12` cyan, `−30` red) in `parts` mode; a broken limit is red and named.

- [ ] Tests: slot labels for a new game; opening `rightHand` lists `(none)` and `Rivet Rifle` marked; choosing `(none)` empties the slot; a frame slot has no `(none)`; after buying a Halo head, highlighting it changes `preview.weight` by −15 and `previewBuild.head`, while `game` is unchanged until `confirm`; a second-hand weapon fitted on the right is `In use` and disabled in the left-hand list when only one is owned; fitting Bulwark arms, core and head on Strider legs gives `errors` containing `overweight` and the change is still accepted; `cancel` in `slots` returns `'exit'`; an empty candidate list (nothing but the fitted part) still lists the fitted part.
- [ ] Watch fail, implement, watch pass; e2e screenshot of the garage. Commit: `Add garage`.

### Task 8: Shop

**Files:** Create `src/ui/shopScreen.ts` (`ShopFlow` and drawing class). Test: `tests/ui/shopFlow.test.ts`.

**Interfaces — Produces:**

```ts
export type ShopTab = 'head' | 'core' | 'arms' | 'legs' | 'generator' | 'hand' | 'shoulder';
export class ShopFlow { constructor(game: GameState, catalog: Catalog, stock: Part[]);
  game: GameState; tab: ShopTab; mode: 'buy' | 'sell'; list: MenuList; message: string;
  readonly selected: Part | undefined;
  onInput(action: InputAction): 'stay' | 'changed' | 'exit' }
```

- `prev`/`next` change tab (wrapping); `left`/`right` switch between `buy` and `sell`; `confirm` trades; `cancel` exits.
- `buy` lists the tab's stock with price and owned count; unaffordable items are disabled with the note `Too expensive`. `sell` lists owned parts of the tab with their spare count; parts with no spare copy are disabled with the note `In use`.
- After a trade `message` reads `Bought <name>` / `Sold <name> +<price>`; a refused `confirm` sets `Not enough credits` / `In use` and returns `'stay'`. An empty `sell` list shows the single disabled line `Nothing to sell here`.
- Drawing: tabs along the top, the list on the left, on the right the part's sprite (for arms the near arm; generators show a drawn icon) and its statistics, credits in the corner (red when negative).

- [ ] Tests: seven tabs wrap in both directions; the head tab lists four heads; buying a 900-credit head with 1200 credits leaves 300 and `'changed'`; then the 1200-credit helm is disabled `Too expensive` and `confirm` on it changes nothing; sell mode on heads lists both owned heads, the fitted one disabled `In use`; selling the spare returns its price; with credits −50 every buy item is disabled and selling still works; the hand tab holds 7 weapons and the shoulder tab 4; an empty sell list shows `Nothing to sell here`.
- [ ] Watch fail, implement, watch pass; e2e screenshot. Commit: `Add shop`.

### Task 9: Battle integration, settlement screen and the full loop

**Files:** Create `src/ui/settlementScreen.ts`; modify `src/ui/app.ts`, `src/ui/battleScreen.ts`, `src/main.ts`, `e2e/*.spec.ts`. Test: `tests/ui/app.test.ts` (extended), `e2e/loop.spec.ts`.

- A battle uses the game's build. When its result is confirmed the app shows the settlement: reward, ammunition, one repair line per damaged part, the net result and the new balance; `confirm` applies it, saves and returns to the hub.
- The battle background stays `bg-neon-district`; hub, garage and shop use `bg-garage`.
- The debug input overlay and its `menu` toggle keep working on every screen.

- [ ] `tests/ui/app.test.ts`: a won battle (driven with the auto-player through the app in fast mode) leads to `settlement`, then `hub` with credits changed by exactly `settlement.net`, `battlesWon` 1 and the save updated; a lost battle charges costs and leaves `battlesWon` at 0; the next sortie is `outpost`.
- [ ] `e2e/loop.spec.ts`: new game → shop → buy the Arc Pistol → garage → fit it to the left hand → sortie → finish the battle → settlement → hub; reload the page → `Continue` → the pistol is still fitted and the credits match. No page errors. Screenshots of title, hub, garage, shop and settlement saved under `docs/screenshots/`.
- [ ] Run everything (`npm test`, typecheck, e2e three times). Commit: `Connect battles, settlement and saving into one loop`.

### Task 10: Review and device build

- [ ] Whole-branch review by a fresh reviewer with this plan's Review Focus; one fix pass with a failing test first for each Critical or Important finding.
- [ ] Push, confirm the Android workflow is green, and hand the owner the new APK with a short list of what to try.
