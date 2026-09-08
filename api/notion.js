// Vercel serverless function — leest/schrijft rechtstreeks in Notion.
// Meerdere "targets", allemaal onder dezelfde ene interne integratie
// ("Flo's Dashboard"):
//
//   - tasks: to_do-blocks op de "Tasks"-pagina (Personal)
//   - agenda (read-only): "Daily Tasks"-database (Productivity), items
//     met een "Geplande tijd"
//   - kanban / health / financial / identity: elk hun eigen JSON-blob-pagina
//     (kind-pagina van "Tasks", erft dus automatisch dezelfde
//     Connections-toegang — geen aparte deel-stap nodig per stuk).
//     GET geeft { data: <geparste JSON> }, PUT verwacht { data: <JSON> }
//     en overschrijft de hele blob (simpel "heel document opslaan"-patroon,
//     past bij hoe elke sectie z'n eigen state al in-memory bijhoudt).
//
// Eenmalige setup (Floris):
//   1. Maak een interne integratie op https://www.notion.so/profile/integrations
//      (of notion.so/my-integrations) → kopieer de "Internal Integration Secret".
//   2. Zet 'm als env var NOTION_TOKEN in Vercel.
//   3. Open de "Tasks"-pagina én de "Daily Tasks"-database (onder
//      Productivity) in Notion → "..." menu rechtsboven → Connections
//      → voeg de integratie toe aan beide (de JSON-blob-pagina's hoeven
//      dat niet apart, want die zijn kind-pagina's van "Tasks").
var NOTION_VERSION = "2022-06-28";
var TASKS_PAGE_ID = "27eb6cf8f8be8048b2b8f69d731807bc";
var AGENDA_DATABASE_ID = "13c79dd716294889ad16a6757bb5b6c7";
var BLOB_PAGE_IDS = {
  kanban: "3d5b6cf8f8be8177a14ee74f07a4d799",   // "Kanban Data" — Productivity System
  health: "3d5b6cf8f8be812d913ad581287eff11",   // "Health Log Data"
  financial: "3d5b6cf8f8be816691a9c8eeec5cc20d", // "Financial Data"
  identity: "3d5b6cf8f8be8156a6c2d16e7b67738b",  // "Identity Data"
  coach: "3d5b6cf8f8be816aaa84cc0dafc6afcb"      // "Coach Data" — AI-coach-gesprekken (Health + Identity)
  // "suerte" (Suerte Clients Data) is verwijderd — Clients-feature is
  // weggehaald uit de UI (8 sept 2026), de Notion-pagina zelf staat nog
  // ongebruikt in Notion maar wordt niet meer aangesproken.
};

function notionFetch(token, path, options) {
  return fetch("https://api.notion.com/v1" + path, Object.assign({
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    }
  }, options || {}));
}

function plainText(richTextArray) {
  return (richTextArray || []).map(function (t) { return t.plain_text || ""; }).join("");
}

async function listTasks(token) {
  var res = await notionFetch(token, "/blocks/" + TASKS_PAGE_ID + "/children?page_size=100");
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion list failed");
  return (data.results || [])
    .filter(function (b) { return !b.archived && b.type === "to_do"; })
    .map(function (b) { return { id: b.id, title: plainText(b.to_do.rich_text), done: !!b.to_do.checked }; });
}

async function addTask(token, payload) {
  var block = { type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: payload.title || "" } }], checked: !!payload.done } };
  var res = await notionFetch(token, "/blocks/" + TASKS_PAGE_ID + "/children", {
    method: "PATCH",
    body: JSON.stringify({ children: [block] })
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion append failed");
  return { id: data.results[0].id };
}

async function updateTask(token, blockId, payload) {
  var body = { to_do: Object.assign({}, payload.title != null ? { rich_text: [{ type: "text", text: { content: payload.title } }] } : {}, payload.done != null ? { checked: payload.done } : {}) };
  var res = await notionFetch(token, "/blocks/" + blockId, { method: "PATCH", body: JSON.stringify(body) });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion update failed");
  return { ok: true };
}

async function findCodeBlockId(token, pageId) {
  var res = await notionFetch(token, "/blocks/" + pageId + "/children?page_size=100");
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion blob list failed");
  var codeBlock = (data.results || []).find(function (b) { return b.type === "code"; });
  return codeBlock ? codeBlock.id : null;
}

async function loadBlob(token, pageId, fallback) {
  var res = await notionFetch(token, "/blocks/" + pageId + "/children?page_size=100");
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion blob list failed");
  var codeBlock = (data.results || []).find(function (b) { return b.type === "code"; });
  if (!codeBlock) return fallback;
  var text = plainText(codeBlock.code.rich_text);
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

// Notion-tekstblokken hebben een limiet van 2000 tekens per rich_text-run,
// dus knippen we lange JSON op in stukken die elk als los rich_text-item
// meegaan (Notion plakt ze bij weergave weer aan elkaar).
function chunkRichText(text) {
  var chunks = [];
  for (var i = 0; i < text.length; i += 1900) chunks.push(text.slice(i, i + 1900));
  if (chunks.length === 0) chunks.push("");
  return chunks.map(function (c) { return { type: "text", text: { content: c } }; });
}

async function saveBlob(token, pageId, value) {
  var blockId = await findCodeBlockId(token, pageId);
  if (!blockId) throw new Error("Kon het code-block niet vinden op deze pagina");
  var body = { code: { rich_text: chunkRichText(JSON.stringify(value)), language: "javascript" } };
  var res = await notionFetch(token, "/blocks/" + blockId, { method: "PATCH", body: JSON.stringify(body) });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion blob save failed");
  return { ok: true };
}

// Read-only: haalt "Daily Tasks"-items op met een ingevulde "Geplande tijd"
// en geeft ze terug in hetzelfde vorm als de agenda-events (title/startsAt/
// allDay), zodat ze in de bestaande Agenda-widget passen.
async function listAgenda(token) {
  var res = await notionFetch(token, "/databases/" + AGENDA_DATABASE_ID + "/query", {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "Geplande tijd", date: { is_not_empty: true } },
      sorts: [{ property: "Geplande tijd", direction: "ascending" }],
      page_size: 100
    })
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion agenda query failed");
  return (data.results || [])
    .map(function (page) {
      var props = page.properties;
      var titleProp = props["Taak"] && props["Taak"].title;
      var dateProp = props["Geplande tijd"] && props["Geplande tijd"].date;
      if (!dateProp || !dateProp.start) return null;
      return {
        title: plainText(titleProp),
        startsAt: dateProp.start,
        allDay: dateProp.start.indexOf("T") === -1
      };
    })
    .filter(function (e) { return e; });
}

export default async function handler(req, res) {
  var token = process.env.NOTION_TOKEN;
  if (!token) { res.status(500).json({ error: "NOTION_TOKEN ontbreekt in Vercel environment variables" }); return; }

  var target = (req.query && req.query.target) || (new URL(req.url, "http://x").searchParams.get("target"));
  var blobPageId = BLOB_PAGE_IDS[target];

  try {
    if (target === "agenda") {
      if (req.method !== "GET") { res.status(405).json({ error: "agenda is read-only" }); return; }
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      res.status(200).json({ events: await listAgenda(token) });
      return;
    }
    if (blobPageId) {
      var fallback = (target === "kanban" || target === "health") ? [] : (target === "financial" ? { transactions: [], income: [] } : {});
      if (req.method === "GET") { res.status(200).json({ data: await loadBlob(token, blobPageId, fallback) }); return; }
      if (req.method === "PUT") { res.status(200).json(await saveBlob(token, blobPageId, (req.body || {}).data)); return; }
      res.status(405).json({ error: target + " ondersteunt alleen GET/PUT" });
      return;
    }
    if (target !== "tasks") { res.status(400).json({ error: "onbekende target" }); return; }
    if (req.method === "GET") {
      res.status(200).json({ items: await listTasks(token) });
    } else if (req.method === "POST") {
      res.status(200).json(await addTask(token, req.body || {}));
    } else if (req.method === "PATCH") {
      res.status(200).json(await updateTask(token, req.body.id, req.body || {}));
    } else {
      res.status(405).json({ error: "method not allowed" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
