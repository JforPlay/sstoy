import { describe, expect, it } from 'vitest';
import { searchRotations, type RotationModel } from '../core/rotation-search';

// Synthetic rules, not Stella Sora timings or coefficients.
interface State { time: number; ready: number; buffEnd: number; charge: number }
const model: RotationModel<State> = {
  initial: () => ({ time: 0, ready: 0, buffEnd: 0, charge: 0 }),
  advance: (s, time) => ({ state: { ...s, time, charge: Math.min(3, Math.floor(time)) }, damage: 0 }),
  actions: (s, time) => time >= s.ready ? ['main', 'support'] : [],
  cast: (s, action, time) => action === 'support'
    ? { state: { ...s, ready: time + 1, buffEnd: time + 2 }, damage: 0 }
    : { state: { ...s, ready: time + 4 }, damage: time < s.buffEnd && s.charge >= 3 ? 1000 : 10 },
  key: s => JSON.stringify(s),
};

describe('rotation search (synthetic model)', () => {
  it('keeps a hold branch and waits for stacks instead of spending main on cooldown', () => {
    const result = searchRotations(model, { duration: 5, interval: 1, width: 100, top: 3 });
    expect(result.candidates[0]!.damage).toBeGreaterThanOrEqual(1000);
    expect(result.candidates[0]!.trace.some(e => e.action === 'support' && e.time >= 1)).toBe(true);
    expect(result.candidates[0]!.trace.some(e => e.action === 'main' && e.time >= 3)).toBe(true);
    expect(result.raidScore).toBeNull();
    expect(result.exhaustive).toBe(false);
  });
  it('never casts before the model cooldown becomes ready', () => {
    const result = searchRotations(model, { duration: 20, interval: .5, width: 100, top: 5 });
    for (const candidate of result.candidates) {
      for (let i = 1; i < candidate.trace.length; i++) {
        const prev = candidate.trace[i - 1]!;
        expect(candidate.trace[i]!.time - prev.time).toBeGreaterThanOrEqual(prev.action === 'main' ? 4 : 1);
      }
      expect(candidate.trace.every(e => e.time < 20)).toBe(true);
    }
  });
  it('resolves delayed damage through the horizon, not casts after it', () => {
    type Delayed = { pending: number | null };
    const delayed: RotationModel<Delayed> = {
      initial: () => ({ pending: null }),
      actions: s => s.pending === null ? ['hit'] : [],
      cast: (_, __, time) => ({ state: { pending: time + 2 }, damage: 0 }),
      advance: (s, time) => s.pending !== null && s.pending <= time
        ? { state: { pending: null }, damage: 100 } : { state: s, damage: 0 },
      key: s => JSON.stringify(s),
    };
    const r = searchRotations(delayed, { duration: 3, interval: 1, width: 10, top: 1 });
    expect(r.candidates[0]!.damage).toBe(100);
  });
});
