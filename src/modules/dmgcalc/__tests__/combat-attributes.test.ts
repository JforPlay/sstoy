import { describe, expect, it } from 'vitest';
import { changeCombatAttributes, readCombatAttribute, readScopedCombatAttribute } from '../core/combat-attributes';
import { clearUltimateSp } from '../core/rotation-sp';
describe('per-actor native state', () => {
  it('percentage multiplies origin plus base amendments, not absolute amendments', () => {
    const original = { 3: { origin: 1000, base: 0, percent: 0, absolute: 0 } };
    const changed = changeCombatAttributes(original, [
      { type: 3, parameter: 1, value: 500 }, { type: 3, parameter: 2, value: .2 }, { type: 3, parameter: 3, value: 100 },
    ]);
    expect(readCombatAttribute(changed, 3, {})).toBe(1900);
    expect(readCombatAttribute(original, 3, {})).toBe(1000);
  });
  it('enforces percent and final limits in the client order', () => {
    const attributes = { 1: { origin: 1000, base: 0, percent: -1, absolute: 0 } };
    expect(readCombatAttribute(attributes, 1, { 1: { IsLimitedPre: true, LowerPre: -8000, UpperPre: 1000000 } })).toBeCloseTo(200);
    expect(readCombatAttribute(attributes, 1, { 1: { IsLimited: true, Lower: 10000, Upper: 2000000000 } })).toBe(1);
  });
  it('clears the entire SP pool at ultimate activation', () => {
    const original = { pools: { main: { value: 3000000, capacity: 3000000, spent: 0, gained: 3000000, overflow: 0 } }, castGains: {} };
    expect(clearUltimateSp(original, 'main', 2350000).pools.main).toMatchObject({ value: 0, spent: 3000000 });
    expect(original.pools.main.value).toBe(3000000);
  });
  it('keeps light-only skill bonuses in the correct additive channel', () => {
    const attributes = { 57: { origin: 1, base: .25, percent: .2, absolute: .1 } };
    const scoped = [{ type: 57, scope: 'element' as const, selector: 5, base: .3, percent: .1 }];
    expect(readScopedCombatAttribute(attributes, scoped, 57, 'element', 5)).toBeCloseTo(2.115);
    expect(readScopedCombatAttribute(attributes, scoped, 57, 'element', 1)).toBeCloseTo(1.6);
  });
});
