// Vercel serverless function — koersen + dagelijkse historie voor de
// Portfolio-pagina, via Yahoo Finance's publieke chart-endpoint (zelfde bron
// als api/quotes.js, geen API-key). De lijst met instrumenten komt uit
// js/portfolioData.js, dus er wordt nooit een willekeurig symbool opgevraagd.
import { HOLDINGS, FX_YAHOO, FIRST_TRADE_DATE } from "../js/portfolioData.js";

var DAY = 86400;

async function fetchChart(symbol, period1, period2) {
  var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?interval=1d&events=splits&period1=" + period1 + "&period2=" + period2;
  var r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  var data = await r.json();
  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.timestamp || result.meta.regularMarketPrice == null) return null;

  var closes = result.indicators.quote[0].close;
  var history = [];
  for (var i = 0; i < result.timestamp.length; i++) {
    if (closes[i] != null) history.push([result.timestamp[i], closes[i]]);
  }
  var live = result.meta.regularMarketPrice;
  var liveTime = result.meta.regularMarketTime;
  var liveDay = Math.floor(liveTime / DAY);

  // Slotkoers van de vorige handelsdag (voor "vandaag"-verschil) bepalen vóór
  // de laatste candle door de live koers wordt vervangen.
  var prevClose = null;
  for (var j = history.length - 1; j >= 0; j--) {
    if (Math.floor(history[j][0] / DAY) < liveDay) { prevClose = history[j][1]; break; }
  }
  if (history.length && Math.floor(history[history.length - 1][0] / DAY) === liveDay) {
    history[history.length - 1][1] = live;
  } else {
    history.push([liveTime, live]);
  }
  // Yahoo's historie is al gecorrigeerd voor splitsingen; de aankopen niet. Daarom
  // geven we de splitsingen mee zodat de client het aantal kan omrekenen.
  var splitEvents = (result.events && result.events.splits) || {};
  var splits = Object.keys(splitEvents).map(function (k) {
    var e = splitEvents[k];
    return { t: e.date, ratio: e.numerator / e.denominator };
  }).sort(function (a, b) { return a.t - b.t; });
  return { currency: result.meta.currency, price: live, prevClose: prevClose, history: history, splits: splits };
}

export default async function handler(req, res) {
  var now = Math.floor(Date.now() / 1000);
  // een paar dagen marge vóór de eerste aankoop, zodat doorgetrokken slotkoersen kloppen
  var period1 = Math.floor(Date.parse(FIRST_TRADE_DATE + "T00:00:00Z") / 1000) - 7 * DAY;
  var period2 = now + DAY;
  var quotes = {};
  var errors = [];

  var symbols = Object.keys(HOLDINGS);
  await Promise.all(symbols.map(async function (sym) {
    try {
      var q = await fetchChart(HOLDINGS[sym].yahoo, period1, period2);
      if (q) quotes[sym] = q; else errors.push({ symbol: sym, error: "no data" });
    } catch (e) {
      errors.push({ symbol: sym, error: String(e) });
    }
  }));

  var fx = null;
  try {
    var fxChart = await fetchChart(FX_YAHOO, period1, period2);
    fx = fxChart && fxChart.history;
  } catch (e) {
    errors.push({ symbol: FX_YAHOO, error: String(e) });
  }

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
  res.status(200).json({ quotes: quotes, fx: fx, errors: errors, updated_at: new Date().toISOString() });
}
