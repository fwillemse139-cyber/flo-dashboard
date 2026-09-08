import * as deadlines from "./section-deadlines.js";
import * as agenda from "./section-agenda.js";
import * as tasks from "./section-tasks.js";
import * as tools from "./section-tools.js";
import * as markets from "./section-markets.js";

var container = null;

export function init(rootEl) {
  container = rootEl;
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
    '</div>';

  deadlines.init(document.getElementById("home-w-deadlines"));
  agenda.init(document.getElementById("home-w-agenda"));
  tasks.init(document.getElementById("home-w-tasks"));
  markets.init(document.getElementById("home-w-markets"));
  tools.init(document.getElementById("home-w-tools"));
}
