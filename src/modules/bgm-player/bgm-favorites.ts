// src/modules/bgm-player/bgm-favorites.ts

export const FAVORITES_KEY = 'sstoy:bgm:favorites';
export const FAVORITES_MAX = 50;

export type FavoritesListener = (list: string[]) => void;

export interface FavoritesStore {
  list(): string[];
  has(id: string): boolean;
  add(id: string): void;
  remove(id: string): void;
  toggle(id: string): boolean; // returns new "has" state (true = now favorited)
  subscribe(listener: FavoritesListener): () => void;
}

function readFromStorage(storage: Storage): string[] {
  try {
    const raw = storage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeToStorage(storage: Storage, list: string[]): void {
  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[bgm-favorites] localStorage write failed; continuing in-memory only', err);
  }
}

export function createFavoritesStore(storage: Storage = localStorage): FavoritesStore {
  const items: string[] = readFromStorage(storage);
  const listeners = new Set<FavoritesListener>();

  const notify = () => {
    const snapshot = [...items];
    listeners.forEach((l) => l(snapshot));
  };

  const persist = () => writeToStorage(storage, items);

  const list = (): string[] => [...items];
  const has = (id: string): boolean => items.includes(id);

  const add = (id: string): void => {
    if (items.includes(id)) return;
    items.push(id);
    while (items.length > FAVORITES_MAX) items.shift();
    persist();
    notify();
  };

  const remove = (id: string): void => {
    const i = items.indexOf(id);
    if (i < 0) return;
    items.splice(i, 1);
    persist();
    notify();
  };

  const toggle = (id: string): boolean => {
    if (items.includes(id)) {
      remove(id);
      return false;
    }
    add(id);
    return true;
  };

  const subscribe = (listener: FavoritesListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { list, has, add, remove, toggle, subscribe };
}
