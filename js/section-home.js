import * as deadlines from "./section-deadlines.js";
import * as tasks from "./section-tasks.js";
import * as tools from "./section-tools.js";
import * as markets from "./section-markets.js";
import * as worksession from "./section-worksession.js";
import * as healthQuicklog from "./section-health-quicklog.js";
import { loadArray } from "./store.js";

var container = null;
var goTo = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function productivitySummary() {
  var allTasks = loadArray("flo.kanban_tasks");
  var open = allTasks.filter(function (t) { return t.status !== "done" && t.status !== "archived"; });
  var categories = ["personal", "academic", "business"];
  var labels = { personal: "Personal", academic: "Academic", business: "Business" };
  var html = '<div class="deadline">' + open.length + ' openstaande taken</div>';
  categories.forEach(function (c) {
    var count = open.filter(function (t) { return t.category === c; }).length;
    html += '<div class="home-line"><span>' + labels[c] + '</span><span class="deadline">' + count + '</span></div>';
  });
  return html;
}

function identitySummary() {
  var state = { statement: "", traits: [], evidence: [], goals: [] };
  try {
    var raw = localStorage.getItem("flo.identity");
    if (raw) state = JSON.parse(raw);
  } catch (e) {}
  var goals = state.goals || [];
  var done = goals.filter(function (g) { return g.done; }).length;
  var recentEvidence = (state.evidence || [])[0];
  var html = '<div class="deadline">' + done + ' van ' + goals.length + ' doelen behaald</div>';
  html += '<div class="home-line"><span>Eigenschappen bijgehouden</span><span class="deadline">' + (state.traits || []).length + '</span></div>';
  if (recentEvidence) {
    html += '<div class="home-line"><span>Laatste bewijs</span><span class="deadline">' + esc(recentEvidence.date) + '</span></div>';
  }
  return html;
}

export function init(rootEl, navigateTo) {
  container = rootEl;
  goTo = navigateTo;
  var now = new Date();
  var hour = now.getHours();
  var greeting = hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";

  container.innerHTML =
    '<div class="section-header"><h2>' + greeting + ', Flo</h2><div class="tagline">Home</div></div>' +
    '<div class="home-grid">' +
      '<div class="home-card"><div class="home-card-title">Deadlines</div><div id="home-w-deadlines"></div></div>' +
      '<div class="home-card"><div class="home-card-title">Health check-in</div><div id="home-w-healthlog"></div></div>' +
      '<div class="home-card"><div class="home-card-title">Tasks</div><div id="home-w-tasks"></div></div>' +
      '<div class="home-card"><div class="home-card-title">Werksessie</div><div id="home-w-worksession"></div></div>' +
      '<div class="home-card home-card-wide"><div class="home-card-title">Markets</div><div id="home-w-markets"></div></div>' +
      '<div class="home-card home-card-wide"><div class="home-card-title">Connected Tools</div><div id="home-w-tools"></div></div>' +
      '<div class="home-card" data-nav="productivity" style="cursor:pointer;"><div class="home-card-title">Productivity System</div>' + productivitySummary() + '</div>' +
      '<div class="home-card" data-nav="identity" style="cursor:pointer;"><div class="home-card-title">Identity</div>' + identitySummary() + '</div>' +
    '</div>';

  deadlines.init(document.getElementById("home-w-deadlines"));
  healthQuicklog.init(document.getElementById("home-w-healthlog"));
  tasks.init(document.getElementById("home-w-tasks"));
  worksession.init(document.getElementById("home-w-worksession"));
  markets.init(document.getElementById("home-w-markets"));
  tools.init(document.getElementById("home-w-tools"));

  if (goTo) {
    container.querySelectorAll("[data-nav]").forEach(function (el) {
      el.addEventListener("click", function () { goTo(el.getAttribute("data-nav")); });
    });
  }
}
