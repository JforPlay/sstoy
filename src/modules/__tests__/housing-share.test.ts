import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { encodeHousingShare, decodeHousingShare } from '../housing-share';
import type { Layout } from '../housing-layout';

const layout: Layout = { version: 1, rooms: {
  '701001': [{ uid: 'a-long-local-identifier', furnitureId: 700002, x: 3, y: 4, rotation: 270 }],
  '701002': [{ uid: 'another-local-identifier', furnitureId: 720009, x: 0, y: 2, rotation: 90, wall: 'left', elevation: 0 }],
}, decorations: { '701002': { wall: 720039, floor: 720040, fixture: 720003 } } };
const compact = (data: unknown): string => `#h=${LZString.compressToEncodedURIComponent(JSON.stringify(data))}`;

describe('compact housing share links', () => {
  it('preserves both rooms, rotation, wall mounting, finishes and active room', () => {
    const decoded = decodeHousingShare(encodeHousingShare(layout, '701002'));
    expect(decoded.roomId).toBe('701002');
    const restored = decoded.layout as Layout;
    expect(restored.decorations).toEqual(layout.decorations);
    for (const id of Object.keys(layout.rooms)) {
      const values = (data: Layout): unknown => data.rooms[id]!.map(({ uid: _uid, ...p }) => p);
      expect(values(restored)).toEqual(values(layout));
      expect(restored.rooms[id]![0]!.uid).toBe(`shared-${id}-0`);
    }
  });
  it('still reads existing links', () => {
    const legacy = `#layout=${LZString.compressToEncodedURIComponent(JSON.stringify(layout))}`;
    expect(decodeHousingShare(legacy).layout).toEqual(layout);
  });
  it('shares an empty active room without discarding the other room', () => {
    const decoded = decodeHousingShare(encodeHousingShare({ version: 1, rooms: { '701001': layout.rooms['701001']! } }, '701002'));
    expect(decoded.roomId).toBe('701002');
    expect((decoded.layout as Layout).rooms['701002']).toEqual([]);
    expect((decoded.layout as Layout).rooms['701001']).toHaveLength(1);
  });
  it('rejects malformed compact links before layout validation', () => {
    for (const data of [[3, 701001, []], [2, 701001, [[701001, [], []]]], [2, 701001, [[701001, [[700002, 1, 1, 5]]]]],
      [2, 701001, [[701001, []], [701001, []]]], [2, 701001, []]]) {
      expect(() => decodeHousingShare(compact(data))).toThrow();
    }
    expect(() => decodeHousingShare('#h=' + 'x'.repeat(40000))).toThrow();
  });
  it('is substantially shorter than sharing the full local layout', () => {
    const old = `#layout=${LZString.compressToEncodedURIComponent(JSON.stringify(layout))}`;
    const next = encodeHousingShare(layout, '701002');
    expect(next.length).toBeLessThan(old.length * .6);
    console.info(`Housing share example: ${old.length} → ${next.length} characters`);
  });
});
