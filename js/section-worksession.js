// Start/stop-werksessie-widget — gemount op zowel Home (naast Tasks, voor
// snel starten) als op Health zelf (met uitgebreid sessielogboek erbij).
// Elke start->stop wordt als losse sessie gelogd (flo.work_sessions,
// ?target=worksessions) mét starttijd/eindtijd/duur, en telt daarnaast op
// bij het dagtotaal in Health's eigen "flo.health_log" (?target=health) —
// zo blijft Health's bestaande workMinutes-analytics werken, en krijg je
// er een per-dag overzicht van de losse sessies bij. Je kan een dag dus
// in meerdere stukken loggen (start, pauze, weer start): elke stop-actie
// telt gewoon op bij wat er al was, niets wordt overschreven.
import { loadArray, saveArray, uid } from "./store.js";

var HEALTH_KEY = "flo.health_log";
var SESSIONS_KEY = "flo.work_sessions";
var ACTIVE_KEY = "flo.health_active_session";
var container = null;
var tickInterval = null;
var showLog = false;
var notionAvailable = false;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fmtDuration(min) {
  var h = Math.floor(min / 60), m = min % 60;
  return (h > 0 ? h + "u " : "") + m + "m";
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function persistHealthEntries(entries) {
  saveArray(HEALTH_KEY, entries);
  fetch("/api/notion?target=health", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: entries })
  }).catch(function () {});
}

function persistSessions(sessions) {
  saveArray(SESSIONS_KEY, sessions);
  if (notionAvailable) {
    fetch("/api/notion?target=worksessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: sessions })
    }).catch(function () {});
  }
}

async function syncSessionsFromNotion() {
  try {
    var res = await fetch("/api/notion?target=worksessions");
    if (!res.ok) return;
    var body = await res.json();
    notionAvailable = true;
    var notionSessions = body.data || [];
    var local = loadArray(SESSIONS_KEY);
    if (notionSessions.length === 0 && local.length > 0) {
      persistSessions(local); // eerste keer: lokale historie omhoog duwen i.p.v. overschrijven
    } else {
      saveArray(SESSIONS_KEY, notionSessions);
    }
    render();
  } catch (e) {
    // geen backend beschikbaar — blijft bij de lokale versie
  }
}

function getActiveSession() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); } catch (e) { return null; }
}
function setActiveSession(session) {
  try {
    if (session) localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch (e) {}
}

function startSession() {
  setActiveSession({ startedAt: Date.now() });
  render();
}

function stopSession() {
  var session = getActiveSession();
  if (!session) return;
  var minutes = Math.max(Math.round((Date.now() - session.startedAt) / 60000), 0);
  var endedAt = Date.now();
  setActiveSession(null);

  var sessions = loadArray(SESSIONS_KEY);
  sessions.push({ id: uid(), date: todayStr(), startedAt: session.startedAt, endedAt: endedAt, minutes: minutes });
  persistSessions(sessions);

  var entries = loadArray(HEALTH_KEY);
  var date = todayStr();
  var existing = entries.find(function (e) { return e.date === date; });
  if (existing) {
    existing.workMinutes = (existing.workMinutes || 0) + minutes;
  } else {
    entries.push({ date: date, mood: "", energy: null, productivity: null, wakeTime: "", note: "", workMinutes: minutes });
  }
  persistHealthEntries(entries);

  render();
}

function removeSession(id) {
  var sessions = loadArray(SESSIONS_KEY);
  var session = sessions.find(function (s) { return s.id === id; });
  if (!session) return;
  sessions = sessions.filter(function (s) { return s.id !== id; });
  persistSessions(sessions);

  var entries = loadArray(HEALTH_KEY);
  var existing = entries.find(function (e) { return e.date === session.date; });
  if (existing) {
    existing.workMinutes = Math.max((existing.workMinutes || 0) - session.minutes, 0);
    persistHealthEntries(entries);
  }
  render();
}

export function init(rootEl, opts) {
  container = rootEl;
  showLog = !!(opts && opts.showLog);
  render();
  syncSessionsFromNotion();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(render, 30000);
}

function renderSessionLog() {
  var sessions = loadArray(SESSIONS_KEY);
  if (sessions.length === 0) return '<div class="empty-drop" style="margin-top:16px;">Nog geen sessies gelogd</div>';
  var byDate = {};
  sessions.forEach(function (s) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  var dates = Object.keys(byDate).sort().reverse();
  var html = '<div style="margin-top:16px;">';
  dates.forEach(function (date, i) {
    var daySessions = byDate[date].slice().sort(function (a, b) { return a.startedAt - b.startedAt; });
    var totalMin = daySessions.reduce(function (a, s) { return a + s.minutes; }, 0);
    html += '<div style="' + (i > 0 ? "margin-top:14px;" : "") + '"><div class="event-title">' + esc(date) + ' <span class="tagline" style="display:inline;">· ' + fmtDuration(totalMin) + ' totaal</span></div>';
    daySessions.forEach(function (s) {
      html += '<div class="home-line"><span>' + fmtTime(s.startedAt) + ' – ' + fmtTime(s.endedAt) + '</span><span style="display:flex;align-items:center;gap:8px;"><span class="deadline">' + fmtDuration(s.minutes) + '</span><button class="close-btn" data-action="remove-session" data-id="' + s.id + '">×</button></span></div>';
    });
    html += "</div>";
  });
  html += "</div>";
  return html;
}

function render() {
  if (!container) return;
  var session = getActiveSession();
  var entries = loadArray(HEALTH_KEY);
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
  if (showLog) html += renderSessionLog();

  container.innerHTML = html;
  var startBtn = container.querySelector("#ws-start");
  if (startBtn) startBtn.addEventListener("click", startSession);
  var stopBtn = container.querySelector("#ws-stop");
  if (stopBtn) stopBtn.addEventListener("click", stopSession);
  container.querySelectorAll('[data-action="remove-session"]').forEach(function (el) {
    el.addEventListener("click", function () { removeSession(el.getAttribute("data-id")); });
  });
}
