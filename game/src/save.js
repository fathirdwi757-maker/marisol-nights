// Save / load via localStorage: money, story progress, collected packages
// and where Nilo stands. Deliberately tiny and defensive — a corrupt save
// must never stop the game from starting.

const KEY = 'marisol-nights-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(G) {
  try {
    const data = {
      money: G.money,
      missionIndex: G.missionIndex,
      packages: G.packagesFound,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      storyDone: G.storyDone,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the game simply continues unsaved.
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function hasSave() {
  return loadSave() !== null;
}
