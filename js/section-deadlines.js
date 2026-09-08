import { loadArray } from "./store.js";
import { parseDeadline } from "./deadlineParser.js";

var URGENT_MS = 3 * 24 * 60 * 60 * 1000; // binnen 3 dagen = rode aftelling
var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
var container = null;
var tickInterval = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatCountdown(ms) {
  if (ms <= 0) return "verlopen";
  var totalHours = Math.floor(ms / (60 * 60 * 1000));
  var days = Math.floor(totalHours / 24);
  var hours = totalHours % 24;
  if (days > 0) return days + "d " + hours + "u";
  var minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  return hours + "u " + minutes + "m";
}

// Top 5 openstaande taken (alle categorieën) met een leesbare deadline,
// gesorteerd op datum (eerst opkomende bovenaan) — zo zie je bij het
// openen van het dashboard meteen wat het eerst moet. Taken binnen 3 dagen
// krijgen een rode dag/uur-aftelling i.p.v. alleen een datum. Taken met
// een onduidelijke deadline ("tbd", "Fase 2, week 4-5") worden overgeslagen
// i.p.v. een misleidende volgorde te tonen.
export function init(rootEl) {
  container = rootEl;
  render();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(render, 60000);
}

function render() {
  if (!container) return;
  var now = new Date();
  var tasks = loadArray("flo.kanban_tasks").filter(function (t) {
    return t.status !== "done" && t.status !== "archived";
  });

  var withDates = tasks.map(function (t) {
    return { task: t, date: parseDeadline(t.deadline, now) };
  }).filter(function (x) { return x.date; });

  withDates.sort(function (a, b) { return a.date - b.date; });

  var weekCount = withDates.filter(function (x) {
    var diff = x.date.getTime() - now.getTime();
    return diff >= 0 && diff <= WEEK_MS;
  }).length;

  var top5 = withDates.slice(0, 5);

  var html = '<div class="deadlines-week-stat">' + weekCount + ' taken voor de aankomende week</div>';

  if (top5.length === 0) {
    html += '<div class="empty-drop">Geen aankomende deadlines met een duidelijke datum</div>';
  } else {
    top5.forEach(function (x) {
      var diff = x.date.getTime() - now.getTime();
      var urgent = diff <= URGENT_MS;
      var dateLabel = urgent
        ? formatCountdown(diff)
        : x.date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      html += '<div class="home-line"><span>' + esc(x.task.title) + (x.task.subject ? ' <span class="tagline" style="display:inline;">· ' + esc(x.task.subject) + '</span>' : '') + '</span><span class="deadline' + (urgent ? " deadline-urgent" : "") + '">' + esc(dateLabel) + '</span></div>';
    });
  }
  container.innerHTML = html;
}
