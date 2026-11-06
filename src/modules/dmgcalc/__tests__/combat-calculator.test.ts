import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateResolvedCombatHit, combatCalculationRules } from '../core/combat-calculator';
import { combatAttributesFromRows } from '../core/combat-base';
import { addOnceCombatAttributes } from '../core/combat-effects';
import type { CombatLevelContext } from '../core/rotation-values';
const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const rules = combatCalculationRules(read('Config'), read('AttributeLimit'), read('AttributeSetLimit'));
const hit = read('HitDamage')[162310005];
const context: CombatLevelContext = { characterLevel: 90, ascension: 8, limitBreak: 1, potentials: {}, skillSlots: { 2: 8 }, notes: {}, concertos: {}, buildLevel: 1 };
describe('resolved source-to-target calculation', () => {
  it('uses HP, normal/skill categories and target defense on an actual Seina sword hit', () => {
    const source = { attributes: combatAttributesFromRows([{ Hp: 100000, Atk: 1, LEE: 10000, CritRate: 0, CritPower: 15000 }]), scoped: [] };
    const target = { attributes: combatAttributesFromRows([{ Def: 500, LER: 0 }]), scoped: [] };
    const result = calculateResolvedCombatHit(hit, context, source, target, rules);
    expect(result.base).toBe(26000);
    expect(result.crit).toBe(39000);
    expect(result.average).toBe(26000);
  });
  it('adds eligible skill critical rate and intensity without changing another actor', () => {
    const source = { attributes: combatAttributesFromRows([{ Hp: 100000, LEE: 10000, CritPower: 15000 }]), scoped: [] };
    const target = { attributes: combatAttributesFromRows([{ Def: 500 }]), scoped: [] };
    const modified = addOnceCombatAttributes(source, read('OnceAdditionalAttributeValue')[16205061]);
    const result = calculateResolvedCombatHit(hit, context, modified, target, rules);
    expect(result.average).toBe(27950);
    expect(calculateResolvedCombatHit(hit, context, source, target, rules).average).toBe(26000);
  });
});
