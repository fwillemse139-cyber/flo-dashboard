# Flo's Dashboard — Life Dashboard

Persoonlijk levensdashboard van Floris Willemse. Uitgebouwd vanuit een
eerder standalone HTML-prototype (`C:\Users\fwill\Downloads\flo-dashboard.html`,
zie dat bestand + zijn eigen `CLAUDE.md` voor de geschiedenis) naar een
meerdere-secties-app, met behoud van de "geen build-stap, geen accounts"
aanpak.

## Architectuur

- **Geen backend, geen accounts**: alles draait client-side, data leeft in
  `localStorage` van de browser. Bewuste keuze (7 sept 2026): een versie
  met Supabase (realtime cross-device sync) is uitgeprobeerd en weer
  teruggedraaid — Floris wilde geen wachtwoorden/accounts/setup-gedoe.
  **Consequentie**: wijzigingen op je telefoon verschijnen niet automatisch
  op je laptop en andersom — dit is nu weer, net als het originele
  prototype, één-apparaat-per-keer.
- **Geen build-stap**: native ES modules (`<script type="module">`), geen
  bundler, geen npm install nodig om te draaien — gewoon statisch hosten
  of lokaal openen via een simpele HTTP-server (`file://` werkt niet goed
  met ES modules, gebruik bv. `python -m http.server` in deze map).

## Bestandsstructuur

- `index.html` — shell + nav
- `css/dashboard.css` — styling; overgenomen kleuren/look van het
  `@efferd/dashboard-1` shadcn-blok (donker, neutraal grijs, geen
  amber-accent meer) — zie tokens bovenaan het bestand
- `js/store.js` — kleine localStorage-helper (`loadArray`/`saveArray`/`uid`)
- `js/section-*.js` — één module per sectie (Home, Agenda, Quick Notes,
  Tasks, Productivity System, Connected Tools, Markets)
- `js/marketsCore.js` — gedeelde beursuren-logica (Home en Markets gebruiken 'm allebei)
- `js/migrateLegacy.js` — plak-en-importeer flow voor data uit het oude
  bestand (zie hieronder)

## Pagina's (8 sept 2026: teruggebracht naar 2)

Alleen **Home** en **Productivity System** zijn nog eigen pagina's in de
navigatie. Agenda, Quick Notes, Tasks, Markets en Connected Tools zijn nu
uitsluitend widgets ÓP Home (naast/onder elkaar in een grid) — hun
`section-*.js`-bestanden bestaan nog als losse modules met een `init(rootEl)`
die in een willekeurige container gemonteerd kan worden, maar worden nergens
anders meer aangeroepen dan vanuit `section-home.js`.

- **Home**: het hele dashboard in één oogopslag —
  - **Deadlines**: top 5 openstaande taken uit Productivity System (alle
    categorieën), gesorteerd op datum via een best-effort parser
    (`js/deadlineParser.js`) die de vrije-tekst deadline-velden leest.
    Taken zonder herkenbare datum ("tbd") worden overgeslagen.
  - **Agenda**: eerstvolgende 5 events, tenzij er meer dan 5 binnen 2 dagen
    vallen (dan worden juist alle events binnen die 2 dagen getoond).
    Combineert handmatige events + Apple-agenda-events (zie hieronder).
  - **Tasks**, **Quick Notes**, **Markets**, **Connected Tools**: zelfde
    functionaliteit als voorheen, nu als widget.
- **Productivity System**: het oorspronkelijke kanban-systeem
  (Personal/Academic/Business), inclusief de Notion-sync voor
  Academic-taken (`NOTION_SYNC_DATA`/`mergeNotionSync()` in
  `js/section-productivity.js`)

**Quick Notes → eventueel een Notion-pagina i.p.v. lokale notities**:
door Floris geopperd als mogelijke toekomstige richting, nog niet gebouwd
(vereist een Notion-integratie, vergelijkbare backend-afweging als de
andere twee koppelingen hieronder).

## Externe koppelingen (Apple Agenda + live koersen) — vereisen Vercel-deploy

Beide vereisen een klein, onzichtbaar serverless-tussenstapje (Floris koos
hier bewust voor, na eerst alle backend eruit gehaald te hebben — geen
account/login voor hemzelf, wel 2 losse serverless functions):

- **`api/apple-calendar.js`**: haalt Floris' publieke iCloud-agenda
  (.ics-feed) server-side op (nodig ivm CORS) en geeft events als JSON
  terug. Env var `APPLE_CALENDAR_ICS_URL` moet gezet worden in Vercel —
  **nog niet gebeurd, wacht op de publieke iCloud-link van Floris**
  (Apple Agenda → agenda delen → "Openbare agenda" aan → link kopiëren,
  `webcal://` vervangen door `https://`).
- **`api/quotes.js`**: haalt koersen op via Yahoo Finance's publieke
  (niet-officiële) chart-endpoint, **live en werkend, geen API-key nodig**.
  Eerst geprobeerd met Twelve Data, maar hun gratis tier dekt geen Xetra
  (de 3 Europese UCITS ETF's gaven een "upgrade to Grow/Venture"-fout) —
  Yahoo's endpoint dekt alle 4 tickers (SEC0.DE, IS3N.DE, VUAA.DE, SNDK)
  gratis. Kanttekening: dit is geen officiële/gedocumenteerde API, kan in
  theorie zonder aankondiging wijzigen — bij problemen eerst hier kijken.
- Frontend (`section-markets.js`, `section-agenda.js`) doet al een `fetch("/api/...")`
  met stille fallback — werkt dus al correct lokaal (toont placeholders/alleen
  handmatige data) en pakt de echte data vanzelf op zodra bovenstaande 2
  env vars gezet zijn én het project op Vercel staat.
- **Nog te doen**: project deployen naar Vercel (Floris heeft al een account).
  Simpelste weg: een GitHub-repo aanmaken, pushen, in Vercel importeren.

## Notion-sync (Academic-taken binnen Productivity System)

`NOTION_SYNC_DATA` in `js/section-productivity.js` is de laatst bekende
stand van de 5 "Deadlines & Planning"-pagina's in Floris' Notion
(Dashboard / Year 2 / <vak>). `mergeNotionSync()` draait bij elke keer
dat Productivity System geopend wordt: voegt nieuwe/ontbrekende taken toe
en ververst tekstvelden (title/subject/deadline/note) van bestaande
taken, zonder ooit status/voortgang te overschrijven. Om te verversen:
vraag Claude de 5 Notion-pagina's opnieuw op te halen en de array +
`NOTION_LAST_SYNCED` bij te werken. Geen live browser-koppeling met
Notion — dit blijft een door Claude getriggerde, handmatige sync.

## Oude data overzetten

Omdat dit een ander bestand/andere map is dan het oorspronkelijke
`flo-dashboard.html` in Downloads, komt localStorage daarvan niet
automatisch mee (browsers scopen localStorage per exacte
bestand/origin). Het oude bestand heeft een **"Export data"**-knop
(kopieert de huidige taken als JSON naar het klembord) — plak die JSON
in de import-balk die bovenaan dit dashboard verschijnt totdat je 'm
wegklikt of eenmaal gebruikt.

## Wat Floris hierna eventueel wil

- Deployen naar een gratis statische host (Vercel/Netlify/GitHub Pages)
  zodat de URL ook op andere apparaten werkt — let wel: zonder backend
  blijft elk apparaat zijn EIGEN localStorage-kopie houden, geen sync
- Live markt-koersen alsnog aansluiten — vereist alsnog een minimale
  server-side component (een enkele serverless functie volstaat, hoeft
  geen volledig account-systeem te zijn zoals de afgeschafte Supabase-opzet)
- Visuele restyle verder verfijnen indien gewenst

## Voorkeuren

- Geen emoji's in output/UI-copy.
- Nederlands is prima voor communicatie; code/comments mogen Engels zijn.
- Geen accounts/wachtwoorden/setup-gedoe voor de eindgebruiker — simpelheid
  boven features die daarvoor nodig zijn (expliciet herbevestigd 8 sept 2026
  na het uitproberen en terugdraaien van Supabase).
