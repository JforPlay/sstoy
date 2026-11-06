import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {planCombatAreaGeneration} from '../core/combat-area-generation';
const characters=[143,159,162].map(id=>JSON.parse(readFileSync(`public/data/combat/${id}.json`,'utf8')));
const weapons=characters.flatMap(character=>character.weapons);
describe('native nested area generation',()=>{
  it('generates the P22 rose child at birth, not by copying its parent damage coefficients',()=>{
    const rose=weapons.find(weapon=>weapon.name==='AreaEffect_15901_SkillSup_Rose_Perk22');
    const result=planCombatAreaGeneration(rose,weapons,.75);
    expect(result).toHaveLength(1);
    expect(result[0]!.time).toBe(0);
    expect(result[0]!.name).not.toBe(rose.name);
  });
  it('keeps the heavy sword hold-area spawn bound to parent finish',()=>{
    const fall=weapons.find(weapon=>weapon.name==='AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main');
    const result=planCombatAreaGeneration(fall,weapons,1);
    expect(result).toHaveLength(1);
    expect(result[0]!.finish).toBe(true);
    expect(result[0]!.time).toBe(1);
  });
  it('has separate initial and periodic tornado generations',()=>{
    const tornado=weapons.find(weapon=>weapon.name==='AreaEffect_143_P21_LongJuanFeng');
    const result=planCombatAreaGeneration(tornado,weapons,2);
    expect(result.map(event=>event.time)).toEqual([0,.5,1,1.5]);
  });
});
