import { ARCHETYPES } from '../../src/core/archetype';
import { ARENA } from '../../src/content/arena';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';

/** The single things a condition is made of: what stands between its `|` and `&`, without a `!`. */
export const termsOf = (condition: string): string[] => condition.split(/[|&]/).map((term) => term.replace(/^!/, ''));

/** The questions the story asks in a conversation, by id, with the answers each can be given. */
export const storyQuestions = (): Map<string, string[]> =>
  new Map(SCENES.flatMap((scene) => (scene.choice ? [[scene.choice.id, scene.choice.options.map((o) => o.id)] as [string, string[]]] : [])));

/**
 * Everything a pilot's decisions are remembered under: the story's questions, and the contracts
 * that can be flown as the other side offers them (each is remembered as the one answer it has).
 */
export const questions = (): Map<string, string[]> =>
  new Map([
    ...storyQuestions(),
    ...MISSIONS.flatMap((mission) => (mission.other ? [[mission.other.question, [mission.other.answer]] as [string, string[]]] : [])),
  ]);

/**
 * The terms of a condition that name nothing there is: a contract that is not in the game, an
 * answer nobody can give, an arena rank past the last, more crowns than there are, a number that is
 * no number. Empty when the
 * condition can come true.
 */
export function unknownTerms(condition: string): string[] {
  const ids = new Set(MISSIONS.map((m) => m.id));
  const asked = questions();
  return termsOf(condition).filter((term) => {
    if (['start', 'choice', 'finale', 'verdict', 'seat'].includes(term)) return false;
    const colon = term.indexOf(':');
    if (colon < 0) return !ids.has(term);
    const [kind, rest] = [term.slice(0, colon), term.slice(colon + 1)];
    if (kind === 'chose') {
      const [question, answer] = rest.split('=');
      return !(asked.get(question) ?? []).includes(answer);
    }
    if (kind === 's') return !ids.has(rest);
    const n = Number(rest);
    if (!Number.isInteger(n) || n < 0) return true;
    if (kind === 'arena') return n < 1 || n > ARENA.length;
    // Crowns: one at least, and no more than there are classes.
    if (kind === 'crowns') return n < 1 || n > ARCHETYPES.length;
    return !['cycle', 'floor', 'checks'].includes(kind);
  });
}
