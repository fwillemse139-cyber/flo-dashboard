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

export default async function handler(req, res) {
  var results = {};
  var errors = [];

  await Promise.all(Object.keys(SYMBOL_MAP).map(async function (ticker) {
    var cfg = SYMBOL_MAP[ticker];
    try {
      var r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(cfg.query), {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      var data = await r.json();
      var meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
      if (!meta || meta.regularMarketPrice == null) {
        errors.push({ ticker: ticker, error: (data.chart && data.chart.error && data.chart.error.description) || "no data" });
        return;
      }
      results[ticker] = {
        ticker: ticker,
        display_name: cfg.display_name,
        last_price: meta.regularMarketPrice,
        pct_change: meta.regularMarketChangePercent,
        currency: meta.currency || null,
        updated_at: new Date().toISOString()
      };
    } catch (err) {
      errors.push({ ticker: ticker, error: String(err) });
    }
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).json({ quotes: results, errors: errors });
}
