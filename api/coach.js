// Vercel serverless function — proxy naar Anthropic's Messages API voor de
// AI-coach (Health-patronen + Identity/doelen-begeleiding, inclusief
// ochtend/middag/avond-check-ins). Stateless: de client stuurt bij elke
// vraag de relevante context + laatste berichten van de thread mee, deze
// functie geeft alleen de volgende coach-reactie terug.
//
// Eenmalige setup (Floris):
//   1. Maak een API-key op https://console.anthropic.com/settings/keys
//      (vereist een Anthropic-account + betaalmethode — los van je Claude.ai
//      abonnement, dit is een aparte API-facturering per gebruik).
//   2. Zet 'm als env var ANTHROPIC_API_KEY in Vercel (Project Settings →
//      Environment Variables), zelfde plek als NOTION_TOKEN.
var ANTHROPIC_VERSION = "2023-06-01";
var MODEL = "claude-sonnet-5";

var SYSTEM_PROMPTS = {
  health: "Je bent een warme, nuchtere gezondheidscoach binnen Flo's persoonlijke dashboard van Floris. " +
    "Je krijgt zijn recente health-log (mood, energie, productiviteit, wektijd, werkminuten, vrije notities) mee als context. " +
    "Als er een patroon opvalt (bv. herhaaldelijk slecht slapen, hoofdpijn, onproductiviteit, laat opstaan, afspraken niet nakomen), benoem dat kort en concreet en stel daarna ÉÉN gerichte, open vraag om de mogelijke oorzaak te achterhalen. " +
    "Wees kort (max 3-4 zinnen), warm maar direct, geen medisch advies — je bent geen arts, je helpt hem zelf patronen herkennen. Antwoord in het Nederlands.",
  identity: "Je bent Florens persoonlijke coach voor zijn identity tracker: wie hij wil worden, zijn eigenschappen/bewijs-log, en zijn short/mid/long-term doelen. " +
    "Je krijgt zijn statement, eigenschappen+bewijs, en doelenlijst mee als context. " +
    "Focus niet op afvinken maar op HOE hij ernaartoe werkt: geef concrete, kleine volgende stappen, herken patronen (stilstand, vermeden doelen, mooie streaks) en stel gerichte vragen. Kort (max 4 zinnen), motiverend maar eerlijk. Antwoord in het Nederlands.",
  "identity-morning": "Je bent Florens persoonlijke ochtend-coach. Je krijgt zijn openstaande doelen en taken mee als context. " +
    "Schrijf een kort, energiek ochtendbericht (max 5 zinnen): noem 1-3 concrete dingen die hij vandaag kan doen gebaseerd op zijn doelen/taken, vraag of hij nog iets wil toevoegen aan vandaag, en sluit af met een korte succes-wens. Antwoord in het Nederlands.",
  "identity-midday": "Je bent Florens persoonlijke coach die halverwege de dag kort inchecked. Je krijgt zijn doelen/taken en het gesprek van vandaag mee als context. " +
    "Kort bericht (max 3 zinnen): vraag hoe het gaat en of hij op koers ligt met wat hij vanochtend wilde doen, geef een korte peptalk als dat nodig lijkt. Antwoord in het Nederlands.",
  "identity-evening": "Je bent Florens persoonlijke coach die 's avonds reflecteert. Je krijgt zijn doelen/taken en het gesprek van vandaag mee als context. " +
    "Kort bericht (max 4 zinnen): vraag terug te blikken op de dag t.o.v. wat hij vanochtend wilde doen, benoem kort iets positiefs als dat blijkt, en stel een korte reflectievraag. Antwoord in het Nederlands."
};

function buildContextBlock(promptKey, context) {
  context = context || {};
  if (promptKey === "health") {
    return "Recente health-log entries (nieuwste laatst):\n" + (context.entries || []).map(function (e) {
      return e.date + ": mood=" + (e.mood || "-") + ", energie=" + (e.energy != null ? e.energy : "-") + ", productiviteit=" + (e.productivity != null ? e.productivity : "-") + ", wektijd=" + (e.wakeTime || "-") + ", werkminuten=" + (e.workMinutes || 0) + (e.note ? ", notitie: " + e.note : "");
    }).join("\n");
  }
  var lines = [];
  if (context.statement) lines.push("Identity-statement: " + context.statement);
  if (context.traits && context.traits.length) {
    lines.push("Eigenschappen + bewijs:");
    context.traits.forEach(function (t) {
      lines.push("- " + t.name + ": " + (t.evidenceCount || 0) + "x bewijs" + (t.recentEvidence ? " (laatst: " + t.recentEvidence + ")" : ""));
    });
  }
  if (context.goals && context.goals.length) {
    lines.push("Doelen:");
    context.goals.forEach(function (g) {
      lines.push("- [" + g.term + "] " + (g.done ? "(behaald) " : "") + g.text);
    });
  }
  if (context.openTasks && context.openTasks.length) {
    lines.push("Openstaande taken (Productivity System): " + context.openTasks.join(", "));
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY ontbreekt in Vercel environment variables" }); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  var body = req.body || {};
  var promptKey = body.promptKey;
  var systemPrompt = SYSTEM_PROMPTS[promptKey];
  if (!systemPrompt) { res.status(400).json({ error: "onbekende promptKey" }); return; }

  var contextBlock = buildContextBlock(promptKey, body.context);
  var anthropicMessages = (body.messages || []).map(function (m) { return { role: m.role, content: m.text }; });
  var triggerNote = body.trigger ? "[Aanleiding: " + body.trigger + "]\n" : "";
  anthropicMessages.push({ role: "user", content: triggerNote + contextBlock });

  try {
    var apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: anthropicMessages
      })
    });
    var data = await apiRes.json();
    if (!apiRes.ok) { res.status(500).json({ error: (data.error && data.error.message) || "Anthropic API-fout" }); return; }
    var text = (data.content && data.content[0] && data.content[0].text) || "";
    res.status(200).json({ text: text });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
