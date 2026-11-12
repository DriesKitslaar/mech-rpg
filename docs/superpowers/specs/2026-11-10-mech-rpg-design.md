# IRONWAGE — ontwerp eerste versie

Datum: 2026-11-10
Status: gebouwd. Hoofdstuk 15 beschrijft waar de gebouwde versie van dit ontwerp afwijkt; bij verschil geldt hoofdstuk 15.

"IRONWAGE" is een werktitel. Alle namen in dit document (wereld, partijen, onderdelen)
zijn eigen verzinsels en mogen nog veranderen.

## 1. Doel

Een origineel, beurtgebaseerd mech-RPG voor de Retroid Pocket Classic, als hobbyproject
voor eigen gebruik. De inspiratie is het huurlingenbestaan uit mech-actiespellen: een mech
samenstellen uit losse onderdelen, contracten aannemen, betaald krijgen en verder sleutelen.

De eerste versie is geslaagd als:

- het spel als APK op de Retroid Pocket Classic draait en volledig met D-pad en knoppen
  te bedienen is;
- een doorloop van begin tot een van de drie eindes ongeveer twee uur duurt;
- de keuze van onderdelen merkbaar bepaalt hoe een gevecht verloopt;
- een gemonteerd onderdeel zichtbaar is op de mech in de garage en in het gevecht.

## 2. Doelapparaat

| Eigenschap | Waarde | Gevolg voor het ontwerp |
|---|---|---|
| Scherm | 1240×1080, bijna vierkant | Interne resolutie 310×270, exact 4× vergroot |
| Invoer | D-pad, face-knoppen, schouderknoppen, Start/Select | Geen analoge invoer, geen aanraking nodig |
| Systeem | Android 14 | Oplevering als zelf te installeren APK |

Het spel staat vast in liggende stand en draait schermvullend. Aanraking werkt als
terugvaloptie in menu's, maar is nergens vereist.

## 3. De mech

### 3.1 Sloten

Een mech heeft acht sloten.

| Slot | Soort | Rol |
|---|---|---|
| Kop | Frame | Sensoren: bepaalt de trefkans |
| Romp | Frame | Meeste pantser; valt de romp uit, dan is de mech vernietigd |
| Armen | Frame | Dragen de handwapens; bepalen de stabiliteit bij vuren |
| Benen | Frame | Draagvermogen en beweeglijkheid |
| Generator | Intern | Energie per beurt en koeling |
| Rechterhand | Wapen | |
| Linkerhand | Wapen | |
| Schouder | Wapen | Zwaardere wapens, meer hitte |

Wapensloten mogen leeg blijven. Frame-sloten en de generator zijn verplicht.

### 3.2 Cijfers per onderdeel

- **Frame-onderdelen**: pantserpunten (PP), drie weerstanden (kinetisch, energie,
  explosief, elk 0–60%), gewicht en energieverbruik. Kop: richtbonus. Benen:
  draagvermogen en beweeglijkheid. Armen: richtbonus voor handwapens.
- **Generator**: energie-opbrengst per beurt, koeling per beurt, gewicht.
- **Wapens**: schadesoort, schade, nauwkeurigheid, energiekosten per schot, hitte per
  schot, munitie per missie (energiewapens hebben geen munitie), prijs per schot, gewicht.
- **Alle onderdelen**: prijs en de opdrachtgever bij wie het te koop is.

### 3.3 Grenzen van een build

- **Gewicht**: het totaal mag het draagvermogen van de benen niet overschrijden. Een te
  zware build kan de garage niet verlaten.
- **Energie**: beurtenergie = opbrengst generator − verbruik van alle frame-onderdelen.
  Dit moet minstens zo hoog zijn als de kosten van het goedkoopste gemonteerde wapen.
- **Beweeglijkheid** = beweeglijkheid benen × (1 − 0,5 × belading), waarbij belading =
  gewicht / draagvermogen. Beweeglijkheid bepaalt ontwijken en de beurtvolgorde.

De garage laat bij elke wissel het verschil zien en weigert een ongeldige build met een
duidelijke melding over welke grens overschreden is.

## 4. Het gevecht

### 4.1 Opzet

Eén spelermech tegenover één tot drie vijanden op een vast duel-scherm. Er is geen
beweging over een kaart. De beurtvolgorde loopt per ronde van hoge naar lage
beweeglijkheid; bij gelijke stand gaat de speler eerst.

### 4.2 Een beurt

Aan het begin van de beurt krijgt de mech zijn beurtenergie. Ongebruikte energie vervalt.
De speler kiest acties tot de energie op is of hij de beurt beëindigt.

| Actie | Energie | Effect |
|---|---|---|
| Vuren | Per wapen | Eén schot op een gekozen onderdeel van een gekozen vijand. Elk wapen vuurt hooguit één keer per beurt. |
| Boosten | 30% van de beurtenergie | +30 ontwijken tot de eigen volgende beurt. Eén keer per beurt. Vereist werkende benen. |
| Koelen | 20% van de beurtenergie | Voert direct hitte af ter grootte van de koeling van de generator. Eén keer per beurt. |
| Noodreparatie | Geen, beëindigt de beurt | Herstelt 40% van de PP van één niet-uitgevallen onderdeel. Twee keer per missie. |
| Beurt beëindigen | — | |

Aan het einde van de beurt gaat de koeling van de generator van de hitte af.

### 4.3 Raken en schade

- **Trefkans** = nauwkeurigheid wapen + richtbonus (kop, en armen bij handwapens)
  − ontwijken doelwit + onderdeel-modifier, begrensd tussen 10% en 95%.
- **Onderdeel-modifiers**: romp 0, benen −5, armen −10, kop −20.
- **Ontwijken** = beweeglijkheid, plus 30 bij boosten, en 0 als de benen zijn uitgevallen.
- **Schade** = schade wapen × (1 − weerstand van het geraakte onderdeel tegen die
  schadesoort), afgerond, minimaal 1.

Voor het bevestigen van een schot toont het scherm de trefkans en de verwachte schade.

### 4.4 Uitval van onderdelen

| Onderdeel op 0 PP | Gevolg |
|---|---|
| Benen | Ontwijken wordt 0, boosten kan niet meer |
| Armen | Beide handwapens vallen uit |
| Kop | −30 trefkans |
| Romp | Mech vernietigd |

Schade op een al uitgevallen onderdeel gaat voor de helft door naar de romp.

### 4.5 Hitte

Elk schot voegt hitte toe. Komt de hitte boven 100, dan is de mech oververhit: de
eerstvolgende eigen beurt vervalt en de hitte gaat terug naar 50. De hittemeter staat
altijd in beeld, met een waarschuwing wanneer de gekozen actie tot oververhitting leidt.

### 4.6 Vijanden

Vijanden volgen dezelfde regels, maar hoeven niet alle sloten te hebben. Een geschutstoren
heeft bijvoorbeeld alleen een romp en een wapen; een tank heeft rupsen in plaats van benen.

| Vijand | Karakter |
|---|---|
| Verkenningsdrone | Zwak en moeilijk te raken, komt in groepjes |
| Geschutstoren | Kan niet ontwijken, zwaar wapen, veel pantser |
| Bewakingstank | Sterk tegen kinetisch, zwak voor explosief |
| Lichte mech | Boost vaak, mikt op je kop |
| Zware mech | Traag, veel pantser, wordt snel heet |
| Rivaal-huurling | Eindbaas-niveau, met een volledige build uit spelersonderdelen |

Vijandgedrag is een vaste prioriteitenlijst per type (bijvoorbeeld: koel als oververhitting
dreigt; mik anders op het zwakste onderdeel; boost bij lage PP). Het gedrag gebruikt een
toevalsgenerator met vaste startwaarde, zodat gevechten in tests herhaalbaar zijn.

## 5. Economie

- **Afrekening na een geslaagde missie**: loon − munitiekosten − reparatiekosten.
  Reparatie kost per verloren pantserpunt een vast deel van de prijs van het onderdeel.
- **Mislukte missie**: geen loon, wel munitie- en reparatiekosten. De missie blijft
  beschikbaar. Voortgang gaat nooit verloren.
- **Winkel**: verkopen levert de volledige aankoopprijs op, zodat experimenteren niets kost.
- **Schuld**: het saldo mag negatief worden. Bij een negatief saldo kan de speler niet
  kopen, wel verkopen en contracten aannemen.
- **Vangnet**: er is altijd een herhaalbaar patrouillecontract met laag loon en weinig
  risico, zodat de speler nooit vastloopt.

## 6. Wereld en verhaal

De planeet Varn is leeggegraven. Wat overblijft is één aaneengegroeide industriestad die
nooit donker wordt: natte straten, kranen en pijpleidingen onder neonreclames. Drie
partijen vechten om wat er over is, en de speler is een onafhankelijke huurling die werkt
voor wie betaalt. De toon is droog en zakelijk; briefings vertellen zelden de hele waarheid.

| Partij | Karakter | Winkelaanbod |
|---|---|---|
| Hadron Mining | Mijnbouwconcern. Betaalt goed, liegt in briefings | Zwaar pantser, kinetische wapens |
| Lumen Systems | Techbedrijf. Koel en berekenend | Energiewapens, lichte frames |
| The Undertow | Verzetsgroep. Arm maar eerlijk | Explosieven, goedkope onderdelen |

Het verhaal wordt verteld via briefings, de afrekening en het berichtenscherm. Er zijn
geen tussenfilmpjes en er is geen rondloopbare wereld.

### 6.1 Missiestructuur

Een doorloop telt zeven verhaalmissies; in totaal worden er elf geschreven.

| Fase | Missies | Regel |
|---|---|---|
| Intro | 2 | Vaste volgorde. Leren de basis: vuren en mikken, daarna hitte en boosten |
| Kennismaking | 3, één per partij | Vrije volgorde, alle drie speelbaar |
| Keuze | 1 uit 3 | Eén contract per partij; aannemen laat de andere twee vervallen |
| Finale | 1 uit 3 | Bepaald door loyaliteit |

- **Loyaliteit** per partij = 1 punt voor de kennismakingsmissie + 2 punten voor de
  keuzemissie. Bij deze structuur beslist de keuzemissie dus altijd welke finale volgt.
  De loyaliteit bepaalt daarnaast de toon van berichten en het winkelaanbod.
- **Missie-opbouw**: één tot drie gevechten achter elkaar. Schade, hitte en munitie gaan
  mee naar het volgende gevecht; noodreparaties gelden per missie.
- **Winkelaanbod**: elke voltooide missie voor een partij ontgrendelt nieuwe onderdelen
  van die partij.

## 7. Inhoud van de eerste versie

| Soort | Aantal | Verdeling |
|---|---|---|
| Koppen | 4 | |
| Rompen | 4 | |
| Armen | 4 | |
| Benen | 4 | Waaronder tweebenig licht, tweebenig zwaar, vierpotig en rupsen |
| Generatoren | 3 | Zuinig, gebalanceerd, krachtig |
| Wapens | 11 | 7 handwapens, 4 schouderwapens, verdeeld over de drie schadesoorten |
| Vijandtypes | 6 | Zie 4.6 |
| Verhaalmissies | 11 | Zie 6.1, plus één herhaalbaar patrouillecontract |
| Portretten | 4 | Eén per partij en één rivaal |
| Achtergronden | 6 | Hoofdkwartier, garage en vier slagvelden |

De speler begint met een compleet startframe, één handwapen en een klein saldo.

## 8. Schermen en besturing

Alle schermen zijn getekend op 310×270 en worden 4× vergroot zonder vervaging.

| Scherm | Inhoud |
|---|---|
| Titel | Nieuw spel, verdergaan |
| Hoofdkwartier | Saldo en vier keuzes: contracten, garage, winkel, berichten |
| Contracten | Lijst met opdrachtgever, loon, briefing en bekende tegenstand |
| Garage | Links de samengestelde mech, rechts sloten en cijfers met verschilweergave |
| Winkel | Kopen en verkopen, per partij |
| Berichten | Post van opdrachtgevers en rivalen |
| Gevecht | Speler links, vijanden rechts, onderaan acties en meters |
| Afrekening | Loon, kosten, netto resultaat |

| Knop | Functie |
|---|---|
| D-pad | Kiezen |
| A | Bevestigen |
| B | Terug of annuleren |
| L1 / R1 | Vorige of volgende vijand, slot of tabblad |
| Start | Pauzemenu |

Op een computer werken pijltjestoetsen, Enter, Escape, Q/E en spatie als dezelfde acties.
Dat is nodig om het spel geautomatiseerd te testen.

**Taal**: alle speltekst is Engels, inclusief namen van onderdelen, vijanden en partijen.
De tekst staat in één tekstbestand, los van de code. Dit ontwerpdocument blijft Nederlands;
de Nederlandse termen hierin (zoals "romp" of "noodreparatie") krijgen in het spel een
Engelse naam.

**Opslaan**: automatisch na elke afrekening en elke aankoop of verkoop. Er is één
opslagplek. Het opslagbestand heeft een versienummer; een onleesbaar of te oud bestand
leidt tot een melding en de keuze om opnieuw te beginnen, nooit tot een crash.

**Geluid**: alleen korte gesynthetiseerde tonen voor menu, treffer, misser en uitval.
Geen muziek in deze versie.

## 9. Techniek

### 9.1 Keuzes

- **Taal en bouw**: TypeScript, gebundeld met Vite.
- **Beeld**: Canvas 2D zonder game-engine. Het spel bestaat uit menu's en stilstaande
  sprites met eenvoudige animaties; een engine voegt hier weinig toe.
- **Verpakking**: Capacitor maakt van de webversie een Android-app.
- **Tests**: Vitest voor de spelregels, Playwright voor de schermen.

### 9.2 Lagen

| Laag | Map | Verantwoordelijkheid | Afhankelijk van |
|---|---|---|---|
| Spelregels | `src/core` | Build-validatie, gevecht, vijandgedrag, economie, missievoortgang. Pure functies op een spelstaat, zonder beeld of opslag | Niets |
| Inhoud | `src/content` | Onderdelen, vijanden, missies en teksten als getypeerde data | Types uit `core` |
| Schermen | `src/ui` | Tekent de spelstaat, vertaalt invoer naar spelregel-acties | `core`, `content` |
| Platform | `src/platform` | Invoer (gamepad, toetsenbord), opslag, geluid | Niets |

De spelregels kennen geen schermen en geen opslag. Daardoor zijn ze los te testen en kan
een script duizenden gevechten doorrekenen.

### 9.3 Invoer

De platformlaag vertaalt gamepad-knoppen en toetsen naar negen acties: omhoog, omlaag,
links, rechts, bevestigen, terug, vorige, volgende en menu. Schermen kennen alleen die
acties. De knoptoewijzing staat in één tabel, zodat ze na de eerste test op het toestel
eenvoudig aan te passen is.

### 9.4 Foutafhandeling

- Ongeldige builds worden in de garage geweigerd, niet pas in het gevecht.
- De inhoudsdata wordt bij het opstarten en in de tests gecontroleerd: elke missie
  verwijst naar bestaande vijanden, elke vijand naar bestaande onderdelen, en de
  startuitrusting is een geldige build.
- Een ontbrekende afbeelding wordt vervangen door een gekleurd vlak met de naam erin,
  zodat het spel speelbaar blijft.

## 10. Beeld

### 10.1 Bron

Beeld wordt gegenereerd met een beeldmodel via een bestaande, afgeschermde proxy-functie
buiten deze repository. Het adres en de sleutel staan nergens in de repository; het
generatiescript leest het adres uit een omgevingsvariabele.

Elke afbeelding wordt bewaard met de prompt, het model en de instellingen waarmee hij
gemaakt is, zodat er later in dezelfde stijl bijgemaakt kan worden. Interface-elementen
(kaders, meters, iconen, lettertype) worden in code getekend.

### 10.2 Stijl

De mecha's zijn mensachtig en in Japanse anime-stijl getekend, in eigen ontwerpen die niet
op een bestaande reeks lijken. Er zijn twee families, die de speler vrij mag mengen:

| Familie | Uiterlijk | Rol |
|---|---|---|
| Licht | Slank, wit en marineblauw, cyaan licht, helm met vizier en één antenne | Wendbaar, weinig pantser |
| Zwaar | Geïnspireerd op samoeraiharnassen, antraciet en dieprood, magenta licht | Traag, veel pantser |

Elke familie wordt één keer als complete mecha getekend, en alle families staan in exact
dezelfde actiehouding (schuin van voren, benen uit elkaar, de voorste arm gestrekt naar de
vijand). De wereld is een neonstad bij nacht; de interface gebruikt dezelfde neonkleuren.

### 10.3 Verwerking

Gegenereerd beeld is 1024×1024 en wordt door een script teruggebracht naar spelformaat:
groene achtergrond verwijderen, verkleinen en de kleuren terugbrengen tot één gedeeld palet
dat uit de referentiebeelden is afgeleid. Achtergronden krijgen dat palet niet; ze worden
donkerder gemaakt, zodat de mecha's ertegen afsteken.

### 10.4 Samengestelde mech

De mech werkt als een aankleedpop. De tekening van elke familie wordt in vijf lagen
geknipt: benen, romp, kop, achterste arm en voorste arm. Elke laag houdt de plek die hij
in de houding had. Omdat alle families dezelfde houding delen, passen lagen van
verschillende families op elkaar zonder schalen of verschuiven.

Het onderdeel in een slot bepaalt welke laag getoond wordt; het armen-onderdeel levert
beide armlagen. Het wapen in de rechterhand zit in de vooruitgestoken vuist, dat in de
linkerhand in de achterste vuist, en het schouderwapen hangt achter de achterste schouder.
De tekenvolgorde is vast: schouderwapen, achterste arm, linkerhandwapen, benen, romp, kop,
voorste arm, rechterhandwapen.

Een nieuwe familie kost zes beelden: de complete tekening en vijf lagen.

### 10.5 Proef

De eerste bouwstap is een proef: de lichte en de zware familie tekenen, in lagen knippen en
met drie wapens in alle zestien combinaties samenstellen. De opdrachtgever beoordeelt het
resultaat.

- **Geslaagd**: alle onderdelen worden gegenereerd.
- **Niet geslaagd**: spelersonderdelen worden in code getekend, in het palet van de rest.
  Vijanden, portretten en achtergronden blijven gegenereerd.

De spelregels en schermen zijn in beide gevallen gelijk; alleen de bron van de
onderdeel-sprites verschilt.

## 11. Testen

- **Spelregels**: unit-tests voor build-validatie, trefkans, schade, uitval, hitte,
  economie en missievoortgang.
- **Balans**: een simulatiescript speelt elke missie vele malen met een set referentie-builds
  en rapporteert winstkans en netto opbrengst. Richtlijn: de startuitrusting wint de
  intromissies vrijwel altijd, en elke latere missie is met minstens twee duidelijk
  verschillende builds te winnen.
- **Schermen**: Playwright speelt een vaste route (nieuw spel, garage, missie, afrekening)
  op 1240×1080 met alleen toetsenbordacties en legt screenshots vast.
- **Op het toestel**: knoptoewijzing, leesbaarheid van tekst en gevoel van de besturing
  worden door de opdrachtgever beoordeeld.

## 12. Oplevering

- De APK wordt gebouwd in de ontwikkelomgeving als de Android-bouwtools daar bereikbaar
  zijn, en anders door een GitHub Actions-workflow die de APK als download aanbiedt.
- Het is een debug-APK voor eigen gebruik, te installeren via "onbekende bronnen".

## 13. Bouwvolgorde

1. Proef met onderdeel-sprites en vastleggen van de stijl.
2. Spelregels en één speelbaar gevecht.
3. Garage en winkel.
4. Missies, opdrachtgevers, berichten en opslaan.
5. Eerste APK op het toestel, daarna bijsturen.

## 14. Buiten deze versie

- Tactisch raster of beweging over een kaart
- Wereldkaart, arena en ranglijst
- Rondlopen met een personage
- Muziek
- Vertalingen naar andere talen
- Meerdere opslagplekken
- Publicatie in een app-winkel

De spelregels worden zo opgezet dat een arena, extra missies en extra onderdelen later als
data toegevoegd kunnen worden.

## 15. Wat er bij het bouwen anders is geworden

Tijdens het bouwen is het ontwerp op een aantal punten bijgesteld, meestal omdat een test of
een simulatie liet zien dat de oorspronkelijke regel het spel oneerlijk of onspeelbaar maakte.

### 15.1 Gevecht

- **Terugtrekken**: de speler kan in zijn beurt een gevecht opgeven. Dat telt als nederlaag
  en vraagt eerst om bevestiging. Zonder deze actie kon een gevecht zonder munitie tientallen
  beurten duren.
- **Zonder wapen niet vertrekken**: een build zonder enig wapen mag de garage niet verlaten.
- **Schot op een uitgevallen onderdeel**: de voorspelling en de melding tonen de schade die
  de romp werkelijk krijgt (de helft).
- **Oververhitting**: de straf verlaagt de hitte naar 50 en verhoogt haar nooit.

### 15.2 Vijanden

| Vijand | Gedrag |
|---|---|
| Recon Drone | Spreidt zijn vuur over alle onderdelen |
| Gun Turret | Schiet op de romp, kan niet ontwijken |
| Salvage Tank | Spreidt zijn vuur; bestand tegen kogels, weerloos tegen explosieven |
| Halo Guard (lichte mecha) | Mikt op de kop, boost elke derde ronde |
| Bulwark Enforcer (zware mecha) | Schiet op het meest beschadigde onderdeel |
| Ashfall (de rivaal) | Als de zware mecha, met twee wapens |

Vijandelijke mecha's gebruiken zwakkere wapens dan de winkel verkoopt. Hun plaatje is de
tekening van de bijbehorende familie, gespiegeld.

### 15.3 Missies

- **Veldbeurt**: tussen twee gevechten van één contract verdwijnt de hitte en krijgt elk
  onderdeel 40% van zijn pantser terug, ook een uitgevallen onderdeel. Munitie en
  noodreparaties worden niet aangevuld. Zonder veldbeurt was een contract na het verlies
  van de kop in het eerste gevecht niet meer te winnen.
- **Finale**: de keuze voor een exclusief contract bepaalt de finale. Loyaliteit wordt wel
  geteld, maar beslist niets.
- **Einde**: het einde wordt één keer getoond, bij het eerste bezoek aan het hoofdkwartier
  na de finale, en staat daarna als bericht in de inbox.
- **Winkelaanbod**: de onderdelen van een partij komen in de winkel na het eerste contract
  voor die partij; het Ronin-frame en de Lance Emitter na het exclusieve contract. Het
  startframe en vijf wapens zijn altijd te koop.

### 15.4 Geld

- **Reparatie**: 0,8 credit per verloren pantserpunt, ongeacht de prijs van het onderdeel.
  Met een deel van de prijs werd een zwaarder frame een achteruitgang: het kostte meer om
  te repareren dan het aan bescherming opleverde.
- **Boeken**: de uitkomst van een contract wordt geboekt en opgeslagen op het moment dat het
  laatste gevecht beslist is. Het spel afsluiten op het eindscherm verandert daar niets aan.
  Afsluiten midden in een gevecht kost niets; dat is bewust zo gelaten.
- **Laatste wapen**: het laatste wapen dat een speler bezit kan niet verkocht worden. Een
  speler die toch geen wapen bezit, krijgt in het hoofdkwartier het startgeweer.
- **Startsaldo**: 1200 credits.

### 15.5 Inhoud

- Dertig onderdelen in vier families: Salvage (start), Halo, Bulwark en Ronin.
- Twaalf contracten: de patrouille, twee introducties, drie klantcontracten, drie exclusieve
  contracten en drie finales.
- Zes vijanden, vier portretten en vijf achtergronden (vier slagvelden en de hangar).
- De tabellen met alle waarden staan in `src/content`; die bestanden zijn leidend.

### 15.6 Opslag

Het opslagbestand heeft versie 3. Bestanden van versie 1 en 2 worden bij het laden
opgewaardeerd in plaats van geweigerd. Staat er iets opgeslagen dat niet te lezen is, dan
meldt het titelscherm dat.

### 15.7 Balans

Elk contract is honderden keren gespeeld door een automatische speler met een uitrusting
die op dat moment betaalbaar is. Die speler wint de introducties altijd, de klantcontracten
in 88 tot 100% van de gevallen, de exclusieve contracten in 73 tot 100% en de finales in 55
tot 74%. De balans is niet met mensen getest.


## 16. De uitbreiding

Na de eerste versie is gevraagd om een volwaardig spel met meer speeluren en keuzes. Het
bouwplan staat in `docs/superpowers/plans/2026-11-12-expansion.md`. Hoofdstuk 14 noemde de
arena en muziek nog als "buiten deze versie"; die zijn er nu.

### 16.1 Piloot

- Een gewonnen contract geeft ervaring: een tiende van het loon. Verliezen geeft niets.
- Twintig niveaus. Elk niveau boven het eerste geeft één punt.
- Acht vaardigheden met twee of drie rangen: trefkans, ontwijken, energie per beurt,
  koeling, een extra noodreparatie, pantser, hoger loon, lagere kosten.
- Punten zijn niet terug te krijgen.

### 16.2 Wapens met een eigenschap

| Eigenschap | Werking |
|---|---|
| Pierce | De weerstand van het doelwit telt voor de helft |
| Thermal | Een treffer maakt het doelwit warmer |
| Drain | Een treffer haalt energie weg uit de volgende beurt van het doelwit |
| Twin | Twee schoten, apart gerold, voor één keer munitie, energie en hitte |

### 16.3 Meer onderdelen en vijanden

- Achttien nieuwe onderdelen, 48 in totaal: de families Wraith (snelst, scherpst) en
  Colossus (zwaarst), twee generatoren en acht wapens.
- Vier nieuwe vijanden: het gunship, de lanstoren, de Wraith Stalker en de Colossus
  Juggernaut.
- Een vijandelijke mecha die alleen staat, wordt op volle grootte getekend uit de lagen van
  zijn onderdelen, gespiegeld tegenover de speler.
- Vijanden raken nooit door hun munitie heen.
- Een contract kan vijanden sterker of zwakker maken met één factor voor pantser en schade.

### 16.4 Arena

Tien tegenstanders, elk met een eigen mecha uit winkelonderdelen, in vaste volgorde. Wie de
volgende in de rij verslaat, stijgt een rang en krijgt de volle premie (800 tot 7000). Een
tegenstander die al verslagen is, levert bij een herkansing een kwart op. De arena gaat open
na de introducties. Arenarang geeft toegang tot de beste onderdelen in de winkel.

### 16.5 Losse contracten

Na de introducties staan er drie gegenereerde contracten op het bord, naast de vaste. Ze
volgen uit het aantal gewonnen gevechten en de ronde: na herladen staat hetzelfde bord er,
na elk gewonnen gevecht een nieuw. Het bord wordt één trap zwaarder per vijf gewonnen
gevechten (en twee per ronde), tot trap acht. De drie contracten zitten op trap −2, −1 en 0
ten opzichte van het bord, zodat er altijd een lichtere keuze is. Loon: 250 per
budgetpunt plus 200 per gevecht.

Dit wijkt af van het plan (één trap per drie gevechten, alle drie op dezelfde trap, budget
tot 9): in de simulatie werd het bord dan sneller zwaar dan een speler kan bijbenen.

### 16.6 Nieuwe ronde

Na het einde biedt het hoofdkwartier "New Cycle". Credits, onderdelen, niveau, vaardigheden
en arenarang blijven. De voltooide contracten en gelezen berichten worden gewist, zodat het
verhaal opnieuw begint en opnieuw een keuze en een einde heeft. Per ronde worden
verhaalvijanden 35% sterker en betaalt het verhaal 50% meer. De patrouille verandert niet.

### 16.7 Opties en muziek

Geluid, muziek en snelle gevechten (2,5 keer zo snel). De opties staan apart van het spel
opgeslagen, zodat ze ook werken voordat er een spel is. De muziek bestaat uit twee korte
lussen (menu en gevecht) die net als de geluiden uit losse tonen zijn opgebouwd.

### 16.8 Opslag

Versie 4. Versie 1 tot en met 3 worden opgewaardeerd.

### 16.9 Balans

Dezelfde automatische speler heeft de arena, het bord en de volgende rondes gespeeld
(`npm run simulate -- --arena`, `--board`, `--cycle 1`). Elke arenategenstander is te
verslaan met de uitrusting die op dat moment betaalbaar is (56 tot 96%); de kampioen vraagt
de zwaarste uitrusting (47%, meer met vaardigheden). De tweede ronde is goed te doen met
eindspeluitrusting, de derde is zwaar. Niet met mensen getest; de muziek en geluiden zijn
nooit beluisterd.
