// Vercel serverless function — haalt Floris' publieke iCloud-agenda (.ics
// feed) server-side op en geeft 'm als simpele JSON-lijst terug. Server-side
// nodig omdat Apple's iCloud-servers meestal geen CORS-headers meesturen,
// waardoor de browser de feed niet direct mag lezen.
//
// Eenmalige setup (Floris): in Apple Agenda (Mac) of via icloud.com/calendar
// → agenda delen → "Openbare agenda" aanzetten → kopieer de link (begint
// met webcal://) en zet 'm als env var APPLE_CALENDAR_ICS_URL in Vercel
// (webcal:// vervangen door https://).

function unfoldLines(text) {
  // ICS-continuering: een regel die begint met een spatie hoort bij de vorige regel.
  return text.replace(/\r\n/g, "\n").split("\n").reduce(function (lines, line) {
    if (line.startsWith(" ") && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
    return lines;
  }, []);
}

function parseIcsDate(value) {
  // "20260915" (hele dag) of "20260915T093000Z" / "20260915T093000"
  if (/^\d{8}$/.test(value)) {
    return { date: new Date(value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8)), allDay: true };
  }
  var m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return { date: null, allDay: false };
  var iso = m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + (m[7] ? "Z" : "");
  return { date: new Date(iso), allDay: false };
}

function parseIcs(text) {
  var lines = unfoldLines(text);
  var events = [];
  var current = null;
  lines.forEach(function (line) {
    if (line === "BEGIN:VEVENT") { current = {}; return; }
    if (line === "END:VEVENT") { if (current) events.push(current); current = null; return; }
    if (!current) return;
    var idx = line.indexOf(":");
    if (idx === -1) return;
    var key = line.slice(0, idx).split(";")[0];
    var value = line.slice(idx + 1);
    if (key === "SUMMARY") current.title = value;
    if (key === "DTSTART") { var d = parseIcsDate(value); current.start = d.date; current.allDay = d.allDay; }
    if (key === "DTEND") { current.end = parseIcsDate(value).date; }
  });
  return events;
}

export default async function handler(req, res) {
  var icsUrl = process.env.APPLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    res.status(500).json({ error: "APPLE_CALENDAR_ICS_URL ontbreekt in Vercel environment variables" });
    return;
  }
  try {
    var r = await fetch(icsUrl);
    var text = await r.text();
    var events = parseIcs(text)
      .filter(function (e) { return e.title && e.start; })
      .map(function (e) {
        return { title: e.title, startsAt: e.start.toISOString(), allDay: !!e.allDay };
      });
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
    res.status(200).json({ events: events });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
