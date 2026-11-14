// Portfolio-berekeningen — geen DOM, geen fetch. Alle bedragen in de
// uitkomst zijn in EUR; USD-posities worden omgerekend met de EUR/USD-koers
// van de dag (Yahoo "EURUSD=X" = hoeveel USD 1 EUR waard is).
import { HOLDINGS, TRADES, DIVIDENDS, FIRST_TRADE_DATE } from "./portfolioData.js";

var DAY = 86400;

function dateToSec(isoDate) { return Date.parse(isoDate + "T12:00:00Z") / 1000; }

// Laatste slotkoers op of vóór tSec (history is oplopend: [[ts, close], ...]).
export function priceAt(history, tSec) {
  if (!history || history.length === 0) return null;
  var best = null;
  for (var i = 0; i < history.length; i++) {
    if (history[i][0] <= tSec) best = history[i][1]; else break;
  }
  return best != null ? best : history[0][1];
}

function eurOf(amount, ccy, fx) { return ccy === "USD" ? amount / fx : amount; }

// quotes: { SYM: { price, prevClose, history } } (in de eigen valuta van het
// instrument), fxHistory: [[ts, usdPerEur], ...], nowSec: huidige tijd.
export function computeState(quotes, fxHistory, nowSec) {
  var fxNow = priceAt(fxHistory, nowSec + DAY) || 1;
  var lots = {}; // SYM -> { qty, costEur }
  var netInvested = 0, dividendsEur = 0;

  TRADES.forEach(function (t) {
    var sym = t[1], side = t[2], qty = t[3], price = t[4];
    var h = HOLDINGS[sym];
    var fx = priceAt(fxHistory, dateToSec(t[0]) + DAY / 2) || fxNow;
    var amountEur = eurOf(qty * price, h.ccy, fx);
    if (!lots[sym]) lots[sym] = { qty: 0, costEur: 0 };
    var lot = lots[sym];
    if (side === "buy") {
      lot.qty += qty; lot.costEur += amountEur; netInvested += amountEur;
    } else {
      // gemiddelde-kostprijs-methode: verkoop haalt een evenredig deel van de kostprijs weg
      var frac = lot.qty > 0 ? Math.min(qty / lot.qty, 1) : 0;
      lot.costEur -= lot.costEur * frac; lot.qty -= qty; netInvested -= amountEur;
    }
  });
  DIVIDENDS.forEach(function (d) {
    var fx = priceAt(fxHistory, dateToSec(d[0]) + DAY / 2) || fxNow;
    dividendsEur += d[2] / fx;
  });

  var positions = [];
  var totalValue = 0, totalDay = 0;
  Object.keys(lots).forEach(function (sym) {
    var lot = lots[sym];
    if (lot.qty < 1e-9) return;
    var h = HOLDINGS[sym], q = quotes[sym];
    if (!q) return;
    var priceEur = eurOf(q.price, h.ccy, fxNow);
    var valueEur = lot.qty * priceEur;
    var dayEur = lot.qty * eurOf(q.price - (q.prevClose != null ? q.prevClose : q.price), h.ccy, fxNow);
    totalValue += valueEur; totalDay += dayEur;
    positions.push({
      sym: sym, name: h.name, kind: h.kind, ccy: h.ccy,
      qty: lot.qty, costEur: lot.costEur, avgCostEur: lot.costEur / lot.qty,
      price: q.price, priceEur: priceEur, valueEur: valueEur,
      plEur: valueEur - lot.costEur, plPct: lot.costEur > 0 ? (valueEur - lot.costEur) / lot.costEur * 100 : 0,
      dayEur: dayEur
    });
  });
  positions.sort(function (a, b) { return b.valueEur - a.valueEur; });
  positions.forEach(function (p) { p.weight = totalValue > 0 ? p.valueEur / totalValue * 100 : 0; });

  var totalPl = totalValue - netInvested + dividendsEur;
  return {
    positions: positions,
    totals: {
      value: totalValue, invested: netInvested, dividends: dividendsEur,
      pl: totalPl, plPct: netInvested > 0 ? totalPl / netInvested * 100 : 0,
      day: totalDay, dayPct: totalValue - totalDay > 0 ? totalDay / (totalValue - totalDay) * 100 : 0
    },
    series: buildSeries(quotes, fxHistory, nowSec)
  };
}

// Eén punt per kalenderdag vanaf de eerste aankoop: waarde van de posities
// (met doorgetrokken slotkoersen in het weekend) en cumulatief ingelegd.
export function buildSeries(quotes, fxHistory, nowSec) {
  var start = dateToSec(FIRST_TRADE_DATE) - DAY / 2; // 00:00 UTC van de eerste handelsdag
  var out = [];
  for (var t = start; t <= nowSec; t += DAY) {
    var endOfDay = t + DAY - 1;
    var qty = {}, invested = 0;
    TRADES.forEach(function (tr) {
      if (dateToSec(tr[0]) > endOfDay) return;
      var h = HOLDINGS[tr[1]];
      var fx = priceAt(fxHistory, dateToSec(tr[0]) + DAY / 2) || 1;
      var amountEur = eurOf(tr[3] * tr[4], h.ccy, fx);
      qty[tr[1]] = (qty[tr[1]] || 0) + (tr[2] === "buy" ? tr[3] : -tr[3]);
      invested += tr[2] === "buy" ? amountEur : -amountEur;
    });
    var fxDay = priceAt(fxHistory, endOfDay) || 1;
    var value = 0;
    Object.keys(qty).forEach(function (sym) {
      if (qty[sym] < 1e-9) return;
      var q = quotes[sym];
      var p = q ? priceAt(q.history, endOfDay) : null;
      if (p != null) value += qty[sym] * eurOf(p, HOLDINGS[sym].ccy, fxDay);
    });
    out.push({ t: endOfDay, value: value, invested: invested });
  }
  return out;
}
