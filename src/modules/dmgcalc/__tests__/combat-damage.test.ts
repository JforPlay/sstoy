import { describe, expect, it } from 'vitest';
import { calculateCombatDamage, combatResistanceMultiplier, type CombatDamageInput } from '../core/combat-damage';
const resistance = {
  low: { lower: 0, upper: 250, amendLower: 0, amendUpper: .25 },
  middle: { lower: 251, upper: 750, amendLower: .35, amendUpper: .6 },
  high: { lower: 751, upper: 2000, amendLower: .9, amendUpper: .99 },
};
const hit: CombatDamageInput = {
  scalingValue: 10000, skillPercentRaw: 500000, skillFlat: 0, skillIntensity: 1, perkIntensity: 1,
  slotDamage: 1, elementDamage: 1, generalDamage: 1, damagePlus: 0,
  critRate: .25, critPower: 1.5, slotCritPower: .5,
  enemyDef: 500, enemyOriginalDef: 500, defIgnore: 0, defPenetrate: 0, dynamicDefCap: 500,
  enemyResistance: 0, resistanceIgnore: 0, resistancePenetrate: 0, suppress: 0,
  baseSuppress: .1, dynamicSuppress: .9, noElement: false,
  slotTaken: 1, elementTaken: 1, generalTaken: 1, toughnessMultiplier: 1, environmentMultiplier: 1,
  damagePlusTaken: 0, finalDamage: 1, finalDamagePlus: 0,
};
describe('client per-hit damage rules', () => {
  it('uses raw skill table coefficients and averages integer critical outcomes', () => {
    expect(calculateCombatDamage(hit, resistance)).toEqual({ base: 2500, crit: 5000, average: 3125 });
  });
  it('caps defense reduction against original defense, not zero', () => {
    const result = calculateCombatDamage({ ...hit, enemyDef: 1000, enemyOriginalDef: 1000, defPenetrate: 10000 }, resistance);
    expect(result.base).toBe(2500);
  });
  it('applies suppression on nonpositive resistance only', () => {
    expect(combatResistanceMultiplier(-100, resistance, 1, .1, .9)).toBeCloseTo(2);
    expect(combatResistanceMultiplier(250, resistance, 1, .1, .9)).toBe(.75);
    expect(combatResistanceMultiplier(99999, resistance, 1, .1, .9)).toBeCloseTo(.01);
  });
  it('neutral hits ignore both outgoing element bonus and element resistance', () => {
    expect(calculateCombatDamage({ ...hit, noElement: true, elementDamage: 3, enemyResistance: 2000, elementTaken: 5 }, resistance).base).toBe(2500);
  });
});
