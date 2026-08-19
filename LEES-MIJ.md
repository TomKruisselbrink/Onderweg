# Jut en Juul op vakantie — reisdagboek

Een web-app (PWA) met realtime cloud-synchronisatie via Firebase: jij en Imke
loggen in met Google en zien elkaars momenten live verschijnen. Familie kan
meekijken met een reiscode, zonder zelf een account nodig te hebben.

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
    }
  }
}
```

Klik daarna op "Publish". Zonder dit stappen kan niemand data lezen of
schrijven (de database start standaard volledig afgesloten).

**Wat dit betekent:** iedereen die met een Google-account inlogt én de juiste
reiscode heeft, kan momenten toevoegen/wijzigen. Wie zonder account (anoniem)
meekijkt, kan alleen lezen. Dit is een simpel, laagdrempelig model — prima
voor een privé-reisdagboek met een code die je alleen met vertrouwde mensen
deelt, maar geen bank-niveau beveiliging.

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

**Realtime:** zodra jij of Imke iets toevoegt, verschijnt het (bij internet)
meteen op elkaars scherm en bij iedereen die meekijkt.

**Offline:** werkt nog steeds zonder internet — Firestore heeft een eigen
ingebouwd offline-geheugen. Wat je zonder bereik toevoegt, synchroniseert
automatisch zodra er weer verbinding is.

**Reis verlaten / wisselen:** onder Overzicht → "Reis wisselen" → "Verlaat
deze reis". Handig om te testen, of om aan een andere reis mee te werken.

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
