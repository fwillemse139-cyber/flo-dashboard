import { EXCHANGES, TICKERS, getMarketStatus, formatCountdown } from "./marketsCore.js";

var container = null;
var tickInterval = null;
var quotesByTicker = {};
var updatedAt = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Elke koers staat in zijn eigen, echte valuta (van Yahoo) — de UCITS
// ETF's + ASML zijn EUR (Xetra/Euronext), de losse Amerikaanse aandelen
// zijn USD, SK Hynix is KRW (geen "$"/"€" van maken, dat zou de prijs
// verkeerd voorstellen).
function formatPrice(price, currency) {
  if (currency === "EUR") return "€" + price.toFixed(2);
  if (currency === "USD") return "$" + price.toFixed(2);
  if (currency === "KRW") return "₩" + Math.round(price).toLocaleString("nl-NL");
  return price.toFixed(2) + (currency ? " " + currency : "");
}

export function init(rootEl) {
  container = rootEl;
  container.innerHTML =
    '<div id="mk-exchanges"></div>' +
    '<div id="mk-meta" class="tagline" style="margin:10px 0;"></div>' +
    '<div id="mk-tickers" class="markets-tickers"></div>';
  renderExchanges();
  renderMeta();
  renderTickers(false);
  refreshQuotes();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(renderExchanges, 1000);
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
    renderMeta();
    renderTickers(true);
  } catch (e) {
    // geen backend beschikbaar (bv. lokaal testen) — stil negeren
  }
}

function renderExchanges() {
  var el = container && container.querySelector("#mk-exchanges");
  if (!el) return;
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
  el.innerHTML = html;
}

function renderMeta() {
  var el = container && container.querySelector("#mk-meta");
  if (!el) return;
  var updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : null;
  el.textContent = (updatedLabel ? "Koersen bijgewerkt om " + updatedLabel + " · " : "") + "% = sinds vorige sluiting";
}

// Best presterende (hoogste %) bovenaan, slechtst presterende onderaan;
// tickers zonder koers (nog niet geladen / foutgegaan) blijven onderaan
// in hun oorspronkelijke volgorde staan i.p.v. door elkaar te springen.
function sortByPerformance() {
  var withData = [], withoutData = [];
  TICKERS.forEach(function (t) {
    var q = quotesByTicker[t.ticker];
    if (q && q.pct_change != null) withData.push(t); else withoutData.push(t);
  });
  withData.sort(function (a, b) { return quotesByTicker[b.ticker].pct_change - quotesByTicker[a.ticker].pct_change; });
  return withData.concat(withoutData);
}

// FLIP-animatie: positie vóór de herordening opslaan, nieuwe volgorde
// renderen, en dan van oud naar nieuw laten "glijden" i.p.v. abrupt te
// springen — zo blijft duidelijk zichtbaar wélke rij verplaatst is.
function renderTickers(animate) {
  var el = container && container.querySelector("#mk-tickers");
  if (!el) return;
  var order = sortByPerformance();

  var firstRects = {};
  if (animate) {
    el.querySelectorAll(".ticker-row").forEach(function (row) {
      firstRects[row.getAttribute("data-ticker")] = row.getBoundingClientRect();
    });
  }

  var html = "";
  order.forEach(function (t) {
    var q = quotesByTicker[t.ticker];
    var priceLabel = q && q.last_price != null ? formatPrice(q.last_price, q.currency) : "—";
    var pct = q && q.pct_change != null ? q.pct_change : null;
    var pctCls = pct == null ? "" : (pct >= 0 ? "pct-up" : "pct-down");
    var pctLabel = pct == null ? "—" : (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
    html += '<div class="ticker-row" data-ticker="' + esc(t.ticker) + '">';
    html += '<div><div class="ticker-symbol">' + esc(t.ticker) + '</div><div class="ticker-name">' + esc(t.display_name) + '</div></div>';
    html += '<div class="ticker-right"><div class="ticker-price">' + esc(priceLabel) + '</div>';
    html += '<div class="ticker-pct ' + pctCls + '">' + esc(pctLabel) + '</div></div>';
    html += '</div>';
  });
  el.innerHTML = html;

  if (!animate) return;
  el.querySelectorAll(".ticker-row").forEach(function (row) {
    var first = firstRects[row.getAttribute("data-ticker")];
    if (!first) return;
    var last = row.getBoundingClientRect();
    var deltaY = first.top - last.top;
    if (!deltaY) return;
    row.style.transition = "none";
    row.style.transform = "translateY(" + deltaY + "px)";
    row.getBoundingClientRect(); // forceer reflow zodat de volgende regel echt animeert
    row.style.transition = "transform 0.45s ease";
    row.style.transform = "";
    row.addEventListener("transitionend", function handler() {
      row.style.transition = "";
      row.removeEventListener("transitionend", handler);
    });
  });
}
