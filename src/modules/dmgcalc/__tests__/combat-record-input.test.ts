import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {getState,resetState,setDiscLimitBreak} from '../core/state';
import {captureCombatInput} from '../core/combat-input';
import {createBaseCombatAttributes} from '../core/combat-base';
const read=(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables={characters:read('Character'),attributes:read('Attribute'),discs:read('Disc'),discExtra:read('DiscExtraAttribute')};
describe('calculator record breakthrough input boundary',()=>{
  it('never allows the stepper to create a sixth breakthrough',()=>{
    resetState();setDiscLimitBreak('main1',6);expect(getState().discLimitBreaks.main1).toBe(5);
    setDiscLimitBreak('main1',-1);expect(getState().discLimitBreaks.main1).toBe(0);
  });
  it('repairs an old in-memory value of six without replacing the selected record combination',()=>{
    resetState();const state=getState();state.discLimitBreaks.main1=6;
    const builder={party:{master:{id:162},assist1:{id:115},assist2:{id:107}}};
    const discs={selectedDiscs:Object.fromEntries(fixture.records.map((record:any)=>[record.slot,{Id:record.id}]))};
    const input=captureCombatInput(state,builder,discs,tables.characters);
    expect(input.records.map(record=>record.id)).toEqual([214039,214038,214066,214051,214030,214005]);
    expect(input.records.map(record=>record.limitBreak)).toEqual([5,1,1,1,1,1]);
    expect(()=>createBaseCombatAttributes(162,90,8,input.records,tables)).not.toThrow();
  });
});
