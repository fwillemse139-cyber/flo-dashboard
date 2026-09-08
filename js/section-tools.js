// Connected Tools — puur visueel paneel met snelkoppelingen, geen live
// data-koppeling. Pas deze lijst gewoon aan wanneer je tools toevoegt.
export var CONNECTED_TOOLS = [
  { name: "Notion", url: "https://notion.so", note: "Academic deadlines & planning" },
  { name: "Google Calendar", url: "https://calendar.google.com", note: "" },
  { name: "Gmail", url: "https://mail.google.com", note: "" }
];

var container = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function init(rootEl) {
  container = rootEl;
  render();
}

function render() {
  var html = '<div class="tools-grid">';
  CONNECTED_TOOLS.forEach(function (t) {
    html += '<a class="tool-card" href="' + esc(t.url) + '" target="_blank" rel="noopener">';
    html += '<div class="tool-name">' + esc(t.name) + '</div>';
    if (t.note) html += '<div class="tool-note">' + esc(t.note) + '</div>';
    html += '</a>';
  });
  html += '</div>';
  container.innerHTML = html;
}
