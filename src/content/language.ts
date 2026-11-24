/**
 * The language the game's text is in. English is what the content files hold; another language is
 * laid over them in place, so every screen that reads a text reads the language that is set, and
 * taking the language away puts the English back.
 */
export type Language = 'en' | 'nl';
export const LANGUAGES: Language[] = ['en', 'nl'];

let current: Language = 'en';
const appliers: ((language: Language) => void)[] = [];

export const language = (): Language => current;

/** Sets the language of all text. Screens built before the change keep what they had already laid out. */
export function setLanguage(next: Language): void {
  if (next === current) return;
  current = next;
  for (const apply of appliers) apply(next);
}

/** A number as the language writes it: Dutch has a comma where English has a point. */
export const figure = (n: number | string): string => (current === 'nl' ? String(n).replace('.', ',') : String(n));

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Puts every leaf of `from` into `into`, in place, so that whoever holds a part of `into` sees the change. */
function assign(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(from)) {
    if (isPlain(value) && isPlain(into[key])) assign(into[key] as Record<string, unknown>, value);
    else into[key] = value;
  }
}

/** The leaves of `like` as they are in `of` now, in the same shape: what has to be put back. */
function snapshot(of: Record<string, unknown>, like: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(like)) {
    kept[key] = isPlain(value) && isPlain(of[key]) ? snapshot(of[key] as Record<string, unknown>, value) : of[key];
  }
  return kept;
}

/**
 * A table of interface text (words, and functions that make sentences) in another language, of the
 * same shape as the English one. Laid over the English in place while that language is set.
 */
export function overlay(target: object, other: object, lang: Language): void {
  const english = snapshot(target as Record<string, unknown>, other as Record<string, unknown>);
  appliers.push((next) => assign(target as Record<string, unknown>, next === lang ? (other as Record<string, unknown>) : english));
}

/** One text of the content, where it lives: the thing that holds it and the key (or position) it is held under. */
export interface TextSlot {
  holder: Record<string | number, unknown>;
  key: string | number;
  /** What kind of text it is, for the checks on how much room it may take; see nl/index.ts. */
  kind: string;
  /** Which part of the content it comes from: the translation is kept in one file for each. */
  source: string;
}

const slots: { slot: TextSlot; english: string }[] = [];
const dictionaries: Partial<Record<Language, Record<string, string>>> = {};

/** Registers texts of the content to be looked up in a language's dictionary by their English. */
export function translatable(found: TextSlot[]): void {
  for (const slot of found) {
    const english = slot.holder[slot.key];
    if (typeof english === 'string') slots.push({ slot, english });
  }
}

/** The dictionary of a language: English text to that language's. A text with no entry stays English. */
export function dictionary(lang: Language, words: Record<string, string>): void {
  dictionaries[lang] = { ...(dictionaries[lang] ?? {}), ...words };
}

appliers.push((next) => {
  const words = dictionaries[next] ?? {};
  for (const { slot, english } of slots) slot.holder[slot.key] = Object.hasOwn(words, english) ? words[english] : english;
});

/** Every registered text with its English and its kind, for the tests that hold a language to the room there is. */
export const registeredTexts = (): { english: string; kind: string; source: string }[] =>
  slots.map(({ slot, english }) => ({ english, kind: slot.kind, source: slot.source }));
export const dictionaryOf = (lang: Language): Record<string, string> => dictionaries[lang] ?? {};

/** Finds texts in a list of things: for each thing, the named keys; a key that holds a list gives one text for each line. */
export function textsOf(source: string, things: readonly unknown[], keys: Record<string, string>): TextSlot[] {
  const found: TextSlot[] = [];
  for (const thing of things) {
    if (!isPlain(thing)) continue;
    for (const [key, kind] of Object.entries(keys)) {
      const value = thing[key];
      if (typeof value === 'string') found.push({ holder: thing, key, kind, source });
      else if (Array.isArray(value)) value.forEach((line, i) => { if (typeof line === 'string') found.push({ holder: value as unknown as Record<number, unknown>, key: i, kind, source }); });
    }
  }
  return found;
}

/**
 * The letters beyond the plain ones that Dutch spelling asks for, and that the game's font is known to
 * write at the width of every other letter: a browser test measures each (e2e/dutch.spec.ts). A text of
 * the game uses no other: one the font lacked would be drawn from another font, at another width.
 */
export const ACCENTED = 'éèëïöüêàçÉÈËÏÖÜ';
