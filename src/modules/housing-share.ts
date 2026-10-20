import LZString from 'lz-string';
import type { Layout, Placement, RoomDecoration } from './housing-layout';

/** Share only meaningful values; local UUIDs and repeated field names are omitted. */
export function encodeHousingShare(layout: Layout, activeRoomId: string): string {
  const ids = new Set([...Object.keys(layout.rooms), ...Object.keys(layout.decorations || {}), activeRoomId]);
  const rooms = [...ids].map(id => {
    const placements = (layout.rooms[id] || []).map(p => p.wall
      ? [p.furnitureId, p.x, p.y, p.rotation / 90, p.wall === 'left' ? 1 : 2, p.elevation ?? 1]
      : [p.furnitureId, p.x, p.y, p.rotation / 90]);
    const decor = layout.decorations?.[id];
    return decor ? [Number(id), placements, [decor.wall || 0, decor.floor || 0, decor.fixture || 0]] : [Number(id), placements];
  });
  return `#h=${LZString.compressToEncodedURIComponent(JSON.stringify([2, Number(activeRoomId), rooms]))}`;
}

export function decodeHousingShare(hash: string): { layout: unknown; roomId?: string } {
  if (hash.length > 40000) throw new Error('Oversized layout');
  const legacy = hash.startsWith('#layout=');
  if (!legacy && !hash.startsWith('#h=')) throw new Error('Invalid share prefix');
  const json = LZString.decompressFromEncodedURIComponent(hash.slice(legacy ? 8 : 3));
  if (!json || json.length > 100000) throw new Error('Invalid shared data');
  const data: unknown = JSON.parse(json);
  if (legacy) return { layout: data };
  if (!Array.isArray(data) || data.length !== 3 || data[0] !== 2 || !Number.isSafeInteger(data[1]) ||
    !Array.isArray(data[2]) || data[2].length > 32) throw new Error('Invalid compact layout');
  const layout: Layout = { version: 1, rooms: {} };
  for (const room of data[2]) {
    if (!Array.isArray(room) || ![2, 3].includes(room.length) || !Number.isSafeInteger(room[0]) || room[0] <= 0 ||
      !Array.isArray(room[1]) || room[1].length > 200) throw new Error('Invalid compact room');
    const id = String(room[0]);
    if (Object.prototype.hasOwnProperty.call(layout.rooms, id)) throw new Error('Duplicate room');
    layout.rooms[id] = room[1].map((p: unknown, index: number): Placement => {
      if (!Array.isArray(p) || ![4, 6].includes(p.length) || !p.every(Number.isSafeInteger) ||
        p[3] < 0 || p[3] > 3 || (p.length === 6 && ![1, 2].includes(p[4]))) throw new Error('Invalid compact placement');
      return { uid: `shared-${id}-${index}`, furnitureId: p[0], x: p[1], y: p[2], rotation: p[3] * 90,
        ...(p.length === 6 ? { wall: p[4] === 1 ? 'left' : 'right', elevation: p[5] } : {}) };
    });
    if (room.length === 3) {
      const decor = room[2];
      if (!Array.isArray(decor) || decor.length !== 3 || !decor.every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid compact finishes');
      const clean: RoomDecoration = {};
      if (decor[0]) clean.wall = decor[0];
      if (decor[1]) clean.floor = decor[1];
      if (decor[2]) clean.fixture = decor[2];
      (layout.decorations ||= {})[id] = clean;
    }
  }
  const roomId = String(data[1]);
  if (!Object.prototype.hasOwnProperty.call(layout.rooms, roomId)) throw new Error('Missing active room');
  return { layout, roomId };
}
