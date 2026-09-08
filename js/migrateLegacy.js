import { loadArray, saveArray } from "./store.js";

var STORAGE_KEY = "flo.kanban_tasks";
var DISMISS_KEY = "flo.migration_dismissed";

export function isDismissed() {
  try { return !!localStorage.getItem(DISMISS_KEY); } catch (e) { return false; }
}

export function dismiss() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch (e) {}
}

// Migreert taken uit geëxporteerde JSON (van de oude flo-dashboard.html,
// via de "Export data"-knop daar — localStorage is per bestand/origin
// gebonden, dus deze data komt niet vanzelf mee) in de lokale opslag van
// dit dashboard. Bestaande taken met hetzelfde id worden bijgewerkt
// (title/subject/deadline/note/status/notitie), nieuwe worden toegevoegd.
export function runMigration(jsonText) {
  var raw;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Ongeldige JSON — kopieer de volledige tekst uit de Export data-knop.");
  }
  if (!Array.isArray(raw)) throw new Error("Verwachtte een lijst met taken.");

  var current = loadArray(STORAGE_KEY);
  var byId = {};
  current.forEach(function (t) { byId[t.id] = t; });

  var imported = 0;
  var updated = 0;

  raw.forEach(function (t) {
    var existing = byId[t.id];
    if (existing) {
      Object.assign(existing, t);
      updated++;
    } else {
      current.push(t);
      byId[t.id] = t;
      imported++;
    }
  });

  saveArray(STORAGE_KEY, current);
  dismiss();
  return { imported: imported, updated: updated };
}
