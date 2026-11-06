import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rolePotentialIds,matrixCases,referenceInventory,timelineInventory} from './combat-workflow.mjs';
test('역할별 잠재력은 ID 자릿수 추정이 아니라 실제 풀에서 가져온다',()=>{
  const pool={MasterSpecificPotentialIds:[41],MasterNormalPotentialIds:[9],AssistSpecificPotentialIds:[31],AssistNormalPotentialIds:[7],CommonPotentialIds:[99,9]};
  assert.deepEqual(rolePotentialIds(pool,'main'),[9,41,99]);assert.deepEqual(rolePotentialIds(pool,'support'),[7,9,31,99]);
  assert.throws(()=>rolePotentialIds(pool,'other'));
});
test('잠재력별 기본/최대 레벨과 돌파 0~5를 빠뜨리지 않는다',()=>{
  const cases=matrixCases([11,12],{11:{MaxLevel:1},12:{MaxLevel:9}});
  assert.equal(cases.length,9);assert.deepEqual(cases[1].potentials,{11:1});assert.deepEqual(cases[2].potentials,{12:6});
  assert.deepEqual(cases.slice(-6).map(c=>c.limitBreak),[0,1,2,3,4,5]);
});
test('충돌하는 데이터 ID를 실행 규칙으로 단정하지 않고 후보를 모두 기록한다',()=>{
  const refs=referenceInventory([{path:'Parallel.cs',source:'AddBuff(123456); // 123456\nGetScriptValue(123456);'}],{Buff:{123456:{Id:123456}},ScriptParameter:{123456:{Id:123456}}});
  assert.equal(refs.length,1);assert.deepEqual(refs[0].tables,['Buff','ScriptParameter']);assert.equal(refs[0].locations.length,2);
});
test('콤보는 선택된 이벤트 그룹만 추출하고 없는 클립을 숨기지 않는다',()=>{
  const result=timelineInventory({comboAliases:[{tag:'B',clips:['1','2'],eventGroups:['1:강화']}],timelines:[{pathId:'1',name:'clip',events:[{group:0,name:'base'},{group:1,name:'extra'}]}],weapons:[]});
  assert.equal(result.aliases[0].clips[0].events[0].name,'extra');assert.equal(result.missing.length,1);
});
