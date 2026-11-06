import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {rolePotentialIds,matrixCases} from '../../../../scripts/combat-workflow.mjs';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {connectedCombatMains,connectedCombatSupports} from '../core/combat-adapter-registry';
import type {LiveCombatInput} from '../core/combat-live-build';
import type {CombatRuntimeState} from '../core/combat-runtime';

// Opt-in generic matrix. Ordinary full regression runs retain each character's
// dedicated semantic tests without replaying this matrix for every character.
if(!process.env.COMBAT_CHARACTER){
  it.skip('캐릭터 공통 검증: npm run combat:check -- <ID> --role main 또는 support',()=>{});
}else{
  const id=Number(process.env.COMBAT_CHARACTER),role=process.env.COMBAT_ROLE ?? 'main';
  if(!Number.isInteger(id)||!['main','support'].includes(role))throw new Error('캐릭터 ID/역할 설정 오류');
  const party=process.env.COMBAT_PARTY?process.env.COMBAT_PARTY.split(',').map(Number):role==='main'
    ?[id,...[157,142,145,130,160].filter(other=>other!==id).slice(0,2)]
    :[id===139?162:139,id,id===142?145:142];
  if(party.length!==3||new Set(party).size!==3||party.some(id=>!Number.isInteger(id))||
    (role==='main'?party[0]!==id:!party.slice(1).includes(id)))throw new Error('검증 파티는 역할 위치에 맞는 서로 다른 여행가 3명이어야 합니다.');
  if(!connectedCombatMains.includes(party[0]!)||party.slice(1).some(id=>!connectedCombatSupports.includes(id)))throw new Error('검증 파티에 미연결 역할이 있습니다. 파티를 대체하지 않습니다.');
  const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
  const tables=await loadExampleCombatTables(read,party);
  const pool=await read('CharPotential'),fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
  const ids=rolePotentialIds(pool[id],role as 'main'|'support'),cases=matrixCases(ids,tables.potentials);
  const policy={name:'ready',choose:(_s:CombatRuntimeState,legal:string[])=>legal.find(key=>key.includes('ultimate'))??legal[0]??null};
  function run(limitBreak:number,potentials:Record<number,number>,selectedParty=party){
    const live:LiveCombatInput={actors:selectedParty.map(actor=>({id:actor,level:90,ascension:8,limitBreak:actor===id?limitBreak:0,
      potentials:actor===id?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const result=evaluateCombatPolicies(p.model,[policy],180,60,p.boss.switchRate)[0]!;
    expect(Number.isFinite(result.damage)).toBe(true);expect(result.damage).toBeGreaterThan(0);
    expect(Object.entries(result.state.counts).some(([key,count])=>key.startsWith(`${id}:skill`)&&count>0)).toBe(true);
    return result;
  }
  describe(`${id} ${role}: 자동 생성한 180초 조합 검사 (고유 효과 정답 검증은 별도)`,()=>{
    if(process.env.COMBAT_MATRIX_COVERED!=='1')for(const test of cases)it(test.name,()=>{run(test.limitBreak,test.potentials);});
    it.skipIf(process.env.COMBAT_MATRIX_COVERED==='1')('전체 설정 동일 입력 재현',()=>{
      const test=cases.at(-1)!,a=run(test.limitBreak,test.potentials),b=run(test.limitBreak,test.potentials);
      expect(a.damage).toBe(b.damage);expect(a.trace).toEqual(b.trace);
    });
    it('지원 위치를 바꿔도 선택 파티 그대로 계산',()=>{
      const test=cases.at(-1)!;run(test.limitBreak,test.potentials,[party[0]!,party[2]!,party[1]!]);
    });
  });
}
