// Kleine gedeelde staafdiagram-renderer (horizontale bars), gebruikt door
// Suerte (financieel) en Health (energie/productiviteit/werktijd per maand).
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderBars(rows, valueKey, labelKey, opts) {
  opts = opts || {};
  if (!rows || rows.length === 0) return '<div class="empty-drop">Nog geen data</div>';
  var limit = opts.limit || 8;
  var shown = rows.slice(0, limit);
  var max = opts.max != null ? opts.max : Math.max.apply(null, shown.map(function (r) { return r[valueKey]; }).concat([0]));
  var fmt = opts.format || function (v) { return String(v); };
  var color = opts.color;
  var html = "";
  shown.forEach(function (r) {
    var pct = max > 0 ? Math.max((r[valueKey] / max) * 100, r[valueKey] > 0 ? 2 : 0) : 0;
    html += '<div class="bar-row"><div class="bar-label">' + esc(r[labelKey]) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%' + (color ? ";background:" + color : "") + '"></div></div><div class="bar-value">' + fmt(r[valueKey]) + "</div></div>";
  });
  return html;
}
