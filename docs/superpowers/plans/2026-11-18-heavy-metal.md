# Heavy Metal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pilot who outguns the field feel it: a heavy weapon goes through a light machine, a kill readies the weapon again, two kills in a turn break what is left, swarms give that something to run through, the record earns a name, and an overkill looks like one.

**Architecture:** Momentum, Shatter and the break are rules of the battle (`src/core/battle.ts`) that say what happened in events; screens and sound only read the events. They are rules of an *open* battle (`BattleState.open`: more than one machine at the start, none of which leads), settled when the battle is made: a fight that is not open runs through none of the new code. A reserve is a list on the battle's state that the start of a round draws from. The name is worked out from the record a game already keeps: nothing new is saved.

**Tech Stack:** TypeScript, Canvas 2D at 310x270, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-heavy-metal-design.md`

## Global Constraints

- A saved game from before this round loads and stays valid; nothing new is saved.
- A fight that is not open (against one machine, or with a boss, a named pilot, an elite, a Bailiff or an objective's target in it) plays exactly as before, seed for seed, to its last event.
- A hard fight stays hard: where a fight against a boss or a named pilot is won more often by more than a few seeds, the rule is changed, not the test.
- Every new English text has its Dutch inside the room its kind has (`tests/content/dutch.test.ts`).
- Under the calm setting nothing new flashes or shakes; nothing new holds a turn up.
- No image is generated unless a part cannot do without; low quality only; the proxy's address and key are never committed.
- Nothing is merged without the user's word. Each part: its own branch on the one before, a draft PR, an APK.

## Review Focus

- A battle that stops being what it began as: the leader falls first, a carrier sends out a drone, an elite is the last one standing. Open or not is settled once, and a machine that joins is what the battle is.
- A run pushed into an overheat: the weapon was ready, the pilot fired, and the turn after is lost as it always is. Nothing about the run hides the heat.
- A weapon whose killing volley was its last round: it is not offered again.
- The Overdrive beside a run: Second Wind and Deadeye do what they did; a turn started over keeps the chain it had.
- A shaken machine that is the last one standing in a battle that only has to be outlasted, or that guards something to protect: the battle ends when it leaves, as it would had it been destroyed.
- A reserve beside a carrier: never more than three machines on the field; a machine that breaks off while others are still to come does not end the battle.

## Status

- [x] H1: Momentum and Shatter (branch `feat/heavy-momentum`)
- [x] H2: They break (branch `feat/heavy-break`)
- [ ] H3: Swarms (branch `feat/heavy-swarm`)
- [ ] H4: A name (branch `feat/heavy-name`)
- [ ] H5: Weight (branch `feat/heavy-weight`)
- [ ] H6: Review, soak, APK, summary (branch `feat/heavy-review`)

## The measurements

The automatic player in the best frame with every fighting perk and the bench at its limit, over the patrol and every story contract, twelve seeds each (kept as `tests/core/fantasy.test.ts`). Open battles and the rest are counted apart from H1 on: the rest are the fights the rules leave alone.

| End of a first telling | Before | After H1 | After H2 |
|---|---|---|---|
| All battles: rounds | 4.14 | 3.56 | 3.53 |
| All battles: turns with two kills or more | 1.9% | 6.8% | 7.0% |
| Open battles: rounds | 4.13 | 3.17 | 3.12 |
| Open battles: volleys for each machine destroyed | 3.13 | 2.71 | 2.76 |
| Open battles: turns with a kill | 52.5% | 59.3% | 58.1% |
| Open battles: turns with two kills or more | 2.6% | 12.4% | 13.1% |
| Open battles: turns with three | never | 1.4% | 1.5% |
| Open battles that end with a machine leaving | none | none | 65 of 444 |
| Not open: rounds | 4.15 | 4.08 | 4.08 |
| Not open: volleys for each machine destroyed | 5.20 | 5.17 | 5.17 |
| Not open: turns with two kills | 1.0% | 1.0% | 1.0% |
| Patrol: rounds | 2.67 | 2.00 | 2.00 |
| Patrol: turns with both drones | 14% | 36% | 36% |

| At the peak (third telling) | Before | After H1 | After H2 |
|---|---|---|---|
| All battles: rounds | 5.96 | 5.48 | 5.39 |
| Open battles: rounds | 5.53 | 4.69 | 4.56 |
| Open battles: volleys for each machine destroyed | 4.06 | 3.70 | 3.71 |
| Open battles: turns with two kills or more | 1.2% | 5.1% | 5.4% |
| Open battles that end with a machine leaving | none | none | 52 of 444 |
| Not open: rounds | 6.53 | 6.52 | 6.50 |
| Not open: volleys for each machine destroyed | 7.00 | 7.03 | 7.02 |

(A machine that leaves was not destroyed, which is why H2 has a few more volleys for each machine destroyed and a few fewer turns with a kill than H1.)

Of ninety battles in the story and its side work, 49 are open, 22 are against one machine and 19 have somebody who leads; of the 65 in the patrol and the story itself, 37, 19 and 9.

Win rates of the automatic player with no perks, 120 seeds a contract, on Standard (before > after H1), for the frames a pilot has by then:

| Contract | Full Ronin | Heaviest frame | What it is |
|---|---|---|---|
| verdict-enforce, -default, -quorum | 52>52, 76>76, 0>0 | 73>73, 88>88, 91>91 | a Bailiff's fight and a duel: to the seed |
| audit-3 | 81>81 | 100>100 | a Bailiff's fight and a duel: to the seed |
| finale-hadron, -lumen, -undertow | 92>94, 98>98, 79>82 | 99>98, 98>99, 95>92 | two open battles and a duel |
| hadron-5 | 83>83 | 93>93 | an open battle, then one to disable |
| undertow-4 | 91>97 | 78>88 | an open battle, then a boss |
| audit-1 | 89>95 | 100>100 | three lien drones, then a Bailiff's fight |
| lumen-5 | 92>99 | 21>86 | open, light machines, something to protect |
| audit-2 | 91>98 | 9>95 | open, light machines, something to protect |

On Veteran at the peak, with the bench: the hardest contract (verdict-quorum) is won 38 times in a hundred, as before, and 86 from the fourth telling, as before.

After H2 the same table reads the same: over all 176 pairs of contract and frame the mean win rate went from 70.6 to 70.7, and no pair moved by more than a few seeds. A field holds three machines, so when two fall in a turn there is one left to lose its nerve: the break ends a battle that was already won a turn sooner, and is seen.

Each part adds its column here.

## H1: Momentum and Shatter

**Files:** `src/core/battle.ts`, `src/core/types.ts` (`EnemyDef.leader`), `src/content/enemies.ts` (the Bailiff leads), `src/ui/battleFlow.ts` and `src/ui/battleScreen.ts` (what is said and shown), `src/platform/audio.ts` (the sound of a weapon ready again), `src/content/strings.ts`, `src/content/nl/strings.ts`, `src/content/codex.ts` and `src/content/nl/reference.ts` (two manual topics), `docs/handleiding.md`; tests in `tests/core/momentum.test.ts`, `tests/core/shatter.test.ts`, `tests/core/fantasy.test.ts`, `tests/ui/momentum.test.ts` (all new), and the older tests that came out otherwise on purpose (`tests/core/battle.test.ts`, `tests/core/balance2.test.ts`, `tests/core/balance3.test.ts`, `tests/ui/battleFlow.test.ts`, `tests/ui/cameraScreen.test.ts`, `tests/ui/overdrive2.test.ts`, `tests/ui/app5.test.ts`, `tests/ui/draw.test.ts`).

**Interfaces:**
- `BattleState.open: boolean`: the battle began against more than one machine and none of them leads. `leads(unit, objective): boolean`: phases, a portrait, a mark, `leader`, or the objective's target. `ordinary(state, unit): boolean`: an enemy in an open battle.
- `SHATTER = 0.5`. `ShotPreview` gains `shatter: boolean` and `kills: boolean`; a shattering hit's `damage` is all that is left of the core. The `shot` event gains `shatter?: true`.
- `UnitState.chain: number`: units this unit's volleys have destroyed in its current turn in an open battle; 0 when its turn begins.
- `BattleEvent` gains `{ type: 'momentum'; unit: string; weapon: WeaponSlot; chain: number }`, pushed for each unit a volley destroys, unless the volley ended the battle.
- In `resolveFire`, in an open battle: for a volley that destroyed a unit, the slot leaves `unit.fired` and, for a weapon that is not charged, `unit.energy` gets `weapon.energy` back, once a volley. Heat and the round stay spent.

- [x] Tests first (`momentum.test.ts`): a killing volley readies the weapon and returns its energy; heat is kept and the round is gone; a volley that only wounds, or misses, readies nothing; the chain counts and is 0 at the next turn; a charged weapon has to be charged again; a salvo that destroys one of three is ready again; an empty magazine is not offered; a kill by the ally off the field readies nothing; a third volley that overheats still costs the next turn.
- [x] The rule; the event. Measured: the figures above hardly moved (a kill in 43% of turns, two in 2%), because a machine that takes two volleys never starts a run.
- [x] Shatter (`shatter.test.ts`): half the core as it stood at full strength, measured on what arrives; a limb that is gone passes half on; nobody in a fight that is not open; never the pilot.
- [x] The hard fights measured (120 seeds): the first rule (Momentum everywhere, Shatter for whatever did not itself lead) made the audit and the verdicts much easier, Momentum most of all. Open battles, and the Bailiff as a leader, in its place: nine fights that are not open come to exactly what they came to before, kept by what they come to (`momentum.test.ts`).
- [x] The automatic player goes on with a weapon that is ready again (test: against two machines it can destroy in a volley each, it destroys both in one turn). It needed no telling.
- [x] The battle says so: SHATTERS and the weapon ready again in the log (CHAIN from the second in a turn), the weapon lit again in the menu, DESTROYS on the aiming line, a sound for a weapon that is back. Nothing is said or heard for the volley that ends a battle.
- [x] Two manual topics and the guide. Dutch.
- [x] `fantasy.test.ts`: the measurements as a test, open battles and the rest apart.
- [x] The balance tests measured again: the one war contract a full Ronin outguns (lumen-5) says so; what is protected in it no longer decides it at the peak. All tests, both browser halves, an APK.

## H2: They break

**Files:** `src/core/battle.ts`, `src/ui/battleFlow.ts`, `src/ui/battleScreen.ts`, strings, `src/content/codex.ts`, guide; tests in `tests/core/rout.test.ts` (new), `tests/ui/rout.test.ts` (new).

**Interfaces:**
- `UnitState.shaken?: boolean`, `UnitState.fled?: boolean`.
- `ordinary(state, unit)` from H1: the break is a rule of an open battle, like the two before it.
- `BattleEvent` gains `{ type: 'shaken'; unit: string }` and `{ type: 'rout'; unit: string }`.
- When a unit's chain reaches 2, every ordinary standing enemy of it is shaken. At the start of a shaken unit's turn it leaves: `fled`, counted as gone for everything that asks who stands, and no `unitDestroyed`.

- [x] Tests first (`tests/core/rout.test.ts`): shaken at the second kill of a turn and not at the first; not shaken by two kills in two turns; by one salvo that takes two; nobody is shaken in a fight that is not open (the nine fights of H1 still come to what they came to); a shaken machine leaves at its own turn and not before, and can be destroyed until then; a machine that left is not a kill (the record counts two, not three); the battle is won when the last one leaves, whatever the objective; a bomb leaves unexploded and a carrier launches no more.
- [x] The rule and its events. A machine that left is `destroyed` and `fled`: everything that asks who stands needs no telling.
- [x] The screen (`tests/ui/rout.test.ts`): the log says that it loses its nerve and that it breaks off; the word SHAKEN over it as it happens and as a tag in the panel, in place of what it was about to do; its eye low; it goes back the way it came, faster as it goes, fading, and leaves no wreck. The line for the last enemy is still said. A manual topic and the guide. Dutch.
- [x] The measurements again; the hard fights again (above). 30 small faults in the new code: found by the tests. All tests, both browser halves, an APK.

## H3: Swarms

**Files:** `src/core/battle.ts` (the reserve), `src/core/campaign.ts` (`Battle.reserve`), `src/core/mission.ts`, `src/core/board.ts` and `src/content/board.ts` (swarm contracts), `src/content/sidework.ts` (the standing job), `src/ui/briefingScreen.ts`, `src/ui/battleScreen.ts`, strings; tests in `tests/core/swarm.test.ts` (new), `tests/core/board*.test.ts`, `tests/ui/swarm.test.ts` (new).

**Interfaces:**
- `Battle.reserve?: string[]`: enemy ids that come on as room is made. `BattleState.reserve: string[]`.
- `BattleEvent` gains `{ type: 'arrive'; unit: string }`. At the start of a round, while fewer than `MAX_ENEMIES` enemies stand and the reserve is not empty, the next one comes on.
- A battle with a reserve is won when nothing stands and nothing is left to come.

- [ ] Tests first: the field is topped up at the start of a round and never past three; nothing arrives in the middle of a turn; the battle is not won while the reserve holds anything; a carrier's drones and the reserve share the three places; machines that break off make room like any other.
- [ ] The rule; the briefing's line and the field's counter.
- [ ] Swarm contracts on the open board and one standing job; what they pay; the automatic player's win rate and rounds on them by frame.
- [ ] The last contract of the Lumen war (lumen-5), which a full Ronin now outguns: more crawlers to come in its first battle, so that keeping the stack is a race again; `balance2.test.ts` holds it under 98 in a hundred again, or says why not.
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
- [ ] An open battle says that it is one as it opens (the banner), so that a pilot knows before the first shot which rules the fight is fought by.
- [ ] All tests, the soak for the new effects, an APK.

## H6: Review, soak, APK, summary

- [ ] A fresh reviewer reads the round against the spec and the Review Focus.
- [ ] The faults a reviewer names are answered one by one; small faults put into the new code are found by the tests.
- [ ] The whole suite, both halves of the browser tests, the soak, the last APK, the measurements before and after for the user.
