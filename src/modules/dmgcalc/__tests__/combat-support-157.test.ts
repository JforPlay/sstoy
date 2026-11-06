import {describe,it,expect,vi} from 'vitest';
import {createSupport157} from '../core/combat-support-157';
import {combatTagHash} from '../core/combat-tags';
import type {SupportCombatApi} from '../core/combat-support-adapter';

function fixture(){
  const buffs=new Map<string,number>();
  const api={actor:'157',main:'162',party:['162','157','107'],time:0,distance:2,
    actorsByElement:(element:number)=>element===6?['157']:[],
    buffs:{add:(owner:string,id:number)=>buffs.set(owner+':'+id,(buffs.get(owner+':'+id) ?? 0)+1),
      remove:(owner:string,id:number)=>buffs.delete(owner+':'+id),count:(owner:string,id:number)=>buffs.get(owner+':'+id) ?? 0},
    schedule:vi.fn(),projectile:vi.fn(),directionalProjectile:vi.fn(),area:vi.fn(),hit:vi.fn(),
    activeAction:()=> 'skill',parameter:(id:number)=>id===15742002?3:.5,
    actorInfo:()=>({element:6,job:1}),
  } as unknown as SupportCombatApi;
  return api;
}
describe('157 native support triggers',()=>{
  it('aims the first lateral fish back across the forward axis, not away from it',()=>{
    const api=fixture(),rules=createSupport157({515721:1,515725:1});
    rules.custom!(rules.initialize(api),api,'157SkillSupHuiWu1');
    expect(api.directionalProjectile).toHaveBeenCalledWith('Bullet_157_Skill_Sup_P21_Fish1_P25',
      {x:3,z:-5,dx:Math.cos(Math.PI/2),dz:1});
  });
  it('limits P24 to four hits in each reset phase and only during the support skill',()=>{
    const api=fixture(),rules=createSupport157({515724:1});
    let state=rules.initialize(api);
    const tags=[combatTagHash('157SkillSupHuiWu')];
    for(let n=0;n<8;n++)state=rules.afterHit!(state,api,tags,{actor:'157',damageType:2,element:6,slot:2,tags});
    expect(api.area).toHaveBeenCalledTimes(4);
    state=rules.custom!(state,api,'157RestartP24');
    state=rules.afterHit!(state,api,tags,{actor:'157',damageType:2,element:6,slot:2,tags});
    expect(api.area).toHaveBeenCalledTimes(5);
    api.activeAction=()=>null;
    rules.afterHit!(state,api,tags,{actor:'157',damageType:2,element:6,slot:2,tags});
    expect(api.area).toHaveBeenCalledTimes(5);
  });
  it('P22 consumes its own tooth mark on every second fish hit without recursing',()=>{
    const api=fixture(),rules=createSupport157({515722:1}),state=rules.initialize(api);
    const tags=[combatTagHash('157SkillSupFishAtk')],hit={actor:'157',damageType:2,element:6,slot:2,tags};
    rules.afterHit!(state,api,tags,hit);expect(api.hit).not.toHaveBeenCalled();
    rules.afterHit!(state,api,tags,hit);
    expect(api.hit).toHaveBeenCalledTimes(1);expect(api.hit).toHaveBeenCalledWith(157300014);
    expect(api.buffs.count('boss',15721011)).toBe(0);
    rules.afterHit!(state,api,[],{...hit,tags:[]});expect(api.hit).toHaveBeenCalledTimes(1);
  });
  it('cancels a pending P42 volley when its native stop event occurs',()=>{
    const api=fixture(),rules=createSupport157({515742:1});
    let state=rules.cast!(rules.initialize(api),api,'ultimate');
    state=rules.custom!(state,api,'157P42PenSheStart');
    const generation=state.generation;
    state=rules.event!(state,api,'bubbles',{generation});
    expect(api.projectile).toHaveBeenCalledTimes(3);
    state=rules.custom!(state,api,'157P42PenSheEnd');
    rules.event!(state,api,'bubbles',{generation});
    expect(api.projectile).toHaveBeenCalledTimes(3);
  });
  it('does not apply the normal/elite-only P27 multiplier to raid bosses',()=>{
    const api=fixture(),rules=createSupport157({515725:1,515727:1});
    expect(rules.beforeHit!(rules.initialize(api),api,[combatTagHash('157FishAtk')])).toEqual([{id:15725001,count:1}]);
  });
});
