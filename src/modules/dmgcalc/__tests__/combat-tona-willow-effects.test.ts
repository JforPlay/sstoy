import {describe,it,expect,vi} from 'vitest';
import {createSupport130} from '../core/combat-support-130';
import {createSupport160} from '../core/combat-support-160';
import {combatTagHash as hash} from '../core/combat-tags';
import type {SupportCombatApi} from '../core/combat-support-adapter';

function fixture(actor='130'){
  const stacks=new Map<string,number>(),key=(owner:string,id:number)=>`${owner}:${id}`;
  const api={actor,main:'134',party:['134','130','160'],time:0,distance:2,
    buffs:{add:(owner:string,id:number)=>stacks.set(key(owner,id),Math.min(id===16000001?100:1000,(stacks.get(key(owner,id)) ?? 0)+1)),
      remove:(owner:string,id:number)=>stacks.delete(key(owner,id)),count:(owner:string,id:number)=>stacks.get(key(owner,id)) ?? 0},
    actorsByElement:()=>['134','130','160'],actorInfo:()=>({element:1,job:1}),
    parameter:(id:number)=>({13043011:1,13043013:3,13027011:30,16041011:2,16041012:5,16041013:3,16096411:3} as Record<number,number>)[id] ?? 1,
    schedule:vi.fn(),projectile:vi.fn(),area:vi.fn(),stopWeapons:vi.fn(),drop:vi.fn(),hit:vi.fn(),hitAs:vi.fn(),
    extendAreas:vi.fn(),activeAreas:()=>1,areaContains:()=>true,hasBuffTag:()=>false,
    activeAction:()=> 'skill',bossHpPercent:()=>.2,buffLimit:()=>100,shield:vi.fn(),emitProc:vi.fn(),
    removeStacks:(owner:string,id:number,count:number)=>stacks.set(key(owner,id),Math.max(0,(stacks.get(key(owner,id)) ?? 0)-count)),
    interrupt:vi.fn(),randomPercent:()=>75,areaRadius:()=>8,buffTagCount:()=>4,
  } as unknown as SupportCombatApi;
  return api;
}
const hit=(actor:string,tags:number[])=>({actor,damageType:2,element:1,slot:2,tags});
describe('Tona native effect settlement',()=>{
  it('locks P24 to three aimed projectiles, with the one-target attribute on each',()=>{
    const api=fixture(),r=createSupport130({513024:1,513023:1});
    r.custom!(r.initialize(api),api,'B2P24_Shoot');
    expect(api.projectile).toHaveBeenCalledTimes(3);
    expect(api.projectile).toHaveBeenNthCalledWith(1,'Bullet_130_B2P30_Attack_1_Big','boss',1,{additionalAttributes:[{id:13024011,count:1}]});
  });
  it('settles P22 against the old arrows before adding the next stack',()=>{
    const api=fixture(),r=createSupport130({513022:1}),tags=[hash('130_P22_2')];
    api.buffs.add('boss',13022011);
    let s=r.afterHit!(r.initialize(api),api,tags,hit('130',tags));
    expect(api.hit).toHaveBeenCalledWith(130522002);
    expect(api.buffs.count('boss',13022011)).toBe(1);
    s=r.event!(s,api,'arrow-add',{});
    expect(api.buffs.count('boss',13022011)).toBe(2);
    r.end!(s,api,'skill',false);
    expect(api.hit).toHaveBeenCalledWith(130522001,[{owner:'boss',id:13022011},{owner:'boss',id:13022012}]);
  });
  it('bursts P25 only after the third penetrate hit and its native delay',()=>{
    const api=fixture(),r=createSupport130({513025:6}),tags=[hash('130_B2_Penetrate')];
    let s=r.initialize(api);
    for(let n=0;n<3;n++)s=r.afterHit!(s,api,tags,hit('130',tags));
    expect(api.schedule).toHaveBeenCalledWith('penetrate-burst',.2);
    expect(api.hit).not.toHaveBeenCalled();
    r.event!(s,api,'penetrate-burst',{});
    expect(api.buffs.count('boss',13025013)).toBe(0);expect(api.hit).toHaveBeenCalledWith(130525001);
  });
  it('extends P43 only on frozen hits, at most the native parameter count',()=>{
    const api=fixture(),r=createSupport130({513043:6}),tags=[hash('130_Ultra')];
    let s=r.afterHit!(r.initialize(api),api,tags,hit('130',tags));
    expect(api.extendAreas).not.toHaveBeenCalled();
    api.hasBuffTag=()=>true;
    for(let n=0;n<5;n++)s=r.afterHit!(s,api,tags,hit('130',tags));
    expect(api.extendAreas).toHaveBeenCalledTimes(3);
    expect(r.beforeHit!(s,api,tags)).toEqual([{id:13043001,count:3}]);
  });
  it('does not grant the P42 aura to water actors outside the area',()=>{
    const api=fixture(),r=createSupport130({513042:6});let s=r.initialize(api);
    s=r.tick!(s,api);expect(api.buffs.count('134',13042011)).toBe(1);
    api.areaContains=()=>false;r.tick!(s,api);expect(api.buffs.count('134',13042011)).toBe(0);
  });
});
describe('Willow native resident mechanics',()=>{
  const context={breakthrough:0,parameter:()=>1,glimmerId:0};
  it('uses rotate before line/torrent and consumes exactly 40 decibels',()=>{
    const api=fixture('160'),r=createSupport160({516021:1,516022:1,516023:1,516029:6},context);
    let s=r.cast!(r.initialize(api),api,'skill');s=r.end!(s,api,'skill',false);
    expect(s.decibels).toBe(70);expect(r.automatic!(s,api)).toBe('rotate');
    s=r.cast!(s,api,'rotate');expect(s.decibels).toBe(30);
    expect(api.buffs.count('134',16029011)).toBe(1);
  });
  it('unlocks line after ten actual shots, not ten animation starts',()=>{
    const api=fixture('160'),r=createSupport160({516021:1},context);
    let s=r.end!(r.cast!(r.initialize(api),api,'skill'),api,'skill',false);
    for(let n=0;n<9;n++)s=r.custom!(s,api,'Event_160_Sup_Shoot');
    expect(r.automatic!(s,api)).toBe('resident');
    s=r.custom!(s,api,'Event_160_Sup_Shoot');expect(r.automatic!(s,api)).toBe('line');
    s=r.cast!(s,api,'line');expect(s.decibels).toBe(50);expect(s.canLine).toBe(false);
  });
  it('stops torrential fire at 50 instead of running a fixed number of loops',()=>{
    const api=fixture('160'),r=createSupport160({516023:1},context);
    let s=r.end!(r.cast!(r.initialize(api),api,'skill'),api,'skill',false);
    s={...s,decibels:100};for(let n=0;n<30;n++)api.buffs.add('160',16000001);
    expect(r.automatic!(s,api)).toBe('torrent');
    for(let n=0;n<25;n++)s=r.custom!(s,api,'Event_160_Sup_P23');
    expect(s.decibels).toBe(50);expect(api.interrupt).toHaveBeenCalledTimes(1);
    expect(r.continuation!(s,api,'torrent')).toBeNull();
  });
  it('pauses residence during ultimate and resumes only after the return skill',()=>{
    const api=fixture('160'),r=createSupport160({},context);
    let s=r.end!(r.cast!(r.initialize(api),api,'skill'),api,'skill',false);
    s=r.cast!(s,api,'ultimate');api.time=3;s=r.tick!(s,api);expect(s.remaining).toBe(17);
    s=r.end!(s,api,'ultimate',false);expect(r.automatic!(s,api)).toBe('return');
    s=r.end!(s,api,'return',false);api.time=4;s=r.tick!(s,api);expect(s.remaining).toBe(16);
  });
  it('uses the water-mark trigger actor for P26 damage, with Willow scaling',()=>{
    const api=fixture('160'),r=createSupport160({516026:6},context);api.hasBuffTag=()=>true;
    let s=r.markTriggered!(r.initialize(api),api,1,[],'134');
    r.markTriggered!(s,api,1,[],'130');expect(api.hitAs).toHaveBeenCalledTimes(1);
    expect(api.hitAs).toHaveBeenCalledWith('134',160526001);
    expect(r.beforePartyHit!(s,api,hit('134',[hash('160_P26')]))).toEqual([{id:16026001,count:4,source:'160'}]);
  });
  it('grants native P30 red/blue end effects at area finish, not on spawn',()=>{
    const api=fixture('160'),r=createSupport160({516030:6},context),s=r.initialize(api);
    r.areaEnd!(s,api,'AreaEffect_16001_Sup_P30_Red',{x:2,z:0});
    expect(api.buffs.count('134',16030012)).toBe(2);expect(api.buffs.count('134',16030011)).toBe(1);
    r.areaEnd!(s,api,'AreaEffect_16001_Sup_P30_Blue',{x:2,z:0});
    expect(api.buffs.count('134',16030012)).toBe(3);
  });
});
