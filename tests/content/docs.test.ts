import { readFileSync } from 'node:fs';
import { ARCHETYPES } from '../../src/core/archetype';
import { BUILD_SLOTS, LOADOUT_SLOTS } from '../../src/core/game';
import { launches } from '../../src/core/launch';
import { SEAT_PURSE, seatPurse } from '../../src/core/seat';
import type { FramePart, Weapon } from '../../src/core/types';
import { ARENA } from '../../src/content/arena';
import { MANUAL } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { MASTERS } from '../../src/content/masters';
import { MEDALS } from '../../src/content/medals';
import { REFERENCE_NL } from '../../src/content/nl/reference';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, SHOP_PARTS, SHOP_UNLOCKS } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { KEEPER } from '../../src/content/seat';
import { SONGS } from '../../src/content/songs';
import { STARTERS } from '../../src/content/starters';
import { STRINGS } from '../../src/content/strings';
import { FAST_BATTLE_SPEED } from '../../src/ui/app';
import { LAMPS_AT, LAUNCH_MS } from '../../src/ui/launch';
import { CROWN_PAINTS, PAINTS, SEAT_PAINT } from '../../src/ui/paint';

/**
 * The README's list of what is in the game, held to the game: a figure written there is the count
 * of the thing it names. It went stale once (parts, medals, songs and saved builds, four rounds
 * running) because nothing read it.
 */

const README = readFileSync('README.md', 'utf8').replace(/\s+/g, ' ');
const WORDS = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien'];
const word = (n: number): string => WORDS[n];
const capital = (text: string): string => text[0].toUpperCase() + text.slice(1);

describe('the README counts what is there', () => {
  test('the machine: its slots, the shop\'s parts, the paints and who earns the others, the saved builds, the starters', () => {
    expect(README).toContain(`**Mecha**: ${word(BUILD_SLOTS.length)} sloten`);
    expect(README).toContain(`en ${SHOP_PARTS.length} onderdelen in de winkel`);
    // The paints anyone may wear, and those won in the arena: a master's for each crown, and the keeper's.
    const earned = CROWN_PAINTS.length + 1;
    expect(README).toContain(`${capital(word(PAINTS.length))} verfschema's, ${word(earned)} die je in de arena verdient, en ${word(LOADOUT_SLOTS)} opgeslagen builds.`);
    expect(CROWN_PAINTS).toHaveLength(MASTERS.length);
    expect(SEAT_PAINT.id).toBe(KEEPER.paint);
    expect(README).toContain(`Je begint in een van ${word(STARTERS.length)} mecha's naar keuze.`);
    expect(README).toContain(`**Hangar**: ${word(LOADOUT_SLOTS)} plekken voor bewaarde builds`);
  });

  test('the classes, the masters and the seat under them', () => {
    expect(README).toContain(`**${capital(word(ARCHETYPES.length))} klassen**`);
    expect(README).toContain(`met ${word(MASTERS.length)} meesters, een per klasse`);
    expect(README).toContain(`**De achtste stoel**: onder de ${word(MASTERS.length)} meesters staat een achtste rij. Wie alle ${word(ARCHETYPES.length)} kronen heeft,`);
    expect(README).toContain(`vecht op ${word(KEEPER.phases.length + 1)} manieren`);
    // What is said of the Sovereign there is so: it is bought once the seat is taken.
    expect(README).toContain('Win je, dan mag je de Sovereign zelf kopen en is de lak van de houder van jou.');
    for (const slot of ['head', 'core', 'arms', 'legs']) expect(SHOP_UNLOCKS[`${slot}-sovereign`]).toBe('seat');
  });

  test('the rest that is counted: enemies, the arena, the drills, the pilot\'s skills and medals, the songs', () => {
    expect(README).toContain(`**Vijanden**: ${Object.keys(ENEMIES).length} soorten`);
    // The ladder is ten; the back room is who is left of the arena's list.
    expect(README).toContain(`een ladder van ${word(10)} piloten, een achterkamer met ${word(ARENA.length - 10)} voor de kampioen`);
    expect(README).toContain(`**Training**: ${word(DRILLS.length)} oefeningen`);
    expect(README).toContain(`niveaus en ${word(PERKS.length)} vaardigheden, ${MEDALS.length} medailles en een logboek`);
    expect(README).toContain(`muziek per scherm (${word(Object.keys(SONGS).length)} nummers, zonder audiobestanden)`);
  });
});

/** The guide's chapter on the eighth seat, from its heading to the next chapter's, as one line of text. */
const GUIDE_TEXT = readFileSync('docs/handleiding.md', 'utf8');
const SEAT_CHAPTER = GUIDE_TEXT.slice(GUIDE_TEXT.indexOf('### De achtste stoel'), GUIDE_TEXT.indexOf('## Twee duels na het einde')).replace(/\s+/g, ' ');
const GUIDE = GUIDE_TEXT.replace(/\s+/g, ' ');

describe('the guide\'s chapter on the eighth seat says what is so', () => {
  const weapon = (id: string): Weapon => CATALOG[id] as Weapon;
  const frame = (id: string): FramePart => CATALOG[id] as FramePart;
  const framesOf = (kind: string): FramePart[] => SHOP_PARTS.filter((part): part is FramePart => part.kind === kind);
  /** The names the guide prints in bold in the row of its table that begins with these words. */
  const named = (row: string): string[] => {
    const line = GUIDE_TEXT.split('\n').find((entry) => entry.startsWith(`| ${row}`))!;
    return [...line.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1]);
  };

  test('who is taken, for what purse, and how often', () => {
    expect(SEAT_CHAPTER).toContain(`van wie **alle ${word(ARCHETYPES.length)} kronen** heeft`);
    expect(SEAT_CHAPTER).toContain(`staat er hoeveel je er hebt (**${STRINGS.arena.seat.count(3, ARCHETYPES.length)}**)`);
    expect(SEAT_CHAPTER).toContain(`houder van de stoel: **${KEEPER.name}**`);
    expect(SEAT_CHAPTER).toContain(`De pot is ${SEAT_PURSE} de eerste keer, daarna een kwart.`);
    expect(seatPurse({ seat: true }) * 4).toBe(SEAT_PURSE);
    expect(SEAT_CHAPTER).toContain(`achtste rij: **${STRINGS.arena.seat.row}**`);
  });

  test('the three ways its machine fights: when each begins, and the weapons named in each are the ones it carries then', () => {
    expect(SEAT_CHAPTER).toContain(`vecht op **${word(KEEPER.phases.length + 1)} manieren**`);
    const [light, blades] = KEEPER.phases;
    // A third lost, two thirds lost: where the changes are.
    expect([light.at, blades.at]).toEqual([0.66, 0.33]);
    const carried = (refit: Record<string, string | undefined>): string[] => ['rightHand', 'leftHand', 'shoulder'].flatMap((slot) => refit[slot] ?? []);
    const first = carried(KEEPER.build as unknown as Record<string, string>);
    const second = carried({ ...KEEPER.build, ...light.refit } as Record<string, string>);
    const third = carried({ ...KEEPER.build, ...light.refit, ...blades.refit } as Record<string, string>);
    const names = (ids: string[]): string[] => ids.map((id) => weapon(id).name);
    // At range: one that charges and one that knocks a machine off balance, and it is easiest to hit now.
    expect(named('Tot hij een derde kwijt is')).toEqual(['Longbow Rail', 'Howler', 'Guard']);
    expect(names(first)).toEqual(expect.arrayContaining(['Longbow Rail', 'Howler']));
    expect(weapon('wpn-longbow').charge).toBe(true);
    expect(weapon('wpn-howler').impact).toBeGreaterThan(100);
    expect(light.evasion).toBeGreaterThan(0);
    // Light: three weapons, all energy, one of which drains; and it is harder to hit.
    expect(named('Tot hij twee derde kwijt is')).toEqual(['Null Beam']);
    expect(second).toHaveLength(3);
    expect(second.map((id) => weapon(id).damageType)).toEqual(['energy', 'energy', 'energy']);
    expect(second.filter((id) => weapon(id).trait === 'drain').map((id) => weapon(id).name)).toEqual(['Null Beam']);
    // Blades: two of them, and a tenth harder.
    expect(named('Daarna')).toEqual(['Gavel', 'Arc Blade']);
    expect(third.filter((id) => weapon(id).melee).map((id) => weapon(id).name)).toEqual(['Gavel', 'Arc Blade']);
    expect(SEAT_CHAPTER).toContain('slaat een tiende harder');
    expect(blades.damage).toBe(1.1);
  });

  test('what the seat gives: the frame at its price, the paint by its name, the words on the pilot\'s page', () => {
    const parts = ['head', 'core', 'arms', 'legs'].map((slot) => frame(`${slot}-sovereign`));
    expect(SEAT_CHAPTER).toContain(`Ze zijn de duurste die er zijn: samen ${parts.reduce((sum, part) => sum + part.price, 0)}.`);
    for (const part of parts) {
      const dearest = Math.max(...framesOf(part.kind).filter((other) => other.id !== part.id).map((other) => other.price));
      expect(part.price, part.id).toBeGreaterThan(dearest);
    }
    expect(SEAT_CHAPTER).toContain(`staat **${SEAT_PAINT.name}** achter de kleuren van de meesters`);
    expect(SEAT_CHAPTER).toContain(`staat bovenaan **${STRINGS.arena.seat.row.toUpperCase()}** in plaats van het aantal kronen`);
  });

  test('flown by the pilot: a smaller field than the Sterling\'s, the Shrike\'s balance, and legs that carry more than any but two and are quicker than both', () => {
    expect(GUIDE).toContain(`bij jou vangt het veld ${frame('core-sterling').field} schade op`);
    expect(GUIDE).toContain(`armen met **POISE** en een kern met een kleiner veld (${frame('core-sovereign').field})`);
    expect(frame('core-sovereign').field!).toBeLessThan(frame('core-sterling').field!);
    expect(frame('arms-sovereign').poise).toBe(true);
    expect(frame('arms-shrike').poise).toBe(true);
    const legs = framesOf('legs');
    const own = frame('legs-sovereign');
    const more = legs.filter((part) => part.capacity! > own.capacity!).map((part) => part.name).sort();
    expect(more).toEqual(['Colossus Legs', 'Crawler Treads']);
    expect(GUIDE).toContain('op die van de Colossus en de rupsbanden na, en zijn toch vlugger dan die twee');
    for (const part of legs.filter((entry) => entry.capacity! > own.capacity!)) expect(own.mobility!, part.id).toBeGreaterThan(part.mobility!);
  });
});

describe('what is said of the launch is so', () => {
  const controls = MANUAL.find((entry) => entry.id === 'controls')!;

  test('the manual\'s chapter on the controls says how it is cut short and how it is done without, naming the option by its name', () => {
    expect(controls.text).toMatch(/A or B cuts short the launch a contract opens with; with Fast Battles on there is none\.$/);
    expect(controls.text).toContain(STRINGS.options.fastBattles);
    const dutch = REFERENCE_NL[controls.text];
    expect(dutch).toMatch(/A of B kapt de lancering af waarmee een contract opent; met Snel vechten aan is die er niet\.$/);
    expect(dutch).toContain(STRINGS_NL.options.fastBattles);
  });

  test('the guide gives its length as it is, names the option, and says where there is none', () => {
    const chapter = GUIDE.slice(GUIDE.indexOf('## Een gevecht'), GUIDE.indexOf('## Opdrachten'));
    expect(chapter).toContain('begint met de **lancering**');
    // A second and a half.
    expect(chapter).toContain('Het duurt anderhalve seconde.');
    expect(LAUNCH_MS).toBe(1500);
    expect(chapter).toContain(`Staat **${STRINGS.options.fastBattles}** aan, dan zie je het niet.`);
    expect(chapter).toContain('In de arena, in de simulator en in de Gauntlet is er geen lancering.');
    for (const id of ['arena-3', 'cup-gold', 'arena-seat', 'drill-basics', 'range-spar-1', 'gauntlet-4']) expect(launches({ id }), id).toBe(false);
    expect(GUIDE).toContain(`**${STRINGS.options.fastBattles}** speelt gevechten tweeënhalf keer zo snel af, en slaat de lancering aan het begin van een contract over.`);
    expect(FAST_BATTLE_SPEED).toBe(2.5);
    expect(README).toContain('**Lancering**: elk contract vanuit de hangar opent met je eigen mecha op de katapult: drie lampen,');
    expect(LAMPS_AT).toHaveLength(3);
  });
});
