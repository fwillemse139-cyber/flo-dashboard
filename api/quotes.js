// Vercel serverless function — haalt koersen op bij Twelve Data.
// Env var TWELVE_DATA_API_KEY moet gezet zijn in Vercel (Project Settings
// → Environment Variables). Nooit in de browser/frontend-code gebruiken.
//
// LET OP: de Xetra/Euronext-tickers hieronder zijn nog niet geverifieerd
// tegen Twelve Data's symbol-search endpoint — controleer per instrument
// het exacte symbool+beurs-suffix voordat je hierop vertrouwt.
var SYMBOL_MAP = {
  SEMI: { query: "SEMI:XETR", display_name: "iShares Semiconductor UCITS ETF" },
  IS3N: { query: "IS3N:XETR", display_name: "iShares Core MSCI EM IMI UCITS ETF (Acc)" },
  SNDK: { query: "SNDK", display_name: "SanDisk Corp" },
  VUAA: { query: "VUAA:XETR", display_name: "Vanguard S&P 500 UCITS ETF (Acc)" }
};

export default async function handler(req, res) {
  var apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "TWELVE_DATA_API_KEY ontbreekt in Vercel environment variables" });
    return;
  }

  var results = {};
  var errors = [];

  await Promise.all(Object.keys(SYMBOL_MAP).map(async function (ticker) {
    var cfg = SYMBOL_MAP[ticker];
    try {
      var r = await fetch("https://api.twelvedata.com/quote?symbol=" + encodeURIComponent(cfg.query) + "&apikey=" + apiKey);
      var data = await r.json();
      if (data.status === "error" || !data.close) {
        errors.push({ ticker: ticker, error: data.message || "no data" });
        return;
      }
      results[ticker] = {
        ticker: ticker,
        display_name: cfg.display_name,
        last_price: parseFloat(data.close),
        prev_close: parseFloat(data.previous_close),
        pct_change: parseFloat(data.percent_change),
        currency: data.currency || null,
        updated_at: new Date().toISOString()
      };
    } catch (err) {
      errors.push({ ticker: ticker, error: String(err) });
    }
  }));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).json({ quotes: results, errors: errors });
}
