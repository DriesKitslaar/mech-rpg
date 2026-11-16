import { dictionary, overlay, textsOf, translatable, type TextSlot } from '../language';
import { ARENA } from '../arena';
import { BOARD_TEXT } from '../board';
import { MANUAL, UNITS, WORLD } from '../codex';
import { DRILLS } from '../drills';
import { ENEMIES } from '../enemies';
import { MEDALS } from '../medals';
import { ENDINGS, EPILOGUES, MESSAGES, MISSIONS } from '../missions';
import { PERKS } from '../perks';
import { SCENES } from '../scenes';
import { STRINGS } from '../strings';
import { REMEMBERED } from '../talks';
import { WINGMEN } from '../wingmen';
import { MISSIONS_NL } from './missions';
import { REFERENCE_NL } from './reference';
import { STORY_NL } from './story';
import { STRINGS_NL } from './strings';

/**
 * Everything in the content that is text for the player, by what kind of text it is. The kind says
 * how much room there is for it; the tests hold every language to that room. Names of people,
 * machines, parts and places are not here: they are the same in every language.
 */
function contentTexts(): TextSlot[] {
  const battles = [...MISSIONS.flatMap((m) => m.battles), ...DRILLS.map((d) => d.battle)];
  const endings = [...Object.values(ENDINGS), ...Object.values(EPILOGUES).flatMap((byFaction) => Object.values(byFaction))];
  const choices = SCENES.flatMap((s) => (s.choice ? s.choice.options : []));
  return [
    ...textsOf('missions', MISSIONS, { title: 'mission.title', client: 'client', briefing: 'briefing', debrief: 'debrief' }),
    ...textsOf('missions', battles.flatMap((b) => b.talk ?? []), { text: 'battle.talk', who: 'who' }),
    ...textsOf('missions', battles.flatMap((b) => (b.objective && 'name' in b.objective ? [b.objective] : [])), { name: 'asset' }),
    ...textsOf('story', endings, { title: 'scene.title', body: 'scene.lines' }),
    ...textsOf('story', MESSAGES, { from: 'who', subject: 'message.subject', body: 'briefing' }),
    ...textsOf('story', SCENES, { heading: 'scene.heading', title: 'scene.title', lines: 'scene.lines' }),
    ...textsOf('story', SCENES.flatMap((s) => s.talk ?? []), { text: 'talk.text', who: 'who' }),
    ...textsOf('story', choices, { label: 'answer' }),
    ...textsOf('story', choices.map((o) => o.reply), { text: 'talk.text', who: 'who' }),
    ...textsOf('story', Object.values(REMEMBERED), Object.fromEntries(Object.values(REMEMBERED).flatMap((byAnswer) => Object.keys(byAnswer)).map((k) => [k, 'scene.lines']))),
    ...textsOf('reference', UNITS, { title: 'page.title', note: 'page.text' }),
    ...textsOf('reference', WORLD, { title: 'page.title', text: 'page.text' }),
    ...textsOf('reference', MANUAL, { title: 'page.title', text: 'page.text' }),
    ...textsOf('missions', DRILLS, { title: 'mission.title', lesson: 'drill.lesson', briefing: 'briefing', debrief: 'debrief' }),
    ...textsOf('reference', PERKS, { name: 'perk.name', description: 'perk.text' }),
    ...textsOf('reference', MEDALS, { name: 'medal.name', text: 'medal.text' }),
    ...textsOf('story', ARENA, { style: 'arena.style', taunt: 'arena.taunt' }),
    ...textsOf('missions', [BOARD_TEXT], { adjectives: 'board.word', nouns: 'board.word', clients: 'client', places: 'briefing', debriefs: 'debrief' }),
    ...textsOf('missions', [BOARD_TEXT.threats], Object.fromEntries(Object.keys(BOARD_TEXT.threats).map((id) => [id, 'briefing']))),
    ...textsOf('missions', WINGMEN, { text: 'briefing' }),
    ...textsOf('story', Object.values(ENEMIES).flatMap((e) => e.phases ?? []), { line: 'battle.talk' }),
    ...textsOf('reference', Object.values(ENEMIES).flatMap((e) => (e.partNames ? [e.partNames] : [])), { core: 'part.name', legs: 'part.name', arms: 'part.name', head: 'part.name' }),
  ];
}

translatable(contentTexts());
dictionary('nl', { ...MISSIONS_NL, ...STORY_NL, ...REFERENCE_NL });
overlay(STRINGS, STRINGS_NL, 'nl');
