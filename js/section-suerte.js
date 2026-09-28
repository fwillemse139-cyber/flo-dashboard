import { uid } from "./store.js";

var STORAGE_KEY = "flo.suerte_financial";
var container = null;
// `accounts` = waar het vermogen staat (Spaarrekening, Stocks & ETF's,
// Contant, etc.) — {id, label, balance}.
// `entries` = losse inkomsten/uitgaven — {id, month ("YYYY-MM"), amount,
// type: "inkomen"|"uitgave", category, accountId}. Optioneel gekoppeld aan
// een account: die balance wordt dan automatisch bijgewerkt, zodat je een
// rekeningsaldo niet los hoeft bij te houden naast de inkomsten/uitgaven.
var financial = { accounts: [], entries: [] };
var notionAvailable = { financial: false };
var localEditedSinceMount = false;

// Categorieën ter keuze bij het invullen — "Anders" toont een los tekstveld
// voor iets dat er niet bij staat, zodat het een vaste lijst blijft (snel
// kiezen) zonder de vrijheid van eigen tekst kwijt te raken.
var CATEGORIES = {
  inkomen: ["Salaris", "Freelance / bijbaan", "Stocks & ETF's", "Cadeau", "Teruggave", "Anders"],
  uitgave: ["Boodschappen", "Vaste lasten", "Vervoer", "Abonnementen", "Horeca", "Winkelen", "Stocks & ETF's", "Anders"]
};

function categoryOptions(type) {
  return CATEGORIES[type].map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join("");
}

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

// Data van vóór de herbouw (28 sept 2026, veel simpeler systeem op verzoek
// van Floris) had een andere vorm (`transactions`/`income` i.p.v.
// `accounts`/`entries`) — die wordt hier gereset naar een lege staat i.p.v.
// geprobeerd te migreren.
function isLegacyShape(data) {
  return !data || !Array.isArray(data.entries);
}

export async function init(rootEl) {
  container = rootEl;
  localEditedSinceMount = false;
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    financial = raw ? JSON.parse(raw) : { accounts: [], entries: [] };
  } catch (e) { financial = { accounts: [], entries: [] }; }
  if (isLegacyShape(financial)) financial = { accounts: [], entries: [] };
  render();

  try {
    var fRes = await fetch("/api/notion?target=financial");
    if (fRes.ok) {
      var fBody = await fRes.json();
      notionAvailable.financial = true;
      var notionFinancial = fBody.data;
      var localHasData = (financial.accounts || []).length > 0 || (financial.entries || []).length > 0;
      var notionHasData = !isLegacyShape(notionFinancial) && ((notionFinancial.accounts || []).length > 0 || (notionFinancial.entries || []).length > 0);
      if (localEditedSinceMount) {
        // je hebt al iets aangepast terwijl deze (trage) fetch nog liep —
        // niet overschrijven met de oudere Notion-snapshot die nu pas
        // terugkomt, wel alsnog pushen.
        persistFinancial();
      } else if (!notionHasData && localHasData) {
        persistFinancial();
      } else if (!isLegacyShape(notionFinancial)) {
        financial = notionFinancial;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(financial));
      } else {
        // Notion heeft nog de oude vorm — meteen resetten en de lege staat
        // ook terugschrijven zodat 'ie niet bij de volgende load terugkomt.
        financial = { accounts: [], entries: [] };
        persistFinancial();
      }
      render();
    }
  } catch (e) {}
}

// ---------- Vermogen (rekeningen/bezittingen) ----------
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

function accountLabel(id) {
  var acc = financial.accounts.find(function (a) { return a.id === id; });
  return acc ? acc.label : null;
}

// Verplaatst het bedrag van een entry in (sign=1) of uit (sign=-1) de
// gekoppelde rekening.
function applyEntryToAccount(entry, sign) {
  if (!entry.accountId) return;
  var acc = financial.accounts.find(function (a) { return a.id === entry.accountId; });
  if (!acc) return;
  var delta = entry.type === "inkomen" ? entry.amount : -entry.amount;
  acc.balance += sign * delta;
}

// ---------- Inkomen & uitgaven ----------
function addEntry(month, amount, type, category, accountId) {
  var entry = { id: uid(), month: month, amount: amount, type: type, category: category, accountId: accountId || null };
  financial.entries.push(entry);
  applyEntryToAccount(entry, 1);
  persistFinancial();
  render();
}

function removeEntry(id) {
  var entry = financial.entries.find(function (e) { return e.id === id; });
  if (!entry) return;
  applyEntryToAccount(entry, -1);
  financial.entries = financial.entries.filter(function (e) { return e.id !== id; });
  persistFinancial();
  render();
}

function currentMonthKey() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function formatMonth(monthKey) {
  var parts = monthKey.split("-");
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return d.toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
}

function monthTotal(type, monthKey) {
  return financial.entries
    .filter(function (e) { return e.type === type && e.month === monthKey; })
    .reduce(function (sum, e) { return sum + e.amount; }, 0);
}

function render() {
  if (!container) return;
  var netWorth = netWorthTotal();
  var thisMonth = currentMonthKey();
  var incomeThisMonth = monthTotal("inkomen", thisMonth);
  var expenseThisMonth = monthTotal("uitgave", thisMonth);
  var sortedEntries = financial.entries.slice().sort(function (a, b) { return b.month.localeCompare(a.month); });

  var accountOptions = '<option value="">Geen</option>' + financial.accounts.map(function (a) {
    return '<option value="' + a.id + '">' + esc(a.label) + '</option>';
  }).join("");

  var html = '<div class="section-header"><h2>Finance</h2><div class="tagline">Inkomen, uitgaven en vermogen — simpel bijgehouden</div></div>';
  html += '<div class="home-grid">';

  html += '<div class="home-card"><div class="home-card-title">Overzicht</div>';
  html += '<div class="stat-row"><span>Huidig vermogen</span><span style="color:var(--done);font-weight:700;">€' + netWorth.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Inkomen deze maand</span><span style="color:var(--done);font-weight:700;">€' + incomeThisMonth.toFixed(2) + '</span></div>';
  html += '<div class="stat-row"><span>Uitgaven deze maand</span><span class="deadline-urgent">€' + expenseThisMonth.toFixed(2) + '</span></div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Vermogen — waar staat het geld</div>';
  if (financial.accounts.length === 0) {
    html += '<div class="empty-drop">Nog niks ingevuld — voeg hieronder je rekeningen/bezittingen toe (bv. Spaarrekening, Stocks &amp; ETF’s, Contant)</div>';
  } else {
    financial.accounts.forEach(function (a) {
      html += '<div class="home-line"><span>' + esc(a.label) + '</span><span style="display:flex;align-items:center;gap:8px;">';
      html += '<input class="field" type="number" step="0.01" data-action="account-balance" data-id="' + a.id + '" value="' + a.balance + '" style="width:110px;text-align:right;">';
      html += '<button class="close-btn" data-action="remove-account" data-id="' + a.id + '">×</button></span></div>';
    });
  }
  html += '<div class="stat-row" style="margin-top:4px;"><span>Totaal vermogen</span><span style="color:var(--done);font-weight:700;">€' + netWorth.toFixed(2) + '</span></div>';
  html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
  html += '<input class="field" id="fin-account-label" placeholder="Naam (bv. Spaarrekening)" style="flex:2;min-width:140px;">';
  html += '<input class="field" id="fin-account-balance" type="number" step="0.01" placeholder="Bedrag" style="flex:1;min-width:90px;">';
  html += '<button class="new-task-btn" id="fin-account-add">+ Toevoegen</button>';
  html += "</div></div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Inkomen &amp; uitgaven</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">';
  html += '<input class="field" id="fin-entry-month" type="month" value="' + thisMonth + '" style="flex:1;min-width:130px;">';
  html += '<input class="field" id="fin-entry-amount" type="number" step="0.01" placeholder="Bedrag" style="flex:1;min-width:90px;">';
  html += '<select class="field" id="fin-entry-type" style="flex:1;min-width:110px;"><option value="inkomen">Inkomen</option><option value="uitgave">Uitgave</option></select>';
  html += '<select class="field" id="fin-entry-category" style="flex:1;min-width:150px;">' + categoryOptions("inkomen") + '</select>';
  html += '<input class="field" id="fin-entry-category-custom" placeholder="Naam categorie" style="flex:1;min-width:130px;display:none;">';
  html += '<select class="field" id="fin-entry-account" style="flex:1;min-width:130px;">' + accountOptions + '</select>';
  html += '<button class="new-task-btn" id="fin-entry-add">+ Toevoegen</button>';
  html += "</div>";
  if (sortedEntries.length === 0) {
    html += '<div class="empty-drop">Nog geen inkomsten of uitgaven ingevuld</div>';
  } else {
    sortedEntries.forEach(function (e) {
      var color = e.type === "inkomen" ? "var(--done)" : "var(--high)";
      var sign = e.type === "inkomen" ? "+" : "-";
      var accLabel = accountLabel(e.accountId);
      html += '<div class="home-line"><span>' + formatMonth(e.month) + ' · ' + esc(e.category) + (accLabel ? ' <span class="tagline" style="display:inline;">· ' + esc(accLabel) + '</span>' : '') + '</span>';
      html += '<span style="display:flex;align-items:center;gap:8px;"><span style="color:' + color + ';font-weight:600;">' + sign + '€' + e.amount.toFixed(2) + '</span>';
      html += '<button class="close-btn" data-action="remove-entry" data-id="' + e.id + '">×</button></span></div>';
    });
  }
  html += "</div>";

  html += "</div>";
  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;

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

  var typeSelect = app.querySelector("#fin-entry-type");
  var categorySelect = app.querySelector("#fin-entry-category");
  var categoryCustom = app.querySelector("#fin-entry-category-custom");
  if (typeSelect && categorySelect && categoryCustom) {
    typeSelect.addEventListener("change", function () {
      categorySelect.innerHTML = categoryOptions(typeSelect.value);
      categoryCustom.style.display = "none";
      categoryCustom.value = "";
    });
    categorySelect.addEventListener("change", function () {
      categoryCustom.style.display = categorySelect.value === "Anders" ? "" : "none";
    });
  }

  var entryAddBtn = app.querySelector("#fin-entry-add");
  if (entryAddBtn) {
    entryAddBtn.addEventListener("click", function () {
      var month = app.querySelector("#fin-entry-month").value || currentMonthKey();
      var amount = parseFloat(app.querySelector("#fin-entry-amount").value);
      var type = app.querySelector("#fin-entry-type").value;
      var categoryChoice = app.querySelector("#fin-entry-category").value;
      var category = categoryChoice === "Anders" ? app.querySelector("#fin-entry-category-custom").value.trim() : categoryChoice;
      var accountId = app.querySelector("#fin-entry-account").value;
      if (!category || isNaN(amount) || amount <= 0) return;
      addEntry(month, amount, type, category, accountId);
    });
  }
  app.querySelectorAll('[data-action="remove-entry"]').forEach(function (btn) {
    btn.addEventListener("click", function () { removeEntry(btn.getAttribute("data-id")); });
  });
}
