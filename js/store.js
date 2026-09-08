// Simpele localStorage-laag — één apparaat, geen backend, geen accounts.
export function loadArray(key) {
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveArray(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
