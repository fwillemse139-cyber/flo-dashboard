// Kleine, op zichzelf staande widget voor het starten/stoppen van een
// werksessie — gemount op zowel Home (naast Tasks, voor snel starten) als
// op Health zelf. Schrijft naar dezelfde "flo.health_log"-storage/Notion-
// target als Health, dus de geloggde minuten tellen daar gewoon mee in de
// week-/maandanalytics, ongeacht vanaf welke pagina de sessie gestart is.
import { loadArray, saveArray } from "./store.js";

var STORAGE_KEY = "flo.health_log";
var SESSION_KEY = "flo.health_active_session";
var container = null;
var tickInterval = null;

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function persistEntries(entries) {
  saveArray(STORAGE_KEY, entries);
  fetch("/api/notion?target=health", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: entries })
  }).catch(function () {});
}

function getActiveSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function setActiveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

function startSession() {
  setActiveSession({ startedAt: Date.now() });
  render();
}

function stopSession() {
  var session = getActiveSession();
  if (!session) return;
  var minutes = Math.round((Date.now() - session.startedAt) / 60000);
  setActiveSession(null);
  var entries = loadArray(STORAGE_KEY);
  var date = todayStr();
  var existing = entries.find(function (e) { return e.date === date; });
  if (existing) {
    existing.workMinutes = (existing.workMinutes || 0) + Math.max(minutes, 0);
  } else {
    entries.push({ date: date, mood: "", energy: null, productivity: null, wakeTime: "", note: "", workMinutes: Math.max(minutes, 0) });
  }
  persistEntries(entries);
  render();
}

export function init(rootEl) {
  container = rootEl;
  render();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(render, 30000);
}

function render() {
  if (!container) return;
  var session = getActiveSession();
  var entries = loadArray(STORAGE_KEY);
  var today = todayStr();
  var todayEntry = entries.find(function (e) { return e.date === today; }) || {};
  var html = "";
  if (session) {
    var elapsedMin = Math.round((Date.now() - session.startedAt) / 60000);
    html += '<div class="home-line"><span>Bezig sinds ' + new Date(session.startedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) + '</span><span class="deadline">' + elapsedMin + ' min</span></div>';
    html += '<button class="new-task-btn" id="ws-stop" style="margin-top:10px;">Stop sessie</button>';
  } else {
    html += '<div class="home-line"><span>Vandaag totaal</span><span class="deadline">' + (todayEntry.workMinutes || 0) + ' min</span></div>';
    html += '<button class="new-task-btn" id="ws-start" style="margin-top:10px;">Start sessie</button>';
  }
  container.innerHTML = html;
  var startBtn = container.querySelector("#ws-start");
  if (startBtn) startBtn.addEventListener("click", startSession);
  var stopBtn = container.querySelector("#ws-stop");
  if (stopBtn) stopBtn.addEventListener("click", stopSession);
}
