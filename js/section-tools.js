// Connected Tools — puur visueel paneel met snelkoppelingen, geen live
// data-koppeling. Pas deze lijst gewoon aan wanneer je tools toevoegt.
export var CONNECTED_TOOLS = [
  {
    group: "Personal",
    items: [
      { name: "Notion", url: "https://notion.so", note: "Academic deadlines & planning" },
      { name: "Gmail", url: "https://mail.google.com", note: "" }
    ]
  },
  {
    group: "Academic",
    items: [
      { name: "Brightspace HHS", url: "https://brightspace.hhs.nl/", note: "" },
      { name: "Osiris HHS", url: "https://hhs.osiris-student.nl/", note: "" }
    ]
  },
  {
    group: "Suerte",
    items: [
      { name: "Base44", url: "https://base44.com", note: "" },
      { name: "Lovable", url: "https://lovable.dev", note: "" }
    ]
  }
];

var container = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function init(rootEl) {
  container = rootEl;
  render();
}

function render() {
  var html = "";
  CONNECTED_TOOLS.forEach(function (section) {
    html += '<div class="tools-group"><div class="tools-group-label">' + esc(section.group) + "</div>";
    html += '<div class="tools-grid">';
    section.items.forEach(function (t) {
      html += '<a class="tool-card" href="' + esc(t.url) + '" target="_blank" rel="noopener">';
      html += '<div class="tool-name">' + esc(t.name) + '</div>';
      if (t.note) html += '<div class="tool-note">' + esc(t.note) + '</div>';
      html += '</a>';
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}
