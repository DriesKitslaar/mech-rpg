# Expansion Plan (plan 4): arena, open contracts, pilot perks, more gear, cycles, options

**Goal:** Turn the finished campaign into a game with many hours of play and real choices: an arena
ladder, an endless board of generated contracts, pilot levels with perks, two more frame families
and ten more weapons and generators with special effects, new enemies, a harder second cycle after
the ending, and options with music.

**Spec:** `docs/superpowers/specs/2026-11-10-mech-rpg-design.md`. The spec listed the arena and music as
"outside the first version"; the owner has since asked for a fully fledged game.

## Global constraints

Unchanged from plans 1 to 3. In addition:
- Save version becomes 4; versions 1 to 3 are upgraded, never discarded.
- Every new rule lives in `src/core` with tests; every new screen has a flow class or is driven
  through `App` tests.
- Image generation: `low` quality, at most 26 images.
- The player can never be stuck: the patrol stays, selling the last weapon stays refused.

## Review focus

1. Perk and scaling modifiers applied twice, or not at all, somewhere (preview vs. resolution,
   first battle vs. carried battle).
2. Generated contracts: the same board after a reload; no board with an impossible battle.
3. Arena rank: no way to skip ranks or be paid twice in full for one rank.
4. A new cycle: nothing bought is lost, the campaign restarts cleanly, the ending shows again.
5. Old saves: every older version loads with sensible defaults.

## 1. Pilot levels and perks (`src/core/pilot.ts`, `src/content/perks.ts`)

- XP: a won contract gives `round(reward / 10)`; a lost one gives nothing.
- Level `n` needs `xpForLevel(n) = 50 * (n - 1) * (n + 2)` total XP (level 2: 200, level 3: 500,
  level 5: 1400, level 10: 5400). Maximum level 20.
- Each level above 1 gives one perk point. Points can be spent at any time; they cannot be refunded.

| Id | Name | Effect per rank | Ranks |
|---|---|---|---|
| `marksman` | Marksman | +4 hit chance | 3 |
| `reflexes` | Reflexes | +4 evasion (while the legs work) | 3 |
| `capacitor` | Capacitor Tuning | +20 energy per turn | 3 |
| `heatsinks` | Heat Sinks | +5 cooling | 3 |
| `fieldTech` | Field Technician | +1 field repair per contract | 2 |
| `plating` | Reinforced Plating | +6% armour on every part | 3 |
| `haggler` | Haggler | +8% contract pay | 3 |
| `quartermaster` | Quartermaster | -15% ammunition and repair costs | 3 |

- `UnitMods { aim, evasion, energy, cooling, repairs, armour, damage, toughness }` sits on every
  `UnitState` (`aim`…`repairs` additive, default 0; `armour` an added fraction; `damage` and
  `toughness` multipliers, default 1, used for enemies). `createBattle(build, enemies, catalog, seed,
  opts?: { carry?, mods?, enemyScale? })`.
- `settle(battle, reward, catalog, econ?: { payBonus, costDiscount })`.

## 2. Weapon traits (`src/core/battle.ts`)

| Trait | Effect |
|---|---|
| `pierce` | The target part's resistance counts for half |
| `thermal` | A hit adds `traitPower` heat to the target |
| `drain` | A hit removes `traitPower` from the energy the target gets on its next turn |
| `twin` | Fires two shots, each rolled separately for the listed damage; one ammo, one energy cost, one heat |

## 3. New parts (prices in credits; unlock in the last column)

Frame parts (resist kinetic/energy/explosive):

| Id | Name | AP | Resist | Weight | Drain | Other | Price | Unlock |
|---|---|---|---|---|---|---|---|---|
| `head-wraith` | Wraith Mask | 50 | .10/.15/.10 | 20 | 30 | aim 24 | 2200 | arena:4 |
| `core-wraith` | Wraith Core | 190 | .15/.20/.10 | 150 | 55 | | 2600 | arena:4 |
| `arms-wraith` | Wraith Arms | 90 | .15/.20/.10 | 70 | 40 | aim 16 | 2200 | arena:4 |
| `legs-wraith` | Wraith Legs | 130 | .15/.20/.10 | 120 | 60 | capacity 800, mobility 60 | 2600 | arena:4 |
| `head-colossus` | Colossus Crown | 110 | .30/.20/.30 | 80 | 30 | aim 8 | 2400 | arena:8 |
| `core-colossus` | Colossus Core | 400 | .35/.25/.35 | 480 | 85 | | 3400 | arena:8 |
| `arms-colossus` | Colossus Arms | 200 | .30/.20/.30 | 230 | 55 | aim 6 | 2600 | arena:8 |
| `legs-colossus` | Colossus Legs | 280 | .30/.20/.30 | 380 | 75 | capacity 1900, mobility 16 | 3000 | arena:8 |

Vendor of all eight: `freelance`.

Generators: `gen-ember` Ember Stack (output 480, cooling 50, weight 200, 2600, arena:3);
`gen-tidal` Tidal Core (output 600, cooling 30, weight 140, 3200, arena:6). Vendor `freelance`.

Weapons:

| Id | Name | Mount | Type | Dmg | Acc | Energy | Heat | Ammo | Cost/shot | Weight | Price | Trait | Unlock | Vendor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `wpn-needler` | Needler | hand | kinetic | 26 | 72 | 85 | 20 | 16 | 25 | 70 | 1500 | twin | undertow-1 | undertow |
| `wpn-thermal-lance` | Thermal Lance | hand | energy | 40 | 76 | 120 | 24 | none | 0 | 90 | 2200 | thermal 18 | choice | lumen |
| `wpn-arc-caster` | Arc Caster | hand | energy | 34 | 82 | 100 | 22 | none | 0 | 60 | 1900 | drain 60 | arena:2 | freelance |
| `wpn-void-rifle` | Void Rifle | hand | kinetic | 64 | 84 | 140 | 30 | 12 | 60 | 120 | 3000 | pierce | arena:5 | freelance |
| `wpn-hailstorm` | Hailstorm | shoulder | kinetic | 40 | 62 | 130 | 36 | 10 | 70 | 200 | 2600 | twin | choice | hadron |
| `wpn-inferno-pod` | Inferno Pod | shoulder | explosive | 60 | 64 | 110 | 32 | 8 | 80 | 170 | 2400 | thermal 30 | choice | undertow |
| `wpn-null-beam` | Null Beam | shoulder | energy | 50 | 80 | 160 | 38 | none | 0 | 130 | 3200 | drain 100 | arena:7 | freelance |
| `wpn-breaker-cannon` | Breaker Cannon | shoulder | explosive | 120 | 56 | 150 | 44 | 5 | 150 | 260 | 3600 | pierce | arena:9 | freelance |

Unlock conditions: a contract id, `choice`, or `arena:N` (arena rank at least N).

## 4. Enemies

- New: `gunship` (flying, sprayer, mobility 40, explosive 34 dmg, core 110), `lance-tower`
  (fixed, aims for the head, kinetic 52 dmg accuracy 88, core 160), `stalker` (Wraith frame,
  skirmisher), `juggernaut` (Colossus frame, bruiser).
- `EnemyDef.composed`: when such an enemy is alone in a battle it is drawn as a full-size mech
  built from its parts, mirrored; otherwise its single sprite is used.
- `enemyScale` multiplies enemy armour and damage (cycles, generated contracts, arena tuning).

## 5. Arena (`src/content/arena.ts`, `src/ui/arenaScreen.ts`)

Ten opponents, fought one at a time in order. Winning against rank `n` when `arenaRank === n - 1`
raises the rank and pays the full purse; an opponent already beaten can be fought again for a
quarter of the purse. The arena unlocks after the introductions. Purses: 800, 1200, 1600, 2000,
2600, 3200, 3800, 4600, 5400, 7000. Losing costs ammunition and repairs as usual.

## 6. Open contracts (`src/core/board.ts`)

Three generated contracts on the board next to the story ones, from the moment the introductions
are done. They are a pure function of `(battlesWon, cycle)`, so a reload shows the same board and
finishing any contract refreshes it. Tier `t = min(8, floor(battlesWon / 3) + 2 * cycle)`.
Each has 1 to 3 battles; each battle spends a budget of `2 + t` (capped at 9) on enemies
(drone 1, turret 2, tank 2, gunship 2, lance tower 3, light mech 3, stalker 4, heavy mech 4,
juggernaut 6), at most three enemies and at most one mech per battle. Pay = 220 per budget point
+ 150 per battle. `enemyScale = 1 + 0.08 * max(0, t - 4)`. They are never recorded as completed.

## 7. Cycles

After the ending the hub offers "New Cycle". It keeps credits, parts, pilot level, perks and arena
rank, clears the completed story contracts and read messages, and raises `cycle`. Story enemies get
`enemyScale = 1 + 0.35 * cycle` and story pay is multiplied by `1 + 0.5 * cycle`.

## 8. Options and music

`settings: { sfx, music, fastBattles }`, changed on an Options screen reachable from the title
and the hub, saved with the game (and usable before a game exists). Music is two short synthesised
loops (menus, battles) played quietly; it starts after the first input like all sound.

## 9. Save version 4

Adds `xp: 0`, `perks: {}`, `arenaRank: 0`, `cycle: 0`,
`settings: { sfx: true, music: true, fastBattles: false }`.

## Stages

1. Schema, pilot levels, perks, unit modifiers, settlement modifiers.
2. Weapon traits, new parts, unlock conditions.
3. Enemy scaling, new enemies, composed enemy drawing.
4. Arena.
5. Open contracts.
6. Cycles.
7. Pilot screen, options screen, music.
8. Balance checks, browser tests, review, device build, documentation.

## Changes made while building

- Open contracts: the tier rises once per **five** battles won (not three). The three contracts
  sit at tier − 2, tier − 1 and tier, so a lighter one is always on offer. Budget is capped at 8,
  pay is 250 per budget point + 200 per battle, and `enemyScale = 1 + 0.04 * max(0, t - 4)`.
  With the original numbers the simulation showed the board outgrowing any affordable build.
- Arena opponents carry a tuning scale between 0.8 and 1.5, set from simulation.
- Enemies have unlimited ammunition.
- The arena and the open contracts stay available in later cycles from the start.
- Options are stored under their own key (`ironwage-settings`) and copied into the save.
