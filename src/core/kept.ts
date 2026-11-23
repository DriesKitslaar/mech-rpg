/**
 * What a kept game may hold of the lists and counts the game itself adds to. The reader of a kept game
 * holds it to these (`isValidState`), and whoever writes one of them holds what it writes to the same:
 * so the game never writes a game it would then refuse to open, whatever it was handed.
 */

/** An id as a page of story, a letter or a part has one. */
export const PLAIN_ID = /^[a-z0-9-]{1,64}$/;
/** How many ids a list of things told or of mail may hold. */
export const MAX_IDS = 1000;
/** The id of a bout that can be won again, and how many of them a game may hold a count for. */
export const BOUT_ID = /^[a-z0-9-]{1,48}$/;
export const MAX_BOUTS = 64;
/** The most a count kept with the game may say. */
export const MAX_COUNT = 1_000_000;

/** A list of ids as a kept game may hold one: only plain ids, and of too many the last. */
export const keptIds = (list: readonly unknown[]): string[] =>
  list.filter((id): id is string => typeof id === 'string' && PLAIN_ID.test(id)).slice(-MAX_IDS);
