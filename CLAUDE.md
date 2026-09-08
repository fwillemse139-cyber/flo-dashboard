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
- `js/section-*.js` — één module per sectie (Home, Agenda, Tasks,
  Productivity System, Connected Tools, Markets)
- `js/marketsCore.js` — gedeelde beursuren-logica (Home en Markets gebruiken 'm allebei)

## Pagina's (8 sept 2026: teruggebracht naar 2)

Alleen **Home** en **Productivity System** zijn nog eigen pagina's in de
navigatie. Agenda, Tasks, Markets en Connected Tools zijn nu uitsluitend
widgets ÓP Home (naast/onder elkaar in een grid) — hun `section-*.js`-
bestanden bestaan nog als losse modules met een `init(rootEl)` die in een
willekeurige container gemonteerd kan worden, maar worden nergens anders
meer aangeroepen dan vanuit `section-home.js`.

- **Home**: het hele dashboard in één oogopslag —
  - **Deadlines**: top 5 openstaande taken uit Productivity System (alle
    categorieën), gesorteerd op datum via een best-effort parser
    (`js/deadlineParser.js`) die de vrije-tekst deadline-velden leest.
    Taken zonder herkenbare datum ("tbd") worden overgeslagen.
  - **Agenda**: eerstvolgende 5 events, tenzij er meer dan 5 binnen 2 dagen
    vallen (dan worden juist alle events binnen die 2 dagen getoond).
    Combineert handmatige events + Apple-agenda-events (zie hieronder).
  - **Tasks**, **Markets**, **Connected Tools**: zelfde functionaliteit als
    voorheen, nu als widget.
- **Productivity System**: het oorspronkelijke kanban-systeem
  (Personal/Academic/Business), inclusief de Notion-sync voor
  Academic-taken (`NOTION_SYNC_DATA`/`mergeNotionSync()` in
  `js/section-productivity.js`)

**Quick Notes is verwijderd** (8 sept 2026, op verzoek van Floris) — geen
sectie, geen widget, geen Notion-koppeling meer. `js/section-notes.js` is
weg; `api/notion.js` heeft alleen nog `?target=tasks` en `?target=agenda`.

## Externe koppelingen — gedeployed op Vercel

Project staat live op `https://flo-dashboard-fwillemse139-cybers-projects.vercel.app`
(GitHub: fwillemse139-cyber/flo-dashboard, auto-deploy bij push naar `main`).

**`vercel.json`**: zet `Cache-Control: no-cache, no-store, must-revalidate`
op alle routes. Nodig omdat de bestandsnamen geen hash hebben (geen
build-stap) — zonder dit kan een apparaat een oude JS/CSS-versie
cachen na een nieuwe deploy, wat aanvoelde als "het synct niet tussen
mijn telefoon en laptop" terwijl het gewoon verouderde client-code was.

- **`api/quotes.js`**: haalt koersen op via Yahoo Finance's publieke
  (niet-officiële) chart-endpoint, **live en werkend, geen API-key nodig**.
  Eerst geprobeerd met Twelve Data, maar hun gratis tier dekt geen Xetra
  (de 3 Europese UCITS ETF's gaven een "upgrade to Grow/Venture"-fout) —
  Yahoo's endpoint dekt alle 4 tickers (SEC0.DE, IS3N.DE, VUAA.DE, SNDK)
  gratis. Kanttekening: dit is geen officiële/gedocumenteerde API, kan in
  theorie zonder aankondiging wijzigen — bij problemen eerst hier kijken.
- **`api/notion.js`** (2 targets):
  - `?target=tasks`: lezen/schrijven in de "Tasks"-Notion-pagina onder
    Personal. **Live en werkend.** Verwijderen op het dashboard (×) is
    bewust GEEN Notion-delete — de taak blijft in Notion staan, wordt
    alleen lokaal verborgen (`flo.hidden_notion_task_ids` in
    `js/section-tasks.js`) zodat 'm ook niet terugkomt bij de volgende
    fetch. Aanvinken (done) sync't wél gewoon naar Notion's checkbox.
  - `?target=agenda` (read-only): leest Floris' Notion **"Daily Tasks"**-
    database (onder Productivity) — items met een ingevulde "Geplande tijd"
    worden agenda-events, samengevoegd met de handmatige agenda-items.
    Vervangt de eerder overwogen Apple Agenda-koppeling: die database
    sync't al naar Apple Agenda als geabonneerde kalender, en een
    geabonneerde (niet-zelf-beheerde) kalender kan in Apple niet alsnog
    "openbaar" gemaakt worden — dus rechtstreeks naar de Notion-bron.
    (Floris' "Notion agenda" bleek de losse Notion Calendar-app te zijn,
    calendar.notion.so — die heeft geen API, dus die kant is een dead end;
    "Daily Tasks" blijft de enige haalbare Notion-route voor de agenda.)
  - Env var `NOTION_TOKEN` staat in Vercel; de integratie ("Flo's
    Dashboard") moet zijn toegevoegd aan de "Tasks"-pagina én de
    "Daily Tasks"-database (Notion → "..." menu → Connections, op elk
    apart) — status per stuk kan verschillen, check bij problemen welke
    van de twee nog niet gedeeld is.
- Frontend (`section-markets.js`, `section-agenda.js`, `section-tasks.js`)
  doet `fetch("/api/...")` met stille fallback — werkt dus ook correct
  lokaal zonder backend (localStorage/placeholders).

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
