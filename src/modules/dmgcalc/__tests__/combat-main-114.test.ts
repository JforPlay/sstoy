import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {createMain114} from '../core/combat-main-114';
import type {SupportCombatApi} from '../core/combat-support-adapter';
import {combatTagHash as hash} from '../core/combat-tags';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async n=>JSON.parse(readFileSync(`public/data/${n}.json`,'utf8')),[114,126,158]);
const context={parameter:()=>0,breakthrough:0,glimmerId:0,ammo:30,skillCooldown:()=>6};
function profile(potentials:Record<number,number>){
  const live={actors:[114,126,158].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:id===114?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});p.scenario.automatic=()=>null;return p;
}
function apiFixture(){
  const map=new Map<string,number>();
  return {actor:'114',main:'114',party:['114','126','158'],time:1,distance:2,
    buffs:{add:(o:string,id:number)=>map.set(`${o}:${id}`,(map.get(`${o}:${id}`)??0)+1),remove:(o:string,id:number)=>map.delete(`${o}:${id}`),count:(o:string,id:number)=>map.get(`${o}:${id}`)??0},
    projectile:vi.fn(),area:vi.fn(),schedule:vi.fn(),hit:vi.fn(),resetCooldown:vi.fn(),removeStacks:vi.fn(),removeBuffTag:vi.fn(),stopWeapons:vi.fn(),interrupt:vi.fn(),hasBuffTag:()=>true,parameter:()=>1,
  } as unknown as SupportCombatApi;
}
describe('샤통 메인 원본 실행',()=>{
  it.each([false,true])('긴 사격 P2=%s: 단일 보스에게 2발/4발, 무한 반사 없음',p2=>{
    const p=profile(p2?{511402:1}:{});let s=p.model.cast(p.model.initial(),'114:skill-long',0).state;
    s=p.model.advance(s,4).state;
    expect(s.hitCounts?.['114:114310003']).toBe(p2?4:2);
    expect(s.counts['114:skill-long']).toBe(1);
  });
  it('단타는 지속 피해를 생성하고 P4가 단계 상승',()=>{
    const a=createMain114({511404:6},context),api=apiFixture();let s=a.initialize(api);
    s=a.attacked!(s,api,[hash('114_Short_Bullet')]);expect(api.area).toHaveBeenLastCalledWith('AreaEffect_114_Main_Skill_Hit_Lv1','boss',{duration:15});
    s=a.attacked!(s,api,[hash('114_Short_Bullet')]);expect(api.area).toHaveBeenLastCalledWith('AreaEffect_114_Main_Skill_Hit_Lv2','boss',{duration:15});
  });
  it('P3는 빠른 지속 피해 콤포넌트 선택',()=>{
    const a=createMain114({511403:6},context),api=apiFixture();a.attacked!(a.initialize(api),api,[hash('114_Short_Bullet')]);
    expect(api.area).toHaveBeenCalledWith('AreaEffect_114_Main_Skill_Hit_Lv1_Quick','boss',{duration:15});
  });
  it('P6 회수 완료 후에만 다음 긴 사격의 강화탄 지급',()=>{
    const a=createMain114({511406:6},context),api=apiFixture();let s=a.initialize(api);
    s=a.projectileEnd!(s,api,'Bullet_114_Main_Skill_Shoot','boss');expect(api.buffs.count('114',11406011)).toBe(0);
    s=a.projectileEnd!(s,api,'Bullet_114_Main_Skill_Shoot_P05_Re','114');expect(api.buffs.count('114',11406011)).toBe(1);
    a.custom!(s,api,'shoot2');expect(api.projectile).toHaveBeenCalledWith('Bullet_114_Main_Skill_Shoot_P05_Big');expect(api.buffs.count('114',11406011)).toBe(0);
  });
  it('P9 단타 치명타만 쿨 초기화, 지속 피해는 제외',()=>{
    const a=createMain114({511409:6},context),api=apiFixture(),hit={actor:'114',element:2,damageType:2,slot:2,tags:[hash('114_Short_DoT')]};
    let s=a.crit!(a.initialize(api),api,hit);expect(api.resetCooldown).not.toHaveBeenCalled();
    s=a.crit!(s,api,{...hit,tags:[hash('114_Short_Bullet')]});expect(api.resetCooldown).toHaveBeenCalledTimes(1);
    a.crit!(s,api,{...hit,tags:[hash('114_Short_Bullet')]});expect(api.resetCooldown).toHaveBeenCalledTimes(1);
  });
  it('P41 추가 궁극기 피해는 자기 자신을 재귀 발동하지 않음',()=>{
    const a=createMain114({511441:6},context),api=apiFixture();api.buffs.add('boss',11440001);
    a.afterHit!(a.initialize(api),api,[hash('Ultra'),hash('Ultra_P41')],{} as any);expect(api.hit).not.toHaveBeenCalled();
    a.afterHit!(a.initialize(api),api,[hash('Ultra')],{} as any);expect(api.hit).toHaveBeenCalledWith(114541001);
  });
  it('P42 광폭화 20스택 및 만료 후 정상 공격 복귀',()=>{
    const a=createMain114({511442:6},context),api=apiFixture();let s=a.custom!(a.initialize(api),api,'StartRage');
    expect(s.rageLeft).toBe(20);expect(a.comboTag!(s,api,'normal')).toBe('Attack_Strong_P42');
    for(let i=0;i<20;i++)s=a.event!(s,api,'rage-tick',{rageGeneration:s.rageGeneration});
    expect(a.comboTag!(s,api,'normal')).toBe('Attack');
  });
  it('일반 사격은 탄약 소모, 재장전 전에는 일반 공격 불가',()=>{
    const a=createMain114({},context),api=apiFixture();let s=a.initialize(api);s=a.shot!(s,api,30);
    expect(a.canCast!(s,api,'normal')).toBe(false);s=a.phase!(s,api,'reload','anticipation');expect(s.ammo.value).toBe(30);
  });
});
