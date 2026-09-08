// Vercel serverless function — leest/schrijft rechtstreeks in de "Tasks"
// Notion-pagina onder Personal (dashboard-opslag), en leest (read-only)
// de "Daily Tasks"-database uit de Productivity-pagina voor de
// Agenda-widget — dit is dezelfde database die Floris al als
// geabonneerde agenda in Apple Agenda had (via Notion's eigen iCal-sync),
// maar die kon niet los "openbaar" gemaakt worden. Hier gaan we rechtstreeks
// naar de bron via de Notion API.
//
// Eenmalige setup (Floris):
//   1. Maak een interne integratie op https://www.notion.so/profile/integrations
//      (of notion.so/my-integrations) → kopieer de "Internal Integration Secret".
//   2. Zet 'm als env var NOTION_TOKEN in Vercel.
//   3. Open de "Tasks"-pagina én de "Daily Tasks"-database (onder
//      Productivity) in Notion → "..." menu rechtsboven → Connections
//      → voeg de zojuist gemaakte integratie toe aan beide.
//      (Zonder deze stap krijgt de integratie een 403/404.)
//
// Tasks-pagina: elke taak = één to_do-block (met checkbox-status).
// Agenda: leest "Daily Tasks"-database, items met een "Geplande tijd".
var NOTION_VERSION = "2022-06-28";
var TASKS_PAGE_ID = "27eb6cf8f8be8048b2b8f69d731807bc";
var AGENDA_DATABASE_ID = "13c79dd716294889ad16a6757bb5b6c7";

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

async function deleteTask(token, blockId) {
  var res = await notionFetch(token, "/blocks/" + blockId, { method: "DELETE" });
  if (!res.ok) { var data = await res.json(); throw new Error(data.message || "Notion delete failed"); }
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
  if (target !== "tasks" && target !== "agenda") { res.status(400).json({ error: "target moet 'tasks' of 'agenda' zijn" }); return; }

  try {
    if (target === "agenda") {
      if (req.method !== "GET") { res.status(405).json({ error: "agenda is read-only" }); return; }
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      res.status(200).json({ events: await listAgenda(token) });
      return;
    }
    if (req.method === "GET") {
      res.status(200).json({ items: await listTasks(token) });
    } else if (req.method === "POST") {
      res.status(200).json(await addTask(token, req.body || {}));
    } else if (req.method === "PATCH") {
      res.status(200).json(await updateTask(token, req.body.id, req.body || {}));
    } else if (req.method === "DELETE") {
      res.status(200).json(await deleteTask(token, req.body.id));
    } else {
      res.status(405).json({ error: "method not allowed" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
