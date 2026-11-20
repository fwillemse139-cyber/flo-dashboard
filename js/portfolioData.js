// Floris' aankopen, overgenomen uit het Revolut-beleggingsafschrift van
// 14 nov 2026 (periode 13 apr – 14 nov 2026). Zuiver data, geen DOM — wordt
// ook door api/portfolio.js geïmporteerd. Nieuwe aankopen: een regel
// toevoegen aan TRADES ([datum, symbool, buy|sell, aantal, prijs in de
// eigen valuta van het instrument]).
export var HOLDINGS = {
  VUAA: { name: "Vanguard S&P 500 UCITS ETF", yahoo: "VUAA.DE", ccy: "EUR", kind: "ETF" },
  SEC0: { name: "iShares MSCI Global Semiconductors", yahoo: "SEC0.DE", ccy: "EUR", kind: "ETF" },
  QUTM: { name: "VanEck Quantum Computing ETF", yahoo: "QUTM.DE", ccy: "EUR", kind: "ETF" },
  PPFB: { name: "iShares Physical Gold ETC", yahoo: "PPFB.DE", ccy: "EUR", kind: "Goud" },
  PPFD: { name: "iShares Physical Silver ETC", yahoo: "PPFD.SG", ccy: "EUR", kind: "Zilver" },
  IS3N: { name: "iShares Core MSCI EM IMI", yahoo: "IS3N.DE", ccy: "EUR", kind: "ETF" },
  MA: { name: "Mastercard", yahoo: "MA", ccy: "USD", kind: "Aandeel" },
  V: { name: "Visa", yahoo: "V", ccy: "USD", kind: "Aandeel" },
  GOOGL: { name: "Alphabet", yahoo: "GOOGL", ccy: "USD", kind: "Aandeel" },
  ASML: { name: "ASML", yahoo: "ASML", ccy: "USD", kind: "Aandeel" },
  SNDK: { name: "SanDisk", yahoo: "SNDK", ccy: "USD", kind: "Aandeel" },
  SKHY: { name: "SK Hynix", yahoo: "SKHY", ccy: "USD", kind: "Aandeel" },
  ANT: { name: "Anthropic", yahoo: "ANT", ccy: "USD", kind: "Aandeel" }
};

export var FX_YAHOO = "EURUSD=X";

export var TRADES = [
  ["2026-05-15", "VUAA", "buy", 2.83941332, 123.26],
  ["2026-05-15", "SEC0", "buy", 9.09862913, 16.49],
  ["2026-06-23", "SEC0", "buy", 4.79861823, 20.84],
  ["2026-07-20", "VUAA", "sell", 2.83941332, 126.11],
  ["2026-09-04", "IS3N", "buy", 2.07043624, 48.30],
  ["2026-09-04", "VUAA", "buy", 0.5840894, 128.41],
  ["2026-09-04", "SNDK", "buy", 0.04419564, 1697],
  ["2026-09-04", "SNDK", "buy", 0.00706785, 1697.83],
  ["2026-09-08", "IS3N", "sell", 2.07043624, 48.47],
  ["2026-09-09", "VUAA", "buy", 0.67740157, 127],
  ["2026-09-09", "VUAA", "buy", 0.09662558, 126.99],
  ["2026-09-09", "ASML", "buy", 0.06678973, 1739.49],
  ["2026-09-09", "SKHY", "buy", 0.59615582, 194.58],
  ["2026-09-09", "GOOGL", "buy", 0.35104709, 330.44],
  ["2026-09-09", "V", "buy", 0.15741193, 368.46],
  ["2026-09-09", "MA", "buy", 0.1071736, 569.17],
  ["2026-09-14", "VUAA", "buy", 1.56423183, 127.94],
  ["2026-09-16", "PPFB", "buy", 1.37240101, 72.87],
  ["2026-09-16", "PPFD", "buy", 0.93758496, 53.33],
  ["2026-09-16", "MA", "buy", 0.10043392, 571.72],
  ["2026-09-16", "V", "buy", 0.15309038, 375.01],
  ["2026-10-05", "QUTM", "buy", 3.76293508, 26.58],
  ["2026-10-14", "SEC0", "buy", 4.17037366, 17.98],
  ["2026-10-14", "VUAA", "buy", 2.95781417, 135.24],
  ["2026-10-14", "PPFD", "buy", 1.03591088, 48.27],
  ["2026-10-14", "MA", "buy", 0.09137903, 605.50],
  ["2026-10-14", "GOOGL", "buy", 0.15574947, 355.25],
  ["2026-10-14", "V", "buy", 0.14010127, 395],
  ["2026-10-16", "SEC0", "buy", 3.00192122, 16.66],
  ["2026-10-30", "QUTM", "buy", 2.27066303, 22.02],
  ["2026-11-11", "SEC0", "buy", 6.42013353, 15.58],
  ["2026-11-11", "VUAA", "buy", 1.72153629, 131.62],
  // 1 ANT à $83, geen kosten (ISIN US03703U1079). Datum uit het afschrift van 20 nov: 19 nov 07:00 GMT.
  ["2026-11-19", "ANT", "buy", 1, 83]
];

// [datum, symbool, bedrag in USD]
export var DIVIDENDS = [
  ["2026-11-05", "ASML", 0.11],
  ["2026-11-10", "MA", 0.15]
];

// Niet-geïnvesteerde cash op de USD-beleggingsrekening, volgens het Revolut-afschrift van 20 nov
// 2026 ($275,79 op 14 nov minus de $83 voor ANT).
export var CASH_USD = 192.79;

export var FIRST_TRADE_DATE = TRADES[0][0];
