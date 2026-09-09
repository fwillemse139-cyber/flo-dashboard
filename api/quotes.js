// Vercel serverless function — haalt koersen op via Yahoo Finance's
// publieke (niet-officiële) chart-endpoint. Geen API-key nodig — dekt ook
// Xetra-genoteerde UCITS ETF's, in tegenstelling tot Twelve Data's gratis
// tier. Ticker-keys hier moeten exact overeenkomen met TICKERS in
// js/marketsCore.js. IS3N is eruit, 5 nieuwe instrumenten erbij (9 sept
// 2026, op verzoek van Floris) — nog niet stuk-voor-stuk live geverifieerd
// zoals de eerste 4 destijds, dus bij problemen hier eerst kijken.
//
// Elke koers komt terug in zijn eigen, echte valuta (`currency` hieronder,
// rechtstreeks van Yahoo) — behalve als `convertToUsd: true` staat (zie
// SK Hynix): die wordt via een live USD/KRW-koers omgerekend naar dollar
// (op verzoek van Floris). Was eerst geprobeerd met een geforceerde
// EUR+USD-omrekening voor ALLES, maar dat voelde rommelig aan — dus nu
// bewust per instrument, alleen waar Floris het expliciet wil.
var SYMBOL_MAP = {
  SEC0: { query: "SEC0.DE", display_name: "iShares MSCI Global Semiconductors UCITS ETF (Acc)" },
  SNDK: { query: "SNDK", display_name: "SanDisk Corp" },
  VUAA: { query: "VUAA.DE", display_name: "Vanguard S&P 500 UCITS ETF (Acc)" },
  HYNIX: { query: "000660.KS", display_name: "SK Hynix", convertToUsd: true },
  GOOGL: { query: "GOOGL", display_name: "Alphabet" },
  ASML: { query: "ASML.AS", display_name: "ASML" },
  MA: { query: "MA", display_name: "Mastercard" },
  V: { query: "V", display_name: "Visa" }
};

// FX-tickers voor `convertToUsd` — Yahoo's "X=X"-tickers geven steeds
// hoeveel van die valuta 1 USD waard is.
var FX_TICKERS = { KRW: "KRW=X" };

async function fetchYahooMeta(symbol) {
  var r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol), {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  var data = await r.json();
  return data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
}

export default async function handler(req, res) {
  var results = {};
  var errors = [];
  var usdRates = {}; // bv. usdRates.KRW = hoeveel KRW is 1 USD waard

  await Promise.all(Object.keys(FX_TICKERS).map(async function (currency) {
    try {
      var meta = await fetchYahooMeta(FX_TICKERS[currency]);
      if (meta && meta.regularMarketPrice != null) usdRates[currency] = meta.regularMarketPrice;
    } catch (e) {
      // geen koers beschikbaar — omrekenen lukt dan niet, origineel blijft staan
    }
  }));

  await Promise.all(Object.keys(SYMBOL_MAP).map(async function (ticker) {
    var cfg = SYMBOL_MAP[ticker];
    try {
      var meta = await fetchYahooMeta(cfg.query);
      if (!meta || meta.regularMarketPrice == null) {
        errors.push({ ticker: ticker, error: "no data" });
        return;
      }
      var price = meta.regularMarketPrice;
      var currency = meta.currency || null;
      if (cfg.convertToUsd && currency !== "USD" && usdRates[currency]) {
        price = price / usdRates[currency];
        currency = "USD";
      }
      results[ticker] = {
        ticker: ticker,
        display_name: cfg.display_name,
        last_price: price,
        // percentage-verandering is valuta-onafhankelijk, dus die blijft
        // gewoon staan ongeacht of hierboven is omgerekend
        pct_change: meta.regularMarketChangePercent,
        currency: currency
      };
    } catch (err) {
      errors.push({ ticker: ticker, error: String(err) });
    }
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).json({ quotes: results, errors: errors, updated_at: new Date().toISOString() });
}
