// Vercel serverless function — draait dagelijks via Vercel Cron (zie
// vercel.json's "crons") en stuurt een e-mail (via Resend) als er een
// openstaande Productivity System-taak is met een deadline die precies
// over 1 of 2 dagen valt. Mag ook gewoon los aangeroepen worden (GET) om
// te testen — is idempotent per dag dankzij de dedup-log hieronder.
//
// Eenmalige setup (Floris):
//   1. Maak een gratis account op https://resend.com met hetzelfde
//      e-mailadres waar je de herinneringen op wil ontvangen (in de
//      gratis/test-modus mag je zonder een eigen domein te verifiëren
//      alleen naar je eigen Resend-account-e-mailadres mailen — precies
//      wat we hier nodig hebben).
//   2. Maak een API-key aan (Resend-dashboard → API Keys) en zet 'm als
//      env var RESEND_API_KEY in Vercel, zelfde plek als NOTION_TOKEN.
//   3. Optioneel: zet REMINDER_EMAIL in Vercel als het ontvangende adres
//      een ander adres moet zijn dan fwillemse139@gmail.com.
import { loadBlob, saveBlob, BLOB_PAGE_IDS } from "./notion.js";
import { parseDeadline } from "../js/deadlineParser.js";

var RESEND_API_URL = "https://api.resend.com/emails";
var FROM_ADDRESS = "Flo's Dashboard <onboarding@resend.dev>";
var MAX_SENT_LOG = 300; // voorkomt dat de dedup-lijst onbeperkt groeit

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Kalenderdagen-verschil (niet ruwe uren/1440), zodat het niet uitmaakt op
// welk tijdstip de cron precies draait — "over 2 dagen" blijft "over 2
// dagen" ongeacht of het nu 07:00 of 09:00 is.
function daysUntil(deadline, now) {
  return Math.round((dateOnly(deadline) - dateOnly(now)) / (24 * 60 * 60 * 1000));
}

function renderEmailHtml(toSend) {
  function taskLine(t) {
    return "<li><strong>" + esc(t.title) + "</strong>" + (t.subject ? " · " + esc(t.subject) : "") + " — " + esc(t.deadline || "") + "</li>";
  }
  var oneDay = toSend.filter(function (x) { return x.diff === 1; });
  var twoDay = toSend.filter(function (x) { return x.diff === 2; });
  var html = "<div style=\"font-family:sans-serif;color:#111;\">";
  if (oneDay.length) {
    html += "<h3>Morgen</h3><ul>" + oneDay.map(function (x) { return taskLine(x.task); }).join("") + "</ul>";
  }
  if (twoDay.length) {
    html += "<h3>Over 2 dagen</h3><ul>" + twoDay.map(function (x) { return taskLine(x.task); }).join("") + "</ul>";
  }
  html += "<p style=\"color:#888;font-size:12px;\">Automatisch verzonden vanuit Flo's Dashboard.</p></div>";
  return html;
}

async function sendEmail(apiKey, toAddress, toSend) {
  var subject = toSend.length === 1
    ? "Deadline: " + toSend[0].task.title
    : "Deadline-herinnering (" + toSend.length + ")";
  var res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [toAddress], subject: subject, html: renderEmailHtml(toSend) })
  });
  var data = await res.json();
  if (!res.ok) throw new Error((data && data.message) || "Resend-fout");
  return data;
}

export default async function handler(req, res) {
  var notionToken = process.env.NOTION_TOKEN;
  var resendKey = process.env.RESEND_API_KEY;
  var toAddress = process.env.REMINDER_EMAIL || "fwillemse139@gmail.com";
  if (!notionToken) { res.status(500).json({ error: "NOTION_TOKEN ontbreekt in Vercel environment variables" }); return; }
  if (!resendKey) { res.status(500).json({ error: "RESEND_API_KEY ontbreekt in Vercel environment variables" }); return; }

  try {
    var tasks = await loadBlob(notionToken, BLOB_PAGE_IDS.kanban, []);
    var sentLog = await loadBlob(notionToken, BLOB_PAGE_IDS.deadlinereminders, []);
    var sentSet = {};
    sentLog.forEach(function (k) { sentSet[k] = true; });

    var now = new Date();
    var todayStr = now.toISOString().slice(0, 10);
    var toSend = [];
    tasks
      .filter(function (t) { return t.status !== "done" && t.status !== "archived"; })
      .forEach(function (t) {
        var d = parseDeadline(t.deadline, now);
        if (!d) return;
        var diff = daysUntil(d, now);
        if (diff !== 1 && diff !== 2) return;
        var key = t.id + ":" + diff + ":" + todayStr;
        if (sentSet[key]) return;
        toSend.push({ task: t, diff: diff, key: key });
      });

    if (toSend.length === 0) {
      res.status(200).json({ sent: 0, message: "geen nieuwe deadline-herinneringen vandaag" });
      return;
    }
    toSend.sort(function (a, b) { return a.diff - b.diff; });

    await sendEmail(resendKey, toAddress, toSend);

    var updatedLog = sentLog.concat(toSend.map(function (x) { return x.key; })).slice(-MAX_SENT_LOG);
    await saveBlob(notionToken, BLOB_PAGE_IDS.deadlinereminders, updatedLog);

    res.status(200).json({ sent: toSend.length, tasks: toSend.map(function (x) { return { title: x.task.title, diff: x.diff }; }) });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
