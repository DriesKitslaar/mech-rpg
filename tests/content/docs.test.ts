import { readFileSync } from 'node:fs';
import { ARCHETYPES, archetypeOf } from '../../src/core/archetype';
import { GUARD_DAMAGE, HEAT_LIMIT, SPOOL_BASE, SURGE_UNIT, bufferRoom, createBattle } from '../../src/core/battle';
import { BUILD_SLOTS, LOADOUT_SLOTS } from '../../src/core/game';
import { startNewCycle } from '../../src/core/campaign';
import { launches } from '../../src/core/launch';
import { DEFAULT_MIXES, MIX_KEYS, MIX_SLOTS, MIX_STEPS, mixId } from '../../src/core/mix';
import { MAX_LEVEL } from '../../src/core/pilot';
import { SEAT_PURSE, seatPurse } from '../../src/core/seat';
import { ALL_STRIPES, MAX_STRIPE_POINTS, STRIPES_AT, STRIPES_A_POINT, countsForClass, stripePoints, stripesHeld } from '../../src/core/stripes';
import type { FramePart, Weapon } from '../../src/core/types';
import { ARENA } from '../../src/content/arena';
import { MANUAL } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { MASTERS } from '../../src/content/masters';
import { MEDALS, WEAPON_KINDS, WORKS_DUELS } from '../../src/content/medals';
import { DUELS } from '../../src/content/sidework';
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
import { CROWN_PAINTS, PAINTS, SEAT_PAINT, paintsFor, rampOf, schemeOfMix, toHsl } from '../../src/ui/paint';

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
    expect(README).toContain(`${capital(word(PAINTS.length))} verfschema's, ${word(earned)} die je in de arena verdient, ${word(MIX_SLOTS)} die je zelf mengt, en ${word(LOADOUT_SLOTS)} opgeslagen builds.`);
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
const SEAT_CHAPTER = GUIDE_TEXT.slice(GUIDE_TEXT.indexOf('### De achtste stoel'), GUIDE_TEXT.indexOf('## Vier duels na het einde')).replace(/\s+/g, ' ');
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

describe('what is said of stripes is so', () => {
  const chapter = MANUAL.find((entry) => entry.id === 'stripes')!;
  const medal = (id: string) => MEDALS.find((entry) => entry.id === id)!;
  /** The fewest contracts that must be won to hold so many stripes, and over how many classes that is spread. */
  function cheapest(stripes: number): { won: number; classes: number } {
    // What each stripe costs on top of the one before it in its class, cheapest first: the first of every class, then the seconds, then the thirds.
    const steps = ARCHETYPES.flatMap(() => STRIPES_AT.map((at, i) => ({ cost: at - (STRIPES_AT[i - 1] ?? 0), first: i === 0 }))).sort((a, b) => a.cost - b.cost);
    const taken = steps.slice(0, stripes);
    return { won: taken.reduce((sum, step) => sum + step.cost, 0), classes: taken.filter((step) => step.first).length };
  }

  test('the manual: when a class gives them, how many there are, what a fifth is worth and how the first point is soonest had', () => {
    expect(chapter.title).toBe('STRIPES');
    expect(chapter.text).toContain('A class gives you a stripe at 3, at 8 and at 15 contracts won flying it: three a class, twenty-one in all.');
    expect([...STRIPES_AT]).toEqual([3, 8, 15]);
    expect(ARCHETYPES.length * STRIPES_AT.length).toBe(21);
    expect(ALL_STRIPES).toBe(21);
    expect(chapter.text).toContain('Every fifth stripe you hold, of whatever classes, is a perk point: the first is soonest had by flying five kinds of machine.');
    expect(STRIPES_A_POINT).toBe(5);
    // Five stripes are cheapest as the first of five classes: each later stripe of a class costs more than a first.
    expect(STRIPES_AT[1] - STRIPES_AT[0]).toBeGreaterThan(STRIPES_AT[0]);
    expect(STRIPES_AT[2] - STRIPES_AT[1]).toBeGreaterThan(STRIPES_AT[0]);
    expect(cheapest(STRIPES_A_POINT)).toEqual({ won: 15, classes: 5 });
    expect(chapter.text).toContain(`The ${STRINGS.pilot.pages.classes} page shows them, and a briefing's ${STRINGS.briefing.build} row how near the next is.`);
    const dutch = REFERENCE_NL[chapter.text];
    expect(dutch).toContain('een streep bij 3, bij 8 en bij 15 contracten die je erin wint: drie per klasse, eenentwintig in totaal.');
    expect(dutch).toContain('Elke vijfde streep, van welke klasse ook, is een perkpunt: het eerste komt het vlugst met vijf soorten machines.');
    expect(dutch).toContain(`De pagina ${STRINGS_NL.pilot.pages.classes} toont ze, de rij ${STRINGS_NL.briefing.build} van een briefing hoe ver de volgende is.`);
    expect(REFERENCE_NL[chapter.title]).toBe('STREPEN');
  });

  test('the guide: the thresholds, the count, the points and why only stripes fill every perk', () => {
    const section = GUIDE.slice(GUIDE.indexOf('### Strepen'), GUIDE.indexOf('Alle zeven zijn doorgemeten'));
    expect(section.length).toBeGreaterThan(400);
    expect(section).toContain('een **streep** bij 3, bij 8 en bij 15 contracten die je in die klasse wint: drie per klasse, eenentwintig in totaal.');
    // What the page says, quoted as the page says it.
    expect(section).toContain(`(**${STRINGS.stripes.held(10, ALL_STRIPES)}**)`);
    expect(section).toContain(`(**${STRINGS.stripes.nextStripe(8)}**)`);
    expect(section).toContain(`(**${STRINGS.stripes.nextPoint(15)}**)`);
    expect(section).toContain(`**${STRINGS.stripes.point}** erbij als het de vijfde was`);
    expect(section).toContain('**Elke vijfde streep is een perkpunt**, van welke klassen ze ook komen: vier punten bij twintig strepen.');
    expect(MAX_STRIPE_POINTS).toBe(4);
    expect(MAX_STRIPE_POINTS * STRIPES_A_POINT).toBe(20);
    // Nineteen from the levels, twenty-three ranks to buy: the four that stripes bring are what is short.
    expect(section).toContain('Je levels geven er negentien en alle perks samen hebben drieëntwintig rangen: pas met strepen krijg je ze dus allemaal vol.');
    expect(MAX_LEVEL - 1).toBe(19);
    const ranks = PERKS.reduce((sum, perk) => sum + perk.maxRank, 0);
    expect(ranks).toBe(23);
    expect(MAX_LEVEL - 1 + MAX_STRIPE_POINTS).toBe(ranks);
    expect(section).toContain('De eerste streep van een klasse kost het minst (drie contracten), dus je eerste punt heb je het snelst door vijf soorten machines te vliegen: vijftien contracten.');
    expect(cheapest(STRIPES_A_POINT)).toEqual({ won: 15, classes: 5 });
    expect(Math.min(...STRIPES_AT)).toBe(3);
    expect(section).toContain(`het blad **${capital(STRINGS.pilot.pages.perks.toLowerCase())}** zegt hoeveel punten je strepen al hebben opgebracht`);
    expect(section).toContain(`Op het blad **${capital(STRINGS.pilot.pages.classes.toLowerCase())}** staan ze als drie streepjes`);
  });

  test('the guide: a stripe is kept through a new telling of the story, and there are two medals for them', () => {
    const section = GUIDE.slice(GUIDE.indexOf('### Strepen'), GUIDE.indexOf('Alle zeven zijn doorgemeten'));
    expect(section).toContain('Een streep raak je niet meer kwijt, ook niet als je het verhaal opnieuw begint.');
    // The record of what was won as each class is carried into the next telling whole.
    const record = { wonAs: { lancer: 15, bastion: 8, duellist: 3, marksman: 3 } };
    const told = { completed: ['the-end'], read: [], scenes: [], choices: {}, endingSeen: true, cycle: 0, ...record } as unknown as Parameters<typeof startNewCycle>[0];
    const again = startNewCycle(told, [{ id: 'the-end', phase: 'finale' }] as unknown as Parameters<typeof startNewCycle>[1]);
    expect(again.cycle).toBe(1);
    expect(again.wonAs).toEqual(record.wonAs);
    expect([stripesHeld(again), stripePoints(again)]).toEqual([7, 1]);
    expect(section).toContain('Er zijn twee medailles: voor je eerste streep en voor alle eenentwintig.');
    expect(MEDALS.filter((entry) => entry.id.startsWith('stripe')).map((entry) => entry.id)).toEqual(['stripe-1', 'stripe-all']);
    expect(medal('stripe-1').progress({ wonAs: {} } as never).need).toBe(1);
    expect(medal('stripe-all').progress({ wonAs: {} } as never).need).toBe(21);
  });

  test('the guide: the briefing\'s page of the build says how near the next stripe is, quoted as it says it, and not in the simulator', () => {
    const section = GUIDE.slice(GUIDE.indexOf('### Strepen'), GUIDE.indexOf('Alle zeven zijn doorgemeten'));
    expect(section).toContain(`Ga op de rij **${STRINGS.briefing.build}** staan: rechts van de naam van de build staan de streepjes van zijn klasse`);
    // Six of eight is on the way to a second stripe.
    expect(section).toContain(`met **${STRINGS.stripes.towards(6, 8)}** (zes van de acht contracten gewonnen)`);
    expect(STRIPES_AT[1]).toBe(8);
    expect(section).toContain(`Is dit contract het laatste dat nog ontbreekt, dan staat er **${STRINGS.stripes.thisWin}**.`);
    expect(section).toContain('In de simulator staat er niets: die telt niet mee.');
    for (const id of ['drill-basics', 'range-1-heavy-mech', 'range-spar-1']) expect(countsForClass({ id }), id).toBe(false);
    expect(countsForClass({ id: 'patrol' })).toBe(true);
    expect(README).toContain('Bij de briefing zie je per build hoe ver zijn klasse van de volgende streep is.');
  });

  test('the README says the same in a line', () => {
    expect(README).toContain('**Strepen**: een klasse geeft je een streep bij 3, 8 en 15 gewonnen contracten, en elke vijfde streep is een perkpunt.');
    expect(README).toContain('met twintig strepen heb je eindelijk elke rang van elke perk.');
    expect(MAX_STRIPE_POINTS * STRIPES_A_POINT).toBe(20);
  });
});

describe('what is said of the paint shop is so', () => {
  const M = STRINGS.garage.mixer;
  const dutchOf = (text: string): string => REFERENCE_NL[text];
  const chapter = MANUAL.find((entry) => entry.id === 'paint')!;
  const garage = MANUAL.find((entry) => entry.id === 'garage')!;
  const section = GUIDE.slice(GUIDE.indexOf('## De spuiterij: je eigen lak'), GUIDE.indexOf('## Moeilijkheid'));
  const raw = GUIDE_TEXT.slice(GUIDE_TEXT.indexOf('## De spuiterij: je eigen lak'), GUIDE_TEXT.indexOf('## Moeilijkheid'));

  test('the manual: how many paints come ready, the three that are mixed, what is set and how, and that a mix is kept', () => {
    expect(chapter.title).toBe('THE PAINT SHOP');
    expect(chapter.text).toContain("Twelve paints come ready, and a master's crown brings theirs.");
    expect(PAINTS).toHaveLength(12);
    expect(chapter.text).toContain('MIX 1, 2 and 3 are yours to mix: put one on and its five rows wake.');
    expect(MIX_SLOTS).toBe(3);
    expect(MIX_KEYS).toHaveLength(5);
    expect(chapter.text).toContain("Up and down choose a row, left and right change it: the armour's colour, how strong and how dark it is, the colour of the trim and how hard it glows.");
    expect(dutchOf(chapter.text)).toContain('Op en neer kies je een rij, links en rechts wijzig je hem:');
    expect(chapter.text).toMatch(/A mix is kept as you leave it\.$/);
    const dutch = REFERENCE_NL[chapter.text];
    expect(dutch).toContain('Twaalf lakken zijn kant en klaar; de kroon van een meester geeft de zijne.');
    expect(dutch).toContain('MIX 1, 2 en 3 meng je zelf: trek er een aan en vijf rijen ontwaken.');
    expect(dutch).toMatch(/Je mengsel blijft bewaard\.$/);
    expect(REFERENCE_NL[chapter.title]).toBe('DE SPUITERIJ');
    // The garage's own chapter says which way the paint shop and the saved builds are.
    expect(garage.text).toContain('Right opens your seven saved builds');
    expect(garage.text).toMatch(/Left opens the paint shop\.$/);
    expect(REFERENCE_NL[garage.text]).toMatch(/Rechts: je zeven bewaarde builds.*Links: de spuiterij\.$/);
  });

  test('the guide: the order of the paints, the three as they come, and the page by its name', () => {
    expect(section.length).toBeGreaterThan(600);
    expect(section).toContain('de kleuren van de fabriek, twaalf kant-en-klare lakken, de lakken die je in de arena verdient, en als laatste **Mix 1**, **Mix 2** en **Mix 3**.');
    // Factory colours, the twelve, what is won, and last the three.
    const all = paintsFor({ crowns: ['bastion'], seat: true });
    expect(all[0]).toBe('factory');
    expect(all.slice(1, 1 + PAINTS.length)).toEqual(PAINTS.map((paint) => paint.id));
    expect(all.slice(-MIX_SLOTS)).toEqual(DEFAULT_MIXES.map(mixId));
    expect(DEFAULT_MIXES.map((mix) => schemeOfMix(mix).name)).toEqual(['Mix 1', 'Mix 2', 'Mix 3']);
    // A white machine with blue lights, a black one with red, and navy with gold.
    expect(section).toContain('een witte mecha met blauwe lichten, een zwarte met rode, en een marineblauwe met goud');
    const [white, black, navy] = DEFAULT_MIXES.map((mix) => schemeOfMix(mix));
    const light = (scheme: typeof white): number => toHsl(...rampOf(scheme)[3])[2];
    expect(light(white)).toBeGreaterThan(0.5);
    expect(light(black)).toBeLessThan(0.25);
    expect([white.accentHue, black.accentHue, navy.accentHue]).toEqual([195, 0, 45]);
    expect(navy.hue).toBe(210);
    expect(section).toContain(`Druk in de garage op **links**: dan sta je in de **${M.heading}**. Met **B** ga je terug naar de onderdelen.`);
    // How a row is changed: the D-pad, which goes on while it is held, the shoulder buttons, and A.
    expect(section).toContain('met **links/rechts** verander je hem: houd de knop ingedrukt en hij loopt door. **L1/R1** doen hetzelfde, en **A** gaat een stap verder.');
    expect(M.change).toBe('LEFT/RIGHT: CHANGE');
  });

  test('the guide\'s table: each row by its name, in its number of steps, with the names its steps have', () => {
    const rows = raw.split('\n').filter((line) => line.startsWith('| **'));
    expect(rows.map((line) => line.split('|')[1].trim())).toEqual(MIX_KEYS.map((key) => `**${M.rows[key]}**`));
    expect(rows.map((line) => Number(line.split('|')[2].trim()))).toEqual(MIX_KEYS.map((key) => MIX_STEPS[key]));
    expect(rows[1]).toContain(`${M.finish[0]} (bijna geen kleur), ${M.finish.slice(1).join(', ')}.`);
    expect(rows[2]).toContain(`${M.shade.join(', ')}.`);
    expect(rows[4]).toContain(`${M.glow.join(', ')}.`);
    // White and black, as the guide says they are made.
    expect(section).toContain(`**${M.finish[0]}** met **${M.shade[0]}** geeft een witte mecha, **${M.finish[0]}** met **${M.shade.at(-1)}** een zwarte.`);
    expect([DEFAULT_MIXES[0].finish, DEFAULT_MIXES[0].shade]).toEqual([0, 0]);
    expect([DEFAULT_MIXES[1].finish, DEFAULT_MIXES[1].shade]).toEqual([0, MIX_STEPS.shade - 1]);
    expect(section).toContain('Het kost niets. Er is een medaille voor wie een eigen mengsel draagt.');
    expect(MEDALS.find((entry) => entry.id === 'mixed')).toMatchObject({ tier: 1 });
  });

  test('the README and the hangar\'s table in the guide say where it is', () => {
    expect(README).toContain('**Eigen lak**: in de garage meng je je eigen lak, in vijf rijen:');
    expect(README).toContain('en drie mengsels blijven bewaard.');
    expect(GUIDE).toContain('| Garage | Onderdelen wisselen, verf kiezen (L1/R1), je eigen lak mengen (links), zeven builds bewaren (rechts). |');
    expect(GUIDE).toContain('- Builds bewaar je in de **Garage**: naar rechts, een plek kiezen, **Save current build**.');
  });
});

describe('what is said of the five kinds of weapon is so', () => {
  const chapter = MANUAL.find((entry) => entry.id === 'kinds')!;
  const dutch = REFERENCE_NL[chapter.text];
  const section = GUIDE.slice(GUIDE.indexOf('## Vijf soorten wapens die iets van je vragen'), GUIDE.indexOf('## De werkbank'));
  const weapons = SHOP_PARTS.filter((part): part is Weapon => part.kind === 'weapon');
  const ofKind = (kind: string): Weapon[] => weapons.filter((weapon) => weapon.trait === kind);
  /** What the guide calls each kind, and what it says of where a weapon is carried and what puts it on the shelf. */
  const NAMES: Record<string, string> = { redline: 'witheet', surge: 'piek', punish: 'straf', fork: 'vonk', spool: 'optoeren' };
  const AFTER: Record<string, string> = {
    'undertow-1': 'je eerste contract voor de Undertow', 'lumen-1': 'je eerste contract voor Lumen', 'hadron-1': 'je eerste contract voor Hadron',
    choice: 'het exclusieve contract', verdict: 'het einde van de audit',
  };
  const after = (condition: string): string => (condition.startsWith('arena:') ? `arenarang ${condition.slice(6)}` : AFTER[condition]);

  test('the manual: five kinds, the hundred a surge counts by, the two shots a spool begins with', () => {
    expect(chapter.title).toBe('FIVE KINDS');
    expect(REFERENCE_NL[chapter.title]).toBe('VIJF SOORTEN');
    expect(chapter.text).toMatch(/^Five kinds of weapon ask something of you\./);
    expect(WEAPON_KINDS).toEqual(['redline', 'surge', 'punish', 'fork', 'spool']);
    // Each by the name its line has in the shop, in the order the lines are written in.
    const named = [...chapter.text.matchAll(/\b(REDLINE|SURGE|PUNISH|FORK|SPOOL)\b/g)].map((match) => match[1].toLowerCase());
    expect(named).toEqual(WEAPON_KINDS);
    for (const kind of WEAPON_KINDS) expect(STRINGS.partInfo.traits[kind](1), kind).toMatch(new RegExp(`^${kind.toUpperCase()}:`));
    expect(chapter.text).toContain(`SURGE takes all the energy you have left and hits for every ${SURGE_UNIT} of it.`);
    expect(chapter.text).toContain(`SPOOL fires ${SPOOL_BASE} shots, and one more for every turn in a row.`);
    expect(chapter.text).toContain('REDLINE hits harder the hotter you run: fire it last.');
    expect(chapter.text).toContain('FORK: a hit leaps to the next machine.');
    // In Dutch by the names the Dutch lines have.
    const dutchNamed = [...dutch.matchAll(/\b(WITHEET|PIEK|STRAF|VONK|OPTOEREN)\b/g)].map((match) => match[1]);
    expect(dutchNamed).toEqual(['WITHEET', 'PIEK', 'STRAF', 'VONK', 'OPTOEREN']);
    WEAPON_KINDS.forEach((kind, at) => expect(STRINGS_NL.partInfo.traits[kind](1), kind).toMatch(new RegExp(`^${dutchNamed[at]}:`)));
    expect(dutch).toContain(`PIEK neemt al je energie en telt per ${SURGE_UNIT}.`);
    expect(dutch).toContain(`OPTOEREN vuurt ${SPOOL_BASE} schoten, en elke beurt op rij een meer.`);
  });

  test('the guide: what each kind does, by the figures of the rules', () => {
    expect(section.length).toBeGreaterThan(1500);
    expect(section).toContain('Tien wapens zijn van een soort die iets van jou terugvraagt');
    expect(weapons.filter((weapon) => (WEAPON_KINDS as string[]).includes(weapon.trait ?? ''))).toHaveLength(10);
    expect(section).toContain(`| **SURGE** | PIEK | Neemt alle energie die je nog hebt. De schade die erbij staat geldt voor elke ${SURGE_UNIT} energie die het neemt. |`);
    expect(section).toContain(`| **SPOOL** | OPTOEREN | Begint met ${SPOOL_BASE} schoten en krijgt er elke beurt op rij een bij. Sla je een beurt over, dan begint het weer bij ${SPOOL_BASE}. |`);
    // Twice as much: of both the weapons that punish.
    expect(section).toContain('| **PUNISH** | STRAF | Dubbele schade tegen een mecha die wankelt. Zelf duwt het nauwelijks. |');
    expect(ofKind('punish').map((weapon) => weapon.traitPower)).toEqual([100, 100]);
    expect(section).toContain(`| **REDLINE** | WITHEET | Hoe heter je eigen mecha is, hoe harder het raakt: een vast percentage erbij voor elke 10 hitte, tot de hittegrens van je mecha (${HEAT_LIMIT}, in een Sirocco ${(CATALOG['core-sirocco'] as FramePart).heatLimit}). |`);
    expect(STRINGS.partInfo.traits.redline(8)).toBe('REDLINE: +8% per 10 heat');
    expect(section).toContain('| **FORK** | VONK | Een treffer slaat over op de volgende vijand in de rij, voor een deel van de schade. Wat overslaat mist nooit. |');
    for (const weapon of ofKind('fork')) expect(weapon.traitPower, weapon.id).toBeLessThan(100);
    // The words the battle writes, as it writes them.
    expect(section).toContain(`**${STRINGS.meters.energy} ${STRINGS.weaponMenu.all} 230**`);
    expect(section).toContain(`**${STRINGS.weaponMenu.shots(4)}**`);
    expect(section).toContain(`**${STRINGS.fx.kinds.redline(36)}**, **${STRINGS.fx.kinds.surge('2.3')}**, **${STRINGS.fx.kinds.punish}**`);
    expect(section).toContain(`staat **${STRINGS.preview.fork}** (Nederlands **${STRINGS_NL.preview.fork}**) boven de machine waar het naartoe springt`);
  });

  test('the guide: the ten weapons, each with its kind, where it is carried and what puts it on the shelf', () => {
    const rows = weapons.filter((weapon) => (WEAPON_KINDS as string[]).includes(weapon.trait ?? ''));
    for (const weapon of rows) {
      const where = weapon.melee ? 'hand (kling)' : weapon.mount === 'hand' ? 'hand' : 'schouder';
      expect(section, weapon.id).toContain(`| ${weapon.name} | ${NAMES[weapon.trait!]} | ${where} | ${after(SHOP_UNLOCKS[weapon.id])} |`);
    }
    // And no row for a weapon that is not one of them.
    expect(section.split('| hand').length + section.split('| schouder |').length - 2).toBe(rows.length);
  });

  test('the guide: none of them changes what class a build is, and a blade is a blade', () => {
    expect(section).toContain('een Headsman is een kling en maakt je een Duellist, zoals elke kling');
    const frame = { head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider', generator: 'gen-kd1' };
    expect(archetypeOf({ ...frame, rightHand: 'wpn-headsman' }, CATALOG)).toBe('duellist');
    // A gun of each of the other kinds leaves the stock frame the all-rounder it is.
    for (const id of ['wpn-slagcaster', 'wpn-flywheel', 'wpn-spike-driver', 'wpn-thresher', 'wpn-thunderhead', 'wpn-crucible', 'wpn-spillway']) {
      const slot = (CATALOG[id] as Weapon).mount === 'hand' ? 'rightHand' : 'shoulder';
      expect(archetypeOf({ ...frame, rightHand: 'wpn-rivet-rifle', [slot]: id }, CATALOG), id).toBe('allrounder');
    }
  });

  test('the README: ten weapons of five kinds, and what each kind is; and the medal for owning one of each', () => {
    expect(README).toContain('- **Arsenaal**: tien wapens van vijf soorten die iets van je terugvragen.');
    expect(README).toContain('een strafwapen doet dubbele schade tegen een wankelende machine');
    expect(README).toContain(`${MEDALS.length} medailles`);
    const medal = MEDALS.find((entry) => entry.id === 'arsenal')!;
    expect(medal).toMatchObject({ name: 'Full Rack', tier: 2 });
    const fresh = { inventory: {} } as never;
    expect(medal.progress(fresh)).toEqual({ have: 0, need: 5 });
    // One of each kind, whichever of the two it is; two of a kind are one kind; and something that is no part, or is owned no more, is nothing.
    const owns = (ids: string[], count = 1) => medal.progress({ inventory: Object.fromEntries(ids.map((id) => [id, count])) } as never).have;
    expect(owns(['wpn-slagcaster', 'wpn-sluice', 'wpn-spike-driver', 'wpn-forkbolt', 'wpn-flywheel'])).toBe(5);
    expect(owns(['wpn-crucible', 'wpn-spillway', 'wpn-headsman', 'wpn-thunderhead', 'wpn-thresher'])).toBe(5);
    expect(owns(['wpn-crucible', 'wpn-slagcaster', 'wpn-rivet-rifle', 'toString'])).toBe(1);
    expect(owns(['wpn-crucible', 'wpn-spillway'], 0)).toBe(0);
  });
});

describe('what is said of the yard\'s two frames and their duels is so', () => {
  const chapter = MANUAL.find((entry) => entry.id === 'works')!;
  const dutch = REFERENCE_NL[chapter.text];
  const section = GUIDE.slice(GUIDE.indexOf('## Vier duels na het einde'), GUIDE.indexOf('## Opslaan'));
  const sirocco = CATALOG['core-sirocco'] as FramePart;
  const solstice = CATALOG['core-solstice'] as FramePart;

  test('the figures everything below is held to: a limit of 130 for the usual 100, half a turn kept, a guard at six tenths, every other round', () => {
    expect([sirocco.heatLimit, HEAT_LIMIT, solstice.buffer, GUARD_DAMAGE, ENEMIES.vesper.abilities?.hold]).toEqual([130, 100, 50, 0.6, 2]);
    expect(WORKS_DUELS.map((id) => DUELS.find((mission) => mission.id === id)!.title)).toEqual(['Hot Work', 'The Longest Day']);
  });

  test('the manual: a chapter that names each core by the line its part has, with the limit and the share the rules give', () => {
    expect(chapter.title).toBe('WORKS FRAMES');
    expect(REFERENCE_NL[chapter.title]).toBe('FRAMES VAN DE WERF');
    // It stands after the chapter on the five kinds, which it speaks of.
    expect(MANUAL[MANUAL.findIndex((entry) => entry.id === 'kinds') + 1].id).toBe('works');
    // Neither frame is given away: each part is on the shop's shelves, at a price, once its duel is won.
    expect(chapter.text).toMatch(/^Beat the coast yard's works pilots to buy their frames\. /);
    expect(dutch).toMatch(/^Versla de piloten van de kustwerf om hun frames te kopen\. /);
    for (const [name, duel] of [['sirocco', 'duel-3'], ['solstice', 'duel-4']]) {
      for (const slot of ['head', 'core', 'arms', 'legs']) {
        expect(SHOP_UNLOCKS[`${slot}-${name}`], `${slot}-${name}`).toBe(`won:${duel}`);
        expect(CATALOG[`${slot}-${name}`].price, `${slot}-${name}`).toBeGreaterThan(0);
      }
    }
    expect(chapter.text).toContain(`A SIROCCO core RUNS HOT: it overheats past ${sirocco.heatLimit}, not ${HEAT_LIMIT}`);
    expect(STRINGS.partInfo.heatLimit(130)).toMatch(/^RUNS HOT: /);
    expect(chapter.text).toContain('A SOLSTICE core has a BUFFER: energy you do not spend is kept for your next turn, up to half a turn\'s worth.');
    expect(STRINGS.partInfo.buffer).toMatch(/^BUFFER: /);
    // The two kinds of weapon it names, by the names their lines have.
    for (const kind of ['redline', 'surge'] as const) {
      expect(chapter.text).toContain(kind.toUpperCase());
      expect(STRINGS.partInfo.traits[kind](1)).toMatch(new RegExp(`^${kind.toUpperCase()}:`));
    }
    expect(dutch).toContain(`Een SIROCCO-kern is HEET: oververhit pas boven ${sirocco.heatLimit}, niet ${HEAT_LIMIT}`);
    expect(STRINGS_NL.partInfo.heatLimit(130)).toMatch(/^HEET: /);
    expect(dutch).toContain('Een SOLSTICE-kern heeft een BUFFER');
    expect(dutch).toContain('tot een halve beurt');
    expect(STRINGS_NL.partInfo.buffer).toMatch(/^BUFFER: /);
    const lines = STRINGS_NL.partInfo.traits as Record<string, (power: number) => string>;
    expect(lines.redline(1)).toMatch(/^WITHEET:/);
    expect(lines.surge(1)).toMatch(/^PIEK:/);
    expect(dutch).toContain('WITHEET klimt hoger');
    expect(dutch).toContain('Een PIEK laat niets over.');
  });

  test('the guide: four duels by their titles in the order they are fought, and what each of the last two machines does', () => {
    expect(section.length).toBeGreaterThan(3000);
    const titles = DUELS.map((mission) => section.indexOf(`**${mission.title}**`));
    expect(DUELS.map((mission) => mission.title)).toEqual(['By Appointment', 'First Sword', 'Hot Work', 'The Longest Day']);
    expect(titles.every((at) => at >= 0)).toBe(true);
    expect([...titles].sort((a, b) => a - b)).toEqual(titles);
    expect(section).toContain(`hij oververhit pas boven ${sirocco.heatLimit} hitte, waar elke andere mecha dat boven ${HEAT_LIMIT} doet`);
    // A machine glows from three quarters of the way to its own limit (the screen's own test holds that): the guide says what the glow means.
    expect(section).toContain('Gloeit hij van binnenuit, dan zit hij dicht bij zijn grens en is er weinig voor nodig.');
    expect(section).toContain('bewaart hij voor zijn volgende beurt, tot een halve beurt');
    expect(section).toContain('Vesper wacht om de andere ronde (dekking, geen schot) en vuurt de ronde erna één wapen af, met anderhalve beurt energie erachter');
    // What is written over Vesper's machine once it has held: half of what a turn gives it, which is the figure the guide gives.
    const vesper = createBattle(STARTERS[0].build, [ENEMIES.vesper], CATALOG, 1).units[1];
    expect(STRINGS.fx.kept(bufferRoom(vesper, CATALOG))).toBe('+180 EN');
    expect(section).toContain(`Kijk wat er boven hem staat. Knippert daar een getal, zoals **${STRINGS.fx.kept(bufferRoom(vesper, CATALOG))}**, dan heeft hij zoveel energie bewaard en vuurt hij in zijn volgende beurt: kies dan eerst **${STRINGS.actions.guard}**.`);
    expect(section).toContain('Een opgevangen treffer doet nog zes tiende van de schade.');
    expect(section).toContain('Staat er geen getal, dan staat hij open: sla toe.');
    // Its next move is said beside its name, once it is aimed at: in the words the screen writes there.
    expect(section).toContain(`Mik je op hem, dan staat naast zijn naam wat hij gaat doen: **${STRINGS.intent.aim('').trim()}** met het onderdeel waarop hij mikt, of **${STRINGS.intent.hold}** (Nederlands **${STRINGS_NL.intent.aim('').trim()}** en **${STRINGS_NL.intent.hold}**)`);
    expect(section).toContain('Auto Turn zoekt die dekking uit zichzelf');
  });

  test('the guide: what a pilot who flies one sees, in the words the screen writes', () => {
    expect(section).toContain(`**${STRINGS.partInfo.heatLimit(130)}** (Nederlands **${STRINGS_NL.partInfo.heatLimit(130)}**)`);
    expect(section).toContain(`Je hittebalk loopt dan tot ${sirocco.heatLimit} in plaats van ${HEAT_LIMIT}`);
    expect(section).toContain('bijvoorbeeld **84/130**');
    expect(section).toContain(`**${STRINGS.partInfo.buffer}** (Nederlands **${STRINGS_NL.partInfo.buffer}**)`);
    expect(section).toContain('tot de helft van wat een beurt je geeft');
    expect(section).toContain(`bijvoorbeeld **${STRINGS.fx.kept(180)}**`);
    expect(STRINGS.fx.kept(180)).toBe('+180 EN');
    expect(section).toContain('Een piekwapen (**SURGE**) neemt altijd alle energie, dus daarmee blijft er niets over om te bewaren');
    const medal = MEDALS.find((entry) => entry.id === 'works')!;
    expect(section).toContain(`krijgt de medaille **${medal.name}**`);
  });

  test('the README: a section on the two, four duels, and the counts that grew', () => {
    expect(README).toContain('- **De werf**: twee mecha\'s voor het eind van het spel, elk te koop zodra je in een duel de fabriekspiloot van de werf aan de kust verslaat die hem vliegt.');
    expect(README).toContain(`De Sirocco loopt heet: zijn hittegrens is ${sirocco.heatLimit} in plaats van ${HEAT_LIMIT}`);
    expect(README).toContain('De Solstice bewaart de energie die je niet gebruikt voor je volgende beurt, tot een halve beurt.');
    expect(README).toContain('de ander wacht een ronde en vuurt dan met anderhalve beurt energie. Wat hij heeft opgespaard, staat boven hem op het veld.');
    expect(README).toContain(`Na het verhaal: ${word(DUELS.length)} duels, elk om een mecha die je daarna zelf mag kopen.`);
  });
});
