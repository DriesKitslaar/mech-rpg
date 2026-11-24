import { language, type Language } from './language';

/** English words that have no capital inside a title. */
const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
/**
 * Names that keep their capital inside a Dutch title, which is otherwise written as a sentence is: the houses and
 * the people of Varn that a page of the database is called after, and the Gauntlet.
 */
const NAMES_NL = new Set(['mining', 'systems', 'undertow', 'strip-miner', 'overseer', 'mutual', 'auditors', 'actuary', 'adjuster', 'society', 'gauntlet']);

/** A word with its first letter, and the first after every hyphen, a capital. */
const capital = (word: string): string => word.replace(/(^|-)(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());

/**
 * A title that is kept in capitals, as a list writes it. In English as a title: every word with a capital but the
 * small ones inside it ("Kinds of Work"). In Dutch as a sentence: the first word and the names ("Frames van de
 * werf", "Hadron Mining"). A word with a figure in it, or of one letter, is a code and stays as it is kept.
 */
export function listTitle(title: string, lang: Language = language()): string {
  return title.split(' ').map((word, at) => {
    if (/\d/.test(word) || word.replace(/[^\p{L}]/gu, '').length === 1) return word;
    const lower = word.toLowerCase();
    const bare = lower.replace(/[^\p{L}-]/gu, '');
    if (at === 0) return capital(lower);
    if (lang === 'nl') return NAMES_NL.has(bare) ? capital(lower) : lower;
    return SMALL.has(bare) ? lower : capital(lower);
  }).join(' ');
}
