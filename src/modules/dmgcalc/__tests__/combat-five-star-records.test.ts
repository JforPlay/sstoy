import {readFileSync} from 'node:fs';
import {describe,it,expect,beforeAll} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel,type ExampleCombatTables} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const example=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const inventory=JSON.parse(readFileSync('public/data/CombatRecords.json','utf8'));
let tables:ExampleCombatTables;
beforeAll(async()=>{tables=await loadExampleCombatTables(read);});
describe('released five-star records in the calculator',()=>{
  it('activates a melody only in a main slot, not a sub slot',()=>{
    for(const slot of [0,3]){
      const input=structuredClone(example);input.records[slot]={...input.records[slot],id:214067,limitBreak:5};
      const {model,boss}=createExampleCombatModel(input,tables,{boss:27,distance:2,cinematics:false});
      const [result]=evaluateCombatPolicies(model,[{name:'ready',choose:(_state,legal)=>legal[0]??null}],25,60,boss.switchRate);
      const granted=Object.values(result!.state.buffs).some(buff=>buff.id===4067006);
      expect(granted).toBe(slot===0);
    }
  });
  for(const id of Object.keys(inventory).map(Number))it(`${id} runs without substituting the selected melody`,()=>{
    const input=structuredClone(example);
    input.records[0]={...input.records[0],id,limitBreak:5};
    const {model,boss}=createExampleCombatModel(input,tables,{boss:27,distance:2,cinematics:false});
    const [result]=evaluateCombatPolicies(model,[{name:'ready',choose:(_state,legal)=>legal.find(id=>id.includes('ultimate'))??legal[0]??null}],25,60,boss.switchRate);
    expect(result!.damage).toBeGreaterThan(0);
    expect(Number.isFinite(result!.damage)).toBe(true);
  });
});
