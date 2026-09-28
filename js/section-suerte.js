import { uid } from "./store.js";
import { renderBars } from "./barChart.js";

var STORAGE_KEY = "flo.suerte_financial";
var container = null;
// `income` = terugkerende inkomstenbronnen (los ingevuld door Floris, geen
// bank-transacties) — {id, label, amount, frequency}. `accounts` = saldo
// per rekening/bezit — {id, label, balance} — som hiervan is het vermogen.
var financial = { transactions: [], income: [], accounts: [] };
var notionAvailable = { financial: false };
var localEditedSinceMount = false;
var uploadStatus = "";
var uploadDebug = "";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function persistFinancial() {
  localEditedSinceMount = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(financial)); } catch (e) {}
  if (notionAvailable.financial) {
    fetch("/api/notion?target=financial", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: financial })
    }).catch(function () {});
  }
}

export async function init(rootEl) {
  container = rootEl;
  localEditedSinceMount = false;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    financial = raw ? JSON.parse(raw) : { transactions: [], income: [], accounts: [] };
  } catch (e) { financial = { transactions: [], income: [], accounts: [] }; }
  normalizeFinancial();
  render();

  try {
    var fRes = await fetch("/api/notion?target=financial");
    if (fRes.ok) {
      var fBody = await fRes.json();
      notionAvailable.financial = true;
      var notionFinancial = fBody.data;
      var localHasData = (financial.transactions || []).length > 0 || (financial.income || []).length > 0;
      var notionHasData = notionFinancial && ((notionFinancial.transactions || []).length > 0 || (notionFinancial.income || []).length > 0);
      if (localEditedSinceMount) {
        // je hebt al iets aangepast (bv. een upload) terwijl deze (trage)
        // fetch nog liep — niet overschrijven met de oudere Notion-
        // snapshot die nu pas terugkomt, wel alsnog pushen.
        persistFinancial();
      } else if (!notionHasData && localHasData) {
        persistFinancial();
      } else if (notionFinancial) {
        financial = notionFinancial;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(financial));
      }
      normalizeFinancial();
      render();
    }
  } catch (e) {}
}

// ---------- PDF parsen (Revolut-statement, best-effort) ----------
var PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs";
var PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs";
var pdfjsLibPromise = null;
function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(/* webpackIgnore: true */ PDFJS_URL).then(function (lib) {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

async function extractLines(file) {
  var pdfjsLib = await loadPdfJs();
  var buf = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  var lines = [];
  for (var p = 1; p <= pdf.numPages; p++) {
    var page = await pdf.getPage(p);
    var content = await page.getTextContent();
    var rows = {};
    content.items.forEach(function (item) {
      var y = Math.round(item.transform[5]);
      if (!rows[y]) rows[y] = [];
      rows[y].push(item.str);
    });
    Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
      lines.push(rows[y].join(" ").replace(/\s+/g, " ").trim());
    });
  }
  return lines;
}

// Datum kan in allerlei vormen voorkomen afhankelijk van bank/locale:
// "24 Jan 2024" (Engels), "24 januari 2024" / "24 jan. 2024" (Nederlands),
// "24-01-2024" / "24/01/2024" (NL-numeriek), "2024-01-24" (ISO).
var MONTHS_EN = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
var MONTHS_NL = "jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec";
var DATE_PATTERN = "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4}|\\d{1,2}\\s+(?:" + MONTHS_EN + "|" + MONTHS_NL + ")[a-z]*\\.?\\s+\\d{4})";
// Bedrag: sta zowel komma- als punt-decimalen toe ("45,30" NL of "45.30"
// EN), met optioneel duizendtal-scheidingsteken ("1.234,56"/"1,234.56").
var AMOUNT_PATTERN = "([-+]?\\d[\\d.,]*\\d|[-+]?\\d)";
var LINE_RE = new RegExp(DATE_PATTERN + "\\s+(.+?)\\s+" + AMOUNT_PATTERN + "\\s*(EUR|USD|GBP|€|\\$|£)?\\s*$", "i");

var MONTH_INDEX = { jan: 0, feb: 1, mrt: 2, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dec: 11 };

// Zet allerlei datumnotaties om naar ISO YYYY-MM-DD, zodat transacties uit
// PDF's van willekeurig welk jaar/bank op dezelfde manier gesorteerd/
// gegroepeerd kunnen worden als handmatige entries (die al ISO zijn).
function toIsoDate(str) {
  str = String(str).trim();
  var m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return str;
  m = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  m = str.match(/^(\d{1,2})\s+([a-zé]+)\.?\s+(\d{4})$/i);
  if (m) {
    var monthIdx = MONTH_INDEX[m[2].toLowerCase().slice(0, 3)];
    if (monthIdx != null) return m[3] + "-" + String(monthIdx + 1).padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }
  var d = new Date(str);
  return isNaN(d.getTime()) ? str : (d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
}

// Zet een bedrag-string om naar een getal, ongeacht of komma of punt de
// decimaalscheiding is (bepaald door te kijken welke van de twee het
// laatst voorkomt — "1.234,56" -> komma is decimaal, "1,234.56" -> punt).
function parseAmount(str) {
  str = String(str).trim();
  var lastComma = str.lastIndexOf(",");
  var lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, "");
  } else {
    str = str.replace(",", ".");
  }
  return parseFloat(str);
}

function parseLine(line) {
  var m = line.match(LINE_RE);
  if (!m) return null;
  var amount = parseAmount(m[3]);
  if (isNaN(amount)) return null;
  return { date: toIsoDate(m[1]), description: m[2].trim(), amount: amount, currency: (m[4] || "EUR").toUpperCase().replace("€", "EUR").replace("$", "USD").replace("£", "GBP") };
}

// Best-effort parser voor bestaande, nog niet genormaliseerde datums
// (van vóór deze wijziging) — analytics blijven zo ook werken op oudere data.
function txDate(t) {
  var d = new Date(t.date);
  return isNaN(d.getTime()) ? null : d;
}

function txFingerprint(t) {
  return toIsoDate(t.date) + "|" + t.description.toLowerCase().trim() + "|" + t.amount.toFixed(2);
}

var CATEGORY_KEYWORDS = [
  ["Boodschappen", ["albert heijn", "jumbo", "lidl", "aldi", "plus ", "dirk"]],
  ["Vervoer", ["ns ", "ns-", "uber", "shell", "bp ", "esso", "ov-chipkaart", "ns groep"]],
  ["Abonnementen", ["netflix", "spotify", "disney", "youtube premium", "amazon prime"]],
  ["Eten & Drinken", ["mcdonald", "starbucks", "thuisbezorgd", "uber eats", "domino"]],
  ["Horeca", ["cafe", "bar ", "restaurant"]],
  ["Winkelen", ["bol.com", "amazon", "zalando", "h&m", "primark"]],
  ["Huisvesting", ["huur", "energie", "vattenfall", "eneco", "waterbedrijf"]]
];

function guessCategory(description) {
  var d = description.toLowerCase();
  for (var i = 0; i < CATEGORY_KEYWORDS.length; i++) {
    var cat = CATEGORY_KEYWORDS[i][0];
    var keywords = CATEGORY_KEYWORDS[i][1];
    for (var j = 0; j < keywords.length; j++) {
      if (d.indexOf(keywords[j]) !== -1) return cat;
    }
  }
  return "Overig";
}

async function handleFileUploads(files) {
  var statusEl = container.querySelector("#fin-upload-status");
  var seen = {};
  financial.transactions.forEach(function (t) { seen[txFingerprint(t)] = true; });
  var totalAdded = 0, totalSkipped = 0, failed = [];
  var debugLines = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (statusEl) statusEl.textContent = "Bezig met bestand " + (i + 1) + "/" + files.length + " (" + file.name + ")…";
    try {
      var lines = await extractLines(file);
      var found = lines.map(parseLine).filter(function (x) { return x; });
      if (found.length === 0) debugLines = debugLines.concat(lines.slice(0, 25));
      found.forEach(function (t) {
        var fp = txFingerprint(t);
        if (seen[fp]) { totalSkipped++; return; }
        seen[fp] = true;
        totalAdded++;
        financial.transactions.push({
          id: uid(),
          date: t.date,
          description: t.description,
          amount: t.amount,
          currency: t.currency,
          category: t.amount < 0 ? guessCategory(t.description) : "Inkomen"
        });
      });
    } catch (e) {
      failed.push(file.name);
    }
  }
  persistFinancial();
  uploadStatus = totalAdded + " nieuwe transacties toegevoegd, " + totalSkipped + " duplicaten overgeslagen.";
  if (failed.length > 0) uploadStatus += " Kon niet uitlezen: " + failed.join(", ") + ".";
  uploadDebug = (totalAdded === 0 && debugLines.length > 0)
    ? "Geen enkele regel herkend — ruwe tekst uit de PDF (eerste regels), stuur dit door zodat het patroon verfijnd kan worden:\n" + debugLines.join("\n")
    : "";
  render();
}

function removeTransaction(id) {
  financial.transactions = financial.transactions.filter(function (t) { return t.id !== id; });
  persistFinancial();
  render();
}

function addManualTransaction(desc, amount, category) {
  financial.transactions.push({ id: uid(), date: new Date().toISOString().slice(0, 10), description: desc, amount: amount, currency: "EUR", category: category });
  persistFinancial();
  render();
}

// Vult ontbrekende velden aan voor data die vóór het invoeren van Inkomen/
// Saldo & vermogen is opgeslagen (in localStorage of Notion), zodat oudere
// snapshots niet crashen op een ontbrekend `accounts`-array.
function normalizeFinancial() {
  financial.transactions = financial.transactions || [];
  financial.income = financial.income || [];
  financial.accounts = financial.accounts || [];
}

// ---------- Inkomen (terugkerende bronnen, los ingevuld door Floris) ----------
function addIncomeSource(label, amount, frequency) {
  financial.income.push({ id: uid(), label: label, amount: amount, frequency: frequency });
  persistFinancial();
  render();
}

function removeIncomeSource(id) {
  financial.income = financial.income.filter(function (i) { return i.id !== id; });
  persistFinancial();
  render();
}

function monthlyIncomeTotal() {
  return financial.income.reduce(function (sum, i) {
    if (i.frequency === "jaarlijks") return sum + i.amount / 12;
    if (i.frequency === "eenmalig") return sum;
    return sum + i.amount;
  }, 0);
}

// ---------- Saldo & vermogen (rekeningen/bezittingen, los ingevuld) ----------
function addAccount(label, balance) {
  financial.accounts.push({ id: uid(), label: label, balance: balance });
  persistFinancial();
  render();
}

function removeAccount(id) {
  financial.accounts = financial.accounts.filter(function (a) { return a.id !== id; });
  persistFinancial();
  render();
}

function updateAccountBalance(id, balance) {
  var acc = financial.accounts.find(function (a) { return a.id === id; });
  if (!acc) return;
  acc.balance = balance;
  persistFinancial();
  render();
}

function netWorthTotal() {
  return financial.accounts.reduce(function (sum, a) { return sum + (a.balance || 0); }, 0);
}

// ---------- Analytics ----------
function spendByCategory() {
  var totals = {};
  financial.transactions.forEach(function (t) {
    if (t.amount >= 0) return;
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });
  return Object.keys(totals).map(function (k) { return { category: k, total: totals[k] }; }).sort(function (a, b) { return b.total - a.total; });
}

// Let op: puur gebaseerd op banktransacties (uploads/handmatige transactie-
// invoer), niet op de Inkomen-kaart hierboven — dat zijn losse, terugkerende
// bronnen zonder datum/omschrijving-structuur en horen hier niet in mee.
function incomeBySource() {
  var totals = {};
  financial.transactions.forEach(function (t) {
    var amt = t.amount != null ? t.amount : 0;
    if (amt <= 0) return;
    var key = t.description || "Onbekend";
    totals[key] = (totals[key] || 0) + amt;
  });
  return Object.keys(totals).map(function (k) { return { source: k, total: totals[k] }; }).sort(function (a, b) { return b.total - a.total; });
}

function euroFmt(v) { return "€" + v.toFixed(2); }

// ---------- Meerjarige analytics (werkt over alle geuploade jaren heen) ----------
function spendByYear() {
  var totals = {};
  financial.transactions.forEach(function (t) {
    if (t.amount >= 0) return;
    var d = txDate(t);
    if (!d) return;
    var y = d.getFullYear();
    totals[y] = (totals[y] || 0) + Math.abs(t.amount);
  });
  return Object.keys(totals).sort().map(function (y) { return { label: y, total: totals[y] }; });
}

function spendByMonth(monthsBack) {
  var now = new Date();
  var buckets = [];
  for (var i = monthsBack - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }), total: 0 });
  }
  financial.transactions.forEach(function (t) {
    if (t.amount >= 0) return;
    var d = txDate(t);
    if (!d) return;
    var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    var bucket = buckets.find(function (b) { return b.key === key; });
    if (bucket) bucket.total += Math.abs(t.amount);
  });
  return buckets;
}

function categoryTotalsInRange(fromMs, toMs) {
  var totals = {};
  financial.transactions.forEach(function (t) {
    if (t.amount >= 0) return;
    var d = txDate(t);
    if (!d) return;
    var ms = d.getTime();
    if (ms < fromMs || ms > toMs) return;
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });
  return Object.keys(totals).map(function (k) { return { label: k, total: totals[k] }; }).sort(function (a, b) { return b.total - a.total; });
}

// Terugkerende afschrijvingen (zelfde omschrijving, in >= 3 losse maanden) —
// zijn goede kandidaten om op te besparen (abonnementen die je misschien
// vergeten bent, dubbele diensten, etc).
function recurringCandidates() {
  var groups = {};
  financial.transactions.forEach(function (t) {
    if (t.amount >= 0) return;
    var d = txDate(t);
    if (!d) return;
    var key = t.description.toLowerCase().replace(/[0-9]/g, "").trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push({ month: d.getFullYear() + "-" + d.getMonth(), amount: Math.abs(t.amount), description: t.description });
  });
  var candidates = [];
  Object.keys(groups).forEach(function (key) {
    var items = groups[key];
    var months = {};
    items.forEach(function (i) { months[i.month] = true; });
    var monthCount = Object.keys(months).length;
    if (monthCount >= 3) {
      var avgAmount = items.reduce(function (a, i) { return a + i.amount; }, 0) / items.length;
      candidates.push({ description: items[0].description, months: monthCount, avgAmount: avgAmount, yearlyTotal: avgAmount * 12 });
    }
  });
  return candidates.sort(function (a, b) { return b.yearlyTotal - a.yearlyTotal; });
}

function render() {
  if (!container) return;
  var totalSpend = financial.transactions.filter(function (t) { return t.amount < 0; }).reduce(function (a, t) { return a + Math.abs(t.amount); }, 0);
  var totalIncome = financial.transactions.filter(function (t) { return (t.amount || 0) > 0; }).reduce(function (a, t) { return a + t.amount; }, 0);
  var byCategory = spendByCategory();
  var bySource = incomeBySource();
  var recentTx = financial.transactions.slice().sort(function (a, b) { return (txDate(b) || 0) - (txDate(a) || 0); }).slice(0, 10);
  var byYear = spendByYear();
  var byMonth = spendByMonth(12);
  var oneYearMs = 365 * 24 * 60 * 60 * 1000;
  var lastYearCategories = categoryTotalsInRange(Date.now() - oneYearMs, Date.now());
  var recurring = recurringCandidates();
  var netWorth = netWorthTotal();
  var monthlyIncome = monthlyIncomeTotal();

  var html = '<div class="section-header"><h2>Finance</h2><div class="tagline">Financieel overzicht en analytics</div></div>';
  html += '<div class="home-grid">';

  html += '<div class="home-card"><div class="home-card-title">Financieel overzicht</div>';
  html += '<div class="stat-row"><span>Huidig vermogen</span><span style="color:var(--done);font-weight:700;">€' + netWorth.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Inkomen per maand</span><span style="color:var(--done);font-weight:700;">€' + monthlyIncome.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Totaal uitgegeven</span><span class="deadline-urgent">€' + totalSpend.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Totaal inkomsten (transacties)</span><span style="color:var(--done);font-weight:700;">€' + totalIncome.toFixed(2) + '</span></div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Inkomen</div>';
  if (financial.income.length === 0) {
    html += '<div class="empty-drop">Nog geen inkomstenbronnen ingevuld</div>';
  } else {
    financial.income.forEach(function (i) {
      var freqLabel = i.frequency === "jaarlijks" ? "/jaar" : (i.frequency === "eenmalig" ? " (eenmalig)" : "/maand");
      html += '<div class="home-line"><span>' + esc(i.label) + '</span><span style="display:flex;align-items:center;gap:8px;">';
      html += '<span style="color:var(--done);font-weight:600;">€' + i.amount.toFixed(2) + freqLabel + '</span>';
      html += '<button class="close-btn" data-action="remove-income" data-id="' + i.id + '">×</button></span></div>';
    });
  }
  html += '<div class="stat-row" style="margin-top:4px;"><span>Totaal per maand</span><span style="color:var(--done);font-weight:700;">€' + monthlyIncome.toFixed(2) + '</span></div>';
  html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
  html += '<input class="field" id="fin-income-label" placeholder="Bron (bv. salaris)" style="flex:2;min-width:120px;">';
  html += '<input class="field" id="fin-income-amount" type="number" step="0.01" placeholder="Bedrag" style="flex:1;min-width:90px;">';
  html += '<select class="field" id="fin-income-freq" style="flex:1;min-width:110px;"><option value="maandelijks">Maandelijks</option><option value="jaarlijks">Jaarlijks</option><option value="eenmalig">Eenmalig</option></select>';
  html += '<button class="new-task-btn" id="fin-income-add">+ Toevoegen</button>';
  html += "</div></div>";

  html += '<div class="home-card"><div class="home-card-title">Saldo & vermogen</div>';
  if (financial.accounts.length === 0) {
    html += '<div class="empty-drop">Nog geen rekeningen/bezittingen ingevuld</div>';
  } else {
    financial.accounts.forEach(function (a) {
      html += '<div class="home-line"><span>' + esc(a.label) + '</span><span style="display:flex;align-items:center;gap:8px;">';
      html += '<input class="field" type="number" step="0.01" data-action="account-balance" data-id="' + a.id + '" value="' + a.balance + '" style="width:110px;text-align:right;">';
      html += '<button class="close-btn" data-action="remove-account" data-id="' + a.id + '">×</button></span></div>';
    });
  }
  html += '<div class="stat-row" style="margin-top:4px;"><span>Totaal vermogen</span><span style="color:var(--done);font-weight:700;">€' + netWorth.toFixed(2) + '</span></div>';
  html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
  html += '<input class="field" id="fin-account-label" placeholder="Naam (bv. betaalrekening)" style="flex:2;min-width:140px;">';
  html += '<input class="field" id="fin-account-balance" type="number" step="0.01" placeholder="Saldo" style="flex:1;min-width:90px;">';
  html += '<button class="new-task-btn" id="fin-account-add">+ Toevoegen</button>';
  html += "</div></div>";

  html += '<div class="home-card"><div class="home-card-title">Bank-statements uploaden</div>';
  html += '<div class="upload-drop" id="fin-upload-drop">Klik om PDF(‘s) te kiezen — meerdere bestanden en meerdere jaren tegelijk mag</div>';
  html += '<input type="file" id="fin-upload-input" accept="application/pdf" multiple style="display:none;">';
  html += '<div id="fin-upload-status" style="font-size:11.5px;color:var(--muted);margin-top:8px;">' + esc(uploadStatus) + '</div>';
  if (uploadDebug) {
    html += '<pre style="font-size:10.5px;color:var(--muted);margin-top:8px;white-space:pre-wrap;max-height:200px;overflow:auto;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px;">' + esc(uploadDebug) + '</pre>';
  }
  html += '<div class="tagline" style="margin-top:8px;">Best-effort uitlezen — controleer de gevonden transacties, pas gerust handmatig aan. Duplicaten (zelfde datum/omschrijving/bedrag) worden automatisch overgeslagen, dus je kan gerust dezelfde periode nog eens uploaden.</div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Grootste uitgavecategorieën (all-time)</div>';
  html += renderBars(byCategory, "total", "category", { format: euroFmt });
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Grootste inkomstenbronnen</div>';
  html += renderBars(bySource, "total", "source", { format: euroFmt });
  html += "</div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Uitgaven per jaar</div>';
  html += renderBars(byYear, "total", "label", { format: euroFmt, limit: 20 });
  html += "</div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Uitgaven per maand (laatste 12 maanden)</div>';
  html += renderBars(byMonth, "total", "label", { format: euroFmt, limit: 12 });
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Grootste categorieën (afgelopen jaar)</div>';
  html += renderBars(lastYearCategories, "total", "label", { format: euroFmt });
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Mogelijk te besparen</div>';
  if (recurring.length === 0) {
    html += '<div class="empty-drop">Nog geen terugkerende afschrijvingen gevonden (minimaal 3 maanden nodig om een patroon te herkennen)</div>';
  } else {
    recurring.slice(0, 8).forEach(function (r) {
      html += '<div class="home-line"><span>' + esc(r.description) + ' <span class="tagline" style="display:inline;">· ' + r.months + 'x gezien</span></span>';
      html += '<span class="deadline-urgent">€' + r.avgAmount.toFixed(2) + '/mnd · €' + r.yearlyTotal.toFixed(0) + '/jaar</span></div>';
    });
  }
  html += "</div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Recente transacties</div>';
  if (recentTx.length === 0) html += '<div class="empty-drop">Nog geen transacties</div>';
  recentTx.forEach(function (t) {
    var color = t.amount < 0 ? "var(--high)" : "var(--done)";
    html += '<div class="home-line"><span>' + esc(t.description) + ' <span class="tagline" style="display:inline;">· ' + esc(t.category) + '</span></span>';
    html += '<span style="color:' + color + ';font-weight:600;">' + (t.amount < 0 ? "-" : "+") + '€' + Math.abs(t.amount).toFixed(2) + '</span></div>';
  });
  html += '<div style="display:flex;gap:8px;margin-top:12px;">';
  html += '<input class="field" id="fin-manual-desc" placeholder="Omschrijving" style="flex:2;">';
  html += '<input class="field" id="fin-manual-amount" type="number" step="0.01" placeholder="Bedrag (- voor uitgave)" style="flex:1;">';
  html += '<button class="new-task-btn" id="fin-manual-add">+ Toevoegen</button>';
  html += "</div></div>";

  html += "</div>";
  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;
  var dropZone = app.querySelector("#fin-upload-drop");
  var fileInput = app.querySelector("#fin-upload-input");
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      if (fileInput.files.length > 0) handleFileUploads(Array.from(fileInput.files));
    });
  }
  var manualAddBtn = app.querySelector("#fin-manual-add");
  if (manualAddBtn) {
    manualAddBtn.addEventListener("click", function () {
      var desc = app.querySelector("#fin-manual-desc").value.trim();
      var amount = parseFloat(app.querySelector("#fin-manual-amount").value);
      if (!desc || isNaN(amount)) return;
      addManualTransaction(desc, amount, amount < 0 ? guessCategory(desc) : "Inkomen");
    });
  }

  var incomeAddBtn = app.querySelector("#fin-income-add");
  if (incomeAddBtn) {
    incomeAddBtn.addEventListener("click", function () {
      var label = app.querySelector("#fin-income-label").value.trim();
      var amount = parseFloat(app.querySelector("#fin-income-amount").value);
      var frequency = app.querySelector("#fin-income-freq").value;
      if (!label || isNaN(amount)) return;
      addIncomeSource(label, amount, frequency);
    });
  }
  app.querySelectorAll('[data-action="remove-income"]').forEach(function (btn) {
    btn.addEventListener("click", function () { removeIncomeSource(btn.getAttribute("data-id")); });
  });

  var accountAddBtn = app.querySelector("#fin-account-add");
  if (accountAddBtn) {
    accountAddBtn.addEventListener("click", function () {
      var label = app.querySelector("#fin-account-label").value.trim();
      var balance = parseFloat(app.querySelector("#fin-account-balance").value);
      if (!label || isNaN(balance)) return;
      addAccount(label, balance);
    });
  }
  app.querySelectorAll('[data-action="remove-account"]').forEach(function (btn) {
    btn.addEventListener("click", function () { removeAccount(btn.getAttribute("data-id")); });
  });
  app.querySelectorAll('[data-action="account-balance"]').forEach(function (input) {
    input.addEventListener("change", function () {
      var v = parseFloat(input.value);
      if (isNaN(v)) return;
      updateAccountBalance(input.getAttribute("data-id"), v);
    });
  });
}
