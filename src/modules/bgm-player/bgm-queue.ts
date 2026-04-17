// src/modules/bgm-player/bgm-queue.ts

/**
 * Given the favorites list and the id currently playing, return the next id to play in Queue mode.
 * - Returns null if the list is empty, currentId is null, or currentId is not in the list.
 * - Wraps around cyclically.
 */
export function nextInQueue(favorites: string[], currentId: string | null): string | null {
  if (favorites.length === 0 || currentId == null) return null;
  const idx = favorites.indexOf(currentId);
  if (idx < 0) return null;
  const nextIdx = (idx + 1) % favorites.length;
  return favorites[nextIdx] ?? null;
}
