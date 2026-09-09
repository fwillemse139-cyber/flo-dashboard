// Compacte "snel loggen"-widget voor Home — zelfde storage/Notion-target
// als de volledige Health-pagina (flo.health_log, ?target=health), maar
// dan alleen mood/energie/productiviteit zodat je het in een paar seconden
// vanaf Home kan invullen. Wektijd/notitie/analytics blijven op de
// Health-pagina zelf. Zelfstandig van section-health.js (zelfde patroon
// als section-worksession.js) zodat Home niet de hele Health-module met
// alle grafieken hoeft te laden.
import { loadArray, saveArray } from "./store.js";

var STORAGE_KEY = "flo.health_log";
var container = null;
var saveStatus = "";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function persist(entries) {
  saveArray(STORAGE_KEY, entries);
  fetch("/api/notion?target=health", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: entries })
  }).catch(function () {});
}

function upsertEntry(patch) {
  var entries = loadArray(STORAGE_KEY);
  var date = todayStr();
  var existing = entries.find(function (e) { return e.date === date; });
  if (existing) {
    Object.assign(existing, patch);
  } else {
    entries.push(Object.assign({ date: date, mood: "", energy: null, productivity: null, wakeTime: "", note: "", workMinutes: 0 }, patch));
  }
  persist(entries);
  saveStatus = "Opgeslagen om " + new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  render();
}

export function init(rootEl) {
  container = rootEl;
  render();
}

function render() {
  if (!container) return;
  var entries = loadArray(STORAGE_KEY);
  var todayEntry = entries.find(function (e) { return e.date === todayStr(); }) || {};

  var html = '<label class="field-label">Mood</label><select class="field" id="qh-mood">';
  ["", "Top", "Goed", "Oké", "Matig", "Slecht"].forEach(function (m) {
    html += '<option value="' + esc(m) + '" ' + (todayEntry.mood === m ? "selected" : "") + '>' + (m || "Kies…") + "</option>";
  });
  html += "</select>";
  html += '<label class="field-label">Energie (1-10)</label><input class="field" id="qh-energy" type="number" min="1" max="10" value="' + (todayEntry.energy != null ? todayEntry.energy : "") + '">';
  html += '<label class="field-label">Productiviteit (1-10)</label><input class="field" id="qh-productivity" type="number" min="1" max="10" value="' + (todayEntry.productivity != null ? todayEntry.productivity : "") + '">';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;">';
  html += '<button class="new-task-btn" id="qh-save">Opslaan</button>';
  html += '<span style="font-size:12px;color:var(--done);font-weight:600;">' + esc(saveStatus) + "</span>";
  html += "</div>";

  container.innerHTML = html;

  var saveBtn = container.querySelector("#qh-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      upsertEntry({
        mood: container.querySelector("#qh-mood").value,
        energy: container.querySelector("#qh-energy").value ? parseInt(container.querySelector("#qh-energy").value, 10) : null,
        productivity: container.querySelector("#qh-productivity").value ? parseInt(container.querySelector("#qh-productivity").value, 10) : null
      });
    });
  }
}
