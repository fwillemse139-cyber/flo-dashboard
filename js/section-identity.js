import { uid } from "./store.js";

var STORAGE_KEY = "flo.identity";
var container = null;
var notionAvailable = false;
var localEditedSinceMount = false;
var state = { statement: "", traits: [], evidence: [], goals: [] };

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function seedGoals() {
  var short = [
    "Elke dag 1 uur lezen",
    "Gym 3x per week + Muay Thai/Kickboksen/Hockey",
    "Nieuwe connecties/netwerk uitbreiden (sociaal + zakelijk)",
    "Naar business-evenementen gaan",
    "Consistent (maandelijks) investeren",
    "Sociaal weekend weg (alleen)",
    "Oor operatie",
    "Invisalign beugel"
  ];
  var long = [
    "Diploma HBO Bedrijfskunde",
    "Fysiek beter worden (sport + voeding)",
    "Algemene kennis verbreden",
    "Specifieke kennis verdiepen (business, finance, psychologie etc)",
    "Spaans lessen volgen (wekelijks)",
    "Reizen",
    "Muay Thai camp (3/4 weken)",
    "Rijbewijs"
  ];
  var goals = [];
  short.forEach(function (t) { goals.push({ id: uid(), term: "short", text: t, done: false }); });
  long.forEach(function (t) { goals.push({ id: uid(), term: "long", text: t, done: false }); });
  return goals;
}

function loadLocal() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function persist() {
  localEditedSinceMount = true;
  saveLocal();
  if (notionAvailable) {
    fetch("/api/notion?target=identity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: state })
    }).catch(function () {});
  }
}

export async function init(rootEl) {
  container = rootEl;
  localEditedSinceMount = false;
  var local = loadLocal();
  if (local) {
    state = local;
  } else {
    state = { statement: "", traits: [], evidence: [], goals: seedGoals() };
    saveLocal();
  }
  render();

  try {
    var res = await fetch("/api/notion?target=identity");
    if (res.ok) {
      var body = await res.json();
      notionAvailable = true;
      var notionData = body.data;
      var notionEmpty = !notionData || !notionData.goals || notionData.goals.length === 0;
      if (localEditedSinceMount) {
        // je hebt al iets aangepast terwijl deze (trage) fetch nog liep —
        // niet overschrijven met de oudere Notion-snapshot die nu pas
        // terugkomt, wel alsnog pushen zodat Notion bijgewerkt raakt.
        persist();
      } else if (notionEmpty && state.goals.length > 0) {
        persist(); // eerste keer: lokale (of geseede) data omhoog duwen
      } else {
        state = notionData;
        saveLocal();
      }
      render();
    }
  } catch (e) {
    // geen backend beschikbaar — blijft bij de lokale versie
  }
}

function saveStatement(text) {
  state.statement = text;
  persist();
}

function addTrait(name) {
  state.traits.push({ id: uid(), name: name });
  persist();
  render();
}
function removeTrait(id) {
  state.traits = state.traits.filter(function (t) { return t.id !== id; });
  state.evidence = state.evidence.filter(function (e) { return e.traitId !== id; });
  persist();
  render();
}
function addEvidence(traitId, note) {
  state.evidence.unshift({ id: uid(), traitId: traitId, date: new Date().toISOString().slice(0, 10), note: note });
  persist();
  render();
}
function removeEvidence(id) {
  state.evidence = state.evidence.filter(function (e) { return e.id !== id; });
  persist();
  render();
}

function addGoal(term, text) {
  state.goals.push({ id: uid(), term: term, text: text, done: false });
  persist();
  render();
}
function toggleGoal(id) {
  var g = state.goals.find(function (x) { return x.id === id; });
  if (g) { g.done = !g.done; persist(); render(); }
}
function removeGoal(id) {
  state.goals = state.goals.filter(function (g) { return g.id !== id; });
  persist();
  render();
}

function traitEvidenceCount(traitId) {
  return state.evidence.filter(function (e) { return e.traitId === traitId; }).length;
}

function renderGoalColumn(term, label) {
  var goals = state.goals.filter(function (g) { return g.term === term; });
  var html = '<div class="home-card"><div class="home-card-title">' + label + "</div>";
  html += '<div class="quicknote-add"><input class="field" id="goal-input-' + term + '" placeholder="Nieuw doel…"><button class="new-task-btn" data-action="add-goal" data-term="' + term + '">+ Add</button></div>';
  html += '<div class="flat-list">';
  goals.forEach(function (g) {
    html += '<div class="flat-row' + (g.done ? " done" : "") + '"><label class="flat-check"><input type="checkbox" ' + (g.done ? "checked" : "") + ' data-action="toggle-goal" data-id="' + g.id + '"> ' + esc(g.text) + '</label>';
    html += '<button class="close-btn" data-action="remove-goal" data-id="' + g.id + '">×</button></div>';
  });
  if (goals.length === 0) html += '<div class="empty-drop">Nog geen doelen</div>';
  html += "</div></div>";
  return html;
}

function render() {
  if (!container) return;
  var html = '<div class="section-header"><h2>Identity</h2><div class="tagline">Wie je wordt — eigenschappen, bewijs, en je doelen</div></div>';
  html += '<div class="home-grid">';

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Wie wil Floris zijn?</div>';
  html += '<textarea class="field" id="id-statement" style="min-height:80px;">' + esc(state.statement) + '</textarea>';
  html += '<button class="new-task-btn" id="id-statement-save" style="margin-top:10px;">Opslaan</button>';
  html += "</div>";

  html += '<div class="home-card home-card-wide"><div class="home-card-title">Eigenschappen &amp; bewijs</div>';
  html += '<div class="quicknote-add"><input class="field" id="trait-input" placeholder="Nieuwe eigenschap (bv. Discipline)…"><button class="new-task-btn" id="trait-add">+ Add</button></div>';
  state.traits.forEach(function (t) {
    html += '<div class="flat-row" style="align-items:flex-start;">';
    html += '<div style="flex:1;"><div class="event-title">' + esc(t.name) + ' <span class="tagline" style="display:inline;">· ' + traitEvidenceCount(t.id) + ' bewijs</span></div>';
    var recentEvidence = state.evidence.filter(function (e) { return e.traitId === t.id; }).slice(0, 3);
    recentEvidence.forEach(function (e) {
      html += '<div class="deadline" style="margin-top:4px;">' + esc(e.date) + ' — ' + esc(e.note) + ' <span data-action="remove-evidence" data-id="' + e.id + '" style="cursor:pointer;color:var(--high);">×</span></div>';
    });
    html += '<div style="display:flex;gap:8px;margin-top:8px;">';
    html += '<input class="field" data-evidence-input="' + t.id + '" placeholder="Wat bewijst dit? (bv. 3 dagen achter elkaar gestudeerd)" style="flex:1;">';
    html += '<button class="archive-nav" data-action="add-evidence" data-trait-id="' + t.id + '">+ Bewijs</button>';
    html += "</div></div>";
    html += '<button class="close-btn" data-action="remove-trait" data-id="' + t.id + '">×</button>';
    html += "</div>";
  });
  if (state.traits.length === 0) html += '<div class="empty-drop">Nog geen eigenschappen toegevoegd</div>';
  html += "</div>";

  html += renderGoalColumn("short", "Short term");
  html += renderGoalColumn("mid", "Mid term");
  html += renderGoalColumn("long", "Long term");

  html += "</div>";
  container.innerHTML = html;
  attachEvents();
}

function attachEvents() {
  var app = container;
  var statementSave = app.querySelector("#id-statement-save");
  if (statementSave) statementSave.addEventListener("click", function () { saveStatement(app.querySelector("#id-statement").value); });

  var traitAdd = app.querySelector("#trait-add");
  if (traitAdd) {
    traitAdd.addEventListener("click", function () {
      var input = app.querySelector("#trait-input");
      var v = input.value.trim();
      if (!v) return;
      input.value = "";
      addTrait(v);
    });
  }
  app.querySelectorAll('[data-action="remove-trait"]').forEach(function (el) {
    el.addEventListener("click", function () { removeTrait(el.getAttribute("data-id")); });
  });
  app.querySelectorAll('[data-action="add-evidence"]').forEach(function (el) {
    el.addEventListener("click", function () {
      var traitId = el.getAttribute("data-trait-id");
      var input = app.querySelector('[data-evidence-input="' + traitId + '"]');
      var v = input.value.trim();
      if (!v) return;
      addEvidence(traitId, v);
    });
  });
  app.querySelectorAll('[data-action="remove-evidence"]').forEach(function (el) {
    el.addEventListener("click", function () { removeEvidence(el.getAttribute("data-id")); });
  });

  ["short", "mid", "long"].forEach(function (term) {
    var btn = app.querySelector('[data-action="add-goal"][data-term="' + term + '"]');
    if (btn) {
      btn.addEventListener("click", function () {
        var input = app.querySelector("#goal-input-" + term);
        var v = input.value.trim();
        if (!v) return;
        input.value = "";
        addGoal(term, v);
      });
    }
  });
  app.querySelectorAll('[data-action="toggle-goal"]').forEach(function (el) {
    el.addEventListener("change", function () { toggleGoal(el.getAttribute("data-id")); });
  });
  app.querySelectorAll('[data-action="remove-goal"]').forEach(function (el) {
    el.addEventListener("click", function () { removeGoal(el.getAttribute("data-id")); });
  });
}
