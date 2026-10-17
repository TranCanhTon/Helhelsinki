// Saved buildings (Ton, 16 Oct 2026): the star on the card, the list in the tool bar.
// Kept in this browser only (localStorage), no accounts: clearing the browser's site
// data removes them. storage may be missing or throw (private windows), then nothing
// is kept and the list stays empty.
const KEY = 'daroad.saved';

// {buildingId: {address, place, position, savedAt}}
export function createSaved(storage = globalThis.localStorage) {
  let items = {};
  try {
    items = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {};
  } catch {
    items = {};
  }
  const listeners = new Set();
  const write = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(items));
    } catch {}
    for (const fn of listeners) fn();
  };
  return {
    has: id => id in items,
    get: id => items[id] ?? null,
    get size() {
      return Object.keys(items).length;
    },
    // Newest saved first.
    list() {
      return Object.entries(items)
        .map(([id, item]) => ({id, ...item}))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
    toggle(id, {address, place, position}) {
      if (id in items) delete items[id];
      else items[id] = {address: address ?? null, place: place ?? null, position, savedAt: new Date().toISOString()};
      write();
      return id in items;
    },
    onChange(fn) {
      listeners.add(fn);
    },
  };
}
