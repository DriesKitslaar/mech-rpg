/**
 * Lists the texts of the content that have no Dutch yet, as JSON: for each, its kind and its English.
 * Usage: npx tsx scripts/untranslated.ts [source]     source: missions | story | reference
 */
import { dictionaryOf, registeredTexts } from '../src/content/language';
import '../src/content/nl';

const source = process.argv[2];
const nl = dictionaryOf('nl');
const seen = new Set<string>();
const missing = registeredTexts().filter((t) => (!source || t.source === source) && !Object.hasOwn(nl, t.english) && !seen.has(t.english) && seen.add(t.english));
console.log(JSON.stringify(missing.map(({ kind, english }) => ({ kind, english })), null, 1));
console.error(`${missing.length} without Dutch${source ? ` in ${source}` : ''}`);
