// Gedeelde client voor de AI-coach — praat met /api/coach (server-side
// Anthropic-call) en bewaart het gesprek per "thread" (bv. "health",
// "identity") in één Notion-blob (?target=coach), zelfde patroon als de
// andere secties. De server is stateless: bij elke vraag stuurt de client
// de laatste ~20 berichten van de thread mee als geschiedenis.
import { uid } from "./store.js";

var STORAGE_KEY = "flo.coach";
var notionAvailable = false;
var state = { health: emptyThread(), identity: emptyThread() };
var loadPromise = null;

function emptyThread() {
  return { messages: [], lastAutoMessageAt: 0, lastCheckins: {} };
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function loadLocal() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function persist() {
  saveLocal();
  if (notionAvailable) {
    fetch("/api/notion?target=coach", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: state })
    }).catch(function () {});
  }
}

function hasMessages(thread) {
  return !!(thread && thread.messages && thread.messages.length > 0);
}

export function ensureLoaded() {
  if (loadPromise) return loadPromise;
  loadPromise = (async function () {
    var local = loadLocal();
    if (local) state = Object.assign({ health: emptyThread(), identity: emptyThread() }, local);
    try {
      var res = await fetch("/api/notion?target=coach");
      if (res.ok) {
        var body = await res.json();
        notionAvailable = true;
        var notionData = body.data;
        var notionEmpty = !notionData || (!hasMessages(notionData.health) && !hasMessages(notionData.identity));
        if (notionEmpty && local) {
          persist(); // eerste keer: lokale historie omhoog duwen i.p.v. overschrijven
        } else if (notionData) {
          state = Object.assign({ health: emptyThread(), identity: emptyThread() }, notionData);
          saveLocal();
        }
      }
    } catch (e) {
      // geen backend beschikbaar — blijft bij de lokale versie
    }
  })();
  return loadPromise;
}

export function getThread(threadKey) {
  if (!state[threadKey]) state[threadKey] = emptyThread();
  return state[threadKey];
}

export function addMessage(threadKey, role, text) {
  var thread = getThread(threadKey);
  thread.messages.push({ id: uid(), role: role, text: text, createdAt: Date.now() });
  if (thread.messages.length > 40) thread.messages = thread.messages.slice(-40); // kosten/context begrenzen
  persist();
}

// promptKey kiest de system-prompt server-side (bv. "health", "identity",
// "identity-morning"/"identity-midday"/"identity-evening"); threadKey is
// waar het gesprek lokaal onder opgeslagen wordt (meestal hetzelfde als de
// "hoofd"-promptKey, zodat check-ins en handmatige analyses in dezelfde
// doorlopende chat terechtkomen).
export async function askCoach(threadKey, promptKey, context, trigger) {
  var thread = getThread(threadKey);
  var payload = {
    promptKey: promptKey,
    context: context,
    messages: thread.messages.slice(-20).map(function (m) { return { role: m.role, text: m.text }; }),
    trigger: trigger || null
  };
  try {
    var res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (res.ok && data.text) {
      addMessage(threadKey, "assistant", data.text);
      return data.text;
    }
    addMessage(threadKey, "assistant", "(kon geen antwoord ophalen: " + (data.error || "onbekende fout") + ")");
    return null;
  } catch (e) {
    addMessage(threadKey, "assistant", "(kon de coach niet bereiken — check of ANTHROPIC_API_KEY is ingesteld in Vercel)");
    return null;
  }
}

export function markCheckinSent(threadKey, key) {
  var thread = getThread(threadKey);
  thread.lastCheckins = thread.lastCheckins || {};
  thread.lastCheckins[key] = todayStr();
  persist();
}
export function wasCheckinSentToday(threadKey, key) {
  var thread = getThread(threadKey);
  return !!(thread.lastCheckins && thread.lastCheckins[key] === todayStr());
}

export function getLatestMessage(threadKey) {
  var thread = getThread(threadKey);
  return thread.messages.length ? thread.messages[thread.messages.length - 1] : null;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Kleine gedeelde chat-UI-renderer (gebruikt door zowel Health als
// Identity, zodat het uiterlijk van beide gesprekken consistent blijft).
export function renderChatThread(threadKey) {
  var thread = getThread(threadKey);
  if (thread.messages.length === 0) return '<div class="empty-drop">Nog geen berichten</div>';
  var html = '<div class="chat-thread">';
  thread.messages.forEach(function (m) {
    html += '<div class="chat-msg ' + m.role + '">' + esc(m.text).replace(/\n/g, "<br>") + "</div>";
  });
  html += "</div>";
  return html;
}
