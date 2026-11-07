import {describe,it,expect,vi} from 'vitest';
import {createMain111} from '../core/combat-main-111';
import {createMain113} from '../core/combat-main-113';
import {createMain150} from '../core/combat-main-150';
import {createSupport116} from '../core/combat-support-116';
import {createSupport117} from '../core/combat-support-117';
import {createSupport120} from '../core/combat-support-120';
import {createSupport135} from '../core/combat-support-135';
import {createSupport141} from '../core/combat-support-141';
import {combatTagHash as hash} from '../core/combat-tags';
import {mockApi,profile} from './combat-four-helpers';
const context={breakthrough:5,glimmerId:0,parameter:()=>0};
describe('잔여 여행가 원본 분기 회귀',()=>{
  it('EffectType37은 공격력이 아닌 현재 역할의 SP 수집량에만 적용되고 만료',()=>{
    const p=profile(135,'support',{513542:1});p.scenario.automatic=()=>null;let s=p.model.initial();
    const before=p.scenario.spRecipients!(s).find(r=>r.pool==='139')!.efficiency;
    const attack=p.attributes(s,'139').attributes[1];p.buffApi(s).add('139',13554211,'135');
    expect(p.scenario.spRecipients!(s).find(r=>r.pool==='139')!.efficiency).toBeGreaterThan(before);
    expect(p.attributes(s,'139').attributes[1]).toEqual(attack);
    s=p.model.advance(s,11).state;expect(p.scenario.spRecipients!(s).find(r=>r.pool==='139')!.efficiency).toBe(before);
  });
  it('아야메 강화 스킬은 P1 20스택을 실제로 모아야 선택 가능',()=>{
    const a=createMain111({511101:1}),api=mockApi(111);let s=a.initialize(api);
    expect(a.canCast!(s,api,'skill-strong')).toBe(false);
    for(let i=0;i<20;i++)s=a.attacked!(s,api,[hash('Normal')]);
    expect(a.canCast!(s,api,'skill-strong')).toBe(true);expect(a.canCast!(s,api,'skill')).toBe(false);
    a.end!(s,api,'skill-strong',false);expect(api.buffs.count(api.actor,11150111)).toBe(0);
  });
  it('레이센 P21 두 번째 씨앗 비에만 추가 계수',()=>{
    const a=createSupport116({511621:1}),api=mockApi(116);let s=a.initialize(api);
    s=a.custom!(s,api,'SupSkill_SeedRain');a.custom!(s,api,'SupSkill_SeedRain');
    expect(vi.mocked(api.area).mock.calls[0]![2]!.additionalAttributes).toEqual([]);
    expect(vi.mocked(api.area).mock.calls[1]![2]!.additionalAttributes).toEqual([{id:11621001,count:1}]);
    expect(a.actions(false)[0]!.chain).toHaveLength(2);
  });
  it('징린 P27은 타격한 장판의 개별 생성 시각 기준',()=>{
    const a=createSupport117({511727:1}),api=mockApi(117),name='AreaEffect_117_B2_Skill_ElectricCircle';
    let s=a.weaponBegin!(a.initialize(api),api,name,1);api.time=3;s=a.weaponBegin!(s,api,name,2);api.time=4.1;
    const tags=[hash('117_B2_Skill_Hit')];s=a.attacked!(s,api,tags,{actor:'117',damageType:2,element:5,slot:2,tags,weaponId:2});
    expect(a.beforeHit!(s,api,tags)).toContainEqual({id:11727001,count:1});
    s=a.attacked!(s,api,tags,{actor:'117',damageType:2,element:5,slot:2,tags,weaponId:1});
    expect(a.beforeHit!(s,api,tags)).toContainEqual({id:11727001,count:3});
  });
  it('징린 P28 서로 다른 장판도 합쳐 3개 상한',()=>{
    const a=createSupport117({511728:1}),api=mockApi(117);let s=a.initialize(api);
    for(let id=1;id<=4;id++)s=a.weaponBegin!(s,api,'AreaEffect_117_B2_Skill_ElectricCircle',id);
    expect(s.circles.map(c=>c.id)).toEqual([2,3,4]);expect(api.stopWeapon).toHaveBeenCalledWith(1);
  });
  it('카나체 아군 전달 종료에서 꽃고리 생성, 단순 무기 취소와 구분',()=>{
    const a=createSupport120({512024:1}),api=mockApi(120),s=a.initialize(api);
    a.weaponEnd!(s,api,'Bullet_12001_B2_Skill_Projectile',1);expect(api.projectile).not.toHaveBeenCalled();
    a.projectileEnd!(s,api,'Bullet_12001_B2_Skill_Projectile',api.main);expect(api.projectile).toHaveBeenCalledTimes(2);
  });
  it('시먀오 후속기를 쓰지 않으면 3초 뒤 P6 쿨타임 감소',()=>{
    const a=createMain113({511306:1}),api=mockApi(113);let s=a.initialize(api);
    s={...s,loops:3};s=a.phase!(s,api,'skill','activation');expect(s.followUntil).toBe(4);
    expect(a.canCast!(s,api,'skill-follow')).toBe(true);api.time=4;
    s=a.event!(s,api,'follow-expire',{generation:s.followGeneration});expect(s.next).toBe(true);expect(api.reduceCooldown).toHaveBeenCalledTimes(1);
  });
  it('라루 2초 미만 질주는 P11 폭발하지 않고 재사용 간격도 유지',()=>{
    const a=createMain150({515011:1}),api=mockApi(150);let s=a.cast!(a.initialize(api),api,'rush');
    api.time=2.9;s=a.end!(s,api,'rush',true);expect(api.area).not.toHaveBeenCalled();
    api.time=3;s=a.end!(s,api,'rush',false);expect(api.area).toHaveBeenCalledTimes(1);
    s=a.cast!(s,api,'rush');api.time=5;a.end!(s,api,'rush',false);expect(api.area).toHaveBeenCalledTimes(1);
  });
  it('라루 세 번 베기 선택은 P3일 때만 노출',()=>{
    expect(createMain150({}).actions(false).filter(a=>a.kind.startsWith('skill'))).toHaveLength(1);
    const actions=createMain150({515003:1,515004:1}).actions(false);expect(actions.filter(a=>a.kind.startsWith('skill'))).toHaveLength(3);
    expect(actions.find(a=>a.kind==='skill:3')!.chain!.some(c=>c.repeatSeconds===4)).toBe(true);
  });
  it('징린 원본에 없는 전용 잠재력 세 개 조합은 거부',()=>{
    expect(()=>createSupport117({511721:1,511722:1,511723:1})).toThrow();
    for(const omitted of [511721,511722,511723]){const p:Record<number,number>={511721:1,511722:1,511723:1};delete p[omitted];expect(()=>createSupport117(p)).not.toThrow();}
  });
  it('미스티 궁 P41은 살아 있는 유령만 소비',()=>{
    const a=createSupport135({513541:1}),api=mockApi(135),s={...a.initialize(api),ghosts:[{id:1,alive:true,born:0},{id:2,alive:false,born:0}]};
    a.cast!(s,api,'ultimate');expect(api.schedule).toHaveBeenCalledTimes(1);expect(api.schedule).toHaveBeenCalledWith('ghost-boom',0,{id:1});expect(api.buffs.count(api.actor,13554111)).toBe(1);
  });
  it('치시아 P23 강화는 새 소환수가 아닌 기존 호랑이에 0.5초 후 전달',()=>{
    const a=createSupport141({514123:1},context),api=mockApi(141);let s=a.initialize(api);
    s=a.custom!(s,api,'141_Summon');const generation=s.generation;s=a.event!(s,api,'pet-spawn',{generation,tiger:1});
    vi.mocked(api.schedule).mockClear();a.custom!(s,api,'141_Summon');expect(api.schedule).toHaveBeenCalledTimes(1);expect(api.schedule).toHaveBeenCalledWith('tiger-strength',.5,{id:1});
  });
  it('치시아 소환수의 먹물 4스택 점화는 비치명 지속 피해로 연결',()=>{
    const a=createSupport141({},context),api=mockApi(141),count=api.buffs.count;api.buffs.count=(owner,id)=>id===14191015?4:count(owner,id);
    a.afterMinionHit!(a.initialize(api),api,1,{actor:'141',tags:[hash('141_Ignite')],damageType:2,element:2,slot:2},false);
    expect(api.onceDot).toHaveBeenCalledWith(14191014,141100008,1);
  });
  it('치시아 소환 재시작은 이전 투척 세대의 소환을 취소',()=>{
    const a=createSupport141({},context),api=mockApi(141);let s=a.initialize(api);s=a.cast!(s,api,'skill');
    const result=a.event!(s,api,'pet-spawn',{generation:0,tiger:0});expect(result.pets).toHaveLength(0);expect(api.summon).not.toHaveBeenCalled();
  });
  for(const [id,role] of [[111,'main'],[113,'main'],[116,'support'],[117,'support'],[120,'support'],[135,'support'],[141,'support'],[150,'main']] as const){
    it.each([true,false])(`${id} ${role} 스킬 및 궁극기 원본 타격 연결 (연출=%s)`,cinematics=>{
      const p=profile(id,role,{},cinematics);p.scenario.automatic=()=>null;let s=p.model.initial();
      s=p.model.cast(s,`${id}:skill`,0).state;s=p.model.advance(s,20).state;
      expect(Object.keys(s.hitCounts??{}).some(k=>k.startsWith(`${id}:`)||k.startsWith(`${id}#`)),JSON.stringify({counts:s.hitCounts,scripts:s.supportScripts,weapons:s.weapons})).toBe(true);
      s.sp.ledger.pools[String(id)]!.value=s.sp.ledger.pools[String(id)]!.capacity;
      s=p.model.cast(s,`${id}:ultimate`,20).state;s=p.model.advance(s,40).state;
      expect(s.counts[`${id}:ultimate`]).toBe(1);expect(Number.isFinite(s.damage)).toBe(true);
    });
  }
});
