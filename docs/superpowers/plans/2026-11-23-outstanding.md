# Outstanding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pilot the player wrecked, drove off or lost to comes back three times as a notice beside the board, by callsign, in their own machine hardened against the weapon that hurt it most the last time.

**Architecture:** One new rule of battle (`hardened`: weapons, by id, that do half to a machine), one new module of rules (`src/core/grudge.ts`: how an account begins, when its notice is due, what the notice is, what winning it changes), two optional fields in the saved game, and the app's three seams (the list of contracts, the enemies a fight can field, the booking of a contract). Everything else is words and where they are shown.

**Tech Stack:** TypeScript, Canvas 2D, vitest, Playwright. Flown and measured with the game's own pilot.

**Spec:** `docs/superpowers/specs/2026-11-23-outstanding-design.md`

## Global Constraints

- `HARDENED = 0.5`: a weapon whose id is in a machine's `hardened` does half to that machine, in the preview and in the shot alike, and to no other machine. It is as likely to hit and pushes as hard.
- An account: `{ name, kind, origin: 'beat' | 'ran' | 'wrecked', knows?: string, met: 0 | 1 | 2, waited }`, kept as `grudge` in the saved game; callsigns of accounts closed as `accounts`. Both absent in a game that has none. One that is not the shape of an account is a saved game that is refused, as any field of the wrong shape is; one of the right shape about a machine no account can be about (or begun in a way this version does not know) reads as none.
- It begins only from a mech of the board's pool (`POOL` and `MECH_ENEMIES`), in a contract that counts (`countsForClass`), when no account is open and the board is at `GRUDGE_TIER = 3` or beyond. Reasons, strongest first: `beat`, `ran`, `wrecked`; then the dearest; then the first.
- The notice: id `open-<cycle>-<battlesWon>-grudge`, due when `waited >= [3, 2, 2][met]`, one battle, the named machine first (fielded under the key `grudge`, by its callsign) and the objective naming it, listed after the job and before the swarm. Losing it changes nothing.
- Their machine is the same kind at every meeting. It carries no mark. It is hardened against `knows` alone and plated `GRUDGE_NUMBERS.plating[met]` thicker; the enemy scale is the board's own for the tier.
- The board's three contracts, the job and the swarm are, for every progress, exactly what they were: the notice is on dice of its own.
- No balance test of what exists changes. (A pinned sample that moves because the same seeds are other flights is said so, beside the test and here.)
- Every new text has its Dutch within the room its kind has; an interface string in Dutch is at most two letters longer than the English with the same numbers in the same order; a briefing's body with a line for what the contract asks and one for the ground is at most eight lines.
- No callsign is a name the game already uses.
- No pictures this round. The proxy's address is never written into the repository.

## Review Focus

- A game saved before this round loads and shows no notice. One saved with a `grudge` of the wrong shape (`met` of 3, a `knows` that is not an id, a `waited` that is not a number) is refused like any other damaged save; one of the right shape whose `kind` is not a mech of the pool loads, shows no notice, and lets a new account begin.
- The same build flown three times: the weapon that does half is the one that did most the time before, the figure while aiming is the halved one, and the briefing's odds say what the fight then is. A build without that weapon: the figures while aiming are the weapons' own.
- A hardened machine's company: the same weapon does all of its damage to them.
- An account that begins in a contract of several battles: the reason and the weapon are read from all of them, not from the last.
- The notice across a reload, across a contract lost, and after a new telling of the story begins: the same pilot, the same machine, the same meeting.
- A fork's bolt that leaps on to the hardened machine, a salvo, a blade, a charged shot, a redline and a surge with a hardened weapon: half, each.

---

### Task O1: the rules, and the figures measured

**Files:**
- Create: `src/core/grudge.ts`, `scripts/grudge.ts`
- Modify: `src/core/types.ts` (`EnemyDef.hardened?: string[]`), `src/core/battle.ts` (`UnitState.hardened?`, `HARDENED`, `hardenedAgainst`, the factor in `shotOn`, `createEnemy`), `src/core/game.ts` (`grudge?`, `accounts?`, their shape in `isValidState`), `src/core/campaign.ts` (`Mission.grudge?: number`, the meeting, 1 to 3; `Mission.names?`), `src/core/economy.ts` (`Settlement.account?`), `src/core/jobs.ts` (`company` exported, able to leave machines out)
- Test: `tests/core/hardened.test.ts`, `tests/core/grudge.test.ts`, `tests/core/balance7.test.ts`

**Interfaces:**
- Produces, from `battle.ts`: `HARDENED: number`; `hardenedAgainst(target, weapon): boolean`.
- Produces, from `grudge.ts`:
  - `type GrudgeOrigin = 'beat' | 'ran' | 'wrecked'`; `interface Grudge { name: string; kind: string; origin: GrudgeOrigin; knows?: string; met: number; waited: number }`
  - `GRUDGE = 'grudge'` (what the notice's id ends with, and the key its machine is fielded under); `GRUDGE_MEETINGS = 3`; `GRUDGE_WAIT = [3, 2, 2]`; `GRUDGE_TIER = 3`
  - `interface GrudgeNumbers { plating: number[]; pay: number[]; par: number }`; `GRUDGE_NUMBERS` (set by the measurement below)
  - `interface Witness { kind: string; origin: GrudgeOrigin }`; `witness(state: BattleState): Witness | null`; `stronger(a, b): Witness | null`
  - `dealtBy(state: BattleState, target?: string): Record<string, number>`: armour the player's weapons took off the other side (or off one unit), by weapon id; `addDealt(a, b)`
  - `grudgeOf(game): Grudge | null` (the account, or null where there is none or it is about nothing an account can be about); `accountsClosed(game): number`
  - `isGrudge(mission): boolean`; `grudgeDue(game): boolean`
  - `interface GrudgeText` (callsigns, the title, the lines of a briefing and of a battle, debriefs; functions where a name goes in)
  - `grudgeContract(game, text: BoardText & GrudgeText, called: { machine(kind): string; weapon(id): string }, numbers?): Mission | null`
  - `grudgeEnemy(game, enemies: Record<string, EnemyDef>, numbers?): EnemyDef | null`
  - `interface Fought { seen: Witness | null; dealt: Record<string, number>; named: Record<string, number> }`
  - `bookGrudge<T>(game: T, mission, won: boolean, fought: Fought, names: string[]): T`: the one thing the app calls when a contract is booked: a won meeting is settled, any other won contract is waited through, and where no account is open one may begin.
  - `accountLine(game, mission): { name: string; meeting: number; closed: boolean } | null`: what the bill of a won meeting says.

- [x] Hardened. Tests first (`tests/core/hardened.test.ts`): a weapon in the list does in `previewShot` and in the shot fired what any machine takes from that weapon listed at half its damage; another weapon of the same unit does all of its damage; the same weapon does all of its damage to the machine beside it; a blade, a charged shot, a salvo, a surge, a redline and a fork's leap each do half; the push is the weapon's own; an enemy made from a definition without the list has none. Then the rule.
- [x] How an account begins. Tests first: `witness` over battles built by hand (a pool mech standing at a defeat and at a retreat; one that broke off; one that shut down where it stood, which is nobody; one destroyed; a story machine, a drone and a tower, which are nobody; two mechs, the dearer; two reasons, the stronger), `stronger`, `dealtBy`; `bookGrudge` with no account open (begins, with the weapon that did most; begins knowing nothing where nothing was hit), with one open (does not begin another), below the third tier, in a contract that does not count.
- [x] When it is due and what it is. Tests first: `waited` goes up with every other contract won and not with one lost; due at 3, 2 and 2; `grudgeContract` is null before that, and when due is the same for the same game and another after a contract won; its one battle (the named machine first under the key `grudge`, the objective naming it, company within what the budget leaves, never a mech, never a mender), its id, scale and fee; `grudgeEnemy` is the kind's own definition with the callsign, the plating of the meeting and the one weapon.
- [x] Winning it. Tests first: `met` up, `waited` 0, the same machine, `knows` the weapon that did most to the named machine this time (what it was, where nothing hit); the third win closes the account and writes the callsign down; a name closed is not given again while another is left; losing changes nothing.
- [x] The saved game. Tests first: a game from before loads with neither field; an account of the wrong shape is refused; one of the right shape about nothing an account can be about reads as none and lets one begin.
- [x] Measure and set `GRUDGE_NUMBERS` and `GRUDGE_TIER` (`scripts/grudge.ts`, kept). The tables are below.
- [x] `tests/core/balance7.test.ts`: the targets, held with a few flights of room.
- [x] Deliberate faults over the new lines; a test for each that is not caught. Commit. (What they found is under O2.)

### What was measured

Flown with `scripts/grudge.ts`: the game's own pilot, in the build the game suggests for each class at the stage,
with the perks a pilot has by then, against every mech the tier's budget pays for. All figures are wins in a
hundred on Standard unless it says otherwise.

**What the numbers were set against.** Three things were tried for how a meeting grows from the first to the third,
each with one weapon known. The lowest cell of each (a Ripper's third meeting, the classes together, with the
build's best weapon known), over the four tiers:

| How the third meeting is harder | Lowest to highest of that cell |
|---|---|
| The enemy scale times 1.15 | 35 to 57 |
| Plating of 0.3 | 37 to 65 |
| Plating of 0.5 | 26 to 48 |
| Plating of 0.2 | 44 to 75 |
| Plating of 0.15 (kept) | 49 to 80 |

A machine that hits harder each time, or is much thicker, is what makes a quick machine a wall; so it is a little
thicker and no stronger. And the tier an account can begin at: at the second, in the builds of the first act, a
named Ripper that knows nothing is won 58 times in a hundred and one that knows the best weapon 32; at the third,
in the builds of the war, 93 and 75. So accounts begin at the third.

**Machine by machine**, the seven classes together, 210 flights a cell: with nothing known / with the build's best
weapon known.

| Machine | Tier | First meeting | Second | Third |
|---|---|---|---|---|
| Mantis Ripper | 3 | 93 / 75 | 88 / 76 | 86 / 65 |
| | 4 | 90 / 70 | 80 / 55 | 77 / 49 |
| | 6 | 95 / 86 | 91 / 79 | 94 / 80 |
| | 8 | 99 / 89 | 92 / 80 | 85 / 61 |
| Wraith Stalker | 3 | 94 / 88 | 99 / 94 | 94 / 82 |
| | 4 | 92 / 86 | 90 / 75 | 86 / 70 |
| | 6 | 97 / 90 | 87 / 79 | 92 / 83 |
| | 8 | 95 / 87 | 90 / 77 | 84 / 65 |
| Halo Guard | 3 to 8 | 97 to 100 / 88 to 99 | 94 to 100 / 90 to 96 | 96 to 99 / 90 to 93 |
| The four heavy ones | 3 to 8 | 98 to 100 / 95 to 100 | 98 to 100 / 92 to 100 | 97 to 100 / 90 to 100 |

The lowest cell is a Ripper's third meeting at the fourth tier, where the builds of the war are at their thinnest
against the board (a hit is won 85 times in a hundred there, where it is 97 to 100 at the other three): 77 with
nothing known and 49 with the best weapon known.

**Over every machine and class**, with what a round of the fight nets beside what a round of a hit nets for the
same pilots:

| Tier | A hit | First: nothing known | First: known | Second: nothing | Second: known | Third: nothing | Third: known |
|---|---|---|---|---|---|---|---|
| 3 | 97, 257 a round | 96, 317 | 93, 190 | 98, 344 | 91, 193 | 96, 369 | 88, 206 |
| 4 | 85, 218 | 95, 298 | 90, 178 | 95, 269 | 87, 157 | 95, 434 | 89, 271 |
| 6 | 98, 403 | 99, 480 | 98, 300 | 96, 428 | 91, 262 | 95, 451 | 86, 270 |
| 8 | 100, 439 | 100, 437 | 98, 258 | 97, 419 | 90, 249 | 93, 280 | 84, 162 |

A build the machine knows nothing of is paid about what a hit pays for a round, or somewhat more. Bringing the
weapon it knows costs four to ten wins in a hundred over all and about four tenths of what a round nets: the
fight takes half as long again.

**On Veteran** (the enemy at 1.2) the same over all is 83 to 97 with nothing known and 67 to 91 with the best
weapon known. Machine by machine the quick ones are hard there with or without it: a Ripper at the fourth tier is
won 68, 55 and 46 times in a hundred with nothing known and 30, 29 and 19 with the best weapon known. That is
the hard difficulty's fourth tier, where a hit is won 77 times in a hundred; it is left as it is.

### Task O2: in the game

**Files:**
- Modify: `src/ui/app.ts` (`missions()`, `enemies()`, `MissionHost.count()` and `bookIfOver()`, `bookSettlement()`, the snapshot), `src/ui/briefingScreen.ts` (the notice's tag; a machine a contract has a name for goes by it in the list of what to expect and in what the contract asks), `src/ui/battleScreen.ts` (the word over a hardened machine, its tag, and the tag while a hardened weapon is aimed at it), `src/ui/settlementScreen.ts` (which meeting; account closed), `src/ui/pilotScreen.ts` (accounts closed)
- Modify: `src/content/board.ts` (the words: `GRUDGE_NAMES`, `GRUDGE_LINES`, `BOARD_TEXT.grudge`), `src/content/strings.ts`, `src/content/nl/strings.ts`, `src/content/nl/missions.ts`, `src/content/nl/reference.ts`, `src/content/nl/index.ts`, `src/content/codex.ts` (a chapter of the manual), `src/content/medals.ts`, `src/core/medals.ts`
- Modify: `README.md`, `docs/handleiding.md`
- Test: `tests/content/outstanding.test.ts`, `tests/ui/outstanding.test.ts`, `tests/content/docs.test.ts`, `e2e/outstanding.spec.ts`, `e2e/soak.spec.ts` (a player who closes an account)

**Interfaces:**
- Consumes everything O1 produces.
- Produces: `BOARD_TEXT` extended with `GrudgeText`; `STRINGS.tags.hardened`, `STRINGS.tags.half`, `STRINGS.briefing.account`, `STRINGS.settlement.account(meeting, of)`, `STRINGS.settlement.accountClosed`, `STRINGS.record.accounts(n)` beside the pilot's name on the record page; snapshot fields `grudge` (the account, or null), `accounts`, in a battle `hardened` (the first enemy's list) and `halved` (the weapon in hand does half to the machine aimed at), and on a bill `account`.

- [x] The words: sixteen callsigns, the title, briefing lines by origin and by meeting, the line that names the weapon (or says none is known), battle lines, debriefs; all with their Dutch, fitted.
- [x] The app: the notice in the list, the machine among the enemies, what a contract's battles saw and dealt gathered as they end, `bookGrudge` when the contract is booked, the bill's line.
- [x] Tests of the words and the wiring: no callsign is anybody's name; every notice (each callsign, machine, origin, meeting and place, with the longest weapon's name) fits its briefing in both languages; an account that begins, waits and is met through the app.
- [x] The screen: over the machine and in its row, `HARDENED`; while the weapon it is hardened against is aimed at it, `HALF` in the row; the bill; the pilot's page.
- [x] Three medals; the manual's chapter; the guide's chapter; the README. Docs tests that hold each claim to the game.
- [x] Browser tests with pictures: an account that begins, the notice three contracts later, its briefing, the meeting with the known weapon in hand (the halved figure) and with another, the bill; the third meeting and the bill that closes it; in Dutch.
- [x] Deliberate faults over the new lines; commit.

### What the deliberate faults found

137 faults were put into the new lines, one at a time, and the tests of the round run against each: 94 in the
rules (`battle.ts`, `grudge.ts`, `game.ts`, `jobs.ts`) and 43 in the screens, the app's wiring, the words and the
medals. 123 were caught by the tests as they stood. The 14 that were not each have a test now, and all 137 are
caught:

- **The rules (6).** An account met three times was read as an open one (`grudgeOf` is the second line behind the
  check of the saved game, and nothing asked it). A machine nobody can field was fielded (`grudgeEnemy` with a
  record that has no such kind). Over the battles of a contract, of two witnesses alike the later was kept, and a
  later battle's witness replaced a stronger one: the one test there had the stronger one come last. An account
  began with something that is not a mech of the board. And the three meetings of an account rolled the same dice
  at the same progress, which no player can come to (a meeting won is a contract won) and the measuring can.
- **The screen (2).** In a row with no room for everything, `HALF` or `HARDENED` made way before what the machine
  is about to do. There is a test of such a row now: both stay, the intent goes.
- **The words (6).** `BOARD_TEXT.grudge` read the wrong line for a place: one that beat the pilot or was wrecked
  briefed as one that ran, the second and third opening lines the wrong way round, what they say as they fall and
  the debriefs the wrong way round (the first bill said the account was closed), Dispatch saying what they say.
  The tests of the rules use words of their own, so nothing held the game's words to their places; a test does
  now, and another holds each line to what its place is for.

### Task O3: final check

- [ ] Read through once more; all tests; the endurance test with two players who have an account (one from its first notice on, who aims the weapon the machine knows by hand; one at the third meeting, in Dutch, who closes it); an independent review of the branch and its findings answered; the last APK; a short Dutch summary.
