import { loadArray, saveArray, uid } from "./store.js";

var STORAGE_KEY = "flo.quick_tasks";
var HIDDEN_KEY = "flo.hidden_notion_task_ids";
var container = null;
var items = [];
var notionAvailable = false;
var hiddenIds = [];

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function persist() { saveArray(STORAGE_KEY, items); }
function persistHidden() { saveArray(HIDDEN_KEY, hiddenIds); }

export async function init(rootEl) {
  container = rootEl;
  hiddenIds = loadArray(HIDDEN_KEY);
  items = loadArray(STORAGE_KEY);
  render();

  // Notion (via /api/notion?target=tasks) is de bron van waarheid zodra de
  // app op Vercel staat met NOTION_TOKEN gezet — lokaal (of zonder die env
  // var) valt dit terug op de localStorage-versie hierboven, geen harde fout.
  // Taken die je op het dashboard "verwijdert" worden hier gefilterd
  // (hiddenIds) i.p.v. echt uit Notion verwijderd — ze blijven daar staan.
  try {
    var res = await fetch("/api/notion?target=tasks");
    if (res.ok) {
      var data = await res.json();
      items = (data.items || []).filter(function (x) { return hiddenIds.indexOf(x.id) === -1; });
      notionAvailable = true;
      persist();
      render();
    }
  } catch (e) {
    // geen backend beschikbaar — blijft bij de lokale versie
  }
}

async function addItem(title) {
  var localItem = { id: uid(), title: title, done: false, createdAt: Date.now() };
  items.push(localItem);
  persist(); render();
  if (notionAvailable) {
    try {
      var res = await fetch("/api/notion?target=tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title, done: false }) });
      var data = await res.json();
      if (res.ok) { localItem.id = data.id; persist(); }
    } catch (e) {}
  }
}

async function toggleItem(id) {
  var t = items.find(function (x) { return x.id === id; });
  if (!t) return;
  t.done = !t.done;
  persist(); render();
  if (notionAvailable) {
    try { await fetch("/api/notion?target=tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, done: t.done }) }); } catch (e) {}
  }
}

function removeItem(id) {
  items = items.filter(function (x) { return x.id !== id; });
  persist(); render();
  if (notionAvailable) {
    // Bewust GEEN Notion-delete: de taak blijft in Notion staan, alleen
    // lokaal verborgen op het dashboard (Floris wil taken niet kwijtraken
    // in Notion door ze op het dashboard weg te klikken).
    hiddenIds.push(id);
    persistHidden();
  }
}

function render() {
  if (!container) return;
  var open = items.filter(function (t) { return !t.done; });
  var done = items.filter(function (t) { return t.done; });

  var html = '<div class="quicknote-add"><input class="field" id="qt-input" placeholder="Nieuwe taak…"><button class="new-task-btn" id="qt-add">+ Add</button></div>';

  html += '<div class="flat-list">';
  open.forEach(function (t) {
    html += '<div class="flat-row"><label class="flat-check"><input type="checkbox" data-action="toggle" data-id="' + t.id + '"> ' + esc(t.title) + '</label>';
    html += '<button class="close-btn" data-action="remove" data-id="' + t.id + '">×</button></div>';
  });
  if (open.length === 0) html += '<div class="empty-drop">Niets openstaand</div>';
  html += '</div>';

  if (done.length > 0) {
    html += '<div class="flat-list-done-label">Klaar</div><div class="flat-list">';
    done.forEach(function (t) {
      html += '<div class="flat-row done"><label class="flat-check"><input type="checkbox" checked data-action="toggle" data-id="' + t.id + '"> ' + esc(t.title) + '</label>';
      html += '<button class="close-btn" data-action="remove" data-id="' + t.id + '">×</button></div>';
    });
    html += '</div>';
  }

  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;
  var addBtn = app.querySelector("#qt-add");
  var input = app.querySelector("#qt-input");
  function submit() {
    var v = (input.value || "").trim();
    if (!v) return;
    input.value = "";
    addItem(v);
  }
  if (addBtn) addBtn.addEventListener("click", submit);
  if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

  app.querySelectorAll('[data-action="toggle"]').forEach(function (el) {
    el.addEventListener("change", function () { toggleItem(el.getAttribute("data-id")); });
  });
  app.querySelectorAll('[data-action="remove"]').forEach(function (el) {
    el.addEventListener("click", function () { removeItem(el.getAttribute("data-id")); });
  });
}
