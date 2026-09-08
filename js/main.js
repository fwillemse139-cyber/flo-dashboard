import { isDismissed, dismiss, runMigration } from "./migrateLegacy.js";
import * as home from "./section-home.js";
import * as productivity from "./section-productivity.js";

var NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "productivity", label: "Productivity System" }
];

var appEl = document.getElementById("app");
var currentSection = "home";

renderShell();

function renderShell() {
  var showMigration = !isDismissed();
  appEl.innerHTML =
    '<div class="app-shell">' +
    '<nav class="side-nav">' +
    '<div class="brand"><div class="logo">F</div><div><div class="wordmark">Flo\'s Dashboard</div><div class="tagline">Life dashboard</div></div></div>' +
    '<div class="nav-list">' +
    NAV_ITEMS.map(function (item) {
      return '<div class="nav-item ' + (item.id === currentSection ? "active" : "") + '" data-section="' + item.id + '">' + item.label + "</div>";
    }).join("") +
    "</div>" +
    "</nav>" +
    '<main class="main-content">' +
    (showMigration ? renderMigrationBanner() : "") +
    '<div id="section-content"></div>' +
    "</main>" +
    "</div>";

  appEl.querySelectorAll("[data-section]").forEach(function (el) {
    el.addEventListener("click", function () {
      currentSection = el.getAttribute("data-section");
      renderShell();
    });
  });

  if (showMigration) attachMigrationEvents();
  mountSection(currentSection);
}

function renderMigrationBanner() {
  return (
    '<div class="migration-banner">' +
    '<div><strong>Oude taken overzetten?</strong> Open het oude flo-dashboard.html-bestand, klik daar op "Export data", plak de JSON hieronder.</div>' +
    '<textarea class="field" id="migration-input" style="min-height:80px;font-family:monospace;font-size:11px;margin-top:8px;" placeholder="Plak hier de geëxporteerde JSON…"></textarea>' +
    '<div style="display:flex;gap:10px;margin-top:8px;">' +
    '<button class="new-task-btn" id="migration-run">Importeren</button>' +
    '<button class="archive-nav" id="migration-skip">Niet meer tonen</button>' +
    "</div>" +
    '<div id="migration-status" style="font-size:11.5px;color:var(--muted);margin-top:8px;"></div>' +
    "</div>"
  );
}

function attachMigrationEvents() {
  var skipBtn = document.getElementById("migration-skip");
  if (skipBtn) skipBtn.addEventListener("click", function () { dismiss(); renderShell(); });

  var runBtn = document.getElementById("migration-run");
  if (runBtn) {
    runBtn.addEventListener("click", function () {
      var input = document.getElementById("migration-input");
      var statusEl = document.getElementById("migration-status");
      var text = (input.value || "").trim();
      if (!text) return;
      runBtn.disabled = true;
      try {
        var result = runMigration(text);
        statusEl.textContent = result.imported + " taken geïmporteerd, " + result.updated + " bijgewerkt.";
        setTimeout(function () { renderShell(); }, 1200);
      } catch (err) {
        statusEl.textContent = err.message || "Import mislukt.";
        runBtn.disabled = false;
      }
    });
  }
}

function mountSection(id) {
  var contentEl = document.getElementById("section-content");
  try {
    if (id === "home") home.init(contentEl);
    else if (id === "productivity") productivity.init(contentEl);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    contentEl.innerHTML = '<div class="empty-drop" style="padding:40px 20px;">Kon deze sectie niet laden: ' + msg + '</div>';
  }
}
