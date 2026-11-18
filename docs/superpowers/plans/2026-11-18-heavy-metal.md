# Heavy Metal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pilot who outguns the field feel it: a heavy weapon goes through a light machine, a kill readies the weapon again, two kills in a turn break what is left, swarms give that something to run through, the record earns a name, and an overkill looks like one.

**Architecture:** Momentum, Shatter and the break are rules of the battle (`src/core/battle.ts`) that say what happened in events; screens and sound only read the events. They are rules of an *open* battle (`BattleState.open`: more than one machine at the start, none of which leads), settled when the battle is made: a fight that is not open runs through none of the new code. A reserve is a list on the battle's state that the start of a round draws from. The name is worked out from the record a game already keeps: nothing new is saved.

**Tech Stack:** TypeScript, Canvas 2D at 310x270, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-heavy-metal-design.md`

## Global Constraints

- A saved game from before this round loads and stays valid; nothing new is saved.
- A fight that is not open (against one machine, or with a boss, a named pilot, an elite, a Bailiff or an objective's target in it) plays exactly as before, seed for seed, to its last event.
- A hard fight stays hard: where a fight against a boss or a named pilot is won more often by more than a few seeds, the rule is changed, not the test. (As the review measured it, this holds of the fight from the state it is entered in, which is seed for seed what it was. A boss met after an open battle of the same contract is met with more left, and that contract is won more often: see H6.)
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
- [x] H3: Swarms (branch `feat/heavy-swarm`)
- [x] H4: A name (branch `feat/heavy-name`)
- [x] H5: Weight (branch `feat/heavy-weight`)
- [x] H6: Review, soak, APK, summary (branch `feat/heavy-review`)

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

**Files:** `src/core/battle.ts` (the reserve), `src/core/campaign.ts` (`Battle.reserve`), `src/core/mission.ts`, `src/core/rank.ts` (par), `src/core/codex.ts` (machines met), `src/core/board.ts` and `src/content/board.ts` (the swarm beside the board), `src/ui/app.ts` (the contracts on offer), `src/ui/briefingScreen.ts`, `src/ui/battleFlow.ts`, `src/ui/battleScreen.ts`, `src/ui/battleFx.ts`, `src/platform/audio.ts`, strings, `src/content/codex.ts` (a manual topic), guide; tests in `tests/core/swarm.test.ts`, `tests/core/board3.test.ts`, `tests/ui/swarm.test.ts`, `e2e/heavy.spec.ts` (all new), `tests/core/fantasy.test.ts`.

**Interfaces:**
- `BattleOptions.reserve?: EnemyDef[]`; `BattleState.reserve: EnemyDef[]` (still to come, in order; empty where there never were any). `Battle.reserve?: string[]` on a contract's battle.
- `BattleEvent` gains `{ type: 'arrive'; unit: string; left: number }`. As a round begins, after the ally's fire and after what stood has been counted against what is protected, as many of the reserve come on as there is room for (`MAX_ENEMIES`), each in the first free place.
- A battle is won when nothing stands and nothing is left to come. `open` is asked of the field and the reserve together.
- `swarmContract(battlesWon, cycle, text): Mission`, id `open-<cycle>-<won>-swarm`, `isSwarm(mission)`; `SWARM_MIN = 6`, `SWARM_MAX = 9`, `PAY_PER_HEAD = 160`, `SWARM_KINDS` by the board's tier.
- `parOf`: one round more for each machine of the reserve.

- [x] Tests first (`swarm.test.ts`): the field is topped up as a round begins and never past three; nothing arrives in the middle of a turn; as many as there is room for at once; the battle is not won while the reserve holds anything; the order given is the order they come in; a machine that comes on has the next name, number and place, the battle's scale, and a turn in that round; a carrier's drones and the reserve share the three places; a machine that breaks off holds its place until it leaves, and what comes on after it has seen nothing; what is protected is counted before the new ones; a battle to be outlasted is won at its time.
- [x] The rule; the briefing's line and the count of the machines; the strip on the field (`4 MORE TO COME`, or `+4` after what else the battle asks); a machine that comes on is said, heard and seen in a ring of light, and stands where the last one fell.
- [x] The swarm beside the board (`board3.test.ts`): always on offer once the open board is, a new one after every battle won, on dice of its own so that the board is the board it always was. Recon drones up to the third tier, with bomb crawlers from there, with gunships from the sixth. Measured, 40 seeds a frame: won 98 to 100 times in a hundred by the frames of each stage in 2 to 11 rounds, net 670 to 1360. Hunter drones were tried first: 45 to 75 in a hundred and 13 to 36 rounds, so they are not in it.
- [x] No standing job beside it: the swarm is always there and always new, which is what a standing job would have been.
- [x] The last contract of the Lumen war, measured with one to three more crawlers to come and a sturdier stack: a full Ronin still wins 99 in a hundred, and the frame before it falls from 23 to 2 on Veteran. Left as it was; `balance2.test.ts` says why.
- [x] What a swarm is like (`fantasy.test.ts`): starter frame, a kill in 54 turns of a hundred, two or more in 30, three in 19; a full Ronin, 90, 61 and 33; the heaviest frame with every perk, 72, 42 and 4, and 1.3 machines a battle leave.
- [x] A manual topic, the guide, Dutch. 38 small faults in the new code: found by the tests. A browser test with screenshots. All tests, an APK.

## H4: A name

**Files:** `src/core/renown.ts` (new), `src/ui/pilotScreen.ts`, `src/ui/battleScreen.ts` (the band under the banner), `src/ui/battleFlow.ts` (what the bar opens with), `src/ui/app.ts` (the announcement; what a battle is opened with), strings, `src/content/codex.ts` (a manual topic), guide; tests in `tests/core/renown.test.ts`, `tests/ui/renown.test.ts` (new), `e2e/heavy.spec.ts`.

**Interfaces:**
- `RENOWN = { kill: 1, boss: 8, arena: 4, cycle: 40 }`, `NAME_AT = [20, 60, 150, 320, 600]`.
- `renownOf(game): number`; `nameRank(game): number` (0 for none, then 1 to 5); `nextNameAt(game): number | null`.
- `FlowOptions.opening?: string`: what stands in the message bar as the battle opens. `BattleScreen` option `pilot?: string`: the band under the banner.
- No field in the saved game. A name is announced when a save raises the rank of the game in memory.

- [x] Tests first (`renown.test.ts`): what counts and what does not; the ladder, each name at its mark and not one short; a new game has no name; the name never goes down; where a career reaches each (measured with the career bot, story and arena only: 33 after eight contracts won, 64 after fifteen, 185 at the end of a first telling, 334 after two, 482 after three, so the last name takes work beside the story).
- [x] The pilot's record: the name, its line, and the renown against the next mark, in a panel under the ranks held.
- [x] The announcement, once, as it is earned; two marks passed at once are the higher name; a game loaded with a name is told nothing. (The plan had an old save announced once. With nothing saved there is nothing to say it was, so it is not announced at all.)
- [x] The banner's band (not in a drill, not under a boss's warning) and the message bar's opening line in an open battle. Dutch: Kostenpost, Afboeking, Total Loss, Overmacht, De Eindafrekening.
- [x] A manual topic and the guide. 25 small faults in the new code: found by the tests. A browser test with screenshots. All tests, an APK.

## H5: Weight

**Files:** `src/core/battle.ts` (`OVERKILL`, `overkill` on the event), `src/ui/battleFx.ts` (the words, `harder`, what is written drawn over what burns), `src/ui/battleScreen.ts` (the harder blast and what is thrown, the banner's tag), `src/platform/audio.ts` (the slam, `chain2`, `chain3`), strings, `src/content/codex.ts` (a manual topic), guide; tests in `tests/core/overkill.test.ts`, `tests/ui/weight.test.ts` (new), `tests/content/claims.test.ts`.

**Interfaces:**
- `OVERKILL = 1.5`; `{ type: 'unitDestroyed'; unit; overkill?: true }`.
- `BattleFx.harder(unitId)`; `OVERKILL_SIZE = 1.5`, `OVERKILL_UP = 24`; `WRECK_MS` exported; sounds `chain2`, `chain3`.
- Strings `fx.overkill`, `fx.chain(n)`, `fx.rout`, `battleIntro.open` ('MOMENTUM' / 'DOORSTOTEN').

- [x] Tests first (`overkill.test.ts`): `unitDestroyed` says `overkill: true` when one hit did, past any barrier, at least one and a half times the core at full strength; one point less is not one; through a lost limb it is the half that passes on that is measured; a shattering is never one for that alone; in every fight, open or not, and of the pilot too; never of what a bomb, an ally or a fuse destroyed; nothing else in a battle changes.
- [x] The plan had twice what was left of the core. Measured (frames of the shop, the contracts and swarms of their stage): against what was left, 6 to 25 kills in a hundred of the story were one (every finishing blow on a worn machine) and none in a swarm; against the whole core at twice, none but two in a hundred for the fifth frame; at one and a half, none for the first three frames, 8, 8 and 1 in a hundred of the story for the fourth, fifth and sixth, and 45, 34 and 9 in a hundred of their swarms (a pilot with the bench at its limit: 16 to 57); at once the core, 74 to 88 in a hundred of a grown pilot's swarm. One and a half times the whole core it is, and `overkill.test.ts` keeps the swarm figures.
- [x] The word and the harder burst for an overkill; the counter and the rising note for a chain; the word for a rout. Calm setting: words only. Nothing holds a turn up (test: the same number of frames to the next choice with and without). Not for the pilot's own mech, and not in the close look at the last machine, which has its own staging.
- [x] Looked at in a browser: the word was lost behind the blast that came after it, and was written into the figure of the hit. What is written is now drawn over what burns (figures too), and the word stands 24 above where the figure was written.
- [x] An open battle says that it is one as it opens (the banner), so that a pilot knows before the first shot which rules the fight is fought by; it never runs into what the battle asks, in either language.
- [x] A manual topic (OVERKILL) and the guide. The manual's topics of this round are held against the rules themselves (`claims.test.ts`): half a core, one and a half times, two in a turn, three at a time, what a name is earned by.
- [x] 73 small faults put into the new code and the manual, one at a time: 72 found by the tests. The one that is not is no fault (the core at full strength of "the part that was hit": a machine is only ever destroyed through its core). All tests, the soak, an APK.

## H6: Review, soak, APK, summary

Two fresh reviewers, in parallel: the rules (with a differential check against the version before), and the screens, the text and the Dutch. Their findings and what was done with each are in the spec, under "What the review found, and what it changed". As built:

**Rules** (`src/core/battle.ts`, `board.ts`, `mission.ts`, `campaign.ts`, `training.ts`)
- [x] `momentum` is said once for a volley, when all of it has landed, after whatever lost its nerve at it; never when the volley ends the battle (a salvo used to say it for each kill, and to shake a machine it destroyed a moment later).
- [x] `{ type: 'rout'; unit; fixed?: true }`: a machine that cannot move shuts down where it stands. `UnitState.fled` is gone (nothing read it): what was said of a machine is how it ended.
- [x] `leads(def, mark?, named?)`: one function over what a battle is made from. `UnitState.leader` is gone.
- [x] `BattleOptions.closed` / `Battle.closed`: never an open battle. `drillMission` sets it. Every drill, three seeds each, plays to its last event as on the version before (`tests/core/training.test.ts`).
- [x] `ShotPreview.kills` is false of the machine a contract wants driven off: no hit destroys it.
- [x] `overkill` is marked on machines of the other side only.
- [x] A machine has a letter where the battle has, had or will have another of its kind, on the field or still to come.
- [x] `SWARM_GUNSHIPS = 2`. Measured on the swarms of thirty to thirty-nine wins, six seeds each, Standard and Veteran: won 97 in a hundred or more by the fifth and sixth frames, none at the round limit; a grown pilot under ten rounds, the heaviest frame as sold under eighteen on Veteran (`tests/core/board3.test.ts`).
- [x] The Gauntlet's depth is pinned (`tests/core/gauntlet.test.ts`): 7.9 floors over forty runs without a second life, 7.35 before the round.

**Screens** (`src/ui/battleFlow.ts`, `battleScreen.ts`, `battleFx.ts`, `fxPaint.ts`, `src/platform/audio.ts`)
- [x] What a kill gave back is said as it is of use (`STRINGS.momentum`: ready, charge, empty, boost, clear), stands in the bar as the turn is handed back and holds nothing up: a kill in an open fight hands the turn back in as many frames as in one that is led. The weapon menu opens on the weapon the kill readied. A weapon readied for nothing is not heard to be ready.
- [x] Machines that come on together, or lose their nerve together, are said in one line (`arriveMany`, `shakenMany`).
- [x] The strip counts machines still to come as far as the bar has said. A machine has its bars until it is seen to go. SHAKEN is the mark over a shaken machine's head, from when it is said, and a shaken bomb says nothing of its fuse.
- [x] A machine that leaves takes its shadow, the light under it and the light of its eye with it. One that shuts down fades where it stands, under OFFLINE, to a hiss.
- [x] What is written is clear of what else is written over the same unit (`WORD_GAP`): OVERKILL over BLOCK over the figure; the count of a run over OVERHEAT; one count at a time. A word is kept inside the field at the size it lands at.
- [x] Not changed, with the reason in the spec: the aiming line's DESTROYS without ALL or xN; the calm pulse of a shaken machine; the strip's "+N" beside an objective.

**Text** (`src/content/codex.ts`, `board.ts`, `nl/`, `docs/handleiding.md`)
- [x] Swarm titles: "Rust Tide" for the one that was a story contract's, and a Dutch title for each of the eight.
- [x] The six manual topics rewritten so that every sentence is true of the rules, each sentence held against them in `tests/content/claims.test.ts` (39 tests): where Momentum holds and what it gives back, half a core, one and a half times and "how worn makes no difference", two in a turn with the pilot's weapons, out of the fight without firing, not a kill, three at a time, as a round begins, not won until none are to come, paid by the head, what a name is earned by and where.
- [x] The guide: the rule as it is, the banner's word, drills and the Gauntlet, a boss met fresher, OVERKILL in the reviewer's plainer Dutch, eleven drills, "kern" as the game calls it.

**Tests and checks**
- [x] The rules the review found unpinned: a bomb that goes off and a module's kill are no overkill; an ally's fire does not shatter; a module's kill is no link in a chain; a shaken machine is counted against what is protected while it stands, and leaves at its turn though overheated or staggered; a Second Wind is refused after a volley that paid for itself.
- [x] The browser test of a swarm accounts for every machine (destroyed, on the record; or said to leave) and waits for a screen with no announcement on it. The soak flies a swarm in each of its six runs.
- [x] Small faults put into the changes one at a time: the count is in the pull request.
- [x] The whole suite, both halves of the browser tests, the soak, the last APK, the measurements before and after for the user.

**After the review, measured again** (frames of the shop, automatic player): an overkill is 45, 65 and 9 kills in a hundred of the swarms of the fourth, fifth and sixth frames (with two gunships at most there are more drones in them), 15 to 55 for a grown pilot; 8, 8 and 1 in a hundred of the story.
