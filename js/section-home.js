import * as deadlines from "./section-deadlines.js";
import * as agenda from "./section-agenda.js";
import * as tasks from "./section-tasks.js";
import * as tools from "./section-tools.js";
import * as markets from "./section-markets.js";
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

function healthSummary() {
  var entries = loadArray("flo.health_log");
  var today = new Date().toISOString().slice(0, 10);
  var loggedToday = entries.some(function (e) { return e.date === today; });
  var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  var week = entries.filter(function (e) { return new Date(e.date).getTime() >= cutoff; });
  function avg(field) {
    var vals = week.map(function (e) { return e[field]; }).filter(function (v) { return v != null; });
    if (vals.length === 0) return "—";
    return (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1);
  }
  var html = '<div class="deadline">' + (loggedToday ? "Vandaag al gelogd" : "Nog niet gelogd vandaag") + '</div>';
  html += '<div class="home-line"><span>Gem. energie (week)</span><span class="deadline">' + avg("energy") + '</span></div>';
  html += '<div class="home-line"><span>Gem. productiviteit (week)</span><span class="deadline">' + avg("productivity") + '</span></div>';
  return html;
}

function suerteSummary() {
  var financial = { transactions: [], income: [] };
  try {
    var raw = localStorage.getItem("flo.suerte_financial");
    if (raw) financial = JSON.parse(raw);
  } catch (e) {}
  var clients = loadArray("flo.suerte_clients");
  var monthPrefix = new Date().toISOString().slice(0, 7);
  var txThisMonth = (financial.transactions || []).filter(function (t) { return (t.date || "").indexOf(monthPrefix) === 0; });
  var spend = txThisMonth.filter(function (t) { return t.amount < 0; }).reduce(function (a, t) { return a + Math.abs(t.amount); }, 0);
  var income = txThisMonth.concat(financial.income || []).filter(function (t) { return (t.amount || 0) > 0; }).reduce(function (a, t) { return a + t.amount; }, 0);
  var activeClients = clients.filter(function (c) { return c.status === "Actief"; }).length;
  var html = '<div class="home-line"><span>Uitgaven deze maand</span><span class="deadline">€' + spend.toFixed(2) + '</span></div>';
  html += '<div class="home-line"><span>Inkomsten deze maand</span><span class="deadline">€' + income.toFixed(2) + '</span></div>';
  html += '<div class="home-line"><span>Actieve clients</span><span class="deadline">' + activeClients + '</span></div>';
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
      '<div class="home-card"><div class="home-card-title">Agenda</div><div id="home-w-agenda"></div></div>' +
      '<div class="home-card"><div class="home-card-title">Tasks</div><div id="home-w-tasks"></div></div>' +
      '<div class="home-card home-card-wide"><div class="home-card-title">Markets</div><div id="home-w-markets"></div></div>' +
      '<div class="home-card home-card-wide"><div class="home-card-title">Connected Tools</div><div id="home-w-tools"></div></div>' +
      '<div class="home-card" data-nav="productivity" style="cursor:pointer;"><div class="home-card-title">Productivity System</div>' + productivitySummary() + '</div>' +
      '<div class="home-card" data-nav="health" style="cursor:pointer;"><div class="home-card-title">Health</div>' + healthSummary() + '</div>' +
      '<div class="home-card" data-nav="suerte" style="cursor:pointer;"><div class="home-card-title">Suerte</div>' + suerteSummary() + '</div>' +
      '<div class="home-card" data-nav="identity" style="cursor:pointer;"><div class="home-card-title">Identity</div>' + identitySummary() + '</div>' +
    '</div>';

  deadlines.init(document.getElementById("home-w-deadlines"));
  agenda.init(document.getElementById("home-w-agenda"));
  tasks.init(document.getElementById("home-w-tasks"));
  markets.init(document.getElementById("home-w-markets"));
  tools.init(document.getElementById("home-w-tools"));

  if (goTo) {
    container.querySelectorAll("[data-nav]").forEach(function (el) {
      el.addEventListener("click", function () { goTo(el.getAttribute("data-nav")); });
    });
  }
}
