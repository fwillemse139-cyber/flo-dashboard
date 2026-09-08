// Vercel serverless function — leest/schrijft rechtstreeks in de "Notes" en
// "Tasks" Notion-pagina's onder Personal, zodat die twee widgets in het
// dashboard Notion als opslag gebruiken i.p.v. alleen localStorage.
//
// Eenmalige setup (Floris):
//   1. Maak een interne integratie op https://www.notion.so/profile/integrations
//      (of notion.so/my-integrations) → kopieer de "Internal Integration Secret".
//   2. Zet 'm als env var NOTION_TOKEN in Vercel.
//   3. Open de "Notes"-pagina en de "Tasks"-pagina in Notion → "..." menu
//      rechtsboven → Connections → voeg de zojuist gemaakte integratie toe.
//      (Zonder deze stap krijgt de integratie een 403/404 op deze pagina's.)
//
// Notes-pagina: elke notitie = één paragraph-block.
// Tasks-pagina: elke taak = één to_do-block (met checkbox-status).
var NOTION_VERSION = "2022-06-28";
var PAGE_IDS = {
  notes: "3d5b6cf8f8be80d99e2edbe77602b590",
  tasks: "27eb6cf8f8be8048b2b8f69d731807bc"
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

async function listItems(token, target) {
  var res = await notionFetch(token, "/blocks/" + PAGE_IDS[target] + "/children?page_size=100");
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion list failed");
  return (data.results || [])
    .filter(function (b) { return !b.archived && (target === "tasks" ? b.type === "to_do" : b.type === "paragraph"); })
    .map(function (b) {
      if (target === "tasks") {
        return { id: b.id, title: plainText(b.to_do.rich_text), done: !!b.to_do.checked };
      }
      return { id: b.id, body: plainText(b.paragraph.rich_text) };
    });
}

async function addItem(token, target, payload) {
  var block = target === "tasks"
    ? { type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: payload.title || "" } }], checked: !!payload.done } }
    : { type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: payload.body || "" } }] } };
  var res = await notionFetch(token, "/blocks/" + PAGE_IDS[target] + "/children", {
    method: "PATCH",
    body: JSON.stringify({ children: [block] })
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion append failed");
  return { id: data.results[0].id };
}

async function updateItem(token, target, blockId, payload) {
  var body = target === "tasks"
    ? { to_do: Object.assign({}, payload.title != null ? { rich_text: [{ type: "text", text: { content: payload.title } }] } : {}, payload.done != null ? { checked: payload.done } : {}) }
    : { paragraph: { rich_text: [{ type: "text", text: { content: payload.body || "" } }] } };
  var res = await notionFetch(token, "/blocks/" + blockId, { method: "PATCH", body: JSON.stringify(body) });
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || "Notion update failed");
  return { ok: true };
}

async function deleteItem(token, blockId) {
  var res = await notionFetch(token, "/blocks/" + blockId, { method: "DELETE" });
  if (!res.ok) { var data = await res.json(); throw new Error(data.message || "Notion delete failed"); }
  return { ok: true };
}

export default async function handler(req, res) {
  var token = process.env.NOTION_TOKEN;
  if (!token) { res.status(500).json({ error: "NOTION_TOKEN ontbreekt in Vercel environment variables" }); return; }

  var target = (req.query && req.query.target) || (new URL(req.url, "http://x").searchParams.get("target"));
  if (target !== "notes" && target !== "tasks") { res.status(400).json({ error: "target moet 'notes' of 'tasks' zijn" }); return; }

  try {
    if (req.method === "GET") {
      res.status(200).json({ items: await listItems(token, target) });
    } else if (req.method === "POST") {
      res.status(200).json(await addItem(token, target, req.body || {}));
    } else if (req.method === "PATCH") {
      var blockId = req.body.id;
      res.status(200).json(await updateItem(token, target, blockId, req.body || {}));
    } else if (req.method === "DELETE") {
      res.status(200).json(await deleteItem(token, req.body.id));
    } else {
      res.status(405).json({ error: "method not allowed" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}
