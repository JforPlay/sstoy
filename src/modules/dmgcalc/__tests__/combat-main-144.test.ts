import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {createMain144} from '../core/combat-main-144';
import type {SupportCombatApi} from '../core/combat-support-adapter';
import {combatTagHash as hash} from '../core/combat-tags';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async name=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8')),[144,130,142]);
const context={parameter:()=>0,breakthrough:0,glimmerId:0,skillCooldown:()=>8};
function profile(potentials:Record<number,number>,limitBreak=0){
  const live={actors:[144,130,142].map(id=>({id,level:90,ascension:8,limitBreak:id===144?limitBreak:0,potentials:id===144?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});p.scenario.automatic=()=>null;return p;
}
function apiFixture(){
  const stacks=new Map<string,number>();
  return {actor:'144',main:'144',party:['144','130','142'],time:0,distance:2,
    buffs:{add:(owner:string,id:number)=>stacks.set(`${owner}:${id}`,(stacks.get(`${owner}:${id}`)??0)+1),remove:(owner:string,id:number)=>stacks.delete(`${owner}:${id}`),count:(owner:string,id:number)=>stacks.get(`${owner}:${id}`)??0},
    actorsByElement:()=>['144','130'],actorActive:()=>true,parameter:(id:number)=>({14406011:.4,14407011:100,14407012:3,14407013:3,14441011:50} as Record<number,number>)[id]??0,
    randomPercent:()=>0,schedule:vi.fn(),independentCombo:vi.fn(()=>1),area:vi.fn(),removeStacks:vi.fn(),hasBuffTag:()=>false,
  } as unknown as SupportCombatApi;
}
describe('치토세 원본 메인 규칙',()=>{
  it.each([false,true])('일반 %s: 공유 충전으로 일반→강화 전환',p3=>{
    const a=createMain144(p3?{514403:1}:{},context),api=apiFixture();let s=a.initialize(api);
    for(let i=0;i<(p3?1:2);i++)s=a.cast!(s,api,'skill');
    expect(s.strength).toBe(true);expect(a.canCast!(s,api,'skill')).toBe(false);
    s=a.cast!(s,api,'skill-strength');expect(s.strength).toBe(false);expect(s.uses).toBe(0);
    const actions=a.actions(true).filter(x=>x.kind.startsWith('skill'));
    expect(actions.map(x=>x.cooldownKey)).toEqual(['skill','skill']);
  });
  it('P4 쿨 감소·지연 분신 및 P10 충전 증가',()=>{
    const a=createMain144({514404:1,514410:6},context),api=apiFixture();
    a.cast!(a.initialize(api),api,'skill');expect(api.schedule).toHaveBeenCalledWith('shadow-skill',.25,{tag:'144_B1'});
    expect(a.actions(true).find(x=>x.kind==='skill')).toMatchObject({charges:3,cooldown:4});
  });
  it('P5 후속 일반 공격은 6단계, 다음 공격은 정상 순환',()=>{
    const a=createMain144({514405:6},context),api=apiFixture();let s=a.end!(a.initialize(api),api,'skill',true);
    s=a.cast!(s,api,'normal');expect(s.normalIndex).toBe(5);expect(s.skip).toBe(false);
    s=a.phase!(s,api,'normal','anticipation');expect(s.stage).toBe(0);
  });
  it('P6 마지막 단계 종료 후에도 분신의 스택을 보존',()=>{
    const a=createMain144({514402:1,514405:6,514406:6},context),api=apiFixture();
    api.buffs.add('144',14401011);for(let i=0;i<3;i++)api.buffs.add('144',14406012);
    let s={...a.initialize(api),normalIndex:5,normalTag:'Atk6'};
    s=a.custom!(s,api,'144_Shadow_Atk');s=a.end!(s,api,'normal',false);
    expect(api.independentCombo).toHaveBeenCalledWith('Atk6',{source:'char_14401_combos_monster.unity3d',speed:1});
    expect(a.beforeHit!(s,api,[hash('144_Atk6_Shadow')])).toContainEqual({id:14406001,count:3});
  });
  it('P7은 3초당 최대 3회, P9는 보스에게 강화 상태 유지',()=>{
    const a=createMain144({514407:6,514409:6},context),api=apiFixture();let s=a.initialize(api);
    for(let i=0;i<5;i++)s=a.attacked!(s,api,[hash('144_SnakeAtk_07')]);
    expect(api.area).toHaveBeenCalledTimes(3);api.time=3;
    s=a.attacked!(s,api,[hash('144_SnakeAtk_07'),hash('144_B1Strength')]);expect(api.area).toHaveBeenCalledTimes(4);expect(s.strength).toBe(true);
  });
  it('P41 냉기 두 번 적용·3스택 동결, P43 동결 추가 계수',()=>{
    const a=createMain144({514441:6,514443:6},context),api=apiFixture();
    api.buffs.add('boss',4021);api.buffTagCount=(_owner,tag)=>tag==='Cold'?api.buffs.count('boss',4021):0;
    api.removeBuffTag=()=>api.buffs.remove('boss',4021);
    a.beforeMark!(a.initialize(api),api,[hash('144_Ultra')]);expect(api.buffs.count('boss',4100)).toBe(1);
    api.hasBuffTag=(_owner,tag)=>tag==='Frozen';
    expect(a.beforeHit!(a.initialize(api),api,[hash('144_Ultra')])).toEqual([{id:14441001,count:1},{id:14443001,count:1}]);
  });
  it('P13은 물 지원이 실제로 나왔을 때만 유지',()=>{
    const a=createMain144({514413:6},context),api=apiFixture();let s=a.tick!(a.initialize(api),api);
    expect(api.buffs.count('144',14413011)).toBe(1);api.actorActive=()=>false;s=a.tick!(s,api);
    expect(api.buffs.count('144',14413011)).toBe(0);
  });
  it('P4 분신은 NO_DAMAGE를 본체 피해로 한 번만 귀속',()=>{
    const p=profile({514404:1});let s=p.model.cast(p.model.initial(),'144:skill',0).state;
    s=p.model.advance(s,2).state;
    const baseline=profile({}),plain=baseline.model.advance(baseline.model.cast(baseline.model.initial(),'144:skill',0).state,2).state;
    expect(s.hitCounts?.['144:144310001']).toBe(plain.hitCounts?.['144:144310001']);
    expect(s.hitCounts?.['144:144310401']).toBe(4); // native repeated hitbox detections, no duplicate minion damage
    expect(s.hitCounts?.['144:144310411']??0).toBe(0);
    expect(Object.keys(s.hitCounts??{}).some(k=>k.startsWith('144#'))).toBe(false);
  });
  it('P1/P2 일반 공격 분신은 기본타와 강화타 모두 재생',()=>{
    const p=profile({514401:1,514402:1});let s=p.model.initial();p.buffApi(s).add('144',14401011,'144');
    s=p.model.cast(s,'144:normal',0).state;s=p.model.advance(s,2).state;
    expect(s.hitCounts?.['144:144310201']).toBe(2);expect(s.hitCounts?.['144:144311101']).toBeGreaterThan(0);
  });
});
