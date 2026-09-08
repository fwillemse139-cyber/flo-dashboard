import { loadArray, saveArray, uid } from "./store.js";

var STORAGE_KEY = "flo.notes";
var container = null;
var items = [];
var notionAvailable = false;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sortItems() {
  items.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
}

function persist() { saveArray(STORAGE_KEY, items); }

export async function init(rootEl) {
  container = rootEl;
  items = loadArray(STORAGE_KEY);
  sortItems();
  render();

  // Notion (via /api/notion?target=notes) is de bron van waarheid zodra de
  // app op Vercel staat met NOTION_TOKEN gezet — lokaal (of zonder die env
  // var) valt dit terug op de localStorage-versie hierboven, geen harde fout.
  try {
    var res = await fetch("/api/notion?target=notes");
    if (res.ok) {
      var data = await res.json();
      items = (data.items || []).map(function (x) { return { id: x.id, body: x.body, updatedAt: Date.now() }; });
      notionAvailable = true;
      persist();
      render();
    }
  } catch (e) {
    // geen backend beschikbaar — blijft bij de lokale versie
  }
}

async function addNote() {
  var localItem = { id: uid(), body: "", updatedAt: Date.now() };
  items.unshift(localItem);
  persist(); render();
  if (notionAvailable) {
    try {
      var res = await fetch("/api/notion?target=notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "" }) });
      var data = await res.json();
      if (res.ok) { localItem.id = data.id; persist(); }
    } catch (e) {}
  }
}

async function saveNote(id, body) {
  var n = items.find(function (x) { return x.id === id; });
  if (!n) return;
  n.body = body;
  n.updatedAt = Date.now();
  persist();
  if (notionAvailable) {
    try { await fetch("/api/notion?target=notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, body: body }) }); } catch (e) {}
  }
}

async function removeNote(id) {
  items = items.filter(function (x) { return x.id !== id; });
  persist(); render();
  if (notionAvailable) {
    try { await fetch("/api/notion?target=notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }) }); } catch (e) {}
  }
}

function render() {
  if (!container) return;
  var html = '<button class="new-task-btn" id="note-add" style="margin-bottom:12px;">+ New note</button>';
  html += '<div class="notes-grid">';
  items.forEach(function (n) {
    html += '<div class="note-card">';
    html += '<textarea class="note-body" data-id="' + n.id + '" placeholder="Schrijf iets…">' + esc(n.body) + '</textarea>';
    html += '<button class="close-btn note-remove" data-action="remove" data-id="' + n.id + '">×</button>';
    html += '</div>';
  });
  if (items.length === 0) html += '<div class="empty-drop">Nog geen notities</div>';
  html += '</div>';

  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;
  var addBtn = app.querySelector("#note-add");
  if (addBtn) addBtn.addEventListener("click", addNote);

  app.querySelectorAll(".note-body").forEach(function (el) {
    var timer = null;
    el.addEventListener("input", function () {
      clearTimeout(timer);
      var id = el.getAttribute("data-id");
      var value = el.value;
      timer = setTimeout(function () { saveNote(id, value); }, 500);
    });
  });
  app.querySelectorAll('[data-action="remove"]').forEach(function (el) {
    el.addEventListener("click", function () { removeNote(el.getAttribute("data-id")); });
  });
}
