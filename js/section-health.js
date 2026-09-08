import { loadArray, saveArray } from "./store.js";
import { renderBars } from "./barChart.js";
import * as worksession from "./section-worksession.js";

var STORAGE_KEY = "flo.health_log";
var container = null;
var entries = [];
var notionAvailable = false;
var localEditedSinceMount = false;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function persist() {
  saveArray(STORAGE_KEY, entries);
  if (notionAvailable) {
    fetch("/api/notion?target=health", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: entries })
    }).catch(function () {});
  }
}

export async function init(rootEl) {
  container = rootEl;
  entries = loadArray(STORAGE_KEY);
  localEditedSinceMount = false;
  render();

  try {
    var res = await fetch("/api/notion?target=health");
    if (res.ok) {
      var body = await res.json();
      var notionEntries = body.data || [];
      notionAvailable = true;
      if (localEditedSinceMount) {
        // je hebt al iets opgeslagen terwijl deze (trage) fetch nog liep —
        // de net opgeslagen wijziging mag nooit stilletjes overschreven
        // worden door de oudere Notion-snapshot die nu pas terugkomt.
        persist();
      } else if (notionEntries.length === 0 && entries.length > 0) {
        persist(); // eerste keer: lokale historie omhoog duwen i.p.v. overschrijven
      } else {
        entries = notionEntries;
        saveArray(STORAGE_KEY, entries);
      }
      render();
    }
  } catch (e) {
    // geen backend beschikbaar — blijft bij de lokale versie
  }
}

function getEntry(date) {
  return entries.find(function (e) { return e.date === date; });
}

function upsertEntry(patch) {
  var date = todayStr();
  var existing = getEntry(date);
  if (existing) {
    Object.assign(existing, patch);
  } else {
    entries.push(Object.assign({ date: date, mood: "", energy: null, productivity: null, wakeTime: "", note: "", workMinutes: 0 }, patch));
  }
  localEditedSinceMount = true;
  persist();
}

// ---------- Analytics ----------
function average(list, key) {
  var vals = list.map(function (e) { return e[key]; }).filter(function (v) { return typeof v === "number"; });
  if (vals.length === 0) return null;
  return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
}

function entriesInLastDays(days) {
  var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter(function (e) { return new Date(e.date).getTime() >= cutoff; });
}

function fmtNum(n) { return n == null ? "—" : n.toFixed(1); }

// Groepeert entries per kalendermaand (laatste N maanden) en geeft per
// maand het gemiddelde van `field` terug — lege maanden (geen logs) worden
// overgeslagen zodat de staafdiagram niet vol misleidende nullen komt.
function monthlyAverage(field, monthsBack) {
  var now = new Date();
  var buckets = [];
  for (var i = monthsBack - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }), vals: [] });
  }
  entries.forEach(function (e) {
    var key = (e.date || "").slice(0, 7);
    var bucket = buckets.find(function (b) { return b.key === key; });
    if (bucket && typeof e[field] === "number") bucket.vals.push(e[field]);
  });
  return buckets.filter(function (b) { return b.vals.length > 0; }).map(function (b) {
    return { label: b.label, total: b.vals.reduce(function (a, v) { return a + v; }, 0) / b.vals.length };
  });
}

function monthlyWorkHours(monthsBack) {
  var now = new Date();
  var buckets = [];
  for (var i = monthsBack - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }), total: 0 });
  }
  entries.forEach(function (e) {
    var key = (e.date || "").slice(0, 7);
    var bucket = buckets.find(function (b) { return b.key === key; });
    if (bucket) bucket.total += (e.workMinutes || 0) / 60;
  });
  return buckets;
}

function oneDecimal(v) { return v.toFixed(1); }

function renderChart(list) {
  var w = 560, h = 120, pad = 20;
  var sorted = list.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  if (sorted.length === 0) return '<div class="empty-drop">Nog geen data</div>';
  var stepX = sorted.length > 1 ? (w - pad * 2) / (sorted.length - 1) : 0;
  function toY(v) { return h - pad - ((v - 1) / 9) * (h - pad * 2); }
  function pathFor(key, color) {
    var points = sorted.map(function (e, i) {
      var v = e[key];
      if (typeof v !== "number") return null;
      return (pad + i * stepX) + "," + toY(v);
    }).filter(function (p) { return p; });
    if (points.length === 0) return "";
    return '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + points.join(" ") + '"/>';
  }
  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;">';
  svg += pathFor("energy", "#3b82f6");
  svg += pathFor("productivity", "#10b981");
  svg += "</svg>";
  svg += '<div style="display:flex;gap:16px;font-size:11px;color:var(--muted);margin-top:6px;">';
  svg += '<span><span style="display:inline-block;width:8px;height:8px;background:#3b82f6;border-radius:2px;margin-right:5px;"></span>Energie</span>';
  svg += '<span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:2px;margin-right:5px;"></span>Productiviteit</span>';
  svg += "</div>";
  return svg;
}

function render() {
  if (!container) return;
  var today = todayStr();
  var todayEntry = getEntry(today) || {};

  var week = entriesInLastDays(7);
  var month = entriesInLastDays(30);
  var last30 = entriesInLastDays(30);
  var peakEnergyDay = last30.slice().sort(function (a, b) { return (b.energy || 0) - (a.energy || 0); })[0];

  var html = '<div class="section-header"><h2>Health</h2><div class="tagline">Dagelijkse check-in, energie/productiviteit-trend en werksessies</div></div>';
  html += '<div class="home-grid">';

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Hoe voel je je vandaag?</div>';
  html += '<div class="health-form">';
  html += '<label class="field-label">Mood</label><select class="field" id="hl-mood">';
  ["", "Top", "Goed", "Oké", "Matig", "Slecht"].forEach(function (m) {
    html += '<option value="' + esc(m) + '" ' + (todayEntry.mood === m ? "selected" : "") + '>' + (m || "Kies…") + "</option>";
  });
  html += "</select>";
  html += '<label class="field-label">Energie (1-10)</label><input class="field" id="hl-energy" type="number" min="1" max="10" value="' + (todayEntry.energy != null ? todayEntry.energy : "") + '">';
  html += '<label class="field-label">Productiviteit (1-10)</label><input class="field" id="hl-productivity" type="number" min="1" max="10" value="' + (todayEntry.productivity != null ? todayEntry.productivity : "") + '">';
  html += '<label class="field-label">Hoe laat opgestaan?</label><input class="field" id="hl-waketime" type="time" value="' + esc(todayEntry.wakeTime || "") + '">';
  html += '<label class="field-label">Waarom / notitie</label><textarea class="field" id="hl-note" style="min-height:60px;">' + esc(todayEntry.note || "") + '</textarea>';
  html += '<button class="new-task-btn" id="hl-save" style="margin-top:14px;">Opslaan</button>';
  html += "</div></div>";

  html += '<div class="home-card"><div class="home-card-title">Werksessie</div><div id="health-w-worksession"></div></div>';

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Trend (laatste 14 dagen)</div>';
  html += renderChart(entriesInLastDays(14));
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Gem. energie per maand</div>';
  html += renderBars(monthlyAverage("energy", 6), "total", "label", { format: oneDecimal, color: "#3b82f6", max: 10 });
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Gem. productiviteit per maand</div>';
  html += renderBars(monthlyAverage("productivity", 6), "total", "label", { format: oneDecimal, color: "#10b981", max: 10 });
  html += "</div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Werktijd per maand (uur)</div>';
  html += renderBars(monthlyWorkHours(6).filter(function (b) { return b.total > 0; }), "total", "label", { format: function (v) { return v.toFixed(1) + " u"; }, color: "#f59e0b" });
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Deze week</div>';
  html += '<div class="home-line"><span>Gem. energie</span><span class="deadline">' + fmtNum(average(week, "energy")) + '</span></div>';
  html += '<div class="home-line"><span>Gem. productiviteit</span><span class="deadline">' + fmtNum(average(week, "productivity")) + '</span></div>';
  html += '<div class="home-line"><span>Werktijd totaal</span><span class="deadline">' + Math.round(week.reduce(function (a, e) { return a + (e.workMinutes || 0); }, 0) / 60 * 10) / 10 + ' u</span></div>';
  html += "</div>";

  html += '<div class="home-card"><div class="home-card-title">Deze maand</div>';
  html += '<div class="home-line"><span>Gem. energie</span><span class="deadline">' + fmtNum(average(month, "energy")) + '</span></div>';
  html += '<div class="home-line"><span>Gem. productiviteit</span><span class="deadline">' + fmtNum(average(month, "productivity")) + '</span></div>';
  html += '<div class="home-line"><span>Piekdag energie</span><span class="deadline">' + (peakEnergyDay ? esc(peakEnergyDay.date) + " (" + peakEnergyDay.energy + ")" : "—") + '</span></div>';
  html += "</div>";

  html += "</div>";

  container.innerHTML = html;
  attachEvents();
  worksession.init(document.getElementById("health-w-worksession"));
}

function attachEvents() {
  var app = container;
  var saveBtn = app.querySelector("#hl-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      upsertEntry({
        mood: app.querySelector("#hl-mood").value,
        energy: app.querySelector("#hl-energy").value ? parseInt(app.querySelector("#hl-energy").value, 10) : null,
        productivity: app.querySelector("#hl-productivity").value ? parseInt(app.querySelector("#hl-productivity").value, 10) : null,
        wakeTime: app.querySelector("#hl-waketime").value,
        note: app.querySelector("#hl-note").value
      });
      render();
    });
  }
}
