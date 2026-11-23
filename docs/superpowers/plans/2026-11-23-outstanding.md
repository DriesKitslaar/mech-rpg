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

(As the round was first built: a machine that knew a weapon from the contract the account began in, and a hardening
that did not wear. The independent review changed both; what was measured after it is under O3, and those are the
figures that stand.)

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

- [ ] Read through once more; all tests; the endurance test with two players who have an account (one at its second meeting, who aims the weapon the machine knows by hand; one at the third meeting, in Dutch, who closes it); an independent review of the branch and its findings answered; the last APK; a short Dutch summary.

### What the independent review found, and what was done about it

A reviewer who had seen none of the round's reasoning read the branch at 388e404 and ran what it suspected. Twelve
findings. All of them were so; two of them changed the rules.

1. **The briefing dropped its last line** in three of the board's four places ("Anything else does", and nothing
   after it; it was in a picture the round had committed). Three paragraphs have two gaps under them, so with a
   line for what the contract asks and one for the ground the page draws seven lines and not eight; the test
   counted lines against rows. *Now:* the notice has place lines of its own, one line each; the line about the
   hardening is shorter; the page says how many lines it draws (`briefingShown`, with the gap as `BRIEFING_GAP`)
   and every notice there can be is held to that in both languages; a screen test draws the page for every place,
   meeting and language and looks for every line on it; and the count is itself held to the page, on briefings
   made to fall on either side of the last row.
2. **A pilot with one weapon was shut out.** "One weapon" is one weapon id, and a build that carries only that one
   did half of everything for the whole battle: a pilot with a carbine and a shield won a third meeting with one of
   the three lightest machines at the fourth tier 13 to 27 times in a hundred, in fights that ran to the last round. That is the design's own
   anti-goal ("a build that cannot win because it was the build that won last time"), met in a build the
   measuring had not flown. *Now the hardening wears:* what it keeps off the machine comes off the hardening,
   which is a third of the armour the machine's core stands in, and at nothing it is gone. How much is left is
   beside the machine's name, and its going is said, written and heard. The figures are below.
3. **Accounts begin by contracts won, not by where the story is,** so a pilot who has won fifteen contracts in
   first-act gear meets one: in that gear a Ripper is hard with nothing known, and was worse with a weapon known
   from the start. *Now* the first meeting is the machine as it comes (see 4), which is what a named Ripper is for
   that pilot anywhere on the board; the notice waits and costs nothing to leave. The figures are below.
4. **The first notice said what was not so.** It said the machine was hardened against the weapon "which hurt it
   most last time", and what it knew was the weapon that did most in the contract the account began in, to
   everything in it: in one account in four that was not the weapon that did most to that machine, in one in eight
   it had not hit it at all, and one that was wrecked comes back in another machine. *Now* an account begins
   knowing nothing. What they know they learn in a meeting, where the machine is theirs.
5. **Dispatch said "it was built for what you hit it with last time"** of a machine that knew nothing. *Now* there
   are two lines, and which is said goes by whether the machine knows a weapon.
6. **Beside a shield drone the word HARDENED was never written over the machine:** the word for cover stood there
   for the whole battle. *Now* the two take turns, as an elite's mark and cover do.
7. **`dealtBy` added up what each shot was worth, not the armour it took off,** so a great shot into a part with
   little left counted for all of it (in one meeting in twelve that changed which weapon was learnt). *Now* a hit
   that took off less than it was worth says what it took (`took` on the shot), and that is what is added up.
8. **What counts as a contract.** Arena fights, duels and replays from the archive are waited through like any
   contract won (they are on the pilot's count of contracts won), and a replay can begin an account. *Kept as it
   is,* and the guide now says that whatever is on that count counts.
9. **The Dutch.** "die hem de vorige keer het meest deed", "om jou heen laten bouwen" and "Vlieg goed" were
   English in Dutch words; the one pilot was "die", "ze", "hun" and "hij" by turns. *Now* rewritten, and their
   pilot is a callsign, "de piloot" or "die" in the game and in the guide; tests hold that.
10. **English lines that did not fit every account they were said of:** "put you down" of a pilot who walked away,
    "losing to you once" of one who had lost twice, "another wreck" of a first one, a place line that spoke of a
    client, "Their leader is down" of one who came alone. *Now* rewritten, with a test of what none of them may
    say; a machine that fell alone is down by its name.
11. **Claims held by nothing.** The guide's "more than a third less a round" was true and no test held it; the
    script's best weapon was the best over all the tier's machines, where its header said per machine. *Now* the
    guide says what the balance test holds (longer, and less a round), and the script does what it says.
12. **The Gauntlet built its names from every machine a fight can field,** the account's among them, so a kind
    could have been called by a callsign. No warden is a machine an account can be about, so nothing showed.
    *Now* it reads the machines there are and nothing that is made for the pilot.

### What was measured after the review

`scripts/grudge.ts` as it now is: the first meeting with nothing known, which is how it is met; the second and third
with nothing known and with the weapon that takes most armour off that machine known, class by class and machine by
machine. All figures are wins in a hundred on Standard unless it says otherwise.

**How much the hardening takes.** As a share of the armour the machine's core stands in. For the classes' own
builds (two or three weapons), the quick machines at the fourth and eighth tier, third meeting, best weapon known
(105 flights a cell); and for a pilot with one weapon (the reference build of the war with a carbine and a riot
shield), the lowest and highest of eight cells (four machines at the third and fourth tier), third meeting, the
carbine known (30 flights a cell):

| The hardening | Ripper, tier 4 | Stalker, tier 4 | Ripper, tier 8 | Stalker, tier 8 | One weapon, third meeting |
|---|---|---|---|---|---|
| Does not wear | 47 | 62 | 57 | 60 | 13 to 83 |
| Half the core's armour | 49 | 64 | 59 | 63 | 37 to 93 |
| A third (kept) | 57 | 65 | 62 | 68 | 50 to 100 |

A build of several weapons does about half its work with the one the machine knows and seldom sees the end of a
hardening of half the core; one of a third it is through late in the fight, which is worth a few wins. The pilot
with one weapon is through it before the fight is half done.

**Machine by machine**, the seven classes together, 210 flights a cell. The first meeting; then the second and
third with nothing known / with the best weapon known.

| Machine | Tier | First meeting | Second | Third |
|---|---|---|---|---|
| Mantis Ripper | 3 | 93 | 88 / 83 | 86 / 78 |
| | 4 | 90 | 80 / 65 | 77 / 61 |
| | 6 | 95 | 91 / 81 | 94 / 85 |
| | 8 | 99 | 92 / 85 | 85 / 68 |
| Wraith Stalker | 3 | 94 | 99 / 95 | 94 / 87 |
| | 4 | 92 | 90 / 78 | 86 / 74 |
| | 6 | 97 | 87 / 84 | 92 / 85 |
| | 8 | 95 | 90 / 85 | 84 / 72 |
| Halo Guard | 3 to 8 | 97 to 100 | 94 to 100 / 93 to 98 | 96 to 99 / 92 to 97 |
| The four heavy ones | 3 to 8 | 98 to 100 | 98 to 100 / 93 to 100 | 97 to 100 / 92 to 100 |

The lowest cell is still a Ripper's third meeting at the fourth tier: 77 with nothing known and 61 with the best
weapon known, where it was 49.

**Over every machine and class**, with what a round of the fight nets beside what a round of a hit nets for the
same pilots:

| Tier | A hit | First | Second: nothing | Second: known | Third: nothing | Third: known |
|---|---|---|---|---|---|---|
| 3 | 98, 285 a round | 98, 357 | 98, 360 | 95, 241 | 96, 393 | 92, 256 |
| 4 | 86, 242 | 96, 339 | 96, 287 | 92, 192 | 95, 466 | 93, 330 |
| 6 | 98, 406 | 99, 471 | 96, 444 | 94, 316 | 96, 478 | 89, 310 |
| 8 | 100, 443 | 100, 442 | 98, 432 | 94, 298 | 95, 309 | 89, 208 |

A build the machine knows nothing of is paid about what a hit pays for a round, or somewhat more. Bringing the
weapon it knows costs two to seven wins in a hundred over all and about a third of what a round nets: the fight
takes a third as long again. The class that does worst with its best weapon known wins 75 to 90.

**A pilot with one weapon** (a carbine and a riot shield on the reference build of the war), 60 flights a cell, the
second and third meeting: with nothing known / with the carbine known and a hardening that does not wear / as it is.

| Machine | Tier 3 | Tier 4 |
|---|---|---|
| Mantis Ripper | 100, 100 / 90, 67 / 100, 93 | 98, 93 / 40, 15 / 88, 60 |
| Wraith Stalker | 100, 93 / 57, 40 / 90, 83 | 88, 82 / 32, 13 / 65, 65 |
| Halo Guard | 88, 97 / 42, 32 / 87, 83 | 97, 92 / 17, 27 / 82, 75 |
| Bulwark Enforcer | 100, 100 / 92, 92 / 100, 100 | 100, 98 / 77, 78 / 92, 90 |

At a disadvantage, and not shut out. The classes' own builds stripped to their best weapon are thin builds with
nothing known (a third meeting with a quick machine is won 41 to 55 times in a hundred) and win 24 to 31 with it
known, where they won 8 to 10.

**In first-act gear at the third tier** (a pilot who has won fifteen contracts and bought nothing for the war), the
first meeting, then the second and third with nothing known / with the best weapon known:

| Machine | First | Second | Third |
|---|---|---|---|
| Mantis Ripper | 59 | 46 / 29 | 39 / 25 |
| Wraith Stalker | 78 | 71 / 52 | 65 / 45 |
| Halo Guard | 87 | 85 / 75 | 89 / 80 |

A Ripper is a hard machine for that pilot wherever it is met, and its notice is no easier. It is left: the notice
waits for as long as it is left alone, a contract lost costs what any contract lost costs, and the gear of the war
is what the money of fifteen contracts is for.

**On Veteran** (the enemy at 1.2) the same over all is 86 to 98 with nothing known and 75 to 86 with the best
weapon known. Machine by machine the quick ones are hard there with or without it: a Ripper at the fourth tier is
won 68, 55 and 46 times in a hundred with nothing known and 33 and 23 at the second and third meeting with the best
weapon known. That is the hard difficulty's fourth tier, where a hit is won 78 times in a hundred; it is left as it
is.

### What deliberate faults found in what the review changed

55 faults over the new lines (the wearing, what a shot took off, what is learnt and when, the words by what the
machine knows, the turns of the word over the machine, the count of lines a page draws). 45 were caught by the
tests as they stood. Of the ten that were not, nine have a test now and are caught: a hardening that does not wear
was worn out by its first hit (every test of one fired once); one with exactly nothing left held for a hit more;
what a barrier took was not counted against the hardening; and five in `briefingShown`, which nothing held to the
page it speaks for, so that a count that called every line drawn passed every test of fit. The tenth was the
Gauntlet's guard against a name that could not occur: the line is gone, and the Gauntlet reads the machines there
are.
