import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBaseCombatAttributes } from '../core/combat-base';
const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const tables = { characters: read('Character'), attributes: read('Attribute'), discs: read('Disc'), discExtra: read('DiscExtraAttribute') };
const example = JSON.parse(readFileSync('public/guides/rotation-example.json', 'utf8'));
describe('example actor base attributes', () => {
  it('includes all six record breakthrough bonuses 511111', () => {
    const without = createBaseCombatAttributes(162, 90, 8, example.records.map((record: any) => ({ ...record, limitBreak: 0 })), tables);
    const withBreak = createBaseCombatAttributes(162, 90, 8, example.records, tables);
    expect(withBreak[1]!.origin - without[1]!.origin).toBe(1300);
    expect(withBreak[3]!.origin).toBe(tables.attributes['16208090'].Hp);
    expect(withBreak[47]!.origin).toBe(1);
  });
  it.each([0,1,2,3,4,5])('resolves the original six records at breakthrough %s without a missing attribute row',limitBreak=>{
    const records=example.records.map((record:any)=>({...record,limitBreak}));
    const result=createBaseCombatAttributes(162,90,8,records,tables);
    const zero=createBaseCombatAttributes(162,90,8,records.map((record:any)=>({...record,limitBreak:0})),tables);
    expect(result[1]!.origin-zero[1]!.origin).toBe(6*130*limitBreak);
  });
  it('does not copy the main HP-based stats onto support characters', () => {
    const main = createBaseCombatAttributes(162, 90, 8, example.records, tables);
    const hotaru = createBaseCombatAttributes(115, 80, 8, example.records, tables);
    expect(hotaru[3]!.origin).toBe(48832);
    expect(main[3]!.origin).toBe(94662);
    expect(hotaru[1]!.origin - main[1]!.origin).toBe(7141 - 6966);
  });
});
