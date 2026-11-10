# IJZERLOON — ontwerp eerste versie

Datum: 2026-11-10
Status: ter goedkeuring

"IJZERLOON" is een werktitel. Alle namen in dit document (wereld, partijen, onderdelen)
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

De planeet Varn is leeggegraven. Drie partijen vechten om wat er over is, en de speler is
een onafhankelijke huurling die werkt voor wie betaalt. De toon is droog en zakelijk;
briefings vertellen zelden de hele waarheid.

| Partij | Karakter | Winkelaanbod |
|---|---|---|
| Hadron Delfstoffen | Mijnbouwconcern. Betaalt goed, liegt in briefings | Zwaar pantser, kinetische wapens |
| Lumen Systemen | Techbedrijf. Koel en berekenend | Energiewapens, lichte frames |
| De Onderstroom | Verzetsgroep. Arm maar eerlijk | Explosieven, goedkope onderdelen |

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

**Taal**: alle speltekst is Nederlands en staat in één tekstbestand, los van de code.

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

### 10.2 Verwerking

Gegenereerd beeld is 1024×1024 en wordt door een script teruggebracht naar spelformaat:
achtergrond verwijderen, verkleinen zonder vervaging en kleuren terugbrengen tot een vast
palet, zodat alle beelden bij elkaar passen.

### 10.3 Samengestelde mech

De mech wordt in zijaanzicht getekend, kijkend naar rechts, uit losse sprites per slot.
Elk been-onderdeel legt vast waar de romp aansluit; elke romp legt vast waar kop, armen en
schouderwapen aansluiten. De tekenvolgorde is vast: achterste arm, benen, romp, kop,
schouderwapen, voorste arm met handwapen.

### 10.4 Proef

De eerste bouwstap is een proef: twee varianten van elk frame-onderdeel en drie wapens
genereren, verwerken en in alle combinaties samenstellen. De opdrachtgever beoordeelt het
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
- Engelse vertaling
- Meerdere opslagplekken
- Publicatie in een app-winkel

De spelregels worden zo opgezet dat een arena, extra missies en extra onderdelen later als
data toegevoegd kunnen worden.
