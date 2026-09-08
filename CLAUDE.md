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
- **`api/notion.js`** (3 targets):
  - `?target=kanban`: Productivity System (Personal/Academic/Business).
    Slaat het HELE `state.tasks`-array op als JSON in één code-block op
    de Notion-pagina **"Kanban Data"** (kind van "Tasks", erft dus
    automatisch dezelfde Connections-toegang — geen aparte deel-stap
    nodig). `GET` leest de blob, `PUT` overschrijft 'm volledig.
    `js/section-productivity.js` blijft verder ongewijzigd (zelfde
    taak-model, zelfde `NOTION_SYNC_DATA`/`mergeNotionSync()`); alleen
    `persist()` doet nu ook een fire-and-forget `PUT` naar Notion naast
    de localStorage-save, en `init()` haalt bij het laden Notion's versie
    op als bron van waarheid — **dit is de daadwerkelijke cross-device
    sync voor Productivity System** (localStorage blijft alleen als
    instant-load cache/fallback). Eerste-keer-bootstrap: als Notion leeg
    is maar het apparaat al lokale taken heeft, worden die omhoog
    geduwd i.p.v. overschreven met niks.
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

## Health en Suerte (8 sept 2026, nieuwe pagina's)

Nav is nu **Home / Productivity System / Health / Suerte**.

- **`js/section-health.js`** (`?target=health` in `api/notion.js`, zelfde
  JSON-blob-patroon als kanban): dagelijkse check-in (mood/energie 1-10/
  productiviteit 1-10/wektijd/notitie, één entry per dag) + werksessie-
  tracking (start/stop-knop, telt minuten op bij de dag van vandaag) +
  analytics (week-/maandgemiddelden, piekdag, een simpele inline-SVG
  trendlijn over de laatste 14 dagen voor energie/productiviteit, plus
  staafdiagrammen — via `js/barChart.js` — voor gem. energie/
  productiviteit per maand (vaste 1-10-schaal, laatste 6 mnd, lege
  maanden overgeslagen) en werktijd per maand in uren).
- **`js/barChart.js`**: kleine gedeelde staafdiagram-renderer
  (`renderBars(rows, valueKey, labelKey, opts)`), gebruikt door zowel
  Suerte (financieel) als Health — voorkomt dat dezelfde bar-HTML op
  meerdere plekken gedupliceerd wordt.
- **`js/section-suerte.js`** (business-hub):
  - **Financial** (`?target=financial`): bank-statement-PDF's uploaden
    (meerdere bestanden tegelijk, van willekeurig welk jaar door elkaar)
    → client-side uitgelezen met pdf.js (dynamisch geladen vanaf cdnjs,
    alleen bij gebruik) → regel-voor-regel gematcht op een datum+bedrag-
    patroon → datum genormaliseerd naar ISO (`toIsoDate()`) zodat
    transacties uit verschillende jaren/exports op dezelfde manier
    gegroepeerd kunnen worden → automatische categorie-gok op basis van
    trefwoorden (boodschappen/vervoer/abonnementen/etc., anders
    "Overig"). Dubbele transacties (zelfde datum+omschrijving+bedrag,
    `txFingerprint()`) worden bij upload automatisch overgeslagen, dus
    dezelfde periode nog eens uploaden of overlappende jaaroverzichten
    geeft geen dubbele boekingen. **Ongetest tegen een echt bank-PDF-
    bestand** — dit is best-effort tekstherkenning, de kolom-uitlijning
    van een PDF kan onvoorspelbaar zijn. Vraag Floris om een echt bestand
    te proberen en meld wat er misgaat, dan verfijn ik de regex.
    Handmatig een transactie toevoegen werkt sowieso altijd als fallback.
    Analytics (allemaal staafdiagrammen via het gedeelde `js/barChart.js`):
    grootste uitgavecategorieën/inkomstenbronnen all-time, uitgaven per
    jaar, uitgaven per maand (laatste 12 mnd), grootste categorieën
    afgelopen jaar, en een "Mogelijk te besparen"-lijst
    (`recurringCandidates()` — omschrijvingen die in 3+ losse maanden
    terugkomen, met geschat maand-/jaarbedrag; typisch abonnementen of
    terugkerende kosten die je bent vergeten).
  - **Clients** (`?target=suerte`): simpele naam/project/status-tracker
    (Actief/On hold/Afgerond).
- **Niet gebouwd, bewust**: hoeveel Claude-gebruik (quota/reset-tijd) er
  nog is — daar bestaat geen door mij uitleesbare API/databron voor.

## Identity en Home-samenvattingen (8 sept 2026, nieuwe pagina + Home-uitbreiding)

Nav is nu **Home / Productivity System / Health / Suerte / Identity**.

- **`js/section-identity.js`** (`?target=identity` in `api/notion.js`, zelfde
  JSON-blob-patroon): identity-statement ("Wie wil Floris zijn?", vrije
  tekst), eigenschappen-lijst met per eigenschap een bewijs-log (datum +
  notitie, bv. "3 dagen achter elkaar studie gedaan"), en een doelenlijst
  in drie kolommen (Short/Mid/Long term, elk met eigen add-knop en
  done-toggle). Short en Long term zijn geseed met Floris' eigen lijst
  (`seedGoals()` in dat bestand — alleen bij een lege state, dus een
  bestaande Notion-blob overschrijft dit nooit); Mid term is bewust leeg
  begonnen ("sommige zijn misschien mid term" — geen vooraf-indeling).
- **Home-samenvattingskaarten**: naast de bestaande widgets (Deadlines/
  Agenda/Tasks/Markets/Connected Tools) staan er nu 4 klikbare kaarten
  onderaan Home — Productivity System (open taken per categorie), Health
  (vandaag gelogd? + weekgemiddelden), Suerte (uitgaven/inkomsten deze
  maand + actieve clients) en Identity (doelen behaald + aantal
  eigenschappen). Elke kaart leest rechtstreeks uit dezelfde
  localStorage-keys als de eigen pagina (`flo.kanban_tasks`,
  `flo.health_log`, `flo.suerte_financial`/`flo.suerte_clients`,
  `flo.identity` — geen aparte fetch, dus altijd in sync met wat er lokaal
  al geladen is) en klikken erop navigeert naar die pagina
  (`navigateTo`-callback, doorgegeven van `js/main.js` naar
  `section-home.js`'s `init(rootEl, navigateTo)`).

## Voorkeuren

- Geen emoji's in output/UI-copy.
- Nederlands is prima voor communicatie; code/comments mogen Engels zijn.
- Geen accounts/wachtwoorden/setup-gedoe voor de eindgebruiker — simpelheid
  boven features die daarvoor nodig zijn (expliciet herbevestigd 8 sept 2026
  na het uitproberen en terugdraaien van Supabase).
