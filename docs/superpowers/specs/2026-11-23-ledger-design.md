# The Ledger: faces to the names

Round after Outstanding. Stacked on `feat/outstanding`.

## Intent, and why

The last round put somebody on the board who knows the pilot: a pilot who comes back three times by
callsign. They are a callsign and a voice. Three things are missing, and all three were seen while
that round was built and reviewed:

1. **They have no face.** Everybody else in the game who speaks to the pilot does. A callsign in a
   box with no picture is the one moment in a fight that looks unfinished.
2. **An account begins in silence.** It begins when a machine breaks off, is wrecked or wins, and the
   pilot hears of it three contracts later, when they no longer remember which fight that was.
3. **Between meetings nothing can be looked up.** Who is it, in what machine, how many times has it
   been, what does their machine know, how long until they are back: all of it is in the saved game
   and none of it is on a screen.

This round gives them a face, an entrance, a moment when the account opens, and a page.

## Goals

- **Sixteen faces**, one for each callsign: original characters in the style of the game's other
  portraits. A callsign always has the same face.
- **Where the face is seen:** beside what they say in a fight (as it opens, as their machine falls),
  and on their page in the database.
- **An entrance.** A meeting opens the way a boss's battle does: the band across the field with their
  callsign and their machine from close by. The word on it is the notice's own (`OVERDUE`), not the
  boss's `WARNING`.
- **The moment it begins is said.** As the contract an account begins in is booked, an announcement
  comes up over the bill: a new account, and the callsign.
- **A page.** The database's page of people lists, after the people of the story, the account that
  is open and the accounts that are closed. The open one says what the pilot would otherwise have to
  remember: their machine and how it began, how many meetings there have been, what their machine is
  hardened against, and how many contracts until their notice is out (or that it is). A closed one
  says that it is closed.
- English and Dutch; the guide says where to look.

## Non-goals

- No new rule of battle and no change to any figure: the account is what the last round made it.
- No change to the shape of the saved game. A closed account is a callsign, as it was; its page says
  no more of it than that.
- The briefing stays Dispatch's: their face is not on it. The notice is briefed by the one who
  hands out the work.
- No faces for anybody else.

## Anti-goals

- A face that is somebody: a real person, or a character of another game. They are described from
  nothing, as the game's other portraits were.
- A page that gives away what has not happened: nobody is listed before an account with them begins,
  and there are no rows of unknowns for the callsigns not yet met.
- Spending that is not written down. Sixteen portraits at the lowest quality are about thirteen cents
  (the twenty made so far cost 0.83 cent each); the round may spend half a dollar at the most.

## Approaches

1. **Sixteen portraits, one a callsign** (chosen). They are people, and the game's faces are made
   one at a time; the cost is small.
2. One helmeted pilot, tinted sixteen ways. Cheaper and certain to match, and it makes them a
   uniform: sixteen copies of nobody.
3. Faces put together from parts when they are needed (hair, eyes, jaw). No cost and endless variety,
   and they would not look like the hand-made portraits beside them in the same box.

## How it works

- `GRUDGE_FACES` in `src/content/board.ts`: the sprite of each callsign's portrait. The words of an
  account (`GrudgeText`) carry it, and the notice puts it on the two lines its pilot speaks.
- The battle of a notice is opened with the entrance a boss has: the app names the machine that
  stands first, and the band is given the notice's word in place of the warning.
- `accountBegun(before, after)` in `src/core/grudge.ts`: the callsign of an account that is open in
  the game after a contract was booked and was not before. The app announces it as it announces a
  medal or a new page.
- `ledger(game)` in `src/core/grudge.ts`: the accounts as the page lists them: the closed ones in the
  order they were closed, then the open one. The database's page of people draws them after the
  story's people, each with its face, `OPEN ACCOUNT` or `ACCOUNT CLOSED` where a person has a role,
  and its lines.

## Constraints

- The proxy's address is never written into the repository; pictures are made at the lowest quality.
- Every new text has its Dutch, within the room its kind has.
- What a page says of an account is what the saved game says: the lines are made from the account,
  and tests hold each of them to it.

## Left to the builder

- What the sixteen look like.
- The exact lines, and where on the page they stand.
- Whether the count at the top of the page of people counts the accounts.
