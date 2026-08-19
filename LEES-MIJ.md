# Onderweg — jullie reisdagboek

Een kleine offline-werkende web-app (PWA) om tijdens de vakantie plekken, eten en
activiteiten vast te leggen — met foto's en een kaart van de route.

## Live zetten op Netlify (5 minuten)

1. Ga naar https://app.netlify.com en log in met je bestaande account.
2. Sleep de hele map `vakantie-app` naar het "Deploy manually" vak op je Netlify
   dashboard (Sites → "Add new site" → "Deploy manually").
3. Netlify geeft je een URL, bijv. `https://onderweg-tomenimke.netlify.app`.
   Je kunt de sitenaam aanpassen via Site settings → Change site name.
4. Open die URL op jouw telefoon én die van je vriendin, en gebruik
   "Zet op beginscherm" (iOS: deelknop → Zet op beginscherm / Android: menu →
   App installeren). De app krijgt dan een eigen icoontje en opent zonder
   browserbalk.

## Of: live zetten op GitHub Pages

Kan ook prima — alle bestanden gebruiken relatieve paden, dus de app werkt
zonder aanpassingen onder een sub-pad zoals GitHub Pages dat gebruikt.

1. Maak op https://github.com een nieuwe repository, bijv. `onderweg`.
   Publiek is prima — de broncode is niet gevoelig, jullie reisdata staat
   alleen lokaal op je eigen telefoon (zie waarschuwing hieronder).
2. Upload de inhoud van de map `vakantie-app` naar die repository (via
   "Add file" → "Upload files" op github.com, of via git als je dat gewend
   bent).
3. Ga naar Settings → Pages. Kies bij "Source" de branch `main` en map `/root`
   (of `/ (root)`). Sla op.
4. Na een minuut of twee staat de app live op
   `https://<jouw-gebruikersnaam>.github.io/onderweg/`.
5. Open die URL op beide telefoons en gebruik weer "Zet op beginscherm".

**Let op bij een publieke repository:** commit nooit een geëxporteerd
`.json`-bestand (met jullie foto's en momenten) naar de repository — dat zou
dan voor iedereen zichtbaar zijn. De app zelf (de code) bevat geen persoonlijke
gegevens, alleen wat jullie er zelf lokaal in invoeren.

## Hoe het werkt

- **Tijdlijn**: elk moment dat je toevoegt (plek, eten, activiteit, slapen,
  onderweg) verschijnt hier als "briefkaart", gegroepeerd per dag.
- **Kaart**: alle momenten met een locatie krijgen een genummerde pin, verbonden
  in de volgorde waarin je ze hebt vastgelegd. Kaarttegels laden alleen met
  internet — eenmaal bekeken blijven ze zichtbaar zonder internet.
- **Nieuw**: kies een type, vul een titel/notitie in, voeg optioneel foto's toe
  (rechtstreeks vanaf de camera of uit je galerij) en tik op "Huidige locatie"
  om de plek vast te leggen. Werkt volledig offline.
- **Overzicht**: korte statistieken, plus de export/import-functie.

## Samen bijhouden (jij + je vriendin)

Jullie gebruiken allebei de app op je eigen telefoon. Zodra er wifi is:

1. Ga naar **Overzicht** → **Exporteer mijn momenten**. Dit downloadt een
   bestandje (bijv. `onderweg-tom-2026-08-20.json`).
2. Stuur dat bestand naar je vriendin (WhatsApp, AirDrop, mail — maakt niet uit).
3. Zij opent het bestand via **Overzicht** → **Importeer bestand** op háár
   telefoon — en andersom bij jou.
4. Beide telefoons hebben dan dezelfde volledige tijdlijn en kaart. Dubbele
   momenten worden automatisch herkend en overgeslagen, dus je kunt dit
   gerust een paar keer per week herhalen.

Er is bewust geen centrale cloud-server achter deze app — alles staat lokaal
op de telefoons, dat maakt hem simpel, gratis te hosten en 100% offline-proof.
De export/import is het "synchronisatie-moment".

## Beperkingen om te weten

- Foto's worden lokaal opgeslagen in de browseropslag van je telefoon. Bij een
  hele lange reis met veel foto's kan dit fors worden — exporteer op tijd als
  back-up (het exportbestand bevat ook de foto's).
- Als je de site-data van je telefoon wist (of "Wis browsergegevens" gebruikt),
  verdwijnt ook de lokale reisdata. Bewaar dus regelmatig een export-bestand
  ergens veilig (bijv. e-mail naar jezelf).
- De kaart heeft internet nodig voor nieuwe tegels; het invoeren van momenten
  en foto's werkt altijd, overal.
