import { loadArray, saveArray, uid } from "./store.js";
import { parseDeadline } from "./deadlineParser.js";

var STORAGE_KEY = "flo.kanban_tasks";
var ARCHIVE_AFTER_DAYS = 14;
var DAY_MS = 24 * 60 * 60 * 1000;

var COLUMNS_BY_CATEGORY = {
  personal: [{ id: "todo", label: "To do" }, { id: "in_progress", label: "In progress" }, { id: "done", label: "Done" }],
  academic: [{ id: "todo", label: "To do" }, { id: "in_progress", label: "In progress" }, { id: "review", label: "Review" }, { id: "done", label: "Done" }],
  business: [{ id: "todo", label: "To do" }, { id: "in_progress", label: "In progress" }, { id: "review", label: "Review" }, { id: "done", label: "Done" }]
};
var CATEGORIES = [{ id: "personal", label: "Personal" }, { id: "academic", label: "Academic" }, { id: "business", label: "Business" }];
var PRIORITY_META = { high: { label: "High", cls: "high" }, medium: { label: "Medium", cls: "medium" }, low: { label: "Low", cls: "low" } };

// ---------- Notion sync ----------
// Bron van waarheid voor Academic-taken: de 5 "Deadlines & Planning"-pagina's
// in Floris' Notion (Dashboard / Year 2 / <vak>). Bij een nieuwe sync wordt
// deze array bijgewerkt (door Claude, via Notion MCP) en NOTION_LAST_SYNCED
// gezet. mergeNotionSync() voegt nieuwe taken toe en werkt tekstvelden van
// bestaande taken bij (gematcht op id), zonder status/voortgang van Floris
// te overschrijven.
export var NOTION_LAST_SYNCED = "2026-09-07";

function nt(id, title, subject, deadline, priority, note) {
  return { id: id, title: title, subject: subject, deadline: deadline, priority: priority, note: note || "" };
}
export var NOTION_SYNC_DATA = [
  nt("be1", "Summary (400-500 woorden)", "Business English", "11 sept", "high", "20% van eindcijfer"),
  nt("be2", "Application letter + CV", "Business English", "18 sept", "high", "10%"),
  nt("be3", "Proposal (300-400 woorden)", "Business English", "25 sept", "medium", "20%"),
  nt("be4", "6-min presentatie (duo)", "Business English", "week 28 sept / 12 okt", "medium", "Mondeling examen 1 · 20%"),
  nt("be5", "Meeting-opdracht (4 studenten)", "Business English", "week 2 nov / 9 nov", "low", "Mondeling examen 2 · 20%"),
  nt("be6", "Email + memo (~200w elk)", "Business English", "13 nov", "low", "10%"),
  nt("be7", "Herkansing mondeling 1", "Business English", "week 16-20 nov", "low", "Presentaties"),
  nt("be8", "Herkansing mondeling 2", "Business English", "week 16-20 nov", "low", "Meetings"),

  nt("dm1", "E-learning: Introductie in Data", "Data & Marketing", "13 sept", "high", ""),
  nt("dm2", "E-learning: Data verzamelen en combineren", "Data & Marketing", "27 sept", "medium", "Te laat = -0,5 punt eindcijfer"),
  nt("dm3", "Alle Excel-opdrachten", "Data & Marketing", "4 okt", "medium", "incl. draaitabellen (deel 2)"),
  nt("dm4", "Beroepsproduct Hfst 1 (marktanalyse)", "Data & Marketing", "6 okt 2026, 23:59", "medium", "Fase 1"),
  nt("dm5", "E-learning: Customer Journey", "Data & Marketing", "18 okt", "low", ""),
  nt("dm6", "E-learning naar keuze", "Data & Marketing", "1 nov", "low", "marketingcommunicatie"),
  nt("dm7", "Pitches", "Data & Marketing", "Fase 2, week 4-5", "low", ""),
  nt("dm8", "Beroepsproduct volledig advies", "Data & Marketing", "25 nov 2026, 23:59", "low", "Fase 2, LU 2 t/m 5"),
  nt("dm9", "Herkansing beroepsproduct", "Data & Marketing", "2 feb 2027, 23:59", "low", ""),
  nt("dm10", "Herkansing pitch (video)", "Data & Marketing", "2 feb 2027, 23:59", "low", ""),

  nt("ko1", "Tentamen — kans 1", "Kwantitatief Onderzoek", "Fase 2, week 6 (tbd)", "medium", "Datum nog te bevestigen"),
  nt("ko2", "Hertentamen — kans 2", "Kwantitatief Onderzoek", "voorjaarsreces (tbd)", "low", ""),

  nt("os1", "Portfolio inleveren (drietal)", "Overheid & SDG", "5 okt, 23:59", "medium", "Datum in bron mogelijk tikfout — bevestigen"),
  nt("os2", "Assessment (individueel)", "Overheid & SDG", "toetsweek Fase 1 (tbd)", "medium", ""),

  nt("pd0", "PMW1: analyse projectteam + samenwerkingsovereenkomst", "Project Duurzaamheid", "1 sept, 23:59", "high", "Verlopen — controleer of dit al is ingeleverd"),
  nt("pd1", "Goedkeuringsformulier", "Project Duurzaamheid", "8 sept, 08:30", "high", ""),
  nt("pd2", "PMW2: vlog Scrum-methodiek", "Project Duurzaamheid", "8 sept, 23:59", "high", ""),
  nt("pd3", "Intakevragen", "Project Duurzaamheid", "15 sept, 08:30", "high", ""),
  nt("pd4", "PMW3: kanban board + risicomatrix", "Project Duurzaamheid", "15 sept, 23:59", "high", ""),
  nt("pd5", "PMW4: presentatie daily stand-ups", "Project Duurzaamheid", "22 sept, 23:59", "medium", ""),
  nt("pd6", "PMW5: verbeterplan", "Project Duurzaamheid", "29 sept, 23:59", "medium", ""),
  nt("pd7", "Plan van Aanpak (Fase 1)", "Project Duurzaamheid", "11 okt, 23:59", "low", "20% · herkansing 1 nov"),
  nt("pd8", "PMW: assessment", "Project Duurzaamheid", "toetsweek Fase 1 (tbd)", "medium", "Let op: bron noemt week 41, PMW-pagina noemt week 42 — navragen welke klopt"),
  nt("pd9", "Aanpak enquête + vragen", "Project Duurzaamheid", "3 nov, 08:30", "low", ""),
  nt("pd10", "Onderzoeksrapport (Fase 2)", "Project Duurzaamheid", "29 nov, 23:59", "low", "50% · herkansing 17 jan"),
  nt("pd11", "Advies (Fase 3)", "Project Duurzaamheid", "17 jan, 23:59", "low", "30% · herkansing 28 feb"),
  nt("pd12", "Eindassessment (individueel)", "Project Duurzaamheid", "week 24 jan (tbd)", "low", "bij opdrachtgever")
];

function mergeNotionSync(tasks) {
  var byId = {};
  tasks.forEach(function (t) { byId[t.id] = t; });
  var changed = false;
  NOTION_SYNC_DATA.forEach(function (n) {
    var existing = byId[n.id];
    if (!existing) {
      tasks.push({ id: n.id, category: "academic", title: n.title, subject: n.subject, deadline: n.deadline, priority: n.priority, status: "todo", note: n.note, doneAt: null, archivedAt: null });
      changed = true;
    } else if (existing.title !== n.title || existing.subject !== n.subject || existing.deadline !== n.deadline || existing.note !== n.note) {
      existing.title = n.title; existing.subject = n.subject; existing.deadline = n.deadline; existing.note = n.note;
      changed = true;
    }
  });
  return changed;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colDotColor(colId) {
  if (colId === "done") return "var(--done)";
  if (colId === "review") return "var(--low)";
  if (colId === "in_progress") return "var(--medium)";
  return "var(--muted-soft)";
}

function withAutoArchive(list) {
  var now = Date.now();
  return list.map(function (t) {
    if (t.status === "done" && t.doneAt && (now - t.doneAt) > ARCHIVE_AFTER_DAYS * DAY_MS) {
      return Object.assign({}, t, { status: "archived", archivedAt: t.archivedAt || now });
    }
    return t;
  });
}

// ---------- module state ----------
var container = null;
var notionAvailable = false;
var state = {
  tasks: [],
  category: "personal",
  subjectFilter: "all",
  showNewTask: false,
  showArchive: false,
  dragId: null
};

function persist() {
  saveArray(STORAGE_KEY, state.tasks);
  if (notionAvailable) {
    // Fire-and-forget: hele array overschrijven in Notion (zelfde JSON-blob
    // voor elk apparaat), zodat een wijziging hier ook op je andere
    // apparaat verschijnt zodra dat opnieuw laadt.
    fetch("/api/notion?target=kanban", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: state.tasks })
    }).catch(function () {});
  }
}

export async function init(rootEl) {
  container = rootEl;
  state.tasks = withAutoArchive(loadArray(STORAGE_KEY));
  if (mergeNotionSync(state.tasks)) saveArray(STORAGE_KEY, state.tasks);
  render();

  // Notion (via /api/notion?target=kanban) is de bron van waarheid zodra de
  // app op Vercel staat met NOTION_TOKEN gezet — lokaal (of zonder die env
  // var) blijft dit gewoon bij de localStorage-versie hierboven.
  try {
    var res = await fetch("/api/notion?target=kanban");
    if (res.ok) {
      var data = await res.json();
      var notionTasks = data.tasks || [];
      notionAvailable = true;
      if (notionTasks.length === 0 && state.tasks.length > 0) {
        // Eerste keer dat Notion-sync aanstaat op dit apparaat: Notion is
        // nog leeg, dus we duwen de huidige (lokale) voortgang omhoog i.p.v.
        // 'm te overschrijven met niks.
        persist();
      } else {
        state.tasks = withAutoArchive(notionTasks);
        if (mergeNotionSync(state.tasks)) persist();
        else saveArray(STORAGE_KEY, state.tasks);
      }
      render();
    }
  } catch (e) {
    // geen backend beschikbaar (bv. lokaal testen) — blijft bij de lokale versie
  }
}

function setState(patch) { Object.assign(state, patch); render(); }

function moveTask(id, newStatus) {
  var now = Date.now();
  state.tasks = state.tasks.map(function (t) {
    if (t.id !== id) return t;
    return Object.assign({}, t, {
      status: newStatus,
      doneAt: newStatus === "done" ? now : null,
      archivedAt: newStatus === "archived" ? now : null
    });
  });
  persist(); render();
}

function archiveAllDone() {
  state.tasks = state.tasks.map(function (t) {
    if (t.category === state.category && t.status === "done") {
      return Object.assign({}, t, { status: "archived", archivedAt: Date.now() });
    }
    return t;
  });
  persist(); render();
}

function restoreTask(id) {
  state.tasks = state.tasks.map(function (t) {
    if (t.id !== id) return t;
    return Object.assign({}, t, { status: "done", archivedAt: null, doneAt: Date.now() });
  });
  persist(); render();
}

function addTask(newTask) {
  state.tasks.push(Object.assign({}, newTask, { id: uid(), category: state.category, status: "todo", doneAt: null, archivedAt: null }));
  persist(); render();
}

// ---------- Render ----------
function render() {
  if (!container) return;
  var columns = COLUMNS_BY_CATEGORY[state.category];
  var categoryTasks = state.tasks.filter(function (t) { return t.category === state.category && t.status !== "archived"; });
  var archivedTasks = state.tasks.filter(function (t) { return t.category === state.category && t.status === "archived"; });
  var subjects = [];
  if (state.category === "academic") {
    var seen = {};
    categoryTasks.forEach(function (t) { if (t.subject && !seen[t.subject]) { seen[t.subject] = true; subjects.push(t.subject); } });
    subjects.sort();
  }
  var visibleTasks = (state.category === "academic" && state.subjectFilter !== "all")
    ? categoryTasks.filter(function (t) { return t.subject === state.subjectFilter; })
    : categoryTasks;
  var doneCount = categoryTasks.filter(function (t) { return t.status === "done"; }).length;

  function subjectCount(s) { return categoryTasks.filter(function (t) { return t.subject === s; }).length; }
  function subjectDoneCount(s) { return categoryTasks.filter(function (t) { return t.subject === s && t.status === "done"; }).length; }

  var html = "";

  html += '<div class="topbar">';
  html += '<div class="tabrow">';
  CATEGORIES.forEach(function (c) {
    html += '<div class="tab ' + (state.category === c.id ? "active" : "") + '" data-action="set-category" data-category="' + c.id + '">' + esc(c.label) + '</div>';
  });
  html += '</div>';
  html += '<div class="topbtns">';
  html += '<button class="archive-nav" data-action="open-archive">Archive' + (archivedTasks.length > 0 ? ' <span class="archive-badge">' + archivedTasks.length + '</span>' : '') + '</button>';
  html += '<button class="new-task-btn" data-action="open-newtask">+ New task</button>';
  html += '</div></div>';

  if (state.category === "academic") {
    html += '<div style="font-size:11px;color:var(--muted-soft);margin:-10px 0 14px;">Notion-sync: ' + esc(NOTION_LAST_SYNCED) + '</div>';
  }

  if (state.category === "academic" && subjects.length > 0) {
    html += '<div class="subject-strip">';
    html += '<div class="chip ' + (state.subjectFilter === "all" ? "active" : "") + '" data-action="set-subject" data-subject="all">All subjects <span class="chip-count">' + categoryTasks.length + '</span></div>';
    subjects.forEach(function (s) {
      html += '<div class="chip ' + (state.subjectFilter === s ? "active" : "") + '" data-action="set-subject" data-subject="' + esc(s) + '">' + esc(s) + ' <span class="chip-count">' + subjectDoneCount(s) + '/' + subjectCount(s) + '</span></div>';
    });
    html += '</div>';
  }

  var now = new Date();
  // Sorteert op deadline (eerst opkomende bovenaan) — over vakken/subjects
  // heen, want filteren op subject kan altijd nog via de chips hierboven.
  // Taken zonder herkenbare datum ("tbd") blijven onderaan, op oorspronkelijke
  // volgorde, i.p.v. een misleidende positie te krijgen.
  function sortByDeadline(list) {
    return list
      .map(function (t, i) { return { t: t, i: i, d: parseDeadline(t.deadline, now) }; })
      .sort(function (a, b) {
        if (a.d && b.d) return a.d - b.d;
        if (a.d && !b.d) return -1;
        if (!a.d && b.d) return 1;
        return a.i - b.i;
      })
      .map(function (x) { return x.t; });
  }

  html += '<div class="board">';
  columns.forEach(function (col) {
    var colTasks = sortByDeadline(visibleTasks.filter(function (t) { return t.status === col.id; }));
    html += '<div class="column" data-drop-status="' + col.id + '">';
    html += '<div class="col-header"><div style="display:flex;align-items:center;gap:8px;">';
    html += '<span class="col-dot" style="background:' + colDotColor(col.id) + '"></span>';
    html += '<span class="col-title">' + esc(col.label) + '</span>';
    html += '<span class="col-count">' + colTasks.length + '</span></div>';
    if (col.id === "done" && doneCount > 0) {
      html += '<button class="archive-col-btn" data-action="archive-all-done">Archive all</button>';
    }
    html += '</div>';
    html += '<div class="col-body">';
    if (colTasks.length === 0) { html += '<div class="empty-drop">Drop a task here</div>'; }
    colTasks.forEach(function (task) {
      var pr = PRIORITY_META[task.priority] || PRIORITY_META.low;
      html += '<div class="card" draggable="true" data-task-id="' + task.id + '">';
      html += '<div class="card-top">';
      html += task.subject ? '<span class="subject-tag">' + esc(task.subject) + '</span>' : '<span></span>';
      html += '<span class="priority-badge" style="color:var(--' + pr.cls + ');background:var(--' + pr.cls + '-soft)">' + pr.label + '</span>';
      html += '</div>';
      html += '<div class="card-title">' + esc(task.title) + '</div>';
      if (task.note) { html += '<div class="card-note">' + esc(task.note) + '</div>'; }
      html += '<div class="card-bottom"><span class="deadline">' + esc(task.deadline) + '</span>';
      html += '<select class="status-select" data-action="move-task" data-task-id="' + task.id + '">';
      columns.forEach(function (c) {
        html += '<option value="' + c.id + '" ' + (task.status === c.id ? "selected" : "") + '>' + esc(c.label) + '</option>';
      });
      html += '</select></div></div>';
    });
    html += '</div></div>';
  });
  html += '</div>';

  if (state.showNewTask) html += renderNewTaskModal(state.category, subjects);
  if (state.showArchive) html += renderArchiveModal(archivedTasks);

  container.innerHTML = html;
  attachEvents();
}

function renderNewTaskModal(category, subjects) {
  var subjOptions = "";
  subjects.forEach(function (s) { subjOptions += '<option value="' + esc(s) + '">' + esc(s) + '</option>'; });
  subjOptions += '<option value="__new__">+ New subject…</option>';

  var html = '<div class="modal-overlay" data-action="overlay-close" data-target="newtask">';
  html += '<div class="modal" onclick="event.stopPropagation()">';
  html += '<div class="modal-header"><span class="modal-title">New task</span><button class="close-btn" data-action="close-newtask">×</button></div>';
  html += '<label class="field-label">Title</label><input class="field" id="nt-title" placeholder="e.g. Excel-opdrachten afmaken" autofocus>';

  if (category === "academic") {
    html += '<label class="field-label">Subject</label><select class="field" id="nt-subject">' + subjOptions + '</select>';
    html += '<input class="field" id="nt-subject-custom" style="margin-top:8px;display:none;" placeholder="Subject name">';
  }
  if (category === "business") {
    html += '<label class="field-label">Client / project</label><input class="field" id="nt-subject-custom" placeholder="e.g. Jamal">';
  }

  html += '<label class="field-label">Deadline</label><input class="field" id="nt-deadline" placeholder="e.g. 20 sept, 23:59">';
  html += '<label class="field-label">Priority</label><select class="field" id="nt-priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select>';
  html += '<label class="field-label">Note (optional)</label><textarea class="field" id="nt-note" style="min-height:60px;resize:vertical;"></textarea>';
  html += '<button class="new-task-btn" id="nt-save" style="width:100%;margin-top:18px;justify-content:center;">Add task</button>';
  html += '</div></div>';
  return html;
}

function renderArchiveModal(archivedTasks) {
  var html = '<div class="modal-overlay" data-action="overlay-close" data-target="archive">';
  html += '<div class="modal wide" onclick="event.stopPropagation()">';
  html += '<div class="modal-header"><span class="modal-title">Archive</span><button class="close-btn" data-action="close-archive">×</button></div>';
  html += '<div class="modal-hint">Voltooide taken verhuizen hier automatisch na ' + ARCHIVE_AFTER_DAYS + ' dagen, of meteen via "Archive all" bij Done.</div>';
  if (archivedTasks.length === 0) {
    html += '<div class="empty-drop" style="padding:30px 10px;">Nog niets gearchiveerd</div>';
  }
  html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;">';
  archivedTasks.forEach(function (task) {
    html += '<div class="archive-row"><div style="min-width:0;">';
    if (task.subject) { html += '<div class="archive-subject">' + esc(task.subject) + '</div>'; }
    html += '<div class="archive-title">' + esc(task.title) + '</div></div>';
    html += '<button class="restore-btn" data-action="restore-task" data-task-id="' + task.id + '">Restore</button></div>';
  });
  html += '</div></div></div>';
  return html;
}

function attachEvents() {
  var app = container;

  app.querySelectorAll('[data-action="set-category"]').forEach(function (el) {
    el.addEventListener("click", function () {
      setState({ category: el.getAttribute("data-category"), subjectFilter: "all", showArchive: false });
    });
  });
  app.querySelectorAll('[data-action="set-subject"]').forEach(function (el) {
    el.addEventListener("click", function () { setState({ subjectFilter: el.getAttribute("data-subject") }); });
  });
  var archiveBtn = app.querySelector('[data-action="open-archive"]');
  if (archiveBtn) archiveBtn.addEventListener("click", function () { setState({ showArchive: true }); });
  var newTaskBtn = app.querySelector('[data-action="open-newtask"]');
  if (newTaskBtn) newTaskBtn.addEventListener("click", function () { setState({ showNewTask: true }); });
  var archiveAllBtn = app.querySelector('[data-action="archive-all-done"]');
  if (archiveAllBtn) archiveAllBtn.addEventListener("click", archiveAllDone);

  app.querySelectorAll('[data-action="move-task"]').forEach(function (el) {
    el.addEventListener("click", function (e) { e.stopPropagation(); });
    el.addEventListener("change", function () { moveTask(el.getAttribute("data-task-id"), el.value); });
  });

  app.querySelectorAll(".card").forEach(function (card) {
    card.addEventListener("dragstart", function () {
      state.dragId = card.getAttribute("data-task-id");
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
  });
  app.querySelectorAll(".column").forEach(function (col) {
    col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("dragover"); });
    col.addEventListener("dragleave", function () { col.classList.remove("dragover"); });
    col.addEventListener("drop", function (e) {
      e.preventDefault();
      col.classList.remove("dragover");
      if (state.dragId) { moveTask(state.dragId, col.getAttribute("data-drop-status")); }
      state.dragId = null;
    });
  });

  app.querySelectorAll('[data-action="overlay-close"]').forEach(function (el) {
    el.addEventListener("click", function () {
      var target = el.getAttribute("data-target");
      if (target === "newtask") setState({ showNewTask: false });
      if (target === "archive") setState({ showArchive: false });
    });
  });
  var closeNt = app.querySelector('[data-action="close-newtask"]');
  if (closeNt) closeNt.addEventListener("click", function () { setState({ showNewTask: false }); });
  var closeArc = app.querySelector('[data-action="close-archive"]');
  if (closeArc) closeArc.addEventListener("click", function () { setState({ showArchive: false }); });

  app.querySelectorAll('[data-action="restore-task"]').forEach(function (el) {
    el.addEventListener("click", function () { restoreTask(el.getAttribute("data-task-id")); });
  });

  var subjSelect = document.getElementById("nt-subject");
  var subjCustom = document.getElementById("nt-subject-custom");
  if (subjSelect && subjCustom) {
    subjSelect.addEventListener("change", function () {
      subjCustom.style.display = subjSelect.value === "__new__" ? "block" : "none";
    });
  }
  var saveBtn = document.getElementById("nt-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var title = (document.getElementById("nt-title").value || "").trim();
      if (!title) return;
      var subject = "";
      if (state.category === "academic") {
        var sel = document.getElementById("nt-subject");
        subject = sel && sel.value === "__new__" ? (document.getElementById("nt-subject-custom").value || "").trim() : (sel ? sel.value : "");
      } else if (state.category === "business") {
        var custom = document.getElementById("nt-subject-custom");
        subject = custom ? (custom.value || "").trim() : "";
      }
      var deadline = (document.getElementById("nt-deadline").value || "").trim();
      var priority = document.getElementById("nt-priority").value;
      var note = (document.getElementById("nt-note").value || "").trim();
      addTask({ title: title, subject: subject, deadline: deadline, priority: priority, note: note });
      setState({ showNewTask: false });
    });
  }
}
