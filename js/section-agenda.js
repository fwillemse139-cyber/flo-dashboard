import { loadArray, saveArray, uid } from "./store.js";

var STORAGE_KEY = "flo.agenda_events";
var container = null;
var items = [];
var appleEvents = [];

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateTime(iso, allDay) {
  var d = new Date(iso);
  var dateStr = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  if (allDay) return dateStr;
  var timeStr = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return dateStr + ", " + timeStr;
}

function sortItems() {
  items.sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
}

function persist() { saveArray(STORAGE_KEY, items); }

export function init(rootEl) {
  container = rootEl;
  items = loadArray(STORAGE_KEY);
  sortItems();
  render();
  refreshAppleEvents();
}

// /api/apple-calendar bestaat alleen op Vercel (serverless function, haalt
// Floris' publieke iCloud .ics feed server-side op) — lokaal draaien zonder
// Vercel geeft gewoon een 404, dan blijft alleen de handmatige agenda over.
async function refreshAppleEvents() {
  try {
    var res = await fetch("/api/apple-calendar");
    if (!res.ok) return;
    var data = await res.json();
    appleEvents = (data.events || []).map(function (e) {
      return { id: "apple-" + e.startsAt + "-" + e.title, title: e.title, startsAt: e.startsAt, allDay: e.allDay, note: "", fromApple: true };
    });
    render();
  } catch (e) {
    // geen backend beschikbaar (bv. lokaal testen) — stil negeren
  }
}

function addEvent(title, startsAtIso, allDay, note) {
  items.push({ id: uid(), title: title, startsAt: startsAtIso, allDay: allDay, note: note });
  sortItems();
  persist(); render();
}

function removeEvent(id) {
  items = items.filter(function (x) { return x.id !== id; });
  persist(); render();
}

// Toont de eerstvolgende 5 events, tenzij er meer dan 5 events binnen 2
// dagen vallen — dan worden juist ALLE events binnen die 2 dagen getoond
// (zodat een drukke periode niet kunstmatig wordt afgekapt).
function getVisibleUpcoming() {
  var now = Date.now();
  var in2Days = now + 2 * 24 * 60 * 60 * 1000;
  var combined = items.concat(appleEvents);
  combined.sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
  var upcoming = combined.filter(function (e) { return new Date(e.startsAt).getTime() >= now; });
  var within2Days = upcoming.filter(function (e) { return new Date(e.startsAt).getTime() <= in2Days; });
  return within2Days.length > 5 ? within2Days : upcoming.slice(0, 5);
}

function render() {
  if (!container) return;
  var upcoming = getVisibleUpcoming();

  var html = '<button class="new-task-btn" id="ev-add" style="margin-bottom:12px;">+ New event</button>';
  html += '<div class="flat-list">';
  upcoming.forEach(function (e) {
    html += '<div class="flat-row">';
    html += '<div><div class="event-title">' + esc(e.title) + (e.fromApple ? ' <span class="tagline" style="display:inline;">· Apple</span>' : '') + '</div>';
    html += '<div class="deadline">' + formatDateTime(e.startsAt, e.allDay) + (e.note ? " · " + esc(e.note) : "") + '</div></div>';
    html += e.fromApple ? '' : '<button class="close-btn" data-action="remove" data-id="' + e.id + '">×</button>';
    html += '</div>';
  });
  if (upcoming.length === 0) html += '<div class="empty-drop">Geen aankomende events</div>';
  html += '</div>';

  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;
  var addBtn = app.querySelector("#ev-add");
  if (addBtn) addBtn.addEventListener("click", openAddPrompt);
  app.querySelectorAll('[data-action="remove"]').forEach(function (el) {
    el.addEventListener("click", function () { removeEvent(el.getAttribute("data-id")); });
  });
}

function openAddPrompt() {
  container.insertAdjacentHTML("beforeend", renderModal());
  var overlay = container.querySelector(".modal-overlay");
  overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  container.querySelector(".modal").addEventListener("click", function (e) { e.stopPropagation(); });
  container.querySelector('[data-action="close-modal"]').addEventListener("click", function () { overlay.remove(); });
  container.querySelector("#ev-save").addEventListener("click", function () {
    var title = (container.querySelector("#ev-title").value || "").trim();
    var date = container.querySelector("#ev-date").value;
    var time = container.querySelector("#ev-time").value;
    var note = (container.querySelector("#ev-note").value || "").trim();
    if (!title || !date) return;
    var allDay = !time;
    var iso = new Date(date + "T" + (time || "00:00")).toISOString();
    overlay.remove();
    addEvent(title, iso, allDay, note);
  });
}

function renderModal() {
  return (
    '<div class="modal-overlay">' +
    '<div class="modal">' +
    '<div class="modal-header"><span class="modal-title">New event</span><button class="close-btn" data-action="close-modal">×</button></div>' +
    '<label class="field-label">Title</label><input class="field" id="ev-title">' +
    '<label class="field-label">Date</label><input class="field" id="ev-date" type="date">' +
    '<label class="field-label">Time (optioneel — leeg = hele dag)</label><input class="field" id="ev-time" type="time">' +
    '<label class="field-label">Note (optioneel)</label><textarea class="field" id="ev-note" style="min-height:50px;"></textarea>' +
    '<button class="new-task-btn" id="ev-save" style="width:100%;margin-top:18px;justify-content:center;">Add event</button>' +
    '</div></div>'
  );
}
