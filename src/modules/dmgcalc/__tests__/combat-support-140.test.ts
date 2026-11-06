import {describe,it,expect,vi} from 'vitest';
import {createSupport140} from '../core/combat-support-140';
import type {SupportCombatApi} from '../core/combat-support-adapter';
const context=(elements:number[])=>({parameter:()=>1,breakthrough:0,glimmerId:1,partyElements:elements});
function fixture(){
  const buffs=new Map<string,number>();
  const api={actor:'140',main:'main',party:['main','140','support'],time:0,distance:2,
    actorsByElement:(element:number)=>element===3?['main','140','support']:[],
    buffs:{add:(owner:string,id:number)=>buffs.set(owner+':'+id,(buffs.get(owner+':'+id) ?? 0)+1),
      remove:(owner:string,id:number)=>buffs.delete(owner+':'+id),count:(owner:string,id:number)=>buffs.get(owner+':'+id) ?? 0},
    schedule:vi.fn(),projectile:vi.fn(),area:vi.fn(),hit:vi.fn(),drop:vi.fn(),
    activeAction:()=>null,parameter:()=>5,actorInfo:()=>({element:3,job:1}),
  } as unknown as SupportCombatApi;
  return api;
}
describe('140 native support action lifecycle',()=>{
  it('selects the three-missile variant only for an all-earth party with P21',()=>{
    for(const [elements,count,tag] of [
      [[3,3,3],3,'140_Support_Skill_Fireworks_P21'],
      [[5,3,3],2,'140_Support_Skill_Fireworks'],
    ] as const){
      const api=fixture(),rules=createSupport140({514021:1},context([...elements]));
      expect(rules.actions(false)[0]!.tag).toBe(tag);
      rules.custom!(rules.initialize(api),api,'140_Support_Shoot');
      expect(api.schedule).toHaveBeenCalledTimes(count);
    }
  });
  it('keeps launched missiles alive after ending their initiating skill',()=>{
    const api=fixture(),rules=createSupport140({},context([5,3,3]));
    let state=rules.cast!(rules.initialize(api),api,'skill');
    const generation=state.generation;
    state=rules.end!(state,api,'skill',false);
    rules.event!(state,api,'missile',{generation});
    expect(api.projectile).toHaveBeenCalledTimes(1);
    rules.event!(state,api,'periodic-missile',{generation});
    expect(api.projectile).toHaveBeenCalledTimes(1);
  });
  it('converts rage to the rush buff once, including an interrupted ending',()=>{
    const api=fixture(),rules=createSupport140({514022:1},context([3,3,3]));
    let state=rules.cast!(rules.initialize(api),api,'skill');
    for(let n=0;n<3;n++)state=rules.custom!(state,api,'140_P22_Rage');
    state=rules.custom!(state,api,'140_P22_Rush');
    rules.end!(state,api,'skill',true);
    expect(api.buffs.count('140',14022012)).toBe(3);
    expect(api.buffs.count('140',14022011)).toBe(0);
    expect(api.projectile).toHaveBeenCalledTimes(1);
  });
  it('allows resident normal attacks only during P23 duration with an earth main',()=>{
    const api=fixture(),rules=createSupport140({514023:1},context([3,3,3]));
    let state=rules.cast!(rules.initialize(api),api,'skill');
    state=rules.end!(state,api,'skill',false);
    expect(rules.automatic!(state,api)).toBe('resident:0');
    state=rules.phase!(state,api,'resident:0','anticipation');
    state=rules.end!(state,api,'resident:0',false);
    expect(rules.automatic!(state,api)).toBe('resident:1');
    api.time=6;state=rules.tick!(state,api);
    expect(rules.automatic!(state,api)).toBeNull();
    expect(rules.canCast!(state,api,'resident:1')).toBe(false);
  });
  it('checks P41 against the source, element, normal damage and strict cooldown',()=>{
    const api=fixture(),rules=createSupport140({514041:1},context([3,3,3]));
    for(let n=0;n<3;n++)api.buffs.add(api.main,14041011,'140');
    let state=rules.initialize(api);
    const hit={actor:api.main,damageType:1,element:3,slot:1,tags:[]};
    state=rules.partyHit!(state,api,hit);
    expect(api.hit).toHaveBeenCalledTimes(1);
    api.time=5;state=rules.partyHit!(state,api,hit);
    expect(api.hit).toHaveBeenCalledTimes(1);
    api.time=5+1/60;rules.partyHit!(state,api,hit);
    expect(api.hit).toHaveBeenCalledTimes(2);
  });
});
