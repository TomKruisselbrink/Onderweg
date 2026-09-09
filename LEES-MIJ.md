# Jut en Juul op vakantie — reisdagboek

Een web-app (PWA) met realtime cloud-synchronisatie via Firebase: jij en Imke
loggen in met Google en zien elkaars momenten live verschijnen. Familie kan
meekijken met een reiscode, zonder zelf een account nodig te hebben.

## Belangrijk: bestandsnamen bevatten voortaan een versienummer

Om een hardnekkig cache-probleem bij je hostingprovider te omzeilen, heten de
JavaScript- en CSS-bestanden voortaan `app-vXX.js` en `style-vXX.css` (met
een oplopend nummer) in plaats van steeds dezelfde naam. Zo kan er nooit een
verouderde versie op die naam blijven "plakken" bij Netlify/GitHub. Bij elke
update van mij krijg je een nieuw versienummer en verandert dus ook de
bestandsnaam — dat is bedoeld gedrag, geen fout.

## Voor het eerste gebruik: twee dingen instellen in Firebase

**1. Beveiligingsregels plakken**

Ga in de Firebase Console naar Firestore Database → tabblad "Rules", en
vervang de inhoud door:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripCode} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.auth.token.firebase.sign_in_provider == 'google.com';
      allow update: if request.auth != null
        && request.auth.token.firebase.sign_in_provider == 'google.com';

      match /entries/{entryId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null
          && request.auth.token.firebase.sign_in_provider == 'google.com';
      }

      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow delete: if request.auth != null
          && (resource.data.authorUid == request.auth.uid
              || request.auth.token.firebase.sign_in_provider == 'google.com');
      }

      match /followers/{followerId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == followerId;
      }
    }
  }
}
```

Klik daarna op "Publish". Zonder dit stappen kan niemand data lezen of
schrijven (de database start standaard volledig afgesloten).

**Wat dit betekent:** iedereen die met een Google-account inlogt én de juiste
reiscode heeft, kan momenten toevoegen/wijzigen. Wie zonder account (anoniem)
meekijkt, kan alleen lezen — behalve reacties: die mag iedereen met de code
plaatsen (ook volgers), en verwijderen mag je alleen je eigen reactie, of als
Tom/Imke (die kunnen alles opruimen). Dit is een simpel, laagdrempelig model —
prima voor een privé-reisdagboek met een code die je alleen met vertrouwde
mensen deelt, maar geen bank-niveau beveiliging.

**2. Je gedeployde domein toestaan**

Ga naar Authentication → Settings → tabblad "Authorized domains" → "Add
domain", en voeg het domein toe waar de app straks op komt te staan (bijv.
`jouwsite.netlify.app` of `jouwnaam.github.io`). Zonder dit stap werkt
inloggen met Google niet zodra de app live staat (het werkt dan alleen op
`localhost`).

## Live zetten

Zelfde als eerder: sleep de hele map naar Netlify ("Deploy manually"), of zet
'm op GitHub Pages. Alle bestanden gebruiken relatieve paden, dus dat werkt
zonder aanpassingen.

## Hoe het werkt

**Eerste keer openen:** een keuzescherm — "Ik ga op vakantie" (inloggen met
Google, dan een nieuwe reis starten óf met een code bij een bestaande reis
komen) of "Vakantiegangers volgen" (alleen een reiscode invullen, geen
account nodig, alleen lezen).

**Reiscode delen:** te vinden onder Overzicht → "Reisgenoten uitnodigen".
Deel 'm met Imke zodat ze ook kan bewerken, of met familie om read-only mee
te laten kijken.

**Reageren op dagen:** iedereen die de reiscode heeft — ook familie die
alleen meekijkt — kan onderaan elke dag in de Tijdlijn een reactie
achterlaten, en ook op elkaars reactie reageren (via "Reageer" onder een
reactie). Handig voor "wat leuk zeg!" of vragen vanuit huis. Volgers vullen
bij het meekijken hun naam in, zodat duidelijk is wie wat zegt.

**Wie volgt jullie:** onder Overzicht zien Tom en Imke een lijstje met de
namen van iedereen die is gaan meekijken met de reiscode.

**Statistieken aanklikken:** een tegel als "📍 Plekken bezocht" of "Foto's"
aantikken op Dashboard of Overzicht opent een lijst (of foto-overzicht) van
alles wat in die categorie valt.

**Eigen categorie toevoegen:** bij Plek/Activiteit kun je via "➕ Eigen" zelf
een soort plek intypen (bijv. "Strand" of "Wijngaard") — die wordt onthouden
voor de volgende keer.

**Realtime:** zodra jij of Imke iets toevoegt, verschijnt het (bij internet)
meteen op elkaars scherm en bij iedereen die meekijkt.

**Internet nodig:** de app is gebouwd voor gebruik met een actieve
internetverbinding (WiFi of mobiele data). We hadden eerder een laag
toegevoegd om ook zonder bereik te kunnen werken, maar die gaf in de praktijk
vooral update-problemen (oude versies die op toestellen bleven "plakken").
Omdat er bij gebruik altijd internet is, hebben we die laag verwijderd —
de app is nu simpeler en werkt betrouwbaarder.

**Reis verlaten / wisselen:** onder Overzicht → "Reis wisselen" → "Verlaat
deze reis". Handig om te testen, of om aan een andere reis mee te werken.

**Vandaag-sectie:** bovenaan het Dashboard staat een "☀️ Vandaag"-kaartje met
de belangrijkste info van de huidige dag (locatie, afstand, aantal plekken,
foto's, hoogtepunt), gevolgd door alle momenten van vandaag.

**Fotoalbum:** alle foto's van de reis op één pagina, gegroepeerd per dag —
bereikbaar via "📷 Fotoalbum" onderaan het Dashboard of de "Foto's"-tegel bij
Overzicht. Tik op een foto voor een volledig-scherm weergave met swipen.

**Familie-modus:** volgers zien bovenaan het Dashboard een groene kaart met
wie onderweg is, de laatste locatie, het dagnummer en hoe lang geleden het
laatste moment is toegevoegd, plus snelkoppelingen naar Route/Album/Tijdlijn.

**Reis afspelen (tijdmachine):** op de Kaart-pagina staat nu een knop "🕰️ Reis
afspelen". Daarmee open je een schuifbalk waarmee je door de dagen van de
reis kunt bewegen — de kaart toont dan alleen de route en pinnen tot dat
punt, met de meest recente plek duidelijk gemarkeerd (een pulserende rand).
Met ▶ speelt de route zichzelf automatisch af, moment voor moment, met een
kort tekstballonnetje bij elk bereikt punt. De gewone kaart (met de hele
route in één keer) blijft gewoon het standaardgedrag — dit is een extra optie
die je zelf aanzet.

**Reisdagboek:** via "📖 Reisdagboek" onderaan het Dashboard genereert de app
automatisch een leesbaar reisverslag uit alle bestaande momenten — per dag
een hoofdstuk (met "Van → Naar" als titel bij een verplaatsing), gevolgd door
de momenten van die dag met foto's, beoordelingen en hoogtepunten, en een
kort dagoverzicht (kilometers, aantal plekken, foto's, hoogtepunten)
onderaan. Er wordt geen tekst verzonnen — alleen wat al is vastgelegd, netjes
opgemaakt. Met "🖨️ Bewaar als PDF" open je het printvenster van je
telefoon/browser, waarmee je het reisdagboek als PDF kunt opslaan of
printen (dit gebruikt de ingebouwde print-functie van je toestel, geen
aparte dienst).

**Weer bij een moment:** bij "Nieuw moment" kun je optioneel aangeven hoe het
weer was (☀️ Zonnig, ⛅ Bewolkt, 🌧️ Regen, ⛈️ Onweer, ❄️ Sneeuw, 💨 Winderig,
🌫️ Mist). Dit verschijnt als badge op het moment, en de unieke weertypes van
een hele dag staan ook samengevat bij de dag-koptekst in de Tijdlijn, de
"Vandaag"-sectie op het Dashboard, en in het Reisdagboek.

**Volgorde:** Tijdlijn en Fotoalbum tonen nu de nieuwste dag bovenaan (hoe
verder naar beneden, hoe ouder). Het Reisdagboek blijft bewust chronologisch
(dag 1 eerst), omdat je dat als een verhaal van begin tot eind leest.

**Reageren op vandaag, vanaf het Dashboard:** onder de "Vandaag"-sectie staat
nu een opvallend goudkleurig kader met "💬 Praat mee over vandaag!" — familie
hoeft niet meer naar de Tijdlijn te navigeren om te kunnen reageren op de
huidige dag.

**Zelfherstellende foutmelding:** als er ooit iets misgaat bij het laden
(bijv. bij iemand die nog een oude, vastzittende versie van de app heeft),
verschijnt de rode foutbalk nu met een knop "🔄 Probeer te herstellen". Die
knop ruimt zelf eventuele oude service workers en caches op en herlaadt de
pagina — zonder dat iemand naar telefooninstellingen hoeft te gaan. Dit werkt
zelfs als de rest van de app niet kan laden, want de knop zit in een apart,
altijd-werkend stukje code vóór de rest van de app. **Let op:** dit helpt
iedereen die vanaf nu een probleem tegenkomt, maar iemand die al vóór deze
update vastzat op een hele oude, gecachete pagina moet nog één keer de
handmatige stappen doorlopen (zie hierboven) — daarna nooit meer.

**Familie op de hoogte houden:** omdat echte pushmeldingen vanuit de app
niet mogelijk zijn zonder een betaalde Firebase-uitbreiding, kun je in plaats
daarvan met één tik een kant-en-klaar berichtje delen naar de groepsapp
(WhatsApp, Berichten, mail — wat je zelf kiest in het native deelmenu). Dit
gebeurt op twee plekken: automatisch aangeboden vlak na het opslaan van een
nieuw moment ("📤 Familie laten weten"), en via een vaste knop "📤 Stuur
statusupdate" onder Overzicht voor elk gewenst moment. Het bericht bevat
automatisch een korte samenvatting (van vandaag, of het laatste moment) plus
een link naar de app.

## Beperkingen om te weten

- Foto's zijn beperkt tot 3 per moment en worden sterk gecomprimeerd. Dit is
  bewust: elk moment is één document in de database met een limiet van 1MB,
  en dit houdt alles ruim daarbinnen zonder een aparte (betaalde) opslag-
  dienst nodig te hebben.
- De oude export/importfunctie is vervangen door de realtime-synchronisatie
  en is verwijderd — dat is nu niet meer nodig.
- Firebase's gratis laag (Spark) is ruim voldoende voor dit gebruik; bij heel
  intensief gebruik door veel mensen tegelijk zou je ooit tegen een limiet
  kunnen lopen, maar voor een familie-reisdagboek is dat zeer onwaarschijnlijk.
