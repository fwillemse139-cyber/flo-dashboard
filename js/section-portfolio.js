import { CASH_USD } from "./portfolioData.js";
import { computeState } from "./portfolioCore.js";

var container = null;
var data = null;        // { quotes, fx, updated_at }
var state = null;       // computeState(...)
var rangeDays = 0;      // 0 = alles
var allocMode = "sym";   // donut: sym | kind | ccy
var errorMsg = "";
var refreshTimer = null;
var resizeHandler = null;

var COLORS = ["#10b981", "#60a5fa", "#a78bfa", "#f59e0b", "#f472b6", "#22d3ee", "#fb7185", "#c084fc", "#fbbf24", "#94a3b8", "#34d399"];
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

var eurFmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
var qtyFmt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 4 });
var dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

function fmtEur(v) { return eurFmt.format(v); }
function fmtSigned(v) { return (v >= 0 ? "+" : "−") + eurFmt.format(Math.abs(v)); }
function fmtPct(v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "%"; }
function cls(v) { return v >= 0 ? "up" : "down"; }
function nativePrice(p) { return (p.ccy === "USD" ? "$" : "€") + new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.price); }

export function init(rootEl) {
  container = rootEl;
  if (refreshTimer) clearInterval(refreshTimer);
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  data = null; state = null; errorMsg = "";
  renderLoading();
  load(true);
  // koersen verversen elke 5 minuten; stoppen zodra de pagina niet meer in beeld is
  refreshTimer = setInterval(function () {
    if (!container || !container.isConnected) { clearInterval(refreshTimer); return; }
    load(false);
  }, 5 * 60 * 1000);
  resizeHandler = function () {
    if (!container || !container.isConnected) { window.removeEventListener("resize", resizeHandler); return; }
    if (state) drawChart(false);
  };
  window.addEventListener("resize", resizeHandler);
}

async function load(animate) {
  try {
    var res = await fetch("/api/portfolio");
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
    if (!data.fx || Object.keys(data.quotes).length === 0) throw new Error("geen koersen ontvangen");
    state = computeState(data.quotes, data.fx, Math.floor(Date.now() / 1000));
    errorMsg = "";
    render(animate);
  } catch (e) {
    if (!state) { errorMsg = "Kon de koersen niet laden (" + (e && e.message ? e.message : e) + "). Probeer het zo opnieuw."; renderError(); }
  }
}

function renderLoading() {
  container.innerHTML =
    '<div class="section-header"><h2>Portfolio</h2><div class="tagline">Koersen ophalen…</div></div>' +
    '<div class="pf-hero"><div class="pf-skel" style="width:40%;height:14px;"></div><div class="pf-skel" style="width:62%;height:40px;margin-top:14px;"></div><div class="pf-skel" style="width:100%;height:200px;margin-top:22px;"></div></div>';
}

function renderError() {
  container.innerHTML =
    '<div class="section-header"><h2>Portfolio</h2><div class="tagline">Live koersen</div></div>' +
    '<div class="home-card"><div class="empty-drop">' + errorMsg + '</div><button class="new-task-btn" id="pf-retry" style="margin:12px auto 0;">Opnieuw proberen</button></div>';
  var btn = container.querySelector("#pf-retry");
  if (btn) btn.addEventListener("click", function () { renderLoading(); load(true); });
}

function kindLabel(k) { return k === "Aandeel" ? "Aandelen" : k === "ETF" ? "ETF's" : "Edelmetaal"; }

// Groepeert de posities op positie / type / noteringsvaluta voor de donut.
function groupAlloc(mode) {
  var groups = {};
  state.positions.forEach(function (p) {
    var key = mode === "sym" ? p.sym : mode === "kind" ? kindLabel(p.kind) : p.ccy;
    if (!groups[key]) groups[key] = { key: key, label: mode === "sym" ? p.name : key, value: 0 };
    groups[key].value += p.valueEur;
  });
  var arr = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.value - a.value; });
  var total = arr.reduce(function (a, g) { return a + g.value; }, 0);
  arr.forEach(function (g) { g.pct = total > 0 ? g.value / total * 100 : 0; });
  return arr;
}

function donutPanelHtml() {
  var groups = groupAlloc(allocMode);
  var R = 54, C = 2 * Math.PI * R, off = 0, segs = "";
  groups.forEach(function (g, i) {
    var span = g.pct / 100 * C;
    var len = Math.max(span - (groups.length > 1 ? 2.5 : 0), 0.5);
    segs += '<circle class="pf-donut-seg" data-i="' + i + '" data-len="' + len.toFixed(2) + '" data-c="' + C.toFixed(2) + '" cx="70" cy="70" r="' + R + '" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="14" stroke-dasharray="0 ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" style="transition-delay:' + (i * 0.06).toFixed(2) + 's"/>';
    off += span;
  });
  var html = '<div class="pf-panel-head"><div class="home-card-title" style="margin:0">Verdeling</div><div class="pf-seg-toggle" id="pf-mode">';
  [["sym", "Positie"], ["kind", "Type"], ["ccy", "Valuta"]].forEach(function (m) {
    html += '<button data-mode="' + m[0] + '" class="' + (allocMode === m[0] ? "active" : "") + '">' + m[1] + '</button>';
  });
  html += '</div></div><div class="pf-donut-row"><div class="pf-donut-wrap"><svg viewBox="0 0 140 140" class="pf-donut"><g transform="rotate(-90 70 70)"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--border-soft)" stroke-width="14"/>' + segs + '</g></svg>';
  html += '<div class="pf-donut-center"><b>' + groups.length + '</b><span>' + (allocMode === "sym" ? "posities" : allocMode === "kind" ? "soorten" : "valuta’s") + '</span></div></div><div class="pf-donut-legend">';
  groups.forEach(function (g, i) {
    html += '<div class="pf-lrow" data-i="' + i + '"><i style="background:' + COLORS[i % COLORS.length] + '"></i><span class="pf-lname">' + (allocMode === "sym" ? g.key : g.label) + '</span><b>' + g.pct.toFixed(1).replace(".", ",") + '%</b><small>' + fmtEur(g.value) + '</small></div>';
  });
  return html + '</div></div>';
}

function bindDonut(animate) {
  var panel = container.querySelector("#pf-donut-panel");
  if (!panel) return;
  var segs = panel.querySelectorAll(".pf-donut-seg");
  function grow() {
    segs.forEach(function (s) {
      var len = parseFloat(s.getAttribute("data-len")), c = parseFloat(s.getAttribute("data-c"));
      s.setAttribute("stroke-dasharray", len + " " + (c - len));
    });
  }
  if (animate && !REDUCED) requestAnimationFrame(function () { requestAnimationFrame(grow); });
  else { segs.forEach(function (s) { s.style.transition = "none"; }); grow(); }
  panel.querySelectorAll(".pf-lrow").forEach(function (row) {
    row.addEventListener("mouseenter", function () {
      var i = row.getAttribute("data-i");
      segs.forEach(function (s) { s.style.opacity = s.getAttribute("data-i") === i ? "1" : ".22"; });
    });
    row.addEventListener("mouseleave", function () { segs.forEach(function (s) { s.style.opacity = "1"; }); });
  });
  panel.querySelectorAll("#pf-mode button").forEach(function (b) {
    b.addEventListener("click", function () {
      allocMode = b.getAttribute("data-mode");
      panel.innerHTML = donutPanelHtml();
      bindDonut(true);
    });
  });
}

// "Slimme inzichten": korte zinnen die uit Floris' eigen cijfers worden
// afgeleid (geen vaste tekst) — concentratie, uitschieters, dollar-blootstelling.
function insightsHtml() {
  var ps = state.positions, t = state.totals, items = [];
  if (ps.length) {
    var top = ps[0];
    items.push({ tone: top.weight > 40 ? "warn" : "info", text: "<b>" + top.sym + "</b> is " + top.weight.toFixed(0) + "% van je portfolio" + (top.weight > 40 ? " — veel gewicht op één positie." : ".") });
    var byPct = ps.slice().sort(function (a, b) { return b.plPct - a.plPct; });
    var best = byPct[0], worst = byPct[byPct.length - 1];
    items.push({ tone: best.plPct >= 0 ? "good" : "warn", text: "Sterkste positie: <b>" + best.sym + "</b> " + fmtPct(best.plPct) + "." });
    if (worst.sym !== best.sym) items.push({ tone: worst.plPct < 0 ? "bad" : "info", text: "Zwakste positie: <b>" + worst.sym + "</b> " + fmtPct(worst.plPct) + " (" + fmtSigned(worst.plEur) + ")." });
    var mover = ps.slice().sort(function (a, b) { return Math.abs(b.dayEur) - Math.abs(a.dayEur); })[0];
    if (Math.abs(mover.dayEur) >= 0.01) items.push({ tone: mover.dayEur >= 0 ? "good" : "bad", text: "Vandaag bewoog <b>" + mover.sym + "</b> het meest: " + fmtSigned(mover.dayEur) + "." });
    var usdShare = ps.filter(function (p) { return p.ccy === "USD"; }).reduce(function (a, p) { return a + p.valueEur; }, 0) / t.value * 100;
    if (usdShare > 0) items.push({ tone: "info", text: usdShare.toFixed(0) + "% van je portfolio staat in dollars — de EUR/USD-koers raakt dat direct." });
  }
  var cashEur = CASH_USD / (priceAtFx() || 1);
  if (cashEur > 5) items.push({ tone: "warn", text: "<b>" + fmtEur(cashEur) + "</b> cash staat nog niet belegd op je USD-rekening." });
  if (t.dividends > 0) items.push({ tone: "good", text: "Dividend ontvangen tot nu toe: <b>" + fmtEur(t.dividends) + "</b>." });
  var html = '<div class="home-card-title">Slimme inzichten</div><div class="pf-insights">';
  items.forEach(function (it, i) { html += '<div class="pf-insight ' + it.tone + '" style="--i:' + i + '"><i></i><span>' + it.text + '</span></div>'; });
  return html + "</div>";
}

function spark(values, w, h, tone, i) {
  if (!values || values.length < 2) return "";
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values), span = max - min || 1;
  var d = values.map(function (v, k) {
    return (k ? "L" : "M") + (k / (values.length - 1) * w).toFixed(1) + " " + (h - 2 - (v - min) / span * (h - 4)).toFixed(1);
  }).join("");
  return '<svg class="pf-spark ' + tone + '" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" style="--i:' + (i || 0) + '"><path d="' + d + '" pathLength="1"/></svg>';
}

function render(animate) {
  var t = state.totals;
  var upDown = cls(t.pl);
  var html = '<div class="pf-root' + (animate ? " pf-enter" : "") + '">';
  html += '<div class="section-header"><h2>Portfolio</h2><div class="tagline">Live waarde van je beleggingen in euro</div></div>';

  html += '<div class="pf-hero"><div class="pf-dots"></div>';
  html += '<div class="pf-hero-top"><div>';
  html += '<div class="pf-label">Totale waarde <span class="pf-live"><i></i>Live</span></div>';
  html += '<div class="pf-value" id="pf-value">' + fmtEur(t.value) + '</div>';
  html += '<div class="pf-sub"><span class="pf-chip ' + upDown + '">' + fmtSigned(t.pl) + ' · ' + fmtPct(t.plPct) + '</span><span class="pf-muted">totaal resultaat</span>';
  html += '<span class="pf-chip ' + cls(t.day) + '">' + fmtSigned(t.day) + ' · ' + fmtPct(t.dayPct) + '</span><span class="pf-muted">vandaag</span></div>';
  html += '</div><div class="pf-range" id="pf-range">';
  [["1M", 30], ["3M", 90], ["Alles", 0]].forEach(function (r) {
    html += '<button data-days="' + r[1] + '" class="' + (rangeDays === r[1] ? "active" : "") + '">' + r[0] + '</button>';
  });
  html += '</div></div>';
  html += '<div class="pf-chart" id="pf-chart"></div>';
  html += '<div class="pf-axis" id="pf-axis"></div>';
  html += '</div>';

  var cashEur = CASH_USD / (priceAtFx() || 1);
  var invSpark = spark(state.series.map(function (p) { return p.invested; }), 90, 26, "mute", 0);
  var plSpark = spark(state.series.map(function (p) { return p.value - p.invested; }), 90, 26, cls(t.pl), 1);
  html += '<div class="pf-stats">';
  [
    ["Netto ingelegd", fmtEur(t.invested), "", invSpark],
    ["Resultaat", fmtSigned(t.pl), cls(t.pl), plSpark],
    ["Dividend ontvangen", fmtEur(t.dividends), "", ""],
    ["Cash (niet belegd)", fmtEur(cashEur), "", ""]
  ].forEach(function (s, i) {
    html += '<div class="pf-stat" style="--i:' + i + '"><div class="pf-label">' + s[0] + '</div><div class="pf-stat-row"><div class="pf-stat-v ' + s[2] + '">' + s[1] + '</div>' + s[3] + '</div></div>';
  });
  html += '</div>';

  html += '<div class="pf-duo"><div class="home-card pf-panel" id="pf-donut-panel">' + donutPanelHtml() + '</div>';
  html += '<div class="home-card pf-panel">' + insightsHtml() + '</div></div>';

  var maxW = state.positions.length ? state.positions[0].weight : 1;
  html += '<div class="home-card pf-table"><div class="home-card-title">Posities</div>';
  html += '<div class="pf-row pf-head"><span>Instrument</span><span class="pf-hide-s">Aantal</span><span class="pf-hide-s">Gem. kosten</span><span class="pf-hide-s">Koers</span><span class="pf-hide-s">30 dagen</span><span>Waarde</span><span>Resultaat</span></div>';
  state.positions.forEach(function (p, i) {
    var hist = data.quotes[p.sym] ? data.quotes[p.sym].history.slice(-30).map(function (h) { return h[1]; }) : [];
    var tone = hist.length > 1 && hist[hist.length - 1] >= hist[0] ? "up" : "down";
    html += '<div class="pf-row" style="--i:' + i + '">';
    html += '<span class="pf-inst"><i style="background:' + COLORS[i % COLORS.length] + '"></i><span><b>' + p.sym + '</b><small>' + p.name + '</small><em class="pf-wbar"><u style="width:' + (p.weight / maxW * 100).toFixed(1) + '%;background:' + COLORS[i % COLORS.length] + '"></u></em></span></span>';
    html += '<span class="pf-hide-s">' + qtyFmt.format(p.qty) + '</span>';
    html += '<span class="pf-hide-s">' + fmtEur(p.avgCostEur) + '</span>';
    html += '<span class="pf-hide-s">' + nativePrice(p) + '</span>';
    html += '<span class="pf-hide-s">' + spark(hist, 76, 24, tone, i) + '</span>';
    html += '<span><b>' + fmtEur(p.valueEur) + '</b></span>';
    html += '<span class="' + cls(p.plEur) + '"><b>' + fmtSigned(p.plEur) + '</b><small>' + fmtPct(p.plPct) + '</small></span>';
    html += '</div>';
  });
  html += '</div>';

  var updated = data.updated_at ? new Date(data.updated_at) : null;
  html += '<div class="tagline" style="margin:14px 2px;">Koersen via Yahoo Finance, met enkele minuten vertraging' + (updated ? " · bijgewerkt om " + updated.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "") + '. Aankopen komen uit je Revolut-afschrift van 14 nov 2026; USD-posities zijn omgerekend met de EUR/USD-koers van de dag.</div>';
  html += '</div>';

  container.innerHTML = html;
  container.querySelectorAll("#pf-range button").forEach(function (b) {
    b.addEventListener("click", function () {
      rangeDays = parseInt(b.getAttribute("data-days"), 10);
      container.querySelectorAll("#pf-range button").forEach(function (x) { x.classList.toggle("active", x === b); });
      drawChart(true);
    });
  });
  drawChart(animate);
  bindDonut(animate);
  if (animate) countUp(container.querySelector("#pf-value"), t.value);
}

function priceAtFx() {
  var fx = data && data.fx;
  return fx && fx.length ? fx[fx.length - 1][1] : null;
}

function countUp(el, target) {
  if (!el || REDUCED) return;
  var start = performance.now(), dur = 1100;
  function frame(now) {
    var k = Math.min((now - start) / dur, 1);
    var eased = 1 - Math.pow(1 - k, 4);
    el.textContent = fmtEur(target * eased);
    if (k < 1) requestAnimationFrame(frame); else el.textContent = fmtEur(target);
  }
  requestAnimationFrame(frame);
}

// ---------- Grafiek (eigen SVG, geen library) ----------
function drawChart(animate) {
  var host = container && container.querySelector("#pf-chart");
  if (!host || !state) return;
  var series = state.series;
  if (rangeDays > 0) series = series.slice(-rangeDays);
  if (series.length < 2) { host.innerHTML = ""; return; }

  var w = host.clientWidth || 640, h = 230, padT = 14, padB = 10;
  var vals = [];
  series.forEach(function (p) { vals.push(p.value, p.invested); });
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  var span = max - min || 1;
  min -= span * 0.08; max += span * 0.08; span = max - min;
  function x(i) { return series.length === 1 ? 0 : i / (series.length - 1) * w; }
  function y(v) { return padT + (1 - (v - min) / span) * (h - padT - padB); }

  var line = "", invLine = "";
  series.forEach(function (p, i) {
    line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1);
    invLine += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.invested).toFixed(1);
  });
  var area = line + "L" + w + " " + h + "L0 " + h + "Z";
  var last = series[series.length - 1];
  var up = last.value >= last.invested;

  var grid = "";
  for (var g = 0; g < 4; g++) {
    var gy = padT + g / 3 * (h - padT - padB);
    grid += '<line x1="0" x2="' + w + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" class="pf-grid"/>';
  }

  host.className = "pf-chart " + (up ? "up" : "down") + (animate && !REDUCED ? " pf-draw" : "");
  host.innerHTML =
    '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '">' +
    '<defs><linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
    grid +
    '<path d="' + area + '" fill="url(#pf-area)" class="pf-area"/>' +
    '<path d="' + invLine + '" class="pf-inv"/>' +
    '<path d="' + line + '" class="pf-line" pathLength="1"/>' +
    '<line id="pf-cross" class="pf-cross" y1="0" y2="' + h + '" x1="0" x2="0"/>' +
    '<circle id="pf-dot" class="pf-dot" r="4.5" cx="0" cy="0"/>' +
    '</svg><div class="pf-tip" id="pf-tip"></div>';

  var axis = container.querySelector("#pf-axis");
  if (axis) axis.innerHTML = "<span>" + dateFmt.format(new Date(series[0].t * 1000)) + "</span><span>" + dateFmt.format(new Date(last.t * 1000)) + "</span>";

  var cross = host.querySelector("#pf-cross"), dot = host.querySelector("#pf-dot"), tip = host.querySelector("#pf-tip");
  function show(e) {
    var rect = host.getBoundingClientRect();
    var px = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    var i = Math.round(px / rect.width * (series.length - 1));
    var p = series[i];
    var cx = x(i), cy = y(p.value);
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
    host.classList.add("hover");
    var pl = p.value - p.invested;
    tip.innerHTML = '<div class="pf-tip-d">' + dateFmt.format(new Date(p.t * 1000)) + '</div><div class="pf-tip-v">' + fmtEur(p.value) + '</div><div class="pf-tip-s">ingelegd ' + fmtEur(p.invested) + ' · <span class="' + cls(pl) + '">' + fmtSigned(pl) + '</span></div>';
    var tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(cx - tw / 2, w - tw)) + "px";
  }
  host.onpointermove = show;
  host.onpointerdown = show;
  host.onpointerleave = function () { host.classList.remove("hover"); };
}
