import { loadArray, saveArray, uid } from "./store.js";

var STORAGE_KEY = "flo.suerte_financial";
var CLIENTS_KEY = "flo.suerte_clients";
var container = null;
var financial = { transactions: [], income: [] };
var clients = [];
var notionAvailable = { financial: false, suerte: false };

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function persistFinancial() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(financial)); } catch (e) {}
  if (notionAvailable.financial) {
    fetch("/api/notion?target=financial", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: financial })
    }).catch(function () {});
  }
}

function persistClients() {
  saveArray(CLIENTS_KEY, clients);
  if (notionAvailable.suerte) {
    fetch("/api/notion?target=suerte", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: clients })
    }).catch(function () {});
  }
}

export async function init(rootEl) {
  container = rootEl;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    financial = raw ? JSON.parse(raw) : { transactions: [], income: [] };
  } catch (e) { financial = { transactions: [], income: [] }; }
  clients = loadArray(CLIENTS_KEY);
  render();

  try {
    var fRes = await fetch("/api/notion?target=financial");
    if (fRes.ok) {
      var fBody = await fRes.json();
      notionAvailable.financial = true;
      var notionFinancial = fBody.data;
      var localHasData = (financial.transactions || []).length > 0 || (financial.income || []).length > 0;
      var notionHasData = notionFinancial && ((notionFinancial.transactions || []).length > 0 || (notionFinancial.income || []).length > 0);
      if (!notionHasData && localHasData) {
        persistFinancial();
      } else if (notionFinancial) {
        financial = notionFinancial;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(financial));
      }
      render();
    }
  } catch (e) {}

  try {
    var cRes = await fetch("/api/notion?target=suerte");
    if (cRes.ok) {
      var cBody = await cRes.json();
      notionAvailable.suerte = true;
      var notionClients = cBody.data || [];
      if (notionClients.length === 0 && clients.length > 0) {
        persistClients();
      } else {
        clients = notionClients;
        saveArray(CLIENTS_KEY, clients);
      }
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

var MONTHS_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
var LINE_RE = new RegExp("(\\d{1,2}\\s+" + MONTHS_RE + "\\s+\\d{4})\\s+(.+?)\\s+([-+]?\\d[\\d.,]*\\.\\d{2})\\s*(EUR|USD|GBP)?", "i");

function parseLine(line) {
  var m = line.match(LINE_RE);
  if (!m) return null;
  var amountStr = m[3].replace(/,/g, "");
  var amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;
  return { date: m[1], description: m[2].trim(), amount: amount, currency: m[4] || "EUR" };
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

async function handleFileUpload(file) {
  var statusEl = container.querySelector("#fin-upload-status");
  if (statusEl) statusEl.textContent = "Bezig met inlezen…";
  try {
    var lines = await extractLines(file);
    var found = lines.map(parseLine).filter(function (x) { return x; });
    found.forEach(function (t) {
      financial.transactions.push({
        id: uid(),
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        category: t.amount < 0 ? guessCategory(t.description) : "Inkomen"
      });
    });
    persistFinancial();
    if (statusEl) statusEl.textContent = found.length + " transacties gevonden en toegevoegd.";
    render();
  } catch (e) {
    if (statusEl) statusEl.textContent = "Kon de PDF niet uitlezen: " + (e.message || e);
  }
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

// ---------- Clients ----------
function addClient(name, project) {
  clients.push({ id: uid(), name: name, project: project, status: "Actief", note: "" });
  persistClients();
  render();
}
function updateClientStatus(id, status) {
  var c = clients.find(function (x) { return x.id === id; });
  if (c) { c.status = status; persistClients(); render(); }
}
function removeClient(id) {
  clients = clients.filter(function (x) { return x.id !== id; });
  persistClients();
  render();
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

function incomeBySource() {
  var totals = {};
  financial.transactions.concat(financial.income || []).forEach(function (t) {
    var amt = t.amount != null ? t.amount : 0;
    if (amt <= 0) return;
    var key = t.description || t.source || "Onbekend";
    totals[key] = (totals[key] || 0) + amt;
  });
  return Object.keys(totals).map(function (k) { return { source: k, total: totals[k] }; }).sort(function (a, b) { return b.total - a.total; });
}

function renderBars(rows, valueKey, labelKey) {
  if (rows.length === 0) return '<div class="empty-drop">Nog geen data</div>';
  var max = Math.max.apply(null, rows.map(function (r) { return r[valueKey]; }));
  var html = "";
  rows.slice(0, 8).forEach(function (r) {
    var pct = max > 0 ? (r[valueKey] / max) * 100 : 0;
    html += '<div class="bar-row"><div class="bar-label">' + esc(r[labelKey]) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="bar-value">€' + r[valueKey].toFixed(2) + '</div></div>';
  });
  return html;
}

function render() {
  if (!container) return;
  var totalSpend = financial.transactions.filter(function (t) { return t.amount < 0; }).reduce(function (a, t) { return a + Math.abs(t.amount); }, 0);
  var totalIncome = financial.transactions.concat(financial.income || []).filter(function (t) { return (t.amount || 0) > 0; }).reduce(function (a, t) { return a + t.amount; }, 0);
  var byCategory = spendByCategory();
  var bySource = incomeBySource();
  var recentTx = financial.transactions.slice().reverse().slice(0, 10);

  var html = '<div class="section-header"><h2>Suerte</h2><div class="tagline">Business tools — financiën en klanten</div></div>';
  html += '<div class="home-grid">';

  html += '<div class="home-card"><div class="home-card-title">Financieel overzicht</div>';
  html += '<div class="stat-row"><span>Totaal uitgegeven</span><span class="deadline-urgent">€' + totalSpend.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Totaal inkomsten</span><span style="color:var(--done);font-weight:700;">€' + totalIncome.toFixed(2) + '</span></div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Revolut-statement uploaden</div>';
  html += '<div class="upload-drop" id="fin-upload-drop">Klik om een PDF te kiezen (Revolut-statement)</div>';
  html += '<input type="file" id="fin-upload-input" accept="application/pdf" style="display:none;">';
  html += '<div id="fin-upload-status" style="font-size:11.5px;color:var(--muted);margin-top:8px;"></div>';
  html += '<div class="tagline" style="margin-top:8px;">Best-effort uitlezen — controleer de gevonden transacties, pas gerust handmatig aan.</div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Grootste uitgavecategorieën</div>';
  html += renderBars(byCategory, "total", "category");
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Grootste inkomstenbronnen</div>';
  html += renderBars(bySource, "total", "source");
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

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Clients</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px;">';
  html += '<input class="field" id="cl-name" placeholder="Naam klant" style="flex:1;">';
  html += '<input class="field" id="cl-project" placeholder="Project" style="flex:1;">';
  html += '<button class="new-task-btn" id="cl-add">+ Toevoegen</button>';
  html += "</div>";
  if (clients.length === 0) html += '<div class="empty-drop">Nog geen clients</div>';
  clients.forEach(function (c) {
    html += '<div class="flat-row"><div><div class="event-title">' + esc(c.name) + '</div><div class="deadline">' + esc(c.project || "") + '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<select class="status-select" data-action="client-status" data-id="' + c.id + '">';
    ["Actief", "On hold", "Afgerond"].forEach(function (s) {
      html += '<option value="' + s + '" ' + (c.status === s ? "selected" : "") + '>' + s + "</option>";
    });
    html += "</select>";
    html += '<button class="close-btn" data-action="client-remove" data-id="' + c.id + '">×</button></div></div>';
  });
  html += "</div>";

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
      if (fileInput.files[0]) handleFileUpload(fileInput.files[0]);
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
  var clientAddBtn = app.querySelector("#cl-add");
  if (clientAddBtn) {
    clientAddBtn.addEventListener("click", function () {
      var name = app.querySelector("#cl-name").value.trim();
      var project = app.querySelector("#cl-project").value.trim();
      if (!name) return;
      addClient(name, project);
    });
  }
  app.querySelectorAll('[data-action="client-status"]').forEach(function (el) {
    el.addEventListener("change", function () { updateClientStatus(el.getAttribute("data-id"), el.value); });
  });
  app.querySelectorAll('[data-action="client-remove"]').forEach(function (el) {
    el.addEventListener("click", function () { removeClient(el.getAttribute("data-id")); });
  });
}
