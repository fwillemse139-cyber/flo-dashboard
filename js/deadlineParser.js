// Best-effort parser voor de vrije-tekst deadline-velden ("11 sept",
// "6 okt 2026, 23:59", "week 28 sept / 12 okt", "toetsweek Fase 1 (tbd)").
// Geeft een Date terug voor sortering op de Home-pagina, of null als er
// geen dag+maand in de tekst te vinden is (dan wordt de taak overgeslagen
// in de "aankomende deadlines"-widget i.p.v. een misleidende datum te tonen).
var MONTH_PREFIXES = [
  ["jan", 0], ["feb", 1], ["mrt", 2], ["maa", 2], ["apr", 3], ["mei", 4],
  ["jun", 5], ["jul", 6], ["aug", 7], ["sep", 8], ["okt", 9], ["nov", 10], ["dec", 11]
];

function findMonth(token) {
  token = token.toLowerCase();
  for (var i = 0; i < MONTH_PREFIXES.length; i++) {
    if (token.indexOf(MONTH_PREFIXES[i][0]) === 0) return MONTH_PREFIXES[i][1];
  }
  return -1;
}

// Geeft een Date terug, inclusief tijd als die in de tekst staat (bv.
// "23:59" of "08:30") — anders wordt eind van de dag (23:59) aangenomen,
// wat de gebruikelijke aanname is voor een deadline.
export function parseDeadline(text, now) {
  if (!text) return null;
  var m = text.match(/(\d{1,2})\s+([a-zA-Zé]+)(?:\s+(\d{4}))?/);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var month = findMonth(m[2]);
  if (month === -1 || day < 1 || day > 31) return null;
  var year = m[3] ? parseInt(m[3], 10) : now.getFullYear();

  var timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  var hour = timeMatch ? parseInt(timeMatch[1], 10) : 23;
  var minute = timeMatch ? parseInt(timeMatch[2], 10) : 59;

  var d = new Date(year, month, day, hour, minute);
  if (!m[3]) {
    var diffDays = (d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays < -60) d = new Date(year + 1, month, day, hour, minute);
  }
  return d;
}
