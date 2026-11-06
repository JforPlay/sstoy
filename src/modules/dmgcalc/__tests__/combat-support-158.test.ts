import {it,expect,vi} from 'vitest';
import {createSupport158} from '../core/combat-support-158';
import {combatTagHash as hash} from '../core/combat-tags';
import type {SupportCombatApi} from '../core/combat-support-adapter';
function fixture(){
  const buffs=new Map<string,number>();
  return {actor:'158',main:'103',party:['103','158','134'],time:0,distance:2,
    buffs:{add:(a:string,id:number)=>buffs.set(`${a}:${id}`,(buffs.get(`${a}:${id}`) ?? 0)+1),remove:(a:string,id:number)=>buffs.delete(`${a}:${id}`),count:(a:string,id:number)=>buffs.get(`${a}:${id}`) ?? 0},
    actorsByElement:(element:number)=>element===2?['103','158','134']:[],actorInfo:()=>({element:2,job:1}),
    parameter:(id:number)=>({15832001:5,15829011:8,15823011:10,15829012:15,15840001:12} as Record<number,number>)[id] ?? 0,
    summon:vi.fn(),despawn:vi.fn(),independentCombo:vi.fn(()=>1),independentLease:vi.fn(),independentAllowed:()=>true,summonAttribute:()=>1,
    emitProc:vi.fn(),schedule:vi.fn(),projectile:vi.fn(),area:vi.fn(),weaponData:()=>({areaEffectPrefab:{m_PathID:'native'}}),weaponName:()=> 'native-impact',
    minionHit:vi.fn(),shield:vi.fn(),removeShield:vi.fn(),hasBuffTag:()=>true,
  } as unknown as SupportCombatApi;
}
const gift={actor:'158',damageType:2,element:2,slot:2,tags:[],weapon:'Bullet_15801_Summon_Attack_Cannon_Support_Shoot'};
it('four actual gift impacts merge soldiers only after their death animation',()=>{
  const api=fixture(),r=createSupport158({515823:1});let s=r.initialize(api);
  for(let n=0;n<4;n++)s=r.afterHit!(s,api,[],gift);
  expect(api.summon).toHaveBeenCalledTimes(4);expect(api.despawn).toHaveBeenCalledTimes(4);expect(s.toys).toHaveLength(0);
  expect(api.schedule).toHaveBeenCalledWith('promote',1);
  s=r.event!(s,api,'promote',{});expect(s.toys).toHaveLength(1);expect(s.toys[0]!.hero).toBe(true);
});
it('without P23 only the oldest fifth soldier is removed',()=>{
  const api=fixture(),r=createSupport158({});let s=r.initialize(api);
  for(let n=0;n<5;n++)s=r.afterHit!(s,api,[],gift);
  expect(s.toys.map(t=>t.id)).toEqual([2,3,4,5]);expect(api.despawn).toHaveBeenCalledTimes(1);expect(api.despawn).toHaveBeenCalledWith(1);
});
it('P25 adds two real loop shots and an interrupted cast hands the remainder to its cannon',()=>{
  const api=fixture(),r=createSupport158({515825:6});let s=r.initialize(api);
  expect(r.actions(true)[0]!.loopCount).toBe(6);
  s=r.custom!(s,api,'158_Support_Shoot');s=r.custom!(s,api,'158_Support_Shoot');s=r.end!(s,api,'skill',true);
  expect(s.cannonLeft).toBe(4);expect(api.schedule).toHaveBeenCalledWith('cannon',1,{generation:1,index:0});
  s=r.custom!(s,api,'158_Support_Shoot',{independentTag:'15801_Cannon_Attack_Support'});
  expect(s.cannonLeft).toBe(3);expect(s.shots).toBe(2);
});
it('P29 resolves separate native soldier and warrior lifetimes',()=>{
  const api=fixture(),r=createSupport158({515829:6});let s=r.afterHit!(r.initialize(api),api,[],gift);
  expect(s.toys[0]!.expires).toBe(8);
  s=r.event!(s,api,'promote',{});expect(s.toys.find(t=>t.hero)!.expires).toBe(15);
});
it('P24 starts the learned skill after birth and respects its four-second request interval',()=>{
  const api=fixture(),r=createSupport158({515824:1});let s=r.afterHit!(r.initialize(api),api,[],gift);
  api.time=1;s=r.tick!(s,api);
  expect(s.toys[0]!.tag).toBe('15801_Soldier_Skill_Strengthen_Support');expect(s.toys[0]!.skillAt).toBe(5);
  api.time=2;s=r.tick!(s,api);expect(s.toys[0]!.tag).toBe('15801_Soldier_Attack_Support');
});
it('P28 pulses are independent minion hits, not owner skill hits',()=>{
  const api=fixture(),r=createSupport158({515828:6});let s=r.afterHit!(r.initialize(api),api,[],gift);
  api.time=1;s=r.tick!(s,api);api.time=2.1;r.tick!(s,api);
  expect(api.minionHit).toHaveBeenCalledWith(1,158528001);
});
it('P30 grants summon damage stacks on hits and party fire stacks only on actual crits',()=>{
  const api=fixture(),r=createSupport158({515830:6}),s=r.initialize(api);
  r.afterMinionHit!(s,api,1,gift,false);expect(api.buffs.count('158#1',15830012)).toBe(1);expect(api.buffs.count('103',15830013)).toBe(0);
  r.afterMinionHit!(s,api,1,gift,true);expect(api.buffs.count('103',15830013)).toBe(1);
});
it('P22 and P33 team debuffs require an entirely fire party',()=>{
  const api=fixture(),r=createSupport158({515822:1,515833:6}),s=r.initialize(api),tags=[hash('158_P22'),hash('158_P33')];
  api.actorsByElement=()=>['158'];r.afterHit!(s,api,tags,{...gift,weapon:undefined});expect(api.buffs.count('boss',15822011)).toBe(0);
  api.actorsByElement=()=>api.party;r.afterHit!(s,api,tags,{...gift,weapon:undefined});expect(api.buffs.count('boss',15822011)).toBe(1);expect(api.buffs.count('boss',15833011)).toBe(1);
});
it('transformation grants a shield, schedules resident attacks and removes P43 on return',()=>{
  const api=fixture(),r=createSupport158({515843:6});let s=r.end!(r.initialize(api),api,'ultimate',false);
  expect(api.shield).toHaveBeenCalledWith(15840011,'158');expect(r.automatic!(s,api)).toBe('resident');
  api.time=1;s=r.tick!(s,api);expect(api.buffs.count('103',15843011)).toBe(1);
  api.time=12;expect(r.automatic!(s,api)).toBe('return');s=r.cast!(s,api,'return');s=r.end!(s,api,'return',false);
  expect(api.buffs.count('103',15843011)).toBe(0);expect(r.automatic!(s,api)).toBeNull();
});
