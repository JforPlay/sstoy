import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getCombatValue, resolveCombatValueId, resolveCombatHitIndex, type CombatLevelContext } from '../core/rotation-values';
const context: CombatLevelContext = { characterLevel: 90, ascension: 8, limitBreak: 1, potentials: { 516243: 6 }, skillSlots: { 3: 8 }, concertos: { 40661: 5 }, notes: { 90016: 70 }, buildLevel: 90 };
describe('client level-linked combat values', () => {
  it('looks up another party member\'s exclusive potential globally without changing the source actor skill level',()=>{
    const source={...context,potentials:{},partyPotentials:{515929:6}};
    expect(resolveCombatValueId({Id:15929001,levelTypeData:1,LevelData:515929},source)).toBe(15929061);
    expect(resolveCombatValueId({Id:1000,levelTypeData:3,LevelData:3},source)).toBe(1080);
    expect(source.potentials).toEqual({});
  });
  it('resolves all seven level sources without conflating skill and potential levels', () => {
    for (const [type, data, level] of [[0,0,0],[1,516243,6],[2,0,90],[3,3,8],[4,0,8],[5,90016,70],[6,40661,5],[7,0,90]]) {
      expect(resolveCombatValueId({ Id: 1000, levelTypeData: type, LevelData: data }, context)).toBe(1000 + level! * 10);
    }
  });
  it('distinguishes advancement-scaled marks from duplicate/talent breakthroughs', () => {
    expect(resolveCombatHitIndex({ Id: 162000001, levelTypeData: 4 }, context, 13)).toBe(8);
    expect(resolveCombatHitIndex({ Id: 1, levelTypeData: 1, LevelData: 516243 }, context, 13)).toBe(5);
    expect(resolveCombatHitIndex({ Id: 1, levelTypeData: 3, LevelData: 3 }, context, 13)).toBe(7);
  });
  it('uses the actual Lv6 Seina origin regeneration row', () => {
    const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
    const row = getCombatValue<{ CommonData: number }>(16243002, read('ScriptParameter'), read('ScriptParameterValue'), context);
    expect(row.CommonData).toBe(25000);
  });
  it('fails explicitly for missing definitions instead of inventing a zero effect', () => {
    expect(() => getCombatValue(1, {}, {}, context)).toThrow('Missing combat metadata');
  });
});
