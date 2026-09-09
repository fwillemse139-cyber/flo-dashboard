// Vercel serverless function — haalt koersen op via Yahoo Finance's
// publieke (niet-officiële) chart-endpoint. Geen API-key nodig — dekt ook
// Xetra-genoteerde UCITS ETF's, in tegenstelling tot Twelve Data's gratis
// tier. Ticker-keys hier moeten exact overeenkomen met TICKERS in
// js/marketsCore.js. IS3N is eruit, 5 nieuwe instrumenten erbij (9 sept
// 2026, op verzoek van Floris) — nog niet stuk-voor-stuk live geverifieerd
// zoals de eerste 4 destijds, dus bij problemen hier eerst kijken.
var SYMBOL_MAP = {
  SEC0: { query: "SEC0.DE", display_name: "iShares MSCI Global Semiconductors UCITS ETF (Acc)" },
  SNDK: { query: "SNDK", display_name: "SanDisk Corp" },
  VUAA: { query: "VUAA.DE", display_name: "Vanguard S&P 500 UCITS ETF (Acc)" },
  HYNIX: { query: "000660.KS", display_name: "SK Hynix" },
  GOOGL: { query: "GOOGL", display_name: "Alphabet" },
  ASML: { query: "ASML.AS", display_name: "ASML" },
  MA: { query: "MA", display_name: "Mastercard" },
  V: { query: "V", display_name: "Visa" }
};

// Wisselkoersen (9 sept 2026, op verzoek van Floris: elke koers ook in
// EUR/USD tonen naast de eigen valuta). Yahoo's "X=X"-tickers geven steeds
// hoeveel van die valuta 1 USD waard is — dus USD is de spilvaluta waar
// alles doorheen omgerekend wordt.
var FX_TICKERS = { EUR: "EUR=X", KRW: "KRW=X" };

async function fetchYahoo(symbol) {
  var r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol), {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  var data = await r.json();
  var meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
  return meta;
}

function toUsd(price, currency, usdPerUnit) {
  if (currency === "USD") return price;
  var rate = usdPerUnit[currency]; // hoeveel <currency> is 1 USD waard
  if (!rate) return null;
  return price / rate;
}

function toEur(price, currency, usdPerUnit) {
  if (currency === "EUR") return price;
  var usd = toUsd(price, currency, usdPerUnit);
  if (usd == null) return null;
  var usdToEur = usdPerUnit.EUR; // 1 USD = zoveel EUR
  if (!usdToEur) return null;
  return usd * usdToEur;
}

export default async function handler(req, res) {
  var results = {};
  var errors = [];
  var usdPerUnit = {}; // bv. usdPerUnit.EUR = hoeveel EUR is 1 USD waard

  await Promise.all(Object.keys(FX_TICKERS).map(async function (currency) {
    try {
      var meta = await fetchYahoo(FX_TICKERS[currency]);
      if (meta && meta.regularMarketPrice != null) usdPerUnit[currency] = meta.regularMarketPrice;
    } catch (e) {
      // geen wisselkoers beschikbaar — omrekenen naar die valuta lukt dan niet, origineel blijft gewoon staan
    }
  }));

  await Promise.all(Object.keys(SYMBOL_MAP).map(async function (ticker) {
    var cfg = SYMBOL_MAP[ticker];
    try {
      var meta = await fetchYahoo(cfg.query);
      if (!meta || meta.regularMarketPrice == null) {
        errors.push({ ticker: ticker, error: "no data" });
        return;
      }
      var price = meta.regularMarketPrice;
      var currency = meta.currency || null;
      results[ticker] = {
        ticker: ticker,
        display_name: cfg.display_name,
        last_price: price,
        currency: currency,
        eur_price: currency ? toEur(price, currency, usdPerUnit) : null,
        usd_price: currency ? toUsd(price, currency, usdPerUnit) : null,
        pct_change: meta.regularMarketChangePercent,
        pct_change_since: "vorige sluiting"
      };
    } catch (err) {
      errors.push({ ticker: ticker, error: String(err) });
    }
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).json({ quotes: results, errors: errors, updated_at: new Date().toISOString() });
}
