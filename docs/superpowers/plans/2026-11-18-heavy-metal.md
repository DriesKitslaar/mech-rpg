# Heavy Metal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pilot who outguns the field feel it: a kill readies the weapon again, two kills in a turn break what is left, swarms give that something to run through, the record earns a name, and an overkill looks like one.

**Architecture:** Momentum and the break are rules of the battle (`src/core/battle.ts`) that every unit follows and that say what happened in events; screens and sound only read the events. A reserve is a list on the battle's state that the start of a round draws from. The name is worked out from the record a game already keeps: nothing new is saved.

**Tech Stack:** TypeScript, Canvas 2D at 310x270, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-heavy-metal-design.md`

## Global Constraints

- A saved game from before this round loads and stays valid; nothing new is saved.
- A battle against one machine plays exactly as before, seed for seed, until the volley that ends it.
- A hard fight stays hard: where a boss, a named pilot or the last contracts of a war are won more often by more than a few seeds, the rule is changed, not the test.
- Every new English text has its Dutch inside the room its kind has (`tests/content/dutch.test.ts`).
- Under the calm setting nothing new flashes or shakes; nothing new holds a turn up.
- No image is generated unless a part cannot do without; low quality only; the proxy's address and key are never committed.
- Nothing is merged without the user's word. Each part: its own branch on the one before, a draft PR, an APK.

## Review Focus

- A run pushed into an overheat: the weapon was ready, the pilot fired, and the turn after is lost as it always is. Nothing about the run hides the heat.
- A weapon whose killing volley was its last round: it is not offered again.
- The Overdrive beside a run: Second Wind and Deadeye do what they did; a turn started over keeps the chain it had.
- A shaken machine that is the last one standing in a battle that only has to be outlasted, or that guards something to protect: the battle ends when it leaves, as it would had it been destroyed.
- A reserve beside a carrier: never more than three machines on the field; a machine that breaks off while others are still to come does not end the battle.

## Status

- [ ] H1: Momentum (branch `feat/heavy-momentum`)
- [ ] H2: They break (branch `feat/heavy-break`)
- [ ] H3: Swarms (branch `feat/heavy-swarm`)
- [ ] H4: A name (branch `feat/heavy-name`)
- [ ] H5: Weight (branch `feat/heavy-weight`)
- [ ] H6: Review, soak, APK, summary (branch `feat/heavy-review`)

## The measurements

The automatic player in the best frame with every fighting perk and the bench at its limit, over every story contract and the patrol, twelve seeds each (`feel` harness, kept as `tests/core/fantasy.test.ts` from H1 on):

| | First telling, before | Peak, before |
|---|---|---|
| Rounds a battle | 4.1 | 6.0 |
| Volleys for each machine destroyed | 3.8 | 5.0 |
| Turns with a kill | 43% | 31% |
| Turns with two kills | 2% | 1% |
| Patrol, rounds | 2.7 | 2.7 |

Each part adds its column here.

## H1: Momentum

**Files:** `src/core/battle.ts`, `src/core/ai.ts` (only if the automatic player needs telling), `src/ui/battleFlow.ts` and `src/ui/battleScreen.ts` (what is said and shown), `src/content/strings.ts`, `src/content/nl/strings.ts`, `src/content/codex.ts` (a manual topic), `docs/handleiding.md`; tests in `tests/core/momentum.test.ts` (new), `tests/core/fantasy.test.ts` (new), `tests/ui/momentum.test.ts` (new).

**Interfaces:**
- `UnitState.chain: number`: units this unit's volleys have destroyed in its current turn; 0 when its turn begins.
- `BattleEvent` gains `{ type: 'momentum'; unit: string; weapon: WeaponSlot; chain: number }`, pushed after a volley that destroyed at least one unit.
- In `resolveFire`, after the volley: for a volley that destroyed a unit, the slot leaves `unit.fired` and, for a weapon that is not charged, `unit.energy` gets `weapon.energy` back. Heat and the round stay spent.

- [ ] Tests first (`momentum.test.ts`): a killing volley readies the weapon and returns its energy; heat is kept and the round is gone; a volley that only wounds, or misses, readies nothing; the chain counts and is 0 at the next turn; a charged weapon has to be charged again; a salvo that destroys one of three is ready again; an empty magazine is not offered; a kill by the ally off the field, a bomb or a module readies nothing; a third volley that overheats still costs the next turn.
- [ ] The rule; the event.
- [ ] The automatic player goes on with a weapon that is ready again (test: against two machines it can destroy in a volley each, it destroys both in one turn).
- [ ] The battle says so: a line in the log, the weapon lit again in the menu, the chain beside the round once it is two (plain text; H5 makes it loud).
- [ ] A manual topic and the guide. Dutch.
- [ ] `fantasy.test.ts`: the measurements as a test, with bounds that say what this part is for (two kills in a turn at least five times as often on the patrol; the hard fights within a few seeds of before).
- [ ] The balance tests measured again; the table here. All tests, both browser halves, an APK.

## H2: They break

**Files:** `src/core/battle.ts`, `src/ui/battleFlow.ts`, `src/ui/battleScreen.ts`, strings, `src/content/codex.ts`, guide; tests in `tests/core/rout.test.ts` (new), `tests/ui/rout.test.ts` (new).

**Interfaces:**
- `UnitState.shaken?: boolean`, `UnitState.fled?: boolean`.
- `ordinary(state, unit): boolean`: no phases, no portrait, no mark, not the objective's target.
- `BattleEvent` gains `{ type: 'shaken'; unit: string }` and `{ type: 'rout'; unit: string }`.
- When a unit's chain reaches 2, every ordinary standing enemy of it is shaken. At the start of a shaken unit's turn it leaves: `fled`, counted as gone for everything that asks who stands, and no `unitDestroyed`.

- [ ] Tests first: shaken at the second kill of a turn and not at the first; not shaken by two kills in two turns; a boss, a named pilot, an elite and an objective's target are never shaken; a shaken machine leaves at its own turn and not before, and can be destroyed until then; a machine that left is not a kill (stats, medals); the battle is won when the last one leaves, whatever the objective; the line for the last enemy is still said.
- [ ] The rule and its events.
- [ ] The screen: the machine is marked as shaken, is seen to leave, and the log says so. Dutch.
- [ ] The measurements again; the hard fights again. All tests, an APK.

## H3: Swarms

**Files:** `src/core/battle.ts` (the reserve), `src/core/campaign.ts` (`Battle.reserve`), `src/core/mission.ts`, `src/core/board.ts` and `src/content/board.ts` (swarm contracts), `src/content/sidework.ts` (the standing job), `src/ui/briefingScreen.ts`, `src/ui/battleScreen.ts`, strings; tests in `tests/core/swarm.test.ts` (new), `tests/core/board*.test.ts`, `tests/ui/swarm.test.ts` (new).

**Interfaces:**
- `Battle.reserve?: string[]`: enemy ids that come on as room is made. `BattleState.reserve: string[]`.
- `BattleEvent` gains `{ type: 'arrive'; unit: string }`. At the start of a round, while fewer than `MAX_ENEMIES` enemies stand and the reserve is not empty, the next one comes on.
- A battle with a reserve is won when nothing stands and nothing is left to come.

- [ ] Tests first: the field is topped up at the start of a round and never past three; nothing arrives in the middle of a turn; the battle is not won while the reserve holds anything; a carrier's drones and the reserve share the three places; machines that break off make room like any other.
- [ ] The rule; the briefing's line and the field's counter.
- [ ] Swarm contracts on the open board and one standing job; what they pay; the automatic player's win rate and rounds on them by frame.
- [ ] Dutch, all tests, a browser test with screenshots, an APK.

## H4: A name

**Files:** `src/core/renown.ts` (new), `src/ui/pilotScreen.ts`, `src/ui/battleScreen.ts` (the opening banner), `src/ui/app.ts` (the announcement), `src/ui/battleFlow.ts` (the opening line), strings; tests in `tests/core/renown.test.ts` (new), `tests/ui/renown.test.ts` (new).

**Interfaces:**
- `renownOf(game): number` from the record; `nameOf(game): { id: string; rank: number } | null` on a ladder of five.
- No field in the saved game: a new name is announced when a booking raises the rank.

- [ ] Tests first: the ladder; a new game has no name; the name never goes down; an old save gets the name its record earns, announced once.
- [ ] The pilot's page, the banner, the announcement, the line said when ordinary machines face a pilot far above them. Dutch.
- [ ] All tests, screenshots, an APK.

## H5: Weight

**Files:** `src/core/battle.ts` (`overkill` on the event), `src/ui/battleScreen.ts`, `src/ui/effects*.ts`, `src/platform/audio.ts`, strings; tests in `tests/ui/weight.test.ts` (new), `tests/platform/audio.test.ts`.

- [ ] `unitDestroyed` says `overkill: true` when the hit that did it carried at least twice what was left of the core.
- [ ] The word and the harder burst for an overkill; the counter and the rising note for a chain; the word for a rout. Calm setting: words only. Nothing holds a turn up (test: the same number of frames to the next choice with and without).
- [ ] All tests, the soak for the new effects, an APK.

## H6: Review, soak, APK, summary

- [ ] A fresh reviewer reads the round against the spec and the Review Focus.
- [ ] The faults a reviewer names are answered one by one; small faults put into the new code are found by the tests.
- [ ] The whole suite, both halves of the browser tests, the soak, the last APK, the measurements before and after for the user.
