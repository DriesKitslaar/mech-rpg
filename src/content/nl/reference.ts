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
  'Coast Circuit. A Shrike with a blade and a rifle. It boosts in, strikes and is still boosting: hard to hit until it staggers or loses its legs.':
    'Coast Circuit. Een Shrike met kling en geweer. Boost erin, slaat en boost nog steeds: lastig te raken tot hij wankelt of zijn benen kwijt is.',
  "The Circuit's first sword, in a Sterling. Its field takes what lands first and is whole each round unless you break it. Broken, it is down a round.":
    'Eerste zwaard van het Circuit, in een Sterling. Zijn veld vangt de eerste treffers op en is elke ronde weer heel, tenzij je het breekt. Dan is het een ronde weg.',

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
  'Where the banner says MOMENTUM (two or more machines, none of them a boss, a named pilot, an elite, a Bailiff or an objective\'s target), a volley that destroys one pays for itself: the weapon is ready again, its energy comes back, and the run is counted (CHAIN x2). Heat and rounds stay spent; a charged weapon must charge again.':
    'Waar de banner DOORSTOTEN zegt (twee of meer machines, zonder baas, piloot met naam, elite, Bailiff of doelwit), verdient een schot dat er een vernietigt zichzelf terug: het wapen is weer klaar, de energie komt terug en de reeks wordt geteld (REEKS x2). Hitte en munitie ben je kwijt; een laadwapen moet opnieuw laden.',
  'In the same fights, one hit of yours that takes half of a machine\'s core, as it stood at full strength, finishes it: a heavy weapon goes through a light machine. The aiming line says DESTROYS when a hit would do it. It is never done to you, and a wingman\'s fire does not do it.':
    'In dezelfde gevechten maakt een treffer van jou die de helft van haar kern wegslaat, gemeten op volle sterkte, een machine af: een zwaar wapen gaat dwars door een lichte machine. Bij het richten staat er dan VERNIETIGT. Jou overkomt het nooit, en een wingman doet het niet.',
  'One hit of yours that destroys a machine and does at least one and a half times its whole core, as it stood at full strength, is an OVERKILL: the machine goes up harder and the word is over it. It is said in any fight and changes nothing. How worn the machine already was makes no difference.':
    'Een treffer van jou die een machine vernietigt en minstens anderhalf keer zo zwaar is als haar hele kern op volle sterkte, is een OVERKILL: de machine ontploft harder en het woord staat erboven. Dat kan in elk gevecht en verandert niets. Hoe versleten ze al was, maakt niet uit.',
  'SHATTER':
    'VERMORZELEN',
  'THEY BREAK':
    'ZE VLUCHTEN',
  'SWARMS':
    'ZWERMEN',
  'A NAME':
    'EEN NAAM',
  'What you destroy on contracts earns you a name. Every machine counts one, a boss eight, a rank of the arena four, a telling of the story forty. There are five names; your record says which is yours and what the next asks. A contract\'s banner carries it, unless a boss is coming in, and ordinary machines are told who is coming.':
    'Wat je op contracten vernietigt, geeft je een naam. Een machine telt voor een, een baas voor acht, een arenarang voor vier, het verhaal uitspelen voor veertig. Er zijn er vijf; je dossier toont de jouwe en wat de volgende vraagt. De banner van een contract draagt hem, behalve bij een baas, en gewone machines horen wie er komt.',
  'Some contracts field more machines than a field holds. Three stand at a time; as a round begins the next come on where others fell or left. The line at the top of the field says how many are still to come, and the battle is not won until that is none. The swarm on the open board pays by the head.':
    'Sommige contracten hebben meer machines dan op een veld passen. Er staan er drie tegelijk; aan het begin van een ronde komen de volgende erbij waar er een viel of vluchtte. De regel boven in het veld zegt hoeveel er nog komen; zolang dat er staat, is het niet gewonnen. De zwerm bij de open contracten betaalt per stuk.',
  'Destroy two machines with your weapons in one turn of the same fights and whatever still stands against you loses its nerve. It is marked SHAKEN and is out of the fight when its turn comes, without firing: it leaves (ROUT), or shuts down if it cannot move (OFFLINE). That is not a kill: destroy it first if you want it counted.':
    'Vernietig in dezelfde gevechten twee machines met je wapens in een beurt en wat er nog staat raakt in paniek. Het wordt gemerkt met PANIEK en doet niet meer mee zodra het aan de beurt is, zonder te vuren: het vlucht (VLUCHT), of valt uit als het niet bewegen kan (UIT). Dat telt niet: wees het voor als je het wilt tellen.',
  'MOMENTUM':
    'DOORSTOTEN',
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
  'A won contract is ranked S to D on three things: rounds taken against par, armour lost, and field repairs used. S pays 25% more and A 10% more. The archive lets you play a contract again for a better rank and a share of the pay. A contract won for the other side is kept there as it was first offered.':
    'Een gewonnen contract krijgt rang S tot D op drie punten: rondes tegenover de norm, verloren pantser en veldreparaties. S betaalt 25% meer, A 10% meer. In het archief speel je een contract over voor een betere rang en een deel loon. Wat je voor de andere kant won, staat er zoals het eerst geboden werd.',
  MONEY: 'GELD',
  'Repairs cost 0.8 credits per point of armour and every round fired has a price. Selling a part returns what you paid for it, so trying something out costs nothing. Debt stops you buying, never flying, and you can owe 2000 at most: what a bill adds beyond that, Dispatch writes off.':
    'Reparaties kosten 0.8 credits per punt pantser en elk schot kost geld. Een onderdeel verkopen geeft terug wat je betaalde, dus iets uitproberen kost niets. Schuld belet kopen, nooit vliegen, en je schuld is hooguit 2000: wat een rekening daarboven toevoegt, schrijft Dispatch af.',
  'THE GARAGE': 'DE GARAGE',
  'A build must stay under the weight its legs can carry and within the energy its generator makes. L1 and R1 change the paint. Left and right open your three saved builds.':
    'Een build moet onder het gewicht blijven dat zijn benen dragen en binnen de energie van zijn generator. L1 en R1 wisselen de lak. Links en rechts: je drie bewaarde builds.',
  'LEG TYPES': 'BEENSOORTEN',
  'Reverse legs dodge better when they boost. Four legs are steady and aim shoulder weapons better. Tracks cannot boost, but guard best and are the hardest to stagger. Hover boosts cheaply and is easily knocked off balance.':
    'Omgekeerde benen ontwijken beter als ze boosten. Vier benen staan stevig en richten schouderwapens beter. Rupsbanden kunnen niet boosten, maar dekken het best en wankelen het minst snel. Hover boost goedkoop en raakt makkelijk uit balans.',
  CLASSES: 'KLASSEN',
  'A build is one of seven classes, the first it fits: a blade makes a Duellist, a weapon that charges a Sharpshooter, a salvo Artillery, two or more weapons, all energy, a Lancer, a shield or legs of MOB 18 or less a Bastion, legs of MOB 40 or more a Skirmisher, anything else an All-rounder. The garage names yours.':
    'Een build is een van zeven klassen, de eerste die past: een kling maakt een Duellist, een wapen dat laadt een Scherpschutter, een salvo Artillerie, twee of meer wapens, alle energie, een Lansier, een schild of benen tot MOB 18 een Bastion, benen vanaf MOB 40 een Jager, al het andere een Allrounder. De garage noemt de jouwe.',
  ODDS: 'KANS',
  'A briefing gives the odds of the contract in the build you have chosen: Auto Turn flies it 20 times with your perks, bench work, Overdrive, wingman and difficulty, and its wins are counted. Another build is another count. The odds are what Auto Turn makes of the fight: flying it yourself, you can do better.':
    'Een briefing geeft de kans op het contract in de build die je koos: Auto-beurt vliegt het 20 keer met je perks, werkbank, Overdrive, wingman en moeilijkheid, en telt zijn winst. Een andere build is een andere telling. De kans is wat Auto-beurt van het gevecht maakt: zelf vliegen kan beter.',
  'LEVELS AND PERKS': 'LEVELS EN PERKS',
  'Contracts won are experience. Every level gives a perk point; perks are bought on the pilot screen and kept for good. Medals are earned for what you do, pay a little, and are listed there too.':
    'Gewonnen contracten zijn ervaring. Elk level geeft een perkpunt; perks koop je op het pilotenscherm en hou je voorgoed. Medailles verdien je met wat je doet, ze betalen een beetje, en staan daar ook.',
  'A NEW CYCLE': 'EEN NIEUWE CYCLUS',
  'When the story is over it can be started again. You keep credits, parts, level, perks, medals, the database and arena rank. Enemies get tougher and pay gets better the first two times, then both stay as they are. The bench goes a step further each time, up to five. Some contracts then have a second offer, from the other side.':
    'Als het verhaal uit is kun je opnieuw beginnen. Je houdt credits, onderdelen, level, perks, medailles, de database en je arenarang. De eerste twee keer worden vijanden taaier en stijgt het loon; daarna blijft dat gelijk. De werkbank gaat elke keer een stap verder, tot vijf. Soms ligt er dan een tweede bod, van de andere kant.',
  DIFFICULTY: 'MOEILIJKHEID',
  'Story takes a fifth off enemy armour and firepower; Veteran adds a fifth. Change it in the options whenever you like. Fast battles play everything at two and a half times the speed.':
    'Verhaal: een vijfde minder pantser en vuurkracht voor vijanden; Veteraan: een vijfde meer. Altijd te wijzigen in de opties. Snelle gevechten: alles tweeenhalf keer zo snel.',
  GROUND: 'TERREIN',
  'Some places have a rule for both sides. Rain: all shed 4 more heat a turn. Furnace heat: 4 less. Dust: every shot 5 less likely to hit. Flood water: a boost dodges 6 less. Sealed vault: explosions do 15% less. Crosswind: kinetic hits 6 less likely. Clear air: beams 4 more likely. The briefing and the field name it.':
    'Sommige plekken hebben een regel voor beide kanten. Regen: ieder voert 4 hitte meer af per beurt. Ovenhitte: 4 minder. Stof: elk schot 5 minder trefkans. Vloedwater: een boost ontwijkt 6 minder. Dichte kluis: explosies doen 15% minder. Zijwind: kogels 6 minder trefkans. Klare lucht: stralen 4 meer. Briefing en veld noemen het.',
  'A wingman is hired in the briefing for a share of fee and experience, and fires once a round from round 2. In battle the Wing row gives orders for nothing: strike the strongest, strike what you fired at last, or cover you, which takes a share off every shot at you while they hold fire.':
    'Een wingman huur je in de briefing in voor een deel van loon en ervaring; die vuurt een keer per ronde vanaf ronde 2. In het gevecht geeft de rij Wing gratis orders: de sterkste aanvallen, aanvallen waar jij het laatst op vuurde, of jou dekken, wat van elk schot op jou een deel afhaalt zolang de wingman niet vuurt.',
  'THE GAUNTLET': 'DE GAUNTLET',
  'ELITES AND RELICS': 'ELITES EN RELIKWIEEN',
  'A run of floors in a stock frame, with none of your own parts or perks. Most floors have two doors: pick your fight. After each floor take one thing on offer: a part, a full service, or a boon for the run. Every fifth floor has a warden. Falling, retreating or closing the game on a floor ends the run. It pays by floors cleared.':
    'Een reeks etages in een standaardframe, zonder je eigen onderdelen of perks. De meeste etages hebben twee deuren: kies je gevecht. Kies na elke etage iets uit het aanbod: onderdeel, groot onderhoud of reeksbonus. Elke vijfde etage heeft een bewaker. Vallen, Aftocht of afsluiten op een etage eindigt de reeks. Loon per gehaalde etage.',
  'An elite is a machine with a mark. ARMOURED: two fifths more armour. OVERCLOCKED: a quarter more damage. SWIFT: harder to hit. SHIELDED: a barrier, new every turn. The Gauntlet hides one behind some doors: beat it for one more thing on offer. Some open contracts have one, and pay more. A warden beaten leaves one of two relics.':
    'Een elite is een machine met een merkteken. GEPANTSERD: twee vijfde meer pantser. OVERKLOKT: een kwart meer schade. SNEL: lastiger te raken. SCHILD: een barriere, elke beurt nieuw. In de Gauntlet zit er soms een achter een deur: versla hem voor extra aanbod. Soms ook in een open contract: meer loon. Na een bewaker kies je een van twee relikwieen.',
  'ARENA CUPS': 'ARENABEKERS',
  'A cup is three of the ladder back to back, with only field service between. It opens once you have beaten its three. The purse is paid for all three or not at all: in full the first time, a quarter after.':
    'Een beker is drie van de ranglijst achter elkaar, met alleen veldonderhoud ertussen. Hij opent zodra je zijn drie hebt verslagen. De pot is voor alle drie of voor geen: eerst volledig, daarna een kwart.',
  CONTROLS: 'BESTURING',
  'D-pad: move. A: confirm. B: back. L1 and R1: turn pages, switch tabs, and in battle switch targets. R1 on your own turn sets off a full Overdrive.':
    'D-pad: bewegen. A: kiezen. B: terug. L1/R1: bladeren, van tab en in gevecht van doelwit wisselen. R1 in je beurt zet een volle Overdrive in.',

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
  'Enforce the policy, and default on it.':
    'Voer de polis uit, en blijf erop in gebreke.',
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
  'Ten Marks': 'Tien merktekens',
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
  'Off the Jig':
    'Van de mal',
  'Have the bench work on a part.':
    'Laat de werkbank aan een onderdeel werken.',
  'Blueprinted':
    'Volgens tekening',
  'Take a part to the fifth step at the bench.':
    'Breng een onderdeel naar stap vijf op de werkbank.',
  Stockpile: 'Voorraad',
  'Own 40 different parts.': 'Bezit 40 verschillende onderdelen.',
  'Second Opinion': 'Tweede mening',
  'Win contracts as 3 classes of machine.': 'Win contracten als 3 klassen machine.',
  Specialist: 'Specialist',
  'Win 25 contracts as one class of machine.': 'Win 25 contracten als een klasse machine.',
  'Full Hangar': 'Volle hangar',
  'Win 5 contracts as each of the 7 classes.': 'Win 5 contracten als elk van de 7 klassen.',
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
    'Vanaf pilotenlevel 3 vult zich in gevecht een meter links op het veld: 8 voor een salvo dat raakt, 10 voor een dat je krijgt, 15 voor een gesloopte machine. Is hij vol, dan zet R1 in je beurt je Overdrive in. Tweede Adem begint je beurt opnieuw; IJzerhuid (level 6) halveert schade tot je volgende beurt; Scherpoog (level 9) mist niet.',
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
  'The arena, its cups and its back room.': 'De arena, de bekers en de achterkamer.',
  'The duels with the pilot who keeps turning up.': 'De duels met de piloot die steeds opduikt.',
  'Great machines, and pilots with a name.': 'Grote machines, en piloten met een naam.',
  'The war, the audit and the verdicts.': 'De oorlog, de audit en de vonnissen.',
  'The endings and the end roll.': 'De eindes en de aftiteling.',
  'The room of the Gauntlet, between floors.': 'De kamer van de Gauntlet, tussen de etages.',
  'The floors of the Gauntlet.': 'De etages van de Gauntlet.',
  // The people of Varn: a line about each. Their names stay as they are.
  'The voice on the night shift that hands out the work and reads out the bill. Never gave a name. Sounds tired in a way sleep does not fix.': 'De stem van de nachtdienst die werk uitdeelt en de rekening voorleest. Gaf nooit een naam. Klinkt moe op een manier die slaap niet verhelpt.',
  'Runs the pits of Hadron Mining and counts everything in them, pilots included. Pays promptly. Remembers who cost him money.': 'Leidt de mijnen van Hadron Mining en telt alles wat erin zit, piloten incluis. Betaalt stipt. Onthoudt wie hem geld kostte.',
  'Files people the way Lumen files data: neatly, and for later. Being called reliable by her is a pay grade.': 'Bergt mensen op zoals Lumen data opbergt: netjes, en voor later. Als zij je betrouwbaar noemt, is dat een loonschaal.',
  'Organises the Undertow from wherever the pumps still run. Pays in small notes and long memories.': 'Organiseert de Undertow vanaf waar de pompen nog draaien. Betaalt in kleine biljetten en een lang geheugen.',
  'The voice of the Night Market Guild. Half a face, many rings, and a price for everything, the lights included.': 'De stem van het Night Market-gilde. Een half gezicht, veel ringen, en een prijs voor alles, ook het licht.',
  'The newest licence in Varn, in a frame older than its pilot. Flies wing for a small share and thanks everyone on the radio.': 'De nieuwste licentie van Varn, in een frame dat ouder is dan de piloot. Vliegt mee voor een klein deel en bedankt iedereen via de radio.',
  'Keeps turning up on the other side of the contract. Insists it is only ever business. Keeps count anyway.': 'Duikt steeds op aan de andere kant van het contract. Zegt dat het zakelijk is. Houdt toch de stand bij.',
  'A siege gunner who left Hadron and is officially dead. Fires from somewhere you will not see and invoices promptly.': 'Belegeringsschutter die Hadron verliet en officieel dood is. Vuurt vanaf een plek die jij niet ziet en factureert stipt.',
  'Sixty contracts without a loss, the callsign says. Expensive, careful, and still counting something that is not contracts.': 'Zestig contracten zonder verlies, zegt de roepnaam. Duur, voorzichtig, en telt nog altijd iets wat geen contracten zijn.',
  'The ace of Lumen Systems. Cold, exact, and writes up every fight afterwards. You are in the notes.': 'De aas van Lumen Systems. Koel, precies, en schrijft elk gevecht uit. Jij staat erin.',
  'Flies a scrapyard Mantis for the Undertow and laughs on an open channel. Hits harder than the laugh suggests.': 'Vliegt een Mantis van de schroothoop voor de Undertow en lacht op een open kanaal. Slaat harder dan die lach doet denken.',
  'Chief of security at Hadron. Was here before the company and expects to be here after it.': 'Hoofd beveiliging bij Hadron. Was hier al voor het bedrijf er was en denkt er na het bedrijf nog te zijn.',
  'The adjuster Meridian sends when a war is over. Polite, immaculate, and already knows what you are worth to the decimal.': 'De adjuster die Meridian stuurt als een oorlog om is. Beleefd, smetteloos, en weet al tot op de komma wat jij waard bent.',
  'Stripped the cockpits of downed frames with the pilots still in them. Proud of the helmet collection.': 'Haalde cockpits van gevallen frames leeg met de piloot er nog in. Trots op de helmenverzameling.',
  'Ran a toll on the old mine road and collected it with a mortar.': 'Hief tol op de oude mijnweg en inde die met een mortier.',
  'Contract killer. One shot a job from behind a tower shield, until the job was you.': 'Huurmoordenaar. Een schot per klus van achter een torenschild, tot jij de klus was.',
  'Cut frames open for the Night Market and left the pilots where they fell.': 'Sneed frames open voor de Night Market en liet de piloten liggen.',
  'Decorated in the war by whichever side was paying. Kept the mech, the medals and the habit.': 'In de oorlog gedecoreerd door wie er maar betaalde. Hield de mech, de medailles en de gewoonte.',
  'Left Meridian with a frame, a seal and a client list, and went on foreclosing in private.': 'Verliet Meridian met een frame, een zegel en een klantenlijst, en ging op eigen houtje verder met beslagleggen.',
  'Duels for standing up and down the coast and keeps what it wins. Named for the place a shrike hangs its catch.':
    'Duelleert langs de hele kust om aanzien en houdt de winst. Genoemd naar waar een klauwier zijn vangst ophangt.',
  'First sword of the Coast Circuit for nine seasons. Salutes before the duel and after it, and means it both times.':
    'Negen seizoenen eerste zwaard van het Coast Circuit. Salueert voor het duel en erna, en meent het beide keren.',
  Wingman: 'Wingman',
  'Licensed pilot': 'Piloot met licentie',
  Wanted: 'Gezocht',
  'The Undertow': 'De Undertow',
  // --- Database: what has been found ---
  "WHAT IS FOUND": "WAT GEVONDEN IS",
  "THE BENCH":
    "DE WERKBANK",
  "In the garage, R1 on a part you own puts it on the bench. A step costs its number times the price of the part and adds a twentieth: armour to a frame part, damage to a weapon, output to a generator. The work stays with the part when it is sold. The bench goes two steps, and one further each time the story starts over, to five.":
    "In de garage zet R1 een onderdeel van jou op de werkbank. Een stap kost zijn nummer maal de prijs en voegt een twintigste toe: pantser bij een framedeel, schade bij een wapen, vermogen bij een generator. Het werk blijft bij het onderdeel, ook na verkoop. De werkbank gaat twee stappen, en een verder bij elke nieuwe cyclus, tot vijf.",
  "Some of what you do leaves something behind: a paper, a brass check. The database keeps them under FOUND, the papers by their numbers. One you have not found shows a clue in its place. Nothing found is lost when the story starts over.":
    "Soms laat wat je doet iets achter: een papier, een koperen penning. De database bewaart ze onder VONDST, de papieren op nummer. Wat je nog niet vond toont een aanwijzing. Wat gevonden is blijft als het verhaal opnieuw begint.",
  "RULE BOOK":
    "REGLEMENT",
  "A wet booklet. The first leaf.":
    "Een nat boekje. Het eerste blad.",
  "Not far down the way down. Failing that, the post brings it when all is decided.":
    "Een paar etages diep. Anders brengt de post het als alles beslist is.",
  "MERIDIAN PIT MUTUAL AID SOCIETY. Founded at the No. 1 shaft, Varn. Rule 1: of every wage a tenth, in iron, to the box. Rule 2: the box buries the dead and feeds the hurt. Rule 9: nine checks on the board make a meeting. No rule is struck but by a meeting.":
    "MERIDIAN PIT MUTUAL AID SOCIETY. Opgericht bij schacht No. 1, Varn. Regel 1: van elk loon een tiende, in ijzer, in de kist. Regel 2: de kist begraaft de doden en voedt de gewonden. Regel 9: negen penningen op het bord maken een vergadering. Een regel vervalt alleen door een vergadering.",
  "POLICY VRN-1":
    "POLIS VRN-1",
  "First leaf. Sent by a tidy desk.":
    "Eerste blad. Van een net bureau.",
  "A clerk has it. Clerks post things when they are ready, and not before.":
    "Een klerk heeft het. Klerken posten als ze zover zijn, en niet eerder.",
  "War, riot and civil disturbance. Written at Varn for the Society, by the Society. Joined later: Hadron Mining. Joined later still: Lumen Systems. On total loss, all that is insured passes to the Mutual, to be held for its members.":
    "Oorlog, oproer en burgerlijke onlusten. Geschreven in Varn voor de Society, door de Society. Later toegetreden: Hadron Mining. Nog later: Lumen Systems. Bij total loss gaat al het verzekerde over op de Mutual, te bewaren voor haar leden.",
  "COUNTING RHYME":
    "AFTELRIJM",
  "Sung to children below the gates.":
    "Kinderliedje van onder de poorten.",
  "Children sing it where the lights went out. Put the lights back on.":
    "Kinderen zingen het waar het licht uitging. Doe het licht weer aan.",
  "Brass for the owner / silver for the store / iron for the digger / water for the floor. / Nine on the board / and the box is ours once more.":
    "Koper voor de baas / zilver voor de kas / ijzer voor de delver / water waar hij was. / Negen op het bord, en gauw / is de kist van mij en jou.",
  "SURVEY REPORT":
    "MEETRAPPORT",
  "Bottom of the stack, survey station.":
    "Onder op de stapel, meetstation.",
  "At the bottom of a stack of readings that somebody guards like a mint.":
    "Onder op een stapel metingen die iemand bewaakt als een bankkluis.",
  "Seams one to eight: worked out. Seam nine: worked out. Reserves: nil. Recommendation: none that the Board will care for. Stamped across the page: NOT TO BE CIRCULATED. The date is forty years old.":
    "Aders een tot en met acht: uitgeput. Ader negen: uitgeput. Reserves: nul. Advies: geen dat het Bestuur zal bevallen. Dwars over het blad gestempeld: NIET VERSPREIDEN. De datum is veertig jaar oud.",
  "BOARD MINUTE":
    "BESTUURSNOTULE",
  "Hadron Mining. Forty years old.":
    "Hadron Mining. Veertig jaar oud.",
  "Three roads pass a copy: through a vault, past a stack, under an eye.":
    "Drie wegen komen langs een kopie: door een kluis, langs een stapel, onder een oog.",
  "Item 4. The surveyor's report is received and does not leave this room. Item 5. The Society's box is noted: forty years of tenths. Item 6. The pumps on the bottom level are found uneconomic. Carried.":
    "Punt 4. Het meetrapport is ontvangen en verlaat deze kamer niet. Punt 5. Kennis genomen van de kist van de Society: veertig jaar tienden. Punt 6. De pompen van het onderste niveau zijn onrendabel bevonden. Aangenomen.",
  "SHIFT LOG":
    "LOGBOEK",
  "No. 1 shaft. Night shift. Pencil.":
    "Schacht No. 1. Nachtdienst. Potlood.",
  "Fifteen floors down, in pencil.":
    "Vijftien etages diep, in potlood.",
  "Water at the nine level and still coming. The pump house does not answer. The foreman has the valve keys and has gone up top. We are hanging our checks on the board so that they can count us. Tell the Secretary the box is in the hall.":
    "Water op niveau negen en het stijgt nog. Het pomphuis geeft geen antwoord. De ploegbaas heeft de sleutels van de afsluiters en is naar boven. Wij hangen onze penningen op het bord, dan kunnen ze ons tellen. Zeg de Secretaris dat de kist in de zaal staat.",
  "MINUTE BOOK":
    "NOTULENBOEK",
  "Society Hall. The last page.":
    "Society Hall. De laatste bladzijde.",
  "In the hall, where it was left. Only a frame that has been there twice finds the hall.":
    "In de zaal, waar het bleef liggen. Alleen een frame dat er twee keer was vindt de zaal.",
  "General meeting, bottom level. Present: seven. Adjourned for want of a quorum. The Secretary will act for the Society until one is had. Every page after this is signed by the Secretary. There are forty years of them. The hand never changes.":
    "Ledenvergadering, onderste niveau. Aanwezig: zeven. Verdaagd bij gebrek aan quorum. De Secretaris handelt voor de Society tot er een is. Elk blad hierna is getekend door de Secretaris. Veertig jaar aan bladen. Het handschrift verandert nooit.",
  "PROXY FORM":
    "VOLMACHT",
  "Printed by the thousand.":
    "Per duizend gedrukt.",
  "A man who took a seal and a client list took a ream of these as well.":
    "Een man die een zegel en een klantenlijst meenam, nam hier ook een doos van mee.",
  "I, the undersigned member, being unable to attend, appoint the Secretary to vote for me at any meeting, for ever. The signatures are all in one hand. So are the dates. Each is the day after a flood.":
    "Ik, ondergetekend lid, verhinderd te komen, machtig de Secretaris om voor mij te stemmen op elke vergadering, voor altijd. De handtekeningen zijn allemaal in hetzelfde handschrift. De data ook. Elke datum is de dag na een overstroming.",
  "LETTERHEAD":
    "BRIEFHOOFD",
  "The foot of every page they send.":
    "Onder aan elk blad dat ze sturen.",
  "At the foot of a page. Nobody reads the foot of a page until they have to.":
    "Onder aan een blad. Niemand leest de voet van een blad voor het moet.",
  "Meridian Mutual. A mutual society: owned by its members. Registered office: Society Hall, Bottom Level, Varn. (The office is temporarily inaccessible.)":
    "Meridian Mutual. Een onderlinge: eigendom van haar leden. Statutaire zetel: Society Hall, Onderste Niveau, Varn. (Het kantoor is tijdelijk onbereikbaar.)",
  "WEIGH TICKET":
    "WEEGBON",
  "Hadron rail yard, weighbridge.":
    "Spoorterrein Hadron, weegbrug.",
  "Bring a train in well and wait for the trains to stop. Or, another time round, stop one on the scale.":
    "Breng een trein netjes binnen en wacht tot de treinen stilstaan. Of weeg er, een volgende keer, zelf een.",
  "Ore train, Seam Nine. Declared: full. Weighed: empty. Passed. Consignee: by standing order. In another hand: it has passed like this every night for forty years.":
    "Ertstrein, Ader Negen. Opgegeven: vol. Gewogen: leeg. Doorgelaten. Ontvanger: volgens doorlopende order. In een ander handschrift: zo gaat het elke nacht, al veertig jaar.",
  "ESCORT FILE":
    "ESCORTEDOSSIER",
  "A carbon copy. A clerk kept it.":
    "Een doorslag. Een klerk hield hem.",
  "A clerk kept it. It is sent on once it has been spoken of.":
    "Een klerk bewaarde het. Het wordt doorgestuurd zodra erover gesproken is.",
  "Four trucks, bottom level to the licensing office, by the sluice. Cargo: passengers, and one iron box. Lead escort: SIXTY. Second escort: a callsign, cut out with a knife. Lost at the sluice. Liability: the second escort. Filed so for a fee.":
    "Vier trucks, onderste niveau naar het licentiekantoor, via de sluis. Lading: passagiers, en een ijzeren kist. Escorteleider: SIXTY. Tweede escorte: een roepnaam, uitgesneden met een mes. Verloren bij de sluis. Aansprakelijk: de tweede escorte. Zo geboekt tegen betaling.",
  "STOP ORDER":
    "STOPOPDRACHT",
  "Desk 9. Eleven years old.":
    "Balie 9. Elf jaar oud.",
  "In a relay that listens on a channel that should be dead. First the channel has to speak.":
    "In een relais dat luistert op een kanaal dat dood hoort te zijn. Eerst moet het kanaal spreken.",
  "Stop a freight convoy at the sluice. Do not open the trucks. Payment on confirmation. Taken by a new licence, aged twenty. It is the first entry in a long record.":
    "Stop een vrachtkonvooi bij de sluis. Open de trucks niet. Betaling na bevestiging. Aangenomen door een nieuwe licentie; de piloot is twintig. Het is de eerste regel van een lange staat van dienst.",
  "PLAYBACK ONE":
    "OPNAME EEN",
  "Your frame's recorder. Channel nine.":
    "Recorder van je frame. Kanaal negen.",
  "The frame says it itself, the second time it stands in the water of the dock.":
    "Het frame zegt het zelf, de tweede keer dat het in het water van het dok staat.",
  "Gate four. Trucks one and two are through. Lead, where are you. Lead, answer. Three is burning. I am staying with four. Count the trucks. Count them again.":
    "Poort vier. Truck een en twee zijn erdoor. Leider, waar ben je. Leider, antwoord. Drie brandt. Ik blijf bij vier. Tel de trucks. Tel ze nog eens.",
  "PLAYBACK TWO":
    "OPNAME TWEE",
  "At gate four, when the water is down, if nobody else was sold the way there.":
    "Bij poort vier, als het water laag staat, als niemand anders de weg erheen kocht.",
  "The box is in the water. I can see the lid. Marking the place on the plate. Somebody will have to come back in a dry year. It will not be me. They will take the frame for this.":
    "De kist ligt in het water. Ik zie het deksel. Ik kras de plek in de plaat. Iemand moet terugkomen in een droog jaar. Ik zal het niet zijn. Hiervoor pakken ze het frame af.",
  "OLD LICENCE":
    "OUDE LICENTIE",
  "A desk drawer on the night shift.":
    "Een bureaula van de nachtdienst.",
  "In a drawer that has been shut for eleven years. It opens for a voice it knows.":
    "In een la die elf jaar dicht zat. Hij gaat open voor een stem die hij kent.",
  "A pilot's licence, cancelled eleven years ago. The callsign has been cut out with a knife. The frame number has not. It is the number on your frame.":
    "Een pilotenlicentie, elf jaar geleden ingetrokken. De roepnaam is uitgesneden met een mes. Het framenummer niet. Het is het nummer op jouw frame.",
  "RETAINER":
    "VAST CONTRACT",
  "Sent on with a fee, unasked.":
    "Ongevraagd meegestuurd met een loon.",
  "Somebody who owes you for a hatch sends it with the fee.":
    "Iemand die je iets schuldig is om een luik stuurt het mee met het loon.",
  "Callsign: ASHFALL. Payer: left blank. Renewed eleven times. On the back, in pencil, underlined twice: who.":
    "Roepnaam: ASHFALL. Betaler: niet ingevuld. Elf keer verlengd. Op de achterkant, in potlood, twee keer onderstreept: wie.",
  "MODEL NOTE":
    "MODELNOTITIE",
  "Lumen Systems, forecast desk.":
    "Lumen Systems, afdeling prognoses.",
  "It arrives once you have been asked the price of what your mech has seen.":
    "Het komt als je gevraagd is wat de prijs is van wat je mech zag.",
  "Varn, residual. Input: heads below the gates, counted nightly. Output: years of quorum remaining. Last year: three. Since the dock: six. Recommendation: close the dock. Cut the relay. Count again.":
    "Varn, restwaarde. Invoer: koppen onder de poorten, elke nacht geteld. Uitvoer: resterende jaren quorum. Vorig jaar: drie. Sinds het dok: zes. Advies: sluit het dok. Snijd het relais af. Tel opnieuw.",
  "TAMSIN'S BOOK":
    "TAMSINS BOEK",
  "A school notebook in a biscuit tin.":
    "Een schoolschrift in een koektrommel.",
  "She shows it to the pilot who held her gate. Or to one who has seen a war end before.":
    "Ze toont het aan de piloot die haar poort hield. Of aan wie eerder een oorlog zag eindigen.",
  "Names down one side, numbers down the other. Every line is counted twice and initialled. On the last page: nine with their brass and we can sit. I have never had nine in one room and a door that would stay shut.":
    "Namen aan de ene kant, nummers aan de andere. Elke regel is twee keer geteld en geparafeerd. Op het laatste blad: negen met hun koper en we kunnen vergaderen. Ik had nooit negen in een kamer en een deur die dicht bleef.",
  "PURCHASE ORDER":
    "INKOOPORDER",
  "Desk 9.":
    "Balie 9.",
  "Under the seat of a tank called stolen. Kill it cleanly and wait. Or, another time round, stand beside it.":
    "Onder de stoel van een tank die gestolen heet. Win netjes en wacht. Of ga er een andere keer naast staan.",
  "One tank, Hadron pattern, from stock. Deliver to: the occupants, Seam Nine. Bill to: Hadron Mining, as stolen. One contractor to remove it afterwards. Bill to: Hadron Mining.":
    "Een tank, model Hadron, uit voorraad. Leveren aan: de bezetters, Ader Negen. Factuur aan: Hadron Mining, als gestolen. Een opdrachtnemer om hem daarna op te ruimen. Factuur aan: Hadron Mining.",
  "BOOKING SLIP":
    "BOEKINGSBON",
  "Dispatch, freight desk.":
    "Dispatch, vrachtbalie.",
  "It turns up after a wreck, whatever was done about the wreck.":
    "Het duikt op na een wrak, wat er ook met het wrak gebeurde.",
  "One escort slot, sold twice. Second buyer: Desk 9, on account. Written under it in another pen: do not tell either pilot. I told neither.":
    "Een escorteplek, twee keer verkocht. Tweede koper: Balie 9, op rekening. Eronder in een andere pen: zeg het geen van beide piloten. Ik zei het geen van beiden.",
  "THREE RECEIPTS":
    "DRIE BONNEN",
  "Meridian Mutual. Premiums received.":
    "Meridian Mutual. Ontvangen premies.",
  "In a pocket a long way up. Wait for a wind.":
    "In een zak hoog boven de stad. Wacht op wind.",
  "Hadron Mining: paid, quarterly. Lumen Systems: paid, by the second. The Society: paid in full, forty years in advance. See box.":
    "Hadron Mining: betaald, per kwartaal. Lumen Systems: betaald, per seconde. De Society: volledig betaald, veertig jaar vooruit. Zie kist.",
  "SCHEDULE C":
    "BIJLAGE C",
  "The page of the notice nobody reads.":
    "Het blad dat niemand leest.",
  "Everybody in Varn will be sent one. Hardly anybody will turn to it.":
    "Iedereen in Varn krijgt er een. Bijna niemand bladert ernaartoe.",
  "Movable collateral. Item 1: one salvage frame, with its recorder. Item 2: its pilot, by licence. Items 3 to 40112: see ledger.":
    "Roerend onderpand. Post 1: een geborgen frame, met zijn recorder. Post 2: de piloot ervan, per licentie. Post 3 tot 40112: zie grootboek.",
  "BRASS PLATE":
    "KOPEREN PLAAT",
  "On a door, under water to the lintel.":
    "Op een deur die bijna onder staat.",
  "Twenty floors down. Or on the door itself, for a frame that knows the way.":
    "Twintig etages diep. Of op de deur zelf, voor een frame dat de weg weet.",
  "MERIDIAN PIT MUTUAL AID SOCIETY. REGISTERED OFFICE. MEMBERS ONLY. Everything else down here is green with forty years of water. Somebody has kept the plate polished.":
    "MERIDIAN PIT MUTUAL AID SOCIETY. STATUTAIRE ZETEL. ALLEEN LEDEN. Al het andere hier beneden is groen van veertig jaar water. Iemand heeft de plaat gepoetst gehouden.",
  "THE MINUTES":
    "DE NOTULEN",
  "Society Hall. The ink is still wet.":
    "Society Hall. De inkt is nog nat.",
  "Not written yet.":
    "Nog niet geschreven.",
  "General meeting, Society Hall. Present: eight checks on the board; a ninth, tied to the foot of a frame in the door; the Secretary. The box was opened and the roll read. Item 1: that the Society resume its business. Carried. Item 2: any other business. There was a great deal.":
    "Ledenvergadering, Society Hall. Aanwezig: acht penningen op het bord; een negende, aan de voet van een frame in de deur; de Secretaris. De kist ging open en de lijst is voorgelezen. Punt 1: dat de Society haar werk hervat. Aangenomen. Punt 2: de rondvraag. Dat was heel wat.",
  "CHECK 114":
    "PENNING 114",
  "Tied to your frame's left foot.":
    "Aan de linkervoet van je frame.",
  "Somebody leaves it on the frame when the last boat is away.":
    "Iemand laat hem achter op het frame als de laatste boot weg is.",
  "A brass lamp check, the size of a coin, stamped 114. It was tied to the frame with fishing line after the dock. Forty-one people walked past that foot. None of them will say whose it was.":
    "Een koperen lampenpenning, zo groot als een munt, gestempeld 114. Na het dok met visdraad aan het frame geknoopt. Eenenveertig mensen liepen langs die voet. Niemand wil zeggen van wie hij was.",
  "CHECK 302":
    "PENNING 302",
  "From the newest licence in Varn.":
    "Van de nieuwste licentie van Varn.",
  "A newcomer you spoke up for lasts longer than a week, and pays what he owes.":
    "Een nieuweling voor wie je instond houdt het langer dan een week vol, en betaalt zijn schuld.",
  "Stamped 302. It came on the key ring of his grandmother's frame. He took it for a locker tag. He would like it back if it turns out to be worth something.":
    "Gestempeld 302. Hij zat aan de sleutelring van het frame van zijn oma. Hij hield hem voor een kluisjeslabel. Hij wil hem graag terug als hij iets waard blijkt.",
  "CHECK 58":
    "PENNING 58",
  "Wired to the breech of a siege gun.":
    "Vastgemaakt aan een belegeringskanon.",
  "A dead woman settles what she owes, and adds one thing.":
    "Een dode vrouw vereffent wat ze schuldig is, en doet er iets bij.",
  "Stamped 58. \"My mother's. Hadron took the lamp and forgot the tag. Do not lose it. I am dead. I cannot get another.\"":
    "Gestempeld 58. \"Van mijn moeder. Hadron nam de lamp en vergat het plaatje. Raak het niet kwijt. Ik ben dood. Ik krijg geen nieuw.\"",
  "CHECK 61":
    "PENNING 61",
  "Eleven years in an old coat pocket.":
    "Elf jaar in een oude jaszak.",
  "Bring every truck through the water for a man who could not sit in the seat.":
    "Breng elke truck door het water voor een man die niet in de stoel kon zitten.",
  "Stamped 61. \"It was on the floor of the lead truck. It is not mine. I have never been able to throw it in the water, and I have stood at that water often.\"":
    "Gestempeld 61. \"Hij lag op de vloer van de voorste truck. Hij is niet van mij. Ik kon hem nooit in het water gooien, en ik heb vaak aan dat water gestaan.\"",
  "CHECK 204":
    "PENNING 204",
  "An envelope with no return address.":
    "Een envelop zonder afzender.",
  "Make the board write a thing down eleven years late. Somebody answers the letter.":
    "Laat de commissie iets elf jaar te laat opschrijven. Iemand beantwoordt de brief.",
  "Stamped 204. A note with it: for the pilot who made them write it down. It was my father's. He was on the second truck.":
    "Gestempeld 204. Een briefje erbij: voor de piloot die zorgde dat ze het opschreven. Hij was van mijn vader. Die zat in de tweede truck.",
  "CHECK 9":
    "PENNING 9",
  "Clipped to the paper on your debt.":
    "Vastgeklemd aan je schuldpapier.",
  "It is clipped to a debt, in a vault where paper is kept. Let the night shift off.":
    "Hij zit aan een schuld geklemd, in een kluis vol papier. Laat de nachtdienst vrijuit gaan.",
  "Stamped 9. The paper calls it security. Dispatch held it a long time and then said to keep it with the frame, because that is where it was the last time anybody saw it.":
    "Gestempeld 9. Het papier noemt hem zekerheid. Dispatch hield hem lang vast en zei toen: bewaar hem bij het frame, want daar was hij de laatste keer dat iemand hem zag.",
  "CHECK 441":
    "PENNING 441",
  "Wedged in a hatch you tore off.":
    "Klem in een luik dat jij eraf rukte.",
  "It was wedged in a hatch. Whoever was behind the hatch sends it on.":
    "Hij zat klem in een luik. Wie achter het luik zat stuurt hem door.",
  "Stamped 441. \"It is older than my frame and it is not mine. I asked around about it. People went very quiet. I thought you ought to have the thing that makes people quiet.\"":
    "Gestempeld 441. \"Hij is ouder dan mijn frame en niet van mij. Ik vroeg ernaar. Mensen werden heel stil. Ik vond dat jij het ding moest hebben waar mensen stil van worden.\"",
  "CHECK 12":
    "PENNING 12",
  "Cut out of the Scrap King's shell.":
    "Uit de schil van de Scrap King.",
  "Welded into the shell of a thing that wears what it eats.":
    "Gelast in de schil van een ding dat draagt wat het eet.",
  "Stamped 12. It had been welded over twice. The Guild asked what it was. The Guild was told it fell in the canal.":
    "Gestempeld 12. Er was twee keer overheen gelast. Het Gilde vroeg wat het was. Het Gilde kreeg te horen dat het in het kanaal viel.",
  "CHECK 276":
    "PENNING 276",
  "On a string, among stolen helmets.":
    "Aan een touw, tussen gestolen helmen.",
  "A thief of helmets keeps one thing that nobody would buy.":
    "Een helmendief bewaart een ding dat niemand wil kopen.",
  "Stamped 276. \"That? Off a dead frame in the low lanes. I kept it because it would not shine up. Brass that will not shine has been somewhere.\"":
    "Gestempeld 276. \"Dat? Van een dood frame in de lage stegen. Ik hield hem omdat hij niet wilde glimmen. Koper dat niet glimt is ergens geweest.\"",
  "CHECK 3":
    "PENNING 3",
  "In a seal case, under the seal.":
    "In een zegeldoos, onder het zegel.",
  "Filed as evidence, to be destroyed. The last name on the notices did not destroy it.":
    "Geboekt als bewijs, te vernietigen. De laatste gezochte naam vernietigde hem niet.",
  "Stamped 3. The label reads: evidence of membership, destroy. It was not destroyed. Somebody at Meridian wanted to know what it would be worth one day.":
    "Gestempeld 3. Op het label: bewijs van lidmaatschap, vernietigen. Hij is niet vernietigd. Iemand bij Meridian wilde weten wat hij ooit waard zou zijn.",
  "CHECK 88":
    "PENNING 88",
  "Staked on a fight in the back room.":
    "Ingezet in de achterkamer.",
  "In the room behind the pit, the second to sit down stakes it. Win it.":
    "In de kamer achter de arena zet de tweede die gaat zitten hem in. Win hem.",
  "Stamped 88. \"My family has been holding that for a meeting that never comes. You look like someone who goes to meetings.\"":
    "Gestempeld 88. \"Mijn familie bewaart hem voor een vergadering die nooit komt. Jij ziet eruit als iemand die naar vergaderingen gaat.\"",
  "CHECK 190":
    "PENNING 190",
  "On its hook, ten floors down.":
    "Aan zijn haak, tien etages diep.",
  "Ten floors down there is a board of hooks. One hook is not empty.":
    "Tien etages diep hangt een bord met haken. Een haak is niet leeg.",
  "Stamped 190. A tally board, ten floors down, every hook empty but one. Whoever hung this up at the start of a shift did not come back for it at the end.":
    "Gestempeld 190. Een penningbord, tien etages diep, elke haak leeg op een na. Wie hem ophing aan het begin van een dienst, kwam hem aan het eind niet halen.",
  "CHECK 2":
    "PENNING 2",
  "Thrown from a cockpit, walking away.":
    "Weggegooid uit een cockpit.",
  "A man who kept keys throws it away at last, to whoever puts him on foot.":
    "Een man die sleutels bewaarde gooit hem eindelijk weg, naar wie hem te voet zet.",
  "Stamped 2. A boy's check: the number is low because the boy carried lamps at the first shaft. He has had forty years to throw it away.":
    "Gestempeld 2. De penning van een jongen: het nummer is laag omdat de jongen lampen droeg bij de eerste schacht. Hij had veertig jaar om hem weg te gooien.",
  "CHECK 350":
    "PENNING 350",
  "Handed over with a drink owed.":
    "Overhandigd met een beloofd glas.",
  "A man who laughs on an open channel settles up with his grandmother's brass.":
    "Een man die lacht op een open kanaal rekent af met het koper van zijn oma.",
  "Stamped 350. \"My gran's. She said it opens a hall. I said which hall. She said the wet one, and laughed, and would not say another word.\"":
    "Gestempeld 350. \"Van mijn oma. Ze zei: hij opent een zaal. Ik zei: welke zaal. Ze zei: de natte, en lachte, en zei er geen woord meer over.\"",
  "CHECK 71":
    "PENNING 71",
  "In the wheelhouse of a sunk barge.":
    "In het stuurhuis van een wrak.",
  "In a wheelhouse, on a board of hooks, on a barge with a yard number.":
    "In een stuurhuis, op een bord met haken, op een schuit met een werfnummer.",
  "Stamped 71. The barge had a tally board like a pit. Whoever built her hung up a check before every shift, even to go to war.":
    "Gestempeld 71. De schuit had een penningbord, net als een mijn. Wie haar bouwde hing voor elke dienst een penning op, ook om ten oorlog te gaan.",
  "CHECK 133":
    "PENNING 133",
  "Sent up from the east gate.":
    "Omhoog gestuurd vanaf de oostpoort.",
  "A gate holds because a mech kept its mouth shut. Somebody at the gate sends it up.":
    "Een poort houdt omdat een mech zijn mond hield. Iemand bij de poort stuurt hem omhoog.",
  "Stamped 133. It came in a twist of small notes. \"One of ours wants you counted with us. It is not a gift. It is a seat.\"":
    "Gestempeld 133. Hij kwam in een rolletje kleine biljetten. \"Een van ons wil dat jij met ons wordt meegeteld. Het is geen cadeau. Het is een zetel.\"",
  // --- The third verdict: the Proxy, the Society, and the medals for what is found ---
  "Gavel":
    "Hamer",
  "Meridian's vote for everybody who cannot attend. A barrier, a gavel that knocks you off balance, lien drones every fifth turn, three ways of fighting.":
    "De stem van Meridian voor ieder die niet kan komen. Een barriere, een hamer die je uit balans slaat, Lien Drones om de vijf beurten, drie vechtwijzen.",
  "THE SOCIETY":
    "DE SOCIETY",
  "The Meridian Pit Mutual Aid Society met in its hall for the first time in forty years, with nine checks counted. The Secretary took the minutes. Nobody owns the city now but the people in it, and they own a good deal more than the city.":
    "De Meridian Pit Mutual Aid Society vergaderde voor het eerst in veertig jaar in haar zaal, met negen penningen geteld. De Secretaris notuleerde. De stad is nu van niemand dan van wie er woont, en die bezitten veel meer dan de stad.",
  "Any Other Business":
    "Rondvraag",
  "Hold the meeting.":
    "Hou de vergadering.",
  "Paper Trail":
    "Papieren spoor",
  "Find 12 papers.":
    "Vind 12 papieren.",
  "The Small Print":
    "Kleine lettertjes",
  "Find all 24 papers.":
    "Vind alle 24 papieren.",
  "Nine on the Board":
    "Negen op het bord",
  "Hold nine lamp checks.":
    "Bezit negen lampenpenningen.",

  // The frames a new pilot chooses between.
  "The workhorse":
    "Het werkpaard",
  "The runner":
    "De renner",
  "The wall":
    "De muur",
  "An Undertow dock frame, patched more often than painted. It does everything well enough and has room for three guns. It comes with a rifle.":
    "Een dokframe van de Undertow, vaker gelapt dan geverfd. Het kan alles redelijk en heeft plek voor drie wapens. Er zit een geweer bij.",
  "What is left of a Lumen courier: quick on its feet, hard to hit, thin where it counts. It cannot carry much. It comes with a pistol that never runs dry.":
    "Wat er over is van een koerier van Lumen: snel ter been, lastig te raken, dun waar het telt. Kan weinig dragen. Er zit een pistool bij dat nooit leeg raakt.",
  "A Hadron yard dozer with plate welded over the cab. Slow, hard to hurt, and it carries the most by far. It comes with a rifle and a plate to guard behind.":
    "Een werfdozer van Hadron met plaat over de cabine gelast. Traag, taai, en hij draagt verreweg het meest. Er zit een geweer bij, en een plaat om achter te schuilen.",
};
