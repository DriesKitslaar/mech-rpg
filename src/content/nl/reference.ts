/**
 * Dutch for the reference texts: the database (units, world, manual), the perks, the medals and
 * the part names of the great machines. Keyed by the exact English.
 */
export const REFERENCE_NL: Record<string, string> = {
  // --- Database: the units ---
  'The cheapest thing in the sky. Thin armour and a light gun; they only matter in numbers.':
    'Het goedkoopste dat vliegt. Dun pantser, licht kanon; ze tellen pas in aantallen.',
  'Rocket pods on rotors. It has little armour. Bring it down before the pods add up.':
    'Raketpods op rotors. Weinig pantser. Haal het neer voor de pods gaan optellen.',
  'While it flies, every other enemy takes 40% less damage. Shoot it first.':
    'Zolang het vliegt, krijgt elke andere vijand 40% minder schade. Schiet het eerst neer.',
  'Every turn it welds armour back onto the most damaged friend it has. Shoot it first.':
    'Elke beurt last het pantser terug op zijn zwaarst beschadigde maat. Schiet het eerst neer.',
  'Walks up and goes off on its third turn for heavy damage. Destroy it before then, or guard.':
    'Loopt op je af en ontploft in zijn derde beurt: zware schade. Vernietig het eerder, of zet je schrap.',
  'Bolted down, so it never dodges. Its plating stops bullets well and blasts badly.':
    'Vastgebout, dus het ontwijkt nooit. Zijn pantser stopt kogels goed en explosies slecht.',
  'A sentry lance on a post. It cannot dodge and has little armour, but its aim is good.':
    'Een wachtlans op een paal. Kan niet ontwijken en heeft weinig pantser, maar richt goed.',
  'A mast with no gun. While it stands, everything you fire is 20 less likely to hit.':
    'Een mast zonder wapen. Zolang hij staat, is je trefkans met alles 20 lager.',
  'Tracks and a howitzer. Bullets bounce off the hull; blasts do not.':
    'Rupsbanden en een houwitser. Kogels ketsen af op de romp; explosies niet.',
  'Launches a recon drone every second turn while fewer than three enemies stand. Kill the carrier, not its drones.':
    'Lanceert elke tweede beurt een Recon Drone zolang er minder dan drie vijanden staan. Sloop de drager, niet zijn drones.',
  'Lumen security. Quick, and hard to hit while its legs work. Fire at the core anyway. Staggered, it cannot dodge.':
    'Beveiliging van Lumen. Snel, en lastig te raken zolang zijn benen werken. Vuur toch op de kern. Wankelt het, dan ontwijkt het niet.',
  'Charges a piercing longbow for a turn, then fires it. Guard or boost on the turn it is loaded.':
    'Laadt een beurt een doorborende longbow op en vuurt. Dekking of Boost als hij geladen is.',
  'Hadron muscle. Slow, thick, and it goes for whatever is already damaged. Beams cut through it.':
    'Spierkracht van Hadron. Traag, dik, en het pakt wat al beschadigd is. Stralen snijden erdoorheen.',
  'A Bulwark on tracks behind a riot shield, with a mortar. Tracks cannot boost, so it is easy to hit. Beams cut through it.':
    'Een Bulwark op rupsbanden achter een oproerschild, met mortier. Rupsbanden boosten niet: makkelijk te raken. Stralen snijden erdoor.',
  'Twin needles on fast legs, aimed at your head to spoil your aim. Staggered, it cannot dodge at all.':
    'Twee naalden op snelle benen, gericht op je hoofd om je mikken te bederven. Wankelt het, dan ontwijkt het niets.',
  "The Undertow's jumping frame. It boosts in and strikes with a claw. Blasts barely mark it.":
    'Het springframe van de Undertow. Boost naar je toe en slaat met een klauw. Explosies deren het amper.',
  'The heaviest frame there is, with a maul and a mortar. Nothing gets through it easily.':
    'Het zwaarste frame dat er is, met een moker en een mortier. Niets komt er makkelijk doorheen.',
  'A licensed pilot in a Ronin frame, with a lance and a rack. Hits hard and takes it well.':
    'Een piloot met licentie in een Ronin-frame, met een lans en een rek. Slaat hard en incasseert goed.',
  'Ashfall, at war': 'Ashfall, in oorlog',
  'Ashfall with a barrier that soaks up the first damage each time it is raised, and a second wind.':
    'Ashfall met een barriere die de eerste schade opvangt, telkens als ze opgaat, en een tweede adem.',
  'Ashfall Unbound': 'Ashfall ontketend',
  'Ashfall with nothing held back: lance, edge and rack, a barrier, and two changes of pace.':
    'Ashfall zonder rem: lans, kling en rek, een barriere, en twee tempowissels.',
  "Lumen's best pilot. A piercing rifle at range and a blade when she closes. Do not let her choose the distance.":
    'Lumens beste piloot. Doorborend geweer van ver, kling van dichtbij. Laat haar de afstand niet kiezen.',
  "The Undertow's champion. He closes in every turn with a cutting torch that heats you up, and drops chaff.":
    'De kampioen van de Undertow. Nadert elke beurt met een snijbrander die je verhit, en strooit chaff.',
  "Hadron's strike-breaker, in a Colossus behind a tower shield. Slow, and very hard to hurt while he guards.":
    'Hadrons stakingsbreker, in een Colossus achter een torenschild. Traag, en amper te deren zolang hij zich schrap zet.',
  'A barge with a jaw. It drops a bomb crawler every fourth turn. Blasts barely mark it; beams do.':
    'Een schuit met een kaak. Lost elke vierde beurt een Bomb Crawler. Explosies doen weinig; stralen wel.',
  'A mining machine the size of a campus. It hardly moves, so little misses it. Its hull laughs at bullets; use beams.':
    'Een mijnmachine zo groot als een campus. Beweegt amper, dus weinig mist. Zijn romp lacht om kogels; gebruik stralen.',
  "Lumen's eye over the lower levels. It spoils your aim and charges a beam. Beams slide off it.":
    'Lumens oog boven de lage niveaus. Bederft je mikken en laadt een straal op. Stralen glijden eraf.',
  "Meridian's errand runner. Sturdier than a recon drone, and each hit drains your next turn's energy.":
    'Meridians loopjongen. Steviger dan een Recon Drone, en elke treffer kost je energie in je volgende beurt.',
  "Meridian's Auditor frame: a piercing rifle and a coil that drains your energy. Armoured alike all round.":
    'Meridians Auditor-frame: doorborend geweer en een spoel die je energie aftapt. Rondom gelijk gepantserd.',
  'A Bailiff with a barrier and a decree that charges for a turn. It refits itself when it starts losing.':
    'Een Bailiff met een barriere en een decreet dat een beurt oplaadt. Bouwt zichzelf om als het gaat verliezen.',
  "Meridian's claim on the city, on tracks. A barrier, lien drones every fourth turn, three ways of fighting.":
    'Meridians claim op de stad, op rupsbanden. Een barriere, Lien Drones elke vierde beurt, drie vechtwijzen.',
  'A mortar in a ring of plate. It cannot move and often misses, but what lands takes a quarter of a core. Beams go through the ring.':
    'Een mortier in een ring van staal. Kan niet bewegen en mist vaak, maar wat raakt, kost een kwart kern. Stralen gaan door de ring.',
  'A dart with twin needles, aimed at your head. Very hard to hit. Anything that lands on it is nearly enough.':
    'Een pijl met twee naalden, gericht op je hoofd. Heel lastig te raken. Wat het wel raakt, is bijna genoeg.',
  'A gun on two legs. Each volley is three small blasts over the whole mech. Its legs are easier to break than its housing.':
    'Een kanon op twee benen. Elk salvo is drie kleine explosies over de hele mech. Zijn benen breken makkelijker dan zijn kast.',
  'A ram on wheels. It drives in and hits with the plate, and what it hits is thrown off balance. Its wheels are softer than its hull.':
    'Een ram op wielen. Rijdt in en slaat met de plaat, en wat hij raakt, raakt uit balans. Zijn wielen zijn zachter dan zijn romp.',
  'A pylon that throws lightning. It cannot move. Every hit heats you by 16. Beams slide off it.':
    'Een paal die bliksem werpt. Kan niet bewegen. Elke treffer geeft je 16 hitte. Stralen glijden eraf.',
  'A rail on rotors. It charges for a turn, then shoots through half your armour. Frail: kill it while it charges.':
    'Een railkanon op rotors. Laadt een beurt op en schiet dan door de helft van je pantser. Broos: sloop het tijdens het opladen.',
  'The Scrap King': 'De Scrap King',
  'A crab of welded wrecks from under the Night Market. A pincer that staggers, flak from its back, and it gets worse twice.':
    'Een krab van gelaste wrakken van onder de Night Market. Een schaar die doet wankelen, flak vanaf zijn rug, en twee keer wordt het erger.',
  'The Night Train': 'De Night Train',
  'A rail cannon on wheels. The cannon charges for a turn and pierces; the gun ports never wait. It cannot dodge.':
    'Een railkanon op wielen. Het kanon laadt een beurt op en doorboort; de schietgaten wachten nooit. Kan niet ontwijken.',
  'Wanted. A Halo in violet with a carbine and a needle, both aimed at your head. Shoot the legs and it stops dancing.':
    'Gezocht. Een Halo in violet met een karabijn en een naald, beide op je hoofd gericht. Schiet op de benen en het dansen stopt.',
  'Wanted. A Bulwark on tracks with a shotgun and a mortar. Tracks cannot boost, so it is easy to hit. Beams cut through it.':
    'Gezocht. Een Bulwark op rupsbanden met shotgun en mortier. Rupsbanden boosten niet: makkelijk te raken. Stralen snijden erdoor.',
  'Wanted. Charges a piercing longbow behind a tower shield. Guard or boost on the turn it is loaded.':
    'Gezocht. Laadt een doorborende longbow op achter een torenschild. Dekking of Boost als hij geladen is.',
  'Wanted. A Mantis that leaps in with a thermal cutter. Every cut heats you up. Blasts barely mark it.':
    'Gezocht. Een Mantis die toespringt met een thermische snijder. Elke snee verhit je. Explosies deren het amper.',
  'Wanted. A Ronin with a thermal lance and an inferno pod. It spreads its fire over all of you. Vent early.':
    'Gezocht. Een Ronin met een thermische lans en een infernopod. Spreidt zijn vuur over je hele mech. Koel op tijd.',
  'Wanted. An Auditor frame gone private: a barrier, a draining coil and a decree. It hits harder once it is losing.':
    'Gezocht. Een Auditor-frame dat voor zichzelf begon: een barriere, een aftappende spoel en een decreet. Slaat harder zodra het verliest.',

  // --- Database: the world ---
  'A mining city on a seam that should have run dry forty years ago. The pits go down, the towers go up, and the lowest streets flood every spring. Nobody governs Varn. Three powers hold it between them, and none of them will fight for it in person.':
    'Een mijnstad op een ader die veertig jaar geleden op had moeten zijn. De mijnen gaan omlaag, de torens omhoog, en de laagste straten lopen elk voorjaar onder. Niemand bestuurt Varn. Drie machten delen het, en geen van de drie vecht er zelf voor.',
  'THE LICENCE': 'DE LICENTIE',
  "A pilot's licence lets you carry weapons inside the city for pay. It is issued on credit. Yours came with a salvaged frame and a debt, and the debt is the larger of the two. Repairs and ammunition come out of every fee.":
    'Met een pilotenlicentie mag je in de stad tegen betaling wapens dragen. Je krijgt haar op krediet. Bij de jouwe zaten een geborgen frame en een schuld, en de schuld is de grootste van de twee. Reparaties en munitie gaan van elk loon af.',
  'The office that finds a licensed pilot work and takes its cut. Dispatch has no side. It will sell your time to anyone whose money clears, and it keeps a standing patrol contract for the days nobody else is hiring.':
    'Het kantoor dat werk zoekt voor piloten met licentie en zijn deel pakt. Dispatch kiest geen kant. Het verkoopt je tijd aan iedereen wiens geld klopt, en houdt een vast patrouillecontract aan voor de dagen dat niemand anders inhuurt.',
  'The oldest power in Varn. Hadron owns the seam, the rails and most of the people who work them. It builds heavy: Bulwark frames, tracks, shields, guns fed by the belt. Its answer to most problems is more plating. Director Brenn speaks for it.':
    'De oudste macht in Varn. Hadron bezit de ader, het spoor en de meeste mensen die er werken. Het bouwt zwaar: Bulwark-frames, rupsbanden, schilden, wapens met bandvoeding. Zijn antwoord op de meeste problemen is meer pantser. Directeur Brenn spreekt namens Hadron.',
  'Lumen sells calculation: routes, prices, forecasts, and the security that keeps them private. Its towers are the newest thing in Varn. Its Halo frames are light, quick and precise, and nearly everything it makes fires a beam. Analyst Varga speaks for it.':
    'Lumen verkoopt rekenwerk: routes, prijzen, prognoses, en de beveiliging die ze geheim houdt. Zijn torens zijn het nieuwste van Varn. Zijn Halo-frames zijn licht, snel en precies, en bijna alles wat het maakt vuurt een straal af. Analist Varga spreekt namens Lumen.',
  'THE UNDERTOW': 'DE UNDERTOW',
  'Not a company. The people of the flooded levels: salvage crews, pump hands, gate-keepers. They build from what the other two throw away, and they are fond of explosives. Tamsin speaks for them, when anyone asks.':
    'Geen bedrijf. Het volk van de verdronken niveaus: bergers, pompvolk, sluiswachters. Ze bouwen van wat de andere twee weggooien, en houden van explosieven. Tamsin spreekt voor hen, als iemand vraagt.',
  'FREELANCE FRAMES': 'VRIJE FRAMES',
  'Not every frame has a flag on it. Ronin, Wraith and Colossus are built by small shops for pilots who answer to nobody, and sold to anyone who can pay. They are not cheap.':
    'Niet elk frame draagt een vlag. Ronin, Wraith en Colossus komen uit kleine werkplaatsen, voor piloten zonder baas, en gaan naar wie kan betalen. Goedkoop zijn ze niet.',
  'THE ARENA': 'DE ARENA',
  'Ranked pilots fight for purses in a pit under the rail yard. It is licensed, legal and heavily bet on. Beat the next rank and the purse is yours in full; beat someone you have beaten before and you get a quarter.':
    'Piloten met rang vechten om de pot in een kuil onder het emplacement. Vergund, legaal, en er wordt zwaar gewed. Versla de volgende rang en de hele pot is van jou; versla iemand opnieuw: een kwart.',
  'THE BACK ROOM': 'DE ACHTERKAMER',
  'Behind the pit is a room the crowd does not know about. Five pilots fight there who stopped caring about the ladder years ago: for larger purses, without an audience, and only against a champion.':
    'Achter de kuil ligt een kamer waar het publiek niets van weet. Daar vechten vijf piloten die de ranglijst al jaren niets meer kan schelen: om hogere potten, zonder publiek, en alleen tegen een kampioen.',
  'A licensed pilot in a Ronin frame, with a longer record than yours. Ashfall takes the contracts that begin with the words "stop this person". Nobody at Dispatch will say who is paying.':
    'Een piloot met licentie in een Ronin-frame, met een langere staat van dienst dan jij. Ashfall neemt de contracten die beginnen met "hou deze persoon tegen". Niemand bij Dispatch zegt wie er betaalt.',
  'THE WAR': 'DE OORLOG',
  'Nobody declared it. The three powers stopped sharing the city and started hiring. Each wants a pilot of its own, and only its own. Whoever you fly for, the other two will pay someone to stop you.':
    'Niemand heeft hem verklaard. De drie machten hielden op de stad te delen en gingen inhuren. Elk wil een eigen piloot, en alleen een eigen. Voor wie je ook vliegt, de andere twee betalen iemand om je te stoppen.',
  'THE FLOODGATES': 'DE SLUIZEN',
  'The gates that seal the lower levels from the city above. Both companies held them, and held them shut. With the gates open Varn is one city again, and neither company will ever hire whoever opened them.':
    'De sluizen die de lage niveaus afsluiten van de stad erboven. Beide bedrijven hielden ze bezet, en dicht. Nu ze open staan is Varn weer een geheel, en geen van beide huurt ooit nog in wie ze opende.',
  "Lumen's best pilot, in a Wraith frame. She fought with a piercing rifle and finished with a blade. Lumen's models priced her above the vault she was guarding. The models were wrong about one of them.":
    'Lumens beste piloot, in een Wraith-frame. Ze vocht met een doorborend geweer en eindigde met een kling. Lumens modellen prijsden haar boven de kluis die ze bewaakte. Bij een van de twee zaten ze ernaast.',
  "The Undertow's champion. He came up through the salvage yards with a cutting torch and never put it down. He fought for the pleasure of it, which Lumen's models found difficult to price.":
    'De kampioen van de Undertow. Hij kwam op uit de sloperijen met een snijbrander en legde hem nooit meer neer. Hij vocht voor zijn plezier, en dat konden Lumens modellen moeilijk prijzen.',
  'Hadron ran its pits through one man. Krell broke every strike Varn ever had from inside a Colossus, behind a tower shield and a jammer mast. He fought dirty and he never tired.':
    'Hadron leidde zijn mijnen via een enkele man. Krell brak elke staking in Varn vanuit een Colossus, achter een torenschild en een stoormast. Hij vocht vuil en werd nooit moe.',
  'A barge the Undertow floated out of the old drowned yards and gave a jaw. It ate pump stations and shed walking bombs like a dog sheds hair. Blasts barely marked it. It is back under the water now.':
    'Een schuit die de Undertow uit de oude verdronken werven lichtte en een kaak gaf. Hij vrat pompstations en verloor loopbommen zoals een hond haar verliest. Explosies deerden hem amper. Hij ligt nu weer onder water.',
  'THE STRIP-MINER': 'DE STRIP-MINER',
  'A Hadron mining machine roughly the size of the campus it was pointed at. A bucket wheel, blasting charges and a hull that laughed at bullets. It barely moved and it could not be reasoned with.':
    'Een mijnmachine van Hadron, ongeveer zo groot als de campus waar hij op gericht stond. Een graafwiel, springladingen en een romp die om kogels lachte. Hij bewoog amper en er viel niet mee te praten.',
  'THE OVERSEER': 'DE OVERSEER',
  'The machine Lumen watched the lower levels through. Lumen called it the Overseer; the Undertow called it the Eye. It spoiled your aim, kept a shield drone close, and beams slid off it.':
    'De machine waarmee Lumen de lage niveaus bekeek. Lumen noemde hem de Overseer; de Undertow noemde hem het Oog. Hij bedierf je mikken, hield een Shield Drone dichtbij, en stralen gleden eraf.',
  'The war had an insurer. All three sides bought the same policy from the same firm, and none of them read it. Meridian Mutual has declared Varn a total loss. Everything in it is collateral now: the mines, the towers, the gates. Your licence is on the list.':
    'De oorlog had een verzekeraar. Alle drie de partijen kochten dezelfde polis bij dezelfde firma, en geen van hen las hem. Meridian Mutual heeft Varn total loss verklaard. Alles erin is nu onderpand: de mijnen, de torens, de sluizen. Jouw licentie staat op de lijst.',
  'THE AUDITORS': 'DE AUDITORS',
  "Meridian's machines are pale, quiet and all alike. Lien drones clamp on to anything that still has power. Bailiffs serve the writs. They do not fight to win. They fight to collect, and they drain your generator while they do it.":
    'Meridians machines zijn bleek, stil en allemaal gelijk. Lien Drones klemmen zich vast aan alles wat nog stroom heeft. Bailiffs betekenen de exploten. Ze vechten niet om te winnen. Ze vechten om te innen, en tappen intussen je generator af.',
  'The voice Meridian uses when it wants something signed. It values competence. It offers to clear your debt and restore your licence, and it has one account in Varn still open.':
    'De stem van Meridian als iets getekend moet worden. Ze waardeert vakwerk. Ze wil je schuld wissen en je licentie herstellen, en heeft in Varn nog een rekening open.',
  COLLECTIONS: 'INCASSO',
  "Meridian's Collections division took on one more pilot the night the last account in Varn was closed. The debt is cleared. The frame is your own. The city is settled.":
    'Meridians afdeling Incasso nam er een piloot bij in de nacht dat de laatste rekening in Varn werd gesloten. De schuld is gewist. Het frame is van jou. De stad is vereffend.',
  'THE ADJUSTER': 'DE ADJUSTER',
  "Meridian's claim on Varn lived in one machine in its clearing house. With the Adjuster broken the policy is void. Nobody owns the city. Nobody owes it either, which is new.":
    'Meridians claim op Varn zat in een machine in zijn clearinghuis. Met de Adjuster kapot is de polis nietig. De stad is van niemand. Niemand is haar iets schuldig ook, en dat is nieuw.',

  // --- Database: the manual ---
  'THE BASICS': 'DE BASIS',
  'You are paid by the contract. A contract is one to three battles; damage and spent rounds carry from one to the next. Win and the fee is yours, less repairs and ammunition. Lose or walk away and you pay those all the same.':
    'Je wordt per contract betaald. Een contract is een tot drie gevechten; schade en verschoten munitie gaan mee naar het volgende. Win en het loon is van jou, min reparaties en munitie. Verlies of loop weg en je betaalt die toch.',
  'YOUR TURN': 'JOUW BEURT',
  'Each turn your generator gives you energy. Spend it on firing each weapon once, on Boost, Guard or Vent, then end the turn. Your module costs none. The more mobile unit acts first each round. Auto Turn plays one turn for you.':
    'Elke beurt geeft je generator energie. Besteed die aan een keer vuren per wapen, aan Boost, Dekking of Koelen, en eindig dan de beurt. Je module kost niets. De mobielste eenheid handelt elke ronde eerst. Auto-beurt speelt een beurt voor je.',
  AIMING: 'RICHTEN',
  'Pick a target and a part. The core is the easiest to hit; legs are 5 harder, arms 10, the head 20. Destroy the core and the unit is gone. A part that is already destroyed passes half of any further damage on to the core.':
    'Kies doelwit en onderdeel. De kern raak je het makkelijkst; benen 5 lastiger, armen 10, het hoofd 20. Zonder kern is de eenheid weg. Een vernietigd onderdeel geeft de helft van verdere schade door aan de kern.',
  'LOSING PARTS': 'ONDERDELEN KWIJT',
  'Without legs a unit cannot dodge or boost. Without arms it cannot fire what it holds in its hands, though a shield there still covers it. Without a head its aim drops by 30. That is as true of you as of them.':
    'Zonder benen kan een eenheid niet ontwijken of boosten. Zonder armen vuurt ze niet met wat ze vasthoudt, al dekt een schild daar haar nog wel. Zonder hoofd daalt haar trefkans met 30. Dat geldt ook voor jou.',
  'DAMAGE TYPES': 'SCHADESOORTEN',
  "Kinetic, energy, explosive. Every part resists each kind differently, and the units page shows what an enemy's core is weak to once you have met it. A piercing weapon halves the resistance it meets.":
    'Kinetisch, stralen, explosief. Elk onderdeel weerstaat elke soort anders, en de eenhedenpagina toont waar de kern van een vijand zwak voor is zodra je hem kent. Een doorborend wapen halveert de weerstand.',
  HEAT: 'HITTE',
  "Firing makes heat, and your generator sheds some at the end of every turn. Pass 100 and you overheat: your next turn is lost. Vent sheds heat at once for a fifth of a turn's energy.":
    'Vuren geeft hitte; je generator voert na elke beurt wat af. Boven 100 oververhit je: volgende beurt weg. Koelen voert meteen hitte af voor een vijfde van een beurt energie.',
  STAGGER: 'WANKELEN',
  "Every hit pushes on the target's balance; the thin bar shows how much it has left. When it runs out the unit staggers: it cannot dodge, takes 30% more damage, and starts its next turn with less energy. Heavy mechs are steadier.":
    'Elke treffer duwt tegen de balans van het doelwit; de dunne balk toont hoeveel er over is. Is die op, dan wankelt de eenheid: ze kan niet ontwijken, krijgt 30% meer schade en begint haar volgende beurt met minder energie. Zware mechs staan steviger.',
  'BOOST AND BLADES': 'BOOST EN KLINGEN',
  'Boost makes you much harder to hit until your next turn. A blade can only strike in a turn that began with a boost, and the strike uses the boost up. Tracks cannot boost at all.':
    'Boost maakt je tot je volgende beurt veel lastiger te raken. Een kling slaat alleen in een beurt die met een boost begon; de slag verbruikt de boost. Rupsbanden boosten nooit.',
  GUARD: 'DEKKING',
  "Guard costs a fifth of a turn's energy. Until your next turn it stops 40% of the damage and half the push of every hit. A shield in the left hand stops more, and so do tracks.":
    'Dekking kost een vijfde van een beurt energie. Tot je volgende beurt stopt ze 40% van de schade en de halve duw van elke treffer. Een schild links stopt meer, rupsbanden ook.',
  'CHARGED WEAPONS': 'LAADWAPENS',
  'Some weapons charge for a turn before they fire. When an enemy has one loaded, the turn before it fires is the time to guard or boost.':
    'Sommige wapens laden een beurt op voor ze vuren. Heeft een vijand er een geladen, kies dan de beurt voor het schot Dekking of Boost.',
  'One module fits each mech: a coolant flush, a barrier, an overclock, a target painter and others. A module has a few uses per battle and costs no energy. The shop and the garage say what each one does.':
    'In elke mech past een module: koelspoeling, barriere, overklok, doelmarkeerder en andere. Een module gaat per gevecht een paar keer mee en kost geen energie. Winkel en garage zeggen wat elke doet.',
  'FIELD REPAIRS': 'VELDREPARATIES',
  'Twice per contract you can patch a damaged part in the field, which restores 40% of its armour. A destroyed part cannot be patched. A repair ends your turn, so fire first. Each one you use lowers your rank a little.':
    'Twee keer per contract kun je in het veld een beschadigd onderdeel oplappen: dat herstelt 40% van zijn pantser. Een vernietigd onderdeel is niet op te lappen. Een reparatie eindigt je beurt, dus vuur eerst. Elke reparatie verlaagt je rang iets.',
  'ENEMY TRICKS': 'VIJANDELIJKE TRUCS',
  'Shield drones cover the others. Repair drones weld them back together. Jammers spoil your aim. Bomb crawlers go off on a fuse. Carriers launch more. Shoot the helper first.':
    'Shield Drones dekken de rest. Repair Drones lassen ze weer aan elkaar. Stoorders bederven je mikken. Bomb Crawlers gaan af op een lont. Dragers lanceren er meer. Schiet eerst op de helper.',
  OBJECTIVES: 'DOELEN',
  'Not every battle is won by destroying everything. Some ask you to outlast a number of rounds, to protect something, to take out one leader, to disable a machine without destroying it, or to drive a pilot off. The line at the top of the field says which.':
    'Niet elk gevecht win je door alles te vernietigen. Soms moet je een aantal rondes overleven, iets beschermen, een leider uitschakelen, een machine stilleggen zonder haar te vernietigen, of een piloot verjagen. De regel boven het veld zegt welke.',
  RANKS: 'RANGEN',
  'A won contract is ranked S to D on three things: rounds taken against par, armour lost, and field repairs used. S pays 25% more and A 10% more. The archive lets you play a contract again for a better rank and a share of the pay.':
    'Een gewonnen contract krijgt rang S tot D op drie punten: rondes tegenover de norm, verloren pantser en veldreparaties. S betaalt 25% meer, A 10% meer. In het archief speel je een contract over voor een betere rang en een deel loon.',
  MONEY: 'GELD',
  'Repairs cost 0.8 credits per point of armour and every round fired has a price. Selling a part returns what you paid for it, so trying something out costs nothing. Debt stops you buying, never flying, and you can owe 2000 at most: what a bill adds beyond that, Dispatch writes off.':
    'Reparaties kosten 0.8 credits per punt pantser en elk schot kost geld. Een onderdeel verkopen geeft terug wat je betaalde, dus iets uitproberen kost niets. Schuld belet kopen, nooit vliegen, en je schuld is hooguit 2000: wat een rekening daarboven toevoegt, schrijft Dispatch af.',
  'THE GARAGE': 'DE GARAGE',
  'A build must stay under the weight its legs can carry and within the energy its generator makes. L1 and R1 change the paint. Left and right open your three saved builds.':
    'Een build moet onder het gewicht blijven dat zijn benen dragen en binnen de energie van zijn generator. L1 en R1 wisselen de lak. Links en rechts: je drie bewaarde builds.',
  'LEG TYPES': 'BEENSOORTEN',
  'Reverse legs dodge better when they boost. Four legs are steady and aim shoulder weapons better. Tracks cannot boost, but guard best and are the hardest to stagger. Hover boosts cheaply and is easily knocked off balance.':
    'Omgekeerde benen ontwijken beter als ze boosten. Vier benen staan stevig en richten schouderwapens beter. Rupsbanden kunnen niet boosten, maar dekken het best en wankelen het minst snel. Hover boost goedkoop en raakt makkelijk uit balans.',
  'LEVELS AND PERKS': 'LEVELS EN PERKS',
  'Contracts won are experience. Every level gives a perk point; perks are bought on the pilot screen and kept for good. Medals are earned for what you do, pay a little, and are listed there too.':
    'Gewonnen contracten zijn ervaring. Elk level geeft een perkpunt; perks koop je op het pilotenscherm en hou je voorgoed. Medailles verdien je met wat je doet, ze betalen een beetje, en staan daar ook.',
  'A NEW CYCLE': 'EEN NIEUWE CYCLUS',
  'When the story is over it can be started again. You keep credits, parts, level, perks, medals, the database and your arena rank. Enemies get tougher and contracts pay better each time.':
    'Is het verhaal uit, dan kun je het opnieuw beginnen. Je houdt credits, onderdelen, level, perks, medailles, de database en je arenarang. Vijanden worden taaier en contracten betalen beter, elke keer.',
  DIFFICULTY: 'MOEILIJKHEID',
  'Story takes a fifth off enemy armour and firepower; Veteran adds a fifth. Change it in the options whenever you like. Fast battles play everything at two and a half times the speed.':
    'Verhaal: een vijfde minder pantser en vuurkracht voor vijanden; Veteraan: een vijfde meer. Altijd te wijzigen in de opties. Snelle gevechten: alles tweeenhalf keer zo snel.',
  GROUND: 'TERREIN',
  'Seven places have a rule for both sides. Rain: all shed 4 more heat a turn. Furnace heat: 4 less. Dust: every shot 5 less likely to hit. Flood water: a boost dodges 6 less. Sealed vault: explosions do 15% less. Crosswind: kinetic hits 6 less likely. Clear air: beams 4 more likely. The briefing and the field name it.':
    'Zeven plekken hebben een regel voor beide kanten. Regen: ieder voert 4 hitte meer af per beurt. Ovenhitte: 4 minder. Stof: elk schot 5 minder trefkans. Vloedwater: een boost ontwijkt 6 minder. Dichte kluis: explosies doen 15% minder. Zijwind: kogels 6 minder trefkans. Klare lucht: stralen 4 meer. Briefing en veld noemen het.',
  'A wingman is hired in the briefing for a share of fee and experience, and fires once a round from round 2. In battle the Wing row gives orders for nothing: strike the strongest, strike what you fired at last, or cover you, which takes a share off every shot at you while they hold fire.':
    'Een wingman huur je in de briefing in voor een deel van loon en ervaring; die vuurt een keer per ronde vanaf ronde 2. In het gevecht geeft de rij Wing gratis orders: de sterkste aanvallen, aanvallen waar jij het laatst op vuurde, of jou dekken, wat van elk schot op jou een deel afhaalt zolang de wingman niet vuurt.',
  'THE GAUNTLET': 'DE GAUNTLET',
  'A run of floors in a stock frame, with none of your own parts or perks. Most floors have two doors: pick your fight. After each floor take one thing on offer: a part, a full service, or a boon for the run. Every fifth floor has a warden. Falling, retreating or closing the game on a floor ends the run. It pays by floors cleared.':
    'Een reeks etages in een standaardframe, zonder je eigen onderdelen of perks. De meeste etages hebben twee deuren: kies je gevecht. Kies na elke etage een aangeboden ding: onderdeel, groot onderhoud of reeksbonus. Elke vijfde etage heeft een bewaker. Vallen, Aftocht of afsluiten op een etage eindigt de reeks. Loon per gehaalde etage.',
  'Behind one of two doors there is sometimes an elite. ARMOURED: two fifths more armour. OVERCLOCKED: a quarter more damage. SWIFT: harder to hit. SHIELDED: a barrier, new every turn. Beat it and one more thing is on offer. A warden beaten patches you up and leaves one of two relics: each bends a rule for the rest of the run.':
    'Achter een van twee deuren zit soms een elite. GEPANTSERD: twee vijfde meer pantser. OPGEVOERD: een kwart meer schade. SNEL: lastiger te raken. BESCHERMD: een barriere, elke beurt nieuw. Versla hem voor een extra aanbod. Een verslagen bewaker lapt je op en geeft een van twee relikwieen: elk buigt de hele reeks een regel.',
  'ARENA CUPS': 'ARENABEKERS',
  'A cup is three of the ladder back to back, with only field service between. It opens once you have beaten its three. The purse is paid for all three or not at all: in full the first time, a quarter after.':
    'Een beker is drie van de ranglijst achter elkaar, met alleen veldonderhoud ertussen. Hij opent zodra je zijn drie hebt verslagen. De pot is voor alle drie of voor geen: eerst volledig, daarna een kwart.',
  CONTROLS: 'BESTURING',
  'D-pad: move. A: confirm. B: back. L1 and R1: turn pages, switch tabs, and in battle switch targets. R1 on your own turn sets off a full Overdrive.':
    'D-pad: bewegen. A: bevestigen. B: terug. L1 en R1: bladeren, tabs en in gevecht doelwitten. R1 in je eigen beurt zet een volle Overdrive in.',

  // --- Perks ---
  Marksman: 'Scherpschutter',
  '+4 hit chance with every weapon.': '+4 trefkans met elk wapen.',
  Reflexes: 'Reflexen',
  '+4 evasion while your legs work.': '+4 ontwijken zolang je benen werken.',
  'Capacitor Tuning': 'Condensatortuning',
  '+20 energy every turn.': '+20 energie per beurt.',
  'Heat Sinks': 'Koelribben',
  '+5 heat shed every turn and when venting.': '+5 hitte-afvoer per beurt en bij Koelen.',
  'Field Technician': 'Veldmonteur',
  '+1 field repair per contract.': '+1 veldreparatie per contract.',
  'Reinforced Plating': 'Versterkt pantser',
  '+6% armour on every part.': '+6% pantser op elk onderdeel.',
  Haggler: 'Afdinger',
  '+8% pay on every contract.': '+8% loon op elk contract.',
  Quartermaster: 'Kwartiermeester',
  '-15% ammunition and repair costs.': '-15% kosten voor munitie en reparaties.',

  // --- Medals ---
  'First Invoice': 'Eerste factuur',
  'Complete a contract.': 'Voltooi een contract.',
  'Steady Work': 'Vast werk',
  'Complete 25 contracts.': 'Voltooi 25 contracten.',
  Institution: 'Instituut',
  'Complete 100 contracts.': 'Voltooi 100 contracten.',
  'Write-Off': 'Afschrijving',
  'Lose a contract. It happens to everyone once.': 'Verlies een contract. Overkomt iedereen een keer.',
  'Live to Bill': 'Later factureren',
  'Walk away from a contract.': 'Loop weg van een contract.',
  'Six Figures': 'Zes cijfers',
  'Be paid 100000 credits for contracts, all told.': 'Verdien in totaal 100000 credits met contracten.',
  Liquid: 'Liquide',
  'Hold 30000 credits at once.': 'Heb 30000 credits tegelijk.',
  'Scrap Dealer': 'Schroothandelaar',
  'Destroy 50 enemies.': 'Vernietig 50 vijanden.',
  "Breaker's Yard": 'Sloperij',
  'Destroy 250 enemies.': 'Vernietig 250 vijanden.',
  Surgeon: 'Chirurg',
  'Shoot 60 parts off enemies.': 'Schiet 60 onderdelen van vijanden af.',
  'Off Balance': 'Uit balans',
  'Stagger enemies 40 times.': 'Laat vijanden 40 keer wankelen.',
  'Dead Centre': 'Midden in de roos',
  'Land 1000 shots.': 'Schiet 1000 keer raak.',
  'Bomb Disposal': 'Explosievenopruiming',
  'Destroy 5 bomb crawlers before they go off.': 'Vernietig 5 Bomb Crawlers voor ze afgaan.',
  'Giant Killer': 'Reuzendoder',
  'Win a battle against a boss.': 'Win een gevecht tegen een baas.',
  'Machine Breaker': 'Machinebreker',
  'Win 8 battles against bosses.': 'Win 8 gevechten tegen bazen.',
  Hothead: 'Heethoofd',
  'Lose 10 turns to heat.': 'Verlies 10 beurten aan hitte.',
  'Not a Scratch': 'Geen krasje',
  'Win a contract without being hit.': 'Win een contract zonder geraakt te worden.',
  Untouchable: 'Onaantastbaar',
  'Win 10 contracts without being hit.': 'Win 10 contracten zonder geraakt te worden.',
  'Signature Work': 'Gesigneerd werk',
  'Earn an S rank on a story contract.': 'Haal een S-rang op een verhaalcontract.',
  'Gold Standard': 'Gouden standaard',
  'Hold an S rank on 10 story contracts.': 'Heb een S-rang op 10 verhaalcontracten.',
  'Perfect Ledger': 'Sluitend kasboek',
  'Hold an S rank on 25 story contracts.': 'Heb een S-rang op 25 verhaalcontracten.',
  'Under Contract': 'Onder contract',
  'Take a side in the war.': 'Kies een kant in de oorlog.',
  'Company Man': 'Man van de zaak',
  'Win the war for Hadron Mining.': 'Win de oorlog voor Hadron Mining.',
  'Clean Hands': 'Schone handen',
  'Win the war for Lumen Systems.': 'Win de oorlog voor Lumen Systems.',
  'Flood Gate': 'Sluisdeur',
  'Win the war for the Undertow.': 'Win de oorlog voor de Undertow.',
  'Free Agent': 'Vrije jongen',
  'Win the war for each of the three clients.': 'Win de oorlog voor elk van de drie klanten.',
  Audited: 'Doorgelicht',
  "See Meridian's audit through.": 'Zit de audit van Meridian uit.',
  'Paid in Full': 'Volledig voldaan',
  'Enforce the policy.': 'Voer de polis uit.',
  Defaulted: 'In gebreke',
  'Default on the policy.': 'Blijf in gebreke op de polis.',
  'Both Columns': 'Debet en credit',
  'Give both verdicts.': 'Vel beide vonnissen.',
  Renewal: 'Verlenging',
  'Start the war again.': 'Begin de oorlog opnieuw.',
  'On the Ladder': 'Op de ranglijst',
  'Win an arena fight.': 'Win een arenagevecht.',
  'Champion of Varn': 'Kampioen van Varn',
  'Take first place in the arena.': 'Pak de eerste plaats in de arena.',
  'Know Thyself': 'Ken jezelf',
  'Win a mirror match against your own build.': 'Win een spiegelduel tegen je eigen build.',
  'Last One Standing': 'Laatste overeind',
  'Beat everyone in the back room of the arena.': 'Versla iedereen in de achterkamer van de arena.',
  Silverware: 'Tafelzilver',
  'Win an arena cup.': 'Win een arenabeker.',
  'Full Cabinet': 'Volle prijzenkast',
  'Win all three arena cups.': 'Win alle drie de arenabekers.',
  'Past the Warden': 'Langs de bewaker',
  'Clear 5 floors of the Gauntlet in one run.': 'Haal 5 etages van de Gauntlet in een reeks.',
  'Deep Water': 'Diep water',
  'Clear 10 floors of the Gauntlet in one run.': 'Haal 10 etages van de Gauntlet in een reeks.',
  'No Floor': 'Bodemloos',
  'Clear 20 floors of the Gauntlet in one run.': 'Haal 20 etages van de Gauntlet in een reeks.',
  'Marked Down': 'Afgeprijsd',
  'Beat an elite in the Gauntlet.': 'Versla een elite in de Gauntlet.',
  'Ten Marks': 'Tien merken',
  'Beat 10 elites in the Gauntlet.': 'Versla 10 elites in de Gauntlet.',
  Reliquary: 'Reliekschrijn',
  'Hold three relics in one run of the Gauntlet.': 'Heb drie relikwieen in een reeks van de Gauntlet.',
  Licensed: 'Met licentie',
  'Reach pilot level 5.': 'Bereik pilotenlevel 5.',
  Veteran: 'Veteraan',
  'Reach pilot level 10.': 'Bereik pilotenlevel 10.',
  Ace: 'Aas',
  'Reach pilot level 20.': 'Bereik pilotenlevel 20.',
  Qualified: 'Gediplomeerd',
  'Pass every training drill.': 'Haal elke oefening van de training.',
  'Company Colours': 'Bedrijfskleuren',
  'Repaint your mech.': 'Spuit je mech over.',
  'Spare Suit': 'Reservepak',
  'Save a build in the garage.': 'Bewaar een build in de garage.',
  Stockpile: 'Voorraad',
  'Own 40 different parts.': 'Bezit 40 verschillende onderdelen.',
  'Field Guide': 'Veldgids',
  'Meet 20 kinds of enemy.': 'Ontmoet 20 soorten vijand.',
  'Know Your Enemy': 'Ken je vijand',
  'Meet every kind of enemy there is.': 'Ontmoet elke soort vijand die er is.',
  'Fully Vested': 'Pensioen rond',
  'Earn every other medal.': 'Verdien elke andere medaille.',

  // --- Part names of the great machines (at most 5 letters) ---
  Shell: 'Schil',
  Legs: 'Benen',
  Claws: 'Klauw',
  Lamps: 'Lamp',
  Wheel: 'Wiel',
  Grate: 'Grill',
  Hull: 'Romp',
  Tread: 'Rups',
  Core: 'Kern',
  Eye: 'Oog',
  Crane: 'Kraan',
  Deck: 'Dek',
  Seal: 'Zegel',
  Base: 'Voet',
  Scale: 'Waag',
  // The Overdrive: its medals and its page of the manual.
  'Set off an Overdrive.': 'Zet een Overdrive in.',
  'Set off 50 Overdrives.': 'Zet 50 Overdrives in.',
  'Redline': 'In het rood',
  'Past the Stop': 'Voorbij de begrenzer',
  'From pilot level 3 a meter at the left edge of the field fills as you fight: 8 for a volley that lands, 10 for one you take, 15 for a machine destroyed. Full, R1 on your turn sets off your Overdrive. Second Wind starts your turn over; Iron Skin (level 6) halves damage until your next turn; Deadeye (level 9) cannot miss.':
    'Vanaf pilotenlevel 3 vult zich in gevecht een meter links op het veld: 8 voor een vuurstoot die raakt, 10 voor een die je krijgt, 15 voor een gesloopte machine. Is hij vol, dan zet R1 in je beurt je Overdrive in. Tweede Adem begint je beurt opnieuw; IJzerhuid (level 6) halveert schade tot je volgende beurt; Scherpoog (level 9) mist niet.',
  // The jukebox: what each song is heard with. The songs keep their names.
  'The title. Where every contract begins.': 'De titel. Waar elk contract begint.',
  'Between contracts: the garage, the shop and the board.': 'Tussen contracten: de garage, de winkel en het bord.',
  'Briefings, and the story between them.': 'Briefings, en het verhaal ertussen.',
  'The first act and the odd jobs.': 'De eerste akte en de losse klussen.',
  'A contract won.': 'Een contract gewonnen.',
  'A contract lost.': 'Een contract verloren.',
  'The briefings of Director Brenn.': 'De briefings van directeur Brenn.',
  'The briefings of Analyst Varga.': 'De briefings van analist Varga.',
  'The briefings of Tamsin.': 'De briefings van Tamsin.',
  'The arena, its cups and its back room.': 'De arena, haar bekers en haar achterkamer.',
  'The duels with the pilot who keeps turning up.': 'De duels met de piloot die steeds opduikt.',
  'Great machines, and pilots with a name.': 'Grote machines, en piloten met een naam.',
  'The war, the audit and the verdicts.': 'De oorlog, de audit en de vonnissen.',
  'The endings and the end roll.': 'De eindes en de aftiteling.',
  'The room of the Gauntlet, between floors.': 'De kamer van de Gauntlet, tussen de etages.',
  'The floors of the Gauntlet.': 'De etages van de Gauntlet.',
};
