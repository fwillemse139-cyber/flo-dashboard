import { EXCHANGES, TICKERS, getMarketStatus, formatCountdown } from "./marketsCore.js";

var container = null;
var tickInterval = null;
var quotesByTicker = {};
var updatedAt = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function init(rootEl) {
  container = rootEl;
  render();
  refreshQuotes();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(render, 1000);
}

// /api/quotes bestaat alleen op Vercel (serverless function) — lokaal
// draaien zonder Vercel geeft gewoon een 404, dan blijven de "—"
// placeholders staan (geen harde fout).
async function refreshQuotes() {
  try {
    var res = await fetch("/api/quotes");
    if (!res.ok) return;
    var data = await res.json();
    quotesByTicker = data.quotes || {};
    updatedAt = data.updated_at || null;
    render();
  } catch (e) {
    // geen backend beschikbaar (bv. lokaal testen) — stil negeren
  }
}

function render() {
  if (!container) return;
  var now = new Date();
  var html = '<div class="markets-exchanges">';
  EXCHANGES.forEach(function (ex) {
    var s = getMarketStatus(ex, now);
    var countdown = s.nextInstant ? formatCountdown(s.nextInstant.getTime() - now.getTime()) : "—";
    html += '<div class="market-exchange-card">';
    html += '<div class="market-exchange-name">' + esc(ex.label) + '</div>';
    html += '<div class="market-exchange-status ' + (s.status === "open" ? "open" : "closed") + '">' + (s.status === "open" ? "Open" : "Dicht") + '</div>';
    html += '<div class="market-exchange-countdown">' + esc(s.nextLabel) + ' ' + esc(countdown) + '</div>';
    html += '</div>';
  });
  html += '</div>';

  var updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
  html += '<div class="tagline" style="margin:10px 0;">';
  html += updatedLabel ? "Koersen bijgewerkt om " + esc(updatedLabel) + " · " : "";
  html += "% = sinds vorige sluiting";
  html += "</div>";

  html += '<div class="markets-tickers">';
  TICKERS.forEach(function (t) {
    var q = quotesByTicker[t.ticker];
    var eurLabel = q && q.eur_price != null ? "€" + q.eur_price.toFixed(2) : null;
    var usdLabel = q && q.usd_price != null ? "$" + q.usd_price.toFixed(2) : null;
    var priceLabel = eurLabel || usdLabel ? [eurLabel, usdLabel].filter(function (x) { return x; }).join(" · ") : (q && q.last_price != null ? q.last_price.toFixed(2) + (q.currency ? " " + q.currency : "") : "—");
    var pct = q && q.pct_change != null ? q.pct_change : null;
    var pctCls = pct == null ? "" : (pct >= 0 ? "pct-up" : "pct-down");
    var pctLabel = pct == null ? "—" : (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
    html += '<div class="ticker-row">';
    html += '<div><div class="ticker-symbol">' + esc(t.ticker) + '</div><div class="ticker-name">' + esc(t.display_name) + '</div></div>';
    html += '<div class="ticker-right"><div class="ticker-price">' + esc(priceLabel) + '</div>';
    html += '<div class="ticker-pct ' + pctCls + '">' + esc(pctLabel) + '</div></div>';
    html += '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}
