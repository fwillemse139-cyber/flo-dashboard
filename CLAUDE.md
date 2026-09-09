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

## Pagina's

Nav: **Home / Productivity System / Health / Finance / Identity**. Van de
widgets die oorspronkelijk (8 sept 2026) hun eigen nav-item hadden zijn
Tasks, Werksessie, Markets en Connected Tools sindsdien uitsluitend
widgets ÓP Home (naast/onder elkaar in een grid) — hun `section-*.js`-
bestanden bestaan als losse modules met een `init(rootEl)` die in een
willekeurige container gemonteerd kan worden; Werksessie wordt zowel op
Home als op Health gemount (zie hieronder).

- **Home**: het hele dashboard in één oogopslag —
  - **Deadlines**: top 5 openstaande taken uit Productivity System (alle
    categorieën), gesorteerd op datum via een best-effort parser
    (`js/deadlineParser.js`) die de vrije-tekst deadline-velden leest.
    Taken zonder herkenbare datum ("tbd") worden overgeslagen.
  - **Health check-in** (9 sept 2026, op de plek waar eerst Agenda stond):
    `js/section-health-quicklog.js` — compacte versie van Health's
    dagelijkse check-in (alleen mood/energie/productiviteit, geen
    wektijd/notitie/analytics) zodat je 'm in een paar seconden vanaf Home
    kan invullen zonder naar Health te navigeren. Zelfstandig van
    `section-health.js` (zelfde patroon als Werksessie) maar deelt
    dezelfde `flo.health_log`-storage/`?target=health`-Notion-sync, dus
    een save hier telt gewoon mee in Health's eigen logboek/analytics.
    **Agenda is losgekoppeld van Home** om plek te maken (op verzoek van
    Floris) — `js/section-agenda.js` en `?target=agenda` in
    `api/notion.js` bestaan nog gewoon (inclusief eventuele al
    opgeslagen handmatige events in `flo.agenda_events`), maar worden
    nergens meer gemount. Makkelijk terug te zetten mocht Floris 'm
    alsnog ergens willen.
  - **Tasks**, **Werksessie**, **Markets**, **Connected Tools**: zelfde
    functionaliteit als op hun eigen pagina, nu als widget (Werksessie
    staat bewust naast Tasks, zodat je 'm direct kan starten/stoppen
    zonder naar Health te hoeven navigeren).
  - **Samenvattingskaarten**: klikbare kaarten voor Productivity System/
    Health/Finance/Identity, zie de sectie hieronder.
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
  (de Europese UCITS ETF's gaven een "upgrade to Grow/Venture"-fout) —
  Yahoo's endpoint dekt alle instrumenten gratis. Kanttekening: dit is
  geen officiële/gedocumenteerde API, kan in theorie zonder aankondiging
  wijzigen — bij problemen eerst hier kijken.
  - **Instrumenten (9 sept 2026, IS3N vervangen)**: SEC0.DE, SNDK, VUAA.DE
    (ongewijzigd) + SK Hynix (`000660.KS`), Alphabet (`GOOGL`), ASML
    (`ASML.AS`), Mastercard (`MA`), Visa (`V`) — alle 5 nieuwe rechtstreeks
    tegen Yahoo's chart-endpoint geverifieerd voor het pushen. Ticker-keys
    in `SYMBOL_MAP` (dit bestand) en `TICKERS` in `js/marketsCore.js`
    moeten exact hetzelfde zijn — dat is waar `section-markets.js` de
    quote (uit `/api/quotes`) aan de display-naam (uit `marketsCore.js`)
    koppelt.
  - **Eigen valuta per instrument, gerichte omrekening waar gevraagd
    (9 sept 2026)**: eerst geprobeerd om alles zowel in EUR als USD te
    tonen (omgerekend via 2 Yahoo FX-tickers) — Floris vond dat
    onjuist/rommelig aanvoelen en wilde gewoon de eigen, echte valuta per
    instrument (`formatPrice()` in `js/section-markets.js`, `€`/`$`/`₩`
    per valuta). SK Hynix stond dus eerst in KRW, maar Floris wilde die
    toch liever in dollar — `SYMBOL_MAP.HYNIX.convertToUsd: true` in
    `api/quotes.js` rekent 'm om via een live USD/KRW-koers
    (`FX_TICKERS`/`usdRates`, zelfde "hoeveel van deze valuta is 1 USD
    waard"-patroon als de eerder teruggedraaide EUR+USD-poging, nu alleen
    ingezet waar het expliciet gevraagd is). De ETF's + ASML blijven EUR
    (Xetra/Euronext), de losse Amerikaanse aandelen blijven USD.
    Percentage-verandering wordt nooit omgerekend — die is
    valuta-onafhankelijk.
  - **Percentage + laatst bijgewerkt (9 sept 2026)**: `pct_change` is
    Yahoo's `regularMarketChangePercent` — dat is altijd t.o.v. de vorige
    sluitingskoers, nooit intraday-vanaf-nu; dit staat nu als "% = sinds
    vorige sluiting" boven de tickerlijst i.p.v. per rij herhaald (te
    druk anders). De response heeft ook een top-level `updated_at`
    (moment van de server-fetch) die als "Koersen bijgewerkt om HH:MM"
    getoond wordt — let op: door de `s-maxage=300`-cache kan de
    daadwerkelijke koers zelf tot 5 min ouder zijn dan dit tijdstip.
  - **Sorteren op prestatie + FLIP-animatie (9 sept 2026)**: de
    tickerlijst staat altijd gesorteerd op `pct_change` (best presterende
    bovenaan, slechtste onderaan; tickers zonder koers blijven onderaan
    in vaste volgorde). `js/section-markets.js` splitst het renderen in
    losse stukjes (`#mk-exchanges` elke seconde voor de countdown-
    timers, `#mk-tickers` alleen bij nieuwe data van `/api/quotes`) zodat
    een herordening niet steeds de hele widget opnieuw opbouwt. Bij een
    herordening wordt de FLIP-techniek gebruikt (positie vóór de
    herordening opslaan via `getBoundingClientRect()`, nieuwe volgorde
    renderen, dan van oude naar nieuwe positie laten "glijden" met een
    CSS-transform-transitie) i.p.v. abrupt te springen.
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

## Health en Finance (8 sept 2026, nieuwe pagina's)

Nav is nu **Home / Productivity System / Health / Finance / Identity**
(de pagina heette eerst "Suerte", het bestand heet intern nog steeds
`js/section-suerte.js` en de Notion-financial-target nog `?target=financial`
— alleen het zichtbare kopje/nav-label is hernoemd naar "Finance", 8 sept
2026, nadat de Clients-tracker eruit ging).

- **`js/section-health.js`** (`?target=health` in `api/notion.js`, zelfde
  JSON-blob-patroon als kanban): dagelijkse check-in (mood/energie 1-10/
  productiviteit 1-10/wektijd/notitie, één entry per dag) + analytics
  (week-/maandgemiddelden, piekdag, een simpele inline-SVG trendlijn over
  de laatste 14 dagen voor energie/productiviteit, plus staafdiagrammen —
  via `js/barChart.js` — voor gem. energie/productiviteit per maand
  (vaste 1-10-schaal, laatste 6 mnd, lege maanden overgeslagen) en
  werktijd per maand in uren). De werksessie-tracking zelf zit niet meer
  in dit bestand, zie `js/section-worksession.js` hieronder.
  - **Logboek (9 sept 2026)**: tabel met alle gelogde dagen cijfermatig
    (datum/mood/energie/productiviteit/opgestaan/werktijd/notitie,
    nieuwste eerst, met verwijderknop per rij) — staat direct onder het
    invulformulier, niet onderaan de pagina, zodat je 'm ziet zonder
    eerst langs alle grafieken te scrollen (Floris zag 'm eerst niet).
    CSS: `.log-table`/`.table-scroll` in `css/dashboard.css`.
  - **Zichtbare save-bevestiging (9 sept 2026)**: Floris meldde dat
    Opslaan "niks deed" — het sloeg in werkelijkheid gewoon op (bevestigd
    via een live PUT-test + reload), maar er was geen enkele visuele
    bevestiging, dus het vóelde kapot. Er staat nu een blijvende
    "Opgeslagen om HH:MM"-tekst naast de knop (`saveStatus`-var, geen
    fade-out toast — moet zichtbaar blijven ook als je later terugkijkt).
- **`js/section-worksession.js`**: losse, zelfstandige start/stop-
  werksessie-widget. Gemount op **twee plekken**: op Home naast Tasks
  (zodat je 'm meteen kan aanklikken zonder eerst naar Health te
  navigeren — op verzoek van Floris, 8 sept 2026) én op de
  Health-pagina zelf (met `{ showLog: true }` — zie hieronder). Beide
  mounts draaien onafhankelijk van elkaar (eigen 30s-tick voor de live
  sessieduur), maar delen dezelfde `localStorage`-sleutels dus altijd in
  sync.
  - **Sessielogboek (9 sept 2026)**: elke start→stop wordt nu ALS LOSSE
    SESSIE gelogd in `flo.work_sessions` (`?target=worksessions` in
    `api/notion.js`, nieuwe Notion-pagina "Work Sessions Data") — met
    starttijd/eindtijd/duur, niet alleen een totaal. Een stop-actie telt
    daarnaast nog steeds op bij het dagtotaal in Health's eigen
    `flo.health_log`/`?target=health` (`workMinutes`), zodat Health's
    bestaande week-/maand-analytics gewoon blijven werken — je kan een
    dag dus in meerdere stukken loggen (start, pauze, weer start) zonder
    dat iets overschreven wordt, alles telt op. Op Health (`showLog:
    true`) verschijnt onder de start/stop-knop een overzicht per dag
    (nieuwste eerst) met elke losse sessie + een verwijderknop; die
    houdt het dagtotaal in `flo.health_log` consistent bij het
    verwijderen van een sessie. Op Home (`showLog` niet gezet) blijft de
    widget compact — alleen start/stop + dagtotaal, geen logboek.
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
    geeft geen dubbele boekingen. Handmatig een transactie toevoegen werkt
    sowieso altijd als fallback.
    - **Parser herzien (8 sept 2026)**: eerste versie herkende alleen
      Engelse maandnamen + punt-decimalen, wat waarschijnlijk de reden was
      dat Florens eigen bank-PDF's niks opleverden. `DATE_PATTERN`
      herkent nu ook Nederlandse maandnamen (`mrt`/`mei`/`okt`/etc.) en
      numerieke datums (`24-01-2024`/`24/01/2024`); `parseAmount()`
      herkent zowel komma- als punt-decimalen (kijkt welke van de twee
      het laatst in de string staat). Als een bestand nul transacties
      oplevert, toont de upload-kaart nu de eerste ~25 ruwe tekstregels
      die pdf.js eruit haalde (`uploadDebug`) — gebruik dat om het patroon
      verder te verfijnen i.p.v. blind te gokken.
    Analytics (allemaal staafdiagrammen via het gedeelde `js/barChart.js`):
    grootste uitgavecategorieën/inkomstenbronnen all-time, uitgaven per
    jaar, uitgaven per maand (laatste 12 mnd), grootste categorieën
    afgelopen jaar, en een "Mogelijk te besparen"-lijst
    (`recurringCandidates()` — omschrijvingen die in 3+ losse maanden
    terugkomen, met geschat maand-/jaarbedrag; typisch abonnementen of
    terugkerende kosten die je bent vergeten).
  - **Clients-tracker is verwijderd** (8 sept 2026, op verzoek van
    Floris) — de losse naam/project/status-lijst en de bijbehorende
    `?target=suerte`-Notion-blob ("Suerte Clients Data") worden niet meer
    gebruikt/aangesproken. De Notion-pagina zelf bestaat nog gewoon in
    Notion, maar `BLOB_PAGE_IDS` in `api/notion.js` verwijst er niet meer
    naar.
- **Niet gebouwd, bewust**: hoeveel Claude-gebruik (quota/reset-tijd) er
  nog is — daar bestaat geen door mij uitleesbare API/databron voor.

## Identity en Home-samenvattingen (8 sept 2026, nieuwe pagina + Home-uitbreiding)

Nav is nu **Home / Productivity System / Health / Finance / Identity**.

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
  Agenda/Tasks/Werksessie/Markets/Connected Tools) staan er nu 4 klikbare
  kaarten onderaan Home — Productivity System (open taken per categorie),
  Health (vandaag gelogd? + weekgemiddelden), Finance (uitgaven/inkomsten
  deze maand) en Identity (doelen behaald + aantal eigenschappen). Elke
  kaart leest rechtstreeks uit dezelfde localStorage-keys als de eigen
  pagina (`flo.kanban_tasks`, `flo.health_log`, `flo.suerte_financial`,
  `flo.identity` — geen aparte fetch, dus altijd in sync met wat er lokaal
  al geladen is) en klikken erop navigeert naar die pagina
  (`navigateTo`-callback, doorgegeven van `js/main.js` naar
  `section-home.js`'s `init(rootEl, navigateTo)`).

## AI-coach: uitgeprobeerd en weer teruggedraaid (8 sept 2026)

Er is kort een AI-coach gebouwd (patroon-detectie op Health + "deep
research"/dagelijkse check-ins op Identity, via een losse Anthropic
API-key in `api/coach.js` + `js/coach.js`) — Floris koos dit eerst
expliciet boven een gratis regelgebaseerd alternatief, maar wilde
daarna alsnog **geen extra kosten** ("ik wil geen extra kosten dus laat
dat"). Volledig verwijderd: `api/coach.js`, `js/coach.js`, de
Berichten-kaarten op Health/Identity, de Coach-kaart op Home, de
`coach`-target uit `BLOB_PAGE_IDS` in `api/notion.js`, en de
`.chat-*`-CSS. De lege "Coach Data"-Notion-pagina staat nog ongebruikt
in Notion (zelfde soort orphan als "Suerte Clients Data").
**Als dit ooit terugkomt**: ga niet opnieuw op zoek naar een
gratis-met-echte-AI-oplossing — Floris heeft dit bewust afgewogen en
gekozen voor "geen kosten" boven "AI-coaching", dus vraag eerst of hij
alsnog kosten accepteert voor deze specifieke feature voordat je 'm
opnieuw bouwt.

## Race-conditie-fix: snel wijzigen direct na openen van een pagina (8 sept 2026)

Floris meldde dat "hoe voel je je vandaag" (Health) soms niet leek op te
slaan. Oorzaak: elke Notion-blob-pagina (`kanban`/`health`/`financial`/
`identity`) doet bij `init()` een optimistische lokale render, gevolgd
door een asynchrone Notion-`GET` die als "bron van waarheid" de lokale
state overschrijft zodra die terugkomt. Als je (snel) iets opslaat
**terwijl** die `GET` nog onderweg is, kwam de oudere Notion-snapshot
er soms ná binnen en overschreef hij stilletjes je net opgeslagen
wijziging — een race condition, geen kapotte save-knop. Op productie
(trager netwerk naar Vercel/Notion) is dat venster groter dan lokaal
testen, wat verklaart waarom het daar wel opviel.

**Fix**: elk van de 4 modules heeft nu een `localEditedSinceMount`-vlag
(false bij `init()`, op `true` gezet zodra `persist()`/`persistFinancial()`
draait). Als de Notion-`GET` terugkomt terwijl die vlag al `true` is,
wordt de net opgeslagen data alsnog naar Notion gepusht i.p.v. overschreven
door de oudere snapshot. Zie `js/section-health.js`, `js/section-identity.js`,
`js/section-productivity.js`, `js/section-suerte.js`.

## Voorkeuren

- Geen emoji's in output/UI-copy.
- Nederlands is prima voor communicatie; code/comments mogen Engels zijn.
- Geen accounts/wachtwoorden/setup-gedoe voor de eindgebruiker — simpelheid
  boven features die daarvoor nodig zijn (expliciet herbevestigd 8 sept 2026
  na het uitproberen en terugdraaien van Supabase).
- **Geen doorlopende/reële kosten** voor features — ook niet iets kleins
  per gebruik. Expliciet bevestigd 8 sept 2026 na het uitproberen en
  terugdraaien van de Anthropic-API-gebaseerde AI-coach (Floris koos
  eerst zelf voor de betaalde/AI-optie, maar wilde 'm er alsnog uit toen
  puntje bij paaltje kwam). Stel bij een nieuwe feature met externe-
  API-kosten (LLM's, betaalde data-providers, etc.) dus expliciet de
  vraag of de kosten oké zijn vóórdat je 'm bouwt, en verwacht dat het
  antwoord alsnog "nee" kan zijn ook als eerder "ja" gezegd is.
