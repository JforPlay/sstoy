/** Housing layout and fixed-view projection rules; not a full game physics simulation. */
export interface Furniture {
  Id: number;
  L: number;
  W: number;
  H: number;
  CanIn: number[];
  Tab: number;
  PutType?: number;
  Fixed?: number;
  NotShow?: number;
  CollectionValue?: number;
}
export interface Room { Id: number; RoomType?: number; RoomSizeType?: number; DefaultName: string; DefaultLayoutId?: number }
export interface RoomSize { L: number; W: number; H?: number }
export interface Placement { uid: string; furnitureId: number; x: number; y: number; rotation: number; wall?: 'left' | 'right'; elevation?: number }
export interface RoomDecoration { wall?: number; floor?: number; fixture?: number }
export interface Layout { version: 1; rooms: Record<string, Placement[]>; decorations?: Record<string, RoomDecoration> }
export type FurnitureKind = 'floor' | 'wall' | 'wallFinish' | 'floorFinish' | 'fixture';
export interface DefaultFurniture { RoomLayoutId: number; FurnitureId: number; Pos: number[]; Rot?: number }
export function furnitureKind(furniture: Furniture): FurnitureKind {
  switch (furniture.PutType) {
    case 1: return 'wall';
    case 4: return 'wallFinish';
    case 5: return 'floorFinish';
    case 7: return 'fixture';
    default: return 'floor';
  }
}
export function canUseFurniture(furniture: Furniture, room: Room): boolean {
  return !furniture.NotShow && furniture.CanIn.includes(room.RoomType || 0);
}
export function fixturePlacement(room: Room, defaults: DefaultFurniture[], furniture: Record<string, Furniture>, selectedId?: number): Placement | undefined {
  const slot = defaults.find(p => p.RoomLayoutId === room.DefaultLayoutId && furniture[p.FurnitureId] && furnitureKind(furniture[p.FurnitureId]!) === 'fixture');
  if (!slot) return undefined;
  const id = selectedId ?? slot.FurnitureId;
  const item = furniture[id];
  if (!item || furnitureKind(item) !== 'fixture' || !canUseFurniture(item, room)) return undefined;
  return { uid: `fixture-${room.Id}`, furnitureId: id, x: slot.Pos[0] || 0, y: slot.Pos[2] || 0, rotation: ((slot.Rot || 0) * 90) % 360 };
}
export interface ScenePoint { x: number; y: number }
export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 760;

/** Fixed oblique view. Logical grid coordinates remain unchanged in saved layouts. */
export function roomProjection(size: RoomSize): { a: number; b: number; c: number; d: number; e: number; f: number } {
  return { a: 440 / size.L, b: 245 / size.L, c: -440 / size.W, d: 245 / size.W, e: 500, f: 145 };
}
export function projectPoint(x: number, y: number, size: RoomSize): ScenePoint {
  const m = roomProjection(size);
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}
export function unprojectPoint(x: number, y: number, size: RoomSize): ScenePoint {
  const m = roomProjection(size);
  const determinant = m.a * m.d - m.b * m.c;
  return { x: ((x - m.e) * m.d - (y - m.f) * m.c) / determinant,
    y: ((y - m.f) * m.a - (x - m.e) * m.b) / determinant };
}
export function wallImageMatrix(p: Placement, furniture: Furniture, size: RoomSize): string {
  const m = roomProjection(size);
  const unit = 440 / Math.max(size.L, size.W) * .9;
  const origin = p.wall === 'left' ? projectPoint(0, p.y + furniture.L, size) : projectPoint(p.x, 0, size);
  const a = p.wall === 'left' ? -m.c : m.a;
  const b = p.wall === 'left' ? -m.d : m.b;
  return `matrix(${a} ${b} 0 ${unit} ${origin.x} ${origin.y - ((p.elevation || 0) + furniture.H) * unit})`;
}
export function projectedPlacement(p: Placement, furniture: Furniture, size: RoomSize): { corners: ScenePoint[]; anchor: ScenePoint; width: number; height: number; depth: number } {
  if (furnitureKind(furniture) === 'wall') {
    const unit = 440 / Math.max(size.L, size.W) * .9;
    const base = projectPoint(p.x, p.y, size);
    const end = p.wall === 'left' ? projectPoint(0, p.y + furniture.L, size) : projectPoint(p.x + furniture.L, 0, size);
    const low = (p.elevation || 0) * unit, high = low + furniture.H * unit;
    return { corners: [{ x: base.x, y: base.y - low }, { x: end.x, y: end.y - low }, { x: end.x, y: end.y - high }, { x: base.x, y: base.y - high }],
      anchor: base, width: Math.abs(end.x - base.x), height: high - low, depth: Math.max(base.y, end.y) };
  }
  const box = footprint(furniture, p.rotation);
  const corners = [projectPoint(p.x, p.y, size), projectPoint(p.x + box.L, p.y, size),
    projectPoint(p.x + box.L, p.y + box.W, size), projectPoint(p.x, p.y + box.W, size)];
  const center = projectPoint(p.x + box.L / 2, p.y + box.W / 2, size);
  const front = corners[2]!;
  const floorWidth = Math.abs(corners[1]!.x - corners[3]!.x);
  const floorHeight = front.y - corners[0]!.y;
  const unit = 440 / Math.max(size.L, size.W);
  return { corners, anchor: { x: center.x, y: center.y + (front.y - center.y) * .65 },
    width: Math.max(32, floorWidth * 1.08),
    height: Math.max(32, floorHeight + furniture.H * unit * .75), depth: front.y };
}

export function footprint(furniture: Furniture, rotation: number): RoomSize {
  return rotation % 180 === 0 ? { L: furniture.L, W: furniture.W } : { L: furniture.W, W: furniture.L };
}
export function supportsPlacement(furniture: Furniture, room: Room): boolean {
  return canUseFurniture(furniture, room) && (furnitureKind(furniture) === 'wall' || (furnitureKind(furniture) === 'floor' && !furniture.Fixed));
}
export function fitsRoom(placement: Placement, furniture: Furniture, size: RoomSize): boolean {
  if (furnitureKind(furniture) === 'wall') {
    const height = placement.elevation ?? 1;
    if (!Number.isInteger(height) || height < 0 || height + furniture.H > (size.H || 5)) return false;
    return placement.wall === 'left' ? placement.x === 0 && placement.y >= 0 && placement.y + furniture.L <= size.W && placement.rotation === 90 :
      placement.wall === 'right' && placement.y === 0 && placement.x >= 0 && placement.x + furniture.L <= size.L && placement.rotation === 0;
  }
  const box = footprint(furniture, placement.rotation);
  return placement.x >= 0 && placement.y >= 0 && placement.x + box.L <= size.L && placement.y + box.W <= size.W;
}
export function canPlace(candidate: Placement, layout: Placement[], furniture: Record<string, Furniture>, size: RoomSize, overlap = false): boolean {
  const item = furniture[candidate.furnitureId];
  if (!item || !fitsRoom(candidate, item, size)) return false;
  if (overlap) return true;
  const box = footprint(item, candidate.rotation);
  return layout.every(other => {
    if (other.uid === candidate.uid) return true;
    const otherItem = furniture[other.furnitureId];
    if (!otherItem) return false;
    const wall = furnitureKind(item) === 'wall', otherWall = furnitureKind(otherItem) === 'wall';
    if (wall !== otherWall) return true;
    if (wall && otherWall) {
      if (candidate.wall !== other.wall) return true;
      const start = candidate.wall === 'left' ? candidate.y : candidate.x;
      const otherStart = other.wall === 'left' ? other.y : other.x;
      const height = candidate.elevation ?? 1, otherHeight = other.elevation ?? 1;
      return start + item.L <= otherStart || otherStart + otherItem.L <= start || height + item.H <= otherHeight || otherHeight + otherItem.H <= height;
    }
    // Rugs and floor furniture occupy different layers in this 2D planner.
    if ((item.PutType === 2) !== (otherItem.PutType === 2)) return true;
    const otherBox = footprint(otherItem, other.rotation);
    return candidate.x + box.L <= other.x || other.x + otherBox.L <= candidate.x ||
      candidate.y + box.W <= other.y || other.y + otherBox.W <= candidate.y;
  });
}
export function validateLayout(value: unknown, furniture: Record<string, Furniture>, rooms: Record<string, Room>, sizes: Record<string, RoomSize>): Layout {
  const input = value as Partial<Layout> | null;
  if (!input || input.version !== 1 || !input.rooms || typeof input.rooms !== 'object' || Array.isArray(input.rooms)) throw new Error('Invalid layout');
  const result: Layout = { version: 1, rooms: {} };
  for (const [roomId, placements] of Object.entries(input.rooms)) {
    const room = Object.prototype.hasOwnProperty.call(rooms, roomId) ? rooms[roomId] : undefined;
    const size = room && sizes[room.RoomSizeType || 0];
    if (!room || !size || !Array.isArray(placements) || placements.length > 200) throw new Error('Invalid room');
    const uids = new Set<string>();
    result.rooms[roomId] = placements.map(p => {
      if (!p || typeof p.uid !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.uid) || p.uid.startsWith('fixture-') || uids.has(p.uid) ||
        !Number.isInteger(p.furnitureId) || !Number.isInteger(p.x) || !Number.isInteger(p.y) ||
        ![0, 90, 180, 270].includes(p.rotation)) throw new Error('Invalid placement');
      const item = furniture[p.furnitureId];
      if (!item || !supportsPlacement(item, room) || !fitsRoom(p, item, size)) throw new Error('Invalid furniture');
      if (furnitureKind(item) !== 'wall' && (p.wall !== undefined || p.elevation !== undefined)) throw new Error('Invalid mount');
      uids.add(p.uid);
      return { uid: p.uid, furnitureId: p.furnitureId, x: p.x, y: p.y, rotation: p.rotation,
        ...(furnitureKind(item) === 'wall' ? { wall: p.wall, elevation: p.elevation ?? 1 } : {}) };
    });
  }
  if (input.decorations !== undefined) {
    if (!input.decorations || typeof input.decorations !== 'object' || Array.isArray(input.decorations)) throw new Error('Invalid decorations');
    result.decorations = {};
    for (const [roomId, decor] of Object.entries(input.decorations)) {
      const room = Object.prototype.hasOwnProperty.call(rooms, roomId) ? rooms[roomId] : undefined;
      if (!room || !decor || typeof decor !== 'object' || Array.isArray(decor)) throw new Error('Invalid decoration room');
      const clean: RoomDecoration = {};
      for (const [key, kind] of [['floor', 'floorFinish'], ['wall', 'wallFinish'], ['fixture', 'fixture']] as const) {
        const id = decor[key];
        if (id === undefined) continue;
        const item = furniture[id];
        if (!Number.isInteger(id) || !item || !canUseFurniture(item, room) || furnitureKind(item) !== kind) throw new Error('Invalid finish');
        clean[key] = id;
      }
      result.decorations[roomId] = clean;
    }
  }
  return result;
}
