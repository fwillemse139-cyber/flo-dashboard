// Vercel serverless function — draait dagelijks via Vercel Cron (zie
// vercel.json's "crons") en stuurt een Telegram-bericht als er een
// openstaande Productivity System-taak is met een deadline die precies
// over 1 of 2 dagen valt. Mag ook gewoon los aangeroepen worden (GET) om
// te testen — is idempotent per dag dankzij de dedup-log hieronder.
//
// Was eerst e-mail via Resend, maar Resend's testmodus staat alleen
// mailen naar het eigen account-e-mailadres toe (geen eigen domein
// aanwezig om te verifiëren) én de mails belandden sowieso in spam vanaf
// het gedeelde onboarding@resend.dev-domein. Telegram heeft geen van
// beide problemen: gratis, geen domein/sandbox-beperking, komt gewoon als
// appnotificatie binnen.
//
// Eenmalige setup (Floris):
//   1. Open Telegram, zoek "@BotFather", stuur "/newbot" en volg de
//      stappen (kies een naam + een username die op "bot" eindigt) →
//      je krijgt een bot-token (vorm: 123456789:AAxxxxxxxxxxxxxxxxxxxxxxx).
//   2. Zoek "@userinfobot", stuur er een willekeurig bericht naartoe —
//      hij antwoordt direct met jouw numerieke Telegram-ID. Dat ID is
//      ook je chat_id voor een direct gesprek met een bot.
//   3. Zoek je eigen nieuwe bot (de username van stap 1) en stuur 'm
//      "/start" — verplicht, want een bot mag pas berichten sturen
//      nadat jij als eerste tegen 'm gepraat hebt.
//   4. Zet in Vercel (Environment Variables): TELEGRAM_BOT_TOKEN (uit
//      stap 1) en TELEGRAM_CHAT_ID (uit stap 2).
import { loadBlob, saveBlob, BLOB_PAGE_IDS } from "./notion.js";
import { parseDeadline } from "../js/deadlineParser.js";

var MAX_SENT_LOG = 300; // voorkomt dat de dedup-lijst onbeperkt groeit

function escTg(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

// Telegram's HTML-parsemodus kent maar een handvol tags (b/i/u/s/a/code/
// pre) — geen <ul>/<li>/<h3>, dus dit wordt platte tekst met "•" en
// newlines i.p.v. een lijst-structuur.
function renderTelegramMessage(toSend) {
  function taskLine(t) {
    return "• <b>" + escTg(t.title) + "</b>" + (t.subject ? " · " + escTg(t.subject) : "") + " — " + escTg(t.deadline || "");
  }
  var oneDay = toSend.filter(function (x) { return x.diff === 1; });
  var twoDay = toSend.filter(function (x) { return x.diff === 2; });
  var lines = ["<b>Deadline-herinnering</b>", ""];
  if (oneDay.length) {
    lines.push("<b>Morgen</b>");
    oneDay.forEach(function (x) { lines.push(taskLine(x.task)); });
    lines.push("");
  }
  if (twoDay.length) {
    lines.push("<b>Over 2 dagen</b>");
    twoDay.forEach(function (x) { lines.push(taskLine(x.task)); });
  }
  return lines.join("\n").trim();
}

async function sendTelegramMessage(botToken, chatId, text) {
  var res = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML" })
  });
  var data = await res.json();
  if (!res.ok || !data.ok) throw new Error((data && data.description) || "Telegram-fout");
  return data;
}

export default async function handler(req, res) {
  var notionToken = process.env.NOTION_TOKEN;
  var botToken = process.env.TELEGRAM_BOT_TOKEN;
  // ?chatId=... overschrijdt het standaard chat_id — puur voor het testen
  // naar een ander Telegram-gesprek zonder env-var-wijziging/deploy.
  var chatIdOverride = (req.query && req.query.chatId) || (new URL(req.url, "http://x").searchParams.get("chatId"));
  var chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID;
  if (!notionToken) { res.status(500).json({ error: "NOTION_TOKEN ontbreekt in Vercel environment variables" }); return; }
  if (!botToken) { res.status(500).json({ error: "TELEGRAM_BOT_TOKEN ontbreekt in Vercel environment variables" }); return; }
  if (!chatId) { res.status(500).json({ error: "TELEGRAM_CHAT_ID ontbreekt in Vercel environment variables" }); return; }

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

    await sendTelegramMessage(botToken, chatId, renderTelegramMessage(toSend));

    var updatedLog = sentLog.concat(toSend.map(function (x) { return x.key; })).slice(-MAX_SENT_LOG);
    await saveBlob(notionToken, BLOB_PAGE_IDS.deadlinereminders, updatedLog);

    res.status(200).json({ sent: toSend.length, tasks: toSend.map(function (x) { return { title: x.task.title, diff: x.diff }; }) });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
