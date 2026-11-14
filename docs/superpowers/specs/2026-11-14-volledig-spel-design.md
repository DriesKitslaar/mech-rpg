# IRONWAGE: het volledige spel

Vervolg op `2026-11-10-mech-rpg-design.md` (hoofdstuk 1 tot en met 16). Dat document beschrijft
het spel zoals het nu is: een campagne van zeven contracten per doorloop, een arena, losse
contracten, pilootniveaus, 48 onderdelen, opties en eenvoudige muziek.

## 1. Opdracht

De eigenaar vroeg op 14 november: werk zelfstandig door tot er een volwaardig, "triple-A"
aanvoelend spel voor de Retroid Pocket Classic staat. Beslis zelf wat leuk is. Geef in totaal
hoogstens €20 uit aan OpenAI-beeld.

Er zijn geen vragen gesteld; alle keuzes hieronder zijn die van de bouwer en kunnen later
worden teruggedraaid.

## 2. Wat "volwaardig" hier betekent

Een spel van één persoon en een beeldgenerator wordt geen productie van honderd mensen. Wat
wél haalbaar is, en wat dit document als doel neemt:

1. **Elke beurt een echte keuze.** Het gevecht krijgt meer lagen dan "schiet op de romp".
2. **Je mecha is van jou.** Meer sloten, meer onderdelen, eigen kleuren, bewaarde builds.
3. **Een verhaal dat ergens heen gaat.** Drie aktes, personages met een stem, bazen, en een
   slot dat het thema (loon, schuld, wie er uiteindelijk int) afmaakt.
4. **Uren inhoud.** Circa 30 verhaalcontracten, een trainingsprogramma, een grotere arena,
   rangen om te verbeteren, medailles.
5. **Het voelt af.** Overgangen, effecten, muziek per situatie, een handleiding, meerdere
   opslagplekken, geen losse eindjes.

Niet het doel: 3D, online, gesproken tekst, andere platforms, een andere besturing dan D-pad
en knoppen. Het spel blijft Engels en blijft een eigen wereld met eigen namen.

## 3. Grenzen

- **Beeld**: hoogstens €20 in totaal, inclusief wat al is uitgegeven (geschat €2). Eén
  afbeelding op lage kwaliteit kost ongeveer $0,006 tot $0,02. Het script houdt een kasboek
  bij (`art/ledger.json`) en weigert te genereren boven een harde grens van $12 aan nieuwe
  afbeeldingen. Alleen lage kwaliteit: hogere kwaliteit duurt langer dan de 30 seconden die
  het netwerk toelaat.
- **Opslag**: een opgeslagen spel van een oudere versie blijft altijd laadbaar.
- **Nooit vastlopen**: de patrouille blijft, het laatste wapen blijft onverkoopbaar.
- **Techniek**: ongewijzigd (TypeScript, Canvas 310×270, Vitest, Playwright, Capacitor).
  Regels in `src/core`, inhoud en tekst in `src/content`, schermen in `src/ui`.
- **Samenvoegen** op GitHub gebeurt alleen op verzoek van de eigenaar.

## 4. Aanpak: zes fasen

Overwogen:

- **Alles tegelijk, één grote oplevering.** Afgewezen: als het werk halverwege stopt, staat er
  niets speelbaars.
- **Eerst het uiterlijk, dan de inhoud.** Afgewezen: effecten en muziek voor een gevecht dat
  daarna verandert, moeten twee keer gemaakt worden.
- **Zes fasen, elk speelbaar opgeleverd** (gekozen). Regels eerst, omdat onderdelen, vijanden
  en contracten daarop bouwen. Na elke fase: tests groen, APK gebouwd en doorgestuurd.

| Fase | Inhoud |
|---|---|
| 1. Gevecht 2.0 | Stabiliteit en stagger, Guard, oplaadwapens, melee, salvo's, modules, booster en FCS, beentypes, moeilijkheidsgraad, automatische beurt |
| 2. Garage 2.0 | Circa 110 onderdelen, twee nieuwe families, verf, bewaarde builds, vergelijken bij kopen en monteren |
| 3. Campagne 2.0 | Drie aktes, circa 30 contracten, doelen, rangen S tot D, gesprekken in het gevecht, nieuwe vijanden, bazen |
| 4. Presentatie | Effecten, overgangen, titelscherm, muziek per situatie, meer geluid, trillen, app-icoon |
| 5. Meta | Drie opslagplekken, roepnaam, codex, handleiding, medailles, statistieken, training, grotere arena |
| 6. Eindcontrole | Een bot die de hele campagne uitspeelt, balans, onafhankelijke controle, documentatie |

Het bouwplan met alle getallen staat in `docs/superpowers/plans/2026-11-14-full-game.md`.

## 5. Fase 1: Gevecht 2.0

Nu kiest de speler per beurt: vuren, boosten, koelen, repareren. Erbij komen:

- **Stabiliteit.** Elke treffer duwt. Kinetische en explosieve wapens duwen hard,
  energiewapens weinig. Is de stabiliteitsbalk vol, dan is de mecha *staggered*: hij kan
  niet ontwijken, krijgt 30% meer schade, verliest opgeladen schoten en heeft in zijn
  volgende beurt minder energie. Dat duurt één volle beurt van de tegenstander. Zo ontstaat
  een ritme: uit balans brengen, dan toeslaan.
- **Guard.** Het zware antwoord op Boost: 40% minder schade en half zoveel duw tot je
  volgende beurt. Boost en Guard gaan niet samen in één beurt.
- **Oplaadwapens.** Eerst laden, een beurt later vuren voor veel schade. Vijanden die laden
  kondigen dat aan, zodat de speler kan reageren: dekken, ontwijken of de vijand uit balans
  brengen, want dan is de lading weg.
- **Melee.** Zwaarden en heipalen: geen munitie, veel schade en duw, maar alleen te gebruiken
  in een beurt waarin je geboost hebt. Zonder benen dus niet.
- **Salvo en burst.** Raketten die elke vijand raken; wapens die drie keer vuren.
- **Modules.** Eén uitrustingsstuk met een knop: koelvloeistof, een schild dat de volgende
  klap opvangt, extra energie, een doelmarkering, reparatie-nanieten, een schokgolf, chaff.
  Beperkt aantal keren per gevecht.
- **Booster en FCS** als nieuwe sloten: de booster bepaalt hoe goed en hoe duur ontwijken
  is; het vuurleidingssysteem geeft trefkans per wapensoort en maakt mikken op ledematen
  makkelijker.
- **Beentypes**: tweebenig, omgekeerd gewricht (beter ontwijken), vierpoot (stabiel,
  schouderwapens raken beter), rupsbanden (kan niet boosten, dekt beter, draagt alles),
  zwevend (snelst, wankel).
- **Moeilijkheidsgraad**: Story, Standard, Veteran. Altijd te wijzigen bij Options. De balans
  is nooit met mensen getest; dit is het vangnet.
- **Auto-beurt**: laat het spel één beurt voor je spelen, handig bij makkelijke gevechten.

## 6. Fase 2: Garage 2.0

- Elf sloten: kop, romp, armen, benen, generator, booster, FCS, module, twee handen, schouder.
- Circa 110 onderdelen. Nieuw beeld alleen voor wat zichtbaar is (frames, benen, wapens).
- **Verf**: twaalf kleurschema's die bij het laden op de sprites worden toegepast. Kost geen
  beeld. Dezelfde techniek geeft arenategenstanders, bazen en elite-vijanden een eigen kleur.
- **Bewaarde builds**: drie plekken.
- **Vergelijken**: bij kopen en monteren staat per waarde het verschil met wat je nu draagt.

## 7. Fase 3: Campagne 2.0

Het bestaande verhaal (drie opdrachtgevers, één keuze, een finale tegen Ashfall) wordt akte I
en II van drie. De bestaande contracten blijven, met dezelfde id's, zodat oude opslag klopt.

- **Akte I, "The Licence".** Introducties; elke opdrachtgever twee contracten; een eerste
  treffen met Ashfall.
- **Akte II, "Sides".** Het exclusieve contract, daarna drie contracten voor de gekozen
  opdrachtgever tegen de twee anderen, elk met een eigen aas en een eigen machine, en de
  oude finale.
- **Akte III, "The Audit".** De oorlog blijkt gefinancierd door één verzekeraar, Meridian
  Mutual, die nu heel Varn opeist en een incassovloot stuurt. De piloot kiest: innen of
  weigeren. Twee slotcontracten, een eindbaas met fases, zes korte epilogen
  (drie opdrachtgevers × twee keuzes).

Verder:

- **Doelen** naast "vernietig alles": een aantal rondes overleven, iets beschermen (een balk
  die leegloopt zolang bepaalde vijanden leven), een leider uitschakelen, een doelwit
  onklaar maken zonder het te vernietigen.
- **Rangen** S tot D per contract, uit rondes, schade en kosten. Beste rang wordt bewaard;
  contracten zijn opnieuw te spelen vanuit een archief.
- **Gesprekken** in het gevecht: korte regels met portret bij het begin, bij een fasewissel
  van een baas en aan het eind.
- **Nieuwe vijanden** met een eigenschap: schilddrone, reparatiedrone, stoorzender,
  drager die drones lost, bomkruiper, scherpschutter, vechter met een zwaard. Bazen wisselen
  van gedrag bij bepaalde schade.

## 8. Fase 4: Presentatie en geluid

- Overgangen tussen schermen, deeltjes, schudden bij zware treffers, rook uit kapotte
  onderdelen, regen en stof per achtergrond, een banner bij het begin van een gevecht en een
  waarschuwing bij een baas, een rangstempel bij de afrekening.
- Briefings en berichten typen zichzelf uit.
- Een geanimeerd titelscherm.
- Muziek: een kleine tracker met bas, akkoorden, melodie en drums, en nummers voor titel,
  hoofdkwartier, briefing, gevecht, baas, arena, overwinning, nederlaag en het slot.
- Meer geluiden; trillen bij treffers (uit te zetten).
- Een eigen app-icoon.

De muziek en geluiden kan de bouwer niet horen. Ze worden wel gecontroleerd op toonsoort en
volume, maar het oor van een mens ontbreekt. Muziek en geluid zijn daarom los uit te zetten.

## 9. Fase 5: Meta

- Drie opslagplekken met een overzicht per plek.
- Een roepnaam voor de piloot.
- **Codex**: vijanden (zodra je ze hebt ontmoet) met zwakke plekken, en achtergrond over Varn.
- **Handleiding**: korte pagina's over het gevecht, hitte, stabiliteit, geld en rangen.
- **Medailles** (circa 30) met een melding als je er een verdient, en **statistieken**.
- **Training**: tien korte oefengevechten die elk één mechaniek leren en iets opleveren.
- **Arena**: een spiegelgevecht tegen je eigen build en een tweede ladder voor na de kampioen.
- Een aftiteling na het slot.

## 10. Fase 6: Eindcontrole

- Een bot speelt elke route van de campagne van begin tot eind, koopt onderweg wat betaalbaar
  is, en meldt waar hij vastloopt of blut raakt.
- Simulaties per contract, arena en bord, op alle moeilijkheidsgraden.
- Een onafhankelijke controle van de code.
- Bijgewerkte documentatie, de APK, en een samenvatting met wat getest is, wat niet, en wat
  het beeld gekost heeft.

## 11. Wat aan de bouwer is

Alle getallen (schade, prijzen, drempels), namen en teksten, de precieze schermindeling, en
de volgorde binnen een fase. Wijkt de bouw af van dit document, dan komt dat in het bouwplan
onder "Changes made while building", zoals bij de eerdere plannen.
