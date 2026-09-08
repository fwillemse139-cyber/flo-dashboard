// Gedeelde, pure beursuren-logica — geen DOM, geen Supabase. Gebruikt door
// zowel section-markets.js (volledige weergave) als section-home.js
// (compacte samenvatting), zodat de tijd/timezone-berekening op precies
// één plek staat.
//
// Let op: de feestdagenlijsten zijn handmatig samengesteld voor 2026-2027
// en moeten jaarlijks nagekeken worden (met name de Pasen-afgeleide dagen
// bij Euronext Amsterdam schuiven elk jaar mee).
export var EXCHANGES = [
  {
    id: "us", label: "US (NYSE/NASDAQ)", timeZone: "America/New_York",
    open: { hour: 9, minute: 30 }, close: { hour: 16, minute: 0 },
    holidays: [
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
      "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
      "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
      "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"
    ]
  },
  {
    id: "nl", label: "Euronext Amsterdam", timeZone: "Europe/Amsterdam",
    open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 30 },
    holidays: [
      "2026-01-01", "2026-04-03", "2026-04-06", "2026-04-27", "2026-05-14",
      "2026-05-25", "2026-12-25",
      "2027-01-01", "2027-03-26", "2027-03-29", "2027-04-27", "2027-05-06",
      "2027-05-17", "2027-12-25"
    ]
  }
];

// Confirmed instruments (4 — geen 5e opgegeven).
export var TICKERS = [
  { ticker: "SEMI", display_name: "iShares Semiconductor UCITS ETF" },
  { ticker: "IS3N", display_name: "iShares Core MSCI EM IMI UCITS ETF (Acc)" },
  { ticker: "SNDK", display_name: "SanDisk Corp" },
  { ticker: "VUAA", display_name: "Vanguard S&P 500 UCITS ETF (Acc)" }
];

function getOffsetMinutes(timeZone, atDate) {
  var parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, timeZoneName: "shortOffset", hour: "2-digit" }).formatToParts(atDate);
  var tzPart = parts.find(function (p) { return p.type === "timeZoneName"; });
  var m = tzPart && tzPart.value.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 0;
  var hours = parseInt(m[1], 10);
  var mins = m[2] ? parseInt(m[2], 10) : 0;
  return hours * 60 + (hours < 0 ? -mins : mins);
}

function getZonedYMD(timeZone, atDate) {
  var parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(atDate);
  var y, m, d;
  parts.forEach(function (p) {
    if (p.type === "year") y = p.value;
    if (p.type === "month") m = p.value;
    if (p.type === "day") d = p.value;
  });
  return { y: parseInt(y, 10), m: parseInt(m, 10), d: parseInt(d, 10) };
}

function getZonedWeekday(timeZone, atDate) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timeZone, weekday: "short" }).format(atDate);
}

function zonedTimeToInstant(timeZone, y, m, d, hour, minute) {
  var guess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  var offset = getOffsetMinutes(timeZone, guess);
  var instant = new Date(guess.getTime() - offset * 60000);
  var offset2 = getOffsetMinutes(timeZone, instant);
  if (offset2 !== offset) instant = new Date(guess.getTime() - offset2 * 60000);
  return instant;
}

function ymdString(y, m, d) {
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function isTradingDay(exchange, y, m, d) {
  var weekday = getZonedWeekday(exchange.timeZone, new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (exchange.holidays.indexOf(ymdString(y, m, d)) !== -1) return false;
  return true;
}

// Geeft { status: 'open'|'closed', nextLabel, nextInstant } terug.
export function getMarketStatus(exchange, now) {
  var ymd = getZonedYMD(exchange.timeZone, now);
  if (isTradingDay(exchange, ymd.y, ymd.m, ymd.d)) {
    var openInstant = zonedTimeToInstant(exchange.timeZone, ymd.y, ymd.m, ymd.d, exchange.open.hour, exchange.open.minute);
    var closeInstant = zonedTimeToInstant(exchange.timeZone, ymd.y, ymd.m, ymd.d, exchange.close.hour, exchange.close.minute);
    if (now < openInstant) return { status: "closed", nextLabel: "opent over", nextInstant: openInstant };
    if (now < closeInstant) return { status: "open", nextLabel: "sluit over", nextInstant: closeInstant };
  }
  for (var i = 1; i <= 10; i++) {
    var probe = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + i, 12, 0, 0));
    var pYmd = getZonedYMD(exchange.timeZone, probe);
    if (isTradingDay(exchange, pYmd.y, pYmd.m, pYmd.d)) {
      var nextOpen = zonedTimeToInstant(exchange.timeZone, pYmd.y, pYmd.m, pYmd.d, exchange.open.hour, exchange.open.minute);
      return { status: "closed", nextLabel: "opent over", nextInstant: nextOpen };
    }
  }
  return { status: "closed", nextLabel: "onbekend", nextInstant: null };
}

export function formatCountdown(ms) {
  if (ms == null || ms < 0) return "—";
  var totalMin = Math.floor(ms / 60000);
  var days = Math.floor(totalMin / (60 * 24));
  var hours = Math.floor((totalMin % (60 * 24)) / 60);
  var mins = totalMin % 60;
  if (days > 0) return days + "d " + hours + "u " + mins + "m";
  return hours + "u " + mins + "m";
}
