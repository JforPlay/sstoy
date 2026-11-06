import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addCombatBuff } from '../core/combat-buffs';
import { collectCombatBuffAttributes, addOnceCombatAttributes } from '../core/combat-effects';
import { readCombatAttribute, readScopedCombatAttribute } from '../core/combat-attributes';
import type { CombatLevelContext } from '../core/rotation-values';
const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const definitions = read('Buff'), values = read('BuffValue'), effects = read('Effect'), effectValues = read('EffectValue');
const context: CombatLevelContext = { characterLevel: 90, ascension: 8, limitBreak: 1, potentials: {}, skillSlots: {}, concertos: {}, notes: {}, buildLevel: 1 };
describe('selected party attribute effect resolution', () => {
  it('does not parse the native DarkAnZhuo tag string as an attribute number',()=>{
    const state=addCombatBuff({},values[15700001],'boss','157',0);
    const result=collectCombatBuffAttributes({},'boss',state,1,definitions,values,effects,effectValues,{'157':context});
    expect(result).toEqual({attributes:{},scoped:[]});
  });
  it('keeps hit-only attributes out of snapshots and applies them at impact', () => {
    const state = addCombatBuff({}, values[10896411], '108', '108', 0);
    const base = { 57: { origin: 1, base: 0, percent: 0, absolute: 0 } };
    const snapshot = collectCombatBuffAttributes(base, '108', state, 1, definitions, values, effects, effectValues, { '108': context });
    expect(readCombatAttribute(snapshot.attributes, 57, {})).toBe(1);
    const impact = collectCombatBuffAttributes(snapshot.attributes, '108', state, 1, definitions, values, effects, effectValues,
      { '108': context }, { damageType: 2 }, snapshot.scoped, true);
    expect(readCombatAttribute(impact.attributes, 57, {})).toBeCloseTo(1.23);
    const expired = collectCombatBuffAttributes(snapshot.attributes, '108', state, 4, definitions, values, effects, effectValues,
      { '108': context }, { damageType: 2 }, snapshot.scoped, true);
    expect(readCombatAttribute(expired.attributes, 57, {})).toBe(1);
  });
  it('uses the source potential level for Hotaru team light damage, without pooling actor stats', () => {
    const state = addCombatBuff({}, values[11533011], 'main', 'hotaru', 0);
    const source = { ...context, potentials: { 511533: 6 } };
    const result = collectCombatBuffAttributes({ 21: { origin: 1, base: 0, percent: 0, absolute: 0 } }, 'main', state, 0,
      definitions, values, effects, effectValues, { hotaru: source });
    const bonus = Number(effectValues[11533061].EffectTypeParam1);
    expect(readCombatAttribute(result.attributes, 21, {})).toBeCloseTo(1 + bonus);
  });
  it('resolves different sources of the same stack group at their own potential levels',()=>{
    const row={...values[11533011],LaminatedNum:3};
    let state=addCombatBuff({},row,'main','first',0);
    state=addCombatBuff(state,row,'main','second',0);
    const result=collectCombatBuffAttributes({21:{origin:1,base:0,percent:0,absolute:0}},'main',state,0,
      definitions,values,effects,effectValues,{first:{...context,potentials:{511533:1}},second:{...context,potentials:{511533:6}}});
    expect(readCombatAttribute(result.attributes,21,{})).toBeCloseTo(1+Number(effectValues[11533011].EffectTypeParam1)+Number(effectValues[11533061].EffectTypeParam1));
  });
  it('keeps each wish stack as additive light-only normal/skill damage', () => {
    let state = addCombatBuff({}, values[4066115], 'main', 'main', 0);
    state = addCombatBuff(state, values[4066115], 'main', 'main', 1);
    const result = collectCombatBuffAttributes({ 57: { origin: 1, base: 0, percent: 0, absolute: 0 } }, 'main', state, 2,
      definitions, values, effects, effectValues, { main: context });
    expect(readScopedCombatAttribute(result.attributes, result.scoped, 57, 'element', 5)).toBeCloseTo(1.75);
    expect(readScopedCombatAttribute(result.attributes, result.scoped, 57, 'element', 1)).toBe(1);
  });
  it('the first duplicate breakthrough adds twelve percent crit damage on eligible hits only', () => {
    const base = { attributes: { 8: { origin: 1.5, base: 0, percent: 0, absolute: 0 } }, scoped: [] };
    const result = addOnceCombatAttributes(base, read('OnceAdditionalAttributeValue')[16296111]);
    expect(readCombatAttribute(result.attributes, 8, {})).toBeCloseTo(1.62);
    expect(readCombatAttribute(base.attributes, 8, {})).toBe(1.5);
  });
  it('boss weakness effects apply by damage category, not twice to all hits', () => {
    const state = addCombatBuff({}, values[631025030], 'boss', 'main', 0);
    const base = { 53: { origin: 1, base: 0, percent: 0, absolute: 0 } };
    const resolve = (damageType: number) => collectCombatBuffAttributes(base, 'boss', state, 1,
      definitions, values, effects, effectValues, { main: context }, { damageType });
    expect(readCombatAttribute(resolve(2).attributes, 53, {})).toBeCloseTo(1.24);
    expect(readCombatAttribute(resolve(1).attributes, 53, {})).toBeCloseTo(1.24);
    expect(readCombatAttribute(resolve(3).attributes, 53, {})).toBe(1);
  });
});
